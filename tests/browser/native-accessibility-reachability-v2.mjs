import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify, parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { launchExternalNativeBrowser } from "./native-accessibility-external-browser.mjs";
import {
  activateOwnedWindow,
  ownedActivationBinding,
  requireNativeActivation,
} from "./native-accessibility-window-preflight.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const runFile = promisify(execFile);
const exact = (name) => ({ name, exact: true });
const references = {
  zoom: "https://developer.chrome.com/docs/extensions/reference/api/tabs",
  nativeMenu: "https://support.google.com/chrome/answer/96810",
  noDefaults:
    "https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp-option-no-defaults",
  listenerOwnership:
    "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netstat",
  windowActivation:
    "https://developer.chrome.com/docs/extensions/reference/api/windows#method-update",
  tabActivation: "https://developer.chrome.com/docs/extensions/reference/api/tabs#method-update",
  pageVisibility: "https://html.spec.whatwg.org/multipage/interaction.html#page-visibility",
};
const protectedOriginals = [
  [
    "tests/browser/native-accessibility-reachability.mjs",
    "606135b2481f6fbbd0f2336038e5f01e18d03cef66d520aa1d830f8e8bdd46bb",
  ],
  [
    "tests/browser/native-accessibility-external-browser.mjs",
    "119603b7ede08a9178c56896329994bc5b18e8f7e85cfe90ec1bc778e7e0efd7",
  ],
  [
    "tests/browser/native-accessibility-extension/manifest.json",
    "74a668fa48104f5cdbde3ebee6498b316560dd599a7fef1c69326e208f4b27cc",
  ],
  [
    "tests/browser/native-accessibility-extension/native-accessibility-zoom-worker.js",
    "79efbdf1cefa6c83175fb0a7593fa1f9135d992d2e1d633c86d7238787bc23ff",
  ],
];
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

function write(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}
function insideWorkspace(relative) {
  assert.equal(typeof relative, "string");
  const resolved = path.resolve(root, relative),
    back = path.relative(root, resolved);
  assert.ok(
    back && !back.startsWith("..") && !path.isAbsolute(back),
    "Require workspace-local manifest entries",
  );
  return resolved;
}
async function ownedPreview(url, expectedPid) {
  assert.equal(
    process.platform,
    "win32",
    "This native ownership probe currently supports Windows only",
  );
  const { stdout } = await runFile("netstat.exe", ["-ano", "-p", "tcp"], {
    timeout: 5000,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  const address = `127.0.0.1:${url.port || "80"}`;
  const rows = stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(
      (columns) =>
        columns[0] === "TCP" && columns[1] === address && /^LISTEN(?:ING)?$/.test(columns[3] ?? ""),
    );
  assert.equal(
    rows.length,
    1,
    "Require exactly one explicit loopback listener; never reuse an unknown port",
  );
  assert.equal(
    Number(rows[0][4]),
    expectedPid,
    "Preview listener PID differs from its declared owner",
  );
  return {
    checkedAt: new Date().toISOString(),
    localAddress: address,
    pid: expectedPid,
    matchingRow: rows[0].join(" "),
    reference: references.listenerOwnership,
  };
}
function loadFrozen(manifestPath) {
  const bytes = fs.readFileSync(insideWorkspace(manifestPath));
  const manifest = JSON.parse(bytes);
  const mode = Array.isArray(manifest.command) ? manifest.command.indexOf("--mode") : -1;
  assert.ok(manifest.mode === "e2e" || (mode >= 0 && manifest.command[mode + 1] === "e2e"));
  if (manifest.exitCode !== undefined) assert.equal(manifest.exitCode, 0);
  assert.equal(manifest.sourceStableDuringBuild, true);
  assert.ok(Array.isArray(manifest.inputs) && manifest.inputs.length > 0);
  assert.ok(Array.isArray(manifest.bundle) && manifest.bundle.length > 0);
  assert.ok(
    manifest.bundle.length <= 128 && manifest.inputs.length <= 10000,
    "Frozen validation exceeds this runner's bounded input budget",
  );
  assert.equal(sha256(JSON.stringify(manifest.inputs)), manifest.inputDigest);
  const index = manifest.bundle.find((item) => item.path.endsWith("/index.html"));
  assert.ok(index);
  return {
    manifestPath,
    bytes,
    sha256: sha256(bytes),
    manifest,
    bundleRoot: path.posix.dirname(index.path),
  };
}
async function verifyFrozen(frozen, url) {
  const deadline = Date.now() + 15000;
  assert.equal(
    sha256(fs.readFileSync(insideWorkspace(frozen.manifestPath))),
    frozen.sha256,
    "Manifest changed during validation",
  );
  const sources = [];
  for (const item of [...frozen.manifest.inputs, ...frozen.manifest.bundle]) {
    const actual = sha256(fs.readFileSync(insideWorkspace(item.path)));
    assert.equal(actual, item.sha256, `Frozen local source/bundle changed: ${item.path}`);
    sources.push({ path: item.path, sha256: actual });
  }
  const served = [];
  for (const item of frozen.manifest.bundle) {
    assert.ok(Date.now() < deadline, "Frozen source/HTTP verification exceeded 15 seconds");
    const relative = path.posix.relative(frozen.bundleRoot, item.path);
    assert.ok(relative && !relative.startsWith("../") && !path.isAbsolute(relative));
    const response = await fetch(new URL(relative, url), {
      signal: AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))),
      redirect: "error",
    });
    assert.ok(response.ok, `Frozen HTTP asset unavailable: ${relative}`);
    const actual = sha256(Buffer.from(await response.arrayBuffer()));
    assert.equal(actual, item.sha256, `HTTP bundle differs: ${relative}`);
    served.push({ path: relative, sha256: actual });
  }
  return { checkedAt: new Date().toISOString(), sources, served };
}
async function metrics(page, session) {
  return bounded(
    (async () => ({
      ...(await page.evaluate(() => ({
        innerWidth,
        innerHeight,
        devicePixelRatio,
        screenWidth: screen.width,
        screenHeight: screen.height,
        visualViewportScale: visualViewport?.scale ?? null,
        rootZoom: getComputedStyle(document.documentElement).zoom,
        bodyZoom: getComputedStyle(document.body).zoom,
        bodyTransform: getComputedStyle(document.body).transform,
        documentWidth: document.documentElement.scrollWidth,
        focused: document.hasFocus(),
        hidden: document.hidden,
      }))),
      window: await session.send("Browser.getWindowForTarget"),
    }))(),
    8000,
    "Native metrics",
  );
}

