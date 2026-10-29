import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import type { VoiceInput } from "../../src/audio/types.js";

interface Check {
  id: string;
  pass: boolean;
  evidence: Record<string, unknown>;
}
function fixtureFrame(sourceId = "source-a", reflection = true): AcousticFrame {
  const path = (id: string, order: number, delay: number, gain: number) => ({
    id,
    sourceId,
    listenerId: "listener-a",
    surfaceIds: order ? ["wall-a"] : [],
    order,
    verticesM: [
      [0, 0, -1],
      [0, 0, 0],
    ] as [number, number, number][],
    lengthM: delay * 343,
    absoluteDelayS: delay,
    relativeDelayS: delay - 0.025,
    arrivalDirection: [0, 0, -1] as [number, number, number],
    bandGains: [gain],
  });
  return {
    schemaVersion: "1.0.0",
    requestId: "offline-fixture",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "independent-audio-fixture",
    backendVersion: "1",
    sourceId,
    listenerId: "listener-a",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters", "individualReflectionPaths"],
    modelClass: "numericalApproximation",
    directDelayS: 0.025,
    paths: [
      path("direct", 0, 0.025, 0.5),
      ...(reflection ? [path("reflection", 1, 0.075, 0.25)] : []),
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["FIXED_DSP_FIXTURE; not a geometry solution"],
  };
}
function voice(instanceId: string, overrides: Partial<VoiceInput> = {}): VoiceInput {
  return {
    instanceId,
    sourceId: "source-a",
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0.05,
    continuous: true,
    fadeInSeconds: 0.001,
    fadeOutSeconds: 0.001,
    priority: 5,
    ...overrides,
  };
}
function finiteBuffer(buffer: AudioBuffer): boolean {
  for (let c = 0; c < buffer.numberOfChannels; c++)
    if (!buffer.getChannelData(c).every(Number.isFinite)) return false;
  return true;
}
function energy(buffer: AudioBuffer, start = 0, end = buffer.length): number {
  let sum = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = start; i < end; i++) sum += (data[i] ?? 0) ** 2;
  }
  return sum;
}
function peak(
  buffer: AudioBuffer,
  start: number,
  end: number,
): { sample: number; amplitude: number } {
  let sample = -1,
    amplitude = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = start; i < end; i++) {
      const value = Math.abs(data[i] ?? 0);
      if (value > amplitude) {
        amplitude = value;
        sample = i;
      }
    }
  }
  return { sample, amplitude };
}

