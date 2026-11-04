import { AgentHost } from "../ai/host.js";
import { createSceneToolAdapter } from "../ai/scene-adapter.js";
import { OfflinePlanner } from "../ai/offline-planner.js";
import { OfflineSoundPlanner } from "../ai/offline-sound-planner.js";
import { SoundProposalHost } from "../ai/sound-host.js";
import {
  cancelAgentRequest,
  requestAgentPlan,
  requestSoundAgentPlan,
  BROWSER_AGENT_BUILD,
} from "../ai/client.js";
import { TrustedExperimentWorkflow } from "./agent-experiment-workflow.js";
import type {
  AgentExperimentSettings,
  AgentExperimentWorkflowView,
} from "./agent-experiment-workflow.js";
import type { GroundingArtifact } from "../ai/grounding.js";
import { AgentError, MUTATION_TOOLS } from "../ai/types.js";
import { assertBoundedJson } from "../ai/validation.js";
import type { AgentMaterial, MotionTransactionHooks } from "../ai/scene-adapter.js";
import type {
  AgentAuditEntry,
  AgentPlan,
  PlannerProvenance,
  RegistryEntry,
  ToolRequest,
} from "../ai/types.js";
import type { SoundAuditEntry, SoundHostState } from "../ai/sound-host.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import type { SceneSpec } from "../scene/types.js";
import type { SoundAgentPlan } from "../ai/sound-plan.js";

function soundIntent(prompt: string): boolean {
  const sound =
    /聲音行為|sound.?behavior|碰撞|撞擊|抓取|抓起|投擲|滾動|滑動|飛行|音效|發聲|鋼琴|電子音|oscillator|synth|impact|throw|grab|rolling|audio|profile/i.test(
      prompt,
    );
  // Sound words also name things in a scene, so a request to build or edit one stays a scene request.
  const editScene =
    /建立|新增|加入|移動|移除|刪除|搭建|擺放|create|add|build|arrange|furnish|move|remove|delete|resize/i.test(
      prompt,
    ) &&
    /球|物件|方塊|牆|房間|舞台|椅|桌|鋼琴|喇叭|聽者|object|sphere|ball|box|wall|room|stage|chair|table|speaker|listener|piano/i.test(
      prompt,
    );
  return sound && !editScene;
}

function assertProvenance(provenance: PlannerProvenance, mode: "offline" | "live"): void {
  const nonempty = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;
  const verified =
    mode === "offline"
      ? provenance?.provider === "offlineDeterministic" &&
        provenance.label === "OFFLINE_DETERMINISTIC" &&
        provenance.modelId === null &&
        provenance.requestId === null
      : provenance?.provider === "metaModelApi" &&
        provenance.label === "META_LIVE" &&
        nonempty(provenance.modelId) &&
        nonempty(provenance.requestId);
  if (!verified)
    throw new AgentError(
      "PROVIDER_UNVERIFIED",
      "Planner來源與請求模式不符，或缺少實際模型／response ID；尚無可驗證的Meta live結果。",
    );
}

export interface AgentSessionView {
  mode: "offline" | "live" | "unavailable";
  status: "idle" | "loading" | "preview" | "error";
  message: string;
  preview?: string;
  /** Muse's own words. Untrusted text: display only. */
  note?: string;
  canApply: boolean;
  toolResults?: AgentToolResult[];
  workflow?: AgentExperimentWorkflowView;
}
export interface AgentToolResult {
  requestId: string;
  tool: ToolRequest["tool"];
  status: "completed" | "pending" | "blocked" | "failed" | "unknown";
  code: string | null;
  reason: string | null;
  result: unknown;
  provenance: PlannerProvenance;
}

