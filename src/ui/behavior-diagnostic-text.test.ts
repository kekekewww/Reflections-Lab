import test from "node:test";
import assert from "node:assert/strict";
import { behaviorReasonText } from "./behavior-diagnostic-text.js";
import { translate } from "./locale-model.js";
import type { Locale } from "./locale.js";
import { LocaleProvider } from "./locale.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleCard } from "./RuleCard.js";
import type { BehaviorRuleView, LabViewModel } from "./contracts.js";

test("known decision reasons are bilingual and preserve original codes and missing-contact semantics", () => {
  for (const locale of ["zh-TW", "en"] as const) {
    const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
      translate(locale, key, params);
    const cooldown = behaviorReasonText("COOLDOWN", t);
    assert.match(cooldown, /\[COOLDOWN\]/);
    assert.match(cooldown, locale === "en" ? /cooldown/i : /冷卻/);
    const missing = behaviorReasonText("EMITTER_UNAVAILABLE", t, {
      tick: 1,
      sequence: 0,
      action: "reject",
      reason: "EMITTER_UNAVAILABLE",
      emitterAttachment: "contact",
    });
    assert.match(missing, locale === "en" ? /Contact position is missing/ : /缺少接觸位置/);
  }
});

test("unknown original decision detail is preserved in either locale", () => {
  for (const raw of ["NEW_REASON: original 診斷 42", "constructor", "toString", "__proto__"]) {
    for (const locale of ["zh-TW", "en"] as Locale[]) {
      const result = behaviorReasonText(raw, (key, params) => translate(locale, key, params));
      assert.ok(result.includes(raw));
      assert.ok(!result.includes("undefined"));
      assert.ok(!result.includes("[native code]"));
      assert.ok(!result.includes("[object Object]"));
    }
  }
});

test("disabled rule card visibly explains its actual configuration reason without a fabricated decision", () => {
  const rule: BehaviorRuleView = {
    id: "rule.a",
    trigger: "AlwaysOn",
    enabled: false,
    generator: "oscillator",
    gainLinear: 1,
    pitchSemitones: 0,
    cooldownSeconds: 0,
    mappings: [],
    status: "BINDING_DISABLED",
  };
  const html = renderToStaticMarkup(
    createElement(
      LocaleProvider,
      null,
      createElement(RuleCard, {
        rule,
        model: { assets: [] } as unknown as LabViewModel,
        entry: undefined,
        currentProfileId: "profile.a",
        currentRevision: 1,
        currentSceneRevision: 1,
        currentDocumentRevision: 1,
        bindingEnabled: false,
        disabled: false,
        onDraft() {},
        onNumber() {},
        onMappings() {},
        onDiscard() {},
        async onApply() {},
        onDelete() {},
      }),
    ),
  );
  const visibleText = html.replace(/<[^>]*>/g, " ");
  assert.ok(visibleText.includes("物件綁定設定為停用 [BINDING_DISABLED]"));
  assert.equal(rule.diagnostic, undefined);
});
