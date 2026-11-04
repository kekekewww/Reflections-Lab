import { createRenderRecordingFixture } from "../../../audio-runtime/render-fixture.js";
import { createRenderPreset } from "../../../../src/audio/render-preset.js";
import { MAX_MONITOR_GAIN } from "../../../../src/audio/monitor-level.js";
import { NativeOfflineRenderBackend } from "../../../../src/audio/render-backend.js";
import { encodeFloatWave, hashRenderBytes } from "../../../../src/audio/render-pcm.js";
import { validateRenderJob } from "../../../../src/audio/render-validation.js";
import { IndexedDBRenderOutputStore } from "../../../../src/audio/render-output-store.js";
import { canonicalStringify, sha256Canonical } from "../../../../src/experiments/hash.js";
import { validateNativeWriterOwnership } from "./native-ownership.js";
import { validateNativeOutputStore } from "./native-storage.js";
import {
  summarizePcmDifference,
  persistDiagnosticWave,
  renderFrozenMaster,
  type DiagnosticPcm,
  type DiagnosticWave,
  type PcmDifferenceSummary,
} from "./diagnostics.js";
import { renderWholeNativeReference } from "./native-reference.js";
import type { SceneSpec } from "../../../../src/scene/types.js";
import type { RenderExportManifest } from "../../../../src/audio/render-types.js";

const checks: { id: string; pass: boolean; evidence: unknown }[] = [];
function check(id: string, pass: boolean, evidence: unknown) {
  checks.push({ id, pass, evidence });
  console.info(`LONG_CHECK:${id}:${pass}`);
}
let backend: NativeOfflineRenderBackend;
let manifest: RenderExportManifest;
let diagnosticStore: IndexedDBRenderOutputStore | null = null;
interface DiagnosticManifest {
  schemaVersion: "long-native-diagnostic-v1";
  sourceJobId: string;
  jobId: string;
  inputRecordingSha256: string;
  frozenInputWaveSha256: string;
  frozenInputPeak: number;
  frozenMasterBounds: Record<string, { peak: number; outsideUnit: number }>;
  files: DiagnosticWave[];
  comparisons: { id: string; summary: PcmDifferenceSummary }[];
  productControlSamples: Record<string, number[]>;
  referenceControlSamples: Record<string, number[]>;
  limitations: string[];
}
let diagnosticManifest: DiagnosticManifest | null = null;
function arraysPcm(channels: readonly Float32Array[]): DiagnosticPcm {
  return {
    channels: channels.length,
    frames: channels[0]!.length,
    sample: (channel, frame) => channels[channel]![frame]!,
  };
}
function wavePcm(file: Awaited<ReturnType<typeof filePcm>>): DiagnosticPcm {
  return {
    channels: file.channels,
    frames: file.frames,
    sample: (channel, frame) =>
      file.view.getFloat32(56 + (frame * file.channels + channel) * 4, true),
  };
}

const originalWave = encodeFloatWave(
  [
    Float32Array.from(
      { length: 96000 },
      (_, i) => 0.7 * Math.sin((2 * Math.PI * i) / 240) + 0.15 * Math.sin((2 * Math.PI * i) / 59),
    ),
  ],
  48000,
).bytes;

async function filePcm(id: string) {
  const blob = await backend.getFileBlob(manifest.job.jobId, id);
  if (!blob) throw new Error(`LONG_FILE_MISSING:${id}`);
  const bytes = await blob.arrayBuffer();
  const view = new DataView(bytes);
  const channels = view.getUint16(22, true),
    frames = view.getUint32(44, true);
  if (
    view.getUint32(4, true) + 8 !== bytes.byteLength ||
    view.getUint32(52, true) !== frames * channels * 4
  )
    throw new Error("LONG_RIFF_SIZE");
  return { bytes, view, channels, frames, sha256: await hashRenderBytes(new Uint8Array(bytes)) };
}