/** A host result is data: only explicit terminal success can be displayed as complete. */
function describeToolResult(
  request: ToolRequest,
  result: unknown,
  provenance: PlannerProvenance,
): AgentToolResult {
  assertBoundedJson(result);
  const record =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : {};
  const error =
    record.error && typeof record.error === "object" && !Array.isArray(record.error)
      ? (record.error as Record<string, unknown>)
      : {};
  const states = [record.status, record.state].filter(
    (value): value is string => typeof value === "string",
  );
  const stateCode = states.find((value) => /^[A-Z][A-Z_]+$/.test(value));
  const code =
    typeof error.code === "string"
      ? error.code
      : typeof record.code === "string"
        ? record.code
        : (stateCode ?? null);
  const reason =
    [record.reason, error.message, record.message].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    ) ?? null;
  let status: AgentToolResult["status"] = "unknown";
  if (states.includes("blocked") || code === "CAPABILITY_UNSUPPORTED") status = "blocked";
  else if (
    code ||
    record.error ||
    states.some((state) => ["failed", "canceled", "timedOut", "budgetExceeded"].includes(state))
  )
    status = "failed";
  else if (states.some((state) => ["queued", "running", "cancelRequested"].includes(state)))
    status = "pending";
  else if (states.length > 0 && states.every((state) => ["completed", "succeeded"].includes(state)))
    status = "completed";
  return {
    requestId: request.requestId,
    tool: request.tool,
    status,
    code: code ?? (status === "unknown" ? "RESULT_UNKNOWN" : null),
    reason,
    result: structuredClone(result),
    provenance: structuredClone(provenance),
  };
}

