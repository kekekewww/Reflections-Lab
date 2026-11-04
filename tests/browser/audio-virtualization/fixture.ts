import { runNativeLiveLifecycle } from "./live-lifecycle.js";
import { createNativePartialJournal } from "./partial-results.mjs";
import { AudioEngine } from "../../../src/audio/engine.js";
import type { AcousticFrame, SoundGenerator, VoiceInput } from "../../../src/audio/types.js";

const sampleRate = 48000;
const journal = createNativePartialJournal<Record<string, unknown>>({
  sampleRate,
  frames: sampleRate * 2,
});
Object.defineProperty(window, "__audioVirtualizationPartial", {
  get: () => journal.snapshot(),
  enumerable: true,
});
const policy = {
  maxNativeVoices: 1,
  maxNativeGraphs: 1,
  maxNativeCarriers: 8,
  maxVirtualVoices: 2,
  minResidenceSeconds: 0.2,
  priorityHysteresis: 0.1,
  fairnessSeconds: 30,
};
function frame(sourceId: string): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: sourceId,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "native-phase-oracle",
    backendVersion: "1",
    sourceId,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: [],
    modelClass: "numericalApproximation",
    directDelayS: 0,
    paths: [],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["DIGITAL_DRY_PHASE_ONLY_NOT_HEARING_OR_COMPLETE_DSP_HISTORY"],
  };
}
async function render(generator: SoundGenerator, virtualized: boolean, expandedPause = false) {
  const nativeSources: AudioScheduledSourceNode[] = [];
  let assetPcmSha256: string | null = null;
  const nativeStarts: { source: number; when: number; offset: number | null }[] = [];
  const context = new OfflineAudioContext(1, sampleRate * 2, sampleRate);
  const createOscillator = context.createOscillator.bind(context);
  context.createOscillator = () => {
    const node = createOscillator(),
      source = nativeSources.push(node);
    const start = node.start.bind(node);
    node.start = (when = 0) => {
      nativeStarts.push({ source, when, offset: null });
      start(when);
    };
    return node;
  };
  const createBufferSource = context.createBufferSource.bind(context);
  context.createBufferSource = () => {
    const node = createBufferSource(),
      source = nativeSources.push(node);
    const start = node.start.bind(node);
    node.start = (when = 0, offset = 0, duration?: number) => {
      nativeStarts.push({ source, when, offset });
      if (duration === undefined) start(when, offset);
      else start(when, offset, duration);
    };
    return node;
  };
  const engine = new AudioEngine({
    context,
    budget: { maxVoices: 1 },
    virtualization: virtualized ? policy : false,
    oscillatorModel: "nativeReference",
    offlineOutputTap: "dryContent",
    diagnosticsEnabled: false,
  });
  let rendering: Promise<AudioBuffer> | null = null;
  const pendingSuspensions: Promise<void>[] = [];
  try {
    await engine.enable(0);
    if (generator.kind === "sample") {
      const buffer = context.createBuffer(1, sampleRate, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = Math.sin((2 * Math.PI * 173 * i) / sampleRate);
      const digestBytes = new ArrayBuffer(data.byteLength);
      new Float32Array(digestBytes).set(data);
      const digest = await crypto.subtle.digest("SHA-256", digestBytes);
      assetPcmSha256 = [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
      generator = { ...generator, asset: { ...generator.asset, sha256: assetPcmSha256 } };
      engine.registerBuffer("phase-pcm", buffer, {
        name: "Original phase sine",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: assetPcmSha256,
      });
    }
    const input = (instanceId: string, selected: SoundGenerator, gain = 1): VoiceInput => ({
      instanceId,
      sourceId: instanceId,
      generator: selected,
      gainLinear: gain,
      pitchSemitones: 0,
      emissionTimeSeconds: 0,
      continuous: true,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      priority: 1,
    });
    if (virtualized)
      engine.playVoice(
        input("blocker", { kind: "oscillator", waveform: "sine", frequencyHz: 100 }, 0),
        frame("blocker"),
      );
    const admission = engine.playVoice(input("signal", generator), frame("signal"));
    const checkpoints = expandedPause ? [0.25, 0.3, 0.5, 0.75, 0.9] : [0.25, 0.5, 0.75];
    const actualTimes: number[] = [];
    const checkpointsState: unknown[] = [];
    const pauseState: {
      requested: number;
      actual: number;
      before: unknown;
      paused: unknown;
      resumed: unknown;
      audit: unknown;
      sameNativeSourcesAndStarts: boolean;
      cursorStable: boolean;
      actualBoundaryRecorded: boolean;
    }[] = [];
    const quantum = (context as OfflineAudioContext & { renderQuantumSize?: number })
      .renderQuantumSize;
    const suspensions = checkpoints.map((time) => context.suspend(time));
    pendingSuspensions.push(...suspensions);
    rendering = context.startRendering();
    for (let i = 0; i < suspensions.length; i++) {
      await suspensions[i];
      const requested = checkpoints[i]!;
      if ([0.25, 0.5, 0.75].includes(requested)) actualTimes.push(context.currentTime);
      if (requested === 0.25)
        engine.updateVoice("signal", { pitchSemitones: 12, smoothingSeconds: 0.1 });
      if (requested === 0.5 && virtualized) engine.stopVoice("blocker", 0);
      if (requested === 0.75) engine.serviceNativeVoices();
      if (expandedPause && virtualized && (requested === 0.3 || requested === 0.9)) {
        const nodes = [...nativeSources],
          starts = nativeStarts.length;
        const before = engine.getVoiceCursorState("signal", context.currentTime);
        await engine.pause(context.currentTime);
        const paused = engine.getVoiceCursorState("signal", context.currentTime);
        const audit = engine.getTelemetry().pauseClockAudit;
        await engine.resume(context.currentTime);
        const resumed = engine.getVoiceCursorState("signal", context.currentTime);
        pauseState.push({
          requested,
          actual: context.currentTime,
          before,
          paused,
          resumed,
          audit,
          sameNativeSourcesAndStarts:
            nodes.length === nativeSources.length &&
            nodes.every((node, index) => node === nativeSources[index]) &&
            starts === nativeStarts.length,
          cursorStable:
            before !== null &&
            paused !== null &&
            resumed !== null &&
            before.cursor.playheadSeconds === paused.cursor.playheadSeconds &&
            paused.cursor.playheadSeconds === resumed.cursor.playheadSeconds &&
            before.cursor.elapsedSinceEmissionSeconds ===
              resumed.cursor.elapsedSinceEmissionSeconds,
          actualBoundaryRecorded:
            audit?.nativeSuspendAudioSeconds === context.currentTime &&
            audit.nativeFadeAdvanceSeconds === 0 &&
            resumed?.nativeAudioTimeSeconds === context.currentTime,
        });
      }
      engine.flushControlUpdates();
      checkpointsState.push({
        time: context.currentTime,
        telemetry: engine.getTelemetry(),
        resources: engine.getNativeResourceSnapshot(),
        signalCursor: engine.getVoiceCursorState("signal", context.currentTime),
      });
      await context.resume();
    }
    const result = await rendering;
    const telemetry = engine.getTelemetry();
    const resources = engine.getNativeResourceSnapshot();
    await engine.disposeAsync();
    return {
      pcm: result.getChannelData(0),
      actualSampleRate: context.sampleRate,
      assetPcmSha256,
      pauseState,
      nativeStarts,
      cleanup: {
        contextState: context.state,
        nativeSourceNodes: engine.getTelemetry().nativeSourceNodes,
        callbacksCleared: nativeSources.every((node) => node.onended === null),
      },
      actualTimes,
      admission,
      telemetry,
      resources,
      quantum,
      checkpointsState,
    };
  } finally {
    await engine.disposeAsync();
    // Complete any already-scheduled offline checkpoints on an exceptional path.
    // OfflineAudioContext has no close(); rendering completion owns its closed state.
    if (rendering && context.state !== "closed") {
      for (const checkpoint of pendingSuspensions)
        void checkpoint.then(() => context.resume()).catch(() => undefined);
      if (context.state === "suspended") await context.resume().catch(() => undefined);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          rendering,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("OFFLINE_CLEANUP_DEADLINE")), 3000);
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }
  }
}
async function run() {
  const generators: SoundGenerator[] = [
    {
      kind: "sample",
      asset: { assetId: "phase-pcm", revision: 1, sha256: "a".repeat(64) },
      loop: true,
      startOffsetSeconds: 0.123456,
    },
    ...(["sine", "square", "triangle", "sawtooth"] as const).map((waveform) => ({
      kind: "oscillator" as const,
      waveform,
      frequencyHz: 173.3,
    })),
  ];
  const results = [];
  for (const expandedPause of [false, true]) {
    for (const generator of generators) {
      const reference = await render(generator, false, expandedPause);
      const candidate = await render(generator, true, expandedPause);
      let maxError = 0,
        squareError = 0,
        referenceEnergy = 0,
        finite = true,
        silentVirtualPeak = 0;
      const begin = Math.ceil(candidate.actualTimes[2]! * sampleRate);
      const promotionFadeSeconds = 0.02;
      for (let n = 0; n < candidate.pcm.length; n++) {
        finite &&= Number.isFinite(candidate.pcm[n]);
        if (n < candidate.actualTimes[2]! * sampleRate)
          silentVirtualPeak = Math.max(silentVirtualPeak, Math.abs(candidate.pcm[n]!));
        if (n < begin) continue;
        // Compare every sample from promotion, including its declared attack.
        // No fixed prefix is discarded to hide a phase or onset discrepancy.
        const fade = Math.min(
          1,
          Math.max(0, (n / sampleRate - candidate.actualTimes[2]!) / promotionFadeSeconds),
        );
        const expected = reference.pcm[n]! * fade;
        const error = candidate.pcm[n]! - expected;
        maxError = Math.max(maxError, Math.abs(error));
        squareError += error * error;
        referenceEnergy += expected ** 2;
      }
      const relativeRmsError = Math.sqrt(squareError / referenceEnergy);
      const caseResult = {
        id:
          (expandedPause ? "pause-" : "") +
          (generator.kind === "sample"
            ? "sample-integrated-pitch-and-offset"
            : `oscillator-${generator.waveform}-integrated-phase`),
        group: expandedPause ? "expandedPausePcm" : "corePhasePcm",
        pass:
          finite &&
          maxError < 2e-6 &&
          relativeRmsError < 2e-6 &&
          silentVirtualPeak === 0 &&
          candidate.admission.reason === "VIRTUALIZED" &&
          candidate.telemetry.virtualVoices === 0 &&
          candidate.assetPcmSha256 === reference.assetPcmSha256 &&
          (generator.kind !== "sample" || /^[0-9a-f]{64}$/.test(candidate.assetPcmSha256 ?? "")) &&
          candidate.actualSampleRate === sampleRate &&
          reference.actualSampleRate === sampleRate &&
          Number.isSafeInteger(candidate.quantum) &&
          candidate.quantum! > 0 &&
          Number.isSafeInteger(reference.quantum) &&
          reference.quantum === candidate.quantum &&
          candidate.cleanup.contextState === "closed" &&
          reference.cleanup.contextState === "closed" &&
          candidate.cleanup.nativeSourceNodes === 0 &&
          candidate.cleanup.callbacksCleared &&
          (!expandedPause ||
            (candidate.pauseState.length === 2 &&
              candidate.pauseState.every(
                (state) =>
                  state.sameNativeSourcesAndStarts &&
                  state.cursorStable &&
                  state.actualBoundaryRecorded,
              ))),
        referencePcm: Array.from(reference.pcm),
        candidatePcm: Array.from(candidate.pcm),
        referenceAssetPcmSha256: reference.assetPcmSha256,
        candidateAssetPcmSha256: candidate.assetPcmSha256,
        referenceActualSampleRate: reference.actualSampleRate,
        candidateActualSampleRate: candidate.actualSampleRate,
        referenceCleanup: reference.cleanup,
        candidateCleanup: candidate.cleanup,
        referenceNativeStarts: reference.nativeStarts,
        candidateNativeStarts: candidate.nativeStarts,
        pauseState: candidate.pauseState,
        pauseReferencePolicy: expandedPause
          ? "nativeReferenceManualContextCheckpoint;continuousOriginalSource"
          : null,
        referenceTelemetry: reference.telemetry,
        candidateTelemetry: candidate.telemetry,
        referenceResources: reference.resources,
        candidateResources: candidate.resources,
        admission: candidate.admission,
        maxError,
        relativeRmsError,
        silentVirtualPeak,
        actualTimes: candidate.actualTimes,
        actualQuantumFrames: candidate.quantum,
        referenceActualQuantumFrames: reference.quantum,
        checkpointsState: candidate.checkpointsState,
        comparedFromFrame: begin,
        promotionFadeSeconds,
        ignoredPostPromotionFrames: 0,
        nativeSlotsInUse: candidate.telemetry.nativeSlotsInUse,
        limitations: [
          "Same-context native digital comparison; no hardware hearing evidence",
          "Virtual period retains the native content source, but route HRTF/IR state is not restored",
          "Independent nativeReference waveform baseline; silent anchor continuity under test",
          "Dry tap isolates source phase; master transport fade is bypassed in this PCM phase comparison",
          "Offline pause begins at an actual suspended checkpoint; live fade advance is tested separately",
        ],
      };
      results.push(caseResult);
      journal.append(caseResult);
    }
  }
  journal.complete();
  return {
    status: results.every((entry) => entry.pass) ? "PASS" : "FAIL",
    coreStatus: results
      .filter((entry) => entry.group === "corePhasePcm")
      .every((entry) => entry.pass)
      ? "PASS"
      : "FAIL",
    expandedPauseStatus: results
      .filter((entry) => entry.group === "expandedPausePcm")
      .every((entry) => entry.pass)
      ? "PASS"
      : "FAIL",
    sampleRate,
    frames: sampleRate * 2,
    results,
  };
}
(window as unknown as { __audioVirtualization: Promise<unknown> }).__audioVirtualization =
  run().catch((error) => {
    journal.fail(error);
    const partial = journal.snapshot();
    return {
      status: "FAIL",
      coreStatus: "FAIL",
      expandedPauseStatus: "FAIL",
      schemaVersion: partial.schemaVersion,
      sampleRate: partial.sampleRate,
      frames: partial.frames,
      error: partial.error,
      stack: error instanceof Error ? error.stack : null,
      results: partial.results,
    };
  });

const liveButton = document.querySelector<HTMLButtonElement>("#run-live-lifecycle");
if (!liveButton) throw new Error("NATIVE_LIFECYCLE_BUTTON_MISSING");
liveButton.addEventListener(
  "click",
  () => {
    liveButton.disabled = true;
    (window as unknown as { __audioLiveLifecycle: Promise<unknown> }).__audioLiveLifecycle =
      runNativeLiveLifecycle().catch((error) => ({
        status: "FAIL",
        error: String(error),
        stack: error instanceof Error ? error.stack : null,
      }));
  },
  { once: true },
);
