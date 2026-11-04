import test from "node:test";
import assert from "node:assert/strict";
import { AcousticGeometryCache } from "../../src/app/acoustic-geometry-cache.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import type { AcousticInput } from "../../src/app/acoustic-input.js";
import { solveAcoustics, EXTENDED_SOLVER_VERSION } from "../../src/acoustics/index.js";
import type { AcousticMaterial, AcousticRequest } from "../../src/acoustics/types.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import type { SceneSpec } from "../../src/scene/types.js";

function poses(scene: SceneSpec): AcousticInput["poses"] {
  return scene.objects.map((object) => ({
    objectId: object.id,
    positionM: [...object.positionM] as [number, number, number],
    orientationQuaternion: [...object.orientationQuaternion] as [number, number, number, number],
  }));
}

function fixture(): AcousticInput {
  const scene = createDefaultScene();
  for (const object of scene.objects) object.acousticRole = "none";
  scene.objects.find((object) => object.id === "floor")!.acousticRole = "staticSurface";
  scene.objects.push({
    ...structuredClone(scene.objects[0]!),
    id: "blocker",
    mode: "kinematic",
    positionM: [0, 1, 0],
    dimensionsM: [0.2, 2, 1],
    acousticRole: "dynamicOccluder",
  });
  return {
    scene,
    poses: poses(scene),
    sources: [{ id: "voice.speaker", objectId: "speaker", positionM: [0, 1, -1] }],
    listener: { id: "listener.main", positionM: [0, 1, 1] },
    tick: 11,
    materials: structuredClone(DEFAULT_MATERIALS),
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
  };
}

function assertReference(input: AcousticInput, cache: AcousticGeometryCache): AcousticRequest[] {
  const cached = buildAcousticRequests(input, cache);
  const reference = buildAcousticRequests(input);
  assert.deepEqual(cached, reference, "cached DTOs retain the uncached request contract");
  assert.deepEqual(
    cached.map((request) => solveAcoustics(request)),
    reference.map((request) => solveAcoustics(request)),
    "cache reuse preserves the complete numerical solver result",
  );
  return cached;
}

function closeVector(actual: readonly number[], expected: readonly number[]): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]!) < 1e-12));
}

test("unchanged geometry is reused across pose ticks while each request keeps fresh identity", () => {
  const input = fixture();
  const cache = new AcousticGeometryCache();
  const first = assertReference(input, cache)[0]!;
  const cold = cache.getTelemetry();
  input.tick++;
  const next = assertReference(input, cache)[0]!;
  const warm = cache.getTelemetry();
  assert.ok(cold.misses > 0);
  assert.ok(warm.hits > cold.hits, "a different tick can reuse exact unchanged geometry");
  assert.equal(warm.misses, cold.misses);
  assert.equal(warm.maxEntries, 512);
  assert.equal(next.poseTick, first.poseTick + 1);
  assert.notEqual(next.requestId, first.requestId);
  assert.deepEqual(next.surfaces, first.surfaces);
});

test("same-revision moving and rotating geometry changes occlusion and matches the uncached oracle", () => {
  const input = fixture();
  const cache = new AcousticGeometryCache();
  const first = assertReference(input, cache)[0]!;
  const retained = structuredClone(first);
  assert.equal(solveAcoustics(first).diagnostics.directOccluded, true);
  const moving = input.poses.find((pose) => pose.objectId === "blocker")!;
  assert.ok("positionM" in moving);
  [2, 1, 0].forEach((value, index) => Reflect.set(moving.positionM, String(index), value));
  [0, Math.SQRT1_2, 0, Math.SQRT1_2].forEach((value, index) =>
    Reflect.set(moving.orientationQuaternion, String(index), value),
  );
  input.tick++;
  const next = assertReference(input, cache)[0]!;
  const face = next.surfaces.find((surface) => surface.id === "blocker.px")!;
  closeVector(face.verticesM[0]!, [1.5, 0, -0.1]);
  closeVector(face.normal!, [0, 0, -1]);
  assert.equal(next.sceneRevision, first.sceneRevision);
  assert.equal(solveAcoustics(next).diagnostics.directOccluded, false);
  assert.deepEqual(first, retained, "later movement does not mutate a previous request");
});

