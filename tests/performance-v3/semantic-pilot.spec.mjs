// RED contract only. Pure synthetic journal; no browser launch or qualification claim.
// This fixture deliberately does not import collector/name/Float64 helpers.
import test from "node:test";
import assert from "node:assert/strict";
import * as candidate from "../browser/performance-qualifier-v3.mjs";

const scenario = "native-raf-semantic-pilot-v1";
const collectionId = "semantic-pilot-independent-fixture";
const groups = [
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
const bits = (number) => {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, number, false);
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const copy = (value) => structuredClone(value);
const callback = (journal, label) =>
  journal.operations.find(
    (operation) => operation.kind === "callback" && operation.label === label,
  );
const registration = (journal, label) =>
  journal.operations.find(
    (operation) => operation.kind === "register" && operation.label === label,
  );

function receiptFor(journal) {
  const callbacks = journal.operations.filter((operation) => operation.kind === "callback");
  const representatives = [];
  const byBits = new Map();
  const rows = callbacks.map((operation, index) => {
    let representedByOrdinal = byBits.get(operation.rawRafBits);
    if (representedByOrdinal === undefined) {
      representedByOrdinal = representatives.length + 1;
      byBits.set(operation.rawRafBits, representedByOrdinal);
      representatives.push({ operation, callbackOrdinal: index + 1 });
    }
    return {
      collectionId,
      callbackOrdinal: index + 1,
      requestHandle: operation.handle,
      rawRafMs: operation.rawRafMs,
      observedNowMs: operation.observedNowMs,
      rawRafBits: operation.rawRafBits,
      observedNowBits: operation.observedNowBits,
      representedByOrdinal,
    };
  });
  const frames = representatives.map(({ operation, callbackOrdinal }, index) => {
    const ordinal = index + 1;
    return {
      collectionId,
      callbackOrdinal,
      requestHandle: operation.handle,
      rawRafMs: operation.rawRafMs,
      observedNowMs: operation.observedNowMs,
      rawRafBits: operation.rawRafBits,
      observedNowBits: operation.observedNowBits,
      representedByOrdinal: ordinal,
      ordinal,
      markName: `rlab-v3.observe.${collectionId}.${ordinal}.${operation.handle}.${operation.rawRafBits}.${operation.observedNowBits}`,
    };
  });
  const pending = new Set();
  for (const operation of journal.operations) {
    if (operation.kind === "register") pending.add(operation.handle);
    if (operation.kind === "callback" || operation.kind === "cancel")
      pending.delete(operation.handle);
  }
  const precollection = journal.operations.filter((operation) => operation.phase === "pretrace");
  const prePending = new Set();
  for (const operation of precollection) {
    if (operation.kind === "register") prePending.add(operation.handle);
    if (operation.kind === "cancel") prePending.delete(operation.handle);
  }
  const count = (kind, phase) =>
    journal.operations.filter((operation) => operation.kind === kind && operation.phase === phase)
      .length;
  return {
    ui: {
      startedAtPerformanceMs: 80,
      sampleMilliseconds: 250,
      droppedSamples: 0,
      collectionWindow: {
        schemaVersion: "3.0.0",
        collectionId,
        beginMarkName: `reflection-profile.begin.${collectionId}`,
        endMarkName: `reflection-profile.end.${collectionId}`,
        beginPerformanceMs: 80,
        endPerformanceMs: 330,
      },
      frame: frames.map((frame) => ({
        collectionId,
        timestamp: frame.rawRafMs,
        callbackObservedAtPerformanceMs: frame.observedNowMs,
        callbacks: rows.filter((row) => row.representedByOrdinal === frame.ordinal).length,
      })),
      v3Proof: {
        method: "native-raf-calltime-v3",
        schemaVersion: "3.0.0",
        collectionId,
        state: "CLOSED",
        closed: true,
        markLifetime: "RETAIN_THROUGH_TRACE_CLOSE",
        frames,
        callbacks: rows,
        counters: {
          callbacksObserved: rows.length,
          representativeFrames: frames.length,
          additionalCallbacks: rows.length - frames.length,
          registrationsObserved: count("register", "measured"),
          cancellationsObserved: count("cancel", "measured"),
          precollectionRegistrations: count("register", "pretrace"),
          precollectionCancellations: count("cancel", "pretrace"),
          precollectionPendingAtBegin: prePending.size,
          droppedProofs: 0,
          droppedCallbacks: 0,
          capHits: 0,
          samplesAfterClose: 0,
          emittedMarks: frames.length,
          markNameBytes: frames.reduce((total, frame) => total + frame.markName.length, 0),
          clearedMarks: 0,
          pendingAtClose: pending.size,
        },
        caps: {
          rawFrames: 90000,
          proofs: 90000,
          callbacks: 360000,
          pendingHandles: 8192,
          marks: 90000,
          markNameCharacters: 192,
          markNameBytes: 18874368,
        },
        reasons: [],
        markClearingQualification: "NOT_RUN",
        observerCost: "INCLUDED_NOT_ZERO_NOT_ESTIMATED",
        formalQualification: "NOT_APPROVED",
      },
    },
    marks: frames.map((frame, index) => ({
      name: frame.markName,
      representativeLabel: representatives[index].operation.label,
      requestedStartTimeMs: representatives[index].operation.label === "E0" ? 0 : null,
      returnedStartTimeMs:
        representatives[index].operation.label === "E0" ? 0 : frame.observedNowMs + 0.001,
    })),
  };
}
function synchronize(fixture) {
  const receipt = receiptFor(fixture.journal);
  fixture.ui = receipt.ui;
  fixture.journal.marks = receipt.marks;
}
function literalFixture(handleBase = 100) {
  const journal = { schemaVersion: "1.0.0", scenario, collectionId, operations: [], marks: [] };
  let nextHandle = handleBase;
  const handles = new Map();
  const register = (label, parentLabel = null, phase = "measured") => {
    const handle = nextHandle++;
    handles.set(label, handle);
    journal.operations.push({ kind: "register", label, handle, phase, parentLabel });
  };
  const cancel = (label, phase = "measured") => {
    journal.operations.push({ kind: "cancel", label, handle: handles.get(label), phase });
  };
  register("PC", null, "pretrace");
  cancel("PC", "pretrace");
  register("P0", null, "pretrace");
  register("P1", null, "pretrace");
  const children = {
    P0: ["A0", "A1", "A2"],
    A2: ["B0", "B1"],
    B1: ["C0"],
    C0: ["D0", "D1", "D2"],
    D2: ["E0", "E1"],
    E1: ["F0"],
    F0: ["G0", "G1"],
    G0: ["H0"],
    G1: ["H1"],
    H1: ["I0"],
    I0: ["J0", "J1"],
    J1: ["K0"],
    K0: ["L0", "L1"],
  };
  for (let group = 0; group < groups.length; group++) {
    for (let member = 0; member < groups[group].length; member++) {
      const label = groups[group][member];
      const rawRafMs = 100 + group * 16;
      const observedNowMs = rawRafMs + 0.125 + member / 100;
      journal.operations.push({
        kind: "callback",
        label,
        handle: handles.get(label),
        phase: "measured",
        rawRafMs,
        rawRafBits: bits(rawRafMs),
        observedNowMs,
        observedNowBits: bits(observedNowMs),
      });
      if (label === "B1") {
        register("MC", "B1");
        cancel("MC");
      }
      for (const child of children[label] ?? []) register(child, label);
    }
  }
  const fixture = { journal, ui: null };
  synchronize(fixture);
  return fixture;
}
function validate(fixture) {
  return candidate.validateSemanticPilotJournal(fixture.journal, fixture.ui);
}
function rejected(fixture) {
  let result;
  assert.doesNotThrow(() => {
    result = validate(fixture);
  });
  assert.equal(result.qualified, false);
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
}

test("semantic pilot exposes a real operation-journal oracle, independent of plan metadata", () => {
  assert.equal(typeof candidate.validateSemanticPilotJournal, "function");
});
test("independent literal fixes 24 callbacks, 13 twin groups, both cancellations and pretrace counts", () => {
  const { journal, ui } = literalFixture();
  assert.equal(journal.operations.filter((row) => row.kind === "register").length, 26);
  assert.equal(journal.operations.filter((row) => row.kind === "cancel").length, 2);
  assert.equal(journal.operations.filter((row) => row.kind === "callback").length, 24);
  assert.deepEqual(
    ui.frame.map((row) => row.callbacks),
    [2, 3, 2, 1, 3, 2, 1, 2, 2, 1, 2, 1, 2],
  );
  assert.equal(ui.v3Proof.counters.precollectionRegistrations, 3);
  assert.equal(ui.v3Proof.counters.precollectionCancellations, 1);
  assert.equal(ui.v3Proof.counters.precollectionPendingAtBegin, 2);
  assert.equal(ui.v3Proof.counters.registrationsObserved, 23);
  assert.equal(ui.v3Proof.counters.cancellationsObserved, 1);
  assert.equal(ui.v3Proof.counters.pendingAtClose, 0);
  assert.equal(ui.v3Proof.counters.additionalCallbacks, 11);
});
for (const handleBase of [0, 100, 700]) {
  test(`semantic oracle accepts the full literal with actual handles beginning at ${handleBase}`, () => {
    if (typeof candidate.validateSemanticPilotJournal !== "function") return;
    const result = validate(literalFixture(handleBase));
    assert.equal(result.qualified, true, JSON.stringify(result.reasons));
    assert.deepEqual(result.reasons, []);
  });
}

const mutations = {
  "cancelled measured callback fires while total count and claimed receipt remain coherent": (
    f,
  ) => {
    const row = callback(f.journal, "C0");
    row.label = "MC";
    row.handle = registration(f.journal, "MC").handle;
    synchronize(f);
  },
  "cancelled pretrace callback fires while total count remains 24": (f) => {
    const row = callback(f.journal, "P1");
    row.label = "PC";
    row.handle = registration(f.journal, "PC").handle;
    synchronize(f);
  },
  "callback before its registration": (f) => {
    const row = callback(f.journal, "H0");
    const index = f.journal.operations.indexOf(row);
    f.journal.operations.splice(index, 1);
    f.journal.operations.splice(0, 0, row);
    synchronize(f);
  },
  "callback label is duplicated despite a self-consistent receipt": (f) => {
    callback(f.journal, "A1").label = "A0";
    synchronize(f);
  },
  "unknown callback label cannot be advertised as another valid native frame": (f) => {
    callback(f.journal, "A1").label = "not-in-frozen-scenario";
    synchronize(f);
  },
  "callback handle differs from its native registration": (f) => {
    callback(f.journal, "A1").handle += 1000;
    synchronize(f);
  },
  "handle reuse across different registration labels": (f) => {
    const from = registration(f.journal, "A0").handle;
    registration(f.journal, "A1").handle = from;
    callback(f.journal, "A1").handle = from;
    synchronize(f);
  },
  "string handles are not coerced": (f) => {
    registration(f.journal, "A1").handle = String(registration(f.journal, "A1").handle);
    callback(f.journal, "A1").handle = String(callback(f.journal, "A1").handle);
    synchronize(f);
  },
  "twin identity changes even though journal and proof share the new bytes": (f) => {
    const row = callback(f.journal, "P1");
    row.rawRafMs += 1;
    row.rawRafBits = bits(row.rawRafMs);
    synchronize(f);
  },
  "nested child fires inside the parent group with coherent total counts": (f) => {
    const child = callback(f.journal, "H0");
    const parent = callback(f.journal, "G0");
    child.rawRafMs = parent.rawRafMs;
    child.rawRafBits = parent.rawRafBits;
    synchronize(f);
  },
  "nested registration is falsely attributed to another callback": (f) => {
    registration(f.journal, "H0").parentLabel = "G1";
  },
  "nested child was registered outside the frozen parent order": (f) => {
    const row = registration(f.journal, "H0");
    f.journal.operations.splice(f.journal.operations.indexOf(row), 1);
    f.journal.operations.push(row);
    synchronize(f);
  },
  "measured callback misrepresented as pretrace": (f) => {
    callback(f.journal, "A0").phase = "pretrace";
    synchronize(f);
  },
  "missing callback is not repaired by receipt-derived counts": (f) => {
    const row = callback(f.journal, "L1");
    f.journal.operations.splice(f.journal.operations.indexOf(row), 1);
    synchronize(f);
  },
  "duplicate invocation is not repaired by receipt-derived counts": (f) => {
    f.journal.operations.push(copy(callback(f.journal, "L1")));
    synchronize(f);
  },
  "journal callback cap cannot be hidden behind a short proof": (f) => {
    const row = callback(f.journal, "L1");
    for (let i = 0; i < 129; i++) f.journal.operations.push(copy(row));
  },
  "raw Float64 bytes do not describe their numeric argument": (f) => {
    for (const label of ["P0", "P1"]) callback(f.journal, label).rawRafBits = "0000000000000000";
    synchronize(f);
  },
  "observed Float64 bytes do not describe the native clock observation": (f) => {
    callback(f.journal, "A0").observedNowBits = "0000000000000000";
    synchronize(f);
  },
  "raw bytes are not a canonical 16-character byte string": (f) => {
    callback(f.journal, "A0").rawRafBits += "00";
    synchronize(f);
  },
  "nonfinite callback argument": (f) => {
    callback(f.journal, "A0").rawRafMs = Infinity;
    synchronize(f);
  },
  "custom startTime mark is silently changed into a normal mark": (f) => {
    const mark = f.journal.marks.find((row) => row.representativeLabel === "E0");
    mark.requestedStartTimeMs = null;
    mark.returnedStartTimeMs = callback(f.journal, "E0").observedNowMs;
  },
  "custom startTime did not preserve its exact requested zero": (f) => {
    f.journal.marks.find((row) => row.representativeLabel === "E0").returnedStartTimeMs = 1;
  },
  "custom mark is attached to the wrong representative": (f) => {
    f.journal.marks.find((row) => row.representativeLabel === "E0").representativeLabel = "E1";
  },
  "mark name does not bind the independently observed callback bytes": (f) => {
    f.journal.marks[0].name += "-foreign";
  },
  "mark-name byte count is not an estimate": (f) => {
    f.ui.v3Proof.counters.markNameBytes++;
  },
  "claimed group count differs from independent callback journal": (f) => {
    f.ui.frame[0].callbacks++;
  },
  "claimed callback handle differs from independent journal": (f) => {
    f.ui.v3Proof.callbacks[1].requestHandle += 1000;
  },
  "missing operation array is not empty success": (f) => {
    delete f.journal.operations;
  },
  "unknown journal schema": (f) => {
    f.journal.schemaVersion = "future";
  },
  "unknown scenario cannot inherit this qualification": (f) => {
    f.journal.scenario = "another-semantic-pilot";
  },
  "journal collection differs from actual collector": (f) => {
    f.journal.collectionId = "another-collection";
  },
  "unknown journal field fails closed": (f) => {
    f.journal.advertisedQualified = true;
  },
  "unknown operation field fails closed": (f) => {
    callback(f.journal, "P0").advertisedQualified = true;
  },
  "unknown operation kind fails closed": (f) => {
    f.journal.operations[0].kind = "assume-register";
  },
  "unknown mark field fails closed": (f) => {
    f.journal.marks[0].nativeCallTimeAssumed = true;
  },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`semantic oracle rejects ${name}`, () => {
    if (typeof candidate.validateSemanticPilotJournal !== "function") return;
    const fixture = literalFixture();
    mutate(fixture);
    rejected(fixture);
  });
}
for (const [name, mutate] of [
  ["null journal", (f) => (f.journal = null)],
  ["array journal", (f) => (f.journal = [])],
  ["null operation", (f) => (f.journal.operations[0] = null)],
  ["null mark", (f) => (f.journal.marks[0] = null)],
  ["null collector output", (f) => (f.ui = null)],
]) {
  test(`semantic oracle returns controlled rejection for ${name}`, () => {
    if (typeof candidate.validateSemanticPilotJournal !== "function") return;
    const fixture = literalFixture();
    mutate(fixture);
    rejected(fixture);
  });
}

