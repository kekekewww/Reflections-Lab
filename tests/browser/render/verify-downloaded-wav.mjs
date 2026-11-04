import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Independent byte-level inspection of actual UI downloads. No product decoder is imported.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const directory = resolve(
  process.argv[2] ?? resolve(repository, "../../exports/core-pipeline-20261102"),
);
const originalDirectory = resolve(
  process.argv[3] ??
    "C:/Users/kevin/.codex/worktrees/core-pipeline-integration/Meta Hack/.playwright-mcp",
);
const outputPath = resolve(
  process.argv[4] ??
    resolve(repository, ".cache/core-pipeline-final/downloaded-wav-verification.json"),
);
// argv 2..11: exports, originals, receipt, source commit, job ID, bundle path, bundle SHA,
// UI method, optional exact export manifest filename, optional exact original suggested filename.
// argv 12..15 optionally pin a UI originals index and external UI receipt, then their SHA-256s.
// Pins default to the historical first export, never to the current HEAD.
const sourceCommit = process.argv[5] ?? "42d25cb51d8e7d7621b3c1a7038ce00bf6e33459";
const jobId = process.argv[6] ?? "render-b5fbe4bd-78ec-4836-abb8-9dcd4ed792ca";
const bundlePath = process.argv[7] ?? "dist/assets/index-27NgeX35.js";
const expectedBundleSha256 =
  process.argv[8] ?? "d285817d4852ce5b8bf6a56ff3d830430ccca76904ac3e4a2787330e22fc0316";
