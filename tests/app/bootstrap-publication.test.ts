import assert from "node:assert/strict";
import test from "node:test";
import { mountReflectionLab, type AnimationFrameHost } from "../../src/app/bootstrap.js";
import type { LabRuntime } from "../../src/app/runtime.js";
import type { LabAction, LabController, LabViewModel } from "../../src/ui/contracts.js";

// Deterministic controller-publication checks. Runtime ticks and input execution
// stay immediate; these tests do not measure React or browser frame performance.
function initialModel(): LabViewModel {
  return {
    projectName: "Publication fixture",
    sceneRevision: 1,
    workspace: "simulation",
    simulationState: "running",
    interactionMode: "editor",
    tick: 0,
    simTimeSeconds: 0,
    runId: "publication-run",
    selectedObjectId: null,
    objects: [
      {
        id: "object-a",
        name: "Original",
        shape: "box",
        dimensionsM: [1, 1, 1],
        positionM: [0, 1, 0],
        orientationQuaternion: [0, 0, 0, 1],
        mode: "dynamicGravity",
        massKg: 1,
        friction: 0.5,
        restitution: 0.5,
        physicsMaterialId: "fixture-physics",
        acousticMaterialId: "fixture-acoustic",
        acousticRole: "none",
      },
    ],
    listener: {
      id: "listener",
      positionM: [0, 1, 2],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
    paths: [],
    events: [],
    assets: [],
    behaviors: [
      {
        objectId: "object-a",
        profileId: "profile-a",
        revision: 1,
        documentRevision: 1,
        presetKind: "procedural",
        rules: [],
      },
    ],
    monitor: {
      state: "muted",
      muted: true,
      gainLinear: 0.5,
      mode: "simulated",
      activeVoices: 0,
      voiceLimit: 16,
    },
    recording: { state: "idle", eventCount: 0, durationSeconds: 0, canReplay: false },
    ai: { mode: "offline", status: "idle", message: "Ready", canApply: false },
    comparison: { hasA: false, hasB: false, status: "Ready", metrics: [] },
    acoustic: { backend: "fixture", model: "Synthetic", revision: 1, state: "ready", metrics: [] },
    canUndo: false,
    canRedo: false,
  };
}

function fixture() {
  let model = initialModel(),
    clock = 0,
    nextRaf = 0,
    advances = 0,
    snapshotReads = 0;
  let controller: LabController | null = null;
  let dispatchHandler: (action: LabAction) => void | Promise<void> = () => {};
  const listeners = new Set<() => void>();
  const frames = new Map<number, FrameRequestCallback>();
  const dispatched: LabAction[] = [];
  const publish = (patch: Partial<LabViewModel>) => {
    model = { ...model, ...patch };
    for (const listener of listeners) listener();
  };
  const runtime = {
    getSnapshot: () => {
      snapshotReads++;
      return model;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPose: () => model.objects[0],
    getFPSCamera: () => undefined,
    dispatch: (action: LabAction) => {
      dispatched.push(action);
      return dispatchHandler(action);
    },
    advance: (_seconds: number) => {
      advances++;
      publish({
        tick: advances,
        simTimeSeconds: advances / 60,
        objects: model.objects.map((object) => ({ ...object, positionM: [advances / 60, 1, 0] })),
        monitor: { ...model.monitor, activeVoices: advances % 3 },
        acoustic: {
          ...model.acoustic,
          state: advances % 3 === 0 ? "stale" : advances % 2 ? "pending" : "ready",
          metrics: [{ label: "Volatile fixture metric", value: advances, unit: "linear" }],
        },
      });
    },
    dispose: () => {},
  } as unknown as LabRuntime;
  const animationFrame: AnimationFrameHost = {
    now: () => clock,
    request: (callback) => {
      const id = ++nextRaf;
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
    dispatched,
    publish,
    current: () => model,
    controller: () => controller!,
    advances: () => advances,
    snapshotReads: () => snapshotReads,
    subscriberCount: () => listeners.size,
    setTime: (value: number) => {
      clock = value;
    },
    setDispatch: (handler: typeof dispatchHandler) => {
      dispatchHandler = handler;
    },
    async mount() {
      return mountReflectionLab({ ownerDocument: null } as unknown as HTMLElement, {
        createRuntime: async () => runtime,
        animationFrame,
        render: (_element, view) => {
          controller = view;
          return { unmount() {} };
        },
      });
    },
    frame(time: number) {
      clock = time;
      const next = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
      assert.ok(next, "the fixture must have one owned application RAF");
      frames.delete(next[0]);
      next[1](time);
    },
  };
}

function listen(controller: LabController): LabViewModel[] {
  const notifications: LabViewModel[] = [];
  controller.subscribe(() => notifications.push(controller.getSnapshot()));
  return notifications;
}

test("sixty domain advances in one second produce at most ten panel publications", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller(),
      notifications = listen(view),
      initialCount = notifications.length;
    for (let frame = 1; frame <= 60; frame++) f.frame((frame * 1000) / 60);
    assert.equal(f.advances(), 60, "publication throttling cannot reduce domain execution");
    assert.equal(f.current().tick, 60);
    const count = notifications.length - initialCount;
    assert.ok(
      count >= 8 && count <= 10,
      `expected an updating 10Hz panel stream, received ${count}`,
    );
    assert.ok(
      view.getSnapshot().tick >= 54,
      "the panel cannot remain more than one publication interval behind",
    );
  } finally {
    mounted.dispose();
  }
});

test("getSnapshot identity stays fixed until the coalesced publication notifies subscribers", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller(),
      notifications = listen(view),
      initialCount = notifications.length;
    const original = view.getSnapshot();
    f.setTime(10);
    f.publish({ tick: 1, simTimeSeconds: 1 / 60 });
    assert.notEqual(f.current(), original);
    assert.equal(
      view.getSnapshot(),
      original,
      "an unpublished runtime snapshot must not escape through the getter",
    );
    assert.equal(notifications.length, initialCount);
    f.frame(90);
    assert.equal(view.getSnapshot(), original);
    assert.deepEqual(
      view.getPose("object-a")?.positionM,
      [1 / 60, 1, 0],
      "viewport pose reads remain live while the React panel snapshot is coalesced",
    );
    f.frame(100);
    assert.equal(notifications.length, initialCount + 1);
    const published = view.getSnapshot();
    assert.equal(published, notifications.at(-1));
    assert.equal(published, f.current());
    f.setTime(101);
    f.publish({ tick: 100 });
    assert.equal(view.getSnapshot(), published);
  } finally {
    mounted.dispose();
  }
});

