import { AgentError } from "../ai/types.js";
import type { ToolRequest } from "../ai/types.js";
import { explainVerifiedMetrics } from "../ai/grounding.js";
import type { GroundingArtifact } from "../ai/grounding.js";
import { assertBoundedJson, validateToolRequest } from "../ai/validation.js";
import type { SceneSpec } from "../scene/types.js";
import type { ExperimentMetricId, ExperimentToolResult } from "./experiment-tools.js";

export interface AgentExperimentSettings {
  durationS?: number;
  sampleRateHz?: 44100 | 48000;
  metrics?: ExperimentMetricId[];
  bandCentersHz?: number[];
}
interface Settings {
  durationS: number;
  sampleRateHz: 44100 | 48000;
  metrics: ExperimentMetricId[];
  bandCentersHz: number[];
}
export interface AgentExperimentTake {
  sceneId: string;
  sceneRevision: number;
  seed: number;
  settings: Settings;
  runId: string;
  experimentId: string;
  recordingArtifactIds: string[];
  analysisArtifactIds: string[];
}
export interface AgentExperimentStep {
  phase: "run" | "capture" | "analyze" | "compare";
  request: ToolRequest;
  result: ExperimentToolResult;
}
export interface AgentExperimentWorkflowView {
  status: "idle" | "running" | "cancelRequested" | "completed" | "stopped" | "failed";
  operation: "baseline" | "candidate" | null;
  activeRequestId: string | null;
  baseline: AgentExperimentTake | null;
  candidate: AgentExperimentTake | null;
  comparisonArtifactIds: string[];
  steps: AgentExperimentStep[];
  explanation: Awaited<ReturnType<typeof explainVerifiedMetrics>> | null;
  error: { code: string; message: string } | null;
  cancelAcknowledged: boolean;
  canCompare: boolean;
  provenance: "HOST_COMPUTED_WORKFLOW";
}
export interface AgentExperimentWorkflowOptions {
  getScene(): SceneSpec;
  execute(request: ToolRequest): Promise<ExperimentToolResult>;
  /** This resolver must read the trusted host's artifact catalog, never model input. */
  resolveGroundingArtifact(artifactId: string): GroundingArtifact | undefined;
  /** True means a cancellation was requested, not that the tool has acknowledged it. */
  cancelTool?(requestId: string): boolean;
  onChange?(): void;
}
interface Operation {
  id: string;
  scene: SceneSpec;
  settings: Settings;
  cancelRequested: boolean;
  requestSequence: number;
}
class WorkflowStopped extends Error {}

