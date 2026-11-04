import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import test from "node:test";
import { guardBrowser } from "./s4-browser-guard.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const baseURL = "http://127.0.0.1:4173";
const entryPath = "/assets/index-s4-guard-unit.js";
const html = Buffer.from(`<script type="module" src="${entryPath}"></script>`);
const entry = Buffer.from("globalThis.s4GuardUnit = true;");
const metadataKeys = ["S4_FREEZE_PATH", "S4_LANE_OUTPUT"];

class PublicRequest {
  constructor(address, method) {
    this.address = address;
    this.verb = method;
  }
  url() {
    return this.address;
  }
  method() {
    return this.verb;
  }
  resourceType() {
    return "fetch";
  }
  postData() {
    return null;
  }
}

/** Models Playwright's documented route order; continue terminates route dispatch. */
class PublicRoute {
  constructor(request, handlers, state, index = 0) {
    this.value = request;
    this.handlers = handlers;
    this.state = state;
    this.index = index;
  }
  request() {
    return this.value;
  }
  async abort(reason = "failed") {
    this.state.aborted = reason;
  }
  async continue() {
    this.state.forwarded = true;
  }
  async fulfill(response) {
    this.state.fulfilled = response;
  }
  async fallback() {
    const next = this.index + 1;
    if (next >= this.handlers.length) {
      this.state.forwarded = true;
      return;
    }
    await this.handlers[next](
      new PublicRoute(this.value, this.handlers, this.state, next),
      this.value,
    );
  }
}

class PublicPage extends EventEmitter {
  constructor(context) {
    super();
    this.owner = context;
    this.routes = [];
    this.closed = false;
  }
  context() {
    return this.owner;
  }
  isClosed() {
    return this.closed;
  }
  async route(pattern, handler) {
    this.routes.push({ pattern, handler });
  }
  async unroute(pattern, handler) {
    this.routes = this.routes.filter(
      (value) => value.pattern !== pattern || (handler && value.handler !== handler),
    );
  }
  async dispatch(address, method = "GET") {
    const request = new PublicRequest(address, method);
    const handlers = [...this.routes]
      .reverse()
      .concat([...this.owner.routes].reverse())
      .map((value) => value.handler);
    const state = { aborted: null, forwarded: false, fulfilled: null };
    if (handlers.length) await handlers[0](new PublicRoute(request, handlers, state), request);
    else state.forwarded = true;
    return state;
  }
  async close() {
    this.closed = true;
    this.emit("close");
  }
}

class PublicContext extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.routes = [];
    this.documents = [];
  }
  pages() {
    return [...this.documents];
  }
  async route(pattern, handler) {
    this.routes.push({ pattern, handler });
  }
  async unroute(pattern, handler) {
    this.routes = this.routes.filter(
      (value) => value.pattern !== pattern || (handler && value.handler !== handler),
    );
  }
  async newPage() {
    const page = new PublicPage(this);
    this.documents.push(page);
    this.emit("page", page);
    return page;
  }
  observe(page, path, bytes) {
    this.emit("response", {
      url: () => new URL(path, baseURL).href,
      body: async () => bytes,
      frame: () => ({ page: () => page }),
    });
  }
}

class PublicBrowser extends EventEmitter {
  constructor() {
    super();
    this.created = [];
  }
  version() {
    return "s4-unit-browser-version";
  }
  contexts() {
    return [...this.created];
  }
  async newContext(options = {}) {
    const context = new PublicContext(options);
    this.created.push(context);
    return context;
  }
  async newPage(options = {}) {
    return (await this.newContext(options)).newPage();
  }
}

