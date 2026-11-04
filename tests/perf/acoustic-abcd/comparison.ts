import { buildAcousticRequests } from "../../../src/app/acoustic-input.js";
import { AcousticGeometryCache } from "../../../src/app/acoustic-geometry-cache.js";
import { AcousticService } from "../../../src/app/acoustic-service.js";
import type { AcousticServiceOptions } from "../../../src/app/acoustic-service.js";
import type { AcousticSolution } from "../../../src/acoustics/types.js";
import { errorIdentity, exactDataEqual } from "../../../benchmarks/acoustic-transport/corpus.js";
import type { CorpusRow } from "../../../benchmarks/acoustic-transport/corpus.js";

export const ARMS = ["A", "B", "C", "D"] as const;
export type Arm = (typeof ARMS)[number];
export const ORDERS: readonly (readonly Arm[])[] = [
  ["A", "B", "C", "D"],
  ["B", "C", "D", "A"],
  ["C", "D", "A", "B"],
  ["D", "A", "B", "C"],
];
export type Outcome =
  | { ok: true; solutions: AcousticSolution[] }
  | ReturnType<typeof errorIdentity>;
export interface RecordedRow extends CorpusRow {
  runId: string;
  reference: Outcome;
}
export const wallNow = () => performance.timeOrigin + performance.now();
type Memory = { heapUsed: number; external: number; arrayBuffers: number; rss: number };
export interface BoundaryTiming {
  sendMs: number;
  receiveAndQueueMs: number;
  queueAgeMs: number;
  decodeMs: number;
  solveMs: number;
  returnMs: number;
  workerMemoryDelta: Memory | null;
}
type WorkerPort = ReturnType<NonNullable<AcousticServiceOptions["workerFactory"]>>;
export interface MeasuredPort extends WorkerPort {
  ready: Promise<void>;
  closed: Promise<unknown>;
  timing: BoundaryTiming | null;
}
export interface RawRow {
  id: string;
  arm: Arm;
  repetition: number;
  phase: string;
  tick: number;
  runId: string;
  runEpoch: string;
  callScope: string;
  sourceCount: number;
  pathCount: number;
  buildRejected: boolean;
  serviceRejected: boolean;
  requestExact: boolean;
  resultExact: boolean;
  pathIdsExact: boolean;
  difference: string | null;
  error: string | null;
  actualTransport: string | null;
  builderMs: number;
  serviceMs: number;
  encodeMs: number | null;
  deliveryMs: number | null;
  consumerMs: number;
  componentAgeMs: number;
  onsetMs: null;
  logicalJSONBytes: number | null;
  bodyJSONBytes: number | null;
  responseJSONBytes: number | null;
  mainMemoryDelta: Memory | null;
  boundary: BoundaryTiming | null;
}
export function distribution(values: number[]) {
  if (!values.length) return null;
  if (!values.every(Number.isFinite)) throw new Error("NONFINITE_MEASUREMENT");
  const sorted = [...values].sort((a, b) => a - b);
  const p = (fraction: number) => sorted[Math.ceil(fraction * sorted.length) - 1]!;
  return { count: sorted.length, p50: p(0.5), p95: p(0.95), p99: p(0.99) };
}
export function summarize(rows: RawRow[]) {
  const accepted = rows.filter((row) => !row.buildRejected && !row.serviceRejected);
  const numeric = (key: keyof RawRow) =>
    distribution(accepted.flatMap((row) => (typeof row[key] === "number" ? [row[key]] : [])));
  const boundary = (key: keyof BoundaryTiming) =>
    distribution(
      accepted.flatMap((row) => {
        const value = row.boundary?.[key];
        return typeof value === "number" ? [value] : [];
      }),
    );
  const memory = (owner: "mainMemoryDelta" | "workerMemoryDelta", key: keyof Memory) =>
    distribution(
      accepted.flatMap((row) => {
        const value =
          owner === "mainMemoryDelta" ? row.mainMemoryDelta : row.boundary?.workerMemoryDelta;
        return value ? [value[key]] : [];
      }),
    );
  return {
    rows: rows.length,
    accepted: accepted.length,
    buildRejections: rows.filter((row) => row.buildRejected).length,
    serviceRejections: rows.filter((row) => row.serviceRejected).length,
    exactRequests: rows.filter((row) => row.requestExact).length,
    exactResults: rows.filter((row) => row.resultExact).length,
    exactPathIds: rows.filter((row) => row.pathIdsExact).length,
    differences: rows
      .filter((row) => row.difference)
      .map((row) => ({ id: row.id, difference: row.difference })),
    errors: Object.fromEntries(
      [...new Set(rows.map((row) => row.error).filter(Boolean))].map((error) => [
        error,
        rows.filter((row) => row.error === error).length,
      ]),
    ),
    actualTransports: Object.fromEntries(
      ["clone", "deduplicated"].map((transport) => [
        transport,
        accepted.filter((row) => row.actualTransport === transport).length,
      ]),
    ),
    ms: {
      builder: numeric("builderMs"),
      send: boundary("sendMs"),
      receiveAndQueue: boundary("receiveAndQueueMs"),
      queueAge: boundary("queueAgeMs"),
      decode: boundary("decodeMs"),
      solve: boundary("solveMs"),
      resultReturn: boundary("returnMs"),
      encode: numeric("encodeMs"),
      validationAndDelivery: numeric("deliveryMs"),
      consumerChecksum: numeric("consumerMs"),
      componentAge: numeric("componentAgeMs"),
    },
    bytes: {
      logicalJSON: numeric("logicalJSONBytes"),
      postedBodyJSON: numeric("bodyJSONBytes"),
      responseJSON: numeric("responseJSONBytes"),
      mainNetHeap: memory("mainMemoryDelta", "heapUsed"),
      workerNetHeap: memory("workerMemoryDelta", "heapUsed"),
      mainNetArrayBuffers: memory("mainMemoryDelta", "arrayBuffers"),
      workerNetArrayBuffers: memory("workerMemoryDelta", "arrayBuffers"),
      mainNetExternal: memory("mainMemoryDelta", "external"),
      workerNetExternal: memory("workerMemoryDelta", "external"),
      processNetRSS: memory("mainMemoryDelta", "rss"),
      logicalJSONTotal: accepted.reduce((sum, row) => sum + (row.logicalJSONBytes ?? 0), 0),
      postedBodyJSONTotal: accepted.reduce((sum, row) => sum + (row.bodyJSONBytes ?? 0), 0),
    },
    nativeOnsetMs: null,
  };
}
export async function runArm(options: {
  arm: Arm;
  repetition: number;
  rowCount: number;
  loadRow(index: number): Promise<RecordedRow>;
  createPort(): MeasuredPort;
  memory?: () => Memory;
}) {
  const cache =
    options.arm === "B" || options.arm === "D" ? new AcousticGeometryCache() : undefined;
  const port = options.createPort();
  const service = new AcousticService(true, {
    transport: options.arm === "C" || options.arm === "D" ? "deduplicated" : "clone",
    workerFactory: () => port,
  });
  const rows: RawRow[] = [],
    warmup: RawRow[] = [];
  const delta = (before: Memory | undefined): Memory | null => {
    if (!before || !options.memory) return null;
    const after = options.memory();
    return Object.fromEntries(
      Object.keys(before).map((key) => [
        key,
        after[key as keyof Memory] - before[key as keyof Memory],
      ]),
    ) as unknown as Memory;
  };
  async function execute(index: number): Promise<RawRow> {
    const row = await options.loadRow(index);
    const before = options.memory?.(),
      start = performance.now();
    let requests: ReturnType<typeof buildAcousticRequests> = [],
      outcome: Outcome;
    let built: CorpusRow["expected"];
    try {
      requests = buildAcousticRequests(row.input, cache);
      built = { ok: true, requests };
    } catch (error) {
      built = errorIdentity(error);
    }
    const builderMs = performance.now() - start;
    const serviceStart = performance.now();
    port.timing = null;
    if (!built.ok) outcome = built;
    else {
      try {
        outcome = { ok: true, solutions: await service.solve(requests) };
      } catch (error) {
        outcome = errorIdentity(error);
      }
    }
    const serviceMs = performance.now() - serviceStart,
      memoryDelta = delta(before);
    const telemetry = service.getTelemetry(),
      consumerStart = performance.now();
    // A bounded diagnostic consumer, not AudioEngine/native/UI consumption or sound onset.
    let checksum = 0;
    if (outcome.ok)
      for (const solution of outcome.solutions)
        for (const path of solution.frame.paths)
          checksum += path.absoluteDelayS + path.bandGains.reduce((sum, gain) => sum + gain, 0);
    if (!Number.isFinite(checksum)) throw new Error("CONSUMER_CHECKSUM_NONFINITE");
    const consumerMs = performance.now() - consumerStart,
      componentAgeMs = performance.now() - start;
    const requestExact = exactDataEqual(built, row.expected);
    const resultExact = exactDataEqual(outcome, row.reference);
    const pathIds = (value: Outcome) =>
      value.ok
        ? value.solutions.map((solution) => solution.frame.paths.map((path) => path.id))
        : value;
    const pathIdsExact = exactDataEqual(pathIds(outcome), pathIds(row.reference));
    return {
      id: row.id,
      arm: options.arm,
      repetition: options.repetition,
      phase: row.phase,
      tick: row.tick,
      runId: row.runId,
      runEpoch: row.runEpoch,
      callScope: row.callScope,
      sourceCount: row.input.sources.length,
      pathCount: outcome.ok
        ? outcome.solutions.reduce((sum, solution) => sum + solution.frame.paths.length, 0)
        : 0,
      buildRejected: !built.ok,
      serviceRejected: built.ok && !outcome.ok,
      requestExact,
      resultExact,
      pathIdsExact,
      difference: !requestExact
        ? "request/validation"
        : !resultExact
          ? "solution/validation"
          : !pathIdsExact
            ? "paths"
            : null,
      error: outcome.ok ? null : (outcome.code ?? outcome.message),
      actualTransport: built.ok ? telemetry.lastTransport : null,
      builderMs,
      serviceMs,
      encodeMs: built.ok ? telemetry.lastEncodeMs : null,
      deliveryMs: built.ok && outcome.ok ? telemetry.lastDeliveryHandlerMs : null,
      consumerMs,
      componentAgeMs,
      onsetMs: null,
      logicalJSONBytes: built.ok ? telemetry.lastRequestBytes : null,
      bodyJSONBytes: built.ok ? telemetry.lastWireRequestBytes : null,
      responseJSONBytes: built.ok && outcome.ok ? telemetry.lastResponseBytes : null,
      mainMemoryDelta: memoryDelta,
      boundary: port.timing,
    };
  }
  try {
    await port.ready;
    // Separate warmup replays the same corpus prefix, then starts a fresh cache generation.
    for (let index = 0; index < Math.min(8, options.rowCount); index++)
      warmup.push(await execute(index));
    cache?.clear();
    for (let index = 0; index < options.rowCount; index++) rows.push(await execute(index));
    return {
      arm: options.arm,
      repetition: options.repetition,
      warmup,
      rows,
      summary: summarize(rows),
      byLane: Object.fromEntries(
        ["default-live", "explicit-event-batch"].map((scope) => [
          scope,
          summarize(rows.filter((row) => row.callScope === scope)),
        ]),
      ),
      cache: cache?.getTelemetry() ?? null,
      service: service.getTelemetry(),
    };
  } finally {
    service.dispose();
    port.terminate();
    await port.closed;
  }
}
