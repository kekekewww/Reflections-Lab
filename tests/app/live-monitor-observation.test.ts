import assert from "node:assert/strict";
import test from "node:test";
import type { LiveAudioMonitorFrame, LiveAudioMonitorTrack } from "../../src/audio/live-monitor.js";
import {
  TopMonitorObservationCache,
  type TopMonitorObservationSnapshot,
} from "../../src/app/live-monitor-observation.js";

function track(id: string, kind: "output" | "source" = "source"): LiveAudioMonitorTrack {
  return {
    id,
    kind,
    label: `display.${id}`,
    sourceId: `logical.${id}`,
    peakDbfs: -12,
    rmsDbfs: -18,
    point: kind === "source" ? "contentPrePropagation" : "postLimiterAndMute",
  };
}
function frame(
  tracks: LiveAudioMonitorTrack[] = [track("@master/L", "output"), track("voice.a")],
): LiveAudioMonitorFrame {
  return {
    state: "active",
    reason: null,
    sampleRateHz: 48000,
    fftSize: 2048,
    waveform: new Float32Array([0, 0.5]),
    spectrumDbfs: new Float32Array([-20, -Infinity]),
    tracks,
    displayInput: "master-left",
    frequencyBinHz: 23.4375,
    sampledAtAudioTimeSeconds: 2.5,
    analyserNodeCount: 3,
    tapNodeCount: 6,
    spectrumNormalization: "nativeBlackmanFft;notPeakOrRmsMeter",
    sourceTrackLimit: 6,
    sampledSourceVoices: 1,
    warmingSourceVoices: 0,
    unmeasuredVirtualVoices: 3,
    unmeasuredPendingVoices: 2,
    unmeasuredNativeVoices: 0,
  };
}
const nativeFields = [
  "sampledAtAudioTimeSeconds",
  "sampleRateHz",
  "fftSize",
  "analyserNodeCount",
  "tapNodeCount",
  "sampledSourceVoices",
  "warmingSourceVoices",
  "unmeasuredVirtualVoices",
  "unmeasuredPendingVoices",
  "unmeasuredNativeVoices",
] as const;
function assertNoNative(snapshot: TopMonitorObservationSnapshot): void {
  assert.equal(snapshot.observed, false);
  assert.deepEqual(snapshot.sourceIDs, []);
  for (const field of nativeFields) assert.equal(snapshot[field], null, field);
}

test("before a normal UI read the passive snapshot and release retain explicit unknown values", () => {
  const cache = new TopMonitorObservationCache();
  const first = cache.snapshot();
  assert.equal(first.mode, null);
  assert.equal(first.input, null);
  assert.equal(first.visible, false);
  assert.equal(first.normalReadAtPerformanceMs, null);
  assertNoNative(first);
  cache.release();
  assert.deepEqual(cache.snapshot(), first);
});

test("normal reads copy only actual scalar metadata and bounded unique native source-track IDs", () => {
  const cache = new TopMonitorObservationCache();
  const raw = frame([
    track("@master/L", "output"),
    track("@master/R", "output"),
    ...["a", "b", "c", "d", "e", "f", "g"].map((id) => track(id)),
  ]);
  Object.defineProperty(raw, "waveform", {
    get: () => {
      throw new Error("waveform must not be read");
    },
  });
  Object.defineProperty(raw, "spectrumDbfs", {
    get: () => {
      throw new Error("FFT buffers must not be read");
    },
  });
  cache.recordNormalRead("levels", "master-left", 1250, raw);
  const snapshot = cache.snapshot();
  assert.equal(snapshot.mode, "levels");
  assert.equal(snapshot.input, "master-left");
  assert.equal(snapshot.visible, true);
  assert.equal(snapshot.observed, true);
  assert.equal(snapshot.normalReadAtPerformanceMs, 1250);
  for (const field of nativeFields) assert.equal(snapshot[field], raw[field], field);
  assert.deepEqual(snapshot.sourceIDs, ["a", "b", "c", "d", "e", "f"]);
  assert.equal("waveform" in snapshot, false);
  assert.equal("spectrumDbfs" in snapshot, false);
  const duplicate = frame([track("@master/L", "output"), track("a"), track("a"), track("b")]);
  cache.recordNormalRead("spectrum", "master-right", 1300, duplicate);
  assert.deepEqual(cache.snapshot().sourceIDs, ["a", "b"]);
  assert.equal(cache.snapshot().input, "master-right");
});

