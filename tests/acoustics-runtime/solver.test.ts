import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  AcousticSolverError,
  createBoxSurfaces,
  solveAcoustics,
} from "../../src/acoustics/index.ts";
import type {
  AcousticMaterial,
  AcousticRequest,
  AcousticSurface,
  AcousticPath,
} from "../../src/acoustics/types.ts";

// Independent V1 analytical acceptance: ACO-001/002, MAT-001, AIR-001/003.
// Expected values use fixed 3-4-5 and sqrt(20) geometry, not solver helpers.
const bands = [125, 250, 500, 1000, 2000, 4000, 8000];
const tolerance = 1e-10;
const close = (actual: number, expected: number, epsilon = tolerance) => {
  assert.ok(Number.isFinite(actual), `Expected finite value, received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected} ± ${epsilon}`);
};
const material = (reflection = 1, scattering = 0): AcousticMaterial => ({
  schemaVersion: "1.0.0",
  id: "synthetic-reflector",
  revision: 0,
  label: "Synthetic acceptance material; not a measured wood/concrete response",
  dataClass: "Synthetic",
  sourceUrls: [],
  conditions: "Equal-medium, zero-phase pressure magnitude only; analytical fixture",
  phaseModel: "zeroPhaseMagnitudeOnly",
  bands: bands.map((centerHz) => ({
    centerHz,
    absorptionEnergy: 1 - reflection,
    reflectionEnergy: reflection,
    transmissionEnergy: 0,
    scatteringFraction: scattering,
  })),
});
const floor = (): AcousticSurface => ({
  id: "floor",
  materialId: "synthetic-reflector",
  normal: [0, 1, 0],
  verticesM: [
    [-10, 0, -10],
    [-10, 0, 10],
    [10, 0, 10],
    [10, 0, -10],
  ],
});
const request = (patch: Partial<AcousticRequest> = {}): AcousticRequest => ({
  requestId: "acceptance-001",
  sceneRevision: 3,
  geometryRevision: 2,
  poseTick: 120,
  topologyId: "acceptance-room-v1",
  source: { id: "source-a", positionM: [0, 0, 0] },
  listener: { id: "listener-a", positionM: [3, 4, 0] },
  surfaces: [],
  materials: [material()],
  atmosphere: { medium: "air", speedOfSoundMps: 343 },
  ...patch,
});
const reflectionRequest = (patch: Partial<AcousticRequest> = {}) =>
  request({
    source: { id: "source-a", positionM: [1, 1, 0] },
    listener: { id: "listener-a", positionM: [5, 1, 0] },
    surfaces: [floor()],
    ...patch,
  });
const directPath = (paths: AcousticPath[]) => {
  const path = paths.find((item) => item.order === 0);
  assert.ok(path, "Expected an actual direct path");
  return path;
};
const floorPath = (paths: AcousticPath[]) => {
  const path = paths.find((item) => item.surfaceIds.length === 1 && item.surfaceIds[0] === "floor");
  assert.ok(path, "Expected a geometrically valid finite floor reflection");
  return path;
};
const rejected = (input: AcousticRequest) =>
  assert.throws(
    () => solveAcoustics(input),
    (error: unknown) => {
      assert.ok(error instanceof AcousticSolverError);
      assert.equal(typeof error.code, "string");
      assert.ok(error.code.length > 0);
      return true;
    },
  );

test("ACO-001: 3-4-5 free field has a 5/343 s arrival and 1/5 pressure, not 1/25", () => {
  const result = solveAcoustics(request());
  const direct = directPath(result.frame.paths);
  close(direct.lengthM, 5);
  close(direct.absoluteDelayS, 0.014577259475218658, 1e-12);
  close(result.frame.directDelayS!, 0.014577259475218658, 1e-12);
  close(direct.relativeDelayS, 0);
  for (const gain of direct.bandGains) close(gain, 0.2, 1e-12);
  close(direct.bandGains[0]! ** 2, 0.04, 1e-12);
  assert.deepEqual(direct.verticesM, [
    [0, 0, 0],
    [3, 4, 0],
  ]);
  close(direct.arrivalDirection[0], -0.6);
  close(direct.arrivalDirection[1], -0.8);
  close(direct.arrivalDirection[2], 0);
});

