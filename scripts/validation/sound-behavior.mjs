import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const documentId =
  "https://reflection-lab.local/schemas/sound-behavior/behavior-document.schema.json";
const proposalId =
  "https://reflection-lab.local/schemas/sound-behavior/sound-behavior-ai.schema.json";
const ajv = new Ajv2020({ strict: true, allErrors: true, strictNumbers: true });
for (const file of ["behavior-document", "sound-behavior-ai"])
  ajv.addSchema(
    JSON.parse(
      readFileSync(
        new URL(`../../schemas/sound-behavior/${file}.schema.json`, import.meta.url),
        "utf8",
      ),
    ),
  );

export function loadSoundBehaviorValidators() {
  return new Map([
    ["document", ajv.getSchema(documentId)],
    ["proposal", ajv.getSchema(proposalId)],
  ]);
}
const issue = (errors, code, path, message) => errors.push({ code, path, message });
function schemaErrors(id, value) {
  const validate = ajv.getSchema(id);
  if (validate(value)) return [];
  return validate.errors.map((error) => ({
    code: "SCHEMA",
    path: error.instancePath || "/",
    message: error.message,
  }));
}
const result = (errors) => ({
  ok: errors.length === 0,
  validationScope: "SCHEMA_AND_DOMAIN_DRAFT_ONLY",
  errors,
});
const duplicateIds = (items, key, errors, prefix) => {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item[key]))
      issue(errors, "DUPLICATE_ID", prefix, `Duplicate ${key}: ${item[key]}`);
    seen.add(item[key]);
  }
};
const list = (value) => (Array.isArray(value) ? value : []);
const assetKey = (asset) => `${asset.assetId}@${asset.revision}`;
const contactTriggers = new Set(["OnImpact", "OnBounce", "WhileRolling", "WhileSliding"]);
const impactTriggers = new Set(["OnImpact", "OnBounce"]);
const frictionTriggers = new Set(["WhileRolling", "WhileSliding"]);
function availableMetrics(trigger) {
  return new Set([
    "sourceSpeedMetresPerSecond",
    "angularSpeedRadiansPerSecond",
    ...(impactTriggers.has(trigger)
      ? ["normalImpulseNewtonSeconds", "closingSpeedMetresPerSecond", "tangentSpeedMetresPerSecond"]
      : []),
    ...(frictionTriggers.has(trigger)
      ? ["slipSpeedMetresPerSecond", "tangentSpeedMetresPerSecond", "contactSupportForceNewtons"]
      : []),
  ]);
}
function checkAsset(asset, document, context, errors, path) {
  const pin = document.assets.find((entry) => assetKey(entry) === assetKey(asset));
  if (!pin || pin.sha256 !== asset.sha256)
    issue(errors, "ASSET_PIN_MISMATCH", path, "Asset is not pinned by this behavior document");
  const host = list(context.assetRegistry).find((entry) => assetKey(entry) === assetKey(asset));
  if (!host)
    return issue(errors, "UNKNOWN_ASSET", path, "Asset must exist in the trusted host registry");
  if (host.sha256 !== asset.sha256)
    issue(errors, "ASSET_HASH_MISMATCH", path, "Asset content revision differs from host registry");
  const fixture =
    context.validationMode === "offlineFixture" &&
    host.availability === "FIXTURE_ONLY" &&
    host.rightsStatus === "FIXTURE_ONLY";
  if (!fixture && host.availability !== "READY")
    issue(
      errors,
      "ASSET_NOT_READY",
      path,
      "Missing and fixture-only descriptors are not playable product assets",
    );
  if (!fixture && host.rightsStatus !== "APPROVED")
    issue(errors, "ASSET_RIGHTS_UNVERIFIED", path, "Host must independently confirm asset rights");
}
function checkGenerator(generator, rule, document, context, errors, path) {
  if (
    generator.kind === "oscillator" &&
    rule.trigger.kind === "discrete" &&
    !rule.lifecycle &&
    rule.oneShotDurationSeconds === undefined
  )
    issue(
      errors,
      "ONE_SHOT_DURATION_REQUIRED",
      path,
      "Every selected discrete oscillator, including material-pair variants, needs a finite stop duration",
    );
  if (generator.kind !== "sample") return;
  checkAsset(generator.asset, document, context, errors, path + "/asset");
  const loopRequired = rule.trigger.kind === "continuous" || rule.lifecycle?.mode === "latched";
  if (generator.loop !== loopRequired)
    issue(
      errors,
      "LOOP_TRIGGER_MISMATCH",
      path,
      "Continuous/latched sample rules loop; plain discrete rules are one-shot",
    );
  const host = list(context.assetRegistry).find(
    (entry) => assetKey(entry) === assetKey(generator.asset),
  );
  if (
    Number.isFinite(host?.durationSeconds) &&
    generator.startOffsetSeconds >= host.durationSeconds
  )
    issue(errors, "ASSET_OFFSET_RANGE", path, "Sample offset is outside decoded asset duration");
}
function checkRule(rule, document, context, errors, path) {
  const allowed = availableMetrics(rule.trigger.type);
  if (contactTriggers.has(rule.trigger.type) && rule.emitter.attachment !== "contact")
    issue(
      errors,
      "CONTACT_EMITTER_REQUIRED",
      path + "/emitter",
      "Contact sounds originate at the representative contact position",
    );
  if (rule.emitter.attachment === "contact" && !contactTriggers.has(rule.trigger.type))
    issue(
      errors,
      "CONTACT_CONTEXT_UNAVAILABLE",
      path + "/emitter",
      "This trigger does not provide contact geometry",
    );
  if (rule.emitter.attachment === "zone" && !list(context.zoneIds).includes(rule.emitter.zoneId))
    issue(errors, "UNKNOWN_ZONE", path + "/emitter", "Zone must exist in the scene registry");
  if (rule.lifecycle) {
    if (rule.trigger.kind !== "discrete")
      issue(
        errors,
        "LATCH_START_REQUIRES_DISCRETE",
        path + "/lifecycle",
        "A latch starts from an accepted discrete event",
      );
    if (rule.lifecycle.stopOn.includes(rule.trigger.type))
      issue(
        errors,
        "LATCH_AMBIGUOUS_TRIGGER",
        path + "/lifecycle",
        "Start trigger cannot also stop this latch",
      );
  }
  const plainDiscrete = rule.trigger.kind === "discrete" && !rule.lifecycle;
  if (
    plainDiscrete &&
    rule.generator.kind === "oscillator" &&
    rule.oneShotDurationSeconds === undefined
  )
    issue(
      errors,
      "ONE_SHOT_DURATION_REQUIRED",
      path,
      "A discrete oscillator must have a finite stop duration",
    );
  if (rule.oneShotDurationSeconds !== undefined) {
    if (!plainDiscrete)
      issue(
        errors,
        "UNEXPECTED_ONE_SHOT_DURATION",
        path,
        "Continuous/latched lifetime uses state or its explicit lifecycle",
      );
    if (rule.fadeInSeconds + rule.fadeOutSeconds > rule.oneShotDurationSeconds)
      issue(
        errors,
        "ONE_SHOT_ENVELOPE_RANGE",
        path,
        "One-shot attack and release must fit inside its finite duration",
      );
  }
  checkGenerator(rule.generator, rule, document, context, errors, path + "/generator");
  const targets = new Set();
  duplicateIds(rule.mappings, "mappingId", errors, path + "/mappings");
  for (const [index, mapping] of rule.mappings.entries()) {
    const mp = `${path}/mappings/${index}`;
    if (!allowed.has(mapping.input))
      issue(errors, "METRIC_UNAVAILABLE", mp, "Mapping input is unavailable for this trigger");
    if (targets.has(mapping.target))
      issue(
        errors,
        "DUPLICATE_MAPPING_TARGET",
        mp,
        "One rule may assign each output parameter only once",
      );
    targets.add(mapping.target);
    if (!(mapping.inputMin < mapping.inputMax) || !(mapping.outputMin <= mapping.outputMax))
      issue(errors, "MAPPING_RANGE", mp, "Mapping ranges must be ordered and input range nonzero");
    const range = { gainLinear: [0, 4], pitchSemitones: [-24, 24], filterCutoffHz: [20, 20000] }[
      mapping.target
    ];
    if (mapping.outputMin < range[0] || mapping.outputMax > range[1])
      issue(errors, "MAPPING_OUTPUT_RANGE", mp, "Output exceeds the declared parameter range");
    if (
      mapping.curve[0].x !== 0 ||
      mapping.curve.at(-1).x !== 1 ||
      mapping.curve.some((p, i) => i > 0 && p.x <= mapping.curve[i - 1].x)
    )
      issue(errors, "CURVE_DOMAIN", mp, "Curve must cover [0,1] with strictly increasing x values");
  }
  for (const [index, condition] of rule.conditions.entries()) {
    const cp = `${path}/conditions/${index}`;
    if (condition.kind === "metric" && !allowed.has(condition.input))
      issue(errors, "METRIC_UNAVAILABLE", cp, "Condition input is unavailable for this trigger");
    if (condition.kind === "materialPair") {
      if (!contactTriggers.has(rule.trigger.type))
        issue(
          errors,
          "CONTACT_CONTEXT_UNAVAILABLE",
          cp,
          "Material-pair conditions require a contact trigger",
        );
      for (const id of [condition.materialA, condition.materialB])
        if (!list(context.materialIds).includes(id))
          issue(errors, "UNKNOWN_MATERIAL", cp, "Material must exist in the host registry");
    }
  }
}

