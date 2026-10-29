import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import * as profile from "../browser/performance-profile.mjs";

const copy = (value) => structuredClone(value);
function accepted(result) {
  assert.ok(result && typeof result === "object", "a workload returns explicit validity facts");
  const facts = Object.values(result);
  assert.ok(facts.length > 0, "empty evidence cannot vacuously pass");
  assert.ok(
    facts.every((value) => typeof value === "boolean"),
    "validity facts are booleans",
  );
  return facts.every(Boolean);
}

function audio(time = 0, paths = 256, pathCap = paths === 64 ? 8 : 32) {
  return {
    enabled: true,
    paused: false,
    contextState: "running",
    currentTimeSeconds: time,
    activeSources: 8,
    activeVoices: 8,
    activePaths: paths,
    retiringVoices: 0,
    pendingVoices: 0,
    frozenVoices: 0,
    frozenArrivals: 0,
    draining: false,
    droppedVoices: 0,
    stolenVoices: 0,
    droppedPaths: 0,
    staleFrames: 0,
    lateEvents: 0,
    lastError: null,
    budget: {
      maxVoices: 24,
      maxSources: 32,
      maxSourceFrames: 64,
      maxPathsPerVoice: pathCap,
      maxTotalPaths: pathCap === 8 ? 96 : 256,
      maxDecodedBytes: 64 * 1024 * 1024,
      maxAssetDurationSeconds: 120,
      maxAssetChannels: 2,
      maxPendingEvents: 256,
      maxAssets: 64,
      maxConcurrentDecodes: 2,
      maxLateSends: 16,
      maxLateReverbBytes: 4 * 1024 * 1024,
    },
  };
}

function acousticBatch(tick, pathCap) {
  return {
    tick,
    poseTick: tick,
    submittedAtMs: tick * 50,
    scheduledAtMs: tick * 50,
    completedAtMs: tick * 50 + 2,
    submissionLateMs: 0,
    deadlineMissed: false,
    roundTripMs: 1,
    workerComputeMs: 0.5,
    serviceDeliveryMs: 0.1,
    audioConsumerMs: 0.1,
    totalDeliveryMs: 0.2,
    observedDelivery: {
      batchId: tick + 1,
      requestIdentities: Array.from({ length: 8 }, (_, source) => ({
        requestId: `r${tick}.${source}`,
        sourceId: `source.${source}`,
        poseTick: tick,
      })),
      receiveEntryAtMs: tick * 50 + 1,
      receiveExitAtMs: tick * 50 + 1.1,
      awaitContinuationAtMs: tick * 50 + 1.2,
      consumerFinishedAtMs: tick * 50 + 1.5,
      durationMs: 0.5,
    },
    receiveThroughNativeConsumersMs: 0.5,
    returnedPaths: 8 * pathCap,
    segmentTests: 256,
    budgetExceeded: false,
    nativeAudio: audio(tick * 0.05, 8 * pathCap),
    routeState: {
      voices: Array.from({ length: 8 }, (_, source) => {
        const ids = Array.from({ length: pathCap }, (_, route) => `p.${source}.${route}`);
        return {
          sourceId: `source.${source}`,
          instanceId: `voice.${source}`,
          active: true,
          sourceStopped: false,
          internalArrival: false,
          routesConnected: true,
          lateRouteCount: 0,
          expectedPoseTick: tick,
          framePoseTick: tick,
          expectedRequestId: `r${tick}.${source}`,
          cachedRequestId: `r${tick}.${source}`,
          wantedPathIds: ids,
          currentPathIds: [...ids],
        };
      }),
      activeCurrentRouteCount: 8 * pathCap,
      retiringCurrentRouteCount: 0,
      activeLateRouteCount: 0,
      retiringLateRouteCount: 0,
      retiredRouteCount: 0,
      retiredLateRouteCount: 0,
      retiringVoiceCount: 0,
    },
  };
}

function acousticFixture(pathCap = 32) {
  return {
    iterations: 600,
    warmupBatches: 20,
    sourceCount: 8,
    surfacesPerSource: 32,
    maxReflectionOrder: 1,
    targetHz: 20,
    requestedPathCapPerVoice: pathCap,
    nativeGraphTargetPaths: 8 * pathCap,
    baselineNativeAudio: { ...audio(0, 0, pathCap), activeVoices: 0, activeSources: 0 },
    measurementBaselineNativeAudio: audio(0.95, 8 * pathCap),
    warmupRaw: Array.from({ length: 20 }, (_, tick) => acousticBatch(tick, pathCap)),
    raw: Array.from({ length: 600 }, (_, index) => acousticBatch(index + 20, pathCap)),
    admissions: Array.from({ length: 8 }, (_, index) => ({
      sourceId: `source.${index}`,
      instanceId: `voice.${index}`,
      accepted: true,
    })),
    nativeStarts: Array.from({ length: 8 }, (_, index) => ({
      sourceId: `source.${index}`,
      instanceId: `voice.${index}`,
      successfulNativeStart: true,
      contextTimeSeconds: 0,
    })),
    telemetry: {
      mode: "worker",
      submittedBatches: 620,
      completedBatches: 620,
      lastError: null,
    },
  };
}

function physicsFixture() {
  return {
    iterations: 3000,
    warmupSteps: 240,
    fixedDtSeconds: 1 / 60,
    fixedBodies: 1,
    dynamicBodies: 255,
    totalBodies: 256,
    maxCatchUpSteps: 4,
    ccdBodyCount: 64,
    nativeStepMs: Array(3000).fill(0.2),
    completeFixedTickMs: Array(3000).fill(0.4),
    contacts: Array(3000).fill(255),
    events: Array(3000).fill(1),
    awakeBodies: Array(3000).fill(255),
    contactBodyIds: Array.from({ length: 255 }, (_, i) => `stress.${i}`),
    catchupProbe: {
      beforeTick: 3240,
      afterTick: 3244,
      steps: 4,
      droppedWallTimeSeconds: 11 / 60,
      overrun: true,
    },
  };
}

function clockState(tick, clockMode = "interactive") {
  return {
    tick,
    clockMode,
    accumulatorSeconds: 0,
    paused: false,
    pauseReason: "",
    recordingState: clockMode === "recording" ? "recording" : "finalized",
    totalDroppedWallTimeSeconds: 0,
  };
}

function advance(tick, phase = "measured") {
  return {
    phase,
    atMs: 100,
    deltaSeconds: 1 / 60,
    steps: 1,
    overrun: false,
    droppedWallTimeSeconds: 0,
    before: clockState(tick),
    after: clockState(tick + 1),
    error: null,
  };
}

