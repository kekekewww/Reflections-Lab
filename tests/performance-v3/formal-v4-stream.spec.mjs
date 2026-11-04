// Formal-cap streaming algorithm RED only. The committed input is a short semantic
// trace, never a 600-second run or formal performance approval.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { validateNativeV3, FORMAL_TRACE_CAPS } from "../browser/performance-native-v3.mjs";
import { formalNumericV3 } from "../browser/performance-numeric-formal-v3.mjs";
import { parseTraceStream } from "../browser/performance-stream-v3.mjs";

const formalModule = new URL("../browser/performance-native-formal-v4.mjs", import.meta.url);
const candidate = existsSync(formalModule) ? await import(formalModule.href) : {};
const fixtureRoot = new URL(
  "../../docs/16-nonadvanced-completion/lanes/performance/semantic-attempt01/",
  import.meta.url,
);
const traceUrl = new URL("pilot.trace.json.gz", fixtureRoot);
const traceBytes = readFileSync(traceUrl);
const rawBytes = readFileSync(new URL("pilot.raw.json", fixtureRoot));
const verificationBytes = readFileSync(new URL("native-verification.json", fixtureRoot));
const decodedTrace = gunzipSync(traceBytes);
const sourceEvents = JSON.parse(decodedTrace.toString("utf8")).traceEvents;
const sourceRaw = JSON.parse(rawBytes.toString("utf8"));
const sourceVerification = JSON.parse(verificationBytes.toString("utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = (value) => structuredClone(value);
const bits = (number) => {
  const storage = new ArrayBuffer(8);
  new DataView(storage).setFloat64(0, number, false);
  return [...new Uint8Array(storage)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
function fixture() {
  return {
    ui: clone(sourceRaw.ui),
    events: clone(sourceEvents),
    context: {
      documentBefore: clone(sourceVerification.documentBefore),
      documentAfter: clone(sourceVerification.documentAfter),
      traceDataLoss: false,
      traceStreamClosed: true,
      producerRevision: "861389936bf33ea77529ee5dcc0605e68f6bb620",
      executableSha256: "7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa",
    },
  };
}
async function withCompressed(bytes, execute) {
  const tempBase = path.resolve(tmpdir());
  const directory = path.resolve(await mkdtemp(path.join(tempBase, "rlab-formal-v4-")));
  const relative = path.relative(tempBase, directory);
  assert.ok(
    relative !== "" &&
      relative !== ".." &&
      !relative.startsWith(".." + path.sep) &&
      !path.isAbsolute(relative),
  );
  assert.ok(path.basename(directory).startsWith("rlab-formal-v4-"));
  try {
    const filename = path.join(directory, "trace.json.gz");
    await writeFile(filename, bytes);
    return await execute(filename);
  } finally {
    // The resolved target was checked above and is the one owned mkdtemp directory.
    await rm(directory, { recursive: true, force: true });
  }
}
async function withEvents(events, execute) {
  return await withCompressed(gzipSync(JSON.stringify({ traceEvents: events })), execute);
}
async function rejected(filename, f, expectedReason) {
  let result;
  await assert.doesNotReject(async () => {
    result = await candidate.analyzeFormalTraceV4(filename, f.ui, f.context);
  });
  assert.equal(result.nativeEligibility.qualified, false);
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.deepEqual(result.mainTaskOccupancyMs, []);
  assert.deepEqual(result.nativeTraceBinBoundariesUs, []);
  assert.ok(
    Array.isArray(result.nativeEligibility.reasons) && result.nativeEligibility.reasons.length > 0,
  );
  if (expectedReason) {
    assert.ok(
      result.nativeEligibility.reasons.some((reason) => String(reason).includes(expectedReason)),
      JSON.stringify(result.nativeEligibility.reasons),
    );
  }
}

test("formal V4 exposes a streamed analyzer independently of the frozen V3 module", () => {
  assert.equal(typeof candidate.analyzeFormalTraceV4, "function");
});
test("formal streaming fixture is the exact committed short raw and still fails original V3", () => {
  assert.equal(sha(traceBytes), "c4481687bfbcb7657a1f0a55d91f48b1e57d68c2736ea6de7a8dcfb40f887b72");
  assert.equal(sha(rawBytes), "8c95e3bfdceef6a098abcc1102f493e51b4072bb0745b742a237b3d72187fe3e");
  assert.equal(
    sha(verificationBytes),
    "4984cb50b038cd1a909b21ea28b58819c7c1ed017458f13bb809a0b97753ca2d",
  );
  assert.equal(sourceEvents.length, 3306);
  assert.equal(decodedTrace.length, 834926);
  const f = fixture();
  assert.ok(f.ui.sampleMilliseconds < 600000);
  const legacy = validateNativeV3(f.ui, f.events, f.context, FORMAL_TRACE_CAPS);
  assert.equal(legacy.qualified, false);
  assert.deepEqual(legacy.reasons, ["RENDERER_TASK_SCHEMA_OR_CATEGORY"]);
  assert.equal(legacy.validatedTasks.length, 47);
});
test("formal V4 stream preserves full raw counts, exact caps, source indexes and numeric bits", async () => {
  if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
  const f = fixture();
  const before = clone(f);
  const legacy = validateNativeV3(f.ui, f.events, f.context, FORMAL_TRACE_CAPS);
  // Reference-only typed numeric input; this does not change the original raw rejection.
  const reference = formalNumericV3(f.ui, {
    qualified: true,
    begin: legacy.begin,
    end: legacy.end,
    validatedTasks: legacy.validatedTasks,
    referencePurpose: "NUMERIC_ONLY_ORIGINAL_RAW_REMAINS_REJECTED",
  });
  const result = await candidate.analyzeFormalTraceV4(fileURLToPath(traceUrl), f.ui, f.context);
  assert.equal(
    result.nativeEligibility.qualified,
    true,
    JSON.stringify(result.nativeEligibility.reasons),
  );
  assert.equal(result.nativeEligibility.status, "CANDIDATE_EVIDENCE");
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.equal(result.formal600Run, false);
  assert.deepEqual(result.traceCaps, FORMAL_TRACE_CAPS);
  assert.equal(result.scope, "ALGORITHM_ONLY");
  assert.equal(result.rawEventCount, 3306);
  assert.equal(result.inputViewEventCount, result.streamStats.retainedEvents);
  assert.equal(result.nativeEligibility.rawEventCount, 3306);
  assert.equal(result.parsedTraceEvents, 3306);
  assert.equal(result.streamStats.events, 3306);
  assert.equal(result.streamStats.retainedNamedTaskCandidates, 938);
  assert.ok(result.streamStats.retainedEvents > 938 && result.streamStats.retainedEvents <= 3306);
  assert.equal(result.nativeEligibility.nativeTaskCandidates, 938);
  assert.equal(result.nativeEligibility.typedNativeTaskCandidates, 937);
  assert.equal(result.nativeEligibility.legacyRawEligibility.qualified, false);
  assert.deepEqual(result.nativeEligibility.legacyRawEligibility.reasons, [
    "RENDERER_TASK_SCHEMA_OR_CATEGORY",
  ]);
  const boundary = result.nativeEligibility.classifications[0];
  assert.equal(result.nativeEligibility.classifications.length, 1);
  assert.equal(
    boundary.eventIndex,
    2377,
    "index refers to original raw, not a retained view index",
  );
  assert.deepEqual(boundary.source, f.events[2377]);
  assert.equal(boundary.duration, null);
  assert.equal(boundary.numericIncluded, false);
  assert.deepEqual(
    result.nativeTraceBinBoundariesUs.map(bits),
    reference.nativeTraceBinBoundariesUs.map(bits),
  );
  assert.deepEqual(result.mainTaskOccupancyMs.map(bits), reference.mainTaskOccupancyMs.map(bits));
  assert.equal(result.complete, reference.complete);
  assert.equal(result.coverage.complete, reference.complete);
  assert.deepEqual(result.analysisContext, f.context);
  assert.deepEqual(f, before);
  assert.equal(validateNativeV3(f.ui, f.events, f.context, FORMAL_TRACE_CAPS).qualified, false);
});

const retentionMutations = {
  "unknown-name owned B is validated before retention selection": (f) => {
    const event = clone(f.events[2377]);
    event.name = "UnknownOwnedBegin";
    event.args = { unknown: true };
    event.ts += 1;
    f.events.push(event);
  },
  "unknown-name owned E is validated before retention selection": (f) => {
    const event = clone(f.events[2377]);
    event.name = "UnknownOwnedEnd";
    event.ph = "E";
    event.args = { unknown: true };
    event.ts += 1;
    f.events.push(event);
  },
  "known pinned source cannot be discarded because its owner changed": (f) => {
    f.events[2377].pid += 1;
    f.events[2377].tid += 1;
  },
  "unknown-name known source on another owner is not filtered away": (f) => {
    const event = clone(f.events[2377]);
    event.name = "NotInTheTaskNameFilter";
    event.pid += 1;
    event.tid += 1;
    event.ts += 1;
    f.events.push(event);
  },
  "invalid complete task outside window remains rejected": (f) => {
    const legacy = validateNativeV3(f.ui, f.events, f.context, FORMAL_TRACE_CAPS);
    const event = f.events.find(
      (row) =>
        ["RunTask", "ThreadControllerImpl::RunTask"].includes(row.name) &&
        row.pid === legacy.expectedPid &&
        row.tid === legacy.expectedTid &&
        row.ph === "X",
    );
    event.ts = legacy.end + 1000;
    event.dur = -1;
    assert.ok(
      validateNativeV3(f.ui, f.events, f.context, FORMAL_TRACE_CAPS).reasons.includes(
        "RENDERER_TASK_SCHEMA_OR_CATEGORY",
      ),
    );
  },
};
for (const [name, mutate] of Object.entries(retentionMutations)) {
  test(`formal V4 stream rejects ${name}`, async () => {
    if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
    const f = fixture();
    mutate(f);
    await withEvents(f.events, async (filename) => rejected(filename, f));
  });
}
for (const [name, event, reason] of [
  ["non-object", null, "EVENT_OBJECT_SCHEMA"],
  ["array object", [], "EVENT_OBJECT_SCHEMA"],
  ["number", 7, "EVENT_OBJECT_SCHEMA"],
  ["non-string name", { name: 7, ph: "I" }, "EVENT_NAME_SCHEMA_OR_CAP"],
  ["name 512 plus one", { name: "x".repeat(513), ph: "I" }, "EVENT_NAME_SCHEMA_OR_CAP"],
]) {
  test(`formal V4 stream rejects foreign ${name} before retention`, async () => {
    if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
    const f = fixture();
    f.events.push(event);
    await withEvents(f.events, async (filename) => rejected(filename, f, reason));
  });
}
test("formal V4 name cap accepts the exact 512-character foreign-name edge", async () => {
  if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
  const f = fixture();
  f.events.push({ name: "x".repeat(512), ph: "I", cat: "foreign" });
  await withEvents(f.events, async (filename) => {
    const result = await candidate.analyzeFormalTraceV4(filename, f.ui, f.context);
    assert.equal(
      result.nativeEligibility.qualified,
      true,
      JSON.stringify(result.nativeEligibility.reasons),
    );
    assert.equal(result.parsedTraceEvents, 3307);
    assert.equal(result.streamStats.events, 3307);
    assert.deepEqual(result.traceCaps, FORMAL_TRACE_CAPS);
    assert.equal(result.formalQualification, "NOT_APPROVED");
    assert.equal(result.formal600Run, false);
  });
});
for (const [name, bytes] of [
  ["bad gzip header", Buffer.from("this-is-not-a-gzip-trace")],
  [
    "duplicate traceEvents keys",
    gzipSync('{"traceEvents":[],"traceEvents":' + JSON.stringify(sourceEvents) + "}"),
  ],
  ["truncated gzip", traceBytes.subarray(0, 20)],
  [
    "gzip CRC mismatch",
    (() => {
      const bytes = Buffer.from(traceBytes);
      bytes[bytes.length - 8] ^= 1;
      return bytes;
    })(),
  ],
]) {
  test(`formal V4 preserves the original stream error for ${name}`, async () => {
    if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
    const f = fixture();
    await withCompressed(bytes, async (filename) => {
      let originalError = null;
      try {
        await parseTraceStream(filename, () => {}, {
          caps: {
            compressedBytes: FORMAL_TRACE_CAPS.compressedBytes,
            decodedBytes: FORMAL_TRACE_CAPS.decompressedBytes,
            events: FORMAL_TRACE_CAPS.events,
            timeoutMs: 300000,
          },
        });
      } catch (error) {
        originalError = error;
      }
      assert.ok(originalError instanceof Error);
      await rejected(filename, f, originalError.message);
    });
  });
}
for (const [name, mutate, reason] of [
  ["producer mismatch", (f) => (f.context.producerRevision = "0".repeat(40)), null],
  ["executable mismatch", (f) => (f.context.executableSha256 = "0".repeat(64)), null],
  ["native trace loss", (f) => (f.context.traceDataLoss = true), "TRACE_LOSS_OR_UNKNOWN_CLOSE"],
  ["unknown trace close", (f) => delete f.context.traceStreamClosed, "TRACE_LOSS_OR_UNKNOWN_CLOSE"],
]) {
  test(`formal V4 stream preserves rejection for ${name}`, async () => {
    if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
    const f = fixture();
    mutate(f);
    await rejected(fileURLToPath(traceUrl), f, reason);
  });
}

test("formal V4 uses the exact original formal resource ceilings", () => {
  assert.deepEqual(FORMAL_TRACE_CAPS, {
    compressedBytes: 268435456,
    decompressedBytes: 2147483648,
    events: 8000000,
    relevantTasks: 2000000,
    metadataNameCharacters: 512,
    proofNameCharacters: 192,
    retainedSerializedBytes: 536870912,
    heapBytes: 2147483648,
  });
  assert.equal(Object.isFrozen(FORMAL_TRACE_CAPS), true);
});

test("formal V4 retains unknown B and E from another owner without inventing a rejection", async () => {
  if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
  const f = fixture();
  const baseline = await candidate.analyzeFormalTraceV4(fileURLToPath(traceUrl), f.ui, f.context);
  const source = f.events[2377];
  const foreign = {
    name: "ForeignUnownedScope",
    cat: "foreign",
    pid: source.pid + 1,
    tid: source.tid + 1,
    args: { unrelated: true },
  };
  f.events.push(
    { ...clone(foreign), ph: "B", ts: source.ts + 1 },
    { ...clone(foreign), ph: "E", ts: source.ts + 2 },
  );
  await withEvents(f.events, async (filename) => {
    const result = await candidate.analyzeFormalTraceV4(filename, f.ui, f.context);
    assert.equal(
      result.nativeEligibility.qualified,
      true,
      JSON.stringify(result.nativeEligibility.reasons),
    );
    assert.equal(result.rawEventCount, 3308);
    assert.equal(result.nativeEligibility.rawEventCount, 3308);
    assert.equal(result.parsedTraceEvents, 3308);
    assert.equal(result.streamStats.events, 3308);
    assert.equal(result.inputViewEventCount, baseline.inputViewEventCount + 2);
    assert.equal(result.streamStats.retainedEvents, baseline.streamStats.retainedEvents + 2);
    assert.equal(result.streamStats.retainedNamedTaskCandidates, 938);
    assert.equal(result.nativeEligibility.classifications.length, 1);
    assert.equal(result.nativeEligibility.classifications[0].eventIndex, 2377);
    assert.equal(result.formalQualification, "NOT_APPROVED");
    assert.equal(result.formal600Run, false);
  });
});

test("formal V4 maps classifications to changed raw ordinals after pruning an earlier event", async () => {
  if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
  const f = fixture();
  const baseline = await candidate.analyzeFormalTraceV4(fileURLToPath(traceUrl), f.ui, f.context);
  f.events.unshift({ name: "ForeignPrunedInstant", cat: "foreign", ph: "I" });
  await withEvents(f.events, async (filename) => {
    const result = await candidate.analyzeFormalTraceV4(filename, f.ui, f.context);
    assert.equal(
      result.nativeEligibility.qualified,
      true,
      JSON.stringify(result.nativeEligibility.reasons),
    );
    assert.equal(result.rawEventCount, 3307);
    assert.equal(result.nativeEligibility.rawEventCount, 3307);
    assert.equal(result.parsedTraceEvents, 3307);
    assert.equal(result.inputViewEventCount, baseline.inputViewEventCount);
    assert.equal(result.streamStats.retainedEvents, baseline.streamStats.retainedEvents);
    const boundary = result.nativeEligibility.classifications[0];
    assert.equal(boundary.eventIndex, 2378);
    assert.deepEqual(boundary.source, f.events[2378]);
    assert.equal(boundary.duration, null);
    assert.equal(boundary.numericIncluded, false);
    assert.deepEqual(
      result.nativeTraceBinBoundariesUs.map(bits),
      baseline.nativeTraceBinBoundariesUs.map(bits),
    );
    assert.deepEqual(result.mainTaskOccupancyMs.map(bits), baseline.mainTaskOccupancyMs.map(bits));
    assert.equal(result.scope, "ALGORITHM_ONLY");
    assert.equal(result.formal600Run, false);
    assert.equal(result.formalQualification, "NOT_APPROVED");
  });
});

test("formal V4 retains unknown complete events at the pinned posting site on another owner", async () => {
  if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
  const f = fixture();
  const baseline = await candidate.analyzeFormalTraceV4(fileURLToPath(traceUrl), f.ui, f.context);
  const event = clone(f.events[2377]);
  event.name = "ForeignKnownPostingSiteComplete";
  event.ph = "X";
  event.pid += 1;
  event.tid += 1;
  event.ts += 1;
  event.dur = 1;
  f.events.push(event);
  await withEvents(f.events, async (filename) => {
    const result = await candidate.analyzeFormalTraceV4(filename, f.ui, f.context);
    // Frozen V4 rejects known-site wrong owners only for B/E. This X must be
    // retained, but the streaming wrapper must not invent a new V4 rejection.
    assert.equal(
      result.nativeEligibility.qualified,
      true,
      JSON.stringify(result.nativeEligibility.reasons),
    );
    assert.equal(result.rawEventCount, 3307);
    assert.equal(result.nativeEligibility.rawEventCount, 3307);
    assert.equal(result.inputViewEventCount, baseline.inputViewEventCount + 1);
    assert.equal(result.streamStats.retainedEvents, baseline.streamStats.retainedEvents + 1);
    assert.equal(result.streamStats.retainedNamedTaskCandidates, 938);
    assert.equal(result.nativeEligibility.classifications.length, 1);
    assert.equal(result.formalQualification, "NOT_APPROVED");
    assert.equal(result.formal600Run, false);
  });
});

test("formal V4 preserves native-qualified but numerically incomplete canonical attempt02", async () => {
  if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
  const attemptRoot = new URL(
    "../../docs/16-nonadvanced-completion/lanes/performance/semantic-attempt02-v4/native/",
    import.meta.url,
  );
  const trace = new URL("pilot.trace.json.gz", attemptRoot);
  const raw = new URL("pilot.raw.json", attemptRoot);
  const verification = new URL("verification.json", attemptRoot);
  const pins = [
    [trace, "02e874df3350dbab25db5a9b10c7503bc2bc9bd65f26b87c613aa952fd767d0b"],
    [raw, "dff5fa6d6e4260f3de546f570cc084cd965575e25525690baca753de34243c0e"],
    [verification, "9816901c42b618cd956b64366cf254e78bea9e009ff86fdf26cb3c2100a5a491"],
  ];
  for (const [url, expected] of pins) assert.equal(sha(readFileSync(url)), expected);
  const savedRaw = JSON.parse(readFileSync(raw).toString("utf8"));
  const savedVerification = JSON.parse(readFileSync(verification).toString("utf8"));
  const events = JSON.parse(gunzipSync(readFileSync(trace)).toString("utf8")).traceEvents;
  assert.equal(
    savedVerification.host.browserVersionReceipt.revision,
    "@861389936bf33ea77529ee5dcc0605e68f6bb620",
  );
  assert.equal(
    savedVerification.executable.sha256Before,
    "7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa",
  );
  assert.equal(savedVerification.executable.sha256After, savedVerification.executable.sha256Before);
  assert.equal(savedVerification.traceMetadata.dataLossOccurred, false);
  const context = {
    documentBefore: clone(savedVerification.documentBefore),
    documentAfter: clone(savedVerification.documentAfter),
    traceDataLoss: false,
    traceStreamClosed: true,
    producerRevision: savedVerification.host.browserVersionReceipt.revision.slice(1),
    executableSha256: savedVerification.executable.sha256Before,
  };
  const uiBefore = clone(savedRaw.ui);
  const nativeReference = validateNativeV3(savedRaw.ui, events, context, FORMAL_TRACE_CAPS);
  assert.equal(nativeReference.qualified, true, JSON.stringify(nativeReference.reasons));
  const numericReference = formalNumericV3(savedRaw.ui, nativeReference);
  assert.equal(numericReference.complete, false);
  assert.equal(numericReference.mergedNativeTasks[0][0] - nativeReference.begin, 51870);
  assert.deepEqual(numericReference.mainTaskOccupancyMs, []);
  const result = await candidate.analyzeFormalTraceV4(fileURLToPath(trace), savedRaw.ui, context);
  assert.equal(
    result.nativeEligibility.qualified,
    true,
    JSON.stringify(result.nativeEligibility.reasons),
  );
  assert.equal(result.nativeEligibility.legacyRawEligibility.qualified, true);
  assert.equal(result.rawEventCount, 3565);
  assert.equal(result.nativeEligibility.rawEventCount, 3565);
  assert.equal(result.complete, false);
  assert.equal(result.coverage.nativeV4Qualified, true);
  assert.equal(result.coverage.complete, false);
  assert.deepEqual(result.mainTaskOccupancyMs, []);
  assert.deepEqual(
    result.nativeTraceBinBoundariesUs.map(bits),
    numericReference.nativeTraceBinBoundariesUs.map(bits),
  );
  assert.equal(result.scope, "ALGORITHM_ONLY");
  assert.equal(result.formal600Run, false);
  assert.equal(result.formalQualification, "NOT_APPROVED");
  assert.deepEqual(savedRaw.ui, uiBefore);
  for (const [url, expected] of pins) assert.equal(sha(readFileSync(url)), expected);
});

test("formal V4 does not present a retained prefix as the full raw count after schema failure", async () => {
  if (typeof candidate.analyzeFormalTraceV4 !== "function") return;
  const f = fixture();
  const prefix = clone(f.events.find((event) => event.name === "thread_name"));
  assert.ok(prefix && typeof prefix.name === "string");
  await withEvents([prefix, null], async (filename) => {
    let result;
    await assert.doesNotReject(async () => {
      result = await candidate.analyzeFormalTraceV4(filename, f.ui, f.context);
    });
    assert.equal(result.nativeEligibility.qualified, false);
    assert.ok(result.nativeEligibility.reasons.includes("EVENT_OBJECT_SCHEMA"));
    assert.equal(result.parsedTraceEvents, null);
    assert.equal(result.rawEventCount, null);
    assert.equal(result.nativeEligibility.rawEventCount, null);
    // The parser invoked the callback twice, including the invalid second raw
    // row; only the first row was retained. Neither count is a completed stream.
    assert.equal(result.parsedEventsBeforeFailure, 2);
    assert.equal(result.inputViewEventCount, 1);
    assert.equal(result.nativeEligibility.inputViewEventCount, 1);
    assert.deepEqual(result.mainTaskOccupancyMs, []);
    assert.deepEqual(result.nativeTraceBinBoundariesUs, []);
    assert.equal(result.complete, false);
    assert.equal(result.coverage.complete, false);
    assert.equal(result.coverage.nativeV4Qualified, false);
    assert.equal(result.coverage.originalRawV3Qualified, null);
    assert.equal(result.coverage.markedDurationMs, null);
    assert.equal(result.scope, "ALGORITHM_ONLY");
    assert.equal(result.formal600Run, false);
    assert.equal(result.formalQualification, "NOT_APPROVED");
  });
});
