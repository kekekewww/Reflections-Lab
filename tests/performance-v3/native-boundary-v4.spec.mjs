// V4 RED contract. Uses the committed exact semantic-attempt01 raw, not a repaired trace.
// CANDIDATE_EVIDENCE is never formal qualification or a performance-budget PASS.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  validateNativeV3,
  unchangedNumericV3,
  SHORT_TRACE_CAPS,
} from "../browser/performance-native-v3.mjs";

const nativeModule = new URL("../browser/performance-native-boundary-v4.mjs", import.meta.url);
const registryModule = new URL(
  "../browser/performance-qualification-registry-v4.mjs",
  import.meta.url,
);
const candidate = existsSync(nativeModule) ? await import(nativeModule.href) : {};
const registry = existsSync(registryModule) ? await import(registryModule.href) : {};
const fixtureRoot = new URL(
  "../../docs/16-nonadvanced-completion/lanes/performance/semantic-attempt01/",
  import.meta.url,
);
const producerRevision = "861389936bf33ea77529ee5dcc0605e68f6bb620";
const executableSha256 = "7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa";
const boundaryIndex = 2377;
const inputBytes = {
  raw: readFileSync(new URL("pilot.raw.json", fixtureRoot)),
  trace: readFileSync(new URL("pilot.trace.json.gz", fixtureRoot)),
  verification: readFileSync(new URL("native-verification.json", fixtureRoot)),
};
const decoded = gunzipSync(inputBytes.trace);
const frozenRaw = JSON.parse(inputBytes.raw.toString("utf8"));
const frozenTrace = JSON.parse(decoded.toString("utf8"));
const frozenVerification = JSON.parse(inputBytes.verification.toString("utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = (value) => structuredClone(value);
const bits = (number) => {
  const storage = new ArrayBuffer(8);
  const view = new DataView(storage);
  view.setFloat64(0, number, false);
  return [...new Uint8Array(storage)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
function adjacentPositiveFloat64(number, direction) {
  assert.ok(Number.isFinite(number) && number > 0);
  const storage = new ArrayBuffer(8);
  const view = new DataView(storage);
  view.setFloat64(0, number, false);
  view.setBigUint64(0, view.getBigUint64(0, false) + BigInt(direction), false);
  return view.getFloat64(0, false);
}
function fixture() {
  return {
    ui: clone(frozenRaw.ui),
    events: clone(frozenTrace.traceEvents),
    context: {
      documentBefore: clone(frozenVerification.documentBefore),
      documentAfter: clone(frozenVerification.documentAfter),
      traceDataLoss: frozenVerification.traceMetadata.dataLossOccurred,
      traceStreamClosed: true,
      producerRevision,
      executableSha256,
    },
  };
}
function call(f, caps) {
  return candidate.validateNativeBoundaryV4(f.ui, f.events, f.context, caps);
}
function rejected(f, caps) {
  let result;
  assert.doesNotThrow(() => {
    result = call(f, caps);
  });
  assert.equal(result.qualified, false);
  assert.notEqual(result.status, "CANDIDATE_EVIDENCE");
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
}
function original(f) {
  return validateNativeV3(f.ui, f.events, f.context);
}
function firstRendererComplete(f) {
  const old = original(f);
  return f.events.find(
    (event) =>
      ["RunTask", "ThreadControllerImpl::RunTask"].includes(event.name) &&
      event.pid === old.expectedPid &&
      event.tid === old.expectedTid &&
      event.ph === "X",
  );
}

test("V4 exposes the versioned boundary validator without changing original V3", () => {
  assert.equal(typeof candidate.validateNativeBoundaryV4, "function");
});
test("V4 exposes a NOT_QUALIFIED candidate policy with exact explicit producer and executable pins", () => {
  assert.equal(typeof registry.V4_CANDIDATE_POLICY, "object");
  if (!registry.V4_CANDIDATE_POLICY) return;
  assert.equal(registry.V4_CANDIDATE_POLICY.status, "NOT_QUALIFIED");
  assert.equal(registry.V4_CANDIDATE_POLICY.producerRevision, producerRevision);
  assert.equal(registry.V4_CANDIDATE_POLICY.executableSha256, executableSha256);
});
test("committed semantic attempt01 bytes and original parser source are frozen", () => {
  assert.equal(
    sha(inputBytes.raw),
    "8c95e3bfdceef6a098abcc1102f493e51b4072bb0745b742a237b3d72187fe3e",
  );
  assert.equal(
    sha(inputBytes.trace),
    "c4481687bfbcb7657a1f0a55d91f48b1e57d68c2736ea6de7a8dcfb40f887b72",
  );
  assert.equal(
    sha(inputBytes.verification),
    "4984cb50b038cd1a909b21ea28b58819c7c1ed017458f13bb809a0b97753ca2d",
  );
  assert.equal(decoded.length, 834926);
  assert.equal(frozenTrace.traceEvents.length, 3306);
  assert.equal(
    sha(readFileSync(new URL("../browser/performance-native-v3.mjs", import.meta.url))),
    "3d7810c63edc309df6b306debe6417ed13d73b6e899a7950043439b787421782",
  );
});
test("the same immutable original raw remains rejected by original strict V3", () => {
  const f = fixture();
  const old = original(f);
  assert.equal(old.qualified, false);
  assert.deepEqual(old.reasons, ["RENDERER_TASK_SCHEMA_OR_CATEGORY"]);
  assert.equal(old.formalQualification, "NOT_APPROVED");
  assert.equal(old.validatedTasks.length, 47);
  assert.ok(old.validatedTasks.every((event) => event.ph === "X"));
  assert.equal(f.events[boundaryIndex].ph, "B");
  assert.equal(f.events[boundaryIndex].ts - old.end, 16311);
  assert.equal(Object.hasOwn(f.events[boundaryIndex], "dur"), false);
});
test("V4 records the exact post-window B source without inventing a duration or mutating raw", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const f = fixture();
  const before = clone(f);
  const result = call(f);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.equal(result.status, "CANDIDATE_EVIDENCE");
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.classifications.length, 1);
  const boundary = result.classifications[0];
  assert.deepEqual(
    Object.keys(boundary).sort(),
    ["classification", "duration", "eventIndex", "numericIncluded", "source"].sort(),
  );
  assert.equal(boundary.eventIndex, boundaryIndex);
  assert.equal(boundary.classification, "POST_WINDOW_BEGIN_ONLY");
  assert.equal(boundary.duration, null);
  assert.equal(boundary.numericIncluded, false);
  assert.deepEqual(boundary.source, before.events[boundaryIndex]);
  assert.deepEqual(f, before);
  assert.equal(
    original(f).qualified,
    false,
    "typed V4 evidence must not rewrite the original result",
  );
  if (registry.V4_CANDIDATE_POLICY)
    assert.equal(registry.V4_CANDIDATE_POLICY.status, "NOT_QUALIFIED");
});
test("V4 typed complete spans produce bit-exact original numeric reference values", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const f = fixture();
  const oldRejected = original(f);
  // This is a typed numeric reference only. It is not a successful V3 qualification.
  const numericReferenceOnly = {
    qualified: true,
    begin: oldRejected.begin,
    end: oldRejected.end,
    validatedTasks: oldRejected.validatedTasks,
    referencePurpose: "NUMERIC_ONLY_ORIGINAL_RAW_REMAINS_REJECTED",
  };
  const reference = unchangedNumericV3(f.ui, numericReferenceOnly);
  const result = call(f);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.deepEqual(result.validatedTasks, oldRejected.validatedTasks);
  assert.equal(result.begin, oldRejected.begin);
  assert.equal(result.end, oldRejected.end);
  const numeric = unchangedNumericV3(f.ui, result);
  assert.ok(reference.nativeTraceBinBoundariesUs.length > 1);
  assert.deepEqual(
    numeric.nativeTraceBinBoundariesUs.map(bits),
    reference.nativeTraceBinBoundariesUs.map(bits),
  );
  assert.deepEqual(numeric.mainTaskOccupancyMs.map(bits), reference.mainTaskOccupancyMs.map(bits));
  assert.equal(numeric.complete, reference.complete);
  assert.equal(numeric.nativeTaskCount, reference.nativeTaskCount);
  assert.deepEqual(numeric.mergedNativeTasks, reference.mergedNativeTasks);
  assert.equal(original(f).qualified, false);
});
test("the next representable Float64 above end is outside; no epsilon is required", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const f = fixture();
  const end = original(f).end;
  const above = adjacentPositiveFloat64(end, 1);
  assert.ok(above > end);
  f.events[boundaryIndex].ts = above;
  const result = call(f);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.equal(result.classifications[0].source.ts, above);
  assert.equal(bits(result.classifications[0].source.ts), bits(above));
  assert.equal(result.classifications[0].duration, null);
  assert.equal(result.classifications[0].numericIncluded, false);
});
for (const [name, position] of [
  ["exact end", (end) => end],
  ["next representable Float64 below end", (end) => adjacentPositiveFloat64(end, -1)],
  ["inside the measurement window", (end) => end - 1000],
]) {
  test(`V4 rejects a duration-unknown B at ${name}`, () => {
    if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
    const f = fixture();
    f.events[boundaryIndex].ts = position(original(f).end);
    rejected(f);
  });
}

