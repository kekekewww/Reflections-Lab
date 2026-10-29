import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createBandFilterKernel } from "../../src/audio/band-filter.js";

interface ReferenceCase {
  id: string;
  frequencies: number[];
  gains: number[];
  sampleRate: number;
  tapCount: number;
  expected: null | {
    scale: number;
    groupDelaySeconds: number;
    model: string;
    kernelBase64: string;
  };
}
const reference = JSON.parse(
  readFileSync(new URL("./band-filter-planning-reference.json", import.meta.url), "utf8"),
) as { baselineSourceSha256: string; cases: ReferenceCase[] };
const bytes = (data: Float32Array) =>
  Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("base64");

test("a warm fixed layout does not repeat logarithms, FFT trigonometry or Hann design for changing gains", () => {
  const frequencies = [87, 377, 1459, 5903];
  createBandFilterKernel(frequencies, [0.1, 1, 0.6, 0.05], 48000);
  const original = { log: Math.log, sin: Math.sin, cos: Math.cos };
  const calls = { log: 0, sin: 0, cos: 0 };
  for (const name of ["log", "sin", "cos"] as const)
    Math[name] = (value: number) => {
      calls[name]++;
      return original[name](value);
    };
  try {
    for (let i = 0; i < 16; i++)
      assert.ok(createBandFilterKernel(frequencies, [0.1 + i / 100, 1, 0.6, 0.05], 48000));
  } finally {
    Object.assign(Math, original);
  }
  assert.deepEqual(calls, { log: 0, sin: 0, cos: 0 });
});

test("warm layout reuse avoids repeated large typed work buffers while retaining a distinct output per call", () => {
  const frequencies = [91, 401, 1583, 6101];
  createBandFilterKernel(frequencies, [0.2, 0.8, 1, 0.1], 48000);
  const original = globalThis.Float64Array;
  let allocatedBytes = 0;
  globalThis.Float64Array = new Proxy(original, {
    construct(target, args, newTarget) {
      if (typeof args[0] === "number") allocatedBytes += args[0] * 8;
      return Reflect.construct(target, args, newTarget);
    },
  });
  const outputs: Float32Array[] = [];
  try {
    for (let i = 0; i < 16; i++) {
      const result = createBandFilterKernel(frequencies, [0.2, 0.8 - i / 100, 1, 0.1], 48000);
      assert.ok(result);
      outputs.push(result.kernel);
    }
  } finally {
    globalThis.Float64Array = original;
  }
  assert.equal(allocatedBytes, 0, `Repeated Float64 workspace payload=${allocatedBytes}B`);
  assert.equal(new Set(outputs.map((output) => output.buffer)).size, outputs.length);
});

test("every frozen preoptimization kernel remains byte-identical across layouts, zeros and finite extremes", () => {
  assert.equal(
    reference.baselineSourceSha256,
    "dedfed098eb37e4e4d82dcc76450c3c33fdd3edc8b0b1baaa2db56fa413f4e12",
  );
  assert.equal(reference.cases.length, 30);
  for (const fixture of reference.cases) {
    const actual = createBandFilterKernel(
      fixture.frequencies,
      fixture.gains,
      fixture.sampleRate,
      fixture.tapCount,
    );
    if (fixture.expected === null) {
      assert.equal(actual, null, fixture.id);
      continue;
    }
    assert.ok(actual, fixture.id);
    assert.equal(bytes(actual.kernel), fixture.expected.kernelBase64, fixture.id);
    assert.equal(actual.scale, fixture.expected.scale, fixture.id);
    assert.equal(actual.groupDelaySeconds, fixture.expected.groupDelaySeconds, fixture.id);
    assert.equal(actual.model, fixture.expected.model, fixture.id);
  }
});

