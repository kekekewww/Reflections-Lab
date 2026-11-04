import assert from "node:assert/strict";
import test from "node:test";
import {
  Children,
  createElement,
  isValidElement,
  memo,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { flushSync, reconciler } from "@react-three/fiber";
import { LabRuntime } from "../app/runtime.js";
import { AudioDiagnostics } from "../audio/diagnostics.js";
import type { LabAction, LabController, LabViewModel } from "./contracts.js";
import { createReactViewStore, equalViewData } from "./view-stability.js";
import { HelpTip } from "./HelpTip.js";
import { Icon } from "./components.js";
import { MappingEditor } from "./MappingEditor.js";
import { appendMapping, createMappingDraft } from "./mapping-model.js";
import { PerformancePanel } from "./PerformancePanel.js";
import { SceneExplorer } from "./SceneExplorer.js";
import { Inspector } from "./Inspector.js";
import { RuleCard } from "./RuleCard.js";
import { BindingOverrideEditor } from "./BindingOverrideEditor.js";
import { LocaleProvider, useLocale } from "./locale.js";
import { formatDiagnosticValue } from "./audio-diagnostics-presentation.js";
import { AnalysisDock } from "./AnalysisDock.js";

type MemoBody<P> = {
  type: (props: P) => ReactNode;
  compare: ((previous: P, next: P) => boolean) | null;
};

/** Use the project's installed React reconciler with a null-output probe: no
 * canvas, DOM, WebGL, browser, timers or renderer package installation. The
 * production component body uses real hooks/context and its actual comparator.
 * Output equivalence uses server rendering in view-output-equivalence.test.ts,
 * a separate Node test process, to avoid mixing secondary context renderers. */
function renderProbe<P extends object>(component: ComponentType<P>) {
  const body: MemoBody<P> =
    typeof component === "function"
      ? { type: component as (props: P) => ReactNode, compare: null }
      : (component as unknown as MemoBody<P>);
  let count = 0;
  let tree: ReactNode;
  let setLocale: ReturnType<typeof useLocale>["setLocale"];
  const Counted = memo((props: P) => {
    count++;
    tree = body.type(props);
    return null;
  }, body.compare ?? undefined);
  function LocaleControl() {
    setLocale = useLocale().setLocale;
    return null;
  }
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  Object.assign(globalThis, {
    document: Object.assign(new EventTarget(), {
      documentElement: { lang: "zh-TW" },
      title: "",
      querySelector: () => null,
      body: null,
    }),
    window: new EventTarget(),
  });
  // R3F bundles the same reconciler already used in production; these sync test
  // entry points are runtime APIs omitted from its public TypeScript declarations.
  const renderer = reconciler as unknown as {
    createContainer: (...args: unknown[]) => unknown;
    updateContainerSync: (...args: unknown[]) => void;
    flushSyncWork: () => void;
    flushPassiveEffects: () => void;
  };
  const fail = (error: unknown) => {
    throw error;
  };
  const root = renderer.createContainer({}, 1, null, false, null, "", fail, fail, fail, null);
  const flush = () => {
    renderer.flushSyncWork();
    renderer.flushPassiveEffects();
  };
  return {
    render(props: P) {
      renderer.updateContainerSync(
        createElement(
          LocaleProvider,
          null,
          createElement(Counted, props),
          createElement(LocaleControl),
        ),
        root,
        null,
        null,
      );
      flush();
      return tree;
    },
    count: () => count,
    act(action: () => void) {
      flushSync(action);
      flush();
      return tree;
    },
    locale(locale: "en" | "zh-TW") {
      flushSync(() => setLocale(locale));
      flush();
    },
    cleanup() {
      renderer.updateContainerSync(null, root, null, null);
      flush();
      Object.assign(globalThis, { document: originalDocument, window: originalWindow });
    },
  };
}

function verifyMemo<P extends object>(component: ComponentType<P>, first: P, equal: P, changed: P) {
  const probe = renderProbe(component);
  let original: ReactNode, updated: ReactNode;
  try {
    original = probe.render(first);
    assert.equal(probe.count(), 1);
    assert.equal(probe.render(equal), original);
    assert.equal(probe.count(), 1, "equal contents must skip the production component body");
    updated = probe.render(changed);
    assert.equal(probe.count(), 2, "changed contents must render immediately");
  } finally {
    probe.cleanup();
  }
  assert.notEqual(original, updated);
}

test("view sharing retains exact contents, changes, optional keys and controller notifications", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    let snapshot = app.getSnapshot();
    let notify = () => {};
    const source: LabController = {
      getSnapshot: () => snapshot,
      subscribe(listener) {
        notify = listener;
        return () => {
          notify = () => {};
        };
      },
      dispatch() {},
      getPose: () => undefined,
    };
    const store = createReactViewStore(source);
    let notifications = 0;
    const off = store.subscribe(() => notifications++);
    const first = store.getSnapshot();
    snapshot = structuredClone(snapshot);
    notify();
    const equalPublication = store.getSnapshot();
    assert.notEqual(
      equalPublication,
      first,
      "new publications must still poll live optional ports",
    );
    assert.equal(equalPublication.objects, first.objects);
    assert.equal(store.getSnapshot(), equalPublication, "reads within one publication stay cached");
    snapshot = { ...structuredClone(snapshot), tick: snapshot.tick + 1, error: "changed" };
    notify();
    const next = store.getSnapshot();
    assert.notEqual(next, first);
    assert.equal(next.objects, first.objects);
    assert.equal(next.behaviors, first.behaviors);
    assert.equal(next.assets, first.assets);
    assert.deepEqual(next, snapshot);
    snapshot = { ...structuredClone(snapshot), error: undefined } as unknown as LabViewModel;
    const withUndefined = store.getSnapshot();
    snapshot = { ...snapshot };
    delete snapshot.error;
    assert.notEqual(store.getSnapshot(), withUndefined);
    assert.deepEqual(store.getSnapshot(), snapshot);
    assert.equal(notifications, 2, "the adapter does not suppress source notifications");
    off();
  } finally {
    app.dispose();
  }
});

