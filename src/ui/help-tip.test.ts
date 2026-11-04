import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LabRuntime } from "../app/runtime.js";
import { LocaleProvider } from "./locale.js";
import { formatMessage } from "./locale-model.js";
import { Inspector } from "./Inspector.js";
import { SceneExplorer } from "./SceneExplorer.js";
import { HelpTip } from "./HelpTip.js";
import { DimensionsFields } from "./Inspector.js";
import { NumberField } from "./components.js";
import { AnalysisDock } from "./AnalysisDock.js";
import { ProjectImportButton } from "./ProjectImport.js";
import { translate, formatNumber } from "./locale-model.js";
import type { Locale } from "./locale-types.js";
import type { ObjectView, Vector3 } from "./contracts.js";

const render = (child: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(LocaleProvider, null, child));
// Handler tests exercise the body directly with the existing controlled dispatcher.
const helpTipBody = (
  HelpTip as unknown as {
    type: (props: Parameters<typeof HelpTip>[0]) => Node;
  }
).type;

test("review3 8: preview evidence stays visible and disabled rule/export reasons are specific", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    const base = app.getSnapshot();
    const model = {
      ...base,
      simulationState: "running" as const,
      preview: { ...base.preview!, status: "starting" as const },
    };
    const inspector = render(createElement(Inspector, { controller: app, model }));
    assert.match(inspector, /class="evidence-tag">非正式量測<\/span>/);
    assert.match(inspector, /role="tooltip" hidden=""[^>]*>請先暫停運算，並結束重播後再新增規則。/);
    const analysis = render(createElement(AnalysisDock, { controller: app, model: base }));
    assert.match(
      analysis,
      /role="tooltip" hidden=""[^>]*>尚無已封存錄製；請先錄製並停止後再匯出。/,
    );
  } finally {
    app.dispose();
  }
});

test("R21 helper explanations are no longer Inspector paragraphs", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    const html = render(createElement(Inspector, { controller: app, model: app.getSnapshot() }));
    assert.doesNotMatch(html, /<p[^>]*>聲音內容自由設定/);
    assert.doesNotMatch(html, /<details class="inspector-help"/);
  } finally {
    app.dispose();
  }
});

test("R21 disabled add primitive reason is focus-reachable instead of title-only", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const model = { ...app.getSnapshot(), simulationState: "running" as const };
    const html = render(createElement(SceneExplorer, { controller: app, model, onListener() {} }));
    assert.match(html, /aria-label="說明：[^"]+"[^>]*aria-describedby=/);
    assert.match(html, /role="tooltip"[^>]*>請先暫停再新增物件/);
  } finally {
    app.dispose();
  }
});

test("R21 sphere Inspector exposes one diameter instead of independent dimension axes", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    const html = render(createElement(Inspector, { controller: app, model: app.getSnapshot() }));
    assert.match(html, />直徑</);
  } finally {
    app.dispose();
  }
});

test("R21 invalid single-axis sphere edits carry a catalogued English reason", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const ball = app.getSnapshot().objects.find((object) => object.id === "ball")!;
    await app.dispatch({
      type: "patchObject",
      objectId: "ball",
      patch: {
        dimensionsM: [ball.dimensionsM[0] + 0.1, ball.dimensionsM[1], ball.dimensionsM[2]],
      },
    });
    const error = app.getSnapshot().error;
    assert.ok(error, "domain must still reject an inconsistent sphere");
    assert.match(formatMessage("en", error), /sphere.*diameter/i);
    assert.doesNotMatch(formatMessage("en", error), /[\u3400-\u9fff]/);
  } finally {
    app.dispose();
  }
});

