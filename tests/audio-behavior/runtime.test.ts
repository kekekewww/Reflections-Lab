import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createBehaviorRuntime,
  mapParameter,
  validateBehaviorAuthoring,
} from "../../src/audio-behavior/index.js";
import type { SoundBehaviorRule } from "../../schemas/sound-behavior/types.js";
import {
  context,
  contact,
  document,
  event,
  frame,
  impactRule,
  mapping,
  object,
  options,
  rule,
} from "./fixtures.js";

const starts = (result: ReturnType<ReturnType<typeof createBehaviorRuntime>["step"]>) =>
  result.events.filter((e) => e.action === "start");
const playing = (runtime: ReturnType<typeof createBehaviorRuntime>) =>
  runtime
    .snapshot()
    .state.instances.filter(
      (i) => i.playbackState === "playing" || i.playbackState === "scheduled",
    );

test("AlwaysOn survives motion, held state and independent impact one-shots", () => {
  const runtime = createBehaviorRuntime(document([rule(), impactRule()]), context(), options);
  const initial = starts(runtime.step(frame()));
  assert.equal(initial.length, 1);
  const alwaysId = initial[0]!.instanceId;
  const moving = object();
  moving.states.moving = true;
  moving.states.held = true;
  moving.metrics.sourceSpeedMetresPerSecond = 12;
  const result = runtime.step(frame(2, [event({ tick: 2 })], [moving]));
  assert.equal(starts(result).length, 1);
  assert.equal(starts(result)[0]!.ruleId, "rule.impact");
  assert.equal(
    result.events.some((e) => e.instanceId === alwaysId && e.action === "stop"),
    false,
  );
  assert.ok(playing(runtime).some((i) => i.instanceId === alwaysId));
  assert.deepEqual(starts(result)[0]!.positionMetres, [1, 0.25, 3]);
});

test("duplicate normalized event IDs do not replay a one-shot", () => {
  const runtime = createBehaviorRuntime(document([impactRule()]), context(), options);
  const input = event();
  assert.equal(starts(runtime.step(frame(1, [input, structuredClone(input)]))).length, 1);
  assert.equal(starts(runtime.step(frame(1, [input]))).length, 0);
});

test("out-of-order inputs are processed by tick and sequence", () => {
  const runtime = createBehaviorRuntime(document([impactRule()]), context(), options);
  const result = runtime.step(
    frame(1, [
      event({ eventId: "event.second", sequence: 20 }),
      event({ eventId: "event.first", sequence: 10 }),
    ]),
  );
  assert.deepEqual(
    starts(result).map((e) => e.parentPhysicsEventId),
    ["event.first", "event.second"],
  );
});

test("shared profile bindings maintain separate continuous instances and state", () => {
  const doc = document();
  doc.bindings.push({
    ...doc.bindings[0]!,
    bindingId: "binding.second",
    objectId: "object.second",
  });
  const ctx = context();
  ctx.objects.push({ objectId: "object.second", generation: 1 });
  const runtime = createBehaviorRuntime(doc, ctx, options);
  const result = runtime.step(frame(1, [], [object(), object({ objectId: "object.second" })]));
  assert.equal(starts(result).length, 2);
  assert.equal(new Set(starts(result).map((e) => e.instanceId)).size, 2);
  assert.deepEqual(
    new Set(playing(runtime).map((i) => i.bindingId)),
    new Set(["binding.ball", "binding.second"]),
  );
});

test("binding and rule enabled overrides gate emission", () => {
  const disabled = document();
  disabled.bindings[0]!.enabled = false;
  assert.equal(starts(createBehaviorRuntime(disabled, context(), options).step(frame())).length, 0);
  const overridden = document([rule({ enabled: false })]);
  overridden.bindings[0]!.overrides.push({
    ruleId: "rule.always",
    enabled: true,
    gainLinear: 0.25,
    pitchSemitones: 3,
  });
  const start = starts(createBehaviorRuntime(overridden, context(), options).step(frame()))[0]!;
  assert.equal(start.gainLinear, 0.25);
  assert.equal(start.pitchSemitones, 3);
});

