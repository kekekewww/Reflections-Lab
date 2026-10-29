import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { StaticPreviewHost, type CapturedPreviewContact } from "../../src/app/static-preview.js";
import { AudioEngine } from "../../src/audio/engine.js";
import type { BehaviorRuntime } from "../../src/audio-behavior/types.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";

interface RuntimeProbe {
  audio: AudioEngine | null;
  staticPreview: StaticPreviewHost;
  previewContacts: Map<string, CapturedPreviewContact>;
  behavior: BehaviorRuntime;
  world: object;
  runEpoch: string;
  publish(): void;
}

async function fixture() {
  const app = await LabRuntime.create({ useWorker: false });
  const probe = app as unknown as RuntimeProbe;
  const sourceContext = new FakeAudioContext();
  const source = new AudioEngine({ context: sourceContext.asContext() });
  await source.enable(0);
  source.setMuted(true);
  source.setMonitorGain(0.12);
  await source.pause(0);
  const contexts: FakeAudioContext[] = [];
  probe.audio = source;
  probe.staticPreview.dispose();
  probe.staticPreview = new StaticPreviewHost({
    getEngine: () => source,
    createEngine: (options) => {
      const context = new FakeAudioContext();
      contexts.push(context);
      return new AudioEngine({ ...options, context: context.asContext() });
    },
    onChanged: () => probe.publish(),
  });
  probe.publish();
  return { app, probe, source, sourceContext, contexts };
}

function originalState(app: LabRuntime, probe: RuntimeProbe) {
  const view = app.getSnapshot();
  return {
    scene: app.getSceneDocument(),
    behaviorDocument: app.getBehaviorDocument(),
    state: probe.behavior.snapshot(),
    runEpoch: probe.runEpoch,
    tick: view.tick,
    runId: view.runId,
    events: view.events,
    recording: view.recording,
    comparison: view.comparison,
    artifact: app.getRecordingArtifact(),
  };
}

test("public rule preview preserves original run/scene/behavior/recording and monitor mute", async () => {
  const { app, probe, source, contexts } = await fixture();
  try {
    const original = originalState(app, probe);
    const world = probe.world;
    await app.dispatch({
      type: "previewRule",
      objectId: "speaker",
      bindingId: "binding.continuous.speaker",
      ruleId: "rule.always",
    });
    assert.equal(app.getSnapshot().preview?.status, "playing");
    assert.equal(app.getSnapshot().preview?.muted, true);
    assert.equal(app.getSnapshot().preview?.monitorGain, 0.12);
    assert.equal(source.getTelemetry().muted, true);
    assert.equal(contexts[0]!.sources().length, 1);
    assert.equal(probe.world, world);
    assert.deepEqual(originalState(app, probe), original);
    await app.dispatch({ type: "setMonitorGain", gainLinear: 0.08 });
    await app.dispatch({ type: "setMonitorMode", mode: "raw" });
    assert.equal(app.getSnapshot().preview?.monitorMode, "raw");
    assert.equal(app.getSnapshot().preview?.monitorGain, 0.08);
    assert.equal(contexts[0]!.sources().length, 1);
    await app.dispatch({ type: "stopPreview" });
    assert.equal(app.getSnapshot().preview?.status, "stopped");
    assert.deepEqual(originalState(app, probe), original);
  } finally {
    app.dispose();
  }
});

test("Run and Recording reject raw/scene previews and Run stops a prior independent preview", async () => {
  const { app, contexts } = await fixture();
  try {
    const preview = {
      type: "previewRule" as const,
      objectId: "speaker",
      bindingId: "binding.continuous.speaker",
      ruleId: "rule.always",
    };
    await app.dispatch(preview);
    await app.dispatch({ type: "run" });
    assert.equal(app.getSnapshot().preview?.status, "stopped");
    assert.equal(contexts[0]!.sources()[0]!.connections.length, 0);
    const count = contexts.length;
    await app.dispatch(preview);
    assert.match(app.getSnapshot().error ?? "", /PREVIEW_REQUIRES_PAUSE/);
    await app.dispatch({ type: "audition", assetId: "asset.not-needed-for-gate" });
    assert.match(app.getSnapshot().error ?? "", /PREVIEW_REQUIRES_PAUSE/);
    assert.equal(contexts.length, count);
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "recordToggle" });
    await app.dispatch(preview);
    assert.match(app.getSnapshot().error ?? "", /PREVIEW_REQUIRES_PAUSE/);
    await app.dispatch({ type: "audition", assetId: "asset.not-needed-for-gate" });
    assert.match(app.getSnapshot().error ?? "", /PREVIEW_REQUIRES_PAUSE/);
    assert.equal(contexts.length, count);
  } finally {
    app.dispose();
  }
});