// Same controlled React-dispatcher technique as viewport/fps-entry-coordination.test.ts.
// It exercises production event handlers, not native DOM layout; browser coverage is separate.
function hooks(locale: Locale = "zh-TW", runLayoutEffects = false) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const original = {
    dispatcher: internals.H,
    window: globalThis.window,
    document: globalThis.document,
  };
  let cursor = 0;
  let stateUpdates = 0;
  const slots: unknown[] = [];
  const effects = new Map<number, { deps: readonly unknown[]; cleanup?: () => void }>();
  const pending = new Map<
    number,
    { effect: () => void | (() => void); deps: readonly unknown[] }
  >();
  internals.H = {
    useContext: () => ({
      t: (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
        translate(locale, key, params),
      n: (value: number) => formatNumber(locale, value),
      message: (raw: string) => formatMessage(locale, raw),
    }),
    useId: () => "test-help-id",
    useRef: (value: unknown) => {
      const index = cursor++;
      return (slots[index] ??= { current: value });
    },
    useState: (value: unknown) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [
        slots[index],
        (next: unknown) => {
          stateUpdates++;
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    useLayoutEffect(effect: () => void | (() => void), deps: readonly unknown[]) {
      if (!runLayoutEffects) return;
      const index = cursor++;
      const previous = effects.get(index);
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i])))
        pending.set(index, { effect, deps });
    },
    useEffect() {},
  };
  Object.assign(globalThis, {
    window: { matchMedia: () => ({ matches: true }) },
    document: { body: null },
  });
  return {
    render<T>(fn: () => T): T {
      cursor = 0;
      return fn();
    },
    flushEffects() {
      for (const index of pending.keys()) effects.get(index)?.cleanup?.();
      for (const [index, { effect, deps }] of pending) {
        const cleanup = effect();
        effects.set(index, { deps, ...(cleanup ? { cleanup } : {}) });
      }
      pending.clear();
    },
    get stateUpdates() {
      return stateUpdates;
    },
    cleanup() {
      for (const { cleanup } of effects.values()) cleanup?.();
      internals.H = original.dispatcher;
      Object.assign(globalThis, { window: original.window, document: original.document });
    },
  };
}
type Node = ReactElement<Record<string, any>>;
const childrenOf = (node: Node) =>
  React.Children.toArray(node.props.children).filter(React.isValidElement) as Node[];

function positionedTip(withObserver = true) {
  const h = hooks("zh-TW", true);
  const originalObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  const surface = () => {
    const listeners = new Map<string, Set<(event: any) => void>>();
    return {
      listeners,
      addEventListener(type: string, listener: (event: any) => void, capture = false) {
        const key = `${type}:${capture}`;
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key)!.add(listener);
      },
      removeEventListener(type: string, listener: (event: any) => void, capture = false) {
        listeners.get(`${type}:${capture}`)?.delete(listener);
      },
      fire(type: string, event = {}) {
        for (const [key, callbacks] of listeners)
          if (key.startsWith(`${type}:`)) for (const callback of callbacks) callback(event);
      },
      get count() {
        return [...listeners.values()].reduce((total, callbacks) => total + callbacks.size, 0);
      },
    };
  };
  const viewport = Object.assign(surface(), {
    offsetLeft: 0,
    offsetTop: 0,
    width: 800,
    height: 600,
  });
  const win = Object.assign(surface(), {
    matchMedia: () => ({ matches: true }),
    innerWidth: 800,
    innerHeight: 600,
    visualViewport: viewport,
  });
  const doc = Object.assign(surface(), { body: null, activeElement: {} });
  Object.assign(globalThis, { window: win, document: doc });
  let measurements = 0;
  const target = { left: 100, top: 100, bottom: 120, width: 30, height: 20 };
  const box = { width: 120, height: 40 };
  const anchor = {
    getBoundingClientRect: () => {
      measurements++;
      return target;
    },
    closest: () => null,
    contains: (element: unknown) => element === doc.activeElement,
  };
  const bubble = {
    getBoundingClientRect: () => {
      measurements++;
      return box;
    },
  };
  const observers: FakeObserver[] = [];
  class FakeObserver {
    observed = new Set<unknown>();
    disconnected = false;
    constructor(readonly notify: () => void) {
      observers.push(this);
    }
    observe(element: unknown) {
      this.observed.add(element);
    }
    disconnect() {
      this.disconnected = true;
      this.observed.clear();
    }
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: withObserver ? FakeObserver : undefined,
  });
  let tree: Node;
  const renderTip = (content = "位置說明") => {
    tree = h.render(() => helpTipBody({ topic: "位置", content }));
    tree.props.ref.current = anchor;
    childrenOf(tree)[1]!.props.ref.current = bubble;
    h.flushEffects();
    return tree;
  };
  renderTip();
  return {
    h,
    win,
    doc,
    viewport,
    target,
    box,
    anchor,
    bubble,
    observers,
    renderTip,
    get measurements() {
      return measurements;
    },
    open() {
      childrenOf(tree)[0]!.props.onFocus();
      return renderTip();
    },
    close() {
      childrenOf(tree)[0]!.props.onBlur();
      return renderTip();
    },
    cleanup() {
      h.cleanup();
      if (originalObserver) Object.defineProperty(globalThis, "ResizeObserver", originalObserver);
      else Reflect.deleteProperty(globalThis, "ResizeObserver");
    },
  };
}