test("read-model equality is exact and callbacks/engine instances remain identity-only", () => {
  assert.equal(equalViewData({ n: -0 }, { n: 0 }), false);
  assert.equal(equalViewData({ n: NaN }, { n: NaN }), true);
  assert.equal(equalViewData({}, { optional: undefined }), false);
  assert.equal(equalViewData([], new Array(1)), false);
  assert.equal(equalViewData([1, 2], [2, 1]), false);
  assert.equal(equalViewData({ callback() {} }, { callback() {} }), false);
  assert.equal(equalViewData(new Date(0), new Date(0)), false);
});

test("content-equal publications still refresh live controller ports through the subscription hook", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  let snapshot = app.getSnapshot();
  let notify = () => {};
  let reads = 0;
  const controller: LabController = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      notify = listener;
      return () => {
        notify = () => {};
      };
    },
    getPose: () => undefined,
    dispatch() {},
    getAudioDiagnostics() {
      reads++;
      return null;
    },
  };
  const store = createReactViewStore(controller);
  function Poller() {
    useSyncExternalStore(store.subscribe, store.getSnapshot);
    controller.getAudioDiagnostics?.();
    return null;
  }
  const probe = renderProbe(Poller);
  try {
    probe.render({});
    assert.equal(reads, 1);
    snapshot = structuredClone(snapshot);
    probe.act(notify);
    assert.equal(reads, 2, "an equal read model must not suppress the live-port poll");
  } finally {
    probe.cleanup();
    app.dispose();
  }
});

