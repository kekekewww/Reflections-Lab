import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { LabAction, LabController, LabViewModel, Workspace } from "./contracts.js";
import { AnalysisDock } from "./AnalysisDock.js";
import { Inspector } from "./Inspector.js";
import { SceneExplorer } from "./SceneExplorer.js";
import { ProjectImportButton } from "./ProjectImport.js";
import { Viewport } from "./Viewport.js";
import { Badge, Icon, NumberField } from "./components.js";
import { canonicalTokens, designTokenStyle } from "./tokens.js";
import { LocaleProvider, useLocale } from "./locale.js";
import "./styles.css";

const workspaces: { id: Workspace; number: string }[] = [
  { id: "scene", number: "01" },
  { id: "simulation", number: "02" },
  { id: "analysis", number: "03" },
];
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      Boolean(target.closest("input, textarea, select, [role='textbox'], dialog, [role='dialog']")))
  );
}

function PanelDivider({
  side,
  width,
  onChange,
  hidden,
  maxWidth,
}: {
  side: "left" | "right";
  width: number;
  onChange: (width: number) => void;
  hidden: boolean;
  maxWidth: number;
}) {
  const { t } = useLocale();
  const initial = parseInt(
    canonicalTokens.sizing[side === "left" ? "leftPanel" : "rightPanel"].$value,
    10,
  );
  const max = Math.min(Math.round(initial * 1.7), maxWidth);
  const min = Math.min(Math.round(initial * 0.7), max);
  const bounded = (value: number) => Math.max(min, Math.min(max, value));
  return (
    <div
      className={`panel-divider panel-divider-${side}`}
      role="separator"
      aria-label={side === "left" ? t("shell.resizeScene") : t("shell.resizeInspector")}
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
      inert={hidden}
      onDoubleClick={() => onChange(bounded(initial))}
      onKeyDown={(event) => {
        if (event.key === "Home") {
          onChange(bounded(initial));
          event.preventDefault();
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          const direction = event.key === "ArrowRight" ? 1 : -1;
          onChange(
            bounded(
              width +
                direction *
                  (side === "left" ? 1 : -1) *
                  parseInt(canonicalTokens.spacing["2"].$value, 10),
            ),
          );
          event.preventDefault();
        }
      }}
      onPointerDown={(event) => {
        const handle = event.currentTarget;
        const startX = event.clientX,
          startWidth = width;
        handle.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) =>
          onChange(bounded(startWidth + (next.clientX - startX) * (side === "left" ? 1 : -1)));
        const end = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", end);
          handle.removeEventListener("pointercancel", cancel);
        };
        const cancel = () => {
          onChange(startWidth);
          end();
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", cancel);
      }}
    >
      <span />
    </div>
  );
}

