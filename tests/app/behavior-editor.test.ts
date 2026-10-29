import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultScene,
  createDefaultBehaviors,
  makeBehaviorContext,
} from "../../src/app/defaults.js";
import { editBehaviors, reconcileBehaviors } from "../../src/app/behavior-editor.js";
import {
  createProfileRegistry,
  effectiveRule,
  mapParameter,
} from "../../src/audio-behavior/profile-registry.js";
import type { BehaviorAsset } from "../../src/audio-behavior/types.js";
import type { BehaviorFrame } from "../../src/audio-behavior/types.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { LabRuntime } from "../../src/app/runtime.js";
import type { BodyPose } from "../../src/physics/types.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type {
  ParameterMapping,
  SoundBehaviorDocument,
} from "../../schemas/sound-behavior/types.js";

function poses(scene: SceneSpec): BodyPose[] {
  return scene.objects.map((object) => ({
    objectId: object.id,
    generation: 1,
    positionMetres: [...object.positionM],
    rotation: [...object.orientationQuaternion],
    linearVelocityMetresPerSecond: [0, 0, 0],
    angularVelocityRadiansPerSecond: [0, 0, 0],
    mode: object.mode,
    sleeping: false,
    moving: false,
    airborne: false,
    held: false,
    rolling: null,
    sliding: null,
    spinning: false,
    enabled: true,
    lifecycle: "active",
    discontinuity: false,
  }));
}
function fixture() {
  const scene = createDefaultScene();
  const document = createDefaultBehaviors(scene);
  return { scene, document, bodies: poses(scene) };
}
function selected(document: SoundBehaviorDocument, objectId = "ball") {
  const binding = document.bindings.find((entry) => entry.objectId === objectId)!;
  const profile = document.profiles.find((entry) => entry.profileId === binding.profileId)!;
  return { binding, profile };
}
function validate(
  document: SoundBehaviorDocument,
  scene: SceneSpec,
  bodies: BodyPose[],
  assets: BehaviorAsset[] = [],
) {
  return createProfileRegistry(document, makeBehaviorContext(scene, bodies, assets));
}
const asset: BehaviorAsset = {
  assetId: "asset.test-controlled",
  revision: 3,
  sha256: "a".repeat(64),
  availability: "READY",
  rightsStatus: "APPROVED",
  durationSeconds: 0.75,
};
function customMapping(): ParameterMapping {
  return {
    mappingId: "mapping.custom-gain",
    input: "sourceSpeedMetresPerSecond",
    target: "gainLinear",
    inputMin: 0,
    inputMax: 10,
    outputMin: 0,
    outputMax: 2,
    curve: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.2 },
      { x: 1, y: 1 },
    ],
    interpolation: "linear",
    clamp: true,
    smoothingSeconds: 0.05,
  };
}

test("rule edits are atomic and increase document/profile revisions and binding pins", () => {
  const { scene, document, bodies } = fixture(),
    before = structuredClone(document);
  const old = selected(document);
  const next = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { gainLinear: 0.2, pitchSemitones: 7 },
  });
  assert.deepEqual(document, before);
  assert.ok(next.revision > document.revision);
  const after = selected(next);
  assert.ok(after.profile.revision > old.profile.revision);
  assert.equal(after.binding.profileRevision, after.profile.revision);
  assert.equal(
    after.profile.rules.find((entry) => entry.ruleId === "rule.grab")!.pitchSemitones,
    7,
  );
  validate(next, scene, bodies);
});

test("editing a shared preset changes only the selected object's effective rules", () => {
  const { scene } = fixture();
  scene.objects.push({
    ...structuredClone(scene.objects.find((entry) => entry.id === "ball")!),
    id: "ball-two",
  });
  const document = createDefaultBehaviors(scene),
    bodies = poses(scene);
  assert.equal(
    selected(document).binding.profileId,
    selected(document, "ball-two").binding.profileId,
  );
  const next = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { gainLinear: 0.3 },
  });
  const first = selected(next),
    second = selected(next, "ball-two");
  assert.notEqual(first.binding.profileId, second.binding.profileId);
  assert.equal(
    effectiveRule(first.binding, first.profile.rules.find((r) => r.ruleId === "rule.grab")!)
      .gainLinear,
    0.3,
  );
  assert.notEqual(
    effectiveRule(second.binding, second.profile.rules.find((r) => r.ruleId === "rule.grab")!)
      .gainLinear,
    0.3,
  );
  validate(next, scene, bodies);
});

