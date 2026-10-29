import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { launchExternalNativeBrowser } from "./native-accessibility-external-browser.mjs";

export const outputDirectory = path.resolve("test-results/native-accessibility");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readMetrics = (page) =>
  page.evaluate(() => ({
    url: location.href,
    innerWidth,
    innerHeight,
    outerWidth,
    outerHeight,
    devicePixelRatio,
    visualViewportScale: visualViewport?.scale ?? null,
    screenWidth: screen.width,
    screenHeight: screen.height,
    documentWidth: document.documentElement.scrollWidth,
    cssRootZoom: getComputedStyle(document.documentElement).zoom,
    cssBodyZoom: getComputedStyle(document.body).zoom,
    bodyTransform: getComputedStyle(document.body).transform,
  }));
async function verifyServedBundle(baseURL, manifestPath) {
  const origin = new URL(baseURL);
  assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname));
  const bytes = fs.readFileSync(manifestPath),
    manifest = JSON.parse(bytes);
  const modeIndex = Array.isArray(manifest.command) ? manifest.command.indexOf("--mode") : -1;
  assert.ok(
    manifest.mode === "e2e" || (modeIndex >= 0 && manifest.command[modeIndex + 1] === "e2e"),
    "Require an explicitly e2e frozen build",
  );
  if (manifest.exitCode !== undefined) assert.equal(manifest.exitCode, 0);
  assert.equal(manifest.sourceStableDuringBuild, true);
  assert.ok(Array.isArray(manifest.bundle) && manifest.bundle.length > 0);
  const index = manifest.bundle.find((entry) => entry.path.endsWith("/index.html"));
  assert.ok(index, "Frozen bundle must contain index.html");
  const directory = path.posix.dirname(index.path),
    verified = [];
  for (const entry of manifest.bundle) {
    const relative = path.posix.relative(directory, entry.path);
    assert.ok(relative && !relative.startsWith("../") && !path.isAbsolute(relative));
    const response = await fetch(new URL(relative, origin));
    assert.ok(response.ok, `Frozen asset unavailable: ${relative}`);
    const actual = sha256(Buffer.from(await response.arrayBuffer()));
    assert.equal(actual, entry.sha256, `Served bundle differs: ${relative}`);
    verified.push({ path: relative, sha256: actual });
  }
  return {
    path: manifestPath,
    sha256: sha256(bytes),
    inputDigest: manifest.inputDigest,
    verified,
    bytes,
  };
}
async function tabTo(page, target) {
  await page.evaluate(() => {
    const previous = document.body.getAttribute("tabindex");
    document.body.tabIndex = -1;
    document.body.focus();
    if (previous === null) document.body.removeAttribute("tabindex");
    else document.body.setAttribute("tabindex", previous);
  });
  const trace = [];
  for (let index = 0; index < 160; index++) {
    await page.keyboard.press("Tab");
    trace.push(
      await page.evaluate(() => {
        const element = document.activeElement;
        return {
          tag: element?.tagName,
          role: element?.getAttribute("role"),
          label: element?.getAttribute("aria-label"),
          text: element?.textContent?.slice(0, 100),
        };
      }),
    );
    if (await target.evaluate((element) => element === document.activeElement)) return trace;
  }
  throw new Error(`Target not reached by160 Tab presses: ${JSON.stringify(trace)}`);
}

