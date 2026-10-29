# 原生縮放與輸入驗收

狀態：**部分通過，保留失敗**（2026-10-27）。五項原生輸入測試 **5/5 PASS**；真正分頁 200% 縮放及四項可達性檢查已觀察，但完整縮放案例仍 **FAIL**；CDP 組字完整案例 **FAIL**；原生選單與 OS IME **NOT RUN**。本頁不構成第一版整體驗收通過。

固定雙語 build input digest：`9ae2ca2eb7508be78a0fcfa96ef99e1543189a644b6f3c1057d10d3c78664176`。manifest SHA-256：`10d1fcb0f8b3514b03c1793ea32095bc6a192e84af8bf6e5fa215af9e0cd3839`。執行前及 NATIVEEND 前，source／bundle hash 均無失配。所有結果屬此版本；之後的 favicon 修復不在此證據內。

持久證據與命令見 [summary.json](native-accessibility-evidence/20261027/summary.json)、[固定 manifest](native-accessibility-evidence/20261027/frozen-build-manifest.json)、[程序清理](native-accessibility-evidence/20261027/process-cleanup.json)。保留初次 visibility 失敗、三次縮放失敗與 CDP 失敗，沒有刪除或改成 PASS。

測試來源：`native-accessibility-runner.mjs`、`native-accessibility.cases.ts`、`native-accessibility.config.ts`。只新增測試與證據，不修改產品 UI 或規格。

## 原生 200% 縮放

