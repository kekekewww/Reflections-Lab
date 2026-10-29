import test from "node:test";
import assert from "node:assert/strict";
import {
  projectSceneSources,
  sceneSourceRuleId,
  sceneSourceIdFromRuleId,
} from "../../src/app/scene-source-behaviors.js";
import { createScene, applyCommand } from "../../src/scene/index.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { createDefaultScene, createDefaultBehaviors } from "../../src/app/defaults.js";
import { context, document, event, frame, options, rule } from "../audio-behavior/fixtures.js";
import type { SceneSource } from "../../src/scene/types.js";
import type { ToolRequest } from "../../src/ai/types.js";

const signals = [{ id: "signal.tone-220", frequencyHz: 220, waveform: "triangle" as const }];
function fixture(mode: "continuous" | "impact" = "continuous") {
  const base = createDefaultScene();
  const scene = createScene({
    ...base,
    objects: [
      { ...base.objects.find((value) => value.id === "ball")!, id: "object.ball" },
      { ...base.objects.find((value) => value.id === "floor")!, id: "object.floor" },
    ],
    sources: [],
  });
  const source: SceneSource = {
    id: "source.test",
    objectId: "object.ball",
    signalId: "signal.tone-220",
    mode,
    gainDbfs: -18,
    playing: false,
  };
  const next = applyCommand(scene, {
    expectedSceneRevision: 0,
    operations: [{ type: "AddSource", source }],
  }).scene;
  const beforeDoc = document([
    rule({
      ruleId: "rule.grab",
      trigger: { kind: "discrete", type: "OnGrab" },
      oneShotDurationSeconds: 0.2,
    }),
  ]);
  const request: ToolRequest = {
    schemaVersion: "1.0.0",
    requestId: "request.source",
    tool: "ConfigureSoundSource",
    sceneId: scene.sceneId,
    expectedSceneRevision: 0,
    transactionId: "transaction.source",
    arguments: {
      sourceId: source.id,
      objectId: source.objectId,
      signalId: source.signalId,
      mode,
      gainDbfs: -18,
      referenceFrequencyHz: 220,
    },
  };
  const generations = [
    { objectId: "object.ball", generation: 1 },
    { objectId: "object.floor", generation: 1 },
  ];
  return { scene, next, beforeDoc, request, generations };
}

test("source projection preserves unrelated behavior and uses explicit trusted waveform/frequency/gain", () => {
  const f = fixture();
  const before = structuredClone(f);
  const projected = projectSceneSources(
    f.scene,
    f.next,
    f.beforeDoc,
    [f.request],
    f.generations,
    [],
    signals,
  );
  assert.deepEqual(f, before, "projection must be pure");
  assert.equal(projected.revision, f.beforeDoc.revision + 1);
  assert.deepEqual(projected.profiles[0]!.rules[0], f.beforeDoc.profiles[0]!.rules[0]);
  assert.equal(projected.bindings.length, 1, "source rule stays in the existing editable binding");
  assert.equal(projected.bindings[0]!.bindingId, f.beforeDoc.bindings[0]!.bindingId);
  const owned = projected.profiles[0]!.rules.find(
    (entry) => entry.ruleId === sceneSourceRuleId("source.test"),
  )!;
  assert.deepEqual(owned.generator, { kind: "oscillator", waveform: "triangle", frequencyHz: 220 });
  assert.equal(owned.gainLinear, 10 ** (-18 / 20));
  assert.equal(owned.trigger.type, "AlwaysOn");
  assert.equal(owned.emitter.attachment, "object");
  assert.equal(owned.enabled, false);
  assert.equal(projected.bindings[0]!.enabled, true);
  assert.equal(sceneSourceIdFromRuleId(owned.ruleId), "source.test");
});

test("new sources stay silent until explicit rule Enable, then real AlwaysOn/OnImpact runtime starts", () => {
  for (const mode of ["continuous", "impact"] as const) {
    const f = fixture(mode);
    const projected = projectSceneSources(
      f.scene,
      f.next,
      f.beforeDoc,
      [f.request],
      f.generations,
      [],
      signals,
    );
    const ctx = { ...context(), sceneRevision: f.next.sceneRevision };
    const input = {
      ...frame(1, mode === "impact" ? [event()] : []),
      sceneRevision: f.next.sceneRevision,
    };
    assert.equal(
      createBehaviorRuntime(projected, ctx, options)
        .step(input)
        .events.filter((value) => value.action === "start").length,
      0,
    );
    const owned = projected.profiles[0]!.rules.find(
      (entry) => entry.ruleId === sceneSourceRuleId("source.test"),
    )!;
    if (mode === "impact") {
      assert.equal(owned.emitter.attachment, "contact");
      assert.ok(Number.isFinite(owned.oneShotDurationSeconds));
    }
    owned.enabled = true; // Explicit Inspector Enable; runtime separately requires Run.
    const started = createBehaviorRuntime(projected, ctx, options)
      .step(input)
      .events.filter((value) => value.action === "start");
    assert.equal(started.length, 1);
    assert.equal(started[0]!.ruleId, owned.ruleId);
  }
});