/** Launches only the already-installed Chrome in a new task-specific profile. */
export async function launchNativeAccessibility(baseURL, bundleManifest, strategy = "native-menu") {
  assert.ok(["native-menu", "chrome-tabs-automatic"].includes(strategy));
  const automatic = strategy === "chrome-tabs-automatic";
  const runDirectory = path.join(outputDirectory, new Date().toISOString().replaceAll(":", "-"));
  fs.mkdirSync(runDirectory, { recursive: true });
  const bundle = await verifyServedBundle(baseURL, bundleManifest);
  fs.writeFileSync(path.join(runDirectory, "frozen-build-manifest.json"), bundle.bytes);
  delete bundle.bytes;
  const profile = path.resolve(`.cache/v1/native-accessibility-${Date.now()}`);
  const extension = path.resolve("tests/browser/native-accessibility-extension");
  const native = await launchExternalNativeBrowser({
    profile,
    ...(automatic
      ? { extension }
      : { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" }),
  });
  const context = native.context;
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const errors = [],
      consoleErrors = [],
      failedResponses = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error")
        consoleErrors.push({ text: message.text(), location: message.location() });
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        failedResponses.push({ url: response.url(), status: response.status() });
    });
    await page.goto(baseURL);
    await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    await page.evaluate(() => {
      document.title = "Reflection Lab Native Accessibility Test";
    });
    const session = await context.newCDPSession(page);
    const windowInfo = await session.send("Browser.getWindowForTarget");
    const proof = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      status: "IN_PROGRESS",
      scope: automatic
        ? "Bundled Chromium automatic tab zoom; no viewport/DPR emulation; software-rendered UI only"
        : "Actual headed Chrome native page zoom and keyboard/focus; no hearing or OS IME certification",
      platform: { platform: os.platform(), release: os.release(), arch: os.arch() },
      browserVersion: context.browser()?.version() ?? "unknown",
      process: {
        pid: native.pid,
        executable: native.executable,
        args: native.args,
        noDefaults: true,
      },
      baseURL,
      profile,
      windowInfo,
      strategy,
      headless: false,
      bundle,
      errors,
      consoleErrors,
      failedResponses,
      baseline: null,
      zoom200: null,
      checks: [],
      nativeMenu: null,
      nativeZoomAuthority: null,
      limitations: [
        "Native Windows IME composition and hearing require separate evidence.",
        "Keyboard/focus checks do not establish physics or acoustic numerical correctness.",
      ],
    };
    return { context, page, session, proof, outputDirectory: runDirectory, close: native.close };
  } catch (error) {
    await native.close();
    throw error;
  }
}

/** Call after native Ctrl+0 has been observed in Chrome, before native zoom actions. */
export async function recordNativeBaseline(run) {
  run.proof.baseline = await readMetrics(run.page);
  await run.page.screenshot({ path: path.join(run.outputDirectory, "baseline-page.png") });
  return run.proof.baseline;
}

/** Save Chrome UI evidence, never a fabricated in-page zoom label. */
export function recordNativeZoomMenu(run, accessibilityTree, screenshotURL, nativeWindow) {
  assert.match(
    accessibilityTree,
    /(?:^|[^\d])200\s*%(?:$|[^\d])/,
    "Chrome native accessibility menu must show 200%",
  );
  assert.equal(typeof nativeWindow?.id, "number");
  assert.match(nativeWindow?.title ?? "", /Reflection Lab Native Accessibility Test/);
  assert.match(screenshotURL, /^data:image\/(png|jpeg);base64,/);
  const extension = screenshotURL.startsWith("data:image/png") ? "png" : "jpeg";
  const imagePath = path.join(run.outputDirectory, `chrome-native-zoom-200.${extension}`);
  fs.writeFileSync(
    imagePath,
    Buffer.from(screenshotURL.slice(screenshotURL.indexOf(",") + 1), "base64"),
  );
  fs.writeFileSync(
    path.join(run.outputDirectory, "chrome-native-zoom-menu.txt"),
    accessibilityTree,
  );
  run.proof.nativeMenu = {
    capturedAt: new Date().toISOString(),
    nativeWindow,
    imagePath,
    sha256: sha256(fs.readFileSync(imagePath)),
    textShows200Percent: true,
  };
  run.proof.nativeZoomAuthority = { kind: "ChromeNativeMenu", zoom: 2 };
}

