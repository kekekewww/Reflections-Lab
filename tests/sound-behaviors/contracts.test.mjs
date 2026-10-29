import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loadSoundBehaviorValidators,
  validateSoundBehaviorDocument,
  validateAudioEvent,
  validateRuntimeState,
  validateBehaviorProposal,
  validateSoundBehaviorComparison,
} from "../../scripts/validation/sound-behavior.mjs";

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../../schemas/sound-behavior/examples/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const clone = (value) => structuredClone(value);
const codes = (result) => result.errors.map((error) => error.code);

test("versioned document, logical event, snapshot and proposal compile and validate without runtime claims", () => {
  assert.equal(loadSoundBehaviorValidators().size, 2);
  const document = fixture("document"),
    context = fixture("context");
  const before = clone(document);
  assert.equal(validateSoundBehaviorDocument(document, context).ok, true);
  assert.deepEqual(document, before);
  assert.equal(validateAudioEvent(fixture("audio-event"), document, context).ok, true);
  assert.equal(validateRuntimeState(fixture("runtime-state"), document, context).ok, true);
  assert.equal(validateBehaviorProposal(fixture("proposal"), document, context).ok, true);
});

test("unsupported versions, arbitrary scripts, graph payloads and unbounded rules fail schema", () => {
  const context = fixture("context");
  for (const mutate of [
    (d) => {
      d.schemaVersion = "2.0.0";
    },
    (d) => {
      d.profiles[0].rules[0].script = "process.exit(0)";
    },
    (d) => {
      d.profiles[0].rules[0].trigger.expression = "velocity > 2";
    },
    (d) => {
      d.graph = { nodes: [] };
    },
    (d) => {
      d.profiles[0].rules = Array(33).fill(d.profiles[0].rules[0]);
    },
  ]) {
    const document = fixture("document");
    mutate(document);
    assert.equal(validateSoundBehaviorDocument(document, context).ok, false);
  }
});

test("host registry rejects invented, stale, missing and unapproved assets; fixture is never product ready", () => {
  const document = fixture("document");
  for (const mutate of [
    (c) => {
      c.assetRegistry = [];
    },
    (c) => {
      c.assetRegistry[0].revision++;
    },
    (c) => {
      c.assetRegistry[0].sha256 = "0".repeat(64);
    },
    (c) => {
      c.assetRegistry[0].availability = "MISSING";
    },
    (c) => {
      c.assetRegistry[0].rightsStatus = "UNKNOWN";
    },
    (c) => {
      c.validationMode = "product";
    },
  ]) {
    const context = fixture("context");
    mutate(context);
    assert.equal(validateSoundBehaviorDocument(document, context).ok, false);
  }
});

test("profile sharing and object overrides retain stable IDs and exact revisions", () => {
  const context = fixture("context"),
    document = fixture("document");
  context.objects.push({ objectId: "object.ball-two", generation: 1 });
  document.bindings.push({
    ...clone(document.bindings[0]),
    bindingId: "binding.two",
    objectId: "object.ball-two",
    overrides: [{ ruleId: "rule.impact", gainLinear: 0.25, enabled: false }],
  });
  assert.equal(validateSoundBehaviorDocument(document, context).ok, true);
  document.bindings[1].profileRevision++;
  assert.ok(
    codes(validateSoundBehaviorDocument(document, context)).includes("STALE_PROFILE_REVISION"),
  );
  document.bindings[1].profileRevision--;
  document.bindings[1].overrides[0].ruleId = "rule.invented";
  assert.ok(codes(validateSoundBehaviorDocument(document, context)).includes("UNKNOWN_RULE"));
});

test("duplicate IDs, stale generations, unknown materials and invalid pair override targets fail", () => {
  const context = fixture("context");
  for (const mutate of [
    (d) => {
      d.profiles.push(clone(d.profiles[0]));
    },
    (d) => {
      d.profiles[0].rules.push(clone(d.profiles[0].rules[0]));
    },
    (d) => {
      d.bindings[0].objectGeneration = 99;
    },
    (d) => {
      d.profiles[0].materialPairOverrides[0].materialA = "material.unknown";
    },
    (d) => {
      d.profiles[0].materialPairOverrides[0].ruleId = "rule.unknown";
    },
  ]) {
    const document = fixture("document");
    mutate(document);
    assert.equal(validateSoundBehaviorDocument(document, context).ok, false);
  }
});

