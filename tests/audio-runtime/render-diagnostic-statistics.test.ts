import assert from "node:assert/strict";
import test from "node:test";
import { summarizePcmDifference } from "../browser/nonadvanced/long-render/diagnostics.js";
import type { DiagnosticPcm } from "../browser/nonadvanced/long-render/diagnostics.js";

const options = (frames: number) => ({
  frames,
  sampleRateHz: 48000 as const,
  tolerance: 2e-6 as const,
});
function sparse(frames: number, channels: number, values: Record<string, number>): DiagnosticPcm {
  return {
    frames,
    channels,
    sample(channel, frame) {
      assert.ok(Number.isInteger(channel) && channel >= 0 && channel < channels);
      assert.ok(Number.isInteger(frame) && frame >= 0 && frame < frames);
      return values[`${frame}:${channel}`] ?? 0;
    },
  };
}

test("diagnostic PCM statistics use frame-major first/max locations and exact per-second buckets", () => {
  const actual = sparse(96002, 2, {
    "0:0": 2,
    "0:1": 4,
    "47999:1": 2,
    "48000:0": 7,
    "96000:1": 5,
    "96001:0": 8,
  });
  const reference = sparse(96012, 2, {
    "0:0": 1,
    "0:1": 4,
    "47999:1": -1,
    "48000:0": 3,
    "96000:1": -4,
    "96001:0": -1,
  });
  const summary = summarizePcmDifference(actual, reference, options(96002));
  assert.equal(summary.frames, 96002);
  assert.equal(summary.actualFrames, 96002);
  assert.equal(summary.referenceFrames, 96012);
  assert.equal(summary.comparedSamples, 192004);
  assert.equal(summary.maxError, 9);
  assert.equal(summary.seamError, 0);
  assert.equal(summary.tailError, 0);
  assert.equal(summary.overCount, 5);
  assert.deepEqual(summary.firstOver, { frame: 0, channel: 0, actual: 2, reference: 1, error: 1 });
  assert.deepEqual(summary.atMax, { frame: 96000, channel: 1, actual: 5, reference: -4, error: 9 });
  assert.deepEqual(summary.perSecondMax, [3, 4, 9]);
  assert.ok(Math.abs(summary.rmsError - Math.sqrt(188 / 192004)) < 1e-15);
  assert.deepEqual(summary.nonfinite, {
    count: 0,
    actual: 0,
    reference: 0,
    difference: 0,
    first: null,
  });
});

test("diagnostic seam windows include both 128-frame edges and exclude their neighboring frames", () => {
  const frames = 65536 + 130;
  const summary = summarizePcmDifference(
    sparse(frames, 1, {
      "32639:0": 99,
      "32640:0": 2,
      "32768:0": 3,
      "32896:0": 4,
      "32897:0": 98,
      "65664:0": 5,
      "65665:0": 97,
    }),
    sparse(frames, 1, {}),
    options(frames),
  );
  assert.equal(summary.maxError, 99);
  assert.equal(summary.seamError, 5);
  assert.equal(summary.tailError, 0);
  assert.equal(summary.overCount, 7);
});

test("diagnostic tail begins exactly at 60 seconds and keeps the emission-side sample separate", () => {
  const frames = 2880002;
  const summary = summarizePcmDifference(
    sparse(frames, 1, { "2879999:0": 9, "2880000:0": 2, "2880001:0": 3 }),
    sparse(frames, 1, {}),
    options(frames),
  );
  assert.equal(summary.maxError, 9);
  assert.equal(summary.tailError, 3);
  assert.equal(summary.seamError, 0);
  assert.equal(summary.perSecondMax.length, 61);
  assert.equal(summary.perSecondMax[59], 9);
  assert.equal(summary.perSecondMax[60], 3);
  assert.ok(Math.abs(summary.rmsError - Math.sqrt(94 / frames)) < 1e-15);
});

test("diagnostic zero vectors and explicit empty prefixes have defined zero errors", () => {
  const zero = summarizePcmDifference(sparse(4, 1, {}), sparse(4, 1, {}), options(4));
  assert.equal(zero.maxError, 0);
  assert.equal(zero.rmsError, 0);
  assert.equal(zero.overCount, 0);
  assert.equal(zero.firstOver, null);
  assert.deepEqual(zero.atMax, { frame: 0, channel: 0, actual: 0, reference: 0, error: 0 });
  const unread: DiagnosticPcm = {
    channels: 2,
    frames: 9,
    sample() {
      throw new Error("must not read");
    },
  };
  const empty = summarizePcmDifference(unread, unread, options(0));
  assert.equal(empty.comparedSamples, 0);
  assert.equal(empty.maxError, 0);
  assert.equal(empty.seamError, 0);
  assert.equal(empty.tailError, 0);
  assert.equal(empty.rmsError, 0);
  assert.equal(empty.firstOver, null);
  assert.equal(empty.atMax, null);
  assert.deepEqual(empty.perSecondMax, []);
});