function uiFixture() {
  const captures = [
    { index: 0, scheduledAtMs: 10000, tick: 1200, hash: "a" },
    { index: 1, scheduledAtMs: 300000, tick: 18600, hash: "b" },
    { index: 2, scheduledAtMs: 580000, tick: 35400, hash: "c" },
  ];
  return {
    startedAtPerformanceMs: 1000,
    sampleMilliseconds: 600000,
    startedAtTick: 600,
    measuredEndTick: 36600,
    fixedDtSeconds: 1 / 60,
    droppedWallTimeSeconds: 0,
    droppedSamples: 0,
    interpolationCalls: 2,
    interpolationMs: [0.2, 0.3],
    interpolationObservation: {
      requiredMethod: "interpolatedTransforms",
      observedMethods: ["interpolatedTransforms", "interpolatedPoses"],
      calls: 2,
      successfulCalls: 2,
      failedCalls: 0,
      byMethod: {
        interpolatedTransforms: { calls: 2, successfulCalls: 2, failedCalls: 0, ms: [0.2, 0.3] },
        interpolatedPoses: { calls: 0, successfulCalls: 0, failedCalls: 0, ms: [] },
      },
      aggregateScope:
        "Outermost method intervals only; per-method durations are inclusive and must not be summed",
    },
    final: { error: "", simulationState: "paused" },
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
      requested: { atMs: scheduledAtMs, ...clockState(tick) },
      start: { atMs: scheduledAtMs, ...clockState(tick, "recording") },
      beforeStop: { atMs: scheduledAtMs + 1000, ...clockState(tick + 60, "recording") },
      end: { atMs: scheduledAtMs + 1000, ...clockState(tick + 60, "recording") },
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
      ...captures.map(({ scheduledAtMs }) => ({
        atMs: scheduledAtMs + 1000,
        action: { type: "recordToggle" },
        recordingState: "finalized",
        recordingArtifactStatus: "captured",
      })),
    ],
    warmup: {
      durationMs: 10000,
      started: { ...clockState(0), error: null },
      ended: { ...clockState(600), error: null },
      nativeStartsBefore: 0,
      nativeStartsAfter: 1,
      audioClockBefore: 0,
      audioClockAfter: 10,
      audioBefore: audio(0),
      audioAfter: audio(10),
      advances: [advance(0, "warmup"), advance(599, "warmup")],
    },
  };
}

const uiOptions = () => ({
  pageErrors: [],
  traceCoverage: { complete: true, markedDurationMs: 600000 },
});

function rejectsMutation(name, build, evaluate, mutate) {
  test(name, () => {
    const value = build();
    mutate(value);
    assert.equal(accepted(evaluate(value)), false);
  });
}

test("performance workload gates are importable without starting the browser runner", () => {
  for (const name of [
    "evaluateAcousticWorkload",
    "evaluatePhysicsWorkload",
    "evaluateUIWorkload",
    "analyzeFrameCoverage",
    "metric",
  ])
    assert.equal(typeof profile[name], "function", `${name} must be a pure exported helper`);
});

test("valid acoustic evidence covers both the product path cap and the 256-path stress graph", () => {
  for (const cap of [8, 32])
    assert.equal(accepted(profile.evaluateAcousticWorkload(acousticFixture(cap))), true);
});

const acousticRejects = [
  [
    "a missing observable delivery cannot pass on known-stage sums",
    (d) => {
      delete d.raw[0].observedDelivery;
    },
  ],
  [
    "delivery for a different request cannot time the current native frame",
    (d) => {
      d.raw[0].observedDelivery.requestIdentities[0].requestId = "wrong.request";
    },
  ],
  [
    "a fabricated delivery duration cannot omit part of the observed interval",
    (d) => {
      d.raw[0].observedDelivery.durationMs = 0.1;
      d.raw[0].receiveThroughNativeConsumersMs = 0.1;
    },
  ],
  [
    "a changed source matrix cannot pass the eight-source acoustic profile",
    (d) => {
      d.sourceCount = 7;
    },
  ],
  [
    "a changed surface matrix cannot pass the 32-surface acoustic profile",
    (d) => {
      d.surfacesPerSource = 31;
    },
  ],
  [
    "an unsupported reflection order cannot pass the first-order acoustic profile",
    (d) => {
      d.maxReflectionOrder = 2;
    },
  ],
  [
    "a slower configured cadence cannot pass the 20Hz acoustic profile",
    (d) => {
      d.targetHz = 10;
    },
  ],
  [
    "disabled native audio cannot pass by retaining old graph counters",
    (d) => {
      d.raw[0].nativeAudio.enabled = false;
    },
  ],
  [
    "paused native audio cannot pass by retaining current route counts",
    (d) => {
      d.raw[0].nativeAudio.paused = true;
    },
  ],
  [
    "pending native voices invalidate the active graph workload",
    (d) => {
      d.raw[0].nativeAudio.pendingVoices = 1;
    },
  ],
  [
    "frozen native voices cannot hide behind eight current voices",
    (d) => {
      d.raw[0].nativeAudio.frozenVoices = 1;
    },
  ],
  [
    "frozen native arrivals cannot hide behind complete current routes",
    (d) => {
      d.raw[0].nativeAudio.frozenArrivals = 1;
    },
  ],
  [
    "draining native audio cannot pass as a stable graph workload",
    (d) => {
      d.raw[0].nativeAudio.draining = true;
    },
  ],
  [
    "a changed per-voice native budget cannot pass the requested path cap",
    (d) => {
      d.raw[0].nativeAudio.budget.maxPathsPerVoice = 8;
    },
  ],
  [
    "a changed total native budget cannot pass the 256-route stress profile",
    (d) => {
      d.raw[0].nativeAudio.budget.maxTotalPaths = 96;
    },
  ],
  [
    "empty acoustic samples cannot pass vacuously",
    (d) => {
      d.raw = [];
    },
  ],
  [
    "a short measured acoustic run cannot pass the full sample gate",
    (d) => {
      d.raw.pop();
    },
  ],
  [
    "duplicate admitted source IDs cannot substitute for eight distinct sources",
    (d) => {
      d.admissions[7].sourceId = d.admissions[0].sourceId;
    },
  ],
  [
    "a rejected native voice cannot satisfy the source workload",
    (d) => {
      d.admissions[7].accepted = false;
    },
  ],
  [
    "retired routes cannot pad the requested current route count",
    (d) => {
      d.raw[0].routeState.retiredRouteCount = 1;
      d.raw[0].routeState.voices[0].currentPathIds.pop();
    },
  ],
  [
    "eight aggregate voices cannot hide a duplicate current source",
    (d) => {
      d.raw[0].routeState.voices[7].sourceId = "source.0";
    },
  ],
  [
    "extra native voices invalidate the exact eight-voice profile",
    (d) => {
      d.raw[0].nativeAudio.activeVoices = 9;
    },
  ],
  [
    "stopped sources cannot count as current native voices",
    (d) => {
      d.raw[0].routeState.voices[0].sourceStopped = true;
    },
  ],
  [
    "disconnected current routes do not satisfy graph load",
    (d) => {
      d.raw[0].routeState.voices[0].routesConnected = false;
    },
  ],
  [
    "internal arrival voices cannot replace the eight original voices",
    (d) => {
      d.raw[0].routeState.voices[0].internalArrival = true;
    },
  ],
  [
    "the current route set must match the latest desired path identities",
    (d) => {
      d.raw[0].routeState.voices[0].currentPathIds[0] = "wrong.path";
    },
  ],
  [
    "duplicate path IDs cannot pad the per-voice path budget",
    (d) => {
      d.raw[0].routeState.voices[0].currentPathIds[1] =
        d.raw[0].routeState.voices[0].currentPathIds[0];
    },
  ],
  [
    "equal path IDs from an old pose tick are stale evidence",
    (d) => {
      d.raw[0].routeState.voices[0].framePoseTick--;
    },
  ],
  [
    "an old cached request cannot pass by keeping its path count",
    (d) => {
      d.raw[0].routeState.voices[0].cachedRequestId = "r0.0";
    },
  ],
  [
    "aggregate route totals must reconcile with current voices",
    (d) => {
      d.raw[0].routeState.activeCurrentRouteCount = 255;
    },
  ],
  [
    "a suspended native audio context invalidates native graph timing",
    (d) => {
      d.raw[0].nativeAudio.contextState = "suspended";
    },
  ],
  [
    "a frozen audio clock cannot establish native rendering",
    (d) => {
      for (const row of d.raw) row.nativeAudio.currentTimeSeconds = 1;
    },
  ],
  [
    "only successful native starts satisfy the admission evidence",
    (d) => {
      d.nativeStarts[0].successfulNativeStart = false;
    },
  ],
  [
    "native graph errors invalidate otherwise complete path counts",
    (d) => {
      d.raw[0].nativeAudio.lastError = "NATIVE_START_FAILED";
    },
  ],
  [
    "a synchronous fallback cannot pass the module Worker profile",
    (d) => {
      d.telemetry.mode = "synchronous";
    },
  ],
  [
    "a numeric completion beyond its 50ms window cannot hide behind a false flag",
    (d) => {
      d.raw[0].completedAtMs = d.raw[0].scheduledAtMs + 51;
    },
  ],
  [
    "nonfinite cadence timestamps are invalid evidence",
    (d) => {
      d.raw[0].completedAtMs = Number.NaN;
    },
  ],
];
for (const [name, mutate] of acousticRejects)
  rejectsMutation(name, acousticFixture, (d) => profile.evaluateAcousticWorkload(d), mutate);

