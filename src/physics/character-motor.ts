import RAPIER, {
  type Collider,
  type KinematicCharacterController,
  type RigidBody,
  type World,
} from "@dimforge/rapier3d-compat";
import type { Vec3 } from "../scene/types.js";

export interface CharacterInput {
  /** Positive forward follows camera local -Z; yaw rotates around world +Y. */
  forward: number;
  right: number;
  yaw: number;
  sprint?: boolean;
}

export interface CharacterMotorOptions {
  radiusMetres?: number;
  totalHeightMetres?: number;
  eyeHeightMetres?: number;
  walkSpeedMps?: number;
  sprintSpeedMps?: number;
  gravityMps2?: number;
  terminalFallSpeedMps?: number;
  offsetMetres?: number;
}

export interface CharacterSnapshot {
  /** Capsule centre, not the camera position. */
  positionMetres: Vec3;
  footPositionMetres: Vec3;
  eyePositionMetres: Vec3;
  grounded: boolean;
  verticalVelocityMps: number;
}

export class CharacterMotorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CharacterMotorError";
  }
}

function finite(value: number, min: number, max: number, field: string): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new CharacterMotorError("INVALID_INPUT", `${field} must be finite within ${min}..${max}`);
  }
  return value;
}

function validateFoot(position: Vec3): void {
  if (!Array.isArray(position) || position.length !== 3) {
    throw new CharacterMotorError(
      "INVALID_INPUT",
      "Spawn foot position must contain three coordinates",
    );
  }
  for (const coordinate of position) finite(coordinate, -200, 200, "spawn coordinate");
}

/**
 * A collision-aware upright capsule motor. The host calls step() before world.step().
 * step() schedules a corrected kinematic target; it never advances the shared world.
 * No autostep, jumping, crouching, camera parenting or unbounded dynamic-body pushing.
 */
export class CharacterMotor {
  readonly body: RigidBody;
  readonly collider: Collider;
  readonly radiusMetres: number;
  readonly totalHeightMetres: number;
  readonly eyeHeightMetres: number;
  private readonly controller: KinematicCharacterController;
  private readonly walkSpeedMps: number;
  private readonly sprintSpeedMps: number;
  private readonly gravityMps2: number;
  private readonly terminalFallSpeedMps: number;
  private readonly initialFootPosition: Vec3;
  private verticalVelocityMps = 0;
  private grounded = false;
  private disposed = false;