test("diagnostic nonfinite inputs and finite subtraction overflow cannot masquerade as a passing comparison", () => {
  const summary = summarizePcmDifference(
    sparse(5, 1, { "1:0": NaN, "3:0": -Infinity, "4:0": 1e308 }),
    sparse(5, 1, { "2:0": Infinity, "3:0": Infinity, "4:0": -1e308 }),
    options(5),
  );
  assert.equal(summary.maxError, Infinity);
  assert.equal(summary.rmsError, Infinity);
  assert.equal(summary.overCount, 4);
  assert.equal(summary.nonfinite.count, 4);
  assert.equal(summary.nonfinite.actual, 2);
  assert.equal(summary.nonfinite.reference, 2);
  assert.equal(summary.nonfinite.difference, 1);
  assert.deepEqual(summary.nonfinite.first, { frame: 1, channel: 0, actual: "NaN", reference: 0 });
  assert.equal(summary.firstOver?.frame, 1);
  assert.equal(summary.atMax?.frame, 1);
  assert.equal(summary.atMax?.channel, 0);
  assert.ok(Number.isNaN(summary.atMax?.actual));
  assert.equal(summary.maxError <= 2e-6, false);
  assert.deepEqual(summary.perSecondMax, [Infinity]);
});

test("diagnostic RMS remains finite for large finite errors without squaring overflow", () => {
  const summary = summarizePcmDifference(
    sparse(2, 1, { "0:0": 1e200, "1:0": 1e200 }),
    sparse(2, 1, {}),
    options(2),
  );
  assert.equal(summary.maxError, 1e200);
  assert.equal(summary.rmsError, 1e200);
  assert.equal(summary.nonfinite.count, 0);
});

test("diagnostic prefixes are explicit and reject invalid vector/channel/frame/tolerance bounds before reading", () => {
  let calls = 0;
  const vector: DiagnosticPcm = {
    channels: 2,
    frames: 4,
    sample() {
      calls++;
      return 0;
    },
  };
  assert.throws(() => summarizePcmDifference(vector, vector, options(5)), /prefix/);
  assert.throws(() => summarizePcmDifference(vector, vector, options(-1)), /prefix/);
  assert.throws(() => summarizePcmDifference(vector, vector, options(1.5)), /prefix/);
  assert.throws(
    () => summarizePcmDifference({ ...vector, frames: NaN }, vector, options(1)),
    /frame/,
  );
  assert.throws(
    () => summarizePcmDifference({ ...vector, channels: 0 }, vector, options(1)),
    /channel/,
  );
  assert.throws(
    () => summarizePcmDifference({ ...vector, channels: 3 }, vector, options(1)),
    /channel/,
  );
  assert.throws(
    () => summarizePcmDifference({ ...vector, channels: 1 }, vector, options(1)),
    /channel/,
  );
  assert.throws(
    () => summarizePcmDifference(vector, vector, { ...options(1), sampleRateHz: 44100 as 48000 }),
    /48000/,
  );
  assert.throws(
    () => summarizePcmDifference(vector, vector, { ...options(1), tolerance: 1e-5 as 2e-6 }),
    /tolerance/,
  );
  assert.throws(
    () =>
      summarizePcmDifference(
        { ...vector, sample: null } as unknown as DiagnosticPcm,
        vector,
        options(1),
      ),
    /reader/,
  );
  assert.equal(calls, 0);
  const prefix = summarizePcmDifference(
    {
      ...vector,
      sample(channel, frame) {
        assert.ok(frame < 2);
        calls++;
        return channel + frame;
      },
    },
    { ...vector, frames: 6 },
    options(2),
  );
  assert.equal(prefix.frames, 2);
  assert.equal(prefix.actualFrames, 4);
  assert.equal(prefix.referenceFrames, 6);
  assert.equal(calls, 8);
  assert.equal(prefix.maxError, 2);
});
test("diagnostic tolerance is inclusive at exactly 2e-6 and counts the first greater sample", () => {
  const greater = 2e-6 + Number.EPSILON;
  const summary = summarizePcmDifference(
    sparse(2, 1, { "0:0": 2e-6, "1:0": greater }),
    sparse(2, 1, {}),
    options(2),
  );
  assert.equal(summary.overCount, 1);
  assert.equal(summary.firstOver?.frame, 1);
  assert.equal(summary.maxError, greater);
});
