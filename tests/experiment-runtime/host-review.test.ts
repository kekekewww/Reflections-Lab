import test from "node:test";
import assert from "node:assert/strict";
import { RecordingHost } from "../../src/app/recording-host.js";
import type {
  ExperimentRecorderOptions,
  RecordingFrameInput,
} from "../../src/experiments/types.js";

test("review: a failed finalization can be discarded without losing the previous capture", async () => {
  const config: ExperimentRecorderOptions = {
    runId: "run.recovery",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
    physicsVersion: "rapier-0.21.0",
    backendVersion: "1.0.0",
    sceneSnapshot: {
      schemaVersion: "1.0.0",
      sceneId: "scene.recovery",
      sceneRevision: 0,
      units: "SI",
      coordinateSystem: "right-handed-y-up-minus-z-forward",
      seed: 1,
      gravityMps2: [0, -9.81, 0],
      objects: [],
      sources: [],
      listener: {
        id: "listener",
        positionM: [0, 1, 3],
        orientationQuaternion: [0, 0, 0, 1],
        attachment: "independent",
      },
    },
    sourceConfig: {},
    behaviorConfig: {},
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [],
  };
  const frame: RecordingFrameInput = {
    tick: 0,
    sceneRevision: 0,
    poses: [],
    listener: structuredClone(config.sceneSnapshot.listener),
    physicsEvents: [],
    audioEvents: [],
    behaviorDecisions: [],
  };
  const host = new RecordingHost({ getConfig: () => config });
  host.start();
  host.appendFrame(frame);
  const previous = await host.stop();
  config.solverConfig = { maxReflectionOrder: 1.5 };
  host.start();
  host.appendFrame(frame);
  await assert.rejects(() => host.stop(), { code: "SOLVER_SETTINGS" });
  assert.equal(host.getArtifact()!.artifactSha256, previous.artifactSha256);
  config.solverConfig = { maxReflectionOrder: 1 };
  await host.interrupt("discard failed recording");
  assert.equal(host.getArtifact()!.artifactSha256, previous.artifactSha256);
  assert.doesNotThrow(() => host.start());
});
