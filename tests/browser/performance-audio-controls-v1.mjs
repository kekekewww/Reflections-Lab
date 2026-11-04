// Independent validation of the frozen component source/control protocol.
// PCM continuity, callback CPU, physical output and formal performance are separate.
const CASES = [
  "steady",
  "main-stall",
  "late-onset",
  "stale-frame",
  "path-churn",
  "voice-path-budget",
  "digital-gap",
];
const ORIGINAL_BUDGET = Object.freeze({
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
const LABELS = {
  steady: ["primary-voice"],
  "main-stall": ["primary-voice", "main-stall-150ms"],
  "late-onset": ["primary-voice", "backdated-real-emission"],
  "stale-frame": ["primary-voice", "real-audio-consumer-stale-refusal"],
  "path-churn": ["primary-voice", "solver-path-birth", "solver-path-death"],
  "voice-path-budget": ["primary-voice", "original-voice-and-path-budget-pressure"],
  "digital-gap": ["primary-voice"],
};
const COUNTERS = ["lateEvents", "staleFrames", "droppedVoices", "droppedPaths", "stolenVoices"];
const FRAME_DECISIONS = [
  "accepted",
  "stale",
  "unavailable",
  "source-budget",
  "restart-blocked",
  "invalid",
  "error",
];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const nonnegative = (value) => finite(value) && value >= 0;
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const text = (value) => typeof value === "string" && value.length > 0 && value.length <= 512;
const vector = (value) => Array.isArray(value) && value.length === 3 && value.every(finite);
const ownKeysEqual = (value, keys) =>
  object(value) &&
  Reflect.ownKeys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const sameVector = (left, right) =>
  vector(left) && left.every((value, index) => Object.is(value, right[index]));
const originalBudget = (value) =>
  ownKeysEqual(value, Object.keys(ORIGINAL_BUDGET)) &&
  Object.entries(ORIGINAL_BUDGET).every(([key, expected]) => value[key] === expected);
const admission = (value) =>
  object(value) &&
  typeof value.accepted === "boolean" &&
  (value.reason === undefined || text(value.reason));
const counterDelta = (before, after, key) =>
  count(before?.[key]) && count(after?.[key]) && after[key] >= before[key]
    ? after[key] - before[key]
    : null;

function inspectSolution(solution, base, tick, fail) {
  const frame = solution?.frame;
  if (
    !object(solution) ||
    !object(frame) ||
    !object(solution.diagnostics) ||
    !Array.isArray(frame.paths) ||
    frame.paths.length < 1 ||
    frame.paths.length > 32
  ) {
    fail("SOLVER_RECEIPT_UNAVAILABLE");
    return null;
  }
  if (
    frame.schemaVersion !== "1.0.0" ||
    frame.backendId !== "custom-web-geometric" ||
    frame.backendVersion !== "web-geometric-1.0.0" ||
    frame.sourceId !== "probe.source" ||
    frame.listenerId !== "listener" ||
    frame.requestId !== `pcm-probe.probe.source.${tick}` ||
    frame.sceneRevision !== 0 ||
    frame.geometryRevision !== tick ||
    frame.poseTick !== tick ||
    frame.modelClass !== "numericalApproximation" ||
    frame.gainQuantity !== "pressureRatio" ||
    frame.pathAvailability !== "available" ||
    frame.stale !== false ||
    frame.impulseResponseArtifactId !== null ||
    !Array.isArray(frame.bandCentersHz) ||
    frame.bandCentersHz.length !== 7 ||
    !frame.bandCentersHz.every(
      (value, index) =>
        finite(value) && value > 0 && (index === 0 || value > frame.bandCentersHz[index - 1]),
    ) ||
    !Array.isArray(frame.capabilities) ||
    !frame.capabilities.includes("directParameters") ||
    !frame.capabilities.includes("individualReflectionPaths")
  )
    fail("SOLVER_FRAME_IDENTITY_OR_CAPABILITY");
  if (
    base &&
    (frame.backendId !== base.backendId ||
      frame.backendVersion !== base.backendVersion ||
      frame.sourceId !== base.sourceId ||
      frame.listenerId !== base.listenerId ||
      frame.bandCentersHz.length !== base.bandCentersHz.length ||
      frame.bandCentersHz.some((value, index) => value !== base.bandCentersHz[index]))
  )
    fail("SOLVER_MODEL_OR_SOURCE_CHANGED");
  const ids = new Set();
  let direct = null,
    reflections = 0;
  for (const path of frame.paths) {
    if (
      !object(path) ||
      !text(path.id) ||
      ids.has(path.id) ||
      path.sourceId !== frame.sourceId ||
      path.listenerId !== frame.listenerId ||
      ![0, 1].includes(path.order) ||
      !Array.isArray(path.verticesM) ||
      path.verticesM.length !== path.order + 2 ||
      !path.verticesM.every(vector) ||
      !Array.isArray(path.surfaceIds) ||
      path.surfaceIds.length !== path.order ||
      !path.surfaceIds.every(text) ||
      !nonnegative(path.lengthM) ||
      path.lengthM <= 0 ||
      !nonnegative(path.absoluteDelayS) ||
      !nonnegative(path.relativeDelayS) ||
      !vector(path.arrivalDirection) ||
      !path.arrivalDirection.some((value) => value !== 0) ||
      !Array.isArray(path.bandGains) ||
      path.bandGains.length !== 7 ||
      !path.bandGains.every(nonnegative)
    ) {
      fail("NONFINITE_OR_INVALID_SOLVER_PATH");
      continue;
    }
    ids.add(path.id);
    if (!sameVector(path.verticesM[0], [0, 0, -1]) || !sameVector(path.verticesM.at(-1), [0, 0, 0]))
      fail("SOLVER_PATH_ENDPOINT_IDENTITY");
    if (path.order === 0) {
      if (direct !== null) fail("DUPLICATE_DIRECT_PATH");
      direct = path;
    } else reflections++;
  }
  if (!direct || !nonnegative(frame.directDelayS)) fail("SOLVER_DIRECT_PATH_UNAVAILABLE");
  const diagnostic = solution.diagnostics;
  if (
    typeof diagnostic.budgetExceeded !== "boolean" ||
    diagnostic.speedOfSoundMps !== 343 ||
    diagnostic.speedModel !== "explicit" ||
    !count(diagnostic.segmentTests) ||
    !count(diagnostic.evaluatedReflectionCandidates) ||
    !count(diagnostic.droppedPathCount) ||
    !count(diagnostic.rejectedReflectionCount)
  )
    fail("SOLVER_DIAGNOSTICS_UNAVAILABLE");
  return { frame, direct, reflections };
}

function inspectDiagnostics(before, after, fail) {
  for (const item of [before, after]) {
    if (
      !object(item) ||
      item.enabled !== true ||
      item.model !== "CONTROL_THREAD_OBSERVATIONS" ||
      item.sampleCapacity !== 128 ||
      !object(item.onsets) ||
      !count(item.onsets.count) ||
      !count(item.onsets.lateCount) ||
      item.onsets.lateCount > item.onsets.count ||
      item.onsets.lateThresholdMs !== 1 ||
      !object(item.frameDecisions) ||
      !FRAME_DECISIONS.every((key) => count(item.frameDecisions[key])) ||
      !object(item.admissions) ||
      !["droppedVoices", "droppedPaths", "staleVoiceAdmissions"].every((key) =>
        count(item.admissions[key]),
      )
    ) {
      fail("DIAGNOSTICS_UNAVAILABLE_OR_INVALID");
      return;
    }
  }
  for (const key of ["count", "lateCount"])
    if (after.onsets[key] < before.onsets[key]) fail("ONSET_COUNTER_RESET");
  for (const key of FRAME_DECISIONS)
    if (after.frameDecisions[key] < before.frameDecisions[key]) fail("FRAME_COUNTER_RESET");
  for (const key of ["droppedVoices", "droppedPaths", "staleVoiceAdmissions"])
    if (after.admissions[key] < before.admissions[key]) fail("ADMISSION_COUNTER_RESET");
}

function inspectCase(data, fail) {
  if (
    !object(data) ||
    data.schemaVersion !== "1.0.0" ||
    data.method !== "controlled-native-audio-pcm-v1" ||
    !CASES.includes(data.caseId) ||
    !["on", "off"].includes(data.probeMode) ||
    !["nativeReference", "nativeCarrierRoutes"].includes(data.audioModel)
  ) {
    fail("CONTROL_RECEIPT_IDENTITY");
    return;
  }
  if (
    !object(data.sourceConfiguration) ||
    data.sourceConfiguration.oscillatorModel !== data.audioModel
  )
    fail("SOURCE_MODEL_IDENTITY");
  // This method has no adopted carrier-capacity contract. It cannot qualify a
  // provisional carrier by treating virtual admissions as rejected voices.
  if (data.audioModel === "nativeCarrierRoutes") {
    fail("CANDIDATE_CAPACITY_NOT_FROZEN");
    return;
  }
  if (data.sourceConfiguration?.virtualization !== false) fail("REFERENCE_VIRTUALIZATION_CHANGED");
  if (
    data.nativeResourceSnapshot !== null &&
    data.nativeResourceSnapshot !== undefined &&
    data.nativeResourceSnapshot?.mode !== "nativeReference"
  )
    fail("ACTUAL_NATIVE_MODEL_DIFFERS");
  if (
    data.nativeDspCpuMs !== null ||
    data.hardwareBufferFrames !== null ||
    data.physicalRoute !== null ||
    data.hardwareHearing !== "NOT_RUN" ||
    data.formalPerformance !== "NOT_RUN"
  )
    fail("UNSUPPORTED_MEASUREMENT_INVENTED");
  if (
    data.controlError ||
    data.error ||
    data.cancelTransportError ||
    data.telemetryOverflow === true ||
    data.status === "CANCELLED" ||
    !Array.isArray(data.cleanupErrors) ||
    data.cleanupErrors.length !== 0 ||
    data.cleanupError ||
    data.contextClosed !== true
  )
    fail("CONTROL_OR_LIFECYCLE_INCOMPLETE");
  if (!Array.isArray(data.telemetry) || data.telemetry.length > 32) fail("TELEMETRY_CAP_OR_SCHEMA");
  if (
    data.probeMode === "off" &&
    (data.beforeDiagnostics !== null ||
      data.afterDiagnostics !== null ||
      data.telemetry?.length !== 0)
  )
    fail("PROBE_OFF_HAS_DIAGNOSTIC_POLLING");
  if (data.probeMode === "on")
    inspectDiagnostics(data.beforeDiagnostics, data.afterDiagnostics, fail);

  const timeline = data.timeline,
    capabilities = data.audioCapabilities;
  if (
    !object(timeline) ||
    !object(capabilities) ||
    !finite(timeline.sampleRate) ||
    timeline.sampleRate < 8000 ||
    timeline.sampleRate > 384000 ||
    timeline.channelCount !== 2 ||
    !count(timeline.epochFrame) ||
    !count(timeline.startFrame) ||
    !count(timeline.endFrame) ||
    timeline.epochSeconds !== timeline.epochFrame / timeline.sampleRate ||
    timeline.schedulingLookaheadSeconds !== 0.12 ||
    timeline.expectedPrimaryOnsetAudioSeconds !==
      timeline.epochSeconds + timeline.schedulingLookaheadSeconds ||
    timeline.startFrame !==
      timeline.epochFrame +
        Math.round((timeline.schedulingLookaheadSeconds + 0.5) * timeline.sampleRate) ||
    timeline.frameCount !== Math.round(3 * timeline.sampleRate) ||
    timeline.endFrame !== timeline.startFrame + timeline.frameCount ||
    capabilities.sampleRate !== timeline.sampleRate ||
    capabilities.contextState !== "running" ||
    !finite(data.actualContextTimeAtEndSeconds) ||
    data.actualContextTimeAtEndSeconds < timeline.endFrame / timeline.sampleRate ||
    !nonnegative(data.windowWaitStartedWallMs) ||
    !finite(data.windowWaitEndedWallMs) ||
    data.windowWaitEndedWallMs <= data.windowWaitStartedWallMs
  ) {
    fail("AUDIO_WINDOW_OR_RATE_NOT_VERIFIED");
    return;
  }
  if (
    !object(data.outputAdapter) ||
    data.outputAdapter.scope !== "SAME_AUDIOENGINE_POST_MASTER_SIGNAL" ||
    data.outputAdapter.unityControlPresentInBothModes !== true ||
    !["safetyClip", "limiter", "muteGain"].includes(data.outputAdapter.selectedNode)
  )
    fail("OUTPUT_ADAPTER_NOT_PINNED");
  const before = data.beforeTelemetry,
    after = data.afterTelemetry;
  for (const endpoint of [before, after]) {
    if (
      !object(endpoint) ||
      !originalBudget(endpoint.budget) ||
      endpoint.enabled !== true ||
      endpoint.muted !== false ||
      endpoint.paused !== false ||
      endpoint.contextState !== "running" ||
      endpoint.sampleRate !== timeline.sampleRate ||
      !["activeVoices", "activeSources", "activePaths"].every((key) => count(endpoint[key])) ||
      endpoint.activeVoices > ORIGINAL_BUDGET.maxVoices ||
      endpoint.activeSources > ORIGINAL_BUDGET.maxSources ||
      endpoint.activePaths > ORIGINAL_BUDGET.maxTotalPaths ||
      !COUNTERS.every((key) => count(endpoint[key])) ||
      endpoint.virtualization?.enabled === true
    )
      fail("ORIGINAL_SOURCE_BUDGET_OR_ENDPOINT_INVALID");
    if (
      endpoint?.lastError !== null &&
      endpoint?.lastError !== undefined &&
      !(
        data.caseId === "voice-path-budget" &&
        typeof endpoint.lastError === "string" &&
        /BUDGET/.test(endpoint.lastError)
      )
    )
      fail("UNEXPECTED_NATIVE_CONTROL_ERROR");
  }
  if (!object(before) || !object(after)) return;
  if (["activeVoices", "activeSources", "activePaths"].some((key) => before[key] !== 0))
    fail("CONTINUOUS_SOURCE_BASELINE_NOT_FRESH");
  if (
    ["activeVoices", "activeSources", "activePaths"].some(
      (key) => !count(after[key]) || after[key] < 1,
    )
  )
    fail("CONTINUOUS_SOURCE_NOT_PRESENT_AT_END");
  if (
    data.probeMode === "on" &&
    !(counterDelta(data.beforeDiagnostics?.onsets, data.afterDiagnostics?.onsets, "count") >= 1)
  )
    fail("PRIMARY_ONSET_NOT_OBSERVED");
  for (const key of COUNTERS)
    if (counterDelta(before, after, key) === null) fail("NATIVE_COUNTER_UNAVAILABLE_OR_RESET");
  const input = data.solverInput;
  if (
    !object(input) ||
    input.requestId !== "pcm-probe.probe.source.0" ||
    input.sceneRevision !== 0 ||
    input.geometryRevision !== 0 ||
    input.poseTick !== 0 ||
    input.source?.id !== "probe.source" ||
    input.listener?.id !== "listener" ||
    !sameVector(input.source?.positionM, [0, 0, -1]) ||
    !sameVector(input.listener?.positionM, [0, 0, 0]) ||
    !Array.isArray(input.surfaces) ||
    input.surfaces.length !== 0 ||
    input.budget?.maxSurfaces !== 32 ||
    input.budget?.maxPaths !== 8 ||
    input.budget?.maxSegmentTests !== 16384
  )
    fail("SOURCE_OR_SOLVER_INPUT_CHANGED");
  const base = inspectSolution(data.solver, null, 0, fail);

  const labels = LABELS[data.caseId],
    actions = data.actions;
  if (
    !Array.isArray(actions) ||
    actions.length !== labels.length ||
    actions.length > 64 ||
    actions.some(
      (action, index) =>
        !object(action) ||
        action.label !== labels[index] ||
        !nonnegative(action.wallMs) ||
        !nonnegative(action.audioSeconds),
    )
  ) {
    fail("REQUIRED_CONTROL_ACTION_MISSING_OR_EXTRA");
    return;
  }
  if (
    !admission(actions[0].admission) ||
    !actions[0].admission.accepted ||
    data.primaryStartStillFutureAtReturn !== true
  )
    fail("PRIMARY_SOURCE_NOT_FUTURE_AND_ADMITTED");
  for (let index = 1; index < actions.length; index++) {
    const action = actions[index];
    const expectedAudio =
      timeline.startFrame / timeline.sampleRate +
      1 +
      (data.caseId === "path-churn" && index === 2 ? 0.5 : 0);
    const keys = [
      "scheduledAudioSeconds",
      "scheduledAtWallMs",
      "scheduledAtAudioSeconds",
      "requestedWallDeadlineMs",
      "handlerEnteredWallMs",
      "handlerEnteredAudioSeconds",
      "timerDispatchRelativeToRequestedWallDeadlineMs",
      "audioDeadlineDeltaMs",
      "operationStartedWallMs",
      "operationFinishedWallMs",
      "synchronousOperationWallDurationMs",
    ];
    const windowStartAudio = timeline.startFrame / timeline.sampleRate,
      windowEndAudio = timeline.endFrame / timeline.sampleRate;
    if (
      action.handlerEnteredAudioSeconds < windowStartAudio ||
      action.handlerEnteredAudioSeconds > windowEndAudio ||
      action.audioSeconds < action.handlerEnteredAudioSeconds ||
      action.audioSeconds > windowEndAudio ||
      action.handlerEnteredWallMs < data.windowWaitStartedWallMs ||
      action.operationFinishedWallMs > data.windowWaitEndedWallMs ||
      action.wallMs > data.windowWaitEndedWallMs
    )
      fail("ACTUAL_CONTROL_OUTSIDE_CAPTURE_WINDOW");
    if (
      !keys.every((key) => finite(action[key])) ||
      action.scheduledAudioSeconds !== expectedAudio ||
      action.scheduledAtWallMs > action.handlerEnteredWallMs ||
      action.operationStartedWallMs < action.handlerEnteredWallMs ||
      action.operationFinishedWallMs < action.operationStartedWallMs ||
      action.wallMs < action.operationFinishedWallMs ||
      action.synchronousOperationWallDurationMs !==
        action.operationFinishedWallMs - action.operationStartedWallMs ||
      action.timerDispatchRelativeToRequestedWallDeadlineMs !==
        action.handlerEnteredWallMs - action.requestedWallDeadlineMs ||
      action.audioDeadlineDeltaMs !==
        (action.handlerEnteredAudioSeconds - action.scheduledAudioSeconds) * 1000
    )
      fail("TIMER_OR_OPERATION_OBSERVATION_INVALID");
  }
  if (data.caseId === "main-stall") {
    const action = actions[1],
      observation = action.result;
    if (
      !object(observation) ||
      !object(observation.before) ||
      !object(observation.after) ||
      ![
        observation.before.wallMs,
        observation.before.audioSeconds,
        observation.after.wallMs,
        observation.after.audioSeconds,
      ].every(finite) ||
      observation.after.wallMs - observation.before.wallMs < 150 ||
      observation.after.audioSeconds < observation.before.audioSeconds ||
      observation.before.audioSeconds < action.handlerEnteredAudioSeconds ||
      observation.after.audioSeconds > action.audioSeconds ||
      action.synchronousOperationWallDurationMs < 150 ||
      observation.before.wallMs < action.operationStartedWallMs ||
      observation.after.wallMs > action.operationFinishedWallMs
    )
      fail("ACTUAL_MAIN_STALL_NOT_OBSERVED");
  }
  if (data.caseId === "late-onset") {
    if (
      !admission(actions[1].result) ||
      !actions[1].result.accepted ||
      !(counterDelta(before, after, "lateEvents") >= 1)
    )
      fail("ACTUAL_LATE_ONSET_NOT_OBSERVED");
    if (
      data.probeMode === "on" &&
      !(
        counterDelta(data.beforeDiagnostics?.onsets, data.afterDiagnostics?.onsets, "lateCount") >=
        1
      )
    )
      fail("LATE_DIAGNOSTIC_NOT_OBSERVED");
  }
  if (data.caseId === "stale-frame") {
    if (!(counterDelta(before, after, "staleFrames") >= 1))
      fail("ACTUAL_STALE_REFUSAL_NOT_OBSERVED");
    if (
      data.probeMode === "on" &&
      !(
        counterDelta(
          data.beforeDiagnostics?.frameDecisions,
          data.afterDiagnostics?.frameDecisions,
          "stale",
        ) >= 1
      )
    )
      fail("STALE_DIAGNOSTIC_NOT_OBSERVED");
  }
  if (data.caseId === "path-churn") {
    const birth = inspectSolution(data.birthSolution, base?.frame, 1, fail);
    const death = inspectSolution(data.deathSolution, base?.frame, 2, fail);
    if (
      !base ||
      !birth ||
      !death ||
      base.reflections !== 0 ||
      birth.reflections < 1 ||
      death.reflections !== 0 ||
      !birth.direct ||
      !death.direct ||
      birth.direct.id !== base.direct?.id ||
      death.direct.id !== base.direct?.id ||
      !birth.frame.paths.some((path) => path.order === 1 && path.surfaceIds.includes("probe.wall"))
    )
      fail("SOLVER_PATH_BIRTH_DEATH_NOT_OBSERVED");
  }
  if (data.caseId === "voice-path-budget") {
    const pressure = inspectSolution(data.pressureSolution, base?.frame, 1, fail),
      results = actions[1].result;
    if (
      !pressure ||
      pressure.frame.paths.length <= ORIGINAL_BUDGET.maxPathsPerVoice ||
      !Array.isArray(results) ||
      results.length !== 36 ||
      !results.every(admission)
    )
      fail("BUDGET_PRESSURE_NOT_EXECUTED");
    else {
      const rejected = results.filter((value) => !value.accepted);
      if (
        rejected.length < 1 ||
        !rejected.every(
          (value) => typeof value.reason === "string" && /BUDGET/.test(value.reason),
        ) ||
        !(counterDelta(before, after, "droppedVoices") >= rejected.length)
      )
        fail("REFERENCE_VOICE_BUDGET_REFUSAL_NOT_OBSERVED");
    }
    if (!(counterDelta(before, after, "droppedPaths") >= 1))
      fail("ACTUAL_PATH_BUDGET_PRESSURE_NOT_OBSERVED");
    if (
      data.probeMode === "on" &&
      (!(
        counterDelta(
          data.beforeDiagnostics?.admissions,
          data.afterDiagnostics?.admissions,
          "droppedPaths",
        ) >= 1
      ) ||
        !(
          counterDelta(
            data.beforeDiagnostics?.admissions,
            data.afterDiagnostics?.admissions,
            "droppedVoices",
          ) >= 1
        ))
    )
      fail("BUDGET_DIAGNOSTICS_NOT_OBSERVED");
  }
  if (data.caseId === "digital-gap") {
    const gap = data.injectedGap;
    if (
      !object(gap) ||
      gap.kind !== "INTENTIONAL_POST_MASTER_DIGITAL_SILENCE_NOT_A_PRODUCT_UNDERRUN" ||
      gap.startFrame !== timeline.startFrame + Math.round(timeline.sampleRate) ||
      gap.endFrame !== gap.startFrame + Math.round(0.1 * timeline.sampleRate) ||
      gap.endFrame > timeline.endFrame
    )
      fail("INJECTED_GAIN_CONTROL_NOT_PINNED");
  }
}

export function verifyControlledAudioCase(data) {
  const reasons = new Set();
  try {
    inspectCase(data, (reason) => reasons.add(reason));
  } catch {
    reasons.add("CONTROL_RECEIPT_ACCESS_FAILED");
  }
  return {
    qualified: reasons.size === 0,
    status: reasons.size ? "UNVERIFIED" : "CONTROL_SOURCE_VERIFIED",
    reasons: [...reasons],
    scope: "SOURCE_CONTROL_AND_COMPONENT_LIFECYCLE_ONLY",
    digitalContinuity: null,
    nativeDspCpuMs: null,
    hardwareHearing: "NOT_RUN",
    formalQualification: "NOT_APPROVED",
  };
}

// Canonical comparison of condition subtrees uses bounded data descriptors.
// The outer DTO must come from captured Playwright serialization or JSON parsing;
// this module does not promise getter-free access for arbitrary forged objects.
// Comparisons are local to one already source/browser-pinned run.
function conditionKey(value) {
  let nodes = 0;
  const active = new Set();
  function encode(item, depth) {
    if (++nodes > 20000 || depth > 16) throw new Error("CONDITION_CAP");
    if (item === null) return "null";
    if (typeof item === "boolean") return item ? "true" : "false";
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new Error("NONFINITE_CONDITION");
      return Object.is(item, -0) ? "-0" : String(item);
    }
    if (typeof item === "string") {
      if (item.length > 32768) throw new Error("CONDITION_STRING_CAP");
      return JSON.stringify(item);
    }
    if (!object(item) && !Array.isArray(item)) throw new Error("NON_JSON_CONDITION");
    if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item)))
      throw new Error("NON_PLAIN_CONDITION_OBJECT");
    if (active.has(item)) throw new Error("CYCLIC_CONDITION");
    active.add(item);
    try {
      const keys = Reflect.ownKeys(item);
      if (Array.isArray(item)) {
        if (
          item.length > 4096 ||
          keys.length !== item.length + 1 ||
          keys.some(
            (key) =>
              key !== "length" &&
              (typeof key !== "string" ||
                !/^(0|[1-9][0-9]*)$/.test(key) ||
                Number(key) >= item.length),
          )
        )
          throw new Error("CONDITION_ARRAY_SCHEMA_OR_CAP");
        const values = [];
        for (let index = 0; index < item.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
          if (!descriptor || !Object.hasOwn(descriptor, "value"))
            throw new Error("CONDITION_ARRAY_ACCESSOR_OR_HOLE");
          values.push(encode(descriptor.value, depth + 1));
        }
        return `[${values.join(",")}]`;
      }
      if (keys.length > 128 || keys.some((key) => typeof key !== "string" || key.length > 256))
        throw new Error("CONDITION_OBJECT_SCHEMA_OR_CAP");
      keys.sort();
      const values = [];
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !Object.hasOwn(descriptor, "value"))
          throw new Error("CONDITION_ACCESSOR");
        values.push(`${JSON.stringify(key)}:${encode(descriptor.value, depth + 1)}`);
      }
      return `{${values.join(",")}}`;
    } finally {
      active.delete(item);
    }
  }
  return encode(value, 0);
}

