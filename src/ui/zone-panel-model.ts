import type { SceneZone } from "../scene/types.js";
import { zoneRegistryPin } from "../app/zone-registry-pin.js";

export interface ZoneDraft {
  id: string;
  name: string;
  enabled: boolean;
  shape: "aabb" | "sphere";
  center: [string, string, string];
  halfExtents: [string, string, string];
  radius: string;
  hysteresis: string;
  existingId: string | null;
  sceneRevision: number;
  registryPin: string;
}

export type ZoneDraftError =
  | "id"
  | "name"
  | "duplicate"
  | "capacity"
  | "center"
  | "extent"
  | "radius"
  | "hysteresis";

export function nextZoneId(zones: readonly SceneZone[]): string {
  const used = new Set(zones.map((zone) => zone.id));
  let counter = 1;
  while (used.has("zone." + counter)) counter++;
  return "zone." + counter;
}

export function createZoneDraft(
  zone: SceneZone | null,
  sceneRevision: number,
  zones: readonly SceneZone[],
  name = "Zone",
): ZoneDraft {
  return {
    id: zone?.id ?? nextZoneId(zones),
    name: zone?.name ?? name,
    enabled: zone?.enabled ?? true,
    shape: zone?.shape ?? "aabb",
    center: zone ? (zone.centerM.map(String) as ZoneDraft["center"]) : ["0", "1", "0"],
    halfExtents:
      zone?.shape === "aabb"
        ? (zone.halfExtentsM.map(String) as ZoneDraft["halfExtents"])
        : ["1", "1", "1"],
    radius: zone?.shape === "sphere" ? String(zone.radiusM) : "1",
    hysteresis: String(zone?.hysteresisM ?? 0.02),
    existingId: zone?.id ?? null,
    sceneRevision,
    registryPin: zoneRegistryPin(zones),
  };
}

function numeric(raw: string, min: number, max: number): boolean {
  return (
    Boolean(raw.trim()) && Number.isFinite(Number(raw)) && Number(raw) >= min && Number(raw) <= max
  );
}

/** UI draft validation is immediate; SceneCommand remains the mutation authority. */
export function zoneDraftError(
  draft: ZoneDraft,
  zones: readonly SceneZone[],
): ZoneDraftError | null {
  if (
    !/^[a-z][a-z0-9._-]{0,63}$/.test(draft.id) ||
    (draft.existingId !== null && draft.id !== draft.existingId)
  )
    return "id";
  if (!draft.name.trim() || draft.name.length > 80) return "name";
  if (zones.some((zone) => zone.id === draft.id && zone.id !== draft.existingId))
    return "duplicate";
  if (draft.existingId === null && zones.length >= 16) return "capacity";
  if (!draft.center.every((value) => numeric(value, -200, 200))) return "center";
  if (draft.shape === "aabb" && !draft.halfExtents.every((value) => numeric(value, 0.05, 50)))
    return "extent";
  if (draft.shape === "sphere" && !numeric(draft.radius, 0.05, 50)) return "radius";
  const size =
    draft.shape === "aabb" ? Math.min(...draft.halfExtents.map(Number)) : Number(draft.radius);
  if (!numeric(draft.hysteresis, 0, 0.25) || Number(draft.hysteresis) >= size) return "hysteresis";
  return null;
}

export function zoneFromDraft(draft: ZoneDraft, zones: readonly SceneZone[]): SceneZone {
  const error = zoneDraftError(draft, zones);
  if (error) throw new Error("ZONE_DRAFT_" + error.toUpperCase());
  const common = {
    id: draft.id,
    name: draft.name.trim(),
    enabled: draft.enabled,
    centerM: draft.center.map(Number) as [number, number, number],
    hysteresisM: Number(draft.hysteresis),
  };
  return draft.shape === "aabb"
    ? {
        ...common,
        shape: "aabb",
        halfExtentsM: draft.halfExtents.map(Number) as [number, number, number],
      }
    : { ...common, shape: "sphere", radiusM: Number(draft.radius) };
}
