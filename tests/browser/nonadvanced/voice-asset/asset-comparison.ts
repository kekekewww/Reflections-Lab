import { AssetHost, type AssetStagingContext } from "../../../../src/app/asset-host.js";
import { AudioEngine } from "../../../../src/audio/engine.js";
import { AudioAssetStore } from "../../../../src/audio/assets.js";
import { BlobStore } from "../../../../src/persistence/blob-store.js";
import type { ProjectAsset } from "../../../../src/persistence/types.js";
import type { AssetResidencySnapshot } from "../../../../src/audio/asset-leases.js";
import { BUDGET, GENERATOR_SOURCE, PROVENANCE, type WaveFixture } from "./contracts.js";
import type { AcousticFrame, VoiceInput } from "../../../../src/audio/types.js";

function check(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
function equal(a: unknown, b: unknown, message: string) {
  check(JSON.stringify(a) === JSON.stringify(b), message);
}
export interface AssetAdapter {
  createContext(rate: number): AssetStagingContext;
  createEngine(): AudioEngine;
  setTime(time: number): void | Promise<void>;
  method: string;
}
const code = (error: unknown) =>
  error instanceof Error && "code" in error ? String(error.code) : String(error);
async function rejects(action: () => Promise<unknown>, expected: string) {
  try {
    await action();
  } catch (error) {
    check(code(error).includes(expected), `expected ${expected}, got ${code(error)}`);
    return code(error);
  }
  throw Error(`Expected failure: ${expected}`);
}
function verifyPcm(buffer: AudioBuffer, fixture: WaveFixture) {
  check(
    buffer.sampleRate === fixture.rate &&
      buffer.numberOfChannels === fixture.channels &&
      buffer.length === fixture.frames,
    "PCM format changed",
  );
  for (let ch = 0; ch < fixture.channels; ch++) {
    const values = buffer.getChannelData(ch),
      expected = (fixture.sample + ch) / 32768;
    for (let n = 0; n < values.length; n++)
      check(Math.abs(values[n]! - expected) <= 2e-6, `PCM mismatch ${fixture.name}:${ch}:${n}`);
  }
}
export async function runAssets(
  fixtures: readonly WaveFixture[],
  candidate: boolean,
  adapter: AssetAdapter,
  seedFrame: AcousticFrame,
) {
  check(fixtures.length === 4, "requires complete 44.1/48k mono/stereo matrix");
  const engine = adapter.createEngine();
  await engine.enable(0);
  // Actual BlobStore, explicitly using its memory backend in both Node and browser.
  const store = new BlobStore({ indexedDB: null });
  const refs: ProjectAsset[] = fixtures.map((f) => ({
    assetId: f.assetId,
    revision: 1,
    sha256: f.sha256,
    hashKind: "encodedBytesSha256",
    name: f.name,
    mimeType: "audio/wav",
    byteLength: f.bytes.byteLength,
    storage: "externalFile",
    rights: {
      license: PROVENANCE,
      source: `${GENERATOR_SOURCE}::wave; project-authored local test bytes`,
    },
  }));
  for (const f of fixtures)
    await store.saveAsset({
      assetId: f.assetId,
      sha256: f.sha256,
      bytes: f.bytes.slice(0),
      metadata: {
        name: f.name,
        revision: 1,
        origin: "imported",
        license: "USER_CONFIRMED_LOCAL_USE",
      },
    });
  const snapshots: {
    label: string;
    host: AssetResidencySnapshot;
    engine: AssetResidencySnapshot;
    activeDecodes: number;
  }[] = [];
  const latencies: { label: string; cache: string; ms: number; decodeCalls: number }[] = [];
  let active = 0,
    peakDecode = 0,
    calls = 0,
    failNext = false;
  let gate: Promise<void> | null = null,
    entered: (() => void) | null = null;
  let host!: AssetHost;
  const observe = (label: string) => {
    if (host)
      snapshots.push({
        label,
        host: host.getResidency(),
        engine: engine.getAssetResidency(),
        activeDecodes: active,
      });
  };
  const factory = (rate: number): AssetStagingContext => {
    const base = adapter.createContext(rate);
    return {
      sampleRate: rate,
      createBuffer: base.createBuffer.bind(base),
      decodeAudioData: async (bytes) => {
        active++;
        calls++;
        peakDecode = Math.max(peakDecode, active);
        observe("decode-enter");
        entered?.();
        try {
          if (gate) await gate;
          if (failNext) {
            failNext = false;
            throw Error("INJECTED_DECODE_FAILURE");
          }
          return await base.decodeAudioData(bytes);
        } finally {
          active--;
          observe("decode-settle");
        }
      },
    };
  };
  host = new AssetHost({
    store,
    getEngine: () => engine,
    initialProjectAssets: refs,
    budget: BUDGET,
    createStagingContext: factory,
  });
  const all = fixtures.map((f) => f.assetId);
  const borrow = async (label: string, cache: string, ids = all) => {
    const before = calls,
      start = performance.now();
    const lease = await host.acquireAssetBank(label, ids);
    latencies.push({ label, cache, ms: performance.now() - start, decodeCalls: calls - before });
    for (const entry of lease.entries) {
      const f = fixtures.find((f) => f.assetId === entry.assetId)!;
      equal(entry.metadata.sha256, f.sha256, "encoded hash changed");
      check(entry.metadata.revision === 1, "revision changed");
      verifyPcm(entry.buffer, f);
    }
    observe(label);
    return lease;
  };
  const assertDurable = async () => {
    equal(host.getProjectAssets(), refs, "source of truth / rights / revision changed");
    for (const f of fixtures) {
      const stored = await store.loadAsset(f.assetId, f.sha256);
      check(stored && stored.metadata.revision === 1, "valid asset lost");
      equal(
        Array.from(new Uint8Array(stored.bytes)),
        Array.from(new Uint8Array(f.bytes)),
        "durable bytes changed",
      );
    }
  };
  const pressure = (label: string) => {
    const result = candidate ? host.evictUnused(0) : null;
    observe(label);
    return result;
  };
  let recording: Awaited<ReturnType<typeof borrow>> | null = null;
  const evictions = [],
    failures: Record<string, string> = {};
  try {
    (await borrow("initial-load", "cold")).release();
    (await borrow("warm-load", "warm")).release();
    recording = await borrow("recording", "warm", [all[3]!]);
    const voice = (i: number, future = false): VoiceInput => ({
      instanceId: `asset-role.${i}`,
      sourceId: `asset-role.${i}`,
      generator: {
        kind: "sample",
        asset: { assetId: all[i]!, revision: 1, sha256: fixtures[i]!.sha256 },
        loop: true,
        startOffsetSeconds: 0,
      },
      gainLinear: 0.1,
      pitchSemitones: 0,
      emissionTimeSeconds: future ? 0.4 : 0,
      continuous: true,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    });
    for (let i = 0; i < 3; i++) {
      const input = voice(i, i === 2);
      const frame = {
        ...structuredClone(seedFrame),
        sourceId: input.sourceId,
        paths: seedFrame.paths.map((p) => ({
          ...p,
          sourceId: input.sourceId,
          id: `${input.sourceId}.${p.id}`,
          absoluteDelayS: 0.2,
        })),
      };
      check(engine.playVoice(input, frame).accepted, "sample role admission failed");
    }
    engine.stopVoice("asset-role.1", 0);
    const protectedResult = pressure("active-retiring-pending-recording-pressure");
    if (candidate) check(protectedResult!.evictedAssetIds.length === 0, "evicted a protected role");
    check(engine.getTelemetry().retiringVoices > 0, "retiring role not exercised");
    // A future source intentionally has no current cursor before onset. Admission
    // plus the protected asset and active graph prove its pending ownership.
    check(engine.getTelemetry().activeVoices === 2, "active and future/pending graphs missing");
    observe("roles-verified");
    await adapter.setTime(0.05);
    await engine.pause(0.05);
    evictions.push(pressure("paused-pending-pressure"));
    if (candidate) check(host.getResidency().residentAssets === 4, "paused reference evicted");
    await engine.resume(0.05);
    await engine.drainVoices();
    recording.release();
    recording = null;
    evictions.push(pressure("released-pressure"));
    const pressureResident = host.getResidency().residentBytes;
    // Same requested sequence; residency is the only policy intervention.
    (await borrow("reload-after-pressure", candidate ? "cold" : "warm")).release();
    await assertDurable();

    // Force a new host from the SAME durable store in both arms, so cancellation and
    // decode failures cannot accidentally be skipped by a warm-cache hit.
    host.dispose();
    host = new AssetHost({
      store,
      getEngine: () => null,
      initialProjectAssets: refs,
      budget: BUDGET,
      createStagingContext: factory,
    });
    (await borrow("valid-before-failures", "cold", [all[0]!])).release();
    const validBytes = host.getResidency().residentBytes;
    failNext = true;
    failures.decode = await rejects(
      () => host.acquireAssetBank("failed-decode", [all[1]!]),
      "INJECTED_DECODE_FAILURE",
    );
    check(host.getResidency().residentBytes === validBytes, "failed decode lost valid PCM");
    let release!: () => void;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const cancelled = host.acquireAssetBank("cancelled", [all[2]!]);
    // Attach rejection handler immediately; deadlines are supplied by the outer CLI.
    const result = rejects(() => cancelled, "ASSET_CANCELLED");
    await started;
    host.cancelPending();
    observe("cancel-before-settle");
    check(
      host.getResidency().decodeReservedBytes > 0 && active === 1,
      "cancel released an in-flight native reservation",
    );
    release();
    gate = null;
    entered = null;
    failures.cancel = await result;
    check(host.getResidency().decodeReservedBytes === 0, "cancel reservation leaked");
    check(host.getResidency().residentBytes === validBytes, "cancel lost valid PCM");
    // Real BlobStore quota failure; both arms use the exact same lowered test store
    // limit, leaving all production limits unchanged.
    const quota = new BlobStore({
      indexedDB: null,
      limits: {
        maxAssetBytes: fixtures[0]!.bytes.byteLength,
        maxTotalBytes: fixtures[0]!.bytes.byteLength,
      },
    });
    const saved = {
      assetId: all[0]!,
      sha256: fixtures[0]!.sha256,
      bytes: fixtures[0]!.bytes,
      metadata: {
        name: fixtures[0]!.name,
        revision: 1,
        origin: "imported" as const,
        license: PROVENANCE,
      },
    };
    await quota.saveAsset(saved);
    failures.quota = await rejects(
      () => quota.saveAsset({ ...saved, assetId: "quota.other" }),
      "BLOB_BUDGET",
    );
    check(
      await quota.loadAsset(saved.assetId, saved.sha256),
      "quota failure lost original durable asset",
    );
    (await borrow("recovery-cold", "cold")).release();
    (await borrow("recovery-warm", "warm")).release();
    await assertDurable();
    observe("finished");
    check(peakDecode <= BUDGET.maxConcurrentDecodes, "decode cap exceeded");
    for (const s of snapshots)
      check(
        s.host.retainedBytes + s.host.decodeReservedBytes <= BUDGET.maxDecodedBytes,
        "decoded cap exceeded",
      );
    const peak = (key: keyof AssetResidencySnapshot) =>
      Math.max(...snapshots.map((s) => Number(s.host[key])));
    return {
      method: adapter.method,
      refs,
      snapshots,
      evictions,
      failures,
      latencies,
      costs: {
        residentPeakBytes: peak("residentBytes"),
        stagingPeakBytes: peak("knownStagingBytes"),
        reservedPeakBytes: peak("decodeReservedBytes"),
        retainedPeakBytes: peak("retainedBytes"),
        ownedHighWaterBytes: peak("highWaterBytes"),
        pressureResidentBytes: pressureResident,
        decodeCalls: calls,
        decodeConcurrencyPeak: peakDecode,
        nativeDecoderScratchBytes: null,
        processRamBytes: null,
        gcFreedBytes: null,
      },
      oracle: {
        pinsAndSourceOfTruth: true,
        protectedRoles: true,
        cancelPreservesValid: true,
        quotaPreservesValid: true,
        decodeFailurePreservesValid: true,
        coldWarmPcm: true,
      },
    };
  } finally {
    recording?.release();
    host.dispose();
    store.close();
    await engine.disposeAsync();
  }
}

/** Exercise the store's ORIGINAL parallel-decode limit rather than claiming the
 * serial AssetHost has demonstrated a two-way concurrency cap.
 */
export async function decodeCapProbe(fixture: WaveFixture, context: AssetStagingContext) {
  let release!: () => void,
    active = 0,
    peak = 0;
  let enteredResolve!: () => void;
  const entered = new Promise<void>((resolve) => {
    enteredResolve = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const instrumented = {
    ...context,
    sampleRate: context.sampleRate,
    decodeAudioData: async (bytes: ArrayBuffer) => {
      active++;
      peak = Math.max(peak, active);
      if (active === BUDGET.maxConcurrentDecodes) enteredResolve();
      try {
        await gate;
        return await context.decodeAudioData(bytes);
      } finally {
        active--;
      }
    },
  };
  const observations: AssetResidencySnapshot[] = [];
  const store = new AudioAssetStore(instrumented as BaseAudioContext, BUDGET, undefined, () =>
    observations.push(store.getResidency()),
  );
  const metadata = {
    name: fixture.name,
    origin: "generated" as const,
    license: PROVENANCE,
    revision: 1,
    sha256: fixture.sha256,
  };
  const jobs = [0, 1].map((i) => store.import(`decode.${i}`, fixture.bytes.slice(0), metadata));
  const overflow = rejects(
    () => store.import("decode.overflow", fixture.bytes.slice(0), metadata),
    "DECODE_CONCURRENCY",
  );
  try {
    const reason = await overflow;
    // Reservations precede asynchronous SHA hashing; wait for actual native entry.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        entered,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(Error("DECODE_ENTRY_DEADLINE")), 2000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    check(active === 2, "original two concurrent decodes not exercised");
    release();
    await Promise.all(jobs);
    check(peak === BUDGET.maxConcurrentDecodes, "decode concurrency mismatch");
    check(store.getResidency().decodeReservedBytes === 0, "decode reservation leak");
    return { peak, reason, observations, final: store.getResidency() };
  } finally {
    release();
    await Promise.allSettled(jobs);
    store.clear();
  }
}

export async function compareAssets(
  fixtures: readonly WaveFixture[],
  adapter: () => AssetAdapter,
  seedFrame: AcousticFrame,
) {
  const reference = await runAssets(fixtures, false, adapter(), seedFrame),
    candidate = await runAssets(fixtures, true, adapter(), seedFrame);
  equal(reference.refs, candidate.refs, "arms must share immutable refs");
  equal(reference.oracle, candidate.oracle, "arms must meet identical safety oracles");
  equal(reference.failures, candidate.failures, "arms must exercise identical failures");
  const decodeCap = await decodeCapProbe(fixtures[2]!, adapter().createContext(48000));
  return {
    reference,
    candidate,
    decodeCap,
    recommendation:
      "KEEP_CURRENT_RESIDENCY_POLICY: eviction reduces only tracked idle reachability; cold reload costs extra decode work. No RAM/GC or native scratch improvement is established.",
  };
}
