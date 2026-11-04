import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const out = "docs/14-core-pipeline/stages/11-ui-parameters/scene";
await mkdir(out, { recursive: true });
const receipt = {
  kind: "PRODUCTION_ENVIRONMENT_PERSISTENCE_PROBE",
  startedAt: new Date().toISOString(),
  sourceCommit: process.env.SCENE_AUDIT_SOURCE_COMMIT || "19db9f966d0c34b266243fb1c90a961feb3dcdd5",
  observedGitHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  servedSourcePinAuthority:
    "Root declared stable production preview, not rebuilt during exclusive browser lease",
  method: "Visible production UI only; Save, Export download, page reload and Load saved project",
  expected: { medium: "vacuum", temperatureC: 35.5 },
  status: "RUNNING",
  errors: [],
};
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
receipt.browser = browser.version();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  acceptDownloads: true,
});
page.on("pageerror", (e) => receipt.errors.push(e.message));
await page.route("**/*", (r) => {
  const u = new URL(r.request().url());
  return ["http:", "https:"].includes(u.protocol) && u.origin !== "http://127.0.0.1:4173"
    ? r.abort("blockedbyclient")
    : r.continue();
});
try {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
  await page.getByRole("button", { name: /^Listener \/ Environment/ }).click();
  const inspector = page.getByRole("complementary", { name: "Property inspector" });
  const medium = inspector.getByRole("combobox", { name: "Propagation medium", exact: true });
  const temp = inspector.getByRole("spinbutton", { name: "Air temperature °C", exact: true });
  await temp.fill("35.5");
  await temp.press("Enter");
  await page.waitForTimeout(100);
  await medium.selectOption("vacuum");
  assert.equal(await temp.isDisabled(), true);
  receipt.beforeSave = {
    medium: await medium.inputValue(),
    temperatureC: Number(await temp.inputValue()),
  };
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /saved/i })
    .first()
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export project", exact: true }).click(),
  ]);
  const b = await readFile(await download.path());
  await writeFile(out + "/environment-saved-project.json", b);
  receipt.project = {
    keys: Object.keys(JSON.parse(b)),
    sha256: createHash("sha256").update(b).digest("hex"),
    bytes: b.length,
  };
  await page.reload();
  await page.getByRole("button", { name: "Load locally saved project", exact: true }).click();
  await page.getByRole("button", { name: /^Listener \/ Environment/ }).click();
  const i = page.getByRole("complementary", { name: "Property inspector" });
  receipt.afterReload = {
    medium: await i.getByRole("combobox", { name: "Propagation medium", exact: true }).inputValue(),
    temperatureC: Number(
      await i.getByRole("spinbutton", { name: "Air temperature °C", exact: true }).inputValue(),
    ),
  };
  await page.screenshot({ path: out + "/environment-persistence.png", fullPage: true });
  receipt.bundle = await page.locator("script[src]").evaluateAll((ns) => ns.map((n) => n.src));
  assert.deepEqual(
    receipt.afterReload,
    receipt.expected,
    "Save/reload/Load must retain authored environment settings",
  );
  receipt.status = "PASS";
} catch (e) {
  receipt.status = "FAIL";
  receipt.failure = String(e.stack || e);
} finally {
  receipt.finishedAt = new Date().toISOString();
  await writeFile(out + "/environment-probe.json", JSON.stringify(receipt, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify(receipt, null, 2));
process.exitCode = receipt.status === "PASS" ? 0 : 1;
