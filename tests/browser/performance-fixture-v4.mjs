import { quiesceProfile, runProfileTail } from "./performance-quiescence-v3.mjs";
/* global window, document, navigator, performance, requestAnimationFrame, cancelAnimationFrame, innerWidth, innerHeight, devicePixelRatio, PerformanceObserver, setTimeout, clearTimeout */
/* eslint no-undef: "error" */
import { LabRuntime } from "../../src/app/runtime.ts";
import { mountReflectionLab } from "../../src/app/bootstrap.ts";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.ts";
import { PhysicsWorld } from "../../src/physics/index.ts";
import { AcousticService } from "../../src/app/acoustic-service.ts";
import { AudioEngine, DEFAULT_NATIVE_VOICE_POLICY } from "../../src/audio/index.ts";

import { createProofCollector } from "./performance-proof-v3.mjs";
// BEGIN_TESTABLE_NATIVE_AUDIO_DISPOSAL_V4
export async function finalizeNativeAudioAfterTailV4(
  engine,
  { timeoutMs = 5000, setTimer = setTimeout, clearTimer = clearTimeout } = {},
) {
  if (
    !engine ||
    typeof engine.disposeAsync !== "function" ||
    !engine.context ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 5000 ||
    typeof setTimer !== "function" ||
    typeof clearTimer !== "function"
  )
    throw new Error("V4_NATIVE_ASYNC_DISPOSAL_UNAVAILABLE");
  const context = engine.context;
  const contextStateBefore = typeof context.state === "string" ? context.state : null;
  const snapshot = () =>
    typeof engine.getNativeResourceSnapshot === "function"
      ? engine.getNativeResourceSnapshot()
      : null;
  const resourceBefore = snapshot();
  let timer;
  try {
    const disposal = Promise.resolve().then(() => {
      const completion = engine.disposeAsync();
      if (!completion || typeof completion.then !== "function")
        throw new Error("V4_NATIVE_DISPOSAL_PROMISE_REQUIRED");
      return completion;
    });
    await Promise.race([
      disposal,
      new Promise((_, reject) => {
        timer = setTimer(() => reject(new Error("V4_NATIVE_AUDIO_DISPOSAL_TIMEOUT")), timeoutMs);
      }),
    ]);
    const contextStateAfter = typeof context.state === "string" ? context.state : null;
    if (contextStateAfter !== "closed")
      throw new Error(`V4_NATIVE_CONTEXT_NOT_CLOSED:${contextStateAfter}`);
    const resourceAfter = snapshot();
    const telemetry = typeof engine.getTelemetry === "function" ? engine.getTelemetry() : null;
    const sources = resourceAfter?.nativeSourceNodes,
      slots = telemetry?.nativeSlotsInUse;
    const knownSources = Number.isSafeInteger(sources) && sources >= 0;
    const knownSlots = Number.isSafeInteger(slots) && slots >= 0;
    const resourcesReleased =
      (knownSources && sources > 0) || (knownSlots && slots > 0)
        ? false
        : knownSources && knownSlots
          ? sources === 0 && slots === 0
          : null;
    return {
      scope: "POST_WINDOW_DISPOSAL_ONLY",
      contextStateBefore,
      contextStateAfter,
      contextClosed: true,
      disposePromiseSettled: true,
      resourceBefore,
      resourceAfter,
      nativeSlotsAfter: knownSlots ? slots : null,
      resourcesReleased,
    };
  } finally {
    if (timer !== undefined) clearTimer(timer);
  }
}
// END_TESTABLE_NATIVE_AUDIO_DISPOSAL_V4

// BEGIN_TESTABLE_AUDIO_RESOURCE_POLICY_V4
export function verifyNativeAudioResourcePolicyV4(input = {}) {
  const reasons = [],
    fail = (reason) => reasons.push(reason);
  const { requestedArm, pathCap, resourceSnapshot, telemetry } = input ?? {};
  const candidate = requestedArm === "candidate";
  if (!["reference", "candidate"].includes(requestedArm)) fail("REQUESTED_ARM_UNKNOWN");
  if (pathCap !== 8 && pathCap !== 32) fail("ORIGINAL_PATH_PROFILE_UNKNOWN");
  const internal = pathCap === 32 ? 256 : 96;
  const budget = {
    maxVoices: 24,
    maxSources: 32,
    maxSourceFrames: 64,
    maxPathsPerVoice: pathCap,
    maxTotalPaths: internal,
    maxDecodedBytes: 67108864,
    maxAssetDurationSeconds: 120,
    maxAssetChannels: 2,
    maxPendingEvents: 256,
    maxAssets: 64,
    maxConcurrentDecodes: 2,
    maxLateSends: 16,
    maxLateReverbBytes: 4194304,
  };
  if (!telemetry || !resourceSnapshot) fail("PUBLIC_RESOURCE_OBSERVATION_UNAVAILABLE");
  for (const [key, value] of Object.entries(budget))
    if (telemetry?.budget?.[key] !== value) fail(`ORIGINAL_BUDGET_MISMATCH:${key}`);
  if (resourceSnapshot?.mode !== (candidate ? "nativeCarrierRoutes" : "nativeReference"))
    fail("ACTUAL_RESOURCE_MODE_MISMATCH");
  if (resourceSnapshot?.sourceContentModel !== "nativeReference")
    fail("SOURCE_CONTENT_MODEL_MISMATCH");
  const caps = {
    activeRenderedCap: 24,
    nativeGraphBudget: candidate ? 48 : null,
    internalArrivalGraphBudget: internal,
    nativeGraphTotalBudget: 48 + internal,
    nativeCarrierBudget: 48 + internal + (candidate ? 32 : 0),
  };
  for (const [name, endpoint] of [
    ["telemetry", telemetry],
    ["resourceSnapshot", resourceSnapshot],
  ]) {
    for (const [key, value] of Object.entries(caps))
      if (endpoint?.[key] !== value) fail(`ACTUAL_CAPACITY_MISMATCH:${name}.${key}`);
    for (const key of [
      "parentNativeGraphsInUse",
      "internalArrivalGraphsInUse",
      "nativeSourceNodes",
    ])
      if (!Number.isSafeInteger(endpoint?.[key]) || endpoint[key] < 0)
        fail(`ACTUAL_COUNT_UNKNOWN:${name}.${key}`);
  }
  for (const key of [
    "nativeSlotsInUse",
    "activeVoices",
    "activePaths",
    "retiringVoices",
    "pendingVoices",
    "pendingCarriers",
    "carrierOnlyVoices",
    "nativeCarrierPeak",
    "virtualVoices",
    "demotingVoices",
  ])
    if (!Number.isSafeInteger(telemetry?.[key]) || telemetry[key] < 0)
      fail(`ACTUAL_COUNT_UNKNOWN:telemetry.${key}`);
  const countCaps = {
    parentNativeGraphsInUse: 48,
    internalArrivalGraphsInUse: internal,
    nativeSourceNodes: caps.nativeCarrierBudget,
  };
  for (const [name, endpoint] of [
    ["telemetry", telemetry],
    ["resourceSnapshot", resourceSnapshot],
  ])
    for (const [key, limit] of Object.entries(countCaps))
      if (Number.isSafeInteger(endpoint?.[key]) && endpoint[key] > limit)
        fail(`OBSERVED_CAPACITY_EXCEEDED:${name}.${key}`);
  for (const key of ["parentNativeGraphsInUse", "internalArrivalGraphsInUse", "nativeSourceNodes"])
    if (telemetry?.[key] !== resourceSnapshot?.[key]) fail(`PUBLIC_COUNTS_DIFFER:${key}`);
  if (
    telemetry?.nativeSlotsInUse !==
    telemetry?.parentNativeGraphsInUse + telemetry?.internalArrivalGraphsInUse
  )
    fail("NATIVE_SLOT_COUNT_INCONSISTENT");
  if (
    Number.isSafeInteger(telemetry?.nativeSlotsInUse) &&
    telemetry.nativeSlotsInUse > caps.nativeGraphTotalBudget
  )
    fail("OBSERVED_TOTAL_GRAPHS_EXCEEDED");
  // Production activeVoices counts parent voices only; internal arrivals have
  // their independently preserved graph allowance above.
  if (Number.isSafeInteger(telemetry?.activeVoices) && telemetry.activeVoices > budget.maxVoices)
    fail("OBSERVED_PARENT_ACTIVE_VOICES_EXCEEDED");
  if (Number.isSafeInteger(telemetry?.activePaths) && telemetry.activePaths > budget.maxTotalPaths)
    fail("OBSERVED_TOTAL_PATHS_EXCEEDED");
  if (
    !Array.isArray(resourceSnapshot?.sources) ||
    resourceSnapshot.sources.length !== resourceSnapshot.nativeSourceNodes
  )
    fail("PUBLIC_SOURCE_IDENTITIES_INCOMPLETE");
  if (telemetry?.virtualization?.enabled !== candidate) fail("ACTUAL_VIRTUALIZATION_MISMATCH");
  if (candidate) {
    for (const key of [
      "maxNativeVoices",
      "maxNativeGraphs",
      "maxVirtualVoices",
      "minResidenceSeconds",
      "priorityHysteresis",
      "fairnessSeconds",
    ])
      if (
        !Number.isFinite(telemetry?.virtualization?.policy?.[key]) ||
        telemetry.virtualization.policy[key] !== DEFAULT_NATIVE_VOICE_POLICY[key]
      )
        fail(`ACTUAL_DEFAULT_POLICY_MISMATCH:${key}`);
  } else if (telemetry?.virtualization?.policy !== null) fail("REFERENCE_POLICY_MUST_BE_ABSENT");
  return {
    qualified: reasons.length === 0,
    reasons,
    requestedArm: requestedArm ?? null,
    pathCap: pathCap ?? null,
    scope: "PUBLIC_RESOURCE_POLICY_AND_ORIGINAL_BUDGET_ONLY",
  };
}
// END_TESTABLE_AUDIO_RESOURCE_POLICY_V4

