import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const out = "docs/14-core-pipeline/stages/11-ui-parameters/monitor";
const expectedBundle = process.argv[2];
const run = process.argv[3] || "final";
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
page.setDefaultTimeout(10000);
const results = [],
  errors = [];
let bundle, scriptSha256;
page.on("pageerror", (e) => errors.push(String(e)));
const footer = page.locator("footer.monitor-strip");
const gain = page.getByRole("slider", { name: "Monitor gain", exact: true });
const raw = footer.getByRole("button", { name: "Raw reference", exact: true });
const simulated = footer.getByRole("button", { name: "Simulated", exact: true });
const mute = footer.locator(".monitor-mute");
const buffer = footer.getByRole("combobox", { name: "Audio buffer", exact: true });
const metadata = footer.locator(".monitor-metadata"),
  reverbDetails = footer.locator(".monitor-reverb");
const wet = footer.getByRole("spinbutton", { name: "Reverb wet gain linear", exact: true });
const decay = footer.getByRole("spinbutton", { name: "Synthetic decay time s", exact: true });
async function snapshot() {
  return footer.evaluate((f) => ({
    text: f.innerText,
    controls: [...f.querySelectorAll("input,select,button,summary,output")].map((el) => ({
      tag: el.tagName,
      type: el.getAttribute("type"),
      name: el.getAttribute("aria-label") || el.textContent.trim(),
      value: el.value ?? null,
      checked: el.checked ?? null,
      pressed: el.getAttribute("aria-pressed"),
      step: el.getAttribute("step"),
      min: el.getAttribute("min"),
      max: el.getAttribute("max"),
      ariaInvalid: el.getAttribute("aria-invalid"),
      nativeValid: el.validity?.valid ?? null,
      disabled: el.disabled ?? false,
    })),
    open: [...f.querySelectorAll("details")].filter((el) => el.open).map((el) => el.className),
  }));
}
async function check(id, fn) {
  try {
    const data = await fn();
    results.push({ id, status: "PASS", data: data ?? null });
  } catch (error) {
    results.push({
      id,
      status: "FAIL",
      error: String(error),
      footer: await snapshot().catch(() => null),
    });
    await page
      .screenshot({ path: `${out}/retest-${run}-${id}.png`, fullPage: true })
      .catch(() => {});
  }
  await writeFile(
    `${out}/retest-${run}.json`,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        browser: browser.version(),
        bundle,
        scriptSha256,
        mode: "fresh independent Chrome context; DOM pointer/keyboard only",
        scope:
          "Changed monitor preferences, exclusive disclosures and native wet default/step. Previous39-case evidence retained. No bridge/internal state injection or hearing claim.",
        results,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
}
async function open(which) {
  const target = which === "metadata" ? metadata : reverbDetails;
  if (!(await target.evaluate((el) => el.open))) await target.locator("summary").click();
  await page.waitForFunction((name) => {
    const f = document.querySelector("footer.monitor-strip");
    return (
      f.querySelector(`.monitor-${name}`).open &&
      [...f.querySelectorAll("details")].filter((el) => el.open).length === 1
    );
  }, which);
}
async function set(field, value) {
  await open("reverb");
  await field.fill(String(value));
  await field.press("Enter");
  await page.waitForTimeout(100);
  assert.equal(await field.inputValue(), String(value));
  assert.equal(await field.getAttribute("aria-invalid"), "false");
}
try {
  await page.goto("http://127.0.0.1:4173/");
  await footer.waitFor();
  await page.locator('select[aria-label*="Interface language"]').selectOption("en");
  await footer.getByRole("button", { name: "Enable listening", exact: true }).waitFor();
  bundle = await page.locator('script[type="module"][src]').getAttribute("src");
  if (expectedBundle)
    assert.equal(bundle, expectedBundle, "test must use requested production build");
  scriptSha256 = createHash("sha256")
    .update(await (await page.request.get(new URL(bundle, page.url()).href)).body())
    .digest("hex");
  await writeFile(
    `${out}/retest-${run}-inventory.json`,
    JSON.stringify(await snapshot(), null, 2) + "\n",
  );
  await check("initial-defaults", async () => {
    assert.equal(await gain.inputValue(), "0");
    assert.equal(await buffer.inputValue(), "playback");
    assert.equal(await simulated.getAttribute("aria-pressed"), "true");
    assert.equal(await mute.getAttribute("aria-pressed"), "true");
    await open("reverb");
    assert.equal(await wet.inputValue(), "0.12");
    assert.equal(await wet.getAttribute("step"), "0.01");
    assert.equal(await wet.evaluate((el) => el.validity.valid), true);
    assert.equal(await decay.inputValue(), "1.2");
    return snapshot();
  });
  await check("pre-enable-gain-bounds", async () => {
    await gain.focus();
    await gain.press("End");
    await page.waitForTimeout(100);
    assert.equal(await gain.inputValue(), "12");
    assert.equal(await gain.getAttribute("aria-valuetext"), "+12 dB");
    await gain.press("ArrowRight");
    assert.equal(await gain.inputValue(), "12");
    await gain.press("Home");
    await page.waitForTimeout(100);
    assert.equal(await gain.inputValue(), "-40");
    await gain.press("ArrowLeft");
    assert.equal(await gain.inputValue(), "-40");
    return { value: await gain.inputValue(), label: await gain.getAttribute("aria-valuetext") };
  });
  await check("pre-enable-raw", async () => {
    await raw.click();
    await page.waitForTimeout(100);
    assert.equal(await raw.getAttribute("aria-pressed"), "true");
    assert.equal(await simulated.getAttribute("aria-pressed"), "false");
    assert.equal(
      await footer.getByRole("button", { name: "Enable listening", exact: true }).isVisible(),
      true,
    );
  });
  await check("native-wet-default-step", async () => {
    await open("reverb");
    await wet.click();
    await wet.press("ArrowUp");
    await wet.press("Enter");
    assert.equal(await wet.inputValue(), "0.13");
    assert.equal(await wet.evaluate((el) => el.validity.valid), true);
    await wet.press("ArrowDown");
    await wet.press("Enter");
    assert.equal(await wet.inputValue(), "0.12");
    assert.equal(await wet.evaluate((el) => el.validity.valid), true);
  });
  await check("exclusive-pointer-disclosures", async () => {
    await open("metadata");
    const help = footer.getByRole("button", { name: "About Monitor routing", exact: true });
    await help.hover();
    await page.getByRole("tooltip").waitFor();
    assert.match(await page.getByRole("tooltip").innerText(), /Dry audio/);
    await page.keyboard.press("Escape");
    const bounds = await help.boundingBox();
    assert.ok(bounds);
    const hit = await page.evaluate(
      (p) => document.elementFromPoint(p.x, p.y)?.closest("button")?.getAttribute("aria-label"),
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    );
    assert.equal(hit, "About Monitor routing");
    assert.equal(await reverbDetails.evaluate((el) => el.open), false);
    await page.screenshot({ path: `${out}/retest-${run}-metadata-pointer.png`, fullPage: true });
    await open("reverb");
    assert.equal(await metadata.evaluate((el) => el.open), false);
    await wet.click();
    assert.equal(await wet.evaluate((el) => document.activeElement === el), true);
  });
  await check("exclusive-keyboard-disclosures", async () => {
    await reverbDetails.locator("summary").focus();
    await reverbDetails.locator("summary").press("Enter");
    await page.waitForTimeout(100);
    assert.equal(await reverbDetails.evaluate((el) => el.open), false);
    await metadata.locator("summary").focus();
    await metadata.locator("summary").press("Space");
    await page.waitForTimeout(100);
    assert.equal(await metadata.evaluate((el) => el.open), true);
    await reverbDetails.locator("summary").focus();
    await reverbDetails.locator("summary").press("Space");
    await page.waitForTimeout(100);
    assert.equal(await reverbDetails.evaluate((el) => el.open), true);
    assert.equal(await metadata.evaluate((el) => el.open), false);
  });
  await check("enable-retains-desired-preferences", async () => {
    await footer.getByRole("button", { name: "Enable listening", exact: true }).click();
    await page.waitForTimeout(250);
    assert.equal(await gain.inputValue(), "-40");
    assert.equal(await raw.getAttribute("aria-pressed"), "true");
    assert.equal(await mute.getAttribute("aria-pressed"), "false");
    await mute.click();
    assert.equal(await mute.getAttribute("aria-pressed"), "true");
    return snapshot();
  });
  await check("three-rebuilds-retain-desired", async () => {
    const samples = [];
    for (const [preset, lookahead] of [
      ["interactive", 60],
      ["balanced", 80],
      ["playback", 120],
    ]) {
      await buffer.selectOption(preset);
      await page.waitForTimeout(350);
      assert.equal(await buffer.inputValue(), preset);
      assert.equal(await buffer.isEnabled(), true);
      assert.equal(await gain.inputValue(), "-40");
      assert.equal(await raw.getAttribute("aria-pressed"), "true");
      assert.equal(await mute.getAttribute("aria-pressed"), "true");
      await open("metadata");
      assert.match(await metadata.innerText(), new RegExp(`${lookahead} ms`));
      samples.push({ preset, details: await metadata.innerText() });
    }
    return samples;
  });
  await check("reverb-edit-and-error-after-exclusive-toggle", async () => {
    await set(decay, 0.1);
    await set(decay, 4);
    await set(decay, 1.2);
    await set(wet, 0);
    await set(wet, 1);
    await set(wet, 0.12);
    for (const [field, text] of [
      [wet, "1.1"],
      [decay, "4.1"],
    ]) {
      const prior = await field.inputValue();
      await field.fill(text);
      await field.press("Enter");
      assert.equal(await field.getAttribute("aria-invalid"), "true");
      await field.press("Escape");
      assert.equal(await field.inputValue(), prior);
    }
    await open("metadata");
    await open("reverb");
    assert.equal(await wet.inputValue(), "0.12");
    assert.equal(await decay.inputValue(), "1.2");
  });
  await check("real-tab-reachability", async () => {
    await open("reverb");
    await mute.focus();
    const focused = [];
    for (let index = 0; index < 12; index++) {
      focused.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          return el?.getAttribute("aria-label") || el?.textContent?.trim() || el?.tagName;
        }),
      );
      await page.keyboard.press("Tab");
    }
    for (const name of [
      "Monitor gain",
      "Audio buffer",
      "Simulated",
      "Raw reference",
      "Monitor details",
      "Synthetic late reverb",
      "Enable Synthetic late reverb (perceptual)",
      "Synthetic decay time s",
      "Reverb wet gain linear",
    ])
      assert.ok(focused.includes(name), `${name} must be reachable by native Tab`);
    return focused;
  });
  await check("safe-final-state", async () => {
    if ((await mute.getAttribute("aria-pressed")) !== "true") await mute.click();
    await gain.focus();
    await gain.press("Home");
    await simulated.click();
    await open("reverb");
    await footer
      .getByRole("checkbox", { name: "Enable Synthetic late reverb (perceptual)", exact: true })
      .uncheck();
    assert.equal(await gain.inputValue(), "-40");
    assert.equal(await mute.getAttribute("aria-pressed"), "true");
    await page.screenshot({ path: `${out}/retest-${run}-final.png`, fullPage: true });
    await writeFile(`${out}/retest-${run}-final-aria.txt`, await footer.ariaSnapshot());
    return snapshot();
  });
  console.log(
    JSON.stringify({
      run,
      bundle,
      browser: browser.version(),
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").map((r) => r.id),
      errors,
    }),
  );
  if (results.some((r) => r.status === "FAIL") || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
