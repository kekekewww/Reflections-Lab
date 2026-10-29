import { formalNumericV3, FORMAL_NUMERIC_TASK_CAP } from "./performance-numeric-formal-v3.mjs";
import { parseTraceStream } from "./performance-stream-v3.mjs";
// PREP ONLY. Strict V3 eligibility precedes a tiny, operation-identical V2 numeric derivative.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { float64Bits, observationName, V3_LIMITS } from "./performance-proof-v3.mjs";
export const SHORT_TRACE_CAPS = Object.freeze({
  compressedBytes: 16 * 1024 * 1024,
  decompressedBytes: 64 * 1024 * 1024,
  events: 500000,
  relevantTasks: 200000,
  metadataNameCharacters: 512,
  proofNameCharacters: 192,
});
export const FORMAL_TRACE_CAPS = Object.freeze({
  compressedBytes: 256 * 1024 * 1024,
  decompressedBytes: 2 * 1024 * 1024 * 1024,
  events: 8000000,
  relevantTasks: FORMAL_NUMERIC_TASK_CAP,
  metadataNameCharacters: 512,
  proofNameCharacters: 192,
  retainedSerializedBytes: 512 * 1024 * 1024,
  heapBytes: 2 * 1024 * 1024 * 1024,
});
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;
const handle = (value) => Number.isSafeInteger(value) && value >= 0;
const bits = (value) => (Number.isFinite(value) ? float64Bits(value) : null);
const taskNames = new Set(["RunTask", "ThreadControllerImpl::RunTask"]);
const category = (event, required) =>
  typeof event.cat === "string" &&
  event.cat.length <= 4096 &&
  event.cat.split(",").includes(required);
const span = (event) =>
  event.ph === "X" &&
  Number.isFinite(event.ts) &&
  Number.isFinite(event.dur) &&
  event.dur >= 0 &&
  Number.isFinite(event.ts + event.dur);
const markShape = (event) =>
  ["I", "R"].includes(event.ph) &&
  category(event, "blink.user_timing") &&
  Number.isFinite(event.ts) &&
  object(event.args) &&
  object(event.args.data);
const supportedCaps = (caps) =>
  object(caps) &&
  ((Object.keys(caps).length === Object.keys(SHORT_TRACE_CAPS).length &&
    Object.entries(SHORT_TRACE_CAPS).every(
      ([key, ceiling]) => Number.isSafeInteger(caps[key]) && caps[key] > 0 && caps[key] <= ceiling,
    )) ||
    (Object.keys(caps).length === Object.keys(FORMAL_TRACE_CAPS).length &&
      Object.entries(FORMAL_TRACE_CAPS).every(([key, value]) => caps[key] === value)));

