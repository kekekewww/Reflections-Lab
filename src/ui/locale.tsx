import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Locale, MessageParams } from "./locale-types.js";
import type { MessageKey } from "./locales/index.js";
import {
  formatMessage,
  formatNumber,
  persistLocale,
  readStoredLocale,
  translate,
} from "./locale-model.js";

export type { Locale, MessageParams } from "./locale-types.js";
export type { MessageKey } from "./locales/index.js";

export interface LocaleValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  message: (raw: string | null | undefined) => string;
}
const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const originalHead = useRef(
    typeof document === "undefined"
      ? null
      : {
          lang: document.documentElement.lang,
          title: document.title,
          description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
        },
  );
  const latestLocale = useRef(locale);
  latestLocale.current = locale;
  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      n: (number, options) => formatNumber(locale, number, options),
      message: (raw) => formatMessage(locale, raw),
    }),
    [locale, setLocale],
  );
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, "startup.documentTitle");
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = translate(locale, "startup.documentDescription");
  }, [locale]);
  useEffect(() => {
    persistLocale(locale);
  }, [locale]);
  useEffect(
    () => () => {
      const original = originalHead.current;
      if (!original) return;
      if (document.documentElement.lang === latestLocale.current)
        document.documentElement.lang = original.lang;
      if (document.title === translate(latestLocale.current, "startup.documentTitle"))
        document.title = original.title;
      const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (
        description?.content === translate(latestLocale.current, "startup.documentDescription") &&
        original.description !== undefined
      )
        description.content = original.description;
    },
    [],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("LOCALE_PROVIDER_MISSING");
  return context;
}
