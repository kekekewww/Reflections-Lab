import type { AcousticMaterial } from "../acoustics/types.js";
import type { BehaviorAsset, BehaviorContext } from "../audio-behavior/types.js";
import type { BodyPose } from "../physics/types.js";
import { stableHash } from "../physics/math.js";
import { createScene } from "../scene/index.js";
import type { SceneObject, SceneSpec, Vec3 } from "../scene/types.js";
import type {
  SoundBehaviorDocument,
  SoundBehaviorProfile,
  SoundBehaviorRule,
} from "../../schemas/sound-behavior/types.js";

const BANDS = [125, 250, 500, 1000, 2000, 4000, 8000] as const;

function material(id: string, label: string, absorption: readonly number[]): AcousticMaterial {
  return {
    schemaVersion: "1.0.0",
    id,
    revision: 1,
    label,
    dataClass: "Synthetic",
    sourceUrls: [],
    conditions: "手工設定的示範頻帶係數；非材質量測、非振動合成。A+R+T=1，零透射。",
    phaseModel: "zeroPhaseMagnitudeOnly",
    bands: BANDS.map((centerHz, i) => ({
      centerHz,
      absorptionEnergy: absorption[i]!,
      reflectionEnergy: 1 - absorption[i]!,
      transmissionEnergy: 0,
      scatteringFraction: 0.1,
    })),
  };
}

/** Authored examples only. These names do not assert measured material coefficients. */
export const DEFAULT_MATERIALS: AcousticMaterial[] = [
  material("material.hard", "硬質表面 · Synthetic", [0.03, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08]),
  material("material.soft", "吸音表面 · Synthetic", [0.15, 0.3, 0.55, 0.75, 0.85, 0.88, 0.85]),
  material("material.wood", "木質示範 · Synthetic", [0.12, 0.1, 0.08, 0.07, 0.09, 0.12, 0.15]),
  material("material.metal", "金屬示範 · Synthetic", [0.02, 0.02, 0.025, 0.03, 0.035, 0.04, 0.05]),
];

function box(id: string, positionM: Vec3, dimensionsM: Vec3): SceneObject {
  return {
    id,
    shape: "box",
    dimensionsM,
    positionM,
    orientationQuaternion: [0, 0, 0, 1],
    mode: "fixed",
    massKg: 100,
    friction: 0.6,
    restitution: 0.15,
    physicsMaterialId: "material.hard",
    acousticMaterialId: "material.hard",
    acousticRole: "staticSurface",
  };
}

