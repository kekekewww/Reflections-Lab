import { AgentHost } from "../ai/host.js";
import { createSceneToolAdapter } from "../ai/scene-adapter.js";
import { OfflinePlanner } from "../ai/offline-planner.js";
import { OfflineSoundPlanner } from "../ai/offline-sound-planner.js";
import { SoundProposalHost } from "../ai/sound-host.js";
import { requestAgentPlan, requestSoundAgentPlan } from "../ai/client.js";
import { AgentError, MUTATION_TOOLS } from "../ai/types.js";
import { assertBoundedJson } from "../ai/validation.js";
import type { AgentMaterial } from "../ai/scene-adapter.js";
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
  const createObject =
    /建立|新增|加入|create|add/i.test(prompt) &&
    /球|物件|方塊|牆|object|sphere|ball|box|wall/i.test(prompt);
  return sound && !createObject;
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
  canApply: boolean;
  toolResults?: AgentToolResult[];
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
  /** Trusted host clock; used to enforce the fixed 120-second planning session. */
  now?(): number;
  onChange?(): void;
}
/** UI bridge. All plans still pass through the actual Scene/Sound trusted hosts. */
export class AgentSession {
  private readonly options: AgentSessionOptions;
  private readonly sceneHost: AgentHost;
  private readonly soundHost: SoundProposalHost;
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
  private async acceptScenePlan(plan: AgentPlan, mode: "offline" | "live"): Promise<void> {
    assertBoundedJson(plan, 256 * 1024);
    assertProvenance(plan.provenance, mode);
    if (!plan.requests.length) {
      this.update({
        mode: plan.provenance.provider === "metaModelApi" ? "live" : "offline",
        status: "idle",
        message: [plan.summary, ...plan.warnings].join("\n"),
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
    this.reserveTools(mutations.length);
    const preview = await this.sceneHost.stage(mutations, plan.provenance);
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
      canApply: true,
    });
  }
  private async acceptSoundPlan(plan: SoundAgentPlan, mode: "offline" | "live"): Promise<void> {
    assertBoundedJson(plan, 256 * 1024);
    assertProvenance(plan.provenance, mode);
    this.reserveTools(plan.proposal.operations.length);
    // Server context is a snapshot; only this host can validate against current editor state.
    const preview = await this.soundHost.stage(plan.proposal, plan.provenance);
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
    this.update({
      mode: "unavailable",
      status: "loading",
      message: "檢查本機Meta provider gate。",
      canApply: false,
    });
    try {
      this.reservePlanningTurn();
      if (sound) {
        const registry = this.options.getRegistries();
        const plan = await requestSoundAgentPlan(prompt, this.options.getBehaviorState(), {
          ...(registry.selectedObjectId ? { selectedObjectId: registry.selectedObjectId } : {}),
          ...(registry.assetLabels ? { assetLabels: registry.assetLabels } : {}),
        });
        await this.acceptSoundPlan(plan, "live");
      } else
        await this.acceptScenePlan(await requestAgentPlan(prompt, this.context(), "meta"), "live");
    } catch (error) {
      this.error(error);
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
    return structuredClone(this.view);
  }
  getToolResults(): AgentToolResult[] {
    return structuredClone(this.toolResults);
  }
  getAudit(): { scene: AgentAuditEntry[]; sound: SoundAuditEntry[] } {
    return { scene: this.sceneHost.getAudit(), sound: this.soundHost.getAudit() };
  }
}
