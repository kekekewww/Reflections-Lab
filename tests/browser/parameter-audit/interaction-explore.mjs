import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "docs/14-core-pipeline/stages/11-ui-parameters/interaction";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  acceptDownloads: true,
});
await page.goto("http://127.0.0.1:4173/");
await page
  .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
  .selectOption("en");
await page
  .getByRole("button", { name: "Enter first person", exact: true })
  .waitFor({ state: "visible" });
await writeFile(out + "/initial-aria.txt", await page.locator("body").ariaSnapshot());
await page.screenshot({ path: out + "/initial.png", fullPage: true });
await page.getByRole("button", { name: "Enter first person", exact: true }).click();
await page.waitForTimeout(400);
await writeFile(out + "/fps-aria.txt", await page.locator("body").ariaSnapshot());
await page.screenshot({ path: out + "/fps.png", fullPage: true });
console.log(
  JSON.stringify({
    browser: browser.version(),
    pointerLock: await page.evaluate(() => Boolean(document.pointerLockElement)),
  }),
);
await browser.close();
