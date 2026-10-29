import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { LabRuntime } from "../../src/app/runtime.js";
import type { LabAction } from "../../src/ui/contracts.js";

const LOCALE_LABEL = "介面語言 / Interface language";
const LOCALE_KEY = "reflection-lab.locale";
const modelRequests = new WeakMap<Page, string[]>();

async function expectPublicIcons(page: Page, info: TestInfo) {
  const manifest = JSON.parse(
    await readFile(new URL("../../test-results/ui-preview-build.json", import.meta.url), "utf8"),
  ) as {
    inputs: { path: string; sha256: string }[];
    bundle: { path: string; sha256: string }[];
  };
  const hash = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");
  const observations = [];
  for (const name of ["favicon.svg", "favicon.ico"] as const) {
    const href = `/${name}`;
    await expect(page.locator(`link[rel="icon"][href="${href}"]`)).toHaveCount(1);
    const source = await readFile(new URL(`../../public/${name}`, import.meta.url));
    const sourceSha256 = hash(source);
    const buildInput = manifest.inputs.find((entry) => entry.path === `public/${name}`);
    const bundle = manifest.bundle.find(
      (entry) => entry.path === `test-results/ui-preview-dist/${name}`,
    );
    expect(buildInput?.sha256, `${name}: build input must match the current public file`).toBe(
      sourceSha256,
    );
    expect(bundle?.sha256, `${name}: copied bundle asset must match the public file`).toBe(
      sourceSha256,
    );
    const response = await page.request.get(href);
    expect(response.status(), `${name}: a real asset response is required`).toBe(200);
    const contentType = response.headers()["content-type"]?.split(";")[0]?.toLowerCase();
    if (name === "favicon.svg") expect(contentType).toBe("image/svg+xml");
    else expect(contentType).toMatch(/^image\/(?:vnd\.microsoft\.icon|x-icon)$/);
    const body = await response.body();
    const responseSha256 = hash(body);
    expect(responseSha256, `${name}: HTTP bytes must match source and built asset`).toBe(
      sourceSha256,
    );
    expect(hash(await readFile(new URL(`../../public/${name}`, import.meta.url)))).toBe(
      sourceSha256,
    );
    observations.push({
      path: href,
      status: response.status(),
      contentType,
      bytes: body.length,
      sourceSha256,
      buildInputSha256: buildInput?.sha256,
      bundleSha256: bundle?.sha256,
      responseSha256,
    });
  }
  await info.attach("public-icon-http-verification.json", {
    body: JSON.stringify(observations, null, 2),
    contentType: "application/json",
  });
}

interface NativeVoiceObservation {
  input: { instanceId: string; continuous: boolean };
  source: AudioBufferSourceNode | OscillatorNode;
  sourceStopped: boolean;
}
interface NativeRuntimeObservation {
  busy: boolean;
  world: object;
  runEpoch: string;
  project: unknown;
  editorMetadata: unknown;
  projectAssets: unknown[];
  assets: { assetId: string; revision: number; sha256: string }[];
  audio: {
    context: BaseAudioContext | null;
    voices: Map<string, NativeVoiceObservation>;
  } | null;
}
interface LocaleProbe {
  runtime: LabRuntime;
  world: object;
  canvas: HTMLCanvasElement;
  audio: NativeRuntimeObservation["audio"];
  context: BaseAudioContext | null;
  voices: Map<string, AudioBufferSourceNode | OscillatorNode>;
  runId: string | null;
  runEpoch: string;
  tick: number;
  audioTime: number | null;
  documents: string;
  dispatches: LabAction["type"][];
  originalDispatch: LabRuntime["dispatch"];
}
declare global {
  interface Window {
    __localeProbe?: LocaleProbe;
  }
}

async function openWorkspace(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("combobox", { name: LOCALE_LABEL, exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__reflectionLab)).toBe(true);
}

async function chooseLocale(page: Page, locale: "zh-TW" | "en") {
  const selector = page.getByRole("combobox", { name: LOCALE_LABEL, exact: true });
  // Actual focus leaves the old form field before the native select changes.
  // Programmatically invoking setLocale would miss a blur-triggered scene commit.
  await selector.focus();
  await selector.selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(selector).toHaveValue(locale);
}

