import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { StaticPreviewHost } from "../../src/app/static-preview.js";
import { RecordingHost } from "../../src/app/recording-host.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import { recordedCursor } from "./fixtures/recorded-cursor.js";
import type { AssetStagingContext } from "../../src/app/asset-host.js";
import type { LabAction } from "../../src/ui/contracts.js";
import { verifyRecording } from "../../src/experiments/index.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";

const DT = 1 / 60;
function stagingContext(sampleRate: number): AssetStagingContext {
  const context = new FakeAudioContext();
  Object.defineProperty(context, "sampleRate", { value: sampleRate });
  return {
    sampleRate,
    createBuffer: context.createBuffer.bind(context) as AssetStagingContext["createBuffer"],
    decodeAudioData: (async (bytes: ArrayBuffer) => {
      const wave = new DataView(bytes);
      const channels = wave.getUint16(22, true);
      const frames = wave.getUint32(40, true) / wave.getUint16(32, true);
      return context.createBuffer(
        channels,
        Math.round((frames * sampleRate) / wave.getUint32(24, true)),
        sampleRate,
      );
    }) as AssetStagingContext["decodeAudioData"],
  };
}

async function fixture(run: (app: LabRuntime) => Promise<void>) {
  const app = await LabRuntime.create({ useWorker: false, assetStagingContext: stagingContext });
  try {
    await run(app);
  } finally {
    app.dispose();
  }
}
async function command(app: LabRuntime, action: LabAction) {
  await app.dispatch(action);
  assert.equal(app.getSnapshot().error, "", "public command " + action.type);
}
async function steps(app: LabRuntime, count: number, context?: FakeAudioContext) {
  for (let i = 0; i < count; i++) {
    if (context) context.currentTime += DT;
    app.advance(DT);
    await app.flushRecordingEvaluation();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
async function capture(app: LabRuntime, count = 8, context?: FakeAudioContext, pause = true) {
  await command(app, { type: "recordToggle" });
  await steps(app, count, context);
  await command(app, { type: "recordToggle" });
  if (pause) await command(app, { type: "pause" });
  const artifact = app.getRecordingArtifact()!;
  await verifyRecording(artifact);
  return artifact;
}
async function waitUntil(check: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("deferred public audio boundary did not start");
}

test("public finalized seek creates a paused replay, preserves late-capture time and the live world", async () => {
  await fixture(async (app) => {
    const scene = app.getSceneDocument();
    await command(app, { type: "run" });
    await steps(app, 5);
    const artifact = await capture(app, 8);
    await command(app, { type: "run" });
    await steps(app, 3);
    await command(app, { type: "pause" });
    const liveTick = app.getSnapshot().tick;
    const livePose = structuredClone(app.getPose("ball"));
    await command(app, { type: "seek", timeSeconds: 2 * DT });
    const target = artifact.frames[2]!;
    assert.equal(app.getSnapshot().recording.state, "replaying");
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(app.getSnapshot().tick, target.tick);
    assert.equal(app.getSnapshot().recording.replayTimeSeconds, 2 * DT);
    assert.deepEqual(
      app.getPose("ball")!.positionM,
      target.poses.find((pose) => pose.objectId === "ball")!.positionM,
    );
    await steps(app, 4);
    assert.equal(app.getSnapshot().tick, target.tick, "paused seek cannot advance either world");
    await command(app, { type: "run" });
    await steps(app, 1);
    assert.equal(app.getSnapshot().tick, target.tick + 1);
    await command(app, { type: "stopReplay" });
    assert.equal(app.getSnapshot().tick, liveTick);
    assert.deepEqual(app.getPose("ball"), livePose);
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.deepEqual(app.getSceneDocument(), scene);
    assert.equal(app.getRecordingArtifact()!.artifactSha256, artifact.artifactSha256);
  });
});

test("natural replay completion returns to the untouched paused live world and permits direct new recording", async () => {
  await fixture(async (app) => {
    const artifact = await capture(app);
    await command(app, { type: "run" });
    await steps(app, 3);
    await command(app, { type: "pause" });
    const liveTick = app.getSnapshot().tick;
    const livePose = structuredClone(app.getPose("ball"));
    await command(app, { type: "replay" });
    await steps(app, artifact.frameCount + 2);
    assert.equal(app.getSnapshot().recording.state, "finalized");
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(app.getSnapshot().tick, liveTick);
    assert.deepEqual(app.getPose("ball"), livePose);
    assert.equal(app.getSnapshot().error, "");
    await command(app, { type: "recordToggle" });
    await steps(app, 2);
    await command(app, { type: "recordToggle" });
    assert.equal(app.getRecordingArtifact()!.startTick, liveTick + 1);
    assert.notEqual(app.getRecordingArtifact()!.runId, artifact.runId);
    await verifyRecording(artifact);
  });
});

test("seek to the last frame remains a paused session until explicit exit or Resume", async () => {
  await fixture(async (app) => {
    const artifact = await capture(app);
    const liveTick = app.getSnapshot().tick;
    await command(app, {
      type: "seek",
      timeSeconds: (artifact.endTick! - artifact.startTick!) * DT,
    });
    assert.equal(app.getSnapshot().recording.state, "replaying");
    assert.equal(app.getSnapshot().simulationState, "paused");
    await steps(app, 4);
    assert.equal(
      app.getSnapshot().recording.state,
      "replaying",
      "paused last-frame preview is not natural playback completion",
    );
    await command(app, { type: "stopReplay" });
    assert.equal(app.getSnapshot().tick, liveTick);
    await command(app, {
      type: "seek",
      timeSeconds: (artifact.endTick! - artifact.startTick!) * DT,
    });
    await command(app, { type: "run" });
    await steps(app, 2);
    assert.equal(app.getSnapshot().recording.state, "finalized");
    assert.equal(app.getSnapshot().simulationState, "paused");
  });
});

test("pause while replay opens remains paused and explicit stop cancels an unopened session", async () => {
  await fixture(async (app) => {
    const artifact = await capture(app);
    const opening = app.dispatch({ type: "replay" });
    await app.dispatch({ type: "pause" });
    await opening;
    assert.equal(app.getSnapshot().error, "");
    assert.equal(app.getSnapshot().simulationState, "paused");
    const tick = app.getSnapshot().tick;
    await steps(app, 3);
    assert.equal(app.getSnapshot().tick, tick);
    await command(app, { type: "stopReplay" });
    const restarting = app.dispatch({ type: "replay" });
    const stopping = app.dispatch({ type: "stopReplay" });
    await Promise.all([restarting, stopping]);
    assert.equal(app.getSnapshot().error, "");
    assert.equal(app.getSnapshot().recording.state, "finalized");
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(app.getRecordingArtifact()!.artifactSha256, artifact.artifactSha256);
    await command(app, { type: "recordToggle" });
    await steps(app, 1);
    await command(app, { type: "recordToggle" });
  });
});

test("reset cancels an opening replay and disposal cannot publish late replay state", async () => {
  await fixture(async (app) => {
    await capture(app);
    const opening = app.dispatch({ type: "replay" });
    await app.dispatch({ type: "reset" });
    await opening;
    assert.equal(app.getSnapshot().error, "");
    assert.equal(app.getSnapshot().tick, 0);
    assert.notEqual(app.getSnapshot().simulationState, "running");
    app.advance(1);
    assert.equal(app.getSnapshot().tick, 0);
  });
  const app = await LabRuntime.create({ useWorker: false, assetStagingContext: stagingContext });
  await capture(app);
  let notifications = 0;
  app.subscribe(() => notifications++);
  const opening = app.dispatch({ type: "replay" });
  app.dispose();
  const atDispose = notifications;
  await opening;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(notifications, atDispose);
});

test("RecordingHost retains an ended or last-frame cursor as a session until explicit stop", async () => {
  await fixture(async (app) => {
    const artifact = await capture(app, 3);
    const host = new RecordingHost({
      getConfig: () => ({
        ...artifact.configuration,
        runId: "run.host",
        runEpoch: artifact.runEpoch,
      }),
    });
    try {
      await host.restoreArtifact(artifact);
      await host.replay();
      host.resume();
      for (let i = 0; i < artifact.frameCount; i++) assert.ok(host.nextReplay());
      assert.equal(host.nextReplay(), null);
      assert.equal(host.getView().recording.state, "replaying");
      host.pause();
      host.seek(artifact.endTick!);
      assert.equal(host.getView().recording.state, "replaying");
      host.stopReplay();
      assert.equal(host.getView().recording.state, "finalized");
      assert.equal(host.getArtifact()!.artifactSha256, artifact.artifactSha256);
    } finally {
      host.dispose();
    }
  });
});

test("clearError is non-destructive and does not release a paused interaction guard", async () => {
  await fixture(async (app) => {
    await command(app, { type: "run" });
    await steps(app, 2);
    await command(app, { type: "pause" });
    const before = app.getSnapshot();
    const scene = app.getSceneDocument();
    const pose = structuredClone(app.getPose("ball"));
    await app.dispatch({ type: "patchObject", objectId: "ball", patch: { massKg: -1 } });
    assert.ok(app.getSnapshot().error);
    await command(app, { type: "clearError" });
    assert.equal(app.getSnapshot().pauseReason, before.pauseReason);
    assert.equal(app.getSnapshot().notice, before.notice);
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(app.getSnapshot().tick, before.tick);
    assert.deepEqual(app.getSceneDocument(), scene);
    app.advance(1);
    assert.deepEqual(app.getPose("ball"), pose);
  });
});

test("native control graph: direct seek emits no source, cancellation cannot resume, and natural end restores the live cursor on Record", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      await command(app, { type: "enableAudio" });
      const context = contexts[0]!;
      const artifact = await capture(app, 8, context, false);
      const snapshot = artifact.frames.at(-1)!.behaviorSnapshot as RecordedBehaviorSnapshot;
      const instance = snapshot.runtimeSnapshot.state.instances.find(
        (item) => item.objectId === "speaker",
      )!;
      // The source starts inside this take, so its native history is complete.
      const cursor = recordedCursor(snapshot, instance.instanceId, "complete");
      const sourcesBefore = context.sources().length;
      await command(app, { type: "seek", timeSeconds: 2 * DT });
      assert.equal(
        context.sources().length,
        sourcesBefore,
        "paused seek must not briefly emit a new source",
      );
      assert.equal(app.getSnapshot().monitor.activeVoices, 0);
      await command(app, { type: "stopReplay" });
      let release: (() => void) | undefined;
      context.resume = () =>
        new Promise<void>((resolve) => {
          release = resolve;
        });
      const opening = app.dispatch({ type: "replay" });
      await waitUntil(() => Boolean(release));
      const stopping = app.dispatch({ type: "stopReplay" });
      release!();
      await Promise.all([opening, stopping]);
      assert.equal(app.getSnapshot().error, "");
      assert.equal(
        app.getSnapshot().monitor.activeVoices,
        0,
        "cancelled native Resume cannot restore old replay sources",
      );
      context.resume = async () => {
        context.state = "running";
      };
      await command(app, { type: "replay" });
      await steps(app, artifact.frameCount + 2, context);
      if (app.getSnapshot().recording.state === "replaying")
        assert.equal(
          app.getSnapshot().simulationState,
          "paused",
          "native closing keeps the transport paused until its drain finishes",
        );
      await waitUntil(() => app.getSnapshot().recording.state === "finalized");
      assert.equal(app.getSnapshot().recording.state, "finalized");
      assert.equal(
        app.getSnapshot().monitor.activeVoices,
        0,
        "natural end leaves live native content paused",
      );
      await command(app, { type: "recordToggle" });
      await steps(app, 1, context);
      await command(app, { type: "recordToggle" });
      const restored = app.getRecordingArtifact()!.frames[0]!
        .behaviorSnapshot as RecordedBehaviorSnapshot;
      const intent = restored.voiceIntents.find((item) => item.event.objectId === "speaker")!;
      assert.equal(intent.action, "update");
      assert.equal(intent.event.instanceId, instance.instanceId);
      assert.equal(
        restored.runtimeSnapshot.state.instances.find(
          (item) => item.instanceId === instance.instanceId,
        )!.startedAtTick,
        instance.startedAtTick,
      );
      // Restoring the live cursor restarts the paused source at its saved position.
      const resumedCursor = recordedCursor(restored, instance.instanceId, "incomplete");
      assert.ok(resumedCursor.playheadSeconds >= cursor.playheadSeconds);
      assert.ok(resumedCursor.playheadSeconds <= cursor.playheadSeconds + 2 * DT);
      assert.ok(app.getSnapshot().monitor.activeVoices > 0);
      await verifyRecording(artifact);
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

async function audioFixture(run: (app: LabRuntime, context: FakeAudioContext) => Promise<void>) {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      await command(app, { type: "enableAudio" });
      await run(app, contexts[0]!);
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
}

test("a genuine seek range error is reported and restores the paused live session", async () => {
  await fixture(async (app) => {
    const artifact = await capture(app, 4);
    const livePose = structuredClone(app.getPose("ball"));
    await app.dispatch({ type: "seek", timeSeconds: 1000 });
    assert.match(app.getSnapshot().error, /Seek tick 不在錄製範圍/);
    assert.equal(app.getSnapshot().recording.state, "finalized");
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.deepEqual(app.getPose("ball"), livePose);
    assert.equal(app.getRecordingArtifact()!.artifactSha256, artifact.artifactSha256);
    await command(app, { type: "clearError" });
    await command(app, { type: "seek", timeSeconds: 0 });
  });
});

test("reset waits for a deferred public preview-stop prelude before taking its transaction", async () => {
  await fixture(async (app) => {
    await capture(app, 4);
    const originalStop = StaticPreviewHost.prototype.stop;
    let release: (() => void) | undefined;
    let first = true;
    StaticPreviewHost.prototype.stop = function () {
      if (!first) return originalStop.call(this);
      first = false;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    try {
      const opening = app.dispatch({ type: "replay" });
      await waitUntil(() => Boolean(release));
      let resetComplete = false;
      const resetting = app.dispatch({ type: "reset" }).then(() => {
        resetComplete = true;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(
        resetComplete,
        false,
        "reset cannot report completion while opening still owns its transaction",
      );
      release!();
      await Promise.all([opening, resetting]);
      assert.equal(app.getSnapshot().error, "");
      assert.equal(app.getSnapshot().tick, 0);
      assert.notEqual(app.getSnapshot().recording.state, "replaying");
      assert.notEqual(app.getSnapshot().simulationState, "running");
    } finally {
      release?.();
      StaticPreviewHost.prototype.stop = originalStop;
    }
  });
});

test("a rejected native Resume is a visible failure rather than a swallowed cancellation", async () => {
  await audioFixture(async (app, context) => {
    const artifact = await capture(app, 4, context);
    context.resume = async () => {
      throw new Error("REPLAY_RESUME_FAILED");
    };
    await app.dispatch({ type: "replay" });
    assert.match(app.getSnapshot().error, /REPLAY_RESUME_FAILED/);
    assert.equal(app.getSnapshot().recording.state, "finalized");
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(app.getSnapshot().monitor.activeVoices, 0);
    assert.equal(app.getRecordingArtifact()!.artifactSha256, artifact.artifactSha256);
  });
});

test("a seeked timeline stays paused until deferred native Resume is complete", async () => {
  await audioFixture(async (app, context) => {
    await capture(app, 8, context);
    await command(app, { type: "seek", timeSeconds: 2 * DT });
    const tick = app.getSnapshot().tick;
    let release: (() => void) | undefined;
    context.resume = () =>
      new Promise<void>((resolve) => {
        release = () => {
          context.state = "running";
          resolve();
        };
      });
    const resuming = app.dispatch({ type: "run" });
    await waitUntil(() => Boolean(release));
    await steps(app, 3, context);
    assert.equal(
      app.getSnapshot().tick,
      tick,
      "RAF must not play captured frames before native Resume settles",
    );
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.equal(app.getSnapshot().error, "");
    release!();
    await resuming;
    assert.equal(app.getSnapshot().error, "");
    await steps(app, 1, context);
    assert.equal(app.getSnapshot().tick, tick + 1);
    await command(app, { type: "stopReplay" });
  });
});
