import { expect, test, type Page, type Locator, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const auditAttempt = (process.env.PIPELINE_RENDER_AUDIT_ATTEMPT ?? "initial").replace(
  /[^A-Za-z0-9_.-]/g,
  "-",
);
const evidenceRoot = join(
  fileURLToPath(
    new URL(
      "../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/render/",
      import.meta.url,
    ),
  ),
  "attempts",
  auditAttempt,
);
const cacheRoot = join(
  fileURLToPath(new URL("../../../.cache/ui-parameter-audit-render/", import.meta.url)),
  auditAttempt,
);

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
type Receipt = {
  case: string;
  auditAttempt: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  browser: string;
  sourceAssets: unknown[];
  actions: Record<string, unknown>[];
  snapshots: unknown[];
  downloads: Record<string, unknown>[];
  blockedRequests: string[];
  agentRequests: string[];
  pageErrors: string[];
  findings: string[];
  error?: string;
};

async function snapshot(panel: Locator, label: string, receipt: Receipt) {
  const dom = await panel.evaluate((element) => ({
    text: (element as HTMLElement).innerText,
    controls: Array.from(
      element.querySelectorAll("input,button,select,progress,summary"),
      (control, index) => {
        const item = control as HTMLInputElement;
        return {
          index,
          tag: item.tagName.toLowerCase(),
          type: item.type ?? null,
          id: item.id,
          label:
            item.getAttribute("aria-label") ??
            item.closest("label")?.textContent?.trim() ??
            item.textContent?.trim(),
          text: item.textContent?.trim(),
          value: item.value ?? null,
          checked: item.type === "checkbox" ? item.checked : null,
          disabled: item.disabled ?? null,
          min: item.getAttribute("min"),
          max: item.getAttribute("max"),
          step: item.getAttribute("step"),
          ariaInvalid: item.getAttribute("aria-invalid"),
        };
      },
    ),
  }));
  receipt.snapshots.push({ label, at: new Date().toISOString(), ...dom });
  return dom;
}

const assetTasks = new WeakMap<Receipt, Promise<void>[]>();
async function open(page: Page, receipt: Receipt) {
  const pending: Promise<void>[] = [];
  const seenAssets = new Set<string>();
  assetTasks.set(receipt, pending);
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin !== "http://127.0.0.1:4173" ||
      !/\.(js|css)$/.test(url.pathname) ||
      seenAssets.has(url.href)
    )
      return;
    seenAssets.add(url.href);
    pending.push(
      response
        .body()
        .then((bytes) => {
          receipt.sourceAssets.push({ url: url.href, bytes: bytes.length, sha256: sha(bytes) });
        })
        .catch((error) => {
          receipt.sourceAssets.push({ url: url.href, readError: String(error) });
        }),
    );
  });
  page.on("pageerror", (error) => receipt.pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/"))
      receipt.agentRequests.push(request.method() + " " + request.url());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:4173") ||
      url.pathname.startsWith("/api/agent/propose")
    ) {
      receipt.blockedRequests.push(route.request().method() + " " + url.href);
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  const body = await response!.body();
  receipt.sourceAssets.push({ url: response!.url(), bytes: body.length, sha256: sha(body) });
  const assets = await page
    .locator("script[src],link[rel=stylesheet][href]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("src") ?? element.getAttribute("href")!),
    );
  for (const path of assets) {
    const response = await page.request.get(path);
    const bytes = await response.body();
    receipt.sourceAssets.push({ url: response.url(), bytes: bytes.length, sha256: sha(bytes) });
  }
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
  return page.locator(".render-panel");
}

async function sourceSetup(page: Page, receipt: Receipt) {
  for (const objectId of ["speaker", "ball"]) {
    await page
      .locator(".object-row")
      .filter({ has: page.locator('[title="' + objectId + '"]') })
      .click();
    await page
      .getByRole("combobox", { name: "新增行為觸發條件", exact: true })
      .selectOption("AlwaysOn");
    const count = await page.locator(".behavior-card").count();
    await page.locator(".inspector").getByRole("button", { name: "新增", exact: true }).click();
    await expect(page.locator(".behavior-card")).toHaveCount(count + 1);
    const card = page.locator(".behavior-card").last();
    await expect(card.getByRole("checkbox").first()).toBeChecked();
    await expect(card.getByRole("combobox", { name: "聲音素材", exact: true })).toHaveValue(
      "__oscillator",
    );
    receipt.actions.push({
      control: "setup.alwaysOn",
      objectId,
      modality: "pointer",
      outcome: "Added enabled deterministic procedural oscillator through Inspector UI",
      ruleText: await card.innerText(),
    });
  }
}