test("selection, revisions, workspace, monitor, simulation and error state publish immediately", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller(),
      notifications = listen(view);
    const changes: ((model: LabViewModel) => Partial<LabViewModel>)[] = [
      () => ({ selectedObjectId: "object-a" }),
      () => ({ workspace: "analysis" }),
      () => ({ sceneRevision: 2 }),
      (model) => ({
        behaviors: model.behaviors.map((behavior) => ({ ...behavior, documentRevision: 2 })),
      }),
      (model) => ({ monitor: { ...model.monitor, muted: false, state: "audible" } }),
      (model) => ({ monitor: { ...model.monitor, gainLinear: 0.2 } }),
      () => ({ simulationState: "paused" }),
      () => ({ interactionMode: "fps-interact" }),
      () => ({ alternativeInput: true }),
      (model) => ({ objects: model.objects.map((object) => ({ ...object, held: true })) }),
      (model) => ({ objects: model.objects.map((object) => ({ ...object, held: false })) }),
      () => ({ error: "Immediate fixture error" }),
      (model) => ({ acoustic: { ...model.acoustic, state: "error" } }),
      (model) => ({ acoustic: { ...model.acoustic, state: "unsupported" } }),
      (model) => ({ acoustic: { ...model.acoustic, state: "ready" } }),
      () => ({
        assets: [
          { id: "asset-a", name: "Readiness fixture", provenance: "Synthetic", status: "pending" },
        ],
      }),
      (model) => ({ assets: model.assets.map((asset) => ({ ...asset, status: "ready" })) }),
      (model) => ({ assets: model.assets.map((asset) => ({ ...asset, status: "error" })) }),
    ];
    for (const change of changes) {
      const count = notifications.length;
      f.publish(change(f.current()));
      assert.equal(
        notifications.length,
        count + 1,
        "critical updates cannot wait for the next panel cadence",
      );
      assert.equal(view.getSnapshot(), f.current());
    }
  } finally {
    mounted.dispose();
  }
});

