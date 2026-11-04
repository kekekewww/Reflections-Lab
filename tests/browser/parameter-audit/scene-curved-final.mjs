import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
const sourcePin = process.env.CURVED_UI_SOURCE_COMMIT;
const entry = process.env.CURVED_UI_ENTRY;
const selectedChecks = process.env.CURVED_UI_FILTER?.split(",").filter(Boolean);
if (!process.argv.includes("--run") || !sourcePin || !entry)
  throw new Error(
    "Explicit root browser lease, --run, CURVED_UI_SOURCE_COMMIT and CURVED_UI_ENTRY are required.",
  );
const out = path.resolve(
  process.env.CURVED_UI_OUT ||
    "docs/14-core-pipeline/stages/11-ui-parameters/scene/curved-final-" + sourcePin.slice(0, 7),
);
await mkdir(out, { recursive: true });
await mkdir(path.join(out, "downloads"), { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const summary = {
  kind: "CURVED_ACOUSTIC_PARAMETER_REAL_UI",
  status: "RUNNING",
  sourceCommit: sourcePin,
  entry,
  observedGitHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  startedAt: new Date().toISOString(),
  method:
    "Production DOM pointer/keyboard/inputs/imports/downloads only; no internal controller/test bridge. Solver evidence comes from actually exported recordings.",
  checks: [],
  failures: [],
  artifacts: [],
  assets: [],
  pageErrors: [],
  consoleErrors: [],
  limits: [
    "Finite first-order geometric/ray-path approximation; no calibrated sound, full-wave, Doppler, hearing or performance acceptance claim.",
  ],
};
let browser,
  context,
  page,
  artifactCounter = 0;
const persist = () =>
  writeFile(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
async function checkpoint(id, families, fn) {
  if (selectedChecks && !selectedChecks.includes(id)) {
    summary.checks.push({ id, semanticFamilyIds: families, status: "NOT_RUN_FILTERED" });
    return;
  }
  const result = { id, semanticFamilyIds: families, status: "RUNNING" };
  summary.checks.push(result);
  try {
    await fn(result);
    result.status = "PASS";
  } catch (e) {
    result.status = "FAIL";
    result.error = String(e.stack || e);
    summary.failures.push({ id, error: result.error });
    await page.screenshot({
      path: path.join(out, id.replace(/[^a-z0-9.-]/gi, "-") + "-fail.png"),
      fullPage: true,
    });
  }
  await persist();
}
const inspector = () =>
  page.getByRole("complementary", { name: "Property inspector", exact: true });
const field = (name) => inspector().getByRole("spinbutton", { name, exact: true });
async function revision() {
  return Number(/Scene rev\s+(\d+)/.exec(await page.getByRole("banner").innerText())?.[1]);
}
async function waitChange(before) {
  await expect.poll(revision, { timeout: 20000 }).toBeGreaterThan(before);
  await page.waitForTimeout(40);
  await expect
    .poll(() => page.getByRole("contentinfo").innerText(), { timeout: 20000 })
    .not.toContain("Acoustic update pending");
}
async function openContext() {
  context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    acceptDownloads: true,
  });
  page = await context.newPage();
  page.on("pageerror", (e) => summary.pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") summary.consoleErrors.push(m.text());
  });
  page.on("response", async (r) => {
    if (/\/assets\/.*\.(js|css)$/.test(r.url())) {
      try {
        const b = await r.body();
        summary.assets.push({ url: r.url(), bytes: b.length, sha256: sha(b) });
      } catch {}
    }
  });
  await page.route("**/*", (r) => {
    const u = new URL(r.request().url());
    return ["http:", "https:"].includes(u.protocol) && u.origin !== "http://127.0.0.1:4173"
      ? r.abort("blockedbyclient")
      : r.continue();
  });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
  assert.ok(
    (await page.locator("script[src]").evaluateAll((ns) => ns.map((n) => n.src))).some((s) =>
      s.endsWith(entry),
    ),
    "exact declared served entry",
  );
  await inspector().waitFor();
}
async function download(button, label) {
  const [d] = await Promise.all([page.waitForEvent("download"), button.click()]);
  const b = await readFile(await d.path());
  const file = "downloads/" + String(++artifactCounter).padStart(3, "0") + "-" + label + ".json";
  await writeFile(path.join(out, file), b);
  summary.artifacts.push({
    path: file,
    bytes: b.length,
    sha256: sha(b),
    origin: "actual UI download",
  });
  return { value: JSON.parse(b), file: path.join(out, file) };
}
const project = (label) =>
  download(page.getByRole("button", { name: "Export project", exact: true }), label);
