import { useId } from "react";
import { TRAJECTORY_LIMITS, type ObjectTrajectory } from "../scene/types.js";
import { add, boundingRadius, mul, normalize, sub } from "../interaction/math.js";
import type { LabController, LabViewModel, ObjectView, Vector3 } from "./contracts.js";
import { Badge, Icon, NumberField, Section } from "./components.js";
import { useLocale } from "./locale.js";

/** View-only editor state; the path itself lives in the scene and changes only via setTrajectory. */
export interface TrajectoryUiState {
  editingObjectId: string | null;
  showAll: boolean;
  /** Index into the edited object's offsets (point 1 is index 0); out of range means none. */
  selectedPointIndex: number | null;
}

export const closedTrajectoryUi: TrajectoryUiState = Object.freeze({
  editingObjectId: null,
  showAll: false,
  selectedPointIndex: null,
});

type TrajectoryModel = Pick<LabViewModel, "interactionMode" | "selectedObjectId" | "objects">;
export interface TrajectoryKeyEvent {
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  typing: boolean;
  composing: boolean;
}
export type TrajectoryNoticeKey = "trajectory.notice.noSelection" | "trajectory.notice.notAudible";

/** Same rule as the Inspector's `canEdit`: paths are read-only while the take runs or replays. */
export const trajectoryEditable = (model: Pick<LabViewModel, "simulationState" | "recording">) =>
  model.simulationState !== "running" && model.recording.state !== "replaying";

/** Free clearance beyond the moving object's bounding radius, as for painted brush points. */
const SURFACE_CLEARANCE_M = 0.01;
const DISPLAY_PRECISION = 1000;
const round = (value: number) => Math.round(value * DISPLAY_PRECISION) / DISPLAY_PRECISION;

const selectedAudible = (model: TrajectoryModel) =>
  model.objects.find((object) => object.id === model.selectedObjectId && object.audible);
const plainKey = (event: TrajectoryKeyEvent) =>
  !event.typing && !event.composing && !event.ctrlKey && !event.metaKey && !event.altKey;

/**
 * The editor stays open only for an existing, audible, selected object in the editor view.
 * Returns the same object when nothing changes, so callers can compare by identity.
 */
export function reconcileTrajectoryUi(
  model: TrajectoryModel,
  state: TrajectoryUiState,
): TrajectoryUiState {
  if (state.editingObjectId === null)
    return state.selectedPointIndex === null ? state : { ...state, selectedPointIndex: null };
  const open =
    model.interactionMode === "editor" &&
    model.selectedObjectId === state.editingObjectId &&
    model.objects.some((object) => object.id === state.editingObjectId && object.audible);
  return open ? state : { ...state, editingObjectId: null, selectedPointIndex: null };
}

/** T, Shift+T and Esc in the editor view; null means the key is not handled here. */
export function trajectoryKeyAction(
  event: TrajectoryKeyEvent,
  model: TrajectoryModel,
  state: TrajectoryUiState,
): TrajectoryUiState | null {
  if (!plainKey(event) || model.interactionMode !== "editor") return null;
  const current = reconcileTrajectoryUi(model, state);
  if (event.code === "KeyT" && event.shiftKey) return { ...current, showAll: !current.showAll };
  if (event.code === "KeyT") {
    const object = selectedAudible(model);
    if (!object) return null;
    return {
      ...current,
      editingObjectId: current.editingObjectId === object.id ? null : object.id,
      selectedPointIndex: null,
    };
  }
  if (event.code === "Escape" && current.editingObjectId !== null)
    return { ...current, editingObjectId: null, selectedPointIndex: null };
  return null;
}

/** Why a plain T in the editor view did nothing, or null when it was handled or not a T. */
export function trajectoryKeyNotice(
  event: TrajectoryKeyEvent,
  model: TrajectoryModel,
): TrajectoryNoticeKey | null {
  if (!plainKey(event) || event.shiftKey || event.code !== "KeyT") return null;
  if (model.interactionMode !== "editor" || selectedAudible(model)) return null;
  return model.objects.some((object) => object.id === model.selectedObjectId)
    ? "trajectory.notice.notAudible"
    : "trajectory.notice.noSelection";
}

