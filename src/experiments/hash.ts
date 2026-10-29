import { RecordingError } from "./types.js";

/** Canonical plain JSON only: no runtime objects, sparse arrays, cycles, or nonfinite values. */
export function canonicalStringify(value: unknown): string {
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): string => {
    if (depth > 48) throw new RecordingError("JSON_DEPTH", "資料巢狀深度超過上限。");
    if (item === null || typeof item === "boolean" || typeof item === "string") {
      if (typeof item === "string" && item.length > 2 * 1024 * 1024)
        throw new RecordingError("JSON_ITEMS", "資料字串超過上限。");
      return JSON.stringify(item);
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item))
        throw new RecordingError("NONFINITE", "紀錄不能包含 NaN 或 Infinity。");
      return JSON.stringify(item);
    }
    if (typeof item !== "object")
      throw new RecordingError("NON_JSON", "僅允許可序列化的 JSON 資料。");
    if (ancestors.has(item)) throw new RecordingError("JSON_CYCLE", "紀錄不能包含循環參照。");
    ancestors.add(item);
    let result: string;
    if (Array.isArray(item)) {
      if (item.length > 200000) throw new RecordingError("JSON_ITEMS", "資料陣列超過上限。");
      const entries: string[] = [];
      for (let index = 0; index < item.length; index += 1) {
        if (!Object.hasOwn(item, index))
          throw new RecordingError("NON_JSON", "不接受 sparse array。");
        entries.push(visit(item[index], depth + 1));
      }
      result = `[${entries.join(",")}]`;
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null)
        throw new RecordingError("NON_JSON", "不接受 engine 或 class instance。");
      const record = item as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      if (Reflect.ownKeys(record).length !== keys.length)
        throw new RecordingError("NON_JSON", "不接受隱藏欄位或 Symbol。");
      if (keys.length > 20000) throw new RecordingError("JSON_ITEMS", "資料欄位超過上限。");
      if (keys.some((key) => ["__proto__", "prototype", "constructor"].includes(key)))
        throw new RecordingError("UNSAFE_KEY", "不接受危險的資料欄位。");
      result = `{${keys
        .map((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(record, key);
          if (!descriptor || !("value" in descriptor))
            throw new RecordingError("NON_JSON", "不接受 accessor 欄位。");
          return `${JSON.stringify(key)}:${visit(descriptor.value, depth + 1)}`;
        })
        .join(",")}}`;
    }
    ancestors.delete(item);
    return result;
  };
  return visit(value, 0);
}

export async function sha256Canonical(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalStringify(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function frozenCanonicalParse<T>(canonical: string): T {
  const clone = JSON.parse(canonical) as T;
  const freeze = (item: unknown): void => {
    if (item === null || typeof item !== "object") return;
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  };
  freeze(clone);
  return clone;
}

export function immutableClone<T>(value: T): T {
  return frozenCanonicalParse<T>(canonicalStringify(value));
}

/** Reuse the validated canonical representation for both ownership and byte accounting. */
export function immutableCloneWithByteLength<T>(value: T): { value: T; byteLength: number } {
  const canonical = canonicalStringify(value);
  const clone = frozenCanonicalParse<T>(canonical);
  return { value: clone, byteLength: new TextEncoder().encode(canonical).byteLength };
}

export function canonicalBytes(value: unknown): number {
  return new TextEncoder().encode(canonicalStringify(value)).byteLength;
}
