import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test, { type TestContext } from "node:test";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import {
  RecordingPersistenceSession,
  type RecordingPersistenceBackend,
} from "../../src/experiments/recording-persistence.js";
import { frame, options } from "./worker-fixture.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}
function fixture(t: TestContext) {
  const creation = deferred();
  const failures: Error[] = [];
  const interrupted: string[] = [];
  let creates = 0,
    appends = 0;
  const recorder = new ExperimentRecorder(options("run.storage-readiness"));
  const backend: RecordingPersistenceBackend = {
    create: () => {
      creates++;
      return creation.promise;
    },
    append: async () => {
      appends++;
    },
    interrupt: async (_id, reason) => {
      interrupted.push(reason);
    },
    publish: async () => {
      throw new Error("readiness must not publish");
    },
  };
  const session = new RecordingPersistenceSession(
    "session.storage-readiness",
    recorder.captureSealSnapshot(),
    backend,
    {
      onFailure: (reason) => {
        failures.push(reason);
      },
    },
  );
  t.after(() => creation.resolve());
  return {
    creation,
    recorder,
    session,
    failures,
    interrupted,
    creates: () => creates,
    appends: () => appends,
  };
}
function observeTimers(t: TestContext) {
  const set = globalThis.setTimeout,
    clear = globalThis.clearTimeout;
  const live = new Set<ReturnType<typeof setTimeout>>();
  t.mock.method(globalThis, "setTimeout", ((...args: Parameters<typeof setTimeout>) => {
    const timer = set(...args);
    live.add(timer);
    return timer;
  }) as typeof setTimeout);
  t.mock.method(globalThis, "clearTimeout", ((timer: Parameters<typeof clearTimeout>[0]) => {
    live.delete(timer as ReturnType<typeof setTimeout>);
    return clear(timer);
  }) as typeof clearTimeout);
  t.after(() => {
    for (const timer of live) clear(timer);
  });
  return live;
}
const code = (expected: string) => (reason: unknown) =>
  reason instanceof Error && "code" in reason && reason.code === expected;
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test(
  "storage readiness owns one wait per signal and never manufactures frames or appends",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t),
      owner = new AbortController(),
      foreign = new AbortController();
    const first = f.session.waitUntilReady(owner.signal, 500);
    const shared = f.session.waitUntilReady(owner.signal, 1);
    assert.equal(first, shared, "same owner shares the original promise and budget");
    await assert.rejects(
      f.session.waitUntilReady(foreign.signal, 500),
      code("RECORDING_STORAGE_PREPARATION_BUSY"),
    );
    assert.equal(timers.size, 1);
    assert.equal(getEventListeners(owner.signal, "abort").length, 1);
    assert.equal(getEventListeners(foreign.signal, "abort").length, 0);
    let finished = false;
    void first.then(() => {
      finished = true;
    });
    await Promise.resolve();
    assert.equal(finished, false, "constructor return is not readiness");
    assert.equal(f.session.getTelemetry().acceptedFrames, 0);
    assert.equal(f.session.getTelemetry().persistedFrames, 0);
    assert.equal(f.creates(), 1);
    assert.equal(f.appends(), 0);
    f.creation.resolve();
    await first;
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(owner.signal, "abort").length, 0);
    assert.equal(f.creates(), 1);
    assert.equal(f.appends(), 0);
    assert.equal(f.session.getTelemetry().acceptedFrames, 0);
    assert.equal(f.session.getTelemetry().state, "accepting");
  },
);

test(
  "unowned storage readiness calls also share one bounded in-flight promise",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t);
    const first = f.session.waitUntilReady(undefined, 500);
    assert.equal(f.session.waitUntilReady(undefined, 500), first);
    assert.equal(timers.size, 1);
    f.creation.resolve();
    await first;
    assert.equal(timers.size, 0);
    assert.equal(f.creates(), 1);
  },
);

test(
  "storage readiness abort rejects before create finishes and late creation cannot revive the wait",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t),
      controller = new AbortController();
    const wait = f.session.waitUntilReady(controller.signal, 500);
    controller.abort("user cancelled preparation");
    await assert.rejects(wait, code("RECORDING_STORAGE_PREPARATION_ABORTED"));
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(f.session.getTelemetry().state, "interrupted");
    assert.equal(f.appends(), 0);
    f.creation.resolve();
    await turn();
    await assert.rejects(f.session.waitUntilReady(), code("RECORDING_STORAGE_PREPARATION_ABORTED"));
    assert.equal(f.interrupted.length, 1, "existing failure cleanup runs after create commits");
    assert.equal(f.session.getTelemetry().persistedFrames, 0);
  },
);

