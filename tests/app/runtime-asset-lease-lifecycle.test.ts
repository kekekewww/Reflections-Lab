import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { NativeOfflineRenderBackend } from "../../src/audio/render-backend.js";
import type { AssetHost } from "../../src/app/asset-host.js";
import type { AudioAssetLease } from "../../src/audio/asset-leases.js";
import type { RecordingHost } from "../../src/app/recording-host.js";
import type { BlobStore } from "../../src/persistence/blob-store.js";
import type { LabAction } from "../../src/ui/contracts.js";

const DT = 1 / 60;
interface RuntimeAccess {
  assetHost: AssetHost;
  recorder: RecordingHost;
  blobStore: BlobStore;
}
function access(app: LabRuntime): RuntimeAccess {
  return app as unknown as RuntimeAccess;
}
function deferred() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open, entered: false };
}
async function poll(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !check(); attempt++)
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
}
async function command(app: LabRuntime, action: LabAction): Promise<void> {
  await app.dispatch(action);
  assert.equal(app.getSnapshot().error, "", `public ${action.type} must succeed`);
}
async function steps(app: LabRuntime, count = 2): Promise<void> {
  for (let index = 0; index < count; index++) {
    app.advance(DT);
    await app.flushRecordingEvaluation();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
function observeLeases(app: LabRuntime, gate?: ReturnType<typeof deferred>) {
  const owner = access(app).assetHost;
  const original = owner.acquireAssetBank.bind(owner);
  const calls: {
    lease: AudioAssetLease;
    reason: string;
    assetIds: readonly string[] | undefined;
  }[] = [];
  owner.acquireAssetBank = async (reason = "offline", assetIds) => {
    const lease = await original(reason, assetIds);
    calls.push({ lease, reason, assetIds });
    if (gate) {
      gate.entered = true;
      await gate.promise;
    }
    return lease;
  };
  return {
    owner,
    calls,
    active(): AudioAssetLease {
      assert.ok(
        calls.length > 0,
        "runtime must acquire a scoped AssetHost lease before this operation",
      );
      const lease = calls.at(-1)!.lease;
      assert.equal(
        lease.released,
        false,
        "runtime must keep the real lease while work owns its assets",
      );
      assert.deepEqual(
        lease.entries,
        [],
        "default tone is a generator descriptor, not decoded PCM",
      );
      assert.equal(
        owner.getResidency().leaseCount,
        1,
        "an empty PCM selection is still a real tracked borrow",
      );
      return lease;
    },
    // Failure cleanup only: assertions above and below observe production release first.
    cleanup() {
      for (const { lease } of calls) lease.release();
    },
  };
}
function holdPersistence(app: LabRuntime) {
  const owner = access(app).blobStore,
    original = owner.saveRecording.bind(owner),
    gate = deferred();
  owner.saveRecording = async (...args) => {
    gate.entered = true;
    await gate.promise;
    return original(...args);
  };
  return gate;
}
async function take(app: LabRuntime): Promise<void> {
  await app.captureShortTake(0.1);
  assert.equal(app.getRecordingArtifact()?.frameCount, 6);
}

test("runtime short take holds a real asset lease through capture evaluation and releases after completion", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const spy = observeLeases(app),
    gate = deferred(),
    recorder = access(app).recorder;
  const originalFlush = recorder.flushEvaluation.bind(recorder);
  let first = true;
  recorder.flushEvaluation = async () => {
    await originalFlush();
    if (first) {
      first = false;
      gate.entered = true;
      await gate.promise;
    }
  };
  const capturing = app.captureShortTake(0.1);
  try {
    await poll(() => gate.entered);
    assert.equal(gate.entered, true, "a real capture tick must reach the evaluation boundary");
    const lease = spy.active();
    assert.equal(recorder.getView().recording.state, "recording");
    gate.open();
    await capturing;
    assert.equal(app.getRecordingArtifact()?.frameCount, 6);
    assert.equal(lease.released, true);
    assert.equal(spy.owner.getResidency().leaseCount, 0);
  } finally {
    gate.open();
    await capturing.catch(() => {});
    app.dispose();
    spy.cleanup();
  }
});

for (const boundary of ["stop", "reset", "authoring drain", "mode change", "capture A"] as const) {
  test(`runtime recording lease survives persistence and releases on ${boundary}`, async () => {
    const app = await LabRuntime.create({ useWorker: false });
    const spy = observeLeases(app);
    let gate: ReturnType<typeof deferred> | undefined, ending: Promise<void> | undefined;
    try {
      await command(app, { type: "recordToggle" });
      assert.equal(app.getSnapshot().recording.state, "recording");
      const lease = spy.active();
      await steps(app);
      gate = holdPersistence(app);
      const action: LabAction =
        boundary === "stop"
          ? { type: "recordToggle" }
          : boundary === "reset"
            ? { type: "reset" }
            : boundary === "capture A"
              ? { type: "captureComparison", slot: "A" }
              : boundary === "mode change"
                ? { type: "patchObject", objectId: "ball", patch: { mode: "dynamicNoGravity" } }
                : { type: "patchObject", objectId: "ball", patch: { massKg: 2 } };
      let settled = false;
      ending = app.dispatch(action).finally(() => {
        settled = true;
      });
      await poll(() => gate!.entered || settled);
      assert.equal(gate.entered, true, `${boundary} must reach the real persistence boundary`);
      assert.equal(lease.released, false, "pending seal/persistence must retain its asset lease");
      gate.open();
      await ending;
      assert.equal(app.getSnapshot().error, "");
      assert.notEqual(app.getSnapshot().recording.state, "recording");
      assert.equal(lease.released, true);
      assert.equal(spy.owner.getResidency().leaseCount, 0);
    } finally {
      gate?.open();
      await ending?.catch(() => {});
      app.dispose();
      spy.cleanup();
    }
  });
}

for (const boundary of ["stopReplay", "dispose"] as const) {
  test(`runtime replay owns its asset lease until ${boundary}`, async () => {
    const app = await LabRuntime.create({ useWorker: false });
    let spy: ReturnType<typeof observeLeases> | undefined;
    try {
      await take(app);
      spy = observeLeases(app);
      await command(app, { type: "replay" });
      assert.equal(app.getSnapshot().recording.state, "replaying");
      const lease = spy.active();
      await steps(app, 1);
      assert.equal(lease.released, false);
      if (boundary === "dispose") app.dispose();
      else await command(app, { type: "stopReplay" });
      assert.equal(lease.released, true);
      assert.equal(spy.owner.getResidency().leaseCount, 0);
    } finally {
      app.dispose();
      spy?.cleanup();
    }
  });
}

for (const operation of ["short take", "recordToggle", "replay"] as const) {
  test(`late ${operation} asset acquisition after runtime disposal releases and cannot start`, async () => {
    const app = await LabRuntime.create({ useWorker: false });
    if (operation === "replay") await take(app);
    const gate = deferred(),
      spy = observeLeases(app, gate),
      recorder = access(app).recorder;
    let starts = 0;
    const originalStart = recorder.start.bind(recorder),
      originalReplay = recorder.replay.bind(recorder);
    recorder.start = () => {
      starts++;
      return originalStart();
    };
    recorder.replay = async (...args) => {
      starts++;
      return originalReplay(...args);
    };
    let settled = false;
    const pending = (
      operation === "short take" ? app.captureShortTake(0.1) : app.dispatch({ type: operation })
    ).then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    try {
      await poll(() => gate.entered || settled);
      assert.equal(
        gate.entered,
        true,
        "the async scoped borrow must be entered before transport starts",
      );
      const lease = spy.active();
      assert.equal(
        starts,
        0,
        "record/replay cannot start while its assets are still being acquired",
      );
      app.dispose();
      gate.open();
      await pending;
      assert.equal(lease.released, true, "a lease arriving after disposal must be returned");
      assert.equal(spy.owner.getResidency().leaseCount, 0);
      assert.equal(starts, 0, "late acquisition cannot start a disposed recorder or replay");
    } finally {
      gate.open();
      await pending;
      app.dispose();
      spy.cleanup();
    }
  });
}

test("runtime-created RenderHost borrows scoped assets and releases after Node offline failure", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const gate = deferred(),
    originalRender = NativeOfflineRenderBackend.prototype.render;
  let spy: ReturnType<typeof observeLeases> | undefined, rendering: Promise<unknown> | undefined;
  NativeOfflineRenderBackend.prototype.render = async function (...args) {
    gate.entered = true;
    await gate.promise;
    return originalRender.call(this, ...args);
  };
  try {
    await take(app);
    spy = observeLeases(app);
    assert.equal(
      typeof globalThis.OfflineAudioContext,
      "undefined",
      "Node fixture has no native offline renderer",
    );
    let settled = false;
    rendering = app
      .getRenderHost()
      .renderPreset()
      .then(
        (value) => {
          settled = true;
          return { status: value.status };
        },
        () => {
          settled = true;
          return { status: "rejected" };
        },
      );
    await poll(() => gate.entered || settled);
    assert.equal(
      gate.entered,
      true,
      "real render preparation must reach its native-backend boundary",
    );
    const lease = spy.active();
    assert.equal(settled, false, "the real render is held before Node native-context failure");
    gate.open();
    const result = (await rendering) as { status: string };
    assert.notEqual(result.status, "completed", "this test does not provide native PCM evidence");
    assert.equal(
      lease.released,
      true,
      "the runtime-created host must release only after rendering settles",
    );
    assert.ok(spy.calls.every(({ lease }) => lease.released));
    assert.equal(spy.owner.getResidency().leaseCount, 0);
    assert.equal(app.getRenderHost().getSnapshot().outputs.length, 0);
  } finally {
    gate.open();
    await rendering;
    NativeOfflineRenderBackend.prototype.render = originalRender;
    app.dispose();
    spy?.cleanup();
  }
});

