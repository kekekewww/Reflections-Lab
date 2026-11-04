import {
  IndexedDBRenderOutputStore,
  RENDER_OUTPUT_MAX_MANIFEST_BYTES,
  RENDER_OUTPUT_MAX_ARCHIVE_BYTES,
  RENDER_OUTPUT_MAX_JOB_BYTES,
} from "../../../../src/audio/render-output-store.js";
import { IncrementalSha256 } from "../../../../src/persistence/incremental-sha256.js";
import { canonicalStringify, sha256Canonical } from "../../../../src/experiments/hash.js";
import { validateRenderJob, RENDER_LIMITS } from "../../../../src/audio/render-validation.js";
import { renderWholeNativeReference } from "./native-reference.js";
import {
  persistDiagnosticWave,
  summarizePcmDifference,
  type DiagnosticPcm,
  type PcmDifferenceSummary,
} from "./diagnostics.js";
import {
  createPairedNativeSource,
  PAIRED_RATE,
  PAIRED_62_FRAMES,
  PAIRED_63_FRAMES,
  PAIRED_ENCODED_BYTES,
  type PairedNativeSource,
  type PairedSourceIdentity,
} from "./paired-source.js";
import type { RenderConfiguration } from "../../../../src/audio/render-types.js";
import type { RenderJob } from "../../../../src/audio/render-contract.js";

const ORDER = ["master-62a", "master-63a", "master-63b", "master-62b"] as const;
type GraphId = (typeof ORDER)[number];
const GRAPH_FRAMES: Record<GraphId, number> = {
  "master-62a": PAIRED_62_FRAMES,
  "master-63a": PAIRED_63_FRAMES,
  "master-63b": PAIRED_63_FRAMES,
  "master-62b": PAIRED_62_FRAMES,
};
const PAIRS: { id: string; actualId: GraphId; referenceId: GraphId; frames: number }[] = [
  {
    id: "same-duration-62",
    actualId: "master-62a",
    referenceId: "master-62b",
    frames: PAIRED_62_FRAMES,
  },
  {
    id: "same-duration-63",
    actualId: "master-63a",
    referenceId: "master-63b",
    frames: PAIRED_63_FRAMES,
  },
  {
    id: "cross-62a-63a",
    actualId: "master-62a",
    referenceId: "master-63a",
    frames: PAIRED_62_FRAMES,
  },
  {
    id: "cross-62a-63b",
    actualId: "master-62a",
    referenceId: "master-63b",
    frames: PAIRED_62_FRAMES,
  },
  {
    id: "cross-62b-63a",
    actualId: "master-62b",
    referenceId: "master-63a",
    frames: PAIRED_62_FRAMES,
  },
  {
    id: "cross-62b-63b",
    actualId: "master-62b",
    referenceId: "master-63b",
    frames: PAIRED_62_FRAMES,
  },
];
interface PairedCheck {
  id: string;
  pass: boolean;
  evidence: unknown;
}
interface PairedFile {
  id: GraphId;
  filename: string;
  bytes: number;
  sha256: string;
  frames: number;
  channels: 2;
  rate: 48000;
}
interface ExpectedOutput {
  id: string;
  filename: string;
  bytes: number;
  sha256: string;
}
interface GraphObservation {
  id: GraphId;
  frames: number;
  contextFrames: number;
  tailFrames: number;
  peak: number;
  outsideUnit: number;
  nonfinite: number;
  controlSha256: string;
  startedAtUtc: string;
  finishedAtUtc: string;
  renderMs: number;
  persistMs: number;
  estimatedWorkingBytes: number;
}
interface PairObservation {
  id: string;
  actualId: GraphId;
  referenceId: GraphId;
  frames: number;
  summary: PcmDifferenceSummary;
}
interface PairedManifest {
  schemaVersion: "paired-native-whole-master-v1";
  status: "PASS" | "FAIL" | "ERROR";
  source: PairedSourceIdentity;
  configuration: RenderConfiguration;
  order: readonly GraphId[];
  files: PairedFile[];
  graphs: GraphObservation[];
  comparisons: PairObservation[];
  controls: {
    expectedCount: 3602;
    expectedSamples: number[];
    expectedSha256: string;
    byGraph: Partial<Record<GraphId, number[]>>;
    sha256ByGraph: Partial<Record<GraphId, string>>;
    identicalAcrossGraphs: boolean;
  };
  historical: {
    attempt02: "FAIL_PRESERVED";
    originalWhole63Gate: "NOT_RERUN";
    original16Downloads: "INCOMPLETE_PRESERVED";
    pairedDoesNotReplaceProductGate: true;
  };
  publication: {
    kind: "diagnosticFourWavesThenSeparateMetadataBlob";
    databaseName: string;
    jobId: string;
    diagnosticStoreManifest: null;
    sidecarIsPortableProductManifest: false;
    sidecarStoredInOutputJob: false;
  };
  resource: {
    maxWorkingBytes: number;
    maxJobEncodedBytes: number;
    maxArchivePayloadBytes: number;
    maxSidecarBytes: number;
    expectedEncodedBytes: number;
    storedEncodedBytes: number;
    maximumEncodedAndSidecarPayloadBytes: number;
    largestContextPcmBytes: number;
    maximumTwoWaveReadBytes: number;
    oneBlobReadAllowanceBytes: number;
    pairedReadEstimatedWorkingBytes: number;
    observedPairArrayBufferBytes: { id: string; bytes: number }[];
    comparisonFullJobAuditBytes: number;
    downloadFullJobAuditBytes: number;
    nativeHeapMeasuredBytes: null;
    javascriptHeapMeasuredBytes: null;
    encodedChunkFrames: 32768;
    retainedWholeRenderedOutputsBetweenGraphs: 0;
    retainedWholeWavByteArraysBetweenPairs: 0;
    policy: string;
  };
  timing: {
    startedAtUtc: string;
    finishedAtUtc: string;
    preparationMs: number;
    renderMs: number;
    persistMs: number;
    comparisonMs: number;
    totalMs: number;
  };
  checks: PairedCheck[];
  error?: string;
  limitations: string[];
}
interface LoadedPcm {
  bytes: ArrayBuffer;
  vector: DiagnosticPcm;
}
interface PairedResult {
  status: "PASS" | "FAIL" | "ERROR";
  checks: PairedCheck[];
  summary: unknown;
}

