import type { PhysicsWorld } from "../physics/index.js";
import { TRAJECTORY_LIMITS, type SceneSpec } from "../scene/types.js";
import { timePath, type PathProblem } from "../motion/trajectory-path.js";
import type { TrajectoryStatusView } from "../ui/contracts.js";

/** Per-path facts that depend only on the scene: length, travel time and fixed-geometry check. */
export interface PathGeometry {
  lengthM: number;
  durationS: number;
  problem?: Exclude<PathProblem, "TOO_MANY">;
}

/** The physics world's coordinate bound; a path point beyond it cannot be driven. */
const WORLD_BOUND_M = 200;

/** `world` must hold the scene's starting layout (a world freshly built or reset from `scene`). */
export function measurePaths(
  scene: SceneSpec,
  world: PhysicsWorld,
): ReadonlyMap<string, PathGeometry> {
  const measured = new Map<string, PathGeometry>();
  for (const object of scene.objects) {
    if (!object.trajectory) continue;
    const path = timePath(object.positionM, object.trajectory);
    const facts = { lengthM: path.lengthM, durationS: path.durationS };
    if (path.durationS > TRAJECTORY_LIMITS.maxDurationS)
      measured.set(object.id, { ...facts, problem: "TOO_LONG" });
    else if (
      path.pointsM.some((point) => point.some((value) => Math.abs(value) > WORLD_BOUND_M)) ||
      world.firstFixedHitAlong(object.id, path.pointsM, object.orientationQuaternion) !== null
    )
      measured.set(object.id, { ...facts, problem: "BLOCKED" });
    else measured.set(object.id, facts);
  }
  return measured;
}

/**
 * Valid paths of audible objects run in lexical id order, at most `maxPathsPerTake` of them;
 * the rest are TOO_MANY. A path on a non-audible object is reported but never runs or ranks.
 */
export function rankPaths(
  geometry: ReadonlyMap<string, PathGeometry>,
  audible: ReadonlySet<string>,
): { status: Readonly<Record<string, TrajectoryStatusView>>; runnable: ReadonlySet<string> } {
  const status: Record<string, TrajectoryStatusView> = {};
  const runnable = new Set<string>();
  for (const id of [...geometry.keys()].sort()) {
    const { lengthM, durationS, problem: measured } = geometry.get(id)!;
    let problem: PathProblem | undefined = measured;
    if (!problem && audible.has(id)) {
      if (runnable.size < TRAJECTORY_LIMITS.maxPathsPerTake) runnable.add(id);
      else problem = "TOO_MANY";
    }
    status[id] = Object.freeze({
      lengthM,
      durationS,
      valid: problem === undefined,
      ...(problem ? { problem } : {}),
    });
  }
  return { status: Object.freeze(status), runnable };
}
