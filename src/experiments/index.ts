export * from "./types.js";
export { canonicalStringify, canonicalBytes, immutableClone, sha256Canonical } from "./hash.js";
export { ExperimentRecorder, verifyRecording, recordingFingerprints } from "./recorder.js";
export { MotionReplay, createMotionReplay } from "./replay.js";
export { compareRecordings, computeRecordingMetrics } from "./comparison.js";
export {
  collectRecordingPathSamples,
  compatiblePathMetricPopulation,
  pathMetricPopulation,
} from "./metrics.js";
export type { RecordingPathSamples } from "./metrics.js";
export { reprocessRecording } from "./reprocess.js";
export type { ReprocessConfiguration, ReprocessedFrame } from "./reprocess.js";