  constructor(
    private readonly world: World,
    spawnFootPosition: Vec3,
    options: CharacterMotorOptions = {},
  ) {
    validateFoot(spawnFootPosition);
    this.radiusMetres = finite(options.radiusMetres ?? 0.25, 0.1, 1, "radiusMetres");
    this.totalHeightMetres = finite(options.totalHeightMetres ?? 1.75, 0.5, 3, "totalHeightMetres");
    this.eyeHeightMetres = finite(
      options.eyeHeightMetres ?? 1.6,
      0.1,
      this.totalHeightMetres,
      "eyeHeightMetres",
    );
    if (this.totalHeightMetres < 2 * this.radiusMetres) {
      throw new CharacterMotorError(
        "INVALID_INPUT",
        "Capsule height must be at least its diameter",
      );
    }
    this.walkSpeedMps = finite(options.walkSpeedMps ?? 2, 0.1, 5, "walkSpeedMps");
    this.sprintSpeedMps = finite(
      options.sprintSpeedMps ?? 3.5,
      this.walkSpeedMps,
      8,
      "sprintSpeedMps",
    );
    this.gravityMps2 = finite(options.gravityMps2 ?? world.gravity.y, -50, 0, "gravityMps2");
    this.terminalFallSpeedMps = finite(
      options.terminalFallSpeedMps ?? 30,
      1,
      50,
      "terminalFallSpeedMps",
    );
    const offset = finite(options.offsetMetres ?? 0.01, 0.001, 0.05, "offsetMetres");
    this.initialFootPosition = [...spawnFootPosition];
    const centre = this.centreFromFoot(spawnFootPosition);
    const shape = new RAPIER.Capsule(
      this.totalHeightMetres / 2 - this.radiusMetres,
      this.radiusMetres,
    );
    this.ensureClearance(centre, shape);
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(centre[0], centre[1], centre[2]),
    );
    try {
      this.collider = world.createCollider(
        RAPIER.ColliderDesc.capsule(
          this.totalHeightMetres / 2 - this.radiusMetres,
          this.radiusMetres,
        )
          .setFriction(0)
          .setRestitution(0),
        this.body,
      );
      this.controller = world.createCharacterController(offset);
      this.controller.setUp({ x: 0, y: 1, z: 0 });
      this.controller.setSlideEnabled(true);
      this.controller.disableAutostep();
      this.controller.enableSnapToGround(0.1);
      this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
      this.controller.setMinSlopeSlideAngle(Math.PI / 4);
      this.controller.setApplyImpulsesToDynamicBodies(false);
      world.propagateModifiedBodyPositionsToColliders();
    } catch (error) {
      world.removeRigidBody(this.body);
      throw error;
    }
  }

  private assertActive(): void {
    if (this.disposed || !this.body.isValid() || !this.collider.isValid()) {
      throw new CharacterMotorError("DISPOSED", "Character motor is no longer active");
    }
  }

  private centreFromFoot(foot: Vec3): Vec3 {
    return [foot[0], foot[1] + this.totalHeightMetres / 2, foot[2]];
  }

  private ensureClearance(centre: Vec3, shape: RAPIER.Shape, exclude?: Collider): void {
    this.world.propagateModifiedBodyPositionsToColliders();
    let obstructed = false;
    this.world.colliders.forEach((collider) => {
      if (collider === exclude || collider.isSensor() || !collider.isEnabled()) return;
      const contact = collider.contactShape(
        shape,
        { x: centre[0], y: centre[1], z: centre[2] },
        { x: 0, y: 0, z: 0, w: 1 },
        0,
      );
      if (contact && contact.distance < -0.0001) obstructed = true;
    });
    if (obstructed)
      throw new CharacterMotorError("SPAWN_BLOCKED", "Player capsule overlaps scene geometry");
  }

  private at(position: Vec3): CharacterSnapshot {
    const footY = position[1] - this.totalHeightMetres / 2;
    return {
      positionMetres: [...position],
      footPositionMetres: [position[0], footY, position[2]],
      eyePositionMetres: [position[0], footY + this.eyeHeightMetres, position[2]],
      grounded: this.grounded,
      verticalVelocityMps: this.verticalVelocityMps,
    };
  }

  /** Rapier's broad phase can lag newly added/moved colliders until world.step(). */
  private guardMovement(movement: RAPIER.Vector): RAPIER.Vector {
    this.world.propagateModifiedBodyPositionsToColliders();
    const length = Math.hypot(movement.x, movement.y, movement.z);
    if (length < 1e-10) return movement;
    let fraction = 1;
    this.world.colliders.forEach((other) => {
      if (other === this.collider || other.isSensor() || !other.isEnabled()) return;
      // Pairwise narrow-phase casting is independent of the world's query broad phase.
      const hit = this.collider.castCollider(movement, other, { x: 0, y: 0, z: 0 }, 0, 1, false);
      if (!hit) return;
      // The player capsule is upright, so its local normal is also a world normal.
      // Ignore grazing/away motion at existing support contacts.
      const approaching =
        movement.x * hit.normal1.x + movement.y * hit.normal1.y + movement.z * hit.normal1.z;
      if (approaching > 1e-9) {
        fraction = Math.min(fraction, Math.max(0, hit.time_of_impact - 0.0001 / length));
      }
    });
    const corrected = {
      x: movement.x * fraction,
      y: movement.y * fraction,
      z: movement.z * fraction,
    };
    const position = this.body.translation();
    const target = {
      x: position.x + corrected.x,
      y: position.y + corrected.y,
      z: position.z + corrected.z,
    };
    let penetrates = false;
    this.world.colliders.forEach((other) => {
      if (other === this.collider || other.isSensor() || !other.isEnabled()) return;
      const contact = other.contactShape(this.collider.shape, target, this.collider.rotation(), 0);
      if (contact && contact.distance < -0.0001) penetrates = true;
    });
    // Conservative rejection is preferable to advancing into newly committed geometry.
    return penetrates ? { x: 0, y: 0, z: 0 } : corrected;
  }

  step(input: CharacterInput, dt: number): CharacterSnapshot {
    this.assertActive();
    finite(dt, 0.0001, 0.1, "dt");
    finite(input.forward, -1, 1, "forward");
    finite(input.right, -1, 1, "right");
    finite(input.yaw, -1e6, 1e6, "yaw");
    if (input.sprint !== undefined && typeof input.sprint !== "boolean") {
      throw new CharacterMotorError("INVALID_INPUT", "sprint must be boolean");
    }
    const magnitude = Math.hypot(input.forward, input.right);
    const denominator = Math.max(1, magnitude);
    const forward = input.forward / denominator;
    const right = input.right / denominator;
    const speed = input.sprint ? this.sprintSpeedMps : this.walkSpeedMps;
    this.verticalVelocityMps = Math.max(
      -this.terminalFallSpeedMps,
      (this.grounded ? Math.min(this.verticalVelocityMps, 0) : this.verticalVelocityMps) +
        this.gravityMps2 * dt,
    );
    const c = Math.cos(input.yaw),
      s = Math.sin(input.yaw);
    this.controller.computeColliderMovement(
      this.collider,
      {
        x: (right * c - forward * s) * speed * dt,
        y: this.verticalVelocityMps * dt,
        z: (-right * s - forward * c) * speed * dt,
      },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    );
    const movement = this.guardMovement(this.controller.computedMovement());
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.verticalVelocityMps < 0) this.verticalVelocityMps = 0;
    const position = this.body.translation();
    const target: Vec3 = [
      position.x + movement.x,
      position.y + movement.y,
      position.z + movement.z,
    ];
    this.body.setNextKinematicTranslation({ x: target[0], y: target[1], z: target[2] });
    return this.at(target);
  }

  snapshot(): CharacterSnapshot {
    this.assertActive();
    const position = this.body.translation();
    return this.at([position.x, position.y, position.z]);
  }

  /** Explicit reset only; normal movement always uses the collision-aware next target. */
  reset(spawnFootPosition: Vec3 = this.initialFootPosition): CharacterSnapshot {
    this.assertActive();
    validateFoot(spawnFootPosition);
    const centre = this.centreFromFoot(spawnFootPosition);
    this.ensureClearance(centre, this.collider.shape, this.collider);
    const target = { x: centre[0], y: centre[1], z: centre[2] };
    this.body.setTranslation(target, true);
    this.body.setNextKinematicTranslation(target);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.verticalVelocityMps = 0;
    this.grounded = false;
    this.world.propagateModifiedBodyPositionsToColliders();
    return this.snapshot();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.removeCharacterController(this.controller);
    if (this.body.isValid()) this.world.removeRigidBody(this.body);
  }
}
