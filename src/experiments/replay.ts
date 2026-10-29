import { immutableClone } from "./hash.js";
import { verifyRecording } from "./recorder.js";
import { RecordingError } from "./types.js";
import type { RecordingArtifact, RecordingFrame, ReplayFrame, ReplayMode } from "./types.js";

/** Replays captured authoritative input, never asks the physics engine to recreate it. */
export class MotionReplay {
  private readonly recording: RecordingArtifact;
  private readonly mode: ReplayMode;
  private cursor = 0;
  private epochSequence = 1;
  private readonly sessionId = globalThis.crypto.randomUUID().replaceAll("-", "");
  private paused = false;

  private constructor(recording: RecordingArtifact, mode: ReplayMode) {
    this.recording = immutableClone(recording);
    this.mode = mode;
  }
  static async create(
    recording: RecordingArtifact,
    options: { mode?: ReplayMode } = {},
  ): Promise<MotionReplay> {
    await verifyRecording(recording);
    if (recording.status !== "captured")
      throw new RecordingError("INCOMPLETE_RECORDING", "不完整或已取消的錄製不能宣稱完整 replay。");
    if (
      options.mode !== undefined &&
      !["recordedOutput", "behaviorReevaluation"].includes(options.mode)
    )
      throw new RecordingError("REPLAY_MODE", "不支援的重播模式。");
    return new MotionReplay(recording, options.mode ?? "recordedOutput");
  }
  private epoch(): string {
    return `replay.${this.sessionId}.${this.epochSequence}`;
  }
  private output(frame: RecordingFrame, emitEvents: boolean): ReplayFrame {
    return immutableClone({
      ...frame,
      sourceRunEpoch: this.recording.runEpoch,
      replayEpoch: this.epoch(),
      emitEvents,
      behaviorDecisions: this.mode === "recordedOutput" ? frame.behaviorDecisions : [],
      audioEvents: this.mode === "recordedOutput" ? frame.audioEvents : [],
    });
  }
  next(): ReplayFrame | null {
    if (this.paused) return null;
    const frame = this.recording.frames[this.cursor];
    if (!frame) return null;
    this.cursor += 1;
    return this.output(frame, true);
  }
  /** Seeking exposes the pose for preview, but never schedules its past impact again. */
  seek(tick: number): ReplayFrame {
    if (!Number.isSafeInteger(tick))
      throw new RecordingError("SEEK_TICK", "Seek 必須使用整數 physics tick。");
    const index = this.recording.frames.findIndex((frame) => frame.tick === tick);
    if (index < 0) throw new RecordingError("SEEK_RANGE", "Seek tick 不在錄製範圍。");
    this.epochSequence += 1;
    this.cursor = index + 1;
    return this.output(this.recording.frames[index]!, false);
  }
  reset(): void {
    this.epochSequence += 1;
    this.cursor = 0;
    this.paused = false;
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }
  getState(): {
    cursor: number;
    frameCount: number;
    runEpoch: string;
    mode: ReplayMode;
    paused: boolean;
    ended: boolean;
    nextTick: number | null;
  } {
    return {
      cursor: this.cursor,
      frameCount: this.recording.frameCount,
      runEpoch: this.epoch(),
      mode: this.mode,
      paused: this.paused,
      ended: this.cursor >= this.recording.frameCount,
      nextTick: this.recording.frames[this.cursor]?.tick ?? null,
    };
  }
}

export const createMotionReplay = MotionReplay.create;
