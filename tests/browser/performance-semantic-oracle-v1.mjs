// Independent, fixed-scenario journal oracle. No collector, naming or Float64 helper imports.
// Passing this pure check does not qualify a browser or approve any performance gate.
const SCENARIO = "native-raf-semantic-pilot-v1";
const GROUPS = [
  ["P0", "P1"],
  ["A0", "A1", "A2"],
  ["B0", "B1"],
  ["C0"],
  ["D0", "D1", "D2"],
  ["E0", "E1"],
  ["F0"],
  ["G0", "G1"],
  ["H0", "H1"],
  ["I0"],
  ["J0", "J1"],
  ["K0"],
  ["L0", "L1"],
];
// Hard-coded operations, rather than a schedule inferred from an advertised receipt.
// Register tuples include the callback whose body must perform the registration.
const OPERATIONS = [
  ["register", "PC", "pretrace", null],
  ["cancel", "PC", "pretrace"],
  ["register", "P0", "pretrace", null],
  ["register", "P1", "pretrace", null],
  ["callback", "P0", "measured"],
  ["register", "A0", "measured", "P0"],
  ["register", "A1", "measured", "P0"],
  ["register", "A2", "measured", "P0"],
  ["callback", "P1", "measured"],
  ["callback", "A0", "measured"],
  ["callback", "A1", "measured"],
  ["callback", "A2", "measured"],
  ["register", "B0", "measured", "A2"],
  ["register", "B1", "measured", "A2"],
  ["callback", "B0", "measured"],
  ["callback", "B1", "measured"],
  ["register", "MC", "measured", "B1"],
  ["cancel", "MC", "measured"],
  ["register", "C0", "measured", "B1"],
  ["callback", "C0", "measured"],
  ["register", "D0", "measured", "C0"],
  ["register", "D1", "measured", "C0"],
  ["register", "D2", "measured", "C0"],
  ["callback", "D0", "measured"],
  ["callback", "D1", "measured"],
  ["callback", "D2", "measured"],
  ["register", "E0", "measured", "D2"],
  ["register", "E1", "measured", "D2"],
  ["callback", "E0", "measured"],
  ["callback", "E1", "measured"],
  ["register", "F0", "measured", "E1"],
  ["callback", "F0", "measured"],
  ["register", "G0", "measured", "F0"],
  ["register", "G1", "measured", "F0"],
  ["callback", "G0", "measured"],
  ["register", "H0", "measured", "G0"],
  ["callback", "G1", "measured"],
  ["register", "H1", "measured", "G1"],
  ["callback", "H0", "measured"],
  ["callback", "H1", "measured"],
  ["register", "I0", "measured", "H1"],
  ["callback", "I0", "measured"],
  ["register", "J0", "measured", "I0"],
  ["register", "J1", "measured", "I0"],
  ["callback", "J0", "measured"],
  ["callback", "J1", "measured"],
  ["register", "K0", "measured", "J1"],
  ["callback", "K0", "measured"],
  ["register", "L0", "measured", "K0"],
  ["register", "L1", "measured", "K0"],
  ["callback", "L0", "measured"],
  ["callback", "L1", "measured"],
];
const OPERATION_KEYS = {
  register: ["kind", "label", "handle", "phase", "parentLabel"],
  cancel: ["kind", "label", "handle", "phase"],
  callback: [
    "kind",
    "label",
    "handle",
    "phase",
    "rawRafMs",
    "rawRafBits",
    "observedNowMs",
    "observedNowBits",
  ],
};
const CAPS = {
  rawFrames: 90000,
  proofs: 90000,
  callbacks: 360000,
  pendingHandles: 8192,
  marks: 90000,
  markNameCharacters: 192,
  markNameBytes: 18874368,
};
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const handleValid = (value) => Number.isSafeInteger(value) && value >= 0;
const exactKeys = (value, names) => {
  if (!isObject(value)) return false;
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === names.length &&
    keys.every((key) => typeof key === "string" && names.includes(key)) &&
    names.every((key) => Object.hasOwn(value, key))
  );
};
const sameFields = (value, expected) =>
  exactKeys(value, Object.keys(expected)) &&
  Object.entries(expected).every(([key, item]) => Object.is(value[key], item));
