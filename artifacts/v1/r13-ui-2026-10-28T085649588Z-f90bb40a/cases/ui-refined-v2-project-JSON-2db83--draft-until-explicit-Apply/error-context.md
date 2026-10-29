# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-refined-v2.spec.ts >> project JSON stays a local review draft until explicit Apply
- Location: tests\browser\ui-refined-v2.spec.ts:282:1

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
  - strong: 聲音行為實驗
  - text: Scene rev 0 · 本機專案
  - navigation "工作區":
    - button "01 建立場景"
    - button "02 互動實驗"
    - button "03 檢驗比較"
  - text: 介面語言 / Interface language
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
- button "場景" [pressed]
- button "檢查器" [pressed]
- status
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
  - separator "調整場景面板寬度"
  - region "三維場景":
    - text: VIEWPORT
    - strong: 場景觀察
    - button "對準選取"
    - button "進入第一人稱"
    - text: 準備就緒 tick 0 · 0.00 s 聲學 pending Scene r0 · Acoustic r0 Y↑ −Z 前 SI · m ● Listener / Direct ◇ Reflection 聲線來自求解器 · 5/5
    - checkbox "阻擋候選（不送音訊）"
    - text: 阻擋候選（不送音訊）
  - separator "調整檢查器寬度"
  - complementary "屬性檢查器":
    - heading "檢查器" [level=2]
    - text: sphere
    - heading "獨立預聽" [level=3]
    - paragraph: 預聽已套用的規則與靜態位置，不推進原 Run、錄製或指標。撞擊需先選取已接受的接觸事件。
    - status: 尚未開始場景預聽
    - button "停止預聽" [disabled]
    - heading "ball" [level=2]
    - code: ball
    - button "複製"
    - button "刪除"
    - heading "Transform" [level=3]
    - text: 作者設定
    - group "位置 m":
      - text: 位置 m X
      - spinbutton "X": "-0.8"
      - text: "Y"
      - spinbutton "Y": "2"
      - text: Z
      - spinbutton "Z": "0"
    - group "尺寸 m":
      - text: 尺寸 m X
      - spinbutton "X": "0.5"
      - text: "Y"
      - spinbutton "Y": "0.5"
      - text: Z
      - spinbutton "Z": "0.5"
    - group "旋轉 deg · XYZ":
      - text: 旋轉 deg · XYZ 旋轉 X
      - spinbutton "旋轉 X": "0"
      - text: 旋轉 Y
      - spinbutton "旋轉 Y": "0"
      - text: 旋轉 Z
      - spinbutton "旋轉 Z": "0"
    - group: 詳細資訊
    - heading "剛體物理" [level=3]
    - text: Body Mode
    - combobox "剛體模式":
      - option "Dynamic · 受重力" [selected]
      - option "Dynamic · 無重力"
      - option "Fixed · 固定"
      - option "Kinematic · 指定運動"
    - text: 質量 kg
    - spinbutton "質量 kg": "1"
    - text: 摩擦係數
    - spinbutton "摩擦係數": "0.4"
    - text: 恢復係數
    - spinbutton "恢復係數": "0.55"
    - text: 速度
    - code: 0.000 m/s
    - group: 詳細資訊
    - heading "聲學材質" [level=3]
    - text: Synthetic 表面材質
    - combobox "聲學材質":
      - option "硬質表面 · Synthetic · Synthetic"
      - option "吸音表面 · Synthetic · Synthetic"
      - option "木質示範 · Synthetic · Synthetic"
      - option "金屬示範 · Synthetic · Synthetic" [selected]
    - text: 聲學角色
    - combobox "聲學角色":
      - option "不參與幾何聲學"
      - option "靜態反射表面"
      - option "動態遮蔽物" [selected]
      - option "動態反射面（依後端能力）"
    - heading "Sound Behaviors" [level=3]
    - text: 3 規則
    - paragraph: 聲音內容自由設定；所有場景聲源仍經統一聲學傳播。
    - text: 分類
    - combobox "分類":
      - option "Creative · 創意分類" [selected]
      - option "Physical-inspired · 材質啟發分類"
      - option "Hybrid · 混合分類"
      - option "Procedural · 程序音分類"
    - group: 詳細資訊
    - article "聲音行為 rule.impact":
      - checkbox "撞擊時" [checked]
      - strong: 撞擊時
      - button "刪除 rule.impact 行為"
      - code: rule.impact
      - text: 等待觸發
      - button "場景聲學預聽"
      - text: 觸發條件
      - combobox "觸發條件":
        - option "持續發聲 · AlwaysOn"
        - option "移動期間 · WhileMoving"
        - option "飛行期間 · WhileAirborne"
        - option "滾動期間 · WhileRolling"
        - option "滑動期間 · WhileSliding"
        - option "旋轉期間 · WhileSpinning"
        - option "持有期間 · WhileHeld"
        - option "抓取時 · OnGrab"
        - option "放手時 · OnRelease"
        - option "投擲時 · OnThrow"
        - option "放下時 · OnDrop"
        - option "撞擊時 · OnImpact" [selected]
        - option "彈跳時 · OnBounce（未支援）" [disabled]
        - option "開始移動 · OnStartMoving"
        - option "停止移動 · OnStopMoving"
        - option "進入區域 · OnEnterZone（未支援）" [disabled]
        - option "離開區域 · OnExitZone（未支援）" [disabled]
        - option "休眠時 · OnSleep"
        - option "喚醒時 · OnWake"
      - text: 聲音素材
      - combobox "聲音素材":
        - option "程序音 · Oscillator" [selected]
      - text: 音量 linear
      - spinbutton "音量 linear": "0.06309573444801933"
      - text: 音高 semitones
      - spinbutton "音高 semitones": "0"
      - text: 冷卻時間 s
      - spinbutton "冷卻時間 s": "0.08"
      - paragraph: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
      - region "參數映射曲線編輯器":
        - paragraph: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
        - article "參數映射 mapping.impact-gain":
          - code: mapping.impact-gain
          - button "移除映射"
          - text: 輸入 metric · m/s
          - combobox "映射輸入 metric":
            - option "聲源速度 · m/s"
            - option "角速度 · rad/s"
            - option "法向衝量 · N·s"
            - option "接近速度 · m/s" [selected]
            - option "切向速度 · m/s"
            - option "滑移速度 · m/s"
            - option "接觸支撐力 · N"
          - text: 輸出參數 · linear
          - combobox "映射輸出參數":
            - option "音量 · linear" [selected]
            - option "音高 · semitones"
            - option "濾波截止頻率 · Hz"
          - text: 輸入下限 · m/s
          - spinbutton "映射輸入下限": "0"
          - text: 輸入上限 · m/s
          - spinbutton "映射輸入上限": "10"
          - text: 輸出下限 · linear
          - spinbutton "映射輸出下限": "0.025"
          - text: 輸出上限 · linear
          - spinbutton "映射輸出上限": "0.25"
          - text: 插值
          - combobox "映射插值":
            - option "Linear · 線性" [selected]
            - option "Step · 階梯"
          - text: 參數平滑 · s
          - spinbutton "映射平滑時間 s": "0.015"
          - paragraph: Clamp 固定啟用。平滑是發聲參數，不改變物理結果或聲音傳播時間。觸發條件可用的 metric 仍由套用時驗證；缺值不冒充 0。
          - img "作者參數映射曲線；非聲學量測或聲線。線性插值。"
          - paragraph:
            - status "曲線中點預覽": 5 m/s → 0.1375 linear
            - text: （曲線中點預覽，未經平滑／非模擬結果）
          - paragraph: 輸入：接近速度 0–10 m/s；輸出：音量 0.025–0.25 linear。
          - table "曲線控制點 · x/y 正規化 [0, 1]":
            - caption: 曲線控制點 · x/y 正規化 [0, 1]
            - rowgroup:
              - row "點 x y 操作":
                - columnheader "點"
                - columnheader "x"
                - columnheader "y"
                - columnheader "操作"
            - rowgroup:
              - row "1 0 0 移除曲線點 1":
                - rowheader "1"
                - cell "0":
                  - spinbutton "曲線點 1 x": "0"
                - cell "0":
                  - spinbutton "曲線點 1 y": "0"
                - cell "移除曲線點 1":
                  - button "移除曲線點 1" [disabled]: 移除
              - row "2 1 1 移除曲線點 2":
                - rowheader "2"
                - cell "1":
                  - spinbutton "曲線點 2 x": "1"
                - cell "1":
                  - spinbutton "曲線點 2 y": "1"
                - cell "移除曲線點 2":
                  - button "移除曲線點 2" [disabled]: 移除
          - button "新增曲線點"
        - button "新增參數映射"
        - paragraph: 1/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
    - region "此物件覆寫 rule.impact":
      - group: 此物件覆寫 繼承
    - article "聲音行為 rule.grab":
      - checkbox "抓取時" [checked]
      - strong: 抓取時
      - button "刪除 rule.grab 行為"
      - code: rule.grab
      - text: 等待觸發
      - button "場景聲學預聽"
      - text: 觸發條件
      - combobox "觸發條件":
        - option "持續發聲 · AlwaysOn"
        - option "移動期間 · WhileMoving"
        - option "飛行期間 · WhileAirborne"
        - option "滾動期間 · WhileRolling"
        - option "滑動期間 · WhileSliding"
        - option "旋轉期間 · WhileSpinning"
        - option "持有期間 · WhileHeld"
        - option "抓取時 · OnGrab" [selected]
        - option "放手時 · OnRelease"
        - option "投擲時 · OnThrow"
        - option "放下時 · OnDrop"
        - option "撞擊時 · OnImpact"
        - option "彈跳時 · OnBounce（未支援）" [disabled]
        - option "開始移動 · OnStartMoving"
        - option "停止移動 · OnStopMoving"
        - option "進入區域 · OnEnterZone（未支援）" [disabled]
        - option "離開區域 · OnExitZone（未支援）" [disabled]
        - option "休眠時 · OnSleep"
        - option "喚醒時 · OnWake"
      - text: 聲音素材
      - combobox "聲音素材":
        - option "程序音 · Oscillator" [selected]
      - text: 音量 linear
      - spinbutton "音量 linear": "0.06309573444801933"
      - text: 音高 semitones
      - spinbutton "音高 semitones": "0"
      - text: 冷卻時間 s
      - spinbutton "冷卻時間 s": "0.08"
      - paragraph: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
      - region "參數映射曲線編輯器":
        - paragraph: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
        - button "新增參數映射"
        - paragraph: 0/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
    - region "此物件覆寫 rule.grab":
      - group: 此物件覆寫 繼承
    - article "聲音行為 rule.throw":
      - checkbox "投擲時" [checked]
      - strong: 投擲時
      - button "刪除 rule.throw 行為"
      - code: rule.throw
      - text: 等待觸發
      - button "場景聲學預聽"
      - text: 觸發條件
      - combobox "觸發條件":
        - option "持續發聲 · AlwaysOn"
        - option "移動期間 · WhileMoving"
        - option "飛行期間 · WhileAirborne"
        - option "滾動期間 · WhileRolling"
        - option "滑動期間 · WhileSliding"
        - option "旋轉期間 · WhileSpinning"
        - option "持有期間 · WhileHeld"
        - option "抓取時 · OnGrab"
        - option "放手時 · OnRelease"
        - option "投擲時 · OnThrow" [selected]
        - option "放下時 · OnDrop"
        - option "撞擊時 · OnImpact"
        - option "彈跳時 · OnBounce（未支援）" [disabled]
        - option "開始移動 · OnStartMoving"
        - option "停止移動 · OnStopMoving"
        - option "進入區域 · OnEnterZone（未支援）" [disabled]
        - option "離開區域 · OnExitZone（未支援）" [disabled]
        - option "休眠時 · OnSleep"
        - option "喚醒時 · OnWake"
      - text: 聲音素材
      - combobox "聲音素材":
        - option "程序音 · Oscillator" [selected]
      - text: 音量 linear
      - spinbutton "音量 linear": "0.06309573444801933"
      - text: 音高 semitones
      - spinbutton "音高 semitones": "0"
      - text: 冷卻時間 s
      - spinbutton "冷卻時間 s": "0.08"
      - paragraph: 控制曲線可在下方逐點編輯；不改變物理與傳播模型。
      - region "參數映射曲線編輯器":
        - paragraph: 作者控制曲線，非聲學量測。點表 x/y 為 0–1 正規化座標；首點 x=0、末點 x=1，x 嚴格遞增。每個輸出最多一條映射。
        - button "新增參數映射"
        - paragraph: 0/8 條映射；輸出參數不得重複。所有變更先保留為草稿。
    - region "此物件覆寫 rule.throw":
      - group: 此物件覆寫 繼承
    - text: 新增行為觸發條件
    - combobox "新增行為觸發條件":
      - option "持續發聲"
      - option "移動期間"
      - option "飛行期間"
      - option "滾動期間"
      - option "滑動期間"
      - option "旋轉期間"
      - option "持有期間"
      - option "抓取時"
      - option "放手時"
      - option "投擲時"
      - option "放下時"
      - option "撞擊時" [selected]
      - option "彈跳時（未支援）" [disabled]
      - option "開始移動"
      - option "停止移動"
      - option "進入區域（未支援）" [disabled]
      - option "離開區域（未支援）" [disabled]
      - option "休眠時"
      - option "喚醒時"
    - button "新增"
    - group: 詳細資訊
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
  184 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  185 |   await expect(page.locator(".monitor-mute")).toBeVisible();
  186 |   await page
  187 |     .getByRole("navigation", { name: "主要面板" })
  188 |     .getByRole("button", { name: "場景", exact: true })
  189 |     .click();
  190 |   await page.getByRole("button", { name: /Listener \/ 環境/ }).click();
  191 |   await expect(page.getByRole("combobox", { name: "傳播介質" })).toBeVisible();
  192 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  193 |   await page.getByRole("button", { name: "展開實驗面板", exact: true }).click();
  194 |   await page.getByRole("button", { name: "收合實驗面板", exact: true }).click();
  195 |   await page.locator(".monitor-reverb summary").click();
  196 |   const popup = await page.locator(".monitor-reverb-settings").boundingBox();
  197 |   expect(popup?.x).toBeGreaterThanOrEqual(0);
  198 |   expect((popup?.x ?? 0) + (popup?.width ?? 0)).toBeLessThanOrEqual(320);
  199 |   await expect(page.locator(".monitor-mute")).toBeInViewport({ ratio: 1 });
  200 |   await page.locator(".monitor-mute").click();
  201 |   await page.screenshot({ path: info.outputPath("mobile-320.png"), timeout: 10_000 });
  202 |   await page.locator(".monitor-reverb summary").click();
  203 |   const duration = await page
  204 |     .locator(".monitor-mute")
  205 |     .evaluate((element) => getComputedStyle(element).transitionDuration);
  206 |   expect(duration).toBe("0s");
  207 |   await page.setViewportSize({ width: 720, height: 500 });
  208 |   await expect(page.locator(".monitor-mute")).toBeVisible();
  209 |   await expect(page.locator(".monitor-mute")).toBeInViewport({ ratio: 1 });
  210 |   await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  211 |   await page.screenshot({ path: info.outputPath("reflow-720.png"), timeout: 10_000 });
  212 |   expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(500);
  213 | });
  214 | 
  215 | test("audio import advertises only the preflighted WAV formats", async ({ page }) => {
  216 |   await openWorkspace(page);
  217 |   await expect(page.locator(".scene-explorer input[type='file']")).toHaveAttribute(
  218 |     "accept",
  219 |     ".wav,audio/wav,audio/x-wav",
  220 |   );
  221 |   await page.locator(".import-details summary").click();
  222 |   await expect(
  223 |     page.getByText("PCM/float WAV，大小/時長限制依錯誤提示。", { exact: false }),
  224 |   ).toBeVisible();
  225 | });
  226 | 
  227 | test("AI defaults offline and selecting a blocked Meta gate never proposes a model request", async ({
  228 |   page,
  229 | }) => {
  230 |   const proposed: string[] = [];
  231 |   await page.route("**/api/agent/propose**", async (route) => {
  232 |     proposed.push(route.request().url());
  233 |     await route.fulfill({
  234 |       status: 403,
  235 |       json: {
  236 |         error: { code: "TEST_BLOCKED", message: "Model requests are disabled in this UI test." },
  237 |       },
  238 |     });
  239 |   });
  240 |   await page.route("**/api/agent/status", async (route) => {
  241 |     await route.fulfill({
  242 |       json: {
  243 |         offline: {
  244 |           state: "AVAILABLE",
  245 |           provenance: "OFFLINE_DETERMINISTIC",
  246 |           modelId: null,
  247 |           cloudCostUsd: 0,
  248 |         },
  249 |         meta: {
  250 |           provider: "metaModelApi",
  251 |           state: "BLOCKED",
  252 |           reason: "BUDGET_ZERO：測試 gate；預算為 0。",
  253 |           modelId: null,
  254 |           remainingQuota: null,
  255 |           liveValidation: "NOT_RUN",
  256 |           estimatedCostCeilingUsd: 0,
  257 |         },
  258 |       },
  259 |     });
  260 |   });
  261 |   await openWorkspace(page);
  262 |   await page.getByRole("tab", { name: "Meta 實驗 Agent", exact: true }).click();
  263 |   const provider = page.getByRole("combobox", { name: "AI 執行方式", exact: true });
  264 |   await expect(provider).toHaveValue("offline");
  265 |   const prompt = page.getByRole("textbox", { name: "實驗指令", exact: true });
  266 |   await prompt.fill("新增一顆無重力的球");
  267 |   await provider.selectOption("meta");
  268 |   await expect(provider).toHaveValue("meta");
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
> 284 |   await expect(page.getByRole("button", { name: "匯出已封存錄製", exact: true })).toBeDisabled();
      |                                                                            ^ Error: expect(locator).toBeDisabled() failed
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
```