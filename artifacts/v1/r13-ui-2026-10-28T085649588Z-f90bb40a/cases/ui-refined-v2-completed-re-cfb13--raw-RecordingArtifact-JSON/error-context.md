# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-refined-v2.spec.ts >> completed recording exports a separate raw RecordingArtifact JSON
- Location: tests\browser\ui-refined-v2.spec.ts:359:1

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator: getByRole('button', { name: '匯出已封存錄製', exact: true })
Expected: disabled
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" getByRole('button', { name: '匯出已封存錄製', exact: true }) with timeout 10000ms
  - waiting for getByRole('button', { name: '匯出已封存錄製', exact: true })

```

```yaml
- link "跳至主要工作區":
  - /url: "#main-workspace"
- banner:
  - text: REFLECTION LAB
  - navigation "工作區":
    - button "建立場景"
    - button "互動實驗"
    - button "檢驗比較"
  - combobox "介面語言 / Interface language":
    - option "繁體中文" [selected]
    - option "English"
  - button "儲存專案"
  - button "匯出專案"
  - button "載入本機已儲存的專案"
  - button "匯入專案 JSON"
- button "開始運算"
- button "重設"
- button "復原場景命令" [disabled]
- button "重做場景命令" [disabled]
- text: 準備就緒 0.00 s tick 0
- status
- navigation "主要面板":
  - button "場景" [pressed]
  - button "3D 視窗"
  - button "檢查器"
- main:
  - complementary "場景與素材":
    - heading "場景" [level=2]
    - text: 6 物件
    - textbox "搜尋場景物件":
      - /placeholder: 搜尋物件或 ID
    - text: 物件庫 PRIMITIVES
    - button "方塊 +"
    - button "球體 +"
    - button "膠囊 +"
    - text: 場景物件
    - list "場景物件清單":
      - listitem:
        - button "floor 固定"
      - listitem:
        - button "wall.back 固定"
      - listitem:
        - button "wall.left 固定"
      - listitem:
        - button "wall.right 固定"
      - listitem:
        - button "ball 動態" [pressed]
      - listitem:
        - button "speaker 固定"
    - button "Listener / 環境 listener.main 獨立位置"
    - text: 聲音素材 0 尚無素材；可匯入自己的音檔。
    - list
    - group: 匯入聲音
    - text: 場景單位 SI · +Y 向上 重力與傳播介質分開設定
- region "實驗與分析面板":
  - tablist "實驗分析":
    - tab "事件與錄放 0" [selected]
    - tab "聲學路徑 5"
    - tab "實驗比較"
    - tab "Meta 實驗 Agent"
  - button "展開實驗面板": ⌃
- contentinfo "音訊監聽與後端狀態":
  - button "啟用聆聽" [pressed]
  - text: Monitor
  - slider "監聽音量": "0.18"
  - status: 18%
  - group "監聽路由":
    - button "Simulated" [pressed]
    - button "Raw 參考"
  - status: 聲學更新中
  - group: 監聽資訊
  - group: Synthetic late reverb
