import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function requireCondition(condition, code, message) {
  if (!condition) throw new Error(`${code}: ${message}`);
}

function samples(value) {
  return value instanceof Float32Array || value instanceof Float64Array;
}

/**
 * A diagnostic in the complex fundamental domain. Its phase/amplitude estimates
 * do not decide PCM waveform acceptance, harmonic fidelity or hearing quality.
 */
export function analyzeFundamental(reference, candidate, options) {
  requireCondition(
    samples(reference) && samples(candidate),
    "PHASE_PCM_TYPE",
    "Floating-point PCM arrays are required",
  );
  requireCondition(
    reference.length > 0 && reference.length === candidate.length,
    "PHASE_PCM_LENGTH",
    "Nonempty matching PCM lengths are required",
  );
  const { sampleRate, frequencyHz, startFrame, endFrame } = options;
  requireCondition(
    Number.isFinite(sampleRate) && sampleRate > 0,
    "PHASE_SAMPLE_RATE",
    "Sample rate must be finite and positive",
  );
  requireCondition(
    Number.isFinite(frequencyHz) && frequencyHz > 0 && frequencyHz < sampleRate / 2,
    "PHASE_FREQUENCY",
    "Fundamental must lie strictly between zero and Nyquist",
  );
  requireCondition(
    Number.isSafeInteger(startFrame) &&
      Number.isSafeInteger(endFrame) &&
      startFrame >= 0 &&
      endFrame <= reference.length &&
      endFrame - startFrame >= 3,
    "PHASE_WINDOW",
    "An in-bounds window of at least three samples is required",
  );
  for (let index = 0; index < reference.length; index++)
    requireCondition(
      Number.isFinite(reference[index]) && Number.isFinite(candidate[index]),
      "PHASE_PCM_NONFINITE",
      "All PCM samples must be finite",
    );
  const count = endFrame - startFrame;
  let referenceReal = 0,
    referenceImaginary = 0;
  let candidateReal = 0,
    candidateImaginary = 0;
  let referenceEnergy = 0,
    candidateEnergy = 0,
    weightSum = 0;
  const angularFrequency = (2 * Math.PI * frequencyHz) / sampleRate;
  for (let index = startFrame; index < endFrame; index++) {
    const weight = 0.5 * (1 - Math.cos((2 * Math.PI * (index - startFrame)) / (count - 1)));
    const cosine = Math.cos(angularFrequency * index);
    const negativeSine = -Math.sin(angularFrequency * index);
    const left = reference[index],
      right = candidate[index];
    referenceReal += weight * left * cosine;
    referenceImaginary += weight * left * negativeSine;
    candidateReal += weight * right * cosine;
    candidateImaginary += weight * right * negativeSine;
    referenceEnergy += weight * left * left;
    candidateEnergy += weight * right * right;
    weightSum += weight;
  }
  requireCondition(
    referenceEnergy > 0 && candidateEnergy > 0,
    "PHASE_ZERO_ENERGY",
    "Both declared analysis windows must have nonzero energy",
  );
  const referenceMagnitude = Math.hypot(referenceReal, referenceImaginary);
  const candidateMagnitude = Math.hypot(candidateReal, candidateImaginary);
  requireCondition(
    referenceMagnitude > 0 && candidateMagnitude > 0,
    "PHASE_UNRESOLVED_FUNDAMENTAL",
    "A nonzero complex fundamental is required",
  );
  const crossReal = candidateReal * referenceReal + candidateImaginary * referenceImaginary;
  const crossImaginary = candidateImaginary * referenceReal - candidateReal * referenceImaginary;
  const phaseErrorRadians = Math.atan2(crossImaginary, crossReal);
  const amplitudeRatio = candidateMagnitude / referenceMagnitude;
  requireCondition(
    Number.isFinite(phaseErrorRadians) && Number.isFinite(amplitudeRatio),
    "PHASE_RESULT_NONFINITE",
    "Complex analysis must produce finite diagnostics",
  );
  return {
    domain: "fundamentalComplexDiagnostic",
    model: "symmetricHannWeightedComplexProjection-v1",
    sampleRate,
    frequencyHz,
    startFrame,
    endFrame,
    windowFrames: count,
    phaseConvention: "principalAngle(candidateFundamental * conjugate(referenceFundamental))",
    phaseErrorRadians,
    amplitudeRatio,
    referenceAmplitude: (2 * referenceMagnitude) / weightSum,
    candidateAmplitude: (2 * candidateMagnitude) / weightSum,
    limitations: [
      "Fundamental estimates do not replace per-sample PCM acceptance",
      "Hann suppresses boundary artifacts in this diagnostic only; the PCM gate retains every sample",
      "No calibrated SPL, device output or hearing inference",
    ],
  };
}

