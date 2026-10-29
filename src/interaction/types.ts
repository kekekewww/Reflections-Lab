import type { PhysicsWorld, RaycastHit } from "../physics/index.js";
import type {
  BodyMode,
  Quaternion,
  SceneObject,
  SceneOperation,
  SceneSpec,
  Vec3,
} from "../scene/types.js";

export type InteractionMode = "editor" | "fps-interact" | "fps-build";
export interface CameraPose {
  positionM: Vec3;
  orientationQuaternion: Quaternion;
}
export interface GhostPreview {
  draft: SceneObject;
  valid: boolean;
  reason: string;
  blockingObjectIds: string[];
  surfaceObjectId: string | null;
  stage: "preview" | "pending";
}
export interface StagedPlacement {
  objectId: string;
  desiredMode: BodyMode;
  sceneRevision: number;
  geometryAcknowledged: boolean;
}
export interface InteractionSnapshot {
  mode: InteractionMode;
  pointerLocked: boolean;
  /** Explicit keyboard/button control choice; never implies browser Pointer Lock. */
  alternativeInput: boolean;
  suspended: boolean;
  pauseReason: string | null;
  camera: CameraPose;
  hover: RaycastHit | null;
  heldObjectId: string | null;
  holdDistanceM: number;
  rotating: boolean;
  ghost: GhostPreview | null;
  staged: StagedPlacement | null;
  notice: string | null;
  pending: boolean;
}
export interface InteractionHostOptions {
  getWorld(): PhysicsWorld;
  getScene(): SceneSpec;
  /** Optional copied authoring listener pose for camera reads without a full Scene projection. */
  getListenerPose?(): CameraPose;
  /**
   * Validates revision and atomically updates the document and physics host.
   * Run this trusted local guard after asynchronous preparation and the final
   * revision check, immediately before applying the candidate to the world.
   */
  commitSceneOperations(operations: SceneOperation[], guard?: () => void): Promise<void>;
  onChange?(): void;
  onPause?(reason: string): void;
  onAudioFade?(reason: string): void;
  onLibrary?(): void;
  onNotice?(message: string): void;
  /** Optional actual backend acknowledgement; absent means explicit acknowledgeStaged is required. */
  confirmGeometry?(objectId: string, sceneRevision: number): boolean | Promise<boolean>;
  lookSensitivity?: number;
  throwImpulseNs?: number;
  /** Defaults to the independent Scene listener position minus the 1.60m eye height. */
  spawnFootPositionM?: Vec3;
}

export class InteractionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InteractionError";
    this.code = code;
  }
}
