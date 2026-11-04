# 匯出面板全參數真瀏覽器盤點

方法：**Playwright CLI scripted DOM / headless Chrome**。本批操作既有 production preview 4173，候選由統籌提供為 `9fcf3f0657813f5aa07bf936a1cb6a50f2628f30`；自行取得的入口 HTTP bytes 是 `index-DO7iDxDy.js`，SHA-256 `5c75259d334399afeab1c53a5d32e0e7a3b4067f862b245836fdd542b96e7819`。每案另保存實際載入的 JS／CSS hash。

本批 **4／4 PASS，CLI exit 0，2.7 分鐘**。第一個實際 Render browser attempt 即通過；此前僅有靜態準備。全部完成後先確認 CLI worker 退出與 CIM headless Playwright Chrome **0**，再整理此報告並交還 Zone 驗證時段。沒有修改產品、Git index、guard，沒有 reset Scene 作為恢復手段，本節原四案執行時未包含combined或Help；其後兩個獨立授權批次已完成，詳下文，沒有回寫原四案結果。

## 逐項實際結果

機讀清單為 `parameter-inventory.json`，19 項包含互動控制、唯讀狀態與本面板不存在的編輯器。中央 semantic family／source-site 對照為上層 `CONTROL_CROSSWALK.json`。各項保存自己的結果與案號，CLI 通過不代表所有 UX 判斷都已結案。

| 控制／狀態 | 實際操作與結果 |
| --- | --- |
| 錄製 3 秒 | 沒有錄製時產生按鈕停用；實際按錄製後啟用產生，3 秒時基可由各 WAV 與 manifest 核對。三個 fresh context 分別完成。 |
| 保留尾響 | min 0、max 10、step 0.5、default 2；Enter 接受 0／0.25／0.5／10，ArrowUp／Down 以 0.5 移動，blur 提交、Escape 還原、換 tab 保留。0.25 是有效有限值；step 是操作增量。 |
| 無效尾響 | -0.5、10.5、空白與 1e309 都顯示 aria-invalid／範圍錯誤。1e309 被原生 number input 正規化成空字串，實際 draft 有保留。 |
| 有完整 take 時的無效 draft | 原9fc觀測：畫面10.5無效但仍可產生前次有效0秒；後續501已guard修補並有另案實測。 |
| 各聲源分軌 | pointer 與 Space 均可切換，換 tab 保留。關閉產生 mix/master/dry 三檔；開啟產生五檔，含 ball、speaker 的真正 object stems。 |
| 產生 | 透過 keyboard Enter 啟動；0／2／10 秒 tail 分別產生 3／5／13 秒浮點 WAV。 |
| 忙碌狀態／進度 | bounded DOM observer 實際讀到進度 0／3；尾響、stems、capture、execute 停用，取消可用。這是 DOM 讀取，沒有控制 Host 的測試注入。 |
| 取消／重試 | 真點取消，顯示 RENDER_CANCELLED。取消前後各下載的最後完整 manifest SHA 完全相同，舊三個輸出按鈕仍可見；重試 tail 10 成功。這裡直接核對的是舊 manifest 的保留；未另外把舊三個 WAV 全部再次下載作 byte 比較。 |
| 逐檔下載 | 三種主輸出與兩個實際 stem ID 都各自點擊／Enter 下載；沒有用內部 API 或合併下載代替。 |
| MB／邊界限制 | 真實輸出顯示 1.10／1.83／4.76 MB 與「邊界限制」，沒有移除或忽略界限提示。 |
| 狀態／錯誤 | 實際保存「離線WAV」、0／3、「可下載」、RENDER_CANCELLED。短暫「錄製中」沒有獨立 snapshot 斷言，清單明列此狀態缺口。 |
| 檔名／獨立 master 編輯器 | 本面板沒有這兩種表單，列 ABSENT_NOT_A_CONTROL。master 是可下載輸出；共用 monitor／reverb 設定在 footer，由其 lane 及本批跨面板收據另驗。 |

Render HelpTip 唯一 reachable caller 已做自己的 **hover → Escape、Tab 移焦 → 真 click → focus → Escape**。收據固定 `src/ui/RenderPanel.tsx:48`、source-site ID、topic「音訊匯出」、實際 aria-label／aria-describedby 與 tooltip 文字；不是借 generic HelpTip 的測試。

