import { Ajv2020 } from "ajv/dist/2020.js";
import schema from "../../schemas/sound-behavior/behavior-document.schema.json" with { type: "json" };
import type {
  BehaviorBinding,
  ParameterMapping,
  SoundBehaviorDocument,
  SoundBehaviorProfile,
  SoundBehaviorRule,
  SoundGenerator,
  SoundAssetReference,
} from "../../schemas/sound-behavior/types.js";
import { BehaviorRuntimeError, type BehaviorContext } from "./types.js";

const ajv = new Ajv2020({ strict: true, strictNumbers: true, allErrors: true });
ajv.addSchema(schema);
const documentValidator = ajv.getSchema(schema.$id)!;
export const stateValidator = ajv.getSchema(schema.$id + "#/$defs/BehaviorRuntimeState")!;
export const audioEventValidator = ajv.getSchema(schema.$id + "#/$defs/AudioEvent")!;
export const generatorValidator = ajv.getSchema(schema.$id + "#/$defs/SoundGenerator")!;
export const contactValidator = ajv.getSchema(schema.$id + "#/$defs/ContactData")!;
const mappingValidator = ajv.getSchema(schema.$id + "#/$defs/ParameterMapping")!;
const contactTriggers = new Set(["OnImpact", "OnBounce", "WhileRolling", "WhileSliding"]);
const metricNames = new Set([
  "sourceSpeedMetresPerSecond",
  "angularSpeedRadiansPerSecond",
  "normalImpulseNewtonSeconds",
  "closingSpeedMetresPerSecond",
  "tangentSpeedMetresPerSecond",
  "slipSpeedMetresPerSecond",
  "contactSupportForceNewtons",
]);
export function fail(code: string, message: string): never {
  throw new BehaviorRuntimeError(code, message);
}
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function assertId(value: unknown, label = "ID"): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value))
    fail("INVALID_ID", `${label} must be a stable bounded domain ID`);
}
export function assertFinite(
  value: unknown,
  min: number,
  max: number,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    fail("NUMERIC_RANGE", `${label} must be finite in [${min}, ${max}]`);
}
export function unique<T>(values: T[], key: (value: T) => string, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) fail("DUPLICATE_ID", `Duplicate ${label}: ${id}`);
    seen.add(id);
  }
}
export const assetKey = (asset: SoundAssetReference): string =>
  `${asset.assetId}@${asset.revision}`;
export function effectiveRule(
  binding: BehaviorBinding,
  rule: SoundBehaviorRule,
): SoundBehaviorRule {
  const override = binding.overrides.find((item) => item.ruleId === rule.ruleId);
  return { ...rule, ...override, enabled: binding.enabled && (override?.enabled ?? rule.enabled) };
}

function checkGenerator(
  generator: SoundGenerator,
  rule: SoundBehaviorRule,
  document: SoundBehaviorDocument,
  context: BehaviorContext,
  authoringOnly: boolean,
): void {
  if (generator.kind === "oscillator") {
    if (
      rule.trigger.kind === "discrete" &&
      !rule.lifecycle &&
      rule.oneShotDurationSeconds === undefined
    )
      fail("ONE_SHOT_DURATION_REQUIRED", "Discrete oscillators require a finite duration");
    return;
  }
  const pin = document.assets.find((item) => assetKey(item) === assetKey(generator.asset));
  if (!pin || pin.sha256 !== generator.asset.sha256)
    fail("ASSET_PIN_MISMATCH", "Generator asset is not pinned");
  const asset = context.assetRegistry.find((item) => assetKey(item) === assetKey(generator.asset));
  if (!asset) fail("UNKNOWN_ASSET", "Asset must exist in trusted registry");
  if (asset.sha256 !== generator.asset.sha256)
    fail("ASSET_HASH_MISMATCH", "Trusted asset hash differs");
  const fixture =
    context.validationMode === "offlineFixture" &&
    asset.availability === "FIXTURE_ONLY" &&
    asset.rightsStatus === "FIXTURE_ONLY";
  if (!authoringOnly && !fixture && asset.availability !== "READY")
    fail("ASSET_NOT_READY", "Asset is not decoded/ready");
  if (!authoringOnly && !fixture && asset.rightsStatus !== "APPROVED")
    fail("ASSET_RIGHTS_UNVERIFIED", "Asset rights are not approved");
  if (
    !authoringOnly &&
    !fixture &&
    (!Number.isFinite(asset.durationSeconds) || (asset.durationSeconds ?? 0) <= 0)
  )
    fail("ASSET_DURATION_REQUIRED", "Product sample registry requires decoded duration");
  if (asset.durationSeconds !== undefined && generator.startOffsetSeconds >= asset.durationSeconds)
    fail("ASSET_OFFSET_RANGE", "Sample offset exceeds decoded duration");
  const looping = rule.trigger.kind === "continuous" || Boolean(rule.lifecycle);
  if (generator.loop !== looping)
    fail("LOOP_TRIGGER_MISMATCH", "Sample loop mode differs from rule lifecycle");
}

