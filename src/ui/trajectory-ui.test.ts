import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LabRuntime } from "../app/runtime.js";
import type { ObjectTrajectory } from "../scene/types.js";
import type { LabAction, LabController, LabViewModel, ObjectView, Vector3 } from "./contracts.js";
import { LocaleProvider } from "./locale.js";
import { formatMessage, formatNumber, translate } from "./locale-model.js";
import { trajectoryMessages } from "./locales/trajectory.js";
import { viewportMessages } from "./locales/viewport.js";
import { statusCodeKeys } from "./locales/status.js";
import { Viewport } from "./Viewport.js";
import {
  TrajectorySection,
  appendOffset,
  createTrajectoryEditQueue,
  insertPointAfter,
  movePoint,
  reconcileTrajectoryUi,
  removePoint,
  selectionAfterInsert,
  selectionAfterRemove,
  surfaceOffset,
  trajectoryDeleteKey,
  trajectoryKeyAction,
  trajectoryKeyNotice,
  type TrajectoryUiState,
} from "./inspector-trajectory.js";
import { trajectoryCurveTargets } from "./viewport/TrajectoryCurves.js";

const HAN = /\p{Script=Han}/u;
const PATH: ObjectTrajectory = {
  offsetsM: [
    [1, 0, 0],
    [0, 1, 0],
  ],
  strengthMps: 3,
  startDelayS: 0,
  faceAlongPath: false,
};
const ball: ObjectView = {
  id: "ball",
  name: "Ball",
  shape: "sphere",
  dimensionsM: [0.5, 0.5, 0.5],
  positionM: [1, 0.5, -2],
  orientationQuaternion: [0, 0, 0, 1],
  mode: "dynamicGravity",
  massKg: 1,
  friction: 0.5,
  restitution: 0.5,
  physicsMaterialId: "physics.default",
  acousticMaterialId: "material.hard",
  acousticRole: "none",
  audible: true,
  trajectory: PATH,
};
const { trajectory: _unused, ...plainBall } = ball;
const floor: ObjectView = {
  ...plainBall,
  id: "floor",
  name: "Floor",
  shape: "box",
  dimensionsM: [10, 0.2, 10],
  positionM: [0, -0.1, 0],
  mode: "fixed",
  audible: false,
};
const closed: TrajectoryUiState = {
  editingObjectId: null,
  showAll: false,
  selectedPointIndex: null,
};
const editor = (selectedObjectId: string | null, objects: ObjectView[] = [ball, floor]) => ({
  interactionMode: "editor" as const,
  selectedObjectId,
  objects,
});
const key = (code: string, extra: Partial<Parameters<typeof trajectoryKeyAction>[0]> = {}) => ({
  code,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  typing: false,
  composing: false,
  ...extra,
});
const render = (node: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(LocaleProvider, null, node));

test("T toggles the selected audible object's editor; Shift+T shows all; Esc closes", () => {
  const opened = trajectoryKeyAction(key("KeyT"), editor("ball"), closed);
  assert.deepEqual(opened, { editingObjectId: "ball", showAll: false, selectedPointIndex: null });
  assert.deepEqual(trajectoryKeyAction(key("KeyT"), editor("ball"), opened!), closed);
  assert.deepEqual(trajectoryKeyAction(key("KeyT", { shiftKey: true }), editor("ball"), closed), {
    ...closed,
    showAll: true,
  });
  const editing = { editingObjectId: "ball", showAll: true, selectedPointIndex: 1 };
  assert.deepEqual(trajectoryKeyAction(key("Escape"), editor("ball"), editing), {
    editingObjectId: null,
    showAll: true,
    selectedPointIndex: null,
  });
  assert.equal(
    trajectoryKeyAction(key("Escape"), editor("ball"), closed),
    null,
    "nothing to close",
  );
});

