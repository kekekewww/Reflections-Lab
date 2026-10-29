import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBehaviors, createDefaultScene } from "../../src/app/defaults.js";
import {
  createProject,
  deserializeProject,
  ProjectStore,
  serializeProject,
} from "../../src/persistence/index.js";
import type { RecordingReference } from "../../src/persistence/types.js";

function input() {
  const scene = createDefaultScene();
  scene.sources = [];
  const recordings: RecordingReference[] = [
    {
      runId: "run.A",
      sha256: "a".repeat(64),
      status: "captured",
      frameCount: 2,
      durationSeconds: 1 / 60,
      storage: "externalArtifact",
    },
    {
      runId: "run.B",
      sha256: "b".repeat(64),
      status: "interrupted",
      frameCount: 3,
      durationSeconds: 2 / 60,
      storage: "externalArtifact",
    },
  ];
  return {
    projectId: "project.active-recording",
    name: "Active recording identity",
    createdAt: "2026-10-27T00:00:00.000Z",
    scene,
    soundBehaviors: createDefaultBehaviors(scene),
    assets: [],
    recordings,
  };
}

test("active recording roundtrip preserves exact stable run ID independently of reference order", () => {
  const project = createProject({ ...input(), activeRecordingId: "run.A" });
  const loaded = deserializeProject(serializeProject(project));
  assert.equal(loaded.activeRecordingId, "run.A");
  assert.equal(
    loaded.recordings.find((ref) => ref.runId === loaded.activeRecordingId)!.sha256,
    "a".repeat(64),
  );
  const reordered = createProject({ ...project, recordings: [...project.recordings].reverse() });
  assert.equal(deserializeProject(serializeProject(reordered)).activeRecordingId, "run.A");
});

test("interrupted recording can be explicitly selected without rewriting its status", () => {
  const project = createProject({ ...input(), activeRecordingId: "run.B" });
  assert.equal(
    project.recordings.find((ref) => ref.runId === project.activeRecordingId)!.status,
    "interrupted",
  );
  assert.equal(deserializeProject(serializeProject(project)).activeRecordingId, "run.B");
});

test("legacy v1 projects omit selection and remain valid without silently choosing a recording", () => {
  const project = createProject(input());
  assert.equal(project.schemaVersion, "1.0.0");
  assert.equal(Object.hasOwn(project, "activeRecordingId"), false);
  assert.equal(
    Object.hasOwn(deserializeProject(serializeProject(project)), "activeRecordingId"),
    false,
  );
  assert.equal(
    Object.hasOwn(createProject({ ...input(), recordings: [] }), "activeRecordingId"),
    false,
  );
});

test("invalid, unknown and dangling active recording IDs are rejected", () => {
  for (const activeRecordingId of [null, 0, "", "run/unsafe", "x".repeat(129)]) {
    assert.throws(() => createProject({ ...input(), activeRecordingId }), {
      code: "PROJECT_INVALID",
    });
  }
  assert.throws(() => createProject({ ...input(), activeRecordingId: "run.unknown" }), {
    code: "RECORDING_INVALID",
  });
  assert.throws(() => createProject({ ...input(), recordings: [], activeRecordingId: "run.A" }), {
    code: "RECORDING_INVALID",
  });
  const source = { ...input(), activeRecordingId: "run.A" };
  source.recordings = source.recordings.filter((ref) => ref.runId !== "run.A");
  assert.throws(
    () =>
      deserializeProject(
        JSON.stringify({
          schemaVersion: "1.0.0",
          revision: 0,
          updatedAt: source.createdAt,
          ...source,
        }),
      ),
    { code: "RECORDING_INVALID" },
  );
});

test("invalid active selection import preserves the previous loaded project", () => {
  const durable = new Map<string, string>();
  const store = new ProjectStore({
    getItem: (key) => durable.get(key) ?? null,
    setItem: (key, value) => {
      durable.set(key, value);
    },
  });
  const original = createProject({ ...input(), activeRecordingId: "run.A" });
  store.save(original);
  const priorBytes = store.export();
  assert.throws(
    () => store.import(JSON.stringify({ ...original, activeRecordingId: "run.missing" })),
    { code: "RECORDING_INVALID" },
  );
  assert.deepEqual(store.getCurrent(), original);
  assert.equal(store.export(), priorBytes);
});