```

# Test source

```ts
  269 |   await page.getByRole("button", { name: "重新檢查伺服器狀態", exact: true }).click();
  270 |   await expect(page.locator(".agent-provider-status")).toContainText("已阻擋");
  271 |   await expect(page.locator(".agent-provider-status")).toContainText("BUDGET_ZERO");
  272 |   await expect(page.getByRole("button", { name: "產生操作預覽", exact: true })).toBeDisabled();
  273 |   await prompt.press("Control+Enter");
  274 |   await expect(page.getByText("Meta Model API 目前不可用", { exact: false })).toBeVisible();
  275 |   await expect(page.getByRole("combobox", { name: "剛體模式", exact: true })).toBeEnabled();
  276 |   await provider.selectOption("offline");
  277 |   await expect(prompt).toHaveValue("新增一顆無重力的球");
  278 |   await expect(page.getByRole("button", { name: "產生操作預覽", exact: true })).toBeEnabled();
  279 |   expect(proposed).toEqual([]);
  280 | });
  281 | 
  282 | test("project JSON stays a local review draft until explicit Apply", async ({ page }, info) => {
  283 |   await openWorkspace(page);
  284 |   await expect(page.getByRole("button", { name: "匯出已封存錄製", exact: true })).toBeDisabled();
  285 |   const originalName = await page.locator(".project-name strong").innerText();
  286 |   const downloaded = page.waitForEvent("download");
  287 |   await page.getByRole("button", { name: "匯出專案", exact: true }).click();
  288 |   const exported = await downloaded;
  289 |   const filePath = info.outputPath("exported-project.json");
  290 |   await exported.saveAs(filePath);
  291 |   const project = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  292 |   const text = JSON.stringify({ ...project, name: "JSON 檢視後匯入" });
  293 |   const trigger = page.getByRole("button", { name: "匯入專案 JSON", exact: true });
  294 |   await trigger.click();
  295 |   const dialog = page.getByRole("dialog", { name: "匯入專案 JSON", exact: true });
  296 |   const input = dialog.getByLabel("選擇專案 JSON 檔案", { exact: true });
  297 |   await input.setInputFiles({
  298 |     name: "review-project.json",
  299 |     mimeType: "application/json",
  300 |     buffer: Buffer.from(text),
  301 |   });
  302 |   await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
  303 |     "JSON 檢視後匯入",
  304 |   );
  305 |   await expect(page.locator(".project-name strong")).toHaveText(originalName);
  306 |   await page.setViewportSize({ width: 320, height: 800 });
  307 |   const reviewBounds = await dialog.boundingBox();
  308 |   expect(reviewBounds?.x).toBeGreaterThanOrEqual(0);
  309 |   expect((reviewBounds?.x ?? 0) + (reviewBounds?.width ?? 0)).toBeLessThanOrEqual(320);
  310 |   await page.screenshot({ path: info.outputPath("project-review-320.png"), timeout: 10_000 });
  311 |   await dialog.getByRole("button", { name: "取消匯入", exact: true }).click();
  312 |   await expect(dialog).not.toBeVisible();
  313 |   await expect(trigger).toBeFocused();
  314 |   await expect(page.locator(".project-name strong")).toHaveText(originalName);
  315 |   await page.setViewportSize({ width: 1440, height: 1000 });
  316 |   await trigger.click();
  317 |   await input.setInputFiles({
  318 |     name: "broken.json",
  319 |     mimeType: "application/json",
  320 |     buffer: Buffer.from("{broken"),
  321 |   });
  322 |   await expect(dialog.getByRole("alert")).toBeVisible();
  323 |   await expect(dialog.getByRole("button", { name: "套用並開啟專案", exact: true })).toBeDisabled();
  324 |   await input.setInputFiles({
  325 |     name: "too-large.json",
  326 |     mimeType: "application/json",
  327 |     buffer: Buffer.alloc(8 * 1024 * 1024 + 1, 32),
  328 |   });
  329 |   await expect(dialog.getByRole("alert")).toContainText("SIZE_LIMIT");
  330 |   await expect(page.locator(".project-name strong")).toHaveText(originalName);
  331 |   await input.setInputFiles({
  332 |     name: "domain-rejected.json",
  333 |     mimeType: "application/json",
  334 |     buffer: Buffer.from(JSON.stringify({ name: "保留被拒絕的草稿" })),
  335 |   });
  336 |   await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
  337 |     "保留被拒絕的草稿",
  338 |   );
  339 |   await dialog.getByRole("button", { name: "套用並開啟專案", exact: true }).click();
  340 |   await expect(dialog.getByRole("alert")).toBeVisible();
  341 |   await expect(dialog).toBeVisible();
  342 |   await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
  343 |     "保留被拒絕的草稿",
  344 |   );
  345 |   await expect(page.locator(".project-name strong")).toHaveText(originalName);
  346 |   await input.setInputFiles({
  347 |     name: "review-project.json",
  348 |     mimeType: "application/json",
  349 |     buffer: Buffer.from(text),
  350 |   });
  351 |   await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
  352 |     "JSON 檢視後匯入",
  353 |   );
  354 |   await dialog.getByRole("button", { name: "套用並開啟專案", exact: true }).click();
  355 |   await expect(dialog).not.toBeVisible();
  356 |   await expect(page.locator(".project-name strong")).toHaveText("JSON 檢視後匯入");
  357 | });
  358 | 
  359 | test("completed recording exports a separate raw RecordingArtifact JSON", async ({
  360 |   page,
  361 | }, info) => {
  362 |   await page.setViewportSize({ width: 720, height: 800 });
  363 |   await openWorkspace(page);
  364 |   await page
  365 |     .getByRole("navigation", { name: "主要面板" })
  366 |     .getByRole("button", { name: "場景", exact: true })
  367 |     .click();
  368 |   const exportRecording = page.getByRole("button", { name: "匯出已封存錄製", exact: true });
> 369 |   await expect(exportRecording).toBeDisabled();
      |                                 ^ Error: expect(locator).toBeDisabled() failed
  370 |   await page.getByRole("button", { name: "● 開始錄製", exact: true }).click();
  371 |   await expect(exportRecording).toBeDisabled();
  372 |   await expect(page.locator(".run-status .subtle.mono")).not.toHaveText("tick 0");
  373 |   await page.getByRole("button", { name: "■ 停止錄製", exact: true }).click();
  374 |   await expect(exportRecording).toBeEnabled();
  375 |   const downloaded = page.waitForEvent("download");
  376 |   await exportRecording.click();
  377 |   const exported = await downloaded;
  378 |   const filePath = info.outputPath("recording-artifact.json");
  379 |   await exported.saveAs(filePath);
  380 |   const artifact = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  381 |   expect(artifact).toHaveProperty("schemaVersion");
  382 |   expect(artifact).toHaveProperty("runId");
  383 |   expect(artifact).toHaveProperty("configuration");
  384 |   expect(artifact).toHaveProperty("artifactSha256");
  385 |   expect(Array.isArray(artifact.frames)).toBe(true);
  386 |   expect((artifact.frames as unknown[]).length).toBeGreaterThan(0);
  387 | });
  388 | 
  389 | test("reset seals an interrupted recording for export while replay remains unavailable", async ({
  390 |   page,
  391 | }, info) => {
  392 |   await page.setViewportSize({ width: 720, height: 800 });
  393 |   await openWorkspace(page);
  394 |   await page
  395 |     .getByRole("navigation", { name: "主要面板" })
  396 |     .getByRole("button", { name: "場景", exact: true })
  397 |     .click();
  398 |   await page.getByRole("button", { name: "● 開始錄製", exact: true }).click();
  399 |   await expect(page.locator(".run-status .subtle.mono")).not.toHaveText("tick 0");
  400 |   await page.getByRole("button", { name: "重設", exact: true }).click();
  401 |   await expect(page.locator(".run-status .subtle.mono")).toHaveText("tick 0");
  402 |   await expect(page.getByText("中斷紀錄已封存；不可重播", { exact: true })).toBeVisible();
  403 |   await expect(page.getByRole("button", { name: "▶ 重播紀錄", exact: true })).toBeDisabled();
  404 |   const exported = page.waitForEvent("download");
  405 |   await page.getByRole("button", { name: "匯出已封存錄製", exact: true }).click();
  406 |   const filePath = info.outputPath("interrupted-recording-artifact.json");
  407 |   await (await exported).saveAs(filePath);
  408 |   const artifact = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  409 |   expect(artifact.status).toBe("interrupted");
  410 |   expect(artifact.reason).toBe("RESET");
  411 |   expect(artifact.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
  412 |   expect(Array.isArray(artifact.frames)).toBe(true);
  413 |   expect((artifact.frames as unknown[]).length).toBeGreaterThan(0);
  414 | });
  415 | 
  416 | test("rule drafts survive selection and rejected transactions until actual acknowledgement", async ({
  417 |   page,
  418 | }) => {
  419 |   await openWorkspace(page);
  420 |   const impact = page.getByRole("article", { name: "聲音行為 rule.impact", exact: true });
  421 |   const gain = impact.getByRole("spinbutton", { name: /音量/ });
  422 |   for (const trigger of ["OnBounce", "OnEnterZone", "OnExitZone"]) {
  423 |     await expect(
  424 |       page
  425 |         .getByRole("combobox", { name: "新增行為觸發條件", exact: true })
  426 |         .locator(`option[value='${trigger}']`),
  427 |     ).toHaveJSProperty("disabled", true);
  428 |     await expect(
  429 |       impact
  430 |         .getByRole("combobox", { name: "觸發條件", exact: true })
  431 |         .locator(`option[value='${trigger}']`),
  432 |     ).toHaveJSProperty("disabled", true);
  433 |   }
  434 |   await gain.fill("0.23");
  435 |   await page
  436 |     .getByRole("button", { name: "speaker 固定", exact: true })
  437 |     .filter({ has: page.locator('[title="speaker"]') })
  438 |     .click();
  439 |   await expect(page.getByRole("region", { name: "保留的聲音行為草稿", exact: true })).toContainText(
  440 |     "已保留 1 份",
  441 |   );
  442 |   await page
  443 |     .getByRole("button", { name: "ball 動態", exact: true })
  444 |     .filter({ has: page.locator('[title="ball"]') })
  445 |     .click();
  446 |   await expect(gain).toHaveValue("0.23");
  447 |   await gain.fill("");
  448 |   await page
  449 |     .getByRole("button", { name: "speaker 固定", exact: true })
  450 |     .filter({ has: page.locator('[title="speaker"]') })
  451 |     .click();
  452 |   await page
  453 |     .getByRole("button", { name: "ball 動態", exact: true })
  454 |     .filter({ has: page.locator('[title="ball"]') })
  455 |     .click();
  456 |   await expect(gain).toHaveValue("");
  457 |   await expect(impact.getByRole("button", { name: "套用", exact: true })).toBeDisabled();
  458 |   await gain.fill("0.23");
  459 |   // This e2e-only fault affects the transaction result, never engine values.
  460 |   const originalDispatch = await page.evaluateHandle(() => {
  461 |     const runtime = window.__reflectionLab;
  462 |     if (!runtime) throw new Error("E2E controller unavailable");
  463 |     const original = runtime.dispatch;
  464 |     runtime.dispatch = (action) =>
  465 |       action.type === "patchRule"
  466 |         ? Promise.reject(new Error("UI_TEST_REJECTED：保留原草稿"))
  467 |         : original.call(runtime, action);
  468 |     return original;
  469 |   });
```