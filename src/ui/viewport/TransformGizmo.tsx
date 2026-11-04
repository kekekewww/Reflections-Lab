import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Group } from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { LabController, LabViewModel } from "../contracts.js";
import { gizmoDragPatch, type GizmoMode, type GizmoStart } from "./gizmo-commit.js";

/** Short-lived shared state between the gizmo, object meshes, rig and viewport. */
export interface GizmoBridge {
  groups: Map<string, Group>;
  /** Synchronous ref retirement: the attached helper must leave before its group. */
  retireGroup: ((group: Group) => void) | null;
  /** Object id whose preview must not be overwritten by the per-frame pose copy. */
  dragging: string | null;
  /** Observer camera owns this pointer until release, excluding transform acquisition. */
  observerPointerId: number | null;
  /** Clicks right after a gizmo gesture must not change selection. */
  suppressUntil: number;
  orbit: { enabled: boolean } | null;
  /** Commits in flight. Outlives the gizmo component, so a remount cannot start a second drag. */
  pending: Set<symbol>;
  /** Gesture token that owns `dragging` and the group preview. */
  owner: symbol | null;
  /** The live, non-disposed controls; re-enabled when the last pending commit settles. */
  controls: { enabled: boolean } | null;
}

export const createGizmoBridge = (): GizmoBridge => ({
  groups: new Map(),
  retireGroup: null,
  dragging: null,
  observerPointerId: null,
  suppressUntil: 0,
  orbit: null,
  pending: new Set(),
  owner: null,
  controls: null,
});

/** R3F refs retire synchronously; passive effects can run after another render. */
export function updateGizmoGroup(
  bridge: GizmoBridge,
  objectId: string,
  previous: Group | null,
  next: Group | null,
): void {
  if (previous && previous !== next) {
    bridge.retireGroup?.(previous);
    if (bridge.groups.get(objectId) === previous) bridge.groups.delete(objectId);
  }
  if (next) bridge.groups.set(objectId, next);
}
/** Selection is ignored during a gesture, while its commit is pending, and briefly after. */
export const gizmoSuppressesSelection = (bridge: GizmoBridge) =>
  performance.now() < bridge.suppressUntil ||
  bridge.pending.size > 0 ||
  bridge.observerPointerId !== null ||
  bridge.owner !== null ||
  bridge.dragging !== null;

/** Dynamic transforms are only hard-edited while not running or replaying. */
export const gizmoEditable = (model: LabViewModel) =>
  model.interactionMode === "editor" &&
  (model.simulationState === "ready" || model.simulationState === "paused") &&
  model.recording.state !== "replaying";

