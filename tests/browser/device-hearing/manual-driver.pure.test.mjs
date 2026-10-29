import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createBoundedLineDecoder, createFrozenRouteHandler } from "./manual-probe-driver.mjs";

// Pure host-memory tests only: no browser, server, network, native audio or frozen18 rerun.
const sha = (value) => createHash("sha256").update(value).digest("hex");
const resource = (pathname, text, type = "text/javascript") => {
  const bytes = Buffer.from(text);
  return { path: pathname, bytes, sha256: sha(bytes), contentType: type };
};
const route = (url, method = "GET") => ({
  request: () => ({ url: () => url, method: () => method }),
  fulfilled: null,
  continued: 0,
  aborted: null,
  async fulfill(options) {
    this.fulfilled = options;
  },
  async continue() {
    this.continued++;
  },
  async abort(reason) {
    this.aborted = reason;
  },
});

test("Pure bounded reader: split byte chunks, UTF8, CRLF and final unterminated line", () => {
  const reader = createBoundedLineDecoder();
  const text = Buffer.from('{"x":"聽"}\r\n{"command":"status"}');
  const a = reader.feed(text.subarray(0, 8));
  const b = reader.feed(text.subarray(8, 12));
  const c = reader.feed(text.subarray(12));
  assert.deepEqual([...a, ...b, ...c, ...reader.finish()], ['{"x":"聽"}', '{"command":"status"}']);
  assert.throws(() => reader.feed(Buffer.from("\n")), /INPUT_READER_ENDED/);
});

test("Pure bounded reader: exact byte limit accepted, next byte rejected before accumulation", () => {
  const exact = createBoundedLineDecoder({ maxLineBytes: 4 });
  assert.deepEqual(exact.feed(Buffer.from("1234\n")), ["1234"]);
  const overflow = createBoundedLineDecoder({ maxLineBytes: 4 });
  assert.deepEqual(overflow.feed(Buffer.from("1234")), []);
  assert.throws(() => overflow.feed(Buffer.alloc(64 * 1024, 65)), /INPUT_LINE_BYTE_LIMIT/);
  assert.throws(() => overflow.finish(), /INPUT_READER_ENDED/);
});

test("Pure bounded reader: command count capped including empty lines", () => {
  const reader = createBoundedLineDecoder({ maxLines: 2 });
  assert.deepEqual(reader.feed(Buffer.from("one\n\n")), ["one", ""]);
  assert.throws(() => reader.feed(Buffer.from("three\n")), /INPUT_COMMAND_LIMIT/);
});

test("Pure bounded reader: counts UTF8 bytes and rejects malformed UTF8", () => {
  const reader = createBoundedLineDecoder({ maxLineBytes: 2 });
  assert.throws(() => reader.feed(Buffer.from("聽")), /INPUT_LINE_BYTE_LIMIT/);
  const invalid = createBoundedLineDecoder();
  assert.throws(() => invalid.feed(Buffer.from([0xc0, 0xaf, 10])), /INPUT_INVALID_UTF8/);
});

test("Pure bounded reader: returned strings have no mutable storage alias", () => {
  const reader = createBoundedLineDecoder();
  const first = reader.feed(Buffer.from("first\n"))[0];
  reader.feed(Buffer.from("other\n"));
  assert.equal(first, "first");
});

test("Pure frozen routing: actual root and assets fulfill exact hash-bound bytes, no HTTP continuation", async () => {
  const index = resource("/", "<html>frozen</html>", "text/html");
  const app = resource("/assets/app.js", "export const frozen=true;");
  const handler = createFrozenRouteHandler({
    origin: "http://127.0.0.1:5174",
    responses: [index, app],
  });
  for (const entry of [index, app]) {
    const request = route(`http://127.0.0.1:5174${entry.path}`);
    await handler(request);
    assert.equal(request.continued, 0);
    assert.equal(request.aborted, null);
    assert.equal(sha(request.fulfilled.body), entry.sha256);
    assert.equal(request.fulfilled.contentType, entry.contentType);
  }
});

test("Pure frozen routing: input and returned Buffer mutation cannot alter private frozen bytes", async () => {
  const entry = resource("/", "<html>original</html>", "text/html"),
    expected = entry.sha256;
  const handler = createFrozenRouteHandler({ origin: "http://127.0.0.1:5174", responses: [entry] });
  entry.bytes.fill(0);
  const first = route("http://127.0.0.1:5174/");
  await handler(first);
  assert.equal(sha(first.fulfilled.body), expected);
  first.fulfilled.body.fill(1);
  const second = route("http://127.0.0.1:5174/");
  await handler(second);
  assert.equal(sha(second.fulfilled.body), expected);
});

test("Pure frozen routing: external/API/unlisted/query/POST requests abort without any fallback", async () => {
  const handler = createFrozenRouteHandler({
    origin: "http://127.0.0.1:5174",
    responses: [resource("/", "frozen")],
  });
  for (const [url, method] of [
    ["https://example.com/", "GET"],
    ["http://127.0.0.1:5174/api/agent/propose", "GET"],
    ["http://127.0.0.1:5174/unknown.js", "GET"],
    ["http://127.0.0.1:5174/?changed=1", "GET"],
    ["http://127.0.0.1:5174/", "POST"],
  ]) {
    const request = route(url, method);
    await handler(request);
    assert.equal(request.fulfilled, null);
    assert.equal(request.continued, 0);
    assert.equal(request.aborted, "blockedbyclient");
  }
});

test("Pure frozen routing: mismatch refuses construction; HEAD has no body", async () => {
  const wrong = { ...resource("/", "frozen"), sha256: "0".repeat(64) };
  assert.throws(
    () => createFrozenRouteHandler({ origin: "http://127.0.0.1:5174", responses: [wrong] }),
    /Unverified route bytes/,
  );
  const handler = createFrozenRouteHandler({
    origin: "http://127.0.0.1:5174",
    responses: [resource("/", "frozen")],
  });
  const request = route("http://127.0.0.1:5174/", "HEAD");
  await handler(request);
  assert.equal(request.fulfilled.body.length, 0);
  assert.equal(request.continued, 0);
});

test("Pure frozen routing: only same-origin first-party Blob may continue", async () => {
  const handler = createFrozenRouteHandler({
    origin: "http://127.0.0.1:5174",
    responses: [resource("/", "frozen")],
  });
  const own = route("blob:http://127.0.0.1:5174/owned-worklet");
  await handler(own);
  assert.equal(own.continued, 1);
  assert.equal(own.fulfilled, null);
  const other = route("blob:https://example.com/not-owned");
  await handler(other);
  assert.equal(other.continued, 0);
  assert.equal(other.aborted, "blockedbyclient");
});

test("Pure frozen routing: HTTP request budget256 is finite", async () => {
  const handler = createFrozenRouteHandler({
    origin: "http://127.0.0.1:5174",
    responses: [resource("/", "frozen")],
  });
  for (let i = 0; i < 256; i++) {
    const request = route("http://127.0.0.1:5174/");
    await handler(request);
    assert(request.fulfilled);
  }
  const extra = route("http://127.0.0.1:5174/");
  await handler(extra);
  assert.equal(extra.fulfilled, null);
  assert.equal(extra.aborted, "blockedbyclient");
});
