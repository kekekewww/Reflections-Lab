import test from "node:test";
import assert from "node:assert/strict";
import { ExperimentToolHost } from "../../src/app/experiment-tools.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import type { ToolRequest } from "../../src/ai/types.js";
import { digestJson } from "../../src/ai/validation.js";
import { SOLVER_VERSION } from "../../src/acoustics/index.js";
import { canonicalStringify, verifyRecording } from "../../src/experiments/index.js";
import type { ExperimentRecorderOptions, RecordingArtifact } from "../../src/experiments/types.js";
import { MotionWorkspace, type MotionRegistryDocument } from "../../src/motion/index.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type { ExperimentMotionExecution } from "../../src/app/motion-experiment.js";

function configuration(
  scene: SceneSpec,
  registry?: MotionRegistryDocument,
): ExperimentRecorderOptions {
  const behavior = createDefaultBehaviors(scene);
  return {
    runId: "run.motion-host",
    runEpoch: "epoch.motion-host",
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: behavior,
    solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
    atmosphere: {
      medium: "air",
      speedOfSoundMps: 343,
      temperatureC: 20,
      bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
      dataClass: "Synthetic",
    },
    materialRegistry: DEFAULT_MATERIALS,
    assetManifest: [],
    ...(registry ? { physicsConfig: { motionRegistry: registry } } : {}),
    physicsVersion: "rapier-0.21.0",
    backendId: "custom-web-geometric",
    backendVersion: SOLVER_VERSION,
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}
function request(id: string, scene: SceneSpec, replayTraceId: string | null = null): ToolRequest {
  return {
    schemaVersion: "1.0.0",
    requestId: id,
    tool: "RunSimulation",
    sceneId: scene.sceneId,
    expectedSceneRevision: scene.sceneRevision,
    transactionId: null,
    arguments: {
      backendId: "custom-web",
      durationS: 0.2,
      timeStepS: 1 / 60,
      seed: 999,
      replayTraceId,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    },
  };
}
async function authored(kind: "trajectory" | "impulse", reset = false) {
  const scene = createDefaultScene();
  const body = scene.objects.find((object) => object.id === "ball")!;
  body.mode = kind === "trajectory" ? "kinematic" : "dynamicNoGravity";
  const world = await PhysicsWorld.create(scene);
  const motion = await MotionWorkspace.create(scene, world, { getScene: () => scene });
  try {
    if (reset) world.reset();
    if (kind === "trajectory") {
      const before = motion.getSnapshot();
      const staged = await motion.previewTrajectories(
        [
          {
            requestId: "request.author-trajectory",
            arguments: {
              objectId: "ball",
              interpolation: "linearSlerp",
              samples: [
                {
                  timeS: 0,
                  positionM: body.positionM,
                  orientationQuaternion: body.orientationQuaternion,
                },
                {
                  timeS: 0.2,
                  positionM: [body.positionM[0] + 0.2, body.positionM[1], body.positionM[2]],
                  orientationQuaternion: body.orientationQuaternion,
                },
              ],
            },
          },
        ],
        scene,
      );
      await motion.withExternalTransaction(staged.candidate, before, scene, () => scene);
    } else {
      await motion.save(
        {
          actionId: "motion.ball-impulse",
          objectId: "ball",
          kind: "impulse",
          impulseNs: [1, 0, 0],
        },
        0,
      );
    }
    return { scene, registry: motion.getSnapshot() };
  } finally {
    motion.dispose();
    world.dispose();
  }
}
function position(recording: RecordingArtifact, frame: number) {
  return recording.frames[frame]!.poses.find((pose) => pose.objectId === "ball")!.positionM;
}

test("authored AI trajectory runs through actual fixed steps and records exact source/runtime lineage", async () => {
  const { scene, registry } = await authored("trajectory");
  const config = configuration(scene, registry),
    before = canonicalStringify(config);
  const host = new ExperimentToolHost({ getConfiguration: () => config, getAssets: () => [] });
  const result = await host.execute(request("request.motion-trajectory", scene));
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const recording = host.getRun(result.runId!)!;
  assert.equal(recording.frameCount, 13);
  assert.equal(recording.startTick, 0);
  assert.equal(recording.endTick, 12);
  const initialPosition = scene.objects.find((body) => body.id === "ball")!.positionM;
  assert.ok(
    position(recording, 0).every((value, axis) => Math.abs(value - initialPosition[axis]!) < 1e-6),
  );
  assert.ok(position(recording, 12)[0] - position(recording, 0)[0] > 0.15);
  assert.ok(recording.frames[0]!.audioEvents.length > 0, "tick0 AlwaysOn emission stays intact");
  const physics = recording.configuration
    .physicsConfig as ExperimentMotionExecution["physicsConfig"];
  assert.deepEqual(physics.motionExecution.sourceRegistry, registry);
  assert.equal(physics.motionExecution.sourceRegistrySha256, await digestJson(registry));
  assert.equal(
    physics.motionExecution.runtimeRegistrySha256,
    await digestJson(physics.motionRegistry),
  );
  assert.notEqual(
    physics.motionRegistry.scenePin.sceneHash,
    registry.scenePin.sceneHash,
    "requested seed is a recorded runtime rebind",
  );
  assert.equal(canonicalStringify(config), before);
  await verifyRecording(recording);

  // A replay must retain the captured pose trace even if current authoring is stale.
  config.physicsConfig = {
    motionRegistry: {
      ...registry,
      scenePin: { ...registry.scenePin, sceneHash: "sha256:" + "0".repeat(64) },
    },
  };
  const replay = await host.execute(request("request.motion-replay", scene, recording.runId));
  assert.equal(replay.state, "succeeded", JSON.stringify(replay.error));
  const candidate = host.getRun(replay.runId!)!;
  assert.deepEqual(
    candidate.frames.map((frame) => frame.poses),
    recording.frames.map((frame) => frame.poses),
  );
  assert.deepEqual(candidate.configuration.physicsConfig, recording.configuration.physicsConfig);
  await verifyRecording(candidate);
});

test("finite impulse after author world reset rebinds the new run generation and changes recorded pose", async () => {
  const { scene, registry } = await authored("impulse", true);
  assert.equal(registry.actions[0]!.generation, 2);
  const host = new ExperimentToolHost({
    getConfiguration: () => configuration(scene, registry),
    getAssets: () => [],
  });
  const result = await host.execute(request("request.motion-impulse", scene));
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const recording = host.getRun(result.runId!)!;
  assert.ok(position(recording, 12)[0] > position(recording, 0)[0] + 0.05);
  const physics = recording.configuration
    .physicsConfig as ExperimentMotionExecution["physicsConfig"];
  assert.deepEqual(physics.motionExecution.generationBindings, [
    {
      actionId: registry.actions[0]!.actionId,
      objectId: "ball",
      authorGeneration: 2,
      runtimeGeneration: 1,
    },
  ]);
  assert.equal(physics.motionRegistry.actions[0]!.generation, 1);
  assert.equal(registry.actions[0]!.generation, 2);
  await verifyRecording(recording);
});

for (const invalid of [
  "stale-pin",
  "duplicate-body",
  "unknown-json-field",
  "nonfinite-json",
] as const) {
  test(`invalid motion ${invalid} is rejected before any recording is published`, async () => {
    const { scene, registry } = await authored("impulse");
    if (invalid === "stale-pin") registry.scenePin.sceneHash = "sha256:" + "0".repeat(64);
    else if (invalid === "duplicate-body")
      registry.actions.push({ ...registry.actions[0]!, actionId: "motion.second" });
    else if (invalid === "nonfinite-json") registry.actions[0]!.impulseNs![0] = Infinity;
    else Object.assign(registry.actions[0]!, { unknownField: true });
    const host = new ExperimentToolHost({
      getConfiguration: () => configuration(scene, registry),
      getAssets: () => [],
    });
    const result = await host.execute(request("request.motion-" + invalid, scene));
    assert.equal(result.state, "failed");
    assert.equal(result.error?.code, "DOMAIN_INVALID");
    assert.equal(result.usage.solverSteps, 0);
    assert.equal(result.artifactIds.length, 0);
    assert.equal(host.getRuns().length, 0);
  });
}

for (const end of ["cancel", "timeout"] as const) {
  test(`${end} disposes motion before its isolated world and publishes no partial run`, async (t) => {
    const { scene, registry } = await authored("trajectory");
    const order: string[] = [];
    const disposeMotion = MotionWorkspace.prototype.dispose;
    const disposeWorld = PhysicsWorld.prototype.dispose;
    t.mock.method(MotionWorkspace.prototype, "dispose", function (this: MotionWorkspace) {
      disposeMotion.call(this);
      assert.equal(this.getView().activeRunIds.length, 0);
      order.push("motion");
    });
    t.mock.method(PhysicsWorld.prototype, "dispose", function (this: PhysicsWorld) {
      order.push("world");
      disposeWorld.call(this);
    });
    let now = 0;
    const host = new ExperimentToolHost({
      getConfiguration: () => configuration(scene, registry),
      getAssets: () => [],
      now: () => now,
      limits: { yieldEverySteps: 1, wallTimeMs: 1 },
      yieldControl: async () => {
        if (end === "cancel") assert.equal(host.cancel(), true);
        else now = 2;
      },
    });
    const result = await host.execute(request("request.motion-" + end, scene));
    assert.equal(
      result.state,
      end === "cancel" ? "canceled" : "timedOut",
      JSON.stringify(result.error),
    );
    assert.equal(result.usage.solverSteps, 1);
    assert.deepEqual(order, ["motion", "world"]);
    assert.equal(host.getRuns().length, 0);
    assert.equal(result.artifactIds.length, 0);
  });
}