const checks: PairedCheck[] = [];
let operation: Promise<PairedResult> | null = null;
let store: IndexedDBRenderOutputStore | null = null;
let sidecar: PairedManifest | null = null;
let sidecarBlob: Blob | null = null;
let expectedOutputs: ExpectedOutput[] | null = null;
const HISTORICAL = Object.freeze({
  attempt02: "FAIL_PRESERVED",
  originalWhole63Gate: "NOT_RERUN",
  original16Downloads: "INCOMPLETE_PRESERVED",
  pairedDoesNotReplaceProductGate: true,
} as const);
function check(id: string, pass: boolean, evidence: unknown): void {
  checks.push({ id, pass, evidence });
  console.info(`PAIRED_CHECK:${id}:${pass}`);
}
function hashView(bytes: Uint8Array): string {
  const hash = new IncrementalSha256();
  for (let offset = 0; offset < bytes.byteLength; offset += 262144)
    hash.update(bytes.subarray(offset, Math.min(offset + 262144, bytes.byteLength)));
  return hash.digestHex();
}
function graphJob(source: PairedNativeSource, id: GraphId): RenderJob {
  return {
    ...source.job,
    jobId: `${source.job.jobId}.${id}`,
    window: { ...source.job.window, tailFrames: GRAPH_FRAMES[id] - 2880000 },
  };
}

