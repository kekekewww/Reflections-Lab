import { performance } from "node:perf_hooks";
import { solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticSolution } from "../../src/acoustics/types.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import { AcousticGeometryCache } from "../../src/app/acoustic-geometry-cache.js";
import type { AcousticGeometryCacheTelemetry } from "../../src/app/acoustic-geometry-cache.js";
import { AcousticService } from "../../src/app/acoustic-service.js";
import type { AcousticServiceTelemetry } from "../../src/app/acoustic-service.js";
import { assertFullOracle, CONFIGURATIONS, observeExplicitCopies, summarize } from "./component.js";
import { errorIdentity, exactDataEqual } from "./corpus.js";
import type { CorpusRow, ExpectedRequests } from "./corpus.js";
import { NodeAcousticWorkerPort } from "./node-port.js";

type ConfigurationId = "A" | "B" | "C" | "D";
export interface ComponentConfiguration {
  id: string;
  persistentCache: boolean;
  transport: "clone" | "deduplicated";
}
export interface PreparedOracleRow {
  snapshot: CorpusRow;
  solutions: AcousticSolution[] | null;
}
export interface PreparedOracles {
  rows: PreparedOracleRow[];
}
const preparedObjects = new WeakSet<object>();
function immutable<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value)) immutable(child, seen);
    Object.freeze(value);
  }
  return value;
}
function oracleError(code: string, cause?: unknown): Error {
  return new Error(code, cause === undefined ? undefined : { cause });
}
function buildExpected(row: CorpusRow, cache?: AcousticGeometryCache): ExpectedRequests {
  try {
    return { ok: true, requests: buildAcousticRequests(row.input, cache) };
  } catch (error) {
    return errorIdentity(error);
  }
}

/** Full uncached reproduction and reference solves; call before all measured work. */
export function prepareOracles(rows: readonly CorpusRow[]): PreparedOracles {
  if (!rows.length || rows.length > 4096) throw oracleError("COMPONENT_CORPUS_BOUNDS");
  const ids = new Set<string>();
  const prepared: PreparedOracles = { rows: [] };
  for (const row of rows) {
    if (!row.id || ids.has(row.id) || row.tick !== row.input.tick)
      throw oracleError("COMPONENT_CORPUS_IDENTITY");
    ids.add(row.id);
    const snapshot = structuredClone(row);
    const reproduced = buildExpected(row);
    if (!exactDataEqual(row.expected, reproduced))
      throw oracleError("COMPONENT_RECORDED_REQUEST_ORACLE");
    const solutions = reproduced.ok
      ? reproduced.requests.map((request) => solveAcoustics(request))
      : null;
    if (!exactDataEqual(row, snapshot)) throw oracleError("COMPONENT_PREPARATION_MUTATED_INPUT");
    prepared.rows.push({ snapshot, solutions });
  }
  immutable(prepared);
  preparedObjects.add(prepared);
  return prepared;
}

export interface ComponentRunOptions {
  warmup?: number;
  repetitions?: number;
  copyProbe?: boolean;
}
interface ResolvedOptions {
  warmup: number;
  repetitions: number;
  copyProbe: boolean;
}
function resolveOptions(options: ComponentRunOptions): ResolvedOptions {
  const result = {
    warmup: options.warmup ?? 4,
    repetitions: options.repetitions ?? 1,
    copyProbe: options.copyProbe ?? false,
  };
  if (
    !Number.isSafeInteger(result.warmup) ||
    result.warmup < 0 ||
    result.warmup > 4 ||
    !Number.isSafeInteger(result.repetitions) ||
    result.repetitions < 1 ||
    result.repetitions > 32 ||
    typeof result.copyProbe !== "boolean"
  )
    throw oracleError("COMPONENT_RUN_BOUNDS");
  return result;
}
function resolveConfiguration(
  value: ConfigurationId | ComponentConfiguration,
): Readonly<ComponentConfiguration> {
  const id = typeof value === "string" ? value : value.id;
  const canonical = CONFIGURATIONS.find((configuration) => configuration.id === id);
  // Explicit values keep mutated CONFIGURATIONS entries from redefining the A/B/C/D experiment.
  const persistentCache = id === "B" || id === "D";
  const transport = id === "C" || id === "D" ? "deduplicated" : "clone";
  if (
    !canonical ||
    (typeof value !== "string" &&
      (value.persistentCache !== persistentCache || value.transport !== transport))
  )
    throw oracleError("COMPONENT_CONFIGURATION");
  return Object.freeze({ id: id as ConfigurationId, persistentCache, transport });
}
function assertPrepared(rows: readonly CorpusRow[], prepared: PreparedOracles): void {
  if (!prepared || !preparedObjects.has(prepared)) throw oracleError("COMPONENT_PREPARED_ORACLE");
  if (
    rows.length !== prepared.rows.length ||
    rows.some((row, index) => !exactDataEqual(row, prepared.rows[index]!.snapshot))
  )
    throw oracleError("COMPONENT_CORPUS_CHANGED");
}