export function validateNativeV3(ui, events, context, caps = SHORT_TRACE_CAPS) {
  const reasons = new Set(),
    evidence = [],
    rawOrderDiagnostic = [];
  const fail = (reason) => reasons.add(reason);
  const result = () => ({
    qualified: reasons.size === 0,
    status: reasons.size ? "UNVERIFIED" : "V3_NATIVE_EVIDENCE_OBSERVED",
    reasons: [...reasons],
    evidence,
    rawOrderDiagnostic,
    advertisementUsedForEligibility: false,
    formalQualification: "NOT_APPROVED",
    oldV2StatusUnchanged: true,
  });
  if (!object(ui) || !object(context) || !Array.isArray(events) || !supportedCaps(caps)) {
    fail("TOP_LEVEL_SCHEMA");
    return result();
  }
  const window = ui.collectionWindow,
    proof = ui.v3Proof;
  if (
    !object(window) ||
    !object(proof) ||
    window.schemaVersion !== "3.0.0" ||
    proof.schemaVersion !== "3.0.0" ||
    proof.method !== "native-raf-calltime-v3"
  ) {
    fail("METHOD_SCHEMA");
    return result();
  }
  if (
    !Array.isArray(ui.frame) ||
    !Array.isArray(proof.frames) ||
    !Array.isArray(proof.callbacks) ||
    !object(proof.counters) ||
    !Array.isArray(proof.reasons) ||
    !object(proof.caps)
  ) {
    fail("RAW_ARRAY_OR_COUNTER_SCHEMA");
    return result();
  }
  if (
    events.length > caps.events ||
    proof.frames.length > V3_LIMITS.proofs ||
    proof.callbacks.length > V3_LIMITS.callbacks ||
    ui.frame.length > V3_LIMITS.rawFrames
  ) {
    fail("INPUT_CAP");
    return result();
  }
  // Do this before any event filtering: null/arrays/primitives cannot vanish behind a good task.
  if (events.some((event) => !object(event))) {
    fail("EVENT_OBJECT_SCHEMA");
    return result();
  }
  if (
    proof.frames.some((row) => !object(row)) ||
    proof.callbacks.some((row) => !object(row)) ||
    ui.frame.some((row) => !object(row))
  ) {
    fail("RAW_ROW_SCHEMA");
    return result();
  }
  for (const event of events)
    if (typeof event.name !== "string" || event.name.length > caps.metadataNameCharacters)
      fail("EVENT_NAME_SCHEMA_OR_CAP");
  if (reasons.size) return result();
  if (
    typeof window.collectionId !== "string" ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(window.collectionId) ||
    proof.collectionId !== window.collectionId
  )
    fail("COLLECTION_ID");
  const id = window.collectionId;
  if (
    window.beginMarkName !== `reflection-profile.begin.${id}` ||
    window.endMarkName !== `reflection-profile.end.${id}`
  )
    fail("ANCHOR_NAME_IDENTITY");
  const origin = ui.startedAtPerformanceMs,
    duration = ui.sampleMilliseconds,
    finish = window.endPerformanceMs;
  if (
    ![origin, duration, finish].every(Number.isFinite) ||
    duration <= 0 ||
    window.beginPerformanceMs !== origin ||
    finish - origin !== duration
  )
    fail("PERFORMANCE_WINDOW");
  if (
    proof.closed !== true ||
    proof.state !== "CLOSED" ||
    proof.markLifetime !== "RETAIN_THROUGH_TRACE_CLOSE" ||
    proof.reasons.length !== 0 ||
    ui.droppedSamples !== 0
  )
    fail("COLLECTION_LIFECYCLE_OR_LOSS");
  const counter = proof.counters;
  for (const key of [
    "callbacksObserved",
    "representativeFrames",
    "additionalCallbacks",
    "registrationsObserved",
    "cancellationsObserved",
    "precollectionRegistrations",
    "droppedProofs",
    "droppedCallbacks",
    "capHits",
    "precollectionCancellations",
    "precollectionPendingAtBegin",
    "samplesAfterClose",
    "emittedMarks",
    "markNameBytes",
    "clearedMarks",
    "pendingAtClose",
  ])
    if (!Number.isSafeInteger(counter[key]) || counter[key] < 0) fail("COUNTER_SCHEMA");
  if (
    ["droppedProofs", "droppedCallbacks", "capHits", "samplesAfterClose", "clearedMarks"].some(
      (key) => counter[key] !== 0,
    )
  )
    fail("CAP_DROP_CLOSE_OR_UNQUALIFIED_CLEAR");
  if (
    counter.callbacksObserved !== proof.callbacks.length ||
    counter.representativeFrames !== proof.frames.length ||
    counter.additionalCallbacks !== proof.callbacks.length - proof.frames.length ||
    counter.emittedMarks !== proof.frames.length ||
    counter.pendingAtClose > V3_LIMITS.pendingHandles ||
    counter.precollectionPendingAtBegin > V3_LIMITS.pendingHandles ||
    counter.registrationsObserved > V3_LIMITS.callbacks ||
    counter.precollectionRegistrations > V3_LIMITS.callbacks ||
    counter.registrationsObserved + counter.precollectionPendingAtBegin < proof.callbacks.length ||
    counter.markNameBytes > V3_LIMITS.markNameBytes ||
    proof.frames.length < 2 ||
    proof.frames.length !== ui.frame.length
  )
    fail("COUNT_ACCOUNTING");
  for (const [key, value] of Object.entries(V3_LIMITS))
    if (proof.caps[key] !== value) fail("UNSUPPORTED_COLLECTION_CAPS");
  if (context.traceDataLoss !== false || context.traceStreamClosed !== true)
    fail("TRACE_LOSS_OR_UNKNOWN_CLOSE");
  const before = context.documentBefore,
    after = context.documentAfter;
  const documentSchema = (value) =>
    object(value) &&
    ["id", "loaderId", "url"].every(
      (key) =>
        typeof value[key] === "string" &&
        value[key].length > 0 &&
        value[key].length <= (key === "url" ? 8192 : 512),
    );
  if (
    !documentSchema(before) ||
    !documentSchema(after) ||
    before.id !== after.id ||
    before.loaderId !== after.loaderId ||
    before.url !== after.url
  )
    fail("DOCUMENT_CHANGED_OR_UNKNOWN");
  const beginCandidates = events.filter((event) => event.name === window.beginMarkName);
  const endCandidates = events.filter((event) => event.name === window.endMarkName);
  if (beginCandidates.length !== 1 || endCandidates.length !== 1) {
    fail("ANCHOR_MULTIPLICITY");
    return result();
  }
  const b = beginCandidates[0],
    e = endCandidates[0];
  const pid = b.pid,
    tid = b.tid,
    navigation = b.args?.data?.navigationId;
  if (
    !positiveId(pid) ||
    !positiveId(tid) ||
    typeof navigation !== "string" ||
    navigation.length === 0 ||
    navigation.length > caps.metadataNameCharacters ||
    !markShape(b) ||
    !markShape(e) ||
    e.pid !== pid ||
    e.tid !== tid ||
    e.args?.data?.navigationId !== navigation ||
    !(e.ts > b.ts)
  )
    fail("ANCHOR_SCHEMA_OR_IDENTITY");
  const sameThread = (event) => event.pid === pid && event.tid === tid;
  const threadNames = events.filter((event) => event.name === "thread_name" && sameThread(event));
  if (
    !threadNames.length ||
    threadNames.some((event) => event.ph !== "M" || event.args?.name !== "CrRendererMain")
  )
    fail("MISSING_OR_CONFLICTING_RENDERER_MAIN");
  const proofMarks = new Map(),
    firesByHandle = new Map(),
    requestsByHandle = new Map();
  const wantedHandles = new Set(proof.callbacks.map((row) => row.requestHandle));
  const index = (map, key, event) => {
    const bucket = map.get(key) ?? [];
    bucket.push(event);
    map.set(key, bucket);
  };
  for (const event of events) {
    if (event.name.startsWith("rlab-v3.observe.")) index(proofMarks, event.name, event);
    if (!["FireAnimationFrame", "RequestAnimationFrame"].includes(event.name)) continue;
    if (
      wantedHandles.has(event.args?.data?.id) &&
      (!positiveId(event.pid) || !positiveId(event.tid))
    )
      fail("UNKNOWN_CALLBACK_EVENT_IDENTITY");
    if (!sameThread(event)) continue;
    if (event.name === "FireAnimationFrame") index(firesByHandle, event.args?.data?.id, event);
    else index(requestsByHandle, event.args?.data?.id, event);
  }
  // pid/tid zero is legitimate on unrelated metadata; named native task identity must be explicit.
  let nativeTaskCandidates = 0,
    excludedOtherThreadTasks = 0,
    validatedInstantTasks = 0;
  const tasks = [];
  for (const event of events) {
    if (!taskNames.has(event.name)) continue;
    nativeTaskCandidates++;
    if (nativeTaskCandidates > caps.relevantTasks) {
      fail("TASK_CANDIDATE_CAP");
      continue;
    }
    if (!positiveId(event.pid) || !positiveId(event.tid)) {
      fail("UNKNOWN_TASK_IDENTITY");
      continue;
    }
    if (!sameThread(event)) {
      excludedOtherThreadTasks++;
      continue;
    }
    // ALL same-renderer candidates, including outside the window, must pass BEFORE overlap selection.
    if (event.ph === "I") {
      const a = event.args;
      const valid =
        event.name === "ThreadControllerImpl::RunTask" &&
        event.cat === "toplevel" &&
        event.s === "t" &&
        Number.isFinite(event.ts) &&
        !Object.hasOwn(event, "dur") &&
        object(a) &&
        typeof a.src_file === "string" &&
        a.src_file.length > 0 &&
        a.src_file.length <= 4096 &&
        typeof a.src_func === "string" &&
        a.src_func.length > 0 &&
        a.src_func.length <= 4096 &&
        Number.isSafeInteger(a.src_line) &&
        a.src_line > 0 &&
        a.src_line <= 10000000;
      if (!valid) fail("RENDERER_TASK_SCHEMA_OR_CATEGORY");
      else validatedInstantTasks++;
      continue;
    }
    if (!span(event) || !category(event, "toplevel")) {
      fail("RENDERER_TASK_SCHEMA_OR_CATEGORY");
      continue;
    }
    tasks.push(event);
  }
  const names = new Set(),
    handles = new Set();
  let previous = -Infinity,
    nameBytes = 0;
  for (let index = 0; index < proof.frames.length; index++) {
    const row = proof.frames[index],
      sample = ui.frame[index];
    if (
      !Number.isSafeInteger(row.ordinal) ||
      !handle(row.requestHandle) ||
      !["rawRafBits", "observedNowBits", "markName"].every((key) => typeof row[key] === "string")
    ) {
      fail("PROOF_ROW_SCHEMA");
      continue;
    }
    if (
      row.ordinal !== index + 1 ||
      row.collectionId !== id ||
      !handle(row.requestHandle) ||
      handles.has(row.requestHandle)
    )
      fail("PROOF_IDENTITY");
    handles.add(row.requestHandle);
    if (
      ![row.rawRafMs, row.observedNowMs].every(Number.isFinite) ||
      !(row.rawRafMs > previous) ||
      row.rawRafMs > finish ||
      row.observedNowMs < origin ||
      row.observedNowMs > finish
    )
      fail("RAW_ORDER_OR_WINDOW");
    previous = row.rawRafMs;
    if (
      row.rawRafBits !== bits(row.rawRafMs) ||
      row.observedNowBits !== bits(row.observedNowMs) ||
      row.markName !== observationName(id, row) ||
      names.has(row.markName) ||
      row.markName.length > caps.proofNameCharacters ||
      !Number.isFinite(sample.timestamp) ||
      !Number.isFinite(sample.callbackObservedAtPerformanceMs) ||
      bits(sample.timestamp) !== row.rawRafBits ||
      bits(sample.callbackObservedAtPerformanceMs) !== row.observedNowBits ||
      sample.collectionId !== id
    )
      fail("EXACT_BITS_OR_NAME_BINDING");
    names.add(row.markName);
    nameBytes += typeof row.markName === "string" ? row.markName.length : 0;
    rawOrderDiagnostic.push({
      ordinal: row.ordinal,
      nativeAfterObserved: row.rawRafMs > row.observedNowMs,
      rawNativeMinusObservedMs: row.rawRafMs - row.observedNowMs,
    });
    const marks = proofMarks.get(row.markName) ?? [];
    // Match handle+thread before document/phase/category validation; wrong candidates cannot be hidden.
    const fires = firesByHandle.get(row.requestHandle) ?? [];
    if (marks.length !== 1 || fires.length !== 1) {
      fail("PROOF_MARK_OR_FIRE_MULTIPLICITY");
      continue;
    }
    const mark = marks[0],
      fire = fires[0],
      callTime = mark.args?.data?.callTime;
    if (
      !markShape(mark) ||
      !sameThread(mark) ||
      mark.args?.data?.navigationId !== navigation ||
      !Number.isFinite(callTime)
    )
      fail("OBSERVATION_MARK_SCHEMA_OR_IDENTITY");
    if (
      !span(fire) ||
      !category(fire, "devtools.timeline") ||
      fire.args?.data?.frame !== before?.id
    )
      fail("FIRE_SCHEMA_CATEGORY_OR_DOCUMENT");
    if (
      !Number.isFinite(callTime) ||
      callTime < fire.ts ||
      callTime > fire.ts + fire.dur ||
      fire.ts < b.ts ||
      fire.ts + fire.dur > e.ts ||
      callTime < b.ts ||
      callTime > e.ts
    )
      fail("PHYSICAL_CALLTIME_OR_FIRE_OUTSIDE_NATIVE_WINDOW");
    const requests = requestsByHandle.get(row.requestHandle) ?? [];
    if (requests.length > 1) fail("REQUEST_AMBIGUITY");
    const requestValid =
      requests.length === 1 &&
      ["I", "R"].includes(requests[0].ph) &&
      category(requests[0], "devtools.timeline") &&
      Number.isFinite(requests[0].ts) &&
      requests[0].ts <= fire.ts &&
      requests[0].args?.data?.frame === before?.id;
    if (requests.length === 1 && !requestValid) fail("MALFORMED_PRESENT_REQUEST");
    evidence.push({
      ordinal: row.ordinal,
      requestHandle: row.requestHandle,
      fireTsUs: fire.ts,
      fireDurationUs: fire.dur,
      observationCallTimeUs: callTime,
      observationMarkTsUs: mark.ts,
      requestCorroboration: requestValid ? "VALIDATED_CAPTURED" : "NOT_CAPTURED_NOT_REQUIRED",
    });
  }
  if (nameBytes !== counter.markNameBytes) fail("MARK_NAME_BYTE_ACCOUNTING");
  const callbackHandles = new Set(),
    grouped = new Map(),
    firstByGroup = new Map();
  for (let index = 0; index < proof.callbacks.length; index++) {
    const callback = proof.callbacks[index],
      represented = Number.isSafeInteger(callback.representedByOrdinal)
        ? proof.frames[callback.representedByOrdinal - 1]
        : undefined;
    if (
      callback.collectionId !== id ||
      callback.callbackOrdinal !== index + 1 ||
      !handle(callback.requestHandle) ||
      !Number.isSafeInteger(callback.representedByOrdinal) ||
      callback.representedByOrdinal < 1 ||
      callbackHandles.has(callback.requestHandle) ||
      !represented ||
      callback.rawRafBits !== represented.rawRafBits ||
      ![callback.rawRafMs, callback.observedNowMs].every(Number.isFinite) ||
      callback.rawRafBits !== bits(callback.rawRafMs) ||
      callback.observedNowBits !== bits(callback.observedNowMs) ||
      callback.observedNowMs < origin ||
      callback.observedNowMs > finish
    )
      fail("CALLBACK_ACCOUNTING");
    callbackHandles.add(callback.requestHandle);
    const native = firesByHandle.get(callback.requestHandle) ?? [];
    if (
      native.length !== 1 ||
      !span(native[0]) ||
      !category(native[0], "devtools.timeline") ||
      native[0].args?.data?.frame !== before?.id ||
      native[0].ts < b.ts ||
      native[0].ts + native[0].dur > e.ts
    )
      fail("CALLBACK_NATIVE_IDENTITY");
    grouped.set(
      callback.representedByOrdinal,
      (grouped.get(callback.representedByOrdinal) ?? 0) + 1,
    );
    if (!firstByGroup.has(callback.representedByOrdinal))
      firstByGroup.set(callback.representedByOrdinal, callback);
  }
  for (let index = 0; index < ui.frame.length; index++) {
    const first = firstByGroup.get(index + 1);
    if (
      !first ||
      first.requestHandle !== proof.frames[index].requestHandle ||
      first.callbackOrdinal !== proof.frames[index].callbackOrdinal ||
      first.observedNowBits !== proof.frames[index].observedNowBits ||
      ui.frame[index].callbacks !== grouped.get(index + 1)
    )
      fail("RAW_RAF_GROUP_COUNT");
  }
  for (const event of events)
    if (event.name.startsWith("rlab-v3.observe.") && !names.has(event.name))
      fail("UNKNOWN_OR_FOREIGN_PROOF");
  const selected = tasks.filter((task) => task.ts + task.dur >= b.ts && task.ts <= e.ts);
  if (!selected.length) fail("MISSING_NATIVE_RENDERER_TASK");
  const answer = result();
  return {
    ...answer,
    begin: b.ts,
    end: e.ts,
    expectedPid: pid,
    expectedTid: tid,
    expectedNavigationId: navigation,
    nativeTaskCandidates,
    excludedOtherThreadTasks,
    validatedInstantTasks,
    validatedTasks: tasks,
  };
}

