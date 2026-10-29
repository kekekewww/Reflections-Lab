// PREP ONLY: not promoted, imported, tested, or browser-qualified.
// Observe the actual native callback argument and returned handle. Never schedule a RAF here.
export const V3_LIMITS = Object.freeze({
  rawFrames: 90000,
  proofs: 90000,
  callbacks: 360000,
  pendingHandles: 8192,
  marks: 90000,
  markNameCharacters: 192,
  markNameBytes: 18 * 1024 * 1024,
});
export function float64Bits(value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, "0");
}
export function observationName(collectionId, proof) {
  return `rlab-v3.observe.${collectionId}.${proof.ordinal}.${proof.requestHandle}.${proof.rawRafBits}.${proof.observedNowBits}`;
}
export function createProofCollector({
  mark,
  limits = V3_LIMITS,
  maxReceiptBytes = 128 * 1024 * 1024,
}) {
  if (
    !Number.isSafeInteger(maxReceiptBytes) ||
    maxReceiptBytes <= 0 ||
    maxReceiptBytes > 128 * 1024 * 1024
  )
    throw new Error("V3_RECEIPT_LIMIT_SCHEMA");
  if (
    !limits ||
    Object.keys(V3_LIMITS).some(
      (key) =>
        !Number.isSafeInteger(limits[key]) || limits[key] <= 0 || limits[key] > V3_LIMITS[key],
    ) ||
    Object.keys(limits).length !== Object.keys(V3_LIMITS).length
  )
    throw new Error("V3_LIMIT_SCHEMA");
  let state = "IDLE",
    id = null,
    frames = [],
    callbacks = [],
    seenRaw = new Map();
  let seenHandles = new Set(),
    registeredHandles = new Set(),
    pending = new Set(),
    names = [],
    reasons = new Set();
  let counters = null;
  const prePending = new Set(),
    preRegistered = new Set(),
    preFailures = new Set();
  let preRegistrationCount = 0,
    preCancellationCount = 0;
  const validHandle = (value) => Number.isSafeInteger(value) && value >= 0;
  const fail = (reason) => {
    reasons.add(reason);
  };
  const reset = () => {
    frames = [];
    callbacks = [];
    seenRaw = new Map();
    seenHandles = new Set();
    registeredHandles = new Set();
    pending = new Set();
    names = [];
    reasons = new Set();
    counters = {
      callbacksObserved: 0,
      representativeFrames: 0,
      additionalCallbacks: 0,
      registrationsObserved: 0,
      cancellationsObserved: 0,
      precollectionRegistrations: 0,
      precollectionCancellations: 0,
      precollectionPendingAtBegin: 0,
      droppedProofs: 0,
      droppedCallbacks: 0,
      capHits: 0,
      samplesAfterClose: 0,
      emittedMarks: 0,
      markNameBytes: 0,
      clearedMarks: 0,
      pendingAtClose: null,
    };
  };
  const cap = (predicate, reason) => {
    if (predicate) return false;
    counters.capHits++;
    fail(reason);
    return true;
  };
  return {
    invalidate(reason) {
      if (state === "IDLE") preFailures.add(reason);
      else fail(reason);
    },
    begin(collectionId) {
      if (state !== "IDLE") throw new Error("V3_COLLECTOR_SINGLE_COLLECTION");
      if (typeof collectionId !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(collectionId))
        throw new Error("V3_COLLECTION_ID_SCHEMA");
      reset();
      id = collectionId;
      state = "OPEN";
      counters.precollectionRegistrations = preRegistrationCount;
      counters.precollectionCancellations = preCancellationCount;
      counters.precollectionPendingAtBegin = prePending.size;
      registeredHandles = new Set(preRegistered);
      pending = new Set(prePending);
      for (const reason of preFailures) fail(reason);
    },
    register(requestHandle, measuring) {
      if (state === "IDLE") {
        preRegistrationCount++;
        if (!validHandle(requestHandle)) preFailures.add("PRECOLLECTION_INVALID_HANDLE");
        else if (preRegistered.has(requestHandle)) preFailures.add("PRECOLLECTION_HANDLE_REUSE");
        else if (preRegistered.size >= limits.callbacks || prePending.size >= limits.pendingHandles)
          preFailures.add("PRECOLLECTION_HANDLE_CAP");
        else {
          preRegistered.add(requestHandle);
          prePending.add(requestHandle);
        }
        return;
      }
      if (state !== "OPEN" || !measuring) return;
      counters.registrationsObserved++;
      if (cap(counters.registrationsObserved <= limits.callbacks, "REGISTRATION_CAP")) return;
      if (!validHandle(requestHandle)) {
        fail("INVALID_NATIVE_RETURNED_HANDLE");
        return;
      }
      if (seenHandles.has(requestHandle) || registeredHandles.has(requestHandle))
        fail("HANDLE_REUSE_OR_WRAP");
      registeredHandles.add(requestHandle);
      if (!cap(pending.size < limits.pendingHandles, "PENDING_HANDLE_CAP"))
        pending.add(requestHandle);
    },
    cancel(requestHandle) {
      if (state === "IDLE") {
        preCancellationCount++;
        prePending.delete(requestHandle);
        return;
      }
      if (state !== "OPEN") return;
      counters.cancellationsObserved++;
      // An unknown handle may have been registered before begin; cancellation remains native.
      pending.delete(requestHandle);
    },
    callback(requestHandle, rawRafMs, observedNowMs, measuring) {
      prePending.delete(requestHandle);
      pending.delete(requestHandle);
      if (!measuring) return null;
      if (state !== "OPEN") {
        if (counters) counters.samplesAfterClose++;
        fail("SAMPLE_AFTER_CLOSE");
        return null;
      }
      counters.callbacksObserved++;
      if (cap(counters.callbacksObserved <= limits.callbacks, "CALLBACK_CAP")) {
        counters.droppedCallbacks++;
        return null;
      }
      if (!validHandle(requestHandle) || seenHandles.has(requestHandle)) {
        fail("HANDLE_REUSE_OR_INVALID");
        return null;
      }
      seenHandles.add(requestHandle);
      if (!Number.isFinite(rawRafMs) || !Number.isFinite(observedNowMs)) {
        fail("NONFINITE_CALLBACK");
        return null;
      }
      const existing = seenRaw.get(rawRafMs);
      const callback = {
        collectionId: id,
        callbackOrdinal: counters.callbacksObserved,
        requestHandle,
        rawRafMs,
        observedNowMs,
        rawRafBits: float64Bits(rawRafMs),
        observedNowBits: float64Bits(observedNowMs),
        representedByOrdinal: existing?.ordinal ?? frames.length + 1,
      };
      callbacks.push(callback);
      if (existing) {
        counters.additionalCallbacks++;
        return null;
      }
      if (
        cap(frames.length < limits.rawFrames && frames.length < limits.proofs, "FRAME_OR_PROOF_CAP")
      ) {
        counters.droppedProofs++;
        return null;
      }
      const proof = { ...callback, ordinal: frames.length + 1 };
      proof.markName = observationName(id, proof);
      // Names are ASCII by construction: JS character count equals exact UTF-8 byte count here.
      if (
        cap(
          names.length < limits.marks &&
            proof.markName.length <= limits.markNameCharacters &&
            counters.markNameBytes + proof.markName.length <= limits.markNameBytes,
          "MARK_STORAGE_CAP",
        )
      ) {
        counters.droppedProofs++;
        return null;
      }
      try {
        mark(proof.markName);
      } catch {
        fail("MARK_EMISSION_FAILED");
        counters.droppedProofs++;
        return null;
      }
      names.push(proof.markName);
      counters.emittedMarks++;
      counters.markNameBytes += proof.markName.length;
      frames.push(proof);
      seenRaw.set(rawRafMs, proof);
      counters.representativeFrames++;
      return proof;
    },
    close() {
      if (state !== "OPEN") {
        fail("INVALID_CLOSE_STATE");
        return;
      }
      counters.pendingAtClose = pending.size;
      state = "CLOSED";
    },
    snapshot() {
      const receipt = {
        method: "native-raf-calltime-v3",
        schemaVersion: "3.0.0",
        collectionId: id,
        state,
        closed: state === "CLOSED",
        markLifetime: "RETAIN_THROUGH_TRACE_CLOSE",
        frames: [],
        callbacks: [],
        counters: counters ? { ...counters } : null,
        caps: { ...limits },
        reasons: [...reasons],
        markClearingQualification: "NOT_RUN",
        observerCost: "INCLUDED_NOT_ZERO_NOT_ESTIMATED",
        formalQualification: "NOT_APPROVED",
      };
      // Count the exact compact UTF-8 representation before cloning either array.
      // Each row is individually bounded by the collector's schema and name caps.
      const encoder = new TextEncoder();
      let bytes = encoder.encode(JSON.stringify(receipt)).byteLength;
      for (const rows of [frames, callbacks]) {
        for (let i = 0; i < rows.length && bytes <= maxReceiptBytes; i++)
          bytes += encoder.encode(JSON.stringify(rows[i])).byteLength + (i ? 1 : 0);
        if (bytes > maxReceiptBytes) break;
      }
      if (bytes > maxReceiptBytes || reasons.has("RECEIPT_BYTES_CAP")) {
        if (!reasons.has("RECEIPT_BYTES_CAP")) {
          fail("RECEIPT_BYTES_CAP");
          if (counters) {
            counters.capHits++;
            counters.droppedProofs += frames.length;
          }
        }
        receipt.reasons = [...reasons];
        receipt.counters = counters ? { ...counters } : null;
        return receipt;
      }
      receipt.frames = frames.map((row) => ({ ...row }));
      receipt.callbacks = callbacks.map((row) => ({ ...row }));
      return receipt;
    },
  };
}
