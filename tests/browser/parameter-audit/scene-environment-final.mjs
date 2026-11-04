import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
const out = path.resolve(
  "docs/14-core-pipeline/stages/11-ui-parameters/scene/environment-final-a10",
);
await mkdir(out, { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const expected = { medium: "vacuum", temperatureC: 35.5 };
const defaults = {
  medium: "air",
  speedOfSoundMps: 343,
  temperatureC: 20,
  bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
  dataClass: "Synthetic",
};
const receipt = {
  kind: "PRODUCTION_ENVIRONMENT_SAVE_IMPORT_REGRESSION",
  sourceCommit: "a10b7419908ecd88fd26d96dc354ca5659796986",
  observedGitHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  declaredEntry: "index-BmjZ1Zyf.js",
  startedAt: new Date().toISOString(),
  method:
    "Actual production DOM; fresh browser context imports actual UI-exported bytes; no runtime/test bridge",
  status: "RUNNING",
  checks: [],
  artifacts: [],
  assets: [],
  pageErrors: [],
  consoleErrors: [],
};
let browser;
let context;
let page;
let counter = 0;
async function setupPage(ctx) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => receipt.pageErrors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") receipt.consoleErrors.push(m.text());
  });
  p.on("response", async (r) => {
    if (/\/assets\/.*\.(js|css)$/.test(r.url())) {
      try {
        const b = await r.body();
        receipt.assets.push({ url: r.url(), bytes: b.length, sha256: sha(b) });
      } catch {}
    }
  });
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url());
    return ["http:", "https:"].includes(u.protocol) && u.origin !== "http://127.0.0.1:4173"
      ? r.abort("blockedbyclient")
      : r.continue();
  });
  await p.goto("http://127.0.0.1:4173/");
  await p.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
  assert.ok(
    (await p.locator("script[src]").evaluateAll((ns) => ns.map((n) => n.src))).some((s) =>
      s.endsWith(receipt.declaredEntry),
    ),
  );
  return p;
}
async function showListener(p) {
  await p.getByRole("button", { name: /^Listener \/ Environment/ }).click();
  await p
    .getByRole("complementary", { name: "Property inspector" })
    .getByRole("combobox", { name: "Propagation medium", exact: true })
    .waitFor();
}
async function uiEnvironment(p) {
  const i = p.getByRole("complementary", { name: "Property inspector" });
  return {
    medium: await i.getByRole("combobox", { name: "Propagation medium", exact: true }).inputValue(),
    temperatureC: Number(
      await i.getByRole("spinbutton", { name: "Air temperature °C", exact: true }).inputValue(),
    ),
  };
}
async function download(p, label) {
  const [d] = await Promise.all([
    p.waitForEvent("download"),
    p.getByRole("button", { name: "Export project", exact: true }).click(),
  ]);
  const b = await readFile(await d.path());
  counter++;
  const file = label + ".json";
  await writeFile(path.join(out, file), b);
  receipt.artifacts.push({
    path: file,
    bytes: b.length,
    sha256: sha(b),
    origin: "real UI project export download",
  });
  return { project: JSON.parse(b), file: path.join(out, file), bytes: b };
}
async function awaitEnvironment(p, expectedValue) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await p.getByRole("button", { name: /^Listener \/ Environment/ }).click();
    const selector = p
      .getByRole("complementary", { name: "Property inspector" })
      .getByRole("combobox", { name: "Propagation medium", exact: true });
    if (await selector.count()) {
      const value = await uiEnvironment(p);
      if (
        value.medium === expectedValue.medium &&
        value.temperatureC === expectedValue.temperatureC
      )
        return;
    }
    await p.waitForTimeout(200);
  }
  assert.deepEqual(await uiEnvironment(p), expectedValue);
}
async function importFile(p, file) {
  await p.getByRole("button", { name: "Import project JSON", exact: true }).click();
  const dialog = p.getByRole("dialog", { name: "Import project JSON", exact: true });
  await dialog.locator("input[type=file]").setInputFiles(file);
  await dialog.getByRole("button", { name: "Apply and open project", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}
try {
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  receipt.browser = browser.version();
  context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    acceptDownloads: true,
  });
  page = await setupPage(context);
  await showListener(page);
  const i = page.getByRole("complementary", { name: "Property inspector" });
  await i.getByRole("spinbutton", { name: "Air temperature °C", exact: true }).fill("35.5");
  await i.getByRole("spinbutton", { name: "Air temperature °C", exact: true }).press("Enter");
  await expect
    .poll(
      async () =>
        await i.locator(".readout-line").filter({ hasText: "Speed of sound" }).innerText(),
      { timeout: 20000 },
    )
    .toContain("352.19");
  await expect
    .poll(async () => await page.getByRole("contentinfo").innerText(), { timeout: 20000 })
    .not.toContain("Acoustic update pending");
  await i.getByRole("combobox", { name: "Propagation medium", exact: true }).selectOption("vacuum");
  await expect
    .poll(async () => await page.getByRole("contentinfo").innerText(), { timeout: 20000 })
    .not.toContain("Acoustic update pending");
  await expect.poll(() => uiEnvironment(page)).toEqual(expected);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  // Save completion is verified by actual reload/Load, not a notice hidden by an existing pause reason.
  await page.waitForTimeout(100);
  const saved = await download(page, "saved-vacuum-35.5");
  assert.equal(saved.project.atmosphere.medium, "vacuum");
  assert.equal(saved.project.atmosphere.temperatureC, 35.5);
  receipt.checks.push({
    id: "save-and-export-atmosphere",
    status: "PASS",
    atmosphere: saved.project.atmosphere,
  });
  await page.reload();
  await page.getByRole("button", { name: "Load locally saved project", exact: true }).click();
  await awaitEnvironment(page, expected);
  const loaded = await download(page, "after-reload-load");
  assert.deepEqual(loaded.project.atmosphere, saved.project.atmosphere);
  receipt.checks.push({
    id: "reload-load-preserves-environment",
    status: "PASS",
    ui: await uiEnvironment(page),
  });
  await page.screenshot({ path: path.join(out, "reload-load.png"), fullPage: true });
  await context.close();
  context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    acceptDownloads: true,
  });
  page = await setupPage(context);
  await importFile(page, saved.file);
  await showListener(page);
  await expect.poll(() => uiEnvironment(page)).toEqual(expected);
  const fresh = await download(page, "fresh-context-import");
  assert.deepEqual(fresh.project.atmosphere, saved.project.atmosphere);
  receipt.checks.push({
    id: "fresh-context-import-carries-environment",
    status: "PASS",
    ui: await uiEnvironment(page),
  });
  await page.screenshot({ path: path.join(out, "fresh-context-import.png"), fullPage: true });
  const legacy = JSON.parse(saved.bytes);
  delete legacy.atmosphere;
  const legacyBytes = Buffer.from(JSON.stringify(legacy));
  const legacyFile = path.join(out, "legacy-without-atmosphere.json");
  await writeFile(legacyFile, legacyBytes);
  receipt.artifacts.push({
    path: "legacy-without-atmosphere.json",
    bytes: legacyBytes.length,
    sha256: sha(legacyBytes),
    origin:
      "same actual UI-exported project with only optional atmosphere omitted for backwards compatibility case",
  });
  await importFile(page, legacyFile);
  await showListener(page);
  await expect.poll(() => uiEnvironment(page)).toEqual({ medium: "air", temperatureC: 20 });
  const legacyLoaded = await download(page, "legacy-loaded-export");
  assert.deepEqual(
    legacyLoaded.project.atmosphere,
    defaults,
    "legacy defaults must be exact and not leak prior vacuum project",
  );
  receipt.checks.push({
    id: "legacy-import-defaults-exact-and-no-cross-project-leak",
    status: "PASS",
    atmosphere: legacyLoaded.project.atmosphere,
  });
  await page.screenshot({ path: path.join(out, "legacy-defaults.png"), fullPage: true });
  assert.equal(receipt.pageErrors.length, 0);
  assert.equal(receipt.consoleErrors.length, 0);
  receipt.status = "PASS";
} catch (e) {
  receipt.status = "FAIL";
  receipt.failure = String(e.stack || e);
  if (page)
    await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
} finally {
  receipt.finishedAt = new Date().toISOString();
  receipt.projectDownloads = counter;
  await context?.close().catch(() => {});
  await browser?.close();
  await writeFile(path.join(out, "summary.json"), JSON.stringify(receipt, null, 2) + "\n");
}
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      checks: receipt.checks,
      browser: receipt.browser,
      failure: receipt.failure,
      out,
    },
    null,
    2,
  ),
);
process.exitCode = receipt.status === "PASS" ? 0 : 1;
