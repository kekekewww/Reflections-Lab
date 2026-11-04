export type NativePartialStatus = "RUNNING" | "COMPLETE" | "FAIL";

/** Frozen wrapper and result list; result objects and PCM remain the original references. */
export interface NativePartialSnapshot<T = unknown> {
  readonly schemaVersion: "native03-partial-v1";
  readonly status: NativePartialStatus;
  readonly sampleRate: number;
  readonly frames: number;
  readonly results: readonly T[];
  readonly error: string | null;
}

export interface NativePartialJournal<T = unknown> {
  /** At most twenty completed result references; the twenty-first append throws. */
  append(result: T): void;
  fail(error: unknown): void;
  complete(): void;
  snapshot(): NativePartialSnapshot<T>;
}

/** Recovery reports always remain FAIL, including an available COMPLETE snapshot. */
export interface NativePartialReadReport {
  readonly status: "FAIL";
  readonly partialState: "AVAILABLE" | "UNAVAILABLE";
  readonly snapshot: NativePartialSnapshot | null;
  readonly error: string | null;
}

export function createNativePartialJournal<T = unknown>(dimensions: {
  sampleRate: number;
  frames: number;
}): NativePartialJournal<T>;

/** One read only, bounded by the caller's existing remaining cleanup time. */
export function readNativePartialOnce(
  read: () => Promise<unknown>,
  remainingMs: number,
): Promise<NativePartialReadReport>;
