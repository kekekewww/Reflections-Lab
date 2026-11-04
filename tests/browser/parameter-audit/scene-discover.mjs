import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const out = "docs/14-core-pipeline/stages/11-ui-parameters/scene";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://127.0.0.1:4173/");
await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
if (
  (await page
    .getByRole("button", { name: "Inspector", exact: true })
    .getAttribute("aria-pressed")) === "false"
)
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
await page.waitForTimeout(500);
const snap = await page.locator("body").ariaSnapshot();
console.log(snap);
await writeFile(out + "/discovery.txt", snap);
await browser.close();
