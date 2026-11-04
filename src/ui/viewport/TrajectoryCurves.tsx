import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  type Group,
  type Mesh,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { controlPoints, curvePoints } from "../../motion/trajectory-path.js";
import { add } from "../../interaction/math.js";
import type { LabViewModel, ObjectView, Vector3 } from "../contracts.js";
import { canonicalTokens } from "../tokens.js";
import { movePoint, trajectoryEditable, type TrajectoryUiState } from "../inspector-trajectory.js";
import { gizmoSuppressesSelection, type GizmoBridge } from "./TransformGizmo.js";

const colors = canonicalTokens.color;
/** The solver path's selected-point node size; a point handle is no larger. */
const HANDLE_RADIUS_M = 0.055;
/** The dash of the solver's blocked and transmission lines, so dashed means the same here. */
const DASH = { dashSize: 0.1, gapSize: 0.07 };
/** The object gizmo's size, so both move handles read alike. */
const GIZMO_SIZE = 0.8;
/** `GizmoBridge.dragging` marker: never an object id, so no object's pose copy is skipped. */
const DRAG_ID = "trajectory-point";
type ControlsCleanup = (dispose: () => void) => () => void;

export interface TrajectoryCurveTarget {
  objectId: string;
  /** The first-person stroke in progress, drawn from `model.paint`. */
  live: boolean;
}

/**
 * The curves the viewport draws. Without an open editor, painting or Shift+T nothing is drawn.
 * A live stroke replaces the painted object's stored curve, which it will overwrite.
 */
export function trajectoryCurveTargets(
  model: Pick<LabViewModel, "objects" | "paint">,
  state: Pick<TrajectoryUiState, "editingObjectId" | "showAll">,
): TrajectoryCurveTarget[] {
  const painted = model.paint && model.paint.pointsM.length >= 2 ? model.paint.objectId : null;
  const targets = model.objects
    .filter(
      (object) =>
        object.trajectory &&
        object.id !== model.paint?.objectId &&
        (state.showAll || object.id === state.editingObjectId),
    )
    .map((object) => ({ objectId: object.id, live: false }));
  return painted === null ? targets : [{ objectId: painted, live: true }, ...targets];
}

/** One curve's line, reusing its buffers as the stroke grows or a point is dragged. */
class TrajectoryLine {
  readonly line = new Line<BufferGeometry, LineBasicMaterial>(
    new BufferGeometry(),
    new LineBasicMaterial({ transparent: true }),
  );
  private capacity = 0;
  private dashed: boolean | null = null;

  update(points: readonly Vector3[], dashed: boolean) {
    if (points.length > this.capacity) {
      const capacity = Math.max(2, points.length, this.capacity * 2);
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage),
      );
      const old = this.line.geometry;
      this.line.geometry = geometry;
      old.dispose();
      this.capacity = capacity;
    }
    const position = this.line.geometry.getAttribute("position") as BufferAttribute;
    // Spare slots repeat the last point so they cannot widen the bounds.
    for (let index = 0; index < this.capacity; index++) {
      const point = points[Math.min(index, points.length - 1)] ?? [0, 0, 0];
      position.setXYZ(index, point[0], point[1], point[2]);
    }
    position.needsUpdate = true;
    this.line.geometry.setDrawRange(0, points.length);
    this.line.geometry.computeBoundingSphere();
    if (dashed !== this.dashed) {
      const old = this.line.material;
      this.line.material = dashed
        ? new LineDashedMaterial({ transparent: true, ...DASH })
        : new LineBasicMaterial({ transparent: true });
      old.dispose();
      this.line.material.color.set(dashed ? colors.warning.$value : colors.textPrimary.$value);
      this.line.material.opacity = dashed ? 0.8 : 0.9;
      this.dashed = dashed;
    }
    if (dashed) this.line.computeLineDistances();
  }

  dispose() {
    this.line.geometry.dispose();
    this.line.material.dispose();
  }
}

function Curve({
  id,
  points,
  dashed,
  registry,
}: {
  id: string;
  points: readonly Vector3[];
  dashed: boolean;
  registry?: Map<string, TrajectoryLine>;
}) {
  const group = useRef<Group>(null);
  const resource = useRef<TrajectoryLine | null>(null);
  const latest = useRef({ points, dashed });
  latest.current = { points, dashed };
  useLayoutEffect(() => {
    // Acquire on commit only, as the solver path lines do, so nothing leaks from a discarded render.
    const mounted = new TrajectoryLine();
    const node = group.current!;
    mounted.update(latest.current.points, latest.current.dashed);
    node.add(mounted.line);
    resource.current = mounted;
    registry?.set(id, mounted);
    return () => {
      if (registry?.get(id) === mounted) registry.delete(id);
      node.remove(mounted.line);
      mounted.dispose();
      resource.current = null;
    };
  }, [id, registry]);
  useLayoutEffect(() => {
    resource.current?.update(points, dashed);
  }, [points, dashed]);
  return <group ref={group} />;
}