for (const counter of ["droppedVoices", "stolenVoices", "droppedPaths", "staleFrames"])
  rejectsMutation(
    `new ${counter} invalidates graph load even with matching route counts`,
    acousticFixture,
    (d) => profile.evaluateAcousticWorkload(d),
    (d) => {
      d.raw[0].nativeAudio[counter] = 1;
    },
  );

rejectsMutation(
  "warmup drops remain failures even when the measurement baseline hides them",
  acousticFixture,
  (d) => profile.evaluateAcousticWorkload(d),
  (d) => {
    d.warmupRaw[0].nativeAudio.droppedPaths = 1;
    d.measurementBaselineNativeAudio.droppedPaths = 1;
    for (const row of d.raw) row.nativeAudio.droppedPaths = 1;
  },
);

test("late-event telemetry remains a retained fact rather than an invented drop threshold", () => {
  const data = acousticFixture();
  data.raw[0].nativeAudio.lateEvents = 1;
  assert.equal(accepted(profile.evaluateAcousticWorkload(data)), true);
});

rejectsMutation(
  "a reused dirty engine cannot pass by treating existing losses as its baseline",
  acousticFixture,
  (d) => profile.evaluateAcousticWorkload(d),
  (d) => {
    for (const snapshot of [
      d.baselineNativeAudio,
      d.measurementBaselineNativeAudio,
      ...d.warmupRaw.map((row) => row.nativeAudio),
      ...d.raw.map((row) => row.nativeAudio),
    ])
      for (const counter of ["droppedVoices", "stolenVoices", "droppedPaths", "staleFrames"])
        snapshot[counter] = 1;
  },
);

test("full physics evidence validates the exact fixed-step stress profile", () => {
  assert.equal(accepted(profile.evaluatePhysicsWorkload(physicsFixture())), true);
});
for (const [name, mutate] of [
  [
    "a smaller physics scene cannot pass the 256-body gate",
    (d) => {
      d.dynamicBodies = 254;
    },
  ],
  [
    "a missing CCD subset cannot pass the CCD profile",
    (d) => {
      d.ccdBodyCount = 0;
    },
  ],
  [
    "a changed fixed step cannot pass the 60Hz physics profile",
    (d) => {
      d.fixedDtSeconds = 1 / 30;
    },
  ],
  [
    "a short physics measurement cannot pass the full profile",
    (d) => {
      d.iterations = 2999;
    },
  ],
  [
    "mismatched physics arrays cannot conceal missing samples",
    (d) => {
      d.nativeStepMs.pop();
    },
  ],
  [
    "five catch-up steps violate the four-step ceiling",
    (d) => {
      d.catchupProbe.steps = 5;
      d.catchupProbe.afterTick = 3245;
    },
  ],
  [
    "sleeping bodies cannot count as the all-awake stress profile",
    (d) => {
      d.awakeBodies[0] = 254;
    },
  ],
  [
    "no contacts cannot pass the declared contact workload",
    (d) => {
      d.contacts.fill(0);
    },
  ],
  [
    "nonfinite physics samples cannot pass by being filtered out",
    (d) => {
      d.nativeStepMs[0] = Number.NaN;
    },
  ],
])
  rejectsMutation(name, physicsFixture, (d) => profile.evaluatePhysicsWorkload(d), mutate);

test("valid UI evidence retains genuine warmup and three captured windows", () => {
  assert.equal(accepted(profile.evaluateUIWorkload(uiFixture(), uiOptions())), true);
});
for (const [name, mutate] of [
  [
    "capture cannot include a tick from before its explicit start request",
    (d) => {
      d.captureWindows[0].artifact.startTick = 1200;
      d.captureWindows[0].artifact.frameCount = 61;
    },
  ],
  [
    "post-await capture clocks cannot admit ticks produced after the stop request",
    (d) => {
      d.captureWindows[0].artifact.endTick = 1261;
      d.captureWindows[0].artifact.frameCount = 61;
      d.captureWindows[0].end.tick = 1262;
    },
  ],
  [
    "recording overrun cannot pass after the simulation catches back up",
    (d) => {
      d.advances[1].overrun = true;
    },
  ],
  [
    "recording accumulator debt cannot hide behind zero dropped wall time",
    (d) => {
      d.advances[1].after.clockMode = "recording";
      d.advances[1].after.accumulatorSeconds = 1 / 60;
    },
  ],
  [
    "a raw paused advance cannot hide between running RAF samples",
    (d) => {
      d.advances[1].after.paused = true;
      d.advances[1].after.pauseReason = "RECORDING_OVERRUN";
    },
  ],
  [
    "capture-local overruns invalidate a captured artifact",
    (d) => {
      d.captureWindows[0].overrunCount = 1;
    },
  ],
  [
    "capture-local pauses remain failures despite successful sealing",
    (d) => {
      d.captureWindows[0].pausedAdvanceCount = 1;
    },
  ],
  [
    "a missing capture window cannot pass by counting action logs",
    (d) => {
      d.captureWindows.pop();
    },
  ],
  [
    "zero-frame captures cannot count as completed windows",
    (d) => {
      d.captureWindows[0].artifact.frameCount = 0;
    },
  ],
  [
    "reversed artifact ticks cannot count as a captured interval",
    (d) => {
      d.captureWindows[0].artifact.endTick = d.captureWindows[0].artifact.startTick - 1;
    },
  ],
  [
    "an unverified capture hash cannot count as reviewable evidence",
    (d) => {
      d.captureWindows[0].artifact.sha256 = "";
    },
  ],
  [
    "empty advance evidence cannot vacuously prove no overruns",
    (d) => {
      d.advances = [];
    },
  ],
  [
    "cold idle time cannot masquerade as active ten-second warmup",
    (d) => {
      d.warmup.ended.tick = d.warmup.started.tick;
    },
  ],
  [
    "a short warmup cannot pass the ten-second gate",
    (d) => {
      d.warmup.durationMs = 9999;
    },
  ],
  [
    "a frozen warmup audio clock cannot prove native graph warmup",
    (d) => {
      d.warmup.audioClockAfter = 0;
      d.warmup.audioAfter.currentTimeSeconds = 0;
    },
  ],
  [
    "no warmup native starts cannot be repaired by measured-phase starts",
    (d) => {
      d.warmup.nativeStartsAfter = d.warmup.nativeStartsBefore;
    },
  ],
  [
    "a warmup overrun is retained rather than hidden by measured success",
    (d) => {
      d.warmup.advances[0].overrun = true;
    },
  ],
  [
    "truncated telemetry cannot pass the complete UI gate",
    (d) => {
      d.droppedSamples = 1;
    },
  ],
  [
    "a runtime action error invalidates the requested workload",
    (d) => {
      d.actions.push({ error: "TRANSACTION_BUSY" });
    },
  ],
  [
    "no accepted throw cannot pass the grab-and-throw workload",
    (d) => {
      d.actions[1].accepted = false;
    },
  ],
  [
    "insufficient logical ticks cannot pass a full wall-clock run",
    (d) => {
      d.measuredEndTick = 35000;
    },
  ],
])
  rejectsMutation(name, uiFixture, (d) => profile.evaluateUIWorkload(d, uiOptions()), mutate);

