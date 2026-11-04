# 效能面板全參數盤點

本次獨立以 Chrome 156.0.8078.75 操作既有 production preview `http://127.0.0.1:4173`。只使用畫面指標、鍵盤、按鈕與 DOM 讀取；未使用 HostInternal、runtime bridge、測試資料注入、付費模型、權限提示或產品程式修改。這是面板參數與狀態驗證，不是裝置聽測、PCM 連續性、DSP callback CPU 或完整效能驗收。

## 實際範圍與結果

機讀盤點為 `parameter-inventory.json`，共 **28 項**：

- 6 個互動控制：成本觀測 checkbox、分項 details summary、控制執行緒 scope 說明、3 個 help 按鈕。
- 19 個唯讀指標：8 個摘要卡與 11 個分項表列。
- 2 個唯讀狀態：原生輸出與觀測啟用／保留狀態。
- 1 個不存在的操作：refresh 明列為 **ABSENT_NOT_A_CONTROL**。面板藉正常發布更新顯示資料，沒有手動更新按鈕。
- 沒有數字編輯欄位。唯讀指標與原生二元 checkbox 不存在可輸入的任意數字／字串邊界，故 invalid／min／max 檢查明列不適用，不假造可編輯參數。

實際 browser 測試為 **1／1 PASS，34.7 秒**；scenario 收據時間是 2026-11-02 06:39:14–06:39:36 UTC，CLI 總長含啟動。初輪即通過，沒有產品缺陷或被覆蓋的失敗。

| 操作 | 實際觀測 |
| --- | --- |
| 尚未啟用聆聽 | 成本觀測 checkbox disabled／unchecked；原生狀態「尚無原生輸出觀測」，摘要與分項未知值維持「—」。 |
| Scope 與 3 個 help | Pointer 顯示說明；Escape 關閉。Scope 說明明確排除 DSP callback CPU、PCM 連續性與聽測。 |
| 更新成本與分項計數 | Click 開啟 11 列；Enter 關閉；Space 重新開啟，保留原生 details 行為。 |
| 啟用聆聽 | Checkbox 可用且 checked；實際顯示「等待下一筆原生計數」。未出現 browser dialog 或權限提示。 |
| 開始運算 | tick 94 時接受／拒絕影格為 37／0，readout 自動更新；不是由面板注入讀值。 |
| Pointer 停用成本觀測 | 顯示「觀測已停用；顯示保留資料」。模擬 tick 142 → 202，全部 19 項讀值維持不變。 |
| 切到音訊匯出再返回 | 停用狀態保留，不因換 tab 自動啟用。 |
| Pointer 與 Space 重新啟用 | Off／On 狀態均成功；接受影格恢復增長，後續快照為 58／0。 |
| 暫停後切 English | Performance 仍是選取 tab，checkbox 與 details 狀態保留，英文標籤與說明可見。 |

## 原生狀態與限制

這個瀏覽器實際顯示過 **NOT_OBSERVED → WARMUP → AVAILABLE**。AVAILABLE 的一筆短視窗讀值為 501.7 ms、瀏覽器回報 output latency 48 ms、輸出中斷 0／0 ms。只有 AVAILABLE 狀態才把這些原生資料列當作已觀測數值；早期未知或 warmup 仍是「—」。這些讀值不能外推為實體輸出延遲量測、零 PCM gap、長時間穩定性或裝置聽測通過。

**UNSUPPORTED 與 COUNTER_RESET 未在此瀏覽器真實發生**，機讀盤點記為 `NOT_EXERCISED_IN_THIS_BROWSER`。沒有 UI 操作可強制這兩種原生條件，本輪沒有覆寫瀏覽器功能或注入計數來冒充覆蓋。現有單元契約可另外驗證這些呈現分支，但不能冒充本次真 browser 結果。

## 證據與重現

- 驗證檔：`tests/browser/parameter-audit/pipeline-render-performance-diagnostics.spec.ts` 與同前綴 config。
- 重跑命令：`node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-render-performance-diagnostics.config.ts`。需先有獨立 production preview 4173；config 不啟動 server、不重建產品。
- `browser-initial.txt`／process：真 browser stdout、實際 exit code 與時間。
- `performance-parameter-receipt.json`：逐階段 DOM、checkbox、讀值、native status、工具提示、全部已載入 JS／CSS／入口 HTML 的實際 HTTP bytes hash。
- `parameter-inventory.json`：完整 28 項分類、UI 操作與觀測結果，以及未觸發狀態。
- `performance-observed-zh.png`、`performance-observed-en.png`：實際 production 截圖；沒有將截圖或 token 計算升格為全面視覺可用性通過。
- `source-and-artifact-manifest.json`：驗證檔、唯讀原始碼與證據 hash；大型 Playwright trace 留在已忽略的 `test-results/parameter-audit-performance-diagnostics/`，索引與 hash 同記。

實際入口為 `index-BDGeI4Sd.js`，SHA-256 `e9bbc4e496c9dfbe51a03f87f24f781caed1df166f9e2a249ebe172d4ab4e08d`；動態 UI 為 `App-hX50zr2p.js`，SHA-256 `8b39a7b34d4065c24ff704a35d7c0ed475ce2b4d90cce832799494af3e1f1511`。來源 19db9f9 是協調者提供的建置截點；本次自行固定的是實際網路取得的內容，不捏造新 commit。

全程 page errors、browser dialog、被阻擋的付費／外部請求皆為 0。沒有改產品、共用設定、Git index 或持久 Wiki；由主代理後續統一登錄與提交。