export async function verifyNative200(run) {
  const { page, proof } = run;
  assert.ok(
    proof.baseline && proof.nativeZoomAuthority,
    "Need actual baseline and native Chrome zoom evidence",
  );
  await expect
    .poll(
      async () => (await readMetrics(page)).devicePixelRatio / proof.baseline.devicePixelRatio,
      { timeout: 10_000 },
    )
    .toBe(2);
  const zoom = await readMetrics(page),
    bounds = await run.session.send("Browser.getWindowForTarget");
  assert.ok(
    Math.abs(zoom.devicePixelRatio / proof.baseline.devicePixelRatio - 2) < 1e-6,
    "Native zoom must double DPR from the same OS-scaled baseline",
  );
  assert.equal(zoom.visualViewportScale, 1, "Pinch/page-scale emulation is not native page zoom");
  assert.ok(
    Math.abs(zoom.innerWidth * 2 - proof.baseline.innerWidth) <= 2,
    "Same native window must have half CSS viewport width",
  );
  assert.deepEqual(
    bounds.bounds,
    proof.windowInfo.bounds,
    "Native window bounds must stay constant",
  );
  assert.equal(zoom.screenWidth, proof.baseline.screenWidth);
  assert.equal(zoom.screenHeight, proof.baseline.screenHeight);
  assert.equal(zoom.cssRootZoom, proof.baseline.cssRootZoom);
  assert.equal(zoom.cssBodyZoom, proof.baseline.cssBodyZoom);
  assert.equal(zoom.bodyTransform, "none");
  proof.zoom200 = zoom;
  await expect(page.locator(".monitor-mute")).toBeInViewport({ ratio: 1 });
  const monitorTabs = await tabTo(page, page.locator(".monitor-mute"));
  await expect(page.locator(".monitor-mute")).toBeFocused();
  proof.checks.push({ id: "native200-monitor-tab", status: "PASS", focusTrace: monitorTabs });
  await page.getByRole("button", { name: "開始運算", exact: true }).click();
  const pause = page
    .locator(".transport-actions")
    .getByRole("button", { name: "暫停", exact: true });
  await expect(pause).toBeInViewport({ ratio: 1 });
  const pauseTabs = await tabTo(page, pause);
  await expect(pause).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "繼續運算", exact: true })).toBeVisible();
  proof.checks.push({ id: "native200-pause-keyboard", status: "PASS", focusTrace: pauseTabs });
  const projectImport = page.getByRole("button", { name: "匯入專案 JSON", exact: true });
  await projectImport.scrollIntoViewIfNeeded();
  const importTabs = await tabTo(page, projectImport);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "匯入專案 JSON", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(projectImport).toBeFocused();
  proof.checks.push({
    id: "native200-dialog-escape-focus-return",
    status: "PASS",
    focusTrace: importTabs,
  });
  const panes = page.getByRole("navigation", { name: "主要面板", exact: true });
  if (await panes.isVisible())
    await panes.getByRole("button", { name: "場景", exact: true }).click();
  await page.getByRole("button", { name: /Listener \/ 環境/ }).click();
  await page.getByRole("combobox", { name: "傳播介質", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("combobox", { name: "傳播介質", exact: true })).toBeInViewport({
    ratio: 1,
  });
  const formTabs = await tabTo(page, page.getByRole("combobox", { name: "傳播介質", exact: true }));
  await expect(page.getByRole("combobox", { name: "傳播介質", exact: true })).toBeFocused();
  proof.checks.push({ id: "native200-form-reachable", status: "PASS", focusTrace: formTabs });
  if (await panes.isVisible())
    await panes.getByRole("button", { name: "3D 視窗", exact: true }).click();
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  const exit = page.getByRole("button", { name: "離開第一人稱", exact: true });
  await exit.scrollIntoViewIfNeeded();
  await expect(exit).toBeInViewport({ ratio: 1 });
  const exitTabs = await tabTo(page, exit);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "進入第一人稱", exact: true })).toBeVisible();
  proof.checks.push({ id: "native200-fps-exit", status: "PASS", focusTrace: exitTabs });
  proof.zoom200AfterChecks = await readMetrics(page);
  assert.equal(proof.zoom200AfterChecks.devicePixelRatio, proof.zoom200.devicePixelRatio);
  assert.equal(proof.zoom200AfterChecks.innerWidth, proof.zoom200.innerWidth);
  await page.screenshot({ path: path.join(run.outputDirectory, "native200-page.png") });
  assert.deepEqual(proof.errors, []);
  return zoom;
}

export async function finishNativeAccessibility(run) {
  const expected = [
    "native200-monitor-tab",
    "native200-pause-keyboard",
    "native200-dialog-escape-focus-return",
    "native200-form-reachable",
    "native200-fps-exit",
  ].sort();
  assert.deepEqual(
    run.proof.checks.map((check) => check.id).sort(),
    expected,
    "Every native200 criterion must execute exactly once",
  );
  assert.ok(run.proof.zoom200 && run.proof.nativeZoomAuthority && run.proof.baseline);
  if (run.proof.strategy === "native-menu") {
    assert.ok(run.proof.nativeMenu);
    assert.equal(
      sha256(fs.readFileSync(run.proof.nativeMenu.imagePath)),
      run.proof.nativeMenu.sha256,
    );
  } else {
    assert.equal(run.proof.nativeZoomAuthority.kind, "ChromeTabsAutomaticAPI");
    assert.equal(run.proof.nativeZoomAuthority.settings.mode, "automatic");
    assert.equal(run.proof.nativeZoomAuthority.settings.scope, "per-tab");
    assert.equal(run.proof.nativeZoomAuthority.beforeZoom, 1);
    assert.equal(run.proof.nativeZoomAuthority.afterZoom, 2);
    assert.equal(run.proof.nativeZoomAuthority.restoredZoom, 1);
  }
  assert.deepEqual(run.proof.errors, []);
  assert.deepEqual(run.proof.consoleErrors, []);
  assert.ok(run.proof.checks.every((check) => check.status === "PASS"));
  await expect
    .poll(async () => (await readMetrics(run.page)).devicePixelRatio, { timeout: 10_000 })
    .toBe(run.proof.baseline.devicePixelRatio);
  const restored = await readMetrics(run.page);
  assert.ok(
    Math.abs(restored.devicePixelRatio - run.proof.baseline.devicePixelRatio) < 1e-6,
    "Restore native zoom to100% before closing",
  );
  run.proof.restored = restored;
  run.proof.status = "PASS";
  run.proof.finishedAt = new Date().toISOString();
  run.proof.cleanup = await run.close();
  assert.equal(
    run.proof.cleanup.ownedProcessExited,
    true,
    "Owned native browser must exit before PASS",
  );
  fs.writeFileSync(
    path.join(run.outputDirectory, "verification.json"),
    JSON.stringify(run.proof, null, 2) + "\n",
  );
  return {
    status: run.proof.status,
    checks: run.proof.checks.length,
    result: path.join(run.outputDirectory, "verification.json"),
  };
}

