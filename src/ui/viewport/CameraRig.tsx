import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MOUSE, Quaternion, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { LabController, LabViewModel, Workspace } from "../contracts.js";

interface SavedView {
  position: Vector3;
  quaternion: Quaternion;
  target: Vector3;
}

export function CameraRig({
  controller,
  model,
  frameRequest,
  registerControlsCleanup,
}: {
  controller: LabController;
  model: LabViewModel;
  frameRequest: number;
  registerControlsCleanup: (dispose: () => void) => () => void;
}) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const mode = useRef(model.interactionMode);
  const workspace = useRef(model.workspace);
  const views = useRef(new Map<Workspace, SavedView>());
  const defaultView = useRef<SavedView | null>(null);
  const wasFPS = useRef(false);
  const lastFrameRequest = useRef(0);
  mode.current = model.interactionMode;

  useLayoutEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    controls.current = orbit;
    orbit.target.set(0, 1, 0);
    orbit.enableDamping = false;
    orbit.minDistance = 0.5;
    orbit.maxDistance = 120;
    orbit.mouseButtons = { LEFT: null, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
    orbit.update();
    defaultView.current = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      target: orbit.target.clone(),
    };
    const alt = (event: KeyboardEvent) => {
      orbit.mouseButtons.LEFT = event.altKey ? MOUSE.ROTATE : null;
    };
    const resetAlt = () => {
      orbit.mouseButtons.LEFT = null;
    };
    const preserveZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", alt);
    window.addEventListener("keyup", alt);
    window.addEventListener("blur", resetAlt);
    gl.domElement.addEventListener("wheel", preserveZoom, { capture: true, passive: true });
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("keydown", alt);
      window.removeEventListener("keyup", alt);
      window.removeEventListener("blur", resetAlt);
      gl.domElement.removeEventListener("wheel", preserveZoom, { capture: true });
      orbit.dispose();
      if (controls.current === orbit) controls.current = null;
    };
    const unregister = registerControlsCleanup(dispose);
    return () => {
      dispose();
      unregister();
    };
  }, [camera, gl, registerControlsCleanup]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const fps = model.interactionMode !== "editor";
    const save = (key: Workspace) =>
      views.current.set(key, {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        target: orbit.target.clone(),
      });
    if (!wasFPS.current && (fps || workspace.current !== model.workspace)) save(workspace.current);
    if (!fps && (wasFPS.current || workspace.current !== model.workspace)) {
      const saved = views.current.get(model.workspace) ?? defaultView.current;
      if (saved) {
        camera.position.copy(saved.position);
        camera.quaternion.copy(saved.quaternion);
        orbit.target.copy(saved.target);
      }
    }
    orbit.enabled = !fps;
    workspace.current = model.workspace;
    wasFPS.current = fps;
  }, [camera, model.workspace, model.interactionMode]);

  useEffect(() => {
    if (!frameRequest || lastFrameRequest.current === frameRequest) return;
    lastFrameRequest.current = frameRequest;
    if (model.interactionMode !== "editor" || !model.selectedObjectId) return;
    const object = model.objects.find((entry) => entry.id === model.selectedObjectId);
    const orbit = controls.current;
    if (!object || !orbit) return;
    const pose = controller.getPose(object.id) ?? object;
    const target = new Vector3(...pose.positionM);
    const distance = Math.max(2.5, Math.max(...object.dimensionsM) * 2.3);
    camera.position.copy(target).add(new Vector3(1, 0.7, 1).normalize().multiplyScalar(distance));
    orbit.target.copy(target);
    orbit.update();
  }, [
    camera,
    controller,
    frameRequest,
    model.interactionMode,
    model.objects,
    model.selectedObjectId,
  ]);

  useFrame(() => {
    if (mode.current !== "editor") {
      const pose = controller.getFPSCamera?.();
      if (pose) {
        camera.position.fromArray(pose.positionM);
        camera.quaternion.fromArray(pose.orientationQuaternion);
      }
    } else controls.current?.update();
  });
  return null;
}