function StoredCurve({
  object,
  dashed,
  registry,
}: {
  object: ObjectView;
  dashed: boolean;
  registry: Map<string, TrajectoryLine>;
}) {
  const points = useMemo(
    () =>
      object.trajectory ? curvePoints(controlPoints(object.positionM, object.trajectory)) : [],
    [object.positionM, object.trajectory],
  );
  return <Curve id={object.id} points={points} dashed={dashed} registry={registry} />;
}

/** Translate-only gizmo on the selected handle; one `onCommit` per drag, on mouseUp. */
function PointGizmo({
  target,
  worldM,
  onPreview,
  onCommit,
  bridge,
  registerControlsCleanup,
}: {
  target: Mesh;
  worldM: Vector3;
  onPreview: (worldM: Vector3 | null) => void;
  onCommit: (worldM: Vector3) => void | Promise<unknown>;
  bridge: GizmoBridge | undefined;
  registerControlsCleanup: ControlsCleanup | undefined;
}) {
  const { camera, gl, scene } = useThree();
  const latest = useRef({ worldM, onPreview, onCommit });
  latest.current = { worldM, onPreview, onCommit };
  useLayoutEffect(() => {
    const controls = new TransformControls(camera, gl.domElement);
    controls.setMode("translate");
    controls.setSize(GIZMO_SIZE);
    controls.attach(target);
    // A gesture may not open while another commit is pending or the camera owns the pointer.
    const idle = () => !bridge || (bridge.pending.size === 0 && bridge.observerPointerId === null);
    controls.enabled = idle();
    if (bridge) bridge.controls = controls;
    const helper = controls.getHelper();
    scene.add(helper);

    let start: Vector3 | null = null;
    let gesture: symbol | null = null;
    let dragging = false;
    let cancelled = false;
    let disposed = false;
    const setOrbit = (enabled: boolean) => {
      if (bridge?.orbit) bridge.orbit.enabled = enabled;
    };
    const release = (token: symbol) => {
      if (!bridge || bridge.owner !== token) return;
      bridge.owner = null;
      if (bridge.dragging === DRAG_ID) bridge.dragging = null;
    };
    /** Back to the point the model holds, curve included. */
    const restore = () => {
      target.position.fromArray(latest.current.worldM);
      latest.current.onPreview(null);
    };

    const onMouseDown = () => {
      start = target.position.toArray();
      cancelled = false;
      gesture = Symbol("trajectory-point-gesture");
      if (bridge) {
        bridge.owner = gesture;
        bridge.dragging = DRAG_ID;
      }
    };
    // The curve follows the handle imperatively; React state is not set per drag frame.
    const onObjectChange = () => {
      if (start && !cancelled) latest.current.onPreview(target.position.toArray());
    };
    const onDraggingChanged = (event: { value?: unknown }) => {
      const value = event.value === true;
      setOrbit(!value);
      if (value) {
        dragging = true;
        return;
      }
      dragging = false;
      if (bridge) bridge.suppressUntil = performance.now() + 300;
      if (cancelled) cancelled = false;
      else if (gesture) {
        // Pointer cancelled without a mouseUp: drop the preview.
        restore();
        release(gesture);
        gesture = null;
        start = null;
      }
    };
    const onMouseUp = () => {
      if (cancelled || !start) return;
      const from = start;
      const token = gesture;
      const end = target.position.toArray();
      start = null;
      gesture = null;
      const moved =
        end.every(Number.isFinite) &&
        end.some((value, axis) => Math.abs(value - from[axis]!) > 1e-6);
      if (!moved) {
        restore();
        if (token) release(token);
        return;
      }
      if (token && bridge) bridge.pending.add(token);
      controls.enabled = false;
      // Exactly one setTrajectory for the whole drag: one scene revision, one Undo step.
      void (async () => {
        try {
          await latest.current.onCommit(end);
        } catch {
          // Refused by the runtime: the restore below snaps back.
        } finally {
          if (token && bridge) bridge.pending.delete(token);
          if (token) release(token);
          if (!disposed) {
            restore();
            controls.enabled = idle();
          }
        }
      })();
    };
    // Escape, pointercancel, lost capture and blur abandon the drag without committing.
    const cancelGesture = () => {
      if (disposed || !dragging || cancelled) return;
      cancelled = true;
      controls.reset();
      restore();
      start = null;
      if (gesture) release(gesture);
      gesture = null;
      controls.pointerUp(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dragging || cancelled) return;
      // Esc cancels the drag only; it must not also close the editor.
      event.stopPropagation();
      cancelGesture();
    };
    const onLostCapture = () => queueMicrotask(cancelGesture);

    controls.addEventListener("mouseDown", onMouseDown);
    controls.addEventListener("mouseUp", onMouseUp);
    controls.addEventListener("objectChange", onObjectChange);
    controls.addEventListener("dragging-changed", onDraggingChanged as never);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", cancelGesture);
    gl.domElement.addEventListener("pointercancel", cancelGesture);
    gl.domElement.addEventListener("lostpointercapture", onLostCapture);

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", cancelGesture);
      gl.domElement.removeEventListener("pointercancel", cancelGesture);
      gl.domElement.removeEventListener("lostpointercapture", onLostCapture);
      controls.removeEventListener("mouseDown", onMouseDown);
      controls.removeEventListener("mouseUp", onMouseUp);
      controls.removeEventListener("objectChange", onObjectChange);
      controls.removeEventListener("dragging-changed", onDraggingChanged as never);
      if (gesture) {
        restore();
        release(gesture);
      }
      if (dragging) setOrbit(true);
      gesture = null;
      start = null;
      if (bridge?.controls === controls) bridge.controls = null;
      controls.detach();
      scene.remove(helper);
      controls.dispose();
    };
    const unregister = registerControlsCleanup?.(dispose);
    return () => {
      dispose();
      unregister?.();
    };
  }, [target, camera, gl, scene, bridge, registerControlsCleanup]);
  return null;
}

