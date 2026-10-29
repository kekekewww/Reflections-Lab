import assert from "node:assert/strict";
import test from "node:test";
import { AudioAssetStore } from "../../src/audio/assets.js";
import { makeBudget } from "../../src/audio/control.js";
import { AudioEngineError } from "../../src/audio/types.js";
import { preflightWave } from "../../src/audio/wav.js";
import { FakeAudioContext } from "./fake-context.js";

interface WaveOptions {
  code?: number;
  channels?: number;
  sampleRate?: number;
  bits?: number;
  frames?: number;
  extended?: boolean;
}

const metadata = {
  name: "Original bounded WAV fixture",
  origin: "imported" as const,
  license: "PROJECT_GENERATED_TEST_FIXTURE",
};
const hasCode = (code: string) => (error: unknown) =>
  error instanceof AudioEngineError && error.code === code;

function tag(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index++)
    bytes[offset + index] = value.charCodeAt(index);
}

function chunk(name: string, payload: Uint8Array): Uint8Array {
  const result = new Uint8Array(8 + payload.length + (payload.length % 2));
  tag(result, 0, name);
  new DataView(result.buffer).setUint32(4, payload.length, true);
  result.set(payload, 8);
  return result;
}

function riff(chunks: Uint8Array[]): ArrayBuffer {
  const result = new Uint8Array(12 + chunks.reduce((total, entry) => total + entry.length, 0));
  tag(result, 0, "RIFF");
  tag(result, 8, "WAVE");
  new DataView(result.buffer).setUint32(4, result.length - 8, true);
  let offset = 12;
  for (const entry of chunks) {
    result.set(entry, offset);
    offset += entry.length;
  }
  return result.buffer;
}

function parts(options: WaveOptions = {}): { format: Uint8Array; data: Uint8Array } {
  const {
    code = 1,
    channels = 1,
    sampleRate = 48000,
    bits = 16,
    frames = 32,
    extended = false,
  } = options;
  const format = new Uint8Array(extended ? 18 : 16),
    view = new DataView(format.buffer);
  const align = (channels * bits) / 8;
  view.setUint16(0, code, true);
  view.setUint16(2, channels, true);
  view.setUint32(4, sampleRate, true);
  view.setUint32(8, sampleRate * align, true);
  view.setUint16(12, align, true);
  view.setUint16(14, bits, true);
  return { format, data: new Uint8Array(frames * align) };
}

function wave(options: WaveOptions = {}): ArrayBuffer {
  const value = parts(options);
  return riff([chunk("fmt ", value.format), chunk("data", value.data)]);
}

class DeferredContext extends FakeAudioContext {
  calls = 0;
  private signal!: () => void;
  readonly entered = new Promise<void>((resolve) => {
    this.signal = resolve;
  });
  complete: ((buffer: AudioBuffer) => void) | null = null;
  decodeAudioData(): Promise<AudioBuffer> {
    this.calls++;
    return new Promise((resolve) => {
      this.complete = resolve;
      this.signal();
    });
  }
  finish(frames = 32, channels = 1): void {
    assert.ok(this.complete);
    this.complete(this.createBuffer(channels, frames, 48000) as unknown as AudioBuffer);
  }
}

test("PCM8/16/24/32 and normalized float32 expose bounded source metadata", () => {
  const budget = makeBudget();
  for (const bits of [8, 16, 24, 32]) {
    const result = preflightWave(wave({ bits }), budget);
    assert.equal(result.format, "PCM");
    assert.equal(result.bitsPerSample, bits);
    assert.equal(result.frames, 32);
    assert.equal(result.channels, 1);
    assert.equal(result.sampleRate, 48000);
    assert.equal(result.durationSeconds, 32 / 48000);
  }
  const floating = preflightWave(wave({ code: 3, bits: 32, channels: 2, frames: 16 }), budget);
  assert.equal(floating.format, "float");
  assert.equal(floating.bitsPerSample, 32);
  assert.equal(floating.channels, 2);
  assert.equal(floating.frames, 16);
});

test("fmt18 with zero extension and correctly padded metadata chunks remain accepted", () => {
  const value = parts({ extended: true, bits: 8, frames: 3 });
  const bytes = riff([
    chunk("fmt ", value.format),
    chunk("JUNK", new Uint8Array([1, 2, 3])),
    chunk("data", value.data),
  ]);
  assert.equal(preflightWave(bytes, makeBudget()).frames, 3);
});

test("RIFF size, chunk truncation, alignment and empty-data errors fail explicitly", () => {
  const badLength = wave();
  new DataView(badLength).setUint32(4, badLength.byteLength - 9, true);
  const badChunk = wave();
  new DataView(badChunk).setUint32(40, 0xffffffff, true);
  const badAlign = wave();
  new DataView(badAlign).setUint16(32, 4, true);
  const badByteRate = wave();
  new DataView(badByteRate).setUint32(28, 48000, true);
  for (const bytes of [badLength, badChunk, badAlign, badByteRate, wave({ frames: 0 })])
    assert.throws(() => preflightWave(bytes, makeBudget()), hasCode("INVALID_WAV"));
  assert.throws(
    () => preflightWave(new ArrayBuffer(4), makeBudget()),
    (error: unknown) => error instanceof AudioEngineError,
  );
});