const mutations = {
  "E is not silently paired or discarded": (f) => {
    f.events[boundaryIndex].ph = "E";
  },
  "I is not used to turn a begin into an instant": (f) => {
    f.events[boundaryIndex].ph = "I";
  },
  "B with numeric dur zero is not a zero-duration span": (f) => {
    f.events[boundaryIndex].dur = 0;
  },
  "B with null dur is not an absent duration": (f) => {
    f.events[boundaryIndex].dur = null;
  },
  "B with undefined own dur is not an absent duration": (f) => {
    f.events[boundaryIndex].dur = undefined;
  },
  "B with positive dur is not promoted to X": (f) => {
    f.events[boundaryIndex].dur = 1;
  },
  "B with negative dur is not a supported span": (f) => {
    f.events[boundaryIndex].dur = -1;
  },
  "B with thread-instant scope s is not the known export shape": (f) => {
    f.events[boundaryIndex].s = "t";
  },
  "B with null scope is not absent scope": (f) => {
    f.events[boundaryIndex].s = null;
  },
  "B with another category": (f) => {
    f.events[boundaryIndex].cat = "devtools.timeline";
  },
  "B with expanded category list": (f) => {
    f.events[boundaryIndex].cat = "toplevel,other";
  },
  "B with missing category": (f) => {
    delete f.events[boundaryIndex].cat;
  },
  "B renamed to RunTask is not the pinned producer event": (f) => {
    f.events[boundaryIndex].name = "RunTask";
  },
  "unknown B name cannot vanish behind the task-name filter": (f) => {
    f.events[boundaryIndex].name = "UnrecognizedRendererTask";
  },
  "B with another positive pid cannot become an excluded task": (f) => {
    f.events[boundaryIndex].pid += 1;
  },
  "B with another positive tid cannot become an excluded task": (f) => {
    f.events[boundaryIndex].tid += 1;
  },
  "B with zero pid": (f) => {
    f.events[boundaryIndex].pid = 0;
  },
  "B with missing tid": (f) => {
    delete f.events[boundaryIndex].tid;
  },
  "B with string tid": (f) => {
    f.events[boundaryIndex].tid = String(f.events[boundaryIndex].tid);
  },
  "B with missing args": (f) => {
    delete f.events[boundaryIndex].args;
  },
  "B with null args": (f) => {
    f.events[boundaryIndex].args = null;
  },
  "B with array args": (f) => {
    f.events[boundaryIndex].args = [];
  },
  "B with additional source args": (f) => {
    f.events[boundaryIndex].args.unverified = true;
  },
  "B with an added task annotator shape": (f) => {
    f.events[boundaryIndex].args.chrome_task_annotator = {};
  },
  "B with missing source file": (f) => {
    delete f.events[boundaryIndex].args.src_file;
  },
  "B with different nonempty source file": (f) => {
    f.events[boundaryIndex].args.src_file = "cc/trees/unknown.cc";
  },
  "B with missing source function": (f) => {
    delete f.events[boundaryIndex].args.src_func;
  },
  "B with different nonempty source function": (f) => {
    f.events[boundaryIndex].args.src_func = "OtherPostedTask";
  },
  "B with fractional source line": (f) => {
    f.events[boundaryIndex].args.src_line = 849.5;
  },
  "B with different positive source line": (f) => {
    f.events[boundaryIndex].args.src_line = 850;
  },
  "B with missing source line": (f) => {
    delete f.events[boundaryIndex].args.src_line;
  },
  "B with negative source line": (f) => {
    f.events[boundaryIndex].args.src_line = -1;
  },
  "B with string source line": (f) => {
    f.events[boundaryIndex].args.src_line = "849";
  },
  "B with nonfinite timestamp": (f) => {
    f.events[boundaryIndex].ts = NaN;
  },
  "B with infinite timestamp": (f) => {
    f.events[boundaryIndex].ts = Infinity;
  },
  "B with negative timestamp": (f) => {
    f.events[boundaryIndex].ts = -1;
  },
  "B with string timestamp": (f) => {
    f.events[boundaryIndex].ts = String(f.events[boundaryIndex].ts);
  },
  "B with missing timestamp": (f) => {
    delete f.events[boundaryIndex].ts;
  },
  "B with an unregistered top-level field": (f) => {
    f.events[boundaryIndex].advertisedBoundarySafe = true;
  },
  "two post-window B records are outside the finite candidate policy": (f) => {
    const extra = clone(f.events[boundaryIndex]);
    extra.ts += 1;
    f.events.push(extra);
  },
  "an unknown E cannot hide beside the valid known B": (f) => {
    const extra = clone(f.events[boundaryIndex]);
    extra.ph = "E";
    extra.ts += 1;
    f.events.push(extra);
  },
  "an invalid complete renderer span remains rejected": (f) => {
    firstRendererComplete(f).dur = -1;
  },
  "an invalid complete renderer category remains rejected": (f) => {
    firstRendererComplete(f).cat = "other";
  },
  "a different producer revision": (f) => {
    f.context.producerRevision = "d0c02bfad08ec92a6ffcf989e53cd995e6381a4c";
  },
  "a missing explicit producer revision": (f) => {
    delete f.context.producerRevision;
  },
  "a different executable hash": (f) => {
    f.context.executableSha256 = "0".repeat(64);
  },
  "a missing explicit executable hash": (f) => {
    delete f.context.executableSha256;
  },
  "an advertised positive flag cannot rescue the wrong executable": (f) => {
    f.context.executableSha256 = "0".repeat(64);
    f.context.qualified = true;
    f.context.nativeEligibility = { qualified: true };
  },
  "trace data loss remains rejected": (f) => {
    f.context.traceDataLoss = true;
  },
  "unknown stream closure remains rejected": (f) => {
    delete f.context.traceStreamClosed;
  },
  "document loader change remains rejected": (f) => {
    f.context.documentAfter.loaderId += "-different";
  },
  "null raw event remains controlled rejection": (f) => {
    f.events.push(null);
  },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`V4 rejects ${name}`, () => {
    if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
    const f = fixture();
    mutate(f);
    rejected(f);
  });
}
test("exact event-count cap is accepted without expanding original SHORT caps", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const f = fixture();
  const caps = { ...SHORT_TRACE_CAPS, events: f.events.length };
  const before = clone(caps);
  const result = call(f, caps);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.deepEqual(caps, before);
});
test("event-count cap minus one rejects before selection", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const f = fixture();
  rejected(f, { ...SHORT_TRACE_CAPS, events: f.events.length - 1 });
});
test("all named task candidates count against the unchanged relevant-task cap", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const f = fixture();
  const taskCount = f.events.filter((event) =>
    ["RunTask", "ThreadControllerImpl::RunTask"].includes(event.name),
  ).length;
  assert.equal(taskCount, 938);
  const result = call(f, { ...SHORT_TRACE_CAPS, relevantTasks: taskCount });
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  rejected(f, { ...SHORT_TRACE_CAPS, relevantTasks: taskCount - 1 });
});
for (const caps of [
  null,
  [],
  { ...SHORT_TRACE_CAPS, events: SHORT_TRACE_CAPS.events + 1 },
  { ...SHORT_TRACE_CAPS, relevantTasks: SHORT_TRACE_CAPS.relevantTasks + 1 },
]) {
  test(`V4 rejects an invalid or expanded cap contract ${JSON.stringify(caps)}`, () => {
    if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
    rejected(fixture(), caps);
  });
}