/** A helper scope ends every full native PCM reference before the next graph begins. */
async function renderAndPersistGraph(
  source: PairedNativeSource,
  id: GraphId,
  jobId: string,
  outputStore: IndexedDBRenderOutputStore,
) {
  const job = graphJob(source, id);
  const plan = validateRenderJob(job, source.input);
  if (plan.estimatedWorkingBytes > 256 * 1024 * 1024 || plan.outputFrames !== GRAPH_FRAMES[id])
    throw new Error("PAIRED_GRAPH_ADMISSION");
  const startedAtUtc = new Date().toISOString();
  const renderStart = performance.now();
  const rendered = await renderWholeNativeReference(source.input, job, "master");
  const renderMs = performance.now() - renderStart;
  if (
    rendered.channels.length !== 2 ||
    rendered.channels.some((channel) => channel.length !== GRAPH_FRAMES[id])
  )
    throw new Error("PAIRED_NATIVE_LAYOUT");
  let peak = 0,
    outsideUnit = 0,
    nonfinite = 0;
  for (const channel of rendered.channels)
    for (const value of channel) {
      if (!Number.isFinite(value)) nonfinite++;
      peak = Math.max(peak, Math.abs(value));
      if (Math.abs(value) > 1) outsideUnit++;
    }
  check(`bounds-${id}`, nonfinite === 0 && peak > 0 && peak <= 1 && outsideUnit === 0, {
    peak,
    outsideUnit,
    nonfinite,
  });
  const controlsMatch =
    rendered.controls.length === source.expectedControlSamples.length &&
    rendered.controls.every((sample, index) => sample === source.expectedControlSamples[index]);
  const controlSha256 = await sha256Canonical(rendered.controls);
  check(`controls-${id}`, controlsMatch, {
    count: rendered.controls.length,
    expectedCount: 3602,
    sha256: controlSha256,
  });
  const persistStart = performance.now();
  const saved = await persistDiagnosticWave(outputStore, jobId, id, rendered.channels, PAIRED_RATE);
  const persistMs = performance.now() - persistStart;
  return {
    file: {
      ...saved,
      id,
      filename: `${id}.paired.wav`,
      channels: 2 as const,
      rate: 48000 as const,
    },
    graph: {
      id,
      frames: plan.outputFrames,
      contextFrames: plan.contextFrames,
      tailFrames: job.window.tailFrames,
      peak,
      outsideUnit,
      nonfinite,
      controlSha256,
      startedAtUtc,
      finishedAtUtc: new Date().toISOString(),
      renderMs,
      persistMs,
      estimatedWorkingBytes: plan.estimatedWorkingBytes,
    },
    controls: rendered.controls,
  };
}

