import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
const selectedCases = new Set((process.argv[2] || "").split(",").filter(Boolean));
const runLabel = process.env.INTERACTION_RUN_LABEL;
if (runLabel && !/^[a-z0-9_-]+$/i.test(runLabel)) throw new Error("Invalid evidence run label");
const out = path.resolve(
  "docs/14-core-pipeline/stages/11-ui-parameters/interaction/" +
    (runLabel || (selectedCases.size ? "completion-short" : "completion")),
);
const cache = path.resolve(".cache/parameter-audit/interaction/" + (runLabel || "completion"));
await mkdir(out, { recursive: true });
await mkdir(cache, { recursive: true });
const receipt = {
  schemaVersion: 1,
  kind: "INTERACTION_PARAMETER_COMPLETION",
  status: "RUNNING",
  startedAtUtc: new Date().toISOString(),
  method:
    "Real production Chrome DOM/pointer/keyboard; no runtime bridge. DOM cancellation probes are explicitly distinguished from trusted hardware input.",
  gitHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  checks: [],
  consoleErrors: [],
  expectedEnvironmentErrors: [],
  bundles: [],
  evidenceDirectory: path.relative(process.cwd(), out),
};
await writeFile(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
let browser = await chromium.launch({
  channel: "chrome",
  headless: process.env.INTERACTION_HEADED !== "1",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
receipt.browser = browser.version();
receipt.browserMode = process.env.INTERACTION_HEADED === "1" ? "headed" : "headless";
let page;
let context;
let environmentWebglDisabled = false;
let pageNumber = 0;
let baseline;
process.on("SIGTERM", async () => {
  await browser?.close();
  process.exit(143);
});
const button = (n) => page.getByRole("button", { name: n, exact: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const rows = (name) =>
  page
    .getByRole("list", { name: "Scene object list", exact: true })
    .getByRole("button", name ? { name, exact: typeof name === "string" } : {});
async function fresh(options = {}) {
  if (context) {
    await context.tracing
      .stop({ path: path.join(cache, "trace-" + pageNumber + ".zip") })
      .catch(() => {});
    await context.close();
  }
  context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    acceptDownloads: true,
    ...options,
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  pageNumber++;
  const recordError = (message) => {
    const expected =
      environmentWebglDisabled && /webgl|gl context|<Canvas>|WebGLRenderer/i.test(message);
    (expected ? receipt.expectedEnvironmentErrors : receipt.consoleErrors).push(message);
  };
  page.on("pageerror", (e) => recordError(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") recordError(m.text());
  });
  await page.goto("http://127.0.0.1:4173/");
  await page
    .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
    .selectOption("en");
  await button("Enter first person").waitFor({ state: "visible" });
  receipt.bundles.push(
    ...(await page.locator("script[src]").evaluateAll((n) => n.map((s) => s.src))),
  );
  return page;
}
async function project(label) {
  const p = page.waitForEvent("download");
  await button("Export project").click();
  const d = await p;
  const file = path.join(cache, label + ".json");
  await d.saveAs(file);
  return JSON.parse(await readFile(file, "utf8"));
}
async function chooseFile(input, file) {
  const p = page.waitForEvent("filechooser");
  await input.click();
  const chooser = await p;
  await chooser.setFiles(file);
}
async function load(value, label) {
  await button("Import project JSON").click();
  const dlg = page.getByRole("dialog");
  await chooseFile(dlg.locator("input[type=file]"), {
    name: label + ".json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  });
  await dlg.getByRole("button", { name: "Apply and open project", exact: true }).click();
  await expect(dlg).not.toBeVisible();
}
async function check(id, families, methods, run) {
  if (selectedCases.size && !selectedCases.has(id)) return;
  const item = { id, semanticFamilyIds: families, methods, status: "RUNNING" };
  receipt.checks.push(item);
  try {
    item.observation = await run();
    item.status = "PASS";
  } catch (e) {
    item.status = "FAIL";
    item.error = String(e);
    await page
      .screenshot({ path: path.join(out, id + "-failure.png"), fullPage: true })
      .catch(() => {});
    await writeFile(
      path.join(out, id + "-failure-aria.txt"),
      await page.locator("body").ariaSnapshot(),
    ).catch(() => {});
  }
  await writeFile(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
}
async function scanHelpCallers(scope) {
  const modal = page.getByRole("dialog");
  const inModal = await modal.isVisible();
  const all = (inModal ? modal : page).locator(".help-tip [aria-describedby]");
  const n = await all.count();
  const observations = [];
  for (let i = 0; i < n; i++) {
    const original = all.nth(i);
    const meta = await original.evaluate((e) => ({
      name: e.getAttribute("aria-label") || e.textContent.trim().slice(0, 100),
      disabled: e.disabled === true,
      descriptions: e
        .getAttribute("aria-describedby")
        .split(/\s+/)
        .map((id) => ({ id, text: document.getElementById(id)?.textContent?.trim() || "" })),
    }));
    for (const desc of meta.descriptions) assert.ok(desc.text.length > 0);
    let trigger = original;
    if (meta.disabled)
      trigger = original
        .locator("xpath=ancestor::span[contains(@class,'help-tip')][1]")
        .locator(".help-tip-trigger");
    const ancestors = trigger.locator("xpath=ancestor::details");
    for (const detail of (await ancestors.all()).reverse()) {
      if (!(await detail.evaluate((e) => e.open))) await detail.locator("summary").first().click();
    }
    if (await trigger.isVisible()) {
      await trigger.scrollIntoViewIfNeeded();
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible()) await dialog.locator("input[type=file]").focus();
      else await page.locator("canvas").focus();
      await trigger.focus();
      const focus = await page.evaluate(() => ({
        label: document.activeElement?.getAttribute("aria-label"),
        tag: document.activeElement?.tagName,
        describedBy: document.activeElement?.getAttribute("aria-describedby"),
        visibility: document.visibilityState,
        hasFocus: document.hasFocus(),
      }));
      await writeFile(
        path.join(out, "help-current-caller.json"),
        JSON.stringify({ scope, index: i, meta, focus, completed: observations }, null, 2),
      );
      await expect(page.getByRole("tooltip")).toBeVisible();
      await page.keyboard.press("Escape");
      observations.push({ scope, ...meta, status: "FOCUS_REACH_PASS" });
      await writeFile(
        path.join(out, "help-scan-" + scope + ".json"),
        JSON.stringify(observations, null, 2),
      );
    } else observations.push({ scope, ...meta, status: "CONDITIONALLY_HIDDEN" });
  }
  assert.ok(
    observations.filter((o) => o.status === "FOCUS_REACH_PASS").length >= (inModal ? 2 : 10),
  );
  return observations;
}
async function heldScene({ support = true, low = true } = {}) {
  const s = structuredClone(baseline);
  s.name = "UI held parameter fixture";
  const ball = s.scene.objects.find((o) => o.id === "ball");
  ball.positionM = [0, low ? 0.55 : 1.6, 1.5];
  ball.mode = "dynamicNoGravity";
  if (low) {
    const pitch = Math.atan2(-1.05, 2.5);
    s.scene.listener.orientationQuaternion = [Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)];
  }
  if (!support) {
    s.scene.objects = s.scene.objects.filter((o) => o.id !== "floor");
    s.scene.gravityMps2 = [0, 0, 0];
  }
  return s;
}
async function enterHeld(options) {
  await fresh();
  await load(await heldScene(options), "held");
  await button("Enter first person").click();
  await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);
  await expect(page.locator(".run-status")).toContainText("Running");
  await page.keyboard.press("e");
  await expect(rows("ball Held")).toBeVisible();
}
async function noLock() {
  await page.keyboard.press("Tab");
  await button("Enable controls without pointer lock").click();
  await button("Start first-person controls").click();
  await expect(page.locator(".run-status")).toContainText("Running");
}
async function sceneBall(label) {
  return (await project(label)).scene.objects.find((o) => o.id === "ball");
}
async function cameraPixels(maskGizmo = false) {
  const bytes = await page.locator("canvas").screenshot();
  if (!maskGizmo) return sha(bytes);
  // Ignore only the central gizmo hover colors, so a hover highlight cannot
  // masquerade as camera movement. Grid/walls outside this region remain.
  return page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = "data:image/png;base64," + encoded;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(canvas.width / 2 - 145, canvas.height / 2 - 145, 290, 290);
    ctx.fillRect(0, 0, canvas.width, 72);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    );
    return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
  }, bytes.toString("base64"));
}
async function settleCamera() {
  const started = Date.now();
  let last = await cameraPixels(true);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(120);
    const current = await cameraPixels(true);
    if (current === last) return { hash: current, elapsedMs: Date.now() - started };
    last = current;
  }
  throw new Error("Camera image did not settle without pointer movement");
}
async function focusBall() {
  await rows(/^ball /).click();
  await button("Frame selection").click();
  await page.waitForTimeout(150);
}
async function hoverRotationAxis(axis) {
  const canvas = page.locator("canvas");
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + 4, b.y + b.height - 4);
  await page.waitForTimeout(80);
  const baselineBytes = await canvas.screenshot();
  const baseline = await page.evaluate(
    async ({ encoded, axis }) => {
      const image = new Image();
      image.src = "data:image/png;base64," + encoded;
      await image.decode();
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const masks = [[], [], []],
        cx = c.width / 2,
        cy = c.height / 2;
      for (let pixel = 0; pixel < data.length / 4; pixel++) {
        const x = pixel % c.width,
          y = Math.floor(pixel / c.width),
          radius = Math.hypot(x - cx, y - cy);
        if (radius < 8 || radius > 105) continue;
        for (let color = 0; color < 3; color++)
          if (
            data[pixel * 4 + color] > 225 &&
            [0, 1, 2].every((j) => j === color || data[pixel * 4 + j] < 80)
          )
            masks[color].push(pixel);
      }
      if (masks.some((m) => m.length < 10))
        throw new Error("Insufficient visible RGB rotation masks");
      const target = masks[axis],
        peers = masks.filter((_, i) => i !== axis).flat();
      const candidates = [];
      for (let i = 0; i < target.length; i += Math.max(1, Math.floor(target.length / 32))) {
        const pixel = target[i],
          x = pixel % c.width,
          y = Math.floor(pixel / c.width);
        const separation = Math.min(
          ...peers.map((p) => ((p % c.width) - x) ** 2 + (Math.floor(p / c.width) - y) ** 2),
        );
        candidates.push({ x, y, separation });
      }
      candidates.sort((a, b) => b.separation - a.separation);
      return { masks, candidates, width: c.width, height: c.height, cx, cy };
    },
    { encoded: baselineBytes.toString("base64"), axis },
  );
  await writeFile(path.join(out, "rotate-" + axis + "-baseline.png"), baselineBytes);
  const attempts = [];
  for (const p of baseline.candidates.slice(0, 24)) {
    const x = b.x + (p.x * b.width) / baseline.width,
      y = b.y + (p.y * b.height) / baseline.height;
    await page.mouse.move(x, y);
    await page.waitForTimeout(70);
    const hoverBytes = await canvas.screenshot();
    const score = await page.evaluate(
      async ({ encoded, masks, axis }) => {
        const image = new Image();
        image.src = "data:image/png;base64," + encoded;
        await image.decode();
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const targetYellow =
          masks[axis].filter(
            (p) => data[p * 4] > 180 && data[p * 4 + 1] > 180 && data[p * 4 + 2] < 100,
          ).length / masks[axis].length;
        const retained = masks.map(
          (m, color) =>
            m.filter(
              (p) =>
                data[p * 4 + color] > 225 &&
                [0, 1, 2].every((j) => j === color || data[p * 4 + j] < 80),
            ).length / m.length,
        );
        return { targetYellow, retained };
      },
      { encoded: hoverBytes.toString("base64"), masks: baseline.masks, axis },
    );
    attempts.push({ x, y, score });
    if (
      score.targetYellow > 0.5 &&
      score.retained.every((ratio, i) => i === axis || ratio > 0.65)
    ) {
      await writeFile(path.join(out, "rotate-" + axis + "-confirmed-hover.png"), hoverBytes);
      await writeFile(
        path.join(out, "rotate-" + axis + "-picker-attempts.json"),
        JSON.stringify(attempts, null, 2),
      );
      return { x, y, cx: b.x + b.width / 2, cy: b.y + b.height / 2, hoverConfirmation: score };
    }
  }
  await writeFile(
    path.join(out, "rotate-" + axis + "-picker-attempts.json"),
    JSON.stringify(attempts, null, 2),
  );
  throw new Error(
    "Could not independently confirm requested rotation picker via target-yellow/peer-color masks",
  );
}
async function axisPoint(axis, mode) {
  if (mode === "rotate") return hoverRotationAxis(axis);
  const canvas = page.locator("canvas");
  const b = await canvas.boundingBox();
  const bytes = await canvas.screenshot();
  const point = await page.evaluate(
    async ({ encoded, axis, mode }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + encoded;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const cx = c.width / 2,
        cy = c.height / 2;
      const points = [];
      for (let i = 0; i < d.length; i += 4) {
        const color = [d[i], d[i + 1], d[i + 2]];
        if (color[axis] < 225 || color.some((v, j) => j !== axis && v > 80)) continue;
        const px = (i / 4) % c.width,
          py = Math.floor(i / 4 / c.width),
          radius = Math.hypot(px - cx, py - cy);
        if (radius < 8 || radius > 105) continue;
        points.push({ x: px, y: py, radius });
      }
      points.sort((a, b) => a.radius - b.radius);
      if (!points.length) throw Error("No rendered RGB axis pixels");
      const p = points[Math.floor(points.length * (mode === "rotate" ? 0.55 : 0.85))];
      return { ...p, cx, cy, width: c.width, height: c.height };
    },
    { encoded: bytes.toString("base64"), axis, mode },
  );
  return {
    x: b.x + (point.x * b.width) / point.width,
    y: b.y + (point.y * b.height) / point.height,
    cx: b.x + (point.cx * b.width) / point.width,
    cy: b.y + (point.cy * b.height) / point.height,
  };
}
async function dragAxis(axis, mode, cancel = null) {
  const p = await axisPoint(axis, mode);
  const dx = p.x - p.cx,
    dy = p.y - p.cy;
  const n = Math.hypot(dx, dy);
  let move = [(dx / n) * 35, (dy / n) * 35];
  if (mode === "rotate") {
    const eye = new Vector3(1, 0.7, 1).normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), eye).normalize();
    const up = new Vector3().crossVectors(eye, right).normalize();
    const unit = new Vector3(...[0, 1, 2].map((i) => (i === axis ? 1 : 0)));
    const tangent = unit.cross(eye).normalize();
    const screen = [tangent.dot(right), -tangent.dot(up)];
    const length = Math.hypot(...screen);
    move = screen.map((v) => (v / length) * 35);
  }
  if (cancel === "pointercancel")
    await page.locator("canvas").evaluate((c) => {
      c.addEventListener(
        "pointerdown",
        (event) => {
          c.dataset.auditPointerId = String(event.pointerId);
        },
        { once: true, capture: true },
      );
    });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + move[0], p.y + move[1], { steps: 7 });
  if (cancel === "Escape") await page.keyboard.press("Escape");
  if (cancel === "pointercancel")
    await page.locator("canvas").dispatchEvent("pointercancel", {
      pointerId: Number(await page.locator("canvas").getAttribute("data-audit-pointer-id")),
      bubbles: true,
    });
  if (cancel === "blur") {
    const tab = await context.newPage();
    await tab.bringToFront();
    await page.waitForTimeout(80);
    await tab.close();
    await page.bringToFront();
  }
  await page.mouse.up();
  await page.waitForTimeout(180);
  return p;
}
try {
  await fresh();
  baseline = await project("baseline");
  await check(
    "skip-and-object-list",
    ["shell.skip", "viewport.select-object.{objectId}"],
    ["Tab+Enter skip link", "each visible object list button", "Listener entry"],
    async () => {
      await page.keyboard.press("Control+Home");
      await page.getByRole("link", { name: "Skip to main workspace", exact: true }).focus();
      await page.keyboard.press("Enter");
      assert.equal(new URL(page.url()).hash, "#main-workspace");
      const names = await rows().allTextContents();
      for (const name of names) {
        await rows().filter({ hasText: name.trim() }).click();
        await expect(rows().filter({ hasText: name.trim() })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await button("Listener / Environment listener.main Independent position").click();
      await expect(
        page.getByRole("heading", { name: "Audio listener", exact: true }),
      ).toBeVisible();
      return { objectButtons: names };
    },
  );
  await check(
    "project-import-json-and-escape",
    ["project.import.inspect-json", "project.import.dialog-escape", "project.import.file"],
    ["real file chooser click", "JSON disclosure", "file focus then Escape", "focus restored"],
    async () => {
      await button("Import project JSON").click();
      const d = page.getByRole("dialog");
      await chooseFile(d.locator("input[type=file]"), {
        name: "valid.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(baseline)),
      });
      await d.locator("details summary").click();
      await expect(d.locator("pre")).toBeVisible();
      await d.locator("pre").focus();
      await page.keyboard.press("ArrowDown");
      await d.locator("input[type=file]").focus();
      await page.keyboard.press("Escape");
      await expect(d).not.toBeVisible();
      await expect(button("Import project JSON")).toBeFocused();
      return { jsonDisclosure: true, escapeFromFileFocus: true };
    },
  );
  await check(
    "error-dismiss",
    ["shell.dismiss-error"],
    ["real invalid project import", "visible dismiss", "error removal without scene mutation"],
    async () => {
      await fresh();
      const before = await project("error-before");
      await button("Import project JSON").click();
      const dlg = page.getByRole("dialog");
      await chooseFile(dlg.locator("input[type=file]"), {
        name: "invalid-domain.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"name":"invalid-domain"}'),
      });
      await dlg.getByRole("button", { name: "Apply and open project", exact: true }).click();
      await expect(dlg.getByRole("alert")).toBeVisible();
      await dlg.getByRole("button", { name: "Cancel import", exact: true }).click();
      await expect(page.locator(".error-banner")).toBeVisible();
      await expect(button("Dismiss operation error")).toBeEnabled();
      await button("Dismiss operation error").click();
      await expect(page.locator(".error-banner")).toHaveCount(0);
      assert.deepEqual((await project("error-after")).scene, before.scene);
      return { realRuntimeErrorDismissed: true, sceneUnchanged: true };
    },
  );
  await check(
    "save-feedback",
    ["project.save"],
    [
      "real authoring pause",
      "visible Save confirmation",
      "pause reason remains visible",
      "scene stays unchanged",
    ],
    async () => {
      await fresh();
      const mass = page.getByRole("spinbutton", { name: "Mass kg", exact: true });
      await mass.fill("1.25");
      await mass.press("Enter");
      await expect(page.locator(".viewport-message")).toBeVisible();
      const pauseReason = await page.locator(".viewport-message").innerText();
      const before = await project("save-feedback-before");
      await button("Save project").click();
      const banner = page.locator(".lab-content > .status-banner[role=status]");
      await expect(banner).toContainText(/saved/i);
      await expect(banner).toContainText(pauseReason);
      await expect(page.locator(".error-banner")).toHaveCount(0);
      assert.equal(await page.locator(".viewport-message").innerText(), pauseReason);
      assert.deepEqual((await project("save-feedback-after")).scene, before.scene);
      return {
        confirmation: await banner.innerText(),
        pauseReasonUnchanged: pauseReason,
        sceneUnchanged: true,
      };
    },
  );
  await check(
    "shared-number-field",
    ["shared.number-field"],
    [
      "Enter commit",
      "blur commit",
      "Escape revert",
      "invalid minimum/empty",
      "locale retains draft",
      "composition guarded DOM KeyboardEvent",
    ],
    async () => {
      await rows(/^ball /).click();
      const mass = page.getByRole("spinbutton", { name: "Mass kg", exact: true });
      await mass.fill("1.234");
      await mass.press("Enter");
      assert.equal((await sceneBall("mass-enter")).massKg, 1.234);
      await mass.fill("2.345");
      await mass.press("Escape");
      assert.equal(await mass.inputValue(), "1.234");
      await mass.fill("-1");
      await mass.press("Enter");
      await expect(mass).toHaveAttribute("aria-invalid", "true");
      assert.equal((await sceneBall("mass-invalid")).massKg, 1.234);
      await mass.press("Escape");
      await mass.fill("");
      await mass.press("Enter");
      await expect(mass).toHaveAttribute("aria-invalid", "true");
      await mass.press("Escape");
      await mass.fill("3.456");
      await page
        .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
        .focus();
      await page
        .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
        .selectOption("zh-TW");
      await page
        .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
        .selectOption("en");
      assert.equal(await mass.inputValue(), "3.456");
      assert.equal((await sceneBall("mass-locale")).massKg, 1.234);
      await mass.focus();
      const beforeCompositionRevision = await page.locator(".project-name").innerText();
      await mass.dispatchEvent("keydown", {
        key: "Enter",
        code: "Enter",
        isComposing: true,
        bubbles: true,
      });
      assert.equal(await page.locator(".project-name").innerText(), beforeCompositionRevision);
      await mass.press("Enter");
      assert.equal((await sceneBall("mass-final")).massKg, 3.456);
      const friction = page.getByRole("spinbutton", { name: "Friction coefficient", exact: true });
      await friction.fill("0.42");
      await mass.focus();
      assert.equal((await sceneBall("friction-blur")).friction, 0.42);
      return {
        enter: 1.234,
        escapeRetained: 1.234,
        localeRetainedDraft: "3.456",
        invalidRejected: true,
        blur: 0.42,
        imeProbe: "DOM isComposing guard only; no OS IME claim",
      };
    },
  );
  await check(
    "help-caller-reach",
    ["help.{callerTopic}"],
    [
      "every initial described control nonempty",
      "scroll/focus caller or disabled adjacent info",
      "Escape",
    ],
    async () => {
      await fresh();
      const groups = [];
      groups.push(...(await scanHelpCallers("editor-ball-disabled-history")));
      await button("Box +").click();
      groups.push(...(await scanHelpCallers("editor-undo-enabled")));
      await button("Undo scene command").click();
      groups.push(...(await scanHelpCallers("editor-redo-enabled")));
      await button("Listener / Environment listener.main Independent position").click();
      groups.push(...(await scanHelpCallers("editor-listener-environment")));
      await button("Import project JSON").click();
      const dialog = page.getByRole("dialog");
      await chooseFile(dialog.locator("input[type=file]"), {
        name: "help-draft.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(baseline)),
      });
      groups.push(...(await scanHelpCallers("project-import-valid-draft")));
      await dialog.getByRole("button", { name: "Cancel import", exact: true }).click();
      await fresh();
      await button("Enter first person").click();
      await page.keyboard.press("Tab");
      groups.push(...(await scanHelpCallers("fps-paused-frame-disabled")));
      await enterHeld({ low: false });
      await page.keyboard.press("Tab");
      groups.push(...(await scanHelpCallers("fps-held-paused-grab-disabled")));
      return groups;
    },
  );
  await check(
    "divider-boundaries",
    ["shell.panel-divider.{side}"],
    ["keyboard min/max clamping", "Home restoration", "pointer beyond bound"],
    async () => {
      await fresh();
      const observations = [];
      for (const [name, shrink, grow] of [
        ["Resize scene panel", "ArrowLeft", "ArrowRight"],
        ["Resize inspector", "ArrowRight", "ArrowLeft"],
      ]) {
        const s = page.getByRole("separator", { name, exact: true });
        const min = Number(await s.getAttribute("aria-valuemin")),
          max = Number(await s.getAttribute("aria-valuemax"));
        await s.press("Home");
        const home = Number(await s.getAttribute("aria-valuenow"));
        for (let i = 0; i < 55; i++) await s.press(shrink);
        assert.equal(Number(await s.getAttribute("aria-valuenow")), min);
        for (let i = 0; i < 75; i++) await s.press(grow);
        assert.equal(Number(await s.getAttribute("aria-valuenow")), max);
        await s.press("Home");
        assert.equal(Number(await s.getAttribute("aria-valuenow")), home);
        const b = await s.boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + 40);
        await page.mouse.down();
        await page.mouse.move(
          b.x + b.width / 2 + (name === "Resize scene panel" ? 600 : -600),
          b.y + 40,
          { steps: 5 },
        );
        await page.mouse.up();
        assert.equal(Number(await s.getAttribute("aria-valuenow")), max);
        await s.press("Home");
        observations.push({ name, min, max, home });
      }
      return observations;
    },
  );
  await check(
    "fps-movement-effects",
    [
      "viewport.step.{direction}",
      "viewport.look.{direction}",
      "keyboard.fps.move",
      "keyboard.fps.look",
    ],
    [
      "all movement/look buttons have visible live Listener effects",
      "WASD key down/up",
      "ShiftRight",
      "native no-lock focus",
    ],
    async () => {
      await fresh();
      const fixture = structuredClone(baseline);
      fixture.scene.listener.positionM = [0, 1.6, 3];
      await load(fixture, "movement");
      await button("Enter first person").click();
      await noLock();
      await button("Listener / Environment listener.main Follows FPS").click();
      await page.locator(".viewport-accessible-movement summary").click();
      const pose = () => page.getByRole("group", { name: "Position m", exact: true });
      const position = async () =>
        Promise.all(
          ["X", "Y", "Z"].map((a) =>
            pose().getByRole("spinbutton", { name: a, exact: true }).inputValue().then(Number),
          ),
        );
      const orientation = async () =>
        Promise.all(
          ["X", "Y", "Z"].map((a) =>
            page
              .getByRole("spinbutton", { name: "Rotation " + a, exact: true })
              .inputValue()
              .then(Number),
          ),
        );
      const observations = [];
      for (const [name, axis, sign] of [
        ["Forward", 2, -1],
        ["Backward", 2, 1],
        ["Move left", 0, -1],
        ["Move right", 0, 1],
      ]) {
        const before = await position();
        await button(name).click();
        await page.waitForTimeout(280);
        const after = await position();
        assert.ok((after[axis] - before[axis]) * sign > 0.02, name + " must move live Listener");
        observations.push({ name, before, after });
      }
      for (const name of ["Look left", "Look right", "Look up", "Look down"]) {
        const before = await orientation();
        await button(name).click();
        await expect.poll(orientation).not.toEqual(before);
        const after = await orientation();
        assert.notDeepEqual(after, before, name + " must change live Listener orientation");
        observations.push({ name, before, after });
      }
      const canvas = page.locator("canvas");
      await canvas.click();
      for (const [key, axis, sign] of [
        ["w", 2, -1],
        ["s", 2, 1],
        ["a", 0, -1],
        ["d", 0, 1],
      ]) {
        const before = await position();
        await page.keyboard.down(key);
        await page.waitForTimeout(160);
        await page.keyboard.up(key);
        await page.waitForTimeout(70);
        const after = await position();
        assert.ok((after[axis] - before[axis]) * sign > 0.02, key + " key must move live Listener");
        observations.push({ key, before, after });
      }
      const beforeSprint = await position();
      await page.keyboard.down("ShiftRight");
      await page.keyboard.down("w");
      await page.waitForTimeout(160);
      await page.keyboard.up("w");
      await page.keyboard.up("ShiftRight");
      await page.waitForTimeout(80);
      assert.ok((await position())[2] < beforeSprint[2] - 0.02);
      for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
        const before = await orientation();
        await page.keyboard.press(key);
        await expect.poll(orientation).not.toEqual(before);
      }
      return { observations, shiftRightMoves: true, allArrowLookEffects: true };
    },
  );
  for (const mode of ["translate", "rotate", "scale"])
    for (const [axis, label] of [
      [0, "X"],
      [1, "Y"],
      [2, "Z"],
    ])
      await check(
        "gizmo-" + mode + "-" + label,
        ["viewport.gizmo-drag.{mode}.{axis}"],
        [
          "rendered RGB handle",
          "real pointer drag",
          "one revision",
          "specific axis or sphere-uniform invariant",
        ],
        async () => {
          await fresh();
          await load(baseline, "axis-base");
          await focusBall();
          await page
            .getByRole("group", { name: "Transform tool", exact: true })
            .getByRole("button", {
              name: { translate: "Move", rotate: "Rotate", scale: "Scale" }[mode],
              exact: true,
            })
            .click();
          const before = await project("before-" + mode + label);
          const point = await dragAxis(axis, mode);
          const after = await project("after-" + mode + label);
          assert.equal(after.scene.sceneRevision, before.scene.sceneRevision + 1);
          const a = after.scene.objects.find((o) => o.id === "ball"),
            b = before.scene.objects.find((o) => o.id === "ball");
          if (mode === "translate") {
            assert.ok(Math.abs(a.positionM[axis] - b.positionM[axis]) > 1e-4);
            for (let j = 0; j < 3; j++)
              if (j !== axis) assert.ok(Math.abs(a.positionM[j] - b.positionM[j]) < 1e-5);
          }
          if (mode === "rotate") {
            assert.ok(Math.abs(a.orientationQuaternion[axis]) > 1e-4);
            for (let j = 0; j < 3; j++)
              if (j !== axis) assert.ok(Math.abs(a.orientationQuaternion[j]) < 1e-5);
          }
          if (mode === "scale") {
            assert.notEqual(a.dimensionsM[0], b.dimensionsM[0]);
            assert.ok(a.dimensionsM.every((v) => v >= 0.05 && v === a.dimensionsM[0]));
          }
          return { point, before: b, after: a, revision: after.scene.sceneRevision };
        },
      );
  for (const mode of ["translate", "scale", "rotate"])
    for (const handle of mode === "rotate" ? ["E", "XYZE"] : ["XY", "YZ", "XZ", "XYZ"])
      await check(
        "gizmo-extra-" + mode + "-" + handle,
        ["viewport.gizmo-drag.{mode}.{axis}"],
        [
          "visible plane/center/screen handle",
          "source-derived camera projection",
          "real drag",
          "one revision",
          "Undo restores",
        ],
        async () => {
          await fresh();
          const fixture = structuredClone(baseline);
          const box = fixture.scene.objects.find((o) => o.id === "ball");
          box.shape = "box";
          box.dimensionsM = [0.8, 0.8, 0.8];
          box.positionM = [-0.8, 2, 0];
          box.orientationQuaternion = [0, 0, 0, 1];
          box.mode = "fixed";
          await load(fixture, "extra-" + mode + handle);
          await focusBall();
          await page
            .getByRole("group", { name: "Transform tool", exact: true })
            .getByRole("button", {
              name: { translate: "Move", rotate: "Rotate", scale: "Scale" }[mode],
              exact: true,
            })
            .click();
          const before = await project("extra-before-" + mode + handle);
          const b = await page.locator("canvas").boundingBox();
          const camera = new PerspectiveCamera(50, b.width / b.height, 0.1, 500);
          const target = new Vector3(...box.positionM);
          const distance = Math.max(2.5, Math.max(...box.dimensionsM) * 2.3);
          camera.position
            .copy(target)
            .add(new Vector3(1, 0.7, 1).normalize().multiplyScalar(distance));
          camera.lookAt(target);
          camera.updateMatrixWorld();
          const scale = (distance * Math.min(1.9 * Math.tan((50 * Math.PI) / 360), 7) * 0.8) / 4;
          const projected = (offset) => {
            const p = target
              .clone()
              .add(new Vector3(...offset))
              .project(camera);
            return { x: b.x + ((p.x + 1) * b.width) / 2, y: b.y + ((1 - p.y) * b.height) / 2 };
          };
          const axes = ["X", "Y", "Z"].map((a) => handle.includes(a));
          let start = projected(
            axes.map((yes) => (yes && handle !== "XYZ" && handle !== "XYZE" ? 0.18 * scale : 0)),
          );
          let end = projected(axes.map((yes) => (yes ? 0.42 * scale : 0)));
          if (handle === "E") {
            const radius =
              (0.75 * scale * b.height) / (2 * distance * Math.tan((50 * Math.PI) / 360));
            start = { x: b.x + b.width / 2 + radius, y: b.y + b.height / 2 };
            end = { x: start.x - 18, y: start.y + 32 };
          }
          if ((handle === "XYZ" && mode === "scale") || handle === "XYZE") {
            const offset = handle === "XYZE" ? 0.08 : 0.025;
            start.x +=
              (offset * scale * b.height) / (2 * distance * Math.tan((50 * Math.PI) / 360));
          }
          if (handle === "XYZ" || handle === "XYZE") end = { x: start.x + 35, y: start.y - 30 };
          await page.mouse.move(start.x, start.y);
          await page
            .locator("canvas")
            .screenshot({ path: path.join(out, "extra-" + mode + handle + "-hover.png") });
          await page.mouse.down();
          await page.mouse.move(end.x, end.y, { steps: 8 });
          await page.mouse.up();
          await page.waitForTimeout(180);
          const after = await project("extra-after-" + mode + handle);
          assert.equal(after.scene.sceneRevision, before.scene.sceneRevision + 1);
          const a = after.scene.objects.find((o) => o.id === "ball");
          if (mode === "translate") {
            assert.deepEqual(a.orientationQuaternion, box.orientationQuaternion);
            assert.deepEqual(a.dimensionsM, box.dimensionsM);
            if (handle === "XYZ") {
              const delta = new Vector3(...a.positionM).sub(new Vector3(...box.positionM));
              assert.ok(delta.length() > 1e-4);
              assert.ok(Math.abs(delta.dot(new Vector3(1, 0.7, 1).normalize())) < 1e-5);
            }
            for (let i = 0; i < 3; i++) {
              if (axes[i] || handle === "XYZ")
                assert.ok(Math.abs(a.positionM[i] - box.positionM[i]) > 1e-5);
              else assert.ok(Math.abs(a.positionM[i] - box.positionM[i]) < 1e-5);
            }
          } else if (mode === "scale") {
            assert.deepEqual(a.positionM, box.positionM);
            assert.deepEqual(a.orientationQuaternion, box.orientationQuaternion);
            for (let i = 0; i < 3; i++) {
              if (axes[i]) assert.ok(Math.abs(a.dimensionsM[i] - box.dimensionsM[i]) > 1e-5);
              else assert.ok(Math.abs(a.dimensionsM[i] - box.dimensionsM[i]) < 1e-5);
            }
            if (handle === "XYZ")
              assert.ok(Math.max(...a.dimensionsM) - Math.min(...a.dimensionsM) < 1e-5);
          } else {
            assert.deepEqual(a.positionM, box.positionM);
            assert.deepEqual(a.dimensionsM, box.dimensionsM);
            const rotation = new Vector3(...a.orientationQuaternion.slice(0, 3));
            assert.ok(rotation.length() > 1e-4);
            assert.ok(Math.abs(Math.hypot(...a.orientationQuaternion) - 1) < 1e-5);
            const eye = new Vector3(1, 0.7, 1).normalize();
            if (handle === "E") assert.ok(rotation.clone().normalize().cross(eye).length() < 1e-4);
            if (handle === "XYZE") assert.ok(Math.abs(rotation.dot(eye)) < 1e-4);
          }
          await button("Undo scene command").click();
          const undone = await project("extra-undo-" + mode + handle);
          assert.deepEqual(
            undone.scene.objects.find((o) => o.id === "ball"),
            box,
          );
          return { handle, start, end, before: box, after: a, undoRestored: true };
        },
      );
  await check(
    "gizmo-group-lifecycle",
    ["scene.undo", "scene.redo", "object.remove", "viewport.gizmo-drag.{mode}.{axis}"],
    [
      "selected group Add/Undo/Redo/Delete",
      "live helper survives same-ID remount",
      "no detached-group console errors",
    ],
    async () => {
      await fresh();
      await load(baseline, "lifecycle-base");
      const initialCount = await rows().count();
      const operations = [];
      for (const primitive of ["Box +", "Sphere +", "Capsule +"]) {
        await button(primitive).click();
        await expect.poll(() => rows().count()).toBe(initialCount + 1);
        const addedScene = (await project("lifecycle-added-" + primitive.slice(0, -2))).scene;
        const added = addedScene.objects.find(
          (o) => !baseline.scene.objects.some((b) => b.id === o.id),
        );
        assert.ok(added, "the UI export identifies the new stable object ID");
        const selected = added.id;
        const selectedName = new RegExp(
          "^" + selected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\s|$)",
        );
        await expect(rows(selectedName)).toHaveAttribute("aria-pressed", "true");
        await button("Frame selection").click();
        await button("Undo scene command").click();
        await expect.poll(() => rows().count()).toBe(initialCount);
        await page.waitForTimeout(180);
        await button("Redo scene command").click();
        await expect.poll(() => rows().count()).toBe(initialCount + 1);
        await rows(selectedName).click();
        await button("Frame selection").click();
        await button("Delete").click();
        await expect.poll(() => rows().count()).toBe(initialCount);
        await page.waitForTimeout(180);
        operations.push({
          primitive,
          selected,
          undoRemoved: true,
          redoRemounted: true,
          deleteRemoved: true,
        });
      }
      await rows(/^ball /).click();
      await button("Frame selection").click();
      const before = await project("lifecycle-gizmo-before");
      await dragAxis(0, "translate");
      const after = await project("lifecycle-gizmo-after");
      assert.equal(after.scene.sceneRevision, before.scene.sceneRevision + 1);
      assert.notEqual(
        after.scene.objects.find((o) => o.id === "ball").positionM[0],
        before.scene.objects.find((o) => o.id === "ball").positionM[0],
      );
      await page.waitForTimeout(250);
      return { operations, nextGizmoCommittedOnce: true };
    },
  );
  await check(
    "gizmo-cancel",
    ["viewport.gizmo-drag.{mode}.{axis}", "input.interruption"],
    ["Escape", "DOM pointercancel", "real browser tab blur"],
    async () => {
      const observations = [];
      for (const cause of ["Escape", "pointercancel", "blur"]) {
        await fresh();
        await load(baseline, "cancel-base");
        await focusBall();
        const before = await project("cancel-before-" + cause);
        await dragAxis(0, "translate", cause);
        const after = await project("cancel-after-" + cause);
        assert.deepEqual(after.scene, before.scene);
        observations.push({
          cause,
          sceneUnchanged: true,
          method:
            cause === "pointercancel"
              ? "DOM PointerEvent cancellation"
              : "real input/browser focus",
        });
      }
      return observations;
    },
  );
  await check(
    "observer-gesture-regression",
    ["viewport.orbit", "viewport.pan", "viewport.zoom"],
    [
      "Alt+left",
      "Alt released mid-drag",
      "middle/right drag",
      "unexpected releasePointerCapture",
      "actual tab switch clears native orbit via capture loss",
      "explicit DOM blur handler probe, no OS focus claim",
      "no scene mutation",
    ],
    async () => {
      await fresh();
      await load(baseline, "observer-base");
      await focusBall();
      const before = await project("observer-before");
      const canvas = page.locator("canvas");
      const b = await canvas.boundingBox();
      const cx = b.x + b.width / 2,
        cy = b.y + b.height / 2;
      let changed = false;
      for (const releaseAlt of [false, true]) {
        const pixels = await cameraPixels();
        await page.keyboard.down("Alt");
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 25, cy + 12, { steps: 4 });
        if (releaseAlt) await page.keyboard.up("Alt");
        await page.mouse.move(cx + 45, cy + 20, { steps: 4 });
        await page.mouse.up();
        await page.keyboard.up("Alt");
        changed ||= pixels !== (await cameraPixels());
      }
      for (const buttonName of ["middle", "right"]) {
        await page.mouse.move(cx, cy);
        await page.mouse.down({ button: buttonName });
        await page.mouse.move(cx + 25, cy + 12, { steps: 4 });
        await page.mouse.up({ button: buttonName });
      }
      await page.mouse.wheel(0, -120);
      const normalSettle = await settleCamera();
      assert.ok(changed);
      assert.deepEqual((await project("observer-after-normal")).scene, before.scene);
      await page.locator("canvas").evaluate((c) => {
        c.dataset.auditEvents = "[]";
        for (const type of ["blur", "focus", "visibilitychange"]) {
          (type === "visibilitychange" ? document : window).addEventListener(type, () => {
            const events = JSON.parse(c.dataset.auditEvents);
            events.push({
              type,
              visibility: document.visibilityState,
              focused: document.hasFocus(),
              time: performance.now(),
            });
            c.dataset.auditEvents = JSON.stringify(events);
          });
        }
        for (const type of [
          "pointerdown",
          "pointermove",
          "pointerup",
          "gotpointercapture",
          "lostpointercapture",
        ]) {
          c.addEventListener(
            type,
            (e) => {
              const events = JSON.parse(c.dataset.auditEvents);
              events.push({
                type: e.type,
                pointerId: e.pointerId,
                buttons: e.buttons,
                x: e.clientX,
                y: e.clientY,
                captured: c.hasPointerCapture(e.pointerId),
                time: performance.now(),
              });
              c.dataset.auditEvents = JSON.stringify(events);
            },
            { capture: true },
          );
        }
        c.addEventListener(
          "pointerdown",
          (e) => {
            c.dataset.auditPointerId = String(e.pointerId);
          },
          { once: true, capture: true },
        );
      });
      await page.keyboard.down("Alt");
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 20, cy + 10, { steps: 3 });
      await canvas.evaluate((c) => c.releasePointerCapture(Number(c.dataset.auditPointerId)));
      await page.waitForTimeout(80);
      const lossSettle = await settleCamera();
      const releasedPixels = lossSettle.hash;
      await canvas.screenshot({ path: path.join(out, "observer-lostcapture-before.png") });
      await page.mouse.move(cx + 45, cy + 25, { steps: 4 });
      await page.waitForTimeout(80);
      await canvas.screenshot({ path: path.join(out, "observer-lostcapture-after.png") });
      await writeFile(
        path.join(out, "observer-lostcapture-dom-events.json"),
        await canvas.getAttribute("data-audit-events"),
      );
      assert.equal(
        await cameraPixels(true),
        releasedPixels,
        "lost capture must stop orbit movement",
      );
      await page.mouse.up();
      await page.keyboard.up("Alt");
      assert.deepEqual((await project("observer-after-capture-loss")).scene, before.scene);
      await page.keyboard.down("Alt");
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 20, cy + 5, { steps: 3 });
      const other = await context.newPage();
      await other.bringToFront();
      await other.close();
      await page.bringToFront();
      await page.keyboard.up("Alt");
      const blurSettle = await settleCamera();
      const blurredPixels = blurSettle.hash;
      await canvas.screenshot({ path: path.join(out, "observer-blur-before.png") });
      await page.mouse.move(cx + 55, cy + 20, { steps: 4 });
      await page.mouse.up();
      await canvas.screenshot({ path: path.join(out, "observer-blur-after.png") });
      await writeFile(
        path.join(out, "observer-blur-dom-events.json"),
        await canvas.getAttribute("data-audit-events"),
      );
      await writeFile(
        path.join(out, "observer-blur-dom-state.json"),
        JSON.stringify(
          await canvas.evaluate((c) => ({
            bbox: c.getBoundingClientRect().toJSON(),
            visibility: document.visibilityState,
            focused: document.hasFocus(),
          })),
          null,
          2,
        ),
      );
      await writeFile(
        path.join(out, "observer-settle.json"),
        JSON.stringify({ normalSettle, lossSettle, blurSettle }, null, 2),
      );
      assert.equal(await cameraPixels(true), blurredPixels, "blur must stop orbit movement");
      const afterBlurProject = await project("observer-after-blur-probe");
      await writeFile(
        path.join(out, "observer-blur-scene-unchanged.json"),
        JSON.stringify(
          {
            sceneUnchanged: JSON.stringify(afterBlurProject.scene) === JSON.stringify(before.scene),
          },
          null,
          2,
        ),
      );

      assert.deepEqual((await project("observer-after-blur")).scene, before.scene);
      const tabEvents = JSON.parse(await canvas.getAttribute("data-audit-events"));
      await page.keyboard.down("Alt");
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 15, cy + 10, { steps: 3 });
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.keyboard.up("Alt");
      const domBlurSettle = await settleCamera();
      await page.mouse.move(cx + 40, cy + 25, { steps: 3 });
      await page.mouse.up();
      assert.equal(
        await cameraPixels(true),
        domBlurSettle.hash,
        "explicit DOM blur handler must stop orbit movement",
      );
      assert.deepEqual((await project("observer-after-dom-blur")).scene, before.scene);
      await focusBall();
      const recoveredBefore = await project("observer-recovered-gizmo-before");
      await dragAxis(0, "translate");
      const recoveredAfter = await project("observer-recovered-gizmo-after");
      assert.equal(recoveredAfter.scene.sceneRevision, recoveredBefore.scene.sceneRevision + 1);
      return {
        settle: { normalSettle, lossSettle, blurSettle },
        nextGizmoRecovered: true,
        maskedCentralGizmoHoverInCameraHash: true,
        cameraResponded: true,
        sceneUnchanged: true,
        modifierReleaseSafe: true,
        lostCaptureStopped: true,
        actualTabSwitchStopped: true,
        tabSwitchNativeBlurObserved: tabEvents.some((e) => e.type === "blur"),
        tabSwitchLostCaptureObserved: tabEvents.some((e) => e.type === "lostpointercapture"),
        explicitDomBlurHandlerStopped: true,
        nativeOsFocusVerification: "NOT_PROVEN; DOM blur branch is explicitly synthetic",
      };
    },
  );
  await check(
    "canvas-selection",
    ["viewport.select-object.{objectId}", "viewport.select-path.{pathId}"],
    [
      "click rendered ball",
      "independent camera math for direct path point",
      "shared DOM selected path",
    ],
    async () => {
      await fresh();
      await focusBall();
      const c = await page.locator("canvas").boundingBox();
      await page.mouse.click(c.x + 15, c.y + 15);
      await expect(rows(/^ball /)).toHaveAttribute("aria-pressed", "false");
      await page.waitForTimeout(100);
      await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
      await expect(rows(/^ball /)).toHaveAttribute("aria-pressed", "true");
      await fresh();
      await page.getByRole("tab", { name: /^Acoustic paths / }).click();
      await expect.poll(() => page.locator(".path-table tbody tr").count()).toBeGreaterThan(0);
      await page.waitForTimeout(100);
      const canvas = await page.locator("canvas").boundingBox();
      const camera = new PerspectiveCamera(50, canvas.width / canvas.height, 0.05, 250);
      camera.position.set(8, 6, 10);
      camera.lookAt(0, 1, 0);
      camera.updateMatrixWorld();
      const p = new Vector3(0.15, 1.57, 3.4).project(camera);
      await page.mouse.click(
        canvas.x + ((p.x + 1) * canvas.width) / 2,
        canvas.y + ((1 - p.y) * canvas.height) / 2,
      );
      await expect(page.locator(".path-table tbody tr.is-selected")).toHaveCount(1);
      return {
        ballSelectedThroughCanvas: true,
        selectedPath: await page.locator(".path-table tbody tr.is-selected").innerText(),
      };
    },
  );
  await check(
    "gentle-place-success",
    ["viewport.gentle-place", "viewport.drop"],
    ["UI button while held", "real bounded lower/drop", "no scene command"],
    async () => {
      await enterHeld();
      await noLock();
      await expect(button("Gentle place")).toBeEnabled();
      await button("Gentle place").click();
      await expect(rows("ball Held")).toHaveCount(0, { timeout: 10000 });
      await expect(button("Release")).toBeDisabled();
      await enterHeld();
      await page.keyboard.press("g");
      await expect(rows("ball Held")).toHaveCount(0, { timeout: 10000 });
      return { boundedDropCompleted: true, nativeKeyboardGCompleted: true };
    },
  );
  await check(
    "gentle-place-refusal",
    ["viewport.gentle-place"],
    ["missing support is explicit", "object remains held", "no fabricated success"],
    async () => {
      await enterHeld({ support: false });
      await noLock();
      await button("Gentle place").click();
      await expect(page.locator(".status-banner")).toContainText("No valid support surface");
      await expect(rows("ball Held")).toBeVisible();
      await expect(button("Release")).toBeEnabled();
      return { rejectedWithoutRelease: true };
    },
  );
  await check(
    "fps-actions-and-reacquire",
    [
      "keyboard.fps.actions",
      "keyboard.fps.escape",
      "keyboard.fps.tab",
      "viewport.reacquire-pointer",
      "pointer.fps.actions",
    ],
    [
      "F freeze/unfreeze",
      "B cancel",
      "Escape native release",
      "explicit lock reacquisition",
      "right preview release",
    ],
    async () => {
      await enterHeld({ low: false });
      await page.keyboard.press("f");
      await expect(rows("ball Fixed")).toBeVisible();
      await expect(page.locator(".status-banner")).toContainText(
        "The object is fixed; explicitly resume",
      );
      await page.keyboard.press("Enter");
      await expect(page.locator(".run-status")).toContainText("Running");
      await page.keyboard.press("f");
      await expect(rows("ball 0 g")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect
        .poll(() => page.evaluate(() => Boolean(document.pointerLockElement)))
        .toBe(false);
      await page.waitForTimeout(1300);
      await button("Enable mouse control").click();
      await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);
      if (!(await page.locator(".run-status").innerText()).includes("Running")) {
        await page.keyboard.press("Enter");
      }
      await expect(page.locator(".run-status")).toContainText("Running");
      const beforeCancel = await rows().count();
      await page.mouse.down({ button: "right" });
      await expect(button("Cancel placement")).toBeVisible();
      await page.keyboard.press("b");
      await expect(button("Cancel placement")).toHaveCount(0);
      await page.mouse.up({ button: "right" });
      await expect.poll(() => rows().count()).toBe(beforeCancel);
      await page.keyboard.press("Shift+Tab");
      await expect
        .poll(() => page.evaluate(() => Boolean(document.pointerLockElement)))
        .toBe(false);
      return { freezeUnfreeze: true, explicitReacquire: true, tabSafe: true };
    },
  );
  await check(
    "native-pointer-actions",
    [
      "pointer.fps.actions",
      "viewport.start-placement",
      "viewport.place",
      "viewport.cancel-placement",
    ],
    [
      "left grab/throw",
      "right drop",
      "right down preview/right up atomic place",
      "R/wheel ghost control",
    ],
    async () => {
      await enterHeld({ low: false });
      await page.mouse.down({ button: "right" });
      await page.mouse.up({ button: "right" });
      await expect(rows("ball Held")).toHaveCount(0);
      await page.mouse.down();
      await page.mouse.up();
      await expect(rows("ball Held")).toBeVisible();
      await page.mouse.down();
      await page.mouse.up();
      await expect(rows("ball Held")).toHaveCount(0);
      await fresh();
      await load(baseline, "right-preview");
      await button("Enter first person").click();
      const before = await rows().count();
      await page.mouse.down({ button: "right" });
      await expect(button("Cancel placement")).toBeVisible();
      await page.mouse.wheel(0, -100);
      await page.keyboard.press("r");
      await page.mouse.move(850, 570, { steps: 4 });
      await expect(button("Place")).toBeEnabled();
      await page.mouse.up({ button: "right" });
      await expect.poll(() => rows().count()).toBe(before + 1);
      await page.keyboard.press("Tab");
      const placedScene = (await project("native-right-rotated")).scene;
      const added = placedScene.objects.find(
        (o) => !baseline.scene.objects.some((b) => b.id === o.id),
      );
      assert.ok(added);
      assert.ok(Math.abs(added.orientationQuaternion[1]) > 0.001);
      return {
        nativeGrabDropThrow: true,
        rightReleasePlacedOne: true,
        placedRotation: added.orientationQuaternion,
      };
    },
  );
  await check(
    "native-paused-click-resume",
    ["pointer.fps.actions"],
    [
      "paused primary down/release resumes only",
      "held preserved",
      "pause cancels preview without placing per current policy",
    ],
    async () => {
      await enterHeld({ low: false });
      await page.keyboard.press("Enter");
      await expect(page.locator(".run-status")).toContainText("Paused");
      await page.mouse.down();
      await expect(page.locator(".run-status")).toContainText("Paused");
      await page.mouse.up();
      await expect(page.locator(".run-status")).toContainText("Running");
      await expect(rows("ball Held")).toBeVisible();
      await fresh();
      await load(baseline, "paused-preview");
      await button("Enter first person").click();
      await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);
      await expect(page.locator(".run-status")).toContainText("Running");
      const before = await rows().count();
      await page.mouse.down({ button: "right" });
      await expect(button("Cancel placement")).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.locator(".run-status")).toContainText("Paused");
      await expect(button("Cancel placement")).toHaveCount(0);
      await page.mouse.up({ button: "right" });
      await page.mouse.down();
      await expect(page.locator(".run-status")).toContainText("Paused");
      await page.mouse.up();
      await expect(page.locator(".run-status")).toContainText("Running");
      await expect(button("Cancel placement")).toHaveCount(0);
      assert.equal(await rows().count(), before);
      return {
        heldNotThrown: true,
        previewCancelledByPauseWithoutPlacement: true,
        primaryReleaseDidNotRecreatePreview: true,
        explicitReleaseResumed: true,
      };
    },
  );
  await check(
    "modifier-wheel-browser-ownership",
    ["viewport.zoom"],
    ["real Ctrl/Meta wheel", "DOM default not prevented", "scene unchanged"],
    async () => {
      await fresh();
      const before = await project("modifier-wheel-before");
      const canvas = page.locator("canvas");
      const bounds = await canvas.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.evaluate(() => {
        document.addEventListener(
          "wheel",
          (event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            queueMicrotask(() => {
              document.body.dataset.auditWheelDefaultPrevented = String(event.defaultPrevented);
            });
          },
          { capture: true },
        );
      });
      const observations = [];
      for (const modifier of ["Control", "Meta"]) {
        await page.locator("body").evaluate((e) => delete e.dataset.auditWheelDefaultPrevented);
        await page.keyboard.down(modifier);
        await page.mouse.wheel(0, -100);
        await page.keyboard.up(modifier);
        await expect(page.locator("body")).toHaveAttribute(
          "data-audit-wheel-default-prevented",
          "false",
        );
        observations.push({
          modifier,
          defaultPrevented: false,
          ...(await page.evaluate(() => ({
            devicePixelRatio,
            visualViewportScale: visualViewport?.scale,
          }))),
        });
      }
      await page.keyboard.press("Control+0");
      assert.deepEqual((await project("modifier-wheel-after")).scene, before.scene);
      return {
        observations,
        limitation: "Native Windows Command zoom is not claimed; Meta verifies DOM routing only.",
      };
    },
  );
  await check(
    "input-ime-blur-hidden",
    ["input.interruption"],
    [
      "DOM compositionstart guard",
      "real tab switch event observation",
      "explicit DOM blur handler",
      "no auto-resume",
    ],
    async () => {
      await fresh();
      await button("Enter first person").click();
      await page.keyboard.press("Tab");
      await button("Enable controls without pointer lock").click();
      await button("Start first-person controls").click();
      await page.locator("canvas").focus();
      await page.locator("canvas").dispatchEvent("compositionstart", { data: "測", bubbles: true });
      await expect(page.locator(".run-status")).toContainText("Paused");
      await page.locator("canvas").dispatchEvent("compositionend", { data: "測", bubbles: true });
      await button("Start first-person controls").click();
      await page.keyboard.down("w");
      await page.evaluate(() => {
        document.body.dataset.auditFocusEvents = "[]";
        for (const type of ["blur", "focus", "visibilitychange"])
          (type === "visibilitychange" ? document : window).addEventListener(type, (event) => {
            const events = JSON.parse(document.body.dataset.auditFocusEvents);
            events.push({
              type,
              isTrusted: event.isTrusted,
              visibility: document.visibilityState,
              hasFocus: document.hasFocus(),
            });
            document.body.dataset.auditFocusEvents = JSON.stringify(events);
          });
      });
      const other = await context.newPage();
      await other.bringToFront();
      const visibility = await page.evaluate(() => document.visibilityState);
      const nativeTabPaused = (await page.locator(".run-status").innerText()).includes("Paused");
      await other.close();
      await page.bringToFront();
      const nativeEvents = JSON.parse(
        await page.locator("body").getAttribute("data-audit-focus-events"),
      );
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await expect(page.locator(".run-status")).toContainText("Paused");
      await page.keyboard.up("w");
      await expect(page.locator(".run-status")).toContainText("Paused");
      return {
        compositionProbe: "DOM dispatch only, no OS IME claim",
        visibility,
        nativeTabPaused,
        nativeEvents,
        nativeOsFocusVerification: nativeEvents.length
          ? "SEE_RECORDED_EVENTS"
          : "NOT_PROVEN: automation tab switch emitted no native focus/visibility events",
        explicitDomBlurPaused: true,
        noAutomaticResume: true,
      };
    },
  );
  if (!selectedCases.size || selectedCases.has("webgl-retry-fallback")) {
    environmentWebglDisabled = true;
    await context.tracing
      .stop({ path: path.join(cache, "trace-normal-final.zip") })
      .catch(() => {});
    await context.close();
    context = null;
    await browser.close();
    browser = await chromium.launch({
      channel: "chrome",
      headless: process.env.INTERACTION_HEADED !== "1",
      args: ["--disable-webgl"],
    });
    await fresh();
    await check(
      "webgl-retry-fallback",
      ["viewport.retry-webgl"],
      ["actual unavailable WebGL environment", "Retry 3D rendering", "object list remains usable"],
      async () => {
        const retry = button("Retry 3D rendering");
        await expect(retry).toBeVisible();
        await retry.click();
        await expect(retry).toBeVisible();
        assert.equal(await rows().count(), 6);
        await rows(/^ball /).click();
        await expect(button("Frame selection")).toBeVisible();
        return {
          retryAttempted: true,
          unavailableReason: await page.locator(".viewport-fallback").innerText(),
          numericAndObjectListUsable: true,
          limitation:
            "WebGL intentionally disabled, so retry remains an explicit failure rather than pretending rendering recovered.",
        };
      },
    );
  }
} catch (e) {
  receipt.fatal = String(e);
} finally {
  if (context) {
    await context.tracing.stop({ path: path.join(cache, "trace-final.zip") }).catch(() => {});
    await context.close();
  }
  await browser?.close();
}
receipt.finishedAtUtc = new Date().toISOString();
receipt.summary = {
  passed: receipt.checks.filter((c) => c.status === "PASS").length,
  failed: receipt.checks.filter((c) => c.status === "FAIL").length,
  total: receipt.checks.length,
};
receipt.status =
  receipt.fatal || receipt.summary.failed || receipt.consoleErrors.length ? "FAIL" : "PASS";
receipt.bundles = [...new Set(receipt.bundles)];
receipt.source = [];
for (const file of [
  "src/ui/App.tsx",
  "src/ui/contracts.ts",
  "src/ui/status-feedback.ts",
  "src/ui/Viewport.tsx",
  "src/ui/viewport/CameraRig.tsx",
  "src/ui/viewport/TransformGizmo.tsx",
  "src/ui/viewport/SceneEntities.tsx",
  "src/ui/viewport/gizmo-group-lifecycle.test.ts",
  "src/ui/viewport/observer-gesture.ts",
  "src/ui/HelpTip.tsx",
  "src/ui/ProjectImport.tsx",
  "tests/browser/parameter-audit/interaction-completion.mjs",
]) {
  receipt.source.push({ path: file, sha256: sha(await readFile(file)) });
}
await writeFile(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      summary: receipt.summary,
      evidenceDirectory: receipt.evidenceDirectory,
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
