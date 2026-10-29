/* global window, document, navigator, performance, requestAnimationFrame, cancelAnimationFrame, innerWidth, innerHeight, devicePixelRatio, PerformanceObserver, setTimeout */
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
import { AudioEngine } from "../../src/audio/index.ts";

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
window.requestAnimationFrame = (callback) =>
  nativeRAF((timestamp) => {
    const callbackObservedAtPerformanceMs = clock();
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
        });
      }
    }
    const start = clock();
    try {
      callback(timestamp);
    } finally {
      if (measuring) {
        const frame = samples.frame.get(timestamp);
        if (frame) {
          frame.rafCpuMs += clock() - start;
          frame.callbacks++;
        }
      }
    }
  });
window.cancelAnimationFrame = nativeCancelRAF;

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
async function action(value, method = "LabRuntime.dispatch") {
  const start = clock();
  const phase = measuring ? "measured" : warmingUp ? "warmup" : "cold";
  const before = clockState();
  await runtime.dispatch(value);
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
  runtime = await LabRuntime.create();
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
  interpolationObservation = instrumentInterpolationMethods(
    runtime.world,
    clock,
    () => measuring,
    append,
  );
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
  mounted = await mountReflectionLab(document.getElementById("root"), {
    createRuntime: async () => runtime,
  });
  document.getElementById("profile-enable-audio").onclick = async () => {
    await runtime.dispatch({ type: "enableAudio" });
    if (
      runtime.getSnapshot().error ||
      !runtime.audio?.getTelemetry().enabled ||
      runtime.audio.context.state !== "running"
    )
      throw new Error(`NATIVE_AUDIO_ENABLE_FAILED: ${runtime.getSnapshot().error}`);
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
    schemaVersion: "2.0.0",
    collectionId,
    beginMarkName,
    endMarkName,
    beginPerformanceMs: startedAt,
    endPerformanceMs: null,
    observationClock: "performance.now at RAF wrapper entry",
    nativeRafTimestampMeaning:
      "Preserved callback argument; may precede collection begin even when the callback is observed inside the active collection",
  };
  startedAtTick = runtime.world.tick;
  measurementStartedClock = clockState();
  lastActionAt = -Infinity;
  captureTimesMs = durationSeconds >= 600 ? [10_000, 300_000, 580_000] : [1000];
  nextCapture = 0;
  measuring = true;
  if (
    typeof PerformanceObserver === "function" &&
    PerformanceObserver.supportedEntryTypes.includes("longtask")
  ) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) append(samples.longTasks, entry.toJSON());
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
    nativeStartsBefore: samples.nativeStarts.length,
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
    nativeStartsAfter: samples.nativeStarts.length,
    audioClockAfter: runtime.audio.context.currentTime,
    audioAfter: runtime.audio.getTelemetry(),
    advances: samples.warmupAdvances,
    error: runtime.getSnapshot().error,
  });
  return warmup;
}
async function finishUI() {
  const measuredEndAt = performance.mark(collectionWindow.endMarkName).startTime;
  collectionWindow.endPerformanceMs = measuredEndAt;
  const measuredEndTick = runtime.world.tick;
  const measuredEndClock = clockState();
  measuring = false;
  if (scriptFrameHandle !== null) nativeCancelRAF(scriptFrameHandle);
  observer?.disconnect();
  const deadline = clock() + 5000;
  while (scriptBusy || runtime.busy || runtime.recorder.getView().pending) {
    if (clock() >= deadline) throw new Error("PROFILE_SCRIPT_DID_NOT_QUIESCE");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await runtime.dispatch({ type: "pause" });
  if (runtime.recorder.getView().recording.state === "recording")
    await runtime.dispatch({ type: "recordToggle" });
  const final = runtime.getSnapshot(),
    audio = runtime.audio?.getTelemetry() ?? null;
  const result = {
    startedAtPerformanceMs: startedAt,
    sampleMilliseconds: measuredEndAt - startedAt,
    collectionWindow,
    startedAtTick,
    measuredEndTick,
    captureScheduleMs: captureTimesMs,
    scene: runtime.getSceneDocument(),
    final,
    audio,
    audioTelemetry: samples.audioTelemetry,
    nativeStarts: samples.nativeStarts,
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
        advanceCount: advances.length,
        overrunCount: advances.filter((sample) => sample.overrun).length,
        pausedAdvanceCount: advances.filter((sample) => sample.before.paused || sample.after.paused)
          .length,
        maxAccumulatorSeconds: Math.max(
          0,
          ...advances.map((sample) => sample.after.accumulatorSeconds),
        ),
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
    interpolationMs: interpolationObservation.ms,
    interpolationCalls: interpolationObservation.calls,
    interpolationObservation: {
      requiredMethod: interpolationObservation.requiredMethod,
      observedMethods: interpolationObservation.observedMethods,
      calls: interpolationObservation.calls,
      successfulCalls: interpolationObservation.successfulCalls,
      failedCalls: interpolationObservation.failedCalls,
      byMethod: interpolationObservation.byMethod,
      aggregateScope: interpolationObservation.aggregateScope,
    },
    poseCalls: samples.poseCalls,
    longTasks: samples.longTasks,
    actions: samples.actions,
    droppedSamples: samples.droppedSamples,
    longTaskSupported:
      typeof PerformanceObserver === "function" &&
      PerformanceObserver.supportedEntryTypes.includes("longtask"),
  };
  mounted.dispose();
  mounted = null;
  runtime = null;
  return result;
}
// BEGIN_TESTABLE_PHYSICS_MAINTENANCE
export function maintainPhysicsLoad(world, tick, now) {
  const setupStartedAt = now();
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
      typeof record.body.isSleeping() !== "boolean" ||
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
  const impulseStartedAt = now();
  if (tick % 30 === 0)
    for (let i = 0; i < 255; i++)
      world.applyImpulse(`stress.${i}`, [Math.sin(i) * 0.001, 0.04, Math.cos(i) * 0.001]);
  const impulseMaintenanceMs = now() - impulseStartedAt;
  const sleepingCount = () =>
    records.reduce((sum, record) => {
      const value = record.body.isSleeping();
      if (typeof value !== "boolean") throw new Error("PHYSICS_SLEEP_QUERY_INVALID");
      return sum + Number(value);
    }, 0);
  const nativePreWakeSleepingBodies = sleepingCount();
  const wakeStartedAt = now();
  for (const record of records) record.body.wakeUp();
  const wakeMaintenanceMs = now() - wakeStartedAt;
  const nativePostWakeSleepingBodies = sleepingCount();
  if (nativePostWakeSleepingBodies !== 0) throw new Error("PHYSICS_WAKE_NOT_EFFECTIVE");
  const totalSetupMs = now() - setupStartedAt;
  if (
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
  const original = world.world.step.bind(world.world);
  world.world.step = (...args) => {
    const start = clock();
    const value = original(...args);
    if (native.length < iterations) native.push(clock() - start);
    return value;
  };
  world.resume();
  for (let i = 0; i < 240; i++) world.step();
  native.length = 0;
  const started = clock();
  for (let tick = 0; tick < iterations; tick++) {
    const totalMeasuredStartedAt = clock();
    const maintenance = maintainPhysicsLoad(world, tick, clock);
    loadMaintenance.push(maintenance);
    const start = clock(),
      snapshot = world.step();
    const completeFinishedAt = clock();
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
    if (tick % 60 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const beforeStallTick = world.tick,
    stalled = world.advance(0.25);
  const after = world.snapshot();
  const result = {
    scene,
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
function configureSolverProfile(pathCap) {
  if (![8, 32].includes(pathCap) || solverEngine) throw new Error("SOLVER_PROFILE_CONFIGURATION");
  solverPathCap = pathCap;
  solverNativeStarts = [];
  delete document.getElementById("solver-enable-audio").dataset.ready;
}
async function enableSolverAudio() {
  solverEngine ??= new AudioEngine({
    ...(solverPathCap === 32 ? { budget: { maxTotalPaths: 256, maxPathsPerVoice: 32 } } : {}),
    monitorGain: 0.05,
  });
  await solverEngine.enable(0);
  instrumentNativeStarts(solverEngine.context, solverNativeStarts);
  solverEngine.setMuted(true);
  solverEngine.updateListener({ positionM: [0.05, 1.7, 0.1], forward: [0, 0, -1], up: [0, 1, 0] });
  return solverEngine.getTelemetry();
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
    baselineNativeAudio = solverEngine.getTelemetry();
  let measurementBaselineNativeAudio = null;
  let begin = null;
  try {
    for (let tick = 0; tick < iterations + 20; tick++) {
      const updateStart = clock();
      let telemetry, consumerMs;
      const { solutions, delivery } = await measureNativeDelivery(
        service,
        acousticRequests(tick, solverPathCap),
        (solutions) => {
          telemetry = service.getTelemetry();
          const deliveryStart = clock();
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
          consumerMs = clock() - deliveryStart;
        },
        clock,
      );
      if (tick === 20) begin = clock();
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
        totalDeliveryMs: consumerMs + (telemetry.lastDeliveryHandlerMs ?? 0),
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
        nativeAudio: solverEngine
          ? { ...solverEngine.getTelemetry(), currentTimeSeconds: solverEngine.context.currentTime }
          : null,
      };
      (tick >= 20 ? measurements : warmupRaw).push(row);
      if (tick === 19) measurementBaselineNativeAudio = solverEngine.getTelemetry();
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, started + (tick + 1) * 50 - clock())),
      );
    }
    const result = {
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
      measurementBaselineNativeAudio,
      warmupRaw,
      nativeStarts: solverNativeStarts,
      telemetry: service.getTelemetry(),
      nativeAudio: solverEngine?.getTelemetry() ?? null,
    };
    return result;
  } finally {
    service.dispose();
    try {
      await solverEngine?.drainVoices();
    } finally {
      solverEngine?.dispose();
      solverEngine = null;
    }
  }
}

window.__performanceFixture = {
  mountUI,
  beginUI,
  finishUI,
  physicsProfile,
  acousticProfile,
  enableSolverAudio,
  configureSolverProfile,
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