/** The only retained payloads here are the two files in the current comparison. */
async function readPcm(
  outputStore: IndexedDBRenderOutputStore,
  jobId: string,
  file: PairedFile,
): Promise<LoadedPcm> {
  const blob = await outputStore.readBlob(jobId, file.id);
  if (!blob || blob.size !== file.bytes) throw new Error(`PAIRED_READBACK_SIZE:${file.id}`);
  const bytes = await blob.arrayBuffer();
  const view = new DataView(bytes);
  const text = (offset: number, value: string) =>
    value
      .split("")
      .every((letter, index) => view.getUint8(offset + index) === letter.charCodeAt(0));
  if (
    bytes.byteLength !== 56 + file.frames * 8 ||
    hashView(new Uint8Array(bytes)) !== file.sha256 ||
    !text(0, "RIFF") ||
    view.getUint32(4, true) + 8 !== bytes.byteLength ||
    !text(8, "WAVE") ||
    !text(12, "fmt ") ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 3 ||
    view.getUint16(22, true) !== 2 ||
    view.getUint32(24, true) !== PAIRED_RATE ||
    view.getUint32(28, true) !== PAIRED_RATE * 8 ||
    view.getUint16(32, true) !== 8 ||
    view.getUint16(34, true) !== 32 ||
    !text(36, "fact") ||
    view.getUint32(40, true) !== 4 ||
    view.getUint32(44, true) !== file.frames ||
    !text(48, "data") ||
    view.getUint32(52, true) !== file.frames * 8
  )
    throw new Error(`PAIRED_READBACK_INTEGRITY:${file.id}`);
  return {
    bytes,
    vector: {
      channels: 2,
      frames: file.frames,
      sample: (channel, frame) => view.getFloat32(56 + (frame * 2 + channel) * 4, true),
    },
  };
}
async function comparePair(
  outputStore: IndexedDBRenderOutputStore,
  jobId: string,
  pair: (typeof PAIRS)[number],
  files: PairedFile[],
) {
  const actualFile = files.find((file) => file.id === pair.actualId);
  const referenceFile = files.find((file) => file.id === pair.referenceId);
  if (!actualFile || !referenceFile) throw new Error("PAIRED_COMPARISON_FILE_MISSING");
  const actual = await readPcm(outputStore, jobId, actualFile);
  const reference = await readPcm(outputStore, jobId, referenceFile);
  const summary = summarizePcmDifference(actual.vector, reference.vector, {
    frames: pair.frames,
    sampleRateHz: 48000,
    tolerance: 2e-6,
  });
  check(
    `pair-${pair.id}`,
    summary.frames === pair.frames &&
      summary.comparedSamples === pair.frames * 2 &&
      summary.nonfinite.count === 0 &&
      summary.maxError <= 2e-6,
    summary,
  );
  return {
    observation: { ...pair, summary },
    arrayBufferBytes: actual.bytes.byteLength + reference.bytes.byteLength,
  };
}

