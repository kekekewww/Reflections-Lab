import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeExact,
  encodeExact,
  EXACT_CORPUS_FORMAT,
  EXACT_CORPUS_LIMITS,
} from "../../benchmarks/acoustic-transport/corpus-codec.js";

const document = (root: unknown, nodes: unknown[] = []): string =>
  JSON.stringify([EXACT_CORPUS_FORMAT, root, nodes]);

test("exact corpus values retain signed zero, undefined own properties and nonfinite invalid inputs", () => {
  const input = {
    negativeZero: -0,
    zero: 0,
    absentValue: undefined,
    values: [undefined, -0, NaN, Infinity, -Infinity, null, false, true, "ordinary"],
  };
  const actual = decodeExact(encodeExact(input)) as typeof input;
  assert.deepEqual(actual, input);
  assert.ok(Object.is(actual.negativeZero, -0));
  assert.ok(!Object.is(actual.zero, -0));
  assert.ok(Object.hasOwn(actual, "absentValue"));
  assert.ok(Object.hasOwn(actual.values, "0"));
  for (const value of [undefined, -0, NaN, Infinity, -Infinity, null, true, "root"]) {
    assert.ok(Object.is(decodeExact(encodeExact(value)), value));
  }
});

test("graph references preserve aliases, object and array cycles, without retaining caller ownership", () => {
  const shared = { value: -0 };
  const list: unknown[] = [shared, shared];
  const input: { shared: typeof shared; list: unknown[]; self?: unknown } = { shared, list };
  input.self = input;
  list.push(list, input);
  const actual = decodeExact(encodeExact(input)) as typeof input;
  assert.strictEqual(actual.self, actual);
  assert.strictEqual(actual.list[0], actual.shared);
  assert.strictEqual(actual.list[1], actual.shared);
  assert.strictEqual(actual.list[2], actual.list);
  assert.strictEqual(actual.list[3], actual);
  assert.notStrictEqual(actual, input);
  assert.notStrictEqual(actual.shared, shared);
  actual.shared.value = 7;
  assert.ok(Object.is(shared.value, -0));
  assert.strictEqual(input.self, input);
});

test("typed tags never collide with reserved-looking ordinary strings, arrays or objects", () => {
  const input = {
    format: EXACT_CORPUS_FORMAT,
    ref: ["ref", 999],
    special: ["number", "-0"],
    undefined: { type: "undefined", id: 0 },
    nodes: [["object", "null", "__proto__"]],
    text: '\u0000\b\n\r\t"\\界😀\ud800x\udfff',
  };
  assert.deepEqual(decodeExact(encodeExact(input)), input);
});

test("plain and null-prototype data properties retain descriptors and safe reserved keys", () => {
  const input = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(input, "__proto__", {
    value: { polluted: "data only" },
    enumerable: true,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(input, "hidden", {
    value: undefined,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(input, "constructor", { value: "ordinary constructor data" });
  const plain: Record<string, unknown> = {};
  Object.defineProperty(plain, "__proto__", {
    value: input,
    enumerable: true,
    writable: false,
    configurable: false,
  });
  input.plain = plain;
  const actual = decodeExact(encodeExact(input)) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(actual), null);
  assert.equal(Object.getPrototypeOf(actual.plain), Object.prototype);
  assert.strictEqual((actual.plain as Record<string, unknown>).__proto__, actual);
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(actual, "hidden"),
    Object.getOwnPropertyDescriptor(input, "hidden"),
  );
  assert.deepEqual(Object.getOwnPropertyDescriptor(actual.plain, "__proto__"), {
    value: actual,
    enumerable: true,
    writable: false,
    configurable: false,
  });
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
});

test("dense frozen arrays retain element and length descriptor flags", () => {
  const input = Object.freeze([undefined, -0, { value: "retained" }]);
  const actual = decodeExact(encodeExact(input)) as typeof input;
  assert.deepEqual(actual, input);
  assert.ok(Object.isFrozen(actual));
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(actual, "0"),
    Object.getOwnPropertyDescriptor(input, "0"),
  );
  assert.notStrictEqual(actual[2], input[2]);
});

test("getters, toJSON hooks and caller array helpers are never executed", () => {
  let invoked = 0;
  const accessor = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      invoked++;
      return 1;
    },
  });
  const hooked = {
    toJSON() {
      invoked++;
      return "wrong";
    },
  };
  const array = [1, 2];
  Object.defineProperty(array, Symbol.iterator, {
    value() {
      invoked++;
      throw new Error("caller iterator executed");
    },
  });
  for (const value of [accessor, hooked, array]) {
    assert.throws(() => encodeExact(value), /EXACT_CORPUS_UNSUPPORTED/);
  }
  assert.equal(invoked, 0);
});