/** A bounded host workflow around the same tools used by the product agent. It never Applys. */
export class TrustedExperimentWorkflow {
  private active: Operation | null = null;
  private view: AgentExperimentWorkflowView = {
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

  constructor(private readonly options: AgentExperimentWorkflowOptions) {}

  getView(): AgentExperimentWorkflowView {
    return structuredClone(this.view);
  }

  private changed(update: Partial<AgentExperimentWorkflowView>): void {
    this.view = { ...this.view, ...update };
    this.options.onChange?.();
  }

  private request(
    operation: Operation,
    tool: ToolRequest["tool"],
    argumentsValue: Record<string, unknown>,
  ): ToolRequest {
    return validateToolRequest({
      schemaVersion: "1.0.0",
      requestId: `request.workflow.${operation.id}.${++operation.requestSequence}`,
      tool,
      sceneId: operation.scene.sceneId,
      expectedSceneRevision: operation.scene.sceneRevision,
      transactionId: null,
      arguments: argumentsValue,
    });
  }

  private runArguments(operation: Operation, replayTraceId: string | null) {
    return {
      backendId: "custom-web",
      durationS: operation.settings.durationS,
      timeStepS: 1 / 60,
      seed: operation.scene.seed,
      replayTraceId,
      maxReflectionOrder: 1,
      sampleRateHz: operation.settings.sampleRateHz,
    };
  }

  private begin(kind: "baseline" | "candidate", input: AgentExperimentSettings): Operation {
    if (this.active) throw new AgentError("TRANSACTION_BUSY", "實驗流程正在執行或等待取消確認。");
    const operation: Operation = {
      id: crypto.randomUUID().replaceAll("-", ""),
      scene: structuredClone(this.options.getScene()),
      settings: {
        durationS: input.durationS ?? 3,
        sampleRateHz: input.sampleRateHz ?? 48000,
        metrics: structuredClone(input.metrics ?? ["directArrivalTimeS", "rt60S"]),
        bandCentersHz: structuredClone(input.bandCentersHz ?? [1000]),
      },
      cancelRequested: false,
      requestSequence: 0,
    };
    // Validate the real tool shape and clock before dispatching or replacing previous results.
    this.request(operation, "RunSimulation", this.runArguments(operation, null));
    this.request(operation, "AnalyzeAcousticResults", {
      runId: "run.validation",
      metrics: operation.settings.metrics,
      bandCentersHz: operation.settings.bandCentersHz,
    });
    const ticks = operation.settings.durationS * 60;
    if (Math.abs(ticks - Math.round(ticks)) > 1e-9)
      throw new AgentError("DOMAIN_INVALID", "實驗時長必須是 1/60 秒的整數倍。");
    operation.requestSequence = 0;
    this.active = operation;
    this.changed({
      status: "running",
      operation: kind,
      activeRequestId: null,
      candidate: null,
      comparisonArtifactIds: [],
      steps: [],
      explanation: null,
      error: null,
      cancelAcknowledged: false,
      canCompare: false,
    });
    return operation;
  }

  private check(operation: Operation): void {
    if (this.active !== operation) throw new WorkflowStopped("過期的實驗流程結果未被接受。");
    if (operation.cancelRequested) throw new WorkflowStopped("實驗流程已停止後續步驟。");
    const scene = this.options.getScene();
    if (
      scene.sceneId !== operation.scene.sceneId ||
      scene.sceneRevision !== operation.scene.sceneRevision
    )
      throw new AgentError("REVISION_CONFLICT", "場景已變更；保留已完成結果，停止後續實驗步驟。");
  }

  private async step(
    operation: Operation,
    phase: AgentExperimentStep["phase"],
    tool: ToolRequest["tool"],
    args: Record<string, unknown>,
  ): Promise<ExperimentToolResult> {
    this.check(operation);
    const request = this.request(operation, tool, args);
    this.changed({ activeRequestId: request.requestId });
    let result: ExperimentToolResult;
    try {
      result = await this.options.execute(request);
    } finally {
      if (this.active === operation) this.changed({ activeRequestId: null });
    }
    assertBoundedJson(result, 256 * 1024);
    if (
      !result ||
      result.requestId !== request.requestId ||
      result.sceneRevision !== operation.scene.sceneRevision ||
      !Array.isArray(result.artifactIds) ||
      result.artifactIds.some((id) => typeof id !== "string" || id.length === 0)
    )
      throw new AgentError(
        "RESULT_UNKNOWN",
        "Host 回覆缺少對應的請求、revision 或 artifact 身分。",
      );
    this.changed({
      steps: [...this.view.steps, structuredClone({ phase, request, result })].slice(-48),
    });
    if (result.state === "canceled") {
      this.changed({ cancelAcknowledged: true });
      throw new WorkflowStopped("Host 已確認取消；未執行後續步驟。");
    }
    if (result.state !== "succeeded" || result.error || result.artifactIds.length === 0)
      throw new AgentError(
        result.error?.code ?? "RESULT_UNKNOWN",
        result.error?.message ?? "Host 尚未回傳帶 artifact 的明確成功結果。",
      );
    this.check(operation);
    return result;
  }

  private async explain(
    operation: Operation,
    artifactIds: string[],
    runId: string,
  ): Promise<Awaited<ReturnType<typeof explainVerifiedMetrics>>> {
    this.check(operation);
    const artifacts = artifactIds
      .map((id) => this.options.resolveGroundingArtifact(id))
      .filter((artifact): artifact is GroundingArtifact => artifact !== undefined);
    if (artifacts.length === 0)
      throw new AgentError(
        "INSUFFICIENT_DATA",
        "Host 未提供可驗證的分析 artifact，沒有產生數值說明。",
      );
    if (artifacts.some((artifact) => artifact.payload.runId !== runId))
      throw new AgentError("INSUFFICIENT_DATA", "分析 artifact 的 run 與本次實驗不同。");
    const metrics = artifacts.flatMap((artifact) => artifact.payload.metrics);
    const explanation = await explainVerifiedMetrics(
      metrics,
      this.options.resolveGroundingArtifact,
    );
    this.check(operation);
    return explanation;
  }

  private async take(
    operation: Operation,
    replayTraceId: string | null,
  ): Promise<AgentExperimentTake> {
    const run = await this.step(
      operation,
      "run",
      "RunSimulation",
      this.runArguments(operation, replayTraceId),
    );
    if (typeof run.runId !== "string" || !run.runId)
      throw new AgentError("RESULT_UNKNOWN", "成功的模擬結果缺少 run ID。");
    const capture = await this.step(operation, "capture", "CaptureExperiment", {
      runId: run.runId,
      label: replayTraceId ? "工作流程候選實驗" : "工作流程基準實驗",
    });
    const experimentId = capture.artifactIds.find((id) => id.startsWith("experiment."));
    if (!experimentId || capture.runId !== run.runId)
      throw new AgentError("RESULT_UNKNOWN", "擷取結果沒有對應已完成 run 的 experiment ID。");
    const analysis = await this.step(operation, "analyze", "AnalyzeAcousticResults", {
      runId: run.runId,
      metrics: operation.settings.metrics,
      bandCentersHz: operation.settings.bandCentersHz,
    });
    if (analysis.runId !== run.runId)
      throw new AgentError("RESULT_UNKNOWN", "分析結果不是本次完成的 run。");
    return {
      sceneId: operation.scene.sceneId,
      sceneRevision: operation.scene.sceneRevision,
      seed: operation.scene.seed,
      settings: structuredClone(operation.settings),
      runId: run.runId,
      experimentId,
      recordingArtifactIds: [...run.artifactIds],
      analysisArtifactIds: [...analysis.artifactIds],
    };
  }

  private finish(operation: Operation, error: unknown): void {
    if (this.active !== operation) return;
    this.changed({
      status: error instanceof WorkflowStopped ? "stopped" : "failed",
      error: {
        code:
          error instanceof WorkflowStopped
            ? "WORKFLOW_STOPPED"
            : error instanceof AgentError
              ? error.code
              : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "實驗流程未完成。",
      },
    });
  }

  async runBaseline(input: AgentExperimentSettings = {}): Promise<AgentExperimentWorkflowView> {
    const operation = this.begin("baseline", input);
    try {
      const baseline = await this.take(operation, null);
      const explanation = await this.explain(
        operation,
        baseline.analysisArtifactIds,
        baseline.runId,
      );
      this.changed({ baseline, explanation, status: "completed" });
    } catch (error) {
      this.finish(operation, error);
    } finally {
      if (this.active === operation) {
        this.active = null;
        this.changed({ activeRequestId: null, canCompare: this.view.baseline !== null });
      }
    }
    return this.getView();
  }

  async compareCandidate(): Promise<AgentExperimentWorkflowView> {
    const baseline = this.view.baseline;
    if (!baseline) throw new AgentError("INSUFFICIENT_DATA", "請先完成一個基準實驗。");
    const scene = this.options.getScene();
    if (scene.sceneId !== baseline.sceneId || scene.seed !== baseline.seed)
      throw new AgentError("INCOMPATIBLE_EXPERIMENTS", "候選必須保留基準的 Scene ID 與 seed。");
    const operation = this.begin("candidate", baseline.settings);
    try {
      const candidate = await this.take(operation, baseline.runId);
      const comparison = await this.step(operation, "compare", "CompareExperiments", {
        baselineExperimentId: baseline.experimentId,
        candidateExperimentId: candidate.experimentId,
        metrics: operation.settings.metrics,
        requireMatchedMotionTrace: true,
      });
      const explanation = await this.explain(operation, comparison.artifactIds, candidate.runId);
      this.changed({
        candidate,
        comparisonArtifactIds: [...comparison.artifactIds],
        explanation,
        status: "completed",
      });
    } catch (error) {
      this.finish(operation, error);
    } finally {
      if (this.active === operation) {
        this.active = null;
        this.changed({ activeRequestId: null, canCompare: this.view.baseline !== null });
      }
    }
    return this.getView();
  }

  cancel(): boolean {
    const operation = this.active;
    if (!operation || operation.cancelRequested) return false;
    operation.cancelRequested = true;
    this.changed({ status: "cancelRequested" });
    if (this.view.activeRequestId) this.options.cancelTool?.(this.view.activeRequestId);
    return true;
  }
}
