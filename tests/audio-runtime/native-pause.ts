import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import type { VoiceInput } from "../../src/audio/types.js";

interface Check {
  id: string;
  pass: boolean;
  evidence: Record<string, unknown>;
}
const rate = 48000;
const hash = "a".repeat(64);
function frame(delay: number): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "pause-fixture",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "independent-pause-fixture",
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
    limitations: ["Literal DSP fixture, not geometry output"],
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
function input(overrides: Partial<VoiceInput> = {}): VoiceInput {
  return {
    instanceId: "voice",
    sourceId: "source",
    generator: {
      kind: "sample",
      asset: { assetId: "pcm", revision: 1, sha256: hash },
      loop: false,
      startOffsetSeconds: 0,
    },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0.05,
    continuous: false,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    ...overrides,
  };
}
function engineFor(context: OfflineAudioContext): AudioEngine {
  return new AudioEngine({
    context,
    headroomGain: 1,
    monitorGain: 1,
    limiterEnabled: false,
    spatializationModel: "equalpower",
  });
}
function impulses(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0),
    result: number[] = [];
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]!) > 0.1) result.push(i);
  return result;
}
async function impulsePause(delay: number, emission: number, pauseAt: number) {
  const context = new OfflineAudioContext(2, rate / 2, rate),
    engine = engineFor(context);
  await engine.enable(0);
  engine.setMuted(false);
  const buffer = context.createBuffer(1, 960, rate);
  buffer.getChannelData(0)[480] = 1;
  engine.registerBuffer("pcm", buffer, {
    name: "Original impulse",
    origin: "generated",
    license: "ORIGINAL_TEST_PCM",
    sha256: hash,
  });
  const admission = engine.playVoice(input({ emissionTimeSeconds: emission }), frame(delay));
  const suspended = context.suspend(pauseAt),
    rendering = context.startRendering();
  await suspended;
  const logicalPause = context.currentTime;
  await engine.pause(logicalPause);
  const frozen = engine.getTelemetry();
  await engine.resume(logicalPause);
  await context.resume();
  const result = await rendering,
    peaks = impulses(result);
  const telemetry = engine.getTelemetry();
  engine.dispose();
  return {
    admission,
    logicalPause,
    frozen,
    peaks,
    telemetry,
    expectedSample: Math.round((emission + 0.01 + delay) * rate),
  };
}
/** Genuine native output and native realtime clock checks; no fake AudioContext. */
export async function runAudioPauseBrowserValidation() {
  const checks: Check[] = [];
  const pending = await impulsePause(0.2, 0.05, 0.1);
  checks.push({
    id: "native-ended-emission-unarrived-impulse-restored-once",
    pass:
      pending.admission.accepted &&
      pending.peaks.length === 1 &&
      Math.abs(pending.peaks[0]! - pending.expectedSample) <= 1,
    evidence: pending,
  });
  const heard = await impulsePause(0.025, 0.05, 0.12);
  checks.push({
    id: "native-heard-impact-not-reemitted",
    pass: heard.peaks.length === 1 && Math.abs(heard.peaks[0]! - heard.expectedSample) <= 1,
    evidence: heard,
  });
  const future = await impulsePause(0.025, 0.2, 0.1);
  checks.push({
    id: "native-future-emission-rescheduled-once",
    pass: future.peaks.length === 1 && Math.abs(future.peaks[0]! - future.expectedSample) <= 1,
    evidence: future,
  });

  for (const kind of ["sample", "oscillator"] as const) {
    const context = new OfflineAudioContext(2, Math.round(rate * 0.3), rate),
      engine = engineFor(context);
    await engine.enable(0);
    engine.setMuted(false);
    engine.setMonitorMode("raw");
    const buffer = context.createBuffer(1, rate, rate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = i / rate;
    engine.registerBuffer("pcm", buffer, {
      name: "Original ramp",
      origin: "generated",
      license: "ORIGINAL_TEST_PCM",
      sha256: hash,
    });
    engine.playVoice(
      input({
        emissionTimeSeconds: 0.01,
        continuous: true,
        generator:
          kind === "sample"
            ? {
                kind: "sample",
                asset: { assetId: "pcm", revision: 1, sha256: hash },
                loop: true,
                startOffsetSeconds: 0,
              }
            : { kind: "oscillator", waveform: "sine", frequencyHz: 443 },
      }),
      frame(0),
    );
    const suspended = context.suspend(0.1),
      rendering = context.startRendering();
    await suspended;
    const logicalPause = context.currentTime;
    await engine.pause(logicalPause);
    await new Promise((resolve) => setTimeout(resolve, 40));
    await engine.resume(logicalPause);
    await context.resume();
    const rendered = await rendering,
      output = rendered.getChannelData(0);
    let sum = 0,
      maximumError = 0,
      n = 0;
    for (let i = Math.round((logicalPause + 0.04) * rate); i < Math.round(0.25 * rate); i++) {
      const sourceTime = i / rate - 0.01;
      const expected = kind === "sample" ? sourceTime : Math.sin(2 * Math.PI * 443 * sourceTime);
      const error = output[i]! - expected;
      sum += error * error;
      maximumError = Math.max(maximumError, Math.abs(error));
      n++;
    }
    const rmsError = Math.sqrt(sum / n);
    checks.push({
      id: `native-${kind}-cursor-preserved-across-pause`,
      pass: rmsError < (kind === "sample" ? 2 / rate : 0.001),
      evidence: {
        logicalPause,
        rmsError,
        maximumError,
        sampleRate: rate,
        oracle: kind === "sample" ? "sourceTime literal ramp" : "sin(2*pi*443*sourceTime)",
        tolerance: kind === "sample" ? 2 / rate : 0.001,
        telemetry: engine.getTelemetry(),
      },
    });
    engine.dispose();
  }

  const realtime = new AudioContext(),
    live = new AudioEngine({ context: realtime });
  const clockDriver = realtime.createOscillator(),
    silent = realtime.createGain();
  silent.gain.value = 0;
  clockDriver.connect(silent).connect(realtime.destination);
  clockDriver.start();
  try {
    await live.enable(0);
    // Device startup can exceed 100ms; begin the clock test only after a real render quantum.
    for (let attempt = 0; attempt < 20 && realtime.currentTime === 0; attempt++)
      await new Promise((resolve) => setTimeout(resolve, 50));
    await live.pause(0);
    const before = realtime.currentTime;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const after = realtime.currentTime;
    checks.push({
      id: "native-paused-run-keeps-device-clock-running",
      pass: realtime.state === "running" && after > before + 0.02 && live.getTelemetry().paused,
      evidence: { before, after, state: realtime.state, telemetry: live.getTelemetry() },
    });
  } finally {
    clockDriver.stop();
    clockDriver.disconnect();
    silent.disconnect();
    live.dispose();
    await realtime.close();
  }
  return {
    status: checks.every((c) => c.pass) ? "PASS" : "FAIL",
    checks,
    userAgent: navigator.userAgent,
    limitations: [
      "20ms interrupted boundary; no seamless waveform or filter-state continuation claim",
      "Late path segments use latest solver path and content parameters; no retarded moving-history model",
      "Sine/ramp cursor fixtures only; other oscillator harmonics and rapid authored pitch/filter histories need wider characterization",
      "No hearing, headphone, device latency, or realtime capacity certification",
    ],
  };
}