export function validateSoundBehaviorDocument(document, context = {}) {
  const errors = schemaErrors(documentId, document);
  if (errors.length) return result(errors);
  context = context && typeof context === "object" ? context : {};
  duplicateIds(document.profiles, "profileId", errors, "/profiles");
  duplicateIds(document.bindings, "bindingId", errors, "/bindings");
  const pins = new Set();
  for (const [index, asset] of document.assets.entries()) {
    const key = assetKey(asset);
    if (pins.has(key))
      issue(errors, "DUPLICATE_ASSET_PIN", `/assets/${index}`, "Asset version must be pinned once");
    pins.add(key);
    checkAsset(asset, document, context, errors, `/assets/${index}`);
  }
  for (const [index, profile] of document.profiles.entries()) {
    const path = `/profiles/${index}`;
    duplicateIds(profile.rules, "ruleId", errors, path + "/rules");
    duplicateIds(
      profile.materialPairOverrides,
      "overrideId",
      errors,
      path + "/materialPairOverrides",
    );
    for (const [ri, rule] of profile.rules.entries())
      checkRule(rule, document, context, errors, `${path}/rules/${ri}`);
    const pairs = new Set();
    for (const override of profile.materialPairOverrides) {
      const rule = profile.rules.find((entry) => entry.ruleId === override.ruleId);
      if (!rule)
        issue(errors, "UNKNOWN_RULE", path, "Material-pair override refers to a missing rule");
      else {
        if (!contactTriggers.has(rule.trigger.type))
          issue(
            errors,
            "CONTACT_CONTEXT_UNAVAILABLE",
            path,
            "Pair overrides require a contact-triggered rule",
          );
        checkGenerator(
          override.generator,
          rule,
          document,
          context,
          errors,
          path + "/materialPairOverrides",
        );
      }
      for (const id of [override.materialA, override.materialB])
        if (!list(context.materialIds).includes(id))
          issue(errors, "UNKNOWN_MATERIAL", path, "Material override must use host registry IDs");
      const key = `${override.ruleId}:${[override.materialA, override.materialB].sort().join("|")}`;
      if (pairs.has(key))
        issue(errors, "DUPLICATE_MATERIAL_PAIR", path, "Unordered pair override is ambiguous");
      pairs.add(key);
    }
  }
  for (const [index, binding] of document.bindings.entries()) {
    const path = `/bindings/${index}`;
    const object = list(context.objects).find((entry) => entry.objectId === binding.objectId);
    if (!object) issue(errors, "UNKNOWN_OBJECT", path, "Binding requires a host object ID");
    else if (object.generation !== binding.objectGeneration)
      issue(errors, "STALE_OBJECT_GENERATION", path, "Object was deleted/recreated");
    const profile = document.profiles.find((entry) => entry.profileId === binding.profileId);
    if (!profile) issue(errors, "UNKNOWN_PROFILE", path, "Binding requires an existing profile");
    else {
      if (profile.revision !== binding.profileRevision)
        issue(errors, "STALE_PROFILE_REVISION", path, "Binding pins an exact profile revision");
      duplicateIds(binding.overrides, "ruleId", errors, path + "/overrides");
      for (const override of binding.overrides)
        if (!profile.rules.some((rule) => rule.ruleId === override.ruleId))
          issue(errors, "UNKNOWN_RULE", path, "Override target is not part of the shared profile");
    }
  }
  return result(errors);
}
function resolveRule(value, document, errors) {
  const binding = document.bindings.find((entry) => entry.bindingId === value.bindingId);
  const profile = document.profiles.find((entry) => entry.profileId === value.profileId);
  const rule = profile?.rules.find((entry) => entry.ruleId === value.ruleId);
  if (!binding || !profile || !rule) {
    issue(
      errors,
      "UNKNOWN_RUNTIME_REFERENCE",
      "/",
      "Runtime record must refer to existing binding/profile/rule",
    );
    return {};
  }
  if (
    binding.profileId !== profile.profileId ||
    value.profileRevision !== profile.revision ||
    binding.profileRevision !== profile.revision
  )
    issue(
      errors,
      "STALE_PROFILE_REVISION",
      "/profileRevision",
      "Runtime record pins a different profile revision",
    );
  if (value.objectId !== binding.objectId || value.generation !== binding.objectGeneration)
    issue(
      errors,
      "STALE_OBJECT_GENERATION",
      "/generation",
      "Runtime object identity differs from the binding",
    );
  return { binding, profile, rule };
}
function effectiveEnabled(binding, rule) {
  const override = binding.overrides.find((entry) => entry.ruleId === rule.ruleId);
  return binding.enabled && (override?.enabled ?? rule.enabled);
}
function checkEpoch(value, context, errors) {
  for (const key of ["experimentId", "runEpoch", "sceneRevision"])
    if (context[key] !== undefined && value[key] !== context[key])
      issue(
        errors,
        "STALE_EPOCH_OR_SCENE",
        `/${key}`,
        "Runtime record belongs to another experiment, epoch or scene revision",
      );
}

