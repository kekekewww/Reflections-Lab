import assert from "node:assert/strict";
import test from "node:test";
import { AudioDiagnostics } from "../../src/audio/diagnostics.js";

function fixture() {
  let now = 0;
  let reads = 0;
  let counters: unknown = { underrunEvents: 4, underrunDuration: 0.04 };
  const context = {
    outputLatency: 0.015,
    get playbackStats() {
      reads++;
      return counters;
    },
  } as unknown as BaseAudioContext;
  const diagnostics = new AudioDiagnostics(() => now);
  return {
    diagnostics,
    context,
    setTime(value: number) {
      now = value;
    },
    setStats(value: unknown) {
      counters = value;
    },
    reads: () => reads,
  };
}

test("unobserved timing, delivery, native output and unsupported measurements remain null", () => {
  const snapshot = new AudioDiagnostics(() => 0).snapshot();
  assert.equal(snapshot.nativeOutput.status, "NOT_OBSERVED");
  assert.equal(snapshot.nativeOutput.deltaUnderrunEvents, null);
  assert.equal(snapshot.timings.frameConsumer.count, 0);
  assert.equal(snapshot.timings.frameConsumer.p95, null);
  assert.equal(snapshot.delivery.status, "NOT_OBSERVED");
  assert.equal(snapshot.delivery.ageTicks.p95, null);
  assert.equal(snapshot.onsets.latenessMs.p95, null);
  assert.deepEqual(snapshot.unmeasured, {
    pcmGapSeconds: null,
    nativeDspCpuMs: null,
    nativeMemoryBytes: null,
    calibratedSpl: null,
  });
});

test("native getter is limited to 500 ms and reports measured deltas only after warmup", () => {
  const f = fixture();
  f.diagnostics.bindContext(f.context);
  let native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(f.reads(), 1);
  assert.equal(native.status, "WARMUP");
  assert.equal(native.cumulativeUnderrunEvents, null);
  assert.equal(native.deltaUnderrunEvents, null);
  f.setStats({ underrunEvents: 6, underrunDuration: 0.06 });
  for (const time of [0, 100, 200, 499.999]) {
    f.setTime(time);
    assert.equal(f.diagnostics.snapshot().nativeOutput.status, "WARMUP");
  }
  assert.equal(f.reads(), 1);
  f.setTime(500);
  native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(f.reads(), 2);
  assert.equal(native.status, "AVAILABLE");
  assert.equal(native.windowMs, 500);
  assert.equal(native.cumulativeUnderrunEvents, 6);
  assert.equal(native.deltaUnderrunEvents, 2);
  assert.ok(Math.abs(native.deltaUnderrunSeconds! - 0.02) < 1e-12);
  assert.equal(native.outputLatencySeconds, 0.015);
  f.setTime(1000);
  native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(native.deltaUnderrunEvents, 0);
  assert.equal(native.deltaUnderrunSeconds, 0);
});

test("counter reset is unavailable for that window and a new context starts its own baseline", () => {
  const f = fixture();
  f.diagnostics.bindContext(f.context);
  f.diagnostics.snapshot();
  f.setTime(500);
  f.setStats({ underrunEvents: 1, underrunDuration: 0.01 });
  let native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(native.status, "COUNTER_RESET");
  assert.equal(native.deltaUnderrunEvents, null);
  assert.equal(native.cumulativeUnderrunEvents, null);
  f.setTime(1000);
  f.setStats({ underrunEvents: 2, underrunDuration: 0.025 });
  native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(native.status, "AVAILABLE");
  assert.equal(native.deltaUnderrunEvents, 1);
  assert.ok(Math.abs(native.deltaUnderrunSeconds! - 0.015) < 1e-12);
  const generation = native.contextGeneration;
  const second = fixture();
  f.diagnostics.bindContext(second.context);
  native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(native.contextGeneration, generation + 1);
  assert.equal(native.status, "WARMUP");
  assert.equal(native.deltaUnderrunEvents, null);
  const reads = second.reads();
  f.diagnostics.bindContext(second.context);
  f.diagnostics.snapshot();
  assert.equal(second.reads(), reads, "rebinding identical context does not bypass the poll limit");
  f.diagnostics.bindContext(null);
  native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(native.status, "NOT_OBSERVED");
  assert.equal(native.deltaUnderrunEvents, null);
});

