import type { SceneSpec } from "../scene/types.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";

export interface ProjectAsset {
  assetId: string;
  revision: number;
  sha256: string;
  /** Missing only on legacy v1 metadata; it does not establish decoded availability. */
  hashKind?: "encodedBytesSha256" | "canonicalDescriptorSha256" | "float32MonoPcmBytesSha256";
  name: string;
  mimeType: string;
  byteLength: number;
  /** Descriptors and external references are not evidence that audio is decoded. */
  storage: "generatedDescriptor" | "externalFile";
  rights: { license: string; source: string; attribution?: string };
  generator?: {
    algorithm:
      | "tone-v1"
      | "noise-v1"
      | "impulse-v1"
      | "builtin-tone-v1"
      | "builtin-impact-v1"
      | "builtin-whoosh-v1";
    durationSeconds: number;
    sampleRateHz: 44100 | 48000;
    frequencyHz?: number;
    seed?: number;
  };
}

export interface RecordingReference {
  runId: string;
  sha256: string;
  status: "captured" | "interrupted";
  frameCount: number;
  durationSeconds: number;
  storage: "externalArtifact";
}

/** Versioned authoring labels/reference context; none of these fields change frozen Scene v1 or acoustic results. */
export interface ProjectEditorMetadata {
  schemaVersion: "1.0.0";
  revision: number;
  sceneLabel?: string;
  objectLabels: { objectId: string; label: string }[];
  sourceReferences: { sourceId: string; referenceFrequencyHz: number }[];
}

export interface ProjectDocument {
  schemaVersion: "1.0.0";
  projectId: string;
  revision: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  scene: SceneSpec;
  soundBehaviors: SoundBehaviorDocument;
  assets: ProjectAsset[];
  recordings: RecordingReference[];
  /** Stable selected run. Legacy v1 files omit this; the importing host owns its explicit compatibility fallback. */
  activeRecordingId?: string;
  editorMetadata?: ProjectEditorMetadata;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class ProjectError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "ProjectError";
    this.code = code;
  }
}
