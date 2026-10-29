import type {
  AudioEvent,
  BehaviorBinding,
  ContactData,
  MetricInput,
  SoundBehaviorDocument,
  SoundBehaviorProfile,
  SoundBehaviorRule,
  SoundGenerator,
  SoundInstance,
  Vec3,
} from "../../schemas/sound-behavior/types.js";
import {
  assertFinite,
  assertId,
  audioEventValidator,
  checkMetrics,
  compareIds,
  contactValidator,
  createProfileRegistry,
  effectiveRule,
  fail,
  generatorValidator,
  mapParameter,
  stateValidator,
  unique,
} from "./profile-registry.js";
import { initialState, integer, stableId } from "./runtime-state.js";
import { appendTrace } from "./trace.js";
import { compareVoiceCandidates, voiceAdmission } from "./voice-admission.js";
import type {
  BehaviorContext,
  BehaviorDecision,
  BehaviorFrame,
  BehaviorObjectInput,
  BehaviorRuntime,
  BehaviorRuntimeOptions,
  BehaviorSnapshot,
  BehaviorStepResult,
  NormalizedBehaviorEvent,
  VoiceIntent,
} from "./types.js";

export { mapParameter } from "./profile-registry.js";
export { validateBehaviorAuthoring } from "./profile-registry.js";
export { createProfileRegistry } from "./profile-registry.js";
export { BehaviorRuntimeError } from "./types.js";
export type * from "./types.js";

const interactionTriggers = new Set(["OnGrab", "OnRelease", "OnThrow", "OnDrop"]);
const physicsTriggers = new Set(["OnImpact", "OnBounce"]);
const discreteTriggers = new Set([
  "OnGrab",
  "OnRelease",
  "OnThrow",
  "OnDrop",
  "OnImpact",
  "OnBounce",
  "OnStartMoving",
  "OnStopMoving",
  "OnEnterZone",
  "OnExitZone",
  "OnSleep",
  "OnWake",
]);
const emptyResult = (): BehaviorStepResult => ({ events: [], voices: [], decisions: [] });
type VoiceMeta = BehaviorSnapshot["voiceMetadata"][number];
type Metrics = Partial<Record<MetricInput, number | null>>;
type Candidate = {
  binding: BehaviorBinding;
  profile: SoundBehaviorProfile;
  rule: SoundBehaviorRule;
  object: BehaviorObjectInput;
  input: NormalizedBehaviorEvent | null;
  metrics: Metrics;
  contact: ContactData | undefined;
};

function pairMatches(a: string, b: string, contact: ContactData | undefined): boolean {
  return Boolean(
    contact &&
      ((a === contact.materialA && b === contact.materialB) ||
        (a === contact.materialB && b === contact.materialA)),
  );
}

function vector(value: Vec3, label: string): void {
  if (!Array.isArray(value) || value.length !== 3)
    fail("INVALID_VECTOR", `${label} must be a 3-vector`);
  for (const component of value) assertFinite(component, -1e6, 1e6, label);
}

function positionFor(candidate: Candidate, context: BehaviorContext): Vec3 | null {
  const { emitter } = candidate.rule;
  if (emitter.attachment === "fixed") return [...emitter.positionMetres];
  if (emitter.attachment === "contact")
    return candidate.contact ? [...candidate.contact.pointWorldMetres] : null;
  if (emitter.attachment === "zone")
    return context.zonePositions?.[emitter.zoneId]
      ? [...context.zonePositions[emitter.zoneId]!]
      : null;
  let [x, y, z] = emitter.offsetMetres;
  if (candidate.object.rotation) {
    const [qx, qy, qz, qw] = candidate.object.rotation;
    const tx = 2 * (qy * z - qz * y),
      ty = 2 * (qz * x - qx * z),
      tz = 2 * (qx * y - qy * x);
    x += qw * tx + qy * tz - qz * ty;
    y += qw * ty + qz * tx - qx * tz;
    z += qw * tz + qx * ty - qy * tx;
  }
  const out: Vec3 = [
    candidate.object.positionMetres[0] + x,
    candidate.object.positionMetres[1] + y,
    candidate.object.positionMetres[2] + z,
  ];
  vector(out, "emitter position");
  return out;
}

function level(rule: SoundBehaviorRule, object: BehaviorObjectInput): boolean {
  if (rule.trigger.kind !== "continuous") return false;
  switch (rule.trigger.type) {
    case "AlwaysOn":
      return true;
    case "WhileMoving":
      return object.states.moving === true;
    case "WhileAirborne":
      return object.states.airborne === true && object.states.held === false;
    case "WhileRolling":
      return object.states.rolling === true;
    case "WhileSliding":
      return object.states.sliding === true;
    case "WhileSpinning":
      return object.states.spinning === true;
    case "WhileHeld":
      return object.states.held === true;
  }
}

function conditions(candidate: Candidate): boolean {
  return candidate.rule.conditions.every((condition) => {
    if (condition.kind === "state")
      return candidate.object.states[condition.state] === condition.equals;
    if (condition.kind === "materialPair")
      return pairMatches(condition.materialA, condition.materialB, candidate.contact);
    const value = candidate.metrics[condition.input];
    if (value === undefined || value === null) return false;
    switch (condition.operator) {
      case "gt":
        return value > condition.value;
      case "gte":
        return value >= condition.value;
      case "lt":
        return value < condition.value;
      case "lte":
        return value <= condition.value;
    }
  });
}

