# Meta 模型與 API 查核

查核日：2026-10-26（Asia/Taipei）。狀態：**公開文件研究已完成；帳戶存取、推論與端到端整合 `NOT RUN`**。未讀取憑證、未建立金鑰、未呼叫付費 API，也未接受條款。本文的模型候選不是帳戶可用清單。

## 官方文件所確認的能力

| Claim ID | 結論 | 適用條件與證據 |
| --- | --- | --- |
| AI-001 | 官方提供 Meta Model API；基底 URL 為 `https://api.meta.ai/v1`，使用 Bearer `MODEL_API_KEY`。 | [Overview](https://dev.meta.ai/docs/overview)，公開文件 `VERIFIED_DOC`；連線 `NOT RUN`。 |
| AI-002 | 文件目前列 `muse-spark-1.3`、`1.2`、`1.1` 與 `muse-wonder-1.0`；Wonder 處於 preview。 | [Overview](https://dev.meta.ai/docs/overview)、[Models](https://dev.meta.ai/docs/models)。不得把舊版本寫成固定最新版本。 |
| AI-003 | Spark 與 Wonder 接受文字、圖片、影片、音訊、PDF，輸出文字；文件列 1,048,576-token context。Wonder Full 僅在指定 Muse Code 訂閱提供，Model API 不提供。 | [Models](https://dev.meta.ai/docs/models)。文件另列 Wonder 在南韓不可用；不由此推定台灣帳戶一定可用。 |
| AI-004 | 新 agent 工作可評估 Responses API；Chat Completions 不保留跨回合 reasoning，Responses 可選 encrypted replay 或 server state。 | [Choosing an API](https://dev.meta.ai/docs/protocols)。本專案優先自管精簡歷史，避免預設依賴 server state。 |
| AI-005 | 函式工具由應用程式執行；支援平行與串流參數，但 `tool_choice` 目前只接受 `auto`。`max_tool_calls` 不限制開發者函式工具總迴圈。 | [Tool calling](https://dev.meta.ai/docs/tool-calling)。executor 自行計數；串流尚未完成不得執行。 |
| AI-006 | 有 structured output；嚴格模式需一般 object root、所有 object 禁止額外欄位、所有 properties 必 required；不支援 `oneOf`／`allOf`，`anyOf` 不得在 root。 | [Structured output](https://dev.meta.ai/docs/structured-output)。還有限深度 10、總 properties 5,000、不得循環 `$ref`；須以實際 API contract test 再確認。 |
| AI-007 | 圖片理解可提供語意線索；影片與音訊理解輸出文字。 | [Image understanding](https://dev.meta.ai/docs/image-understanding)、[Video and audio understanding](https://dev.meta.ai/docs/video-understanding)。這些不是聲學校準、RIR 或材料量測工具。 |

主張來源是當日官方文件，不是獨立能力評測。模型 latency、場景正確率、台灣帳戶可用性與 hackathon credits 仍未實測。舊發布稿的 private preview 描述不能取代當前 Models／帳戶目錄。

## 成本、配額與資料

以下為當日公開價目，USD／百萬 tokens；不可視為帳戶報價或永久價格。

| 候選 | 未快取輸入 | 快取輸入 | 輸出 | 公開團隊上限 RPM／TPM |
| --- | ---: | ---: | ---: | --- |
| Spark Standard | 1.25 | 0.15 | 4.25 | 3,000／4,000,000 |
| Spark 1.3／1.2 Contributor | 0.10 | 0.002 | 0.20 | 150／3,000,000 |
| Wonder Standard | 4.00 | 0.20 | 20.00 | 3,000／4,000,000 |

速率按 team、按模型共享，不因多建 API keys 增加。429 依 `Retry-After` 與有 jitter 的 exponential backoff；web search 另計每千次 2.50 USD。本專案不預設啟用內建付費搜尋。出處：[Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits)（AI-008）。例如未快取輸入 8,000＋輸出 2,000 tokens 的 Spark Standard **價格推估**為 0.0185 USD，不是已發生費用，也不包含後續回合。

Standard Content 不用於訓練 Meta Models；Discounted／Contributor Content 可用於訓練與改善。Content 包含輸入與輸出，與帳號類 Customer Data 不同。一般 retention 依條款及隱私政策，不能聲稱「不訓練＝不保存」。出處：[Data Commitments](https://dev.meta.ai/legal/commitments)（AI-009）。

ZDR 需要合格帳戶及 Meta 另行啟用，依模型可能不同；不支援 server-side stateful history、background、file uploads、web search、Contributor，且仍有法遵／濫用及營運 metadata 例外。未核實本帳戶 ZDR。出處：[ZDR](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention)（AI-010）。

## Reflection Lab 選型與上線閘門

**暫定候選：Spark Standard；較複雜規劃可受預算限制地評估 Wonder。** 這是以文件成本與用途作的工程推論，尚未做模型間 A/B。預設不選 Contributor；schema 的 live policy 目前只允許 Standard。媒體預設不上傳，必須由使用者明確選取並去除非必要個資。

`AiProvider` 應有以下概念介面；這是待實作設計，repository 中的 schema／fixture 不構成 live adapter：

```ts
interface AiProvider {
  getAvailability(): Promise<CapabilityEvidence>;
  propose(context: RedactedContext, tools: ProviderToolSpec[]): Promise<Proposal>;
  cancel(requestId: string): Promise<void>;
}
// OfflineFixtureProvider: local deterministic proposals, no network or model identity.
// MetaModelApiProvider: future server-only adapter, guarded by verified account evidence.
```

live enable 必須依序具備：帳戶授權及適用條款 → 實際 `GET /v1/models` 證據 → 指定 model 的最小 function／strict-output contract test → 費率與隱私模式確認 → 使用者配置非零費用上限 → host 寫入有時效的 verification artifact。`GET /v1/models` 是官方建議的 team catalog 查核方式；這一步本次未執行。[Models](https://dev.meta.ai/docs/models)

host 驗證 `ai-provider-config.schema.json` 之後還要檢查證據簽發者、model ID／data mode 一致、權限、證據有效期、價格版本與配額。JSON 中自行寫 `verified` 沒有效力。預設 `offlineFixture`、`networkEnabled:false`、`maxEstimatedCostUsd:0`；無驗證回 `PROVIDER_UNVERIFIED`，保留離線功能，畫面清楚顯示「離線示例，未連線 Meta」。不得將 fallback 包裝為已完成競賽要求的 Meta 整合。

## 待驗證與解除條件

| 項目 | 本次狀態 | 下一步所需證據 |
| --- | --- | --- |
| 官網文件 | `PASS` | 上述直接來源可讀；發布前再查。 |
| 帳戶模型、區域、credits／billing | `NOT RUN` | 使用者自行配置帳戶後，以遮罩的 catalog／billing metadata 留證。 |
| tools、strict JSON、媒體端到端 | `NOT RUN` | 小型可重現 contract fixtures；負例、拒絕、截斷、timeout、429 都要測。 |
| 準確度、延遲、成本 A/B | `NOT RUN` | 固定 prompt／版本，報告成功率與實測 usage，不能採信宣傳 benchmark 代替。 |
| adapter 與 executor | `IMPLEMENTATION_PENDING` | 依另外三份契約實作；本階段未啟動產品功能。 |

未取得登入頁內容不等於 API 不存在；公開文件可讀也不等於帳戶已有權限。之後若官方文件不可達，記錄 URL／時間／HTTP 狀態，沿用帶日期的研究並關閉未驗證 live 路徑，不猜測新版能力。
