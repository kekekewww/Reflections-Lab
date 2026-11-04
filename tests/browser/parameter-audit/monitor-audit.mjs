import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "docs/14-core-pipeline/stages/11-ui-parameters/monitor";
const run = process.argv[2] || "baseline";
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
const results = [],
  errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
let bundle;
async function sample() {
  return page.locator("footer.monitor-strip").evaluate((footer) => ({
    text: footer.innerText,
    controls: [...footer.querySelectorAll("input,select,button,summary,output")].map((el) => ({
      tag: el.tagName,
      type: el.getAttribute("type"),
      name:
        el.getAttribute("aria-label") ||
        (el.labels ? [...el.labels].map((label) => label.textContent.trim()).join(" ") : "") ||
        el.textContent.trim(),
      value: el.value ?? null,
      checked: el.checked ?? null,
      pressed: el.getAttribute("aria-pressed"),
      disabled: el.disabled ?? false,
      min: el.getAttribute("min"),
      max: el.getAttribute("max"),
      step: el.getAttribute("step"),
      ariaInvalid: el.getAttribute("aria-invalid"),
      validity: el.validity
        ? {
            valid: el.validity.valid,
            badInput: el.validity.badInput,
            stepMismatch: el.validity.stepMismatch,
            rangeUnderflow: el.validity.rangeUnderflow,
            rangeOverflow: el.validity.rangeOverflow,
          }
        : null,
    })),
  }));
}
async function check(id, body) {
  try {
    const data = await body();
    results.push({ id, status: "PASS", data: data ?? null });
  } catch (error) {
    results.push({
      id,
      status: "FAIL",
      error: String(error),
      footer: await sample().catch(() => null),
    });
    await page.screenshot({ path: `${out}/${run}-${id}.png`, fullPage: true }).catch(() => {});
  }
  await writeFile(
    `${out}/audit-${run}.json`,
    JSON.stringify(
      {
        run,
        browser: browser.version(),
        bundle,
        url: page.url(),
        scope:
          "DOM pointer/keyboard only; no bridge/internal engine mutation; no device or hearing claim",
        results,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
}
const footer = page.locator("footer.monitor-strip");
const gain = page.getByRole("slider", { name: "Monitor gain", exact: true });
const modeRaw = footer.getByRole("button", { name: "Raw reference", exact: true });
const modeSim = footer.getByRole("button", { name: "Simulated", exact: true });
const buffer = footer.getByRole("combobox", { name: "Audio buffer", exact: true });
const mute = footer.locator(".monitor-mute");
const decay = footer.getByRole("spinbutton", { name: "Synthetic decay time s", exact: true });
const wet = footer.getByRole("spinbutton", { name: "Reverb wet gain linear", exact: true });
const reverb = footer.getByRole("checkbox", {
  name: "Enable Synthetic late reverb (perceptual)",
  exact: true,
});
async function openDetails(selector) {
  const details = footer.locator(selector);
  if (!(await details.getAttribute("open")) && !(await details.evaluate((el) => el.open)))
    await details.locator("summary").click();
}
async function commit(field, value) {
  await field.fill(String(value));
  await field.press("Enter");
  await page.waitForTimeout(130);
  assert.equal(await field.getAttribute("aria-invalid"), "false");
  assert.equal(Number(await field.inputValue()), Number(value));
}
async function ensureMuted() {
  if ((await mute.getAttribute("aria-pressed")) !== "true") await mute.click();
  assert.equal(await mute.getAttribute("aria-pressed"), "true");
}
try {
  await page.goto("http://127.0.0.1:4173/");
  await footer.waitFor();
  await page.locator('select[aria-label*="Interface language"]').selectOption("en");
  await page.getByRole("button", { name: "Enable listening", exact: true }).waitFor();
  bundle = await page.locator('script[type="module"][src]').getAttribute("src");
  await writeFile(
    `${out}/audit-${run}-inventory.json`,
    JSON.stringify(await sample(), null, 2) + "\n",
  );
  await check("defaults", async () => {
    assert.equal(await gain.inputValue(), "0");
    assert.equal(await buffer.inputValue(), "playback");
    assert.equal(await modeSim.getAttribute("aria-pressed"), "true");
    assert.equal(await mute.getAttribute("aria-pressed"), "true");
    await openDetails(".monitor-reverb");
    assert.equal(await decay.inputValue(), "1.2");
    assert.equal(await wet.inputValue(), "0.12");
    assert.equal(await reverb.isChecked(), false);
    return sample();
  });
  await check("pre-enable-gain", async () => {
    await gain.focus();
    await gain.press("Home");
    await page.waitForTimeout(180);
    assert.equal(await gain.inputValue(), "-40");
    return { value: await gain.inputValue() };
  });
  await check("pre-enable-raw", async () => {
    await modeRaw.click();
    await page.waitForTimeout(180);
    assert.equal(await modeRaw.getAttribute("aria-pressed"), "true");
    assert.equal(await modeSim.getAttribute("aria-pressed"), "false");
  });
  await check("pre-enable-simulated", async () => {
    await modeSim.focus();
    await modeSim.press("Space");
    await page.waitForTimeout(100);
    assert.equal(await modeSim.getAttribute("aria-pressed"), "true");
  });
  await check("pre-enable-buffer-options", async () => {
    for (const preset of ["interactive", "balanced", "playback"]) {
      await buffer.selectOption(preset);
      await page.waitForTimeout(160);
      assert.equal(await buffer.inputValue(), preset);
    }
    return { value: await buffer.inputValue() };
  });
  await check("metadata-keyboard", async () => {
    const details = footer.locator(".monitor-metadata");
    const summary = details.locator("summary");
    await summary.focus();
    await summary.press("Enter");
    assert.equal(await details.evaluate((el) => el.open), true);
    await summary.press("Enter");
    assert.equal(await details.evaluate((el) => el.open), false);
    await summary.press("Space");
    assert.equal(await details.evaluate((el) => el.open), true);
    return { text: await details.innerText() };
  });
  await check("reverb-default-native-validity", async () => {
    return {
      decay: await decay.evaluate((el) => ({
        valid: el.validity.valid,
        stepMismatch: el.validity.stepMismatch,
      })),
      wet: await wet.evaluate((el) => ({
        valid: el.validity.valid,
        stepMismatch: el.validity.stepMismatch,
      })),
      note: "Native step validity reported separately; domain is continuous finite range.",
    };
  });
  await check("pre-enable-reverb-parameters", async () => {
    await commit(decay, 0.8);
    await commit(wet, 0.2);
    assert.equal(await reverb.isChecked(), false);
  });
  await check("enable-listening-muted-then-keyboard", async () => {
    await page.getByRole("button", { name: "Enable listening", exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal(await mute.innerText(), "Mute monitor");
    await ensureMuted();
    await mute.focus();
    await mute.press("Space");
    assert.equal(await mute.getAttribute("aria-pressed"), "false");
    await mute.press("Enter");
    assert.equal(await mute.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.getByRole("button", { name: "Start simulation", exact: true }).isVisible(),
      true,
    );
    return { text: await mute.innerText() };
  });
  await check("gain-keyboard-bounds", async () => {
    await gain.focus();
    await gain.press("Home");
    assert.equal(await gain.inputValue(), "-40");
    await gain.press("ArrowLeft");
    assert.equal(await gain.inputValue(), "-40");
    await gain.press("ArrowRight");
    assert.equal(await gain.inputValue(), "-39");
    await gain.press("End");
    assert.equal(await gain.inputValue(), "12");
    await gain.press("ArrowRight");
    assert.equal(await gain.inputValue(), "12");
    await gain.press("ArrowLeft");
    assert.equal(await gain.inputValue(), "11");
    await gain.press("Home");
    assert.match(await gain.getAttribute("aria-valuetext"), /-40 dB/);
  });
  await check("gain-pointer", async () => {
    const box = await gain.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + box.width * 0.35, box.y + box.height / 2);
    const v = Number(await gain.inputValue());
    assert.ok(v >= -40 && v <= 12 && v !== -40);
    assert.match(await gain.getAttribute("aria-valuetext"), /dB/);
    await gain.focus();
    await gain.press("Home");
    return { pointerValue: v, restored: await gain.inputValue() };
  });
  await check("gain-invalid-keyboard-ignored", async () => {
    const before = await gain.inputValue();
    await gain.focus();
    await gain.press("a");
    assert.equal(await gain.inputValue(), before);
    return {
      before,
      after: await gain.inputValue(),
      inputType: "range prevents free-text nonfinite entry",
    };
  });
  await check("route-pointer-keyboard", async () => {
    await modeRaw.click();
    assert.equal(await modeRaw.getAttribute("aria-pressed"), "true");
    await modeSim.focus();
    await modeSim.press("Enter");
    assert.equal(await modeSim.getAttribute("aria-pressed"), "true");
    await modeRaw.focus();
    await modeRaw.press("Space");
    assert.equal(await modeRaw.getAttribute("aria-pressed"), "true");
    assert.equal(await modeSim.getAttribute("aria-pressed"), "false");
  });
  await check("raw-help-accessible", async () => {
    await modeRaw.hover();
    await page.getByRole("tooltip").waitFor();
    const text = await page.getByRole("tooltip").innerText();
    assert.match(text, /Centered dry reference/);
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("tooltip").count(), 0);
    return { text };
  });
  await check("buffer-three-presets-restore", async () => {
    const states = [];
    for (const [preset, ms] of [
      ["interactive", 60],
      ["balanced", 80],
      ["playback", 120],
    ]) {
      await buffer.selectOption(preset);
      await page.waitForTimeout(400);
      await buffer.waitFor({ state: "visible" });
      assert.equal(await buffer.isEnabled(), true);
      assert.equal(await buffer.inputValue(), preset);
      assert.equal(await gain.inputValue(), "-40");
      assert.equal(await modeRaw.getAttribute("aria-pressed"), "true");
      assert.equal(await mute.getAttribute("aria-pressed"), "true");
      assert.equal(await decay.inputValue(), "0.8");
      assert.equal(await wet.inputValue(), "0.2");
      assert.match(await footer.locator(".monitor-metadata").innerText(), new RegExp(`${ms} ms`));
      states.push({ preset, text: await footer.locator(".monitor-metadata").innerText() });
    }
    return states;
  });
  await check("buffer-keyboard", async () => {
    await buffer.focus();
    await buffer.press("Home");
    await page.waitForTimeout(400);
    assert.equal(await buffer.inputValue(), "interactive");
    await buffer.press("ArrowDown");
    await page.waitForTimeout(400);
    assert.equal(await buffer.inputValue(), "balanced");
    await buffer.press("End");
    await page.waitForTimeout(400);
    assert.equal(await buffer.inputValue(), "playback");
  });
  await check("late-enable-toggle-pointer-keyboard", async () => {
    await reverb.check();
    assert.equal(await reverb.isChecked(), true);
    await reverb.focus();
    await reverb.press("Space");
    assert.equal(await reverb.isChecked(), false);
    await reverb.press("Space");
    assert.equal(await reverb.isChecked(), true);
  });
  for (const [name, field, min, max, restore] of [
    ["decay", decay, 0.1, 4, 1.2],
    ["wet", wet, 0, 1, 0.12],
  ]) {
    await check(`${name}-valid-bounds`, async () => {
      for (const value of [min, max, restore]) await commit(field, value);
      return { min, max, restored: Number(await field.inputValue()) };
    });
    for (const [label, text] of [
      ["under", String(min - 1)],
      ["over", String(max + 1)],
      ["empty", ""],
      ["nonfinite", "1e309"],
      ["invalid-text", "NaN"],
    ]) {
      await check(`${name}-reject-${label}`, async () => {
        const before = await field.inputValue();
        await field.focus();
        await field.press("ControlOrMeta+A");
        if (text) await field.pressSequentially(text);
        else await field.press("Backspace");
        await field.press("Enter");
        assert.equal(await field.getAttribute("aria-invalid"), "true");
        const message = await field.locator("..").locator(".field-message").innerText();
        assert.match(message, /finite number/);
        await field.press("Escape");
        assert.equal(await field.inputValue(), before);
        assert.equal(await field.getAttribute("aria-invalid"), "false");
        return { input: text, prior: before, message };
      });
    }
    await check(`${name}-escape-without-commit`, async () => {
      const before = await field.inputValue();
      await field.fill(name === "decay" ? "2.5" : "0.5");
      await field.press("Escape");
      assert.equal(await field.inputValue(), before);
    });
    await check(`${name}-blur-commit`, async () => {
      const value = name === "decay" ? "1.7" : "0.3";
      await field.fill(value);
      await footer.locator(".monitor-reverb summary").focus();
      assert.equal(await field.getAttribute("aria-invalid"), "false");
      assert.equal(await field.inputValue(), value);
    });
    await check(`${name}-spinner-keyboard`, async () => {
      await commit(field, name === "decay" ? 0.1 : 0);
      await field.press("ArrowUp");
      await field.press("Enter");
      assert.ok(Number(await field.inputValue()) > min);
      await commit(field, restore);
    });
  }
  await check("late-help-focus", async () => {
    const help = footer.getByRole("button", { name: "About Synthetic late reverb", exact: true });
    await help.focus();
    await page.getByRole("tooltip").waitFor();
    const text = await page.getByRole("tooltip").innerText();
    assert.match(text, /not a measured RT60/);
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("tooltip").count(), 0);
    return { text };
  });
  await check("monitor-routing-help", async () => {
    await modeSim.click();
    const help = footer.getByRole("button", { name: "About Monitor routing", exact: true });
    await help.hover();
    await page.getByRole("tooltip").waitFor();
    const text = await page.getByRole("tooltip").innerText();
    assert.match(text, /unified acoustic chain/);
    await page.keyboard.press("Escape");
    return { text };
  });
  await check("reset-preserves-monitor-preferences", async () => {
    await gain.focus();
    await gain.press("Home");
    await modeRaw.click();
    await buffer.selectOption("balanced");
    await page.waitForTimeout(400);
    await commit(decay, 1.7);
    await commit(wet, 0.3);
    await reverb.check();
    await page
      .locator(".transport-bar")
      .getByRole("button", { name: "Reset", exact: true })
      .click();
    await page.waitForTimeout(250);
    assert.equal(await gain.inputValue(), "-40");
    assert.equal(await modeRaw.getAttribute("aria-pressed"), "true");
    assert.equal(await buffer.inputValue(), "balanced");
    assert.equal(await decay.inputValue(), "1.7");
    assert.equal(await wet.inputValue(), "0.3");
    assert.equal(await reverb.isChecked(), true);
  });
  await check("footer-keyboard-reachability", async () => {
    const audit = [];
    for (const control of [
      mute,
      gain,
      buffer,
      modeRaw,
      modeSim,
      footer.locator(".monitor-metadata summary"),
      footer.locator(".monitor-reverb summary"),
      reverb,
      decay,
      wet,
    ]) {
      await control.focus();
      assert.equal(await control.evaluate((el) => document.activeElement === el), true);
      const b = await control.boundingBox();
      assert.ok(b && b.width > 0 && b.height > 0);
      audit.push({
        name: (await control.getAttribute("aria-label")) || (await control.innerText()),
        bounds: b,
      });
    }
    return audit;
  });
  await ensureMuted();
  await gain.focus();
  await gain.press("Home");
  await reverb.uncheck();
  await writeFile(`${out}/audit-${run}-final-aria.txt`, await footer.ariaSnapshot());
  await page.screenshot({ path: `${out}/audit-${run}-final.png`, fullPage: true });
  console.log(
    JSON.stringify({
      run,
      bundle,
      browser: browser.version(),
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").map((r) => r.id),
      errors,
      output: out,
    }),
  );
  if (results.some((result) => result.status === "FAIL") || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