test("an old binding override cannot silently mask an Inspector rule edit", () => {
  const { scene, document, bodies } = fixture();
  selected(document).binding.overrides.push({
    ruleId: "rule.grab",
    gainLinear: 0.9,
    enabled: false,
  });
  const next = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { gainLinear: 0.15, enabled: true },
  });
  const after = selected(next),
    effective = effectiveRule(
      after.binding,
      after.profile.rules.find((r) => r.ruleId === "rule.grab")!,
    );
  assert.equal(effective.gainLinear, 0.15);
  assert.equal(effective.enabled, true);
});

test("new object without a binding can add a legal contact rule", () => {
  const { scene, document, bodies } = fixture();
  const next = editBehaviors(document, scene, bodies, [], {
    type: "addRule",
    objectId: "floor",
    trigger: "OnImpact",
  });
  const added = selected(next, "floor").profile.rules.find(
    (entry) => entry.trigger.type === "OnImpact",
  )!;
  assert.equal(added.emitter.attachment, "contact");
  assert.equal(added.trigger.kind, "discrete");
  assert.ok((added.oneShotDurationSeconds ?? 0) > 0);
  validate(next, scene, bodies);
});

test("invalid triggers, missing assets, NaN and injected patch keys leave original data intact", () => {
  const { scene, document, bodies } = fixture(),
    before = structuredClone(document);
  for (const action of [
    { type: "addRule", objectId: "ball", trigger: "ExecuteJavascript" },
    {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.grab",
      patch: { assetId: "asset.missing", generator: "sample" },
    },
    { type: "patchRule", objectId: "ball", ruleId: "rule.grab", patch: { gainLinear: NaN } },
    {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.grab",
      patch: { sourceCode: "throw 'bad'" },
    },
  ]) {
    assert.throws(() => editBehaviors(document, scene, bodies, [], action as never));
    assert.deepEqual(document, before);
  }
});

test("sample selection pins only the trusted registry version and produces a finite one-shot", () => {
  const { scene, document, bodies } = fixture();
  const next = editBehaviors(document, scene, bodies, [asset], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { assetId: asset.assetId, generator: "sample" },
  });
  const rule = selected(next).profile.rules.find((r) => r.ruleId === "rule.grab")!;
  assert.equal(rule.generator.kind, "sample");
  if (rule.generator.kind !== "sample") assert.fail("sample expected");
  assert.deepEqual(rule.generator.asset, {
    assetId: asset.assetId,
    revision: 3,
    sha256: asset.sha256,
  });
  assert.equal(rule.generator.loop, false);
  assert.ok(
    next.assets.some((pin) => pin.assetId === asset.assetId && pin.sha256 === asset.sha256),
  );
  validate(next, scene, bodies, [asset]);
  assert.throws(() =>
    editBehaviors(document, scene, bodies, [{ ...asset, rightsStatus: "UNVERIFIED" }], {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.grab",
      patch: { assetId: asset.assetId, generator: "sample" },
    }),
  );
});

test("changing a sample rule to continuous updates loop/lifetime and preserves valid authoring", () => {
  const { scene, document, bodies } = fixture();
  const sample = editBehaviors(document, scene, bodies, [asset], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { assetId: asset.assetId, generator: "sample" },
  });
  const next = editBehaviors(sample, scene, bodies, [asset], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { trigger: "AlwaysOn" },
  });
  const rule = selected(next).profile.rules.find((r) => r.ruleId === "rule.grab")!;
  assert.equal(rule.trigger.kind, "continuous");
  assert.equal(rule.generator.kind, "sample");
  if (rule.generator.kind === "sample") assert.equal(rule.generator.loop, true);
  assert.equal(rule.oneShotDurationSeconds, undefined);
  assert.equal(rule.emitter.attachment, "object");
  validate(next, scene, bodies, [asset]);
});

test("speed/impact mappings use bounded domain metrics and reject unsupported trigger context", () => {
  const { scene, document, bodies } = fixture();
  const speed = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.throw",
    patch: { mapping: "speed" },
  });
  const mapping = selected(speed).profile.rules.find((r) => r.ruleId === "rule.throw")!
    .mappings[0]!;
  assert.equal(mapping.input, "sourceSpeedMetresPerSecond");
  assert.equal(mapping.clamp, true);
  assert.ok(mapping.inputMax > mapping.inputMin);
  validate(speed, scene, bodies);
  const impact = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.impact",
    patch: { mapping: "impact" },
  });
  assert.ok(
    ["normalImpulseNewtonSeconds", "closingSpeedMetresPerSecond"].includes(
      selected(impact).profile.rules.find((r) => r.ruleId === "rule.impact")!.mappings[0]!.input,
    ),
  );
  assert.throws(() =>
    editBehaviors(document, scene, bodies, [], {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.grab",
      patch: { mapping: "impact" },
    }),
  );
});

