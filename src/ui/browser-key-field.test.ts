import test from "node:test";
import assert from "node:assert/strict";
import { VISITOR_ERROR_MESSAGES } from "../ai/browser-agent.js";
import { formatMessage, translate } from "./locale-model.js";
import type { MessageKey } from "./locales/index.js";

const KEYS = [
  "analysis.agent.keyLabel",
  "analysis.agent.keyUse",
  "analysis.agent.keyForget",
  "analysis.agent.keyHelp",
  "analysis.agent.keyHeld",
  "analysis.agent.keyNeeded",
  "analysis.agent.keyReady",
  "analysis.agent.keyInvalid",
  "analysis.agent.keyOffline",
  "analysis.agent.keyMetaHelp",
] as unknown as MessageKey[];
const HAN = /\p{Script=Han}/u;

test("the key field reads properly in both languages", () => {
  for (const key of KEYS) {
    const english = translate("en", key);
    const chinese = translate("zh-TW", key);
    assert.notEqual(english, key, `${key} is missing in English`);
    assert.notEqual(chinese, key, `${key} is missing in Traditional Chinese`);
    assert.ok(!HAN.test(english), `${key} has Han characters in English`);
    assert.ok(HAN.test(chinese), `${key} has no Han characters in Traditional Chinese`);
  }
});

test("the help text says where the key goes, how long it stays and who pays", () => {
  const help = translate("en", "analysis.agent.keyHelp" as unknown as MessageKey);
  assert.match(help, /api\.meta\.ai/);
  assert.match(help, /memory/i);
  assert.match(help, /reload/i);
  assert.match(help, /your Meta account|you pay/i);
  const chinese = translate("zh-TW", "analysis.agent.keyHelp" as unknown as MessageKey);
  assert.match(chinese, /api\.meta\.ai/);
});

test("every failure a visitor can hit reads in English, with its code", () => {
  for (const [code, message] of Object.entries(VISITOR_ERROR_MESSAGES)) {
    const shown = formatMessage("en", `${code}：${message}`);
    assert.ok(!HAN.test(shown), `${code} shows Chinese in English: ${shown}`);
    assert.ok(shown.includes(`[${code}]`), `${code} lost its code: ${shown}`);
  }
  assert.match(
    formatMessage("en", `AUTHENTICATION_ERROR：${VISITOR_ERROR_MESSAGES.AUTHENTICATION_ERROR}`),
    /rejected this key/,
  );
});

test("a missing key and a stopped hosted request explain themselves in English", () => {
  const blocked = formatMessage("en", "KEY_NOT_ENTERED");
  assert.match(blocked, /key/i);
  assert.ok(!HAN.test(blocked));
  const missing = formatMessage("en", "尚未輸入Meta API金鑰；未送出請求。");
  assert.match(missing, /key/i);
  assert.ok(!HAN.test(missing));
  const stopped = formatMessage("en", "已停止接受此提案；已送出的請求仍可能由Meta計費。");
  assert.match(stopped, /Meta/);
  assert.ok(!HAN.test(stopped));
});
