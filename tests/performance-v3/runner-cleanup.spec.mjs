// Frozen BEFORE R3 implementation. Pure fakes only; never launches runner/main/browser/preview/CDP.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { ESLint } from "eslint";
import {
  makeStopProcess,
  makeSaveTrace,
  startupCleanup,
  observeWatchdog,
  makeCapture,
  flattenErrors,
  usesOwnedCleanupSeam,
  wiredHelperNames,
  source,
  runnerPath,
  helperPath,
} from "./runner-adapter.mjs";

function virtualTimers() {
  let next = 1;
  const timers = new Map();
  return {
    setTimer(fn) {
      const id = next++;
      timers.set(id, fn);
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    fireAll() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    size: () => timers.size,
  };
}
function fakeChild(onKill = null) {
  const child = new EventEmitter();
  Object.assign(child, {
    pid: 4242,
    exitCode: null,
    signalCode: null,
    kills: [],
    kill(signal) {
      this.kills.push(signal);
      onKill?.(this);
      return true;
    },
  });
  return child;
}
function fakeTarget({ emitErrorOnWrite = null } = {}) {
  const target = new EventEmitter();
  Object.assign(target, {
    writes: [],
    destroys: 0,
    ended: 0,
    observedBeforeWrite: false,
    write(bytes) {
      this.observedBeforeWrite = this.listenerCount("error") > 1; // one external test safety handler
      this.writes.push(bytes);
      if (emitErrorOnWrite) this.emit("error", emitErrorOnWrite);
      return true;
    },
    end() {
      this.ended++;
      this.emit("finish");
      this.emit("close");
    },
    destroy() {
      this.destroys++;
      this.destroyed = true;
      this.emit("close");
    },
  });
  target.on("error", () => {});
  return target;
}
test("runner cleanup: synchronous retained native exit is observed before kill with no timer/listener leak", async () => {
  const timers = virtualTimers();
  const child = fakeChild((owned) => {
    owned.exitCode = 0;
    owned.emit("exit", 0, null);
    owned.emit("close", 0, null);
  });
  const stop = makeStopProcess(child, { ...timers, timeoutMs: 10 });
  const pending = stop();
  await Promise.resolve();
  const timersAfterNativeClose = timers.size(),
    listenersAfterNativeClose = child.listenerCount("exit") + child.listenerCount("close");
  timers.fireAll();
  await pending;
  assert.equal(timersAfterNativeClose, 0, "owned close must not wait for its timeout");
  assert.equal(listenersAfterNativeClose, 0, "all settlement listeners must detach");
  assert.deepEqual(child.kills, ["SIGTERM"]);
});
test("runner cleanup: retained process timeout is bounded and removes settlement listeners", async () => {
  const timers = virtualTimers(),
    child = fakeChild();
  const pending = makeStopProcess(child, { ...timers, timeoutMs: 10 })();
  timers.fireAll();
  await assert.rejects(pending, /terminate|timeout|TIMEOUT/i);
  assert.equal(child.listenerCount("exit") + child.listenerCount("close"), 0);
  assert.equal(timers.size(), 0);
  assert.deepEqual(child.kills, ["SIGTERM"]);
});
test("runner cleanup: exited owned process is never killed or looked up by PID", async () => {
  const child = fakeChild();
  child.exitCode = 0;
  await makeStopProcess(child, { timeoutMs: 10 })();
  assert.equal(child.kills.length, 0);
});
test("runner cleanup: startup primary and browser cleanup failure retained while preview is still closed", async () => {
  const primary = new Error("primary-page-collection"),
    browserFailure = new Error("browser-close-failure");
  let previewCalls = 0,
    caught;
  try {
    await startupCleanup(
      primary,
      {
        close: async () => {
          throw browserFailure;
        },
      },
      async () => {
        previewCalls++;
      },
      { operationMs: 10, budgetMs: 30 },
    );
  } catch (error) {
    caught = error;
  }
  assert.equal(previewCalls, 1, "one cleanup failure cannot skip another owned resource");
  assert.ok(flattenErrors(caught).includes(primary), "primary error identity preserved");
  assert.ok(flattenErrors(caught).includes(browserFailure), "cleanup error identity preserved");
});
test("runner cleanup: browser close never settling is bounded and later preview cleanup still runs", async () => {
  const primary = new Error("primary-abort"),
    blocked = new Promise(() => {});
  let previewCalls = 0,
    settled = false;
  const work = startupCleanup(
    primary,
    { close: () => blocked },
    async () => {
      previewCalls++;
    },
    { operationMs: 5, budgetMs: 15 },
  ).catch((error) => {
    settled = true;
    assert.ok(flattenErrors(error).includes(primary));
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(settled, true, "cleanup operation must have its own bounded deadline");
  assert.equal(previewCalls, 1);
  await work;
});
test("runner cleanup: trace read primary plus IO.close failure are both preserved", async () => {
  const primary = new Error("trace-read-primary"),
    closeFailure = new Error("trace-close-secondary"),
    target = fakeTarget();
  const commands = [];
  const cdp = {
    async send(command) {
      commands.push(command);
      if (command === "IO.read") throw primary;
      throw closeFailure;
    },
  };
  let caught;
  try {
    await makeSaveTrace({
      createWriteStream: () => target,
      finished: async () => {},
      operationMs: 10,
    })(cdp, { stream: "owned-stream", streamCompression: "gzip" }, "fake-output");
  } catch (error) {
    caught = error;
  }
  assert.ok(flattenErrors(caught).includes(primary));
  assert.ok(flattenErrors(caught).includes(closeFailure));
  assert.equal(target.destroys, 1);
  assert.deepEqual(commands, ["IO.read", "IO.close"]);
});
test("runner cleanup: stream errors observed before first write and error/close listeners detached after close", async () => {
  const writeFailure = new Error("writable-write-error"),
    target = fakeTarget({ emitErrorOnWrite: writeFailure });
  const cdp = {
    async send(command) {
      return command === "IO.read" ? { data: "x", eof: true, base64Encoded: false } : {};
    },
  };
  await assert.rejects(
    makeSaveTrace({ createWriteStream: () => target, finished: async () => {}, operationMs: 10 })(
      cdp,
      { stream: "owned-stream", streamCompression: "gzip" },
      "fake-output",
    ),
    /writable-write-error/,
  );
  assert.equal(target.observedBeforeWrite, true);
  assert.equal(target.listenerCount("error"), 1, "only external test safety observer remains");
  assert.equal(target.listenerCount("close"), 0);
});
test("runner cleanup: trace byte cap exact boundary passes and cap+1 rejects without growing output", async () => {
  for (const [bytes, valid] of [
    [4, true],
    [5, false],
  ]) {
    const target = fakeTarget(),
      commands = [];
    const cdp = {
      async send(command) {
        commands.push(command);
        return command === "IO.read"
          ? { data: "x".repeat(bytes), eof: true, base64Encoded: false }
          : {};
      },
    };
    const operation = makeSaveTrace({
      createWriteStream: () => target,
      finished: async () => {},
      maxCompressedBytes: 4,
      operationMs: 10,
    })(cdp, { stream: "owned-stream", streamCompression: "gzip" }, "fake-output");
    if (valid) await operation;
    else await assert.rejects(operation, /CAP/);
    assert.ok(target.writes.reduce((sum, b) => sum + b.byteLength, 0) <= 4);
    assert.equal(commands.filter((c) => c === "IO.close").length, 1);
  }
});
test("runner cleanup: watchdog promise rejection is observed and retained without async event throw", async () => {
  const failure = new Error("watchdog-browser-close"),
    failures = [];
  let observed = false;
  const thenable = {
    then(_resolve, reject) {
      observed = true;
      reject(failure);
    },
    catch(reject) {
      observed = true;
      reject(failure);
    },
  };
  assert.doesNotThrow(() => observeWatchdog({ close: () => thenable }, failures));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(observed, true);
  assert.ok(failures.some((entry) => entry === failure || entry.error === failure));
});
test("runner guards: preview/console/receipt style captures bound count, bytes and oversized single entries", () => {
  const capture = makeCapture({ maxEntries: 2, maxBytes: 8, maxEntryBytes: 4 });
  capture.emit("aaaa");
  capture.emit("bbbb");
  capture.emit("c");
  const view = capture.view();
  assert.ok(view.bytes <= 8);
  assert.ok(view.entries.length <= 2);
  assert.equal(view.invalidated, true);
  assert.ok(view.dropped >= 1);
});
test("runner guards: asynchronous capture producers cannot throw into the event loop", () => {
  const capture = makeCapture({ maxEntries: 2, maxBytes: 8, maxEntryBytes: 4 });
  const bad = {
    toString() {
      throw Error("capture-producer-failure");
    },
    toJSON() {
      throw Error("capture-producer-failure");
    },
  };
  assert.doesNotThrow(() => capture.emit(bad));
  assert.equal(capture.view().invalidated, true);
});
test("runner ownership helper is wired at actual runner call sites once introduced", () => {
  if (usesOwnedCleanupSeam)
    assert.deepEqual(
      wiredHelperNames().sort(),
      [
        "stopOwnedProcess",
        "cleanupOwnedResources",
        "saveOwnedTrace",
        "createBoundedCapture",
        "observeAsyncFailure",
      ].sort(),
    );
});
test("runner and wired helper pass existing scoped no-undef policy inside this same bounded bundle", async () => {
  const lint = new ESLint({ cwd: process.cwd(), ignore: false });
  const results = await lint.lintText(source, { filePath: runnerPath });
  if (usesOwnedCleanupSeam)
    results.push(
      ...(await lint.lintText(await readFile(helperPath, "utf8"), { filePath: helperPath })),
    );
  assert.deepEqual(
    results.flatMap((result) =>
      result.messages.map((message) => ({ rule: message.ruleId, message: message.message })),
    ),
    [],
  );
});
