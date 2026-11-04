import {
  IndexedDBRenderOutputStore,
  type VerifiedRenderJobSnapshot,
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
import {
  readVerifiedSnapshotPcm,
  assertLeanPairedProjection,
  estimatePairedV3Working,
} from "./paired-v3-support.js";
import { createPairedV3Progress } from "./paired-v3-progress.mjs";

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
  resource: Record<string, unknown>;
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

interface PairedResult {
  status: "PASS" | "FAIL" | "ERROR";
  checks: PairedCheck[];
  summary: unknown;
}
interface LeanGraphResult {
  identity: PairedSourceIdentity;
  configuration: RenderConfiguration;
  files: PairedFile[];
  graphs: GraphObservation[];
  controls: Partial<Record<GraphId, number[]>>;
  controlHashes: Partial<Record<GraphId, string>>;
  expectedControlSamples: number[];
  expectedControlSha256: string;
  preparationMs: number;
  largestContextPcmBytes: number;
  largestGraphEstimate: number;
}
const checks: PairedCheck[] = [];
const progress = createPairedV3Progress();
let operation: Promise<PairedResult> | null = null;
let store: IndexedDBRenderOutputStore | null = null;
let verifiedSnapshot: VerifiedRenderJobSnapshot | null = null;
let sidecar: PairedManifest | null = null;
let sidecarBlob: Blob | null = null;
let expectedOutputs: ExpectedOutput[] | null = null;
let released = false;
const liveUrls = new Set<string>();
const revokeTimers = new Set<ReturnType<typeof setTimeout>>();
const HISTORICAL = Object.freeze({
  attempt02: "FAIL_PRESERVED",
  originalWhole63Gate: "NOT_RERUN",
  original16Downloads: "INCOMPLETE_PRESERVED",
  pairedDoesNotReplaceProductGate: true,
} as const);
function assertActive(): void {
  if (released) throw new Error("PAIRED_V3_RELEASED");
}
function check(id: string, pass: boolean, evidence: unknown): void {
  if (released) return;
  checks.push({ id, pass, evidence });
  console.info(`PAIRED_CHECK:${id}:${pass}`);
}
function scheduleRevoke(url: string): void {
  const timer = setTimeout(() => {
    URL.revokeObjectURL(url);
    liveUrls.delete(url);
    revokeTimers.delete(timer);
  }, 1000);
  revokeTimers.add(timer);
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
    controls: [...rendered.controls],
  };
}

/**
 * This function is the sole owner of the full source/recording/asset/native graph roots.
 * Only the explicit validated plain projection below crosses its awaited return boundary.
 * Ending that reachability scope is not a claim that physical GC/native RAM was reclaimed.
 */
