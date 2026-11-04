/** Scalar-only observations. Unknown, unavailable, and invalid values become null. */
export interface RecordingAdvanceTimingInput {
  previousRafAtMs?: unknown;
  currentRafAtMs?: unknown;
  callbackAtMs?: unknown;
  deltaSeconds?: unknown;
  accumulatorBeforeSeconds?: unknown;
  accumulatorAfterSeconds?: unknown;
  steps?: unknown;
  tickBefore?: unknown;
  tickAfter?: unknown;
  overrun?: unknown;
  advanceElapsedMs?: unknown;
  onTickElapsedMs?: unknown;
  admissionElapsedMs?: unknown;
  publishElapsedMs?: unknown;
  hostFlushElapsedMs?: unknown;
}

export interface RecordingAdvanceTimingRow {
  readonly sequence: number;
  readonly previousRafAtMs: number | null;
  readonly currentRafAtMs: number | null;
  readonly callbackAtMs: number | null;
  readonly resumeWallMarkMs: number | null;
  readonly deltaSeconds: number | null;
  readonly accumulatorBeforeSeconds: number | null;
  readonly accumulatorAfterSeconds: number | null;
  readonly steps: number | null;
  readonly tickBefore: number | null;
  readonly tickAfter: number | null;
  readonly overrun: boolean | null;
  readonly advanceElapsedMs: number | null;
  readonly onTickElapsedMs: number | null;
  readonly admissionElapsedMs: number | null;
  readonly publishElapsedMs: number | null;
  readonly hostFlushElapsedMs: number | null;
}

export interface RecordingAdvanceDiagnosticsSnapshot {
  readonly captureSequence: number;
  readonly startTick: number | null;
  readonly startWallMarkMs: number | null;
  readonly latestResumeWallMarkMs: number | null;
  readonly advanceCount: number;
  readonly first: readonly RecordingAdvanceTimingRow[];
  readonly last: readonly RecordingAdvanceTimingRow[];
  readonly firstOverrun: RecordingAdvanceTimingRow | null;
}

type MutableTimingRow = {
  -readonly [Key in keyof RecordingAdvanceTimingRow]: RecordingAdvanceTimingRow[Key];
};

function emptyRow(): MutableTimingRow {
  return {
    sequence: 0,
    previousRafAtMs: null,
    currentRafAtMs: null,
    callbackAtMs: null,
    resumeWallMarkMs: null,
    deltaSeconds: null,
    accumulatorBeforeSeconds: null,
    accumulatorAfterSeconds: null,
    steps: null,
    tickBefore: null,
    tickAfter: null,
    overrun: null,
    advanceElapsedMs: null,
    onTickElapsedMs: null,
    admissionElapsedMs: null,
    publishElapsedMs: null,
    hostFlushElapsedMs: null,
  };
}

function nonnegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function read(
  input: RecordingAdvanceTimingInput | null,
  key: keyof RecordingAdvanceTimingInput,
): unknown {
  try {
    return input?.[key];
  } catch {
    // A failing observation must not turn an otherwise complete physics tick into an error.
    return undefined;
  }
}

function writeRow(
  target: MutableTimingRow,
  input: RecordingAdvanceTimingInput | null,
  sequence: number,
  resumeWallMarkMs: number | null,
): void {
  target.sequence = sequence;
  target.previousRafAtMs = nonnegative(read(input, "previousRafAtMs"));
  target.currentRafAtMs = nonnegative(read(input, "currentRafAtMs"));
  target.callbackAtMs = nonnegative(read(input, "callbackAtMs"));
  target.resumeWallMarkMs = resumeWallMarkMs;
  target.deltaSeconds = nonnegative(read(input, "deltaSeconds"));
  target.accumulatorBeforeSeconds = nonnegative(read(input, "accumulatorBeforeSeconds"));
  target.accumulatorAfterSeconds = nonnegative(read(input, "accumulatorAfterSeconds"));
  target.steps = integer(read(input, "steps"));
  target.tickBefore = integer(read(input, "tickBefore"));
  target.tickAfter = integer(read(input, "tickAfter"));
  const overrun = read(input, "overrun");
  target.overrun = typeof overrun === "boolean" ? overrun : null;
  target.advanceElapsedMs = nonnegative(read(input, "advanceElapsedMs"));
  target.onTickElapsedMs = nonnegative(read(input, "onTickElapsedMs"));
  target.admissionElapsedMs = nonnegative(read(input, "admissionElapsedMs"));
  target.publishElapsedMs = nonnegative(read(input, "publishElapsedMs"));
  target.hostFlushElapsedMs = nonnegative(read(input, "hostFlushElapsedMs"));
}