test("remove rule clears binding overrides and material overrides referencing it", () => {
  const { scene, document, bodies } = fixture(),
    chosen = selected(document);
  chosen.binding.overrides.push({ ruleId: "rule.impact", gainLinear: 0.3 });
  chosen.profile.materialPairOverrides.push({
    overrideId: "pair.test",
    ruleId: "rule.impact",
    materialA: "material.metal",
    materialB: "material.wood",
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 550 },
  });
  const next = editBehaviors(document, scene, bodies, [], {
    type: "removeRule",
    objectId: "ball",
    ruleId: "rule.impact",
  });
  const after = selected(next);
  assert.ok(!after.profile.rules.some((r) => r.ruleId === "rule.impact"));
  assert.ok(!after.profile.materialPairOverrides.some((r) => r.ruleId === "rule.impact"));
  assert.ok(!after.binding.overrides.some((r) => r.ruleId === "rule.impact"));
  validate(next, scene, bodies);
});

test("preset choice remains an authored classification and does not invent vibration or assets", () => {
  const { scene, document, bodies } = fixture();
  const next = editBehaviors(document, scene, bodies, [], {
    type: "setPreset",
    objectId: "ball",
    presetKind: "physical",
  });
  assert.equal(selected(next).profile.presetKind, "physical");
  assert.deepEqual(next.assets, []);
  validate(next, scene, bodies);
});

test("reconcile drops deleted bindings and updates actual generations without mutating source", () => {
  const { scene, document } = fixture(),
    before = structuredClone(document);
  scene.objects = scene.objects.filter((entry) => entry.id !== "ball");
  scene.sceneRevision++;
  const bodies = poses(scene).map((entry) => ({ ...entry, generation: 8 }));
  const next = reconcileBehaviors(document, scene, bodies);
  assert.deepEqual(document, before);
  assert.ok(!next.bindings.some((entry) => entry.objectId === "ball"));
  assert.ok(next.bindings.every((entry) => entry.objectGeneration === 8));
  assert.deepEqual(next.assets, document.assets);
  validate(next, scene, bodies);
});

test("full Inspector drafts accept read-only telemetry without serializing it into rules", () => {
  const { scene, document, bodies } = fixture();
  const next = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: {
      id: "rule.grab",
      trigger: "OnGrab",
      enabled: true,
      generator: "oscillator",
      gainLinear: 0.18,
      pitchSemitones: -3,
      cooldownSeconds: 0.1,
      priority: 50,
      mapping: "none",
      active: true,
      status: "Playing",
    },
  });
  const rule = selected(next).profile.rules.find((entry) => entry.ruleId === "rule.grab")!;
  assert.equal(rule.gainLinear, 0.18);
  assert.ok(!("id" in rule) && !("active" in rule) && !("status" in rule));
  validate(next, scene, bodies);
  assert.throws(() =>
    editBehaviors(document, scene, bodies, [], {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.grab",
      patch: { id: "different-rule" },
    }),
  );
});

test("flattening per-rule overrides retains the independent binding enabled gate", () => {
  const { scene, document, bodies } = fixture();
  const before = selected(document);
  before.binding.enabled = false;
  before.binding.overrides = [
    { ruleId: "rule.grab", gainLinear: 0.3 },
    { ruleId: "rule.throw", enabled: false, pitchSemitones: 5 },
  ];
  const next = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { gainLinear: 0.12 },
  });
  const after = selected(next);
  assert.equal(after.binding.enabled, false);
  assert.deepEqual(after.binding.overrides, []);
  assert.equal(after.profile.rules.find((entry) => entry.ruleId === "rule.grab")!.enabled, true);
  assert.equal(after.profile.rules.find((entry) => entry.ruleId === "rule.throw")!.enabled, false);
  assert.equal(
    after.profile.rules.find((entry) => entry.ruleId === "rule.throw")!.pitchSemitones,
    5,
  );
  validate(next, scene, bodies);
});

test("deleting the final rule removes its binding and profile without affecting others", () => {
  const { scene, document, bodies } = fixture();
  const speaker = selected(document, "speaker");
  const next = editBehaviors(document, scene, bodies, [], {
    type: "removeRule",
    objectId: "speaker",
    ruleId: "rule.always",
  });
  assert.ok(!next.bindings.some((entry) => entry.bindingId === speaker.binding.bindingId));
  assert.ok(!next.profiles.some((entry) => entry.profileId === speaker.profile.profileId));
  assert.deepEqual(selected(next).profile, selected(document).profile);
  validate(next, scene, bodies);
});

