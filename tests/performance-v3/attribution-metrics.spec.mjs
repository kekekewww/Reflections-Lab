import test from "node:test";
import assert from "node:assert/strict";
import { metric } from "../browser/performance-attribution-metrics-v1.mjs";

test("a partially unobserved delivery distribution cannot become PASS by filtering null", () => {
  const result = metric("delivery", [0.2, null, 0.3], 1);
  assert.equal(result.count, 2);
  assert.equal(result.p95, 0.3);
  assert.equal(result.status, "UNVERIFIED");
  assert.equal(result.requestedCount, 3);
  assert.equal(result.unobservedCount, 1);
});

test("measured threshold failure survives alongside an unobserved sample", () => {
  const result = metric("delivery", [0.2, undefined, 1.1], 1);
  assert.equal(result.status, "FAIL");
  assert.equal(result.unobservedCount, 1);
});

test("all unobserved values preserve null quantiles and unavailable threshold evidence", () => {
  const result = metric("delivery", [null, undefined, Number.NaN], 1);
  assert.equal(result.status, "NOT_RUN");
  assert.equal(result.p50, null);
  assert.equal(result.p95, null);
  assert.equal(result.p99, null);
  assert.equal(result.max, null);
  assert.equal(result.unobservedCount, 3);
  assert.equal(result.exceedanceCount, null);
});

test("a fully measured zero distribution still passes the unchanged strict budget", () => {
  const result = metric("delivery", [0, 0], 1);
  assert.equal(result.status, "PASS");
  assert.equal(result.count, 2);
  assert.equal(result.p95, 0);
  assert.equal(result.unobservedCount, 0);
});

