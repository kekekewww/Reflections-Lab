import { memoView } from "./view-stability.js";
import { HelpTip } from "./HelpTip.js";
import { BrowserKeyField } from "./BrowserKeyField.js";
import { BROWSER_AGENT_BUILD } from "../ai/client.js";
import { hasBrowserKey, subscribeBrowserKey } from "../ai/browser-key.js";
import { ZonePanel } from "./ZonePanel.js";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type {
  EventView,
  LabAction,
  LabController,
  LabViewModel,
  MetricView,
  PathView,
} from "./contracts.js";
import { useLocale, type MessageKey } from "./locale.js";
import { behaviorReasonText, nativeRejectionText } from "./behavior-diagnostic-text.js";
import { acousticPathPresentation, type AcousticPresentation } from "./acoustic-presentation.js";
import {
  MotionDockPanel,
  RenderDockPanel,
  PerformanceDockPanel,
  AgentWorkflowPanel,
} from "./PipelinePanels.js";
export { acousticPathPresentation } from "./acoustic-presentation.js";

type DockTab =
  | "events"
  | "paths"
  | "comparison"
  | "agent"
  | "motion"
  | "render"
  | "performance"
  | "zones";
const TABS: { id: DockTab; labelKey: MessageKey }[] = [
  { id: "events", labelKey: "analysis.tabs.events" },
  { id: "paths", labelKey: "analysis.tabs.paths" },
  { id: "comparison", labelKey: "analysis.tabs.comparison" },
  { id: "agent", labelKey: "analysis.tabs.agent" },
  { id: "motion", labelKey: "pipeline.tabs.motion" },
  { id: "render", labelKey: "pipeline.tabs.render" },
  { id: "performance", labelKey: "pipeline.tabs.performance" },
  { id: "zones", labelKey: "pipeline.tabs.zones" },
];
function useAnalysisText() {
  const { t, n, message } = useLocale();
  const number = (value: number | undefined | null, digits = 3): string =>
    typeof value === "number" && Number.isFinite(value)
      ? n(value, { maximumFractionDigits: digits })
      : t("analysis.notProvided");
  return { t, n, message, number };
}
const PATH_LABEL_KEYS: Record<PathView["kind"], MessageKey> = {
  direct: "analysis.path.direct",
  reflection: "analysis.path.reflection",
  transmission: "analysis.path.transmission",
  blocked: "analysis.path.blocked",
};
const PATH_EMPTY_HELP_KEYS: Record<AcousticPresentation, MessageKey> = {
  idle: "analysis.paths.idleHelp",
  ready: "analysis.paths.emptyHelp",
  empty: "analysis.paths.emptyHelp",
  pending: "analysis.paths.pendingHelp",
  stale: "analysis.paths.staleHelp",
  unsupported: "analysis.paths.unsupportedHelp",
  unavailable: "analysis.paths.unavailableHelp",
  error: "analysis.paths.errorHelp",
};

interface DockProps {
  controller: LabController;
  model: LabViewModel;
}
type Send = (action: LabAction) => void;