test("T is ignored while typing or composing, with Ctrl/Meta/Alt, and outside the editor view", () => {
  for (const extra of [
    { typing: true },
    { composing: true },
    { ctrlKey: true },
    { ctrlKey: true, shiftKey: true },
    { metaKey: true },
    { altKey: true },
  ])
    assert.equal(trajectoryKeyAction(key("KeyT", extra), editor("ball"), closed), null);
  const fps = { ...editor("ball"), interactionMode: "fps-interact" as const };
  assert.equal(trajectoryKeyAction(key("KeyT"), fps, closed), null);
  assert.equal(trajectoryKeyAction(key("KeyT", { shiftKey: true }), fps, closed), null);
  assert.equal(trajectoryKeyAction(key("KeyW"), editor("ball"), closed), null);
});

test("T with the floor or nothing selected changes nothing and names the reason", () => {
  assert.equal(trajectoryKeyAction(key("KeyT"), editor("floor"), closed), null);
  assert.equal(trajectoryKeyAction(key("KeyT"), editor(null), closed), null);
  assert.equal(trajectoryKeyNotice(key("KeyT"), editor("floor")), "trajectory.notice.notAudible");
  assert.equal(trajectoryKeyNotice(key("KeyT"), editor(null)), "trajectory.notice.noSelection");
  assert.equal(trajectoryKeyNotice(key("KeyT"), editor("ball")), null);
  assert.equal(trajectoryKeyNotice(key("KeyT", { typing: true }), editor(null)), null);
  assert.equal(trajectoryKeyNotice(key("KeyT", { shiftKey: true }), editor(null)), null);
});

test("an editor whose object is deleted, loses its sound or is deselected closes", () => {
  const editing: TrajectoryUiState = {
    editingObjectId: "ball",
    showAll: true,
    selectedPointIndex: 0,
  };
  const deleted = editor("ball", [floor]);
  assert.deepEqual(trajectoryKeyAction(key("KeyT", { shiftKey: true }), deleted, editing), {
    editingObjectId: null,
    showAll: false,
    selectedPointIndex: null,
  });
  for (const model of [
    deleted,
    editor("ball", [{ ...ball, audible: false }, floor]),
    editor("floor"),
    editor(null),
    { ...editor("ball"), interactionMode: "fps-build" as const },
  ])
    assert.deepEqual(reconcileTrajectoryUi(model, editing), {
      editingObjectId: null,
      showAll: true,
      selectedPointIndex: null,
    });
  // A still-valid editor keeps its exact state object, so the render path cannot loop.
  assert.equal(reconcileTrajectoryUi(editor("ball"), editing), editing);
  assert.equal(reconcileTrajectoryUi(editor(null), closed), closed);
});

test("a surface click offsets the point by the edited object's radius along the world normal", () => {
  // Sphere radius 0.25: the point sits 0.26 m above the floor hit, relative to the ball start.
  const offset = surfaceOffset(ball, [2, 0, -2], [0, 1, 0]);
  const expected: Vector3 = [1, -0.24, 0];
  offset.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]!) < 1e-12));
  const appended = appendOffset(plainBall, [1, 0, 0]);
  assert.deepEqual(appended, {
    offsetsM: [[1, 0, 0]],
    strengthMps: 3,
    startDelayS: 0,
    faceAlongPath: false,
  });
  assert.deepEqual(appendOffset(ball, [0, 0, 1])?.offsetsM, [...PATH.offsetsM, [0, 0, 1]]);
  const full = {
    ...ball,
    trajectory: { ...PATH, offsetsM: Array.from({ length: 63 }, () => PATH.offsetsM[0]!) },
  };
  assert.equal(appendOffset(full, [0, 0, 1]), null, "a full path takes no more points");
});

test("point edits keep the other offsets and never create a duplicate point", () => {
  assert.deepEqual(insertPointAfter(ball, 0)?.offsetsM, [
    [1, 0, 0],
    [0.5, 0.5, 0],
    [0, 1, 0],
  ]);
  // After the last point the new one continues half the last segment's direction.
  assert.deepEqual(insertPointAfter(ball, 1)?.offsetsM, [
    [1, 0, 0],
    [0, 1, 0],
    [-0.5, 1.5, 0],
  ]);
  assert.deepEqual(removePoint(ball, 0)?.offsetsM, [[0, 1, 0]]);
  const single = { ...ball, trajectory: { ...PATH, offsetsM: [[1, 0, 0] as Vector3] } };
  assert.equal(removePoint(single, 0), null, "removing the only point clears the path");
  assert.deepEqual(movePoint(ball, 1, [1, 2, -2]).offsetsM, [
    [1, 0, 0],
    [0, 1.5, 0],
  ]);
});

