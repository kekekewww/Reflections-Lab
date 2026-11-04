import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { formatMessage } from "../../src/ui/locale-model.js";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
async function rig() {
  const app = await LabRuntime.create({ useWorker: false });
  await app.dispatch({ type: "enterFPS" });
  await app.dispatch({ type: "pointerLockChanged", locked: true });
  await app.dispatch({ type: "run" });
  app.advance(1 / 60);
  const r = app as any;
  r.interaction.handlePointer(2, false);
  return { app, r, host: r.interaction, options: r.interaction.options };
}
async function released(r: any) {
  r.interaction.handlePointer(2, true);
  r.interaction.handlePointer(2, false);
  await turn();
}
async function settled(host: any) {
  for (let i = 0; i < 100 && host.snapshot().pending; i++) await turn();
  assert.equal(host.snapshot().pending, false);
}

for (const paused of [false, true])
  test(`review 1: right preview and release refuse ${paused ? "paused" : "active"} recording without breaking the take`, async () => {
    const { app, r, host } = await rig();
    try {
      await app.dispatch({ type: "recordToggle" });
      if (paused) await app.dispatch({ type: "pause" });
      const revision = r.scene.sceneRevision;
      assert.equal(host.startPreview(), false);
      assert.match(host.snapshot().notice ?? "", /PLACEMENT_TRANSPORT/);
      assert.match(formatMessage("en", host.snapshot().notice), /recording|replay/i);
      assert.match(formatMessage("zh-TW", host.snapshot().notice), /錄製/);
      await released(r);
      await settled(host);
      assert.equal(r.scene.sceneRevision, revision);
      if (paused) await app.dispatch({ type: "run" });
      app.advance(1 / 60);
      app.advance(1 / 60);
      assert.equal(app.getSnapshot().error, "");
      assert.equal(app.getSnapshot().recording.state, "recording");
    } finally {
      app.dispose();
    }
  });

test("review 1/3: replay starting and active refuse preview and abort a right-release transaction", async () => {
  const { app, r, host, options } = await rig();
  let releaseAck!: (value: boolean) => void, releaseStop!: () => void;
  const stop = r.staticPreview.stop;
  try {
    await app.dispatch({ type: "recordToggle" });
    app.advance(1 / 60);
    app.advance(1 / 60);
    await app.dispatch({ type: "recordToggle" });
    assert.equal(app.getSnapshot().recording.canReplay, true);
    const revision = r.scene.sceneRevision;
    options.confirmGeometry = () =>
      new Promise<boolean>((resolve) => {
        releaseAck = resolve;
      });
    await released(r);
    r.staticPreview.stop = () =>
      new Promise<void>((resolve) => {
        releaseStop = resolve;
      });
    const replaying = app.dispatch({ type: "replay" });
    assert.equal(host.startPreview(), false);
    assert.match(host.snapshot().notice ?? "", /PLACEMENT_TRANSPORT/);
    releaseAck(true);
    await settled(host);
    assert.equal(r.scene.sceneRevision, revision);
    r.staticPreview.stop = stop;
    releaseStop();
    await replaying;
    assert.equal(app.getSnapshot().recording.state, "replaying");
    assert.equal(host.startPreview(), false);
    assert.match(host.snapshot().notice ?? "", /PLACEMENT_TRANSPORT/);
    assert.equal(r.scene.sceneRevision, revision);
    await app.dispatch({ type: "stopReplay" });
    await app.dispatch({ type: "run" });
    assert.equal(host.startPreview(), true, "return to live scene restores placement");
  } finally {
    releaseAck?.(false);
    releaseStop?.();
    r.staticPreview.stop = stop;
    app.dispose();
  }
});

test("review 1 race: Record during right-release physics preparation cannot apply a new revision", async () => {
  const { app, r, host } = await rig();
  const create = PhysicsWorld.create;
  let release!: () => void;
  let entered = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  PhysicsWorld.create = async (...args: Parameters<typeof create>) => {
    entered = true;
    await gate;
    return create(...args);
  };
  try {
    const revision = r.scene.sceneRevision;
    await released(r);
    assert.equal(entered, true);
    assert.equal(r.busy, false, "right release is outside dispatch transaction ownership");
    await app.dispatch({ type: "recordToggle" });
    assert.equal(
      app.getSnapshot().recording.state,
      "recording",
      "Record must take transport ownership",
    );
    assert.equal(host.snapshot().pending, false, "Record settles cancellation before FPS Resume");
    assert.equal(r.scene.sceneRevision, revision, "preparation has not published a Scene revision");
    release();
    await settled(host);
    assert.equal(r.scene.sceneRevision, revision);
    assert.match(app.getSnapshot().notice ?? "", /PLACEMENT_TRANSPORT/);
    assert.equal(
      app.getSnapshot().recording.state,
      "recording",
      "late placement cannot disrupt the take",
    );
    app.advance(1 / 60);
    app.advance(1 / 60);
    assert.equal(app.getSnapshot().error, "");
  } finally {
    release();
    PhysicsWorld.create = create;
    app.dispose();
  }
});

