import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import type { InteractionHost } from "../../src/interaction/index.js";
import type { InteractionHostOptions } from "../../src/interaction/types.js";
import type { PhysicsWorld } from "../../src/physics/index.js";

async function rig() {
  const app = await LabRuntime.create({ useWorker: false });
  await app.dispatch({ type: "enterFPS" });
  await app.dispatch({ type: "pointerLockChanged", locked: true });
  await app.dispatch({ type: "run" });
  const internal = app as unknown as {
    interaction: InteractionHost & { options: InteractionHostOptions };
    world: PhysicsWorld;
    audio: unknown;
  };
  return { app, internal, options: internal.interaction.options };
}

test("R21 placement has one revision and Undo, preserves audio and never publishes paused", async () => {
  const { app, internal, options } = await rig();
  const before = app.getSnapshot();
  const audioCalls: string[] = [];
  const audio = internal.audio;
  const states: string[] = [];
  const unsubscribe = app.subscribe(() => states.push(app.getSnapshot().simulationState));
  internal.audio = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === "getTelemetry") return () => undefined;
        return () => {
          audioCalls.push(String(key));
        };
      },
    },
  );
  const ack = options.confirmGeometry!;
  options.confirmGeometry = (id, revision, draft) => {
    assert.equal(
      app.getSnapshot().objects.some((o) => o.id === id),
      false,
    );
    assert.equal(
      internal.world.snapshot().poses.some((o) => o.objectId === id),
      false,
    );
    return ack(id, revision, draft);
  };
  try {
    await app.dispatch({ type: "startPlacement" });
    const ghost = app.getSnapshot().placementGhost!;
    assert.equal(ghost.shape, "box");
    assert.equal(ghost.attachment, "air");
    await app.dispatch({ type: "place" });
    assert.equal(app.getSnapshot().sceneRevision, before.sceneRevision + 1);
    assert.equal(app.getSnapshot().objects.length, before.objects.length + 1);
    assert.equal(app.getSnapshot().objects.at(-1)?.mode, "dynamicNoGravity");
    assert.equal(app.getSnapshot().simulationState, "running");
    assert.ok(
      states.every((state) => state === "running"),
      states.join(","),
    );
    assert.equal(audioCalls.includes("pause"), false);
    assert.equal(audioCalls.includes("drainVoices"), false);
    internal.audio = audio;
    await app.dispatch({ type: "undo" });
    assert.equal(app.getSnapshot().objects.length, before.objects.length);
    assert.equal(app.getSnapshot().canUndo, false, "one Undo removes the placement");
  } finally {
    unsubscribe();
    internal.audio = audio;
    app.dispose();
  }
});

for (const interrupt of ["pause", "inputBlur"] as const)
  test(`R21 ${interrupt} during acknowledgement cancels placement and keeps that pause`, async () => {
    const { app, internal, options } = await rig();
    let release!: (ack: boolean) => void;
    options.confirmGeometry = () =>
      new Promise<boolean>((resolve) => {
        release = resolve;
      });
    try {
      const before = app.getSnapshot().objects.length;
      await app.dispatch({ type: "startPlacement" });
      const placing = app.dispatch({ type: "place" });
      assert.equal(internal.interaction.snapshot().pending, true);
      await app.dispatch({ type: interrupt });
      const reason = app.getSnapshot().pauseReason;
      assert.notEqual(app.getSnapshot().simulationState, "running");
      release(true);
      await placing;
      assert.notEqual(app.getSnapshot().simulationState, "running");
      assert.equal(app.getSnapshot().objects.length, before);
      assert.equal(app.getSnapshot().pauseReason, reason);
      assert.equal(internal.interaction.snapshot().staged, null);
      await app.dispatch({ type: "pointerLockChanged", locked: true });
      await app.dispatch({ type: "run" });
      assert.equal(app.getSnapshot().simulationState, "running");
    } finally {
      release?.(false);
      app.dispose();
    }
  });

test("R21 a failed atomic apply rolls back body, scene and history", async () => {
  const { app, internal } = await rig();
  const before = app.getSnapshot();
  const apply = internal.world.applyScene.bind(internal.world);
  let first = true;
  internal.world.applyScene = (scene) => {
    apply(scene);
    if (first) {
      first = false;
      throw new Error("injected apply observer failure");
    }
  };
  try {
    await app.dispatch({ type: "startPlacement" });
    await app.dispatch({ type: "place" });
    assert.equal(app.getSnapshot().objects.length, before.objects.length);
    assert.equal(internal.world.snapshot().poses.length, before.objects.length);
    assert.equal(app.getSnapshot().sceneRevision, before.sceneRevision);
    assert.equal(app.getSnapshot().canUndo, before.canUndo);
    assert.equal(app.getSnapshot().simulationState, "running");
    assert.match(app.getSnapshot().notice ?? "", /injected apply observer failure/);
    assert.equal(internal.interaction.snapshot().pending, false);
    assert.equal(internal.interaction.resume(), true);
  } finally {
    internal.world.applyScene = apply;
    app.dispose();
  }
});

test("R21 a failed quiet-hold release rolls back placement and restores running time", async () => {
  const { app, internal } = await rig();
  const before = app.getSnapshot();
  const resume = internal.world.resume.bind(internal.world);
  let first = true;
  internal.world.resume = () => {
    if (first) {
      first = false;
      throw new Error("injected quiet resume failure");
    }
    resume();
  };
  try {
    await app.dispatch({ type: "startPlacement" });
    await app.dispatch({ type: "place" });
    assert.equal(app.getSnapshot().objects.length, before.objects.length);
    assert.equal(internal.world.snapshot().poses.length, before.objects.length);
    assert.equal(app.getSnapshot().sceneRevision, before.sceneRevision);
    assert.equal(app.getSnapshot().canUndo, before.canUndo);
    assert.equal(app.getSnapshot().simulationState, "running");
    assert.match(app.getSnapshot().notice ?? "", /injected quiet resume failure/);
    assert.equal(internal.interaction.resume(), true);
  } finally {
    internal.world.resume = resume;
    app.dispose();
  }
});

test("R21 the existing library selects the right-button shape without adding an editor object", async () => {
  const { app } = await rig();
  try {
    const count = app.getSnapshot().objects.length;
    await app.dispatch({ type: "inputKey", code: "KeyL", pressed: true });
    await app.dispatch({ type: "inputKey", code: "KeyL", pressed: false });
    await app.dispatch({ type: "addObject", shape: "capsule" });
    assert.equal(app.getSnapshot().objects.length, count);
    await app.dispatch({ type: "run" });
    await app.dispatch({ type: "inputPointer", button: 2, pressed: false });
    await app.dispatch({ type: "inputPointer", button: 2, pressed: true });
    assert.equal(app.getSnapshot().placementGhost?.shape, "capsule");
    await app.dispatch({ type: "inputPointer", button: 2, pressed: false });
    for (let i = 0; i < 100 && app.getSnapshot().placementGhost; i++)
      await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(app.getSnapshot().objects.length, count + 1);
    assert.equal(app.getSnapshot().objects.at(-1)?.shape, "capsule");
  } finally {
    app.dispose();
  }
});
