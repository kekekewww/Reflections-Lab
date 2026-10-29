import { ExperimentRecorder, verifyRecording } from "./recorder.js";
import { immutableClone } from "./hash.js";
import { RecordingError } from "./types.js";
import type {
  ExperimentRecorderOptions,
  RecordingArtifact,
  RecordingFrame,
  RecordingFrameInput,
} from "./types.js";

export type ReprocessConfiguration = Pick<ExperimentRecorderOptions, "runId"> &
  Partial<
    Pick<
      ExperimentRecorderOptions,
      | "sceneSnapshot"
      | "sourceConfig"
      | "behaviorConfig"
      | "solverConfig"
      | "atmosphere"
      | "materialRegistry"
      | "assetManifest"
      | "generatorConfig"
    >
  >;
export type ReprocessedFrame = Pick<RecordingFrameInput, "behaviorDecisions" | "audioEvents"> &
  Pick<Partial<RecordingFrameInput>, "acousticFrames" | "acousticResultRefs" | "behaviorSnapshot">;

/** Host supplies real behavior/solver processing. Raw motion/player inputs cannot be replaced. */
export async function reprocessRecording(
  original: RecordingArtifact,
  changes: ReprocessConfiguration,
  processFrame: (
    frame: RecordingFrame,
    configuration: ReprocessConfiguration,
  ) => ReprocessedFrame | Promise<ReprocessedFrame>,
): Promise<RecordingArtifact> {
  await verifyRecording(original);
  if (original.status !== "captured")
    throw new RecordingError("INCOMPLETE_RECORDING", "只能重評完整 Captured trace。");
  if (typeof processFrame !== "function")
    throw new RecordingError(
      "REPROCESSOR_REQUIRED",
      "A/B candidate 必須實際重評 behavior／聲學，不能沿用舊結果冒充新條件。",
    );
  const config = original.configuration;
  const recorder = new ExperimentRecorder({
    ...config,
    ...changes,
    runEpoch: changes.runId,
    createdAt: new Date().toISOString(),
  });
  for (const frame of original.frames) {
    const output = await processFrame(immutableClone(frame), immutableClone(changes));
    if (!output || !Array.isArray(output.behaviorDecisions) || !Array.isArray(output.audioEvents))
      throw new RecordingError("REPROCESS_RESULT", "重評回傳必須有實際 decisions／audio events。");
    recorder.appendFrame({
      tick: frame.tick,
      sceneRevision: changes.sceneSnapshot?.sceneRevision ?? config.sceneSnapshot.sceneRevision,
      runEpoch: changes.runId,
      poses: frame.poses,
      listener: frame.listener,
      physicsEvents: frame.physicsEvents,
      behaviorDecisions: output.behaviorDecisions,
      audioEvents: output.audioEvents,
      ...(output.acousticFrames !== undefined ? { acousticFrames: output.acousticFrames } : {}),
      ...(output.acousticResultRefs !== undefined
        ? { acousticResultRefs: output.acousticResultRefs }
        : {}),
      ...(output.behaviorSnapshot !== undefined
        ? { behaviorSnapshot: output.behaviorSnapshot }
        : {}),
    });
  }
  return recorder.finish();
}
