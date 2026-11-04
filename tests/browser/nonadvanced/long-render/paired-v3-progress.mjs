const FILE_FIELDS = new Set(["id", "filename", "bytes", "sha256", "frames", "channels", "rate"]);
const GRAPH_FIELDS = new Set([
  "id",
  "frames",
  "contextFrames",
  "tailFrames",
  "peak",
  "outsideUnit",
  "nonfinite",
  "controlSha256",
  "startedAtUtc",
  "finishedAtUtc",
  "renderMs",
  "persistMs",
  "estimatedWorkingBytes",
]);
const COMPARISON_FIELDS = new Set(["id", "actualId", "referenceId", "frames", "summary"]);
const SUMMARY_FIELDS = new Set([
  "frames",
  "channels",
  "sampleRateHz",
  "tolerance",
  "actualFrames",
  "referenceFrames",
  "comparedSamples",
  "maxError",
  "seamError",
  "tailError",
  "rmsError",
  "firstOver",
  "atMax",
  "overCount",
  "perSecondMax",
  "nonfinite",
]);
const POINT_FIELDS = new Set(["frame", "channel", "actual", "reference", "error"]);
const NONFINITE_FIELDS = new Set(["count", "actual", "reference", "difference", "first"]);
const FIRST_INVALID_FIELDS = new Set(["frame", "channel", "actual", "reference"]);
const TIMING_FIELDS = new Set(["stage", "id", "elapsedMs"]);
const SNAPSHOT_FIELDS = new Set([
  "schemaVersion",
  "phase",
  "status",
  "productComplete",
  "downloads",
  "independentParser",
  "files",
  "graphs",
  "comparisons",
  "timings",
  "overflow",
  "error",
]);
const HASH = /^[a-f0-9]{64}$/;
const MAX_PARTIAL_BYTES = 2 * 1024 * 1024;

function metadata(condition) {
  if (!condition) throw new Error("PAIRED_V3_PROGRESS_METADATA");
}
function fields(value, allowed) {
  metadata(
    value !== null &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
  for (const key of Reflect.ownKeys(value)) {
    metadata(typeof key === "string" && allowed.has(key));
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    metadata(descriptor && "value" in descriptor);
  }
}
function text(value, max = 2048) {
  metadata(typeof value === "string" && value.length <= max);
}
function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  metadata(Number.isSafeInteger(value) && value >= minimum && value <= maximum);
}
function finite(value, minimum = 0) {
  metadata(Number.isFinite(value) && value >= minimum);
}
function sampleNumber(value) {
  metadata(typeof value === "number");
}
function nonnegativeError(value) {
  metadata(typeof value === "number" && value >= 0);
}
function array(value, maximum) {
  metadata(
    Array.isArray(value) &&
      Object.getPrototypeOf(value) === Array.prototype &&
      value.length <= maximum,
  );
  for (const key of Reflect.ownKeys(value)) {
    metadata(
      key === "length" ||
        (typeof key === "string" && /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length),
    );
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    metadata(descriptor && "value" in descriptor);
  }
}
function file(value) {
  fields(value, FILE_FIELDS);
  text(value.id, 256);
  text(value.filename, 256);
  integer(value.bytes, 56, 192 * 1024 * 1024);
  integer(value.frames, 0, 75 * 48000);
  metadata(
    value.channels === 2 &&
      value.rate === 48000 &&
      typeof value.sha256 === "string" &&
      HASH.test(value.sha256),
  );
  metadata(value.bytes === 56 + value.frames * 8);
}
function graph(value) {
  fields(value, GRAPH_FIELDS);
  text(value.id, 256);
  integer(value.frames, 0, 75 * 48000);
  integer(value.contextFrames, value.frames, 75 * 48000);
  integer(value.tailFrames);
  finite(value.peak);
  integer(value.outsideUnit);
  integer(value.nonfinite);
  metadata(typeof value.controlSha256 === "string" && HASH.test(value.controlSha256));
  text(value.startedAtUtc, 64);
  text(value.finishedAtUtc, 64);
  finite(value.renderMs);
  finite(value.persistMs);
  integer(value.estimatedWorkingBytes);
}
function point(value) {
  if (value === null) return;
  fields(value, POINT_FIELDS);
  integer(value.frame);
  integer(value.channel, 0, 1);
  sampleNumber(value.actual);
  sampleNumber(value.reference);
  nonnegativeError(value.error);
}
function invalidValue(value) {
  metadata(
    typeof value === "number" || ["NaN", "+Infinity", "-Infinity", "non-number"].includes(value),
  );
}
function summary(value) {
  fields(value, SUMMARY_FIELDS);
  integer(value.frames, 0, 75 * 48000);
  integer(value.actualFrames, value.frames);
  integer(value.referenceFrames, value.frames);
  metadata(value.channels === 2 && value.sampleRateHz === 48000 && value.tolerance === 2e-6);
  metadata(value.comparedSamples === value.frames * 2);
  for (const key of ["maxError", "seamError", "tailError", "rmsError"])
    nonnegativeError(value[key]);
  integer(value.overCount, 0, value.comparedSamples);
  point(value.firstOver);
  point(value.atMax);
  array(value.perSecondMax, 75);
  metadata(value.perSecondMax.length === Math.ceil(value.frames / 48000));
  for (const entry of value.perSecondMax) nonnegativeError(entry);
  fields(value.nonfinite, NONFINITE_FIELDS);
  for (const key of ["count", "actual", "reference", "difference"])
    integer(value.nonfinite[key], 0, value.comparedSamples);
  if (value.nonfinite.first !== null) {
    fields(value.nonfinite.first, FIRST_INVALID_FIELDS);
    integer(value.nonfinite.first.frame);
    integer(value.nonfinite.first.channel, 0, 1);
    invalidValue(value.nonfinite.first.actual);
    invalidValue(value.nonfinite.first.reference);
  }
}
function comparison(value) {
  fields(value, COMPARISON_FIELDS);
  text(value.id, 256);
  text(value.actualId, 256);
  text(value.referenceId, 256);
  integer(value.frames, 0, 75 * 48000);
  summary(value.summary);
  metadata(value.summary.frames === value.frames);
}
function timing(value) {
  fields(value, TIMING_FIELDS);
  text(value.stage, 256);
  text(value.id, 256);
  finite(value.elapsedMs);
}
function freezeMetadata(value) {
  if (value && typeof value === "object") {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value)))
      if ("value" in descriptor) freezeMetadata(descriptor.value);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}