function actionWorkload(action) {
  if (action.label === "primary-voice")
    return {
      label: action.label,
      kind: "admission",
      attempted: 1,
      accepted: Number(action.admission.accepted),
      rejected: Number(!action.admission.accepted),
    };
  if (Array.isArray(action.result))
    return {
      label: action.label,
      kind: "admissions",
      attempted: action.result.length,
      accepted: action.result.filter((item) => item.accepted === true).length,
      rejected: action.result.filter((item) => item.accepted === false).length,
    };
  if (object(action.result) && typeof action.result.accepted === "boolean")
    return {
      label: action.label,
      kind: "admission",
      attempted: 1,
      accepted: Number(action.result.accepted),
      rejected: Number(!action.result.accepted),
    };
  if (action.label === "main-stall-150ms")
    return { label: action.label, kind: "bounded-main-stall", requestedWallMilliseconds: 150 };
  return {
    label: action.label,
    kind: "void-result",
    resultCount: action.result === null || action.result === undefined ? 0 : 1,
  };
}
function workloadKey(data) {
  return conditionKey({
    sampleRate: data.timeline.sampleRate,
    channelCount: data.timeline.channelCount,
    frameCount: data.timeline.frameCount,
    solverInput: data.solverInput,
    sourceConfiguration: data.sourceConfiguration,
    beforeBudget: data.beforeTelemetry.budget,
    afterBudget: data.afterTelemetry.budget,
    outputAdapter: data.outputAdapter,
    actions: data.actions.map(actionWorkload),
    solverReceipts: {
      base: data.solver,
      birth: data.caseId === "path-churn" ? data.birthSolution : null,
      death: data.caseId === "path-churn" ? data.deathSolution : null,
      pressure: data.caseId === "voice-path-budget" ? data.pressureSolution : null,
    },
  });
}
function emptyWall(onCount = 0, offCount = 0) {
  return { onCount, offCount, onMeanMs: null, offMeanMs: null, deltaOnMinusOffMs: null };
}
function emptyCpu(status, onCount = 0, offCount = 0) {
  return {
    status,
    onCount,
    offCount,
    onMeanSeconds: null,
    offMeanSeconds: null,
    deltaOnMinusOffSeconds: null,
  };
}
const cpuObserved = (cpu) =>
  object(cpu) &&
  cpu.status === "OBSERVED" &&
  cpu.completeCoverage === true &&
  nonnegative(cpu.totalMatchedProcessCpuSeconds);