function solverAudioPolicyOptionsV4() {
  const requested = window.__performanceProfileConfig?.audioPolicyArm ?? "reference";
  if (requested === "reference") return {};
  if (requested === "candidate") return { virtualization: DEFAULT_NATIVE_VOICE_POLICY };
  throw new Error("INVALID_PERFORMANCE_AUDIO_POLICY_ARM");
}

const previousRAF = window.requestAnimationFrame,
  previousCancelRAF = window.cancelAnimationFrame;
const probeMode = window.__performanceProfileConfig?.probeMode ?? "on";
if (!["on", "off"].includes(probeMode)) throw new Error("INVALID_PERFORMANCE_PROBE_MODE");
const probesEnabled = probeMode === "on";
const v3Proof = createProofCollector({ mark: (name) => performance.mark(name) });
const nativeRAF = requestAnimationFrame.bind(window);
const nativeCancelRAF = cancelAnimationFrame.bind(window);
const CAP = 90_000;
const samples = {
  frame: new Map(),
  nativeStepMs: [],
  fixedStepMs: [],
  onTick: [],
  publishMs: [],
  poseCalls: 0,
  longTasks: [],
  actions: [],
  audioTelemetry: [],
  nativeStarts: [],
  advances: [],
  warmupAdvances: [],
  captureWindows: [],
  droppedSamples: 0,
};
let measuring = false,
  warmingUp = false,
  warmup = null,
  scriptFrameHandle = null,
  currentCaptureIndex = null,
  measurementStartedClock = null,
  collectionWindow = null,
  interpolationObservation = null,
  mounted = null,
  runtime = null,
  observer = null,
  startedAt = null,
  lastActionAt = -Infinity;
let uiAudioResourceObservationAtEnableV4 = null;
let captureStartedAt = null,
  captureTimesMs = [10_000, 300_000, 580_000],
  nextCapture = 0,
  actionSequence = 0,
  currentFrame = null,
  scriptBusy = false,
  lastAudioSampleAt = -Infinity,
  startedAtTick = 0;
const append = (list, value) => {
  if (list.length < CAP) list.push(value);
  else samples.droppedSamples++;
};
const clock = () => performance.now();
const observedRAF = (callback) => {
  let requestHandle;
  requestHandle = nativeRAF((timestamp) => {
    const callbackObservedAtPerformanceMs = clock();
    try {
      v3Proof.callback(requestHandle, timestamp, callbackObservedAtPerformanceMs, measuring);
    } catch {
      v3Proof.invalidate("OBSERVER_CALLBACK_FAILED");
    }
    if (measuring) {
      currentFrame = timestamp;
      if (!samples.frame.has(timestamp)) {
        if (samples.frame.size < CAP)
          samples.frame.set(timestamp, {
            timestamp,
            callbackObservedAtPerformanceMs,
            collectionId: collectionWindow.collectionId,
            rafCpuMs: 0,
            callbacks: 0,
            advanceMs: 0,
            poseMs: 0,
            poseCalls: 0,
            simulationRunning: Boolean(runtime && !runtime.world.paused),
            tick: runtime?.world.tick ?? null,
          });
        else samples.droppedSamples++;
      }
      if (timestamp - lastAudioSampleAt >= 1000 && runtime?.audio) {
        lastAudioSampleAt = timestamp;
        samples.audioTelemetry.push({
          atMs: timestamp - startedAt,
          ...runtime.audio.getTelemetry(),
          audioDiagnostics: runtime.audio.getDiagnostics(),
        });
      }
    }
    const start = clock();
    let callbackError,
      callbackFailed = false;
    try {
      callback(timestamp);
    } catch (error) {
      callbackError = error;
      callbackFailed = true;
    } finally {
      if (measuring) {
        const frame = samples.frame.get(timestamp);
        if (frame) {
          frame.rafCpuMs += clock() - start;
          frame.callbacks++;
        }
      }
    }
    if (callbackFailed) {
      measuring = false;
      v3Proof.invalidate("ORIGINAL_CALLBACK_FAILED");
      v3Proof.close();
      try {
        restoreRAFObserver();
      } catch (cleanupError) {
        throw new AggregateError([callbackError, cleanupError], "V3_CALLBACK_CLEANUP_FAILED");
      }
      throw callbackError;
    }
  });
  try {
    v3Proof.register(requestHandle, measuring);
  } catch {
    v3Proof.invalidate("OBSERVER_REGISTER_FAILED");
  }
  return requestHandle;
};
const observedCancelRAF = (requestHandle) => {
  try {
    v3Proof.cancel(requestHandle);
  } catch {
    v3Proof.invalidate("OBSERVER_CANCEL_FAILED");
  }
  return nativeCancelRAF(requestHandle);
};
if (probesEnabled) {
  window.requestAnimationFrame = observedRAF;
  window.cancelAnimationFrame = observedCancelRAF;
}
function restoreRAFObserver() {
  if (
    window.requestAnimationFrame === previousRAF &&
    window.cancelAnimationFrame === previousCancelRAF
  )
    return;
  if (
    window.requestAnimationFrame !== observedRAF ||
    window.cancelAnimationFrame !== observedCancelRAF
  )
    throw new Error("V3_RAF_OBSERVER_OWNERSHIP_CHANGED");
  window.requestAnimationFrame = previousRAF;
  window.cancelAnimationFrame = previousCancelRAF;
}