async function setTail(panel: Locator, value: string) {
  const input = panel.getByRole("spinbutton", { name: "保留尾響 s", exact: true });
  await input.fill(value);
  await input.press("Enter");
  await expect(input).toHaveValue(value);
  await expect(input).toHaveAttribute("aria-invalid", "false");
}

async function capture(panel: Locator, receipt: Receipt) {
  await panel.getByRole("button", { name: "錄製3秒", exact: true }).click();
  await expect(panel.getByRole("button", { name: "產生音檔", exact: true })).toBeEnabled({
    timeout: 60_000,
  });
  await snapshot(panel, "after-capture", receipt);
  receipt.actions.push({
    control: "render.capture-short",
    modality: "pointer",
    outcome: "Recorded through visible 3-second capture action; render became enabled",
  });
}

async function render(panel: Locator, receipt: Receipt, expectedOutputs: number) {
  await panel.getByRole("button", { name: "產生音檔", exact: true }).press("Enter");
  await expect(panel.getByText("可下載", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(panel.getByRole("button", { name: "產生音檔", exact: true })).toBeEnabled();
  await expect(panel.locator(".render-output-list li")).toHaveCount(expectedOutputs);
  await snapshot(panel, "completed", receipt);
}

function inspectWav(bytes: Buffer) {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WAVE");
  let channels = 0,
    rate = 0,
    bits = 0,
    format = 0,
    dataStart = 0,
    dataBytes = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      format = bytes.readUInt16LE(offset + 8);
      channels = bytes.readUInt16LE(offset + 10);
      rate = bytes.readUInt32LE(offset + 12);
      bits = bytes.readUInt16LE(offset + 22);
    }
    if (id === "data") {
      dataStart = offset + 8;
      dataBytes = length;
      break;
    }
    offset += 8 + length + (length % 2);
  }
  expect(format).toBe(3);
  expect(bits).toBe(32);
  expect(channels).toBe(2);
  expect(rate).toBe(48000);
  expect(dataStart + dataBytes).toBeLessThanOrEqual(bytes.length);
  let peak = 0,
    sumSquares = 0,
    nonfinite = 0;
  for (let offset = dataStart; offset + 4 <= dataStart + dataBytes; offset += 4) {
    const value = bytes.readFloatLE(offset);
    if (!Number.isFinite(value)) {
      nonfinite++;
      continue;
    }
    peak = Math.max(peak, Math.abs(value));
    sumSquares += value * value;
  }
  expect(nonfinite).toBe(0);
  expect(peak).toBeGreaterThan(0);
  return {
    format: "float32PCM",
    channels,
    sampleRateHz: rate,
    frames: dataBytes / 4 / channels,
    durationS: dataBytes / 4 / channels / rate,
    peakLinear: peak,
    rms: Math.sqrt(sumSquares / (dataBytes / 4)),
    nonfinite,
  };
}

async function download(
  page: Page,
  button: Locator,
  receipt: Receipt,
  caseName: string,
  useKeyboard = false,
) {
  const aria = await button.getAttribute("aria-label");
  const text = await button.innerText();
  const promise = page.waitForEvent("download");
  if (useKeyboard) await button.press("Enter");
  else await button.click();
  const result = await promise;
  const filename = result.suggestedFilename();
  const path = join(cacheRoot, caseName, filename);
  await mkdir(join(cacheRoot, caseName), { recursive: true });
  await result.saveAs(path);
  const bytes = await readFile(path);
  const item = {
    control: aria ?? text,
    filename,
    path,
    bytes: bytes.length,
    sha256: sha(bytes),
    modality: useKeyboard ? "keyboard Enter" : "pointer",
    ...(filename.endsWith(".wav") ? { wav: inspectWav(bytes) } : {}),
  };
  receipt.downloads.push(item);
  return { bytes, item };
}