function checkMapping(mapping: ParameterMapping): void {
  if (!mappingValidator(mapping)) fail("SCHEMA", ajv.errorsText(mappingValidator.errors));
  if (!(mapping.inputMin < mapping.inputMax) || mapping.outputMin > mapping.outputMax)
    fail("MAPPING_RANGE", "Mapping input range must be nonzero and ordered");
  const range = { gainLinear: [0, 4], pitchSemitones: [-24, 24], filterCutoffHz: [20, 20000] }[
    mapping.target
  ]!;
  if (mapping.outputMin < range[0]! || mapping.outputMax > range[1]!)
    fail("MAPPING_OUTPUT_RANGE", "Mapping exceeds parameter bounds");
  if (
    mapping.curve[0]?.x !== 0 ||
    mapping.curve.at(-1)?.x !== 1 ||
    mapping.curve.some((p, i) => i > 0 && p.x <= mapping.curve[i - 1]!.x)
  )
    fail("CURVE_DOMAIN", "Curve must cover [0,1] with strictly increasing x");
}

export interface ProfileRegistry {
  document: SoundBehaviorDocument;
  context: BehaviorContext;
  profiles: Map<string, SoundBehaviorProfile>;
  bindings: BehaviorBinding[];
}

/** AJV plus trusted registry/domain checks; rejects unbounded executable payloads. */
function buildProfileRegistry(
  input: SoundBehaviorDocument,
  hostContext: BehaviorContext,
  authoringOnly: boolean,
): ProfileRegistry {
  if (!documentValidator(input)) fail("SCHEMA", ajv.errorsText(documentValidator.errors));
  const document = structuredClone(input);
  const context = structuredClone(hostContext);
  assertFinite(context.sceneRevision, 0, 2147483647, "sceneRevision");
  if (!Number.isInteger(context.sceneRevision))
    fail("INVALID_REVISION", "sceneRevision must be integer");
  for (const object of context.objects) {
    assertId(object.objectId);
    assertFinite(object.generation, 1, 2147483647, "generation");
    if (!Number.isInteger(object.generation))
      fail("INVALID_GENERATION", "generation must be integer");
  }
  unique(context.objects, (item) => item.objectId, "object");
  if (context.colliders) {
    unique(context.colliders, (item) => item.colliderId, "collider");
    for (const collider of context.colliders) {
      assertId(collider.colliderId);
      if (!context.objects.some((object) => object.objectId === collider.objectId))
        fail("UNKNOWN_OBJECT", "Collider owner missing");
    }
  }
  unique(context.assetRegistry, assetKey, "asset");
  unique(document.profiles, (item) => item.profileId, "profile");
  unique(document.bindings, (item) => item.bindingId, "binding");
  unique(document.assets, assetKey, "asset pin");
  for (const pin of document.assets) {
    const asset = context.assetRegistry.find((item) => assetKey(item) === assetKey(pin));
    if (!asset) fail("UNKNOWN_ASSET", "Pinned asset missing from registry");
    if (asset.sha256 !== pin.sha256) fail("ASSET_HASH_MISMATCH", "Pinned asset hash differs");
    const fixture =
      context.validationMode === "offlineFixture" &&
      asset.availability === "FIXTURE_ONLY" &&
      asset.rightsStatus === "FIXTURE_ONLY";
    if (!authoringOnly && !fixture && asset.availability !== "READY")
      fail("ASSET_NOT_READY", "Pinned asset is not ready");
    if (!authoringOnly && !fixture && asset.rightsStatus !== "APPROVED")
      fail("ASSET_RIGHTS_UNVERIFIED", "Pinned asset has unverified rights");
  }
  for (const profile of document.profiles) {
    unique(profile.rules, (item) => item.ruleId, "rule");
    unique(profile.materialPairOverrides, (item) => item.overrideId, "pair override");
    const pairs = new Set<string>();
    for (const rule of profile.rules) {
      const contact = contactTriggers.has(rule.trigger.type);
      if (contact !== (rule.emitter.attachment === "contact"))
        fail("CONTACT_EMITTER_REQUIRED", "Contact trigger/anchor mismatch");
      if (rule.emitter.attachment === "zone" && !context.zoneIds.includes(rule.emitter.zoneId))
        fail("UNKNOWN_ZONE", "Emitter zone does not exist");
      if (
        rule.lifecycle &&
        (rule.trigger.kind !== "discrete" ||
          rule.lifecycle.stopOn.includes(rule.trigger.type as never))
      )
        fail(
          "LATCH_AMBIGUOUS_TRIGGER",
          "Latch needs a discrete start distinct from its stop triggers",
        );
      if (
        rule.oneShotDurationSeconds !== undefined &&
        (rule.trigger.kind !== "discrete" ||
          rule.lifecycle ||
          rule.fadeInSeconds + rule.fadeOutSeconds > rule.oneShotDurationSeconds)
      )
        fail("ONE_SHOT_ENVELOPE_RANGE", "One-shot duration/envelope is invalid");
      checkGenerator(rule.generator, rule, document, context, authoringOnly);
      unique(rule.mappings, (item) => item.mappingId, "mapping");
      unique(rule.mappings, (item) => item.target, "mapping target");
      const allowed = new Set([
        "sourceSpeedMetresPerSecond",
        "angularSpeedRadiansPerSecond",
        ...(["OnImpact", "OnBounce"].includes(rule.trigger.type)
          ? [
              "normalImpulseNewtonSeconds",
              "closingSpeedMetresPerSecond",
              "tangentSpeedMetresPerSecond",
            ]
          : []),
        ...(["WhileRolling", "WhileSliding"].includes(rule.trigger.type)
          ? [
              "slipSpeedMetresPerSecond",
              "tangentSpeedMetresPerSecond",
              "contactSupportForceNewtons",
            ]
          : []),
      ]);
      for (const mapping of rule.mappings) {
        checkMapping(mapping);
        if (!allowed.has(mapping.input))
          fail("METRIC_UNAVAILABLE", "Metric does not exist for this trigger");
      }
      for (const condition of rule.conditions) {
        if (condition.kind === "metric" && !allowed.has(condition.input))
          fail("METRIC_UNAVAILABLE", "Condition metric does not exist for trigger");
        if (
          condition.kind === "materialPair" &&
          (!contact ||
            !context.materialIds.includes(condition.materialA) ||
            !context.materialIds.includes(condition.materialB))
        )
          fail("UNKNOWN_MATERIAL", "Material condition requires contact and trusted materials");
      }
    }
    for (const pair of profile.materialPairOverrides) {
      const rule = profile.rules.find((item) => item.ruleId === pair.ruleId);
      if (!rule) fail("UNKNOWN_RULE", "Material pair points to missing rule");
      if (!contactTriggers.has(rule.trigger.type))
        fail("CONTACT_CONTEXT_UNAVAILABLE", "Material override needs a contact trigger");
      if (
        !context.materialIds.includes(pair.materialA) ||
        !context.materialIds.includes(pair.materialB)
      )
        fail("UNKNOWN_MATERIAL", "Pair material not registered");
      const key = `${pair.ruleId}:${[pair.materialA, pair.materialB].sort().join("|")}`;
      if (pairs.has(key)) fail("DUPLICATE_MATERIAL_PAIR", "Unordered pair override is ambiguous");
      pairs.add(key);
      checkGenerator(pair.generator, rule, document, context, authoringOnly);
    }
  }
  const profiles = new Map(document.profiles.map((item) => [item.profileId, item]));
  for (const binding of document.bindings) {
    const object = context.objects.find((item) => item.objectId === binding.objectId);
    if (!object) fail("UNKNOWN_OBJECT", "Binding object not registered");
    if (object.generation !== binding.objectGeneration)
      fail("STALE_OBJECT_GENERATION", "Binding object generation differs");
    const profile = profiles.get(binding.profileId);
    if (!profile) fail("UNKNOWN_PROFILE", "Binding profile missing");
    if (profile.revision !== binding.profileRevision)
      fail("STALE_PROFILE_REVISION", "Binding profile revision differs");
    unique(binding.overrides, (item) => item.ruleId, "rule override");
    for (const override of binding.overrides)
      if (!profile.rules.some((rule) => rule.ruleId === override.ruleId))
        fail("UNKNOWN_RULE", "Override target missing");
  }
  return {
    document,
    context,
    profiles,
    bindings: [...document.bindings].sort((a, b) => compareIds(a.bindingId, b.bindingId)),
  };
}

