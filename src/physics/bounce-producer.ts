import type { ContactData } from "../../schemas/sound-behavior/types.js";
import type { Quaternion, Vec3 } from "../scene/types.js";
import { add, cross, dot, length, rotate, stableHash, sub } from "./math.js";
import type { BodyPose, PhysicsEvent } from "./types.js";

export interface BounceStep {
  tick: number;
  epoch: number;
  sceneRevision: number;
  fixedDtSeconds: number;
  poses: readonly BodyPose[];
  events: readonly PhysicsEvent[];
}

export interface BounceEvidence {
  eventId: string;
  parentImpactEventId: string;
  pairKey: string;
  episodeId: string;
  impactTick: number;
  separationTick: number;
  outgoingNormalSpeedMetresPerSecond: number;
  classification: "TunedFixedSupportBounceCandidate";
}

interface PendingBounce {
  impact: PhysicsEvent;
  contact: ContactData;
  a: BodyPose;
  b: BodyPose;
  localA: Vec3;
  localB: Vec3;
  supportId: string;
  expiresAtTick: number;
}

const dynamic = (pose: BodyPose): boolean =>
  pose.mode === "dynamicGravity" || pose.mode === "dynamicNoGravity";
const pairIdentity = (a: string, b: string): string => [a, b].sort().join("|");
const inverse = (q: Quaternion): Quaternion => [-q[0], -q[1], -q[2], q[3]];
const active = (pose: BodyPose): boolean =>
  pose.enabled && pose.lifecycle === "active" && !pose.discontinuity && !pose.held;

function pointVelocity(pose: BodyPose, local: Vec3): Vec3 {
  const radius = rotate(local, pose.rotation);
  return add(
    pose.linearVelocityMetresPerSecond,
    cross(pose.angularVelocityRadiansPerSecond, radius),
  );
}

function fixedPoseUnchanged(before: BodyPose, after: BodyPose): boolean {
  return (
    after.mode === "fixed" &&
    length(sub(before.positionMetres, after.positionMetres)) <= 1e-12 &&
    Math.abs(
      Math.abs(before.rotation.reduce((sum, value, i) => sum + value * after.rotation[i]!, 0)) - 1,
    ) <= 1e-10 &&
    length(after.linearVelocityMetresPerSecond) <= 1e-9 &&
    length(after.angularVelocityRadiansPerSecond) <= 1e-9
  );
}

/**
 * A conservative physics normalization policy, not a restitution/material measurement.
 * Requires a real accepted impact, real separation, and outgoing contact-point velocity.
 * Only an unchanged fixed support is classified. Dynamic pairs/rotating supports remain unknown.
 */
export class PhysicsBounceProducer {
  private readonly pending = new Map<string, PendingBounce>();
  private readonly evidence: BounceEvidence[] = [];
  private stamp: {
    epoch: number;
    sceneRevision: number;
    fixedDtSeconds: number;
    tick: number;
  } | null = null;
  private readonly windowSeconds: number;
  private readonly minOutgoingSpeed: number;
  private readonly maxPending: number;
  constructor(
    options: { windowSeconds?: number; minOutgoingSpeedMps?: number; maxPending?: number } = {},
  ) {
    this.windowSeconds = options.windowSeconds ?? 0.25;
    this.minOutgoingSpeed = options.minOutgoingSpeedMps ?? 0.15;
    this.maxPending = options.maxPending ?? 256;
    if (
      !Number.isFinite(this.windowSeconds) ||
      this.windowSeconds <= 0 ||
      this.windowSeconds > 1 ||
      !Number.isFinite(this.minOutgoingSpeed) ||
      this.minOutgoingSpeed <= 0 ||
      this.minOutgoingSpeed > 10 ||
      !Number.isSafeInteger(this.maxPending) ||
      this.maxPending < 1 ||
      this.maxPending > 1024
    )
      throw Object.assign(new Error("Invalid bounded bounce policy"), {
        code: "INVALID_BOUNCE_POLICY",
      });
  }

  reset(): void {
    this.pending.clear();
    this.evidence.length = 0;
    this.stamp = null;
  }

  /** Velocity-changing host commands invalidate causality without inventing physics events. */
  invalidateObject(objectId: string): void {
    for (const [key, candidate] of this.pending)
      if (candidate.a.objectId === objectId || candidate.b.objectId === objectId)
        this.pending.delete(key);
  }

  getEvidence(): BounceEvidence[] {
    return structuredClone(this.evidence);
  }

