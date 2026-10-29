import RAPIER from "@dimforge/rapier3d-compat";
import { createScene } from "../scene/index.js";
import type { BodyMode, Quaternion, SceneObject, SceneSpec, Vec3 } from "../scene/types.js";
import type { ContactData } from "../../schemas/sound-behavior/types.js";
import { FixedClock } from "./fixed-clock.js";
import { CharacterMotor } from "./character-motor.js";
import {
  add,
  sub,
  scale,
  dot,
  length,
  cross,
  normalize,
  clampNorm,
  vector,
  quaternion,
  rv,
  rq,
  rotate,
  finiteVector,
  finiteQuaternion,
  stableHash,
} from "./math.js";
import type {
  BodyPose,
  GrabDiagnostics,
  PhysicsBodyRecord,
  PhysicsEvent,
  PhysicsOptions,
  PhysicsSnapshot,
  PlayerPose,
  PlacementResult,
  RaycastHit,
} from "./types.js";

type HistoryPose = Pick<
  BodyPose,
  "objectId" | "generation" | "positionMetres" | "rotation" | "moving" | "sleeping"
>;

let initialization: Promise<void> | undefined;
export function initializePhysics(): Promise<void> {
  return (initialization ??= RAPIER.init());
}

interface Record extends PhysicsBodyRecord {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  motion: MotionState;
}
interface MotionState {
  moving: boolean;
  movingExitTicks: number;
  spinning: boolean;
  spinningExitTicks: number;
  rolling: boolean | null;
  rollingExitTicks: number;
  sliding: boolean | null;
  slidingExitTicks: number;
  contactEpisodes: string;
}
interface PreSolve {
  center: Vec3;
  velocity: Vec3;
  angular: Vec3;
}
interface Pair {
  a: string;
  b: string;
  episodeId: string;
  onsetTick: number;
  lastImpactTick: number;
  contact: ContactData | null;
}
type PendingEvent = Omit<
  PhysicsEvent,
  | "eventId"
  | "tick"
  | "sequence"
  | "sceneRevision"
  | "simulationTimeSeconds"
  | "fixedDtSeconds"
  | "generation"
  | "positionMetres"