/** Six-metre-wide, four-metre-high, eight-metre-deep open-front demonstration bay. */
export function createDefaultScene(): SceneSpec {
  return createScene({
    schemaVersion: "1.0.0",
    sceneId: "scene.reflection-lab",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1746,
    gravityMps2: [0, -9.81, 0],
    objects: [
      {
        ...box("floor", [0, -0.1, 0], [6.4, 0.2, 8.4]),
        physicsMaterialId: "material.wood",
        acousticMaterialId: "material.wood",
      },
      box("wall.back", [0, 2, -4.1], [6.4, 4, 0.2]),
      box("wall.left", [-3.1, 2, 0], [0.2, 4, 8.4]),
      box("wall.right", [3.1, 2, 0], [0.2, 4, 8.4]),
      {
        ...box("ball", [-0.8, 2, 0], [0.5, 0.5, 0.5]),
        shape: "sphere",
        mode: "dynamicGravity",
        massKg: 1,
        friction: 0.4,
        restitution: 0.55,
        physicsMaterialId: "material.metal",
        acousticMaterialId: "material.metal",
        acousticRole: "dynamicOccluder",
      },
      {
        ...box("speaker", [1.5, 1.3, -2], [0.45, 0.7, 0.35]),
        acousticMaterialId: "material.soft",
        acousticRole: "none",
      },
    ],
    sources: [
      {
        id: "source.speaker",
        objectId: "speaker",
        signalId: "signal.tone-220",
        mode: "continuous",
        gainDbfs: -24,
        playing: true,
      },
    ],
    listener: {
      id: "listener.main",
      positionM: [0, 1.6, 4],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
}

function rule(
  ruleId: string,
  trigger: SoundBehaviorRule["trigger"],
  frequencyHz: number,
): SoundBehaviorRule {
  const discrete = trigger.kind === "discrete";
  return {
    ruleId,
    enabled: true,
    trigger,
    conditions: [],
    generator: { kind: "oscillator", waveform: "sine", frequencyHz },
    emitter:
      trigger.type === "OnImpact"
        ? { attachment: "contact", aggregation: "impulseWeighted" }
        : { attachment: "object", offsetMetres: [0, 0, 0] },
    gainLinear: 10 ** (-24 / 20),
    pitchSemitones: 0,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.06,
    cooldownSeconds: discrete ? 0.08 : 0,
    priority: trigger.type === "OnImpact" ? 80 : 40,
    voiceLimit: discrete ? 4 : 1,
    layerGroup: `layer.${ruleId}`,
    mappings: [],
    ...(discrete ? { oneShotDurationSeconds: 0.22 } : {}),
  };
}

/** No sample assets or fabricated hashes are required for these authored oscillators. */
export function createDefaultBehaviors(scene: SceneSpec): SoundBehaviorDocument {
  const validated = createScene(scene);
  const speakerProfile: SoundBehaviorProfile = {
    profileId: "profile.continuous-tone",
    revision: 1,
    name: "持續測試音 · 程序音色",
    presetKind: "procedural",
    rules: [rule("rule.always", { kind: "continuous", type: "AlwaysOn" }, 220)],
    materialPairOverrides: [],
  };
  const impact = rule("rule.impact", { kind: "discrete", type: "OnImpact" }, 440);
  impact.mappings = [
    {
      mappingId: "mapping.impact-gain",
      input: "closingSpeedMetresPerSecond",
      target: "gainLinear",
      inputMin: 0,
      inputMax: 10,
      outputMin: 0.025,
      outputMax: 0.25,
      curve: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      interpolation: "linear",
      clamp: true,
      smoothingSeconds: 0.015,
    },
  ];
  const interactiveProfile: SoundBehaviorProfile = {
    profileId: "profile.interactive-tone",
    revision: 1,
    name: "互動創意音色 · 非真實振動",
    presetKind: "creative",
    rules: [
      impact,
      rule("rule.grab", { kind: "discrete", type: "OnGrab" }, 110),
      rule("rule.throw", { kind: "discrete", type: "OnThrow" }, 330),
    ],
    materialPairOverrides: [],
  };
  const continuousSources = validated.sources.filter((source) => source.mode === "continuous");
  const bindings: SoundBehaviorDocument["bindings"] = [];
  for (const object of validated.objects) {
    const source = continuousSources.find((entry) => entry.objectId === object.id);
    if (source) {
      bindings.push({
        bindingId: `binding.continuous.${object.id}`,
        objectId: object.id,
        objectGeneration: 1,
        profileId: speakerProfile.profileId,
        profileRevision: 1,
        enabled: source.playing,
        overrides: [{ ruleId: "rule.always", gainLinear: 10 ** (source.gainDbfs / 20) }],
      });
    }
    if (object.mode === "dynamicGravity" || object.mode === "dynamicNoGravity") {
      bindings.push({
        bindingId: `binding.interactive.${object.id}`,
        objectId: object.id,
        objectGeneration: 1,
        profileId: interactiveProfile.profileId,
        profileRevision: 1,
        enabled: true,
        overrides: [],
      });
    }
  }
  return {
    schemaVersion: "1.0.0",
    documentId: "behavior.reflection-lab",
    revision: 0,
    assets: [],
    profiles: [speakerProfile, interactiveProfile],
    bindings,
  };
}

/** Scene references do not automatically promote unknown materials or assets to trusted data. */
export function makeBehaviorContext(
  scene: SceneSpec,
  physicsPoses: readonly Pick<BodyPose, "objectId" | "generation">[],
  assets: readonly BehaviorAsset[] = [],
): BehaviorContext {
  const validated = createScene(scene);
  const generations = new Map<string, number>();
  for (const pose of physicsPoses) {
    if (generations.has(pose.objectId))
      throw new Error(`Duplicate pose identity: ${pose.objectId}`);
    if (!Number.isSafeInteger(pose.generation) || pose.generation < 1)
      throw new Error(`Invalid object generation: ${pose.objectId}`);
    generations.set(pose.objectId, pose.generation);
  }
  return {
    sceneRevision: validated.sceneRevision,
    objects: validated.objects.map((object) => ({
      objectId: object.id,
      generation: generations.get(object.id) ?? 1,
    })),
    materialIds: DEFAULT_MATERIALS.map((entry) => entry.id),
    // PhysicsWorld uses this canonical stable mapping for its single collider
    // per SceneObject; these are domain IDs, never opaque Rapier handles.
    colliders: validated.objects.map((object) => ({
      colliderId: `col-${stableHash(object.id)}`,
      objectId: object.id,
    })),
    zoneIds: [],
    assetRegistry: structuredClone([...assets]),
    validationMode: "product",
  };
}
