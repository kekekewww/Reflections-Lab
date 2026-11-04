import { useEffect, useState } from "react";
import { Badge, NumberField } from "./components.js";
import type { BodyMode, Vector3 } from "./contracts.js";
import type { MotionActionInput, MotionWorkspaceView } from "../motion/types.js";

export interface MotionPanelProps {
  locale: "zh-TW" | "en";
  view: MotionWorkspaceView;
  selectedObject?: { id: string; positionM: Vector3; mode: BodyMode };
  disabled?: boolean;
  onSave(input: MotionActionInput, expectedRevision: number): void | Promise<void>;
  onRemove(actionId: string, expectedRevision: number): void | Promise<void>;
  onStart(actionId: string): void | Promise<void>;
  onCancel(runId: string): void | Promise<void>;
  onUndo(expectedRevision: number): void | Promise<void>;
  onRedo(expectedRevision: number): void | Promise<void>;
  onRebase(expectedRevision: number): void | Promise<void>;
  onExport(): void | Promise<void>;
  onImport(text: string, expectedRevision: number): void | Promise<void>;
}
const words = {
  "zh-TW": {
    title: "動作",
    selected: "選取物件",
    none: "先選取物件",
    id: "動作 ID",
    kind: "動作種類",
    moveTo: "移動到",
    moveAndRelease: "移動並釋放",
    impulse: "施加衝量",
    target: "目標位置",
    impulseVector: "衝量",
    speed: "最大速度",
    acceleration: "動態控制最大加速度",
    impulseLimit: "最大衝量",
    timeout: "逾時",
    release: "釋放速度",
    preserve: "保留實際速度",
    zero: "歸零",
    transfer: "承接已接受的軌跡速度",
    releaseMode: "釋放後模式",
    gravity: "受重力",
    noGravity: "無重力",
    save: "儲存動作",
    play: "執行",
    remove: "移除",
    cancel: "取消",
    undo: "復原動作編輯",
    redo: "重做動作編輯",
    export: "匯出動作",
    import: "匯入動作",
    rebase: "重新綁定目前場景",
    stale: "場景已更新",
    empty: "尚無動作",
    status: "執行狀態",
    failed: "動作失敗",
    pause: "先暫停模擬並取消執行中的動作，再編輯。",
  },
  en: {
    title: "Motion",
    selected: "Selected object",
    none: "Select an object first",
    id: "Action ID",
    kind: "Action kind",
    moveTo: "Move to",
    moveAndRelease: "Move and release",
    impulse: "Apply impulse",
    target: "Target position",
    impulseVector: "Impulse",
    speed: "Maximum speed",
    acceleration: "Dynamic maximum acceleration",
    impulseLimit: "Maximum impulse",
    timeout: "Timeout",
    release: "Release velocity",
    preserve: "Preserve actual velocity",
    zero: "Zero",
    transfer: "Transfer accepted trajectory velocity",
    releaseMode: "Released body mode",
    gravity: "Gravity",
    noGravity: "No gravity",
    save: "Save action",
    play: "Run",
    remove: "Remove",
    cancel: "Cancel",
    undo: "Undo motion edit",
    redo: "Redo motion edit",
    export: "Export motions",
    import: "Import motions",
    rebase: "Rebind to current scene",
    stale: "Scene changed",
    empty: "No actions yet",
    status: "Run status",
    failed: "Motion failed",
    pause: "Pause the simulation and cancel active motion before editing.",
  },
} as const;

