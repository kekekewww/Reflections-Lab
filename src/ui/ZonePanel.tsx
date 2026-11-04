import { useId, useRef, useState } from "react";
import type { SceneZone } from "../scene/types.js";
import { zoneRegistryPin } from "../app/zone-registry-pin.js";
import type { LabController, LabViewModel } from "./contracts.js";
import { Badge } from "./components.js";
import { HelpTip } from "./HelpTip.js";
import { useLocale } from "./locale.js";
import {
  createZoneDraft,
  zoneDraftError,
  zoneFromDraft,
  type ZoneDraft,
} from "./zone-panel-model.js";

const words = {
  "zh-TW": {
    title: "區域",
    add: "新增區域",
    edit: "編輯",
    remove: "刪除",
    save: "儲存區域",
    cancel: "取消草稿",
    enabled: "啟用",
    disabled: "停用",
    id: "區域 ID",
    name: "名稱",
    shape: "形狀",
    aabb: "軸對齊方盒",
    sphere: "球形",
    center: "中心位置",
    halfExtents: "半尺寸",
    radius: "半徑",
    hysteresis: "邊界遲滯",
    empty: "尚無區域",
    pending: "正在提交",
    stale: "場景已更新；請取消草稿後重新編輯。",
    pause: "先暫停運算、結束錄製或重播，並回到編輯器再編輯區域。",
    semantics:
      "Derived：以固定步完成後的物件中心判定區域進出，不是整個碰撞形狀的重疊。開始或重設後的第一個穩定固定步只建立基準；僅作固定步採樣，不作連續掃掠；單一步內快速穿越且兩端皆在外時不會產生事件。線框顯示名義範圍；實際進入使用內縮界，離開使用外擴界，避免邊界抖動。停用只停止進出偵測，既有區域中心錨點仍可使用。區域不碰撞、不改變聲學或剛體角色。聲源仍在物件上；明確選擇區域錨點時才位於區域中心。",
    limit: "最多 16 個靜態區域。",
    newName: "新區域",
    noAck: "未收到符合區域編輯的場景版本；草稿保留。",
    inUse: "先改選或移除引用此區域的規則：",
    idError:
      "ID 需以小寫字母開頭，只含小寫字母、數字、點、底線或連字號，最多 64 字；既有 ID 不可改。",
    nameError: "名稱需為 1–80 字。",
    duplicateError: "此區域 ID 已存在。",
    capacityError: "已達 16 個區域上限。",
    centerError: "中心各軸需為 −200 至 200 m 的有限數值。",
    extentError: "各半尺寸需為 0.05–50 m。",
    radiusError: "半徑需為 0.05–50 m。",
    hysteresisError: "遲滯需為 0–0.25 m，且小於最小半尺寸或半徑。",
    draftGuard: "先儲存或取消目前草稿。",
  },
  en: {
    title: "Zones",
    add: "Add zone",
    edit: "Edit",
    remove: "Delete",
    save: "Save zone",
    cancel: "Cancel draft",
    enabled: "Enabled",
    disabled: "Disabled",
    id: "Zone ID",
    name: "Name",
    shape: "Shape",
    aabb: "Axis-aligned box",
    sphere: "Sphere",
    center: "Center",
    halfExtents: "Half extents",
    radius: "Radius",
    hysteresis: "Boundary hysteresis",
    empty: "No zones yet",
    pending: "Submitting",
    stale: "The scene changed; cancel the draft and edit again.",
    pause:
      "Pause simulation, finish recording or replay, and return to the editor before editing zones.",
    semantics:
      "Derived: crossings use the object's center after a fixed step, not whole-collider overlap. The first stable completed step after start or reset establishes a baseline. This is fixed-step sampling, not a continuous sweep; a fast passage whose sampled endpoints are both outside produces no crossing event. Wireframes show the nominal volume; actual entry uses a contracted boundary and exit uses an expanded boundary to avoid chatter. Disabling only stops occupancy detection; an explicitly authored zone-center anchor remains available. Zones neither collide nor change acoustic or rigid-body roles. Sound remains attached to the object unless the author explicitly selects the zone-center anchor.",
    limit: "Up to 16 static zones.",
    newName: "New zone",
    noAck: "No matching scene revision acknowledged this zone edit; the draft is retained.",
    inUse: "Retarget or remove the rules referencing this zone first: ",
    idError:
      "Use a lowercase initial letter, then lowercase letters, digits, dots, underscores or hyphens, up to 64 characters. Existing IDs cannot change.",
    nameError: "Name must contain 1–80 characters.",
    duplicateError: "This zone ID already exists.",
    capacityError: "The limit of 16 zones has been reached.",
    centerError: "Each center coordinate must be finite and between −200 and 200 m.",
    extentError: "Each half extent must be 0.05–50 m.",
    radiusError: "Radius must be 0.05–50 m.",
    hysteresisError:
      "Hysteresis must be 0–0.25 m and smaller than the minimum half extent or radius.",
    draftGuard: "Save or cancel the current draft first.",
  },
} as const;