test("review 2: invalid right release clears preview and reports the placement reason", async () => {
  const { app, r, host } = await rig();
  try {
    host.handlePointer(2, true);
    host.setGhostPose([100, 100, 100]);
    host.handlePointer(2, false);
    await turn();
    assert.equal(host.snapshot().ghost, null);
    assert.match(app.getSnapshot().notice ?? "", /超出範圍/);
    assert.equal(r.scene.sceneRevision, 0);
  } finally {
    app.dispose();
  }
});

for (const reason of ["replay starting", "fixed-step overload", "error"])
  test(`review 3: runtime pauseCore aborts pending preparation (${reason})`, async () => {
    const { app, r, host, options } = await rig();
    let release!: (value: boolean) => void;
    options.confirmGeometry = () =>
      new Promise<boolean>((resolve) => {
        release = resolve;
      });
    try {
      const revision = r.scene.sceneRevision;
      await released(r);
      assert.equal(host.snapshot().pending, true);
      r.pauseCore(reason);
      await turn();
      assert.equal(
        host.snapshot().pending,
        false,
        "pause must resolve cancellation before preparation settles",
      );
      release(true);
      await turn();
      await settled(host);
      assert.equal(r.scene.sceneRevision, revision);
      assert.equal(app.getSnapshot().simulationState, "paused");
    } finally {
      release?.(false);
      app.dispose();
    }
  });

for (const action of ["run", "recordToggle"] as const)
  test(`review 4: Pause wins while ${action} awaits preview shutdown`, async () => {
    const { app, r } = await rig();
    let release!: () => void;
    const stop = r.staticPreview.stop;
    r.staticPreview.stop = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    try {
      await app.dispatch({ type: "pause" });
      const starting = app.dispatch({ type: action });
      await app.dispatch({ type: "pause" });
      release();
      await starting;
      assert.equal(app.getSnapshot().simulationState, "paused");
      assert.equal(app.getSnapshot().pauseReason, "使用者暫停");
      assert.notEqual(app.getSnapshot().recording.state, "recording");
    } finally {
      r.staticPreview.stop = stop;
      release?.();
      app.dispose();
    }
  });

test("review 5: Grab during preview clears it before acquiring the target", async () => {
  const { app, host } = await rig();
  try {
    const camera = app.getFPSCamera()!;
    await app.dispatch({ type: "pause" });
    await app.dispatch({
      type: "patchObject",
      objectId: "ball",
      patch: {
        positionM: [camera.positionM[0], camera.positionM[1], camera.positionM[2] - 1.5],
        mode: "dynamicNoGravity",
      },
    });
    await app.dispatch({ type: "run" });
    await app.dispatch({ type: "startPlacement" });
    assert.ok(host.snapshot().ghost);
    await app.dispatch({ type: "grab" });
    assert.equal(host.snapshot().heldObjectId, "ball");
    assert.equal(host.snapshot().ghost, null);
    host.handlePointer(0, false);
    host.handlePointer(0, true);
    assert.equal(
      host.snapshot().heldObjectId,
      null,
      "fresh left press throws instead of cancelling preview",
    );
  } finally {
    app.dispose();
  }
});

test("review 4: Pause during recording stop preserves pause and still restores the interactive clock", async () => {
  const { app, r } = await rig();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stop = r.recorder.stop.bind(r.recorder);
  try {
    await app.dispatch({ type: "recordToggle" });
    app.advance(1 / 60);
    r.recorder.stop = async () => {
      await gate;
      await stop();
    };
    const stopping = app.dispatch({ type: "recordToggle" });
    await turn();
    await app.dispatch({ type: "pause" });
    release();
    await stopping;
    assert.equal(r.world.paused, true);
    assert.equal(r.world.clock.mode, "interactive");
    assert.equal(app.getSnapshot().recording.state, "finalized");
  } finally {
    release();
    r.recorder.stop = stop;
    app.dispose();
  }
});