test("duplicate fmt/data chunks and excessive metadata chunks cannot hide another payload", () => {
  const value = parts();
  const fmt = chunk("fmt ", value.format),
    data = chunk("data", value.data);
  for (const bytes of [
    riff([fmt, fmt, data]),
    riff([fmt, data, data]),
    riff([fmt, ...Array.from({ length: 129 }, () => chunk("JUNK", new Uint8Array(0))), data]),
  ])
    assert.throws(() => preflightWave(bytes, makeBudget()), hasCode("INVALID_WAV"));
});

test("compressed and unsupported sample encodings are rejected as unavailable capabilities", () => {
  for (const options of [
    { code: 6, bits: 8 },
    { code: 2, bits: 16 },
    { code: 1, bits: 64 },
    { code: 3, bits: 64 },
  ])
    assert.throws(
      () => preflightWave(wave(options), makeBudget()),
      hasCode("WAV_CAPABILITY_UNSUPPORTED"),
    );
});

test("channel, sample-rate, duration and predicted PCM bounds apply before decoding", () => {
  assert.throws(
    () => preflightWave(wave({ channels: 2 }), makeBudget({ maxAssetChannels: 1 })),
    hasCode("WAV_CHANNEL_BUDGET"),
  );
  for (const sampleRate of [7999, 192001])
    assert.throws(
      () => preflightWave(wave({ sampleRate }), makeBudget()),
      hasCode("WAV_RATE_UNSUPPORTED"),
    );
  assert.throws(
    () =>
      preflightWave(
        wave({ sampleRate: 8000, frames: 8001 }),
        makeBudget({ maxAssetDurationSeconds: 1 }),
      ),
    hasCode("WAV_DURATION_BUDGET"),
  );
  assert.throws(
    () => preflightWave(wave({ frames: 64 }), makeBudget({ maxDecodedBytes: 128 })),
    hasCode("DECODED_MEMORY_BUDGET"),
  );
});

test("native resampling output is reserved rather than trusting a smaller source sample count", () => {
  const bytes = wave({ sampleRate: 8000, frames: 80 });
  assert.doesNotThrow(() => preflightWave(bytes, makeBudget({ maxDecodedBytes: 1000 }), 8000));
  assert.throws(
    () => preflightWave(bytes, makeBudget({ maxDecodedBytes: 1000 }), 48000),
    hasCode("DECODED_MEMORY_BUDGET"),
  );
  const result = preflightWave(bytes, makeBudget(), 48000);
  assert.ok(
    result.decodedBytes >= 480 * 4,
    "ten milliseconds at native 48kHz requires at least 480 float samples",
  );
});

test("float32 WAV samples must be finite and normalized before native decode", () => {
  for (const sample of [NaN, Infinity, -Infinity, 1.001, -1.001]) {
    const bytes = wave({ code: 3, bits: 32 });
    new DataView(bytes).setFloat32(44, sample, true);
    assert.throws(() => preflightWave(bytes, makeBudget()), hasCode("WAV_SAMPLE_OUT_OF_RANGE"));
  }
});

test("malformed, compressed and oversized PCM imports never reach the native decoder", async () => {
  const context = new DeferredContext();
  const store = new AudioAssetStore(context.asContext(), makeBudget({ maxDecodedBytes: 128 }));
  for (const bytes of [new ArrayBuffer(4), wave({ code: 6, bits: 8 }), wave({ frames: 64 })])
    await assert.rejects(
      store.import("preflight-rejected", bytes, metadata),
      (error: unknown) => error instanceof AudioEngineError,
    );
  assert.equal(context.calls, 0);
  assert.equal(store.list().length, 0);
});

test(
  "in-flight PCM reservations reject another native allocation before its decode begins",
  { timeout: 3000 },
  async () => {
    const context = new DeferredContext();
    const store = new AudioAssetStore(
      context.asContext(),
      makeBudget({ maxDecodedBytes: 260, maxConcurrentDecodes: 2 }),
    );
    const first = store.import("reserved-first", wave(), metadata);
    await context.entered;
    try {
      await assert.rejects(
        store.import("reserved-overflow", wave(), metadata),
        hasCode("DECODED_MEMORY_BUDGET"),
      );
      assert.equal(context.calls, 1);
    } finally {
      context.finish();
      await first;
      store.clear();
    }
  },
);

test(
  "direct registration cannot spend PCM memory reserved by an outstanding native decode",
  { timeout: 3000 },
  async () => {
    const context = new DeferredContext();
    const store = new AudioAssetStore(context.asContext(), makeBudget({ maxDecodedBytes: 260 }));
    const first = store.import("reserved-import", wave(), metadata);
    const settled = first.then(
      () => undefined,
      () => undefined,
    );
    await context.entered;
    try {
      assert.throws(
        () =>
          store.register(
            "reservation-spender",
            context.createBuffer(1, 64, 48000) as unknown as AudioBuffer,
            metadata,
          ),
        hasCode("DECODED_MEMORY_BUDGET"),
      );
    } finally {
      context.finish();
      await settled;
      store.clear();
    }
  },
);

test(
  "native output inconsistent with preflight metadata is rejected without a partial registry entry",
  { timeout: 3000 },
  async () => {
    const context = new DeferredContext();
    const store = new AudioAssetStore(context.asContext(), makeBudget());
    const importing = store.import("mismatched-native-output", wave(), metadata);
    const assertion = assert.rejects(importing, hasCode("WAV_DECODE_MISMATCH"));
    await context.entered;
    context.finish(32, 2);
    await assertion;
    assert.equal(store.list().length, 0);
    assert.equal(store.decodedBytes, 0);
  },
);
