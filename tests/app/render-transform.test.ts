import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import type { PhysicsWorld } from "../../src/physics/physics-world.js";
import type { BodyPose, PhysicsSnapshot } from "../../src/physics/types.js";
import type { Quaternion, Vec3 } from "../../src/scene/types.js";

type Pose = { positionM: Vec3; orientationQuaternion: Quaternion };
interface RuntimeSeam {
  world: PhysicsWorld & {
    interpolatedTransforms(
      alpha: number,
    ): Pick<BodyPose, "objectId" | "positionMetres" | "rotation">[];
  };
  latest: PhysicsSnapshot;
  alpha: number;
  replayPoses: Map<string, Pose>;
}
const seam = (app: LabRuntime) => app as unknown as RuntimeSeam;
function expectedPoses(app: LabRuntime): Map<string, Pose> {
  const internal = seam(app);
  return new Map(
    internal.world
      .interpolatedPoses(internal.alpha)
      .map((pose) => [
        pose.objectId,
        { positionM: [...pose.positionMetres], orientationQuaternion: [...pose.rotation] },
      ]),
  );
}
function compare(app: LabRuntime): void {
  const expected = expectedPoses(app);
  for (const [id, pose] of expected) assert.deepEqual(app.getPose(id), pose);
  assert.equal(app.getPose("missing.transform.id"), undefined);
}

test("runtime renderer reads use the narrow transform projection once per latest identity and alpha", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const internal = seam(app),
      world = internal.world;
    const narrow = world.interpolatedTransforms;
    const full = world.interpolatedPoses;
    assert.equal(typeof narrow, "function");
    let calls = 0;
    world.interpolatedTransforms = (alpha) => {
      calls++;
      return narrow.call(world, alpha);
    };
    const expected = expectedPoses(app);
    world.interpolatedPoses = () => {
      throw new Error("renderer called the full interpolation projection");
    };
    try {
      assert.deepEqual(app.getPose("ball"), expected.get("ball"));
      for (const [id, pose] of expected) assert.deepEqual(app.getPose(id), pose);
      assert.equal(app.getPose("missing.transform.id"), undefined);
      assert.equal(calls, 1);
      const copy = app.getPose("ball")!;
      copy.positionM[0] = 999;
      copy.orientationQuaternion[0] = 999;
      assert.deepEqual(app.getPose("ball"), expected.get("ball"));
      assert.equal(calls, 1);
    } finally {
      world.interpolatedPoses = full;
    }
    await app.dispatch({ type: "run" });
    app.advance(0);
    app.getPose("ball");
    const latest = internal.latest,
      alpha = internal.alpha,
      before = calls;
    app.advance(0);
    assert.notEqual(
      internal.latest,
      latest,
      "zero-step world advance still provides a fresh snapshot identity",
    );
    assert.equal(internal.alpha, alpha);
    compare(app);
    assert.equal(calls, before + 1);
    const next = calls;
    internal.alpha = 0.5;
    compare(app);
    assert.equal(calls, next + 1, "alpha alone invalidates the same cache");
    world.interpolatedTransforms = narrow;
  } finally {
    app.dispose();
  }
});

test("runtime transform output stays current after movement, commands, undo, reset and same-revision import", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    compare(app);
    const retained = app.getPose("ball")!,
      copy = structuredClone(retained);
    await app.dispatch({ type: "run" });
    app.advance(1 / 40);
    compare(app);
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "patchObject", objectId: "ball", patch: { positionM: [1, 2, 0] } });
    assert.equal(app.getSnapshot().error, "");
    compare(app);
    await app.dispatch({ type: "undo" });
    compare(app);
    await app.dispatch({ type: "reset" });
    compare(app);
    const project = JSON.parse(app.exportProject());
    const revision = project.scene.sceneRevision;
    project.scene.objects.find((row: { id: string }) => row.id === "ball").positionM = [2, 3, 0];
    await app.importProject(JSON.stringify(project));
    assert.equal(app.getSceneDocument().sceneRevision, revision);
    compare(app);
    assert.deepEqual(app.getPose("ball")!.positionM, [2, 3, 0]);
    assert.deepEqual(retained, copy);
  } finally {
    app.dispose();
  }
});

test("recorded replay poses retain priority and detached return ownership without reading the live narrow getter", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "recordToggle" });
    for (let step = 0; step < 4; step++) {
      app.advance(1 / 60);
      await new Promise(setImmediate);
    }
    await app.dispatch({ type: "recordToggle" });
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "replay" });
    app.advance(1 / 60);
    const internal = seam(app),
      expected = structuredClone(internal.replayPoses.get("ball"));
    assert.ok(expected, "real recorded replay must populate the authoritative pose map");
    const narrow = internal.world.interpolatedTransforms;
    internal.world.interpolatedTransforms = () => {
      throw new Error("replay pose fell through to live physics");
    };
    try {
      const returned = app.getPose("ball")!;
      assert.deepEqual(returned, expected);
      returned.positionM[0] = 999;
      returned.orientationQuaternion[0] = 999;
      assert.deepEqual(app.getPose("ball"), expected);
      assert.deepEqual(internal.replayPoses.get("ball"), expected);
    } finally {
      internal.world.interpolatedTransforms = narrow;
    }
  } finally {
    app.dispose();
  }
});