test("unknown signals, mismatched reference frequency, unapproved source fields and missing generation fail closed", () => {
  const f = fixture();
  assert.throws(
    () => projectSceneSources(f.scene, f.next, f.beforeDoc, [f.request], f.generations, [], []),
    { code: "UNKNOWN_ID" },
  );
  const wrong = structuredClone(f.request);
  wrong.arguments.referenceFrequencyHz = 440;
  assert.throws(
    () => projectSceneSources(f.scene, f.next, f.beforeDoc, [wrong], f.generations, [], signals),
    { code: "CAPABILITY_UNSUPPORTED" },
  );
  const mismatched = createScene({
    ...f.next,
    sources: [{ ...f.next.sources[0]!, gainDbfs: -12 }],
  });
  assert.throws(
    () =>
      projectSceneSources(
        f.scene,
        mismatched,
        f.beforeDoc,
        [f.request],
        f.generations,
        [],
        signals,
      ),
    { code: "DOMAIN_INVALID" },
  );
  assert.throws(
    () => projectSceneSources(f.scene, f.next, f.beforeDoc, [f.request], [], [], signals),
    { code: "UNKNOWN_OBJECT" },
  );
  const autoEnabled = createScene({
    ...f.next,
    sources: [{ ...f.next.sources[0]!, playing: true }],
  });
  assert.throws(
    () =>
      projectSceneSources(
        f.scene,
        autoEnabled,
        f.beforeDoc,
        [f.request],
        f.generations,
        [],
        signals,
      ),
    { code: "DOMAIN_INVALID" },
  );
});

test("updating the canonical speaker migrates its legacy binding without duplicating AlwaysOn or changing other profiles", () => {
  const scene = createDefaultScene();
  const beforeDoc = createDefaultBehaviors(scene);
  const source = { ...scene.sources[0]!, gainDbfs: -12 };
  const next = applyCommand(scene, {
    expectedSceneRevision: 0,
    operations: [{ type: "SetSource", source }],
  }).scene;
  const f = fixture();
  const request = {
    ...f.request,
    sceneId: scene.sceneId,
    arguments: {
      ...f.request.arguments,
      sourceId: source.id,
      objectId: source.objectId,
      gainDbfs: -12,
    },
  };
  const generations = next.objects.map((object) => ({ objectId: object.id, generation: 1 }));
  const projected = projectSceneSources(
    scene,
    next,
    beforeDoc,
    [request],
    generations,
    [],
    [{ ...signals[0]!, waveform: "sine" }],
  );
  assert.equal(projected.bindings.filter((binding) => binding.objectId === "speaker").length, 1);
  assert.equal(
    projected.bindings.find((binding) => binding.objectId === "speaker")?.bindingId,
    "binding.continuous.speaker",
  );
  assert.deepEqual(
    projected.bindings.filter((binding) => binding.objectId !== "speaker"),
    beforeDoc.bindings.filter((binding) => binding.objectId !== "speaker"),
  );
  assert.deepEqual(
    projected.profiles.find((profile) => profile.profileId === "profile.interactive-tone"),
    beforeDoc.profiles.find((profile) => profile.profileId === "profile.interactive-tone"),
  );
  assert.equal(projected.profiles[0]!.rules.length, 1);
  assert.equal(projected.profiles[0]!.rules[0]!.ruleId, sceneSourceRuleId(source.id));
});

test("a shared profile is cloned for one object and ambiguous bindings are rejected", () => {
  const f = fixture();
  const shared = structuredClone(f.beforeDoc);
  shared.bindings.push({
    ...shared.bindings[0]!,
    bindingId: "binding.floor",
    objectId: "object.floor",
  });
  const projected = projectSceneSources(
    f.scene,
    f.next,
    shared,
    [f.request],
    f.generations,
    [],
    signals,
  );
  assert.deepEqual(projected.profiles[0], shared.profiles[0]);
  assert.equal(
    projected.bindings.find((binding) => binding.objectId === "object.floor")?.profileId,
    shared.profiles[0]!.profileId,
  );
  assert.notEqual(
    projected.bindings.find((binding) => binding.objectId === "object.ball")?.profileId,
    shared.profiles[0]!.profileId,
  );
  shared.bindings[1]!.objectId = "object.ball";
  assert.throws(
    () => projectSceneSources(f.scene, f.next, shared, [f.request], f.generations, [], signals),
    { code: "AMBIGUOUS_BINDING" },
  );
});