async function windowPreflight(page, worker, binding, stage, proof, activate = false) {
  try {
    assert.ok(worker, "V2 real-window preflight requires the isolated tabs-api fixture");
    const evidence = await requireNativeActivation({
      binding,
      stage,
      ...(activate
        ? {
            activate: (expected, expiresAt) =>
              worker.evaluate(activateOwnedWindow, { binding: expected, expiresAt }),
          }
        : {}),
      read: async () => {
        const [browser, document] = await Promise.all([
          worker.evaluate(async (owned) => {
            const tab = await chrome.tabs.get(owned.tabId);
            const window = await chrome.windows.get(owned.windowId);
            return {
              tab: {
                id: tab.id,
                windowId: tab.windowId,
                url: tab.url,
                title: tab.title,
                active: tab.active,
              },
              window: { id: window.id, focused: window.focused, state: window.state },
            };
          }, binding),
          page.evaluate(() => ({
            url: location.href,
            title: document.title,
            hidden: document.hidden,
            visibilityState: document.visibilityState,
            hasFocus: document.hasFocus(),
            activeElement: {
              tag: document.activeElement?.tagName ?? null,
              role: document.activeElement?.getAttribute("role") ?? null,
              label: document.activeElement?.getAttribute("aria-label") ?? null,
            },
          })),
        ]);
        return { ...browser, document };
      },
    });
    proof.activationGates.push(evidence);
    return evidence;
  } catch (error) {
    proof.activationGates.push(
      error.activationEvidence ?? {
        stage,
        status: "FAIL",
        failureCategory: "NATIVE_WINDOW_PREFLIGHT",
        error: String(error),
        samples: [],
      },
    );
    proof.failureCategory = "NATIVE_WINDOW_PREFLIGHT";
    throw error;
  }
}

