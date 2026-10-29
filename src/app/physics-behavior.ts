import type {
  ContactData,
  DiscreteTriggerType,
  MetricInput,
} from "../../schemas/sound-behavior/types.js";
import type { BehaviorFrame, NormalizedBehaviorEvent } from "../audio-behavior/types.js";
import type { BodyPose, PhysicsEvent, PhysicsSnapshot } from "../physics/types.js";

const DISCRETE_EVENTS = new Set<PhysicsEvent["type"]>([
  "OnGrab",
  "OnRelease",
  "OnThrow",
  "OnDrop",
  "OnImpact",
  "OnStartMoving",
  "OnStopMoving",
  "OnSleep",
  "OnWake",
]);
type Metrics = Partial<Record<MetricInput, number | null>>;

function contactMetrics(contact: ContactData | undefined): Metrics {
  if (!contact) return {};
  return {
    normalImpulseNewtonSeconds: contact.normalImpulseNewtonSeconds,
    closingSpeedMetresPerSecond: contact.closingSpeedMetresPerSecond,
    tangentSpeedMetresPerSecond: contact.tangentSpeedMetresPerSecond,
    // Both rigid-body point velocities include omega×r. Their relative tangential
    // contact velocity is observable slip; it is not the centre-of-mass speed.
    slipSpeedMetresPerSecond: contact.tangentSpeedMetresPerSecond,
    // No contact-force sample is supplied by this PhysicsSnapshot contract.
    // In particular an impulse in Ns is never relabelled as a force in N.
    contactSupportForceNewtons: null,
  };
}

function representativeContacts(snapshot: PhysicsSnapshot): Map<string, ContactData> {
  const contacts = new Map<string, ContactData>();
  const consider = (contact: ContactData): void => {
    for (const id of [contact.objectA, contact.objectB]) {
      const old = contacts.get(id);
      const impulse = contact.normalImpulseNewtonSeconds ?? -1;
      const oldImpulse = old?.normalImpulseNewtonSeconds ?? -1;
      if (!old || impulse > oldImpulse || (impulse === oldImpulse && contact.pairKey < old.pairKey))
        contacts.set(id, contact);
    }
  };
  for (const pose of snapshot.poses) {
    const contact = (pose as BodyPose & { contact?: ContactData }).contact;
    if (contact) consider(contact);
  }
  for (const event of snapshot.events) if (event.contact) consider(event.contact);
  return contacts;
}

/** Translate authoritative per-step data; never infer Throw, Impact or Bounce from motion. */
export function toBehaviorFrame(snapshot: PhysicsSnapshot, runEpoch: string): BehaviorFrame {
  const contacts = representativeContacts(snapshot);
  const events: NormalizedBehaviorEvent[] = snapshot.events
    .filter((event) => DISCRETE_EVENTS.has(event.type))
    .map((event) => ({
      eventId: event.eventId,
      tick: event.tick,
      sequence: event.sequence,
      objectId: event.objectId,
      generation: event.generation,
      type: event.type as DiscreteTriggerType,
      source: event.source,
      accepted: event.accepted,
      ...(event.commandId === undefined ? {} : { commandId: event.commandId }),
      ...(event.contact === undefined ? {} : { contact: structuredClone(event.contact) }),
      metrics: contactMetrics(event.contact),
    }));
  return {
    tick: snapshot.tick,
    sceneRevision: snapshot.sceneRevision,
    runEpoch,
    objects: snapshot.poses.map((pose) => {
      // Physics selected this object's support/sliding patch for its continuous state.
      // A stronger discrete impact (or another participant's patch) must not replace it.
      const contact = pose.contact ?? contacts.get(pose.objectId);
      return {
        objectId: pose.objectId,
        generation: pose.generation,
        lifecycle: pose.lifecycle,
        positionMetres: [...pose.positionMetres],
        rotation: [...pose.rotation],
        states: {
          moving: pose.moving,
          airborne: pose.airborne,
          held: pose.held,
          sleeping: pose.sleeping,
          rolling: pose.rolling,
          sliding: pose.sliding,
          spinning: pose.spinning,
        },
        metrics: {
          sourceSpeedMetresPerSecond: Math.hypot(...pose.linearVelocityMetresPerSecond),
          angularSpeedRadiansPerSecond: Math.hypot(...pose.angularVelocityRadiansPerSecond),
          ...contactMetrics(contact),
        },
        ...(contact === undefined ? {} : { contact: structuredClone(contact) }),
      };
    }),
    events,
  };
}
