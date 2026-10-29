import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ownDir = path.dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2],
  chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
let server, browser, context;
const errors = [],
  events = [];
let serverText = "",
  cleanup = {};
try {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      path.join(ownDir, "vite.config.mjs"),
      "--host",
      "127.0.0.1",
      "--port",
      "5197",
      "--strictPort",
    ],
    { cwd: process.cwd(), shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.on("error", (e) => errors.push(String(e)));
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => {
      serverText += chunk.toString();
      if (serverText.length > 1048576) {
        errors.push("VITE_LOG_CAP");
        server.kill();
      }
    });
  const deadline = Date.now() + 20000;
  while (!/Local:\s*http:\/\/127\.0\.0\.1:5197\//.test(serverText.replace(/\x1b\[[0-9;]*m/g, ""))) {
    if (server.exitCode !== null || errors.length) throw Error("VITE_START_FAILED");
    if (Date.now() > deadline) throw Error("VITE_START_TIMEOUT");
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  if (browser.version() !== "156.0.8078.48")
    throw Error(`CHROME_VERSION_MISMATCH:${browser.version()}`);
  const results = [];
  for (const mode of ["baseline", "worker"]) {
    context = await browser.newContext();
    await context.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" && u.port === "5197" && u.protocol === "http:")
        await route.continue();
      else {
        errors.push(`BLOCKED_REQUEST:${u.origin}`);
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("crash", () => errors.push("PAGE_CRASH"));
    page.on("console", (m) => {
      if (events.length < 200) events.push({ mode, type: m.type(), text: m.text().slice(0, 1000) });
    });
    await page.goto("http://127.0.0.1:5197/", { waitUntil: "load", timeout: 20000 });
    await page.waitForFunction(() => typeof window.runCandidate === "function", null, {
      timeout: 20000,
    });
    const result = await page.evaluate((mode) => window.runCandidate(mode), mode);
    results.push(result);
    await context.close();
    context = null;
  }
  if (errors.length) throw Error(`PAGE_ERRORS:${errors.join("|")}`);
  await writeFile(
    path.join(dir, "browser-result.json"),
    JSON.stringify(
      {
        results,
        browserVersion: browser.version(),
        events,
        zeroPaidCalls: true,
        comparisonScope:
          "serial baseline and worker, fresh contexts; synthetic fixture; not formal",
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
} catch (error) {
  errors.push(String(error?.stack ?? error));
  process.exitCode = 1;
} finally {
  try {
    await context?.close();
    cleanup.context = "closed";
  } catch (e) {
    errors.push(String(e));
  }
  try {
    await browser?.close();
    cleanup.browser = "closed";
  } catch (e) {
    errors.push(String(e));
  }
  if (server) {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    cleanup.serverExitCode = server.exitCode;
    cleanup.serverSignalCode = server.signalCode;
    if (server.exitCode === null && server.signalCode === null)
      errors.push("SERVER_CLOSE_UNCONFIRMED");
  }
  await writeFile(path.join(dir, "vite.log.txt"), serverText.slice(0, 1048576), { flag: "wx" });
  await writeFile(
    path.join(dir, "cleanup.json"),
    JSON.stringify({ cleanup, errors }, null, 2) + "\n",
    { flag: "wx" },
  );
  if (errors.length) process.exitCode = 1;
}
