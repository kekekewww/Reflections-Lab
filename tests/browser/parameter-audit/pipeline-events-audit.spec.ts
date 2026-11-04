import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const attempt = process.env.PIPELINE_EVENTS_ATTEMPT ?? "";
if (attempt && !/^[a-z0-9-]+$/.test(attempt)) throw new Error("Invalid audit attempt name");
const evidenceDir = fileURLToPath(
  new URL(
    "../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/events/" +
      (attempt ? attempt + "/" : ""),
    import.meta.url,
  ),
);
const cacheDir = fileURLToPath(
  new URL(
    "../../../.cache/parameter-audit-pipeline-events/" + (attempt ? attempt + "/" : ""),
    import.meta.url,
  ),
);
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function inventory(panel: Locator) {
  return panel.evaluate((root) =>
    Array.from(root.querySelectorAll("button,input,[tabindex]")).map((node) => {
      const element = node as HTMLInputElement;
      const label =
        element.getAttribute("aria-label") ??
        (element.labels
          ? Array.from(element.labels, (item) => item.textContent?.trim() ?? "").join(" ")
          : "") ??
        "";
      return {
        tag: element.tagName.toLowerCase(),
        type: element.type ?? null,
        id: element.id || null,
        label: label || element.textContent?.trim() || null,
        role: element.getAttribute("role"),
        disabled: element.disabled ?? false,
        min: element.min || null,
        max: element.max || null,
        step: element.step || null,
        maxLength: element.maxLength >= 0 ? element.maxLength : null,
        value: element.value ?? null,
        ariaCurrent: element.getAttribute("aria-current"),
        ariaPressed: element.getAttribute("aria-pressed"),
        ariaValueText: element.getAttribute("aria-valuetext"),
      };
    }),
  );
}

async function runAudit(
  page: Page,
  name: string,
  action: (panel: Locator, record: (id: string, result: unknown) => void) => Promise<void>,
) {
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const actions: { id: string; result: unknown }[] = [];
  const assets: { url: string; bytes: number; sha256: string }[] = [];
  const blocked: { url: string; method: string }[] = [];
  const agentRequests: { url: string; method: string }[] = [];
  const errors: string[] = [];
  const responseJobs: Promise<void>[] = [];
  const receipt: Record<string, unknown> = {
    schemaVersion: 1,
    scope: "Events/recording real production browser DOM controls",
    scenario: name,
    attempt,
    rootReportedCandidate: process.env.PIPELINE_EVENTS_CANDIDATE ?? null,
    startedAt: new Date().toISOString(),
    browser: page.context().browser()?.version(),
    operations:
      "Visible pointer/keyboard only; evaluate reads DOM, no HostInternal or runtime bridge",
    notVerified: ["hearing", "native mouse/keyboard", "Meta live", "performance acceptance"],
    controls: {
      "events.record": "pointer and keyboard start/stop; recording and replay state dependencies",
      "events.replay": "empty/interrupted disabled, finalized and active playback",
      "events.export": "empty/active disabled, finalized and interrupted actual JSON downloads",
      "events.filter": "empty/exact/case-insensitive/whitespace/object/no-match Unicode",
      "events.seek": "range min0, maxduration, step0.001; pointer and keyboard bounds",
      "events.select.{eventId}": "pointer and keyboard stable-ID evidence",
      "events.table-scroll": "keyboard focus and scroll region",
      recordingImport: "ABSENT in EventsPanel; no fabricated control",
      abCapture: "ABSENT in EventsPanel; owned Comparison panel audit separately",
      eventDetails: "read-only evidence from selected event",
    },
    actions,
    assets,
    blocked,
    agentRequests,
    errors,
    status: "RUNNING",
  };
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/")) {
      agentRequests.push({ url: request.url(), method: request.method() });
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== "http://127.0.0.1:4173") return;
    if (url.pathname === "/" || /\.(?:js|css)$/.test(url.pathname)) {
      responseJobs.push(
        response
          .body()
          .then((bytes) => {
            assets.push({ url: response.url(), bytes: bytes.length, sha256: sha256(bytes) });
          })
          .catch(() => {}),
      );
    }
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.pathname.startsWith("/api/agent/propose") ||
      (["http:", "https:"].includes(url.protocol) && url.origin !== "http://127.0.0.1:4173")
    ) {
      blocked.push({ url: request.url(), method: request.method() });
      await route.abort("blockedbyclient");
    } else await route.continue();
  });

  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page
      .locator(".object-row")
      .filter({ has: page.locator('[title="floor"]') })
      .click();
    await page.getByRole("tab", { name: /^事件與錄放/ }).click();
    const panel = page.locator(".events-panel");
    receipt.initialInventory = await inventory(panel);
    await action(panel, (id, result) => actions.push({ id, result }));
    receipt.finalInventory = await inventory(panel);
    await page.screenshot({ path: evidenceDir + name + "-final.png", fullPage: true });
    expect(blocked).toEqual([]);
    expect(agentRequests.filter((request) => request.method === "POST")).toEqual([]);
    expect(errors).toEqual([]);
    receipt.status = "PASS";
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? error.stack : String(error);
    receipt.failureVisibleText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    await page
      .screenshot({ path: evidenceDir + name + "-failure.png", fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled(responseJobs);
    receipt.finishedAt = new Date().toISOString();
    await writeFile(evidenceDir + name + "-receipt.json", JSON.stringify(receipt, null, 2) + "\n");
  }
}