// Frozen fixture.ts: generated sample at 173Hz / oscillator at 173.3Hz,
// followed by its recorded +12-semitone target before the comparison window.
const FROZEN_CORE_FUNDAMENTALS_HZ = Object.freeze({
  "sample-integrated-pitch-and-offset": 346,
  "oscillator-sine-integrated-phase": 346.6,
  "oscillator-square-integrated-phase": 346.6,
  "oscillator-triangle-integrated-phase": 346.6,
  "oscillator-sawtooth-integrated-phase": 346.6,
});
// Expanded pause cases retain the exact same content and final pitch target.
const FROZEN_FINAL_FUNDAMENTALS_HZ = Object.freeze({
  ...FROZEN_CORE_FUNDAMENTALS_HZ,
  ...Object.fromEntries(
    Object.entries(FROZEN_CORE_FUNDAMENTALS_HZ).map(([id, frequency]) => [
      `pause-${id}`,
      frequency,
    ]),
  ),
});

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readVerifiedPcm(entry, summary, summaryDirectory) {
  requireCondition(
    entry && typeof entry.path === "string" && entry.path.length > 0,
    "PCM_PATH",
    "Each PCM artifact requires a path",
  );
  requireCondition(
    Number.isSafeInteger(entry.frames) &&
      entry.frames > 0 &&
      entry.frames === summary.frames &&
      entry.channels === 1 &&
      entry.sampleRate === summary.sampleRate,
    "PCM_METADATA",
    "Mono PCM dimensions must match the declared render",
  );
  requireCondition(
    typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/.test(entry.sha256),
    "PCM_HASH_METADATA",
    "Each PCM artifact requires a SHA-256 digest",
  );
  const resolvedPath = path.isAbsolute(entry.path)
    ? entry.path
    : path.resolve(summaryDirectory, entry.path);
  const bytes = await readFile(resolvedPath);
  const expectedBytes = entry.frames * entry.channels * 4;
  requireCondition(
    bytes.byteLength > 0 && bytes.byteLength === expectedBytes,
    "PCM_BYTE_COUNT",
    "PCM must be nonempty and match frames × channels × four bytes",
  );
  const actualSha256 = hash(bytes);
  requireCondition(
    actualSha256 === entry.sha256,
    "PCM_HASH_MISMATCH",
    "PCM bytes differ from the immutable summary",
  );
  const pcm = new Float32Array(entry.frames);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let frame = 0; frame < pcm.length; frame++) {
    const value = view.getFloat32(frame * 4, true);
    requireCondition(
      Number.isFinite(value),
      "PCM_NONFINITE",
      "PCM contains a nonfinite Float32 sample",
    );
    pcm[frame] = value;
  }
  return {
    pcm,
    receipt: {
      id: entry.id,
      kind: entry.kind,
      path: resolvedPath,
      frames: entry.frames,
      channels: entry.channels,
      sampleRate: entry.sampleRate,
      bytes: bytes.byteLength,
      expectedBytes,
      sha256: actualSha256,
      validation: "PASS",
    },
  };
}