// Independent control-receipt acceptance. Literal fixtures are synthetic schema
// examples, never browser/solver/PCM measurements or evidence of physical sound.
const controlModuleUrl = new URL("../browser/performance-audio-controls-v1.mjs", import.meta.url);
const controlModule = await import(controlModuleUrl.href).catch((error) => {
  if (
    error.code === "ERR_MODULE_NOT_FOUND" &&
    String(error.message).includes("performance-audio-controls-v1.mjs")
  )
    return {};
  throw error;
});
const hasControlVerifier = () => typeof controlModule.verifyControlledAudioCase === "function";
const originalBudget = Object.freeze({
  maxVoices: 24,
  maxSources: 32,
  maxSourceFrames: 64,
  maxPathsPerVoice: 8,
  maxTotalPaths: 96,
  maxDecodedBytes: 67108864,
  maxAssetDurationSeconds: 120,
  maxAssetChannels: 2,
  maxPendingEvents: 256,
  maxAssets: 64,
  maxConcurrentDecodes: 2,
  maxLateSends: 16,
  maxLateReverbBytes: 4194304,
});
const cloneControl = (value) => structuredClone(value);
function literalDiagnostics() {
  return {
    enabled: true,
    model: "CONTROL_THREAD_OBSERVATIONS",
    sampleCapacity: 128,
    onsets: { count: 0, lateCount: 0, lateThresholdMs: 1 },
    frameDecisions: {
      accepted: 0,
      stale: 0,
      unavailable: 0,
      "source-budget": 0,
      "restart-blocked": 0,
      invalid: 0,
      error: 0,
    },
    admissions: { droppedVoices: 0, droppedPaths: 0, staleVoiceAdmissions: 0 },
    delivery: { status: "NOT_OBSERVED", totalBatches: 0, totalFrames: 0 },
    nativeOutput: { status: "UNSUPPORTED", deltaUnderrunEvents: null, deltaUnderrunSeconds: null },
    unmeasured: {
      pcmGapSeconds: null,
      nativeDspCpuMs: null,
      nativeMemoryBytes: null,
      calibratedSpl: null,
    },
  };
}
function literalDirect() {
  return {
    id: "probe.direct",
    sourceId: "probe.source",
    listenerId: "listener",
    surfaceIds: [],
    order: 0,
    verticesM: [
      [0, 0, -1],
      [0, 0, 0],
    ],
    lengthM: 1,
    absoluteDelayS: 1 / 343,
    relativeDelayS: 0,
    arrivalDirection: [0, 0, -1],
    bandGains: [1, 1, 1, 1, 1, 1, 1],
  };
}
function literalSolution(tick, reflectionCount = 0) {
  const paths = [literalDirect()];
  for (let index = 0; index < reflectionCount; index++)
    paths.push({
      id: `probe.reflection.${index}`,
      sourceId: "probe.source",
      listenerId: "listener",
      surfaceIds: [reflectionCount === 1 ? "probe.wall" : `probe.room.${index}`],
      order: 1,
      verticesM: [
        [0, 0, -1],
        [1.5, 0, -0.5],
        [0, 0, 0],
      ],
      lengthM: Math.sqrt(10),
      absoluteDelayS: Math.sqrt(10) / 343,
      relativeDelayS: (Math.sqrt(10) - 1) / 343,
      arrivalDirection: [3 / Math.sqrt(10), 0, -1 / Math.sqrt(10)],
      bandGains: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
    });
  return {
    frame: {
      schemaVersion: "1.0.0",
      requestId: `pcm-probe.probe.source.${tick}`,
      sceneRevision: 0,
      geometryRevision: tick,
      poseTick: tick,
      backendId: "custom-web-geometric",
      backendVersion: "web-geometric-1.0.0",
      sourceId: "probe.source",
      listenerId: "listener",
      bandCentersHz: [125, 250, 500, 1000, 2000, 4000, 8000],
      gainQuantity: "pressureRatio",
      capabilities: ["directParameters", "individualReflectionPaths", "dynamicOccluders"],
      modelClass: "numericalApproximation",
      directDelayS: 1 / 343,
      paths,
      pathAvailability: "available",
      impulseResponseArtifactId: null,
      stale: false,
      limitations: ["Synthetic literal test receipt"],
    },
    diagnostics: {
      directOccluded: false,
      blockedBySurfaceIds: [],
      evaluatedReflectionCandidates: reflectionCount,
      segmentTests: reflectionCount * 2,
      budgetExceeded: false,
      rejectedReflectionCount: 0,
      droppedPathCount: 0,
      speedOfSoundMps: 343,
      speedModel: "explicit",
      materialDiffuseEnergyExcluded: true,
    },
    metrics: {
      rt60Seconds: null,
      drrDb: null,
      c50Db: null,
      reason: "Synthetic literal, no room measurement",
    },
  };
}
function timerAction(label, result = null, { audio = 2.62, wall = 2620, duration = 0.25 } = {}) {
  return {
    label,
    wallMs: wall + duration,
    audioSeconds: audio + duration / 1000,
    scheduledAudioSeconds: audio,
    scheduledAtWallMs: 100,
    scheduledAtAudioSeconds: 0.1,
    requestedWallDeadlineMs: wall,
    handlerEnteredWallMs: wall,
    handlerEnteredAudioSeconds: audio,
    timerDispatchRelativeToRequestedWallDeadlineMs: 0,
    audioDeadlineDeltaMs: 0,
    operationStartedWallMs: wall,
    operationFinishedWallMs: wall + duration,
    synchronousOperationWallDurationMs: duration,
    scope: "Timer dispatch and synchronous operation wall duration; not native DSP CPU",
    result,
  };
}
function literalControlCase(caseId = "steady", probeMode = "on", audioModel = "nativeReference") {
  const telemetry = {
    enabled: true,
    muted: false,
    paused: false,
    contextState: "running",
    sampleRate: 48000,
    activeVoices: 0,
    activeSources: 0,
    activePaths: 0,
    lateEvents: 0,
    staleFrames: 0,
    droppedVoices: 0,
    droppedPaths: 0,
    stolenVoices: 0,
    lastError: null,
    budget: { ...originalBudget },
  };
  const data = {
    schemaVersion: "1.0.0",
    method: "controlled-native-audio-pcm-v1",
    caseId,
    probeMode,
    audioModel,
    status: probeMode === "on" ? "CAPTURED_DIGITAL_ONLY" : "PROBE_OFF_COMPLETED",
    actions: [
      { label: "primary-voice", wallMs: 100, audioSeconds: 0.1, admission: { accepted: true } },
    ],
    telemetry: [],
    formalPerformance: "NOT_RUN",
    hardwareHearing: "NOT_RUN",
    nativeDspCpuMs: null,
    hardwareBufferFrames: null,
    physicalRoute: null,
    contextClosed: true,
    cleanupErrors: [],
    sourceConfiguration: {
      oscillatorModel: audioModel,
      virtualization: false,
      referenceBudgetSource:
        "original-audio-budget.json at productBase e25f9f4; actual before/after budget retained",
    },
    audioCapabilities: {
      sampleRate: 48000,
      contextState: "running",
      browserReportedRenderQuantumFrames: null,
      actualPhysicalDeviceRoute: null,
    },
    timeline: {
      epochFrame: 48000,
      epochSeconds: 1,
      schedulingLookaheadSeconds: 0.12,
      expectedPrimaryOnsetAudioSeconds: 1.12,
      startFrame: 77760,
      endFrame: 221760,
      frameCount: 144000,
      sampleRate: 48000,
      channelCount: 2,
    },
    outputAdapter: {
      scope: "SAME_AUDIOENGINE_POST_MASTER_SIGNAL",
      selectedNode: "safetyClip",
      unityControlPresentInBothModes: true,
    },
    solverInput: {
      requestId: "pcm-probe.probe.source.0",
      sceneRevision: 0,
      geometryRevision: 0,
      poseTick: 0,
      source: { id: "probe.source", positionM: [0, 0, -1] },
      listener: { id: "listener", positionM: [0, 0, 0] },
      topologyId: "performance-pcm-controlled-v1",
      surfaces: [],
      materials: [
        {
          schemaVersion: "1.0.0",
          id: "material.hard",
          revision: 1,
          label: "Synthetic literal hard surface",
          dataClass: "Synthetic",
          sourceUrls: [],
          conditions: "Literal control fixture, not measured material",
          phaseModel: "zeroPhaseMagnitudeOnly",
          bands: [125, 250, 500, 1000, 2000, 4000, 8000].map((centerHz, index) => ({
            centerHz,
            absorptionEnergy: [0.03, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08][index],
            reflectionEnergy: 1 - [0.03, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08][index],
            transmissionEnergy: 0,
            scatteringFraction: 0.1,
          })),
        },
      ],
      atmosphere: { medium: "air", speedOfSoundMps: 343, dataClass: "Synthetic" },
      budget: { maxSurfaces: 32, maxPaths: 8, maxSegmentTests: 16384 },
    },
    solver: literalSolution(0),
    primaryStartStillFutureAtReturn: true,
    beforeTelemetry: cloneControl(telemetry),
    afterTelemetry: {
      ...cloneControl(telemetry),
      activeVoices: 1,
      activeSources: 1,
      activePaths: 1,
    },
    beforeDiagnostics: probeMode === "on" ? literalDiagnostics() : null,
    afterDiagnostics: probeMode === "on" ? literalDiagnostics() : null,
    windowWaitStartedWallMs: 100,
    windowWaitEndedWallMs: 4621,
    actualContextTimeAtEndSeconds: 4.621,
    capture: { status: probeMode === "on" ? "COMPLETE" : "NOT_OBSERVED_PROBE_OFF" },
    nativeResourceSnapshot: null,
  };
  if (probeMode === "on") data.afterDiagnostics.onsets.count = 1;
  if (caseId === "main-stall")
    data.actions.push(
      timerAction(
        "main-stall-150ms",
        {
          before: { wallMs: 2620, audioSeconds: 2.62 },
          after: { wallMs: 2770.25, audioSeconds: 2.77025 },
        },
        { duration: 150.25 },
      ),
    );
  if (caseId === "late-onset") {
    data.actions.push(timerAction("backdated-real-emission", { accepted: true }));
    data.afterTelemetry.lateEvents = 1;
    if (probeMode === "on") {
      data.afterDiagnostics.onsets.count = 2;
      data.afterDiagnostics.onsets.lateCount = 1;
    }
  }
  if (caseId === "stale-frame") {
    data.actions.push(timerAction("real-audio-consumer-stale-refusal"));
    data.afterTelemetry.staleFrames = 1;
    if (probeMode === "on") data.afterDiagnostics.frameDecisions.stale = 1;
  }
  if (caseId === "path-churn") {
    data.actions.push(
      timerAction("solver-path-birth"),
      timerAction("solver-path-death", null, { audio: 3.12, wall: 3120 }),
    );
    data.birthSolution = literalSolution(1, 1);
    data.deathSolution = literalSolution(2);
  }
  if (caseId === "voice-path-budget") {
    const admissions = Array.from({ length: 36 }, (_, index) => ({
      accepted: audioModel === "nativeCarrierRoutes" || index < 23,
      ...(audioModel === "nativeCarrierRoutes" || index < 23 ? {} : { reason: "VOICE_BUDGET" }),
    }));
    data.actions.push(timerAction("original-voice-and-path-budget-pressure", admissions));
    data.pressureSolution = literalSolution(1, 31);
    data.afterTelemetry.droppedPaths = 24;
    data.afterTelemetry.droppedVoices = audioModel === "nativeCarrierRoutes" ? 0 : 13;
    if (probeMode === "on") {
      data.afterDiagnostics.admissions.droppedPaths = 24;
      data.afterDiagnostics.admissions.droppedVoices = data.afterTelemetry.droppedVoices;
    }
  }
  if (caseId === "digital-gap")
    data.injectedGap = {
      kind: "INTENTIONAL_POST_MASTER_DIGITAL_SILENCE_NOT_A_PRODUCT_UNDERRUN",
      startFrame: 125760,
      endFrame: 130560,
    };
  if (audioModel === "nativeCarrierRoutes") {
    const policy = {
      maxNativeVoices: 24,
      maxNativeGraphs: 48,
      maxVirtualVoices: 32,
      minResidenceSeconds: 0.2,
      priorityHysteresis: 0.1,
      fairnessSeconds: 1,
    };
    data.sourceConfiguration.virtualization = policy;
    data.sourceConfiguration.capacityContract = { status: "PROPOSED_NOT_FROZEN" };
    for (const endpoint of [data.beforeTelemetry, data.afterTelemetry])
      Object.assign(endpoint, {
        activeRenderedCap: 24,
        nativeGraphBudget: null,
        nativeCarrierBudget: null,
        virtualization: { enabled: true, policy: cloneControl(policy) },
      });
    data.nativeResourceSnapshot = {
      mode: "nativeCarrierRoutes",
      activeRenderedCap: 24,
      nativeGraphBudget: null,
      nativeCarrierBudget: null,
      nativeSourceNodes: 1,
      carrierCpuSeconds: null,
      sources: [
        {
          instanceId: "probe.primary",
          sourceId: "probe.source",
          allocationSequence: 1,
          kind: "content",
          generatorKind: "oscillator",
          role: "rendered",
          pending: false,
          startedAudioTime: 1.12,
          sourceEndAudioTime: null,
        },
      ],
    };
  }
  return data;
}
const runControlCheck = (data) => controlModule.verifyControlledAudioCase(data);
function acceptedControl(data) {
  const result = runControlCheck(data);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.deepEqual(result.reasons, []);
}
function rejectedControl(data) {
  let result;
  assert.doesNotThrow(() => {
    result = runControlCheck(data);
  });
  assert.equal(result.qualified, false);
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
}

