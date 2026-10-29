import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/index.js";
import { AudioAssetStore } from "../../src/audio/assets.js";
import { makeBudget } from "../../src/audio/control.js";
import {
  AudioEngineError,
  type AcousticFrame,
  type AudioAssetMetadata,
  type AudioBudget,
  type VoiceInput,
} from "../../src/audio/types.js";
import { FakeAudioBuffer, FakeAudioContext } from "./fake-context.js";

// Whole-bank authoring transactions and lifecycle checks, without native audio.
const metadata: AudioAssetMetadata = {
  name: "Original asset-bank fixture",
  origin: "generated",
  license: "PROJECT_GENERATED_TEST_FIXTURE",
  sha256: "a".repeat(64),
};
type Entry = { assetId: string; buffer: AudioBuffer; metadata: AudioAssetMetadata };
const audioError = (error: unknown) => error instanceof AudioEngineError;

function entry(assetId: string, overrides: Partial<Entry> = {}): Entry {
  return {
    assetId,
    buffer: new FakeAudioBuffer(1, 32, 48000) as unknown as AudioBuffer,
    metadata: { ...metadata },
    ...overrides,
  };
}

function frame(): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "bank-frame",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "bank-control-fixture",
    backendVersion: "1",
    sourceId: "bank-source",
    listenerId: "bank-listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.5,
    paths: [
      {
        id: "bank-direct",
        sourceId: "bank-source",
        listenerId: "bank-listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 171.5,
        absoluteDelayS: 0.5,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [0.5],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["ASSET_BANK_CONTROL_FIXTURE_ONLY"],
  };
}

function sampleVoice(emissionTimeSeconds = 0): VoiceInput {
  return {
    instanceId: "bank-instance",
    sourceId: "bank-source",
    generator: {
      kind: "sample",
      asset: { assetId: "bank-original", revision: 1, sha256: metadata.sha256! },
      loop: true,
      startOffsetSeconds: 0,
    },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
  };
}

function assertBankUnchanged(
  engine: AudioEngine,
  before: Entry[],
  descriptors: ReturnType<AudioEngine["getAssets"]>,
): void {
  assert.deepEqual(engine.getAssets(), descriptors);
  for (const value of before) assert.equal(engine.getAssetBuffer(value.assetId), value.buffer);
  assert.equal(engine.getTelemetry().assetCount, before.length);
}

