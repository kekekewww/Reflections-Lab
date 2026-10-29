# r3-minimal 獨立離線審查

審查結果：**PASS，限 payload、資料來源、執行範圍與送出前檢查**。此紀錄不表示 Meta 已接受 schema、模型已成功回應，或帳號餘額／實際費用已知。審查日期為 2026-10-27；審查者為獨立子代理 `sound_live_contract_review`，另由 `schema_union_audit` 獨立比對完整 Sound body。

三份 raw request、readable JSON 與 manifest 已逐一解析並比對，byte count 與 SHA-256 一致：

| Body | Bytes | SHA-256 | 本次送出範圍 |
| --- | ---: | --- | --- |
| Sound | 15309 | `8e1a1f494b83e276dc44247f93e85c30254fca91c89dc509c6ffb8775950db88` | 唯一允許的最後一次請求 |
| Scene | 11951 | `a1c62457956c9137c288e68e87d067254c6751a6c8f37db2e7f86481e99d4905` | 未請求 |
| Run | 11867 | `7e008e7a35f225e2496bd86ec6e6afee346589bc966b078e5d185ad99031f57f` | 未請求 |

完整 user message 已與 `createDefaultScene`、`createDefaultBehaviors`、`DEFAULT_MATERIALS`、`makeBehaviorContext` 及固定 `meta-live-fixture` prompts 重新建構比對。內容只有自行撰寫的 Synthetic 場景、材質標籤、oscillator registry、固定指令及工具契約；Sound 使用 scene revision 0、document revision 0。未包含使用者實際專案資料、檔案內容、音效 samples、機密或 credential。完整 body 未見 credential 標記或本機路徑。preview generator 使用 capture-only fake fetch，沒有金鑰 loader 或真實網路。

完整 Sound request 與最初 r1 body 的 AST 比對，差異確實只有移除一個遠端 `uniqueItems: true`，以及新增頂層 `reasoning_effort: "minimal"`；所有 prompts 與 Synthetic state 完全相同。前者依據已保留的 r2 `transport-1.json` 明確 HTTP 400 診斷，屬於已確認的 provider grammar 調整。原始 schema、12 個 Scene enum 與 5 個 Sound operations 未變更；nullable optional 還原後仍經原始 AJV 與可信 Host domain 驗證。後者的官方查核來源與限制另記於本目錄 `SCHEMA_COMPATIBILITY_AUDIT.json`，對應 [Chat Completions protocol](https://dev.meta.ai/docs/protocols/chat-completions)。公開規格未逐項涵蓋其餘 schema keywords，不推定最後請求必定相容。

Sound provider 的 16 個 fake tests 已由本代理及另一獨立子代理分別執行通過。新增案例確認：遠端 grammar 不含 `uniqueItems`，重複 lifecycle stops 仍被原始 AJV 拒絕；wire-valid 重複 CreateProfile、AssignBinding 或 rule ID 仍被可信 Host 以 `DUPLICATE_ID` 拒絕且不修改 state。這些驗證沒有模型呼叫。

已檢閱 CLI 與 provider 的實際控制流程：主程式固定讀取本目錄、固定 `sound-only` 與 `minimal`；載入金鑰前先核對 manifest 與三份 body。paid transport 再核對固定官方 endpoint、POST、`muse-spark-1.3`、1000 completion tokens、`minimal`、function tools、`auto`、禁止 parallel，並在 reserve／network 前比對實際 body bytes 與 SHA-256。redirect 為 `error`，validation provider 設定零重試。既有共用 ledger 沿用，未重建或退款；兩次 HTTP 400 及 US$0.50 保留額度仍保留，最後一個 request slot 最多再 reserve US$0.25。

`sound-only` 分支不呼叫 Scene 或 Meta Run。只有單一有效 Sound function call 通過本機 restage、使用者授權的 Host Apply 後，才執行明確本機 60 Hz、3 秒 Run，核對 180 ticks／181 frames、指定 binding／rule 的 pitch 2 computed event 與 Capture／Analyze artifacts。成功狀態明列 `SOUND_PASSED_SCENE_NOT_RUN`、`HOST_EXPLICIT_FIXED60`；硬體音訊、聽感與實體量測仍為 NOT RUN。HTTP 錯誤使用受限的 typed diagnostic，先留存 receipt，再結算 ledger；未知 metadata 維持阻擋。

本次獨立重建與完整 body 比對命令 exit 0。另一次獨立子代理的 Sound 全文差異、hash 與 CLI 範圍審查亦 PASS。本審查未讀取真實 key、實際 ledger 或 catalog，未呼叫 API，未執行付費請求；僅新增本審查文件。既有 r1／r2／r3 preview 未修改。父代理另回報最終 63 個 fake tests、完整 TypeScript、ESLint 與格式檢查通過，這些屬父代理執行證據，未重複計為本次獨立執行。
