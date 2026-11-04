import assert from "node:assert/strict";
import test from "node:test";
import {
  AcousticSolverError,
  createBoxSurfaces,
  EXTENDED_SOLVER_VERSION,
  SOLVER_VERSION,
  solveAcoustics,
} from "../../src/acoustics/index.js";
import type {
  AcousticBoxOccluder,
  AcousticPrimitive,
  AcousticRequest,
  AcousticSolution,
  AcousticSurface,
} from "../../src/acoustics/types.js";
import { AcousticService } from "../../src/app/acoustic-service.js";
import type { AcousticServiceOptions } from "../../src/app/acoustic-service.js";

const box = (): AcousticBoxOccluder => ({
  id: "blocker.volume",
  materialId: "material",
  centerM: [0, 0, 0],
  halfExtentsM: [0.25, 0.5, 0.75],
  orientationQuaternion: [0, 0, 0, 1],
});
const sphere = (): AcousticPrimitive => ({
  id: "sphere.body",
  kind: "sphere",
  materialId: "material",
  centerM: [20, 0, 0],
  radiusM: 0.5,
  role: "dynamicOccluder",
});
const plane = (): AcousticSurface => ({
  id: "floor.surface",
  materialId: "material",
  verticesM: [
    [-5, -3, -5],
    [-5, -3, 5],
    [5, -3, 5],
    [5, -3, -5],
  ],
  normal: [0, 1, 0],
});
const request = (patch: Partial<AcousticRequest> = {}): AcousticRequest => ({
  requestId: "geometry-contract",
  sceneRevision: 3,
  geometryRevision: 3,
  poseTick: 12,
  topologyId: "contract.scene",
  source: { id: "source", positionM: [-2, 0, 0] },
  listener: { id: "listener", positionM: [2, 0, 0] },
  surfaces: [],
  materials: [
    {
      schemaVersion: "1.0.0",
      id: "material",
      revision: 1,
      label: "Synthetic contract fixture",
      dataClass: "Synthetic",
      sourceUrls: [],
      conditions: "Original synthetic zero-phase fixture; not a material measurement",
      phaseModel: "zeroPhaseMagnitudeOnly",
      bands: [
        {
          centerHz: 500,
          absorptionEnergy: 0.25,
          reflectionEnergy: 0.75,
          transmissionEnergy: 0,
          scatteringFraction: 0,
        },
      ],
    },
  ],
  atmosphere: { medium: "air", speedOfSoundMps: 343 },
  bandCentersHz: [500],
  budget: { maxPaths: 8 },
  ...patch,
});
function rejected(input: AcousticRequest): void {
  assert.throws(
    () => solveAcoustics(input),
    (error: unknown) => {
      assert.ok(
        error instanceof AcousticSolverError,
        "malformed domain input must have a domain error",
      );
      assert.equal(typeof error.code, "string");
      assert.ok(error.code.length > 0);
      return true;
    },
  );
}

test("legacy planar request stays unmodified and retains legacy frame/path identity", () => {
  const input = request({
    surfaces: createBoxSurfaces({
      id: "wall",
      positionM: [0, -3, 0],
      dimensionsM: [10, 0.5, 10],
      materialId: "material",
    }),
  });
  const bytes = JSON.stringify(input);
  const solution = solveAcoustics(input);
  assert.equal(JSON.stringify(input), bytes);
  for (const key of ["modelVersion", "primitives", "boxOccluders"])
    assert.equal(Object.hasOwn(input, key), false, key);
  assert.equal(solution.frame.backendVersion, SOLVER_VERSION);
  assert.ok(solution.frame.paths.length > 0);
  assert.ok(solution.frame.paths.every((path) => path.id.startsWith(SOLVER_VERSION + "|")));
});

test("unknown and non-string model pins fail explicitly", () => {
  for (const pin of ["", "unknown", "web-geometric-999", null, 1, {}])
    rejected(request({ modelVersion: pin as string }));
});

test("a legacy model pin cannot accept curves, box volumes or moving reflector features", () => {
  for (const patch of [
    { primitives: [sphere()] },
    { boxOccluders: [box()] },
    { surfaces: [{ ...plane(), role: "dynamicReflector" as const }] },
    { primitives: [{ ...sphere(), role: "dynamicReflector" as const }] },
  ])
    rejected(request({ modelVersion: SOLVER_VERSION, ...patch }));
});

test("an explicit extended pin survives empty geometry and owns the direct-path prefix", () => {
  const solution = solveAcoustics(request({ modelVersion: EXTENDED_SOLVER_VERSION }));
  assert.equal(solution.frame.backendVersion, EXTENDED_SOLVER_VERSION);
  assert.equal(solution.frame.paths.length, 1);
  assert.ok(solution.frame.paths[0]!.id.startsWith(EXTENDED_SOLVER_VERSION + "|"));
  assert.equal(solution.frame.paths[0]!.lengthM, 4);
  assert.equal(solution.frame.paths[0]!.bandGains[0], 0.25);
});

test("OBB shape validation rejects malformed fields, nonfinite values and non-unit orientation", () => {
  const malformed: unknown[] = [
    null,
    [],
    {},
    { ...box(), id: "bad id" },
    { ...box(), materialId: "missing" },
    { ...box(), role: "dynamicReflector" },
    { ...box(), halfExtentsM: [0, 0.5, 0.5] },
    { ...box(), halfExtentsM: [-1, 0.5, 0.5] },
    { ...box(), halfExtentsM: [NaN, 0.5, 0.5] },
    { ...box(), centerM: [Infinity, 0, 0] },
    { ...box(), centerM: [200, 0, 0] },
    { ...box(), orientationQuaternion: [0, 0, 0, 2] },
    { ...box(), orientationQuaternion: [0, 0, 0] },
  ];
  for (const value of malformed)
    rejected(request({ boxOccluders: [value as AcousticBoxOccluder] }));
});