/** A scalar inverse DFT, with independently ordered log interpolation; no FFT/plan is shared. */
function directDftReference(
  frequencies: readonly number[],
  gains: readonly number[],
  rate: number,
  taps: number,
) {
  const size = 2048;
  const scale = Math.max(...gains);
  const response = Array.from({ length: size / 2 + 1 }, (_, k) => {
    const frequency = (k * rate) / size;
    if (frequency <= frequencies[0]!) return gains[0]! / scale;
    if (frequency >= frequencies.at(-1)!) return gains.at(-1)! / scale;
    const upper = frequencies.findIndex((value) => value >= frequency);
    const fraction =
      (Math.log(frequency) - Math.log(frequencies[upper - 1]!)) /
      (Math.log(frequencies[upper]!) - Math.log(frequencies[upper - 1]!));
    return ((1 - fraction) * gains[upper - 1]! + fraction * gains[upper]!) / scale;
  });
  const result = new Float64Array(taps);
  for (let n = 1; n < taps - 1; n++) {
    const offset = n - (taps - 1) / 2;
    let value = response[0]! + response[size / 2]! * Math.cos(Math.PI * offset);
    for (let k = 1; k < size / 2; k++)
      value += 2 * response[k]! * Math.cos((2 * Math.PI * k * offset) / size);
    result[n] = (value / size) * (0.5 * (1 - Math.cos((2 * Math.PI * n) / (taps - 1))));
  }
  return result;
}

test("planned operators agree with an independent direct inverse-DFT reference without changing original tolerances", () => {
  const frequencies = [60, 250, 1500, 6000, 12000];
  const gains = [0, 0.2, 1, 0.3, 0.7];
  for (const taps of [33, 129, 257]) {
    const actual = createBandFilterKernel(frequencies, gains, 48000, taps);
    assert.ok(actual);
    const independent = directDftReference(frequencies, gains, 48000, taps);
    for (let i = 0; i < taps; i++)
      assert.ok(Math.abs(actual.kernel[i]! - independent[i]!) < 1e-7, `tapCount=${taps}, tap=${i}`);
  }
});

test("retained outputs and caller-owned layout arrays cannot alias cached plans or later results", () => {
  const a = reference.cases.find((entry) => entry.id === "rate-48000-taps-129")!;
  const b = reference.cases.find((entry) => entry.id === "rate-44100-taps-129")!;
  const frequencies = [...a.frequencies];
  const gains = [...a.gains];
  const first = createBandFilterKernel(frequencies, gains, a.sampleRate, a.tapCount);
  assert.ok(first && a.expected && b.expected);
  const retained = bytes(first.kernel);
  frequencies.splice(0, frequencies.length, ...b.frequencies);
  gains.splice(0, gains.length, ...b.gains);
  const second = createBandFilterKernel(frequencies, gains, b.sampleRate, b.tapCount);
  assert.ok(second);
  assert.equal(bytes(second.kernel), b.expected.kernelBase64);
  assert.equal(bytes(first.kernel), retained);
  first.kernel.fill(99);
  const again = createBandFilterKernel(a.frequencies, a.gains, a.sampleRate, a.tapCount);
  assert.ok(again);
  assert.equal(bytes(again.kernel), a.expected.kernelBase64);
});

test("reentrant output allocation cannot corrupt an outer calculation or retained nested result", () => {
  const outer = reference.cases.find((entry) => entry.id === "mixed-zero")!;
  const inner = reference.cases.find((entry) => entry.id === "finite-maximum")!;
  assert.ok(outer.expected && inner.expected);
  const original = globalThis.Float32Array;
  let entered = false;
  let nested: ReturnType<typeof createBandFilterKernel>;
  globalThis.Float32Array = new Proxy(original, {
    construct(target, args, newTarget) {
      if (!entered) {
        entered = true;
        nested = createBandFilterKernel(
          inner.frequencies,
          inner.gains,
          inner.sampleRate,
          inner.tapCount,
        );
      }
      return Reflect.construct(target, args, newTarget);
    },
  });
  let actual: ReturnType<typeof createBandFilterKernel>;
  try {
    actual = createBandFilterKernel(
      outer.frequencies,
      outer.gains,
      outer.sampleRate,
      outer.tapCount,
    );
  } finally {
    globalThis.Float32Array = original;
  }
  assert.ok(entered && actual && nested!);
  assert.equal(bytes(actual.kernel), outer.expected.kernelBase64);
  assert.equal(bytes(nested.kernel), inner.expected.kernelBase64);
});

