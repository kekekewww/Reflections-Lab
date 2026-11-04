import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Execute the actual acoustic collector with a deterministic host. This isolates
// collector behavior; it does not claim to emulate a worker, native DSP or PCM.
const source = await readFile(
  new URL("../browser/performance-fixture-v3.mjs", import.meta.url),
  "utf8",
);
const begin = source.indexOf("async function acousticProfile(");
const end = source.indexOf("\nwindow.__performanceFixture =", begin);
assert.ok(begin >= 0 && end > begin, "actual collector extraction boundaries exist");
const build = new Function(
  "dependencies",
  `
  const { AcousticService, clock, measureNativeDelivery, acousticRequests,
    nativeRouteState, setTimeout, diagnostics, telemetry, audit, probesEnabled = true, probeMode = "on" } = dependencies;
  let solverPathCap = 8;
  let solverNativeStarts = [];
  let solverEngine = {
    getTelemetry: () => telemetry,
    getDiagnostics: () => diagnostics,
    updateFrame() { audit.updates++; }, playVoice: () => { audit.admissions++; return { accepted: true }; },
    context: { currentTime: 2 }, drainVoices: async () => {}, dispose() {},
  };
  ${source.slice(begin, end)}
  return acousticProfile;
`,
);

const diagnostics = {
  enabled: true,
  model: "CONTROL_THREAD_OBSERVATIONS",
  frameDecisions: { accepted: 22, stale: 3, "source-budget": 2 },
  onsets: { count: 8, lateCount: 4, latenessMs: { count: 8, retained: 8, p95: 12 } },
  delivery: { status: "OBSERVED", batches: { "age-rejected": 5 } },
  nativeOutput: {
    status: "UNSUPPORTED",
    contextGeneration: 1,
    deltaUnderrunEvents: null,
    deltaUnderrunSeconds: null,
  },
  unmeasured: { pcmGapSeconds: null, nativeDspCpuMs: null },
};
const telemetry = {
  contextState: "running",
  activeVoices: 8,
  activePaths: 64,
  droppedVoices: 2,
  droppedPaths: 9,
  staleFrames: 3,
};
async function collect(handlerMs, probeMode = "on") {
  let now = 0;
  const audit = { updates: 0, admissions: 0, solves: 0, receiveProbes: 0, routeProbes: 0 };
  const solutions = () => [
    {
      frame: { sourceId: "source", paths: [] },
      diagnostics: { segmentTests: 1, budgetExceeded: false },
    },
  ];
  const serviceTelemetry = {
    lastRoundTripMs: 8,
    lastWorkerComputeMs: 4,
    lastDeliveryHandlerMs: handlerMs,
    lastRequestBytes: 123,
    lastResponseBytes: 456,
  };
  const collect = build({
    diagnostics,
    telemetry,
    audit,
    probeMode,
    probesEnabled: probeMode === "on",
    clock: () => ++now,
    AcousticService: class {
      getTelemetry() {
        return serviceTelemetry;
      }
      async solve() {
        audit.solves++;
        return solutions();
      }
      dispose() {}
    },
    acousticRequests: (tick) => [{ tick }],
    nativeRouteState: () => {
      audit.routeProbes++;
      return { voices: [] };
    },
    setTimeout: (resolve) => {
      queueMicrotask(resolve);
      return 0;
    },
    measureNativeDelivery: async (_service, requests, consume) => {
      audit.receiveProbes++;
      const result = solutions();
      consume(result);
      return { solutions: result, delivery: { durationMs: 3, requestTick: requests[0].tick } };
    },
  });
  const result = await collect(1);
  return { ...result, audit };
}

test("unknown service-handler timing keeps total delivery unavailable", async () => {
  const result = await collect(null);
  assert.equal(result.raw.length, 1);
  assert.equal(result.raw[0].serviceDeliveryMs, null);
  assert.equal(result.raw[0].totalDeliveryMs, null);
  assert.equal(result.raw[0].receiveThroughNativeConsumersMs, 3);
});

test("a measured zero handler remains a valid zero contribution", async () => {
  const result = await collect(0);
  assert.equal(result.raw[0].totalDeliveryMs, result.raw[0].audioConsumerMs);
});

test("collector persists bounded diagnostic evidence without renaming control symptoms as output", async () => {
  const result = await collect(2);
  assert.deepEqual(result.raw[0].audioDiagnostics, diagnostics);
  assert.deepEqual(result.baselineAudioDiagnostics, diagnostics);
  assert.deepEqual(result.measurementBaselineAudioDiagnostics, diagnostics);
  assert.deepEqual(result.audioDiagnostics, diagnostics);
  assert.equal(result.raw[0].audioDiagnostics.onsets.lateCount, 4);
  assert.equal(result.raw[0].nativeAudio.droppedPaths, 9);
  assert.equal(result.raw[0].audioDiagnostics.nativeOutput.deltaUnderrunEvents, null);
  assert.equal(result.raw[0].audioDiagnostics.unmeasured.pcmGapSeconds, null);
});

test("probe-free acoustic run keeps all 21 warmup/measured batches and native consumers without receive or route probes", async () => {
  const on = await collect(2);
  const off = await collect(2, "off");
  assert.equal(off.probeMode, "off");
  assert.equal(off.timingStatus, "NOT_OBSERVED_PROBE_OFF");
  assert.equal(off.audit.solves, 21);
  assert.equal(off.audit.updates, on.audit.updates);
  assert.equal(off.audit.admissions, on.audit.admissions);
  assert.equal(off.audit.receiveProbes, 0);
  assert.equal(off.audit.routeProbes, 0);
  assert.equal(on.audit.receiveProbes, 21);
  assert.equal(on.audit.routeProbes, 21);
  assert.deepEqual(off.raw, []);
  assert.deepEqual(off.warmupRaw, []);
});