test("page errors invalidate otherwise healthy UI evidence", () => {
  assert.equal(
    accepted(
      profile.evaluateUIWorkload(uiFixture(), {
        ...uiOptions(),
        pageErrors: [{ message: "render failed" }],
      }),
    ),
    false,
  );
});

test("incomplete trace coverage invalidates otherwise healthy UI evidence", () => {
  assert.equal(
    accepted(
      profile.evaluateUIWorkload(uiFixture(), {
        ...uiOptions(),
        traceCoverage: { complete: false, markedDurationMs: 600000 },
      }),
    ),
    false,
  );
});

test("a short trace duration cannot pass a requested ten-minute UI run", () => {
  assert.equal(
    accepted(
      profile.evaluateUIWorkload(uiFixture(), {
        ...uiOptions(),
        traceCoverage: { complete: true, markedDurationMs: 599999 },
      }),
    ),
    false,
  );
});

test("frame bins include both exact marker edges without losing task occupancy", () => {
  const coverage = profile.analyzeFrameCoverage([{ timestamp: 1010 }, { timestamp: 1020 }], {
    startedAtPerformanceMs: 1000,
    sampleMilliseconds: 30,
  });
  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.boundaries, [1000, 1010, 1020, 1030]);
  assert.equal(coverage.firstRafGapMs, 10);
  assert.equal(coverage.lastRafGapMs, 10);
});

test("native RAF timestamps at marker edges are not duplicated into zero-width bins", () => {
  const coverage = profile.analyzeFrameCoverage([{ timestamp: 1000 }, { timestamp: 1030 }], {
    startedAtPerformanceMs: 1000,
    sampleMilliseconds: 30,
  });
  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.boundaries, [1000, 1030]);
});

async function withCompressedTrace(tasks, verify, markerEndTsUs = 1030000, markerIdentity = {}) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = await mkdtemp(path.join(temporaryRoot, "reflection-lab-profile-trace-"));
  const filename = path.join(directory, "trace.json.gz");
  const traceEvents = [
    { ph: "M", name: "thread_name", pid: 1, tid: 1, args: { name: "CrRendererMain" } },
    { ph: "M", name: "thread_name", pid: 2, tid: 2, args: { name: "CrRendererMain" } },
    {
      ph: "R",
      name: markerIdentity.beginName ?? "reflection-profile.begin",
      pid: 1,
      tid: 1,
      ts: 1000000,
    },
    {
      ph: "R",
      name: markerIdentity.endName ?? "reflection-profile.end",
      pid: markerIdentity.endPid ?? 1,
      tid: markerIdentity.endTid ?? 1,
      ts: markerEndTsUs,
    },
    ...tasks,
  ];
  try {
    await writeFile(filename, gzipSync(JSON.stringify({ traceEvents })));
    await verify(filename);
  } finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), temporaryRoot);
    assert.ok(path.basename(resolved).startsWith("reflection-lab-profile-trace-"));
    await rm(resolved, { recursive: true, force: true });
  }
}

const tracedUI = () => ({
  startedAtPerformanceMs: 1000,
  sampleMilliseconds: 30,
  frame: [{ timestamp: 1010 }, { timestamp: 1020 }],
});

test("compressed trace retains both partial edge bins and unions overlapping native tasks once", async () => {
  await withCompressedTrace(
    [
      { ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 1000000, dur: 12000 },
      { ph: "X", name: "ThreadControllerImpl::RunTask", pid: 1, tid: 1, ts: 1008000, dur: 15000 },
      { ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 1020000, dur: 10000 },
      { ph: "X", name: "RunTask", pid: 2, tid: 2, ts: 1000000, dur: 30000 },
    ],
    async (filename) => {
      const result = await profile.analyzeTrace(filename, tracedUI());
      assert.equal(result.coverage.complete, true);
      assert.deepEqual(result.rendererMainThreads, ["1:1"]);
      assert.equal(result.nativeTaskCount, 3);
      assert.deepEqual(result.mainTaskOccupancyMs, [10, 10, 10]);
      assert.equal(
        result.mainTaskOccupancyMs.reduce((sum, value) => sum + value, 0),
        30,
      );
    },
  );
});

test("another renderer's task cannot fill idle intervals on the marker renderer", async () => {
  await withCompressedTrace(
    [
      { ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 1000000, dur: 10000 },
      { ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 1020000, dur: 10000 },
      { ph: "X", name: "RunTask", pid: 2, tid: 2, ts: 1010000, dur: 10000 },
    ],
    async (filename) => {
      const result = await profile.analyzeTrace(filename, tracedUI());
      assert.deepEqual(result.rendererMainThreads, ["1:1"]);
      assert.deepEqual(result.mainTaskOccupancyMs, [10, 0, 10]);
    },
  );
});

for (const [name, timestamps] of [
  ["missing RAF evidence", []],
  ["single RAF evidence", [1010]],
  ["duplicate RAF timestamps", [1010, 1010]],
  ["decreasing RAF timestamps", [1020, 1010]],
  ["nonfinite RAF timestamps", [1010, Number.NaN]],
  ["RAF before the begin marker", [999, 1010]],
  ["RAF after the end marker", [1010, 1031]],
])
  test(`${name} cannot establish frame coverage`, () => {
    assert.equal(
      profile.analyzeFrameCoverage(
        timestamps.map((timestamp) => ({ timestamp })),
        { startedAtPerformanceMs: 1000, sampleMilliseconds: 30 },
      ).complete,
      false,
    );
  });

test("metric keeps strict p95 thresholds without fabricating missing observations", () => {
  const input = [0.5, 1, 2, 4];
  const before = copy(input);
  const result = profile.metric("main", input, 4);
  assert.equal(result.p95, 4);
  assert.equal(result.status, "FAIL");
  assert.equal(result.exceedanceCount, 1);
  assert.deepEqual(input, before);
  assert.equal(profile.metric("missing", [Number.NaN, undefined], 4).status, "NOT_RUN");
});

