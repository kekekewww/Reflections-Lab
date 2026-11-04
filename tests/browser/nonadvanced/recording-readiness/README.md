# 錄製第一個回壓 guard：單次診斷

這是一案有界的 e2e 診斷來源，不是已執行結果，也不替代正式產品 DOM 驗收。透過公開介面啟用聆聽、模擬與錄製，頂列維持預設 Levels；最多觀察 10 秒或第一個 guard，然後正常停止／封存。只讀取既有 e2e bootstrap 所暴露 runtime 的公開診斷 getter；不修改 runtime、來源、clock、queue 或錄製狀態。

Root 授予機器資源窗口後，以該固定版本執行：

```powershell
node node_modules/vite/bin/vite.js build --mode e2e --outDir .cache/recording-readiness/e2e-dist
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5241 --strictPort --outDir .cache/recording-readiness/e2e-dist
$env:RECORDING_READINESS_ATTEMPT = 'attempt01'
node node_modules/@playwright/test/cli.js test --config tests/browser/nonadvanced/recording-readiness/diagnostic.config.ts
```

前兩個命令由 Root 分別管理 build 與 preview 的實際 handle。Config 不會自行建置或開 server；輸出目錄已存在就拒絕執行，請另用下一個 attempt 名稱，不刪除或覆寫歷史結果。不要先對正式 attempt 執行 `--list`，JSON reporter 也可能建立結果目錄。

結果位於 `test-results/recording-readiness-attemptNN/`，包含 source／HTTP bundle 雜湊、Chrome 版本、trace、畫面、第一個 guard 的不可變快照及正常封存的前綴身份。`FIRST_GUARD_OBSERVED` 或 `GUARD_NOT_REPRODUCED_WITHIN_TEN_SECONDS` 均是診斷觀察，不是產品／吞吐 PASS。

Snapshot 區分 evaluation 與 storage，包含各自真 queue 水位及 create／post／協定回覆／storage ready／append 的固定時間欄位。Worker create 不代表 ready，協定回覆不代表 acoustic semantic／DSP 完成，未取得時間為 null；不把來源未知寫成 0。原 8 frames／32 MiB、低水位 2／8 MiB、1/60 s、所有容差與暫停保護保持。沒有內部重試、強制 Resume 或放大 queue。

執行前，Root需以實際建置建立 `.cache/recording-readiness/e2e-build-receipt.json`：`schemaVersion:1`、`command`、`mode:"e2e"`、`exitCode:0`、`head`、`sourcePins:[{path,bytes,sha256}]`（至少 spec 列出的14個 src）及 `bundle:{indexSha256,scriptPath,scriptSha256}`。測試將核對建置時來源、現行來源、磁碟與HTTP入口；缺失或陳舊收據會拒絕。

啟動命令的 stdout／command 記錄請先寫在 `.cache/recording-readiness/` 的獨立路徑，不要先建立 `test-results/recording-readiness-attemptNN`，否則 config 會為了保護舊結果拒絕。觀測使用單調時鐘並明列原生 renderer 的時間窗；越界、觀測缺失或其他暫停各自分類。停止後必須有非空、captured、連續 tick 邊界相符的 artifact，才會標記公開停止完成。
