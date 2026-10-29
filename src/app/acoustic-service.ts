import { solveAcoustics } from "../acoustics/index.js";
import type { AcousticRequest, AcousticSolution } from "../acoustics/types.js";

export const ACOUSTIC_DELIVERY_LIMITS = Object.freeze({
  maxSources: 32,
  maxSurfacesPerSource: 256,
  maxPathsPerBatch: 256,
  maxPayloadBytes: 2 * 1024 * 1024,
  maxTimingSamples: 128,
  timeoutMs: 5000,
});
type WorkerPort = Pick<
  Worker,
  "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror"
>;
export interface AcousticServiceOptions {
  /** Test transport injection; production uses a native module Worker. */
  workerFactory?: () => WorkerPort;
  now?: () => number;
  timeoutMs?: number;
}
export interface AcousticServiceTelemetry {
  mode: "worker" | "synchronous";
  disposed: boolean;
  inFlight: boolean;
  pendingSources: number;
  pendingAgeMs: number | null;
  submittedBatches: number;
  completedBatches: number;
  failedBatches: number;
  cancelledBatches: number;
  timedOutBatches: number;
  backpressureRejections: number;
  budgetRejections: number;
  ignoredLateReplies: number;
  workerRestarts: number;
  lastRequestBytes: number;
  lastResponseBytes: number;
  lastRoundTripMs: number | null;
  roundTripP95Ms: number | null;
  lastWorkerComputeMs: number | null;
  workerComputeP95Ms: number | null;
  /** Service validation/resolution only; excludes the app's audio/UI consumers. */
  lastDeliveryHandlerMs: number | null;
  deliveryHandlerP95Ms: number | null;
  retainedTimingSamples: number;
  maxTimingSamples: number;
  maxSources: number;
  maxPathsPerBatch: number;
  maxPayloadBytes: number;
  timeoutMs: number;
  lastError: string | null;
}
interface WorkerReply {
  batchId: number;
  error?: string;
  computeMs?: number;
  results?: { sourceId?: string; solution?: AcousticSolution; error?: string }[];
}
interface PendingBatch {
  id: number;
  requests: RequestIdentity[];
  startedAt: number;
  resolve: (value: AcousticSolution[]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
interface RequestIdentity {
  requestId: string;
  sourceId: string;
  listenerId: string;
  sceneRevision: number;
  geometryRevision: number;
  poseTick: number;
  maxPaths: number;
}
interface Timing {
  roundTripMs: number;
  computeMs: number | null;
  deliveryMs: number;
}
const encoder = new TextEncoder();
const percentile = (values: number[]): number | null =>
  values.length ? values.sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]! : null;
const failure = (code: string): Error => new Error(code.slice(0, 512));
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
// Indexed validators below also reject holes: one hole plus one named key cannot cancel out.
const denseArray = (value: unknown, minimum: number, maximum: number): value is unknown[] =>
  Array.isArray(value) &&
  value.length >= minimum &&
  value.length <= maximum &&
  Object.keys(value).length === value.length;
const vector = (value: unknown): boolean =>
  denseArray(value, 3, 3) && finite(value[0]) && finite(value[1]) && finite(value[2]);
const all = (values: readonly unknown[], predicate: (value: unknown) => boolean): boolean => {
  for (const value of values) if (!predicate(value)) return false;
  return true;
};
const strings = (value: unknown): value is string[] =>
  denseArray(value, 0, 256) && all(value, (item) => typeof item === "string" && item.length <= 512);
const allowedKeys = {
  reply: new Set(["batchId", "error", "computeMs", "results"]),
  result: new Set(["sourceId", "solution", "error"]),
  solution: new Set(["frame", "diagnostics", "metrics"]),
  frame: new Set([
    "schemaVersion",
    "requestId",
    "sceneRevision",
    "geometryRevision",
    "poseTick",
    "backendId",
    "backendVersion",
    "sourceId",
    "listenerId",
    "bandCentersHz",
    "gainQuantity",
    "capabilities",
    "modelClass",
    "directDelayS",
    "paths",
    "pathAvailability",
    "impulseResponseArtifactId",
    "stale",
    "limitations",
  ]),
  path: new Set([
    "id",
    "sourceId",
    "listenerId",
    "surfaceIds",
    "order",
    "verticesM",
    "lengthM",
    "absoluteDelayS",
    "relativeDelayS",
    "arrivalDirection",
    "bandGains",
  ]),
  diagnostics: new Set([
    "directOccluded",
    "blockedBySurfaceIds",
    "evaluatedReflectionCandidates",
    "segmentTests",
    "budgetExceeded",
    "rejectedReflectionCount",
    "droppedPathCount",
    "speedOfSoundMps",
    "speedModel",
    "materialDiffuseEnergyExcluded",
  ]),
  metrics: new Set(["rt60Seconds", "drrDb", "c50Db", "reason"]),
};
function onlyKeys(value: unknown, keys: ReadonlySet<string>): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.keys(value).every((key) => keys.has(key))
  );
}
function validSolution(solution: AcousticSolution): boolean {
  const frame = solution?.frame,
    diagnostics = solution?.diagnostics,
    metrics = solution?.metrics;
  if (
    !onlyKeys(solution, allowedKeys.solution) ||
    !onlyKeys(frame, allowedKeys.frame) ||
    !frame ||
    frame.schemaVersion !== "1.0.0" ||
    typeof frame.backendId !== "string" ||
    frame.backendId.length > 128 ||
    typeof frame.backendVersion !== "string" ||
    frame.backendVersion.length > 128 ||
    frame.gainQuantity !== "pressureRatio" ||
    frame.modelClass !== "numericalApproximation" ||
    frame.impulseResponseArtifactId !== null ||
    typeof frame.stale !== "boolean" ||
    !["available", "unsupported", "failed"].includes(frame.pathAvailability) ||
    !strings(frame.capabilities) ||
    !frame.capabilities.every((value) =>
      ["directParameters", "individualReflectionPaths", "dynamicOccluders"].includes(value),
    ) ||
    !strings(frame.limitations) ||
    frame.limitations.length > 64 ||
    !denseArray(frame.bandCentersHz, 1, 32) ||
    !all(frame.bandCentersHz, (value) => finite(value) && value > 0) ||
    (frame.directDelayS !== null && !nonnegative(frame.directDelayS)) ||
    !denseArray(frame.paths, 0, ACOUSTIC_DELIVERY_LIMITS.maxPathsPerBatch)
  )
    return false;
  for (const path of frame.paths) {
    if (
      !onlyKeys(path, allowedKeys.path) ||
      !path ||
      typeof path.id !== "string" ||
      path.id.length > 512 ||
      path.sourceId !== frame.sourceId ||
      path.listenerId !== frame.listenerId ||
      ![0, 1].includes(path.order) ||
      !strings(path.surfaceIds) ||
      path.surfaceIds.length !== path.order ||
      !denseArray(path.verticesM, path.order + 2, path.order + 2) ||
      !all(path.verticesM, vector) ||
      !vector(path.arrivalDirection) ||
      !nonnegative(path.lengthM) ||
      !nonnegative(path.absoluteDelayS) ||
      !nonnegative(path.relativeDelayS) ||
      path.relativeDelayS > path.absoluteDelayS ||
      !denseArray(path.bandGains, frame.bandCentersHz.length, frame.bandCentersHz.length) ||
      !all(path.bandGains, nonnegative)
    )
      return false;
  }
  return Boolean(
    diagnostics &&
      onlyKeys(diagnostics, allowedKeys.diagnostics) &&
      (diagnostics.directOccluded === null || typeof diagnostics.directOccluded === "boolean") &&
      strings(diagnostics.blockedBySurfaceIds) &&
      [
        diagnostics.evaluatedReflectionCandidates,
        diagnostics.segmentTests,
        diagnostics.rejectedReflectionCount,
        diagnostics.droppedPathCount,
      ].every((value) => Number.isSafeInteger(value) && value >= 0) &&
      typeof diagnostics.budgetExceeded === "boolean" &&
      typeof diagnostics.materialDiffuseEnergyExcluded === "boolean" &&
      (diagnostics.speedOfSoundMps === null ||
        (finite(diagnostics.speedOfSoundMps) && diagnostics.speedOfSoundMps > 0)) &&
      ["explicit", "idealDryAirDerived", "vacuum"].includes(diagnostics.speedModel) &&
      metrics &&
      onlyKeys(metrics, allowedKeys.metrics) &&
      metrics.rt60Seconds === null &&
      metrics.drrDb === null &&
      metrics.c50Db === null &&
      typeof metrics.reason === "string" &&
      metrics.reason.length <= 8192,
  );
}

