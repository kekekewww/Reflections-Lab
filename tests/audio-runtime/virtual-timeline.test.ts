import assert from "node:assert/strict";
import test from "node:test";
import { VirtualVoiceTimeline } from "../../src/audio/virtual-timeline.js";
import { selectNativeVoices } from "../../src/audio/virtual-policy.js";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("virtual timeline integrates interrupted linear playback-rate ramps against a piecewise integral", () => {
  const timeline = new VirtualVoiceTimeline({
    audioTimeSeconds: 10,
    rate: 1,
    durationSeconds: null,
  });
  timeline.setRate(3, 10.5, 1);
  // [10,10.5]=.5; [10.5,11]=.75; interrupted ramp starts at rate 2.
  timeline.setRate(0.5, 11, 0.5);
  // [11,11.5]=.625; [11.5,12]=.25. Total=2.125 source seconds.
  close(timeline.read(12).playheadSeconds, 2.125);
  close(timeline.read(12).elapsedSinceEmissionSeconds, 2);
  close(timeline.read(10.75).playheadSeconds, 0.8125);
  assert.equal(timeline.read(12).remainingDurationSeconds, null);
});

test("future onset does not integrate pre-onset pitch automation", () => {
  const timeline = new VirtualVoiceTimeline({
    audioTimeSeconds: 1,
    rate: 1,
    durationSeconds: null,
  });
  timeline.setRate(3, 0.5, 1);
  close(timeline.read(1).playheadSeconds, 0);
  close(timeline.read(1.5).playheadSeconds, 1.25);
});

test("finite virtual content expires once at its sample boundary under changing pitch", () => {
  const timeline = new VirtualVoiceTimeline({
    audioTimeSeconds: 0,
    rate: 1,
    durationSeconds: null,
    sourceLimitSeconds: 1,
  });
  timeline.setRate(3, 0, 1);
  // t+t²=1 => t=(sqrt(5)-1)/2, independent closed-form oracle.
  const end = (Math.sqrt(5) - 1) / 2;
  close(timeline.read(0).remainingDurationSeconds!, end);
  close(timeline.read(end).playheadSeconds, 1);
  assert.equal(timeline.read(end + 1).remainingDurationSeconds, 0);
  close(timeline.read(end + 1).playheadSeconds, 1);
  close(timeline.read(end + 1).emissionEndElapsedSeconds!, end);
});

test("freeze/resume moves audio anchors while keeping source cursor and ramp remainder", () => {
  const timeline = new VirtualVoiceTimeline({ audioTimeSeconds: 0, rate: 1, durationSeconds: 3 });
  timeline.setRate(3, 0, 2);
  const before = timeline.read(0.5);
  timeline.freeze(0.5);
  assert.deepEqual(timeline.read(20), before);
  timeline.resume(30);
  close(timeline.read(30.5).playheadSeconds, 1.5);
  close(timeline.read(30.5).elapsedSinceEmissionSeconds, 1);
  close(timeline.read(30.5).remainingDurationSeconds!, 2);
});

test("virtual control history remains bounded without losing the accumulated integral", () => {
  const timeline = new VirtualVoiceTimeline({
    audioTimeSeconds: 0,
    rate: 1,
    durationSeconds: null,
  });
  let expected = 0;
  for (let i = 1; i <= 5000; i++) {
    const previousRate = i % 2 === 0 ? 2 : 1;
    const rate = i % 2 === 0 ? 1 : 2;
    expected += previousRate * 0.01;
    timeline.setRate(rate, i * 0.01, 0);
  }
  close(timeline.read(50).playheadSeconds, expected);
  assert.ok(timeline.historySize <= 512);
});

const policy = {
  maxNativeVoices: 1,
  maxVirtualVoices: 3,
  minResidenceSeconds: 0.2,
  priorityHysteresis: 0.1,
  fairnessSeconds: 1,
};
const active = { instanceId: "active", priority: 1, nativeSince: 0, virtualSince: null };
const waiting = { instanceId: "waiting", priority: 1, nativeSince: null, virtualSince: 0 };

test("native policy is deterministic, bounded and protects the minimum residence", () => {
  assert.deepEqual(selectNativeVoices([waiting, active], policy, 0.1), ["active"]);
  assert.deepEqual(selectNativeVoices([active, waiting], policy, 0.1), ["active"]);
  assert.deepEqual(selectNativeVoices([active, { ...waiting, priority: 2 }], policy, 0.3), [
    "waiting",
  ]);
});

test("hysteresis prevents priority jitter and aged equal-priority voices eventually receive a slot", () => {
  const jitter = { ...waiting, priority: 1.05, virtualSince: 0.3 };
  assert.deepEqual(selectNativeVoices([active, jitter], policy, 0.3), ["active"]);
  assert.deepEqual(selectNativeVoices([active, waiting], policy, 1.2), ["waiting"]);
});

test("native policy rejects invalid capacities and nonfinite timing rather than silently expanding", () => {
  assert.throws(() => selectNativeVoices([active], { ...policy, maxNativeVoices: 0 }, 1));
  assert.throws(() => selectNativeVoices([active], policy, NaN));
});

test("a replacement AudioContext may rebase a frozen clock backwards without changing phase", () => {
  const timeline = new VirtualVoiceTimeline({ audioTimeSeconds: 10, rate: 1, durationSeconds: 3 });
  timeline.setRate(3, 10, 2);
  timeline.freeze(10.5);
  timeline.resume(0);
  close(timeline.read(0).playheadSeconds, 0.625);
  close(timeline.read(0.5).playheadSeconds, 1.5);
  close(timeline.read(0.5).elapsedSinceEmissionSeconds, 1);
});

test("an explicit stop clamps content but not elapsed propagation time", () => {
  const timeline = new VirtualVoiceTimeline({
    audioTimeSeconds: 0,
    rate: 1,
    durationSeconds: null,
  });
  timeline.stopAt(0.5);
  const cursor = timeline.read(1);
  close(cursor.playheadSeconds, 0.5);
  close(cursor.elapsedSinceEmissionSeconds, 1);
  close(cursor.emissionEndElapsedSeconds!, 0.5);
  assert.equal(cursor.remainingDurationSeconds, 0);
});

test("authored duration is independent of a pitch-dependent natural sample end", () => {
  const timeline = new VirtualVoiceTimeline({
    audioTimeSeconds: 0,
    rate: 1,
    durationSeconds: null,
    sourceLimitSeconds: 1,
  });
  assert.equal(timeline.authoredRemainingSeconds(0.2), null);
  timeline.setRate(0.5, 0.2, 0);
  close(timeline.read(0.2).remainingDurationSeconds!, 1.6);
  timeline.stopAt(0.5);
  close(timeline.authoredRemainingSeconds(0.2)!, 0.3);
});