test(
  "storage readiness timeout is terminal and clears its listener without waiting for create",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t),
      controller = new AbortController();
    const wait = f.session.waitUntilReady(controller.signal, 5);
    await assert.rejects(wait, code("RECORDING_STORAGE_PREPARATION_TIMEOUT"));
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(f.session.getTelemetry().state, "interrupted");
    f.creation.resolve();
    await turn();
    await assert.rejects(f.session.waitUntilReady(), code("RECORDING_STORAGE_PREPARATION_TIMEOUT"));
    assert.equal(f.interrupted.length, 1);
  },
);

test(
  "storage readiness propagates the exact original create error and clears wait resources",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t),
      controller = new AbortController();
    const original = new Error("indexed transaction create failed");
    const wait = f.session.waitUntilReady(controller.signal, 500);
    f.creation.reject(original);
    await assert.rejects(wait, (reason) => reason === original);
    await assert.rejects(f.session.flush(), (reason) => reason === original);
    assert.deepEqual(f.failures, [original]);
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(f.appends(), 0);
  },
);

test(
  "legacy cancel immediately rejects a pending readiness wait even while create is unresolved",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t),
      controller = new AbortController();
    const wait = f.session.waitUntilReady(controller.signal, 500);
    const cancel = f.session.cancel("explicit cancel");
    await assert.rejects(wait, code("RECORDING_STORAGE_CANCELLED"));
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(f.appends(), 0);
    f.creation.resolve();
    await cancel;
    assert.equal(f.session.getTelemetry().state, "interrupted");
    await assert.rejects(f.session.waitUntilReady(), code("RECORDING_STORAGE_CANCELLED"));
  },
);

test(
  "an independent session failure rejects readiness immediately without requiring create completion",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t),
      controller = new AbortController();
    const wait = f.session.waitUntilReady(controller.signal, 500);
    f.recorder.appendFrame(frame(0));
    let failure: unknown;
    assert.throws(
      () => f.session.enqueue({ ...f.recorder.getLastFrame()!, runEpoch: "foreign.epoch" }),
      (reason) => {
        failure = reason;
        return code("RECORDING_STORAGE_IDENTITY")(reason);
      },
    );
    await assert.rejects(wait, (reason) => reason === failure);
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(f.session.getTelemetry().acceptedFrames, 0);
    f.creation.resolve();
    await turn();
  },
);

test(
  "a ready storage session adds no new timer, listener, create, append or cancellation",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t);
    f.creation.resolve();
    await f.session.flush();
    const timers = observeTimers(t),
      controller = new AbortController();
    await f.session.waitUntilReady(controller.signal);
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    controller.abort("late caller abort");
    assert.equal(f.session.getTelemetry().state, "accepting");
    assert.equal(f.creates(), 1);
    assert.equal(f.appends(), 0);
    assert.deepEqual(f.failures, []);
  },
);

test(
  "an already-aborted storage preparation does not attach resources or accept a late ready result",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t),
      controller = new AbortController();
    controller.abort("cancelled before wait");
    await assert.rejects(
      f.session.waitUntilReady(controller.signal),
      code("RECORDING_STORAGE_PREPARATION_ABORTED"),
    );
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    f.creation.resolve();
    await turn();
    await assert.rejects(f.session.waitUntilReady(), code("RECORDING_STORAGE_PREPARATION_ABORTED"));
    assert.equal(f.appends(), 0);
  },
);

test(
  "storage preparation rejects invalid or enlarged budgets without changing the owned session",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t),
      timers = observeTimers(t),
      controller = new AbortController();
    for (const timeout of [0, -1, 10001, Infinity, NaN])
      await assert.rejects(
        f.session.waitUntilReady(controller.signal, timeout),
        code("RECORDING_STORAGE_PREPARATION_TIMEOUT_RANGE"),
      );
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(f.session.getTelemetry().state, "accepting");
    const valid = f.session.waitUntilReady(controller.signal, 500);
    f.creation.resolve();
    await valid;
    assert.equal(f.creates(), 1);
    assert.equal(f.appends(), 0);
  },
);

test(
  "storage create state is authoritative even when the diagnostic clock is unavailable",
  { timeout: 1000 },
  async (t) => {
    const f = fixture(t);
    assert.equal(f.session.getReadinessTelemetry().createState, "pending");
    t.mock.method(globalThis.performance, "now", () => Number.NaN);
    const wait = f.session.waitUntilReady(undefined, 500);
    f.creation.resolve();
    await wait;
    const ready = f.session.getReadinessTelemetry();
    assert.equal(ready.createState, "ready");
    assert.equal(ready.createReadyAtWallMs, null);
    assert.equal(ready.createFailedAtWallMs, null);
    const failed = fixture(t),
      original = new Error("create failed with no diagnostic clock");
    const failure = failed.session.waitUntilReady(undefined, 500);
    failed.creation.reject(original);
    await assert.rejects(failure, (reason) => reason === original);
    const rejected = failed.session.getReadinessTelemetry();
    assert.equal(rejected.createState, "failed");
    assert.equal(rejected.createFailedAtWallMs, null);
    assert.equal(rejected.createReadyAtWallMs, null);
  },
);