/** Experiment controls consume authoritative run data; no values are inferred from UI timing. */
export function AnalysisDock({ controller, model }: DockProps) {
  const { t, n, message } = useAnalysisText();
  const [tab, setTab] = useState<DockTab>("events");
  const [collapsed, setCollapsed] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const id = useId();
  const tabs = useRef<Partial<Record<DockTab, HTMLButtonElement | null>>>({});
  const send: Send = useCallback(
    (action: LabAction) => {
      setActionError(null);
      try {
        const pending = controller.dispatch(action);
        if (pending)
          void pending.catch((error: unknown) => {
            setActionError(error instanceof Error ? error.message : "ANALYSIS_ACTION_FAILED");
          });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "ANALYSIS_ACTION_FAILED");
      }
    },
    [controller],
  );

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (current + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    const target = TABS[next];
    if (!target) return;
    setTab(target.id);
    setCollapsed(false);
    tabs.current[target.id]?.focus();
  }

  return (
    <section
      className={`analysis-dock ${collapsed ? "is-collapsed" : ""}`}
      aria-label={t("analysis.region")}
    >
      <div className="dock-header">
        <div className="dock-tabs" role="tablist" aria-label={t("analysis.tabList")}>
          {TABS.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                tabs.current[item.id] = node;
              }}
              className={`dock-tab ${tab === item.id ? "is-active" : ""}`}
              id={`${id}-${item.id}-tab`}
              type="button"
              role="tab"
              aria-controls={`${id}-${item.id}-panel`}
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => {
                setTab(item.id);
                setCollapsed(false);
              }}
              onKeyDown={(event) => moveTab(event, index)}
            >
              {t(item.labelKey)}
              {item.id === "events" && <span className="dock-count">{n(model.events.length)}</span>}
              {item.id === "paths" && <span className="dock-count">{n(model.paths.length)}</span>}
            </button>
          ))}
        </div>
        <HelpTip
          topic={collapsed ? t("analysis.expand") : t("analysis.collapse")}
          content={
            (collapsed ? t("analysis.expand") : t("analysis.collapse")) ||
            t("inspector.runningEditGuard")
          }
        >
          <button
            className="icon-button dock-collapse"
            type="button"
            aria-expanded={!collapsed}
            aria-controls={`${id}-content`}
            aria-label={collapsed ? t("analysis.expand") : t("analysis.collapse")}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? "⌃" : "⌄"}
          </button>
        </HelpTip>
      </div>
      <div id={`${id}-content`} className="dock-content" hidden={collapsed}>
        {actionError && (
          <p className="inline-error" role="alert">
            {t("analysis.actionIncomplete")}
            {actionError === "ANALYSIS_ACTION_FAILED"
              ? t("analysis.actionFailed")
              : message(actionError)}
          </p>
        )}
        <div
          role="tabpanel"
          id={`${id}-events-panel`}
          aria-labelledby={`${id}-events-tab`}
          hidden={tab !== "events"}
        >
          <EventsPanel model={model} send={send} />
        </div>
        <div
          role="tabpanel"
          id={`${id}-paths-panel`}
          aria-labelledby={`${id}-paths-tab`}
          hidden={tab !== "paths"}
        >
          <PathsPanel model={model} send={send} />
        </div>
        <div
          role="tabpanel"
          id={`${id}-comparison-panel`}
          aria-labelledby={`${id}-comparison-tab`}
          hidden={tab !== "comparison"}
        >
          <ComparisonPanel model={model} send={send} />
        </div>
        <div
          role="tabpanel"
          id={`${id}-agent-panel`}
          aria-labelledby={`${id}-agent-tab`}
          hidden={tab !== "agent"}
        >
          <AgentPanel model={model} send={send} />
          <AgentWorkflowPanel controller={controller} send={send} />
        </div>
        <div
          role="tabpanel"
          id={`${id}-motion-panel`}
          aria-labelledby={`${id}-motion-tab`}
          hidden={tab !== "motion"}
        >
          <MotionDockPanel controller={controller} model={model} />
        </div>
        <div
          role="tabpanel"
          id={`${id}-render-panel`}
          aria-labelledby={`${id}-render-tab`}
          hidden={tab !== "render"}
        >
          <RenderDockPanel controller={controller} active={!collapsed && tab === "render"} />
        </div>
        <div
          role="tabpanel"
          id={`${id}-zones-panel`}
          aria-labelledby={`${id}-zones-tab`}
          hidden={tab !== "zones"}
        >
          <ZonePanel controller={controller} model={model} />
        </div>
        <div
          role="tabpanel"
          id={`${id}-performance-panel`}
          aria-labelledby={`${id}-performance-tab`}
          hidden={tab !== "performance"}
        >
          <PerformanceDockPanel controller={controller} />
        </div>
      </div>
    </section>
  );
}

