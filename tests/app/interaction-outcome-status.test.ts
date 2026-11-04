import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import type { Quaternion, Vector3 } from "../../src/ui/contracts.js";

/** The status line shows the pause reason first, then the notice (App.tsx). */
const status = (app: LabRuntime) => {
  const view = app.getSnapshot();
  return view.pauseReason || view.notice;
};

async function until(predicate: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`timed out waiting for ${label}`);
}

function forward([x, y, z, w]: Quaternion): Vector3 {
  // Rotate (0, 0, -1) by the camera quaternion.
  return [-(2 * (x * z + w * y)), -(2 * (y * z - w * x)), -(1 - 2 * (x * x + y * y))];
}

async function runningFirstPerson(): Promise<LabRuntime> {
  const app = await LabRuntime.create({ useWorker: false });
  await app.dispatch({ type: "enterFPS" });
  await app.dispatch({ type: "pointerLockChanged", locked: true });
  await app.dispatch({ type: "run" });
  assert.equal(app.getSnapshot().simulationState, "running");
  return app;
}

const FROZEN = "已固定；另按繼續才恢復模擬";

/** Puts a gravity-free ball 1.5 m ahead and freezes it with F, leaving the outcome shown. */
async function freezeBallAhead(app: LabRuntime): Promise<void> {
  await app.dispatch({ type: "pause" });
  const camera = app.getFPSCamera()!;
  const ahead = forward(camera.orientationQuaternion);
  const target = camera.positionM.map((value, i) => value + ahead[i]! * 1.5) as Vector3;
  await app.dispatch({
    type: "patchObject",
    objectId: "ball",
    patch: { positionM: target, mode: "dynamicNoGravity" },
  });
  await app.dispatch({ type: "run" });
  await app.dispatch({ type: "inputKey", code: "KeyF", pressed: true });
  await app.dispatch({ type: "inputKey", code: "KeyF", pressed: false });
  await until(
    () => app.getSnapshot().objects.find((object) => object.id === "ball")?.mode === "fixed",
    "the ball to become fixed",
  );
  await until(() => status(app) === FROZEN, "the freeze outcome");
}

test("F freeze reports its own outcome instead of the generic authoring pause", async () => {
  const app = await runningFirstPerson();
  try {
    await freezeBallAhead(app);
    assert.notEqual(app.getSnapshot().simulationState, "running");
  } finally {
    app.dispose();
  }
});

test("a paused-time outcome disappears once time runs, even after another pause reason", async () => {
  const app = await runningFirstPerson();
  try {
    await freezeBallAhead(app);
    await app.dispatch({ type: "inputKey", code: "Tab", pressed: true });
    await app.dispatch({ type: "inputKey", code: "Tab", pressed: false });
    assert.notEqual(app.getSnapshot().pauseReason, FROZEN, "Tab replaces the pause reason");
    await app.dispatch({ type: "pointerLockChanged", locked: true });
    await app.dispatch({ type: "run" });
    assert.equal(app.getSnapshot().simulationState, "running");
    assert.notEqual(status(app), FROZEN);
  } finally {
    app.dispose();
  }
});

test("starting a recording resumes time and drops a paused-time outcome", async () => {
  const app = await runningFirstPerson();
  try {
    await freezeBallAhead(app);
    await app.dispatch({ type: "recordToggle" });
    assert.equal(app.getSnapshot().simulationState, "running");
    assert.notEqual(status(app), FROZEN);
  } finally {
    app.dispose();
  }
});

test("a refusal during replay keeps the replay explanation and ends with the replay", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "run" });
    for (let i = 0; i < 10; i++) app.advance(1 / 60);
    await app.dispatch({ type: "recordToggle" });
    for (let i = 0; i < 20; i++) app.advance(1 / 60);
    await app.dispatch({ type: "recordToggle" });
    await until(() => app.getSnapshot().recording.canReplay, "a replayable recording");
    await app.dispatch({ type: "replay" });
    for (let i = 0; i < 3; i++) app.advance(1 / 60);
    const replaying = app.getSnapshot().pauseReason;
    assert.ok(replaying, "replay explains itself in the status line");
    await app.dispatch({ type: "grab" });
    const refusal = app.getSnapshot().notice;
    assert.equal(app.getSnapshot().pauseReason, replaying);
    await app.dispatch({ type: "stopReplay" });
    await app.dispatch({ type: "run" });
    assert.equal(app.getSnapshot().simulationState, "running");
    assert.notEqual(status(app), refusal, "a replay-time refusal must not reappear in live time");
  } finally {
    app.dispose();
  }
});

/** An audio engine whose resume waits for release(); every other call is a no-op. */
function heldAudio() {
  let release!: () => void;
  let requested = false;
  const resumed = new Promise<void>((resolve) => (release = resolve));
  const methods: Record<string, unknown> = {
    resume: () => {
      requested = true;
      return resumed;
    },
    getTelemetry: () => undefined,
  };
  const audio = new Proxy(methods, {
    get: (target, key) =>
      typeof key === "string" && key in target ? target[key] : () => undefined,
  });
  return { audio, release, requested: () => requested };
}

for (const [label, resume] of [
  ["run", { type: "run" }],
  ["recording start", { type: "recordToggle" }],
] as const)
  test(`a pause that lands while ${label} awaits audio keeps its reason`, async () => {
    const app = await runningFirstPerson();
    const internal = app as unknown as { audio: unknown };
    try {
      if (resume.type === "run") await app.dispatch({ type: "pause" });
      const { audio, release, requested } = heldAudio();
      internal.audio = audio;
      const pending = app.dispatch(resume);
      // Blur exactly while the resume awaits the audio engine.
      await until(requested, `${label} to await audio`);
      await app.dispatch({ type: "inputBlur" });
      release();
      await pending;
      assert.notEqual(app.getSnapshot().simulationState, "running");
      assert.ok(app.getSnapshot().pauseReason, "the newer pause must keep its reason");
    } finally {
      internal.audio = null;
      app.dispose();
    }
  });

test("B is a harmless cancel shortcut and never enters a separate build mode", async () => {
  const app = await runningFirstPerson();
  try {
    await app.dispatch({ type: "inputKey", code: "KeyB", pressed: true });
    await app.dispatch({ type: "inputKey", code: "KeyB", pressed: false });
    assert.equal(app.getSnapshot().interactionMode, "fps-interact");
    assert.equal(app.getSnapshot().placementGhost, undefined);
    await app.dispatch({ type: "startPlacement" });
    assert.equal(app.getSnapshot().placementGhost?.stage, "preview");
    assert.equal(app.getSnapshot().placementGhost?.shape, "box");

    await app.dispatch({ type: "inputKey", code: "KeyB", pressed: true });
    await app.dispatch({ type: "inputKey", code: "KeyB", pressed: false });
    assert.equal(app.getSnapshot().interactionMode, "fps-interact");
    assert.equal(app.getSnapshot().placementGhost, undefined);
  } finally {
    app.dispose();
  }
});

test("placement outcome is visible immediately while simulation keeps running", async () => {
  const app = await runningFirstPerson();
  try {
    const before = app.getSnapshot().objects.length;
    await app.dispatch({ type: "startPlacement" });
    assert.equal(app.getSnapshot().placementGhost?.valid, true);
    await app.dispatch({ type: "place" });
    assert.equal(app.getSnapshot().objects.length, before + 1);
    assert.equal(app.getSnapshot().placementGhost, undefined);
    assert.equal(status(app), "物件已放置，可直接操作。");
    assert.equal(app.getSnapshot().simulationState, "running");
  } finally {
    app.dispose();
  }
});