test("controlled audio exposes source/control verification independent of collection status and PCM", () => {
  assert.equal(typeof controlModule.verifyControlledAudioCase, "function");
});
for (const caseId of [
  "steady",
  "main-stall",
  "late-onset",
  "stale-frame",
  "path-churn",
  "voice-path-budget",
  "digital-gap",
]) {
  for (const mode of ["on", "off"])
    test(`controlled ${caseId}/${mode} validates its actual action and endpoint matrix`, () => {
      if (!hasControlVerifier()) return;
      acceptedControl(literalControlCase(caseId, mode));
    });
}
test("unfrozen carrier capacity remains unverified without inventing a requirement for logical voice drops", () => {
  if (!hasControlVerifier()) return;
  const data = literalControlCase("voice-path-budget", "on", "nativeCarrierRoutes");
  assert.equal(data.actions[1].result.length, 36);
  assert.equal(
    data.actions[1].result.every((row) => row.accepted),
    true,
  );
  assert.equal(data.afterTelemetry.droppedVoices, 0);
  const result = runControlCheck(data);
  assert.equal(result.qualified, false);
  assert.ok(result.reasons.some((reason) => /capacity|frozen|unsupported/i.test(reason)));
});
test("PCM failure remains separate from successfully verified source/control", () => {
  if (!hasControlVerifier()) return;
  const data = literalControlCase("stale-frame");
  data.capture.status = "INVALID";
  data.status = "FAILED";
  acceptedControl(data);
});

