import test from "node:test";
import assert from "node:assert/strict";
import { TrustedExperimentWorkflow } from "../../src/app/agent-experiment-workflow.js";
import { ExperimentToolHost } from "../../src/app/experiment-tools.js";
import type { ExperimentToolResult } from "../../src/app/experiment-tools.js";
import type { GroundingArtifact } from "../../src/ai/grounding.js";
import type { ToolRequest, MetricEvidence } from "../../src/ai/types.js";
import { digestJson } from "../../src/ai/validation.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import type { ExperimentRecorderOptions } from "../../src/experiments/types.js";
import { SOLVER_VERSION } from "../../src/acoustics/index.js";

function result(
  request: ToolRequest,
  patch: Partial<ExperimentToolResult> = {},
): ExperimentToolResult {
  return {
    schemaVersion: "1.0.0",
    requestId: request.requestId,
    state: "succeeded",
    runId: "run.fixture",
    sceneRevision: request.expectedSceneRevision,
    artifactIds: ["artifact.fixture"],
    metrics: [],
    error: null,
    usage: {
      wallTimeMs: 0,
      solverSteps: 0,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
    },
    explanation: null,
    ...patch,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fake(
  override?: (
    request: ToolRequest,
    original: () => Promise<ExperimentToolResult>,
  ) => Promise<ExperimentToolResult>,
) {
  const scene = createDefaultScene();
  const requests: ToolRequest[] = [];
  const artifacts = new Map<string, GroundingArtifact>();
  let runs = 0;
  let canceledRequest: string | null = null;
  const execute = async (request: ToolRequest): Promise<ExperimentToolResult> => {
    requests.push(structuredClone(request));
    const original = async () => {
      if (request.tool === "RunSimulation") {
        runs++;
        return result(request, { runId: `run.fixture-${runs}` });
      }
      if (request.tool === "CaptureExperiment")
        return result(request, {
          runId: String(request.arguments.runId),
          artifactIds: [`experiment.fixture-${runs}`],
        });
      const runId =
        request.tool === "CompareExperiments"
          ? `run.fixture-${runs}`
          : String(request.arguments.runId);
      const artifactId = `artifact.grounding.fixture-${runs}-${request.tool.toLowerCase()}`;
      const metric: MetricEvidence = {
        metricRecordId: `metric.fixture-${runs}-${request.tool.toLowerCase()}`,
        evidenceArtifactId: artifactId,
        runId,
        metricId: "directArrivalTimeS",
        value: 0.01,
        unit: "s",
        availability: "available",
        provenance: "Computed",
        methodId: "fixture-delay-v1",
        limitations: ["Synthetic protocol fixture; not a solver measurement"],
      };
      const payload = { runId, metrics: [metric] };
      artifacts.set(artifactId, {
        artifactId,
        sha256: (await digestJson(payload)).slice(7),
        payload,
      });
      return result(request, { runId, artifactIds: [artifactId] });
    };
    return override ? override(request, original) : original();
  };
  const workflow = new TrustedExperimentWorkflow({
    getScene: () => structuredClone(scene),
    execute,
    resolveGroundingArtifact: (id) => artifacts.get(id),
    cancelTool: (id) => {
      canceledRequest = id;
      return true;
    },
  });
  return { scene, requests, artifacts, workflow, canceledRequest: () => canceledRequest };
}

test("baseline and candidate use explicit bounded tool requests and trusted citations", async () => {
  const f = fake();
  const baseline = await f.workflow.runBaseline({ durationS: 0.2 });
  assert.equal(baseline.status, "completed");
  assert.deepEqual(
    f.requests.map((request) => request.tool),
    ["RunSimulation", "CaptureExperiment", "AnalyzeAcousticResults"],
  );
  assert.equal(baseline.baseline?.runId, "run.fixture-1");
  assert.equal(baseline.explanation?.provenance, "HOST_COMPUTED_EXPLANATION");
  assert.equal(baseline.explanation?.citations[0]?.runId, "run.fixture-1");
  f.scene.sceneRevision++;
  const candidate = await f.workflow.compareCandidate();
  assert.equal(candidate.status, "completed");
  assert.equal(f.requests[3]?.arguments.replayTraceId, "run.fixture-1");
  assert.equal(f.requests[3]?.arguments.durationS, 0.2);
  assert.equal(f.requests[3]?.expectedSceneRevision, 1);
  assert.equal(f.requests[6]?.arguments.requireMatchedMotionTrace, true);
  assert.equal(candidate.candidate?.runId, "run.fixture-2");
  assert.ok(candidate.comparisonArtifactIds.length > 0);
  candidate.baseline!.settings.metrics.length = 0;
  assert.equal(f.workflow.getView().baseline?.settings.metrics.length, 2);
});

test("host failure and unknown success stop the pipeline before Capture", async () => {
  for (const patch of [
    {
      state: "failed",
      error: {
        code: "SOLVER_FAILED",
        message: "Stopped",
        retryable: false,
        fieldPaths: [],
        retryAfterMs: null,
        detailsArtifactId: null,
      },
    },
    { state: "queued" },
    { state: "succeeded", artifactIds: [] },
    { state: "succeeded", requestId: "request.wrong" },
  ] as Partial<ExperimentToolResult>[]) {
    const f = fake(async (request) => result(request, patch));
    const view = await f.workflow.runBaseline();
    assert.equal(view.status, "failed");
    assert.equal(view.baseline, null);
    assert.equal(f.requests.length, 1);
    assert.equal(view.explanation, null);
  }
});

test("cancel waits for host acknowledgement and never dispatches dependent tools", async () => {
  const pending = deferred<ExperimentToolResult>();
  let activeRequest!: ToolRequest;
  const f = fake(async (request) => {
    activeRequest = request;
    return pending.promise;
  });
  const running = f.workflow.runBaseline();
  assert.equal(f.workflow.cancel(), true);
  assert.equal(f.workflow.getView().status, "cancelRequested");
  assert.equal(f.workflow.getView().cancelAcknowledged, false);
  assert.equal(f.canceledRequest(), activeRequest.requestId);
  await assert.rejects(f.workflow.runBaseline(), { code: "TRANSACTION_BUSY" });
  pending.resolve(result(activeRequest, { state: "canceled", artifactIds: [] }));
  const stopped = await running;
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.cancelAcknowledged, true);
  assert.equal(stopped.steps[0]?.result.state, "canceled");
  assert.equal(f.requests.length, 1);
});

test("a late successful tool remains succeeded while cancellation stops remaining steps", async () => {
  const pending = deferred<ExperimentToolResult>();
  let activeRequest!: ToolRequest;
  const f = fake(async (request) => {
    activeRequest = request;
    return pending.promise;
  });
  const running = f.workflow.runBaseline();
  f.workflow.cancel();
  pending.resolve(result(activeRequest));
  const stopped = await running;
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.cancelAcknowledged, false);
  assert.equal(stopped.steps[0]?.result.state, "succeeded");
  assert.equal(f.requests.length, 1);
});