async function performPaired(): Promise<PairedResult> {
  const started = performance.now();
  const startedAtUtc = new Date().toISOString();
  const jobId = `paired-${globalThis.crypto.randomUUID()}`;
  const databaseName = `reflection-lab-paired-${jobId}`;
  let source: PairedNativeSource | null = null;
  let published = false;
  const files: PairedFile[] = [];
  const graphs: GraphObservation[] = [];
  const comparisons: PairObservation[] = [];
  const controls: Partial<Record<GraphId, number[]>> = {};
  const controlHashes: Partial<Record<GraphId, string>> = {};
  const pairBytes: { id: string; bytes: number }[] = [];
  let failure: string | null = null;
  let comparisonMs = 0;
  let pairedReadEstimate = 0;
  let largestContextPcmBytes = 0;
  let maximumTwoWaveReadBytes = 0;
  let oneBlobReadAllowanceBytes = 0;
  try {
    if (
      RENDER_LIMITS.maxWorkingBytes !== 256 * 1024 * 1024 ||
      RENDER_OUTPUT_MAX_JOB_BYTES !== 192 * 1024 * 1024 ||
      RENDER_OUTPUT_MAX_ARCHIVE_BYTES !== 384 * 1024 * 1024 ||
      RENDER_OUTPUT_MAX_MANIFEST_BYTES !== 2 * 1024 * 1024
    )
      throw new Error("PAIRED_FIXED_CAP_CONTRACT_CHANGED");
    source = await createPairedNativeSource(jobId);
    check("fixed-regenerated-source-identities", true, {
      recordingSha256: source.identity.recordingSha256,
      assetSha256: source.identity.assetSha256,
      frameCount: source.identity.recording.frameCount,
      traceBytes: source.identity.recording.traceBytes,
      pathTransitions: source.pathTransitions,
    });
    const plans = ORDER.map((id) => validateRenderJob(graphJob(source!, id), source!.input));
    largestContextPcmBytes = Math.max(...plans.map((plan) => plan.contextFrames * 8));
    maximumTwoWaveReadBytes = 2 * (56 + PAIRED_63_FRAMES * 8);
    oneBlobReadAllowanceBytes = 56 + PAIRED_63_FRAMES * 8;
    const readTransientBytes = maximumTwoWaveReadBytes + oneBlobReadAllowanceBytes;
    const largestGraphEstimate = Math.max(...plans.map((plan) => plan.estimatedWorkingBytes));
    // Native graph execution and two-file comparisons are sequential, never simultaneous.
    // Replace its complete-output/scratch allowance with two byte arrays + one current
    // Blob payload allowance; a sidecar budget is added explicitly. Native heap is unknown.
    pairedReadEstimate =
      largestGraphEstimate -
      largestContextPcmBytes * 3 +
      readTransientBytes +
      RENDER_OUTPUT_MAX_MANIFEST_BYTES;
    check(
      "paired-working-admission",
      largestGraphEstimate <= RENDER_LIMITS.maxWorkingBytes &&
        pairedReadEstimate <= RENDER_LIMITS.maxWorkingBytes &&
        readTransientBytes <= largestContextPcmBytes * 3,
      {
        graphEstimatedWorkingBytes: largestGraphEstimate,
        pairedReadEstimatedWorkingBytes: pairedReadEstimate,
        maximumTwoWaveReadBytes,
        oneBlobReadAllowanceBytes,
        nativeHeapMeasuredBytes: null,
        maxWorkingBytes: RENDER_LIMITS.maxWorkingBytes,
        estimateOnly: true,
      },
    );
    if (checks.some((value) => !value.pass)) throw new Error("PAIRED_WORKING_ADMISSION_REJECTED");
    store = new IndexedDBRenderOutputStore({ name: databaseName });
    await store.begin(jobId, RENDER_OUTPUT_MAX_JOB_BYTES, ORDER, PAIRED_ENCODED_BYTES);
    for (const id of ORDER) {
      const rendered = await renderAndPersistGraph(source, id, jobId, store);
      files.push(rendered.file);
      graphs.push(rendered.graph);
      controls[id] = rendered.controls;
      controlHashes[id] = rendered.graph.controlSha256;
    }
    const encodedBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    check(
      "paired-four-encoded-files-and-fixed-order",
      encodedBytes === PAIRED_ENCODED_BYTES &&
        files.length === 4 &&
        files.every((file, index) => file.id === ORDER[index]),
      { order: [...ORDER], encodedBytes, expectedEncodedBytes: PAIRED_ENCODED_BYTES },
    );
    await store.publish(jobId);
    published = true;
    const compareStarted = performance.now();
    for (const pair of PAIRS) {
      const compared = await comparePair(store, jobId, pair, files);
      comparisons.push(compared.observation);
      pairBytes.push({ id: pair.id, bytes: compared.arrayBufferBytes });
    }
    comparisonMs = performance.now() - compareStarted;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    check("paired-component-error", false, { reason: failure });
    if (store && !published)
      await store.discard(jobId).catch((cleanup: unknown) => {
        check("paired-private-job-cleanup", false, { reason: String(cleanup) });
      });
  }
  if (!source || !published || files.length !== 4)
    return {
      status: "ERROR",
      checks: structuredClone(checks),
      summary: {
        jobId,
        databaseName,
        historical: HISTORICAL,
        completedGraphs: graphs,
        error: failure ?? "PAIRED_INCOMPLETE_GRAPH_JOB",
      },
    };
  const expectedSha256 = await sha256Canonical(source.expectedControlSamples);
  const identicalControls = ORDER.every((id) => controlHashes[id] === expectedSha256);
  check("paired-all-control-hashes-match-fixed-grid", identicalControls, {
    expectedSha256,
    sha256ByGraph: controlHashes,
    expectedCount: 3602,
  });
  const snapshot = await store!.getSnapshot(jobId);
  const actualEncoded = snapshot?.bytes ?? -1;
  check(
    "paired-payload-cap-with-sidecar-reserve",
    actualEncoded === PAIRED_ENCODED_BYTES &&
      actualEncoded <= RENDER_OUTPUT_MAX_JOB_BYTES &&
      actualEncoded + RENDER_OUTPUT_MAX_MANIFEST_BYTES <= RENDER_OUTPUT_MAX_ARCHIVE_BYTES,
    {
      encodedBytes: actualEncoded,
      sidecarReserveBytes: RENDER_OUTPUT_MAX_MANIFEST_BYTES,
      maximumCombinedPayloadBytes: actualEncoded + RENDER_OUTPUT_MAX_MANIFEST_BYTES,
      archivePayloadCap: RENDER_OUTPUT_MAX_ARCHIVE_BYTES,
    },
  );
  const resultStatus = failure ? "ERROR" : checks.every((value) => value.pass) ? "PASS" : "FAIL";
  sidecar = {
    schemaVersion: "paired-native-whole-master-v1",
    status: resultStatus,
    source: source.identity,
    configuration: source.configuration,
    order: [...ORDER],
    files,
    graphs,
    comparisons,
    controls: {
      expectedCount: 3602,
      expectedSamples: source.expectedControlSamples,
      expectedSha256,
      byGraph: controls,
      sha256ByGraph: controlHashes,
      identicalAcrossGraphs: identicalControls,
    },
    historical: HISTORICAL,
    publication: {
      kind: "diagnosticFourWavesThenSeparateMetadataBlob",
      databaseName,
      jobId,
      diagnosticStoreManifest: null,
      sidecarIsPortableProductManifest: false,
      sidecarStoredInOutputJob: false,
    },
    resource: {
      maxWorkingBytes: RENDER_LIMITS.maxWorkingBytes,
      maxJobEncodedBytes: RENDER_OUTPUT_MAX_JOB_BYTES,
      maxArchivePayloadBytes: RENDER_OUTPUT_MAX_ARCHIVE_BYTES,
      maxSidecarBytes: RENDER_OUTPUT_MAX_MANIFEST_BYTES,
      expectedEncodedBytes: PAIRED_ENCODED_BYTES,
      storedEncodedBytes: actualEncoded,
      maximumEncodedAndSidecarPayloadBytes: actualEncoded + RENDER_OUTPUT_MAX_MANIFEST_BYTES,
      largestContextPcmBytes,
      maximumTwoWaveReadBytes,
      oneBlobReadAllowanceBytes,
      pairedReadEstimatedWorkingBytes: pairedReadEstimate,
      observedPairArrayBufferBytes: pairBytes,
      comparisonFullJobAuditBytes: PAIRS.length * 2 * PAIRED_ENCODED_BYTES,
      downloadFullJobAuditBytes: ORDER.length * PAIRED_ENCODED_BYTES,
      nativeHeapMeasuredBytes: null,
      javascriptHeapMeasuredBytes: null,
      encodedChunkFrames: 32768,
      retainedWholeRenderedOutputsBetweenGraphs: 0,
      retainedWholeWavByteArraysBetweenPairs: 0,
      policy:
        "Admission estimate only: full native output/scratch accounted during each graph, two file arrays plus one Blob allowance during comparisons. Blob/native heap and GC peaks are not measured or guaranteed. No all-WAV byte cache.",
    },
    timing: {
      startedAtUtc,
      finishedAtUtc: new Date().toISOString(),
      preparationMs: source.preparationMs,
      renderMs: graphs.reduce((sum, graph) => sum + graph.renderMs, 0),
      persistMs: graphs.reduce((sum, graph) => sum + graph.persistMs, 0),
      comparisonMs,
      totalMs: performance.now() - started,
    },
    checks: structuredClone(checks),
    ...(failure ? { error: failure } : {}),
    limitations: [
      "Paired whole-master diagnostic only. Original attempt02/full-63 product gate/download failures remain preserved and are not rerun or replaced by this component.",
      "Exactly regenerated sample/Behavior/geometric-solver/recorder recipe; authored fixture motion is not a fresh physics simulation and sample content is not a measured vibration.",
      "Every graph is a fresh full native AudioEngine/ReplayAudioHost graph with unchanged HRTF, Synthetic IR, limiter, safety, +12dB monitor, 800-frame preroll and emission input. No archived mix feeds the reference.",
      "The reference shares product DSP components; native HRTF/limiter coefficients remain browser-managed, not independent scientific validation or hardware PCM/hearing/SPL evidence.",
      "Four WAVs are published in one diagnostic output-store job before pair reads. The separately hashed sidecar Blob is not atomically published as a portable product render manifest.",
      "Sidecar maximum payload is included in the explicit diagnostic payload reserve; IDB page overhead and native/Blob/JavaScript heap peaks remain unmeasured.",
      "Each selected readBlob re-audits all four stored WAVs: comparisons audit 1,152,002,688 payload bytes and four WAV downloads audit 384,000,896 payload bytes, before additional selected-file readback hashing. Timings include replay/control/encode/storage audit costs and are not DSP-only throughput.",
    ],
  };
  const sidecarBytes = new TextEncoder().encode(canonicalStringify(sidecar));
  if (
    sidecarBytes.byteLength > RENDER_OUTPUT_MAX_MANIFEST_BYTES ||
    actualEncoded + sidecarBytes.byteLength > RENDER_OUTPUT_MAX_ARCHIVE_BYTES
  )
    throw new Error("PAIRED_SIDECAR_PAYLOAD_CAP");
  sidecarBlob = new Blob([sidecarBytes], { type: "application/json" });
  const sidecarDescriptor: ExpectedOutput = {
    id: "paired-manifest",
    filename: "paired.whole-master.json",
    bytes: sidecarBytes.byteLength,
    sha256: hashView(sidecarBytes),
  };
  expectedOutputs = [
    ...files.map(({ id, filename, bytes, sha256 }) => ({ id, filename, bytes, sha256 })),
    sidecarDescriptor,
  ];
  return {
    status: resultStatus,
    checks: structuredClone(checks),
    summary: {
      jobId,
      databaseName,
      historical: HISTORICAL,
      order: [...ORDER],
      files: expectedOutputs,
      graphCount: graphs.length,
      comparisonCount: comparisons.length,
      encodedBytes: actualEncoded,
      sidecarBytes: sidecarBytes.byteLength,
      actualCombinedPayloadBytes: actualEncoded + sidecarBytes.byteLength,
      nativeHeapMeasuredBytes: null,
      javascriptHeapMeasuredBytes: null,
      pairedReadEstimatedWorkingBytes: pairedReadEstimate,
      totalMs: performance.now() - started,
      ...(failure ? { error: failure } : {}),
    },
  };
}