async function validateNativeStores() {
  checks.length = 0;
  for (const value of await validateNativeOutputStore())
    check(value.id, value.pass, value.evidence);
  for (const value of await validateNativeWriterOwnership())
    check(value.id, value.pass, value.evidence);
  return finish();
}
async function validateLong() {
  checks.length = 0;
  const fixedMixSha256 = "e3be2a05a360a29d56c182e532dceab1d861c32ba39fa01fc02378ca9bd4f33e";
  const fixedMixResponse = await fetch("/__long-diagnostic-baseline-mix.wav", {
    cache: "no-store",
  });
  if (!fixedMixResponse.ok) throw new Error("FIXED_ATTEMPT01_MIX_UNAVAILABLE");
  const fixedMixBytes = await fixedMixResponse.arrayBuffer();
  const fixedMixView = new DataView(fixedMixBytes);
  if (
    fixedMixBytes.byteLength !== 23808056 ||
    (await hashRenderBytes(new Uint8Array(fixedMixBytes))) !== fixedMixSha256 ||
    fixedMixView.getUint32(4, true) + 8 !== fixedMixBytes.byteLength ||
    fixedMixView.getUint16(20, true) !== 3 ||
    fixedMixView.getUint16(22, true) !== 2 ||
    fixedMixView.getUint32(24, true) !== 48000 ||
    fixedMixView.getUint32(44, true) !== 2976000 ||
    fixedMixView.getUint32(52, true) !== 2976000 * 8
  )
    throw new Error("FIXED_ATTEMPT01_MIX_IDENTITY");
  const frozenInput = new AudioBuffer({ numberOfChannels: 2, length: 2976000, sampleRate: 48000 });
  let fixedMixPeak = 0;
  for (let channel = 0; channel < 2; channel++) {
    const samples = frozenInput.getChannelData(channel);
    for (let frame = 0; frame < 2976000; frame++) {
      const value = fixedMixView.getFloat32(56 + (frame * 2 + channel) * 4, true);
      if (!Number.isFinite(value)) throw new Error("FIXED_ATTEMPT01_MIX_NONFINITE");
      fixedMixPeak = Math.max(fixedMixPeak, Math.abs(value));
      samples[frame] = value;
    }
  }
  check("fixed-attempt01-mix-dependency", true, {
    sha256: fixedMixSha256,
    frames: 2976000,
    origin: "Preserved attempt01; b73512364d00bc1b8115e82b9a449b84b1a620be",
    scope: "Diagnostic input only; not a new product output.",
  });
  const sourceHash = await hashRenderBytes(originalWave);
  const audio = new OfflineAudioContext(1, 1, 48000);
  const sample = await audio.decodeAudioData(originalWave.buffer.slice(0));
  const pin = { assetId: "asset.original-long-loop", revision: 1, sha256: sourceHash };
  let scene!: SceneSpec;
  const started = performance.now();
  const recording = await createRenderRecordingFixture({
    end: 3601,
    allowLongTake: true,
    grabTick: null,
    runId: "run.long-native-3601",
    assets: [
      { ...pin, availability: "READY", rightsStatus: "APPROVED", durationSeconds: sample.duration },
    ],
    editScene(value) {
      scene = value;
      // A finite DSP/reference fixture, not the formal performance workload.
      value.objects = value.objects.filter((object) =>
        ["floor", "speaker", "ball"].includes(object.id),
      );
    },
    editDocument(document) {
      document.assets = [pin];
      document.profiles = [document.profiles[0]!];
      const rule = document.profiles[0]!.rules[0]!;
      rule.generator = { kind: "sample", asset: pin, loop: true, startOffsetSeconds: 0.125 };
      rule.gainLinear = 0.9;
      rule.mappings = [
        {
          mappingId: "mapping.long-pitch",
          input: "sourceSpeedMetresPerSecond",
          target: "pitchSemitones",
          inputMin: 0,
          inputMax: 10,
          outputMin: -7,
          outputMax: 7,
          curve: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          interpolation: "linear",
          clamp: true,
          smoothingSeconds: 0.01,
        },
      ];
      document.bindings = [document.bindings.find((binding) => binding.objectId === "speaker")!];
      document.bindings[0]!.overrides = [{ ruleId: rule.ruleId, gainLinear: 0.9 }];
      document.bindings.push({
        ...document.bindings[0]!,
        bindingId: "binding.long-ball",
        objectId: "ball",
        overrides: [{ ruleId: rule.ruleId, gainLinear: 0.75, pitchSemitones: 4 }],
      });
    },
    editInput(frame) {
      const seconds = frame.tick / 60;
      for (const object of frame.objects) {
        if (object.objectId === "floor") continue;
        object.positionMetres[0] +=
          Math.sin(seconds * 0.7) * (object.objectId === "ball" ? 2.7 : 0.6);
        object.metrics.sourceSpeedMetresPerSecond = 5 + 4 * Math.sin(seconds * 0.37);
      }
      scene.listener.positionM[0] = 0.35 * Math.sin(seconds * 0.4);
    },
    editFrame(frame) {
      // An explicit finite quality-selection test: all retained paths were actually
      // solved. Remove/reintroduce early taps across a known encoding seam; this is
      // not a fabricated ray or a claim that authored poses came from physics.
      if (frame.tick >= 43 && frame.tick < 84)
        frame.acousticFrames = frame.acousticFrames.map((acoustic) => ({
          ...acoustic,
          paths: acoustic.paths.filter((path) => path.order === 0),
        }));
    },
  });
  const pathSets = new Map<string, string>();
  const transitions: {
    tick: number;
    sourceId: string;
    outputControlSample: number;
    seamDistance: number;
  }[] = [];
  for (const frame of recording.frames)
    for (const acoustic of frame.acousticFrames) {
      const key = acoustic.paths
        .map((path) => path.id)
        .sort()
        .join("|");
      const previous = pathSets.get(acoustic.sourceId);
      if (previous !== undefined && previous !== key) {
        const outputControlSample = Math.floor(((frame.tick - 1) * 800) / 128) * 128 - 800;
        const phase = ((outputControlSample % 32768) + 32768) % 32768;
        transitions.push({
          tick: frame.tick,
          sourceId: acoustic.sourceId,
          outputControlSample,
          seamDistance: Math.min(phase, 32768 - phase),
        });
      }
      pathSets.set(acoustic.sourceId, key);
    }
  check(
    "actual-solved-path-birth-death-at-encoding-seam",
    transitions.length >= 2 && transitions.some((value) => value.seamDistance <= 128),
    {
      transitions,
      policy:
        "Finite explicit selection of actual solved paths; not the formal performance workload.",
    },
  );
  const captureMs = performance.now() - started;
  check(
    "actual-3601-tick-capture-preserves-original-64MiB-18000-frame-caps",
    recording.status === "captured" &&
      recording.frameCount === 3601 &&
      recording.traceBytes <= 64 * 1024 * 1024,
    {
      status: recording.status,
      frames: recording.frameCount,
      traceBytes: recording.traceBytes,
      captureMs,
      artifactSha256: recording.artifactSha256,
      recordingSchema: recording.schemaVersion,
    },
  );
  check(
    "same-recorded-input-as-preserved-attempt01",
    recording.artifactSha256 === "7ee6ae2185b90cf5bab1fe2dc7dcbbae0a0946651de4e0aaeca1538072e16827",
    {
      actual: recording.artifactSha256,
      expected: "7ee6ae2185b90cf5bab1fe2dc7dcbbae0a0946651de4e0aaeca1538072e16827",
    },
  );
  const preset = await createRenderPreset(
    recording,
    [
      {
        assetId: pin.assetId,
        buffer: sample,
        metadata: {
          revision: 1,
          sha256: sourceHash,
          name: "Original long native loop",
          origin: "generated",
          license: "ORIGINAL_TEST_FIXTURE",
        },
      },
    ],
    { tailSeconds: 2, spatializationModel: "HRTF" },
    {
      headroomGain: 1,
      monitorGain: MAX_MONITOR_GAIN,
      limiterEnabled: true,
      outputSafetyClip: true,
      lateReverb: { enabled: true, decaySeconds: 1.2, wetGain: 0.15, seed: 1746 },
    },
    `render.long-native-${Date.now()}`,
  );
  const job = {
    ...preset.job,
    window: { ...preset.job.window, startTick: 2, endTickExclusive: 3602, preRollFrames: 800 },
  };
  const plan = validateRenderJob(job, preset.input);
  const store = new IndexedDBRenderOutputStore({
    name: `reflection-lab-long-native-${Date.now()}`,
  });
  const productControls = new Map<string, number[]>();
  let contextOrdinal = 0;
  backend = new NativeOfflineRenderBackend({
    input: preset.input,
    outputStore: store,
    createContext(channels, frames, rate) {
      const request = job.outputs[contextOrdinal++];
      if (!request) throw new Error("DIAGNOSTIC_EXTRA_PRODUCT_CONTEXT");
      const context = new OfflineAudioContext(channels, frames, rate);
      const actualSamples: number[] = [];
      productControls.set(request.id, actualSamples);
      const originalSuspend = context.suspend.bind(context);
      context.suspend = (time) => {
        const pending = originalSuspend(time);
        // Observe the original native promise; do not replace it or set any DSP parameter.
        void pending.then(
          () => {
            actualSamples.push(Math.round(context.currentTime * rate));
          },
          () => undefined,
        );
        return pending;
      };
      return context;
    },
  });
  const renderStart = performance.now();
  const result = await backend.render(job);
  check("native-long-five-output-completion", result.status === "completed", {
    result,
    renderMs: performance.now() - renderStart,
    plan,
  });
  if (result.status !== "completed") return finish();
  manifest = backend.getManifest(job.jobId)!;
  check(
    "true-long-async-files-and-no-resident-legacy-WAV-cache",
    manifest.files.length === 5 &&
      result.outputs.every(
        (output) =>
          output.frames === 2976000 && output.channels === 2 && output.sampleRateHz === 48000,
      ) &&
      backend.getFile(job.jobId, "mix") === null,
    { files: manifest.files, store: await backend.getStorageSnapshot(job.jobId) },
  );
  const mix = await filePcm("mix");
  let maximumStemSumError = 0,
    seamStemSumError = 0,
    mixPeak = 0;
  const stems = manifest.files.filter((file) => file.id.startsWith("stem-"));
  const sum = new Float64Array(mix.frames * mix.channels);
  for (const stem of stems) {
    const pcm = await filePcm(stem.id);
    for (let index = 0; index < sum.length; index++)
      sum[index] = sum[index]! + pcm.view.getFloat32(56 + index * 4, true);
    check(`persisted-hash-${stem.id}`, pcm.sha256 === stem.sha256, {
      sha256: pcm.sha256,
      bytes: pcm.bytes.byteLength,
    });
  }
  for (let frame = 0; frame < mix.frames; frame++)
    for (let channel = 0; channel < mix.channels; channel++) {
      const index = frame * mix.channels + channel;
      const mixed = mix.view.getFloat32(56 + index * 4, true);
      mixPeak = Math.max(mixPeak, Math.abs(mixed));
      const error = Math.abs(mixed - sum[index]!);
      maximumStemSumError = Math.max(maximumStemSumError, error);
      const distance = Math.min(frame % 32768, 32768 - (frame % 32768));
      if (distance <= 128) seamStemSumError = Math.max(seamStemSumError, error);
    }
  check(
    "long-owner-stems-sum-original-2e-6-tolerance",
    stems.length === 2 && maximumStemSumError <= 2e-6,
    { maximumStemSumError, seamStemSumError, tolerance: 2e-6 },
  );
  const diagnosticIds = [
    "reference-mix63",
    "reference-master63",
    "reference-dry63",
    "reference-master62",
    "master-frozen-input62",
    "master-frozen-a62",
    "master-frozen-b62",
    "master-frozen-c63",
  ];
  const diagnosticJobId = `${job.jobId}.diagnostics`;
  diagnosticStore = store;
  diagnosticManifest = {
    schemaVersion: "long-native-diagnostic-v1",
    sourceJobId: job.jobId,
    jobId: diagnosticJobId,
    inputRecordingSha256: recording.artifactSha256,
    frozenInputWaveSha256: fixedMixSha256,
    frozenInputPeak: fixedMixPeak,
    frozenMasterBounds: {},
    files: [],
    comparisons: [],
    productControlSamples: Object.fromEntries(
      [...productControls].map(([id, values]) => [id, [...values]]),
    ),
    referenceControlSamples: {},
    limitations: [
      "Diagnostic artifacts are outside the unchanged five-file product manifest and do not replace its original whole-graph gate.",
      "Frozen master chains start from the bit-exact attempt01 cropped mix with known-zero native history, not restored source/propagation history.",
      "Native full PCM and statistics/frozen-input buffers consume additional test-oracle memory, outside the product working-memory estimate.",
    ],
  };
  await store.begin(diagnosticJobId, 192 * 1024 * 1024, diagnosticIds, 192000448);
  const saveDiagnostic = async (id: string, channels: readonly Float32Array[]) => {
    const saved = await persistDiagnosticWave(store, diagnosticJobId, id, channels, 48000);
    diagnosticManifest!.files.push(saved);
    if (/^master-frozen-[abc]6[23]$/.test(id)) {
      let peak = 0,
        outsideUnit = 0;
      for (const channel of channels)
        for (const sample of channel) {
          peak = Math.max(peak, Math.abs(sample));
          if (Math.abs(sample) > 1) outsideUnit++;
        }
      diagnosticManifest!.frozenMasterBounds[id] = { peak, outsideUnit };
      check(`diagnostic-bounds-${id}`, peak > 0 && peak <= 1 && outsideUnit === 0, {
        peak,
        outsideUnit,
      });
    }
    return saved;
  };
  const compare = (id: string, actual: DiagnosticPcm, expected: DiagnosticPcm) => {
    const summary = summarizePcmDifference(actual, expected, {
      frames: actual.frames,
      sampleRateHz: 48000,
      tolerance: 2e-6,
    });
    diagnosticManifest!.comparisons.push({ id, summary });
    return summary;
  };
  const compareControls = async (id: string, requestId: string, reference: number[]) => {
    const actual = productControls.get(requestId)!;
    const differences = reference
      .map((sample, index) => ({ index, actual: actual[index] ?? null, reference: sample }))
      .filter((point) => point.actual !== point.reference);
    diagnosticManifest!.referenceControlSamples[id] = [...reference];
    check(id, actual.length === reference.length && differences.length === 0, {
      actualCount: actual.length,
      referenceCount: reference.length,
      mismatchCount: differences.length,
      firstMismatches: differences.slice(0, 8),
      actualSha256: await sha256Canonical(actual),
      referenceSha256: await sha256Canonical(reference),
    });
  };
  for (const tap of ["simulatedMix", "master", "dryContent"] as const) {
    const id = tap === "simulatedMix" ? "mix" : tap === "dryContent" ? "dry" : "master";
    const referenceJob = {
      ...job,
      window: { ...job.window, tailFrames: job.window.tailFrames + 48000 },
    };
    const reference = await renderWholeNativeReference(preset.input, referenceJob, tap);
    const exported = id === "mix" ? mix : await filePcm(id);
    const summary = compare(
      `whole-native-reference-${id}`,
      wavePcm(exported),
      arraysPcm(reference.channels),
    );
    let extraTailPeak = 0;
    for (const channel of reference.channels)
      for (let frame = exported.frames; frame < channel.length; frame++)
        extraTailPeak = Math.max(extraTailPeak, Math.abs(channel[frame]!));
    check(`extra-native-reference-tail-${id}`, extraTailPeak <= 2e-6, {
      extraTailPeak,
      additionalReferenceFrames: 48000,
      tolerance: 2e-6,
      scope: "Original finite fixture only; no universal opaque decay bound.",
    });
    // Original 63-second whole-reference gate remains authoritative and unchanged.
    check(
      `whole-native-reference-${id}`,
      summary.maxError <= 2e-6 && summary.nonfinite.count === 0,
      summary,
    );
    await compareControls(`actual-controls-${id}-63`, id, reference.controls);
    await saveDiagnostic(`reference-${id}63`, reference.channels);
    check(
      `persisted-hash-${id}`,
      exported.sha256 === manifest.files.find((file) => file.id === id)!.sha256,
      { sha256: exported.sha256, bytes: exported.bytes.byteLength },
    );
  }
  {
    const reference = await renderWholeNativeReference(preset.input, job, "master");
    const masterFile = await filePcm("master");
    const summary = compare(
      "same-length-master-reference-62",
      wavePcm(masterFile),
      arraysPcm(reference.channels),
    );
    check(
      "same-length-master-reference-62",
      summary.maxError <= 2e-6 && summary.nonfinite.count === 0,
      summary,
    );
    await compareControls("actual-controls-master-62", "master", reference.controls);
    await saveDiagnostic("reference-master62", reference.channels);
  }
  check(
    "diagnostic-frozen-input-excites-original-limiter",
    fixedMixPeak *
      preset.input.configuration.master.headroomGain *
      preset.input.configuration.master.monitorGain >
      10 ** (-3 / 20),
    {
      frozenInputSha256: fixedMixSha256,
      peak: fixedMixPeak,
      beforeLimiterPeak:
        fixedMixPeak *
        preset.input.configuration.master.headroomGain *
        preset.input.configuration.master.monitorGain,
      thresholdLinear: 10 ** (-3 / 20),
    },
  );
  const fixedInputCopy = await saveDiagnostic("master-frozen-input62", [
    frozenInput.getChannelData(0),
    frozenInput.getChannelData(1),
  ]);
  check("diagnostic-fixed-input-copy-bit-exact", fixedInputCopy.sha256 === fixedMixSha256, {
    expected: fixedMixSha256,
    actual: fixedInputCopy.sha256,
    bytes: fixedInputCopy.bytes,
  });
  const frozenA = await renderFrozenMaster(
    frozenInput,
    preset.input.configuration.master,
    mix.frames,
  );
  await saveDiagnostic("master-frozen-a62", frozenA);
  for (const [id, frames] of [
    ["master-frozen-b62", mix.frames],
    ["master-frozen-c63", mix.frames + 48000],
  ] as const) {
    const frozen = await renderFrozenMaster(frozenInput, preset.input.configuration.master, frames);
    const summary = compare(id, arraysPcm(frozenA), arraysPcm(frozen));
    check(id, summary.maxError <= 2e-6 && summary.nonfinite.count === 0, {
      ...summary,
      inputFileSha256: fixedMixSha256,
      scope:
        "Bit-exact cropped PCM repeat/length diagnostic only; not the original whole-source gate.",
    });
    await saveDiagnostic(id, frozen);
  }
  check(
    "diagnostic-eight-files-with-original-store-caps",
    diagnosticManifest.files.length === 8 &&
      diagnosticManifest.files.reduce((total, file) => total + file.bytes, 0) === 192000448,
    {
      files: diagnosticManifest.files,
      usage: await store.getArchiveUsage(),
      productFilesUnchanged: manifest.files.length === 5,
    },
  );
  await store.publish(diagnosticJobId, canonicalStringify(diagnosticManifest));
  check(
    "native-limiter-threshold-excited",
    mixPeak *
      preset.input.configuration.master.headroomGain *
      preset.input.configuration.master.monitorGain >
      10 ** (-3 / 20),
    {
      mixPeak,
      beforeLimiterPeak:
        mixPeak *
        preset.input.configuration.master.headroomGain *
        preset.input.configuration.master.monitorGain,
      thresholdLinear: 10 ** (-3 / 20),
    },
  );
  const master = result.outputs.find((output) => output.requestId === "master")!;
  check(
    "master-finite-and-safety-bounds",
    master.samplesOutsideUnitRange === 0 && master.peakLinear > 0 && master.peakLinear <= 1,
    { peakLinear: master.peakLinear, outside: master.samplesOutsideUnitRange },
  );
  check(
    "warmup-history-and-tail-explicit",
    result.outputs.every((output) => !output.historyIncomplete) &&
      result.outputs.every((output) => !output.tailTruncated),
    {
      prerollFrames: 800,
      capturedWarmupSeconds: 1 / 60,
      sourceBirthCaptured: true,
      tailFrames: 96000,
      historyIncomplete: result.outputs.map((output) => output.historyIncomplete),
      tailTruncated: result.outputs.map((output) => output.tailTruncated),
    },
  );
  return finish();
}
function finish() {
  return {
    status: checks.every((value) => value.pass) ? "PASS" : "FAIL",
    checks,
    userAgent: navigator.userAgent,
    limitations: [
      "Digital native offline PCM; no hardware, hearing, SPL, full V1 or formal performance claim.",
      "Reference shares AudioEngine/ReplayAudioHost but uses independent whole-take orchestration. Browser-managed native DSP is not independent scientific validation.",
      "Chunked encoding/persistence keeps a whole native AudioBuffer per tap. Browser Blob/native allocations remain real costs.",
    ],
  };
}
Object.assign(window, {
  runNativeStoreValidation: validateNativeStores,
  runNativeLongValidation: validateLong,
  async nativeLongDownload(id: string) {
    const diagnosticId = id.startsWith("diagnostic:") ? id.slice("diagnostic:".length) : null;
    let blob: Blob | null;
    let filename: string;
    if (id === "manifest") {
      blob = new Blob([canonicalStringify(manifest)], { type: "application/json" });
      filename = "long.manifest.json";
    } else if (id === "original-asset") {
      blob = new Blob([originalWave], { type: "audio/wav" });
      filename = "original-asset.wav";
    } else if (id === "diagnostic-manifest" && diagnosticManifest) {
      blob = new Blob([canonicalStringify(diagnosticManifest)], { type: "application/json" });
      filename = "long.diagnostics.json";
    } else if (diagnosticId && diagnosticManifest && diagnosticStore) {
      blob = await diagnosticStore.readBlob(diagnosticManifest.jobId, diagnosticId);
      filename = `${diagnosticId}.diagnostic.wav`;
    } else {
      blob = await backend.getFileBlob(manifest.job.jobId, id);
      filename = `${id}.wav`;
    }
    if (!blob) throw new Error("LONG_DOWNLOAD_MISSING");
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  nativeLongManifest: () => manifest,
  nativeLongDiagnosticManifest: () => diagnosticManifest,
  nativeLongCheckSnapshot: () => checks,
});
document.body.textContent = "Long native fixture ready";
declare global {
  interface Window {
    runNativeStoreValidation: () => Promise<ReturnType<typeof finish>>;
    runNativeLongValidation: () => Promise<ReturnType<typeof finish>>;
    nativeLongDownload: (id: string) => Promise<void>;
    nativeLongManifest: () => RenderExportManifest;
    nativeLongDiagnosticManifest: () => DiagnosticManifest | null;
    nativeLongCheckSnapshot: () => typeof checks;
  }
}