function MonitorStrip({ controller, model }: { controller: LabController; model: LabViewModel }) {
  const { t, n } = useLocale();
  const blocked = model.monitor.state === "blocked";
  return (
    <footer className="monitor-strip" aria-label={t("shell.monitorRegion")}>
      <div className="monitor-controls">
        <button
          type="button"
          className={`monitor-mute critical-button ${!model.monitor.muted ? "is-audible" : ""}`}
          aria-pressed={model.monitor.muted}
          onClick={() => void controller.dispatch({ type: blocked ? "enableAudio" : "toggleMute" })}
        >
          <Icon name={model.monitor.muted ? "mute" : "sound"} />
          <span>
            {blocked
              ? t("shell.enableListening")
              : model.monitor.muted
                ? t("shell.monitorMuted")
                : t("shell.muteMonitor")}
          </span>
        </button>
        <label className="monitor-gain">
          <span>{t("shell.monitor")}</span>
          <input
            aria-label={t("shell.monitorGain")}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={model.monitor.gainLinear}
            onChange={(event) =>
              void controller.dispatch({
                type: "setMonitorGain",
                gainLinear: Number(event.target.value),
              })
            }
          />
          <output>
            {n(Math.round(model.monitor.gainLinear * 100), { maximumFractionDigits: 0 })}%
          </output>
        </label>
      </div>
      <div className="monitor-route" role="group" aria-label={t("shell.monitorRoute")}>
        <button
          type="button"
          aria-pressed={model.monitor.mode === "simulated"}
          className={model.monitor.mode === "simulated" ? "selected" : ""}
          onClick={() => void controller.dispatch({ type: "setMonitorMode", mode: "simulated" })}
        >
          {t("shell.simulated")}
        </button>
        <button
          type="button"
          aria-pressed={model.monitor.mode === "raw"}
          className={model.monitor.mode === "raw" ? "selected" : ""}
          title={t("shell.rawReferenceTitle")}
          onClick={() => void controller.dispatch({ type: "setMonitorMode", mode: "raw" })}
        >
          {t("shell.rawReference")}
        </button>
      </div>
      {(model.acoustic.state === "stale" || model.acoustic.state === "pending") && (
        <span className="monitor-acoustic-warning" role="status">
          {model.acoustic.state === "stale" ? t("shell.acousticStale") : t("shell.acousticPending")}
        </span>
      )}
      <details className="monitor-metadata">
        <summary>{t("shell.monitorDetails")}</summary>
        <div className="monitor-metadata-content">
          <span className="monitor-voice mono">
            {t("shell.voices")} {n(model.monitor.activeVoices, { maximumFractionDigits: 0 })}/
            {n(model.monitor.voiceLimit, { maximumFractionDigits: 0 })}
          </span>
          <div className="backend-status">
            <span className={`status-dot ${model.acoustic.state}`} />
            <span>{model.acoustic.backend}</span>
            <span className="subtle">
              rev{" "}
              {model.acoustic.revision === null
                ? "—"
                : n(model.acoustic.revision, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <span className="monitor-note">
            {model.monitor.mode === "raw"
              ? t("shell.rawRoutingNote")
              : t("shell.simulatedRoutingNote")}{" "}
            · dBFS ≠ dB SPL
          </span>
        </div>
      </details>
      <details className="monitor-reverb">
        <summary>{t("shell.lateReverb")}</summary>
        <div className="monitor-reverb-settings">
          <label className="check-field">
            <input
              type="checkbox"
              aria-label={t("shell.enableLateReverb")}
              checked={model.monitor.lateReverb?.enabled ?? false}
              disabled={!model.monitor.lateReverb}
              onChange={(event) =>
                void controller.dispatch({ type: "setReverb", enabled: event.target.checked })
              }
            />
            <span>{t("shell.lateReverbPerceptual")}</span>
          </label>
          <p className="micro-copy">{t("shell.lateReverbExplanation")}</p>
          {model.monitor.lateReverb && (
            <>
              <NumberField
                label={t("shell.syntheticDecay")}
                unit="s"
                value={model.monitor.lateReverb.decaySeconds}
                min={0.1}
                max={4}
                step={0.1}
                onCommit={(decaySeconds) =>
                  void controller.dispatch({
                    type: "setReverb",
                    enabled: model.monitor.lateReverb?.enabled ?? false,
                    decaySeconds,
                  })
                }
              />
              <NumberField
                label={t("shell.reverbWetGain")}
                unit="linear"
                value={model.monitor.lateReverb.wetGain}
                min={0}
                max={1}
                step={0.05}
                onCommit={(wetGain) =>
                  void controller.dispatch({
                    type: "setReverb",
                    enabled: model.monitor.lateReverb?.enabled ?? false,
                    wetGain,
                  })
                }
              />
            </>
          )}
        </div>
      </details>
    </footer>
  );
}

export function App({ controller }: { controller: LabController }) {
  return (
    <LocaleProvider>
      <LabApp controller={controller} />
    </LocaleProvider>
  );
}

function LabApp({ controller }: { controller: LabController }) {
  const { locale, setLocale, t, n, message } = useLocale();
  const workspaceNames = {
    scene: t("shell.workspaceScene"),
    simulation: t("shell.workspaceSimulation"),
    analysis: t("shell.workspaceAnalysis"),
  };
  const stateLabels = {
    ready: t("shell.ready"),
    running: t("shell.running"),
    paused: t("shell.paused"),
    error: t("shell.simulationError"),
  };
  const model = useSyncExternalStore(
    controller.subscribe.bind(controller),
    controller.getSnapshot.bind(controller),
  );
  const [localError, setLocalError] = useState("");
  const [workspaceWidth, setWorkspaceWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const resize = () => setWorkspaceWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [showListener, setShowListener] = useState(false);
  const [mobilePane, setMobilePane] = useState("viewport");
  const [leftWidth, setLeftWidth] = useState(parseInt(canonicalTokens.sizing.leftPanel.$value, 10));
  const [rightWidth, setRightWidth] = useState(
    parseInt(canonicalTokens.sizing.rightPanel.$value, 10),
  );
  const [leftHidden, setLeftHidden] = useState(false),
    [rightHidden, setRightHidden] = useState(false);
  const safeController = useMemo<LabController>(
    () => ({
      getSnapshot: controller.getSnapshot.bind(controller),
      subscribe: controller.subscribe.bind(controller),
      getPose: controller.getPose.bind(controller),
      ...(controller.getFPSCamera
        ? { getFPSCamera: controller.getFPSCamera.bind(controller) }
        : {}),
      dispatch: (action: LabAction) => {
        try {
          return Promise.resolve(controller.dispatch(action)).catch((error) => {
            setLocalError(error instanceof Error ? error.message : String(error));
          });
        } catch (error) {
          setLocalError(error instanceof Error ? error.message : String(error));
          return Promise.resolve();
        }
      },
    }),
    [controller],
  );
  useEffect(() => {
    if (model.selectedObjectId) setShowListener(false);
  }, [model.selectedObjectId]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || isTyping(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.code === "KeyZ") {
        event.preventDefault();
        void safeController.dispatch({ type: event.shiftKey ? "redo" : "undo" });
      }
      if (modifier && event.code === "KeyS") {
        event.preventDefault();
        void safeController.dispatch({ type: "save" });
      }
      if (
        event.code === "Delete" &&
        model.interactionMode === "editor" &&
        model.selectedObjectId &&
        model.simulationState !== "running"
      ) {
        event.preventDefault();
        void safeController.dispatch({ type: "removeObject", objectId: model.selectedObjectId });
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [safeController, model.interactionMode, model.selectedObjectId, model.simulationState]);
  const emit = (action: LabAction) => void safeController.dispatch(action);
  const statusMessage = model.pauseReason || model.notice;
  // At desktop widths reserve at least 320px for the viewport and both dividers.
  const availablePanelWidth = Math.max(0, workspaceWidth - 320 - 8);
  const panelLimit = Math.floor(availablePanelWidth / (!leftHidden && !rightHidden ? 2 : 1));
  const effectiveLeftWidth = Math.min(leftWidth, panelLimit);
  const effectiveRightWidth = Math.min(rightWidth, panelLimit);
  const paneStyles = {
    ...designTokenStyle,
    "--left-panel-width": `${effectiveLeftWidth}px`,
    "--right-panel-width": `${effectiveRightWidth}px`,
  } as CSSProperties;
  return (
    <div className="lab-app" style={paneStyles}>
      <a className="skip-link" href="#main-workspace">
        {t("shell.skipToWorkspace")}
      </a>
      <div className="lab-content">
        <header className="project-bar">
          <div className="brand">
            <span className="brand-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              REFLECTION<span className="brand-lab">LAB</span>
            </span>
          </div>
          <div className="project-name">
            <strong>{model.projectName}</strong>
            <span>
              Scene rev {n(model.sceneRevision, { maximumFractionDigits: 0 })}{" "}
              <span className="separator-dot">·</span> {t("shell.localProject")}
            </span>
          </div>
          <nav className="workspace-tabs" aria-label={t("shell.workspaceNavigation")}>
            {workspaces.map((workspace) => (
              <button
                type="button"
                key={workspace.id}
                aria-current={model.workspace === workspace.id ? "page" : undefined}
                className={model.workspace === workspace.id ? "selected" : ""}
                onClick={() => emit({ type: "workspace", workspace: workspace.id })}
              >
                <small>{workspace.number}</small>
                {workspaceNames[workspace.id]}
              </button>
            ))}
          </nav>
          <label className="locale-control" data-locale-control="true">
            <span>介面語言 / Interface language</span>
            <select
              data-locale-control="true"
              aria-label="介面語言 / Interface language"
              value={locale}
              onChange={(event) => {
                if (event.target.value === "zh-TW" || event.target.value === "en")
                  setLocale(event.target.value);
              }}
            >
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </label>
          <div className="project-actions">
            <button
              type="button"
              className="icon-button"
              title={t("shell.saveTitle")}
              aria-label={t("shell.save")}
              onClick={() => emit({ type: "save" })}
            >
              <Icon name="save" />
            </button>
            <button
              type="button"
              className="icon-button"
              title={t("shell.exportTitle")}
              aria-label={t("shell.export")}
              onClick={() => emit({ type: "export" })}
            >
              <Icon name="download" />
            </button>
            <button
              type="button"
              className="icon-button"
              title={t("shell.load")}
              aria-label={t("shell.load")}
              onClick={() => emit({ type: "load" })}
            >
              <Icon name="reset" />
            </button>
            <ProjectImportButton
              controller={controller}
              disabled={
                model.simulationState === "running" || model.recording.state === "replaying"
              }
            />
          </div>
        </header>
        <div className="transport-bar" aria-label={t("shell.simulationControls")}>
          <div className="transport-actions">
            <button
              type="button"
              className="primary-button critical-button"
              disabled={model.simulationState === "error" || model.recording.state === "replaying"}
              onClick={() => emit({ type: model.simulationState === "running" ? "pause" : "run" })}
            >
              <Icon name={model.simulationState === "running" ? "pause" : "play"} />
              {model.simulationState === "running"
                ? t("shell.pause")
                : model.simulationState === "paused"
                  ? t("shell.resume")
                  : t("shell.start")}
            </button>
            <button
              type="button"
              className="outline-button"
              title={t("shell.resetTitle", {
                revision: n(model.sceneRevision, { maximumFractionDigits: 0 }),
              })}
              onClick={() => emit({ type: "reset" })}
            >
              <Icon name="reset" />
              {t("shell.reset")}
            </button>
            <span className="transport-divider" />
            <button
              type="button"
              className="icon-button"
              disabled={!model.canUndo}
              aria-label={t("shell.undo")}
              title={t("shell.undoTitle")}
              onClick={() => emit({ type: "undo" })}
            >
              <Icon name="undo" />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled={!model.canRedo}
              aria-label={t("shell.redo")}
              onClick={() => emit({ type: "redo" })}
            >
              <Icon name="redo" />
            </button>
          </div>
          <div className="run-status">
            <Badge
              kind={
                model.simulationState === "running"
                  ? "success"
                  : model.simulationState === "error"
                    ? "danger"
                    : "neutral"
              }
            >
              {stateLabels[model.simulationState]}
            </Badge>
            <span className="mono">
              {n(model.simTimeSeconds, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: false,
              })}{" "}
              s
            </span>
            <span className="subtle mono">tick {model.tick}</span>
            {model.recording.state === "recording" && (
              <Badge kind="danger">● {t("shell.recording")}</Badge>
            )}
          </div>
          <div className="panel-controls">
            <button
              type="button"
              className="text-button"
              aria-pressed={!leftHidden}
              onClick={() => setLeftHidden((value) => !value)}
            >
              <Icon name="layers" />
              {t("shell.scene")}
            </button>
            <button
              type="button"
              className="text-button"
              aria-pressed={!rightHidden}
              onClick={() => setRightHidden((value) => !value)}
            >
              <Icon name="info" />
              {t("shell.inspector")}
            </button>
          </div>
        </div>
        {(model.error || localError) && (
          <div className="status-banner error-banner" role="alert">
            <Icon name="info" />
            <span>{message(localError || model.error)}</span>
            {localError && (
              <button
                type="button"
                className="icon-button"
                aria-label={t("shell.dismissError")}
                onClick={() => setLocalError("")}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        )}
        {statusMessage && (
          <div className="status-banner" role="status">
            <Icon name="info" size={14} />
            <span>{message(statusMessage)}</span>
          </div>
        )}
        <nav className="mobile-pane-tabs" aria-label={t("shell.mainPanels")}>
          {[
            { id: "scene", label: t("shell.scene") },
            { id: "viewport", label: t("shell.viewport") },
            { id: "inspector", label: t("shell.inspector") },
          ].map((pane) => (
            <button
              type="button"
              key={pane.id}
              className={mobilePane === pane.id ? "selected" : ""}
              aria-pressed={mobilePane === pane.id}
              onClick={() => setMobilePane(pane.id)}
            >
              {pane.label}
            </button>
          ))}
        </nav>
        <main
          id="main-workspace"
          className={`main-workspace mobile-${mobilePane} ${leftHidden ? "left-hidden" : ""} ${rightHidden ? "right-hidden" : ""}`}
        >
          <SceneExplorer
            controller={safeController}
            model={model}
            onListener={() => {
              setShowListener(true);
              emit({ type: "selectObject", objectId: null });
              setMobilePane("inspector");
            }}
          />
          <PanelDivider
            side="left"
            width={effectiveLeftWidth}
            onChange={setLeftWidth}
            hidden={leftHidden}
            maxWidth={panelLimit}
          />
          <Viewport controller={safeController} model={model} />
          <PanelDivider
            side="right"
            width={effectiveRightWidth}
            onChange={setRightWidth}
            hidden={rightHidden}
            maxWidth={panelLimit}
          />
          <Inspector
            controller={safeController}
            transactionController={controller}
            model={model}
            showListener={showListener}
          />
        </main>
        <AnalysisDock controller={safeController} model={model} />
      </div>
      <MonitorStrip controller={safeController} model={model} />
    </div>
  );
}
