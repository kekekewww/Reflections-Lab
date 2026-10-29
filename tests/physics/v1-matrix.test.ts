import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import type RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld } from "../../src/physics/index.js";
import { LabRuntime } from "../../src/app/runtime.js";
import { InteractionHost } from "../../src/interaction/index.js";
import { applyCommand } from "../../src/scene/index.js";
import type { PhysicsSnapshot } from "../../src/physics/types.js";
import type {
  BodyMode,
  SceneObject,
  SceneOperation,
  SceneSpec,
  Vec3,
} from "../../src/scene/types.js";

const measurements: Record<string, unknown>[] = [];
const norm = (value: readonly number[]) => Math.hypot(...value);
const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

function object(id: string, patch: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    shape: "sphere",
    dimensionsM: [0.2, 0.2, 0.2],
    positionM: [0, 1, 0],
    orientationQuaternion: [0, 0, 0, 1],
    mode: "dynamicGravity",
    massKg: 1,
    friction: 0.5,
    restitution: 0,
    physicsMaterialId: "physics-test",
    acousticMaterialId: "acoustic-test",
    acousticRole: "none",
    ...patch,
  };
}

function scene(objects: SceneObject[]): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "v1-physics-matrix",
    sceneRevision: 7,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 314159,
    gravityMps2: [0, -9.81, 0],
    objects,
    sources: [],
    listener: {
      id: "listener.matrix",
      positionM: [0, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}

function floor(): SceneObject {
  return object("floor", {
    shape: "box",
    dimensionsM: [8, 0.2, 8],
    positionM: [0, -0.1, 0],
    mode: "fixed",
  });
}

function deterministicScene(): SceneSpec {
  return scene([
    floor(),
    object("falling", { positionM: [-1, 2, 0], restitution: 0.4 }),
    object("held", { mode: "dynamicNoGravity", positionM: [0, 1, 0], massKg: 5 }),
    object("driven", { mode: "kinematic", positionM: [2, 1, 0] }),
    object("locked", { mode: "fixed", positionM: [3, 2, 0] }),
  ]);
}

function applyIntent(world: PhysicsWorld, tick: number): void {
  if (tick === 1) world.setVelocity("held", [0.2, 0, 0]);
  if (tick === 10) world.grab("held", world.getPose("held").positionMetres, "grab.trace");
  if (tick > 10 && tick < 30) world.updateGrabTarget([0.3, 1, 0]);
  if (tick === 30) world.drop("drop.trace");
  if (tick === 40) world.applyImpulse("held", [0.5, 0.2, 0]);
  if (tick === 60) world.setMode("held", "dynamicGravity");
  if (tick === 90) world.setMode("held", "dynamicNoGravity");
  world.setKinematicTarget("driven", [2 + tick / 600, 1, 0]);
}

async function runPinnedTrace(): Promise<{ initial: PhysicsSnapshot; trace: PhysicsSnapshot[] }> {
  const world = await PhysicsWorld.create(deterministicScene());
  try {
    assert.equal(world.fixedDtSeconds, 1 / 60);
    const initial = world.snapshot();
    const trace: PhysicsSnapshot[] = [];
    world.resume();
    for (let tick = 1; tick <= 120; tick++) {
      applyIntent(world, tick);
      trace.push(world.step());
    }
    return { initial, trace };
  } finally {
    world.dispose();
  }
}

test("pinned real Rapier resimulation produces the same 120 per-tick state hashes twice on this machine", async () => {
  const initial = deterministicScene();
  const firstRun = await runPinnedTrace();
  const secondRun = await runPinnedTrace();
  assert.deepEqual(firstRun.initial, secondRun.initial);
  const first = firstRun.trace;
  const second = secondRun.trace;
  const hashesA = first.map(digest),
    hashesB = second.map(digest);
  assert.equal(first.length, 120);
  assert.deepEqual(hashesA, hashesB);
  assert.deepEqual(first, second);
  assert.ok(first.some((snapshot) => snapshot.events.some((event) => event.type === "OnImpact")));
  assert.ok(first.some((snapshot) => snapshot.heldObjectId === "held"));
  assert.equal(first[119]!.tick, 120);
  measurements.push({
    requirement: "V1-RPL-03",
    method:
      "two distinct real PhysicsWorld constructions; same scene, ordered tick intents, Rapier build, seed and dt",
    initialSceneSha256: digest(initial),
    initialPhysicsSnapshotSha256A: digest(firstRun.initial),
    initialPhysicsSnapshotSha256B: digest(secondRun.initial),
    ticks: 120,
    stateHashesA: hashesA,
    stateHashesB: hashesB,
    exactMatch: true,
    maximumObservedStateError: 0,
    limitation:
      "same Node/WASM runtime on this machine only; not a cross-platform determinism claim",
  });
});

test("30/60/144 Hz rendering has identical real fixed-step states and interpolation does not mutate the solver", async () => {
  const results: { cadenceHz: number; hashes: string[]; ticks: number }[] = [];
  for (const cadenceHz of [30, 60, 144]) {
    const world = await PhysicsWorld.create(deterministicScene());
    try {
      const hashes: string[] = [];
      world.resume();
      // No per-render input: this isolates the fixed-step clock rather than changing intent timing.
      for (let frame = 0; frame < cadenceHz * 2; frame++) {
        const result = world.advance(1 / cadenceHz, (snapshot) =>
          hashes.push(digest(snapshot.poses)),
        );
        assert.ok(result.steps <= 4);
        assert.equal(result.overrun, false);
        const before = world.snapshot();
        world.interpolatedPoses(result.alpha);
        assert.deepEqual(world.snapshot(), before);
      }
      assert.equal(world.tick, 120);
      results.push({ cadenceHz, hashes, ticks: world.tick });
    } finally {
      world.dispose();
    }
  }
  assert.deepEqual(results[0]!.hashes, results[1]!.hashes);
  assert.deepEqual(results[1]!.hashes, results[2]!.hashes);
  measurements.push({ requirement: "V1-PHY-01", results, exactStateHashMatch: true });
});

test("ten real app reset/export/import roundtrips rebase serialized generation pins without mutating live authoring", async () => {
  const runtime = await LabRuntime.create({ useWorker: false });
  try {
    const cycles: {
      cycle: number;
      liveGenerations: number[];
      persistedGenerations: number[];
      importedGenerations: number[];
    }[] = [];
    for (let cycle = 0; cycle < 10; cycle++) {
      await runtime.dispatch({ type: "run" });
      runtime.advance(1 / 60);
      await runtime.dispatch({ type: "pause" });
      await runtime.dispatch({ type: "reset" });
      assert.equal(runtime.getSnapshot().tick, 0);
      const beforeDocument = runtime.getBehaviorDocument();
      const sceneBefore = runtime.getSceneDocument();
      const text = runtime.exportProject();
      assert.deepEqual(
        runtime.getBehaviorDocument(),
        beforeDocument,
        "persistence must not rewrite the live WASM generation pins",
      );
      const persisted = JSON.parse(text) as {
        soundBehaviors: { bindings: { objectGeneration: number }[] };
      };
      const liveGenerations = beforeDocument.bindings.map((binding) => binding.objectGeneration);
      assert.ok(
        liveGenerations.every((generation) => generation >= 2),
        "fixture must exercise post-reset runtime generations",
      );
      assert.ok(
        persisted.soundBehaviors.bindings.every((binding) => binding.objectGeneration === 1),
        "a portable new-world project pins a newly constructed generation, not old WASM lifetime identity",
      );
      await runtime.importProject(text);
      assert.deepEqual(runtime.getSceneDocument(), sceneBefore);
      assert.equal(runtime.getSnapshot().tick, 0);
      assert.equal(runtime.getSnapshot().error, "");
      const importedGenerations = runtime
        .getBehaviorDocument()
        .bindings.map((binding) => binding.objectGeneration);
      assert.ok(importedGenerations.every((generation) => generation === 1));
      cycles.push({
        cycle,
        liveGenerations,
        persistedGenerations: persisted.soundBehaviors.bindings.map(
          (binding) => binding.objectGeneration,
        ),
        importedGenerations,
      });
    }
    measurements.push({
      requirement: "V1-SCN-03",
      method:
        "real LabRuntime reset/export/import; portable pins do not alter live document; all ten roundtrips keep canonical Scene metadata",
      cycles,
    });
  } finally {
    runtime.dispose();
  }
});

test("actual Host KeyF remembers NoGravity, zeros Lock/Unlock velocities and cannot unlock a target through a wall", async () => {
  let document = scene([
    floor(),
    object("inertial", { mode: "dynamicNoGravity", positionM: [0, 1.6, 1] }),
  ]);
  const world = await PhysicsWorld.create(document);
  let commits = 0;
  const commit = async (operations: SceneOperation[]) => {
    const candidate = applyCommand(document, {
      expectedSceneRevision: document.sceneRevision,
      operations,
    }).scene;
    world.applyScene(candidate);
    document = candidate;
    commits++;
  };
  const host = new InteractionHost({
    getWorld: () => world,
    getScene: () => structuredClone(document),
    commitSceneOperations: commit,
  });
  const pressF = async () => {
    host.handleKey("KeyF", true);
    for (let attempt = 0; attempt < 10 && host.snapshot().pending; attempt++)
      await Promise.resolve();
    assert.equal(host.snapshot().pending, false, "bounded mode transaction must finish");
    host.handleKey("KeyF", false);
  };
  try {
    assert.equal(host.enterFPS({ pointerLocked: true }), true);
    assert.equal(host.resume(), true);
    assert.equal(host.grab(), true);
    const generation = world.getPose("inertial").generation;
    world.setVelocity("inertial", [0.2, 0.1, 0.3], [0.1, 0.2, 0.3]);
    await pressF();
    const locked = world.getPose("inertial");
    assert.equal(locked.mode, "fixed");
    assert.equal(world.heldObjectId, null);
    assert.equal(world.paused, true);
    assert.deepEqual(locked.linearVelocityMetresPerSecond, [0, 0, 0]);
    assert.deepEqual(locked.angularVelocityRadiansPerSecond, [0, 0, 0]);
    host.setAlternativeInput(true);
    assert.equal(host.resume(), true);
    await pressF();
    const unlocked = world.getPose("inertial");
    assert.equal(
      unlocked.mode,
      "dynamicNoGravity",
      "the actual interaction host restores its saved prior mode, not a caller-supplied guessed mode",
    );
    assert.equal(unlocked.generation, generation);
    assert.equal(world.paused, true, "Unlock must not auto-resume");
    assert.deepEqual(unlocked.positionMetres, locked.positionMetres);
    assert.deepEqual(unlocked.linearVelocityMetresPerSecond, [0, 0, 0]);
    assert.deepEqual(unlocked.angularVelocityRadiansPerSecond, [0, 0, 0]);
    assert.equal(host.resume(), true);
    await pressF();
    assert.equal(world.getPose("inertial").mode, "fixed");
    await commit([
      {
        type: "AddObject",
        object: object("front-wall", {
          shape: "box",
          dimensionsM: [1, 2, 0.02],
          positionM: [0, 1.6, 2],
          mode: "fixed",
        }),
      },
    ]);
    const beforeBlockedRevision = document.sceneRevision,
      beforeBlockedCommits = commits;
    assert.equal(
      world.raycast(host.snapshot().camera.positionM, [0, 0, -1], 3)?.objectId,
      "front-wall",
    );
    assert.equal(host.resume(), true);
    await pressF();
    const blockedNotice = host.snapshot().notice;
    assert.equal(document.sceneRevision, beforeBlockedRevision);
    assert.equal(commits, beforeBlockedCommits);
    assert.equal(
      world.getPose("inertial").mode,
      "fixed",
      "KeyF must not operate on the remembered target through the first blocking shape",
    );
    assert.match(blockedNotice ?? "", /先前重力模式/);
    host.pausePreservingInputMode("remove test obstacle while paused");
    await commit([{ type: "RemoveObject", objectId: "front-wall" }]);
    assert.equal(host.resume(), true);
    await pressF();
    assert.equal(world.getPose("inertial").mode, "dynamicNoGravity");
    assert.deepEqual(world.getPose("inertial").linearVelocityMetresPerSecond, [0, 0, 0]);
    assert.equal(host.resume(), true);
    for (let tick = 0; tick < 20; tick++) {
      host.beforeStep();
      world.step();
    }
    assert.ok(
      Math.abs(world.getPose("inertial").positionMetres[1] - unlocked.positionMetres[1]) <= 1e-5,
    );
    measurements.push({
      requirement: "V1-PHY-02",
      method:
        "actual InteractionHost.handleKey KeyF path, saved mode/generation and real first-hit ray; no new restore metadata was introduced",
      locked,
      unlocked,
      blockedNotice,
      commits,
      end: world.getPose("inertial"),
    });
  } finally {
    host.dispose();
    world.dispose();
  }
});

test("actual Host KeyF keeps an overlapped locked body fixed until unlock clearance is restored", async () => {
  let document = scene([
    floor(),
    object("inertial", { mode: "dynamicNoGravity", positionM: [0, 1.6, 1] }),
  ]);
  const world = await PhysicsWorld.create(document);
  let commits = 0;
  const commit = async (operations: SceneOperation[]) => {
    const candidate = applyCommand(document, {
      expectedSceneRevision: document.sceneRevision,
      operations,
    }).scene;
    world.applyScene(candidate);
    document = candidate;
    commits++;
  };
  const host = new InteractionHost({
    getWorld: () => world,
    getScene: () => structuredClone(document),
    commitSceneOperations: commit,
  });
  const pressF = async () => {
    host.handleKey("KeyF", true);
    for (let attempt = 0; attempt < 10 && host.snapshot().pending; attempt++)
      await Promise.resolve();
    assert.equal(host.snapshot().pending, false);
    host.handleKey("KeyF", false);
  };
  try {
    host.enterFPS({ pointerLocked: true });
    assert.equal(host.resume(), true);
    await pressF();
    assert.equal(world.getPose("inertial").mode, "fixed");
    await commit([
      {
        type: "AddObject",
        object: object("neighbor", {
          shape: "box",
          dimensionsM: [0.2, 0.2, 0.2],
          positionM: [0.15, 1.6, 1],
          mode: "fixed",
        }),
      },
    ]);
    const target = document.objects.find((value) => value.id === "inertial")!;
    const clearance = world.validatePlacement(target, target.id);
    assert.equal(clearance.valid, false);
    assert.deepEqual(clearance.blockingObjectIds, ["neighbor"]);
    assert.equal(
      world.raycast(host.snapshot().camera.positionM, [0, 0, -1], 3)?.objectId,
      "inertial",
      "the side overlap must not hide the intended target behind a different first-hit object",
    );
    host.setAlternativeInput(true);
    assert.equal(host.resume(), true);
    const before = commits;
    await pressF();
    assert.equal(
      commits,
      before,
      "documented Fixed→Dynamic clearance check must reject the intersecting shape before committing mode",
    );
    assert.equal(world.getPose("inertial").mode, "fixed");
    assert.equal(world.paused, true);
    assert.deepEqual(world.getPose("inertial").linearVelocityMetresPerSecond, [0, 0, 0]);
    const blockedNotice = host.snapshot().notice;
    await commit([{ type: "RemoveObject", objectId: "neighbor" }]);
    assert.equal(host.resume(), true);
    await pressF();
    assert.equal(
      world.getPose("inertial").mode,
      "dynamicNoGravity",
      "a clearance rejection must retain the saved gravity mode for explicit retry",
    );
    assert.deepEqual(world.getPose("inertial").linearVelocityMetresPerSecond, [0, 0, 0]);
    measurements.push({
      requirement: "V1-PHY-02",
      method:
        "OBJECT_STATES §3 Fixed→Dynamic clearance; actual overlapping shape query, intended ray target and explicit retry",
      clearance,
      blockedNotice,
      end: world.getPose("inertial"),
    });
  } finally {
    host.dispose();
    world.dispose();
  }
});

type ObstacleCase = "thin-wall" | "corner" | "stack";
for (const massKg of [0.1, 1, 5, 20]) {
  for (const obstacle of ["thin-wall", "corner", "stack"] as const) {
    for (const mode of ["dynamicGravity", "dynamicNoGravity"] as const) {
      test(`held ${massKg} kg ${mode} ${obstacle}: finite servo, collision retained, 15 Hz catch-up is bounded`, async () => {
        const world = await PhysicsWorld.create(grabScene(massKg, mode, obstacle));
        try {
          const starting = world.getPose("held");
          // Read-only assertions and transparent query instrumentation observe the actual Rapier
          // objects. They do not change collision results or use an implementation-generated bound.
          const records = (
            world as unknown as {
              records: Map<string, { body: RAPIER.RigidBody; collider: RAPIER.Collider }>;
            }
          ).records;
          const rawRecord = records.get("held")!;
          const sweepHits: Record<string, number> = {};
          for (const [objectId, record] of records) {
            if (objectId === "held") continue;
            const original = record.collider.castShape;
            record.collider.castShape = (...args: Parameters<typeof original>) => {
              const hit = original.apply(record.collider, args);
              if (hit) sweepHits[objectId] = (sweepHits[objectId] ?? 0) + 1;
              return hit;
            };
          }
          const identity = {
            mass: rawRecord.body.mass(),
            type: rawRecord.body.bodyType(),
            gravity: rawRecord.body.gravityScale(),
            collisionGroups: rawRecord.collider.collisionGroups(),
            solverGroups: rawRecord.collider.solverGroups(),
          };
          assert.equal(
            world.grab(
              "held",
              starting.positionMetres,
              `grab.${String(massKg).replace(".", "-")}.${obstacle}.${mode.toLowerCase()}`,
            ),
            true,
          );
          const target: Vec3 = obstacle === "corner" ? [1, 1, -1] : [1.2, 1, 0];
          const targetDistance = Math.hypot(
            ...target.map((value, index) => value - starting.positionMetres[index]!),
          );
          assert.ok(targetDistance <= 1.5, "fixture stays inside the canonical held reach limit");
          world.updateGrabTarget(target, [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]);
          world.resume();
          let diagnostics = 0,
            blockedCount = 0,
            saturatedCount = 0;
          let maxImpulseNs = 0,
            maxTorqueNms = 0,
            maxTrackingErrorM = 0;
          let maxGeometricPenetrationM = 0,
            minimumBarrierClearanceM = Infinity;
          let maxStackGeometricPenetrationM = 0,
            maximumHorizontalDisplacementM = 0;
          const perBarrierMinimumClearanceM =
            obstacle === "corner" ? [Infinity, Infinity] : [Infinity];
          let maxFrameSteps = 0,
            droppedWallTimeSeconds = 0;
          for (let renderFrame = 0; renderFrame < 60; renderFrame++) {
            const result = world.advance(1 / 15, (snapshot) => {
              const pose = snapshot.poses.find((value) => value.objectId === "held")!;
              assert.equal(pose.mode, mode);
              assert.equal(pose.held, true);
              assert.equal(pose.generation, starting.generation);
              assert.ok(
                [
                  ...pose.positionMetres,
                  ...pose.linearVelocityMetresPerSecond,
                  ...pose.angularVelocityRadiansPerSecond,
                ].every(Number.isFinite),
              );
              // Analytic sphere-to-fixed-barrier signed distance, independent from the engine's sweep.
              const gaps = barrierGaps(pose.positionMetres, obstacle);
              gaps.forEach((gap, index) => {
                perBarrierMinimumClearanceM[index] = Math.min(
                  perBarrierMinimumClearanceM[index]!,
                  gap,
                );
              });
              minimumBarrierClearanceM = Math.min(minimumBarrierClearanceM, ...gaps);
              maxGeometricPenetrationM = Math.max(
                maxGeometricPenetrationM,
                ...gaps.map((gap) => Math.max(0, -gap)),
              );
              maximumHorizontalDisplacementM = Math.max(
                maximumHorizontalDisplacementM,
                Math.hypot(
                  pose.positionMetres[0] - starting.positionMetres[0],
                  pose.positionMetres[2] - starting.positionMetres[2],
                ),
              );
              for (const stackPose of snapshot.poses.filter((value) =>
                value.objectId.startsWith("stack."),
              ))
                maxStackGeometricPenetrationM = Math.max(
                  maxStackGeometricPenetrationM,
                  sphereBoxPenetration(
                    pose.positionMetres,
                    0.1,
                    stackPose.positionMetres,
                    stackPose.rotation,
                    [0.15, 0.15, 0.15],
                  ),
                );
              assert.ok(
                pose.positionMetres[0] < 0.79,
                "held center cannot cross the thin wall's near face",
              );
              if (obstacle === "corner")
                assert.ok(
                  pose.positionMetres[2] > -0.79,
                  "held center cannot cross the corner's second near face",
                );
              const diagnostic = snapshot.grabDiagnostics;
              assert.ok(diagnostic, "controller must retain explicit diagnostics while Held");
              diagnostics++;
              blockedCount += Number(diagnostic.blocked);
              saturatedCount += Number(diagnostic.saturated);
              maxImpulseNs = Math.max(maxImpulseNs, norm(diagnostic.impulseNewtonSeconds));
              maxTorqueNms = Math.max(
                maxTorqueNms,
                norm(diagnostic.torqueImpulseNewtonMetreSeconds),
              );
              maxTrackingErrorM = Math.max(maxTrackingErrorM, diagnostic.trackingErrorMetres);
              assert.ok(
                norm(diagnostic.impulseNewtonSeconds) <=
                  Math.min(150 / 60, (massKg * 20) / 60) + 1e-6,
              );
              assert.ok(norm(diagnostic.torqueImpulseNewtonMetreSeconds) <= 15 / 60 + 1e-6);
            });
            maxFrameSteps = Math.max(maxFrameSteps, result.steps);
            droppedWallTimeSeconds += result.droppedWallTimeSeconds;
            assert.ok(result.steps <= 4);
            assert.equal(result.overrun, false);
          }
          assert.equal(world.tick, 240);
          assert.equal(diagnostics, 240);
          assert.ok(
            blockedCount > 0,
            "the fixture must actually exercise blocked sweep, not only open-space spring motion",
          );
          assert.ok(
            maximumHorizontalDisplacementM > 0,
            "the real solver must move Held horizontally; diagnostics alone are not motion",
          );
          assert.ok(maxImpulseNs > 0, "servo must actually apply a nonzero bounded impulse");
          if (obstacle === "stack")
            assert.ok(
              Object.entries(sweepHits).some(
                ([key, count]) => key.startsWith("stack.") && count > 0,
              ),
              "dynamic stack shapes must actually block a held-target sweep",
            );
          if (obstacle === "corner") {
            assert.ok((sweepHits["wall.x"] ?? 0) > 0);
            assert.ok((sweepHits["wall.z"] ?? 0) > 0);
          }
          assert.deepEqual(
            {
              mass: rawRecord.body.mass(),
              type: rawRecord.body.bodyType(),
              gravity: rawRecord.body.gravityScale(),
              collisionGroups: rawRecord.collider.collisionGroups(),
              solverGroups: rawRecord.collider.solverGroups(),
            },
            identity,
          );
          measurements.push({
            requirement: "V1-PHY-04",
            massKg,
            mode,
            obstacle,
            renderHz: 15,
            ticks: world.tick,
            maxFrameSteps,
            droppedWallTimeSeconds,
            diagnostics,
            blockedCount,
            saturatedCount,
            maxImpulseNs,
            maxTorqueNms,
            maxTrackingErrorM,
            minimumBarrierClearanceM,
            perBarrierMinimumClearanceM,
            maxGeometricPenetrationM,
            maxStackGeometricPenetrationM,
            maximumHorizontalDisplacementM,
            sweepHits,
            acceptance:
              "finite canonical force/torque caps; dynamic/mass/gravity/groups retained; no barrier traversal; geometric penetration and tracking reported without an invented universal tolerance",
          });
        } finally {
          world.dispose();
        }
      });
    }
  }
}

function grabScene(massKg: number, mode: BodyMode, obstacle: ObstacleCase): SceneSpec {
  const wall = object("wall.x", {
    shape: "box",
    dimensionsM: [0.02, 4, 4],
    positionM: [0.8, 1, 0],
    mode: "fixed",
  });
  const objects = [floor(), wall, object("held", { massKg, mode })];
  if (obstacle === "corner")
    objects.push(
      object("wall.z", {
        shape: "box",
        dimensionsM: [4, 4, 0.02],
        positionM: [0, 1, -0.8],
        mode: "fixed",
      }),
    );
  if (obstacle === "stack") {
    for (let index = 0; index < 3; index++)
      objects.push(
        object(`stack.${index}`, {
          shape: "box",
          dimensionsM: [0.3, 0.3, 0.3],
          positionM: [0.45, 0.15 + index * 0.3, 0],
          massKg: 1,
          mode: "dynamicGravity",
        }),
      );
  }
  return scene(objects);
}

function barrierGaps(position: Vec3, obstacle: ObstacleCase): number[] {
  const gaps = [0.8 - 0.01 - 0.1 - position[0]];
  if (obstacle === "corner") gaps.push(position[2] + 0.8 - 0.01 - 0.1);
  return gaps;
}

function sphereBoxPenetration(
  sphere: Vec3,
  radius: number,
  center: Vec3,
  rotation: readonly number[],
  halfExtents: Vec3,
): number {
  const delta = sphere.map((value, index) => value - center[index]!) as Vec3;
  // Inverse unit-quaternion rotation; signed distance to the current oriented box.
  const [qx, qy, qz, qw] = rotation as [number, number, number, number];
  const u: Vec3 = [-qx, -qy, -qz];
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const first = cross(u, delta),
    second = cross(u, first);
  const local = delta.map((value, index) => value + 2 * (qw * first[index]! + second[index]!));
  const distances = local.map((value, index) => Math.abs(value) - halfExtents[index]!);
  const signed =
    Math.hypot(...distances.map((value) => Math.max(0, value))) +
    Math.min(Math.max(...distances), 0) -
    radius;
  return Math.max(0, -signed);
}

after(async () => {
  const paths = [
    "src/physics/physics-world.ts",
    "src/physics/fixed-clock.ts",
    "src/physics/character-motor.ts",
    "src/scene/validate-scene.ts",
    "tests/physics/v1-matrix.test.ts",
    "src/app/runtime.ts",
    "src/persistence/validate-project.ts",
    "src/interaction/interaction-host.ts",
    "package-lock.json",
    "node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs",
    "node_modules/@dimforge/rapier3d-compat/dist/rapier_wasm3d_bg.wasm",
  ];
  const files: { path: string; sha256: string }[] = [];
  for (const path of paths) {
    files.push({
      path,
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    });
  }
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/v1-physics-matrix.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          rapier: "0.21.0",
          fixedDtSeconds: 1 / 60,
        },
        files,
        measurements,
        limitations: [
          "Node/WASM evidence, not browser rendering or hearing",
          "same-runtime exact hash comparison does not establish cross-platform determinism",
          "no universal penetration/tracking-error tolerance has been adopted; measured values are retained",
        ],
      },
      null,
      2,
    ) + "\n",
  );
});
