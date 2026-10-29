import type { Locale, MessageParams } from "./locale-types.js";
import { messages, type MessageKey } from "./locales/index.js";
import { exactStatusKeys, statusCodeKeys } from "./locales/status.js";

export const DEFAULT_LOCALE: Locale = "zh-TW";
export const LOCALE_STORAGE_KEY = "reflection-lab.locale";
const MAX_FORMATTERS = 64;
const MAX_MESSAGE_CACHE = 256;
const formatters = new Map<string, Intl.NumberFormat>();
const messageCache = new Map<string, string>();

export function isLocale(value: unknown): value is Locale {
  return value === "zh-TW" || value === "en";
}

export function readStoredLocale(storage?: Pick<Storage, "getItem">): Locale {
  try {
    const source = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    const value = source?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** A working UI choice remains authoritative when preference storage is unavailable. */
export function resolveDisplayLocale(
  documentLanguage: unknown,
  storage?: Pick<Storage, "getItem">,
): Locale {
  return isLocale(documentLanguage) ? documentLanguage : readStoredLocale(storage);
}

export function persistLocale(locale: Locale, storage?: Pick<Storage, "setItem">): boolean {
  try {
    const target = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    if (!target) return false;
    target.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function translate(locale: Locale, key: MessageKey, params: MessageParams = {}): string {
  const template = messages[key]?.[locale];
  if (template === undefined) return key;
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token,
  );
}

/** Reuse a bounded set of formatters; raw numerical inputs never pass through this path. */
export function formatNumber(
  locale: Locale,
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  const normalized = { maximumFractionDigits: 6, useGrouping: false, ...options };
  const pairs = Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b));
  const key = `${locale}:${JSON.stringify(pairs)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-TW", normalized);
    if (formatters.size >= MAX_FORMATTERS) formatters.delete(formatters.keys().next().value!);
    formatters.set(key, formatter);
  }
  return formatter.format(value);
}

/** Only finite, explicitly catalogued backend messages/codes receive a translation. */
export function formatMessage(locale: Locale, raw: string | null | undefined): string {
  if (!raw || locale === "zh-TW") return raw ?? "";
  const cached = messageCache.get(raw);
  if (cached !== undefined) return cached;
  const exact = Object.prototype.hasOwnProperty.call(exactStatusKeys, raw)
    ? exactStatusKeys[raw]
    : undefined;
  let result: string;
  if (exact) result = translate(locale, exact);
  else {
    // A code is preserved only if it was actually present in the diagnostic.
    const code = /^([A-Z][A-Z0-9_]{2,})(?=$|[:：;；\s])/.exec(raw.slice(0, 128))?.[1];
    const key =
      code && Object.prototype.hasOwnProperty.call(statusCodeKeys, code)
        ? statusCodeKeys[code]
        : undefined;
    const original = `${translate(locale, "startup.originalDetail")}: ${raw}`;
    result = key
      ? raw === code
        ? `${translate(locale, key)} [${code}]`
        : `${translate(locale, key)} [${code}] · ${original}`
      : original;
  }
  if (raw.length <= 8192) {
    if (messageCache.size >= MAX_MESSAGE_CACHE)
      messageCache.delete(messageCache.keys().next().value!);
    messageCache.set(raw, result);
  }
  return result;
}
