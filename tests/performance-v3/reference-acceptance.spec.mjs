// Frozen R3 acceptance. Synthetic inputs only; no browser, native eligibility, or profile claim.
// The candidate adapter and all expectations live in the independent immutable reference.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const referenceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "reference");
const candidateRoot = path.resolve(root, process.env.V3_CANDIDATE_ROOT ?? ".");
const reference = await import(pathToFileURL(path.join(referenceRoot, "fixtures.mjs")).href);
const oracle = await import(pathToFileURL(path.join(referenceRoot, "rational-binary64.mjs")).href);
const candidate = await import(
  pathToFileURL(path.join(candidateRoot, "tests/browser/performance-native-v3.mjs")).href
);
const legacy = await import(
  pathToFileURL(path.resolve(root, "tests/browser/performance-profile.mjs")).href
);
const {
  NUMERIC_FIXTURES,
  ERROR_FIXTURES,
  candidateNumericAdapterInput,
  FULL_CAP_SPEC,
  fullCapFixture,
} = reference;
const { independentReference, bits, round64 } = oracle;
const hashes = Object.freeze({
  "fixtures.mjs": "da5724a05c187219649dd1fca0316d649f96d7644c970c15b1de6b01ccd72921",
  "rational-binary64.mjs": "c3884a369b26739a976cde40d2d7ff34a9b33ad6f47d938af862241456a6e246",
  "self-validation-receipt.json":
    "70827df24c8ef0db385472e148caf3079dc7e82b84a9f82afa313ddf0dea6417",
});
const actual = (fixture) => {
  const adapted = candidateNumericAdapterInput(fixture);
  return candidate.unchangedNumericV3(adapted.ui, adapted.validated);
};
const assertRejected = (fixture, expectedReason) => {
  let value;
  assert.doesNotThrow(() => {
    value = actual(fixture);
  }, "unsupported numeric input must produce a controlled receipt");
  assert.ok(value && typeof value === "object", "numeric rejection must be explicit");
  assert.equal(value.status, "UNVERIFIED");
  assert.equal(value.complete, false);
  assert.deepEqual(
    value.mainTaskOccupancyMs,
    [],
    "invalid numeric evidence cannot become zero occupancy",
  );
  assert.ok(
    Array.isArray(value.reasons) && value.reasons.includes(expectedReason),
    `expected independent reason ${expectedReason}; actual=${JSON.stringify(value.reasons)}`,
  );
};