for (const [key, value] of [
  ["tick", {}],
  ["rafCpuMs", Number.NaN],
]) {
  test(`semantic oracle rejects optional product telemetry outside the frozen pilot: ${key}`, () => {
    const fixture = literalFixture();
    fixture.ui.frame[0][key] = value;
    rejected(fixture);
  });
}

// Independent synthetic native events for the frozen semantic journal.
// These literals are parser/oracle tests, never actual browser evidence.
import { validateNativeV3 as strictSemanticNative } from "../browser/performance-native-v3.mjs";

function semanticNativeFixture(handleBase = 100) {
  const fixture = literalFixture(handleBase);
  const document = {
    id: "semantic-owned-document",
    loaderId: "semantic-owned-loader",
    url: "http://127.0.0.1:5193/semantic-pilot-independent",
  };
  const context = {
    traceDataLoss: false,
    traceStreamClosed: true,
    documentBefore: { ...document },
    documentAfter: { ...document },
  };
  const pid = 77;
  const tid = 91;
  const originUs = 920000;
  const beginUs = 1000000;
  const endUs = 1250000;
  const navigationId = "semantic-owned-navigation";
  const events = [
    { name: "thread_name", ph: "M", pid, tid, args: { name: "CrRendererMain" } },
    {
      name: fixture.ui.collectionWindow.beginMarkName,
      ph: "I",
      cat: "blink.user_timing",
      pid,
      tid,
      ts: beginUs,
      args: { data: { navigationId, callTime: beginUs } },
    },
    {
      name: fixture.ui.collectionWindow.endMarkName,
      ph: "I",
      cat: "blink.user_timing",
      pid,
      tid,
      ts: endUs,
      args: { data: { navigationId, callTime: endUs } },
    },
    {
      name: "RunTask",
      ph: "X",
      cat: "toplevel",
      pid,
      tid,
      ts: beginUs - 100,
      dur: endUs - beginUs + 200,
    },
  ];
  const callbackEvents = fixture.journal.operations.filter((row) => row.kind === "callback");
  for (const row of callbackEvents) {
    const group = groups.find((members) => members.includes(row.label));
    const member = group.indexOf(row.label);
    const startOffset = member === 0 ? 0 : member === 1 ? 130 : 140;
    const endOffset = member === 0 ? 130 : member === 1 && group.length === 3 ? 140 : 250;
    events.push({
      name: "FireAnimationFrame",
      ph: "X",
      cat: "devtools.timeline",
      pid,
      tid,
      ts: originUs + row.rawRafMs * 1000 + startOffset,
      dur: endOffset - startOffset,
      args: { data: { id: row.handle, frame: document.id } },
    });
  }
  const requestOrderInParent = new Map();
  for (const row of fixture.journal.operations.filter(
    (operation) => operation.kind === "register" && operation.phase === "measured",
  )) {
    const parent = callback(fixture.journal, row.parentLabel);
    const order = requestOrderInParent.get(row.parentLabel) ?? 0;
    requestOrderInParent.set(row.parentLabel, order + 1);
    events.push({
      name: "RequestAnimationFrame",
      ph: "I",
      cat: "devtools.timeline",
      pid,
      tid,
      ts: originUs + Math.round(parent.observedNowMs * 1000) + 2 + order,
      args: { data: { id: row.handle, frame: document.id } },
    });
  }
  for (const mark of fixture.journal.marks) {
    const owner = callback(fixture.journal, mark.representativeLabel);
    const callTime = originUs + Math.round(owner.observedNowMs * 1000) + 1;
    events.push({
      name: mark.name,
      ph: "I",
      cat: "blink.user_timing",
      pid,
      tid,
      ts: mark.representativeLabel === "E0" ? originUs : callTime,
      args: { data: { navigationId, callTime } },
    });
  }
  return { ...fixture, events, context };
}
const nativeEventFor = (fixture, name, label) => {
  const handle = registration(fixture.journal, label).handle;
  return fixture.events.find((event) => event.name === name && event.args?.data?.id === handle);
};
function nativeResult(fixture) {
  return candidate.verifySemanticNativeEvidence(
    fixture.journal,
    fixture.ui,
    fixture.events,
    fixture.context,
  );
}
function nativeRejected(fixture) {
  let result;
  assert.doesNotThrow(() => {
    result = nativeResult(fixture);
  });
  assert.equal(result.qualified, false);
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
}

