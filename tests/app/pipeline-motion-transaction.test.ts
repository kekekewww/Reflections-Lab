import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import type { AgentHost } from "../../src/ai/host.js";
import type { PlannerProvenance, ToolRequest } from "../../src/ai/types.js";
import type { AcousticService } from "../../src/app/acoustic-service.js";
import type { AcousticSolution } from "../../src/acoustics/types.js";
import type { PhysicsWorld } from "../../src/physics/index.js";
import type { SceneSpec } from "../../src/scene/types.js";

const provenance: PlannerProvenance = {
  provider: "offlineDeterministic",
  modelId: null,
  requestId: null,
  label: "OFFLINE_DETERMINISTIC",
};

// Access only trusted composition seams: the real AgentHost, world and transport
// still execute. The deferred transport makes the public notification race deterministic.
function seams(app: LabRuntime) {
  return app as unknown as {
    world: PhysicsWorld;
    acoustics: Pick<AcousticService, "solve">;
  };
}
function host(app: LabRuntime): AgentHost {
  return (app.getAgentSession() as unknown as { sceneHost: AgentHost }).sceneHost;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitUntil(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 300 && !check(); attempt++)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(check(), true, "the transaction must reach the held transport boundary");
}
function trajectory(scene: SceneSpec): ToolRequest {
  const ball = scene.objects.find((object) => object.id === "ball")!;
  return {
    schemaVersion: "1.0.0",
    requestId: "request.review-trajectory",
    transactionId: "transaction.review-motion",
    tool: "SetTrajectory",
    sceneId: scene.sceneId,
    expectedSceneRevision: scene.sceneRevision,
    arguments: {
      objectId: ball.id,
      interpolation: "linearSlerp",
      samples: [
        {
          timeS: 0,
          positionM: [...ball.positionM],
          orientationQuaternion: [...ball.orientationQuaternion],
        },
        {
          timeS: 1,
          positionM: [ball.positionM[0] + 0.1, ball.positionM[1], ball.positionM[2]],
          orientationQuaternion: [...ball.orientationQuaternion],
        },
      ],
    },
  };
}
function setKinematic(scene: SceneSpec): ToolRequest {
  return {
    ...trajectory(scene),
    requestId: "request.review-mode",
    tool: "SetRigidBodyMode",
    arguments: { objectId: "ball", mode: "kinematic", velocityPolicy: "zero" },
  };
}

test(
  "mixed Scene/Motion Apply publishes no half-state while a real commit awaits acoustic transport",
  { timeout: 10000 },
  async () => {
    const app = await LabRuntime.create({ useWorker: false });
    const runtime = seams(app);
    const gate = deferred<AcousticSolution[]>();
    const originalSolve = runtime.acoustics.solve;
    let pending: Promise<SceneSpec> | undefined;
    const observations: { scene: number; motion: number }[] = [];
    let unsubscribe = () => {};
    try {
      await app.dispatch({ type: "reset" });
      const scene = app.getSceneDocument();
      const generation = runtime.world.getPose("ball").generation;
      assert.ok(generation > 1, "reset must exercise retained body-generation history");
      const agent = host(app);
      const preview = await agent.stage([setKinematic(scene), trajectory(scene)], provenance);
      unsubscribe = app.subscribe(() =>
        observations.push({
          scene: app.getSceneDocument().sceneRevision,
          motion: app.getMotionWorkspace().getSnapshot().scenePin.sceneRevision,
        }),
      );
      runtime.acoustics.solve = () => gate.promise;
      pending = agent.apply(preview.previewId, preview.digest);
      await waitUntil(() => app.getSceneDocument().sceneRevision === scene.sceneRevision + 1);
      // This is the ordinary RAF path, not a direct call to the publication guard.
      app.advance(0);
      assert.equal(observations.filter((value) => value.scene !== value.motion).length, 0);
      gate.resolve([]);
      await pending;
      const registry = app.getMotionWorkspace().getSnapshot();
      assert.equal(registry.scenePin.sceneRevision, app.getSceneDocument().sceneRevision);
      assert.equal(registry.actions[0]!.generation, generation);
      const receipt = await app
        .getMotionWorkspace()
        .start("trajectory.ball", "command.review-start");
      assert.equal(receipt.generation, generation);
      assert.equal(observations.filter((value) => value.scene !== value.motion).length, 0);
    } finally {
      gate.resolve([]);
      await pending?.catch(() => {});
      runtime.acoustics.solve = originalSolve;
      unsubscribe();
      app.dispose();
    }
  },
);

