import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { areaCatalogs, messages } from "./locales/index.js";
import { exactStatusKeys, statusCodeKeys } from "./locales/status.js";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  formatMessage,
  formatNumber,
  persistLocale,
  readStoredLocale,
  resolveDisplayLocale,
  translate,
} from "./locale-model.js";

const placeholders = (text: string) =>
  [...new Set([...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((match) => match[1]))].sort();

test("area catalogs have unique explicit keys and complete bilingual parameter contracts", () => {
  const seen = new Set<string>();
  for (const catalog of areaCatalogs)
    for (const [key, entry] of Object.entries(catalog)) {
      assert.equal(seen.has(key), false, `duplicate translation key: ${key}`);
      seen.add(key);
      assert.ok(entry["zh-TW"].trim(), `${key}: missing zh-TW`);
      assert.ok(entry.en.trim(), `${key}: missing English`);
      assert.deepEqual(placeholders(entry["zh-TW"]), placeholders(entry.en), key);
    }
  assert.equal(seen.size, Object.keys(messages).length);
});

test("audio restart refusals explain the host code in both languages and keep unknown codes intact", () => {
  for (const code of [
    "AUDIO_BUFFER_UNSAFE",
    "AUDIO_BUFFER_BUSY",
    "AUDIO_BUFFER_INVALID",
    "AUDIO_BUFFER_EXTERNAL_CONTEXT",
    "AUDIO_BUFFER_RESTART_FAILED",
  ]) {
    assert.match(formatMessage("zh-TW", code), /\p{Script=Han}/u);
    assert.ok(formatMessage("zh-TW", code).includes(`[${code}]`));
    assert.doesNotMatch(formatMessage("en", code), /\p{Script=Han}/u);
    assert.ok(formatMessage("en", code).includes(`[${code}]`));
  }
  assert.equal(formatMessage("zh-TW", "AUDIO_BUFFER_UNKNOWN"), "AUDIO_BUFFER_UNKNOWN");
  assert.match(formatMessage("en", "AUDIO_BUFFER_UNKNOWN"), /AUDIO_BUFFER_UNKNOWN/);
});

test("recording reprocessing refusals explain current Zone and model requirements in English", () => {
  const cases = [
    ["區域配置變更需要fresh physics run；不能沿用原區域進出事件重評。", /fresh physics run/],
    ["區域事件重評需要原始配置以核對固定區域registry。", /original configuration/],
    [
      "固定或區域音源需要明確的新遮蔽政策；舊錄製仍可原樣重播，請重新錄製後比較。",
      /occlusion policy/,
    ],
    [
      "曲面或動態反射重評需要相同的新模型基準；舊錄製可原樣重播，請先重新錄製再比較。",
      /same current model/,
    ],
  ] as const;
  const processor = readFileSync(new URL("../app/recording-processor.ts", import.meta.url), "utf8");
  for (const [raw, requirement] of cases) {
    assert.ok(processor.includes(raw), "the translation covers an actual processor refusal");
    assert.equal(formatMessage("zh-TW", raw), raw);
    const english = formatMessage("en", raw);
    assert.doesNotMatch(english, /\p{Script=Han}/u);
    assert.doesNotMatch(english, /Original technical detail/);
    assert.match(english, requirement);
  }
});

test("locale preferences use only the two supported values and one guarded storage read", () => {
  for (const [stored, expected] of [
    ["en", "en"],
    ["zh-TW", "zh-TW"],
    ["en-US", DEFAULT_LOCALE],
    ["__proto__", DEFAULT_LOCALE],
    ["", DEFAULT_LOCALE],
    [null, DEFAULT_LOCALE],
  ] as const) {
    let reads = 0;
    const locale = readStoredLocale({
      getItem: (key) => {
        assert.equal(key, LOCALE_STORAGE_KEY);
        reads++;
        return stored;
      },
    });
    assert.equal(locale, expected);
    assert.equal(reads, 1);
  }
  assert.equal(
    readStoredLocale({
      getItem: () => {
        throw new Error("Storage unavailable");
      },
    }),
    DEFAULT_LOCALE,
  );
  assert.equal(
    persistLocale("en", {
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    }),
    false,
  );
  let unavailableReads = 0;
  const unavailable = {
    getItem: () => {
      unavailableReads++;
      throw new Error("Storage unavailable");
    },
  };
  assert.equal(resolveDisplayLocale("en", unavailable), "en");
  assert.equal(
    unavailableReads,
    0,
    "a valid active UI locale must not be replaced by failed storage",
  );
  assert.equal(resolveDisplayLocale("invalid", unavailable), DEFAULT_LOCALE);
  assert.equal(unavailableReads, 1);
});

test("known diagnostics translate while unknown source details and actually present codes remain visible", () => {
  const known = Object.keys(exactStatusKeys)[0]!;
  assert.equal(formatMessage("zh-TW", known), known);
  assert.equal(formatMessage("en", known), translate("en", exactStatusKeys[known]!));
  for (const detail of ["__proto__", "constructor", "NEW_BACKEND_FAILURE: 原始診斷"]) {
    const english = formatMessage("en", detail);
    assert.match(english, /Original technical detail/);
    assert.ok(english.includes(detail));
    assert.equal(formatMessage("zh-TW", detail), detail);
  }
  const code = Object.keys(statusCodeKeys)[0]!;
  const variant = `${code}；unmapped backend suffix`;
  const qualified = formatMessage("en", variant);
  assert.ok(qualified.includes(translate("en", statusCodeKeys[code]!)));
  assert.ok(qualified.includes(variant), "a known code must not discard its unmapped detail");
});

const HAN = /\p{Script=Han}/u;

/** String and template literals, skipping comments; enough lexing for these host modules. */
function stringLiterals(source: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === "/" && source[i + 1] === "/") i = source.indexOf("\n", i);
    else if (c === "/" && source[i + 1] === "*") i = source.indexOf("*/", i) + 1;
    else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < source.length && source[j] !== c) j += source[j] === "\\" ? 2 : 1;
      found.push(source.slice(i + 1, j));
      i = j;
    }
    if (i < 0) break;
  }
  return found;
}

