const SCHEMA_VERSION = "native03-partial-v1";
const RESULT_CAP = 20;

/** @typedef {import("./partial-results.mjs").NativePartialStatus} NativePartialStatus */
/** @typedef {import("./partial-results.mjs").NativePartialReadReport} NativePartialReadReport */

/** @param {unknown} sampleRate @param {unknown} frames */
function validDimensions(sampleRate, frames) {
  return (
    typeof sampleRate === "number" &&
    Number.isFinite(sampleRate) &&
    sampleRate > 0 &&
    typeof frames === "number" &&
    Number.isSafeInteger(frames) &&
    frames > 0
  );
}

/** @param {unknown} error */
function errorText(error) {
  try {
    return String(error);
  } catch {
    return "NATIVE_PARTIAL_ERROR_UNPRINTABLE";
  }
}

/**
 * Copy only the bounded list of references. Never copy, freeze or normalize PCM.
 * @template T
 * @param {NativePartialStatus} status
 * @param {number} sampleRate
 * @param {number} frames
 * @param {readonly T[]} results
 * @param {string | null} error
 * @returns {import("./partial-results.mjs").NativePartialSnapshot<T>}
 */
function frozenSnapshot(status, sampleRate, frames, results, error) {
  const count = results.length;
  if (count > RESULT_CAP) throw new Error("NATIVE_PARTIAL_RESULT_CAP");
  const references = [];
  // Index bounds also hold for an unknown payload with a custom array iterator.
  for (let index = 0; index < count; index++) references.push(results[index]);
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status,
    sampleRate,
    frames,
    results: Object.freeze(references),
    error,
  });
}

/**
 * Journal completed native case objects while a later render is still pending.
 * Snapshot wrappers are immutable; completed objects/PCM keep their identities.
 * @template [T=unknown]
 * @param {{sampleRate:number, frames:number}} dimensions
 * @returns {import("./partial-results.mjs").NativePartialJournal<T>}
 */
export function createNativePartialJournal({ sampleRate, frames }) {
  if (!validDimensions(sampleRate, frames))
    throw new Error(
      "NATIVE_PARTIAL_DIMENSIONS: positive finite rate and safe frame count required",
    );
  /** @type {NativePartialStatus} */
  let status = "RUNNING";
  /** @type {T[]} */
  const results = [];
  /** @type {string | null} */
  let error = null;
  return Object.freeze({
    /** @param {T} result */
    append(result) {
      if (status !== "RUNNING") throw new Error("NATIVE_PARTIAL_JOURNAL_CLOSED");
      if (results.length >= RESULT_CAP) throw new Error("NATIVE_PARTIAL_RESULT_CAP");
      results.push(result);
    },
    /** @param {unknown} failure */
    fail(failure) {
      status = "FAIL";
      error ??= errorText(failure);
    },
    complete() {
      if (status === "RUNNING") status = "COMPLETE";
    },
    snapshot() {
      return frozenSnapshot(status, sampleRate, frames, results, error);
    },
  });
}

/** @param {unknown} payload */
function validatedSnapshot(payload) {
  if (payload === null || typeof payload !== "object")
    throw new Error("NATIVE_PARTIAL_SNAPSHOT_INVALID");
  const value = /** @type {Record<string, unknown>} */ (payload);
  const { status, sampleRate, frames, results, error } = value;
  if (
    value.schemaVersion !== SCHEMA_VERSION ||
    (status !== "RUNNING" && status !== "COMPLETE" && status !== "FAIL") ||
    !validDimensions(sampleRate, frames) ||
    !Array.isArray(results) ||
    results.length > RESULT_CAP ||
    (error !== null && typeof error !== "string")
  )
    throw new Error("NATIVE_PARTIAL_SNAPSHOT_INVALID");
  return frozenSnapshot(
    status,
    /** @type {number} */ (sampleRate),
    /** @type {number} */ (frames),
    results,
    error,
  );
}

/**
 * Recover at most once within the caller's existing cleanup budget. A successful
 * read is evidence retention only: even COMPLETE partial payloads report FAIL.
 * Promise.race owns no continuation that could mutate a returned timeout report.
 * @param {() => Promise<unknown>} read
 * @param {number} remainingMs
 * @returns {Promise<NativePartialReadReport>}
 */
export async function readNativePartialOnce(read, remainingMs) {
  let timer;
  try {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0)
      throw new Error("NATIVE_PARTIAL_READ_DEADLINE");
    const payload = await Promise.race([
      Promise.resolve().then(() => read()),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("NATIVE_PARTIAL_READ_DEADLINE")),
          Math.min(remainingMs, 2147483647),
        );
      }),
    ]);
    return Object.freeze({
      status: "FAIL",
      partialState: "AVAILABLE",
      snapshot: validatedSnapshot(payload),
      error: null,
    });
  } catch (error) {
    return Object.freeze({
      status: "FAIL",
      partialState: "UNAVAILABLE",
      snapshot: null,
      error: errorText(error),
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
