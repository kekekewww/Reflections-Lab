# 說明提示 caller／表格捲動／Zone overlay 驗證入口

本組已完成實際瀏覽器操作。產品 source固定為 `5010685ebfd6bb482aa37e1d82e5f64418b55d9b`，entry `index-Nm7oRfzL.js`，SHA-256 `baf2542885944b5becf2138fa40e13831d04a1ce7dc1b9f03d3a845d6731706a`。方法是 **Playwright CLI scripted DOM／headless Chrome**，不是native app、MCP或真人鍵鼠。

最終窄重驗 `final-5010685-04` **1／1 PASS、約1.1分鐘、CLI exit0**；20個本lane reachable caller按attempt02／03／04各自真PASS觀測串接，兩個inner table有實際wheel＋ArrowLeft捲動，Zone有Editor顯示／穿透選取／Replay與FPS生命期及5張畫面目視。三個不可達條件仍明列：兩個真native拒絕未自然出現、一個Comparison空status分支無正式Host安全路徑。

- [目前完整報告](REPORT.md)：實際操作、原失敗、harness修正與限制。
- [逐項固定來源交叉表](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c8a794d2144d2b32e438ee23f02788e4e718956e)：20個caller原receipt path／SHA／index與最後4個semantic family。
- [Zone畫面判讀](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/96d36cb4f23eaf040020c31404a6db96cdee65c8)：另外讀取真正PNG的有限目視，不改寫原raw visualPending。
- [最終harness品質與雜湊](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/339237c40d8d317619bca5be215cb3dec6004c7a)：最後spec／config的strict TypeScript、ESLint、Prettier exit0。
- [服務恢復後8個HTTP核對](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a8de69ee2e6b7c975c4c4a5348686c7ffea40c94)、[Chrome／CLI已關閉](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/0737b6a35541f7ed3eaf58eccf1a711c6821e922)、[證據清冊](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/27e29c0c4e8d55c71e33d8372ef477c18809b1eb)。

## 保留的歷史準備與失敗

[更新前README exact preimage](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/80d00be6496ce16e507760a58352602981c58b6a)保留第一次「靜態就緒、尚未開啟瀏覽器」原文，僅代表當時準備狀態。`SOURCE_FREEZE.json`、`FROZEN_*.txt`與`CALLER_PLAN.json`亦是那個歷史靜態截點；後續harness因實際準備問題做過窄修，**不能用舊source freeze取代目前harness雜湊或瀏覽器結果**。

attempt01 connection refused、attempt02本人CLI中止及其STOP_REASON、attempt03 harness前置失敗均留原收據；attempt04只補未通過phase，沒有回寫舊FAIL為PASS。產品、guard及驗收數值沒有因此改動。大型trace／原始Project／自製WAV留於ignored `.cache/pipeline-help-sweep/`，不宣稱全部入Git。

## 後續重跑方式

由coordinator授予單一Chrome時段，對獨立建置且已核對HTTP bytes的preview4173執行；必須使用全新attempt名稱，保留原始失敗。實際source與entry hash由coordinator設定，不借用舊bundle。

`PIPELINE_HELP_BROWSER_LEASE=granted`、`PIPELINE_HELP_ATTEMPT`、`PIPELINE_HELP_CANDIDATE`與`PIPELINE_HELP_EXPECTED_ENTRY_SHA`是必要環境值；執行 `node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-help-sweep-audit.config.ts`。config為workers1、無webServer；不自動啟動付費API。

完整獨立重跑可不提供coverage／phase篩選。只補剩餘phase時，`PIPELINE_HELP_COVERAGE_FILE`必須引用真正已驗證的caller、pointer-click／focus／Escape及固定raw evidence；`PIPELINE_HELP_PHASES`為逗號分隔的明確phase ID。被跳過的caller只列prior scoped evidence，不冒本輪新操作。最後04使用的實際環境、CLI輸出及分項結果見其receipt與stdout。

公開Replay slider從0單按Home不會產生onChange；harness使用真End→Home開啟paused Replay。表格wheel座標取inner與outer dock的可見交集，並DOM只讀確認命中；不改CSS／DOM style或hidden Runtime。每次結束先確認Chrome關閉、釋放lease，再整理新報告與雜湊。
