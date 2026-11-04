import assert from "node:assert/strict";
import test from "node:test";
import { NativeSourceCursor } from "../../src/audio/native-source-cursor.js";

function close(actual: number, expected: number, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function options(rateKind: "k-rate" | "a-rate" = "k-rate") {
  return {
    audioTimeSeconds: 0,
    rate: 1,
    sampleRate: 8,
    quantumFrames: 4,
    parameterScale: 1,
    rateKind,
  };
}

for (const [kind, endOfRamp, afterSteadyTail] of [
  ["k-rate", 1.25, 2.25],
  ["a-rate", 1.4375, 2.4375],
] as const) {
  test(`${kind} cursor follows an independent eight-frame left-sample oracle`, () => {
    const cursor = new NativeSourceCursor(options(kind));
    cursor.setRate(2, 0, 1);
    // k-rate samples [1, 1.5] for two half-second blocks.
    // a-rate samples [1, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875],
    // each held for 1/8 second. These dyadic values have exact Float32 storage.
    close(cursor.readPosition(1), endOfRamp);
    close(cursor.readPosition(1.5), afterSteadyTail);
    assert.deepEqual(cursor.rateState(0.5), { from: 1.5, to: 2, remainingSeconds: 0.5 });
  });
}

test("k-rate uses the global quantum origin when source onset is inside a block", () => {
  const cursor = new NativeSourceCursor({ ...options(), audioTimeSeconds: 0.125 });
  cursor.setRate(2, 0, 1);
  close(cursor.readPosition(0.125), 0);
  // Only 3/8 of q0 at rate 1, then 1/2 of q1 at rate 1.5.
  close(cursor.readPosition(1), 1.125);
});

test("a-rate source onset on an interior quantum sample excludes every earlier sample", () => {
  const cursor = new NativeSourceCursor({ ...options("a-rate"), audioTimeSeconds: 0.125 });
  cursor.setRate(2, 0, 1);
  close(cursor.readPosition(0.125), 0);
  // Samples 1..7: (1.125+1.25+1.375+1.5+1.625+1.75+1.875)/8.
  close(cursor.readPosition(1), 1.3125);
});

test("a mid-quantum k-rate overwrite keeps the already sampled block value", () => {
  const cursor = new NativeSourceCursor(options());
  cursor.setRate(2, 0, 1);
  cursor.setRate(4, 0.25, 0.5);
  // q0 remains rate 1. At q1=.5 the replacement curve is halfway from
  // 1.25 to 4, hence 2.625, held through time 1 despite ramp end .75.
  close(cursor.readPosition(1), 1.8125);
});

test("observed native parameter overrides the replacement ramp's start in parameter units", () => {
  const cursor = new NativeSourceCursor({ ...options(), parameterScale: 4 });
  cursor.setRate(2, 0, 1);
  cursor.setRate(4, 0.25, 0.5, 4);
  // The observation 4 is parameter units: source rate 1, not rate 4.
  assert.deepEqual(cursor.rateState(0.25), { from: 1, to: 4, remainingSeconds: 0.5 });
  // q0=1, q1=(1+4)/2=2.5; each contributes half a second.
  close(cursor.readPosition(1), 1.75);
});

test("an interrupted a-rate ramp integrates only the samples before each replacement", () => {
  const cursor = new NativeSourceCursor(options("a-rate"));
  cursor.setRate(2, 0, 1);
  cursor.setRate(0.5, 0.5, 0.5);
  // First four samples sum 4.75. Replacement samples are
  // [1.5, 1.25, 1, .75], sum 4.5. Total 9.25/8.
  close(cursor.readPosition(1), 1.15625);
  close(cursor.readPosition(0.25), 0.265625);
});

test("k-rate endpoint Float32 conversion happens in parameter units before division by scale", () => {
  const cursor = new NativeSourceCursor({ ...options(), rate: 1.1, parameterScale: 3 });
  // IEEE-754 binary32 representation of parameter value 3.3, divided by 3.
  close(cursor.readPosition(1), 3.299999952316284 / 3);
});

test("a-rate native phase accounts for Float32 parameter and sample-duration multiplication", () => {
  const cursor = new NativeSourceCursor({ ...options("a-rate"), rate: 1.1, sampleRate: 10 });
  // binary32(1.1)=1.100000023841858; binary32(.1)=.10000000149011612.
  // Their binary32 product is .11000000685453415; ten left samples add
  // 1.1000000685453415 source seconds. A double-only 1.1 integral is different.
  close(cursor.readPosition(1), 1.1000000685453415);
});

test("an observed initial parameter can seed an already running source rate", () => {
  const cursor = new NativeSourceCursor({ ...options(), parameterScale: 4, fromParameter: 5 });
  close(cursor.readPosition(1), 1.25);
});

for (const [kind, atFreeze, afterRebase] of [
  ["k-rate", 0.6875, 1.5],
  ["a-rate", 0.78125, 1.6875],
] as const) {
  test(`${kind} freeze/resume caches phase and starts the remaining ramp on the new quantum grid`, () => {
    const cursor = new NativeSourceCursor(options(kind));
    cursor.setRate(2, 0, 1);
    close(cursor.readPosition(0.625), atFreeze);
    cursor.freeze(0.625);
    close(cursor.readPosition(20), atFreeze);
    assert.deepEqual(cursor.rateState(20), { from: 1.625, to: 2, remainingSeconds: 0.375 });
    // New context begins at zero. Quantizing a shifted old history again would
    // alter the cached phase; only the remaining curve belongs to this grid.
    cursor.resume(0);
    close(cursor.readPosition(0), atFreeze);
    close(cursor.readPosition(0.5), afterRebase);
  });
}

for (const [kind, stoppedPosition] of [
  ["k-rate", 0.6875],
  ["a-rate", 0.78125],
] as const) {
  test(`${kind} stop clamps phase once and never replays when another rate arrives`, () => {
    const cursor = new NativeSourceCursor(options(kind));
    cursor.setRate(2, 0, 1);
    cursor.stopAt(0.625);
    close(cursor.readPosition(1), stoppedPosition);
    cursor.setRate(4, 1, 0.5);
    close(cursor.readPosition(2), stoppedPosition);
    cursor.stopAt(5);
    close(cursor.readPosition(10), stoppedPosition);
  });
}

for (const [kind, expectedPosition] of [
  ["k-rate", 625],
  ["a-rate", 937.5],
] as const) {
  test(`${kind} cursor history is bounded while retaining every accumulated increment`, () => {
    const cursor = new NativeSourceCursor(options(kind));
    for (let index = 1; index <= 5000; index++) cursor.setRate(index % 2 ? 2 : 1, index / 8, 0);
    // At every k-rate quantum boundary (indices divisible by four), rate is 1.
    // a-rate has 2500 samples at rate 1 and 2500 samples at rate 2, each /8.
    close(cursor.readPosition(625), expectedPosition);
    assert.ok(cursor.historySize <= 512);
  });
}

test("a long steady native cursor advances without replaying a bounded ramp history", () => {
  const cursor = new NativeSourceCursor({ ...options(), rate: 1.25, positionSeconds: 3 });
  close(cursor.readPosition(1_000_000), 1_250_003);
});

test("native cursor rejects nonfinite controls and invalid render-clock dimensions", () => {
  for (const invalid of [
    { sampleRate: 0 },
    { sampleRate: NaN },
    { quantumFrames: 0 },
    { quantumFrames: 1.5 },
    { parameterScale: 0 },
    { rate: NaN },
  ])
    assert.throws(() => new NativeSourceCursor({ ...options(), ...invalid }));
  const cursor = new NativeSourceCursor(options());
  assert.throws(() => cursor.setRate(2, NaN, 1));
  assert.throws(() => cursor.setRate(2, 0, -1));
  assert.throws(() => cursor.readPosition(Infinity));
});
