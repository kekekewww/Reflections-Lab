import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
} from "three";
import type { PathView } from "../contracts.js";
import { canonicalTokens } from "../tokens.js";

type PathInput = Pick<PathView, "points" | "kind" | "stale">;
const colors = canonicalTokens.color;
const ignoreRaycast: Line["raycast"] = () => {};

function releaseGeometry(geometry: BufferGeometry) {
  // WebGL releases GPU buffers via geometry disposal while its attributes are
  // still attached. Attribute disposal also supports the WebGPU lifecycle.
  geometry.dispose();
  for (const attribute of Object.values(geometry.attributes))
    (attribute as BufferAttribute).dispose();
}

/** Owns one mounted path's line, capacity buffers and material. No runtime DTOs retained. */
export class SolverPathLine {
  readonly line: Line<BufferGeometry, LineBasicMaterial>;
  private values = new Float64Array(0);
  private capacity = 0;
  private pointCount = -1;
  private kind: PathView["kind"] | undefined;
  private stale = false;
  private disposed = false;

  constructor() {
    this.line = new Line(new BufferGeometry(), new LineBasicMaterial({ transparent: true }));
  }

  update(path: PathInput) {
    if (this.disposed) throw new Error("SolverPathLine is disposed");
    const { points, kind } = path;
    const stale = path.stale === true;
    let pointsChanged = points.length !== this.pointCount;
    if (!pointsChanged) {
      for (let index = 0; index < points.length && !pointsChanged; index++) {
        for (let axis = 0; axis < 3; axis++) {
          if (this.values[index * 3 + axis] !== points[index]![axis]) pointsChanged = true;
        }
      }
    }
    if (pointsChanged) {
      if (points.length > this.capacity || this.capacity === 0) {
        const capacity = Math.max(2, points.length, this.capacity * 2);
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage),
        );
        geometry.setAttribute(
          "lineDistance",
          new BufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage),
        );
        const old = this.line.geometry;
        this.line.geometry = geometry;
        releaseGeometry(old);
        this.capacity = capacity;
        this.values = new Float64Array(capacity * 3);
      }
      const geometry = this.line.geometry;
      const position = geometry.getAttribute("position") as BufferAttribute;
      const distances = geometry.getAttribute("lineDistance") as BufferAttribute;
      let distance = 0;
      for (let index = 0; index < points.length; index++) {
        for (let axis = 0; axis < 3; axis++) {
          const offset = index * 3 + axis;
          this.values[offset] = points[index]![axis]!;
          position.array[offset] = points[index]![axis]!;
        }
        if (index > 0) {
          // Match Line.computeLineDistances: distances use rendered Float32
          // coordinates, accumulated in double precision before each store.
          const offset = index * 3;
          const dx = position.array[offset - 3]! - position.array[offset]!;
          const dy = position.array[offset - 2]! - position.array[offset + 1]!;
          const dz = position.array[offset - 1]! - position.array[offset + 2]!;
          distance += Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        distances.array[index] = distance;
      }
      // Bounds scan capacity, whereas rendering and raycast honor drawRange.
      // Pad spare slots with the last active point so old vertices cannot
      // enlarge the sphere after a shrink. No visible vertices are added.
      for (let index = points.length; index < this.capacity; index++) {
        for (let axis = 0; axis < 3; axis++) {
          position.array[index * 3 + axis] = points.length
            ? position.array[(points.length - 1) * 3 + axis]!
            : 0;
        }
        distances.array[index] = distance;
      }
      geometry.setDrawRange(0, points.length);
      position.needsUpdate = true;
      distances.needsUpdate = true;
      geometry.computeBoundingSphere();
      this.pointCount = points.length;
    }
    if (kind !== this.kind || stale !== this.stale) {
      const dashed = kind === "blocked" || kind === "transmission";
      if (dashed !== this.line.material instanceof LineDashedMaterial) {
        const old = this.line.material;
        this.line.material = dashed
          ? new LineDashedMaterial({ transparent: true, dashSize: 0.1, gapSize: 0.07 })
          : new LineBasicMaterial({ transparent: true });
        old.dispose();
      }
      const color = stale
        ? colors.warning.$value
        : kind === "direct"
          ? colors.success.$value
          : kind === "blocked"
            ? colors.danger.$value
            : kind === "transmission"
              ? colors.textSecondary.$value
              : colors.accent.$value;
      this.line.material.color.set(color);
      this.line.material.opacity = stale ? 0.5 : dashed ? 0.8 : 0.9;
      this.kind = kind;
      this.stale = stale;
    }
  }

  /**
   * While false, picking rays pass through the line. three.js picks a line anywhere within its
   * 1 m default threshold, so an open trajectory editor turns picking off: its clicks belong to
   * the surfaces behind the line.
   */
  setPickable(pickable: boolean) {
    this.line.raycast = pickable ? Line.prototype.raycast : ignoreRaycast;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    releaseGeometry(this.line.geometry);
    this.line.material.dispose();
  }
}
