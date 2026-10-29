import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { BlobStore, regenerateBuiltinAsset } from "../../src/persistence/blob-store.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import { createDefaultBehaviors } from "../../src/app/defaults.js";
import { createProject } from "../../src/persistence/index.js";
import type { ProjectAsset } from "../../src/persistence/types.js";

const sha = (bytes: ArrayBuffer) =>
  createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
function asset(value = 1, revision = 1) {
  const bytes = new Uint8Array([value, 2, 3, 4]).buffer;
  return {
    assetId: "asset.local",
    sha256: sha(bytes),
    bytes,
    metadata: {
      name: "Local source",
      origin: "imported" as const,
      license: "User supplied; unverified",
      revision,
    },
  };
}
async function recording(runId = "run.persist") {
  const scene = createDefaultScene();
  const recorder = new ExperimentRecorder({
    runId,
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: {},
    solverConfig: {},
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [],
    physicsVersion: "test",
    backendVersion: "test",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
    createdAt: "2026-10-27T00:00:00.000Z",
  });
  recorder.appendFrame({
    tick: 0,
    sceneRevision: scene.sceneRevision,
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: object.positionM,
      orientationQuaternion: object.orientationQuaternion,
    })),
    listener: scene.listener,
    physicsEvents: [],
    behaviorDecisions: [],
    audioEvents: [],
  });
  return recorder.finish();
}

test("Node fallback declares volatile storage and only exposes verified detached encoded bytes", async () => {
  const store = new BlobStore({ indexedDB: null });
  assert.equal(store.mode, "memory");
  assert.equal(store.capabilities.persistent, false);
  const input = asset();
  const pending = store.saveAsset(input);
  new Uint8Array(input.bytes)[0] = 90;
  input.metadata.name = "changed";
  const saved = await pending;
  assert.equal(saved.hashKind, "encodedBytesSha256");
  assert.equal(saved.metadata.name, "Local source");
  assert.deepEqual([...new Uint8Array(saved.bytes)], [1, 2, 3, 4]);
  new Uint8Array(saved.bytes)[0] = 80;
  saved.metadata.license = "changed";
  const loaded = await store.loadAsset(input.assetId, input.sha256);
  assert.equal(loaded!.metadata.license, "User supplied; unverified");
  assert.deepEqual([...new Uint8Array(loaded!.bytes)], [1, 2, 3, 4]);
  assert.equal(await store.loadAsset(input.assetId, "f".repeat(64)), null);
});

test("hash mismatch, stale revision and conflicting immutable metadata preserve previous bytes", async () => {
  const store = new BlobStore({ indexedDB: null });
  const first = asset();
  await store.saveAsset(first);
  await assert.rejects(store.saveAsset({ ...asset(2), sha256: first.sha256 }), {
    code: "BLOB_HASH",
  });
  await assert.rejects(store.saveAsset(asset(2)), { code: "REVISION_CONFLICT" });
  await assert.rejects(
    store.saveAsset({ ...first, metadata: { ...first.metadata, license: "other" } }),
    { code: "REVISION_CONFLICT" },
  );
  await store.saveAsset(asset(2, 2));
  // Historical immutable references remain idempotent and must not roll the head backward.
  await store.saveAsset(first);
  await assert.rejects(store.saveAsset(asset(3, 1)), { code: "REVISION_CONFLICT" });
  assert.deepEqual((await store.loadAsset(first.assetId, first.sha256))!.bytes, first.bytes);
});

test("bounded writes reject aggregate and entry overflow without consuming capacity", async () => {
  const store = new BlobStore({
    indexedDB: null,
    limits: { maxTotalBytes: 5, maxAssetEntries: 1 },
  });
  const first = asset();
  await store.saveAsset(first);
  await store.saveAsset(first);
  await assert.rejects(store.saveAsset(asset(2, 2)), { code: "BLOB_BUDGET" });
  assert.deepEqual((await store.loadAsset(first.assetId, first.sha256))!.bytes, first.bytes);
  assert.equal(await store.loadAsset(first.assetId, asset(2, 2).sha256), null);
});

test("recording storage verifies canonical artifact SHA and keeps encoded JSON SHA distinct", async () => {
  const store = new BlobStore({ indexedDB: null });
  const artifact = await recording();
  const receipt = await store.saveRecording(artifact);
  assert.equal(receipt.sha256, artifact.artifactSha256);
  assert.equal(receipt.hashKind, "canonicalRecordingArtifactSha256");
  assert.equal(receipt.encodedHashKind, "utf8JsonBytesSha256");
  assert.notEqual(receipt.encodedSha256, artifact.artifactSha256);
  const loaded = await store.loadRecording(artifact.runId, receipt.sha256);
  assert.deepEqual(loaded, artifact);
  loaded!.limitations = ["mutated"];
  assert.deepEqual(await store.loadRecording(artifact.runId, receipt.sha256), artifact);
  const corrupt = structuredClone(artifact);
  corrupt.frames[0]!.tick = 1;
  await assert.rejects(store.saveRecording(corrupt), { code: "ARTIFACT_HASH" });
  assert.deepEqual(await store.loadRecording(artifact.runId, receipt.sha256), artifact);
  assert.equal(await store.loadRecording(artifact.runId, "e".repeat(64)), null);
});

