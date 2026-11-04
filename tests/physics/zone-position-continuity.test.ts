import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../../src/physics/index.js";
import { MotionWorkspace } from "../../src/motion/index.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import { toBehaviorFrame } from "../../src/app/physics-behavior.js";
import type { SceneSpec } from "../../src/scene/types.js";

function sceneFor(type: "OnEnterZone" | "OnExitZone"): SceneSpec {
  const scene = createDefaultScene(),
    ball = scene.objects.find((o) => o.id === "ball")!;
  scene.objects = [{ ...ball, mode: "kinematic", positionM: [0, 2, 0], acousticRole: "none" }];
  scene.sources = [];
  scene.zones = [
    {
      id: "zone.release",
      name: "Release boundary",
      enabled: true,
      shape: "aabb",
      centerM: [type === "OnEnterZone" ? 2.01 : 0.01, 2, 0],
      halfExtentsM: [1, 1, 1],
      hysteresisM: 0,
    },
  ];
  return scene;
}
for (const type of ["OnEnterZone", "OnExitZone"] as const)
  for (const releaseMode of ["dynamicGravity", "dynamicNoGravity"] as const) {
    test(
      "real Motion transfer release keeps " +
        type +
        " on the first " +
        releaseMode +
        " step without changing generic discontinuity",
      async () => {
        const scene = sceneFor(type),
          world = await PhysicsWorld.create(scene);
        const motion = await MotionWorkspace.create(scene, world, { getScene: () => scene });
        try {
          world.resume();
          world.step();
          world.step();
          world.pause();
          await motion.save(
            {
              actionId: "release.zone",
              objectId: "ball",
              kind: "moveAndRelease",
              targetPositionM: [1, 2, 0],
              positionToleranceM: 0.001,
              maxSpeedMps: 1,
              releasePolicy: "transfer",
              releaseMode,
            },
            0,
          );
          await motion.start("release.zone", "command.release");
          world.resume();
          const beforeEdges: string[] = [];
          for (let i = 0; i < 180 && motion.getView().activeRunIds.length; i++)
            beforeEdges.push(
              ...world
                .step()
                .events.filter((e) => e.source === "zone")
                .map((e) => e.type),
            );
          assert.equal(motion.getView().runs.at(-1)!.status, "reached");
          const released = world.getPose("ball");
          assert.equal(released.mode, releaseMode);
          assert.ok(released.positionMetres[0] < 1.01);
          assert.ok(released.linearVelocityMetresPerSecond[0] > 0.9);
          assert.deepEqual(beforeEdges, []);
          const next = world.step(),
            pose = next.poses.find((p) => p.objectId === "ball")!;
          assert.ok(pose.positionMetres[0] > 1.01);
          assert.equal(
            pose.discontinuity,
            true,
            "the public generic marker and Bounce contract must be unchanged",
          );
          const edges = next.events.filter((e) => e.source === "zone");
          assert.deepEqual(
            edges.map((e) => [e.type, e.zoneId]),
            [[type, "zone.release"]],
          );
          assert.deepEqual(edges[0]!.positionMetres, pose.positionMetres);
          assert.deepEqual(
            toBehaviorFrame(next, "epoch.release")
              .events.filter((e) => e.source === "zone")
              .map((e) => e.zoneId),
            ["zone.release"],
          );
          assert.equal(next.events.filter((e) => e.type === "OnBounce").length, 0);
        } finally {
          motion.dispose();
          world.dispose();
        }
      },
    );
  }
test("same-tick authoring teleport and multiple mode changes still baseline, rather than fabricate an enter", async () => {
  const scene = sceneFor("OnEnterZone");
  scene.objects[0]!.mode = "dynamicNoGravity";
  const world = await PhysicsWorld.create(scene);
  try {
    world.resume();
    world.step();
    world.step();
    world.pause();
    const teleported = structuredClone(scene);
    teleported.sceneRevision++;
    teleported.objects[0]!.positionM = [2, 2, 0];
    teleported.objects[0]!.mode = "kinematic";
    world.applyScene(teleported);
    world.setMode("ball", "dynamicNoGravity");
    world.resume();
    const next = world.step();
    assert.equal(next.poses[0]!.discontinuity, true);
    assert.ok(next.poses[0]!.positionMetres[0] > 1.01);
    assert.deepEqual(
      next.events.filter((e) => e.source === "zone"),
      [],
    );
    assert.deepEqual(
      world.step().events.filter((e) => e.source === "zone"),
      [],
    );
  } finally {
    world.dispose();
  }
});