/** Independently verify stored PCM and repeat the original fade-inclusive gate. */
export async function analyzeSummary(summaryPath) {
  const resolvedSummaryPath = path.resolve(summaryPath);
  const summaryBytes = await readFile(resolvedSummaryPath);
  const summary = JSON.parse(summaryBytes.toString("utf8"));
  requireCondition(
    Number.isFinite(summary.sampleRate) &&
      summary.sampleRate > 0 &&
      Number.isSafeInteger(summary.frames) &&
      summary.frames > 0 &&
      Array.isArray(summary.results) &&
      summary.results.length > 0 &&
      Array.isArray(summary.pcmFiles) &&
      summary.pcmFiles.length === summary.results.length * 2,
    "PCM_SUMMARY",
    "Summary must declare nonempty cases and exactly two PCM artifacts per case",
  );
  const receipts = [];
  const results = [];
  const consumed = new Set();
  const resultIds = new Set();
  for (const entry of summary.results) {
    requireCondition(
      typeof entry.id === "string" && !resultIds.has(entry.id),
      "PCM_CASE_ID",
      "Summary case identities must be unique",
    );
    resultIds.add(entry.id);
    const pair = {};
    for (const kind of ["reference", "candidate"]) {
      const matching = summary.pcmFiles.filter(
        (file) => file.id === entry.id && file.kind === kind,
      );
      requireCondition(
        matching.length === 1,
        "PCM_PAIR",
        "Each case requires one reference and one candidate PCM",
      );
      const file = matching[0];
      consumed.add(file);
      const verified = await readVerifiedPcm(file, summary, path.dirname(resolvedSummaryPath));
      pair[kind] = verified.pcm;
      receipts.push(verified.receipt);
    }
    const promotionTime = entry.actualTimes?.[2];
    const fadeSeconds = entry.promotionFadeSeconds;
    requireCondition(
      Number.isFinite(promotionTime) &&
        promotionTime >= 0 &&
        Number.isFinite(fadeSeconds) &&
        fadeSeconds > 0,
      "PCM_COMPARISON_TIME",
      "Original promotion time and fade duration are required",
    );
    const begin = Math.ceil(promotionTime * summary.sampleRate);
    requireCondition(
      begin === entry.comparedFromFrame &&
        begin >= 0 &&
        begin < summary.frames &&
        entry.ignoredPostPromotionFrames === 0,
      "PCM_COMPARISON_WINDOW",
      "Original comparison must include every sample from promotion onward",
    );
    const expected = new Float64Array(summary.frames);
    let maxError = 0,
      squareError = 0,
      referenceEnergy = 0,
      silentVirtualPeak = 0;
    for (let frame = 0; frame < summary.frames; frame++) {
      if (frame < promotionTime * summary.sampleRate)
        silentVirtualPeak = Math.max(silentVirtualPeak, Math.abs(pair.candidate[frame]));
      if (frame < begin) continue;
      const fade = Math.min(
        1,
        Math.max(0, (frame / summary.sampleRate - promotionTime) / fadeSeconds),
      );
      expected[frame] = pair.reference[frame] * fade;
      const error = pair.candidate[frame] - expected[frame];
      maxError = Math.max(maxError, Math.abs(error));
      squareError += error * error;
      referenceEnergy += expected[frame] * expected[frame];
    }
    requireCondition(
      referenceEnergy > 0,
      "PCM_REFERENCE_ENERGY",
      "Comparison reference must have nonzero energy",
    );
    const relativeRmsError = Math.sqrt(squareError / referenceEnergy);
    const rmsError = Math.sqrt(squareError / (summary.frames - begin));
    const pcmPass = maxError < 2e-6 && relativeRmsError < 2e-6 && silentVirtualPeak === 0;
    const admissionPass =
      entry.admission?.reason === "VIRTUALIZED" && entry.candidateTelemetry?.virtualVoices === 0;
    const frequencyHz = FROZEN_FINAL_FUNDAMENTALS_HZ[entry.id];
    requireCondition(
      Number.isFinite(frequencyHz),
      "PHASE_FREQUENCY_SOURCE",
      "Case has no fixed authored fundamental metadata",
    );
    const fundamental = analyzeFundamental(expected, pair.candidate, {
      sampleRate: summary.sampleRate,
      frequencyHz,
      startFrame: begin,
      endFrame: summary.frames,
    });
    results.push({
      id: entry.id,
      originalPass: entry.pass,
      recomputedPass: pcmPass && admissionPass,
      pcm: {
        domain: "fadeInclusiveEverySamplePcmAcceptance",
        tolerance: 2e-6,
        maxError,
        relativeRmsError,
        rmsError,
        silentVirtualPeak,
        comparedFromFrame: begin,
        comparedThroughFrameExclusive: summary.frames,
        ignoredPostPromotionFrames: 0,
        promotionTime,
        promotionFadeSeconds: fadeSeconds,
        pass: pcmPass,
        matchesOriginalMaxError: maxError === entry.maxError,
        matchesOriginalRelativeRmsError: relativeRmsError === entry.relativeRmsError,
      },
      admissionPass,
      fundamental: {
        ...fundamental,
        reference: "original reference multiplied by its declared promotion fade",
        frequencySource: "frozen fixture authored frequency multiplied by final +12-semitone ratio",
      },
    });
  }
  requireCondition(
    consumed.size === summary.pcmFiles.length,
    "PCM_EXTRA_ARTIFACT",
    "Unmatched PCM artifacts are not accepted",
  );
  const pcmRecomputedStatus = results.every((entry) => entry.recomputedPass) ? "PASS" : "FAIL";
  const analyzerPath = fileURLToPath(import.meta.url);
  return {
    // A later diagnostic never upgrades a stored FAIL, even if another domain is close.
    status: summary.status === "PASS" && pcmRecomputedStatus === "PASS" ? "PASS" : "FAIL",
    originalStatus: summary.status,
    pcmRecomputedStatus,
    phaseDiagnosticsAffectAcceptance: false,
    summary: { path: resolvedSummaryPath, sha256: hash(summaryBytes) },
    analyzer: { path: analyzerPath, sha256: hash(await readFile(analyzerPath)) },
    originalSourceProvenance: { git: summary.git ?? null, files: summary.files ?? null },
    verifiedPcmFiles: receipts,
    results,
    limitations: [
      "Hann-weighted fundamental diagnostics and every-sample PCM residuals are different domains",
      "No waveform FAIL is replaced by a fundamental phase result",
      "No new rendering, hardware hearing, calibrated acoustic or cross-browser claim",
    ],
  };
}

const invokedAsCli =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsCli) {
  try {
    requireCondition(
      process.argv[2],
      "ANALYSIS_ARGUMENT",
      "Usage: node analyze-pcm.mjs <summary.json> [analysis.json]",
    );
    const result = await analyzeSummary(process.argv[2]);
    if (process.argv[3]) {
      const output = path.resolve(process.argv[3]);
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, JSON.stringify(result, null, 2) + "\n");
    } else process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (process.argv[3])
      process.stdout.write(
        JSON.stringify({
          status: result.status,
          pcmRecomputedStatus: result.pcmRecomputedStatus,
          verifiedFiles: result.verifiedPcmFiles.length,
          cases: result.results.length,
          output: path.resolve(process.argv[3]),
        }) + "\n",
      );
    if (result.status !== "PASS") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(JSON.stringify({ status: "FAIL", error: String(error) }) + "\n");
    process.exitCode = 1;
  }
}