test("declarative mapping rejects unavailable trigger metrics, duplicate target, unsorted curve and unsafe numbers", () => {
  const context = fixture("context");
  for (const mutate of [
    (d) => {
      d.profiles[0].rules[0].mappings[0].input = "normalImpulseNewtonSeconds";
    },
    (d) => {
      const r = d.profiles[0].rules[0];
      r.mappings.push({ ...clone(r.mappings[0]), mappingId: "map.duplicate-target" });
    },
    (d) => {
      d.profiles[0].rules[0].mappings[0].curve = [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ];
    },
    (d) => {
      d.profiles[0].rules[0].mappings[0].inputMax = 0;
    },
    (d) => {
      d.profiles[0].rules[0].mappings[0].outputMax = 5;
    },
    (d) => {
      d.profiles[0].rules[0].gainLinear = Infinity;
    },
  ]) {
    const document = fixture("document");
    mutate(document);
    assert.equal(validateSoundBehaviorDocument(document, context).ok, false);
  }
});

test("contact sounds must use contact source; continuous/discrete sample loop semantics cannot be confused", () => {
  const context = fixture("context");
  for (const mutate of [
    (d) => {
      d.profiles[0].rules[1].emitter = { attachment: "object", offsetMetres: [0, 0, 0] };
    },
    (d) => {
      d.profiles[0].rules[0].generator.loop = false;
    },
    (d) => {
      d.profiles[0].rules[1].generator.loop = true;
    },
    (d) => {
      d.profiles[0].rules[0].trigger = { kind: "discrete", type: "AlwaysOn" };
    },
  ]) {
    const document = fixture("document");
    mutate(document);
    assert.equal(validateSoundBehaviorDocument(document, context).ok, false);
  }
});

test("events enforce emission identity, physics clock and contact location rather than body center", () => {
  const document = fixture("document"),
    context = fixture("context");
  for (const mutate of [
    (e) => {
      e.tick++;
    },
    (e) => {
      e.runEpoch = "epoch.previous";
    },
    (e) => {
      e.profileRevision++;
    },
    (e) => {
      e.generation++;
    },
    (e) => {
      e.positionMetres = [10, 10, 10];
    },
    (e) => {
      e.contact.normalAtoB = [0, 0, 0];
    },
    (e) => {
      e.contact.impulseMethod = "Unavailable";
    },
    (e) => {
      e.audioContextTime = 1;
    },
  ]) {
    const event = fixture("audio-event");
    mutate(event);
    assert.equal(validateAudioEvent(event, document, context).ok, false);
  }
});

test("runtime checkpoints reject unknown rules, duplicate instances and event IDs, and budget overflow", () => {
  const document = fixture("document"),
    context = fixture("context");
  for (const mutate of [
    (s) => {
      s.bindings[0].activeRuleIds = ["rule.invented"];
    },
    (s) => {
      s.instances.push(clone(s.instances[0]));
    },
    (s) => {
      s.processedEventIds.push(s.processedEventIds[0]);
    },
    (s) => {
      s.documentRevision++;
    },
  ]) {
    const state = fixture("runtime-state");
    mutate(state);
    assert.equal(validateRuntimeState(state, document, context).ok, false);
  }
  context.maxVoices = 0;
  assert.equal(validateRuntimeState(fixture("runtime-state"), document, context).ok, false);
});

test("AI proposals enforce revisions, complete typed replacement, no arbitrary patch, and no scene changes", () => {
  const document = fixture("document"),
    context = fixture("context");
  for (const mutate of [
    (p) => {
      p.expectedSceneRevision++;
    },
    (p) => {
      p.expectedBehaviorRevision++;
    },
    (p) => {
      p.operations[0].profile.revision = 2;
    },
    (p) => {
      p.operations[0].profile.rules[0].generator.asset.assetId = "asset.invented";
    },
    (p) => {
      p.operations = [{ type: "Patch", path: "/scene/gravity", value: 0 }];
    },
    (p) => {
      p.operations = [{ type: "SetGravity", gravity: [0, 0, 0] }];
    },
  ]) {
    const proposal = fixture("proposal");
    mutate(proposal);
    assert.equal(validateBehaviorProposal(proposal, document, context).ok, false);
  }
});

test("proposal deletion cannot strand bindings and rejected multi-op proposal never mutates input", () => {
  const document = fixture("document"),
    context = fixture("context"),
    before = clone(document);
  const proposal = fixture("proposal");
  proposal.operations = [
    {
      type: "DeleteProfile",
      profileId: document.profiles[0].profileId,
      expectedProfileRevision: 1,
    },
  ];
  assert.equal(validateBehaviorProposal(proposal, document, context).ok, false);
  assert.deepEqual(document, before);
});

