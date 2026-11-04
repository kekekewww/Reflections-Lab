import { useCallback, useState } from "react";
import type { LabAction, LabController, LabViewModel } from "./contracts.js";
import type { MotionWorkspace } from "../motion/workspace.js";
import { MotionPanel } from "./MotionPanel.js";
import { RenderPanel } from "./RenderPanel.js";
import { RecordingRecoveryPanel } from "./RecordingRecoveryPanel.js";
import { PerformancePanel } from "./PerformancePanel.js";
import { Badge, NumberField } from "./components.js";
import { HelpTip } from "./HelpTip.js";
import { useLocale } from "./locale.js";
import { citedWorkflowMetrics } from "./pipeline-workflow-model.js";
import type { MessageKey } from "./locale.js";
import type { AgentExperimentWorkflowView } from "../app/agent-experiment-workflow.js";

type Send = (action: LabAction) => void;

function UnavailablePanel() {
  const { t } = useLocale();
  return <p className="empty-state">{t("pipeline.unavailable")}</p>;
}

export function MotionDockPanel({
  controller,
  model,
}: {
  controller: LabController;
  model: LabViewModel;
}) {
  const workspace = controller.getMotionWorkspace?.();
  return workspace ? (
    <MotionWorkspacePanel workspace={workspace} controller={controller} model={model} />
  ) : (
    <UnavailablePanel />
  );
}

function MotionWorkspacePanel({
  workspace,
  controller,
  model,
}: {
  workspace: MotionWorkspace;
  controller: LabController;
  model: LabViewModel;
}) {
  const { locale } = useLocale();
  // Prefer the same published Scene/Motion snapshot; reading the live sidecar
  // during an install transaction could expose the next registry too early.
  const view = model.motion ?? workspace.getView();
  const object = model.objects.find((item) => item.id === model.selectedObjectId);
  return (
    <div className="dock-panel pipeline-motion-panel">
      <MotionPanel
        locale={locale}
        view={view}
        {...(object
          ? { selectedObject: { id: object.id, positionM: object.positionM, mode: object.mode } }
          : {})}
        disabled={
          model.simulationState === "running" ||
          model.recording.state === "recording" ||
          model.recording.state === "replaying"
        }
        onSave={(input, expectedRevision) =>
          controller.dispatch({ type: "motionSave", input, expectedRevision })
        }
        onRemove={(actionId, expectedRevision) =>
          controller.dispatch({ type: "motionRemove", actionId, expectedRevision })
        }
        onStart={(actionId) => controller.dispatch({ type: "motionStart", actionId })}
        onCancel={(runId) => controller.dispatch({ type: "motionCancel", runId })}
        onUndo={(expectedRevision) => controller.dispatch({ type: "motionUndo", expectedRevision })}
        onRedo={(expectedRevision) => controller.dispatch({ type: "motionRedo", expectedRevision })}
        onRebase={(expectedRevision) =>
          controller.dispatch({ type: "motionRebase", expectedRevision })
        }
        onExport={() => controller.dispatch({ type: "exportMotion" })}
        onImport={(text, expectedRevision) =>
          controller.dispatch({ type: "importMotion", text, expectedRevision })
        }
      />
    </div>
  );
}

export function RenderDockPanel({
  controller,
  active = true,
}: {
  controller: LabController;
  active?: boolean;
}) {
  const { locale } = useLocale();
  const host = controller.getRenderHost?.();
  return host ? (
    <div className="dock-panel pipeline-render-panel">
      <RenderPanel
        host={host}
        locale={locale}
        active={active}
        {...(controller.captureShortTake
          ? { onCaptureShortTake: (seconds: number) => controller.captureShortTake!(seconds) }
          : {})}
      />
      <RecordingRecoveryPanel controller={controller} locale={locale} active={active} />
    </div>
  ) : (
    <UnavailablePanel />
  );
}

export function PerformanceDockPanel({ controller }: { controller: LabController }) {
  const onEnabledChange = useCallback(
    (enabled: boolean) => {
      void controller.dispatch({ type: "setAudioDiagnosticsEnabled", enabled });
    },
    [controller],
  );
  return (
    <PerformancePanel
      diagnostics={controller.getAudioDiagnostics?.() ?? null}
      onEnabledChange={onEnabledChange}
    />
  );
}

const workflowStatus: Record<AgentExperimentWorkflowView["status"], MessageKey> = {
  idle: "pipeline.workflow.status.idle",
  running: "pipeline.workflow.status.running",
  cancelRequested: "pipeline.workflow.status.cancelRequested",
  completed: "pipeline.workflow.status.completed",
  stopped: "pipeline.workflow.status.stopped",
  failed: "pipeline.workflow.status.failed",
};
const stepStatus: Readonly<Record<string, MessageKey>> = {
  queued: "pipeline.workflow.step.queued",
  running: "pipeline.workflow.step.running",
  succeeded: "pipeline.workflow.step.succeeded",
  failed: "pipeline.workflow.step.failed",
  cancelRequested: "pipeline.workflow.step.cancelRequested",
  canceled: "pipeline.workflow.step.canceled",
  timedOut: "pipeline.workflow.step.timedOut",
  budgetExceeded: "pipeline.workflow.step.budgetExceeded",
};