/** A clicked surface point as an offset, held clear of that surface by the object's radius. */
export function surfaceOffset(object: ObjectView, pointM: Vector3, normalM: Vector3): Vector3 {
  const clearance = boundingRadius(object) + SURFACE_CLEARANCE_M;
  return sub(add(pointM, mul(normalize(normalM), clearance)), object.positionM);
}

const withOffsets = (object: ObjectView, offsetsM: Vector3[]): ObjectTrajectory => ({
  ...(object.trajectory ?? {
    strengthMps: TRAJECTORY_LIMITS.defaultStrengthMps,
    startDelayS: 0,
    faceAlongPath: false,
  }),
  offsetsM,
});
const midpoint = (a: Vector3, b: Vector3): Vector3 => mul(add(a, b), 0.5);

/** Null when the path already holds the most points it can. */
export function appendOffset(object: ObjectView, offsetM: Vector3): ObjectTrajectory | null {
  const offsets = object.trajectory?.offsetsM ?? [];
  if (offsets.length >= TRAJECTORY_LIMITS.maxOffsets) return null;
  return withOffsets(object, [...offsets, offsetM]);
}

/** Between two points the new one is their midpoint; after the last it continues half a segment. */
export function insertPointAfter(object: ObjectView, index: number): ObjectTrajectory | null {
  const offsets = object.trajectory?.offsetsM ?? [];
  const current = offsets[index];
  if (!current || offsets.length >= TRAJECTORY_LIMITS.maxOffsets) return null;
  const next = offsets[index + 1];
  const previous = index === 0 ? ([0, 0, 0] as Vector3) : offsets[index - 1]!;
  const inserted = next ? midpoint(current, next) : add(current, mul(sub(current, previous), 0.5));
  return withOffsets(object, [
    ...offsets.slice(0, index + 1),
    inserted,
    ...offsets.slice(index + 1),
  ]);
}

/** Null clears the path: a path needs at least one point besides its start. */
export function removePoint(object: ObjectView, index: number): ObjectTrajectory | null {
  const offsets = (object.trajectory?.offsetsM ?? []).filter((_, i) => i !== index);
  return offsets.length ? withOffsets(object, offsets) : null;
}

const replaceOffset = (object: ObjectView, index: number, offsetM: Vector3) =>
  withOffsets(
    object,
    (object.trajectory?.offsetsM ?? []).map((offset, i) => (i === index ? offsetM : offset)),
  );

export function movePoint(object: ObjectView, index: number, worldM: Vector3): ObjectTrajectory {
  return replaceOffset(object, index, sub(worldM, object.positionM));
}

/**
 * Viewport path edits run one at a time, each built from the controller's state when it starts,
 * so two fast clicks both land instead of the second replacing the first. A refused commit goes
 * to `onError`, never to an unhandled rejection. Resolves to the committed path, or null.
 */
export function createTrajectoryEditQueue(
  controller: Pick<LabController, "dispatch" | "getSnapshot">,
  onError: (message: string) => void,
) {
  let queue: Promise<unknown> = Promise.resolve();
  return (
    objectId: string,
    build: (object: ObjectView) => ObjectTrajectory | null,
  ): Promise<ObjectTrajectory | null> => {
    const run = async () => {
      try {
        const before = controller.getSnapshot();
        const object = before.objects.find((entry) => entry.id === objectId);
        if (!object?.audible || before.interactionMode !== "editor" || !trajectoryEditable(before))
          return null;
        const next = build(object);
        if (!next) return null;
        await controller.dispatch({ type: "setTrajectory", objectId, trajectory: next });
        // A controller that reports refusals itself still resolves; only a path that landed counts.
        const after = controller
          .getSnapshot()
          .objects.find((entry) => entry.id === objectId)?.trajectory;
        return after?.offsetsM.length === next.offsetsM.length ? next : null;
      } catch (reason) {
        onError(reason instanceof Error ? reason.message : String(reason));
        return null;
      }
    };
    const result = queue.then(run);
    queue = result;
    return result;
  };
}

/** The same physical point stays selected when a point is inserted after `insertedAfter`. */
export function selectionAfterInsert(selected: number | null, insertedAfter: number) {
  return selected !== null && selected > insertedAfter ? selected + 1 : selected;
}

