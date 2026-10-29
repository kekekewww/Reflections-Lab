import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import type { ProjectEditorMetadata } from "../persistence/types.js";
import type { SceneSpec } from "../scene/types.js";
import type { BehaviorRuleView, BehaviorView, EventView, ObjectView } from "../ui/contracts.js";

type AuthoringRuleView = Omit<
  BehaviorRuleView,
  "active" | "status" | "diagnostic" | "nativeRejection"
>;
interface AuthoringBehaviorView extends Omit<BehaviorView, "rules"> {
  bindingId: string;
  bindingEnabled: boolean;
  documentRevision: number;
  rules: AuthoringRuleView[];
}

function immutableCopy<T>(value: T): T {
  const copy = structuredClone(value);
  const seen = new WeakSet<object>();
  const freeze = (item: unknown): void => {
    if (item === null || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  };
  freeze(copy);
  return copy;
}

/** Detached authoring DTOs only. Every publication still projects current runtime fields. */
export class ViewProjection {
  private objectScene: SceneSpec | undefined;
  private objectMetadata: ProjectEditorMetadata | undefined;
  private objectViews: ObjectView[] = [];
  private behaviorDocument: SoundBehaviorDocument | undefined;
  private behaviorViews: AuthoringBehaviorView[] = [];
  private eventViews = new WeakMap<EventView, EventView>();

  /** Entries are finalized before runtime append; same-ID replacements use new objects. */
  events(entries: readonly EventView[]): EventView[] {
    const views = entries.map((entry) => {
      let view = this.eventViews.get(entry);
      if (!view) {
        view = immutableCopy(entry);
        this.eventViews.set(entry, view);
      }
      return view;
    });
    Object.freeze(views);
    return views;
  }

  objects(scene: SceneSpec, metadata: ProjectEditorMetadata | undefined): ObjectView[] {
    if (scene !== this.objectScene || metadata !== this.objectMetadata) {
      const views = immutableCopy(
        scene.objects.map((object) => ({
          ...object,
          name:
            metadata?.objectLabels.find((entry) => entry.objectId === object.id)?.label ??
            object.id,
        })),
      );
      this.objectScene = scene;
      this.objectMetadata = metadata;
      this.objectViews = views;
    }
    return this.objectViews;
  }

  behaviors(document: SoundBehaviorDocument): AuthoringBehaviorView[] {
    if (document !== this.behaviorDocument) {
      const views = immutableCopy(
        document.bindings.map((binding) => {
          const profile = document.profiles.find((value) => value.profileId === binding.profileId)!;
          return {
            objectId: binding.objectId,
            bindingId: binding.bindingId,
            bindingEnabled: binding.enabled,
            documentRevision: document.revision,
            profileId: profile.profileId,
            revision: profile.revision,
            presetKind: profile.presetKind,
            rules: profile.rules.map((rule) => ({
              id: rule.ruleId,
              trigger: rule.trigger.type,
              enabled:
                binding.enabled &&
                (binding.overrides.find((override) => override.ruleId === rule.ruleId)?.enabled ??
                  rule.enabled),
              ...(rule.generator.kind === "sample"
                ? { assetId: rule.generator.asset.assetId }
                : {}),
              generator: rule.generator.kind,
              gainLinear:
                binding.overrides.find((override) => override.ruleId === rule.ruleId)?.gainLinear ??
                rule.gainLinear,
              pitchSemitones:
                binding.overrides.find((override) => override.ruleId === rule.ruleId)
                  ?.pitchSemitones ?? rule.pitchSemitones,
              cooldownSeconds: rule.cooldownSeconds,
              priority: rule.priority,
              mappings: rule.mappings,
              baseValues: {
                enabled: rule.enabled,
                gainLinear: rule.gainLinear,
                pitchSemitones: rule.pitchSemitones,
              },
              bindingOverride:
                binding.overrides.find((value) => value.ruleId === rule.ruleId) ?? null,
              mapping:
                rule.mappings[0]?.input === "sourceSpeedMetresPerSecond"
                  ? ("speed" as const)
                  : rule.mappings.length
                    ? ("impact" as const)
                    : ("none" as const),
            })),
          };
        }),
      );
      this.behaviorDocument = document;
      this.behaviorViews = views;
    }
    return this.behaviorViews;
  }
}