async function renderAllGraphsToLean(
  outputStore: IndexedDBRenderOutputStore,
  jobId: string,
  publication: { published: boolean },
): Promise<LeanGraphResult> {
  const source = await createPairedNativeSource(jobId);
  assertActive();
  check("fixed-regenerated-source-identities", true, {
    recordingSha256: source.identity.recordingSha256,
    assetSha256: source.identity.assetSha256,
    frameCount: source.identity.recording.frameCount,
    traceBytes: source.identity.recording.traceBytes,
    pathTransitions: source.pathTransitions.map(
      ({ tick, sourceId, outputControlSample, seamDistance }) => ({
        tick,
        sourceId,
        outputControlSample,
        seamDistance,
      }),
    ),
  });
  const plans = ORDER.map((id) => validateRenderJob(graphJob(source, id), source.input));
  const largestContextPcmBytes = Math.max(...plans.map((plan) => plan.contextFrames * 8));
  const largestGraphEstimate = Math.max(...plans.map((plan) => plan.estimatedWorkingBytes));
  const futureReadEstimate = estimatePairedV3Working({
    encodedBytes: PAIRED_ENCODED_BYTES,
    twoWaveArrayBytes: 2 * (56 + PAIRED_63_FRAMES * 8),
    leanPayloadBytes: 0,
  });
  check(
    "paired-working-admission",
    largestGraphEstimate <= RENDER_LIMITS.maxWorkingBytes &&
      futureReadEstimate.estimatedBytes <= RENDER_LIMITS.maxWorkingBytes,
    {
      graphEstimatedWorkingBytes: largestGraphEstimate,
      futureSnapshotEstimatedWorkingBytes: futureReadEstimate.estimatedBytes,
      maxWorkingBytes: RENDER_LIMITS.maxWorkingBytes,
      nativeHeapMeasuredBytes: null,
      estimateOnly: true,
      snapshotNotYetMaterialized: true,
    },
  );
  if (checks.some((value) => !value.pass)) throw new Error("PAIRED_WORKING_ADMISSION_REJECTED");
  const files: PairedFile[] = [];
  const graphs: GraphObservation[] = [];
  const controls: Partial<Record<GraphId, number[]>> = {};
  const controlHashes: Partial<Record<GraphId, string>> = {};
  await outputStore.begin(jobId, RENDER_OUTPUT_MAX_JOB_BYTES, ORDER, PAIRED_ENCODED_BYTES);
  assertActive();
  for (const id of ORDER) {
    const completed = await renderAndPersistGraph(source, id, jobId, outputStore);
    assertActive();
    files.push(completed.file);
    graphs.push(completed.graph);
    controls[id] = completed.controls;
    controlHashes[id] = completed.graph.controlSha256;
    progress.recordGraph(completed.file, completed.graph);
    progress.recordTiming({ stage: "graph-native", id, elapsedMs: completed.graph.renderMs });
    progress.recordTiming({ stage: "graph-persist", id, elapsedMs: completed.graph.persistMs });
  }
  const encodedBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  check(
    "paired-four-encoded-files-and-fixed-order",
    encodedBytes === PAIRED_ENCODED_BYTES &&
      files.length === 4 &&
      files.every((file, index) => file.id === ORDER[index]),
    {
      order: [...ORDER],
      encodedBytes,
      expectedEncodedBytes: PAIRED_ENCODED_BYTES,
    },
  );
  await outputStore.publish(jobId);
  assertActive();
  publication.published = true;
  const expectedControlSamples = [...source.expectedControlSamples];
  const expectedControlSha256 = await sha256Canonical(expectedControlSamples);
  assertActive();
  const lean: LeanGraphResult = {
    identity: structuredClone(source.identity),
    configuration: structuredClone(source.configuration),
    files,
    graphs,
    controls,
    controlHashes,
    expectedControlSamples,
    expectedControlSha256,
    preparationMs: source.preparationMs,
    largestContextPcmBytes,
    largestGraphEstimate,
  };
  assertLeanPairedProjection(lean);
  return lean;
}

function currentMetadataAudit(
  lean: LeanGraphResult,
  comparisons: PairObservation[],
  pairBytes: { id: string; bytes: number }[],
) {
  return assertLeanPairedProjection({
    lean,
    checks,
    comparisons,
    pairBytes,
    partial: progress.snapshot(),
    verifiedPins: verifiedSnapshot?.pins ?? null,
    verifiedOutputDescriptors:
      verifiedSnapshot?.outputs.map(({ id, bytes, sha256 }) => ({ id, bytes, sha256 })) ?? null,
    expectedOutputs,
    sidecar,
  });
}

