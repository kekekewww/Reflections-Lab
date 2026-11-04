import type { Locator, Page } from "@playwright/test";
import type { RenderExportManifest } from "../../../src/audio/render-types.js";
import { test, expect, type S4Evidence } from "./s4-fixtures.js";
import { inspectRecording, inspectSourceClockEvidence, verifyRenderBundle } from "./s4-evidence.js";

async function openExport(page: Page) {
  await page.goto("/");
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  return page.locator(".render-panel");
}
async function prepareSources(page: Page) {
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("zh-TW");
  for (const id of ["speaker", "ball"]) {
    await page
      .locator(".object-row")
      .filter({ has: page.locator(`[title="${id}"]`) })
      .click();
    await page
      .getByRole("combobox", { name: "新增行為觸發條件", exact: true })
      .selectOption("AlwaysOn");
    const count = await page.locator(".behavior-card").count();
    await page.locator(".inspector").getByRole("button", { name: "新增", exact: true }).click();
    await expect(page.locator(".behavior-card")).toHaveCount(count + 1);
  }
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
}
async function capture(panel: Locator, seconds: number) {
  const duration = panel.getByRole("spinbutton", { name: "Capture duration s", exact: true });
  await duration.fill(String(seconds));
  await duration.press("Enter");
  await panel
    .getByRole("button", {
      name: `Capture ${seconds} ${seconds === 1 ? "second" : "seconds"}`,
      exact: true,
    })
    .click();
  await expect(panel.getByRole("button", { name: "Render audio files", exact: true })).toBeEnabled({
    timeout: 180_000,
  });
}
async function recordingDownload(page: Page, evidence: S4Evidence, label: string) {
  await page.getByRole("tab", { name: /^Events & recording/ }).click();
  const download = await evidence.download(
    page.getByRole("button", { name: "Export archived recording", exact: true }),
    label,
  );
  const recording = inspectRecording(download.bytes);
  evidence.attach(label, recording);
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  return { download, recording };
}
async function renderFiles(panel: Locator) {
  await panel.getByRole("button", { name: "Render audio files", exact: true }).click();
  await expect(panel.getByText("Ready", { exact: true })).toBeVisible({ timeout: 180_000 });
}
const archivePanel = (page: Page) =>
  page
    .locator(".render-panel details")
    .filter({ has: page.locator("summary", { hasText: "Local audio archive" }) });
const recoveryPanel = (page: Page) =>
  page
    .locator(".recovery-panel")
    .filter({ has: page.locator("summary", { hasText: "Interrupted recording recovery" }) });
const jobRow = (archive: Locator, page: Page, id: string) =>
  archive.locator(".recovery-list > li").filter({ has: page.getByText(id, { exact: true }) });
