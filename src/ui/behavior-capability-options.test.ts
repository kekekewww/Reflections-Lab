import assert from "node:assert/strict";
import test from "node:test";
import {
  getSoundBehaviorCapabilities,
  PRODUCT_SOUND_BEHAVIOR_PRODUCERS,
} from "../capabilities/sound-behavior.js";
import { unsupportedTriggerReason, unsupportedTriggerReasons } from "./behavior-options.js";
import { translate } from "./locale-model.js";

test("author UI disabled triggers match the trusted product capability projection", () => {
  for (const capability of getSoundBehaviorCapabilities(PRODUCT_SOUND_BEHAVIOR_PRODUCERS)) {
    assert.equal(
      Boolean(unsupportedTriggerReasons[capability.trigger]),
      !capability.supported,
      capability.trigger,
    );
    for (const locale of ["zh-TW", "en"] as const) {
      const reason = unsupportedTriggerReason(capability.trigger, (key) => translate(locale, key));
      assert.equal(Boolean(reason), !capability.supported, locale + ": " + capability.trigger);
    }
  }
  assert.equal(unsupportedTriggerReason("OnBounce"), undefined);
  assert.ok(unsupportedTriggerReason("OnEnterZone"));
  assert.ok(unsupportedTriggerReason("OnExitZone"));
});
