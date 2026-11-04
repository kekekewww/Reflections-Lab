import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { RenderHost } from "../app/render-host.js";
import type { Locale } from "./locale-types.js";
import { Badge, Icon, NumberField } from "./components.js";
import { HelpTip } from "./HelpTip.js";
import { formatMessage, translate } from "./locale-model.js";
import { archiveRemovalActions } from "./recovery-contracts.js";

function renderErrorText(locale: Locale, raw: string | null): string {
  if (
    raw === "RENDER_STORE_LOCKS_UNAVAILABLE" ||
    raw?.includes(
      "Web Locks API is unavailable; another render writer cannot safely be classified as inactive.",
    )
  )
    return translate(locale, "pipeline.archive.ownershipUnavailable");
  return formatMessage(locale, raw);
}

export interface RenderPanelProps {
  host: RenderHost;
  locale: Locale;
  onCaptureShortTake?: (durationSeconds: number) => Promise<void>;
  active?: boolean;
}

/** Uses the existing dock, button, field and tooltip language; no independent token set. */
export function RenderPanel({ host, locale, onCaptureShortTake, active = true }: RenderPanelProps) {
  const view = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const [duration, setDuration] = useState(3);
  const [durationDraftValid, setDurationDraftValid] = useState(true);
  const durationValidity = useRef(true);
  const durationMessageId = useId();
  const onDurationDraftValidityChange = useCallback((valid: boolean) => {
    durationValidity.current = valid;
    setDurationDraftValid(valid);
  }, []);
  const durationInvalidReason = useCallback(
    (value: number) =>
      Number.isInteger(value) ? undefined : translate(locale, "pipeline.capture.integer"),
    [locale],
  );
  const [tail, setTail] = useState(2);
  const [tailDraftValid, setTailDraftValid] = useState(true);
  const tailValidity = useRef(true);
  const tailMessageId = useId();
  const onTailDraftValidityChange = useCallback((valid: boolean) => {
    tailValidity.current = valid;
    setTailDraftValid(valid);
  }, []);
  const [stems, setStems] = useState(true);
  const [capturePending, setCapturePending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const archiveOperation = useRef(false);
  const onArchivePendingChange = useCallback((pending: boolean) => {
    archiveOperation.current = pending;
    setArchivePending(pending);
  }, []);
  const [localError, setLocalError] = useState<string | null>(null);
  const zh = locale === "zh-TW";
  const primaryBusy = view.state === "rendering" || capturePending;
  const busy = primaryBusy || archivePending;
  useEffect(() => {
    if (!active) return;
    host.refresh();
    const timer = setInterval(host.refresh, 500);
    return () => clearInterval(timer);
  }, [host, active]);
  const invoke = async (action: () => Promise<unknown>): Promise<void> => {
    setLocalError(null);
    try {
      await action();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
    host.refresh();
  };
  const names: Record<string, string> = {
    mix: zh ? "傳播後混音（Wet）" : "Propagated mix (wet)",
    master: zh ? "主輸出" : "Master output",
    dry: zh ? "原始內容（Dry）" : "Dry content",
  };
  return (
    <section className="render-panel" aria-label={zh ? "音訊匯出" : "Audio export"}>
      <div className="panel-heading">
        <div className="help-heading">
          <h3>{zh ? "音訊匯出" : "Audio export"}</h3>
          <HelpTip
            topic={zh ? "音訊匯出" : "Audio export"}
            content={
              zh
                ? "使用完整錄製的原始聲音決策、聲學路徑與素材，離線產生最多60秒片段及設定尾響的浮點WAV。每個輸出使用完整的離線音訊處理，再分塊編碼與保存；容量有上限。Wet包含直接聲、早期反射與已設定的尾響；各聲源分軌為主處理前輸出。"
                : "Render a complete take of up to 60 seconds plus its configured tail from captured sound decisions, acoustic paths and pinned assets. Each output uses a complete offline audio render, followed by chunked encoding and storage within capacity limits. Wet includes direct, early and configured late sound. Source stems are pre-master."
            }
          />
        </div>
        <Badge kind={view.state === "completed" ? "success" : busy ? "accent" : "neutral"}>
          {capturePending
            ? zh
              ? "錄製中"
              : "Capturing"
            : view.state === "rendering"
              ? `${view.completedOutputs}/${view.totalOutputs}`
              : view.state === "completed"
                ? zh
                  ? "可下載"
                  : "Ready"
                : zh
                  ? "離線WAV"
                  : "Offline WAV"}
        </Badge>
      </div>
      <div className="dock-toolbar">
        {onCaptureShortTake && (
          <button
            type="button"
            disabled={busy || !durationDraftValid}
            aria-busy={capturePending}
            aria-describedby={!durationDraftValid ? durationMessageId : undefined}
            onClick={() => {
              if (!durationValidity.current || archiveOperation.current) return;
              void invoke(async () => {
                setCapturePending(true);
                try {
                  await onCaptureShortTake(duration);
                } finally {
                  setCapturePending(false);
                }
              });
            }}
          >
            <Icon name="record" />
            {zh
              ? `錄製${duration}秒`
              : `Capture ${duration} ${duration === 1 ? "second" : "seconds"}`}
          </button>
        )}
        <button
          type="button"
          className="primary-button"
          disabled={busy || !view.recordingAvailable || !tailDraftValid}
          aria-describedby={tailDraftValid ? undefined : tailMessageId}
          onClick={() => {
            if (!tailValidity.current || archiveOperation.current) return;
            void invoke(() => host.renderPreset({ includeSourceStems: stems, tailSeconds: tail }));
          }}
        >
          <Icon name="layers" />
          {zh ? "產生音檔" : "Render audio files"}
        </button>
        {view.state === "rendering" && (
          <button type="button" onClick={() => void invoke(() => host.cancel())}>
            {zh ? "取消" : "Cancel"}
          </button>
        )}
      </div>
      {archivePending && (
        <p className="field-message" role="status">
          {translate(locale, "pipeline.archive.busy")}
        </p>
      )}
      {onCaptureShortTake && (
        <>
          <div className="help-heading">
            <NumberField
              label={translate(locale, "pipeline.capture.duration")}
              unit="s"
              value={duration}
              min={1}
              max={60}
              step={1}
              disabled={busy}
              invalidReason={durationInvalidReason}
              onCommit={setDuration}
              onDraftValidityChange={onDurationDraftValidityChange}
            />
            <HelpTip
              topic={translate(locale, "pipeline.capture.duration")}
              content={translate(locale, "pipeline.capture.help")}
            />
          </div>
          {!durationDraftValid && (
            <p className="field-message" id={durationMessageId} role="status">
              {translate(locale, "pipeline.capture.invalid")}
            </p>
          )}
          {capturePending && (
            <p className="field-message" role="status">
              {translate(locale, "pipeline.capture.pause")}
            </p>
          )}
        </>
      )}
      <div className="two-fields">
        <NumberField
          label={zh ? "保留尾響" : "Tail"}
          unit="s"
          value={tail}
          min={0}
          max={10}
          step={0.5}
          disabled={busy}
          onCommit={setTail}
          onDraftValidityChange={onTailDraftValidityChange}
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={stems}
            disabled={busy}
            onChange={(event) => setStems(event.target.checked)}
          />
          {zh ? "各聲源分軌" : "Source stems"}
        </label>
      </div>
      {!tailDraftValid && (
        <p className="field-message" id={tailMessageId} role="status">
          {zh
            ? "請修正保留尾響，或按 Esc 還原後再產生音檔。"
            : "Correct Tail or press Escape to restore the committed value before rendering."}
        </p>
      )}
      {!view.recordingAvailable && !capturePending && (
        <p className="empty-state">
          {zh ? "先錄製一段完整片段。" : "Capture a complete take first."}
        </p>
      )}
      {(localError || view.error) && (
        <p role="alert" className="field-message">
          {renderErrorText(locale, localError || view.error)}
        </p>
      )}
      {view.state === "rendering" && (
        <progress
          aria-label={zh ? "產生音檔進度" : "Render progress"}
          value={view.completedOutputs}
          max={Math.max(1, view.totalOutputs)}
        />
      )}
      {view.outputs.length > 0 && (
        <ul className="render-output-list">
          {view.outputs.map((output) => (
            <li key={output.id}>
              <button
                type="button"
                disabled={view.downloadingOutputId !== null}
                aria-busy={view.downloadingOutputId === output.id}
                onClick={() => void invoke(() => host.downloadAsync(output.id))}
                aria-label={`${zh ? "下載" : "Download"} ${output.id}`}
              >
                <Icon name="download" />
                {names[output.id] ??
                  (zh
                    ? `分軌 ${output.id.replace(/^stem-[a-f0-9]{12}-/, "")}`
                    : `Stem ${output.id.replace(/^stem-[a-f0-9]{12}-/, "")}`)}
              </button>
              <span className="field-unit">{(output.bytes / 1024 / 1024).toFixed(2)} MB</span>
              {(output.tailTruncated || output.historyIncomplete) && (
                <Badge kind="warning">{zh ? "邊界限制" : "Boundary limit"}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {view.outputs.length > 0 && (
        <button type="button" onClick={() => void invoke(async () => host.downloadManifest())}>
          <Icon name="download" />
          {zh ? "下載來源與雜湊清單" : "Download provenance manifest"}
        </button>
      )}
      <RenderArchivePanel
        host={host}
        locale={locale}
        active={active}
        busy={primaryBusy}
        onPendingChange={onArchivePendingChange}
      />
    </section>
  );
}

type ArchiveEntries = Awaited<ReturnType<RenderHost["listArchive"]>>;
type ArchiveUsage = Awaited<ReturnType<RenderHost["getArchiveUsage"]>>;

function RenderArchivePanel({
  host,
  locale,
  active,
  busy,
  onPendingChange,
}: {
  host: RenderHost;
  locale: Locale;
  active: boolean;
  busy: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const view = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<ArchiveEntries | null>(null);
  const [usage, setUsage] = useState<ArchiveUsage | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: Parameters<typeof translate>[1]; id: string } | null>(
    null,
  );
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const operation = useRef(false);
  const generation = useRef(0);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const focusAfterPending = useRef(false);
  const confirmationId = useId();
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate(locale, key, params);
  const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
  useEffect(() => {
    generation.current++;
    operation.current = false;
    setPending(null);
    setEntries(null);
    setError(null);
    setNotice(null);
    setConfirmId(null);
    focusAfterPending.current = false;
    setUsage(null);
    onPendingChange(false);
    return () => {
      generation.current++;
    };
  }, [host, onPendingChange]);
  useEffect(() => {
    if (!pending && !busy && active && focusAfterPending.current) {
      focusAfterPending.current = false;
      refreshButton.current?.focus();
    }
  }, [pending, busy, active]);
  const perform = async (
    id: string,
    action: () => Promise<unknown>,
    success?: { key: Parameters<typeof translate>[1]; id: string },
  ) => {
    if (operation.current || !active) return;
    operation.current = true;
    onPendingChange(true);
    const current = generation.current;
    setPending(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      const [next, nextUsage] = await Promise.all([host.listArchive(), host.getArchiveUsage()]);
      if (current !== generation.current) return;
      setEntries(next);
      setUsage(nextUsage);
      setConfirmId(null);
      if (success) {
        setNotice(success);
        focusAfterPending.current = true;
      }
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (current === generation.current) {
        operation.current = false;
        onPendingChange(false);
        setPending(null);
      }
    }
  };
  useEffect(() => {
    if (expanded && active)
      void perform("refresh", () => (busy ? Promise.resolve() : host.recoverArchive()));
    // Re-scan when a render settles so new outputs appear in the archive.
  }, [expanded, active, busy, host]);
  const locked = busy || Boolean(pending) || view.downloadingOutputId !== null;
  return (
    <details
      className="pipeline-evidence recovery-panel"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{t("pipeline.archive.title")}</summary>
      <div className="dock-toolbar">
        <button
          ref={refreshButton}
          type="button"
          disabled={locked}
          aria-busy={pending === "refresh"}
          onClick={() => void perform("refresh", () => host.recoverArchive())}
        >
          {t("pipeline.archive.check")}
        </button>
        {pending && <span role="status">{t("pipeline.archive.pending")}</span>}
      </div>
      {usage && (
        <>
          <p className="field-message">
            {t("pipeline.archive.usage", {
              payload: mib(usage.payloadBytes),
              reserved: mib(usage.reservedBytes),
              charged: mib(usage.chargedBytes),
              cap: mib(usage.maxBytes),
              jobs: usage.jobs,
              maxJobs: usage.maxJobs,
            })}
          </p>
          <p className="field-message">
            {t("pipeline.archive.limits", {
              wav: mib(usage.maxJobEncodedBytes),
              manifest: mib(usage.maxManifestBytes),
            })}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="field-message">
          {renderErrorText(locale, error)}
        </p>
      )}
      {notice && (
        <p role="status" className="field-message">
          {t(notice.key, { id: notice.id })}
        </p>
      )}
      {entries === null && pending && (
        <p className="field-message">{t("pipeline.archive.loading")}</p>
      )}
      {entries?.length === 0 && <p className="empty-state">{t("pipeline.archive.empty")}</p>}
      {entries && entries.length > 0 && (
        <ul className="recovery-list">
          {entries.map((entry) => {
            const published = entry.status === "published";
            const interrupted = entry.status === "interrupted";
            const removal = archiveRemovalActions(entry);
            const restrictionId = `${confirmationId}-${entry.jobId}-restriction`;
            const confirming = entry.jobId === confirmId;
            const entryMessageId = `${confirmationId}-${entry.jobId}`;
            return (
              <li key={entry.jobId}>
                <div className="panel-heading">
                  <strong className="recovery-identity">{entry.jobId}</strong>
                  <Badge kind={published ? "success" : "warning"}>
                    {t(
                      published
                        ? "pipeline.archive.published"
                        : interrupted
                          ? "pipeline.archive.interrupted"
                          : "pipeline.archive.writing",
                    )}
                  </Badge>
                  <span className="field-unit">{mib(entry.bytes)} MiB</span>
                </div>
                {published && (
                  <>
                    <ul className="render-output-list">
                      {entry.outputs.map((output) => (
                        <li key={output.id}>
                          <button
                            type="button"
                            disabled={locked}
                            aria-busy={view.downloadingOutputId === `${entry.jobId}:${output.id}`}
                            aria-label={`${t("pipeline.archive.download", { id: output.id })} · ${entry.jobId}`}
                            onClick={() =>
                              void perform(`${entry.jobId}:${output.id}`, () =>
                                host.downloadArchivedOutput(entry.jobId, output.id),
                              )
                            }
                          >
                            <Icon name="download" />
                            {t("pipeline.archive.download", { id: output.id })}
                          </button>
                          <span className="field-unit">{mib(output.bytes)} MiB</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={locked}
                      aria-label={`${t("pipeline.archive.manifest")} · ${entry.jobId}`}
                      onClick={() =>
                        void perform(`${entry.jobId}:manifest`, () =>
                          host.downloadArchivedManifest(entry.jobId),
                        )
                      }
                    >
                      <Icon name="download" />
                      {t("pipeline.archive.manifest")}
                    </button>
                  </>
                )}
                {removal.reason && (
                  <p id={restrictionId} className="field-message">
                    {t(
                      removal.reason === "activeWriter"
                        ? "pipeline.archive.activeWriter"
                        : "pipeline.archive.needsRecovery",
                    )}
                  </p>
                )}
                <div className="dock-toolbar">
                  <button
                    type="button"
                    disabled={locked || !removal.canRemove}
                    aria-expanded={confirming}
                    aria-label={`${t(published ? "pipeline.archive.delete" : "pipeline.archive.discard")} ${entry.jobId}`}
                    aria-describedby={
                      removal.reason ? restrictionId : confirming ? entryMessageId : undefined
                    }
                    onClick={() => {
                      if (!removal.canRemove) return;
                      setConfirmId(entry.jobId);
                    }}
                  >
                    {t(published ? "pipeline.archive.delete" : "pipeline.archive.discard")}
                  </button>
                </div>
                {confirming && removal.canRemove && (
                  <div className="recovery-confirmation">
                    <p id={entryMessageId} className="field-message">
                      {t(
                        published
                          ? "pipeline.archive.confirmDelete"
                          : "pipeline.archive.confirmDiscard",
                        { id: entry.jobId },
                      )}
                    </p>
                    <div className="dock-toolbar">
                      <button
                        type="button"
                        disabled={locked || !removal.canRemove}
                        aria-describedby={entryMessageId}
                        onClick={() => {
                          if (!removal.canRemove) return;
                          void perform(
                            entry.jobId,
                            () =>
                              published
                                ? host.deleteArchivedJob(entry.jobId)
                                : host.discardInterruptedJob(entry.jobId),
                            { key: "pipeline.archive.deleted", id: entry.jobId },
                          );
                        }}
                      >
                        {t("pipeline.archive.confirm")}
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          setConfirmId(null);
                          refreshButton.current?.focus();
                        }}
                      >
                        {t("pipeline.archive.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
