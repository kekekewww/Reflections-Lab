# 效能與緩衝架構審查契約

日期：2026-11-01（Asia/Taipei）。狀態：已授權的研究交付契約。執行者：Codex；可核實的模型 ID 未提供。基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`。研究任務：[RLAB-TASK-PERF-20261101-REVIEW](../../knowledge/tasks/RLAB-TASK-PERF-20261101-REVIEW.json)。

## 使用者確認的決策

1. 本輪是 Independent Research & Architecture Review；只建立研究、規劃、非約束提案及持久記憶，不實作效能優化。
2. 基準及文件整合目標為最新 Claude 開發線 `claude/meta-hack-r18-handoff-d292c8`；原 `codex/sound-behavior-research` 工作區保留。
3. 加跑原有600秒負載。現有 Chrome hash 不符原入口的固定資格時，保留正式拒絕，另以隔離暫存研究副本使用目前 Chrome；結果不得取得正式資格。
4. R21未提交修改只作帶時間、HEAD與hash的補充觀察；不匯入研究分支，不把早期量測綁到最後修正。任務完成時再次比對最新目標。
5. 目標有未提交內容時不stash、覆寫或合併；保留已審查分支及本機文件Patch。沒有push或部署授權。

## 授權與保護邊界

允許新增本目錄研究文件、`proposals/`、精簡`evidence/`、既有Evidence Ledger追加來源／Claim、既有Wiki來源／頁面／事件／任務／handoff及完整英文鏡像。各Agent分檔寫入；Wiki與整合由單一協調者處理。

禁止修改`src/`、`server/`、現行`schemas/`、正式`tests/`與`benchmarks/`、package／lockfile、runtime/build/deployment/CI設定、AGENTS、正式驗收／門檻／既有結果。研究原型、trace、bundle與大型資料留在忽略的隔離暫存位置；不提交研究程式。新任務檔先依現有schema驗證並exclusive建立，後續狀態／事件／索引使用既有CLI；不覆寫既有任務。

## 可核對的研究範圍

| 工作 | 完成交付 |
|---|---|
| A–B 現況與證據 | 逐模組thread/clock/rate/buffer/backpressure/overload/copy/GC/order/telemetry矩陣；跨thread圖；R17–R21版本分類 |
| C 產業 | REAPER、Ableton、FMOD、Wwise、JUCE、Chrome/Web Audio官方比較；不得把桌面硬體buffer控制等同瀏覽器能力 |
| D Buffer | PCM、acoustic snapshots、physics events、audio scheduling、assets、DSP/convolution、record/export、transfer/SAB分開評估 |
| E 時鐘 | wall、render frame、physics tick、acoustic snapshot tick、AudioContext、recording、offline sample七時基；最後一項只描述未來契約 |
| F 連續性 | callback／underrun、事件晚到、node生命週期、gain/delay/panner/filter/IR/path/tail/voice stealing、GC/longtasks/replyjitter的可證偽診斷矩陣 |
| G 資源 | CPU尾端成本、memory穩態與峰值、GPU/React/view、能源proxy、client-first cloud scaling |
| H 量測 | 原入口收據、研究600秒、完整未來十情境與metrics；未取得者明示NOT MEASURED |
| I–J 規劃 | P0–P3、有完整欄位的BACKLOG任務、七份PROPOSED ADR、Wiki與英文對照 |
| K–M 驗證與整合 | 獨立審查、來源／文件檢查、受保護diff為零、最新target比較、整合報告、Patch或安全merge與handoff |

## 證據與完成語意

重要Claim分為 CONFIRMED BY CODE、CONFIRMED BY TEST、CONFIRMED BY BROWSER PROFILE、USER REPORTED、HYPOTHESIS、NOT MEASURED，附版本、日期、環境、適用條件與可點來源。官方文件查核另外註明，不能冒充產品實測。

Physics dropped wall time、snapshot rejection、audio late event、voice/path budget rejection與actual output underrun分別記錄。Native graph不是自訂AudioWorklet，輸出統計不是DSP callback耗時或裝置聽測。既有失敗／未驗條件保留。

研究交付完成只表示這份契約與研究task的criteria成立；所有未來優化維持BACKLOG，Proposed ADR維持PROPOSED，完整V1及原產品驗收各自維持既有狀態。

基準及原區紀錄見[preflight](evidence/preflight.json)，完整結果與限制見[最終報告](FINAL_REVIEW_REPORT.md)。