test("bank replacement and getters work before a hardware context is created", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  let creations = 0;
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: function () {
      creations++;
      throw new Error("asset-bank operations must not create hardware");
    },
  });
  const engine = new AudioEngine({ budget: { maxAssets: 2, maxDecodedBytes: 256 } });
  try {
    const bank = [entry("bank-first"), entry("bank-second")];
    assert.equal(engine.getAssetSampleRate(), null);
    assert.equal(engine.getAssetBuffer("missing"), null);
    const budget = engine.getAssetBudget();
    assert.equal(budget.maxAssets, 2);
    Reflect.set(budget as AudioBudget, "maxAssets", 99);
    assert.equal(
      engine.getAssetBudget().maxAssets,
      2,
      "a public budget value cannot mutate engine admission",
    );
    const descriptors = engine.replaceAssets(bank);
    assert.equal(descriptors.length, 2);
    assert.equal(engine.getAssetBuffer("bank-first"), bank[0]!.buffer);
    assert.equal(engine.getAssetBuffer("bank-second"), bank[1]!.buffer);
    assert.equal(engine.getAssetSampleRate(), null);
    assert.equal(engine.getTelemetry().contextState, "not-created");
    assert.equal(engine.getTelemetry().decodedBytes, 256);
    assert.equal(creations, 0);
  } finally {
    engine.dispose();
    if (previous) Object.defineProperty(globalThis, "AudioContext", previous);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("the first lazy enable preserves a preloaded bank and its buffer identity", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const context = new FakeAudioContext();
  let creations = 0;
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: function () {
      creations++;
      return context;
    },
  });
  const engine = new AudioEngine();
  try {
    const original = entry("bank-original");
    engine.replaceAssets([original]);
    const before = engine.getAssets();
    assert.equal(creations, 0);
    await engine.enable(0);
    assert.equal(creations, 1);
    assert.equal(engine.getAssetSampleRate(), 48000);
    assert.deepEqual(engine.getAssets(), before);
    assert.equal(engine.getAssetBuffer(original.assetId), original.buffer);
    assert.equal(engine.playVoice(sampleVoice(), frame()).accepted, true);
    assert.equal(context.sources()[0]?.buffer, original.buffer);
  } finally {
    engine.dispose();
    if (previous) Object.defineProperty(globalThis, "AudioContext", previous);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("whole-bank validation rejects invalid later entries without committing a valid prefix", () => {
  const engine = new AudioEngine({ budget: { maxAssets: 4 } });
  const original = [entry("bank-original"), entry("bank-other")];
  engine.replaceAssets(original);
  const before = engine.getAssets();
  try {
    const invalid: Entry[] = [
      entry("Invalid-ID"),
      entry("invalid-name", { metadata: { ...metadata, name: " " } }),
      entry("invalid-license", { metadata: { ...metadata, license: "" } }),
      entry("invalid-hash", { metadata: { ...metadata, sha256: "z".repeat(64) } }),
      entry("invalid-revision", { metadata: { ...metadata, revision: 1.5 } }),
      entry("invalid-origin", { metadata: { ...metadata, origin: "unknown" as "generated" } }),
    ];
    for (const bad of invalid) {
      assert.throws(() => engine.replaceAssets([entry("valid-prefix"), bad]), audioError);
      assertBankUnchanged(engine, original, before);
      assert.equal(engine.getAssetBuffer("valid-prefix"), null);
    }
  } finally {
    engine.dispose();
  }
});

test("duplicate, aggregate-memory and count violations preserve the previous complete bank", () => {
  for (const kind of ["duplicate", "memory", "count"] as const) {
    const engine = new AudioEngine({
      budget: {
        maxAssets: kind === "count" ? 2 : 4,
        maxDecodedBytes: kind === "memory" ? 256 : 1024,
      },
    });
    const original = [entry("bank-original")];
    engine.replaceAssets(original);
    const before = engine.getAssets();
    try {
      const replacement =
        kind === "duplicate"
          ? [entry("duplicate-id"), entry("duplicate-id")]
          : [entry("new-first"), entry("new-second"), entry("new-third")];
      assert.throws(() => engine.replaceAssets(replacement), audioError);
      assertBankUnchanged(engine, original, before);
      assert.equal(engine.getAssetBuffer("new-first"), null);
    } finally {
      engine.dispose();
    }
  }
});

test("the store replace operation is atomic and removes old entries only after complete validation", () => {
  const context = new FakeAudioContext();
  const store = new AudioAssetStore(
    context.asContext(),
    makeBudget({ maxAssets: 3, maxDecodedBytes: 384 }),
  );
  const original = entry("store-original");
  store.register(original.assetId, original.buffer, original.metadata);
  const before = store.list();
  assert.throws(() => store.replace([entry("store-valid-prefix"), entry("INVALID")]), audioError);
  assert.deepEqual(store.list(), before);
  assert.equal(store.get(original.assetId)?.buffer, original.buffer);
  assert.equal(store.get("store-valid-prefix"), undefined);
  const replacement = [entry("store-new-first"), entry("store-new-second")];
  assert.equal(store.replace(replacement).length, 2);
  assert.equal(store.get(original.assetId), undefined);
  assert.equal(store.get("store-new-first")?.buffer, replacement[0]!.buffer);
  assert.equal(store.decodedBytes, 256);
  store.clear();
});

test("the store cannot replace a bank whose current asset is still pinned", () => {
  const context = new FakeAudioContext();
  let pinned = true;
  const store = new AudioAssetStore(context.asContext(), makeBudget(), () => pinned);
  const original = entry("store-pinned");
  store.register(original.assetId, original.buffer, original.metadata);
  assert.throws(() => store.replace([entry("store-replacement")]), audioError);
  assert.equal(store.get(original.assetId)?.buffer, original.buffer);
  pinned = false;
  assert.equal(store.replace([entry("store-replacement")]).length, 1);
  store.clear();
});

for (const phase of ["active", "retiring", "pending", "frozen"] as const) {
  test(`a ${phase} voice blocks whole-bank replacement until its epoch is drained`, async () => {
    const context = new FakeAudioContext();
    const engine = new AudioEngine({ context: context.asContext() });
    const original = entry("bank-original");
    engine.replaceAssets([original]);
    await engine.enable(0);
    try {
      assert.equal(
        engine.playVoice(sampleVoice(phase === "pending" ? 1 : 0), frame()).accepted,
        true,
      );
      if (phase === "retiring") engine.stopVoice("bank-instance");
      if (phase === "pending" || phase === "frozen") {
        context.currentTime = 0.25;
        await engine.pause(0.25);
      }
      const before = engine.getAssets();
      assert.throws(() => engine.replaceAssets([entry("bank-replacement")]), audioError);
      assertBankUnchanged(engine, [original], before);
      await engine.drainVoices();
      const replacement = entry("bank-replacement");
      assert.equal(engine.replaceAssets([replacement]).length, 1);
      assert.equal(engine.getAssetBuffer("bank-original"), null);
      assert.equal(engine.getAssetBuffer("bank-replacement"), replacement.buffer);
    } finally {
      engine.dispose();
    }
  });
}

test("an active generator that uses no bank asset still blocks the global bank transaction", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  const original = entry("bank-original");
  engine.replaceAssets([original]);
  await engine.enable(0);
  try {
    engine.playVoice(
      { ...sampleVoice(), generator: { kind: "oscillator", waveform: "sine", frequencyHz: 440 } },
      frame(),
    );
    assert.throws(() => engine.replaceAssets([entry("bank-replacement")]), audioError);
    assert.equal(engine.getAssetBuffer(original.assetId), original.buffer);
    assert.equal(engine.getTelemetry().activeVoices, 1);
  } finally {
    engine.dispose();
  }
});

