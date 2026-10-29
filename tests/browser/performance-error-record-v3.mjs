import { types } from "node:util";

// Node-side diagnostics only. These caps do not affect measurement or cleanup.
export const ERROR_RECORD_LIMITS = Object.freeze({
  maxDepth: 8,
  maxNodes: 32,
  maxStringChars: 4096,
  maxTotalBytes: 65536,
});

export function serializeErrorRecord(error, options = {}) {
  const hardCaps = { maxDepth: 16, maxNodes: 128, maxStringChars: 16384, maxTotalBytes: 262144 };
  const limits = {};
  for (const key of Object.keys(ERROR_RECORD_LIMITS)) {
    let value;
    try {
      value = options?.[key];
    } catch {
      /* Use the fixed default. */
    }
    limits[key] = Number.isSafeInteger(value)
      ? Math.max(key === "maxTotalBytes" ? 2048 : 1, Math.min(value, hardCaps[key]))
      : ERROR_RECORD_LIMITS[key];
  }
  const events = {};
  const note = (reason) => {
    events[reason] = (events[reason] ?? 0) + 1;
  };
  let nodes = 0;
  // Conservative per-node overhead plus a fixed envelope reserve bounds JSON bytes,
  // including escaping and diagnostics. Never stringify caller-owned objects.
  let remaining = limits.maxTotalBytes - 1024;
  const seen = new WeakMap();
  const text = (value) => {
    let result = value;
    let clipped = false;
    if (result.length > limits.maxStringChars) {
      result = result.slice(0, limits.maxStringChars);
      clipped = true;
      note("maxStringChars");
    }
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > remaining) {
      note("maxTotalBytes");
      let low = 0,
        high = result.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (Buffer.byteLength(JSON.stringify(result.slice(0, mid)), "utf8") <= remaining) low = mid;
        else high = mid - 1;
      }
      result = result.slice(0, low);
      clipped = true;
    }
    // Avoid emitting half of a surrogate pair at a truncation boundary.
    const last = result.charCodeAt(result.length - 1);
    if (clipped && last >= 0xd800 && last <= 0xdbff) result = result.slice(0, -1);
    remaining -= Buffer.byteLength(JSON.stringify(result), "utf8");
    return result;
  };
  const read = (value, key) => {
    try {
      return { ok: true, value: Reflect.get(value, key) };
    } catch {
      note("unreadableProperty");
      return { ok: false };
    }
  };
  const has = (value, key) => {
    try {
      return Reflect.has(value, key);
    } catch {
      note("unreadableProperty");
      return false;
    }
  };
  const visit = (value, depth) => {
    if (depth > limits.maxDepth) {
      note("maxDepth");
      return undefined;
    }
    if (nodes >= limits.maxNodes) {
      note("maxNodes");
      return undefined;
    }
    if (remaining < 128) {
      note("maxTotalBytes");
      return undefined;
    }
    nodes++;
    remaining -= 128;
    const kind = value === null ? "null" : typeof value;
    if (kind !== "object" && kind !== "function") {
      // String coercion is restricted to primitives; caller hooks never execute.
      const printable = kind === "number" && Object.is(value, -0) ? "-0" : String(value);
      const message = text(printable);
      const jsonValue =
        kind === "number" && (!Number.isFinite(value) || Object.is(value, -0))
          ? message
          : kind === "bigint" || kind === "symbol" || kind === "undefined"
            ? message
            : value;
      // String values use the already bounded message, not the original string.
      return { kind, message, value: kind === "string" ? message : jsonValue };
    }
    if (seen.has(value)) {
      note("cycle");
      return { kind: "reference", reference: seen.get(value) };
    }
    seen.set(value, nodes);
    const nativeError = types.isNativeError(value);
    const record = { kind: nativeError ? "error" : kind, id: nodes };
    for (const key of ["message", "name", "stack"]) {
      const field = read(value, key);
      if (field.ok && typeof field.value === "string") record[key] = text(field.value);
    }
    if (record.message === undefined)
      record.message = nativeError ? "Error" : "Non-Error value thrown";
    // Native AggregateError.errors is a bounded array walk. Do not consume arbitrary
    // iterables, toJSON or user toString, and catch proxy/array traps individually.
    const errors = read(value, "errors");
    if (errors.ok && errors.value !== undefined) {
      let array = false;
      try {
        array = Array.isArray(errors.value);
      } catch {
        note("unreadableProperty");
      }
      if (array) {
        const length = read(errors.value, "length");
        if (length.ok && Number.isSafeInteger(length.value) && length.value >= 0) {
          record.errors = [];
          for (let index = 0; index < length.value; index++) {
            const child = read(errors.value, index);
            if (!child.ok) break;
            const nested = visit(child.value, depth + 1);
            if (nested === undefined) break;
            record.errors.push(nested);
          }
        }
      } else note("unsupportedErrors");
    }
    if (has(value, "cause")) {
      const cause = read(value, "cause");
      if (cause.ok) {
        const nested = visit(cause.value, depth + 1);
        if (nested !== undefined) record.cause = nested;
      }
    }
    return record;
  };
  const record = visit(error, 0);
  record.serialization = { truncated: Object.keys(events).length > 0, events, nodes, limits };
  // Defense in depth: only our plain records enter JSON.stringify. A future field
  // addition cannot silently violate the durable byte cap.
  if (Buffer.byteLength(JSON.stringify(record), "utf8") > limits.maxTotalBytes) {
    return {
      kind: record.kind,
      message: "Error diagnostics exceeded total byte cap",
      serialization: {
        truncated: true,
        events: { ...events, maxTotalBytes: (events.maxTotalBytes ?? 0) + 1 },
        nodes,
        limits,
      },
    };
  }
  return record;
}
