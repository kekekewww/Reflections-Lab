import { AgentError, MUTATION_TOOLS } from "./types.js";
import type {
  AgentAdapter,
  AgentAuditEntry,
  AgentHostOptions,
  AgentPreview,
  PlannerProvenance,
  ToolRequest,
} from "./types.js";
import type { SceneSpec } from "../scene/types.js";
import { assertBoundedJson, canonicalJson, digestJson, validateToolRequest } from "./validation.js";

interface PreviewRecord {
  preview: AgentPreview;
  before: SceneSpec;
}
export class AgentHost {
  private readonly adapter: AgentAdapter;
  private readonly now: () => number;
  private readonly ttl: number;
  private readonly maxCalls: number;
  private readonly maxSimulations: number;
  private readonly maxAudit: number;
  private readonly previews = new Map<string, PreviewRecord>();
  private readonly requests = new Map<
    string,
    { payload: string; previewId: string | null; result?: unknown; pending?: boolean }
  >();
  private readonly audit: AgentAuditEntry[] = [];
  private sequence = 0;
  private calls = 0;
  private simulations = 0;
  private busy = false;
  constructor(adapter: AgentAdapter, options: AgentHostOptions = {}) {
    this.adapter = adapter;
    this.now = options.now ?? Date.now;
    this.ttl = options.previewTtlMs ?? 300000;
    this.maxCalls = options.maxToolCalls ?? 48;
    this.maxSimulations = options.maxSimulations ?? 6;
    this.maxAudit = options.maxAuditEntries ?? 256;
    const bounds: [number, number][] = [
      [this.ttl, 300000],
      [this.maxCalls, 48],
      [this.maxAudit, 1024],
    ];
    for (const [value, max] of bounds)
      if (!Number.isSafeInteger(value) || value < 1 || value > max)
        throw new AgentError("POLICY_DENIED", "Host預算不合法。");
    if (
      !Number.isSafeInteger(this.maxSimulations) ||
      this.maxSimulations < 0 ||
      this.maxSimulations > 6
    )
      throw new AgentError("POLICY_DENIED", "模擬預算不合法。");
  }
  private record(
    action: AgentAuditEntry["action"],
    previewId: string | null,
    requestIds: string[],
    provenance: PlannerProvenance | null,
    code: string | null = null,
  ): void {
    this.audit.push({
      sequence: ++this.sequence,
      timestamp: this.now(),
      action,
      previewId,
      requestIds,
      revision: this.adapter.getScene().sceneRevision,
      code,
      provenance: provenance ? structuredClone(provenance) : null,
    });
    if (this.audit.length > this.maxAudit) this.audit.shift();
  }
  private assertContext(request: ToolRequest): void {
    const scene = this.adapter.getScene();
    if (request.sceneId !== scene.sceneId) throw new AgentError("UNKNOWN_ID", "請求未授權的場景。");
    if (request.expectedSceneRevision !== scene.sceneRevision)
      throw new AgentError("REVISION_CONFLICT", "場景已變動，請重新預覽。");
  }
  async stage(input: unknown[], provenance: PlannerProvenance): Promise<AgentPreview> {
    if (this.busy) throw new AgentError("TRANSACTION_BUSY", "另一個交易正在處理。");
    if (!Array.isArray(input) || input.length < 1 || input.length > 32)
      throw new AgentError("POLICY_DENIED", "每次只接受1–32個變更。");
    const requests = input.map(validateToolRequest);
    if (new Set(requests.map((request) => request.requestId)).size !== requests.length)
      throw new AgentError("DOMAIN_INVALID", "requestId不得重複。");
    const previous = requests.map((request) => this.requests.get(request.requestId));
    for (let index = 0; index < requests.length; index++) {
      const existing = previous[index];
      if (existing && existing.payload !== canonicalJson(requests[index]))
        throw new AgentError("DOMAIN_INVALID", "相同requestId具有不同內容。");
    }
    if (previous.every((item) => item?.previewId && item.previewId === previous[0]?.previewId)) {
      const record = this.previews.get(previous[0]!.previewId!);
      if (record) return structuredClone(record.preview);
    }
    if (previous.some(Boolean))
      throw new AgentError("DOMAIN_INVALID", "不能將已處理request混入新交易。");
    for (const request of requests) {
      this.assertContext(request);
      if (!(MUTATION_TOOLS as readonly string[]).includes(request.tool))
        throw new AgentError("POLICY_DENIED", "此工具不是staging mutation。");
    }
    if (new Set(requests.map((request) => request.transactionId)).size !== 1)
      throw new AgentError("DOMAIN_INVALID", "整包交易必須共用transactionId。");
    if (this.calls + requests.length > this.maxCalls || this.previews.size >= 48)
      throw new AgentError("BUDGET_EXCEEDED", "工具／交易數量已達上限。");
    this.busy = true;
    this.calls += requests.length;
    try {
      const before = structuredClone(this.adapter.getScene());
      const result = await this.adapter.preview(requests);
      if (canonicalJson(this.adapter.getScene()) !== canonicalJson(before))
        throw new AgentError("REVISION_CONFLICT", "預覽期間場景已變動。");
      const previewId = `agent.preview-${this.sequence + 1}`;
      const digest = await digestJson({
        requests,
        baseRevision: before.sceneRevision,
        before,
        candidate: result.candidate,
        changes: result.changes,
        warnings: result.warnings,
      });
      const preview: AgentPreview = {
        previewId,
        digest,
        baseRevision: before.sceneRevision,
        sceneId: before.sceneId,
        requests: structuredClone(requests),
        candidate: structuredClone(result.candidate),
        changes: [...result.changes],
        warnings: [...result.warnings],
        expiresAt: this.now() + this.ttl,
        state: "awaitingApproval",
        resultRevision: null,
        provenance: structuredClone(provenance),
      };
      this.previews.set(previewId, { preview, before });
      for (const request of requests)
        this.requests.set(request.requestId, { payload: canonicalJson(request), previewId });
      this.record(
        "stage",
        previewId,
        requests.map((request) => request.requestId),
        provenance,
      );
      return structuredClone(preview);
    } catch (error) {
      this.record(
        "reject",
        null,
        requests.map((request) => request.requestId),
        provenance,
        error instanceof AgentError ? error.code : "DOMAIN_INVALID",
      );
      throw error;
    } finally {
      this.busy = false;
    }
  }
  async apply(previewId: string, approvedDigest: string): Promise<SceneSpec> {
    if (this.busy) throw new AgentError("TRANSACTION_BUSY", "另一個交易正在處理。");
    const record = this.previews.get(previewId);
    if (!record) throw new AgentError("PREVIEW_REQUIRED", "找不到有效預覽。");
    const preview = record.preview;
    if (preview.state === "applied") {
      if (approvedDigest !== preview.digest)
        throw new AgentError("APPROVAL_REQUIRED", "核准內容不符預覽。");
      return structuredClone(preview.candidate);
    }
    if (preview.state !== "awaitingApproval")
      throw new AgentError("PREVIEW_REQUIRED", "預覽已取消或回復。");
    if (approvedDigest !== preview.digest)
      throw new AgentError("APPROVAL_REQUIRED", "核准內容不符預覽。");
    if (this.now() >= preview.expiresAt)
      throw new AgentError("PREVIEW_REQUIRED", "預覽已過期，請重新提出。");
    if (this.adapter.getScene().sceneRevision !== preview.baseRevision)
      throw new AgentError("REVISION_CONFLICT", "場景已變動，請重新預覽。");
    this.busy = true;
    try {
      const result = await this.adapter.commit(
        structuredClone(preview.candidate),
        preview.baseRevision,
        previewId,
        structuredClone(preview.requests),
      );
      if (result.sceneRevision !== preview.baseRevision + 1 || result.sceneId !== preview.sceneId)
        throw new AgentError("INTERNAL_ERROR", "Host commit未產生正確revision。");
      preview.candidate = structuredClone(result);
      preview.resultRevision = result.sceneRevision;
      preview.state = "applied";
      this.record(
        "apply",
        previewId,
        preview.requests.map((request) => request.requestId),
        preview.provenance,
      );
      return structuredClone(result);
    } finally {
      this.busy = false;
    }
  }
  async undo(previewId: string): Promise<SceneSpec> {
    if (this.busy) throw new AgentError("TRANSACTION_BUSY", "另一個交易正在處理。");
    const record = this.previews.get(previewId);
    if (!record || record.preview.state !== "applied")
      throw new AgentError("PREVIEW_REQUIRED", "交易尚未套用或已回復。");
    if (this.adapter.getScene().sceneRevision !== record.preview.resultRevision)
      throw new AgentError("REVISION_CONFLICT", "後續已有編輯，不能覆蓋。");
    this.busy = true;
    try {
      const scene = await this.adapter.restore(
        structuredClone(record.before),
        record.preview.resultRevision!,
        previewId + ".undo",
      );
      if (scene.sceneRevision !== record.preview.resultRevision! + 1)
        throw new AgentError("INTERNAL_ERROR", "Undo未產生新revision。");
      record.preview.state = "reverted";
      this.record(
        "undo",
        previewId,
        record.preview.requests.map((request) => request.requestId),
        record.preview.provenance,
      );
      return structuredClone(scene);
    } finally {
      this.busy = false;
    }
  }
  cancel(previewId: string): void {
    if (this.busy)
      throw new AgentError("TRANSACTION_BUSY", "操作已派送，等待Host確認後才可取消預覽。");
    const record = this.previews.get(previewId);
    if (!record || record.preview.state !== "awaitingApproval")
      throw new AgentError("PREVIEW_REQUIRED", "沒有可取消的預覽。");
    record.preview.state = "canceled";
    this.record(
      "cancel",
      previewId,
      record.preview.requests.map((request) => request.requestId),
      record.preview.provenance,
    );
  }
  async executeRead(input: unknown, provenance: PlannerProvenance | null = null): Promise<unknown> {
    if (this.busy) throw new AgentError("TRANSACTION_BUSY", "另一個操作正在處理。");
    const request = validateToolRequest(input);
    if ((MUTATION_TOOLS as readonly string[]).includes(request.tool))
      throw new AgentError("PREVIEW_REQUIRED", "變更必須先經staging與預覽。");
    const existing = this.requests.get(request.requestId);
    if (existing) {
      if (existing.payload !== canonicalJson(request))
        throw new AgentError("DOMAIN_INVALID", "相同requestId具有不同內容。");
      if (existing.pending)
        throw new AgentError(
          "RESULT_UNKNOWN",
          "先前工具結果尚未確認，禁止重複執行；請查詢原run紀錄。",
        );
      return structuredClone(existing.result);
    }
    this.assertContext(request);
    if (!this.adapter.runTool)
      throw new AgentError("CAPABILITY_UNSUPPORTED", "Host未提供此實驗工具。");
    if (
      this.calls >= this.maxCalls ||
      (request.tool === "RunSimulation" && this.simulations >= this.maxSimulations)
    )
      throw new AgentError("BUDGET_EXCEEDED", "工具／模擬預算已達上限。");
    this.busy = true;
    this.calls++;
    if (request.tool === "RunSimulation") this.simulations++;
    this.requests.set(request.requestId, {
      payload: canonicalJson(request),
      previewId: null,
      pending: true,
    });
    try {
      const result = await this.adapter.runTool(request);
      assertBoundedJson(result);
      this.requests.set(request.requestId, {
        payload: canonicalJson(request),
        previewId: null,
        result: structuredClone(result),
      });
      this.record("read", null, [request.requestId], provenance);
      return structuredClone(result);
    } catch (error) {
      this.record(
        "reject",
        null,
        [request.requestId],
        provenance,
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "INTERNAL_ERROR",
      );
      throw error;
    } finally {
      this.busy = false;
    }
  }
  getAudit(): AgentAuditEntry[] {
    return structuredClone(this.audit);
  }
  getUsage(): { toolCalls: number; simulations: number } {
    return { toolCalls: this.calls, simulations: this.simulations };
  }
}