test("reference source pins, fixed fixture counts, and original V2 source remain immutable", async () => {
  for (const [file, expected] of Object.entries(hashes)) {
    const bytes = await readFile(path.join(referenceRoot, file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, file);
  }
  assert.equal(NUMERIC_FIXTURES.length, 14);
  assert.equal(ERROR_FIXTURES.length, 15);
  assert.equal(
    createHash("sha256")
      .update(await readFile(path.resolve(root, "tests/browser/performance-profile.mjs")))
      .digest("hex"),
    "df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c",
  );
});

for (const fixture of NUMERIC_FIXTURES)
  test(`candidate vs independent ordered binary64: ${fixture.id}`, () => {
    const before = structuredClone(fixture);
    const independent = independentReference(fixture.input);
    // Rational mathematical intent is checked against its own literals. It is not substituted
    // for the step-rounded binary64 calculation and must not be forced to equal that result.
    assert.deepEqual(independent.mathematical, fixture.mathematical);
    assert.deepEqual(independent.ordered.nativeBits, fixture.expected.native.map(bits));
    assert.deepEqual(independent.ordered.occupancyBits, fixture.expected.occupancyMs.map(bits));
    assert.equal(independent.ordered.complete, fixture.expected.complete);
    const result = actual(fixture);
    assert.deepEqual(result.nativeTraceBinBoundariesUs.map(bits), independent.ordered.nativeBits);
    assert.deepEqual(
      result.mainTaskOccupancyMs.map(bits),
      independent.ordered.reportedMs.map(bits),
    );
    assert.equal(result.complete, independent.ordered.complete);
    assert.deepEqual(
      fixture,
      before,
      "neither candidate nor adapter may normalize the fixed fixture",
    );
  });

for (const fixture of ERROR_FIXTURES)
  test(`controlled numeric rejection before unchanged math: ${fixture.id}`, () => {
    assert.throws(
      () => independentReference(fixture.input),
      (error) => error.message === fixture.expectedError,
    );
    assertRejected(fixture, fixture.expectedError);
  });

test("exact raw-frame cap plus one is rejected before bins or task computation", () => {
  assertRejected(fullCapFixture(FULL_CAP_SPEC.rawFrames + 1, 1), "INPUT_CAP");
});
test("exact native-task cap plus one is rejected before valid-task filtering", () => {
  assertRejected(fullCapFixture(1, FULL_CAP_SPEC.tasks + 1), "INPUT_CAP");
});

test("actual candidate full-cap 90000 raw and 200000 tasks matches independent closed form", () => {
  const fixture = fullCapFixture();
  assert.equal(fixture.input.rawRaf.length, FULL_CAP_SPEC.rawFrames);
  assert.equal(fixture.input.tasks.length, FULL_CAP_SPEC.tasks);
  const result = actual(fixture);
  assert.equal(result.complete, FULL_CAP_SPEC.complete);
  assert.equal(result.nativeTaskCount, FULL_CAP_SPEC.tasks);
  assert.equal(result.nativeTraceBinBoundariesUs.length, FULL_CAP_SPEC.expectedBins);
  assert.equal(result.mainTaskOccupancyMs.length, FULL_CAP_SPEC.expectedOccupancies);
  assert.deepEqual(result.mergedNativeTasks, FULL_CAP_SPEC.expectedUnion);
  // Closed form is exact: i / 2^17 then * (1000 * 2^17) yields 1000*i.
  for (let i = 0; i <= FULL_CAP_SPEC.rawFrames; i++) {
    assert.equal(bits(result.nativeTraceBinBoundariesUs[i]), bits(i * 1000), `native edge ${i}`);
    if (i < FULL_CAP_SPEC.rawFrames)
      assert.equal(
        bits(result.mainTaskOccupancyMs[i]),
        bits(FULL_CAP_SPEC.expectedFirst90000OccupanciesMs),
        `occupancy ${i}`,
      );
  }
  assert.equal(bits(result.nativeTraceBinBoundariesUs.at(-1)), bits(FULL_CAP_SPEC.end));
  assert.equal(
    bits(result.mainTaskOccupancyMs.at(-1)),
    bits(FULL_CAP_SPEC.expectedLastOccupancyMs),
  );
});

async function legacyNumeric(fixture) {
  const input = fixture.input,
    collectionId = `reference-${fixture.id}`;
  const beginMarkName = `reflection-profile.begin.${collectionId}`;
  const endMarkName = `reflection-profile.end.${collectionId}`;
  const ui = {
    startedAtPerformanceMs: input.origin,
    sampleMilliseconds: input.duration,
    collectionWindow: {
      schemaVersion: "2.0.0",
      collectionId,
      beginMarkName,
      endMarkName,
      beginPerformanceMs: input.origin,
      endPerformanceMs: input.finish,
    },
    frame: input.rawRaf.map((timestamp) => ({
      timestamp,
      collectionId,
      callbackObservedAtPerformanceMs: timestamp,
    })),
  };
  const traceEvents = [
    { name: "thread_name", ph: "M", pid: 7, tid: 9, args: { name: "CrRendererMain" } },
    { name: beginMarkName, ts: input.begin, pid: 7, tid: 9 },
    { name: endMarkName, ts: input.end, pid: 7, tid: 9 },
    ...input.tasks.map((task) => ({
      ...task,
      name: "RunTask",
      ph: "X",
      cat: "toplevel",
      pid: 7,
      tid: 9,
    })),
  ];
  const tempRoot = path.resolve(os.tmpdir()),
    prefix = "performance-r3-reference-";
  const directory = await mkdtemp(path.join(tempRoot, prefix));
  try {
    const filename = path.join(directory, "synthetic.trace.json.gz");
    await writeFile(filename, gzipSync(JSON.stringify({ traceEvents })), { flag: "wx" });
    return await legacy.analyzeTrace(filename, ui);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), tempRoot);
    assert.ok(path.basename(directory).startsWith(prefix));
    await rm(directory, { recursive: true, force: false });
  }
}
// No synthetic endpoint witnesses are inserted. The three raw=[] coverage fixtures are
// evaluated against the independent ordered oracle above; original V2 membership cannot
// represent them, so the actual original-analyzer comparison covers only raw length >=2.
for (const fixture of NUMERIC_FIXTURES.filter((value) => value.input.rawRaf.length >= 2))
  test(`actual immutable V2 ordered-bit comparison: ${fixture.id}`, async () => {
    const previous = await legacyNumeric(fixture),
      result = actual(fixture);
    assert.equal(previous.coverage.complete, fixture.expected.complete);
    assert.equal(result.complete, previous.coverage.complete);
    assert.deepEqual(
      result.nativeTraceBinBoundariesUs.map(bits),
      previous.coverage.clockCorrelation.nativeTraceBinBoundariesUs.map(bits),
    );
    assert.deepEqual(result.mainTaskOccupancyMs.map(bits), previous.mainTaskOccupancyMs.map(bits));
  });

test("mapping-order divergence retains distinct mathematical and ordered answers", () => {
  const fixture = NUMERIC_FIXTURES.find((value) => value.id === "mapping-order-divergence");
  const result = actual(fixture),
    independent = independentReference(fixture.input);
  assert.equal(independent.mathematical.native[1], "3/10");
  assert.equal(bits(round64(independent.mathematical.native[1])), bits(0.3));
  assert.equal(bits(result.nativeTraceBinBoundariesUs[1]), bits(0.30000000000000004));
  assert.notEqual(
    bits(result.nativeTraceBinBoundariesUs[1]),
    bits(round64(independent.mathematical.native[1])),
  );
});
test("per-component /1000 then ordered sum is not reassociated into total/1000", () => {
  const fixture = NUMERIC_FIXTURES.find((value) => value.id === "per-component-division-order");
  const result = actual(fixture),
    independent = independentReference(fixture.input);
  assert.equal(independent.mathematical.occupancyMs[0], "3/10");
  assert.equal(bits(result.mainTaskOccupancyMs[0]), bits(0.30000000000000004));
  assert.notEqual(
    bits(result.mainTaskOccupancyMs[0]),
    bits(round64(independent.mathematical.occupancyMs[0])),
  );
});
