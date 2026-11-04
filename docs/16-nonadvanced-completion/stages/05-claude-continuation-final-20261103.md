# M5：Claude 接手的工程驗證結果（不是第一版完成）

[機讀紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4ab7d96b3ce136dbeaf8cff047259842688479f3)固定產品來源 `544d8d9f`（src tree `0d955495`）與各項證據的 SHA-256；說明與人工測試入口見[最後交接](../handoffs/CLAUDE_FINAL_HANDOFF_20261103.md)。

| 範圍 | 結果 |
| --- | --- |
| 完整 `npm run check` | 研究回歸、lint／型別／格式、runtime 2270／2270、build、授權通過；英文當時未完成，之後補齊 |
| 接手時 7 項 runtime 失敗 | 4 項測試未跟上已定規則、1 項產品 bug 已修、2 項測試時序競爭 |
| 長輸出 | attempt05 58／58 通過（在 `89f65e4d`，非凍結來源重跑） |
| 產品 E2E refined v3 | 4／4 通過 |
| 十次 reset／import 與 dispose | 2／2 通過 |
| production 頂列監測 | 4／5，錄製連續性案例在原固定步 guard 暫停 |
| S4 全 22 路徑 | 11 通過／11 失敗，保留未修 |
| Windows Computer Use | BLOCKED（瀏覽器網址判定政策），0 個產品步驟 |
| 正式 600 秒 V4 | 依使用者決定未執行 |
| 真人聽測、實體鍵鼠、Meta live | 未執行 |
