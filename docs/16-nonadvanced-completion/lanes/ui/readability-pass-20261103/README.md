# 2026-11-03 介面可讀性整理（CSS-only）

使用者要求（2026-11-03，人工測試前）：元素之間保留必要間距、相似元素不要層層包框的按鈕、提高可讀性；參考 Emil Kowalski skills（使用本庫已固定來源的 `.agents/skills/emil-design-eng`）。

## 變更範圍

- Commit `1be15d5c`，只改 `src/ui/styles.css`、`src/ui/top-monitor.css`；DOM、role、名稱、文案與 design tokens 不變（`src` tree `0d955495` → `3924149d`）。
- 互斥模式（視窗移動／旋轉／縮放、頂列監看視圖）改為單一外框分段切換：按鈕本身無框，選取態以 raised 底色、accent 字色、600 字重表示。
- 監聽列：緩衝選單不再與 模擬／原始 共框；兩個路由按鈕接成一組切換。
- 頂列監看：增加內距，量表加細框與 canvas 底色使狀態訊息歸屬清楚，說明文字改 secondary 色。
- Inspector：區塊與欄位間距加大，標籤 secondary 色、數值 body 字級；dock 與視窗工具列間距加大。
- 視窗工具列在窄寬度改為換行而非重疊（修正前 1024 px 英文介面「進入第一人稱」蓋住「框選所選」）。

前後截圖：`before/`、`after/`（1440×900 zh-TW）、`before-1024-en/`、`after-1024-en/`（1024×768 英文）。

## 驗證結果

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| UI 單元測試、format、lint | 232／232 通過；format、lint 通過 | [ui-unit.log](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/ui/readability-pass-20261103/verification/ui-unit.log) |
| Emil skills 固定來源與 design standards | 來源全部 MATCH；standards 只是靜態 token／規範檢查，不是畫面驗證 | [emil-check.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2921a1caebcc740b770f850e07eb1ac62128b377)、[emil-standards.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fb73399b8972bbfc4d29b38b82a3360d2ae6f2f7) |
| 十次 reset／import 與 dispose（真 Chrome） | 2／2 通過 | [physics-ui.log](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/ui/readability-pass-20261103/verification/physics-ui.log)、`artifacts/v1/physics-acceptance-20261103/browser-20261103125246463/` |
| production 頂列監測（attempt10，build `1be15d5c`） | 4／5；390／929／1440 px 標頭版面測試通過；失敗的仍是原本「切換視圖時保持錄製」案例（錄製暫停），與改版前 attempt09 相同 | [top-monitor-attempt10.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f11a76ca268d69000537a38bf39e99499a48f9a7)、[build receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1519312de758892832b2221cd5e67110d75425ef) |
| refined v3 產品 E2E | **未通過**：改版後 5 次共 15 個乾淨啟動只過 2 個；遺失 WAV 重新連結每次都通過。見下方 A/B | 下表 |
| S4 全 22 路徑 | **NOT RUN**（改版後未重跑；改版前 s4-final-01 為 11／22） | — |
| 真人視覺確認 | 待使用者人工測試 | — |

### refined v3 A/B（同一台機器、同一時段、依序執行）

改版前來源用暫存 worktree 檢出 `3a03adc3`（src tree `0d955495`）；改版後為 `1be15d5c`（src tree `3924149d`）。每次都是三次乾淨啟動＋一次遺失 WAV 重新連結；來源與 bundle 全程一致。

| 時間（UTC） | 來源 | build 輸入 digest | 乾淨啟動 | 重新連結 | 封存 |
| --- | --- | --- | --- | --- | --- |
| 10:07 | 改版前 | `3c402eded9cb` | 3／3 | 通過 | `artifacts/v1/product-e2e-chrome-20261103T100747Z/` |
| 12:51 | 改版後 | `89571e4ecef3` | 0／3 | 通過 | `artifacts/v1/product-e2e-chrome-20261103T125158Z/` |
| 12:59 | 改版前（對照） | `3c402eded9cb` | 0／3 | 通過 | `artifacts/v1/product-e2e-chrome-20261103T125918Z-preui-control-3a03adc3/` |
| 13:00 | 改版後 | `89571e4ecef3` | 0／3 | 通過 | `artifacts/v1/product-e2e-chrome-20261103T130019Z/` |
| 13:03 | 改版後（同時取樣 CPU） | `89571e4ecef3` | 0／3 | 通過 | `artifacts/v1/product-e2e-chrome-20261103T130307Z/` |
| 13:07 | 改版後（關閉閒置 Codex broker 後） | `89571e4ecef3` | 2／3 | 通過 | `artifacts/v1/product-e2e-chrome-20261103T130712Z/` |
| 13:08 | 改版後 | `89571e4ecef3` | 0／3 | 通過 | `artifacts/v1/product-e2e-chrome-20261103T130812Z/` |
| 13:09 | 改版前（對照） | `3c402eded9cb` | 1／3 | 通過 | `artifacts/v1/product-e2e-chrome-20261103T130903Z-preui-control-3a03adc3/` |

判讀：

- 所有失敗都是同一種：錄製中模擬暫停（「錄製評估佇列已滿」或「固定步負載超限」），之後的「Grab unaccepted」與點「投擲」逾時是暫停的後果（暫停時「投擲」停用，且「繼續」按鈕出現使同列按鈕位移，所以 Playwright 回報「抓取」的說明元件擋住點擊）。改版前對照出現完全相同的訊息。
- 與 10:07 通過那次 build 輸入完全相同的改版前對照，現在 6 個乾淨啟動只過 1 個，所以失敗來自執行環境，不是這次 CSS；但本輪資料不足以證明 CSS 對時序**完全**沒有影響，只能說沒有看到差異（改版前 1／6、改版後 2／15）。
- 環境：C: 只剩約 4.1 GB 可用（headless Chrome profile 與 IndexedDB 在 C:）、commit charge 47.2／53.5 GB；關閉本 session 遺留的閒置 Codex broker（約 12 GB commit）後有一次 2／3，但下一次又回到 0／3。取樣期間整機 CPU 使用約 20%，沒有單一行程搶 CPU（[cpu-during-c-ui.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/98da828d7353bcef95fe7bc46885a9712c7ec437)）。確切原因未查明。
- 大於 1 MiB 的檔案與 trace zip 保留在磁碟、不入 Git，雜湊列在各封存的 `EXCLUDED_LARGE_FILES.json`。