// Full semantic V2 integrates the fixed journal with V4 typed boundary evidence.
// V1 remains an immutable historical method and still rejects the same raw.
const semanticV2Module = new URL(
  "../browser/performance-semantic-native-oracle-v2.mjs",
  import.meta.url,
);
const semanticV2 = existsSync(semanticV2Module) ? await import(semanticV2Module.href) : {};
function semanticV2Fixture() {
  return { ...fixture(), journal: clone(frozenRaw.journal) };
}
const journalRegistration = (f, label) =>
  f.journal.operations.find((row) => row.kind === "register" && row.label === label);
const nativeRafEvent = (f, name, label) => {
  const handle = journalRegistration(f, label).handle;
  return f.events.find(
    (event) =>
      event.name === name &&
      event.args?.data?.id === handle &&
      event.args?.data?.frame === f.context.documentBefore.id,
  );
};
function callSemanticV2(f) {
  return semanticV2.verifySemanticNativeEvidenceV2(f.journal, f.ui, f.events, f.context);
}
function rejectedSemanticV2(f) {
  let result;
  assert.doesNotThrow(() => {
    result = callSemanticV2(f);
  });
  assert.equal(result.qualified, false);
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
}

test("semantic V2 exposes the full journal/native oracle without replacing V1", () => {
  assert.equal(typeof semanticV2.verifySemanticNativeEvidenceV2, "function");
});
test("the historical V1 native oracle source remains at the exact run-source pin", () => {
  const pin = frozenVerification.sourceBefore.find(
    (row) => row.path === "tests/browser/performance-semantic-native-oracle-v1.mjs",
  );
  assert.equal(typeof pin?.sha256, "string");
  assert.equal(
    sha(
      readFileSync(
        new URL("../browser/performance-semantic-native-oracle-v1.mjs", import.meta.url),
      ),
    ),
    pin.sha256,
  );
});
test("semantic V2 inspects the real full set as candidate evidence only", () => {
  if (typeof semanticV2.verifySemanticNativeEvidenceV2 !== "function") return;
  const f = semanticV2Fixture();
  const before = clone(f);
  const result = callSemanticV2(f);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.deepEqual(result.reasons, []);
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.equal(result.journal.qualified, true);
  assert.equal(result.strictNative.qualified, true);
  assert.equal(result.strictNative.status, "CANDIDATE_EVIDENCE");
  assert.equal(result.strictNative.legacyRawEligibility.qualified, false);
  assert.deepEqual(result.strictNative.legacyRawEligibility.reasons, [
    "RENDERER_TASK_SCHEMA_OR_CATEGORY",
  ]);
  assert.equal(result.strictNative.classifications.length, 1);
  assert.equal(result.strictNative.classifications[0].eventIndex, boundaryIndex);
  assert.equal(result.strictNative.classifications[0].duration, null);
  assert.equal(result.strictNative.classifications[0].numericIncluded, false);
  assert.deepEqual(result.strictNative.classifications[0].source, f.events[boundaryIndex]);
  for (const [field, expected] of Object.entries({
    requestEvents: 23,
    fireEvents: 24,
    cancelEvents: 1,
    ownedTraceHandles: 25,
    validKnownRequestEvents: 23,
    validKnownFireEvents: 24,
    validKnownCancelEvents: 1,
    registeredJournalHandles: 26,
  }))
    assert.equal(result.observedCounts[field], expected, field);
  assert.equal(result.observations.length, 26);
  for (const registration of f.journal.operations.filter((row) => row.kind === "register")) {
    const observed = result.observations.find((row) => row.label === registration.label);
    assert.ok(observed, registration.label);
    assert.equal(observed.handle, registration.handle);
    assert.equal(observed.phase, registration.phase);
    assert.equal(observed.parentLabel, registration.parentLabel);
    assert.equal(observed.requestCount, registration.phase === "pretrace" ? 0 : 1);
    assert.equal(observed.fireCount, ["PC", "MC"].includes(registration.label) ? 0 : 1);
    assert.equal(observed.cancelEventCount, registration.label === "MC" ? 1 : 0);
  }
  assert.equal(
    result.observations.find((row) => row.label === "PC").cancellationScope,
    "PRETRACE_API_JOURNAL_ONLY_NATIVE_CANCEL_NOT_VERIFIED",
  );
  assert.equal(
    result.observations.find((row) => row.label === "MC").cancellationScope,
    "NATIVE_CANCEL_CAPTURED_WITH_REQUEST_AND_NO_FIRE",
  );
  assert.deepEqual(f, before);
  assert.equal(original(f).qualified, false);
});
test("semantic V2 retains all 13 actual proof callTimes and the distinct custom startTime", () => {
  if (typeof semanticV2.verifySemanticNativeEvidenceV2 !== "function") return;
  const f = semanticV2Fixture();
  const result = callSemanticV2(f);
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.equal(result.strictNative.evidence.length, 13);
  assert.deepEqual(result.strictNative.evidence, original(f).evidence);
  for (const proof of f.ui.v3Proof.frames) {
    const evidence = result.strictNative.evidence.find((row) => row.ordinal === proof.ordinal);
    const mark = f.events.find((event) => event.name === proof.markName);
    const fire = f.events.find(
      (event) =>
        event.name === "FireAnimationFrame" &&
        event.args?.data?.id === proof.requestHandle &&
        event.args?.data?.frame === f.context.documentBefore.id,
    );
    assert.equal(evidence.requestHandle, proof.requestHandle);
    assert.equal(evidence.observationMarkTsUs, mark.ts);
    assert.equal(evidence.observationCallTimeUs, mark.args.data.callTime);
    assert.equal(evidence.fireTsUs, fire.ts);
    assert.equal(evidence.fireDurationUs, fire.dur);
    assert.ok(evidence.observationCallTimeUs >= fire.ts);
    assert.ok(evidence.observationCallTimeUs <= fire.ts + fire.dur);
  }
  assert.deepEqual(
    result.customStartTimeEvidence,
    result.strictNative.evidence.find((row) => row.ordinal === 6),
  );
  const custom = result.customStartTimeEvidence;
  assert.equal(custom.requestHandle, 14);
  assert.equal(custom.observationMarkTsUs, 99066512284);
  assert.equal(custom.observationCallTimeUs, 99067178607);
  assert.ok(custom.observationMarkTsUs < original(f).begin);
  assert.ok(custom.observationCallTimeUs > original(f).begin);
});

