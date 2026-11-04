import { AgentError, MUTATION_TOOLS } from "./types.js";
import type {
  AgentAdapter,
  AgentAuditEntry,
  AgentHostOptions,
  AgentPreview,
  AgentSidecarSnapshot,
  AgentSidecarRestore,
  PlannerProvenance,
  ToolRequest,
} from "./types.js";
import type { SceneSpec } from "../scene/types.js";
import { assertBoundedJson, canonicalJson, digestJson, validateToolRequest } from "./validation.js";

interface PreviewRecord {
  preview: AgentPreview;
  before: SceneSpec;
  appliedSidecar?: AgentSidecarSnapshot;
}
function snapshotDocument(snapshot: AgentSidecarSnapshot): Record<string, unknown> {
  assertBoundedJson(snapshot, 1024 * 1024);
  const document = snapshot.document;
  if (
    snapshot.namespace !== "motion" ||
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    !document ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    (document as Record<string, unknown>).schemaVersion !== "1.0.0" ||
    (document as Record<string, unknown>).revision !== snapshot.revision
  )
    throw new AgentError("DOMAIN_INVALID", "Motion sidecar snapshot不合法。");
  return document as Record<string, unknown>;
}
async function assertSnapshotPin(snapshot: AgentSidecarSnapshot, scene: SceneSpec): Promise<void> {
  const document = snapshotDocument(snapshot);
  const pin = document.scenePin as Record<string, unknown> | undefined;
  if (
    !pin ||
    pin.sceneId !== scene.sceneId ||
    pin.sceneRevision !== scene.sceneRevision ||
    pin.sceneHash !== (await digestJson(scene))
  )
    throw new AgentError("REVISION_CONFLICT", "Motion sidecar的Scene pin不符。");
}
function sameSnapshot(a: AgentSidecarSnapshot | undefined, b: AgentSidecarSnapshot | undefined) {
  return canonicalJson(a ?? null) === canonicalJson(b ?? null);
}
/** Only engine identity is rebound; approved authoring content remains immutable. */
function assertGenerationProjection(
  expected: AgentSidecarSnapshot,
  projected: AgentSidecarSnapshot,
): void {
  const before = snapshotDocument(expected);
  const after = snapshotDocument(projected);
  if (expected.namespace !== projected.namespace || expected.revision !== projected.revision)
    throw new AgentError("DOMAIN_INVALID", "Motion restore projection changed registry identity.");
  const beforeActions = before.actions;
  const afterActions = after.actions;
  if (
    !Array.isArray(beforeActions) ||
    !Array.isArray(afterActions) ||
    beforeActions.length !== afterActions.length ||
    Array.from({ length: beforeActions.length }, (_, index) => index).some(
      (index) => !Object.hasOwn(beforeActions, index) || !Object.hasOwn(afterActions, index),
    )
  )
    throw new AgentError("DOMAIN_INVALID", "Motion restore projection changed authoring actions.");
  const normalized = structuredClone(after);
  normalized.actions = afterActions.map((action, index) => {
    const original = beforeActions[index];
    if (
      !original ||
      typeof original !== "object" ||
      Array.isArray(original) ||
      !action ||
      typeof action !== "object" ||
      Array.isArray(action) ||
      !Object.hasOwn(original, "generation") ||
      !Object.hasOwn(action, "generation") ||
      !Number.isSafeInteger(original.generation) ||
      original.generation < 1 ||
      !Number.isSafeInteger(action.generation) ||
      action.generation < 1
    )
      throw new AgentError(
        "DOMAIN_INVALID",
        "Motion restore projection requires a positive generation.",
      );
    const candidate = structuredClone(action) as Record<string, unknown>;
    candidate.generation = original.generation;
    return candidate;
  });
  const normalizedSnapshot = structuredClone(projected);
  normalizedSnapshot.document = normalized;
  if (canonicalJson(expected) !== canonicalJson(normalizedSnapshot))
    throw new AgentError(
      "DOMAIN_INVALID",
      "Motion restore projection changed approved authoring content.",
    );
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
  private latestApplied: string | null = null;
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
  /** Only the latest applied preview can still be undone; others are finished with. */
  private evictFinishedPreviews(): void {
    if (this.previews.size < 48) return;
    for (const [previewId, record] of this.previews) {
      if (record.preview.state === "awaitingApproval" || previewId === this.latestApplied) continue;
      this.previews.delete(previewId);
      if (this.previews.size < 48) return;
    }
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
    this.evictFinishedPreviews();
    if (this.calls + requests.length > this.maxCalls || this.previews.size >= 48)
      throw new AgentError("BUDGET_EXCEEDED", "工具／交易數量已達上限。");
    this.busy = true;
    this.calls += requests.length;
    try {
      const before = structuredClone(this.adapter.getScene());
      const sidecarBefore = this.adapter.getSidecarSnapshot?.();
      const beforeSidecar = sidecarBefore ? structuredClone(sidecarBefore) : undefined;
      const result = structuredClone(await this.adapter.preview(requests));
      if (canonicalJson(this.adapter.getScene()) !== canonicalJson(before))
        throw new AgentError("REVISION_CONFLICT", "預覽期間場景已變動。");
      if (!sameSnapshot(beforeSidecar, this.adapter.getSidecarSnapshot?.()))
        throw new AgentError("REVISION_CONFLICT", "預覽期間Motion registry已變動。");
      const sceneRevisionDelta = result.sceneRevisionDelta ?? 1;
      if (
        ![0, 1].includes(sceneRevisionDelta) ||
        result.candidate.sceneId !== before.sceneId ||
        result.candidate.sceneRevision !== before.sceneRevision + sceneRevisionDelta ||
        (sceneRevisionDelta === 0 &&
          (!result.sidecar || canonicalJson(result.candidate) !== canonicalJson(before)))
      )
        throw new AgentError("DOMAIN_INVALID", "預覽的Scene／sidecar revision語義不符。");
      if (result.sidecar) {
        if (
          !beforeSidecar ||
          !sameSnapshot(result.sidecar.before, beforeSidecar) ||
          result.sidecar.candidate.revision !== result.sidecar.before.revision + 1
        )
          throw new AgentError("REVISION_CONFLICT", "Motion預覽未引用目前registry revision。");
        // An empty registry binds nothing to the old scene, and experiments leave its pin alone.
        const bound = snapshotDocument(result.sidecar.before).actions;
        if (!Array.isArray(bound) || bound.length)
          await assertSnapshotPin(result.sidecar.before, before);
        await assertSnapshotPin(result.sidecar.candidate, result.candidate);
      }
      const previewId = `agent.preview-${this.sequence + 1}`;
      const digest = await digestJson({
        requests,
        baseRevision: before.sceneRevision,
        before,
        candidate: result.candidate,
        changes: result.changes,
        warnings: result.warnings,
        sceneRevisionDelta,
        ...(result.sidecar ? { sidecar: result.sidecar } : {}),
      });
      if (
        canonicalJson(this.adapter.getScene()) !== canonicalJson(before) ||
        !sameSnapshot(beforeSidecar, this.adapter.getSidecarSnapshot?.())
      )
        throw new AgentError("REVISION_CONFLICT", "預覽計算期間作者資料已變動。");
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
        sceneRevisionDelta,
        ...(result.sidecar ? { sidecar: structuredClone(result.sidecar) } : {}),
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
      this.calls -= requests.length;
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
    if (
      preview.sidecar &&
      (!sameSnapshot(preview.sidecar.before, this.adapter.getSidecarSnapshot?.()) ||
        canonicalJson(this.adapter.getScene()) !== canonicalJson(record.before))
    )
      throw new AgentError("REVISION_CONFLICT", "Motion registry已變動，請重新預覽。");
    this.busy = true;
    try {
      const result = await this.adapter.commit(
        structuredClone(preview.candidate),
        preview.baseRevision,
        previewId,
        structuredClone(preview.requests),
        preview.sidecar ? structuredClone(preview.sidecar) : undefined,
      );
      if (
        result.sceneRevision !== preview.baseRevision + (preview.sceneRevisionDelta ?? 1) ||
        result.sceneId !== preview.sceneId
      )
        throw new AgentError("INTERNAL_ERROR", "Host commit未產生正確revision。");
      if (preview.sidecar) {
        const actual = this.adapter.getSidecarSnapshot?.();
        if (
          !sameSnapshot(actual, preview.sidecar.candidate) ||
          canonicalJson(result) !== canonicalJson(preview.candidate) ||
          canonicalJson(this.adapter.getScene()) !== canonicalJson(preview.candidate)
        )
          throw new AgentError("INTERNAL_ERROR", "Host commit與已核准的Scene／Motion內容不符。");
        record.appliedSidecar = structuredClone(actual!);
      }
      preview.candidate = structuredClone(result);
      preview.resultRevision = result.sceneRevision;
      preview.state = "applied";
      // A person has now reviewed these calls, so they no longer count against the allowance.
      this.calls -= preview.requests.length;
      this.latestApplied = previewId;
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
    if (
      record.appliedSidecar &&
      (!sameSnapshot(record.appliedSidecar, this.adapter.getSidecarSnapshot?.()) ||
        canonicalJson(this.adapter.getScene()) !== canonicalJson(record.preview.candidate))
    )
      throw new AgentError("REVISION_CONFLICT", "後續已有Motion編輯，不能覆蓋。");
    this.busy = true;
    try {
      const sceneRevisionDelta = record.preview.sceneRevisionDelta ?? 1;
      const targetScene = {
        ...structuredClone(record.before),
        sceneRevision: record.preview.resultRevision! + sceneRevisionDelta,
      };
      let sidecarRestore: AgentSidecarRestore | undefined;
      if (record.preview.sidecar && record.appliedSidecar) {
        const revision = record.appliedSidecar.revision + 1;
        const document = structuredClone(snapshotDocument(record.preview.sidecar.before));
        document.revision = revision;
        document.scenePin = {
          sceneId: targetScene.sceneId,
          sceneRevision: targetScene.sceneRevision,
          sceneHash: await digestJson(targetScene),
        };
        sidecarRestore = {
          expectedCurrent: structuredClone(record.appliedSidecar),
          restore: { namespace: "motion", revision, document },
        };
        if (this.adapter.prepareSidecarRestore) {
          const expected = structuredClone(sidecarRestore.restore);
          const projected = structuredClone(
            await this.adapter.prepareSidecarRestore(
              structuredClone(expected),
              structuredClone(targetScene),
            ),
          );
          assertGenerationProjection(expected, projected);
          await assertSnapshotPin(projected, targetScene);
          if (
            !sameSnapshot(record.appliedSidecar, this.adapter.getSidecarSnapshot?.()) ||
            canonicalJson(this.adapter.getScene()) !== canonicalJson(record.preview.candidate)
          )
            throw new AgentError(
              "REVISION_CONFLICT",
              "Motion restore projection changed live state.",
            );
          sidecarRestore.restore = projected;
        }
      }
      const scene = await this.adapter.restore(
        structuredClone(record.before),
        record.preview.resultRevision!,
        previewId + ".undo",
        sidecarRestore,
      );
      if (scene.sceneRevision !== targetScene.sceneRevision)
        throw new AgentError("INTERNAL_ERROR", "Undo未產生新revision。");
      if (
        sidecarRestore &&
        (!sameSnapshot(sidecarRestore.restore, this.adapter.getSidecarSnapshot?.()) ||
          canonicalJson(scene) !== canonicalJson(targetScene) ||
          canonicalJson(this.adapter.getScene()) !== canonicalJson(targetScene))
      )
        throw new AgentError("INTERNAL_ERROR", "Undo未完整恢復已核准的Scene／Motion內容。");
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
    this.calls -= record.preview.requests.length;
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
