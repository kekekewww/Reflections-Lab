import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ExperimentMetricRecord } from "../app/experiment-tools.js";
import type { AgentSession } from "../app/agent-session.js";
import type { MotionWorkspace } from "../motion/workspace.js";
import type { MotionWorkspaceView } from "../motion/types.js";
import type { AgentExperimentWorkflowView } from "../app/agent-experiment-workflow.js";
import type { LabController, LabViewModel } from "./contracts.js";
import { LocaleProvider } from "./locale.js";
import { AnalysisDock } from "./AnalysisDock.js";
import { AgentWorkflowPanel, MotionDockPanel, RenderDockPanel } from "./PipelinePanels.js";

function controller(): LabController {
  return {
    getSnapshot: () => model,
    subscribe: () => () => {},
    getPose: () => undefined,
    dispatch: () => {},
  };
}
const model: LabViewModel = {
  projectName: "fixture",
  sceneRevision: 1,
  workspace: "scene",
  simulationState: "ready",
  interactionMode: "editor",
  tick: 0,
  simTimeSeconds: 0,
  runId: null,
  objects: [],
  trajectoryStatus: {},
  pathRuns: [],
  paint: null,
  selectedObjectId: null,
  listener: {
    id: "listener",
    positionM: [0, 1, 0],
    orientationQuaternion: [0, 0, 0, 1],
    attachment: "independent",
  },
  paths: [],
  events: [],
  assets: [],
  behaviors: [],
  monitor: {
    state: "muted",
    muted: true,
    gainLinear: 1,
    mode: "simulated",
    activeVoices: 0,
    voiceLimit: 16,
  },
  recording: { state: "idle", eventCount: 0, durationSeconds: 0, canReplay: false },
  ai: { mode: "offline", status: "idle", message: "", canApply: false },
  comparison: { hasA: false, hasB: false, status: "", metrics: [] },
  acoustic: {
    backend: "fixture",
    model: "Numerical approximation",
    revision: null,
    state: "unavailable",
    metrics: [],
  },
  canUndo: false,
  canRedo: false,
};
const render = (node: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(LocaleProvider, null, node));

test("pipeline workspaces remain discoverable with roving-tab semantics for legacy controllers", () => {
  const html = render(createElement(AnalysisDock, { controller: controller(), model }));
  assert.equal((html.match(/role="tab"/g) ?? []).length, 8);
  for (const label of ["動作", "音訊匯出", "效能", "區域"]) assert.ok(html.includes(label), label);
  for (const tab of ["motion", "render", "performance", "zones"]) {
    assert.match(html, new RegExp('aria-controls="[^"]*-' + tab + '-panel"'));
    assert.match(html, new RegExp('id="[^"]*-' + tab + '-panel"'));
  }
});
test("absent composition ports show unavailable rather than pretend to render or author", () => {
  const plain = controller();
  const motion = render(createElement(MotionDockPanel, { controller: plain, model }));
  const output = render(createElement(RenderDockPanel, { controller: plain }));
  assert.match(motion, /此工作階段未提供這項功能/);
  assert.match(output, /此工作階段未提供這項功能/);
  assert.doesNotMatch(output, /下載|download=/);
});
test("workflow uses host status and keeps comparison disabled until a baseline is available", () => {
  const workflow: AgentExperimentWorkflowView = {
    status: "idle",
    operation: null,
    activeRequestId: null,
    baseline: null,
    candidate: null,
    comparisonArtifactIds: [],
    steps: [],
    explanation: null,
    error: null,
    cancelAcknowledged: false,
    canCompare: false,
    provenance: "HOST_COMPUTED_WORKFLOW",
  };
  const app = controller();
  app.getAgentSession = () => ({ getWorkflowView: () => workflow }) as AgentSession;
  const html = render(createElement(AgentWorkflowPanel, { controller: app, send() {} }));
  assert.match(html, /建立基準實驗/);
  assert.match(html, /disabled="">以相同運動比較目前材質/);
  assert.doesNotMatch(html, /可追溯結果/);
});
test("pending cancellation stays busy until the host acknowledges it", () => {
  const workflow: AgentExperimentWorkflowView = {
    status: "cancelRequested",
    operation: "baseline",
    activeRequestId: "request.pending",
    baseline: null,
    candidate: null,
    comparisonArtifactIds: [],
    steps: [],
    explanation: null,
    error: null,
    cancelAcknowledged: false,
    canCompare: false,
    provenance: "HOST_COMPUTED_WORKFLOW",
  };
  const app = controller();
  app.getAgentSession = () => ({ getWorkflowView: () => workflow }) as AgentSession;
  const html = render(createElement(AgentWorkflowPanel, { controller: app, send() {} }));
  assert.match(html, /等待安全取消/);
  assert.match(html, /disabled="" aria-busy="true">建立基準實驗/);
  assert.match(html, /disabled="">取消實驗流程/);
  assert.doesNotMatch(html, /實驗已停止/);
});