/** Inspect bounds before stringifying or structured-cloning potentially huge input. */
function payloadBytes(value: unknown): number {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > 200_000 || item.depth > 16) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
    if (typeof item.value === "string") {
      if (item.value.length > 8192) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
    } else if (typeof item.value === "number") {
      if (!Number.isFinite(item.value)) throw failure("ACOUSTIC_PAYLOAD_INVALID");
    } else if (item.value !== null && typeof item.value === "object") {
      if (Array.isArray(item.value)) {
        if (!denseArray(item.value, 0, 4096)) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
        for (const entry of item.value) {
          if (entry === undefined) throw failure("ACOUSTIC_PAYLOAD_INVALID");
          stack.push({ value: entry, depth: item.depth + 1 });
        }
      } else {
        const prototype = Object.getPrototypeOf(item.value);
        if (prototype !== Object.prototype && prototype !== null)
          throw failure("ACOUSTIC_PAYLOAD_INVALID");
        const entries = Object.entries(item.value);
        if (entries.length > 64) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
        for (const [key, entry] of entries) {
          if (key.length > 128) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
          stack.push({ value: entry, depth: item.depth + 1 });
        }
      }
    } else if (typeof item.value !== "boolean" && item.value !== null && item.value !== undefined) {
      throw failure("ACOUSTIC_PAYLOAD_INVALID");
    }
  }
  const bytes = encoder.encode(JSON.stringify(value)).byteLength;
  if (bytes > ACOUSTIC_DELIVERY_LIMITS.maxPayloadBytes) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
  return bytes;
}
function checkBatch(requests: AcousticRequest[]): void {
  if (!Array.isArray(requests) || requests.length > ACOUSTIC_DELIVERY_LIMITS.maxSources)
    throw failure("SOURCE_BUDGET_EXCEEDED");
  let paths = 0;
  const requestIds = new Set<string>();
  const sourceIds = new Set<string>();
  for (const request of requests) {
    if (
      !request ||
      typeof request !== "object" ||
      !request.source ||
      !request.listener ||
      !Array.isArray(request.surfaces) ||
      request.surfaces.length > ACOUSTIC_DELIVERY_LIMITS.maxSurfacesPerSource ||
      !Array.isArray(request.materials) ||
      request.materials.length > 256 ||
      request.surfaces.some(
        (surface) => !surface || !Array.isArray(surface.verticesM) || surface.verticesM.length > 32,
      ) ||
      request.materials.some(
        (material) => !material || !Array.isArray(material.bands) || material.bands.length > 32,
      )
    )
      throw failure("ACOUSTIC_PAYLOAD_BUDGET");
    if (
      typeof request.requestId !== "string" ||
      typeof request.source.id !== "string" ||
      typeof request.listener.id !== "string" ||
      ![request.sceneRevision, request.geometryRevision, request.poseTick].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      )
    )
      throw failure("ACOUSTIC_BATCH_IDENTITY");
    if (requestIds.has(request.requestId) || sourceIds.has(request.source.id))
      throw failure("ACOUSTIC_BATCH_IDENTITY");
    requestIds.add(request.requestId);
    sourceIds.add(request.source.id);
    const requestedPaths = request.budget?.maxPaths ?? 32;
    if (!Number.isSafeInteger(requestedPaths) || requestedPaths < 1)
      throw failure("PATH_BUDGET_EXCEEDED");
    paths += requestedPaths;
  }
  if (paths > ACOUSTIC_DELIVERY_LIMITS.maxPathsPerBatch) throw failure("PATH_BUDGET_EXCEEDED");
}