test("semantic native evidence exposes an oracle that verifies the actual trace itself", () => {
  assert.equal(typeof candidate.verifySemanticNativeEvidence, "function");
});
test("independent native literal is eligible under the unchanged strict V3 parser", () => {
  const fixture = semanticNativeFixture();
  const native = strictSemanticNative(fixture.ui, fixture.events, fixture.context);
  assert.equal(native.qualified, true, JSON.stringify(native.reasons));
  assert.equal(fixture.events.filter((event) => event.name === "RequestAnimationFrame").length, 23);
  assert.equal(fixture.events.filter((event) => event.name === "FireAnimationFrame").length, 24);
  assert.equal(fixture.journal.marks.length, 13);
  assert.equal(
    new Set(
      fixture.journal.operations.filter((row) => row.kind === "register").map((row) => row.handle),
    ).size,
    26,
  );
  const traceHandles = new Set(
    fixture.events
      .filter((event) => ["FireAnimationFrame", "RequestAnimationFrame"].includes(event.name))
      .map((event) => event.args.data.id),
  );
  assert.equal(traceHandles.size, 25, "PC was registered/cancelled entirely before this trace");
  const custom = fixture.events.find(
    (event) =>
      event.name === fixture.journal.marks.find((mark) => mark.representativeLabel === "E0").name,
  );
  assert.ok(custom.ts < native.begin);
  assert.ok(custom.args.data.callTime > native.begin);
});
for (const handleBase of [0, 700]) {
  test(`semantic native oracle accepts 24 fires and 23 requests with native handle base ${handleBase}`, () => {
    if (typeof candidate.verifySemanticNativeEvidence !== "function") return;
    const result = nativeResult(semanticNativeFixture(handleBase));
    assert.equal(result.qualified, true, JSON.stringify(result.reasons));
    assert.deepEqual(result.reasons, []);
  });
}
test("advertised false qualification cannot replace self-validation of valid raw native evidence", () => {
  if (typeof candidate.verifySemanticNativeEvidence !== "function") return;
  const fixture = semanticNativeFixture();
  fixture.context.qualified = false;
  fixture.context.nativeEligibility = { qualified: false, reasons: ["UNTRUSTED_ADVERTISEMENT"] };
  const result = nativeResult(fixture);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
});