async function allDownloads(
  page: Page,
  panel: Locator,
  receipt: Receipt,
  caseName: string,
  tailSeconds: number,
) {
  const outputs = panel.locator(".render-output-list button");
  const files = [];
  for (let index = 0; index < (await outputs.count()); index++)
    files.push(await download(page, outputs.nth(index), receipt, caseName, index % 2 === 1));
  const result = await download(
    page,
    panel.getByRole("button", { name: "下載來源與雜湊清單", exact: true }),
    receipt,
    caseName,
    true,
  );
  const manifest = JSON.parse(result.bytes.toString("utf8"));
  expect(manifest.job.window.tailFrames).toBe(tailSeconds * 48000);
  expect(manifest.job.outputs).toHaveLength(files.length);
  for (const entry of manifest.files) {
    const file = files.find((file) => file.item.filename === entry.filename);
    expect(file, "Manifest filename corresponds to a UI download").toBeTruthy();
    expect(file!.item.sha256).toBe(entry.sha256.replace(/^sha256:/, ""));
    expect((file!.item as { wav?: { durationS: number } }).wav?.durationS).toBe(3 + tailSeconds);
  }
  receipt.actions.push({
    control: "render.downloads-and-manifest",
    outcome:
      "All visible WAV outputs downloaded independently with manifest hashes, finite nonzero float32 samples and requested duration",
    files: manifest.files,
    window: manifest.job.window,
  });
  return manifest;
}

async function auditFooterReverb(page: Page, receipt: Receipt) {
  const cross: Record<string, unknown> = {
    case: "02-monitor-reverb-cross",
    startedAt: new Date().toISOString(),
    mainCaseReceipt: "02-min-tail-receipt.json",
    order: "Only after pre-enable -40 dB gain and manifest master.monitorGain=0.01 have passed",
    status: "RUNNING",
    steps: [],
  };
  const steps = cross.steps as Record<string, unknown>[];
  try {
    const gain = page.getByRole("slider", { name: "監聽音量", exact: true });
    const blocked = page.getByRole("button", { name: "啟用聆聽", exact: true });
    await expect(gain).toHaveValue("-40");
    await expect(blocked).toBeVisible();
    await expect(blocked).toHaveAttribute("aria-pressed", "true");
    steps.push({
      at: new Date().toISOString(),
      control: "monitor.gain",
      valueDb: await gain.inputValue(),
      listeningNotEnabled: true,
      mutedAriaPressed: await blocked.getAttribute("aria-pressed"),
    });
    const metadata = page.locator(".monitor-metadata");
    const reverb = page.locator(".monitor-reverb");
    await metadata.locator("summary").click();
    await expect(metadata).toHaveAttribute("open", "");
    await reverb.locator("summary").click();
    await expect(reverb).toHaveAttribute("open", "");
    await expect(metadata).not.toHaveAttribute("open", "");
    steps.push({
      at: new Date().toISOString(),
      control: "monitor.details + monitor.reverb-details",
      modality: "pointer click",
      outcome: "Opening reverb closes metadata",
      metadataOpen: await metadata.evaluate((element) => (element as HTMLDetailsElement).open),
      reverbOpen: await reverb.evaluate((element) => (element as HTMLDetailsElement).open),
    });
    await metadata.locator("summary").click();
    await expect(metadata).toHaveAttribute("open", "");
    await expect(reverb).not.toHaveAttribute("open", "");
    await reverb.locator("summary").click();
    await expect(reverb).toHaveAttribute("open", "");
    await expect(metadata).not.toHaveAttribute("open", "");
    const checkbox = reverb.getByRole("checkbox", {
      name: "啟用 Synthetic late reverb（perceptual）",
      exact: true,
    });
    cross.initialChecked = await checkbox.isChecked();
    cross.enabled = await checkbox.isEnabled();
    if (!(await checkbox.isEnabled())) {
      cross.status = "EXPECTED_UNAVAILABLE";
      cross.reason = "Actual checkbox is disabled; no override or fabricated toggle";
    } else {
      if (await checkbox.isChecked()) {
        await checkbox.click();
        await expect(checkbox).not.toBeChecked();
        steps.push({
          at: new Date().toISOString(),
          control: "monitor.reverb-enabled",
          modality: "pointer",
          checked: await checkbox.isChecked(),
          outcome: "Normalize actual initial checked state to false through UI",
        });
      }
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      steps.push({
        at: new Date().toISOString(),
        control: "monitor.reverb-enabled",
        modality: "pointer",
        checked: await checkbox.isChecked(),
      });
      await checkbox.press("Space");
      await expect(checkbox).not.toBeChecked();
      steps.push({
        at: new Date().toISOString(),
        control: "monitor.reverb-enabled",
        modality: "keyboard Space",
        checked: await checkbox.isChecked(),
      });
      await expect(gain).toHaveValue("-40");
      await expect(blocked).toBeVisible();
      await expect(blocked).toHaveAttribute("aria-pressed", "true");
      cross.status = "PASS";
      cross.listeningStillNotEnabled = true;
      cross.gainStillDb = await gain.inputValue();
    }
    await page.screenshot({
      path: join(evidenceRoot, "02-monitor-reverb-cross.png"),
      fullPage: true,
    });
    await reverb.locator("summary").click();
  } catch (error) {
    cross.status = "FAIL";
    cross.error = error instanceof Error ? error.stack : String(error);
    receipt.findings.push(
      "Supplemental footer reverb toggle failed; pre-enable master manifest assertion was completed first. See 02-monitor-reverb-cross-receipt.json",
    );
    await page
      .screenshot({
        path: join(evidenceRoot, "02-monitor-reverb-cross-failure.png"),
        fullPage: true,
      })
      .catch(() => {});
  } finally {
    cross.finishedAt = new Date().toISOString();
    receipt.actions.push({
      control: "monitor.reverb-enabled cross-lane",
      supplementalStatus: cross.status,
      separateReceipt: "02-monitor-reverb-cross-receipt.json",
    });
    await writeFile(
      join(evidenceRoot, "02-monitor-reverb-cross-receipt.json"),
      JSON.stringify(cross, null, 2) + "\n",
    );
  }
}