test("ACO-001: doubling distance halves pressure and quarters energy", () => {
  const near = directPath(solveAcoustics(request()).frame.paths);
  const far = directPath(
    solveAcoustics(request({ listener: { id: "listener-a", positionM: [6, 8, 0] } })).frame.paths,
  );
  close(far.bandGains[0]!, 0.1);
  close(far.bandGains[0]! / near.bandGains[0]!, 0.5);
  close((far.bandGains[0]! / near.bandGains[0]!) ** 2, 0.25);
});

test("ACO-002: finite floor reflection hits [3,0,0], length sqrt(20), final-segment apparent direction", () => {
  const result = solveAcoustics(reflectionRequest());
  const reflected = floorPath(result.frame.paths);
  close(reflected.lengthM, 4.47213595499958);
  assert.equal(reflected.verticesM.length, 3);
  reflected.verticesM[1]!.forEach((value, axis) => close(value, [3, 0, 0][axis]!));
  close(reflected.absoluteDelayS, 4.47213595499958 / 343, 1e-12);
  close(reflected.relativeDelayS, (4.47213595499958 - 4) / 343, 1e-12);
  close(reflected.arrivalDirection[0], -0.8944271909999159);
  close(reflected.arrivalDirection[1], -0.4472135954999579);
  close(reflected.bandGains[0]!, 0.22360679774997896);
  // The fixed absolute delay assertion above excludes adding direct delay twice.
});

test("ACO-002: an infinite-plane intersection outside finite polygon is rejected", () => {
  const smallFloor = floor();
  smallFloor.verticesM = [
    [-1, 0, -1],
    [-1, 0, 1],
    [1, 0, 1],
    [1, 0, -1],
  ];
  const result = solveAcoustics(reflectionRequest({ surfaces: [smallFloor] }));
  assert.equal(result.frame.paths.filter((path) => path.order === 1).length, 0);
  assert.equal(result.frame.paths.length, 1);
});

test("a reflection cannot connect opposite sides of a zero-thickness reflector", () => {
  const result = solveAcoustics(
    reflectionRequest({
      listener: { id: "listener-a", positionM: [5, -1, 0] },
      surfaces: [{ ...floor(), twoSided: true }],
    }),
  );
  assert.equal(
    result.frame.paths.some((path) => path.surfaceIds.includes("floor")),
    false,
  );
  assert.equal(result.diagnostics.directOccluded, true);
});

test("flipping a two-sided surface normal preserves the finite reflection geometry and identity", () => {
  const positive = solveAcoustics(
    reflectionRequest({ surfaces: [{ ...floor(), twoSided: true }] }),
  );
  const negative = solveAcoustics(
    reflectionRequest({ surfaces: [{ ...floor(), normal: [0, -1, 0], twoSided: true }] }),
  );
  const a = floorPath(positive.frame.paths),
    b = floorPath(negative.frame.paths);
  assert.equal(a.id, b.id);
  close(a.lengthM, b.lengthM);
  a.verticesM[1]!.forEach((value, axis) => close(value, b.verticesM[1]![axis]!));
});

test("ACO-002: visibility rejects a reflection blocked on its real first segment", () => {
  const blocker: AcousticSurface = {
    id: "low-screen",
    materialId: "synthetic-reflector",
    normal: [1, 0, 0],
    verticesM: [
      [2, 0.1, -1],
      [2, 0.75, -1],
      [2, 0.75, 1],
      [2, 0.1, 1],
    ],
  };
  const result = solveAcoustics(reflectionRequest({ surfaces: [floor(), blocker] }));
  assert.equal(
    result.frame.paths.some((path) => path.surfaceIds.includes("floor")),
    false,
  );
  assert.equal(result.diagnostics.directOccluded, false);
  assert.ok(directPath(result.frame.paths));
});

