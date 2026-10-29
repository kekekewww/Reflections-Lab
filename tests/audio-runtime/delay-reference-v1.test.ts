import assert from "node:assert/strict";
import test from "node:test";
import { DELAY_REFERENCE_CASES_V1, predictDelayReferenceV1 } from "./delay-reference-model-v1.js";

test("versioned native reference has nine fixed bounded graphs", () => {
  assert.equal(DELAY_REFERENCE_CASES_V1.length, 9);
  assert.equal(new Set(DELAY_REFERENCE_CASES_V1.map((value) => value.id)).size, 9);
  assert.equal(9 * 2 * 12000 * 4, 864000);
});

test("representable sample delays retain one impulse and equalpower energy", () => {
  for (const suffix of ["zero", "delay-025", "delay-125"]) {
    const spec = DELAY_REFERENCE_CASES_V1.find((value) => value.id === `gain-only-${suffix}`)!;
    const prediction = predictDelayReferenceV1(spec);
    assert.equal(prediction.paths[0]!.fractionalFrames, 0);
    assert.equal(prediction.sparsePcm[0]!.length, 1);
    assert.equal(prediction.energy, 2 * Math.fround(0.25 * Math.fround(Math.SQRT1_2)) ** 2);
  }
});

test("Float32 75ms delay predicts the main and adjacent samples before native observation", () => {
  const spec = DELAY_REFERENCE_CASES_V1.find((value) => value.id === "gain-only-delay-075")!;
  const prediction = predictDelayReferenceV1(spec);
  assert.equal(prediction.paths[0]!.delayFrames, 3600.000244140625);
  assert.equal(prediction.paths[0]!.fractionalFrames, 1 / 4096);
  assert.deepEqual(prediction.sparsePcm[0], [
    { index: 6480, value: 0.17673353850841522 },
    { index: 6481, value: 0.0000431583721365314 },
  ]);
});

test("independent two-path arithmetic explains the stored signature without changing its failed oracle", () => {
  const prediction = predictDelayReferenceV1(DELAY_REFERENCE_CASES_V1.at(-1)!);
  assert.equal(prediction.idealEnergy, 0.3125);
  assert.equal(prediction.energy, 0.3124694824355657);
  assert.ok(Math.abs(prediction.energy - 0.31246948243551215) < 1e-12);
  assert.ok(Math.abs(prediction.energy - prediction.idealEnergy) > 1e-5);
  assert.deepEqual(
    prediction.sparsePcm[0]!.map((sample) => sample.index),
    [4080, 6480, 6481],
  );
});
