import { useRef, useState } from "react";
import type { LabController, LabViewModel, PrimitiveShape } from "./contracts.js";
import { Badge, Icon } from "./components.js";
import { useLocale, type MessageKey } from "./locale.js";

const primitives: { shape: PrimitiveShape; labelKey: MessageKey }[] = [
  { shape: "box", labelKey: "explorer.primitive.box" },
  { shape: "sphere", labelKey: "explorer.primitive.sphere" },
  { shape: "capsule", labelKey: "explorer.primitive.capsule" },
];
export function SceneExplorer({
  controller,
  model,
  onListener,
}: {
  controller: LabController;
  model: LabViewModel;
  onListener: () => void;
}) {
  const { t, n, message } = useLocale();
  const [query, setQuery] = useState("");
  const [rights, setRights] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const matching = model.objects.filter((object) =>
    `${object.name ?? ""} ${object.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const canEdit = model.simulationState !== "running" && model.recording.state !== "replaying";
  return (
    <aside className="scene-explorer" aria-label={t("explorer.region")}>
      <header className="panel-header">
        <h2>{t("explorer.scene")}</h2>
        <span className="count-label">
          {t("explorer.objectCount", { count: n(model.objects.length) })}
        </span>
      </header>
      <label className="search-field">
        <Icon name="search" />
        <input
          aria-label={t("explorer.searchLabel")}
          placeholder={t("explorer.searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="explorer-title">
        <span>{t("explorer.library")}</span>
        <span className="subtle">{t("explorer.primitives")}</span>
      </div>
      <div className="primitive-library">
        {primitives.map(({ shape, labelKey }) => (
          <button
            key={shape}
            type="button"
            disabled={!canEdit}
            title={
              canEdit
                ? t("explorer.addPrimitive", { shape: t(labelKey) })
                : t("explorer.pauseBeforeAdd")
            }
            onClick={() => void controller.dispatch({ type: "addObject", shape })}
          >
            <Icon name={shape} size={22} />
            <span>{t(labelKey)}</span>
            <span className="primitive-plus">+</span>
          </button>
        ))}
      </div>
      <div className="explorer-title">
        <span>{t("explorer.sceneObjects")}</span>
        <Icon name="layers" size={14} />
      </div>
      <ul className="object-list" aria-label={t("explorer.objectList")}>
        {matching.map((object) => (
          <li key={object.id}>
            <button
              type="button"
              className={
                model.selectedObjectId === object.id ? "object-row selected" : "object-row"
              }
              aria-pressed={model.selectedObjectId === object.id}
              onClick={() =>
                void controller.dispatch({ type: "selectObject", objectId: object.id })
              }
            >
              <span className={`object-symbol mode-${object.mode}`}>
                <Icon name={object.shape} />
              </span>
              <span className="object-row-copy">
                <span title={object.id}>{object.name ?? object.id}</span>
              </span>
              <span className="object-mode" title={object.mode}>
                {object.held
                  ? t("explorer.mode.held")
                  : object.mode === "fixed"
                    ? t("explorer.mode.fixed")
                    : object.mode === "dynamicNoGravity"
                      ? "0 g"
                      : object.mode === "kinematic"
                        ? t("explorer.mode.kinematic")
                        : t("explorer.mode.dynamic")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {matching.length === 0 && (
        <div className="empty-state compact">
          {query ? t("explorer.noMatches") : t("explorer.addFirst")}
        </div>
      )}
      <button type="button" className="listener-row" onClick={onListener}>
        <Icon name="listener" />
        <span>
          {t("explorer.listenerEnvironment")}
          <span className="subtle">{model.listener.id}</span>
        </span>
        <Badge>
          {model.listener.attachment === "fpsHead"
            ? t("explorer.listenerFollowsFps")
            : t("explorer.listenerIndependent")}
        </Badge>
      </button>
      <div className="asset-library">
        <div className="explorer-title">
          <span>{t("explorer.soundAssets")}</span>
          <span className="subtle">{n(model.assets.length)}</span>
        </div>
        {model.assets.length === 0 && (
          <div className="empty-state compact">{t("explorer.noAssets")}</div>
        )}
        <ul className="asset-list">
          {model.assets.map((asset) => (
            <li key={asset.id}>
              <div>
                <span>{asset.name}</span>
                <details className="asset-details">
                  <summary>{t("explorer.assetDetails")}</summary>
                  <small>{asset.provenance}</small>
                </details>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={t("explorer.auditionLabel", { name: asset.name })}
                title={t("explorer.auditionTitle")}
                disabled={asset.status !== "ready" || model.simulationState === "running"}
                onClick={() => void controller.dispatch({ type: "audition", assetId: asset.id })}
              >
                <Icon name="play" />
              </button>
            </li>
          ))}
        </ul>
        <details className="import-details">
          <summary>{t("explorer.importSound")}</summary>
          <label className="check-field rights-field">
            <input
              type="checkbox"
              checked={rights}
              onChange={(event) => setRights(event.target.checked)}
            />
            <span>{t("explorer.rightsConfirmation")}</span>
          </label>
          <input
            ref={fileInput}
            type="file"
            accept=".wav,audio/wav,audio/x-wav"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFileError("");
              void Promise.resolve(
                controller.dispatch({ type: "importAudio", file, rightsConfirmed: rights }),
              ).catch((error) =>
                setFileError(error instanceof Error ? error.message : String(error)),
              );
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="outline-button full-width"
            disabled={!rights || !canEdit}
            title={
              !rights
                ? t("explorer.confirmRightsFirst")
                : !canEdit
                  ? t("explorer.pauseFirst")
                  : t("explorer.localDecode")
            }
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="upload" />
            {t("explorer.importSound")}
          </button>
          <p className="micro-copy">{t("explorer.importHelp")}</p>
        </details>
        {fileError && (
          <p className="inline-error" role="alert">
            {message(fileError)}
          </p>
        )}
      </div>
      <div className="explorer-footnote">
        <Icon name="info" size={14} />
        <span>
          {t("explorer.sceneUnits")}
          <br />
          {t("explorer.gravityAndMedium")}
        </span>
      </div>
    </aside>
  );
}
