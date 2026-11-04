export type Vector3 = [number, number, number];
export type Vec3 = Vector3;
export type Quaternion = [number, number, number, number];
export type BodyMode = "dynamicGravity" | "dynamicNoGravity" | "fixed" | "kinematic";
export type PrimitiveShape = "box" | "sphere" | "capsule";
export type AcousticRole = "none" | "staticSurface" | "dynamicOccluder" | "dynamicReflector";

export interface ObjectTrajectory {
  /** 1..63 entries, each relative to the object's positionM. */
  offsetsM: Vector3[];
  /** 0.5..20 m/s. */
  strengthMps: number;
  /** 0..30 s. */
  startDelayS: number;
  faceAlongPath: boolean;
}

export const TRAJECTORY_LIMITS = {
  maxOffsets: 63,
  minStrengthMps: 0.5,
  maxStrengthMps: 20,
  defaultStrengthMps: 3,
  maxStartDelayS: 30,
  maxDurationS: 30,
  maxPathsPerTake: 8,
} as const;

export interface SceneObject {
  id: string;
  shape: PrimitiveShape;
  dimensionsM: Vector3;
  positionM: Vector3;
  orientationQuaternion: Quaternion;
  mode: BodyMode;
  massKg: number;
  friction: number;
  restitution: number;
  physicsMaterialId: string;
  acousticMaterialId: string;
  acousticRole: AcousticRole;
  trajectory?: ObjectTrajectory;
}

export interface SceneSource {
  id: string;
  objectId: string;
  signalId: string;
  mode: "continuous" | "impact";
  gainDbfs: number;
  playing: boolean;
}

export interface SceneListener {
  id: string;
  positionM: Vector3;
  orientationQuaternion: Quaternion;
  attachment: "independent" | "fpsHead";
}

export interface SceneZoneBase {
  id: string;
  name: string;
  enabled: boolean;
  centerM: Vector3;
  hysteresisM: number;
}

/** Static authored volume; occupancy uses body centres, not collider/sensor overlap. */
export type SceneZone = SceneZoneBase &
  ({ shape: "aabb"; halfExtentsM: Vector3 } | { shape: "sphere"; radiusM: number });

export interface SceneSpec {
  schemaVersion: "1.0.0";
  sceneId: string;
  sceneRevision: number;
  units: "SI";
  coordinateSystem: "right-handed-y-up-minus-z-forward";
  seed: number;
  gravityMps2: Vector3;
  objects: SceneObject[];
  sources: SceneSource[];
  listener: SceneListener;
  /** Omitted legacy zones remain omitted through validation, cloning and serialization. */
  zones?: SceneZone[];
}

export type SceneOperation =
  | {
      type: "SetTransform";
      objectId: string;
      positionM: Vector3;
      orientationQuaternion: Quaternion;
    }
  | { type: "AddObject"; object: SceneObject }
  | { type: "RemoveObject"; objectId: string }
  | { type: "UpdateObject"; objectId: string; patch: UpdateObjectPatch }
  | { type: "SetObjectMode"; objectId: string; mode: BodyMode }
  | {
      type: "SetPhysics";
      objectId: string;
      massKg?: number;
      friction?: number;
      restitution?: number;
    }
  | {
      type: "SetMaterial";
      objectId: string;
      physicsMaterialId?: string;
      acousticMaterialId?: string;
      acousticRole?: AcousticRole;
    }
  | { type: "SetGeometry"; objectId: string; shape: PrimitiveShape; dimensionsM: Vector3 }
  | { type: "AddSource"; source: SceneSource }
  | { type: "SetSource"; source: SceneSource }
  | { type: "UpdateSource"; sourceId: string; patch: Partial<Omit<SceneSource, "id">> }
  | { type: "RemoveSource"; sourceId: string }
  | { type: "SetListener"; listener: SceneListener }
  | { type: "SetGravity"; gravityMps2: Vector3 }
  | { type: "AddZone"; zone: SceneZone }
  | { type: "UpdateZone"; zone: SceneZone }
  | { type: "RemoveZone"; zoneId: string }
  /** null restores the absence of the optional property, unlike an explicitly authored empty array. */
  | { type: "SetZones"; zones: SceneZone[] | null }
  | {
      type: "RestoreObject";
      object: SceneObject;
      index: number;
      sources: { source: SceneSource; index: number }[];
    }
  | { type: "RestoreSource"; source: SceneSource; index: number };

/** `trajectory: null` deletes the key. */
export type UpdateObjectPatch = Partial<Omit<SceneObject, "id" | "trajectory">> & {
  trajectory?: ObjectTrajectory | null;
};

export interface SceneCommand {
  expectedSceneRevision: number;
  operations: SceneOperation[];
}

export interface SceneCommandResult {
  scene: SceneSpec;
  inverse: SceneCommand;
}
