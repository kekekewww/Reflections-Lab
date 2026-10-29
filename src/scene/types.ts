export type Vector3 = [number, number, number];
export type Vec3 = Vector3;
export type Quaternion = [number, number, number, number];
export type BodyMode = "dynamicGravity" | "dynamicNoGravity" | "fixed" | "kinematic";
export type PrimitiveShape = "box" | "sphere" | "capsule";
export type AcousticRole = "none" | "staticSurface" | "dynamicOccluder" | "dynamicReflector";

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
  | { type: "UpdateObject"; objectId: string; patch: Partial<Omit<SceneObject, "id">> }
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
  | {
      type: "RestoreObject";
      object: SceneObject;
      index: number;
      sources: { source: SceneSource; index: number }[];
    }
  | { type: "RestoreSource"; source: SceneSource; index: number };

export interface SceneCommand {
  expectedSceneRevision: number;
  operations: SceneOperation[];
}

export interface SceneCommandResult {
  scene: SceneSpec;
  inverse: SceneCommand;
}
