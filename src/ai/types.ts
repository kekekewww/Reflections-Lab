import type { SceneSpec } from "../scene/types.js";

export const MUTATION_TOOLS = [
  "CreateScene",
  "AddObject",
  "SetMaterial",
  "SetRigidBodyMode",
  "ConfigureSoundSource",
  "MoveListener",
  "SetTrajectory",
] as const;
export const READ_TOOLS = [
  "RunSimulation",
  "CaptureExperiment",
  "AnalyzeAcousticResults",
  "CompareExperiments",
  "PreviewSceneChanges",
] as const;
export type MutationTool = (typeof MUTATION_TOOLS)[number];
export type ReadTool = (typeof READ_TOOLS)[number];
export type ToolName = MutationTool | ReadTool;
export interface ToolRequest {
  schemaVersion: "1.0.0";
  requestId: string;
  tool: ToolName;
  sceneId: string;
  expectedSceneRevision: number;
  transactionId: string | null;
  arguments: Record<string, unknown>;
}
export interface PlannerProvenance {
  provider: "offlineDeterministic" | "metaModelApi";
  modelId: string | null;
  requestId: string | null;
  label: "OFFLINE_DETERMINISTIC" | "META_LIVE";
}
export interface RegistryEntry {
  id: string;
  label: string;
  frequencyHz?: number;
}
export interface PlannerContext {
  scene: SceneSpec;
  materials: RegistryEntry[];
  signals: RegistryEntry[];
  materialRegistryRevision: number;
  selectedObjectId?: string;
}
export interface AgentPlan {
  planId: string;
  requests: ToolRequest[];
  assumptions: string[];
  warnings: string[];
  summary: string;
  provenance: PlannerProvenance;
}
export interface AgentPreview {
  previewId: string;
  digest: string;
  baseRevision: number;
  sceneId: string;
  requests: ToolRequest[];
  candidate: SceneSpec;
  changes: string[];
  warnings: string[];
  expiresAt: number;
  state: "awaitingApproval" | "applied" | "canceled" | "reverted";
  resultRevision: number | null;
  provenance: PlannerProvenance;
}
export interface AgentAdapter {
  getScene(): SceneSpec;
  preview(
    requests: ToolRequest[],
  ):
    | { candidate: SceneSpec; changes: string[]; warnings: string[] }
    | Promise<{ candidate: SceneSpec; changes: string[]; warnings: string[] }>;
  commit(
    candidate: SceneSpec,
    expectedRevision: number,
    transactionId: string,
    approvedRequests?: ToolRequest[],
  ): SceneSpec | Promise<SceneSpec>;
  restore(
    snapshot: SceneSpec,
    expectedRevision: number,
    transactionId: string,
  ): SceneSpec | Promise<SceneSpec>;
  runTool?(request: ToolRequest): Promise<unknown>;
}
export interface AgentAuditEntry {
  sequence: number;
  timestamp: number;
  action: "stage" | "apply" | "undo" | "cancel" | "read" | "reject";
  previewId: string | null;
  requestIds: string[];
  revision: number;
  code: string | null;
  provenance: PlannerProvenance | null;
}
export interface AgentHostOptions {
  now?: () => number;
  previewTtlMs?: number;
  maxToolCalls?: number;
  maxSimulations?: number;
  maxAuditEntries?: number;
}
export class AgentError extends Error {
  readonly code: string;
  readonly fieldPaths: string[];
  readonly retryable: boolean;
  constructor(code: string, message: string, fieldPaths: string[] = [], retryable = false) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.fieldPaths = fieldPaths;
    this.retryable = retryable;
  }
}
export interface MetricEvidence {
  metricRecordId: string;
  evidenceArtifactId: string;
  runId: string;
  metricId: string;
  value: number | null;
  unit: string;
  availability: "available" | "unavailable";
  provenance: "Computed" | "Estimated" | "Measured";
  methodId: string;
  limitations: string[];
}