test("direct occlusion removes the direct acoustic path and names its actual blocker", () => {
  const screen: AcousticSurface = {
    id: "screen",
    materialId: "synthetic-reflector",
    normal: [1, 0, 0],
    verticesM: [
      [2, 0, -1],
      [2, 2, -1],
      [2, 2, 1],
      [2, 0, 1],
    ],
  };
  const result = solveAcoustics(reflectionRequest({ surfaces: [screen] }));
  assert.equal(
    result.frame.paths.some((path) => path.order === 0),
    false,
  );
  assert.equal(result.diagnostics.directOccluded, true);
  assert.ok(result.diagnostics.blockedBySurfaceIds.includes("screen"));
  close(result.frame.directDelayS!, 4 / 343);
});

test("path identity survives source motion and request/revision/tick changes", () => {
  const first = solveAcoustics(reflectionRequest()).frame.paths;
  const next = solveAcoustics(
    reflectionRequest({
      requestId: "acceptance-002",
      sceneRevision: 4,
      geometryRevision: 3,
      poseTick: 121,
      source: { id: "source-a", positionM: [1.1, 1, 0] },
    }),
  ).frame.paths;
  assert.equal(directPath(first).id, directPath(next).id);
  assert.equal(floorPath(first).id, floorPath(next).id);
  assert.notEqual(floorPath(first).lengthM, floorPath(next).lengthM);
  const topologyChanged = solveAcoustics(reflectionRequest({ topologyId: "acceptance-room-v2" }))
    .frame.paths;
  assert.notEqual(floorPath(first).id, floorPath(topologyChanged).id);
});

test("AIR-001: explicit synthetic dB/m is applied once as a pressure factor", () => {
  const result = solveAcoustics(
    request({
      atmosphere: {
        medium: "air",
        speedOfSoundMps: 343,
        bandAbsorptionDbPerM: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1],
        dataClass: "Synthetic",
      },
    }),
  );
  const path = directPath(result.frame.paths);
  close(path.bandGains[0]!, 0.2);
  close(path.bandGains[6]!, 0.11246826503806982);
  assert.equal(result.diagnostics.speedModel, "explicit");
});

test("AIR-003: explicitly derived dry-air speed uses absolute temperature, not a fabricated RH model", () => {
  const cold = solveAcoustics(request({ atmosphere: { medium: "air", temperatureC: 0 } }));
  const warm = solveAcoustics(request({ atmosphere: { medium: "air", temperatureC: 20 } }));
  close(
    warm.diagnostics.speedOfSoundMps! / cold.diagnostics.speedOfSoundMps!,
    1.0359632438350979,
    1e-10,
  );
  assert.equal(warm.diagnostics.speedModel, "idealDryAirDerived");
  assert.ok(warm.frame.limitations.some((text) => /dry|ideal|乾|理想/i.test(text)));
});

test("MAT-001: reflection pressure is sqrt((1-s)R); scattered energy is excluded, not reclassified as absorption", () => {
  const result = solveAcoustics(reflectionRequest({ materials: [material(0.8, 0.25)] }));
  const reflected = floorPath(result.frame.paths);
  close(reflected.bandGains[0]!, 0.17320508075688773);
  close(reflected.bandGains[0]! ** 2 * 20, 0.6);
  close(directPath(result.frame.paths).bandGains[0]!, 0.25);
  assert.equal(result.diagnostics.materialDiffuseEnergyExcluded, true);
  assert.ok(result.frame.limitations.length > 0);
});

