import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
const out = path.resolve(process.argv[2] || "docs/14-core-pipeline/stages/11-ui-parameters/scene");
const selectedChecks = process.env.SCENE_AUDIT_FILTER?.split(",").filter(Boolean);
await mkdir(out, { recursive: true });
await mkdir(path.join(out, "project-downloads"), { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const summary = {
  schemaVersion: 1,
  kind: "PRODUCTION_INSPECTOR_PARAMETER_AUDIT",
  startedAt: new Date().toISOString(),
  sourceCommit: process.env.SCENE_AUDIT_SOURCE_COMMIT || "19db9f966d0c34b266243fb1c90a961feb3dcdd5",
  observedGitHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  servedSourcePinAuthority:
    "Root declared stable production preview, not rebuilt during exclusive browser lease",
  method:
    "Real installed Chrome, production DOM clicks/fill/keyboard; author state checked by genuine UI Export project downloads. No internal runtime API/bridge.",
  browser: null,
  status: "RUNNING",
  inventory: [],
  checks: [],
  failures: [],
  limitations: [],
  pageErrors: [],
  consoleErrors: [],
  requestsBlocked: [],
  assets: [],
};
const sourcePaths = [
  "src/ui/Inspector.tsx",
  "src/ui/components.tsx",
  "src/scene/validate-scene.ts",
  "schemas/scene.schema.json",
  "tests/browser/parameter-audit/scene-inspector-run.mjs",
];
summary.sourcePins = await Promise.all(
  sourcePaths.map(async (file) => ({ path: file, sha256: hash(await readFile(file)) })),
);
summary.sourceNote =
  "sourceCommit pins the declared served production build; observedGitHead is separate. sourcePins describe audit-time files, and assets records actual loaded bytes. No uncommitted source is claimed to be in the prior served bundle.";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
summary.browser = browser.version();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.on("pageerror", (e) => summary.pageErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") summary.consoleErrors.push(m.text());
});
page.on("response", async (response) => {
  const url = response.url();
  if (/\/assets\/.*\.(js|css)$/.test(url)) {
    try {
      const b = await response.body();
      summary.assets.push({ url, sha256: hash(b), bytes: b.length });
    } catch {}
  }
});
await page.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.origin !== "http://127.0.0.1:4173"
  ) {
    summary.requestsBlocked.push(url.href);
    return route.abort("blockedbyclient");
  }
  return route.continue();
});
let exportCounter = 0,
  cachedProject = null,
  cachedSceneRevision = null;
