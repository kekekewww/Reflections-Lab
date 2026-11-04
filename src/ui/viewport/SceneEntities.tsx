import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, CapsuleGeometry, Group, SphereGeometry } from "three";
import type {
  LabController,
  LabViewModel,
  ObjectView,
  PathView,
  PlacementGhostView,
  Vector3,
} from "../contracts.js";
import { canonicalTokens } from "../tokens.js";
import { SolverPathLine } from "./solver-path-line.js";
import { gizmoSuppressesSelection, updateGizmoGroup, type GizmoBridge } from "./TransformGizmo.js";

const colors = canonicalTokens.color;

function geometryFor(object: Pick<ObjectView, "shape" | "dimensionsM">) {
  const [x, y, z] = object.dimensionsM;
  if (object.shape === "sphere") return new SphereGeometry(x / 2, 28, 20).scale(1, y / x, z / x);
  if (object.shape === "capsule") {
    const radius = Math.min(x, z) / 2;
    return new CapsuleGeometry(radius, Math.max(0.001, y - radius * 2), 6, 16);
  }
  return new BoxGeometry(x, y, z);
}

function PlacementGhost({ ghost }: { ghost: PlacementGhostView }) {
  const [x, y, z] = ghost.dimensionsM;
  const geometry = useMemo(() => geometryFor(ghost), [ghost.shape, x, y, z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const color =
    ghost.stage === "pending"
      ? colors.warning.$value
      : ghost.valid
        ? colors.success.$value
        : colors.danger.$value;
  return (
    <group position={ghost.positionM} quaternion={ghost.orientationQuaternion}>
      <mesh renderOrder={3}>
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial color={color} transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <mesh renderOrder={4}>
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PhysicalObject({
  object,
  controller,
  selected,
  emitter,
  editor,
  bridge,
  pathEditing,
  onSurfacePoint,
}: {
  object: ObjectView;
  controller: LabController;
  selected: boolean;
  emitter: boolean;
  editor: boolean;
  bridge: GizmoBridge;
  /** While a trajectory editor is open a click adds a point instead of selecting. */
  pathEditing: boolean;
  onSurfacePoint: ((pointM: Vector3, normalM: Vector3) => void) | undefined;
}) {
  const group = useRef<Group>(null);
  const gl = useThree((state) => state.gl);
  const setGroup = useCallback(
    (node: Group | null) => {
      updateGizmoGroup(bridge, object.id, group.current, node);
      group.current = node;
    },
    [bridge, object.id],
  );
  const hovered = useRef(false);
  const clearHover = () => {
    if (!hovered.current) return;
    hovered.current = false;
    gl.domElement.style.cursor = "";
  };
  useEffect(() => {
    if (!editor) clearHover();
    return clearHover;
  }, [editor, gl]);
  const [x, y, z] = object.dimensionsM;
  const geometry = useMemo(() => geometryFor(object), [object.shape, x, y, z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (bridge.dragging === object.id) return;
    const pose = controller.getPose(object.id) ?? object;
    group.current?.position.fromArray(pose.positionM);
    group.current?.quaternion.fromArray(pose.orientationQuaternion);
  });
  const color =
    object.mode === "dynamicNoGravity"
      ? colors.warning.$value
      : object.mode === "dynamicGravity"
        ? colors.accent.$value
        : object.mode === "kinematic"
          ? colors.success.$value
          : colors.textMuted.$value;
  const select = (event: ThreeEvent<MouseEvent>) => {
    if (!editor || event.altKey) return;
    event.stopPropagation();
    if (gizmoSuppressesSelection(bridge)) return;
    if (pathEditing) {
      // The face normal is in the mesh's local frame; the offset needs it in world space.
      if (event.face && onSurfacePoint)
        onSurfacePoint(
          event.point.toArray(),
          event.face.normal.clone().transformDirection(event.object.matrixWorld).toArray(),
        );
      return;
    }
    void controller.dispatch({ type: "selectObject", objectId: object.id });
  };
  return (
    <group ref={setGroup} position={object.positionM} quaternion={object.orientationQuaternion}>
      <mesh
        onClick={select}
        onPointerOver={(event) => {
          if (!editor || bridge.dragging) return;
          event.stopPropagation();
          hovered.current = true;
          gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={clearHover}
        castShadow
        receiveShadow
      >
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial
          color={color}
          roughness={0.65}
          metalness={object.mode === "fixed" ? 0.04 : 0.18}
        />
      </mesh>
      {selected && (
        <mesh scale={1.015} renderOrder={2}>
          <primitive object={geometry} attach="geometry" />
          <meshBasicMaterial
            wireframe
            color={colors.accent.$value}
            depthTest={false}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
      {emitter && (
        <mesh position={[0, y / 2 + 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.018, 6, 24]} />
          <meshBasicMaterial color={colors.success.$value} />
        </mesh>
      )}
    </group>
  );
}

function SolverPath({
  path,
  controller,
  selected,
  pickable,
}: {
  path: PathView;
  controller: LabController;
  selected: boolean;
  /** False while a trajectory editor is open, so its surface clicks are not taken by the line. */
  pickable: boolean;
}) {
  const lineGroup = useRef<Group>(null);
  const resource = useRef<SolverPathLine | null>(null);
  useLayoutEffect(() => {
    // Acquire only on commit, so abandoned renders and StrictMode effect replay
    // cannot leak a line or reuse resources already released by cleanup.
    const mounted = new SolverPathLine();
    const group = lineGroup.current!;
    resource.current = mounted;
    group.add(mounted.line);
    return () => {
      group.remove(mounted.line);
      mounted.dispose();
      resource.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    resource.current?.update(path);
    resource.current?.setPickable(pickable);
  });
  return (
    <group>
      <group
        ref={lineGroup}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          void controller.dispatch({ type: "selectPath", pathId: path.id });
        }}
      />
      {selected &&
        path.points.map((point, index) => (
          <mesh key={`${path.id}:${index}`} position={point}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshBasicMaterial color={colors.accent.$value} />
          </mesh>
        ))}
      {path.kind === "reflection" &&
        path.points.slice(1, -1).map((point, index) => (
          <mesh key={`${path.id}:reflection:${index}`} position={point}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshBasicMaterial color={colors.accent.$value} />
          </mesh>
        ))}
    </group>
  );
}

export function SceneEntities({
  controller,
  model,
  showBlocked,
  bridge,
  pathEditingId = null,
  onSurfacePoint,
}: {
  controller: LabController;
  model: LabViewModel;
  showBlocked: boolean;
  bridge: GizmoBridge;
  /** The object whose trajectory editor is open; clicking it adds no point. */
  pathEditingId?: string | null;
  onSurfacePoint?: (pointM: Vector3, normalM: Vector3) => void;
}) {
  const emitters = useMemo(
    () =>
      new Set(
        model.behaviors
          .filter((profile) => profile.rules.some((rule) => rule.enabled))
          .map((profile) => profile.objectId),
      ),
    [model.behaviors],
  );
  const event = model.events.find((entry) => entry.id === model.selectedEventId);
  const paths = model.paths
    .filter((path) => path.points.length >= 2 && (showBlocked || path.kind !== "blocked"))
    .slice(0, 64);
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[6, 12, 6]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <gridHelper
        args={[40, 40, colors.borderControl.$value, colors.borderSubtle.$value]}
        position={[0, 0.005, 0]}
      />
      {model.objects.map((object) => (
        <PhysicalObject
          key={object.id}
          object={object}
          controller={controller}
          selected={model.selectedObjectId === object.id}
          emitter={emitters.has(object.id)}
          editor={model.interactionMode === "editor"}
          bridge={bridge}
          pathEditing={pathEditingId !== null}
          onSurfacePoint={object.id === pathEditingId ? undefined : onSurfacePoint}
        />
      ))}
      {model.placementGhost && <PlacementGhost ghost={model.placementGhost} />}
      <group
        visible={model.interactionMode === "editor" || model.listener.attachment !== "fpsHead"}
        position={model.listener.positionM}
        quaternion={model.listener.orientationQuaternion}
      >
        <mesh>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshStandardMaterial color={colors.success.$value} />
        </mesh>
        <mesh position={[0, 0, -0.23]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.09, 0.2, 12]} />
          <meshStandardMaterial color={colors.success.$value} />
        </mesh>
      </group>
      {paths.map((path) => (
        <SolverPath
          key={path.id}
          path={path}
          controller={controller}
          selected={model.selectedPathId === path.id}
          pickable={pathEditingId === null}
        />
      ))}
      {event?.positionM && (
        <mesh position={event.positionM}>
          <octahedronGeometry args={[0.12]} />
          <meshBasicMaterial color={colors.warning.$value} wireframe depthTest={false} />
        </mesh>
      )}
    </>
  );
}
