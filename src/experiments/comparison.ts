import type { ComparisonRun, SoundBehaviorComparison } from "../../schemas/sound-behavior/types.js";
import { verifyRecording } from "./recorder.js";
import { sha256Canonical } from "./hash.js";
import { normalizeSourcePhase } from "./source-phase.js";
import { RecordingError } from "./types.js";
import type { RecordingArtifact, RecordingComparison } from "./types.js";
import {
  collectRecordingPathSamples,
  compatiblePathMetricPopulation,
  computeRecordingMetrics,
} from "./metrics.js";
export { computeRecordingMetrics } from "./metrics.js";

export async function compareRecordings(
  a: RecordingArtifact,
  b: RecordingArtifact,
  options: {
    kind: "acoustic" | "behavior";
    independentVariables: SoundBehaviorComparison["independentVariables"];
  },
): Promise<RecordingComparison> {
  await Promise.all([verifyRecording(a), verifyRecording(b)]);
  if (a.status !== "captured" || b.status !== "captured")
    throw new RecordingError("INCOMPLETE_RECORDING", "A/B 必須使用完整 Captured artifacts。");
  if (!["acoustic", "behavior"].includes(options.kind))
    throw new RecordingError("COMPARISON_KIND", "必須明示 acoustic 或 behavior 比較。");
  const variables = options.independentVariables;
  const known = [
    "acousticMaterial",
    "sourceAsset",
    "generator",
    "gainMapping",
    "pitchMapping",
    "behaviorProfile",
  ];
  if (
    !Array.isArray(variables) ||
    variables.length === 0 ||
    variables.length > 5 ||
    new Set(variables).size !== variables.length ||
    variables.some((v) => !known.includes(v))
  )
    throw new RecordingError("INDEPENDENT_VARIABLE", "自變項必須明示、有效且不重複。");
  if (
    options.kind === "acoustic" &&
    (variables.length !== 1 || variables[0] !== "acousticMaterial")
  )
    throw new RecordingError(
      "INDEPENDENT_VARIABLE",
      "目前 acoustic 模式只支援明示 acousticMaterial。",
    );
  if (options.kind === "behavior" && variables.includes("acousticMaterial"))
    throw new RecordingError("INDEPENDENT_VARIABLE", "Behavior 比較不能同時改傳播材質。");
  const allowed = new Set<keyof ComparisonRun>();
  if (options.kind === "acoustic") allowed.add("propagationMaterialHash");
  else {
    allowed.add("profileHash");
    allowed.add("sourceSignalHash");
    if (variables.some((v) => ["sourceAsset", "behaviorProfile"].includes(v)))
      allowed.add("assetManifestHash");
    if (variables.some((v) => ["sourceAsset", "generator", "behaviorProfile"].includes(v)))
      allowed.add("generatorConfigHash");
  }
  const mismatches: RecordingComparison["mismatches"] = [];
  for (const key of Object.keys(a.fingerprints) as (keyof ComparisonRun)[]) {
    if (key === "runId" || allowed.has(key)) continue;
    // Versioned source hashes use different algorithms. Their actual source
    // configuration and phase proof are compared below without rewriting either artifact.
    if (key === "sourceSignalHash" && a.fingerprintVersion !== b.fingerprintVersion) continue;
    if (a.fingerprints[key] !== b.fingerprints[key])
      mismatches.push({ field: key, reason: `${key} 必須相同，不能歸因於已宣告的自變項。` });
  }
  if (options.kind === "acoustic") {
    const phaseA = normalizeSourcePhase(a.configuration, a.frames),
      phaseB = normalizeSourcePhase(b.configuration, b.frames);
    if (
      phaseA.evidence.evidenceClass === "missing" ||
      phaseB.evidence.evidenceClass === "missing"
    ) {
      mismatches.push({
        field: "sourcePhaseProof",
        reason: `來源相位證據不足：A=${phaseA.evidence.reason ?? phaseA.evidence.evidenceClass}；B=${phaseB.evidence.reason ?? phaseB.evidence.evidenceClass}。`,
      });
    }
    const sourceValues = (
      recording: RecordingArtifact,
      phase: ReturnType<typeof normalizeSourcePhase>,
    ) => ({
      sceneSources: recording.configuration.sceneSnapshot.sources,
      configuration: recording.configuration.sourceConfig,
      sourcePhase: phase,
    });
    const hashes = await Promise.all([
      sha256Canonical(sourceValues(a, phaseA)),
      sha256Canonical(sourceValues(b, phaseB)),
    ]);
    if (hashes[0] !== hashes[1] && !mismatches.some((entry) => entry.field === "sourceSignalHash"))
      mismatches.push({
        field: "sourceSignalHash",
        reason: "實際來源內容／邏輯相位／原生 cursor 證據必須相同；僅配置相同不足以 matched。",
      });
  }
  const aMetrics = computeRecordingMetrics(a),
    bMetrics = computeRecordingMetrics(b);
  const samplesA = collectRecordingPathSamples(a),
    samplesB = collectRecordingPathSamples(b);
  const matched = mismatches.length === 0;
  const metrics = aMetrics.map((left) => {
    const right = bMetrics.find((m) => m.id === left.id)!;
    const sampleKind =
      left.id === "meanDirectDelay"
        ? "directDelay"
        : left.id === "meanPathEnergy"
          ? "pathEnergy"
          : null;
    const methodCompatible = left.method === right.method;
    const populationCompatible =
      sampleKind === null || compatiblePathMetricPopulation(samplesA, samplesB, sampleKind);
    const available =
      matched &&
      methodCompatible &&
      populationCompatible &&
      left.value !== null &&
      right.value !== null;
    const rawDelta = available ? right.value! - left.value! : null;
    const delta = rawDelta !== null && Number.isFinite(rawDelta) ? rawDelta : null;
    const rawPercent =
      delta !== null && left.value !== 0 ? (delta / Math.abs(left.value!)) * 100 : null;
    const percentDelta = rawPercent !== null && Number.isFinite(rawPercent) ? rawPercent : null;
    return {
      id: left.id,
      label: left.label,
      a: left.value,
      b: right.value,
      delta,
      percentDelta,
      unit: left.unit,
      method: methodCompatible ? left.method : `A: ${left.method}; B: ${right.method}`,
      ...(left.population && right.population
        ? {
            population: {
              a: left.population,
              b: right.population,
              compatible: methodCompatible && populationCompatible,
            },
          }
        : {}),
      reason: !matched
        ? "INCOMPATIBLE_EXPERIMENTS"
        : !methodCompatible
          ? "INCOMPATIBLE_METRIC_METHOD"
          : !populationCompatible
            ? "INCOMPATIBLE_METRIC_POPULATION"
            : !available
              ? (left.reason ?? right.reason)
              : (rawDelta !== null && delta === null) ||
                  (rawPercent !== null && percentDelta === null)
                ? "NUMERIC_RANGE"
                : left.value === 0
                  ? "BASELINE_ZERO_PERCENT_UNAVAILABLE"
                  : null,
    };
  });
  return {
    kind: options.kind,
    matched,
    runA: a.runId,
    runB: b.runId,
    mismatches,
    independentVariables: [...variables],
    metrics,
  };
}