const semanticNativeMutations = {
  "an unknown owned handle adds a 26th trace handle": {
    strictStillEligible: true,
    mutate(f) {
      const owned = nativeEventFor(f, "FireAnimationFrame", "A0");
      f.events.push({
        ...copy(owned),
        args: { data: { id: 987654, frame: f.context.documentBefore.id } },
      });
      const request = nativeEventFor(f, "RequestAnimationFrame", "A0");
      f.events.push({
        ...copy(request),
        args: { data: { id: 987654, frame: f.context.documentBefore.id } },
      });
    },
  },
  "MC request lies outside the closed native window": {
    strictStillEligible: true,
    mutate(f) {
      nativeEventFor(f, "RequestAnimationFrame", "MC").ts = 1250001;
    },
  },
  "MC request lies outside its parent Fire span while still inside the window": {
    strictStillEligible: true,
    mutate(f) {
      const parent = nativeEventFor(f, "FireAnimationFrame", "B1");
      nativeEventFor(f, "RequestAnimationFrame", "MC").ts = parent.ts + parent.dur + 1;
    },
  },
  "a nested request lies before its parent Fire span": {
    strictStillEligible: true,
    mutate(f) {
      const parent = nativeEventFor(f, "FireAnimationFrame", "G0");
      nativeEventFor(f, "RequestAnimationFrame", "H0").ts = parent.ts - 1;
    },
  },
  "missing MC request leaves only 22 captured requests": {
    strictStillEligible: true,
    mutate(f) {
      const request = nativeEventFor(f, "RequestAnimationFrame", "MC");
      f.events.splice(f.events.indexOf(request), 1);
    },
  },
  "missing nonrepresentative request is not optional in this pilot": {
    strictStillEligible: true,
    mutate(f) {
      const request = nativeEventFor(f, "RequestAnimationFrame", "A1");
      f.events.splice(f.events.indexOf(request), 1);
    },
  },
  "all captured requests are missing despite otherwise valid callback identity": {
    strictStillEligible: true,
    mutate(f) {
      f.events = f.events.filter((event) => event.name !== "RequestAnimationFrame");
    },
  },
  "a claimed pretrace P0 request is captured inside the trace": {
    strictStillEligible: true,
    mutate(f) {
      const request = copy(nativeEventFor(f, "RequestAnimationFrame", "A0"));
      request.ts = 1010000;
      request.args.data.id = registration(f.journal, "P0").handle;
      f.events.push(request);
    },
  },
  "a claimed pretrace PC request is captured inside the trace": {
    strictStillEligible: true,
    mutate(f) {
      const request = copy(nativeEventFor(f, "RequestAnimationFrame", "A0"));
      request.args.data.id = registration(f.journal, "PC").handle;
      f.events.push(request);
    },
  },
  "MC request belongs to a different document": {
    strictStillEligible: true,
    mutate(f) {
      nativeEventFor(f, "RequestAnimationFrame", "MC").args.data.frame = "different-document";
    },
  },
  "MC request category is not the native timeline category": {
    strictStillEligible: true,
    mutate(f) {
      nativeEventFor(f, "RequestAnimationFrame", "MC").cat = "toplevel";
    },
  },
  "numeric category is controlled rejection instead of a split TypeError": {
    strictStillEligible: true,
    mutate(f) {
      nativeEventFor(f, "RequestAnimationFrame", "MC").cat = 7;
    },
  },
  "duplicate MC request is not hidden by a single valid candidate": {
    strictStillEligible: true,
    mutate(f) {
      f.events.push(copy(nativeEventFor(f, "RequestAnimationFrame", "MC")));
    },
  },
  "journal has fewer than 26 returned registration handles": {
    strictStillEligible: true,
    mutate(f) {
      f.journal.operations = f.journal.operations.filter((row) => row.label !== "PC");
    },
  },
  "native evidence cannot repair an invalid callback label journal": {
    strictStillEligible: true,
    mutate(f) {
      callback(f.journal, "A1").label = "A0";
    },
  },
  "a callback Fire belongs to another document": {
    strictStillEligible: false,
    mutate(f) {
      nativeEventFor(f, "FireAnimationFrame", "A1").args.data.frame = "different-document";
    },
  },
  "context changed document loader": {
    strictStillEligible: false,
    mutate(f) {
      f.context.documentAfter.loaderId = "different-loader";
    },
  },
  "advertised qualification cannot rescue missing actual Fire evidence": {
    strictStillEligible: false,
    mutate(f) {
      const fire = nativeEventFor(f, "FireAnimationFrame", "A1");
      f.events.splice(f.events.indexOf(fire), 1);
      f.context.qualified = true;
      f.context.nativeEligibility = { qualified: true };
    },
  },
  "advertised qualification cannot rescue trace data loss": {
    strictStillEligible: false,
    mutate(f) {
      f.context.traceDataLoss = true;
      f.context.qualified = true;
      f.context.nativeEligibility = { qualified: true };
    },
  },
  "null raw event is controlled rejection": {
    strictStillEligible: false,
    mutate(f) {
      f.events.push(null);
    },
  },
};
for (const [name, { mutate, strictStillEligible }] of Object.entries(semanticNativeMutations)) {
  test(`semantic native oracle rejects ${name}`, () => {
    if (typeof candidate.verifySemanticNativeEvidence !== "function") return;
    const fixture = semanticNativeFixture();
    mutate(fixture);
    const native = strictSemanticNative(fixture.ui, fixture.events, fixture.context);
    assert.equal(native.qualified, strictStillEligible, JSON.stringify(native.reasons));
    nativeRejected(fixture);
  });
}
for (const [name, mutate] of [
  ["null journal", (f) => (f.journal = null)],
  ["null ui", (f) => (f.ui = null)],
  ["null events", (f) => (f.events = null)],
  ["null context", (f) => (f.context = null)],
  ["null marks", (f) => (f.journal.marks = null)],
]) {
  test(`semantic native oracle controls ${name}`, () => {
    if (typeof candidate.verifySemanticNativeEvidence !== "function") return;
    const fixture = semanticNativeFixture();
    mutate(fixture);
    nativeRejected(fixture);
  });
}

