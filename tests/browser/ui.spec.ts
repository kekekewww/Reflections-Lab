import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openWorkspace(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
}

test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return;
  const evidence = await page.evaluate(
    () => (window as Window & { __uiInputEvidence?: unknown[] }).__uiInputEvidence,
  );
  if (evidence)
    await info.attach("input-event-order.json", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
});

test("real workspace renders three panels and keeps collapsed splitters out of focus", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openWorkspace(page);
  await expect(page.getByRole("complementary", { name: "場景與素材" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "屬性檢查器" })).toBeVisible();
  await page.locator(".panel-controls").getByRole("button", { name: "場景", exact: true }).click();
  await expect(page.locator(".panel-divider-left")).toHaveAttribute("tabindex", "-1");
  await expect(page.locator(".panel-divider-right")).toBeVisible();
  await page.locator(".panel-controls").getByRole("button", { name: "場景", exact: true }).click();
  await expect(page.locator(".panel-divider-left")).toHaveAttribute("tabindex", "0");
  await page.screenshot({ path: info.outputPath("desktop.png"), timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("atmosphere controls change real solver paths and preserve gravity settings", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: /Listener \/ 環境/ }).click();
  const medium = page.getByRole("combobox", { name: "傳播介質" });
  await medium.selectOption("vacuum");
  await expect(medium).toHaveValue("vacuum");
  await expect(page.locator(".viewport-legend")).toContainText("0/0");
  await expect(page.getByText("真空不取消機械碰撞", { exact: false })).toBeVisible();
  await medium.selectOption("air");
  await expect(medium).toHaveValue("air");
  await expect(page.locator(".viewport-legend")).not.toContainText("0/0");
  await page.getByRole("button", { name: "ball ball 動態", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "剛體模式" })).toHaveValue("dynamicGravity");
});