/** One comparison scope owns exactly two ArrayBuffers and never returns either reader. */
async function compareSnapshotPair(
  snapshot: VerifiedRenderJobSnapshot,
  pair: (typeof PAIRS)[number],
  files: PairedFile[],
) {
  const actualFile = files.find((file) => file.id === pair.actualId);
  const referenceFile = files.find((file) => file.id === pair.referenceId);
  const actualOutput = snapshot.outputs.find((file) => file.id === pair.actualId);
  const referenceOutput = snapshot.outputs.find((file) => file.id === pair.referenceId);
  if (!actualFile || !referenceFile || !actualOutput || !referenceOutput)
    throw new Error("PAIRED_COMPARISON_FILE_MISSING");
  const actual = await readVerifiedSnapshotPcm(actualOutput, actualFile, (row) =>
    progress.recordTiming(row),
  );
  assertActive();
  const reference = await readVerifiedSnapshotPcm(referenceOutput, referenceFile, (row) =>
    progress.recordTiming(row),
  );
  assertActive();
  const statsStarted = performance.now();
  const summary = summarizePcmDifference(actual.vector, reference.vector, {
    frames: pair.frames,
    sampleRateHz: 48000,
    tolerance: 2e-6,
  });
  progress.recordTiming({
    stage: "stats",
    id: pair.id,
    elapsedMs: performance.now() - statsStarted,
  });
  check(
    `pair-${pair.id}`,
    summary.frames === pair.frames &&
      summary.comparedSamples === pair.frames * 2 &&
      summary.nonfinite.count === 0 &&
      summary.maxError <= 2e-6,
    summary,
  );
  const observation: PairObservation = { ...pair, summary };
  progress.recordComparison(observation);
  return { observation, arrayBufferBytes: actual.bytes.byteLength + reference.bytes.byteLength };
}

