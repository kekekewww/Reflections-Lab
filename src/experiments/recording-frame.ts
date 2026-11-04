import { canonicalStringify, immutableCloneWithCanonicalBytes } from "./hash.js";
import type { RecordingFrame, RecordingFrameInput } from "./types.js";

interface OwnedFrame {
  captured: Readonly<{ value: RecordingFrame; byteLength: number }>;
  bytes?: ArrayBuffer;
}

// Only this module's canonical clones are reusable. Object.isFrozen alone does
// not prove deep ownership, plain JSON, or that defaults have been normalized.
const ownedFrames = new WeakMap<RecordingFrameInput, OwnedFrame>();

export function ownRecordingFrame(
  input: RecordingFrameInput,
  runEpoch: string,
): Readonly<{
  value: RecordingFrame;
  byteLength: number;
}> {
  const previous = ownedFrames.get(input);
  if (previous) return previous.captured;
  const captured = immutableCloneWithCanonicalBytes({
    ...input,
    runEpoch: input.runEpoch ?? runEpoch,
    acousticFrames: input.acousticFrames ?? [],
    acousticResultRefs: input.acousticResultRefs ?? [],
  });
  const result = Object.freeze({
    value: captured.value,
    byteLength: captured.bytes.byteLength,
  });
  const owned = {
    captured: result,
    bytes: captured.bytes,
  };
  ownedFrames.set(result.value, owned);
  return result;
}

/** Transfer the private buffer to storage; recorder history retains no encoded buffers. */
export function takeRecordingFrameBytes(frame: RecordingFrame): ArrayBuffer {
  const owned = ownedFrames.get(frame);
  if (owned?.bytes) {
    const bytes = owned.bytes;
    delete owned.bytes;
    return bytes;
  }
  // A different object (including a caller-frozen frame), or a second storage
  // owner, must encode again. Never trust a supplied size or share mutable bytes.
  return new TextEncoder().encode(canonicalStringify(frame)).buffer;
}

/** Keep captures without storage from retaining a buffer for every historical frame. */
export function discardRecordingFrameBytes(frame: RecordingFrame | undefined): void {
  const owned = frame && ownedFrames.get(frame);
  if (owned) delete owned.bytes;
}
