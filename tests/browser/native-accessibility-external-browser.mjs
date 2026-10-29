import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
const MAX_STDERR_BYTES = 64 * 1024;

function within(root, target) {
  const relative = path.relative(root, target);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}

async function emptyWorkspaceProfile(profile) {
  if (typeof profile !== "string" || !profile.trim())
    throw new Error("A dedicated empty browser profile is required");
  const target = path.resolve(profile),
    root = await realpath(workspace);
  if (!within(root, target))
    throw new Error("The dedicated browser profile must be inside this workspace");
  // Check the existing ancestor before creating directories; never follow a workspace symlink outside it.
  let ancestor = path.dirname(target);
  for (;;) {
    try {
      const actual = await realpath(ancestor);
      if (actual !== root && !within(root, actual))
        throw new Error("Browser profile ancestor leaves the workspace");
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await mkdir(target);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const info = await lstat(target);
  if (!info.isDirectory() || info.isSymbolicLink() || (await readdir(target)).length !== 0)
    throw new Error(
      "Browser profile must be an empty, non-symlink directory; existing files were preserved",
    );
  return target;
}

async function bounded(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dedicated native browser without Playwright's default focus/capture override.
 * No process starts at module import. Only this function's owned child may be terminated.
 * Profiles and their evidence are retained, including on failure.
 */
export async function launchExternalNativeBrowser({
  profile,
  extension,
  executablePath,
  visible = false,
} = {}) {
  if (typeof visible !== "boolean")
    throw new Error("Browser visibility must be an explicit boolean");
  const profilePath = await emptyWorkspaceProfile(profile);
  const executable = path.resolve(executablePath ?? chromium.executablePath());
  await access(executable, constants.F_OK);
  const args = [
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profilePath}`,
    "--window-size=1440,1000",
    "--no-first-run",
    "--no-default-browser-check",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ];
  if (extension !== undefined) {
    if (typeof extension !== "string" || !extension.trim())
      throw new Error("Extension must be a local fixture directory");
    const extensionPath = path.resolve(extension);
    if (!(await lstat(extensionPath)).isDirectory())
      throw new Error("Extension fixture is not a directory");
    await access(path.join(extensionPath, "manifest.json"), constants.F_OK);
    args.push(`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`);
  }
  args.push("about:blank");
  const child = spawn(executable, args, {
    windowsHide: !visible,
    shell: false,
    stdio: ["ignore", "ignore", "pipe"],
  });
  const pid = child.pid ?? null;
  let stderr = Buffer.alloc(0),
    exited = null,
    spawnError = null,
    browser = null,
    closing = null;
  child.stderr?.on("data", (chunk) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    stderr = Buffer.concat([stderr, bytes]).subarray(-MAX_STDERR_BYTES);
  });
  const exit = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      exited = { code, signal };
      resolve(exited);
    });
    child.once("error", (error) => {
      spawnError = error;
      exited = { code: null, signal: null, error: error.message };
      resolve(exited);
    });
  });
  const cleanup = {
    ownedPid: pid,
    startedAt: null,
    finishedAt: null,
    protocolCloseAttempted: false,
    protocolCloseError: null,
    clientCloseAttempted: false,
    clientCloseError: null,
    forcedKillAttempted: false,
    forcedKillError: null,
    ownedProcessExited: false,
    exit: null,
    profileRetained: true,
    stderrTail: "",
  };
  const close = () =>
    (closing ??= (async () => {
      cleanup.startedAt = new Date().toISOString();
      const deadline = Date.now() + 5000;
      if (browser?.isConnected()) {
        cleanup.protocolCloseAttempted = true;
        try {
          const session = await bounded(
            browser.newBrowserCDPSession(),
            1000,
            "Browser cleanup session",
          );
          await bounded(session.send("Browser.close"), 1000, "Native Browser.close");
        } catch (error) {
          cleanup.protocolCloseError = error.message;
        }
      }
      if (browser) {
        cleanup.clientCloseAttempted = true;
        try {
          await bounded(
            browser.close(),
            Math.max(1, Math.min(1000, deadline - Date.now())),
            "Playwright client close",
          );
        } catch (error) {
          cleanup.clientCloseError = error.message;
        }
      }
      if (!exited) {
        try {
          await bounded(exit, Math.max(1, deadline - Date.now()), "Owned browser exit");
        } catch {
          /* The fallback below addresses only this live child handle. */
        }
      }
      if (
        !exited &&
        pid !== null &&
        child.pid === pid &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        cleanup.forcedKillAttempted = true;
        try {
          if (!child.kill("SIGTERM"))
            cleanup.forcedKillError = "Owned child did not accept termination";
        } catch (error) {
          cleanup.forcedKillError = error.message;
        }
        try {
          await bounded(exit, 1000, "Terminated owned browser exit");
        } catch (error) {
          cleanup.forcedKillError ??= error.message;
        }
      }
      cleanup.ownedProcessExited = exited !== null;
      cleanup.exit = exited;
      cleanup.stderrTail = stderr.toString("utf8");
      cleanup.finishedAt = new Date().toISOString();
      return structuredClone(cleanup);
    })());

  try {
    const deadline = Date.now() + 15000;
    let websocket = null,
      lastReadError = null;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (exited)
        throw new Error(`Owned browser exited before CDP readiness: ${JSON.stringify(exited)}`);
      try {
        const [port, endpoint] = (
          await readFile(path.join(profilePath, "DevToolsActivePort"), "utf8")
        )
          .trim()
          .split(/\r?\n/);
        const numericPort = Number(port);
        if (
          Number.isInteger(numericPort) &&
          numericPort > 0 &&
          numericPort <= 65535 &&
          /^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(endpoint ?? "")
        ) {
          websocket = `ws://127.0.0.1:${numericPort}${endpoint}`;
          break;
        }
      } catch (error) {
        if (!["ENOENT", "EBUSY", "EACCES"].includes(error.code)) throw error;
        lastReadError = error.message;
      }
      await delay(50);
    }
    if (!websocket)
      throw new Error(
        `Native CDP readiness exceeded 15 seconds${lastReadError ? `: ${lastReadError}` : ""}`,
      );
    browser = await chromium.connectOverCDP(websocket, {
      noDefaults: true,
      timeout: Math.max(1, deadline - Date.now()),
    });
    const contexts = browser.contexts();
    const context = contexts[0];
    if (contexts.length !== 1 || !context)
      throw new Error(`Expected the sole native default context, found ${contexts.length}`);
    return {
      browser,
      context,
      pid,
      executable,
      args: Object.freeze([...args]),
      profile: profilePath,
      visible,
      cleanup,
      getStderr: () => stderr.toString("utf8"),
      close,
    };
  } catch (cause) {
    const details = await close();
    const error = new Error(`EXTERNAL_NATIVE_BROWSER_START_FAILED: ${cause.message}`, { cause });
    error.cleanup = details;
    error.stderrTail = stderr.toString("utf8");
    throw error;
  }
}
