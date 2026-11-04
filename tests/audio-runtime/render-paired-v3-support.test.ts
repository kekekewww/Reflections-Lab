import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertLeanPairedProjection,
  estimatePairedV3Working,
  readVerifiedSnapshotPcm,
  type PairedV3Wave,
} from "../browser/nonadvanced/long-render/paired-v3-support.js";
import {
  summarizePcmDifference,
  type DiagnosticPcm,
} from "../browser/nonadvanced/long-render/diagnostics.js";
const M = 1024 * 1024;
const base = { encodedBytes: 96000224, twoWaveArrayBytes: 48384112, leanPayloadBytes: 4096 };
function fixedWave(frames: number, edit?: (v: DataView) => void) {
  const b = Buffer.alloc(56 + frames * 8);
  b.write("RIFF", 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(48000, 24);
  b.writeUInt32LE(384000, 28);
  b.writeUInt16LE(8, 32);
  b.writeUInt16LE(32, 34);
  b.write("fact", 36);
  b.writeUInt32LE(4, 40);
  b.writeUInt32LE(frames, 44);
  b.write("data", 48);
  b.writeUInt32LE(frames * 8, 52);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  edit?.(v);
  const file: PairedV3Wave = {
    id: "fixed",
    bytes: b.length,
    sha256: createHash("sha256").update(b).digest("hex"),
    frames,
    channels: 2,
    rate: 48000,
  };
  return {
    bytes: b,
    file,
    output: { ...file, blob: new Blob([new Uint8Array(b)]) },
    legacy: {
      channels: 2,
      frames,
      sample: (c: number, f: number) => v.getFloat32(56 + (f * 2 + c) * 4, true),
    } satisfies DiagnosticPcm,
  };
}
function sameBits(a: unknown, b: unknown, where = "root"): void {
  if (typeof a === "number" && typeof b === "number") {
    assert.ok(Object.is(a, b), where);
    if (Number.isFinite(a)) {
      const x = new DataView(new ArrayBuffer(8)),
        y = new DataView(new ArrayBuffer(8));
      x.setFloat64(0, a);
      y.setFloat64(0, b);
      assert.equal(x.getBigUint64(0), y.getBigUint64(0), where);
    }
    return;
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    assert.equal(a, b, where);
    return;
  }
  assert.deepEqual(Object.keys(a), Object.keys(b), where);
  for (const key of Object.keys(a))
    sameBits(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      where + "." + key,
    );
}

test("V3 budget includes both snapshots, two arrays and all reserves at exact256MiB boundary", () => {
  const b = estimatePairedV3Working(base);
  assert.equal(b.estimatedBytes, 260307504);
  assert.equal(b.maxWorkingBytes, 256 * M);
  assert.equal(
    estimatePairedV3Working({ ...base, additionalHeldBytes: 8127952 }).estimatedBytes,
    256 * M,
  );
  assert.throws(
    () => estimatePairedV3Working({ ...base, additionalHeldBytes: 8127953 }),
    /MEMORY_ADMISSION/,
  );
  assert.throws(
    () => estimatePairedV3Working({ ...base, retainedSourceBytes: 56015430 }),
    /RETAINED_HEAVY/,
  );
  assert.throws(
    () => estimatePairedV3Working({ ...base, retainedNativePcmBytes: 24192000 }),
    /RETAINED_HEAVY/,
  );
  assert.throws(
    () => estimatePairedV3Working({ ...base, leanPayloadBytes: 6 * M + 1 }),
    /LEAN_PAYLOAD/,
  );
});
test("V3 lean projection accepts shared metadata but rejects strong heavy roots, accessors, cycles and oversized payload", () => {
  const shared = { id: "master-62a", sha256: "a".repeat(64), bytes: 23808056 };
  const lean = assertLeanPairedProjection({
    files: [shared],
    again: shared,
    controls: [0, 128, 800],
    recording: { frameCount: 3601, traceBytes: 56015430 },
  });
  assert.ok(lean.logicalPayloadBytes > lean.jsonUtf8Bytes);
  assert.ok(lean.logicalPayloadBytes < 6 * M);
  for (const bad of [
    { input: {} },
    { assetBank: [] },
    { recording: { frames: [{ tick: 1 }] } },
    { pcm: new Float32Array(2) },
    { blob: new Blob(["x"]) },
    { reader: () => 0 },
  ])
    assert.throws(() => assertLeanPairedProjection(bad), /LEAN_/);
  class NativeArray extends Array<number> {}
  Object.defineProperty(NativeArray.prototype, "hidden", { value: new ArrayBuffer(4) });
  assert.throws(() => assertLeanPairedProjection(new NativeArray(1, 2)), /LEAN_PROTOTYPE/);
  const oldStringify = JSON.stringify;
  let serializations = 0;
  JSON.stringify = ((...args: unknown[]) => {
    serializations++;
    return Reflect.apply(oldStringify, JSON, args);
  }) as typeof JSON.stringify;
  try {
    assert.throws(
      () => assertLeanPairedProjection({ aliases: Array(256).fill({ text: "x".repeat(16384) }) }),
      /LEAN_PAYLOAD/,
    );
  } finally {
    JSON.stringify = oldStringify;
  }
  assert.equal(serializations, 0, "rejectexpandedaliasbeforestringify");
  const unicode = { text: 'quote" slash\\ control\n emoji😀 lone\ud800' };
  assert.equal(
    assertLeanPairedProjection(unicode).jsonUtf8Bytes,
    new TextEncoder().encode(JSON.stringify(unicode)).byteLength,
  );
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  assert.throws(() => assertLeanPairedProjection(cycle), /LEAN_CYCLE/);
  let getter = 0;
  const value = {};
  Object.defineProperty(value, "data", {
    enumerable: true,
    get() {
      getter++;
      return new ArrayBuffer(4);
    },
  });
  assert.throws(() => assertLeanPairedProjection(value), /LEAN_ACCESSOR/);
  assert.equal(getter, 0);
  assert.throws(() => assertLeanPairedProjection({ text: "x".repeat(6 * M) }), /LEAN_PAYLOAD/);
});
test("V3 snapshot adapter preserves old DataView Stats everyFloat64bit on fixed seam/second/tie/signedzero PCM", async () => {
  const frames = 65540,
    a = fixedWave(frames, (v) => {
      for (let f = 0; f < frames; f++) {
        v.setFloat32(56 + f * 8, Math.sin(f / 37) * 0.5, true);
        v.setFloat32(60 + f * 8, f === 0 ? -0 : Math.cos(f / 53) * 0.25, true);
      }
    }),
    b = fixedWave(frames, (v) => {
      v.setFloat32(56 + 32768 * 8, 3e-6, true);
      v.setFloat32(60 + 48000 * 8, -3e-6, true);
    });
  const times: { stage: string; id: string; elapsedMs: number }[] = [];
  const av = await readVerifiedSnapshotPcm(a.output, a.file, (r) => times.push(r)),
    bv = await readVerifiedSnapshotPcm(b.output, b.file);
  const options = { frames, sampleRateHz: 48000 as const, tolerance: 2e-6 as const };
  sameBits(
    summarizePcmDifference(a.legacy, b.legacy, options),
    summarizePcmDifference(av.vector, bv.vector, options),
  );
  assert.ok(Object.is(av.vector.sample(1, 0), -0));
  assert.deepEqual(
    times.map((t) => t.stage),
    ["array-buffer", "selected-sha", "riff"],
  );
  assert.ok(times.every((t) => t.elapsedMs >= 0));
});
test("V3 snapshot selectedSHA and RIFF remain strict and nonfinite classification stays bit-equivalent", async () => {
  const a = fixedWave(3, (v) => {
    v.setFloat32(56, NaN, true);
    v.setFloat32(60, Infinity, true);
    v.setFloat32(64, -Infinity, true);
  });
  const b = fixedWave(3);
  const av = await readVerifiedSnapshotPcm(a.output, a.file),
    bv = await readVerifiedSnapshotPcm(b.output, b.file),
    o = { frames: 3, sampleRateHz: 48000 as const, tolerance: 2e-6 as const };
  sameBits(
    summarizePcmDifference(a.legacy, b.legacy, o),
    summarizePcmDifference(av.vector, bv.vector, o),
  );
  await assert.rejects(
    readVerifiedSnapshotPcm({ ...a.output, sha256: "0".repeat(64) }, a.file),
    /INTEGRITY/,
  );
  const bad = fixedWave(3, (v) => v.setUint16(22, 1, true));
  await assert.rejects(readVerifiedSnapshotPcm(bad.output, bad.file), /INTEGRITY/);
});
test("V3 fixed same PCM Stats preserve full60s tail boundary and sample counts without ignored prefix", async () => {
  const frames = 2880002,
    a = fixedWave(frames, (v) => {
      v.setFloat32(56 + 2880000 * 8, 3e-6, true);
      v.setFloat32(60 + 2880001 * 8, -3e-6, true);
    }),
    b = fixedWave(frames),
    av = await readVerifiedSnapshotPcm(a.output, a.file),
    bv = await readVerifiedSnapshotPcm(b.output, b.file),
    o = { frames, sampleRateHz: 48000 as const, tolerance: 2e-6 as const };
  const old = summarizePcmDifference(a.legacy, b.legacy, o),
    next = summarizePcmDifference(av.vector, bv.vector, o);
  sameBits(old, next);
  assert.equal(next.comparedSamples, frames * 2);
  assert.equal(next.overCount, 2);
  assert.equal(next.tailError, next.maxError);
});