test("unknown state does not satisfy a false state condition", () => {
  const runtime = createBehaviorRuntime(
    document([rule({ conditions: [{ kind: "state", state: "airborne", equals: false }] })]),
    context(),
    options,
  );
  const unknown = object();
  unknown.states.airborne = null;
  assert.equal(starts(runtime.step(frame(1, [], [unknown]))).length, 0);
});

test("missing metrics are not silently replaced with zero", () => {
  const runtime = createBehaviorRuntime(
    document([rule({ mappings: [mapping()] })]),
    context(),
    options,
  );
  assert.equal(starts(runtime.step(frame(1, [], [object({ metrics: {} })]))).length, 0);
});

test("piecewise mapping interpolates, steps, and clamps explicit ranges", () => {
  const curve = mapping();
  assert.equal(mapParameter(curve, -5), 0);
  assert.equal(mapParameter(curve, 5), 0.25);
  assert.equal(mapParameter(curve, 7.5), 0.625);
  assert.equal(mapParameter(curve, 20), 1);
  assert.equal(mapParameter(mapping({ interpolation: "step" }), 7.5), 0.25);
  assert.throws(() => mapParameter(curve, Number.NaN));
});

test("cooldown uses ceil(seconds / fixedDt), independent of skipped render frames", () => {
  const runtime = createBehaviorRuntime(
    document([impactRule({ cooldownSeconds: 0.21 })]),
    context(),
    options,
  );
  assert.equal(starts(runtime.step(frame(1, [event()]))).length, 1);
  assert.equal(
    starts(runtime.step(frame(3, [event({ eventId: "event.cool", tick: 3 })]))).length,
    0,
  );
  assert.equal(
    starts(runtime.step(frame(4, [event({ eventId: "event.rearmed", tick: 4 })]))).length,
    1,
  );
});

test("global and per-object caps hold through a burst with deterministic output", () => {
  const low = impactRule({ ruleId: "rule.low", priority: 10, voiceLimit: 4 });
  const high = impactRule({ ruleId: "rule.high", priority: 90, voiceLimit: 4 });
  const doc = document([low, high]);
  const limited = { ...options, maxVoices: 1, maxVoicesPerObject: 1 };
  const inputs = frame(1, [event(), event({ eventId: "event.two", sequence: 2 })]);
  const a = createBehaviorRuntime(doc, context(), limited);
  const b = createBehaviorRuntime(doc, context(), limited);
  assert.deepEqual(a.step(inputs), b.step(structuredClone(inputs)));
  assert.ok(playing(a).length <= 1);
  assert.equal(playing(a)[0]!.ruleId, "rule.high");
  assert.ok(a.getTrace().some((d) => d.action === "reject" || d.action === "stop"));
});

test("pause neither advances the logical clock nor manufactures moving/release edges", () => {
  const runtime = createBehaviorRuntime(document(), context(), options);
  runtime.step(frame());
  const before = runtime.snapshot().state;
  runtime.setPaused(true);
  const result = runtime.step(frame(100));
  assert.deepEqual(result.events, []);
  assert.equal(runtime.snapshot().state.tick, before.tick);
  assert.equal(
    runtime.snapshot().state.instances[0]!.playheadSeconds,
    before.instances[0]!.playheadSeconds,
  );
  runtime.setPaused(false);
  runtime.step(frame(2));
  assert.equal(runtime.snapshot().state.tick, 2);
});

