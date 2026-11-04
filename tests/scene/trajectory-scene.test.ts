import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDefaultBehaviors, createDefaultScene } from "../../src/app/defaults.js";
import {
  createProject,
  deserializeProject,
  serializeProject,
} from "../../src/persistence/index.js";
import { sha256Canonical } from "../../src/experiments/hash.js";
import { applyCommand, createScene, SceneError } from "../../src/scene/index.js";

const fixture = () =>
  JSON.parse(readFileSync(new URL("../../schemas/examples/scene.json", import.meta.url), "utf8"));
const trajectory = () => ({
  offsetsM: [[1, 0, 0]],
  strengthMps: 3,
  startDelayS: 0,
  faceAlongPath: false,
});
const withTrajectory = (value: unknown) => {
  const scene = fixture();
  scene.objects[0].trajectory = value;
  return scene;
};
const invalid = (value: unknown) =>
  assert.throws(
    () => createScene(withTrajectory(value)),
    (error) => error instanceof SceneError && error.code === "INVALID_SCENE",
  );

test("createScene accepts and round-trips a trajectory", () => {
  const scene = createScene(withTrajectory(trajectory()));
  assert.deepEqual(scene.objects[0]?.trajectory, trajectory());
});

test("createScene rejects out-of-range or malformed trajectories", () => {
  invalid({ ...trajectory(), offsetsM: [] });
  invalid({ ...trajectory(), offsetsM: Array.from({ length: 64 }, () => [1, 0, 0]) });
  invalid({ ...trajectory(), strengthMps: 0.4 });
  invalid({ ...trajectory(), strengthMps: 20.5 });
  invalid({ ...trajectory(), startDelayS: -1 });
  invalid({ ...trajectory(), startDelayS: 31 });
  invalid({ ...trajectory(), offsetsM: [[Number.POSITIVE_INFINITY, 0, 0]] });
  invalid({ ...trajectory(), offsetsM: [[Number.NaN, 0, 0]] });
  invalid({ ...trajectory(), color: "red" });
});

test("createScene accepts the 63-offset and boundary limits", () => {
  const scene = createScene(
    withTrajectory({
      offsetsM: Array.from({ length: 63 }, () => [0, 0, 1]),
      strengthMps: 20,
      startDelayS: 30,
      faceAlongPath: true,
    }),
  );
  assert.equal(scene.objects[0]?.trajectory?.offsetsM.length, 63);
});

const update = (patch: object, expectedSceneRevision = 0) => ({
  expectedSceneRevision,
  operations: [{ type: "UpdateObject", objectId: "ball", patch }],
});

test("UpdateObject sets a trajectory, null deletes the key, and undo restores each state", () => {
  const scene = createScene(fixture());
  const set = applyCommand(scene, update({ trajectory: trajectory() }));
  assert.deepEqual(set.scene.objects[0]?.trajectory, trajectory());
  const cleared = applyCommand(set.scene, update({ trajectory: null }, 1));
  assert.equal("trajectory" in cleared.scene.objects[0]!, false);
  const undoClear = applyCommand(cleared.scene, cleared.inverse);
  assert.deepEqual(undoClear.scene.objects[0]?.trajectory, trajectory());
  const undoSet = applyCommand(set.scene, set.inverse);
  assert.equal("trajectory" in undoSet.scene.objects[0]!, false);
});

test("project serialization keeps the trajectory", async () => {
  const generator = {
    algorithm: "tone-v1" as const,
    durationSeconds: 1,
    sampleRateHz: 48000 as const,
    frequencyHz: 220,
  };
  const scene = createDefaultScene();
  scene.objects[0]!.trajectory = trajectory();
  const project = createProject({
    projectId: "project.trajectory",
    name: "Trajectory",
    scene,
    soundBehaviors: createDefaultBehaviors(scene),
    assets: [
      {
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
      },
    ],
  });
  const restored = deserializeProject(serializeProject(project));
  assert.deepEqual(restored.scene.objects[0]?.trajectory, trajectory());
});