const controlFailures = {
  "unexecuted main stall": (d) => {
    d.caseId = "main-stall";
  },
  "unexecuted late event": (d) => {
    d.caseId = "late-onset";
  },
  "unexecuted stale update": (d) => {
    d.caseId = "stale-frame";
  },
  "unexecuted path update": (d) => {
    d.caseId = "path-churn";
  },
  "unexecuted budget pressure": (d) => {
    d.caseId = "voice-path-budget";
  },
  "missing primary admission": (d) => {
    d.actions = [];
  },
  "primary rejected": (d) => {
    d.actions[0].admission.accepted = false;
  },
  "primary scheduled in past": (d) => {
    d.primaryStartStillFutureAtReturn = false;
  },
  "control operation threw": (d) => {
    d.controlError = "actual timer callback failed";
  },
  "cleanup threw": (d) => {
    d.cleanupErrors.push({ label: "engine", error: "dispose failed" });
  },
  "context not closed": (d) => {
    d.contextClosed = false;
  },
  "context close unknown": (d) => {
    d.contextClosed = null;
  },
  "context closed with rejection": (d) => {
    d.cleanupError = "CONTEXT_CLOSE_TIMEOUT";
  },
  "context had not reached audio end": (d) => {
    d.actualContextTimeAtEndSeconds = 4;
  },
  "telemetry overflow": (d) => {
    d.telemetryOverflow = true;
  },
  "unknown case": (d) => {
    d.caseId = "not-a-fixed-case";
  },
  "unknown source model": (d) => {
    d.audioModel = "advertised-fast-model";
  },
  "source model label differs": (d) => {
    d.sourceConfiguration.oscillatorModel = "nativeCarrierRoutes";
  },
  "unknown probe mode": (d) => {
    d.probeMode = "mixed";
  },
  "reference silently enables virtualization": (d) => {
    d.sourceConfiguration.virtualization = { maxNativeVoices: 24 };
  },
  "reduced original voice budget": (d) => {
    d.beforeTelemetry.budget.maxVoices = 16;
    d.afterTelemetry.budget.maxVoices = 16;
  },
  "raised original path budget": (d) => {
    d.beforeTelemetry.budget.maxPathsPerVoice = 32;
    d.afterTelemetry.budget.maxPathsPerVoice = 32;
  },
  "source-frame cap changed": (d) => {
    d.afterTelemetry.budget.maxSourceFrames = 128;
  },
  "source budget unavailable": (d) => {
    d.afterTelemetry.budget = null;
  },
  "extra unknown original budget": (d) => {
    d.beforeTelemetry.budget.hiddenCap = 1;
    d.afterTelemetry.budget.hiddenCap = 1;
  },
  "source became muted": (d) => {
    d.afterTelemetry.muted = true;
  },
  "source context stopped": (d) => {
    d.afterTelemetry.contextState = "suspended";
  },
  "unsupported DSP CPU invented as zero": (d) => {
    d.nativeDspCpuMs = 0;
  },
  "unsupported hardware quantum invented as 128": (d) => {
    d.hardwareBufferFrames = 128;
  },
  "required on diagnostics missing": (d) => {
    d.afterDiagnostics = null;
  },
  "late counter moved backwards": (d) => {
    d.beforeDiagnostics.onsets.lateCount = 2;
    d.afterDiagnostics.onsets.lateCount = 1;
  },
  "foreign solver source": (d) => {
    d.solver.frame.sourceId = "another-source";
  },
  "solver result unavailable": (d) => {
    d.solver.frame.pathAvailability = "failed";
  },
  "invented path rather than finite solver evidence": (d) => {
    d.solver.frame.paths[0].lengthM = Number.NaN;
  },
  "hidden additional intervention": (d) => {
    d.actions.push(timerAction("unplanned-extra-stall"));
  },
};
for (const [label, mutate] of Object.entries(controlFailures))
  test(`control verification rejects ${label}`, () => {
    if (!hasControlVerifier()) return;
    const data = literalControlCase();
    mutate(data);
    rejectedControl(data);
  });