async function performPaired(): Promise<PairedResult> {
  assertActive();
  const started = performance.now();
  const startedAtUtc = new Date().toISOString();
  const jobId = `paired-${globalThis.crypto.randomUUID()}`;
  const databaseName = `reflection-lab-paired-${jobId}`;
  const publication = { published: false };
  let lean: LeanGraphResult | null = null;
  const comparisons: PairObservation[] = [];
  const pairBytes: { id: string; bytes: number }[] = [];
  let failure: string | null = null;
  let comparisonMs = 0;
  let verifiedSnapshotMs = 0;
  let leanPayloadBytes = 0;
  let snapshotWorking: ReturnType<typeof estimatePairedV3Working> | null = null;
  const maximumTwoWaveReadBytes = 2 * (56 + PAIRED_63_FRAMES * 8);
  try {
    if (
      RENDER_LIMITS.maxWorkingBytes !== 256 * 1024 * 1024 ||
      RENDER_OUTPUT_MAX_JOB_BYTES !== 192 * 1024 * 1024 ||
      RENDER_OUTPUT_MAX_ARCHIVE_BYTES !== 384 * 1024 * 1024 ||
      RENDER_OUTPUT_MAX_MANIFEST_BYTES !== 2 * 1024 * 1024
    )
      throw new Error("PAIRED_FIXED_CAP_CONTRACT_CHANGED");
    const outputStore = new IndexedDBRenderOutputStore({ name: databaseName });
    store = outputStore;
    // No source/input/recording/native result exists in this caller's scope.
    lean = await renderAllGraphsToLean(outputStore, jobId, publication);
    assertActive();
    leanPayloadBytes = currentMetadataAudit(lean, comparisons, pairBytes).logicalPayloadBytes;
    snapshotWorking = estimatePairedV3Working({
      encodedBytes: PAIRED_ENCODED_BYTES,
      twoWaveArrayBytes: maximumTwoWaveReadBytes,
      leanPayloadBytes,
    });
    check(
      "paired-verified-snapshot-working-admission",
      snapshotWorking.estimatedBytes <= RENDER_LIMITS.maxWorkingBytes,
      {
        ...snapshotWorking,
        leanPayloadBytes,
        lifecycle:
          "renderAllGraphsToLean returned only a validated explicit plain projection; physical GC/native peaks are unmeasured",
      },
    );
    const snapshotStarted = performance.now();
    const received = await outputStore.readVerifiedJobSnapshot(jobId, {
      maxMaterializedBytes: PAIRED_ENCODED_BYTES,
    });
    assertActive();
    verifiedSnapshotMs = performance.now() - snapshotStarted;
    progress.recordTiming({
      stage: "snapshot-all-job-audit",
      id: jobId,
      elapsedMs: verifiedSnapshotMs,
    });
    if (
      !received ||
      received.kind !== "verified-historical-render-job-v1" ||
      received.jobId !== jobId ||
      received.encodedBytes !== PAIRED_ENCODED_BYTES ||
      received.manifestJson !== null ||
      received.outputs.length !== ORDER.length ||
      !received.outputs.every((output, index) => {
        const expected = lean!.files[index];
        return (
          expected?.id === output.id &&
          output.bytes === expected.bytes &&
          output.sha256 === expected.sha256 &&
          output.blob.size === expected.bytes
        );
      })
    )
      throw new Error("PAIRED_VERIFIED_SNAPSHOT_IDENTITY");
    verifiedSnapshot = received;
    leanPayloadBytes = currentMetadataAudit(lean, comparisons, pairBytes).logicalPayloadBytes;
    snapshotWorking = estimatePairedV3Working({
      encodedBytes: PAIRED_ENCODED_BYTES,
      twoWaveArrayBytes: maximumTwoWaveReadBytes,
      leanPayloadBytes,
    });
    const compareStarted = performance.now();
    for (const pair of PAIRS) {
      const compared = await compareSnapshotPair(received, pair, lean.files);
      assertActive();
      comparisons.push(compared.observation);
      pairBytes.push({ id: pair.id, bytes: compared.arrayBufferBytes });
      leanPayloadBytes = currentMetadataAudit(lean, comparisons, pairBytes).logicalPayloadBytes;
      snapshotWorking = estimatePairedV3Working({
        encodedBytes: PAIRED_ENCODED_BYTES,
        twoWaveArrayBytes: maximumTwoWaveReadBytes,
        leanPayloadBytes,
      });
    }
    comparisonMs = performance.now() - compareStarted;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    if (!released) {
      check("paired-component-error", false, { reason: failure });
      progress.fail(failure);
      if (store && !publication.published)
        await store.discard(jobId).catch((cleanup: unknown) => {
          check("paired-private-job-cleanup", false, { reason: String(cleanup) });
        });
    }
  }
  assertActive();
  if (!lean || !publication.published || !verifiedSnapshot || lean.files.length !== 4)
    return {
      status: "ERROR",
      checks: structuredClone(checks),
      summary: {
        jobId,
        databaseName,
        historical: HISTORICAL,
        completedGraphs: lean?.graphs ?? [],
        error: failure ?? "PAIRED_INCOMPLETE_GRAPH_JOB",
      },
    };
  const identicalControls = ORDER.every(
    (id) => lean!.controlHashes[id] === lean!.expectedControlSha256,
  );
  check("paired-all-control-hashes-match-fixed-grid", identicalControls, {
    expectedSha256: lean.expectedControlSha256,
    sha256ByGraph: lean.controlHashes,
    expectedCount: 3602,
  });
  const actualEncoded = verifiedSnapshot.encodedBytes;
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
    source: lean.identity,
    configuration: lean.configuration,
    order: [...ORDER],
    files: lean.files,
    graphs: lean.graphs,
    comparisons,
    controls: {
      expectedCount: 3602,
      expectedSamples: lean.expectedControlSamples,
      expectedSha256: lean.expectedControlSha256,
      byGraph: lean.controls,
      sha256ByGraph: lean.controlHashes,
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
      largestContextPcmBytes: lean.largestContextPcmBytes,
      maximumTwoWaveReadBytes,
      oneBlobReadAllowanceBytes: PAIRED_ENCODED_BYTES,
      pairedReadEstimatedWorkingBytes: snapshotWorking?.estimatedBytes ?? -1,
      observedPairArrayBufferBytes: pairBytes,
      comparisonFullJobAuditBytes: PAIRED_ENCODED_BYTES,
      downloadFullJobAuditBytes: 0,
      nativeHeapMeasuredBytes: null,
      javascriptHeapMeasuredBytes: null,
      encodedChunkFrames: 32768,
      retainedWholeRenderedOutputsBetweenGraphs: 0,
      retainedWholeWavByteArraysBetweenPairs: 0,
      verifiedHistoricalSnapshotBytes: actualEncoded,
      snapshotWorkingComponents: snapshotWorking,
      leanPayloadBytes,
      sourceLifecycle:
        "Only explicit validated lean metadata crosses graph scope; no full source/input/recording/asset/nativePCM root is returned. Scope end is not physical GC proof.",
      policy:
        "Admission estimate only: 2B snapshot/construction, two largest current WAVE arrays, 1MiB cursor, 10MiB manifest/sidecar strings/hash and 8MiB audited lean/scratch. Immutable historical Blob payload is counted, not free RAM; physical native/Blob/GC peaks unmeasured.",
    },
    timing: {
      startedAtUtc,
      finishedAtUtc: new Date().toISOString(),
      preparationMs: lean.preparationMs,
      renderMs: lean.graphs.reduce((sum, graph) => sum + graph.renderMs, 0),
      persistMs: lean.graphs.reduce((sum, graph) => sum + graph.persistMs, 0),
      comparisonMs,
      totalMs: performance.now() - started,
    },
    checks: structuredClone(checks),
    ...(failure ? { error: failure } : {}),
    limitations: [
      "Paired whole-master diagnostic only; original product whole63 and historical download failures remain preserved.",
      "Exactly regenerated same sample/Behavior/geometric-solver/recorder, HRTF/IR/limiter/safety/+12dB/800preroll/controls; no archived mix or alternative source model.",
      "One fresh complete native graph per output; native DSP is shared with product, not independent scientific/hearing/SPL evidence.",
      "One fresh full-job verification yields caller-owned immutable historical WAV Blobs. Public single reads remain fresh; snapshot is not permanent DB/generation authority and is reused only by this operation.",
      "Selected-file SHA/RIFF and original frame-major/channel Stats are unchanged for every pair. Four full native outputs and all six comparisons remain required.",
      "Portable product manifest is unchanged; this separate diagnostic sidecar is not atomic product publication.",
      "All source/native consumer roots are excluded from the readback scope, but physical GC/native/JavaScript peak is not measured. Admission is an explicit estimate.",
    ],
  };
  // Bound all current metadata, including newly built comparisons/checks/sidecar.
  leanPayloadBytes = currentMetadataAudit(lean, comparisons, pairBytes).logicalPayloadBytes;
  snapshotWorking = estimatePairedV3Working({
    encodedBytes: PAIRED_ENCODED_BYTES,
    twoWaveArrayBytes: maximumTwoWaveReadBytes,
    leanPayloadBytes,
  });
  sidecar.resource.leanPayloadBytes = leanPayloadBytes;
  sidecar.resource.snapshotWorkingComponents = snapshotWorking;
  currentMetadataAudit(lean, comparisons, pairBytes);
  const sidecarBytes = new TextEncoder().encode(canonicalStringify(sidecar));
  if (
    sidecarBytes.byteLength > RENDER_OUTPUT_MAX_MANIFEST_BYTES ||
    actualEncoded + sidecarBytes.byteLength > RENDER_OUTPUT_MAX_ARCHIVE_BYTES
  )
    throw new Error("PAIRED_SIDECAR_PAYLOAD_CAP");
  sidecarBlob = new Blob([sidecarBytes], { type: "application/json" });
  expectedOutputs = [
    ...lean.files.map(({ id, filename, bytes, sha256 }) => ({ id, filename, bytes, sha256 })),
    {
      id: "paired-manifest",
      filename: "paired.whole-master.json",
      bytes: sidecarBytes.byteLength,
      sha256: hashView(sidecarBytes),
    },
  ];
  leanPayloadBytes = currentMetadataAudit(lean, comparisons, pairBytes).logicalPayloadBytes;
  snapshotWorking = estimatePairedV3Working({
    encodedBytes: PAIRED_ENCODED_BYTES,
    twoWaveArrayBytes: maximumTwoWaveReadBytes,
    leanPayloadBytes,
  });
  if (!failure && comparisons.length === PAIRS.length) progress.finishBrowser(resultStatus);
  else progress.fail(failure ?? "PAIRED_INCOMPLETE_COMPARISONS");
  return {
    status: resultStatus,
    checks: structuredClone(checks),
    summary: {
      jobId,
      databaseName,
      historical: HISTORICAL,
      order: [...ORDER],
      files: expectedOutputs,
      graphCount: lean.graphs.length,
      comparisonCount: comparisons.length,
      encodedBytes: actualEncoded,
      sidecarBytes: sidecarBytes.byteLength,
      actualCombinedPayloadBytes: actualEncoded + sidecarBytes.byteLength,
      nativeHeapMeasuredBytes: null,
      javascriptHeapMeasuredBytes: null,
      pairedReadEstimatedWorkingBytes: snapshotWorking?.estimatedBytes ?? -1,
      verifiedSnapshotMs,
      leanPayloadBytes,
      totalMs: performance.now() - started,
      ...(failure ? { error: failure } : {}),
    },
  };
}

