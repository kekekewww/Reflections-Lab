import { createScene } from "../scene/index.js";
import type { Quaternion, SceneSpec, Vec3 } from "../scene/types.js";
import { canonicalStringify } from "../experiments/hash.js";
import { digestJson } from "../ai/validation.js";
import {
  MotionError,
  type MotionAction,
  type MotionActionInput,
  type MotionRegistryDocument,
  type MotionSample,
  type MotionScenePin,
} from "./types.js";

export const MAX_MOTION_ACTIONS = 64;
export const MAX_MOTION_JSON_BYTES = 1024 * 1024;
const idPattern = /^[a-z][a-z0-9._-]{0,63}$/;
const fail = (message: string): never => {
  throw new MotionError("MOTION_INVALID", message);
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Motion data must be a plain JSON object.");
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    fail("Motion data contains an unknown field.");
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !idPattern.test(value)) fail(`Invalid ${label}.`);
  return value as string;
}
function scalar(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    fail(`${label} must be finite and within ${min}–${max}.`);
  return value as number;
}
function integer(
  value: unknown,
  label: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const result = scalar(value, label, min, max);
  if (!Number.isSafeInteger(result)) fail(`${label} must be an integer.`);
  return result;
}
function vector(value: unknown, label: string, max: number): Vec3 {
  if (!Array.isArray(value) || value.length !== 3) fail(`${label} must contain three values.`);
  return (value as unknown[]).map((entry) => scalar(entry, label, -max, max)) as Vec3;
}
function quaternion(value: unknown): Quaternion {
  if (!Array.isArray(value) || value.length !== 4) fail("A quaternion needs four values.");
  const q = (value as unknown[]).map((entry) => scalar(entry, "quaternion", -1, 1));
  if (Math.abs(Math.hypot(...q) - 1) > 1e-5) fail("Quaternion must have unit length.");
  return q as Quaternion;
}
function samples(value: unknown): MotionSample[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 64)
    fail("A trajectory needs 2–64 samples.");
  let last = -1;
  return (value as unknown[]).map((entry, index) => {
    const sample = object(entry);
    fields(sample, ["timeS", "positionM", "orientationQuaternion"]);
    const timeS = scalar(sample.timeS, "sample time", 0, 30);
    if ((index === 0 && timeS !== 0) || timeS <= last)
      fail("Trajectory samples must start at zero and increase strictly.");
    last = timeS;
    return {
      timeS,
      positionM: vector(sample.positionM, "sample position", 200),
      orientationQuaternion: quaternion(sample.orientationQuaternion),
    };
  });
}
export async function pinMotionScene(input: SceneSpec): Promise<MotionScenePin> {
  const scene = createScene(input);
  return {
    sceneId: scene.sceneId,
    sceneRevision: scene.sceneRevision,
    sceneHash: await digestJson(scene),
  };
}
export function validateMotionScenePin(input: unknown): MotionScenePin {
  const pin = object(input);
  fields(pin, ["sceneId", "sceneRevision", "sceneHash"]);
  if (typeof pin.sceneHash !== "string" || !/^sha256:[a-f0-9]{64}$/.test(pin.sceneHash))
    fail("Motion scene hash must be a canonical SHA-256.");
  return {
    sceneId: identifier(pin.sceneId, "scene ID"),
    sceneRevision: integer(pin.sceneRevision, "scene revision", 0),
    sceneHash: pin.sceneHash as string,
  };
}
export function createMotionAction(
  input: MotionActionInput,
  revision: number,
  generation: number,
): MotionAction {
  try {
    canonicalStringify(input);
  } catch {
    fail("Motion action must contain dense, finite plain JSON data.");
  }
  const raw = object(input);
  fields(raw, [
    "actionId",
    "objectId",
    "kind",
    "targetPositionM",
    "targetOrientationQuaternion",
    "samples",
    "impulseNs",
    "maxSpeedMps",
    "maxAccelerationMps2",
    "maxImpulseNs",
    "maxAngularSpeedRadps",
    "maxTorqueImpulseNms",
    "timeoutS",
    "positionToleranceM",
    "velocityToleranceMps",
    "settleTicks",
    "releasePolicy",
    "releaseMode",
    "source",
  ]);
  if (!["moveTo", "moveAndRelease", "impulse", "trajectory"].includes(String(raw.kind)))
    fail("Unknown motion kind.");
  const action: MotionAction = {
    actionId: identifier(raw.actionId, "action ID"),
    objectId: identifier(raw.objectId, "object ID"),
    kind: raw.kind as MotionAction["kind"],
    revision: integer(revision, "action revision", 1),
    generation: integer(generation, "body generation", 1),
    maxSpeedMps: scalar(raw.maxSpeedMps ?? 1, "maximum speed", 0.01, 3),
    maxAccelerationMps2: scalar(raw.maxAccelerationMps2 ?? 12, "maximum acceleration", 0.1, 100),
    maxImpulseNs: scalar(raw.maxImpulseNs ?? 10, "maximum impulse", 0.001, 1000),
    maxAngularSpeedRadps: scalar(raw.maxAngularSpeedRadps ?? 1, "maximum angular speed", 0.01, 3),
    maxTorqueImpulseNms: scalar(raw.maxTorqueImpulseNms ?? 1, "maximum torque impulse", 0.001, 100),
    timeoutS: scalar(raw.timeoutS ?? 10, "timeout", 0.1, 60),
    positionToleranceM: scalar(raw.positionToleranceM ?? 0.025, "position tolerance", 0.001, 0.25),
    velocityToleranceMps: scalar(raw.velocityToleranceMps ?? 0.08, "velocity tolerance", 0.001, 1),
    settleTicks: integer(raw.settleTicks ?? 3, "settle ticks", 1, 60),
    releasePolicy: (raw.releasePolicy ?? "preserve") as MotionAction["releasePolicy"],
    releaseMode: (raw.releaseMode ?? "dynamicGravity") as MotionAction["releaseMode"],
    source: (raw.source ?? "user") as MotionAction["source"],
  };
  if (!["preserve", "zero", "transfer"].includes(action.releasePolicy))
    fail("Unknown release policy.");
  if (!["dynamicGravity", "dynamicNoGravity"].includes(action.releaseMode))
    fail("Unknown release mode.");
  if (!["user", "ai"].includes(action.source)) fail("Unknown motion source.");
  if (action.kind === "impulse") {
    if (
      raw.targetPositionM !== undefined ||
      raw.targetOrientationQuaternion !== undefined ||
      raw.samples !== undefined
    )
      fail("Impulse cannot also contain a target or trajectory.");
    action.impulseNs = vector(raw.impulseNs, "impulse", 1000);
    if (Math.hypot(...action.impulseNs) > action.maxImpulseNs)
      fail("Authored impulse exceeds the action limit.");
  } else if (action.kind === "trajectory") {
    if (
      raw.targetPositionM !== undefined ||
      raw.targetOrientationQuaternion !== undefined ||
      raw.impulseNs !== undefined
    )
      fail("Trajectory cannot also contain a target or impulse.");
    action.samples = samples(raw.samples);
    if (action.samples.at(-1)!.timeS > action.timeoutS)
      fail("Trajectory duration exceeds its timeout.");
    for (let i = 1; i < action.samples.length; i++) {
      const a = action.samples[i - 1]!,
        b = action.samples[i]!;
      const distance = Math.hypot(...b.positionM.map((v, axis) => v - a.positionM[axis]!));
      if (distance / (b.timeS - a.timeS) > action.maxSpeedMps + 1e-8)
        fail("Trajectory segment exceeds the maximum speed.");
    }
  } else {
    if (raw.samples !== undefined || raw.impulseNs !== undefined)
      fail("Move action cannot contain samples or an impulse.");
    action.targetPositionM = vector(raw.targetPositionM, "target position", 200);
    if (raw.targetOrientationQuaternion !== undefined)
      action.targetOrientationQuaternion = quaternion(raw.targetOrientationQuaternion);
  }
  return action;
}
export function validateMotionRegistry(input: unknown): MotionRegistryDocument {
  const text = canonicalStringify(input);
  if (new TextEncoder().encode(text).byteLength > MAX_MOTION_JSON_BYTES)
    throw new MotionError("MOTION_BUDGET", "Motion JSON exceeds 1 MiB.");
  const raw = object(JSON.parse(text));
  fields(raw, ["schemaVersion", "registryId", "revision", "scenePin", "actions"]);
  if (raw.schemaVersion !== "1.0.0") fail("Unsupported motion schema version.");
  if (!Array.isArray(raw.actions) || raw.actions.length > MAX_MOTION_ACTIONS)
    fail("Motion registry allows at most 64 actions.");
  const seen = new Set<string>();
  const actions = (raw.actions as unknown[]).map((entry) => {
    const action = object(entry);
    const { revision, generation, ...draft } = action;
    const normalized = createMotionAction(
      draft as unknown as MotionActionInput,
      revision as number,
      generation as number,
    );
    if (seen.has(normalized.actionId)) fail("Duplicate motion action ID.");
    seen.add(normalized.actionId);
    return normalized;
  });
  return {
    schemaVersion: "1.0.0",
    registryId: identifier(raw.registryId, "registry ID"),
    revision: integer(raw.revision, "registry revision", 0),
    scenePin: validateMotionScenePin(raw.scenePin),
    actions,
  };
}
export async function createMotionRegistry(scene: SceneSpec): Promise<MotionRegistryDocument> {
  return {
    schemaVersion: "1.0.0",
    registryId: "motion.registry",
    revision: 0,
    scenePin: await pinMotionScene(scene),
    actions: [],
  };
}