test("continuous samples changed to discrete oscillators get a finite valid lifetime", () => {
  const { scene, document, bodies } = fixture();
  const sample = editBehaviors(document, scene, bodies, [asset], {
    type: "patchRule",
    objectId: "speaker",
    ruleId: "rule.always",
    patch: { generator: "sample", assetId: asset.assetId },
  });
  const next = editBehaviors(sample, scene, bodies, [asset], {
    type: "patchRule",
    objectId: "speaker",
    ruleId: "rule.always",
    patch: { trigger: "OnBounce", generator: "oscillator" },
  });
  const rule = selected(next, "speaker").profile.rules[0]!;
  assert.equal(rule.generator.kind, "oscillator");
  assert.equal(rule.emitter.attachment, "contact");
  assert.ok((rule.oneShotDurationSeconds ?? 0) >= rule.fadeInSeconds + rule.fadeOutSeconds);
  validate(next, scene, bodies, [asset]);
});

test("new sample versions require readiness, rights, finite duration and valid hashes", () => {
  const { scene, document, bodies } = fixture();
  for (const invalid of [
    { ...asset, availability: "MISSING" as const },
    { ...asset, durationSeconds: 0 },
    { ...asset, durationSeconds: Infinity },
    { ...asset, sha256: "invented" },
  ]) {
    const before = structuredClone(document);
    assert.throws(() =>
      editBehaviors(document, scene, bodies, [invalid], {
        type: "patchRule",
        objectId: "ball",
        ruleId: "rule.grab",
        patch: { generator: "sample", assetId: asset.assetId },
      }),
    );
    assert.deepEqual(document, before);
  }
});

test("long object IDs still produce bounded local profile and binding identities", () => {
  const { scene, document } = fixture();
  const objectId = "f".repeat(64);
  scene.objects.find((entry) => entry.id === "floor")!.id = objectId;
  const bodies = poses(scene);
  const next = editBehaviors(document, scene, bodies, [], {
    type: "addRule",
    objectId,
    trigger: "AlwaysOn",
  });
  const after = selected(next, objectId);
  assert.ok(after.binding.bindingId.length <= 128);
  assert.ok(after.profile.profileId.length <= 128);
  validate(next, scene, bodies);
});

test("ambiguous rule ownership and revision overflow fail atomically", () => {
  const { scene, document, bodies } = fixture();
  document.bindings.push({
    ...structuredClone(selected(document).binding),
    bindingId: "binding.other",
  });
  const before = structuredClone(document);
  assert.throws(() =>
    editBehaviors(document, scene, bodies, [], {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.grab",
      patch: { gainLinear: 0.1 },
    }),
  );
  assert.deepEqual(document, before);
  document.bindings.pop();
  document.revision = 2147483647;
  assert.throws(() =>
    editBehaviors(document, scene, bodies, [], {
      type: "setPreset",
      objectId: "ball",
      presetKind: "hybrid",
    }),
  );
  assert.equal(document.revision, 2147483647);
});

test("reconcile preserves caller revisions, retains sample pins, and never guesses missing poses", () => {
  const { scene, document, bodies } = fixture();
  const sample = editBehaviors(document, scene, bodies, [asset], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { generator: "sample", assetId: asset.assetId },
  });
  sample.revision = 12;
  const next = reconcileBehaviors(
    sample,
    scene,
    bodies.map((entry) => ({ ...entry, generation: 9 })),
  );
  assert.equal(next.revision, 12);
  assert.deepEqual(next.profiles, sample.profiles);
  assert.deepEqual(next.assets, sample.assets);
  assert.ok(next.bindings.every((entry) => entry.objectGeneration === 9));
  assert.throws(() =>
    reconcileBehaviors(
      sample,
      scene,
      bodies.filter((entry) => entry.objectId !== "ball"),
    ),
  );
  validate(
    next,
    scene,
    bodies.map((entry) => ({ ...entry, generation: 9 })),
    [asset],
  );
});

test("gain-only full Inspector apply retains authored emitter, sample version/offset and mapping curve", () => {
  const { scene, document, bodies } = fixture();
  const sampled = editBehaviors(document, scene, bodies, [asset], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.grab",
    patch: { generator: "sample", assetId: asset.assetId, mapping: "speed" },
  });
  const sourceRule = selected(sampled).profile.rules.find((entry) => entry.ruleId === "rule.grab")!;
  sourceRule.emitter = { attachment: "fixed", positionMetres: [1, 2, 3] };
  assert.equal(sourceRule.generator.kind, "sample");
  if (sourceRule.generator.kind !== "sample") assert.fail("sample expected");
  sourceRule.generator.startOffsetSeconds = 0.1;
  sourceRule.mappings[0]!.inputMax = 25;
  sourceRule.mappings[0]!.curve = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.8 },
    { x: 1, y: 1 },
  ];
  const next = editBehaviors(
    sampled,
    scene,
    bodies,
    [asset, { ...asset, revision: 4, sha256: "b".repeat(64) }],
    {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.grab",
      patch: {
        id: "rule.grab",
        trigger: "OnGrab",
        enabled: true,
        generator: "sample",
        assetId: asset.assetId,
        gainLinear: 0.2,
        pitchSemitones: 0,
        cooldownSeconds: 0.08,
        priority: 40,
        mapping: "speed",
        active: false,
      },
    },
  );
  const rule = selected(next).profile.rules.find((entry) => entry.ruleId === "rule.grab")!;
  assert.deepEqual(rule.emitter, sourceRule.emitter);
  assert.deepEqual(rule.generator, sourceRule.generator);
  assert.deepEqual(rule.mappings, sourceRule.mappings);
  assert.deepEqual(next.assets, sampled.assets);
});

