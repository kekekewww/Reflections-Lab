import assert from "node:assert/strict";
import test from "node:test";
import { mountReflectionLab, type AnimationFrameHost } from "../../src/app/bootstrap.js";
import type { LabRuntime } from "../../src/app/runtime.js";
import type { LabViewModel } from "../../src/ui/contracts.js";

function fixture() {
  const snapshot = {} as LabViewModel;
  const frames = new Map<number, FrameRequestCallback>();
  const deltas: number[] = [],
    flushes: (number | null)[] = [],
    errors: unknown[] = [];
  const observations: (number | null)[][] = [];
  let sequence = 0,
    now: () => number = () => 1000;
  let advanceHook: (() => void) | null = null;
  let throwObserver = false;
  let disposals = 0;
  const runtime = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    dispatch() {},
    getPose: () => undefined,
    getFPSCamera: () => undefined,
    advance(delta: number) {
      deltas.push(delta);
      advanceHook?.();
    },
    observeRecordingFrame(
      previous: number | null,
      current: number | null,
      callback: number | null,
    ) {
      observations.push([previous, current, callback]);
      if (throwObserver) throw new Error("FRAME_OBSERVATION_FAILED");
    },
    observeRecordingHostFlush(elapsed: number | null) {
      flushes.push(elapsed);
      if (throwObserver) throw new Error("FLUSH_OBSERVATION_FAILED");
    },
    dispose() {
      disposals++;
    },
  } as unknown as LabRuntime;
  const animationFrame: AnimationFrameHost = {
    now: () => now(),
    request: (callback) => {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    },
    cancel: (id) => {
      frames.delete(id);
    },
  };
  return {
    runtime,
    frames,
    deltas,
    flushes,
    observations,
    errors,
    setClock: (next: () => number) => {
      now = next;
    },
    setAdvanceHook: (hook: (() => void) | null) => {
      advanceHook = hook;
    },
    throwObservations: () => {
      throwObserver = true;
    },
    disposals: () => disposals,
    async mount() {
      return mountReflectionLab({ ownerDocument: null } as unknown as HTMLElement, {
        createRuntime: async () => runtime,
        render: () => ({ unmount() {} }),
        animationFrame,
        onError: (error) => errors.push(error),
      });
    },
    run(time: number) {
      const entry = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
      assert.ok(entry, "the owned next RAF must be present");
      frames.delete(entry[0]);
      entry[1](time);
    },
  };
}

// Controlled RAF host only; no real browser or performance claim.
test("failed extra observation-clock reads cannot reanchor, drop, or change the original RAF delta", async () => {
  const f = fixture();
  const mounted = await f.mount();
  try {
    f.setClock(() => {
      throw new Error("OPTIONAL_DIAGNOSTIC_CLOCK_UNAVAILABLE");
    });
    f.run(1016);
    f.run(1050);
    assert.deepEqual(f.deltas, [0.016, 0.034]);
    assert.deepEqual(f.observations, [
      [1000, 1016, null],
      [1016, 1050, null],
    ]);
    assert.deepEqual(f.flushes, [null, null]);
    assert.deepEqual(f.errors, []);
    assert.equal(f.frames.size, 1);
    assert.equal(f.disposals(), 0);
  } finally {
    mounted.dispose();
  }
});

test("throwing observation hooks cannot stop the original simulation or publication scheduling", async () => {
  const f = fixture();
  const mounted = await f.mount();
  try {
    f.throwObservations();
    f.run(1016);
    f.run(1033);
    assert.deepEqual(f.deltas, [0.016, 0.017]);
    assert.equal(f.observations.length, 2);
    assert.equal(f.flushes.length, 2);
    assert.deepEqual(f.errors, []);
    assert.equal(f.frames.size, 1);
    assert.equal(f.disposals(), 0);
  } finally {
    mounted.dispose();
  }
});

test("disposal during advance prevents a host-flush observation and queued late RAF cannot observe again", async () => {
  const f = fixture();
  const mounted = await f.mount();
  const queued = [...f.frames.values()][0]!;
  f.setAdvanceHook(() => mounted.dispose());
  f.run(1016);
  assert.deepEqual(f.deltas, [0.016]);
  assert.equal(
    f.observations.length,
    1,
    "the pre-advance observation occurred while ownership was live",
  );
  assert.deepEqual(f.flushes, [], "a freed runtime cannot receive a post-advance mark");
  assert.equal(f.frames.size, 0);
  assert.equal(f.disposals(), 1);
  queued(1033);
  assert.deepEqual(f.deltas, [0.016]);
  assert.equal(f.observations.length, 1);
  assert.deepEqual(f.flushes, []);
  assert.deepEqual(f.errors, []);
  mounted.dispose();
});
