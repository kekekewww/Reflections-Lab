import { AudioEngine } from "../../../../src/audio/engine.js";
import {
  apply,
  BUDGET,
  POLICY,
  PCM_TOLERANCE,
  type Corpus,
  type WaveFixture,
} from "./contracts.js";
import { compareAssets, type AssetAdapter } from "./asset-comparison.js";
import { renderPhase } from "./phase-fixture.js";

function check(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
async function digest(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function metrics(
  reference: Float32Array,
  candidate: Float32Array,
  start = 0,
  end = reference.length,
) {
  let maxError = 0,
    sum = 0,
    nonFinite = 0,
    aboveTolerance = 0,
    referenceOnset = -1,
    candidateOnset = -1;
  for (let i = start; i < end; i++) {
    const a = reference[i]!,
      b = candidate[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      nonFinite++;
      continue;
    }
    if (referenceOnset < 0 && Math.abs(a) > 1e-7) referenceOnset = i;
    if (candidateOnset < 0 && Math.abs(b) > 1e-7) candidateOnset = i;
    const error = Math.abs(a - b);
    maxError = Math.max(maxError, error);
    sum += error * error;
    if (error > PCM_TOLERANCE) aboveTolerance++;
  }
  return {
    maxError,
    rmsError: Math.sqrt(sum / (end - start)),
    aboveTolerance,
    nonFinite,
    referenceOnset,
    candidateOnset,
    onsetDifferenceSamples: candidateOnset - referenceOnset,
    comparedSamples: end - start,
    ignoredPrefixSamples: 0,
  };
}
async function render(corpus: Corpus, candidate: boolean) {
  const length = Math.ceil((corpus.ticks.at(-1)!.time + 2) * 48000);
  const context = new OfflineAudioContext(2, length, 48000);
  const engine = new AudioEngine({
    context,
    budget: BUDGET,
    oscillatorModel: "nativeReference",
    virtualization: candidate ? POLICY : false,
    spatializationModel: "equalpower",
    offlineOutputTap: "dryContent",
  });
  const observations = [];
  try {
    await engine.enable(0);
    // Register ALL checkpoints before rendering. No wall timer drives audio time.
    const pauses = corpus.ticks.map((t) =>
      context.suspend((Math.ceil((t.time * 48000) / 128) * 128) / 48000),
    );
    const rendering = context.startRendering();
    for (let i = 0; i < corpus.ticks.length; i++) {
      await pauses[i];
      const tick = corpus.ticks[i]!;
      for (const op of tick.operations) apply(engine, structuredClone(op));
      engine.flushControlUpdates();
      const t = engine.getTelemetry();
      check(t.activeRenderedCap === 24 && t.activeVoices <= 24, "formal voice capacity changed");
      check(
        t.nativeSourceNodes <= t.nativeCarrierBudget &&
          t.nativeSlotsInUse <= t.nativeGraphTotalBudget,
        "native cap exceeded",
      );
      observations.push({
        tick: tick.tick,
        actualAudioTime: context.currentTime,
        intendedTime: tick.time,
        nativeSlots: t.nativeSlotsInUse,
        virtual: t.virtualVoices,
      });
      await context.resume();
    }
    const buffer = await rendering;
    const channels = [
      new Float32Array(buffer.getChannelData(0)),
      new Float32Array(buffer.getChannelData(1)),
    ];
    return { channels, observations };
  } finally {
    await engine.disposeAsync();
  }
}
function nativeAssetAdapter(): AssetAdapter {
  let context: OfflineAudioContext;
  let parked: Promise<void>;
  let rendering: Promise<AudioBuffer> | null = null;
  return {
    method:
      "Native OfflineAudioContext decode; BlobStore memory backend; ownership accounting only, decoder scratch/RAM/GC unknown",
    createEngine: () => {
      context = new OfflineAudioContext(2, 48000, 48000);
      parked = context.suspend((Math.ceil((0.05 * 48000) / 128) * 128) / 48000);
      return new AudioEngine({
        context,
        budget: BUDGET,
        oscillatorModel: "nativeReference",
        virtualization: false,
      });
    },
    setTime: async () => {
      rendering = context.startRendering();
      rendering.catch(() => {});
      await parked;
    },
    createContext: (rate) => new OfflineAudioContext(1, 1, rate),
  };
}

declare global {
  interface Window {
    runVoiceAsset(dataBase: string): Promise<unknown>;
    saveVoiceAssetPcm(name: string, base64: string): Promise<void>;
  }
}
window.runVoiceAsset = async (dataBase) => {
  const response = await fetch(`${dataBase}/corpus.json`);
  check(response.ok, "corpus unavailable");
  const corpus = (await response.json()) as Corpus;
  check(JSON.stringify(corpus.budget) === JSON.stringify(BUDGET), "capacity pin mismatch");
  const manifest = (await (await fetch(`${dataBase}/fixtures.json`)).json()) as Omit<
    WaveFixture,
    "bytes"
  >[];
  const fixtures: WaveFixture[] = [];
  for (const f of manifest) {
    const bytes = await (await fetch(`${dataBase}/${f.name}`)).arrayBuffer();
    check((await digest(bytes)) === f.sha256, "fixture hash mismatch");
    fixtures.push({ ...f, bytes });
  }
  const save = async (name: string, pcm: Float32Array) => {
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      const chunk = bytes.subarray(offset, offset + 32768);
      let raw = "";
      for (const byte of chunk) raw += String.fromCharCode(byte);
      await window.saveVoiceAssetPcm(name, btoa(raw));
    }
  };
  const reference = await render(corpus, false),
    candidate = await render(corpus, true);
  const whole = reference.channels.map((a, ch) => metrics(a, candidate.channels[ch]!));
  const windows = corpus.ticks.map((tick, i) => ({
    tick: tick.tick,
    channels: reference.channels.map((a, ch) =>
      metrics(
        a,
        candidate.channels[ch]!,
        Math.floor(tick.time * 48000),
        Math.min(a.length, Math.floor((corpus.ticks[i + 1]?.time ?? tick.time + 0.1) * 48000)),
      ),
    ),
  }));
  for (const [arm, data] of [
    ["reference", reference],
    ["candidate", candidate],
  ] as const) {
    for (let ch = 0; ch < 2; ch++) {
      await save(`${arm}-${ch}.f32`, data.channels[ch]!);
    }
  }
  const seed = corpus.ticks.flatMap((t) => t.operations).find((o) => o.kind === "start");
  check(seed?.kind === "start", "missing runtime starts");
  const phase = [];
  for (const waveform of ["sine", "square", "sawtooth", "triangle", "sample-loop"] as const) {
    const a = await renderPhase(seed.input, seed.frame, false, waveform),
      b = await renderPhase(seed.input, seed.frame, true, waveform);
    check(JSON.stringify(a.samplePin) === JSON.stringify(b.samplePin), "phase asset pin mismatch");
    await save(`phase-${waveform}-reference.f32`, a.pcm);
    await save(`phase-${waveform}-candidate.f32`, b.pcm);
    phase.push({
      waveform,
      samplePin: a.samplePin,
      metrics: metrics(a.pcm, b.pcm),
      reference: a.observations,
      candidate: b.observations,
      referenceAdmissions: a.admissions,
      candidateAdmissions: b.admissions,
    });
  }
  const assets = await compareAssets(fixtures, nativeAssetAdapter, seed.frame);
  const checks = [...whole, ...phase.map((p) => p.metrics)];
  return {
    status: checks.every(
      (m) =>
        m.nonFinite === 0 &&
        m.aboveTolerance === 0 &&
        m.referenceOnset >= 0 &&
        m.onsetDifferenceSamples === 0,
    )
      ? "PASS"
      : "FAIL",
    method:
      "Native OAC renders the exact Node-recorded runtime intents; dry-content phase/onset comparator, entire PCM including first sample. Equalpower spatialization pin; not hardware/HRTF/IR-history equivalence or performance adoption.",
    tolerance: PCM_TOLERANCE,
    whole,
    windows,
    phase,
    referenceObservations: reference.observations,
    candidateObservations: candidate.observations,
    assets,
  };
};
document.body.textContent = "Voice/asset OfflineAudioContext fixture ready";