/** Run inside a browser. These are genuine OfflineAudioContext renders, never FakeContext. */
export async function runAudioBrowserValidation(): Promise<{
  status: "PASS" | "FAIL" | "BLOCKED";
  checks: Check[];
  limitations: string[];
  userAgent: string;
}> {
  const checks: Check[] = [];
  const limitations = [
    "No hearing/headphone/device-latency certification",
    "HRTF/limiter native algorithmic latency is not inferred from d/c",
    "Finite fixtures do not establish maximum real-time voice capacity",
    "Native pause boundary has a 20ms fade target and is separate from the logical physics tick",
  ];
  if (typeof OfflineAudioContext !== "function")
    return {
      status: "BLOCKED",
      checks,
      limitations: [...limitations, "OfflineAudioContext unavailable"],
      userAgent: navigator.userAgent,
    };
  const rate = 48000;
  const context = new OfflineAudioContext(2, rate * 0.25, rate);
  const engine = new AudioEngine({
    context,
    headroomGain: 1,
    monitorGain: 1,
    limiterEnabled: false,
    spatializationModel: "equalpower",
  });
  await engine.enable(0);
  engine.setMuted(false);
  const impulse = context.createBuffer(1, 960, rate);
  impulse.getChannelData(0)[480] = 1;
  const hash = "a".repeat(64);
  engine.registerBuffer("fixture-impulse", impulse, {
    name: "Original isolated unit impulse",
    origin: "generated",
    license: "PROJECT_GENERATED_TEST_FIXTURE",
    sha256: hash,
  });
  const input = voice("impulse", {
    generator: {
      kind: "sample",
      asset: { assetId: "fixture-impulse", revision: 1, sha256: hash },
      loop: false,
      startOffsetSeconds: 0,
    },
    continuous: false,
  });
  const admission = engine.playVoice(input, fixtureFrame());
  const rendered = await context.startRendering();
  const direct = peak(rendered, 0, Math.round(0.11 * rate)),
    reflection = peak(rendered, Math.round(0.11 * rate), rendered.length);
  const expectedDirect = Math.round(0.085 * rate),
    expectedReflection = Math.round(0.135 * rate);
  checks.push({
    id: "native-delay-arrivals-once",
    pass:
      admission.accepted &&
      Math.abs(direct.sample - expectedDirect) <= 1 &&
      Math.abs(reflection.sample - expectedReflection) <= 1,
    evidence: { direct, reflection, expectedDirect, expectedReflection, sampleRate: rate },
  });
  const actualEnergy = energy(rendered),
    expectedEnergy = 0.5 ** 2 + 0.25 ** 2;
  checks.push({
    id: "native-pressure-gain-once-and-no-convolver-normalization",
    pass: Math.abs(actualEnergy - expectedEnergy) < 1e-5 && finiteBuffer(rendered),
    evidence: {
      actualEnergy,
      expectedEnergy,
      directPeak: direct.amplitude,
      expectedCenteredChannelPeak: 0.5 * Math.SQRT1_2,
    },
  });
  engine.dispose();
  checks.push({
    id: "native-dispose-resource-accounting",
    pass: engine.getTelemetry().activeVoices === 0 && engine.getTelemetry().activePaths === 0,
    evidence: { telemetry: engine.getTelemetry() },
  });

  const continuousContext = new OfflineAudioContext(2, Math.round(rate * 0.3), rate);
  let generatorsCreated = 0;
  const create = continuousContext.createOscillator.bind(continuousContext);
  continuousContext.createOscillator = () => {
    generatorsCreated++;
    return create();
  };
  const continuousEngine = new AudioEngine({
    context: continuousContext,
    headroomGain: 1,
    monitorGain: 1,
    limiterEnabled: false,
    spatializationModel: "equalpower",
  });
  await continuousEngine.enable(0);
  continuousEngine.setMuted(false);
  continuousEngine.playVoice(
    voice("continuous", { gainLinear: 0.3, emissionTimeSeconds: 0.02 }),
    fixtureFrame("source-a", false),
  );
  continuousEngine.updateVoice("continuous", { gainLinear: 0.25, pitchSemitones: 0 });
  continuousEngine.updateFrame({ ...fixtureFrame("source-a", false), poseTick: 2 });
  const beforeImpact = generatorsCreated;
  continuousEngine.playVoice(
    voice("impact-layer", {
      gainLinear: 0.1,
      emissionTimeSeconds: 0.08,
      continuous: false,
      durationSeconds: 0.03,
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 880 },
    }),
    { ...fixtureFrame("source-a", false), poseTick: 2 },
  );
  const continuousOutput = await continuousContext.startRendering();
  const tailEnergy = energy(continuousOutput, Math.round(rate * 0.18), Math.round(rate * 0.22));
  checks.push({
    id: "native-continuous-generator-survives-parameter-and-impact-updates",
    pass:
      beforeImpact === 1 &&
      generatorsCreated === 2 &&
      tailEnergy > 0.01 &&
      finiteBuffer(continuousOutput),
    evidence: { generatorsBeforeImpact: beforeImpact, generatorsCreated, tailEnergy },
  });
  continuousEngine.dispose();

  const limitedContext = new OfflineAudioContext(2, rate / 5, rate);
  const limited = new AudioEngine({
    context: limitedContext,
    budget: { maxVoices: 2, maxPathsPerVoice: 1, maxTotalPaths: 3, maxDecodedBytes: 4096 },
    headroomGain: 1,
    monitorGain: 1,
    limiterEnabled: false,
    spatializationModel: "equalpower",
  });
  await limited.enable(0);
  limited.setMuted(false);
  const low = limited.playVoice(voice("low", { priority: 1 }), fixtureFrame("source-a", false));
  const high = limited.playVoice(voice("high", { priority: 10 }), fixtureFrame("source-a", false));
  const rejected = limited.playVoice(
    voice("rejected", { priority: 0 }),
    fixtureFrame("source-a", false),
  );
  const stolen = limited.playVoice(voice("top", { priority: 20 }), fixtureFrame("source-a", false));
  let memoryRejected = false;
  try {
    limited.registerBuffer("too-large", limitedContext.createBuffer(2, 48000, rate), {
      name: "oversized",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
    });
  } catch {
    memoryRejected = true;
  }
  checks.push({
    id: "native-independent-voice-path-and-decoded-memory-budgets",
    pass:
      low.accepted &&
      high.accepted &&
      !rejected.accepted &&
      stolen.accepted &&
      stolen.stolenInstanceId === "low" &&
      limited.getTelemetry().activeVoices === 2 &&
      limited.getTelemetry().activePaths <= 3 &&
      memoryRejected,
    evidence: { low, high, rejected, stolen, memoryRejected, telemetry: limited.getTelemetry() },
  });
  const limitedOutput = await limitedContext.startRendering();
  checks.push({
    id: "native-bounded-burst-finite-output",
    pass: finiteBuffer(limitedOutput) && energy(limitedOutput) > 0,
    evidence: { energy: energy(limitedOutput) },
  });
  limited.dispose();

  const hrtfContext = new OfflineAudioContext(2, rate / 3, rate);
  const hrtf = new AudioEngine({
    context: hrtfContext,
    headroomGain: 0.5,
    monitorGain: 0.5,
    limiterEnabled: false,
  });
  await hrtf.enable(0);
  hrtf.setMuted(false);
  const hrtfFrame = fixtureFrame("source-a", false);
  hrtfFrame.paths[0]!.arrivalDirection = [-1, 0, 0];
  hrtf.playVoice(voice("native-hrtf", { gainLinear: 0.2 }), hrtfFrame);
  const binaural = await hrtfContext.startRendering();
  checks.push({
    id: "native-hrtf-renders-finite-nonzero-output",
    pass: finiteBuffer(binaural) && energy(binaural) > 0.001,
    evidence: {
      energy: energy(binaural),
      telemetry: hrtf.getTelemetry(),
      scope: "Native render sanity only, not calibrated HRTF/hearing validation",
    },
  });
  hrtf.dispose();
  return {
    status: checks.every((c) => c.pass) ? "PASS" : "FAIL",
    checks,
    limitations,
    userAgent: navigator.userAgent,
  };
}
