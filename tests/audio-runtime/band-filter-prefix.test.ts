import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { createBandFilterKernel } from "../../src/audio/band-filter.js";

type Create = typeof createBandFilterKernel;
interface FixtureCase {
  id: string;
  frequencies: number[];
  gains: number[];
  sampleRate: number;
  tapCount: number;
  negativeZeroGainIndices: number[];
  expectedKey: string | null;
  expectedKernelBase64: string | null;
}
const reference = JSON.parse(
  readFileSync(new URL("./band-filter-prefix-reference.json", import.meta.url), "utf8"),
) as { sourceSha256: string; cases: FixtureCase[] };
const version = "frequencySampling2048-logLinear-hann-v1:";
const bands = [125, 250, 500, 1000, 2000, 4000, 8000];
const gains = [0.1, 0.2, 0.4, 1, 0.5, 0.25, 0.125];

async function fresh(label: string): Promise<Create> {
  const module = (await import(
    new URL(`../../src/audio/band-filter.ts?prefix-${label}`, import.meta.url).href
  )) as { createBandFilterKernel: Create };
  return module.createBandFilterKernel;
}

/** Observe existing exact encodings and complete response keys, without production exports. */
function observe<T>(action: () => T) {
  const originalEncode = DataView.prototype.setFloat64;
  const originalSet = Map.prototype.set;
  let encoded = 0;
  const keys: string[] = [];
  DataView.prototype.setFloat64 = function (offset, value, littleEndian) {
    encoded++;
    return originalEncode.call(this, offset, value, littleEndian);
  };
  Map.prototype.set = function <K, V>(this: Map<K, V>, key: K, value: V): Map<K, V> {
    if (typeof key === "string" && key.startsWith(version)) keys.push(key);
    return originalSet.call(this, key, value) as Map<K, V>;
  };
  let result: T | undefined;
  let error: unknown;
  try {
    result = action();
  } catch (caught) {
    error = caught;
  } finally {
    DataView.prototype.setFloat64 = originalEncode;
    Map.prototype.set = originalSet;
  }
  return { result, error, encoded, keys };
}

test("a warm seven-band layout encodes only seven normalized values instead of seventeen", async () => {
  const create = await fresh("operations");
  const cold = observe(() => create(bands, gains, 48000));
  assert.equal(cold.error, undefined);
  assert.equal(cold.encoded, 17);
  for (const scale of [2, 3, 4]) {
    const warm = observe(() =>
      create(
        bands,
        gains.map((value) => value * scale),
        48000,
      ),
    );
    assert.equal(warm.error, undefined);
    assert.equal(warm.encoded, 7, "Validated fixed layout bits must not be reencoded");
    assert.ok(warm.result);
  }
});

test("complete response-key bytes and kernels match the immutable ce7012 preimage fixtures", async () => {
  assert.equal(
    reference.sourceSha256,
    "ce7012f442aa292e672ab24e442b0a84964a7afddcf6ebad92cbe4552bd1bb2a",
  );
  assert.equal(reference.cases.length, 34);
  const create = await fresh("preimage");
  for (const fixture of reference.cases) {
    const restoredGains = [...fixture.gains];
    for (const index of fixture.negativeZeroGainIndices) restoredGains[index] = -0;
    for (let repeat = 0; repeat < 2; repeat++) {
      const actual = observe(() =>
        create(fixture.frequencies, restoredGains, fixture.sampleRate, fixture.tapCount),
      );
      assert.equal(actual.error, undefined, fixture.id);
      assert.deepEqual(
        actual.keys,
        fixture.expectedKey === null ? [] : [fixture.expectedKey],
        fixture.id,
      );
      assert.equal(
        actual.result ? Buffer.from(actual.result.kernel.buffer).toString("base64") : null,
        fixture.expectedKernelBase64,
        fixture.id,
      );
    }
  }
});

test("the eight-entry layout-prefix LRU refreshes hits and evicts the untouched ninth layout", async () => {
  const create = await fresh("lru");
  const call = (index: number) =>
    observe(() =>
      create(
        bands.map((value) => value + index),
        gains,
        48000,
      ),
    );
  for (let index = 0; index < 8; index++) assert.equal(call(index).encoded, 17);
  assert.equal(call(0).encoded, 7);
  assert.equal(call(8).encoded, 17);
  assert.equal(call(0).encoded, 7, "A hit must refresh recency");
  assert.equal(call(1).encoded, 17, "The untouched oldest prefix must be evicted");
});