async function expectLocalizedHead(page: Page, locale: "zh-TW" | "en") {
  await expect(page).toHaveTitle(
    locale === "en" ? "Reflection Lab · Sound Behavior Lab" : "Reflection Lab · 聲音行為實驗室",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    locale === "en"
      ? "Reflection Lab: a workspace for 3D physics, traceable acoustics, and sound behavior experiments."
      : "Reflection Lab：三維物理、可追溯聲學與聲音行為實驗工作台。",
  );
}

async function observeRuntime(page: Page) {
  return page.evaluate(() => {
    const runtime = window.__reflectionLab;
    const canvas = document.querySelector("canvas");
    if (!runtime || !canvas) throw new Error("Actual runtime and Canvas are required");
    const native = runtime as unknown as NativeRuntimeObservation;
    const audio = native.audio;
    const voices = new Map<string, AudioBufferSourceNode | OscillatorNode>();
    for (const [id, voice] of audio?.voices ?? [])
      if (voice.input.continuous && !voice.sourceStopped) voices.set(id, voice.source);
    const documents = JSON.stringify({
      project: native.project,
      scene: runtime.getSceneDocument(),
      behaviors: runtime.getBehaviorDocument(),
      projectAssets: native.projectAssets,
      assetPins: native.assets.map(({ assetId, revision, sha256 }) => ({
        assetId,
        revision,
        sha256,
      })),
      editorMetadata: native.editorMetadata,
    });
    const originalDispatch = runtime.dispatch;
    const probe: LocaleProbe = {
      runtime,
      world: native.world,
      canvas,
      audio,
      context: audio?.context ?? null,
      voices,
      runId: runtime.getSnapshot().runId,
      runEpoch: native.runEpoch,
      tick: runtime.getSnapshot().tick,
      audioTime: audio?.context?.currentTime ?? null,
      documents,
      dispatches: [],
      originalDispatch,
    };
    window.__localeProbe = probe;
    runtime.dispatch = (action) => {
      probe.dispatches.push(action.type);
      return originalDispatch.call(runtime, action);
    };
    return {
      tick: probe.tick,
      continuousVoices: voices.size,
      hasAudioContext: !!probe.context,
      assetPins: native.projectAssets.length,
    };
  });
}

async function readRuntimeInvariant(page: Page) {
  return page.evaluate(() => {
    const probe = window.__localeProbe;
    const runtime = window.__reflectionLab;
    if (!probe || !runtime) throw new Error("Missing actual observation baseline");
    const native = runtime as unknown as NativeRuntimeObservation;
    const audio = native.audio;
    const documents = JSON.stringify({
      project: native.project,
      scene: runtime.getSceneDocument(),
      behaviors: runtime.getBehaviorDocument(),
      projectAssets: native.projectAssets,
      assetPins: native.assets.map(({ assetId, revision, sha256 }) => ({
        assetId,
        revision,
        sha256,
      })),
      editorMetadata: native.editorMetadata,
    });
    return {
      sameRuntime: runtime === probe.runtime,
      sameWorld: native.world === probe.world,
      sameCanvas: document.querySelector("canvas") === probe.canvas,
      sameAudioEngine: audio === probe.audio,
      sameAudioContext: (audio?.context ?? null) === probe.context,
      sameContinuousSources: [...probe.voices].every(([id, source]) => {
        const current = audio?.voices.get(id);
        return !!current && current.source === source && !current.sourceStopped;
      }),
      continuousVoicesObserved: probe.voices.size,
      sameDocuments: documents === probe.documents,
      sameRunId: runtime.getSnapshot().runId === probe.runId,
      sameRunEpoch: native.runEpoch === probe.runEpoch,
      initialTick: probe.tick,
      currentTick: runtime.getSnapshot().tick,
      initialAudioTime: probe.audioTime,
      currentAudioTime: audio?.context?.currentTime ?? null,
      dispatches: [...probe.dispatches],
    };
  });
}