test("real Rapier contact selection previews exact accepted point and authoring invalidates retained capture", async () => {
  const { app, probe } = await fixture();
  try {
    const preview = {
      type: "previewRule" as const,
      objectId: "ball",
      bindingId: "binding.interactive.ball",
      ruleId: "rule.impact",
    };
    await app.dispatch(preview);
    assert.match(app.getSnapshot().error ?? "", /CONTACT_EVENT_REQUIRED/);
    await app.dispatch({ type: "run" });
    for (let tick = 0; tick < 120; tick++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const event = app
      .getSnapshot()
      .events.find((value) => value.type === "OnImpact" && value.decision?.action === "start");
    assert.ok(event?.positionM);
    assert.ok(probe.previewContacts.size > 0 && probe.previewContacts.size <= 64);
    assert.equal(
      new Set([...probe.previewContacts.values()].map((value) => value.behaviorDocument)).size,
      1,
    );
    await app.dispatch({ type: "selectEvent", eventId: event.id });
    const original = originalState(app, probe);
    await app.dispatch(preview);
    const view = app.getSnapshot();
    assert.equal(view.preview?.status, "playing");
    assert.equal(view.preview?.metadata?.source.origin, "capturedContact");
    assert.deepEqual(view.preview?.metadata?.source.positionM, event.positionM);
    assert.equal(view.preview?.metadata?.contact?.audioEventId, event.id);
    assert.deepEqual(originalState(app, probe), original);
    await app.dispatch({
      type: "setBindingOverride",
      objectId: "ball",
      ruleId: "rule.impact",
      override: { gainLinear: 0.2 },
    });
    assert.equal(app.getSnapshot().preview?.status, "stopped");
    assert.equal(probe.previewContacts.size, 0);
    await app.dispatch(preview);
    assert.match(app.getSnapshot().error ?? "", /CONTACT_EVENT_REQUIRED/);
  } finally {
    app.dispose();
  }
});

test("paused recording permits isolated preview while replay requires an explicit return to live scene", async () => {
  const { app, probe } = await fixture();
  try {
    const action = {
      type: "previewRule" as const,
      objectId: "speaker",
      bindingId: "binding.continuous.speaker",
      ruleId: "rule.always",
    };
    await app.dispatch({ type: "recordToggle" });
    for (let tick = 0; tick < 3; tick++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const original = originalState(app, probe);
    await app.dispatch(action);
    assert.equal(app.getSnapshot().preview?.status, "playing");
    assert.deepEqual(originalState(app, probe), original);
    await app.dispatch({ type: "recordToggle" });
    assert.equal(app.getSnapshot().preview?.status, "stopped");
    await app.dispatch({ type: "replay" });
    await app.dispatch({ type: "pause" });
    assert.equal(app.getSnapshot().recording.state, "replaying");
    await app.dispatch(action);
    assert.match(app.getSnapshot().error ?? "", /PREVIEW_STOP_REPLAY_REQUIRED/);
    await app.dispatch({ type: "audition", assetId: "asset.not-needed-for-gate" });
    assert.match(app.getSnapshot().error ?? "", /PREVIEW_STOP_REPLAY_REQUIRED/);
  } finally {
    app.dispose();
  }
});

test("immediate Stop and blur cancel scene-preview preflight before any late source starts", async () => {
  for (const cancel of ["stopPreview", "inputBlur"] as const) {
    for (const action of [
      {
        type: "previewRule" as const,
        objectId: "speaker",
        bindingId: "binding.continuous.speaker",
        ruleId: "rule.always",
      },
      { type: "audition" as const, assetId: "not-needed-after-cancellation" },
    ]) {
      const { app, contexts } = await fixture();
      try {
        const start = app.dispatch(action);
        await app.dispatch({ type: cancel });
        await start;
        assert.notEqual(app.getSnapshot().preview?.status, "playing");
        assert.equal(
          contexts.reduce((sum, context) => sum + context.sources().length, 0),
          0,
        );
        assert.equal(app.getSnapshot().error, "");
      } finally {
        app.dispose();
      }
    }
  }
});

test("runtime disposal cancels preview preflight without creating another device source", async () => {
  const { app, contexts } = await fixture();
  const start = app.dispatch({
    type: "previewRule",
    objectId: "speaker",
    bindingId: "binding.continuous.speaker",
    ruleId: "rule.always",
  });
  app.dispose();
  await start;
  assert.equal(contexts.length, 0);
});

test("a selected raw physics contact resolves the requested layer rather than another matching rule", async () => {
  const { app, probe } = await fixture();
  try {
    await app.dispatch({ type: "addRule", objectId: "ball", trigger: "OnImpact" });
    await app.dispatch({ type: "run" });
    for (let tick = 0; tick < 100; tick++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const captured = [...probe.previewContacts.values()].find(
      (value) => value.voice.event.ruleId === "rule.impact",
    )!;
    assert.ok(captured);
    assert.equal(
      [...probe.previewContacts.values()].filter(
        (value) => value.inputEvent.eventId === captured.inputEvent.eventId,
      ).length,
      2,
    );
    await app.dispatch({ type: "selectEvent", eventId: captured.inputEvent.eventId });
    await app.dispatch({
      type: "previewRule",
      objectId: "ball",
      bindingId: "binding.interactive.ball",
      ruleId: "rule.impact",
    });
    assert.equal(app.getSnapshot().preview?.status, "playing");
    assert.equal(app.getSnapshot().preview?.metadata?.ruleId, "rule.impact");
    assert.equal(
      app.getSnapshot().preview?.metadata?.contact?.audioEventId,
      captured.voice.event.eventId,
    );
  } finally {
    app.dispose();
  }
});
