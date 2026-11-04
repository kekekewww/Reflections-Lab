import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
const root = process.cwd();
const out = path.resolve(process.argv[2] || "docs/14-core-pipeline/stages/05-motion-form-browser");
await mkdir(out, { recursive: true });
const files = [
  "src/ui/MotionPanel.tsx",
  "src/ui/components.tsx",
  "src/ui/motion-form.test.ts",
  "src/motion/workspace.ts",
  "tests/browser/motion-form/fixture.tsx",
];
const source = await Promise.all(
  files.map(async (file) => ({
    path: file,
    sha256: createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  })),
);
const summary = {
  kind: "MOTION_FORM_BROWSER_REGRESSION",
  recordedAt: new Date().toISOString(),
  observer:
    "Playwright real Chromium headless; actual React MotionPanel and real Rapier MotionWorkspace",
  source,
  browser: null,
  checks: [],
  consoleErrors: [],
  status: "RUNNING",
};
const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  cacheDir: path.join(root, ".cache/vite-motion-form"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 5197, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  summary.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  page.on("pageerror", (error) => summary.consoleErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") summary.consoleErrors.push(message.text());
  });
  await page.goto("http://127.0.0.1:5197/tests/browser/motion-form/fixture.html");
  const id = page.getByRole("textbox", { name: "Action ID", exact: true });
  await page.waitForFunction(
    () => document.querySelector("input[pattern]")?.value === "motion.ball",
  );
  assert.equal(await page.locator("form").evaluate((form) => form.checkValidity()), true);
  assert.equal(
    await page.getByRole("spinbutton", { name: "X", exact: true }).inputValue(),
    "0.35791234618",
  );
  summary.checks.push(
    "default finite values and fractional selected pose satisfy native HTML validity",
  );
  await page.getByRole("button", { name: "Save action", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__motionFormSmoke.probes.saves === 1 &&
      window.__motionFormSmoke.snapshot.document.actions.length === 1,
  );
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForFunction(
    () => window.__motionFormSmoke.snapshot.runs.at(-1)?.status === "reached",
  );
  summary.checks.push(
    "Save click reaches real onSave and Run executes real Rapier motion to reached",
  );
  await page.getByRole("button", { name: "Undo motion edit", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__motionFormSmoke.probes.undos === 1 &&
      window.__motionFormSmoke.snapshot.document.actions.length === 0,
  );
  summary.checks.push("Undo restores the previous real motion registry revision");
  const speed = page.getByRole("spinbutton", { name: "Maximum speed m/s", exact: true });
  await speed.fill("0");
  await id.focus();
  assert.equal(await speed.evaluate((input) => input.validity.rangeUnderflow), true);
  await page.getByRole("button", { name: "Save action", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__motionFormSmoke.probes.saves), 1);
  summary.checks.push("HTML min remains active and blocks zero speed before onSave");
  await speed.fill("1");
  await id.fill("Bad ID");
  await speed.focus();
  assert.equal(await id.evaluate((input) => input.validity.patternMismatch), true);
  await page.getByRole("button", { name: "Save action", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__motionFormSmoke.probes.saves), 1);
  summary.checks.push("escaped-hyphen HTML v pattern rejects invalid IDs");
  await id.fill("motion.legal-1");
  const x = page.getByRole("spinbutton", { name: "X", exact: true });
  await x.fill("0.1234567890123");
  await id.focus();
  assert.equal(await page.locator("form").evaluate((form) => form.checkValidity()), true);
  await page.getByRole("button", { name: "Save action", exact: true }).click();
  await page.waitForFunction(() => window.__motionFormSmoke.probes.saves === 2);
  assert.equal(
    await page.evaluate(
      () => window.__motionFormSmoke.snapshot.document.actions[0].targetPositionM[0],
    ),
    0.1234567890123,
  );
  summary.checks.push(
    "arbitrary finite fractional target saves without inventing a step-grid restriction",
  );
  await page.screenshot({ path: path.join(out, "motion-form-success.png"), fullPage: true });
  assert.deepEqual(summary.consoleErrors, []);
  summary.status = "PASS";
  await page.evaluate(() => window.__motionFormSmoke.dispose());
} catch (error) {
  summary.status = "FAIL";
  summary.error = String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
}
console.log(
  JSON.stringify({
    status: summary.status,
    browser: summary.browser,
    checks: summary.checks,
    error: summary.error,
  }),
);