function syntheticWav() {
  // Original synthetic PCM fixture, not recorded or third-party content.
  const sampleRate = 48000;
  const frames = 4800;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 2, 40);
  for (let frame = 0; frame < frames; frame++)
    bytes.writeInt16LE(
      Math.round(1000 * Math.sin((2 * Math.PI * 440 * frame) / sampleRate)),
      44 + frame * 2,
    );
  return bytes;
}

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  modelRequests.set(page, requests);
  await page.route("**/api/agent/propose**", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      status: 403,
      json: {
        error: { code: "TEST_BLOCKED", message: "Model calls are forbidden in locale proof." },
      },
    });
  });
});

test.afterEach(async ({ page }, info) => {
  const observation = page.isClosed()
    ? null
    : await page.evaluate(() => {
        const probe = window.__localeProbe;
        if (!probe) return null;
        probe.runtime.dispatch = probe.originalDispatch;
        return {
          initialTick: probe.tick,
          currentTick: probe.runtime.getSnapshot().tick,
          continuousVoicesObserved: probe.voices.size,
          dispatches: probe.dispatches,
        };
      });
  if (observation)
    await info.attach("locale-runtime-observation.json", {
      body: JSON.stringify(observation, null, 2),
      contentType: "application/json",
    });
  expect(modelRequests.get(page) ?? []).toEqual([]);
});

test("EN-01 visible native choice defaults to zh-TW and persists English across reload", async ({
  page,
}, info) => {
  await openWorkspace(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expectLocalizedHead(page, "zh-TW");
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  const projectName = await page.locator(".project-name strong").innerText();
  await chooseLocale(page, "en");
  await expectLocalizedHead(page, "en");
  await expectPublicIcons(page, info);
  await expect(page.getByRole("button", { name: "Start simulation", exact: true })).toBeVisible();
  await expect(page.locator(".project-name strong")).toHaveText(projectName);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), LOCALE_KEY)).toBe("en");
  await page.reload();
  await expect(page.getByRole("button", { name: "Start simulation", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expectLocalizedHead(page, "en");
  await expect(page.getByRole("combobox", { name: LOCALE_LABEL, exact: true })).toHaveValue("en");
  await chooseLocale(page, "zh-TW");
  await expectLocalizedHead(page, "zh-TW");
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
});

test("EN-01 an invalid stored locale safely uses the explicit zh-TW default", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "invalid-locale"), LOCALE_KEY);
  await openWorkspace(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expectLocalizedHead(page, "zh-TW");
  await expect(page.getByRole("combobox", { name: LOCALE_LABEL, exact: true })).toHaveValue(
    "zh-TW",
  );
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
});