// Deadline and machine-lease outcome contracts; all clocks and process results are synthetic.
import { existsSync } from "node:fs";
import * as semanticCommandCandidate from "../browser/performance-semantic-command-v1.mjs";
const deadlineModuleUrl = new URL("../browser/performance-deadline-v1.mjs", import.meta.url);
const deadlineCandidate = existsSync(deadlineModuleUrl) ? await import(deadlineModuleUrl.href) : {};

test("deadline helper exposes an operation factory with pre- and post-await checks", () => {
  assert.equal(typeof deadlineCandidate.runBeforeDeadline, "function");
});
test("expired deadline never starts the operation factory", async () => {
  if (typeof deadlineCandidate.runBeforeDeadline !== "function") return;
  let called = false;
  await assert.rejects(async () =>
    deadlineCandidate.runBeforeDeadline(
      "expired-before-start",
      () => {
        called = true;
        return "must-not-run";
      },
      { deadlineMs: 10, now: () => 10 },
    ),
  );
  assert.equal(called, false);
});
test("a synchronous operation that crosses the deadline cannot return success", async () => {
  if (typeof deadlineCandidate.runBeforeDeadline !== "function") return;
  let clock = 100;
  await assert.rejects(async () =>
    deadlineCandidate.runBeforeDeadline(
      "synchronous-overrun",
      () => {
        clock = 106;
        return "not-a-success";
      },
      { deadlineMs: 105, now: () => clock },
    ),
  );
});
test("an awaited operation reaching the exact deadline cannot return success", async () => {
  if (typeof deadlineCandidate.runBeforeDeadline !== "function") return;
  let clock = 100;
  await assert.rejects(async () =>
    deadlineCandidate.runBeforeDeadline(
      "asynchronous-boundary",
      async () => {
        await Promise.resolve();
        clock = 105;
        return "not-a-success";
      },
      { deadlineMs: 105, now: () => clock },
    ),
  );
});
test("an awaited operation finishing after the deadline cannot beat a delayed timer", async () => {
  if (typeof deadlineCandidate.runBeforeDeadline !== "function") return;
  let clock = 100;
  await assert.rejects(async () =>
    deadlineCandidate.runBeforeDeadline(
      "asynchronous-overrun",
      async () => {
        await Promise.resolve();
        clock = 107;
        return "not-a-success";
      },
      { deadlineMs: 105, now: () => clock },
    ),
  );
});
test("a factory completing within its deadline preserves its actual result", async () => {
  if (typeof deadlineCandidate.runBeforeDeadline !== "function") return;
  let clock = 100;
  const value = { actual: "completed-before-deadline" };
  const result = await deadlineCandidate.runBeforeDeadline(
    "within-budget",
    async () => {
      await Promise.resolve();
      clock = 104;
      return value;
    },
    { deadlineMs: 105, now: () => clock },
  );
  assert.equal(result, value);
});
test("a factory failure preserves the original error", async () => {
  if (typeof deadlineCandidate.runBeforeDeadline !== "function") return;
  const original = new Error("intentional-operation-failure");
  await assert.rejects(
    async () =>
      deadlineCandidate.runBeforeDeadline(
        "original-error",
        async () => {
          throw original;
        },
        { deadlineMs: 105, now: () => 100 },
      ),
    (error) => error === original,
  );
});

