import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBehaviors, createDefaultScene } from "../../src/app/defaults.js";
import {
  createProject,
  deserializeProject,
  serializeProject,
} from "../../src/persistence/index.js";
import {
  validateEditorMetadata,
  reconcileEditorMetadata,
  projectEditorMetadata,
} from "../../src/persistence/editor-metadata.js";
import type { ProjectEditorMetadata } from "../../src/persistence/types.js";
import type { ToolName, ToolRequest } from "../../src/ai/types.js";
import { createScene } from "../../src/scene/validate-scene.js";
import type { SceneSpec } from "../../src/scene/types.js";

function metadata(): ProjectEditorMetadata {
  return {
    schemaVersion: "1.0.0",
    revision: 4,
    sceneLabel: " 原始場景 ",
    objectLabels: [
      { objectId: "ball", label: "金屬球" },
      { objectId: "floor", label: "地板" },
    ],
    sourceReferences: [{ sourceId: "source.speaker", referenceFrequencyHz: 220 }],
  };
}
function nextScene(): SceneSpec {
  const scene = createDefaultScene();
  return createScene({ ...scene, sceneRevision: 1 });
}
function request(
  tool: ToolName,
  args: Record<string, unknown>,
  scene = nextScene(),
  requestId = "request.metadata",
): ToolRequest {
  return {
    schemaVersion: "1.0.0",
    requestId,
    tool,
    sceneId: scene.sceneId,
    expectedSceneRevision: scene.sceneRevision - 1,
    transactionId: "tx.metadata",
    arguments: args,
  };
}
const sourceArgs = (scene: SceneSpec, referenceFrequencyHz = 220) => {
  const source = scene.sources[0]!;
  return {
    sourceId: source.id,
    objectId: source.objectId,
    signalId: source.signalId,
    mode: source.mode,
    gainDbfs: source.gainDbfs,
    referenceFrequencyHz,
  };
};
function addScene() {
  const scene = nextScene(),
    object = {
      ...structuredClone(scene.objects[0]!),
      id: "object.new",
      positionM: [0, 1, 0] as [number, number, number],
    };
  const next = createScene({ ...scene, objects: [...scene.objects, object] });
  return {
    next,
    add: request(
      "AddObject",
      {
        objectId: object.id,
        label: " 新物件的核准名稱 ",
        shape: object.shape,
        dimensionsM: object.dimensionsM,
        positionM: object.positionM,
        orientationQuaternion: object.orientationQuaternion,
        materialId: object.acousticMaterialId,
        mode: object.mode,
        massKg: object.massKg,
      },
      next,
    ),
  };
}

test("Project v1 metadata roundtrip preserves labels/reference context outside the frozen Scene", () => {
  const scene = createDefaultScene();
  scene.sources = [];
  const valid = { ...metadata(), sourceReferences: [] };
  const input = {
    projectId: "project.editor-metadata",
    name: "Legacy project",
    scene,
    soundBehaviors: createDefaultBehaviors(scene),
    assets: [],
    recordings: [],
  };
  const legacy = createProject(input);
  assert.equal(Object.hasOwn(legacy, "editorMetadata"), false);
  const project = createProject({ ...input, editorMetadata: valid });
  assert.deepEqual(deserializeProject(serializeProject(project)).editorMetadata, valid);
  assert.equal(Object.hasOwn(project.scene, "sceneLabel"), false);
  assert.equal(Object.hasOwn(project.scene.objects[0]!, "label"), false);
  assert.throws(
    () =>
      createProject({
        ...input,
        editorMetadata: { ...valid, objectLabels: [{ objectId: "unknown", label: "dangling" }] },
      }),
    { code: "EDITOR_METADATA_REFERENCE" },
  );
});