test("HelpTip and Icon skip equal props and render changed inputs", () => {
  verifyMemo(
    HelpTip,
    { topic: "Position", content: "Metres" },
    { topic: "Position", content: "Metres" },
    { topic: "Position", content: "Updated metres" },
  );
  verifyMemo(
    Icon,
    { name: "play", size: 16 },
    { name: "play", size: 16 },
    { name: "pause", size: 16 },
  );
});

test("analysis sections skip unrelated publications but retain changed live data", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const parent = renderProbe(AnalysisDock);
  let tree: ReactNode;
  const model = app.getSnapshot();
  try {
    tree = parent.render({ controller: app, model });
  } finally {
    parent.cleanup();
    app.dispose();
  }
  type Props = { model: LabViewModel; send: (action: LabAction) => void };
  function findPanel(
    node: ReactNode,
    name: string,
  ): { component: ComponentType<Props>; props: Props } | undefined {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children?: ReactNode }>(child)) continue;
      const type = child.type as unknown as MemoBody<Props>;
      if (type.type?.name === name)
        return {
          component: child.type as ComponentType<Props>,
          props: child.props as unknown as Props,
        };
      const found = findPanel(child.props.children, name);
      if (found) return found;
    }
    return undefined;
  }
  const changes: Record<string, LabViewModel> = {
    EventsPanelView: {
      ...model,
      recording: { ...model.recording, eventCount: model.recording.eventCount + 1 },
    },
    PathsPanelView: {
      ...model,
      paths: [
        {
          id: "memo-direct",
          kind: "direct",
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
          distanceM: 1,
          delaySeconds: 0.0029,
        },
      ],
    },
    ComparisonPanelView: {
      ...model,
      comparison: { ...model.comparison, hasA: !model.comparison.hasA },
    },
    AgentPanelView: { ...model, ai: { ...model.ai, message: "Updated agent status" } },
  };
  for (const [name, changed] of Object.entries(changes)) {
    const panel = findPanel(tree, name);
    assert.ok(panel, name);
    verifyMemo(
      panel.component,
      panel.props,
      { ...panel.props, model: { ...structuredClone(model), tick: model.tick + 1 } },
      { ...panel.props, model: changed },
    );
  }
});

test("MappingEditor skips cloned drafts but renders raw input changes and new callbacks", () => {
  const first = { state: appendMapping(createMappingDraft([])), disabled: false, onChange() {} };
  const state = structuredClone(first.state);
  state.mappings[0]!.outputMax = "0.5";
  const changed = { ...first, state };
  verifyMemo(MappingEditor, first, { ...first, state: structuredClone(first.state) }, changed);
  const probe = renderProbe(MappingEditor);
  try {
    probe.render(first);
    probe.render({ ...first, onChange() {} });
    assert.equal(probe.count(), 2, "new handlers must never be retained as stale closures");
  } finally {
    probe.cleanup();
  }
});

test("PerformancePanel skips equal snapshots but immediately shows new live counters", () => {
  const diagnostics = new AudioDiagnostics();
  diagnostics.recordFrame("accepted", 0.5);
  const first = { diagnostics: diagnostics.snapshot(), onEnabledChange() {} };
  diagnostics.recordFrame("accepted", 1.25);
  verifyMemo(
    PerformancePanel,
    first,
    { ...first, diagnostics: structuredClone(first.diagnostics) },
    { ...first, diagnostics: diagnostics.snapshot() },
  );
});

test("memo boundaries do not suppress locale context updates", () => {
  const probe = renderProbe(HelpTip);
  try {
    probe.render({ topic: "Position", content: "Metres" });
    probe.locale("en");
    assert.equal(probe.count(), 2, "unchanged props still render on a locale change");
  } finally {
    probe.cleanup();
  }
});