async function directBundle(
  panel: Locator,
  evidence: S4Evidence,
  label: string,
  recording: ReturnType<typeof inspectRecording>,
) {
  const manifestDownload = await evidence.download(
    panel.getByRole("button", { name: "Download provenance manifest", exact: true }),
    `${label}-manifest`,
  );
  const manifest = JSON.parse(manifestDownload.bytes.toString("utf8")) as RenderExportManifest;
  const files = new Map<string, Uint8Array>();
  for (const file of manifest.files)
    files.set(
      file.id,
      (
        await evidence.download(
          panel.getByRole("button", { name: `Download ${file.id}`, exact: true }),
          `${label}-${file.id}`,
        )
      ).bytes,
    );
  const inspection = verifyRenderBundle(manifestDownload.bytes, recording, files);
  evidence.attach(label, inspection);
  return { manifest, manifestDownload, inspection };
}
async function interruptCapture(page: Page, panel: Locator) {
  const duration = panel.getByRole("spinbutton", { name: "Capture duration s", exact: true });
  await duration.fill("60");
  await duration.press("Enter");
  await panel.getByRole("button", { name: "Capture 60 seconds", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Capture 60 seconds", exact: true }),
  ).toHaveAttribute("aria-busy", "true");
  await page.getByRole("tab", { name: /^Events & recording/ }).click();
  await expect
    .poll(
      async () => {
        const text = await page.getByRole("tabpanel", { name: /^Events & recording/ }).innerText();
        return Number(/([0-9.]+) s · \d+ recorded events/.exec(text)?.[1] ?? "0");
      },
      { timeout: 30_000, intervals: [20, 50, 100] },
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Capture 60 seconds", exact: true }),
  ).toHaveAttribute("aria-busy", "false");
}

test("duration drafts respect integer bounds, Escape, locale, and independent render validity", async ({
  page,
  s4,
}) => {
  const panel = await openExport(page);
  const duration = panel.getByRole("spinbutton", { name: "Capture duration s", exact: true });
  const captureButton = panel.getByRole("button", { name: /^Capture \d+ seconds?$/ });
  const generate = panel.getByRole("button", { name: "Render audio files", exact: true });
  await expect(captureButton).toHaveText("Capture 3 seconds");
  await expect(duration).toHaveAttribute("min", "1");
  await expect(duration).toHaveAttribute("max", "60");
  await expect(duration).toHaveAttribute("step", "1");
  const help = panel.getByRole("button", { name: "About Capture duration", exact: true });
  await help.focus();
  await expect(page.getByRole("tooltip")).toContainText("1–60 seconds");
  await help.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  s4.cover("UI-CAPTURE-001", "default-label-unit-bounds-and-keyboard-help");
  for (const value of ["1", "60"]) {
    await duration.fill(value);
    await duration.press("Enter");
    await expect(captureButton).toHaveText(
      `Capture ${value} ${value === "1" ? "second" : "seconds"}`,
    );
    await expect(captureButton).toBeEnabled();
  }
  await capture(panel, 1);
  for (const value of ["0", "61", "1.5", ""]) {
    await duration.fill(value);
    await duration.press("Enter");
    await expect(duration).toHaveAttribute("aria-invalid", "true");
    await expect(captureButton).toBeDisabled();
    await expect(generate).toBeEnabled();
    await s4.snapshot(`invalid-duration-${value || "empty"}`, panel);
    await duration.press("Escape");
    await expect(duration).toHaveValue("1");
    await expect(captureButton).toBeEnabled();
  }
  s4.cover("UI-CAPTURE-003", "zero-above-max-fraction-empty-rejected-and-Escape-restored");
  const tail = panel.getByRole("spinbutton", { name: "Tail s", exact: true });
  await tail.fill("11");
  await tail.press("Enter");
  await expect(generate).toBeDisabled();
  await expect(captureButton).toBeEnabled();
  await tail.press("Escape");
  s4.cover("UI-CAPTURE-004", "duration-and-tail-only-block-their-own-action");
  await duration.focus();
  await duration.press("Tab");
  await expect(help).toBeFocused();
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("zh-TW");
  await expect(panel.getByRole("spinbutton", { name: "錄製長度 s", exact: true })).toHaveValue("1");
  await expect(panel.getByRole("button", { name: "錄製1秒", exact: true })).toBeEnabled();
  await s4.snapshot("duration-zh-100percent", panel);
  s4.cover("UI-CAPTURE-006", "Tab-Enter-Escape-and-locale-preserve-value", {
    nativeIme: "NOT_RUN",
    visualInspection: "SEPARATE",
  });
});

test("published archive survives reload, verifies every file, and deletes only the selected job", async ({
  page,
  s4,
}) => {
  let panel = await openExport(page);
  await prepareSources(page);
  await capture(panel, 1);
  const saved = await recordingDownload(page, s4, "short-source-recording");
  expect(saved.recording.frameCount).toBe(60);
  await renderFiles(panel);
  const first = await directBundle(panel, s4, "first-published", saved.recording);
  await panel.getByRole("spinbutton", { name: "Tail s", exact: true }).fill("0");
  await panel.getByRole("spinbutton", { name: "Tail s", exact: true }).press("Enter");
  await renderFiles(panel);
  const secondDownload = await s4.download(
    panel.getByRole("button", { name: "Download provenance manifest", exact: true }),
    "second-manifest",
  );
  const second = JSON.parse(secondDownload.bytes.toString("utf8")) as RenderExportManifest;
  expect(second.job.jobId).not.toBe(first.manifest.job.jobId);
  await page.reload();
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  panel = page.locator(".render-panel");
  const archive = archivePanel(page);
  await archive.locator("summary").click();
  const kept = jobRow(archive, page, first.manifest.job.jobId),
    removed = jobRow(archive, page, second.job.jobId);
  await expect(kept).toContainText("Published");
  await expect(removed).toContainText("Published");
  for (const value of ["384.00 MiB", "192.00 MiB", "2.00 MiB", "64 jobs"])
    await expect(archive).toContainText(value);
  const archivedManifest = await s4.download(
    kept.getByRole("button", { name: /^Download provenance manifest/ }),
    "reloaded-first-manifest",
  );
  expect(archivedManifest.sha256).toBe(first.manifestDownload.sha256);
  const archivedFiles = new Map<string, Uint8Array>();
  for (const file of first.manifest.files)
    archivedFiles.set(
      file.id,
      (
        await s4.download(
          kept.getByRole("button", {
            name: `Download ${file.id} · ${first.manifest.job.jobId}`,
            exact: true,
          }),
          `reloaded-${file.id}`,
        )
      ).bytes,
    );
  s4.attach(
    "durable-reload-bundle",
    verifyRenderBundle(archivedManifest.bytes, saved.recording, archivedFiles),
  );
  s4.cover("UI-ARCHIVE-001", "two-published-identities-survive-real-reload");
  s4.cover("UI-ARCHIVE-002", "payload-reservation-and-all-declared-caps-visible");
  s4.cover("UI-ARCHIVE-003", "every-retained-WAV-and-manifest-download-verified");
  await removed.getByRole("button", { name: /^Delete this archive/ }).click();
  await expect(removed).toContainText(second.job.jobId);
  await expect(removed).toContainText("This cannot be undone");
  await removed.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(
    archive.getByRole("button", { name: "Check and recover archive", exact: true }),
  ).toBeFocused();
  await expect(removed).toBeVisible();
  await removed.getByRole("button", { name: /^Delete this archive/ }).click();
  await removed.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(removed).toHaveCount(0);
  await expect(kept).toContainText("Published");
  await expect(
    archive.getByRole("button", { name: "Check and recover archive", exact: true }),
  ).toBeFocused();
  const preserved = await s4.download(
    kept.getByRole("button", { name: /^Download provenance manifest/ }),
    "kept-valid-after-selected-delete",
  );
  expect(preserved.sha256).toBe(first.manifestDownload.sha256);
  await s4.snapshot("archive-selected-delete-preserves-other-valid", archive);
  s4.cover("UI-ARCHIVE-004", "selected-delete-Keep-confirm-focus-and-other-valid-preserved");
});

test("public 60-second capture renders a verified 62-second five-file bundle", async ({
  page,
  s4,
}) => {
  test.setTimeout(300_000);
  const panel = await openExport(page);
  await prepareSources(page);
  await capture(panel, 60);
  const saved = await recordingDownload(page, s4, "public-60s-source");
  expect(saved.recording.frameCount).toBe(3600);
  expect(saved.recording.endTick - saved.recording.startTick + 1).toBe(3600);
  expect(saved.recording.fixedDtS).toBe(1 / 60);
  expect(saved.recording.sampleRateHz).toBe(48000);
  const clocks = inspectSourceClockEvidence(saved.download.bytes);
  expect(clocks.preStepFrames).toBe(3600);
  s4.attach("public-60s-source-clock-provenance", {
    ...clocks,
    publicInterval: "3600acceptedtickframes;firsttickispost-step",
    independentCapacityFixture: "3601inclusiveframesseparate;notclaimedbythisUIcase",
  });
  await renderFiles(panel);
  const bundle = await directBundle(panel, s4, "public-62s-output", saved.recording);
  expect(bundle.manifest.files).toHaveLength(5);
  expect(bundle.inspection.stemSum?.status).toBe("VERIFIED");
  expect(bundle.inspection.stemSum?.tolerance).toBe(2e-6);
  expect(bundle.inspection.stemSum?.maximumAbsoluteError).toBeLessThanOrEqual(2e-6);
  expect(bundle.inspection.stemSum?.comparedSamples).toBe(5_952_000);
  expect(bundle.inspection.frameCountPerFile).toBe(2_976_000);
  expect(
    bundle.inspection.files.every((file) => file.frames === 2_976_000 && file.bytes === 23_808_056),
  ).toBe(true);
  expect(bundle.inspection.files.reduce((sum, file) => sum + file.bytes, 0)).toBe(119_040_280);
  const archive = archivePanel(page);
  await archive.locator("summary").click();
  await expect(
    panel.getByRole("button", { name: "Capture 60 seconds", exact: true }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Render audio files", exact: true }),
  ).toBeDisabled();
  await expect(
    panel.getByText(
      "A local archive operation is in progress. Wait before capturing or rendering.",
      { exact: true },
    ),
  ).toBeVisible();
  await s4.snapshot("full-archive-validation-pending-locks-primary-actions", panel);
  await expect(
    archive.getByRole("button", { name: "Check and recover archive", exact: true }),
  ).toBeEnabled({ timeout: 120_000 });
  await expect(
    panel.getByRole("button", { name: "Capture 60 seconds", exact: true }),
  ).toBeEnabled();
  s4.cover(
    "UI-ARCHIVE-006",
    "real-full-payload-recovery-pending-locks-and-releases-primary-actions",
    {
      payloadBytes: 119_040_280,
      duplicateActionPolicy: "Host/store unit guards remain separately pinned",
    },
  );
  await s4.snapshot("public-60s-complete-five-output-62s", panel);
  s4.cover("UI-CAPTURE-002", "public-max-60-completed-and-62-second-files-verified", {
    frameCount: 3600,
    capacity3601: "SEPARATE_COMPONENT_EVIDENCE",
    propagationDspReference: "SEPARATE_NATIVE_GATE",
  });
});

test("Pause preserves an interrupted prefix that exports as interrupted after real reload", async ({
  page,
  s4,
}) => {
  const panel = await openExport(page);
  await interruptCapture(page, panel);
  s4.cover("UI-CAPTURE-005", "public-Pause-interrupts-in-progress-controlled-capture");
  await page.reload();
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  const recovery = recoveryPanel(page);
  await recovery.locator("summary").click();
  const entry = recovery.locator(".recovery-list > li").first();
  await expect(entry).toBeVisible();
  await expect(recovery).toContainText("not a complete take or complete WAV");
  const identityText = await entry.innerText();
  await entry.getByRole("button", { name: /^Load verified prefix/ }).click();
  await expect(recovery.getByRole("status")).toContainText("verified interrupted prefix");
  const saved = await recordingDownload(page, s4, "verified-interrupted-prefix");
  expect(saved.recording.status).toBe("interrupted");
  expect(saved.recording.frameCount).toBeGreaterThan(0);
  expect(saved.recording.frameCount).toBeLessThan(3600);
  expect(identityText).toContain(saved.recording.runId);
  expect(identityText).toContain(saved.recording.runEpoch);
  expect(identityText).toContain(`r${saved.recording.sceneRevision}`);
  await expect(
    page.getByRole("button", { name: "Render audio files", exact: true }),
  ).toBeDisabled();
  s4.cover("UI-RECOVERY-002", "real-interrupted-prefix-export-is-not-captured-or-renderable");
  s4.cover(
    "UI-RECOVERY-004",
    "reloaded-session-run-epoch-revision-counters-match-exported-prefix",
    saved.recording,
  );
  await entry.getByRole("button", { name: /^Discard this interrupted recording/ }).click();
  await expect(entry).toContainText("Completed recordings are retained");
  await entry.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(
    recovery.getByRole("button", { name: "Refresh recordings", exact: true }),
  ).toBeFocused();
  await expect(entry).toBeVisible();
  await entry.getByRole("button", { name: /^Discard this interrupted recording/ }).click();
  await entry.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(recovery.locator(".recovery-list > li")).toHaveCount(0);
  await expect(
    recovery.getByRole("button", { name: "Refresh recordings", exact: true }),
  ).toBeFocused();
  await s4.snapshot("interrupted-prefix-explicit-discard", recovery);
  s4.cover("UI-RECOVERY-005", "discard-Keep-confirm-and-completion-focus");
});

test("a stale recovery selection shows the real missing-session refusal and supports refresh", async ({
  page,
  s4,
}) => {
  const panel = await openExport(page);
  await interruptCapture(page, panel);
  const first = recoveryPanel(page);
  await first.locator("summary").click();
  const stale = first.locator(".recovery-list > li").first();
  await expect(stale).toBeVisible();
  const other = await s4.newPage();
  await openExport(other);
  const second = recoveryPanel(other);
  await second.locator("summary").click();
  const current = second.locator(".recovery-list > li").first();
  await current.getByRole("button", { name: /^Discard this interrupted recording/ }).click();
  await current.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(second.locator(".recovery-list > li")).toHaveCount(0);
  await stale.getByRole("button", { name: /^Load verified prefix/ }).click();
  await expect(first.getByRole("alert")).toContainText("RECOVERY_MISSING");
  await expect(first.getByRole("alert")).toContainText("could not be found");
  await expect(stale).toBeVisible();
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("zh-TW");
  await expect(first.getByRole("alert")).toContainText("找不到這份中斷錄製");
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
  await first.getByRole("button", { name: "Refresh recordings", exact: true }).click();
  await expect(first.locator(".recovery-list > li")).toHaveCount(0);
  await expect(first.getByRole("alert")).toHaveCount(0);
  await s4.snapshot("missing-session-bilingual-refusal-and-retry", first);
  s4.cover("UI-RECOVERY-005", "real-stale-list-failure-retains-row-until-explicit-retry");
  s4.cover("UI-RECOVERY-007", "public-cross-document-missing-refusal-bilingual", {
    otherFiveGuards: "UNIT_OR_CONDITIONAL_NOT_CLAIMED_BY_THIS_CASE",
  });
});

test("a live output writer cannot be discarded and document unload leaves private interrupted output", async ({
  page,
  s4,
}) => {
  test.setTimeout(300_000);
  const panel = await openExport(page);
  await prepareSources(page);
  await capture(panel, 1);
  await renderFiles(panel);
  const valid = await s4.download(
    panel.getByRole("button", { name: "Download provenance manifest", exact: true }),
    "old-valid-before-writer-interruption",
  );
  const oldJob = (JSON.parse(valid.bytes.toString("utf8")) as RenderExportManifest).job.jobId;
  await capture(panel, 60);
  const other = await s4.newPage();
  await openExport(other);
  const archive = archivePanel(other);
  await archive.locator("summary").click();
  const refresh = archive.getByRole("button", { name: "Check and recover archive", exact: true });
  await expect(refresh).toBeEnabled();
  await panel.getByRole("button", { name: "Render audio files", exact: true }).click();
  const writing = archive.locator(".recovery-list > li").filter({ hasText: "Writing" });
  for (let attempt = 0; attempt < 12 && (await writing.count()) === 0; attempt++) {
    await refresh.click();
    await expect(refresh).toBeEnabled();
  }
  await expect(writing).toHaveCount(1);
  await expect(writing).toContainText("still being written");
  await expect(writing.getByRole("button", { name: /^Discard incomplete output/ })).toBeDisabled();
  const interruptedId = await writing.locator("strong").innerText();
  await s4.snapshot("active-writer-cleanup-disabled", archive);
  s4.cover("UI-ARCHIVE-007", "real-cross-document-live-writer-visible-and-discard-disabled", {
    id: interruptedId,
  });
  await s4.closePage(
    page,
    "Interrupt the actual document-owned output writer; this is unload, not OS process crash.",
  );
  await refresh.click();
  await expect(refresh).toBeEnabled();
  const interrupted = jobRow(archive, other, interruptedId);
  await expect(interrupted).toContainText("Interrupted; no complete output");
  await expect(interrupted.getByRole("button", { name: /^Download/ })).toHaveCount(0);
  const kept = jobRow(archive, other, oldJob);
  await expect(kept).toContainText("Published");
  await interrupted.getByRole("button", { name: /^Discard incomplete output/ }).click();
  await interrupted.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(refresh).toBeFocused();
  await expect(interrupted).toBeVisible();
  await interrupted.getByRole("button", { name: /^Discard incomplete output/ }).click();
  await interrupted.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(interrupted).toHaveCount(0);
  await expect(kept).toContainText("Published");
  const retained = await s4.download(
    kept.getByRole("button", { name: /^Download provenance manifest/ }),
    "old-valid-after-incomplete-discard",
  );
  expect(retained.sha256).toBe(valid.sha256);
  await s4.snapshot("interrupted-output-discard-preserves-old-valid", archive);
  s4.cover("UI-ARCHIVE-005", "document-unload-interrupted-private-output-and-explicit-discard", {
    processCrash: "SEPARATE_NATIVE_QUALIFICATION",
  });
});

test("safe Meta refusal details render bilingually through a controlled HTTP fixture without model dispatch", async ({
  page,
  s4,
}) => {
  const refusals = [
    [
      "POLICY_DENIED",
      "Meta回覆含禁止的credential資料，未接受或保存內容。",
      "forbidden credential data",
    ],
    ["PROVIDER_REQUEST_FAILED", "Meta回覆缺失、拒絕或角色無效，未套用變更。", "invalid role"],
    ["PROVIDER_REQUEST_FAILED", "Meta回覆未完整完成，未接受提案。", "did not finish completely"],
    ["PROVIDER_REQUEST_FAILED", "Meta回覆不是有效UTF-8，未接受內容。", "not valid UTF-8"],
  ] as const;
  let selected = 0,
    fixtureResponses = 0;
  // These are synthetic public HTTP replies, not account state or a budget change.
  // The common network guard permits explicit fulfill, never a forwarded model POST.
  await page.route("**/api/agent/status", (route) =>
    route.fulfill({
      status: 200,
      json: {
        offline: {
          state: "AVAILABLE",
          provenance: "OFFLINE_DETERMINISTIC",
          modelId: null,
          cloudCostUsd: 0,
        },
        meta: {
          provider: "metaModelApi",
          state: "READY",
          reason: "S4 local HTTP fixture only; no model dispatch or payment",
          modelId: "fixture.never-dispatched",
          remainingQuota: null,
          liveValidation: "NOT_RUN",
          estimatedCostCeilingUsd: 0.01,
        },
      },
    }),
  );
  await page.route("**/api/agent/propose", (route) => {
    fixtureResponses++;
    return route.fulfill({
      status: 502,
      json: { error: { code: refusals[selected]![0], message: refusals[selected]![1] } },
    });
  });
  await openExport(page);
  await page.getByRole("tab", { name: "Meta experiment agent", exact: true }).click();
  const agent = page.locator(".agent-panel");
  await agent
    .getByRole("combobox", { name: "AI execution mode", exact: true })
    .selectOption("meta");
  await agent.getByRole("button", { name: "Check server status again", exact: true }).click();
  await agent
    .getByRole("textbox", { name: "Experiment instruction", exact: true })
    .fill("Set the floor material to concrete.");
  const revision = await page.locator(".project-name").innerText();
  for (selected = 0; selected < refusals.length; selected++) {
    await expect(
      agent.getByRole("button", { name: "Generate action preview", exact: true }),
    ).toBeEnabled();
    await agent.getByRole("button", { name: "Generate action preview", exact: true }).click();
    await expect(agent.getByRole("alert")).toContainText(refusals[selected]![0]);
    await expect(agent.getByRole("alert")).toContainText(refusals[selected]![2]);
    await expect(agent.locator(".agent-preview")).toHaveCount(0);
    expect(await page.locator(".project-name").innerText()).toBe(revision);
    await page
      .getByRole("combobox", { name: /介面語言.*Interface language/ })
      .selectOption("zh-TW");
    await expect(agent.getByRole("alert")).toContainText(refusals[selected]![1]);
    await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
    await s4.snapshot(`safe-refusal-http-fixture-${selected}`, agent);
  }
  expect(fixtureResponses).toBe(4);
  s4.attach("Meta HTTP fault fixture qualification", {
    fixtureOnly: true,
    modelDispatch: "NONE_ALL_POSTS_FULFILLED_LOCALLY",
    actualAuthorizedPaidBudgetUsd: 0,
    fictionalUiGateCeilingUsd: 0.01,
    liveIntegration: "NOT_RUN",
    accountOrQuotaVerification: "NOT_RUN",
    acceptedProposals: 0,
  });
  s4.cover("UI-META-001", "four-real-UI-error-branches-bilingual-via-explicit-HTTP-fault-fixture", {
    live: false,
    fixtureResponses,
  });
});