test("vacuum has no airborne acoustic paths while leaving mechanical scene data untouched", () => {
  const input = reflectionRequest({ atmosphere: { medium: "vacuum" } });
  const before = structuredClone(input);
  const result = solveAcoustics(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.frame.paths, []);
  assert.equal(result.frame.directDelayS, null);
  assert.equal(result.diagnostics.speedOfSoundMps, null);
  assert.equal(result.diagnostics.speedModel, "vacuum");
});

test("RT60/DRR/C50 and impulse response remain unavailable without a validated response", () => {
  const result = solveAcoustics(reflectionRequest());
  assert.deepEqual(
    [result.metrics.rt60Seconds, result.metrics.drrDb, result.metrics.c50Db],
    [null, null, null],
  );
  assert.ok(result.metrics.reason.length > 0);
  assert.equal(result.frame.impulseResponseArtifactId, null);
  assert.equal(result.frame.capabilities.includes("individualReflectionPaths"), true);
  assert.equal(result.frame.capabilities.includes("directParameters"), true);
  assert.equal((result.frame.capabilities as string[]).includes("impulseResponse"), false);
});

test("plain returned frame conforms to the original unchanged AcousticFrame v1 schema", () => {
  const schema = JSON.parse(
    readFileSync(new URL("../../schemas/acoustic-frame.schema.json", import.meta.url), "utf8"),
  );
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(schema);
  for (const input of [
    request(),
    reflectionRequest(),
    request({ atmosphere: { medium: "vacuum" } }),
  ]) {
    const frame = solveAcoustics(input).frame;
    assert.equal(validate(frame), true, JSON.stringify(validate.errors));
    assert.deepEqual(JSON.parse(JSON.stringify(frame)), frame);
  }
});

test("solver does not mutate frozen request/geometry/material arrays", () => {
  const input = reflectionRequest();
  const freeze = (value: unknown) => {
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
  };
  const before = JSON.stringify(input);
  freeze(input);
  solveAcoustics(input);
  assert.equal(JSON.stringify(input), before);
});

test("rejects singular, nonfinite, negative, nonconserving, and misaligned domains", () => {
  rejected(request({ listener: { id: "listener-a", positionM: [0, 0, 0] } }));
  rejected(request({ source: { id: "source-a", positionM: [NaN, 0, 0] } }));
  rejected(request({ listener: { id: "listener-a", positionM: [Infinity, 0, 0] } }));
  rejected(request({ atmosphere: { medium: "air", speedOfSoundMps: 0 } }));
  rejected(request({ bandCentersHz: [1000, 500] }));
  rejected(request({ bandCentersHz: [1000, 1000] }));
  rejected(
    request({ atmosphere: { medium: "air", speedOfSoundMps: 343, bandAbsorptionDbPerM: [-0.1] } }),
  );
  const invalidMaterial = material();
  invalidMaterial.bands = invalidMaterial.bands.map((band) => ({ ...band, absorptionEnergy: 0.5 }));
  rejected(request({ materials: [invalidMaterial] }));
  rejected(request({ materials: [{ ...material(), bands: material().bands.slice(0, 2) }] }));
});

test("rejects degenerate/nonplanar/nonconvex polygons and unresolved material identity", () => {
  rejected(
    reflectionRequest({
      surfaces: [
        {
          ...floor(),
          verticesM: [
            [0, 0, 0],
            [1, 0, 0],
            [2, 0, 0],
          ],
        },
      ],
    }),
  );
  rejected(
    reflectionRequest({
      surfaces: [
        {
          ...floor(),
          verticesM: [
            [0, 0, 0],
            [0, 0, 2],
            [2, 1, 2],
            [2, 0, 0],
          ],
        },
      ],
    }),
  );
  rejected(
    reflectionRequest({
      surfaces: [
        {
          ...floor(),
          verticesM: [
            [0, 0, 0],
            [0, 0, 2],
            [1, 0, 1],
            [2, 0, 2],
            [2, 0, 0],
          ],
        },
      ],
    }),
  );
  rejected(reflectionRequest({ surfaces: [{ ...floor(), materialId: "missing" }] }));
  rejected(reflectionRequest({ surfaces: [floor(), floor()] }));
});

