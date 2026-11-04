import { IncrementalSha256 } from "../../../../src/persistence/incremental-sha256.js";
import type { DiagnosticPcm } from "./diagnostics.js";
export interface PairedV3Wave {
  id: string;
  bytes: number;
  sha256: string;
  frames: number;
  channels: 2;
  rate: 48000;
}
export interface PairedV3SnapshotOutput {
  readonly id: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly blob: Blob;
}
export interface PairedV3Timing {
  stage: string;
  id: string;
  elapsedMs: number;
}
export interface PairedV3LoadedPcm {
  bytes: ArrayBuffer;
  vector: DiagnosticPcm;
}
export interface PairedV3BudgetOptions {
  encodedBytes: number;
  twoWaveArrayBytes: number;
  leanPayloadBytes: number;
  additionalHeldBytes?: number;
  retainedSourceBytes?: number;
  retainedNativePcmBytes?: number;
}
const M = 1024 * 1024;
const LEAN_LIMIT = 6 * M;
/** Conservative logical metadata allowance, not a measured engine/GC heap size. */
export function assertLeanPairedProjection(value: unknown): {
  logicalPayloadBytes: number;
  jsonUtf8Bytes: number;
  objectCount: number;
  propertyCount: number;
} {
  const active = new WeakSet<object>(),
    seen = new WeakSet<object>();
  let structural = 0,
    objectCount = 0,
    propertyCount = 0;
  const heavyKeys = new Set([
    "input",
    "assetBank",
    "recordingFrames",
    "nativePCM",
    "nativePcm",
    "rendered",
    "channelsData",
  ]);
  function charge(n: number) {
    structural += n;
    if (!Number.isSafeInteger(structural) || structural > LEAN_LIMIT)
      throw new Error("PAIRED_V3_LEAN_PAYLOAD_CAP");
  }
  function visit(v: unknown, depth: number) {
    if (depth > 64) throw new Error("PAIRED_V3_LEAN_DEPTH");
    if (v === null) {
      charge(8);
      return;
    }
    if (typeof v === "string") {
      charge(16 + v.length * 2);
      return;
    }
    if (typeof v === "number" || typeof v === "boolean") {
      charge(8);
      return;
    }
    if (typeof v !== "object") throw new Error("PAIRED_V3_LEAN_VALUE");
    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer || v instanceof Blob)
      throw new Error("PAIRED_V3_LEAN_HEAVY");
    const proto = Object.getPrototypeOf(v);
    if (Array.isArray(v) ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
      throw new Error("PAIRED_V3_LEAN_PROTOTYPE");
    if (active.has(v)) throw new Error("PAIRED_V3_LEAN_CYCLE");
    if (seen.has(v)) return;
    if (Array.isArray(v) && v.length > 20000) throw new Error("PAIRED_V3_LEAN_ARRAY_CAP");
    seen.add(v);
    active.add(v);
    objectCount++;
    charge(96);
    for (const key of Reflect.ownKeys(v)) {
      if (typeof key !== "string") throw new Error("PAIRED_V3_LEAN_SYMBOL");
      const d = Object.getOwnPropertyDescriptor(v, key)!;
      if (d.get || d.set) throw new Error("PAIRED_V3_LEAN_ACCESSOR");
      if (heavyKeys.has(key) || (key === "frames" && Array.isArray(d.value)))
        throw new Error("PAIRED_V3_LEAN_HEAVY_ROOT");
      propertyCount++;
      if (propertyCount > 200000) throw new Error("PAIRED_V3_LEAN_PROPERTY_CAP");
      charge(32 + key.length * 2);
      visit(d.value, depth + 1);
    }
    active.delete(v);
  }
  visit(value, 0);
  type JsonSize = { units: number; bytes: number };
  const sizes = new WeakMap<object, JsonSize>();
  const boundedSize = (size: JsonSize): JsonSize => {
    if (
      !Number.isSafeInteger(size.units) ||
      !Number.isSafeInteger(size.bytes) ||
      structural + size.units * 2 + size.bytes > LEAN_LIMIT
    )
      throw new Error("PAIRED_V3_LEAN_PAYLOAD_CAP");
    return size;
  };
  function stringSize(s: string): JsonSize {
    let units = 2,
      bytes = 2;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 34 || c === 92) {
        units += 2;
        bytes += 2;
      } else if (c < 32) {
        const n = [8, 9, 10, 12, 13].includes(c) ? 2 : 6;
        units += n;
        bytes += n;
      } else if (c >= 0xd800 && c <= 0xdbff) {
        const next = s.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          units += 2;
          bytes += 4;
          i++;
        } else {
          units += 6;
          bytes += 6;
        }
      } else if (c >= 0xdc00 && c <= 0xdfff) {
        units += 6;
        bytes += 6;
      } else {
        units++;
        bytes += c < 128 ? 1 : c < 2048 ? 2 : 3;
      }
      boundedSize({ units, bytes });
    }
    return { units, bytes };
  }
  function expandedSize(v: unknown): JsonSize {
    if (v === null) return { units: 4, bytes: 4 };
    if (typeof v === "string") return stringSize(v);
    if (typeof v === "number") {
      const n = Number.isFinite(v) ? String(v) : "null";
      return { units: n.length, bytes: n.length };
    }
    if (typeof v === "boolean") return { units: v ? 4 : 5, bytes: v ? 4 : 5 };
    if (typeof v !== "object") throw new Error("PAIRED_V3_LEAN_VALUE");
    const cached = sizes.get(v);
    if (cached) return cached;
    let units = 2,
      bytes = 2,
      count = 0;
    const add = (size: JsonSize) => {
      if (count++) {
        units++;
        bytes++;
      }
      units += size.units;
      bytes += size.bytes;
      boundedSize({ units, bytes });
    };
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        add(d ? expandedSize(d.value) : { units: 4, bytes: 4 });
      }
    } else {
      for (const key of Object.keys(v)) {
        const d = Object.getOwnPropertyDescriptor(v, key)!;
        const k = stringSize(key),
          child = expandedSize(d.value);
        add({ units: k.units + 1 + child.units, bytes: k.bytes + 1 + child.bytes });
      }
    }
    const size = boundedSize({ units, bytes });
    sizes.set(v, size);
    return size;
  }
  // Counts aliases at every serialization position, but never allocates expanded JSON.
  const expanded = expandedSize(value),
    jsonUtf8Bytes = expanded.bytes;
  const logicalPayloadBytes = structural + expanded.units * 2 + jsonUtf8Bytes;
  if (!Number.isSafeInteger(logicalPayloadBytes) || logicalPayloadBytes > LEAN_LIMIT)
    throw new Error("PAIRED_V3_LEAN_PAYLOAD_CAP");
  return { logicalPayloadBytes, jsonUtf8Bytes, objectCount, propertyCount };
}
/** Reachable-payload admission only: retained heavy roots are always rejected. */
export function estimatePairedV3Working(o: PairedV3BudgetOptions): {
  estimatedBytes: number;
  components: Record<string, number>;
  maxWorkingBytes: number;
} {
  const additional = o.additionalHeldBytes ?? 0,
    source = o.retainedSourceBytes ?? 0,
    native = o.retainedNativePcmBytes ?? 0;
  for (const n of [
    o.encodedBytes,
    o.twoWaveArrayBytes,
    o.leanPayloadBytes,
    additional,
    source,
    native,
  ])
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("PAIRED_V3_BUDGET_VALUE");
  if (source !== 0 || native !== 0) throw new Error("PAIRED_V3_RETAINED_HEAVY_ROOTS");
  if (o.leanPayloadBytes > LEAN_LIMIT) throw new Error("PAIRED_V3_LEAN_PAYLOAD_CAP");
  if (o.encodedBytes > 192 * M) throw new Error("PAIRED_V3_MEMORY_ADMISSION");
  const components = {
    snapshotBlobBytes: o.encodedBytes,
    constructionCopyBytes: o.encodedBytes,
    twoWaveArrayBytes: o.twoWaveArrayBytes,
    cursorBytes: M,
    manifestStringsAndHashBytes: 10 * M,
    leanAndScratchBytes: 8 * M,
    additionalHeldBytes: additional,
  };
  const estimatedBytes = Object.values(components).reduce((sum, n) => sum + n, 0),
    maxWorkingBytes = 256 * M;
  if (!Number.isSafeInteger(estimatedBytes) || estimatedBytes > maxWorkingBytes)
    throw new Error("PAIRED_V3_MEMORY_ADMISSION");
  return { estimatedBytes, components, maxWorkingBytes };
}
function hashView(bytes: Uint8Array): string {
  const hash = new IncrementalSha256();
  for (let offset = 0; offset < bytes.byteLength; offset += 262144)
    hash.update(bytes.subarray(offset, Math.min(offset + 262144, bytes.byteLength)));
  return hash.digestHex();
}
/** Same original DataView reader/RIFF checks/selected SHA; only Blob acquisition differs. */
export async function readVerifiedSnapshotPcm(
  output: PairedV3SnapshotOutput,
  file: PairedV3Wave,
  onTiming?: (row: PairedV3Timing) => void,
): Promise<PairedV3LoadedPcm> {
  if (output.id !== file.id || output.bytes !== file.bytes || output.sha256 !== file.sha256)
    throw new Error(`PAIRED_READBACK_INTEGRITY:${file.id}`);
  if (!output.blob || output.blob.size !== file.bytes)
    throw new Error(`PAIRED_READBACK_SIZE:${file.id}`);
  let start = performance.now();
  const bytes = await output.blob.arrayBuffer();
  onTiming?.({ stage: "array-buffer", id: file.id, elapsedMs: performance.now() - start });
  if (bytes.byteLength !== 56 + file.frames * 8)
    throw new Error(`PAIRED_READBACK_INTEGRITY:${file.id}`);
  start = performance.now();
  const digest = hashView(new Uint8Array(bytes));
  onTiming?.({ stage: "selected-sha", id: file.id, elapsedMs: performance.now() - start });
  start = performance.now();
  const view = new DataView(bytes);
  const text = (offset: number, value: string) =>
    value
      .split("")
      .every((letter, index) => view.getUint8(offset + index) === letter.charCodeAt(0));
  if (
    digest !== file.sha256 ||
    !text(0, "RIFF") ||
    view.getUint32(4, true) + 8 !== bytes.byteLength ||
    !text(8, "WAVE") ||
    !text(12, "fmt ") ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 3 ||
    view.getUint16(22, true) !== 2 ||
    view.getUint32(24, true) !== 48000 ||
    view.getUint32(28, true) !== 48000 * 8 ||
    view.getUint16(32, true) !== 8 ||
    view.getUint16(34, true) !== 32 ||
    !text(36, "fact") ||
    view.getUint32(40, true) !== 4 ||
    view.getUint32(44, true) !== file.frames ||
    !text(48, "data") ||
    view.getUint32(52, true) !== file.frames * 8
  )
    throw new Error(`PAIRED_READBACK_INTEGRITY:${file.id}`);
  onTiming?.({ stage: "riff", id: file.id, elapsedMs: performance.now() - start });
  return {
    bytes,
    vector: {
      channels: 2,
      frames: file.frames,
      sample: (channel, frame) => view.getFloat32(56 + (frame * 2 + channel) * 4, true),
    },
  };
}