async function runCase(
  page: Page,
  info: TestInfo,
  name: string,
  action: (panel: Locator, receipt: Receipt) => Promise<void>,
) {
  await mkdir(evidenceRoot, { recursive: true });
  const receipt: Receipt = {
    case: name,
    auditAttempt,
    startedAt: new Date().toISOString(),
    status: "RUNNING",
    browser: page.context().browser()!.version(),
    sourceAssets: [],
    actions: [],
    snapshots: [],
    downloads: [],
    blockedRequests: [],
    agentRequests: [],
    pageErrors: [],
    findings: [],
  };
  await writeFile(
    join(evidenceRoot, name + "-receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
    { flag: "wx" },
  );
  try {
    const panel = await open(page, receipt);
    await snapshot(panel, "initial", receipt);
    await action(panel, receipt);
    expect(receipt.blockedRequests).toEqual([]);
    expect(receipt.agentRequests).toEqual([]);
    expect(receipt.pageErrors).toEqual([]);
    receipt.status = "PASS";
    await page.screenshot({ path: join(evidenceRoot, name + "-final.png"), fullPage: true });
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
    await page
      .screenshot({ path: join(evidenceRoot, name + "-failure.png"), fullPage: true })
      .catch(() => {});
    receipt.snapshots.push({
      label: "failure-body",
      text: await page
        .locator("body")
        .innerText()
        .catch(() => ""),
    });
    throw error;
  } finally {
    await Promise.allSettled(assetTasks.get(receipt) ?? []);
    receipt.finishedAt = new Date().toISOString();
    await writeFile(
      join(evidenceRoot, name + "-receipt.json"),
      JSON.stringify(receipt, null, 2) + "\n",
    );
    await info.attach("machine-readable-receipt", {
      path: join(evidenceRoot, name + "-receipt.json"),
      contentType: "application/json",
    });
  }
}

test("render controls expose valid bounds, invalid drafts and keyboard state without a take", async ({
  page,
}, info) => {
  await runCase(page, info, "01-controls", async (panel, receipt) => {
    const tail = panel.getByRole("spinbutton", { name: "保留尾響 s", exact: true });
    const stems = panel.getByRole("checkbox", { name: "各聲源分軌", exact: true });
    await expect(panel.getByRole("button", { name: "產生音檔", exact: true })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "錄製3秒", exact: true })).toBeEnabled();
    await expect(tail).toHaveValue("2");
    await expect(tail).toHaveAttribute("min", "0");
    await expect(tail).toHaveAttribute("max", "10");
    await expect(tail).toHaveAttribute("step", "0.5");
    await expect(stems).toBeChecked();
    for (const value of ["-0.5", "10.5", "", "1e309"]) {
      await tail.fill(value);
      await tail.press("Enter");
      await expect(tail).toHaveAttribute("aria-invalid", "true");
      receipt.actions.push({
        control: "render.tail",
        modality: "keyboard Enter",
        input: value,
        outcome: "Rejected invalid/unbounded draft; retained previous committed value for Escape",
        draft: await tail.inputValue(),
        error: await tail.getAttribute("title"),
      });
      await snapshot(panel, "invalid-tail-" + (value || "empty"), receipt);
      await tail.press("Escape");
      await expect(tail).toHaveValue("2");
      await expect(tail).toHaveAttribute("aria-invalid", "false");
    }
    await setTail(panel, "0");
    await tail.press("ArrowUp");
    await tail.press("Enter");
    await expect(tail).toHaveValue("0.5");
    await tail.press("ArrowDown");
    await tail.press("Enter");
    await expect(tail).toHaveValue("0");
    await setTail(panel, "0.25");
    receipt.actions.push({
      control: "render.tail",
      input: 0.25,
      modality: "keyboard Enter",
      outcome:
        "Finite off-step value accepted within bounds; 0.5 is arrow increment, not an extra host quantization rule",
    });

    await setTail(panel, "10");
    await tail.fill("0.5");
    await stems.click();
    await expect(tail).toHaveValue("0.5");
    await expect(tail).toHaveAttribute("aria-invalid", "false");
    await expect(stems).not.toBeChecked();
    await stems.press("Space");
    await expect(stems).toBeChecked();
    await stems.press("Space");
    await page.getByRole("tab", { name: "效能", exact: true }).click();
    await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
    await expect(tail).toHaveValue("0.5");
    await expect(stems).not.toBeChecked();
    const help = panel.locator(".help-tip-trigger");
    await help.hover();
    await expect(page.getByRole("tooltip").filter({ hasText: "完整錄製" })).toBeVisible();
    await help.press("Escape");
    await expect(page.getByRole("tooltip").filter({ hasText: "完整錄製" })).toBeHidden();
    await help.press("Tab");
    await expect(help).not.toBeFocused();
    await help.click();
    await expect(help).toBeFocused();
    const clickedTooltip = page.getByRole("tooltip").filter({ hasText: "完整錄製" });
    await expect(clickedTooltip).toBeVisible();
    const helpCaller = {
      method: "Playwright CLI scripted DOM / headless Chrome",
      sourcePath: "src/ui/RenderPanel.tsx",
      sourceLine: 48,
      sourceSiteId: "ui.renderpanel.renderpanel.helptip.82fad18b0d",
      topic: "音訊匯出",
      ariaLabel: await help.getAttribute("aria-label"),
      ariaDescribedBy: await help.getAttribute("aria-describedby"),
      hoverVerified: true,
      pointerClickVerified: true,
      focusedAfterClick: await help.evaluate((element) => element === document.activeElement),
      tooltipText: await clickedTooltip.innerText(),
    };
    await help.press("Escape");
    await expect(clickedTooltip).toBeHidden();
    await expect(help).toBeFocused();
    receipt.actions.push({
      control: "render.help.caller",
      ...helpCaller,
      escapeDismissed: true,
      focusedAfterEscape: await help.evaluate((element) => element === document.activeElement),
    });

    receipt.actions.push({
      control: "render.tail",
      modality: "keyboard + pointer blur",
      inputs: [0, 0.5, 10],
      outcome:
        "Bounds accepted, ArrowUp/Down uses 0.5, blur commits valid value, tab navigation retains draft",
    });
    receipt.actions.push({
      control: "render.stems",
      modality: "pointer + keyboard Space",
      outcome: "Toggles and persists across tab navigation",
    });
    receipt.actions.push({
      control: "render.help",
      modality: "hover + Escape",
      outcome: "Visible solver/recording scope tooltip dismissed by keyboard",
    });
    receipt.actions.push({
      control: "render.master-editor/name-editor",
      outcome: "ABSENT_NOT_A_CONTROL",
      detail:
        "Master is an output download, not an editable form; filenames are generated, no rename/master processing editor appears in this panel.",
    });
  });
});