test("custom canonical curves preserve midpoint output and are isolated from later draft edits", () => {
  const { scene, document, bodies } = fixture(),
    before = structuredClone(document);
  const authored = customMapping();
  const next = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.throw",
    patch: { mappings: [authored], mapping: "none" },
  });
  const curve = selected(next).profile.rules.find((entry) => entry.ruleId === "rule.throw")!
    .mappings[0]!;
  assert.equal(mapParameter(curve, 5), 0.4);
  assert.ok(Math.abs(mapParameter(curve, 7.5) - 1.2) < 1e-12);
  assert.equal(mapParameter(curve, -1), 0);
  assert.equal(mapParameter(curve, 11), 2);
  assert.equal(curve.smoothingSeconds, 0.05);
  authored.curve[1]!.y = 0.9;
  assert.equal(mapParameter(curve, 5), 0.4);
  assert.deepEqual(document, before);
  validate(next, scene, bodies);
  const cleared = editBehaviors(next, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.throw",
    patch: { mappings: [] },
  });
  assert.deepEqual(
    selected(cleared).profile.rules.find((entry) => entry.ruleId === "rule.throw")!.mappings,
    [],
  );
});

test("custom step pitch and cutoff curves retain canonical units and target bounds", () => {
  const { scene, document, bodies } = fixture();
  const pitch: ParameterMapping = {
    ...customMapping(),
    mappingId: "mapping.pitch",
    target: "pitchSemitones",
    outputMin: -12,
    outputMax: 12,
    interpolation: "step",
  };
  const cutoff: ParameterMapping = {
    ...customMapping(),
    mappingId: "mapping.cutoff",
    target: "filterCutoffHz",
    outputMin: 100,
    outputMax: 12000,
  };
  const next = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.throw",
    patch: { mappings: [pitch, cutoff] },
  });
  const authored = selected(next).profile.rules.find(
    (entry) => entry.ruleId === "rule.throw",
  )!.mappings;
  assert.equal(mapParameter(authored[0]!, 4), -12);
  assert.ok(Math.abs(mapParameter(authored[0]!, 6) - -7.2) < 1e-12);
  assert.equal(mapParameter(authored[1]!, 5), 2480);
  validate(next, scene, bodies);
});

test("invalid custom curve ranges, points, metrics and executable keys fail atomically", () => {
  const { scene, document, bodies } = fixture(),
    before = structuredClone(document);
  const invalid = [
    { ...customMapping(), inputMax: 0 },
    { ...customMapping(), outputMin: 3, outputMax: 2 },
    { ...customMapping(), outputMax: 4.1 },
    { ...customMapping(), curve: [{ x: 0, y: 0 }] },
    { ...customMapping(), curve: Array.from({ length: 17 }, (_, i) => ({ x: i / 16, y: i / 16 })) },
    {
      ...customMapping(),
      curve: [
        { x: 0, y: 0 },
        { x: 0, y: 0.2 },
        { x: 1, y: 1 },
      ],
    },
    {
      ...customMapping(),
      curve: [
        { x: 0.1, y: 0 },
        { x: 1, y: 1 },
      ],
    },
    {
      ...customMapping(),
      curve: [
        { x: 0, y: 0 },
        { x: 1, y: NaN },
      ],
    },
    {
      ...customMapping(),
      curve: [
        { x: 0, y: 0 },
        { x: 1, y: 1.1 },
      ],
    },
    { ...customMapping(), clamp: false },
    { ...customMapping(), smoothingSeconds: Infinity },
    { ...customMapping(), input: "normalImpulseNewtonSeconds" },
    { ...customMapping(), script: "alert('invalid')" },
  ];
  for (const authored of invalid) {
    assert.throws(() =>
      editBehaviors(document, scene, bodies, [], {
        type: "patchRule",
        objectId: "ball",
        ruleId: "rule.throw",
        patch: { mappings: [authored] },
      } as never),
    );
    assert.deepEqual(document, before);
  }
  assert.throws(() =>
    editBehaviors(document, scene, bodies, [], {
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.throw",
      patch: {
        mappings: [customMapping(), { ...customMapping(), mappingId: "mapping.duplicate-target" }],
      },
    }),
  );
  assert.deepEqual(document, before);
});

