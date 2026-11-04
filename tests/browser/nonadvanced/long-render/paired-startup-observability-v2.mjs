const ORIGIN = "http://127.0.0.1:5353";
const TIMING_FIELDS = Object.freeze([
  "startTime",
  "domainLookupStart",
  "domainLookupEnd",
  "connectStart",
  "secureConnectionStart",
  "connectEnd",
  "requestStart",
  "responseStart",
  "responseEnd",
]);
const MAX_TEXT = 2048;

/** Passive metadata only. It never navigates, evaluates, transforms, or requests a resource. */
export function createStartupObservabilityV2(options = {}) {
  const origin = options.origin ?? ORIGIN;
  if (origin !== ORIGIN) throw new Error("STARTUP_V2_ORIGIN");
  const now = options.now ?? (() => performance.now());
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  if ([now, setTimer, clearTimer].some((value) => typeof value !== "function"))
    throw new Error("STARTUP_V2_CLOCK");
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 50;
  const maxHeartbeatSamples = options.maxHeartbeatSamples ?? 1024;
  const maxEvents = options.maxEvents ?? 512;
  const maxInflight = options.maxInflight ?? 256;
  if (
    !Number.isSafeInteger(heartbeatIntervalMs) ||
    heartbeatIntervalMs < 10 ||
    heartbeatIntervalMs > 1000 ||
    !Number.isSafeInteger(maxHeartbeatSamples) ||
    maxHeartbeatSamples < 1 ||
    maxHeartbeatSamples > 4096 ||
    !Number.isSafeInteger(maxEvents) ||
    maxEvents < 1 ||
    maxEvents > 4096 ||
    !Number.isSafeInteger(maxInflight) ||
    maxInflight < 1 ||
    maxInflight > 1024
  )
    throw new Error("STARTUP_V2_LIMIT");
  const began = now();
  if (!Number.isFinite(began)) throw new Error("STARTUP_V2_CLOCK");
  let disposed = false;
  let timer = null;
  let ownedPage = null;
  let attached = false;
  let sequence = 0;
  let requests = new WeakMap();
  const pageListeners = [];
  const activeResponses = new Map();
  const serverInflight = new Map();
  const browserInflight = new Map();
  const state = {
    schemaVersion: "paired-startup-observability-v2",
    origin,
    disposed: false,
    clocks: {
      node: "performance.now-relative-to-observer-start-ms",
      server: "node-callback; receive/finish/close are local server callback times",
      browserCallbacks: "node-callback; receipt time is not Chrome network completion time",
      requestTiming: {
        source: "Playwright public Request.timing()",
        startTime: "milliseconds since Unix epoch",
        otherFields: "milliseconds relative to request startTime",
        unavailable: -1,
        crossClockSubtractionPerformed: false,
      },
    },
    limits: {
      maxEventsPerChannel: maxEvents,
      maxInflightPerChannel: maxInflight,
      maxTextLength: MAX_TEXT,
    },
    observerErrors: 0,
    errors: [],
    overflow: { errors: 0, text: 0 },
    heartbeat: {
      intervalMs: heartbeatIntervalMs,
      maxSamples: maxHeartbeatSamples,
      sampleCount: 0,
      maxLagMs: 0,
      lastLagMs: null,
      lastCallbackElapsedMs: null,
      sampleLimitReached: false,
      note: "Timer callback lag at 50ms by default; no sub-millisecond claim and no catch-up callbacks.",
    },
    server: {
      counts: { received: 0, finished: 0, closed: 0, foreignIgnored: 0, observerErrors: 0 },
      overflow: { events: 0, inflight: 0 },
      events: [],
    },
    browser: {
      counts: {
        requests: 0,
        responses: 0,
        finished: 0,
        failed: 0,
        foreignIgnored: 0,
        unknownIgnored: 0,
        observerErrors: 0,
      },
      overflow: { events: 0, inflight: 0 },
      events: [],
    },
    operations: {
      counts: { begun: 0, fulfilled: 0, rejected: 0, markers: 0 },
      overflow: { events: 0 },
      activeCount: 0,
      events: [],
    },
  };
  const elapsed = () => {
    const value = now() - began;
    if (!Number.isFinite(value) || value < 0) throw new Error("STARTUP_V2_CLOCK");
    return value;
  };
  function text(value) {
    if (typeof value !== "string") throw new Error("STARTUP_V2_TEXT");
    if (value.length <= MAX_TEXT) return value;
    state.overflow.text++;
    return value.slice(0, MAX_TEXT);
  }
  function message(error) {
    try {
      if (typeof error === "string") return text(error);
      if (typeof error?.message === "string") return text(error.message);
    } catch {
      // Error rendering must not invoke arbitrary coercion or replace the original operation.
    }
    return "STARTUP_V2_OBSERVATION_ERROR";
  }
  function observerError(channel, error) {
    state.observerErrors++;
    if (channel) state[channel].counts.observerErrors++;
    if (state.errors.length < 16)
      state.errors.push({
        clock: "node-callback",
        elapsedMs: elapsed(),
        channel,
        error: message(error),
      });
    else state.overflow.errors++;
  }
  function record(channel, type, fields = {}) {
    if (disposed) return;
    const target = state[channel];
    if (target.events.length >= maxEvents) {
      target.overflow.events++;
      return;
    }
    target.events.push({ type, clock: "node-callback", elapsedMs: elapsed(), ...fields });
  }
  function snapshot() {
    return structuredClone({
      ...state,
      server: { ...state.server, inflight: [...serverInflight.values()] },
      browser: { ...state.browser, inflight: [...browserInflight.values()] },
    });
  }
  function scheduleHeartbeat() {
    const expected = now() + heartbeatIntervalMs;
    timer = setTimer(() => {
      timer = null;
      if (disposed) return;
      try {
        const callbackAt = now();
        const lag = Math.max(0, callbackAt - expected);
        if (!Number.isFinite(lag)) throw new Error("STARTUP_V2_CLOCK");
        const heartbeat = state.heartbeat;
        heartbeat.sampleCount++;
        heartbeat.lastLagMs = lag;
        heartbeat.maxLagMs = Math.max(heartbeat.maxLagMs, lag);
        heartbeat.lastCallbackElapsedMs = elapsed();
        if (heartbeat.sampleCount >= maxHeartbeatSamples) heartbeat.sampleLimitReached = true;
        else scheduleHeartbeat();
      } catch (error) {
        observerError(null, error);
      }
    }, heartbeatIntervalMs);
  }
  function ownedHttpUrl(request) {
    const address = request.socket?.remoteAddress;
    if (
      request.headers?.host !== "127.0.0.1:5353" ||
      !["127.0.0.1", "::ffff:127.0.0.1", "::1"].includes(address) ||
      typeof request.url !== "string" ||
      !request.url.startsWith("/") ||
      request.url.length > MAX_TEXT
    )
      return null;
    const parsed = new URL(request.url, origin);
    return parsed.origin === origin ? parsed.href : null;
  }
  function middleware(request, response, next) {
    if (typeof next !== "function") throw new Error("STARTUP_V2_MIDDLEWARE_NEXT");
    if (!disposed) {
      try {
        const url = ownedHttpUrl(request);
        if (url === null) state.server.counts.foreignIgnored++;
        else {
          state.server.counts.received++;
          const id = `server.${++sequence}`;
          if (activeResponses.size >= maxInflight) {
            state.server.overflow.inflight++;
            record("server", "inflight-overflow", { id });
          } else {
            const row = { id, url, receivedElapsedMs: elapsed() };
            const terminal = (type) => {
              if (disposed || !activeResponses.has(response)) return;
              response.off("finish", onFinish);
              response.off("close", onClose);
              activeResponses.delete(response);
              serverInflight.delete(id);
              const status = response.statusCode;
              if (!Number.isInteger(status) || status < 0 || status > 999)
                throw new Error("STARTUP_V2_RESPONSE_STATUS");
              state.server.counts[type === "finish" ? "finished" : "closed"]++;
              record("server", type, { id, url, status });
            };
            const safelyTerminal = (type) => {
              try {
                terminal(type);
              } catch (error) {
                observerError("server", error);
              }
            };
            const onFinish = () => safelyTerminal("finish");
            const onClose = () => safelyTerminal("close");
            activeResponses.set(response, { onFinish, onClose });
            serverInflight.set(id, row);
            response.once("finish", onFinish);
            response.once("close", onClose);
            record("server", "receive", { id, url, method: text(request.method) });
          }
        }
      } catch (error) {
        observerError("server", error);
      }
    }
    return next();
  }
  function requestTiming(request) {
    try {
      const timing = request.timing();
      const values = {};
      for (const field of TIMING_FIELDS) {
        const value = timing[field];
        if (!Number.isFinite(value) || (value < 0 && value !== -1))
          throw new Error(`STARTUP_V2_REQUEST_TIMING_${field}`);
        values[field] = value;
      }
      return { clock: "playwright-public-request-timing", values };
    } catch (error) {
      observerError("browser", error);
      return { clock: "playwright-public-request-timing", values: null, error: message(error) };
    }
  }
  function ownedBrowserUrl(request) {
    if (request.frame()?.page() !== ownedPage) {
      state.browser.counts.foreignIgnored++;
      return null;
    }
    const url = request.url();
    if (typeof url !== "string" || url.length > MAX_TEXT || new URL(url).origin !== origin) {
      state.browser.counts.foreignIgnored++;
      return null;
    }
    return url;
  }
  function attachPage(page) {
    if (disposed) throw new Error("STARTUP_V2_DISPOSED");
    if (attached) throw new Error("STARTUP_V2_PAGE_ALREADY_ATTACHED");
    if (!page || typeof page.on !== "function" || typeof page.off !== "function")
      throw new Error("STARTUP_V2_PAGE");
    attached = true;
    ownedPage = page;
    function on(name, action) {
      const listener = (value) => {
        if (disposed) return;
        try {
          action(value);
        } catch (error) {
          observerError("browser", error);
        }
      };
      ownedPage.on(name, listener);
      pageListeners.push({ name, listener });
    }
    try {
      on("request", (request) => {
        const url = ownedBrowserUrl(request);
        if (url === null) return;
        state.browser.counts.requests++;
        if (requests.has(request)) throw new Error("STARTUP_V2_DUPLICATE_REQUEST");
        const id = `browser.${++sequence}`;
        if (browserInflight.size >= maxInflight) {
          state.browser.overflow.inflight++;
          record("browser", "inflight-overflow", { id });
          return;
        }
        const row = {
          id,
          url,
          receivedElapsedMs: elapsed(),
          requestTiming: requestTiming(request),
        };
        requests.set(request, row);
        browserInflight.set(id, row);
        record("browser", "request", {
          id,
          url,
          method: text(request.method()),
          resourceType: text(request.resourceType()),
          requestTiming: row.requestTiming,
        });
      });
      on("response", (response) => {
        const request = response.request();
        const row = requests.get(request);
        if (!row) {
          state.browser.counts.unknownIgnored++;
          return;
        }
        const status = response.status();
        if (!Number.isInteger(status) || status < 0 || status > 999)
          throw new Error("STARTUP_V2_RESPONSE_STATUS");
        state.browser.counts.responses++;
        row.requestTiming = requestTiming(request);
        record("browser", "response", {
          id: row.id,
          url: row.url,
          status,
          requestTiming: row.requestTiming,
        });
      });
      for (const [event, count] of [
        ["requestfinished", "finished"],
        ["requestfailed", "failed"],
      ])
        on(event, (request) => {
          const row = requests.get(request);
          if (!row) {
            state.browser.counts.unknownIgnored++;
            return;
          }
          requests.delete(request);
          browserInflight.delete(row.id);
          state.browser.counts[count]++;
          record("browser", event, {
            id: row.id,
            url: row.url,
            requestTiming: requestTiming(request),
            ...(event === "requestfailed"
              ? { error: text(request.failure()?.errorText ?? "unknown request failure") }
              : {}),
          });
        });
    } catch (error) {
      dispose();
      throw error;
    }
  }
  function operationName(name) {
    if (typeof name !== "string" || name.length < 1 || name.length > 128)
      throw new Error("STARTUP_V2_OPERATION_NAME");
    return name;
  }
  function marker(name) {
    if (disposed) return;
    state.operations.counts.markers++;
    record("operations", "marker", { name: operationName(name) });
  }
  function operation(name, action) {
    if (disposed) throw new Error("STARTUP_V2_DISPOSED");
    operationName(name);
    if (typeof action !== "function") throw new Error("STARTUP_V2_OPERATION_ACTION");
    const id = `operation.${++sequence}`;
    state.operations.counts.begun++;
    state.operations.activeCount++;
    record("operations", "begin", { id, name });
    let pending;
    try {
      pending = Promise.resolve(action());
    } catch (error) {
      pending = Promise.reject(error);
    }
    const result = pending.then(
      (value) => {
        if (!disposed) {
          state.operations.activeCount--;
          state.operations.counts.fulfilled++;
          record("operations", "fulfilled", { id, name });
        }
        return value;
      },
      (error) => {
        if (!disposed) {
          state.operations.activeCount--;
          state.operations.counts.rejected++;
          record("operations", "rejected", { id, name, error: message(error) });
        }
        throw error;
      },
    );
    // A coordinator deadline may abandon its await; its eventual SDK rejection remains handled.
    void result.catch(() => undefined);
    return result;
  }
  function dispose() {
    if (disposed) return snapshot();
    if (timer !== null) clearTimer(timer);
    timer = null;
    for (const { name, listener } of pageListeners) {
      try {
        ownedPage.off(name, listener);
      } catch (error) {
        observerError("browser", error);
      }
    }
    pageListeners.length = 0;
    for (const [response, listeners] of activeResponses) {
      try {
        response.off("finish", listeners.onFinish);
        response.off("close", listeners.onClose);
      } catch (error) {
        observerError("server", error);
      }
    }
    activeResponses.clear();
    ownedPage = null;
    requests = new WeakMap();
    // Pending scalar descriptions remain truthful; disposal is not completion.
    disposed = true;
    state.disposed = true;
    return snapshot();
  }
  scheduleHeartbeat();
  return { attachPage, middleware, operation, marker, snapshot, dispose };
}
