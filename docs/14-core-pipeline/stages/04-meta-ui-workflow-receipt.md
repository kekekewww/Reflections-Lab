# Meta 離線實驗 UI 閉環收據

本收據補充階段 04 的真瀏覽器證據。使用 Chrome 156.0.8078.75，以 headless 獨立程序操作既有 production preview `http://127.0.0.1:4173`，沒有測試 bridge、runtime dispatch 或付費模型呼叫。測試只透過畫面輸入、按鈕與表單執行動作；讀取 DOM 取得來源編號、數值與狀態。這不是 Meta live、真人鍵鼠、聽測、600 秒效能或完整 V1 通過證據。

## 發現與最小修正

首輪真 UI 的材質預覽／套用及基準 Run → Capture → Analyze 均成功，但「可追溯結果」表格沒有資料列，原始 Host 說明與兩筆 citation 已存在。原 helper 誤將 metric 記錄的原始 recording artifact ID，與說明引用的 derived grounding artifact ID 視為同一個字串。

修正後只接受同一個成功 Host result 中，run ID 與 metric ID 相符、且該 result 明確發布 citation artifact 的記錄；不跨步驟拼接、不接受失敗結果或 foreign run／artifact，不補造缺失數值。新增相應正負案例。這是 UI 顯示修正，未變更聲學公式、物理、音訊、Domain、Host、原容差或模型權限。

比較會回傳六頻帶結果，故另加雙語「頻率 Hz」欄。125、250、500、1000、2000、4000 Hz 可分辨；null 頻帶呈現「—」。科學數值沿用既有不使用千位分組的格式。

## 最終實際操作

| 階段 | 畫面結果 |
| --- | --- |
| 選取 floor，輸入 material.hard | 預覽含 floor／材質 ID，場景維持 revision 0；明確套用後為 revision 1，Inspector 顯示 hard，Host Undo 可用。 |
| 建立 1 秒基準 | RunSimulation → CaptureExperiment → AnalyzeAcousticResults 三步皆「完成」。 |
| 輸入 material.soft | 預覽不修改場景；明確套用後 revision 2，Inspector 顯示 soft，基準 run ID 保留。 |
| 相同運動比較 | 候選 RunSimulation → CaptureExperiment → AnalyzeAcousticResults → CompareExperiments 四步皆「完成」，候選 run ID 與基準不同。 |
| 復原上次 AI 套用 | revision 2 → 3；Inspector 恢復 hard；已復原的 Host Undo 停用。 |
| 輸入越權 OS／API key 指令 | 顯示「要求超出允許工具範圍，場景未變更」，沒有可套用預覽，revision 不變。 |
| 預覽並套用新增方塊，再要求相同運動比較 | RunSimulation 顯示「失敗」，Host 明確拒絕 geometry／初始 pose 等改變重用舊 motion trace；保留基準，沒有偽造的 metric 表格。 |

最終基準為 `run.tool.29a09c8556e4804d220d0df102e0543610ea05c1`，候選為 `run.tool.c3b925507a2600f708d0df36d4fee4916623b3ea`。基準 1000 Hz 的 directArrivalTimeS 表格值是 **0.017067 s**；原始 Host 說明保留更完整精度。候選六頻帶同樣顯示 0.017067 s，沒有宣稱材質造成改善。rt60S 在基準與候選各頻帶都維持「未提供」，因有限路徑與 Synthetic late reverb 不構成可推導 RT60 的完整 IR。

UI 表格呈現候選已引用的指標；本收據沒有透過 runtime bridge 讀取 replayTraceId 或自行執行 Host。匹配運動的工具契約由既有 Host 驗證支撐，本次新增的是完整可操作的 UI 成功路徑與不相容場景拒絕證據。

## 驗證與來源

- 最終 `node --import tsx --test src/ui/pipeline-workflow-model.test.ts src/ui/pipeline-ui.test.ts src/ui/controller-ports.test.ts src/ui/locale-model.test.ts`：**22／22 PASS**（helper 5、pipeline SSR 8、ports 2、locale 7）。
- 最終 7 檔 scoped ESLint、Prettier check：**PASS**。新增頻帶案例的第一輪 21／22 是測試誤以為頻率使用千位分組；修正斷言沿用既有 formatter，原 stdout 保留，沒有更改產品 formatter。
- `npm run build`：**PASS**，含 TypeScript。既有大型 bundle 警告保留；沒有將建置成功外推為效能通過。
- `node node_modules/@playwright/test/cli.js test --config tests/browser/meta-ui-workflow.config.ts`：最終 **1／1 PASS，21.2 秒**，2026-11-02 06:25:40–06:25:54 UTC 為 scenario 收據時間；CLI 總長含啟動。
- 最終全程 agent API requests、被阻擋的規劃／外部要求、page errors 均為 **0**。路由已防止付費規劃及外部 HTTP 要求，沒有發出後再依賴零預算防護。
- 最終入口 JS 為 `index-CsQTPNJk.js`，SHA-256 `a8a4950a569a02a93ae1dbf7dc664440458eee928ee99ca1fafe897d7a9d1be0`。入口／CSS 實際 HTTP bytes 位於 receipt；完整當次 production build 的非 sourcemap 檔案見 build-artifact-manifest。
- UI 來源與新增獨立驗證檔共 7 檔的 hash／bytes 見 source-manifest；由 root 後續統一提交，這裡沒有虛構 commit SHA。

原始檔均在 [04-meta-ui-evidence](04-meta-ui-evidence/)：

- `UI_WORKFLOW_RECEIPT.json`、`browser-final.txt`／process：最後含頻帶欄的完整閉環。
- `UI_WORKFLOW_RECEIPT-initial-fail.json`、`browser-initial.txt`／process、`initial-failure.png`、`initial-error-context.md`：首輪真 UI 缺口。
- `UI_WORKFLOW_RECEIPT-before-frequency-pass.json`、`browser-before-frequency-pass.txt`／process：修正來源對應、尚未增加頻帶欄的成功截點。
- `targeted-unit-frequency-initial.txt`：21／22 的格式假設失敗；`targeted-unit-final.txt` 為 22／22。
- `material.hard-preview.png`、`material.soft-preview.png`、`baseline-completed.png`、`candidate-comparison-completed.png`、`incompatible-comparison-rejected.png`：最終 production 畫面。
- `artifact-manifest.json` 索引大型 trace 的本機快取位置與所有證據雜湊；trace 留在專案 `.cache/meta-ui-workflow-receipts/`，不大量納入 Git。

## Claude Code 複核入口

先讀初始 FAIL，再核對成功 result 內的 citation／metric／run／artifact 關聯及對應正負案例。啟動獨立 production preview 4173，重跑本次 config，可重現全流程、Undo 與拒絕案例。保留非可用 RT60 與頻帶資料，不將缺值轉為零、不宣稱吸音改善。最終人工測試、真聽測、Meta live 與整體產品／效能門檻仍由其各自正式證據判定；root 的原生匯出收據另行保存其實際音訊來源與 bundle 截點。
