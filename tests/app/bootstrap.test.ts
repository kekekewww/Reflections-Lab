import assert from "node:assert/strict";
import test from "node:test";
import {
  mountReflectionLab,
  type AnimationFrameHost,
  type MountReflectionLabOptions,
} from "../../src/app/bootstrap.js";
import type { LabRuntime } from "../../src/app/runtime.js";
import type { LabController, LabViewModel } from "../../src/ui/contracts.js";

function fixture(element = { ownerDocument: null } as unknown as HTMLElement) {
  const events: string[] = [],
    callbacks = new Map<number, FrameRequestCallback>(),
    errors: unknown[] = [],
    deltas: number[] = [];
  let next = 0,
    creates = 0,
    renderError: (error: unknown) => void = () => {},
    view: LabController | null = null;
  const snapshot = {} as LabViewModel;
  const runtime = {
    advance(delta: number) {
      events.push("advance");
      deltas.push(delta);
    },
    dispose() {
      events.push("runtime.dispose");
    },
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    dispatch() {
      events.push("dispatch");
    },
    getPose() {
      events.push("getPose");
      return undefined;
    },
    getFPSCamera() {
      events.push("getFPSCamera");
      return undefined;
    },
  } as unknown as LabRuntime;
  const animationFrame: AnimationFrameHost = {
    now: () => 1000,
    request(callback) {
      const id = ++next;
      callbacks.set(id, callback);
      events.push(`request:${id}`);
      return id;
    },
    cancel(id) {
      callbacks.delete(id);
      events.push(`cancel:${id}`);
    },
  };
  const options: MountReflectionLabOptions = {
    createRuntime: async () => {
      creates++;
      return runtime;
    },
    render: (_element, controller, onError) => {
      view = controller;
      renderError = onError;
      events.push("render");
      return {
        unmount: () => {
          events.push("unmount");
        },
      };
    },
    animationFrame,
    onError: (error) => {
      errors.push(error);
    },
  };
  return {
    element,
    events,
    callbacks,
    errors,
    deltas,
    runtime,
    animationFrame,
    options,
    creates: () => creates,
    view: () => view!,
    renderError: (error: unknown) => renderError(error),
    run(time: number) {
      const [id, callback] = callbacks.entries().next().value as [number, FrameRequestCallback];
      callbacks.delete(id);
      callback(time);
    },
  };
}

