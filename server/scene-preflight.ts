import { createHash } from "node:crypto";
import { AgentHost } from "../src/ai/host.js";
import { createSceneToolAdapter } from "../src/ai/scene-adapter.js";
import { AgentError } from "../src/ai/types.js";
import type { AgentPlan, PlannerContext, PlannerProvenance } from "../src/ai/types.js";
import { MotionWorkspace } from "../src/motion/workspace.js";
import { PhysicsWorld } from "../src/physics/physics-world.js";
import { createScene } from "../src/scene/index.js";
import type {
  MetaBuildFailure,
  MetaBuildValidator,
  MetaProvider,
  MetaRequestOptions,
} from "./meta-provider.js";

const PREFLIGHT: PlannerProvenance = {
  provider: "metaModelApi",
  modelId: null,
  requestId: null,
  label: "META_LIVE",
};
function refused(): never {
  throw new AgentError("POLICY_DENIED", "Server preflight cannot change a scene.");
}
/**
 * Runs the real Host rules against the submitted snapshot so that Muse can correct its own list.
 * This is not approval: the browser's Host validates again against its live state before any preview.
 */
export function createScenePreflight(context: PlannerContext): MetaBuildValidator {
  return async (requests): Promise<MetaBuildFailure[]> => {
    const scene = createScene(context.scene);
    let world: PhysicsWorld | null = null;
    let motion: MotionWorkspace | null = null;
    try {
      world = await PhysicsWorld.create(scene);
      motion = await MotionWorkspace.create(scene, world, { getScene: () => scene });
      const workspace = motion;
      const adapter = createSceneToolAdapter({
        getScene: () => scene,
        commitScene: refused,
        materials: context.materials,
        signals: context.signals,
        materialRegistryRevision: context.materialRegistryRevision,
        motionTransaction: {
          getSnapshot: () => {
            const document = workspace.getSnapshot();
            return { namespace: "motion", revision: document.revision, document };
          },
          preview: async (trajectories, candidateScene, removedObjectIds) => {
            const result = await workspace.previewTrajectories(
              trajectories,
              candidateScene,
              removedObjectIds,
            );
            return {
              ...result,
              candidate: {
                namespace: "motion",
                revision: result.candidate.revision,
                document: result.candidate,
              },
            };
          },
          commit: refused,
          restore: refused,
        },
      });
      await new AgentHost(adapter).stage(requests, PREFLIGHT);
      return [];
    } catch (error) {
      return [
        {
          callIndex: null,
          tool: null,
          code:
            error && typeof error === "object" && "code" in error
              ? String(error.code)
              : "DOMAIN_INVALID",
          message: error instanceof Error ? error.message : "The list failed validation.",
        },
      ];
    } finally {
      motion?.dispose();
      world?.dispose();
    }
  };
}
/** Turns a finished build into the one thing the browser understands: a plan, or a plain error. */
export async function proposeScene(
  provider: MetaProvider,
  prompt: string,
  context: PlannerContext,
  options: MetaRequestOptions,
): Promise<AgentPlan> {
  const result = await provider.planBuild(prompt, context, {
    ...options,
    validate: createScenePreflight(context),
  });
  const last = result.rounds.at(-1);
  if (result.accepted && result.plan) return result.plan;
  if (result.stopReason === "truncated")
    throw new AgentError(
      "PROPOSAL_TOO_LONG",
      "Muse的提案過長而被截斷，沒有可用內容；請縮小要求或分次提出。",
    );
  if (result.stopReason === "rejected")
    throw new AgentError(
      "PROPOSAL_REJECTED",
      `Muse修正後仍未通過驗證：${last?.failures[0]?.message ?? "未提供原因。"}`,
    );
  if (!last?.responseId || !last.modelId)
    throw new AgentError("PROVIDER_REQUEST_FAILED", "Meta回覆缺少實際response或model識別。");
  return {
    planId: `meta.plan-${createHash("sha256").update(last.responseId).digest("hex").slice(0, 40)}`,
    requests: [],
    assumptions: [],
    warnings: [],
    summary: "Meta未提出可驗證操作，場景未變更。",
    ...(last.text?.trim() ? { note: last.text.trim() } : {}),
    provenance: {
      provider: "metaModelApi",
      modelId: last.modelId,
      requestId: last.responseId,
      label: "META_LIVE",
    },
  };
}