> & { positionMetres?: Vec3 };
interface Grip {
  objectId: string;
  generation: number;
  target: Vec3;
  requested: Vec3;
  rotation: Quaternion;
  lastTarget: Vec3;
  age: number;
  blockedTime: number;
}
const zero: Vec3 = [0, 0, 0];
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
const freshMotion = (): MotionState => ({
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
function motionGate(
  wasActive: boolean,
  exitTicks: number,
  sample: number,
  enter: number,
  exit: number,
): { active: boolean; exitTicks: number } {
  if (!wasActive) return { active: sample >= enter, exitTicks: 0 };
  const nextExitTicks = sample <= exit ? Math.min(exitTicks + 1, MOTION_POLICY.exitStableTicks) : 0;
  return { active: nextExitTicks < MOTION_POLICY.exitStableTicks, exitTicks: nextExitTicks };
}
const dynamic = (mode: BodyMode): boolean =>
  mode === "dynamicGravity" || mode === "dynamicNoGravity";
const fail = (code: string, message: string): never => {
  throw Object.assign(new Error(message), { code });
};
const shape = (o: SceneObject): RAPIER.Shape =>
  o.shape === "sphere"
    ? new RAPIER.Ball(o.dimensionsM[0] / 2)
    : o.shape === "capsule"
      ? new RAPIER.Capsule(
          Math.max(0, (o.dimensionsM[1] - o.dimensionsM[0]) / 2),
          o.dimensionsM[0] / 2,
        )
      : new RAPIER.Cuboid(o.dimensionsM[0] / 2, o.dimensionsM[1] / 2, o.dimensionsM[2] / 2);
const colliderDesc = (o: SceneObject): RAPIER.ColliderDesc =>
  o.shape === "sphere"
    ? RAPIER.ColliderDesc.ball(o.dimensionsM[0] / 2)
    : o.shape === "capsule"
      ? RAPIER.ColliderDesc.capsule(
          Math.max(0, (o.dimensionsM[1] - o.dimensionsM[0]) / 2),
          o.dimensionsM[0] / 2,
        )
      : RAPIER.ColliderDesc.cuboid(
          o.dimensionsM[0] / 2,
          o.dimensionsM[1] / 2,
          o.dimensionsM[2] / 2,
        );

/** The sole Rapier owner. Exposes copied domain data, never persistent WASM handles. */
export class PhysicsWorld {
  private world: RAPIER.World;
  private queue: RAPIER.EventQueue;
  private scene: SceneSpec;
  private records = new Map<string, Record>();
  private colliderIds = new Map<number, string>();
  private generations = new Map<string, number>();
  private pairs = new Map<string, Pair>();
  private pairEpisodes = new Map<string, number>();
  private lastImpactByPair = new Map<string, number>();
  private pending: PendingEvent[] = [];
  private events: PhysicsEvent[] = [];
  private previous: HistoryPose[] = [];
  private commandIds = new Set<string>();
  private grip: Grip | null = null;
  private diagnostics: GrabDiagnostics | null = null;
  private player: CharacterMotor | null = null;
  private playerInput = { forward: 0, right: 0, yaw: 0, sprint: false };
  private disposed = false;
  private epoch = 0;
  private tickValue = 0;
  private impactMinImpulse: number;
  private impactMinSpeed: number;
  private cooldownTicks: number;
  readonly clock: FixedClock;

  static async create(scene: SceneSpec, options: PhysicsOptions = {}): Promise<PhysicsWorld> {
    const validated = createScene(scene);
    await initializePhysics();
    return new PhysicsWorld(validated, options);
  }
  private constructor(scene: SceneSpec, options: PhysicsOptions) {
    this.scene = scene;
    this.clock = new FixedClock({
      fixedDtSeconds: options.fixedDtSeconds ?? 1 / 60,
      maxCatchUpSteps: options.maxCatchUpSteps ?? 4,
      mode: options.clockMode ?? "interactive",
    });
    this.impactMinImpulse = options.impactMinImpulseNs ?? 0.02;
    this.impactMinSpeed = options.impactMinClosingSpeedMps ?? 0.15;
    const cooldown = options.impactCooldownSeconds ?? 0.08;
    if (
      ![this.impactMinImpulse, this.impactMinSpeed, cooldown].every(
        (x) => Number.isFinite(x) && x >= 0 && x <= 60,
      )
    )
      fail("INVALID_OPTIONS", "Invalid impact policy");
    this.cooldownTicks = Math.ceil(cooldown / this.clock.fixedDtSeconds);
    this.world = new RAPIER.World(rv(scene.gravityMps2));
    this.world.timestep = this.clock.fixedDtSeconds;
    this.world.maxCcdSubsteps = 2;
    this.queue = new RAPIER.EventQueue(true);
    for (const object of [...scene.objects].sort((a, b) => a.id.localeCompare(b.id)))
      this.addBody(object);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.previous = this.poses();
  }
  get paused(): boolean {
    return this.clock.paused;
  }
  get tick(): number {
    return this.tickValue;
  }
  get fixedDtSeconds(): number {
    return this.clock.fixedDtSeconds;
  }
  get sceneRevision(): number {
    return this.scene.sceneRevision;
  }
  get heldObjectId(): string | null {
    return this.grip?.objectId ?? null;
  }
  private assertAlive(): void {
    if (this.disposed) fail("DISPOSED", "PhysicsWorld has been disposed");
  }
  private record(id: string): Record {
    this.assertAlive();
    const r = this.records.get(id);
    return r ?? fail("UNKNOWN_ID", `Unknown physics object ${id}`);
  }
  private addBody(object: SceneObject, enabled = true): Record {
    const desc =
      object.mode === "fixed"
        ? RAPIER.RigidBodyDesc.fixed()
        : object.mode === "kinematic"
          ? RAPIER.RigidBodyDesc.kinematicPositionBased()
          : RAPIER.RigidBodyDesc.dynamic();
    desc
      .setTranslation(...object.positionM)
      .setRotation(rq(object.orientationQuaternion))
      .setGravityScale(object.mode === "dynamicNoGravity" ? 0 : 1)
      .setCcdEnabled(dynamic(object.mode));
    const body = this.world.createRigidBody(desc);
    const collider = this.world.createCollider(
      colliderDesc(object)
        .setMass(object.massKg)
        .setFriction(object.friction)
        .setRestitution(object.restitution)
        .setActiveEvents(
          RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
        ),
      body,
    );
    body.recomputeMassPropertiesFromColliders();
    body.setEnabled(enabled);
    const generation = (this.generations.get(object.id) ?? 0) + 1;
    this.generations.set(object.id, generation);
    const record = {
      definition: structuredClone(object),
      body,
      collider,
      generation,
      enabled,
      discontinuityUntilTick: this.tick + 1,
      motion: freshMotion(),
    };
    this.records.set(object.id, record);
    this.colliderIds.set(collider.handle, object.id);
    return record;
  }
  resume(): void {
    this.assertAlive();
    if (this.grip) {
      const record = this.records.get(this.grip.objectId);
      if (
        !record ||
        record.generation !== this.grip.generation ||
        !record.enabled ||
        !dynamic(record.definition.mode) ||
        record.definition.massKg < 0.1 ||
        record.definition.massKg > 20
      )
        fail(
          "HELD_STATE_INVALID",
          "Held geometry/generation changed; explicitly release before resuming",
        );
    }
    this.clock.resume();
    if (this.grip) {
      this.grip.age = 0;
      this.grip.lastTarget = [...this.grip.target];
    }
  }
  pause(): void {
    this.assertAlive();
    this.clock.pause();
    this.playerInput = { forward: 0, right: 0, yaw: 0, sprint: false };
  }
  /** Only advances whole fixed steps; a paused world does no work or impulses. */
  step(): PhysicsSnapshot {
    this.assertAlive();
    if (!this.paused) this.clock.advance(this.fixedDtSeconds, () => this.fixedStep());
    return this.snapshot();
  }
  advance(
    deltaSeconds: number,
    onStep?: (snapshot: PhysicsSnapshot) => void,
  ): {
    snapshot: PhysicsSnapshot;
    steps: number;
    alpha: number;
    tick: number;
    droppedWallTimeSeconds: number;
    overrun: boolean;
  } {
    this.assertAlive();
    let observerError: unknown;
    const result = this.clock.advance(deltaSeconds, () => {
      this.fixedStep();
      try {
        onStep?.(this.snapshot());
      } catch (error) {
        observerError = error;
        this.clock.pause();
      }
    });
    if (observerError !== undefined) throw observerError;
    return { ...result, tick: this.tickValue, snapshot: this.snapshot() };
  }
  snapshot(): PhysicsSnapshot {
    this.assertAlive();
    return {
      tick: this.tick,
      simulationTimeSeconds: this.tick * this.fixedDtSeconds,
      fixedDtSeconds: this.fixedDtSeconds,
      sceneRevision: this.scene.sceneRevision,
      epoch: this.epoch,
      paused: this.paused,
      poses: this.poses(),
      events: structuredClone(this.events),
      heldObjectId: this.heldObjectId,
      grabDiagnostics: this.diagnostics ? structuredClone(this.diagnostics) : null,
      player: this.player?.snapshot() ?? null,
    };
  }
  getPose(id: string): BodyPose {
    this.record(id);
    return this.poses().find((p) => p.objectId === id)!;
  }
  /** A copied live player DTO without projecting unrelated body/contact state. */
  getPlayerPose(): PlayerPose | null {
    this.assertAlive();
    return this.player?.snapshot() ?? null;
  }
  interpolatedPoses(alpha: number): BodyPose[] {
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)
      fail("INVALID_ALPHA", "Interpolation alpha must be in [0,1]");
    const previous = new Map(this.previous.map((p) => [p.objectId, p]));
    return this.poses().map((p) => {
      const old = previous.get(p.objectId);
      if (!old || p.discontinuity || old.generation !== p.generation) return p;
      const target = p.rotation;
      const sign = old.rotation.reduce((s, x, i) => s + x * target[i]!, 0) < 0 ? -1 : 1;
      const q = old.rotation.map((x, i) => x + (sign * target[i]! - x) * alpha) as Quaternion;
      const norm = Math.hypot(...q);
      return {
        ...p,
        positionMetres: add(
          old.positionMetres,
          scale(sub(p.positionMetres, old.positionMetres), alpha),
        ),
        rotation: q.map((x) => x / norm) as Quaternion,
      };
    });
  }
  /** Copied render transforms without unrelated motion/contact projections. */
  interpolatedTransforms(
    alpha: number,
  ): Pick<BodyPose, "objectId" | "positionMetres" | "rotation">[] {
    this.assertAlive();
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)
      fail("INVALID_ALPHA", "Interpolation alpha must be in [0,1]");
    const previous = new Map(this.previous.map((p) => [p.objectId, p]));
    return [...this.records.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([objectId, record]) => {
        const p = {
          objectId,
          positionMetres: vector(record.body.translation()),
          rotation: quaternion(record.body.rotation()),
        };
        const old = previous.get(objectId);
        if (
          !old ||
          this.tick <= record.discontinuityUntilTick ||
          old.generation !== record.generation
        )
          return p;
        const target = p.rotation;
        const sign = old.rotation.reduce((s, x, i) => s + x * target[i]!, 0) < 0 ? -1 : 1;
        const q = old.rotation.map((x, i) => x + (sign * target[i]! - x) * alpha) as Quaternion;
        const norm = Math.hypot(...q);
        return {
          ...p,
          positionMetres: add(
            old.positionMetres,
            scale(sub(p.positionMetres, old.positionMetres), alpha),
          ),
          rotation: q.map((x) => x / norm) as Quaternion,
        };
      });
  }
  private historyPoses(): HistoryPose[] {
    return [...this.records.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([objectId, record]) => ({
        objectId,
        generation: record.generation,
        positionMetres: vector(record.body.translation()),
        rotation: quaternion(record.body.rotation()),
        moving: record.motion.moving,
        sleeping: record.body.isSleeping(),
      }));
  }
  private poses(updateMotion = false): BodyPose[] {
    const contactsByBody = new Map<string, Pair[]>();
    for (const pair of this.pairs.values()) {
      if (pair.contact === null) continue;
      for (const id of pair.a === pair.b ? [pair.a] : [pair.a, pair.b]) {
        const contacts = contactsByBody.get(id);
        if (contacts) contacts.push(pair);
        else contactsByBody.set(id, [pair]);
      }
    }
    return [...this.records.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, r]) => {
        const velocity = vector(r.body.linvel()),
          angular = vector(r.body.angvel());
        const contacts = contactsByBody.get(id) ?? [];
        const supported = contacts.some((p) => {
          const c = p.contact!;
          return (p.a === id ? -c.normalAtoB[1] : c.normalAtoB[1]) > 0.4;
        });
        // Contact point slip is observable; arbitrary-shape rolling classification remains unknown.
        const slip = contacts.reduce(
          (s, p) => Math.max(s, p.contact?.tangentSpeedMetresPerSecond ?? 0),
          0,
        );
        const supportingContacts = contacts.filter(
          (p) => (p.a === id ? -p.contact!.normalAtoB[1] : p.contact!.normalAtoB[1]) > 0.4,
        );
        let representative = [...(supportingContacts.length ? supportingContacts : contacts)].sort(
          (a, b) =>
            (b.contact?.normalImpulseNewtonSeconds ?? 0) -
              (a.contact?.normalImpulseNewtonSeconds ?? 0) ||
            a.contact!.pairKey.localeCompare(b.contact!.pairKey),
        )[0]?.contact;
        let rollingCanEnter = false,
          rollingCanRemain = false;
        if (updateMotion)
          for (const p of supportingContacts) {
            const contact = p.contact!;
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
              .map((pair) => pair.contact!.episodeId)
              .sort()
              .join("|");
            const sameContact = prior.contactEpisodes === contactEpisodes;
            const slipKnown = contacts.every((pair) =>
              Number.isFinite(pair.contact!.tangentSpeedMetresPerSecond),
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
            let rolling: boolean | null =
              supported && r.definition.shape === "sphere" && slipKnown ? false : null;
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
              (b.contact!.tangentSpeedMetresPerSecond ?? -Infinity) -
                (a.contact!.tangentSpeedMetresPerSecond ?? -Infinity) ||
              a.contact!.pairKey.localeCompare(b.contact!.pairKey),
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
  private enqueue(event: PendingEvent): void {
    if (this.pending.length >= 2048) fail("EVENT_BUDGET", "Physics event budget exceeded");
    this.pending.push(event);
  }
  private takeCommand(commandId: string): boolean {
    if (!/^[a-z][a-z0-9._-]{0,63}$/.test(commandId))
      fail("INVALID_COMMAND_ID", "Invalid commandId");
    if (this.commandIds.has(commandId)) return false;
    if (this.commandIds.size >= 4096)
      fail("COMMAND_BUDGET", "Reset before command deduplication budget is exhausted");
    this.commandIds.add(commandId);
    return true;
  }
  setVelocity(id: string, linear: Vec3, angular: Vec3 = zero): void {
    const r = this.record(id);
    if (!dynamic(r.definition.mode)) fail("NOT_DYNAMIC", "Only dynamic objects accept velocity");
    const v = finiteVector(linear, "velocity", 100);
    const w = finiteVector(angular, "angular velocity", 100);
    r.body.setLinvel(rv(v), true);
    r.body.setAngvel(rv(w), true);
  }
  applyImpulse(id: string, impulse: Vec3): void {
    const r = this.record(id);
    if (!dynamic(r.definition.mode)) return;
    r.body.applyImpulse(rv(finiteVector(impulse, "impulse", 10000)), true);
  }
  setKinematicTarget(id: string, position: Vec3, rotation?: Quaternion): void {
    const r = this.record(id);
    if (r.definition.mode !== "kinematic") fail("NOT_KINEMATIC", "Object is not kinematic");
    const target = finiteVector(position, "kinematic target", 200);
    const q = rotation ? finiteQuaternion(rotation) : undefined;
    const delta = sub(target, vector(r.body.translation()));
    const bounded = clampNorm(delta, 3 * this.fixedDtSeconds);
    const hit = this.sweep(
      r.collider.shape,
      vector(r.body.translation()),
      quaternion(r.body.rotation()),
      bounded,
      id,
      0,
    );
    if (hit !== null) fail("KINEMATIC_BLOCKED", "Kinematic target would cross an obstacle");
    const boundedTarget = add(vector(r.body.translation()), bounded);
    if (q) {
      if (this.overlaps(r.definition, boundedTarget, q, id).length)
        fail("KINEMATIC_BLOCKED", "Kinematic rotation overlaps");
    }
    r.body.setNextKinematicTranslation(rv(boundedTarget));
    if (q) r.body.setNextKinematicRotation(rq(q));
  }
  setMode(id: string, mode: BodyMode): void {
    if (!["dynamicGravity", "dynamicNoGravity", "fixed", "kinematic"].includes(mode))
      fail("INVALID_MODE", "Unknown body mode");
    const r = this.record(id),
      old = r.definition.mode;
    if (mode === old) return;
    if (this.heldObjectId === id) this.releaseGrip("mode-change");
    r.body.resetForces(true);
    r.body.resetTorques(true);
    const preserve = dynamic(old) && dynamic(mode),
      v = vector(r.body.linvel()),
      w = vector(r.body.angvel());
    r.body.setBodyType(
      mode === "fixed"
        ? RAPIER.RigidBodyType.Fixed
        : mode === "kinematic"
          ? RAPIER.RigidBodyType.KinematicPositionBased
          : RAPIER.RigidBodyType.Dynamic,
      true,
    );
    r.body.setGravityScale(mode === "dynamicNoGravity" ? 0 : 1, true);
    r.body.setLinvel(rv(preserve ? v : zero), true);
    r.body.setAngvel(rv(preserve ? w : zero), true);
    if (mode === "kinematic") {
      r.body.setNextKinematicTranslation(r.body.translation());
      r.body.setNextKinematicRotation(r.body.rotation());
    }
    r.definition.mode = mode;
    r.motion = preserve
      ? {
          ...r.motion,
          rolling: null,
          sliding: false,
          rollingExitTicks: 0,
          slidingExitTicks: 0,
          contactEpisodes: "",
        }
      : freshMotion();
    r.discontinuityUntilTick = this.tick + 1;
    this.invalidateContacts(id, "mode-change");
    this.enqueue({
      type: "BodyModeChanged",
      objectId: id,
      source: "state",
      accepted: true,
      reason: `${old}->${mode}`,
    });
  }
  grab(id: string, target: Vec3, commandId: string): boolean {
    const r = this.record(id);
    const t = finiteVector(target, "grip target", 200);
    if (
      !r.enabled ||
      !dynamic(r.definition.mode) ||
      r.definition.massKg < 0.1 ||
      r.definition.massKg > 20
    )
      fail("NOT_GRABBABLE", "Requires an active dynamic object between 0.1 and 20kg");
    if (this.grip) fail("ALREADY_HELD", "Release the currently held object first");
    if (length(sub(t, vector(r.body.translation()))) > 1.5)
      fail("TARGET_TOO_FAR", "Initial grip target exceeds bounded reach");
    if (!this.takeCommand(commandId)) return false;
    this.grip = {
      objectId: id,
      generation: r.generation,
      target: t,
      requested: t,
      lastTarget: t,
      rotation: quaternion(r.body.rotation()),
      age: 0,
      blockedTime: 0,
    };
    this.enqueue({
      type: "OnGrab",
      objectId: id,
      source: "interaction",
      accepted: true,
      commandId,
    });
    return true;
  }
  updateGrabTarget(target: Vec3, rotation?: Quaternion): void {
    const g = this.grip ?? fail("NOT_HELD", "Nothing is held");
    const position = finiteVector(target, "grip target", 200);
    const q = rotation ? finiteQuaternion(rotation) : undefined;
    g.requested = position;
    if (q) g.rotation = q;
  }
  drop(commandId: string): boolean {
    if (!this.grip) return false;
    if (!this.takeCommand(commandId)) return false;
    const id = this.grip.objectId;
    this.grip = null;
    this.diagnostics = null;
    this.enqueue({
      type: "OnRelease",
      objectId: id,
      source: "interaction",
      accepted: true,
      commandId,
    });
    this.enqueue({
      type: "OnDrop",
      objectId: id,
      source: "interaction",
      accepted: true,
      commandId,
    });
    return true;
  }
  throwHeld(direction: Vec3, impulseNs: number, commandId: string): boolean {
    if (!this.grip) return false;
    const dir = normalize(finiteVector(direction));
    if (length(dir) < 0.99 || !Number.isFinite(impulseNs) || impulseNs < 0 || impulseNs > 20)
      fail("INVALID_THROW", "Throw requires direction and bounded impulse");
    const r = this.record(this.grip.objectId);
    if (!this.takeCommand(commandId)) return false;
    const v = vector(r.body.linvel()),
      mass = r.body.mass();
    // Solve |v + direction * deltaV| <= 12 without destroying prior momentum.
    const speed = length(v),
      projection = dot(v, dir);
    const allowedDv =
      speed >= 12
        ? 0
        : Math.max(0, -projection + Math.sqrt(projection * projection + 144 - speed * speed));
    const applied = Math.min(impulseNs, allowedDv * mass);
    const id = this.grip.objectId;
    this.grip = null;
    this.diagnostics = null;
    r.body.enableCcd(true);
    r.body.applyImpulse(rv(scale(dir, applied)), true);
    this.enqueue({
      type: "OnRelease",
      objectId: id,
      source: "interaction",
      accepted: true,
      commandId,
    });
    this.enqueue({
      type: "OnThrow",
      objectId: id,
      source: "interaction",
      accepted: true,
      commandId,
      impulseNs: applied,
    });
    return true;
  }
  private releaseGrip(reason: string): void {
    const id = this.grip?.objectId;
    this.grip = null;
    this.diagnostics = null;
    if (id)
      this.enqueue({
        type: "ContactInvalidated",
        objectId: id,
        source: "state",
        accepted: true,
        reason,
      });
  }
  private controlGrip(): void {
    const g = this.grip;
    if (!g) return;
    const r = this.records.get(g.objectId);
    if (!r || !r.enabled || !dynamic(r.definition.mode) || r.generation !== g.generation) {
      this.releaseGrip("invalid-held-object");
      return;
    }
    const h = this.fixedDtSeconds,
      p = vector(r.body.translation());
    g.age += h;
    const requestedStep = clampNorm(sub(g.requested, g.target), 3 * h);
    let target = add(g.target, requestedStep);
    const travel = sub(target, p);
    const hit = this.sweep(
      r.collider.shape,
      p,
      quaternion(r.body.rotation()),
      travel,
      r.definition.id,
      0.002,
    );
    const blocked = hit !== null;
    if (hit !== null) target = add(p, scale(travel, Math.max(0, hit - 0.005)));
    if (this.overlaps(r.definition, target, quaternion(r.body.rotation()), r.definition.id).length)
      target = [...p];
    const error = sub(target, p);
    const trackingError = length(sub(g.requested, p));
    if (trackingError > 1.5) {
      this.releaseGrip("tracking-distance-limit");
      return;
    }
    g.blockedTime = blocked && trackingError > 0.75 ? g.blockedTime + h : 0;
    if (g.blockedTime > 0.25) g.requested = [...target];
    const vt = clampNorm(scale(sub(target, g.lastTarget), 1 / h), 3),
      velocity = vector(r.body.linvel());
    const kp = 100,
      kd = 20,
      denom = 1 + kd * h + kp * h * h;
    const dv = scale(add(scale(error, kp), scale(sub(vt, velocity), kd + kp * h)), h / denom);
    const ramp = Math.min(1, g.age / 0.15),
      cap = Math.min(150 * h, r.body.mass() * 20 * h) * ramp;
    const rawImpulse = scale(dv, r.body.mass()),
      impulse = clampNorm(rawImpulse, cap);
    r.body.applyImpulse(rv(impulse), true);
    const current = quaternion(r.body.rotation());
    const ex =
      g.rotation[3] * -current[0] +
      g.rotation[0] * current[3] -
      g.rotation[1] * current[2] +
      g.rotation[2] * current[1];
    const ey =
      g.rotation[3] * -current[1] +
      g.rotation[0] * current[2] +
      g.rotation[1] * current[3] -
      g.rotation[2] * current[0];
    const ez =
      g.rotation[3] * -current[2] -
      g.rotation[0] * current[1] +
      g.rotation[1] * current[0] +
      g.rotation[2] * current[3];
    const ew =
      g.rotation[3] * current[3] +
      g.rotation[0] * current[0] +
      g.rotation[1] * current[1] +
      g.rotation[2] * current[2];
    const axis: Vec3 = normalize([ex, ey, ez]);
    const angle = 2 * Math.atan2(Math.hypot(ex, ey, ez), Math.abs(ew));
    const er = scale(axis, angle * (ew < 0 ? -1 : 1));
    const angularDv = clampNorm(
      scale(sub(scale(er, kp), scale(vector(r.body.angvel()), kd + kp * h)), h / denom),
      30 * h * ramp,
    );
    const inertia = r.body.effectiveAngularInertia();
    const rawTorque: Vec3 = [
      inertia.m11 * angularDv[0] + inertia.m12 * angularDv[1] + inertia.m13 * angularDv[2],
      inertia.m12 * angularDv[0] + inertia.m22 * angularDv[1] + inertia.m23 * angularDv[2],
      inertia.m13 * angularDv[0] + inertia.m23 * angularDv[1] + inertia.m33 * angularDv[2],
    ];
    // Rotation is admitted only if the requested final orientation is clear; linear sweep is not a rotational CCD proof.
    const torque = this.overlaps(r.definition, p, g.rotation, r.definition.id).length
      ? ([...zero] as Vec3)
      : clampNorm(rawTorque, 15 * h * ramp);
    r.body.applyTorqueImpulse(rv(torque), true);
    g.target = target;
    g.lastTarget = [...target];
    this.diagnostics = {
      objectId: g.objectId,
      targetMetres: [...target],
      trackingErrorMetres: trackingError,
      impulseNewtonSeconds: impulse,
      torqueImpulseNewtonMetreSeconds: torque,
      saturated: length(rawImpulse) > cap + 1e-9 || length(rawTorque) > 15 * h * ramp + 1e-9,
      blocked,
    };
  }
  createPlayer(spawnFootPosition: Vec3): void {
    this.assertAlive();
    if (this.player) fail("PLAYER_EXISTS", "Dispose/reset player before spawning another");
    this.player = new CharacterMotor(
      this.world,
      finiteVector(spawnFootPosition, "player spawn", 200),
    );
  }
  setPlayerInput(input: { forward: number; right: number; yaw: number; sprint?: boolean }): void {
    if (![input.forward, input.right, input.yaw].every(Number.isFinite))
      fail("INVALID_INPUT", "Non-finite player input");
    this.playerInput = {
      forward: Math.max(-1, Math.min(1, input.forward)),
      right: Math.max(-1, Math.min(1, input.right)),
      yaw: input.yaw,
      sprint: input.sprint ?? false,
    };
  }
  raycast(
    origin: Vec3,
    direction: Vec3,
    maxDistance = 3,
    excludeIds: readonly string[] = [],
  ): RaycastHit | null {
    this.assertAlive();
    const dir = normalize(finiteVector(direction));
    if (
      length(dir) < 0.99 ||
      !Number.isFinite(maxDistance) ||
      maxDistance <= 0 ||
      maxDistance > 200
    )
      fail("INVALID_RAY", "Invalid ray");
    const ray = new RAPIER.Ray(rv(finiteVector(origin)), rv(dir));
    this.world.propagateModifiedBodyPositionsToColliders();
    let nearest: RaycastHit | null = null;
    // Canonical Scene budget bounds this direct narrow-phase loop at 256. It also
    // handles paused fresh/imported scenes before Rapier has built its broad phase.
    for (const [id, r] of this.records) {
      if (!r.enabled || r.collider.isSensor() || excludeIds.includes(id)) continue;
      const hit = r.collider.castRayAndGetNormal(ray, maxDistance, true);
      if (
        hit &&
        (!nearest ||
          hit.timeOfImpact < nearest.distanceMetres ||
          (hit.timeOfImpact === nearest.distanceMetres && id < nearest.objectId))
      )
        nearest = {
          objectId: id,
          pointMetres: vector(ray.pointAt(hit.timeOfImpact)),
          normal: vector(hit.normal),
          distanceMetres: hit.timeOfImpact,
          grabbable:
            dynamic(r.definition.mode) && r.definition.massKg >= 0.1 && r.definition.massKg <= 20,
        };
    }
    return nearest;
  }
  private queryColliders(excludeId?: string): RAPIER.Collider[] {
    const colliders = [...this.records]
      .filter(([id, r]) => id !== excludeId && r.enabled && !r.collider.isSensor())
      .map(([, r]) => r.collider);
    if (this.player) colliders.push(this.player.collider);
    return colliders;
  }
  private sweep(
    candidate: RAPIER.Shape,
    position: Vec3,
    rotation: Quaternion,
    travel: Vec3,
    excludeId: string,
    skin: number,
  ): number | null {
    this.world.propagateModifiedBodyPositionsToColliders();
    let earliest: number | null = null;
    for (const collider of this.queryColliders(excludeId)) {
      const hit = collider.castShape(
        rv(zero),
        candidate,
        rv(position),
        rq(rotation),
        rv(travel),
        skin,
        1,
        false,
      );
      if (hit && (earliest === null || hit.time_of_impact < earliest))
        earliest = hit.time_of_impact;
    }
    return earliest;
  }
  private overlaps(
    object: SceneObject,
    position: Vec3,
    rotation: Quaternion,
    excludeId?: string,
  ): string[] {
    this.world.propagateModifiedBodyPositionsToColliders();
    const overlaps: string[] = [],
      candidate = shape(object);
    for (const collider of this.queryColliders(excludeId)) {
      const contact = candidate.contactShape(
        rv(position),
        rq(rotation),
        collider.shape,
        collider.translation(),
        collider.rotation(),
        0,
      );
      if (contact && contact.distance < -0.0001)
        overlaps.push(this.colliderIds.get(collider.handle) ?? "player");
    }
    return [...new Set(overlaps)].sort();
  }
  validatePlacement(object: SceneObject, excludeId?: string): PlacementResult {
    this.assertAlive();
    if (object.positionM.some((x) => !Number.isFinite(x) || Math.abs(x) > 200))
      return { valid: false, reason: "OUT_OF_BOUNDS", blockingObjectIds: [] };
    // Validate geometry through the canonical SceneSpec validator before creating any WASM shape.
    createScene({
      ...this.scene,
      objects: [object],
      sources: [],
      listener: {
        ...this.scene.listener,
        id: object.id === this.scene.listener.id ? "placement-listener" : this.scene.listener.id,
      },
    });
    const blockingObjectIds = this.overlaps(
      object,
      object.positionM,
      object.orientationQuaternion,
      excludeId,
    );
    return {
      valid: blockingObjectIds.length === 0,
      reason: blockingObjectIds.length ? "OVERLAP" : "VALID",
      blockingObjectIds,
    };
  }
  setObjectEnabled(id: string, enabled: boolean): void {
    const r = this.record(id);
    if (this.heldObjectId === id) this.releaseGrip("enabled-change");
    r.enabled = enabled;
    r.body.setEnabled(enabled);
    r.motion = freshMotion();
    r.discontinuityUntilTick = this.tick + 1;
    this.invalidateContacts(id, "enabled-change");
  }
  /** Editor transactions only. Existing unedited bodies keep solver poses/velocities. */
  applyScene(scene: SceneSpec): void {
    this.assertAlive();
    if (!this.paused) fail("PAUSE_REQUIRED", "Scene authoring requires a paused world");
    const next = createScene(scene);
    const ids = new Set(next.objects.map((o) => o.id));
    for (const [id, r] of this.records)
      if (!ids.has(id)) {
        if (this.heldObjectId === id) this.releaseGrip("object-deleted");
        this.invalidateContacts(id, "object-deleted");
        this.colliderIds.delete(r.collider.handle);
        this.world.removeRigidBody(r.body);
        this.records.delete(id);
      }
    for (const object of next.objects) {
      const r = this.records.get(object.id);
      if (!r) {
        this.addBody(object);
        continue;
      }
      const old = r.definition;
      const changedGeometry =
        old.shape !== object.shape ||
        JSON.stringify(old.dimensionsM) !== JSON.stringify(object.dimensionsM);
      if (changedGeometry) {
        this.invalidateContacts(object.id, "geometry-change");
        this.colliderIds.delete(r.collider.handle);
        this.world.removeRigidBody(r.body);
        this.records.delete(object.id);
        this.addBody(object, r.enabled);
        continue;
      }
      if (old.mode !== object.mode) this.setMode(object.id, object.mode);
      if (
        JSON.stringify(old.positionM) !== JSON.stringify(object.positionM) ||
        JSON.stringify(old.orientationQuaternion) !== JSON.stringify(object.orientationQuaternion)
      ) {
        r.body.setTranslation(rv(object.positionM), true);
        r.body.setRotation(rq(object.orientationQuaternion), true);
        r.body.setLinvel(rv(zero), true);
        r.body.setAngvel(rv(zero), true);
        r.motion = freshMotion();
        r.discontinuityUntilTick = this.tick + 1;
        this.invalidateContacts(object.id, "editor-transform");
      }
      r.collider.setMass(object.massKg);
      r.collider.setFriction(object.friction);
      r.collider.setRestitution(object.restitution);
      r.body.recomputeMassPropertiesFromColliders();
      r.definition = structuredClone(object);
    }
    const gravityChanged =
      JSON.stringify(this.scene.gravityMps2) !== JSON.stringify(next.gravityMps2);
    this.scene = next;
    this.world.gravity = rv(next.gravityMps2);
    if (gravityChanged)
      for (const record of this.records.values())
        if (dynamic(record.definition.mode)) record.body.wakeUp();
    this.world.propagateModifiedBodyPositionsToColliders();
    this.previous = this.poses();
  }
  reset(scene: SceneSpec = this.scene): void {
    this.assertAlive();
    const validated = createScene(scene);
    this.pause();
    this.player?.dispose();
    this.player = null;
    this.world.free();
    this.queue.free();
    this.world = new RAPIER.World(rv(validated.gravityMps2));
    this.world.timestep = this.fixedDtSeconds;
    this.world.maxCcdSubsteps = 2;
    this.queue = new RAPIER.EventQueue(true);
    this.scene = validated;
    this.records.clear();
    this.colliderIds.clear();
    this.pairs.clear();
    this.pairEpisodes.clear();
    this.lastImpactByPair.clear();
    this.pending = [];
    this.events = [];
    this.commandIds.clear();
    this.grip = null;
    this.diagnostics = null;
    this.tickValue = 0;
    this.epoch++;
    this.clock.reset();
    for (const object of [...validated.objects].sort((a, b) => a.id.localeCompare(b.id)))
      this.addBody(object);
    this.previous = this.poses();
    this.world.propagateModifiedBodyPositionsToColliders();
  }
  dispose(): void {
    if (this.disposed) return;
    this.player?.dispose();
    this.player = null;
    this.world.free();
    this.queue.free();
    this.records.clear();
    this.colliderIds.clear();
    this.pending = [];
    this.events = [];
    this.grip = null;
    this.disposed = true;
  }
  private invalidateContacts(id: string, reason: string): void {
    for (const [key, pair] of this.pairs)
      if (pair.a === id || pair.b === id) this.pairs.delete(key);
    this.enqueue({
      type: "ContactInvalidated",
      objectId: id,
      source: "state",
      accepted: true,
      reason,
    });
  }
  private fixedStep(): void {
    const before = this.historyPoses();
    this.previous = before;
    this.controlGrip();
    this.player?.step(this.playerInput, this.fixedDtSeconds);
    const pre = new Map<string, PreSolve>();
    for (const [id, r] of this.records)
      pre.set(id, {
        center: vector(r.body.worldCom()),
        velocity: vector(r.body.linvel()),
        angular: vector(r.body.angvel()),
      });
    this.world.step(this.queue);
    this.tickValue++;
    this.queue.drainCollisionEvents((ha, hb, started) => {
      const ia = this.colliderIds.get(ha),
        ib = this.colliderIds.get(hb);
      if (!ia || !ib) return;
      const [a, b] = [ia, ib].sort() as [string, string];
      const key = `pair-${stableHash(a + "|" + b)}`;
      if (started) {
        const n = (this.pairEpisodes.get(key) ?? 0) + 1;
        this.pairEpisodes.set(key, n);
        const pair: Pair = {
          a,
          b,
          episodeId: `${key}.e${n}`,
          onsetTick: this.tick,
          lastImpactTick: -1000000,
          contact: null,
        };
        this.pairs.set(key, pair);
        this.enqueue({
          type: "ContactBegin",
          objectId: a,
          otherObjectId: b,
          source: "physics",
          accepted: true,
        });
      } else {
        const pair = this.pairs.get(key);
        if (pair)
          this.enqueue({
            type: "ContactEnd",
            objectId: pair.a,
            otherObjectId: pair.b,
            source: "physics",
            accepted: true,
          });
        this.pairs.delete(key);
      }
    });
    this.queue.drainContactForceEvents(() => {
      /* Force events are distinct from contactImpulse; consume bounded engine queue. */
    });
    // A mode edit invalidates audible episodes but may leave the same physical
    // support contact alive. Recover its state without inventing a new impact.
    for (const [id, r] of this.records)
      if (r.enabled)
        this.world.contactPairsWith(r.collider, (collider) => {
          const other = this.colliderIds.get(collider.handle);
          if (!other || other === id) return;
          const [a, b] = [id, other].sort() as [string, string],
            key = `pair-${stableHash(a + "|" + b)}`;
          if (!this.pairs.has(key)) {
            const n = (this.pairEpisodes.get(key) ?? 0) + 1;
            this.pairEpisodes.set(key, n);
            this.pairs.set(key, {
              a,
              b,
              episodeId: `${key}.e${n}`,
              onsetTick: -1,
              lastImpactTick: this.lastImpactByPair.get(key) ?? -1000000,
              contact: null,
            });
          }
        });
    for (const [key, pair] of this.pairs) this.samplePair(key, pair, pre);
    const old = new Map(before.map((p) => [p.objectId, p]));
    for (const pose of this.poses(true)) {
      const prior = old.get(pose.objectId);
      if (!prior) continue;
      if (pose.moving !== prior.moving)
        this.enqueue({
          type: pose.moving ? "OnStartMoving" : "OnStopMoving",
          objectId: pose.objectId,
          source: "state",
          accepted: true,
        });
      if (pose.sleeping !== prior.sleeping)
        this.enqueue({
          type: pose.sleeping ? "OnSleep" : "OnWake",
          objectId: pose.objectId,
          source: "state",
          accepted: true,
        });
    }
    const pending = this.pending;
    this.pending = [];
    this.events = pending.map((event, sequence) => {
      const r = this.records.get(event.objectId);
      return {
        ...event,
        eventId: `phys-${this.epoch}-${this.tick}-${sequence}`,
        tick: this.tick,
        sequence,
        sceneRevision: this.scene.sceneRevision,
        simulationTimeSeconds: this.tick * this.fixedDtSeconds,
        fixedDtSeconds: this.fixedDtSeconds,
        generation: r?.generation ?? this.generations.get(event.objectId) ?? 0,
        positionMetres: event.positionMetres ?? (r ? vector(r.body.translation()) : [...zero]),
      };
    });
  }
  private samplePair(key: string, pair: Pair, pre: Map<string, PreSolve>): void {
    const a = this.records.get(pair.a),
      b = this.records.get(pair.b);
    if (!a || !b) return;
    let total = 0,
      weight = 0,
      position: Vec3 = [0, 0, 0],
      normal: Vec3 = [0, 0, 0],
      contactCount = 0;
    this.world.contactPair(a.collider, b.collider, (m, flipped) => {
      const c1 = flipped ? b.collider : a.collider,
        c2 = flipped ? a.collider : b.collider;
      for (let i = 0; i < m.numContacts(); i++) {
        if (m.contactDist(i) > 0.015) continue;
        const p1 = m.localContactPoint1(i),
          p2 = m.localContactPoint2(i);
        if (!p1 || !p2) continue;
        const w1 = add(vector(c1.translation()), rotate(vector(p1), quaternion(c1.rotation()))),
          w2 = add(vector(c2.translation()), rotate(vector(p2), quaternion(c2.rotation())));
        const j = Math.max(0, m.contactImpulse(i)),
          w = Math.max(j, 1e-6);
        total += j;
        weight += w;
        contactCount++;
        const witnessA = flipped ? w2 : w1;
        const witnessB = flipped ? w1 : w2;
        // A penetrated midpoint can sit inside the support slab. Prefer the actual
        // non-dynamic surface witness so emitted sound begins on the physical boundary.
        const supportA = !dynamic(a.definition.mode),
          supportB = !dynamic(b.definition.mode);
        const point =
          supportA && !supportB
            ? witnessA
            : supportB && !supportA
              ? witnessB
              : scale(add(w1, w2), 0.5);
        position = add(position, scale(point, w));
        normal = add(normal, scale(vector(m.normal()), (flipped ? -1 : 1) * w));
      }
    });
    if (!contactCount) {
      pair.contact = null;
      return;
    }
    position = scale(position, 1 / weight);
    normal = normalize(normal);
    const pointVelocity = (id: string): Vec3 => {
      const p = pre.get(id)!;
      return add(p.velocity, cross(p.angular, sub(position, p.center)));
    };
    const relative = sub(pointVelocity(pair.b), pointVelocity(pair.a)),
      normalSpeed = dot(relative, normal),
      closing = Math.max(0, -normalSpeed),
      tangent = length(sub(relative, scale(normal, normalSpeed)));
    const contact: ContactData = {
      pairKey: key,
      episodeId: pair.episodeId,
      objectA: pair.a,
      objectB: pair.b,
      colliderA: `col-${stableHash(pair.a)}`,
      colliderB: `col-${stableHash(pair.b)}`,
      materialA: a.definition.physicsMaterialId,
      materialB: b.definition.physicsMaterialId,
      pointWorldMetres: position,
      normalAtoB: normal,
      normalImpulseNewtonSeconds: total,
      impulseMethod: "RapierContactImpulse",
      closingSpeedMetresPerSecond: closing,
      tangentSpeedMetresPerSecond: tangent,
      velocityMethod: "PreStepRigidBodyEstimate",
    };
    pair.contact = contact;
    const discontinuity =
      this.tick <= a.discontinuityUntilTick || this.tick <= b.discontinuityUntilTick;
    if (
      pair.onsetTick === this.tick &&
      !discontinuity &&
      total >= this.impactMinImpulse &&
      closing >= this.impactMinSpeed &&
      this.tick - (this.lastImpactByPair.get(key) ?? -1000000) >= this.cooldownTicks
    ) {
      pair.lastImpactTick = this.tick;
      this.lastImpactByPair.set(key, this.tick);
      // Deterministic owner: dynamic vs static chooses dynamic; dynamic-vs-dynamic chooses lexical ID. Explicit profile layers may target both later.
      const owner =
        dynamic(a.definition.mode) && !dynamic(b.definition.mode)
          ? a
          : dynamic(b.definition.mode) && !dynamic(a.definition.mode)
            ? b
            : a;
      this.enqueue({
        type: "OnImpact",
        objectId: owner.definition.id,
        otherObjectId: owner === a ? pair.b : pair.a,
        source: "physics",
        accepted: true,
        positionMetres: position,
        impulseNs: total,
        contact,
      });
    }
  }
}