export interface ComponentMetrics {
  cacheClearMs: number | null;
  builderMs: number;
  serviceMs: number | null;
  lastEncodeMs: number | null;
  nativeNodePostMs: number | null;
  workerComputeMs: number | null;
  deliveryHandlerMs: number | null;
  harnessConsumerChecksumMs: number | null;
  totalComponentAgeMs: number;
  runtimeAudioConsumerMs: null;
  nativeOnsetSeconds: null;
  livePoseAgeTicks: null;
  vmAllocationBytes: null;
}
export interface ComponentRow {
  id: string;
  group: string;
  phase: string;
  tick: number;
  runEpoch: string;
  callScope: CorpusRow["callScope"];
  repetition: number;
  status: "accepted" | "build-rejected" | "unexpected-error";
  comparisonEligible: boolean;
  sourceCount: number;
  sourceIds: string[];
  sourceEventCount: number;
  objectCount: number;
  dynamicBodyCount: number;
  geometry:
    | {
        sourceId: string;
        surfaces: number;
        primitives: number;
        boxOccluders: number;
        materials: number;
      }[]
    | null;
  paths:
    | { sourceId: string; count: number; segmentTests: number; budgetExceeded: boolean }[]
    | null;
  metrics: ComponentMetrics;
  error: Exclude<ExpectedRequests, { ok: true }> | null;
  cacheBefore: Readonly<AcousticGeometryCacheTelemetry> | null;
  cacheAfter: Readonly<AcousticGeometryCacheTelemetry> | null;
  serviceTelemetry: Readonly<AcousticServiceTelemetry>;
  actualTransport: AcousticServiceTelemetry["lastTransport"];
  logicalRequestJSONBytes: number | null;
  /** Service-measured requests-array or packet UTF-8 JSON bytes; excludes native posted envelope and internal copies. */
  requestBodyJSONBytes: number | null;
  responseJSONBytes: number | null;
  consumerChecksum: number | null;
}
type NodeTelemetry = ReturnType<NodeAcousticWorkerPort["getTelemetry"]>;
type CopyCounters = Awaited<ReturnType<typeof observeExplicitCopies>>["copies"];
export interface ComponentCopyRow {
  id: string;
  group: string;
  repetition: number;
  status: "accepted" | "build-rejected";
  sourceCount: number;
  copies: CopyCounters;
  cacheBefore: Readonly<AcousticGeometryCacheTelemetry> | null;
  cacheAfter: Readonly<AcousticGeometryCacheTelemetry> | null;
}
export interface ComponentCopyProbe {
  timed: false;
  scope: string;
  rows: ComponentCopyRow[];
  serviceTelemetry: Readonly<AcousticServiceTelemetry>;
  nodeTelemetry: NodeTelemetry[];
  allNodeWorkersExited: boolean;
}
type Distribution = ReturnType<typeof summarize>;
type Latency = { [K in keyof ComponentMetrics]: Distribution | null };
export interface ComponentGroup {
  rows: number;
  acceptedRows: number;
  buildRejectedRows: number;
  unexpectedRows: number;
  latency: Latency | null;
}
export interface ComponentRunResult {
  configuration: Readonly<ComponentConfiguration>;
  timingScope: string;
  warmup: { requested: number; performed: number; rowIds: string[] };
  repetitions: number;
  rows: ComponentRow[];
  summary: ComponentGroup;
  groups: Record<string, ComponentGroup>;
  groupsByCallScope: Record<string, ComponentGroup>;
  serviceTelemetry: Readonly<AcousticServiceTelemetry>;
  nodeTelemetry: NodeTelemetry[];
  allNodeWorkersExited: boolean;
  copyProbe: ComponentCopyProbe | null;
}
export class ComponentRunError extends Error {
  constructor(
    code: string,
    readonly partial: ComponentRunResult,
    cause?: unknown,
  ) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "ComponentRunError";
  }
}
interface Context {
  cache: AcousticGeometryCache | undefined;
  service: AcousticService;
  ports: NodeAcousticWorkerPort[];
}
function createContext(configuration: Readonly<ComponentConfiguration>): Context {
  const ports: NodeAcousticWorkerPort[] = [];
  const service = new AcousticService(true, {
    transport: configuration.transport,
    workerFactory: () => {
      const port = new NodeAcousticWorkerPort();
      ports.push(port);
      return port;
    },
  });
  return {
    cache: configuration.persistentCache ? new AcousticGeometryCache() : undefined,
    service,
    ports,
  };
}
async function ready(context: Context): Promise<void> {
  await Promise.all(context.ports.map((port) => port.ready));
}
async function close(context: Context): Promise<void> {
  context.service.dispose();
  // Also close every historical port if a service failure caused replacement.
  for (const port of context.ports) port.terminate();
  const exits = await Promise.allSettled(context.ports.map((port) => port.closed));
  if (
    exits.some((result) => result.status === "rejected") ||
    context.ports.some((port) => port.getTelemetry().state !== "closed")
  )
    throw oracleError("COMPONENT_NODE_EXIT_UNACKNOWLEDGED");
}
function currentPort(context: Context): NodeAcousticWorkerPort | undefined {
  return context.ports.at(-1);
}
function verifyRow(
  row: CorpusRow,
  reference: PreparedOracleRow,
  built: ExpectedRequests,
  solutions: AcousticSolution[] | null,
): void {
  if (!exactDataEqual(row, reference.snapshot)) throw oracleError("COMPONENT_INPUT_MUTATED");
  if (!exactDataEqual(built, reference.snapshot.expected))
    throw oracleError("COMPONENT_REQUEST_ORACLE");
  if (built.ok) {
    if (!reference.snapshot.expected.ok || !solutions || !reference.solutions)
      throw oracleError("COMPONENT_SOLUTION_ORACLE");
    try {
      assertFullOracle(
        reference.snapshot.expected.requests,
        built.requests,
        reference.solutions,
        solutions,
      );
    } catch (error) {
      throw oracleError("COMPONENT_SOLUTION_ORACLE", error);
    }
  } else if (solutions !== null) throw oracleError("COMPONENT_REJECTION_ORACLE");
}
function primaryWarmupRows(
  rows: readonly CorpusRow[],
  prepared: PreparedOracles,
  count: number,
): number[] {
  const selected: number[] = [];
  for (let index = 0; index < rows.length && selected.length < count; index++)
    if (
      !rows[index]!.group.startsWith("invalidation.") &&
      prepared.rows[index]!.snapshot.expected.ok
    )
      selected.push(index);
  return selected;
}
async function warm(
  context: Context,
  rows: readonly CorpusRow[],
  prepared: PreparedOracles,
  selected: readonly number[],
): Promise<void> {
  for (const index of selected) {
    const row = rows[index]!;
    if (row.clearCacheBefore) context.cache?.clear();
    const built = buildExpected(row, context.cache);
    const solutions = built.ok ? await context.service.solve(built.requests) : null;
    verifyRow(row, prepared.rows[index]!, built, solutions);
  }
}
/** Bounded deterministic traversal only; this is not the runtime audio/UI consumer. */
function consumerChecksum(solutions: readonly AcousticSolution[]): number {
  let checksum = 0;
  let ordinal = 1;
  const add = (value: number) => {
    checksum += value * ordinal;
    ordinal = ordinal === 997 ? 1 : ordinal + 1;
  };
  for (const solution of solutions) {
    add(solution.frame.poseTick);
    for (const path of solution.frame.paths) {
      add(path.order);
      add(path.lengthM);
      add(path.absoluteDelayS);
      add(path.relativeDelayS);
      for (const vertex of path.verticesM) for (const value of vertex) add(value);
      for (const value of path.arrivalDirection) add(value);
      for (const value of path.bandGains) add(value);
    }
    add(solution.diagnostics.segmentTests);
  }
  if (!Number.isFinite(checksum)) throw oracleError("COMPONENT_CHECKSUM_NONFINITE");
  return checksum;
}
function emptyMetrics(): ComponentMetrics {
  return {
    cacheClearMs: null,
    builderMs: 0,
    serviceMs: null,
    lastEncodeMs: null,
    nativeNodePostMs: null,
    workerComputeMs: null,
    deliveryHandlerMs: null,
    harnessConsumerChecksumMs: null,
    totalComponentAgeMs: 0,
    runtimeAudioConsumerMs: null,
    nativeOnsetSeconds: null,
    livePoseAgeTicks: null,
    vmAllocationBytes: null,
  };
}
function rawRow(row: CorpusRow, repetition: number, context: Context): ComponentRow {
  return {
    id: row.id,
    group: row.group,
    phase: row.phase,
    tick: row.tick,
    runEpoch: row.runEpoch,
    callScope: row.callScope,
    repetition,
    status: "unexpected-error",
    comparisonEligible: false,
    sourceCount: row.input.sources.length,
    sourceIds: row.input.sources.map((source) => source.id),
    sourceEventCount: row.sourceEvents.length,
    objectCount: row.input.scene.objects.length,
    dynamicBodyCount: row.input.scene.objects.filter((object) => object.mode.startsWith("dynamic"))
      .length,
    geometry: null,
    paths: null,
    metrics: emptyMetrics(),
    error: null,
    cacheBefore: context.cache?.getTelemetry() ?? null,
    cacheAfter: null,
    serviceTelemetry: context.service.getTelemetry(),
    actualTransport: null,
    logicalRequestJSONBytes: null,
    requestBodyJSONBytes: null,
    responseJSONBytes: null,
    consumerChecksum: null,
  };
}
async function measureRow(
  row: CorpusRow,
  reference: PreparedOracleRow,
  repetition: number,
  context: Context,
  output: ComponentRow[],
): Promise<void> {
  const raw = rawRow(row, repetition, context);
  output.push(raw);
  let built: ExpectedRequests;
  let solutions: AcousticSolution[] | null = null;
  const totalStart = performance.now();
  try {
    if (row.clearCacheBefore && context.cache) {
      const started = performance.now();
      context.cache.clear();
      raw.metrics.cacheClearMs = performance.now() - started;
    }
    const builderStart = performance.now();
    built = buildExpected(row, context.cache);
    raw.metrics.builderMs = performance.now() - builderStart;
    if (built.ok) {
      const serviceStart = performance.now();
      try {
        solutions = await context.service.solve(built.requests);
      } finally {
        raw.metrics.serviceMs = performance.now() - serviceStart;
      }
      const consumerStart = performance.now();
      raw.consumerChecksum = consumerChecksum(solutions);
      raw.metrics.harnessConsumerChecksumMs = performance.now() - consumerStart;
    }
    raw.metrics.totalComponentAgeMs = performance.now() - totalStart;
    // Metadata and full oracles are intentionally outside all target timing brackets.
    raw.serviceTelemetry = context.service.getTelemetry();
    raw.cacheAfter = context.cache?.getTelemetry() ?? null;
    verifyRow(row, reference, built, solutions);
    if (built.ok) {
      raw.status = "accepted";
      raw.comparisonEligible = true;
      raw.geometry = built.requests.map((request) => ({
        sourceId: request.source.id,
        surfaces: request.surfaces.length,
        primitives: request.primitives?.length ?? 0,
        boxOccluders: request.boxOccluders?.length ?? 0,
        materials: request.materials.length,
      }));
      raw.paths = solutions!.map((solution) => ({
        sourceId: solution.frame.sourceId,
        count: solution.frame.paths.length,
        segmentTests: solution.diagnostics.segmentTests,
        budgetExceeded: solution.diagnostics.budgetExceeded,
      }));
      raw.actualTransport = raw.serviceTelemetry.lastTransport;
      raw.logicalRequestJSONBytes = raw.serviceTelemetry.lastRequestBytes;
      raw.requestBodyJSONBytes = raw.serviceTelemetry.lastWireRequestBytes;
      raw.responseJSONBytes = raw.serviceTelemetry.lastResponseBytes;
      raw.metrics.lastEncodeMs = raw.serviceTelemetry.lastEncodeMs;
      // Empty batches never posted; do not inherit a previous row's post/compute values.
      raw.metrics.nativeNodePostMs = built.requests.length
        ? (currentPort(context)?.getTelemetry().lastPostMs ?? null)
        : null;
      raw.metrics.workerComputeMs = raw.serviceTelemetry.lastWorkerComputeMs;
      raw.metrics.deliveryHandlerMs = raw.serviceTelemetry.lastDeliveryHandlerMs;
    } else {
      raw.status = "build-rejected";
      raw.error = built;
    }
  } catch (error) {
    if (raw.metrics.totalComponentAgeMs === 0)
      raw.metrics.totalComponentAgeMs = performance.now() - totalStart;
    raw.error = errorIdentity(error);
    raw.status = "unexpected-error";
    raw.comparisonEligible = false;
    raw.serviceTelemetry = context.service.getTelemetry();
    raw.cacheAfter = context.cache?.getTelemetry() ?? null;
    throw error;
  }
}
function groupSummary(rows: readonly ComponentRow[]): ComponentGroup {
  const accepted = rows.filter((row) => row.status === "accepted" && row.comparisonEligible);
  const latency =
    accepted.length && new Set(rows.map((row) => row.callScope)).size === 1
      ? (Object.fromEntries(
          Object.keys(emptyMetrics()).map((key) => {
            const metric = key as keyof ComponentMetrics;
            const values = accepted.flatMap((row) =>
              row.metrics[metric] === null ? [] : [row.metrics[metric] as number],
            );
            return [metric, values.length ? summarize(values) : null];
          }),
        ) as Latency)
      : null;
  return {
    rows: rows.length,
    acceptedRows: accepted.length,
    buildRejectedRows: rows.filter((row) => row.status === "build-rejected").length,
    unexpectedRows: rows.filter((row) => row.status === "unexpected-error").length,
    latency,
  };
}
function groups(
  rows: readonly ComponentRow[],
  byCallScope = false,
): Record<string, ComponentGroup> {
  const groups: Record<string, ComponentGroup> = Object.create(null) as Record<
    string,
    ComponentGroup
  >;
  const key = (row: ComponentRow) => (byCallScope ? row.group + "/" + row.callScope : row.group);
  for (const group of new Set(rows.map(key)))
    groups[group] = groupSummary(rows.filter((row) => key(row) === group));
  return groups;
}
function describeResult(
  configuration: Readonly<ComponentConfiguration>,
  options: ResolvedOptions,
  rows: ComponentRow[],
  warmupRows: readonly number[],
  corpus: readonly CorpusRow[],
  context: Context,
  serviceTelemetry: Readonly<AcousticServiceTelemetry>,
): ComponentRunResult {
  const nodeTelemetry = context.ports.map((port) => port.getTelemetry());
  return {
    configuration,
    timingScope:
      "Node component only: builder, complete service promise, native Node postMessage API bracket, worker compute, service delivery and harness checksum. Not browser/formal600 or runtime audio/onset. Explicit-event-batch rows measure request DTOs with AcousticService, not the RecordingEvaluationClient capture pipeline.",
    warmup: {
      requested: options.warmup,
      performed: warmupRows.length,
      rowIds: warmupRows.map((index) => corpus[index]!.id),
    },
    repetitions: options.repetitions,
    rows,
    summary: groupSummary(rows),
    groups: groups(rows),
    groupsByCallScope: groups(rows, true),
    serviceTelemetry,
    nodeTelemetry,
    allNodeWorkersExited: nodeTelemetry.every((port) => port.state === "closed"),
    copyProbe: null,
  };
}

