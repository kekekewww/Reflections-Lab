import assert from "node:assert/strict";
import test from "node:test";
import { AcousticSolverError, solveAcoustics } from "../../src/acoustics/solver.js";
import type { AcousticRequest } from "../../src/acoustics/types.js";
import { validateFrame } from "../../src/audio/routes.js";

const request = (maximumDelay: number, distanceM = 1): AcousticRequest => ({
  requestId: "propagation-contract",
  sceneRevision: 0,
  geometryRevision: 0,
  poseTick: 0,
  source: { id: "source-a", positionM: [-distanceM / 2, 0, 0] },
  listener: { id: "listener-a", positionM: [distanceM / 2, 0, 0] },
  surfaces: [],
  materials: [],
  bandCentersHz: [1000],
  atmosphere: { medium: "air", speedOfSoundMps: 100 },
  budget: { maxPropagationSeconds: maximumDelay },
});

// A widened solver-only bound must fail before an unrenderable frame escapes.
for (const maximumDelay of [5 + 1e-9, 10]) {
  test(`solver rejects ${maximumDelay}s propagation configuration before audio admission`, () => {
    assert.throws(
      () => solveAcoustics(request(maximumDelay)),
      (error: unknown) => error instanceof AcousticSolverError && error.code === "INVALID_BUDGET",
    );
  });
}

for (const maximumDelay of [0.001, 5]) {
  test(`solver accepts the supported ${maximumDelay}s configuration`, () => {
    const result = solveAcoustics(request(maximumDelay, 0.1));
    assert.equal(result.frame.paths.length, 1);
    assert.equal(result.frame.paths[0]?.absoluteDelayS, 0.001);
    assert.doesNotThrow(() => validateFrame(result.frame));
  });
}

test("a path at the five-second boundary remains renderable", () => {
  // Each coordinate stays in the domain [-200,200]; this distance is exactly 500m.
  const input = request(5);
  input.source = { id: "source-a", positionM: [-150, -200, 0] };
  input.listener = { id: "listener-a", positionM: [150, 200, 0] };
  const result = solveAcoustics(input);
  assert.equal(result.frame.paths[0]?.absoluteDelayS, 5);
  assert.doesNotThrow(() => validateFrame(result.frame));
});

test("a path beyond five seconds is dropped with explicit incomplete-budget diagnostics", () => {
  const input = request(5);
  input.source = { id: "source-a", positionM: [-200, -200, -200] };
  input.listener = { id: "listener-a", positionM: [200, 200, 200] };
  const result = solveAcoustics(input);
  assert.equal(result.frame.paths.length, 0);
  assert.equal(result.diagnostics.budgetExceeded, true);
  assert.equal(result.diagnostics.droppedPathCount, 1);
  assert.doesNotThrow(() => validateFrame(result.frame));
});
