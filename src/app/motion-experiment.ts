import { AgentError } from "../ai/types.js";
import { digestJson } from "../ai/validation.js";
import { canonicalStringify } from "../experiments/hash.js";
import { RecordingError } from "../experiments/types.js";
import {
  MotionError,
  MotionWorkspace,
  pinMotionScene,
  validateMotionRegistry,
  type MotionRegistryDocument,
} from "../motion/index.js";
import type { PhysicsWorld } from "../physics/index.js";
import type { SceneSpec } from "../scene/types.js";

/** One bounded simultaneous set; the authoring registry is never an implicit timeline. */
export const MAX_EXPERIMENT_MOTION_ACTIONS = 8;
export interface ExperimentMotionExecution {
  workspace: MotionWorkspace;
  physicsConfig: {
    motionRegistry: MotionRegistryDocument;
    motionExecution: {
      schemaVersion: "1.0.0";
      policy: "one-action-per-object-start-at-tick0";
      rebindReason: "isolated-simulation-world";
      sourceRegistry: MotionRegistryDocument;
      sourceRegistrySha256: string;
      runtimeRegistrySha256: string;
      generationBindings: {
        actionId: string;
        objectId: string;
        authorGeneration: number;
        runtimeGeneration: number;
      }[];
    };
  };
}

/** Consume only a trusted, immutable host snapshot; never silently rebase a stale author pin. */
export async function prepareExperimentMotion(
  physicsConfig: unknown,
  authorScene: SceneSpec,
  runtimeScene: SceneSpec,
  world: PhysicsWorld,
  check: () => void,
): Promise<ExperimentMotionExecution | null> {
  if (
    !physicsConfig ||
    typeof physicsConfig !== "object" ||
    Array.isArray(physicsConfig) ||
    !("motionRegistry" in physicsConfig) ||
    physicsConfig.motionRegistry === undefined
  )
    return null;
  let workspace: MotionWorkspace | null = null;
  try {
    const input = physicsConfig.motionRegistry;
    const authorRegistry = validateMotionRegistry(input);
    // Empty sidecars do not change legacy runs, even after unrelated scene authoring.
    if (authorRegistry.actions.length === 0) return null;
    if (authorRegistry.actions.length > MAX_EXPERIMENT_MOTION_ACTIONS)
      throw new AgentError("BUDGET_EXCEEDED", "實驗動作最多同時控制八個物件。");
    const bodies = new Set<string>();
    for (const action of authorRegistry.actions) {
      if (bodies.has(action.objectId))
        throw new AgentError(
          "DOMAIN_INVALID",
          `物件 ${action.objectId} 有多個作者動作；實驗需要每個物件恰好一個動作。`,
        );
      bodies.add(action.objectId);
    }
    const authorPin = await pinMotionScene(authorScene);
    check();
    if (canonicalStringify(authorPin) !== canonicalStringify(authorRegistry.scenePin))
      throw new AgentError("DOMAIN_INVALID", "作者 Motion 的場景 pin 已過期；請先明確重新綁定。");
    // Preserve the exact supplied JSON, including its original revision and generations.
    const sourceRegistry = structuredClone(input) as MotionRegistryDocument;
    const sourceRegistrySha256 = await digestJson(sourceRegistry);
    check();
    workspace = await MotionWorkspace.create(runtimeScene, world, { getScene: () => runtimeScene });
    check();
    // This trusted projection is for the new isolated world, never a user-scene mutation.
    const projected = await workspace.projectRestoredRegistry(authorRegistry, runtimeScene);
    check();
    await workspace.importJson(canonicalStringify(projected), workspace.getSnapshot().revision);
    check();
    const runtimeRegistry = workspace.getSnapshot();
    const runtimeRegistrySha256 = await digestJson(runtimeRegistry);
    check();
    for (let index = 0; index < runtimeRegistry.actions.length; index++) {
      await workspace.start(runtimeRegistry.actions[index]!.actionId, `experiment.motion.${index}`);
      check();
    }
    return {
      workspace,
      physicsConfig: {
        motionRegistry: runtimeRegistry,
        motionExecution: {
          schemaVersion: "1.0.0",
          policy: "one-action-per-object-start-at-tick0",
          rebindReason: "isolated-simulation-world",
          sourceRegistry,
          sourceRegistrySha256,
          runtimeRegistrySha256,
          generationBindings: runtimeRegistry.actions.map((action, index) => ({
            actionId: action.actionId,
            objectId: action.objectId,
            authorGeneration: authorRegistry.actions[index]!.generation,
            runtimeGeneration: action.generation,
          })),
        },
      },
    };
  } catch (error) {
    workspace?.dispose();
    if (error instanceof RecordingError)
      throw new AgentError(
        "DOMAIN_INVALID",
        `作者 Motion 需要合法、有限的純 JSON：${error.message}`,
      );
    if (error instanceof MotionError)
      throw new AgentError(
        error.code === "MOTION_BUDGET" ? "BUDGET_EXCEEDED" : "DOMAIN_INVALID",
        `無法執行作者 Motion：${error.message}`,
      );
    throw error;
  }
}
