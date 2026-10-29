import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import type { ProjectDocument } from "../../src/persistence/types.js";
import { NativeAdmissionDiagnostics } from "../../src/app/behavior-diagnostics.js";
import { nativeRejectionText } from "../../src/ui/behavior-diagnostic-text.js";
import { translate } from "../../src/ui/locale-model.js";
import type { VoiceIntent } from "../../src/audio-behavior/types.js";
import type { VoiceInput } from "../../src/audio/types.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";

test("actual native rejection keeps the enqueued logical event after asynchronous updates and pause", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const context = new FakeAudioContext();
  // Explicitly constrained test-only capacity. Product defaults are unchanged.
  const engine = new AudioEngine({ context: context.asContext(), budget: { maxSources: 8 } });
  try {
    const project = JSON.parse(app.exportProject()) as ProjectDocument;
    const object = project.scene.objects.find((value) => value.id === "speaker")!;
    const source = project.scene.sources[0]!;
    const binding = project.soundBehaviors.bindings.find((value) => value.objectId === "speaker")!;
    for (let index = 1; index <= 8; index++) {
      const objectId = `speaker.${String(index).padStart(2, "0")}`;
      project.scene.objects.push({ ...object, id: objectId, positionM: [index, 1, -2] });
      project.scene.sources.push({ ...source, id: `source.${objectId}`, objectId });
      project.soundBehaviors.bindings.push({
        ...binding,
        bindingId: `binding.${objectId}`,
        objectId,
      });
    }
    await app.importProject(JSON.stringify(project));
    (app as unknown as { audio: AudioEngine }).audio = engine;
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    // Actual synchronous solver delivery resolves in a microtask after these fixed steps.
    app.advance(1 / 60);
    app.advance(1 / 60);
    app.advance(1 / 60);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(engine.getTelemetry().activeVoices, 8);
    assert.equal(engine.getTelemetry().droppedVoices, 1);
    const view = app.getSnapshot();
    assert.equal(view.events.filter((event) => event.decision?.action === "start").length, 9);
    assert.equal(view.events.filter((event) => event.decision?.action === "reject").length, 0);
    const rejected = view.events.find((event) => event.nativeRejection);
    assert.ok(rejected, "native rejection must retain a separate inspectable event association");
    const native = rejected.nativeRejection!;
    assert.equal(native.reason, "SOURCE_BUDGET");
    assert.equal(native.audioEventTick, 1);
    assert.equal(native.attemptedAtTick, 3);
    assert.equal(native.acousticPoseTick, 1);
    assert.equal(native.sourceId, native.instanceId);
    assert.equal(native.generation, 1);
    assert.equal(native.sceneRevision, project.scene.sceneRevision);
    assert.equal(native.behaviorDocumentRevision, project.soundBehaviors.revision);
    assert.ok(native.acousticRequestId);
    const original = view.events.find((event) => event.id === native.audioEventId)!;
    assert.equal(original.decision?.action, "start");
    assert.equal(original.decision?.instanceId, native.instanceId);
    assert.equal(original.decision?.bindingId, native.bindingId);
    assert.equal(original.objectId, native.objectId);
    assert.equal(original.ruleId, native.ruleId);
    assert.equal(original.suppressed, false, "logical admission remains an independent success");
    assert.equal(rejected.decision, undefined, "native failure is not an evaluator decision");
    assert.equal(
      rejected.suppressed,
      undefined,
      "native failure cannot rewrite a physics/behavior event",
    );
    const rule = view.behaviors.find((value) => value.bindingId === native.bindingId)!.rules[0]!;
    assert.equal(rule.diagnostic?.reason, "CONTINUOUS_UPDATE");
    assert.equal(rule.diagnostic?.tick, 3);
    assert.deepEqual(rule.nativeRejection, native);
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "save" });
    assert.ok(app.getSnapshot().pauseReason);
    assert.ok(!app.getSnapshot().notice?.includes("admission"));
    assert.deepEqual(
      app.getSnapshot().events.find((event) => event.id === rejected.id)?.nativeRejection,
      native,
    );
    assert.equal(
      JSON.stringify(JSON.parse(app.exportProject())).includes("nativeRejection"),
      false,
    );
    await app.dispatch({ type: "reset" });
    assert.equal(
      app.getSnapshot().events.some((event) => event.nativeRejection),
      false,
    );
    assert.equal(
      app
        .getSnapshot()
        .behaviors.some((behavior) => behavior.rules.some((value) => value.nativeRejection)),
      false,
    );
  } finally {
    app.dispose();
    engine.dispose();
  }
});

test("saved pending input retains copied enqueue intent while active logical events advance", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  try {
    (app as unknown as { audio: AudioEngine }).audio = engine;
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    app.advance(1 / 60);
    app.advance(1 / 60);
    const saved = (
      app as unknown as {
        captureLiveAudio(): {
          pending: { input: VoiceInput; intent: VoiceIntent; behaviorDocumentRevision: number }[];
          voices: VoiceIntent[];
        };
      }
    ).captureLiveAudio();
    assert.equal(saved.pending.length, 1);
    assert.equal(saved.pending[0]!.intent.action, "start");
    assert.equal(saved.pending[0]!.intent.event.tick, 1);
    assert.equal(saved.pending[0]!.input.instanceId, saved.pending[0]!.intent.event.instanceId);
    assert.equal(saved.voices[0]!.event.tick, 3);
    assert.notEqual(saved.pending[0]!.intent.event.eventId, saved.voices[0]!.event.eventId);
    saved.pending[0]!.intent.event.eventId = "external mutation";
    const again = (
      app as unknown as {
        captureLiveAudio(): { pending: { intent: VoiceIntent }[] };
      }
    ).captureLiveAudio();
    assert.notEqual(again.pending[0]!.intent.event.eventId, "external mutation");
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    app.dispose();
    engine.dispose();
  }
});