test("same-id same-revision material edits stay fresh through geometry cache hits", () => {
  const input = fixture();
  const blocker = input.scene.objects.find((object) => object.id === "blocker")!;
  blocker.acousticRole = "none";
  const cache = new AcousticGeometryCache();
  const first = assertReference(input, cache)[0]!;
  const originalMaterial = first.materials.find((material) => material.id === "material.wood")!;
  const originalReflection = solveAcoustics(first).frame.paths.find((path) => path.order === 1)!;
  assert.ok(originalReflection, "the independent floor fixture has a real reflection");
  const edited = (input.materials as AcousticMaterial[]).find(
    (material) => material.id === "material.wood",
  )!;
  edited.bands = edited.bands.map((band) => ({
    ...band,
    absorptionEnergy: 0.8,
    reflectionEnergy: 0.2,
    transmissionEnergy: 0,
  }));
  input.tick++;
  const next = assertReference(input, cache)[0]!;
  const nextReflection = solveAcoustics(next).frame.paths.find((path) => path.order === 1)!;
  assert.equal(edited.revision, originalMaterial.revision);
  assert.notDeepEqual(nextReflection.bandGains, originalReflection.bandGains);
  assert.deepEqual(
    first.materials.find((material) => material.id === edited.id),
    originalMaterial,
  );
  // The geometry's material binding is independently part of cache identity.
  input.scene.objects.find((object) => object.id === "floor")!.acousticMaterialId = "material.soft";
  input.tick++;
  const rebound = assertReference(input, cache)[0]!;
  assert.ok(rebound.surfaces.every((surface) => surface.materialId === "material.soft"));
});

test("role, mode, dimensions and curved model changes cannot reuse stale object geometry", () => {
  const input = fixture();
  const cache = new AcousticGeometryCache();
  assertReference(input, cache);
  const object = input.scene.objects.find((entry) => entry.id === "blocker")!;
  object.acousticRole = "dynamicReflector";
  object.dimensionsM = [0.4, 3, 2];
  input.tick++;
  const reflector = assertReference(input, cache)[0]!;
  assert.equal(reflector.modelVersion, EXTENDED_SOLVER_VERSION);
  assert.equal(
    reflector.surfaces.find((surface) => surface.id === "blocker.px")!.role,
    "dynamicReflector",
  );
  closeVector(
    reflector.surfaces.find((surface) => surface.id === "blocker.px")!.verticesM[0]!,
    [0.2, -0.5, -1],
  );
  object.acousticRole = "staticSurface";
  object.mode = "fixed";
  input.tick++;
  const fixed = assertReference(input, cache)[0]!;
  assert.equal(
    fixed.surfaces.find((surface) => surface.id === "blocker.px")!.role,
    "staticReflector",
  );
  assert.equal(fixed.modelVersion, undefined);
  object.shape = "sphere";
  object.dimensionsM = [0.8, 0.8, 0.8];
  input.tick++;
  const sphere = assertReference(input, cache)[0]!;
  assert.equal(
    sphere.surfaces.some((surface) => surface.id.startsWith("blocker.")),
    false,
  );
  assert.equal(
    sphere.primitives!.find((primitive) => primitive.id === "blocker.body")!.radiusM,
    0.4,
  );
  object.shape = "capsule";
  object.dimensionsM = [0.8, 2, 0.8];
  input.tick++;
  const capsule = assertReference(input, cache)[0]!;
  const primitive = capsule.primitives!.find((entry) => entry.id === "blocker.body")!;
  assert.equal(primitive.kind, "capsule");
  assert.equal(primitive.halfLengthM, 0.6);
});

test("same-revision scene namespace and topology replacement keep only the current members", () => {
  const input = fixture();
  const cache = new AcousticGeometryCache();
  const first = assertReference(input, cache)[0]!;
  input.scene.sceneId = "scene.other";
  input.scene.objects.find((object) => object.id === "blocker")!.id = "replacement";
  input.poses = poses(input.scene);
  input.tick++;
  const next = assertReference(input, cache)[0]!;
  assert.equal(next.sceneRevision, first.sceneRevision);
  assert.equal(next.topologyId, "scene.other");
  assert.equal(
    next.surfaces.some((surface) => surface.id.startsWith("blocker.")),
    false,
  );
  assert.equal(next.surfaces.filter((surface) => surface.id.startsWith("replacement.")).length, 6);
  assert.notEqual(next.requestId, first.requestId);
});

