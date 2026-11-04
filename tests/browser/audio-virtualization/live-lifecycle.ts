import { AudioEngine } from "../../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../../src/audio/types.js";

const CASE_MS = 6000;
const CLEANUP_MS = 3000;

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function near(actual: number, expected: number, tolerance: number, label: string): void {
  requireCondition(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} != ${expected} (tolerance ${tolerance})`,
  );
}

async function bounded<T>(operation: Promise<T>, deadline: number, label: string): Promise<T> {
  const remaining = deadline - performance.now();
  if (remaining <= 0) {
    void operation.catch(() => undefined);
    throw new Error(`${label}_DEADLINE`);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_DEADLINE`)), remaining);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function until(predicate: () => boolean, deadline: number, label: string): Promise<void> {
  // Explicit wall deadline and iteration cap; never an interval or audio callback.
  for (let count = 0; count < 2000; count++) {
    if (performance.now() >= deadline) throw new Error(`${label}_DEADLINE`);
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 4));
  }
  throw new Error(`${label}_POLL_BUDGET`);
}

function frame(sourceId: string): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: `native-live-${sourceId}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "native-live-lifecycle",
    backendVersion: "1",
    sourceId,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0,
    paths: [
      {
        id: `${sourceId}-direct`,
        sourceId,
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 1,
        absoluteDelayS: 0,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [1],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["NATIVE_CLOCK_AND_NODE_LIFECYCLE_ONLY_NOT_PCM_OR_HEARING"],
  };
}

interface SourceObservation {
  node: AudioBufferSourceNode | OscillatorNode;
  kind: "sample" | "oscillator";
  starts: { args: number[]; audioTimeSeconds: number }[];
  stops: { args: number[]; audioTimeSeconds: number }[];
  endedAudioTimes: number[];
  listener: () => void;
}

/** Called directly by the runner's trusted page click; creates its own native device context. */
export async function runNativeLiveLifecycle() {
  const started = performance.now();
  const deadline = started + CASE_MS;
  const OriginalContext = window.AudioContext;
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, "AudioContext");
  const contexts: AudioContext[] = [];
  const sources: SourceObservation[] = [];
  const endedIds: string[] = [];
  const activationAtEntry = navigator.userActivation?.isActive ?? null;
  let engine: AudioEngine | null = null;
  let mainError: string | null = null;
  let cleanupError: string | null = null;
  let mainComplete = false;
  let cleanupComplete = false;
  let qualification: {
    sampleRate: number;
    quantumFrames: number | null;
    state: string;
    quantumStatus: "AVAILABLE" | "NOT_AVAILABLE";
  } | null = null;
  let pauseObservation: unknown = null;
  let resumeObservation: unknown = null;
  let futureObservation: unknown = null;
  let finalObservation: unknown = null;
  let pcmSha256: string | null = null;

  function observe<T extends AudioBufferSourceNode | OscillatorNode>(
    node: T,
    kind: SourceObservation["kind"],
  ): T {
    requireCondition(sources.length < 8, "NATIVE_SOURCE_OBSERVATION_BUDGET");
    const record: SourceObservation = {
      node,
      kind,
      starts: [],
      stops: [],
      endedAudioTimes: [],
      listener: () => undefined,
    };
    const nativeStart = node.start;
    const nativeStop = node.stop;
    Object.defineProperty(node, "start", {
      configurable: true,
      writable: true,
      value: function (this: AudioScheduledSourceNode, ...args: number[]) {
        requireCondition(record.starts.length < 8, "NATIVE_START_OBSERVATION_BUDGET");
        record.starts.push({ args: [...args], audioTimeSeconds: this.context.currentTime });
        Reflect.apply(nativeStart, this, args);
      },
    });
    Object.defineProperty(node, "stop", {
      configurable: true,
      writable: true,
      value: function (this: AudioScheduledSourceNode, ...args: number[]) {
        requireCondition(record.stops.length < 16, "NATIVE_STOP_OBSERVATION_BUDGET");
        record.stops.push({ args: [...args], audioTimeSeconds: this.context.currentTime });
        Reflect.apply(nativeStop, this, args);
      },
    });
    record.listener = () => {
      // Local native observation only; never dispatches a behavior/recording event.
      if (record.endedAudioTimes.length < 8) record.endedAudioTimes.push(node.context.currentTime);
    };
    node.addEventListener("ended", record.listener);
    sources.push(record);
    return node;
  }

  try {
    requireCondition(typeof OriginalContext === "function", "NATIVE_AUDIO_CONTEXT_UNAVAILABLE");
    requireCondition(activationAtEntry === true, "TRUSTED_USER_ACTIVATION_REQUIRED");
    class ObservedContext extends OriginalContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.push(this);
      }
      override createBufferSource(): AudioBufferSourceNode {
        return observe(super.createBufferSource(), "sample");
      }
      override createOscillator(): OscillatorNode {
        return observe(super.createOscillator(), "oscillator");
      }
    }
    window.AudioContext = ObservedContext;
    engine = new AudioEngine({
      // Deliberately omit context: AudioEngine owns and must close the real device.
      bufferPreset: "playback",
      oscillatorModel: "nativeReference",
      diagnosticsEnabled: false,
      budget: { maxVoices: 1 },
      virtualization: {
        maxNativeVoices: 1,
        maxNativeCarriers: 4,
        maxVirtualVoices: 3,
        minResidenceSeconds: 0.2,
        priorityHysteresis: 0.1,
        fairnessSeconds: 30,
      },
      onVoiceEnded: (id) => {
        if (endedIds.length < 8) endedIds.push(id);
      },
    });
    engine.setMuted(true);
    await bounded(engine.enable(0), deadline, "ENABLE");
    requireCondition(contexts.length === 1, "EXPECTED_ONE_OWNED_NATIVE_CONTEXT");
    const context = contexts[0]!;
    const reportedQuantum = (context as AudioContext & { renderQuantumSize?: number })
      .renderQuantumSize;
    const quantum =
      typeof reportedQuantum === "number" &&
      Number.isSafeInteger(reportedQuantum) &&
      reportedQuantum > 0
        ? reportedQuantum
        : null;
    qualification = {
      sampleRate: context.sampleRate,
      quantumFrames: quantum,
      state: context.state,
      quantumStatus: quantum === null ? "NOT_AVAILABLE" : "AVAILABLE",
    };
    requireCondition(
      Number.isFinite(context.sampleRate) && context.sampleRate > 0,
      "NATIVE_SAMPLE_RATE_INVALID",
    );
    requireCondition(quantum !== null, "NATIVE_RENDER_QUANTUM_NOT_AVAILABLE");
    requireCondition(String(context.state) === "running", "NATIVE_CONTEXT_NOT_RUNNING");
    requireCondition(engine.getTelemetry().muted, "MASTER_MUST_REMAIN_MUTED");
    const epsilon = 2 / context.sampleRate;
    const buffer = context.createBuffer(1, Math.round(context.sampleRate), context.sampleRate);
    const pcm = buffer.getChannelData(0);
    for (let n = 0; n < pcm.length; n++)
      pcm[n] = 0.1 * Math.sin((2 * Math.PI * 173 * n) / context.sampleRate);
    const digestInput = new ArrayBuffer(pcm.byteLength);
    new Float32Array(digestInput).set(pcm);
    const hash = await bounded(
      crypto.subtle.digest("SHA-256", digestInput),
      deadline,
      "ASSET_HASH",
    );
    pcmSha256 = [...new Uint8Array(hash)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    engine.registerBuffer("native-live-pcm", buffer, {
      name: "Original muted native lifecycle sine",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: pcmSha256,
    });
    engine.setEpoch(0);
    const input = (id: string, future = false, shot = false): VoiceInput => ({
      instanceId: id,
      sourceId: id,
      generator: {
        kind: "sample",
        asset: { assetId: "native-live-pcm", revision: 1, sha256: pcmSha256! },
        loop: !shot,
        startOffsetSeconds: shot ? buffer.duration - 0.08 : 0,
      },
      gainLinear: 0.25,
      pitchSemitones: 0,
      emissionTimeSeconds: future ? 0.6 : 0,
      continuous: !shot,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      priority: 1,
    });
    for (const inputVoice of [
      input("loop"),
      input("future", true),
      input("near-pause-shot", false, true),
    ])
      requireCondition(
        engine.playVoice(inputVoice, frame(inputVoice.sourceId)).accepted,
        `ADMISSION_FAILED_${inputVoice.instanceId}`,
      );
    requireCondition(
      sources.length === 3 && sources.every((record) => record.starts.length === 1),
      "EXPECTED_THREE_ORIGINAL_NATIVE_STARTS",
    );
    const [loop, future, shot] = sources as [
      SourceObservation,
      SourceObservation,
      SourceObservation,
    ];
    const loopOnset = loop.starts[0]!.args[0]!;
    const futureOnset = future.starts[0]!.args[0]!;
    const shotOnset = shot.starts[0]!.args[0]!;
    const shotEnd = shotOnset + buffer.duration - shot.starts[0]!.args[1]!;
    const beforeResources = engine.getNativeResourceSnapshot();
    requireCondition(
      beforeResources.mode === "nativeCarrierRoutes" &&
        beforeResources.sourceContentModel === "nativeReference",
      "NATIVE_REFERENCE_CARRIER_MODEL_REQUIRED",
    );
    requireCondition(
      beforeResources.nativeSourceNodes === 3 && engine.getTelemetry().activeVoices === 1,
      "LOW_RENDER_CAP_MUST_KEEP_THREE_REAL_CARRIERS",
    );
    near(futureOnset - loopOnset, 0.6, epsilon, "original future native onset");
    await until(() => context.currentTime >= shotEnd - 0.012, deadline, "WAIT_NEAR_SHOT_END");
    requireCondition(
      context.currentTime < shotEnd && shot.endedAudioTimes.length === 0,
      "SHOT_EXHAUSTED_BEFORE_PAUSE_CALL",
    );
    const logicalPauseTime = Math.max(0, context.currentTime - loopOnset);
    await bounded(engine.pause(logicalPauseTime), deadline, "PAUSE");
    requireCondition(String(context.state) === "suspended", "PAUSE_DID_NOT_SUSPEND_REAL_CONTEXT");
    const audit = engine.getTelemetry().pauseClockAudit;
    requireCondition(
      audit?.transportPolicy === "sameContextCarrier" && audit.nativeSuspendAudioSeconds !== null,
      "ACTUAL_SUSPEND_AUDIT_REQUIRED",
    );
    near(audit.logicalCutoffSimulationSeconds, logicalPauseTime, epsilon, "logical call cutoff");
    near(
      audit.nativeSuspendAudioSeconds,
      context.currentTime,
      epsilon,
      "actual suspended native clock",
    );
    requireCondition(
      audit.nativeSuspendAudioSeconds >= shotEnd,
      "SHOT_DID_NOT_EXHAUST_DURING_FADE_ADVANCE",
    );
    await until(
      () =>
        shot.endedAudioTimes.length === 1 &&
        engine!.getVoiceCursorState("near-pause-shot", logicalPauseTime) === null,
      deadline,
      "WAIT_NATURAL_SHOT_END_DELIVERY",
    );
    requireCondition(
      endedIds.filter((id) => id === "near-pause-shot").length === 1,
      "SHOT_COMPLETION_MUST_BE_OBSERVED_ONCE",
    );
    const pausedCursor = engine.getVoiceCursorState("loop", logicalPauseTime);
    requireCondition(
      pausedCursor !== null && pausedCursor.nativeAudioTimeSeconds !== null,
      "ACTUAL_PAUSED_CURSOR_AUDIT_REQUIRED",
    );
    near(
      pausedCursor.nativeAudioTimeSeconds,
      context.currentTime,
      epsilon,
      "paused native observation time",
    );
    pauseObservation = {
      audit,
      logicalPauseTime,
      contextState: context.state,
      cursor: pausedCursor,
      resources: engine.getNativeResourceSnapshot(),
      nativeShotEnd: shotEnd,
      shotLifetimePolicy: "legacyInitialRateFiniteCutoff;nativeEndedObserved",
    };
    requireCondition(
      engine.getTelemetry().nativeSourceNodes === 2,
      "EXHAUSTED_VIRTUAL_SHOT_MUST_RELEASE_NATIVE_OWNERSHIP",
    );
    requireCondition(
      await bounded(engine.resume(logicalPauseTime), deadline, "RESUME"),
      "RESUME_REJECTED",
    );
    requireCondition(String(context.state) === "running", "RESUME_DID_NOT_RUN_REAL_CONTEXT");
    requireCondition(
      sources.length === 3 && sources.every((record) => record.starts.length === 1),
      "RESUME_RECREATED_OR_RESTARTED_A_NATIVE_SOURCE",
    );
    requireCondition(
      loop.stops.length === 0 && future.stops.length === 0,
      "ORDINARY_PAUSE_STOPPED_RETAINED_CONTENT",
    );
    const resumedCursor = engine.getVoiceCursorState("loop", logicalPauseTime);
    requireCondition(
      resumedCursor !== null && resumedCursor.nativeAudioTimeSeconds !== null,
      "ACTUAL_RESUMED_CURSOR_AUDIT_REQUIRED",
    );
    near(
      resumedCursor.cursor.elapsedSinceEmissionSeconds,
      resumedCursor.nativeAudioTimeSeconds - loopOnset,
      epsilon,
      "resumed cursor uses actual native clock without a second lookahead",
    );
    const resumedPosition =
      (pausedCursor.cursor.playheadSeconds +
        resumedCursor.nativeAudioTimeSeconds -
        pausedCursor.nativeAudioTimeSeconds) %
      buffer.duration;
    const phaseDifference = Math.abs(resumedCursor.cursor.playheadSeconds - resumedPosition);
    near(
      Math.min(phaseDifference, buffer.duration - phaseDifference),
      0,
      epsilon,
      "only actual post-suspend native advance changes the retained unit-rate loop phase",
    );
    const resumedFuture = engine
      .getNativeResourceSnapshot()
      .sources.find((source) => source.instanceId === "future");
    requireCondition(resumedFuture !== undefined, "FUTURE_CARRIER_WAS_LOST");
    near(resumedFuture.startedAudioTime, futureOnset, epsilon, "future native deadline retained");
    resumeObservation = {
      contextState: context.state,
      cursor: resumedCursor,
      resources: engine.getNativeResourceSnapshot(),
      futureNativeOnset: resumedFuture.startedAudioTime,
    };
    await until(
      () => context.currentTime >= futureOnset + 0.04,
      deadline,
      "WAIT_ORIGINAL_FUTURE_ONSET",
    );
    const logicalNow = logicalPauseTime + context.currentTime - audit.nativeSuspendAudioSeconds;
    const futureCursor = engine.getVoiceCursorState("future", logicalNow);
    requireCondition(
      futureCursor !== null && futureCursor.nativeAudioTimeSeconds !== null,
      "FUTURE_NATIVE_CLOCK_AUDIT_REQUIRED",
    );
    near(
      futureCursor.cursor.elapsedSinceEmissionSeconds,
      futureCursor.nativeAudioTimeSeconds - futureOnset,
      epsilon,
      "future source follows original native onset",
    );
    requireCondition(
      sources.length === 3 && sources.every((record) => record.starts.length === 1),
      "LATE_SHOT_REPLAY_OR_SOURCE_RECREATION",
    );
    requireCondition(
      shot.node.onended === null && Number(shot.endedAudioTimes.length) === 1,
      "EXPIRED_SHOT_HANDLER_OR_DUPLICATE_END",
    );
    futureObservation = {
      contextState: context.state,
      cursor: futureCursor,
      futureNativeOnset: futureOnset,
      resources: engine.getNativeResourceSnapshot(),
    };
    mainComplete = true;
  } catch (error) {
    mainError = String(error);
  } finally {
    const cleanupDeadline = performance.now() + CLEANUP_MS;
    try {
      if (engine) await bounded(engine.disposeAsync(), cleanupDeadline, "DISPOSE_CLOSE");
      requireCondition(
        contexts.every((context) => context.state === "closed"),
        "OWNED_NATIVE_CONTEXT_NOT_CLOSED",
      );
      requireCondition(
        engine === null || engine.getTelemetry().nativeSourceNodes === 0,
        "DISPOSE_RETAINED_NATIVE_SOURCES",
      );
      requireCondition(
        sources.every((record) => record.node.onended === null),
        "DISPOSE_RETAINED_NATIVE_END_HANDLER",
      );
      finalObservation = {
        contextStates: contexts.map((context) => context.state),
        telemetry: engine?.getTelemetry() ?? null,
        resources: engine?.getNativeResourceSnapshot() ?? null,
      };
      cleanupComplete = true;
    } catch (error) {
      cleanupError = String(error);
      finalObservation = {
        contextStates: contexts.map((context) => context.state),
        telemetry: engine?.getTelemetry() ?? null,
      };
    } finally {
      for (const record of sources) record.node.removeEventListener("ended", record.listener);
      if (originalDescriptor) Object.defineProperty(window, "AudioContext", originalDescriptor);
      else window.AudioContext = OriginalContext;
    }
  }
  return {
    id: "native-owned-live-carrier-lifecycle",
    passed: mainComplete && cleanupComplete,
    status: mainComplete && cleanupComplete ? "PASS" : "FAIL",
    mainError,
    cleanupError,
    method:
      "trusted-page-click;owned-native-AudioContext;muted-master;bounded-control-observations",
    scope:
      "native clock/node identity/start/deadline/disposal only; not PCM equivalence or hearing",
    caseDeadlineMilliseconds: CASE_MS,
    cleanupDeadlineMilliseconds: CLEANUP_MS,
    elapsedWallMilliseconds: performance.now() - started,
    activationAtEntry,
    actualSampleRate: qualification?.sampleRate ?? null,
    actualQuantumFrames: qualification?.quantumFrames ?? null,
    qualification,
    pcmSha256,
    pauseObservation,
    resumeObservation,
    futureObservation,
    finalObservation,
    endedIds: [...endedIds],
    sourceObservations: sources.map((record, index) => ({
      localNodeIdentity: index + 1,
      kind: record.kind,
      starts: record.starts,
      stops: record.stops,
      endedAudioTimes: record.endedAudioTimes,
      finalOnendedNull: record.node.onended === null,
    })),
  };
}
