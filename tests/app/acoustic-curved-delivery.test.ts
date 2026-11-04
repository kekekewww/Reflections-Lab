import assert from "node:assert/strict";
import test from "node:test";
import { AcousticService } from "../../src/app/acoustic-service.js";
import type { AcousticServiceOptions } from "../../src/app/acoustic-service.js";
import { solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticRequest } from "../../src/acoustics/types.js";
type Port = ReturnType<NonNullable<AcousticServiceOptions["workerFactory"]>>;
type Batch = { batchId: number; requests: AcousticRequest[] };
class Loopback implements Port {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  posted = 0;
  terminate() {}
  postMessage(value: unknown) {
    this.posted++;
    const batch = structuredClone(value as Batch);
    queueMicrotask(() =>
      this.onmessage?.call(
        this as unknown as Worker,
        new MessageEvent("message", {
          data: {
            batchId: batch.batchId,
            computeMs: 0,
            results: batch.requests.map((request) => ({
              sourceId: request.source.id,
              solution: solveAcoustics(request),
            })),
          },
        }),
      ),
    );
  }
}
const request = (): AcousticRequest => ({
  requestId: "curved-wire",
  sceneRevision: 0,
  geometryRevision: 0,
  poseTick: 1,
  source: { id: "source", positionM: [-2, 2, 0] },
  listener: { id: "listener", positionM: [2, 2, 0] },
  surfaces: [],
  primitives: [
    {
      id: "curved.body",
      kind: "sphere",
      materialId: "material",
      centerM: [0, 0, 0],
      radiusM: 1,
      role: "dynamicReflector",
    },
  ],
  materials: [
    {
      schemaVersion: "1.0.0",
      id: "material",
      revision: 0,
      label: "Synthetic",
      dataClass: "Synthetic",
      sourceUrls: [],
      conditions: "Control-only fixture",
      phaseModel: "zeroPhaseMagnitudeOnly",
      bands: [
        {
          centerHz: 500,
          reflectionEnergy: 1,
          absorptionEnergy: 0,
          transmissionEnergy: 0,
          scatteringFraction: 0,
        },
      ],
    },
  ],
  atmosphere: { medium: "air", speedOfSoundMps: 343 },
  bandCentersHz: [500],
  budget: { maxPaths: 8 },
});
test("curved/dynamic reflection frames pass the real service reply boundary without losing captured snapshot ownership", async () => {
  const port = new Loopback(),
    service = new AcousticService(true, { workerFactory: () => port });
  try {
    const input = request();
    const result = service.solve([input]);
    (input.primitives![0]!.centerM as [number, number, number])[1] = 99;
    const frames = await result;
    const path = frames[0]!.frame.paths.find((p) => p.order === 1)!;
    assert.ok(path);
    assert.equal(frames[0]!.frame.capabilities.includes("dynamicReflectors"), true);
    assert.ok(Math.abs(path.verticesM[1]![1] - 1) < 2e-7);
    assert.equal(service.getTelemetry().completedBatches, 1);
  } finally {
    service.dispose();
  }
});
test("service rejects malformed or combined over-budget primitive payloads before Worker dispatch", async () => {
  const port = new Loopback(),
    service = new AcousticService(true, { workerFactory: () => port });
  try {
    const malformed = request();
    malformed.primitives = null as unknown as AcousticRequest["primitives"];
    await assert.rejects(service.solve([malformed]), /ACOUSTIC_PAYLOAD_BUDGET/);
    const tooMany = request();
    tooMany.primitives = Array.from({ length: 257 }, (_, i) => ({
      ...request().primitives![0]!,
      id: "p." + i,
    }));
    await assert.rejects(service.solve([tooMany]), /ACOUSTIC_PAYLOAD_BUDGET/);
    assert.equal(port.posted, 0);
  } finally {
    service.dispose();
  }
});