test("synthetic perceptual reverb is explicit and raw reference stays selectable", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "啟用聆聽", exact: true }).click();
  await page.locator(".monitor-reverb summary").click();
  const enabled = page.getByRole("checkbox", {
    name: "啟用 Synthetic late reverb（perceptual）",
    exact: true,
  });
  await expect(enabled).not.toBeChecked();
  await enabled.check();
  await expect(enabled).toBeChecked();
  await expect(
    page.getByText("感知近似尾響；衰減參數不是測得的 RT60。Raw 參考旁路尾響。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Raw 參考", exact: true }).click();
  await expect(page.getByRole("button", { name: "Raw 參考", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await enabled.uncheck();
  await expect(enabled).not.toBeChecked();
});

test("actual pointer lock has explicit Enter resume, Tab exit and no acquisition throw", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const evidence: unknown[] = [];
    (window as Window & { __uiInputEvidence?: unknown[] }).__uiInputEvidence = evidence;
    const record = (event: Event) => {
      if (evidence.length >= 128) return;
      const target = event.target instanceof Element ? event.target : null;
      evidence.push({
        type: event.type,
        time: performance.now(),
        code: event instanceof KeyboardEvent ? event.code : null,
        trusted: event.isTrusted,
        target: target?.tagName,
        targetLabel: target?.textContent?.slice(0, 80),
        active: document.activeElement?.tagName,
        activeLabel: document.activeElement?.textContent?.slice(0, 80),
        lock: document.pointerLockElement?.tagName ?? null,
      });
    };
    for (const type of ["pointerlockchange", "keydown", "keyup", "focusin"])
      document.addEventListener(type, record, true);
    window.addEventListener("blur", record, true);
  });
  await openWorkspace(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await expect(page.getByRole("button", { name: /^(開始運算|繼續運算)$/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".transport-actions").getByRole("button", { name: "暫停", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".run-status .subtle.mono")).not.toHaveText("tick 0");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "繼續運算", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".transport-actions").getByRole("button", { name: "暫停", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.getByRole("button", { name: "繼續運算", exact: true })).toBeVisible();
  await expect(
    page.locator(".event-table").getByRole("button", { name: "OnThrow", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("searchbox", { name: "篩選事件" }).fill("WASD E 中文組字");
  await expect(page.getByRole("button", { name: "繼續運算", exact: true })).toBeVisible();
});

test("explicit alternative controls move the actual listener and enable a staged object", async ({
  page,
}, info) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.getByRole("button", { name: "啟用免鎖定操作", exact: true }).click();
  await expect(page.getByRole("button", { name: "停用免鎖定操作", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^(開始運算|繼續運算)$/ }).click();
  await page.getByRole("button", { name: /Listener \/ 環境/ }).click();
  const z = page
    .locator(".inspector .vector-fields")
    .first()
    .getByRole("spinbutton", { name: "Z", exact: true });
  const before = Number(await z.inputValue());
  await page.getByText("免鎖定移動與視角", { exact: true }).click();
  await page.getByRole("button", { name: "前進", exact: true }).click();
  await expect.poll(async () => Number(await z.inputValue())).not.toBe(before);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  for (let index = 0; index < 20; index += 1)
    await page.getByRole("button", { name: "向下看", exact: true }).click();
  await page.getByRole("button", { name: "切換建造", exact: true }).click();
  const place = page.getByRole("button", { name: "放置", exact: true });
  await expect(place).toBeEnabled();
  await place.click();
  await expect(page.getByRole("button", { name: "啟用物件", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("staged.png"), timeout: 10_000 });
  await page.getByRole("button", { name: "啟用物件", exact: true }).click();
  await expect(page.getByRole("button", { name: "啟用物件", exact: true })).toHaveCount(0);
  await expect(page.locator(".error-banner")).toHaveCount(0);
});

test("320 CSS px and reduced motion keep transport, monitor and forms reachable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkspace(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.locator(".monitor-mute")).toBeVisible();
  await page
    .getByRole("navigation", { name: "主要面板" })
    .getByRole("button", { name: "場景", exact: true })
    .click();
  await page.getByRole("button", { name: /Listener \/ 環境/ }).click();
  await expect(page.getByRole("combobox", { name: "傳播介質" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole("button", { name: "收合實驗面板", exact: true }).click();
  await page.locator(".monitor-reverb summary").click();
  const popup = await page.locator(".monitor-reverb-settings").boundingBox();
  expect(popup?.x).toBeGreaterThanOrEqual(0);
  expect((popup?.x ?? 0) + (popup?.width ?? 0)).toBeLessThanOrEqual(320);
  await expect(page.locator(".monitor-mute")).toBeInViewport({ ratio: 1 });
  await page.locator(".monitor-mute").click();
  await page.screenshot({ path: info.outputPath("mobile-320.png"), timeout: 10_000 });
  await page.locator(".monitor-reverb summary").click();
  const duration = await page
    .locator(".monitor-mute")
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration).toBe("0s");
  await page.setViewportSize({ width: 720, height: 500 });
  await expect(page.locator(".monitor-mute")).toBeVisible();
  await expect(page.locator(".monitor-mute")).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("reflow-720.png"), timeout: 10_000 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(500);
});

test("audio import advertises only the preflighted WAV formats", async ({ page }) => {
  await openWorkspace(page);
  await expect(page.locator(".scene-explorer input[type='file']")).toHaveAttribute(
    "accept",
    ".wav,audio/wav,audio/x-wav",
  );
  await expect(
    page.getByText("PCM/float WAV，大小/時長限制依錯誤提示。", { exact: false }),
  ).toBeVisible();
});

test("AI defaults offline and selecting a blocked Meta gate never proposes a model request", async ({
  page,
}) => {
  const proposed: string[] = [];
  await page.route("**/api/agent/propose**", async (route) => {
    proposed.push(route.request().url());
    await route.fulfill({
      status: 403,
      json: {
        error: { code: "TEST_BLOCKED", message: "Model requests are disabled in this UI test." },
      },
    });
  });
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
          reason: "BUDGET_ZERO：測試 gate；預算為 0。",
          modelId: null,
          remainingQuota: null,
          liveValidation: "NOT_RUN",
          estimatedCostCeilingUsd: 0,
        },
      },
    });
  });
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Meta 實驗 Agent", exact: true }).click();
  const provider = page.getByRole("combobox", { name: "AI 執行方式", exact: true });
  await expect(provider).toHaveValue("offline");
  const prompt = page.getByRole("textbox", { name: "實驗指令", exact: true });
  await prompt.fill("新增一顆無重力的球");
  await provider.selectOption("meta");
  await expect(provider).toHaveValue("meta");
  await page.getByRole("button", { name: "重新檢查伺服器狀態", exact: true }).click();
  await expect(page.locator(".agent-provider-status")).toContainText("已阻擋");
  await expect(page.locator(".agent-provider-status")).toContainText("BUDGET_ZERO");
  await expect(page.getByRole("button", { name: "產生操作預覽", exact: true })).toBeDisabled();
  await prompt.press("Control+Enter");
  await expect(page.getByText("Meta Model API 目前不可用", { exact: false })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "剛體模式", exact: true })).toBeEnabled();
  await provider.selectOption("offline");
  await expect(prompt).toHaveValue("新增一顆無重力的球");
  await expect(page.getByRole("button", { name: "產生操作預覽", exact: true })).toBeEnabled();
  expect(proposed).toEqual([]);
});