test("unsupported values, native/class objects, sparse arrays and unrepresented array keys reject", () => {
  class EngineObject {
    value = 1;
  }
  const sparse = [1, , 3];
  const extra = Object.assign([1], { annotation: 2 });
  const symbolKey = { [Symbol("key")]: 1 };
  for (const value of [
    () => 1,
    Symbol("value"),
    1n,
    new Date(),
    new Map(),
    new Float64Array([1]),
    new EngineObject(),
    sparse,
    extra,
    symbolKey,
  ]) {
    assert.throws(() => encodeExact(value), /EXACT_CORPUS_UNSUPPORTED/);
  }
});

test("malformed tags, ids, duplicate properties and unknown references reject", () => {
  const invalid = [
    "{}",
    "not json",
    document(["unknown"]),
    document(["undefined", 1]),
    document(["number", "Infinity"]),
    document(["number", null]),
    document(["ref", -1]),
    document(["ref", 0]),
    document(["ref", 1], [[0, "object", "plain", true, []]]),
    document(
      ["ref", 0],
      [
        [0, "object", "plain", true, []],
        [0, "array", true, true, []],
      ],
    ),
    document(["ref", 0], [[1, "object", "plain", true, []]]),
    document(["ref", 0], [[0, "object", "custom", true, []]]),
    document(
      ["ref", 0],
      [
        [
          0,
          "object",
          "plain",
          true,
          [
            ["x", 7, ["null"]],
            ["x", 7, ["null"]],
          ],
        ],
      ],
    ),
    document(["ref", 0], [[0, "object", "plain", true, [["x", 8, ["null"]]]]]),
    document(["ref", 0], [[0, "array", "true", true, []]]),
    document(["ref", 0], [[0, "array", true, true, [[7, ["ref", 2]]]]]),
    document(["null"], [[0, "object", "plain", true, []]]),
  ];
  for (const value of invalid) {
    assert.throws(() => decodeExact(value), /EXACT_CORPUS_/);
  }
});

test("prototype-injection containers reject while encoded __proto__ stays an own data property", () => {
  assert.throws(
    () => decodeExact('{"__proto__":{"polluted":true},"root":["null"]}'),
    /EXACT_CORPUS_INVALID/,
  );
  const actual = decodeExact(
    document(
      ["ref", 0],
      [
        [0, "object", "plain", true, [["__proto__", 7, ["ref", 1]]]],
        [1, "object", "plain", true, [["polluted", 7, ["boolean", true]]]],
      ],
    ),
  ) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(actual), Object.prototype);
  assert.ok(Object.hasOwn(actual, "__proto__"));
  assert.equal((actual.__proto__ as Record<string, unknown>).polluted, true);
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
});
test("UTF-8 corpus and graph-node budgets reject oversized input without changing product limits", () => {
  assert.equal(EXACT_CORPUS_LIMITS.maxUtf8Bytes, 64 * 1024 * 1024);
  assert.equal(EXACT_CORPUS_LIMITS.maxNodes, 2_000_000);
  const oversized = "x".repeat(EXACT_CORPUS_LIMITS.maxUtf8Bytes + 1);
  assert.throws(() => encodeExact(oversized), /EXACT_CORPUS_BYTES/);
  assert.throws(() => decodeExact(oversized), /EXACT_CORPUS_BYTES/);
  const multibyte = "界".repeat(Math.floor(EXACT_CORPUS_LIMITS.maxUtf8Bytes / 3) + 1);
  assert.throws(() => encodeExact(multibyte), /EXACT_CORPUS_BYTES/);
  assert.throws(() => decodeExact(multibyte), /EXACT_CORPUS_BYTES/);
  const tooMany = Array<null>(EXACT_CORPUS_LIMITS.maxNodes + 1).fill(null);
  assert.throws(() => encodeExact(tooMany), /EXACT_CORPUS_NODES/);
  assert.throws(() => decodeExact(document(["null"], tooMany)), /EXACT_CORPUS_NODES/);
});

test("encoding reads stable own descriptors and leaves the complete owner graph unchanged", () => {
  const input = { a: { value: -0 }, list: [undefined, "same"] };
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const nested = Object.getOwnPropertyDescriptors(input.a);
  const list = Object.getOwnPropertyDescriptors(input.list);
  const encoded = encodeExact(input);
  assert.deepEqual(Object.getOwnPropertyDescriptors(input), descriptors);
  assert.deepEqual(Object.getOwnPropertyDescriptors(input.a), nested);
  assert.deepEqual(Object.getOwnPropertyDescriptors(input.list), list);
  assert.deepEqual(decodeExact(encoded), input);
});