test("scene changes during a tool invalidate the workflow before dependent steps", async () => {
  const f = fake(async (request, original) => {
    const value = await original();
    if (request.tool === "RunSimulation") f.scene.sceneRevision++;
    return value;
  });
  const view = await f.workflow.runBaseline();
  assert.equal(view.status, "failed");
  assert.equal(view.error?.code, "REVISION_CONFLICT");
  assert.equal(f.requests.length, 1);
});

test("missing, tampered, and wrong-run grounding artifacts cannot produce an explanation", async () => {
  for (const problem of ["missing", "hash", "run"] as const) {
    const f = fake(async (request, original) => {
      const value = await original();
      if (request.tool === "AnalyzeAcousticResults") {
        const id = value.artifactIds[0]!;
        if (problem === "missing") f.artifacts.delete(id);
        else if (problem === "hash") f.artifacts.get(id)!.payload.metrics[0]!.value = 99;
        else f.artifacts.get(id)!.payload.runId = "run.wrong";
      }
      return value;
    });
    const view = await f.workflow.runBaseline();
    assert.equal(view.status, "failed", problem);
    assert.equal(view.error?.code, "INSUFFICIENT_DATA");
    assert.equal(view.explanation, null);
    assert.equal(f.requests.length, 3);
  }
});

test("input and baseline compatibility errors are rejected without dispatch", async () => {
  const f = fake();
  await assert.rejects(f.workflow.compareCandidate(), { code: "INSUFFICIENT_DATA" });
  await assert.rejects(f.workflow.runBaseline({ durationS: 0.11 }), { code: "DOMAIN_INVALID" });
  await assert.rejects(f.workflow.runBaseline({ bandCentersHz: [8000] }), {
    code: "SCHEMA_INVALID",
  });
  assert.equal(f.requests.length, 0);
  await f.workflow.runBaseline({ durationS: 0.2 });
  f.scene.seed++;
  await assert.rejects(f.workflow.compareCandidate(), { code: "INCOMPATIBLE_EXPERIMENTS" });
  assert.equal(f.requests.length, 3);
});