/** Reject lookalike DPR, CSS, pinch and window-resize evidence. No browser is started by this function. */
export function validateNative200(baseline, zoom, authority) {
  assert.equal(authority.beforeZoom, 1);
  assert.equal(authority.afterZoom, 2);
  if (authority.kind === "ChromeTabsAutomaticAPI") {
    assert.equal(authority.settings.mode, "automatic");
    assert.equal(authority.settings.scope, "per-tab");
  } else {
    assert.equal(authority.kind, "ChromeNativeMenu");
    assert.equal(authority.baselineMenu?.percent, 100);
    assert.equal(authority.menu?.percent, 200);
    assert.equal(typeof authority.menu.window?.id, "number");
    assert.equal(authority.menu.window.id, authority.baselineMenu.window?.id);
    assert.match(authority.menu.screenshotSha256, /^[a-f0-9]{64}$/);
    assert.match(authority.baselineMenu.screenshotSha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(Math.abs(zoom.devicePixelRatio / baseline.devicePixelRatio - 2) < 1e-6);
  assert.ok(Math.abs(zoom.innerWidth * 2 - baseline.innerWidth) <= 2);
  assert.equal(zoom.visualViewportScale, 1);
  assert.equal(zoom.rootZoom, baseline.rootZoom);
  assert.equal(zoom.bodyZoom, baseline.bodyZoom);
  assert.equal(zoom.bodyTransform, "none");
  assert.equal(zoom.screenWidth, baseline.screenWidth);
  assert.equal(zoom.screenHeight, baseline.screenHeight);
  assert.deepEqual(zoom.window, baseline.window);
}
async function state(page) {
  return page.evaluate(() => {
    if (!window.__reflectionLab) throw new Error("Frozen e2e runtime observation is unavailable");
    const view = window.__reflectionLab.getSnapshot();
    return {
      tick: view.tick,
      simulationState: view.simulationState,
      interactionMode: view.interactionMode,
      alternativeInput: view.alternativeInput,
      listener: view.listener,
      monitor: view.monitor,
    };
  });
}
async function reach(page, target, id, proof, directory) {
  await expect(target).toHaveCount(1);
  await expect(target).toBeEnabled();
  await page.evaluate(() => {
    const previous = document.body.getAttribute("tabindex");
    document.body.tabIndex = -1;
    document.body.focus();
    if (previous === null) document.body.removeAttribute("tabindex");
    else document.body.setAttribute("tabindex", previous);
  });
  const trace = [];
  const attempt = { id, trace, reached: false };
  proof.tabAttempts.push(attempt);
  let reached = false;
  for (let index = 0; index < 180; index++) {
    await page.keyboard.press("Tab");
    trace.push(
      await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        label: document.activeElement?.getAttribute("aria-label"),
        text: document.activeElement?.textContent?.slice(0, 90),
        focused: document.hasFocus(),
        hidden: document.hidden,
        visibilityState: document.visibilityState,
      })),
    );
    if (await target.evaluate((element) => element === document.activeElement)) {
      reached = true;
      break;
    }
  }
  attempt.reached = reached;
  assert.equal(
    reached,
    true,
    `Control ${id} was not reached through bounded native Tab navigation`,
  );
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport({ ratio: 1 });
  const focus = await target.evaluate((element) => {
    const box = element.getBoundingClientRect(),
      style = getComputedStyle(element);
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      tag: element.tagName,
      rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      focusVisible: element.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      centerUnobscured: hit === element || element.contains(hit),
    };
  });
  assert.equal(focus.focusVisible, true);
  assert.notEqual(focus.outlineStyle, "none");
  assert.ok(Number.parseFloat(focus.outlineWidth) > 0);
  assert.notEqual(focus.outlineColor, "rgba(0, 0, 0, 0)");
  assert.equal(focus.centerUnobscured, true, `${id} is covered by another element`);
  await page.screenshot({ path: path.join(directory, `${id}.png`), timeout: 5000 });
  const evidence = { id, trace, focus };
  proof.reached.push(evidence);
  return evidence;
}
async function panel(page, name, proof, directory) {
  const navigation = page.getByRole("navigation", exact("主要面板"));
  if (await navigation.isVisible()) {
    const target = navigation.getByRole("button", exact(name));
    await reach(page, target, `panel-${name === "場景" ? "scene" : "viewport"}`, proof, directory);
    await page.keyboard.press("Enter");
  }
}
function nativeControl() {
  const lines = readline.createInterface({ input: process.stdin, terminal: false });
  const queue = [],
    waiting = [];
  let closed = false;
  let cancellation = null;
  lines.on("line", (line) => {
    if (waiting.length) waiting.shift().resolve(line);
    else queue.push(line);
  });
  lines.on("close", () => {
    closed = true;
    for (const item of waiting.splice(0)) item.reject(new Error("Native control stdin closed"));
  });
  return {
    async wait(event, data, timeout = 90000) {
      if (cancellation) throw cancellation;
      assert.equal(closed, false, "Native-menu strategy requires a live interactive stdin");
      process.stdout.write(JSON.stringify({ state: event, ...data }) + "\n");
      const line = queue.length
        ? queue.shift()
        : await new Promise((resolve, reject) => {
            const item = { resolve, reject };
            const timer = setTimeout(() => {
              const index = waiting.indexOf(item);
              if (index >= 0) waiting.splice(index, 1);
              cancellation = new Error(`${event} timed out`);
              reject(cancellation);
            }, timeout);
            item.resolve = (value) => {
              clearTimeout(timer);
              resolve(value);
            };
            item.reject = (error) => {
              clearTimeout(timer);
              reject(error);
            };
            waiting.push(item);
          });
      const response = JSON.parse(line);
      assert.equal(response.event, event, "Native controller replied to a different stage");
      return response;
    },
    close: () => lines.close(),
    get cancelled() {
      return cancellation !== null;
    },
    cancel(error) {
      cancellation ??= error;
      queue.splice(0);
      for (const item of waiting.splice(0)) item.reject(error);
    },
  };
}
function nativeMenuEvidence(directory, response, title, percent, name) {
  const evidencePath = path.resolve(response.evidencePath ?? "");
  assert.ok(
    evidencePath.startsWith(directory + path.sep),
    "Native menu evidence must be in this new case directory",
  );
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(typeof evidence.window?.id, "number");
  assert.ok(evidence.window.title?.includes(title));
  assert.match(evidence.tree, new RegExp(`(?:^|[^\\d])${percent}\\s*%(?:$|[^\\d])`));
  assert.match(evidence.screenshotURL, /^data:image\/(png|jpeg);base64,/);
  const image = Buffer.from(
    evidence.screenshotURL.slice(evidence.screenshotURL.indexOf(",") + 1),
    "base64",
  );
  const extension = evidence.screenshotURL.startsWith("data:image/png") ? "png" : "jpeg";
  fs.writeFileSync(path.join(directory, `${name}.${extension}`), image, { flag: "wx" });
  return { window: evidence.window, tree: evidence.tree, screenshotSha256: sha256(image), percent };
}
async function widgetChecks(page, proof, directory, control, activationGate) {
  await activationGate("before-initial-tab");
  const initial = await state(page);
  proof.initialState = initial;
  assert.notEqual(initial.simulationState, "running");
  assert.equal(initial.monitor.activeVoices, 0);
  const monitor = page.locator(".monitor-mute");
  // The engine does not exist until enableAudio. Initialize while the untouched
  // world is stopped, immediately mute, then set the real gain before Run.
  await reach(page, monitor, "enable-listening", proof, directory);
  await expect(monitor).toHaveAccessibleName("啟用聆聽");
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).monitor.state).toBe("audible");
  await expect.poll(async () => (await state(page)).monitor.muted).toBe(false);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).monitor.muted).toBe(true);
  await reach(page, page.getByRole("slider", exact("監聽音量")), "monitor-gain", proof, directory);
  await page.keyboard.press("Home");
  await expect(page.getByRole("slider", exact("監聽音量"))).toHaveValue("0");
  await expect.poll(async () => (await state(page)).monitor.gainLinear).toBe(0);
  await reach(page, page.getByRole("button", exact("開始運算")), "run", proof, directory);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await state(page)).tick).toBeGreaterThan(initial.tick + 2);
  const running = await state(page);
  assert.equal(running.simulationState, "running");

  await reach(page, monitor, "unmute-at-zero-gain", proof, directory);
  await expect(monitor).toHaveAccessibleName("監聽靜音");
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).monitor.muted).toBe(false);
  await expect(monitor).toHaveAccessibleName("靜音監聽");
  await reach(page, monitor, "actual-mute", proof, directory);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).monitor.muted).toBe(true);
  await expect(monitor).toHaveAttribute("aria-pressed", "true");
  const muted = await state(page);
  assert.equal(muted.simulationState, "running");
  assert.equal(muted.monitor.gainLinear, 0);
  proof.checks.push({
    id: "mute",
    status: "PASS",
    gainLinear: 0,
    enabledByKeyboard: true,
    mutedByKeyboard: true,
  });

  await reach(
    page,
    page.locator(".transport-actions").getByRole("button", exact("暫停")),
    "pause",
    proof,
    directory,
  );
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).simulationState).toBe("paused");
  const paused = await state(page);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  assert.equal((await state(page)).tick, paused.tick);
  proof.checks.push({
    id: "pause",
    status: "PASS",
    runningTick: running.tick,
    pausedTick: paused.tick,
  });

  const importButton = page.getByRole("button", exact("匯入專案 JSON"));
  await reach(page, importButton, "import-dialog", proof, directory);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", exact("匯入專案 JSON"))).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(importButton).toBeFocused();
  proof.checks.push({ id: "dialog-focus-return", status: "PASS" });

  await panel(page, "場景", proof, directory);
  await reach(
    page,
    page.getByRole("button", { name: /Listener \/ 環境/ }),
    "listener",
    proof,
    directory,
  );
  await page.keyboard.press("Enter");
  const form = page.getByRole("combobox", exact("傳播介質"));
  await reach(page, form, "form", proof, directory);
  await expect(form).toHaveAccessibleName("傳播介質");
  assert.equal(await form.evaluate((element) => element.tagName), "SELECT");
  proof.checks.push({ id: "form", status: "PASS", value: await form.inputValue() });

  await panel(page, "3D 視窗", proof, directory);
  const entry = page.getByRole("button", exact("進入第一人稱"));
  await reach(page, entry, "fps-entry", proof, directory);
  await page.bringToFront();
  if (!control || proof.mode !== "native200")
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await activationGate("before-fps-enter");
  await page.evaluate(() => {
    const evidence = { events: [], truncated: false, active: true };
    window.__nativeReachabilityInput = evidence;
    for (const type of ["keydown", "click", "pointerlockchange", "pointerlockerror"])
      document.addEventListener(type, (event) => {
        if (!evidence.active) return;
        if (evidence.events.length >= 64) {
          evidence.truncated = true;
          return;
        }
        evidence.events.push({
          type,
          isTrusted: event.isTrusted,
          code: event.code ?? null,
          focused: document.hasFocus(),
          activeGesture: navigator.userActivation.isActive,
          locked: document.pointerLockElement?.tagName ?? null,
        });
      });
  });
  if (control && proof.mode === "native200") {
    await control.wait("WAITING_NATIVE_FPS_GESTURE", {
      title: proof.title,
      url: page.url(),
      evidenceDirectory: directory,
    });
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  } else await page.keyboard.press("Enter");
  await expect.poll(async () => (await state(page)).interactionMode).toBe("fps-interact");
  let acquired = false,
    failure = null;
  try {
    await expect
      .poll(() => page.evaluate(() => document.pointerLockElement?.tagName), { timeout: 5000 })
      .toBe("CANVAS");
    acquired = true;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  proof.nativeLock = {
    requiredForStrictCase: proof.mode === "native200",
    acquired,
    failure,
    input: await page.evaluate(() => {
      window.__nativeReachabilityInput.active = false;
      return window.__nativeReachabilityInput;
    }),
  };
  assert.equal(proof.nativeLock.input.truncated, false);
  proof.nativeLock.trustedFocusedGesture = proof.nativeLock.input.events.some(
    (event) =>
      ["keydown", "click"].includes(event.type) &&
      event.isTrusted &&
      event.focused &&
      event.activeGesture,
  );
  if (acquired) {
    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  }
  const alternative = page.getByRole("button", exact("啟用免鎖定操作"));
  await reach(page, alternative, "enable-alternative", proof, directory);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).alternativeInput).toBe(true);
  await expect.poll(async () => (await state(page)).simulationState).toBe("paused");
  const exit = page.getByRole("button", exact("離開第一人稱"));
  await reach(page, exit, "fps-exit", proof, directory);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await state(page)).interactionMode).toBe("editor");
  const after = await state(page);
  assert.equal(after.simulationState, "paused");
  assert.deepEqual(
    after.listener,
    initial.listener,
    "Exit must restore the actual original listener pose/binding",
  );
  assert.equal(await page.evaluate(() => document.pointerLockElement === null), true);
  proof.checks.push({
    id: "exit",
    status: "PASS",
    listenerBefore: initial.listener,
    listenerAfter: after.listener,
  });
  proof.afterState = after;
  assert.deepEqual(
    proof.checks.map((item) => item.id).sort(),
    ["dialog-focus-return", "exit", "form", "mute", "pause"].sort(),
  );
  proof.controlChecksStatus = "PASS";
}

