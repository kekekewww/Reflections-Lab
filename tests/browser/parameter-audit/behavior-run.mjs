import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
const selected = new Set((process.argv[3] ?? "").split(",").filter(Boolean));
const run = process.argv[2] ?? new Date().toISOString().replace(/[:.]/g, "");
const out = resolve(root, "docs/14-core-pipeline/stages/11-ui-parameters/behavior", run);
await mkdir(out, { recursive: true });
const result = {
  schemaVersion: 1,
  scope: "Real production DOM sound-behavior parameter audit; no runtime bridge",
  run,
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  status: "RUNNING",
  browser: "",
  cases: [],
  inventories: [],
  consoleErrors: [],
  pageErrors: [],
  externalRequests: [],
  sourcePins: {},
};
for (const file of [
  "src/ui/RuleCard.tsx",
  "src/ui/MappingEditor.tsx",
  "src/ui/BindingOverrideEditor.tsx",
  "src/ui/Inspector.tsx",
  "src/ui/mapping-model.ts",
  "src/audio-behavior/profile-registry.ts",
  "schemas/sound-behavior/behavior-document.schema.json",
])
  result.sourcePins[file] = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
result.browser = browser.version();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  acceptDownloads: true,
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("console", (m) => {
  if (m.type() === "error") result.consoleErrors.push(m.text());
});
page.on("pageerror", (e) => result.pageErrors.push(e.message));
await page.route("**/*", async (route) => {
  const u = new URL(route.request().url());
  if (/^https?:$/.test(u.protocol) && u.origin !== "http://127.0.0.1:4173") {
    result.externalRequests.push(u.href);
    return route.abort();
  }
  return route.continue();
});
const inspector = page.locator("aside.inspector");
const card = (id) => page.locator('.behavior-card[aria-label="Sound behavior ' + id + '"]');
const impact = () => card("rule.impact");
const grab = () => card("rule.grab");
const binding = () =>
  page.locator('.binding-override-editor[aria-label="Object overrides for rule.impact"]');