// Exact V2 analyzeTrace numeric block: no epsilon, clock shift, rebin, rounding, or duration scaling.
// Only dependency substitutions: validated tasks/identity and already-qualified V3 boundaries.
// prettier-ignore
export function unchangedNumericV3(ui, validated) {
  const reject = (reason) => ({ status: 'UNVERIFIED', reasons: [reason], mainTaskOccupancyMs: [], nativeTraceBinBoundariesUs: [], complete: false });
  if (!object(ui) || !object(validated) || !Array.isArray(ui.frame) || !object(ui.collectionWindow) || !Array.isArray(validated.validatedTasks))
    return reject('INPUT_SHAPE');
  if (validated.qualified !== true) return reject('NATIVE_ELIGIBILITY_REQUIRED');
  if (ui.frame.length > V3_LIMITS.rawFrames || validated.validatedTasks.length > SHORT_TRACE_CAPS.relevantTasks) return reject('INPUT_CAP');
  const values = [ui.startedAtPerformanceMs, ui.sampleMilliseconds, ui.collectionWindow.endPerformanceMs, validated.begin, validated.end];
  if (!values.every(Number.isFinite)) return reject('NONFINITE_INPUT');
  if (ui.sampleMilliseconds <= 0 || ui.collectionWindow.endPerformanceMs <= ui.startedAtPerformanceMs || validated.end <= validated.begin)
    return reject('NONPOSITIVE_WINDOW');
  if (ui.collectionWindow.endPerformanceMs - ui.startedAtPerformanceMs !== ui.sampleMilliseconds) return reject('DURATION_MISMATCH');
  if (!Number.isFinite(validated.end - validated.begin)) return reject('ORDERED_OVERFLOW');
  let priorRaw = -Infinity;
  for (const row of ui.frame) {
    if (!object(row) || !Number.isFinite(row.timestamp)) return reject('NONFINITE_INPUT');
    if (row.timestamp <= priorRaw || row.timestamp > ui.collectionWindow.endPerformanceMs) return reject('RAW_ORDER_OR_WINDOW');
    priorRaw = row.timestamp;
  }
  // Validate every task before unchanged overlap selection, including malformed outside-window tasks.
  for (const task of validated.validatedTasks) {
    if (!object(task) || typeof task.ts !== 'number' || typeof task.dur !== 'number') return reject('TASK_SHAPE');
    if (!Number.isFinite(task.ts) || !Number.isFinite(task.dur)) return reject('NONFINITE_INPUT');
    if (task.dur < 0) return reject('NEGATIVE_DURATION');
    if (!Number.isFinite(task.ts + task.dur)) return reject('ORDERED_OVERFLOW');
  }
  const begin = validated.begin, end = validated.end;
  const selected = validated.validatedTasks
    .map((event) => [`${event.pid}:${event.tid}`, event.ts, event.ts + event.dur])
    .filter(([, start, stop]) => stop >= begin && start <= end)
    .map(([, start, stop]) => [Math.max(start, begin), Math.min(stop, end)])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const item of selected) {
    const previous = merged.at(-1);
    if (previous && item[0] <= previous[1]) previous[1] = Math.max(previous[1], item[1]);
    else merged.push([...item]);
  }
  const origin = ui.startedAtPerformanceMs, performanceDurationMs = ui.sampleMilliseconds;
  const performanceBins = [origin, ...ui.frame.map((row) => row.timestamp).filter((time) => time > origin && time < ui.collectionWindow.endPerformanceMs), ui.collectionWindow.endPerformanceMs];
  const frameBoundaries = performanceBins.map((time) => begin + ((time - origin) / performanceDurationMs) * (end - begin)),
    cpu = Array.from({ length: Math.max(0, frameBoundaries.length - 1) }, () => 0);
  let frameIndex = 0;
  for (const [taskStart, taskEnd] of merged) {
    const start = taskStart, stop = taskEnd;
    while (frameIndex + 1 < frameBoundaries.length && frameBoundaries[frameIndex + 1] <= start) frameIndex++;
    for (let i = frameIndex; i + 1 < frameBoundaries.length && frameBoundaries[i] < stop; i++)
      cpu[i] += Math.max(0, Math.min(stop, frameBoundaries[i + 1]) - Math.max(start, frameBoundaries[i])) / 1000;
  }
  const complete = selected.length > 0 && selected[0][0] - begin <= 50000 && end - selected.at(-1)[1] <= 50000;
  return { mainTaskOccupancyMs: complete ? cpu : [], nativeTraceBinBoundariesUs: frameBoundaries,
    performanceBins, complete, nativeTaskCount: selected.length, mergedTaskCount: merged.length, mergedNativeTasks: merged };
}
export function analyzeFrameCoverageV3(frame, ui, traceCoverage = {}) {
  const times = Array.isArray(frame) ? frame.map((row) => row?.timestamp) : [];
  const rawFiniteAndStrictlyOrdered =
    times.length >= 2 &&
    times.every((time, index) => Number.isFinite(time) && (!index || time > times[index - 1]));
  const membership = traceCoverage.nativeV3Qualified === true;
  return {
    measurementBoundaryVersion: "3.0.0",
    complete: rawFiniteAndStrictlyOrdered && membership,
    rawFiniteAndStrictlyOrdered,
    membershipProofValid: membership,
    collectionMembershipValid: membership,
    rawLeadingOffsetsMs: times
      .filter((time) => time < ui.startedAtPerformanceMs)
      .map((time) => time - ui.startedAtPerformanceMs),
    boundaries: membership
      ? [
          ui.startedAtPerformanceMs,
          ...times.filter(
            (time) =>
              time > ui.startedAtPerformanceMs && time < ui.collectionWindow.endPerformanceMs,
          ),
          ui.collectionWindow.endPerformanceMs,
        ]
      : [],
  };
}
export async function analyzeTraceV3(filename, ui, context, options = {}) {
  try {
    if (!object(options)) throw new Error("TRACE_CAP_CONTRACT");
    const caps = options.caps === undefined ? SHORT_TRACE_CAPS : options.caps;
    if (!supportedCaps(caps)) throw new Error("TRACE_CAP_CONTRACT");
    if ((await stat(filename)).size > caps.compressedBytes) throw new Error("COMPRESSED_TRACE_CAP");
    const chunks = [];
    let bytes = 0;
    const input = createReadStream(filename),
      gunzip = createGunzip();
    // Observe the pipeline rejection immediately; await it after both streams settle.
    const transferred = pipeline(input, gunzip).then(
      () => null,
      (error) => error,
    );
    try {
      for await (const chunk of gunzip) {
        bytes += chunk.byteLength;
        if (bytes > caps.decompressedBytes) throw new Error("DECOMPRESSED_TRACE_CAP");
        chunks.push(chunk);
      }
      const transferError = await transferred;
      if (transferError) throw transferError;
    } finally {
      input.destroy();
      gunzip.destroy();
      await transferred;
    }
    const trace = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes)),
    );
    const native = validateNativeV3(ui, trace?.traceEvents, context, caps);
    const numeric = unchangedNumericV3(ui, native);
    return {
      ...numeric,
      parsedTraceEvents: Array.isArray(trace?.traceEvents) ? trace.traceEvents.length : 0,
      rendererMainThreads: native.qualified ? [`${native.expectedPid}:${native.expectedTid}`] : [],
      nativeEligibility: { ...native, validatedTasks: undefined },
      coverage: {
        complete: native.qualified && numeric.complete,
        nativeV3Qualified: native.qualified,
        beginMarkTsUs: native.begin ?? null,
        endMarkTsUs: native.end ?? null,
        markedDurationMs: native.qualified ? (native.end - native.begin) / 1000 : null,
        frameCoverage: analyzeFrameCoverageV3(ui.frame, ui, {
          nativeV3Qualified: native.qualified,
        }),
        clockCorrelation: {
          nativeTraceBinBoundariesUs: numeric.nativeTraceBinBoundariesUs,
          method:
            "Original two-anchor binary64 mapping; native task union/intersection converted only /1000.",
        },
      },
      method:
        "V3 native identity/callTime eligibility, then unchanged V2 native task occupancy arithmetic. Observer included.",
    };
  } catch (error) {
    return {
      parsedTraceEvents: null,
      rendererMainThreads: [],
      mainTaskOccupancyMs: [],
      nativeEligibility: {
        qualified: false,
        status: "UNVERIFIED",
        reasons: [String(error.message ?? error)],
      },
      coverage: { complete: false, nativeV3Qualified: false, markedDurationMs: null },
      formalQualification: "NOT_APPROVED",
    };
  }
}

