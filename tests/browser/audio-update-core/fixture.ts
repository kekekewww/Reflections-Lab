import { AudioEngine } from "../../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../../src/audio/types.js";

const rate = 48000;
const hash = "a".repeat(64);
function frame(gains: number[] = [0.5], tick = 0): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "native-update-reference",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: tick,
    backendId: "literal-native-reference",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: gains.length === 1 ? [1000] : [1000, 4000, 12000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.075,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: [
      "Literal path: validates native routing, not a geometry solution or device output",
    ],
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
        lengthM: 0.075 * 343,
        absoluteDelayS: 0.075,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: gains,
      },
    ],
  };
}
function energy(buffer: AudioBuffer): number {
  let result = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++)
    for (const sample of buffer.getChannelData(channel)) result += sample * sample;
  return result;
}
function firstSample(buffer: AudioBuffer): number | null {
  for (let sample = 0; sample < buffer.length; sample++)
    for (let channel = 0; channel < buffer.numberOfChannels; channel++)
      if (Math.abs(buffer.getChannelData(channel)[sample]!) > 1e-6) return sample;
  return null;
}
function rms(buffer: AudioBuffer, from: number, to: number): number {
  let square = 0,
    count = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let index = Math.round(from * rate); index < Math.round(to * rate); index++) {
      square += samples[index]! ** 2;
      count++;
    }
  }
  return Math.sqrt(square / count);
}
async function impulse(tap: "master" | "simulatedMix" | "dryContent") {
  const context = new OfflineAudioContext(2, Math.round(rate * 0.2), rate);
  const engine = new AudioEngine({
    context,
    offlineOutputTap: tap,
    headroomGain: 0.25,
    monitorGain: 0.5,
    limiterEnabled: false,
    spatializationModel: "equalpower",
  });
  try {
    await engine.enable(0);
    engine.setMuted(false);
    const buffer = context.createBuffer(1, 480, rate);
    buffer.getChannelData(0)[0] = 1;
    engine.registerBuffer("impulse", buffer, {
      name: "Original literal impulse",
      origin: "generated",
      license: "PROJECT_GENERATED",
      sha256: hash,
    });
    const voice: VoiceInput = {
      instanceId: "impulse",
      sourceId: "source",
      generator: {
        kind: "sample",
        asset: { assetId: "impulse", revision: 1, sha256: hash },
        loop: false,
        startOffsetSeconds: 0,
      },
      gainLinear: 1,
      pitchSemitones: 0,
      emissionTimeSeconds: 0.01,
      continuous: false,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      durationSeconds: 0.01,
    };
    if (!engine.playVoice(voice, frame()).accepted) throw new Error("Impulse admission failed");
    const rendered = await context.startRendering();
    const channelEnergies = Array.from({ length: rendered.numberOfChannels }, (_, channel) => {
      let result = 0;
      for (const sample of rendered.getChannelData(channel)) result += sample * sample;
      return result;
    });
    const measured = {
      firstSample: firstSample(rendered),
      energy: energy(rendered),
      channelEnergies,
    };
    const expected =
      tap === "dryContent"
        ? { firstSample: 480, energy: 2 }
        : { firstSample: 4080, energy: tap === "simulatedMix" ? 0.25 : 0.00390625 };
    return {
      name: `impulse-${tap}`,
      measured,
      expected,
      pass:
        measured.firstSample !== null &&
        Math.abs(measured.firstSample - expected.firstSample) <= 1 &&
        Math.abs(measured.energy - expected.energy) <= 1e-5 &&
        channelEnergies.every((value) => Math.abs(value - expected.energy / 2) <= 1e-5),
      reference:
        "W3C Web Audio 2021 section4.4: speakers mono-to-stereo copies input to L and R; unity raw has total two-channel energy2, not equal-power panning",
      diagnostics: engine.getDiagnostics(),
    };
  } finally {
    engine.dispose();
  }
}
async function scalar() {
  const context = new OfflineAudioContext(2, rate, rate);
  const engine = new AudioEngine({
    context,
    offlineOutputTap: "simulatedMix",
    spatializationModel: "equalpower",
  });
  try {
    await engine.enable(0);
    const gains = [0.25, 0.5, 1];
    const voice: VoiceInput = {
      instanceId: "tone",
      sourceId: "source",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
      gainLinear: 0.1,
      pitchSemitones: 0,
      emissionTimeSeconds: 0,
      continuous: true,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    };
    if (!engine.playVoice(voice, frame(gains)).accepted) throw new Error("Tone admission failed");
    const checkpoint = context.suspend(0.2);
    const rendering = context.startRendering();
    await checkpoint;
    const actualControlSeconds = context.currentTime;
    engine.updateFrame(
      frame(
        gains.map((value) => value * 2),
        12,
      ),
    );
    engine.flushControlUpdates();
    await context.resume();
    const rendered = await rendering;
    const before = rms(rendered, 0.1, 0.15),
      after = rms(rendered, 0.3, 0.35);
    const ratio = after / before;
    const diagnostics = engine.getDiagnostics();
    return {
      name: "scalar-native-continuity",
      beforeRms: before,
      afterRms: after,
      ratio,
      actualControlSeconds,
      desiredControlSeconds: 0.2,
      pass:
        before > 0 &&
        Math.abs(ratio - 2) < 0.01 &&
        diagnostics.controlOperations.shapeBuilds === 1 &&
        diagnostics.controlOperations.shapeUploads === 1 &&
        diagnostics.onsets.count === 1,
      diagnostics,
    };
  } finally {
    engine.dispose();
  }
}
const result = (async () => {
  const results = [];
  for (const tap of ["master", "simulatedMix", "dryContent"] as const)
    results.push(await impulse(tap));
  results.push(await scalar());
  return {
    status: results.every((result) => result.pass) ? "PASS" : "FAIL",
    sampleRate: rate,
    scope:
      "Native OfflineAudioContext PCM; no physical output, hearing or long-run performance claim",
    controls: "Audio-clock suspend checkpoint quantized by the native render quantum",
    results,
  };
})();
(window as unknown as { __audioUpdateCore: Promise<unknown> }).__audioUpdateCore = result;