test("parameterized runtime notices translate instead of leaking zh-TW into English", () => {
  const english = formatMessage("en", "互動追趕上限：捨棄 0.083 s 牆鐘時間；固定步長保持1/60 s。");
  assert.ok(english.includes("0.083"), english);
  assert.doesNotMatch(english, HAN);
  // A catalogued detail inside a parameterized frame translates too.
  const nested = formatMessage(
    "en",
    "模式交易失敗：解除固定位置受阻；物件保持固定，可清除障礙後重試。",
  );
  assert.doesNotMatch(nested, HAN);
  // An unknown detail stays visible under the explicit original-detail label.
  const unknown = formatMessage("en", "無法進入第一人稱：未知的後端訊息");
  assert.ok(unknown.includes("未知的後端訊息"));
  assert.match(unknown, /Original technical detail/);
  assert.doesNotMatch(unknown.split("Original technical detail")[0]!, HAN);
  // Nested catalogued prefixes are bounded rather than recursed without limit.
  const deep = formatMessage("en", "無法恢復：".repeat(20000) + "x");
  assert.ok(deep.startsWith("Cannot resume: Cannot resume: "));
});

test("every status literal in the runtime, interaction and recording hosts has an English form", () => {
  // User-editable content, not a status message.
  const content = new Set(["聲音行為實驗"]);
  const untranslated: string[] = [];
  for (const file of [
    "../app/runtime.ts",
    "../interaction/interaction-host.ts",
    "../app/recording-host.ts",
  ]) {
    for (const literal of stringLiterals(readFileSync(new URL(file, import.meta.url), "utf8"))) {
      if (!HAN.test(literal) || content.has(literal)) continue;
      const sample = literal.replace(/\$\{[^{}]*\}/g, "1");
      if (HAN.test(formatMessage("en", sample))) untranslated.push(`${file}: ${literal}`);
    }
  }
  assert.deepEqual(untranslated, []);
});

test("engineering display formatting reuses equivalent formatter options and bounds its cache", () => {
  const Original = Intl.NumberFormat;
  let allocations = 0;
  Intl.NumberFormat = new Proxy(Original, {
    construct(target, args, newTarget) {
      allocations++;
      return Reflect.construct(target, args, newTarget);
    },
  });
  try {
    const first = { minimumIntegerDigits: 17, maximumFractionDigits: 19, useGrouping: false };
    const equivalent = { useGrouping: false, maximumFractionDigits: 19, minimumIntegerDigits: 17 };
    assert.equal(formatNumber("en", 12.5, first), "00000000000000012.5");
    const afterFirst = allocations;
    assert.equal(formatNumber("en", 12.5, equivalent), "00000000000000012.5");
    assert.equal(allocations, afterFirst, "equivalent options must reuse the native formatter");
    for (let index = 0; index < 80; index++)
      formatNumber("en", 12.5, {
        minimumIntegerDigits: (index % 20) + 1,
        maximumFractionDigits: Math.floor(index / 20),
      });
    const beforeEvicted = allocations;
    formatNumber("en", 12.5, first);
    assert.equal(allocations, beforeEvicted + 1, "the old formatter must leave the bounded cache");
  } finally {
    Intl.NumberFormat = Original;
  }
});
