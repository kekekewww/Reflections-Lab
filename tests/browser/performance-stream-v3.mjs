import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

export const STREAM_CAPS = Object.freeze({
  compressedBytes: 256 * 1024 * 1024,
  decodedBytes: 2 * 1024 * 1024 * 1024,
  events: 8_000_000,
  tokenBytes: 2 * 1024 * 1024,
  nesting: 256,
  timeoutMs: 30 * 60 * 1000,
});

// The callback must be synchronous. A callback that never returns requires an outer process watchdog.
export async function parseTraceStream(filename, onEvent, { caps: supplied = {} } = {}) {
  if (
    typeof onEvent !== "function" ||
    !supplied ||
    typeof supplied !== "object" ||
    Array.isArray(supplied)
  )
    throw Error("CAP_CONTRACT");
  const caps = { ...STREAM_CAPS, ...supplied };
  if (
    Object.keys(caps).length !== Object.keys(STREAM_CAPS).length ||
    Object.entries(caps).some(([k, v]) => !Number.isSafeInteger(v) || v <= 0 || v > STREAM_CAPS[k])
  )
    throw Error("CAP_CONTRACT");
  const before = await stat(filename);
  if (before.size > caps.compressedBytes) throw Error("COMPRESSED_CAP");
  let compressedBytes = 0,
    decodedBytes = 0,
    events = 0,
    maxTokenBytes = 0;
  const hash = createHash("sha256"),
    start = Date.now();
  const input = createReadStream(filename);
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      compressedBytes += chunk.length;
      if (compressedBytes > caps.compressedBytes) return callback(Error("COMPRESSED_CAP"));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  const gunzip = createGunzip();
  const transfer = pipeline(input, meter, gunzip).then(
    () => null,
    (e) => e,
  );
  const timer = setTimeout(() => {
    const e = Error("TIMEOUT");
    input.destroy(e);
    meter.destroy(e);
    gunzip.destroy(e);
  }, caps.timeoutMs);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let state = "start",
    seenTrace = false,
    key = "",
    token = "",
    kind = "",
    depth = 0,
    quoted = false,
    escaped = false;
  let tokenStarted = false,
    firstChar = "",
    processed = 0;
  const space = (c) => c === " " || c === "\n" || c === "\r" || c === "\t";
  function beginToken(target) {
    kind = target;
    token = "";
    depth = 0;
    quoted = false;
    escaped = false;
    tokenStarted = false;
    firstChar = "";
    state = "token";
  }
  function finishToken() {
    const bytes = Buffer.byteLength(token, "utf8");
    if (bytes > caps.tokenBytes) throw Error("TOKEN_CAP");
    maxTokenBytes = Math.max(maxTokenBytes, bytes);
    const value = JSON.parse(token);
    if (kind === "key") {
      if (typeof value !== "string") throw Error("JSON_STRUCTURE");
      key = value;
      state = "colon";
    } else if (kind === "metadata") state = "afterValue";
    else {
      if (++events > caps.events) throw Error("EVENT_CAP");
      const returned = onEvent(value);
      if (returned && typeof returned.then === "function") {
        Promise.resolve(returned).catch(() => {});
        throw Error("ASYNC_CALLBACK_UNSUPPORTED");
      }
      state = "afterEvent";
    }
    token = "";
  }
  function consume(text) {
    for (let i = 0; i < text.length; i++) {
      if ((++processed & 65535) === 0 && Date.now() - start > caps.timeoutMs)
        throw Error("TIMEOUT");
      const c = text[i];
      if (state === "token") {
        if (
          tokenStarted &&
          !quoted &&
          depth === 0 &&
          (firstChar === "{" ||
            firstChar === "[" ||
            firstChar === '"' ||
            space(c) ||
            c === "," ||
            c === "}" ||
            c === "]")
        ) {
          finishToken();
          i--;
          continue;
        }
        if (!tokenStarted) {
          tokenStarted = true;
          firstChar = c;
        }
        token += c;
        if (token.length > caps.tokenBytes) throw Error("TOKEN_CAP");
        if (quoted) {
          if (escaped) escaped = false;
          else if (c === "\\") escaped = true;
          else if (c === '"') quoted = false;
        } else if (c === '"') quoted = true;
        else if (c === "{" || c === "[") {
          if (++depth > caps.nesting) throw Error("NESTING_CAP");
        } else if (c === "}" || c === "]") {
          if (--depth < 0) throw Error("JSON_STRUCTURE");
        }
        continue;
      }
      if (space(c)) continue;
      switch (state) {
        case "start":
          if (c !== "{") throw Error("JSON_STRUCTURE");
          state = "firstKey";
          break;
        case "firstKey":
          if (c === "}") {
            state = "end";
            break;
          }
          if (c !== '"') throw Error("JSON_STRUCTURE");
          beginToken("key");
          i--;
          break;
        case "key":
          if (c !== '"') throw Error("JSON_STRUCTURE");
          beginToken("key");
          i--;
          break;
        case "colon":
          if (c !== ":") throw Error("JSON_STRUCTURE");
          state = "value";
          break;
        case "value":
          if (key === "traceEvents") {
            if (seenTrace) throw Error("DUPLICATE_TRACE_EVENTS");
            seenTrace = true;
            if (c !== "[") throw Error("JSON_STRUCTURE");
            state = "firstEvent";
          } else {
            beginToken("metadata");
            i--;
          }
          break;
        case "firstEvent":
          if (c === "]") {
            state = "afterValue";
            break;
          }
          beginToken("event");
          i--;
          break;
        case "event":
          beginToken("event");
          i--;
          break;
        case "afterEvent":
          if (c === ",") state = "event";
          else if (c === "]") state = "afterValue";
          else throw Error("JSON_STRUCTURE");
          break;
        case "afterValue":
          if (c === ",") state = "key";
          else if (c === "}") state = "end";
          else throw Error("JSON_STRUCTURE");
          break;
        case "end":
          throw Error("TRAILING_DATA");
        default:
          throw Error("JSON_STRUCTURE");
      }
    }
  }
  try {
    for await (const chunk of gunzip) {
      decodedBytes += chunk.length;
      if (decodedBytes > caps.decodedBytes) throw Error("DECODED_CAP");
      consume(decoder.decode(chunk, { stream: true }));
    }
    consume(decoder.decode());
    if (state !== "end") throw Error("JSON_STRUCTURE");
    if (!seenTrace) throw Error("MISSING_TRACE_EVENTS");
    const error = await transfer;
    if (error) throw error;
    const after = await stat(filename);
    if (
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ino !== after.ino ||
      compressedBytes !== before.size
    )
      throw Error("FILE_CHANGED");
    return {
      events,
      decodedBytes,
      compressedBytes,
      compressedSha256: hash.digest("hex"),
      fileBytes: before.size,
      maxTokenBytes,
      elapsedMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
    input.destroy();
    meter.destroy();
    gunzip.destroy();
    await transfer;
  }
}