function ordinarySemanticProcessResult() {
  return {
    exit_code: 0,
    signal: null,
    timed_out: false,
    cancelled: false,
    process_stopped: true,
    process_tree_stopped: null,
    stop_scope: "direct_process",
    output_limit: false,
    spawn_error: null,
  };
}
function actualChildCleanup() {
  return {
    status: "SEMANTIC_CANDIDATE_OBSERVED_NOT_APPROVED",
    semanticCandidateObserved: true,
    formalQualification: "NOT_APPROVED",
    browserConnectedAfterCleanup: false,
    serverListeningAfterCleanup: false,
    cleanupErrors: [],
    endpointPins: { sourceStable: true, executableStable: true },
    restoration: {
      nativeRafIdentityUnchanged: true,
      nativeCancelIdentityUnchanged: true,
      pendingAfterRestore: 0,
      state: "CLOSED",
    },
    journalOracle: { qualified: true },
    strictNative: { qualified: true },
    nativeJournalCorroboration: { qualified: true },
  };
}
function processOutcome(result, childVerification) {
  return semanticCommandCandidate.semanticProcessOutcome(result, childVerification);
}
function assertProcessOutcome(result, childVerification, releasable, succeeded) {
  let outcome;
  assert.doesNotThrow(() => {
    outcome = processOutcome(result, childVerification);
  });
  assert.equal(outcome.machineLeaseReleasable, releasable);
  assert.equal(outcome.pilotSucceeded, succeeded);
}

