import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import type {
  LabController,
  LabViewModel,
  ObjectView,
  PathView,
  PlacementGhostView,
} from "../contracts.js";
import { canonicalTokens } from "../tokens.js";

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
    ghost.stage === "staged"
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
}: {
  object: ObjectView;
  controller: LabController;
  selected: boolean;
  emitter: boolean;
  editor: boolean;
}) {
  const group = useRef<Group>(null);
  const [x, y, z] = object.dimensionsM;
  const geometry = useMemo(() => geometryFor(object), [object.shape, x, y, z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
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
    void controller.dispatch({ type: "selectObject", objectId: object.id });
  };
  return (
    <group ref={group} position={object.positionM} quaternion={object.orientationQuaternion}>
      <mesh onClick={select} castShadow receiveShadow>
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
}: {
  path: PathView;
  controller: LabController;
  selected: boolean;
}) {
  const line = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints(
      path.points.map((point) => new Vector3(...point)),
    );
    const color = path.stale
      ? colors.warning.$value
      : path.kind === "direct"
        ? colors.success.$value
        : path.kind === "blocked"
          ? colors.danger.$value
          : path.kind === "transmission"
            ? colors.textSecondary.$value
            : colors.accent.$value;
    const material =
      path.kind === "blocked" || path.kind === "transmission"
        ? new LineDashedMaterial({
            color,
            dashSize: 0.1,
            gapSize: 0.07,
            transparent: true,
            opacity: path.stale ? 0.5 : 0.8,
          })
        : new LineBasicMaterial({ color, transparent: true, opacity: path.stale ? 0.5 : 0.9 });
    const result = new Line(geometry, material);
    result.computeLineDistances();
    return result;
  }, [path]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    },
    [line],
  );
  return (
    <group>
      <primitive
        object={line}
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
}: {
  controller: LabController;
  model: LabViewModel;
  showBlocked: boolean;
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