async function importProject(file) {
  await page.getByRole("button", { name: "Import project JSON", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Import project JSON", exact: true });
  await dialog.locator("input[type=file]").setInputFiles(file);
  await dialog.getByRole("button", { name: "Apply and open project", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.waitForTimeout(40);
}
async function selectObject(id) {
  await page
    .getByRole("list", { name: "Scene object list" })
    .getByRole("button", { name: new RegExp("^" + id.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + " ") })
    .click();
  await inspector().getByRole("heading", { name: id, exact: true }).waitFor();
}
async function commitNumber(loc, value) {
  if (Number(await loc.inputValue()) === value) return;
  const before = await revision();
  await loc.click();
  await loc.fill(String(value));
  await loc.press("Enter");
  await waitChange(before);
}
async function setOption(loc, value) {
  if ((await loc.inputValue()) === value) return;
  const before = await revision();
  await loc.focus();
  await loc.selectOption(value);
  await waitChange(before);
}
async function shapeControls(id, shape, result) {
  const material = inspector().getByRole("combobox", { name: "Acoustic material", exact: true }),
    role = inspector().getByRole("combobox", { name: "Acoustic role", exact: true }),
    mode = inspector().getByRole("combobox", { name: "Rigid body mode", exact: true });
  assert.equal(await material.isEnabled(), true);
  assert.equal(await role.isEnabled(), true);
  assert.match(await inspector().innerText(), /analytic occlusion/);
  result.materials = [];
  for (const value of ["material.soft", "material.wood", "material.metal", "material.hard"]) {
    await setOption(material, value);
    const data = (await project(shape + "-" + value)).value;
    assert.equal(data.scene.objects.find((o) => o.id === id).acousticMaterialId, value);
    result.materials.push(value);
  }
  let before = await revision();
  await material.focus();
  await material.press("End");
  await material.press("Enter");
  await waitChange(before);
  assert.equal(
    (await project(shape + "-keyboard-material")).value.scene.objects.find((o) => o.id === id)
      .acousticMaterialId,
    "material.metal",
  );
  await setOption(mode, "fixed");
  result.roles = [];
  for (const value of ["none", "dynamicOccluder", "dynamicReflector", "staticSurface"]) {
    await setOption(role, value);
    assert.equal(
      (await project(shape + "-" + value)).value.scene.objects.find((o) => o.id === id)
        .acousticRole,
      value,
    );
    result.roles.push(value);
  }
  before = await revision();
  await role.focus();
  await role.press("End");
  await role.press("Enter");
  await waitChange(before);
  assert.equal(
    (await project(shape + "-keyboard-role")).value.scene.objects.find((o) => o.id === id)
      .acousticRole,
    "dynamicReflector",
  );
  assert.match(await inspector().innerText(), /quasi-static snapshot/);
  const old = "material.metal";
  await setOption(material, "material.soft");
  before = await revision();
  await page.getByRole("button", { name: "Undo scene command", exact: true }).click();
  await waitChange(before);
  assert.equal(
    (await project(shape + "-undo")).value.scene.objects.find((o) => o.id === id)
      .acousticMaterialId,
    old,
  );
  before = await revision();
  await page.getByRole("button", { name: "Redo scene command", exact: true }).click();
  await waitChange(before);
  assert.equal(
    (await project(shape + "-redo")).value.scene.objects.find((o) => o.id === id)
      .acousticMaterialId,
    "material.soft",
  );
  await setOption(mode, "kinematic");
  const committedKinematic = (
    await project(shape + "-kinematic-mode-proof")
  ).value.scene.objects.find((o) => o.id === id);
  assert.equal(committedKinematic.mode, "kinematic");
  const staticGuard = await role.locator('option[value="staticSurface"]').evaluate((e) => ({
    disabled: e.disabled,
    hasAttribute: e.hasAttribute("disabled"),
    outerHTML: e.outerHTML,
  }));
  assert.equal(staticGuard.disabled, true);
  assert.equal(staticGuard.hasAttribute, true);
  result.staticSurfaceGuard = { mode: committedKinematic.mode, ...staticGuard };
  await setOption(role, "dynamicReflector");
  assert.equal(
    (await project(shape + "-kinematic-reflector")).value.scene.objects.find((o) => o.id === id)
      .acousticRole,
    "dynamicReflector",
  );
  result.keyboard = true;
  result.undoRedo = true;
}
async function dimensions(id, shape, result) {
  const diameter = field("Diameter m");
  const height = shape === "capsule" ? field("Height m") : null;
  for (const value of [0.01, 100, shape === "capsule" ? 1 : 2]) {
    if (height) {
      await commitNumber(height, 100);
      await commitNumber(diameter, value);
    } else await commitNumber(diameter, value);
    const object = (await project(shape + "-diameter-" + value)).value.scene.objects.find(
      (o) => o.id === id,
    );
    assert.equal(object.dimensionsM[0], value);
    assert.equal(object.dimensionsM[2], value);
    if (!height) assert.equal(object.dimensionsM[1], value);
  }
  if (height) {
    await commitNumber(height, 1);
    await commitNumber(diameter, 0.01);
    await commitNumber(height, 0.01);
    assert.deepEqual(
      (await project("capsule-min-both")).value.scene.objects.find((o) => o.id === id).dimensionsM,
      [0.01, 0.01, 0.01],
    );
    await commitNumber(height, 4);
    await commitNumber(diameter, 2);
  }
  const stable = (await project(shape + "-before-invalid")).value.scene.objects.find(
    (o) => o.id === id,
  ).dimensionsM;
  for (const [loc, raw] of [
    [diameter, "-1"],
    [diameter, "101"],
    [diameter, ""],
    [diameter, "1e309"],
    ...(height
      ? [
          [height, "0.1"],
          [diameter, "5"],
        ]
      : []),
  ]) {
    const before = await revision();
    await loc.fill(raw);
    await loc.press("Enter");
    await expect(loc).toHaveAttribute("aria-invalid", "true");
    assert.equal(await revision(), before);
    await loc.press("Escape");
  }
  assert.deepEqual(
    (await project(shape + "-after-invalid")).value.scene.objects.find((o) => o.id === id)
      .dimensionsM,
    stable,
  );
  result.bounds = { min: 0.01, max: 100 };
  result.invalidPreserved = true;
}
async function fixture(base, shape, material = "material.hard", moving = false) {
  const p = structuredClone(base);
  const speaker = p.scene.objects.find((o) => o.id === "speaker");
  const reflector = structuredClone(p.scene.objects.find((o) => o.shape === "sphere"));
  Object.assign(speaker, {
    positionM: [-2, 0, 2],
    dimensionsM: [0.1, 0.1, 0.1],
    mode: "fixed",
    acousticRole: "none",
  });
  Object.assign(reflector, {
    id: "reflector",
    shape,
    positionM: [0, 0, 0],
    orientationQuaternion: [0, 0, 0, 1],
    dimensionsM: shape === "capsule" ? [2, 4, 2] : [2, 2, 2],
    mode: moving ? "kinematic" : "fixed",
    acousticRole: moving ? "dynamicReflector" : "staticSurface",
    acousticMaterialId: material,
  });
  p.projectId = "project.ui-curved." + shape;
  p.name = "UI curved reflection " + shape;
  p.scene.sceneId = "scene.ui-curved." + shape;
  p.scene.sceneRevision = 0;
  p.scene.objects = [speaker, reflector];
  p.scene.sources = p.scene.sources.filter((s) => s.objectId === "speaker");
  p.scene.listener.positionM = [2, 0, 2];
  p.scene.listener.orientationQuaternion = [0, 0, 0, 1];
  p.soundBehaviors.bindings = p.soundBehaviors.bindings.filter((b) => b.objectId === "speaker");
  p.soundBehaviors.profiles = p.soundBehaviors.profiles.filter((pr) =>
    p.soundBehaviors.bindings.some((b) => b.profileId === pr.profileId),
  );
  p.soundBehaviors.documentId = "behavior.ui-curved." + shape;
  p.soundBehaviors.revision = 0;
  p.recordings = [];
  delete p.activeRecordingId;
  delete p.editorMetadata;
  p.atmosphere = {
    medium: "air",
    speedOfSoundMps: 343,
    temperatureC: 20,
    bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
    dataClass: "Synthetic",
  };
  const file = path.join(
    out,
    "fixture-" + shape + "-" + material + "-" + (moving ? "moving" : "static") + ".json",
  );
  const b = Buffer.from(JSON.stringify(p));
  await writeFile(file, b);
  summary.artifacts.push({
    path: path.basename(file),
    bytes: b.length,
    sha256: sha(b),
    origin:
      "Explicit local test scenario derived from real UI exported project; no engine injection",
  });
  await importProject(file);
  await selectObject("reflector");
}
async function capture(label) {
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  const capture = page.getByRole("button", { name: "Capture 3 seconds", exact: true });
  await capture.click();
  await expect(capture).toBeDisabled();
  await expect(capture).toBeEnabled({ timeout: 90000 });
  await expect(page.getByRole("button", { name: "Render audio files", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: /^Events & recording/ }).click();
  const file = await download(
    page.getByRole("button", { name: "Export archived recording", exact: true }),
    label + "-recording",
  );
  assert.equal(file.value.status, "captured");
  assert.equal(file.value.frameCount, 180);
  return file.value;
}
function reflectionEvidence(recording, { shape, moving = false }) {
  assert.equal(recording.configuration.backendVersion, "web-geometric-primitives-1.0.0");
  const rows = [];
  for (const frame of recording.frames) {
    const pose = frame.poses.find((p) => p.objectId === "reflector");
    assert.ok(pose);
    for (const acoustic of frame.acousticFrames) {
      assert.equal(acoustic.backendVersion, "web-geometric-primitives-1.0.0");
      assert.equal(acoustic.poseTick, frame.tick);
      assert.equal(acoustic.stale, false);
      assert.equal(acoustic.modelClass, "numericalApproximation");
      if (moving) assert.ok(acoustic.capabilities.includes("dynamicReflectors"));
      for (const p of acoustic.paths.filter(
        (p) => p.order === 1 && p.surfaceIds.some((s) => s.startsWith("reflector.")),
      )) {
        const point = p.verticesM[1],
          z = pose.positionM[2] + 1;
        assert.ok(
          Math.abs(point[0]) < 2e-7 && Math.abs(point[1]) < 2e-7 && Math.abs(point[2] - z) < 2e-7,
          "independent symmetric specular point",
        );
        const length = 2 * Math.hypot(2, 2 - z);
        assert.ok(Math.abs(p.lengthM - length) < 2e-7);
        assert.ok(Math.abs(p.absoluteDelayS - length / 343) < 2e-9);
        rows.push({
          tick: frame.tick,
          id: p.id,
          surfaceIds: p.surfaceIds,
          poseZ: pose.positionM[2],
          point: p.verticesM[1],
          lengthM: p.lengthM,
          bandGains: p.bandGains,
          capabilities: acoustic.capabilities,
        });
      }
    }
  }
  assert.ok(
    rows.length >= recording.frames.length,
    "every captured tick has a genuine reflector path",
  );
  if (shape !== "box") assert.ok(rows.every((p) => p.surfaceIds.includes("reflector.body")));
  if (moving) {
    assert.ok(
      Math.max(...rows.map((p) => p.poseZ)) - Math.min(...rows.map((p) => p.poseZ)) > 0.2,
      "moving pose varies inside actual recorded ticks",
    );
    assert.equal(
      new Set(rows.map((p) => p.id)).size,
      1,
      "path identity stays stable as reflection point moves",
    );
  }
  return {
    backendVersion: recording.configuration.backendVersion,
    frames: recording.frameCount,
    reflectorPaths: rows.length,
    first: rows[0],
    last: rows.at(-1),
    poseRangeZ: [Math.min(...rows.map((p) => p.poseZ)), Math.max(...rows.map((p) => p.poseZ))],
  };
}
async function startMotion() {
  await page.getByRole("tab", { name: "Motion", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "Motion", exact: true });
  await panel
    .getByRole("group", { name: "Target position m", exact: true })
    .getByRole("spinbutton", { name: "Z", exact: true })
    .fill("0.8");
  await panel.getByRole("spinbutton", { name: "Maximum speed m/s", exact: true }).fill("0.2");
  await panel.getByRole("button", { name: "Save action", exact: true }).click();
  await expect(panel.locator(".motion-actions li")).toHaveCount(1);
  await panel.getByRole("button", { name: "Run", exact: true }).click();
}
try {
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  summary.browser = browser.version();
  await openContext();
  const base = (await project("base-default-project")).value;
  await checkpoint(
    "curved.sphere.material-role-controls",
    ["object.acousticMaterial", "object.acousticRole"],
    async (r) => {
      await shapeControls("ball", "sphere", r);
    },
  );
  await checkpoint("curved.sphere.dimension-bounds-invalid", ["object.diameter"], async (r) => {
    await dimensions("ball", "sphere", r);
  });
  await checkpoint(
    "curved.capsule.material-role-controls",
    ["object.acousticMaterial", "object.acousticRole"],
    async (r) => {
      const before = await revision();
      await page.getByRole("button", { name: "Capsule +", exact: true }).click();
      await waitChange(before);
      const p = (await project("capsule-added")).value;
      const cap = p.scene.objects.find((o) => o.shape === "capsule");
      assert.ok(cap);
      r.objectId = cap.id;
      summary.capsuleId = cap.id;
      await shapeControls(cap.id, "capsule", r);
    },
  );
  await checkpoint(
    "curved.capsule.dimension-bounds-invalid",
    ["object.diameter", "object.capsuleHeight"],
    async (r) => {
      await dimensions(summary.capsuleId, "capsule", r);
    },
  );
  await checkpoint(
    "curved.project-import-persists-controls",
    ["object.acousticMaterial", "object.acousticRole"],
    async (r) => {
      const saved = await project("curved-controls-roundtrip");
      const expected = saved.value.scene.objects
        .filter((o) => o.id === "ball" || o.id === summary.capsuleId)
        .map((o) => ({
          id: o.id,
          shape: o.shape,
          dimensionsM: o.dimensionsM,
          mode: o.mode,
          material: o.acousticMaterialId,
          role: o.acousticRole,
        }));
      await context.close();
      await openContext();
      await importProject(saved.file);
      const loaded = (await project("curved-controls-imported")).value;
      assert.deepEqual(
        loaded.scene.objects
          .filter((o) => o.id === "ball" || o.id === summary.capsuleId)
          .map((o) => ({
            id: o.id,
            shape: o.shape,
            dimensionsM: o.dimensionsM,
            mode: o.mode,
            material: o.acousticMaterialId,
            role: o.acousticRole,
          })),
        expected,
      );
      await selectObject(summary.capsuleId);
      assert.equal(
        await inspector()
          .getByRole("combobox", { name: "Acoustic material", exact: true })
          .isEnabled(),
        true,
      );
      r.objects = expected;
    },
  );
  let sphereHard, sphereSoft;
  await checkpoint(
    "curved.sphere.real-solver-material-effect",
    ["object.acousticMaterial", "object.acousticRole"],
    async (r) => {
      await fixture(base, "sphere", "material.hard", false);
      sphereHard = await capture("sphere-hard");
      r.hard = reflectionEvidence(sphereHard, { shape: "sphere" });
      await setOption(
        inspector().getByRole("combobox", { name: "Acoustic material", exact: true }),
        "material.soft",
      );
      sphereSoft = await capture("sphere-soft");
      r.soft = reflectionEvidence(sphereSoft, { shape: "sphere" });
      const h = r.hard.first.bandGains,
        s = r.soft.first.bandGains;
      const registry = sphereHard.configuration.materialRegistry;
      const hard = registry.find((x) => x.id === "material.hard"),
        soft = registry.find((x) => x.id === "material.soft");
      r.materialRatios = h.map((gain, i) => {
        const expected = Math.sqrt(
          ((1 - soft.bands[i].scatteringFraction) * soft.bands[i].reflectionEnergy) /
            ((1 - hard.bands[i].scatteringFraction) * hard.bands[i].reflectionEnergy),
        );
        const actual = s[i] / gain;
        assert.ok(Math.abs(actual - expected) < 1e-7, "captured material specular pressure ratio");
        return { actual, expected };
      });
    },
  );
  for (const shape of ["capsule", "box"])
    await checkpoint(
      "curved." + shape + ".moving-dynamic-reflector",
      ["object.acousticRole"],
      async (r) => {
        await fixture(base, shape, "material.hard", true);
        await startMotion();
        const record = await capture(shape + "-moving");
        r.solver = reflectionEvidence(record, { shape, moving: true });
        await page
          .getByRole("tab", { name: "Acoustic paths", exact: false })
          .click()
          .catch(async () => page.getByRole("tab", { name: /^Acoustic paths/ }).click());
        const panel = page.getByRole("tabpanel", { name: /^Acoustic paths/ });
        const row = panel.locator("tbody tr").filter({ hasText: "Reflection" }).first();
        const pathButton = row.getByRole("button");
        await expect(pathButton).toBeVisible();
        r.visiblePathId = await pathButton.innerText();
        r.recordedPathId = r.solver.last.id;
        await pathButton.click();
        r.visiblePathOrigin = await panel.innerText();
        assert.match(r.visiblePathOrigin, /reflector\./);
        await page.screenshot({
          path: path.join(out, shape + "-dynamic-path.png"),
          fullPage: true,
        });
      },
    );
  summary.status = summary.failures.length
    ? "FAIL"
    : selectedChecks
      ? "PASS_FILTERED_SCOPE"
      : "PASS";
} catch (e) {
  summary.status = "ERROR";
  summary.fatalError = String(e.stack || e);
  if (page)
    await page.screenshot({ path: path.join(out, "fatal.png"), fullPage: true }).catch(() => {});
} finally {
  summary.finishedAt = new Date().toISOString();
  await context?.close().catch(() => {});
  await browser?.close();
  await persist();
}
console.log(
  JSON.stringify(
    {
      status: summary.status,
      checks: summary.checks.map((c) => ({
        id: c.id,
        status: c.status,
        error: c.error?.split("\n")[0],
      })),
      fatal: summary.fatalError,
      out,
    },
    null,
    2,
  ),
);
process.exitCode = summary.status.startsWith("PASS") ? 0 : 1;