test("bounded path selection never returns more than its declared admission limit", () => {
  const result = solveAcoustics(reflectionRequest({ budget: { maxPaths: 1 } }));
  assert.ok(result.frame.paths.length <= 1);
  assert.equal(result.diagnostics.budgetExceeded, true);
  assert.ok(result.diagnostics.droppedPathCount > 0);
  assert.ok(
    directPath(result.frame.paths),
    "Direct visibility has priority over an early reflection",
  );
});

test("segment budget is strict and fails closed rather than emitting an unchecked path", () => {
  const result = solveAcoustics(reflectionRequest({ budget: { maxSegmentTests: 1 } }));
  assert.ok(result.diagnostics.segmentTests <= 1);
  assert.equal(result.diagnostics.budgetExceeded, true);
  assert.equal(
    result.frame.paths.some((path) => path.order > 0),
    false,
  );
});

test("invalid budget values cannot bypass bounded work", () => {
  rejected(request({ budget: { maxPaths: NaN } }));
  rejected(request({ budget: { maxSegmentTests: Infinity } }));
  rejected(request({ budget: { maxSurfaces: -1 } }));
  rejected(request({ budget: { minimumDistanceM: 0 } }));
});

test("untrusted non-array bands, atmospheric coefficients, and budget objects are explicitly rejected", () => {
  rejected({ ...request(), bandCentersHz: {} } as unknown as AcousticRequest);
  rejected({
    ...request(),
    atmosphere: { medium: "air", bandAbsorptionDbPerM: {} },
  } as unknown as AcousticRequest);
  rejected({
    ...request(),
    materials: [{ ...material(), bands: {} }],
  } as unknown as AcousticRequest);
  rejected({ ...request(), budget: [] } as unknown as AcousticRequest);
  rejected({ ...request(), surfaces: {} } as unknown as AcousticRequest);
});

test("oriented box surfaces preserve exact 90-degree Y rotation and stable face identity", () => {
  const faces = createBoxSurfaces({
    id: "box-a",
    materialId: "synthetic-reflector",
    positionM: [0, 0, 0],
    dimensionsM: [2, 4, 6],
    orientationQuaternion: [0, 0.7071067811865476, 0, 0.7071067811865476],
  });
  assert.equal(faces.length, 6);
  assert.equal(new Set(faces.map((face) => face.id)).size, 6);
  const px = faces.find((face) => face.id === "box-a.px");
  assert.ok(px?.normal);
  close(px.normal[0], 0);
  close(px.normal[1], 0);
  close(px.normal[2], -1);
  for (const vertex of px.verticesM) {
    close(vertex[2], -1);
    close(Math.abs(vertex[0]), 3);
    close(Math.abs(vertex[1]), 2);
  }
  const frame = solveAcoustics(
    request({
      source: { id: "source-a", positionM: [5, 1, -5] },
      listener: { id: "listener-a", positionM: [6, 1, -5] },
      surfaces: faces,
    }),
  ).frame;
  assert.ok(frame.paths.length > 0);
  assert.ok(
    frame.paths.every((path) =>
      path.surfaceIds.every((id) => faces.some((face) => face.id === id)),
    ),
  );
});

