export type Locale = "zh-TW" | "en";
export type MessageParams = Readonly<Record<string, string | number>>;
export type MessageCatalog = Readonly<Record<string, Readonly<Record<Locale, string>>>>;