for (const [label, make, mutate] of [
  [
    "stall only advertised 150ms but executed zero",
    () => literalControlCase("main-stall"),
    (d) => {
      d.actions[1].result.after.wallMs = d.actions[1].result.before.wallMs;
    },
  ],
  [
    "stall shorter than bounded intervention",
    () => literalControlCase("main-stall"),
    (d) => {
      d.actions[1].result.after.wallMs = d.actions[1].result.before.wallMs + 149;
    },
  ],
  [
    "late action without actual late onset",
    () => literalControlCase("late-onset"),
    (d) => {
      d.afterTelemetry.lateEvents = 0;
      d.afterDiagnostics.onsets.lateCount = 0;
    },
  ],
  [
    "late event rejected",
    () => literalControlCase("late-onset"),
    (d) => {
      d.actions[1].result.accepted = false;
    },
  ],
  [
    "stale action without consumer refusal",
    () => literalControlCase("stale-frame"),
    (d) => {
      d.afterTelemetry.staleFrames = 0;
      d.afterDiagnostics.frameDecisions.stale = 0;
    },
  ],
  [
    "on stale diagnostics disagree with native endpoint",
    () => literalControlCase("stale-frame"),
    (d) => {
      d.afterDiagnostics.frameDecisions.stale = 0;
    },
  ],
  [
    "path birth did not add a reflection",
    () => literalControlCase("path-churn"),
    (d) => {
      d.birthSolution.frame.paths = [literalDirect()];
    },
  ],
  [
    "path death did not remove reflection",
    () => literalControlCase("path-churn"),
    (d) => {
      d.deathSolution.frame.paths = cloneControl(d.birthSolution.frame.paths);
    },
  ],
  [
    "path update changed source",
    () => literalControlCase("path-churn"),
    (d) => {
      d.birthSolution.frame.sourceId = "foreign-source";
    },
  ],
  [
    "path update changed direct identity",
    () => literalControlCase("path-churn"),
    (d) => {
      d.deathSolution.frame.paths[0].id = "replacement-direct";
    },
  ],
  [
    "missing death action",
    () => literalControlCase("path-churn"),
    (d) => {
      d.actions.pop();
    },
  ],
  [
    "budget only attempted 35 admissions",
    () => literalControlCase("voice-path-budget"),
    (d) => {
      d.actions[1].result.pop();
    },
  ],
  [
    "reference had no voice rejection",
    () => literalControlCase("voice-path-budget"),
    (d) => {
      d.actions[1].result = d.actions[1].result.map(() => ({ accepted: true }));
      d.afterTelemetry.droppedVoices = 0;
      d.afterDiagnostics.admissions.droppedVoices = 0;
    },
  ],
  [
    "no actual path pressure",
    () => literalControlCase("voice-path-budget"),
    (d) => {
      d.afterTelemetry.droppedPaths = 0;
      d.afterDiagnostics.admissions.droppedPaths = 0;
    },
  ],
  [
    "solver pressure had only direct path",
    () => literalControlCase("voice-path-budget"),
    (d) => {
      d.pressureSolution.frame.paths = [literalDirect()];
    },
  ],
  [
    "off cannot substitute zero diagnostics",
    () => literalControlCase("steady", "off"),
    (d) => {
      d.afterDiagnostics = literalDiagnostics();
    },
  ],
  [
    "off misses stale consumer outcome",
    () => literalControlCase("stale-frame", "off"),
    (d) => {
      d.afterTelemetry.staleFrames = 0;
    },
  ],
  [
    "off introduces repeated polling",
    () => literalControlCase("steady", "off"),
    (d) => {
      d.telemetry.push({ diagnostics: literalDiagnostics() });
    },
  ],
  [
    "injected gap outside capture",
    () => literalControlCase("digital-gap"),
    (d) => {
      d.injectedGap.startFrame = d.timeline.endFrame + 1;
      d.injectedGap.endFrame = d.timeline.endFrame + 4801;
    },
  ],
  [
    "injected gap not the declared 100ms",
    () => literalControlCase("digital-gap"),
    (d) => {
      d.injectedGap.endFrame = d.injectedGap.startFrame + 1;
    },
  ],
])
  test(`control verification rejects ${label}`, () => {
    if (!hasControlVerifier()) return;
    const data = make();
    mutate(data);
    rejectedControl(data);
  });
