import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LabRuntime } from "../app/runtime.js";
import { AudioDiagnostics } from "../audio/diagnostics.js";
import { HelpTip } from "./HelpTip.js";
import { Icon } from "./components.js";
import { MappingEditor } from "./MappingEditor.js";
import { appendMapping, createMappingDraft } from "./mapping-model.js";
import { PerformancePanel } from "./PerformancePanel.js";
import { SceneExplorer } from "./SceneExplorer.js";
import { Inspector } from "./Inspector.js";
import { RuleCard } from "./RuleCard.js";
import { BindingOverrideEditor } from "./BindingOverrideEditor.js";
import { createBindingDraft } from "./binding-drafts.js";
import { LocaleProvider } from "./locale.js";

function sameOutput<P extends object>(component: ComponentType<P>, props: P) {
  const body = (component as unknown as { type: ComponentType<P> }).type;
  const serialize = (type: ComponentType<P>) =>
    renderToStaticMarkup(createElement(LocaleProvider, null, createElement(type, props)));
  assert.equal(
    serialize(component),
    serialize(body),
    "memoized and unmemoized serialized trees must match every tag, attribute and value",
  );
}

test("memoized trees match their unmemoized bodies in both locales, including changed inputs and guards", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const originalWindow = globalThis.window;
  try {
    await app.dispatch({ type: "selectObject", objectId: "ball" });
    const model = app.getSnapshot();
    const diagnostics = new AudioDiagnostics();
    diagnostics.recordFrame("accepted", 1.2345);
    const behavior = model.behaviors.find((item) => item.rules.length)!;
    const rule = behavior.rules[0]!;
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
    for (const locale of ["zh-TW", "en"]) {
      Object.assign(globalThis, { window: { localStorage: { getItem: () => locale } } });
      for (const disabled of [false, true]) {
        sameOutput(HelpTip, { topic: "Position", content: "Metres" });
        sameOutput(HelpTip, {
          topic: "Position",
          content: "Updated metres",
          children: createElement("button", { disabled, onClick() {} }, "Position"),
        });
        sameOutput(Icon, { name: disabled ? "pause" : "play", size: disabled ? 22 : 16 });
        sameOutput(Icon, { name: "unknown-icon" });
        const state = appendMapping(createMappingDraft([]));
        sameOutput(MappingEditor, { state, disabled, onChange() {} });
        state.mappings[0]!.outputMax = "0.5000";
        sameOutput(MappingEditor, { state, disabled, onChange() {} });
        state.mappings[0]!.curve[0]!.x = "invalid";
        sameOutput(MappingEditor, { state, disabled, onChange() {} });
        sameOutput(PerformancePanel, {
          diagnostics: disabled ? null : diagnostics.snapshot(),
          onEnabledChange() {},
        });
        sameOutput(SceneExplorer, { controller: app, model, onListener() {} });
        sameOutput(Inspector, { controller: app, model, showListener: disabled });
        sameOutput(RuleCard, {
          rule: { ...rule, enabled: !disabled },
          model,
          entry: undefined,
          currentProfileId: behavior.profileId,
          currentRevision: behavior.revision,
          currentSceneRevision: model.sceneRevision,
          currentDocumentRevision: behavior.documentRevision,
          bindingEnabled: behavior.bindingEnabled,
          disabled,
          onDraft() {},
          onNumber() {},
          onMappings() {},
          onDiscard() {},
          async onApply() {},
          onDelete() {},
        });
        sameOutput(BindingOverrideEditor, { ...binding, disabled });
        const entry = createBindingDraft(model, behavior, rule);
        entry.fields.gainLinear = true;
        entry.values.gainLinear = "not a number";
        sameOutput(BindingOverrideEditor, { ...binding, entry, disabled });
        sameOutput(BindingOverrideEditor, {
          ...binding,
          entry,
          model: { ...model, sceneRevision: model.sceneRevision + 1 },
          disabled,
        });
      }
    }
  } finally {
    Object.assign(globalThis, { window: originalWindow });
    app.dispose();
  }
});
