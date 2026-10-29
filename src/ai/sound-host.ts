import { Ajv2020 } from "ajv/dist/2020.js";
import documentSchema from "../../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };
import proposalSchema from "../../schemas/sound-behavior/sound-behavior-ai.schema.json" with { type: "json" };
import type {
  SoundAssetReference,
  SoundBehaviorDocument,
  SoundBehaviorProposal,
  SoundGenerator,
} from "../../schemas/sound-behavior/types.js";
import { createProfileRegistry } from "../audio-behavior/profile-registry.js";
import type { BehaviorContext } from "../audio-behavior/types.js";
import { AgentError } from "./types.js";
import type { PlannerProvenance } from "./types.js";
import { assertBoundedJson, canonicalJson, digestJson } from "./validation.js";

const ajv = new Ajv2020({ strict: true, allErrors: true, ownProperties: true });
ajv.addSchema(documentSchema);
const validateProposal = ajv.compile(proposalSchema);
const pinKey = (pin: SoundAssetReference): string => `${pin.assetId}@${pin.revision}`;

export interface SoundHostState {
  sceneId: string;
  sceneRevision: number;
  document: SoundBehaviorDocument;
  context: BehaviorContext;
}
export interface SoundHostAdapter {
  getState(): SoundHostState;
  /** Host pauses and drains old voices, then atomically commits the validated document. */
  commit(
    document: SoundBehaviorDocument,
    expectedDocumentRevision: number,
    expectedSceneRevision: number,
    transactionId: string,
  ): SoundBehaviorDocument | Promise<SoundBehaviorDocument>;
}
export interface SoundHostOptions {
  now?: () => number;
  previewTtlMs?: number;
  maxOperations?: number;
  maxPreviews?: number;
  maxAuditEntries?: number;
}
export interface SoundProposalPreview {
  previewId: string;
  digest: string;
  proposal: SoundBehaviorProposal;
  candidate: SoundBehaviorDocument;
  derivedAssetPins: SoundAssetReference[];
  changes: string[];
  baseDocumentRevision: number;
  baseSceneRevision: number;
  expiresAt: number;
  state: "awaitingApproval" | "applied" | "canceled" | "reverted";
  resultRevision: number | null;
  provenance: PlannerProvenance;
}
export interface SoundAuditEntry {
  sequence: number;
  timestamp: number;
  action: "stage" | "apply" | "undo" | "cancel";
  previewId: string;
  proposalId: string;
  sceneRevision: number;
  documentRevision: number;
  provenance: PlannerProvenance;
}
interface PreviewRecord {
  preview: SoundProposalPreview;
  before: SoundBehaviorDocument;
  contextDigest: string;
}

function strictDocument(
  document: SoundBehaviorDocument,
  state: SoundHostState,
): SoundBehaviorDocument {
  if (state.context.sceneRevision !== state.sceneRevision)
    throw new AgentError("REVISION_CONFLICT", "Behavior context與場景revision不符。");
  try {
    return createProfileRegistry(document, { ...state.context, validationMode: "product" })
      .document;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? String(error.code) : "DOMAIN_INVALID";
    throw new AgentError(
      code,
      error instanceof Error ? error.message : "Sound Behavior domain驗證失敗。",
    );
  }
}