for (const [label, data] of [
  ["null receipt", null],
  ["array receipt", []],
])
  test(`control verification contains ${label}`, () => {
    if (!hasControlVerifier()) return;
    rejectedControl(data);
  });

// Whole-case ABBA cost is a descriptive component observation, never callback CPU
// or the fixed formal performance gate. No derived comparison may erase missing data.
const hasOverheadSummary = () =>
  typeof controlModule.summarizeControlledAudioOverhead === "function";
function overheadSamples(caseId = "steady", audioModel = "nativeReference") {
  return [
    ["on", 6000, 1],
    ["off", 5500, 0.5],
    ["off", 5700, 1],
    ["on", 6200, 1.5],
  ].map(([probeMode, wholeCaseWallMs, cpuSeconds], index) => ({
    tag: `${caseId}-${audioModel}-${index + 1}-${probeMode}`,
    caseId,
    probeMode,
    audioModel,
    wholeCaseWallMs,
    cpu: {
      status: "OBSERVED",
      completeCoverage: true,
      totalMatchedProcessCpuSeconds: cpuSeconds,
      processes: [{ id: 17, type: "renderer", deltaCpuSeconds: cpuSeconds, status: "OBSERVED" }],
    },
    data: literalControlCase(caseId, probeMode, audioModel),
    controlVerification: {
      qualified: true,
      reasons: [],
      status: "ADVERTISED_ONLY_MUST_BE_RECHECKED",
    },
  }));
}
function oneOverheadGroup(samples) {
  const summary = controlModule.summarizeControlledAudioOverhead(samples);
  assert.equal(summary.scope, "WHOLE_CASE_DESCRIPTIVE_ONLY");
  assert.equal(summary.formalQualification, "NOT_APPROVED");
  assert.equal(summary.nativeDspCpuMs, null);
  assert.notEqual(summary.status, "PASS");
  assert.equal(summary.groups.length, 1);
  assert.notEqual(summary.groups[0].status, "PASS");
  return summary.groups[0];
}
function nonComparable(samples) {
  const group = oneOverheadGroup(samples);
  assert.equal(group.comparable, false);
  assert.ok(Array.isArray(group.reasons) && group.reasons.length > 0);
  assert.equal(group.wall.deltaOnMinusOffMs, null);
  assert.equal(group.cpu.deltaOnMinusOffSeconds, null);
}