test("the Inspector section lists world points, Strength bounds and the problem reason", () => {
  const actions: LabAction[] = [];
  const html = render(
    createElement(TrajectorySection, {
      object: ball,
      status: { lengthM: 120, durationS: 40, valid: false, problem: "TOO_LONG" },
      state: { editingObjectId: "ball", showAll: false, selectedPointIndex: 1 },
      dispatch: (action: LabAction) => void actions.push(action),
      disabled: false,
    }),
  );
  assert.equal((html.match(/data-trajectory-point=/g) ?? []).length, 2);
  // World coordinates are offset + position: [2, 0.5, -2] and [1, 1.5, -2].
  const point = (index: number) =>
    html.split(`data-trajectory-point="${index}"`)[1]!.split("data-trajectory-point")[0]!;
  const values = (chunk: string) =>
    [...chunk.matchAll(/type="number"[^>]*value="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(values(point(1)).slice(0, 3), ["2", "0.5", "-2"]);
  assert.deepEqual(values(point(2)).slice(0, 3), ["1", "1.5", "-2"]);
  assert.match(html, /aria-label="強度 m\/s"[^>]*min="0.5"[^>]*max="20"/);
  assert.match(html, /aria-label="起始延遲 s"[^>]*min="0"[^>]*max="30"/);
  assert.match(html, /過長/);
  assert.match(html, /aria-current="true"/, "the selected point row is marked");
  assert.equal(actions.length, 0);
  const disabled = render(
    createElement(TrajectorySection, {
      object: ball,
      state: closed,
      dispatch: () => {},
      disabled: true,
    }),
  );
  const controls = (disabled.match(/<(input|button)\b[^>]*>/g) ?? []).filter(
    (tag) => !tag.includes("help-tip-trigger"),
  );
  assert.ok(controls.length >= 8, "points, insert/delete, Strength, delay, facing and clear");
  for (const tag of controls) assert.match(tag, /disabled=""/, tag);
  assert.equal(
    render(
      createElement(TrajectorySection, {
        object: floor,
        state: closed,
        dispatch: () => {},
        disabled: false,
      }),
    ),
    "",
  );
});

test("the viewport reports how many curves it draws and hides them unless asked", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const base = app.getSnapshot();
    const speaker = base.objects.find((object) => object.id === "speaker");
    assert.ok(speaker?.audible, "the default speaker is audible");
    const model: LabViewModel = {
      ...base,
      selectedObjectId: "ball",
      objects: base.objects.map((object) =>
        object.id === "ball" || object.id === "speaker" ? { ...object, trajectory: PATH } : object,
      ),
    };
    const count = (view: LabViewModel, trajectory: TrajectoryUiState) => {
      const html = render(createElement(Viewport, { controller: app, model: view, trajectory }));
      const value = /class="viewport-canvas-wrap"[^>]*data-trajectory-curves="(\d+)"/.exec(
        html,
      )?.[1];
      assert.equal(Number(value), trajectoryCurveTargets(view, trajectory).length);
      return Number(value);
    };
    assert.equal(count(model, closed), 0, "no clutter by default");
    assert.equal(count(model, { ...closed, editingObjectId: "ball" }), 1);
    assert.equal(count(model, { ...closed, showAll: true }), 2);
    const painting: LabViewModel = {
      ...model,
      interactionMode: "fps-interact",
      paint: { objectId: "ball", pointsM: [base.objects[0]!.positionM, [0, 1, 0]], distanceM: 2 },
    };
    // The live stroke replaces the ball's stored curve; the speaker's still shows with Shift+T.
    assert.equal(count(painting, closed), 1);
    assert.equal(count(painting, { ...closed, showAll: true }), 2);
  } finally {
    app.dispose();
  }
});