test("unsupported, throwing and invalid native counters clear their baseline", () => {
  const f = fixture();
  f.diagnostics.bindContext(f.context);
  f.setStats(undefined);
  assert.equal(f.diagnostics.snapshot().nativeOutput.status, "UNSUPPORTED");
  f.setTime(500);
  f.setStats({ underrunEvents: 0, underrunDuration: 0 });
  assert.equal(f.diagnostics.snapshot().nativeOutput.status, "WARMUP");
  f.setTime(1000);
  f.setStats({ underrunEvents: 0, underrunDuration: NaN });
  const unavailable = f.diagnostics.snapshot().nativeOutput;
  assert.equal(unavailable.status, "UNSUPPORTED");
  assert.equal(unavailable.deltaUnderrunEvents, null);
  f.setTime(1500);
  f.setStats({ underrunEvents: 5, underrunDuration: 0.1 });
  assert.equal(f.diagnostics.snapshot().nativeOutput.status, "WARMUP");
  const throwing = {
    get playbackStats() {
      throw new Error("unsupported native API");
    },
  } as unknown as BaseAudioContext;
  f.diagnostics.bindContext(throwing);
  assert.equal(f.diagnostics.snapshot().nativeOutput.status, "UNSUPPORTED");
});

test("only the last 128 samples enter quantiles while lifetime counts remain independent", () => {
  const diagnostics = new AudioDiagnostics(() => 0);
  for (let i = 1; i <= 300; i++) diagnostics.recordFrame("accepted", i);
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.sampleCapacity, 128);
  assert.equal(snapshot.frameDecisions.accepted, 300);
  assert.deepEqual(snapshot.timings.frameConsumer, {
    count: 300,
    retained: 128,
    p50: 236,
    p95: 294,
    p99: 299,
    max: 300,
    last: 300,
  });
  diagnostics.recordFrame("stale", 0);
  diagnostics.recordFrame("unavailable", 0.25);
  diagnostics.increment("shapeReuses", 8);
  diagnostics.increment("shapeUploads");
  const next = diagnostics.snapshot();
  assert.equal(next.timings.frameConsumer.count, 302, "recordFrame records timing exactly once");
  assert.equal(next.frameDecisions.stale, 1);
  assert.equal(next.controlOperations.shapeReuses, 8);
  assert.equal(next.controlOperations.shapeUploads, 1);
});

test("delivery counts batches and frames separately and omits unobserved age/cost", () => {
  const diagnostics = new AudioDiagnostics(() => 0);
  diagnostics.recordDelivery({ decision: "accepted", frameCount: 3 });
  let delivery = diagnostics.snapshot().delivery;
  assert.equal(delivery.status, "OBSERVED");
  assert.equal(delivery.batches.accepted, 1);
  assert.equal(delivery.frames.accepted, 3);
  assert.equal(delivery.ageTicks.last, null);
  assert.equal(delivery.elapsedMs.last, null);
  diagnostics.recordDelivery({
    decision: "age-rejected",
    frameCount: 2,
    ageTicks: 4,
    elapsedMs: 7.5,
  });
  delivery = diagnostics.snapshot().delivery;
  assert.equal(delivery.totalBatches, 2);
  assert.equal(delivery.totalFrames, 5);
  assert.equal(delivery.batches["age-rejected"], 1);
  assert.equal(delivery.frames["age-rejected"], 2);
  assert.equal(delivery.ageTicks.last, 4);
  assert.equal(delivery.elapsedMs.last, 7.5);
});

test("onset lateness excludes propagation and native output values", () => {
  const diagnostics = new AudioDiagnostics(() => 0);
  diagnostics.recordOnset(1, 1);
  diagnostics.recordOnset(2, 2.004);
  diagnostics.recordOnset(3, 2.9);
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.onsets.count, 3);
  assert.equal(snapshot.onsets.lateCount, 1);
  assert.equal(snapshot.onsets.requestedAudioTimeS, 3);
  assert.equal(snapshot.onsets.actualAudioTimeS, 2.9);
  assert.equal(snapshot.onsets.latenessMs.last, 0);
  assert.ok(Math.abs(snapshot.onsets.latenessMs.max! - 4) < 1e-10);
  assert.equal(snapshot.nativeOutput.deltaUnderrunEvents, null);
});

test("a backdated requested onset remains observable before audio time zero", () => {
  const diagnostics = new AudioDiagnostics(() => 0);
  diagnostics.recordOnset(-0.1, 0);
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.onsets.requestedAudioTimeS, -0.1);
  assert.equal(snapshot.onsets.actualAudioTimeS, 0);
  assert.equal(snapshot.onsets.lateCount, 1);
  assert.equal(snapshot.onsets.latenessMs.last, 100);
});

