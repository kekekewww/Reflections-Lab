import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createProject,
  deserializeProject,
  ProjectStore,
  serializeProject,
  unresolvedProjectAssets,
} from "../../src/persistence/index.js";

const behavior = JSON.parse(
  readFileSync(
    new URL("../../schemas/sound-behavior/examples/document.json", import.meta.url),
    "utf8",
  ),
);
const hash = behavior.assets[0].sha256;
function input() {
  return {
    projectId: "project.test",
    name: "可重播聲學實驗",
    createdAt: "2026-10-27T00:00:00.000Z",
    scene: {
      schemaVersion: "1.0.0",
      sceneId: "scene.test",
      sceneRevision: 4,
      units: "SI",
      coordinateSystem: "right-handed-y-up-minus-z-forward",
      seed: 7,
      gravityMps2: [0, -9.81, 0],
      objects: ["object.ball", "object.floor"].map((id, index) => ({
        id,
        shape: "box",
        dimensionsM: [1, 1, 1],
        positionM: [index * 3, 1, 0],
        orientationQuaternion: [0, 0, 0, 1],
        mode: "fixed",
        massKg: 1,
        friction: 0.5,
        restitution: 0.2,
        physicsMaterialId: index === 0 ? "material.metal" : "material.wood",
        acousticMaterialId: index === 0 ? "material.metal" : "material.wood",
        acousticRole: "staticSurface",
      })),
      sources: [],
      listener: {
        id: "listener.main",
        positionM: [0, 1.7, 3],
        orientationQuaternion: [0, 0, 0, 1],
        attachment: "independent",
      },
    },
    soundBehaviors: structuredClone(behavior),
    assets: [
      {
        assetId: "asset.fixture-sine",
        revision: 1,
        sha256: hash,
        name: "本機素材",
        mimeType: "audio/wav",
        byteLength: 1200,
        storage: "externalFile",
        rights: { license: "User supplied; rights unverified", source: "local-file" },
      },
    ],
    recordings: [],
  };
}

class MemoryStorage {
  value: string | null = null;
  fail = false;
  getItem() {
    return this.value;
  }
  setItem(_key: string, value: string) {
    if (this.fail) throw new Error("storage quota");
    this.value = value;
  }
}

test("project roundtrip preserves Scene v1, Sound profiles, asset rights and immutable input", () => {
  const source = input();
  const project = createProject(source);
  source.scene.objects[0]!.positionM[0] = 90;
  const loaded = deserializeProject(serializeProject(project));
  assert.deepEqual(loaded, project);
  assert.equal(loaded.scene.objects[0]!.positionM[0], 0);
  assert.equal(loaded.assets[0]!.rights.source, "local-file");
});

test("strict version, unknown keys and invalid scene are rejected", () => {
  const project = createProject(input());
  assert.throws(
    () => deserializeProject(JSON.stringify({ ...project, schemaVersion: "2.0.0" })),
    /VERSION/,
  );
  assert.throws(
    () => deserializeProject(JSON.stringify({ ...project, apiKey: "secret" })),
    /UNKNOWN_FIELD/,
  );
  const bad = structuredClone(project);
  bad.scene.objects[0]!.orientationQuaternion = [0, 0, 0, 0];
  assert.throws(() => deserializeProject(JSON.stringify(bad)), /SCENE_INVALID/);
});

test("missing, stale and duplicate asset references fail without silently replacing identity", () => {
  const source = input();
  source.assets = [];
  assert.throws(() => createProject(source), /ASSET_MISSING/);
  const stale = input();
  stale.assets[0]!.revision = 2;
  assert.throws(() => createProject(stale), /ASSET_REVISION/);
  const duplicate = input();
  duplicate.assets.push(structuredClone(duplicate.assets[0]!));
  assert.throws(() => createProject(duplicate), /DUPLICATE_ASSET/);
});

test("invalid behavior bindings and unsafe rule code are rejected", () => {
  const missing = input();
  missing.soundBehaviors.bindings[0].objectId = "object.missing";
  assert.throws(() => createProject(missing), /BINDING_OBJECT/);
  const unsafe = input();
  unsafe.soundBehaviors.profiles[0].rules[0].script = "alert(1)";
  assert.throws(() => createProject(unsafe), /BEHAVIOR_INVALID/);
});

