# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-refined-v2.spec.ts >> reset seals an interrupted recording for export while replay remains unavailable
- Location: tests\browser\ui-refined-v2.spec.ts:389:1

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '● 開始錄製', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "跳至主要工作區" [ref=e4] [cursor=pointer]:
    - /url: "#main-workspace"
  - generic [ref=e5]:
    - banner [ref=e6]:
      - generic [ref=e12]:
        - text: REFLECTION
        - generic [ref=e13]: LAB
      - navigation "工作區" [ref=e14]:
        - button "建立場景" [ref=e15] [cursor=pointer]
        - button "互動實驗" [ref=e16] [cursor=pointer]
        - button "檢驗比較" [ref=e17] [cursor=pointer]
      - combobox "介面語言 / Interface language" [ref=e19]:
        - option "繁體中文" [selected]
        - option "English"
      - generic [ref=e20]:
        - button "儲存專案" [ref=e21] [cursor=pointer]
        - button "匯出專案" [ref=e24] [cursor=pointer]
        - button "載入本機已儲存的專案" [ref=e27] [cursor=pointer]
        - button "匯入專案 JSON" [ref=e30] [cursor=pointer]
    - generic "模擬控制" [ref=e33]:
      - generic [ref=e34]:
        - button "開始運算" [ref=e35] [cursor=pointer]
        - button "重設" [ref=e38] [cursor=pointer]
        - button "復原場景命令" [disabled] [ref=e42]
        - button "重做場景命令" [disabled] [ref=e45]
      - generic [ref=e48]:
        - generic [ref=e49]: 準備就緒
        - generic [ref=e50]: 0.00 s
        - generic [ref=e51]: tick 0
    - status [ref=e52]
    - navigation "主要面板" [ref=e55]:
      - button "場景" [active] [pressed] [ref=e56] [cursor=pointer]
      - button "3D 視窗" [ref=e57] [cursor=pointer]
      - button "檢查器" [ref=e58] [cursor=pointer]
    - main [ref=e59]:
      - complementary "場景與素材" [ref=e60]:
        - generic [ref=e61]:
          - heading "場景" [level=2] [ref=e62]
          - generic [ref=e63]: 6 物件
        - textbox "搜尋場景物件" [ref=e68]:
          - /placeholder: 搜尋物件或 ID
        - generic [ref=e69]:
          - generic [ref=e70]: 物件庫
          - generic [ref=e71]: PRIMITIVES
        - generic [ref=e72]:
          - button "方塊 +" [ref=e73] [cursor=pointer]:
            - generic [ref=e76]: 方塊
            - generic [ref=e77]: +
          - button "球體 +" [ref=e78] [cursor=pointer]:
            - generic [ref=e82]: 球體
            - generic [ref=e83]: +
          - button "膠囊 +" [ref=e84] [cursor=pointer]:
            - generic [ref=e87]: 膠囊
            - generic [ref=e88]: +
        - generic [ref=e89]: 場景物件
        - list "場景物件清單" [ref=e93]:
          - listitem [ref=e94]:
            - button "floor 固定" [ref=e95] [cursor=pointer]:
              - generic "floor" [ref=e100]
              - generic "fixed" [ref=e101]: 固定
          - listitem [ref=e102]:
            - button "wall.back 固定" [ref=e103] [cursor=pointer]:
              - generic "wall.back" [ref=e108]
              - generic "fixed" [ref=e109]: 固定
          - listitem [ref=e110]:
            - button "wall.left 固定" [ref=e111] [cursor=pointer]:
              - generic "wall.left" [ref=e116]
              - generic "fixed" [ref=e117]: 固定
          - listitem [ref=e118]:
            - button "wall.right 固定" [ref=e119] [cursor=pointer]:
              - generic "wall.right" [ref=e124]
              - generic "fixed" [ref=e125]: 固定
          - listitem [ref=e126]:
            - button "ball 動態" [pressed] [ref=e127] [cursor=pointer]:
              - generic "ball" [ref=e133]
              - generic "dynamicGravity" [ref=e134]: 動態
          - listitem [ref=e135]:
            - button "speaker 固定" [ref=e136] [cursor=pointer]:
              - generic "speaker" [ref=e141]
              - generic "fixed" [ref=e142]: 固定
        - button "Listener / 環境 listener.main 獨立位置" [ref=e143] [cursor=pointer]:
          - generic [ref=e146]:
            - text: Listener / 環境
            - generic [ref=e147]: listener.main
          - generic [ref=e148]: 獨立位置
        - generic [ref=e149]:
          - generic [ref=e150]:
            - generic [ref=e151]: 聲音素材
            - generic [ref=e152]: "0"
          - generic [ref=e153]: 尚無素材；可匯入自己的音檔。
          - list
          - group [ref=e154]:
            - generic "匯入聲音" [ref=e155] [cursor=pointer]
        - generic [ref=e156]: 場景單位 SI · +Y 向上重力與傳播介質分開設定
    - region "實驗與分析面板" [ref=e160]:
      - generic [ref=e161]:
        - tablist "實驗分析" [ref=e162]:
          - tab "事件與錄放 0" [selected] [ref=e163] [cursor=pointer]:
            - text: 事件與錄放
            - generic [ref=e164]: "0"
          - tab "聲學路徑 5" [ref=e165] [cursor=pointer]:
            - text: 聲學路徑
            - generic [ref=e166]: "5"
          - tab "實驗比較" [ref=e167] [cursor=pointer]
          - tab "Meta 實驗 Agent" [ref=e168] [cursor=pointer]
        - button "展開實驗面板" [ref=e169] [cursor=pointer]: ⌃
  - contentinfo "音訊監聽與後端狀態" [ref=e170]:
    - generic [ref=e171]:
      - button "啟用聆聽" [pressed] [ref=e172] [cursor=pointer]
      - generic [ref=e176]:
        - generic [ref=e177]: Monitor
        - slider "監聽音量" [ref=e178]: "0.18"
        - status [ref=e179]: 18%
    - group "監聽路由" [ref=e180]:
      - button "Simulated" [pressed] [ref=e181] [cursor=pointer]
      - button "Raw 參考" [ref=e182] [cursor=pointer]
    - status [ref=e183]: 聲學更新中
    - group [ref=e184]:
      - generic "監聽資訊" [ref=e185] [cursor=pointer]
    - group [ref=e186]:
      - generic "Synthetic late reverb" [ref=e187] [cursor=pointer]
