import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import type { VoiceInput } from "../../src/audio/types.js";

const rate = 48000,
  hash = "a".repeat(64);
function frame(delay: number): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "restore",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "literal-restore-fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: delay,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["Literal DSP cursor fixture, not room measurement"],
    paths: [
      {
        id: "direct",
        sourceId: "source",
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [0, 0, -1],
          [0, 0, 0],
        ],
        lengthM: delay * 343,
        absoluteDelayS: delay,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: [1],
      },
    ],
  };
}
function voice(loop: boolean, offset = 0): VoiceInput {
  return {
    instanceId: "voice",
    sourceId: "source",
    generator: {
      kind: "sample",
      asset: { assetId: "pcm", revision: 1, sha256: hash },
      loop,
      startOffsetSeconds: offset,
    },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: loop,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
  };
}
function make(context: OfflineAudioContext) {
  return new AudioEngine({
    context,
    headroomGain: 1,
    monitorGain: 1,
    limiterEnabled: false,
    spatializationModel: "equalpower",
  });
}
/** RecordedOutput seek/capture pipeline: source cursor plus already emitted, unarrived content. */
export async function runAudioRestoreBrowserValidation() {
  const checks: { id: string; pass: boolean; evidence: Record<string, unknown> }[] = [];
  const context = new OfflineAudioContext(2, rate / 5, rate),
    engine = make(context);
  await engine.enable(0);
  engine.setMuted(false);
  const ramp = context.createBuffer(1, rate, rate);
  for (let i = 0; i < rate; i++) ramp.getChannelData(0)[i] = i / rate;
  engine.registerBuffer("pcm", ramp, {
    name: "Original ramp",
    origin: "generated",
    license: "ORIGINAL_TEST_PCM",
    sha256: hash,
  });
  const input = voice(true, 0.1),
    cursor = {
      playheadSeconds: 0.4,
      elapsedSinceEmissionSeconds: 0.4,
      remainingDurationSeconds: null,
      restorePendingArrivals: true,
    };
  const admission = engine.restoreVoiceAtCursor(input, frame(0.025), cursor),
    duplicate = engine.restoreVoiceAtCursor(input, frame(0.025), cursor);
  const output = await context.startRendering(),
    left = output.getChannelData(0),
    right = output.getChannelData(1);
  let sum = 0,
    n = 0,
    earlyEnergy = 0;
  for (let i = Math.round(0.04 * rate); i < Math.round(0.15 * rate); i++) {
    const actual = (left[i]! + right[i]!) * Math.SQRT1_2,
      expected = 0.475 + i / rate;
    sum += (actual - expected) ** 2;
    n++;
  }
  for (let i = Math.round(0.005 * rate); i < Math.round(0.02 * rate); i++)
    earlyEnergy += left[i]! ** 2 + right[i]! ** 2;
  const rmsError = Math.sqrt(sum / n);
  checks.push({
    id: "native-seek-restores-authored-offset-once-and-existing-propagation-pipeline",
    pass: admission.accepted && !duplicate.accepted && rmsError < 2 / rate && earlyEnergy > 0.01,
    evidence: {
      admission,
      duplicate,
      rmsError,
      tolerance: 2 / rate,
      earlyEnergy,
      oracle: "authored .1 + sourceCursor .4 - pathDelay .025 + t",
      telemetry: engine.getTelemetry(),
    },
  });
  engine.dispose();
  for (const [label, delay, elapsed] of [
    ["heard", 0.025, 0.2],
    ["unarrived", 0.2, 0.1],
  ] as const) {
    const c = new OfflineAudioContext(2, rate / 3, rate),
      e = make(c);
    await e.enable(0);
    e.setMuted(false);
    const pcm = c.createBuffer(1, 960, rate);
    pcm.getChannelData(0)[480] = 1;
    e.registerBuffer("pcm", pcm, {
      name: "Original impulse",
      origin: "generated",
      license: "ORIGINAL_TEST_PCM",
      sha256: hash,
    });
    const a = e.restoreVoiceAtCursor(voice(false), frame(delay), {
      playheadSeconds: 0.02,
      elapsedSinceEmissionSeconds: elapsed,
      remainingDurationSeconds: 0,
      restorePendingArrivals: true,
    });
    const rendered = await c.startRendering(),
      samples = rendered.getChannelData(0);
    const peaks: number[] = [];
    for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]!) > 0.1) peaks.push(i);
    const expected = Math.round((delay - elapsed + 0.01) * rate);
    checks.push({
      id: `native-seek-ended-${label}-impact-${label === "heard" ? "stays-heard" : "arrives-once"}`,
      pass:
        a.accepted &&
        (label === "heard"
          ? peaks.length === 0
          : peaks.length === 1 && Math.abs(peaks[0]! - expected) <= 1),
      evidence: {
        admission: a,
        peaks,
        expectedSample: label === "heard" ? null : expected,
        telemetry: e.getTelemetry(),
      },
    });
    e.dispose();
  }
  const c = new OfflineAudioContext(2, rate / 3, rate),
    e = make(c);
  await e.enable(0);
  e.registerBuffer("pcm", c.createBuffer(1, rate, rate), {
    name: "Silent cursor fixture",
    origin: "generated",
    license: "ORIGINAL_TEST_PCM",
    sha256: hash,
  });
  e.playVoice({ ...voice(true), emissionTimeSeconds: 0.01 }, frame(0));
  const first = c.suspend(0.1),
    second = c.suspend(0.2),
    render = c.startRendering();
  await first;
  const t1 = c.currentTime;
  e.updateVoice("voice", { pitchSemitones: 12, smoothingSeconds: 0.02 });
  await c.resume();
  await second;
  const t2 = c.currentTime,
    saved = e.getVoiceCursor("voice", t2),
    expected = t1 - 0.01 + 1.5 * 0.02 + 2 * (t2 - t1 - 0.02);
  await c.resume();
  await render;
  checks.push({
    id: "native-capture-source-cursor-integrates-authored-pitch-ramp",
    pass:
      saved !== null &&
      Math.abs(saved.playheadSeconds - expected) < 1 / rate &&
      Math.abs(saved.elapsedSinceEmissionSeconds - (t2 - 0.01)) < 1 / rate,
    evidence: { t1, t2, saved, expectedSourceSeconds: expected, tolerance: 1 / rate },
  });
  e.dispose();
  const pausedContext = new OfflineAudioContext(2, rate / 4, rate),
    pausedEngine = make(pausedContext);
  await pausedEngine.enable(0);
  const originalRamp = pausedContext.createBuffer(1, rate, rate);
  for (let i = 0; i < rate; i++) originalRamp.getChannelData(0)[i] = i / rate;
  const metadata = {
    name: "Original paused-cursor ramp",
    origin: "generated" as const,
    license: "ORIGINAL_TEST_PCM",
    sha256: hash,
  };
  pausedEngine.registerBuffer("pcm", originalRamp, metadata);
  pausedEngine.playVoice({ ...voice(true), emissionTimeSeconds: 0.01 }, frame(0.025));
  const atPause = pausedContext.suspend(0.1),
    pausedRender = pausedContext.startRendering();
  await atPause;
  const pauseTime = pausedContext.currentTime;
  await pausedEngine.pause(pauseTime);
  const pausedCursor = pausedEngine.getVoiceCursor("voice", pauseTime);
  pausedEngine.dispose();
  await pausedContext.resume();
  await pausedRender;
  const restoreContext = new OfflineAudioContext(2, rate / 5, rate),
    restoreEngine = make(restoreContext);
  await restoreEngine.enable(pauseTime);
  restoreEngine.setMuted(false);
  restoreEngine.registerBuffer("pcm", originalRamp, metadata);
  const restored = pausedCursor
    ? restoreEngine.restoreVoiceAtCursor(
        { ...voice(true), emissionTimeSeconds: pauseTime },
        frame(0.025),
        { ...pausedCursor, restorePendingArrivals: true },
      )
    : { accepted: false };
  const restoredOutput = await restoreContext.startRendering(),
    a = restoredOutput.getChannelData(0),
    b = restoredOutput.getChannelData(1);
  let phaseError = 0,
    phaseCount = 0;
  for (let i = Math.round(0.04 * rate); i < Math.round(0.15 * rate); i++) {
    const expectedValue = pauseTime - 0.01 - 0.025 + i / rate;
    phaseError += ((a[i]! + b[i]!) * Math.SQRT1_2 - expectedValue) ** 2;
    phaseCount++;
  }
  const rms = Math.sqrt(phaseError / phaseCount),
    logicalAge = pauseTime - 0.01;
  checks.push({
    id: "native-pause-captured-cursor-restores-without-fade-age-inflation",
    pass:
      pausedCursor !== null &&
      restored.accepted &&
      pausedCursor.elapsedSinceEmissionSeconds <= logicalAge + 1e-5 &&
      Math.abs(pausedCursor.playheadSeconds - logicalAge) < 1 / rate &&
      rms < 2 / rate,
    evidence: {
      pauseTime,
      logicalAge,
      pausedCursor,
      restored,
      rmsError: rms,
      tolerance: 2 / rate,
      cutoff: "20ms heard cutoff does not advance source cursor or logical age",
    },
  });
  restoreEngine.dispose();
  return {
    status: checks.every((x) => x.pass) ? "PASS" : "FAIL",
    checks,
    userAgent: navigator.userAgent,
    limitations: [
      "Current source cursor follows bounded authored pitch-ramp history and epoch mapping; not a hardware read pointer",
      "Restore pending history uses latest pitch/content/path approximation when earlier automation is absent",
      "No seamless seek waveform/filter-state, hearing, or realtime capacity certification",
    ],
  };
}