const semanticV2Mutations = {
  "the actual captured MC cancel is missing, even though request and no-fire still match": (f) => {
    const cancel = nativeRafEvent(f, "CancelAnimationFrame", "MC");
    f.events.splice(f.events.indexOf(cancel), 1);
  },
  "unknown owned Request cannot hide beside the 23 expected requests": (f) => {
    const extra = clone(nativeRafEvent(f, "RequestAnimationFrame", "MC"));
    extra.args.data.id = 999999;
    f.events.push(extra);
  },
  "unknown owned Fire cannot hide beside the 24 expected fires": (f) => {
    const extra = clone(nativeRafEvent(f, "FireAnimationFrame", "A0"));
    extra.args.data.id = 999999;
    f.events.push(extra);
  },
  "unknown owned Cancel cannot hide beside the single expected cancel": (f) => {
    const extra = clone(nativeRafEvent(f, "CancelAnimationFrame", "MC"));
    extra.args.data.id = 999999;
    f.events.push(extra);
  },
  "MC posttrace Request is outside its parent Fire": (f) => {
    const parent = nativeRafEvent(f, "FireAnimationFrame", "B1");
    nativeRafEvent(f, "RequestAnimationFrame", "MC").ts = parent.ts + parent.dur + 1;
  },
  "MC posttrace Request is outside the collection window": (f) => {
    nativeRafEvent(f, "RequestAnimationFrame", "MC").ts = original(f).end + 1;
  },
  "a nested Request occurs before its parent Fire": (f) => {
    nativeRafEvent(f, "RequestAnimationFrame", "H0").ts =
      nativeRafEvent(f, "FireAnimationFrame", "G0").ts - 1;
  },
  "a captured MC Cancel occurs outside its parent Fire": (f) => {
    const parent = nativeRafEvent(f, "FireAnimationFrame", "B1");
    nativeRafEvent(f, "CancelAnimationFrame", "MC").ts = parent.ts + parent.dur + 1;
  },
  "journal registration returned a different handle": (f) => {
    journalRegistration(f, "A0").handle += 1000;
  },
  "journal cancel names another returned handle": (f) => {
    f.journal.operations.find((row) => row.kind === "cancel" && row.label === "MC").handle += 1000;
  },
  "actual native Cancel instead targets the pretrace P1 handle": (f) => {
    nativeRafEvent(f, "CancelAnimationFrame", "MC").args.data.id = journalRegistration(
      f,
      "P1",
    ).handle;
  },
  "custom proof physical callTime is one microsecond after its Fire": (f) => {
    const frame = f.ui.v3Proof.frames[5];
    const mark = f.events.find((event) => event.name === frame.markName);
    const fire = nativeRafEvent(f, "FireAnimationFrame", "E0");
    mark.args.data.callTime = fire.ts + fire.dur + 1;
  },
  "custom proof timestamp no longer demonstrates its requested startTime zero": (f) => {
    const frame = f.ui.v3Proof.frames[5];
    const mark = f.events.find((event) => event.name === frame.markName);
    mark.ts = mark.args.data.callTime;
  },
  "an advertised journal flag cannot rescue a wrong callback handle": (f) => {
    f.journal.qualified = true;
    f.journal.operations.find((row) => row.kind === "callback" && row.label === "A0").handle +=
      1000;
  },
  "an advertised context flag cannot rescue a wrong executable": (f) => {
    f.context.qualified = true;
    f.context.executableSha256 = "0".repeat(64);
  },
  "unknown V4 B source location remains rejected by the full wrapper": (f) => {
    f.events[boundaryIndex].args.src_file = "cc/trees/unknown.cc";
  },
  "an unknown V4 B cannot hide beside the known boundary": (f) => {
    const extra = clone(f.events[boundaryIndex]);
    extra.name = "UnknownBoundary";
    extra.ts += 1;
    f.events.push(extra);
  },
};
for (const [name, mutate] of Object.entries(semanticV2Mutations)) {
  test(`semantic V2 rejects ${name}`, () => {
    if (typeof semanticV2.verifySemanticNativeEvidenceV2 !== "function") return;
    const f = semanticV2Fixture();
    mutate(f);
    rejectedSemanticV2(f);
  });
}
for (const [name, mutate] of [
  ["null journal", (f) => (f.journal = null)],
  ["null ui", (f) => (f.ui = null)],
  ["null events", (f) => (f.events = null)],
  ["null context", (f) => (f.context = null)],
]) {
  test(`semantic V2 returns controlled rejection for ${name}`, () => {
    if (typeof semanticV2.verifySemanticNativeEvidenceV2 !== "function") return;
    const f = semanticV2Fixture();
    mutate(f);
    rejectedSemanticV2(f);
  });
}

