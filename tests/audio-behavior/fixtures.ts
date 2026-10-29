import type {
  ContactData,
  ParameterMapping,
  SoundBehaviorDocument,
  SoundBehaviorRule,
} from "../../schemas/sound-behavior/types.js";
import type {
  BehaviorContext,
  BehaviorFrame,
  BehaviorObjectInput,
  NormalizedBehaviorEvent,
} from "../../src/audio-behavior/types.js";

export const options = {
  experimentId: "experiment.test",
  runEpoch: "epoch.test",
  fixedDtSeconds: 0.1,
  randomSeed: 17,
  maxVoices: 8,
  maxVoicesPerObject: 8,
};

export function rule(patch: Partial<SoundBehaviorRule> = {}): SoundBehaviorRule {
  return {
    ruleId: "rule.always",
    enabled: true,
    trigger: { kind: "continuous", type: "AlwaysOn" },
    conditions: [],
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
    emitter: { attachment: "object", offsetMetres: [0, 0, 0] },
    gainLinear: 0.5,
    pitchSemitones: 0,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
    cooldownSeconds: 0,
    priority: 50,
    voiceLimit: 4,
    layerGroup: "layer.main",
    mappings: [],
    ...patch,
  };
}

export function impactRule(patch: Partial<SoundBehaviorRule> = {}): SoundBehaviorRule {
  return rule({
    ruleId: "rule.impact",
    trigger: { kind: "discrete", type: "OnImpact" },
    emitter: { attachment: "contact", aggregation: "representative" },
    oneShotDurationSeconds: 0.5,
    ...patch,
  });
}

export function document(rules: SoundBehaviorRule[] = [rule()]): SoundBehaviorDocument {
  return {
    schemaVersion: "1.0.0",
    documentId: "document.test",
    revision: 0,
    assets: [],
    profiles: [
      {
        profileId: "profile.ball",
        revision: 1,
        name: "Synthetic oscillator test profile",
        presetKind: "creative",
        rules,
        materialPairOverrides: [],
      },
    ],
    bindings: [
      {
        bindingId: "binding.ball",
        objectId: "object.ball",
        objectGeneration: 1,
        profileId: "profile.ball",
        profileRevision: 1,
        enabled: true,
        overrides: [],
      },
    ],
  };
}

export function context(): BehaviorContext {
  return {
    sceneRevision: 4,
    objects: [
      { objectId: "object.ball", generation: 1 },
      { objectId: "object.floor", generation: 1 },
    ],
    materialIds: ["material.metal", "material.wood"],
    zoneIds: [],
    colliders: [
      { colliderId: "collider.ball", objectId: "object.ball" },
      { colliderId: "collider.floor", objectId: "object.floor" },
    ],
    assetRegistry: [],
    validationMode: "product",
  };
}

export function object(patch: Partial<BehaviorObjectInput> = {}): BehaviorObjectInput {
  return {
    objectId: "object.ball",
    generation: 1,
    lifecycle: "active",
    positionMetres: [1, 2, 3],
    states: {
      moving: false,
      airborne: false,
      held: false,
      sleeping: false,
      rolling: false,
      sliding: false,
      spinning: false,
    },
    metrics: {
      sourceSpeedMetresPerSecond: 0,
      angularSpeedRadiansPerSecond: 0,
    },
    ...patch,
  };
}

export function contact(): ContactData {
  return {
    pairKey: "pair.ball-floor",
    episodeId: "episode.1",
    objectA: "object.ball",
    objectB: "object.floor",
    colliderA: "collider.ball",
    colliderB: "collider.floor",
    materialA: "material.metal",
    materialB: "material.wood",
    pointWorldMetres: [1, 0.25, 3],
    normalAtoB: [0, -1, 0],
    normalImpulseNewtonSeconds: 1,
    impulseMethod: "RapierContactImpulse",
    closingSpeedMetresPerSecond: 2,
    tangentSpeedMetresPerSecond: 0,
    velocityMethod: "PreStepRigidBodyEstimate",
  };
}

export function event(patch: Partial<NormalizedBehaviorEvent> = {}): NormalizedBehaviorEvent {
  return {
    eventId: "physics.impact.1",
    tick: 1,
    sequence: 1,
    objectId: "object.ball",
    generation: 1,
    type: "OnImpact",
    source: "physics",
    accepted: true,
    contact: contact(),
    metrics: {
      normalImpulseNewtonSeconds: 1,
      closingSpeedMetresPerSecond: 2,
      tangentSpeedMetresPerSecond: 0,
    },
    ...patch,
  };
}

export function frame(
  tick = 1,
  events: NormalizedBehaviorEvent[] = [],
  objects: BehaviorObjectInput[] = [object()],
): BehaviorFrame {
  return { tick, sceneRevision: 4, runEpoch: "epoch.test", objects, events };
}

export function mapping(patch: Partial<ParameterMapping> = {}): ParameterMapping {
  return {
    mappingId: "mapping.gain",
    input: "sourceSpeedMetresPerSecond",
    target: "gainLinear",
    inputMin: 0,
    inputMax: 10,
    outputMin: 0,
    outputMax: 1,
    curve: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.25 },
      { x: 1, y: 1 },
    ],
    interpolation: "linear",
    clamp: true,
    smoothingSeconds: 0.02,
    ...patch,
  };
}