test("strict metadata rejects unknown fields, duplicate/dangling IDs and out-of-range values", () => {
  const scene = createDefaultScene(),
    valid = metadata();
  const bad = [
    { ...valid, extra: true },
    { ...valid, schemaVersion: "2.0.0" },
    { ...valid, revision: -1 },
    { ...valid, revision: 0.5 },
    { ...valid, revision: 2147483648 },
    { ...valid, sceneLabel: "" },
    { ...valid, sceneLabel: "x".repeat(161) },
    { ...valid, objectLabels: [{ objectId: "ball", label: "" }] },
    { ...valid, objectLabels: [{ objectId: "ball", label: "ok", extra: 1 }] },
    { ...valid, objectLabels: [valid.objectLabels[0], valid.objectLabels[0]] },
    { ...valid, sourceReferences: [valid.sourceReferences[0], valid.sourceReferences[0]] },
    ...[19.99, 20000.01, NaN, Infinity].map((referenceFrequencyHz) => ({
      ...valid,
      sourceReferences: [{ sourceId: "source.speaker", referenceFrequencyHz }],
    })),
  ];
  for (const value of bad)
    assert.throws(() => validateEditorMetadata(value, scene), { code: "EDITOR_METADATA_INVALID" });
  assert.throws(
    () =>
      validateEditorMetadata(
        { ...valid, objectLabels: [{ objectId: "missing", label: "missing" }] },
        scene,
      ),
    { code: "EDITOR_METADATA_REFERENCE" },
  );
  assert.throws(
    () =>
      validateEditorMetadata(
        { ...valid, sourceReferences: [{ sourceId: "missing", referenceFrequencyHz: 220 }] },
        scene,
      ),
    { code: "EDITOR_METADATA_REFERENCE" },
  );
});

test("metadata bounds accept 256 object labels and 32 source refs while refusing excess/sparse/accessors", () => {
  const base = createDefaultScene(),
    objects = Array.from({ length: 256 }, (_, i) => ({
      ...structuredClone(base.objects[0]!),
      id: `object.${i}`,
    }));
  const sources = Array.from({ length: 32 }, (_, i) => ({
    ...base.sources[0]!,
    id: `source.${i}`,
    objectId: objects[i]!.id,
  }));
  const scene = createScene({ ...base, objects, sources });
  const valid = {
    schemaVersion: "1.0.0",
    revision: 0,
    objectLabels: objects.map((object) => ({ objectId: object.id, label: "x".repeat(160) })),
    sourceReferences: sources.map((source) => ({ sourceId: source.id, referenceFrequencyHz: 20 })),
  };
  assert.equal(validateEditorMetadata(valid, scene).objectLabels.length, 256);
  assert.throws(
    () =>
      validateEditorMetadata(
        { ...valid, objectLabels: [...valid.objectLabels, valid.objectLabels[0]] },
        scene,
      ),
    { code: "EDITOR_METADATA_INVALID" },
  );
  assert.throws(
    () =>
      validateEditorMetadata(
        { ...valid, sourceReferences: [...valid.sourceReferences, valid.sourceReferences[0]] },
        scene,
      ),
    { code: "EDITOR_METADATA_INVALID" },
  );
  assert.throws(
    () =>
      validateEditorMetadata({ ...metadata(), objectLabels: new Array(1) }, createDefaultScene()),
    { code: "EDITOR_METADATA_INVALID" },
  );
  let executed = false;
  const accessor = metadata();
  Object.defineProperty(accessor, "sceneLabel", {
    enumerable: true,
    get() {
      executed = true;
      return "unsafe";
    },
  });
  assert.throws(() => validateEditorMetadata(accessor, createDefaultScene()), {
    code: "EDITOR_METADATA_INVALID",
  });
  assert.equal(executed, false);
});

test("reconcile prunes removed identities and advances once without mutating the original", () => {
  const before = metadata(),
    scene = nextScene();
  const removed = createScene({
    ...scene,
    objects: scene.objects.filter((object) => object.id !== "ball" && object.id !== "speaker"),
    sources: [],
  });
  const result = reconcileEditorMetadata(before, removed)!;
  assert.equal(result.revision, 5);
  assert.deepEqual(result.objectLabels, [{ objectId: "floor", label: "地板" }]);
  assert.deepEqual(result.sourceReferences, []);
  assert.equal(before.revision, 4);
  assert.equal(before.objectLabels.length, 2);
  assert.deepEqual(reconcileEditorMetadata(before, scene), before);
  assert.equal(reconcileEditorMetadata(undefined, scene), undefined);
});

