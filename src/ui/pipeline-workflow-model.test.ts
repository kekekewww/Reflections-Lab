import assert from "node:assert/strict";
import test from "node:test";
import type { ExperimentMetricRecord } from "../app/experiment-tools.js";
import type { AgentExperimentWorkflowView } from "../app/agent-experiment-workflow.js";
import { citedWorkflowMetrics } from "./pipeline-workflow-model.js";

const record: ExperimentMetricRecord = {
  metricRecordId: "metric.delay",
  metricId: "directArrivalTimeS",
  bandCenterHz: null,
  value: 0.012,
  unit: "s",
  availability: "available",
  provenance: "computed",
  evidenceArtifactId: "artifact.recording",
  runId: "run.a",
  methodId: "method.reference",
  backendVersion: "test",
  materialRevision: 1,
  validationLevel: "V1",
  limitations: [],
};
const cite = {
  metricRecordId: record.metricRecordId,
  evidenceArtifactId: "artifact.grounding",
  runId: record.runId,
};
function workflow(
  records: ExperimentMetricRecord[],
  citations: { metricRecordId: string; evidenceArtifactId: string; runId: string }[],
) {
  return {
    steps: [
      {
        result: {
          state: "succeeded",
          runId: "run.a",
          artifactIds: ["artifact.recording", "artifact.grounding"],
          metrics: records,
        },
      },
    ],
    explanation: {
      text: "Original host evidence",
      citations,
      provenance: "HOST_COMPUTED_EXPLANATION",
    },
  } as unknown as Pick<AgentExperimentWorkflowView, "steps" | "explanation">;
}

test("workflow joins recording-backed metrics to grounding citations published by the same Host result", () => {
  const uncited = { ...record, metricRecordId: "metric.uncited" };
  const input = workflow(
    [record, uncited],
    [cite, { ...cite, runId: "run.foreign" }, { ...cite, evidenceArtifactId: "artifact.foreign" }],
  );
  assert.deepEqual(citedWorkflowMetrics(input), [record]);
  assert.equal(record.evidenceArtifactId, "artifact.recording");
  assert.equal(record.value, 0.012);
});

test("unavailable host metrics stay null and duplicate citations create one row", () => {
  const missing: ExperimentMetricRecord = {
    ...record,
    value: null,
    availability: "unsupported",
    limitations: ["No IR"],
  };
  assert.deepEqual(citedWorkflowMetrics(workflow([missing], [cite, cite])), [missing]);
  assert.equal(citedWorkflowMetrics(workflow([missing], [cite]))[0]!.value, null);
});

test("uncited or unresolved metrics do not become grounded rows", () => {
  assert.deepEqual(citedWorkflowMetrics({ steps: [], explanation: null }), []);
  assert.deepEqual(citedWorkflowMetrics(workflow([], [cite])), []);
});

test("a citation cannot join an artifact from another step or a failed result", () => {
  const split = workflow([record], [cite]);
  split.steps[0]!.result.artifactIds = ["artifact.recording"];
  split.steps.push({
    ...split.steps[0]!,
    result: { ...split.steps[0]!.result, artifactIds: ["artifact.grounding"], metrics: [] },
  });
  assert.deepEqual(citedWorkflowMetrics(split), []);
  const failed = workflow([record], [cite]);
  failed.steps[0]!.result.state = "failed";
  assert.deepEqual(citedWorkflowMetrics(failed), []);
});

test("a matching metric ID must also belong to the published result run", () => {
  const wrongMetricRun = workflow([{ ...record, runId: "run.foreign" }], [cite]);
  assert.deepEqual(citedWorkflowMetrics(wrongMetricRun), []);
  const wrongResultRun = workflow([record], [cite]);
  wrongResultRun.steps[0]!.result.runId = "run.foreign";
  assert.deepEqual(citedWorkflowMetrics(wrongResultRun), []);
});