test("zero tail and stems off produce three real downloadable non-silent outputs", async ({
  page,
}, info) => {
  await runCase(page, info, "02-min-tail", async (panel, receipt) => {
    await expect(page.getByRole("button", { name: "啟用聆聽", exact: true })).toBeVisible();
    const monitorGain = page.getByRole("slider", { name: "監聽音量", exact: true });
    await monitorGain.press("Home");
    await expect(monitorGain).toHaveValue("-40");
    await expect(monitorGain).toHaveAttribute("aria-valuetext", "-40 dB");
    await expect(page.getByRole("button", { name: "啟用聆聽", exact: true })).toBeVisible();
    receipt.actions.push({
      control: "monitor.gain-to-render",
      modality: "keyboard Home",
      inputDb: -40,
      expectedLinearGain: 0.01,
      outcome:
        "Desired monitor gain changes before enabling listening; no live audio device was enabled",
    });
    await sourceSetup(page, receipt);
    await setTail(panel, "0");
    await panel.getByRole("checkbox", { name: "各聲源分軌", exact: true }).uncheck();
    await capture(panel, receipt);
    await expect(page.getByRole("button", { name: "啟用聆聽", exact: true })).toBeVisible();
    const invalidTail = panel.getByRole("spinbutton", { name: "保留尾響 s", exact: true });
    await invalidTail.fill("10.5");
    await invalidTail.press("Enter");
    await expect(invalidTail).toHaveAttribute("aria-invalid", "true");
    const renderEnabledWithInvalidDraft = await panel
      .getByRole("button", { name: "產生音檔", exact: true })
      .isEnabled();
    receipt.actions.push({
      control: "render.tail",
      input: 10.5,
      committedValue: 0,
      modality: "keyboard Enter",
      outcome: "Available-take invalid draft state observed",
      renderButtonEnabled: renderEnabledWithInvalidDraft,
    });
    if (renderEnabledWithInvalidDraft)
      receipt.findings.push(
        "The render action remains enabled while the visible tail draft is invalid; subsequent download is checked against the last valid committed tail (0), not the rejected 10.5 draft.",
      );
    await snapshot(panel, "invalid-tail-with-available-take", receipt);
    if (!renderEnabledWithInvalidDraft) await invalidTail.press("Escape");
    await render(panel, receipt, 3);
    const manifest = await allDownloads(page, panel, receipt, "min-tail", 0);
    expect(manifest.configuration.master.monitorGain).toBeCloseTo(0.01, 12);
    receipt.actions.push({
      control: "monitor.gain-to-render",
      outcome: "Downloaded manifest pins pre-enable desired monitor gain",
      monitorGain: manifest.configuration.master.monitorGain,
    });
    await expect(panel.getByRole("button", { name: /^下載 stem-/ })).toHaveCount(0);
    await auditFooterReverb(page, receipt);
  });
});