test("approved AddObject and Configure preserve exact metadata and increment one transaction revision", () => {
  const { next, add } = addScene(),
    before = metadata();
  const configured = request(
    "ConfigureSoundSource",
    sourceArgs(next, 440),
    next,
    "request.configure",
  );
  const result = projectEditorMetadata(before, next, [add, configured])!;
  assert.equal(result.revision, 5);
  assert.equal(
    result.objectLabels.find((row) => row.objectId === "object.new")!.label,
    add.arguments.label,
  );
  assert.equal(result.sourceReferences[0]!.referenceFrequencyHz, 440);
  assert.equal(
    Object.hasOwn(next.objects.find((object) => object.id === "object.new")!, "label"),
    false,
  );
  assert.equal(Object.hasOwn(next.sources[0]!, "referenceFrequencyHz"), false);
  assert.equal(before.objectLabels.length, 2);
});

test("CreateScene resets old labels/source refs even reused IDs and keeps revision monotonic", () => {
  const before = metadata(),
    scene = nextScene();
  const create = request(
    "CreateScene",
    {
      label: " 重建的房間 ",
      roomDimensionsM: [6, 4, 8],
      surfaceMaterialId: "material.hard",
      seed: 7,
    },
    scene,
  );
  const result = projectEditorMetadata(before, scene, [create])!;
  assert.deepEqual(result, {
    schemaVersion: "1.0.0",
    revision: 5,
    sceneLabel: " 重建的房間 ",
    objectLabels: [],
    sourceReferences: [],
  });
  assert.equal(projectEditorMetadata(undefined, scene, [create])!.revision, 1);
});

test("projection prunes+edits once; no-op retains absence/revision and max revision changes reject", () => {
  const before = metadata(),
    scene = nextScene(),
    removed = createScene({
      ...scene,
      objects: scene.objects.filter((object) => object.id !== "ball"),
    });
  const configure = request("ConfigureSoundSource", sourceArgs(removed, 440), removed);
  assert.equal(projectEditorMetadata(before, removed, [configure])!.revision, 5);
  assert.equal(projectEditorMetadata(undefined, scene, []), undefined);
  assert.deepEqual(projectEditorMetadata(before, scene, []), before);
  const same = request("ConfigureSoundSource", sourceArgs(scene), scene);
  assert.equal(projectEditorMetadata(before, scene, [same])!.revision, 4);
  assert.equal(
    projectEditorMetadata({ ...before, revision: 2147483647 }, scene, [])!.revision,
    2147483647,
  );
  assert.throws(
    () => projectEditorMetadata({ ...before, revision: 2147483647 }, removed, [configure]),
    { code: "EDITOR_METADATA_REVISION" },
  );
});

test("projection rejects stale/mismatched approved requests, duplicate targets and unapplied source data", () => {
  const { next, add } = addScene(),
    before = metadata();
  assert.throws(() => projectEditorMetadata(before, next, [{ ...add, expectedSceneRevision: 9 }]), {
    code: "REVISION_CONFLICT",
  });
  assert.throws(() => projectEditorMetadata(before, next, [{ ...add, sceneId: "scene.other" }]), {
    code: "REVISION_CONFLICT",
  });
  assert.throws(
    () => projectEditorMetadata(before, next, [add, { ...add, requestId: "request.other" }]),
    { code: "EDITOR_METADATA_TOOL" },
  );
  assert.throws(() => projectEditorMetadata(before, nextScene(), [add]), {
    code: "EDITOR_METADATA_REFERENCE",
  });
  const configure = request("ConfigureSoundSource", { ...sourceArgs(next), gainDbfs: -12 }, next);
  assert.throws(() => projectEditorMetadata(before, next, [configure]), {
    code: "EDITOR_METADATA_REFERENCE",
  });
  assert.throws(
    () =>
      projectEditorMetadata(
        before,
        next,
        Array.from({ length: 33 }, () => add),
      ),
    { code: "EDITOR_METADATA_INVALID" },
  );
});