test("sparse OBB containers and vector/quaternion arrays fail rather than silently disappear", () => {
  const sparse = new Array<AcousticBoxOccluder>(1);
  rejected(request({ boxOccluders: sparse }));
  for (const key of ["centerM", "halfExtentsM", "orientationQuaternion"] as const) {
    const value = box();
    delete (value[key] as unknown[])[0];
    rejected(request({ boxOccluders: [value] }));
  }
});

test("geometry identities remain unique across all three wire collections", () => {
  const a = box();
  rejected(request({ boxOccluders: [a, structuredClone(a)] }));
  rejected(request({ surfaces: [{ ...plane(), id: a.id }], boxOccluders: [a] }));
  rejected(request({ primitives: [{ ...sphere(), id: a.id }], boxOccluders: [a] }));
});

test("the same geometry budget admits its exact combined count and rejects one below", () => {
  const input = request({
    surfaces: [plane()],
    primitives: [sphere()],
    boxOccluders: [{ ...box(), centerM: [0, 10, 0] }],
    budget: { maxSurfaces: 3, maxPaths: 8 },
  });
  assert.equal(solveAcoustics(input).frame.pathAvailability, "available");
  rejected({ ...input, budget: { maxSurfaces: 2, maxPaths: 8 } });
  rejected(
    request({
      boxOccluders: Array.from({ length: 257 }, (_, i) => ({ ...box(), id: "box." + i })),
    }),
  );
});

type Port = ReturnType<NonNullable<AcousticServiceOptions["workerFactory"]>>;
interface Batch {
  batchId: number;
  requests: AcousticRequest[];
}
interface Reply {
  batchId: number;
  computeMs: number;
  results: { sourceId: string; solution?: AcousticSolution; error?: string }[];
}
/** Structured-clone test transport with the production solver; not a native browser Worker. */
class SerializedPort implements Port {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  messages: Batch[] = [];
  constructor(private readonly transform?: (reply: Reply) => void) {}
  terminate(): void {}
  postMessage(value: unknown): void {
    const batch = structuredClone(value as Batch);
    this.messages.push(batch);
    queueMicrotask(() => {
      const reply: Reply = {
        batchId: batch.batchId,
        computeMs: 0,
        results: batch.requests.map((input) => {
          try {
            return { sourceId: input.source.id, solution: solveAcoustics(input) };
          } catch (error) {
            return {
              sourceId: input.source.id,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      };
      this.transform?.(reply);
      this.onmessage?.call(this as unknown as Worker, new MessageEvent("message", { data: reply }));
    });
  }
}

test("real service dispatch preserves OBB data and rejects caller-side mutation as a new snapshot", async () => {
  const port = new SerializedPort();
  const service = new AcousticService(true, { workerFactory: () => port });
  try {
    const input = request({ modelVersion: EXTENDED_SOLVER_VERSION, boxOccluders: [box()] });
    const pending = service.solve([input]);
    (input.boxOccluders![0]!.centerM as number[])[1] = 10;
    input.modelVersion = SOLVER_VERSION;
    const [result] = await pending;
    assert.ok(result);
    assert.deepEqual(port.messages[0]!.requests[0]!.boxOccluders![0]!.centerM, [0, 0, 0]);
    assert.equal(result.diagnostics.directOccluded, true);
    assert.deepEqual(result.diagnostics.blockedBySurfaceIds, ["blocker.volume"]);
    assert.equal(result.frame.backendVersion, EXTENDED_SOLVER_VERSION);
    const unblocked = request({
      requestId: "moved-box",
      poseTick: 13,
      boxOccluders: [{ ...box(), centerM: [0, 10, 0] }],
    });
    const [next] = await service.solve([unblocked]);
    assert.equal(next!.diagnostics.directOccluded, false);
    assert.equal(next!.frame.paths[0]!.lengthM, 4);
    assert.equal(service.getTelemetry().completedBatches, 2);
  } finally {
    service.dispose();
  }
});

test("service rejects malformed sparse or over-budget OBB payloads before dispatch", async () => {
  const port = new SerializedPort();
  const service = new AcousticService(true, { workerFactory: () => port });
  try {
    for (const payload of [
      null,
      new Array<AcousticBoxOccluder>(1),
      Array.from({ length: 257 }, (_, i) => ({ ...box(), id: "box." + i })),
    ])
      await assert.rejects(
        service.solve([request({ boxOccluders: payload as AcousticBoxOccluder[] })]),
      );
    assert.equal(port.messages.length, 0);
  } finally {
    service.dispose();
  }
});

for (const fault of ["model", "backend", "path-prefix"] as const)
  test(
    "service fails closed on a " + fault + " mismatch from an otherwise identity-matching reply",
    async () => {
      const port = new SerializedPort((reply) => {
        const frame = reply.results[0]!.solution!.frame;
        if (fault === "model") frame.backendVersion = SOLVER_VERSION;
        else if (fault === "backend") frame.backendId = "other-backend";
        else frame.paths[0]!.id = SOLVER_VERSION + "|wrong-prefix";
      });
      const service = new AcousticService(true, { workerFactory: () => port });
      try {
        const input = request({ modelVersion: EXTENDED_SOLVER_VERSION });
        const pending = service.solve([input]);
        input.modelVersion = SOLVER_VERSION;
        await assert.rejects(pending, /ACOUSTIC_REPLY_IDENTITY/);
        assert.equal(service.getTelemetry().completedBatches, 0);
        assert.equal(service.getTelemetry().failedBatches, 1);
      } finally {
        service.dispose();
      }
    },
  );