async function fresh() {
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
  await expect(inspector).toBeVisible();
  await expect(impact()).toBeVisible();
}
async function apply(c) {
  const button = c.getByRole("button", { name: "Apply", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveCount(0);
}
async function discard(c) {
  const b = c.getByRole("button", { name: "Discard", exact: true });
  if (await b.count()) await b.click();
}
async function project(name) {
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project", exact: true }).click();
  const d = await promise;
  const p = resolve(out, name + ".project.json");
  await d.saveAs(p);
  return JSON.parse(await readFile(p, "utf8"));
}
function rule(p, id = "rule.impact") {
  return p.soundBehaviors.profiles.flatMap((p) => p.rules).find((r) => r.ruleId === id);
}
async function audit(id, parameter, methods, fn) {
  if (selected.size && !selected.has(id)) return;
  const entry = { id, parameter, methods, status: "RUNNING", startedAt: new Date().toISOString() };
  result.cases.push(entry);
  try {
    entry.observation = await fn();
    entry.status = "PASS";
  } catch (e) {
    entry.status = "FAIL";
    entry.error = e.stack || String(e);
    try {
      await page.screenshot({ path: resolve(out, id + ".png"), fullPage: true });
      entry.screenshot = id + ".png";
    } catch {}
    console.log("FAIL", id, String(e).slice(0, 700));
  }
  entry.finishedAt = new Date().toISOString();
  await writeFile(resolve(out, "receipt.json"), JSON.stringify(result, null, 2) + "\n");
}
async function inventory(label, scope) {
  result.inventories.push({
    label,
    controls: await scope.locator("input,select,button,summary").evaluateAll((ns) =>
      ns.map((n) => ({
        tag: n.tagName,
        type: n.type ?? null,
        label:
          n.getAttribute("aria-label") ||
          n.labels?.[0]?.textContent?.trim() ||
          n.textContent?.trim() ||
          "",
        value: n.value ?? null,
        min: n.min ?? null,
        max: n.max ?? null,
        step: n.step ?? null,
        disabled: n.disabled ?? null,
        visible: !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length),
        options:
          n.tagName === "SELECT"
            ? [...n.options].map((o) => ({
                value: o.value,
                label: o.text,
                disabled: o.disabled,
                title: o.title,
              }))
            : undefined,
      })),
    ),
  });
}

try {
  await fresh();
  await inventory(
    "default ball rules, mappings, overrides",
    inspector.locator(".behavior-rule-group").first(),
  );
  for (const [index, key, lo, hi, mid] of [
    [0, "gainLinear", 0, 4, 0.12735],
    [1, "pitchSemitones", -24, 24, 3.5],
    [2, "cooldownSeconds", 0, 10, 0.12345],
  ]) {
    for (const [suffix, value] of [
      ["minimum", lo],
      ["maximum", hi],
      ["fractional", mid],
    ]) {
      await audit(
        key + "-" + suffix,
        key,
        ["pointer focus", "keyboard fill", "Enter", "explicit Apply", "UI-exported JSON"],
        async () => {
          const f = impact().locator(".number-field input").nth(index);
          await f.click();
          await f.fill(String(value));
          await f.press("Enter");
          await expect(f).toHaveAttribute("aria-invalid", "false");
          await apply(impact());
          const p = await project(key + "-" + suffix);
          assert.equal(rule(p)[key], value);
          return { value, persisted: rule(p)[key] };
        },
      );
    }
    for (const [suffix, value] of [
      ["below", lo - 1],
      ["above", hi + 1],
      ["empty", ""],
    ]) {
      await audit(
        key + "-reject-" + suffix,
        key,
        ["keyboard invalid input", "Apply gate"],
        async () => {
          const f = impact().locator(".number-field input").nth(index);
          await f.fill(String(value));
          await expect(f).toHaveAttribute("aria-invalid", "true");
          await expect(impact().getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
          await discard(impact());
          return { input: value, invalid: true, preservedCommitted: true };
        },
      );
    }
    await audit(key + "-escape", key, ["focus", "keyboard fill", "Escape"], async () => {
      const f = impact().locator(".number-field input").nth(index);
      await f.focus();
      const before = await f.inputValue();
      await f.fill(String(mid + 0.01));
      await f.press("Escape");
      await expect(f).toHaveValue(before);
      await discard(impact());
      return { restored: before };
    });
  }
  await audit(
    "enabled-click-space",
    "rule.enabled",
    ["pointer checkbox", "keyboard Space", "explicit Apply", "UI-exported JSON"],
    async () => {
      const f = impact().locator("header input[type=checkbox]");
      await f.click();
      await apply(impact());
      assert.equal(rule(await project("enabled-off")).enabled, false);
      await f.focus();
      await f.press("Space");
      await apply(impact());
      assert.equal(rule(await project("enabled-on")).enabled, true);
      return { disabledThenReenabled: true };
    },
  );
  await fresh();
  await audit(
    "classification-options",
    "classification",
    ["pointer select", "all four choices", "UI-exported JSON"],
    async () => {
      const select = inspector
        .locator("label.select-field")
        .filter({ has: page.getByText("Classification", { exact: true }) })
        .locator("select");
      const observations = [];
      for (const value of ["physical", "hybrid", "procedural", "creative"]) {
        await select.selectOption(value);
        await expect(select).toHaveValue(value);
        const p = await project("classification-" + value);
        const profile = p.soundBehaviors.profiles.find((x) =>
          x.rules.some((r) => r.ruleId === "rule.impact"),
        );
        assert.equal(profile.presetKind, value);
        observations.push({ value, persisted: profile.presetKind });
      }
      return observations;
    },
  );
  await fresh();
  await audit(
    "trigger-options",
    "rule.trigger",
    ["all enabled options", "explicit Apply", "UI-exported JSON", "unsupported disabled reasons"],
    async () => {
      const select = grab().locator(".select-field select").first();
      const options = await select
        .locator("option")
        .evaluateAll((ns) =>
          ns.map((n) => ({ value: n.value, disabled: n.disabled, title: n.title })),
        );
      const observations = [];
      for (const option of options) {
        if (option.disabled) {
          assert.match(option.title, /zone|bridge/i);
          observations.push({ ...option, status: "UNSUPPORTED_EXPLICIT" });
          continue;
        }
        await select.selectOption(option.value);
        await apply(grab());
        const p = await project("trigger-" + option.value);
        assert.equal(rule(p, "rule.grab").trigger.type, option.value);
        observations.push({ value: option.value, status: "PASS" });
      }
      await select.selectOption("OnGrab");
      await apply(grab());
      return observations;
    },
  );
  await audit(
    "new-rule-add-delete",
    "new behavior trigger / Add / Delete",
    ["pointer select", "Add", "Delete", "UI-exported JSON"],
    async () => {
      const count = await inspector.locator(".behavior-card").count();
      await inspector.getByLabel("New behavior trigger", { exact: true }).selectOption("OnBounce");
      await inspector.getByRole("button", { name: "Add", exact: true }).click();
      await expect(inspector.locator(".behavior-card")).toHaveCount(count + 1);
      const last = inspector.locator(".behavior-card").last();
      await expect(last.locator(".select-field select").first()).toHaveValue("OnBounce");
      await last.getByRole("button", { name: /^Delete behavior / }).click();
      await expect(inspector.locator(".behavior-card")).toHaveCount(count);
      return { countRestored: count };
    },
  );
  await fresh();
  await audit(
    "mapping-input-options",
    "mapping.input",
    ["all seven input metrics", "appropriate trigger", "explicit Apply", "UI-exported JSON"],
    async () => {
      const mapping = impact().locator(".mapping-card").first();
      const select = mapping.getByRole("combobox", { name: "Mapping input metric", exact: true });
      const values = await select.locator("option").evaluateAll((ns) => ns.map((n) => n.value));
      const observations = [];
      for (const value of values) {
        await impact()
          .locator(".select-field select")
          .first()
          .selectOption(
            ["slipSpeedMetresPerSecond", "contactSupportForceNewtons"].includes(value)
              ? "WhileRolling"
              : "OnImpact",
          );
        await select.selectOption(value);
        await apply(impact());
        const p = await project("mapping-input-" + value);
        assert.equal(rule(p).mappings[0].input, value);
        observations.push({ value, trigger: rule(p).trigger.type });
      }
      return observations;
    },
  );
  await fresh();
  await audit(
    "mapping-target-options",
    "mapping.target",
    ["all three output targets", "range edit", "explicit Apply", "UI-exported JSON"],
    async () => {
      const m = impact().locator(".mapping-card").first();
      const observations = [];
      for (const [value, lo, hi] of [
        ["pitchSemitones", -24, 24],
        ["filterCutoffHz", 20, 20000],
        ["gainLinear", 0, 4],
      ]) {
        await m
          .getByRole("combobox", { name: "Mapping output parameter", exact: true })
          .selectOption(value);
        await m
          .getByRole("spinbutton", { name: "Mapping output minimum", exact: true })
          .fill(String(lo));
        await m
          .getByRole("spinbutton", { name: "Mapping output maximum", exact: true })
          .fill(String(hi));
        await apply(impact());
        const p = await project("mapping-target-" + value);
        assert.equal(rule(p).mappings[0].target, value);
        assert.equal(rule(p).mappings[0].outputMin, lo);
        assert.equal(rule(p).mappings[0].outputMax, hi);
        observations.push({ value, lo, hi });
      }
      return observations;
    },
  );
  for (const [name, valid, invalid] of [
    ["Mapping input minimum", 0.125, -1],
    ["Mapping input maximum", 12.125, -1],
    ["Mapping output minimum", 0.125, -1],
    ["Mapping output maximum", 1.125, 5],
    ["Mapping smoothing time in seconds", 0.12345, 1.1],
  ]) {
    await audit(
      "mapping-number-" + name.replaceAll(" ", "-"),
      name,
      ["keyboard fractional input", "Apply", "invalid input gate", "discard"],
      async () => {
        const m = impact().locator(".mapping-card").first();
        const f = m.getByRole("spinbutton", { name, exact: true });
        await f.fill(String(valid));
        await f.press("Enter");
        await apply(impact());
        await f.fill(String(invalid));
        await expect(impact().getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
        await discard(impact());
        return { valid, invalid, rejected: true };
      },
    );
  }
  await audit(
    "mapping-interpolation",
    "mapping.interpolation",
    ["select step/linear", "explicit Apply", "UI-exported JSON"],
    async () => {
      const f = impact().getByRole("combobox", { name: "Mapping interpolation", exact: true });
      for (const v of ["step", "linear"]) {
        await f.selectOption(v);
        await apply(impact());
        assert.equal(rule(await project("interpolation-" + v)).mappings[0].interpolation, v);
      }
      return { both: true };
    },
  );
  await audit(
    "mapping-curve-points",
    "curve points x/y + Add/Remove",
    ["pointer Add", "fractional x/y", "invalid endpoint/order", "Remove", "Apply", "JSON"],
    async () => {
      let m = impact().locator(".mapping-card").first();
      await m.getByRole("button", { name: "Add curve point", exact: true }).click();
      await expect(m.getByRole("spinbutton", { name: "Curve point 3 x", exact: true })).toHaveCount(
        1,
      );
      await m.getByRole("spinbutton", { name: "Curve point 2 x", exact: true }).fill(".375");
      await m.getByRole("spinbutton", { name: "Curve point 2 y", exact: true }).fill(".625");
      await apply(impact());
      let p = await project("curve-fractional");
      assert.deepEqual(rule(p).mappings[0].curve[1], { x: 0.375, y: 0.625 });
      await m.getByRole("spinbutton", { name: "Curve point 1 x", exact: true }).fill(".1");
      await expect(impact().getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
      await discard(impact());
      await m.getByRole("spinbutton", { name: "Curve point 2 y", exact: true }).fill("1.1");
      await expect(impact().getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
      await discard(impact());
      await expect(
        m.getByRole("button", { name: "Remove curve point 1", exact: true }),
      ).toBeDisabled();
      await expect(
        m.getByRole("button", { name: "Remove curve point 3", exact: true }),
      ).toBeDisabled();
      await m.getByRole("button", { name: "Remove curve point 2", exact: true }).click();
      await apply(impact());
      assert.equal(rule(await project("curve-removed")).mappings[0].curve.length, 2);
      return { interiorEdited: true, endpointsProtected: true, invalidRejected: true };
    },
  );
  await audit(
    "mapping-add-remove-uniqueness",
    "Add / Remove mapping / duplicate target gate",
    ["pointer Add until no target", "explicit Apply", "JSON", "Remove"],
    async () => {
      await impact().getByRole("button", { name: "Add parameter mapping", exact: true }).click();
      await impact().getByRole("button", { name: "Add parameter mapping", exact: true }).click();
      await expect(impact().locator(".mapping-card")).toHaveCount(3);
      await expect(
        impact().getByRole("button", { name: "Add parameter mapping", exact: true }),
      ).toBeDisabled();
      const ms = impact().locator(".mapping-card");
      for (let i = 0; i < 3; i++) {
        const options = await ms
          .nth(i)
          .getByRole("combobox", { name: "Mapping output parameter", exact: true })
          .locator("option")
          .evaluateAll((ns) => ns.map((n) => ({ v: n.value, d: n.disabled })));
        assert.equal(options.filter((o) => o.d).length, 2);
      }
      await apply(impact());
      assert.equal(rule(await project("three-mappings")).mappings.length, 3);
      await ms.last().getByRole("button", { name: "Remove mapping", exact: true }).click();
      await apply(impact());
      assert.equal(rule(await project("two-mappings")).mappings.length, 2);
      return { maximumUniqueTargets: 3, removed: true };
    },
  );
  await fresh();
  await audit(
    "object-overrides",
    "override selection, values, Apply, Discard, Clear",
    [
      "details pointer",
      "checkbox pointer/Space",
      "min/max validation",
      "explicit Apply",
      "UI-exported JSON",
    ],
    async () => {
      const b = binding();
      await b.locator("summary").click();
      await b.getByRole("checkbox", { name: "Override Enabled", exact: true }).check();
      await b
        .getByRole("checkbox", { name: "Enabled value for this object", exact: true })
        .uncheck();
      await b.getByRole("checkbox", { name: "Override Volume", exact: true }).check();
      await b.getByRole("spinbutton", { name: "Object Volume linear", exact: true }).fill(".4");
      await b.getByRole("checkbox", { name: "Override Pitch", exact: true }).focus();
      await b.getByRole("checkbox", { name: "Override Pitch", exact: true }).press("Space");
      await b.getByRole("spinbutton", { name: "Object Pitch semitones", exact: true }).fill("7");
      await b.getByRole("button", { name: "Apply object overrides", exact: true }).click();
      await expect(
        b.getByRole("button", { name: "Apply object overrides", exact: true }),
      ).toHaveCount(0);
      const p = await project("binding-applied");
      const bound = p.soundBehaviors.bindings.find((x) => x.objectId === "ball");
      assert.deepEqual(
        bound.overrides.find((x) => x.ruleId === "rule.impact"),
        { ruleId: "rule.impact", enabled: false, gainLinear: 0.4, pitchSemitones: 7 },
      );
      assert.notEqual(rule(p).gainLinear, 0.4);
      await b.getByRole("spinbutton", { name: "Object Volume linear", exact: true }).fill("-1");
      await expect(
        b.getByRole("button", { name: "Apply object overrides", exact: true }),
      ).toBeDisabled();
      await b.getByRole("button", { name: "Discard override draft", exact: true }).click();
      await b.getByRole("button", { name: "Clear saved overrides", exact: true }).click();
      await expect(
        b.getByRole("button", { name: "Clear saved overrides", exact: true }),
      ).toBeDisabled();
      const cleared = await project("binding-cleared");
      assert.equal(
        cleared.soundBehaviors.bindings.find((x) => x.objectId === "ball").overrides.length,
        0,
      );
      return { isolatedBinding: true, invalidRejected: true, cleared: true };
    },
  );
  await fresh();
  await audit(
    "draft-selection-retention",
    "unapplied rule draft and selection",
    ["fill", "select another object", "reselect ball", "Discard"],
    async () => {
      await impact().locator(".number-field input").first().fill(".27123");
      await page
        .locator(".object-row")
        .filter({ has: page.locator('[title="speaker"]') })
        .click();
      await page
        .locator(".object-row")
        .filter({ has: page.locator('[title="ball"]') })
        .click();
      await expect(impact().locator(".number-field input").first()).toHaveValue(".27123");
      await discard(impact());
      return { rawDraftRetained: true };
    },
  );
  await audit(
    "preview-contact-rejection",
    "OnImpact preview without admitted contact",
    ["pointer Preview", "visible refusal"],
    async () => {
      await impact().getByRole("button", { name: "Preview scene acoustics", exact: true }).click();
      await expect(inspector).toContainText("Select a retained real contact event");
      return { refusedWithoutFabricatingContact: true };
    },
  );
  await audit(
    "preview-grab-stop",
    "OnGrab independent preview and Stop",
    ["pointer Preview", "details provenance", "Stop"],
    async () => {
      await grab().getByRole("button", { name: "Preview scene acoustics", exact: true }).click();
      await expect(
        inspector.getByRole("button", { name: "Stop preview", exact: true }),
      ).toBeVisible();
      await expect(
        inspector.getByText("Preview snapshot and provenance", { exact: true }),
      ).toBeVisible();
      await inspector.getByText("Preview snapshot and provenance", { exact: true }).click();
      await expect(inspector).toContainText("rule.grab");
      await inspector.getByRole("button", { name: "Stop preview", exact: true }).click();
      await expect(inspector).toContainText("Scene preview stopped");
      return { previewMetadata: true, stopped: true };
    },
  );
  await fresh();
  await audit(
    "running-authoring-guard",
    "rule/mapping/binding/classification controls",
    ["Run", "disabled guard", "Pause"],
    async () => {
      await page.locator(".transport-actions > button").first().click();
      await expect(impact().locator("header input[type=checkbox]")).toBeDisabled();
      await expect(impact().locator(".select-field select").first()).toBeDisabled();
      await expect(
        impact().getByRole("button", { name: "Add parameter mapping", exact: true }),
      ).toBeDisabled();
      await expect(
        inspector
          .locator("label.select-field")
          .filter({ has: page.getByText("Classification", { exact: true }) })
          .locator("select"),
      ).toBeDisabled();
      await page.locator(".transport-actions > button").first().click();
      await expect(impact().locator(".select-field select").first()).toBeEnabled();
      return { guarded: true, restoredAfterPause: true };
    },
  );
  await fresh();
  await audit(
    "curve-exact-16-cap",
    "16-point curve capacity and disabled 17th insertion",
    [
      "14 pointer Add clicks",
      "Apply",
      "UI export",
      "pointer attempt on disabled Add",
      "unchanged exported curve",
    ],
    async () => {
      const m = impact().locator(".mapping-card").first();
      const add = m.getByRole("button", { name: "Add curve point", exact: true });
      const points = m.getByRole("spinbutton", { name: /^Curve point \d+ x$/ });
      await expect(points).toHaveCount(2);
      for (let n = 2; n < 16; n++) await add.click();
      await expect(points).toHaveCount(16);
      await expect(add).toBeDisabled();
      await apply(impact());
      const before = rule(await project("curve-16-cap")).mappings[0].curve;
      assert.equal(before.length, 16);
      const box = await add.boundingBox();
      assert.ok(box, "disabled Add remains visible");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(points).toHaveCount(16);
      const after = rule(await project("curve-17-attempt")).mappings[0].curve;
      assert.deepEqual(after, before);
      return { maximum: 16, insertion17Blocked: true, exportedCurveUnchanged: true };
    },
  );
  await fresh();
  await audit(
    "curve-two-point-minimum",
    "two-point minimum and protected endpoint deletion",
    ["pointer attempts on both disabled Remove controls", "UI export"],
    async () => {
      const m = impact().locator(".mapping-card").first();
      for (const index of [1, 2]) {
        const button = m.getByRole("button", { name: "Remove curve point " + index, exact: true });
        await expect(button).toBeDisabled();
        const box = await button.boundingBox();
        assert.ok(box);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      assert.equal(rule(await project("curve-minimum-two")).mappings[0].curve.length, 2);
      return { minimum: 2, bothDeletesBlocked: true };
    },
  );
  await audit(
    "caller-help-reachability",
    "all rendered behavior/mapping/override About controls",
    ["expand override disclosures", "focus each caller", "read described-by content", "Escape"],
    async () => {
      for (const details of await inspector.locator(".binding-override-editor details").all()) {
        if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
      }
      const tips = inspector.locator(".behavior-rule-group .help-tip-trigger:visible");
      const observed = [];
      const count = await tips.count();
      assert.ok(count > 0);
      for (let i = 0; i < count; i++) {
        const tip = tips.nth(i);
        await tip.focus();
        const id = await tip.getAttribute("aria-describedby");
        assert.ok(id);
        const bubble = page.locator('[id="' + id + '"]');
        await expect(bubble).toBeVisible();
        const text = (await bubble.textContent()).trim();
        assert.ok(text.length > 0);
        observed.push({ label: await tip.getAttribute("aria-label"), content: text });
        await tip.press("Escape");
        await expect(bubble).toBeHidden();
      }
      const readouts = inspector.locator(
        '.binding-override-table .help-tip-control [tabindex="0"]',
      );
      for (let i = 0; i < (await readouts.count()); i++) {
        const readout = readouts.nth(i);
        await readout.focus();
        const id = await readout.getAttribute("aria-describedby");
        assert.ok(id);
        const bubble = page.locator('[id="' + id + '"]');
        await expect(bubble).toBeVisible();
        const text = (await bubble.textContent()).trim();
        assert.ok(text.length > 0);
        observed.push({ label: "Binding base/effective full precision readout", content: text });
        await readout.press("Escape");
        await expect(bubble).toBeHidden();
      }
      return observed;
    },
  );
  await audit(
    "discard-all-behavior-drafts",
    "Discard all behavior drafts for this project",
    ["rule draft", "binding draft", "pointer global Discard", "UI export unchanged"],
    async () => {
      const before = await project("before-discard-all");
      await impact().locator(".number-field input").first().fill(".271234");
      const b = binding();
      const details = b.locator("details");
      if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
      await b.getByRole("checkbox", { name: "Override Volume", exact: true }).check();
      await b.getByRole("spinbutton", { name: "Object Volume linear", exact: true }).fill(".35");
      await inspector
        .getByRole("button", { name: "Discard all behavior drafts for this project", exact: true })
        .click();
      await expect(impact().getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
      await expect(
        b.getByRole("button", { name: "Apply object overrides", exact: true }),
      ).toHaveCount(0);
      const after = await project("after-discard-all");
      assert.deepEqual(after.soundBehaviors, before.soundBehaviors);
      return { ruleAndBindingDraftsCleared: true, committedDocumentUnchanged: true };
    },
  );
  await page.screenshot({ path: resolve(out, "behavior-final.png"), fullPage: true });
} catch (fatal) {
  result.fatal = fatal.stack || String(fatal);
} finally {
  result.finishedAt = new Date().toISOString();
  result.status = result.fatal || result.cases.some((x) => x.status === "FAIL") ? "FAIL" : "PASS";
  result.summary = {
    passed: result.cases.filter((x) => x.status === "PASS").length,
    failed: result.cases.filter((x) => x.status === "FAIL").length,
  };
  result.limits = [
    "Finite parameter/boundary/input-method matrix, not an exhaustive Cartesian product of all numeric values.",
    "No human hearing, calibrated SPL or formal performance acceptance.",
    "Zone trigger options remain explicitly unsupported; no new producer is fabricated.",
  ];
  await context.tracing.stop({
    path: resolve(root, ".cache", "behavior-parameter-" + run + ".zip"),
  });
  await writeFile(resolve(out, "receipt.json"), JSON.stringify(result, null, 2) + "\n");
  await browser.close();
  console.log(JSON.stringify({ out, status: result.status, ...result.summary }));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