export function createProfileRegistry(
  input: SoundBehaviorDocument,
  context: BehaviorContext,
): ProfileRegistry {
  return buildProfileRegistry(input, context, false);
}

/** Persistence preflight only: unresolved bytes/rights cannot activate audio. */
export function validateBehaviorAuthoring(
  document: SoundBehaviorDocument,
  context: BehaviorContext,
): { ok: true; scope: "AUTHORING_ONLY_NOT_ACTIVATED" } {
  buildProfileRegistry(document, context, true);
  return { ok: true, scope: "AUTHORING_ONLY_NOT_ACTIVATED" };
}

export function mapParameter(mapping: ParameterMapping, input: number): number {
  assertFinite(input, -1e12, 1e12, mapping.input);
  checkMapping(mapping);
  const x = Math.max(
    0,
    Math.min(1, (input - mapping.inputMin) / (mapping.inputMax - mapping.inputMin)),
  );
  let y = mapping.curve.at(-1)!.y;
  for (let i = 1; i < mapping.curve.length; i++) {
    const a = mapping.curve[i - 1]!,
      b = mapping.curve[i]!;
    if (x < b.x || (i === mapping.curve.length - 1 && x <= b.x)) {
      y =
        mapping.interpolation === "step"
          ? x === b.x
            ? b.y
            : a.y
          : a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
      break;
    }
  }
  const out = mapping.outputMin + y * (mapping.outputMax - mapping.outputMin);
  if (!Number.isFinite(out)) fail("MAPPING_OVERFLOW", "Mapping result overflowed");
  return out;
}

export function checkMetrics(metrics: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(metrics)) {
    if (!metricNames.has(name)) fail("UNKNOWN_METRIC", `Unknown metric: ${name}`);
    if (value !== null) assertFinite(value, 0, 1e12, name);
  }
}