test("closed stores reject subsequent operations and invalid limits/identity/provenance fail explicitly", async () => {
  assert.throws(() => new BlobStore({ limits: { maxTotalBytes: Infinity } }), {
    code: "BLOB_BUDGET",
  });
  const store = new BlobStore({ indexedDB: null });
  await assert.rejects(
    store.saveAsset({ ...asset(), metadata: { ...asset().metadata, license: "" } }),
    { code: "BLOB_METADATA" },
  );
  await assert.rejects(store.loadAsset("bad/id", "a".repeat(64)), { code: "BLOB_ID" });
  store.close();
  await assert.rejects(store.saveAsset(asset()), { code: "BLOB_CLOSED" });
});

test("an IndexedDB access failure remains explicit instead of silently using memory", async () => {
  const denied = {
    open() {
      throw new DOMException("denied", "SecurityError");
    },
  } as unknown as IDBFactory;
  const store = new BlobStore({ indexedDB: denied });
  assert.equal(store.mode, "indexedDB");
  await assert.rejects(store.saveAsset(asset()), { code: "BLOB_STORAGE_OPEN" });
});

test("direct regeneration rejects every unknown algorithm including inherited property names", async () => {
  for (const algorithm of ["unknown-v1", "__proto__", "constructor"]) {
    await assert.rejects(
      regenerateBuiltinAsset({
        storage: "generatedDescriptor",
        sha256: sha(new ArrayBuffer(0)),
        hashKind: "float32MonoPcmBytesSha256",
        byteLength: 0,
        generator: { algorithm, sampleRateHz: 48000 },
      } as unknown as ProjectAsset),
      { code: "ASSET_GENERATOR" },
    );
  }
});

test("only explicit known builtin algorithms regenerate their exact mono Float32 PCM", async () => {
  const definitions = [
    {
      algorithm: "builtin-tone-v1",
      duration: 1,
      sample: (t: number) => Math.sin(2 * Math.PI * 220 * t) * 0.25,
    },
    {
      algorithm: "builtin-impact-v1",
      duration: 0.25,
      sample: (t: number) =>
        Math.sin(2 * Math.PI * (330 - 400 * t) * t) *
        Math.exp(-25 * t) *
        Math.min(1, t / 0.002) *
        0.5,
    },
    {
      algorithm: "builtin-whoosh-v1",
      duration: 0.5,
      sample: (t: number) =>
        Math.sin(2 * Math.PI * (120 + 1100 * t) * t) * Math.sin((Math.PI * t) / 0.5) ** 2 * 0.2,
    },
  ] as const;
  for (const rate of [44100, 48000] as const)
    for (const definition of definitions) {
      const samples = new Float32Array(Math.round(rate * definition.duration));
      for (let i = 0; i < samples.length; i++) samples[i] = definition.sample(i / rate);
      const descriptor: ProjectAsset = {
        assetId: "builtin.test",
        revision: 1,
        sha256: sha(samples.buffer),
        hashKind: "float32MonoPcmBytesSha256",
        name: "generated",
        mimeType: "audio/x-float32-pcm",
        byteLength: samples.byteLength,
        storage: "generatedDescriptor",
        rights: { license: "ORIGINAL_PROCEDURAL", source: "builtin" },
        generator: {
          algorithm: definition.algorithm,
          durationSeconds: definition.duration,
          sampleRateHz: rate,
        },
      };
      const result = await regenerateBuiltinAsset(descriptor);
      assert.equal(result!.sha256, descriptor.sha256);
      assert.deepEqual(result!.bytesPCM, samples);
      const scene = createDefaultScene();
      scene.sources = [];
      const projectInput = {
        projectId: "project.builtins",
        name: "Exact builtin",
        scene,
        soundBehaviors: createDefaultBehaviors(scene),
        assets: [descriptor],
      };
      assert.equal(createProject(projectInput).assets[0]!.hashKind, "float32MonoPcmBytesSha256");
      assert.throws(
        () =>
          createProject({
            ...projectInput,
            assets: [{ ...descriptor, hashKind: "canonicalDescriptorSha256" }],
          }),
        { code: "ASSET_GENERATOR" },
      );
      assert.throws(
        () =>
          createProject({
            ...projectInput,
            assets: [
              { ...descriptor, generator: { ...descriptor.generator, algorithm: "unknown-v1" } },
            ],
          }),
        { code: "ASSET_GENERATOR" },
      );
      await assert.rejects(regenerateBuiltinAsset({ ...descriptor, sha256: "0".repeat(64) }), {
        code: "BLOB_HASH",
      });
      await assert.rejects(
        regenerateBuiltinAsset({
          ...descriptor,
          generator: { ...descriptor.generator!, durationSeconds: 2 },
        }),
        { code: "ASSET_GENERATOR" },
      );
      assert.equal(
        await regenerateBuiltinAsset({
          ...descriptor,
          hashKind: "canonicalDescriptorSha256",
          generator: {
            algorithm: "tone-v1",
            durationSeconds: 1,
            sampleRateHz: rate,
            frequencyHz: 220,
          },
        }),
        null,
      );
    }
});