test("open HelpTip ignores content-only publications and observes both sizes until close/unmount", () => {
  const tip = positionedTip();
  try {
    tip.open();
    assert.equal(tip.measurements, 2);
    assert.equal(tip.observers.length, 1);
    const observer = tip.observers[0]!;
    assert.deepEqual([...observer.observed], [tip.anchor, tip.bubble]);
    const updates = tip.h.stateUpdates;
    tip.renderTip("更新說明");
    assert.equal(tip.measurements, 2, "same-size content does not force layout");
    assert.equal(tip.observers.length, 1, "content does not reinstall the open effect");
    tip.win.fire("resize");
    assert.equal(tip.h.stateUpdates, updates, "identical coordinates do not call setPosition");
    tip.box.height = 80;
    observer.notify();
    assert.equal(tip.measurements, 6);
    tip.target.left = 750;
    tip.target.width = 50;
    tip.target.height = 30;
    tip.target.bottom = 130;
    observer.notify();
    const style = childrenOf(tip.renderTip())[1]!.props.style;
    assert.equal(style.left, 672);
    assert.equal(style.top, 138);
    tip.close();
    assert.equal(observer.disconnected, true);
    assert.equal(observer.observed.size, 0);
    const afterClose = tip.measurements;
    observer.notify();
    assert.equal(
      tip.measurements,
      afterClose,
      "a late observer callback cannot measure a closed tip",
    );
    tip.open();
    assert.equal(tip.observers.length, 2);
  } finally {
    tip.cleanup();
  }
  assert.ok(tip.observers.every((observer) => observer.disconnected));
  const afterUnmount = tip.measurements;
  for (const observer of tip.observers) observer.notify();
  assert.equal(tip.measurements, afterUnmount);
});

test("HelpTip keeps above/below placement and viewport clamping for the same geometry", () => {
  const tip = positionedTip();
  try {
    tip.open();
    for (const scenario of [
      {
        left: 100,
        top: 100,
        bottom: 120,
        boxWidth: 120,
        boxHeight: 40,
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        expected: [100, 128],
      },
      {
        left: 750,
        top: 570,
        bottom: 590,
        boxWidth: 120,
        boxHeight: 40,
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        expected: [672, 522],
      },
      {
        left: -10,
        top: -10,
        bottom: 10,
        boxWidth: 900,
        boxHeight: 700,
        x: 20,
        y: 30,
        width: 400,
        height: 300,
        expected: [28, 38],
      },
    ]) {
      Object.assign(tip.target, {
        left: scenario.left,
        top: scenario.top,
        bottom: scenario.bottom,
      });
      Object.assign(tip.box, { width: scenario.boxWidth, height: scenario.boxHeight });
      Object.assign(tip.viewport, {
        offsetLeft: scenario.x,
        offsetTop: scenario.y,
        width: scenario.width,
        height: scenario.height,
      });
      tip.viewport.fire("resize");
      const { left, top } = childrenOf(tip.renderTip())[1]!.props.style;
      assert.deepEqual([left, top], scenario.expected);
    }
  } finally {
    tip.cleanup();
  }
});