test("binding overrides take precedence for one object without changing a shared profile", () => {
  const { scene } = fixture();
  scene.objects.push({
    ...structuredClone(scene.objects.find((entry) => entry.id === "ball")!),
    id: "ball-two",
  });
  const document = createDefaultBehaviors(scene),
    bodies = poses(scene),
    before = structuredClone(document);
  const next = editBehaviors(document, scene, bodies, [], {
    type: "setBindingOverride",
    objectId: "ball",
    ruleId: "rule.grab",
    override: { enabled: false, gainLinear: 0.7, pitchSemitones: 9 },
  });
  assert.deepEqual(document, before);
  assert.equal(next.revision, document.revision + 1);
  assert.deepEqual(next.profiles, document.profiles);
  const first = selected(next),
    second = selected(next, "ball-two");
  assert.equal(first.binding.profileId, second.binding.profileId);
  assert.equal(first.binding.profileRevision, selected(document).binding.profileRevision);
  assert.deepEqual(second.binding, selected(document, "ball-two").binding);
  const effective = effectiveRule(
    first.binding,
    first.profile.rules.find((entry) => entry.ruleId === "rule.grab")!,
  );
  assert.equal(effective.enabled, false);
  assert.equal(effective.gainLinear, 0.7);
  assert.equal(effective.pitchSemitones, 9);
  validate(next, scene, bodies);
});

test("binding override replacement and clear restore inheritance without rewriting profile defaults", () => {
  const { scene, document, bodies } = fixture();
  const overridden = editBehaviors(document, scene, bodies, [], {
    type: "setBindingOverride",
    objectId: "ball",
    ruleId: "rule.grab",
    override: { enabled: false, gainLinear: 0.6, pitchSemitones: 9 },
  });
  const replacement = editBehaviors(overridden, scene, bodies, [], {
    type: "setBindingOverride",
    objectId: "ball",
    ruleId: "rule.grab",
    override: { gainLinear: 0.2 },
  });
  const chosen = selected(replacement),
    rule = chosen.profile.rules.find((entry) => entry.ruleId === "rule.grab")!;
  assert.equal(effectiveRule(chosen.binding, rule).enabled, true);
  assert.equal(effectiveRule(chosen.binding, rule).pitchSemitones, rule.pitchSemitones);
  assert.equal(effectiveRule(chosen.binding, rule).gainLinear, 0.2);
  for (const override of [null, {}]) {
    const cleared = editBehaviors(replacement, scene, bodies, [], {
      type: "setBindingOverride",
      objectId: "ball",
      ruleId: "rule.grab",
      override,
    });
    const after = selected(cleared);
    assert.deepEqual(after.binding.overrides, []);
    assert.deepEqual(after.profile, selected(document).profile);
    assert.equal(cleared.revision, replacement.revision + 1);
    assert.deepEqual(
      effectiveRule(
        after.binding,
        after.profile.rules.find((entry) => entry.ruleId === "rule.grab")!,
      ),
      rule,
    );
    validate(cleared, scene, bodies);
  }
});

test("a dedicated canonical curve edit keeps binding overrides and isolates a shared profile", () => {
  const { scene } = fixture();
  scene.objects.push({
    ...structuredClone(scene.objects.find((entry) => entry.id === "ball")!),
    id: "ball-two",
  });
  const document = createDefaultBehaviors(scene),
    bodies = poses(scene);
  const overridden = editBehaviors(document, scene, bodies, [], {
    type: "setBindingOverride",
    objectId: "ball",
    ruleId: "rule.throw",
    override: { enabled: false, gainLinear: 0.7, pitchSemitones: 3 },
  });
  const next = editBehaviors(overridden, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.throw",
    patch: { mappings: [customMapping()], mapping: "none" },
  });
  const before = selected(overridden),
    after = selected(next);
  assert.notEqual(after.profile.profileId, selected(next, "ball-two").profile.profileId);
  assert.deepEqual(after.binding.overrides, before.binding.overrides);
  assert.equal(
    after.profile.rules.find((rule) => rule.ruleId === "rule.throw")!.gainLinear,
    before.profile.rules.find((rule) => rule.ruleId === "rule.throw")!.gainLinear,
  );
  assert.deepEqual(selected(next, "ball-two"), selected(overridden, "ball-two"));
  assert.equal(
    mapParameter(after.profile.rules.find((rule) => rule.ruleId === "rule.throw")!.mappings[0]!, 5),
    0.4,
  );
  assert.equal(
    effectiveRule(after.binding, after.profile.rules.find((rule) => rule.ruleId === "rule.throw")!)
      .enabled,
    false,
  );
  validate(next, scene, bodies);
});