test("real Rapier and acoustic Host workflow preserves motion while comparing an acoustic material change", async () => {
  const scene = createDefaultScene();
  const config = (): ExperimentRecorderOptions => {
    const behavior = createDefaultBehaviors(scene);
    return {
      runId: "run.workflow-source",
      runEpoch: "epoch.workflow-source",
      sceneSnapshot: structuredClone(scene),
      sourceConfig: structuredClone(scene.sources),
      behaviorConfig: behavior,
      generatorConfig: behavior.profiles.map((profile) =>
        profile.rules.map((rule) => rule.generator),
      ),
      solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
      atmosphere: {
        medium: "air",
        speedOfSoundMps: 343,
        temperatureC: 20,
        bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
        dataClass: "Synthetic",
      },
      materialRegistry: DEFAULT_MATERIALS,
      assetManifest: [],
      physicsVersion: "rapier-0.21.0",
      backendId: "custom-web-geometric",
      backendVersion: SOLVER_VERSION,
      fixedDtS: 1 / 60,
      sampleRateHz: 48000,
    };
  };
  const host = new ExperimentToolHost({ getConfiguration: config, getAssets: () => [] });
  const workflow = new TrustedExperimentWorkflow({
    getScene: () => structuredClone(scene),
    execute: (request) => host.execute(request),
    resolveGroundingArtifact: (id) => host.getGroundingArtifact(id),
    cancelTool: (id) => host.cancel(id),
  });
  const baseline = await workflow.runBaseline({ durationS: 0.2 });
  assert.equal(baseline.status, "completed", JSON.stringify(baseline.error));
  assert.ok(baseline.explanation?.citations.length);
  assert.match(baseline.explanation!.text, /rt60S.*未提供/);
  assert.equal(host.getRun(baseline.baseline!.runId)?.frameCount, 13);
  for (const object of scene.objects)
    if (object.acousticMaterialId === "material.hard") object.acousticMaterialId = "material.soft";
  scene.sceneRevision++;
  const candidate = await workflow.compareCandidate();
  assert.equal(candidate.status, "completed", JSON.stringify(candidate.error));
  assert.equal(candidate.steps[0]?.request.arguments.replayTraceId, baseline.baseline!.runId);
  assert.equal(host.getRun(candidate.candidate!.runId)?.frameCount, 13);
  assert.ok(
    candidate.comparisonArtifactIds.some((id) => host.getArtifact(id)?.kind === "comparison"),
  );
  assert.equal(candidate.explanation?.provenance, "HOST_COMPUTED_EXPLANATION");
  assert.ok(
    candidate.explanation?.citations.every(
      (citation) => citation.runId === candidate.candidate!.runId,
    ),
  );
  assert.equal(host.getUsage().runs, 2);
});