const uiMethod = process.argv[9] ?? "Playwright MCP actual DOM capture/render/individual download";
assert.match(sourceCommit, /^[a-f0-9]{40}$/, "explicit full source commit");
assert.match(jobId, /^render-[a-z0-9-]+$/, "safe job filename");
assert.match(expectedBundleSha256, /^[a-f0-9]{64}$/, "explicit bundle SHA-256");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function decodeWave(bytes, expected) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, "RIFF length");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  let format;
  let data;
  let factFrames;
  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    assert.ok(offset + 8 <= bytes.length, "complete chunk header");
    const id = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const begin = offset + 8;
    assert.ok(begin + length <= bytes.length, "bounded chunk payload");
    chunks.push({ id, length });
    if (id === "fmt ") {
      assert.equal(format, undefined, "one format chunk");
      assert.ok(length >= 16);
      format = {
        encoding: bytes.readUInt16LE(begin),
        channels: bytes.readUInt16LE(begin + 2),
        sampleRateHz: bytes.readUInt32LE(begin + 4),
        byteRate: bytes.readUInt32LE(begin + 8),
        blockAlign: bytes.readUInt16LE(begin + 12),
        bitsPerSample: bytes.readUInt16LE(begin + 14),
      };
    }
    if (id === "fact") {
      assert.equal(length, 4);
      factFrames = bytes.readUInt32LE(begin);
    }
    if (id === "data") {
      assert.equal(data, undefined, "one data chunk");
      data = bytes.subarray(begin, begin + length);
    }
    offset = begin + length + (length & 1);
  }
  assert.equal(offset, bytes.length, "chunk alignment");
  assert.ok(format && data);
  assert.equal(format.encoding, 3, "IEEE float PCM");
  assert.ok(expected.channels === 1 || expected.channels === 2);
  assert.ok(expected.sampleRateHz === 44100 || expected.sampleRateHz === 48000);
  assert.equal(format.channels, expected.channels);
  assert.equal(format.sampleRateHz, expected.sampleRateHz);
  assert.equal(format.bitsPerSample, 32);
  assert.equal(format.blockAlign, format.channels * 4);
  assert.equal(format.byteRate, format.sampleRateHz * format.blockAlign);
  assert.equal(data.length % format.blockAlign, 0);
  const frames = data.length / format.blockAlign;
  assert.equal(frames, expected.frames);
  assert.equal(factFrames, frames, "fact sample count");
  const samples = new Float32Array(frames * format.channels);
  let peakLinear = 0;
  let squaredSum = 0;
  let nonZeroSamples = 0;
  let samplesOutsideUnitRange = 0;
  let firstNonZeroFrame = null;
  for (let i = 0; i < samples.length; i++) {
    const sample = data.readFloatLE(i * 4);
    assert.ok(Number.isFinite(sample), "finite sample");
    samples[i] = sample;
    const magnitude = Math.abs(sample);
    peakLinear = Math.max(peakLinear, magnitude);
    squaredSum += sample * sample;
    if (magnitude > 0) nonZeroSamples++;
    if (magnitude > 1) samplesOutsideUnitRange++;
    if (magnitude > 1e-12 && firstNonZeroFrame === null)
      firstNonZeroFrame = Math.floor(i / format.channels);
  }
  assert.ok(nonZeroSamples > 0, "PCM data contains nonzero samples");
  return {
    samples,
    format,
    chunks,
    frames,
    durationSeconds: frames / format.sampleRateHz,
    peakLinear,
    rmsLinear: Math.sqrt(squaredSum / samples.length),
    nonZeroSamples,
    samplesOutsideUnitRange,
    firstNonZeroFrame,
    firstNonZeroThreshold: 1e-12,
  };
}
function difference(a, b) {
  assert.equal(a.length, b.length);
  let maxAbsoluteError = 0;
  let squaredSum = 0;
  for (let i = 0; i < a.length; i++) {
    const error = a[i] - b[i];
    maxAbsoluteError = Math.max(maxAbsoluteError, Math.abs(error));
    squaredSum += error * error;
  }
  return { maxAbsoluteError, rmsError: Math.sqrt(squaredSum / a.length) };
}
const originalIndexPath = process.argv[12] ? resolve(process.argv[12]) : null;
const uiReceiptPath = process.argv[13] ? resolve(process.argv[13]) : null;
const originalIndexExpectedSha256 = process.argv[14];
const uiReceiptExpectedSha256 = process.argv[15];
let originalEntries = null;
let uiEvidence = null;
if (originalIndexPath) {
  assert.ok(uiReceiptPath, "UI receipt required with originals index");
  assert.match(originalIndexExpectedSha256 ?? "", /^[a-f0-9]{64}$/, "explicit originals index SHA");
  assert.match(uiReceiptExpectedSha256 ?? "", /^[a-f0-9]{64}$/, "explicit UI receipt SHA");
  const indexBytes = await readFile(originalIndexPath);
  const uiBytes = await readFile(uiReceiptPath);
  assert.equal(sha256(indexBytes), originalIndexExpectedSha256, "pinned originals index");
  assert.equal(sha256(uiBytes), uiReceiptExpectedSha256, "pinned UI action receipt");
  const index = JSON.parse(indexBytes);
  const ui = JSON.parse(uiBytes);
  assert.equal(index.actualJobId, jobId);
  assert.equal(index.candidate, sourceCommit);
  assert.equal(index.entrySha256, expectedBundleSha256);
  assert.equal(ui.status, "PASS");
  assert.equal(ui.renderSummary.jobId, jobId, "UI-rendered job matches requested job");
  assert.equal(
    ui.servedAssets.filter((asset) => asset.sha256 === expectedBundleSha256).length,
    1,
    "UI receipt observed the exact pinned production bundle",
  );
  const originalRoot = await realpath(originalDirectory);
  originalEntries = new Map();
  const sourcePaths = new Set();
  for (const entry of index.files.filter(
    (entry) =>
      typeof entry.actualSuggestedFilename === "string" &&
      (entry.actualSuggestedFilename.startsWith(jobId + "-") ||
        entry.actualSuggestedFilename === jobId + ".manifest.json"),
  )) {
    const name = entry.actualSuggestedFilename;
    assert.equal(basename(name), name, "plain suggested filename");
    assert.ok(!originalEntries.has(name), "unique job-specific suggested filename");
    assert.ok(isAbsolute(entry.sourcePath), "absolute persistent UI download path");
    const sourcePath = await realpath(entry.sourcePath);
    const within = relative(originalRoot, sourcePath);
    assert.ok(
      within !== ".." && !within.startsWith(".." + sep) && !isAbsolute(within),
      "persistent original remains under supplied original directory",
    );
    assert.ok(!sourcePaths.has(sourcePath), "unique job-specific original source path");
    sourcePaths.add(sourcePath);
    const actual = ui.downloads.filter(
      (download) =>
        download.filename === name && resolve(download.path) === resolve(entry.sourcePath),
    );
    assert.equal(actual.length, 1, "exact original path exists in UI receipt");
    assert.equal(actual[0].bytes, entry.bytes);
    assert.equal(actual[0].sha256, entry.sha256);
    originalEntries.set(name, { ...entry, sourcePath });
  }
  uiEvidence = {
    indexPath: originalIndexPath,
    indexSha256: sha256(indexBytes),
    receiptPath: uiReceiptPath,
    receiptSha256: sha256(uiBytes),
    method: ui.method,
    browser: ui.browser,
    status: ui.status,
    url: ui.baseURL,
    stageKinds: ui.stages.map((stage) => stage.kind),
    renderSummary: ui.renderSummary,
    notVerified: ui.notVerified,
    downloads: ui.downloads.map(({ label, filename, path, bytes, sha256 }) => ({
      label,
      filename,
      path,
      bytes,
      sha256,
    })),
    scope:
      "UI operation claims come from this separately pinned external receipt; the independent WAV parser verifies bytes only.",
  };
}
async function readOriginal(name) {
  const indexed = originalEntries?.get(name);
  if (originalEntries && !indexed) return null;
  const sourcePath = indexed?.sourcePath ?? resolve(originalDirectory, name);
  const bytes = await readFile(sourcePath);
  if (indexed) {
    assert.equal(bytes.length, indexed.bytes, "actual persistent original byte count");
    assert.equal(sha256(bytes), indexed.sha256, "actual persistent original SHA");
  }
  return { bytes, sourcePath, sourceFilename: basename(sourcePath), suggestedFilename: name };
}
async function readManifest(directoryPath, requestedName, useOriginalIndex = false) {
  const names = [jobId + ".manifest.json", jobId + "-manifest.json"];
  if (requestedName !== undefined)
    assert.ok(names.includes(requestedName), "explicit manifest name belongs to this job");
  const present = [];
  for (const name of names) {
    try {
      if (useOriginalIndex) {
        const original = await readOriginal(name);
        if (original) present.push({ name, ...original });
      } else present.push({ name, bytes: await readFile(resolve(directoryPath, name)) });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  assert.ok(present.length > 0, "downloaded manifest exists");
  for (const entry of present)
    assert.ok(entry.bytes.equals(present[0].bytes), "manifest aliases have identical bytes");
  const selected =
    requestedName === undefined
      ? present[0]
      : present.find((entry) => entry.name === requestedName);
  assert.ok(selected, "explicit manifest name exists");
  return { ...selected, presentNames: present.map((entry) => entry.name) };
}
const downloadedManifest = await readManifest(directory, process.argv[10]);
const originalManifest = await readManifest(originalDirectory, process.argv[11], true);
const manifestName = downloadedManifest.name;
const manifestBytes = downloadedManifest.bytes;

const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.schemaVersion, "render-export-manifest-v1");
assert.equal(manifest.result.status, "completed");
assert.equal(manifest.job.jobId, jobId);
assert.equal(manifest.job.normalization, "none", "no hidden normalization");
const clock = manifest.job.clock;
assert.equal(clock.policy, "tick-to-sample-rational-v1");
assert.equal(clock.rounding, "nearestTiesToPositiveInfinity");
for (const field of ["tickOrigin", "fixedDtNumerator", "fixedDtDenominator", "sampleRateHz"])
  assert.ok(Number.isSafeInteger(clock[field]), "safe integer clock field " + field);
assert.ok(clock.fixedDtNumerator > 0 && clock.fixedDtDenominator > 0);
assert.ok(clock.sampleRateHz === 44100 || clock.sampleRateHz === 48000);
const window = manifest.job.window;
for (const field of ["startTick", "endTickExclusive", "preRollFrames", "tailFrames"])
  assert.ok(Number.isSafeInteger(window[field]), "safe integer window field " + field);
assert.ok(window.endTickExclusive > window.startTick);
assert.ok(window.preRollFrames >= 0 && window.tailFrames >= 0);
assert.equal(window.outputOrigin, "windowStart");
const sampleAtTick = (tick) => {
  const numerator = (tick - clock.tickOrigin) * clock.fixedDtNumerator * clock.sampleRateHz;
  assert.ok(Number.isSafeInteger(numerator), "exact rational numerator");
  return Math.floor(numerator / clock.fixedDtDenominator + 0.5);
};
// Output excludes preroll and quantum padding; derive the frame count without product code.
const expectedOutputFrames =
  sampleAtTick(window.endTickExclusive) - sampleAtTick(window.startTick) + window.tailFrames;
assert.ok(Number.isSafeInteger(expectedOutputFrames) && expectedOutputFrames > 0);
const declaredOutputs = new Map(manifest.job.outputs.map((output) => [output.id, output]));
assert.equal(declaredOutputs.size, manifest.job.outputs.length, "unique declared output IDs");
assert.ok(declaredOutputs.size >= 4 && declaredOutputs.size <= 16, "bounded stem preset");
for (const [id, tap] of [
  ["mix", "simulatedMix"],
  ["master", "master"],
  ["dry", "dryContent"],
])
  assert.equal(declaredOutputs.get(id)?.tap, tap, "required preset tap " + id);
assert.equal(manifest.result.outputs.length, declaredOutputs.size, "complete result outputs");
assert.equal(
  new Set(manifest.result.outputs.map((output) => output.requestId)).size,
  declaredOutputs.size,
);
assert.equal(manifest.files.length, declaredOutputs.size, "complete manifest file list");
assert.equal(new Set(manifest.files.map((file) => file.id)).size, declaredOutputs.size);
const manifestFiles = new Map(manifest.files.map((file) => [file.id, file]));
const names = (await readdir(directory)).filter(
  (name) => name.startsWith(jobId + "-") && name.endsWith(".wav"),
);
assert.equal(names.length, declaredOutputs.size, "every declared WAV was downloaded");
const decoded = new Map();
const files = [];
for (const output of manifest.result.outputs) {
  const name = jobId + "-" + output.requestId + ".wav";
  assert.ok(names.includes(name));
  const bytes = await readFile(resolve(directory, name));
  const original = await readOriginal(name);
  assert.ok(original, "matching persistent UI original exists");
  const hash = sha256(bytes);
  const declaration = declaredOutputs.get(output.requestId);
  assert.ok(declaration, "result output was declared");
  assert.equal(output.encoding, "float32Pcm");
  assert.equal(output.encoding, declaration.encoding);
  assert.equal(output.channels, declaration.channels);
  assert.equal(output.sampleRateHz, clock.sampleRateHz);
  const fileEntry = manifestFiles.get(output.requestId);
  assert.ok(fileEntry, "result output has file metadata");
  assert.equal(fileEntry.filename, name);
  assert.equal(fileEntry.sha256, hash);
  assert.equal(fileEntry.bytes, bytes.length);
  if (output.requestId.startsWith("stem-")) {
    assert.equal(declaration.tap, "simulatedMix");
    assert.equal(declaration.sources.kind, "includeRecordedSourceIds");
    assert.ok(declaration.sources.sourceIds.length > 0);
  } else {
    assert.ok(["mix", "master", "dry"].includes(output.requestId), "recognized preset output");
  }
  assert.equal(hash, output.artifact.sha256, "manifest WAV hash");
  assert.equal(hash, sha256(original.bytes), "copied bytes match original browser download");
  const wave = decodeWave(bytes, { ...output, frames: expectedOutputFrames });
  assert.equal(wave.frames, output.frames);
  assert.equal(wave.format.channels, output.channels);
  assert.equal(wave.format.sampleRateHz, output.sampleRateHz);
  assert.equal(wave.peakLinear, output.peakLinear, "independently measured peak");
  assert.equal(
    wave.samplesOutsideUnitRange,
    output.samplesOutsideUnitRange,
    "independently counted out-of-unit-range float samples",
  );
  assert.equal(output.clipping.stage, "float32OutputConversion");
  assert.equal(output.clipping.clippedSampleCount, 0, "float output conversion does not clip");
  assert.equal(typeof output.historyIncomplete, "boolean");
  assert.equal(typeof output.tailTruncated, "boolean");
  const safetyMasterBoundAsserted =
    declaration.tap === "master" && manifest.configuration.master.outputSafetyClip === true;
  if (safetyMasterBoundAsserted)
    assert.equal(
      wave.samplesOutsideUnitRange,
      0,
      "configured safety master stays within unit range",
    );
  decoded.set(output.requestId, wave.samples);
  const properties = Object.fromEntries(Object.entries(wave).filter(([key]) => key !== "samples"));
  files.push({
    id: output.requestId,
    file: name,
    absolutePath: resolve(directory, name),
    bytes: bytes.length,
    sha256: hash,
    manifestHashMatches: true,
    originalDownloadHashMatches: true,
    originalDownloadPath: original.sourcePath,
    originalDownloadFile: original.sourceFilename,
    originalSuggestedFilename: original.suggestedFilename,
    clipping: output.clipping,
    historyIncomplete: output.historyIncomplete,
    tailTruncated: output.tailTruncated,
    safetyMasterBoundAsserted,
    ...properties,
  });
}
assert.equal(sha256(manifestBytes), sha256(originalManifest.bytes));
const mix = decoded.get("mix");
const stems = [...decoded].filter(([id]) => id.startsWith("stem-"));
assert.ok(stems.length > 0, "source-stem preset required");
assert.equal(stems.length, declaredOutputs.size - 3, "all declared stems decoded");
const summed = new Float64Array(mix.length);
for (const [, samples] of stems) for (let i = 0; i < summed.length; i++) summed[i] += samples[i];
const stemSum = { ...difference(summed, mix), tolerance: 2e-6 };
assert.ok(stemSum.maxAbsoluteError <= stemSum.tolerance, "pre-master stems sum to mix");
const masterVsMix = difference(decoded.get("master"), mix);
const dryVsMix = difference(decoded.get("dry"), mix);
assert.ok(masterVsMix.maxAbsoluteError > 1e-6, "master is a distinct output");
assert.ok(dryVsMix.maxAbsoluteError > 1e-6, "dry is a distinct output");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repository,
  encoding: "utf8",
}).trim();
const sourcePins = {};
for (const path of [
  "src",
  "server",
  "schemas",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
])
  sourcePins[path] = execFileSync("git", ["rev-parse", sourceCommit + ":" + path], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
let sameProductSource = true;
try {
  execFileSync("git", ["diff", "--quiet", sourceCommit, "--", ...Object.keys(sourcePins)], {
    cwd: repository,
    stdio: "pipe",
  });
} catch (error) {
  if (error.status !== 1) throw error;
  sameProductSource = false;
}
// An explicit "-" permits rechecking archived files when old bundle bytes were not retained.
// This produces PASS_FILES_ONLY, not a claim that bundle bytes were verified.
const bundleBytes = bundlePath === "-" ? null : await readFile(resolve(repository, bundlePath));
const actualBundleSha256 = bundleBytes ? sha256(bundleBytes) : null;
if (bundleBytes) assert.equal(actualBundleSha256, expectedBundleSha256, "pinned bundle bytes");
const receipt = {
  schemaVersion: 1,
  kind: "INDEPENDENT_UI_DOWNLOADED_WAV_VERIFICATION",
  status: bundleBytes ? "PASS" : "PASS_FILES_ONLY",
  executedAtUtc: new Date().toISOString(),
  nodeVersion: process.version,
  sourceCommit,
  verifierSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  observedHead: head,
  pinnedSourceExists: true,
  sourcePins,
  sameProductSource,
  bundle: {
    path: bundlePath,
    expectedSha256: expectedBundleSha256,
    sha256: actualBundleSha256,
    status: bundleBytes ? "HASH_VERIFIED" : "NOT_RUN_EXPLICITLY_OMITTED",
  },
  reproduction: [
    "node",
    "tests/browser/render/verify-downloaded-wav.mjs",
    directory,
    originalDirectory,
    outputPath,
    sourceCommit,
    jobId,
    bundlePath,
    expectedBundleSha256,
    uiMethod,
    manifestName,
    originalManifest.name,
    ...(originalIndexPath
      ? [originalIndexPath, uiReceiptPath, originalIndexExpectedSha256, uiReceiptExpectedSha256]
      : []),
  ],
  uiExecution: {
    method: uiMethod,
    url: uiEvidence?.url ?? "http://127.0.0.1:4173/",
    browser: uiEvidence?.browser ?? "Chrome 156.0.8078.75",
    actions: uiEvidence
      ? {
          fromExternalReceipt: true,
          stageKinds: uiEvidence.stageKinds,
          downloads: uiEvidence.downloads,
        }
      : [
          "Audio export tab",
          "Capture 3 seconds",
          "Render audio files",
          ...files.map((file) => "Download " + file.id),
          "Download provenance manifest",
        ],
    nativeComputerUse:
      "NOT COMPLETED: no native input succeeded; app approval timeouts are recorded separately from browser DOM operations.",
  },
  externalUiEvidence: uiEvidence,
  scope:
    "Digital downloaded-file correctness only; UI action claims, when supplied, come from separately pinned external evidence; no hearing, calibrated SPL, hardware loopback or 600-second performance claim.",
  jobId,
  recordingSha256: manifest.job.recording.sha256,
  renderConfigurationSha256: manifest.job.renderConfiguration.sha256,
  outputLayout: {
    outputCount: declaredOutputs.size,
    stemCount: stems.length,
    clock: manifest.job.clock,
    window: manifest.job.window,
    expectedOutputFrames,
    expectedDurationSeconds: expectedOutputFrames / clock.sampleRateHz,
  },
  manifest: {
    file: manifestName,
    originalDownloadFile: originalManifest.sourceFilename,
    originalSuggestedFilename: originalManifest.name,
    originalDownloadPath: originalManifest.sourcePath,
    presentFileNames: downloadedManifest.presentNames,
    originalPresentFileNames: originalManifest.presentNames,
    bytes: manifestBytes.length,
    sha256: sha256(manifestBytes),
    originalDownloadHashMatches: true,
  },
  outputSemantics: {
    normalization: manifest.job.normalization,
    descriptions: manifest.semantics,
    masterSettings: manifest.configuration.master,
    floatRangePolicy:
      "IEEE float32 pre-master mix, dry and stems may exceed unit range without normalization or output-conversion clipping; exact peak and outside counts must match the manifest. A master with outputSafetyClip enabled must stay within unit range.",
    historyLimit:
      "historyIncomplete reports insufficient captured pre-roll; digital-file PASS does not establish complete earlier native DSP state or causal history.",
  },
  files,
  comparisons: { stemSum, masterVsMix, dryVsMix },
};
await writeFile(outputPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(
  JSON.stringify(
    { status: receipt.status, files: files.length, stemSum, receipt: outputPath },
    null,
    2,
  ),
);
