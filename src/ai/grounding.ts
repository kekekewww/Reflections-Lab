import { AgentError } from "./types.js";
import type { MetricEvidence } from "./types.js";
import { assertBoundedJson, canonicalJson, digestJson } from "./validation.js";

export function explainMetrics(records: MetricEvidence[]): {
  text: string;
  citations: { metricRecordId: string; evidenceArtifactId: string; runId: string }[];
  provenance: "HOST_COMPUTED_EXPLANATION";
} {
  assertBoundedJson(records);
  if (!Array.isArray(records) || records.length < 1 || records.length > 48)
    throw new AgentError("INSUFFICIENT_DATA", "尚無可引用的結果。");
  const ids = new Set<string>();
  const lines: string[] = [];
  for (const record of records) {
    if (
      !record ||
      typeof record.metricRecordId !== "string" ||
      !record.metricRecordId ||
      ids.has(record.metricRecordId) ||
      typeof record.evidenceArtifactId !== "string" ||
      !record.evidenceArtifactId ||
      typeof record.runId !== "string" ||
      !record.runId ||
      typeof record.methodId !== "string" ||
      !record.methodId ||
      typeof record.metricId !== "string" ||
      !record.metricId ||
      typeof record.unit !== "string" ||
      !["Computed", "Estimated", "Measured"].includes(record.provenance) ||
      !Array.isArray(record.limitations)
    )
      throw new AgentError("INSUFFICIENT_DATA", "每個數值都必須有artifact、run及method來源。");
    if (record.availability === "available") {
      if (typeof record.value !== "number" || !Number.isFinite(record.value))
        throw new AgentError("INSUFFICIENT_DATA", "可用結果必須有有限數值。");
      lines.push(
        `${record.metricId}：${record.value} ${record.unit}（${record.provenance}；${record.metricRecordId}）`,
      );
    } else if (record.availability === "unavailable" && record.value === null) {
      lines.push(
        `${record.metricId}：未提供；${record.limitations.join("；") || "資料不足"}（${record.metricRecordId}）`,
      );
    } else throw new AgentError("INSUFFICIENT_DATA", "不可用結果不得填入推測數值。");
    ids.add(record.metricRecordId);
  }
  return {
    text: lines.join("\n"),
    citations: records.map(({ metricRecordId, evidenceArtifactId, runId }) => ({
      metricRecordId,
      evidenceArtifactId,
      runId,
    })),
    provenance: "HOST_COMPUTED_EXPLANATION",
  };
}

export interface GroundingArtifact {
  artifactId: string;
  sha256: string;
  payload: { runId: string; metrics: MetricEvidence[] };
}
/** Production entry: the resolver reads the trusted run ledger, never model-provided artifacts. */
export async function explainVerifiedMetrics(
  records: MetricEvidence[],
  resolve: (artifactId: string) => GroundingArtifact | undefined,
): Promise<ReturnType<typeof explainMetrics>> {
  const explanation = explainMetrics(records);
  for (const record of records) {
    const artifact = resolve(record.evidenceArtifactId);
    if (
      !artifact ||
      artifact.artifactId !== record.evidenceArtifactId ||
      artifact.payload.runId !== record.runId
    )
      throw new AgentError("INSUFFICIENT_DATA", "引用的artifact已不存在或run不符。");
    const hash = await digestJson(artifact.payload);
    if (hash.slice("sha256:".length) !== artifact.sha256)
      throw new AgentError("INSUFFICIENT_DATA", "Artifact內容hash已變更。");
    const metric = artifact.payload.metrics.find(
      (item) => item.metricRecordId === record.metricRecordId,
    );
    if (!metric || canonicalJson(metric) !== canonicalJson(record))
      throw new AgentError("INSUFFICIENT_DATA", "數值不符合可信artifact。");
  }
  return explanation;
}