function summarizeGroup(rows) {
  const reasons = new Set();
  const fail = (reason) => reasons.add(reason);
  const first = rows[0];
  const group = {
    caseId: first.caseId,
    audioModel: first.audioModel,
    sampleCount: rows.length,
    status: "UNVERIFIED",
    comparable: false,
    reasons: [],
    wall: emptyWall(),
    cpu: emptyCpu("NOT_COMPARABLE"),
    nativeDspCpuMs: null,
    comparabilityScope: "WITHIN_ONE_IMMUTABLY_PINNED_RUN_REPORT",
  };
  if (
    rows.length !== 4 ||
    rows.some((row, index) => row.probeMode !== ["on", "off", "off", "on"][index])
  )
    fail("FROZEN_ABBA_SEQUENCE_REQUIRED");
  const tags = new Set();
  let baselineKey = null;
  for (const row of rows) {
    if (!text(row.tag) || tags.has(row.tag)) fail("ARTIFACT_TAG_MISSING_OR_DUPLICATED");
    tags.add(row.tag);
    if (
      !object(row.data) ||
      row.caseId !== row.data.caseId ||
      row.audioModel !== row.data.audioModel ||
      row.probeMode !== row.data.probeMode
    )
      fail("SAMPLE_RECEIPT_IDENTITY_MISMATCH");
    const controls = verifyControlledAudioCase(row.data);
    if (!controls.qualified) {
      fail("SOURCE_CONTROL_NOT_VERIFIED");
      for (const reason of controls.reasons) fail(reason);
    }
    if (!nonnegative(row.wholeCaseWallMs) || row.wholeCaseWallMs === 0)
      fail("WHOLE_CASE_WALL_UNAVAILABLE");
    if (
      object(row.data) &&
      finite(row.data.windowWaitStartedWallMs) &&
      finite(row.data.windowWaitEndedWallMs) &&
      finite(row.wholeCaseWallMs) &&
      row.wholeCaseWallMs < row.data.windowWaitEndedWallMs - row.data.windowWaitStartedWallMs
    )
      fail("WHOLE_CASE_WALL_SHORTER_THAN_SAVED_WINDOW");
    if (controls.qualified) {
      try {
        const key = workloadKey(row.data);
        if (baselineKey === null) baselineKey = key;
        else if (baselineKey !== key) fail("SOURCE_OR_WORKLOAD_CONDITION_MISMATCH");
      } catch {
        fail("SOURCE_CONDITION_SCHEMA_OR_CAP");
      }
    }
  }
  const on = rows.filter((row) => row.probeMode === "on"),
    off = rows.filter((row) => row.probeMode === "off");
  const validWallOn = on.filter(
    (row) => nonnegative(row.wholeCaseWallMs) && row.wholeCaseWallMs > 0,
  );
  const validWallOff = off.filter(
    (row) => nonnegative(row.wholeCaseWallMs) && row.wholeCaseWallMs > 0,
  );
  const validCpuOn = on.filter((row) => cpuObserved(row.cpu)),
    validCpuOff = off.filter((row) => cpuObserved(row.cpu));
  group.wall = emptyWall(validWallOn.length, validWallOff.length);
  group.cpu = emptyCpu("NOT_COMPARABLE", validCpuOn.length, validCpuOff.length);
  group.comparable = reasons.size === 0;
  if (group.comparable) {
    const mean = (items, extract) =>
      items.reduce((total, item) => total + extract(item) / items.length, 0);
    const onMeanMs = mean(on, (row) => row.wholeCaseWallMs),
      offMeanMs = mean(off, (row) => row.wholeCaseWallMs);
    group.wall = {
      onCount: on.length,
      offCount: off.length,
      onMeanMs,
      offMeanMs,
      deltaOnMinusOffMs: onMeanMs - offMeanMs,
    };
    if (validCpuOn.length === 2 && validCpuOff.length === 2) {
      const onMeanSeconds = mean(on, (row) => row.cpu.totalMatchedProcessCpuSeconds);
      const offMeanSeconds = mean(off, (row) => row.cpu.totalMatchedProcessCpuSeconds);
      group.cpu = {
        status: "OBSERVED",
        onCount: 2,
        offCount: 2,
        onMeanSeconds,
        offMeanSeconds,
        deltaOnMinusOffSeconds: onMeanSeconds - offMeanSeconds,
      };
    } else group.cpu = emptyCpu("PARTIAL_PROCESS_COVERAGE", validCpuOn.length, validCpuOff.length);
    group.status = "DESCRIPTIVE_ONLY";
  }
  group.reasons = [...reasons];
  return group;
}

