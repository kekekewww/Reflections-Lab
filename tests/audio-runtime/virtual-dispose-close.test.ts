import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "./fake-context.js";

function controlledContext() {
  let resolveClose!: () => void;
  let rejectClose!: (error: Error) => void;
  let notifyClosing!: () => void;
  const closing = new Promise<void>((resolve) => {
    notifyClosing = resolve;
  });
  const completion = new Promise<void>((resolve, reject) => {
    resolveClose = resolve;
    rejectClose = reject;
  });
  class Context extends FakeAudioContext {
    closes = 0;
    override close(): Promise<void> {
      this.closes++;
      notifyClosing();
      return completion.then(() => {
        this.state = "closed";
      });
    }
  }
  return { Context, closing, resolveClose, rejectClose };
}

test("disposeAsync waits for the actual owned context close and repeated disposal closes once", async () => {
  const previous = globalThis.AudioContext;
  const control = controlledContext();
  const contexts: InstanceType<typeof control.Context>[] = [];
  globalThis.AudioContext = class extends control.Context {
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const engine = new AudioEngine();
  try {
    await engine.enable(0);
    assert.equal(typeof engine.disposeAsync, "function");
    engine.dispose();
    const closing = engine.disposeAsync();
    let complete = false;
    void closing.then(() => {
      complete = true;
    });
    await control.closing;
    await Promise.resolve();
    assert.equal(complete, false);
    assert.equal(contexts[0]!.closes, 1);
    assert.equal(contexts[0]!.state, "running");
    control.resolveClose();
    await closing;
    await engine.disposeAsync();
    assert.equal(contexts[0]!.state, "closed");
    assert.equal(contexts[0]!.closes, 1);
  } finally {
    control.resolveClose();
    engine.dispose();
    globalThis.AudioContext = previous;
  }
});

test("a rejected owned close rejects disposeAsync without reporting a closed context", async () => {
  const previous = globalThis.AudioContext;
  const control = controlledContext();
  globalThis.AudioContext = control.Context as unknown as typeof AudioContext;
  const engine = new AudioEngine();
  try {
    await engine.enable(0);
    assert.equal(typeof engine.disposeAsync, "function");
    const closing = engine.disposeAsync();
    const rejected = assert.rejects(closing, /DEVICE_CLOSE_FAILED/);
    await control.closing;
    control.rejectClose(new Error("DEVICE_CLOSE_FAILED"));
    await rejected;
    assert.equal(engine.getTelemetry().contextState, "running");
    await assert.rejects(engine.disposeAsync(), /DEVICE_CLOSE_FAILED/);
  } finally {
    control.resolveClose();
    engine.dispose();
    globalThis.AudioContext = previous;
  }
});

test(
  "audition holds its shared bank lease until its owned context close completes",
  { timeout: 2000 },
  async () => {
    const previous = globalThis.AudioContext;
    const control = controlledContext();
    globalThis.AudioContext = control.Context as unknown as typeof AudioContext;
    const context = new FakeAudioContext();
    const engine = new AudioEngine({ context: context.asContext() });
    try {
      await engine.enable(0);
      engine.registerBuffer("pcm", context.createBuffer(1, 4800, 48000) as unknown as AudioBuffer, {
        name: "Original deferred-close PCM",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: "a".repeat(64),
      });
      await engine.audition({
        kind: "sample",
        asset: { assetId: "pcm", revision: 1, sha256: "a".repeat(64) },
        loop: false,
        startOffsetSeconds: 0,
      });
      const stopping = engine.stopAudition();
      await control.closing;
      await Promise.resolve();
      assert.equal(engine.getAssetResidency().leaseCount, 1, "native close is still pending");
      assert.deepEqual(engine.evictAssets(["pcm"]).protectedAssetIds, ["pcm"]);
      control.resolveClose();
      await stopping;
      assert.equal(engine.getAssetResidency().leaseCount, 0);
    } finally {
      control.resolveClose();
      engine.dispose();
      globalThis.AudioContext = previous;
    }
  },
);

test(
  "a rejected audition context close retains the outer PCM claim and remains an observable failure",
  { timeout: 2000 },
  async () => {
    const previous = globalThis.AudioContext;
    const control = controlledContext();
    globalThis.AudioContext = control.Context as unknown as typeof AudioContext;
    const context = new FakeAudioContext();
    const engine = new AudioEngine({ context: context.asContext() });
    try {
      await engine.enable(0);
      engine.registerBuffer("pcm", context.createBuffer(1, 4800, 48000) as unknown as AudioBuffer, {
        name: "Original failed-close PCM",
        origin: "generated",
        license: "PROJECT_GENERATED_TEST_FIXTURE",
        sha256: "a".repeat(64),
      });
      await engine.audition({
        kind: "sample",
        asset: { assetId: "pcm", revision: 1, sha256: "a".repeat(64) },
        loop: false,
        startOffsetSeconds: 0,
      });
      const failed = assert.rejects(engine.stopAudition(), /AUDITION_CLOSE_FAILED/);
      await control.closing;
      control.rejectClose(new Error("AUDITION_CLOSE_FAILED"));
      await failed;
      assert.equal(engine.getAssetResidency().leaseCount, 1);
      assert.deepEqual(engine.evictAssets(["pcm"]).protectedAssetIds, ["pcm"]);
      await assert.rejects(engine.disposeAsync(), /AUDITION_CLOSE_FAILED/);
      assert.equal(
        engine.getAssetResidency().leasedBytes,
        19200,
        "a failed close cannot claim that native ownership ended",
      );
    } finally {
      control.resolveClose();
      engine.dispose();
      globalThis.AudioContext = previous;
    }
  },
);

test(
  "oscillator audition stops and outer disposal join the same pending native close",
  { timeout: 2000 },
  async () => {
    const previous = globalThis.AudioContext;
    const control = controlledContext();
    globalThis.AudioContext = control.Context as unknown as typeof AudioContext;
    const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
    try {
      await engine.enable(0);
      await engine.audition({ kind: "oscillator", waveform: "sine", frequencyHz: 300 });
      const first = engine.stopAudition();
      const second = engine.stopAudition();
      const outer = engine.disposeAsync();
      const settled = [false, false, false];
      [first, second, outer].forEach((completion, i) => {
        void completion.then(() => {
          settled[i] = true;
        });
      });
      await control.closing;
      await Promise.resolve();
      assert.deepEqual(
        settled,
        [false, false, false],
        "every owner must wait even when no PCM lease exists",
      );
      control.resolveClose();
      await Promise.all([first, second, outer]);
    } finally {
      control.resolveClose();
      engine.dispose();
      globalThis.AudioContext = previous;
    }
  },
);

test(
  "a pending oscillator audition close rejection reaches both stops and outer disposeAsync",
  { timeout: 2000 },
  async () => {
    const previous = globalThis.AudioContext;
    const control = controlledContext();
    globalThis.AudioContext = control.Context as unknown as typeof AudioContext;
    const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
    try {
      await engine.enable(0);
      await engine.audition({ kind: "oscillator", waveform: "sine", frequencyHz: 300 });
      const first = assert.rejects(engine.stopAudition(), /OSCILLATOR_CLOSE_FAILED/);
      const second = assert.rejects(engine.stopAudition(), /OSCILLATOR_CLOSE_FAILED/);
      const outer = assert.rejects(engine.disposeAsync(), /OSCILLATOR_CLOSE_FAILED/);
      await control.closing;
      control.rejectClose(new Error("OSCILLATOR_CLOSE_FAILED"));
      await Promise.all([first, second, outer]);
      await assert.rejects(engine.stopAudition(), /OSCILLATOR_CLOSE_FAILED/);
    } finally {
      control.resolveClose();
      engine.dispose();
      globalThis.AudioContext = previous;
    }
  },
);