test("semantic command exposes separate pilot and machine-lease outcomes", () => {
  assert.equal(typeof semanticCommandCandidate.semanticProcessOutcome, "function");
});
for (const treeStopped of [false, null]) {
  test(`forced timeout with tree proof ${treeStopped} retains the machine lease even when direct child stopped`, () => {
    if (typeof semanticCommandCandidate.semanticProcessOutcome !== "function") return;
    const result = {
      ...ordinarySemanticProcessResult(),
      exit_code: null,
      signal: "SIGKILL",
      timed_out: true,
      process_tree_stopped: treeStopped,
    };
    assertProcessOutcome(result, actualChildCleanup(), false, false);
  });
}
for (const flag of ["timed_out", "cancelled", "output_limit"]) {
  test(`confirmed owned-tree termination after ${flag} may release the lease but cannot pass the pilot`, () => {
    if (typeof semanticCommandCandidate.semanticProcessOutcome !== "function") return;
    const result = {
      ...ordinarySemanticProcessResult(),
      exit_code: null,
      signal: "SIGKILL",
      [flag]: true,
      process_tree_stopped: true,
      stop_scope: "process_tree",
    };
    assertProcessOutcome(result, null, true, false);
  });
}
test("unconfirmed process close cannot borrow a positive tree flag", () => {
  if (typeof semanticCommandCandidate.semanticProcessOutcome !== "function") return;
  assertProcessOutcome(
    {
      ...ordinarySemanticProcessResult(),
      timed_out: true,
      process_stopped: false,
      process_tree_stopped: true,
      stop_scope: "process_tree",
    },
    actualChildCleanup(),
    false,
    false,
  );
});
test("normal successful exit requires actual browser and server cleanup evidence", () => {
  if (typeof semanticCommandCandidate.semanticProcessOutcome !== "function") return;
  assertProcessOutcome(ordinarySemanticProcessResult(), actualChildCleanup(), true, true);
});
test("a normal failed pilot with actual cleanup can still release the machine lease", () => {
  if (typeof semanticCommandCandidate.semanticProcessOutcome !== "function") return;
  const child = actualChildCleanup();
  child.status = "UNVERIFIED_NOT_APPROVED";
  child.semanticCandidateObserved = false;
  assertProcessOutcome({ ...ordinarySemanticProcessResult(), exit_code: 1 }, child, true, false);
});
test("normal direct-child exit without child verification does not prove browser cleanup", () => {
  if (typeof semanticCommandCandidate.semanticProcessOutcome !== "function") return;
  assertProcessOutcome(ordinarySemanticProcessResult(), null, false, false);
});
for (const [name, mutate] of [
  ["browser still connected", (child) => (child.browserConnectedAfterCleanup = true)],
  ["browser close unavailable", (child) => (child.browserConnectedAfterCleanup = null)],
  ["server still listening", (child) => (child.serverListeningAfterCleanup = true)],
  ["server close unavailable", (child) => delete child.serverListeningAfterCleanup],
  [
    "numeric zero is not a closed server observation",
    (child) => (child.serverListeningAfterCleanup = 0),
  ],
  ["cleanup error", (child) => (child.cleanupErrors = [{ message: "owned browser close failed" }])],
  ["cleanup errors unavailable", (child) => delete child.cleanupErrors],
]) {
  test(`normal exit retains the machine lease for ${name}`, () => {
    if (typeof semanticCommandCandidate.semanticProcessOutcome !== "function") return;
    const child = actualChildCleanup();
    mutate(child);
    assertProcessOutcome(ordinarySemanticProcessResult(), child, false, false);
  });
}
test("missing process result returns a controlled unverified outcome", () => {
  if (typeof semanticCommandCandidate.semanticProcessOutcome !== "function") return;
  assertProcessOutcome(null, actualChildCleanup(), false, false);
});