test("HelpTip retains viewport/window listeners and Escape/blur close behavior without leaks", () => {
  const tip = positionedTip();
  try {
    tip.open();
    assert.equal(tip.win.count, 3);
    assert.equal(tip.viewport.count, 2);
    assert.equal(tip.doc.count, 1);
    assert.equal(tip.win.listeners.get("scroll:true")?.size, 1);
    assert.equal(tip.doc.listeners.get("keydown:true")?.size, 1);
    for (const [surface, event] of [
      [tip.win, "resize"],
      [tip.win, "scroll"],
      [tip.viewport, "resize"],
      [tip.viewport, "scroll"],
    ] as const) {
      const before = tip.measurements;
      surface.fire(event);
      assert.equal(tip.measurements, before + 2);
    }
    let prevented = 0,
      stopped = 0;
    tip.doc.fire("keydown", { key: "Enter" });
    assert.equal(childrenOf(tip.renderTip())[1]!.props.hidden, false);
    tip.doc.fire("keydown", {
      key: "Escape",
      preventDefault: () => prevented++,
      stopPropagation: () => stopped++,
    });
    assert.equal(childrenOf(tip.renderTip())[1]!.props.hidden, true);
    assert.equal(prevented, 1);
    assert.equal(stopped, 1);
    assert.equal(tip.win.count + tip.viewport.count + tip.doc.count, 0);
    tip.open();
    tip.win.fire("blur");
    assert.equal(childrenOf(tip.renderTip())[1]!.props.hidden, true);
    tip.open();
  } finally {
    tip.cleanup();
  }
  assert.equal(tip.win.count + tip.viewport.count + tip.doc.count, 0);
});

test("HelpTip without ResizeObserver retains content-change measurement without reinstalling listeners", () => {
  const tip = positionedTip(false);
  try {
    tip.open();
    assert.equal(tip.measurements, 2);
    const resize = [...tip.win.listeners.get("resize:false")!][0];
    tip.renderTip("新的說明");
    assert.equal(tip.measurements, 4);
    assert.equal([...tip.win.listeners.get("resize:false")!][0], resize);
    tip.renderTip("新的說明");
    assert.equal(tip.measurements, 4);
    tip.close();
    tip.renderTip("關閉時更新");
    assert.equal(tip.measurements, 4);
    assert.equal(tip.win.count + tip.viewport.count + tip.doc.count, 0);
  } finally {
    tip.cleanup();
  }
});

test("HelpTip production handlers expose described text on fine hover and focus, dismiss on Esc/blur/leave", () => {
  const h = hooks();
  try {
    const renderTip = () => h.render(() => helpTipBody({ topic: "位置", content: "位置說明" }));
    let tree = renderTip();
    let [trigger, tooltip] = childrenOf(tree);
    assert.equal(trigger!.props["aria-label"], "說明：位置");
    assert.equal(trigger!.props["aria-describedby"], tooltip!.props.id);
    assert.equal(tooltip!.props.role, "tooltip");
    assert.equal(tooltip!.props.hidden, true);
    trigger!.props.onPointerEnter({ pointerType: "mouse" });
    tree = renderTip();
    assert.match(childrenOf(tree)[1]!.props.className, /help-tip-bubble/);
    childrenOf(tree)[0]!.props.onPointerLeave({ pointerType: "mouse" });
    tree = renderTip();
    assert.equal(childrenOf(tree)[1]!.props.hidden, true);
    childrenOf(tree)[0]!.props.onFocus();
    tree = renderTip();
    assert.match(childrenOf(tree)[1]!.props.className, /help-tip-bubble/);
    let stopped = false;
    childrenOf(tree)[0]!.props.onKeyDown({
      key: "Escape",
      preventDefault() {},
      stopPropagation() {
        stopped = true;
      },
    });
    tree = renderTip();
    assert.ok(stopped, "Esc only dismisses the topmost tooltip");
    assert.equal(childrenOf(tree)[1]!.props.hidden, true);
    childrenOf(tree)[0]!.props.onFocus();
    tree = renderTip();
    childrenOf(tree)[0]!.props.onBlur();
    tree = renderTip();
    assert.equal(childrenOf(tree)[1]!.props.hidden, true);
    assert.equal(
      childrenOf(tree)[1]!.props.children,
      "位置說明",
      "closed descriptions remain readable to AT",
    );
  } finally {
    h.cleanup();
  }
});

