import { once } from "node:events";
import { finished } from "node:stream/promises";
import { createWriteStream } from "node:fs";

export async function stopOwnedProcess(
  child,
  { setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = 5000 } = {},
) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    let timer;
    const done = (error) => {
      child.removeListener("exit", onExit);
      child.removeListener("close", onExit);
      if (timer !== undefined) clearTimer(timer);
      error ? reject(error) : resolve();
    };
    const onExit = () => done();
    child.once("exit", onExit);
    child.once("close", onExit);
    timer = setTimer(
      () => done(new Error(`Preview process ${child.pid} termination timeout`)),
      timeoutMs,
    );
    try {
      child.kill("SIGTERM");
    } catch (error) {
      done(error);
    }
  });
}

export async function cleanupOwnedResources({
  primaryError,
  resources,
  operationMs = 5000,
  budgetMs = 15000,
}) {
  const errors = primaryError ? [primaryError] : [],
    deadline = Date.now() + budgetMs;
  for (const resource of resources) {
    let timer;
    try {
      const limit = Math.max(0, Math.min(operationMs, deadline - Date.now()));
      await Promise.race([
        Promise.resolve().then(resource.close),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${resource.label} cleanup timeout`)), limit);
        }),
      ]);
    } catch (error) {
      errors.push(error);
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    errors,
    error:
      errors.length > 1 ? new AggregateError(errors, "Owned resource cleanup failed") : errors[0],
  };
}
export function observeAsyncFailure(promise, failures, label) {
  Promise.resolve(promise).catch((error) => failures.push({ label, error }));
}
export function createBoundedCapture({
  maxEntries = 4096,
  maxBytes = 1024 * 1024,
  maxEntryBytes = 16 * 1024,
} = {}) {
  const entries = [];
  let bytes = 0,
    dropped = 0,
    invalidated = false;
  return {
    add(value) {
      try {
        const string =
          typeof value === "string"
            ? value
            : typeof value === "object" && !Buffer.isBuffer(value)
              ? JSON.stringify(value)
              : String(value);
        const size = Buffer.byteLength(string);
        if (size > maxEntryBytes || entries.length >= maxEntries || bytes + size > maxBytes) {
          dropped++;
          invalidated = true;
          return;
        }
        entries.push(value);
        bytes += size;
      } catch {
        dropped++;
        invalidated = true;
      }
    },
    snapshot: () => ({ entries: [...entries], bytes, dropped, invalidated }),
  };
}
export async function saveOwnedTrace(cdp, metadata, filename, dependencies = {}) {
  if (!metadata.stream || metadata.streamCompression !== "gzip")
    throw new Error("V3_UNSUPPORTED_TRACE_STREAM");
  const target = (dependencies.createWriteStream ?? createWriteStream)(filename, { flags: "wx" });
  const waitFinished = dependencies.finished ?? finished,
    waitOnce = dependencies.once ?? once;
  let transferred = 0,
    completed = false,
    streamError,
    primary;
  const onError = (error) => {
    streamError ??= error;
  };
  target.on("error", onError);
  try {
    for (;;) {
      const part = await cdp.send("IO.read", { handle: metadata.stream, size: 1024 * 1024 });
      if (streamError) throw streamError;
      if (typeof part.data !== "string" || typeof part.eof !== "boolean")
        throw new Error("V3_TRACE_PART_SCHEMA");
      const bytes = Buffer.from(part.data, part.base64Encoded ? "base64" : "utf8");
      transferred += bytes.byteLength;
      if (transferred > (dependencies.maxCompressedBytes ?? 16 * 1024 * 1024))
        throw new Error("V3_COMPRESSED_TRACE_CAP");
      if (!target.write(bytes)) await waitOnce(target, "drain");
      if (streamError) throw streamError;
      if (part.eof) break;
    }
    target.end();
    await waitFinished(target, { cleanup: true });
    if (streamError) throw streamError;
    completed = true;
  } catch (error) {
    primary = error;
  }
  if (!completed) target.destroy();
  let closeError;
  try {
    await cdp.send("IO.close", { handle: metadata.stream });
  } catch (error) {
    closeError = error;
  }
  target.removeListener("error", onError);
  if (primary && closeError)
    throw new AggregateError([primary, closeError], "Trace and close failed");
  if (primary || closeError) throw primary ?? closeError;
}

export async function runOwnedStartup(startup, resources, options = {}) {
  try {
    return await startup();
  } catch (primaryError) {
    const result = await cleanupOwnedResources({ ...options, primaryError, resources });
    throw result.error;
  }
}
import { createHash } from "node:crypto";
export const UI_RAW_MAX_BYTES = 256 * 1024 * 1024;
// Emit JSON incrementally: no full-sized JSON string or buffer is constructed.
export async function writeBoundedUIRaw(
  filename,
  value,
  maxBytes = UI_RAW_MAX_BYTES,
  dependencies = {},
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > UI_RAW_MAX_BYTES)
    throw Error("UI_RAW_CAP_CONTRACT");
  const stream = (dependencies.createWriteStream ?? createWriteStream)(filename, { flags: "wx" }),
    hash = createHash("sha256");
  let bytes = 0,
    streamError;
  const onError = (e) => {
    streamError ??= e;
  };
  stream.on("error", onError);
  const settled = finished(stream, { cleanup: true }).then(
    () => null,
    (error) => error,
  );
  const ancestors = new Set();
  async function emit(s) {
    if (streamError) throw streamError;
    const n = Buffer.byteLength(s, "utf8");
    bytes += n;
    if (bytes > maxBytes) throw Error("UI_RAW_CAP");
    hash.update(s);
    if (!stream.write(s)) await once(stream, "drain");
    if (streamError) throw streamError;
  }
  async function encode(v, depth) {
    if (depth > 256) throw Error("UI_RAW_DEPTH_CAP");
    if (typeof v === "string" && v.length > maxBytes) throw Error("UI_RAW_CAP");
    if (v === null || typeof v !== "object") {
      const s = JSON.stringify(v);
      if (s === undefined) throw Error("UI_RAW_VALUE_SCHEMA");
      await emit(s);
      return;
    }
    if (ancestors.has(v) || (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype))
      throw Error("UI_RAW_VALUE_SCHEMA");
    ancestors.add(v);
    const array = Array.isArray(v);
    if (
      array &&
      (Object.keys(v).length !== v.length || Object.keys(v).some((key, i) => key !== String(i)))
    )
      throw Error("UI_RAW_VALUE_SCHEMA");
    await emit(array ? "[" : "{");
    let first = true;
    for (const key of Object.keys(v)) {
      const item = v[key];
      if (item === undefined || typeof item === "function" || typeof item === "symbol") {
        if (array) throw Error("UI_RAW_VALUE_SCHEMA");
        continue;
      }
      if (!first) await emit(",");
      first = false;
      if (!array) {
        if (key.length > maxBytes) throw Error("UI_RAW_CAP");
        await emit(JSON.stringify(key));
        await emit(":");
      }
      await encode(item, depth + 1);
    }
    await emit(array ? "]" : "}");
    ancestors.delete(v);
  }
  try {
    await encode(value, 0);
    stream.end();
    const failure = await settled;
    if (failure) throw failure;
    if (streamError) throw streamError;
    return { bytes, sha256: hash.digest("hex") };
  } catch (e) {
    stream.destroy();
    await settled;
    if (!stream.closed) await new Promise((resolve) => stream.once("close", resolve));
    throw e;
  } finally {
    stream.removeListener("error", onError);
  }
}

// Capture only documented lifecycle events while the trace is owned.
export function observeTraceFaults({ browser, page, cdp, records, phase = () => "trace" }) {
  let resolveFault,
    active = true;
  const fault = new Promise((resolve) => {
    resolveFault = resolve;
  });
  const bindings = [
    [browser, "disconnected"],
    [page, "crash"],
    [cdp, "close"],
  ];
  const listeners = bindings.map(([target, event]) => {
    const listener = () => {
      if (!active) return;
      const record = {
        at: new Date().toISOString(),
        phase: phase(),
        cause:
          event === "disconnected"
            ? "browser.disconnected"
            : event === "crash"
              ? "page.crash"
              : "cdp.close",
      };
      records.push(record);
      resolveFault(record);
    };
    target.on(event, listener);
    return [target, event, listener];
  });
  return {
    fault,
    dispose() {
      active = false;
      for (const [target, event, listener] of listeners) target.removeListener(event, listener);
    },
  };
}

// Timeout includes the stop command and completion; all late failures remain observed.
export async function checkpointThenCloseTrace({
  checkpoint,
  stop,
  completion,
  fault,
  timeoutMs,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180000)
    throw Error("TRACE_TIMEOUT_CONTRACT");
  const observed = Promise.resolve(completion).then(
    (value) => ({ failed: false, value }),
    (error) => ({ failed: true, error }),
  );
  const observedFault =
    fault === undefined
      ? new Promise(() => {})
      : Promise.resolve(fault).then(
          (error) => ({ failed: true, error }),
          (error) => ({ failed: true, error }),
        );
  let checkpointResult,
    primary,
    checkpointFailed = false;
  try {
    checkpointResult = await checkpoint();
  } catch (error) {
    checkpointFailed = true;
    primary = error;
  }
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimer(
      () => resolve({ failed: true, error: Error("CDP_TRACE_FLUSH_TIMEOUT") }),
      timeoutMs,
    );
  });
  const stopped = Promise.resolve()
    .then(stop)
    .then(
      () => ({ failed: false }),
      (error) => ({ failed: true, error }),
    );
  const stopAndCompletion = stopped.then(async (stopResult) => {
    if (stopResult.failed) return stopResult;
    if (checkpointFailed) return { failed: true, error: primary };
    return observed;
  });
  const completionFailure = observed.then((result) =>
    result.failed ? result : new Promise(() => {}),
  );
  try {
    if (checkpointFailed) {
      const stopResult = await Promise.race([stopped, observedFault, timeout]);
      if (stopResult.failed)
        throw new AggregateError([primary, stopResult.error], "Checkpoint and trace stop failed");
      throw primary;
    }
    const result = await Promise.race([
      stopAndCompletion,
      completionFailure,
      observedFault,
      timeout,
    ]);
    if (result.failed) throw result.error;
    return { checkpoint: checkpointResult, traceMeta: result.value };
  } finally {
    clearTimer(timer);
  }
}

export function finalizeTraceFaults(report, observer) {
  observer?.dispose();
  const faults = [...(report.traceLifecycleFaults ?? [])];
  report.traceLifecycleFaults = faults;
  if (faults.length) {
    report.status = "FAILED_TRACE_LIFECYCLE";
    return true;
  }
  return false;
}
