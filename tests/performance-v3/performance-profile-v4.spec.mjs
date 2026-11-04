// Source-only RED contract. No browser/build/native operation has run for this spec.
// The immutable V2/V3 sources and original formal workload remain the reference.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { evaluateUIWorkload as originalUIWorkload } from "../browser/performance-profile-v3.mjs";
import { metric } from "../browser/performance-attribution-metrics-v1.mjs";

const cliUrl = new URL("../browser/performance-cli-v4.mjs", import.meta.url);
const profileUrl = new URL("../browser/performance-profile-v4.mjs", import.meta.url);
const runnerUrl = new URL("../browser/run-performance-v4.mjs", import.meta.url);
const approvedUrl = new URL(
  "../browser/performance-approved-qualifications-v4.mjs",
  import.meta.url,
);
const cli = existsSync(cliUrl) ? await import(cliUrl.href) : {};
const profile = existsSync(profileUrl) ? await import(profileUrl.href) : {};
const runner = existsSync(runnerUrl) ? await import(runnerUrl.href) : {};
const approved = existsSync(approvedUrl) ? await import(approvedUrl.href) : {};
const clone = (value) => structuredClone(value);
const allTrue = (flags) => Object.values(flags).every((value) => value === true);
const unapprovedId = "never-approved-profile-contract-only";
const executable = "C:\\contract-only\\chrome.exe";
const dependencies = {
  nodeVersion: "v22.17.0",
  nodePath: "C:\\contract-only\\node.exe",
  cwd: path.resolve("."),
  environment: {},
  defaultOutput: "artifacts/contract-only-v4",
  // Explicit I/O seams are allowed; they do not substitute the canonical approval authority.
  hashExe: async () => "7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa",
  currentSourcePins: async () =>
    JSON.parse(
      readFileSync(
        new URL(
          "../../docs/16-nonadvanced-completion/lanes/performance/semantic-attempt03-v4-bootstrap-receipt.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ).sourcePins,
};

test("V4 exposes a separate CLI and bounded planner without changing the original sources", () => {
  assert.equal(typeof cli.parseProfileOptionsV4, "function");
  assert.equal(typeof runner.planPerformanceRunV4, "function");
  assert.equal(
    createHash("sha256")
      .update(readFileSync(new URL("../browser/performance-profile.mjs", import.meta.url)))
      .digest("hex"),
    "df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c",
  );
});
test("V4 exposes pure workload classification and null-safe observation summaries", () => {
  assert.equal(typeof profile.evaluateUIWorkloadV4, "function");
  assert.equal(typeof profile.classifyProfileEvidenceV4, "function");
  assert.equal(typeof profile.summarizeProbeObservationsV4, "function");
});

test("formal defaults retain the original 600/all/3000/600 workload and product default monitor", () => {
  if (typeof cli.parseProfileOptionsV4 !== "function") return;
  const options = cli.parseProfileOptionsV4(["--formal-600"]);
  assert.equal(options.seconds, 600);
  assert.equal(options.phase, "all");
  assert.equal(options.physicsIterations, 3000);
  assert.equal(options.acousticIterations, 600);
  assert.equal(options.formal, true);
  assert.equal(options.probeMode, "on");
  assert.equal(options.topMonitorMode, "levels");
  assert.equal(options.topMonitorInput, "master-left");
  assert.equal(options.qualificationId, null);
});
test("probe-off still selects the entire original formal workload", () => {
  if (typeof cli.parseProfileOptionsV4 !== "function") return;
  const options = cli.parseProfileOptionsV4(["--formal-600", "--probe-mode", "off"]);
  assert.equal(options.seconds, 600);
  assert.equal(options.phase, "all");
  assert.equal(options.physicsIterations, 3000);
  assert.equal(options.acousticIterations, 600);
  assert.equal(options.probeMode, "off");
  assert.equal(options.topMonitorMode, "levels");
  assert.equal(options.topMonitorInput, "master-left");
});
for (const [name, extra] of [
  ["599 seconds", ["--seconds", "599"]],
  ["only UI", ["--phase", "ui"]],
  ["2999 physics iterations", ["--physics-iterations", "2999"]],
  ["599 acoustic iterations", ["--acoustic-iterations", "599"]],
  ["prepare", ["--prepare"]],
  ["software GPU", ["--swiftshader"]],
  ["load mode releases original default analysers", ["--top-monitor-mode", "load"]],
  ["spectrum is a different product workload", ["--top-monitor-mode", "spectrum"]],
  ["waveform is a different product workload", ["--top-monitor-mode", "waveform"]],
  ["another pinned monitor input", ["--top-monitor-input", "master-right"]],
]) {
  test(`formal V4 rejects ${name}`, () => {
    if (typeof cli.parseProfileOptionsV4 !== "function") return;
    assert.throws(() => cli.parseProfileOptionsV4(["--formal-600", ...extra]));
  });
}
for (const mode of ["levels", "spectrum", "waveform", "load"]) {
  test(`short diagnostic may explicitly pin product mode ${mode}`, () => {
    if (typeof cli.parseProfileOptionsV4 !== "function") return;
    const options = cli.parseProfileOptionsV4([
      "--seconds",
      "20",
      "--top-monitor-mode",
      mode,
      "--top-monitor-input",
      "master-right",
    ]);
    assert.equal(options.formal, false);
    assert.equal(options.seconds, 20);
    assert.equal(options.topMonitorMode, mode);
    assert.equal(options.topMonitorInput, "master-right");
  });
}
for (const args of [
  ["--probe-mode", "unknown"],
  ["--probe-mode"],
  ["--probe-mode", "on", "--probe-mode", "off"],
  ["--top-monitor-mode", "cpu"],
  ["--top-monitor-input", "mono-sum"],
  ["--qualification"],
  ["--qualification", "one", "--qualification", "two"],
  ["--native-voices", "8"],
  ["--paths", "1"],
]) {
  test(`V4 rejects malformed or workload-reducing options ${args.join(" ")}`, () => {
    if (typeof cli.parseProfileOptionsV4 !== "function") return;
    assert.throws(() => cli.parseProfileOptionsV4(args));
  });
}

test("short planning points to the new profile and retains original process bounds", async () => {
  if (typeof runner.planPerformanceRunV4 !== "function") return;
  const plan = await runner.planPerformanceRunV4(
    ["--seconds", "20", "--executable-path", executable],
    dependencies,
  );
  assert.equal(plan.formal, false);
  assert.equal(plan.timeoutMs, 420000);
  assert.equal(plan.maxOutputBytes, 8 * 1024 * 1024);
  assert.equal(plan.paidCalls, 0);
  assert.ok(plan.args.some((value) => value.endsWith("performance-profile-v4.mjs")));
  assert.ok(!plan.args.some((value) => value.endsWith("performance-profile-v3.mjs")));
  assert.equal(plan.args[0], "--max-old-space-size=2560");
});
for (const probeMode of ["on", "off"]) {
  test(`formal ${probeMode} needs a real registered qualification`, async () => {
    if (typeof runner.planPerformanceRunV4 !== "function") return;
    await assert.rejects(
      async () =>
        await runner.planPerformanceRunV4(
          ["--formal-600", "--probe-mode", probeMode, "--executable-path", executable],
          dependencies,
        ),
      /QUALIFICATION/,
    );
    await assert.rejects(
      async () =>
        await runner.planPerformanceRunV4(
          [
            "--formal-600",
            "--probe-mode",
            probeMode,
            "--qualification",
            unapprovedId,
            "--executable-path",
            executable,
          ],
          dependencies,
        ),
      /QUALIFICATION/,
    );
  });
}
test("external dependencies cannot approve a method using flags or a substituted lookup", async () => {
  if (typeof runner.planPerformanceRunV4 !== "function") return;
  const attempted = {
    ...dependencies,
    qualified: true,
    approved: true,
    qualification: { id: unapprovedId, approved: true, formalQualification: "APPROVED" },
    qualificationLookup: () => ({ id: unapprovedId, approved: true }),
  };
  await assert.rejects(
    async () =>
      await runner.planPerformanceRunV4(
        ["--formal-600", "--qualification", unapprovedId, "--executable-path", executable],
        attempted,
      ),
    /QUALIFICATION/,
  );
});

function clock(tick, mode = "interactive") {
  return { tick, clockMode: mode, paused: false, accumulatorSeconds: 0 };
}
function advance(tick, phase = "measurement") {
  return {
    phase,
    steps: 1,
    overrun: false,
    droppedWallTimeSeconds: 0,
    before: clock(tick),
    after: clock(tick + 1),
    error: null,
  };
}
function audio(time) {
  return { contextState: "running", activeVoices: 8, activePaths: 64, currentTimeSeconds: time };
}
function passiveTopMonitor() {
  return {
    mode: "levels",
    input: "master-left",
    visible: true,
    observed: true,
    normalReadAtPerformanceMs: 600950,
    sampleRateHz: 48000,
    fftSize: 2048,
    sampledAtAudioTimeSeconds: 609.9,
    analyserNodeCount: 8,
    tapNodeCount: 16,
    sourceIDs: Array.from({ length: 6 }, (_, index) => `source.${index}`),
    sampledSourceVoices: 6,
    warmingSourceVoices: 0,
    unmeasuredNativeVoices: 2,
    unmeasuredVirtualVoices: 0,
    unmeasuredPendingVoices: 0,
  };
}
function uiFixture() {
  const captures = [
    { index: 0, scheduledAtMs: 10000, tick: 1200, hash: "a" },
    { index: 1, scheduledAtMs: 300000, tick: 18600, hash: "b" },
    { index: 2, scheduledAtMs: 580000, tick: 35400, hash: "c" },
  ];
  return {
    probeMode: "on",
    startedAtPerformanceMs: 1000,
    sampleMilliseconds: 600000,
    collectionWindow: {
      schemaVersion: "3.0.0",
      collectionId: "formal-ui-contract",
      beginPerformanceMs: 1000,
      endPerformanceMs: 601000,
    },
    windowSnapshot: { status: "CLOSED_WINDOW" },
    pendingAtEnd: {
      timestamp: 601000,
      scriptBusy: false,
      runtimeBusy: false,
      recorderPending: false,
    },
    startedAtTick: 600,
    measuredEndTick: 36600,
    fixedDtSeconds: 1 / 60,
    droppedWallTimeSeconds: 0,
    droppedSamples: 0,
    interpolationCalls: 3,
    interpolationMs: [0.2, 0.3, 0.2],
    interpolationObservation: {
      requiredMethod: "interpolatedTransforms",
      observedMethods: ["interpolatedTransforms"],
      calls: 3,
      successfulCalls: 3,
      failedCalls: 0,
      byMethod: {
        interpolatedTransforms: {
          calls: 3,
          successfulCalls: 3,
          failedCalls: 0,
          ms: [0.2, 0.3, 0.2],
        },
      },
    },
    final: { error: null, simulationState: "paused" },
    frame: [
      { timestamp: 1010, simulationRunning: true, tick: 600 },
      { timestamp: 301000, simulationRunning: true, tick: 18600 },
      { timestamp: 600990, simulationRunning: true, tick: 36599 },
    ],
    advances: [advance(600), advance(18600), advance(36599)],
    onTick: [{ ms: 0.3, recording: true, tick: 1201 }],
    nativeStarts: [{ successfulNativeStart: true }],
    audioTelemetry: [audio(10), audio(610)],
    captureScheduleMs: [10000, 300000, 580000],
    captureWindows: captures.map(({ index, scheduledAtMs, tick, hash }) => ({
      index,
      scheduledAtMs,
      requested: { atMs: scheduledAtMs, ...clock(tick) },
      start: { atMs: scheduledAtMs, ...clock(tick, "recording") },
      beforeStop: { atMs: scheduledAtMs + 1000, ...clock(tick + 60, "recording") },
      end: { atMs: scheduledAtMs + 1000, ...clock(tick + 60, "recording") },
      artifact: {
        sha256: hash.repeat(64),
        status: "captured",
        frameCount: 60,
        startTick: tick + 1,
        endTick: tick + 60,
      },
      advanceCount: 60,
      overrunCount: 0,
      pausedAdvanceCount: 0,
      maxAccumulatorSeconds: 0,
    })),
    actions: [
      { action: "OnGrab", accepted: true },
      { action: "OnThrow", accepted: true },
    ],
    warmup: {
      durationMs: 10000,
      started: { ...clock(0), error: null },
      ended: { ...clock(600), error: null },
      nativeStartsBefore: 0,
      nativeStartsAfter: 1,
      audioClockBefore: 0,
      audioClockAfter: 10,
      audioBefore: audio(0),
      audioAfter: audio(10),
      advances: [advance(0, "warmup"), advance(599, "warmup")],
    },
    topMonitorObservation: passiveTopMonitor(),
  };
}
function uiOptions() {
  return {
    pageErrors: [],
    expectedTopMonitor: { mode: "levels", input: "master-left", maxAgeMs: 1000 / 15 },
    traceCoverage: {
      complete: true,
      markedDurationMs: 600000,
      nativeV4Qualified: true,
      originalRawV3Qualified: false,
    },
  };
}
function compareOriginalFlags(data, options) {
  const before = clone({ data, options });
  const reference = originalUIWorkload(data, {
    ...options,
    traceCoverage: {
      ...options.traceCoverage,
      nativeV3Qualified: options.traceCoverage.nativeV4Qualified === true,
    },
  });
  const actual = profile.evaluateUIWorkloadV4(data, options);
  for (const [key, expected] of Object.entries(reference)) assert.equal(actual[key], expected, key);
  assert.deepEqual(
    { data, options },
    before,
    "the typed/raw distinction is not written back as raw V3 true",
  );
  assert.equal(options.traceCoverage.originalRawV3Qualified, false);
  assert.equal(Object.hasOwn(options.traceCoverage, "nativeV3Qualified"), false);
  return { reference, actual };
}
test("new UI workload retains every original gate under explicitly typed V4 membership", () => {
  if (typeof profile.evaluateUIWorkloadV4 !== "function") return;
  const { reference, actual } = compareOriginalFlags(uiFixture(), uiOptions());
  assert.equal(allTrue(reference), true);
  assert.equal(actual.topMonitorSnapshotValid, true);
});
for (const [name, flag, mutate] of [
  [
    "short actual native window",
    "actual600Seconds",
    (d, o) => {
      o.traceCoverage.markedDurationMs = 599999;
    },
  ],
  [
    "missing interpolation evidence",
    "actualInterpolationObserved",
    (d) => {
      d.interpolationObservation = null;
    },
  ],
  [
    "sample truncation",
    "noSampleTruncation",
    (d) => {
      d.droppedSamples = 1;
    },
  ],
  [
    "runtime error",
    "noRuntimeOrScriptErrors",
    (d) => {
      d.final.error = "RUNTIME_FAILURE";
    },
  ],
  [
    "paused simulation frame",
    "uninterruptedSimulation",
    (d) => {
      d.frame[1].simulationRunning = false;
    },
  ],
  [
    "short fixed tick progress",
    "fixedTickProgress",
    (d) => {
      d.measuredEndTick = 36598;
    },
  ],
  [
    "dropped wall time",
    "noDroppedWallTime",
    (d) => {
      d.droppedWallTimeSeconds = 0.01;
    },
  ],
  [
    "five catch-up steps",
    "noOverrunOrRecordingDebt",
    (d) => {
      d.advances[0].steps = 5;
    },
  ],
  [
    "rejected grab",
    "acceptedGrabAndThrow",
    (d) => {
      d.actions[0].accepted = false;
    },
  ],
  [
    "pending script",
    "closedWindowNoPending",
    (d) => {
      d.pendingAtEnd.scriptBusy = true;
    },
  ],
  [
    "capture after closed wall window",
    "periodicCaptureCompleted",
    (d) => {
      d.captureWindows[2].end.atMs = 600001;
    },
  ],
  [
    "missing capture tick",
    "captureTickSamples",
    (d) => {
      d.onTick = [];
    },
  ],
  [
    "suspended graph",
    "nativeGraphStarted",
    (d) => {
      d.audioTelemetry = [];
    },
  ],
  [
    "short warmup",
    "genuineRunningWarmup",
    (d) => {
      d.warmup.durationMs = 9999;
    },
  ],
]) {
  test(`V4 preserves original rejection: ${name}`, () => {
    if (typeof profile.evaluateUIWorkloadV4 !== "function") return;
    const data = uiFixture(),
      options = uiOptions();
    mutate(data, options);
    const { reference, actual } = compareOriginalFlags(data, options);
    assert.equal(reference[flag], false);
    assert.equal(actual[flag], false);
  });
}
for (const [name, mutate] of [
  [
    "missing passive snapshot",
    (d) => {
      d.topMonitorObservation = null;
    },
  ],
  [
    "unobserved normal UI sample",
    (d) => {
      d.topMonitorObservation.observed = false;
    },
  ],
  [
    "load instead of original default",
    (d) => {
      d.topMonitorObservation.mode = "load";
    },
  ],
  [
    "right instead of original default",
    (d) => {
      d.topMonitorObservation.input = "master-right";
    },
  ],
  [
    "hidden product monitor",
    (d) => {
      d.topMonitorObservation.visible = false;
    },
  ],
  [
    "unknown rate",
    (d) => {
      d.topMonitorObservation.sampleRateHz = null;
    },
  ],
  [
    "unknown FFT size",
    (d) => {
      d.topMonitorObservation.fftSize = null;
    },
  ],
  [
    "unconfigured stale age",
    (d) => {
      d.topMonitorObservation.normalReadAtPerformanceMs = 600900;
    },
  ],
  [
    "nonfinite normal read clock",
    (d) => {
      d.topMonitorObservation.normalReadAtPerformanceMs = NaN;
    },
  ],
  [
    "unknown analyser count",
    (d) => {
      d.topMonitorObservation.analyserNodeCount = null;
    },
  ],
  [
    "unknown total tap count",
    (d) => {
      d.topMonitorObservation.tapNodeCount = null;
    },
  ],
  [
    "analyser count exceeds all taps",
    (d) => {
      d.topMonitorObservation.tapNodeCount = 7;
    },
  ],
  [
    "duplicate retained source IDs",
    (d) => {
      d.topMonitorObservation.sourceIDs[1] = d.topMonitorObservation.sourceIDs[0];
    },
  ],
  [
    "negative audio sample clock",
    (d) => {
      d.topMonitorObservation.sampledAtAudioTimeSeconds = -1;
    },
  ],
  [
    "unknown sample clock",
    (d) => {
      d.topMonitorObservation.sampledAtAudioTimeSeconds = null;
    },
  ],
  [
    "read after closed window",
    (d) => {
      d.topMonitorObservation.normalReadAtPerformanceMs = 601001;
    },
  ],
]) {
  test(`V4 monitor workload rejects ${name} without creating observation resources`, () => {
    if (typeof profile.evaluateUIWorkloadV4 !== "function") return;
    const data = uiFixture();
    mutate(data);
    let activeReads = 0;
    data.runtime = {
      readLiveMonitor() {
        activeReads++;
        throw new Error("ACTIVE_READ_FORBIDDEN");
      },
    };
    const result = profile.evaluateUIWorkloadV4(data, uiOptions());
    assert.equal(result.topMonitorSnapshotValid, false);
    assert.equal(activeReads, 0);
  });
}

test("probe-off null UI observations remain explicit unknown and do not throw", () => {
  if (typeof profile.summarizeProbeObservationsV4 !== "function") return;
  const ui = {
    probeMode: "off",
    frame: [],
    audioTelemetry: [],
    interpolationCalls: null,
    interpolationObservation: null,
    interpolationMs: null,
  };
  let summary;
  assert.doesNotThrow(() => {
    summary = profile.summarizeProbeObservationsV4({ ui });
  });
  for (const key of [
    "interpolationObservation",
    "interpolationMs",
    "interpolationCallsPerPresentedFrame",
    "peakNativeVoices",
    "peakNativePaths",
  ])
    assert.equal(summary.ui[key], null, key);
});
test("partial UI native observations cannot become a smaller measured maximum", () => {
  if (typeof profile.summarizeProbeObservationsV4 !== "function") return;
  const summary = profile.summarizeProbeObservationsV4({
    ui: {
      probeMode: "on",
      frame: [{ timestamp: 1 }],
      interpolationCalls: 1,
      interpolationObservation: null,
      interpolationMs: [0.2],
      audioTelemetry: [
        { activeVoices: 8, activePaths: 64 },
        { activeVoices: null, activePaths: null },
      ],
    },
  });
  assert.equal(summary.ui.peakNativeVoices, null);
  assert.equal(summary.ui.peakNativePaths, null);
});
test("actual measured zero UI values stay zero", () => {
  if (typeof profile.summarizeProbeObservationsV4 !== "function") return;
  const summary = profile.summarizeProbeObservationsV4({
    ui: {
      probeMode: "on",
      frame: [{ timestamp: 1 }],
      interpolationCalls: 0,
      interpolationObservation: null,
      interpolationMs: [0],
      audioTelemetry: [{ activeVoices: 0, activePaths: 0 }],
    },
  });
  assert.equal(summary.ui.interpolationCallsPerPresentedFrame, 0);
  assert.equal(summary.ui.peakNativeVoices, 0);
  assert.equal(summary.ui.peakNativePaths, 0);
});
function physicsObservations(values = []) {
  return {
    contacts: values,
    awakeBodies: values,
    events: values,
    loadMaintenance: values.map((value) => ({
      nativePreWakeSleepingBodies: value,
      nativePostWakeSleepingBodies: value,
    })),
    nativePostStepSleepingBodies: values,
  };
}
const physicsSummaryKeys = [
  "maxContactPairs",
  "minContactPairs",
  "meanContactPairs",
  "minAwakeBodies",
  "meanAwakeBodies",
  "maxEventsPerStep",
  "minNativePreWakeSleepingBodies",
  "maxNativePreWakeSleepingBodies",
  "maxNativePostWakeSleepingBodies",
  "maxNativePostStepSleepingBodies",
];
for (const [name, values, expected] of [
  ["empty", [], null],
  ["partial", [0, null], null],
  ["nonfinite", [0, Infinity], null],
  ["measured zero", [0, 0], 0],
]) {
  test(`physics ${name} summary has explicit finite-or-null values`, () => {
    if (typeof profile.summarizeProbeObservationsV4 !== "function") return;
    const summary = profile.summarizeProbeObservationsV4({ physics: physicsObservations(values) });
    for (const key of physicsSummaryKeys) assert.equal(summary.physics[key], expected, key);
    assert.doesNotThrow(() => JSON.stringify(summary));
  });
}
function acousticRows(rows) {
  return [{ profileId: "productDefault", raw: rows }];
}
const acousticAggregateKeys = [
  "maxReturnedPaths",
  "minReturnedPaths",
  "minNativePaths",
  "maxNativePaths",
  "minNativeVoices",
];
test("empty acoustic rows are not zero misses or all updates completed", () => {
  if (typeof profile.summarizeProbeObservationsV4 !== "function") return;
  const summary = profile.summarizeProbeObservationsV4({ acousticProfiles: acousticRows([]) });
  const row = summary.acousticProfiles[0];
  assert.equal(row.profileId, "productDefault");
  assert.equal(row.deadlineMissedBatches, null);
  assert.equal(row.cadenceStatus, "NOT_OBSERVED");
  for (const key of acousticAggregateKeys) assert.equal(row[key], null, key);
});
test("missing native telemetry cannot turn into zero graph load", () => {
  if (typeof profile.summarizeProbeObservationsV4 !== "function") return;
  const summary = profile.summarizeProbeObservationsV4({
    acousticProfiles: acousticRows([
      {
        scheduledAtMs: 0,
        completedAtMs: 1,
        deadlineMissed: false,
        returnedPaths: 0,
        nativeAudio: null,
      },
    ]),
  });
  const row = summary.acousticProfiles[0];
  assert.equal(row.minNativePaths, null);
  assert.equal(row.maxNativePaths, null);
  assert.equal(row.minNativeVoices, null);
  assert.equal(row.minReturnedPaths, 0);
  assert.equal(row.maxReturnedPaths, 0);
  assert.equal(row.deadlineMissedBatches, 0);
  assert.equal(row.cadenceStatus, "ALL_UPDATES_COMPLETED_IN_20HZ_WINDOWS");
});
test("partial cadence is unverified while a known miss remains visible", () => {
  if (typeof profile.summarizeProbeObservationsV4 !== "function") return;
  const first = {
    scheduledAtMs: 0,
    completedAtMs: 51,
    deadlineMissed: true,
    returnedPaths: 8,
    nativeAudio: { activePaths: 8, activeVoices: 1 },
  };
  const second = {
    scheduledAtMs: 50,
    completedAtMs: null,
    deadlineMissed: null,
    returnedPaths: null,
    nativeAudio: { activePaths: null, activeVoices: null },
  };
  const row = profile.summarizeProbeObservationsV4({
    acousticProfiles: acousticRows([first, second]),
  }).acousticProfiles[0];
  assert.equal(row.deadlineMissedBatches, null);
  assert.equal(row.cadenceStatus, "DEADLINE_MISSES");
  for (const key of acousticAggregateKeys) assert.equal(row[key], null, key);
});

function evidenceReport(status = "MEASURED_LOCAL_ONLY") {
  return {
    status,
    formal600Run: true,
    sourceStableDuringRun: true,
    bundleStableDuringRun: true,
    executableStableDuringRun: true,
    metrics: [metric("ui.rendererMainTaskOccupancyPerFrame", [1], 4)],
    ui: {
      workloadValidity: {
        actual600Seconds: true,
        actualInterpolationObserved: true,
        closedWindowNoPending: true,
        topMonitorSnapshotValid: true,
      },
    },
    physics: { workloadValidity: { originalFullLoad: true } },
    acousticProfiles: [{ workloadValidity: { originalFullLoad: true } }],
  };
}
function classify(report, probeMode = "off", extra = {}) {
  return profile.classifyProfileEvidenceV4(report, {
    probeMode,
    formal: true,
    qualificationId: unapprovedId,
    ...extra,
  });
}
test("clean probe-off remains comparison only even if every advertised flag says true", () => {
  if (typeof profile.classifyProfileEvidenceV4 !== "function") return;
  const report = evidenceReport(),
    before = clone(report);
  const result = classify(report, "off", {
    qualified: true,
    approved: true,
    qualification: { approved: true, formalQualification: "APPROVED" },
  });
  assert.equal(result.status, "COMPARISON_ONLY_NOT_QUALIFIED");
  assert.equal(result.purpose, "PROBE_OVERHEAD_COMPARISON");
  assert.equal(result.formalQualified, false);
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.deepEqual(result.metrics, report.metrics);
  assert.deepEqual(report, before);
});
for (const status of [
  "FAILED",
  "FAILED_CLEANUP",
  "TIMED_OUT",
  "HISTORICAL_SNAPSHOT_ONLY",
  "MEASURED_WITH_FAILURES",
]) {
  test(`probe-off does not overwrite existing execution status ${status}`, () => {
    if (typeof profile.classifyProfileEvidenceV4 !== "function") return;
    const report = evidenceReport(status);
    report.metrics.push(metric("known.failure", [5], 4));
    const result = classify(report);
    assert.equal(result.status, status);
    assert.equal(result.executionStatus, status);
    assert.equal(result.purpose, "PROBE_OVERHEAD_COMPARISON");
    assert.equal(result.formalQualified, false);
    assert.equal(result.formalQualification, "NOT_APPROVED");
    assert.equal(result.metrics.at(-1).status, "FAIL");
    assert.equal(result.metrics.at(-1).p95, 5);
  });
}
test("all-missing metrics remain null and NOT_RUN in comparison output", () => {
  if (typeof profile.classifyProfileEvidenceV4 !== "function") return;
  const report = evidenceReport();
  report.metrics = [metric("unknown.nativeCPU", [null, null], 1)];
  const result = classify(report);
  assert.equal(result.metrics[0].status, "NOT_RUN");
  for (const key of ["p50", "p95", "p99", "max", "exceedanceCount"])
    assert.equal(result.metrics[0][key], null, key);
  assert.equal(result.formalQualified, false);
});
test("a partial observation is not promoted to PASS while a known FAIL stays FAIL", () => {
  if (typeof profile.classifyProfileEvidenceV4 !== "function") return;
  const report = evidenceReport();
  report.metrics = [metric("partial", [1, null], 4), metric("known.failure", [5, null], 4)];
  const result = classify(report);
  assert.equal(result.metrics[0].status, "UNVERIFIED");
  assert.equal(result.metrics[1].status, "FAIL");
  assert.equal(result.status, "MEASURED_WITH_FAILURES");
  assert.equal(result.executionStatus, "MEASURED_WITH_FAILURES");
  assert.equal(result.formalQualified, false);
});
for (const flag of [
  "actual600Seconds",
  "actualInterpolationObserved",
  "closedWindowNoPending",
  "topMonitorSnapshotValid",
]) {
  // This remains an unapproved-ID fail-closed case. The actual per-gate
  // inheritance/mutations are exercised independently above, not claimed here.
  test(`unapproved probe-on remains nonqualified with ${flag} false`, () => {
    if (typeof profile.classifyProfileEvidenceV4 !== "function") return;
    const report = evidenceReport();
    report.ui.workloadValidity[flag] = false;
    const result = classify(report, "on", { qualified: true });
    assert.equal(result.formalQualified, false);
    assert.equal(result.formalQualification, "NOT_APPROVED");
  });
}
test("short diagnostic evidence cannot claim formal600 using an external true flag", () => {
  if (typeof profile.classifyProfileEvidenceV4 !== "function") return;
  const report = evidenceReport();
  report.formal600Run = false;
  const result = profile.classifyProfileEvidenceV4(report, {
    probeMode: "on",
    formal: false,
    qualificationId: unapprovedId,
    qualified: true,
  });
  assert.equal(result.formalQualified, false);
  assert.equal(result.formalQualification, "NOT_APPROVED");
});

test("nominal monitor freshness is explicit configuration, not a new default acceptance limit", () => {
  if (typeof profile.evaluateUIWorkloadV4 !== "function") return;
  const data = uiFixture(),
    options = uiOptions();
  data.topMonitorObservation.normalReadAtPerformanceMs = 600000;
  delete options.expectedTopMonitor.maxAgeMs;
  const result = profile.evaluateUIWorkloadV4(data, options);
  assert.equal(
    result.topMonitorSnapshotValid,
    true,
    "finite nonnegative age remains reported; no unapproved nominal-15Hz hard gate",
  );
});
test("actual measured zero acoustic graph values remain zero without implying valid workload", () => {
  if (typeof profile.summarizeProbeObservationsV4 !== "function") return;
  const row = profile.summarizeProbeObservationsV4({
    acousticProfiles: acousticRows([
      {
        scheduledAtMs: 0,
        completedAtMs: 1,
        deadlineMissed: false,
        returnedPaths: 0,
        nativeAudio: { activePaths: 0, activeVoices: 0 },
      },
    ]),
  }).acousticProfiles[0];
  for (const key of acousticAggregateKeys) assert.equal(row[key], 0, key);
  assert.equal(row.deadlineMissedBatches, 0);
  assert.equal(row.cadenceStatus, "ALL_UPDATES_COMPLETED_IN_20HZ_WINDOWS");
});

const qualificationId = "semantic-v3-c59df8c64fdfa846d6e22daf";
const executableSha256 = "7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa";
const producerRevision = "861389936bf33ea77529ee5dcc0605e68f6bb620";
const requiredScope = "FORMAL_V4_SEMANTIC_PRECONDITION";
const actualSemanticReceipt = JSON.parse(
  readFileSync(
    new URL(
      "../../docs/16-nonadvanced-completion/lanes/performance/semantic-attempt03-v4-bootstrap-receipt.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
function qualificationInput() {
  return {
    qualificationId,
    executableSha256,
    producerRevision,
    sourcePins: clone(actualSemanticReceipt.sourcePins),
    requiredScope,
  };
}
async function resolve(input) {
  return await approved.resolveApprovedQualificationV4(input);
}
async function rejectedQualification(input) {
  await assert.rejects(async () => await resolve(input));
}
test("approved V4 resolution is a separate canonical authority, leaving frozen candidate registry intact", () => {
  assert.equal(typeof approved.resolveApprovedQualificationV4, "function");
  const bytes = readFileSync(
    new URL("../browser/performance-qualification-registry-v4.mjs", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "5517664d3e9437257488414584c3dc7140572797103b7611269a98f125adc48d",
  );
});
test("the actual approved semantic03 record resolves its exact 44 source pins and limited scope", async () => {
  if (typeof approved.resolveApprovedQualificationV4 !== "function") return;
  const input = qualificationInput(),
    before = clone(input);
  assert.equal(input.sourcePins.length, 44);
  const record = await resolve(input);
  assert.ok(record && typeof record === "object");
  assert.equal(record.qualificationId, qualificationId);
  assert.deepEqual(input, before);
});
test("approved semantic pins may be covered by a unique well-formed superset", async () => {
  if (typeof approved.resolveApprovedQualificationV4 !== "function") return;
  const input = qualificationInput();
  input.sourcePins.push({
    path: "tests/performance-v3/performance-profile-v4.spec.mjs",
    sha256: createHash("sha256")
      .update(readFileSync(new URL("./performance-profile-v4.spec.mjs", import.meta.url)))
      .digest("hex"),
  });
  const record = await resolve(input);
  assert.equal(record.qualificationId, qualificationId);
});
for (const [name, mutate] of [
  [
    "wrong qualification ID",
    (i) => {
      i.qualificationId = unapprovedId;
    },
  ],
  [
    "missing qualification ID with approval flags",
    (i) => {
      delete i.qualificationId;
      i.approved = true;
      i.qualified = true;
    },
  ],
  [
    "wrong executable hash",
    (i) => {
      i.executableSha256 = "0".repeat(64);
    },
  ],
  [
    "missing executable hash",
    (i) => {
      delete i.executableSha256;
    },
  ],
  [
    "wrong producer",
    (i) => {
      i.producerRevision = "0".repeat(40);
    },
  ],
  [
    "missing producer",
    (i) => {
      delete i.producerRevision;
    },
  ],
  [
    "missing scope",
    (i) => {
      delete i.requiredScope;
    },
  ],
  [
    "claiming formal600 PASS",
    (i) => {
      i.requiredScope = "FORMAL_600_PASS";
    },
  ],
  [
    "claiming DSP CPU",
    (i) => {
      i.requiredScope = "DSP_CPU";
    },
  ],
  [
    "claiming GUI",
    (i) => {
      i.requiredScope = "GUI";
    },
  ],
  [
    "claiming hearing",
    (i) => {
      i.requiredScope = "HEARING";
    },
  ],
  [
    "missing source manifest",
    (i) => {
      delete i.sourcePins;
    },
  ],
  [
    "one approved source missing",
    (i) => {
      i.sourcePins.pop();
    },
  ],
  [
    "one approved source changed",
    (i) => {
      i.sourcePins[0].sha256 = "0".repeat(64);
    },
  ],
  [
    "duplicate approved source",
    (i) => {
      i.sourcePins.push(clone(i.sourcePins[0]));
    },
  ],
  [
    "duplicate path with conflicting bytes",
    (i) => {
      i.sourcePins.push({ ...i.sourcePins[0], sha256: "0".repeat(64) });
    },
  ],
]) {
  test(`canonical V4 resolver rejects ${name}`, async () => {
    if (typeof approved.resolveApprovedQualificationV4 !== "function") return;
    const input = qualificationInput();
    mutate(input);
    await rejectedQualification(input);
  });
}

for (const args of [
  ["--seconds", "--probe-mode", "off", "20"],
  ["--executable-path", "--qualification", qualificationId, executable],
]) {
  test(`new options cannot repair a missing legacy immediate value: ${args.join(" ")}`, () => {
    if (typeof cli.parseProfileOptionsV4 !== "function") return;
    assert.throws(() => cli.parseProfileOptionsV4(args), /MISSING_OPTION_VALUE/);
  });
}

test("a passive monitor sample must belong to the actual collection, without inventing a freshness budget", async () => {
  const contract = await import("../browser/performance-profile-contract-v4.mjs");
  const data = uiFixture(),
    options = uiOptions();
  delete options.expectedTopMonitor.maxAgeMs;
  data.topMonitorObservation.normalReadAtPerformanceMs = data.startedAtPerformanceMs - 1;
  assert.equal(contract.evaluateUIWorkloadV4(data, options).topMonitorSnapshotValid, false);
});
function v4CompletedProcess() {
  return {
    exit_code: 0,
    timed_out: false,
    cancelled: false,
    output_limit: false,
    process_stopped: true,
    process_tree_stopped: null,
    stop_scope: "direct_process",
    spawn_error: null,
  };
}
function v4CleanChild() {
  return {
    cleanup: {
      browserConnected: false,
      previewProcessStopped: true,
      previewListeningAfterCleanup: false,
      errors: [],
    },
    formalQualified: true,
  };
}
test("V4 normal typed successful exit retains release and child qualification separately", () => {
  if (typeof runner.performanceProcessOutcomeV4 !== "function") return;
  const result = runner.performanceProcessOutcomeV4(v4CompletedProcess(), v4CleanChild());
  assert.equal(result.machineLeaseReleasable, true);
  assert.equal(result.formalQualified, true);
});
for (const [name, change] of [
  [
    "forced timeout after a stale successful child receipt",
    { exit_code: null, timed_out: true, process_tree_stopped: true },
  ],
  ["nonzero exit after actual resource closure", { exit_code: 1 }],
  ["unknown typed timeout state", { timed_out: undefined }],
]) {
  test(`V4 release cannot promote ${name} to formal success`, () => {
    if (typeof runner.performanceProcessOutcomeV4 !== "function") return;
    const result = runner.performanceProcessOutcomeV4(
      { ...v4CompletedProcess(), ...change },
      v4CleanChild(),
    );
    assert.equal(result.machineLeaseReleasable, true);
    assert.equal(result.formalQualified, false);
  });
}

test("audio resource policy arm defaults to the original reference without reducing any formal load", () => {
  if (typeof cli.parseProfileOptionsV4 !== "function") return;
  const options = cli.parseProfileOptionsV4(["--formal-600"]);
  assert.equal(options.audioPolicyArm, "reference");
  assert.equal(options.physicsIterations, 3000);
  assert.equal(options.acousticIterations, 600);
});
test("the candidate audio arm is an explicit option under the same original formal workload", () => {
  if (typeof cli.parseProfileOptionsV4 !== "function") return;
  const options = cli.parseProfileOptionsV4(["--formal-600", "--audio-policy-arm", "candidate"]);
  assert.equal(options.audioPolicyArm, "candidate");
  assert.equal(options.seconds, 600);
  assert.equal(options.phase, "all");
  assert.equal(options.physicsIterations, 3000);
  assert.equal(options.acousticIterations, 600);
});
for (const args of [
  ["--audio-policy-arm", "unknown"],
  ["--audio-policy-arm"],
  ["--audio-policy-arm", "reference", "--audio-policy-arm", "candidate"],
]) {
  test(`audio policy arm is type/identity strict: ${args.join(" ")}`, () => {
    if (typeof cli.parseProfileOptionsV4 !== "function") return;
    assert.throws(() => cli.parseProfileOptionsV4(args));
  });
}
test("the bounded planner forwards the requested arm without claiming it is observed", async () => {
  if (typeof runner.planPerformanceRunV4 !== "function") return;
  const plan = await runner.planPerformanceRunV4(
    ["--seconds", "20", "--executable-path", executable, "--audio-policy-arm", "candidate"],
    dependencies,
  );
  assert.equal(plan.audioPolicyArm, "candidate");
  assert.ok(plan.args.includes("--audio-policy-arm"));
  assert.ok(plan.args.includes("candidate"));
  assert.equal(plan.formalRunApproved, false);
});

// Synthetic classifier input only: these booleans do not constitute a measured
// 600-second run. Keep this inventory independent of the production classifier.
const MANDATORY_UI_ORIGINAL_V4_CONTRACT = Object.freeze([
  "actual600Seconds",
  "finiteOrderedFrames",
  "frameCollectionMembership",
  "actualInterpolationObserved",
  "noSampleTruncation",
  "noRuntimeOrScriptErrors",
  "uninterruptedSimulation",
  "fixedTickProgress",
  "noDroppedWallTime",
  "noOverrunOrRecordingDebt",
  "acceptedGrabAndThrow",
  "closedWindowNoPending",
  "periodicCaptureCompleted",
  "captureTickSamples",
  "nativeGraphStarted",
  "genuineRunningWarmup",
]);
const MANDATORY_UI_REPORT_V4_CONTRACT = Object.freeze([
  ...MANDATORY_UI_ORIGINAL_V4_CONTRACT,
  "topMonitorSnapshotValid",
  "actualAudioPolicyAtEnable",
  "actualAudioPolicyAtClose",
]);
const MANDATORY_PHYSICS_V4_CONTRACT = Object.freeze([
  "exactBodyProfile",
  "fixedStepAndWarmup",
  "completeSamples",
  "awakeDynamicLoad",
  "allDynamicBodiesContacted",
  "observedContactLoad",
  "boundedCatchup",
]);
const MANDATORY_ACOUSTIC_ORIGINAL_V4_CONTRACT = Object.freeze([
  "completeSamples",
  "eightVoicesAdmitted",
  "actualModuleWorker",
  "frozenAcousticMatrix",
  "nativeContextRunning",
  "sustainedRequestedPaths",
  "sustainedEightVoices",
  "cleanNativeState",
  "noNativeCapacityOrStaleLoss",
  "eightSuccessfulNativeStarts",
  "nativeClockAdvances",
  "meets20HzWindows",
  "observableDeliveryIdentity",
]);
const MANDATORY_ACOUSTIC_REPORT_V4_CONTRACT = Object.freeze([
  ...MANDATORY_ACOUSTIC_ORIGINAL_V4_CONTRACT,
  "actualAudioPolicyAtEnable",
  "actualAudioPolicyAtClose",
]);
const frozenWorkloadEvaluatorsV4Contract = await import("../browser/performance-profile.mjs");
const classifierV4Contract = await import("../browser/performance-profile-contract-v4.mjs");
const trueGateRecordV4Contract = (keys) => Object.fromEntries(keys.map((key) => [key, true]));
const classifierOptionsV4Contract = () => ({ probeMode: "on", formal: true, qualificationId });
function completeProfileContractFixtureV4() {
  const profiles = [
    {
      profileId: "productDefault",
      isProductDefault: true,
      requestedPathCapPerVoice: 8,
      nativeGraphTargetPaths: 64,
      sourceCount: 8,
      surfacesPerSource: 32,
      maxReflectionOrder: 1,
      targetHz: 20,
      workloadValidity: trueGateRecordV4Contract(MANDATORY_ACOUSTIC_REPORT_V4_CONTRACT),
    },
    {
      profileId: "stress256",
      isProductDefault: false,
      requestedPathCapPerVoice: 32,
      nativeGraphTargetPaths: 256,
      sourceCount: 8,
      surfacesPerSource: 32,
      maxReflectionOrder: 1,
      targetHz: 20,
      workloadValidity: trueGateRecordV4Contract(MANDATORY_ACOUSTIC_REPORT_V4_CONTRACT),
    },
  ];
  const metrics = [
    metric("physics.nativeWasmStep", [0.5], 2),
    metric("physics.completeFixedTickWithCopies", [0.6]),
    metric("physics.wakeMaintenance", [0.1]),
    metric("physics.loadSetup", [0.2]),
    metric("physics.measuredStepIncludingLoadSetup", [0.8]),
    metric("ui.frameInterval", [16], 16.67),
    metric("ui.allRafCallbackCPU", [1], 4),
    metric("ui.advanceCPU", [0.5]),
    metric("ui.poseLookupCPUPerFrame", [0.1]),
    metric("ui.nativePhysicsStep", [0.2], 2),
    metric("ui.physicsFixedStepInternal", [0.1]),
    metric("ui.behaviorAndRecordingTick", [0.1]),
    metric("ui.captureTick", [0.1]),
    metric("ui.cachedInterpolation", [0.1]),
    metric("ui.rendererMainTaskOccupancyPerFrame", [2], 4),
    ...profiles.flatMap((entry) =>
      [
        ["workerCompute", 2, 20],
        ["serviceDelivery", 0.1, 1],
        ["actualAudioConsumers", 0.1, null],
        ["combinedDelivery", 0.2, 1],
        ["roundTrip", 3, null],
        ["receiveThroughNativeConsumers", 0.3, 1],
      ].map(([name, value, threshold]) => ({
        ...metric(`acoustic.${entry.profileId}.${name}`, [value], threshold),
        profileId: entry.profileId,
        isProductDefault: entry.isProductDefault,
      })),
    ),
  ];
  return {
    status: "MEASURED_LOCAL_ONLY",
    formal600Run: true,
    sourceStableDuringRun: true,
    bundleStableDuringRun: true,
    executableStableDuringRun: true,
    semanticPrecondition: { verified: true, qualificationId, scope: requiredScope },
    sourceInputs: clone(actualSemanticReceipt.sourcePins),
    host: { executableSha256, browserVersionReceipt: { revision: `@${producerRevision}` } },
    cleanup: { browserConnected: false, previewProcessStopped: true, errors: [] },
    ui: {
      workloadValidity: trueGateRecordV4Contract(MANDATORY_UI_REPORT_V4_CONTRACT),
      traceCoverage: { complete: true, nativeV4Qualified: true, originalRawV3Qualified: false },
    },
    physics: { workloadValidity: trueGateRecordV4Contract(MANDATORY_PHYSICS_V4_CONTRACT) },
    acousticProfiles: profiles,
    metrics,
    nativeAudioDsp: {
      status: "NOT_MEASURED",
      cpuMs: null,
      hardwareBlockFrames: null,
      deadline: null,
    },
  };
}
function classifyCompleteContractV4(report) {
  return classifierV4Contract.classifyProfileEvidenceV4(report, classifierOptionsV4Contract());
}
function assertCompleteContractFixtureV4() {
  const report = completeProfileContractFixtureV4();
  assert.equal(
    classifyCompleteContractV4(report).formalQualified,
    true,
    "positive control must reach the workload gates under the actual registered method",
  );
  return report;
}
function assertRejectedCompleteContractV4(report) {
  let result;
  assert.doesNotThrow(() => {
    result = classifyCompleteContractV4(report);
  });
  assert.equal(result.formalQualified, false);
  assert.equal(result.formalQualification, "NOT_APPROVED");
}
const gateLocationsV4Contract = [
  { name: "UI", keys: MANDATORY_UI_REPORT_V4_CONTRACT, get: (report) => report.ui },
  { name: "physics", keys: MANDATORY_PHYSICS_V4_CONTRACT, get: (report) => report.physics },
  {
    name: "productDefault",
    keys: MANDATORY_ACOUSTIC_REPORT_V4_CONTRACT,
    get: (report) => report.acousticProfiles[0],
  },
  {
    name: "stress256",
    keys: MANDATORY_ACOUSTIC_REPORT_V4_CONTRACT,
    get: (report) => report.acousticProfiles[1],
  },
];

test("formal mandatory gate inventories exactly retain immutable UI physics and acoustic evaluators", () => {
  const options = uiOptions();
  const ui = originalUIWorkload(uiFixture(), {
    ...options,
    traceCoverage: { ...options.traceCoverage, nativeV3Qualified: true },
  });
  assert.deepEqual(Object.keys(ui).sort(), [...MANDATORY_UI_ORIGINAL_V4_CONTRACT].sort());
  assert.deepEqual(
    Object.keys(frozenWorkloadEvaluatorsV4Contract.evaluatePhysicsWorkload({})).sort(),
    [...MANDATORY_PHYSICS_V4_CONTRACT].sort(),
  );
  assert.deepEqual(
    Object.keys(frozenWorkloadEvaluatorsV4Contract.evaluateAcousticWorkload({})).sort(),
    [...MANDATORY_ACOUSTIC_ORIGINAL_V4_CONTRACT].sort(),
  );
  assert.equal(MANDATORY_UI_REPORT_V4_CONTRACT.length, 19);
  assert.equal(MANDATORY_PHYSICS_V4_CONTRACT.length, 7);
  assert.equal(MANDATORY_ACOUSTIC_REPORT_V4_CONTRACT.length, 15);
});
test("a complete synthetic report reaches formal workload classification without inventing raw V3 approval", () => {
  const report = assertCompleteContractFixtureV4(),
    before = clone(report);
  const result = classifyCompleteContractV4(report);
  assert.equal(result.status, "FORMAL_PROFILE_MEASURED");
  assert.equal(result.formalQualified, true);
  assert.equal(result.overallV1Complete, false);
  assert.equal(report.ui.traceCoverage.originalRawV3Qualified, false);
  assert.equal(report.nativeAudioDsp.cpuMs, null);
  assert.deepEqual(report, before);
});
for (const location of gateLocationsV4Contract) {
  for (const key of location.keys) {
    test(`formal report requires its own ${location.name}.${key} gate rather than a nonempty true subset`, () => {
      const report = assertCompleteContractFixtureV4();
      delete location.get(report).workloadValidity[key];
      assertRejectedCompleteContractV4(report);
    });
  }
  test(`an unrelated true flag cannot replace the entire ${location.name} gate inventory`, () => {
    const report = assertCompleteContractFixtureV4();
    location.get(report).workloadValidity = { unrelated: true };
    assertRejectedCompleteContractV4(report);
  });
  for (const [name, value] of [
    ["false", false],
    ["null", null],
    ["truthy string", "true"],
  ]) {
    test(`mandatory ${location.name} gates retain actual-true semantics for ${name}`, () => {
      const report = assertCompleteContractFixtureV4();
      location.get(report).workloadValidity[location.keys[0]] = value;
      assertRejectedCompleteContractV4(report);
    });
  }
}
const profileIdentityMutationsV4Contract = [
  [
    "two copies of productDefault omit stress256",
    (report) => {
      report.acousticProfiles[1] = clone(report.acousticProfiles[0]);
    },
  ],
  [
    "two copies of stress256 omit productDefault",
    (report) => {
      report.acousticProfiles[0] = clone(report.acousticProfiles[1]);
    },
  ],
  [
    "unknown default profile ID",
    (report) => {
      report.acousticProfiles[0].profileId = "unknown-default";
    },
  ],
  [
    "unknown stress profile ID",
    (report) => {
      report.acousticProfiles[1].profileId = "unknown-stress";
    },
  ],
  [
    "default falsely marked nondefault",
    (report) => {
      report.acousticProfiles[0].isProductDefault = false;
    },
  ],
  [
    "stress falsely marked default",
    (report) => {
      report.acousticProfiles[1].isProductDefault = true;
    },
  ],
  [
    "default carries the stress path capacity",
    (report) => {
      report.acousticProfiles[0].requestedPathCapPerVoice = 32;
      report.acousticProfiles[0].nativeGraphTargetPaths = 256;
    },
  ],
  [
    "stress carries the smaller default path capacity",
    (report) => {
      report.acousticProfiles[1].requestedPathCapPerVoice = 8;
      report.acousticProfiles[1].nativeGraphTargetPaths = 64;
    },
  ],
  [
    "default graph target changed",
    (report) => {
      report.acousticProfiles[0].nativeGraphTargetPaths = 63;
    },
  ],
  [
    "stress graph target changed",
    (report) => {
      report.acousticProfiles[1].nativeGraphTargetPaths = 255;
    },
  ],
  [
    "default missing path capacity",
    (report) => {
      delete report.acousticProfiles[0].requestedPathCapPerVoice;
    },
  ],
  [
    "stress missing graph target",
    (report) => {
      delete report.acousticProfiles[1].nativeGraphTargetPaths;
    },
  ],
  [
    "default arm absent",
    (report) => {
      report.acousticProfiles = [report.acousticProfiles[1]];
    },
  ],
  [
    "stress arm absent",
    (report) => {
      report.acousticProfiles = [report.acousticProfiles[0]];
    },
  ],
];
for (const [name, mutate] of profileIdentityMutationsV4Contract) {
  test(`formal profile identity rejects ${name} despite every advertised gate being true`, () => {
    const report = assertCompleteContractFixtureV4();
    mutate(report);
    assertRejectedCompleteContractV4(report);
  });
}
for (const [name, value] of [
  ["number", 156],
  ["boolean", true],
  ["array", []],
  ["object", {}],
  ["null", null],
  ["missing", undefined],
]) {
  test(`a malformed browser revision ${name} is controlled nonqualification without replace throwing`, () => {
    const report = assertCompleteContractFixtureV4();
    if (value === undefined) delete report.host.browserVersionReceipt.revision;
    else report.host.browserVersionReceipt.revision = value;
    assertRejectedCompleteContractV4(report);
  });
}
