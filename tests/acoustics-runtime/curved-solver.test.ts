import assert from "node:assert/strict";
import test from "node:test";
import {
  AcousticSolverError,
  createBoxSurfaces,
  solveAcoustics,
  EXTENDED_SOLVER_VERSION,
  SOLVER_VERSION,
} from "../../src/acoustics/index.js";
import type {
  AcousticMaterial,
  AcousticPrimitive,
  AcousticRequest,
} from "../../src/acoustics/types.js";

const material: AcousticMaterial = {
  schemaVersion: "1.0.0",
  id: "test.material",
  revision: 0,
  label: "Original synthetic geometry fixture",
  dataClass: "Synthetic",
  sourceUrls: [],
  conditions: "Same-medium magnitude model; not a measured material",
  phaseModel: "zeroPhaseMagnitudeOnly",
  bands: [
    {
      centerHz: 500,
      absorptionEnergy: 0.36,
      reflectionEnergy: 0.64,
      transmissionEnergy: 0,
      scatteringFraction: 0.25,
    },
  ],
};
const sphere = (patch: Partial<AcousticPrimitive> = {}): AcousticPrimitive => ({
  id: "test.sphere",
  kind: "sphere",
  materialId: material.id,
  centerM: [0, 0, 0],
  radiusM: 1,
  role: "staticReflector",
  ...patch,
});
const request = (patch: Partial<AcousticRequest> = {}): AcousticRequest => ({
  requestId: "geometry-fixture",
  sceneRevision: 0,
  geometryRevision: 0,
  poseTick: 0,
  topologyId: "geometry-fixture",
  source: { id: "source", positionM: [-2, 2, 0] },
  listener: { id: "listener", positionM: [2, 2, 0] },
  surfaces: [],
  materials: [material],
  atmosphere: { medium: "air", speedOfSoundMps: 343 },
  bandCentersHz: [500],
  ...patch,
});
const close = (a: number, b: number, tolerance = 1e-10) =>
  assert.ok(Math.abs(a - b) <= tolerance, String(a) + " != " + String(b));
const reject = (patch: Partial<AcousticRequest>, code?: string) =>
  assert.throws(
    () => solveAcoustics(request(patch)),
    (e: unknown) => e instanceof AcousticSolverError && (!code || e.code === code),
  );

test("curved sphere solves a true first-order point and preserves pressure, scattering and absolute delay semantics", () => {
  const result = solveAcoustics(request({ primitives: [sphere()] }));
  const path = result.frame.paths.find((p) => p.order === 1)!;
  assert.ok(path);
  path.verticesM[1]!.forEach((v, i) => close(v, [0, 1, 0][i]!, 2e-7));
  close(path.lengthM, Math.sqrt(20), 2e-7);
  close(path.bandGains[0]!, Math.sqrt(0.64 * 0.75) / Math.sqrt(20), 2e-8);
  close(path.absoluteDelayS, Math.sqrt(20) / 343, 1e-9);
  close(path.relativeDelayS, (Math.sqrt(20) - 4) / 343, 1e-9);
  assert.equal(result.frame.backendVersion, EXTENDED_SOLVER_VERSION);
  assert.equal(result.diagnostics.materialDiffuseEnergyExcluded, true);
  assert.ok(result.frame.limitations.some((s) => s.includes("focusing")));
  assert.equal(result.frame.capabilities.includes("dynamicReflectors"), false);
});

test("analytic closed-volume occlusion changes with the real snapshot and does not invent a dynamic reflection", () => {
  const make = (y: number) =>
    request({
      source: { id: "source", positionM: [-3, 0, 0] },
      listener: { id: "listener", positionM: [3, 0, 0] },
      primitives: [sphere({ centerM: [0, y, 0], role: "dynamicOccluder" })],
    });
  const blocked = solveAcoustics(make(0));
  assert.equal(blocked.diagnostics.directOccluded, true);
  assert.deepEqual(blocked.frame.paths, []);
  assert.deepEqual(blocked.diagnostics.blockedBySurfaceIds, ["test.sphere"]);
  const clear = solveAcoustics(make(3));
  assert.equal(clear.diagnostics.directOccluded, false);
  assert.equal(clear.frame.paths.length, 1);
  close(clear.frame.paths[0]!.lengthM, 6);
  assert.equal(clear.frame.paths[0]!.order, 0);
});

