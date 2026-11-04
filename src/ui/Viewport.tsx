import { HelpTip } from "./HelpTip.js";
import { acousticPathPresentation } from "./acoustic-presentation.js";
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import type { LabController, LabViewModel, Vector3 } from "./contracts.js";
import { canonicalTokens } from "./tokens.js";
import { CameraRig } from "./viewport/CameraRig.js";
import { SceneEntities } from "./viewport/SceneEntities.js";
import { ZoneVolumes } from "./viewport/ZoneVolumes.js";
import { useFPSInput } from "./viewport/useFPSInput.js";
import { AccessibleMovement } from "./viewport/AccessibleMovement.js";
import { ContextMonitor } from "./viewport/ContextMonitor.js";
import { useLocale } from "./locale.js";
import {
  TransformGizmo,
  createGizmoBridge,
  gizmoEditable,
  gizmoSuppressesSelection,
} from "./viewport/TransformGizmo.js";
import type { GizmoMode } from "./viewport/gizmo-commit.js";
import { TrajectoryCurves, trajectoryCurveTargets } from "./viewport/TrajectoryCurves.js";
import {
  appendOffset,
  closedTrajectoryUi,
  createTrajectoryEditQueue,
  movePoint,
  reconcileTrajectoryUi,
  surfaceOffset,
  trajectoryEditable,
  type TrajectoryUiState,
} from "./inspector-trajectory.js";

const gizmoModes: readonly { mode: GizmoMode; label: "move" | "rotate" | "scale" }[] = [
  { mode: "translate", label: "move" },
  { mode: "rotate", label: "rotate" },
  { mode: "scale", label: "scale" },
];

class CanvasBoundary extends Component<
  { children: ReactNode; heading: string; detail: string; retry: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="viewport-fallback" role="alert">
          <strong>{this.props.heading}</strong>
          <p>{this.props.detail}</p>
          <button onClick={() => this.setState({ failed: false })}>{this.props.retry}</button>
        </div>
      );
    return this.props.children;
  }
}

/** Serialized path edits for this viewport; a refusal shows as a viewport notice. */
function useTrajectoryEdits(controller: LabController, editingObjectId: string | null) {
  const [error, setError] = useState("");
  useEffect(() => setError(""), [editingObjectId]);
  const commit = useMemo(() => {
    const queue = createTrajectoryEditQueue(controller, setError);
    return (...edit: Parameters<typeof queue>) =>
      queue(...edit).then((committed) => {
        if (committed) setError("");
        return committed;
      });
  }, [controller]);
  return { commit, error };
}

function CanvasControlsLifetime({
  children,
  onAttach,
  onDetach,
}: {
  children: ReactNode;
  onAttach: () => void;
  onDetach: () => void;
}) {
  useLayoutEffect(() => {
    onAttach();
    return onDetach;
  }, [onAttach, onDetach]);
  return <>{children}</>;
}

