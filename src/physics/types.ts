import type { BodyMode, Quaternion, SceneObject, Vec3 } from "../scene/types.js";
import type { ContactData } from "../../schemas/sound-behavior/types.js";

export interface PhysicsEvent {
  eventId: string;
  tick: number;
  sequence: number;
  sceneRevision: number;
  simulationTimeSeconds: number;
  fixedDtSeconds: number;
  objectId: string;
  generation: number;
  type:
    | "OnGrab"
    | "OnRelease"
    | "OnThrow"
    | "OnDrop"
    | "OnImpact"
    | "OnStartMoving"
    | "OnStopMoving"
    | "OnSleep"
    | "OnWake"
    | "ContactBegin"
    | "ContactEnd"
    | "ContactInvalidated"
    | "BodyModeChanged";
  source: "interaction" | "physics" | "state";
  accepted: boolean;
  positionMetres: Vec3;
  commandId?: string;
  otherObjectId?: string;
  impulseNs?: number;
  contact?: ContactData;
  reason?: string;
}

export interface BodyPose {
  objectId: string;
  generation: number;
  positionMetres: Vec3;
  rotation: Quaternion;
  linearVelocityMetresPerSecond: Vec3;
  angularVelocityRadiansPerSecond: Vec3;
  mode: BodyMode;
  sleeping: boolean;
  moving: boolean;
  airborne: boolean;
  held: boolean;
  rolling: boolean | null;
  sliding: boolean | null;
  spinning: boolean;
  enabled: boolean;
  lifecycle: "active" | "staged";
  discontinuity: boolean;
  contact?: ContactData;
}

export interface GrabDiagnostics {
  objectId: string;
  targetMetres: Vec3;
  trackingErrorMetres: number;
  impulseNewtonSeconds: Vec3;
  torqueImpulseNewtonMetreSeconds: Vec3;
  saturated: boolean;
  blocked: boolean;
}

export interface PlayerPose {
  positionMetres: Vec3;
  eyePositionMetres: Vec3;
  grounded: boolean;
}

export interface PhysicsSnapshot {
  tick: number;
  simulationTimeSeconds: number;
  fixedDtSeconds: number;
  sceneRevision: number;
  epoch: number;
  paused: boolean;
  poses: BodyPose[];
  events: PhysicsEvent[];
  heldObjectId: string | null;
  grabDiagnostics: GrabDiagnostics | null;
  player: PlayerPose | null;
}

export interface PhysicsOptions {
  fixedDtSeconds?: number;
  maxCatchUpSteps?: number;
  clockMode?: "interactive" | "recording";
  impactMinImpulseNs?: number;
  impactMinClosingSpeedMps?: number;
  impactCooldownSeconds?: number;
}

export interface PlacementResult {
  valid: boolean;
  reason: "VALID" | "OUT_OF_BOUNDS" | "OVERLAP";
  blockingObjectIds: string[];
}

export interface RaycastHit {
  objectId: string;
  pointMetres: Vec3;
  normal: Vec3;
  distanceMetres: number;
  grabbable: boolean;
}

export interface PhysicsBodyRecord {
  definition: SceneObject;
  generation: number;
  enabled: boolean;
  discontinuityUntilTick: number;
}
