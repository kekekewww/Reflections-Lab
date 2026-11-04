import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "docs/14-core-pipeline/stages/11-ui-parameters/monitor";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  await page.goto("http://127.0.0.1:4173/");
  await page.locator("footer.monitor-strip").waitFor();
  await page.locator('select[aria-label*="Interface language"]').selectOption("en");
  await page.getByRole("button", { name: "Enable listening", exact: true }).waitFor();
  const slider = page.getByRole("slider", { name: "Monitor gain", exact: true });
  await slider.focus();
  await slider.press("Home");
  const inventory = await page.locator("footer.monitor-strip").evaluate((footer) => ({
    text: footer.innerText,
    controls: [...footer.querySelectorAll("input,select,button,summary,output,a")].map(
      (el, index) => ({
        index,
        tag: el.tagName,
        type: el.getAttribute("type"),
        role: el.getAttribute("role"),
        name:
          el.getAttribute("aria-label") ||
          (el.labels ? [...el.labels].map((label) => label.textContent.trim()).join(" ") : "") ||
          el.textContent.trim(),
        value: el.value ?? null,
        checked: el.checked ?? null,
        pressed: el.getAttribute("aria-pressed"),
        min: el.getAttribute("min"),
        max: el.getAttribute("max"),
        step: el.getAttribute("step"),
        disabled: el.disabled ?? false,
        tabIndex: el.tabIndex,
        reachable: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
        options:
          el.tagName === "SELECT"
            ? [...el.options].map((option) => ({ value: option.value, label: option.label }))
            : undefined,
      }),
    ),
  }));
  await writeFile(
    out + "/inventory-initial.json",
    JSON.stringify(
      {
        browser: browser.version(),
        url: page.url(),
        bundle: await page.locator('script[type="module"][src]').getAttribute("src"),
        viewport: { width: 1600, height: 1100 },
        initialGainAfterSafetyHome: await slider.inputValue(),
        errors,
        ...inventory,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(out + "/initial-aria.txt", await page.locator("body").ariaSnapshot());
  await page.screenshot({ path: out + "/initial.png", fullPage: true });
  await page.locator(".monitor-metadata summary").click();
  await page.locator(".monitor-reverb summary").click();
  await writeFile(
    out + "/expanded-aria.txt",
    await page.locator("footer.monitor-strip").ariaSnapshot(),
  );
  await writeFile(
    out + "/inventory-expanded.json",
    JSON.stringify(
      await page.locator("footer.monitor-strip").evaluate((footer) =>
        [...footer.querySelectorAll("input,select,button,summary,output")].map((el, index) => ({
          index,
          tag: el.tagName,
          type: el.getAttribute("type"),
          name:
            el.getAttribute("aria-label") ||
            (el.labels ? [...el.labels].map((label) => label.textContent.trim()).join(" ") : "") ||
            el.textContent.trim(),
          value: el.value ?? null,
          checked: el.checked ?? null,
          min: el.getAttribute("min"),
          max: el.getAttribute("max"),
          step: el.getAttribute("step"),
          disabled: el.disabled ?? false,
        })),
      ),
      null,
      2,
    ) + "\n",
  );
  await page.screenshot({ path: out + "/expanded.png", fullPage: true });
  console.log(
    JSON.stringify({
      browser: browser.version(),
      count: inventory.controls.length,
      errors,
      output: out,
    }),
  );
} finally {
  await browser.close();
}