function validateSnapshot(value) {
  fields(value, SNAPSHOT_FIELDS);
  metadata(value.schemaVersion === "paired-v3-progress-v1");
  metadata(["IN_PROGRESS", "INCOMPLETE", "BROWSER_COMPLETE"].includes(value.phase));
  metadata(["RUNNING", "PASS", "FAIL", "ERROR"].includes(value.status));
  metadata(
    value.productComplete === false &&
      value.downloads === "NOT_COMPLETED" &&
      value.independentParser === "NOT_COMPLETED",
  );
  array(value.files, 4);
  array(value.graphs, 4);
  array(value.comparisons, 6);
  array(value.timings, 128);
  for (const entry of value.files) file(entry);
  for (const entry of value.graphs) graph(entry);
  for (const entry of value.comparisons) comparison(entry);
  for (const entry of value.timings) timing(entry);
  fields(value.overflow, new Set(["timings"]));
  integer(value.overflow.timings);
  metadata(value.error === null || (typeof value.error === "string" && value.error.length <= 2048));
  metadata(new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_PARTIAL_BYTES);
  return value;
}

/** Only fixed, validated metadata references are retained. Never PCM, Blob, source or native objects. */
export function createPairedV3Progress() {
  const files = [],
    graphs = [],
    comparisons = [],
    timings = [];
  let phase = "IN_PROGRESS",
    status = "RUNNING",
    error = null,
    timingOverflow = 0;
  function fail(reason) {
    if (status !== "ERROR")
      error = String(reason instanceof Error ? reason.message : reason).slice(0, 2048);
    status = "ERROR";
    phase = "INCOMPLETE";
  }
  function open() {
    if (phase !== "IN_PROGRESS") throw new Error("PAIRED_V3_PROGRESS_CLOSED");
  }
  function recordGraph(fileValue, graphValue) {
    try {
      file(fileValue);
      graph(graphValue);
      metadata(fileValue.id === graphValue.id);
      open();
      if (files.length >= 4) throw new Error("PAIRED_V3_PROGRESS_LIMIT");
      metadata(!files.some((entry) => entry.id === fileValue.id));
      files.push(freezeMetadata(fileValue));
      graphs.push(freezeMetadata(graphValue));
    } catch (failure) {
      fail(failure);
      throw failure;
    }
  }
  function recordComparison(value) {
    try {
      comparison(value);
      open();
      if (comparisons.length >= 6) throw new Error("PAIRED_V3_PROGRESS_LIMIT");
      metadata(!comparisons.some((entry) => entry.id === value.id));
      metadata(
        files.some((entry) => entry.id === value.actualId) &&
          files.some((entry) => entry.id === value.referenceId),
      );
      comparisons.push(freezeMetadata(value));
    } catch (failure) {
      fail(failure);
      throw failure;
    }
  }
  function recordTiming(value) {
    try {
      timing(value);
      if (phase !== "IN_PROGRESS") return false;
      if (timings.length >= 128) {
        timingOverflow++;
        fail("PAIRED_V3_PROGRESS_TIMING_LIMIT");
        return false;
      }
      timings.push(freezeMetadata(value));
      return true;
    } catch (failure) {
      fail(failure);
      throw failure;
    }
  }
  function finishBrowser(nextStatus) {
    if (!["PASS", "FAIL", "ERROR"].includes(nextStatus))
      throw new Error("PAIRED_V3_PROGRESS_STATUS");
    if (nextStatus === "ERROR") {
      fail(error ?? "PAIRED_V3_BROWSER_ERROR");
      return;
    }
    if (status === "ERROR" || phase === "BROWSER_COMPLETE") return;
    if (files.length !== 4 || graphs.length !== 4 || comparisons.length !== 6) {
      fail("PAIRED_V3_BROWSER_INCOMPLETE");
      return;
    }
    phase = "BROWSER_COMPLETE";
    const knownNumericalFailure =
      graphs.some(
        (entry) =>
          entry.nonfinite !== 0 || entry.outsideUnit !== 0 || entry.peak <= 0 || entry.peak > 1,
      ) ||
      comparisons.some(
        (entry) => entry.summary.nonfinite.count !== 0 || entry.summary.maxError > 2e-6,
      );
    status = nextStatus === "PASS" && knownNumericalFailure ? "FAIL" : nextStatus;
  }
  function snapshot() {
    return Object.freeze({
      schemaVersion: "paired-v3-progress-v1",
      phase,
      status,
      productComplete: false,
      downloads: "NOT_COMPLETED",
      independentParser: "NOT_COMPLETED",
      files: Object.freeze([...files]),
      graphs: Object.freeze([...graphs]),
      comparisons: Object.freeze([...comparisons]),
      timings: Object.freeze([...timings]),
      overflow: Object.freeze({ timings: timingOverflow }),
      error,
    });
  }
  return Object.freeze({
    recordGraph,
    recordComparison,
    recordTiming,
    fail,
    finishBrowser,
    snapshot,
  });
}