test("warmup is unobserved, zero clocks and measured zeros stay valid, invalid values stay unknown", () => {
  const cache = new TopMonitorObservationCache();
  const warm = frame();
  warm.reason = "ANALYSER_WARMUP";
  warm.warmingSourceVoices = 1;
  cache.recordNormalRead("waveform", "master-right", 10, warm);
  assert.equal(cache.snapshot().observed, false);
  assert.equal(cache.snapshot().sampleRateHz, 48000);
  assert.equal(cache.snapshot().analyserNodeCount, 3);
  const zero = frame();
  zero.sampledAtAudioTimeSeconds = 0;
  zero.sampledSourceVoices = 0;
  zero.unmeasuredVirtualVoices = 0;
  zero.unmeasuredPendingVoices = 0;
  cache.recordNormalRead("levels", "master-left", 0, zero);
  assert.equal(cache.snapshot().normalReadAtPerformanceMs, 0);
  assert.equal(cache.snapshot().sampledAtAudioTimeSeconds, 0);
  assert.equal(cache.snapshot().observed, true);
  assert.equal(cache.snapshot().sampledSourceVoices, 0);
  const invalid = Object.assign(frame(), {
    sampledAtAudioTimeSeconds: Infinity,
    sampleRateHz: NaN,
    fftSize: -1,
    analyserNodeCount: -1,
    tapNodeCount: NaN,
    sampledSourceVoices: -1,
    warmingSourceVoices: Infinity,
    unmeasuredVirtualVoices: NaN,
    unmeasuredPendingVoices: -1,
    unmeasuredNativeVoices: Infinity,
  });
  cache.recordNormalRead("levels", "master-left", NaN, invalid);
  const snapshot = cache.snapshot();
  assert.equal(snapshot.normalReadAtPerformanceMs, null);
  assert.equal(snapshot.observed, false);
  for (const field of nativeFields) assert.equal(snapshot[field], null, field);
});

test("inactive native states, load and missing native frames cannot retain ghost readings", () => {
  const cache = new TopMonitorObservationCache();
  for (const state of ["blocked", "paused", "error", "unavailable"] as const) {
    cache.recordNormalRead("levels", "master-left", 10, frame());
    const inactive = frame();
    inactive.state = state;
    cache.recordNormalRead("levels", "master-left", 20, inactive);
    assertNoNative(cache.snapshot());
    assert.equal(cache.snapshot().visible, true);
    assert.equal(cache.snapshot().normalReadAtPerformanceMs, 20);
  }
  cache.recordNormalRead("levels", "master-left", 30, frame());
  cache.recordNormalRead("load", "master-right", 40, frame());
  assertNoNative(cache.snapshot());
  assert.equal(cache.snapshot().mode, "load");
  cache.recordNormalRead("levels", "master-left", 50, null);
  assertNoNative(cache.snapshot());
  assert.equal(cache.snapshot().normalReadAtPerformanceMs, 50);
});

test("getter uses no ambient clock or native reads and returns detached plain-value copies", (context) => {
  const cache = new TopMonitorObservationCache();
  const tracks = [track("voice.a")],
    raw = frame(tracks);
  cache.recordNormalRead("spectrum", "master-right", 99, raw);
  raw.sampleRateHz = 44100;
  raw.sampledAtAudioTimeSeconds = 500;
  tracks[0]!.id = "mutated";
  const clock = context.mock.method(performance, "now", () => {
    throw new Error("getter must not consult time");
  });
  try {
    const first = cache.snapshot();
    assert.equal(first.sampleRateHz, 48000);
    assert.equal(first.sampledAtAudioTimeSeconds, 2.5);
    assert.deepEqual(first.sourceIDs, ["voice.a"]);
    (first.sourceIDs as string[]).push("caller mutation");
    (first as { visible: boolean }).visible = false;
    for (let index = 0; index < 20; index++) {
      const next = cache.snapshot();
      assert.equal(next.visible, true);
      assert.equal(next.normalReadAtPerformanceMs, 99);
      assert.deepEqual(next.sourceIDs, ["voice.a"]);
      assert.notStrictEqual(next.sourceIDs, first.sourceIDs);
    }
    assert.equal(clock.mock.callCount(), 0);
  } finally {
    clock.mock.restore();
  }
});

test("release clears every native reading and preserves the last requested view and read clock as stale", () => {
  const cache = new TopMonitorObservationCache();
  cache.recordNormalRead("waveform", "master-right", 300, frame());
  cache.release();
  const snapshot = cache.snapshot();
  assert.equal(snapshot.mode, "waveform");
  assert.equal(snapshot.input, "master-right");
  assert.equal(snapshot.visible, false);
  assert.equal(snapshot.normalReadAtPerformanceMs, 300);
  assertNoNative(snapshot);
  cache.release();
  assert.deepEqual(cache.snapshot(), snapshot);
});
