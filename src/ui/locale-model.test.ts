import assert from "node:assert/strict";
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
