/* global window, document, navigator, performance, AudioContext, AudioWorkletNode, Blob, URL, setTimeout, clearTimeout, setInterval, clearInterval */
import * as AudioRuntime from "../../src/audio/index.ts";
const AudioEngine = AudioRuntime.AudioEngine;
import { solveAcoustics } from "../../src/acoustics/index.ts";
import { DEFAULT_MATERIALS } from "../../src/app/defaults.ts";

const CASES = Object.freeze([
  "steady",
  "main-stall",
  "late-onset",
  "stale-frame",
  "path-churn",
  "voice-path-budget",
  "digital-gap",
]);
const CAPTURE_SECONDS = 3;
let result = null,
  busy = false,
  activeProbe = null,
  cancelActive = null,
  downloadUrl = null,
  rawPcmUrl = null;
const byId = (id) => document.getElementById(id);
function optional(context, key) {
  try {
    const value = Reflect.get(context, key);
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}
function optionalString(context, key) {
  try {
    const value = Reflect.get(context, key);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}
function wall() {
  return performance.now();
}
function wallRequest(sourceId, tick, surfaces = [], maxPaths = 8) {
  return {
    requestId: `pcm-probe.${sourceId}.${tick}`,
    sceneRevision: 0,
    geometryRevision: tick,
    poseTick: tick,
    topologyId: "performance-pcm-controlled-v1",
    source: { id: sourceId, positionM: [0, 0, -1] },
    listener: { id: "listener", positionM: [0, 0, 0] },
    surfaces,
    materials: [DEFAULT_MATERIALS[0]],
    atmosphere: { medium: "air", speedOfSoundMps: 343, dataClass: "Synthetic" },
    budget: { maxSurfaces: 32, maxPaths, maxSegmentTests: 16384 },
  };
}
function reflectedWall() {
  return [
    {
      id: "probe.wall",
      verticesM: [
        [1.5, -2, -2],
        [1.5, 2, -2],
        [1.5, 2, 2],
        [1.5, -2, 2],
      ],
      materialId: "material.hard",
      twoSided: true,
      role: "staticReflector",
    },
  ];
}
function stressRoom() {
  const floor = Array.from({ length: 30 }, (_, i) => [
    6 * Math.cos((i * 2 * Math.PI) / 30),
    -2,
    6 * Math.sin((i * 2 * Math.PI) / 30),
  ]);
  return [
    ...floor.map((a, i) => {
      const b = floor[(i + 1) % floor.length];
      return {
        id: `probe.room.${i}`,
        verticesM: [a, b, [b[0], 2, b[2]], [a[0], 2, a[2]]],
        materialId: "material.hard",
        twoSided: true,
        role: "staticReflector",
      };
    }),
    {
      id: "probe.floor",
      verticesM: floor,
      materialId: "material.hard",
      twoSided: true,
      role: "staticReflector",
    },
    {
      id: "probe.ceiling",
      verticesM: floor.map((p) => [p[0], 2, p[2]]),
      materialId: "material.hard",
      twoSided: true,
      role: "staticReflector",
    },
  ];
}
function voice(instanceId, sourceId, overrides = {}) {
  return {
    instanceId,
    sourceId,
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 110 },
    gainLinear: 0.2,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
    priority: 100,
    ...overrides,
  };
}
function wav(pcm, rate, channels, frames) {
  if (!(pcm instanceof ArrayBuffer) || pcm.byteLength !== frames * channels * 4)
    throw new RangeError("PCM byte length must equal the declared capture frame/channel count");
  const bytes = new ArrayBuffer(56 + frames * channels * 4),
    view = new DataView(bytes);
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 4, true);
  view.setUint16(32, channels * 4, true);
  view.setUint16(34, 32, true);
  text(36, "fact");
  view.setUint32(40, 4, true);
  view.setUint32(44, frames, true);
  text(48, "data");
  view.setUint32(52, frames * channels * 4, true);
  new Uint8Array(bytes, 56).set(new Uint8Array(pcm));
  return bytes;
}
async function runCase(caseId, probeMode, audioModel) {
  if (
    !CASES.includes(caseId) ||
    !["on", "off"].includes(probeMode) ||
    !["nativeReference", "nativeCarrierRoutes"].includes(audioModel) ||
    busy
  )
    throw new Error("INVALID_OR_BUSY_DIAGNOSTIC_CASE");
  busy = true;
  result = null;
  byId("download").disabled = true;
  byId("download-pcm").disabled = true;
  if (rawPcmUrl) {
    URL.revokeObjectURL(rawPcmUrl);
    rawPcmUrl = null;
  }
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
  let context = null,
    engine = null;
  const actions = [],
    telemetry = [],
    timers = [];
  let interval = null,
    sink = null,
    dropout = null,
    capture = null,
    cancelled = false,
    resolveCancel;
  const cancelledPromise = new Promise((resolve) => {
    resolveCancel = resolve;
  });
  const caseDeadlineWallMs = wall() + 12000;
  async function stage(label, start) {
    if (cancelled) throw new Error("CONTROLLED_CASE_CANCELLED");
    const remaining = caseDeadlineWallMs - wall();
    if (remaining <= 0) throw new Error(`CONTROLLED_CASE_DEADLINE:${label}`);
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(start),
        cancelledPromise.then(() => {
          throw new Error("CONTROLLED_CASE_CANCELLED");
        }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`CONTROLLED_CASE_DEADLINE:${label}`)),
            remaining,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  const caseResult = {
    schemaVersion: "1.0.0",
    method: "controlled-native-audio-pcm-v1",
    caseId,
    probeMode,
    probeScope: {
      comparedIncrement:
        "PCM_WORKLET_AND_PERIODIC_ENGINE_DIAGNOSTICS_PLUS_SETUP_ENCODING_REPORT_COST",
      commonBothModes:
        "Bounded control action journal, timer entry timestamps, before/after native endpoints and unity control GainNode",
      fullyObserverFreeFormalRun: false,
    },
    audioModel,
    status: "RUNNING",
    actions,
    telemetry,
    formalPerformance: "NOT_RUN",
    hardwareHearing: "NOT_RUN",
    nativeDspCpuMs: null,
    hardwareBufferFrames: null,
    physicalRoute: null,
    physicalAudibility:
      "Runner must pin browser --mute-audio; digital engine graph remains unmuted",
  };
  const record = (label, detail = {}) => {
    if (actions.length >= 64) throw new Error("CONTROLLED_ACTION_CAP");
    actions.push({ label, wallMs: wall(), audioSeconds: context.currentTime, ...detail });
  };
  const schedule = (label, at, operation) => {
    const scheduledAtWallMs = wall(),
      scheduledAtAudioSeconds = context.currentTime;
    const delayMs = Math.max(0, (at - scheduledAtAudioSeconds) * 1000);
    const requestedWallDeadlineMs = scheduledAtWallMs + delayMs;
    timers.push(
      setTimeout(() => {
        const handlerEnteredWallMs = wall(),
          handlerEnteredAudioSeconds = context.currentTime;
        const operationStartedWallMs = wall();
        try {
          const value = operation();
          const operationFinishedWallMs = wall();
          record(label, {
            scheduledAudioSeconds: at,
            scheduledAtWallMs,
            scheduledAtAudioSeconds,
            requestedWallDeadlineMs,
            handlerEnteredWallMs,
            handlerEnteredAudioSeconds,
            timerDispatchRelativeToRequestedWallDeadlineMs:
              handlerEnteredWallMs - requestedWallDeadlineMs,
            audioDeadlineDeltaMs: (handlerEnteredAudioSeconds - at) * 1000,
            operationStartedWallMs,
            operationFinishedWallMs,
            synchronousOperationWallDurationMs: operationFinishedWallMs - operationStartedWallMs,
            scope:
              "Timer dispatch observation and synchronous operation wall duration are separate; neither is native DSP CPU or OS pre-handler cost",
            result: value ?? null,
          });
        } catch (error) {
          caseResult.controlError = String(error?.stack ?? error);
        }
      }, delayMs),
    );
  };
  cancelActive = () => {
    cancelled = true;
    try {
      activeProbe?.port.postMessage({ kind: "cancel" });
    } catch (error) {
      caseResult.cancelTransportError = String(error);
    } finally {
      resolveCancel();
    }
  };
  try {
    context = new AudioContext({ latencyHint: "playback" });
    const policy = Reflect.get(AudioRuntime, "DEFAULT_NATIVE_VOICE_POLICY");
    if (audioModel === "nativeCarrierRoutes" && !policy)
      throw new Error("CARRIER_CANDIDATE_UNSUPPORTED_POLICY_EXPORT");
    if (
      audioModel === "nativeCarrierRoutes" &&
      (policy.maxNativeVoices !== 24 || policy.maxNativeGraphs !== 48)
    )
      throw new Error("CARRIER_CANDIDATE_CAPACITY_CONTRACT_CHANGED");
    const requestedOptions = {
      context,
      bufferPreset: "playback",
      monitorGain: 0.05,
      diagnosticsEnabled: probeMode === "on",
      virtualization: audioModel === "nativeCarrierRoutes" ? policy : false,
      oscillatorModel: "nativeReference",
    };
    engine = new AudioEngine(requestedOptions);
    caseResult.sourceConfiguration = {
      oscillatorModel: "nativeReference",
      virtualization: audioModel === "nativeCarrierRoutes" ? structuredClone(policy) : false,
      requestedResourceRepresentation: audioModel,
      candidateAdoption:
        audioModel === "nativeCarrierRoutes" ? "NATIVE_VALIDATION_PENDING_NOT_ADOPTED" : null,
      referenceBudgetSource:
        "original-audio-budget.json at productBase e25f9f4; actual before/after budget retained",
    };
    await stage("enable", () => engine.enable(0));
    if (cancelled) throw new Error("CONTROLLED_CASE_CANCELLED");
    if (audioModel === "nativeCarrierRoutes") {
      const actual = engine.getTelemetry();
      if (
        [actual.activeRenderedCap, actual.nativeGraphBudget, actual.nativeCarrierBudget].some(
          (value) => typeof value !== "number",
        )
      )
        throw new Error("CARRIER_CANDIDATE_UNSUPPORTED_CAPACITY_OBSERVATION");
      if (
        actual.activeRenderedCap !== 24 ||
        actual.nativeGraphBudget !== 48 ||
        actual.nativeCarrierBudget !== 176 ||
        actual.internalArrivalGraphBudget !== 96 ||
        actual.nativeGraphTotalBudget !== 144
      )
        throw new Error("CARRIER_CANDIDATE_ACTUAL_CAPACITY_CONTRACT_CHANGED");
    }
    engine.setMuted(false);
    engine.updateListener({ positionM: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] });
    const quantum = optional(context, "renderQuantumSize");
    caseResult.audioCapabilities = {
      sampleRate: context.sampleRate,
      contextState: context.state,
      browserReportedRenderQuantumFrames:
        Number.isSafeInteger(quantum) && quantum > 0 ? quantum : null,
      renderQuantumPropertyPresent: Reflect.has(context, "renderQuantumSize"),
      quantumScope: "BROWSER_CONTEXT_PROPERTY_NOT_HARDWARE_BLOCK_OR_WORKLET_OBSERVATION",
      baseLatencySeconds: optional(context, "baseLatency"),
      outputLatencySeconds: optional(context, "outputLatency"),
      latencyScope: "BROWSER_API_REPORT_NOT_CALIBRATED_END_TO_EAR_LATENCY",
      playbackStatsPropertyPresent: Reflect.has(context, "playbackStats"),
      audioWorkletPropertyPresent: Reflect.has(context, "audioWorklet"),
      sinkId: optionalString(context, "sinkId"),
      actualPhysicalDeviceRoute: null,
    };
    if (probeMode === "on" && typeof context.audioWorklet?.addModule !== "function")
      throw new Error("PCM_DIAGNOSTIC_WORKLET_UNSUPPORTED");
    if (probeMode === "on")
      await stage("worklet-module", () =>
        context.audioWorklet.addModule(new URL("./performance-pcm-probe-v1.js", import.meta.url)),
      );
    if (cancelled) throw new Error("CONTROLLED_CASE_CANCELLED");
    const rate = context.sampleRate;
    const epochFrame = Math.ceil((context.currentTime + 0.25) * rate);
    const epochSeconds = epochFrame / rate;
    engine.setEpoch(0, epochSeconds);
    const lookahead = engine.getTelemetry().schedulingLookaheadSeconds;
    const startFrame = epochFrame + Math.round((lookahead + 0.5) * rate),
      frameCount = Math.round(CAPTURE_SECONDS * rate),
      endFrame = startFrame + frameCount;
    caseResult.timeline = {
      epochFrame,
      epochSeconds,
      schedulingLookaheadSeconds: lookahead,
      expectedPrimaryOnsetAudioSeconds: epochSeconds + lookahead,
      startFrame,
      endFrame,
      frameCount,
      sampleRate: rate,
      channelCount: 2,
    };
    // Explicit test-only adapter. Both probe modes insert the same unity control node.
    const masterOutput = engine.safetyClip ?? engine.limiter ?? engine.muteGain;
    if (
      !masterOutput ||
      masterOutput.context !== context ||
      typeof masterOutput.disconnect !== "function"
    )
      throw new Error("CONTROLLED_MASTER_ADAPTER_UNAVAILABLE");
    dropout = context.createGain();
    dropout.gain.value = 1;
    masterOutput.disconnect(context.destination);
    masterOutput.connect(dropout);
    dropout.connect(context.destination);
    caseResult.outputAdapter = {
      scope: "SAME_AUDIOENGINE_POST_MASTER_SIGNAL",
      selectedNode: engine.safetyClip ? "safetyClip" : engine.limiter ? "limiter" : "muteGain",
      unityControlPresentInBothModes: true,
    };
    if (probeMode === "on") {
      activeProbe = new AudioWorkletNode(context, "reflection-performance-pcm-probe-v1", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: "explicit",
        processorOptions: { startFrame, frameCount, channelCount: 2 },
      });
      sink = context.createGain();
      sink.gain.value = 0;
      dropout.connect(activeProbe);
      activeProbe.connect(sink);
      sink.connect(context.destination);
      capture = new Promise((resolve, reject) => {
        activeProbe.port.onmessage = (event) => resolve(event.data);
        activeProbe.onprocessorerror = () => reject(new Error("PCM_PROCESSOR_ERROR"));
        timers.push(
          setTimeout(
            () => reject(new Error("PCM_CAPTURE_TIMEOUT")),
            Math.ceil((endFrame / rate - context.currentTime) * 1000) + 2000,
          ),
        );
      });
      capture.catch(() => {});
    }
    const request = wallRequest("probe.source", 0),
      solution = solveAcoustics(request),
      frame = solution.frame;
    caseResult.solverInput = request;
    caseResult.solver = solution;
    caseResult.beforeTelemetry = engine.getTelemetry();
    caseResult.beforeDiagnostics = probeMode === "on" ? engine.getDiagnostics() : null;
    const admission = engine.playVoice(voice("probe.primary", "probe.source"), frame);
    record("primary-voice", { admission });
    caseResult.primaryStartStillFutureAtReturn = context.currentTime < epochSeconds + lookahead;
    if (!admission.accepted || !caseResult.primaryStartStillFutureAtReturn)
      throw new Error("CONTROLLED_PRIMARY_NOT_FUTURE_OR_ADMITTED");
    const controlTime = startFrame / rate + 1;
    if (caseId === "main-stall")
      schedule("main-stall-150ms", controlTime, () => {
        const before = { wallMs: wall(), audioSeconds: context.currentTime },
          until = wall() + 150;
        while (wall() < until) {
          /* bounded intentional main-thread stall */
        }
        return { before, after: { wallMs: wall(), audioSeconds: context.currentTime } };
      });
    if (caseId === "late-onset")
      schedule("backdated-real-emission", controlTime, () => {
        const late = solveAcoustics(wallRequest("probe.late", 0));
        return engine.playVoice(
          voice("probe.late.voice", "probe.late", {
            generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
            gainLinear: 0.05,
            continuous: false,
            durationSeconds: 0.2,
            emissionTimeSeconds: 0,
          }),
          late.frame,
        );
      });
    if (caseId === "stale-frame")
      schedule("real-audio-consumer-stale-refusal", controlTime, () =>
        engine.updateFrame({ ...frame, requestId: "probe.deliberately-stale", stale: true }),
      );
    if (caseId === "path-churn") {
      schedule("solver-path-birth", controlTime, () => {
        const next = solveAcoustics(wallRequest("probe.source", 1, reflectedWall()));
        caseResult.birthSolution = next;
        return engine.updateFrame(next.frame);
      });
      schedule("solver-path-death", controlTime + 0.5, () => {
        const next = solveAcoustics(wallRequest("probe.source", 2));
        caseResult.deathSolution = next;
        return engine.updateFrame(next.frame);
      });
    }
    if (caseId === "voice-path-budget")
      schedule("original-voice-and-path-budget-pressure", controlTime, () => {
        const pressure = solveAcoustics(wallRequest("probe.source", 1, stressRoom(), 32));
        caseResult.pressureSolution = pressure;
        engine.updateFrame(pressure.frame);
        const admissions = [];
        for (let i = 0; i < 36; i++)
          admissions.push(
            engine.playVoice(
              voice(`probe.pressure.${i}`, "probe.source", {
                generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
                gainLinear: 0.002,
                continuous: false,
                durationSeconds: 0.3,
                emissionTimeSeconds: controlTime - epochSeconds - lookahead,
                priority: 0,
              }),
              pressure.frame,
            ),
          );
        return admissions;
      });
    if (caseId === "digital-gap") {
      const gapStartFrame = startFrame + Math.round(rate),
        gapEndFrame = gapStartFrame + Math.round(rate * 0.1);
      dropout.gain.setValueAtTime(0, gapStartFrame / rate);
      dropout.gain.setValueAtTime(1, gapEndFrame / rate);
      caseResult.injectedGap = {
        kind: "INTENTIONAL_POST_MASTER_DIGITAL_SILENCE_NOT_A_PRODUCT_UNDERRUN",
        startFrame: gapStartFrame,
        endFrame: gapEndFrame,
      };
    }
    if (probeMode === "on")
      interval = setInterval(() => {
        if (telemetry.length >= 32) {
          caseResult.telemetryOverflow = true;
          return;
        }
        telemetry.push({
          wallMs: wall(),
          audioSeconds: context.currentTime,
          diagnostics: engine.getDiagnostics(),
          native: engine.getTelemetry(),
        });
      }, 500);
    caseResult.windowWaitStartedWallMs = wall();
    let packet = null;
    if (capture) packet = await stage("capture", () => capture);
    else
      await stage(
        "probe-off-audio-window",
        () =>
          new Promise((resolve) => {
            timers.push(
              setTimeout(resolve, Math.max(0, (endFrame / rate - context.currentTime) * 1000)),
            );
          }),
      );
    caseResult.audioEndGuardRetries = 0;
    while (
      !cancelled &&
      context.currentTime * rate < endFrame &&
      caseResult.audioEndGuardRetries < 32
    ) {
      caseResult.audioEndGuardRetries++;
      if (context.state !== "running") throw new Error("CONTROLLED_CONTEXT_NOT_RUNNING_AT_END");
      await new Promise((resolve) =>
        timers.push(
          setTimeout(
            resolve,
            Math.max(1, Math.min(50, (endFrame / rate - context.currentTime) * 1000)),
          ),
        ),
      );
    }
    if (!cancelled && context.currentTime * rate < endFrame)
      throw new Error("CONTROLLED_AUDIO_END_NOT_REACHED");
    caseResult.windowWaitEndedWallMs = wall();
    caseResult.afterTelemetry = engine.getTelemetry();
    caseResult.nativeResourceSnapshot =
      typeof engine.getNativeResourceSnapshot === "function"
        ? engine.getNativeResourceSnapshot()
        : null;
    caseResult.observedSourceContentModel =
      caseResult.nativeResourceSnapshot?.sourceContentModel ?? null;
    caseResult.afterDiagnostics = probeMode === "on" ? engine.getDiagnostics() : null;
    caseResult.actualContextTimeAtEndSeconds = context.currentTime;
    if (packet) {
      const { pcm, ...metadata } = packet;
      caseResult.capture = metadata;
      if (pcm instanceof ArrayBuffer) {
        const rawBlob = new Blob([pcm], { type: "application/octet-stream" });
        rawPcmUrl = URL.createObjectURL(rawBlob);
        byId("download-pcm").disabled = false;
        caseResult.rawPcm = {
          bytes: pcm.byteLength,
          format: "IEEE_FLOAT32_LE_INTERLEAVED",
          normalized: false,
        };
        const encoded = wav(pcm, rate, 2, frameCount);
        const blob = new Blob([encoded], { type: "audio/wav" });
        downloadUrl = URL.createObjectURL(blob);
        byId("download").disabled = false;
        caseResult.wav = {
          bytes: blob.size,
          frames: frameCount,
          channels: 2,
          sampleRate: rate,
          format: "IEEE_FLOAT32_LE",
          normalized: false,
          knownPoolPlusEncodingBytes: pcm.byteLength + encoded.byteLength,
        };
      }
    } else
      caseResult.capture = {
        status: cancelled ? "CANCELLED" : "NOT_OBSERVED_PROBE_OFF",
        pcm: null,
        nativeDspCpuMs: null,
        hardwareUnderrunEvents: null,
      };
    caseResult.status = cancelled
      ? "CANCELLED"
      : caseResult.controlError ||
          caseResult.telemetryOverflow ||
          (probeMode === "on" && caseResult.capture.status !== "COMPLETE")
        ? "FAILED"
        : probeMode === "on"
          ? "CAPTURED_DIGITAL_ONLY"
          : "PROBE_OFF_COMPLETED";
  } catch (error) {
    caseResult.status = cancelled
      ? "CANCELLED"
      : String(error?.message ?? error).startsWith("CARRIER_CANDIDATE_UNSUPPORTED")
        ? "UNSUPPORTED_CANDIDATE"
        : "FAILED";
    caseResult.error = String(error?.stack ?? error);
  } finally {
    if (interval !== null) clearInterval(interval);
    for (const timer of timers) clearTimeout(timer);
    const cleanupErrors = [];
    for (const [label, close] of [
      ["probe", () => activeProbe?.disconnect()],
      ["sink", () => sink?.disconnect()],
      ["dropout", () => dropout?.disconnect()],
      ["engine", () => engine?.dispose()],
    ]) {
      try {
        close();
      } catch (error) {
        cleanupErrors.push({ label, error: String(error) });
      }
    }
    caseResult.cleanupErrors = cleanupErrors;
    let closeTimer = null;
    try {
      if (context) {
        await Promise.race([
          context.close(),
          new Promise((_, reject) => {
            closeTimer = setTimeout(() => reject(new Error("CONTEXT_CLOSE_TIMEOUT")), 2000);
          }),
        ]);
        caseResult.contextClosed = context.state === "closed";
      } else caseResult.contextClosed = null;
    } catch (error) {
      caseResult.cleanupError = String(error);
      caseResult.status = "FAILED";
    } finally {
      if (closeTimer !== null) clearTimeout(closeTimer);
    }
    if (caseResult.cleanupErrors.length) caseResult.status = "FAILED";
    if (cancelled) {
      if (rawPcmUrl) {
        URL.revokeObjectURL(rawPcmUrl);
        rawPcmUrl = null;
      }
      byId("download-pcm").disabled = true;
      delete caseResult.rawPcm;
      caseResult.status =
        caseResult.cleanupErrors.length || caseResult.cleanupError ? "FAILED" : "CANCELLED";
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
      }
      byId("download").disabled = true;
      if (caseResult.wav) {
        caseResult.discardedWav = caseResult.wav;
        caseResult.wav = null;
      }
    }
    activeProbe = null;
    cancelActive = null;
    busy = false;
  }
  caseResult.userAgent = navigator.userAgent;
  result = caseResult;
  return result;
}
byId("start").onclick = async () => {
  byId("start").disabled = true;
  byId("cancel").disabled = false;
  byId("status").dataset.state = "running";
  byId("status").textContent = "Running bounded native audio diagnostic";
  const observed = await runCase(
    byId("case").value,
    byId("probe-mode").value,
    byId("audio-model").value,
  );
  byId("summary").textContent = JSON.stringify(observed, null, 2);
  byId("status").dataset.state = "terminal";
  byId("status").textContent = observed.status;
  byId("start").disabled = false;
  byId("cancel").disabled = true;
  if (typeof window.__audioAttributionTerminal === "function")
    await window.__audioAttributionTerminal(observed);
};
byId("cancel").onclick = () => cancelActive?.();
byId("download").onclick = () => {
  if (!downloadUrl || !result?.wav) throw new Error("NO_CAPTURED_PCM");
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `${result.caseId}-${result.probeMode}-pcm.wav`;
  anchor.click();
};
window.__audioAttribution = { cases: CASES, result: () => result, busy: () => busy };
window.__audioAttributionReady = true;

byId("download-pcm").addEventListener("click", () => {
  if (!rawPcmUrl || !result?.rawPcm) return;
  const link = document.createElement("a");
  link.href = rawPcmUrl;
  link.download = `${result.caseId}-${result.probeMode}.float32le.pcm`;
  link.click();
});
