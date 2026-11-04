export const ACOUSTIC_PAYLOAD_MAX_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();
const failure = (code: string): Error => new Error(code);
const denseArray = (value: unknown, minimum: number, maximum: number): value is unknown[] =>
  Array.isArray(value) &&
  value.length >= minimum &&
  value.length <= maximum &&
  Object.keys(value).length === value.length;

/** Inspect bounds before stringifying or structured-cloning potentially huge input. */
export function acousticPayloadBytes(value: unknown, maxArrayLength = 4096): number {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > 200_000 || item.depth > 16) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
    if (typeof item.value === "string") {
      if (item.value.length > 8192) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
    } else if (typeof item.value === "number") {
      if (!Number.isFinite(item.value)) throw failure("ACOUSTIC_PAYLOAD_INVALID");
    } else if (item.value !== null && typeof item.value === "object") {
      if (Array.isArray(item.value)) {
        if (!denseArray(item.value, 0, maxArrayLength)) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
        for (let index = 0; index < item.value.length; index++) {
          const entry: unknown = item.value[index];
          if (entry === undefined) throw failure("ACOUSTIC_PAYLOAD_INVALID");
          stack.push({ value: entry, depth: item.depth + 1 });
        }
      } else {
        const prototype = Object.getPrototypeOf(item.value);
        if (prototype !== Object.prototype && prototype !== null)
          throw failure("ACOUSTIC_PAYLOAD_INVALID");
        const entries = Object.entries(item.value);
        if (entries.length > 64) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
        for (const [key, entry] of entries) {
          if (key.length > 128) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
          stack.push({ value: entry, depth: item.depth + 1 });
        }
      }
    } else if (typeof item.value !== "boolean" && item.value !== null && item.value !== undefined) {
      throw failure("ACOUSTIC_PAYLOAD_INVALID");
    }
  }
  const bytes = encoder.encode(JSON.stringify(value)).byteLength;
  if (bytes > ACOUSTIC_PAYLOAD_MAX_BYTES) throw failure("ACOUSTIC_PAYLOAD_BUDGET");
  return bytes;
}
