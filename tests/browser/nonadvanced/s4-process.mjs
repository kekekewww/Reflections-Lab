import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { finished } from "node:stream/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const message = (error) => (error instanceof Error ? error.message : String(error));
const errorData = (error, stage) => ({
  stage,
  name: error?.name ?? "Error",
  message: message(error),
  code: typeof error?.code === "string" ? error.code : null,
});
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Only a process created by this call is terminated. No browser or product API is used. */
export async function executeLane(command, env, directory, timeoutMs, options = {}) {
  assert.ok(
    Array.isArray(command) &&
      command.length > 0 &&
      command.every((value) => typeof value === "string"),
  );
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 3_600_000);
  const stopGraceMs = options.stopGraceMs ?? 1000;
  assert.ok(Number.isSafeInteger(stopGraceMs) && stopGraceMs >= 0 && stopGraceMs <= 5000);
  const cleanupLimitMs = 6000 + stopGraceMs;
  const record = {
    startedAt: new Date().toISOString(),
    endedAt: null,
    childPid: null,
    command: [process.execPath, ...command],
    status: null,
    signal: null,
    spawned: false,
    terminal: false,
    terminalScope: "Owned lane Node child exit only; not whole-tree or browser absence",
    naturalExitDescendantAbsence: "UNVERIFIED_REQUIRES_ROOT_PROCESS_LEDGER",
    controlledStopScope:
      "Owned-root termination attempt and actual helper exit only; pure Node tests verify their own known descendant, browser cleanup has a separate gate",
    interrupted: false,
    interruptSignal: null,
    timedOut: false,
    stopReason: null,
    termination: null,
    outputErrors: [],
    processErrors: [],
    ok: false,
  };
  const outputKeys = new Set();
  const logs = [];
  const mirrorHandlers = new Map(),
    mirrorWrites = new Set();
  let receiptFinalized = false;
  let child = null,
    childClosed = false,
    childClose = null;
  let timer = null,
    stopPromise = null;
  let markStopped;
  const stopped = new Promise((resolve) => {
    markStopped = resolve;
  });
  const addProcessError = (error, stage) => record.processErrors.push(errorData(error, stage));

  function outputFailure(error, stream) {
    const data = { ...errorData(error, "output"), stream };
    const key = `${stream}:${data.code}:${data.message}`;
    if (!outputKeys.has(key)) {
      outputKeys.add(key);
      record.outputErrors.push(data);
    }
    void requestStop("output-error");
  }
  function openLog(name) {
    const factory = options.createLogStream ?? createWriteStream;
    let stream;
    try {
      stream = factory(join(directory, `${name}.txt`), { flags: "wx" });
    } catch (error) {
      outputFailure(error, name);
      return null;
    }
    // Both listeners are installed immediately, before a possible open/write error.
    stream.on("error", (error) => outputFailure(error, name));
    const closed = finished(stream).then(
      () => null,
      (error) => {
        outputFailure(error, name);
        return error;
      },
    );
    const opened = new Promise((resolve) => {
      if (Number.isInteger(stream.fd)) {
        resolve(true);
        return;
      }
      stream.once("open", () => resolve(true));
      stream.once("error", () => resolve(false));
      stream.once("close", () => resolve(false));
    });
    const log = { stream, opened, closed, name };
    logs.push(log);
    return log;
  }
  function mirrorChunk(mirror, chunk) {
    if (!mirrorHandlers.has(mirror)) {
      const handler = (error) => {
        if (receiptFinalized) return;
        addProcessError(error, "output-mirror");
        void requestStop("mirror-error");
      };
      mirrorHandlers.set(mirror, handler);
      mirror.on("error", handler);
    }
    let complete;
    const write = new Promise((resolve) => {
      complete = resolve;
    });
    mirrorWrites.add(write);
    const done = (error) => {
      if (error && !receiptFinalized) {
        addProcessError(error, "output-mirror-write");
        void requestStop("mirror-error");
      }
      mirrorWrites.delete(write);
      complete();
    };
    try {
      mirror.write(chunk, done);
    } catch (error) {
      done(error);
    }
  }
  async function finishMirrors() {
    let deadline;
    const completed = await Promise.race([
      Promise.all([...mirrorWrites]).then(() => true),
      new Promise((resolve) => {
        deadline = setTimeout(() => resolve(false), 2000);
      }),
    ]);
    clearTimeout(deadline);
    if (!completed)
      addProcessError(
        new Error("Output mirror did not drain before its deadline"),
        "output-mirror-close",
      );
    // If a broken parent pipe still owns pending writes, retain only this scoped
    // error sink; the terminal receipt reports that cleanup failure explicitly.
    if (completed)
      for (const [mirror, handler] of mirrorHandlers) mirror.removeListener("error", handler);
  }
  function ownGroupAlive(pid) {
    try {
      process.kill(-pid, 0);
      return true;
    } catch (error) {
      if (error.code === "ESRCH") return false;
      addProcessError(error, "owned-group-probe");
      return true;
    }
  }
  async function windowsStop(pid) {
    // Killing the Node owner first would lose its browser/worker tree identity.
    // taskkill receives this invocation's live child PID as a structured argument.
    const executable = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    const result = await new Promise((resolve) => {
      const killer = spawn(executable, ["/PID", String(pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      let settled = false;
      const complete = (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(deadline);
          resolve(value);
        }
      };
      const deadline = setTimeout(() => {
        try {
          killer.kill("SIGKILL");
        } catch {
          /* The helper may have just exited. */
        }
        complete({
          status: null,
          signal: null,
          error: "Owned process-tree termination exceeded its deadline",
        });
      }, 5000);
      killer.once("error", (error) =>
        complete({ status: null, signal: null, error: message(error) }),
      );
      killer.once("close", (status, signal) => complete({ status, signal, error: null }));
    });
    record.termination = { method: "windows-owned-process-tree", ...result };
    if (result.error || (result.status !== 0 && !childClosed)) {
      addProcessError(
        new Error(result.error ?? `taskkill exited ${result.status}`),
        "owned-tree-stop",
      );
      if (!childClosed) {
        try {
          child.kill("SIGKILL");
        } catch (error) {
          addProcessError(error, "owned-child-force-stop");
        }
      }
    }
  }
  async function posixStop(pid) {
    const send = (signal) => {
      try {
        process.kill(-pid, signal);
      } catch (error) {
        if (error.code !== "ESRCH") addProcessError(error, "owned-group-stop");
      }
    };
    record.termination = {
      method: "posix-owned-process-group",
      gracefulSignal: "SIGTERM",
      forced: false,
    };
    send("SIGTERM");
    await pause(stopGraceMs);
    if (ownGroupAlive(pid)) {
      record.termination.forced = true;
      send("SIGKILL");
    }
  }
  function requestStop(reason) {
    if (!record.stopReason) record.stopReason = reason;
    markStopped();
    if (!child || childClosed || !child.pid) return Promise.resolve();
    if (!stopPromise) {
      stopPromise = (
        process.platform === "win32" ? windowsStop(child.pid) : posixStop(child.pid)
      ).catch((error) => {
        addProcessError(error, "owned-stop");
      });
    }
    return stopPromise;
  }
  function interrupt(signal) {
    record.interrupted = true;
    record.interruptSignal = signal;
    void requestStop("interrupted");
  }
  const onSigint = () => interrupt("SIGINT"),
    onSigterm = () => interrupt("SIGTERM");
  const onAbort = () => interrupt("AbortSignal");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();

  async function closeLogs() {
    for (const { stream } of logs) {
      if (!stream.destroyed && !stream.writableEnded) stream.end();
    }
    let deadline;
    const completed = await Promise.race([
      Promise.all(logs.map((log) => log.closed)).then(() => true),
      new Promise((resolve) => {
        deadline = setTimeout(() => resolve(false), 2000);
      }),
    ]);
    clearTimeout(deadline);
    if (!completed) {
      outputFailure(new Error("Output stream close exceeded its deadline"), "close");
      for (const { stream } of logs) stream.destroy();
    }
  }
  try {
    const stdout = openLog("stdout"),
      stderr = openLog("stderr");
    const opened = await Promise.all(logs.map((log) => log.opened));
    if (
      stdout &&
      stderr &&
      opened.every(Boolean) &&
      !record.outputErrors.length &&
      !record.interrupted
    ) {
      child = spawn(process.execPath, command, {
        cwd: options.cwd ?? workspaceRoot,
        env,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      record.childPid = child.pid ?? null;
      record.spawned = Boolean(child.pid);
      childClose = new Promise((resolve) => {
        child.once("error", (error) => {
          addProcessError(error, "child");
          void requestStop("child-error");
        });
        child.once("close", (status, signal) => {
          // No async event callback: completion rejection cannot escape this function.
          childClosed = true;
          record.status = status;
          record.signal = signal;
          resolve();
        });
      });
      for (const [pipe, log, mirror] of [
        [child.stdout, stdout, process.stdout],
        [child.stderr, stderr, process.stderr],
      ]) {
        if (!pipe) continue;
        pipe.on("error", (error) => {
          addProcessError(error, `${log.name}-pipe`);
          void requestStop("pipe-error");
        });
        pipe.pipe(log.stream);
        if (options.echoOutput !== false) pipe.on("data", (chunk) => mirrorChunk(mirror, chunk));
      }
      timer = setTimeout(() => {
        record.timedOut = true;
        void requestStop("timeout");
      }, timeoutMs);
      const deadline = stopped.then(async () => {
        let handle;
        const value = await Promise.race([
          childClose.then(() => true),
          new Promise((resolve) => {
            handle = setTimeout(() => resolve(false), cleanupLimitMs);
          }),
        ]);
        clearTimeout(handle);
        if (!value) {
          addProcessError(
            new Error("Owned child did not become terminal before the cleanup deadline"),
            "child-cleanup",
          );
          try {
            child.kill("SIGKILL");
          } catch (error) {
            addProcessError(error, "owned-child-final-stop");
          }
        }
      });
      await Promise.race([childClose, deadline]);
      clearTimeout(timer);
      timer = null;
      if (stopPromise) await stopPromise;
      record.terminal = childClosed;
    } else record.terminal = true;
  } catch (error) {
    addProcessError(error, "lane-wrapper");
    await requestStop("wrapper-error");
    if (childClose) {
      let deadline;
      await Promise.race([
        childClose,
        new Promise((resolve) => {
          deadline = setTimeout(resolve, cleanupLimitMs);
        }),
      ]);
      clearTimeout(deadline);
    }
    record.terminal = !child || childClosed;
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
    options.signal?.removeEventListener("abort", onAbort);
    await closeLogs();
    await finishMirrors();
    record.endedAt = new Date().toISOString();
    record.ok =
      record.spawned &&
      record.terminal &&
      record.status === 0 &&
      !record.signal &&
      !record.interrupted &&
      !record.timedOut &&
      !record.outputErrors.length &&
      !record.processErrors.length;
    receiptFinalized = true;
    try {
      await writeFile(join(directory, "actual-exit.json"), JSON.stringify(record, null, 2) + "\n", {
        flag: "wx",
      });
    } catch (error) {
      const failure = new Error(`S4_RECEIPT_WRITE_FAILED: ${message(error)}`);
      failure.receipt = record;
      throw failure;
    }
  }
  return record;
}
