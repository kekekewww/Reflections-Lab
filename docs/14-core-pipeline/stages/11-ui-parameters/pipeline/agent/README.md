# Meta Agent 與實驗流程參數驗證

狀態：**限定範圍的真瀏覽器操作通過**。本輪只新增／調整獨立測試與收據，沒有修改產品程式、Git index、付費設定或驗收門檻。

正式候選由 coordinator 指定為 `49bde82be6f9def5058bc8f3076e105fcdfd535d`。三案實際載入的入口皆為 `index-C4qRBPy8.js`，SHA-256 `8d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123`。Git commit 來自租用通知，入口 HTTP bytes 由本輪獨立讀取並核對；測試本身的未提交版本另以檔案 hash 固定，沒有捏造其 commit。

## 執行結果

`PIPELINE_AGENT_ATTEMPT=final-49bde82-01`；`PIPELINE_AGENT_SOURCE_HINT` 記錄完整候選與入口 hash。命令為：

```text
node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-agent-audit.config.ts
```

三案 **3／3 PASS，CLI exit 0，42.5 秒**。單一 worker、獨立 fresh context、headless Chrome、1440×1100、正常比例。配置連接既有 production preview 4173，沒有啟動／重建 web server。Node／Chrome 的版本、每案時間與載入的 JS／CSS hashes 在原始 JSON 中。

| 案例 | 實際操作 |
| --- | --- |
| 01 provider／prompt | 空白阻擋、4001→4000 字輸入上限、Enter 換行、Ctrl+Enter 預覽、差異鍵盤焦點、取消預覽、五個說明 caller 的 hover／click／focus／Escape／Tab blur-refocus、Chrome 組字輸入守衛、未知與越權指令拒絕、真 API status／refresh、Meta→offline、舊 revision 預覽拒絕。 |
| 02 duration／cancel | 空值、0、−1、11 顯示錯誤；Escape 還原；1 秒 blur commit；10 秒 Enter commit；ArrowDown／Up 10→9→10；1.01 秒由 Host 拒絕；10 秒 run 啟動後實際取消並取得 Host 確認。 |
| 03 完整閉環 | 運算中「暫停並套用操作」pointer 套用 hard；1 秒基準 Run／Capture／Analyze；步驟與原始說明 disclosure；keyboard 套用 soft；候選 Run／Capture／Analyze／Compare；Host Undo；新增 geometry 後禁止重用基準 motion。 |

三案均沒有 page error、被阻擋的外部／付費要求或任何 Agent POST。第一案只有兩次透過 UI 觸發的真 `GET /api/agent/status`。

CLI 結束後先完成 teardown，再整理本報告：原 worker PID 90776 與自有 controller／worker 的存活子程序為 **0**，沒有保留 Chrome 佔用下一個租用時段。見 `run-final-49bde82-01-process.json`。

## 逐項清單與來源

`CONTROL_INVENTORY.json` 只指向最新版 `OBSERVED_CONTROLS-final-49bde82-01.json`；後者對齊中央 14 個 Agent／Workflow semantic families；另以五個獨立 caller 實例對應共用 `help.{callerTopic}`。合計 19 個命名控制實例都取得本輪操作來源，不以一次 generic tooltip 成功替代全部 caller。每項有實際場景、輸入／界限、disabled 觀察與原始 outcome 引用。

五個說明 caller 分別是執行方式、AI Undo、實驗指令、操作預覽及實驗流程；每個都有 topic、instance ID、sourceCallerRefs、畫面原文，以及 click／focus／Escape 的實際結果。

模型、API key、預算與可編輯 context 沒有 UI 控制項，記為 `ABSENT_NOT_A_CONTROL`。floor 選取及 Inspector revision 變更是實際操作的上下文依賴，不是假造一個 context 編輯器。

## 關鍵觀察