// Locally encoded bytes are intentionally independent of the collector's helper.
function binary64(number) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, number, false);
  let result = "";
  for (const byte of new Uint8Array(buffer)) result += byte.toString(16).padStart(2, "0");
  return result;
}
const bitString = (value) => typeof value === "string" && /^[0-9a-f]{16}$/.test(value);

function inspect(journal, ui, fail) {
  if (!exactKeys(journal, ["schemaVersion", "scenario", "collectionId", "operations", "marks"])) {
    fail("JOURNAL_SCHEMA");
    return;
  }
  if (
    journal.schemaVersion !== "1.0.0" ||
    journal.scenario !== SCENARIO ||
    typeof journal.collectionId !== "string" ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(journal.collectionId)
  ) {
    fail("JOURNAL_IDENTITY");
    return;
  }
  if (
    !Array.isArray(journal.operations) ||
    journal.operations.length !== OPERATIONS.length ||
    !Array.isArray(journal.marks) ||
    journal.marks.length !== GROUPS.length
  ) {
    fail("JOURNAL_COUNT_OR_CAP");
    return;
  }
  if (
    !isObject(ui) ||
    !isObject(ui.collectionWindow) ||
    !isObject(ui.v3Proof) ||
    !Array.isArray(ui.frame) ||
    ui.frame.length !== 13
  ) {
    fail("UI_SCHEMA");
    return;
  }
  const id = journal.collectionId;
  const window = ui.collectionWindow;
  const origin = ui.startedAtPerformanceMs;
  const end = window.endPerformanceMs;
  const proof = ui.v3Proof;
  if (
    !Number.isFinite(origin) ||
    origin < 0 ||
    !Number.isFinite(end) ||
    end <= origin ||
    !Number.isFinite(ui.sampleMilliseconds) ||
    ui.sampleMilliseconds !== end - origin ||
    ui.sampleMilliseconds > 45000 ||
    window.schemaVersion !== "3.0.0" ||
    window.collectionId !== id ||
    window.beginPerformanceMs !== origin ||
    window.beginMarkName !== `reflection-profile.begin.${id}` ||
    window.endMarkName !== `reflection-profile.end.${id}` ||
    ui.droppedSamples !== 0
  ) {
    fail("UI_COLLECTION_WINDOW");
  }
  if (
    proof.method !== "native-raf-calltime-v3" ||
    proof.schemaVersion !== "3.0.0" ||
    proof.collectionId !== id ||
    proof.state !== "CLOSED" ||
    proof.closed !== true ||
    proof.markLifetime !== "RETAIN_THROUGH_TRACE_CLOSE" ||
    proof.markClearingQualification !== "NOT_RUN" ||
    proof.observerCost !== "INCLUDED_NOT_ZERO_NOT_ESTIMATED" ||
    proof.formalQualification !== "NOT_APPROVED" ||
    !Array.isArray(proof.reasons) ||
    proof.reasons.length !== 0
  ) {
    fail("PROOF_LIFECYCLE_OR_IDENTITY");
  }
  if (!sameFields(proof.caps, CAPS)) fail("PROOF_CAPS");
  if (
    !Array.isArray(proof.callbacks) ||
    proof.callbacks.length !== 24 ||
    !Array.isArray(proof.frames) ||
    proof.frames.length !== 13
  ) {
    fail("PROOF_COUNTS");
    return;
  }

  const groupsByLabel = new Map();
  const callbackOrder = [];
  for (let group = 0; group < GROUPS.length; group++) {
    for (const label of GROUPS[group]) {
      groupsByLabel.set(label, group);
      callbackOrder.push(label);
    }
  }
  const registrations = new Map();
  const registeredHandles = new Set();
  const pending = new Set();
  const cancelled = new Set();
  const seenCallbacks = new Set();
  const observed = [];
  const firstByGroup = new Map();
  let previousObservation = -Infinity;
  let callbackIndex = 0;
  for (let index = 0; index < OPERATIONS.length; index++) {
    const operation = journal.operations[index];
    const [kind, label, phase, parentLabel] = OPERATIONS[index];
    if (!exactKeys(operation, OPERATION_KEYS[kind])) {
      fail("OPERATION_SCHEMA_OR_UNKNOWN_FIELD");
      continue;
    }
    if (
      operation.kind !== kind ||
      operation.label !== label ||
      operation.phase !== phase ||
      (kind === "register" && operation.parentLabel !== parentLabel)
    ) {
      fail("FIXED_OPERATION_SCHEDULE");
    }
    if (!handleValid(operation.handle)) {
      fail("NATIVE_HANDLE_SCHEMA");
      continue;
    }
    if (kind === "register") {
      if (registrations.has(label) || registeredHandles.has(operation.handle)) {
        fail("NATIVE_HANDLE_REUSE");
      }
      registrations.set(label, operation.handle);
      registeredHandles.add(operation.handle);
      pending.add(label);
      continue;
    }
    if (operation.handle !== registrations.get(label) || !pending.has(label)) {
      fail("OPERATION_REGISTRATION_IDENTITY");
    }
    pending.delete(label);
    if (kind === "cancel") {
      cancelled.add(label);
      continue;
    }

    if (
      cancelled.has(operation.label) ||
      seenCallbacks.has(operation.label) ||
      operation.label !== callbackOrder[callbackIndex]
    ) {
      fail("CALLBACK_CANCEL_ORDER_OR_DUPLICATE");
    }
    seenCallbacks.add(operation.label);
    const group = groupsByLabel.get(label);
    if (
      !Number.isFinite(operation.rawRafMs) ||
      operation.rawRafMs < 0 ||
      !Number.isFinite(operation.observedNowMs) ||
      operation.rawRafMs > end ||
      operation.observedNowMs < origin ||
      operation.observedNowMs > end ||
      operation.observedNowMs < previousObservation ||
      !bitString(operation.rawRafBits) ||
      !bitString(operation.observedNowBits) ||
      operation.rawRafBits !== binary64(operation.rawRafMs) ||
      operation.observedNowBits !== binary64(operation.observedNowMs)
    ) {
      fail("CALLBACK_FLOAT64_OR_WINDOW");
      return;
    }
    previousObservation = operation.observedNowMs;
    const prior = firstByGroup.get(group);
    if (prior) {
      if (operation.rawRafBits !== prior.rawRafBits) fail("TWIN_GROUP_IDENTITY");
    } else {
      const previousGroup = firstByGroup.get(group - 1);
      if (previousGroup && !(operation.rawRafMs > previousGroup.rawRafMs)) {
        fail("NESTED_GROUP_NOT_LATER");
      }
      firstByGroup.set(group, operation);
    }
    const row = {
      collectionId: id,
      callbackOrdinal: callbackIndex + 1,
      requestHandle: operation.handle,
      rawRafMs: operation.rawRafMs,
      observedNowMs: operation.observedNowMs,
      rawRafBits: operation.rawRafBits,
      observedNowBits: operation.observedNowBits,
      representedByOrdinal: group + 1,
    };
    if (!sameFields(proof.callbacks[callbackIndex], row)) fail("CALLBACK_RECEIPT_BINDING");
    observed.push(row);
    callbackIndex++;
  }
  if (
    callbackIndex !== 24 ||
    seenCallbacks.size !== 24 ||
    pending.size !== 0 ||
    cancelled.size !== 2 ||
    !cancelled.has("PC") ||
    !cancelled.has("MC")
  ) {
    fail("JOURNAL_FINAL_ACCOUNTING");
  }

  let markBytes = 0;
  for (let group = 0; group < GROUPS.length; group++) {
    const first = firstByGroup.get(group);
    if (!first) {
      fail("MISSING_FIXED_GROUP");
      continue;
    }
    const firstIndex = callbackOrder.indexOf(GROUPS[group][0]);
    const expectedName = `rlab-v3.observe.${id}.${group + 1}.${first.handle}.${first.rawRafBits}.${first.observedNowBits}`;
    const representative = {
      ...observed[firstIndex],
      ordinal: group + 1,
      markName: expectedName,
    };
    if (!sameFields(proof.frames[group], representative)) fail("FRAME_RECEIPT_BINDING");
    const sample = ui.frame[group];
    const sampleKeys = [
      "collectionId",
      "timestamp",
      "callbackObservedAtPerformanceMs",
      "callbacks",
    ];
    if (
      !exactKeys(sample, sampleKeys) ||
      sample.collectionId !== id ||
      !Object.is(sample.timestamp, first.rawRafMs) ||
      !Object.is(sample.callbackObservedAtPerformanceMs, first.observedNowMs) ||
      sample.callbacks !== GROUPS[group].length
    ) {
      fail("RAW_FRAME_GROUP_BINDING");
    }

    const mark = journal.marks[group];
    if (
      !exactKeys(mark, [
        "name",
        "representativeLabel",
        "requestedStartTimeMs",
        "returnedStartTimeMs",
      ])
    ) {
      fail("MARK_SCHEMA_OR_UNKNOWN_FIELD");
      continue;
    }
    if (
      mark.name !== expectedName ||
      mark.representativeLabel !== GROUPS[group][0] ||
      expectedName.length > 192
    )
      fail("MARK_CALLBACK_BINDING");
    if (GROUPS[group][0] === "E0") {
      if (!Object.is(mark.requestedStartTimeMs, 0) || !Object.is(mark.returnedStartTimeMs, 0)) {
        fail("CUSTOM_MARK_START_TIME");
      }
    } else if (
      mark.requestedStartTimeMs !== null ||
      !Number.isFinite(mark.returnedStartTimeMs) ||
      mark.returnedStartTimeMs < first.observedNowMs ||
      mark.returnedStartTimeMs > end
    ) {
      fail("NORMAL_MARK_START_TIME");
    }
    // All permitted identity characters and locally encoded bytes are ASCII.
    markBytes += expectedName.length;
  }
  const expectedCounters = {
    callbacksObserved: 24,
    representativeFrames: 13,
    additionalCallbacks: 11,
    registrationsObserved: 23,
    cancellationsObserved: 1,
    precollectionRegistrations: 3,
    precollectionCancellations: 1,
    precollectionPendingAtBegin: 2,
    droppedProofs: 0,
    droppedCallbacks: 0,
    capHits: 0,
    samplesAfterClose: 0,
    emittedMarks: 13,
    markNameBytes: markBytes,
    clearedMarks: 0,
    pendingAtClose: 0,
  };
  if (!sameFields(proof.counters, expectedCounters)) fail("FIXED_COUNTER_OR_BYTE_ACCOUNTING");
}

/**
 * Validate the independent operation journal against the frozen 24-callback scenario
 * and the actual bounded collector receipt. Native trace identity is checked separately
 * by the unchanged V3 validator; a journal alone cannot establish browser eligibility.
 */
export function validateSemanticPilotJournal(journal, ui) {
  const reasons = new Set();
  try {
    inspect(journal, ui, (reason) => reasons.add(reason));
  } catch {
    // Malformed, cyclic or throwing input must never become an uncaught TypeError or approval.
    reasons.add("SEMANTIC_INPUT_ACCESS_FAILED");
  }
  return {
    qualified: reasons.size === 0,
    reasons: [...reasons],
    formalQualification: "NOT_APPROVED",
    nativeTraceValidation: "REQUIRED_SEPARATELY",
  };
}