test("painting shows a compact hint instead of the paused prompt; ready says Enter starts the take", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const base = app.getSnapshot();
    const fps: LabViewModel = {
      ...base,
      interactionMode: "fps-interact",
      simulationState: "ready",
      alternativeInput: true,
      pauseReason: "已暫停",
    };
    const painting = render(
      createElement(Viewport, {
        controller: app,
        model: { ...fps, paint: { objectId: "ball", pointsM: [[0, 1, 0]], distanceM: 1.5 } },
      }),
    );
    assert.match(painting, /放開滑鼠鍵完成/);
    assert.match(painting, /1\.50 m/);
    assert.doesNotMatch(painting, /viewport-message/, "no paused message over the brush");
    assert.doesNotMatch(painting, /點擊畫面或按 Enter/);
    const ready = render(createElement(Viewport, { controller: app, model: fps }));
    assert.match(ready, /按 Enter 開始/);
    const paused = render(
      createElement(Viewport, { controller: app, model: { ...fps, simulationState: "paused" } }),
    );
    assert.match(paused, /點擊畫面或按 Enter 繼續/);
  } finally {
    app.dispose();
  }
});

test("every new message exists in both locales and the runtime's bare codes are explained", () => {
  for (const [id, entry] of Object.entries(trajectoryMessages)) {
    assert.ok(entry["zh-TW"].trim(), `${id}: zh-TW`);
    assert.ok(entry.en.trim(), `${id}: en`);
    assert.doesNotMatch(entry.en, HAN, `${id}: English has no Chinese`);
  }
  assert.ok(viewportMessages["viewport.input.ready"].en.includes("Enter"));
  for (const code of [
    "TRAJECTORY_NOT_AUDIBLE",
    "TRAJECTORY_USE_SET_TRAJECTORY",
    "MOTION_PATH_ACTIVE",
    "PLAYER_RESPAWN_BLOCKED",
  ]) {
    assert.ok(Object.hasOwn(statusCodeKeys, code), code);
    assert.match(formatMessage("zh-TW", code), HAN, code);
    assert.ok(formatMessage("zh-TW", code).includes(`[${code}]`));
    assert.doesNotMatch(formatMessage("en", code), HAN, code);
    assert.ok(formatMessage("en", code).includes(`[${code}]`));
  }
});

test("Delete in the path editor removes the selected point and never the object", () => {
  const model = {
    ...editor("ball"),
    simulationState: "ready" as const,
    recording: { state: "idle" as const, eventCount: 0, durationSeconds: 0, canReplay: false },
  };
  const editing = (selectedPointIndex: number | null): TrajectoryUiState => ({
    editingObjectId: "ball",
    showAll: false,
    selectedPointIndex,
  });
  assert.deepEqual(trajectoryDeleteKey(key("Delete"), model, editing(1)), {
    edit: {
      objectId: "ball",
      trajectory: { ...PATH, offsetsM: [[1, 0, 0]] },
      selectedPointIndex: 0,
    },
  });
  const backspace = trajectoryDeleteKey(key("Backspace"), model, editing(0))?.edit;
  assert.deepEqual(backspace?.trajectory?.offsetsM, [[0, 1, 0]]);
  assert.equal(backspace?.selectedPointIndex, 0, "the next point takes the selection");
  const single = {
    ...model,
    objects: [{ ...ball, trajectory: { ...PATH, offsetsM: [[1, 0, 0] as Vector3] } }, floor],
  };
  assert.deepEqual(trajectoryDeleteKey(key("Delete"), single, editing(0))?.edit, {
    objectId: "ball",
    trajectory: null,
    selectedPointIndex: null,
  });
  // No point selected: the key is consumed, so the App does not remove the ball, and nothing changes.
  assert.deepEqual(trajectoryDeleteKey(key("Delete"), model, editing(null)), { edit: null });
  assert.deepEqual(trajectoryDeleteKey(key("Backspace"), model, editing(5)), { edit: null });
  assert.deepEqual(trajectoryDeleteKey(key("Delete", { ctrlKey: true }), model, editing(1)), {
    edit: null,
  });
  assert.deepEqual(
    trajectoryDeleteKey(key("Delete"), { ...model, simulationState: "running" }, editing(1)),
    { edit: null },
    "read-only while running",
  );
  // Without an editor, or while typing, the key keeps its existing meaning.
  assert.equal(trajectoryDeleteKey(key("Delete"), model, closed), null);
  assert.equal(trajectoryDeleteKey(key("Delete", { typing: true }), model, editing(1)), null);
  assert.equal(trajectoryDeleteKey(key("KeyX"), model, editing(1)), null);
});

