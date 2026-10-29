import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import type { VoiceInput } from "../../src/audio/types.js";

const rate = 48000;
function frame(): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "late-fixture",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "literal-late-fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.025,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["Literal native renderer fixture, not room measurement"],
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
        lengthM: 8.575,
        absoluteDelayS: 0.025,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: [0.5],
      },
    ],
  };
}
function voice(generator: VoiceInput["generator"], continuous = false): VoiceInput {
  return {
    instanceId: "voice",
    sourceId: "source",
    generator,
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0.05,
    continuous,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
  };
}
function energy(buffer: AudioBuffer, from = 0, to = buffer.length): number {
  let sum = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = from; i < to; i++) sum += data[i]! ** 2;
  }
  return sum;
}
function finite(buffer: AudioBuffer): boolean {
  return Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c).every(Number.isFinite),
  ).every(Boolean);
}
function makeEngine(context: OfflineAudioContext) {
  return new AudioEngine({
    context,
    monitorGain: 1,
    headroomGain: 1,
    limiterEnabled: false,
    spatializationModel: "equalpower",
  });
}
/** Native convolution, bank crossfade and actual decodeAudioData checks. */
export async function runAudioLateBrowserValidation() {
  const checks: { id: string; pass: boolean; evidence: Record<string, unknown> }[] = [];
  const context = new OfflineAudioContext(2, Math.round(rate * 0.6), rate),
    engine = makeEngine(context);
  await engine.enable(0);
  engine.setMuted(false);
  engine.setLateReverb({ enabled: true, decaySeconds: 0.3, wetGain: 0.5, seed: 7 });
  const impulse = context.createBuffer(1, 960, rate);
  impulse.getChannelData(0)[480] = 1;
  engine.registerBuffer("impulse", impulse, {
    name: "Original impulse",
    origin: "generated",
    license: "ORIGINAL_TEST_PCM",
    sha256: "a".repeat(64),
  });
  engine.playVoice(
    voice({
      kind: "sample",
      asset: { assetId: "impulse", revision: 1, sha256: "a".repeat(64) },
      loop: false,
      startOffsetSeconds: 0,
    }),
    frame(),
  );
  const telemetry = engine.getTelemetry(),
    output = await context.startRendering();
  const directEnergy = energy(output, 0, Math.round(rate * 0.11)),
    lateEnergy = energy(output, Math.round(rate * 0.11));
  checks.push({
    id: "native-synthetic-late-IR-explicit-unit-energy-no-auto-normalization",
    pass:
      Math.abs(directEnergy - 0.25) < 1e-5 &&
      Math.abs(lateEnergy - 0.0625) < 1e-5 &&
      finite(output),
    evidence: {
      directEnergy,
      expectedDirectEnergy: 0.25,
      lateEnergy,
      expectedLateEnergy: 0.5 ** 2 * 0.5 ** 2,
      telemetry,
    },
  });
  checks.push({
    id: "native-late-tail-starts-after-real-solver-path-and-30ms-synthetic-onset",
    pass:
      energy(output, Math.round(rate * 0.09), Math.round(rate * 0.1149)) < 1e-12 &&
      energy(output, Math.round(rate * 0.12), Math.round(rate * 0.25)) > 0.001,
    evidence: {
      pathDelaySeconds: 0.025,
      emissionSeconds: 0.05,
      assetImpulseOffsetSeconds: 0.01,
      syntheticOnsetSeconds: 0.03,
      gapEnergy: energy(output, Math.round(rate * 0.09), Math.round(rate * 0.1149)),
      tailEnergy: energy(output, Math.round(rate * 0.12), Math.round(rate * 0.25)),
    },
  });
  engine.dispose();

  const movingContext = new OfflineAudioContext(2, rate / 2, rate),
    moving = makeEngine(movingContext);
  await moving.enable(0);
  moving.setMuted(false);
  moving.setLateReverb({ enabled: true, decaySeconds: 0.2, wetGain: 0.2, seed: 1 });
  moving.playVoice(
    voice({ kind: "oscillator", waveform: "sine", frequencyHz: 220 }, true),
    frame(),
  );
  const suspended = movingContext.suspend(0.2),
    rendering = movingContext.startRendering();
  await suspended;
  const transition = movingContext.currentTime;
  moving.setLateReverb({ enabled: true, decaySeconds: 0.4, wetGain: 0.3, seed: 9 });
  const during = moving.getTelemetry();
  await movingContext.resume();
  const changed = await rendering;
  let largestDelta = 0;
  const samples = changed.getChannelData(0);
  for (let i = Math.round(transition * rate); i < Math.round((transition + 0.04) * rate); i++)
    largestDelta = Math.max(largestDelta, Math.abs(samples[i]! - samples[i - 1]!));
  checks.push({
    id: "native-late-bank-crossfade-bounded-finite-and-source-preserving",
    pass:
      finite(changed) &&
      energy(changed, Math.round(rate * 0.3)) > 0 &&
      during.activeVoices === 1 &&
      during.lateReverb.decodedBytes <= 2 * Math.ceil(rate * 0.4) * 4 &&
      during.lateReverb.activeSends === 1,
    evidence: {
      transition,
      largestDelta,
      scope: "Measured sample delta; no universal click/pop threshold adopted",
      during,
      tailEnergy: energy(changed, Math.round(rate * 0.3)),
    },
  });
  moving.dispose();

  const decodeContext = new OfflineAudioContext(2, rate / 5, rate),
    decode = makeEngine(decodeContext);
  await decode.enable(0);
  decode.setMuted(false);
  const wav = new ArrayBuffer(44 + 480 * 2),
    view = new DataView(wav);
  const str = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, wav.byteLength - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, 960, true);
  view.setInt16(44 + 240 * 2, 32767, true);
  const asset = await decode.importAsset("decoded-wav", wav, {
    name: "Original encoded PCM16 impulse",
    origin: "imported",
    license: "ORIGINAL_TEST_WAV",
  });
  const admission = decode.playVoice(
    voice({
      kind: "sample",
      asset: { assetId: asset.assetId, revision: asset.revision, sha256: asset.sha256! },
      loop: false,
      startOffsetSeconds: 0,
    }),
    frame(),
  );
  const decodedOutput = await decodeContext.startRendering(),
    data = decodedOutput.getChannelData(0);
  let peak = 0,
    peakAt = -1;
  for (let i = 0; i < data.length; i++)
    if (Math.abs(data[i]!) > peak) {
      peak = Math.abs(data[i]!);
      peakAt = i;
    }
  checks.push({
    id: "native-original-WAV-import-real-decode-and-trusted-hash-playback",
    pass:
      admission.accepted &&
      asset.origin === "imported" &&
      /^[a-f0-9]{64}$/.test(asset.sha256!) &&
      Math.abs(peakAt - 3840) <= 1 &&
      finite(decodedOutput),
    evidence: {
      asset,
      admission,
      peakAt,
      expectedPeakAt: 3840,
      peak,
      decodedEnergy: energy(decodedOutput),
    },
  });
  decode.dispose();
  return {
    status: checks.every((c) => c.pass) ? "PASS" : "FAIL",
    checks,
    userAgent: navigator.userAgent,
    limitations: [
      "Synthetic/perceptual IR, no measured or computed room RT60 claim",
      "Late bus is not an individual solver path and exports no rays",
      "Finite native fixtures do not certify hearing, realtime capacity, clicks or device latency",
    ],
  };
}