/** At most one plain-getter read. Every result remains an ERROR recovery artifact, never a completed gate. */
export function createPairedV3PartialCapture() {
  let attempted = false,
    closed = false,
    result = null;
  function unavailable(availability, reason, budgetMs) {
    return Object.freeze({
      availability,
      reason,
      budgetMs,
      partialRecoveryAttempted: true,
      overallStatus: "ERROR",
    });
  }
  async function capture(read, options) {
    if (attempted) return unavailable("SKIPPED", "PAIRED_V3_PARTIAL_ALREADY_ATTEMPTED", 0);
    attempted = true;
    const remaining = options?.remainingMs;
    const reserve = options?.reserveMs ?? 2000;
    const maximum = options?.maxMs ?? 500;
    if (
      !Number.isFinite(remaining) ||
      !Number.isFinite(reserve) ||
      !Number.isFinite(maximum) ||
      reserve < 0 ||
      maximum < 0 ||
      maximum > 500
    )
      throw new Error("PAIRED_V3_PARTIAL_BUDGET");
    const budgetMs = Math.max(0, Math.floor(Math.min(maximum, 500, remaining - reserve)));
    if (closed || budgetMs < 1) {
      result = unavailable(
        "SKIPPED",
        closed ? "PAIRED_V3_PARTIAL_CLOSED" : "PAIRED_V3_PARTIAL_NO_REMAINING_CLOSE_BUDGET",
        budgetMs,
      );
      return result;
    }
    if (typeof read !== "function") throw new Error("PAIRED_V3_PARTIAL_READER");
    let timer;
    const pending = Promise.resolve().then(read);
    void pending.catch(() => undefined);
    try {
      const partial = await Promise.race([
        pending,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("PAIRED_V3_PARTIAL_DEADLINE")), budgetMs);
        }),
      ]);
      if (closed) return unavailable("UNAVAILABLE", "PAIRED_V3_PARTIAL_CLOSED", budgetMs);
      validateSnapshot(partial);
      result = Object.freeze({
        availability: "AVAILABLE",
        budgetMs,
        partialRecoveryAttempted: true,
        overallStatus: "ERROR",
        partial: freezeMetadata(partial),
      });
    } catch (failure) {
      if (closed) return unavailable("UNAVAILABLE", "PAIRED_V3_PARTIAL_CLOSED", budgetMs);
      result = unavailable(
        "UNAVAILABLE",
        String(failure instanceof Error ? failure.message : failure).slice(0, 2048),
        budgetMs,
      );
    } finally {
      clearTimeout(timer);
    }
    return result;
  }
  return Object.freeze({
    capture,
    close() {
      closed = true;
    },
    get attempted() {
      return attempted;
    },
    get closed() {
      return closed;
    },
    get result() {
      return result;
    },
  });
}