test("controlled overhead exposes a same-condition ABBA summary instead of a performance PASS", () => {
  assert.equal(typeof controlModule.summarizeControlledAudioOverhead, "function");
});
test("ABBA reports the two raw observations per mode and exact descriptive whole-case mean differences", () => {
  if (!hasOverheadSummary()) return;
  const group = oneOverheadGroup(overheadSamples());
  assert.equal(group.caseId, "steady");
  assert.equal(group.audioModel, "nativeReference");
  assert.equal(group.comparable, true, JSON.stringify(group.reasons));
  assert.deepEqual(group.reasons, []);
  assert.equal(group.sampleCount, 4);
  assert.equal(group.wall.onCount, 2);
  assert.equal(group.wall.offCount, 2);
  assert.equal(group.wall.onMeanMs, 6100);
  assert.equal(group.wall.offMeanMs, 5600);
  assert.equal(group.wall.deltaOnMinusOffMs, 500);
  assert.equal(group.cpu.status, "OBSERVED");
  assert.equal(group.cpu.onCount, 2);
  assert.equal(group.cpu.offCount, 2);
  assert.equal(group.cpu.onMeanSeconds, 1.25);
  assert.equal(group.cpu.offMeanSeconds, 0.75);
  assert.equal(group.cpu.deltaOnMinusOffSeconds, 0.5);
});
test("equal measured costs are legitimate descriptive zero differences", () => {
  if (!hasOverheadSummary()) return;
  const samples = overheadSamples();
  for (const sample of samples) {
    sample.wholeCaseWallMs = 6000;
    sample.cpu.totalMatchedProcessCpuSeconds = 1;
  }
  const group = oneOverheadGroup(samples);
  assert.equal(group.comparable, true);
  assert.equal(group.wall.deltaOnMinusOffMs, 0);
  assert.equal(group.cpu.deltaOnMinusOffSeconds, 0);
});
test("measured negative on-minus-off cost remains a negative observation without clamping", () => {
  if (!hasOverheadSummary()) return;
  const samples = overheadSamples();
  for (const sample of samples) {
    sample.wholeCaseWallMs = sample.probeMode === "on" ? 5500 : 6000;
    sample.cpu.totalMatchedProcessCpuSeconds = sample.probeMode === "on" ? 0.5 : 1;
  }
  const group = oneOverheadGroup(samples);
  assert.equal(group.comparable, true);
  assert.equal(group.wall.deltaOnMinusOffMs, -500);
  assert.equal(group.cpu.deltaOnMinusOffSeconds, -0.5);
});
for (const [label, mutate] of [
  [
    "missing process endpoint",
    (sample) => {
      sample.cpu = null;
    },
  ],
  [
    "partial process coverage",
    (sample) => {
      sample.cpu.completeCoverage = false;
    },
  ],
  [
    "unknown matched CPU",
    (sample) => {
      sample.cpu.totalMatchedProcessCpuSeconds = null;
    },
  ],
  [
    "nonfinite matched CPU",
    (sample) => {
      sample.cpu.totalMatchedProcessCpuSeconds = Number.NaN;
    },
  ],
  [
    "negative matched CPU",
    (sample) => {
      sample.cpu.totalMatchedProcessCpuSeconds = -1;
    },
  ],
])
  test(`ABBA preserves ${label} as unavailable CPU rather than filtering it into a full comparison`, () => {
    if (!hasOverheadSummary()) return;
    const samples = overheadSamples();
    mutate(samples[0]);
    const group = oneOverheadGroup(samples);
    assert.equal(
      group.comparable,
      true,
      "source/control and wall evidence remain independently comparable",
    );
    assert.equal(group.wall.deltaOnMinusOffMs, 500);
    assert.equal(group.cpu.status, "PARTIAL_PROCESS_COVERAGE");
    assert.equal(group.cpu.onCount, 1);
    assert.equal(group.cpu.offCount, 2);
    assert.equal(group.cpu.onMeanSeconds, null);
    assert.equal(group.cpu.offMeanSeconds, null);
    assert.equal(group.cpu.deltaOnMinusOffSeconds, null);
  });

for (const [label, mutate] of [
  [
    "ABAB order instead of the frozen ABBA",
    (samples) => {
      [samples[2], samples[3]] = [samples[3], samples[2]];
    },
  ],
  [
    "only a two-observation smoke",
    (samples) => {
      samples.splice(2);
    },
  ],
  [
    "extra unmatched observation",
    (samples) => {
      samples.push(cloneControl(samples[0]));
    },
  ],
  [
    "duplicate artifact tag",
    (samples) => {
      samples[3].tag = samples[0].tag;
    },
  ],
  [
    "wall duration unavailable",
    (samples) => {
      samples[0].wholeCaseWallMs = null;
    },
  ],
  [
    "wall duration nonfinite",
    (samples) => {
      samples[0].wholeCaseWallMs = Infinity;
    },
  ],
  [
    "negative wall duration",
    (samples) => {
      samples[0].wholeCaseWallMs = -1;
    },
  ],
  [
    "sample probe identity differs from receipt",
    (samples) => {
      samples[0].data.probeMode = "off";
    },
  ],
  [
    "source configuration differs",
    (samples) => {
      samples[1].data.sourceConfiguration.referenceBudgetSource = "another source version";
    },
  ],
  [
    "solver input material revision differs",
    (samples) => {
      samples[1].data.solverInput.materials[0].revision++;
    },
  ],
  [
    "solver input seed-like unknown property differs",
    (samples) => {
      samples[1].data.solverInput.unpinnedRandomSeed = 7;
    },
  ],
  [
    "original source budget changed",
    (samples) => {
      samples[1].data.beforeTelemetry.budget.maxVoices = 16;
    },
  ],
  [
    "frame count differs",
    (samples) => {
      samples[1].data.timeline.frameCount++;
    },
  ],
  [
    "channel count differs",
    (samples) => {
      samples[1].data.timeline.channelCount = 1;
    },
  ],
  [
    "control failed despite advertised qualification",
    (samples) => {
      samples[0].data.controlError = "timer intervention did not complete";
    },
  ],
  [
    "source control action was never observed",
    (samples) => {
      samples[0].data.actions = [];
    },
  ],
  [
    "context failed to close",
    (samples) => {
      samples[0].data.contextClosed = false;
    },
  ],
])
  test(`ABBA does not compare ${label}`, () => {
    if (!hasOverheadSummary()) return;
    const samples = overheadSamples();
    mutate(samples);
    nonComparable(samples);
  });
