import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { AssetHost, type AssetStagingContext } from "../../src/app/asset-host.js";
import { createDefaultBehaviors, createDefaultScene } from "../../src/app/defaults.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { BlobStore, regenerateBuiltinAsset } from "../../src/persistence/blob-store.js";
import { createProject } from "../../src/persistence/index.js";
import { sha256Canonical } from "../../src/experiments/hash.js";
import type { ProjectAsset } from "../../src/persistence/types.js";
import { FakeAudioBuffer, FakeAudioContext } from "../audio-runtime/fake-context.js";

function wave(frames = 8, sample = 1000): ArrayBuffer {
  const bytes = new ArrayBuffer(44 + frames * 2),
    view = new DataView(bytes);
  const tag = (offset: number, value: string) =>
    [...value].forEach((v, i) => view.setUint8(offset + i, v.charCodeAt(0)));
  tag(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  tag(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 48000, true);
  view.setUint32(28, 96000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, sample, true);
  return bytes;
}
const hash = (bytes: ArrayBuffer) =>
  createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const file = (bytes = wave(), name = "original.wav") =>
  new File([bytes], name, { type: "audio/wav" });
function staging() {
  const state = { decodes: 0, contexts: 0, fail: false, oversized: false };
  return {
    state,
    factory: (rate: number): AssetStagingContext => {
      state.contexts++;
      return {
        sampleRate: rate,
        createBuffer: (channels, length, sampleRate) =>
          new FakeAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer,
        decodeAudioData: async (bytes: ArrayBuffer) => {
          state.decodes++;
          if (state.fail) throw new Error("native decoder rejected fixture");
          const view = new DataView(bytes),
            frames = view.getUint32(40, true) / 2;
          const output = new FakeAudioBuffer(
            1,
            state.oversized ? 999 : Math.round((frames * rate) / 48000),
            rate,
          );
          output.getChannelData(0).fill(view.getInt16(44, true) / 32768);
          return output as unknown as AudioBuffer;
        },
      };
    },
  };
}
const engine = (maxDecodedBytes?: number) =>
  new AudioEngine({
    context: new FakeAudioContext() as unknown as BaseAudioContext,
    ...(maxDecodedBytes === undefined ? {} : { budget: { maxDecodedBytes } }),
  });
async function signal(): Promise<ProjectAsset> {
  const generator = {
    algorithm: "tone-v1" as const,
    durationSeconds: 1,
    sampleRateHz: 48000 as const,
    frequencyHz: 220,
  };
  return {
    assetId: "signal.tone-220",
    revision: 1,
    sha256: await sha256Canonical(generator),
    hashKind: "canonicalDescriptorSha256",
    name: "Config only",
    mimeType: "application/x-reflection-lab-generator",
    byteLength: JSON.stringify(generator).length,
    storage: "generatedDescriptor",
    rights: { license: "PROJECT_GENERATED", source: "generator descriptor" },
    generator,
  };
}
function imported(bytes = wave(), assetId = "asset.original", revision = 3): ProjectAsset {
  return {
    assetId,
    revision,
    sha256: hash(bytes),
    hashKind: "encodedBytesSha256",
    name: "original.wav",
    mimeType: "audio/wav",
    byteLength: bytes.byteLength,
    storage: "externalFile",
    rights: { license: "USER_CONFIRMED_LOCAL_USE", source: "local file" },
  };
}
async function project(asset?: ProjectAsset, extra: ProjectAsset[] = []) {
  const scene = createDefaultScene(),
    soundBehaviors = createDefaultBehaviors(scene);
  if (asset) {
    const pin = { assetId: asset.assetId, revision: asset.revision, sha256: asset.sha256 };
    soundBehaviors.assets = [pin];
    soundBehaviors.profiles
      .flatMap((profile) => profile.rules)
      .find((rule) => rule.trigger.kind === "discrete")!.generator = {
      kind: "sample",
      asset: pin,
      loop: false,
      startOffsetSeconds: 0,
    };
  }
  return createProject({
    projectId: "project.assets",
    name: "Asset host",
    scene,
    soundBehaviors,
    assets: [await signal(), ...(asset ? [asset] : []), ...extra],
  });
}

test("configuration-only generator descriptors never become decoded READY assets", async () => {
  const decode = staging(),
    host = new AssetHost({ getEngine: () => null, createStagingContext: decode.factory });
  const initial = await project(),
    bank = await host.prepareProject(initial);
  assert.equal(
    bank.assets.find((asset) => asset.assetId === "signal.tone-220")!.availability,
    "MISSING",
  );
  await host.commitPrepared(bank);
  assert.deepEqual(host.getProjectAssets(), initial.assets);
  assert.equal(decode.state.contexts, 0);
  const corrupt = structuredClone(initial);
  corrupt.assets[0]!.sha256 = "0".repeat(64);
  await assert.rejects(host.prepareProject(corrupt), { code: "ASSET_DESCRIPTOR_HASH" });
  assert.deepEqual(host.getProjectAssets(), initial.assets);
});

test("missing required pin preserves the previous host and never opens a live audio device", async () => {
  const decode = staging(),
    host = new AssetHost({ getEngine: () => null, createStagingContext: decode.factory });
  await host.commitPrepared(await host.prepareProject(await project()));
  const previous = host.getProjectAssets();
  await assert.rejects(host.prepareProject(await project(imported())), {
    code: "ASSET_REQUIRED_MISSING",
  });
  assert.deepEqual(host.getProjectAssets(), previous);
  assert.equal(decode.state.contexts, 0);
});

test("confirmed WAV import persists exact bytes and fresh host restores decoded samples before user gesture", async () => {
  const store = new BlobStore({ indexedDB: null }),
    decode = staging();
  const host = new AssetHost({
    store,
    getEngine: () => null,
    createStagingContext: decode.factory,
  });
  const descriptor = await host.importFile(file(), true);
  assert.equal(descriptor.sha256, hash(wave()));
  assert.equal(host.getAssets()[0]!.availability, "READY");
  const ref = host.getProjectAssets()[0]!;
  assert.equal(ref.hashKind, "encodedBytesSha256");
  assert.deepEqual((await store.loadAsset(ref.assetId, ref.sha256))!.bytes, wave());
  const fresh = new AssetHost({
    store,
    getEngine: () => null,
    createStagingContext: decode.factory,
  });
  await fresh.commitPrepared(await fresh.prepareProject(await project(ref)));
  const audio = engine();
  await fresh.attachEngine(audio);
  assert.equal(audio.getAssetBuffer(ref.assetId)!.getChannelData(0)[0], 1000 / 32768);
  assert.equal(
    fresh.getAssets().find((value) => value.assetId === ref.assetId)!.rightsStatus,
    "APPROVED",
  );
});

test("pending-project SHA relink retains every original identity and leaves the active bank intact", async () => {
  const store = new BlobStore({ indexedDB: null }),
    decode = staging(),
    audio = engine();
  const host = new AssetHost({
    store,
    getEngine: () => audio,
    createStagingContext: decode.factory,
  });
  const old = await host.importFile(file(wave(8, 500), "old.wav"), true);
  const before = host.getProjectAssets(),
    oldBuffer = audio.getAssetBuffer(old.assetId);
  const first = imported(),
    second = imported(wave(), "asset.shared", 7),
    pending = await project(first, [second]);
  await assert.rejects(host.importFile(file(wave(8, 333), "wrong.wav"), true, pending), {
    code: "ASSET_RELINK_MISMATCH",
  });
  assert.deepEqual(host.getProjectAssets(), before);
  assert.equal(audio.getAssetBuffer(old.assetId), oldBuffer);
  const relinked = await host.importFile(file(wave(), "renamed.wav"), true, pending);
  assert.equal(relinked.assetId, first.assetId);
  assert.equal(relinked.revision, first.revision);
  assert.deepEqual(host.getProjectAssets(), before);
  assert.equal(audio.getAssetBuffer(old.assetId), oldBuffer);
  for (const ref of [first, second])
    assert.equal((await store.loadAsset(ref.assetId, ref.sha256))!.metadata.revision, ref.revision);
  await host.commitPrepared(await host.prepareProject(pending));
  assert.equal(audio.getAssetBuffer(first.assetId), audio.getAssetBuffer(second.assetId));
  assert.equal(audio.getAssetBuffer(old.assetId), null);
  assert.equal(
    host.getAssets().find((value) => value.assetId === first.assetId)!.availability,
    "READY",
  );
});

test("rights, invalid WAV and native decoder mismatch fail before changing active metadata", async () => {
  const decode = staging(),
    host = new AssetHost({ getEngine: () => null, createStagingContext: decode.factory });
  await assert.rejects(host.importFile(file(), false), { code: "RIGHTS_CONFIRMATION_REQUIRED" });
  await assert.rejects(host.importFile(file(new ArrayBuffer(12)), true), /WAV/);
  assert.equal(decode.state.decodes, 0);
  decode.state.oversized = true;
  await assert.rejects(host.importFile(file(), true), { code: "WAV_DECODE_MISMATCH" });
  assert.deepEqual(host.getAssets(), []);
  assert.deepEqual(host.getProjectAssets(), []);
});

test("current decoded plus staged PCM budget is checked before native decoding; matching buffer is reused", async () => {
  const decode = staging(),
    store = new BlobStore({ indexedDB: null }),
    audio = engine(64);
  const host = new AssetHost({
    store,
    getEngine: () => audio,
    createStagingContext: decode.factory,
  });
  const initial = await host.importFile(file(), true),
    ref = host.getProjectAssets()[0]!,
    buffer = audio.getAssetBuffer(initial.assetId);
  assert.equal(decode.state.decodes, 1);
  await host.commitPrepared(await host.prepareProject(await project(ref)));
  assert.equal(decode.state.decodes, 1);
  assert.equal(audio.getAssetBuffer(ref.assetId), buffer);
  await assert.rejects(host.importFile(file(wave(8, 2000), "next.wav"), true), {
    code: "DECODED_MEMORY_BUDGET",
  });
  assert.equal(decode.state.decodes, 1);
  assert.equal(audio.getAssetBuffer(ref.assetId), buffer);
});

test("failed engine replacement and stale prepared tokens preserve host metadata", async () => {
  const decode = staging(),
    audio = engine(),
    host = new AssetHost({ getEngine: () => audio, createStagingContext: decode.factory });
  const bank = await host.prepareProject(await project());
  const originalReplace = audio.replaceAssets.bind(audio);
  audio.replaceAssets = () => {
    throw new Error("engine bank busy");
  };
  await assert.rejects(host.commitPrepared(bank), /engine bank busy/);
  assert.deepEqual(host.getProjectAssets(), []);
  audio.replaceAssets = originalReplace;
  await host.commitPrepared(bank);
  const stale = await host.prepareProject(await project());
  await host.importFile(file(), true);
  const previous = host.getProjectAssets();
  await assert.rejects(host.commitPrepared(stale), { code: "ASSET_PREPARED_STALE" });
  assert.deepEqual(host.getProjectAssets(), previous);
});

test("Project JSON cannot approve unconfirmed local bytes", async () => {
  const decode = staging(),
    store = new BlobStore({ indexedDB: null }),
    ref = imported();
  await store.saveAsset({
    assetId: ref.assetId,
    sha256: ref.sha256,
    bytes: wave(),
    metadata: {
      name: ref.name,
      origin: "imported",
      license: "Unverified fixture",
      revision: ref.revision,
    },
  });
  const host = new AssetHost({
    store,
    getEngine: () => null,
    createStagingContext: decode.factory,
  });
  await assert.rejects(host.prepareProject(await project(ref)), {
    code: "ASSET_RIGHTS_UNVERIFIED",
  });
  assert.deepEqual(host.getProjectAssets(), []);
  await host.importFile(file(), true, await project(ref));
  const fresh = new AssetHost({
    store,
    getEngine: () => null,
    createStagingContext: decode.factory,
  });
  await fresh.commitPrepared(await fresh.prepareProject(await project(ref)));
  assert.equal(
    fresh.getAssets().find((asset) => asset.assetId === ref.assetId)!.rightsStatus,
    "APPROVED",
  );
  assert.equal(
    (await store.loadAsset(ref.assetId, ref.sha256))!.metadata.license,
    "Unverified fixture",
  );
});

test("actual builtin descriptors use known fixed PCM algorithms and attach through atomic replacement", async () => {
  const decode = staging(),
    audio = engine(),
    host = new AssetHost({ getEngine: () => audio, createStagingContext: decode.factory });
  await host.commitPrepared(await host.prepareProject(await project()));
  const refs = await host.ensureBuiltinDescriptors(audio);
  assert.equal(refs.length, 3);
  for (const ref of refs) {
    assert.equal(ref.hashKind, "float32MonoPcmBytesSha256");
    assert.equal((await regenerateBuiltinAsset(ref))!.sha256, ref.sha256);
    assert.equal(audio.getAssetBuffer(ref.assetId)!.length * 4, ref.byteLength);
    assert.equal(
      host.getAssets().find((value) => value.assetId === ref.assetId)!.availability,
      "READY",
    );
  }
  assert.equal(
    host.getProjectAssets().find((value) => value.assetId === "signal.tone-220")!.hashKind,
    "canonicalDescriptorSha256",
  );
  const fresh = new AssetHost({ getEngine: () => null, createStagingContext: decode.factory });
  await fresh.commitPrepared(await fresh.prepareProject(await project(undefined, refs)));
  assert.equal(fresh.getAssets().filter((value) => value.availability === "READY").length, 3);
});

test("metadata-only builtin refs retain their recorded PCM identity across another engine sample rate", async () => {
  const decode = staging(),
    context = new FakeAudioContext();
  Object.defineProperty(context, "sampleRate", { value: 44100 });
  const originalEngine = new AudioEngine({ context: context as unknown as BaseAudioContext });
  const original = new AssetHost({
    getEngine: () => originalEngine,
    createStagingContext: decode.factory,
  });
  const refs = await original.ensureBuiltinDescriptors(originalEngine),
    nextEngine = engine();
  const restored = new AssetHost({
    getEngine: () => nextEngine,
    initialProjectAssets: refs,
    createStagingContext: decode.factory,
  });
  assert.deepEqual(await restored.ensureBuiltinDescriptors(nextEngine), refs);
  for (const ref of refs) assert.equal(nextEngine.getAssetBuffer(ref.assetId)!.sampleRate, 44100);
});

test("attaching an unchanged bank is idempotent and does not replace buffers in use", async () => {
  const decode = staging(),
    audio = engine(),
    host = new AssetHost({ getEngine: () => audio, createStagingContext: decode.factory });
  await host.importFile(file(), true);
  audio.replaceAssets = () => {
    throw new Error("active bank cannot be replaced");
  };
  await host.attachEngine(audio);
});
