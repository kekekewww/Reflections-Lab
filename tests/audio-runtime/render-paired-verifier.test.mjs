import assert from "node:assert/strict";
import test from "node:test";
import {
  createPairStatistics,
  inspectPairedRiffHeader,
} from "../browser/nonadvanced/long-render/paired-verify.mjs";

function options(frames, channels = 2) {
  return { frames, channels, sampleRateHz: 48000, tolerance: 2e-6 };
}
function riff(frames) {
  const header = Buffer.alloc(56);
  header.write("RIFF", 0);
  header.writeUInt32LE(48 + frames * 8, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(384000, 28);
  header.writeUInt16LE(8, 32);
  header.writeUInt16LE(32, 34);
  header.write("fact", 36);
  header.writeUInt32LE(4, 40);
  header.writeUInt32LE(frames, 44);
  header.write("data", 48);
  header.writeUInt32LE(frames * 8, 52);
  return header;
}

test("paired independent accumulator keeps channel/frame first-over, first maximum ties, exact sample count and RMS", () => {
  const stats = createPairStatistics(options(4));
  for (const error of [0, 2e-6, 3e-6, 1e-6, 0, 0, 5e-6, 5e-6]) stats.accept(error, 0);
  const summary = stats.finish();
  assert.equal(summary.frames, 4);
  assert.equal(summary.channels, 2);
  assert.equal(summary.comparedSamples, 8);
  assert.equal(summary.maxError, 5e-6);
  assert.equal(summary.overCount, 3);
  assert.deepEqual(summary.firstOver, {
    frame: 1,
    channel: 0,
    actual: 3e-6,
    reference: 0,
    error: 3e-6,
  });
  assert.deepEqual(summary.atMax, {
    frame: 3,
    channel: 0,
    actual: 5e-6,
    reference: 0,
    error: 5e-6,
  });
  assert.ok(Math.abs(summary.rmsError - Math.sqrt(8e-12)) < 1e-20);
  assert.deepEqual(summary.perSecondMax, [5e-6]);
  assert.equal(summary.seamError, 0);
  assert.equal(summary.tailError, 0);
});

test("paired independent accumulator uses full internal seams and exact sixty-second tail without an ignored prefix", () => {
  const frames = 2880002;
  const stats = createPairStatistics(options(frames));
  const errors = new Map([
    [32639 * 2, 9],
    [32640 * 2 + 1, 2],
    [32896 * 2, 3],
    [32897 * 2 + 1, 8],
    [2879999 * 2, 7],
    [2880000 * 2 + 1, 4],
    [2880001 * 2, 5],
  ]);
  for (let index = 0; index < frames * 2; index++) stats.accept(errors.get(index) ?? 0, 0);
  const summary = stats.finish();
  assert.equal(summary.comparedSamples, frames * 2);
  assert.equal(summary.maxError, 9);
  assert.equal(summary.seamError, 3);
  assert.equal(summary.tailError, 5);
  assert.equal(summary.perSecondMax.length, 61);
  assert.equal(summary.perSecondMax[0], 9);
  assert.equal(summary.perSecondMax[59], 7);
  assert.equal(summary.perSecondMax[60], 5);
  assert.equal(summary.overCount, 7);
  assert.ok(Math.abs(summary.rmsError - Math.sqrt(248 / (frames * 2))) < 1e-15);
});

test("paired independent verifier rejects partial layout, changed tolerance, incomplete counts and nonfinite samples", () => {
  assert.deepEqual(inspectPairedRiffHeader(riff(4), 4, 88), {
    frames: 4,
    channels: 2,
    rate: 48000,
    bytes: 88,
  });
  assert.throws(() => inspectPairedRiffHeader(riff(4), 4, 84), /PARTIAL/);
  const malformed = riff(4);
  malformed.writeUInt16LE(1, 22);
  assert.throws(() => inspectPairedRiffHeader(malformed, 4, 88), /LAYOUT/);
  assert.throws(() => createPairStatistics({ ...options(4), tolerance: 3e-6 }), /TOLERANCE/);
  assert.throws(() => createPairStatistics(options(3024001)), /FRAMES/);
  const incomplete = createPairStatistics(options(2));
  incomplete.accept(0, 0);
  assert.throws(() => incomplete.finish(), /COUNT/);
  const invalid = createPairStatistics(options(1));
  assert.throws(() => invalid.accept(NaN, 0), /NONFINITE/);
  const infinite = createPairStatistics(options(1));
  assert.throws(() => infinite.accept(0, Infinity), /NONFINITE/);
});