// Full-event schema inspection precedes bounded retention. Numeric arithmetic remains the V2 derivative.
export async function analyzeTraceStreamV3(filename, ui, context) {
  const retained = [];
  let retainedBytes = 0,
    maxHeapBytes = 0;
  try {
    const stats = await parseTraceStream(
      filename,
      (event) => {
        if (!object(event)) throw Error("EVENT_OBJECT_SCHEMA");
        if (
          typeof event.name !== "string" ||
          event.name.length > FORMAL_TRACE_CAPS.metadataNameCharacters
        )
          throw Error("EVENT_NAME_SCHEMA_OR_CAP");
        const heap = process.memoryUsage().heapUsed;
        maxHeapBytes = Math.max(maxHeapBytes, heap);
        if (heap > FORMAL_TRACE_CAPS.heapBytes) throw Error("HEAP_CAP");
        if (
          taskNames.has(event.name) ||
          ["FireAnimationFrame", "RequestAnimationFrame", "thread_name"].includes(event.name) ||
          event.name.startsWith("rlab-v3.observe.") ||
          event.name === ui?.collectionWindow?.beginMarkName ||
          event.name === ui?.collectionWindow?.endMarkName
        ) {
          retainedBytes += Buffer.byteLength(JSON.stringify(event), "utf8");
          if (retainedBytes > FORMAL_TRACE_CAPS.retainedSerializedBytes)
            throw Error("RETAINED_BYTES_CAP");
          retained.push(event);
        }
      },
      {
        caps: {
          compressedBytes: FORMAL_TRACE_CAPS.compressedBytes,
          decodedBytes: FORMAL_TRACE_CAPS.decompressedBytes,
          events: FORMAL_TRACE_CAPS.events,
          timeoutMs: 300000,
        },
      },
    );
    const native = validateNativeV3(ui, retained, context, FORMAL_TRACE_CAPS);
    if (process.memoryUsage().heapUsed > FORMAL_TRACE_CAPS.heapBytes) throw Error("HEAP_CAP");
    const numeric = unchangedNumericV3(ui, native);
    if (process.memoryUsage().heapUsed > FORMAL_TRACE_CAPS.heapBytes) throw Error("HEAP_CAP");
    return {
      ...numeric,
      parsedTraceEvents: stats.events,
      rendererMainThreads: native.qualified ? [`${native.expectedPid}:${native.expectedTid}`] : [],
      nativeEligibility: { ...native, validatedTasks: undefined },
      streamStats: {
        ...stats,
        retainedEvents: retained.length,
        retainedSerializedBytes: retainedBytes,
        maxObservedHeapBytes: maxHeapBytes,
      },
      analysisContext: context,
      coverage: {
        complete: native.qualified && numeric.complete,
        nativeV3Qualified: native.qualified,
        beginMarkTsUs: native.begin ?? null,
        endMarkTsUs: native.end ?? null,
        markedDurationMs: native.qualified ? (native.end - native.begin) / 1000 : null,
        frameCoverage: analyzeFrameCoverageV3(ui.frame, ui, {
          nativeV3Qualified: native.qualified,
        }),
        clockCorrelation: {
          nativeTraceBinBoundariesUs: numeric.nativeTraceBinBoundariesUs,
          method:
            "Original two-anchor binary64 mapping; native task union/intersection converted only /1000.",
        },
      },
      method:
        "V3 full-event streamed validation and native identity/callTime eligibility, then unchanged V2 occupancy arithmetic. Observer included.",
    };
  } catch (error) {
    return {
      parsedTraceEvents: null,
      rendererMainThreads: [],
      mainTaskOccupancyMs: [],
      nativeEligibility: {
        qualified: false,
        status: "UNVERIFIED",
        reasons: [String(error.message ?? error)],
      },
      coverage: { complete: false, nativeV3Qualified: false, markedDurationMs: null },
      analysisContext: context,
      formalQualification: "NOT_APPROVED",
    };
  }
}

