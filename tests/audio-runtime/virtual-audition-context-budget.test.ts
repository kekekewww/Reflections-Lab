import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "./fake-context.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = () => yes();
    reject = no;
  });
  return { promise, resolve, reject };
}

function installDeferredContexts() {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const contexts: DeferredCloseContext[] = [];
  class DeferredCloseContext extends FakeAudioContext {
    readonly closeStarted = deferred();
    readonly closeResult = deferred();
    closeCalls = 0;
    constructor() {
      super();
      contexts.push(this);
    }
    override async close() {
      this.closeCalls++;
      this.closeStarted.resolve();
      await this.closeResult.promise;
      // A requested or failed close is not evidence that the context is closed.
      this.state = "closed";
    }
  }
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    writable: true,
    value: DeferredCloseContext as unknown as typeof AudioContext,
  });
  return {
    contexts,
    restore() {
      if (original) Object.defineProperty(globalThis, "AudioContext", original);
      else Reflect.deleteProperty(globalThis, "AudioContext");
    },
  };
}

const oscillator = { kind: "oscillator" as const, waveform: "sine" as const, frequencyHz: 220 };

// These contexts record lifecycle calls and own no physical audio device. Native
// context/memory/phase completeness remains a separate browser evidence domain.
test("new audition requests wait for the old context close and share exactly one replacement context", async () => {
  const fixture = installDeferredContexts();
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  const pending: Promise<unknown>[] = [];
  try {
    assert.equal((await engine.audition(oscillator, 1)).accepted, true);
    assert.equal(fixture.contexts.length, 1);
    const old = fixture.contexts[0]!;
    let stopSettled = false;
    const stopping = engine.stopAudition();
    pending.push(stopping);
    void stopping.then(
      () => {
        stopSettled = true;
      },
      () => {
        stopSettled = true;
      },
    );
    await old.closeStarted.promise;
    assert.equal(old.closeCalls, 1);
    let admissionsSettled = 0;
    const first = engine.audition(oscillator, 1);
    const second = engine.audition(oscillator, 1);
    pending.push(first, second);
    for (const admission of [first, second])
      void admission.then(
        () => {
          admissionsSettled++;
        },
        () => {
          admissionsSettled++;
        },
      );
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.contexts.length, 1, "a pending close is still a live owned context");
    assert.equal(admissionsSettled, 0, "new admissions wait for real close completion");
    assert.equal(stopSettled, false);
    assert.equal(fixture.contexts.filter((context) => context.state !== "closed").length, 1);
    old.closeResult.resolve();
    await stopping;
    const admissions = await Promise.all([first, second]);
    assert.ok(admissions.every((admission) => admission.accepted));
    assert.equal(fixture.contexts.length, 2, "concurrent requests share one replacement engine");
    assert.equal(fixture.contexts.filter((context) => context.state !== "closed").length, 1);
    const replacement = fixture.contexts[1]!;
    assert.equal(replacement.sources().length, 2);
    assert.ok(replacement.sources().every((source) => source.starts.length === 1));
    let disposed = false;
    const disposal = engine.disposeAsync().then(() => {
      disposed = true;
    });
    pending.push(disposal);
    await replacement.closeStarted.promise;
    await Promise.resolve();
    assert.equal(disposed, false, "outer disposal waits for its audition context close");
    assert.notEqual(replacement.state, "closed");
    replacement.closeResult.resolve();
    await disposal;
    assert.equal(fixture.contexts.filter((context) => context.state !== "closed").length, 0);
    assert.equal(fixture.contexts.length, 2);
  } finally {
    for (const context of fixture.contexts) context.closeResult.resolve();
    await Promise.allSettled(pending);
    // Pending admissions can have created the replacement during RED cleanup.
    for (const context of fixture.contexts) context.closeResult.resolve();
    await engine.disposeAsync().catch(() => undefined);
    fixture.restore();
  }
});

test("a failed old audition close blocks replacement contexts and remains an explicit disposal failure", async () => {
  const fixture = installDeferredContexts();
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  const pending: Promise<unknown>[] = [];
  try {
    assert.equal((await engine.audition(oscillator, 1)).accepted, true);
    const old = fixture.contexts[0]!;
    const stopping = engine.stopAudition().then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    pending.push(stopping);
    await old.closeStarted.promise;
    const requests = [engine.audition(oscillator, 1), engine.audition(oscillator, 1)].map(
      (request) =>
        request.then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
    );
    pending.push(...requests);
    await Promise.resolve();
    assert.equal(
      fixture.contexts.length,
      1,
      "waiting auditions cannot allocate while an old context is live",
    );
    old.closeResult.reject(new Error("INJECTED_AUDITION_CLOSE_FAILURE"));
    const stopped = await stopping;
    assert.equal(stopped.ok, false);
    if (!stopped.ok) assert.match(String(stopped.error), /INJECTED_AUDITION_CLOSE_FAILURE/);
    const outcomes = await Promise.all(requests);
    for (const outcome of outcomes) {
      assert.equal(outcome.ok, false, "close rejection must reach each waiting audition");
      if (!outcome.ok) assert.match(String(outcome.error), /INJECTED_AUDITION_CLOSE_FAILURE/);
    }
    assert.equal(fixture.contexts.length, 1);
    assert.notEqual(old.state, "closed", "a rejected close cannot be counted as released");
    await assert.rejects(engine.audition(oscillator, 1), /INJECTED_AUDITION_CLOSE_FAILURE/);
    assert.equal(fixture.contexts.length, 1, "the retained failure also blocks later replacements");
    await assert.rejects(engine.disposeAsync(), /INJECTED_AUDITION_CLOSE_FAILURE/);
    assert.notEqual(old.state, "closed");
    assert.equal(old.closeCalls, 1, "repeated disposal observes the original failed close");
  } finally {
    for (const context of fixture.contexts) context.closeResult.resolve();
    await Promise.allSettled(pending);
    for (const context of fixture.contexts) context.closeResult.resolve();
    await engine.disposeAsync().catch(() => undefined);
    fixture.restore();
  }
});