test("invalid binding override payloads never mutate profiles, bindings or document revisions", () => {
  const { scene, document, bodies } = fixture(),
    before = structuredClone(document);
  for (const override of [
    { gainLinear: NaN },
    { gainLinear: 4.1 },
    { pitchSemitones: -25 },
    { enabled: "true" },
    { ruleId: "injected" },
    { generator: "oscillator" },
  ]) {
    assert.throws(() =>
      editBehaviors(document, scene, bodies, [], {
        type: "setBindingOverride",
        objectId: "ball",
        ruleId: "rule.grab",
        override,
      } as never),
    );
    assert.deepEqual(document, before);
  }
  assert.throws(() =>
    editBehaviors(document, scene, bodies, [], {
      type: "setBindingOverride",
      objectId: "ball",
      ruleId: "missing-rule",
      override: { gainLinear: 0.2 },
    }),
  );
  assert.deepEqual(document, before);
});

test("stale scene or behavior stamps reject curve and override edits without discarding their draft", () => {
  const { scene, document, bodies } = fixture(),
    before = structuredClone(document);
  for (const action of [
    {
      type: "patchRule" as const,
      objectId: "ball",
      ruleId: "rule.throw",
      patch: { mappings: [customMapping()] },
      expectedSceneRevision: scene.sceneRevision + 1,
      expectedBehaviorRevision: document.revision,
    },
    {
      type: "patchRule" as const,
      objectId: "ball",
      ruleId: "rule.throw",
      patch: { mappings: [customMapping()] },
      expectedSceneRevision: scene.sceneRevision,
      expectedBehaviorRevision: document.revision + 1,
    },
    {
      type: "setBindingOverride" as const,
      objectId: "ball",
      ruleId: "rule.grab",
      override: { gainLinear: 0.2 },
      expectedSceneRevision: scene.sceneRevision,
      expectedBehaviorRevision: document.revision + 1,
    },
  ]) {
    const draft = structuredClone(action);
    assert.throws(() => editBehaviors(document, scene, bodies, [], action), {
      code: "REVISION_CONFLICT",
    });
    assert.deepEqual(document, before);
    assert.deepEqual(action, draft);
  }
  const accepted = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.throw",
    patch: { mappings: [customMapping()] },
    expectedSceneRevision: scene.sceneRevision,
    expectedBehaviorRevision: document.revision,
  });
  assert.equal(accepted.revision, document.revision + 1);
});

test("the behavior evaluator uses authored curve output after profile and binding base values", () => {
  const { scene, document, bodies } = fixture();
  const mapped = editBehaviors(document, scene, bodies, [], {
    type: "patchRule",
    objectId: "ball",
    ruleId: "rule.throw",
    patch: { mappings: [customMapping()] },
  });
  const override = { gainLinear: 0.7 };
  const authored = editBehaviors(mapped, scene, bodies, [], {
    type: "setBindingOverride",
    objectId: "ball",
    ruleId: "rule.throw",
    override,
  });
  override.gainLinear = 0.9;
  assert.equal(
    selected(authored).binding.overrides.find((entry) => entry.ruleId === "rule.throw")!.gainLinear,
    0.7,
  );
  const runEpoch = "epoch.custom-curves";
  const runtime = createBehaviorRuntime(authored, makeBehaviorContext(scene, bodies, []), {
    experimentId: "experiment.curves",
    runEpoch,
  });
  const frame: BehaviorFrame = {
    tick: 1,
    sceneRevision: scene.sceneRevision,
    runEpoch,
    objects: bodies.map((body) => ({
      objectId: body.objectId,
      generation: body.generation,
      lifecycle: "active",
      positionMetres: body.positionMetres,
      states: {
        moving: true,
        airborne: false,
        held: false,
        sleeping: false,
        rolling: null,
        sliding: null,
        spinning: false,
      },
      metrics: { sourceSpeedMetresPerSecond: 5, angularSpeedRadiansPerSecond: 0 },
    })),
    events: [
      {
        eventId: "event.throw",
        tick: 1,
        sequence: 0,
        objectId: "ball",
        generation: 1,
        type: "OnThrow",
        source: "interaction",
        accepted: true,
        commandId: "command.throw",
      },
    ],
  };
  const result = runtime.step(frame);
  const emission = result.events.find(
    (event) => event.ruleId === "rule.throw" && event.action === "start",
  )!;
  assert.ok(emission, "the accepted Throw must emit the authored rule");
  assert.equal(emission.gainLinear, 0.4);
  assert.equal(emission.profileRevision, selected(authored).profile.revision);
});

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

