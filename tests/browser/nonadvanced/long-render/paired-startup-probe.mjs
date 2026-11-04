import path from "node:path";

const ORIGIN = "http://127.0.0.1:5353";
const ENTRY = "tests/browser/nonadvanced/long-render/paired-index.html";
const GLOBALS = [
  "runPairedNativeWholeMaster",
  "pairedManifest",
  "pairedCheckSnapshot",
  "pairedExpectedOutputs",
  "nativeLongDownload",
];

export function createPairedStartupViteOptions(root, cacheDir) {
  if (typeof root !== "string" || !path.isAbsolute(root))
    throw new Error("PAIRED_STARTUP_ROOT_ABSOLUTE");
  if (typeof cacheDir !== "string" || !path.isAbsolute(cacheDir))
    throw new Error("PAIRED_STARTUP_CACHE_SCOPE");
  const resolvedRoot = path.resolve(root);
  const resolvedCache = path.resolve(cacheDir);
  const relative = path.relative(resolvedRoot, resolvedCache);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("PAIRED_STARTUP_CACHE_SCOPE");
  // The coordinator separately creates and realpath-checks a fresh owned cache.
  return {
    configFile: false,
    root: resolvedRoot,
    cacheDir: resolvedCache,
    server: { host: "127.0.0.1", port: 5353, strictPort: true },
    optimizeDeps: { entries: [ENTRY] },
  };
}