/** User-started trusted host tools; selecting a provider never changes this provenance. */
export function AgentWorkflowPanel({
  controller,
  send,
}: {
  controller: LabController;
  send: Send;
}) {
  const { t, n, message } = useLocale();
  const [durationS, setDurationS] = useState(3);
  const workflow = controller.getAgentSession?.()?.getWorkflowView();
  if (!workflow) return null;
  const busy = workflow.status === "running" || workflow.status === "cancelRequested";
  const metricRows = citedWorkflowMetrics(workflow);
  return (
    <section className="pipeline-workflow" aria-label={t("pipeline.workflow.title")}>
      <div className="panel-heading">
        <h3>{t("pipeline.workflow.title")}</h3>
        <Badge
          kind={
            workflow.status === "failed"
              ? "danger"
              : workflow.status === "completed"
                ? "success"
                : "neutral"
          }
        >
          {t(workflowStatus[workflow.status])}
        </Badge>
        <HelpTip topic={t("pipeline.workflow.title")} content={t("pipeline.workflow.help")} />
      </div>
      <div className="dock-toolbar pipeline-workflow-controls">
        <NumberField
          label={t("pipeline.workflow.duration")}
          value={durationS}
          unit="s"
          min={1}
          max={10}
          step={1}
          disabled={busy}
          onCommit={setDurationS}
        />
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => send({ type: "runAgentExperiment", durationS })}
        >
          {t("pipeline.workflow.run")}
        </button>
        <button
          type="button"
          disabled={busy || !workflow.canCompare}
          onClick={() => send({ type: "compareAgentExperiment" })}
        >
          {t("pipeline.workflow.compare")}
        </button>
        {busy && (
          <button
            type="button"
            disabled={workflow.status === "cancelRequested"}
            onClick={() => send({ type: "cancelAI" })}
          >
            {t("pipeline.workflow.cancel")}
          </button>
        )}
      </div>
      {workflow.error && (
        <p className="inline-error" role="alert">
          {message(workflow.error.message)}
        </p>
      )}
      {!workflow.baseline && !busy && <p className="empty-state">{t("pipeline.workflow.empty")}</p>}
      {workflow.explanation && (
        <div className="pipeline-explanation">
          <strong>{t("pipeline.workflow.explanation")}</strong>
          <Badge>{t("pipeline.workflow.computed")}</Badge>
          <div className="table-scroll pipeline-metric-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("pipeline.workflow.metric")}</th>
                  <th scope="col">{t("pipeline.workflow.value")}</th>
                  <th scope="col">{t("pipeline.workflow.unit")}</th>
                  <th scope="col">{t("pipeline.workflow.band")}</th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map((record) => (
                  <tr key={record.metricRecordId}>
                    <td>{record.metricId}</td>
                    <td>
                      {record.availability === "available" && record.value !== null
                        ? n(record.value, { maximumFractionDigits: 6 })
                        : t("pipeline.workflow.unavailable")}
                    </td>
                    <td>{record.unit}</td>
                    <td>
                      {record.bandCenterHz === null
                        ? "—"
                        : n(record.bandCenterHz, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {(workflow.steps.length > 0 || workflow.baseline) && (
        <details className="pipeline-evidence">
          <summary>{t("pipeline.workflow.details")}</summary>
          <dl className="pipeline-provenance">
            {workflow.baseline && (
              <>
                <dt>{t("pipeline.workflow.baseline")}</dt>
                <dd>
                  <code>{workflow.baseline.runId}</code>
                </dd>
              </>
            )}
            {workflow.candidate && (
              <>
                <dt>{t("pipeline.workflow.candidate")}</dt>
                <dd>
                  <code>{workflow.candidate.runId}</code>
                </dd>
              </>
            )}
          </dl>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("pipeline.workflow.tool")}</th>
                  <th scope="col">{t("pipeline.workflow.result")}</th>
                  <th scope="col">{t("pipeline.workflow.recording")}</th>
                </tr>
              </thead>
              <tbody>
                {workflow.steps.map((step) => (
                  <tr key={step.request.requestId}>
                    <td>{step.request.tool}</td>
                    <td>
                      {stepStatus[step.result.state]
                        ? t(stepStatus[step.result.state]!)
                        : step.result.state}
                    </td>
                    <td>
                      <code>{step.result.runId ?? "—"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {workflow.explanation && (
            <details className="pipeline-evidence">
              <summary>{t("pipeline.workflow.rawEvidence")}</summary>
              <pre>{workflow.explanation.text}</pre>
            </details>
          )}
          {workflow.explanation && (
            <ul className="pipeline-citations">
              {workflow.explanation.citations.map((citation) => (
                <li key={citation.metricRecordId}>
                  <code>{citation.metricRecordId}</code> ·{" "}
                  <code>{citation.evidenceArtifactId}</code>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  );
}
