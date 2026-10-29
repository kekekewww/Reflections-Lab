import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as math from "../../scripts/validation/analytic-kernels.mjs";

const deck = JSON.parse(
  readFileSync(new URL("../../benchmarks/fixtures/analytical.json", import.meta.url), "utf8"),
);
const close = (actual, expected, tolerance) => {
  assert.ok(Number.isFinite(actual), `nonfinite actual ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
};
const getSurfaces = (ids = []) =>
  ids.map((id) => {
    assert.ok(deck.surfaces[id], `unknown surface ${id}`);
    return deck.surfaces[id];
  });
for (const fixture of deck.fixtures) {
  test(`${fixture.id} [${fixture.evidenceType}]`, () => {
    const { input, expected, kind, tolerance } = fixture;
    assert.ok(
      fixture.units &&
        fixture.referenceClaimIds.length &&
        fixture.reproduction &&
        tolerance.explanation,
    );
    const epsilon = tolerance.absolute;
    switch (kind) {
      case "direct": {
        const result = math.directPath(input.source, input.receiver, input.c);
        const unity = math.directPath([0, 0, 0], [1, 0, 0], input.c);
        close(unity.pressureRatio, 1, epsilon);
        close(unity.delaySeconds, 1 / input.c, epsilon);
        for (const key of Object.keys(expected)) close(result[key], expected[key], epsilon);
        close(
          math.directPath(input.source, math.scale(input.receiver, 2), input.c).pressureRatio,
          expected.pressureRatio / 2,
          epsilon,
        );
        break;
      }
      case "reflection": {
        const result = math.specularPath(input.source, input.receiver, getSurfaces(input.surfaces));
        assert.ok(result);
        close(result.distance, expected.distance, epsilon);
        result.hits.forEach((hit, i) =>
          hit.forEach((v, axis) => close(v, expected.hits[i][axis], epsilon)),
        );
        break;
      }
      case "reflection-rejected":
        assert.equal(
          math.specularPath(
            input.source,
            input.receiver,
            getSurfaces(input.surfaces),
            getSurfaces(input.blockers),
          ),
          expected.path,
        );
        break;
      case "occlusion":
        assert.equal(
          math.isOccluded(input.source, input.receiver, getSurfaces(input.blockers)),
          expected.blocked,
        );
        break;
      case "material":
        math
          .materialEnergy(input.bands)
          .forEach((band, i) =>
            close(
              band.reflectedPressureMagnitude,
              expected.reflectedPressureMagnitudes[i],
              epsilon,
            ),
          );
        break;
      case "air":
        close(
          math.airPressureRatio(input.alphaDbPerMeter, input.distanceMeters),
          expected.pressureRatio,
          epsilon,
        );
        break;
      case "doppler":
        close(math.doppler(input), expected.frequencyHz, epsilon);
        break;
      case "mode":
        close(
          math.roomMode(input.dimensionsMeters, input.order, input.c),
          expected.frequencyHz,
          epsilon,
        );
        break;
      case "arrival":
        assert.deepEqual(
          input.distances.map((d) => math.impulseArrivalSample(d, input.c, input.sampleRate)),
          expected.arrivalSamples,
        );
        break;
      case "edc":
        math
          .energyDecayDb(input.samples)
          .forEach((value, i) =>
            expected.edcDb[i] === null
              ? assert.equal(value, -Infinity)
              : close(value, expected.edcDb[i], epsilon),
          );
        break;
      case "decay": {
        const rir = Array.from({ length: input.sampleRate * input.durationSeconds }, (_, i) =>
          Math.exp((-3 * Math.log(10) * i) / input.sampleRate / input.rt60Seconds),
        );
        for (const [from, to] of input.fitRangesDb) {
          const result = math.decayTime(rir, input.sampleRate, from, to);
          assert.ok(result);
          close(result.rt60Seconds, expected.rt60Seconds, epsilon);
        }
        break;
      }
      default:
        assert.fail(`unknown fixture kind ${kind}`);
    }
  });
}
test("stationary and equal uniform velocities have Doppler ratio 1", () => {
  for (const velocity of [
    [0, 0, 0],
    [10, 0, 0],
  ])
    close(
      math.doppler({
        frequencyHz: 1000,
        c: 343,
        sourceVelocity: velocity,
        receiverVelocity: velocity,
        direction: [1, 0, 0],
      }),
      1000,
      1e-12,
    );
});
test("material, air, mode and propagation reject invalid domains", () => {
  assert.throws(
    () => math.materialEnergy([{ reflection: 0.8, transmission: 0.3, absorption: 0.1 }]),
    RangeError,
  );
  assert.throws(
    () => math.materialEnergy([{ reflection: NaN, transmission: 0, absorption: 1 }]),
    RangeError,
  );
  assert.throws(() => math.airPressureRatio(-0.1, 10), RangeError);
  assert.equal(math.airPressureRatio(0.1, 0), 1);
  assert.equal(math.airPressureRatio(0, 100), 1);
  assert.throws(() => math.roomMode([0, 4, 3], [1, 0, 0], 343), RangeError);
  assert.throws(() => math.roomMode([5, 4, 3], [0, 0, 0], 343), RangeError);
  assert.throws(() => math.directPath([0, 0, 0], [0, 0, 0], 343), RangeError);
  assert.throws(
    () =>
      math.doppler({
        frequencyHz: 1000,
        c: 343,
        sourceVelocity: [343, 0, 0],
        receiverVelocity: [0, 0, 0],
        direction: [1, 0, 0],
      }),
    RangeError,
  );
});
test("finite reflection continuity, path identity, birth/death and dynamic occlusion", () => {
  const floor = deck.surfaces.floor;
  const original = math.specularPath([1, 1, 0], [5, 1, 0], [floor]);
  const moved = math.specularPath([1.001, 1, 0], [5, 1, 0], [floor]);
  assert.ok(original && moved);
  assert.equal(
    math.pathIdentity("source", "listener", original.sequence),
    math.pathIdentity("source", "listener", moved.sequence),
  );
  assert.ok(Math.abs(original.distance - moved.distance) <= 0.001 + 1e-12);
  assert.equal(math.specularPath([1, 1, 0], [50, 1, 0], [floor]), null);
  assert.equal(math.isOccluded([1, 1, 0], [5, 1, 0], []), false);
  assert.equal(math.isOccluded([1, 1, 0], [5, 1, 0], [deck.surfaces.blocker]), true);
  // Endpoint contact is not an interior occluder; coplanar/grazing remains a documented limitation.
  assert.equal(math.isOccluded([1, 1, 0], [2, 1, 0], [deck.surfaces.blocker]), false);
});
test("RIR silence and insufficient decay range do not produce a reported RT60", () => {
  assert.throws(() => math.energyDecayDb([0, 0, 0]), RangeError);
  assert.equal(math.decayTime([1, 0, 0], 48000, -5, -25), null);
});