test("an asynchronous AI request exposes loading and completion without advancing a frame", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller(),
      notifications = listen(view);
    let complete!: () => void;
    const gate = new Promise<void>((resolve) => {
      complete = resolve;
    });
    f.setDispatch(async () => {
      f.publish({ ai: { ...f.current().ai, status: "loading", message: "Preparing proposal" } });
      await gate;
      f.publish({
        ai: {
          ...f.current().ai,
          status: "preview",
          message: "Proposal ready",
          preview: "Fixture",
          canApply: true,
        },
      });
    });
    const pending = view.dispatch({ type: "submitPrompt", prompt: "Fixture" });
    assert.equal(view.getSnapshot().ai.status, "loading");
    complete();
    await pending;
    assert.equal(view.getSnapshot().ai.status, "preview");
    assert.ok(notifications.some((model) => model.ai.status === "loading"));
    assert.ok(notifications.some((model) => model.ai.status === "preview"));
    assert.equal(f.advances(), 0);
  } finally {
    mounted.dispose();
  }
});

test("an awaited ordinary command flushes its final object payload even without a critical scalar change", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller();
    listen(view);
    let complete!: () => void;
    const gate = new Promise<void>((resolve) => {
      complete = resolve;
    });
    f.setDispatch(async () => {
      await gate;
      f.publish({
        objects: f.current().objects.map((object) => ({ ...object, name: "Command complete" })),
      });
    });
    const pending = view.dispatch({
      type: "patchObject",
      objectId: "object-a",
      patch: { name: "Command complete" },
    });
    complete();
    await pending;
    assert.equal(view.getSnapshot().objects[0]?.name, "Command complete");
    assert.equal(f.advances(), 0);
  } finally {
    mounted.dispose();
  }
});

test("an awaited selection command returns with the ready state and selected object visible", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller();
    listen(view);
    f.setDispatch(async () => {
      await Promise.resolve();
      f.publish({ simulationState: "ready", selectedObjectId: "object-a" });
    });
    await view.dispatch({ type: "selectObject", objectId: "object-a" });
    assert.equal(view.getSnapshot().simulationState, "ready");
    assert.equal(view.getSnapshot().selectedObjectId, "object-a");
  } finally {
    mounted.dispose();
  }
});

test("high-frequency input executes in the domain immediately without forcing a panel burst", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller(),
      notifications = listen(view),
      original = view.getSnapshot();
    const initialCount = notifications.length;
    f.setDispatch(() =>
      f.publish({
        objects: f.current().objects.map((object) => ({
          ...object,
          positionM: [f.dispatched.length / 100, 1, 0],
        })),
      }),
    );
    const inputs: LabAction[] = [
      { type: "inputLook", movementX: 1, movementY: 0 },
      { type: "inputKey", code: "KeyW", pressed: true },
      { type: "inputWheel", deltaY: 1 },
      { type: "inputPointer", button: 0, pressed: true },
    ];
    for (let index = 0; index < 60; index++) void view.dispatch(inputs[index % inputs.length]!);
    assert.equal(f.dispatched.length, 60, "input execution must not wait for a publication timer");
    assert.equal(f.advances(), 0);
    assert.equal(notifications.length, initialCount);
    assert.equal(view.getSnapshot(), original);
    f.frame(100);
    assert.equal(notifications.length, initialCount + 1);
  } finally {
    mounted.dispose();
  }
});

