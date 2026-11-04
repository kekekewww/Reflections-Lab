import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "./fake-context.js";

async function setup() {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  engine.registerBuffer("pcm", context.createBuffer(1, 4800, 48000) as unknown as AudioBuffer, {
    name: "Original audition lease PCM",
    origin: "generated",
    license: "PROJECT_GENERATED_TEST_FIXTURE",
    sha256: "a".repeat(64),
  });
  const generator = {
    kind: "sample" as const,
    asset: { assetId: "pcm", revision: 1, sha256: "a".repeat(64) },
    loop: false,
    startOffsetSeconds: 0,
  };
  return {
    engine,
    contexts,
    generator,
    restore: () => {
      engine.dispose();
      globalThis.AudioContext = previous;
    },
  };
}

test("independent audition pins shared PCM in the outer residency tracker until its bank is disposed", async () => {
  const { engine, contexts, generator, restore } = await setup();
  try {
    assert.equal((await engine.audition(generator)).accepted, true);
    assert.equal(engine.getAssetResidency().leasedBytes, 19200);
    assert.equal(engine.getAssetResidency().leaseCount, 1);
    assert.deepEqual(engine.evictAssets(["pcm"]).protectedAssetIds, ["pcm"]);
    contexts[0]!.sources()[0]!.finish();
    assert.equal(
      engine.getAssetResidency().leaseCount,
      1,
      "audition bank still retains PCM after native end",
    );
    await engine.stopAudition();
    assert.equal(engine.getAssetResidency().leaseCount, 0);
    assert.deepEqual(engine.evictAssets(["pcm"]).evictedAssetIds, ["pcm"]);
  } finally {
    restore();
  }
});

test("repeated auditions share one bank lease and outer disposal releases it after native disconnection", async () => {
  const { engine, contexts, generator, restore } = await setup();
  try {
    assert.equal((await engine.audition(generator)).accepted, true);
    assert.equal((await engine.audition(generator)).accepted, true);
    assert.equal(
      engine.getAssetResidency().leaseCount,
      1,
      "same bank buffer does not accumulate leases per voice",
    );
    await engine.disposeAsync();
    assert.equal(engine.getAssetResidency().leaseCount, 0);
    for (const source of contexts[0]!.sources()) assert.equal(source.connections.length, 0);
  } finally {
    restore();
  }
});
