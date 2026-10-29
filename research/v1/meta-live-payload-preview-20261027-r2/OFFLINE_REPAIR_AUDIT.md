# Meta Live 第二版離線修復審查

查核日期：2026-10-27。這份文件與 payload preview 不呼叫模型，也不讀取金鑰。

首筆實際 Sound 請求回 HTTP 400。原始紀錄位於 `../meta-live-validation-20261027/`，ledger 保留 attempt `meta-live-057a820a-ee0b-49d7-9692-d8afe385f56d` 的 US$0.25。因舊 wrapper 只解析成功 body，未保留拒絕原因；response ID、model ID、usage、實際帳單仍為 null，不能推定無費用或 quota 耗盡。保留原 attempt，僅依既有 US$1 修復授權追加明確的 HTTP 400 reconciliation。

已修復：只保留經遮蔽且有長度上限的 error code/type/param/message；遮蔽完整金鑰與任何 LLM_ 字樣的 credential；先保存 transport receipt，再執行 ledger 檢核；不保存 raw body 或 headers。不自動重試 proposal，新的 400 仍會獨立阻擋後續 dispatch。ledger reserve 的拒絕回傳 BUDGET_EXCEEDED，已知 4xx 回傳 PROVIDER_REQUEST_FAILED。

離線對照目前官方文件：

- [Structured output](https://dev.meta.ai/docs/structured-output)：root object、nested anyOf、關閉額外欄位、所有 properties 必填、無 oneOf/allOf、深度上限 10。Sound schema 符合公開規則且深度恰為 10；Scene 各工具深度 1–4。官方未將 minItems/maxItems 或沒有明示 type 的 const/enum 列為禁用。這些項目不是已確認的 400 根因，因此不猜測刪除限制或放寬原始 schema。
- [Tool calling](https://dev.meta.ai/docs/tool-calling)：目前 Chat Completions 的 function 包裝、auto 與 parallel_tool_calls:false 皆有依據。
- [Chat Completions 協定](https://dev.meta.ai/docs/protocols/chat-completions)：developer role 與 max_completion_tokens 有官方契約。保留目前 transport 與參數，不切換帳號、模型或 endpoint。
- [錯誤格式](https://dev.meta.ai/docs/error-handling)：validation rejection 的 code 可能為 null，因此同時保留清理後的 type、param、message。
- [價格](https://dev.meta.ai/docs/pricing-rate-limits)：muse-spark-1.3 Standard input US$1.25/M tokens、output US$4.25/M tokens。估計不折抵 cached input；actual billing 與 remaining credit 仍未知。

下一次只先送較小且原本已審查的 Scene body。成功後由真實產品 Host Apply；後續 Sound preview 精確反映新增 sphere 後的 scene revision 1。任一失敗即停止當次執行。現有 ledger 僅剩兩個付費 slots；若 Scene/Sound 均成功，RunSimulation 由明確授權的本機 Host 以 60 Hz 執行 3 秒，不再增加模型請求。三份 body 都提供精確 bytes/SHA；第三份只供仍有 slot 的假資料測試，這次實際 ledger 不會 dispatch Run body。

三份 body 僅含程式內固定 synthetic scene、behavior、material label、oscillator 與固定 prompt，不含使用者專案、檔案、音檔或 credential。既有原始 12 個 Scene enum、5 個 Sound operations 與本機 strict/domain/pin/revision 驗證保持。只有 ignored credential file 會被 server loader 讀取，並只作官方固定網域的 Authorization header；其值與 hash 永不輸出或傳入 prompt。