/** Observes this exact public Page; it never calls a fixture function. */
export function observeOwnedPairedStartup(page, options = {}) {
  const origin = options.origin ?? ORIGIN;
  if (origin !== ORIGIN) throw new Error("PAIRED_STARTUP_ORIGIN");
  if (!page || typeof page.on !== "function" || typeof page.off !== "function")
    throw new Error("PAIRED_STARTUP_PAGE");
  const maxEvents = options.maxEvents ?? 512;
  const maxInflight = options.maxInflight ?? 256;
  if (
    !Number.isSafeInteger(maxEvents) ||
    maxEvents < 1 ||
    maxEvents > 4096 ||
    !Number.isSafeInteger(maxInflight) ||
    maxInflight < 1 ||
    maxInflight > 1024
  )
    throw new Error("PAIRED_STARTUP_LIMIT");
  const started = performance.now();
  let ownedPage = page;
  let disposed = false;
  let sequence = 0;
  let requests = new WeakMap();
  const inflight = new Map();
  const listeners = [];
  const state = {
    schemaVersion: "paired-startup-observation-v1",
    origin,
    startedAtUtc: new Date().toISOString(),
    disposed: false,
    limits: { maxEvents, maxInflight, maxPageErrors: 16, maxTextLength: 2048 },
    counts: {
      requests: 0,
      responses: 0,
      finished: 0,
      failed: 0,
      foreignIgnored: 0,
      unknownIgnored: 0,
      observerErrors: 0,
    },
    events: [],
    overflow: { events: 0, inflight: 0, pageErrors: 0, textTruncations: 0 },
    lifecycle: { domcontentloadedAtMs: null, loadAtMs: null },
    pageErrors: [],
    browserState: {
      lastUrl: null,
      readyState: null,
      globals: null,
      allGlobalsReady: false,
      error: null,
    },
  };
  const elapsed = () => performance.now() - started;
  function text(value) {
    const string = String(value);
    if (string.length <= state.limits.maxTextLength) return string;
    state.overflow.textTruncations++;
    return string.slice(0, state.limits.maxTextLength);
  }
  function record(type, fields = {}) {
    if (disposed) return;
    if (state.events.length >= maxEvents) {
      state.overflow.events++;
      return;
    }
    state.events.push({ type, elapsedMs: elapsed(), ...fields });
  }
  function errorMessage(error) {
    return text(error?.message ?? error);
  }
  function observerError(error) {
    state.counts.observerErrors++;
    record("observer-error", { error: errorMessage(error) });
  }
  function knownRequest(request) {
    return request && (typeof request === "object" || typeof request === "function")
      ? requests.get(request)
      : undefined;
  }
  function ownedRequest(request) {
    let frame;
    try {
      frame = request.frame();
    } catch {
      state.counts.unknownIgnored++;
      return null;
    }
    if (!frame || frame.page() !== ownedPage) {
      state.counts.foreignIgnored++;
      return null;
    }
    const url = request.url();
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      state.counts.unknownIgnored++;
      return null;
    }
    if (parsed.origin !== origin) {
      state.counts.foreignIgnored++;
      return null;
    }
    return text(url);
  }
  function on(name, action) {
    const listener = (value) => {
      if (disposed) return;
      try {
        action(value);
      } catch (error) {
        observerError(error);
      }
    };
    ownedPage.on(name, listener);
    listeners.push({ name, listener });
  }
  function snapshot() {
    return structuredClone({ ...state, inflight: [...inflight.values()] });
  }
  function dispose() {
    if (disposed) return snapshot();
    // Remove exactly these listeners. Existing listeners belong to the caller.
    for (const { name, listener } of listeners) {
      try {
        ownedPage.off(name, listener);
      } catch (error) {
        observerError(error);
      }
    }
    listeners.length = 0;
    disposed = true;
    state.disposed = true;
    ownedPage = null;
    requests = new WeakMap();
    return snapshot();
  }
  try {
    on("request", (request) => {
      const url = ownedRequest(request);
      if (url === null) return;
      if (knownRequest(request)) {
        observerError(new Error("PAIRED_STARTUP_DUPLICATE_REQUEST"));
        return;
      }
      const row = {
        id: `request.${++sequence}`,
        url,
        method: text(request.method()),
        resourceType: text(request.resourceType()),
        startedElapsedMs: elapsed(),
        status: null,
        terminal: false,
      };
      state.counts.requests++;
      if (inflight.size >= maxInflight) {
        state.overflow.inflight++;
        record("request-overflow", { id: row.id, url });
      } else {
        requests.set(request, row);
        inflight.set(row.id, row);
        record("request", { id: row.id, url, method: row.method, resourceType: row.resourceType });
      }
    });
    on("response", (response) => {
      const row = knownRequest(response.request());
      if (!row) {
        state.counts.unknownIgnored++;
        return;
      }
      const status = response.status();
      if (!Number.isInteger(status) || status < 0 || status > 999)
        throw new Error("PAIRED_STARTUP_RESPONSE_STATUS");
      state.counts.responses++;
      row.status = status;
      record("response", { id: row.id, url: row.url, status });
    });
    on("requestfinished", (request) => {
      const row = knownRequest(request);
      if (!row) {
        state.counts.unknownIgnored++;
        return;
      }
      if (row.terminal) return;
      row.terminal = true;
      requests.delete(request);
      inflight.delete(row.id);
      state.counts.finished++;
      record("requestfinished", { id: row.id, url: row.url, status: row.status });
    });
    on("requestfailed", (request) => {
      const row = knownRequest(request);
      if (!row) {
        state.counts.unknownIgnored++;
        return;
      }
      if (row.terminal) return;
      row.terminal = true;
      requests.delete(request);
      inflight.delete(row.id);
      state.counts.failed++;
      record("requestfailed", {
        id: row.id,
        url: row.url,
        status: row.status,
        error: text(request.failure()?.errorText ?? "unknown request failure"),
      });
    });
    on("domcontentloaded", () => {
      state.lifecycle.domcontentloadedAtMs ??= elapsed();
      record("domcontentloaded");
    });
    on("load", () => {
      state.lifecycle.loadAtMs ??= elapsed();
      record("load");
    });
    on("pageerror", (error) => {
      const row = { elapsedMs: elapsed(), message: errorMessage(error) };
      if (state.pageErrors.length < state.limits.maxPageErrors) state.pageErrors.push(row);
      else state.overflow.pageErrors++;
      record("pageerror", { error: row.message });
    });
  } catch (error) {
    dispose();
    throw error;
  }
  async function captureState() {
    if (disposed) return snapshot();
    // A failed later read must not retain a previous successful ready snapshot.
    state.browserState = {
      lastUrl: null,
      readyState: null,
      globals: null,
      allGlobalsReady: false,
      error: null,
    };
    try {
      const lastUrl = ownedPage.url();
      if (new URL(lastUrl).origin !== origin) throw new Error("PAIRED_STARTUP_PAGE_ORIGIN");
      state.browserState.lastUrl = text(lastUrl);
      // No fixture function is invoked. The caller supplies a Node wall deadline.
      const result = await ownedPage.evaluate(() => {
        const names = [
          "runPairedNativeWholeMaster",
          "pairedManifest",
          "pairedCheckSnapshot",
          "pairedExpectedOutputs",
          "nativeLongDownload",
        ];
        return {
          readyState: document.readyState,
          globals: Object.fromEntries(
            names.map((name) => [name, typeof window[name] === "function"]),
          ),
        };
      });
      if (disposed) return snapshot();
      if (
        typeof result?.readyState !== "string" ||
        !result.globals ||
        GLOBALS.some((name) => typeof result.globals[name] !== "boolean")
      )
        throw new Error("PAIRED_STARTUP_BROWSER_STATE");
      state.browserState.readyState = text(result.readyState);
      state.browserState.globals = Object.fromEntries(
        GLOBALS.map((name) => [name, result.globals[name]]),
      );
      state.browserState.allGlobalsReady = GLOBALS.every((name) => result.globals[name]);
      state.browserState.error = null;
      record("browser-state", { allGlobalsReady: state.browserState.allGlobalsReady });
    } catch (error) {
      if (!disposed) {
        state.browserState.error = errorMessage(error);
        state.browserState.allGlobalsReady = false;
        record("browser-state-error", { error: state.browserState.error });
      }
    }
    return snapshot();
  }
  return { snapshot, captureState, dispose };
}
