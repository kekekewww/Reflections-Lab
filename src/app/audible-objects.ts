import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import type { SceneSpec } from "../scene/types.js";

/** Objects that can carry a path: an enabled sound behaviour binding or a scene sound source. */
export function audibleObjectIds(scene: SceneSpec, behaviors: SoundBehaviorDocument): Set<string> {
  const present = new Set(scene.objects.map((object) => object.id));
  const audible = new Set<string>();
  for (const binding of behaviors.bindings)
    if (binding.enabled === true && present.has(binding.objectId)) audible.add(binding.objectId);
  for (const source of scene.sources)
    if (present.has(source.objectId)) audible.add(source.objectId);
  return audible;
}
