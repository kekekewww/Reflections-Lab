# 封存錄製匯出門控缺口

狀態：**已修復；49bde82 最後完整 Events 案 1／1 PASS**。詳 final-49bde82-01/REPORT.md；以下保留發現與 Node 修復階段，舊 FAIL 不覆寫。

在 a10b7419908ecd88fd26d96dc354ca5659796986／index-BmjZ1Zyf.js 的完整 Events 案中，前三個 JSON 下載（完成錄製、paused replay、第二次錄製時的舊封存檔）均成功。最後一次 Stop 後，匯出仍可點，但點擊只得到 TRANSACTION_BUSY，沒有 download event。

只讀重建原始 trace 的 ARIA／狀態：

- Stop 之後 t14465 ms 的 Export 前：badge「記錄中」、Stop aria-pressed=true、Export disabled=false。
- Export 動作 t14521 ms 仍是上述狀態；t14633 ms 出現全域 TRANSACTION_BUSY。
- 詳細節點與時間在 attempt-final-boundary/export-seal-trace-analysis.json；原 timeout／trace 不覆寫。

因此有兩層結論。測試只等 Export enabled，不能據此宣稱新檔已完成，因為舊 archive 在下一輪錄製中本來就可匯出；這項等待需要修正。但 UI 的 enabled export 也確實被 mutation transaction 擋下，不能全部歸為腳本錯誤。

新增公開 Runtime 回歸再延遲 BlobStore.saveRecording：artifact 已封存且 verifyRecording 成功，public snapshot 為 finalized／hasArtifact=true，export 仍出 TRANSACTION_BUSY、downloadCount=0。即使 UI 等「紀錄已保存」，仍可能遇到持久化尚未完成的 busy 窗口。測試只替換公開儲存／DOM 轉接器，沒有 HostInternal；原始 RED 為 export-node-original-fail.txt。

建議由 Runtime 在 mutation busy gate 前處理 immutable archived export，只讀當時最後完整 artifact、保留 NO_RECORDING／原檔名與 hash；不接納半成品、不修改 recorder 或其他交易。UI 測試則另等新封存完成再驗證新 run ID。這是原始發現階段的建議；後續實作與有限驗證見下節，不把 Node 結果冒充新瀏覽器通過。

## Root 授權修復後的有限結果

已將 exportRecording 移到 Runtime 的唯讀早期 action。它只讀一份 Host 已封存的 artifact；沒有 artifact、零 frame 或 cancelled 成果仍為 NO_RECORDING。已封存的 interrupted 原始前綴保留其既有可匯出契約。這個例外不移除 mutation busy；新 seal、cursor、config 與其他編輯交易均不變。

公開 Node 正負共 4 案通過：deferred persistence 可讀當前完整檔、deferred new seal 只讀上一份完整檔且 patchObject 仍被 busy 擋、首份 seal 完成前沒有舊檔則 NO_RECORDING、中斷 prefix 保留原 IDs／status／hash。加上相關回歸共 26／26 PASS，TypeScript、6 檔 scoped ESLint／Prettier PASS。原 RED 及真瀏覽器 timeout 不覆寫。

Browser harness 也已改為第二次 Stop 後等待「紀錄已保存」且 Stop 按鈕消失，再驗新 run ID；不再把舊檔的 enabled 狀態當作新 seal 完成。產品匯出修復尚未重建／新瀏覽器重驗；具體來源凍結與命令收據見 export-source-manifest.json。

最後 production 收據：final-49bde82-01/，只重驗完整 Events 一案，四份 raw JSON 下載成功。原 a10 seek／natural-end probes 及 reset 案維持舊 pins，不冒充本輪重測。