export function TransformGizmo({
  controller,
  model,
  mode,
  bridge,
  registerControlsCleanup,
  suspended = false,
}: {
  controller: LabController;
  model: LabViewModel;
  mode: GizmoMode;
  bridge: GizmoBridge;
  registerControlsCleanup: (dispose: () => void) => () => void;
  /** The trajectory editor owns the pointer: its point handle has its own gizmo. */
  suspended?: boolean;
}) {
  const { camera, gl, scene } = useThree();
  const modelRef = useRef(model);
  modelRef.current = model;
  const objectId = model.selectedObjectId;
  const exists = objectId !== null && model.objects.some((object) => object.id === objectId);
  const active = exists && gizmoEditable(model) && !suspended;

  useLayoutEffect(() => {
    if (!active || !objectId) return;
    const group = bridge.groups.get(objectId);
    if (!group) return;
    const controls = new TransformControls(camera, gl.domElement);
    controls.setMode(mode);
    controls.setSize(0.8);
    controls.attach(group);
    // A replacement instance must not open a drag while a commit is pending.
    controls.enabled = bridge.pending.size === 0 && bridge.observerPointerId === null;
    bridge.controls = controls;
    const helper = controls.getHelper();
    scene.add(helper);

    let start: GizmoStart | null = null;
    let dragging = false;
    let cancelled = false;
    /** Token of this instance's live, not yet committed gesture. */
    let gesture: symbol | null = null;
    let disposed = false;

    const restoreVisual = () => {
      const pose = controller.getPose(objectId);
      const object = modelRef.current.objects.find((entry) => entry.id === objectId);
      const source = pose ?? object;
      if (source) {
        group.position.fromArray(source.positionM);
        group.quaternion.fromArray(source.orientationQuaternion);
      }
      group.scale.set(1, 1, 1);
    };
    const restoreStart = () => {
      if (!start) return;
      group.position.fromArray(start.positionM);
      group.quaternion.fromArray(start.orientationQuaternion);
      group.scale.set(1, 1, 1);
    };
    /** Give up ownership of the preview, but only if `token` still holds it. */
    const release = (token: symbol) => {
      if (bridge.owner !== token) return;
      bridge.owner = null;
      if (bridge.dragging === objectId) bridge.dragging = null;
    };
    const setOrbit = (enabled: boolean) => {
      if (bridge.orbit)
        bridge.orbit.enabled = enabled && modelRef.current.interactionMode === "editor";
    };

    const onMouseDown = () => {
      const object = modelRef.current.objects.find((entry) => entry.id === objectId);
      if (!object) return;
      start = {
        shape: object.shape,
        positionM: group.position.toArray(),
        orientationQuaternion: group.quaternion.toArray() as [number, number, number, number],
        dimensionsM: object.dimensionsM,
      };
      cancelled = false;
      gesture = Symbol("gizmo-gesture");
      bridge.owner = gesture;
      bridge.dragging = objectId;
    };
    const onDraggingChanged = (event: { value?: unknown }) => {
      const value = event.value === true;
      setOrbit(!value);
      if (value) {
        dragging = true;
        return;
      }
      dragging = false;
      bridge.suppressUntil = performance.now() + 300;
      if (cancelled) {
        // The cancelled gesture has ended; nothing was committed.
        cancelled = false;
      } else if (gesture && bridge.owner === gesture) {
        // Pointer cancelled without a mouseUp: drop the preview.
        restoreStart();
        release(gesture);
        gesture = null;
      }
    };
    const onMouseUp = () => {
      if (cancelled || !start) return;
      const snapshot = start;
      const token = gesture;
      const patch = gizmoDragPatch(mode, snapshot, {
        positionM: group.position.toArray(),
        orientationQuaternion: group.quaternion.toArray() as [number, number, number, number],
        scale: group.scale.toArray(),
      });
      start = null;
      gesture = null;
      if (!patch) {
        restoreVisual();
        if (token) release(token);
        return;
      }
      // No new gesture may start, on this or a replacement controls instance,
      // until this one's single commit settles. Its settle below only touches
      // state while it still owns the preview.
      if (token) bridge.pending.add(token);
      controls.enabled = false;
      // Exactly one command for the whole drag: one scene revision, one undo step.
      void (async () => {
        try {
          await controller.dispatch({ type: "patchObject", objectId, patch });
        } catch {
          // Rejected by runtime validation: fall through and snap back.
        } finally {
          if (token) bridge.pending.delete(token);
          if (token && bridge.owner === token) {
            group.scale.set(1, 1, 1);
            release(token);
          }
          if (bridge.pending.size === 0 && bridge.controls && bridge.observerPointerId === null)
            bridge.controls.enabled = true;
          // If the model did not change, the next frame copies the authoritative pose.
        }
      })();
    };
    // Escape, pointercancel, lost capture and window blur abandon the gesture:
    // restore the start transform, commit nothing, and end the native drag now,
    // because a cancelled pointer never delivers the pointerup that would.
    const cancelGesture = () => {
      // A cancellation queued before disposal must not touch detached controls.
      if (disposed || !dragging || cancelled) return;
      cancelled = true;
      controls.reset();
      restoreStart();
      start = null;
      if (gesture) release(gesture);
      gesture = null;
      controls.pointerUp(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dragging || cancelled) return;
      event.stopPropagation();
      cancelGesture();
    };
    // A normal release also drops capture; by the next microtask its pointerup
    // has already ended the drag, so only a real loss reaches cancelGesture.
    const onLostCapture = () => queueMicrotask(cancelGesture);

    controls.addEventListener("mouseDown", onMouseDown);
    controls.addEventListener("mouseUp", onMouseUp);
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
      controls.removeEventListener("dragging-changed", onDraggingChanged as never);
      if (gesture) {
        restoreStart();
        release(gesture);
      }
      if (dragging) setOrbit(true);
      dragging = false;
      cancelled = false;
      start = null;
      gesture = null;
      if (bridge.controls === controls) bridge.controls = null;
      if (bridge.retireGroup === retireGroup) bridge.retireGroup = null;
      controls.detach();
      scene.remove(helper);
      controls.dispose();
    };
    const retireGroup = (removed: Group) => {
      if (removed === group) dispose();
    };
    bridge.retireGroup = retireGroup;
    const unregister = registerControlsCleanup(dispose);
    return () => {
      dispose();
      unregister();
    };
  }, [active, objectId, mode, camera, gl, scene, controller, bridge, registerControlsCleanup]);

  return null;
}