async function waitForTick(page: Page, minTick: number) {
  const recovery: { tick: number; action: string; reason: string }[] = [];
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const text = await page.locator(".run-status .subtle.mono").innerText();
    const tick = Number(text.match(/tick\s+(\d+)/)?.[1] ?? -1);
    if (tick >= minTick) return { reachedTick: tick, requiredTick: minTick, recovery };
    const resume = page.getByRole("button", { name: "繼續運算", exact: true });
    if (await resume.count()) {
      recovery.push({
        tick,
        action: "pointer resume",
        reason: await page.locator(".run-status").innerText(),
      });
      await resume.click();
    }
    await page.waitForTimeout(150);
  }
  throw new Error(
    "UI tick target not reached after explicit visible resume: " + JSON.stringify(recovery),
  );
}

async function exportArtifact(page: Page, panel: Locator, name: string) {
  const downloadEvent = page.waitForEvent("download");
  await panel.getByRole("button", { name: "匯出已封存錄製", exact: true }).click();
  const download = await downloadEvent;
  const path = cacheDir + name + ".recording.json";
  await download.saveAs(path);
  const bytes = await readFile(path);
  const artifact = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  return {
    path,
    suggestedFilename: download.suggestedFilename(),
    bytes: bytes.length,
    sha256: sha256(bytes),
    schemaVersion: artifact.schemaVersion,
    runId: artifact.runId,
    artifactSha256: artifact.artifactSha256,
    status: artifact.status,
    reason: artifact.reason,
    frameCount: Array.isArray(artifact.frames) ? artifact.frames.length : 0,
    startTick: artifact.startTick,
    endTick: artifact.endTick,
    eventCount: Array.isArray(artifact.events) ? artifact.events.length : null,
  };
}