const fixtureSource = await readFile(
  new URL("../browser/performance-fixture.mjs", import.meta.url),
  "utf8",
);
const deliveryStartMarker = "// BEGIN_TESTABLE_NATIVE_DELIVERY";
const deliveryEndMarker = "// END_TESTABLE_NATIVE_DELIVERY";
const deliveryStart = fixtureSource.indexOf(deliveryStartMarker);
const deliveryEnd = fixtureSource.indexOf(deliveryEndMarker);
assert.ok(
  deliveryStart >= 0 && deliveryEnd > deliveryStart,
  "the actual delivery function has a bounded extraction region",
);
const deliverySource = fixtureSource
  .slice(deliveryStart + deliveryStartMarker.length, deliveryEnd)
  .trim()
  .replace(/^export\s+/, "");
// Execute the actual dependency-free function; importing its browser/TypeScript fixture would run DOM setup.
const measureNativeDelivery = new Function(`${deliverySource}; return measureNativeDelivery;`)();

function deliveryFixture(fault = null) {
  const requests = [{ requestId: "request.1", source: { id: "source.1" }, poseTick: 20 }];
  const solutions = [{ frame: { requestId: "request.1", sourceId: "source.1", poseTick: 20 } }];
  let time = 0;
  let consumed = false;
  const failure = new Error("controlled delivery fault");
  const service = {
    worker: {},
    pending: {
      id: 1,
      requests: [{ requestId: "request.1", sourceId: "source.1", poseTick: 20 }],
    },
    receive() {
      time += 2;
    },
    async solve() {
      if (fault === "solve") throw failure;
      if (fault === "pendingIdentity") this.pending.requests[0].requestId = "different.request";
      if (fault === "pendingSource") this.pending.requests[0].sourceId = "different.source";
      if (fault === "pendingPose") this.pending.requests[0].poseTick = 19;
      if (fault === "noReceive") return solutions;
      if (fault === "unrelatedBefore") {
        time = 50;
        this.receive(this.worker, { batchId: 0 });
      }
      time = 100;
      this.receive(fault === "port" ? {} : this.worker, { batchId: fault === "batch" ? 2 : 1 });
      time = fault === "clock" ? 99 : 104;
      if (fault === "nonfiniteClock") time = Number.NaN;
      if (fault === "solutionIdentity") solutions[0].frame.poseTick = 19;
      if (fault === "solutionRequest") solutions[0].frame.requestId = "different.request";
      if (fault === "solutionSource") solutions[0].frame.sourceId = "different.source";
      return solutions;
    },
  };
  const originalReceive = service.receive;
  const consume = () => {
    consumed = true;
    if (fault === "consumer") throw failure;
    if (fault === "asyncConsumer") return Promise.resolve();
    time += 3;
  };
  return {
    service,
    originalReceive,
    requests,
    solutions,
    failure,
    consume,
    consumed: () => consumed,
    now: () => time,
  };
}

test("observable delivery includes receive work, the await handoff and synchronous native consumers", async () => {
  const f = deliveryFixture();
  const result = await measureNativeDelivery(f.service, f.requests, f.consume, f.now);
  assert.equal(result.solutions, f.solutions);
  assert.equal(result.delivery.batchId, 1);
  assert.deepEqual(result.delivery.requestIdentities, [
    { requestId: "request.1", sourceId: "source.1", poseTick: 20 },
  ]);
  assert.equal(result.delivery.receiveEntryAtMs, 100);
  assert.equal(result.delivery.receiveExitAtMs, 102);
  assert.equal(result.delivery.awaitContinuationAtMs, 104);
  assert.equal(result.delivery.consumerFinishedAtMs, 107);
  assert.equal(result.delivery.durationMs, 7);
  assert.equal(f.service.receive, f.originalReceive);
});

for (const fault of ["solve", "consumer"])
  test(`a ${fault} failure restores the exact receive method and preserves the error`, async () => {
    const f = deliveryFixture(fault);
    await assert.rejects(
      measureNativeDelivery(f.service, f.requests, f.consume, f.now),
      (error) => error === f.failure,
    );
    assert.equal(f.service.receive, f.originalReceive);
  });

for (const fault of [
  "batch",
  "port",
  "pendingIdentity",
  "pendingSource",
  "pendingPose",
  "solutionIdentity",
  "solutionRequest",
  "solutionSource",
  "noReceive",
])
  test(`a ${fault} mismatch cannot become timing evidence for the requested native delivery`, async () => {
    const f = deliveryFixture(fault);
    await assert.rejects(measureNativeDelivery(f.service, f.requests, f.consume, f.now));
    assert.equal(f.consumed(), false);
    assert.equal(f.service.receive, f.originalReceive);
  });

for (const fault of ["clock", "nonfiniteClock", "asyncConsumer"])
  test(`invalid ${fault} timing is rejected and the receive seam is restored`, async () => {
    const f = deliveryFixture(fault);
    await assert.rejects(measureNativeDelivery(f.service, f.requests, f.consume, f.now));
    assert.equal(f.service.receive, f.originalReceive);
  });

test("an unrelated reply before the matching batch cannot move the delivery boundary", async () => {
  const f = deliveryFixture("unrelatedBefore");
  const result = await measureNativeDelivery(f.service, f.requests, f.consume, f.now);
  assert.equal(result.delivery.receiveEntryAtMs, 100);
  assert.equal(result.delivery.receiveExitAtMs, 102);
  assert.equal(result.delivery.durationMs, 7);
  assert.equal(f.service.receive, f.originalReceive);
});

function collectionWindow() {
  return {
    schemaVersion: "2.0.0",
    collectionId: "collection.boundary",
    beginPerformanceMs: 1000,
    endPerformanceMs: 1030,
  };
}

function collectionFrames() {
  return [
    { timestamp: 999, callbackObservedAtPerformanceMs: 1001, collectionId: "collection.boundary" },
    { timestamp: 1010, callbackObservedAtPerformanceMs: 1012, collectionId: "collection.boundary" },
  ];
}

function collectionOptions() {
  return {
    startedAtPerformanceMs: 1000,
    sampleMilliseconds: 30,
    collectionWindow: collectionWindow(),
  };
}

const v2MarkerIdentity = {
  beginName: "reflection-profile.begin.collection.boundary",
  endName: "reflection-profile.end.collection.boundary",
};

function traceCollectionOptions() {
  const options = collectionOptions();
  options.collectionWindow.beginMarkName = v2MarkerIdentity.beginName;
  options.collectionWindow.endMarkName = v2MarkerIdentity.endName;
  return options;
}

test("boundary-v2 proves a leading RAF belongs to the current callback collection", () => {
  const coverage = profile.analyzeFrameCoverage(collectionFrames(), collectionOptions());
  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.boundaries, [1000, 1010, 1030]);
  assert.equal(coverage.firstRafGapMs, -1);
  assert.deepEqual(coverage.rawLeadingOffsetsMs, [-1]);
  assert.equal(coverage.leadingCount, 1);
  assert.equal(coverage.rawFiniteAndStrictlyOrdered, true);
  assert.equal(coverage.membershipProofValid, true);
  assert.equal(coverage.measurementBoundaryVersion, "2.0.0");
});

test("boundary-v2 cannot fall back to legacy containment when its supplied schema is invalid", () => {
  const options = collectionOptions();
  options.collectionWindow.schemaVersion = "1.0.0";
  assert.equal(
    profile.analyzeFrameCoverage([{ timestamp: 1010 }, { timestamp: 1020 }], options).complete,
    false,
  );
});

test("boundary-v2 requires full callback proof even for contained frames and malformed supplied windows", () => {
  const contained = [{ timestamp: 1010 }, { timestamp: 1020 }];
  for (const window of [null, {}, collectionWindow()]) {
    const options = collectionOptions();
    options.collectionWindow = window;
    assert.equal(profile.analyzeFrameCoverage(contained, options).complete, false);
  }
});

