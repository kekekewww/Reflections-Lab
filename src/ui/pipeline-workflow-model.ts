import type { ExperimentMetricRecord } from "../app/experiment-tools.js";
import type { AgentExperimentWorkflowView } from "../app/agent-experiment-workflow.js";

/** Resolve a trusted citation within the successful Host result that published it.
 * Metric records reference their recording; explanations reference the derived
 * grounding artifact published alongside those records in the same result.
 */
export function citedWorkflowMetrics(
  workflow: Pick<AgentExperimentWorkflowView, "steps" | "explanation">,
): ExperimentMetricRecord[] {
  const records: ExperimentMetricRecord[] = [];
  const seen = new Set<string>();
  for (const citation of workflow.explanation?.citations ?? []) {
    const key = JSON.stringify([
      citation.metricRecordId,
      citation.evidenceArtifactId,
      citation.runId,
    ]);
    if (seen.has(key)) continue;
    for (const { result } of workflow.steps) {
      if (
        result.state !== "succeeded" ||
        result.runId !== citation.runId ||
        !result.artifactIds.includes(citation.evidenceArtifactId)
      ) {
        continue;
      }
      const record = result.metrics.find(
        (item) => item.metricRecordId === citation.metricRecordId && item.runId === citation.runId,
      );
      if (record) {
        records.push(record);
        seen.add(key);
        break;
      }
    }
  }
  return records;
}
