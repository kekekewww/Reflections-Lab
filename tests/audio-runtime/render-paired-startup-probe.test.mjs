import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { EventEmitter } from "node:events";
import {
  createPairedStartupViteOptions,
  observeOwnedPairedStartup,
} from "../browser/nonadvanced/long-render/paired-startup-probe.mjs";

const ORIGIN = "http://127.0.0.1:5353";
const GLOBALS = [
  "runPairedNativeWholeMaster",
  "pairedManifest",
  "pairedCheckSnapshot",
  "pairedExpectedOutputs",
  "nativeLongDownload",
];
class FakePage extends EventEmitter {
  constructor() {
    super();
    this.currentUrl = `${ORIGIN}/tests/browser/nonadvanced/long-render/paired-index.html`;
    this.dspCalls = 0;
  }
  url() {
    return this.currentUrl;
  }
  async evaluate(fn) {
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    globalThis.window = Object.fromEntries(GLOBALS.map((name) => [name, () => this.dspCalls++]));
    globalThis.document = { readyState: "interactive" };
    try {
      return fn();
    } finally {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  }
}
function request(page, url, error = null) {
  return {
    frame: () => ({ page: () => page }),
    url: () => url,
    method: () => "GET",
    resourceType: () => "script",
    failure: () => (error ? { errorText: error } : null),
  };
}
function response(req, status) {
  return { request: () => req, status: () => status };
}

test("paired startup isolates optimizer entry and refuses an outside cache without changing server limits", () => {
  const root = path.resolve(".");
  const cache = path.join(root, ".cache", "startup-probe-owned", "unique-attempt");
  const config = createPairedStartupViteOptions(root, cache);
  assert.equal(config.configFile, false);
  assert.equal(config.root, root);
  assert.equal(config.cacheDir, cache);
  assert.deepEqual(config.server, { host: "127.0.0.1", port: 5353, strictPort: true });
  assert.deepEqual(config.optimizeDeps, {
    entries: ["tests/browser/nonadvanced/long-render/paired-index.html"],
  });
  assert.throws(() => createPairedStartupViteOptions(root, root), /CACHE_SCOPE/);
  assert.throws(
    () => createPairedStartupViteOptions(root, path.resolve(root, "..", "foreign-cache")),
    /CACHE_SCOPE/,
  );
  assert.throws(() => createPairedStartupViteOptions("relative-root", cache), /ROOT_ABSOLUTE/);
});

test("paired startup preserves pending and failed requests plus lifecycle and globals without calling DSP", async () => {
  const page = new FakePage();
  const observer = observeOwnedPairedStartup(page, { origin: ORIGIN });
  const pending = request(page, `${ORIGIN}/pending-entry.ts`);
  const failed = request(page, `${ORIGIN}/failed-import.ts`, "net::ERR_ABORTED");
  page.emit("request", pending);
  page.emit("response", response(pending, 200));
  page.emit("request", failed);
  page.emit("response", response(failed, 503));
  page.emit("requestfailed", failed);
  page.emit("domcontentloaded");
  page.emit("pageerror", new Error("module evaluation failed"));
  const captured = await observer.captureState();
  assert.equal(page.dspCalls, 0);
  assert.equal(captured.inflight.length, 1);
  assert.equal(captured.inflight[0].url, `${ORIGIN}/pending-entry.ts`);
  assert.equal(captured.inflight[0].status, 200);
  assert.equal(captured.counts.failed, 1);
  assert.ok(captured.events.some((row) => row.type === "response" && row.status === 503));
  assert.ok(
    captured.events.some((row) => row.type === "requestfailed" && row.error === "net::ERR_ABORTED"),
  );
  assert.ok(captured.pageErrors.some((row) => row.message === "module evaluation failed"));
  assert.equal(typeof captured.lifecycle.domcontentloadedAtMs, "number");
  assert.equal(captured.lifecycle.loadAtMs, null);
  assert.equal(captured.browserState.lastUrl, page.url());
  assert.equal(captured.browserState.readyState, "interactive");
  assert.equal(captured.browserState.allGlobalsReady, true);
  assert.deepEqual(Object.keys(captured.browserState.globals), GLOBALS);
  page.currentUrl = `${ORIGIN}/paired-index.html?capture=second`;
  page.evaluate = async () => {
    throw new Error("browser read failed");
  };
  const failedRead = await observer.captureState();
  assert.equal(failedRead.browserState.lastUrl, page.url());
  assert.equal(failedRead.browserState.readyState, null);
  assert.equal(failedRead.browserState.globals, null);
  assert.equal(failedRead.browserState.allGlobalsReady, false);
  assert.equal(failedRead.browserState.error, "browser read failed");
  assert.equal(page.dspCalls, 0);
  observer.dispose();
});

test("paired startup bounds records, ignores foreign ownership and removes only its own listeners", async () => {
  const page = new FakePage();
  const otherPage = new FakePage();
  let preexistingLoadCalls = 0;
  page.on("load", () => preexistingLoadCalls++);
  const observer = observeOwnedPairedStartup(page, {
    origin: ORIGIN,
    maxEvents: 2,
    maxInflight: 1,
  });
  const first = request(page, `${ORIGIN}/first.ts`);
  page.emit("request", request(page, "https://foreign.invalid/secret.ts"));
  page.emit("request", request(otherPage, `${ORIGIN}/foreign-page.ts`));
  page.emit("request", first);
  const overflowed = request(page, `${ORIGIN}/overflow.ts`);
  page.emit("request", overflowed);
  page.emit("load");
  let snapshot = observer.snapshot();
  assert.equal(snapshot.inflight.length, 1);
  assert.equal(snapshot.events.length, 2);
  assert.equal(snapshot.overflow.inflight, 1);
  assert.ok(snapshot.overflow.events >= 1);
  assert.equal(snapshot.counts.foreignIgnored, 2);
  assert.ok(!JSON.stringify(snapshot).includes("secret.ts"));
  snapshot.inflight[0].url = "tampered";
  assert.equal(observer.snapshot().inflight[0].url, `${ORIGIN}/first.ts`);
  page.emit("requestfinished", first);
  assert.equal(observer.snapshot().inflight.length, 0);
  const responsesBeforeLate = observer.snapshot().counts.responses;
  page.emit("response", response(first, 200));
  page.emit("response", response(overflowed, 200));
  assert.equal(observer.snapshot().counts.responses, responsesBeforeLate);
  assert.ok(observer.snapshot().counts.unknownIgnored >= 2);
  const fresh = request(page, `${ORIGIN}/fresh.ts`);
  page.emit("request", fresh);
  assert.deepEqual(
    observer.snapshot().inflight.map((row) => row.url),
    [`${ORIGIN}/fresh.ts`],
  );
  observer.dispose();
  observer.dispose();
  snapshot = observer.snapshot();
  page.emit("request", request(page, `${ORIGIN}/late.ts`));
  page.emit("load");
  assert.deepEqual(observer.snapshot(), snapshot);
  assert.equal(page.listenerCount("request"), 0);
  assert.equal(page.listenerCount("load"), 1);
  assert.equal(preexistingLoadCalls, 2);
  assert.throws(
    () => observeOwnedPairedStartup(page, { origin: "https://foreign.invalid" }),
    /ORIGIN/,
  );
});
