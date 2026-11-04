import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

type Json = ReturnType<typeof JSON.parse>;
const attempt = (process.env.PIPELINE_TAIL_AUDIT_ATTEMPT ?? "initial").replace(
  /[^A-Za-z0-9_.-]/g,
  "-",
);
const evidence = join(
  fileURLToPath(
    new URL(
      "../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/tail-validation/",
      import.meta.url,
    ),
  ),
  "attempts",
  attempt,
);
const cache = join(
  fileURLToPath(new URL("../../../.cache/ui-parameter-audit-tail/", import.meta.url)),
  attempt,
);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function waveClock(bytes: Buffer) {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WAVE");
  let channels = 0,
    rate = 0,
    format = 0,
    bits = 0,
    dataBytes = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = bytes.toString("ascii", offset, offset + 4),
      size = bytes.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      format = bytes.readUInt16LE(offset + 8);
      channels = bytes.readUInt16LE(offset + 10);
      rate = bytes.readUInt32LE(offset + 12);
      bits = bytes.readUInt16LE(offset + 22);
    }
    if (id === "data") {
      dataBytes = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  return {
    format,
    bits,
    rate,
    channels,
    frames: dataBytes / 4 / Math.max(channels, 1),
    durationS: dataBytes / 4 / Math.max(channels, 1) / Math.max(rate, 1),
  };
}