test("face and analytic-volume cache entries obey each source's self-exclusion and unchanged cap", () => {
  const input = fixture();
  input.scene.objects.find((object) => object.id === "ball")!.acousticRole = "dynamicOccluder";
  const cache = new AcousticGeometryCache();
  input.budget = { maxSurfaces: 13, maxPaths: 8 };
  const planar = assertReference(input, cache)[0]!;
  assert.equal(planar.surfaces.filter((surface) => surface.id.startsWith("blocker.")).length, 6);
  assert.equal(planar.boxOccluders, undefined);
  input.budget = { maxSurfaces: 8, maxPaths: 8 };
  input.tick++;
  const compact = assertReference(input, cache)[0]!;
  assert.equal(compact.surfaces.length, 6);
  assert.equal(compact.boxOccluders?.length, 1);
  assert.equal(compact.boxOccluders![0]!.id, "blocker.volume");
  input.sources = [
    { id: "voice.blocker", objectId: "blocker", positionM: [0, 1, 0] },
    ...input.sources,
  ];
  input.tick++;
  const [owner, other] = assertReference(input, cache);
  assert.ok(owner && other);
  assert.equal(owner.source.id, "voice.blocker");
  assert.equal(owner.surfaces.length, 6);
  assert.equal(owner.boxOccluders, undefined, "owner exclusion is applied before compaction");
  assert.equal(other.boxOccluders?.length, 1);
  // A detached emitter includes its owner's body again, even for the same source identity.
  input.sources = [{ ...input.sources[0]!, emitterObjectId: null }];
  input.tick++;
  assert.equal(assertReference(input, cache)[0]!.boxOccluders?.length, 1);
  input.budget = { maxSurfaces: 7 };
  assert.throws(() => buildAcousticRequests(input, cache), { code: "SURFACE_BUDGET" });
});

test("a warm cache cannot bypass current pose validation or explicit emitter identity", () => {
  const input = fixture();
  const cache = new AcousticGeometryCache();
  assertReference(input, cache);
  input.poses = input.poses.filter((pose) => pose.objectId !== "blocker");
  assert.throws(() => buildAcousticRequests(input, cache), { code: "POSE_REQUIRED" });
  input.poses = poses(input.scene);
  input.sources = [{ ...input.sources[0]!, emitterObjectId: "missing" }];
  assert.throws(() => buildAcousticRequests(input, cache), { code: "SOURCE_EMITTER_IDENTITY" });
});

test("cache capacity is finite and mutation of one returned DTO cannot poison reuse", () => {
  const input = fixture();
  const cache = new AcousticGeometryCache(1);
  const first = assertReference(input, cache)[0]!;
  const telemetry = cache.getTelemetry();
  assert.equal(telemetry.maxEntries, 1);
  assert.ok(telemetry.entries <= 1);
  assert.ok(telemetry.evictions > 0, "two object geometries exceed a one-entry cache");
  Reflect.set(first.surfaces[0]!.verticesM[0]!, "0", 99);
  Reflect.set(first.surfaces[0]!.normal!, "0", 99);
  const next = assertReference(input, cache)[0]!;
  assert.notEqual(next.surfaces[0]!.verticesM[0]![0], 99);
  assert.notEqual(next.surfaces[0]!.normal![0], 99);
  assert.ok(cache.getTelemetry().entries <= 1);
});

test("clear starts a new cache generation without invalidating already owned requests", () => {
  const input = fixture();
  const cache = new AcousticGeometryCache();
  const first = assertReference(input, cache)[0]!;
  const retained = structuredClone(first);
  const before = cache.getTelemetry();
  cache.clear();
  const cleared = cache.getTelemetry();
  assert.equal(cleared.entries, 0);
  assert.equal(cleared.generation, before.generation + 1);
  input.tick++;
  assertReference(input, cache);
  assert.deepEqual(first, retained);
  assert.ok(cache.getTelemetry().misses > before.misses);
});

