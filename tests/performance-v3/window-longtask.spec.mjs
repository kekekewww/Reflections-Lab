import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("tests/browser/performance-fixture-v3.mjs", "utf8");
const beginToken = "observer = new PerformanceObserver((list) => {";
const begin = source.indexOf(beginToken);
const end = source.indexOf("\n    });", begin);
assert.ok(begin >= 0 && end > begin, "Actual observer callback extraction boundary");
const actualCallback = new Function(
  "list",
  "samples",
  "append",
  source.slice(begin + beginToken.length, end),
);

const fields = {
  name: "unknown",
  entryType: "taskattribution",
  startTime: 0,
  duration: 0,
  containerType: "iframe",
  containerSrc: "https://example.invalid/frame?q=1",
  containerId: "frame-one",
  containerName: "original frame",
};
function hostEntry() {
  // The own function is intentionally noncloneable, like an exotic native host
  // entry. The nested toJSON returns the documented JSON fields only.
  const attribution = { ...fields, noncloneableNativeFunction: () => {} };
  Object.setPrototypeOf(attribution, {
    toJSON() {
      return Object.fromEntries(Object.keys(fields).map((key) => [key, this[key]]));
    },
  });
  const plain = {
    name: "self",
    entryType: "longtask",
    startTime: 123.00000000000001,
    duration: 50.00000000000001,
    attribution: [attribution],
  };
  return { attribution, plain, entry: { toJSON: () => plain } };
}
function collect(entry) {
  const samples = { longTasks: [] };
  actualCallback({ getEntries: () => [entry] }, samples, (rows, value) => rows.push(value));
  assert.equal(samples.longTasks.length, 1, "One native observation retained");
  return samples.longTasks[0];
}
function expected(h) {
  return { ...h.plain, attribution: [{ ...fields }] };
}

test("actual longtask observer stores nested native-like attribution as exact plain JSON fields", () => {
  const h = hostEntry(),
    row = collect(h.entry);
  assert.equal(Object.getPrototypeOf(row), Object.prototype);
  assert.equal(Object.getPrototypeOf(row.attribution[0]), Object.prototype);
  assert.deepEqual(row, expected(h));
});
test("actual longtask observer output can be included in closed-window structuredClone", () => {
  const h = hostEntry(),
    row = collect(h.entry);
  assert.deepEqual(structuredClone({ longTasks: [row] }), { longTasks: [expected(h)] });
});
test("actual longtask observer detaches caller-owned longtask and attribution before later mutation", () => {
  const h = hostEntry(),
    original = expected(h),
    row = collect(h.entry);
  h.attribution.containerName = "later mutated frame";
  h.attribution.containerSrc = "later source";
  h.plain.duration = 900;
  h.plain.attribution.push({ name: "later entry" });
  assert.deepEqual(row, original);
});
test("actual longtask observer retains time identity and every attribution metadata field", () => {
  const h = hostEntry(),
    row = collect(h.entry);
  assert.deepEqual(
    Object.keys(row).sort(),
    ["name", "entryType", "startTime", "duration", "attribution"].sort(),
  );
  assert.equal(row.name, "self");
  assert.equal(row.entryType, "longtask");
  assert.equal(row.startTime, 123.00000000000001);
  assert.equal(row.duration, 50.00000000000001);
  assert.deepEqual(Object.keys(row.attribution[0]).sort(), Object.keys(fields).sort());
  for (const [key, value] of Object.entries(fields))
    assert.equal(row.attribution[0][key], value, key);
});