test("invalid tail remains blocked across repeated invalid drafts and valid quarter tail still renders", async ({
  page,
  browser,
}) => {
  await mkdir(evidence, { recursive: true });
  await mkdir(cache, { recursive: true });
  const receipt: Json = {
    schemaVersion: 1,
    attempt,
    status: "RUNNING",
    startedAtUtc: new Date().toISOString(),
    method: "Playwright CLI scripted DOM / headless Chrome",
    browser: browser.version(),
    expectedEntry: process.env.PIPELINE_RENDER_EXPECTED_ENTRY ?? null,
    expectedEntrySha256: process.env.PIPELINE_RENDER_EXPECTED_SHA256 ?? null,
    operationsBoundary:
      "Only UI input/buttons and actual downloads; no handler calls, runtime bridge, reset Scene or guard bypass",
    stages: [],
    downloads: [],
    servedAssets: [],
    pageErrors: [],
    agentRequests: [],
    blockedRequests: [],
    dialogs: [],
  };
  await writeFile(
    join(evidence, "tail-validation-receipt.json"),
    JSON.stringify(receipt, null, 2),
    { flag: "wx" },
  );
  const pendingAssets: Promise<void>[] = [];
  const seen = new Set<string>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin !== "http://127.0.0.1:4173" ||
      (!/\.(js|css)$/.test(url.pathname) && url.pathname !== "/") ||
      seen.has(url.href)
    )
      return;
    seen.add(url.href);
    pendingAssets.push(
      response
        .body()
        .then((bytes) => {
          receipt.servedAssets.push({ url: url.href, bytes: bytes.length, sha256: sha(bytes) });
        })
        .catch((error) => {
          receipt.servedAssets.push({ url: url.href, readError: String(error) });
        }),
    );
  });
  page.on("pageerror", (error) => receipt.pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/"))
      receipt.agentRequests.push(request.method() + " " + request.url());
  });
  page.on("dialog", async (dialog) => {
    receipt.dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
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
  async function download(button: Locator, label: string) {
    const started = page.waitForEvent("download");
    await button.click();
    const result = await started;
    const path = join(cache, label + "-" + result.suggestedFilename());
    await result.saveAs(path);
    const bytes = await readFile(path);
    const item = {
      label,
      path,
      filename: result.suggestedFilename(),
      bytes: bytes.length,
      sha256: sha(bytes),
      ...(result.suggestedFilename().endsWith(".wav") ? { wave: waveClock(bytes) } : {}),
    };
    receipt.downloads.push(item);
    return { bytes, item };
  }
  try {
    expect(receipt.expectedEntry, "Lease must supply expected entry environment").toBeTruthy();
    expect(receipt.expectedEntrySha256, "Lease must supply expected SHA environment").toBeTruthy();
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    const entryUrl = await page.locator("script[src]").first().getAttribute("src");
    expect(entryUrl).toContain(receipt.expectedEntry);
    const entryResponse = await page.request.get(entryUrl!);
    const entryBytes = await entryResponse.body();
    expect(sha(entryBytes)).toBe(receipt.expectedEntrySha256);
    receipt.entryPreflight = {
      url: entryResponse.url(),
      sha256: sha(entryBytes),
      matchesLease: true,
    };
    await page.getByRole("slider", { name: "監聽音量", exact: true }).press("Home");
    await expect(page.getByRole("button", { name: "啟用聆聽", exact: true })).toBeVisible();
    await page
      .locator(".object-row")
      .filter({ has: page.locator('[title="speaker"]') })
      .click();
    await page
      .getByRole("combobox", { name: "新增行為觸發條件", exact: true })
      .selectOption("AlwaysOn");
    const before = await page.locator(".behavior-card").count();
    await page.locator(".inspector").getByRole("button", { name: "新增", exact: true }).click();
    await expect(page.locator(".behavior-card")).toHaveCount(before + 1);
    await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
    const panel = page.locator(".render-panel");
    const tail = panel.getByRole("spinbutton", { name: "保留尾響 s", exact: true });
    const generate = panel.getByRole("button", { name: "產生音檔", exact: true });
    const manifestButton = panel.getByRole("button", { name: "下載來源與雜湊清單", exact: true });
    await panel.getByRole("checkbox", { name: "各聲源分軌", exact: true }).uncheck();
    await tail.fill("0");
    await tail.press("Enter");
    await panel.getByRole("button", { name: "錄製3秒", exact: true }).click();
    await expect(generate).toBeEnabled({ timeout: 60_000 });
    async function renderAndDownload(label: string, expectedTail: number) {
      await generate.press("Enter");
      await expect(panel.getByText("可下載", { exact: true })).toBeVisible({ timeout: 90_000 });
      await expect(generate).toBeEnabled();
      await expect(panel.locator(".render-output-list button")).toHaveCount(3);
      const wavs = [];
      for (const id of ["mix", "master", "dry"])
        wavs.push(
          await download(
            panel.getByRole("button", { name: "下載 " + id, exact: true }),
            label + "-" + id,
          ),
        );
      const result = await download(manifestButton, label + "-manifest");
      const manifest = JSON.parse(result.bytes.toString("utf8"));
      expect(manifest.job.window.tailFrames).toBe(expectedTail * 48000);
      for (const file of manifest.files as Json[]) {
        const actual = wavs.find((item) => item.item.filename === file.filename);
        expect(actual).toBeTruthy();
        expect(actual!.item.sha256).toBe(file.sha256.replace(/^sha256:/, ""));
        const wave = (actual!.item as { wave: ReturnType<typeof waveClock> }).wave;
        expect(wave.format).toBe(3);
        expect(wave.bits).toBe(32);
        expect(wave.channels).toBe(2);
        expect(wave.rate).toBe(48000);
        expect(wave.durationS).toBe(3 + expectedTail);
      }
      receipt.stages.push({
        label,
        atUtc: new Date().toISOString(),
        tailInput: await tail.inputValue(),
        tailSeconds: expectedTail,
        jobId: manifest.job.jobId,
        tailFrames: manifest.job.window.tailFrames,
        manifestSha256: result.item.sha256,
        outputs: manifest.files,
      });
      return result;
    }
    const baseline = await renderAndDownload("baseline-zero", 0);
    const oldButtons = await panel.locator(".render-output-list button").evaluateAll((buttons) =>
      buttons.map((button) => ({
        label: button.getAttribute("aria-label"),
        text: button.textContent?.trim(),
      })),
    );
    for (const raw of ["10.5", "10.50", ""]) {
      await tail.fill(raw);
      await tail.press("Enter");
      await expect(tail).toHaveAttribute("aria-invalid", "true");
      await expect(generate).toBeDisabled();
      expect(
        await tail.getAttribute("title"),
        "Invalid range has an actual accessible reason",
      ).toBeTruthy();
      expect(
        await panel.locator(".render-output-list button").evaluateAll((buttons) =>
          buttons.map((button) => ({
            label: button.getAttribute("aria-label"),
            text: button.textContent?.trim(),
          })),
        ),
      ).toEqual(oldButtons);
      const unchanged = await download(manifestButton, raw ? "invalid-" + raw : "invalid-blank");
      expect(unchanged.item.sha256).toBe(baseline.item.sha256);
      await expect(generate).toBeDisabled();
      receipt.stages.push({
        label: "invalid-stays-blocked",
        atUtc: new Date().toISOString(),
        raw,
        actualDraft: await tail.inputValue(),
        ariaInvalid: await tail.getAttribute("aria-invalid"),
        generateDisabled: await generate.isDisabled(),
        inputReason: await tail.getAttribute("title"),
        generateReason: await generate.getAttribute("title"),
        publishedManifestSha256: unchanged.item.sha256,
        oldOutputButtonsUntouched: true,
      });
    }
    await page.screenshot({ path: join(evidence, "invalid-blank-blocked.png"), fullPage: true });
    await tail.press("Escape");
    await expect(tail).toHaveValue("0");
    await expect(tail).toHaveAttribute("aria-invalid", "false");
    await expect(generate).toBeEnabled();
    receipt.stages.push({
      label: "escape-restores-committed-zero",
      value: await tail.inputValue(),
      generateEnabled: await generate.isEnabled(),
    });
    await tail.fill("0.25");
    await tail.press("Enter");
    await expect(tail).toHaveValue("0.25");
    await expect(tail).toHaveAttribute("aria-invalid", "false");
    await expect(generate).toBeEnabled();
    const nativeValidity = await tail.evaluate((element) => ({
      stepMismatch: (element as HTMLInputElement).validity.stepMismatch,
      valid: (element as HTMLInputElement).validity.valid,
    }));
    expect(nativeValidity.stepMismatch).toBe(true);
    receipt.stages.push({
      label: "finite-off-step-is-valid-app-policy",
      value: await tail.inputValue(),
      appGenerateEnabled: await generate.isEnabled(),
      nativeValidity,
    });
    await renderAndDownload("valid-quarter-tail", 0.25);
    await tail.fill("10");
    await tail.press("Enter");
    await expect(tail).toHaveAttribute("aria-invalid", "false");
    await expect(generate).toBeEnabled();
    await renderAndDownload("valid-maximum-tail", 10);
    await page.screenshot({ path: join(evidence, "maximum-tail-completed.png"), fullPage: true });
    expect(receipt.pageErrors).toEqual([]);
    expect(receipt.agentRequests).toEqual([]);
    expect(receipt.blockedRequests).toEqual([]);
    expect(receipt.dialogs).toEqual([]);
    receipt.status = "PASS";
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
    receipt.failureDom = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    await page.screenshot({ path: join(evidence, "failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled(pendingAssets);
    receipt.finishedAtUtc = new Date().toISOString();
    await writeFile(
      join(evidence, "tail-validation-receipt.json"),
      JSON.stringify(receipt, null, 2) + "\n",
    );
  }
});
