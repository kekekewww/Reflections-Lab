import { createHash } from "node:crypto";
import { open, readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";

export const PAIRED_RECORDING_SHA256 =
  "7ee6ae2185b90cf5bab1fe2dc7dcbbae0a0946651de4e0aaeca1538072e16827";
export const PAIRED_ASSET_SHA256 =
  "97ae03f5d9a897f06dec1cf82bba77fa33519aff9c2117cdfa419a23a3828cd8";
const RECORDING_CONFIGURATION_SHA256 =
  "bf07c1b318972059e64bc921a8a82e0f173285f66f451c40d3d990a645eeb538";
const RENDER_CONFIGURATION_SHA256 =
  "469c82d645e9c426967472ea6a1677b86b727c899f330493573e241a3daaa294";
const CONTROL_SHA256 = "90a06d180eb0f00155bcd7a926c2335858ddabbfd2dd7eefbb7e0e54fd0f91ec";
export const PAIRED_ORDER = Object.freeze(["master-62a", "master-63a", "master-63b", "master-62b"]);
export const PAIRED_PAIRS = Object.freeze([
  { id: "same-duration-62", actualId: "master-62a", referenceId: "master-62b", frames: 2976000 },
  { id: "same-duration-63", actualId: "master-63a", referenceId: "master-63b", frames: 3024000 },
  { id: "cross-62a-63a", actualId: "master-62a", referenceId: "master-63a", frames: 2976000 },
  { id: "cross-62a-63b", actualId: "master-62a", referenceId: "master-63b", frames: 2976000 },
  { id: "cross-62b-63a", actualId: "master-62b", referenceId: "master-63a", frames: 2976000 },
  { id: "cross-62b-63b", actualId: "master-62b", referenceId: "master-63b", frames: 2976000 },
]);
const FRAME_BY_ID = Object.freeze(
  Object.fromEntries(PAIRED_ORDER.map((id) => [id, id.includes("63") ? 3024000 : 2976000])),
);
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const READ_BYTES = 256 * 1024;
const HASH = /^[0-9a-f]{64}$/;

/** Independent streaming statistics: every declared sample is required in order. */
export function createPairStatistics(options) {
  assert(
    options &&
      Number.isSafeInteger(options.frames) &&
      options.frames > 0 &&
      options.frames <= 3024000,
    "PAIRED_STATS_FRAMES",
  );
  assert(
    Number.isSafeInteger(options.channels) && options.channels >= 1 && options.channels <= 2,
    "PAIRED_STATS_CHANNELS",
  );
  assert(options.sampleRateHz === 48000, "PAIRED_STATS_RATE");
  assert(options.tolerance === 2e-6, "PAIRED_STATS_TOLERANCE");
  const { frames, channels } = options;
  const samples = frames * channels;
  const perSecondMax = Array.from({ length: Math.ceil(frames / 48000) }, () => 0);
  let count = 0,
    maxError = 0,
    seamError = 0,
    tailError = 0,
    overCount = 0;
  let scale = 0,
    normalizedSquares = 0,
    firstOver = null,
    atMax = null,
    completed = null;
  return {
    accept(actual, reference) {
      assert(completed === null, "PAIRED_STATS_FINALIZED");
      assert(count < samples, "PAIRED_STATS_COUNT_EXCEEDED");
      const error = Math.abs(actual - reference);
      assert(
        Number.isFinite(actual) && Number.isFinite(reference) && Number.isFinite(error),
        "PAIRED_STATS_NONFINITE",
      );
      const frame = Math.floor(count / channels),
        channel = count % channels;
      const point = () => ({ frame, channel, actual, reference, error });
      if (atMax === null || error > maxError) {
        maxError = error;
        atMax = point();
      }
      if (error > 2e-6) {
        overCount++;
        firstOver ??= point();
      }
      const remainder = frame % 32768;
      if (
        (frame >= 32768 && remainder <= 128) ||
        (remainder >= 32640 && frame - remainder + 32768 < frames)
      )
        seamError = Math.max(seamError, error);
      if (frame >= 2880000) tailError = Math.max(tailError, error);
      const second = Math.floor(frame / 48000);
      perSecondMax[second] = Math.max(perSecondMax[second], error);
      if (error > 0) {
        if (error > scale) {
          normalizedSquares = 1 + normalizedSquares * (scale / error) ** 2;
          scale = error;
        } else normalizedSquares += (error / scale) ** 2;
      }
      count++;
    },
    finish() {
      assert(count === samples, "PAIRED_STATS_COUNT_INCOMPLETE");
      completed ??= {
        frames,
        channels,
        sampleRateHz: 48000,
        tolerance: 2e-6,
        comparedSamples: count,
        maxError,
        seamError,
        tailError,
        overCount,
        firstOver,
        atMax,
        rmsError: scale * Math.sqrt(normalizedSquares / count),
        perSecondMax,
        nonfinite: { count: 0, actual: 0, reference: 0, difference: 0, first: null },
      };
      return completed;
    },
  };
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function safeFile(directory, filename) {
  const resolved = path.resolve(directory, filename);
  assert(path.dirname(resolved) === path.resolve(directory), "PAIRED_OUTPUT_PATH");
  return resolved;
}
async function readExactly(handle, bytes, position) {
  const buffer = Buffer.allocUnsafe(bytes);
  let filled = 0;
  while (filled < bytes) {
    const result = await handle.read(buffer, filled, bytes - filled, position + filled);
    if (result.bytesRead === 0) throw new Error("PAIRED_PARTIAL_FILE");
    filled += result.bytesRead;
  }
  return buffer;
}
export function inspectPairedRiffHeader(header, expectedFrames, actualBytes) {
  assert(Buffer.isBuffer(header) && header.length === 56, "PAIRED_RIFF_HEADER");
  assert(
    Number.isSafeInteger(expectedFrames) && expectedFrames > 0 && expectedFrames <= 3024000,
    "PAIRED_RIFF_FRAMES",
  );
  const text = (offset, count) => header.toString("ascii", offset, offset + count);
  assert(
    text(0, 4) === "RIFF" &&
      text(8, 4) === "WAVE" &&
      text(12, 4) === "fmt " &&
      header.readUInt32LE(16) === 16 &&
      header.readUInt16LE(20) === 3 &&
      header.readUInt16LE(22) === 2 &&
      header.readUInt32LE(24) === 48000 &&
      header.readUInt32LE(28) === 384000 &&
      header.readUInt16LE(32) === 8 &&
      header.readUInt16LE(34) === 32 &&
      text(36, 4) === "fact" &&
      header.readUInt32LE(40) === 4 &&
      header.readUInt32LE(44) === expectedFrames &&
      text(48, 4) === "data" &&
      header.readUInt32LE(52) === expectedFrames * 8 &&
      header.readUInt32LE(4) + 8 === actualBytes &&
      actualBytes === 56 + expectedFrames * 8,
    "PAIRED_RIFF_LAYOUT_OR_PARTIAL",
  );
  return { frames: expectedFrames, channels: 2, rate: 48000, bytes: actualBytes };
}
async function inspectWave(directory, expected) {
  const file = safeFile(directory, expected.filename);
  const stat = await lstat(file);
  assert(
    stat.isFile() && !stat.isSymbolicLink() && stat.size === expected.bytes,
    "PAIRED_WAVE_FILE_OR_LENGTH",
  );
  const handle = await open(file, "r");
  try {
    const header = await readExactly(handle, 56, 0);
    const layout = inspectPairedRiffHeader(header, FRAME_BY_ID[expected.id], stat.size);
    const hash = createHash("sha256").update(header);
    let peak = 0,
      outsideUnit = 0,
      sampleCount = 0;
    for (let position = 56; position < stat.size; position += READ_BYTES) {
      const bytes = await readExactly(handle, Math.min(READ_BYTES, stat.size - position), position);
      hash.update(bytes);
      for (let index = 0; index < bytes.length; index += 4) {
        const sample = bytes.readFloatLE(index);
        assert(Number.isFinite(sample), `PAIRED_NONFINITE:${expected.id}`);
        peak = Math.max(peak, Math.abs(sample));
        if (Math.abs(sample) > 1) outsideUnit++;
        sampleCount++;
      }
    }
    const sha256 = hash.digest("hex");
    assert(sha256 === expected.sha256 && HASH.test(sha256), `PAIRED_WAVE_HASH:${expected.id}`);
    assert(
      sampleCount === layout.frames * 2 && peak > 0 && peak <= 1 && outsideUnit === 0,
      `PAIRED_MASTER_BOUNDS:${expected.id}`,
    );
    return {
      id: expected.id,
      filename: expected.filename,
      ...layout,
      sha256,
      peak,
      outsideUnit,
      nonfinite: 0,
    };
  } finally {
    await handle.close();
  }
}
async function compareWavePair(directory, pair) {
  const left = await open(safeFile(directory, `${pair.actualId}.paired.wav`), "r");
  let right;
  try {
    right = await open(safeFile(directory, `${pair.referenceId}.paired.wav`), "r");
    const stats = createPairStatistics({
      frames: pair.frames,
      channels: 2,
      sampleRateHz: 48000,
      tolerance: 2e-6,
    });
    const count = pair.frames * 8;
    for (let consumed = 0; consumed < count; consumed += READ_BYTES) {
      const bytes = Math.min(READ_BYTES, count - consumed);
      const actual = await readExactly(left, bytes, 56 + consumed);
      const reference = await readExactly(right, bytes, 56 + consumed);
      for (let index = 0; index < bytes; index += 4)
        stats.accept(actual.readFloatLE(index), reference.readFloatLE(index));
    }
    return stats.finish();
  } finally {
    await left.close();
    if (right) await right.close();
  }
}
function samePoint(actual, expected) {
  if (actual === null || expected === null) return actual === expected;
  return ["frame", "channel", "actual", "reference", "error"].every(
    (key) => actual[key] === expected[key],
  );
}
function verifyBrowserSummary(summary, independent, pair) {
  assert(
    summary &&
      summary.frames === pair.frames &&
      summary.channels === 2 &&
      summary.sampleRateHz === 48000 &&
      summary.tolerance === 2e-6 &&
      summary.actualFrames === FRAME_BY_ID[pair.actualId] &&
      summary.referenceFrames === FRAME_BY_ID[pair.referenceId] &&
      summary.nonfinite.count === 0 &&
      summary.comparedSamples === pair.frames * 2,
    `PAIRED_BROWSER_STAT_IDENTITY:${pair.id}`,
  );
  assert(
    ["maxError", "seamError", "tailError", "overCount"].every(
      (key) => summary[key] === independent[key],
    ) &&
      samePoint(summary.firstOver, independent.firstOver) &&
      samePoint(summary.atMax, independent.atMax) &&
      JSON.stringify(summary.perSecondMax) === JSON.stringify(independent.perSecondMax) &&
      Number.isFinite(summary.rmsError) &&
      Math.abs(summary.rmsError - independent.rmsError) <= 1e-15,
    `PAIRED_BROWSER_STAT_MISMATCH:${pair.id}`,
  );
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function verifySource(manifest) {
  assert(
    manifest.schemaVersion === "paired-native-whole-master-v1" &&
      manifest.source.recordingSha256 === PAIRED_RECORDING_SHA256 &&
      manifest.source.assetSha256 === PAIRED_ASSET_SHA256,
    "PAIRED_FIXED_INPUT_IDENTITY",
  );
  const source = manifest.source;
  assert(
    HASH.test(source.recordingStoredSha256) &&
      source.recordingConfigurationSha256 === RECORDING_CONFIGURATION_SHA256 &&
      source.renderConfigurationSha256 === RENDER_CONFIGURATION_SHA256 &&
      createHash("sha256").update(canonical(manifest.configuration)).digest("hex") ===
        RENDER_CONFIGURATION_SHA256,
    "PAIRED_FIXED_CONFIGURATION_HASHES",
  );
  assert(
    source.recording.frameCount === 3601 &&
      source.recording.traceBytes > 0 &&
      source.recording.traceBytes <= 67108864 &&
      source.recording.status === "captured" &&
      source.asset.sha256 === PAIRED_ASSET_SHA256 &&
      source.asset.assetId === "asset.original-long-loop" &&
      source.asset.revision === 1 &&
      source.asset.bytes === 384056 &&
      source.asset.frames === 96000 &&
      source.asset.channels === 1 &&
      source.asset.rate === 48000 &&
      source.window.startTick === 2 &&
      source.window.endTickExclusive === 3602 &&
      source.window.preRollFrames === 800 &&
      source.window.emissionFrames === 2880000 &&
      source.clock.sampleRateHz === 48000,
    "PAIRED_FIXED_SOURCE_MATRIX",
  );
  const master = manifest.configuration.master;
  assert(
    master.headroomGain === 1 &&
      master.monitorGain === 10 ** (12 / 20) &&
      master.limiterEnabled === true &&
      master.outputSafetyClip === true &&
      master.lateReverb.enabled === true &&
      master.lateReverb.decaySeconds === 1.2 &&
      master.lateReverb.wetGain === 0.15 &&
      master.lateReverb.seed === 1746 &&
      source.spatialization.model === "HRTF",
    "PAIRED_FIXED_MASTER_OPTIONS",
  );
  assert(JSON.stringify(manifest.order) === JSON.stringify(PAIRED_ORDER), "PAIRED_GRAPH_ORDER");
  assert(
    manifest.historical.attempt02 === "FAIL_PRESERVED" &&
      manifest.historical.originalWhole63Gate === "NOT_RERUN" &&
      manifest.historical.original16Downloads === "INCOMPLETE_PRESERVED" &&
      manifest.historical.pairedDoesNotReplaceProductGate === true,
    "PAIRED_HISTORICAL_FAILURE_NOT_PRESERVED",
  );
}
export async function verifyPairedDirectory(directory, expectedOutputs) {
  assert(
    Array.isArray(expectedOutputs) &&
      expectedOutputs.length === 5 &&
      new Set(expectedOutputs.map((value) => value.id)).size === 5,
    "PAIRED_EXPECTED_DOWNLOAD_SET",
  );
  const expected = new Map(expectedOutputs.map((value) => [value.id, value]));
  for (const id of PAIRED_ORDER) {
    const file = expected.get(id);
    assert(
      file &&
        file.filename === `${id}.paired.wav` &&
        file.bytes === 56 + FRAME_BY_ID[id] * 8 &&
        HASH.test(file.sha256),
      "PAIRED_EXPECTED_WAVE",
    );
  }
  const sidecar = expected.get("paired-manifest");
  assert(
    sidecar &&
      sidecar.filename === "paired.whole-master.json" &&
      HASH.test(sidecar.sha256) &&
      Number.isSafeInteger(sidecar.bytes) &&
      sidecar.bytes > 0 &&
      sidecar.bytes <= MAX_MANIFEST_BYTES,
    "PAIRED_EXPECTED_SIDECAR",
  );
  const sidecarPath = safeFile(directory, sidecar.filename);
  const sidecarStat = await lstat(sidecarPath);
  assert(
    sidecarStat.isFile() && !sidecarStat.isSymbolicLink() && sidecarStat.size === sidecar.bytes,
    "PAIRED_SIDECAR_LENGTH",
  );
  const text = await readFile(sidecarPath);
  assert(createHash("sha256").update(text).digest("hex") === sidecar.sha256, "PAIRED_SIDECAR_HASH");
  const manifest = JSON.parse(text.toString("utf8"));
  verifySource(manifest);
  assert(
    Array.isArray(manifest.files) &&
      manifest.files.length === 4 &&
      manifest.files.reduce((sum, file) => sum + file.bytes, 0) === 96000224,
    "PAIRED_WAVE_TOTAL",
  );
  assert(
    manifest.resource.maxWorkingBytes === 268435456 &&
      manifest.resource.maxJobEncodedBytes === 201326592 &&
      manifest.resource.maxArchivePayloadBytes === 402653184 &&
      manifest.resource.maxSidecarBytes === MAX_MANIFEST_BYTES &&
      manifest.resource.expectedEncodedBytes === 96000224 &&
      manifest.resource.storedEncodedBytes === 96000224 &&
      manifest.resource.pairedReadEstimatedWorkingBytes > 0 &&
      manifest.resource.pairedReadEstimatedWorkingBytes <= 268435456 &&
      manifest.resource.nativeHeapMeasuredBytes === null &&
      manifest.resource.javascriptHeapMeasuredBytes === null,
    "PAIRED_RESOURCE_ESTIMATE_AND_CAPS",
  );
  const files = [];
  for (const id of PAIRED_ORDER) {
    const claimed = manifest.files.filter((file) => file.id === id);
    assert(
      claimed.length === 1 &&
        claimed[0].filename === expected.get(id).filename &&
        claimed[0].sha256 === expected.get(id).sha256 &&
        claimed[0].bytes === expected.get(id).bytes &&
        claimed[0].frames === FRAME_BY_ID[id] &&
        claimed[0].channels === 2 &&
        claimed[0].rate === 48000,
      `PAIRED_MANIFEST_WAVE:${id}`,
    );
    files.push(await inspectWave(directory, expected.get(id)));
  }
  assert(
    manifest.graphs.length === 4 &&
      manifest.controls.expectedCount === 3602 &&
      manifest.controls.identicalAcrossGraphs === true,
    "PAIRED_CONTROL_MATRIX",
  );
  const controls = [];
  for (const id of PAIRED_ORDER) {
    const graph = manifest.graphs.find((value) => value.id === id);
    const samples = manifest.controls.byGraph[id];
    assert(
      Array.isArray(samples) &&
        samples.length === 3602 &&
        samples.every((value) => Number.isSafeInteger(value) && value >= 0),
      `PAIRED_CONTROLS:${id}`,
    );
    const hash = createHash("sha256").update(JSON.stringify(samples)).digest("hex");
    assert(
      hash === CONTROL_SHA256 &&
        manifest.controls.sha256ByGraph[id] === hash &&
        graph.controlSha256 === hash,
      `PAIRED_CONTROLS_UNCHANGED:${id}`,
    );
    assert(
      graph.frames === FRAME_BY_ID[id] &&
        graph.contextFrames === FRAME_BY_ID[id] + 800 &&
        graph.nonfinite === 0 &&
        graph.outsideUnit === 0 &&
        graph.peak === files.find((file) => file.id === id).peak &&
        Number.isSafeInteger(graph.estimatedWorkingBytes) &&
        graph.estimatedWorkingBytes >= graph.contextFrames * 8 &&
        graph.estimatedWorkingBytes <= 268435456,
      `PAIRED_GRAPH_METADATA:${id}`,
    );
    controls.push({ id, count: samples.length, sha256: hash });
  }
  assert(
    Array.isArray(manifest.comparisons) &&
      manifest.comparisons.length === 6 &&
      new Set(manifest.comparisons.map((value) => value.id)).size === 6,
    "PAIRED_COMPARISON_SET",
  );
  const comparisons = [];
  for (const pair of PAIRED_PAIRS) {
    const browser = manifest.comparisons.find((value) => value.id === pair.id);
    assert(
      browser &&
        browser.actualId === pair.actualId &&
        browser.referenceId === pair.referenceId &&
        browser.frames === pair.frames,
      `PAIRED_COMPARISON_IDENTITY:${pair.id}`,
    );
    const summary = await compareWavePair(directory, pair);
    verifyBrowserSummary(browser.summary, summary, pair);
    comparisons.push({ ...pair, ...summary, withinOriginalTolerance: summary.maxError <= 2e-6 });
  }
  const comparisonsStatus = comparisons.every((value) => value.withinOriginalTolerance)
    ? "PASS"
    : "FAIL";
  assert(
    manifest.status !== "PASS" || comparisonsStatus === "PASS",
    "PAIRED_BROWSER_STATUS_MISMATCH",
  );
  const status =
    manifest.status === "ERROR"
      ? "ERROR"
      : manifest.status === "PASS" && comparisonsStatus === "PASS"
        ? "PASS"
        : "FAIL";
  return {
    status,
    integrity: "PASS",
    scope:
      "Paired-only diagnostic. Original whole63/product/16-download gates remain unpassed and are not rerun.",
    files,
    controls,
    comparisons,
    sidecar: { filename: sidecar.filename, bytes: sidecar.bytes, sha256: sidecar.sha256 },
    readerBufferBytesPerFile: READ_BYTES,
    originalProductGate: "NOT_RERUN",
  };
}

if (!isMainThread && workerData?.kind === "verify-paired-native-downloads") {
  verifyPairedDirectory(workerData.directory, workerData.outputs).then(
    (result) => parentPort.postMessage({ ok: true, result }),
    (error) => parentPort.postMessage({ ok: false, error: String(error), stack: error.stack }),
  );
}