- Meta 的真狀態顯示「已阻擋。NETWORK_DISABLED；Live validation NOT_RUN；剩餘額度未知」，提案按鈕確實停用。Root 的 backend 零預算環境收據另見 `docs/15-ui-parameter-audit/evidence/ROOT_GATED_API_REFRESH.json`；本輪沒有把 UI 的「未知」改稱量得 0，也沒有嘗試 live planning。
- 4001 個 UTF-16 code units 的輸入由原生 textarea 限制到 4000；空白指令沒有產生預覽。Ctrl+Enter 在 `Input.imeSetComposition` 的 Chrome 組字狀態不提交；取消組字後正常提交恢復。這是 browser input protocol 的證據，**不是原生 OS／真人 IME**，沒有注入 DOM composition 事件或存取 HostInternal。
- 外部 Inspector 修改場景 revision 後，舊預覽以 `REVISION_CONFLICT` 拒絕，保留外部設定的 soft 材質。
- 1.01 秒保留在欄位時，原生 validity 的 stepMismatch 為 true、aria-invalid 為 false；送出後 Host 明確顯示 `DOMAIN_INVALID：實驗時長必須是 1/60 秒的整數倍。`。這不是成功實驗，沒有繞過 Domain 驗證。
- 真取消後顯示「Host 已確認取消；未執行後續步驟」與「實驗已停止」，duration／baseline 重新可用，尚無基準時 compare 仍停用。這輪捕捉到實際取消，沒有使用「未捕捉瞬態」的 partial 分支。
- 基準 run 為 `run.tool.ad841bb317378d808e023061464809f82fb073c6`，候選為 `run.tool.9f0013f38764214f4e5ef38af2e297b0d00f14eb`。兩者不同，基準保留；基準三步與候選四步皆顯示「完成」。
- 表格 directArrivalTimeS 顯示 **0.017067 s**；原始說明保留 0.01706715921524334 s。候選六頻帶 125／250／500／1000／2000／4000 Hz 可分辨；rt60S 各頻帶維持「未提供」。沒有將 Synthetic late reverb 或有限路徑假稱為完整可分析 IR，也沒有宣稱材質讓結果改善。
- Undo 使 revision 2→3 並恢復 hard，第二次 Undo 停用。新增方塊後，重用 motion 的 RunSimulation 被拒絕且沒有偽造指標表。

## 證據與歷史

- `01-provider-prompt-final-49bde82-01.json`、`02-duration-cancel-final-49bde82-01.json`、`03-closed-loop-final-49bde82-01.json`：逐案控制項快照、outcomes、GET／POST／pageerror、HTTP asset hashes。
- `playwright-final-49bde82-01.json`、`run-final-49bde82-01.txt`／process：框架原始結果、命令退出與 teardown。
- 帶 `final-49bde82-01` 的 PNG：本輪輸入、預覽、provider、stale guard、取消、基準、候選、拒絕畫面。
- `SOURCE_AND_EVIDENCE_MANIFEST.json`：固定本輪兩個測試檔、產品 caller source 與原始證據 hashes；大型 trace 保存在專案 `.cache/pipeline-agent-parameter-audit/`，不大量納入 Git。
- `run-initial.txt`／process 與 `playwright-initial.json`：最初測試 callback fixture 解構寫法錯誤，尚未操作產品。coordinator 精確移置 reporter 原始 bytes，參照上一層 `REPORTER_RAW_RELOCATION.json`，沒有美化 raw。
- `01-provider-prompt-fixture-fix.json` 與 `lease-interruption.json`：舊 19db 候選第一案成功、舊 API 未回傳 JSON；協調者暫停當輪，其餘兩案未跑。這些只屬歷史，沒有拿來冒充新版 gated API 或 final 三案。
- `STATIC_READY.json` 是正式執行前的靜態截點，不代替本輪 browser 結果；`own-process-check.json` 保留舊程序退出盤點。

## 適用範圍

本輪是各命名控制的代表性有效值、錯誤值、邊界、鍵盤／pointer 與已觸發狀態依賴驗證；不宣稱每個瞬態、所有狀態排列、全部自然語言指令、每個 overflow 情況或每種 OS 輸入法都已窮舉。native OS IME、Mac 原生 Cmd、Meta live、真人鍵鼠、聽測、科學量測、600 秒效能與整體 V1 門檻仍分開。取消等待 ack 的禁用瞬態以既有契約／回歸另證，本輪直接保存 running 的 disabled 控制與 Host 最終 ack，沒有把未保存的中間瞬態標成 browser PASS。

未發現本輪需要修改產品的確定缺陷；上述 1.01 秒的原生／ARIA 狀態差異已原樣保存，供 Claude Code 評估輸入提示是否需要調整。下一步由 coordinator 合併這份逐項資料，Claude Code 可在相同 gated backend 與正式 build 上重跑三案，再進行使用者人工測試。