// Versioned formal sibling retains identical stream eligibility and changes only the numeric kernel.
export async function analyzeFormalTraceStreamV3(filename, ui, context) {
  const retained = [];
  let retainedBytes = 0,
    maxHeapBytes = 0;
  try {
    const stats = await parseTraceStream(
      filename,
      (event) => {
        if (!object(event)) throw Error("EVENT_OBJECT_SCHEMA");
        if (
          typeof event.name !== "string" ||
          event.name.length > FORMAL_TRACE_CAPS.metadataNameCharacters
        )
          throw Error("EVENT_NAME_SCHEMA_OR_CAP");
        const heap = process.memoryUsage().heapUsed;
        maxHeapBytes = Math.max(maxHeapBytes, heap);
        if (heap > FORMAL_TRACE_CAPS.heapBytes) throw Error("HEAP_CAP");
        if (
          taskNames.has(event.name) ||
          ["FireAnimationFrame", "RequestAnimationFrame", "thread_name"].includes(event.name) ||
          event.name.startsWith("rlab-v3.observe.") ||
          event.name === ui?.collectionWindow?.beginMarkName ||
          event.name === ui?.collectionWindow?.endMarkName
        ) {
          retainedBytes += Buffer.byteLength(JSON.stringify(event), "utf8");
          if (retainedBytes > FORMAL_TRACE_CAPS.retainedSerializedBytes)
            throw Error("RETAINED_BYTES_CAP");
          retained.push(event);
        }
      },
      {
        caps: {
          compressedBytes: FORMAL_TRACE_CAPS.compressedBytes,
          decodedBytes: FORMAL_TRACE_CAPS.decompressedBytes,
          events: FORMAL_TRACE_CAPS.events,
          timeoutMs: 300000,
        },
      },
    );
    const native = validateNativeV3(ui, retained, context, FORMAL_TRACE_CAPS);
    if (process.memoryUsage().heapUsed > FORMAL_TRACE_CAPS.heapBytes) throw Error("HEAP_CAP");
    const numeric = formalNumericV3(ui, native);
    if (process.memoryUsage().heapUsed > FORMAL_TRACE_CAPS.heapBytes) throw Error("HEAP_CAP");
    return {
      ...numeric,
      parsedTraceEvents: stats.events,
      rendererMainThreads: native.qualified ? [`${native.expectedPid}:${native.expectedTid}`] : [],
      nativeEligibility: { ...native, validatedTasks: undefined },
      streamStats: {
        ...stats,
        retainedEvents: retained.length,
        retainedSerializedBytes: retainedBytes,
        maxObservedHeapBytes: maxHeapBytes,
      },
      analysisContext: context,
      coverage: {
        complete: native.qualified && numeric.complete,
        nativeV3Qualified: native.qualified,
        beginMarkTsUs: native.begin ?? null,
        endMarkTsUs: native.end ?? null,
        markedDurationMs: native.qualified ? (native.end - native.begin) / 1000 : null,
        frameCoverage: analyzeFrameCoverageV3(ui.frame, ui, {
          nativeV3Qualified: native.qualified,
        }),
        clockCorrelation: {
          nativeTraceBinBoundariesUs: numeric.nativeTraceBinBoundariesUs,
          method:
            "Original two-anchor binary64 mapping; native task union/intersection converted only /1000.",
        },
      },
      method:
        "V3 full-event streamed validation and native identity/callTime eligibility, then formal-cap V2 occupancy arithmetic. Observer included.",
    };
  } catch (error) {
    return {
      parsedTraceEvents: null,
      rendererMainThreads: [],
      mainTaskOccupancyMs: [],
      nativeEligibility: {
        qualified: false,
        status: "UNVERIFIED",
        reasons: [String(error.message ?? error)],
      },
      coverage: { complete: false, nativeV3Qualified: false, markedDurationMs: null },
      analysisContext: context,
      formalQualification: "NOT_APPROVED",
    };
  }
}
