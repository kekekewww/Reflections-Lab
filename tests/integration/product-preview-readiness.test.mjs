import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../browser/run-product-e2e.mjs", import.meta.url), "utf8");
const start = source.indexOf("  let ready = false;");
const end = source.indexOf("  cli = spawn(process.execPath, command, {", start);
assert(start >= 0 && end > start, "Execute the actual runner readiness loop without spawning it");
const actualReadinessLoop = source.slice(start, end);
const actualAnsiBanner =
  "  \u001b[32m\u279c\u001b[39m  \u001b[1mLocal\u001b[22m:   \u001b[36mhttp://127.0.0.1:\u001b[1m5190\u001b[22m/\u001b[39m\n";
const html = new TextEncoder().encode("<!doctype html><title>Frozen fixture</title>");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function observeReadiness({ banner = actualAnsiBanner, onDelay, ...overrides } = {}) {
  const delays = [];
  const requests = [];
  const context = {
    previewError: null,
    preview: { exitCode: null, signalCode: null },
    previewStderr: "fixture preview error",
    previewStdout: banner,
    stripVTControlCharacters,
    digest,
    AbortSignal,
    manifest: {
      bundle: [{ path: "test-results/product-preview-dist/index.html", sha256: digest(html) }],
    },
    fetch: async (url, options) => {
      requests.push({ url, signal: options.signal });
      return { ok: true, arrayBuffer: async () => html.buffer };
    },
    ...overrides,
  };
  context.delay = async (milliseconds) => {
    delays.push(milliseconds);
    onDelay?.(context, delays.length);
  };
  const result = runInNewContext(
    `(async () => { ${actualReadinessLoop}; return ready; })()`,
    context,
  );
  return { result, delays, requests, context };
}

test("Node 22 builtin accepts the exact observed 77-byte ANSI banner without altering raw output", async () => {
  assert.equal(process.versions.node.split(".")[0], "22");
  assert.equal(Buffer.byteLength(actualAnsiBanner), 77);
  assert.equal(actualAnsiBanner.includes("http://127.0.0.1:5190"), false);
  const observed = observeReadiness();
  assert.equal(await observed.result, true);
  assert.equal(observed.context.previewStdout, actualAnsiBanner);
  assert.equal(observed.requests.length, 1);
  assert.equal(observed.requests[0].url, "http://127.0.0.1:5190/");
  assert(observed.requests[0].signal instanceof AbortSignal);
  assert.deepEqual(observed.delays, []);
});

test("plain readiness and an ANSI banner split across appended log chunks reach the original GET", async () => {
  const plain = observeReadiness({ banner: "Local: http://127.0.0.1:5190/\n" });
  assert.equal(await plain.result, true);
  const splitAt = actualAnsiBanner.indexOf("5190");
  const split = observeReadiness({
    banner: actualAnsiBanner.slice(0, splitAt),
    onDelay: (context, count) => {
      if (count === 1) context.previewStdout += actualAnsiBanner.slice(splitAt);
    },
  });
  assert.equal(await split.result, true);
  assert.equal(split.requests.length, 1);
  assert.deepEqual(split.delays, [100]);
});

for (const [name, banner] of [
  ["different port", "Local: http://127.0.0.1:5191/\n"],
  ["different host", "Local: http://localhost:5190/\n"],
  ["incomplete URL", "Local: http://127.0.0.1:519\n"],
  ["missing readiness", "Preview starting\n"],
  ["reordered fragments", "5190/\nLocal: http://127.0.0.1:\n"],
]) {
  test(`${name} never bypasses the unchanged 100 x 100 ms banner gate`, async () => {
    const observed = observeReadiness({ banner });
    await assert.rejects(observed.result, /Owned preview startup timeout/);
    assert.equal(observed.requests.length, 0);
    assert.equal(observed.delays.length, 100);
    assert(observed.delays.every((milliseconds) => milliseconds === 100));
  });
}

for (const [name, state, expected] of [
  ["spawn error", { previewError: "fixture spawn error" }, /fixture spawn error/],
  ["exited process", { preview: { exitCode: 1, signalCode: null } }, /Owned preview exited/],
  [
    "terminated process",
    { preview: { exitCode: null, signalCode: "SIGTERM" } },
    /Owned preview exited/,
  ],
]) {
  test(`${name} wins over a valid ANSI banner before any readiness request`, async () => {
    const observed = observeReadiness(state);
    await assert.rejects(observed.result, expected);
    assert.equal(observed.requests.length, 0);
    assert.deepEqual(observed.delays, []);
  });
}

test("a matching banner still rejects HTTP bytes that differ from the frozen index hash", async () => {
  const observed = observeReadiness({
    manifest: {
      bundle: [{ path: "test-results/product-preview-dist/index.html", sha256: "wrong-hash" }],
    },
  });
  await assert.rejects(observed.result, /Preview did not serve frozen product HTML/);
  assert.equal(observed.requests.length, 1);
  assert.deepEqual(observed.delays, []);
});