test("bootstrap owns RAF, React root and runtime teardown in order and exactly once", async () => {
  const f = fixture(),
    mounted = await mountReflectionLab(f.element, f.options);
  assert.equal(mounted.runtime, f.runtime);
  assert.equal(f.callbacks.size, 1);
  f.events.length = 0;
  mounted.dispose();
  mounted.dispose();
  assert.deepEqual(f.events, ["cancel:1", "unmount", "runtime.dispose"]);
  assert.equal(f.callbacks.size, 0);
  const fresh = fixture(f.element),
    again = await mountReflectionLab(f.element, fresh.options);
  again.dispose();
});
test("a canceled but already queued RAF callback cannot advance or resurrect the loop", async () => {
  const f = fixture(),
    mounted = await mountReflectionLab(f.element, f.options),
    queued = [...f.callbacks.values()][0]!;
  mounted.dispose();
  f.events.length = 0;
  queued(1016);
  assert.deepEqual(f.events, []);
  assert.equal(f.callbacks.size, 0);
});
test("dispose during advance closes the gate before another animation frame is requested", async () => {
  const f = fixture();
  let mounted: Awaited<ReturnType<typeof mountReflectionLab>>;
  f.runtime.advance = () => {
    f.events.push("advance");
    mounted.dispose();
  };
  mounted = await mountReflectionLab(f.element, f.options);
  f.events.length = 0;
  f.run(1016);
  assert.deepEqual(f.events, ["advance", "unmount", "runtime.dispose"]);
  assert.equal(f.callbacks.size, 0);
});
test("duplicate pending mounts reject before creating a second runtime", async () => {
  const f = fixture();
  let resolve!: (runtime: LabRuntime) => void,
    calls = 0;
  f.options.createRuntime = () => {
    calls++;
    return new Promise((r) => {
      resolve = r;
    });
  };
  const pending = mountReflectionLab(f.element, f.options);
  await assert.rejects(
    mountReflectionLab(f.element, f.options),
    /already mounted|already initializing/i,
  );
  assert.equal(calls, 1);
  resolve(f.runtime);
  const mounted = await pending;
  mounted.dispose();
});
test("aborting a pending mount releases its lease and late factory completion cannot replace the new app", async () => {
  const f = fixture(),
    abort = new AbortController();
  let resolve!: (runtime: LabRuntime) => void;
  f.options.createRuntime = () =>
    new Promise((r) => {
      resolve = r;
    });
  const pending = mountReflectionLab(f.element, { ...f.options, signal: abort.signal }),
    rejected = assert.rejects(pending, { name: "AbortError" });
  abort.abort();
  const fresh = fixture(f.element),
    next = await mountReflectionLab(f.element, fresh.options);
  resolve(f.runtime);
  await rejected;
  assert.deepEqual(f.events, ["runtime.dispose"]);
  assert.equal(f.callbacks.size, 0);
  assert.equal(fresh.callbacks.size, 1);
  next.dispose();
});
test("an already aborted request never invokes a factory or claims the element", async () => {
  const f = fixture(),
    abort = new AbortController();
  abort.abort();
  await assert.rejects(mountReflectionLab(f.element, { ...f.options, signal: abort.signal }), {
    name: "AbortError",
  });
  assert.equal(f.creates(), 0);
  const mounted = await mountReflectionLab(f.element, f.options);
  mounted.dispose();
});
test("a render failure disposes its runtime and leaves the container available for retry", async () => {
  const f = fixture();
  f.options.render = () => {
    throw new Error("render failed");
  };
  await assert.rejects(mountReflectionLab(f.element, f.options), /render failed/);
  assert.deepEqual(f.events, ["runtime.dispose"]);
  const fresh = fixture(f.element),
    mounted = await mountReflectionLab(f.element, fresh.options);
  mounted.dispose();
});
test("unmount failure still disposes the runtime, releases the lease and remains idempotent", async () => {
  const f = fixture();
  f.options.render = () => ({
    unmount() {
      f.events.push("unmount");
      throw new Error("unmount failed");
    },
  });
  const mounted = await mountReflectionLab(f.element, f.options);
  assert.throws(() => mounted.dispose(), /teardown|unmount failed/i);
  assert.equal(f.events.filter((x) => x === "runtime.dispose").length, 1);
  mounted.dispose();
  const fresh = fixture(f.element),
    next = await mountReflectionLab(f.element, fresh.options);
  next.dispose();
});
test("initial RAF scheduling failure rolls back both mounted view and runtime", async () => {
  const f = fixture();
  f.animationFrame.request = () => {
    throw new Error("scheduler unavailable");
  };
  await assert.rejects(mountReflectionLab(f.element, f.options), /scheduler unavailable/);
  assert.deepEqual(f.events, ["render", "unmount", "runtime.dispose"]);
});
test("advance errors tear down instead of scheduling an endless failing frame", async () => {
  const f = fixture();
  f.runtime.advance = () => {
    throw new Error("advance failed");
  };
  const mounted = await mountReflectionLab(f.element, f.options);
  f.run(1016);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.errors.length, 1);
  assert.match(String(f.errors[0]), /advance failed/);
  assert.equal(f.events.filter((x) => x === "runtime.dispose").length, 1);
  mounted.dispose();
});
test("a reschedule failure cleans the active view and runtime", async () => {
  const f = fixture(),
    mounted = await mountReflectionLab(f.element, f.options);
  f.animationFrame.request = () => {
    throw new Error("reschedule failed");
  };
  f.run(1016);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.errors.length, 1);
  assert.equal(f.events.filter((x) => x === "unmount").length, 1);
  mounted.dispose();
});
test("renderer commit errors defer teardown outside the render callback", async () => {
  const f = fixture(),
    mounted = await mountReflectionLab(f.element, f.options);
  f.events.length = 0;
  f.renderError(new Error("commit failed"));
  assert.equal(f.events.includes("unmount"), false);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.events.filter((x) => x === "runtime.dispose").length, 1);
  assert.equal(f.errors.length, 1);
  mounted.dispose();
});
test("late canvas/controller reads and input cannot touch a disposed runtime", async () => {
  const f = fixture(),
    mounted = await mountReflectionLab(f.element, f.options),
    controller = f.view(),
    snapshot = controller.getSnapshot();
  mounted.dispose();
  f.events.length = 0;
  assert.equal(controller.getPose("ball"), undefined);
  assert.equal(controller.getFPSCamera?.(), undefined);
  controller.dispatch({ type: "run" });
  assert.equal(controller.getSnapshot(), snapshot);
  const unsubscribe = controller.subscribe(() => {
    throw new Error("must not subscribe");
  });
  unsubscribe();
  assert.deepEqual(f.events, []);
});
test("aborting an already mounted application performs the same complete teardown", async () => {
  const f = fixture(),
    abort = new AbortController(),
    mounted = await mountReflectionLab(f.element, { ...f.options, signal: abort.signal });
  f.events.length = 0;
  abort.abort();
  assert.deepEqual(f.events, ["cancel:1", "unmount", "runtime.dispose"]);
  mounted.dispose();
});
test("negative frame timestamps never become a negative simulation delta", async () => {
  const f = fixture(),
    mounted = await mountReflectionLab(f.element, f.options);
  f.run(990);
  assert.deepEqual(f.deltas, [0]);
  mounted.dispose();
});
test("an old renderer's queued or late fatal error cannot report into a fresh mount", async () => {
  const old = fixture(),
    previous = await mountReflectionLab(old.element, old.options);
  old.renderError(new Error("queued old commit"));
  previous.dispose();
  const fresh = fixture(old.element),
    current = await mountReflectionLab(fresh.element, fresh.options);
  await Promise.resolve();
  old.renderError(new Error("late old commit"));
  await Promise.resolve();
  assert.deepEqual(
    old.errors,
    [],
    "closed renderer callbacks must not overwrite the new owner's UI",
  );
  assert.equal(fresh.callbacks.size, 1);
  current.dispose();
});
