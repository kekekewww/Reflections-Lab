import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
const installed = new WeakMap();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function shouldBlockS4Request(address, method = "GET") {
  const url = new URL(address, "http://127.0.0.1:4173");
  return (
    (/^https?:$/.test(url.protocol) && url.origin !== "http://127.0.0.1:4173") ||
    (String(method).toUpperCase() !== "GET" && url.pathname.startsWith("/api/agent/"))
  );
}

/** Guard public test-client HTTP routes, including handlers registered by the legacy tests later. */
export async function guardBrowser(browser, { outputDirectory = process.env.S4_LANE_OUTPUT } = {}) {
  if (installed.has(browser)) return installed.get(browser);
  if (!outputDirectory || !process.env.S4_FREEZE_PATH)
    throw new Error("S4_GUARD_METADATA_REQUIRED");
  const bytes = await readFile(process.env.S4_FREEZE_PATH),
    freeze = JSON.parse(bytes.toString("utf8"));
  if (
    browser.version() !== freeze.browserVersion ||
    sha(await readFile(freeze.browserExecutable)) !== freeze.browserExecutableSha256
  )
    throw new Error("S4_BROWSER_PIN_MISMATCH");
  const expected = new Map(
    [...freeze.assets, freeze.entry].map((asset) => [asset.path, asset.sha256]),
  );
  const instanceId = randomUUID();
  const record = {
    schemaVersion: 1,
    kind: "S4_LEGACY_BROWSER_PROVENANCE_GUARD",
    instanceId,
    freezeSha256: sha(bytes),
    sourceCommit: freeze.sourceCommit,
    browserExecutable: freeze.browserExecutable,
    browserExecutableSha256: freeze.browserExecutableSha256,
    browserVersion: browser.version(),
    contexts: [],
    blockedRequests: [],
    offlineFixtureResponses: [],
    pageErrors: [],
    violations: [],
    scope:
      "Public test-client HTTP/provenance guard; no product/runtime/audio handlers are replaced. Explicit fixture fulfill is offline evidence, never model live.",
  };
  const contexts = new WeakMap(),
    guardedPages = new WeakSet(),
    guardedRequests = new WeakSet(),
    reads = [];
  let persistence = Promise.resolve();
  const describe = (address, method) => {
    const url = new URL(address, freeze.baseURL);
    return `${method} ${url.origin}${url.pathname}`;
  };
  const block = (address, method) => record.blockedRequests.push(describe(address, method));
  function requestClient(client) {
    if (!client || guardedRequests.has(client)) return;
    guardedRequests.add(client);
    for (const name of ["get", "head", "post", "put", "patch", "delete", "fetch"]) {
      if (typeof client[name] !== "function") continue;
      const original = client[name].bind(client);
      client[name] = async (address, options = {}) => {
        const url = typeof address === "string" ? address : address.url(),
          method =
            name === "fetch"
              ? (options.method ?? (typeof address === "string" ? "GET" : address.method()))
              : name.toUpperCase();
        if (shouldBlockS4Request(url, method)) {
          block(url, method);
          throw new Error("S4_DIRECT_API_REQUEST_BLOCKED");
        }
        return original(address, { ...options, maxRedirects: 0 });
      };
    }
  }
  function protectedRoute(route) {
    const request = route.request(),
      address = request.url(),
      method = request.method();
    return new Proxy(route, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (["continue", "fallback", "fetch"].includes(key))
          return async (options = {}) => {
            const targetAddress = options.url ?? address,
              targetMethod = options.method ?? method;
            const forbidden =
              shouldBlockS4Request(address, method) ||
              shouldBlockS4Request(targetAddress, targetMethod);
            // fallback may reach an earlier explicit offline fixture. Every later
            // continue/fetch is protected, and the final context guard still aborts.
            if (forbidden && key !== "fallback") {
              block(targetAddress, targetMethod);
              await target.abort("blockedbyclient");
              if (key === "fetch") throw new Error("S4_ROUTE_FETCH_BLOCKED");
              return;
            }
            return value.call(target, key === "fetch" ? { ...options, maxRedirects: 0 } : options);
          };
        if (key === "fulfill")
          return async (options) => {
            if (shouldBlockS4Request(address, method))
              record.offlineFixtureResponses.push(describe(address, method));
            return value.call(target, options);
          };
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  function installRouteRegistration(owner) {
    const original = owner.route.bind(owner),
      originalUnroute = owner.unroute?.bind(owner),
      handlers = new WeakMap();
    owner.route = async (pattern, handler, ...options) => {
      let guarded = handlers.get(handler);
      if (!guarded) {
        guarded = (route, request) => handler(protectedRoute(route), request);
        handlers.set(handler, guarded);
      }
      return original(pattern, guarded, ...options);
    };
    if (originalUnroute)
      owner.unroute = (pattern, handler) =>
        originalUnroute(pattern, handler ? (handlers.get(handler) ?? handler) : undefined);
  }
  async function registerContext(context) {
    if (contexts.has(context)) return;
    const data = {
      index: record.contexts.length,
      entryObserved: false,
      htmlObserved: false,
      assets: [],
      closedAssetReads: [],
    };
    contexts.set(context, data);
    record.contexts.push(data);
    installRouteRegistration(context);
    requestClient(context.request);
    const attach = (page) => {
      if (guardedPages.has(page)) return;
      guardedPages.add(page);
      installRouteRegistration(page);
      requestClient(page.request);
      page.on("pageerror", (error) => record.pageErrors.push(error.message));
    };
    context.pages().forEach(attach);
    context.on("page", attach);
    await context.route("**/*", async (route) => {
      const request = route.request(),
        address = request.url(),
        method = request.method();
      if (shouldBlockS4Request(address, method)) {
        block(address, method);
        await route.abort("blockedbyclient");
      } else await route.continue();
    });
    context.on("response", (response) => {
      const url = new URL(response.url());
      if (
        url.origin !== freeze.baseURL ||
        !(url.pathname === "/" || /\.(?:js|css)$/.test(url.pathname))
      )
        return;
      reads.push(
        response
          .body()
          .then((body) => {
            const actual = sha(body),
              pin = url.pathname === "/" ? freeze.htmlSha256 : expected.get(url.pathname);
            data.assets.push({
              path: url.pathname,
              sha256: actual,
              bytes: body.length,
              expected: pin ?? null,
            });
            if (!pin || pin !== actual)
              record.violations.push(`S4_SERVED_PIN_MISMATCH:${url.pathname}`);
            if (url.pathname === "/") data.htmlObserved = true;
            if (url.pathname === freeze.entry.path && actual === freeze.entry.sha256)
              data.entryObserved = true;
          })
          .catch((error) => {
            let closed = false;
            try {
              closed = response.frame().page().isClosed();
            } catch {
              /* No page frame for a worker response. */
            }
            if (closed)
              data.closedAssetReads.push({
                path: url.pathname,
                reason:
                  "Document closed before this asset body could be read; no entry PASS is inferred",
              });
            else record.violations.push(`S4_ASSET_BODY_FAILED:${url.pathname}:${error.name}`);
          }),
      );
    });
  }
  const originalContext = browser.newContext.bind(browser),
    originalPage = browser.newPage.bind(browser);
  browser.newContext = async (options) => {
    const context = await originalContext({ ...options, serviceWorkers: "block" });
    await registerContext(context);
    return context;
  };
  browser.newPage = async (options) => {
    const page = await originalPage({ ...options, serviceWorkers: "block" });
    await registerContext(page.context());
    return page;
  };
  const guard = {
    registerContext,
    async flush() {
      await Promise.allSettled(reads);
      await mkdir(outputDirectory, { recursive: true });
      record.finishedAt = new Date().toISOString();
      const navigated = record.contexts.filter((value) => value.htmlObserved);
      record.status =
        record.violations.length || record.pageErrors.length
          ? "FAIL"
          : navigated.length > 0 && navigated.every((value) => value.entryObserved)
            ? "SOURCE_BROWSER_WINDOW_VERIFIED"
            : "ENTRY_NOT_OBSERVED";
      persistence = persistence.then(() =>
        writeFile(
          join(outputDirectory, `browser-guard-${instanceId}.json`),
          JSON.stringify(record, null, 2) + "\n",
        ),
      );
      await persistence;
      if (record.status !== "SOURCE_BROWSER_WINDOW_VERIFIED")
        throw new Error(`S4_BROWSER_GUARD_FAILED:${record.status}`);
    },
  };
  installed.set(browser, guard);
  process.once("beforeExit", () =>
    guard.flush().catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    }),
  );
  return guard;
}