async function runCase(options, frozen, directory, mode, control, stop) {
  fs.mkdirSync(directory);
  const proof = {
    schemaVersion: 1,
    scope:
      "V1-UX-05 controls reachability; native200 strict lock is an additional separately recorded condition",
    mode,
    status: "IN_PROGRESS",
    reachabilityStatus: "NOT_RUN",
    checkedAt: new Date().toISOString(),
    references,
    browser: null,
    checks: [],
    reached: [],
    tabAttempts: [],
    activationGates: [],
    errors: [],
    consoleErrors: [],
    blockedRequests: [],
    responses: [],
    nativeLock: null,
    limitations: [
      "This case does not establish OS IME, screen reader, hearing, physical GPU performance, or overall V1 completion.",
    ],
  };
  let native, page, session, worker, authority;
  const title = `Reflection Lab Native Reachability ${path.basename(path.dirname(directory))} ${mode}`;
  proof.title = title;
  let deadline,
    workflowTimedOut = false;
  try {
    proof.preview = await ownedPreview(options.url, options.previewPid);
    proof.frozenBefore = await verifyFrozen(frozen, options.url);
    assert.equal(
      stop.interrupted,
      false,
      "Run interrupted during preflight; no browser will be started",
    );
    native = await launchExternalNativeBrowser({
      profile: path.join(root, ".cache/v1", `native-reachability-${randomUUID()}`),
      visible: true,
      ...(options.strategy === "native-menu"
        ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" }
        : { extension: path.join(root, "tests/browser/native-accessibility-extension") }),
    });
    stop.current = native;
    proof.browser = {
      pid: native.pid,
      executable: native.executable,
      args: native.args,
      visible: native.visible,
      version: native.browser.version(),
      noDefaults: true,
      defaultContextOnly: true,
    };
    assert.equal(stop.interrupted, false, "Run was interrupted during startup");
    page = native.context.pages()[0] ?? (await native.context.newPage());
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(10000);
    page.on("pageerror", (error) => proof.errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error")
        proof.consoleErrors.push({ text: message.text(), location: message.location() });
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        proof.responses.push({ url: response.url(), status: response.status() });
    });
    await native.context.route("**/*", async (route) => {
      const request = route.request(),
        address = new URL(request.url());
      if (
        (["http:", "https:"].includes(address.protocol) && address.origin !== options.url.origin) ||
        !["GET", "HEAD"].includes(request.method())
      ) {
        proof.blockedRequests.push({ url: address.href, method: request.method() });
        await route.abort();
      } else await route.continue();
    });
    await page.goto(options.url.href);
    await expect(page.getByRole("button", exact("開始運算"))).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
    proof.locale = "zh-TW";
    await page.bringToFront();
    await page.evaluate((value) => {
      document.title = value;
    }, title);
    session = await native.context.newCDPSession(page);
    if (options.strategy === "tabs-api") {
      worker =
        native.context
          .serviceWorkers()
          .find((item) => item.url().endsWith("/native-accessibility-zoom-worker.js")) ??
        (await native.context.waitForEvent("serviceworker", {
          predicate: (item) => item.url().endsWith("/native-accessibility-zoom-worker.js"),
          timeout: 15000,
        }));
      authority = await bounded(
        worker.evaluate(async (origin) => {
          const tabs = (await chrome.tabs.query({})).filter((tab) =>
            tab.url?.startsWith(`${origin}/`),
          );
          if (tabs.length !== 1 || typeof tabs[0].id !== "number")
            throw new Error("Require exactly one owned task tab");
          const tabId = tabs[0].id;
          await chrome.tabs.setZoomSettings(tabId, { mode: "automatic", scope: "per-tab" });
          await chrome.tabs.setZoom(tabId, 1);
          return {
            kind: "ChromeTabsAutomaticAPI",
            tabId,
            settings: await chrome.tabs.getZoomSettings(tabId),
            beforeZoom: await chrome.tabs.getZoom(tabId),
          };
        }, options.url.origin),
        8000,
        "Native zoom authority initialization",
      );
    } else {
      const response = await control.wait("WAITING_NATIVE_BASELINE_100", {
        title,
        url: options.url.href,
        evidenceDirectory: directory,
      });
      authority = {
        kind: "ChromeNativeMenu",
        beforeZoom: 1,
        baselineMenu: nativeMenuEvidence(
          directory,
          response,
          title,
          100,
          "native-menu-baseline-100",
        ),
      };
    }
    const tabs = await bounded(
      worker.evaluate(
        async (origin) =>
          (await chrome.tabs.query({ url: `${origin}/*` })).map((tab) => ({
            id: tab.id,
            windowId: tab.windowId,
            url: tab.url,
            title: tab.title,
          })),
        options.url.origin,
      ),
      8000,
      "Exact owned task tab binding",
    );
    const activationBinding = ownedActivationBinding(tabs, options.url.href, title);
    assert.equal(
      activationBinding.tabId,
      authority.tabId,
      "Activation and zoom must share the same owned task tab",
    );
    proof.activationBinding = activationBinding;
    await windowPreflight(page, worker, activationBinding, "before-baseline", proof, true);
    proof.baseline = await metrics(page, session);
    if (mode === "native200") {
      if (worker)
        authority.afterZoom = await bounded(
          worker.evaluate(async (tabId) => {
            await chrome.tabs.setZoom(tabId, 2);
            return chrome.tabs.getZoom(tabId);
          }, authority.tabId),
          8000,
          "Native automatic zoom200",
        );
      else {
        const response = await control.wait("WAITING_NATIVE_ZOOM_200", {
          title,
          url: options.url.href,
          evidenceDirectory: directory,
        });
        authority.afterZoom = 2;
        authority.menu = nativeMenuEvidence(directory, response, title, 200, "native-menu-200");
      }
      await expect
        .poll(
          async () =>
            (await metrics(page, session)).devicePixelRatio / proof.baseline.devicePixelRatio,
        )
        .toBe(2);
      proof.layout = await metrics(page, session);
      validateNative200(proof.baseline, proof.layout, authority);
    } else {
      await page.setViewportSize({ width: 320, height: 568 });
      proof.layout = await metrics(page, session);
      assert.equal(proof.layout.innerWidth, 320);
      assert.equal(proof.layout.innerHeight, 568);
      assert.equal(proof.layout.devicePixelRatio, proof.baseline.devicePixelRatio);
      assert.equal(proof.layout.visualViewportScale, 1);
      assert.equal(proof.layout.documentWidth, 320);
      proof.layoutClass =
        "320x568 CSS viewport override at native100%; not a native200% zoom claim";
    }
    proof.zoomAuthority = authority;
    await Promise.race([
      widgetChecks(page, proof, directory, control, (stage) =>
        windowPreflight(page, worker, activationBinding, stage, proof),
      ),
      new Promise((_, reject) => {
        deadline = setTimeout(() => {
          workflowTimedOut = true;
          reject(new Error("Bounded widget workflow exceeded 120 seconds"));
        }, 120000);
      }),
    ]);
    clearTimeout(deadline);
    proof.layoutAfterChecks = await metrics(page, session);
    if (mode === "native200") validateNative200(proof.baseline, proof.layoutAfterChecks, authority);
    else {
      assert.equal(proof.layoutAfterChecks.innerWidth, 320);
      assert.equal(proof.layoutAfterChecks.documentWidth, 320);
    }
    assert.deepEqual(proof.errors, []);
    assert.deepEqual(proof.consoleErrors, []);
    assert.deepEqual(proof.blockedRequests, []);
    assert.deepEqual(proof.responses, []);
    proof.reachabilityStatus = "PASS";
    if (mode === "native200") {
      assert.equal(
        proof.nativeLock.acquired,
        true,
        "Strict native200 Pointer Lock condition failed; reachability is separately recorded",
      );
      assert.equal(
        proof.nativeLock.trustedFocusedGesture,
        true,
        "Strict native200 entry lacks an observed trusted focused activation",
      );
    }
    proof.status = "PASS";
  } catch (error) {
    proof.status = "FAIL";
    proof.error = error instanceof Error ? error.stack : String(error);
    if (error?.cleanup) proof.startupCleanup = error.cleanup;
    if (error?.activationEvidence) {
      // A raced timeout cannot cancel an already-issued Chrome API operation.
      // Close this exact owned browser before diagnostics/restoration can race it.
      proof.activationPreflightAborted = true;
      control?.cancel(new Error("Actual native window preflight failed"));
      if (native) await native.close();
    }
    if (workflowTimedOut) {
      // Stop the timed-out workflow before any restoration input can race it.
      control?.cancel(new Error("Native workflow timed out"));
      if (native) await native.close();
    }
    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: path.join(directory, "failure.png"), timeout: 3000 });
        proof.failureText = (await page.locator("body").innerText({ timeout: 3000 })).slice(
          0,
          32768,
        );
      } catch (failure) {
        proof.diagnosticError = String(failure);
      }
    }
  } finally {
    clearTimeout(deadline);
    if (
      native &&
      page &&
      !page.isClosed() &&
      !stop.interrupted &&
      !workflowTimedOut &&
      !proof.activationPreflightAborted
    ) {
      try {
        if (worker && authority)
          proof.restoredZoom = await bounded(
            worker.evaluate(async (tabId) => {
              await chrome.tabs.setZoom(tabId, 1);
              return chrome.tabs.getZoom(tabId);
            }, authority.tabId),
            8000,
            "Native zoom100 restoration",
          );
        else if (mode === "native200" && authority?.afterZoom === 2) {
          const response = await control.wait("WAITING_NATIVE_ZOOM_100", {
            title,
            url: page.url(),
            evidenceDirectory: directory,
          });
          proof.restoredMenu = nativeMenuEvidence(
            directory,
            response,
            title,
            100,
            "native-menu-restored-100",
          );
          proof.restoredZoom = 1;
        } else proof.restoredZoom = 1;
        if (mode === "css320")
          await page.setViewportSize({
            width: proof.baseline.innerWidth,
            height: proof.baseline.innerHeight,
          });
        if (proof.baseline)
          await expect
            .poll(async () => (await metrics(page, session)).devicePixelRatio)
            .toBe(proof.baseline.devicePixelRatio);
        proof.restored = await metrics(page, session);
        assert.equal(proof.restoredZoom, 1);
        assert.equal(proof.restored.innerWidth, proof.baseline.innerWidth);
        assert.equal(proof.restored.visualViewportScale, 1);
        assert.equal(proof.restored.rootZoom, proof.baseline.rootZoom);
        assert.equal(proof.restored.bodyZoom, proof.baseline.bodyZoom);
      } catch (error) {
        proof.status = "FAIL";
        proof.reachabilityStatus = "FAIL";
        proof.restoreError = String(error);
      }
    }
    if (!proof.restored || proof.restoredZoom !== 1 || proof.restoreError) {
      proof.status = "FAIL";
      proof.reachabilityStatus = "FAIL";
      proof.restorationStatus = "NOT_COMPLETED";
    } else proof.restorationStatus = "PASS";
    if (native) {
      proof.cleanup = await native.close();
      if (!proof.cleanup.ownedProcessExited) {
        proof.status = "FAIL";
        proof.reachabilityStatus = "FAIL";
        proof.cleanupFailure = "Owned native process did not exit";
      }
    }
    stop.current = null;
    try {
      proof.frozenAfter = await verifyFrozen(frozen, options.url);
      proof.previewAfter = await ownedPreview(options.url, options.previewPid);
    } catch (error) {
      proof.status = "FAIL";
      proof.reachabilityStatus = "FAIL";
      proof.sourceOrPreviewError = String(error);
    }
    if (
      proof.errors.length ||
      proof.consoleErrors.length ||
      proof.blockedRequests.length ||
      proof.responses.length
    ) {
      proof.status = "FAIL";
      proof.reachabilityStatus = "FAIL";
      proof.unexpectedBrowserErrors = true;
    }
    if (stop.interrupted) {
      proof.status = "FAIL";
      proof.reachabilityStatus = "FAIL";
      proof.interrupted = true;
    }
    proof.finishedAt = new Date().toISOString();
    write(path.join(directory, "verification.json"), proof);
  }
  return proof;
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "base-url": { type: "string" },
      manifest: { type: "string" },
      "preview-pid": { type: "string" },
      strategy: { type: "string", default: "tabs-api" },
      mode: { type: "string", default: "both" },
      "interactive-gesture": { type: "boolean", default: false },
      help: { type: "boolean" },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(
      "node tests/browser/native-accessibility-reachability-v2.mjs --base-url http://127.0.0.1:PORT --manifest FROZEN.json --preview-pid PID --strategy tabs-api [--mode both|native200|css320]\nV2 adds actual owned-window activation and visibility gates. It uses browser-protocol keyboard events, not OS keyboard. No browser is started by --help.\n",
    );
    return;
  }
  assert.ok(
    values["base-url"] && values.manifest && /^\d+$/.test(values["preview-pid"] ?? ""),
    "Explicit frozen URL, manifest and preview owner PID are required",
  );
  const url = new URL(values["base-url"]);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/");
  assert.equal(url.username + url.password + url.search + url.hash, "");
  const previewPid = Number(values["preview-pid"]);
  assert.ok(Number.isSafeInteger(previewPid) && previewPid > 0);
  assert.ok(["tabs-api", "native-menu"].includes(values.strategy));
  assert.ok(["both", "native200", "css320"].includes(values.mode));
  assert.equal(
    values.strategy,
    "tabs-api",
    "V2 is restricted to the allocated tabs-api protocol method",
  );
  assert.equal(values["interactive-gesture"], false, "V2 does not use CUA or OS keyboard");
  for (const [relative, expected] of protectedOriginals)
    assert.equal(
      sha256(fs.readFileSync(insideWorkspace(relative))),
      expected,
      `Protected original script changed: ${relative}`,
    );
  const frozen = loadFrozen(values.manifest);
  const directory = path.join(
    root,
    "artifacts/v1",
    `native-zoom-reachability-v2-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`,
  );
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "frozen-build-manifest.json"), frozen.bytes, {
    flag: "wx",
  });
  const options = { url, previewPid, strategy: values.strategy };
  const stop = { current: null, interrupted: false };
  let control;
  const interrupt = () => {
    stop.interrupted = true;
    control?.cancel(new Error("Native validation interrupted"));
    void stop.current?.close();
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  control =
    values.strategy === "native-menu" || values["interactive-gesture"] ? nativeControl() : null;
  const summary = {
    schemaVersion: 1,
    status: "IN_PROGRESS",
    scope: "New native200 strict and 320CSS reachability receipts; historical failures unchanged",
    runnerVersion: 2,
    gestureMethod: "BROWSER_PROTOCOL_GESTURE",
    notOSKeyboard: true,
    protectedOriginals: protectedOriginals.map(([relative, expected]) => ({
      path: relative,
      sha256: expected,
    })),
    startedAt: new Date().toISOString(),
    platform: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      node: process.version,
    },
    command: [process.execPath, ...process.argv.slice(1)],
    manifestSha256: frozen.sha256,
    inputDigest: frozen.manifest.inputDigest,
    scriptHashes: [
      fileURLToPath(import.meta.url),
      path.join(root, "tests/browser/native-accessibility-window-preflight.mjs"),
      path.join(root, "tests/browser/native-accessibility-window-preflight.test.mjs"),
      path.join(root, "tests/browser/native-accessibility-reachability.mjs"),
      path.join(root, "tests/browser/native-accessibility-external-browser.mjs"),
      path.join(root, "tests/browser/native-accessibility-extension/manifest.json"),
      path.join(
        root,
        "tests/browser/native-accessibility-extension/native-accessibility-zoom-worker.js",
      ),
    ].map((file) => ({ path: path.relative(root, file), sha256: sha256(fs.readFileSync(file)) })),
    cases: [],
    limitations: [
      "No OS IME, screen reader, hearing or overall V1 completion claim.",
      "Only localhost Reflection Lab is navigated; paid/model requests are blocked and would fail the case.",
    ],
  };
  for (const item of summary.scriptHashes) {
    const destination = path.join(directory, "raw-runner-source", item.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, fs.readFileSync(path.join(root, item.path)), { flag: "wx" });
  }
  try {
    const modes = values.mode === "both" ? ["native200", "css320"] : [values.mode];
    for (const mode of modes) {
      if (stop.interrupted || control?.cancelled)
        throw new Error("Validation interrupted; no new native process will be started");
      const proof = await runCase(options, frozen, path.join(directory, mode), mode, control, stop);
      summary.cases.push({
        mode,
        status: proof.status,
        reachabilityStatus: proof.reachabilityStatus,
        nativeLock: proof.nativeLock,
        verification: path.relative(root, path.join(directory, mode, "verification.json")),
        cleanup: proof.cleanup,
      });
    }
    summary.status =
      summary.cases.length === modes.length && summary.cases.every((item) => item.status === "PASS")
        ? "PASS"
        : "FAIL";
  } catch (error) {
    summary.status = "FAIL";
    summary.error = error instanceof Error ? error.stack : String(error);
  } finally {
    control?.close();
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    summary.scriptHashesAfter = summary.scriptHashes.map((item) => ({
      path: item.path,
      sha256: sha256(fs.readFileSync(path.join(root, item.path))),
    }));
    if (JSON.stringify(summary.scriptHashesAfter) !== JSON.stringify(summary.scriptHashes)) {
      summary.status = "FAIL";
      summary.scriptDrift = true;
    }
    if (stop.interrupted) {
      summary.status = "FAIL";
      summary.interrupted = true;
    }
    summary.finishedAt = new Date().toISOString();
    write(path.join(directory, "summary.json"), summary);
  }
  process.stdout.write(
    JSON.stringify({
      status: summary.status,
      output: path.relative(root, directory),
      cases: summary.cases.map((item) => ({
        mode: item.mode,
        status: item.status,
        reachabilityStatus: item.reachabilityStatus,
      })),
    }) + "\n",
  );
  if (summary.status !== "PASS") process.exitCode = 1;
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(String(error.stack ?? error) + "\n");
    process.exitCode = 1;
  });
}