test("valid source controls at two actual rates still cannot become a same-rate overhead comparison", () => {
  if (!hasOverheadSummary()) return;
  const samples = overheadSamples();
  const data = samples[1].data;
  data.timeline.sampleRate = 44100;
  data.timeline.epochFrame = 44100;
  data.timeline.startFrame = 71442;
  data.timeline.frameCount = 132300;
  data.timeline.endFrame = 203742;
  data.audioCapabilities.sampleRate = 44100;
  data.beforeTelemetry.sampleRate = 44100;
  data.afterTelemetry.sampleRate = 44100;
  assert.equal(
    runControlCheck(data).qualified,
    true,
    "each rate is a valid control observation on its own",
  );
  nonComparable(samples);
});
test("two valid budget-pressure outcomes with different admission counts are distinct workloads", () => {
  if (!hasOverheadSummary()) return;
  const samples = overheadSamples("voice-path-budget");
  const data = samples[1].data;
  data.actions[1].result[22] = { accepted: false, reason: "VOICE_BUDGET" };
  data.afterTelemetry.droppedVoices = 14;
  data.afterDiagnostics = null;
  for (const sample of samples) assert.equal(runControlCheck(sample.data).qualified, true);
  nonComparable(samples);
});
test("reference and provisional carrier results remain separate groups", () => {
  if (!hasOverheadSummary()) return;
  const summary = controlModule.summarizeControlledAudioOverhead([
    ...overheadSamples(),
    ...overheadSamples("steady", "nativeCarrierRoutes"),
  ]);
  assert.equal(summary.groups.length, 2);
  const reference = summary.groups.find((group) => group.audioModel === "nativeReference");
  const candidate = summary.groups.find((group) => group.audioModel === "nativeCarrierRoutes");
  assert.equal(reference.comparable, true);
  assert.equal(candidate.comparable, false);
  assert.equal(candidate.wall.deltaOnMinusOffMs, null);
  assert.equal(candidate.cpu.deltaOnMinusOffSeconds, null);
});
for (const [label, input] of [
  ["null samples", null],
  ["non-array samples", {}],
])
  test(`ABBA contains ${label}`, () => {
    if (!hasOverheadSummary()) return;
    let summary;
    assert.doesNotThrow(() => {
      summary = controlModule.summarizeControlledAudioOverhead(input);
    });
    assert.deepEqual(summary.groups, []);
    assert.ok(Array.isArray(summary.reasons) && summary.reasons.length > 0);
    assert.equal(summary.nativeDspCpuMs, null);
    assert.notEqual(summary.status, "PASS");
  });

for (const mode of ["on", "off"]) {
  for (const key of ["activeVoices", "activeSources", "activePaths"])
    test(`continuous control workload cannot qualify with ${key}=0 after capture in ${mode} mode`, () => {
      if (!hasControlVerifier()) return;
      const data = literalControlCase("steady", mode);
      data.afterTelemetry[key] = 0;
      rejectedControl(data);
    });
}
test("on-mode primary admission must actually advance the onset counter", () => {
  if (!hasControlVerifier()) return;
  const data = literalControlCase("steady", "on");
  data.afterDiagnostics.onsets.count = 0;
  rejectedControl(data);
});
test("controlled source starts from the same fresh zero-voice endpoint", () => {
  if (!hasControlVerifier()) return;
  const data = literalControlCase();
  data.beforeTelemetry.activeVoices = 1;
  data.beforeTelemetry.activeSources = 1;
  data.beforeTelemetry.activePaths = 1;
  rejectedControl(data);
});
for (const caseId of ["main-stall", "late-onset", "stale-frame", "path-churn", "voice-path-budget"])
  test(`controlled ${caseId} executed after the PCM window cannot qualify despite coherent counters`, () => {
    if (!hasControlVerifier()) return;
    const data = literalControlCase(caseId);
    for (const action of data.actions.slice(1)) {
      for (const key of [
        "handlerEnteredWallMs",
        "operationStartedWallMs",
        "operationFinishedWallMs",
        "wallMs",
      ])
        action[key] += 4000;
      action.handlerEnteredAudioSeconds += 4;
      action.audioSeconds += 4;
      action.timerDispatchRelativeToRequestedWallDeadlineMs =
        action.handlerEnteredWallMs - action.requestedWallDeadlineMs;
      action.audioDeadlineDeltaMs =
        (action.handlerEnteredAudioSeconds - action.scheduledAudioSeconds) * 1000;
      if (caseId === "main-stall")
        for (const endpoint of [action.result.before, action.result.after]) {
          endpoint.wallMs += 4000;
          endpoint.audioSeconds += 4;
        }
    }
    data.windowWaitEndedWallMs += 5000;
    data.actualContextTimeAtEndSeconds += 5;
    rejectedControl(data);
  });
test("a control operation ending after the saved wall window is independently invalid", () => {
  if (!hasControlVerifier()) return;
  const data = literalControlCase("late-onset");
  const action = data.actions[1];
  action.operationFinishedWallMs = data.windowWaitEndedWallMs + 1;
  action.wallMs = action.operationFinishedWallMs;
  action.synchronousOperationWallDurationMs =
    action.operationFinishedWallMs - action.operationStartedWallMs;
  rejectedControl(data);
});