export function Viewport({
  controller,
  model,
  trajectory = closedTrajectoryUi,
  onTrajectoryChange,
}: {
  controller: LabController;
  model: LabViewModel;
  trajectory?: TrajectoryUiState;
  onTrajectoryChange?: (update: (current: TrajectoryUiState) => TrajectoryUiState) => void;
}) {
  const { locale, t, n, message } = useLocale();
  const input = useFPSInput(controller, model);
  const canvasAria = t("viewport.canvas.aria");
  useEffect(() => {
    // Locale is presentation state: update the existing DOM node without
    // recreating R3F, controls, input listeners, or the actual pointer lock.
    input.canvas.current?.setAttribute("aria-label", canvasAria);
  }, [locale, canvasAria, input.canvas]);
  const [frameRequest, setFrameRequest] = useState(0);
  const [showBlocked, setShowBlocked] = useState(false);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const gizmoBridge = useRef(createGizmoBridge()).current;
  const [graphicsError, setGraphicsError] = useState<string | null>(null);
  // Entry needs R3F's actual canvas; a click before onCreated could only fail.
  const [canvasReady, setCanvasReady] = useState(false);
  const controlsCleanup = useRef(new Set<() => void>());
  const controlsClosed = useRef(false);
  const activateControls = useCallback(() => {
    controlsClosed.current = false;
  }, []);
  const disposeControls = useCallback(() => {
    controlsClosed.current = true;
    const disposers = [...controlsCleanup.current];
    controlsCleanup.current.clear();
    for (const dispose of disposers) dispose();
  }, []);
  const registerControlsCleanup = useCallback((dispose: () => void) => {
    if (controlsClosed.current) {
      dispose();
      return () => {};
    }
    controlsCleanup.current.add(dispose);
    return () => {
      controlsCleanup.current.delete(dispose);
    };
  }, []);
  // R3F owns a separate reconciler. Its inner cleanup can run after ReactDOM
  // removes the canvas, so dispose controls from this outer tree first.
  useLayoutEffect(() => disposeControls, [disposeControls]);
  const fps = model.interactionMode !== "editor";
  const selected = model.objects.find((object) => object.id === model.selectedObjectId);
  const held = model.objects.find((object) => object.held);
  const visiblePathCount = model.paths.filter(
    (path) => showBlocked || path.kind !== "blocked",
  ).length;
  const running = model.simulationState === "running";
  const presentation = acousticPathPresentation(model);
  const evidenceAttention = presentation !== "ready";
  const evidenceTag = (
    <span className="evidence-tag">{t(`viewport.acoustic.${presentation}`)}</span>
  );
  const gizmoLocked = !!selected && !fps && !gizmoEditable(model);
  const pathUi = reconcileTrajectoryUi(model, trajectory);
  const pathObject = model.objects.find((object) => object.id === pathUi.editingObjectId);
  const pathEditable = trajectoryEditable(model);
  const painting = fps ? model.paint : null;
  const editPath = useTrajectoryEdits(controller, pathObject?.id ?? null);
  // One setTrajectory per click; the new point becomes the selected one once it exists.
  const addPathPoint = (pointM: Vector3, normalM: Vector3) => {
    if (!pathObject || !pathEditable) return;
    const objectId = pathObject.id;
    void editPath
      .commit(objectId, (object) => appendOffset(object, surfaceOffset(object, pointM, normalM)))
      .then((committed) => {
        if (committed)
          onTrajectoryChange?.((current) =>
            current.editingObjectId === objectId
              ? { ...current, selectedPointIndex: committed.offsetsM.length - 1 }
              : current,
          );
      });
  };
  const movePathPoint = (index: number, worldM: Vector3) => {
    if (!pathObject || !pathEditable) return;
    return editPath.commit(pathObject.id, (object) =>
      index < (object.trajectory?.offsetsM.length ?? 0) ? movePoint(object, index, worldM) : null,
    );
  };
  const selectPathPoint = (index: number) =>
    onTrajectoryChange?.((current) => ({ ...current, selectedPointIndex: index }));
  return (
    <section
      className={`viewport-panel ${fps ? "viewport-fps" : ""}`}
      aria-label={t("viewport.region")}
    >
      <div className="viewport-toolbar">
        <div className="viewport-title">
          <span className="eyebrow">{t("viewport.eyebrow")}</span>
          <strong>{fps ? t("viewport.mode.interact") : t("viewport.mode.observe")}</strong>
        </div>
        <div className="button-group">
          {!fps && (
            <div
              className="button-group gizmo-modes"
              role="group"
              aria-label={t("viewport.gizmo.aria")}
            >
              {gizmoModes.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={gizmoMode === mode}
                  disabled={!selected}
                  onClick={() => setGizmoMode(mode)}
                >
                  {t(`viewport.gizmo.${label}`)}
                </button>
              ))}
            </div>
          )}
          <HelpTip
            topic={t("viewport.frame.action")}
            content={t("viewport.frame.title") || t("inspector.runningEditGuard")}
          >
            <button
              onClick={() => setFrameRequest((value) => value + 1)}
              disabled={!selected || fps}
            >
              {t("viewport.frame.action")}
            </button>
          </HelpTip>
          {fps ? (
            <button className="critical-button" onClick={input.exit}>
              {t("viewport.exit")}
            </button>
          ) : (
            <button
              className="critical-button"
              disabled={input.entering || !canvasReady}
              onClick={() => void input.enter()}
            >
              {input.entering ? t("viewport.entering") : t("viewport.enter")}
            </button>
          )}
        </div>
      </div>
      <div
        className="viewport-canvas-wrap"
        data-trajectory-curves={trajectoryCurveTargets(model, pathUi).length}
      >
        <CanvasBoundary
          heading={t("viewport.fallback.heading")}
          detail={t("viewport.fallback.detail")}
          retry={t("viewport.fallback.retry")}
        >
          <CanvasControlsLifetime onAttach={activateControls} onDetach={disposeControls}>
            <Canvas
              camera={{ position: [8, 6, 10], fov: 50, near: 0.05, far: 250 }}
              dpr={[1, 1.5]}
              shadows
              gl={{ antialias: true, alpha: false }}
              style={{ background: canonicalTokens.color.canvas.$value }}
              // R3F always renders this inside <canvas>, where Chrome exposes it to
              // assistive technology even while WebGL works. Actual WebGL failures
              // are announced by CanvasBoundary, so keep this visual-only.
              fallback={
                <div className="viewport-fallback" aria-hidden="true">
                  {t("viewport.fallback.webgl")}
                </div>
              }
              onCreated={({ gl, camera }) => {
                input.canvas.current = gl.domElement;
                setCanvasReady(true);
                gl.domElement.tabIndex = 0;
                gl.domElement.setAttribute("aria-label", canvasAria);
                camera.lookAt(0, 1, 0);
              }}
              onPointerMissed={(event) => {
                // A miss while editing a path adds nothing and keeps the editor open.
                if (!fps && !event.altKey && !gizmoSuppressesSelection(gizmoBridge) && !pathObject)
                  void controller.dispatch({ type: "selectObject", objectId: null });
              }}
            >
              <ContextMonitor controller={controller} onError={setGraphicsError} />
              <CameraRig
                controller={controller}
                model={model}
                frameRequest={frameRequest}
                registerControlsCleanup={registerControlsCleanup}
                bridge={gizmoBridge}
              />
              <SceneEntities
                controller={controller}
                model={model}
                showBlocked={showBlocked}
                bridge={gizmoBridge}
                pathEditingId={pathObject?.id ?? null}
                onSurfacePoint={addPathPoint}
              />
              <TrajectoryCurves
                model={model}
                state={pathUi}
                onSelectPoint={selectPathPoint}
                onMovePoint={movePathPoint}
                bridge={gizmoBridge}
                registerControlsCleanup={registerControlsCleanup}
              />
              <ZoneVolumes
                zones={model.zones}
                mode={model.interactionMode}
                replaying={model.recording.state === "replaying"}
              />
              <TransformGizmo
                controller={controller}
                model={model}
                mode={gizmoMode}
                bridge={gizmoBridge}
                registerControlsCleanup={registerControlsCleanup}
                suspended={!!pathObject}
              />
            </Canvas>
          </CanvasControlsLifetime>
        </CanvasBoundary>
        {(fps || model.pauseReason || pathObject) && (
          <div className="viewport-overlay viewport-top-left">
            {fps && (
              <span className={`status-pill ${running ? "status-running" : ""}`}>
                {painting
                  ? t("trajectory.paint.status")
                  : running
                    ? t("viewport.status.running")
                    : model.simulationState === "paused"
                      ? t("viewport.status.paused")
                      : t("viewport.status.ready")}
              </span>
            )}
            {/* The room is frozen while painting; a pause message must not cover the brush. */}
            {model.pauseReason && !painting && (
              <span className="viewport-message">{message(model.pauseReason)}</span>
            )}
            {/* Its own row under the status badges, so a narrow viewport wraps instead of overlapping. */}
            {pathObject && (
              <span className="viewport-path-hint" role="status">
                {t(pathEditable ? "trajectory.hint.editing" : "trajectory.hint.readOnly", {
                  name: pathObject.name ?? pathObject.id,
                })}
              </span>
            )}
          </div>
        )}
        {evidenceAttention && (
          <div className="viewport-overlay viewport-top-right">{evidenceTag}</div>
        )}
        {fps && (
          <div className="viewport-crosshair" aria-hidden="true">
            ＋
          </div>
        )}
        {gizmoLocked && !pathObject && (
          <div className="viewport-overlay gizmo-hint" role="status">
            {t("viewport.gizmo.locked")}
          </div>
        )}
      </div>
      <div className="viewport-bottom">
        {fps && (
          <div className="viewport-fps-hint" aria-live="polite" aria-atomic="true">
            {!input.locked && !model.alternativeInput && (
              <button className="critical-button" onClick={() => void input.enter()}>
                {t("viewport.input.enablePointer")}
              </button>
            )}
            <span>
              {painting
                ? t("trajectory.paint.hint", {
                    distance: n(painting.distanceM, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }),
                  })
                : !input.locked && !model.alternativeInput
                  ? t("viewport.input.unlocked")
                  : !running
                    ? t(
                        model.simulationState === "ready"
                          ? "viewport.input.ready"
                          : "viewport.input.paused",
                      )
                    : held
                      ? t("viewport.hint.holding")
                      : model.placementGhost
                        ? t(
                            model.alternativeInput
                              ? "viewport.hint.sticky"
                              : "viewport.hint.preview",
                          )
                        : t("viewport.hint.idle")}
            </span>
            {model.placementGhost && (
              <span className={model.placementGhost.valid ? "status-success" : "inline-warning"}>
                {t(
                  model.placementGhost.attachment === "surface"
                    ? "viewport.attachment.surface"
                    : "viewport.attachment.air",
                )}
                {" · "}
                {message(model.placementGhost.reason ?? "")}
              </span>
            )}
          </div>
        )}
        <details className="viewport-details">
          <summary>
            {t("viewport.details.summary")}
            <span className="viewport-details-count mono">
              {Math.min(64, visiblePathCount)}/{visiblePathCount}
            </span>
          </summary>
          <div className="viewport-details-content">
            {!evidenceAttention && evidenceTag}
            <span>
              {t("viewport.revisions", {
                sceneRevision: model.sceneRevision,
                acousticRevision:
                  model.acoustic.revision === null ? "—" : "r" + model.acoustic.revision,
              })}
            </span>
            <span className="viewport-axis" aria-label={t("viewport.coordinates.aria")}>
              Y↑ <span>{t("viewport.coordinates.forward")}</span> <small>SI · m</small>
            </span>
            <div className="viewport-legend">
              <span className="legend-direct">{t("viewport.legend.direct")}</span>
              <span className="legend-reflection">{t("viewport.legend.reflection")}</span>
              <span>
                {t("viewport.legend.paths", {
                  shown: Math.min(64, visiblePathCount),
                  total: visiblePathCount,
                })}
              </span>
            </div>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={showBlocked}
                onChange={(event) => setShowBlocked(event.target.checked)}
              />
              {t("viewport.legend.blocked")}
            </label>
          </div>
        </details>
      </div>
      {input.lockError && (
        <p className="inline-warning" role="status">
          {input.lockError}
        </p>
      )}
      {graphicsError && (
        <p className="inline-warning" role="alert">
          {message(graphicsError)}
        </p>
      )}
      {editPath.error && (
        <p className="inline-warning" role="alert">
          {message(editPath.error)}
        </p>
      )}
      {fps && (
        <div className="viewport-accessible-controls" aria-label={t("viewport.alternative.aria")}>
          <button
            className="critical-button"
            aria-pressed={model.alternativeInput ?? false}
            onClick={() =>
              void controller.dispatch({
                type: "setAlternativeInput",
                enabled: !model.alternativeInput,
              })
            }
          >
            {model.alternativeInput
              ? t("viewport.alternative.disable")
              : t("viewport.alternative.enable")}
          </button>
          {!running && model.alternativeInput && (
            <button className="critical-button" onClick={input.resume}>
              {t("viewport.alternative.resume")}
            </button>
          )}
          <HelpTip
            topic={t("viewport.action.grabCancelPreview")}
            content={
              (model.placementGhost?.stage === "preview"
                ? t("viewport.action.grabCancelPreview")
                : undefined) || t("inspector.runningEditGuard")
            }
          >
            <button
              onClick={() => void controller.dispatch({ type: "grab" })}
              disabled={!running || !!held || model.placementGhost?.stage === "pending"}
            >
              {t(
                model.placementGhost?.stage === "preview"
                  ? "viewport.action.grabCancelPreview"
                  : "viewport.action.grab",
              )}
            </button>
          </HelpTip>
          <button onClick={() => void controller.dispatch({ type: "drop" })} disabled={!held}>
            {t("viewport.action.release")}
          </button>
          <button
            onClick={() => void controller.dispatch({ type: "throw" })}
            disabled={!running || !held}
          >
            {t("viewport.action.throw")}
          </button>
          <button
            onClick={() => void controller.dispatch({ type: "place" })}
            disabled={
              !running ||
              (held
                ? Boolean(model.placementGhost)
                : !model.placementGhost?.valid || model.placementGhost.stage !== "preview")
            }
          >
            {t(held ? "viewport.action.gentlePlace" : "viewport.action.place")}
          </button>
          {model.placementGhost && (
            <button onClick={() => void controller.dispatch({ type: "cancelPlacement" })}>
              {t("viewport.action.cancelPlacement")}
            </button>
          )}
          {!model.placementGhost && (
            <button
              onClick={() => void controller.dispatch({ type: "startPlacement" })}
              disabled={!running || !!held}
            >
              {t("viewport.action.startPlacement")}
            </button>
          )}
        </div>
      )}
      {fps && <AccessibleMovement controller={controller} disabled={!running} />}
    </section>
  );
}