test("touch taps toggle without residual hover; disabled controls get a focusable reason and send no command", () => {
  const h = hooks("en");
  let commands = 0;
  try {
    const renderTip = () =>
      h.render(() =>
        helpTipBody({
          topic: "Add sphere",
          content: "Pause before adding an object",
          children: createElement(
            "button",
            {
              disabled: true,
              onClick() {
                commands++;
              },
            },
            "Add sphere",
          ),
        }),
      );
    let tree = renderTip();
    assert.equal(childrenOf(tree)[0]!.props.disabled, true);
    assert.equal(childrenOf(tree)[1]!.props["aria-label"], "About Add sphere");
    childrenOf(tree)[1]!.props.onPointerEnter({ pointerType: "touch" });
    tree = renderTip();
    assert.match(childrenOf(tree)[2]!.props.className, /sr-only/);
    childrenOf(tree)[1]!.props.onPointerDown({ pointerType: "touch" });
    childrenOf(tree)[1]!.props.onFocus();
    childrenOf(tree)[1]!.props.onClick();
    tree = renderTip();
    assert.match(childrenOf(tree)[2]!.props.className, /help-tip-bubble/);
    childrenOf(tree)[1]!.props.onPointerLeave({ pointerType: "touch" });
    tree = renderTip();
    assert.match(childrenOf(tree)[2]!.props.className, /help-tip-bubble/);
    childrenOf(tree)[1]!.props.onPointerDown({ pointerType: "touch" });
    childrenOf(tree)[1]!.props.onClick();
    tree = renderTip();
    assert.match(childrenOf(tree)[2]!.props.className, /sr-only/);
    childrenOf(tree)[1]!.props.onFocus();
    tree = renderTip();
    childrenOf(tree)[1]!.props.onBlur();
    tree = renderTip();
    childrenOf(tree)[1]!.props.onFocus();
    tree = renderTip();
    assert.match(childrenOf(tree)[2]!.props.className, /help-tip-bubble/);
    assert.equal(commands, 0);
  } finally {
    h.cleanup();
  }
});

test("sphere diameter field commits three axes atomically, capsule fields keep x=z and reject short height in both locales", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const object = app.getSnapshot().objects.find((entry) => entry.id === "ball")!;
    let dimensions: Vector3 | undefined;
    const h = hooks();
    try {
      const tree = h.render(() =>
        DimensionsFields({
          object,
          disabled: false,
          onCommit: (next) => {
            dimensions = next;
          },
        }),
      );
      const fields = childrenOf(childrenOf(tree)[1]!);
      assert.equal(fields.length, 1);
      fields[0]!.props.onCommit(0.8);
      assert.deepEqual(dimensions, [0.8, 0.8, 0.8]);
    } finally {
      h.cleanup();
    }
    const revision = app.getSnapshot().sceneRevision;
    await app.dispatch({
      type: "patchObject",
      objectId: "ball",
      patch: { dimensionsM: dimensions! },
    });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(app.getSnapshot().sceneRevision, revision + 1);
    assert.deepEqual(
      app.getSnapshot().objects.find((entry) => entry.id === "ball")!.dimensionsM,
      [0.8, 0.8, 0.8],
    );
    await app.dispatch({ type: "undo" });
    assert.deepEqual(
      app.getSnapshot().objects.find((entry) => entry.id === "ball")!.dimensionsM,
      object.dimensionsM,
    );
    for (const locale of ["zh-TW", "en"] as const) {
      const h = hooks(locale);
      try {
        const capsule = { ...object, shape: "capsule", dimensionsM: [0.5, 1, 0.5] } as ObjectView;
        const tree = h.render(() =>
          DimensionsFields({
            object: capsule,
            disabled: false,
            onCommit: (next) => {
              dimensions = next;
            },
          }),
        );
        const [diameter, height] = childrenOf(childrenOf(tree)[1]!);
        diameter!.props.onCommit(0.6);
        assert.deepEqual(dimensions, [0.6, 1, 0.6]);
        const props = height!.props as Parameters<typeof NumberField>[0];
        const field = () => h.render(() => NumberField(props));
        let input = childrenOf(field())[1]!;
        input.props.onChange({ target: { value: "0.4" } });
        input = childrenOf(field())[1]!;
        input.props.onKeyDown({ key: "Enter", nativeEvent: {}, preventDefault() {} });
        const invalid = field();
        assert.equal(childrenOf(invalid)[1]!.props["aria-invalid"], true);
        assert.equal(
          childrenOf(invalid)[1]!.props["aria-describedby"],
          childrenOf(invalid)[2]!.props.id,
        );
        assert.equal(
          childrenOf(invalid)[2]!.props.children,
          translate(locale, "help.heightInvalid"),
        );
        assert.equal(childrenOf(invalid)[1]!.props.value, "0.4", "invalid raw input is retained");
        assert.deepEqual(dimensions, [0.6, 1, 0.6], "invalid height sends no command");
      } finally {
        h.cleanup();
      }
    }
  } finally {
    app.dispose();
  }
});