test("external-file metadata is visibly unresolved until matching bytes are supplied", () => {
  const project = createProject(input());
  assert.deepEqual(unresolvedProjectAssets(project), ["asset.fixture-sine"]);
  assert.deepEqual(
    unresolvedProjectAssets(
      project,
      new Map([["asset.fixture-sine", { revision: 1, sha256: hash }]]),
    ),
    [],
  );
  assert.deepEqual(
    unresolvedProjectAssets(
      project,
      new Map([["asset.fixture-sine", { revision: 1, sha256: "a".repeat(64) }]]),
    ),
    ["asset.fixture-sine"],
  );
});

test("single-key storage commit failure preserves in-memory and durable previous project", () => {
  const storage = new MemoryStorage(),
    store = new ProjectStore(storage);
  const first = createProject(input());
  store.save(first);
  const oldBytes = storage.value;
  storage.fail = true;
  const changed = { ...first, revision: 1, name: "下一版", updatedAt: "2026-10-27T00:01:00.000Z" };
  assert.throws(() => store.save(changed, { expectedRevision: 0 }), /STORAGE_WRITE/);
  assert.deepEqual(store.getCurrent(), first);
  assert.equal(storage.value, oldBytes);
});

test("invalid import/load never corrupts an already loaded project", () => {
  const storage = new MemoryStorage(),
    store = new ProjectStore(storage);
  const first = createProject(input());
  store.save(first);
  assert.throws(() => store.import("{bad json"), /JSON_INVALID/);
  assert.deepEqual(store.getCurrent(), first);
  storage.value = "null";
  assert.throws(() => store.load(), /PROJECT_INVALID/);
  assert.deepEqual(store.getCurrent(), first);
});

test("optimistic save detects stale revision and returns detached snapshots", () => {
  const storage = new MemoryStorage(),
    store = new ProjectStore(storage);
  const first = createProject(input());
  store.save(first);
  assert.throws(
    () => store.save({ ...first, revision: 1 }, { expectedRevision: 2 }),
    /REVISION_CONFLICT/,
  );
  const copy = store.getCurrent()!;
  copy.name = "mutated";
  assert.equal(store.getCurrent()!.name, first.name);
  assert.deepEqual(JSON.parse(store.export()), first);
});

test("nonfinite, cyclic, excessive document and unresolved recording refs are refused", () => {
  const source = input();
  source.assets[0]!.byteLength = Number.POSITIVE_INFINITY;
  assert.throws(() => createProject(source), /NON_JSON_VALUE/);
  const cyclic: Record<string, unknown> = input();
  cyclic.self = cyclic;
  assert.throws(() => createProject(cyclic), /CYCLE/);
  assert.throws(() => deserializeProject(" ".repeat(8 * 1024 * 1024 + 1)), /SIZE_LIMIT/);
  const recording = input() as Record<string, unknown>;
  recording.recordings = [
    {
      runId: "run.a",
      sha256: "invalid",
      status: "captured",
      frameCount: 2,
      durationSeconds: 1,
      storage: "externalArtifact",
    },
  ];
  assert.throws(() => createProject(recording), /RECORDING_INVALID/);
});

test("nonenumerable toJSON and sparse arrays cannot bypass inert JSON validation", () => {
  const source = input();
  let executed = false;
  Object.defineProperty(source, "toJSON", {
    value: () => {
      executed = true;
      return {};
    },
  });
  assert.throws(() => createProject(source), /NON_JSON_VALUE/);
  assert.equal(executed, false);
  const sparse = input() as Record<string, unknown>;
  sparse.recordings = new Array(1);
  assert.throws(() => createProject(sparse), /NON_JSON_VALUE/);
});

test("saved authoring config rejects degenerate mapping and an unbounded pair override", () => {
  const mapping = input();
  mapping.soundBehaviors.profiles[0].rules[0].mappings[0].inputMax = 0;
  assert.throws(() => createProject(mapping), /MAPPING_RANGE/);
  const override = input();
  override.soundBehaviors.profiles[0].materialPairOverrides[0].generator = {
    kind: "oscillator",
    waveform: "sine",
    frequencyHz: 440,
  };
  assert.throws(() => createProject(override), /ONE_SHOT_DURATION_REQUIRED/);
});