const makeBody = (id, index, mode = "dynamicGravity") => ({
  id,
  shape: ["sphere", "box", "capsule"][index % 3],
  dimensionsM: index % 3 === 2 ? [0.28, 0.5, 0.28] : [0.3, 0.3, 0.3],
  positionM: [
    ((index % 10) - 4.5) * 0.45,
    0.5 + Math.floor(index / 100) * 0.6,
    ((Math.floor(index / 10) % 10) - 4.5) * 0.45,
  ],
  orientationQuaternion: [0, 0, 0, 1],
  mode,
  massKg: [0.1, 1, 5, 20][index % 4],
  friction: 0.55,
  restitution: 0.15,
  physicsMaterialId: "material.metal",
  acousticMaterialId: "material.metal",
  acousticRole: "dynamicOccluder",
});
function uiScene() {
  const scene = createDefaultScene();
  scene.objects.push(...Array.from({ length: 99 }, (_, i) => makeBody(`profile.body.${i}`, i)));
  return scene;
}
function wrap(object, key, sink) {
  if (!probesEnabled) return;
  const original = object[key].bind(object);
  object[key] = (...args) => {
    const start = clock();
    try {
      return original(...args);
    } finally {
      if (measuring) sink(clock() - start, args);
    }
  };
}
// BEGIN_TESTABLE_INTERPOLATION_OBSERVER
export function instrumentInterpolationMethods(world, now, isMeasuring, appendSample) {
  const requiredMethod = "interpolatedTransforms";
  if (
    typeof world?.[requiredMethod] !== "function" ||
    typeof now !== "function" ||
    typeof isMeasuring !== "function" ||
    typeof appendSample !== "function"
  )
    throw new Error("INTERPOLATION_OBSERVER_REQUIRED_METHOD_UNAVAILABLE");
  const observedMethods = [requiredMethod, "interpolatedPoses"].filter(
    (method) => typeof world[method] === "function",
  );
  const observation = {
    requiredMethod,
    observedMethods,
    calls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    ms: [],
    byMethod: Object.fromEntries(
      observedMethods.map((method) => [
        method,
        { calls: 0, successfulCalls: 0, failedCalls: 0, ms: [] },
      ]),
    ),
    aggregateScope:
      "Outermost method intervals only; per-method durations are inclusive and must not be summed",
  };
  let depth = 0;
  for (const method of observedMethods) {
    const original = world[method];
    world[method] = function (...args) {
      let completed = false;
      depth++;
      const startedAt = now();
      try {
        const value = original.apply(this, args);
        completed = true;
        return value;
      } finally {
        const active = isMeasuring();
        const durationMs = active ? now() - startedAt : null;
        const outermost = depth === 1;
        depth--;
        if (active) {
          const bucket = observation.byMethod[method];
          bucket.calls++;
          bucket.successfulCalls += Number(completed);
          bucket.failedCalls += Number(!completed);
          appendSample(bucket.ms, durationMs);
          if (outermost) {
            observation.calls++;
            observation.successfulCalls += Number(completed);
            observation.failedCalls += Number(!completed);
            appendSample(observation.ms, durationMs);
          }
        }
      }
    };
  }
  return observation;
}
// END_TESTABLE_INTERPOLATION_OBSERVER
function clockState() {
  const view = runtime.getSnapshot();
  return {
    atMs: startedAt === null ? null : clock() - startedAt,
    tick: runtime.world.tick,
    clockMode: runtime.world.clock.mode,
    accumulatorSeconds: runtime.world.clock.accumulatorSeconds,
    paused: runtime.world.paused,
    pauseReason: view.pauseReason,
    error: view.error,
    recordingState: runtime.recorder.getView().recording.state,
    totalDroppedWallTimeSeconds: runtime.world.clock.totalDroppedWallTimeSeconds,
  };
}
function artifactSummary() {
  const artifact = runtime.getRecordingArtifact();
  return artifact
    ? {
        sha256: artifact.artifactSha256,
        status: artifact.status,
        frameCount: artifact.frameCount,
        startTick: artifact.startTick,
        endTick: artifact.endTick,
        traceBytes: artifact.traceBytes,
      }
    : null;
}
function instrumentNativeStarts(context, evidence) {
  if (!probesEnabled) return;
  for (const kind of ["createOscillator", "createBufferSource"]) {
    const create = context[kind].bind(context);
    context[kind] = (...args) => {
      const source = create(...args),
        start = source.start.bind(source);
      source.start = (...startArgs) => {
        const result = start(...startArgs);
        append(evidence, {
          phase: measuring ? "measured" : warmingUp ? "warmup" : "cold",
          kind,
          contextTimeSeconds: context.currentTime,
          arguments: startArgs,
          successfulNativeStart: true,
        });
        return result;
      };
      return source;
    };
  }
}
let activeProfileAction = null;
async function action(value, method = "LabRuntime.dispatch") {
  const start = clock();
  const phase = measuring ? "measured" : warmingUp ? "warmup" : "cold";
  const before = clockState();
  activeProfileAction = value;
  try {
    await runtime.dispatch(value);
  } finally {
    activeProfileAction = null;
  }
  const after = clockState();
  samples.actions.push({
    phase,
    atMs: start - startedAt,
    method,
    action: value,
    durationMs: clock() - start,
    error: runtime.getSnapshot().error,
    simulationState: runtime.getSnapshot().simulationState,
    recordingState: runtime.recorder.getView().recording.state,
    recordingArtifactStatus: runtime.getRecordingArtifact()?.status ?? null,
    before,
    after,
  });
  if (value.type === "recordToggle" && currentCaptureIndex !== null) {
    const window = samples.captureWindows[currentCaptureIndex];
    if (before.recordingState !== "recording") {
      window.start = after;
      captureStartedAt = clock();
    } else {
      window.beforeStop = before;
      window.end = after;
      window.artifact = artifactSummary();
      captureStartedAt = null;
      currentCaptureIndex = null;
    }
  }
}
function perturbBodies() {
  const world = runtime.world;
  for (let i = 0; i < 24; i++)
    world.applyImpulse(`profile.body.${i}`, [Math.sin(i) * 0.03, 0.12, Math.cos(i) * 0.03]);
}
function scriptedFrame(now) {
  if ((!measuring && !warmingUp) || !runtime) return;
  const phase = measuring ? "measured" : "warmup";
  const world = runtime.world;
  if (world.heldObjectId === "ball" && !world.paused) {
    world.updateGrabTarget([
      -0.8 + Math.sin((now - startedAt) / 1500) * 0.8,
      1 + Math.cos((now - startedAt) / 2500) * 0.3,
      0,
    ]);
  }
  if (now - lastActionAt > 5000 && !runtime.busy && !scriptBusy) {
    lastActionAt = now;
    const sequence = actionSequence++;
    scriptBusy = true;
    void (async () => {
      await action({ type: "selectObject", objectId: sequence % 2 ? "ball" : "speaker" });
      await action({
        type: "workspace",
        workspace: ["scene", "simulation", "analysis"][sequence % 3],
      });
      await action({ type: "setMonitorMode", mode: sequence % 2 ? "raw" : "simulated" });
      if (sequence % 2 === 0 && !world.paused) {
        perturbBodies();
        let accepted, intent;
        if (world.heldObjectId) {
          intent = "OnThrow";
          accepted = world.throwHeld([0.2, -0.4, -1], 2, `profile.throw.${sequence}`);
        } else {
          intent = "OnGrab";
          const pose = world.getPose("ball");
          accepted = world.grab("ball", pose.positionMetres, `profile.grab.${sequence}`);
        }
        samples.actions.push({
          phase,
          atMs: now - startedAt,
          method: "PhysicsWorld public API",
          action: intent,
          accepted,
          tick: world.tick,
        });
      }
      if (
        runtime.getSnapshot().simulationState !== "running" &&
        runtime.recorder.getView().recording.state !== "recording"
      )
        await action({ type: "run" });
    })()
      .catch((error) =>
        samples.actions.push({
          phase,
          atMs: now - startedAt,
          error: String(error),
        }),
      )
      .finally(() => {
        scriptBusy = false;
      });
  }
  if (
    measuring &&
    captureStartedAt !== null &&
    now - captureStartedAt >= 1000 &&
    !runtime.busy &&
    !scriptBusy
  ) {
    if (runtime.recorder.getView().recording.state === "recording") {
      scriptBusy = true;
      void action({ type: "recordToggle" }).finally(() => {
        scriptBusy = false;
      });
    }
  } else if (
    measuring &&
    captureStartedAt === null &&
    nextCapture < captureTimesMs.length &&
    now - startedAt >= captureTimesMs[nextCapture] &&
    !runtime.busy &&
    !scriptBusy
  ) {
    currentCaptureIndex = nextCapture;
    samples.captureWindows.push({
      index: nextCapture,
      scheduledAtMs: captureTimesMs[nextCapture],
      requested: clockState(),
      start: null,
      end: null,
      artifact: null,
    });
    nextCapture++;
    scriptBusy = true;
    void action({ type: "recordToggle" }).finally(() => {
      scriptBusy = false;
    });
  }
  scriptFrameHandle = nativeRAF(scriptedFrame);
}
async function mountUI() {
  const requestedArm = window.__performanceProfileConfig?.audioPolicyArm ?? "reference";
  if (!["reference", "candidate"].includes(requestedArm))
    throw new Error("INVALID_PERFORMANCE_AUDIO_POLICY_ARM");
  runtime =
    requestedArm === "reference"
      ? await LabRuntime.create()
      : await LabRuntime.create({ audioResourcePolicy: DEFAULT_NATIVE_VOICE_POLICY });
  const project = JSON.parse(runtime.exportProject()),
    scene = uiScene();
  project.scene = scene;
  project.soundBehaviors = createDefaultBehaviors(scene);
  await runtime.importProject(JSON.stringify(project));
  if (runtime.getSnapshot().error) throw new Error(runtime.getSnapshot().error);
  wrap(runtime.world.world, "step", (ms) => append(samples.nativeStepMs, ms));
  wrap(runtime.world, "fixedStep", (ms) => append(samples.fixedStepMs, ms));
  wrap(runtime, "onTick", (ms) =>
    append(samples.onTick, {
      ms,
      recording: runtime.recorder.getView().recording.state === "recording",
      tick: runtime.world.tick,
    }),
  );
  wrap(runtime, "publish", (ms) => append(samples.publishMs, ms));
  interpolationObservation = probesEnabled
    ? instrumentInterpolationMethods(runtime.world, clock, () => measuring, append)
    : {
        ms: [],
        calls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        requiredMethod: "interpolatedTransforms",
        observedMethods: [],
        byMethod: {},
        aggregateScope: "NOT_OBSERVED_PROBE_OFF",
      };
  if (probesEnabled) {
    const originalWorldAdvance = runtime.world.advance.bind(runtime.world);
    let advanceResult = null;
    runtime.world.advance = (...args) => {
      advanceResult = originalWorldAdvance(...args);
      return advanceResult;
    };
    const originalRuntimeAdvance = runtime.advance.bind(runtime);
    runtime.advance = (deltaSeconds) => {
      const collecting = measuring || warmingUp;
      const before = collecting ? clockState() : null;
      advanceResult = null;
      const start = clock();
      let error = null;
      try {
        return originalRuntimeAdvance(deltaSeconds);
      } catch (cause) {
        error = String(cause);
        throw cause;
      } finally {
        const durationMs = clock() - start;
        if (collecting) {
          append(measuring ? samples.advances : samples.warmupAdvances, {
            phase: measuring ? "measured" : "warmup",
            atMs: start - startedAt,
            deltaSeconds,
            durationMs,
            steps: advanceResult?.steps ?? 0,
            overrun: advanceResult?.overrun ?? false,
            droppedWallTimeSeconds: advanceResult?.droppedWallTimeSeconds ?? 0,
            captureIndex: currentCaptureIndex,
            before,
            after: clockState(),
            error,
          });
        }
        if (measuring) {
          const frame = samples.frame.get(currentFrame);
          if (frame) frame.advanceMs += durationMs;
        }
      }
    };
    wrap(runtime, "getPose", (ms) => {
      const frame = samples.frame.get(currentFrame);
      if (frame) {
        frame.poseMs += ms;
        frame.poseCalls++;
      }
      samples.poseCalls++;
    });
  }
  mounted = await mountReflectionLab(document.getElementById("root"), {
    createRuntime: async () => runtime,
  });
  document.getElementById("profile-enable-audio").onclick = async () => {
    await runtime.dispatch({ type: "enableAudio" });
    if (runtime.getSnapshot().error)
      throw new Error(`NATIVE_AUDIO_ENABLE_FAILED: ${runtime.getSnapshot().error}`);
    runtime.setAudioDiagnosticsEnabled(probesEnabled);
    uiAudioResourceObservationAtEnableV4 = runtime.getAudioResourceObservation();
    if (
      uiAudioResourceObservationAtEnableV4?.telemetry?.enabled !== true ||
      uiAudioResourceObservationAtEnableV4.telemetry.contextState !== "running"
    )
      throw new Error("NATIVE_AUDIO_ENABLE_FAILED: PUBLIC_RESOURCE_ENDPOINT_UNAVAILABLE");
    instrumentNativeStarts(runtime.audio.context, samples.nativeStarts);
    runtime.audio?.setMuted(true);
    document.getElementById("profile-enable-audio").dataset.ready = "true";
  };
  return {
    scene,
    initial: runtime.getSnapshot(),
    audioEnabled: runtime.audio?.getTelemetry() ?? null,
  };
}
function environment() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  const debug = gl?.getExtension("WEBGL_debug_renderer_info");
  const graphics = gl
    ? {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        version: gl.getParameter(gl.VERSION),
      }
    : null;
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  return {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGiB: navigator.deviceMemory ?? null,
    viewport: {
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
      visualViewportScale: window.visualViewport?.scale ?? null,
    },
    graphics,
    audio: runtime?.audio?.getTelemetry() ?? null,
    powerMode: "See Node host metadata; browser does not expose OS power mode",
    visibilityState: document.visibilityState,
  };
}
async function beginUI(durationSeconds = 600) {
  const setupEnvironment = environment();
  const collectionId = window.crypto.randomUUID();
  const beginMarkName = `reflection-profile.begin.${collectionId}`;
  const endMarkName = `reflection-profile.end.${collectionId}`;
  startedAt = performance.mark(beginMarkName).startTime;
  collectionWindow = {
    schemaVersion: "3.0.0",
    collectionId,
    beginMarkName,
    endMarkName,
    beginPerformanceMs: startedAt,
    endPerformanceMs: null,
    observationClock: "performance.now at RAF wrapper entry",
    nativeRafTimestampMeaning:
      "Preserved callback argument; may precede collection begin even when the callback is observed inside the active collection",
  };
  v3Proof.begin(collectionId);
  startedAtTick = runtime.world.tick;
  measurementStartedClock = clockState();
  lastActionAt = -Infinity;
  captureTimesMs = durationSeconds >= 600 ? [10_000, 300_000, 580_000] : [1000];
  nextCapture = 0;
  measuring = true;
  if (
    probesEnabled &&
    typeof PerformanceObserver === "function" &&
    PerformanceObserver.supportedEntryTypes.includes("longtask")
  ) {
    observer = new PerformanceObserver((list) => {
      // Native attribution entries also need their JSON conversion before the window is cloned.
      for (const entry of list.getEntries())
        append(samples.longTasks, JSON.parse(JSON.stringify(entry.toJSON())));
    });
    observer.observe({ type: "longtask", buffered: false });
  }
  scriptFrameHandle = nativeRAF(scriptedFrame);
  return setupEnvironment;
}
async function warmupUI(durationMs = 10000) {
  startedAt = clock();
  lastActionAt = -Infinity;
  warmingUp = true;
  warmup = {
    requestedDurationMs: durationMs,
    started: clockState(),
    nativeStartsBefore: probesEnabled ? samples.nativeStarts.length : null,
    audioClockBefore: runtime.audio.context.currentTime,
    audioBefore: runtime.audio.getTelemetry(),
  };
  await action({ type: "run" });
  scriptFrameHandle = nativeRAF(scriptedFrame);
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  warmingUp = false;
  if (scriptFrameHandle !== null) nativeCancelRAF(scriptFrameHandle);
  scriptFrameHandle = null;
  const deadline = clock() + 5000;
  while (scriptBusy || runtime.busy) {
    if (clock() >= deadline) throw new Error("PROFILE_WARMUP_DID_NOT_QUIESCE");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  Object.assign(warmup, {
    durationMs: clock() - startedAt,
    ended: clockState(),
    nativeStartsAfter: probesEnabled ? samples.nativeStarts.length : null,
    audioClockAfter: runtime.audio.context.currentTime,
    audioAfter: runtime.audio.getTelemetry(),
    advances: samples.warmupAdvances,
    error: runtime.getSnapshot().error,
  });
  return warmup;
}
let closedUIRaw = null,
  closeUIError,
  closeUIFailed = false,
  uiCleanupDone = false,
  uiTail = null;
function cleanupUI(primaryFailed, primaryError, errors = []) {
  if (!uiCleanupDone) {
    uiCleanupDone = true;
    const attempt = (action) => {
      try {
        action();
      } catch (error) {
        errors.push(error);
      }
    };
    measuring = false;
    if (primaryFailed || errors.length) v3Proof.invalidate("COLLECTION_FAILED");
    if (!v3Proof.snapshot().closed) attempt(() => v3Proof.close());
    if (scriptFrameHandle !== null) {
      attempt(() => nativeCancelRAF(scriptFrameHandle));
      scriptFrameHandle = null;
    }
    if (collectionWindow?.endPerformanceMs === null) attempt(() => observer?.disconnect());
    attempt(() => mounted?.dispose());
    attempt(() => restoreRAFObserver());
    mounted = null;
    runtime = null;
  }
  if (primaryFailed || errors.length) {
    v3Proof.invalidate("COLLECTION_FAILED");
    if (!errors.length) throw primaryError;
    if (!primaryFailed && errors.length === 1) throw errors[0];
    throw new AggregateError(
      [...(primaryFailed ? [primaryError] : []), ...errors],
      "V3_COLLECTION_CLEANUP_FAILED",
    );
  }
}
function closeUIWindow() {
  if (closeUIFailed) throw closeUIError;
  if (closedUIRaw) return closedUIRaw;
  const errors = [],
    attempt = (action) => {
      try {
        action();
      } catch (error) {
        errors.push(error);
      }
    };
  try {
    const measuredEndAt = performance.mark(collectionWindow.endMarkName).startTime;
    collectionWindow.endPerformanceMs = measuredEndAt;
    const topMonitorObservation =
      typeof runtime.getTopMonitorObservationSnapshot === "function"
        ? runtime.getTopMonitorObservationSnapshot()
        : null;
    const topMonitorObservationAgeMs = Number.isFinite(
      topMonitorObservation?.normalReadAtPerformanceMs,
    )
      ? measuredEndAt - topMonitorObservation.normalReadAtPerformanceMs
      : null;
    // A shared active endpoint follows the fixed end mark; it is not a passive
    // TopMonitor read; its active observation scope is recorded separately.
    const audioResourceObservationAtClose =
      typeof runtime.getAudioResourceObservation === "function"
        ? runtime.getAudioResourceObservation()
        : null;
    const nativeResourceSnapshotAtClose = audioResourceObservationAtClose?.resourceSnapshot ?? null;
    const audioPolicyWitnessAtClose = verifyNativeAudioResourcePolicyV4({
      requestedArm: window.__performanceProfileConfig?.audioPolicyArm ?? "reference",
      pathCap: 8,
      resourceSnapshot: nativeResourceSnapshotAtClose,
      telemetry: audioResourceObservationAtClose?.telemetry ?? null,
    });
    const measuredEndTick = runtime.world.tick;
    const measuredEndClock = clockState();
    measuring = false;
    v3Proof.close();
    if (scriptFrameHandle !== null) attempt(() => nativeCancelRAF(scriptFrameHandle));
    scriptFrameHandle = null;
    attempt(() => observer?.disconnect());
    const recorderView = runtime.recorder.getView();
    const pendingAtEnd = {
      timestamp: measuredEndAt,
      scriptBusy,
      runtimeBusy: runtime.busy,
      recorderPending: recorderView.pending,
      recorderState: recorderView.recording.state,
      captureIndex: currentCaptureIndex,
      operation: activeProfileAction,
    };
    const final = runtime.getSnapshot(),
      audio = audioResourceObservationAtClose?.telemetry ?? null;
    const result = {
      probeMode,
      topMonitorObservation,
      topMonitorObservationAgeMs,
      nativeResourceSnapshotAtClose,
      audioPolicyWitnessAtClose,
      audioResourceEndpointScope: "SHARED_ACTIVE_ENDPOINT_AFTER_END_MARK_NOT_PASSIVE_MONITOR",
      diagnosticsEnabled: probesEnabled,
      productFooterNativeStatsObserverEnabled: probesEnabled,
      normalProductTopMonitorNativeAnalysisPreserved: true,
      probeCoverage: probesEnabled
        ? "INSTRUMENTED_NATIVE_RAF_METHOD_AUDIO_LONGTASK_AND_EXTERNAL_CDP"
        : "BENCHMARK_OBSERVERS_OFF_SHARED_ENDPOINTS_AND_NORMAL_PRODUCT_MONITOR_ONLY",
      startedAtPerformanceMs: startedAt,
      sampleMilliseconds: measuredEndAt - startedAt,
      collectionWindow,
      v3Proof: v3Proof.snapshot(),
      startedAtTick,
      measuredEndTick,
      captureScheduleMs: captureTimesMs,
      scene: runtime.getSceneDocument(),
      final,
      audio,
      audioTelemetry: samples.audioTelemetry,
      nativeStarts: probesEnabled ? samples.nativeStarts : null,
      droppedWallTimeSeconds:
        measuredEndClock.totalDroppedWallTimeSeconds -
        measurementStartedClock.totalDroppedWallTimeSeconds,
      cumulativeDroppedWallTimeSeconds: measuredEndClock.totalDroppedWallTimeSeconds,
      measurementStartedClock,
      measuredEndClock,
      warmup,
      advances: samples.advances,
      captureWindows: samples.captureWindows.map((window) => {
        const advances = samples.advances.filter((sample) => sample.captureIndex === window.index);
        return {
          ...window,
          advanceCount: probesEnabled ? advances.length : null,
          overrunCount: probesEnabled ? advances.filter((sample) => sample.overrun).length : null,
          pausedAdvanceCount: probesEnabled
            ? advances.filter((sample) => sample.before.paused || sample.after.paused).length
            : null,
          maxAccumulatorSeconds: probesEnabled
            ? Math.max(0, ...advances.map((sample) => sample.after.accumulatorSeconds))
            : null,
        };
      }),
      recorderArtifact: runtime.getRecordingArtifact()
        ? {
            sha256: runtime.getRecordingArtifact().artifactSha256,
            status: runtime.getRecordingArtifact().status,
            frameCount: runtime.getRecordingArtifact().frameCount,
            traceBytes: runtime.getRecordingArtifact().traceBytes,
          }
        : null,
      frame: [...samples.frame.values()],
      nativeStepMs: samples.nativeStepMs,
      fixedStepMs: samples.fixedStepMs,
      onTick: samples.onTick,
      publishMs: samples.publishMs,
      interpolationMs: probesEnabled ? interpolationObservation.ms : null,
      interpolationCalls: probesEnabled ? interpolationObservation.calls : null,
      interpolationObservation: probesEnabled
        ? {
            requiredMethod: interpolationObservation.requiredMethod,
            observedMethods: interpolationObservation.observedMethods,
            calls: interpolationObservation.calls,
            successfulCalls: interpolationObservation.successfulCalls,
            failedCalls: interpolationObservation.failedCalls,
            byMethod: interpolationObservation.byMethod,
            aggregateScope: interpolationObservation.aggregateScope,
          }
        : null,
      poseCalls: probesEnabled ? samples.poseCalls : null,
      longTasks: samples.longTasks,
      actions: samples.actions,
      droppedSamples: probesEnabled ? samples.droppedSamples : null,
      longTaskSupported:
        typeof PerformanceObserver === "function" &&
        PerformanceObserver.supportedEntryTypes.includes("longtask"),
    };
    result.pendingAtEnd = pendingAtEnd;
    const cloneStart = performance.now();
    const closed = globalThis.structuredClone(result);
    closed.windowSnapshot = {
      status: "CLOSED_WINDOW",
      cloneDurationMs: performance.now() - cloneStart,
    };
    if (errors.length) cleanupUI(false, undefined, errors);
    closedUIRaw = closed;
    return closedUIRaw;
  } catch (error) {
    if (uiCleanupDone) {
      closeUIFailed = true;
      closeUIError = error;
      throw error;
    }
    try {
      cleanupUI(true, error, errors);
    } catch (failure) {
      closeUIFailed = true;
      closeUIError = failure;
      throw failure;
    }
  }
}
function getUIFinishTail() {
  return uiTail;
}
async function finishUI(options = {}) {
  const nativeEngineAfterTail = runtime?.audio ?? null;
  let primaryError,
    primaryFailed = false;
  const tail = { status: "TAIL_INCOMPLETE_UNVERIFIED", startedAtPerformanceMs: performance.now() };
  uiTail = tail;
  tail.runtimeErrorObservations = [];
  tail.diagnosticErrors = [];
  let newRuntimeError = null;
  const boundedText = (value) => (typeof value === "string" ? value.slice(0, 512) : null);
  const observeRuntime = (stage) => {
    try {
      const error = runtime?.getSnapshot().error ?? null;
      if (error !== null && typeof error !== "string")
        throw new Error("UI_TAIL_RUNTIME_ERROR_SCHEMA");
      const observed = boundedText(error);
      tail.runtimeErrorObservations.push({
        stage,
        atPerformanceMs: performance.now(),
        error: observed,
      });
      if (observed && error !== closedUIRaw?.final?.error && newRuntimeError === null)
        newRuntimeError = observed;
    } catch (error) {
      tail.diagnosticErrors.push(boundedText(String(error)));
    }
  };
  try {
    if (Object.hasOwn(options, "abortError")) throw options.abortError;
    if (!closedUIRaw) closeUIWindow();
    const drain = (remaining) =>
      quiesceProfile({
        stopScheduling: () => {},
        isBusy: () => scriptBusy || runtime.busy || runtime.recorder.getView().pending,
        now: clock,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        timeoutMs: Math.max(1, Math.floor(remaining)),
      });
    tail.deadlinePerformanceMs = tail.startedAtPerformanceMs + 135000;
    const timing = await runProfileTail({
      drain,
      pause: () => runtime.dispatch({ type: "pause" }),
      finishRecording: () =>
        runtime.recorder.getView().recording.state === "recording"
          ? runtime.dispatch({ type: "recordToggle" })
          : undefined,
      now: clock,
      onStage: (stage) => {
        tail.stage = stage;
        observeRuntime(stage);
      },
      timeoutMs: 135000,
    });
    tail.deadlinePerformanceMs = timing.deadline;
    if (newRuntimeError !== null) throw new Error(`UI_TAIL_RUNTIME_ERROR: ${newRuntimeError}`);
    if (tail.diagnosticErrors.length) throw new Error("UI_TAIL_OBSERVATION_FAILED");
    tail.status = "TAIL_DRAINED_OUTSIDE_WINDOW";
  } catch (error) {
    primaryError = error;
    primaryFailed = true;
    tail.primaryError = String(error);
  } finally {
    observeRuntime("finally");
    try {
      if (!closedUIRaw) {
        tail.windowDataUnavailable = true;
        tail.lateActions = [];
        tail.postWindowCaptures = [];
      } else {
        const actionStart = closedUIRaw.actions.length;
        const lateCount = Math.max(0, samples.actions.length - actionStart);
        tail.lateActionsTruncated = lateCount > 4096;
        tail.lateActions = samples.actions.slice(actionStart, actionStart + 4096).map((row) => ({
          phase: boundedText(row.phase),
          atMs: Number.isFinite(row.atMs) ? row.atMs : null,
          method: boundedText(row.method),
          action: boundedText(typeof row.action === "string" ? row.action : row.action?.type),
          error: boundedText(row.error),
          simulationState: boundedText(row.simulationState),
          recordingState: boundedText(row.recordingState),
        }));
        for (const row of samples.actions.slice(actionStart, actionStart + 4096)) {
          if (
            typeof row.error === "string" &&
            row.error &&
            row.error !== closedUIRaw.final?.error &&
            newRuntimeError === null
          )
            newRuntimeError = boundedText(row.error);
        }
        const lateCaptures = samples.captureWindows.filter((row) => {
          const prior = closedUIRaw?.captureWindows?.find((value) => value.index === row.index);
          return (
            (row.end && !prior?.end) ||
            (Number.isFinite(row.end?.atMs) && row.end.atMs > closedUIRaw?.sampleMilliseconds)
          );
        });
        tail.captureSummariesTruncated = lateCaptures.length > 1024;
        tail.postWindowCaptures = lateCaptures.slice(0, 1024).map((row) => ({
          index: Number.isSafeInteger(row.index) ? row.index : null,
          endAtMs: Number.isFinite(row.end?.atMs) ? row.end.atMs : null,
          artifactStatus: boundedText(row.artifact?.status),
          outsideWindow:
            Number.isFinite(row.end?.atMs) && row.end.atMs > closedUIRaw?.sampleMilliseconds,
        }));
      }
      if ((tail.lateActionsTruncated || tail.captureSummariesTruncated) && !primaryFailed) {
        primaryFailed = true;
        primaryError = new Error("UI_TAIL_DIAGNOSTIC_CAP");
        tail.primaryError = String(primaryError);
        tail.status = "TAIL_INCOMPLETE_UNVERIFIED";
      }
    } catch (error) {
      tail.diagnosticErrors.push(boundedText(String(error)));
      if (!primaryFailed) {
        primaryFailed = true;
        primaryError = error;
        tail.primaryError = String(error);
        tail.status = "TAIL_INCOMPLETE_UNVERIFIED";
      }
    }
    tail.endedAtPerformanceMs = performance.now();
    try {
      tail.pendingAfter = {
        scriptBusy,
        runtimeBusy: runtime?.busy ?? null,
        recorderPending: runtime?.recorder.getView().pending ?? null,
      };
    } catch (error) {
      tail.diagnosticErrors.push(boundedText(String(error)));
      if (!primaryFailed) {
        primaryFailed = true;
        primaryError = error;
        tail.primaryError = String(error);
        tail.status = "TAIL_INCOMPLETE_UNVERIFIED";
      }
    }
    if ((newRuntimeError !== null || tail.diagnosticErrors.length) && !primaryFailed) {
      primaryFailed = true;
      primaryError = new Error(
        newRuntimeError !== null
          ? `UI_TAIL_RUNTIME_ERROR: ${newRuntimeError}`
          : "UI_TAIL_OBSERVATION_FAILED",
      );
      tail.primaryError = String(primaryError);
      tail.status = "TAIL_INCOMPLETE_UNVERIFIED";
    }
  }
  let cleanupFailure,
    cleanupFailed = false;
  try {
    cleanupUI(primaryFailed, primaryError);
  } catch (error) {
    cleanupFailure = error;
    cleanupFailed = true;
    tail.cleanupFailure = String(error);
  }
  try {
    tail.audioDisposal = nativeEngineAfterTail
      ? await finalizeNativeAudioAfterTailV4(nativeEngineAfterTail)
      : {
          scope: "POST_WINDOW_DISPOSAL_ONLY",
          contextClosed: null,
          disposePromiseSettled: null,
          resourceBefore: null,
          resourceAfter: null,
          resourcesReleased: null,
        };
  } catch (error) {
    tail.audioDisposalFailure = String(error);
    tail.status = "TAIL_INCOMPLETE_UNVERIFIED";
    if (cleanupFailed)
      throw new AggregateError([cleanupFailure, error], "V4_UI_AND_AUDIO_CLEANUP_FAILED");
    throw error;
  }
  if (cleanupFailed) throw cleanupFailure;
  return closedUIRaw;
}
// BEGIN_TESTABLE_PHYSICS_MAINTENANCE
export function maintainPhysicsLoad(world, tick, now, { measure = true } = {}) {
  if (typeof measure !== "boolean") throw new Error("INVALID_PHYSICS_PROBE_MODE");
  const setupStartedAt = measure ? now() : null;
  if (
    !(world.records instanceof Map) ||
    world.records.size !== 256 ||
    typeof world.applyImpulse !== "function" ||
    !Number.isSafeInteger(tick) ||
    tick < 0
  )
    throw new Error("PHYSICS_WAKE_ADAPTER_UNAVAILABLE");
  const knownIds = Array.from({ length: 255 }, (_, index) => `stress.${index}`);
  const records = knownIds.map((id) => {
    const record = world.records.get(id);
    if (
      !record ||
      !record.definition?.mode?.startsWith("dynamic") ||
      typeof record.body?.isDynamic !== "function" ||
      record.body.isDynamic() !== true ||
      typeof record.body.isSleeping !== "function" ||
      (measure && typeof record.body.isSleeping() !== "boolean") ||
      typeof record.body.wakeUp !== "function"
    )
      throw new Error("PHYSICS_WAKE_ADAPTER_UNAVAILABLE");
    return record;
  });
  const fixed = [...world.records].filter(([id]) => !knownIds.includes(id));
  if (
    new Set(records.map((record) => record.body)).size !== 255 ||
    fixed.length !== 1 ||
    fixed[0][1]?.definition?.mode !== "fixed" ||
    typeof fixed[0][1]?.body?.isFixed !== "function" ||
    fixed[0][1].body.isFixed() !== true
  )
    throw new Error("PHYSICS_WAKE_ADAPTER_UNAVAILABLE");
  const impulseStartedAt = measure ? now() : null;
  if (tick % 30 === 0)
    for (let i = 0; i < 255; i++)
      world.applyImpulse(`stress.${i}`, [Math.sin(i) * 0.001, 0.04, Math.cos(i) * 0.001]);
  const impulseMaintenanceMs = measure ? now() - impulseStartedAt : null;
  const sleepingCount = () =>
    records.reduce((sum, record) => {
      const value = record.body.isSleeping();
      if (typeof value !== "boolean") throw new Error("PHYSICS_SLEEP_QUERY_INVALID");
      return sum + Number(value);
    }, 0);
  const nativePreWakeSleepingBodies = measure ? sleepingCount() : null;
  const wakeStartedAt = measure ? now() : null;
  for (const record of records) record.body.wakeUp();
  const wakeMaintenanceMs = measure ? now() - wakeStartedAt : null;
  const nativePostWakeSleepingBodies = measure ? sleepingCount() : null;
  if (measure && nativePostWakeSleepingBodies !== 0) throw new Error("PHYSICS_WAKE_NOT_EFFECTIVE");
  const totalSetupMs = measure ? now() - setupStartedAt : null;
  if (
    measure &&
    ![impulseMaintenanceMs, wakeMaintenanceMs, totalSetupMs].every(
      (value) => Number.isFinite(value) && value >= 0,
    )
  )
    throw new Error("PHYSICS_MAINTENANCE_CLOCK_INVALID");
  return {
    tick,
    wakeCalls: records.length,
    nativePreWakeSleepingBodies,
    nativePostWakeSleepingBodies,
    impulseMaintenanceMs,
    wakeMaintenanceMs,
    totalSetupMs,
  };
}
// END_TESTABLE_PHYSICS_MAINTENANCE
async function physicsProfile(iterations = 3000) {
  const base = createDefaultScene(),
    floor = { ...base.objects[0], dimensionsM: [14, 0.2, 14] };
  const bodies = Array.from({ length: 255 }, (_, i) => ({
    ...makeBody(`stress.${i}`, i),
    positionM: [
      ((i % 15) - 7) * 0.34,
      0.4 + Math.floor(i / 225) * 0.6,
      ((Math.floor(i / 15) % 15) - 7) * 0.34,
    ],
    acousticRole: "none",
  }));
  const scene = {
    ...base,
    sceneId: "profile.physics-256",
    objects: [floor, ...bodies],
    sources: [],
  };
  const world = await PhysicsWorld.create(scene),
    native = [],
    complete = [],
    contacts = [],
    events = [],
    awakeBodies = [],
    nativePostStepSleepingBodies = [],
    loadMaintenance = [],
    completeWithLoadSetupMs = [],
    contactBodyIds = new Set();
  let ccd = 0;
  for (const [key, record] of world.records)
    if (key !== floor.id) {
      const enabled = Number(key.split(".").at(-1)) % 4 === 0;
      record.body.enableCcd(enabled);
      if (enabled) ccd++;
    }
  const actualCcdBodyCount = [...world.records.values()].filter((record) => {
    if (typeof record.body.isCcdEnabled !== "function")
      throw new Error("NATIVE_CCD_QUERY_UNAVAILABLE");
    return record.body.isCcdEnabled();
  }).length;
  if (probesEnabled) {
    const original = world.world.step.bind(world.world);
    world.world.step = (...args) => {
      const start = clock();
      const value = original(...args);
      if (native.length < iterations) native.push(clock() - start);
      return value;
    };
  }
  world.resume();
  for (let i = 0; i < 240; i++) world.step();
  native.length = 0;
  const started = clock();
  for (let tick = 0; tick < iterations; tick++) {
    const totalMeasuredStartedAt = probesEnabled ? clock() : null;
    const maintenance = maintainPhysicsLoad(world, tick, clock, { measure: probesEnabled });
    const start = probesEnabled ? clock() : null,
      snapshot = world.step();
    const completeFinishedAt = probesEnabled ? clock() : null;
    if (probesEnabled) {
      loadMaintenance.push(maintenance);
      const completeStepMs = completeFinishedAt - start;
      complete.push(completeStepMs);
      completeWithLoadSetupMs.push(completeFinishedAt - totalMeasuredStartedAt);
      contacts.push(world.pairs.size);
      for (const pair of world.pairs.values())
        for (const id of [pair.a, pair.b]) if (id.startsWith("stress.")) contactBodyIds.add(id);
      events.push(snapshot.events.length);
      awakeBodies.push(
        snapshot.poses.filter((pose) => pose.mode.startsWith("dynamic") && !pose.sleeping).length,
      );
      nativePostStepSleepingBodies.push(
        [...world.records.values()].filter(
          (record) => record.body.isDynamic() && record.body.isSleeping(),
        ).length,
      );
    }
    if (tick % 60 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const beforeStallTick = world.tick,
    stalled = world.advance(0.25);
  const after = world.snapshot();
  const result = {
    scene,
    probeMode,
    timingStatus: probesEnabled ? "OBSERVED" : "NOT_OBSERVED_PROBE_OFF",
    iterations,
    warmupSteps: 240,
    nativeStepMs: native,
    completeFixedTickMs: complete,
    contacts,
    events,
    awakeBodies,
    loadMaintenance,
    nativePostStepSleepingBodies,
    completeWithLoadSetupMs,
    loadMaintenanceScope:
      "Guarded fixture-only native wakeUp on all 255 known Dynamic bodies before every measured step, never the Fixed body. Exact prior 30-step impulse block retained. Validation/impulse/wake costs excluded from native and public-step brackets, reported separately and in total-with-setup. Native sleep counts taken before/after wake and after step; no post-step waking.",
    contactBodyIds: [...contactBodyIds].sort(),
    contactLoadMethod:
      "All 255 dynamic bodies must be observed in actual contact pairs during measured steps; per-step pair counts retained; no invented minimum concurrent-pair threshold",
    elapsedMs: clock() - started,
    ccdBodyCount: actualCcdBodyCount,
    configuredCcdBodyCount: ccd,
    fixedDtSeconds: world.fixedDtSeconds,
    maxCatchUpSteps: world.clock.maxCatchUpSteps,
    totalBodies: world.snapshot().poses.length,
    fixedBodies: world.snapshot().poses.filter((pose) => pose.mode === "fixed").length,
    dynamicBodies: world.snapshot().poses.filter((pose) => pose.mode.startsWith("dynamic")).length,
    catchupProbe: {
      beforeTick: beforeStallTick,
      steps: stalled.steps,
      afterTick: world.tick,
      droppedWallTimeSeconds: stalled.droppedWallTimeSeconds,
      overrun: stalled.overrun,
    },
    finalSleepingBodies: after.poses.filter((pose) => pose.sleeping).length,
  };
  world.dispose();
  return result;
}
function acousticRequests(tick, pathCap) {
  // A convex 30-sided room keeps first-order bounces inside the boundary. These
  // are true finite solver surfaces, not duplicated paths invented for delivery.
  const boundary = Array.from({ length: 30 }, (_, i) => [
    6 * Math.cos((i * 2 * Math.PI) / 30),
    0,
    6 * Math.sin((i * 2 * Math.PI) / 30),
  ]);
  const surfaces = boundary.map((a, i) => {
    const b = boundary[(i + 1) % boundary.length];
    return {
      id: `room.side.${i}`,
      verticesM: [a, b, [b[0], 4, b[2]], [a[0], 4, a[2]]],
      materialId: "material.hard",
      twoSided: true,
      role: "staticReflector",
    };
  });
  surfaces.push(
    {
      id: "room.floor",
      verticesM: boundary,
      materialId: "material.hard",
      twoSided: true,
      role: "staticReflector",
    },
    {
      id: "room.ceiling",
      verticesM: boundary.map((p) => [p[0], 4, p[2]]),
      materialId: "material.hard",
      twoSided: true,
      role: "staticReflector",
    },
  );
  return Array.from({ length: 8 }, (_, i) => ({
    requestId: `profile.acoustic.${tick}.${i}`,
    sceneRevision: 0,
    geometryRevision: 0,
    poseTick: tick,
    topologyId: "profile.room-32-surfaces",
    source: {
      id: `profile.source.${i}`,
      positionM: [Math.cos(i) * 0.25 + Math.sin(tick / 100) * 0.1, 1.3, Math.sin(i) * 0.25],
    },
    listener: { id: "listener", positionM: [0.05, 1.7, 0.1] },
    surfaces,
    materials: [DEFAULT_MATERIALS[0]],
    atmosphere: { medium: "air", speedOfSoundMps: 343, dataClass: "Synthetic" },
    budget: { maxSurfaces: 32, maxPaths: pathCap, maxSegmentTests: 16384 },
  }));
}
let solverEngine = null;
let solverPathCap = 8;
let solverNativeStarts = [];
let solverAudioResourceObservationAtEnableV4 = null;
function configureSolverProfile(pathCap) {
  if (![8, 32].includes(pathCap) || solverEngine) throw new Error("SOLVER_PROFILE_CONFIGURATION");
  solverPathCap = pathCap;
  solverNativeStarts = [];
  solverAudioResourceObservationAtEnableV4 = null;
  delete document.getElementById("solver-enable-audio").dataset.ready;
}
async function enableSolverAudio() {
  solverEngine ??= new AudioEngine({
    ...solverAudioPolicyOptionsV4(),
    ...(solverPathCap === 32 ? { budget: { maxTotalPaths: 256, maxPathsPerVoice: 32 } } : {}),
    monitorGain: 0.05,
  });
  await solverEngine.enable(0);
  solverEngine.setDiagnosticsEnabled(probesEnabled);
  instrumentNativeStarts(solverEngine.context, solverNativeStarts);
  solverEngine.setMuted(true);
  solverEngine.updateListener({ positionM: [0.05, 1.7, 0.1], forward: [0, 0, -1], up: [0, 1, 0] });
  const telemetry = solverEngine.getTelemetry();
  solverAudioResourceObservationAtEnableV4 = {
    telemetry,
    resourceSnapshot:
      typeof solverEngine.getNativeResourceSnapshot === "function"
        ? solverEngine.getNativeResourceSnapshot()
        : null,
  };
  return telemetry;
}
function getAudioPolicyWitnessV4(target) {
  if (!["ui", "solver"].includes(target)) throw new Error("INVALID_AUDIO_POLICY_WITNESS_TARGET");
  const observation =
    target === "ui"
      ? uiAudioResourceObservationAtEnableV4
      : solverAudioResourceObservationAtEnableV4;
  return {
    ...verifyNativeAudioResourcePolicyV4({
      requestedArm: window.__performanceProfileConfig?.audioPolicyArm ?? "reference",
      pathCap: target === "ui" ? 8 : solverPathCap,
      telemetry: observation?.telemetry ?? null,
      resourceSnapshot: observation?.resourceSnapshot ?? null,
    }),
    stage: "AFTER_ENABLE_BEFORE_WARMUP",
    observation,
  };
}
function nativeRouteState(engine, solutions) {
  if (
    !(engine.voices instanceof Map) ||
    !(engine.frames instanceof Map) ||
    !(engine.retiring instanceof Set) ||
    !(engine.retiredRoutes instanceof Set) ||
    !(engine.retiredLateRoutes instanceof Set)
  )
    throw new Error("NATIVE_GRAPH_ADAPTER_UNAVAILABLE");
  const expected = new Map(solutions.map(({ frame }) => [frame.sourceId, frame]));
  const voices = [...engine.voices.values()].map((voice) => {
    const frame = expected.get(voice.input.sourceId);
    const cached = engine.frames.get(voice.input.sourceId);
    if (!(voice.routes instanceof Map)) throw new Error("NATIVE_GRAPH_ROUTES_UNAVAILABLE");
    return {
      sourceId: voice.input.sourceId,
      instanceId: voice.input.instanceId,
      active: voice.active,
      sourceStopped: voice.sourceStopped,
      internalArrival: voice.internalArrival,
      wantedPathIds: frame?.paths.map((path) => path.id).sort() ?? [],
      currentPathIds: [...voice.routes.keys()].sort(),
      expectedRequestId: frame?.requestId ?? null,
      cachedRequestId: cached?.requestId ?? null,
      expectedPoseTick: frame?.poseTick ?? null,
      framePoseTick: cached?.poseTick ?? null,
      routesConnected: [...voice.routes].every(
        ([id, route]) => route.id === id && route.connected === true,
      ),
      lateRouteCount: Number(Boolean(voice.lateRoute)),
    };
  });
  return {
    adapter:
      "Read-only native engine bookkeeping; cached poseTick is not a per-route update timestamp",
    voices,
    activeCurrentRouteCount: voices.reduce((sum, voice) => sum + voice.currentPathIds.length, 0),
    retiringCurrentRouteCount: [...engine.retiring].reduce(
      (sum, voice) => sum + voice.routes.size,
      0,
    ),
    activeLateRouteCount: voices.reduce((sum, voice) => sum + voice.lateRouteCount, 0),
    retiringLateRouteCount: [...engine.retiring].filter((voice) => voice.lateRoute).length,
    retiredRouteCount: engine.retiredRoutes.size,
    retiredLateRouteCount: engine.retiredLateRoutes.size,
    retiringVoiceCount: engine.retiring.size,
  };
}
// BEGIN_TESTABLE_NATIVE_DELIVERY
export async function measureNativeDelivery(service, requests, consume, now) {
  if (
    typeof service.receive !== "function" ||
    typeof now !== "function" ||
    !Array.isArray(requests) ||
    requests.length < 1 ||
    requests.length > 8
  )
    throw new Error("NATIVE_DELIVERY_ADAPTER_UNAVAILABLE");
  const identities = requests.map((request) => ({
    requestId: request.requestId,
    sourceId: request.source?.id ?? request.sourceId,
    poseTick: request.poseTick,
  }));
  const originalReceive = service.receive;
  let observation = null;
  service.receive = function (port, reply) {
    const enteredAtMs = now();
    const pending = this.pending;
    let matchedThisCall = false;
    if (
      port === this.worker &&
      pending &&
      reply?.batchId === pending.id &&
      Array.isArray(pending.requests) &&
      pending.requests.length === identities.length &&
      pending.requests.every((request, index) => {
        const expected = identities[index];
        return (
          request.requestId === expected.requestId &&
          request.sourceId === expected.sourceId &&
          request.poseTick === expected.poseTick
        );
      }) &&
      observation === null
    ) {
      observation = {
        batchId: pending.id,
        requestIdentities: identities,
        receiveEntryAtMs: enteredAtMs,
      };
      matchedThisCall = true;
    }
    try {
      return originalReceive.call(this, port, reply);
    } finally {
      if (matchedThisCall) observation.receiveExitAtMs = now();
    }
  };
  try {
    const solutions = await service.solve(requests);
    const awaitContinuationAtMs = now();
    if (
      !observation ||
      !Array.isArray(solutions) ||
      solutions.length !== identities.length ||
      !solutions.every(
        ({ frame }, index) =>
          frame &&
          frame.requestId === identities[index].requestId &&
          frame.sourceId === identities[index].sourceId &&
          frame.poseTick === identities[index].poseTick,
      )
    )
      throw new Error("NATIVE_DELIVERY_IDENTITY_NOT_OBSERVED");
    const result = consume(solutions);
    if (result && typeof result.then === "function")
      throw new Error("NATIVE_DELIVERY_ASYNC_CONSUMER");
    const consumerFinishedAtMs = now();
    const times = [
      observation.receiveEntryAtMs,
      observation.receiveExitAtMs,
      awaitContinuationAtMs,
      consumerFinishedAtMs,
    ];
    if (
      !times.every(
        (time, index) => Number.isFinite(time) && (index === 0 || time >= times[index - 1]),
      )
    )
      throw new Error("NATIVE_DELIVERY_CLOCK_INVALID");
    return {
      solutions,
      delivery: {
        ...observation,
        awaitContinuationAtMs,
        consumerFinishedAtMs,
        durationMs: consumerFinishedAtMs - observation.receiveEntryAtMs,
        scope:
          "Actual matching AcousticService.receive entry through await continuation, fixture telemetry bookkeeping and final synchronous native-engine consumer; excludes browser pre-handler deserialization/OS dispatch and unrelated LabRuntime bookkeeping",
      },
    };
  } finally {
    service.receive = originalReceive;
  }
}
// END_TESTABLE_NATIVE_DELIVERY
async function acousticProfile(iterations = 600) {
  const service = new AcousticService(),
    measurements = [],
    started = clock(),
    admissions = [],
    warmupRaw = [],
    baselineNativeAudio = solverEngine.getTelemetry(),
    baselineAudioDiagnostics = probesEnabled ? solverEngine.getDiagnostics() : null;
  let measurementBaselineNativeAudio = null,
    measurementBaselineAudioDiagnostics = null,
    result = null,
    primaryError,
    primaryFailed = false;
  let begin = null;
  try {
    for (let tick = 0; tick < iterations + 20; tick++) {
      const updateStart = probesEnabled ? clock() : null;
      let telemetry, consumerMs;
      const requests = acousticRequests(tick, solverPathCap);
      const consume = (solutions) => {
        if (probesEnabled) telemetry = service.getTelemetry();
        const deliveryStart = probesEnabled ? clock() : null;
        for (const solution of solutions) solverEngine?.updateFrame(solution.frame);
        if (tick === 0 && solverEngine) {
          for (const solution of solutions) {
            const admission = solverEngine.playVoice(
              {
                instanceId: solution.frame.sourceId,
                sourceId: solution.frame.sourceId,
                generator: { kind: "oscillator", waveform: "sine", frequencyHz: 110 },
                gainLinear: 0.02,
                pitchSemitones: 0,
                emissionTimeSeconds: 0,
                continuous: true,
                fadeInSeconds: 0.01,
                fadeOutSeconds: 0.02,
              },
              solution.frame,
            );
            admissions.push({ sourceId: solution.frame.sourceId, ...admission });
          }
        }
        consumerMs = probesEnabled ? clock() - deliveryStart : null;
      };
      let solutions, delivery;
      if (probesEnabled) {
        ({ solutions, delivery } = await measureNativeDelivery(service, requests, consume, clock));
      } else {
        solutions = await service.solve(requests);
        consume(solutions);
      }
      if (tick === 20) begin = clock();
      if (probesEnabled) {
        const completedAtMs = clock() - started;
        const row = {
          tick,
          submittedAtMs: updateStart - started,
          completedAtMs,
          scheduledAtMs: tick * 50,
          submissionLateMs: updateStart - (started + tick * 50),
          deadlineMissed: completedAtMs > (tick + 1) * 50,
          roundTripMs: telemetry.lastRoundTripMs,
          workerComputeMs: telemetry.lastWorkerComputeMs,
          serviceDeliveryMs: telemetry.lastDeliveryHandlerMs,
          audioConsumerMs: consumerMs,
          totalDeliveryMs:
            Number.isFinite(consumerMs) && Number.isFinite(telemetry.lastDeliveryHandlerMs)
              ? consumerMs + telemetry.lastDeliveryHandlerMs
              : null,
          observedDelivery: delivery,
          receiveThroughNativeConsumersMs: delivery.durationMs,
          returnedPaths: solutions.reduce((sum, value) => sum + value.frame.paths.length, 0),
          segmentTests: solutions.reduce((sum, value) => sum + value.diagnostics.segmentTests, 0),
          bytes: { request: telemetry.lastRequestBytes, response: telemetry.lastResponseBytes },
          budgetExceeded: solutions.some((value) => value.diagnostics.budgetExceeded),
          solverDiagnostics: solutions.map((value) => ({
            sourceId: value.frame.sourceId,
            ...value.diagnostics,
          })),
          routeState: nativeRouteState(solverEngine, solutions),
          audioDiagnostics: probesEnabled ? (solverEngine?.getDiagnostics() ?? null) : null,
          nativeAudio: solverEngine
            ? {
                ...solverEngine.getTelemetry(),
                currentTimeSeconds: solverEngine.context.currentTime,
              }
            : null,
        };
        (tick >= 20 ? measurements : warmupRaw).push(row);
      }
      if (tick === 19) {
        measurementBaselineNativeAudio = solverEngine.getTelemetry();
        measurementBaselineAudioDiagnostics = probesEnabled ? solverEngine.getDiagnostics() : null;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, started + (tick + 1) * 50 - clock())),
      );
    }
    result = {
      probeMode,
      timingStatus: probesEnabled ? "OBSERVED" : "NOT_OBSERVED_PROBE_OFF",
      iterations,
      warmupBatches: 20,
      targetHz: 20,
      sourceCount: 8,
      surfacesPerSource: 32,
      maxPathsPerBatch: 256,
      requestedPathCapPerVoice: solverPathCap,
      nativeGraphTargetPaths: 8 * solverPathCap,
      maxReflectionOrder: 1,
      fixture:
        "Convex 30-sided room plus floor/ceiling; 32 actual finite boundary surfaces; first-order numerical approximation, seven Synthetic bands",
      elapsedMs: clock() - begin,
      raw: measurements,
      admissions,
      baselineNativeAudio,
      baselineAudioDiagnostics,
      measurementBaselineNativeAudio,
      measurementBaselineAudioDiagnostics,
      warmupRaw,
      nativeStarts: solverNativeStarts,
      telemetry: service.getTelemetry(),
      nativeAudio: solverEngine?.getTelemetry() ?? null,
      nativeResourceSnapshotAtClose:
        typeof solverEngine?.getNativeResourceSnapshot === "function"
          ? solverEngine.getNativeResourceSnapshot()
          : null,
      audioResourceEndpointScope: "SHARED_ACTIVE_ENDPOINT_AFTER_LAST_SCHEDULED_BATCH_NOT_DSP_CPU",
      audioDiagnostics: probesEnabled ? (solverEngine?.getDiagnostics() ?? null) : null,
    };
    return result;
  } catch (error) {
    primaryError = error;
    primaryFailed = true;
    throw error;
  } finally {
    const closingEngine = solverEngine,
      cleanupErrors = [];
    try {
      service.dispose();
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await closingEngine?.drainVoices();
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      const proof = await finalizeNativeAudioAfterTailV4(closingEngine);
      if (result) result.audioDisposal = proof;
    } catch (error) {
      cleanupErrors.push(error);
    }
    solverEngine = null;
    if (cleanupErrors.length) {
      const errors = primaryFailed ? [primaryError, ...cleanupErrors] : cleanupErrors;
      throw errors.length === 1
        ? errors[0]
        : new AggregateError(errors, "V4_SOLVER_AND_AUDIO_CLEANUP_FAILED");
    }
  }
}

window.__performanceFixture = {
  mountUI,
  beginUI,
  finishUI,
  closeUIWindow,
  getUIFinishTail,
  physicsProfile,
  acousticProfile,
  enableSolverAudio,
  configureSolverProfile,
  getAudioPolicyWitnessV4,
  verifyNativeAudioResourcePolicyV4,
  warmupUI,
  environment,
  progress: () => ({
    elapsedMs: startedAt === null ? null : clock() - startedAt,
    frames: samples.frame.size,
    tick: runtime?.getSnapshot().tick ?? null,
    state: runtime?.getSnapshot().simulationState ?? null,
    error: runtime?.getSnapshot().error ?? null,
    audio: runtime?.audio?.getTelemetry() ?? null,
  }),
};
window.__performanceReady = true;
document.getElementById("solver-enable-audio").onclick = async () => {
  await enableSolverAudio();
  document.getElementById("solver-enable-audio").dataset.ready = "true";
};