/** Same complete corpus, one persistent cache per configuration and one native worker lifecycle. */
export async function runConfiguration(
  rows: readonly CorpusRow[],
  configuration: ConfigurationId | ComponentConfiguration,
  prepared: PreparedOracles,
  options: ComponentRunOptions = {},
): Promise<ComponentRunResult> {
  assertPrepared(rows, prepared);
  const resolved = resolveConfiguration(configuration),
    settings = resolveOptions(options);
  const warmupRows = primaryWarmupRows(rows, prepared, settings.warmup);
  const context = createContext(resolved),
    measured: ComponentRow[] = [];
  let failure: unknown;
  let serviceTelemetry = context.service.getTelemetry();
  try {
    await ready(context);
    await warm(context, rows, prepared, warmupRows);
    for (let repetition = 0; repetition < settings.repetitions; repetition++)
      for (let index = 0; index < rows.length; index++)
        await measureRow(rows[index]!, prepared.rows[index]!, repetition, context, measured);
  } catch (error) {
    failure = error;
  } finally {
    serviceTelemetry = context.service.getTelemetry();
    try {
      await close(context);
    } catch (error) {
      failure ??= error;
    }
  }
  const result = describeResult(
    resolved,
    settings,
    measured,
    warmupRows,
    rows,
    context,
    serviceTelemetry,
  );
  if (failure) throw new ComponentRunError("COMPONENT_CONFIGURATION_FAILED", result, failure);
  assertPrepared(rows, prepared);
  if (settings.copyProbe) result.copyProbe = await runCopyProbe(rows, resolved, prepared, settings);
  return result;
}