/** Copy only the fixed scalar whitelist, never a caller's objects or extra properties. */
function copyRow(target: MutableTimingRow, source: RecordingAdvanceTimingRow): void {
  target.sequence = source.sequence;
  target.previousRafAtMs = source.previousRafAtMs;
  target.currentRafAtMs = source.currentRafAtMs;
  target.callbackAtMs = source.callbackAtMs;
  target.resumeWallMarkMs = source.resumeWallMarkMs;
  target.deltaSeconds = source.deltaSeconds;
  target.accumulatorBeforeSeconds = source.accumulatorBeforeSeconds;
  target.accumulatorAfterSeconds = source.accumulatorAfterSeconds;
  target.steps = source.steps;
  target.tickBefore = source.tickBefore;
  target.tickAfter = source.tickAfter;
  target.overrun = source.overrun;
  target.advanceElapsedMs = source.advanceElapsedMs;
  target.onTickElapsedMs = source.onTickElapsedMs;
  target.admissionElapsedMs = source.admissionElapsedMs;
  target.publishElapsedMs = source.publishElapsedMs;
  target.hostFlushElapsedMs = source.hostFlushElapsedMs;
}

function snapshotRow(row: RecordingAdvanceTimingRow): Readonly<RecordingAdvanceTimingRow> {
  return Object.freeze({ ...row });
}

/**
 * Fixed storage for eight initial advances, two recent advances and the first
 * overrun. record() reuses exactly eleven scalar row objects. Only explicit
 * snapshot() reads allocate the bounded detached output DTOs.
 */
export class RecordingAdvanceDiagnostics {
  private readonly firstRows = Array.from({ length: 8 }, () => emptyRow());
  private readonly lastRows: readonly [MutableTimingRow, MutableTimingRow] = [
    emptyRow(),
    emptyRow(),
  ];
  private readonly overrunRow = emptyRow();
  private captureSequence = 0;
  private startTick: number | null = null;
  private startWallMarkMs: number | null = null;
  private latestResumeWallMarkMs: number | null = null;
  private advanceCount = 0;
  private hasOverrun = false;

  startCapture(startTick: number, wallMarkMs: number | null): void {
    this.captureSequence++;
    this.startTick = integer(startTick);
    this.startWallMarkMs = nonnegative(wallMarkMs);
    this.latestResumeWallMarkMs = null;
    this.advanceCount = 0;
    this.hasOverrun = false;
    for (const row of this.firstRows) writeRow(row, null, 0, null);
    for (const row of this.lastRows) writeRow(row, null, 0, null);
    writeRow(this.overrunRow, null, 0, null);
  }

  /** Changing the resume boundary does not discard earlier timing evidence. */
  markResumed(wallMs: number | null): void {
    this.latestResumeWallMarkMs = nonnegative(wallMs);
  }

  record(row: RecordingAdvanceTimingInput): void {
    const sequence = ++this.advanceCount;
    const recent = this.lastRows[(sequence - 1) % 2]!;
    const target = sequence <= 8 ? this.firstRows[sequence - 1]! : recent;
    const input = row !== null && typeof row === "object" ? row : null;
    writeRow(target, input, sequence, this.latestResumeWallMarkMs);
    if (target !== recent) copyRow(recent, target);
    if (!this.hasOverrun && target.overrun === true) {
      copyRow(this.overrunRow, target);
      this.hasOverrun = true;
    }
  }

  /** Add the host observation only to copies of the most recent advance. */
  markHostFlush(elapsedMs: unknown): void {
    if (this.advanceCount === 0) return;
    const value = nonnegative(elapsedMs);
    for (let index = 0; index < this.firstRows.length; index++) {
      const row = this.firstRows[index]!;
      if (row.sequence === this.advanceCount) row.hostFlushElapsedMs = value;
    }
    for (let index = 0; index < this.lastRows.length; index++) {
      const row = this.lastRows[index]!;
      if (row.sequence === this.advanceCount) row.hostFlushElapsedMs = value;
    }
    if (this.hasOverrun && this.overrunRow.sequence === this.advanceCount)
      this.overrunRow.hostFlushElapsedMs = value;
  }

  snapshot(): Readonly<RecordingAdvanceDiagnosticsSnapshot> {
    const first = this.firstRows.slice(0, Math.min(this.advanceCount, 8)).map(snapshotRow);
    const lastCount = Math.min(this.advanceCount, 2);
    const last: RecordingAdvanceTimingRow[] = [];
    for (let index = 0; index < lastCount; index++) {
      const row = this.lastRows[(this.advanceCount - lastCount + index) % 2]!;
      last.push(snapshotRow(row));
    }
    return Object.freeze({
      captureSequence: this.captureSequence,
      startTick: this.startTick,
      startWallMarkMs: this.startWallMarkMs,
      latestResumeWallMarkMs: this.latestResumeWallMarkMs,
      advanceCount: this.advanceCount,
      first: Object.freeze(first),
      last: Object.freeze(last),
      firstOverrun: this.hasOverrun ? snapshotRow(this.overrunRow) : null,
    });
  }
}
