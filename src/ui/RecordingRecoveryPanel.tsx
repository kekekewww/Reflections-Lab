import { useEffect, useId, useRef, useState } from "react";
import type { LabController } from "./contracts.js";
import type { Locale } from "./locale-types.js";
import { formatMessage, translate } from "./locale-model.js";
import { Badge } from "./components.js";
import { recordingRecoveryActions, type RecordingRecoveryEntryView } from "./recovery-contracts.js";

export function RecordingRecoveryPanel({
  controller,
  locale,
  active = true,
}: {
  controller: LabController;
  locale: Locale;
  active?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<readonly RecordingRecoveryEntryView[] | null>(null);
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
  const list = controller.listRecordingRecovery;
  const recover = controller.recoverRecording;
  const discard = controller.discardRecordingRecovery;
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate(locale, key, params);
  useEffect(() => {
    generation.current++;
    operation.current = false;
    setPending(null);
    setEntries(null);
    setError(null);
    setNotice(null);
    setConfirmId(null);
    focusAfterPending.current = false;
    return () => {
      generation.current++;
    };
  }, [controller]);
  useEffect(() => {
    if (!pending && active && focusAfterPending.current) {
      focusAfterPending.current = false;
      refreshButton.current?.focus();
    }
  }, [pending, active]);
  const perform = async (
    id: string,
    action: () => Promise<void>,
    success?: { key: Parameters<typeof translate>[1]; id: string },
  ) => {
    if (operation.current || !active || !list) return;
    operation.current = true;
    const current = generation.current;
    setPending(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      const next = await list.call(controller);
      if (current !== generation.current) return;
      setEntries(next);
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
        setPending(null);
      }
    }
  };
  useEffect(() => {
    if (expanded && active && list) void perform("refresh", async () => {});
    // A new expansion/controller/active epoch deliberately starts one scan.
  }, [expanded, active, controller]);
  if (!list || !recover || !discard) return null;
  return (
    <details
      className="pipeline-evidence recovery-panel"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{t("pipeline.recovery.title")}</summary>
      <p className="field-message">{t("pipeline.recovery.help")}</p>
      <div className="dock-toolbar">
        <button
          ref={refreshButton}
          type="button"
          disabled={Boolean(pending)}
          aria-busy={pending === "refresh"}
          onClick={() => void perform("refresh", async () => {})}
        >
          {t("pipeline.recovery.refresh")}
        </button>
        {pending && <span role="status">{t("pipeline.archive.pending")}</span>}
      </div>
      {error && (
        <p className="field-message" role="alert">
          {formatMessage(locale, error)}
        </p>
      )}
      {notice && (
        <p className="field-message" role="status">
          {t(notice.key, { id: notice.id })}
        </p>
      )}
      {entries?.length === 0 && <p className="empty-state">{t("pipeline.recovery.empty")}</p>}
      {entries && entries.length > 0 && (
        <ul className="recovery-list">
          {entries.map((entry) => {
            const permission = recordingRecoveryActions(entry);
            const confirming = confirmId === entry.sessionId;
            const entryMessageId = `${confirmationId}-${entry.sessionId}`;
            return (
              <li key={entry.sessionId}>
                <div className="panel-heading">
                  <strong className="recovery-identity">{entry.sessionId}</strong>
                  <Badge kind="warning">
                    {t(
                      permission.activeLease
                        ? "pipeline.archive.writing"
                        : "pipeline.archive.interrupted",
                    )}
                  </Badge>
                </div>
                <p className="field-message recovery-identity">
                  {entry.runId} · {entry.runEpoch} · r{entry.sceneRevision}
                </p>
                <p className="field-message">
                  {t("pipeline.recovery.prefix", {
                    frames: entry.persistedFrames,
                    tick: entry.persistedTick ?? t("pipeline.recovery.noTick"),
                    bytes: (entry.reservedBytes / 1024 / 1024).toFixed(2),
                  })}
                </p>
                {permission.activeLease && (
                  <p className="field-message">{t("pipeline.recovery.active")}</p>
                )}
                {!permission.activeLease &&
                  (!entry.canDiscard || (entry.persistedFrames > 0 && !entry.canRecover)) && (
                    <p className="field-message">
                      {formatMessage(
                        locale,
                        "RECOVERY_UNSAFE：請先暫停，並結束錄製、重播與其他操作。",
                      )}
                    </p>
                  )}
                {!permission.activeLease && entry.persistedFrames === 0 && (
                  <p className="field-message">{t("pipeline.recovery.emptyPrefix")}</p>
                )}
                {entry.reason && (
                  <p className="field-message">{formatMessage(locale, entry.reason)}</p>
                )}
                <div className="dock-toolbar">
                  <button
                    type="button"
                    disabled={Boolean(pending) || !permission.canRecover}
                    aria-label={`${t("pipeline.recovery.load")} ${entry.sessionId}`}
                    onClick={() =>
                      void perform(
                        entry.sessionId,
                        () => recover.call(controller, entry.sessionId),
                        { key: "pipeline.recovery.loaded", id: entry.sessionId },
                      )
                    }
                  >
                    {t("pipeline.recovery.load")}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(pending) || !permission.canDiscard}
                    aria-label={`${t("pipeline.recovery.discard")} ${entry.sessionId}`}
                    aria-expanded={confirming}
                    aria-describedby={confirming ? entryMessageId : undefined}
                    onClick={() => setConfirmId(entry.sessionId)}
                  >
                    {t("pipeline.recovery.discard")}
                  </button>
                </div>
                {confirming && (
                  <div className="recovery-confirmation">
                    <p id={entryMessageId} className="field-message">
                      {t("pipeline.recovery.confirmDiscard", { id: entry.sessionId })}
                    </p>
                    <div className="dock-toolbar">
                      <button
                        type="button"
                        disabled={Boolean(pending) || !permission.canDiscard}
                        aria-describedby={entryMessageId}
                        onClick={() =>
                          void perform(
                            entry.sessionId,
                            () => discard.call(controller, entry.sessionId),
                            { key: "pipeline.archive.deleted", id: entry.sessionId },
                          )
                        }
                      >
                        {t("pipeline.archive.confirm")}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(pending)}
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
