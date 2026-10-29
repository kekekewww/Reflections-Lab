import assert from "node:assert/strict";
import test from "node:test";
import { InteractionHost } from "../../src/interaction/index.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { applyCommand, createScene } from "../../src/scene/index.js";
import type { SceneObject, SceneOperation, SceneSpec, Vec3 } from "../../src/scene/types.js";

const object = (id: string, patch: Partial<SceneObject> = {}): SceneObject => ({
  id,
  shape: "sphere",
  dimensionsM: [0.2, 0.2, 0.2],
  positionM: [0, 1.6, 1],
  orientationQuaternion: [0, 0, 0, 1],
  mode: "dynamicNoGravity",
  massKg: 1,
  friction: 0.5,
  restitution: 0,
  physicsMaterialId: "test-physics",
  acousticMaterialId: "test-acoustic",
  acousticRole: "none",
  ...patch,
});

const neighbor = (positionM: Vec3): SceneObject =>
  object("neighbor", { shape: "box", mode: "fixed", positionM });

async function rig(extra: SceneObject[] = []) {
  let scene: SceneSpec = createScene({
    schemaVersion: "1.0.0",
    sceneId: "unlock-clearance",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 4,
    gravityMps2: [0, -9.81, 0],
    objects: [
      object("floor", {
        shape: "box",
        dimensionsM: [20, 0.2, 20],
        positionM: [0, -0.1, 0],
        mode: "fixed",
      }),
      object("ball"),
      ...extra,
    ],
    sources: [],
    listener: {
      id: "listener",
      positionM: [0, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
  const world = await PhysicsWorld.create(scene);
  const committedModes: string[] = [];
  let beforeCommit: (() => void | Promise<void>) | undefined;
  let afterCommit: (() => void | Promise<void>) | undefined;
  let guardCalls = 0;
  const applyExternal = (operations: SceneOperation[]) => {
    const candidate = applyCommand(scene, {
      expectedSceneRevision: scene.sceneRevision,
      operations,
    }).scene;
    world.applyScene(candidate);
    scene = candidate;
  };
  const host = new InteractionHost({
    getWorld: () => world,
    getScene: () => structuredClone(scene),
    commitSceneOperations: async (operations, guard) => {
      const expected = scene.sceneRevision;
      const candidate = applyCommand(scene, {
        expectedSceneRevision: expected,
        operations,
      }).scene;
      const before = beforeCommit;
      beforeCommit = undefined;
      await before?.();
      assert.equal(scene.sceneRevision, expected, "adapter CAS precedes its trusted guard");
      if (guard) {
        guardCalls++;
        guard();
      }
      // No asynchronous gap or observer mutation is permitted between guard and apply.
      world.applyScene(candidate);
      scene = candidate;
      for (const operation of operations)
        if (operation.type === "SetObjectMode") committedModes.push(operation.mode);
      const after = afterCommit;
      afterCommit = undefined;
      await after?.();
    },
  });
  const step = (count: number) => {
    for (let index = 0; index < count; index++) {
      host.beforeStep();
      world.step();
    }
  };
  host.enterFPS();
  host.setAlternativeInput(true);
  assert.equal(host.resume(), true);
  return {
    host,
    world,
    step,
    committedModes,
    getScene: () => scene,
    guardCalls: () => guardCalls,
    applyExternal,
    beforeCommit: (hook: () => void | Promise<void>) => {
      beforeCommit = hook;
    },
    afterCommit: (hook: () => void | Promise<void>) => {
      afterCommit = hook;
    },
    dispose: () => {
      host.dispose();
      world.dispose();
    },
  };
}

test("Unlock rejects real shape overlap before commit and retains Fixed, zero velocity and the exact gravity restore mode for retry", async () => {
  const r = await rig();
  try {
    assert.equal(await r.host.toggleFixed(), true);
    r.applyExternal([{ type: "AddObject", object: neighbor([0.15, 1.6, 1]) }]);
    assert.equal(r.host.snapshot().hover?.objectId, "ball");
    const revision = r.getScene().sceneRevision;
    assert.equal(await r.host.toggleFixed(), false);
    assert.equal(r.getScene().sceneRevision, revision);
    assert.deepEqual(r.committedModes, ["fixed"]);
    assert.equal(r.world.getPose("ball").mode, "fixed");
    assert.deepEqual(r.world.getPose("ball").linearVelocityMetresPerSecond, [0, 0, 0]);
    assert.equal(r.world.paused, true);
    assert.match(r.host.snapshot().notice ?? "", /解除固定位置受阻/);
    r.applyExternal([{ type: "RemoveObject", objectId: "neighbor" }]);
    assert.equal(await r.host.toggleFixed(), true);
    assert.deepEqual(r.committedModes, ["fixed", "dynamicNoGravity"]);
    assert.equal(r.world.getPose("ball").mode, "dynamicNoGravity");
    assert.deepEqual(r.world.getPose("ball").linearVelocityMetresPerSecond, [0, 0, 0]);
    assert.equal(r.world.paused, true);
  } finally {
    r.dispose();
  }
});

test("Unlock clearance uses the moved solver pose rather than the unchanged authoring transform", async () => {
  const r = await rig();
  try {
    assert.equal(r.host.grab(), true);
    r.host.handleLook(-120, 0);
    r.step(80);
    assert.equal(await r.host.toggleFixed(), true);
    const pose = r.world.getPose("ball");
    assert.ok(
      pose.positionMetres[0] < -0.3,
      "real held servo must move away from its authored pose",
    );
    r.applyExternal([
      {
        type: "AddObject",
        object: neighbor([
          pose.positionMetres[0] + 0.15,
          pose.positionMetres[1],
          pose.positionMetres[2],
        ]),
      },
    ]);
    const authored = r.getScene().objects.find((entry) => entry.id === "ball")!;
    assert.equal(r.world.validatePlacement(authored, "ball").valid, true);
    assert.equal(
      r.world.validatePlacement(
        { ...authored, positionM: pose.positionMetres, orientationQuaternion: pose.rotation },
        "ball",
      ).valid,
      false,
    );
    assert.equal(r.host.snapshot().hover?.objectId, "ball");
    assert.equal(await r.host.toggleFixed(), false);
    assert.deepEqual(r.world.getPose("ball").positionMetres, pose.positionMetres);
    assert.equal(r.world.getPose("ball").mode, "fixed");
    assert.deepEqual(r.committedModes, ["fixed"]);
  } finally {
    r.dispose();
  }
});

test("trusted atomic guard rejects occupancy that appears during awaited preparation without committing Dynamic or a compensating revision", async () => {
  const r = await rig([neighbor([2, 1.6, 1])]);
  try {
    assert.equal(await r.host.toggleFixed(), true);
    const revision = r.getScene().sceneRevision;
    r.beforeCommit(() => {
      // A runtime pose can change independently of its authoring transform.
      // This fixture injects that change during adapter preparation, before its
      // final guard, while keeping the document revision unchanged.
      r.world.applyScene({
        ...r.getScene(),
        objects: r
          .getScene()
          .objects.map((entry) =>
            entry.id === "neighbor" ? { ...entry, positionM: [0.15, 1.6, 1] } : entry,
          ),
      });
    });
    assert.equal(await r.host.toggleFixed(), false);
    assert.equal(r.guardCalls(), 1, "the adapter must execute the supplied guard at apply time");
    assert.equal(r.getScene().sceneRevision, revision);
    assert.deepEqual(r.committedModes, ["fixed"]);
    assert.equal(r.world.getPose("ball").mode, "fixed");
    assert.deepEqual(r.world.getPose("ball").linearVelocityMetresPerSecond, [0, 0, 0]);
    assert.equal(r.world.paused, true);
    assert.match(r.host.snapshot().notice ?? "", /解除固定位置受阻/);
    r.applyExternal([{ type: "RemoveObject", objectId: "neighbor" }]);
    assert.equal(
      await r.host.toggleFixed(),
      true,
      "a rejected boundary guard must retain the memento",
    );
    assert.equal(r.world.getPose("ball").mode, "dynamicNoGravity");
  } finally {
    r.dispose();
  }
});

test("a post-commit observer failure reports the safely committed mode without implying rollback", async () => {
  const r = await rig();
  try {
    assert.equal(await r.host.toggleFixed(), true);
    r.afterCommit(() => {
      throw new Error("injected acoustic observer failure");
    });
    assert.equal(await r.host.toggleFixed(), false);
    assert.equal(r.world.getPose("ball").mode, "dynamicNoGravity");
    assert.equal(
      r.getScene().objects.find((entry) => entry.id === "ball")?.mode,
      "dynamicNoGravity",
    );
    assert.equal(r.world.paused, true);
    assert.deepEqual(r.committedModes, ["fixed", "dynamicNoGravity"]);
    assert.match(r.host.snapshot().notice ?? "", /已解除固定.*後續同步失敗/);
  } finally {
    r.dispose();
  }
});

test("a later same-generation user mode edit is preserved instead of being compensated from an obsolete Unlock", async () => {
  const r = await rig();
  try {
    assert.equal(await r.host.toggleFixed(), true);
    const generation = r.world.getPose("ball").generation;
    r.afterCommit(() =>
      r.applyExternal([{ type: "SetObjectMode", objectId: "ball", mode: "dynamicGravity" }]),
    );
    assert.equal(await r.host.toggleFixed(), false);
    assert.equal(r.world.getPose("ball").generation, generation);
    assert.equal(r.world.getPose("ball").mode, "dynamicGravity");
    assert.equal(r.getScene().objects.find((entry) => entry.id === "ball")?.mode, "dynamicGravity");
    assert.deepEqual(r.committedModes, ["fixed", "dynamicNoGravity"]);
    assert.equal(r.world.paused, true);
    assert.match(r.host.snapshot().notice ?? "", /場景版本已變更/);
  } finally {
    r.dispose();
  }
});

test("a target removed during asynchronous preparation returns a conflict without throwing from failure inspection", async () => {
  const r = await rig();
  try {
    assert.equal(await r.host.toggleFixed(), true);
    r.beforeCommit(() => r.applyExternal([{ type: "RemoveObject", objectId: "ball" }]));
    assert.equal(await r.host.toggleFixed(), false);
    assert.equal(
      r.getScene().objects.some((entry) => entry.id === "ball"),
      false,
    );
    assert.deepEqual(r.committedModes, ["fixed"]);
    assert.equal(r.world.paused, true);
    assert.equal(r.host.snapshot().pending, false);
    assert.match(r.host.snapshot().notice ?? "", /模式交易失敗/);
  } finally {
    r.dispose();
  }
});
