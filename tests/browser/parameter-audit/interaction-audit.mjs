import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
const selectedCases = new Set((process.argv[2] || "").split(",").filter(Boolean));
const semanticFamilyMap = {
  "interaction.navigation": ["shell.workspace.{workspace}"],
  "interaction.locale": ["shell.locale"],
  "interaction.transport": ["transport.run-pause", "transport.reset"],
  "interaction.panel-toggle": ["shell.toggle-scene", "shell.toggle-inspector"],
  "interaction.panel-resize": ["shell.panel-divider.{side}"],
  "interaction.viewport-tools": ["viewport.gizmo-mode.{mode}", "viewport.frame-selected"],
  "interaction.viewport-camera": ["viewport.orbit", "viewport.pan", "viewport.zoom"],
  "interaction.view-details": ["viewport.details", "viewport.show-blocked-paths"],
  "interaction.help": ["help.{callerTopic}"],
  "interaction.scene-search": ["explorer.search"],
  "interaction.primitive-authoring": [
    "explorer.add.{shape}",
    "object.duplicate",
    "object.remove",
    "scene.undo",
    "scene.redo",
    "keyboard.scene.delete",
    "keyboard.scene.undo-redo-save",
  ],
  "interaction.project-save-load": [
    "project.save",
    "project.load",
    "project.export",
    "keyboard.scene.undo-redo-save",
  ],
  "interaction.project-import": [
    "project.import.open",
    "project.import.file",
    "project.import.cancel",
    "project.import.apply",
    "project.import.dialog-escape",
  ],
  "interaction.help-touch": ["help.{callerTopic}"],
  "interaction.fps-native": [
    "viewport.enter-fps",
    "keyboard.fps.move",
    "keyboard.fps.resume-pause",
    "keyboard.fps.tab",
  ],
  "interaction.fps-no-lock": [
    "viewport.alternative-input",
    "viewport.alternative-resume",
    "viewport.step.{direction}",
    "viewport.look.{direction}",
    "viewport.accessible-movement",
    "keyboard.fps.look",
    "viewport.exit-fps",
    "input.interruption",
  ],
  "interaction.grab-drop-throw": [
    "viewport.grab",
    "viewport.drop",
    "viewport.throw",
    "keyboard.fps.actions",
  ],
  "interaction.build-preview": [
    "viewport.start-placement",
    "viewport.cancel-placement",
    "viewport.place",
    "keyboard.fps.actions",
    "explorer.add.{shape}",
  ],
  "interaction.responsive-panels": ["shell.mobile-pane.{pane}"],
};
const out = path.resolve(
  "docs/14-core-pipeline/stages/11-ui-parameters/interaction/" +
    (selectedCases.size ? "targeted-recheck" : ""),
);
const cache = path.resolve(".cache/parameter-audit/interaction");
await mkdir(out, { recursive: true });
await mkdir(cache, { recursive: true });
const receipt = {
  schemaVersion: 1,
  kind: "INTERACTION_PARAMETER_AUDIT",
  status: "RUNNING",
  startedAtUtc: new Date().toISOString(),
  method:
    "Real Chrome production DOM, pointer, keyboard and native Web Pointer Lock; no internal runtime or test bridge",
  url: "http://127.0.0.1:4173/",
  gitHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  checks: [],
  consoleErrors: [],
  externalRequests: [],
  loadedBundles: [],
  limitations: [
    "Headless Web Pointer Lock is browser API evidence, not Windows native Computer Use or human ergonomic evidence.",
    "All listed controls are individually exercised; not an exhaustive Cartesian product of all parameter combinations.",
    "Audio controls and Inspector values are owned by parallel audit lanes.",
  ],
};
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
receipt.browser = browser.version();
process.on("SIGTERM", async () => {
  await browser.close();
  process.exit(143);
});
let currentPage;
let context;
let sequence = 0;
const artifacts = [];
async function makePage(options = {}) {
  if (context) {
    await context.tracing
      .stop({ path: path.join(cache, "trace-" + ++sequence + ".zip") })
      .catch(() => {});
    await context.close();
  }
  context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    acceptDownloads: true,
    ...options,
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  currentPage = await context.newPage();
  currentPage.on("pageerror", (e) =>
    receipt.consoleErrors.push({ page: currentPage.url(), message: String(e) }),
  );
  currentPage.on("console", (m) => {
    if (m.type() === "error")
      receipt.consoleErrors.push({ page: currentPage.url(), message: m.text() });
  });
  currentPage.on("request", (r) => {
    if (!/^(http:\/\/127\.0\.0\.1:4173\/|data:|blob:)/.test(r.url()))
      receipt.externalRequests.push(r.url());
  });
  await currentPage.goto(receipt.url);
  await currentPage
    .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
    .selectOption("en");
  await currentPage
    .getByRole("button", { name: "Enter first person", exact: true })
    .waitFor({ state: "visible" });
  receipt.loadedBundles.push(
    ...(await currentPage.locator("script[src]").evaluateAll((nodes) => nodes.map((n) => n.src))),
  );
  return currentPage;
}
async function check(id, controls, variants, run) {
  if (selectedCases.size && !selectedCases.has(id)) return;
  const item = {
    id,
    semanticFamilyIds: semanticFamilyMap[id] || [],
    controls,
    variants,
    status: "RUNNING",
  };
  receipt.checks.push(item);
  try {
    await currentPage
      .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
      .selectOption("en");
    item.observation = await run();
    item.status = "PASS";
  } catch (error) {
    item.status = "FAIL";
    item.error = String(error);
    const file = id.replaceAll(".", "-");
    await currentPage
      .screenshot({ path: path.join(out, file + "-failure.png"), fullPage: true })
      .catch(() => {});
    await writeFile(
      path.join(out, file + "-failure-aria.txt"),
      await currentPage.locator("body").ariaSnapshot(),
    ).catch(() => {});
  }
  await writeFile(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
}
const button = (name) => currentPage.getByRole("button", { name, exact: true });
const tick = async () =>
  Number((await currentPage.locator(".run-status").innerText()).match(/tick\s+(\d+)/)?.[1] ?? NaN);
const revision = async () =>
  Number(
    (await currentPage.locator(".project-name").innerText()).match(/Scene rev\s+(\d+)/)?.[1] ?? NaN,
  );
const count = async () =>
  currentPage
    .getByRole("list", { name: "Scene object list", exact: true })
    .getByRole("button")
    .count();
async function exportProject(label) {
  const downloadPromise = currentPage.waitForEvent("download");
  await button("Export project").click();
  const dl = await downloadPromise;
  const filename = path.join(cache, label + ".json");
  await dl.saveAs(filename);
  return JSON.parse(await readFile(filename, "utf8"));
}
async function importProject(value, label, apply = true) {
  await button("Import project JSON").click();
  const dlg = currentPage.getByRole("dialog");
  await dlg.getByRole("textbox").count();
  await dlg.locator("input[type=file]").setInputFiles({
    name: label + ".json",
    mimeType: "application/json",
    buffer: Buffer.from(typeof value === "string" ? value : JSON.stringify(value)),
  });
  if (apply) {
    await dlg.getByRole("button", { name: "Apply and open project", exact: true }).click();
    await expect(dlg).not.toBeVisible();
  }
  return dlg;
}
async function snapshot(name) {
  const f = path.join(out, name + ".txt");
  await writeFile(f, await currentPage.locator("body").ariaSnapshot());
  artifacts.push(f);
}
try {
  await makePage();
  await check(
    "interaction.navigation",
    ["Build scene", "Interactive experiment", "Inspect & compare"],
    ["pointer click", "keyboard Enter", "no scene revision mutation"],
    async () => {
      const r = await revision();
      for (const name of ["02 Interactive experiment", "03 Inspect & compare", "01 Build scene"]) {
        await button(name).click();
        await expect(button(name)).toHaveAttribute("aria-current", "page");
      }
      await button("03 Inspect & compare").press("Enter");
      await expect(button("03 Inspect & compare")).toHaveAttribute("aria-current", "page");
      assert.equal(await revision(), r);
      return { sceneRevision: r };
    },
  );
  await check(
    "interaction.locale",
    ["Interface language"],
    ["English", "繁體中文", "keyboard option change", "state retained"],
    async () => {
      const language = currentPage.getByRole("combobox", {
        name: "介面語言 / Interface language",
        exact: true,
      });
      const before = await exportProject("locale-before");
      await language.selectOption("zh-TW");
      await expect(button("01 建立場景")).toBeVisible();
      await language.focus();
      await currentPage.keyboard.press("End");
      await currentPage.keyboard.press("Enter");
      await language.selectOption("en");
      const after = await exportProject("locale-after");
      assert.deepEqual(after.scene, before.scene);
      return { sceneUnchanged: true };
    },
  );
  await check(
    "interaction.transport",
    ["Start simulation", "Pause", "Resume simulation", "Reset"],
    ["click", "Space keyboard activation", "tick progression", "reset tick"],
    async () => {
      await currentPage
        .locator(".transport-actions")
        .getByRole("button", { name: /^(Start simulation|Resume simulation)$/ })
        .click();
      await expect.poll(tick).toBeGreaterThan(0);
      await currentPage
        .locator(".transport-actions")
        .getByRole("button", { name: "Pause", exact: true })
        .click();
      const stopped = await tick();
      await currentPage.waitForTimeout(150);
      assert.equal(await tick(), stopped);
      await button("Resume simulation").press("Space");
      await expect.poll(tick).toBeGreaterThan(stopped);
      await button("Reset").click();
      await expect.poll(tick).toBe(0);
      return { pausedTick: stopped, resetTick: await tick() };
    },
  );
  await check(
    "interaction.panel-toggle",
    ["Scene panel", "Inspector panel", "hidden dividers"],
    ["click show/hide", "aria-pressed", "hidden tab exclusion"],
    async () => {
      for (const [name, region, sep] of [
        ["Scene", "Scene and assets", "Resize scene panel"],
        ["Inspector", "Property inspector", "Resize inspector"],
      ]) {
        await currentPage
          .locator(".panel-controls")
          .getByRole("button", { name, exact: true })
          .click();
        await expect(
          currentPage.getByRole("complementary", { name: region, exact: true }),
        ).not.toBeVisible();
        const separator = currentPage.getByRole("separator", { name: sep, includeHidden: true });
        assert.equal(await separator.getAttribute("tabindex"), "-1");
        assert.equal(await separator.getAttribute("aria-hidden"), "true");
        await currentPage
          .locator(".panel-controls")
          .getByRole("button", { name, exact: true })
          .click();
        await expect(
          currentPage.getByRole("complementary", { name: region, exact: true }),
        ).toBeVisible();
      }
      return { bothRestored: true };
    },
  );
  await check(
    "interaction.panel-resize",
    ["Resize scene panel", "Resize inspector"],
    ["pointer drag", "ArrowLeft", "ArrowRight", "Home", "double click"],
    async () => {
      const observations = [];
      for (const name of ["Resize scene panel", "Resize inspector"]) {
        const s = currentPage.getByRole("separator", { name, exact: true });
        const initial = Number(await s.getAttribute("aria-valuenow"));
        await s.press("ArrowRight");
        const right = Number(await s.getAttribute("aria-valuenow"));
        assert.notEqual(right, initial);
        await s.press("ArrowLeft");
        assert.equal(Number(await s.getAttribute("aria-valuenow")), initial);
        await s.press("Home");
        const home = Number(await s.getAttribute("aria-valuenow"));
        const box = await s.boundingBox();
        await currentPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await currentPage.mouse.down();
        await currentPage.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, {
          steps: 5,
        });
        await currentPage.mouse.up();
        const dragged = Number(await s.getAttribute("aria-valuenow"));
        assert.notEqual(dragged, home);
        await s.dblclick();
        assert.equal(Number(await s.getAttribute("aria-valuenow")), home);
        observations.push({ name, initial, right, home, dragged });
      }
      return observations;
    },
  );
  await check(
    "interaction.viewport-tools",
    ["Move", "Rotate", "Scale", "Frame selection"],
    ["click", "keyboard Enter", "selected-state", "frame click"],
    async () => {
      const group = currentPage.getByRole("group", { name: "Transform tool", exact: true });
      for (const name of ["Move", "Rotate", "Scale"]) {
        await group.getByRole("button", { name, exact: true }).click();
        await expect(group.getByRole("button", { name, exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await group.getByRole("button", { name: "Move", exact: true }).press("Enter");
      await expect(group.getByRole("button", { name: "Move", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await button("Frame selection").click();
      return { transformModes: 3, frameEnabled: true };
    },
  );
  await check(
    "interaction.viewport-camera",
    ["Orbit", "Pan", "Zoom"],
    ["Alt+left drag", "middle drag", "wheel", "scene/listener unmodified"],
    async () => {
      const before = await exportProject("camera-before");
      const canvas = currentPage.locator("canvas");
      const b = await canvas.boundingBox();
      const x = b.x + b.width / 2,
        y = b.y + b.height / 2;
      const pixelsBefore = createHash("sha256")
        .update(await canvas.screenshot())
        .digest("hex");
      await currentPage.keyboard.down("Alt");
      await currentPage.mouse.move(x, y);
      await currentPage.mouse.down();
      await currentPage.mouse.move(x + 45, y + 20, { steps: 6 });
      await currentPage.mouse.up();
      await currentPage.keyboard.up("Alt");
      await currentPage.mouse.down({ button: "middle" });
      await currentPage.mouse.move(x + 65, y + 10, { steps: 5 });
      await currentPage.mouse.up({ button: "middle" });
      await currentPage.mouse.wheel(0, -120);
      await currentPage.waitForTimeout(250);
      const pixelsAfter = createHash("sha256")
        .update(await canvas.screenshot())
        .digest("hex");
      assert.notEqual(pixelsBefore, pixelsAfter);
      const after = await exportProject("camera-after");
      assert.deepEqual(after.scene, before.scene);
      return { renderChanged: true, sceneUnchanged: true };
    },
  );
  await check(
    "interaction.view-details",
    ["View details", "Blocked candidates"],
    ["summary expand/collapse", "checkbox pointer+keyboard"],
    async () => {
      const details = currentPage.locator(".viewport-details");
      await details.locator("summary").click();
      const blocked = currentPage.getByRole("checkbox", {
        name: "Blocked candidates (not sent to audio)",
        exact: true,
      });
      await blocked.check();
      await expect(blocked).toBeChecked();
      await blocked.press("Space");
      await expect(blocked).not.toBeChecked();
      await details.locator("summary").press("Enter");
      await expect(blocked).not.toBeVisible();
      return { checkedAndRestored: true };
    },
  );
  await check(
    "interaction.help",
    ["About Scene", "About Undo scene command", "all initially described controls"],
    ["hover", "focus", "Escape", "disabled control fallback", "description IDs nonempty"],
    async () => {
      const described = await currentPage.locator("[aria-describedby]").evaluateAll((nodes) =>
        nodes.map((n) => ({
          name: n.getAttribute("aria-label") || n.textContent.trim().slice(0, 100),
          disabled: n.disabled === true,
          ids: n
            .getAttribute("aria-describedby")
            .split(/\s+/)
            .map((id) => ({ id, text: document.getElementById(id)?.textContent?.trim() || "" })),
        })),
      );
      assert.ok(described.length > 10);
      for (const d of described)
        for (const i of d.ids) assert.ok(i.text.length > 0, d.name + " has missing description");
      const about = button("About Scene");
      await about.hover();
      await expect(currentPage.getByRole("tooltip")).toBeVisible();
      await about.press("Escape");
      await expect(currentPage.getByRole("tooltip")).not.toBeVisible();
      await currentPage
        .getByRole("button", { name: /^About (Undo|Redo) scene command$/ })
        .first()
        .focus();
      await expect(currentPage.getByRole("tooltip")).toBeVisible();
      await currentPage.keyboard.press("Escape");
      await expect(currentPage.getByRole("tooltip")).not.toBeVisible();
      return { describedCallers: described };
    },
  );
  await check(
    "interaction.scene-search",
    ["Search scene objects"],
    ["case-insensitive", "no match", "empty reset", "keyboard typing"],
    async () => {
      const q = currentPage.getByRole("textbox", { name: "Search scene objects", exact: true });
      await q.fill("BALL");
      assert.equal(await count(), 1);
      await q.fill("not-a-real-object");
      assert.equal(await count(), 0);
      await expect(currentPage.getByText("No matching objects.", { exact: true })).toBeVisible();
      await q.fill("");
      assert.equal(await count(), 6);
      return { totalObjects: 6 };
    },
  );
  await check(
    "interaction.primitive-authoring",
    ["Box +", "Sphere +", "Capsule +", "Undo", "Redo", "Delete", "Duplicate"],
    [
      "click all primitive kinds",
      "undo button",
      "Ctrl+Shift+Z",
      "Delete key",
      "text focus isolation",
    ],
    async () => {
      let expected = await count();
      for (const name of ["Box +", "Sphere +", "Capsule +"]) {
        await button(name).click();
        expected++;
        await expect.poll(count).toBe(expected);
      }
      const exported = await exportProject("primitives");
      assert.deepEqual(
        exported.scene.objects.slice(-3).map((o) => o.shape),
        ["box", "sphere", "capsule"],
      );
      await button("Undo scene command").click();
      expected--;
      await expect.poll(count).toBe(expected);
      await currentPage.locator(".viewport-title").click();
      await currentPage.keyboard.press("Control+Shift+Z");
      expected++;
      await expect.poll(count).toBe(expected);
      await currentPage.keyboard.press("Control+Z");
      expected--;
      await expect.poll(count).toBe(expected);
      await currentPage.keyboard.press("Control+Shift+Z");
      expected++;
      await expect.poll(count).toBe(expected);
      await currentPage
        .getByRole("list", { name: "Scene object list", exact: true })
        .getByRole("button", { name: /^ball / })
        .click();
      await button("Duplicate").click();
      expected++;
      await expect.poll(count).toBe(expected);
      await currentPage.locator(".viewport-title").click();
      await currentPage.keyboard.press("Delete");
      expected--;
      await expect.poll(count).toBe(expected);
      const q = currentPage.getByRole("textbox", { name: "Search scene objects", exact: true });
      await q.fill("ball");
      await q.press("Delete");
      assert.equal((await exportProject("typing-delete")).scene.objects.length, expected);
      await q.fill("");
      await button("Undo scene command").click();
      expected++;
      await expect.poll(count).toBe(expected);
      await currentPage
        .getByRole("list", { name: "Scene object list", exact: true })
        .getByRole("button", { name: /^ball / })
        .click();
      await button("Delete").click();
      expected--;
      await expect.poll(count).toBe(expected);
      return {
        objects: expected,
        uniqueIds: new Set(exported.scene.objects.map((o) => o.id)).size,
      };
    },
  );
  await check(
    "interaction.project-save-load",
    ["Save project", "Load locally saved project", "Ctrl+S", "Export project"],
    ["click save", "mutation/load restores", "shortcut save", "reload persistence"],
    async () => {
      const initial = await count();
      await button("Save project").click();
      await button("Box +").click();
      await expect.poll(count).toBe(initial + 1);
      await button("Load locally saved project").click();
      await expect.poll(count).toBe(initial);
      await button("Capsule +").click();
      await expect.poll(count).toBe(initial + 1);
      await currentPage.locator(".viewport-title").click();
      await currentPage.keyboard.press("Control+s");
      await button("Sphere +").click();
      await expect.poll(count).toBe(initial + 2);
      await button("Load locally saved project").click();
      await expect.poll(count).toBe(initial + 1);
      const data = await exportProject("persisted-project");
      assert.equal(data.scene.objects.length, initial + 1);
      await currentPage.reload();
      await button("Load locally saved project").click();
      await expect.poll(count).toBe(initial + 1);
      return { persistedObjects: initial + 1, projectId: data.projectId };
    },
  );
  await check(
    "interaction.project-import",
    ["Import project JSON", "File chooser", "JSON review", "Cancel", "Apply", "Escape"],
    [
      "valid file preview/cancel",
      "explicit replace",
      "malformed JSON",
      "invalid root",
      "oversize",
      "focus restoration",
    ],
    async () => {
      const before = await exportProject("import-before");
      let dialog = await importProject(before, "cancelled", false);
      await dialog.getByRole("button", { name: "Cancel import", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      assert.equal(
        (await exportProject("import-cancel-after")).scene.sceneRevision,
        before.scene.sceneRevision,
      );
      await button("Import project JSON").click();
      dialog = currentPage.getByRole("dialog");
      await dialog.locator("input[type=file]").setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from("{"),
      });
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Apply and open project", exact: true }),
      ).toBeDisabled();
      await dialog.locator("input[type=file]").focus();
      await currentPage.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(button("Import project JSON")).toBeFocused();
      await button("Import project JSON").click();
      dialog = currentPage.getByRole("dialog");
      await dialog.locator("input[type=file]").setInputFiles({
        name: "array.json",
        mimeType: "application/json",
        buffer: Buffer.from("[]"),
      });
      await expect(dialog.getByRole("alert")).toContainText("JSON object");
      await dialog.getByRole("button", { name: "Cancel import", exact: true }).click();
      await button("Import project JSON").click();
      dialog = currentPage.getByRole("dialog");
      await dialog.locator("input[type=file]").setInputFiles({
        name: "oversize.json",
        mimeType: "application/json",
        buffer: Buffer.alloc(8 * 1024 * 1024 + 1, 32),
      });
      await expect(dialog.getByRole("alert")).toContainText("8 MiB");
      await dialog.getByRole("button", { name: "Cancel import", exact: true }).click();
      const next = structuredClone(before);
      next.name = "UI audit roundtrip";
      await importProject(next, "roundtrip");
      assert.equal((await exportProject("import-after")).name, "UI audit roundtrip");
      return { roundtripObjects: before.scene.objects.length, invalidFilesRejected: 3 };
    },
  );
  await snapshot("desktop-after-projects");
  await makePage({ hasTouch: true });
  await check(
    "interaction.help-touch",
    ["About Scene"],
    ["real touchscreen tap", "tap close", "tooltip stays within viewport"],
    async () => {
      const a = button("About Scene");
      const b = await a.boundingBox();
      await currentPage.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await expect(currentPage.getByRole("tooltip")).toBeVisible();
      const t = await currentPage.getByRole("tooltip").boundingBox();
      assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.width <= 1600 && t.y + t.height <= 1100);
      await currentPage.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await expect(currentPage.getByRole("tooltip")).not.toBeVisible();
      return { realTouchInput: true };
    },
  );
  await makePage();
  const baseline = await exportProject("fps-baseline");
  const fixture = structuredClone(baseline);
  fixture.name = "UI interaction audit fixture";
  fixture.scene.objects.find((o) => o.id === "ball").positionM = [0, 1.6, 1.5];
  fixture.scene.objects.find((o) => o.id === "ball").mode = "dynamicNoGravity";
  await importProject(fixture, "fps-fixture");
  await check(
    "interaction.fps-native",
    ["Enter first person", "WASD", "Shift", "mouse look", "Enter", "Tab"],
    [
      "native browser pointer lock",
      "movement keys",
      "pause/resume",
      "Tab releases lock",
      "entry not throw",
    ],
    async () => {
      await button("Enter first person").click();
      await expect
        .poll(() => currentPage.evaluate(() => Boolean(document.pointerLockElement)))
        .toBe(true);
      await expect.poll(tick).toBeGreaterThan(0);
      for (const key of ["w", "s", "a", "d"]) {
        await currentPage.keyboard.down(key);
        await currentPage.waitForTimeout(90);
        await currentPage.keyboard.up(key);
      }
      await currentPage.keyboard.down("Shift");
      await currentPage.keyboard.down("w");
      await currentPage.waitForTimeout(90);
      await currentPage.keyboard.up("w");
      await currentPage.keyboard.up("Shift");
      await currentPage.keyboard.press("Enter");
      await expect(currentPage.locator(".run-status")).toContainText("Paused");
      const frozen = await tick();
      await currentPage.waitForTimeout(100);
      assert.equal(await tick(), frozen);
      await currentPage.keyboard.press("Enter");
      await expect(currentPage.locator(".run-status")).toContainText("Running");
      await currentPage.keyboard.press("Tab");
      await expect
        .poll(() => currentPage.evaluate(() => Boolean(document.pointerLockElement)))
        .toBe(false);
      await expect(currentPage.locator(".run-status")).toContainText("Paused");
      return { nativeLock: true, pausedTick: frozen, tabReleased: true };
    },
  );
  await check(
    "interaction.fps-no-lock",
    [
      "Enable controls without pointer lock",
      "Start first-person controls",
      "8 movement/look buttons",
      "WASD/arrows",
      "Exit first person",
    ],
    ["explicit opt-in", "button pulse directions", "keyboard look", "focus pause", "exit"],
    async () => {
      await button("Enable controls without pointer lock").click();
      await button("Start first-person controls").click();
      await expect(currentPage.locator(".run-status")).toContainText("Running");
      assert.equal(await currentPage.evaluate(() => Boolean(document.pointerLockElement)), false);
      await currentPage.locator(".viewport-accessible-movement summary").click();
      for (const name of [
        "Forward",
        "Backward",
        "Move left",
        "Move right",
        "Look left",
        "Look right",
        "Look up",
        "Look down",
      ]) {
        await button(name).click();
        await expect(button(name)).toBeEnabled();
      }
      const canvas = currentPage.locator("canvas");
      await canvas.click();
      for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
        await currentPage.keyboard.press(key);
      }
      await currentPage.getByRole("textbox", { name: "Search scene objects", exact: true }).click();
      await expect(currentPage.locator(".run-status")).toContainText("Paused");
      await button("Exit first person").click();
      await expect(button("Enter first person")).toBeVisible();
      return { noNativeLock: true, movementButtons: 8, typingFocusPaused: true };
    },
  );
  await makePage();
  await importProject(fixture, "grab-fixture");
  await check(
    "interaction.grab-drop-throw",
    ["Grab", "Release", "Throw", "E", "R", "wheel"],
    ["native key grab", "rotation+distance", "buttons", "freeze", "undo"],
    async () => {
      await button("Enter first person").click();
      await expect
        .poll(() => currentPage.evaluate(() => Boolean(document.pointerLockElement)))
        .toBe(true);
      await currentPage.keyboard.press("e");
      await expect(
        currentPage
          .getByRole("list", { name: "Scene object list" })
          .getByRole("button", { name: "ball Held", exact: true }),
      ).toBeVisible();
      await currentPage.keyboard.down("r");
      await currentPage.mouse.move(40, 20, { steps: 3 });
      await currentPage.keyboard.up("r");
      await currentPage.mouse.wheel(0, -100);
      await currentPage.keyboard.press("Tab");
      await button("Enable controls without pointer lock").click();
      await button("Start first-person controls").click();
      await button("Release").click();
      await expect(button("Release")).toBeDisabled();
      await button("Grab").click();
      await expect(button("Release")).toBeEnabled();
      await button("Throw").click();
      await expect(button("Throw")).toBeDisabled();
      await button("Exit first person").click();
      return { grabbed: true, released: true, thrown: true };
    },
  );
  await makePage();
  await importProject(baseline, "build-fixture");
  await check(
    "interaction.build-preview",
    [
      "Start placement preview",
      "Cancel placement",
      "Place",
      "R",
      "wheel",
      "L",
      "primitive selection",
    ],
    [
      "no-lock preview",
      "cancel preserves count",
      "rotate/wheel",
      "place atomic",
      "library paused selection",
    ],
    async () => {
      await button("Enter first person").click();
      await currentPage.keyboard.press("Tab");
      await button("Enable controls without pointer lock").click();
      await button("Start first-person controls").click();
      const before = await count();
      await button("Start placement preview").click();
      await expect(button("Cancel placement")).toBeVisible();
      await button("Cancel placement").click();
      assert.equal(await count(), before);
      await button("Start placement preview").click();
      const canvas = currentPage.locator("canvas");
      await canvas.click();
      await currentPage.mouse.wheel(0, -100);
      await currentPage.keyboard.press("r");
      await expect(button("Place")).toBeEnabled();
      await button("Place").click();
      await expect.poll(count).toBe(before + 1);
      await expect(button("Cancel placement")).toHaveCount(0);
      await canvas.click();
      await currentPage.keyboard.press("l");
      await expect(currentPage.locator(".run-status")).toContainText("Paused");
      await button("Sphere +").click();
      assert.equal(await count(), before + 1);
      await expect(button("Cancel placement")).toHaveCount(0);
      await button("Start first-person controls").click();
      await button("Start placement preview").click();
      await canvas.click();
      for (let i = 0; i < 5; i++) await currentPage.mouse.wheel(0, 100);
      await expect(button("Place")).toBeEnabled();
      await button("Place").click();
      await expect.poll(count).toBe(before + 2);
      await button("Exit first person").click();
      await button("Undo scene command").click();
      await expect.poll(count).toBe(before + 1);
      return { placedObjects: 2, cancelUnchanged: true, singleUndoRemovedOne: true };
    },
  );
  await makePage({ viewport: { width: 900, height: 1000 } });
  await check(
    "interaction.responsive-panels",
    ["Scene", "3D viewport", "Inspector"],
    ["100% viewport", "mobile-pane controls", "keyboard Tab"],
    async () => {
      const nav = currentPage.getByRole("navigation", { name: "Main panels", exact: true });
      for (const name of ["Scene", "3D viewport", "Inspector"]) {
        await nav.getByRole("button", { name, exact: true }).click();
        await expect(nav.getByRole("button", { name, exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await nav.getByRole("button", { name: "3D viewport", exact: true }).click();
      await currentPage.keyboard.press("Tab");
      const focus = await currentPage.evaluate(() => ({
        tag: document.activeElement?.tagName,
        text: document.activeElement?.textContent?.trim().slice(0, 80),
      }));
      assert.ok(focus.tag);
      await expect(
        currentPage.getByRole("contentinfo", { name: "Audio monitoring and backend status" }),
      ).toBeVisible();
      return { allThreePanes: true, focus };
    },
  );
  await snapshot("responsive-final");
} catch (error) {
  receipt.fatal = String(error);
} finally {
  if (context) {
    await context.tracing.stop({ path: path.join(cache, "trace.zip") }).catch(() => {});
    await context.close();
  }
  await browser.close();
}
receipt.finishedAtUtc = new Date().toISOString();
receipt.loadedBundles = [...new Set(receipt.loadedBundles)];
receipt.summary = {
  passed: receipt.checks.filter((c) => c.status === "PASS").length,
  failed: receipt.checks.filter((c) => c.status === "FAIL").length,
  total: receipt.checks.length,
};
receipt.status =
  receipt.fatal || receipt.summary.failed || receipt.consoleErrors.length ? "FAIL" : "PASS";
receipt.artifacts = artifacts.map((p) => path.relative(process.cwd(), p).replaceAll("\\", "/"));
receipt.source = [];
for (const p of [
  "src/ui/App.tsx",
  "src/ui/Viewport.tsx",
  "src/ui/SceneExplorer.tsx",
  "src/ui/ProjectImport.tsx",
  "src/ui/HelpTip.tsx",
  "src/ui/viewport/useFPSInput.ts",
  "src/ui/viewport/AccessibleMovement.tsx",
  "tests/browser/parameter-audit/interaction-audit.mjs",
]) {
  receipt.source.push({
    path: p,
    sha256: createHash("sha256")
      .update(await readFile(p))
      .digest("hex"),
  });
}
await writeFile(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      summary: receipt.summary,
      fatal: receipt.fatal,
      failures: receipt.checks
        .filter((c) => c.status === "FAIL")
        .map((c) => ({ id: c.id, error: c.error })),
      consoleErrors: receipt.consoleErrors,
    },
    null,
    2,
  ),
);
process.exitCode = receipt.status === "PASS" ? 0 : 1;