for (const [name, mutate] of [
  [
    "missing collection window",
    (frames, options) => {
      delete options.collectionWindow;
    },
  ],
  [
    "unsupported collection schema",
    (frames, options) => {
      options.collectionWindow.schemaVersion = "1.0.0";
    },
  ],
  [
    "missing collection window ID",
    (frames, options) => {
      delete options.collectionWindow.collectionId;
    },
  ],
  [
    "a different collection window ID",
    (frames, options) => {
      options.collectionWindow.collectionId = "collection.foreign";
    },
  ],
  [
    "a collection window beginning outside the actual marker",
    (frames, options) => {
      options.collectionWindow.beginPerformanceMs = 999;
    },
  ],
  [
    "a collection window ending outside the actual marker",
    (frames, options) => {
      options.collectionWindow.endPerformanceMs = 1031;
    },
  ],
  [
    "a missing callback collection ID",
    (frames) => {
      delete frames[0].collectionId;
    },
  ],
  [
    "a callback from a different collection",
    (frames) => {
      frames[0].collectionId = "collection.foreign";
    },
  ],
  [
    "missing membership proof on an interior callback",
    (frames) => {
      delete frames[1].collectionId;
    },
  ],
  [
    "a callback observed before collection began",
    (frames) => {
      frames[0].callbackObservedAtPerformanceMs = 999.5;
    },
  ],
  [
    "a callback observed after collection ended",
    (frames) => {
      frames[1].callbackObservedAtPerformanceMs = 1031;
    },
  ],
  [
    "a native timestamp from after its callback observation",
    (frames) => {
      frames[1].callbackObservedAtPerformanceMs = 1009;
    },
  ],
  [
    "a trailing future native timestamp",
    (frames) => {
      frames[1].timestamp = 1031;
      frames[1].callbackObservedAtPerformanceMs = 1030;
    },
  ],
  [
    "duplicate raw leading timestamps",
    (frames) => {
      frames[1].timestamp = 999;
    },
  ],
  [
    "descending raw native timestamps",
    (frames) => {
      frames[1].timestamp = 998;
    },
  ],
  [
    "a nonfinite raw native timestamp",
    (frames) => {
      frames[0].timestamp = Number.NaN;
    },
  ],
  [
    "a nonfinite callback observation",
    (frames) => {
      frames[0].callbackObservedAtPerformanceMs = Number.NaN;
    },
  ],
])
  test(`boundary-v2 rejects ${name} as proof for an outside-leading RAF timestamp`, () => {
    const frames = collectionFrames(),
      options = collectionOptions();
    mutate(frames, options);
    assert.equal(profile.analyzeFrameCoverage(frames, options).complete, false);
  });

test("boundary-v2 keeps long cross-edge task occupancy and cannot turn a failed main-thread budget into PASS", async () => {
  await withCompressedTrace(
    [
      { ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 995000, dur: 25000 },
      { ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 1015000, dur: 20000 },
      { ph: "X", name: "RunTask", pid: 2, tid: 2, ts: 1000000, dur: 30000 },
    ],
    async (filename) => {
      const result = await profile.analyzeTrace(filename, {
        ...traceCollectionOptions(),
        frame: collectionFrames(),
      });
      assert.equal(result.coverage.complete, true);
      assert.deepEqual(result.rendererMainThreads, ["1:1"]);
      assert.equal(result.nativeTaskCount, 2);
      assert.deepEqual(result.mainTaskOccupancyMs, [10, 20]);
      assert.equal(
        result.mainTaskOccupancyMs.reduce((sum, value) => sum + value, 0),
        30,
      );
      assert.equal(profile.metric("cross-edge-main", result.mainTaskOccupancyMs, 4).status, "FAIL");
    },
    1030000,
    v2MarkerIdentity,
  );
});

test("boundary-v2 aligns two clock anchors while retaining native microsecond occupancy", async () => {
  await withCompressedTrace(
    [
      { ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 995000, dur: 27000 },
      { ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 1015000, dur: 20000 },
    ],
    async (filename) => {
      const result = await profile.analyzeTrace(filename, {
        ...traceCollectionOptions(),
        frame: collectionFrames(),
      });
      assert.equal(result.coverage.complete, true);
      assert.equal(result.mainTaskOccupancyMs.length, 2);
      assert.equal(
        result.mainTaskOccupancyMs.reduce((sum, value) => sum + value, 0),
        31,
      );
      assert.equal(result.coverage.clockCorrelation.beginAnchorOffsetMs, 0);
      assert.equal(result.coverage.clockCorrelation.endAnchorOffsetMs, 1);
      assert.equal(result.coverage.clockCorrelation.rawDurationDifferenceMs, 1);
      assert.ok(
        result.mainTaskOccupancyMs[0] > 10,
        "the interior RAF bin is mapped through both clock anchors",
      );
      assert.equal(profile.metric("two-clock-main", result.mainTaskOccupancyMs, 4).status, "FAIL");
    },
    1031000,
    v2MarkerIdentity,
  );
});

async function physicsMaintenanceFunction() {
  const source = await readFile(
    new URL("../browser/performance-fixture.mjs", import.meta.url),
    "utf8",
  );
  const beginMarker = "// BEGIN_TESTABLE_PHYSICS_MAINTENANCE";
  const endMarker = "// END_TESTABLE_PHYSICS_MAINTENANCE";
  const begin = source.indexOf(beginMarker),
    end = source.indexOf(endMarker);
  if (begin < 0 || end <= begin) return undefined;
  const body = source
    .slice(begin + beginMarker.length, end)
    .trim()
    .replace(/^export\s+/, "");
  return new Function(`${body}; return maintainPhysicsLoad;`)();
}

test("physics-maintenance exposes the bounded actual fixture maintenance function", async () => {
  assert.equal(typeof (await physicsMaintenanceFunction()), "function");
});

function maintenanceFixture() {
  const impulses = [],
    fixed = { wakes: 0 };
  const records = new Map();
  records.set("floor", {
    definition: { mode: "fixed" },
    body: {
      isFixed: () => true,
      isDynamic: () => false,
      isSleeping: () => false,
      wakeUp() {
        fixed.wakes++;
      },
    },
  });
  for (let i = 0; i < 255; i++) {
    const state = { sleeping: true, wakes: 0 };
    records.set(`stress.${i}`, {
      definition: { mode: "dynamicGravity" },
      state,
      body: {
        isDynamic: () => true,
        isFixed: () => false,
        isSleeping: () => state.sleeping,
        wakeUp() {
          state.sleeping = false;
          state.wakes++;
        },
      },
    });
  }
  let time = 0;
  return {
    world: {
      records,
      applyImpulse(id, vector) {
        impulses.push({ id, vector: [...vector] });
        records.get(id).state.sleeping = false;
      },
      world: {
        step() {
          throw new Error("maintenance must stay outside the native world.step bracket");
        },
      },
    },
    impulses,
    fixed,
    now: () => time++,
  };
}

