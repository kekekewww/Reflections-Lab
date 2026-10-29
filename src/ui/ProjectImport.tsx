import { useRef, useState } from "react";
import { MAX_PROJECT_BYTES } from "../persistence/validate-project.js";
import type { LabController } from "./contracts.js";
import { Icon } from "./components.js";
import { useLocale } from "./locale.js";

interface ImportDraft {
  name: string;
  bytes: number;
  text: string;
  projectName: string | null;
  sceneRevision: string | null;
  objectCount: number | null;
  assetCount: number | null;
  recordingCount: number | null;
}

/** File review is local and bounded; only explicit Apply reaches the domain importer. */
export function ProjectImportButton({
  controller,
  disabled,
}: {
  controller: LabController;
  disabled: boolean;
}) {
  const { t, n, message } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const requestVersion = useRef(0);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const errorText = (raw: string) => {
    if (raw === "SIZE_LIMIT：專案 JSON 超過 8 MiB。") return t("projectImport.errorSize");
    if (raw === "PROJECT_INVALID：專案根資料必須是 JSON 物件。")
      return t("projectImport.errorRoot");
    if (raw === "無法讀取專案 JSON。") return t("projectImport.errorRead");
    if (raw === "專案匯入失敗；原草稿保留。") return t("projectImport.errorApply");
    return message(raw);
  };
  const count = (value: number | null) =>
    value === null ? t("projectImport.unavailable") : n(value, { maximumFractionDigits: 0 });
  const reset = () => {
    requestVersion.current += 1;
    setDraft(null);
    setPending(false);
    setApplying(false);
    setError("");
  };
  const read = async (file: File) => {
    const version = ++requestVersion.current;
    setDraft(null);
    setError("");
    setPending(true);
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error("SIZE_LIMIT：專案 JSON 超過 8 MiB。");
      const text = await file.text();
      const value = JSON.parse(text) as Record<string, unknown>;
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("PROJECT_INVALID：專案根資料必須是 JSON 物件。");
      const scene =
        value.scene && typeof value.scene === "object" && !Array.isArray(value.scene)
          ? (value.scene as Record<string, unknown>)
          : {};
      if (version !== requestVersion.current) return;
      setDraft({
        name: file.name,
        bytes: file.size,
        text,
        projectName: typeof value.name === "string" ? value.name.slice(0, 256) : null,
        sceneRevision: typeof scene.sceneRevision === "number" ? String(scene.sceneRevision) : null,
        objectCount: Array.isArray(scene.objects) ? scene.objects.length : null,
        assetCount: Array.isArray(value.assets) ? value.assets.length : null,
        recordingCount: Array.isArray(value.recordings) ? value.recordings.length : null,
      });
    } catch (cause) {
      if (version === requestVersion.current)
        setError(cause instanceof Error ? cause.message : "無法讀取專案 JSON。");
    } finally {
      if (version === requestVersion.current) setPending(false);
    }
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button"
        disabled={disabled}
        title={t(disabled ? "projectImport.pauseFirst" : "projectImport.reviewFirst")}
        aria-label={t("projectImport.title")}
        onClick={() => {
          reset();
          dialog.current?.showModal();
        }}
      >
        <Icon name="upload" />
      </button>
      <dialog
        ref={dialog}
        className="project-import-dialog"
        aria-labelledby="project-import-title"
        onCancel={(event) => {
          if (applying) event.preventDefault();
          else reset();
        }}
        onClose={() => {
          reset();
          trigger.current?.focus();
        }}
      >
        <h2 id="project-import-title">{t("projectImport.title")}</h2>
        <p className="section-copy">{t("projectImport.introduction")}</p>
        <label className="select-field">
          <span>{t("projectImport.fileLimit")}</span>
          <input
            type="file"
            accept=".json,application/json"
            aria-label={t("projectImport.selectFile")}
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void read(file);
              event.target.value = "";
            }}
          />
        </label>
        {pending && (
          <p role="status">{t(applying ? "projectImport.applying" : "projectImport.reading")}</p>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {errorText(error)}
          </p>
        )}
        {draft && (
          <section className="project-import-review" aria-label={t("projectImport.preview")}>
            <dl className="project-import-summary">
              <dt>{t("projectImport.localFile")}</dt>
              <dd>
                {t("projectImport.fileSummary", {
                  name: draft.name,
                  bytes: n(draft.bytes, { maximumFractionDigits: 0 }),
                })}
              </dd>
              <dt>{t("projectImport.projectName")}</dt>
              <dd>{draft.projectName ?? t("projectImport.notProvided")}</dd>
              <dt>{t("projectImport.sceneRevision")}</dt>
              <dd>{draft.sceneRevision ?? t("projectImport.notProvided")}</dd>
              <dt>{t("projectImport.contentSummary")}</dt>
              <dd>
                {t("projectImport.counts", {
                  objects: count(draft.objectCount),
                  assets: count(draft.assetCount),
                  recordings: count(draft.recordingCount),
                })}
              </dd>
            </dl>
            <p className="micro-copy">{t("projectImport.validationHelp")}</p>
            <details>
              <summary>{t("projectImport.inspectJson")}</summary>
              <pre tabIndex={0}>{draft.text.slice(0, 6000)}</pre>
            </details>
          </section>
        )}
        <div className="button-group project-import-actions">
          <button
            type="button"
            className="outline-button"
            disabled={applying}
            onClick={() => dialog.current?.close()}
          >
            {t("projectImport.cancel")}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!draft || pending}
            onClick={async () => {
              if (!draft || pending) return;
              setPending(true);
              setApplying(true);
              setError("");
              try {
                await controller.dispatch({ type: "importProject", text: draft.text });
                const failure = controller.getSnapshot().error;
                if (failure) setError(failure);
                else dialog.current?.close();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "專案匯入失敗；原草稿保留。");
              } finally {
                setPending(false);
                setApplying(false);
              }
            }}
          >
            {t("projectImport.apply")}
          </button>
        </div>
      </dialog>
    </>
  );
}
