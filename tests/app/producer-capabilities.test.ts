import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSupportedBehaviorDocument,
  getSoundBehaviorCapabilities,
  PRODUCT_SOUND_BEHAVIOR_PRODUCERS,
  soundTriggerCapability,
  validateSoundProducerCapabilities,
} from "../../src/capabilities/sound-behavior.js";
import {
  createProfileRegistry,
  validateBehaviorAuthoring,
} from "../../src/audio-behavior/profile-registry.js";
import { OfflineSoundPlanner } from "../../src/ai/offline-sound-planner.js";
import { SoundProposalHost } from "../../src/ai/sound-host.js";
import { validateSoundPlannerInput } from "../../src/ai/sound-plan.js";
import { createDefaultScene, makeBehaviorContext } from "../../src/app/defaults.js";
import { context, document, impactRule, rule } from "../audio-behavior/fixtures.js";
import type { SoundHostState } from "../../src/ai/sound-host.js";

const code =
  (expected: string) =>
  (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && error.code === expected;

function state(): SoundHostState {
  return {
    sceneId: "scene.capabilities",
    sceneRevision: 4,
    document: document(),
    context: context(),
  };
}

test("one JSON-safe capability projection distinguishes evaluator knowledge from installed producers", () => {
  const base = getSoundBehaviorCapabilities();
  assert.equal(base.length, 19);
  assert.equal(new Set(base.map((entry) => entry.trigger)).size, base.length);
  assert.equal(soundTriggerCapability("OnImpact")?.supported, true);
  assert.equal(soundTriggerCapability("OnBounce")?.supported, false);
  assert.equal(soundTriggerCapability("OnEnterZone")?.reasonCode, "ZONE_PRODUCER_UNAVAILABLE");
  const product = getSoundBehaviorCapabilities(PRODUCT_SOUND_BEHAVIOR_PRODUCERS);
  assert.equal(product.find((entry) => entry.trigger === "OnBounce")?.supported, true);
  assert.ok(product.find((entry) => entry.trigger === "OnBounce")?.limitations.length);
  assert.equal(product.find((entry) => entry.trigger === "OnExitZone")?.supported, false);
  assert.deepEqual(JSON.parse(JSON.stringify(product)), product);
  assert.equal(
    soundTriggerCapability("OnEnterZone", { zoneProducer: true })?.reasonCode,
    "ZONE_REGISTRY_EMPTY",
  );
});

test("producer declarations require own boolean flags and reject unknown capability grants", () => {
  for (const value of [
    null,
    [],
    {},
    { bounceProducer: "true", zoneProducer: false },
    { bounceProducer: true, zoneProducer: false, shell: true },
    Object.create({ bounceProducer: true, zoneProducer: false }),
  ])
    assert.throws(() => validateSoundProducerCapabilities(value), code("CAPABILITY_UNSUPPORTED"));
  validateSoundProducerCapabilities({ bounceProducer: true, zoneProducer: false });
});

test("product context advertises only the producers connected to PhysicsWorld", () => {
  const product = makeBehaviorContext(createDefaultScene(), []);
  assert.deepEqual(product.producerCapabilities, PRODUCT_SOUND_BEHAVIOR_PRODUCERS);
  assert.deepEqual(product.zoneIds, []);
});

test("authoring and activation reject the same enabled unsupported producer without changing the document", () => {
  const doc = document([impactRule({ trigger: { kind: "discrete", type: "OnBounce" } })]);
  const current = context();
  current.producerCapabilities = { bounceProducer: false, zoneProducer: false };
  const before = structuredClone(doc);
  assert.throws(() => createProfileRegistry(doc, current), code("CAPABILITY_UNSUPPORTED"));
  assert.throws(() => validateBehaviorAuthoring(doc, current), code("CAPABILITY_UNSUPPORTED"));
  assert.deepEqual(doc, before);
  doc.profiles[0]!.rules[0]!.enabled = false;
  createProfileRegistry(doc, current);
  doc.bindings[0]!.overrides = [{ ruleId: doc.profiles[0]!.rules[0]!.ruleId, enabled: true }];
  assert.throws(() => createProfileRegistry(doc, current), code("CAPABILITY_UNSUPPORTED"));
  doc.bindings[0]!.overrides = [];
  current.producerCapabilities.bounceProducer = true;
  doc.profiles[0]!.rules[0]!.enabled = true;
  createProfileRegistry(doc, current);
  // Standalone evaluator tests may deliberately supply normalized events without a product producer.
  delete current.producerCapabilities;
  createProfileRegistry(doc, current);
});

test("latch stops and zone emitters cannot bypass the capability check", () => {
  const doc = document([
    rule({
      trigger: { kind: "discrete", type: "OnThrow" },
      lifecycle: {
        mode: "latched",
        stopOn: ["OnEnterZone"],
        retriggerPolicy: "restart",
        maxDurationSeconds: 1,
      },
    }),
  ]);
  assert.throws(
    () => assertSupportedBehaviorDocument(doc, PRODUCT_SOUND_BEHAVIOR_PRODUCERS),
    code("CAPABILITY_UNSUPPORTED"),
  );
  const zoned = document([rule({ emitter: { attachment: "zone", zoneId: "zone.actual" } })]);
  assert.throws(
    () =>
      assertSupportedBehaviorDocument(zoned, {
        ...PRODUCT_SOUND_BEHAVIOR_PRODUCERS,
        zoneProducer: false,
        zoneIds: ["zone.actual"],
      }),
    code("CAPABILITY_UNSUPPORTED"),
  );
});

test("offline planner exposes unsupported intent instead of silently turning it into AlwaysOn", () => {
  const planner = new OfflineSoundPlanner(),
    current = state();
  current.context.producerCapabilities = { bounceProducer: false, zoneProducer: false };
  assert.throws(() => planner.plan("彈跳時發出聲音", current), code("CAPABILITY_UNSUPPORTED"));
  assert.throws(() => planner.plan("進入區域時發出聲音", current), code("CAPABILITY_UNSUPPORTED"));
  assert.throws(() => planner.plan("離開區域時發出聲音", current), code("CAPABILITY_UNSUPPORTED"));
  current.context.producerCapabilities.bounceProducer = true;
  const plan = planner.plan("彈跳時發出聲音", current);
  assert.ok(
    plan.proposal.operations.some(
      (operation) =>
        operation.type === "ReplaceProfile" &&
        operation.profile.rules.some((entry) => entry.trigger.type === "OnBounce"),
    ),
  );
});

test("closed planner wire accepts explicit producer flags and rejects malformed or extra grants", () => {
  const current = state();
  current.context.producerCapabilities = { ...PRODUCT_SOUND_BEHAVIOR_PRODUCERS };
  assert.deepEqual(
    validateSoundPlannerInput({ state: current }).state.context.producerCapabilities,
    current.context.producerCapabilities,
  );
  for (const flags of [
    { bounceProducer: "yes", zoneProducer: false },
    { bounceProducer: true },
    { bounceProducer: true, zoneProducer: false, arbitraryTool: true },
  ]) {
    const input = structuredClone(current) as unknown as {
      context: { producerCapabilities: unknown };
    };
    input.context.producerCapabilities = flags;
    assert.throws(() => validateSoundPlannerInput({ state: input }), code("SCHEMA_INVALID"));
  }
});

test("trusted Sound Host rejects an unsupported zone proposal before preview or commit", async () => {
  const current = state();
  current.context.producerCapabilities = { ...PRODUCT_SOUND_BEHAVIOR_PRODUCERS };
  current.context.zoneIds = ["zone.actual"];
  current.context.zonePositions = { "zone.actual": [0, 0, 0] };
  let commits = 0;
  const host = new SoundProposalHost({
    getState: () => structuredClone(current),
    commit: () => {
      commits++;
      return current.document;
    },
  });
  await assert.rejects(
    () =>
      host.stage(
        {
          schemaVersion: "1.0.0",
          proposalId: "proposal.zone",
          sceneId: current.sceneId,
          expectedSceneRevision: current.sceneRevision,
          expectedBehaviorRevision: current.document.revision,
          operations: [
            {
              type: "CreateProfile",
              profile: {
                profileId: "profile.zone",
                revision: 1,
                name: "Zone",
                presetKind: "creative",
                materialPairOverrides: [],
                rules: [
                  rule({
                    ruleId: "rule.zone",
                    trigger: { kind: "discrete", type: "OnEnterZone" },
                    emitter: { attachment: "zone", zoneId: "zone.actual" },
                    oneShotDurationSeconds: 0.3,
                  }),
                ],
              },
            },
          ],
        },
        {
          provider: "offlineDeterministic",
          modelId: null,
          requestId: null,
          label: "OFFLINE_DETERMINISTIC",
        },
      ),
    code("CAPABILITY_UNSUPPORTED"),
  );
  assert.equal(commits, 0);
  assert.deepEqual(host.getAudit(), []);
});
