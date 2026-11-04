import type { BodyMode, Quaternion, SceneSpec, Vec3 } from "../scene/types.js";
import type { BodyPose } from "../physics/types.js";

export interface MotionScenePin {
  sceneId: string;
  sceneRevision: number;
  sceneHash: string;
}
export interface MotionSample {
  timeS: number;
  positionM: Vec3;
  orientationQuaternion: Quaternion;
}
export type MotionKind = "moveTo" | "moveAndRelease" | "impulse" | "trajectory";
export type MotionReleasePolicy = "preserve" | "zero" | "transfer";
export interface MotionActionInput {
  actionId: string;
  objectId: string;
  kind: MotionKind;
  targetPositionM?: Vec3;
  targetOrientationQuaternion?: Quaternion;
  samples?: MotionSample[];
  impulseNs?: Vec3;
  maxSpeedMps?: number;
  maxAccelerationMps2?: number;
  maxImpulseNs?: number;
  maxAngularSpeedRadps?: number;
  maxTorqueImpulseNms?: number;
  timeoutS?: number;
  positionToleranceM?: number;
  velocityToleranceMps?: number;
  settleTicks?: number;
  releasePolicy?: MotionReleasePolicy;
  releaseMode?: "dynamicGravity" | "dynamicNoGravity";
  source?: "user" | "ai";
}
export interface MotionAction extends MotionActionInput {
  revision: number;
  generation: number;
  maxSpeedMps: number;
  maxAccelerationMps2: number;
  maxImpulseNs: number;
  maxAngularSpeedRadps: number;
  maxTorqueImpulseNms: number;
  timeoutS: number;
  positionToleranceM: number;
  velocityToleranceMps: number;
  settleTicks: number;
  releasePolicy: MotionReleasePolicy;
  releaseMode: "dynamicGravity" | "dynamicNoGravity";
  source: "user" | "ai";
}
export interface MotionRegistryDocument {
  schemaVersion: "1.0.0";
  registryId: string;
  revision: number;
  scenePin: MotionScenePin;
  actions: MotionAction[];
}
export type MotionRunStatus =
  | "pending"
  | "running"
  | "reached"
  | "applied"
  | "blocked"
  | "timedOut"
  | "cancelled"
  | "invalidated";
export interface MotionRunReceipt {
  runId: string;
  commandId: string;
  actionId: string;
  actionRevision: number;
  registryRevision: number;
  scenePin: MotionScenePin;
  objectId: string;
  generation: number;
  startTick: number;
  endTick: number | null;
  elapsedTicks: number;
  status: MotionRunStatus;
  reason: string | null;
  before: BodyPose;
  after: BodyPose | null;
  acceptedLinearVelocityMps: Vec3;
  acceptedAngularVelocityRadps: Vec3;
  releasePolicy: MotionReleasePolicy;
  originalMode: BodyMode;
}
export interface MotionWorkspaceView {
  document: MotionRegistryDocument;
  runs: MotionRunReceipt[];
  activeRunIds: string[];
  stale: boolean;
  canUndo: boolean;
  canRedo: boolean;
}
export interface MotionWorkspaceOptions {
  getScene(): SceneSpec;
  onChange?(): void;
}
export class MotionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MotionError";
  }
}