test("a reentrant caller-input read cannot change the validated response snapshot", () => {
  const outer = reference.cases.find((entry) => entry.id === "mixed-zero")!;
  const inner = reference.cases.find((entry) => entry.id === "finite-maximum")!;
  assert.ok(outer.expected && inner.expected);
  let entered = false;
  let nested: ReturnType<typeof createBandFilterKernel> | undefined;
  const gains = new Proxy([...outer.gains], {
    get(target, property, receiver) {
      if (!entered && property === "0") {
        entered = true;
        nested = createBandFilterKernel(
          inner.frequencies,
          inner.gains,
          inner.sampleRate,
          inner.tapCount,
        );
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const actual = createBandFilterKernel(outer.frequencies, gains, outer.sampleRate, outer.tapCount);
  assert.ok(entered && actual && nested);
  assert.equal(bytes(actual.kernel), outer.expected.kernelBase64);
  assert.equal(bytes(nested.kernel), inner.expected.kernelBase64);
});

test("layout plans are bounded and evicted rather than retaining every authoring layout", () => {
  const first = [101, 503, 2003, 9001];
  createBandFilterKernel(first, [0.1, 1, 0.5, 0.2], 48000);
  for (let i = 0; i < 33; i++)
    createBandFilterKernel([110 + i, 610 + i, 2610 + i, 10610 + i], [0.1, 1, 0.5, 0.2], 48000);
  const log = Math.log;
  let calls = 0;
  Math.log = (value) => {
    calls++;
    return log(value);
  };
  try {
    createBandFilterKernel(first, [0.11, 1, 0.5, 0.2], 48000);
  } finally {
    Math.log = log;
  }
  assert.ok(calls > 0, "A finite layout cache must evict the oldest of34 distinct layouts");
});

/** Observe actual transform-workspace writes without exposing production cache state. */
async function instrumentedModule(label: string) {
  const module = (await import(
    new URL(`../../src/audio/band-filter.ts?memo-${label}`, import.meta.url).href
  )) as { createBandFilterKernel: typeof createBandFilterKernel };
  const original = globalThis.Float64Array;
  const activity = { writes: 0, onWrite: undefined as (() => void) | undefined };
  globalThis.Float64Array = new Proxy(original, {
    construct(target, args, newTarget) {
      const array = Reflect.construct(target, args, newTarget) as Float64Array;
      if (args[0] !== 2048) return array;
      return new Proxy(array, {
        get(values, property) {
          return Reflect.get(values, property, values);
        },
        set(values, property, value) {
          if (typeof property === "string" && /^\d+$/.test(property)) {
            activity.writes++;
            activity.onWrite?.();
          }
          return Reflect.set(values, property, value, values);
        },
      });
    },
  });
  try {
    module.createBandFilterKernel([81, 431, 1789, 7001], [0.2, 1, 0.4, 0.1], 48000);
  } finally {
    globalThis.Float64Array = original;
  }
  activity.writes = 0;
  return { create: module.createBandFilterKernel, activity };
}

test("an exact normalized-response hit skips transform work but returns fresh ownership and current scale", async () => {
  const { create, activity } = await instrumentedModule("reuse");
  const frequencies = [83, 433, 1793, 7003];
  const first = create(frequencies, [0.25, 1, 0.5, 0.125], 48000)!;
  const expected = bytes(first.kernel);
  activity.writes = 0;
  const second = create(frequencies, [0.5, 2, 1, 0.25], 48000)!;
  assert.equal(activity.writes, 0, "An exact normalized hit must not redo a 2048-point transform");
  assert.equal(second.scale, 2);
  assert.equal(bytes(second.kernel), expected);
  assert.notEqual(first.kernel.buffer, second.kernel.buffer);
  first.kernel.fill(99);
  second.kernel.fill(-99);
  assert.equal(bytes(create(frequencies, [0.25, 1, 0.5, 0.125], 48000)!.kernel), expected);
});

test("response keys distinguish every exact normalized bit, signed zero and layout influence", async () => {
  const { create, activity } = await instrumentedModule("keys");
  const bands = [127, 1009, 7907];
  create(bands, [0, 1, 0.5], 48000);
  for (const [frequencies, gains, rate, taps] of [
    [bands, [-0, 1, 0.5], 48000, 129],
    [bands, [Number.MIN_VALUE, 1, 0.5], 48000, 129],
    [bands, [0, 1, 0.5 + Number.EPSILON], 48000, 129],
    [[127, 1009, 7907 + Number.EPSILON * 8192], [0, 1, 0.5], 48000, 129],
    [bands, [0, 1, 0.5], 48000 + Number.EPSILON * 65536, 129],
    [bands, [0, 1, 0.5], 48000, 131],
  ] as const) {
    activity.writes = 0;
    const first = create(frequencies, gains, rate, taps)!;
    assert.ok(
      activity.writes > 0,
      "Distinct exact inputs must miss even when Float32 output agrees",
    );
    activity.writes = 0;
    const again = create(frequencies, gains, rate, taps)!;
    assert.equal(activity.writes, 0);
    assert.equal(bytes(again.kernel), bytes(first.kernel));
  }
});

test("response LRU refreshes hits and deterministically evicts at 512 entries", async () => {
  const { create, activity } = await instrumentedModule("entries");
  const bands = [137, 1013, 7901];
  const invoke = (index: number) => create(bands, [0.1 + index / 10000, 1, 0.5], 48000);
  for (let index = 0; index < 512; index++) invoke(index);
  activity.writes = 0;
  invoke(0);
  assert.equal(activity.writes, 0, "Oldest response is present before capacity is exceeded");
  invoke(512);
  activity.writes = 0;
  invoke(0);
  assert.equal(activity.writes, 0, "A hit refreshes recency");
  invoke(1);
  assert.ok(activity.writes > 0, "The untouched oldest response is evicted");
});

test("the 1 MiB key-plus-kernel payload bound evicts large responses before the entry cap", async () => {
  const { create, activity } = await instrumentedModule("bytes");
  const bands = Array.from({ length: 32 }, (_, index) => 20 + index * 700);
  const invoke = (index: number) =>
    create(
      bands,
      bands.map((_, band) => (band === 0 ? 1 : 0.1 + index / 10000 + band / 1000)),
      48000,
      257,
    );
  for (let index = 0; index < 400; index++) invoke(index);
  activity.writes = 0;
  invoke(399);
  assert.equal(activity.writes, 0, "Most recent large response remains cached");
  invoke(0);
  assert.ok(activity.writes > 0, "400 maximal keys and kernels exceed the payload bound");
});

test("actual scratch-use reentrancy preserves both in-progress and nested kernels", async () => {
  const { create, activity } = await instrumentedModule("scratch-reentrant");
  const outer = reference.cases.find((entry) => entry.id === "mixed-zero")!;
  const inner = reference.cases.find((entry) => entry.id === "finite-maximum")!;
  assert.ok(outer.expected && inner.expected);
  let nested: ReturnType<typeof create>;
  activity.onWrite = () => {
    activity.onWrite = undefined;
    nested = create(inner.frequencies, inner.gains, inner.sampleRate, inner.tapCount);
  };
  const actual = create(outer.frequencies, outer.gains, outer.sampleRate, outer.tapCount)!;
  assert.ok(nested!);
  assert.equal(bytes(actual.kernel), outer.expected.kernelBase64);
  assert.equal(bytes(nested.kernel), inner.expected.kernelBase64);
});

test("hit and same-key miss reentrancy cannot expose cached arrays or corrupt later ownership", async () => {
  const { create, activity } = await instrumentedModule("copy-reentrant");
  const bands = [149, 1031, 7879];
  const gains = [0.25, 1, 0.5];
  const original = globalThis.Float32Array;
  let constructions = 0;
  let entered = false;
  let nested: ReturnType<typeof create>;
  globalThis.Float32Array = new Proxy(original, {
    construct(target, args, newTarget) {
      assert.equal(
        typeof args[0],
        "number",
        "Private arrays must never reach caller-controlled constructors",
      );
      constructions++;
      if (!entered && constructions === 2) {
        entered = true;
        nested = create(bands, gains, 48000);
      }
      return Reflect.construct(target, args, newTarget);
    },
  });
  let first: ReturnType<typeof create>;
  try {
    first = create(bands, gains, 48000);
  } finally {
    globalThis.Float32Array = original;
  }
  assert.ok(entered && first! && nested!);
  const expected = bytes(first.kernel);
  assert.equal(bytes(nested.kernel), expected);
  first.kernel.fill(9);
  nested.kernel.fill(-9);
  entered = false;
  globalThis.Float32Array = new Proxy(original, {
    construct(target, args, newTarget) {
      assert.equal(typeof args[0], "number");
      if (!entered) {
        entered = true;
        nested = create(bands, gains, 48000);
      }
      return Reflect.construct(target, args, newTarget);
    },
  });
  activity.writes = 0;
  try {
    const hit = create(bands, gains, 48000)!;
    assert.equal(bytes(hit.kernel), expected);
    assert.equal(bytes(nested!.kernel), expected);
    assert.notEqual(hit.kernel.buffer, nested!.kernel.buffer);
  } finally {
    globalThis.Float32Array = original;
  }
  assert.ok(entered);
  assert.equal(activity.writes, 0);
});

test("failed private-copy allocation never inserts an incomplete response", async () => {
  const { create, activity } = await instrumentedModule("copy-error");
  const bands = [151, 1033, 7877];
  const gains = [0.25, 1, 0.5];
  const original = globalThis.Float32Array;
  let constructions = 0;
  globalThis.Float32Array = new Proxy(original, {
    construct(target, args, newTarget) {
      if (++constructions === 2) throw new Error("bounded test allocation failure");
      return Reflect.construct(target, args, newTarget);
    },
  });
  try {
    assert.throws(() => create(bands, gains, 48000), /bounded test allocation failure/);
  } finally {
    globalThis.Float32Array = original;
  }
  activity.writes = 0;
  const recovered = create(bands, gains, 48000)!;
  assert.ok(activity.writes > 0, "Failed insertion must be recomputed");
  activity.writes = 0;
  assert.equal(bytes(create(bands, gains, 48000)!.kernel), bytes(recovered.kernel));
  assert.equal(activity.writes, 0);
});

test("invalid values are still rejected after a valid layout was cached", () => {
  const frequencies = [125, 1000, 8000];
  createBandFilterKernel(frequencies, [0.2, 1, 0.5], 48000);
  for (const gains of [
    [0.2, -1, 0.5],
    [0.2, NaN, 0.5],
    [0.2, Infinity, 0.5],
  ])
    assert.throws(() => createBandFilterKernel(frequencies, gains, 48000), RangeError);
  for (const [bands, rate, taps] of [
    [[125, 125, 8000], 48000, 129],
    [[19, 1000, 8000], 48000, 129],
    [[125, 1000, 24001], 48000, 129],
    [frequencies, 384001, 129],
    [frequencies, 48000, 258],
    [frequencies, 48000, 129.5],
  ] as const)
    assert.throws(() => createBandFilterKernel(bands, [0.2, 1, 0.5], rate, taps), RangeError);
});
