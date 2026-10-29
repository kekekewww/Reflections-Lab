// Frozen scan-based poses reference before the per-call contact index.
// Original src/physics/physics-world.ts SHA256: 071adc79ac6a0b7f12b7dade2994e7d4ae0df07c40899eaae547fd45a764dcc4
// TypeScript syntax erased only; helpers and both updateMotion branches retained.
// Test seam only, not a second production solver.
import { sub, scale, dot, length, vector, quaternion } from "../../../src/physics/math.js";
// Tuned engineering gates, not measured material/physiological constants.
// Linear/contact speeds are m/s; angular speeds are rad/s. Counters advance
// once per completed fixed step, never while rendering or reading snapshots.
const MOTION_POLICY = Object.freeze({
  movingEnterMps: 0.05,
  movingExitMps: 0.025,
  spinningEnterRadps: 0.1,
  spinningExitRadps: 0.05,
  slidingEnterMps: 0.12,
  slidingExitMps: 0.08,
  rollingTravelEnterMps: 0.05,
  rollingTravelExitMps: 0.025,
  rollingAngularEnterRadps: 0.1,
  rollingAngularExitRadps: 0.05,
  rollingSlipEnterMps: 0.08,
  rollingSlipExitMps: 0.12,
  exitStableTicks: 2,
});
const freshMotion = () => ({
  moving: false,
  movingExitTicks: 0,
  spinning: false,
  spinningExitTicks: 0,
  rolling: null,
  rollingExitTicks: 0,
  sliding: false,
  slidingExitTicks: 0,
  contactEpisodes: "",
});
function motionGate(wasActive, exitTicks, sample, enter, exit) {
  if (!wasActive) return { active: sample >= enter, exitTicks: 0 };
  const nextExitTicks = sample <= exit ? Math.min(exitTicks + 1, MOTION_POLICY.exitStableTicks) : 0;
  return { active: nextExitTicks < MOTION_POLICY.exitStableTicks, exitTicks: nextExitTicks };
}
const dynamic = (mode) => mode === "dynamicGravity" || mode === "dynamicNoGravity";
export function originalPoses(updateMotion = false) {
  return [...this.records.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, r]) => {
      const velocity = vector(r.body.linvel()),
        angular = vector(r.body.angvel());
      const contacts = [...this.pairs.values()].filter(
        (p) => (p.a === id || p.b === id) && p.contact !== null,
      );
      const supported = contacts.some((p) => {
        const c = p.contact;
        return (p.a === id ? -c.normalAtoB[1] : c.normalAtoB[1]) > 0.4;
      });
      // Contact point slip is observable; arbitrary-shape rolling classification remains unknown.
      const slip = contacts.reduce(
        (s, p) => Math.max(s, p.contact?.tangentSpeedMetresPerSecond ?? 0),
        0,
      );
      const supportingContacts = contacts.filter(
        (p) => (p.a === id ? -p.contact.normalAtoB[1] : p.contact.normalAtoB[1]) > 0.4,
      );
      let representative = [...(supportingContacts.length ? supportingContacts : contacts)].sort(
        (a, b) =>
          (b.contact?.normalImpulseNewtonSeconds ?? 0) -
            (a.contact?.normalImpulseNewtonSeconds ?? 0) ||
          a.contact.pairKey.localeCompare(b.contact.pairKey),
      )[0]?.contact;
      let rollingCanEnter = false,
        rollingCanRemain = false;
      if (updateMotion)
        for (const p of supportingContacts) {
          const contact = p.contact;
          const support = this.records.get(p.a === id ? p.b : p.a);
          if (!support) continue;
          // Subtract the support rigid field at this COM, including its angular velocity.
          // Co-rotation on a moving support is resting, not rolling merely due to world omega.
          const relativeCenter = sub(
            velocity,
            vector(support.body.velocityAtPoint(r.body.worldCom())),
          );
          const relativeAngular = sub(angular, vector(support.body.angvel()));
          // Rotation about the surface normal does not make a sphere roll.
          const tangentAngular = length(
            sub(
              relativeAngular,
              scale(contact.normalAtoB, dot(relativeAngular, contact.normalAtoB)),
            ),
          );
          const normalSpeed = dot(relativeCenter, contact.normalAtoB);
          const relativeTangent = length(
            sub(relativeCenter, scale(contact.normalAtoB, normalSpeed)),
          );
          rollingCanEnter ||=
            tangentAngular >= MOTION_POLICY.rollingAngularEnterRadps &&
            relativeTangent >= MOTION_POLICY.rollingTravelEnterMps;
          rollingCanRemain ||=
            tangentAngular > MOTION_POLICY.rollingAngularExitRadps &&
            relativeTangent > MOTION_POLICY.rollingTravelExitMps;
        }
      if (updateMotion) {
        const prior = r.motion;
        if (!r.enabled) r.motion = freshMotion();
        else {
          const moving = motionGate(
            prior.moving,
            prior.movingExitTicks,
            length(velocity),
            MOTION_POLICY.movingEnterMps,
            MOTION_POLICY.movingExitMps,
          );
          const spinning = motionGate(
            prior.spinning,
            prior.spinningExitTicks,
            length(angular),
            MOTION_POLICY.spinningEnterRadps,
            MOTION_POLICY.spinningExitRadps,
          );
          const contactEpisodes = contacts
            .map((pair) => pair.contact.episodeId)
            .sort()
            .join("|");
          const sameContact = prior.contactEpisodes === contactEpisodes;
          const slipKnown = contacts.every((pair) =>
            Number.isFinite(pair.contact.tangentSpeedMetresPerSecond),
          );
          const sliding =
            r.definition.mode !== "fixed" && contacts.length && slipKnown
              ? motionGate(
                  sameContact && prior.sliding === true,
                  sameContact ? prior.slidingExitTicks : 0,
                  slip,
                  MOTION_POLICY.slidingEnterMps,
                  MOTION_POLICY.slidingExitMps,
                )
              : { active: false, exitTicks: 0 };
          let rolling = supported && r.definition.shape === "sphere" && slipKnown ? false : null;
          let rollingExitTicks = 0;
          if (rolling !== null && !sliding.active) {
            if (sameContact && prior.rolling === true) {
              rollingExitTicks = rollingCanRemain
                ? 0
                : Math.min(prior.rollingExitTicks + 1, MOTION_POLICY.exitStableTicks);
              rolling =
                slip < MOTION_POLICY.rollingSlipExitMps &&
                rollingExitTicks < MOTION_POLICY.exitStableTicks;
            } else rolling = rollingCanEnter && slip < MOTION_POLICY.rollingSlipEnterMps;
          }
          r.motion = {
            moving: moving.active,
            movingExitTicks: moving.exitTicks,
            spinning: spinning.active,
            spinningExitTicks: spinning.exitTicks,
            rolling,
            rollingExitTicks,
            sliding:
              r.definition.mode === "fixed"
                ? false
                : contacts.length && !slipKnown
                  ? null
                  : sliding.active,
            slidingExitTicks: sliding.exitTicks,
            contactEpisodes,
          };
        }
      }
      if (r.motion.sliding === true)
        representative = [...contacts].sort(
          (a, b) =>
            (b.contact.tangentSpeedMetresPerSecond ?? -Infinity) -
              (a.contact.tangentSpeedMetresPerSecond ?? -Infinity) ||
            a.contact.pairKey.localeCompare(b.contact.pairKey),
        )[0]?.contact;
      return {
        objectId: id,
        generation: r.generation,
        positionMetres: vector(r.body.translation()),
        rotation: quaternion(r.body.rotation()),
        linearVelocityMetresPerSecond: velocity,
        angularVelocityRadiansPerSecond: angular,
        mode: r.definition.mode,
        sleeping: r.body.isSleeping(),
        moving: r.motion.moving,
        airborne: dynamic(r.definition.mode) && !supported,
        held: this.heldObjectId === id,
        rolling: supported && r.definition.shape === "sphere" ? r.motion.rolling : null,
        sliding: contacts.length ? r.motion.sliding : false,
        spinning: r.motion.spinning,
        enabled: r.enabled,
        lifecycle: r.enabled ? "active" : "staged",
        discontinuity: this.tick <= r.discontinuityUntilTick,
        ...(representative ? { contact: structuredClone(representative) } : {}),
      };
    });
}