test("project JSON stays a local review draft until explicit Apply", async ({ page }, info) => {
  await openWorkspace(page);
  await expect(page.getByRole("button", { name: "匯出已封存錄製", exact: true })).toBeDisabled();
  const originalName = await page.locator(".project-name strong").innerText();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出專案", exact: true }).click();
  const exported = await downloaded;
  const filePath = info.outputPath("exported-project.json");
  await exported.saveAs(filePath);
  const project = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  const text = JSON.stringify({ ...project, name: "JSON 檢視後匯入" });
  const trigger = page.getByRole("button", { name: "匯入專案 JSON", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "匯入專案 JSON", exact: true });
  const input = dialog.getByLabel("選擇專案 JSON 檔案", { exact: true });
  await input.setInputFiles({
    name: "review-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
    "JSON 檢視後匯入",
  );
  await expect(page.locator(".project-name strong")).toHaveText(originalName);
  await page.setViewportSize({ width: 320, height: 800 });
  const reviewBounds = await dialog.boundingBox();
  expect(reviewBounds?.x).toBeGreaterThanOrEqual(0);
  expect((reviewBounds?.x ?? 0) + (reviewBounds?.width ?? 0)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath("project-review-320.png"), timeout: 10_000 });
  await dialog.getByRole("button", { name: "取消匯入", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".project-name strong")).toHaveText(originalName);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await trigger.click();
  await input.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "套用並開啟專案", exact: true })).toBeDisabled();
  await input.setInputFiles({
    name: "too-large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1, 32),
  });
  await expect(dialog.getByRole("alert")).toContainText("SIZE_LIMIT");
  await expect(page.locator(".project-name strong")).toHaveText(originalName);
  await input.setInputFiles({
    name: "domain-rejected.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ name: "保留被拒絕的草稿" })),
  });
  await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
    "保留被拒絕的草稿",
  );
  await dialog.getByRole("button", { name: "套用並開啟專案", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
    "保留被拒絕的草稿",
  );
  await expect(page.locator(".project-name strong")).toHaveText(originalName);
  await input.setInputFiles({
    name: "review-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
    "JSON 檢視後匯入",
  );
  await dialog.getByRole("button", { name: "套用並開啟專案", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".project-name strong")).toHaveText("JSON 檢視後匯入");
});