type Element = ReactElement<Record<string, unknown>>;
/** Same controlled React-dispatcher technique as help-tip.test.ts: production handlers, no DOM. */
function sectionTree(props: Parameters<typeof TrajectorySection>[0]): Element {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const original = internals.H;
  internals.H = {
    useContext: () => ({
      t: (id: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
        translate("zh-TW", id, params),
      n: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber("zh-TW", value, options),
    }),
    useId: () => "trajectory-test",
  };
  try {
    return TrajectorySection(props) as Element;
  } finally {
    internals.H = original;
  }
}
function byLabel(node: unknown, label: string): Element | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = byLabel(child, label);
      if (found) return found;
    }
    return undefined;
  }
  if (!React.isValidElement(node)) return undefined;
  const element = node as Element;
  if (element.props["aria-label"] === label) return element;
  return byLabel(element.props.children, label);
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
const textOf = (node: unknown): string =>
  Array.isArray(node)
    ? node.map(textOf).join("")
    : React.isValidElement(node)
      ? textOf((node as Element).props.children)
      : typeof node === "string" || typeof node === "number"
        ? String(node)
        : "";
function buttonByText(node: unknown, text: string): Element | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = buttonByText(child, text);
      if (found) return found;
    }
    return undefined;
  }
  if (!React.isValidElement(node)) return undefined;
  const element = node as Element;
  if (element.type === "button" && textOf(element.props.children).includes(text)) return element;
  return buttonByText(element.props.children, text);
}

test("a path left on an object without sound says it does not run and can still be cleared", () => {
  const muted: ObjectView = { ...ball, audible: false };
  const html = render(
    createElement(TrajectorySection, {
      object: muted,
      status: { lengthM: 1, durationS: 0.5, valid: true },
      state: closed,
      dispatch: () => {},
      disabled: false,
    }),
  );
  assert.match(html, /role="status"[^>]*>.*這個物件沒有聲音，所以這條軌跡不會執行/s);
  assert.doesNotMatch(
    html,
    /data-trajectory-point=|type="number"|type="checkbox"/,
    "nothing else to edit",
  );
  const actions: LabAction[] = [];
  const clear = buttonByText(
    sectionTree({
      object: muted,
      state: closed,
      dispatch: (action) => void actions.push(action),
      disabled: false,
    }),
    translate("zh-TW", "trajectory.clear"),
  );
  assert.ok(clear, "the Clear path button is offered");
  (clear.props.onClick as () => void)();
  assert.deepEqual(actions, [{ type: "setTrajectory", objectId: "ball", trajectory: null }]);
  const readOnly = render(
    createElement(TrajectorySection, {
      object: muted,
      state: closed,
      dispatch: () => {},
      disabled: true,
    }),
  );
  assert.match(readOnly, /<button[^>]*disabled=""/, "read-only while the take runs");
});

