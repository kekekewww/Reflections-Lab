import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import type { RecordingArtifact } from "../../src/experiments/types.js";
import { createDefaultScene } from "../../src/app/defaults.js";

async function prefix(): Promise<RecordingArtifact> {
  const scene = createDefaultScene();
  const recorder = new ExperimentRecorder({
    runId: "run.recovery-fixture",
    runEpoch: "epoch.recovery-fixture",
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: {},
    solverConfig: {},
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [],
    physicsVersion: "test",
    backendVersion: "test",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
    createdAt: "2026-11-02T18:00:00.000Z",
  });
  recorder.appendFrame({
    tick: 0,
    sceneRevision: scene.sceneRevision,
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: object.positionM,
      orientationQuaternion: object.orientationQuaternion,
    })),
    listener: scene.listener,
    physicsEvents: [],
    behaviorDecisions: [],
    audioEvents: [],
  });
  recorder.interrupt("TEST_CRASH_PREFIX");
  return recorder.finish();
}
async function setup(load?: () => Promise<RecordingArtifact>) {
  const artifact = await prefix();
  const row = {
    sessionId: "session.recovery",
    runId: artifact.runId,
    runEpoch: artifact.runEpoch,
    sceneRevision: artifact.configuration.sceneSnapshot.sceneRevision,
    state: "interrupted" as "staging" | "interrupted",
    persistedFrames: artifact.frameCount,
    persistedTick: artifact.endTick,
    reservedBytes: 4096,
    reason: "TEST_CRASH_PREFIX",
    leaseExpiresAt: 0,
  };
  const rows = [row];
  const calls = { recover: 0, discard: 0 };
  const store = Object.assign(new BlobStore({ indexedDB: null }), {
    listRecordingRecovery: async () => structuredClone(rows),
    recoverRecording: async (_sessionId: string) => {
      calls.recover++;
      return load ? load() : artifact;
    },
    discardRecordingRecovery: async (_sessionId: string) => {
      calls.discard++;
      rows.length = 0;
    },
  });
  const app = await LabRuntime.create({ useWorker: false, blobStore: store });
  return { app, store, artifact, row, rows, calls };
}

test("recovery capabilities preserve active writer authority and paused-state requirements", async () => {
  const f = await setup();
  try {
    assert.equal((await f.app.listRecordingRecovery())[0]?.canRecover, true);
    f.row.state = "staging";
    f.row.leaseExpiresAt = Date.now() + 60_000;
    const active = (await f.app.listRecordingRecovery())[0]!;
    assert.equal(active.canRecover, false);
    assert.equal(active.canDiscard, false);
    await assert.rejects(f.app.recoverRecording(f.row.sessionId), /RECOVERY_ACTIVE/);
    await assert.rejects(f.app.discardRecordingRecovery(f.row.sessionId), /RECOVERY_ACTIVE/);
    assert.deepEqual(f.calls, { recover: 0, discard: 0 });
    f.row.state = "interrupted";
    f.row.leaseExpiresAt = 0;
    await f.app.dispatch({ type: "run" });
    assert.equal((await f.app.listRecordingRecovery())[0]?.canRecover, false);
    await assert.rejects(f.app.recoverRecording(f.row.sessionId), /RECOVERY_UNSAFE/);
    await assert.rejects(f.app.discardRecordingRecovery(f.row.sessionId), /RECOVERY_UNSAFE/);
  } finally {
    f.app.dispose();
    f.store.close();
  }
});

test("recovering a verified prefix preserves interrupted status, scene, and render exclusion", async () => {
  const f = await setup();
  try {
    const before = f.app.getSceneDocument();
    await f.app.recoverRecording(f.row.sessionId);
    const recovered = f.app.getRecordingArtifact();
    assert.ok(recovered);
    assert.equal(recovered.status, "interrupted");
    assert.equal(recovered.artifactSha256, f.artifact.artifactSha256);
    assert.equal(f.app.getSnapshot().recording.canReplay, false);
    assert.equal(f.app.getRenderHost().getSnapshot().recordingAvailable, false);
    assert.deepEqual(f.app.getSceneDocument(), before);
    await f.app.discardRecordingRecovery(f.row.sessionId);
    assert.equal(f.calls.discard, 1);
    assert.equal(f.app.getRecordingArtifact()?.artifactSha256, f.artifact.artifactSha256);
  } finally {
    f.app.dispose();
    f.store.close();
  }
});

test("a pending recovery blocks overlapping capture and replacement", async () => {
  let resolveLoad!: (artifact: RecordingArtifact) => void;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const gate = new Promise<RecordingArtifact>((resolve) => {
    resolveLoad = resolve;
  });
  const f = await setup(async () => {
    signalStarted();
    return gate;
  });
  try {
    const pending = f.app.recoverRecording(f.row.sessionId);
    await started;
    await assert.rejects(f.app.recoverRecording(f.row.sessionId), /RECOVERY_UNSAFE/);
    await assert.rejects(f.app.captureShortTake(0.1), /SHORT_TAKE_BUSY/);
    resolveLoad(f.artifact);
    await pending;
    assert.equal(f.calls.recover, 1);
  } finally {
    resolveLoad?.(f.artifact);
    f.app.dispose();
    f.store.close();
  }
});

test("dispose during recovery cannot publish the late prefix", async () => {
  let resolveLoad!: (artifact: RecordingArtifact) => void;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const gate = new Promise<RecordingArtifact>((resolve) => {
    resolveLoad = resolve;
  });
  const f = await setup(async () => {
    signalStarted();
    return gate;
  });
  try {
    const pending = f.app.recoverRecording(f.row.sessionId);
    await started;
    f.app.dispose();
    resolveLoad(f.artifact);
    await assert.rejects(pending, /DISPOSED/);
    assert.equal(f.app.getRecordingArtifact(), null);
  } finally {
    resolveLoad?.(f.artifact);
    f.app.dispose();
    f.store.close();
  }
});