test("EN-01 denied preference storage cannot prevent startup or language changes", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (this: Storage, name: string) {
      if (name === key) throw new DOMException("Preference storage denied", "SecurityError");
      return get.call(this, name);
    };
    Storage.prototype.setItem = function (this: Storage, name: string, value: string) {
      if (name === key) throw new DOMException("Preference storage denied", "SecurityError");
      return set.call(this, name, value);
    };
  }, LOCALE_KEY);
  await openWorkspace(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expectLocalizedHead(page, "zh-TW");
  await chooseLocale(page, "en");
  await expectLocalizedHead(page, "en");
  await expect(page.getByRole("button", { name: "Start simulation", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expectLocalizedHead(page, "zh-TW");
});

test("EN-02 English controls, dialogs, known diagnostics and offline preview remain functional without model calls", async ({
  page,
}) => {
  await page.route("**/api/agent/status", async (route) => {
    await route.fulfill({
      json: {
        offline: {
          state: "AVAILABLE",
          provenance: "OFFLINE_DETERMINISTIC",
          modelId: null,
          cloudCostUsd: 0,
        },
        meta: {
          provider: "metaModelApi",
          state: "BLOCKED",
          reason: "ZERO_OR_INVALID_BUDGET",
          modelId: null,
          remainingQuota: null,
          liveValidation: "NOT_RUN",
          estimatedCostCeilingUsd: 0,
        },
      },
    });
  });
  await openWorkspace(page);
  await chooseLocale(page, "en");
  await expect(page.getByRole("navigation", { name: "Workspace", exact: true })).toContainText(
    "Build scene",
  );
  await expect(
    page.getByRole("complementary", { name: "Scene and assets", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Property inspector", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Rigid body mode", exact: true })).toHaveValue(
    "dynamicGravity",
  );
  const impact = page.getByRole("article", { name: "Sound behavior rule.impact", exact: true });
  await expect(impact.getByRole("combobox", { name: "Trigger", exact: true })).toBeVisible();
  const curve = impact.getByRole("region", { name: "Parameter mapping curve editor", exact: true });
  await expect(
    curve.getByRole("combobox", { name: "Mapping input metric", exact: true }),
  ).toBeVisible();
  const override = page.getByRole("region", {
    name: "Object overrides for rule.impact",
    exact: true,
  });
  await override.locator("summary").click();
  await expect(
    override.getByRole("checkbox", { name: "Override Volume", exact: true }),
  ).toBeVisible();
  await expect(page.locator("input[type=file][accept='.wav,audio/wav,audio/x-wav']")).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("checkbox", {
      name: "I confirm that I have the right to use the imported audio",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("PCM/float WAV.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Import project JSON", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Import project JSON", exact: true });
  await dialog.getByLabel("Choose a project JSON file", { exact: true }).setInputFiles({
    name: "invalid-root.json",
    mimeType: "application/json",
    buffer: Buffer.from("[]"),
  });
  await expect(dialog.getByRole("alert")).toContainText("PROJECT_INVALID");
  await expect(dialog.getByRole("alert")).toContainText("must be a JSON object");
  await expect(
    dialog.getByRole("button", { name: "Apply and open project", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel import", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Import project JSON", exact: true }),
  ).toBeFocused();
  await page.getByRole("tab", { name: /^Events & recording/ }).click();
  await expect(page.getByRole("button", { name: "● Start recording", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export archived recording", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Experiment comparison", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Comparison type", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check and compare", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "Meta experiment agent", exact: true }).click();
  const provider = page.getByRole("combobox", { name: "AI execution mode", exact: true });
  await expect(provider).toHaveValue("offline");
  const prompt = page.getByRole("textbox", { name: "Experiment instruction", exact: true });
  await prompt.fill("ball impact audio quiet");
  const documentsBefore = await page.evaluate(() => {
    const runtime = window.__reflectionLab;
    if (!runtime) throw new Error("Actual runtime unavailable");
    return JSON.stringify([runtime.getSceneDocument(), runtime.getBehaviorDocument()]);
  });
  await page.getByRole("button", { name: "Generate action preview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Action preview", exact: true })).toBeVisible();
  await expect(page.getByLabel("Validated action differences", { exact: true })).not.toHaveText("");
  const preview = await page.evaluate(() => {
    const runtime = window.__reflectionLab;
    if (!runtime) throw new Error("Actual runtime unavailable");
    return {
      mode: runtime.getSnapshot().ai.mode,
      canApply: runtime.getSnapshot().ai.canApply,
      documents: JSON.stringify([runtime.getSceneDocument(), runtime.getBehaviorDocument()]),
    };
  });
  expect(preview.mode).toBe("offline");
  expect(preview.canApply).toBe(true);
  expect(preview.documents).toBe(documentsBefore);
  await page.getByRole("button", { name: "Cancel preview", exact: true }).click();
  await provider.selectOption("meta");
  await page.getByRole("button", { name: "Check server status again", exact: true }).click();
  await expect(page.locator(".agent-provider-status")).toContainText("Blocked");
  await expect(page.locator(".agent-provider-status")).toContainText("ZERO_OR_INVALID_BUDGET");
  await expect(page.locator(".agent-provider-status")).not.toContainText(/[\u3400-\u9fff]/);
  await expect(
    page.getByRole("button", { name: "Generate action preview", exact: true }),
  ).toBeDisabled();
  await prompt.press("Control+Enter");
  await expect(
    page.getByText("Meta Model API is currently unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Rigid body mode", exact: true })).toBeEnabled();
});

test("EN-02 an unmapped failed action preserves its code and visibly labels the original diagnostic", async ({
  page,
}) => {
  await openWorkspace(page);
  await chooseLocale(page, "en");
  const originalDispatch = await page.evaluateHandle(() => {
    const runtime = window.__reflectionLab;
    if (!runtime) throw new Error("Actual runtime unavailable");
    const original = runtime.dispatch;
    runtime.dispatch = (action) =>
      action.type === "patchObject"
        ? Promise.reject(new Error("LOCALE_UNMAPPED_PROBE: 原始診斷保留"))
        : original.call(runtime, action);
    return original;
  });
  try {
    const mass = page.getByRole("spinbutton", { name: /Mass/ });
    await mass.fill("1.25");
    await mass.press("Enter");
    const error = page.locator(".error-banner");
    await expect(error).toContainText("Original technical detail");
    await expect(error).toContainText("LOCALE_UNMAPPED_PROBE");
    await expect(error).toContainText("原始診斷保留");
  } finally {
    await page.evaluate((original) => {
      if (!window.__reflectionLab) throw new Error("Actual runtime unavailable");
      window.__reflectionLab.dispatch = original;
    }, originalDispatch);
    await originalDispatch.dispose();
  }
});

test("EN-03 language focus preserves valid and invalid raw drafts without scene commands", async ({
  page,
}, info) => {
  await openWorkspace(page);
  const baseline = await observeRuntime(page);
  const massZh = page.getByRole("spinbutton", { name: /質量/ });
  await massZh.fill("1.750");
  await chooseLocale(page, "en");
  const massEn = page.getByRole("spinbutton", { name: /Mass/ });
  await expect(massEn).toHaveValue("1.750");
  await chooseLocale(page, "zh-TW");
  await expect(massZh).toHaveValue("1.750");
  await massZh.press("Escape");
  await massZh.fill("");
  await massZh.press("Enter");
  await expect(massZh).toHaveAttribute("aria-invalid", "true");
  await chooseLocale(page, "en");
  await expect(massEn).toHaveValue("");
  await expect(massEn).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a finite number", { exact: false })).toBeVisible();
  await massEn.press("Escape");
  const impact = page.getByRole("article", { name: "Sound behavior rule.impact", exact: true });
  await impact.getByRole("spinbutton", { name: /Volume/ }).fill("");
  await chooseLocale(page, "zh-TW");
  const impactZh = page.getByRole("article", { name: "聲音行為 rule.impact", exact: true });
  await expect(impactZh.getByRole("spinbutton", { name: /音量/ })).toHaveValue("");
  await expect(impactZh.getByRole("button", { name: "套用", exact: true })).toBeDisabled();
  await chooseLocale(page, "en");
  await expect(impact.getByRole("spinbutton", { name: /Volume/ })).toHaveValue("");
  await expect(impact.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
  const invariant = await readRuntimeInvariant(page);
  expect(invariant).toMatchObject({
    sameRuntime: true,
    sameWorld: true,
    sameCanvas: true,
    sameAudioEngine: true,
    sameAudioContext: true,
    sameDocuments: true,
    sameRunId: true,
    sameRunEpoch: true,
    dispatches: [],
  });
  expect(invariant.currentTick).toBe(baseline.tick);
  await info.attach("paused-draft-invariance.json", {
    body: JSON.stringify(invariant, null, 2),
    contentType: "application/json",
  });
});

test("EN-03 natural running clocks advance while language keeps actual context and continuous native sources", async ({
  page,
}, info) => {
  await openWorkspace(page);
  await chooseLocale(page, "en");
  await page
    .getByRole("checkbox", {
      name: "I confirm that I have the right to use the imported audio",
      exact: true,
    })
    .check();
  await page.locator("input[type=file][accept='.wav,audio/wav,audio/x-wav']").setInputFiles({
    name: "原始音檔.wav",
    mimeType: "audio/wav",
    buffer: syntheticWav(),
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtime = window.__reflectionLab;
        return (
          runtime
            ?.getSnapshot()
            .assets.some((asset) => asset.name === "原始音檔.wav" && asset.status === "ready") &&
          !(runtime as unknown as NativeRuntimeObservation).busy
        );
      }),
    )
    .toBe(true);
  await expect(
    page.locator(".asset-list").getByText("原始音檔.wav", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enable listening", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtime = window.__reflectionLab;
        return (
          runtime?.getSnapshot().monitor.state === "audible" &&
          !(runtime as unknown as NativeRuntimeObservation).busy
        );
      }),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Start simulation", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const native = window.__reflectionLab as unknown as NativeRuntimeObservation;
        return [...(native.audio?.voices.values() ?? [])].filter(
          (voice) => voice.input.continuous && !voice.sourceStopped,
        ).length;
      }),
    )
    .toBeGreaterThan(0);
  const baseline = await observeRuntime(page);
  expect(baseline.continuousVoices).toBeGreaterThan(0);
  expect(baseline.hasAudioContext).toBe(true);
  expect(baseline.assetPins).toBeGreaterThan(0);
  await chooseLocale(page, "zh-TW");
  await chooseLocale(page, "en");
  await expect(
    page.locator(".transport-actions").getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab?.getSnapshot().tick ?? -1))
    .toBeGreaterThan(baseline.tick + 8);
  const invariant = await readRuntimeInvariant(page);
  expect(invariant).toMatchObject({
    sameRuntime: true,
    sameWorld: true,
    sameCanvas: true,
    sameAudioEngine: true,
    sameAudioContext: true,
    sameContinuousSources: true,
    sameDocuments: true,
    sameRunId: true,
    sameRunEpoch: true,
    dispatches: [],
  });
  expect(invariant.continuousVoicesObserved).toBeGreaterThan(0);
  expect(invariant.currentTick).toBeGreaterThan(invariant.initialTick);
  expect(invariant.currentAudioTime!).toBeGreaterThan(invariant.initialAudioTime!);
  await expect(
    page.locator(".asset-list").getByText("原始音檔.wav", { exact: true }),
  ).toBeVisible();
  await info.attach("running-native-identity.json", {
    body: JSON.stringify(invariant, null, 2),
    contentType: "application/json",
  });
});

