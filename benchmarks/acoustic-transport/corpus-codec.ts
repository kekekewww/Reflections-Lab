/**
 * Exact benchmark corpus graph; deliberately separate from product Recording formats.
 * Only own string data properties, ordinary dense arrays and plain/null objects are supported.
 * Corpus limits do not change any product acoustic payload or queue limits.
 */
export const EXACT_CORPUS_FORMAT = "reflection-lab-acoustic-corpus/exact-graph/1";
export const EXACT_CORPUS_LIMITS = Object.freeze({
  maxUtf8Bytes: 64 * 1024 * 1024,
  maxNodes: 2_000_000,
});

type Value =
  | ["null"]
  | ["undefined"]
  | ["boolean", boolean]
  | ["string", string]
  | ["number", number | "-0" | "nan" | "+infinity" | "-infinity"]
  | ["ref", number];
type ObjectEntry = [string, number, Value];
type ArrayEntry = [number, Value];
type GraphNode =
  | [number, "object", "plain" | "null", boolean, ObjectEntry[]]
  | [number, "array", boolean, boolean, ArrayEntry[]];
type Json = null | boolean | number | string | Json[];
type DecodedNode =
  | {
      kind: "object";
      target: Record<string, unknown>;
      entries: unknown[];
      extensible: boolean;
    }
  | {
      kind: "array";
      target: unknown[];
      entries: unknown[];
      extensible: boolean;
      lengthWritable: boolean;
    };

const fail = (reason: string): never => {
  throw new Error("EXACT_CORPUS_" + reason);
};
const budget = () => {
  let count = 0;
  return {
    consume(): void {
      if (++count > EXACT_CORPUS_LIMITS.maxNodes) fail("NODES");
    },
    reserveMinimum(countNeeded: number): void {
      if (countNeeded > EXACT_CORPUS_LIMITS.maxNodes - count) fail("NODES");
    },
  };
};

/** Count UTF-8 without allocating a second corpus-sized byte buffer. */
function stringBytes(text: string, remaining: number, quoted = false): number {
  let bytes = quoted ? 2 : 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (quoted && (code === 34 || code === 92)) bytes += 2;
    else if (quoted && code < 32)
      bytes += code === 8 || code === 9 || code === 10 || code === 12 || code === 13 ? 2 : 6;
    else if (code < 128) bytes++;
    else if (code < 2048) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index++;
      } else bytes += quoted ? 6 : 3;
    } else if (code >= 0xdc00 && code <= 0xdfff) bytes += quoted ? 6 : 3;
    else bytes += 3;
    if (bytes > remaining) fail("BYTES");
  }
  if (bytes > remaining) fail("BYTES");
  return bytes;
}

/** Generated tuples only: JSON.stringify never receives a caller object or array. */
function stringifyGraph(value: Json): string {
  const pieces: string[] = [];
  let piece = "";
  let bytes = 0;
  const append = (text: string, byteCount = text.length): void => {
    bytes += byteCount;
    if (bytes > EXACT_CORPUS_LIMITS.maxUtf8Bytes) fail("BYTES");
    piece += text;
    if (piece.length >= 65_536) {
      pieces.push(piece);
      piece = "";
    }
  };
  const visit = (item: Json): void => {
    if (typeof item === "string") {
      if (item.length > EXACT_CORPUS_LIMITS.maxUtf8Bytes - bytes) fail("BYTES");
      const size = stringBytes(item, EXACT_CORPUS_LIMITS.maxUtf8Bytes - bytes, true);
      append(JSON.stringify(item), size);
    } else if (Array.isArray(item)) {
      append("[");
      for (let index = 0; index < item.length; index++) {
        if (index) append(",");
        visit(item[index]!);
      }
      append("]");
    } else append(item === null ? "null" : String(item));
  };
  visit(value);
  if (piece) pieces.push(piece);
  return pieces.join("");
}