function PointHandles({
  object,
  selectedIndex,
  disabled,
  onSelectPoint,
  onMovePoint,
  onPreview,
  bridge,
  registerControlsCleanup,
}: {
  object: ObjectView;
  selectedIndex: number | null;
  disabled: boolean;
  onSelectPoint: (index: number) => void;
  onMovePoint: (index: number, worldM: Vector3) => void | Promise<unknown>;
  onPreview: (index: number, worldM: Vector3 | null) => void;
  bridge: GizmoBridge | undefined;
  registerControlsCleanup: ControlsCleanup | undefined;
}) {
  const [target, setTarget] = useState<Mesh | null>(null);
  const world = (object.trajectory?.offsetsM ?? []).map((offset) => add(object.positionM, offset));
  const selected = selectedIndex !== null && selectedIndex < world.length ? selectedIndex : null;
  const select = (index: number) => (event: ThreeEvent<MouseEvent>) => {
    // A handle click never falls through to the surface behind it, which would add a point.
    event.stopPropagation();
    if (disabled || (bridge && gizmoSuppressesSelection(bridge))) return;
    onSelectPoint(index);
  };
  return (
    <>
      {world.map((point, index) => (
        <mesh
          key={index}
          position={point}
          ref={index === selected ? setTarget : null}
          onClick={select(index)}
        >
          <sphereGeometry args={[HANDLE_RADIUS_M, 10, 8]} />
          <meshBasicMaterial
            color={index === selected ? colors.accent.$value : colors.textPrimary.$value}
          />
        </mesh>
      ))}
      {!disabled && selected !== null && target && (
        <PointGizmo
          target={target}
          worldM={world[selected]!}
          onPreview={(worldM) => onPreview(selected, worldM)}
          onCommit={(worldM) => onMovePoint(selected, worldM)}
          bridge={bridge}
          registerControlsCleanup={registerControlsCleanup}
        />
      )}
    </>
  );
}

export function TrajectoryCurves({
  model,
  state,
  onSelectPoint,
  onMovePoint,
  bridge,
  registerControlsCleanup,
}: {
  model: LabViewModel;
  state: TrajectoryUiState;
  onSelectPoint(index: number): void;
  onMovePoint(index: number, worldM: Vector3): void | Promise<unknown>;
  bridge?: GizmoBridge;
  registerControlsCleanup?: ControlsCleanup;
}) {
  const registry = useRef(new Map<string, TrajectoryLine>()).current;
  const targets = trajectoryCurveTargets(model, state);
  const edited =
    model.interactionMode === "editor" && !model.paint
      ? model.objects.find((object) => object.id === state.editingObjectId && object.trajectory)
      : undefined;
  const invalid = (object: ObjectView) => model.trajectoryStatus[object.id]?.valid === false;
  const latestEdited = useRef(edited);
  latestEdited.current = edited;
  const preview = (index: number, worldM: Vector3 | null) => {
    const object = latestEdited.current;
    const line = object && registry.get(object.id);
    if (!object?.trajectory || !line) return;
    const trajectory = worldM ? movePoint(object, index, worldM) : object.trajectory;
    line.update(curvePoints(controlPoints(object.positionM, trajectory)), invalid(object));
  };
  return (
    <>
      {targets.map((target) => {
        if (target.live && model.paint)
          return (
            <Curve
              key={`paint:${target.objectId}`}
              id={`paint:${target.objectId}`}
              points={model.paint.pointsM}
              dashed={false}
            />
          );
        const object = model.objects.find((entry) => entry.id === target.objectId);
        return (
          object && (
            <StoredCurve
              key={object.id}
              object={object}
              dashed={invalid(object)}
              registry={registry}
            />
          )
        );
      })}
      {edited && (
        <PointHandles
          key={edited.id}
          object={edited}
          selectedIndex={state.selectedPointIndex}
          disabled={!trajectoryEditable(model)}
          onSelectPoint={onSelectPoint}
          onMovePoint={onMovePoint}
          onPreview={preview}
          bridge={bridge}
          registerControlsCleanup={registerControlsCleanup}
        />
      )}
    </>
  );
}