提供兩條分開記錄的方法。第一條使用已安裝的 Chrome、獨立測試 profile 與原生視窗。Computer Use 對該視窗執行 Ctrl+0，再逐步放大至瀏覽器選單顯示 200%。保存包含 Chrome 原生選單的截圖與 accessibility tree。這是 [Chrome 官方頁面縮放入口](https://support.google.com/chrome/answer/96810)。

第二條使用已快取的 bundled Chromium、獨立 profile 與本庫的小型 MV3 測試 fixture，呼叫真正 `chrome.tabs.setZoomSettings({mode:"automatic",scope:"per-tab"})`、`setZoom(2)`、`getZoom()`。不使用 `Emulation.setDeviceMetricsOverride`、CSS zoom 或 page scale。最後一次使用獨立 headed process／`noDefaults:true`；初次 headless 與普通 headed 的失敗也保留。軟體 renderer 只作 UI 測試，不是實體 GPU／OS 輸入／效能證據。

```text
node tests/browser/native-accessibility-automatic.mjs http://127.0.0.1:5174 test-results/ui-preview-build.json
```

兩條路徑都逐檔核對實際 HTTP served bundle 與固定 manifest，保存 manifest copy；先完成五項檢查、還原 100%、無錯誤及關閉 context 才能輸出 PASS。後續結果使用各自獨立目錄，不能將兩條方法混為同一次執行。

實際 automatic 結果（Chromium `156.0.8078.4`／Windows `10.0.26200`）：原生 API 回報 1→2；同一 1440×1000 視窗，CSS viewport 寬 1424→712，DPR 1→2、visual viewport scale＝1，CSS zoom／transform 不變。Monitor Tab、Pause 鍵盤、dialog Escape／focus return、表單 Tab 共 **4/5 PASS**。之後真正 Pointer Lock 未取得，整體 **FAIL**；未到成功還原步驟，直接安全關閉獨立 profile 的 owned process。另有真 `/favicon.ico` 404，未忽略 console error。快取 Chromium 同時有 Windows sandbox 存取警告，但尚不能斷言它就是 lock 失敗的原因。見[最後縮放結果](native-accessibility-evidence/20261027/zoom-2026-10-27T06-01-44.449Z/verification.json)。

原生選單只嘗試一次互動時窗：Computer Use 的 `list_apps`／`list_windows` 未找到本測試 Chrome 視窗，因此沒有送出放大按鍵或操作其他視窗，已停止並清理。helper 的 `windowsHide:true` 是可能的 fixture 原因，尚未驗證；原生選單 200% 保持 **NOT RUN**。[中止記錄](native-accessibility-evidence/20261027/native-menu-unavailable.json) 不冒充縮放通過。

同時核對同一原生視窗的 bounds 不變、DPR 相對 100% 基線加倍、CSS viewport 寬度減半、visual viewport scale 維持 1、頁面沒有新增 CSS zoom／transform。不能將較小 viewport 或模擬 DPR 當成 200% 瀏覽器縮放。

在此狀態測 Monitor／Pause／第一人稱退出／表單可達性、鍵盤按鈕操作及原生 dialog 的 Escape 與 focus return。選單方法最後以原生 Ctrl+0 還原；API 方法以 automatic `setZoom(1)` 還原。兩者均核對 renderer DPR 恢復基線，關閉獨立測試 context。

目前 [Playwright 官方文件](https://playwright.dev/docs/chrome-extensions) 已指出 branded Chrome／Edge 不提供其 extension sideload flags；測試 fixture 僅載入 bundled Chromium 的獨立測試 profile，不安裝到使用者一般 profile。[Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs) 的 automatic zoom 與 manual 模式不能混淆。

## 輸入案例

專用固定 preview 啟動後的命令：

```text
node node_modules/@playwright/test/cli.js test --config tests/browser/native-accessibility.config.ts
```

預設使用本機 `http://127.0.0.1:5174`；可由環境變數 `NATIVE_ACCESSIBILITY_BASE_URL` 指向已固定並由另一個明確 owner 啟動的 preview。設定檔不再啟動巢狀 server。`*.cases.ts` 僅由此專用設定執行，避免混入其他 browser gate。

實際命令先由本代理持有 `Vite preview --host 127.0.0.1 --port 5174 --strictPort --outDir test-results/ui-preview-dist`。預設 sandbox 的 localhost fetch 回 EACCES；依既有驗證授權改用 elevated preview／runner。沒有新增權限、付費呼叫或外部部署。

初次 4/5 的 visibility 失敗來自 Playwright 預設 focus emulation：實際 probe 中同一視窗的不同 target 全部回 hidden=false。新 CDP session 發 false 也不能解除另一 handler 的 capture handle。[Playwright 官方 noDefaults](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp-option-no-defaults) 與 [Chromium 原始碼](https://chromium.googlesource.com/chromium/src.git/+/refs/heads/main/content/browser/devtools/protocol/emulation_handler.cc) 支持改用**全新 owned process、第一次 `connectOverCDP({noDefaults:true})`、唯一既有 default context**。沒有合成 visibility event；原本 hidden、held-W 及 release/fresh-press 斷言保留，另核對 same windowId／different targetId。修正 fixture 後實跑 **5/5 PASS，42.6 s**（已安裝 Chrome `156.0.8078.47`）。

| 案例                                         | 證據範圍                                                                                                 | 目前結果 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| Composition boundary、Unicode 文字與按鍵優先 | 真瀏覽器中的 scripted CompositionEvent fixture；composition event 為 `isTrusted:false`，不是 Windows IME | PASS     |
| Contenteditable／modal keyboard focus        | 真瀏覽器鍵盤，contenteditable 為明示呈現 fixture；dialog 使用正式元件                                    | PASS     |
| E key repeat                                 | 真 Chrome KeyboardEvent repeat；實際 Rapier 抓取與放下狀態，每次 repeat 均核對 raw／derived event 次數   | PASS     |
| 分頁 visibility loss                         | 真分頁 hidden→paused，不自動恢復；held-W 恢復後不移動，實際 release＋fresh press 才移動                  | PASS     |
| 無 transient activation 的 Pointer Lock 拒絕 | 原生 Chrome rejection；CDP `Runtime.evaluate(userGesture:false)` 不授予手勢，替代操作可移動實際 Listener | PASS     |

另有獨立的 **CDP browser composition capability** case，已執行，完整結果 **FAIL**：

```text
node node_modules/@playwright/test/cli.js test --config tests/browser/native-accessibility-cdp-composition.config.ts
```

它透過 experimental `Input.imeSetComposition` 更新 Chromium focused widget 的候選文字，保存實際 DOM composition／input events、`isTrusted`、`isComposing`、選取位置及值；以 `Input.insertText` 提交，再以空 composition 取消另一段候選。必須核對文字只提交一次、真正 commit／cancel 與不改變 Scene／Behavior／tick。這不是 JavaScript `dispatchEvent(new CompositionEvent(...))`，也不是 Windows OS IME 或實體鍵盤／候選視窗驗收。

實際觀察：中→中文、只提交一次中文、新候選取消→原中文、之後 eb 留在文字欄；Scene／Behavior／tick／事件／paused 均未改變，pageerror 為空。start／update／input 為 trusted，input 的 isComposing 為 true；但 CDP commit 與 cancel 的兩個 compositionend 為 `isTrusted:false`，所以嚴格案例保留 **FAIL**。不調弱該斷言，也不聲稱完整 native IME 通過。e/b 在候選取消後送出，此結果不證明組字期間的實體鍵盤仲裁。見 [CDP 原始事件](native-accessibility-evidence/20261027/cdp-composition/case-1-0-cdp-browser-composition-evidence.json)。

[官方 protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-imeSetComposition)與安裝版 Playwright protocol types 都列出 `text`、`selectionStart`、`selectionEnd`，replacement start/end 為成對的 optional 參數。文件文字提及的 `imeCommitComposition` 並不是本次安裝 protocol 的指令；[Chromium InputHandler](https://chromium.googlesource.com/chromium/src/+/master/content/browser/devtools/protocol/input_handler.cc) 的 `InsertText` 走 `ImeCommitText`，因此測試使用已存在的 `Input.insertText`。若瀏覽器明確回 method unavailable，另存 NOT RUN 與真實錯誤，不改用 synthetic fixture 冒充成功。

CDP `userGesture` 參數依[官方 Runtime protocol](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate)查核；未有成功 lock 歷史時的 transient activation 要求依 [W3C Pointer Lock 2.0](https://www.w3.org/TR/pointerlock-2/)。真正 Windows IME、螢幕閱讀器、人工聽測仍需各自證據，不能從此測試推論通過。

所有五個輸入 owned browser process 的 cleanup 都實際回 `ownedProcessExited:true`；縮放及 menu process 也已結束。Vite preview 已停止，NATIVEEND 後 elevated CIM 查核本次命名 profiles／5174 preview matching process＝0。保留 profiles 作診斷，不刪使用者資料。下一步由 Orchestrator 修復 favicon、產生下一個固定 bundle，再排真正可見 Chrome 視窗的原生選單驗證；本批不繼續消耗 browser slot。