function descriptor(owner: object, key: string): PropertyDescriptor {
  const result = Object.getOwnPropertyDescriptor(owner, key);
  if (!result || !Object.hasOwn(result, "value")) return fail("UNSUPPORTED");
  return result;
}
function flags(value: PropertyDescriptor): number {
  return (
    Number(value.enumerable) | (Number(value.writable) << 1) | (Number(value.configurable) << 2)
  );
}
function define(target: object, key: string, bits: number, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: Boolean(bits & 1),
    writable: Boolean(bits & 2),
    configurable: Boolean(bits & 4),
  });
}

export function encodeExact(input: unknown): string {
  const limits = budget();
  const known = new Map<object, number>();
  const pending: object[] = [];
  const nodes: GraphNode[] = [];
  const encode = (value: unknown): Value => {
    limits.consume();
    if (value === null) return ["null"];
    if (value === undefined) return ["undefined"];
    if (typeof value === "boolean") return ["boolean", value];
    if (typeof value === "string") {
      if (value.length > EXACT_CORPUS_LIMITS.maxUtf8Bytes) fail("BYTES");
      return ["string", value];
    }
    if (typeof value === "number") {
      if (Object.is(value, -0)) return ["number", "-0"];
      if (Number.isNaN(value)) return ["number", "nan"];
      if (value === Infinity) return ["number", "+infinity"];
      if (value === -Infinity) return ["number", "-infinity"];
      return ["number", value];
    }
    if (typeof value !== "object") return fail("UNSUPPORTED");
    const prior = known.get(value);
    if (prior !== undefined) return ["ref", prior];
    const prototype: unknown = Object.getPrototypeOf(value);
    if (
      Array.isArray(value)
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    )
      return fail("UNSUPPORTED");
    const id = pending.length;
    known.set(value, id);
    pending.push(value);
    return ["ref", id];
  };
  const root = encode(input);
  for (let id = 0; id < pending.length; id++) {
    const owner = pending[id]!;
    if (Array.isArray(owner)) {
      const length = descriptor(owner, "length");
      const count = length.value as unknown;
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
        return fail("UNSUPPORTED");
      limits.reserveMinimum(count);
      const keys = Reflect.ownKeys(owner);
      if (keys.length !== count + 1 || keys.some((key) => typeof key !== "string"))
        return fail("UNSUPPORTED");
      const entries: ArrayEntry[] = [];
      for (let index = 0; index < count; index++) {
        const property = descriptor(owner, String(index));
        entries.push([flags(property), encode(property.value)]);
      }
      nodes.push([id, "array", Boolean(length.writable), Object.isExtensible(owner), entries]);
    } else {
      const keys = Reflect.ownKeys(owner);
      limits.reserveMinimum(keys.length);
      const entries: ObjectEntry[] = [];
      for (const key of keys) {
        if (typeof key !== "string") return fail("UNSUPPORTED");
        const property = descriptor(owner, key);
        entries.push([key, flags(property), encode(property.value)]);
      }
      nodes.push([
        id,
        "object",
        Object.getPrototypeOf(owner) === null ? "null" : "plain",
        Object.isExtensible(owner),
        entries,
      ]);
    }
  }
  return stringifyGraph([EXACT_CORPUS_FORMAT, root, nodes]);
}

function tuple(value: unknown, length: number): value is unknown[] {
  return Array.isArray(value) && value.length === length;
}
function idValue(value: unknown, count: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    !Object.is(value, -0) &&
    value >= 0 &&
    value < count
  );
}
function propertyFlags(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 7;
}