test("bounded throw latch is explicit and cannot be confused with airborne or an unbounded one-shot", () => {
  const document = fixture("document"),
    context = fixture("context");
  const rule = clone(document.profiles[0].rules[0]);
  rule.ruleId = "rule.throw-loop";
  rule.trigger = { kind: "discrete", type: "OnThrow" };
  rule.lifecycle = {
    mode: "latched",
    stopOn: ["OnImpact"],
    retriggerPolicy: "ignore",
    maxDurationSeconds: 5,
  };
  document.profiles[0].rules.push(rule);
  assert.equal(validateSoundBehaviorDocument(document, context).ok, true);
  for (const mutate of [
    (r) => {
      r.lifecycle.maxDurationSeconds = 0;
    },
    (r) => {
      r.lifecycle.stopOn.push("OnThrow");
    },
    (r) => {
      r.trigger = { kind: "continuous", type: "WhileAirborne" };
    },
    (r) => {
      r.generator.loop = false;
    },
  ]) {
    const candidate = clone(document);
    mutate(candidate.profiles[0].rules.at(-1));
    assert.equal(validateSoundBehaviorDocument(candidate, context).ok, false);
  }
  const state = fixture("runtime-state");
  context.physicsEventIds.push("physics.throw.1");
  state.bindings[0].activeRuleIds.push(rule.ruleId);
  state.instances.push({
    ...clone(state.instances[0]),
    instanceId: "voice.throw-loop",
    ruleId: rule.ruleId,
    latch: { startEventId: "physics.throw.1", deadlineTick: 300, retriggerCount: 0 },
  });
  assert.equal(validateRuntimeState(state, document, context).ok, true);
  state.instances.at(-1).latch.startEventId = "physics.invented";
  assert.equal(validateRuntimeState(state, document, context).ok, false);
});

test("runtime active rules and physical contact participants must refer to valid domain records", () => {
  const document = fixture("document"),
    context = fixture("context");
  const event = fixture("audio-event");
  event.contact.objectB = "object.invented";
  assert.equal(validateAudioEvent(event, document, context).ok, false);
  const state = fixture("runtime-state");
  state.bindings[0].activeRuleIds.push("rule.impact");
  assert.equal(validateRuntimeState(state, document, context).ok, false);
});

test("proposal schema capacity cannot bypass the stricter host mutation budget", () => {
  const document = fixture("document"),
    context = fixture("context"),
    proposal = fixture("proposal");
  proposal.operations = Array.from({ length: 33 }, (_, index) => ({
    type: "CreateProfile",
    profile: { ...clone(proposal.operations[0].profile), profileId: `profile.copy-${index}` },
  }));
  assert.ok(
    codes(validateBehaviorProposal(proposal, document, context)).includes("HOST_OPERATION_BUDGET"),
  );
});

test("behavior A/B allows declared asset changes without pretending its source hash is fixed", () => {
  const comparison = fixture("comparison");
  comparison.independentVariables = ["sourceAsset"];
  comparison.runB.assetManifestHash = "f".repeat(64);
  assert.equal(validateSoundBehaviorComparison(comparison).ok, true);
  comparison.runB.physicsConfigHash = "f".repeat(64);
  assert.equal(validateSoundBehaviorComparison(comparison).ok, false);
});

test("acoustic A/B fixes source generation while behavior A/B fixes propagation and declares changed inputs", () => {
  const comparison = fixture("comparison");
  assert.equal(validateSoundBehaviorComparison(comparison).ok, true);
  const acoustic = clone(comparison);
  acoustic.comparisonKind = "acoustic";
  acoustic.independentVariables = ["acousticMaterial"];
  assert.equal(validateSoundBehaviorComparison(acoustic).ok, false);
  acoustic.runB.profileHash = acoustic.runA.profileHash;
  acoustic.runB.sourceSignalHash = acoustic.runA.sourceSignalHash;
  acoustic.runB.propagationMaterialHash = "f".repeat(64);
  assert.equal(validateSoundBehaviorComparison(acoustic).ok, true);
  const wrongMaterial = clone(comparison);
  wrongMaterial.runB.propagationMaterialHash = "f".repeat(64);
  assert.equal(validateSoundBehaviorComparison(wrongMaterial).ok, false);
  const wrongAsset = clone(comparison);
  wrongAsset.runB.assetManifestHash = "f".repeat(64);
  assert.equal(validateSoundBehaviorComparison(wrongAsset).ok, false);
  const unexplained = clone(comparison);
  unexplained.runB.profileHash = unexplained.runA.profileHash;
  assert.equal(validateSoundBehaviorComparison(unexplained).ok, false);
});