test("repeat configuration is idempotent and removing or moving a source preserves unrelated rules", () => {
  const f = fixture();
  const initial = projectSceneSources(
    f.scene,
    f.next,
    f.beforeDoc,
    [f.request],
    f.generations,
    [],
    signals,
  );
  const repeatedScene = createScene({ ...f.next, sceneRevision: 2 });
  const repeat = projectSceneSources(
    f.next,
    repeatedScene,
    initial,
    [{ ...f.request, expectedSceneRevision: 1 }],
    f.generations,
    [],
    signals,
  );
  assert.deepEqual(
    repeat,
    initial,
    "unchanged configuration does not create profile/document revisions",
  );
  const removedScene = applyCommand(f.next, {
    expectedSceneRevision: 1,
    operations: [{ type: "RemoveSource", sourceId: "source.test" }],
  }).scene;
  const removed = projectSceneSources(
    f.next,
    removedScene,
    initial,
    [],
    f.generations,
    [],
    signals,
  );
  assert.deepEqual(removed.profiles[0]!.rules, f.beforeDoc.profiles[0]!.rules);
  const movedScene = applyCommand(f.next, {
    expectedSceneRevision: 1,
    operations: [
      { type: "SetSource", source: { ...f.next.sources[0]!, objectId: "object.floor" } },
    ],
  }).scene;
  const moved = projectSceneSources(
    f.next,
    movedScene,
    initial,
    [
      {
        ...f.request,
        expectedSceneRevision: 1,
        arguments: { ...f.request.arguments, objectId: "object.floor" },
      },
    ],
    f.generations,
    [],
    signals,
  );
  assert.deepEqual(
    moved.profiles.find((profile) => profile.profileId === "profile.ball")!.rules,
    f.beforeDoc.profiles[0]!.rules,
  );
  const sourceBindings = moved.bindings.filter((binding) =>
    moved.profiles
      .find((profile) => profile.profileId === binding.profileId)
      ?.rules.some((entry) => entry.ruleId === sceneSourceRuleId("source.test")),
  );
  assert.equal(sourceBindings.length, 1);
  assert.equal(sourceBindings[0]?.objectId, "object.floor");
});

test("adding a second speaker source migrates legacy ownership before later removal of the original source", () => {
  const scene = createDefaultScene();
  const document = createDefaultBehaviors(scene);
  const source = { ...scene.sources[0]!, id: "source.second", playing: false };
  const next = applyCommand(scene, {
    expectedSceneRevision: 0,
    operations: [{ type: "AddSource", source }],
  }).scene;
  const request = {
    ...fixture().request,
    sceneId: scene.sceneId,
    arguments: {
      sourceId: source.id,
      objectId: source.objectId,
      signalId: source.signalId,
      mode: source.mode,
      gainDbfs: source.gainDbfs,
      referenceFrequencyHz: 220,
    },
  };
  const poses = next.objects.map((object) => ({ objectId: object.id, generation: 1 }));
  const projected = projectSceneSources(
    scene,
    next,
    document,
    [request],
    poses,
    [],
    [{ ...signals[0]!, waveform: "sine" }],
  );
  const speaker = projected.bindings.find((binding) => binding.objectId === "speaker")!;
  assert.deepEqual(
    projected.profiles
      .find((profile) => profile.profileId === speaker.profileId)!
      .rules.map((entry) => entry.ruleId)
      .sort(),
    [sceneSourceRuleId("source.speaker"), sceneSourceRuleId("source.second")].sort(),
  );
  const removedScene = applyCommand(next, {
    expectedSceneRevision: 1,
    operations: [{ type: "RemoveSource", sourceId: "source.speaker" }],
  }).scene;
  const removed = projectSceneSources(
    next,
    removedScene,
    projected,
    [],
    poses,
    [],
    [{ ...signals[0]!, waveform: "sine" }],
  );
  assert.deepEqual(
    removed.profiles
      .find((profile) => profile.profileId === speaker.profileId)!
      .rules.map((entry) => entry.ruleId),
    [sceneSourceRuleId("source.second")],
  );
});