test("V4 positive evidence separates full raw and actually executed typed task counts", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const result = call(fixture());
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.equal(result.nativeTaskCandidates, 938);
  assert.equal(result.typedNativeTaskCandidates, 937);
});
test("wrong producer early rejection leaves the unexecuted typed task count null", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const f = fixture();
  f.context.producerRevision = "0".repeat(40);
  const result = call(f);
  assert.equal(result.qualified, false);
  assert.equal(result.nativeTaskCandidates, 938);
  assert.equal(result.typedNativeTaskCandidates, null);
});
test("unsupported E early rejection cannot relabel raw counts as executed typed validation", () => {
  if (typeof candidate.validateNativeBoundaryV4 !== "function") return;
  const f = fixture();
  const extra = clone(f.events[boundaryIndex]);
  extra.ph = "E";
  extra.ts += 1;
  f.events.push(extra);
  const result = call(f);
  assert.equal(result.qualified, false);
  assert.equal(result.nativeTaskCandidates, 939);
  assert.equal(result.typedNativeTaskCandidates, null);
});

// V2 command keeps machine cleanup separate from complete numeric trace coverage.
const semanticCommandV2Module = new URL(
  "../browser/performance-semantic-command-v2.mjs",
  import.meta.url,
);
const semanticCommandV2 = existsSync(semanticCommandV2Module)
  ? await import(semanticCommandV2Module.href)
  : {};
