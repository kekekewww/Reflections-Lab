import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import {
  canonicalStringify,
  immutableClone,
  immutableCloneWithByteLength,
} from "../../src/experiments/hash.js";

interface BaselineHash {
  canonicalStringify(value: unknown): string;
  immutableClone<T>(value: T): T;
  canonicalBytes(value: unknown): number;
}

// Execute only the archived local pre-change implementation. Its single relative
// RecordingError import is rebound to the same project error class as production.
const original = await readFile(
  new URL("../../artifacts/v1/capture-cost-baseline-20261027/hash.ts", import.meta.url),
  "utf8",
);
const errorModule = new URL("../../src/experiments/types.ts", import.meta.url).href;
assert.equal(original.match(/from "\.\/types\.js"/g)?.length, 1);
const compiled = transpileModule(
  original.replace('from "./types.js"', `from ${JSON.stringify(errorModule)}`),
  { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } },
).outputText;
const baseline = (await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
)) as BaselineHash;

function originalPair(value: unknown): { value: unknown; byteLength: number } {
  const clone = baseline.immutableClone(value);
  return { value: clone, byteLength: baseline.canonicalBytes(clone) };
}

function errorRecord(work: () => unknown): { name: string; message: string; code: unknown } {
  try {
    work();
  } catch (error) {
    assert.ok(error instanceof Error);
    return {
      name: error.name,
      message: error.message,
      code: "code" in error ? error.code : undefined,
    };
  }
  assert.fail("expected canonical validation to reject the input");
}

test("clone and byte accounting exactly match the archived two-pass implementation", () => {
  const shared = { value: [1, 2, 3] };
  const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
    z: "末尾",
    a: "開頭",
  });
  const fixtures = [
    null,
    true,
    0,
    -0,
    1e-12,
    '台灣聲學🎧\u0000\n"\\\ud800',
    [],
    { z: [null, false, -0, "é"], a: { second: 2, first: 1 } },
    { first: shared, second: shared },
    nullPrototype,
  ];
  for (const fixture of fixtures) {
    const expected = originalPair(fixture);
    const actual = immutableCloneWithByteLength(fixture);
    assert.deepEqual(actual, expected);
    const canonical = baseline.canonicalStringify(expected.value);
    assert.equal(canonicalStringify(actual.value), canonical);
    assert.equal(actual.byteLength, Buffer.byteLength(canonical, "utf8"));
  }
  assert.equal(Object.is(immutableCloneWithByteLength(-0).value, -0), false);
});

test("UTF-8 byte accounting distinguishes encoded bytes from JavaScript string length", () => {
  for (const text of ["測試", "🎧", "e\u0301", "\ud800", "\udc00", "\u2028\u2029"]) {
    const result = immutableCloneWithByteLength({ text });
    assert.equal(result.byteLength, originalPair({ text }).byteLength);
    assert.equal(result.byteLength, Buffer.byteLength(canonicalStringify({ text }), "utf8"));
  }
  assert.notEqual(
    immutableCloneWithByteLength("測試").byteLength,
    canonicalStringify("測試").length,
  );
});

test("new helper owns and deeply freezes its clone without freezing or retaining the input", () => {
  const input = { nested: { values: [1, { label: "原始" }] } };
  const result = immutableCloneWithByteLength(input);
  assert.notEqual(result.value, input);
  assert.notEqual(result.value.nested.values, input.nested.values);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.nested));
  assert.ok(Object.isFrozen(result.value.nested.values));
  assert.ok(Object.isFrozen(result.value.nested.values[1]));
  assert.equal(Object.isFrozen(input), false);
  (input.nested.values[1] as { label: string }).label = "後來修改";
  input.nested.values.push(7);
  assert.deepEqual(
    result.value,
    originalPair({ nested: { values: [1, { label: "原始" }] } }).value,
  );
  assert.throws(() => result.value.nested.values.push(9), TypeError);
});

test("ordinary immutableClone retains its no-encoding behavior", () => {
  const previous = globalThis.TextEncoder;
  class UnexpectedEncoder extends previous {
    constructor() {
      super();
      throw new Error("ordinary immutableClone must not encode UTF-8");
    }
  }
  globalThis.TextEncoder = UnexpectedEncoder;
  try {
    assert.deepEqual(immutableClone({ value: "資料" }), { value: "資料" });
  } finally {
    globalThis.TextEncoder = previous;
  }
});

test("invalid canonical inputs retain the archived rejection code and message", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "must not execute";
    },
  });
  const hidden = Object.defineProperty({}, "hidden", { value: 1 });
  const symbolKey = { [Symbol("hidden")]: 1 };
  const unsafe = Object.defineProperty(Object.create(null), "__proto__", {
    value: {},
    enumerable: true,
  });
  let tooDeep: unknown = 0;
  for (let depth = 0; depth < 49; depth += 1) tooDeep = [tooDeep];
  const fixtures = [
    undefined,
    { value: undefined },
    [undefined],
    () => 1,
    Symbol("value"),
    1n,
    NaN,
    Infinity,
    -Infinity,
    new Date(0),
    cyclic,
    accessor,
    hidden,
    symbolKey,
    unsafe,
    new Array(1),
    new Array(200001),
    tooDeep,
    "x".repeat(2 * 1024 * 1024 + 1),
  ];
  for (const fixture of fixtures) {
    const expected = errorRecord(() => originalPair(fixture));
    assert.deepEqual(
      errorRecord(() => immutableCloneWithByteLength(fixture)),
      expected,
    );
    assert.deepEqual(
      errorRecord(() => immutableClone(fixture)),
      expected,
    );
  }
  assert.equal(getterCalls, 0);
});