class DeferredDecodeContext extends FakeAudioContext {
  private signal!: () => void;
  readonly entered = new Promise<void>((resolve) => {
    this.signal = resolve;
  });
  finish: ((buffer: AudioBuffer) => void) | null = null;
  decodeAudioData(): Promise<AudioBuffer> {
    return new Promise((resolve) => {
      this.finish = resolve;
      this.signal();
    });
  }
}

function pcmWave(): ArrayBuffer {
  const bytes = new ArrayBuffer(108),
    view = new DataView(bytes);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 100, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 48000, true);
  view.setUint32(28, 96000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, 64, true);
  return bytes;
}

test(
  "an actual in-flight decode blocks replacement without cancelling or partially changing either bank",
  { timeout: 3000 },
  async () => {
    const context = new DeferredDecodeContext();
    const engine = new AudioEngine({ context: context.asContext() });
    const original = entry("bank-original");
    engine.replaceAssets([original]);
    await engine.enable(0);
    const importing = engine.importAsset("bank-importing", pcmWave(), metadata);
    const settled = importing.then(
      () => undefined,
      () => undefined,
    );
    await context.entered;
    try {
      const before = engine.getAssets();
      assert.throws(() => engine.replaceAssets([entry("bank-replacement")]), audioError);
      assertBankUnchanged(engine, [original], before);
      assert.ok(context.finish);
      context.finish(entry("decoded").buffer);
      assert.equal((await importing).assetId, "bank-importing");
      assert.equal(engine.getTelemetry().assetCount, 2);
      assert.equal(engine.replaceAssets([entry("bank-replacement")]).length, 1);
      assert.equal(engine.getAssetBuffer("bank-original"), null);
      assert.equal(engine.getAssetBuffer("bank-importing"), null);
    } finally {
      context.finish?.(entry("decode-cleanup").buffer);
      await settled;
      engine.dispose();
    }
  },
);

test(
  "an immediate built-in generation request blocks replacement until its hashes and registration settle",
  { timeout: 3000 },
  async () => {
    const context = new FakeAudioContext();
    const engine = new AudioEngine({ context: context.asContext() });
    const original = entry("bank-original");
    engine.replaceAssets([original]);
    await engine.enable(0);
    const generating = engine.registerBuiltins();
    const settled = generating.then(
      () => undefined,
      () => undefined,
    );
    try {
      const before = engine.getAssets();
      assert.throws(
        () => engine.replaceAssets([entry("bank-replacement")]),
        audioError,
        "the bank transaction cannot race a built-in SHA-256 await",
      );
      assertBankUnchanged(engine, [original], before);
      const generated = await generating;
      assert.equal(generated.length, 3);
      assert.equal(engine.getAssetBuffer(original.assetId), original.buffer);
      assert.equal(engine.replaceAssets([entry("bank-replacement")]).length, 1);
      assert.equal(engine.getAssetBuffer("builtin-tone"), null);
    } finally {
      await settled;
      engine.dispose();
    }
  },
);

test(
  "clearing during built-in hashing cancels that generation and cannot refill the cleared bank",
  { timeout: 3000 },
  async () => {
    const context = new FakeAudioContext();
    const store = new AudioAssetStore(context.asContext(), makeBudget());
    const original = entry("store-original");
    store.register(original.assetId, original.buffer, original.metadata);
    const generating = store.registerBuiltins();
    const cancelled = assert.rejects(generating, audioError);
    store.clear();
    await cancelled;
    assert.deepEqual(store.list(), []);
    assert.equal(store.decodedBytes, 0);
    assert.equal(store.get("builtin-tone"), undefined);
    assert.equal(store.get("builtin-impact"), undefined);
    assert.equal(store.get("builtin-whoosh"), undefined);
    assert.equal(
      store.replace([entry("fresh-after-generation-cancel")]).length,
      1,
      "cancellation also releases the generation busy state",
    );
    store.clear();
  },
);
