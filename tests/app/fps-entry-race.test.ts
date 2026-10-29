import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";

test("early lock confirmation survives an asynchronous FPS entry and enables actual movement", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const internal = app as unknown as { staticPreview: { stop(): Promise<void> } };
  const original = internal.staticPreview.stop;
  let release!: () => void;
  internal.staticPreview.stop = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  try {
    const entry = app.dispatch({ type: "enterFPS" });
    await app.dispatch({ type: "pointerLockChanged", locked: true });
    release();
    await entry;
    internal.staticPreview.stop = original;
    await app.dispatch({ type: "run" });
    assert.equal(app.getSnapshot().simulationState, "running");
    const before = app.getFPSCamera()!.positionM[2];
    await app.dispatch({ type: "inputKey", code: "KeyW", pressed: true });
    for (let i = 0; i < 20; i++) app.advance(1 / 60);
    assert.ok(app.getFPSCamera()!.positionM[2] < before);
  } finally {
    internal.staticPreview.stop = original;
    app.dispose();
  }
});

test("blur cancels an entry awaiting preview shutdown", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const internal = app as unknown as { staticPreview: { stop(): Promise<void> } };
  const original = internal.staticPreview.stop;
  const releases: Array<() => void> = [];
  internal.staticPreview.stop = () => new Promise<void>((resolve) => releases.push(resolve));
  try {
    const entry = app.dispatch({ type: "enterFPS" });
    await app.dispatch({ type: "inputBlur" });
    releases.forEach((release) => release());
    await entry;
    assert.equal(app.getSnapshot().interactionMode, "editor");
    assert.notEqual(app.getSnapshot().simulationState, "running");
  } finally {
    internal.staticPreview.stop = original;
    app.dispose();
  }
});

test("exit cancels an entry awaiting preview shutdown", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const internal = app as unknown as { staticPreview: { stop(): Promise<void> } };
  const original = internal.staticPreview.stop;
  let release!: () => void;
  internal.staticPreview.stop = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  try {
    const entry = app.dispatch({ type: "enterFPS" });
    await app.dispatch({ type: "exitFPS" });
    release();
    await entry;
    assert.equal(app.getSnapshot().interactionMode, "editor");
  } finally {
    internal.staticPreview.stop = original;
    app.dispose();
  }
});

test("busy entry remains editor and reports a recoverable error", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const internal = app as unknown as { busy: boolean };
  try {
    internal.busy = true;
    await app.dispatch({ type: "enterFPS" });
    assert.equal(app.getSnapshot().interactionMode, "editor");
    assert.match(app.getSnapshot().error, /TRANSACTION_BUSY/);
  } finally {
    internal.busy = false;
    app.dispose();
  }
});

test("rejected resume keeps simulation paused and reports why", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "enterFPS" });
    await app.dispatch({ type: "run" });
    assert.notEqual(app.getSnapshot().simulationState, "running");
    assert.match(app.getSnapshot().notice ?? "", /滑鼠鎖定/);
  } finally {
    app.dispose();
  }
});