test("prefix reuse keeps caller inputs private, supports typed arrays and ignores extra fields", async () => {
  const create = await fresh("inputs");
  const frequencies = new Float64Array(bands);
  const pressure = new Float64Array(gains);
  const caller = frequencies as unknown as readonly number[];
  const original = create(caller, pressure as unknown as readonly number[], 48000)!;
  const expected = Buffer.from(original.kernel.buffer).toString("base64");
  let reads = 0;
  const proxied = new Proxy([...bands], {
    get(target, property, receiver) {
      if (property === "unrelated") throw new Error("Unrelated caller fields must remain unread");
      if (typeof property === "string" && /^\d+$/.test(property)) reads++;
      return Reflect.get(target, property, receiver);
    },
  });
  const warm = observe(() => create(proxied, gains, 48000));
  assert.equal(warm.error, undefined);
  assert.equal(warm.encoded, 7);
  assert.equal(reads, 7, "Only the existing bounded input snapshot reads caller frequencies");
  frequencies[0] = 126;
  const changed = observe(() => create(caller, pressure as unknown as readonly number[], 48000));
  assert.equal(changed.encoded, 17, "Retained layout must not alias the mutable caller array");
  const restored = create(bands, gains, 48000)!;
  assert.equal(Buffer.from(restored.kernel.buffer).toString("base64"), expected);
  assert.notEqual(original.kernel.buffer, restored.kernel.buffer);
  original.kernel.fill(99);
  assert.equal(
    Buffer.from(create(bands, gains, 48000)!.kernel.buffer).toString("base64"),
    expected,
  );
});

test("invalid values fail before a cached-prefix lookup or encoding", async () => {
  const create = await fresh("invalid");
  create(bands, gains, 48000);
  for (const [frequencies, pressure, rate, taps] of [
    [bands, [NaN, ...gains.slice(1)], 48000, 129],
    [bands, [-1, ...gains.slice(1)], 48000, 129],
    [[19, ...bands.slice(1)], gains, 48000, 129],
    [[125, 125, ...bands.slice(2)], gains, 48000, 129],
    [bands, gains, 384001, 129],
    [bands, gains, 48000, 258],
  ] as const) {
    const actual = observe(() => create(frequencies, pressure, rate, taps));
    assert.ok(actual.error instanceof RangeError);
    assert.equal(actual.encoded, 0);
    assert.deepEqual(actual.keys, []);
  }
});

test("getter and constructor reentry can evict layouts without changing an outer key or kernel", async () => {
  const create = await fresh("reentrant");
  const fixture = reference.cases.find((entry) => entry.id === "rate-48000-taps-129")!;
  const churn = () => {
    for (let index = 0; index < 9; index++)
      create(
        bands.map((frequency) => frequency + 30 + index),
        gains,
        48000,
      );
  };
  let getterEntered = false;
  const frequencies = new Proxy([...fixture.frequencies], {
    get(target, property, receiver) {
      if (!getterEntered && property === "0") {
        getterEntered = true;
        churn();
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const original = globalThis.Float32Array;
  let constructorEntered = false;
  globalThis.Float32Array = new Proxy(original, {
    construct(target, args, newTarget) {
      if (!constructorEntered && getterEntered) {
        constructorEntered = true;
        churn();
      }
      return Reflect.construct(target, args, newTarget);
    },
  });
  let actual: ReturnType<Create>;
  try {
    actual = create(frequencies, fixture.gains, fixture.sampleRate, fixture.tapCount);
  } finally {
    globalThis.Float32Array = original;
  }
  assert.ok(getterEntered && constructorEntered && actual!);
  assert.equal(Buffer.from(actual.kernel.buffer).toString("base64"), fixture.expectedKernelBase64);
  const again = observe(() =>
    create(fixture.frequencies, fixture.gains, fixture.sampleRate, fixture.tapCount),
  );
  assert.equal(again.error, undefined);
  assert.deepEqual(again.keys, [fixture.expectedKey]);
});