export function decodeExact(text: string): unknown {
  if (typeof text !== "string") return fail("INVALID");
  if (text.length > EXACT_CORPUS_LIMITS.maxUtf8Bytes) return fail("BYTES");
  stringBytes(text, EXACT_CORPUS_LIMITS.maxUtf8Bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fail("INVALID_JSON");
  }
  if (!tuple(parsed, 3) || parsed[0] !== EXACT_CORPUS_FORMAT || !Array.isArray(parsed[2]))
    return fail("INVALID");
  const rawNodes = parsed[2] as unknown[];
  if (rawNodes.length > EXACT_CORPUS_LIMITS.maxNodes) return fail("NODES");
  const nodes: DecodedNode[] = [];
  for (const raw of rawNodes) {
    if (
      !tuple(raw, 5) ||
      !idValue(raw[0], rawNodes.length) ||
      Object.hasOwn(nodes, raw[0]) ||
      typeof raw[3] !== "boolean" ||
      !Array.isArray(raw[4])
    )
      return fail("INVALID");
    if (raw[1] === "object" && (raw[2] === "plain" || raw[2] === "null")) {
      nodes[raw[0]] = {
        kind: "object",
        target: Object.create(raw[2] === "null" ? null : Object.prototype) as Record<
          string,
          unknown
        >,
        entries: raw[4],
        extensible: raw[3],
      };
    } else if (raw[1] === "array" && typeof raw[2] === "boolean") {
      nodes[raw[0]] = {
        kind: "array",
        target: [],
        entries: raw[4],
        extensible: raw[3],
        lengthWritable: raw[2],
      };
    } else return fail("INVALID");
  }
  const limits = budget();
  const decode = (value: unknown): unknown => {
    limits.consume();
    if (!Array.isArray(value)) return fail("INVALID");
    switch (value[0]) {
      case "null":
        return tuple(value, 1) ? null : fail("INVALID");
      case "undefined":
        return tuple(value, 1) ? undefined : fail("INVALID");
      case "boolean":
        return tuple(value, 2) && typeof value[1] === "boolean" ? value[1] : fail("INVALID");
      case "string":
        return tuple(value, 2) && typeof value[1] === "string" ? value[1] : fail("INVALID");
      case "number":
        if (!tuple(value, 2)) return fail("INVALID");
        if (typeof value[1] === "number" && Number.isFinite(value[1]) && !Object.is(value[1], -0))
          return value[1];
        if (value[1] === "-0") return -0;
        if (value[1] === "nan") return NaN;
        if (value[1] === "+infinity") return Infinity;
        if (value[1] === "-infinity") return -Infinity;
        return fail("INVALID");
      case "ref":
        if (!tuple(value, 2) || !idValue(value[1], rawNodes.length) || !nodes[value[1]])
          return fail("INVALID_REFERENCE");
        return nodes[value[1]]!.target;
      default:
        return fail("INVALID");
    }
  };
  for (const node of nodes) {
    limits.reserveMinimum(node.entries.length);
    if (node.kind === "object") {
      const keys = new Set<string>();
      for (const entry of node.entries) {
        if (
          !tuple(entry, 3) ||
          typeof entry[0] !== "string" ||
          !propertyFlags(entry[1]) ||
          keys.has(entry[0])
        )
          return fail("INVALID");
        keys.add(entry[0]);
        define(node.target, entry[0], entry[1], decode(entry[2]));
      }
    } else {
      for (let index = 0; index < node.entries.length; index++) {
        const entry = node.entries[index];
        if (!tuple(entry, 2) || !propertyFlags(entry[0])) return fail("INVALID");
        define(node.target, String(index), entry[0], decode(entry[1]));
      }
      Object.defineProperty(node.target, "length", {
        value: node.entries.length,
        writable: node.lengthWritable,
      });
    }
    if (!node.extensible) Object.preventExtensions(node.target);
  }
  const result = decode(parsed[1]);
  // Reject hidden/unreachable definitions rather than accepting a different graph corpus.
  const reachable = new Set<number>();
  const queue: number[] = [];
  const visitRef = (value: unknown): void => {
    const tag = value as unknown[];
    if (tag[0] === "ref" && !reachable.has(tag[1] as number)) {
      reachable.add(tag[1] as number);
      queue.push(tag[1] as number);
    }
  };
  visitRef(parsed[1]);
  for (let index = 0; index < queue.length; index++) {
    const node = nodes[queue[index]!]!;
    for (const entry of node.entries) {
      const fields = entry as unknown[];
      visitRef(fields[node.kind === "object" ? 2 : 1]);
    }
  }
  if (reachable.size !== nodes.length) return fail("INVALID_REFERENCE");
  return result;
}