  step(input: BounceStep): PhysicsEvent[] {
    const prior = this.stamp;
    const sameEpoch =
      prior?.epoch === input.epoch &&
      prior.sceneRevision === input.sceneRevision &&
      prior.fixedDtSeconds === input.fixedDtSeconds;
    // Repeated snapshot reads never generate a second event.
    if (sameEpoch && prior?.tick === input.tick) return [];
    if (!sameEpoch || !prior || input.tick !== prior.tick + 1) this.pending.clear();
    this.stamp = {
      epoch: input.epoch,
      sceneRevision: input.sceneRevision,
      fixedDtSeconds: input.fixedDtSeconds,
      tick: input.tick,
    };
    const poses = new Map(input.poses.map((pose) => [pose.objectId, pose]));
    for (const [key, candidate] of this.pending) {
      const a = poses.get(candidate.a.objectId),
        b = poses.get(candidate.b.objectId);
      if (
        !a ||
        !b ||
        !active(a) ||
        !active(b) ||
        a.generation !== candidate.a.generation ||
        b.generation !== candidate.b.generation ||
        a.mode !== candidate.a.mode ||
        b.mode !== candidate.b.mode ||
        input.tick > candidate.expiresAtTick ||
        !fixedPoseUnchanged(
          candidate.supportId === candidate.a.objectId ? candidate.a : candidate.b,
          candidate.supportId === a.objectId ? a : b,
        )
      )
        this.pending.delete(key);
    }
    const result: PhysicsEvent[] = [];
    let sequence = input.events.reduce((maximum, event) => Math.max(maximum, event.sequence), -1);
    for (const event of input.events) {
      if (!event.accepted) continue;
      if (
        event.type === "ContactInvalidated" ||
        event.type === "BodyModeChanged" ||
        (event.source === "interaction" && Boolean(event.commandId))
      ) {
        this.invalidateObject(event.objectId);
        continue;
      }
      if (event.type === "ContactBegin" && event.otherObjectId) {
        this.pending.delete(pairIdentity(event.objectId, event.otherObjectId));
        continue;
      }
      if (event.type === "OnImpact" && event.source === "physics" && event.contact) {
        const contact = event.contact,
          a = poses.get(contact.objectA),
          b = poses.get(contact.objectB);
        if (
          !a ||
          !b ||
          !active(a) ||
          !active(b) ||
          contact.closingSpeedMetresPerSecond === null ||
          contact.closingSpeedMetresPerSecond <= 0
        )
          continue;
        const support =
          a.mode === "fixed" && dynamic(b) ? a : b.mode === "fixed" && dynamic(a) ? b : null;
        if (!support || !fixedPoseUnchanged(support, support)) continue;
        const key = pairIdentity(a.objectId, b.objectId);
        if (!this.pending.has(key) && this.pending.size >= this.maxPending)
          throw Object.assign(new Error("Bounce candidate budget exceeded"), {
            code: "BOUNCE_CANDIDATE_BUDGET",
          });
        this.pending.set(key, {
          impact: structuredClone(event),
          contact: structuredClone(contact),
          a: structuredClone(a),
          b: structuredClone(b),
          localA: rotate(sub(contact.pointWorldMetres, a.positionMetres), inverse(a.rotation)),
          localB: rotate(sub(contact.pointWorldMetres, b.positionMetres), inverse(b.rotation)),
          supportId: support.objectId,
          expiresAtTick: input.tick + Math.ceil(this.windowSeconds / input.fixedDtSeconds),
        });
        continue;
      }
      if (event.type !== "ContactEnd" || event.source !== "physics" || !event.otherObjectId)
        continue;
      const key = pairIdentity(event.objectId, event.otherObjectId),
        candidate = this.pending.get(key);
      if (!candidate) continue;
      this.pending.delete(key);
      const a = poses.get(candidate.a.objectId)!,
        b = poses.get(candidate.b.objectId)!;
      const outgoing = dot(
        sub(pointVelocity(b, candidate.localB), pointVelocity(a, candidate.localA)),
        candidate.contact.normalAtoB,
      );
      if (!Number.isFinite(outgoing) || outgoing < this.minOutgoingSpeed) continue;
      if (
        input.events.length + result.length >= 2048 ||
        !Number.isSafeInteger(sequence + 1) ||
        sequence + 1 > 2147483647
      )
        throw Object.assign(new Error("Bounce event budget exceeded"), {
          code: "BEHAVIOR_EVENT_BUDGET",
        });
      const owner = poses.get(candidate.impact.objectId)!;
      const eventId = `bounce-${stableHash(`${candidate.impact.eventId}:${candidate.contact.episodeId}`)}`;
      result.push({
        eventId,
        tick: input.tick,
        sequence: ++sequence,
        sceneRevision: input.sceneRevision,
        simulationTimeSeconds: input.tick * input.fixedDtSeconds,
        fixedDtSeconds: input.fixedDtSeconds,
        objectId: owner.objectId,
        generation: owner.generation,
        type: "OnBounce",
        source: "physics",
        accepted: true,
        positionMetres: add(
          owner.positionMetres,
          rotate(
            owner.objectId === a.objectId ? candidate.localA : candidate.localB,
            owner.rotation,
          ),
        ),
        otherObjectId: owner.objectId === a.objectId ? b.objectId : a.objectId,
        contact: structuredClone(candidate.contact),
        reason: `TunedFixedSupportBounceCandidate; parentImpact=${candidate.impact.eventId}`,
      });
      this.evidence.push({
        eventId,
        parentImpactEventId: candidate.impact.eventId,
        pairKey: candidate.contact.pairKey,
        episodeId: candidate.contact.episodeId,
        impactTick: candidate.impact.tick,
        separationTick: input.tick,
        outgoingNormalSpeedMetresPerSecond: outgoing,
        classification: "TunedFixedSupportBounceCandidate",
      });
      if (this.evidence.length > 128) this.evidence.shift();
    }
    return result;
  }
}