test("review 6: a throwing placement observer never pins pending or staged", async () => {
  const { app, host, options } = await rig();
  const change = options.onChange;
  try {
    host.startPreview();
    let once = true;
    options.onChange = () => {
      if (once) {
        once = false;
        throw new Error("observer failed");
      }
      change?.();
    };
    await host.place().catch(() => false);
    assert.equal(host.snapshot().pending, false);
    assert.equal(host.snapshot().staged, null);
    assert.equal(host.resume(), true);
  } finally {
    options.onChange = change;
    app.dispose();
  }
});

test("review 6: unresponsive physics preparation times out, unlocks Resume and rejects its late result", async () => {
  const { app, r, host, options } = await rig();
  const create = PhysicsWorld.create;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  PhysicsWorld.create = async (...args: Parameters<typeof create>) => {
    await gate;
    return create(...args);
  };
  options.placementTimeoutMs = 20;
  try {
    const revision = r.scene.sceneRevision;
    await released(r);
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(host.snapshot().pending, false);
    assert.match(app.getSnapshot().notice ?? "", /PLACEMENT_TIMEOUT/);
    assert.equal(host.resume(), true);
    release();
    await turn();
    await turn();
    assert.equal(r.scene.sceneRevision, revision);
  } finally {
    release();
    PhysicsWorld.create = create;
    app.dispose();
  }
});

test("review 6: right-release catches an observer rejection after transaction cleanup", async () => {
  const { app, r, host, options } = await rig();
  const change = options.onChange;
  let failed = false;
  try {
    options.onChange = () => {
      if (host.snapshot().pending && !failed) {
        failed = true;
        throw new Error("right-release observer failed");
      }
      change?.();
    };
    await released(r);
    await settled(host);
    assert.equal(failed, true);
    assert.equal(host.snapshot().staged, null);
    assert.match(host.snapshot().notice ?? "", /observer failed/);
    assert.equal(host.resume(), true);
  } finally {
    options.onChange = change;
    app.dispose();
  }
});

test("review 6: explicit Cancel releases a busy placement without waiting for acknowledgement", async () => {
  const { app, host, options } = await rig();
  options.confirmGeometry = () => new Promise<boolean>(() => {});
  let placing: Promise<void> | undefined;
  try {
    await app.dispatch({ type: "startPlacement" });
    placing = app.dispatch({ type: "place" });
    assert.equal(host.snapshot().pending, true);
    await app.dispatch({ type: "cancelPlacement" });
    await turn();
    assert.equal(host.snapshot().pending, false);
    await placing;
    assert.equal(host.snapshot().ghost, null);
    assert.equal(host.resume(), true);
  } finally {
    await app.dispatch({ type: "pause" });
    await placing;
    app.dispose();
  }
});

test("review 7: pending placement keeps movement and look responsive", async () => {
  const { app, r, host, options } = await rig();
  let release!: (value: boolean) => void;
  options.confirmGeometry = () =>
    new Promise<boolean>((resolve) => {
      release = resolve;
    });
  try {
    await released(r);
    const camera = app.getFPSCamera()!;
    host.setRotationToggle(true);
    host.handleLook(30, 0);
    host.handleKey("KeyW", true);
    app.advance(0.05);
    assert.notDeepEqual(app.getFPSCamera()!.orientationQuaternion, camera.orientationQuaternion);
    assert.notDeepEqual(app.getFPSCamera()!.positionM, camera.positionM);
    assert.equal(host.grab(), false, "object actions stay gated");
  } finally {
    release?.(false);
    app.dispose();
  }
});

test("review 7: geometry acknowledgement precedes commit without restarting acoustic service", async () => {
  const { app, r, host, options } = await rig();
  const cancel = r.acoustics.cancel.bind(r.acoustics);
  const reasons: string[] = [];
  r.acoustics.cancel = (reason: string) => {
    reasons.push(reason);
    return cancel(reason);
  };
  let acknowledged = false;
  const ack = options.confirmGeometry;
  options.confirmGeometry = async (...args: any[]) => {
    const result = await ack(...args);
    acknowledged = true;
    return result;
  };
  const apply = r.world.applyScene.bind(r.world);
  r.world.applyScene = (scene: any) => {
    assert.equal(acknowledged, true);
    apply(scene);
  };
  try {
    await released(r);
    await settled(host);
    assert.equal(reasons.includes("PLACEMENT_GEOMETRY_CHANGED"), false);
  } finally {
    app.dispose();
  }
});