function resultMessage(entry: AgentToolResult): string {
  const label = {
    completed: "已完成（Host回傳）",
    pending: "尚未完成",
    blocked: "無法執行",
    failed: "執行失敗",
    unknown: "尚未確認結果",
  }[entry.status];
  return [
    `${entry.tool}：${label}${entry.code ? `；${entry.code}` : ""}`,
    entry.reason,
    entry.result === null ? null : JSON.stringify(entry.result),
  ]
    .filter((value) => value !== null)
    .join("\n");
}
export interface AgentSessionOptions {
  motionTransaction?: MotionTransactionHooks;
  getScene(): SceneSpec;
  getBehaviorState(): SoundHostState;
  commitScene(
    next: SceneSpec,
    expectedRevision: number,
    transactionId: string,
    requests: ToolRequest[],
  ): SceneSpec | Promise<SceneSpec>;
  commitBehavior(
    document: SoundBehaviorDocument,
    expectedDocumentRevision: number,
    expectedSceneRevision: number,
    transactionId: string,
  ): SoundBehaviorDocument | Promise<SoundBehaviorDocument>;
  getRegistries(): {
    materials: AgentMaterial[];
    signals: RegistryEntry[];
    materialRegistryRevision: number;
    selectedObjectId?: string;
    assetLabels?: Record<string, string>;
  };
  runTool?(request: ToolRequest): Promise<unknown>;
  resolveGroundingArtifact?(artifactId: string): GroundingArtifact | undefined;
  cancelTool?(requestId?: string): boolean;
  /** Trusted host clock; used to enforce the fixed 120-second planning session. */
  now?(): number;
  onChange?(): void;
}
/** UI bridge. All plans still pass through the actual Scene/Sound trusted hosts. */
export class AgentSession {
  private readonly options: AgentSessionOptions;
  private readonly sceneHost: AgentHost;
  private readonly soundHost: SoundProposalHost;
  private readonly workflow: TrustedExperimentWorkflow | null;
  private workflowActive = false;
  private planningGeneration = 0;
  private activePlanner: { requestId: string; controller: AbortController } | null = null;
  private readonly planner = new OfflinePlanner();
  private readonly soundPlanner = new OfflineSoundPlanner();
  private readonly toolResults: AgentToolResult[] = [];
  private startedAt: number | null = null;
  private planningTurns = 0;
  private callsUsed = 0;
  private simulationsUsed = 0;
  private view: AgentSessionView = {
    mode: "offline",
    status: "idle",
    message: "離線指令示範可用；未使用Meta模型或額度。",
    canApply: false,
  };
  private pending: { kind: "scene" | "sound"; previewId: string; digest: string } | null = null;
  private lastApplied: { kind: "scene" | "sound"; previewId: string } | null = null;
  constructor(options: AgentSessionOptions) {
    this.options = options;
    const adapter = createSceneToolAdapter({
      getScene: options.getScene,
      commitScene: options.commitScene,
      ...(options.motionTransaction ? { motionTransaction: options.motionTransaction } : {}),
      get materials() {
        return options.getRegistries().materials;
      },
      get signals() {
        return options.getRegistries().signals;
      },
      get materialRegistryRevision() {
        return options.getRegistries().materialRegistryRevision;
      },
      ...(options.runTool ? { runTool: options.runTool } : {}),
    });
    this.sceneHost = new AgentHost(adapter);
    this.soundHost = new SoundProposalHost({
      getState: options.getBehaviorState,
      commit: options.commitBehavior,
    });
    this.workflow = options.resolveGroundingArtifact
      ? new TrustedExperimentWorkflow({
          getScene: options.getScene,
          execute: async (request) => {
            this.reserveTools(1, request.tool === "RunSimulation" ? 1 : 0);
            return (await this.sceneHost.executeRead(request, {
              provider: "offlineDeterministic",
              modelId: null,
              requestId: null,
              label: "OFFLINE_DETERMINISTIC",
            })) as import("./experiment-tools.js").ExperimentToolResult;
          },
          resolveGroundingArtifact: options.resolveGroundingArtifact,
          ...(options.cancelTool ? { cancelTool: options.cancelTool } : {}),
          onChange: () => options.onChange?.(),
        })
      : null;
  }
  private update(view: AgentSessionView): void {
    this.view = view;
    this.options.onChange?.();
  }
  private error(error: unknown): void {
    this.pending = null;
    this.update({
      mode: this.view.mode,
      status: "error",
      message:
        error instanceof AgentError || error instanceof Error
          ? `${"code" in error ? String(error.code) + "：" : ""}${error.message}`
          : "操作失敗，場景未被確認為成功。",
      canApply: false,
    });
  }
  private context() {
    const registry = this.options.getRegistries();
    return {
      scene: this.options.getScene(),
      materials: registry.materials,
      signals: registry.signals,
      materialRegistryRevision: registry.materialRegistryRevision,
      ...(registry.selectedObjectId ? { selectedObjectId: registry.selectedObjectId } : {}),
    };
  }
  private reservePlanningTurn(): void {
    const now = this.options.now?.() ?? Date.now();
    this.startedAt ??= now;
    if (this.planningTurns >= 12 || now - this.startedAt >= 120000)
      throw new AgentError(
        "BUDGET_EXCEEDED",
        "本次Agent session已達12回合或120秒上限，請建立新session。",
      );
    this.planningTurns++;
  }
  private reserveTools(calls: number, simulations = 0): void {
    if (this.callsUsed + calls > 48 || this.simulationsUsed + simulations > 6)
      throw new AgentError("BUDGET_EXCEEDED", "本次Agent session已達48工具或6次模擬上限。");
    this.callsUsed += calls;
    this.simulationsUsed += simulations;
  }
  private async acceptScenePlan(
    plan: AgentPlan,
    mode: "offline" | "live",
    generation?: number,
  ): Promise<void> {
    if (generation !== undefined && generation !== this.planningGeneration) return;
    assertBoundedJson(plan, 256 * 1024);
    assertProvenance(plan.provenance, mode);
    if (!plan.requests.length) {
      this.update({
        mode: plan.provenance.provider === "metaModelApi" ? "live" : "offline",
        status: "idle",
        message: [plan.summary, ...plan.warnings].join("\n"),
        ...(plan.note ? { note: plan.note } : {}),
        canApply: false,
      });
      return;
    }
    const mutations = plan.requests.filter((request) =>
      (MUTATION_TOOLS as readonly string[]).includes(request.tool),
    );
    if (mutations.length && mutations.length !== plan.requests.length)
      throw new AgentError("POLICY_DENIED", "不能在同一提案混合場景變更與實驗執行。");
    if (!mutations.length) {
      const results: AgentToolResult[] = [];
      for (const request of plan.requests) {
        if (generation !== undefined && generation !== this.planningGeneration) break;
        let entry: AgentToolResult;
        try {
          this.reserveTools(1, request.tool === "RunSimulation" ? 1 : 0);
          entry = describeToolResult(
            request,
            await this.sceneHost.executeRead(request, plan.provenance),
            plan.provenance,
          );
        } catch (error) {
          entry = {
            requestId: request.requestId,
            tool: request.tool,
            status: "failed",
            code:
              error && typeof error === "object" && "code" in error
                ? String(error.code)
                : "INTERNAL_ERROR",
            reason: error instanceof Error ? error.message : "Host未回傳可確認的工具結果。",
            result: null,
            provenance: structuredClone(plan.provenance),
          };
        }
        results.push(entry);
        this.toolResults.push(structuredClone(entry));
        if (this.toolResults.length > 48) this.toolResults.shift();
        // A later dependent operation must not run after an unknown, failed or pending result.
        if (entry.status !== "completed") break;
      }
      if (generation !== undefined && generation !== this.planningGeneration) return;
      this.update({
        mode: plan.provenance.provider === "metaModelApi" ? "live" : "offline",
        status: results.some((entry) => ["blocked", "failed", "unknown"].includes(entry.status))
          ? "error"
          : "idle",
        message: [plan.provenance.label, ...results.map(resultMessage), ...plan.warnings].join(
          "\n",
        ),
        toolResults: results,
        canApply: false,
      });
      return;
    }
    // A person sends each live request and approves each result, and the server ledger caps
    // spending. The session allowance still bounds the offline planner and experiment tools.
    if (mode === "offline") this.reserveTools(mutations.length);
    const preview = await this.sceneHost.stage(mutations, plan.provenance);
    if (generation !== undefined && generation !== this.planningGeneration) {
      this.sceneHost.cancel(preview.previewId);
      return;
    }
    this.pending = { kind: "scene", previewId: preview.previewId, digest: preview.digest };
    this.update({
      mode: plan.provenance.provider === "metaModelApi" ? "live" : "offline",
      status: "preview",
      message: plan.summary,
      preview: [
        ...plan.assumptions,
        ...preview.changes,
        ...plan.warnings,
        ...preview.warnings,
      ].join("\n"),
      ...(plan.note ? { note: plan.note } : {}),
      canApply: true,
    });
  }
  private async acceptSoundPlan(
    plan: SoundAgentPlan,
    mode: "offline" | "live",
    generation?: number,
  ): Promise<void> {
    if (generation !== undefined && generation !== this.planningGeneration) return;
    assertBoundedJson(plan, 256 * 1024);
    assertProvenance(plan.provenance, mode);
    if (mode === "offline") this.reserveTools(plan.proposal.operations.length);
    // Server context is a snapshot; only this host can validate against current editor state.
    const preview = await this.soundHost.stage(plan.proposal, plan.provenance);
    if (generation !== undefined && generation !== this.planningGeneration) {
      this.soundHost.cancel(preview.previewId);
      return;
    }
    this.pending = { kind: "sound", previewId: preview.previewId, digest: preview.digest };
    this.update({
      mode,
      status: "preview",
      message: plan.summary,
      preview: [
        ...plan.assumptions,
        ...preview.changes,
        ...plan.warnings,
        ...preview.derivedAssetPins.map(
          (pin) => `可信資產：${pin.assetId}@${pin.revision} ${pin.sha256}`,
        ),
      ].join("\n"),
      canApply: true,
    });
  }
  async submit(prompt: string): Promise<void> {
    if (this.view.status === "loading") return;
    this.cancelPending();
    this.update({
      mode: "offline",
      status: "loading",
      message: "本機解析與驗證提案中；沒有模型呼叫。",
      canApply: false,
    });
    try {
      this.reservePlanningTurn();
      if (soundIntent(prompt)) {
        const registry = this.options.getRegistries();
        const plan = this.soundPlanner.plan(prompt, this.options.getBehaviorState(), {
          ...(registry.selectedObjectId ? { selectedObjectId: registry.selectedObjectId } : {}),
          ...(registry.assetLabels ? { assetLabels: registry.assetLabels } : {}),
        });
        await this.acceptSoundPlan(plan, "offline");
      } else await this.acceptScenePlan(this.planner.plan(prompt, this.context()), "offline");
    } catch (error) {
      this.error(error);
    }
  }
  /** Explicit only; server keeps independent credentials, verification and zero-cost gates. */
  async submitLive(prompt: string): Promise<void> {
    await this.submitLivePlan(prompt, soundIntent(prompt));
  }
  async submitLiveSound(prompt: string): Promise<void> {
    await this.submitLivePlan(prompt, true);
  }
  private async submitLivePlan(prompt: string, sound: boolean): Promise<void> {
    if (this.view.status === "loading") return;
    this.cancelPending();
    const generation = ++this.planningGeneration;
    const requestId = `request.${globalThis.crypto.randomUUID()}`;
    const controller = new AbortController();
    this.activePlanner = { requestId, controller };
    this.update({
      mode: "unavailable",
      status: "loading",
      message: "Muse正在規劃提案，通常需要10–60秒；場景尚未變更。",
      canApply: false,
    });
    try {
      if (sound) {
        const registry = this.options.getRegistries();
        const plan = await requestSoundAgentPlan(
          prompt,
          this.options.getBehaviorState(),
          {
            ...(registry.selectedObjectId ? { selectedObjectId: registry.selectedObjectId } : {}),
            ...(registry.assetLabels ? { assetLabels: registry.assetLabels } : {}),
          },
          controller.signal,
          requestId,
        );
        if (generation !== this.planningGeneration || controller.signal.aborted) return;
        await this.acceptSoundPlan(plan, "live", generation);
      } else {
        const plan = await requestAgentPlan(
          prompt,
          this.context(),
          "meta",
          controller.signal,
          requestId,
        );
        if (generation !== this.planningGeneration || controller.signal.aborted) return;
        await this.acceptScenePlan(plan, "live", generation);
      }
    } catch (error) {
      if (generation === this.planningGeneration) this.error(error);
    } finally {
      if (this.activePlanner?.requestId === requestId) this.activePlanner = null;
    }
  }
  async apply(): Promise<void> {
    const pending = this.pending;
    if (!pending || !this.view.canApply || this.view.status === "loading") return;
    this.update({ ...this.view, status: "loading", canApply: false });
    try {
      if (pending.kind === "scene") await this.sceneHost.apply(pending.previewId, pending.digest);
      else await this.soundHost.apply(pending.previewId, pending.digest);
      this.lastApplied = { kind: pending.kind, previewId: pending.previewId };
      this.pending = null;
      this.update({
        mode: this.view.mode,
        status: "idle",
        message: "提案已由Host套用並建立新revision；可使用復原。",
        canApply: false,
      });
    } catch (error) {
      this.error(error);
    }
  }
  private cancelPending(): void {
    if (!this.pending) return;
    if (this.pending.kind === "scene") this.sceneHost.cancel(this.pending.previewId);
    else this.soundHost.cancel(this.pending.previewId);
    this.pending = null;
  }
  cancel(): void {
    if (this.workflowActive && this.workflow) {
      this.workflow.cancel();
      this.update({ ...this.view, message: "已請求停止實驗流程，等待Host確認目前工具結果。" });
      return;
    }
    if (this.activePlanner) {
      const { requestId, controller } = this.activePlanner;
      this.planningGeneration++;
      this.activePlanner = null;
      controller.abort();
      void cancelAgentRequest(requestId).catch(() => {
        // Local acceptance is canceled even if transport cancellation cannot be acknowledged.
      });
      this.update({
        mode: this.view.mode,
        status: "idle",
        canApply: false,
        message: BROWSER_AGENT_BUILD
          ? "已停止接受此提案；已送出的請求仍可能由Meta計費。"
          : "已停止接受此提案；已送出的請求結果與費用由伺服器紀錄，不推定取消或退款。",
      });
      return;
    }
    if (this.view.status === "loading") return;
    try {
      this.cancelPending();
      this.update({
        mode: this.view.mode,
        status: "idle",
        message: "提案已取消，沒有套用變更。",
        canApply: false,
      });
    } catch (error) {
      this.error(error);
    }
  }
  async undo(): Promise<void> {
    const applied = this.lastApplied;
    if (!applied || this.view.status === "loading") return;
    this.update({ ...this.view, status: "loading", canApply: false });
    try {
      if (applied.kind === "scene") await this.sceneHost.undo(applied.previewId);
      else await this.soundHost.undo(applied.previewId);
      this.lastApplied = null;
      this.update({
        mode: this.view.mode,
        status: "idle",
        message: "已復原提案並建立新revision；已播放的聲音不會倒轉。",
        canApply: false,
      });
    } catch (error) {
      this.error(error);
    }
  }
  getView(): AgentSessionView {
    return structuredClone({
      ...this.view,
      ...(this.workflow ? { workflow: this.workflow.getView() } : {}),
    });
  }
  canUndo(): boolean {
    return this.lastApplied !== null && this.view.status !== "loading";
  }
  getWorkflowView(): AgentExperimentWorkflowView | null {
    return this.workflow?.getView() ?? null;
  }
  /** Explicit host workflow; this never calls a model or auto-applies a proposed mutation. */
  async runExperiment(settings: Partial<AgentExperimentSettings> = {}): Promise<void> {
    await this.performWorkflow(() => this.workflow!.runBaseline(settings));
  }
  async compareExperiment(): Promise<void> {
    await this.performWorkflow(() => this.workflow!.compareCandidate());
  }
  private async performWorkflow(
    operation: () => Promise<AgentExperimentWorkflowView>,
  ): Promise<void> {
    if (this.view.status === "loading") return;
    if (!this.workflow) {
      this.error(new AgentError("CAPABILITY_UNSUPPORTED", "實驗流程需要可信artifact resolver。"));
      return;
    }
    this.cancelPending();
    this.workflowActive = true;
    this.update({
      mode: "offline",
      status: "loading",
      canApply: false,
      message: "執行本機實驗流程；模型不產生量測數值。",
    });
    try {
      const result = await operation();
      const seen = new Set(this.toolResults.map((entry) => entry.requestId));
      for (const step of result.steps) {
        if (!step.result || seen.has(step.request.requestId)) continue;
        this.toolResults.push(
          describeToolResult(step.request, step.result, {
            provider: "offlineDeterministic",
            modelId: null,
            requestId: null,
            label: "OFFLINE_DETERMINISTIC",
          }),
        );
      }
      while (this.toolResults.length > 48) this.toolResults.shift();
      this.update({
        mode: "offline",
        status: result.status === "failed" ? "error" : "idle",
        canApply: false,
        toolResults: this.getToolResults(),
        message: result.explanation?.text ?? `實驗流程：${result.status}；結果與來源已保留。`,
      });
    } catch (error) {
      this.error(error);
    } finally {
      this.workflowActive = false;
    }
  }
  getToolResults(): AgentToolResult[] {
    return structuredClone(this.toolResults);
  }
  getAudit(): { scene: AgentAuditEntry[]; sound: SoundAuditEntry[] } {
    return { scene: this.sceneHost.getAudit(), sound: this.soundHost.getAudit() };
  }
}