test("disposing a pending publication drops it and prevents timer or late-RAF resurrection", async () => {
  const f = fixture(),
    mounted = await f.mount();
  const oldTimeout = globalThis.setTimeout,
    oldInterval = globalThis.setInterval;
  let timerRequests = 0;
  const timers: (ReturnType<typeof setTimeout> | number)[] = [],
    intervals: (ReturnType<typeof setInterval> | number)[] = [];
  globalThis.setTimeout = ((
    callback: Parameters<typeof setTimeout>[0],
    milliseconds?: number,
    ...args: unknown[]
  ) => {
    timerRequests++;
    const timer = oldTimeout(callback, milliseconds, ...args);
    timers.push(timer);
    return timer;
  }) as typeof setTimeout;
  globalThis.setInterval = ((
    callback: Parameters<typeof setInterval>[0],
    milliseconds?: number,
    ...args: unknown[]
  ) => {
    timerRequests++;
    const timer = oldInterval(callback, milliseconds, ...args);
    intervals.push(timer);
    return timer;
  }) as typeof setInterval;
  try {
    const view = f.controller(),
      notifications = listen(view),
      original = view.getSnapshot();
    const count = notifications.length;
    f.frame(16);
    const queued = [...f.frames.values()][0]!;
    mounted.dispose();
    f.setTime(1000);
    f.publish({ tick: 999 });
    queued(1000);
    assert.equal(
      notifications.length,
      count,
      "a pending publication cannot flush after its mount closes",
    );
    assert.equal(view.getSnapshot(), original);
    assert.equal(f.advances(), 1);
    assert.equal(f.frames.size, 0);
    assert.equal(f.subscriberCount(), 0, "the runtime subscription must also be detached");
    assert.equal(
      timerRequests,
      0,
      "publication uses the existing application RAF, without another timer loop",
    );
  } finally {
    globalThis.setTimeout = oldTimeout;
    globalThis.setInterval = oldInterval;
    for (const timer of timers) clearTimeout(timer);
    for (const timer of intervals) clearInterval(timer);
    mounted.dispose();
  }
});

test("an awaited command settling after disposal cannot read or publish into its closed panel owner", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller(),
      notifications = listen(view);
    let complete!: () => void;
    const gate = new Promise<void>((resolve) => {
      complete = resolve;
    });
    f.setDispatch(async () => {
      await gate;
      f.publish({
        objects: f.current().objects.map((object) => ({ ...object, name: "Late completion" })),
      });
    });
    const command = view.dispatch({
      type: "patchObject",
      objectId: "object-a",
      patch: { name: "Late completion" },
    });
    mounted.dispose();
    const frozen = view.getSnapshot(),
      reads = f.snapshotReads(),
      count = notifications.length;
    complete();
    await command;
    assert.equal(
      f.snapshotReads(),
      reads,
      "the final command flush must not consult a disposed runtime",
    );
    assert.equal(notifications.length, count);
    assert.equal(view.getSnapshot(), frozen);
    assert.equal(f.frames.size, 0);
    assert.equal(f.subscriberCount(), 0);
  } finally {
    mounted.dispose();
  }
});

test("a synchronous input failure flushes its last domain state and preserves the original exception", async () => {
  const f = fixture(),
    mounted = await f.mount();
  try {
    const view = f.controller(),
      notifications = listen(view),
      count = notifications.length;
    const failure = new Error("Synchronous input fixture failure");
    f.setDispatch(() => {
      f.publish({
        objects: f.current().objects.map((object) => ({ ...object, name: "Failure result" })),
      });
      throw failure;
    });
    assert.throws(
      () => view.dispatch({ type: "inputLook", movementX: 1, movementY: 0 }),
      (error: unknown) => error === failure,
    );
    assert.equal(f.dispatched.length, 1);
    assert.equal(view.getSnapshot().objects[0]?.name, "Failure result");
    assert.equal(
      notifications.length,
      count + 1,
      "the failure path cannot leave unpublished domain state hidden behind the input cadence",
    );
  } finally {
    mounted.dispose();
  }
});