test("a warm signed-zero pose cannot alias a malformed string pose and bypass validation", () => {
  for (const analytic of [false, true]) {
    const input = fixture();
    if (analytic) {
      input.scene.objects.find((object) => object.id === "ball")!.acousticRole = "dynamicOccluder";
      input.budget = { maxSurfaces: 8 };
    }
    const moving = input.poses.find((pose) => pose.objectId === "blocker")!;
    assert.ok("positionM" in moving);
    Reflect.set(moving.positionM, "0", -0);
    const cache = new AcousticGeometryCache();
    buildAcousticRequests(input, cache);
    Reflect.set(moving.positionM, "0", "acoustic:negative-zero");
    assert.throws(() => buildAcousticRequests(input), "reference rejects malformed current pose");
    assert.throws(
      () => buildAcousticRequests(input, cache),
      "a cache hit must not bypass pose validation",
    );
  }
});

test("caller pose serialization hooks cannot impersonate previously cached geometry", () => {
  const input = fixture();
  const cache = new AcousticGeometryCache();
  const first = buildAcousticRequests(input, cache)[0]!;
  const moving = input.poses.find((pose) => pose.objectId === "blocker")!;
  assert.ok("positionM" in moving);
  const oldOrientation = [...moving.orientationQuaternion];
  [0, Math.SQRT1_2, 0, Math.SQRT1_2].forEach((value, index) =>
    Reflect.set(moving.orientationQuaternion, String(index), value),
  );
  let serializationCalls = 0;
  Reflect.set(moving.orientationQuaternion, "toJSON", () => {
    serializationCalls++;
    return oldOrientation;
  });
  input.tick++;
  const reference = buildAcousticRequests(input)[0]!;
  assert.notDeepEqual(
    reference.surfaces,
    first.surfaces,
    "current quaternion actually rotates geometry",
  );
  assert.deepEqual(buildAcousticRequests(input, cache)[0]!, reference);
  assert.equal(serializationCalls, 0, "cache identity never executes caller serialization hooks");
});

for (const property of ["position", "orientation"] as const) {
  test(`indexed ${property} snapshot cannot be replaced by caller iterator or array methods`, () => {
    const input = fixture();
    const moving = input.poses.find((pose) => pose.objectId === "blocker")!;
    assert.ok("positionM" in moving);
    Reflect.set(moving.positionM, "0", -0);
    Reflect.set(moving.orientationQuaternion, "0", -0);
    const cache = new AcousticGeometryCache();
    const prior = buildAcousticRequests(input, cache);
    const before = structuredClone(prior);
    if (property === "position") {
      Reflect.set(moving.positionM, "0", "acoustic:negative-zero");
      Object.defineProperty(moving.positionM, Symbol.iterator, {
        enumerable: false,
        value: function* () {
          yield 0;
          yield 1;
          yield 0;
        },
      });
    } else {
      Reflect.set(moving.orientationQuaternion, "0", "acoustic:negative-zero");
      Object.defineProperty(moving.orientationQuaternion, "some", {
        enumerable: false,
        value: () => false,
      });
      Object.defineProperty(moving.orientationQuaternion, Symbol.iterator, {
        enumerable: false,
        value: function* () {
          yield 0;
          yield 0;
          yield 0;
          yield 1;
        },
      });
    }
    assert.throws(
      () => buildAcousticRequests(input, cache),
      "warm cache validates actual indexed numeric values",
    );
    assert.throws(
      () => buildAcousticRequests(input),
      "uncached and cached builders enforce the same numeric snapshot",
    );
    assert.deepEqual(prior, before);
  });
}

test("explicit emitter exclusion cannot hide a nonnumeric indexed position behind an iterator", () => {
  const input = fixture();
  input.sources = [
    { id: "voice.owner", objectId: "blocker", emitterObjectId: "blocker", positionM: [0, 1, 0] },
  ];
  const moving = input.poses.find((pose) => pose.objectId === "blocker")!;
  assert.ok("positionM" in moving);
  Reflect.set(moving.positionM, "0", "not-a-number");
  Object.defineProperty(moving.positionM, Symbol.iterator, {
    enumerable: false,
    value: function* () {
      yield 0;
      yield 1;
      yield 0;
    },
  });
  assert.throws(() => buildAcousticRequests(input), { code: "INVALID_GEOMETRY_POSE" });
});