test("EN-04 English desktop and 320px retain readable forms, visible monitoring and keyboard alternatives", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkspace(page);
  await chooseLocale(page, "en");
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", /^3D scene\. Alt plus/);
  await page.screenshot({ path: info.outputPath("english-desktop.png"), timeout: 10_000 });
  await page.setViewportSize({ width: 320, height: 700 });
  await page
    .getByRole("navigation", { name: "Main panels", exact: true })
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  const bodyMode = page.getByRole("combobox", { name: "Rigid body mode", exact: true });
  await bodyMode.scrollIntoViewIfNeeded();
  await expect(bodyMode).toBeVisible();
  await expect(page.getByRole("button", { name: "Start simulation", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable listening", exact: true })).toBeVisible();
  const bounds = await bodyMode.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  const horizontal = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    appWidth: document.querySelector(".lab-app")?.clientWidth,
    appScrollWidth: document.querySelector(".lab-app")?.scrollWidth,
  }));
  expect(horizontal.scrollWidth).toBeLessThanOrEqual(horizontal.width);
  expect(horizontal.appScrollWidth!).toBeLessThanOrEqual(horizontal.appWidth!);
  await page.screenshot({ path: info.outputPath("english-320.png"), timeout: 10_000 });
  await page.getByRole("button", { name: "Enable listening", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtime = window.__reflectionLab;
        return (
          runtime?.getSnapshot().monitor.state === "audible" &&
          !(runtime as unknown as NativeRuntimeObservation).busy
        );
      }),
    )
    .toBe(true);
  await page.getByRole("slider", { name: "Monitor gain", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider", { name: "Monitor gain", exact: true })).toHaveValue("0.19");
  await page
    .getByRole("navigation", { name: "Main panels", exact: true })
    .getByRole("button", { name: "3D viewport", exact: true })
    .click();
  await page.getByRole("button", { name: "Enter first person", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page
    .getByRole("button", { name: "Enable controls without pointer lock", exact: true })
    .click();
  await page.locator(".viewport-accessible-movement summary").click();
  await expect(page.getByRole("button", { name: "Forward", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Look down", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit first person", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exit first person", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enter first person", exact: true })).toBeVisible();
});