/** Independent untimed pass; the explicit-clone proxy never overlaps reference solves or timing runs. */
export async function runCopyProbe(
  rows: readonly CorpusRow[],
  configuration: ConfigurationId | ComponentConfiguration,
  prepared: PreparedOracles,
  options: ComponentRunOptions = {},
): Promise<ComponentCopyProbe> {
  assertPrepared(rows, prepared);
  const resolved = resolveConfiguration(configuration),
    settings = resolveOptions(options);
  const context = createContext(resolved),
    output: ComponentCopyRow[] = [];
  let failure: unknown;
  let serviceTelemetry = context.service.getTelemetry();
  try {
    await ready(context);
    await warm(context, rows, prepared, primaryWarmupRows(rows, prepared, settings.warmup));
    for (let repetition = 0; repetition < settings.repetitions; repetition++) {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index]!,
          cacheBefore = context.cache?.getTelemetry() ?? null;
        const probe = await observeExplicitCopies(async () => {
          if (row.clearCacheBefore) context.cache?.clear();
          const built = buildExpected(row, context.cache);
          const solutions = built.ok ? await context.service.solve(built.requests) : null;
          return { built, solutions };
        });
        verifyRow(row, prepared.rows[index]!, probe.value.built, probe.value.solutions);
        output.push({
          id: row.id,
          group: row.group,
          repetition,
          status: probe.value.built.ok ? "accepted" : "build-rejected",
          sourceCount: row.input.sources.length,
          copies: probe.copies,
          cacheBefore,
          cacheAfter: context.cache?.getTelemetry() ?? null,
        });
      }
    }
  } catch (error) {
    failure = error;
  } finally {
    serviceTelemetry = context.service.getTelemetry();
    try {
      await close(context);
    } catch (error) {
      failure ??= error;
    }
  }
  const nodeTelemetry = context.ports.map((port) => port.getTelemetry());
  const result: ComponentCopyProbe = {
    timed: false,
    scope:
      "Independent pass around actual builder and service only; explicit main-thread clones, not allocation or native wire bytes",
    rows: output,
    serviceTelemetry,
    nodeTelemetry,
    allNodeWorkersExited: nodeTelemetry.every((port) => port.state === "closed"),
  };
  if (failure)
    throw Object.assign(oracleError("COMPONENT_COPY_PROBE_FAILED", failure), { partial: result });
  assertPrepared(rows, prepared);
  return result;
}