test("snapshot restore produces the same subsequent event and voice decisions", () => {
  const doc = document([rule(), impactRule({ cooldownSeconds: 0.2 })]);
  const a = createBehaviorRuntime(doc, context(), options);
  a.step(frame(1, [event()]));
  const saved = structuredClone(a.snapshot());
  const b = createBehaviorRuntime(doc, context(), options);
  b.restore(saved);
  const later = frame(4, [event({ eventId: "event.later", tick: 4 })]);
  assert.deepEqual(a.step(later), b.step(structuredClone(later)));
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test("reset starts a new epoch and permits the same raw event ID exactly once", () => {
  const runtime = createBehaviorRuntime(document([impactRule()]), context(), options);
  const original = starts(runtime.step(frame(1, [event()])))[0]!;
  runtime.reset("epoch.next");
  const next = frame(1, [event()]);
  next.runEpoch = "epoch.next";
  const restarted = starts(runtime.step(next));
  assert.equal(restarted.length, 1);
  assert.equal(restarted[0]!.runEpoch, "epoch.next");
  assert.notEqual(restarted[0]!.instanceId, original.instanceId);
});

function latchRule(): SoundBehaviorRule {
  return rule({
    ruleId: "rule.flight",
    trigger: { kind: "discrete", type: "OnThrow" },
    lifecycle: {
      mode: "latched",
      stopOn: ["OnImpact"],
      retriggerPolicy: "ignore",
      maxDurationSeconds: 1,
    },
  });
}

test("accepted Throw starts a bounded latch; impact stops it and airborne does not rearm it", () => {
  const runtime = createBehaviorRuntime(document([latchRule()]), context(), options);
  const thrown = event({
    eventId: "command.throw",
    type: "OnThrow",
    source: "interaction",
    commandId: "command.1",
  });
  assert.equal(starts(runtime.step(frame(1, [thrown]))).length, 1);
  assert.equal(
    starts(runtime.step(frame(2, [{ ...thrown, eventId: "command.throw.again", tick: 2 }]))).length,
    0,
  );
  const stop = runtime.step(frame(3, [event({ eventId: "impact.stop", tick: 3 })]));
  assert.equal(stop.events.filter((e) => e.action === "stop").length, 1);
  const airborne = object();
  airborne.states.airborne = true;
  assert.equal(starts(runtime.step(frame(4, [], [airborne]))).length, 0);
  assert.equal(playing(runtime).length, 0);
});

test("latch timeout stops at its deadline, not after an unbounded loop", () => {
  const runtime = createBehaviorRuntime(document([latchRule()]), context(), options);
  runtime.step(
    frame(1, [event({ type: "OnThrow", source: "interaction", commandId: "command.1" })]),
  );
  assert.equal(runtime.snapshot().state.instances[0]!.latch!.deadlineTick, 11);
  const result = runtime.step(frame(11));
  assert.equal(result.events.filter((e) => e.action === "stop").length, 1);
  assert.equal(playing(runtime).length, 0);
});

test("speed and an unaccepted input cannot masquerade as Throw", () => {
  const runtime = createBehaviorRuntime(document([latchRule()]), context(), options);
  const fast = object({ metrics: { sourceSpeedMetresPerSecond: 100 } });
  assert.equal(starts(runtime.step(frame(1, [], [fast]))).length, 0);
  const rejected = event({
    tick: 2,
    type: "OnThrow",
    source: "interaction",
    accepted: false,
    commandId: "command.rejected",
  });
  assert.equal(starts(runtime.step(frame(2, [rejected], [fast]))).length, 0);
});

test("stale scene/profile/object references and unavailable assets are rejected", () => {
  const runtime = createBehaviorRuntime(document(), context(), options);
  assert.throws(() => runtime.step({ ...frame(), sceneRevision: 3 }));
  const staleProfile = document();
  staleProfile.bindings[0]!.profileRevision = 2;
  assert.throws(() => createBehaviorRuntime(staleProfile, context(), options));
  const staleGeneration = document();
  staleGeneration.bindings[0]!.objectGeneration = 99;
  assert.throws(() => createBehaviorRuntime(staleGeneration, context(), options));
  const unavailable = document([
    rule({
      generator: {
        kind: "sample",
        asset: { assetId: "asset.missing", revision: 1, sha256: "a".repeat(64) },
        loop: true,
        startOffsetSeconds: 0,
      },
    }),
  ]);
  unavailable.assets.push({ assetId: "asset.missing", revision: 1, sha256: "a".repeat(64) });
  assert.throws(() => createBehaviorRuntime(unavailable, context(), options));
});

test("a stopped continuous instance fades and is cleaned without restarting", () => {
  const runtime = createBehaviorRuntime(
    document([rule({ trigger: { kind: "continuous", type: "WhileMoving" }, fadeOutSeconds: 0.2 })]),
    context(),
    options,
  );
  const moving = object();
  moving.states.moving = true;
  const id = starts(runtime.step(frame(1, [], [moving])))[0]!.instanceId;
  assert.ok(runtime.step(frame(2)).events.some((e) => e.instanceId === id && e.action === "stop"));
  runtime.step(frame(5));
  assert.equal(playing(runtime).length, 0);
  assert.equal(
    runtime.snapshot().state.instances.some((i) => i.instanceId === id),
    false,
  );
});

test("sample/oscillator lifetime is finite and malformed mappings are rejected", () => {
  const unbounded = impactRule();
  delete unbounded.oneShotDurationSeconds;
  assert.throws(() => createBehaviorRuntime(document([unbounded]), context(), options));
  assert.throws(() =>
    createBehaviorRuntime(
      document([rule({ mappings: [mapping({ inputMax: 0 })] })]),
      context(),
      options,
    ),
  );
  const invalid = rule({ gainLinear: Number.POSITIVE_INFINITY });
  assert.throws(() => createBehaviorRuntime(document([invalid]), context(), options));
});

test("material-pair selection changes the selected generator while retaining contact provenance", () => {
  const doc = document([impactRule()]);
  doc.profiles[0]!.materialPairOverrides.push({
    overrideId: "override.wood-metal",
    ruleId: "rule.impact",
    materialA: "material.wood",
    materialB: "material.metal",
    generator: { kind: "oscillator", waveform: "triangle", frequencyHz: 660 },
  });
  const result = createBehaviorRuntime(doc, context(), options).step(frame(1, [event()]));
  const intent = result.voices.find((v) => v.action === "start")!;
  assert.deepEqual(intent.generator, {
    kind: "oscillator",
    waveform: "triangle",
    frequencyHz: 660,
  });
  assert.equal(intent.event.contact!.episodeId, "episode.1");
  assert.deepEqual(intent.event.positionMetres, [1, 0.25, 3]);
});

test("object attachment offsets follow the object's quaternion transform", () => {
  const doc = document([rule({ emitter: { attachment: "object", offsetMetres: [1, 0, 0] } })]);
  const pose = object({ positionMetres: [10, 0, 0], rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] });
  const result = starts(
    createBehaviorRuntime(doc, context(), options).step(frame(1, [], [pose])),
  )[0]!;
  assert.ok(Math.abs(result.positionMetres[0] - 10) < 1e-12);
  assert.ok(Math.abs(result.positionMetres[1]) < 1e-12);
  assert.ok(Math.abs(result.positionMetres[2] + 1) < 1e-12);
});

test("preview and staged objects never create active emissions", () => {
  for (const lifecycle of ["preview", "staged"] as const) {
    const runtime = createBehaviorRuntime(document([rule(), impactRule()]), context(), options);
    assert.equal(starts(runtime.step(frame(1, [event()], [object({ lifecycle })]))).length, 0);
  }
});

test("invalid frame values are rejected atomically without advancing state", () => {
  const runtime = createBehaviorRuntime(document(), context(), options);
  runtime.step(frame());
  const before = runtime.snapshot();
  assert.throws(() => runtime.step(frame(2, [], [object({ positionMetres: [Number.NaN, 0, 0] })])));
  assert.deepEqual(runtime.snapshot(), before);
  assert.throws(() => runtime.step({ ...frame(2), runEpoch: "epoch.wrong" }));
  assert.deepEqual(runtime.snapshot(), before);
});

test("restore rejects corrupted checkpoint revisions and nonfinite values", () => {
  const runtime = createBehaviorRuntime(document(), context(), options);
  runtime.step(frame());
  const saved = runtime.snapshot();
  const stale = structuredClone(saved);
  stale.state.documentRevision += 1;
  assert.throws(() => runtime.restore(stale));
  const corrupt = structuredClone(saved);
  corrupt.state.instances[0]!.gainLinear = Number.POSITIVE_INFINITY;
  assert.throws(() => runtime.restore(corrupt));
  assert.deepEqual(runtime.snapshot(), saved);
});

test("a latched object-attached source follows the object without restarting", () => {
  const runtime = createBehaviorRuntime(document([latchRule()]), context(), options);
  const initial = starts(
    runtime.step(
      frame(1, [event({ type: "OnThrow", source: "interaction", commandId: "command.1" })]),
    ),
  )[0]!;
  const later = runtime.step(frame(2, [], [object({ positionMetres: [5, 6, 7] })]));
  assert.equal(starts(later).length, 0);
  const update = later.events.find(
    (e) => e.instanceId === initial.instanceId && e.action === "update",
  );
  assert.ok(update, "persistent latched source requires a position update");
  assert.deepEqual(update.positionMetres, [5, 6, 7]);
});

test("restore cannot remove a one-shot deadline or inject an unvalidated generator", () => {
  const runtime = createBehaviorRuntime(document([impactRule()]), context(), options);
  runtime.step(frame(1, [event()]));
  const saved = runtime.snapshot();
  const unbounded = structuredClone(saved);
  unbounded.voiceMetadata[0]!.expiresAtTick = null;
  assert.throws(() => runtime.restore(unbounded));
  const injected = structuredClone(saved);
  injected.voiceMetadata[0]!.generator = {
    kind: "oscillator",
    waveform: "sine",
    frequencyHz: Number.POSITIVE_INFINITY,
  };
  assert.throws(() => runtime.restore(injected));
  assert.deepEqual(runtime.snapshot(), saved);
});

test("bounded recent-ID eviction cannot replay an older input in the same tick", () => {
  const runtime = createBehaviorRuntime(document([impactRule()]), context(), {
    ...options,
    maxRecentEvents: 1,
  });
  const first = event({ eventId: "event.first", sequence: 1 });
  const second = event({ eventId: "event.second", sequence: 2 });
  assert.equal(starts(runtime.step(frame(1, [first, second]))).length, 2);
  assert.equal(starts(runtime.step(frame(1, [first]))).length, 0);
  assert.equal(
    starts(runtime.step(frame(1, [event({ eventId: "event.third", sequence: 3 })]))).length,
    1,
  );
});

test("document replacement requires a new epoch and cannot reuse old emission identities", () => {
  const doc = document([impactRule()]);
  const runtime = createBehaviorRuntime(doc, context(), options);
  const initial = starts(runtime.step(frame(1, [event()])))[0]!;
  runtime.notifyEnded(initial.instanceId);
  runtime.setPaused(true);
  const replacement = structuredClone(doc);
  replacement.revision = 1;
  replacement.profiles[0]!.revision = 2;
  replacement.bindings[0]!.profileRevision = 2;
  runtime.replaceDocument(replacement, context());
  runtime.setPaused(false);
  assert.throws(() => runtime.step(frame(1, [event()])));
  runtime.reset("epoch.replaced");
  runtime.setPaused(false);
  const freshFrame = { ...frame(1, [event()]), runEpoch: "epoch.replaced" };
  const fresh = starts(runtime.step(freshFrame))[0]!;
  assert.notEqual(fresh.instanceId, initial.instanceId);
  assert.notEqual(fresh.eventId, initial.eventId);
  assert.equal(fresh.profileRevision, 2);
});

test("restore closes instance object and profile identity against its binding", () => {
  const runtime = createBehaviorRuntime(document(), context(), options);
  runtime.step(frame());
  const saved = runtime.snapshot();
  const moved = structuredClone(saved);
  moved.state.instances[0]!.objectId = "object.floor";
  assert.throws(() => runtime.restore(moved));
  const injected = structuredClone(saved);
  injected.state.instances[0]!.profileId = "profile.unregistered";
  assert.throws(() => runtime.restore(injected));
  assert.deepEqual(runtime.snapshot(), saved);
});

test("restore requires latch provenance for a latched rule", () => {
  const runtime = createBehaviorRuntime(document([latchRule()]), context(), options);
  runtime.step(
    frame(1, [event({ type: "OnThrow", source: "interaction", commandId: "command.1" })]),
  );
  const incomplete = runtime.snapshot();
  delete incomplete.state.instances[0]!.latch;
  assert.throws(() => runtime.restore(incomplete));
});

test("restoring a wrapper cannot clear document replacement's new-epoch requirement", () => {
  const doc = document();
  const runtime = createBehaviorRuntime(doc, context(), options);
  const replacement = structuredClone(doc);
  replacement.revision = 1;
  runtime.replaceDocument(replacement, context());
  const bypass = runtime.snapshot();
  bypass.requiresNewEpoch = false;
  assert.throws(() => runtime.restore(bypass));
  assert.throws(() => runtime.step(frame()));
});

test("a live continuous voice fades when a required mapping metric becomes unknown", () => {
  const runtime = createBehaviorRuntime(
    document([rule({ mappings: [mapping()] })]),
    context(),
    options,
  );
  const initial = starts(
    runtime.step(frame(1, [], [object({ metrics: { sourceSpeedMetresPerSecond: 5 } })])),
  )[0]!;
  const result = runtime.step(
    frame(2, [], [object({ metrics: { sourceSpeedMetresPerSecond: null } })]),
  );
  assert.ok(result.events.some((e) => e.instanceId === initial.instanceId && e.action === "stop"));
  assert.equal(playing(runtime).length, 0);
});

test("WhileAirborne is not satisfied while Held even if the producer's airborne flag is true", () => {
  const runtime = createBehaviorRuntime(
    document([rule({ trigger: { kind: "continuous", type: "WhileAirborne" } })]),
    context(),
    options,
  );
  const held = object();
  held.states.airborne = true;
  held.states.held = true;
  assert.equal(starts(runtime.step(frame(1, [], [held]))).length, 0);
});

test("unknown contact provenance methods are rejected even without a contact-subscribing rule", () => {
  const runtime = createBehaviorRuntime(document(), context(), options);
  const invalid = contact();
  (invalid as { impulseMethod: string }).impulseMethod = "InventedImpulseSource";
  assert.throws(() => runtime.step(frame(1, [event({ contact: invalid })])));
  assert.equal(runtime.snapshot().state.tick, 0);
});

test("an object-attached one-shot follows its source for its finite lifetime", () => {
  const grab = rule({
    ruleId: "rule.grab",
    trigger: { kind: "discrete", type: "OnGrab" },
    oneShotDurationSeconds: 0.5,
  });
  const runtime = createBehaviorRuntime(document([grab]), context(), options);
  const initial = starts(
    runtime.step(
      frame(1, [event({ type: "OnGrab", source: "interaction", commandId: "command.grab" })]),
    ),
  )[0]!;
  const result = runtime.step(frame(2, [], [object({ positionMetres: [4, 5, 6] })]));
  const update = result.events.find(
    (e) => e.instanceId === initial.instanceId && e.action === "update",
  );
  assert.ok(update);
  assert.deepEqual(update.positionMetres, [4, 5, 6]);
  assert.equal(starts(result).length, 0);
});

test("all committed start, update, and stop emissions pass the frozen audio-event domain validator", () => {
  const host = {
    ...context(),
    experimentId: options.experimentId,
    runEpoch: options.runEpoch,
    physicsEventIds: ["physics.impact.1"],
    colliders: [
      { colliderId: "collider.ball", objectId: "object.ball" },
      { colliderId: "collider.floor", objectId: "object.floor" },
    ],
  };
  for (const rules of [[impactRule()], [latchRule()]]) {
    const doc = document(rules);
    const runtime = createBehaviorRuntime(doc, context(), options);
    const input = rules[0]!.lifecycle
      ? event({ type: "OnThrow", source: "interaction", commandId: "command.throw" })
      : event();
    const outputs = [
      runtime.step(frame(1, [input])),
      runtime.step(frame(2)),
      runtime.step(frame(11)),
    ];
    const payload = { doc, host, events: outputs.flatMap((output) => output.events) };
    const code = `import fs from 'node:fs';
import {validateAudioEvent} from './scripts/validation/sound-behavior.mjs';
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(payload.events.map(event=>({action:event.action,rule:event.ruleId,...validateAudioEvent(event,payload.doc,payload.host)}))));`;
    const checked = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(checked.status, 0, checked.stderr || String(checked.error));
    const results = JSON.parse(checked.stdout) as { ok: boolean; errors: unknown[] }[];
    assert.ok(results.length > 0);
    assert.ok(
      results.every((result) => result.ok),
      JSON.stringify(results),
    );
  }
});

test("all normalized inputs require a known producer source", () => {
  const runtime = createBehaviorRuntime(document(), context(), options);
  const invalid = event({ type: "OnSleep", source: "state" });
  (invalid as { source: string }).source = "InventedProducer";
  assert.throws(() => runtime.step(frame(1, [invalid])));
});

test("authoring can retain unavailable asset descriptors while activation remains strict", () => {
  const asset = { assetId: "asset.unavailable", revision: 1, sha256: "a".repeat(64) };
  const doc = document([
    rule({ generator: { kind: "sample", asset, loop: true, startOffsetSeconds: 0 } }),
  ]);
  doc.assets.push(asset);
  const ctx = context();
  ctx.assetRegistry.push({ ...asset, availability: "MISSING", rightsStatus: "UNVERIFIED" });
  assert.equal(validateBehaviorAuthoring(doc, ctx).ok, true);
  assert.throws(() => createBehaviorRuntime(doc, ctx, options));
});

test("authoring retains mapping bounds and finite material-pair oscillator requirements", () => {
  assert.throws(() =>
    validateBehaviorAuthoring(
      document([rule({ mappings: [mapping({ inputMax: 0 })] })]),
      context(),
    ),
  );
  const asset = { assetId: "asset.sample", revision: 1, sha256: "b".repeat(64) };
  const impact = impactRule({
    generator: { kind: "sample", asset, loop: false, startOffsetSeconds: 0 },
  });
  delete impact.oneShotDurationSeconds;
  const doc = document([impact]);
  doc.assets.push(asset);
  doc.profiles[0]!.materialPairOverrides.push({
    overrideId: "override.unbounded",
    ruleId: impact.ruleId,
    materialA: "material.metal",
    materialB: "material.wood",
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
  });
  const ctx = context();
  ctx.assetRegistry.push({
    ...asset,
    availability: "READY",
    rightsStatus: "APPROVED",
    durationSeconds: 1,
  });
  assert.throws(() => validateBehaviorAuthoring(doc, ctx));
});

test("equal-priority mixed-case identity ties use codepoint order independent of input arrays", () => {
  const doc = document();
  const base = doc.bindings[0]!;
  doc.bindings = [
    { ...base, bindingId: "binding.a", objectId: "object.a" },
    { ...base, bindingId: "binding.Z", objectId: "object.Z" },
  ];
  const ctx = context();
  ctx.objects.push(
    { objectId: "object.a", generation: 1 },
    { objectId: "object.Z", generation: 1 },
  );
  const inputs = frame(1, [], [object({ objectId: "object.a" }), object({ objectId: "object.Z" })]);
  const limits = { ...options, maxVoices: 1, maxVoicesPerObject: 1 };
  const a = createBehaviorRuntime(doc, ctx, limits);
  const reversed = structuredClone(doc);
  reversed.bindings.reverse();
  const b = createBehaviorRuntime(reversed, ctx, limits);
  const first = a.step(inputs);
  const second = b.step({ ...inputs, objects: [...inputs.objects].reverse() });
  assert.equal(starts(first)[0]!.bindingId, "binding.Z");
  assert.deepEqual(first, second);
});