function EventsPanelView({ model, send }: { model: LabViewModel; send: Send }) {
  const { t, n, message, number } = useAnalysisText();
  const [filter, setFilter] = useState("");
  const state = model.recording.state;
  const visible = useMemo(
    () =>
      model.events.filter((event) =>
        `${event.type} ${event.objectId ?? ""} ${event.ruleId ?? ""} ${event.assetId ?? ""} ${event.decision?.reason ?? ""} ${event.decision?.instanceId ?? ""} ${event.nativeRejection?.reason ?? ""} ${event.nativeRejection?.instanceId ?? ""} ${event.nativeRejection?.audioEventId ?? ""}`
          .toLocaleLowerCase()
          .includes(filter.trim().toLocaleLowerCase()),
      ),
    [filter, model.events],
  );
  const recent = visible.slice(-200).reverse();
  const selected = model.events.find((event) => event.id === model.selectedEventId);
  const duration = Math.max(0, model.recording.durationSeconds);
  const cursor = Math.min(duration, Math.max(0, model.recording.replayTimeSeconds ?? 0));
  const hasRecordedTime = Number.isFinite(duration) && duration > 0;
  const recordingLabel =
    state === "recording"
      ? t("analysis.recording.active")
      : state === "replaying"
        ? t("analysis.recording.replaying")
        : state === "finalized"
          ? t("analysis.recording.saved")
          : model.recording.hasArtifact
            ? t("analysis.recording.interrupted")
            : t("analysis.recording.empty");
  return (
    <div className="dock-panel events-panel">
      <div className="dock-toolbar">
        <div className="button-group">
          <HelpTip
            topic={t("analysis.recording.start")}
            content={
              state === "replaying"
                ? t("analysis.recording.stopReplayFirst")
                : model.simulationState === "error"
                  ? t("shell.simulationError")
                  : t(
                      state === "recording"
                        ? "analysis.recording.stop"
                        : "analysis.recording.start",
                    )
            }
          >
            <button
              type="button"
              className={state === "recording" ? "button-danger" : ""}
              aria-pressed={state === "recording"}
              disabled={state === "replaying" || model.simulationState === "error"}
              onClick={() => send({ type: "recordToggle" })}
            >
              {state === "recording" ? t("analysis.recording.stop") : t("analysis.recording.start")}
            </button>
          </HelpTip>
          <HelpTip
            topic={t("analysis.recording.replay")}
            content={
              !model.recording.canReplay
                ? t("analysis.recording.completeRequired")
                : state === "recording"
                  ? t("help.stopRecording")
                  : t("analysis.recording.replay")
            }
          >
            <button
              type="button"
              disabled={!model.recording.canReplay || state === "recording"}
              onClick={() => send({ type: state === "replaying" ? "stopReplay" : "replay" })}
            >
              {state === "replaying"
                ? t("analysis.recording.endReplay")
                : t("analysis.recording.replay")}
            </button>
          </HelpTip>
          <HelpTip
            topic={t("analysis.recording.export")}
            content={
              !(model.recording.hasArtifact ?? model.recording.canReplay)
                ? t("help.noArchivedRecording")
                : t("analysis.recording.exportHelp")
            }
          >
            <button
              type="button"
              disabled={!(model.recording.hasArtifact ?? model.recording.canReplay)}
              onClick={() => send({ type: "exportRecording" })}
            >
              {t("analysis.recording.export")}
            </button>
          </HelpTip>
        </div>
        <span className={`badge ${state === "recording" ? "badge-danger" : ""}`}>
          {recordingLabel}
        </span>
        <span className="numeric muted">
          {t("analysis.recording.summary", {
            duration: number(duration, 2),
            events: n(model.recording.eventCount),
          })}
        </span>
        <label className="dock-filter field-label">
          <span className="sr-only">{t("analysis.events.filter")}</span>
          <input
            type="search"
            placeholder={t("analysis.events.filterPlaceholder")}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label={t("analysis.events.filterAria")}
          />
        </label>
      </div>
      {model.recording.canReplay && (
        <div className="dock-playhead">
          <label htmlFor="recording-playhead">{t("analysis.recording.playhead")}</label>
          <input
            id="recording-playhead"
            type="range"
            min={0}
            max={hasRecordedTime ? duration : 1}
            step={0.001}
            value={cursor}
            aria-valuetext={t("analysis.recording.playheadAria", {
              cursor: number(cursor, 3),
              duration: number(duration, 3),
            })}
            disabled={!hasRecordedTime || state === "recording"}
            onChange={(event) => send({ type: "seek", timeSeconds: Number(event.target.value) })}
          />
          <output className="numeric" htmlFor="recording-playhead">
            {number(cursor, 2)} / {number(duration, 2)} s
          </output>
        </div>
      )}
      {recent.length ? (
        <div className="dock-data-grid">
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t("analysis.events.table")}
          >
            <table className="data-table event-table">
              <caption className="sr-only">{t("analysis.events.caption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("analysis.events.timeColumn")}</th>
                  <th scope="col">{t("analysis.events.tickColumn")}</th>
                  <th scope="col">{t("analysis.events.eventColumn")}</th>
                  <th scope="col">{t("analysis.events.objectRuleColumn")}</th>
                  <th scope="col">{t("analysis.events.resultColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((event) => (
                  <tr
                    key={event.id}
                    className={model.selectedEventId === event.id ? "is-selected" : ""}
                  >
                    <td className="numeric">{number(event.timeSeconds)}</td>
                    <td className="numeric">{n(event.tick)}</td>
                    <td>
                      <button
                        className="table-link"
                        type="button"
                        aria-current={model.selectedEventId === event.id ? "true" : undefined}
                        onClick={() => send({ type: "selectEvent", eventId: event.id })}
                      >
                        {event.type}
                      </button>
                    </td>
                    <td>
                      <span className="mono">{event.objectId ?? "—"}</span>
                      {event.ruleId && <small className="muted mono"> / {event.ruleId}</small>}
                    </td>
                    <td>
                      {event.nativeRejection ? (
                        <span className="badge badge-warning">
                          {nativeRejectionText(event.nativeRejection.reason, t)}
                        </span>
                      ) : event.suppressed ? (
                        <>
                          <span className="badge badge-warning">
                            {t("analysis.events.suppressed")}
                          </span>{" "}
                          {event.decision
                            ? behaviorReasonText(event.decision.reason, t, event.decision)
                            : message(event.detail)}
                        </>
                      ) : event.decision ? (
                        behaviorReasonText(event.decision.reason, t, event.decision)
                      ) : event.detail === undefined || event.detail === null ? (
                        t("analysis.events.recorded")
                      ) : (
                        message(event.detail)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > recent.length && (
              <p className="table-footnote">
                {t("analysis.events.recentSummary", {
                  recent: n(recent.length),
                  total: n(visible.length),
                })}
              </p>
            )}
          </div>
          {selected && <EventDetails event={selected} />}
        </div>
      ) : (
        <div className="empty-state">
          <strong>{filter ? t("analysis.events.noMatches") : t("analysis.events.waiting")}</strong>
          <HelpTip
            topic={t("analysis.tabs.events")}
            content={
              filter ? t("analysis.events.tryOtherFilter") : t("analysis.events.waitingHelp")
            }
          />
        </div>
      )}
    </div>
  );
}

const EventsPanel = memoView(EventsPanelView, ({ model, ...props }) => [
  props,
  model.events,
  model.selectedEventId,
  model.recording,
  model.simulationState,
]);

function EventDetailsView({ event }: { event: EventView }) {
  const { t, n, message, number } = useAnalysisText();
  return (
    <aside className="dock-detail" aria-label={t("analysis.events.details")}>
      <h3>{t("analysis.events.evidence")}</h3>
      <dl className="detail-list">
        <div>
          <dt>{t("analysis.detail.id")}</dt>
          <dd className="mono">{event.id}</dd>
        </div>
        <div>
          <dt>{t("analysis.detail.type")}</dt>
          <dd>{event.type}</dd>
        </div>
        <div>
          <dt>{t("analysis.detail.time")}</dt>
          <dd>
            {t("analysis.events.timeDetail", {
              time: number(event.timeSeconds),
              tick: n(event.tick),
            })}
          </dd>
        </div>
        <div>
          <dt>{t("analysis.detail.object")}</dt>
          <dd className="mono">{event.objectId ?? t("analysis.notProvided")}</dd>
        </div>
        <div>
          <dt>{t("analysis.detail.rule")}</dt>
          <dd className="mono">{event.ruleId ?? t("analysis.notBehaviorDecision")}</dd>
        </div>
        <div>
          <dt>{t("analysis.detail.asset")}</dt>
          <dd className="mono">{event.assetId ?? t("analysis.notProvided")}</dd>
        </div>
        <div>
          <dt>{t("analysis.detail.position")}</dt>
          <dd className="numeric">
            {event.positionM
              ? event.positionM.map((axis) => number(axis)).join(", ")
              : t("analysis.notProvided")}
          </dd>
        </div>
      </dl>
      {event.decision && (
        <dl className="detail-list">
          <div>
            <dt>{t("analysis.decision.reason")}</dt>
            <dd>{behaviorReasonText(event.decision.reason, t, event.decision)}</dd>
          </div>
          <div>
            <dt>{t("analysis.decision.action")}</dt>
            <dd>{t(`analysis.decision.action.${event.decision.action}`)}</dd>
          </div>
          <div>
            <dt>{t("analysis.decision.occurrences")}</dt>
            <dd>{n(event.decision.occurrences ?? 1)}</dd>
          </div>
          <div>
            <dt>{t("analysis.decision.binding")}</dt>
            <dd className="mono">{event.decision.bindingId ?? t("analysis.notProvided")}</dd>
          </div>
          <div>
            <dt>{t("analysis.decision.inputEvent")}</dt>
            <dd className="mono">{event.decision.inputEventId ?? t("analysis.notProvided")}</dd>
          </div>
          <div>
            <dt>{t("analysis.decision.instance")}</dt>
            <dd className="mono">{event.decision.instanceId ?? t("analysis.notProvided")}</dd>
          </div>
          <div>
            <dt>{t("analysis.decision.attachment")}</dt>
            <dd>
              {event.decision.emitterAttachment
                ? t(`analysis.decision.attachment.${event.decision.emitterAttachment}`)
                : t("analysis.notProvided")}
            </dd>
          </div>
          <div>
            <dt>{t("analysis.decision.contactPair")}</dt>
            <dd className="mono">{event.decision.contactPairKey ?? t("analysis.notProvided")}</dd>
          </div>
          <div>
            <dt>{t("analysis.decision.contactPosition")}</dt>
            <dd className="numeric">
              {event.decision.contactPositionM?.map((axis) => number(axis)).join(", ") ??
                t("analysis.notProvided")}
            </dd>
          </div>
          <div>
            <dt>{t("analysis.decision.emitterPosition")}</dt>
            <dd className="numeric">
              {event.decision.emitterPositionM?.map((axis) => number(axis)).join(", ") ??
                t("analysis.notProvided")}
            </dd>
          </div>
        </dl>
      )}
      {event.nativeRejection && (
        <>
          <p>{nativeRejectionText(event.nativeRejection.reason, t)}</p>
          <dl className="detail-list">
            <div>
              <dt>{t("analysis.native.audioEvent")}</dt>
              <dd className="mono">
                {event.nativeRejection.audioEventId}
                <br />
                tick {n(event.nativeRejection.audioEventTick)}
              </dd>
            </div>
            <div>
              <dt>{t("analysis.decision.inputEvent")}</dt>
              <dd className="mono">
                {event.nativeRejection.inputEventId ?? t("analysis.notProvided")}
              </dd>
            </div>
            <div>
              <dt>{t("analysis.decision.binding")}</dt>
              <dd className="mono">{event.nativeRejection.bindingId}</dd>
            </div>
            <div>
              <dt>{t("analysis.decision.instance")}</dt>
              <dd className="mono">{event.nativeRejection.instanceId}</dd>
            </div>
            <div>
              <dt>{t("analysis.detail.source")}</dt>
              <dd className="mono">{event.nativeRejection.sourceId}</dd>
            </div>
            <div>
              <dt>{t("analysis.native.epoch")}</dt>
              <dd className="mono">{event.nativeRejection.runEpoch}</dd>
            </div>
            <div>
              <dt>{t("analysis.native.context")}</dt>
              <dd>
                {t("analysis.native.contextValues", {
                  generation: event.nativeRejection.generation,
                  scene: event.nativeRejection.sceneRevision,
                  document: event.nativeRejection.behaviorDocumentRevision,
                  profile: event.nativeRejection.profileRevision,
                })}
                <br />
                <code>{event.nativeRejection.profileId}</code>
              </dd>
            </div>
            <div>
              <dt>{t("analysis.native.acousticFrame")}</dt>
              <dd className="mono">
                {event.nativeRejection.acousticRequestId ?? t("projectImport.notProvided")}
              </dd>
            </div>
            <div>
              <dt>{t("analysis.native.attempt")}</dt>
              <dd>
                {t("analysis.native.attemptValues", {
                  attempt: event.nativeRejection.attemptedAtTick,
                  pose: event.nativeRejection.acousticPoseTick ?? t("projectImport.notProvided"),
                  scene:
                    event.nativeRejection.acousticSceneRevision ?? t("projectImport.notProvided"),
                })}
              </dd>
            </div>
          </dl>
          <HelpTip topic={t("analysis.events.evidence")} content={t("analysis.native.scope")} />
        </>
      )}
      {event.detail && <p className="muted">{message(event.detail)}</p>}
    </aside>
  );
}

const EventDetails = memoView(EventDetailsView);

function PathsPanelView({ model, send }: { model: LabViewModel; send: Send }) {
  const { t, n, number, message } = useAnalysisText();
  const selected = model.paths.find((path) => path.id === model.selectedPathId);
  const presentation = acousticPathPresentation(model);
  return (
    <div className="dock-panel paths-panel">
      <div className="dock-toolbar">
        <span className={`badge ${model.acoustic.state === "stale" ? "badge-warning" : ""}`}>
          {t(`analysis.acoustic.${presentation}`)}
        </span>
        <span className="muted">
          {t("analysis.acoustic.revisions", {
            backend: model.acoustic.backend,
            acousticRevision:
              model.acoustic.revision === undefined || model.acoustic.revision === null
                ? "—"
                : n(model.acoustic.revision),
            sceneRevision: n(model.sceneRevision),
          })}
        </span>
      </div>
      {model.selectedPathId && !selected && (
        <p className="muted">{t("analysis.paths.selectionUnavailable")}</p>
      )}
      {model.paths.length ? (
        <div className="dock-data-grid">
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t("analysis.paths.table")}
          >
            <table className="data-table path-table">
              <caption className="sr-only">{t("analysis.paths.caption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("analysis.paths.idColumn")}</th>
                  <th scope="col">{t("analysis.detail.type")}</th>
                  <th scope="col">{t("analysis.paths.distanceColumn")}</th>
                  <th scope="col">{t("analysis.paths.delayColumn")}</th>
                  <th scope="col">{t("analysis.paths.gainColumn")}</th>
                  <th scope="col">{t("analysis.paths.statusColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {model.paths.map((path) => (
                  <tr
                    key={path.id}
                    className={model.selectedPathId === path.id ? "is-selected" : ""}
                  >
                    <td>
                      <button
                        className="table-link mono"
                        type="button"
                        onClick={() => send({ type: "selectPath", pathId: path.id })}
                      >
                        {path.id}
                      </button>
                    </td>
                    <td>{t(PATH_LABEL_KEYS[path.kind])}</td>
                    <td className="numeric">{number(path.distanceM)}</td>
                    <td className="numeric">{number(path.delaySeconds * 1000)}</td>
                    <td className="numeric">{number(path.gainLinear, 5)}</td>
                    <td>
                      {path.stale
                        ? t("analysis.paths.stale")
                        : path.kind === "blocked"
                          ? t("analysis.paths.debugOnly")
                          : t("analysis.paths.current")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <aside className="dock-detail" aria-label={t("analysis.paths.details")}>
              <h3>{t("analysis.paths.origin")}</h3>
              <dl className="detail-list">
                <div>
                  <dt>{t("analysis.detail.id")}</dt>
                  <dd className="mono">{selected.id}</dd>
                </div>
                <div>
                  <dt>{t("analysis.detail.source")}</dt>
                  <dd className="mono">{selected.sourceId ?? t("analysis.notProvided")}</dd>
                </div>
                <div>
                  <dt>{t("analysis.detail.surfaces")}</dt>
                  <dd className="mono">
                    {selected.surfaceIds?.join(" → ") || t("analysis.paths.noReflection")}
                  </dd>
                </div>
                <div>
                  <dt>{t("analysis.detail.model")}</dt>
                  <dd>{message(model.acoustic.model)}</dd>
                </div>
              </dl>
              <HelpTip topic={t("analysis.paths.origin")} content={t("analysis.paths.delayHelp")} />
            </aside>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <strong>
            {presentation === "ready" || presentation === "empty"
              ? t("analysis.paths.empty")
              : t(`analysis.acoustic.${presentation}`)}
          </strong>
          <p>{t(PATH_EMPTY_HELP_KEYS[presentation])}</p>
        </div>
      )}
      <MetricList metrics={model.acoustic.metrics} empty={t("analysis.paths.noMetrics")} />
    </div>
  );
}

const PathsPanel = memoView(PathsPanelView, ({ model, ...props }) => [
  props,
  model.paths,
  model.selectedPathId,
  model.sceneRevision,
  model.acoustic,
]);

function ComparisonPanelView({ model, send }: { model: LabViewModel; send: Send }) {
  const { t, message } = useAnalysisText();
  const [kind, setKind] = useState<"acoustic" | "behavior">("acoustic");
  return (
    <div className="dock-panel comparison-panel">
      <div className="dock-toolbar">
        <button type="button" onClick={() => send({ type: "captureComparison", slot: "A" })}>
          {model.comparison.hasA
            ? t("analysis.comparison.updateA")
            : t("analysis.comparison.saveA")}
        </button>
        <button type="button" onClick={() => send({ type: "captureComparison", slot: "B" })}>
          {model.comparison.hasB
            ? t("analysis.comparison.updateB")
            : t("analysis.comparison.saveB")}
        </button>
        <label className="field-label dock-inline-field">
          {t("analysis.comparison.kind")}
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as "acoustic" | "behavior")}
          >
            <option value="acoustic">{t("analysis.comparison.acoustic")}</option>
            <option value="behavior">{t("analysis.comparison.behavior")}</option>
          </select>
        </label>
        <HelpTip
          topic={t("analysis.comparison.compare")}
          content={
            !model.comparison.hasA || !model.comparison.hasB
              ? t("analysis.comparison.snapshotsRequired")
              : t("analysis.comparison.compare")
          }
        >
          <button
            className="primary-button"
            type="button"
            disabled={!model.comparison.hasA || !model.comparison.hasB}
            onClick={() => send({ type: "compare", kind })}
          >
            {t("analysis.comparison.compare")}
          </button>
        </HelpTip>
      </div>
      <div className="comparison-summary">
        <HelpTip
          topic={t("analysis.comparison.kind")}
          content={
            kind === "acoustic"
              ? t("analysis.comparison.acousticHelp")
              : t("analysis.comparison.behaviorHelp")
          }
        />
        {model.comparison.status ? (
          <p className="dock-status" role="status">
            {message(model.comparison.status)}
          </p>
        ) : (
          <HelpTip
            topic={t("analysis.tabs.comparison")}
            content={t("analysis.comparison.prepareHelp")}
          />
        )}
      </div>
      <MetricList metrics={model.comparison.metrics} empty={t("analysis.comparison.noMetrics")} />
    </div>
  );
}

const ComparisonPanel = memoView(ComparisonPanelView, ({ model, ...props }) => [
  props,
  model.comparison,
]);

function MetricListView({ metrics, empty }: { metrics: MetricView[]; empty: string }) {
  const { t, message, number } = useAnalysisText();
  if (!metrics.length) return <p className="empty-caption muted">{empty}</p>;
  return (
    <dl className="metric-grid">
      {metrics.map((metric) => (
        <div className="metric-card" key={`${metric.label}-${metric.unit}`}>
          <dt>{message(metric.label)}</dt>
          <dd className="numeric">
            {metric.value === null ? t("analysis.notProvided") : number(metric.value, 5)}
            {metric.value !== null && <span className="metric-unit"> {metric.unit}</span>}
          </dd>
          {metric.reason && <p className="muted">{message(metric.reason)}</p>}
        </div>
      ))}
    </dl>
  );
}

const MetricList = memoView(MetricListView);

function AgentPanelView({ model, send }: { model: LabViewModel; send: Send }) {
  const { t, message } = useAnalysisText();
  const [prompt, setPrompt] = useState("");
  const composing = useRef(false);
  const previewPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (model.ai.preview) previewPanel.current?.scrollIntoView({ block: "end" });
  }, [model.ai.preview]);
  const loading = model.ai.status === "loading";
  const selectedProvider = model.ai.selectedProvider ?? "offline";
  const providerStatus = model.ai.providerStatus;
  const keyHeld = useSyncExternalStore(subscribeBrowserKey, hasBrowserKey);
  const unavailable =
    selectedProvider === "meta" &&
    (providerStatus?.status !== "ready" || (BROWSER_AGENT_BUILD && !keyHeld));
  const refreshStatus = () => send({ type: "refreshAgentStatus" });
  useEffect(() => {
    // The status follows the key and each finished request. A request's transaction ends just
    // after its view update, and a refresh inside it would be refused as busy, so this waits a task.
    if (!BROWSER_AGENT_BUILD || selectedProvider !== "meta" || loading) return;
    const timer = setTimeout(() => send({ type: "refreshAgentStatus" }), 0);
    return () => clearTimeout(timer);
  }, [keyHeld, loading]);
  const providerLabels = {
    unknown: t("analysis.provider.unknown"),
    loading: t("analysis.provider.loading"),
    ready: t("analysis.provider.ready"),
    blocked: t("analysis.provider.blocked"),
    error: t("analysis.provider.error"),
  };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current || !prompt.trim() || loading || unavailable) return;
    send({ type: "submitPrompt", prompt: prompt.trim() });
  }
  return (
    <div className="dock-panel agent-panel">
      <div className="agent-heading">
        <strong>{t("analysis.agent.heading")}</strong>
        <HelpTip
          topic={t("analysis.agent.execution")}
          content={
            selectedProvider === "offline"
              ? t("analysis.agent.offlineHelp")
              : BROWSER_AGENT_BUILD
                ? t("analysis.agent.keyMetaHelp")
                : t("analysis.agent.metaHelp")
          }
        />
        <span className={`badge ${model.ai.mode === "live" ? "badge-success" : "badge-warning"}`}>
          {model.ai.mode === "live"
            ? t("analysis.agent.resultMeta")
            : model.ai.mode === "offline"
              ? t("analysis.agent.resultOffline")
              : t("analysis.agent.resultUnavailable")}
        </span>
      </div>
      <div className="dock-toolbar agent-provider-controls">
        <label className="field-label dock-inline-field">
          {t("analysis.agent.execution")}
          <select
            aria-label={t("analysis.agent.executionAria")}
            disabled={loading}
            value={selectedProvider}
            onChange={(event) =>
              send({
                type: "setAgentMode",
                mode: event.target.value === "meta" ? "meta" : "offline",
              })
            }
          >
            <option value="offline">{t("analysis.agent.offline")}</option>
            <option value="meta">{t("analysis.agent.meta")}</option>
          </select>
        </label>
        {!BROWSER_AGENT_BUILD && (
          <button
            type="button"
            disabled={loading || providerStatus?.status === "loading"}
            onClick={refreshStatus}
          >
            {t("analysis.agent.refresh")}
          </button>
        )}
        <HelpTip topic={t("pipeline.agent.undo")} content={t("pipeline.agent.undoHelp")}>
          <button
            type="button"
            disabled={loading || model.ai.canUndo !== true}
            onClick={() => send({ type: "undoAI" })}
          >
            {t("pipeline.agent.undo")}
          </button>
        </HelpTip>
      </div>
      {BROWSER_AGENT_BUILD && (selectedProvider === "meta" || keyHeld) && <BrowserKeyField />}
      <p
        className="field-help agent-provider-status"
        id="experiment-agent-provider-status"
        role="status"
      >
        {BROWSER_AGENT_BUILD ? (
          selectedProvider === "offline" ? (
            t("analysis.agent.keyOffline")
          ) : !keyHeld ? (
            t("analysis.agent.keyNeeded")
          ) : providerStatus?.status === "ready" ? (
            t("analysis.agent.keyReady")
          ) : (
            message(providerStatus?.reason ?? "")
          )
        ) : (
          <>
            {t("analysis.agent.gate", {
              status: providerLabels[providerStatus?.status ?? "unknown"],
            })}
            {providerStatus?.reason
              ? message(providerStatus.reason)
              : t("analysis.agent.noServerStatus")}
          </>
        )}
      </p>
      <form className="agent-form" onSubmit={submit}>
        <label className="field-label" htmlFor="experiment-agent-prompt">
          {t("analysis.agent.prompt")}
        </label>
        <div className="agent-input-row">
          <textarea
            id="experiment-agent-prompt"
            rows={2}
            maxLength={4000}
            value={prompt}
            placeholder={t("analysis.agent.promptExample")}
            aria-describedby="experiment-agent-provider-status"
            onChange={(event) => setPrompt(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey) &&
                !event.nativeEvent.isComposing &&
                !composing.current
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            className="primary-button"
            type="submit"
            disabled={!prompt.trim() || loading || unavailable}
            aria-busy={loading}
          >
            {loading ? t("analysis.agent.preparing") : t("analysis.agent.previewAction")}
          </button>
        </div>
        {unavailable && !BROWSER_AGENT_BUILD && (
          <p className="field-help" id="experiment-agent-mode">
            {t("analysis.agent.unavailableHelp")}
          </p>
        )}
        <HelpTip topic={t("analysis.agent.prompt")} content={t("analysis.agent.shortcut")} />
      </form>
      {model.ai.message && (
        <p
          className={`agent-message ${model.ai.status === "error" ? "inline-error" : ""}`}
          role={model.ai.status === "error" ? "alert" : "status"}
        >
          {message(model.ai.message)}
        </p>
      )}
      {model.ai.note && (
        <p className="agent-message">
          <strong>{t("analysis.agent.museNote")}</strong> {model.ai.note}
        </p>
      )}
      {model.ai.preview && (
        <div className="agent-preview" ref={previewPanel}>
          <div className="panel-heading">
            <h3>{t("analysis.agent.previewHeading")}</h3>
            <span className="badge">{t("analysis.agent.notApplied")}</span>
          </div>
          <pre tabIndex={0} aria-label={t("analysis.agent.validatedDiff")}>
            {model.ai.preview.split("\n").map(message).join("\n")}
          </pre>
          <div className="button-group">
            <button
              type="button"
              className="primary-button"
              disabled={!model.ai.canApply || loading}
              onClick={() => send({ type: "applyAI" })}
            >
              {model.simulationState === "running"
                ? t("analysis.agent.pauseAndApply")
                : t("analysis.agent.apply")}
            </button>
            <button type="button" disabled={loading} onClick={() => send({ type: "cancelAI" })}>
              {t("analysis.agent.cancel")}
            </button>
          </div>
          <HelpTip
            topic={t("analysis.agent.previewHeading")}
            content={t("analysis.agent.applyHelp")}
          />
        </div>
      )}
    </div>
  );
}

const AgentPanel = memoView(AgentPanelView, ({ model, ...props }) => [
  props,
  model.ai,
  model.simulationState,
]);