test("completed recording exports a separate raw RecordingArtifact JSON", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 720, height: 800 });
  await openWorkspace(page);
  await page
    .getByRole("navigation", { name: "主要面板" })
    .getByRole("button", { name: "場景", exact: true })
    .click();
  const exportRecording = page.getByRole("button", { name: "匯出已封存錄製", exact: true });
  await expect(exportRecording).toBeDisabled();
  await page.getByRole("button", { name: "● 開始錄製", exact: true }).click();
  await expect(exportRecording).toBeDisabled();
  await expect(page.locator(".run-status .subtle.mono")).not.toHaveText("tick 0");
  await page.getByRole("button", { name: "■ 停止錄製", exact: true }).click();
  await expect(exportRecording).toBeEnabled();
  const downloaded = page.waitForEvent("download");
  await exportRecording.click();
  const exported = await downloaded;
  const filePath = info.outputPath("recording-artifact.json");
  await exported.saveAs(filePath);
  const artifact = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  expect(artifact).toHaveProperty("schemaVersion");
  expect(artifact).toHaveProperty("runId");
  expect(artifact).toHaveProperty("configuration");
  expect(artifact).toHaveProperty("artifactSha256");
  expect(Array.isArray(artifact.frames)).toBe(true);
  expect((artifact.frames as unknown[]).length).toBeGreaterThan(0);
});

test("reset seals an interrupted recording for export while replay remains unavailable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 720, height: 800 });
  await openWorkspace(page);
  await page
    .getByRole("navigation", { name: "主要面板" })
    .getByRole("button", { name: "場景", exact: true })
    .click();
  await page.getByRole("button", { name: "● 開始錄製", exact: true }).click();
  await expect(page.locator(".run-status .subtle.mono")).not.toHaveText("tick 0");
  await page.getByRole("button", { name: "重設", exact: true }).click();
  await expect(page.locator(".run-status .subtle.mono")).toHaveText("tick 0");
  await expect(page.getByText("中斷紀錄已封存；不可重播", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ 重播紀錄", exact: true })).toBeDisabled();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出已封存錄製", exact: true }).click();
  const filePath = info.outputPath("interrupted-recording-artifact.json");
  await (await exported).saveAs(filePath);
  const artifact = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  expect(artifact.status).toBe("interrupted");
  expect(artifact.reason).toBe("RESET");
  expect(artifact.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(Array.isArray(artifact.frames)).toBe(true);
  expect((artifact.frames as unknown[]).length).toBeGreaterThan(0);
});