test("Inspector insert and delete keep the same physical point selected", async () => {
  assert.equal(selectionAfterInsert(2, 0), 3);
  assert.equal(selectionAfterInsert(1, 1), 1);
  assert.equal(selectionAfterInsert(null, 0), null);
  assert.equal(selectionAfterRemove(2, 0, 2), 1);
  assert.equal(selectionAfterRemove(1, 2, 2), 1);
  assert.equal(selectionAfterRemove(1, 1, 2), 1, "the next neighbour");
  assert.equal(selectionAfterRemove(2, 2, 2), 1, "the previous neighbour after the last");
  assert.equal(selectionAfterRemove(0, 0, 0), null);
  const three: ObjectView = {
    ...ball,
    trajectory: {
      ...PATH,
      offsetsM: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    },
  };
  const press = async (
    selectedPointIndex: number,
    label: string,
    dispatch: (action: LabAction) => Promise<void> = () => Promise.resolve(),
  ) => {
    const actions: LabAction[] = [];
    const selections: (number | null)[] = [];
    const tree = sectionTree({
      object: three,
      state: { editingObjectId: "ball", showAll: false, selectedPointIndex },
      dispatch: (action) => {
        actions.push(action);
        return dispatch(action);
      },
      disabled: false,
      onSelectPoint: (index) => selections.push(index),
    });
    const button = byLabel(tree, label);
    assert.ok(button, label);
    (button.props.onClick as () => void)();
    await settle();
    return { actions, selections };
  };
  const insertAfter = (index: number) => translate("zh-TW", "trajectory.insertAfter", { index });
  const remove = (index: number) => translate("zh-TW", "trajectory.deletePoint", { index });
  // Point 2 (index 1) is selected throughout.
  const inserted = await press(1, insertAfter(1));
  assert.equal(inserted.actions.length, 1);
  assert.deepEqual(inserted.selections, [2], "an insert before it moves its index up");
  assert.deepEqual((await press(1, insertAfter(2))).selections, [], "an insert after it");
  assert.deepEqual((await press(1, remove(1))).selections, [0], "a delete before it");
  assert.deepEqual((await press(1, remove(3))).selections, [], "a delete after it");
  assert.deepEqual((await press(1, remove(2))).selections, [], "its next neighbour, same index");
  assert.deepEqual((await press(2, remove(3))).selections, [1], "the previous one after the last");
  const waiting = await press(1, remove(1), () => new Promise(() => {}));
  assert.deepEqual(waiting.selections, [], "the selection follows the commit, not the click");
});

test("viewport path edits build on the latest path, so two fast clicks both land", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    const errors: string[] = [];
    const commit = createTrajectoryEditQueue(app, (message) => errors.push(message));
    // Neither click waits for the other: the second must still see the first's point.
    const [first, second] = await Promise.all([
      commit("ball", (object) => appendOffset(object, [0.5, 0, 0])),
      commit("ball", (object) => appendOffset(object, [1, 0, 0])),
    ]);
    assert.equal(first?.offsetsM.length, 1);
    assert.equal(second?.offsetsM.length, 2);
    assert.deepEqual(
      app.getSnapshot().objects.find((object) => object.id === "ball")?.trajectory?.offsetsM,
      [
        [0.5, 0, 0],
        [1, 0, 0],
      ],
    );
    assert.equal(errors.length, 0);
    const refusing: Pick<LabController, "dispatch" | "getSnapshot"> = {
      getSnapshot: () => app.getSnapshot(),
      dispatch: () => Promise.reject(new Error("TRANSACTION_BUSY")),
    };
    const refused = createTrajectoryEditQueue(refusing, (message) => errors.push(message));
    assert.equal(await refused("ball", (object) => appendOffset(object, [0, 0, 1])), null);
    assert.deepEqual(errors, ["TRANSACTION_BUSY"], "a refusal becomes a notice, not a rejection");
    assert.equal(await refused("ball", (object) => appendOffset(object, [0, 0, 1])), null);
    assert.equal(errors.length, 2, "the queue keeps working after a refusal");
  } finally {
    app.dispose();
  }
});

test("the path editor hint stacks under the viewport's badges and says how to select a point", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const model: LabViewModel = {
      ...app.getSnapshot(),
      selectedObjectId: "ball",
      pauseReason: "作者編輯：暫停並清理舊聲音",
    };
    const trajectory = { ...closed, editingObjectId: "ball" };
    const html = render(createElement(Viewport, { controller: app, model, trajectory }));
    assert.match(
      html,
      /class="viewport-overlay viewport-top-left"><span class="viewport-message">[^<]*<\/span><span class="viewport-path-hint" role="status">軌跡編輯：/,
    );
    assert.match(html, /點擊點以選取，再拖曳移動/);
    assert.doesNotMatch(html, /gizmo-hint/, "no centred hint across the badges");
    const replaying = render(
      createElement(Viewport, {
        controller: app,
        model: { ...model, recording: { ...model.recording, state: "replaying" } },
        trajectory,
      }),
    );
    assert.match(replaying, /運算或重播中僅供檢視/);
    assert.doesNotMatch(replaying, /gizmo-hint/);
  } finally {
    app.dispose();
  }
});
