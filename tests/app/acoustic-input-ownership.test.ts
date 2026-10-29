import test from "node:test";
import assert from "node:assert/strict";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import type { AcousticInput } from "../../src/app/acoustic-input.js";
import type { AcousticMaterial } from "../../src/acoustics/types.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import type { Vec3 } from "../../src/scene/types.js";

function fixture(): AcousticInput {
  const scene = createDefaultScene();
  scene.objects.push({
    ...structuredClone(scene.objects[0]!),
    id: "blocker",
    mode: "dynamicGravity",
    positionM: [0, 2, 0],
    dimensionsM: [2, 4, 6],
    acousticRole: "dynamicOccluder",
  });
  return {
    scene,
    poses: [{ objectId: "blocker", positionM: [1, 2, 3], orientationQuaternion: [0, 0, 0, 1] }],
    sources: [
      { id: "voice.z", objectId: "speaker", positionM: [1, 1, -1] },
      { id: "voice.a", objectId: "ball", positionM: [-1, 1, 0] },
    ],
    listener: { id: "listener.main", positionM: [0, 1.6, 4] },
    tick: 11,
    materials: structuredClone(DEFAULT_MATERIALS),
    atmosphere: {
      medium: "air",
      speedOfSoundMps: 343,
      bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
    },
  };
}

function closeVector(actual: readonly number[], expected: readonly number[]): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]!) < 1e-12));
}

test("acoustic requests retain independently owned geometry, materials, endpoints and atmosphere", () => {
  const input = fixture();
  const original = structuredClone(input);
  const [first, second] = buildAcousticRequests(input);
  assert.ok(first && second);
  const secondBefore = structuredClone(second);
  const firstSurface = first.surfaces.find((surface) => surface.id === "floor.px")!;
  const secondSurface = second.surfaces.find((surface) => surface.id === "floor.px")!;
  assert.notStrictEqual(first.surfaces, second.surfaces);
  assert.notStrictEqual(firstSurface, secondSurface);
  assert.notStrictEqual(firstSurface.verticesM, secondSurface.verticesM);
  assert.notStrictEqual(firstSurface.verticesM[0], secondSurface.verticesM[0]);
  assert.notStrictEqual(firstSurface.normal, secondSurface.normal);
  assert.notStrictEqual(first.materials[0], second.materials[0]);
  assert.notStrictEqual(first.atmosphere, second.atmosphere);
  // Consumer-side edits must not leak into another voice or the caller's inputs.
  assert.equal(Reflect.set(firstSurface.verticesM[0]!, "0", 99), true);
  assert.equal(Reflect.set(firstSurface.normal!, "0", 99), true);
  (first.materials as AcousticMaterial[])[0]!.label = "changed only for first voice";
  (first.materials[0]!.bands[0] as { absorptionEnergy: number }).absorptionEnergy = 0.9;
  (first.atmosphere.bandAbsorptionDbPerM as number[])[0] = 0.4;
  assert.equal(Reflect.set(first.source.positionM, "0", 99), true);
  assert.equal(Reflect.set(first.listener.positionM, "0", 99), true);
  assert.deepEqual(second, secondBefore);
  assert.deepEqual(input, original);
});

test("acoustic request order and face values are stable under source and Scene object reordering", () => {
  const input = fixture();
  const original = buildAcousticRequests(input);
  const reordered = structuredClone(input);
  reordered.scene.objects.reverse();
  (reordered.sources as AcousticInput["sources"][number][]).reverse();
  const actual = buildAcousticRequests(reordered);
  assert.deepEqual(actual, original);
  assert.deepEqual(
    actual.map((request) => request.source.id),
    ["voice.a", "voice.z"],
  );
  assert.deepEqual(
    actual[0]!.surfaces.slice(0, 6).map((surface) => surface.id),
    ["blocker.px", "blocker.nx", "blocker.py", "blocker.ny", "blocker.pz", "blocker.nz"],
  );
});

test("dynamic snapshot rotation and translation are fresh on every call with the same revision", () => {
  const input = fixture();
  input.poses = [
    {
      objectId: "blocker",
      positionM: [1, 2, 3],
      orientationQuaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
    },
  ];
  const first = buildAcousticRequests(input)[0]!;
  const firstFace = first.surfaces.find((surface) => surface.id === "blocker.px")!;
  closeVector(firstFace.verticesM[0]!, [-2, 0, 2]);
  closeVector(firstFace.normal!, [0, 0, -1]);
  assert.equal(firstFace.role, "dynamicOccluder");
  const firstBefore = structuredClone(first);
  input.poses = [
    { objectId: "blocker", positionM: [5, 2, 3], orientationQuaternion: [0, 0, 0, 1] },
  ];
  input.tick++;
  const second = buildAcousticRequests(input)[0]!;
  const secondFace = second.surfaces.find((surface) => surface.id === "blocker.px")!;
  closeVector(secondFace.verticesM[0]!, [6, 0, 0]);
  closeVector(secondFace.normal!, [1, 0, 0]);
  assert.equal(second.sceneRevision, first.sceneRevision);
  assert.equal(second.poseTick, first.poseTick + 1);
  assert.deepEqual(first, firstBefore);
});