const persist = () => writeFile(out + "/summary.json", JSON.stringify(summary, null, 2) + "\n");
async function project(forceFresh = false) {
  const currentRevision = await revision();
  if (!forceFresh && cachedProject && cachedSceneRevision === currentRevision) return cachedProject;
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export project", exact: true }).click(),
  ]);
  const bytes = await readFile(await download.path());
  const p = JSON.parse(bytes);
  exportCounter++;
  const artifactPath =
    "project-downloads/project-" + String(exportCounter).padStart(3, "0") + ".json";
  await writeFile(path.join(out, artifactPath), bytes);
  summary.projectDownloadArtifacts ??= [];
  summary.projectDownloadArtifacts.push({
    path: artifactPath,
    bytes: bytes.length,
    sha256: hash(bytes),
    sceneRevision: currentRevision,
    forcedFresh: forceFresh,
  });
  cachedProject = p;
  cachedSceneRevision = currentRevision;
  if (exportCounter === 1) await writeFile(out + "/initial-project.json", bytes);
  return p;
}
const inspect = () => page.getByRole("complementary", { name: "Property inspector", exact: true });
async function revision() {
  const text = await page.getByRole("banner").innerText();
  const n = /Scene rev\s+(\d+)/.exec(text);
  assert.ok(n, "visible Scene revision");
  return Number(n[1]);
}
async function waitRevision(before) {
  await page.waitForFunction(
    (old) => {
      const text = document.querySelector(".project-bar")?.textContent || "";
      return Number(/Scene rev\s+(\d+)/.exec(text)?.[1] || 0) > old;
    },
    before,
    { timeout: 20000 },
  );
}
async function select(id) {
  await page
    .getByRole("list", { name: "Scene object list" })
    .getByRole("button", { name: new RegExp("^" + id.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + " ") })
    .click();
  await inspect().getByRole("heading", { name: id, exact: true }).waitFor();
}
function group(label) {
  return inspect().getByRole("group", { name: label, exact: true });
}
function field(label) {
  return inspect().getByRole("spinbutton", { name: label, exact: true });
}
function same(a, b) {
  return Math.abs(a - b) < 1e-7;
}
function semanticFamilies(id) {
  if (id.startsWith("object.ball.position.")) return ["object.position.{axis}"];
  if (id.startsWith("object.box.dimension.")) return ["object.boxDimensions.{axis}"];
  if (id === "object.ball.diameter") return ["object.diameter"];
  if (id.startsWith("object.ball.rotation.")) return ["object.rotation.{axis}"];
  if (id === "object.ball.mass") return ["object.massKg"];
  if (id === "object.ball.friction") return ["object.friction"];
  if (id === "object.ball.restitution") return ["object.restitution"];
  if (id === "object.ball.mode") return ["object.bodyMode"];
  if (id === "object.box.acoustic.material") return ["object.acousticMaterial"];
  if (id === "object.box.acoustic.role") return ["object.acousticRole"];
  if (id === "capsule.dimensions") return ["object.diameter", "object.capsuleHeight"];
  if (id === "object.duplicate-delete-undo") return ["object.duplicate", "object.remove"];
  if (id.startsWith("listener.position."))
    return ["listener.position.{axis}", "explorer.listenerEnvironment"];
  if (id.startsWith("listener.rotation.")) return ["listener.rotation.{axis}"];
  if (id.startsWith("environment.")) return ["environment.medium", "environment.temperatureC"];
  if (id === "running-edit-guard") return ["inspector.pause"];
  return [];
}
async function checkpoint(id, run) {
  if (selectedChecks && !selectedChecks.includes(id)) {
    summary.checks.push({
      id,
      semanticFamilyIds: semanticFamilies(id),
      status: "NOT_RUN_FILTERED",
    });
    return;
  }
  const item = {
    id,
    semanticFamilyIds: semanticFamilies(id),
    status: "RUNNING",
    startedAt: new Date().toISOString(),
  };
  summary.checks.push(item);
  try {
    await run(item);
    item.status = "PASS";
  } catch (error) {
    item.status = "FAIL";
    item.error = String(error.stack || error);
    summary.failures.push({ id, error: item.error });
    await page.screenshot({
      path: out + "/" + id.replace(/[^a-z0-9.-]/gi, "-") + "-failure.png",
      fullPage: true,
    });
  }
  item.finishedAt = new Date().toISOString();
  await persist();
}
async function numeric(id, locator, getAuthor, { min, max, normal, restore }) {
  summary.inventory.push({
    id,
    type: "number",
    min,
    max,
    keyboard: ["Enter commits", "Escape cancels"],
    pointer: "focus/click/blur",
    invalid: ["below minimum", "above maximum", "blank", "nonfinite exponent"],
    source: "src/ui/Inspector.tsx + NumberField",
  });
  await checkpoint(id, async (item) => {
    const original = Number(await locator.inputValue());
    item.initial = original;
    for (const value of [normal, min, max, restore ?? original]) {
      if (same(Number(await locator.inputValue()), value)) {
        item.noopValue = value;
        continue;
      }
      const before = await revision();
      await locator.click();
      await locator.fill(String(value));
      await locator.press("Enter");
      await waitRevision(before);
      const p = await project();
      assert.ok(same(getAuthor(p), value), "author value " + id + " " + value);
      item.valid ??= [];
      item.valid.push({ value, sceneRevision: p.scene.sceneRevision });
    }
    const stable = await project();
    const oldAuthor = getAuthor(stable);
    for (const raw of [String(min - 1), String(max + 1), "", "1e309"]) {
      const before = await revision();
      await locator.fill(raw);
      await locator.press("Enter");
      assert.equal(
        await locator.getAttribute("aria-invalid"),
        "true",
        "invalid input visible " + raw,
      );
      assert.equal(await revision(), before, "invalid input must not commit");
      await locator.press("Escape");
      assert.equal(await locator.getAttribute("aria-invalid"), "false");
      const p = await project();
      assert.ok(same(getAuthor(p), oldAuthor));
    }
    const negativeProject = await project(true);
    assert.ok(
      same(getAuthor(negativeProject), oldAuthor),
      "fresh UI export confirms invalid group unchanged",
    );
    item.negativeOracle = "fresh exported JSON after every parameter invalid-input group";
    const before = await revision();
    await locator.fill(String(normal));
    await locator.press("Escape");
    assert.equal(await revision(), before, "Escape cancels author edit");
    const arrowBefore = await revision();
    await locator.focus();
    await locator.press("ArrowUp");
    await locator.press("Enter");
    await waitRevision(arrowBefore);
    const arrowAuthor = getAuthor(await project());
    assert.ok(arrowAuthor > oldAuthor, "ArrowUp changes actual authored value upward");
    await expect
      .poll(async () => Number(await locator.inputValue()), { timeout: 5000 })
      .toBeCloseTo(arrowAuthor, 7);
    const arrowValue = Number(await locator.inputValue());
    assert.ok(arrowValue >= min && arrowValue <= max);
    item.spinnerEcho = { author: arrowAuthor, input: arrowValue };
    const restoreBefore = await revision();
    await locator.fill(String(oldAuthor));
    await locator.press("Enter");
    await waitRevision(restoreBefore);
    assert.ok(same(getAuthor(await project()), oldAuthor));
    item.keyboardSpinner = true;
    item.persistence = "Every valid/invalid write checked by real exported project bytes";
  });
}
async function rotation(id, label, index, getQ) {
  const loc = field(label);
  summary.inventory.push({
    id,
    type: "angle",
    min: -360,
    max: 360,
    unit: "deg · XYZ",
    source: "RotationFields in src/ui/Inspector.tsx",
  });
  await checkpoint(id, async (item) => {
    for (const angle of [-360, 360, 37.5, 0]) {
      const before = await revision();
      await loc.fill(String(angle));
      await loc.press("Enter");
      await waitRevision(before);
      const q = getQ(await project());
      assert.ok(same(Math.hypot(...q), 1));
      const expected = [0, 0, 0, Math.cos((angle * Math.PI) / 360)];
      expected[index] = Math.sin((angle * Math.PI) / 360);
      assert.ok(
        Math.abs(q.reduce((s, v, i) => s + v * expected[i], 0)) > 1 - 1e-7,
        "quaternion equivalent",
      );
    }
    for (const angle of [-361, 361]) {
      const before = await revision();
      await loc.fill(String(angle));
      await loc.press("Enter");
      assert.equal(await loc.getAttribute("aria-invalid"), "true");
      assert.equal(await revision(), before);
      await loc.press("Escape");
    }
    const negativeQ = getQ(await project(true));
    assert.ok(
      Math.abs(negativeQ[3]) > 1 - 1e-7,
      "fresh export proves invalid rotations left identity unchanged",
    );
    item.checked = "unit quaternion and independent single-axis trigonometric reference";
  });
}
async function open() {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
  await inspect().waitFor();
}
try {
  await open();
  await project();
  for (const [i, axis] of ["X", "Y", "Z"].entries())
    await numeric(
      "object.ball.position." + axis,
      group("Position m").getByRole("spinbutton", { name: axis, exact: true }),
      (p) => p.scene.objects.find((o) => o.id === "ball").positionM[i],
      { min: -200, max: 200, normal: 0.35791234618 + i },
    );
  await numeric(
    "object.ball.diameter",
    field("Diameter m"),
    (p) => {
      const d = p.scene.objects.find((o) => o.id === "ball").dimensionsM;
      assert.ok(
        d.every((v) => same(v, d[0])),
        "sphere dimensions remain equal",
      );
      return d[0];
    },
    { min: 0.01, max: 100, normal: 0.75 },
  );
  for (const [i, axis] of ["X", "Y", "Z"].entries())
    await rotation(
      "object.ball.rotation." + axis,
      "Rotation " + axis,
      i,
      (p) => p.scene.objects.find((o) => o.id === "ball").orientationQuaternion,
    );
  await numeric(
    "object.ball.mass",
    field("Mass kg"),
    (p) => p.scene.objects.find((o) => o.id === "ball").massKg,
    { min: 0.001, max: 10000, normal: 2.5 },
  );
  await numeric(
    "object.ball.friction",
    field("Friction coefficient"),
    (p) => p.scene.objects.find((o) => o.id === "ball").friction,
    { min: 0, max: 2, normal: 0.75 },
  );
  await numeric(
    "object.ball.restitution",
    field("Restitution coefficient"),
    (p) => p.scene.objects.find((o) => o.id === "ball").restitution,
    { min: 0, max: 1, normal: 0.75 },
  );
  await checkpoint("object.ball.mode", async (item) => {
    const loc = inspect().getByRole("combobox", { name: "Rigid body mode" });
    item.options = [];
    for (const mode of ["fixed", "dynamicNoGravity", "kinematic", "dynamicGravity"]) {
      const before = await revision();
      await loc.selectOption(mode);
      await waitRevision(before);
      const p = await project();
      assert.equal(p.scene.objects.find((o) => o.id === "ball").mode, mode);
      assert.equal(await field("Mass kg").isDisabled(), mode === "fixed");
      item.options.push(mode);
    }
    await loc.focus();
    await loc.press("Home");
    await loc.press("ArrowDown");
    await loc.press("Enter");
    await page.waitForTimeout(100);
    assert.equal(await loc.inputValue(), "dynamicNoGravity");
    const p = await project();
    assert.equal(p.scene.objects.find((o) => o.id === "ball").mode, "dynamicNoGravity");
    await loc.selectOption("dynamicGravity");
  });
  summary.inventory.push({
    id: "object.ball.mode",
    type: "select",
    options: ["dynamicGravity", "dynamicNoGravity", "fixed", "kinematic"],
    pointer: true,
    keyboard: true,
  });
  await checkpoint("object.numeric-draft-locale", async (item) => {
    const loc = field("Mass kg");
    const original = await loc.inputValue();
    const before = await revision();
    await loc.fill("2.25");
    await page
      .getByRole("combobox", { name: "介面語言 / Interface language" })
      .selectOption("zh-TW");
    await page.getByRole("spinbutton", { name: "質量 kg", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("spinbutton", { name: "質量 kg", exact: true }).inputValue(),
      "2.25",
    );
    await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
    assert.equal(await revision(), before, "locale switch must not commit dirty numeric draft");
    await field("Mass kg").press("Escape");
    assert.equal(await field("Mass kg").inputValue(), original);
    item.checked =
      "draft preserved across zh-TW/en locale switching without author command; Escape restores authored value";
  });
  await checkpoint("object.curved-acoustics-disabled", async (item) => {
    assert.equal(
      await inspect()
        .getByRole("combobox", { name: "Acoustic material", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await inspect().getByRole("combobox", { name: "Acoustic role", exact: true }).isDisabled(),
      true,
    );
    assert.match(
      await inspect().innerText(),
      /Spheres and capsules are not part of the geometric acoustics/,
    );
    item.outcome =
      "EXPECTED_UNSUPPORTED_PRE_IMPLEMENTATION: old production bundle explicitly disables curved acoustics; new implementation requires separate retest";
    summary.limitations.push(
      "Curved objects do not reflect/occlude in geometric acoustics; material/role controls disabled with an explicit explanation.",
    );
  });
  await select("floor");
  for (const [i, axis] of ["X", "Y", "Z"].entries())
    await numeric(
      "object.box.dimension." + axis,
      group("Dimensions m").getByRole("spinbutton", { name: axis, exact: true }),
      (p) => p.scene.objects.find((o) => o.id === "floor").dimensionsM[i],
      { min: 0.01, max: 100, normal: 0.625 + i },
    );
  for (const [id, options] of [
    ["material", ["material.hard", "material.soft", "material.wood", "material.metal"]],
    ["role", ["none", "staticSurface", "dynamicOccluder", "dynamicReflector"]],
  ]) {
    summary.inventory.push({ id: "object.box.acoustic." + id, type: "select", options });
    await checkpoint("object.box.acoustic." + id, async (item) => {
      const loc = inspect().getByRole("combobox", {
        name: id === "material" ? "Acoustic material" : "Acoustic role",
        exact: true,
      });
      item.options = [];
      for (const value of options) {
        if ((await loc.inputValue()) === value) continue;
        const before = await revision();
        await loc.selectOption(value);
        await waitRevision(before);
        const p = await project();
        assert.equal(
          p.scene.objects.find((o) => o.id === "floor")[
            id === "material" ? "acousticMaterialId" : "acousticRole"
          ],
          value,
        );
        item.options.push(value);
      }
      const allOptions = await loc
        .locator("option")
        .evaluateAll((nodes) => nodes.filter((n) => !n.disabled).map((n) => n.value));
      const currentValue = await loc.inputValue();
      const targetValue = currentValue === allOptions[0] ? allOptions.at(-1) : allOptions[0];
      const keyboardBefore = await revision();
      await loc.focus();
      await loc.press(currentValue === allOptions[0] ? "End" : "Home");
      await loc.press("Enter");
      await waitRevision(keyboardBefore);
      assert.equal(await loc.inputValue(), targetValue);
      const keyboardProject = await project();
      assert.equal(
        keyboardProject.scene.objects.find((o) => o.id === "floor")[
          id === "material" ? "acousticMaterialId" : "acousticRole"
        ],
        targetValue,
      );
      item.keyboard = true;
      item.note =
        id === "role"
          ? "Dynamic reflector availability depends on actual acoustic backend; parameter authored successfully, not a claim of science/backend capability."
          : undefined;
    });
  }
  await checkpoint("capsule.dimensions", async (item) => {
    const before = await revision();
    await page.getByRole("button", { name: "Capsule +", exact: true }).click();
    await waitRevision(before);
    const p = await project();
    const capsule = p.scene.objects.find((o) => o.shape === "capsule");
    assert.ok(capsule);
    const diameter = field("Diameter m"),
      height = field("Height m");
    item.objectId = capsule.id;
    for (const [loc, value] of [
      [height, 100],
      [diameter, 100],
      [diameter, 0.01],
      [height, 0.01],
      [height, 1],
      [diameter, 0.5],
    ]) {
      const old = await revision();
      await loc.fill(String(value));
      await loc.press("Enter");
      await waitRevision(old);
      const object = (await project()).scene.objects.find((o) => o.id === capsule.id);
      assert.ok(object.dimensionsM[1] >= object.dimensionsM[0]);
      assert.equal(object.dimensionsM[0], object.dimensionsM[2]);
    }
    for (const [loc, value] of [
      [diameter, 2],
      [height, 0.1],
    ]) {
      const old = await revision();
      await loc.fill(String(value));
      await loc.press("Enter");
      assert.equal(await loc.getAttribute("aria-invalid"), "true");
      assert.equal(await revision(), old);
      await loc.press("Escape");
    }
    const afterInvalid = (await project(true)).scene.objects.find((o) => o.id === capsule.id);
    assert.deepEqual(afterInvalid.dimensionsM, [0.5, 1, 0.5]);
    item.checked = "diameter/height min-max and invalid height < diameter";
  });
  summary.inventory.push(
    { id: "capsule.diameter", type: "number", min: 0.01, max: 100, relation: "diameter <= height" },
    { id: "capsule.height", type: "number", min: 0.01, max: 100, relation: "height >= diameter" },
  );
  await checkpoint("object.duplicate-delete-undo", async (item) => {
    const initial = await project();
    const ids = new Set(initial.scene.objects.map((o) => o.id));
    const before = await revision();
    await inspect().getByRole("button", { name: "Duplicate", exact: true }).click();
    await waitRevision(before);
    const duplicated = await project();
    const copy = duplicated.scene.objects.find((o) => !ids.has(o.id));
    assert.ok(copy);
    assert.equal(duplicated.scene.objects.length, ids.size + 1);
    item.duplicateId = copy.id;
    let old = await revision();
    await inspect().getByRole("button", { name: "Delete", exact: true }).click();
    await waitRevision(old);
    assert.equal((await project()).scene.objects.length, ids.size);
    old = await revision();
    await page.getByRole("button", { name: "Undo scene command", exact: true }).click();
    await waitRevision(old);
    assert.ok((await project()).scene.objects.some((o) => o.id === copy.id));
    old = await revision();
    await page.getByRole("button", { name: "Redo scene command", exact: true }).click();
    await waitRevision(old);
    assert.equal(
      (await project()).scene.objects.some((o) => o.id === copy.id),
      false,
    );
  });
  await page.getByRole("button", { name: /^Listener \/ Environment/ }).click();
  for (const [i, axis] of ["X", "Y", "Z"].entries())
    await numeric(
      "listener.position." + axis,
      group("Position m").getByRole("spinbutton", { name: axis, exact: true }),
      (p) => p.scene.listener.positionM[i],
      { min: -200, max: 200, normal: 0.357 + i },
    );
  for (const [i, axis] of ["X", "Y", "Z"].entries())
    await rotation(
      "listener.rotation." + axis,
      "Rotation " + axis,
      i,
      (p) => p.scene.listener.orientationQuaternion,
    );
  await checkpoint("environment.medium-temperature", async (item) => {
    const medium = inspect().getByRole("combobox", { name: "Propagation medium", exact: true });
    const temperature = field("Air temperature °C");
    item.values = [];
    for (const value of [-80, 100, 35.5]) {
      await temperature.fill(String(value));
      await temperature.press("Enter");
      await page.waitForTimeout(150);
      assert.equal(Number(await temperature.inputValue()), value);
      const speedText = await inspect()
        .locator(".readout-line")
        .filter({ hasText: "Speed of sound" })
        .innerText();
      const expectedSpeed = Math.sqrt(1.4 * 287.05 * (273.15 + value));
      assert.ok(
        speedText.includes(expectedSpeed.toFixed(2)),
        "visible speed of sound changes with committed temperature",
      );
      item.values.push(value);
    }
    for (const raw of ["-81", "101", "", "1e309"]) {
      await temperature.fill(raw);
      await temperature.press("Enter");
      assert.equal(await temperature.getAttribute("aria-invalid"), "true");
      await temperature.press("Escape");
    }
    await medium.selectOption("vacuum");
    await page.waitForTimeout(150);
    assert.equal(await temperature.isDisabled(), true);
    await medium.focus();
    await medium.press("Home");
    await medium.press("Enter");
    await page.waitForTimeout(150);
    assert.equal(await medium.inputValue(), "air");
    assert.equal(await temperature.isEnabled(), true);
    item.pointerAndKeyboard = true;
  });
  summary.inventory.push(
    { id: "environment.medium", type: "select", options: ["air", "vacuum"] },
    {
      id: "environment.airTemperature",
      type: "number",
      unit: "°C",
      min: -80,
      max: 100,
      disabled: "vacuum",
    },
  );
  await checkpoint("environment.persistence-reload", async (item) => {
    const medium = inspect().getByRole("combobox", { name: "Propagation medium", exact: true });
    const temp = field("Air temperature °C");
    await medium.selectOption("air");
    await temp.fill("35.5");
    await temp.press("Enter");
    await medium.selectOption("vacuum");
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await page.reload();
    cachedProject = null;
    cachedSceneRevision = null;
    await page.getByRole("button", { name: "Load locally saved project", exact: true }).click();
    await page.getByRole("button", { name: /^Listener \/ Environment/ }).click();
    item.afterReload = await field("Air temperature °C").inputValue();
    item.afterReloadMedium = await inspect()
      .getByRole("combobox", { name: "Propagation medium", exact: true })
      .inputValue();
    assert.deepEqual(
      { temperature: Number(item.afterReload), medium: item.afterReloadMedium },
      { temperature: 35.5, medium: "vacuum" },
      "saved environment medium and temperature must reload",
    );
  });
  await select("ball");
  await checkpoint("running-edit-guard", async (item) => {
    await page.getByRole("button", { name: /^(Start|Resume) simulation$/ }).click();
    for (const label of [
      "Mass kg",
      "Friction coefficient",
      "Restitution coefficient",
      "Rotation X",
    ])
      assert.equal(await field(label).isDisabled(), true);
    assert.equal(
      await inspect().getByRole("combobox", { name: "Rigid body mode" }).isDisabled(),
      true,
    );
    await inspect().getByRole("button", { name: "Pause", exact: true }).click();
    await field("Mass kg").waitFor({ state: "visible" });
    assert.equal(await field("Mass kg").isEnabled(), true);
    item.checked = "running author guard then visible Pause re-enables editable controls";
  });
  await page.screenshot({ path: out + "/final-inspector.png", fullPage: true });
  await writeFile(out + "/final-project.json", JSON.stringify(await project(), null, 2) + "\n");
  summary.status = summary.failures.length
    ? "FAIL"
    : selectedChecks
      ? "PASS_FILTERED_SCOPE"
      : "PASS";
} catch (error) {
  summary.status = "ERROR";
  summary.fatalError = String(error.stack || error);
  await page.screenshot({ path: out + "/fatal.png", fullPage: true });
} finally {
  summary.finishedAt = new Date().toISOString();
  summary.projectExports = exportCounter;
  await persist();
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      status: summary.status,
      checks: summary.checks.length,
      failures: summary.failures.map((x) => ({ id: x.id, error: x.error.split("\n")[0] })),
      out,
    },
    null,
    2,
  ),
);
process.exitCode = summary.failures.length || summary.status === "ERROR" ? 1 : 0;