test(
  "pure Motion Apply and AI Undo advance the sidecar without dummy Scene revisions",
  { timeout: 10000 },
  async () => {
    const app = await LabRuntime.create({ useWorker: false });
    try {
      await app.dispatch({ type: "patchObject", objectId: "ball", patch: { mode: "kinematic" } });
      await app.dispatch({
        type: "motionRebase",
        expectedRevision: app.getMotionWorkspace().getSnapshot().revision,
      });
      const scene = app.getSceneDocument();
      assert.equal(scene.objects.find((object) => object.id === "ball")!.mode, "kinematic");
      const agent = host(app);
      const before = app.getMotionWorkspace().getSnapshot();
      const preview = await agent.stage([trajectory(scene)], provenance);
      assert.equal(preview.sceneRevisionDelta, 0);
      await agent.apply(preview.previewId, preview.digest);
      assert.deepEqual(app.getSceneDocument(), scene);
      assert.equal(app.getMotionWorkspace().getSnapshot().revision, before.revision + 1);
      assert.equal(app.getMotionWorkspace().getSnapshot().actions.length, 1);
      await agent.undo(preview.previewId);
      assert.deepEqual(app.getSceneDocument(), scene);
      const restored = app.getMotionWorkspace().getSnapshot();
      assert.equal(restored.revision, before.revision + 2);
      assert.deepEqual(restored.actions, before.actions);
      assert.equal(restored.scenePin.sceneRevision, scene.sceneRevision);
    } finally {
      app.dispose();
    }
  },
);

test(
  "body-generation changes after preview reject mixed Apply before either authored document commits",
  { timeout: 10000 },
  async () => {
    const app = await LabRuntime.create({ useWorker: false });
    try {
      const scene = app.getSceneDocument();
      const motion = app.getMotionWorkspace().getSnapshot();
      const agent = host(app);
      const preview = await agent.stage([setKinematic(scene), trajectory(scene)], provenance);
      // A real engine reset invalidates the approved identity while preserving Scene bytes.
      seams(app).world.reset(scene);
      await assert.rejects(agent.apply(preview.previewId, preview.digest), {
        code: "MOTION_GENERATION_CONFLICT",
      });
      assert.deepEqual(app.getSceneDocument(), scene);
      assert.deepEqual(app.getMotionWorkspace().getSnapshot(), motion);
      assert.equal(seams(app).world.getPose("ball").mode, "dynamicGravity");
    } finally {
      app.dispose();
    }
  },
);

test(
  "mixed geometry/Motion Undo restores authoring while projecting the actual rebuilt body generation",
  { timeout: 10000 },
  async () => {
    const app = await LabRuntime.create({ useWorker: false });
    try {
      await app.dispatch({ type: "patchObject", objectId: "ball", patch: { mode: "kinematic" } });
      await app.dispatch({
        type: "motionRebase",
        expectedRevision: app.getMotionWorkspace().getSnapshot().revision,
      });
      await app.dispatch({
        type: "motionSave",
        expectedRevision: app.getMotionWorkspace().getSnapshot().revision,
        input: {
          actionId: "motion.original",
          objectId: "ball",
          kind: "moveTo",
          targetPositionM: [0, 2, 0],
        },
      });
      const hooks = (
        app as unknown as {
          motionTransactionHooks(): import("../../src/ai/scene-adapter.js").MotionTransactionHooks;
        }
      ).motionTransactionHooks();
      const beforeScene = app.getSceneDocument();
      const before = hooks.getSnapshot();
      const oldGeneration = seams(app).world.getPose("ball").generation;
      const candidateScene = structuredClone(beforeScene);
      candidateScene.sceneRevision++;
      const ball = candidateScene.objects.find((object) => object.id === "ball")!;
      ball.dimensionsM = ball.dimensionsM.map((value) => value * 1.1) as [number, number, number];
      const preview = await hooks.preview([trajectory(candidateScene)], candidateScene);
      await hooks.commit({
        scene: candidateScene,
        expectedSceneRevision: beforeScene.sceneRevision,
        transactionId: "transaction.review-geometry",
        requests: [],
        before,
        candidate: preview.candidate,
      });
      const applied = hooks.getSnapshot();
      assert.equal(seams(app).world.getPose("ball").generation, oldGeneration + 1);
      const undoScene = structuredClone(beforeScene);
      undoScene.sceneRevision = candidateScene.sceneRevision + 1;
      const restore = structuredClone(before);
      restore.revision = applied.revision + 1;
      const document =
        restore.document as import("../../src/motion/types.js").MotionRegistryDocument;
      document.revision = restore.revision;
      document.scenePin = await (
        await import("../../src/motion/registry.js")
      ).pinMotionScene(undoScene);
      const projected = await hooks.prepareRestore!(restore, undoScene);
      const projectedDocument =
        projected.document as import("../../src/motion/types.js").MotionRegistryDocument;
      assert.equal(projectedDocument.actions[0]!.generation, oldGeneration + 2);
      await hooks.restore({
        scene: undoScene,
        expectedSceneRevision: candidateScene.sceneRevision,
        transactionId: "transaction.review-geometry.undo",
        expectedCurrent: applied,
        restore: projected,
      });
      assert.deepEqual(app.getSceneDocument(), undoScene);
      const restored = app.getMotionWorkspace().getSnapshot();
      assert.equal(restored.actions.length, 1);
      assert.equal(restored.actions[0]!.actionId, "motion.original");
      assert.equal(restored.actions[0]!.generation, seams(app).world.getPose("ball").generation);
      assert.deepEqual(restored.actions[0]!.targetPositionM, [0, 2, 0]);
      await app.getMotionWorkspace().start("motion.original", "command.review-restored");
    } finally {
      app.dispose();
    }
  },
);