test("maximum tail supports cancel, preserves published outputs and retries", async ({
  page,
}, info) => {
  await runCase(page, info, "03-cancel-max-tail", async (panel, receipt) => {
    await sourceSetup(page, receipt);
    await setTail(panel, "0");
    await panel.getByRole("checkbox", { name: "各聲源分軌", exact: true }).uncheck();
    await capture(panel, receipt);
    await render(panel, receipt, 3);
    const before = await download(
      page,
      panel.getByRole("button", { name: "下載來源與雜湊清單", exact: true }),
      receipt,
      "cancel-before",
    );
    const previous = JSON.parse(before.bytes.toString("utf8"));
    await setTail(panel, "10");
    const cancel = panel.getByRole("button", { name: "取消", exact: true });
    const busyObservation = panel.evaluate(
      (element) =>
        new Promise<Record<string, unknown>>((resolve) => {
          const observer = new MutationObserver(read);
          const timer = window.setTimeout(() => {
            observer.disconnect();
            resolve({
              observed: false,
              reason: "Rendering state was not caught by bounded DOM observation",
            });
          }, 5000);
          function read() {
            const buttons = Array.from(element.querySelectorAll("button"), (button) => ({
              text: button.textContent?.trim(),
              disabled: button.disabled,
            }));
            if (!buttons.some((button) => button.text === "取消")) return;
            const fields = Array.from(element.querySelectorAll("input"), (input) => ({
              label:
                input.getAttribute("aria-label") ?? input.closest("label")?.textContent?.trim(),
              disabled: input.disabled,
              value: input.value,
            }));
            const progress = element.querySelector("progress");
            observer.disconnect();
            window.clearTimeout(timer);
            resolve({
              observed: true,
              buttons,
              fields,
              progress: progress ? { value: progress.value, max: progress.max } : null,
            });
          }
          observer.observe(element, { childList: true, subtree: true, attributes: true });
          read();
        }),
    );
    const cancellation = cancel
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => cancel.click());

    await panel.getByRole("button", { name: "產生音檔", exact: true }).press("Enter");
    await cancellation;
    const busy = await busyObservation;
    receipt.snapshots.push({ label: "rendering-before-cancel", ...busy });
    expect(busy.observed, "Bounded DOM observer captured real rendering controls").toBe(true);
    for (const label of ["保留尾響 s", "各聲源分軌"]) {
      expect(
        (busy.fields as { label: string; disabled: boolean }[]).find(
          (field) => field.label === label,
        )?.disabled,
      ).toBe(true);
    }
    expect(
      (busy.buttons as { text: string; disabled: boolean }[]).find(
        (button) => button.text === "錄製3秒",
      )?.disabled,
    ).toBe(true);

    await expect(cancel).toBeHidden({ timeout: 60_000 });
    await expect(panel.getByRole("button", { name: "產生音檔", exact: true })).toBeEnabled();
    const after = await download(
      page,
      panel.getByRole("button", { name: "下載來源與雜湊清單", exact: true }),
      receipt,
      "cancel-after",
    );
    expect(JSON.parse(after.bytes.toString("utf8")).job.jobId).toBe(previous.job.jobId);
    expect(after.item.sha256).toBe(before.item.sha256);
    receipt.actions.push({
      control: "render.cancel",
      modality: "pointer while rendering",
      outcome:
        "Cancel exits busy state and preserves last completely published manifest, without partial replacement",
    });
    await snapshot(panel, "after-cancel", receipt);
    await render(panel, receipt, 3);
    await allDownloads(page, panel, receipt, "max-tail-retry", 10);
    receipt.actions.push({
      control: "render.tail",
      input: 10,
      outcome: "Maximum accepted; retry output has requested 13-second clock",
    });
  });
});

test("stems on downloads mix master dry both stems and manifest individually", async ({
  page,
}, info) => {
  await runCase(page, info, "04-source-stems", async (panel, receipt) => {
    await sourceSetup(page, receipt);
    await expect(panel.getByRole("checkbox", { name: "各聲源分軌", exact: true })).toBeChecked();
    await setTail(panel, "2");
    await capture(panel, receipt);
    await render(panel, receipt, 5);
    const manifest = await allDownloads(page, panel, receipt, "source-stems", 2);
    expect(manifest.job.outputs.map((output: { id: string }) => output.id).slice(0, 3)).toEqual([
      "mix",
      "master",
      "dry",
    ]);
    expect(
      manifest.job.outputs.filter((output: { id: string }) => output.id.startsWith("stem-")),
    ).toHaveLength(2);
    receipt.actions.push({
      control: "render.stems",
      input: true,
      outcome:
        "True per-object stems for speaker and ball; five WAV files individually downloaded, not a combined download shortcut",
    });
  });
});
