import type { PcmDifferenceSummary } from "./diagnostics.js";

export interface PairedV3File {
  readonly id: string;
  readonly filename: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly frames: number;
  readonly channels: 2;
  readonly rate: 48000;
}
export interface PairedV3Graph {
  readonly id: string;
  readonly frames: number;
  readonly contextFrames: number;
  readonly tailFrames: number;
  readonly peak: number;
  readonly outsideUnit: number;
  readonly nonfinite: number;
  readonly controlSha256: string;
  readonly startedAtUtc: string;
  readonly finishedAtUtc: string;
  readonly renderMs: number;
  readonly persistMs: number;
  readonly estimatedWorkingBytes: number;
}
export interface PairedV3Comparison {
  readonly id: string;
  readonly actualId: string;
  readonly referenceId: string;
  readonly frames: number;
  readonly summary: PcmDifferenceSummary;
}
export interface PairedV3Timing {
  readonly stage: string;
  readonly id: string;
  readonly elapsedMs: number;
}
export interface PairedV3ProgressSnapshot {
  readonly schemaVersion: "paired-v3-progress-v1";
  readonly phase: "IN_PROGRESS" | "INCOMPLETE" | "BROWSER_COMPLETE";
  readonly status: "RUNNING" | "PASS" | "FAIL" | "ERROR";
  readonly productComplete: false;
  readonly downloads: "NOT_COMPLETED";
  readonly independentParser: "NOT_COMPLETED";
  readonly files: readonly PairedV3File[];
  readonly graphs: readonly PairedV3Graph[];
  readonly comparisons: readonly PairedV3Comparison[];
  readonly timings: readonly PairedV3Timing[];
  readonly overflow: Readonly<{ timings: number }>;
  readonly error: string | null;
}
export function createPairedV3Progress(): {
  recordGraph(file: PairedV3File, graph: PairedV3Graph): void;
  recordComparison(observation: PairedV3Comparison): void;
  recordTiming(row: PairedV3Timing): boolean;
  fail(reason: unknown): void;
  finishBrowser(status: "PASS" | "FAIL" | "ERROR"): void;
  snapshot(): PairedV3ProgressSnapshot;
};
export interface PairedV3CaptureResult {
  readonly availability: "AVAILABLE" | "UNAVAILABLE" | "SKIPPED";
  readonly partialRecoveryAttempted: true;
  readonly overallStatus: "ERROR";
  readonly budgetMs: number;
  readonly reason?: string;
  readonly partial?: PairedV3ProgressSnapshot;
}
export function createPairedV3PartialCapture(): {
  readonly attempted: boolean;
  readonly closed: boolean;
  readonly result: PairedV3CaptureResult | null;
  capture(
    read: () => unknown | Promise<unknown>,
    options: { remainingMs: number; reserveMs?: number; maxMs?: number },
  ): Promise<PairedV3CaptureResult>;
  close(): void;
};
