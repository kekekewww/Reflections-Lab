import test from "node:test";
import { createScene } from "../../src/scene/index.js";
import assert from "node:assert/strict";
import { createDefaultScene } from "../../src/app/defaults.js";
import type { SceneObject, Vec3 } from "../../src/scene/types.js";
import type { ToolRequest } from "../../src/ai/types.js";
import { scoreScene, objectBounds, roomInterior } from "../../benchmarks/muse-limits/score.js";

function object(id: string, positionM: Vec3, dimensionsM: Vec3 = [0.2, 0.2, 0.2]): SceneObject {
  return { ...createDefaultScene().objects[0]!, id, positionM, dimensionsM };
}
function baseForArc() {
  return createScene({
    schemaVersion: "1.0.0",
    sceneId: "scene.arc",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1,
    gravityMps2: [0, -9.81, 0],
    objects: [
      {
        id: "floor",
        shape: "box",
        positionM: [0, -0.1, 0],
        dimensionsM: [20, 0.2, 20],
        orientationQuaternion: [0, 0, 0, 1],
        mode: "fixed",
        massKg: 1,
        friction: 0.5,
        restitution: 0.2,
        physicsMaterialId: "material.test",
        acousticMaterialId: "material.test",
        acousticRole: "staticSurface",
      },
      {
        id: "target",
        shape: "box",
        positionM: [0, 1, 0],
        dimensionsM: [0.4, 0.4, 0.4],
        orientationQuaternion: [0, 0, 0, 1],
        mode: "fixed",
        massKg: 1,
        friction: 0.5,
        restitution: 0.2,
        physicsMaterialId: "material.test",
        acousticMaterialId: "material.test",
        acousticRole: "none",
      },
    ],
    sources: [],
    listener: {
      id: "listener.main",
      positionM: [0, 1.6, 5],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
}
test("arc scoring measures radius and facing around the target", () => {
  const scene = createScene({
    ...baseForArc(),
    objects: [
      ...baseForArc().objects,
      ...[0, 90].map((degrees) => {
        const radians = (degrees * Math.PI) / 180;
        // A yaw of a turns -Z to (-sin a, 0, -cos a), which points from this position to the target.
        return {
          ...baseForArc().objects[1]!,
          id: `chair.${degrees}`,
          positionM: [3 * Math.sin(radians), 1, 3 * Math.cos(radians)] as [number, number, number],
          orientationQuaternion: [0, Math.sin(radians / 2), 0, Math.cos(radians / 2)] as [
            number,
            number,
            number,
            number,
          ],
        };
      }),
    ],
  });
  const score = scoreScene(baseForArc(), scene, [], {
    arcAround: { target: "target", radiusM: 3 },
  });
  assert.equal(score.arc!.count, 2);
  assert.ok(Math.abs(score.arc!.meanRadiusM - 3) < 1e-9);
  assert.ok(score.arc!.maxRadiusErrorM < 1e-9);
  assert.ok(score.arc!.maxFacingErrorDegMinusZ < 1e-6);
  assert.ok(Math.abs(score.arc!.maxFacingErrorDegPlusZ - 180) < 1e-6);
});

test("geometry score counts outside, intersections, floor/object/wall support, listener containment and tools", () => {
  const before = createDefaultScene();
  before.objects = before.objects.filter((o) => !["ball", "speaker"].includes(o.id));
  const scene = structuredClone(before);
  scene.objects.push(
    object("base", [0, 0.5, 0], [1, 1, 1]),
    object("top", [0, 1.1, 0]),
    object("overlap", [0.1, 0.5, 0]),
    object("floating", [1, 2, 0]),
    object("wall-panel", [2.9, 2, 0]),
    object("outside", [4, 0.1, 0]),
    object("listener", [0, 1.6, 4]),
  );
  const score = scoreScene(
    before,
    scene,
    [{ tool: "AddObject" }, { tool: "SetMaterial" }, { tool: "AddObject" }] as ToolRequest[],
    {},
  );
  assert.equal(score.addedObjects, 7);
  assert.deepEqual(score.toolCounts, { AddObject: 2, SetMaterial: 1 });
  assert.equal(score.outsideRoom, 1);
  assert.equal(score.intersectingPairs, 1);
  assert.equal(score.unsupported, 3); // overlap, floating and listener
  assert.equal(score.listenerInside, 1);
});
test("rotated boxes use quaternion bounds and point containment uses the actual rotated shape", () => {
  const before = createDefaultScene();
  const scene = structuredClone(before);
  const box = object("rotated", [2.8, 0.5, 0], [0.2, 1, 2]);
  box.orientationQuaternion = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const bounds = objectBounds(box);
  assert.ok(Math.abs(bounds.max[0] - 3.8) < 1e-10);
  scene.objects.push(box);
  assert.equal(scoreScene(before, scene, [], {}).outsideRoom, 1);
  scene.listener.positionM = [2.8, 0.5, 0.2]; // AABB of unrotated box contains it, rotated box does not
  assert.equal(scoreScene(before, scene, [], {}).listenerInside, 0);
});
test("room interior uses inner faces, floor front edge, wall tops and replacement room ceiling", () => {
  const scene = createDefaultScene();
  const defaultRoom = roomInterior(scene);
  for (const [actual, expected] of [...defaultRoom.min, ...defaultRoom.max].map((v, i) => [
    v,
    [-3, 0, -4, 3, 4, 4.2][i]!,
  ]))
    assert.ok(Math.abs(actual! - expected!) < 1e-10);
  scene.objects = [
    object("room.floor", [0, -0.1, 0], [14, 0.2, 24]),
    object("room.ceiling", [0, 9.1, 0], [14, 0.2, 24]),
    object("room.back", [0, 4.5, -12.1], [14, 9, 0.2]),
    object("room.front", [0, 4.5, 12.1], [14, 9, 0.2]),
    object("room.left", [-7.1, 4.5, 0], [0.2, 9, 24]),
    object("room.right", [7.1, 4.5, 0], [0.2, 9, 24]),
  ];
  const room = roomInterior(scene);
  for (const [actual, expected] of [...room.min, ...room.max].map((v, i) => [
    v,
    [-7, 0, -12, 7, 9, 12][i]!,
  ]))
    assert.ok(Math.abs(actual! - expected!) < 1e-10);
});
test("known circle scores duration, speed, start/closure distance, radius and out-of-room samples", () => {
  const before = createDefaultScene();
  before.listener.positionM = [0, 1.6, 0];
  const scene = structuredClone(before);
  const samples = Array.from({ length: 33 }, (_, i) => ({
    timeS: (8 * i) / 32,
    positionM: [2 * Math.cos((2 * Math.PI * i) / 32), 2, 2 * Math.sin((2 * Math.PI * i) / 32)],
    orientationQuaternion: [0, 0, 0, 1],
  }));
  const req = {
    tool: "SetTrajectory",
    arguments: { objectId: "ball", samples },
  } as unknown as ToolRequest;
  const path = scoreScene(before, scene, [req], {
    path: { objectId: "ball", centre: "listener", radiusM: 2 },
  }).paths[0]!;
  assert.equal(path.samples, 33);
  assert.equal(path.durationS, 8);
  assert.ok(Math.abs(path.peakSpeedMps - 16 * Math.sin(Math.PI / 32)) < 1e-10);
  assert.ok(Math.abs(path.startDistanceM! - 2.8) < 1e-10);
  assert.ok(path.endDistanceM < 1e-10);
  assert.ok(Math.abs(path.meanRadiusM! - 2) < 1e-10);
  assert.ok(path.maxRadiusErrorM! < 1e-10);
  assert.equal(path.outsideRoom, 0);
  samples[0]!.positionM = [4, 2, 0];
  assert.equal(scoreScene(before, scene, [req], {}).paths[0]!.outsideRoom, 1);
});
test("listener facing error and grid neighbour spacing are numeric", () => {
  const before = createDefaultScene();
  const scene = structuredClone(before);
  scene.listener.positionM = [0, 1, 0];
  scene.objects.find((o) => o.id === "speaker")!.positionM = [1, 1, 0];
  for (let z = 0; z < 5; z++)
    for (let x = 0; x < 5; x++)
      scene.objects.push(object(`column.${x}-${z}`, [-2 + x, 2, -3 + z], [0.1, 4, 0.1]));
  const expected = { listenerFacingTarget: "speaker", evenGrid: true };
  const score = scoreScene(before, scene, [], expected);
  assert.equal(score.listenerFacingErrorDeg, 90);
  assert.equal(score.gridSpacingErrorM, 0);
  scene.objects.find((o) => o.id === "column.2-2")!.positionM[0] += 0.2;
  assert.ok(scoreScene(before, scene, [], expected).gridSpacingErrorM! > 0.39);
});
test("intersection threshold excludes tiny contacts and includes existing non-room objects", () => {
  const before = createDefaultScene();
  before.objects.push(object("existing", [0, 1, 0], [1, 1, 1]));
  const scene = structuredClone(before);
  scene.objects.push(object("new", [0.99, 1, 0], [1, 1, 1]));
  assert.equal(scoreScene(before, scene, [], {}).intersectingPairs, 0);
  scene.objects.at(-1)!.positionM[0] = 0.97;
  assert.equal(scoreScene(before, scene, [], {}).intersectingPairs, 1);
});
