import { acousticPathPresentation } from "./acoustic-presentation.js";
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import type { LabController, LabViewModel } from "./contracts.js";
import { canonicalTokens } from "./tokens.js";
import { CameraRig } from "./viewport/CameraRig.js";
import { SceneEntities } from "./viewport/SceneEntities.js";
import { useFPSInput } from "./viewport/useFPSInput.js";
import { AccessibleMovement } from "./viewport/AccessibleMovement.js";
import { ContextMonitor } from "./viewport/ContextMonitor.js";
import { useLocale } from "./locale.js";

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
}: {
  controller: LabController;
  model: LabViewModel;
}) {
  const { locale, t, message } = useLocale();
  const input = useFPSInput(controller, model);
  const canvasAria = t("viewport.canvas.aria");
  useEffect(() => {
    // Locale is presentation state: update the existing DOM node without
    // recreating R3F, controls, input listeners, or the actual pointer lock.
    input.canvas.current?.setAttribute("aria-label", canvasAria);
  }, [locale, canvasAria, input.canvas]);
  const [frameRequest, setFrameRequest] = useState(0);
  const [showBlocked, setShowBlocked] = useState(false);
  const [graphicsError, setGraphicsError] = useState<string | null>(null);
  const controlsCleanup = useRef<(() => void) | null>(null);
  const controlsClosed = useRef(false);
  const activateControls = useCallback(() => {
    controlsClosed.current = false;
  }, []);
  const disposeControls = useCallback(() => {
    controlsClosed.current = true;
    const dispose = controlsCleanup.current;
    controlsCleanup.current = null;
    dispose?.();
  }, []);
  const registerControlsCleanup = useCallback((dispose: () => void) => {
    if (controlsClosed.current) {
      dispose();
      return () => {};
    }
    controlsCleanup.current?.();
    controlsCleanup.current = dispose;
    return () => {
      if (controlsCleanup.current === dispose) controlsCleanup.current = null;
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
  return (
    <section
      className={`viewport-panel ${fps ? "viewport-fps" : ""}`}
      aria-label={t("viewport.region")}
    >
      <div className="viewport-toolbar">
        <div className="viewport-title">
          <span className="eyebrow">{t("viewport.eyebrow")}</span>
          <strong>
            {fps
              ? model.interactionMode === "fps-build"
                ? t("viewport.mode.build")
                : t("viewport.mode.interact")
              : t("viewport.mode.observe")}
          </strong>
        </div>
        <div className="button-group">
          <button
            onClick={() => setFrameRequest((value) => value + 1)}
            disabled={!selected || fps}
            title={t("viewport.frame.title")}
          >
            {t("viewport.frame.action")}
          </button>
          {fps ? (
            <button className="critical-button" onClick={input.exit}>
              {t("viewport.exit")}
            </button>
          ) : (
            <button
              className="critical-button"
              disabled={input.entering}
              onClick={() => void input.enter()}
            >
              {input.entering ? t("viewport.entering") : t("viewport.enter")}
            </button>
          )}
        </div>
      </div>
      <div className="viewport-canvas-wrap">
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
              fallback={
                <div className="viewport-fallback" role="alert">
                  {t("viewport.fallback.webgl")}
                </div>
              }
              onCreated={({ gl, camera }) => {
                input.canvas.current = gl.domElement;
                gl.domElement.tabIndex = 0;
                gl.domElement.setAttribute("aria-label", canvasAria);
                camera.lookAt(0, 1, 0);
              }}
              onPointerMissed={(event) => {
                if (!fps && !event.altKey)
                  void controller.dispatch({ type: "selectObject", objectId: null });
              }}
            >
              <ContextMonitor controller={controller} onError={setGraphicsError} />
              <CameraRig
                controller={controller}
                model={model}
                frameRequest={frameRequest}
                registerControlsCleanup={registerControlsCleanup}
              />
              <SceneEntities controller={controller} model={model} showBlocked={showBlocked} />
            </Canvas>
          </CanvasControlsLifetime>
        </CanvasBoundary>
        <div className="viewport-overlay viewport-top-left">
          <span className={`status-pill ${running ? "status-running" : ""}`}>
            {running
              ? t("viewport.status.running")
              : model.simulationState === "paused"
                ? t("viewport.status.paused")
                : t("viewport.status.ready")}
          </span>
          <span className="mono">
            {t("viewport.time", {
              tick: model.tick,
              seconds: model.simTimeSeconds.toFixed(2),
            })}
          </span>
          {model.pauseReason && (
            <span className="viewport-message">{message(model.pauseReason)}</span>
          )}
        </div>
        <div className="viewport-overlay viewport-top-right">
          <span className="evidence-tag">
            {t(`viewport.acoustic.${acousticPathPresentation(model)}`)}
          </span>
          <span>
            {t("viewport.revisions", {
              sceneRevision: model.sceneRevision,
              acousticRevision:
                model.acoustic.revision === null ? "—" : "r" + model.acoustic.revision,
            })}
          </span>
        </div>
        {fps && (
          <>
            <div className="viewport-crosshair" aria-hidden="true">
              ＋
            </div>
            <div className="viewport-overlay viewport-fps-hint" aria-live="polite">
              <strong>
                {held
                  ? t("viewport.held", { name: held.name ?? held.id })
                  : model.interactionMode === "fps-build"
                    ? t("viewport.build.hint")
                    : t("viewport.interact.hint")}
              </strong>
              {held && <span>{t("viewport.held.mass", { mass: String(held.massKg) })}</span>}
              {model.placementGhost && (
                <span className={model.placementGhost.valid ? "status-success" : "inline-warning"}>
                  {model.placementGhost.stage === "staged"
                    ? t("viewport.placement.staged")
                    : model.placementGhost.valid
                      ? t("viewport.placement.valid")
                      : t("viewport.placement.invalid")}
                  {model.placementGhost.reason
                    ? t("viewport.placement.reason", {
                        reason: message(model.placementGhost.reason),
                      })
                    : ""}
                </span>
              )}
              <span>
                {input.locked
                  ? running
                    ? t("viewport.input.running")
                    : t("viewport.input.paused")
                  : model.alternativeInput
                    ? t("viewport.input.alternative")
                    : t("viewport.input.unlocked")}
              </span>
              {!input.locked && (
                <button disabled={input.entering} onClick={() => void input.enter()}>
                  {t("viewport.input.enablePointer")}
                </button>
              )}
            </div>
          </>
        )}
        <div className="viewport-overlay viewport-axis" aria-label={t("viewport.coordinates.aria")}>
          Y↑ <span>{t("viewport.coordinates.forward")}</span>
          <small>SI · m</small>
        </div>
      </div>
      <div className="viewport-bottom">
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
            <button
              className="critical-button"
              onClick={() => void controller.dispatch({ type: "run" })}
            >
              {t("viewport.alternative.resume")}
            </button>
          )}
          <button
            onClick={() => void controller.dispatch({ type: "grab" })}
            disabled={!running || !!held}
          >
            {t("viewport.action.grab")}
          </button>
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
              model.interactionMode !== "fps-build" ||
              !model.placementGhost?.valid ||
              model.placementGhost.stage !== "preview"
            }
          >
            {t("viewport.action.place")}
          </button>
          {model.placementGhost?.stage === "staged" && (
            <button
              className="critical-button"
              onClick={() => void controller.dispatch({ type: "enableStaged" })}
            >
              {t("viewport.action.enableStaged")}
            </button>
          )}
          {model.placementGhost && (
            <button onClick={() => void controller.dispatch({ type: "cancelPlacement" })}>
              {t("viewport.action.cancelPlacement")}
            </button>
          )}
          <button
            onClick={() =>
              void controller.dispatch({
                type: "setInteractionMode",
                mode: model.interactionMode === "fps-build" ? "fps-interact" : "fps-build",
              })
            }
            disabled={!!held}
          >
            {model.interactionMode === "fps-build"
              ? t("viewport.action.toInteract")
              : t("viewport.action.toBuild")}
          </button>
        </div>
      )}
      {fps && <AccessibleMovement controller={controller} disabled={!running} />}
    </section>
  );
}