/**
 * The same physical point stays selected when another is removed. Removing the selected point
 * selects its next neighbour, or the previous one when it was last; `remaining` counts the rest.
 */
export function selectionAfterRemove(selected: number | null, removed: number, remaining: number) {
  if (selected === null) return null;
  if (removed < selected) return selected - 1;
  if (removed > selected) return selected;
  return remaining === 0 ? null : Math.min(selected, remaining - 1);
}

type DeleteModel = TrajectoryModel & Pick<LabViewModel, "simulationState" | "recording">;
export interface TrajectoryDeleteResult {
  /** Null when the key is consumed without an edit: no point selected, or read-only. */
  edit: {
    objectId: string;
    trajectory: ObjectTrajectory | null;
    selectedPointIndex: number | null;
  } | null;
}

/**
 * Delete or Backspace while a path editor is open removes the selected point and never the
 * object. Null means no editor is open (or the user is typing), so the key keeps its meaning.
 */
export function trajectoryDeleteKey(
  event: TrajectoryKeyEvent,
  model: DeleteModel,
  state: TrajectoryUiState,
): TrajectoryDeleteResult | null {
  if (event.code !== "Delete" && event.code !== "Backspace") return null;
  if (event.typing || event.composing || model.interactionMode !== "editor") return null;
  const current = reconcileTrajectoryUi(model, state);
  if (current.editingObjectId === null) return null;
  const object = model.objects.find((entry) => entry.id === current.editingObjectId);
  const offsets = object?.trajectory?.offsetsM ?? [];
  const index = current.selectedPointIndex;
  if (
    !object ||
    index === null ||
    index >= offsets.length ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    !trajectoryEditable(model)
  )
    return { edit: null };
  return {
    edit: {
      objectId: object.id,
      trajectory: removePoint(object, index),
      selectedPointIndex: selectionAfterRemove(index, index, offsets.length - 1),
    },
  };
}

