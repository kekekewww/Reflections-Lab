import { DEFAULT_AUDIO_BUDGET } from "../../../../src/audio/control.js";
import { DEFAULT_NATIVE_VOICE_POLICY } from "../../../../src/audio/virtual-policy.js";
import type { AcousticFrame, VoiceInput, VoiceUpdate } from "../../../../src/audio/types.js";

export const BUDGET = Object.freeze({
  ...DEFAULT_AUDIO_BUDGET,
  maxPathsPerVoice: 32,
  maxTotalPaths: 256,
});
export const POLICY = Object.freeze({ ...DEFAULT_NATIVE_VOICE_POLICY });
export const PROVENANCE =
  "Synthetic (project-authored test fixture), not a licensed external sample";
export const GENERATOR_SOURCE = "tests/app/asset-residency.test.ts";
export const PCM_TOLERANCE = 2e-6;
export type Operation =
  | { kind: "start"; input: VoiceInput; frame: AcousticFrame; stale: boolean }
  | { kind: "update"; id: string; update: VoiceUpdate }
  | { kind: "frame"; frame: AcousticFrame }
  | { kind: "stop"; id: string; fade?: number };
export interface CorpusTick {
  tick: number;
  time: number;
  operations: Operation[];
  physicsEvents: unknown[];
  decisions: unknown[];
  audioEvents: unknown[];
  voiceIntents: unknown[];
}
export interface Corpus {
  version: "voice-asset-runtime-v1";
  method: string;
  budget: typeof BUDGET;
  ticks: CorpusTick[];
  recording: unknown[];
}
export function apply(
  engine: import("../../../../src/audio/engine.js").AudioEngine,
  op: Operation,
) {
  if (op.kind === "start") return engine.playVoice(op.input, op.frame, op.stale);
  if (op.kind === "update") return engine.updateVoice(op.id, op.update);
  if (op.kind === "frame") return engine.updateFrame(op.frame);
  return engine.stopVoice(op.id, op.fade);
}
export interface WaveFixture {
  assetId: string;
  name: string;
  sample: number;
  frames: number;
  rate: number;
  channels: number;
  sha256: string;
  bytes: ArrayBuffer;
}