test("the AI-host undo remains available after preview closes and is separate from scene undo", () => {
  const applied: LabViewModel = { ...model, ai: { ...model.ai, canUndo: true } };
  const html = render(createElement(AnalysisDock, { controller: controller(), model: applied }));
  const activeButton = /<button([^>]*)>復原上次 AI 套用<\/button>/.exec(html);
  assert.ok(activeButton, "AI host undo stays present after preview closes");
  assert.doesNotMatch(activeButton[1]!, /\bdisabled/);
  assert.doesNotMatch(html, /agent-preview/);
  const legacy = render(createElement(AnalysisDock, { controller: controller(), model }));
  const unavailableButton = /<button([^>]*)>復原上次 AI 套用<\/button>/.exec(legacy);
  assert.ok(unavailableButton);
  assert.match(unavailableButton[1]!, /\bdisabled/);
});

function motionView(stale = false): MotionWorkspaceView {
  return {
    document: {
      schemaVersion: "1.0.0",
      registryId: "motion.fixture",
      revision: stale ? 8 : 7,
      scenePin: {
        sceneId: "scene.fixture",
        sceneRevision: stale ? 2 : 1,
        sceneHash: "a".repeat(64),
      },
      actions: [],
    },
    runs: [],
    activeRunIds: [],
    stale,
    canUndo: !stale,
    canRedo: false,
  };
}

test("Motion UI reads the published Scene-sidecar snapshot without observing the live install", () => {
  let liveReads = 0;
  const app = controller();
  app.getMotionWorkspace = () =>
    ({
      getView() {
        liveReads++;
        throw new Error("New motion is not published with Scene yet");
      },
      subscribe() {
        throw new Error("Motion UI must use the controller publication");
      },
    }) as unknown as MotionWorkspace;
  const published = { ...model, sceneRevision: 1, motion: motionView() };
  const html = render(createElement(MotionDockPanel, { controller: app, model: published }));
  assert.equal(liveReads, 0);
  assert.doesNotMatch(html, /場景已更新/);
  const undo = /<button([^>]*)>復原動作編輯<\/button>/.exec(html);
  assert.ok(undo);
  assert.doesNotMatch(undo[1]!, /\bdisabled/);
});

test("legacy controllers can still render a Motion workspace without the optional snapshot field", () => {
  let liveReads = 0;
  const app = controller();
  app.getMotionWorkspace = () =>
    ({
      getView() {
        liveReads++;
        return motionView(true);
      },
    }) as unknown as MotionWorkspace;
  const html = render(createElement(MotionDockPanel, { controller: app, model }));
  assert.equal(liveReads, 1);
  assert.match(html, /場景已更新/);
});

test("grounded metrics show their band frequency and keep a missing band distinct from zero", () => {
  const metrics: ExperimentMetricRecord[] = [125, 4000, null].map((bandCenterHz, index) => ({
    metricRecordId: `metric.band.${index}`,
    metricId: "rt60S",
    bandCenterHz,
    value: null,
    unit: "s",
    availability: "unsupported",
    provenance: "computed",
    evidenceArtifactId: "artifact.recording",
    runId: "run.band",
    methodId: "method.fixture",
    backendVersion: "fixture",
    materialRevision: 1,
    validationLevel: "V1",
    limitations: ["No full IR"],
  }));
  const workflow: AgentExperimentWorkflowView = {
    status: "completed",
    operation: "baseline",
    activeRequestId: null,
    baseline: null,
    candidate: null,
    comparisonArtifactIds: [],
    steps: [
      {
        phase: "analyze",
        request: {
          schemaVersion: "1.0.0",
          requestId: "request.band",
          tool: "AnalyzeAcousticResults",
          sceneId: "scene.fixture",
          expectedSceneRevision: 1,
          transactionId: null,
          arguments: { runId: "run.band", metrics: ["rt60S"] },
        },
        result: {
          schemaVersion: "1.0.0",
          requestId: "request.band",
          state: "succeeded",
          runId: "run.band",
          sceneRevision: 1,
          artifactIds: ["artifact.recording", "artifact.grounding"],
          metrics,
          error: null,
          usage: {
            wallTimeMs: 1,
            solverSteps: 0,
            inputTokens: null,
            outputTokens: null,
            estimatedCostUsd: 0,
            actualCostUsd: 0,
          },
          explanation: null,
        },
      },
    ],
    explanation: {
      text: "No full IR",
      citations: metrics.map((record) => ({
        metricRecordId: record.metricRecordId,
        evidenceArtifactId: "artifact.grounding",
        runId: record.runId,
      })),
      provenance: "HOST_COMPUTED_EXPLANATION",
    },
    error: null,
    cancelAcknowledged: false,
    canCompare: false,
    provenance: "HOST_COMPUTED_WORKFLOW",
  };
  const app = controller();
  app.getAgentSession = () => ({ getWorkflowView: () => workflow }) as AgentSession;
  const html = render(createElement(AgentWorkflowPanel, { controller: app, send() {} }));
  assert.match(html, /頻率 Hz/);
  for (const band of ["125", "4000", "—"]) {
    assert.ok(html.includes(`<td>rt60S</td><td>未提供</td><td>s</td><td>${band}</td>`));
  }
});