test("physics-maintenance wakes all 255 sleeping bodies on a non-pulse step and leaves the fixed body untouched", async () => {
  const maintain = await physicsMaintenanceFunction(),
    f = maintenanceFixture();
  const result = maintain(f.world, 29, f.now);
  assert.equal(result.nativePreWakeSleepingBodies, 255);
  assert.equal(result.nativePostWakeSleepingBodies, 0);
  assert.equal(result.wakeCalls, 255);
  assert.equal(f.impulses.length, 0);
  assert.equal(f.fixed.wakes, 0);
  for (let i = 0; i < 255; i++) assert.equal(f.world.records.get(`stress.${i}`).state.wakes, 1);
  for (const field of ["wakeMaintenanceMs", "impulseMaintenanceMs", "totalSetupMs"])
    assert.ok(Number.isFinite(result[field]) && result[field] >= 0);
  assert.ok(result.totalSetupMs >= result.wakeMaintenanceMs);
});

test("physics-maintenance preserves the original pulse cadence and vectors at steps zero and thirty", async () => {
  const maintain = await physicsMaintenanceFunction(),
    zero = maintenanceFixture(),
    thirty = maintenanceFixture();
  const atZero = maintain(zero.world, 0, zero.now),
    atThirty = maintain(thirty.world, 30, thirty.now);
  assert.equal(zero.impulses.length, 255);
  assert.deepEqual(thirty.impulses, zero.impulses);
  assert.deepEqual(zero.impulses[0], { id: "stress.0", vector: [0, 0.04, 0.001] });
  for (let i = 0; i < 255; i++) {
    assert.equal(zero.impulses[i].id, `stress.${i}`);
    assert.equal(zero.impulses[i].vector[1], 0.04);
    assert.ok(Math.abs(zero.impulses[i].vector[0]) <= 0.001);
    assert.ok(Math.abs(zero.impulses[i].vector[2]) <= 0.001);
  }
  assert.equal(
    atZero.nativePreWakeSleepingBodies,
    0,
    "record the actual state after the unchanged native impulse block",
  );
  assert.equal(atThirty.nativePreWakeSleepingBodies, 0);
  assert.equal(atZero.wakeCalls, 255);
  assert.equal(atThirty.wakeCalls, 255);
  assert.equal(zero.fixed.wakes, 0);
  assert.equal(thirty.fixed.wakes, 0);
});

for (const [name, mutate] of [
  [
    "a missing dynamic record",
    (f) => {
      f.world.records.delete("stress.254");
    },
  ],
  [
    "an unexpected record replacing a known stress ID",
    (f) => {
      const record = f.world.records.get("stress.254");
      f.world.records.delete("stress.254");
      f.world.records.set("foreign", record);
    },
  ],
  [
    "a stress record authored as fixed",
    (f) => {
      f.world.records.get("stress.0").definition.mode = "fixed";
    },
  ],
  [
    "a native body that is not dynamic",
    (f) => {
      f.world.records.get("stress.0").body.isDynamic = () => false;
    },
  ],
  [
    "a missing wakeUp API",
    (f) => {
      delete f.world.records.get("stress.0").body.wakeUp;
    },
  ],
  [
    "a missing sleeping-state API",
    (f) => {
      delete f.world.records.get("stress.0").body.isSleeping;
    },
  ],
  [
    "a nonboolean native sleeping state",
    (f) => {
      f.world.records.get("stress.0").body.isSleeping = () => 1;
    },
  ],
  [
    "two stable IDs referring to one native body",
    (f) => {
      f.world.records.get("stress.1").body = f.world.records.get("stress.0").body;
    },
  ],
  [
    "a nonfixed extra body",
    (f) => {
      f.world.records.get("floor").body.isFixed = () => false;
    },
  ],
])
  test(`physics-maintenance rejects ${name} before applying any pulse`, async () => {
    const maintain = await physicsMaintenanceFunction(),
      f = maintenanceFixture();
    mutate(f);
    assert.throws(() => maintain(f.world, 0, f.now));
    assert.equal(f.impulses.length, 0);
    assert.equal(f.fixed.wakes, 0);
  });

test("physics-maintenance rejects a no-op native wake instead of fabricating awake telemetry", async () => {
  const maintain = await physicsMaintenanceFunction(),
    f = maintenanceFixture();
  f.world.records.get("stress.0").body.wakeUp = () => {};
  assert.throws(() => maintain(f.world, 29, f.now), /PHYSICS_WAKE_NOT_EFFECTIVE/);
  assert.equal(f.impulses.length, 0);
  assert.equal(f.fixed.wakes, 0);
});

test("boundary-v2 rejects foreign marker names even on the same renderer thread", async () => {
  await withCompressedTrace(
    [{ ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 1000000, dur: 30000 }],
    async (filename) => {
      const result = await profile.analyzeTrace(filename, {
        ...traceCollectionOptions(),
        frame: collectionFrames(),
      });
      assert.equal(result.coverage.complete, false);
      assert.deepEqual(result.mainTaskOccupancyMs, []);
    },
  );
});

test("boundary-v2 rejects an end marker from a different renderer thread", async () => {
  await withCompressedTrace(
    [{ ph: "X", name: "RunTask", pid: 1, tid: 1, ts: 1000000, dur: 30000 }],
    async (filename) => {
      const result = await profile.analyzeTrace(filename, {
        ...traceCollectionOptions(),
        frame: collectionFrames(),
      });
      assert.equal(result.coverage.complete, false);
      assert.deepEqual(result.mainTaskOccupancyMs, []);
    },
    1030000,
    { ...v2MarkerIdentity, endPid: 2, endTid: 2 },
  );
});

async function interpolationObserverFunction() {
  const source = await readFile(
    new URL("../browser/performance-fixture.mjs", import.meta.url),
    "utf8",
  );
  const beginMarker = "// BEGIN_TESTABLE_INTERPOLATION_OBSERVER";
  const endMarker = "// END_TESTABLE_INTERPOLATION_OBSERVER";
  const begin = source.indexOf(beginMarker),
    end = source.indexOf(endMarker);
  if (begin < 0 || end <= begin) return undefined;
  const body = source
    .slice(begin + beginMarker.length, end)
    .trim()
    .replace(/^export\s+/, "");
  return new Function(`${body}; return instrumentInterpolationMethods;`)();
}

test("interpolation-observer exposes the actual fast-method instrumentation helper", async () => {
  assert.equal(typeof (await interpolationObserverFunction()), "function");
});

test("interpolation-observer UI guard rejects legacy-only counts even when aggregate accounting is nonzero", () => {
  const data = uiFixture();
  data.interpolationObservation.byMethod.interpolatedTransforms = {
    calls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    ms: [],
  };
  data.interpolationObservation.byMethod.interpolatedPoses = {
    calls: 2,
    successfulCalls: 2,
    failedCalls: 0,
    ms: [0.2, 0.3],
  };
  assert.equal(accepted(profile.evaluateUIWorkload(data, uiOptions())), false);
});

