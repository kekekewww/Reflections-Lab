/** Main-thread wall observations only; these are not storage-engine CPU timings. */
export function recordingCommitTime(): number | null {
  try {
    return scalar(globalThis.performance?.now());
  } catch {
    return null;
  }
}

function scalar(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function recordingCommitElapsed(start: number | null, end: number | null): number | null {
  return scalar(start) !== null && scalar(end) !== null && end! >= start! ? end! - start! : null;
}

export interface RecordingCommitObserver {
  begin(): void;
  mark(field: string, value: unknown): void;
}

/** Even an observer replaced by a throwing test double cannot affect the operation. */
export function beginRecordingCommit(observer: RecordingCommitObserver | undefined): void {
  try {
    observer?.begin();
  } catch {
    // Observations never participate in admission, ordering, or durability.
  }
}

export function observeRecordingCommit(
  observer: RecordingCommitObserver | undefined,
  field: string,
  value: unknown,
): void {
  try {
    observer?.mark(field, value);
  } catch {
    // Keep the original success or failure authoritative.
  }
}

export type RecordingCommitRow<Field extends string> = Readonly<
  // completed describes only this observed call: null in flight, false on failure.
  // In particular an evaluation commit is not evidence of persistence/publication.
  { sequence: number; completed: boolean | null } & Record<Field, number | null>
>;
interface MutableRow {
  sequence: number;
  completed: boolean | null;
  [field: string]: number | boolean | null;
}
export interface RecordingCommitRows<Field extends string> {
  readonly count: number;
  readonly first: readonly RecordingCommitRow<Field>[];
  readonly last: readonly RecordingCommitRow<Field>[];
}

/** Ten preallocated scalar rows. In-flight updates are visible; only snapshot allocates DTOs. */
class BoundedCommitRows<Field extends string> implements RecordingCommitObserver {
  private readonly firstRows: MutableRow[];
  private readonly lastRows: MutableRow[];
  private count = 0;

  constructor(private readonly fields: readonly Field[]) {
    const empty = () => {
      const row: MutableRow = { sequence: 0, completed: null };
      for (const field of fields) row[field] = null;
      return row;
    };
    this.firstRows = Array.from({ length: 8 }, empty);
    this.lastRows = Array.from({ length: 2 }, empty);
  }

  begin(): void {
    const sequence = ++this.count;
    const recent = this.lastRows[(sequence - 1) % 2]!;
    const current = sequence <= 8 ? this.firstRows[sequence - 1]! : recent;
    current.sequence = recent.sequence = sequence;
    current.completed = recent.completed = null;
    for (const field of this.fields) current[field] = recent[field] = null;
  }

  mark(field: string, value: unknown): void {
    this.markBatch(this.count, field, value);
  }

  /** Bind asynchronous marks to this batch, even after a later batch begins. */
  beginBatch(): RecordingCommitObserver {
    this.begin();
    const sequence = this.count;
    return { begin() {}, mark: (field, value) => this.markBatch(sequence, field, value) };
  }

  private markBatch(sequence: number, field: string, value: unknown): void {
    if (sequence === 0) return;
    const first = sequence <= 8 ? this.firstRows[sequence - 1] : undefined;
    const recent = this.lastRows[(sequence - 1) % 2]!;
    if (first?.sequence === sequence) this.markRow(first, field, value);
    // A stale observer must not update a recycled last-two slot.
    if (recent.sequence === sequence) this.markRow(recent, field, value);
  }

  private markRow(row: MutableRow, field: string, value: unknown): void {
    if (field === "completed") row.completed = typeof value === "boolean" ? value : null;
    else if (this.fields.includes(field as Field)) row[field as Field] = scalar(value);
  }

  snapshot(): Readonly<RecordingCommitRows<Field>> {
    const first = this.firstRows
      .slice(0, Math.min(this.count, 8))
      .map((row) => Object.freeze({ ...row }) as RecordingCommitRow<Field>);
    const last: RecordingCommitRow<Field>[] = [];
    for (let index = Math.max(0, this.count - 2); index < this.count; index++)
      last.push(Object.freeze({ ...this.lastRows[index % 2]! }) as RecordingCommitRow<Field>);
    return Object.freeze({
      count: this.count,
      first: Object.freeze(first),
      last: Object.freeze(last),
    });
  }
}

// Timestamps share performance.now()'s origin. digestTotalMs is aggregate wall
// time around the unchanged serial hash loop, including its promise scheduling.
const storageFields = [
  "batchFrameCount",
  "batchEncodedBytes",
  "minFrameBytes",
  "maxFrameBytes",
  "firstTick",
  "lastTick",
  "queueLengthAtStart",
  "reservedBytesAtStart",
  "inFlightAtStart",
  "appendStartedAtMs",
  "appendEndedAtMs",
  "digestTotalMs",
  "digestsCompletedAtMs",
  "transactionCreatedAtMs",
  "readsReadyAtMs",
  "validationParseCloneMs",
  "requestsIssuedAtMs",
  "oncompleteAtMs",
  "descriptorCountBefore",
] as const;
const evaluationFields = [
  "tick",
  "capacityCallMs",
  "capacityAwaitMs",
  "appendEnqueueMs",
  "encodedFrameBytes",
] as const;
export type RecordingStorageCommitRows = RecordingCommitRows<(typeof storageFields)[number]>;
export type RecordingEvaluationCommitRows = RecordingCommitRows<(typeof evaluationFields)[number]>;

export class RecordingStorageCommitDiagnostics extends BoundedCommitRows<
  (typeof storageFields)[number]
> {
  constructor() {
    super(storageFields);
  }
}
export class RecordingEvaluationCommitDiagnostics extends BoundedCommitRows<
  (typeof evaluationFields)[number]
> {
  constructor() {
    super(evaluationFields);
  }
}

export interface RecordingCommitIdentity {
  readonly captureRunId: string;
  readonly runEpoch: string;
  readonly sceneRevision: number;
}
export interface RecordingStorageCommitSnapshot extends RecordingCommitIdentity {
  readonly sessionId: string;
  readonly storage: Readonly<RecordingStorageCommitRows>;
}
export interface RecordingCommitDiagnosticsSnapshot extends RecordingCommitIdentity {
  readonly schemaVersion: 1;
  readonly sessionId: string | null;
  readonly storage: Readonly<RecordingStorageCommitRows> | null;
  readonly evaluation: Readonly<RecordingEvaluationCommitRows>;
}
