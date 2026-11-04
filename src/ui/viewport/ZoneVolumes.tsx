import { useEffect, useMemo } from "react";
import { BoxGeometry, SphereGeometry, type Mesh } from "three";
import type { SceneZone } from "../../scene/types.js";
import type { InteractionMode } from "../contracts.js";
import { canonicalTokens } from "../tokens.js";

/** Authoring overlays are deliberately absent from all picking/collision paths. */
export const ignoreZoneRaycast: Mesh["raycast"] = () => {};

export function zoneVolumeAppearance(enabled: boolean) {
  return {
    color: enabled ? canonicalTokens.color.accent.$value : canonicalTokens.color.textMuted.$value,
    opacity: enabled ? 0.8 : 0.3,
  };
}

/** These geometries represent declared volumes; they are never solver geometry. */
type ZoneVolumeShape =
  | Pick<Extract<SceneZone, { shape: "aabb" }>, "shape" | "halfExtentsM">
  | Pick<Extract<SceneZone, { shape: "sphere" }>, "shape" | "radiusM">;

export function createZoneVolumeGeometry(zone: ZoneVolumeShape): BoxGeometry | SphereGeometry {
  return zone.shape === "aabb"
    ? new BoxGeometry(
        ...(zone.halfExtentsM.map((halfExtent) => 2 * halfExtent) as [number, number, number]),
      )
    : new SphereGeometry(zone.radiusM, 24, 16);
}

function ZoneVolume({ zone }: { zone: SceneZone }) {
  const x = zone.shape === "aabb" ? zone.halfExtentsM[0] : zone.radiusM;
  const y = zone.shape === "aabb" ? zone.halfExtentsM[1] : zone.radiusM;
  const z = zone.shape === "aabb" ? zone.halfExtentsM[2] : zone.radiusM;
  const shape = zone.shape;
  const geometry = useMemo(
    () =>
      createZoneVolumeGeometry(
        shape === "aabb" ? { shape, halfExtentsM: [x, y, z] } : { shape, radiusM: x },
      ),
    [shape, x, y, z],
  );
  // R3F does not own primitive geometry; release the exact replaced/unmounted instance.
  useEffect(() => () => geometry.dispose(), [geometry]);
  const appearance = zoneVolumeAppearance(zone.enabled);
  return (
    <mesh
      name={"zone-volume:" + zone.id}
      position={zone.centerM}
      raycast={ignoreZoneRaycast}
      renderOrder={1}
      userData={{ overlay: "zone-volume", zoneId: zone.id, enabled: zone.enabled }}
    >
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        color={appearance.color}
        wireframe
        transparent
        opacity={appearance.opacity}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Fixed authoring regions stay distinct from body meshes and historical replay scenes. */
export function ZoneVolumes({
  zones,
  mode,
  replaying = false,
}: {
  zones: readonly SceneZone[] | undefined;
  mode: InteractionMode;
  replaying?: boolean;
}) {
  if (mode !== "editor" || replaying || !zones?.length) return null;
  return (
    <group name="zone-volume-overlays">
      {zones.map((zone) => (
        <ZoneVolume key={zone.id} zone={zone} />
      ))}
    </group>
  );
}