export function validateAudioEvent(event, document, context = {}) {
  const errors = schemaErrors(documentId + "#/$defs/AudioEvent", event);
  if (errors.length) return result(errors);
  errors.push(...validateSoundBehaviorDocument(document, context).errors);
  if (errors.length) return result(errors);
  checkEpoch(event, context, errors);
  const { binding, rule } = resolveRule(event, document, errors);
  if (rule && !effectiveEnabled(binding, rule) && event.action !== "stop")
    issue(
      errors,
      "DISABLED_EVENT",
      "/action",
      "Disabled behavior accepts cleanup stops, not new or updated emissions",
    );
  if (Math.abs(event.simulationTimeSeconds - event.tick * event.fixedDtSeconds) > 1e-9)
    issue(
      errors,
      "PHYSICS_CLOCK_MISMATCH",
      "/simulationTimeSeconds",
      "Physics time is tick * fixedDt; not AudioContext.currentTime",
    );
  if (
    rule &&
    (rule.trigger.kind !== event.trigger.kind || rule.trigger.type !== event.trigger.type)
  )
    issue(errors, "TRIGGER_MISMATCH", "/trigger", "Emission trigger differs from its pinned rule");
  if (
    event.trigger.kind === "discrete" &&
    (!event.parentPhysicsEventId ||
      !list(context.physicsEventIds).includes(event.parentPhysicsEventId))
  )
    issue(
      errors,
      "UNKNOWN_PHYSICS_EVENT",
      "/parentPhysicsEventId",
      "Discrete emissions require an existing normalized physics/player input event",
    );
  if (rule?.emitter.attachment === "contact") {
    if (!event.contact)
      issue(
        errors,
        "CONTACT_REQUIRED",
        "/contact",
        "Contact emitter needs representative geometry",
      );
    else if (
      event.positionMetres.some(
        (value, index) => Math.abs(value - event.contact.pointWorldMetres[index]) > 1e-8,
      )
    )
      issue(
        errors,
        "CONTACT_POSITION_MISMATCH",
        "/positionMetres",
        "Impact emitter cannot silently move to the body center",
      );
  }
  if (event.contact) {
    const contact = event.contact;
    for (const [colliderId, objectId] of [
      [contact.colliderA, contact.objectA],
      [contact.colliderB, contact.objectB],
    ]) {
      const collider = list(context.colliders).find((entry) => entry.colliderId === colliderId);
      if (!collider || collider.objectId !== objectId)
        issue(
          errors,
          "CONTACT_COLLIDER_IDENTITY",
          "/contact",
          "Contact collider must exist and belong to the indicated participant",
        );
    }
    const objects = list(context.objects).map((entry) => entry.objectId);
    if (
      !objects.includes(contact.objectA) ||
      !objects.includes(contact.objectB) ||
      contact.objectA === contact.objectB ||
      ![contact.objectA, contact.objectB].includes(event.objectId)
    )
      issue(
        errors,
        "CONTACT_OBJECT_IDENTITY",
        "/contact",
        "Contact participants must be distinct known objects and include the emitter object",
      );
    if (Math.abs(Math.hypot(...contact.normalAtoB) - 1) > 1e-6)
      issue(
        errors,
        "CONTACT_NORMAL",
        "/contact/normalAtoB",
        "Canonical A-to-B normal must be unit length",
      );
    if ((contact.impulseMethod === "Unavailable") !== (contact.normalImpulseNewtonSeconds === null))
      issue(
        errors,
        "IMPULSE_PROVENANCE",
        "/contact",
        "Unknown impulse is null; force-dt estimates are separately labeled",
      );
    const bothUnknown =
      contact.closingSpeedMetresPerSecond === null && contact.tangentSpeedMetresPerSecond === null;
    if ((contact.velocityMethod === "Unavailable") !== bothUnknown)
      issue(
        errors,
        "VELOCITY_PROVENANCE",
        "/contact",
        "Velocity availability must agree with the method label",
      );
    for (const material of [contact.materialA, contact.materialB])
      if (!list(context.materialIds).includes(material))
        issue(errors, "UNKNOWN_MATERIAL", "/contact", "Contact material must exist in registry");
  }
  return result(errors);
}