```

# Test source

```ts
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
  369 |   await expect(exportRecording).toBeDisabled();
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
> 398 |   await page.getByRole("button", { name: "● 開始錄製", exact: true }).click();
      |                                                                   ^ Error: locator.click: Test timeout of 45000ms exceeded.
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
  470 |   await impact.getByRole("button", { name: "套用", exact: true }).click();
  471 |   await expect(impact.getByRole("alert")).toContainText("UI_TEST_REJECTED");
  472 |   await expect(gain).toHaveValue("0.23");
  473 |   await page
  474 |     .getByRole("button", { name: "speaker 固定", exact: true })
  475 |     .filter({ has: page.locator('[title="speaker"]') })
  476 |     .click();
  477 |   await page
  478 |     .getByRole("button", { name: "ball 動態", exact: true })
  479 |     .filter({ has: page.locator('[title="ball"]') })
  480 |     .click();
  481 |   await expect(gain).toHaveValue("0.23");
  482 |   await expect(impact.getByRole("alert")).toContainText("UI_TEST_REJECTED");
  483 |   await page.evaluate((original) => {
  484 |     if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
  485 |     window.__reflectionLab.dispatch = original;
  486 |   }, originalDispatch);
  487 |   await originalDispatch.dispose();
  488 |   await impact.getByRole("button", { name: "套用", exact: true }).click();
  489 |   await expect(page.getByRole("region", { name: "保留的聲音行為草稿", exact: true })).toHaveCount(
  490 |     0,
  491 |   );
  492 |   const actual = await page.evaluate(
  493 |     () =>
  494 |       window.__reflectionLab
  495 |         ?.getSnapshot()
  496 |         .behaviors.find((profile) => profile.objectId === "ball")
  497 |         ?.rules.find((rule) => rule.id === "rule.impact")?.gainLinear,
  498 |   );
```