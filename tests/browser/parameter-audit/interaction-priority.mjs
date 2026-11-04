import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const out = path.resolve("docs/14-core-pipeline/stages/11-ui-parameters/interaction");
const cache = path.resolve(".cache/parameter-audit/interaction");
await mkdir(out, { recursive: true });
await mkdir(cache, { recursive: true });
const r = {
  kind: "PRIORITY_HELD_PLACEMENT_BROWSER_AUDIT",
  startedAtUtc: new Date().toISOString(),
  method: "Production DOM via Chrome. No runtime bridge or API overrides.",
  status: "RUNNING",
  checks: [],
  consoleErrors: [],
};
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
process.on("SIGTERM", async () => {
  await browser.close();
  process.exit(143);
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  acceptDownloads: true,
});
const button = (n) => page.getByRole("button", { name: n, exact: true });
page.on("pageerror", (e) => r.consoleErrors.push(String(e)));
try {
  await page.goto("http://127.0.0.1:4173/");
  await page
    .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
    .selectOption("en");
  r.browser = browser.version();
  r.bundle = await page.locator("script[src]").evaluateAll((nodes) => nodes.map((n) => n.src));
  const dlp = page.waitForEvent("download");
  await button("Export project").click();
  const dl = await dlp;
  await dl.saveAs(path.join(cache, "priority-baseline.json"));
  const project = JSON.parse(await readFile(path.join(cache, "priority-baseline.json"), "utf8"));
  project.name = "Held UI audit";
  const ball = project.scene.objects.find((o) => o.id === "ball");
  ball.positionM = [0, 1.6, 1.5];
  ball.mode = "dynamicNoGravity";
  await button("Import project JSON").click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("input[type=file]").setInputFiles({
    name: "held.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await dlg.getByRole("button", { name: "Apply and open project", exact: true }).click();
  await expect(dlg).not.toBeVisible();
  await button("Enter first person").click();
  await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);
  await expect(page.locator(".run-status")).toContainText("Running");
  await page.keyboard.press("e");
  await expect(
    page
      .getByRole("list", { name: "Scene object list" })
      .getByRole("button", { name: "ball Held", exact: true }),
  ).toBeVisible();
  r.checks.push({
    id: "native-lock-and-grab",
    status: "PASS",
    nativeLock: await page.evaluate(() => Boolean(document.pointerLockElement)),
  });
  const disabled = await button("Place").isDisabled();
  r.checks.push({
    id: "held-gentle-place-accessible-control",
    status: disabled ? "FAIL" : "PASS",
    disabled,
    expected:
      "While Running and Holding, the accessible placement control should dispatch the bounded gentlePlace path, matching the G key.",
  });
  await writeFile(
    path.join(out, "priority-held-initial-aria.txt"),
    await page.locator("body").ariaSnapshot(),
  );
  await page.screenshot({ path: path.join(out, "priority-held-initial.png"), fullPage: true });
  await page.keyboard.press("g");
  await page.waitForTimeout(700);
  r.checks.push({
    id: "keyboard-g-outcome",
    status: "OBSERVED",
    heldAfterG: await page
      .getByRole("list", { name: "Scene object list" })
      .getByRole("button", { name: "ball Held", exact: true })
      .count(),
    statusText: await page.locator(".status-banner").allTextContents(),
  });
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(false);
  await expect(page.locator(".run-status")).toContainText("Paused");
  r.checks.push({ id: "tab-exits-native-lock-pauses", status: "PASS" });
  await writeFile(
    path.join(out, "priority-held-after-g-aria.txt"),
    await page.locator("body").ariaSnapshot(),
  );
} catch (e) {
  r.error = String(e);
  await page
    .screenshot({ path: path.join(out, "priority-fatal.png"), fullPage: true })
    .catch(() => {});
  await writeFile(
    path.join(out, "priority-fatal-aria.txt"),
    await page.locator("body").ariaSnapshot(),
  ).catch(() => {});
} finally {
  await browser.close();
}
r.source = [];
for (const p of [
  "src/ui/Viewport.tsx",
  "src/interaction/interaction-host.ts",
  "src/app/runtime.ts",
  "docs/05-ux/FPS_INTERACTION_UX.md",
  "docs/04-physics/INPUT_CONTROLS.md",
]) {
  r.source.push({
    path: p,
    sha256: createHash("sha256")
      .update(await readFile(p))
      .digest("hex"),
  });
}
r.finishedAtUtc = new Date().toISOString();
r.status = r.error || r.checks.some((c) => c.status === "FAIL") ? "FAIL" : "PASS";
await writeFile(path.join(out, "priority-held-initial.json"), JSON.stringify(r, null, 2) + "\n");
console.log(JSON.stringify(r, null, 2));
process.exitCode = r.status === "PASS" ? 0 : 1;
