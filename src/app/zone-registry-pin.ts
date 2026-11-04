import type { SceneZone } from "../scene/types.js";
import { canonicalStringify } from "../experiments/hash.js";

/** Bounded authoring baseline; this is not a security credential or a persistent Scene field. */
export function zoneRegistryPin(zones: readonly SceneZone[] | undefined): string {
  if (zones && zones.length > 16) throw new Error("ZONE_REGISTRY_BUDGET");
  return canonicalStringify(zones ?? []);
}