test("invalid observations reject atomically and callers cannot mutate retained diagnostics", () => {
  const diagnostics = new AudioDiagnostics(() => 0);
  assert.throws(() => diagnostics.recordFrame("accepted", NaN), RangeError);
  assert.throws(() => diagnostics.increment("shapeBuilds", -1), RangeError);
  assert.throws(() => diagnostics.recordOnset(NaN, 0), RangeError);
  assert.throws(() => diagnostics.recordOnset(-Number.MAX_VALUE, Number.MAX_VALUE), RangeError);
  assert.throws(
    () => diagnostics.recordDelivery({ decision: "accepted", frameCount: 2, elapsedMs: -1 }),
    RangeError,
  );
  assert.throws(() => diagnostics.timing("routeControl", Infinity), RangeError);
  let snapshot = diagnostics.snapshot();
  assert.equal(snapshot.frameDecisions.accepted, 0);
  assert.equal(snapshot.delivery.totalBatches, 0);
  assert.equal(snapshot.onsets.count, 0);
  diagnostics.recordFrame("accepted", 4);
  snapshot = diagnostics.snapshot();
  snapshot.frameDecisions.accepted = 99;
  snapshot.timings.frameConsumer.p95 = 99;
  snapshot.delivery.batches.accepted = 99;
  assert.equal(diagnostics.snapshot().frameDecisions.accepted, 1);
  assert.equal(diagnostics.snapshot().timings.frameConsumer.p95, 4);
  assert.equal(diagnostics.snapshot().delivery.batches.accepted, 0);
});

test("disabled diagnostics preserve history without sampling, validating or reading native getters", () => {
  const f = fixture();
  f.diagnostics.bindContext(f.context);
  f.diagnostics.recordFrame("accepted", 3);
  f.diagnostics.snapshot();
  f.setTime(500);
  f.diagnostics.snapshot();
  const observed = f.diagnostics.snapshot();
  const reads = f.reads();
  f.diagnostics.setEnabled(false);
  assert.equal(f.diagnostics.enabled, false);
  f.setTime(8000);
  f.setStats({ underrunEvents: 99, underrunDuration: 1 });
  f.diagnostics.recordFrame("stale", NaN);
  f.diagnostics.recordOnset(NaN, NaN);
  f.diagnostics.timing("routeControl", -1);
  f.diagnostics.increment("shapeBuilds", -1);
  f.diagnostics.recordDelivery({ decision: "accepted", frameCount: -1 });
  const disabled = f.diagnostics.snapshot();
  assert.equal(disabled.enabled, false);
  assert.deepEqual(disabled.frameDecisions, observed.frameDecisions);
  assert.deepEqual(disabled.onsets, observed.onsets);
  assert.deepEqual(disabled.timings, observed.timings);
  assert.deepEqual(disabled.controlOperations, observed.controlOperations);
  assert.deepEqual(disabled.delivery, observed.delivery);
  assert.equal(disabled.nativeOutput.status, "NOT_OBSERVED");
  assert.equal(disabled.nativeOutput.deltaUnderrunEvents, null);
  assert.equal(f.reads(), reads);
  assert.equal(disabled.sampleCapacity, 128);
});

test("re-enabling establishes a fresh native window without counting the disabled gap", () => {
  const f = fixture();
  f.diagnostics.bindContext(f.context);
  f.diagnostics.snapshot();
  f.setTime(500);
  const generation = f.diagnostics.snapshot().nativeOutput.contextGeneration;
  f.diagnostics.setEnabled(false);
  f.setTime(8000);
  f.setStats({ underrunEvents: 100, underrunDuration: 1 });
  f.diagnostics.setEnabled(true);
  assert.equal(f.diagnostics.enabled, true);
  let native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(native.status, "WARMUP");
  assert.equal(native.contextGeneration, generation);
  assert.equal(native.deltaUnderrunEvents, null);
  f.setTime(8500);
  f.setStats({ underrunEvents: 101, underrunDuration: 1.01 });
  native = f.diagnostics.snapshot().nativeOutput;
  assert.equal(native.status, "AVAILABLE");
  assert.equal(native.deltaUnderrunEvents, 1);
  assert.ok(Math.abs(native.deltaUnderrunSeconds! - 0.01) < 1e-12);
  assert.equal(native.windowMs, 500);
  f.diagnostics.recordFrame("accepted", 2);
  assert.equal(f.diagnostics.snapshot().frameDecisions.accepted, 1);
});

test("constructor can disable observation and enabled switches require a boolean", () => {
  const f = fixture();
  let clockReads = 0;
  const diagnostics = new AudioDiagnostics(() => {
    clockReads++;
    return 0;
  }, false);
  diagnostics.bindContext(f.context);
  diagnostics.recordFrame("accepted", 3);
  assert.equal(diagnostics.snapshot().enabled, false);
  assert.equal(diagnostics.snapshot().frameDecisions.accepted, 0);
  assert.equal(f.reads(), 0);
  assert.equal(clockReads, 0);
  const runtimeSwitch = diagnostics as unknown as { setEnabled(enabled: unknown): void };
  assert.throws(() => runtimeSwitch.setEnabled("false"), TypeError);
  assert.equal(diagnostics.enabled, false);
  diagnostics.setEnabled(true);
  assert.equal(diagnostics.snapshot().nativeOutput.status, "WARMUP");
  assert.equal(clockReads, 1);
  assert.equal(f.reads(), 1);
});