export function validateRuntimeState(state, document, context = {}) {
  const errors = schemaErrors(documentId + "#/$defs/BehaviorRuntimeState", state);
  if (errors.length) return result(errors);
  errors.push(...validateSoundBehaviorDocument(document, context).errors);
  if (errors.length) return result(errors);
  checkEpoch(state, context, errors);
  if (state.documentId !== document.documentId || state.documentRevision !== document.revision)
    issue(
      errors,
      "STALE_DOCUMENT_REVISION",
      "/",
      "Snapshot belongs to another behavior document revision",
    );
  duplicateIds(state.instances, "instanceId", errors, "/instances");
  duplicateIds(state.bindings, "bindingId", errors, "/bindings");
  const active = state.instances.filter((entry) => entry.playbackState !== "stopped");
  if (
    !Number.isInteger(context.maxVoices) ||
    context.maxVoices < 0 ||
    active.length > context.maxVoices
  )
    issue(errors, "VOICE_BUDGET", "/instances", "Active instances exceed the host voice policy");
  const counts = new Map();
  for (const instance of state.instances) {
    const { binding, rule } = resolveRule(instance, document, errors);
    if (!rule) continue;
    const expectedKind =
      rule.trigger.kind === "continuous" || rule.lifecycle ? "continuous" : "oneShot";
    if (instance.kind !== expectedKind)
      issue(
        errors,
        "INSTANCE_KIND_MISMATCH",
        "/instances",
        "Instance lifecycle differs from its trigger/latch",
      );
    if (
      !effectiveEnabled(binding, rule) &&
      ["scheduled", "playing"].includes(instance.playbackState)
    )
      issue(
        errors,
        "DISABLED_INSTANCE",
        "/instances",
        "Disabled rules may fade/stop but cannot keep playing",
      );
    if (instance.startedAtTick > state.tick)
      issue(errors, "INSTANCE_CLOCK", "/instances", "Started-at tick is in the future");
    if (
      instance.kind === "oneShot" &&
      rule.oneShotDurationSeconds !== undefined &&
      state.tick >=
        instance.startedAtTick + Math.ceil(rule.oneShotDurationSeconds / state.fixedDtSeconds) &&
      ["scheduled", "playing"].includes(instance.playbackState)
    )
      issue(
        errors,
        "ONE_SHOT_EXPIRED",
        "/instances",
        "A one-shot at/after its duration may only fade or stop",
      );
    if (rule.lifecycle) {
      if (!instance.latch)
        issue(
          errors,
          "LATCH_STATE_REQUIRED",
          "/instances",
          "Latched voice must preserve start event and deadline across checkpoint",
        );
      else {
        if (!list(context.physicsEventIds).includes(instance.latch.startEventId))
          issue(
            errors,
            "UNKNOWN_PHYSICS_EVENT",
            "/instances/latch",
            "Latched start must refer to the normalized input trace",
          );
        if (
          instance.latch.deadlineTick !==
          instance.startedAtTick +
            Math.ceil(rule.lifecycle.maxDurationSeconds / state.fixedDtSeconds)
        )
          issue(
            errors,
            "LATCH_DEADLINE",
            "/instances",
            "Latch duration must be finite and bound to the fixed clock",
          );
      }
      if (
        state.tick >= instance.latch?.deadlineTick &&
        ["scheduled", "playing"].includes(instance.playbackState)
      )
        issue(
          errors,
          "LATCH_EXPIRED",
          "/instances",
          "A latch at/after its deadline may only fade or stop",
        );
    } else if (instance.latch)
      issue(
        errors,
        "UNEXPECTED_LATCH_STATE",
        "/instances",
        "Plain rule cannot contain hidden latch state",
      );
    if (instance.playbackState !== "stopped") {
      const key = `${instance.bindingId}:${instance.ruleId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (counts.get(key) > rule.voiceLimit)
        issue(errors, "RULE_VOICE_BUDGET", "/instances", "Rule instance budget exceeded");
    }
  }
  for (const bindingState of state.bindings) {
    const binding = document.bindings.find((entry) => entry.bindingId === bindingState.bindingId);
    const profile = document.profiles.find((entry) => entry.profileId === binding?.profileId);
    if (!binding || !profile) {
      issue(
        errors,
        "UNKNOWN_RUNTIME_REFERENCE",
        "/bindings",
        "Binding state has no document binding",
      );
      continue;
    }
    for (const id of [
      ...bindingState.activeRuleIds,
      ...bindingState.cooldowns.map((entry) => entry.ruleId),
    ])
      if (!profile.rules.some((rule) => rule.ruleId === id))
        issue(errors, "UNKNOWN_RULE", "/bindings", "Runtime active/cooldown rule does not exist");
    for (const id of bindingState.activeRuleIds) {
      const rule = profile.rules.find((entry) => entry.ruleId === id);
      if (
        rule &&
        ((rule.trigger.kind !== "continuous" && !rule.lifecycle) ||
          !effectiveEnabled(binding, rule))
      )
        issue(
          errors,
          "INVALID_ACTIVE_RULE",
          "/bindings/activeRuleIds",
          "Only enabled continuous/latched rules have active state",
        );
    }
    duplicateIds(bindingState.cooldowns, "ruleId", errors, "/bindings/cooldowns");
  }
  return result(errors);
}

/** Simulate a complete bounded proposal on a clone solely to validate references; never apply to host. */
export function validateBehaviorProposal(proposal, document, context = {}) {
  const errors = schemaErrors(proposalId, proposal);
  if (errors.length) return result(errors);
  errors.push(...validateSoundBehaviorDocument(document, context).errors);
  if (errors.length) return result(errors);
  const hostLimit = context.maxProposalOperations ?? 32;
  if (
    !Number.isInteger(hostLimit) ||
    hostLimit < 0 ||
    proposal.operations.length > Math.min(32, hostLimit)
  )
    issue(
      errors,
      "HOST_OPERATION_BUDGET",
      "/operations",
      "Draft schema capacity does not override the stricter host mutation budget",
    );
  if (
    proposal.sceneId !== context.sceneId ||
    proposal.expectedSceneRevision !== context.sceneRevision
  )
    issue(
      errors,
      "STALE_SCENE_REVISION",
      "/expectedSceneRevision",
      "Proposal has a stale scene precondition",
    );
  if (proposal.expectedBehaviorRevision !== document.revision)
    issue(
      errors,
      "STALE_DOCUMENT_REVISION",
      "/expectedBehaviorRevision",
      "Proposal has a stale behavior document precondition",
    );
  if (errors.length) return result(errors);
  const next = structuredClone(document);
  for (const [index, operation] of proposal.operations.entries()) {
    const path = `/operations/${index}`;
    const existing = next.profiles.find((profile) => profile.profileId === operation.profileId);
    if (operation.type === "CreateProfile") {
      if (next.profiles.some((profile) => profile.profileId === operation.profile.profileId))
        issue(errors, "DUPLICATE_ID", path, "Profile already exists");
      if (operation.profile.revision !== 1)
        issue(errors, "PROFILE_REVISION_SEQUENCE", path, "New profile starts at revision 1");
      next.profiles.push(operation.profile);
    } else if (operation.type === "ReplaceProfile") {
      if (!existing) issue(errors, "UNKNOWN_PROFILE", path, "Replacement profile does not exist");
      else if (
        existing.revision !== operation.expectedProfileRevision ||
        operation.profile.revision !== existing.revision + 1 ||
        operation.profile.profileId !== existing.profileId
      )
        issue(
          errors,
          "STALE_PROFILE_REVISION",
          path,
          "Full replacement must keep ID and increment the expected profile revision",
        );
      else next.profiles[next.profiles.indexOf(existing)] = operation.profile;
    } else if (operation.type === "DeleteProfile") {
      if (!existing || existing.revision !== operation.expectedProfileRevision)
        issue(
          errors,
          "STALE_PROFILE_REVISION",
          path,
          "Delete requires the current profile revision",
        );
      else next.profiles = next.profiles.filter((entry) => entry !== existing);
    } else if (operation.type === "AssignBinding") {
      if (next.bindings.some((entry) => entry.bindingId === operation.binding.bindingId))
        issue(
          errors,
          "DUPLICATE_ID",
          path,
          "Binding ID already exists; remove/reassign explicitly",
        );
      else next.bindings.push(operation.binding);
    } else if (operation.type === "RemoveBinding") {
      if (!next.bindings.some((entry) => entry.bindingId === operation.bindingId))
        issue(errors, "UNKNOWN_BINDING", path, "Binding to remove does not exist");
      else next.bindings = next.bindings.filter((entry) => entry.bindingId !== operation.bindingId);
    }
  }
  const derivedAssetPins = [];
  for (const profile of next.profiles) {
    const generators = [
      ...profile.rules.map((rule) => rule.generator),
      ...profile.materialPairOverrides.map((override) => override.generator),
    ];
    for (const generator of generators) {
      if (
        generator.kind !== "sample" ||
        next.assets.some((asset) => assetKey(asset) === assetKey(generator.asset))
      )
        continue;
      const catalog = list(context.assetRegistry).find(
        (entry) =>
          assetKey(entry) === assetKey(generator.asset) && entry.sha256 === generator.asset.sha256,
      );
      if (!catalog) continue;
      const pin = { assetId: catalog.assetId, revision: catalog.revision, sha256: catalog.sha256 };
      next.assets.push(pin);
      derivedAssetPins.push(pin);
    }
  }
  if (!errors.length) errors.push(...validateSoundBehaviorDocument(next, context).errors);
  return { ...result(errors), derivedAssetPins: errors.length ? [] : derivedAssetPins };
}

export function validateSoundBehaviorComparison(comparison) {
  const errors = schemaErrors(documentId + "#/$defs/SoundBehaviorComparison", comparison);
  if (errors.length) return result(errors);
  const { runA, runB, independentVariables: variables, comparisonKind: kind } = comparison;
  if (runA.runId === runB.runId)
    issue(errors, "COMPARISON_SAME_RUN", "/", "Comparison requires distinct run artifacts");
  for (const key of [
    "sceneGeometryHash",
    "physicsConfigHash",
    "motionTraceHash",
    "physicsEventTraceHash",
    "listenerTraceHash",
    "solverConfigHash",
    "atmosphereHash",
  ])
    if (runA[key] !== runB[key])
      issue(
        errors,
        "COMPARISON_FIXED_INPUT_CHANGED",
        "/" + key,
        "Physics, motion, input events, listener, solver and atmosphere must remain fixed",
      );
  if (kind === "acoustic") {
    if (variables.some((value) => value !== "acousticMaterial"))
      issue(
        errors,
        "COMPARISON_VARIABLE_KIND",
        "/independentVariables",
        "Acoustic comparison only varies acoustic material in this draft",
      );
    for (const key of [
      "profileHash",
      "assetManifestHash",
      "generatorConfigHash",
      "sourceSignalHash",
    ])
      if (runA[key] !== runB[key])
        issue(
          errors,
          "COMPARISON_SOURCE_CHANGED",
          "/" + key,
          "Acoustic/material comparison fixes source generation",
        );
  } else {
    if (variables.includes("acousticMaterial"))
      issue(
        errors,
        "COMPARISON_VARIABLE_KIND",
        "/independentVariables",
        "Behavior comparison cannot also change propagation materials",
      );
    if (runA.propagationMaterialHash !== runB.propagationMaterialHash)
      issue(
        errors,
        "COMPARISON_PROPAGATION_CHANGED",
        "/propagationMaterialHash",
        "Behavior comparison fixes propagation materials",
      );
    for (const [key, allowed] of [
      ["assetManifestHash", ["sourceAsset"]],
      ["generatorConfigHash", ["generator"]],
      [
        "profileHash",
        ["sourceAsset", "generator", "gainMapping", "pitchMapping", "behaviorProfile"],
      ],
    ])
      if (runA[key] !== runB[key] && !allowed.some((entry) => variables.includes(entry)))
        issue(
          errors,
          "COMPARISON_UNDECLARED_VARIABLE",
          "/" + key,
          "Changed generation input is not a declared independent variable",
        );
    if (
      runA.sourceSignalHash !== runB.sourceSignalHash &&
      ["profileHash", "assetManifestHash", "generatorConfigHash"].every(
        (key) => runA[key] === runB[key],
      )
    )
      issue(
        errors,
        "COMPARISON_UNEXPLAINED_SOURCE_CHANGE",
        "/sourceSignalHash",
        "Source signal differs without any recorded generation input change",
      );
  }
  return result(errors);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = (name) =>
    JSON.parse(
      readFileSync(
        new URL(`../../schemas/sound-behavior/examples/${name}.json`, import.meta.url),
        "utf8",
      ),
    );
  const document = fixture("document"),
    context = fixture("context");
  const checks = {
    document: validateSoundBehaviorDocument(document, context),
    event: validateAudioEvent(fixture("audio-event"), document, context),
    runtimeState: validateRuntimeState(fixture("runtime-state"), document, context),
    proposal: validateBehaviorProposal(fixture("proposal"), document, context),
    comparison: validateSoundBehaviorComparison(fixture("comparison")),
  };
  const ok = Object.values(checks).every((entry) => entry.ok);
  console.log(
    JSON.stringify(
      {
        status: ok ? "PASS" : "FAIL",
        scope:
          "Draft JSON/schema/domain fixture validation; no behavior/audio/Meta runtime executed",
        checks,
      },
      null,
      2,
    ),
  );
  if (!ok) process.exitCode = 1;
}