export function TrajectorySection({
  object,
  status,
  state,
  dispatch,
  disabled,
  onSelectPoint,
}: {
  object: ObjectView;
  status?: LabViewModel["trajectoryStatus"][string] | undefined;
  state: TrajectoryUiState;
  dispatch: LabController["dispatch"];
  disabled: boolean;
  /** Keeps the selected point the same physical point after an insert or delete commits. */
  onSelectPoint?: (index: number | null) => void;
}) {
  const { t, n } = useLocale();
  const listId = useId();
  const trajectory = object.trajectory;
  const editing = state.editingObjectId === object.id;
  const commit = (next: ObjectTrajectory | null, selection?: number | null) => {
    const committed = dispatch({ type: "setTrajectory", objectId: object.id, trajectory: next });
    if (!editing || !onSelectPoint || selection === undefined) return void committed;
    if (selection === state.selectedPointIndex) return void committed;
    void Promise.resolve(committed).then(() => onSelectPoint(selection));
  };
  const clearButton = (
    <button
      type="button"
      className="text-button danger-text"
      disabled={disabled}
      onClick={() => commit(null)}
    >
      <Icon name="trash" size={14} />
      {t("trajectory.clear")}
    </button>
  );
  // A path left on an object that lost its sound never runs; it can only be cleared.
  if (!object.audible)
    return trajectory ? (
      <Section title={t("trajectory.title")} help={t("trajectory.help")}>
        <p className="micro-copy trajectory-problem" role="status">
          <Icon name="info" size={14} />
          <span>{t("trajectory.notAudiblePath")}</span>
        </p>
        {clearButton}
      </Section>
    ) : null;
  const decimals = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const full = (trajectory?.offsetsM.length ?? 0) >= TRAJECTORY_LIMITS.maxOffsets;
  return (
    <Section
      title={t("trajectory.title")}
      help={t("trajectory.help")}
      aside={
        editing ? (
          <Badge kind="accent">{t("trajectory.editing")}</Badge>
        ) : !trajectory ? (
          <Badge>{t("trajectory.empty")}</Badge>
        ) : undefined
      }
    >
      <div className="readout-line">
        <span id={listId}>{t("trajectory.points")}</span>
        <code>
          {t("trajectory.pointCountValue", {
            count: trajectory?.offsetsM.length ?? 0,
            max: TRAJECTORY_LIMITS.maxOffsets,
          })}
        </code>
      </div>
      {trajectory && (
        <>
          {status && (
            <>
              <div className="readout-line">
                <span>{t("trajectory.length")}</span>
                <code>{n(status.lengthM, decimals)} m</code>
              </div>
              <div className="readout-line">
                <span>{t("trajectory.duration")}</span>
                <code>{n(status.durationS, decimals)} s</code>
              </div>
              {status.problem && (
                <p className="micro-copy trajectory-problem" role="status">
                  <Icon name="info" size={14} />
                  <span>
                    {t(`trajectory.problem.${status.problem}`, {
                      seconds: TRAJECTORY_LIMITS.maxDurationS,
                      count: TRAJECTORY_LIMITS.maxPathsPerTake,
                    })}
                  </span>
                </p>
              )}
            </>
          )}
          <ol className="trajectory-points" aria-labelledby={listId}>
            {trajectory.offsetsM.map((offset, index) => {
              const label = index + 1;
              const selected = editing && state.selectedPointIndex === index;
              const world = offset.map((value, axis) =>
                round(value + object.positionM[axis]!),
              ) as Vector3;
              return (
                <li
                  key={index}
                  className={`trajectory-point${selected ? " selected" : ""}`}
                  data-trajectory-point={label}
                  aria-current={selected || undefined}
                >
                  <div className="trajectory-point-header">
                    <span id={`${listId}-${label}`}>
                      {t("trajectory.point", { index: label })}{" "}
                      <span className="field-unit">m</span>
                    </span>
                    {selected && <Badge kind="accent">{t("trajectory.selectedPoint")}</Badge>}
                    <span className="trajectory-point-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("trajectory.insertAfter", { index: label })}
                        title={t("trajectory.insertAfter", { index: label })}
                        disabled={disabled || full}
                        onClick={() => {
                          const next = insertPointAfter(object, index);
                          if (next)
                            commit(next, selectionAfterInsert(state.selectedPointIndex, index));
                        }}
                      >
                        <Icon name="plus" size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger-text"
                        aria-label={t("trajectory.deletePoint", { index: label })}
                        title={t("trajectory.deletePoint", { index: label })}
                        disabled={disabled}
                        onClick={() =>
                          commit(
                            removePoint(object, index),
                            selectionAfterRemove(
                              state.selectedPointIndex,
                              index,
                              trajectory.offsetsM.length - 1,
                            ),
                          )
                        }
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </span>
                  </div>
                  <div className="axis-fields" role="group" aria-labelledby={`${listId}-${label}`}>
                    {(["X", "Y", "Z"] as const).map((axis, axisIndex) => (
                      <NumberField
                        key={axis}
                        label={axis}
                        value={world[axisIndex]!}
                        min={-200}
                        max={200}
                        step={0.1}
                        disabled={disabled}
                        onCommit={(value) => {
                          // Only the edited axis changes; the others keep their exact offsets.
                          const moved: Vector3 = [...offset];
                          moved[axisIndex] = value - object.positionM[axisIndex]!;
                          commit(replaceOffset(object, index, moved));
                        }}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="two-fields">
            <NumberField
              label={t("trajectory.strength")}
              unit="m/s"
              value={trajectory.strengthMps}
              min={TRAJECTORY_LIMITS.minStrengthMps}
              max={TRAJECTORY_LIMITS.maxStrengthMps}
              step={0.1}
              disabled={disabled}
              onCommit={(strengthMps) => commit({ ...trajectory, strengthMps })}
            />
            <NumberField
              label={t("trajectory.startDelay")}
              unit="s"
              value={trajectory.startDelayS}
              min={0}
              max={TRAJECTORY_LIMITS.maxStartDelayS}
              step={0.1}
              disabled={disabled}
              onCommit={(startDelayS) => commit({ ...trajectory, startDelayS })}
            />
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={trajectory.faceAlongPath}
              disabled={disabled}
              onChange={(event) =>
                commit({ ...trajectory, faceAlongPath: event.currentTarget.checked })
              }
            />
            <span>{t("trajectory.faceAlongPath")}</span>
          </label>
          {clearButton}
        </>
      )}
    </Section>
  );
}