test("rule drafts survive selection and rejected transactions until actual acknowledgement", async ({
  page,
}) => {
  await openWorkspace(page);
  const impact = page.getByRole("article", { name: "聲音行為 rule.impact", exact: true });
  const gain = impact.getByRole("spinbutton", { name: /音量/ });
  for (const trigger of ["OnBounce", "OnEnterZone", "OnExitZone"]) {
    await expect(
      page
        .getByRole("combobox", { name: "新增行為觸發條件", exact: true })
        .locator(`option[value='${trigger}']`),
    ).toHaveJSProperty("disabled", true);
    await expect(
      impact
        .getByRole("combobox", { name: "觸發條件", exact: true })
        .locator(`option[value='${trigger}']`),
    ).toHaveJSProperty("disabled", true);
  }
  await gain.fill("0.23");
  await page.getByRole("button", { name: "speaker speaker 固定", exact: true }).click();
  await expect(page.getByRole("region", { name: "保留的聲音行為草稿", exact: true })).toContainText(
    "已保留 1 份",
  );
  await page.getByRole("button", { name: "ball ball 動態", exact: true }).click();
  await expect(gain).toHaveValue("0.23");
  await gain.fill("");
  await page.getByRole("button", { name: "speaker speaker 固定", exact: true }).click();
  await page.getByRole("button", { name: "ball ball 動態", exact: true }).click();
  await expect(gain).toHaveValue("");
  await expect(impact.getByRole("button", { name: "套用", exact: true })).toBeDisabled();
  await gain.fill("0.23");
  // This e2e-only fault affects the transaction result, never engine values.
  const originalDispatch = await page.evaluateHandle(() => {
    const runtime = window.__reflectionLab;
    if (!runtime) throw new Error("E2E controller unavailable");
    const original = runtime.dispatch;
    runtime.dispatch = (action) =>
      action.type === "patchRule"
        ? Promise.reject(new Error("UI_TEST_REJECTED：保留原草稿"))
        : original.call(runtime, action);
    return original;
  });
  await impact.getByRole("button", { name: "套用", exact: true }).click();
  await expect(impact.getByRole("alert")).toContainText("UI_TEST_REJECTED");
  await expect(gain).toHaveValue("0.23");
  await page.getByRole("button", { name: "speaker speaker 固定", exact: true }).click();
  await page.getByRole("button", { name: "ball ball 動態", exact: true }).click();
  await expect(gain).toHaveValue("0.23");
  await expect(impact.getByRole("alert")).toContainText("UI_TEST_REJECTED");
  await page.evaluate((original) => {
    if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
    window.__reflectionLab.dispatch = original;
  }, originalDispatch);
  await originalDispatch.dispose();
  await impact.getByRole("button", { name: "套用", exact: true }).click();
  await expect(page.getByRole("region", { name: "保留的聲音行為草稿", exact: true })).toHaveCount(
    0,
  );
  const actual = await page.evaluate(
    () =>
      window.__reflectionLab
        ?.getSnapshot()
        .behaviors.find((profile) => profile.objectId === "ball")
        ?.rules.find((rule) => rule.id === "rule.impact")?.gainLinear,
  );
  expect(actual).toBeCloseTo(0.23, 8);
});

