# Meta Live 驗證操作與限制

本次共用授權為 **US$1、最多三個付費請求**，每次保留 US$0.25；三個 slots 已用完。重啟不能重設 ledger，不可刪除、改名、換路徑建立新預算，亦不可增加上限。一般產品 server 仍預設 network disabled、budget 0。

## 已驗結果

`research/v1/meta-live-validation-20261027-r3-minimal/summary.json` 為 `SOUND_PASSED_SCENE_NOT_RUN`：真實 `/api/agent/propose-sound` → Meta function call → 本機原始 schema/domain 驗證 → trusted Host Apply → 本機 60 Hz、3 秒、180 ticks／181 frames → Capture／Analyze artifacts。`meta-behavior-trace.json` 保存模型設定的 pitch override 2 實際出現在碰撞 start event 的證據。

使用 `muse-spark-1.3` Standard、`max_completion_tokens:1000`、`reasoning_effort:"minimal"`、零重試。成功 response ID 為 `chatcmpl-01a17b26-9b01-76e4-994a-504ee9d735cd`；usage 為 input 4968、completion 262（其中 reasoning 83）、cached input 0。依已查核官方費率，**成功這筆**估計 US$0.0073235；兩筆先前 HTTP 400 的 usage／帳單未知，不能把此值稱為本次總帳單。實際帳單與剩餘 credit 均為 null。

Scene live、模型 RunSimulation、browser、硬體音訊、聽測及物理量測均未由本證據驗收。RunSimulation 是明確由本機 Host 執行；不可稱為模型執行或硬體聲音證據。

## 唯讀查狀態

在專案根目錄使用 PowerShell 執行以下命令。它只讀固定 ledger，不載入 key、不啟動 server、不發網路請求，也不改檔：

```powershell
@'
import {readFile} from "node:fs/promises";
const d=JSON.parse(await readFile("research/v1/meta-live-budget-20261027.json","utf8"));
console.log(JSON.stringify({
  status:d.attempts.length>=d.policy.maxPaidRequests?"BLOCKED":"INSPECT_LEDGER",
  reason:d.attempts.length>=d.policy.maxPaidRequests?"REQUEST_LIMIT_REACHED":null,
  budgetUsd:d.policy.budgetUsd,paidRequests:d.attempts.length,maxPaidRequests:d.policy.maxPaidRequests,
  reservedUsd:d.attempts.reduce((n,a)=>n+a.reservedUsd,0),
  remainingRequestSlots:d.policy.maxPaidRequests-d.attempts.length,
  actualBillingCostUsd:d.actualBillingCostUsd,remainingCreditUsd:d.remainingCreditUsd,inferenceRequests:0
},null,2));
'@ | node --input-type=module
```

目前應顯示 `BLOCKED`、`REQUEST_LIMIT_REACHED`、paidRequests 3、reservedUsd 0.75、remainingRequestSlots 0。這是驗證 ledger 狀態，不是帳戶餘額 API。

## 已執行的驗證命令

以下保留操作形式供追溯；`<server-only-key-file>` 替換為使用者指定且已忽略的本機檔案。**本次 slots 已耗盡，不再執行推論。**

```powershell
node --import tsx server/meta-live-validation-cli.ts --key-file "<server-only-key-file>" --approved-total-usd 1 --output-dir "research/v1/meta-live-validation-20261027-r3-minimal"
```

CLI 使用固定原 ledger `research/v1/meta-live-budget-20261027.json`，沒有 reset、budget override 或 ledger-path 參數。重複相同 output-dir 會因禁止覆寫而本機失敗；換成新目錄時，剩餘 slots 為 0 會跳過所有提案，不能送出第四筆。操作上應使用上方唯讀狀態命令，保留既有 evidence 目錄。

Server-only key loader 接受明確 `--key-file` 或 `META_API_KEY_FILE`，檔案只准一個有引號的 `MODEL_API_KEY`／`META_API_KEY`／`META_MODEL_API_KEY` assignment。Key 僅在 server 記憶體，作固定官方 endpoint 的 Authorization header；不得放進瀏覽器、prompt、artifact、Git、log 或測試 fixture。Loader 的 fake fixtures 不讀使用者 key。

## 失敗與來源紀錄

- `meta-live-validation-20261027/`：首筆 Sound HTTP 400。舊 wrapper 沒有保存錯誤 body，確切原因無法追溯；原 receipt 與 US$0.25 保留額維持。
- `meta-live-validation-20261027-r2/`：Scene HTTP 400 明確指出遠端不支援 `uniqueItems`；`transport-1.json` 只保存清理後的四個有界 diagnostic 欄位與安全 ID。
- 原始兩個 attempts 完整保留；兩份 `meta-live-http400-reconciliation-20261027*.json` 記錄明確授權的 append-only reconciliation。每個新 400 都獨立阻擋；不是 quota 判定，也不退款或移除 reservation。
- Provider wire 僅移除已確認不支援的 `uniqueItems`。本機原始 AJV、domain ID／revision／pin 與 uniqueness 驗證保持；原始 12 個 Scene enum、5 個 Sound operations 未變。
- 最終完整 body、bytes／SHA、官方參數查核、最小差異證明及獨立審查位於 `research/v1/meta-live-payload-preview-20261027-r3-minimal/`。Body 只含固定 synthetic defaults／oscillator／prompt；實際 dispatch 必須與已審查 body 指紋完全相同。
- 舊兩次請求保留精確 payload 與 receipt／ledger 指紋，**沒有每次完整 source-code 快照**；不能宣稱可重建各次所有程式碼 bytes。現有 source 是修復後版本，未用不存在的 commit 補作證明。

官方來源：[工具契約](https://dev.meta.ai/docs/tool-calling)、[strict schema 規則](https://dev.meta.ai/docs/structured-output)、[Chat 參數與 reasoning_effort](https://dev.meta.ai/docs/protocols/chat-completions)、[目前費率](https://dev.meta.ai/docs/pricing-rate-limits)。公開 schema 說明未逐一列出所有 bounds／pattern 支援情形；實際 400 是 `uniqueItems` 不相容的直接證據。

最終離線回歸：provider 23、Sound 16、ledger 17、diagnostic 2、產品 API／本機 runtime fake 5，合計 **63/63 PASS**；全域 TypeScript、scoped ESLint／Prettier PASS。這些假模型測試與真正 live artifact 分開保存。
