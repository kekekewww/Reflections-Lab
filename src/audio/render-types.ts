import type { AudioAssetBankEntry, LateReverbSettings } from "./types.js";
import type { RecordingArtifact } from "../experiments/types.js";
import type { RenderJob, RenderResult } from "./render-contract.js";

export interface RenderMasterSettings {
  headroomGain: number;
  monitorGain: number;
  limiterEnabled: boolean;
  outputSafetyClip: boolean;
  lateReverb: LateReverbSettings;
}
export interface RenderConfiguration {
  schemaVersion: "native-offline-render-config-v1";
  recordingConfigurationSha256: string;
  assets: { assetId: string; revision: number; sha256: string | null }[];
  master: RenderMasterSettings;
  /** Web Audio 1.0 render-control grid. Every actual suspension is checked and recorded. */
  controlQuantumFrames: 128;
}
export interface RenderInput {
  recording: RecordingArtifact;
  configuration: RenderConfiguration;
  assetBank: readonly AudioAssetBankEntry[];
}
export interface RenderFile {
  id: string;
  filename: string;
  mediaType: "audio/wav";
  bytes: Uint8Array<ArrayBuffer>;
  sha256: string;
}
export interface RenderControlObservation {
  tick: number;
  requestedSample: number;
  actualControlSample: number;
  /** Native AudioParam controls update here; source onsets retain the emission epoch. */
  controlOffsetFrames: number;
}
export interface RenderExportManifest {
  schemaVersion: "render-export-manifest-v1";
  job: RenderJob;
  configuration: RenderConfiguration;
  result: Extract<RenderResult, { status: "completed" }>;
  files: { id: string; filename: string; sha256: string; bytes: number }[];
  controlObservations: RenderControlObservation[];
  semantics: {
    dryContent: string;
    propagatedMix: string;
    stems: string;
    master: string;
  };
}
export const DEFAULT_RENDER_MASTER: Readonly<RenderMasterSettings> = Object.freeze({
  headroomGain: 10 ** (-6 / 20),
  monitorGain: 1,
  limiterEnabled: true,
  outputSafetyClip: true,
  lateReverb: { enabled: false, decaySeconds: 1.2, wetGain: 0.15, seed: 1 },
});
