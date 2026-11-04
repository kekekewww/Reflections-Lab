import assert from "node:assert/strict";
import test from "node:test";
import { formatMessage } from "./locale-model.js";

test("provider trust-boundary refusals have explicit bilingual UI feedback without accepting content", () => {
  const cases = [
    [
      "Meta回覆含禁止的credential資料，未接受或保存內容。",
      /forbidden credential data.*not accepted or saved/s,
    ],
    [
      "Meta回覆缺失、拒絕或角色無效，未套用變更。",
      /missing, refused, or has an invalid role.*No changes were applied/s,
    ],
    ["Meta回覆未完整完成，未接受提案。", /did not finish completely.*No proposal was accepted/s],
    ["Meta回覆不是有效UTF-8，未接受內容。", /not valid UTF-8.*not accepted/s],
  ] as const;
  for (const [raw, expected] of cases) {
    assert.equal(formatMessage("zh-TW", raw), raw);
    const english = formatMessage("en", raw);
    assert.match(english, expected);
    assert.doesNotMatch(english, /Original technical detail|\p{Script=Han}/u);
  }
});

test("recording recovery refusals remain actionable and bilingual with their exact host identities", () => {
  const cases = [
    [
      "RECOVERY_UNSAFE：請先暫停，並結束錄製、重播與其他操作。",
      /Pause first.*finish capture, replay and other operations/s,
    ],
    ["RECOVERY_ACTIVE：這份錄製仍由其他工作階段使用。", /still in use by another session/],
    ["RECOVERY_MISSING：找不到這份中斷錄製。", /interrupted recording could not be found/],
    ["RECOVERY_EMPTY：這份錄製尚無可復原的完整影格。", /no complete persisted frames to recover/],
    ["RECOVERY_IDENTITY：復原資料的來源與所選記錄不符。", /does not match the selected recording/],
    [
      "RECOVERY_STATE：只能載入已驗證的中斷錄製。",
      /Only a verified interrupted recording can be loaded/,
    ],
  ] as const;
  for (const [raw, expected] of cases) {
    assert.equal(formatMessage("zh-TW", raw), raw);
    const english = formatMessage("en", raw);
    assert.match(english, expected);
    assert.ok(english.includes(raw.split("：")[0]!));
    assert.doesNotMatch(english, /Original technical detail|\p{Script=Han}/u);
  }
});

test("actual AgentSession-prefixed Meta failures recursively translate the known safe detail and keep the provider code", () => {
  const details = [
    [
      "POLICY_DENIED",
      "Meta回覆含禁止的credential資料，未接受或保存內容。",
      /forbidden credential data/,
    ],
    ["PROVIDER_REQUEST_FAILED", "Meta回覆缺失、拒絕或角色無效，未套用變更。", /invalid role/],
    ["PROVIDER_REQUEST_FAILED", "Meta回覆未完整完成，未接受提案。", /did not finish completely/],
    ["PROVIDER_REQUEST_FAILED", "Meta回覆不是有效UTF-8，未接受內容。", /not valid UTF-8/],
  ] as const;
  for (const [code, detail, expected] of details) {
    const raw = `${code}：${detail}`;
    assert.equal(formatMessage("zh-TW", raw), raw);
    const english = formatMessage("en", raw);
    assert.ok(english.includes(code));
    assert.match(english, expected);
    assert.doesNotMatch(english, /Original technical detail|\p{Script=Han}/u);
  }
});

test("recording preparation and failures have stable bilingual feedback without a readiness claim", () => {
  const messages = [
    "正在準備錄製…",
    "錄製評估準備逾時。",
    "錄製評估準備已取消。",
    "另一個操作正在準備錄製評估。",
    "錄製評估工作者建立失敗。",
    "錄製評估準備傳送失敗。",
    "錄製評估準備回覆協定無效。",
    "錄製評估準備錯誤回覆無效。",
    "錄製評估 Worker 正在處理工作。",
    "錄製 Worker 準備協定無效。",
    "錄製評估 Worker 失敗。",
    "錄製評估 Worker 回覆無法解碼。",
    "錄製評估已關閉。",
    "錄製評估已有進行中的工作。",
  ];
  for (const raw of messages) {
    assert.equal(formatMessage("zh-TW", raw), raw);
    const english = formatMessage("en", raw);
    assert.match(english, /prepar|recording|worker|evaluation/i);
    assert.doesNotMatch(english, /Original technical detail|\p{Script=Han}/u);
    assert.doesNotMatch(english, /solver.*ready|DSP.*ready|throughput.*passed/i);
  }
});

test("storage preparation and bounded cleanup refusals remain actionable in both interface languages", () => {
  const messages = [
    "前一次錄製準備仍在清理；請稍後重試。",
    "錄製準備已取消。",
    "錄製儲存尚未就緒。",
    "錄製已接納影格，不能丟棄完整資料。",
    "錄製準備逾時；請重試。",
    "錄製儲存準備逾時須大於 0 且不超過 10000 ms。",
    "錄製儲存準備已有另一個等待擁有者。",
    "錄製儲存準備已取消。",
    "錄製儲存準備逾時。",
    "錄製儲存不支援就緒確認。",
  ];
  for (const raw of messages) {
    assert.equal(formatMessage("zh-TW", raw), raw);
    const english = formatMessage("en", raw);
    assert.match(english, /recording|storage|preparation/i);
    assert.doesNotMatch(english, /Original technical detail|\p{Script=Han}/u);
    assert.doesNotMatch(english, /throughput.*passed|DSP.*ready/i);
  }
});