Object.defineProperty(window, "__pairedV3Partial", {
  configurable: false,
  enumerable: true,
  get: () => progress.snapshot(),
});
Object.assign(window, {
  runPairedNativeWholeMaster: () => {
    assertActive();
    return (operation ??= performPaired().catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      if (!released) progress.fail(reason);
      // The retained operation contains a plain error, never an arbitrary thrown source object.
      throw new Error(reason);
    }));
  },
  pairedManifest: () => sidecar,
  pairedCheckSnapshot: () => structuredClone(checks),
  async pairedExpectedOutputs(): Promise<ExpectedOutput[]> {
    assertActive();
    if (operation) await operation;
    assertActive();
    if (!expectedOutputs) throw new Error("PAIRED_OUTPUTS_NOT_READY");
    return expectedOutputs.map((file) => ({ ...file }));
  },
  async nativeLongDownload(id: string): Promise<void> {
    assertActive();
    if (!sidecar || !sidecarBlob || !verifiedSnapshot || !expectedOutputs)
      throw new Error("PAIRED_OUTPUTS_NOT_READY");
    const expected = expectedOutputs.find((file) => file.id === id);
    if (!expected) throw new Error("PAIRED_DOWNLOAD_ID");
    const blob =
      id === "paired-manifest"
        ? sidecarBlob
        : verifiedSnapshot.outputs.find((output) => output.id === id)?.blob;
    if (!blob || blob.size !== expected.bytes) throw new Error("PAIRED_DOWNLOAD_SIZE");
    const url = URL.createObjectURL(blob);
    liveUrls.add(url);
    const link = document.createElement("a");
    link.href = url;
    link.download = expected.filename;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      scheduleRevoke(url);
    }
  },
  releasePairedV3Exports(): void {
    if (released) return;
    released = true;
    for (const timer of revokeTimers) clearTimeout(timer);
    revokeTimers.clear();
    for (const url of liveUrls) URL.revokeObjectURL(url);
    liveUrls.clear();
    verifiedSnapshot = null;
    sidecarBlob = null;
    sidecar = null;
    expectedOutputs = null;
    operation = null;
    store?.dispose();
    store = null;
  },
});
document.body.textContent = "Verified-snapshot paired whole-native master diagnostic ready";

declare global {
  interface Window {
    readonly __pairedV3Partial: ReturnType<ReturnType<typeof createPairedV3Progress>["snapshot"]>;
    releasePairedV3Exports: () => void;
  }
}