Object.assign(window, {
  runPairedNativeWholeMaster: () => (operation ??= performPaired()),
  pairedManifest: () => sidecar,
  pairedCheckSnapshot: () => structuredClone(checks),
  async pairedExpectedOutputs(): Promise<ExpectedOutput[]> {
    if (operation) await operation;
    if (!expectedOutputs) throw new Error("PAIRED_OUTPUTS_NOT_READY");
    return expectedOutputs.map((file) => ({ ...file }));
  },
  async nativeLongDownload(id: string): Promise<void> {
    if (!sidecar || !sidecarBlob || !store || !expectedOutputs)
      throw new Error("PAIRED_OUTPUTS_NOT_READY");
    const expected = expectedOutputs.find((file) => file.id === id);
    if (!expected) throw new Error("PAIRED_DOWNLOAD_ID");
    const blob =
      id === "paired-manifest" ? sidecarBlob : await store.readBlob(sidecar.publication.jobId, id);
    if (!blob || blob.size !== expected.bytes) throw new Error("PAIRED_DOWNLOAD_SIZE");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = expected.filename;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },
});
document.body.textContent = "Paired whole-native master diagnostic ready";

declare global {
  interface Window {
    runPairedNativeWholeMaster: () => Promise<PairedResult>;
    pairedManifest: () => PairedManifest | null;
    pairedCheckSnapshot: () => PairedCheck[];
    pairedExpectedOutputs: () => Promise<ExpectedOutput[]>;
    nativeLongDownload: (id: string) => Promise<void>;
  }
}