test("events controls cover finalized recording replay seek and normalized event evidence", async ({
  page,
}) => {
  await runAudit(page, "finalized", async (panel, record) => {
    const start = panel.getByRole("button", { name: "● 開始錄製", exact: true });
    const replay = panel.getByRole("button", { name: "▶ 重播紀錄", exact: true });
    const exportButton = panel.getByRole("button", { name: "匯出已封存錄製", exact: true });
    const filter = panel.getByRole("searchbox", { name: "篩選事件", exact: true });
    await expect(start).toBeEnabled();
    await expect(replay).toBeDisabled();
    await expect(exportButton).toBeDisabled();
    await expect(panel.locator('input[type="range"]')).toHaveCount(0);
    record("empty-state", {
      record: "enabled",
      replay: "disabled",
      export: "disabled",
      "events.seek": "absent",
      controls: await inventory(panel),
    });

    const helpStates: { label: string; content: string; keyboardEscapeClosed: boolean }[] = [];
    for (const label of ["說明：▶ 重播紀錄", "說明：匯出已封存錄製", "說明：事件與錄放"]) {
      const help = panel.getByRole("button", { name: label, exact: true });
      await help.hover();
      await expect(page.locator('[role="tooltip"]:visible')).toHaveCount(1);
      const content = await page.locator('[role="tooltip"]:visible').innerText();
      expect(content.trim().length).toBeGreaterThan(0);
      await help.focus();
      await help.press("Escape");
      await expect(page.locator('[role="tooltip"]:visible')).toHaveCount(0);
      helpStates.push({ label, content, keyboardEscapeClosed: true });
    }
    record("help-pointer-focus-escape", helpStates);

    await filter.fill("不存在的事件 🧪");
    await expect(panel.getByText("沒有符合的事件", { exact: true })).toBeVisible();
    await filter.press("ControlOrMeta+A");
    await filter.press("Backspace");
    await expect(filter).toHaveValue("");
    record("filter-empty-no-match-keyboard-clear", { pass: true });

    await start.focus();
    await expect(start).toBeFocused();
    await start.press("Enter");
    await expect(panel.getByRole("button", { name: "■ 停止錄製", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(exportButton).toBeDisabled();
    await expect(replay).toBeDisabled();
    record("recording-state", {
      startedBy: "keyboard Enter",
      replay: "disabled",
      export: "disabled",
      controls: await inventory(panel),
    });
    record("first-recording-ticks", await waitForTick(page, 3));
    await panel.getByRole("button", { name: "■ 停止錄製", exact: true }).click();
    await expect(panel.getByText("紀錄已保存", { exact: true })).toBeVisible();
    await expect(replay).toBeEnabled();
    await expect(exportButton).toBeEnabled();
    const pause = page.getByRole("button", { name: "暫停", exact: true });
    if (await pause.count()) await pause.click();

    const archive = await exportArtifact(page, panel, "finalized");
    expect(archive.status).toBe("captured");
    expect(archive.frameCount).toBeGreaterThan(0);
    expect(archive.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
    record("export-finalized", archive);

    const rowButtons = panel.locator(".event-table tbody button.table-link");
    await expect(rowButtons.first()).toBeVisible();
    const eventType = (await rowButtons.first().innerText()).trim();
    await rowButtons.first().click();
    await expect(rowButtons.first()).toHaveAttribute("aria-current", "true");
    const evidence = panel.getByRole("complementary", { name: "選取事件詳細資料", exact: true });
    await expect(evidence).toBeVisible();
    await expect(evidence).toContainText(eventType);
    record("event-select-pointer", {
      eventType,
      eventId: await evidence.locator("dl.detail-list > div").first().locator("dd").innerText(),
      details: await evidence.innerText(),
    });

    await filter.fill("  " + eventType.toUpperCase() + "  ");
    await expect(rowButtons.first()).toBeVisible();
    expect((await rowButtons.allTextContents()).every((text) => text.trim() === eventType)).toBe(
      true,
    );
    record("filter-type-case-insensitive-trim", {
      query: await filter.inputValue(),
      rows: await rowButtons.count(),
    });
    await filter.fill("ball");
    await expect(panel.locator(".event-table tbody tr").first()).toContainText("ball");
    record("filter-object-id", {
      query: "ball",
      rows: await panel.locator(".event-table tbody tr").count(),
    });
    await filter.fill("rule.always");
    await expect(panel.locator(".event-table tbody tr").first()).toContainText("rule.always");
    record("filter-rule-id", {
      query: "rule.always",
      rows: await panel.locator(".event-table tbody tr").count(),
    });
    await filter.fill("RULE_MATCH");
    await expect(panel.locator(".event-table tbody tr").first()).toContainText("RULE_MATCH");
    record("filter-decision-reason", {
      query: "RULE_MATCH",
      rows: await panel.locator(".event-table tbody tr").count(),
    });

    await filter.fill("不存在的事件 🧪");
    await expect(panel.getByText("沒有符合的事件", { exact: true })).toBeVisible();
    await filter.fill("");
    await rowButtons.last().focus();
    await rowButtons.last().press("Enter");
    await expect(evidence).toBeVisible();
    const tableRegion = panel.getByRole("region", { name: "正規化事件表，可捲動", exact: true });
    await tableRegion.focus();
    await expect(tableRegion).toBeFocused();
    await tableRegion.press("End");
    record("event-evidence-keyboard-table-focus", {
      pass: true,
      eventId: await evidence.locator("dl.detail-list > div").first().locator("dd").innerText(),
      details: await evidence.innerText(),
    });

    await replay.click();
    const initialSlider = panel.getByRole("slider", { name: "重播時間", exact: true });
    await initialSlider.focus();
    await initialSlider.press("Home");
    const endReplay = panel.getByRole("button", { name: "結束重播", exact: true });
    await expect(endReplay).toBeVisible();
    await expect(start).toBeDisabled();
    await expect(exportButton).toBeEnabled();
    const slider = panel.getByRole("slider", { name: "重播時間", exact: true });
    await expect(slider).toBeEnabled();
    const max = Number(await slider.getAttribute("max"));
    expect(max).toBeGreaterThan(0);
    expect(await slider.getAttribute("min")).toBe("0");
    expect(await slider.getAttribute("step")).toBe("0.001");
    record("replay-state", {
      max,
      record: "disabled",
      export: "enabled",
      controls: await inventory(panel),
    });

    await slider.focus();
    await slider.press("Home");
    await slider.press("ArrowLeft");
    await expect(slider).toHaveValue("0");
    record("seek-lower-bound", {
      input: "Home then ArrowLeft",
      actual: await slider.inputValue(),
      ariaValueText: await slider.getAttribute("aria-valuetext"),
    });
    await slider.press("End");
    await slider.press("ArrowRight");
    const upper = Number(await slider.inputValue());
    const rangeStep = Number(await slider.getAttribute("step"));
    expect(upper).toBeLessThanOrEqual(max);
    expect(max - upper).toBeLessThan(rangeStep);
    expect(
      Number(
        (await page.locator(".run-status .subtle.mono").innerText()).match(/tick\s+(\d+)/)?.[1],
      ),
    ).toBe(archive.endTick);
    record("seek-upper-bound", {
      input: "End then ArrowRight",
      actual: await slider.inputValue(),
      max,
      ariaValueText: await slider.getAttribute("aria-valuetext"),
    });
    const box = await slider.boundingBox();
    expect(box).not.toBeNull();
    await slider.click({ position: { x: box!.width * 0.4, y: box!.height / 2 } });
    const middle = Number(await slider.inputValue());
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(max);
    record("seek-pointer-middle", {
      actual: middle,
      max,
      ariaValueText: await slider.getAttribute("aria-valuetext"),
    });
    const replayArchive = await exportArtifact(page, panel, "during-replay");
    expect(replayArchive.runId).toBe(archive.runId);
    record("export-during-replay", replayArchive);
    await endReplay.focus();
    await endReplay.press("Enter");
    await expect(start).toBeEnabled();
    await expect(replay).toBeEnabled();
    record("end-replay-keyboard", {
      record: "enabled",
      replay: "enabled",
      controls: await inventory(panel),
    });

    const beforeSecondTick = Number(
      (await page.locator(".run-status .subtle.mono").innerText()).match(/tick\s+(\d+)/)?.[1] ?? 0,
    );
    await start.click();
    await expect(panel.getByRole("button", { name: "■ 停止錄製", exact: true })).toBeVisible();
    await expect(exportButton).toBeEnabled();
    const retained = await exportArtifact(page, panel, "retained-during-second-recording");
    expect(retained.runId).toBe(archive.runId);
    record("new-recording-retains-prior-archive", {
      duringNewRecordingExport: "prior archive enabled",
      retained,
      controls: await inventory(panel),
    });
    record("second-recording-ticks", await waitForTick(page, beforeSecondTick + 3));
    await panel.getByRole("button", { name: "■ 停止錄製", exact: true }).click();
    await expect(exportButton).toBeEnabled();
    await expect(panel.getByText("紀錄已保存", { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "■ 停止錄製", exact: true })).toBeHidden();
    const secondArchive = await exportArtifact(page, panel, "second-finalized");
    expect(secondArchive.status).toBe("captured");
    expect(secondArchive.runId).not.toBe(archive.runId);
    record("second-record-stop", secondArchive);
  });
});

test("reset interruption preserves export but refuses replay and seek", async ({ page }) => {
  await runAudit(page, "interrupted", async (panel, record) => {
    await panel.getByRole("button", { name: "● 開始錄製", exact: true }).click();
    record("interrupted-recording-ticks", await waitForTick(page, 3));
    await page.getByRole("button", { name: "重設", exact: true }).click();
    await expect(page.locator(".run-status .subtle.mono")).toHaveText("tick 0");
    await expect(panel.getByText("中斷紀錄已封存；不可重播", { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "▶ 重播紀錄", exact: true })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "● 開始錄製", exact: true })).toBeEnabled();
    await expect(panel.locator('input[type="range"]')).toHaveCount(0);
    const archive = await exportArtifact(page, panel, "interrupted");
    expect(archive.status).toBe("interrupted");
    expect(archive.reason).toBe("RESET");
    expect(archive.frameCount).toBeGreaterThan(0);
    record("reset-interrupted-archive", { controls: await inventory(panel), archive });
  });
});

async function prepareFinalized(
  page: Page,
  panel: Locator,
  record: (id: string, result: unknown) => void,
) {
  await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
  await page.getByRole("button", { name: "錄製3秒", exact: true }).click();
  await page.getByRole("tab", { name: /^事件與錄放/ }).click();
  await expect(panel.getByText("紀錄已保存", { exact: true })).toBeVisible({ timeout: 60_000 });
  record("probe-recording-prerequisite", {
    method: "public Render panel capture3s button; no direct Host dispatch",
    controls: await inventory(panel),
  });
}

test("an enabled finalized seek control works before explicitly starting replay", async ({
  page,
}) => {
  await runAudit(page, "seek-before-replay", async (panel, record) => {
    await prepareFinalized(page, panel, record);
    const slider = panel.getByRole("slider", { name: "重播時間", exact: true });
    if (await slider.isDisabled()) {
      record("seek-before-replay", {
        admission: "disabled until replay",
        controls: await inventory(panel),
      });
      return;
    }
    await slider.focus();
    await slider.press("End");
    await page.waitForTimeout(300);
    const alerts = await page.getByRole("alert").allTextContents();
    record("seek-before-replay", {
      admission: "enabled",
      value: await slider.inputValue(),
      alerts,
      controls: await inventory(panel),
    });
    expect(alerts, "An enabled seek entry must work or be disabled with a reason").toEqual([]);
    expect(Number(await slider.inputValue())).toBeGreaterThan(0);
  });
});

test("natural replay completion admits a new recording or leaves an explicit exit", async ({
  page,
}) => {
  await runAudit(page, "natural-replay-end", async (panel, record) => {
    await prepareFinalized(page, panel, record);
    await panel.getByRole("button", { name: "▶ 重播紀錄", exact: true }).click();
    const slider = panel.getByRole("slider", { name: "重播時間", exact: true });
    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0);
    await expect(panel.getByText("紀錄已保存", { exact: true })).toBeVisible();
    const start = panel.getByRole("button", { name: "● 開始錄製", exact: true });
    const exit = panel.getByRole("button", { name: "結束重播", exact: true });
    record("natural-replay-completed-controls", {
      startEnabled: await start.isEnabled(),
      explicitExitCount: await exit.count(),
      controls: await inventory(panel),
    });
    if (await start.isDisabled()) {
      await expect(exit).toBeVisible();
      await exit.click();
    }
    await start.focus();
    await start.press("Enter");
    await page.waitForTimeout(300);
    const alerts = await page.getByRole("alert").allTextContents();
    record("natural-replay-new-recording", { alerts, controls: await inventory(panel) });
    expect(alerts, "New recording advertised as enabled must clear ended replay state").toEqual([]);
    await expect(panel.getByRole("button", { name: "■ 停止錄製", exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "■ 停止錄製", exact: true }).click();
  });
});
