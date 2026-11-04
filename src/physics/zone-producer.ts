import type { SceneZone, Vec3 } from "../scene/types.js";
import { stableHash } from "./math.js";
import type { BodyPose, PhysicsEvent } from "./types.js";

export const ZONE_OCCUPANCY_MODEL = "DerivedFixedStepBodyCenterWithHysteresis" as const;
export interface ZoneStep {
  tick: number;
  epoch: number;
  sceneRevision: number;
  fixedDtSeconds: number;
  poses: readonly BodyPose[];
  zones: readonly SceneZone[];
  events: readonly PhysicsEvent[];
  /** Trusted per-step position reset marker; absent keeps the standalone generic-pose contract. */
  positionDiscontinuities?: ReadonlySet<string>;
}
interface Occupancy {
  inside: boolean;
  generation: number;
  signature: string;
}

/** Signed distance to the nominal static volume; AABB uses its max-axis boundary distance. */
export function zoneBoundaryDistance(zone: SceneZone, position: Vec3): number {
  const delta = position.map((value, i) => value - zone.centerM[i]!) as Vec3;
  return zone.shape === "sphere"
    ? Math.hypot(...delta) - zone.radiusM
    : Math.max(...delta.map((value, i) => Math.abs(value) - zone.halfExtentsM[i]!));
}
function signature(zone: SceneZone): string {
  return JSON.stringify([
    zone.shape,
    zone.centerM,
    zone.hysteresisM,
    zone.enabled,
    zone.shape === "sphere" ? zone.radiusM : zone.halfExtentsM,
  ]);
}

/**
 * Static-volume occupancy sampled from authoritative completed Rapier poses.
 * This is body-center classification, not whole-collider overlap or swept crossing/CCD.
 * Initial/recreated/edited occupancy establishes a baseline without fabricated enter/exit.
 */
export class PhysicsZoneProducer {
  private readonly occupancy = new Map<string, Occupancy>();
  private stamp: { epoch: number; tick: number } | null = null;

  reset(): void {
    this.occupancy.clear();
    this.stamp = null;
  }
  invalidateObject(objectId: string): void {
    for (const key of this.occupancy.keys())
      if (key.endsWith("|" + objectId)) this.occupancy.delete(key);
  }

  step(input: ZoneStep): PhysicsEvent[] {
    if (
      input.zones.length > 16 ||
      input.poses.length > 256 ||
      input.events.length > 2048 ||
      (input.positionDiscontinuities?.size ?? 0) > 256
    )
      throw Object.assign(new Error("Zone occupancy input budget exceeded"), {
        code: "ZONE_BUDGET",
      });
    if (this.stamp?.epoch === input.epoch && this.stamp.tick === input.tick) return [];
    if (!this.stamp || this.stamp.epoch !== input.epoch || input.tick !== this.stamp.tick + 1)
      this.occupancy.clear();
    this.stamp = { epoch: input.epoch, tick: input.tick };
    const liveKeys = new Set<string>();
    const result: PhysicsEvent[] = [];
    let sequence = input.events.reduce((maximum, event) => Math.max(maximum, event.sequence), -1);
    const zones = [...input.zones].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const poses = [...input.poses].sort((a, b) =>
      a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0,
    );
    for (const zone of zones) {
      if (!zone.enabled) continue;
      const version = signature(zone);
      for (const pose of poses) {
        if (!pose.enabled || pose.lifecycle !== "active") continue;
        const key = zone.id + "|" + pose.objectId;
        liveKeys.add(key);
        const distance = zoneBoundaryDistance(zone, pose.positionMetres);
        if (!Number.isFinite(distance))
          throw Object.assign(new Error("Zone occupancy requires finite geometry and poses"), {
            code: "INVALID_ZONE_INPUT",
          });
        const previous = this.occupancy.get(key);
        if (
          !previous ||
          previous.generation !== pose.generation ||
          previous.signature !== version ||
          (input.positionDiscontinuities?.has(pose.objectId) ?? pose.discontinuity)
        ) {
          this.occupancy.set(key, {
            inside: distance <= 0,
            generation: pose.generation,
            signature: version,
          });
          continue;
        }
        const inside = previous.inside
          ? distance <= zone.hysteresisM
          : distance <= -zone.hysteresisM;
        if (inside === previous.inside) continue;
        if (input.events.length + result.length >= 2048 || sequence >= 2147483647)
          throw Object.assign(new Error("Zone crossing event budget exceeded"), {
            code: "ZONE_EVENT_BUDGET",
          });
        previous.inside = inside;
        const type = inside ? "OnEnterZone" : "OnExitZone";
        result.push({
          eventId:
            "zone-" +
            stableHash(
              [input.epoch, input.tick, zone.id, pose.objectId, pose.generation, type].join(":"),
            ),
          tick: input.tick,
          sequence: ++sequence,
          sceneRevision: input.sceneRevision,
          simulationTimeSeconds: input.tick * input.fixedDtSeconds,
          fixedDtSeconds: input.fixedDtSeconds,
          objectId: pose.objectId,
          generation: pose.generation,
          type,
          source: "zone",
          accepted: true,
          zoneId: zone.id,
          positionMetres: [...pose.positionMetres],
          reason: ZONE_OCCUPANCY_MODEL,
        });
      }
    }
    for (const key of this.occupancy.keys()) if (!liveKeys.has(key)) this.occupancy.delete(key);
    return result;
  }
}