test("a moving source owner may omit its excluded geometry pose, but another voice cannot", () => {
  const input = fixture();
  input.poses = [];
  input.sources = [{ id: "voice.owner", objectId: "blocker", positionM: [1, 2, 3] }];
  const own = buildAcousticRequests(input);
  assert.equal(own.length, 1);
  assert.equal(
    own[0]!.surfaces.some((surface) => surface.id.startsWith("blocker.")),
    false,
  );
  assert.equal(own[0]!.surfaces.length, 24);
  input.sources = [...input.sources, { id: "voice.z", objectId: "speaker", positionM: [1, 1, -1] }];
  assert.throws(() => buildAcousticRequests(input), { code: "POSE_REQUIRED" });
  input.sources = [];
  assert.deepEqual(buildAcousticRequests(input), []);
});

test("per-source surface caps count only that owner's actual excluded faces", () => {
  const input = fixture();
  input.sources = [{ id: "voice.floor", objectId: "floor", positionM: [0, 0, 0] }];
  input.budget = { maxSurfaces: 24 };
  const floor = buildAcousticRequests(input)[0]!;
  assert.equal(floor.surfaces.length, 24);
  assert.equal(
    floor.surfaces.some((surface) => surface.id.startsWith("floor.")),
    false,
  );
  input.sources = [{ id: "voice.speaker", objectId: "speaker", positionM: [1, 1, -1] }];
  assert.throws(() => buildAcousticRequests(input), { code: "SURFACE_BUDGET" });
  input.budget = { maxSurfaces: 30 };
  assert.equal(buildAcousticRequests(input)[0]!.surfaces.length, 30);
});

test("Scene validation still precedes request validation and unknown or duplicate poses are rejected", () => {
  const invalid = fixture();
  invalid.scene.objects.push(structuredClone(invalid.scene.objects[0]!));
  invalid.tick = -1;
  assert.throws(() => buildAcousticRequests(invalid), { code: "INVALID_SCENE" });
  const input = fixture();
  input.poses = [
    ...input.poses,
    { objectId: "unknown", positionM: [0, 0, 0], orientationQuaternion: [0, 0, 0, 1] },
  ];
  assert.throws(() => buildAcousticRequests(input), { code: "POSE_IDENTITY" });
  input.poses = [input.poses[0]!, input.poses[0]!];
  assert.throws(() => buildAcousticRequests(input), { code: "POSE_IDENTITY" });
});

test("source owner identity, duplicate source IDs and original source/pose admission caps remain enforced", () => {
  const input = fixture();
  input.sources = [{ id: "voice.unknown", objectId: "unknown", positionM: [0, 0, 0] }];
  assert.throws(() => buildAcousticRequests(input), { code: "SOURCE_IDENTITY" });
  input.sources = [
    { id: "voice.same", objectId: "speaker", positionM: [0, 0, 0] },
    { id: "voice.same", objectId: "ball", positionM: [0, 0, 0] },
  ];
  assert.throws(() => buildAcousticRequests(input), { code: "SOURCE_IDENTITY" });
  input.sources = Array.from({ length: 17 }, (_, index) => ({
    id: `voice.${index}`,
    objectId: "speaker",
    positionM: [0, 0, 0] as Vec3,
  }));
  assert.throws(() => buildAcousticRequests(input), { code: "SOURCE_BUDGET" });
  input.sources = [];
  input.poses = Array.from({ length: 257 }, () => input.poses[0]!);
  assert.throws(() => buildAcousticRequests(input), { code: "POSE_BUDGET" });
});

test("caller mutations after construction cannot alter an existing request", () => {
  const input = fixture();
  const requests = buildAcousticRequests(input);
  const before = structuredClone(requests);
  const moving = input.poses[0]!;
  assert.ok("positionM" in moving);
  assert.equal(Reflect.set(moving.positionM, "0", 90), true);
  input.scene.objects[0]!.positionM[0] = 90;
  input.scene.objects[0]!.dimensionsM[0] = 90;
  input.scene.objects[0]!.acousticMaterialId = "material.soft";
  assert.equal(Reflect.set(input.sources[0]!.positionM, "0", 90), true);
  assert.equal(Reflect.set(input.listener.positionM, "0", 90), true);
  (input.materials as AcousticMaterial[])[0]!.label = "caller changed label";
  (input.atmosphere.bandAbsorptionDbPerM as number[])[0] = 0.8;
  assert.deepEqual(requests, before);
});
