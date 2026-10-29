// Frozen resource/schema acceptance. Synthetic files only, no browser/native profile.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
const base = path.resolve(process.env.V3_CANDIDATE_ROOT ?? ".");
const native = await import(
  pathToFileURL(path.join(base, "tests/browser/performance-native-v3.mjs")).href
);
const proof = await import(
  pathToFileURL(path.join(base, "tests/browser/performance-proof-v3.mjs")).href
);
const { baseV3Fixture } = await import(
  pathToFileURL(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "performance-v3-negative-fixtures.mjs",
    ),
  ).href
);
async function withTrace(raw, run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "v3-r3-resource-"));
  const file = path.join(dir, "trace.json.gz");
  assert.ok(!path.relative(os.tmpdir(), dir).startsWith(".."));
  try {
    await writeFile(file, raw);
    return await run(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const accepted = (result) =>
  assert.equal(result.nativeEligibility.qualified, true, JSON.stringify(result.nativeEligibility));
const rejected = (result, reason) => {
  assert.equal(result.nativeEligibility.qualified, false);
  assert.equal(result.nativeEligibility.status, "UNVERIFIED");
  assert.deepEqual(result.mainTaskOccupancyMs, []);
  assert.ok(
    result.nativeEligibility.reasons.some((value) => value.includes(reason)),
    JSON.stringify(result.nativeEligibility),
  );
};
test("trace resource bounds: compressed and decompressed exact bytes accepted; cap+1 invalidates", async () => {
  const f = baseV3Fixture(),
    raw = Buffer.from(JSON.stringify({ traceEvents: f.events })),
    compressed = gzipSync(raw);
  await withTrace(compressed, async (file) => {
    const exact = {
      ...native.SHORT_TRACE_CAPS,
      compressedBytes: compressed.length,
      decompressedBytes: raw.length,
    };
    accepted(await native.analyzeTraceV3(file, f.ui, f.context, { caps: exact }));
    rejected(
      await native.analyzeTraceV3(file, f.ui, f.context, {
        caps: { ...exact, compressedBytes: compressed.length - 1 },
      }),
      "COMPRESSED_TRACE_CAP",
    );
    rejected(
      await native.analyzeTraceV3(file, f.ui, f.context, {
        caps: { ...exact, decompressedBytes: raw.length - 1 },
      }),
      "DECOMPRESSED_TRACE_CAP",
    );
  });
});
test("trace resource bounds: event and every native task candidate caps precede filtering", () => {
  const f = baseV3Fixture(),
    tasks = f.events.filter((e) => e.name === "RunTask").length;
  const exact = { ...native.SHORT_TRACE_CAPS, events: f.events.length, relevantTasks: tasks };
  assert.equal(native.validateNativeV3(f.ui, f.events, f.context, exact).qualified, true);
  assert.ok(
    native
      .validateNativeV3(f.ui, f.events, f.context, { ...exact, events: f.events.length - 1 })
      .reasons.includes("INPUT_CAP"),
  );
  assert.ok(
    native
      .validateNativeV3(f.ui, f.events, f.context, { ...exact, relevantTasks: tasks - 1 })
      .reasons.includes("TASK_CANDIDATE_CAP"),
  );
});
test("trace resource bounds: expanded or malformed cap contracts cannot enlarge supported evidence", () => {
  const f = baseV3Fixture();
  for (const caps of [
    null,
    [],
    { ...native.SHORT_TRACE_CAPS, events: 0 },
    { ...native.SHORT_TRACE_CAPS, events: native.SHORT_TRACE_CAPS.events + 1 },
  ]) {
    let result;
    assert.doesNotThrow(() => {
      result = native.validateNativeV3(f.ui, f.events, f.context, caps);
    });
    assert.equal(result.qualified, false);
    assert.equal(result.status, "UNVERIFIED");
  }
});
for (const [name, bytes] of [
  ["truncated-gzip", gzipSync(Buffer.from('{"traceEvents":[]}')).subarray(0, 12)],
  ["malformed-json", gzipSync(Buffer.from('{"traceEvents":['))],
  ["invalid-utf8", gzipSync(Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125]))],
  ["nonobject-event", gzipSync(Buffer.from('{"traceEvents":[null]}'))],
])
  test(`trace resource bounds: ${name} controlled UNVERIFIED without stream rejection leak`, async () => {
    const f = baseV3Fixture();
    await withTrace(bytes, async (file) => {
      const result = await native.analyzeTraceV3(file, f.ui, f.context);
      assert.equal(result.nativeEligibility.qualified, false);
      assert.deepEqual(result.mainTaskOccupancyMs, []);
    });
  });
test("collector receipt-byte bound rejects the whole receipt and retains explicit loss instead of silently truncating", () => {
  const c = proof.createProofCollector({ mark() {}, maxReceiptBytes: 512 });
  c.begin("bounded-receipt");
  c.register(1, true);
  c.callback(1, 10, 11, true);
  c.register(2, true);
  c.callback(2, 20, 21, true);
  c.close();
  const snapshot = c.snapshot();
  assert.ok(snapshot.reasons.includes("RECEIPT_BYTES_CAP"));
  assert.deepEqual(snapshot.frames, []);
  assert.deepEqual(snapshot.callbacks, []);
  assert.ok(snapshot.counters.capHits > 0 || snapshot.counters.droppedProofs > 0);
});