## 原無效草稿觀測與後續501修補

`02-min-tail` 先提交 tail=0，再輸入 10.5 並確認 aria-invalid=true。這時「產生音檔」仍為 enabled；實際下載 manifest 的 tailFrames=0，WAV 為 3 秒。它使用最後有效設定，沒有把超界 10.5 傳入 Domain。

這一列標記 **OBSERVED_REQUIRES_OWNER_DECISION**：本收據保存「無效 draft 仍可按產生、輸出採上次有效值」的事實。這是原9fc固定觀測，並非目前未決。Root採用阻擋無效草稿的政策，source501新增raw validity guard；[獨立Tail實測](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9624077ab286d24f4330d953c0158a44b93ec7ce)1／1 PASS：10.5／10.50／blank阻擋、舊manifest不變、Esc還原0，0.25有效且生成3.25秒，10有效且生成13秒。原9fc raw與觀測不覆寫。

## 共用 Monitor 跨面板實證

`02-min-tail` 在未按「啟用聆聽」時，以 slider 鍵盤 Home 設為 **-40 dB**；錄製後仍顯示未啟用。下載三個 WAV 與 manifest 後，實際 `configuration.master.monitorGain = 0.01`。

完成這個主斷言後才執行獨立補充 `02-monitor-reverb-cross`：

- 真 click「監聽資訊」與「Synthetic late reverb」摘要，互斥開關確認。
- checkbox 真 pointer 設 **checked=true**，接著 keyboard Space 設 **checked=false**，兩次 isChecked 與時間皆保存。
- 全程維持 -40 dB、「啟用聆聽」仍可見、muted aria-pressed=true。
- 獨立補充收據本身為 **PASS**；沒有借用四案 CLI 結果當成 checkbox 通過。

主收據 SHA-256：`d32e4a621480f3d372f2704a2a3b25e9784e2b13883c39c4a5998636d14ea171`。
獨立補充 SHA-256：`d675b6887c14b28da507cbc268781bedc52343193fbd9baf71da3c9a294d27eb`。

## 數位檔案與範圍

共 **16 次 UI 下載**：11 個 WAV、5 次 manifest（含取消前後的同一份完整 manifest）。所有實際下載 WAV 都核對 RIFF／float32 PCM、48 kHz／雙聲道、有限且非零樣本、請求的 3／5／13 秒時基與 manifest SHA。這不是裝置聽測、PCM 連續性、原生／MCP 操作或 600 秒效能通過。

最後五輸出為 `mix`、`master`、`dry`、`stem-46219de459d8-ball`、`stem-be569a2d963a-speaker`；以 stable outputId 保存，而非陣列序號。

完整耦合的Zone／非線性曲線／移動球體解析反射／逐檔WAV是其後獨立授權批次：source501 [combined首案](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/279a3bceb606308c1da386fa7b2eeee93117a258)1／1 PASS、35.7秒，真180連續tick、Zoneenter／exit、非線性resolvedgain與穩定反射pathID的vertex／distance／delay變化，逐檔下載5WAV＋manifest。Stage12獨立解析校驗以新原始檔為準；本節9fc四案不冒此新source結果。

## 收據與重現

本批資料在 `attempts/final-9fcf3f0-01/`：

- `candidate-preflight.json`、`browser-initial.txt`／process、`browser-closed-cim.json`。
- `01-controls-receipt.json`、`02-min-tail-receipt.json`、`03-cancel-max-tail-receipt.json`、`04-source-stems-receipt.json`。
- `02-monitor-reverb-cross-receipt.json` 與各案實際畫面。
- `ARTIFACT_MANIFEST.json` 在本目錄，索引證據、來源、實際下載檔案 hash／統計與四份大型 trace。
- WAV 與 trace 留於專案 ignored cache／test-results；不大量納入 Git。

重現四案：使用新的 `PIPELINE_RENDER_AUDIT_ATTEMPT`（同案 receipt 使用 wx 防止覆寫），對已獨立建置的 preview 4173 執行：
`node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-render-performance-render.config.ts --max-failures=1`。

測試來源已通過 scoped Prettier／ESLint／strict TypeScript。新增 caller 時發現的原 test error.stack 可 undefined 型別問題，已以 message fallback 修正；原靜態失敗 log 保留，沒有混成產品 browser 失敗。原有四案未新增第五案；combined 有獨立 config 與 lease。
