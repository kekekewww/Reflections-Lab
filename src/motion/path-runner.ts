import type { PhysicsWorld } from "../physics/index.js";
import type { BodyMode, Quaternion, SceneSpec, Vector3 } from "../scene/types.js";
import { TRAJECTORY_LIMITS } from "../scene/types.js";
import { poseAt, timePath, type TimedPath } from "./trajectory-path.js";

export type PathRunStatus = "delayed" | "moving" | "finished" | "blocked";
export interface PathRunView {
  objectId: string;
  status: PathRunStatus;
  elapsedS: number;
  /** Set when the run ended on an error other than KINEMATIC_BLOCKED. */
  errorCode?: string;
}

const PATH_MAX_SPEED_MPS = 20;
const END_EPSILON_S = 1e-9;

interface Run {
  objectId: string;
  path: TimedPath;
  rotation: Quaternion;
  originalMode: BodyMode;
  stepCount: number;
  status: PathRunStatus;
  errorCode?: string;
}

const isDynamic = (mode: BodyMode): boolean =>
  mode === "dynamicGravity" || mode === "dynamicNoGravity";

/** Drives path-carrying objects kinematically on the fixed step, then hands them back to physics. */
export class PathRunner {
  private runs: Run[] = [];
  private readonly unobserve: () => void;

  constructor(
    private readonly world: PhysicsWorld,
    private readonly onChange?: () => void,
  ) {
    this.unobserve = world.observeFixedSteps({
      beforeStep: () => this.beforeStep(),
      afterStep: () => this.afterStep(),
    });
  }

  beginTake(scene: SceneSpec, runnable: ReadonlySet<string>): PathRunView[] {
    this.clear();
    const chosen = scene.objects
      .filter((o) => o.trajectory !== undefined && runnable.has(o.id))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, TRAJECTORY_LIMITS.maxPathsPerTake);
    for (const o of chosen) {
      const path = timePath(o.positionM, o.trajectory!);
      this.world.setMode(o.id, "kinematic");
      this.runs.push({
        objectId: o.id,
        path,
        rotation: o.orientationQuaternion,
        originalMode: o.mode,
        stepCount: 0,
        status: path.startDelayS > 0 ? "delayed" : "moving",
      });
    }
    return this.view();
  }

  /** Drops runs without touching the world; the caller resets the world between takes. */
  clear(): void {
    this.runs = [];
  }

  isRunning(objectId: string): boolean {
    return this.runs.some((r) => r.objectId === objectId && this.active(r));
  }

  view(): PathRunView[] {
    const dt = this.world.fixedDtSeconds;
    return this.runs.map((r) => ({
      objectId: r.objectId,
      status: r.status,
      elapsedS: r.stepCount * dt,
      ...(r.errorCode ? { errorCode: r.errorCode } : {}),
    }));
  }

  dispose(): void {
    this.unobserve();
    this.clear();
  }

  private active(run: Run): boolean {
    return run.status === "delayed" || run.status === "moving";
  }

  private beforeStep(): void {
    const dt = this.world.fixedDtSeconds;
    for (const run of this.runs) {
      if (!this.active(run)) continue;
      const pose = poseAt(run.path, run.rotation, (run.stepCount + 1) * dt);
      try {
        this.world.setKinematicTarget(
          run.objectId,
          pose.positionM,
          run.path.faceAlongPath ? pose.orientationQuaternion : undefined,
          PATH_MAX_SPEED_MPS,
        );
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "PATH_RUNTIME_ERROR";
        // Other errors end the run too, with the code kept on the view, so the step is never thrown through.
        this.finish(
          run,
          "blocked",
          pose.velocityMps,
          code === "KINEMATIC_BLOCKED" ? undefined : code,
        );
      }
    }
  }

  private afterStep(): void {
    const dt = this.world.fixedDtSeconds;
    for (const run of this.runs) {
      if (!this.active(run)) continue;
      run.stepCount += 1;
      const elapsed = run.stepCount * dt;
      if (elapsed >= run.path.startDelayS + run.path.durationS - END_EPSILON_S) {
        const pose = poseAt(run.path, run.rotation, elapsed);
        this.finish(run, "finished", pose.velocityMps);
      } else {
        const status = elapsed >= run.path.startDelayS ? "moving" : "delayed";
        if (status !== run.status) {
          run.status = status;
          this.onChange?.();
        }
      }
    }
  }

  private finish(run: Run, status: PathRunStatus, velocityMps: Vector3, errorCode?: string): void {
    run.status = status;
    if (errorCode) run.errorCode = errorCode;
    this.world.setMode(run.objectId, run.originalMode);
    if (isDynamic(run.originalMode)) this.world.setVelocity(run.objectId, velocityMps);
    this.onChange?.();
  }
}