function parameters(candidate: Candidate): {
  gainLinear: number;
  pitchSemitones: number;
  filterCutoffHz: number | null;
  smoothingSeconds: number;
} | null {
  let gainLinear = candidate.rule.gainLinear,
    pitchSemitones = candidate.rule.pitchSemitones,
    filterCutoffHz: number | null = null,
    smoothingSeconds = 0;
  for (const mapping of candidate.rule.mappings) {
    const input = candidate.metrics[mapping.input];
    if (input === undefined || input === null) return null;
    const output = mapParameter(mapping, input);
    if (mapping.target === "gainLinear") gainLinear = output;
    if (mapping.target === "pitchSemitones") pitchSemitones = output;
    if (mapping.target === "filterCutoffHz") filterCutoffHz = output;
    smoothingSeconds = Math.max(smoothingSeconds, mapping.smoothingSeconds);
  }
  return { gainLinear, pitchSemitones, filterCutoffHz, smoothingSeconds };
}

/** Deterministic bounded domain evaluator. It neither computes physics nor creates AudioNodes. */
export function createBehaviorRuntime(
  document: SoundBehaviorDocument,
  context: BehaviorContext,
  inputOptions: BehaviorRuntimeOptions,
): BehaviorRuntime {
  const options: Required<BehaviorRuntimeOptions> = {
    experimentId: inputOptions.experimentId,
    runEpoch: inputOptions.runEpoch,
    fixedDtSeconds: inputOptions.fixedDtSeconds ?? 1 / 60,
    randomSeed: inputOptions.randomSeed ?? 1,
    maxVoices: inputOptions.maxVoices ?? 32,
    maxVoicesPerObject:
      inputOptions.maxVoicesPerObject ?? Math.min(8, inputOptions.maxVoices ?? 32),
    maxRecentEvents: inputOptions.maxRecentEvents ?? 4096,
    maxTraceEntries: inputOptions.maxTraceEntries ?? 4096,
  };
  let registry = createProfileRegistry(document, context);
  let state = initialState(registry, options);
  let paused = false;
  let requiresNewEpoch = false;
  let inputCursor: BehaviorSnapshot["inputCursor"] = null;
  let metadata = new Map<string, VoiceMeta>();
  const trace: BehaviorDecision[] = [];

  const bindingState = (bindingId: string) =>
    state.bindings.find((item) => item.bindingId === bindingId)!;
  function lifetimeSeconds(rule: SoundBehaviorRule, generator: SoundGenerator): number | null {
    if (rule.lifecycle) return rule.lifecycle.maxDurationSeconds;
    if (rule.trigger.kind === "continuous") return null;
    let lifetime = rule.oneShotDurationSeconds;
    if (generator.kind === "sample") {
      const asset = registry.context.assetRegistry.find(
        (item) =>
          item.assetId === generator.asset.assetId && item.revision === generator.asset.revision,
      );
      const remaining = (asset?.durationSeconds ?? 30) - generator.startOffsetSeconds;
      lifetime = Math.min(lifetime ?? remaining, remaining);
    }
    if (lifetime === undefined)
      fail("ONE_SHOT_DURATION_REQUIRED", "A one-shot needs a finite logical duration");
    return lifetime;
  }
  function generatorIdentity(generator: SoundGenerator): string {
    return generator.kind === "oscillator"
      ? JSON.stringify([generator.kind, generator.waveform, generator.frequencyHz])
      : JSON.stringify([
          generator.kind,
          generator.asset.assetId,
          generator.asset.revision,
          generator.asset.sha256,
          generator.loop,
          generator.startOffsetSeconds,
        ]);
  }
  function resolve(instance: SoundInstance): { binding: BehaviorBinding; rule: SoundBehaviorRule } {
    const binding = registry.bindings.find((item) => item.bindingId === instance.bindingId);
    const profile = binding && registry.profiles.get(binding.profileId);
    const original = profile?.rules.find((item) => item.ruleId === instance.ruleId);
    if (!binding || !original)
      fail("UNKNOWN_RUNTIME_REFERENCE", "Voice points outside current document");
    return { binding, rule: effectiveRule(binding, original) };
  }
  function decision(
    result: BehaviorStepResult,
    candidate: Candidate | null,
    action: BehaviorDecision["action"],
    reason: string,
    instanceId: string | null = null,
    input: NormalizedBehaviorEvent | null = candidate?.input ?? null,
  ): void {
    result.decisions.push({
      tick: state.tick,
      sequence: state.sequence,
      bindingId: candidate?.binding.bindingId ?? null,
      ruleId: candidate?.rule.ruleId ?? null,
      inputEventId: input?.eventId ?? null,
      instanceId,
      action,
      reason,
    });
  }
  function emission(
    result: BehaviorStepResult,
    instance: SoundInstance,
    action: AudioEvent["action"],
    reason: string,
    candidate: Candidate | null = null,
  ): void {
    const { rule } = resolve(instance),
      meta = metadata.get(instance.instanceId)!;
    const parentEventId = candidate?.input?.eventId ?? meta.startEventId;
    const contact = candidate?.contact ?? meta.lastContact;
    if (candidate?.contact) meta.lastContact = structuredClone(candidate.contact);
    state.sequence = integer(state.sequence + 1, 0, 2147483647, "audio sequence");
    const event: AudioEvent = {
      eventId: stableId(
        "audio",
        state.runEpoch,
        state.tick,
        state.sequence,
        instance.instanceId,
        action,
      ),
      ...(parentEventId ? { parentPhysicsEventId: parentEventId } : {}),
      experimentId: state.experimentId,
      runEpoch: state.runEpoch,
      sceneRevision: state.sceneRevision,
      tick: state.tick,
      simulationTimeSeconds: state.tick * state.fixedDtSeconds,
      fixedDtSeconds: state.fixedDtSeconds,
      sequence: state.sequence,
      objectId: instance.objectId,
      generation: instance.generation,
      bindingId: instance.bindingId,
      profileId: instance.profileId,
      profileRevision: instance.profileRevision,
      ruleId: instance.ruleId,
      trigger: structuredClone(rule.trigger),
      instanceId: instance.instanceId,
      action,
      positionMetres: [...instance.positionMetres],
      gainLinear: instance.gainLinear,
      pitchSemitones: instance.pitchSemitones,
      ...(contact ? { contact: structuredClone(contact) } : {}),
    };
    if (!audioEventValidator(event))
      fail("INVALID_AUDIO_EVENT", JSON.stringify(audioEventValidator.errors));
    const intent: VoiceIntent = {
      action,
      event,
      generator: structuredClone(meta.generator),
      fadeInSeconds: rule.fadeInSeconds,
      fadeOutSeconds: rule.fadeOutSeconds,
      smoothingSeconds: candidate ? (parameters(candidate)?.smoothingSeconds ?? 0) : 0,
      ...(meta.filterCutoffHz !== null ? { filterCutoffHz: meta.filterCutoffHz } : {}),
      ...(meta.expiresAtTick !== null ? { expiresAtTick: meta.expiresAtTick } : {}),
    };
    result.events.push(event);
    result.voices.push(intent);
    decision(result, candidate, action, reason, instance.instanceId);
  }
  function deactivate(
    result: BehaviorStepResult,
    instance: SoundInstance,
    reason: string,
    candidate: Candidate | null = null,
  ): void {
    if (instance.playbackState === "fading" || instance.playbackState === "stopped") return;
    const { rule } = resolve(instance),
      meta = metadata.get(instance.instanceId)!;
    instance.playbackState = "fading";
    meta.releaseAtTick = state.tick + Math.ceil(rule.fadeOutSeconds / state.fixedDtSeconds);
    const bs = bindingState(instance.bindingId);
    bs.activeRuleIds = bs.activeRuleIds.filter((id) => id !== instance.ruleId);
    emission(result, instance, "stop", reason, candidate);
  }
  function cleanup(): void {
    const ended = new Set(
      state.instances
        .filter(
          (instance) =>
            instance.playbackState === "stopped" ||
            (metadata.get(instance.instanceId)?.releaseAtTick ?? Infinity) <= state.tick,
        )
        .map((instance) => instance.instanceId),
    );
    state.instances = state.instances.filter((instance) => !ended.has(instance.instanceId));
    for (const id of ended) metadata.delete(id);
  }
  function attempt(result: BehaviorStepResult, candidate: Candidate): void {
    const { binding, rule, profile, object, input } = candidate;
    if (!rule.enabled || object.lifecycle !== "active") return;
    if (!conditions(candidate)) {
      decision(result, candidate, "reject", "CONDITION_FALSE_OR_UNKNOWN");
      return;
    }
    const parameter = parameters(candidate),
      position = positionFor(candidate, registry.context);
    if (!parameter || !position) {
      for (const instance of state.instances) {
        if (
          instance.bindingId === binding.bindingId &&
          instance.ruleId === rule.ruleId &&
          instance.kind === "continuous"
        )
          deactivate(
            result,
            instance,
            !parameter ? "METRIC_UNAVAILABLE" : "EMITTER_UNAVAILABLE",
            candidate,
          );
      }
      decision(
        result,
        candidate,
        "reject",
        !parameter ? "METRIC_UNAVAILABLE" : "EMITTER_UNAVAILABLE",
      );
      return;
    }
    const bs = bindingState(binding.bindingId),
      cooldown = bs.cooldowns.find((item) => item.ruleId === rule.ruleId);
    const existing = state.instances.find(
      (item) =>
        item.bindingId === binding.bindingId &&
        item.ruleId === rule.ruleId &&
        item.kind === "continuous" &&
        item.playbackState === "playing",
    );
    if (existing) {
      if (rule.lifecycle && input) {
        if (rule.lifecycle.retriggerPolicy === "ignore") {
          decision(result, candidate, "reject", "LATCH_ALREADY_ACTIVE", existing.instanceId);
          return;
        }
        deactivate(result, existing, "LATCH_RESTART", candidate);
      } else {
        existing.gainLinear = parameter.gainLinear;
        existing.pitchSemitones = parameter.pitchSemitones;
        existing.positionMetres = position;
        metadata.get(existing.instanceId)!.filterCutoffHz = parameter.filterCutoffHz;
        emission(result, existing, "update", "CONTINUOUS_UPDATE", candidate);
        return;
      }
    }
    if (cooldown && cooldown.rearmAtTick > state.tick) {
      decision(result, candidate, "reject", "COOLDOWN");
      return;
    }
    const admission = voiceAdmission(
      {
        objectId: object.objectId,
        bindingId: binding.bindingId,
        ruleId: rule.ruleId,
        priority: rule.priority,
        voiceLimit: rule.voiceLimit,
        inputSequence: input?.sequence ?? 0,
        inputEventId: input?.eventId ?? "level",
      },
      state.instances,
      options.maxVoices,
      options.maxVoicesPerObject,
    );
    if (admission) {
      decision(result, candidate, "reject", admission);
      return;
    }
    let generator: SoundGenerator = rule.generator;
    const pair = profile.materialPairOverrides.find(
      (item) =>
        item.ruleId === rule.ruleId &&
        pairMatches(item.materialA, item.materialB, candidate.contact),
    );
    if (pair) generator = pair.generator;
    const continuous = rule.trigger.kind === "continuous" || Boolean(rule.lifecycle);
    const lifetime = lifetimeSeconds(rule, generator);
    const instance: SoundInstance = {
      instanceId: stableId(
        "voice",
        state.runEpoch,
        binding.bindingId,
        rule.ruleId,
        input?.eventId ?? `level.${state.tick}.${state.sequence + 1}`,
      ),
      bindingId: binding.bindingId,
      profileId: profile.profileId,
      profileRevision: profile.revision,
      ruleId: rule.ruleId,
      objectId: object.objectId,
      generation: object.generation,
      kind: continuous ? "continuous" : "oneShot",
      playbackState: "playing",
      startedAtTick: state.tick,
      playheadSeconds: 0,
      randomSeed: state.randomSeed,
      gainLinear: parameter.gainLinear,
      pitchSemitones: parameter.pitchSemitones,
      positionMetres: position,
      ...(rule.lifecycle && input
        ? {
            latch: {
              startEventId: input.eventId,
              deadlineTick:
                state.tick + Math.ceil(rule.lifecycle.maxDurationSeconds / state.fixedDtSeconds),
              retriggerCount: existing?.latch ? existing.latch.retriggerCount + 1 : 0,
            },
          }
        : {}),
    };
    state.instances.push(instance);
    metadata.set(instance.instanceId, {
      instanceId: instance.instanceId,
      generator: structuredClone(generator),
      expiresAtTick:
        lifetime === null ? null : state.tick + Math.ceil(lifetime / state.fixedDtSeconds),
      releaseAtTick: null,
      priority: rule.priority,
      filterCutoffHz: parameter.filterCutoffHz,
      startEventId: input?.eventId ?? null,
      lastContact: candidate.contact ? structuredClone(candidate.contact) : null,
    });
    if (continuous && !bs.activeRuleIds.includes(rule.ruleId)) bs.activeRuleIds.push(rule.ruleId);
    const rearmAtTick = state.tick + Math.ceil(rule.cooldownSeconds / state.fixedDtSeconds);
    if (cooldown) cooldown.rearmAtTick = rearmAtTick;
    else bs.cooldowns.push({ ruleId: rule.ruleId, rearmAtTick });
    emission(result, instance, "start", "RULE_MATCH", candidate);
  }

  function validateFrame(frame: BehaviorFrame): void {
    if (requiresNewEpoch)
      fail("NEW_EPOCH_REQUIRED", "Document replacement requires reset with a new epoch");
    integer(frame.tick, 0, 2147483647, "tick");
    if (frame.tick < state.tick) fail("STALE_TICK", "Use restore/reset to seek backwards");
    if (frame.sceneRevision !== state.sceneRevision)
      fail("STALE_SCENE_REVISION", "Frame and behavior context revisions differ");
    if (frame.runEpoch !== state.runEpoch)
      fail("STALE_RUN_EPOCH", "Frame belongs to another epoch");
    if (
      !Array.isArray(frame.objects) ||
      frame.objects.length > 1024 ||
      !Array.isArray(frame.events) ||
      frame.events.length > 4096
    )
      fail("INPUT_BUDGET", "Frame is not bounded");
    unique(frame.objects, (object) => object.objectId, "frame object");
    for (const object of frame.objects) {
      assertId(object.objectId);
      const trusted = registry.context.objects.find((entry) => entry.objectId === object.objectId);
      if (!trusted || trusted.generation !== object.generation)
        fail("STALE_OBJECT_GENERATION", "Frame object identity/generation differs");
      if (!["active", "staged", "preview", "deleted"].includes(object.lifecycle))
        fail("INVALID_LIFECYCLE", "Unknown object lifecycle");
      vector(object.positionMetres, "object position");
      if (object.rotation) {
        if (object.rotation.length !== 4)
          fail("INVALID_ROTATION", "Quaternion must have 4 entries");
        for (const value of object.rotation) assertFinite(value, -1, 1, "rotation");
        if (Math.abs(Math.hypot(...object.rotation) - 1) > 1e-4)
          fail("INVALID_ROTATION", "Quaternion must be normalized");
      }
      for (const key of [
        "moving",
        "airborne",
        "held",
        "sleeping",
        "rolling",
        "sliding",
        "spinning",
      ] as const)
        if (object.states[key] !== null && typeof object.states[key] !== "boolean")
          fail("INVALID_STATE", "Unknown state must be explicit null");
      checkMetrics(object.metrics);
      if (object.contact) validateContact(object.contact, object.objectId);
    }
    for (const input of frame.events) {
      assertId(input.eventId);
      integer(input.tick, 0, 2147483647, "event tick");
      integer(input.sequence, 0, 2147483647, "event sequence");
      if (input.tick !== frame.tick)
        fail(
          "EVENT_FRAME_TICK",
          "Event must be supplied with its corresponding object snapshot tick",
        );
      if (!discreteTriggers.has(input.type) || typeof input.accepted !== "boolean")
        fail("INVALID_TRIGGER", "Unrecognized discrete event");
      if (!["interaction", "physics", "state", "zone"].includes(input.source))
        fail("INVALID_EVENT_SOURCE", "Unrecognized normalized event source");
      const object = frame.objects.find((entry) => entry.objectId === input.objectId);
      if (!object || object.generation !== input.generation)
        fail("STALE_OBJECT_GENERATION", "Event object snapshot/generation missing");
      if (
        input.accepted &&
        interactionTriggers.has(input.type) &&
        (input.source !== "interaction" || !input.commandId)
      )
        fail("INTERACTION_PROVENANCE", "Interaction event requires an accepted command ID");
      if (input.commandId) assertId(input.commandId);
      if (
        input.accepted &&
        physicsTriggers.has(input.type) &&
        (input.source !== "physics" || !input.contact)
      )
        fail("CONTACT_PROVENANCE", "Impact/bounce requires normalized physics contact");
      if (input.contact) validateContact(input.contact, input.objectId);
      if (input.metrics) checkMetrics(input.metrics);
    }
  }
  function validateContact(contact: ContactData, objectId: string): void {
    if (!contactValidator(contact))
      fail("INVALID_CONTACT", JSON.stringify(contactValidator.errors));
    if (contact.objectA !== objectId && contact.objectB !== objectId)
      fail("CONTACT_IDENTITY", "Contact does not include emitting object");
    for (const id of [
      contact.pairKey,
      contact.episodeId,
      contact.objectA,
      contact.objectB,
      contact.colliderA,
      contact.colliderB,
      contact.materialA,
      contact.materialB,
    ])
      assertId(id);
    for (const [colliderId, owner] of [
      [contact.colliderA, contact.objectA],
      [contact.colliderB, contact.objectB],
    ])
      if (
        !registry.context.colliders?.some(
          (collider) => collider.colliderId === colliderId && collider.objectId === owner,
        )
      )
        fail(
          "CONTACT_COLLIDER_IDENTITY",
          "Contact collider is not registered to the indicated object",
        );
    if (contact.objectA === contact.objectB || contact.colliderA === contact.colliderB)
      fail("CONTACT_IDENTITY", "Contact must join two identities");
    if (
      !registry.context.objects.some((item) => item.objectId === contact.objectA) ||
      !registry.context.objects.some((item) => item.objectId === contact.objectB)
    )
      fail("UNKNOWN_OBJECT", "Contact object missing");
    if (
      !registry.context.materialIds.includes(contact.materialA) ||
      !registry.context.materialIds.includes(contact.materialB)
    )
      fail("UNKNOWN_MATERIAL", "Contact material missing");
    vector(contact.pointWorldMetres, "contact point");
    vector(contact.normalAtoB, "contact normal");
    if (Math.abs(Math.hypot(...contact.normalAtoB) - 1) > 1e-6)
      fail("CONTACT_NORMAL", "Contact normal must be normalized");
    for (const [label, value] of Object.entries({
      impulse: contact.normalImpulseNewtonSeconds,
      closing: contact.closingSpeedMetresPerSecond,
      tangent: contact.tangentSpeedMetresPerSecond,
    }))
      if (value !== null) assertFinite(value, 0, 1e12, label);
    if ((contact.impulseMethod === "Unavailable") !== (contact.normalImpulseNewtonSeconds === null))
      fail("IMPULSE_PROVENANCE", "Unknown impulse must remain null");
    if (
      (contact.velocityMethod === "Unavailable") !==
      (contact.closingSpeedMetresPerSecond === null && contact.tangentSpeedMetresPerSecond === null)
    )
      fail("VELOCITY_PROVENANCE", "Unknown velocity must remain null");
  }

  function performStep(frame: BehaviorFrame): BehaviorStepResult {
    validateFrame(frame);
    if (paused) return emptyResult();
    const result = emptyResult();
    const elapsed = (frame.tick - state.tick) * state.fixedDtSeconds;
    state.tick = frame.tick;
    for (const instance of state.instances) instance.playheadSeconds += elapsed;
    for (const instance of state.instances) {
      const meta = metadata.get(instance.instanceId)!;
      if (meta.expiresAtTick !== null && state.tick >= meta.expiresAtTick)
        deactivate(result, instance, "LIFETIME_EXPIRED");
    }
    cleanup();
    const objects = new Map(frame.objects.map((object) => [object.objectId, object]));
    for (const instance of state.instances) {
      const object = objects.get(instance.objectId),
        { rule } = resolve(instance);
      if (!object || object.lifecycle !== "active" || !rule.enabled)
        deactivate(result, instance, "OBJECT_OR_RULE_INVALIDATED");
    }
    const sorted = [...frame.events].sort(
      (a, b) => a.tick - b.tick || a.sequence - b.sequence || compareIds(a.eventId, b.eventId),
    );
    for (const input of sorted) {
      const behindCursor =
        inputCursor &&
        (input.tick < inputCursor.tick ||
          (input.tick === inputCursor.tick &&
            (input.sequence < inputCursor.sequence ||
              (input.sequence === inputCursor.sequence &&
                compareIds(input.eventId, inputCursor.eventId) <= 0))));
      if (state.processedEventIds.includes(input.eventId) || behindCursor) {
        decision(result, null, "reject", "DUPLICATE_EVENT", null, input);
        continue;
      }
      inputCursor = { tick: input.tick, sequence: input.sequence, eventId: input.eventId };
      state.processedEventIds.push(input.eventId);
      if (state.processedEventIds.length > options.maxRecentEvents)
        state.processedEventIds.splice(0, state.processedEventIds.length - options.maxRecentEvents);
      if (!input.accepted) {
        decision(result, null, "reject", "PRODUCER_REJECTED", null, input);
        continue;
      }
      const object = objects.get(input.objectId)!;
      for (const instance of state.instances) {
        const { binding, rule } = resolve(instance);
        if (instance.objectId === input.objectId && rule.lifecycle?.stopOn.includes(input.type))
          deactivate(result, instance, "LATCH_STOP_EVENT", {
            binding,
            rule,
            profile: registry.profiles.get(binding.profileId)!,
            object,
            input,
            metrics: { ...object.metrics, ...input.metrics },
            contact: input.contact,
          });
      }
      const candidates: Candidate[] = [];
      for (const binding of registry.bindings) {
        if (binding.objectId !== input.objectId) continue;
        const profile = registry.profiles.get(binding.profileId)!;
        for (const original of profile.rules) {
          const rule = effectiveRule(binding, original);
          if (rule.trigger.kind === "discrete" && rule.trigger.type === input.type)
            candidates.push({
              binding,
              profile,
              rule,
              object,
              input,
              metrics: { ...object.metrics, ...input.metrics },
              contact: input.contact,
            });
        }
      }
      candidates.sort((a, b) =>
        compareVoiceCandidates(
          {
            objectId: a.object.objectId,
            bindingId: a.binding.bindingId,
            ruleId: a.rule.ruleId,
            priority: a.rule.priority,
            voiceLimit: a.rule.voiceLimit,
            inputSequence: input.sequence,
            inputEventId: input.eventId,
          },
          {
            objectId: b.object.objectId,
            bindingId: b.binding.bindingId,
            ruleId: b.rule.ruleId,
            priority: b.rule.priority,
            voiceLimit: b.rule.voiceLimit,
            inputSequence: input.sequence,
            inputEventId: input.eventId,
          },
        ),
      );
      for (const candidate of candidates) attempt(result, candidate);
    }
    // Object-attached one-shots follow poses without recomputing their discrete trigger metrics.
    for (const instance of state.instances) {
      if (
        instance.kind !== "oneShot" ||
        instance.playbackState !== "playing" ||
        instance.startedAtTick === state.tick
      )
        continue;
      const { binding, rule } = resolve(instance),
        object = objects.get(instance.objectId);
      if (!object || rule.emitter.attachment !== "object") continue;
      const candidate: Candidate = {
        binding,
        profile: registry.profiles.get(binding.profileId)!,
        rule,
        object,
        input: null,
        metrics: object.metrics,
        contact: undefined,
      };
      const position = positionFor(candidate, registry.context);
      if (position) {
        instance.positionMetres = position;
        emission(result, instance, "update", "OBJECT_ATTACHED_ONE_SHOT_UPDATE", candidate);
      }
    }
    // A latch is event-started, but its object/contact/parameter attachment still follows each tick.
    for (const instance of state.instances) {
      if (
        !instance.latch ||
        instance.playbackState !== "playing" ||
        instance.startedAtTick === state.tick
      )
        continue;
      const { binding, rule } = resolve(instance),
        object = objects.get(instance.objectId);
      if (!object) continue;
      const candidate: Candidate = {
        binding,
        profile: registry.profiles.get(binding.profileId)!,
        rule,
        object,
        input: null,
        metrics: object.metrics,
        contact: object.contact,
      };
      const parameter = parameters(candidate),
        position = positionFor(candidate, registry.context);
      if (!parameter || !position || !conditions(candidate)) {
        deactivate(result, instance, "LATCH_CONTEXT_UNAVAILABLE", candidate);
        continue;
      }
      instance.gainLinear = parameter.gainLinear;
      instance.pitchSemitones = parameter.pitchSemitones;
      instance.positionMetres = position;
      metadata.get(instance.instanceId)!.filterCutoffHz = parameter.filterCutoffHz;
      emission(result, instance, "update", "LATCH_UPDATE", candidate);
    }
    const levels: Candidate[] = [];
    for (const binding of registry.bindings) {
      const object = objects.get(binding.objectId);
      if (!object) continue;
      const profile = registry.profiles.get(binding.profileId)!;
      for (const original of profile.rules) {
        const rule = effectiveRule(binding, original);
        if (rule.trigger.kind !== "continuous") continue;
        const candidate = {
          binding,
          profile,
          rule,
          object,
          input: null,
          metrics: object.metrics,
          contact: object.contact,
        };
        if (
          object.lifecycle === "active" &&
          rule.enabled &&
          level(rule, object) &&
          conditions(candidate)
        )
          levels.push(candidate);
        else
          for (const instance of state.instances)
            if (instance.bindingId === binding.bindingId && instance.ruleId === rule.ruleId)
              deactivate(result, instance, "CONTINUOUS_GATE_CLOSED", candidate);
      }
    }
    levels.sort(
      (a, b) =>
        b.rule.priority - a.rule.priority ||
        compareIds(a.binding.bindingId, b.binding.bindingId) ||
        compareIds(a.rule.ruleId, b.rule.ruleId),
    );
    for (const candidate of levels) attempt(result, candidate);
    cleanup();
    for (const bs of state.bindings) {
      bs.activeRuleIds.sort();
      bs.cooldowns = bs.cooldowns
        .filter((item) => item.rearmAtTick > state.tick)
        .sort((a, b) => compareIds(a.ruleId, b.ruleId));
    }
    appendTrace(trace, result.decisions, options.maxTraceEntries);
    return structuredClone(result);
  }

  const runtime: BehaviorRuntime = {
    step(frame) {
      const before = structuredClone(state),
        beforeMetadata = structuredClone([...metadata]),
        beforeCursor = structuredClone(inputCursor),
        traceLength = trace.length;
      try {
        return performStep(frame);
      } catch (error) {
        state = before;
        metadata = new Map(beforeMetadata);
        inputCursor = beforeCursor;
        trace.splice(traceLength);
        throw error;
      }
    },
    getActiveRuleStates() {
      return state.bindings.map(({ bindingId, activeRuleIds }) => ({
        bindingId,
        activeRuleIds: [...activeRuleIds],
      }));
    },
    snapshot() {
      return structuredClone({
        schemaVersion: "1.0.0",
        state,
        paused,
        requiresNewEpoch,
        inputCursor,
        voiceMetadata: [...metadata.values()].sort((a, b) =>
          compareIds(a.instanceId, b.instanceId),
        ),
      });
    },
    restore(snapshot) {
      if (snapshot.schemaVersion !== "1.0.0" || !stateValidator(snapshot.state))
        fail("INVALID_SNAPSHOT", "Snapshot schema invalid");
      if (requiresNewEpoch && !snapshot.requiresNewEpoch)
        fail("NEW_EPOCH_REQUIRED", "A checkpoint cannot clear a pending replacement epoch gate");
      const next = snapshot.state;
      if (
        next.experimentId !== options.experimentId ||
        next.runEpoch !== state.runEpoch ||
        next.sceneRevision !== registry.context.sceneRevision ||
        next.documentId !== registry.document.documentId ||
        next.documentRevision !== registry.document.revision ||
        next.fixedDtSeconds !== options.fixedDtSeconds
      )
        fail("STALE_SNAPSHOT", "Snapshot clock/document/epoch differs");
      if (
        typeof snapshot.paused !== "boolean" ||
        typeof snapshot.requiresNewEpoch !== "boolean" ||
        next.instances.length > options.maxVoices ||
        next.processedEventIds.length > options.maxRecentEvents ||
        !Array.isArray(snapshot.voiceMetadata) ||
        snapshot.voiceMetadata.length !== next.instances.length
      )
        fail("SNAPSHOT_BUDGET", "Snapshot exceeds configured host policy");
      if (snapshot.inputCursor !== null) {
        if (!snapshot.inputCursor || typeof snapshot.inputCursor !== "object")
          fail("INVALID_CURSOR", "Cursor must be explicit null or a normalized stamp");
        integer(snapshot.inputCursor.tick, 0, next.tick, "input cursor tick");
        integer(snapshot.inputCursor.sequence, 0, 2147483647, "input cursor sequence");
        assertId(snapshot.inputCursor.eventId, "cursor eventId");
      }
      unique(next.instances, (item) => item.instanceId, "snapshot instance");
      unique(next.bindings, (item) => item.bindingId, "snapshot binding");
      unique(snapshot.voiceMetadata, (item) => item.instanceId, "voice metadata");
      const nextMeta = new Map(snapshot.voiceMetadata.map((item) => [item.instanceId, item]));
      for (const instance of next.instances) {
        const { binding, rule } = resolve(instance),
          meta = nextMeta.get(instance.instanceId);
        if (
          !meta ||
          instance.objectId !== binding.objectId ||
          instance.profileId !== binding.profileId ||
          instance.profileRevision !== binding.profileRevision ||
          instance.generation !== binding.objectGeneration ||
          instance.startedAtTick > next.tick
        )
          fail("STALE_SNAPSHOT", "Snapshot voice identity/time differs");
        if (
          !rule.enabled &&
          instance.playbackState !== "fading" &&
          instance.playbackState !== "stopped"
        )
          fail("DISABLED_INSTANCE", "Disabled rule cannot keep playing");
        if (
          instance.kind !==
          (rule.trigger.kind === "continuous" || rule.lifecycle ? "continuous" : "oneShot")
        )
          fail("INSTANCE_KIND_MISMATCH", "Snapshot lifecycle differs");
        for (const key of ["expiresAtTick", "releaseAtTick"] as const)
          if (meta[key] !== null) integer(meta[key], 0, 2147483647, key);
        if (!generatorValidator(meta.generator))
          fail("INVALID_GENERATOR", "Snapshot generator schema invalid");
        if (meta.startEventId !== null) assertId(meta.startEventId, "voice startEventId");
        if (rule.trigger.kind === "discrete" && meta.startEventId === null)
          fail(
            "INPUT_PROVENANCE_REQUIRED",
            "Discrete voice must preserve its normalized start event",
          );
        if (rule.trigger.kind === "continuous" && meta.startEventId !== null)
          fail("INPUT_PROVENANCE_MISMATCH", "Level voice cannot invent a discrete start event");
        if (meta.lastContact !== null) validateContact(meta.lastContact, instance.objectId);
        if (
          rule.emitter.attachment === "contact" &&
          (meta.lastContact === null ||
            meta.lastContact.pointWorldMetres.some(
              (value, index) => Math.abs(value - instance.positionMetres[index]!) > 1e-8,
            ))
        )
          fail(
            "CONTACT_POSITION_MISMATCH",
            "Snapshot contact anchor differs from retained contact geometry",
          );
        if (instance.latch && meta.startEventId !== instance.latch.startEventId)
          fail("INPUT_PROVENANCE_MISMATCH", "Latch and voice start event disagree");
        const profile = registry.profiles.get(binding.profileId)!;
        const permittedGenerators = [
          rule.generator,
          ...profile.materialPairOverrides
            .filter((item) => item.ruleId === rule.ruleId)
            .map((item) => item.generator),
        ];
        if (
          !permittedGenerators.some(
            (generator) => generatorIdentity(generator) === generatorIdentity(meta.generator),
          )
        )
          fail("UNTRUSTED_GENERATOR", "Snapshot generator is not a selected document generator");
        const lifetime = lifetimeSeconds(rule, meta.generator),
          expectedExpiry =
            lifetime === null
              ? null
              : instance.startedAtTick + Math.ceil(lifetime / next.fixedDtSeconds);
        if (meta.expiresAtTick !== expectedExpiry)
          fail("LIFETIME_MISMATCH", "Snapshot cannot change the finite rule lifetime");
        if (meta.priority !== rule.priority)
          fail("PRIORITY_MISMATCH", "Snapshot priority differs from rule");
        if (
          instance.playheadSeconds >
          (next.tick - instance.startedAtTick) * next.fixedDtSeconds + 1e-8
        )
          fail("PLAYHEAD_CLOCK", "Snapshot playhead exceeds logical elapsed time");
        if (
          instance.playbackState === "fading" &&
          (meta.releaseAtTick === null ||
            meta.releaseAtTick > next.tick + Math.ceil(rule.fadeOutSeconds / next.fixedDtSeconds))
        )
          fail("RELEASE_DEADLINE", "Fading voice must have a bounded release deadline");
        if (instance.playbackState === "playing" && meta.releaseAtTick !== null)
          fail("RELEASE_DEADLINE", "Playing voice cannot have a hidden release deadline");
        if (meta.filterCutoffHz !== null)
          assertFinite(meta.filterCutoffHz, 20, 20000, "filter cutoff");
        if (
          instance.latch &&
          (!rule.lifecycle ||
            instance.latch.deadlineTick !==
              instance.startedAtTick +
                Math.ceil(rule.lifecycle.maxDurationSeconds / next.fixedDtSeconds))
        )
          fail("LATCH_DEADLINE", "Snapshot latch deadline differs");
        if (Boolean(instance.latch) !== Boolean(rule.lifecycle))
          fail(
            "LATCH_STATE_REQUIRED",
            "Snapshot must preserve exactly the selected rule lifecycle",
          );
        if (
          instance.playbackState === "playing" &&
          meta.expiresAtTick !== null &&
          meta.expiresAtTick <= next.tick
        )
          fail("EXPIRED_INSTANCE", "Expired voice cannot keep playing");
        if (
          voiceAdmission(
            {
              objectId: instance.objectId,
              bindingId: instance.bindingId,
              ruleId: instance.ruleId,
              priority: rule.priority,
              voiceLimit: rule.voiceLimit,
              inputSequence: 0,
              inputEventId: "snapshot",
            },
            next.instances.filter((item) => item.instanceId !== instance.instanceId),
            options.maxVoices,
            options.maxVoicesPerObject,
          )
        )
          fail("VOICE_BUDGET", "Snapshot voice budget differs");
      }
      for (const bs of next.bindings) {
        const binding = registry.bindings.find((item) => item.bindingId === bs.bindingId),
          profile = binding && registry.profiles.get(binding.profileId);
        if (!profile) fail("UNKNOWN_BINDING", "Snapshot binding missing");
        for (const id of [...bs.activeRuleIds, ...bs.cooldowns.map((item) => item.ruleId)])
          if (!profile.rules.some((rule) => rule.ruleId === id))
            fail("UNKNOWN_RULE", "Snapshot state refers to unknown rule");
      }
      if (next.bindings.length !== registry.bindings.length)
        fail("UNKNOWN_BINDING", "Snapshot must contain every binding state");
      state = structuredClone(next);
      metadata = new Map(structuredClone([...nextMeta]));
      paused = snapshot.paused;
      inputCursor = structuredClone(snapshot.inputCursor);
      requiresNewEpoch = snapshot.requiresNewEpoch;
      trace.length = 0;
    },
    reset(runEpoch) {
      assertId(runEpoch, "runEpoch");
      if (runEpoch === state.runEpoch) fail("NEW_EPOCH_REQUIRED", "Reset must use a new epoch");
      options.runEpoch = runEpoch;
      state = initialState(registry, options);
      metadata.clear();
      inputCursor = null;
      requiresNewEpoch = false;
      trace.length = 0;
    },
    setPaused(value) {
      if (typeof value !== "boolean") fail("INVALID_PAUSE", "Pause must be boolean");
      paused = value;
    },
    replaceDocument(next, hostContext, newRunEpoch) {
      if (state.instances.length)
        fail("ACTIVE_VOICES_NOT_DRAINED", "Pause/fade/drain before document replacement");
      if (
        next.documentId === registry.document.documentId &&
        next.revision <= registry.document.revision
      )
        fail("STALE_DOCUMENT_REVISION", "Replacement must increase document revision");
      const replacement = createProfileRegistry(next, hostContext);
      if (newRunEpoch !== undefined) {
        assertId(newRunEpoch, "runEpoch");
        if (newRunEpoch === state.runEpoch)
          fail("NEW_EPOCH_REQUIRED", "Replacement must use a new epoch");
      }
      if (newRunEpoch !== undefined) options.runEpoch = newRunEpoch;
      registry = replacement;
      state = initialState(registry, options);
      metadata.clear();
      inputCursor = null;
      requiresNewEpoch = newRunEpoch === undefined;
      trace.length = 0;
    },
    notifyEnded(instanceId) {
      const instance = state.instances.find((item) => item.instanceId === instanceId);
      if (!instance) return;
      instance.playbackState = "stopped";
      const bs = bindingState(instance.bindingId);
      bs.activeRuleIds = bs.activeRuleIds.filter((id) => id !== instance.ruleId);
      cleanup();
    },
    getTrace() {
      return structuredClone(trace);
    },
  };
  return runtime;
}
