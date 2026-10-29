import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { AudioEngine } from "../../src/audio/index.js";
import { AudioAssetStore } from "../../src/audio/assets.js";
import { makeBudget } from "../../src/audio/control.js";
import type { AcousticFrame, AudioAssetMetadata, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext } from "./fake-context.js";

// Admission/cancellation tests use original PCM16 WAV bytes and genuine
// WebCrypto with a deferred decoder. Native decoding needs separate evidence.
const metadata: AudioAssetMetadata = {
  name: "Original bounded asset fixture",
  origin: "generated",
  license: "PROJECT_GENERATED_TEST_FIXTURE",
  sha256: "a".repeat(64),
};

function hasCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof Error && "code" in error && error.code === code;
}

function smallBuffer(context: FakeAudioContext): AudioBuffer {
  return context.createBuffer(1, 24000, 48000) as unknown as AudioBuffer;
}

class DeferredDecodeContext extends FakeAudioContext {
  readonly requests: {
    bytes: ArrayBuffer;
    resolve: (buffer: AudioBuffer) => void;
    reject: (reason: Error) => void;
  }[] = [];
  private readonly waiters: { count: number; resolve: () => void }[] = [];

  decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      this.requests.push({ bytes, resolve, reject });
      for (let index = this.waiters.length - 1; index >= 0; index--) {
        const waiter = this.waiters[index]!;
        if (this.requests.length >= waiter.count) {
          this.waiters.splice(index, 1);
          waiter.resolve();
        }
      }
    });
  }

  waitForRequests(count: number): Promise<void> {
    if (this.requests.length >= count) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push({ count, resolve }));
  }
}

function encodedBytes(value: number): ArrayBuffer {
  const bytes = new ArrayBuffer(108),
    view = new DataView(bytes);
  const text = (offset: number, content: string) => {
    for (let index = 0; index < content.length; index++)
      view.setUint8(offset + index, content.charCodeAt(index));
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
  for (let index = 0; index < 32; index++) view.setInt16(44 + index * 2, value * (index + 1), true);
  return bytes;
}

function decodedImportBuffer(context: FakeAudioContext): AudioBuffer {
  return context.createBuffer(1, 32, 48000) as unknown as AudioBuffer;
}

function frame(): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "asset-pin",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "asset-pin-fixture",
    backendVersion: "1",
    sourceId: "pinned-source",
    listenerId: "pinned-listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0,
    paths: [
      {
        id: "pinned-direct",
        sourceId: "pinned-source",
        listenerId: "pinned-listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 1,
        absoluteDelayS: 0,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [0.5],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_ASSET_PIN_FIXTURE_ONLY"],
  };
}

function voice(emissionTimeSeconds: number): VoiceInput {
  return {
    instanceId: "pinned-instance",
    sourceId: "pinned-source",
    generator: {
      kind: "sample",
      asset: { assetId: "pinned-pcm", revision: 1, sha256: metadata.sha256! },
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

test("the asset count cap rejects a new asset while allowing an unused replacement at the cap", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), budget: { maxAssets: 2 } });
  await engine.enable(0);
  try {
    engine.registerBuffer("count-first", smallBuffer(context), metadata);
    engine.registerBuffer("count-second", smallBuffer(context), metadata);
    assert.throws(
      () => engine.registerBuffer("count-third", smallBuffer(context), metadata),
      hasCode("ASSET_COUNT_BUDGET"),
    );
    const replacement = engine.registerBuffer("count-first", smallBuffer(context), {
      ...metadata,
      revision: 2,
      sha256: "b".repeat(64),
    });
    assert.equal(replacement.revision, 2);
    assert.equal(engine.getTelemetry().assetCount, 2);
    assert.deepEqual(
      engine
        .getAssets()
        .map((asset) => asset.assetId)
        .sort(),
      ["count-first", "count-second"],
    );
    assert.equal(engine.getAssets().find((asset) => asset.assetId === "count-first")?.revision, 2);
  } finally {
    engine.dispose();
  }
});

for (const phase of ["pending", "frozen"] as const) {
  test(`a ${phase} sample pins its decoded asset until logical cancellation`, async () => {
    const context = new FakeAudioContext();
    const engine = new AudioEngine({ context: context.asContext() });
    await engine.enable(0);
    try {
      engine.registerBuffer("pinned-pcm", smallBuffer(context), metadata);
      assert.equal(engine.playVoice(voice(phase === "pending" ? 1 : 0), frame()).accepted, true);
      context.currentTime = 0.25;
      await engine.pause(0.25);
      assert.equal(
        engine.getTelemetry().activeVoices,
        0,
        "the pin survives removal of native active nodes",
      );
      const replacement = smallBuffer(context);
      const nextMetadata = { ...metadata, revision: 2, sha256: "b".repeat(64) };
      assert.throws(
        () => engine.registerBuffer("pinned-pcm", replacement, nextMetadata),
        hasCode("ASSET_IN_USE"),
      );
      assert.equal(engine.getAssets()[0]?.revision, 1);
      engine.stopVoice("pinned-instance");
      assert.equal(engine.registerBuffer("pinned-pcm", replacement, nextMetadata).revision, 2);
      await engine.resume(0.25);
      assert.equal(engine.getTelemetry().activeVoices, 0);
      assert.equal(engine.getTelemetry().droppedVoices, 0);
    } finally {
      engine.dispose();
    }
  });
}

