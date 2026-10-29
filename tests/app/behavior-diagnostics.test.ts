import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import type { ProjectDocument } from "../../src/persistence/types.js";
import {
  BehaviorDiagnostics,
  projectBehaviorDecisions,
} from "../../src/app/behavior-diagnostics.js";
import { replayEventViews } from "../../src/app/replay-view.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import type { BehaviorFrame, BehaviorDecision } from "../../src/audio-behavior/types.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  makeBehaviorContext,
} from "../../src/app/defaults.js";

test("unrecorded run exposes actual global voice budget rejection", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const project = JSON.parse(app.exportProject()) as ProjectDocument;
    const object = project.scene.objects.find((value) => value.id === "speaker")!;
    const source = project.scene.sources[0]!;
    const binding = project.soundBehaviors.bindings.find((value) => value.objectId === "speaker")!;
    for (let i = 1; i <= 16; i++) {
      const objectId = `speaker.${String(i).padStart(2, "0")}`;
      project.scene.objects.push({ ...object, id: objectId, positionM: [i * 2, 1, -2] });
      project.scene.sources.push({ ...source, id: `source.${objectId}`, objectId });
      project.soundBehaviors.bindings.push({
        ...binding,
        bindingId: `binding.${objectId}`,
        objectId,
      });
    }
    await app.importProject(JSON.stringify(project));
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const view = app.getSnapshot();
    assert.equal(view.recording.state, "idle");
    const rejected = view.events.find((event) => event.suppressed);
    assert.ok(rejected, "actual GLOBAL_VOICE_LIMIT rejection must be visible without capture");
    assert.equal(rejected.ruleId, "rule.always");
    assert.equal(rejected.positionM, undefined, "no emitted source exists on rejection");
    assert.match(rejected.detail ?? "", /GLOBAL_VOICE_LIMIT/);
    assert.equal(view.events.filter((event) => event.decision?.action === "start").length, 16);
    assert.equal(new Set(view.events.map((event) => event.id)).size, view.events.length);
    const rejectedRule = view.behaviors.find(
      (value) => value.bindingId === rejected.decision?.bindingId,
    )!.rules[0]!;
    assert.equal(rejectedRule.status, "GLOBAL_VOICE_LIMIT");
    await app.dispatch({ type: "run" });
    for (let tick = 0; tick < 550; tick++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    assert.ok(app.getSnapshot().events.length <= 512);
    const admittedRule = app
      .getSnapshot()
      .behaviors.find((value) => value.rules[0]?.diagnostic?.action === "update")!.rules[0]!;
    assert.equal(admittedRule.diagnostic!.tick, app.getSnapshot().tick);
    await app.dispatch({ type: "reset" });
    assert.ok(
      app.getSnapshot().behaviors.every((value) => value.rules.every((rule) => !rule.diagnostic)),
    );
  } finally {
    app.dispose();
  }
});

test("real Rapier cooldown rejection retains raw impact/contact and captured replay provenance", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.impact",
      patch: { cooldownSeconds: 10 },
    });
    await app.dispatch({ type: "recordToggle" });
    await app.dispatch({ type: "run" });
    for (let tick = 0; tick < 230; tick++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    await app.dispatch({ type: "recordToggle" });
    assert.ok(!app.getSnapshot().error);
    const view = app.getSnapshot();
    const rejected = view.events.find((event) => event.decision?.reason === "COOLDOWN");
    assert.ok(rejected, "second real impact must be suppressed by configured cooldown");
    const rawImpact = view.events.find((event) => event.id === rejected.decision!.inputEventId);
    assert.equal(rawImpact?.type, "OnImpact");
    assert.equal(
      rawImpact?.suppressed,
      undefined,
      "raw physics occurrence is not a rejected sound",
    );
    assert.equal(rejected.decision!.emitterAttachment, "contact");
    assert.ok(rejected.decision!.contactPairKey);
    assert.equal(rejected.decision!.contactPositionM?.length, 3);
    assert.equal(rejected.decision!.emitterPositionM, undefined);
    const start = view.events.find(
      (event) => event.ruleId === "rule.impact" && event.decision?.action === "start",
    )!;
    assert.deepEqual(start.positionM, start.decision!.contactPositionM);
    const artifact = app.getRecordingArtifact()!;
    const before = JSON.stringify(artifact);
    const historical = replayEventViews(artifact, 2000).find((event) => event.id === rejected.id)!;
    assert.deepEqual(historical.decision, rejected.decision);
    assert.equal(
      JSON.stringify(artifact),
      before,
      "projection cannot mutate captured decisions or hashes",
    );
    const capturedDecision = artifact.frames
      .flatMap((frame) => frame.behaviorDecisions)
      .find(
        (value) => (value as BehaviorDecision).inputEventId === rejected.decision!.inputEventId,
      ) as BehaviorDecision;
    assert.equal(capturedDecision.reason, "COOLDOWN");
    await app.dispatch({
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.impact",
      patch: { cooldownSeconds: 0 },
    });
    assert.equal(
      app
        .getSnapshot()
        .behaviors.find((value) => value.objectId === "ball")!
        .rules.find((rule) => rule.id === "rule.impact")!.diagnostic,
      undefined,
    );
    await app.dispatch({ type: "replay" });
    assert.equal(
      app.getSnapshot().events.find((event) => event.id === rejected.id)?.decision?.reason,
      "COOLDOWN",
    );
    assert.equal(JSON.stringify(app.getRecordingArtifact()), before);
  } finally {
    app.dispose();
  }
});