/** Two observations per mode are raw descriptive means, not a significance test or a performance gate. */
export function summarizeControlledAudioOverhead(samples) {
  const summary = {
    scope: "WHOLE_CASE_DESCRIPTIVE_ONLY",
    status: "UNVERIFIED",
    formalQualification: "NOT_APPROVED",
    nativeDspCpuMs: null,
    groups: [],
    reasons: [],
    limitations: [
      "Whole-case setup/capture/encoding/report/cleanup cost; not native DSP callback CPU",
      "Two observations per mode do not establish statistical significance or cross-run reliability",
      "Shared source/bundle/browser/executable/device pins must remain attached to the parent run report",
    ],
  };
  if (!Array.isArray(samples) || samples.length === 0 || samples.length > 56) {
    summary.reasons = [
      Array.isArray(samples) && samples.length === 0 ? "NO_SAMPLES" : "SAMPLE_ARRAY_SCHEMA_OR_CAP",
    ];
    return summary;
  }
  try {
    const groups = new Map();
    for (const sample of samples) {
      if (
        !object(sample) ||
        !CASES.includes(sample.caseId) ||
        !["nativeReference", "nativeCarrierRoutes"].includes(sample.audioModel) ||
        !["on", "off"].includes(sample.probeMode)
      ) {
        summary.reasons = ["SAMPLE_IDENTITY_SCHEMA"];
        return summary;
      }
      const key = JSON.stringify([sample.caseId, sample.audioModel]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sample);
    }
    summary.groups = [...groups.values()].map(summarizeGroup);
    summary.status = summary.groups.every((group) => group.comparable)
      ? "DESCRIPTIVE_ONLY"
      : "UNVERIFIED";
  } catch {
    summary.groups = [];
    summary.reasons = ["OVERHEAD_INPUT_ACCESS_FAILED"];
  }
  return summary;
}