test("moving planar and curved reflectors retain path IDs while actual vertices and delay change", () => {
  const curved = (y: number) =>
    solveAcoustics(
      request({
        poseTick: y ? 1 : 0,
        primitives: [sphere({ centerM: [0, y, 0], role: "dynamicReflector" })],
      }),
    );
  const a = curved(0).frame.paths.find((p) => p.order === 1)!;
  const b = curved(0.2).frame.paths.find((p) => p.order === 1)!;
  assert.ok(a && b);
  assert.equal(a.id, b.id);
  assert.notDeepEqual(a.verticesM, b.verticesM);
  assert.notEqual(a.absoluteDelayS, b.absoluteDelayS);
  assert.equal(curved(0).frame.capabilities.includes("dynamicReflectors"), true);
  const planar = (y: number) =>
    solveAcoustics(
      request({
        surfaces: createBoxSurfaces({
          id: "moving",
          positionM: [0, y - 0.05, 0],
          dimensionsM: [8, 0.1, 8],
          materialId: material.id,
          role: "dynamicReflector",
        }),
      }),
    );
  const x = planar(0).frame.paths.find((p) => p.surfaceIds[0] === "moving.py")!;
  const z = planar(0.25).frame.paths.find((p) => p.surfaceIds[0] === "moving.py")!;
  assert.ok(x && z);
  assert.equal(x.id, z.id);
  close(x.verticesM[1]![1], 0);
  close(z.verticesM[1]![1], 0.25);
  assert.equal(planar(0).frame.capabilities.includes("dynamicReflectors"), true);
});

test("old planar-only request retains original solver version and declared capability", () => {
  const result = solveAcoustics(request());
  assert.equal(result.frame.backendVersion, SOLVER_VERSION);
  assert.equal(result.frame.paths[0]!.id.startsWith(SOLVER_VERSION + "|"), true);
  assert.deepEqual(result.frame.capabilities, [
    "directParameters",
    "individualReflectionPaths",
    "dynamicOccluders",
  ]);
});

test("primitive validation rejects malformed identity, geometry, sparse input and duplicate namespaces", () => {
  for (const patch of [
    { radiusM: NaN },
    { radiusM: 0 },
    { radiusM: Infinity },
    { kind: "cylinder" },
    { role: "unknown" },
    { centerM: [1, 2] },
    { centerM: [200, 0, 0] },
    { axis: [1, 0, 0] },
    { materialId: "missing" },
    { unrecognized: 1 },
  ])
    reject({ primitives: [sphere(patch as Partial<AcousticPrimitive>)] });
  reject({ primitives: null as unknown as AcousticPrimitive[] });
  reject({ primitives: Array(1) }, "INVALID_PRIMITIVE");
  reject(
    { primitives: [sphere({ centerM: Array(3) as unknown as [number, number, number] })] },
    "INVALID_PRIMITIVE",
  );
  reject({ primitives: [sphere(), sphere()] }, "DUPLICATE_SURFACE");
  reject(
    {
      surfaces: [
        {
          id: "test.sphere",
          verticesM: [
            [-2, 0, -2],
            [-2, 0, 2],
            [2, 0, 2],
            [2, 0, -2],
          ],
          materialId: material.id,
        },
      ],
      primitives: [sphere()],
    },
    "DUPLICATE_SURFACE",
  );
  for (const axis of [
    [0, 0, 0],
    [0, 2, 0],
    [0, NaN, 0],
  ])
    reject(
      {
        primitives: [
          sphere({ kind: "capsule", axis: axis as [number, number, number], halfLengthM: 1 }),
        ],
      },
      "INVALID_PRIMITIVE",
    );
});

test("combined primitive/plane geometry and visibility stay under the unchanged explicit budgets", () => {
  const distant = Array.from({ length: 105 }, (_, i) =>
    sphere({
      id: "sphere." + i,
      centerM: [20 + (i % 10), 20 + Math.floor(i / 10), 0],
      radiusM: 0.2,
      role: "dynamicOccluder",
    }),
  );
  const within = solveAcoustics(
    request({ primitives: distant, budget: { maxSurfaces: 105, maxSegmentTests: 105 } }),
  );
  assert.equal(within.diagnostics.segmentTests, 105);
  assert.equal(within.diagnostics.budgetExceeded, false);
  assert.equal(within.frame.paths.length, 1);
  reject({ primitives: distant, budget: { maxSurfaces: 104 } }, "SURFACE_BUDGET");
  const incomplete = solveAcoustics(
    request({ primitives: distant, budget: { maxSegmentTests: 1 } }),
  );
  assert.equal(incomplete.diagnostics.budgetExceeded, true);
  assert.equal(incomplete.diagnostics.directOccluded, null);
  assert.equal(incomplete.frame.pathAvailability, "failed");
  assert.equal(incomplete.frame.paths.length, 0);
});