test("disabled binding and override are configuration states, not fabricated rejected events", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const project = JSON.parse(app.exportProject()) as ProjectDocument;
    const binding = project.soundBehaviors.bindings.find((value) => value.objectId === "ball")!;
    binding.enabled = false;
    await app.importProject(JSON.stringify(project));
    assert.equal(
      app.getSnapshot().behaviors.find((value) => value.objectId === "ball")!.rules[0]!.status,
      "BINDING_DISABLED",
    );
    binding.enabled = true;
    binding.overrides.push({ ruleId: "rule.impact", enabled: false });
    await app.importProject(JSON.stringify(project));
    assert.equal(
      app.getSnapshot().behaviors.find((value) => value.objectId === "ball")!.rules[0]!.status,
      "RULE_DISABLED",
    );
    assert.equal(app.getSnapshot().events.filter((event) => event.suppressed).length, 0);
  } finally {
    app.dispose();
  }
});

test("actual evaluator missing-contact rejection projects no fabricated COM emitter", () => {
  const scene = createDefaultScene();
  const document = createDefaultBehaviors(scene);
  const rule = document.profiles[0]!.rules[0]!;
  rule.trigger = { kind: "continuous", type: "WhileRolling" };
  rule.emitter = { attachment: "contact", aggregation: "impulseWeighted" };
  const poses = scene.objects.map((object) => ({ objectId: object.id, generation: 1 }));
  const runtime = createBehaviorRuntime(document, makeBehaviorContext(scene, poses), {
    experimentId: "diagnostic.test",
    runEpoch: "diagnostic.epoch",
  });
  const inputFrame: BehaviorFrame = {
    tick: 1,
    sceneRevision: scene.sceneRevision,
    runEpoch: "diagnostic.epoch",
    events: [],
    objects: scene.objects.map((object) => ({
      objectId: object.id,
      generation: 1,
      lifecycle: "active",
      positionMetres: [...object.positionM],
      states: {
        moving: false,
        airborne: false,
        held: false,
        sleeping: false,
        rolling: true,
        sliding: null,
        spinning: false,
      },
      metrics: {},
    })),
  };
  const result = runtime.step(inputFrame);
  assert.equal(result.decisions[0]!.reason, "EMITTER_UNAVAILABLE");
  const before = structuredClone(result);
  const views = projectBehaviorDecisions({
    runEpoch: inputFrame.runEpoch,
    fixedDtSeconds: 1 / 60,
    document,
    inputFrame,
    decisions: result.decisions,
    audioEvents: result.events,
  });
  assert.equal(views[0]!.decision!.emitterAttachment, "contact");
  assert.equal(views[0]!.decision!.contactPositionM, undefined);
  assert.equal(views[0]!.positionM, undefined);
  assert.deepEqual(result, before);
});

test("semantic rejection IDs survive order changes; invalid legacy entries are ignored; latest state is bounded", () => {
  const decisions: BehaviorDecision[] = ["rule.a", "rule.b"].map((ruleId) => ({
    tick: 4,
    sequence: 0,
    bindingId: "binding.a",
    ruleId,
    inputEventId: "input.a",
    instanceId: null,
    action: "reject",
    reason: "GLOBAL_VOICE_LIMIT",
  }));
  const input = {
    runEpoch: "epoch.a",
    fixedDtSeconds: 1 / 60,
    document: null,
    inputFrame: null,
    audioEvents: [],
    decisions,
  };
  const views = projectBehaviorDecisions(input);
  assert.equal(
    projectBehaviorDecisions({ ...input, decisions: [decisions[0], decisions[0]] })[0]!.decision!
      .occurrences,
    2,
  );
  assert.equal(new Set(views.map((view) => view.id)).size, 2);
  assert.deepEqual(
    projectBehaviorDecisions({ ...input, decisions: [...decisions].reverse() })
      .map((view) => view.id)
      .sort(),
    views.map((view) => view.id).sort(),
  );
  assert.notEqual(projectBehaviorDecisions({ ...input, runEpoch: "epoch.b" })[0]!.id, views[0]!.id);
  assert.equal(
    projectBehaviorDecisions({ ...input, decisions: [null, {}, { ...decisions[0], tick: NaN }] })
      .length,
    0,
  );
  const latest = new BehaviorDiagnostics();
  for (let index = 0; index < 600; index++) {
    latest.append(
      projectBehaviorDecisions({
        ...input,
        decisions: [{ ...decisions[0], ruleId: `rule.${index}` }],
      }),
    );
  }
  assert.equal(latest.get("binding.a", "rule.0"), undefined);
  assert.equal(latest.get("binding.a", "rule.599")?.reason, "GLOBAL_VOICE_LIMIT");
  latest.clear();
  assert.equal(latest.get("binding.a", "rule.599"), undefined);
});