/** Closed Sound proposal transaction host, separate from the original Scene tool enum. */
export class SoundProposalHost {
  private readonly adapter: SoundHostAdapter;
  private readonly now: () => number;
  private readonly ttl: number;
  private readonly maxOperations: number;
  private readonly maxPreviews: number;
  private readonly maxAudit: number;
  private readonly previews = new Map<string, PreviewRecord>();
  private readonly proposals = new Map<string, { payload: string; previewId: string }>();
  private readonly audit: SoundAuditEntry[] = [];
  private busy = false;
  private sequence = 0;
  private operationsUsed = 0;
  constructor(adapter: SoundHostAdapter, options: SoundHostOptions = {}) {
    this.adapter = adapter;
    this.now = options.now ?? Date.now;
    this.ttl = options.previewTtlMs ?? 300000;
    this.maxOperations = options.maxOperations ?? 32;
    this.maxPreviews = options.maxPreviews ?? 12;
    this.maxAudit = options.maxAuditEntries ?? 256;
    const bounds: [number, number][] = [
      [this.ttl, 300000],
      [this.maxOperations, 32],
      [this.maxPreviews, 48],
      [this.maxAudit, 1024],
    ];
    for (const [value, max] of bounds) {
      if (!Number.isSafeInteger(value) || value < 1 || value > max)
        throw new AgentError("POLICY_DENIED", "Sound Host預算不合法。");
    }
  }
  private record(action: SoundAuditEntry["action"], preview: SoundProposalPreview): void {
    const state = this.adapter.getState();
    this.audit.push({
      sequence: ++this.sequence,
      timestamp: this.now(),
      action,
      previewId: preview.previewId,
      proposalId: preview.proposal.proposalId,
      sceneRevision: state.sceneRevision,
      documentRevision: state.document.revision,
      provenance: structuredClone(preview.provenance),
    });
    if (this.audit.length > this.maxAudit) this.audit.shift();
  }
  private candidate(
    proposal: SoundBehaviorProposal,
    state: SoundHostState,
  ): { document: SoundBehaviorDocument; pins: SoundAssetReference[]; changes: string[] } {
    const next = structuredClone(state.document);
    const changes: string[] = [];
    for (const operation of proposal.operations) {
      if (operation.type === "CreateProfile") {
        if (next.profiles.some((profile) => profile.profileId === operation.profile.profileId))
          throw new AgentError("DUPLICATE_ID", "Profile ID已存在。");
        if (operation.profile.revision !== 1)
          throw new AgentError("STALE_PROFILE_REVISION", "新Profile必須從revision 1開始。");
        next.profiles.push(structuredClone(operation.profile));
        changes.push(
          `新增聲音Profile ${operation.profile.profileId}（${operation.profile.rules.length}條規則）`,
        );
      } else if (operation.type === "ReplaceProfile") {
        const index = next.profiles.findIndex(
          (profile) => profile.profileId === operation.profileId,
        );
        const existing = next.profiles[index];
        if (
          !existing ||
          existing.revision !== operation.expectedProfileRevision ||
          operation.profile.profileId !== existing.profileId ||
          operation.profile.revision !== existing.revision + 1
        )
          throw new AgentError(
            "STALE_PROFILE_REVISION",
            "Profile replacement必須符合目前版本並遞增一次。",
          );
        next.profiles[index] = structuredClone(operation.profile);
        changes.push(
          `升版聲音Profile ${existing.profileId}：${existing.revision} → ${operation.profile.revision}`,
        );
      } else if (operation.type === "DeleteProfile") {
        const existing = next.profiles.find((profile) => profile.profileId === operation.profileId);
        if (!existing || existing.revision !== operation.expectedProfileRevision)
          throw new AgentError("STALE_PROFILE_REVISION", "刪除Profile的版本不符。");
        next.profiles = next.profiles.filter(
          (profile) => profile.profileId !== operation.profileId,
        );
        changes.push(`刪除聲音Profile ${operation.profileId}`);
      } else if (operation.type === "AssignBinding") {
        if (next.bindings.some((binding) => binding.bindingId === operation.binding.bindingId))
          throw new AgentError(
            "DUPLICATE_ID",
            "Binding已存在；須先明確RemoveBinding再AssignBinding。",
          );
        next.bindings.push(structuredClone(operation.binding));
        changes.push(
          `將 ${operation.binding.objectId} 綁定至 ${operation.binding.profileId}@${operation.binding.profileRevision}`,
        );
      } else if (operation.type === "RemoveBinding") {
        if (!next.bindings.some((binding) => binding.bindingId === operation.bindingId))
          throw new AgentError("UNKNOWN_BINDING", "欲移除的Binding不存在。");
        next.bindings = next.bindings.filter(
          (binding) => binding.bindingId !== operation.bindingId,
        );
        changes.push(`解除Binding ${operation.bindingId}`);
      }
    }
    const pins: SoundAssetReference[] = [];
    const generators: SoundGenerator[] = next.profiles.flatMap((profile) => [
      ...profile.rules.map((rule) => rule.generator),
      ...profile.materialPairOverrides.map((override) => override.generator),
    ]);
    for (const generator of generators) {
      if (
        generator.kind !== "sample" ||
        next.assets.some((pin) => pinKey(pin) === pinKey(generator.asset))
      )
        continue;
      const trusted = state.context.assetRegistry.find(
        (asset) =>
          pinKey(asset) === pinKey(generator.asset) && asset.sha256 === generator.asset.sha256,
      );
      if (!trusted) throw new AgentError("UNKNOWN_ASSET", "模型指定的音檔不在可信registry。");
      if (trusted.availability !== "READY" || trusted.rightsStatus !== "APPROVED")
        throw new AgentError("ASSET_NOT_READY", "音檔尚未ready或權利尚未確認。");
      const pin = { assetId: trusted.assetId, revision: trusted.revision, sha256: trusted.sha256 };
      next.assets.push(pin);
      pins.push(pin);
      changes.push(`固定可信音檔 ${pin.assetId}@${pin.revision}（${pin.sha256.slice(0, 12)}…）`);
    }
    next.revision = state.document.revision + 1;
    return { document: strictDocument(next, state), pins, changes };
  }
  async stage(input: unknown, provenance: PlannerProvenance): Promise<SoundProposalPreview> {
    if (this.busy) throw new AgentError("TRANSACTION_BUSY", "另一個Sound交易正在處理。");
    assertBoundedJson(input, 256 * 1024);
    if (!validateProposal(input))
      throw new AgentError(
        "SCHEMA_INVALID",
        "Sound提案不符合封閉的五種operation契約。",
        (validateProposal.errors ?? []).map((error) => error.instancePath).slice(0, 16),
      );
    const proposal = structuredClone(input) as unknown as SoundBehaviorProposal;
    const payload = canonicalJson(proposal);
    const previous = this.proposals.get(proposal.proposalId);
    if (previous) {
      if (previous.payload !== payload)
        throw new AgentError("DOMAIN_INVALID", "同一proposalId不能改變內容。");
      return structuredClone(this.previews.get(previous.previewId)!.preview);
    }
    const state = structuredClone(this.adapter.getState());
    if (
      proposal.sceneId !== state.sceneId ||
      proposal.expectedSceneRevision !== state.sceneRevision ||
      proposal.expectedBehaviorRevision !== state.document.revision
    )
      throw new AgentError("REVISION_CONFLICT", "Sound提案的scene／document版本已過期。");
    if (
      proposal.operations.length > this.maxOperations ||
      this.operationsUsed + proposal.operations.length > 48 ||
      this.previews.size >= this.maxPreviews
    )
      throw new AgentError("BUDGET_EXCEEDED", "Sound提案超出此session的操作／預覽預算。");
    strictDocument(state.document, state);
    this.busy = true;
    try {
      const next = this.candidate(proposal, state);
      const contextDigest = await digestJson(state.context);
      const digest = await digestJson({
        proposal,
        before: state.document,
        candidate: next.document,
        contextDigest,
        changes: next.changes,
        derivedAssetPins: next.pins,
      });
      const previewId = `sound.preview-${this.sequence + 1}`;
      const preview: SoundProposalPreview = {
        previewId,
        digest,
        proposal,
        candidate: next.document,
        derivedAssetPins: next.pins,
        changes: next.changes,
        baseDocumentRevision: state.document.revision,
        baseSceneRevision: state.sceneRevision,
        expiresAt: this.now() + this.ttl,
        state: "awaitingApproval",
        resultRevision: null,
        provenance: structuredClone(provenance),
      };
      this.previews.set(previewId, { preview, before: state.document, contextDigest });
      this.proposals.set(proposal.proposalId, { payload, previewId });
      this.operationsUsed += proposal.operations.length;
      this.record("stage", preview);
      return structuredClone(preview);
    } finally {
      this.busy = false;
    }
  }
  async apply(previewId: string, approvedDigest: string): Promise<SoundBehaviorDocument> {
    if (this.busy) throw new AgentError("TRANSACTION_BUSY", "另一個Sound交易正在處理。");
    const record = this.previews.get(previewId);
    if (!record) throw new AgentError("PREVIEW_REQUIRED", "找不到Sound預覽。");
    const preview = record.preview;
    if (approvedDigest !== preview.digest)
      throw new AgentError("APPROVAL_REQUIRED", "核准digest與預覽不符。");
    if (preview.state === "applied") return structuredClone(preview.candidate);
    if (preview.state !== "awaitingApproval" || this.now() >= preview.expiresAt)
      throw new AgentError("PREVIEW_REQUIRED", "Sound預覽已取消、回復或過期。");
    this.busy = true;
    try {
      const current = this.adapter.getState();
      if (
        current.sceneId !== preview.proposal.sceneId ||
        current.sceneRevision !== preview.baseSceneRevision ||
        current.document.revision !== preview.baseDocumentRevision ||
        canonicalJson(current.document) !== canonicalJson(record.before) ||
        (await digestJson(current.context)) !== record.contextDigest
      )
        throw new AgentError(
          "REVISION_CONFLICT",
          "預覽後scene、behavior或可信registry已變動，請重新提出。",
        );
      const candidate = strictDocument(preview.candidate, current);
      const result = await this.adapter.commit(
        structuredClone(candidate),
        preview.baseDocumentRevision,
        preview.baseSceneRevision,
        previewId,
      );
      if (
        result.revision !== preview.baseDocumentRevision + 1 ||
        result.documentId !== candidate.documentId ||
        canonicalJson(result) !== canonicalJson(candidate)
      )
        throw new AgentError("INTERNAL_ERROR", "Sound commit未保持已核准內容與新revision。");
      preview.state = "applied";
      preview.resultRevision = result.revision;
      preview.candidate = structuredClone(result);
      this.record("apply", preview);
      return structuredClone(result);
    } finally {
      this.busy = false;
    }
  }
  async undo(previewId: string): Promise<SoundBehaviorDocument> {
    if (this.busy) throw new AgentError("TRANSACTION_BUSY", "另一個Sound交易正在處理。");
    const record = this.previews.get(previewId);
    if (!record || record.preview.state !== "applied")
      throw new AgentError("PREVIEW_REQUIRED", "Sound交易尚未套用或已回復。");
    const preview = record.preview;
    this.busy = true;
    try {
      const current = this.adapter.getState();
      if (
        current.sceneId !== preview.proposal.sceneId ||
        current.sceneRevision !== preview.baseSceneRevision ||
        current.document.revision !== preview.resultRevision ||
        canonicalJson(current.document) !== canonicalJson(preview.candidate)
      )
        throw new AgentError("REVISION_CONFLICT", "後續已有編輯，Undo不能覆蓋。");
      const next = strictDocument(
        { ...structuredClone(record.before), revision: current.document.revision + 1 },
        current,
      );
      const result = await this.adapter.commit(
        next,
        current.document.revision,
        current.sceneRevision,
        `${previewId}.undo`,
      );
      if (canonicalJson(result) !== canonicalJson(next))
        throw new AgentError("INTERNAL_ERROR", "Sound Undo未保持原內容與新revision。");
      preview.state = "reverted";
      this.record("undo", preview);
      return structuredClone(result);
    } finally {
      this.busy = false;
    }
  }
  cancel(previewId: string): void {
    if (this.busy) throw new AgentError("TRANSACTION_BUSY", "Sound操作進行中，尚不能宣稱已取消。");
    const record = this.previews.get(previewId);
    if (!record || record.preview.state !== "awaitingApproval")
      throw new AgentError("PREVIEW_REQUIRED", "沒有可取消的Sound預覽。");
    record.preview.state = "canceled";
    this.record("cancel", record.preview);
  }
  getAudit(): SoundAuditEntry[] {
    return structuredClone(this.audit);
  }
  getUsage(): { operations: number; previews: number } {
    return { operations: this.operationsUsed, previews: this.previews.size };
  }
}