test("nonlinear curve and object override Apply/Clear/Undo retain source playback intent", async ({
  page,
}, info) => {
  await openWorkspace(page);
  const sourcesBefore = await page.evaluate(() => {
    if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
    return JSON.stringify(JSON.parse(window.__reflectionLab.exportProject()).scene.sources);
  });
  const override = page.getByRole("region", { name: "此物件覆寫 rule.impact", exact: true });
  await override.locator("summary").click();
  await override.getByRole("checkbox", { name: "覆寫音量", exact: true }).check();
  await override.getByRole("spinbutton", { name: "此物件音量 linear", exact: true }).fill("0.4");
  const originalDispatch = await page.evaluateHandle(() => {
    const runtime = window.__reflectionLab;
    if (!runtime) throw new Error("E2E controller unavailable");
    const original = runtime.dispatch;
    runtime.dispatch = (action) =>
      action.type === "setBindingOverride"
        ? Promise.reject(new Error("UI_OVERRIDE_REJECTED：草稿保留"))
        : original.call(runtime, action);
    return original;
  });
  await override.getByRole("button", { name: "套用此物件覆寫", exact: true }).click();
  await expect(override.getByRole("alert")).toContainText("UI_OVERRIDE_REJECTED");
  await expect(
    override.getByRole("spinbutton", { name: "此物件音量 linear", exact: true }),
  ).toHaveValue("0.4");
  await page.evaluate((original) => {
    if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
    window.__reflectionLab.dispatch = original;
  }, originalDispatch);
  await originalDispatch.dispose();
  await override.getByRole("button", { name: "套用此物件覆寫", exact: true }).click();
  await expect(override.getByRole("button", { name: "套用此物件覆寫", exact: true })).toHaveCount(
    0,
  );
  const impact = page.getByRole("article", { name: "聲音行為 rule.impact", exact: true });
  await impact
    .getByRole("article", { name: "參數映射 mapping.impact-gain", exact: true })
    .getByRole("button", { name: "移除映射", exact: true })
    .click();
  await expect(impact.locator(".mapping-card")).toHaveCount(0);
  await impact.getByRole("button", { name: "新增參數映射", exact: true }).click();
  const mappings = impact.getByRole("region", { name: "參數映射曲線編輯器", exact: true });
  await mappings
    .getByRole("combobox", { name: "映射輸入 metric", exact: true })
    .selectOption("closingSpeedMetresPerSecond");
  await mappings
    .getByRole("combobox", { name: "映射輸出參數", exact: true })
    .selectOption("gainLinear");
  await mappings.getByRole("spinbutton", { name: "映射輸入下限", exact: true }).fill("0");
  await mappings.getByRole("spinbutton", { name: "映射輸入上限", exact: true }).fill("10");
  await mappings.getByRole("spinbutton", { name: "映射輸出下限", exact: true }).fill("0");
  await mappings.getByRole("spinbutton", { name: "映射輸出上限", exact: true }).fill("1");
  await mappings.getByRole("spinbutton", { name: "映射平滑時間 s", exact: true }).fill("0");
  await mappings.getByRole("button", { name: "新增曲線點", exact: true }).click();
  const middleY = mappings.getByRole("spinbutton", { name: "曲線點 2 y", exact: true });
  await middleY.fill("2");
  await expect(middleY).toHaveAttribute("aria-invalid", "true");
  await expect(impact.getByRole("button", { name: "套用", exact: true })).toBeDisabled();
  await middleY.press("Escape");
  await expect(middleY).toHaveValue("0.5");
  await mappings.getByRole("spinbutton", { name: "曲線點 2 y", exact: true }).fill("0.2");
  await expect(mappings.getByLabel("曲線中點預覽", { exact: true })).toContainText("0.2 linear");
  await impact.getByRole("button", { name: "套用", exact: true }).click();
  await expect(impact.getByRole("button", { name: "套用", exact: true })).toHaveCount(0);
  const saved = await page.evaluate(() =>
    window.__reflectionLab
      ?.getSnapshot()
      .behaviors.find((profile) => profile.objectId === "ball")
      ?.rules.find((rule) => rule.id === "rule.impact"),
  );
  expect(saved?.mappings?.[0]?.curve).toEqual([
    { x: 0, y: 0 },
    { x: 0.5, y: 0.2 },
    { x: 1, y: 1 },
  ]);
  expect(saved?.bindingOverride?.gainLinear).toBeCloseTo(0.4, 8);
  await override.getByRole("button", { name: "清除已儲存覆寫", exact: true }).click();
  await expect(
    override.getByRole("button", { name: "清除已儲存覆寫", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "復原場景命令", exact: true }).click();
  await expect(override.getByRole("button", { name: "清除已儲存覆寫", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "重做場景命令", exact: true }).click();
  await expect(
    override.getByRole("button", { name: "清除已儲存覆寫", exact: true }),
  ).toBeDisabled();
  const after = await page.evaluate(() => {
    if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
    return {
      sources: JSON.stringify(JSON.parse(window.__reflectionLab.exportProject()).scene.sources),
      state: window.__reflectionLab.getSnapshot().simulationState,
    };
  });
  expect(after.sources).toBe(sourcesBefore);
  expect(after.state).not.toBe("running");
  await mappings.getByLabel("曲線中點預覽", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("curve-override.png"), timeout: 10_000 });
  await page.setViewportSize({ width: 320, height: 700 });
  await page
    .getByRole("navigation", { name: "主要面板" })
    .getByRole("button", { name: "檢查器", exact: true })
    .click();
  const pointTable = mappings.getByRole("table");
  await pointTable.scrollIntoViewIfNeeded();
  const tableBounds = await pointTable.boundingBox();
  expect(tableBounds).not.toBeNull();
  expect(tableBounds!.x).toBeGreaterThanOrEqual(0);
  expect(tableBounds!.x + tableBounds!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath("curve-mobile.png"), timeout: 10_000 });
});
