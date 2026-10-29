# 額度、錯誤與資源查核

查核：2026-10-26（Asia/Taipei）；Muse Code **1.4.13 (R6996.1)**。公開文件、已安裝 CLI help／schema 與實際帳戶回應分別記錄。本次沒有模型推論、付款、升級、重設額度或切換帳號。

## 分開的資源來源

| 資源 | 可確認的觀察方式 | 本次證據與限制 |
| --- | --- | --- |
| Muse Code 訂閱 | `muse usage --json`；serve protocol `usage/read`／`usage/changed`；exec JSONL `run.usage` | 1.4.13 help 與 schema 已查。實際 usage 查詢 exit 1：`usage refresh failed (transient)`；剩餘額度 **UNKNOWN**，不是耗盡。 |
| Meta Model API 產品 Runtime | 成功回應 usage／rate headers、實際錯誤、經確認的 dashboard billing | 本次無模型請求／帳戶 billing 查核；credit balance **UNKNOWN**。未找到已公開、已驗證的通用剩餘 credits API。 |
| Codex 開發額度 | 官方 app-server `account/rateLimits/read`／`account/rateLimits/updated`；本機 app 的唯讀 usage 工具 | 文件確認方法存在；不代表由 Harness 直接連到目前 Codex session，也不代表 OpenAI API balance。Harness adapter 的可用性由當次資源證據決定。 |

Muse 訂閱只適用 Muse Code 專用 onboarding credential；另建 API keys 使用 pay-as-you-go。不可把產品 API credits 當作 Muse 訂閱剩餘量，也不可為了延續任務改用未授權 credential／plan。[訂閱](https://dev.meta.ai/docs/muse-code/subscriptions)、[認證與計費](https://dev.meta.ai/docs/muse-code/auth)

## Muse 額度資料契約

官方 changelog：1.4.0 加入 serve `usage/read`；1.4.11 加入 exec `run.usage`；1.4.13 加入 `muse usage`。這是版本限定能力，不能套到任意舊版本。[Changelog](https://dev.meta.ai/docs/muse-code/changelog)

實際 1.4.13 `muse schema` 匯出確認 `SubscriptionUsage` 包含 `observedAtMs`、`tier`、`window{usedPercent,resetsAtMs,windowDurationMins}` 與 `weekly{usedPercent,resetsAtMs}`。百分比是已使用量，可能超過 100；顯示剩餘量時才做 `max(0,100-usedPercent)`。時間為 epoch **毫秒**。這些是 last-observed 資料，必須顯示觀察時間；時間戳老舊、reset 已過、欄位缺失或查詢失敗時不能宣稱即時剩餘量。`usage/read` 未觀察到任何資料時省略 `usage`，不應補成 0%。

`TurnError` 的 optional `quota{limitKind,resetsAtMs}` 是型別化 quota detail；實際 schema 說明它只在 quota 類停止錯誤出現，應依 presence 判斷，不能只搜尋 message。已知 `limitKind` 是 `tierLimit`，此 enum 為 open；未知值保留並走保守分支。Schema fingerprint：`7fddaf646dbc317e5fcac0785e135eb04df14fbb0db1863089dfd6da21730e5b`；JSON 檔案 bytes SHA256 是 `59c3c649418af35b54d4c64153210b2c77f8e0be2e47bf595a0ad33194530894`，兩者不同。本地觀察與來源固定於 [metadata](../../research/agents/quota-source-metadata.json)。沒有實際 quota-stop frame，故這是 **schema 驗證**，不是已重現帳戶耗盡。

## 錯誤分類與執行政策

| 證據 | 分類 | 動作 |
| --- | --- | --- |
| Muse 型別化 `quota`，或有效、未過期的 window／weekly usedPercent ≥100 | 訂閱額度停止 | 保存修改、確認舊 process 已停止、建立 handoff；允許 Codex 接手。 |
| HTTP 429／`rate_limit_error` | 暫時性 rate limit | 有限次 backoff；超過次數／等待預算後可暫時切換，原因仍記 RATE_LIMIT。 |
| HTTP 402／`billing_error` | Billing unavailable | 不盲重試；不直接等同 credits 用完，因為可能是付款／帳戶設定問題。 |
| 經確認的 billing 額度耗盡證據 | Credit exhausted | 停止該資源的 live 呼叫；保留來源與觀察時間。 |
| HTTP 401／`authentication_error` | 認證錯誤 | 不重試猜 key、不換帳號；保存錯誤，依政策切換開發 executor 或 BLOCKED。 |
| HTTP 403 | 權限錯誤 | 不提高權限；保留該錯誤，不標 quota exhausted。 |
| HTTP 500／503、連線中斷 | 暫時故障 | 有限次 backoff，超限後依故障政策切換。 |
| HTTP 400／404／413 | 請求／資源／大小問題 | 修正請求，不反覆重送；不是 quota。 |
| HTTP 504／`gateway_timeout` | 請求超過 server 時限 | 應減少工作或改合適的串流／背景模式，不能無限原樣重試。 |
| 本地 EPERM、schema drift、未知 exit／文字 | 本地／協定／未知錯誤 | 停止並保留診斷；不能從非零 exit 推定額度。 |

官方錯誤 envelope 為 `error{message,type,param,code}`，`code` 可能為 null；以 status 與 type 為主要線索。已確認例子包括 `invalid_api_key`、`billing_not_configured`、`rate_limit_exceeded`、`server_shutting_down`、`service_overloaded`、`backend_unavailable`；沒有證據把 OpenAI 的 `insufficient_quota` 當成 Meta 固定 code。[Error handling](https://dev.meta.ai/docs/error-handling)、[常見錯誤](https://dev.meta.ai/help/usage-and-limits/common-api-errors)

429 的 rate headers 是 team／model 的短期 requests／tokens 配額。重試遵守 `Retry-After` 最小等待，否則採 bounded exponential backoff＋jitter；本地政策同時限制嘗試次數與總等待。若 `Retry-After` 超出剩餘等待預算，直接保存後 fallback，不提早重送。這些 headers 不證明美元餘額或訂閱可用量。[Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits)、[Retry cookbook](https://dev.meta.ai/docs/cookbook/error-handling-retry)

Codex 官方 rate limit result 使用 `usedPercent`、`windowDurationMins`、`resetsAt`（epoch **秒**），並可提供多個 `rateLimitsByLimitId`。不要與 Muse 的毫秒欄位混用；missing／null 是 unknown。禁止自動 consume reset credits、寄送 billing nudge、調整付費上限或繞過限制。[Codex App Server](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt)

## 實際驗證範圍

CLI 版本、help、公開 schema：已查。Muse usage 唯讀實際查詢：[實際失敗觀察](../../research/agents/muse-cli-probe/usage-query.json)為 transient failure；沒有取得數值。Muse 訂閱耗盡、Meta API balance／429／401／503 的 live 重現：**NOT RUN**。故障注入是 mock process／fixture 驗證，不能寫成供應商 live quota proof。產品 Meta API 不可用時仍可用明示 `offlineFixture` 的資料測試，live Meta integration gate 保留 BLOCKED／NOT RUN。