function sameZone(a: SceneZone, b: SceneZone): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.enabled === b.enabled &&
    a.shape === b.shape &&
    a.hysteresisM === b.hysteresisM &&
    a.centerM.every((value, i) => value === b.centerM[i]) &&
    (a.shape === "aabb" && b.shape === "aabb"
      ? a.halfExtentsM.every((value, i) => value === b.halfExtentsM[i])
      : a.shape === "sphere" && b.shape === "sphere" && a.radiusM === b.radiusM)
  );
}

/** Authoring stays in a local draft until a revision-guarded SceneCommand acknowledges it. */
export function ZonePanel({
  model,
  controller,
}: {
  model: LabViewModel;
  controller: LabController;
}) {
  const { locale, message } = useLocale(),
    copy = words[locale];
  const zones = model.zones ?? [];
  const registryPin = zoneRegistryPin(model.zones);
  const [draft, setDraft] = useState<ZoneDraft | null>(null);
  const [draftProject, setDraftProject] = useState<string | null>(null);
  const projectKey = model.projectId ?? model.projectName;
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState("");
  const errorId = useId();
  const canEdit =
    model.simulationState !== "running" &&
    model.recording.state !== "recording" &&
    model.recording.state !== "replaying" &&
    model.interactionMode === "editor";
  const stale =
    draft !== null &&
    (draft.sceneRevision !== model.sceneRevision ||
      draftProject !== projectKey ||
      draft.registryPin !== registryPin);
  const invalid = draft ? zoneDraftError(draft, zones) : null;
  const errorKeys = {
    id: "idError",
    name: "nameError",
    duplicate: "duplicateError",
    capacity: "capacityError",
    center: "centerError",
    extent: "extentError",
    radius: "radiusError",
    hysteresis: "hysteresisError",
  } as const;
  const errorText = invalid ? copy[errorKeys[invalid]] : "";
  const rawActionError = error || model.error || "";
  const actionError = rawActionError.startsWith("ZONE_EDIT_BLOCKED")
    ? copy.pause
    : rawActionError.startsWith("REVISION_CONFLICT")
      ? copy.stale
      : rawActionError.startsWith("ZONE_IN_USE")
        ? "ZONE_IN_USE: " +
          copy.inUse +
          (rawActionError.includes("規則：")
            ? rawActionError.slice(rawActionError.indexOf("規則：") + 3)
            : rawActionError)
        : message(rawActionError);
  const change = (patch: Partial<ZoneDraft>) =>
    setDraft((current) => (current ? { ...current, ...patch } : null));

  async function save(
    zone: SceneZone,
    expectedSceneRevision: number,
    expectedZoneRegistryPin: string,
    clearDraft: boolean,
  ) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      const before = controller.getSnapshot();
      if (
        before.sceneRevision !== expectedSceneRevision ||
        zoneRegistryPin(before.zones) !== expectedZoneRegistryPin ||
        (clearDraft && (before.projectId ?? before.projectName) !== draftProject)
      )
        throw new Error(copy.stale);
      await controller.dispatch({
        type: "saveZone",
        zone,
        expectedSceneRevision,
        expectedZoneRegistryPin,
      });
      const after = controller.getSnapshot(),
        saved = after.zones?.find((value) => value.id === zone.id);
      if (after.error) throw new Error(after.error);
      if (after.sceneRevision <= expectedSceneRevision || !saved || !sameZone(saved, zone))
        throw new Error(copy.noAck);
      if (clearDraft) setDraft(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function remove(zone: SceneZone) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      await controller.dispatch({
        type: "removeZone",
        zoneId: zone.id,
        expectedSceneRevision: model.sceneRevision,
        expectedZoneRegistryPin: registryPin,
      });
      const after = controller.getSnapshot();
      if (after.error) throw new Error(after.error);
      if (
        after.sceneRevision <= model.sceneRevision ||
        after.zones?.some((value) => value.id === zone.id)
      )
        throw new Error(copy.noAck);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function numeric(
    label: string,
    raw: string,
    min: number,
    max: number,
    update: (value: string) => void,
    invalidValue = false,
  ) {
    return (
      <label className={"number-field" + (invalidValue ? " field-error" : "")}>
        <span className="field-label">
          {label}
          <span className="field-unit">m</span>
        </span>
        <input
          type="number"
          value={raw}
          min={min}
          max={max}
          step="any"
          disabled={!canEdit || pending}
          aria-invalid={invalidValue}
          aria-describedby={invalidValue ? errorId : undefined}
          onChange={(event) => update(event.target.value)}
        />
      </label>
    );
  }

  function vector(
    label: string,
    field: "center" | "halfExtents",
    min: number,
    max: number,
    invalidValue: boolean,
  ) {
    if (!draft) return null;
    return (
      <fieldset className="vector-fields" disabled={!canEdit || pending}>
        <legend>
          {label} <span className="field-unit">m</span>
        </legend>
        <div className="axis-fields">
          {(["X", "Y", "Z"] as const).map((axis, index) => (
            <div key={axis}>
              {numeric(
                label + " " + axis,
                draft[field][index]!,
                min,
                max,
                (raw) => {
                  const next: [string, string, string] = [...draft[field]];
                  next[index] = raw;
                  change({ [field]: next });
                },
                invalidValue,
              )}
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <section className="dock-panel pipeline-panel zone-panel" aria-label={copy.title}>
      <div className="section-heading">
        <h3>{copy.title}</h3>
        <Badge>Derived</Badge>
        <HelpTip topic={copy.title} content={copy.semantics} />
        <HelpTip
          topic={copy.add}
          content={!canEdit ? copy.pause : draft ? copy.draftGuard : copy.limit}
        >
          <button
            type="button"
            className="outline-button compact-button"
            disabled={!canEdit || pending || draft !== null || zones.length >= 16}
            onClick={() => {
              setDraft(createZoneDraft(null, model.sceneRevision, zones, copy.newName));
              setDraftProject(projectKey);
              setError("");
            }}
          >
            {copy.add}
          </button>
        </HelpTip>
      </div>
      {!canEdit && (
        <p className="micro-copy" role="status">
          {copy.pause}
        </p>
      )}
      {pending && (
        <p className="micro-copy" role="status">
          {copy.pending}
        </p>
      )}
      {(error || model.error) && (
        <p className="inline-error" role="alert">
          {actionError}
        </p>
      )}
      {!zones.length && <p className="empty-state compact">{copy.empty}</p>}
      {!!zones.length && (
        <ul className="object-list" aria-label={copy.title}>
          {zones.map((zone) => (
            <li key={zone.id} className="asset-row">
              <div>
                <strong>{zone.name}</strong> <span className="field-unit">{zone.id}</span>{" "}
                <Badge>{zone.shape === "aabb" ? copy.aabb : copy.sphere}</Badge>
              </div>
              <div className="draft-actions">
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={zone.enabled}
                    disabled={!canEdit || pending || draft !== null}
                    onChange={(event) =>
                      void save(
                        { ...zone, enabled: event.target.checked },
                        model.sceneRevision,
                        registryPin,
                        false,
                      )
                    }
                  />
                  {zone.enabled ? copy.enabled : copy.disabled}
                </label>
                <button
                  type="button"
                  className="text-button"
                  disabled={!canEdit || pending || draft !== null}
                  onClick={() => {
                    setDraft(createZoneDraft(zone, model.sceneRevision, zones));
                    setDraftProject(projectKey);
                    setError("");
                  }}
                >
                  {copy.edit} {zone.name}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={!canEdit || pending || draft !== null}
                  onClick={() => void remove(zone)}
                >
                  {copy.remove} {zone.name}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {draft && (
        <form
          className="inspector-section"
          aria-label={copy.edit + " " + draft.id}
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalid && !stale && canEdit && !pending)
              void save(zoneFromDraft(draft, zones), draft.sceneRevision, draft.registryPin, true);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape" && !pending) {
              event.preventDefault();
              event.stopPropagation();
              setDraft(null);
              setError("");
            }
          }}
        >
          <div className="two-fields">
            <label className="text-field">
              <span>{copy.id}</span>
              <input
                value={draft.id}
                maxLength={64}
                disabled={pending || !canEdit || draft.existingId !== null}
                aria-invalid={invalid === "id" || invalid === "duplicate"}
                onChange={(event) => change({ id: event.target.value })}
              />
            </label>
            <label className="text-field">
              <span>{copy.name}</span>
              <input
                value={draft.name}
                maxLength={80}
                disabled={pending || !canEdit}
                aria-invalid={invalid === "name"}
                onChange={(event) => change({ name: event.target.value })}
              />
            </label>
          </div>
          <div className="two-fields">
            <label className="select-field">
              <span>{copy.shape}</span>
              <select
                value={draft.shape}
                disabled={pending || !canEdit}
                onChange={(event) => change({ shape: event.target.value as "aabb" | "sphere" })}
              >
                <option value="aabb">{copy.aabb}</option>
                <option value="sphere">{copy.sphere}</option>
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={draft.enabled}
                disabled={pending || !canEdit}
                onChange={(event) => change({ enabled: event.target.checked })}
              />
              {copy.enabled}
            </label>
          </div>
          {vector(copy.center, "center", -200, 200, invalid === "center")}
          {draft.shape === "aabb"
            ? vector(copy.halfExtents, "halfExtents", 0.05, 50, invalid === "extent")
            : numeric(
                copy.radius,
                draft.radius,
                0.05,
                50,
                (radius) => change({ radius }),
                invalid === "radius",
              )}
          {numeric(
            copy.hysteresis,
            draft.hysteresis,
            0,
            0.25,
            (hysteresis) => change({ hysteresis }),
            invalid === "hysteresis",
          )}
          {errorText && (
            <p className="inline-error" role="alert" id={errorId}>
              {errorText}
            </p>
          )}
          {stale && (
            <p className="inline-error" role="status">
              {copy.stale}
            </p>
          )}
          <div className="draft-actions">
            <button
              type="button"
              className="text-button"
              disabled={pending}
              onClick={() => {
                setDraft(null);
                setError("");
              }}
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              className="primary-button compact-button"
              disabled={!canEdit || pending || stale || Boolean(invalid)}
            >
              {copy.save}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
