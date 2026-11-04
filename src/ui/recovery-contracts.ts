export interface RecordingRecoveryEntryView {
  readonly sessionId: string;
  readonly runId: string;
  readonly runEpoch: string;
  readonly sceneRevision: number;
  readonly state: "staging" | "interrupted";
  readonly persistedFrames: number;
  readonly persistedTick: number | null;
  readonly reservedBytes: number;
  readonly reason: string | null;
  readonly leaseExpiresAt: number;
  readonly canRecover: boolean;
  readonly canDiscard: boolean;
}

/** A live producer remains authoritative even if a stale capability says otherwise. */
export function recordingRecoveryActions(entry: RecordingRecoveryEntryView, now = Date.now()) {
  const activeLease = entry.state === "staging" && entry.leaseExpiresAt > now;
  return {
    activeLease,
    canRecover: !activeLease && entry.canRecover && entry.persistedFrames > 0,
    canDiscard: !activeLease && entry.canDiscard,
  };
}

/** Archive cleanup never infers that a writer is dead from a stale status alone. */
export function archiveRemovalActions(entry: {
  readonly status: "writing" | "published" | "interrupted";
  readonly activeWriter: boolean;
  readonly canDiscard: boolean;
}) {
  const canRemove =
    !entry.activeWriter &&
    (entry.status === "published" || (entry.status === "interrupted" && entry.canDiscard));
  return {
    canRemove,
    reason: canRemove
      ? null
      : entry.activeWriter
        ? ("activeWriter" as const)
        : ("needsRecovery" as const),
  };
}