test("binding and per-rule effective enabled flags gate committed events and checkpoint active instances", () => {
  const document = fixture("document"),
    context = fixture("context");
  document.bindings[0].overrides = [{ ruleId: "rule.always", enabled: false }];
  assert.equal(validateRuntimeState(fixture("runtime-state"), document, context).ok, false);
  document.bindings[0].enabled = false;
  assert.equal(validateAudioEvent(fixture("audio-event"), document, context).ok, false);
  const stopped = fixture("audio-event");
  stopped.action = "stop";
  assert.equal(validateAudioEvent(stopped, document, context).ok, true);
});

test("plain discrete oscillator requires a finite one-shot duration; expired latched voice may only fade or stop", () => {
  const document = fixture("document"),
    context = fixture("context");
  const impact = document.profiles[0].rules[1];
  impact.generator = { kind: "oscillator", waveform: "sine", frequencyHz: 1000 };
  assert.equal(validateSoundBehaviorDocument(document, context).ok, false);
  impact.oneShotDurationSeconds = 0.2;
  assert.equal(validateSoundBehaviorDocument(document, context).ok, true);
  const expiredOneShot = fixture("runtime-state");
  expiredOneShot.instances[0] = {
    ...expiredOneShot.instances[0],
    ruleId: "rule.impact",
    kind: "oneShot",
  };
  assert.equal(validateRuntimeState(expiredOneShot, document, context).ok, false);
  impact.oneShotDurationSeconds = 0.01;
  assert.equal(validateSoundBehaviorDocument(document, context).ok, false);
  const latch = clone(document.profiles[0].rules[0]);
  latch.ruleId = "rule.throw-loop";
  latch.trigger = { kind: "discrete", type: "OnThrow" };
  latch.lifecycle = {
    mode: "latched",
    stopOn: ["OnImpact"],
    retriggerPolicy: "ignore",
    maxDurationSeconds: 5,
  };
  document.profiles[0].rules[1].oneShotDurationSeconds = 0.2;
  document.profiles[0].rules.push(latch);
  context.physicsEventIds.push("physics.throw.1");
  const state = fixture("runtime-state");
  state.tick = 301;
  state.bindings[0].activeRuleIds.push(latch.ruleId);
  state.instances.push({
    ...clone(state.instances[0]),
    instanceId: "voice.throw-loop",
    ruleId: latch.ruleId,
    latch: { startEventId: "physics.throw.1", deadlineTick: 300, retriggerCount: 0 },
  });
  assert.equal(validateRuntimeState(state, document, context).ok, false);
  state.instances.at(-1).playbackState = "fading";
  assert.equal(validateRuntimeState(state, document, context).ok, true);
});

test("known host asset selection derives document pins without granting model catalog authority", () => {
  const document = fixture("document"),
    context = fixture("context"),
    proposal = fixture("proposal");
  document.assets = [];
  document.profiles = [];
  document.bindings = [];
  const before = clone(document),
    accepted = validateBehaviorProposal(proposal, document, context);
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.derivedAssetPins, fixture("document").assets);
  assert.deepEqual(document, before);
  context.assetRegistry = [];
  assert.equal(validateBehaviorProposal(proposal, document, context).ok, false);
});

test("contact colliders must belong to their known participant objects", () => {
  const document = fixture("document"),
    context = fixture("context"),
    event = fixture("audio-event");
  event.contact.colliderB = "collider.invented";
  assert.equal(validateAudioEvent(event, document, context).ok, false);
});

test("material pair selected generator cannot bypass finite oscillator one-shot lifetime", () => {
  const document = fixture("document"),
    context = fixture("context");
  document.profiles[0].materialPairOverrides[0].generator = {
    kind: "oscillator",
    waveform: "sine",
    frequencyHz: 1000,
  };
  assert.equal(validateSoundBehaviorDocument(document, context).ok, false);
  document.profiles[0].rules[1].oneShotDurationSeconds = 0.2;
  assert.equal(validateSoundBehaviorDocument(document, context).ok, true);
});