test("LabRuntime dispatch, Undo and Redo preserve custom curves and binding override history", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    const original = app.getBehaviorDocument();
    await app.dispatch({
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.throw",
      patch: { mappings: [customMapping()] },
      expectedSceneRevision: app.getSceneDocument().sceneRevision,
      expectedBehaviorRevision: original.revision,
    });
    assert.equal(app.getSnapshot().error, "");
    const mapped = app.getBehaviorDocument();
    assert.equal(
      mapParameter(
        selected(mapped).profile.rules.find((rule) => rule.ruleId === "rule.throw")!.mappings[0]!,
        5,
      ),
      0.4,
    );
    await app.dispatch({
      type: "setBindingOverride",
      objectId: "ball",
      ruleId: "rule.throw",
      override: { gainLinear: 0.7, pitchSemitones: 3 },
      expectedSceneRevision: app.getSceneDocument().sceneRevision,
      expectedBehaviorRevision: mapped.revision,
    });
    assert.equal(app.getSnapshot().error, "");
    const overridden = app.getBehaviorDocument();
    assert.equal(overridden.revision, mapped.revision + 1);
    assert.deepEqual(overridden.profiles, mapped.profiles);
    assert.equal(
      selected(overridden).binding.overrides.find((entry) => entry.ruleId === "rule.throw")!
        .gainLinear,
      0.7,
    );
    await app.dispatch({ type: "undo" });
    const undone = app.getBehaviorDocument();
    assert.ok(undone.revision > overridden.revision);
    assert.deepEqual(undone.profiles, mapped.profiles);
    assert.deepEqual(selected(undone).binding.overrides, selected(mapped).binding.overrides);
    await app.dispatch({ type: "redo" });
    const redone = app.getBehaviorDocument();
    assert.ok(redone.revision > undone.revision);
    assert.deepEqual(redone.profiles, overridden.profiles);
    assert.deepEqual(selected(redone).binding.overrides, selected(overridden).binding.overrides);
    await app.dispatch({ type: "undo" });
    await app.dispatch({ type: "undo" });
    const baseline = app.getBehaviorDocument();
    assert.deepEqual(baseline.profiles, original.profiles);
    assert.equal(app.getSnapshot().canUndo, false);
    const draft = { mappings: [{ ...customMapping(), inputMax: 0 }] };
    await app.dispatch({ type: "patchRule", objectId: "ball", ruleId: "rule.throw", patch: draft });
    assert.ok(app.getSnapshot().error);
    assert.deepEqual(app.getBehaviorDocument(), baseline);
    assert.equal(app.getSnapshot().canUndo, false);
    assert.equal(draft.mappings[0]!.inputMax, 0);
    await app.dispatch({
      type: "setBindingOverride",
      objectId: "ball",
      ruleId: "rule.throw",
      override: { gainLinear: 0.2 },
      expectedBehaviorRevision: baseline.revision - 1,
    });
    assert.match(app.getSnapshot().error ?? "", /REVISION_CONFLICT|changed/);
    assert.deepEqual(app.getBehaviorDocument(), baseline);
    assert.equal(app.getSnapshot().canUndo, false);
  } finally {
    app.dispose();
  }
});

test("source-owned rule override and clear synchronize Scene playing atomically and undo together", async () => {
  const app = await LabRuntime.create({ storage: memory(), useWorker: false });
  try {
    const original = app.getBehaviorDocument();
    assert.equal(
      app.getSceneDocument().sources.find((source) => source.objectId === "speaker")!.playing,
      true,
    );
    await app.dispatch({
      type: "setBindingOverride",
      objectId: "speaker",
      ruleId: "rule.always",
      override: { enabled: false },
    });
    assert.equal(app.getSnapshot().error, "");
    const muted = app.getBehaviorDocument();
    assert.deepEqual(muted.profiles, original.profiles);
    assert.equal(
      app.getSceneDocument().sources.find((source) => source.objectId === "speaker")!.playing,
      false,
    );
    assert.equal(
      selected(muted, "speaker").binding.enabled,
      selected(original, "speaker").binding.enabled,
    );
    await app.dispatch({
      type: "setBindingOverride",
      objectId: "speaker",
      ruleId: "rule.always",
      override: null,
    });
    assert.equal(app.getSnapshot().error, "");
    const cleared = app.getBehaviorDocument();
    assert.ok(cleared.revision > muted.revision);
    assert.deepEqual(cleared.profiles, original.profiles);
    assert.equal(
      app.getSceneDocument().sources.find((source) => source.objectId === "speaker")!.playing,
      true,
    );
    await app.dispatch({ type: "undo" });
    assert.equal(
      app.getSceneDocument().sources.find((source) => source.objectId === "speaker")!.playing,
      false,
    );
    assert.deepEqual(app.getBehaviorDocument().profiles, original.profiles);
    assert.equal(
      selected(app.getBehaviorDocument(), "speaker").binding.overrides.find(
        (entry) => entry.ruleId === "rule.always",
      )!.enabled,
      false,
    );
  } finally {
    app.dispose();
  }
});