/** A small authoring surface using the existing controls, spacing classes and semantic states. */
export function MotionPanel(props: MotionPanelProps) {
  const { locale, view, selectedObject, disabled = false } = props;
  const t = words[locale];
  const [actionId, setActionId] = useState("");
  const [kind, setKind] = useState<"moveTo" | "moveAndRelease" | "impulse">("moveTo");
  const [target, setTarget] = useState<Vector3>([0, 1, 0]);
  const [impulse, setImpulse] = useState<Vector3>([0, 1, 0]);
  const [speed, setSpeed] = useState(1);
  const [acceleration, setAcceleration] = useState(12);
  const [limit, setLimit] = useState(10);
  const [timeout, setTimeout] = useState(10);
  const [releasePolicy, setReleasePolicy] = useState<"preserve" | "zero" | "transfer">("preserve");
  const [releaseMode, setReleaseMode] = useState<"dynamicGravity" | "dynamicNoGravity">(
    "dynamicGravity",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    setActionId(selectedObject ? `motion.${selectedObject.id}`.slice(0, 64) : "");
    setTarget(selectedObject ? [...selectedObject.positionM] : [0, 1, 0]);
    setReleasePolicy(selectedObject?.mode === "kinematic" ? "zero" : "preserve");
    setError("");
  }, [selectedObject?.id, selectedObject?.mode]);
  const act = async (operation: () => void | Promise<void>) => {
    setError("");
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.failed);
    }
  };
  const editDisabled = disabled || view.activeRunIds.length > 0;
  const vectorFields = (
    label: string,
    value: Vector3,
    update: (next: Vector3) => void,
    unit: string,
    max: number,
  ) => (
    <fieldset className="vector-fields" disabled={editDisabled}>
      <legend>
        {label} <span className="field-unit">{unit}</span>
      </legend>
      <div className="axis-fields">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <NumberField
            key={axis}
            label={axis}
            value={value[index]!}
            min={-max}
            max={max}
            step="any"
            onCommit={(number) => {
              const next: Vector3 = [...value];
              next[index] = number;
              update(next);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
  return (
    <section className="inspector-section motion-panel" aria-label={t.title}>
      <div className="section-heading">
        <h3>{t.title}</h3>
        {view.stale && <Badge kind="warning">{t.stale}</Badge>}
      </div>
      <p className="field-unit">
        {t.selected}: {selectedObject?.id ?? t.none}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedObject) return;
          const draft: MotionActionInput = {
            actionId,
            objectId: selectedObject.id,
            kind,
            maxSpeedMps: speed,
            maxAccelerationMps2: acceleration,
            maxImpulseNs: limit,
            timeoutS: timeout,
            releasePolicy,
            releaseMode,
            ...(kind === "impulse" ? { impulseNs: impulse } : { targetPositionM: target }),
          };
          void act(() => props.onSave(draft, view.document.revision));
        }}
      >
        <label>
          {t.id}
          <input
            value={actionId}
            maxLength={64}
            required
            pattern={"[a-z][a-z0-9._\\-]{0,63}"}
            disabled={editDisabled || !selectedObject}
            onChange={(event) => setActionId(event.target.value)}
          />
        </label>
        <label>
          {t.kind}
          <select
            value={kind}
            disabled={editDisabled}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="moveTo">{t.moveTo}</option>
            <option value="moveAndRelease">{t.moveAndRelease}</option>
            <option value="impulse">{t.impulse}</option>
          </select>
        </label>
        {kind === "impulse"
          ? vectorFields(t.impulseVector, impulse, setImpulse, "N·s", 1000)
          : vectorFields(t.target, target, setTarget, "m", 200)}
        {kind !== "impulse" && (
          <NumberField
            label={t.speed}
            value={speed}
            unit="m/s"
            min={0.01}
            max={3}
            step="any"
            disabled={editDisabled}
            onCommit={setSpeed}
          />
        )}
        {kind !== "impulse" && (
          <NumberField
            label={t.acceleration}
            value={acceleration}
            unit="m/s²"
            min={0.1}
            max={100}
            step="any"
            disabled={editDisabled || selectedObject?.mode === "kinematic"}
            onCommit={setAcceleration}
          />
        )}
        <NumberField
          label={t.impulseLimit}
          value={limit}
          unit="N·s"
          min={0.001}
          max={1000}
          step="any"
          disabled={editDisabled}
          onCommit={setLimit}
        />
        <NumberField
          label={t.timeout}
          value={timeout}
          unit="s"
          min={0.1}
          max={60}
          step="any"
          disabled={editDisabled}
          onCommit={setTimeout}
        />
        {kind === "moveAndRelease" && (
          <>
            <label>
              {t.release}
              <select
                value={releasePolicy}
                disabled={editDisabled}
                onChange={(event) => setReleasePolicy(event.target.value as typeof releasePolicy)}
              >
                {selectedObject?.mode !== "kinematic" && (
                  <option value="preserve">{t.preserve}</option>
                )}
                <option value="zero">{t.zero}</option>
                {selectedObject?.mode === "kinematic" && (
                  <option value="transfer">{t.transfer}</option>
                )}
              </select>
            </label>
            {selectedObject?.mode === "kinematic" && (
              <label>
                {t.releaseMode}
                <select
                  value={releaseMode}
                  disabled={editDisabled}
                  onChange={(event) => setReleaseMode(event.target.value as typeof releaseMode)}
                >
                  <option value="dynamicGravity">{t.gravity}</option>
                  <option value="dynamicNoGravity">{t.noGravity}</option>
                </select>
              </label>
            )}
          </>
        )}
        <button
          type="submit"
          disabled={editDisabled || !selectedObject || selectedObject.mode === "fixed"}
        >
          {t.save}
        </button>
      </form>
      {disabled && <p className="field-unit">{t.pause}</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="button-row">
        <button
          type="button"
          disabled={editDisabled || !view.canUndo}
          onClick={() => void act(() => props.onUndo(view.document.revision))}
        >
          {t.undo}
        </button>
        <button
          type="button"
          disabled={editDisabled || !view.canRedo}
          onClick={() => void act(() => props.onRedo(view.document.revision))}
        >
          {t.redo}
        </button>
        <button
          type="button"
          disabled={editDisabled || !view.stale}
          onClick={() => void act(() => props.onRebase(view.document.revision))}
        >
          {t.rebase}
        </button>
        <button type="button" onClick={() => void act(props.onExport)}>
          {t.export}
        </button>
        <label className="file-input-label">
          {t.import}
          <input
            aria-label={t.import}
            type="file"
            accept="application/json,.json"
            disabled={editDisabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file)
                void act(async () => props.onImport(await file.text(), view.document.revision));
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {view.document.actions.length === 0 ? (
        <p className="field-unit">{t.empty}</p>
      ) : (
        <ul className="motion-actions">
          {view.document.actions.map((action) => (
            <li key={action.actionId}>
              <span>
                {action.actionId} · {action.objectId}
              </span>
              <div className="button-row">
                <button
                  type="button"
                  disabled={view.stale || view.activeRunIds.length > 0}
                  onClick={() => void act(() => props.onStart(action.actionId))}
                >
                  {t.play}
                </button>
                <button
                  type="button"
                  disabled={editDisabled}
                  onClick={() =>
                    void act(() => props.onRemove(action.actionId, view.document.revision))
                  }
                >
                  {t.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div aria-label={t.status}>
        {view.runs.slice(-4).map((run) => (
          <div key={run.runId} className="motion-run">
            <Badge
              kind={
                run.status === "reached" || run.status === "applied"
                  ? "success"
                  : run.reason
                    ? "warning"
                    : "neutral"
              }
            >
              {run.status}
            </Badge>
            <span>
              {run.actionId} · {run.elapsedTicks} ticks {run.reason ? `· ${run.reason}` : ""}
            </span>
            {view.activeRunIds.includes(run.runId) && (
              <button type="button" onClick={() => void act(() => props.onCancel(run.runId))}>
                {t.cancel}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