test("interpolation-observer counts the fast route and preserves receiver, arguments and returned identities", async () => {
  const instrument = await interpolationObserverFunction();
  let time = 0,
    seen;
  const fastResult = {},
    legacyResult = {},
    receiver = { marker: "receiver" };
  const world = {
    interpolatedTransforms(...args) {
      seen = { receiver: this, args };
      time += 5;
      return fastResult;
    },
    interpolatedPoses() {
      time += 2;
      return legacyResult;
    },
  };
  const observation = instrument(
    world,
    () => time,
    () => true,
    (list, value) => list.push(value),
  );
  const argument = { alpha: 0.25 };
  assert.equal(world.interpolatedTransforms.call(receiver, argument, "extra", 7), fastResult);
  assert.equal(seen.receiver, receiver);
  assert.deepEqual(seen.args, [argument, "extra", 7]);
  assert.equal(seen.args[0], argument);
  assert.equal(observation.requiredMethod, "interpolatedTransforms");
  assert.deepEqual(observation.observedMethods, ["interpolatedTransforms", "interpolatedPoses"]);
  assert.deepEqual(observation.byMethod.interpolatedTransforms, {
    calls: 1,
    successfulCalls: 1,
    failedCalls: 0,
    ms: [5],
  });
  assert.deepEqual(observation.byMethod.interpolatedPoses, {
    calls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    ms: [],
  });
  assert.equal(world.interpolatedPoses(), legacyResult);
  assert.deepEqual(observation.byMethod.interpolatedPoses, {
    calls: 1,
    successfulCalls: 1,
    failedCalls: 0,
    ms: [2],
  });
  assert.equal(observation.calls, 2);
  assert.equal(observation.successfulCalls, 2);
  assert.equal(observation.failedCalls, 0);
  assert.deepEqual(observation.ms, [5, 2]);
});

test("interpolation-observer rejects a missing or nonfunction fast route before mutating the legacy route", async () => {
  const instrument = await interpolationObserverFunction();
  for (const fast of [undefined, 42]) {
    const originalLegacy = () => [];
    const world = { interpolatedTransforms: fast, interpolatedPoses: originalLegacy };
    assert.throws(() =>
      instrument(
        world,
        () => 0,
        () => true,
        (list, value) => list.push(value),
      ),
    );
    assert.equal(world.interpolatedTransforms, fast);
    assert.equal(world.interpolatedPoses, originalLegacy);
  }
});

test("interpolation-observer delegates without accounting while measurement is disabled", async () => {
  const instrument = await interpolationObserverFunction();
  let measuring = false,
    time = 0,
    delegated = 0;
  const result = {};
  const world = {
    interpolatedTransforms() {
      delegated++;
      time += 5;
      return result;
    },
    interpolatedPoses() {},
  };
  const observation = instrument(
    world,
    () => time,
    () => measuring,
    (list, value) => list.push(value),
  );
  assert.equal(world.interpolatedTransforms(), result);
  assert.equal(delegated, 1);
  assert.equal(observation.calls, 0);
  assert.deepEqual(observation.ms, []);
  assert.equal(observation.byMethod.interpolatedTransforms.calls, 0);
  measuring = true;
  assert.equal(world.interpolatedTransforms(), result);
  assert.equal(delegated, 2);
  assert.equal(observation.calls, 1);
  assert.deepEqual(observation.ms, [5]);
});

test("interpolation-observer records inclusive nested methods but only one outer aggregate interval", async () => {
  const instrument = await interpolationObserverFunction();
  let time = 0;
  const result = {};
  const world = {
    interpolatedTransforms() {
      time = 5;
      return result;
    },
    interpolatedPoses() {
      time = 2;
      const value = this.interpolatedTransforms();
      time = 7;
      return value;
    },
  };
  const observation = instrument(
    world,
    () => time,
    () => true,
    (list, value) => list.push(value),
  );
  assert.equal(world.interpolatedPoses(), result);
  assert.deepEqual(observation.byMethod.interpolatedTransforms, {
    calls: 1,
    successfulCalls: 1,
    failedCalls: 0,
    ms: [3],
  });
  assert.deepEqual(observation.byMethod.interpolatedPoses, {
    calls: 1,
    successfulCalls: 1,
    failedCalls: 0,
    ms: [7],
  });
  assert.equal(observation.calls, 1);
  assert.deepEqual(observation.ms, [7]);
});

test("interpolation-observer preserves nested errors and restores depth for the next successful fast call", async () => {
  const instrument = await interpolationObserverFunction();
  let time = 0,
    fail = true;
  const failure = new Error("original interpolation failure"),
    result = {};
  const world = {
    interpolatedTransforms() {
      time += 3;
      if (fail) throw failure;
      return result;
    },
    interpolatedPoses() {
      time += 2;
      return this.interpolatedTransforms();
    },
  };
  const observation = instrument(
    world,
    () => time,
    () => true,
    (list, value) => list.push(value),
  );
  assert.throws(
    () => world.interpolatedPoses(),
    (error) => error === failure,
  );
  assert.equal(observation.calls, 1);
  assert.equal(observation.failedCalls, 1);
  assert.equal(observation.successfulCalls, 0);
  fail = false;
  assert.equal(world.interpolatedTransforms(), result);
  assert.equal(observation.calls, 2);
  assert.equal(observation.failedCalls, 1);
  assert.equal(observation.successfulCalls, 1);
  assert.deepEqual(observation.ms, [5, 3]);
  assert.deepEqual(observation.byMethod.interpolatedTransforms, {
    calls: 2,
    successfulCalls: 1,
    failedCalls: 1,
    ms: [3, 3],
  });
  assert.deepEqual(observation.byMethod.interpolatedPoses, {
    calls: 1,
    successfulCalls: 0,
    failedCalls: 1,
    ms: [5],
  });
});

test("interpolation-observer UI guard rejects missing, failed or inconsistent fast-method accounting", () => {
  const failures = [];
  for (const [name, mutate] of [
    [
      "missing metadata",
      (data) => {
        delete data.interpolationObservation;
      },
    ],
    [
      "wrong required method",
      (data) => {
        data.interpolationObservation.requiredMethod = "interpolatedPoses";
      },
    ],
    [
      "fast route unobserved",
      (data) => {
        data.interpolationObservation.observedMethods = ["interpolatedPoses"];
      },
    ],
    [
      "no fast success",
      (data) => {
        data.interpolationObservation.byMethod.interpolatedTransforms.successfulCalls = 0;
      },
    ],
    [
      "fast failure",
      (data) => {
        data.interpolationObservation.byMethod.interpolatedTransforms.failedCalls = 1;
      },
    ],
    [
      "aggregate failure",
      (data) => {
        data.interpolationObservation.failedCalls = 1;
      },
    ],
    [
      "call count mismatch",
      (data) => {
        data.interpolationCalls = 3;
      },
    ],
    [
      "sample count mismatch",
      (data) => {
        data.interpolationMs.pop();
      },
    ],
    [
      "empty aggregate cannot support nonzero fast evidence",
      (data) => {
        data.interpolationCalls = 0;
        data.interpolationMs = [];
        data.interpolationObservation.calls = 0;
        data.interpolationObservation.successfulCalls = 0;
      },
    ],
  ]) {
    const data = uiFixture();
    mutate(data);
    if (accepted(profile.evaluateUIWorkload(data, uiOptions()))) failures.push(name);
  }
  assert.deepEqual(failures, []);
});

test("interpolation-observer accepts successful zero-ms timing under clock quantization", async () => {
  const instrument = await interpolationObserverFunction();
  const result = {},
    world = {
      interpolatedTransforms() {
        return result;
      },
      interpolatedPoses() {},
    };
  const observation = instrument(
    world,
    () => 0,
    () => true,
    (list, value) => list.push(value),
  );
  assert.equal(world.interpolatedTransforms(), result);
  assert.deepEqual(observation.ms, [0]);
  const data = uiFixture();
  data.interpolationCalls = observation.calls;
  data.interpolationMs = observation.ms;
  const { ms, ...metadata } = observation;
  assert.deepEqual(ms, [0]);
  data.interpolationObservation = metadata;
  assert.equal(accepted(profile.evaluateUIWorkload(data, uiOptions())), true);
});