test("HelpTip memo retains immediate focus/blur state updates and never keeps an old child handler", () => {
  const probe = renderProbe(HelpTip);
  const props = { topic: "Position", content: "Metres" };
  const elements = (node: ReactNode) => {
    assert.ok(isValidElement<{ children: ReactNode }>(node));
    return Children.toArray(node.props.children).filter(isValidElement) as Array<{
      props: { hidden?: boolean; onFocus: () => void; onBlur: () => void; onClick: () => void };
    }>;
  };
  try {
    let children = elements(probe.render(props));
    assert.equal(children[1]!.props.hidden, true);
    children = elements(probe.act(() => children[0]!.props.onFocus()));
    assert.equal(children[1]!.props.hidden, false);
    assert.equal(probe.count(), 2);
    probe.render({ ...props });
    assert.equal(probe.count(), 2);
    children = elements(probe.act(() => children[0]!.props.onBlur()));
    assert.equal(children[1]!.props.hidden, true);
    let invoked = "";
    probe.render({
      ...props,
      children: createElement(
        "button",
        {
          onClick: () => {
            invoked = "old";
          },
        },
        "Position",
      ),
    });
    children = elements(
      probe.render({
        ...props,
        children: createElement(
          "button",
          {
            onClick: () => {
              invoked = "new";
            },
          },
          "Position",
        ),
      }),
    );
    children[0]!.props.onClick();
    assert.equal(invoked, "new");
  } finally {
    probe.cleanup();
  }
});

test("SceneExplorer and Inspector ignore unrelated publications, preserve selection and values", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    const model = app.getSnapshot();
    const unrelated = { ...structuredClone(model), tick: model.tick + 1, simTimeSeconds: 12 };
    unrelated.objects[0]!.velocityMps = [5, 1, 0];
    const first = { controller: app, model, onListener() {} };
    verifyMemo(
      SceneExplorer,
      first,
      { ...first, model: unrelated },
      { ...first, model: { ...model, selectedObjectId: "speaker" } },
    );
    const inspector = { controller: app, model };
    verifyMemo(
      Inspector,
      inspector,
      { ...inspector, model: { ...structuredClone(model), tick: 123 } },
      { ...inspector, model: { ...model, selectedObjectId: "speaker" } },
    );
  } finally {
    app.dispose();
  }
});

test("RuleCard and binding editor compare cloned content and invalidate edits/revisions", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const model = app.getSnapshot();
    const behavior = model.behaviors.find((item) => item.rules.length)!;
    const rule = behavior.rules[0]!;
    const first = {
      rule,
      model,
      entry: undefined,
      currentProfileId: behavior.profileId,
      currentRevision: behavior.revision,
      currentSceneRevision: model.sceneRevision,
      currentDocumentRevision: behavior.documentRevision,
      bindingEnabled: behavior.bindingEnabled,
      disabled: false,
      onDraft() {},
      onNumber() {},
      onMappings() {},
      onDiscard() {},
      async onApply() {},
      onDelete() {},
    };
    verifyMemo(
      RuleCard,
      first,
      { ...first, rule: structuredClone(rule), model: structuredClone(model) },
      { ...first, rule: { ...rule, gainLinear: rule.gainLinear + 0.1 } },
    );
    const binding = {
      model,
      behavior,
      rule,
      entry: undefined,
      disabled: false,
      onChange() {},
      async onApply() {},
      onDiscard() {},
      async onClear() {},
    };
    verifyMemo(
      BindingOverrideEditor,
      binding,
      {
        ...binding,
        model: structuredClone(model),
        behavior: structuredClone(behavior),
        rule: structuredClone(rule),
      },
      { ...binding, disabled: true },
    );
  } finally {
    app.dispose();
  }
});

test("cached diagnostics formatting is identical to Intl for both locales and precision levels", () => {
  for (const locale of ["zh-TW", "en"])
    for (const digits of [0, 2, 6])
      for (const value of [-0, -1234.56789, 0, 0.00001, 1234567.89, NaN, Infinity])
        assert.equal(
          formatDiagnosticValue(value, locale, digits),
          Number.isFinite(value)
            ? new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)
            : "—",
        );
});