function numericGateProcessResult() {
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
function numericGateChild() {
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
    numericCoverageComplete: true,
  };
}
test("V2 command permits candidate success only with complete numeric coverage and actual cleanup", () => {
  assert.equal(typeof semanticCommandV2.semanticProcessOutcome, "function");
  if (typeof semanticCommandV2.semanticProcessOutcome !== "function") return;
  const outcome = semanticCommandV2.semanticProcessOutcome(
    numericGateProcessResult(),
    numericGateChild(),
  );
  assert.equal(outcome.machineLeaseReleasable, true);
  assert.equal(outcome.pilotSucceeded, true);
  assert.equal(outcome.formalQualification, "NOT_APPROVED");
});
for (const [name, change] of [
  ["false", (child) => (child.numericCoverageComplete = false)],
  ["null", (child) => (child.numericCoverageComplete = null)],
  ["missing", (child) => delete child.numericCoverageComplete],
]) {
  test(`V2 command rejects numeric coverage ${name} without retaining an already-clean machine lease`, () => {
    if (typeof semanticCommandV2.semanticProcessOutcome !== "function") return;
    const child = numericGateChild();
    change(child);
    const outcome = semanticCommandV2.semanticProcessOutcome(numericGateProcessResult(), child);
    assert.equal(outcome.machineLeaseReleasable, true);
    assert.equal(outcome.pilotSucceeded, false);
    assert.equal(outcome.formalQualification, "NOT_APPROVED");
  });
}
test("V2 complete numeric coverage cannot rescue an unconfirmed forced process tree", () => {
  if (typeof semanticCommandV2.semanticProcessOutcome !== "function") return;
  const result = {
    ...numericGateProcessResult(),
    exit_code: null,
    signal: "SIGKILL",
    timed_out: true,
    process_tree_stopped: false,
  };
  const outcome = semanticCommandV2.semanticProcessOutcome(result, numericGateChild());
  assert.equal(outcome.machineLeaseReleasable, false);
  assert.equal(outcome.pilotSucceeded, false);
  assert.equal(outcome.formalQualification, "NOT_APPROVED");
});
