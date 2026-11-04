import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { AssetHost, type AssetStagingContext } from "../../src/app/asset-host.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { createDefaultBehaviors, createDefaultScene } from "../../src/app/defaults.js";
import { createProject } from "../../src/persistence/index.js";
import { sha256Canonical } from "../../src/experiments/hash.js";
import { FakeAudioBuffer, FakeAudioContext } from "../audio-runtime/fake-context.js";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AudioBudget } from "../../src/audio/types.js";
import type { ProjectAsset } from "../../src/persistence/types.js";

function wave(sample: number, frames = 8, rate = 48000, channels = 1): ArrayBuffer {
  const bytes = new ArrayBuffer(44 + frames * channels * 2),
    view = new DataView(bytes);
  const tag = (offset: number, value: string) =>
    [...value].forEach((v, i) => view.setUint8(offset + i, v.charCodeAt(0)));
  tag(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  tag(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  for (let i = 0; i < frames * channels; i++)
    view.setInt16(44 + i * 2, sample + (i % channels), true);
  return bytes;
}
const hash = (bytes: ArrayBuffer) =>
  createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
function setup(
  getEngine: () => AudioEngine | null = () => null,
  options: { initialProjectAssets?: readonly ProjectAsset[]; budget?: Partial<AudioBudget> } = {},
) {
  const state: { decodes: number; fail: boolean; wait: Promise<void> | null } = {
    decodes: 0,
    fail: false,
    wait: null,
  };
  const factory = (rate: number): AssetStagingContext => ({
    sampleRate: rate,
    createBuffer: (channels, length, sampleRate) =>
      new FakeAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer,
    decodeAudioData: async (bytes) => {
      state.decodes++;
      if (state.wait) await state.wait;
      if (state.fail) throw new Error("decode fixture failure");
      const view = new DataView(bytes),
        channels = view.getUint16(22, true),
        output = new FakeAudioBuffer(channels, view.getUint32(40, true) / (channels * 2), rate);
      for (let channel = 0; channel < channels; channel++)
        output.getChannelData(channel).fill(view.getInt16(44 + channel * 2, true) / 32768);
      return output as unknown as AudioBuffer;
    },
  });
  const store = new BlobStore({ indexedDB: null });
  const host = new AssetHost({ store, getEngine, createStagingContext: factory, ...options });
  return { host, state, store };
}
const importWave = (host: AssetHost, sample: number) =>
  host.importFile(new File([wave(sample)], `${sample}.wav`, { type: "audio/wav" }), true);

test("host LRU eviction releases every unleased PCM reference and cold borrowing restores exact pins", async () => {
  const { host, state } = setup();
  const first = await importWave(host, 500),
    second = await importWave(host, 1000);
  const originalRefs = host.getProjectAssets();
  const one = await host.acquireAssetBank("recording", [first.assetId]);
  const two = await host.acquireAssetBank("offline", [first.assetId]);
  assert.equal(one.entries[0]!.buffer, two.entries[0]!.buffer);
  const before = one.entries[0]!.buffer;
  const eviction = host.evictUnused(0);
  assert.deepEqual(eviction.evictedAssetIds, [second.assetId]);
  assert.equal(host.getResidency().residentBytes, 32);
  assert.equal(host.getAssetBank().length, 1);
  one.release();
  one.release();
  assert.equal(one.entries.length, 0);
  assert.deepEqual(host.evictUnused(0).evictedAssetIds, []);
  two.release();
  assert.equal(host.evictUnused(0).releasedBytes, 32);
  assert.equal(host.getResidency().retainedBytes, 0);
  assert.equal(host.getAssetBank().length, 0);
  const cold = await host.acquireAssetBank("offline", [first.assetId]);
  assert.equal(state.decodes, 3);
  assert.notEqual(cold.entries[0]!.buffer, before);
  assert.equal(cold.entries[0]!.buffer.getChannelData(0)[0], 500 / 32768);
  assert.equal(cold.entries[0]!.metadata.sha256, hash(wave(500)));
  assert.equal(cold.entries[0]!.metadata.revision, first.revision);
  assert.equal(cold.entries[0]!.buffer.sampleRate, 48000);
  assert.equal(cold.entries[0]!.buffer.numberOfChannels, 1);
  assert.deepEqual(host.getProjectAssets(), originalRefs);
  cold.release();
});

test("host borrower validation and failed cold decode preserve the valid bank atomically", async () => {
  const { host, state } = setup();
  const first = await importWave(host, 500),
    second = await importWave(host, 1000);
  host.evictUnused(0, [second.assetId]);
  const snapshot = host.getAssetBank();
  await assert.rejects(host.acquireAssetBank("offline", [first.assetId, "asset.unknown"]), {
    code: "ASSET_UNKNOWN",
  });
  assert.equal(host.getResidency().leaseCount, 0);
  state.fail = true;
  await assert.rejects(
    host.acquireAssetBank("offline", [first.assetId, second.assetId]),
    /decode fixture failure/,
  );
  assert.equal(host.getAssetBank()[0]!.buffer, snapshot[0]!.buffer);
  assert.equal(host.getResidency().decodeReservedBytes, 0);
  assert.equal(host.getResidency().leaseCount, 0);
});

test("cancelled native decode retains reservation until settlement and cannot publish stale PCM", async () => {
  const { host, state } = setup();
  const asset = await importWave(host, 1000);
  host.evictUnused(0);
  let finish!: () => void;
  state.wait = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const pending = host.acquireAssetBank("offline", [asset.assetId]);
  while (state.decodes < 2) await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(host.getResidency().decodeReservedBytes, 36);
  host.cancelPending();
  assert.equal(host.getResidency().decodeReservedBytes, 36);
  assert.equal(host.getResidency().residentBytes, 0);
  finish();
  await assert.rejects(pending, { code: "ASSET_CANCELLED" });
  assert.equal(host.getResidency().decodeReservedBytes, 0);
  assert.equal(host.getResidency().retainedBytes, 0);
  assert.equal(host.getProjectAssets()[0]!.assetId, asset.assetId);
});

test("dispose releases host ownership while overlapping old leases survive and release independently", async () => {
  const { host } = setup();
  const asset = await importWave(host, 1000);
  const old = await host.acquireAssetBank("recording", [asset.assetId]);
  const concurrent = await host.acquireAssetBank("offline", [asset.assetId]);
  host.dispose();
  assert.equal(host.getAssetBank().length, 0);
  assert.equal(host.getResidency().residentBytes, 0);
  assert.equal(host.getResidency().retainedBytes, 32);
  assert.equal(old.entries[0]!.buffer.getChannelData(0)[0], 1000 / 32768);
  old.release();
  assert.equal(host.getResidency().retainedBytes, 32);
  concurrent.release();
  assert.equal(host.getResidency().retainedBytes, 0);
  await assert.rejects(host.acquireAssetBank("offline"), { code: "ASSET_HOST_DISPOSED" });
});

test("dispose during cold decode keeps staging ownership visible until the native job settles", async () => {
  const { host, state } = setup();
  const resident = await importWave(host, 500),
    cold = await importWave(host, 1000);
  host.evictUnused(0, [cold.assetId]);
  let finish!: () => void;
  state.wait = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const pending = host.acquireAssetBank("offline", [cold.assetId]);
  while (state.decodes < 3) await new Promise<void>((resolve) => setImmediate(resolve));
  host.dispose();
  assert.equal(host.getAssetBank().length, 0);
  assert.equal(host.getResidency().residentBytes, 0);
  assert.equal(
    host.getResidency().retainedBytes,
    32,
    "pending stage still owns the resident snapshot",
  );
  assert.equal(host.getResidency().decodeReservedBytes, 36);
  finish();
  await assert.rejects(pending, { code: "ASSET_CANCELLED" });
  assert.equal(host.getResidency().retainedBytes, 0);
  assert.equal(host.getResidency().decodeReservedBytes, 0);
  assert.ok(resident.assetId);
});

test("warm and cold borrowers reject the same unconfirmed optional sample rights", async () => {
  const { host, store } = setup();
  const bytes = wave(1000),
    sha256 = hash(bytes),
    assetId = "asset.optional";
  await store.saveAsset({
    assetId,
    sha256,
    bytes,
    metadata: {
      name: "optional.wav",
      origin: "imported",
      license: "UNCONFIRMED_FIXTURE",
      revision: 1,
    },
  });
  const generator = {
    algorithm: "tone-v1" as const,
    durationSeconds: 1,
    sampleRateHz: 48000 as const,
    frequencyHz: 220,
  };
  const scene = createDefaultScene();
  const project = createProject({
    projectId: "project.optional-assets",
    name: "Optional sample rights",
    scene,
    soundBehaviors: createDefaultBehaviors(scene),
    assets: [
      {
        assetId: "signal.tone-220",
        revision: 1,
        sha256: await sha256Canonical(generator),
        hashKind: "canonicalDescriptorSha256",
        name: "Signal settings",
        mimeType: "application/x-reflection-lab-generator",
        byteLength: JSON.stringify(generator).length,
        storage: "generatedDescriptor",
        rights: { license: "PROJECT_GENERATED", source: "Fixture generator descriptor" },
        generator,
      },
      {
        assetId,
        revision: 1,
        sha256,
        hashKind: "encodedBytesSha256",
        name: "optional.wav",
        mimeType: "audio/wav",
        byteLength: bytes.byteLength,
        storage: "externalFile",
        rights: { license: "UNCONFIRMED_FIXTURE", source: "Optional fixture" },
      },
    ],
  });
  await host.commitPrepared(await host.prepareProject(project));
  assert.equal(
    host.getAssets().find((asset) => asset.assetId === assetId)!.rightsStatus,
    "UNVERIFIED",
  );
  await assert.rejects(host.acquireAssetBank("offline", [assetId]), {
    code: "ASSET_RIGHTS_UNVERIFIED",
  });
  assert.equal(host.getResidency().leaseCount, 0);
  host.evictUnused();
  await assert.rejects(host.acquireAssetBank("offline", [assetId]), {
    code: "ASSET_RIGHTS_UNVERIFIED",
  });
  assert.equal(host.getResidency().leaseCount, 0);
});

test("host observes builtin hash staging peaks without requiring an external sampler", async () => {
  const { host } = setup();
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  await host.ensureBuiltinDescriptors(engine);
  const residency = host.getResidency();
  assert.equal(residency.residentBytes, 336000);
  assert.ok(
    residency.highWaterBytes >= 432000,
    "whoosh PCM and hash input coexist after tone and impact generation",
  );
  assert.equal(residency.knownStagingBytes, 0);
  assert.equal(residency.decodeReservedBytes, 0);
});

test("WAV staging and cold reload preserve original sample rate and channels across device context changes", async () => {
  for (const [rate, channels] of [
    [44100, 1],
    [48000, 2],
  ] as const) {
    let engine: AudioEngine | null = null;
    const { host } = setup(() => engine);
    const bytes = wave(1000, 8, rate, channels);
    const original = await host.importFile(
      new File([bytes], "original-rate.wav", { type: "audio/wav" }),
      true,
    );
    assert.equal(original.sampleRate, rate);
    assert.equal(original.channels, channels);
    const warm = await host.acquireAssetBank("recording", [original.assetId]);
    const samples = Array.from({ length: channels }, (_, channel) => [
      ...warm.entries[0]!.buffer.getChannelData(channel),
    ]);
    warm.release();
    host.evictUnused();
    const context = new FakeAudioContext();
    Object.defineProperty(context, "sampleRate", { value: rate === 48000 ? 44100 : 48000 });
    engine = new AudioEngine({ context: context.asContext() });
    const cold = await host.acquireAssetBank("offline", [original.assetId]);
    assert.equal(cold.entries[0]!.metadata.sha256, hash(bytes));
    assert.equal(cold.entries[0]!.buffer.sampleRate, rate);
    assert.equal(cold.entries[0]!.buffer.numberOfChannels, channels);
    for (let channel = 0; channel < channels; channel++)
      assert.deepEqual([...cold.entries[0]!.buffer.getChannelData(channel)], samples[channel]);
    cold.release();
    engine.dispose();
    host.dispose();
  }
});

function externalReference(bytes: ArrayBuffer, assetId: string, revision = 1): ProjectAsset {
  return {
    assetId,
    revision,
    sha256: hash(bytes),
    hashKind: "encodedBytesSha256",
    name: `${assetId}.wav`,
    mimeType: "audio/wav",
    byteLength: bytes.byteLength,
    storage: "externalFile",
    rights: { license: "USER_CONFIRMED_LOCAL_USE", source: "Original local fixture" },
  };
}
async function projectWithSamples(refs: ProjectAsset[]) {
  const generator = {
    algorithm: "tone-v1" as const,
    durationSeconds: 1,
    sampleRateHz: 48000 as const,
    frequencyHz: 220,
  };
  const scene = createDefaultScene(),
    soundBehaviors = createDefaultBehaviors(scene);
  soundBehaviors.assets = refs.map(({ assetId, revision, sha256 }) => ({
    assetId,
    revision,
    sha256,
  }));
  return createProject({
    projectId: "project.alias-assets",
    name: "Shared sample pins",
    scene,
    soundBehaviors,
    assets: [
      {
        assetId: "signal.tone-220",
        revision: 1,
        sha256: await sha256Canonical(generator),
        hashKind: "canonicalDescriptorSha256",
        name: "Signal settings",
        mimeType: "application/x-reflection-lab-generator",
        byteLength: JSON.stringify(generator).length,
        storage: "generatedDescriptor",
        rights: { license: "PROJECT_GENERATED", source: "Fixture generator descriptor" },
        generator,
      },
      ...refs,
    ],
  });
}

test("initial project references hydrate legacy confirmed local WAV without a separate rights receipt", async () => {
  const bytes = wave(1000),
    ref = externalReference(bytes, "asset.legacy", 3);
  const { host, store } = setup(() => null, { initialProjectAssets: [ref] });
  await store.saveAsset({
    assetId: ref.assetId,
    sha256: ref.sha256,
    bytes,
    metadata: {
      name: ref.name,
      origin: "imported",
      license: "USER_CONFIRMED_LOCAL_USE",
      revision: ref.revision,
    },
  });
  const lease = await host.acquireAssetBank("offline", [ref.assetId]);
  assert.equal(lease.entries[0]!.buffer.getChannelData(0)[0], 1000 / 32768);
  assert.equal(lease.entries[0]!.metadata.revision, 3);
  assert.equal(lease.entries[0]!.metadata.sha256, ref.sha256);
  assert.equal(host.getAssets()[0]!.rightsStatus, "APPROVED");
  assert.deepEqual(host.getProjectAssets(), [ref]);
  lease.release();
  host.evictUnused();
  const restored = await host.acquireAssetBank("offline", [ref.assetId]);
  assert.equal(restored.entries[0]!.metadata.sha256, ref.sha256);
  restored.release();
});

test("cold same-SHA aliases reuse one decoded buffer at the original conservative bank cap", async () => {
  const bytes = wave(1000),
    refs = [
      externalReference(bytes, "asset.alias-a", 3),
      externalReference(bytes, "asset.alias-b", 7),
    ];
  const project = await projectWithSamples(refs);
  const { host, state } = setup(() => null, { budget: { maxDecodedBytes: 64 } });
  await host.importFile(new File([bytes], "original.wav", { type: "audio/wav" }), true, project);
  await host.commitPrepared(await host.prepareProject(project));
  assert.equal(host.getAssetBank()[0]!.buffer, host.getAssetBank()[1]!.buffer);
  assert.equal(host.evictUnused().releasedBytes, 32);
  const before = state.decodes;
  const lease = await host.acquireAssetBank(
    "offline",
    refs.map((ref) => ref.assetId),
  );
  assert.equal(state.decodes, before + 1);
  assert.equal(lease.entries.length, 2);
  assert.equal(lease.entries[0]!.buffer, lease.entries[1]!.buffer);
  assert.deepEqual(
    lease.entries.map((entry) => entry.metadata.revision),
    [3, 7],
  );
  assert.ok(lease.entries.every((entry) => entry.metadata.sha256 === hash(bytes)));
  assert.equal(host.getResidency().residentBytes, 32);
  assert.equal(host.getResidency().retainedBytes, 32);
  lease.release();
  assert.equal(host.evictUnused().releasedBytes, 32);
  assert.equal(host.getResidency().retainedBytes, 0);
});