export async function failNativeAccessibility(run, error) {
  run.proof.status = "FAIL";
  run.proof.error = error instanceof Error ? error.stack : String(error);
  run.proof.finishedAt = new Date().toISOString();
  try {
    await run.page.screenshot({ path: path.join(run.outputDirectory, "failure-page.png") });
    run.proof.failureMetrics = await readMetrics(run.page);
    run.proof.failureText = await run.page.locator("body").innerText();
  } catch (diagnosticError) {
    run.proof.diagnosticError = String(diagnosticError);
  }
  try {
    run.proof.cleanup = await run.close();
  } catch (closeError) {
    run.proof.closeError = String(closeError);
  }
  fs.writeFileSync(
    path.join(run.outputDirectory, "verification.json"),
    JSON.stringify(run.proof, null, 2) + "\n",
  );
  return { status: run.proof.status, result: path.join(run.outputDirectory, "verification.json") };
}

/** Chrome's native automatic tab zoom, not CDP device-metrics or CSS scaling. */
export async function runAutomaticZoom(baseURL, bundleManifest) {
  const run = await launchNativeAccessibility(baseURL, bundleManifest, "chrome-tabs-automatic");
  try {
    const worker =
      run.context
        .serviceWorkers()
        .find((value) => value.url().endsWith("/native-accessibility-zoom-worker.js")) ??
      (await run.context.waitForEvent("serviceworker", {
        predicate: (value) => value.url().endsWith("/native-accessibility-zoom-worker.js"),
        timeout: 20_000,
      }));
    const authority = await worker.evaluate(async (baseURL) => {
      const origin = new URL(baseURL).origin;
      const tabs = (await chrome.tabs.query({})).filter((tab) => tab.url?.startsWith(`${origin}/`));
      if (tabs.length !== 1 || typeof tabs[0].id !== "number")
        throw new Error("Expected exactly one task tab");
      const tabId = tabs[0].id;
      await chrome.tabs.setZoomSettings(tabId, { mode: "automatic", scope: "per-tab" });
      await chrome.tabs.setZoom(tabId, 1);
      return {
        tabId,
        settings: await chrome.tabs.getZoomSettings(tabId),
        beforeZoom: await chrome.tabs.getZoom(tabId),
      };
    }, baseURL);
    assert.equal(authority.settings.mode, "automatic");
    assert.equal(authority.settings.scope, "per-tab");
    assert.equal(authority.beforeZoom, 1);
    await recordNativeBaseline(run);
    const afterZoom = await worker.evaluate(async (tabId) => {
      await chrome.tabs.setZoom(tabId, 2);
      return chrome.tabs.getZoom(tabId);
    }, authority.tabId);
    assert.equal(afterZoom, 2);
    run.proof.nativeZoomAuthority = {
      kind: "ChromeTabsAutomaticAPI",
      ...authority,
      afterZoom,
      workerURL: worker.url(),
      source: "https://developer.chrome.com/docs/extensions/reference/api/tabs",
    };
    await verifyNative200(run);
    run.proof.nativeZoomAuthority.restoredZoom = await worker.evaluate(async (tabId) => {
      await chrome.tabs.setZoom(tabId, 1);
      return chrome.tabs.getZoom(tabId);
    }, authority.tabId);
    return await finishNativeAccessibility(run);
  } catch (error) {
    const failure = await failNativeAccessibility(run, error);
    return { ...failure, error: error instanceof Error ? error.message : String(error) };
  }
}