async function fixture(t) {
  const root = resolve(process.cwd());
  const directory = resolve(root, ".cache", `s4-guard-unit-${randomUUID()}`);
  assert.ok(
    !relative(root, directory).startsWith(".."),
    "Owned unit fixture remains inside this tree",
  );
  await mkdir(resolve(root, ".cache"), { recursive: true });
  await mkdir(directory, { recursive: false });
  const executablePath = join(directory, "fake-browser-executable.txt");
  const executable = Buffer.from("This is unit data, not an executable browser.");
  await writeFile(executablePath, executable, { flag: "wx" });
  const freezePath = join(directory, "freeze.json");
  await writeFile(
    freezePath,
    JSON.stringify({
      schemaVersion: 1,
      sourceCommit: "a".repeat(40),
      baseURL,
      browserExecutable: executablePath,
      browserExecutableSha256: sha(executable),
      browserVersion: "s4-unit-browser-version",
      htmlSha256: sha(html),
      assets: [{ path: entryPath, sha256: sha(entry) }],
      entry: { path: entryPath, sha256: sha(entry) },
    }),
    { flag: "wx" },
  );
  const saved = new Map(metadataKeys.map((key) => [key, process.env[key]]));
  const ownedListeners = [];
  process.env.S4_FREEZE_PATH = freezePath;
  process.env.S4_LANE_OUTPUT = directory;
  t.after(() => {
    // Explicit flush assertions cover each case. Deliberate failure cases must not
    // add an unrelated failure later through this fake browser's beforeExit hook.
    for (const listener of ownedListeners) process.removeListener("beforeExit", listener);
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  return {
    directory,
    async guard(browser) {
      const previous = new Set(process.listeners("beforeExit"));
      const result = await guardBrowser(browser, { outputDirectory: directory });
      for (const listener of process.listeners("beforeExit"))
        if (!previous.has(listener)) ownedListeners.push(listener);
      return result;
    },
    async productPage(browser, { entryObserved = true } = {}) {
      const context = await browser.newContext(),
        page = await context.newPage();
      context.observe(page, "/", html);
      if (entryObserved) context.observe(page, entryPath, entry);
      return { context, page };
    },
  };
}

test(
  "legacy page.route continue cannot forward a forbidden local model request",
  { concurrency: false },
  async (t) => {
    const owned = await fixture(t),
      browser = new PublicBrowser(),
      guard = await owned.guard(browser);
    const { page } = await owned.productPage(browser);
    await page.route("**/*", async (route) => route.continue());
    const outcome = await page.dispatch(`${baseURL}/api/agent/propose`, "POST");
    assert.equal(
      outcome.forwarded,
      false,
      "Page routing must not bypass the zero-paid-API boundary",
    );
    assert.ok(outcome.aborted, "A legacy continue must be converted to an abort");
    assert.equal(outcome.fulfilled, null);
    await guard.flush();
  },
);

test(
  "an explicit page.route offline fixture may fulfill a local request without forwarding it",
  { concurrency: false },
  async (t) => {
    const owned = await fixture(t),
      browser = new PublicBrowser(),
      guard = await owned.guard(browser);
    const { page } = await owned.productPage(browser);
    await page.route("**/*", async (route) =>
      route.fulfill({ status: 200, json: { fixture: true, paid: false } }),
    );
    const outcome = await page.dispatch(`${baseURL}/api/agent/propose`, "POST");
    assert.equal(outcome.forwarded, false);
    assert.equal(
      outcome.aborted,
      null,
      "Do not replace an explicit offline fixture with a real request or reject it as paid",
    );
    assert.deepEqual(outcome.fulfilled, { status: 200, json: { fixture: true, paid: false } });
    await guard.flush();
  },
);

test(
  "a later legacy context.route continue also cannot bypass the common guard",
  { concurrency: false },
  async (t) => {
    const owned = await fixture(t),
      browser = new PublicBrowser(),
      guard = await owned.guard(browser);
    const { context, page } = await owned.productPage(browser);
    await context.route("**/*", async (route) => route.continue());
    const outcome = await page.dispatch(`${baseURL}/api/agent/propose`, "POST");
    assert.equal(outcome.forwarded, false);
    assert.ok(outcome.aborted);
    await guard.flush();
  },
);

test(
  "every product context needs its own frozen entry observation",
  { concurrency: false },
  async (t) => {
    const owned = await fixture(t),
      browser = new PublicBrowser(),
      guard = await owned.guard(browser);
    await owned.productPage(browser);
    await owned.productPage(browser, { entryObserved: false });
    await assert.rejects(() => guard.flush(), /S4_BROWSER_GUARD_FAILED|ENTRY_NOT_OBSERVED/);
  },
);

function guardRecords(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (value.kind === "S4_LEGACY_BROWSER_PROVENANCE_GUARD") result.push(value);
  else
    for (const child of Object.values(value))
      if (child && typeof child === "object") guardRecords(child, result);
  return result;
}
async function readGuardRecords(directory) {
  const values = [];
  for (const file of await readdir(directory, { withFileTypes: true })) {
    if (file.isDirectory()) values.push(...(await readGuardRecords(join(directory, file.name))));
    else if (file.name.endsWith(".json") && file.name !== "freeze.json") {
      values.push(...guardRecords(JSON.parse(await readFile(join(directory, file.name), "utf8"))));
    }
  }
  return values;
}

test(
  "two browser instances in one lane preserve both provenance receipts",
  { concurrency: false },
  async (t) => {
    const owned = await fixture(t),
      first = new PublicBrowser(),
      second = new PublicBrowser();
    const firstGuard = await owned.guard(first),
      secondGuard = await owned.guard(second);
    await owned.productPage(first);
    await owned.productPage(second);
    await owned.productPage(second);
    await firstGuard.flush();
    await secondGuard.flush();
    const records = await readGuardRecords(owned.directory);
    assert.ok(
      records.some((value) => value.contexts.length === 1),
      "First browser's evidence must survive the later launch",
    );
    assert.ok(
      records.some((value) => value.contexts.length === 2),
      "Second browser's evidence must also be retained",
    );
  },
);