test("real renderer rejection is excluded from captured data and cleared for replay and seek", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  // Deliberately leave the real renderer disabled; logical recording remains usable without a device.
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  try {
    (app as unknown as { audio: AudioEngine }).audio = engine;
    await app.dispatch({ type: "recordToggle" });
    app.advance(1 / 60);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "recordToggle" });
    assert.ok(
      app
        .getSnapshot()
        .events.some((event) => event.nativeRejection?.reason === "AUDIO_NOT_ENABLED"),
    );
    const artifact = app.getRecordingArtifact()!;
    assert.equal(artifact.status, "captured");
    const captured = JSON.stringify(artifact);
    assert.equal(captured.includes("nativeRejection"), false);
    assert.equal(captured.includes("AUDIO_NOT_ENABLED"), false);
    await app.dispatch({ type: "replay" });
    assert.ok(!app.getSnapshot().error, app.getSnapshot().error);
    app.advance(1 / 60);
    assert.equal(
      app.getSnapshot().events.some((event) => event.nativeRejection),
      false,
    );
    await app.dispatch({ type: "seek", timeSeconds: 0 });
    assert.ok(!app.getSnapshot().error, app.getSnapshot().error);
    await app.dispatch({ type: "stopReplay" });
    assert.equal(
      app.getSnapshot().events.some((event) => event.nativeRejection),
      false,
    );
    assert.equal(JSON.stringify(app.getRecordingArtifact()), captured);
  } finally {
    app.dispose();
    engine.dispose();
  }
});

test("native rejection storage is bounded, copied and independent of accepted outcomes", () => {
  const diagnostics = new NativeAdmissionDiagnostics();
  const event = {
    eventId: "audio.original",
    experimentId: "run.test",
    runEpoch: "epoch.test",
    sceneRevision: 4,
    tick: 8,
    simulationTimeSeconds: 8 / 60,
    fixedDtSeconds: 1 / 60,
    sequence: 0,
    objectId: "object.test",
    generation: 2,
    bindingId: "binding.test",
    profileId: "profile.test",
    profileRevision: 3,
    ruleId: "rule.test",
    trigger: { kind: "continuous", type: "AlwaysOn" },
    instanceId: "instance.test",
    action: "start",
    positionMetres: [1, 2, 3],
    gainLinear: 0.1,
    pitchSemitones: 0,
  } as VoiceIntent["event"];
  const intent: VoiceIntent = {
    action: "start",
    event,
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
    smoothingSeconds: 0,
  };
  const voiceInput: VoiceInput = {
    instanceId: event.instanceId,
    sourceId: event.instanceId,
    generator: intent.generator,
    gainLinear: 0.1,
    pitchSemitones: 0,
    emissionTimeSeconds: 8 / 60,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
  };
  const frame = {
    requestId: "acoustic.test",
    sourceId: event.instanceId,
    sceneRevision: 4,
    poseTick: 9,
  } as AcousticFrame;
  for (let index = 0; index < 70; index++) {
    diagnostics.append({
      intent: { ...intent, event: { ...event, eventId: `audio.${index}` } },
      voiceInput,
      admission: { accepted: false, reason: "SOURCE_BUDGET" },
      frame,
      behaviorDocumentRevision: 5,
      attemptedAtTick: 10 + index,
    });
  }
  const rows = diagnostics.events();
  assert.equal(rows.length, 64);
  assert.equal(rows[0]!.nativeRejection!.audioEventId, "audio.6");
  assert.equal(rows.at(-1)!.nativeRejection!.audioEventId, "audio.69");
  assert.equal(rows.at(-1)!.nativeRejection!.sceneRevision, 4);
  assert.equal(rows.at(-1)!.nativeRejection!.behaviorDocumentRevision, 5);
  rows.at(-1)!.nativeRejection!.reason = "external mutation";
  assert.equal(
    diagnostics.ruleView("binding.test", "rule.test").nativeRejection!.reason,
    "SOURCE_BUDGET",
  );
  diagnostics.append({
    intent,
    voiceInput,
    admission: { accepted: true },
    frame,
    behaviorDocumentRevision: 5,
    attemptedAtTick: 100,
  });
  assert.equal(diagnostics.events().length, 64);
  diagnostics.clear();
  assert.deepEqual(diagnostics.events(), []);
  assert.deepEqual(diagnostics.ruleView("binding.test", "rule.test"), {});
});

test("native reason descriptions are bilingual and preserve unknown/prototype-named engine reasons", () => {
  for (const locale of ["zh-TW", "en"] as const) {
    const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
      translate(locale, key, params);
    const known = nativeRejectionText("SOURCE_BUDGET", t);
    assert.match(known, /\[SOURCE_BUDGET\]/);
    assert.match(known, locale === "en" ? /source capacity reached/ : /已達聲源容量/);
    for (const raw of ["NEW_NATIVE_REASON: 42", "constructor", "toString", "__proto__"]) {
      const visible = nativeRejectionText(raw, t);
      assert.ok(visible.includes(raw));
      assert.ok(!/undefined|\[native code\]|\[object Object\]/.test(visible));
    }
    assert.match(
      nativeRejectionText(undefined, t),
      locale === "en" ? /provided no reason/ : /未提供原因/,
    );
    assert.match(
      t("analysis.decision.action.start"),
      locale === "en" ? /Logical sound instance/ : /邏輯聲音實例/,
    );
    assert.match(
      t("analysis.native.logicalActive"),
      locale === "en" ? /Logical instance active/ : /邏輯實例活動中/,
    );
  }
});