test("runtime-created RenderHost returns a late lease when runtime is disposed during acquisition", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  await take(app);
  const gate = deferred(),
    spy = observeLeases(app, gate);
  let settled = false;
  const rendering = app
    .getRenderHost()
    .renderPreset()
    .then(
      (value) => {
        settled = true;
        return value.status;
      },
      () => {
        settled = true;
        return "rejected";
      },
    );
  try {
    await poll(() => gate.entered || settled);
    assert.equal(
      gate.entered,
      true,
      "runtime-created RenderHost must enter the scoped async borrow",
    );
    const lease = spy.active();
    app.dispose();
    gate.open();
    assert.notEqual(await rendering, "completed");
    assert.equal(lease.released, true);
    assert.equal(spy.owner.getResidency().leaseCount, 0);
    assert.equal(app.getRenderHost().getSnapshot().outputs.length, 0);
  } finally {
    gate.open();
    await rendering;
    app.dispose();
    spy.cleanup();
  }
});

for (const action of [{ type: "reset" }, { type: "captureComparison", slot: "A" }] as const) {
  test(`runtime releases completed recording assets after ${action.type} persistence fails`, async () => {
    const app = await LabRuntime.create({ useWorker: false });
    const spy = observeLeases(app);
    try {
      await command(app, { type: "recordToggle" });
      const lease = spy.active();
      await steps(app);
      access(app).blobStore.saveRecording = async () => {
        throw new Error("TEST_STORAGE_QUOTA");
      };
      await app.dispatch(action);
      assert.match(app.getSnapshot().error ?? "", /TEST_STORAGE_QUOTA/);
      assert.notEqual(
        app.getSnapshot().recording.state,
        "recording",
        "finalize must already have completed",
      );
      assert.equal(lease.released, true, "failed persistence has no remaining capture borrower");
      assert.equal(spy.owner.getResidency().leaseCount, 0);
    } finally {
      app.dispose();
      spy.cleanup();
    }
  });
}

test("rejected B capture retains the active recording asset lease", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const spy = observeLeases(app);
  try {
    await command(app, { type: "recordToggle" });
    const lease = spy.active();
    await steps(app);
    await app.dispatch({ type: "captureComparison", slot: "B" });
    assert.match(app.getSnapshot().error ?? "", /請先完成錄製/);
    assert.equal(app.getSnapshot().recording.state, "recording");
    assert.equal(lease.released, false, "a refused comparison cannot release an ongoing capture");
    assert.equal(spy.owner.getResidency().leaseCount, 1);
  } finally {
    app.dispose();
    spy.cleanup();
  }
});