test("main panels keep helpers in described tooltips, including listener and import views", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    for (const objectId of ["ball", "speaker"]) {
      await app.dispatch({ type: "selectObject", objectId });
      const html = render(createElement(Inspector, { controller: app, model: app.getSnapshot() }));
      assert.doesNotMatch(html, /class="(?:section-copy|inspector-help)"/);
      assert.match(html, /role="tooltip"[^>]*>聲音內容自由設定/);
      assert.match(html, /role="tooltip"[^>]*>作者控制曲線/);
    }
    const listener = render(
      createElement(Inspector, { controller: app, model: app.getSnapshot(), showListener: true }),
    );
    assert.doesNotMatch(listener, /<p[^>]*>(?:觀察相機|真空不取消|選取場景物件)/);
    assert.match(listener, /role="tooltip"[^>]*>真空不取消/);
    const explorer = render(
      createElement(SceneExplorer, { controller: app, model: app.getSnapshot(), onListener() {} }),
    );
    assert.doesNotMatch(explorer, /<p[^>]*>PCM|class="explorer-footnote"/);
    const dock = render(createElement(AnalysisDock, { controller: app, model: app.getSnapshot() }));
    assert.doesNotMatch(dock, /<p[^>]*>(?:聲學 A\/B|目前只使用本機受限指令|Ctrl \/)/);
    assert.match(dock, /role="tooltip"[^>]*>目前只使用本機受限指令/);
    const project = render(createElement(ProjectImportButton, { controller: app, disabled: true }));
    assert.doesNotMatch(project, /class="section-copy"/);
    assert.match(
      project,
      /套用將替換目前工作區專案。<\/p>/,
      "replacement consequence stays visible",
    );
  } finally {
    app.dispose();
  }
});

test("a retained capsule validation error follows the current locale without changing the raw edit", () => {
  const h = hooks();
  let locale: Locale = "zh-TW";
  let commands = 0;
  try {
    const field = () =>
      h.render(() =>
        NumberField({
          label: "Height",
          value: 1,
          min: 0.01,
          max: 100,
          invalidReason: (value) =>
            value < 0.5 ? translate(locale, "help.heightInvalid") : undefined,
          onCommit() {
            commands++;
          },
        }),
      );
    childrenOf(field())[1]!.props.onChange({ target: { value: "0.4" } });
    childrenOf(field())[1]!.props.onKeyDown({ key: "Enter", nativeEvent: {}, preventDefault() {} });
    assert.equal(childrenOf(field())[2]!.props.children, translate("zh-TW", "help.heightInvalid"));
    locale = "en";
    assert.equal(childrenOf(field())[2]!.props.children, translate("en", "help.heightInvalid"));
    assert.equal(childrenOf(field())[1]!.props.value, "0.4");
    assert.equal(commands, 0);
  } finally {
    h.cleanup();
  }
});