/** One in-flight batch, no hidden queue. Cancellation terminates obsolete synchronous Worker work. */
export class AcousticService {
  private worker: WorkerPort | null = null;
  private readonly factory: (() => WorkerPort) | null;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private sequence = 0;
  private workerCreations = 0;
  private pending: PendingBatch | null = null;
  private disposed = false;
  private timings: Timing[] = [];
  private counters = {
    submittedBatches: 0,
    completedBatches: 0,
    failedBatches: 0,
    cancelledBatches: 0,
    timedOutBatches: 0,
    backpressureRejections: 0,
    budgetRejections: 0,
    ignoredLateReplies: 0,
  };
  private lastRequestBytes = 0;
  private lastResponseBytes = 0;
  private lastError: string | null = null;

  constructor(useWorker = true, options: AcousticServiceOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.timeoutMs = options.timeoutMs ?? ACOUSTIC_DELIVERY_LIMITS.timeoutMs;
    if (
      !Number.isFinite(this.timeoutMs) ||
      this.timeoutMs < 1 ||
      this.timeoutMs > ACOUSTIC_DELIVERY_LIMITS.timeoutMs
    )
      throw failure("ACOUSTIC_TIMEOUT_BOUNDS");
    this.factory = useWorker
      ? (options.workerFactory ??
        (typeof Worker === "function"
          ? () => new Worker(new URL("./acoustic-worker.ts", import.meta.url), { type: "module" })
          : null))
      : null;
    this.ensureWorker();
  }
  private ensureWorker(): void {
    if (!this.factory || this.worker || this.disposed) return;
    const port = this.factory();
    this.worker = port;
    this.workerCreations++;
    port.onmessage = (event: MessageEvent<WorkerReply>) => this.receive(port, event.data);
    port.onerror = (event) => {
      if (port !== this.worker || this.disposed) return;
      this.rejectPending(failure(`ACOUSTIC_WORKER: ${event.message}`), "failedBatches");
      this.terminateWorker();
    };
    port.onmessageerror = () => {
      if (port !== this.worker || this.disposed) return;
      this.rejectPending(failure("ACOUSTIC_MESSAGE_ERROR"), "failedBatches");
      this.terminateWorker();
    };
  }
  get busy(): boolean {
    return this.pending !== null;
  }
  getTelemetry(): Readonly<AcousticServiceTelemetry> {
    const last = this.timings.at(-1);
    return Object.freeze({
      mode: this.factory ? "worker" : "synchronous",
      disposed: this.disposed,
      inFlight: this.pending !== null,
      pendingSources: this.pending?.requests.length ?? 0,
      pendingAgeMs: this.pending ? Math.max(0, this.now() - this.pending.startedAt) : null,
      ...this.counters,
      workerRestarts: Math.max(0, this.workerCreations - 1),
      lastRequestBytes: this.lastRequestBytes,
      lastResponseBytes: this.lastResponseBytes,
      lastRoundTripMs: last?.roundTripMs ?? null,
      roundTripP95Ms: percentile(this.timings.map((value) => value.roundTripMs)),
      lastWorkerComputeMs: last?.computeMs ?? null,
      workerComputeP95Ms: percentile(
        this.timings.flatMap((value) => (value.computeMs === null ? [] : [value.computeMs])),
      ),
      lastDeliveryHandlerMs: last?.deliveryMs ?? null,
      deliveryHandlerP95Ms: percentile(this.timings.map((value) => value.deliveryMs)),
      retainedTimingSamples: this.timings.length,
      maxTimingSamples: ACOUSTIC_DELIVERY_LIMITS.maxTimingSamples,
      maxSources: ACOUSTIC_DELIVERY_LIMITS.maxSources,
      maxPathsPerBatch: ACOUSTIC_DELIVERY_LIMITS.maxPathsPerBatch,
      maxPayloadBytes: ACOUSTIC_DELIVERY_LIMITS.maxPayloadBytes,
      timeoutMs: this.timeoutMs,
      lastError: this.lastError,
    });
  }
  solve(requests: AcousticRequest[]): Promise<AcousticSolution[]> {
    if (this.disposed) return Promise.reject(failure("DISPOSED"));
    if (this.pending) {
      this.counters.backpressureRejections++;
      return Promise.reject(failure("SOLVER_BUSY"));
    }
    let pinned: RequestIdentity[];
    try {
      checkBatch(requests);
      this.lastRequestBytes = payloadBytes(requests);
      // Native postMessage takes the complete snapshot synchronously. Retain only
      // owned scalar identity here instead of cloning all geometry a second time.
      pinned = requests.map((request) => ({
        requestId: request.requestId,
        sourceId: request.source.id,
        listenerId: request.listener.id,
        sceneRevision: request.sceneRevision,
        geometryRevision: request.geometryRevision,
        poseTick: request.poseTick,
        maxPaths: request.budget?.maxPaths ?? 32,
      }));
    } catch (error) {
      this.counters.budgetRejections++;
      this.lastError = error instanceof Error ? error.message : "ACOUSTIC_PAYLOAD_INVALID";
      return Promise.reject(error);
    }
    this.counters.submittedBatches++;
    this.lastError = null;
    const startedAt = this.now();
    if (!this.factory || pinned.length === 0) {
      try {
        const results = requests.map((request) => solveAcoustics(request));
        this.lastResponseBytes = payloadBytes(results);
        this.counters.completedBatches++;
        this.addTiming({
          roundTripMs: Math.max(0, this.now() - startedAt),
          computeMs: null,
          deliveryMs: 0,
        });
        return Promise.resolve(results);
      } catch (error) {
        this.counters.failedBatches++;
        this.lastError = error instanceof Error ? error.message : "SOLVER_ERROR";
        return Promise.reject(error);
      }
    }
    try {
      this.ensureWorker();
    } catch (error) {
      this.counters.failedBatches++;
      this.lastError = error instanceof Error ? error.message : "ACOUSTIC_WORKER_UNAVAILABLE";
      return Promise.reject(error);
    }
    const batchId = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending = {
        id: batchId,
        requests: pinned,
        startedAt,
        resolve,
        reject,
        timer: setTimeout(() => {
          if (this.pending?.id !== batchId) return;
          this.rejectPending(failure("ACOUSTIC_TIMEOUT"), "timedOutBatches");
          this.terminateWorker();
        }, this.timeoutMs),
      };
      try {
        this.worker!.postMessage({ batchId, requests });
      } catch (error) {
        this.rejectPending(
          error instanceof Error ? error : failure("ACOUSTIC_POST_MESSAGE_FAILED"),
          "failedBatches",
        );
        this.terminateWorker();
      }
    });
  }
  private receive(port: WorkerPort, data: WorkerReply): void {
    const deliveryStart = this.now(),
      job = this.pending;
    if (port !== this.worker || !job || !data || data.batchId !== job.id || this.disposed) {
      this.counters.ignoredLateReplies++;
      return;
    }
    try {
      if (
        !onlyKeys(data, allowedKeys.reply) ||
        (typeof data.error !== "undefined" && typeof data.error !== "string")
      )
        throw failure("ACOUSTIC_REPLY_INVALID");
      if (data.error) throw failure(data.error);
      if (
        !denseArray(data.results, job.requests.length, job.requests.length) ||
        !Number.isFinite(data.computeMs) ||
        data.computeMs! < 0
      )
        throw failure("ACOUSTIC_REPLY_INVALID");
      let paths = 0;
      const results = Array.from(data.results).map((result, index) => {
        if (
          !onlyKeys(result, allowedKeys.result) ||
          (typeof result.error !== "undefined" && typeof result.error !== "string")
        )
          throw failure("ACOUSTIC_REPLY_INVALID");
        if (result.error) throw failure(result.error);
        const expected = job.requests[index]!,
          solution = result.solution,
          frame = solution?.frame;
        if (
          !frame ||
          !validSolution(solution!) ||
          result.sourceId !== expected.sourceId ||
          frame.requestId !== expected.requestId ||
          frame.sourceId !== expected.sourceId ||
          frame.listenerId !== expected.listenerId ||
          frame.sceneRevision !== expected.sceneRevision ||
          frame.geometryRevision !== expected.geometryRevision ||
          frame.poseTick !== expected.poseTick ||
          !Array.isArray(frame.paths) ||
          frame.paths.length > expected.maxPaths
        )
          throw failure("ACOUSTIC_REPLY_IDENTITY");
        paths += frame.paths.length;
        return solution!;
      });
      if (paths > ACOUSTIC_DELIVERY_LIMITS.maxPathsPerBatch) throw failure("PATH_BUDGET_EXCEEDED");
      // Strict known-shape checks already bound every container/string. Avoid a second
      // generic allocation-heavy tree traversal on this measured delivery path.
      this.lastResponseBytes = encoder.encode(JSON.stringify(data)).byteLength;
      if (this.lastResponseBytes > ACOUSTIC_DELIVERY_LIMITS.maxPayloadBytes)
        throw failure("ACOUSTIC_PAYLOAD_BUDGET");
      clearTimeout(job.timer);
      this.pending = null;
      this.counters.completedBatches++;
      this.addTiming({
        roundTripMs: Math.max(0, this.now() - job.startedAt),
        computeMs: data.computeMs!,
        deliveryMs: Math.max(0, this.now() - deliveryStart),
      });
      this.lastError = null;
      job.resolve(results);
    } catch (error) {
      this.rejectPending(
        error instanceof Error ? error : failure("ACOUSTIC_REPLY_INVALID"),
        "failedBatches",
      );
      this.terminateWorker();
    }
  }
  private addTiming(timing: Timing): void {
    this.timings.push(timing);
    if (this.timings.length > ACOUSTIC_DELIVERY_LIMITS.maxTimingSamples) this.timings.shift();
  }
  private rejectPending(
    error: Error,
    counter: "failedBatches" | "cancelledBatches" | "timedOutBatches",
  ): boolean {
    const job = this.pending;
    this.lastError = error.message;
    if (!job) return false;
    clearTimeout(job.timer);
    this.pending = null;
    this.counters[counter]++;
    job.reject(error);
    return true;
  }
  private terminateWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }
  cancel(reason = "ACOUSTIC_CANCELLED"): boolean {
    const cancelled = this.rejectPending(failure(reason.slice(0, 512)), "cancelledBatches");
    if (cancelled) this.terminateWorker();
    return cancelled;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rejectPending(failure("DISPOSED"), "cancelledBatches");
    this.terminateWorker();
  }
}