test(
  "concurrent native decode admission is bounded before allocating another decoded result",
  { timeout: 3000 },
  async () => {
    const context = new DeferredDecodeContext();
    const engine = new AudioEngine({
      context: context.asContext(),
      budget: { maxConcurrentDecodes: 2 },
    });
    await engine.enable(0);
    try {
      const firstBytes = encodedBytes(1),
        secondBytes = encodedBytes(2);
      const first = engine.importAsset("decoded-first", firstBytes, metadata);
      const second = engine.importAsset("decoded-second", secondBytes, metadata);
      await context.waitForRequests(2);
      await assert.rejects(
        engine.importAsset("decoded-overflow", encodedBytes(3), metadata),
        hasCode("DECODE_CONCURRENCY_BUDGET"),
      );
      assert.equal(context.requests.length, 2, "overflow must not invoke the native decoder");
      context.requests[0]!.resolve(decodedImportBuffer(context));
      context.requests[1]!.resolve(decodedImportBuffer(context));
      const [firstAsset, secondAsset] = await Promise.all([first, second]);
      assert.equal(
        firstAsset.sha256,
        createHash("sha256").update(new Uint8Array(firstBytes)).digest("hex"),
      );
      assert.equal(
        secondAsset.sha256,
        createHash("sha256").update(new Uint8Array(secondBytes)).digest("hex"),
      );
      assert.equal(firstAsset.origin, "imported");
      assert.equal(engine.getTelemetry().assetCount, 2);
    } finally {
      engine.dispose();
    }
  },
);

test(
  "a failed native decode releases its concurrency slot without registering a partial asset",
  { timeout: 3000 },
  async () => {
    const context = new DeferredDecodeContext();
    const store = new AudioAssetStore(context.asContext(), makeBudget({ maxConcurrentDecodes: 1 }));
    const failed = store.import("decode-failure", encodedBytes(1), metadata);
    const failedAssertion = assert.rejects(failed, /fixture decoder failure/);
    await context.waitForRequests(1);
    context.requests[0]!.reject(new Error("fixture decoder failure"));
    await failedAssertion;
    assert.equal(store.list().length, 0);
    assert.equal(store.decodedBytes, 0);
    const recovered = store.import("decode-recovered", encodedBytes(2), metadata);
    await context.waitForRequests(2);
    context.requests[1]!.resolve(decodedImportBuffer(context));
    assert.equal((await recovered).assetId, "decode-recovered");
    assert.equal(store.list().length, 1);
    store.clear();
  },
);

test(
  "clearing an asset store cancels old results while keeping outstanding native work bounded",
  { timeout: 3000 },
  async () => {
    const context = new DeferredDecodeContext();
    const store = new AudioAssetStore(context.asContext(), makeBudget({ maxConcurrentDecodes: 1 }));
    const oldImport = store.import("cancelled-import", encodedBytes(1), metadata);
    const cancelledAssertion = assert.rejects(oldImport, hasCode("DECODE_CANCELLED"));
    await context.waitForRequests(1);
    store.clear();
    await assert.rejects(
      store.import("still-bounded", encodedBytes(2), metadata),
      hasCode("DECODE_CONCURRENCY_BUDGET"),
    );
    assert.equal(context.requests.length, 1, "clear cannot create extra native decode capacity");
    context.requests[0]!.resolve(decodedImportBuffer(context));
    await cancelledAssertion;
    assert.equal(store.list().length, 0);
    assert.equal(store.decodedBytes, 0);
    const freshImport = store.import("fresh-import", encodedBytes(3), metadata);
    await context.waitForRequests(2);
    context.requests[1]!.resolve(decodedImportBuffer(context));
    assert.equal((await freshImport).assetId, "fresh-import");
    assert.deepEqual(
      store.list().map((asset) => asset.assetId),
      ["fresh-import"],
    );
    store.clear();
  },
);

test(
  "disposing an engine prevents an already-running decode from restoring its asset registry",
  { timeout: 3000 },
  async () => {
    const context = new DeferredDecodeContext();
    const engine = new AudioEngine({ context: context.asContext() });
    await engine.enable(0);
    const importing = engine.importAsset("disposed-import", encodedBytes(1), metadata);
    const cancelledAssertion = assert.rejects(importing, hasCode("DECODE_CANCELLED"));
    await context.waitForRequests(1);
    engine.dispose();
    context.requests[0]!.resolve(decodedImportBuffer(context));
    await cancelledAssertion;
    assert.equal(engine.getTelemetry().assetCount, 0);
    assert.equal(engine.getTelemetry().decodedBytes, 0);
    assert.deepEqual(engine.getAssets(), []);
  },
);