test("dynamic occluder snapshots block/unblock direct sound without inventing dynamic reflections", () => {
  const movingBox = (z: number) =>
    createBoxSurfaces({
      id: "moving-box",
      materialId: "synthetic-reflector",
      positionM: [3, 1, z],
      dimensionsM: [0.5, 2, 2],
      role: "dynamicOccluder",
    });
  const blocked = solveAcoustics(reflectionRequest({ surfaces: movingBox(0) }));
  assert.equal(blocked.diagnostics.directOccluded, true);
  assert.equal(blocked.frame.paths.length, 0);
  const unblocked = solveAcoustics(
    reflectionRequest({ geometryRevision: 3, poseTick: 121, surfaces: movingBox(4) }),
  );
  assert.equal(unblocked.diagnostics.directOccluded, false);
  assert.equal(unblocked.frame.paths.length, 1);
  assert.equal(directPath(unblocked.frame.paths).order, 0);
  assert.equal(
    unblocked.frame.paths.some((path) =>
      path.surfaceIds.some((id) => id.startsWith("moving-box.")),
    ),
    false,
  );
  assert.ok(unblocked.frame.capabilities.includes("dynamicOccluders"));
  assert.equal((unblocked.frame.capabilities as string[]).includes("dynamicReflectors"), false);
});

test("accepted near-unit surface normal is normalized before reflection geometry", () => {
  const result = solveAcoustics(
    reflectionRequest({
      surfaces: [{ ...floor(), normal: [0, 1.0000005, 0] }],
    }),
  );
  const reflected = floorPath(result.frame.paths);
  reflected.verticesM[1]!.forEach((value, axis) => close(value, [3, 0, 0][axis]!, 1e-10));
  close(reflected.lengthM, 4.47213595499958, 1e-10);
});

test("sparse material bands cannot silently become unity-gain reflection coefficients", () => {
  rejected(
    reflectionRequest({
      materials: [{ ...material(), bands: Array<AcousticMaterial["bands"][number]>(7) }],
    }),
  );
});

test("sparse surfaces, polygon vertices, and endpoint vectors produce explicit domain errors", () => {
  rejected(reflectionRequest({ surfaces: Array<AcousticSurface>(1) }));
  rejected(
    reflectionRequest({
      surfaces: [{ ...floor(), verticesM: Array<AcousticSurface["verticesM"][number]>(4) }],
    }),
  );
  rejected(
    request({
      source: {
        id: "source-a",
        positionM: Array(3) as unknown as readonly [number, number, number],
      },
    }),
  );
  rejected(
    reflectionRequest({
      surfaces: [{ ...floor(), normal: Array(3) as unknown as readonly [number, number, number] }],
    }),
  );
});

test("nonfinite atmosphere inputs are rejected even when another medium/speed branch would not use them", () => {
  rejected(request({ atmosphere: { medium: "vacuum", speedOfSoundMps: NaN } }));
  rejected(request({ atmosphere: { medium: "air", speedOfSoundMps: 343, temperatureC: NaN } }));
});

test("64-character Scene object IDs produce six stable suffixed acoustic faces without widening endpoint/material IDs", () => {
  const objectId = "a".repeat(64),
    materialId = "c".repeat(64);
  const box = {
    id: objectId,
    materialId,
    positionM: [0, 0, 0] as const,
    dimensionsM: [2, 2, 2] as const,
  };
  const faces = createBoxSurfaces(box);
  assert.equal(faces.length, 6);
  assert.equal(new Set(faces.map((face) => face.id)).size, 6);
  assert.deepEqual(
    faces.map((face) => face.id),
    createBoxSurfaces(box).map((face) => face.id),
  );
  assert.ok(faces.every((face) => face.id.startsWith(`${objectId}.`) && face.id.length <= 72));
  const result = solveAcoustics(
    request({
      source: { id: "s".repeat(64), positionM: [5, 1, -5] },
      listener: { id: "l".repeat(64), positionM: [6, 1, -5] },
      materials: [{ ...material(), id: materialId }],
      surfaces: faces,
    }),
  );
  assert.equal(result.frame.sourceId.length, 64);
  assert.equal(result.frame.listenerId.length, 64);
  assert.ok(directPath(result.frame.paths));
  rejected(request({ source: { id: "s".repeat(65), positionM: [0, 0, 0] } }));
  rejected(request({ listener: { id: "l".repeat(65), positionM: [3, 4, 0] } }));
  rejected(request({ materials: [{ ...material(), id: "c".repeat(65) }] }));
});
