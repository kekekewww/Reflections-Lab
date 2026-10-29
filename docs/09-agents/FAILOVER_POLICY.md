# Executor Failover 與資源政策

> **2026-10-27現行政策：Codex主導，Muse Code僅選用。** 見 [ADR-013](../02-architecture/adr/013-codex-primary-development.md)。以下Muse優先流程保留為Optional Harness／Phase3歷史profile，不是正常開發前置，恢復額度也不使專案自動切回。

Preferred=MUSE；Fallback=CODEX；Orchestrator=CODEX；Verification=固定的 automated tests／reference 與隔離審查。實際機器可執行介面見 [操作流程](CODEX_MUSE_ORCHESTRATION.md)；已驗證的 provider 能力見 [額度研究](QUOTA_RESEARCH.md)。這份政策不能把未執行 live validation 改成 PASS。

| 證據／狀況 | 分類與策略 |
| --- | --- |
| Muse 正常 | Muse 執行，原始 acceptance 另行驗收 |
| HTTP 429，未附可信 quota 訊號 | RATE_LIMIT；有限指數 backoff／Retry-After，總 attempts／時間仍有限 |
| Muse typed quota（window／weekly），或明確耗盡證據 | MUSE_QUOTA_EXHAUSTED；先停寫與 snapshot，再接手 |
| HTTP 402 billing_not_configured | Billing 問題；可能未設定付款或餘額不足，不能自動宣稱 subscription 耗盡 |
| 明確 API insufficient balance／quota exceeded | 對該資源 domain 停止，不跨帳號／提額；開發與產品 quota 分開 |
| HTTP 500／503／網路暫時故障 | 有界重試；重試預算不足時依 routing 政策接手 |
| HTTP 504／長任務 timeout | 不盲目重送同一昂貴工作；保留 checkpoint，縮小 scope 或停止 |
| 401／invalid API key | AUTHENTICATION；保存並標示，不宣稱 quota；不讀取／輪替私人 keys |
| 403 | PERMISSION；不繞過 sandbox 或切換未授權帳號 |
| 未識別錯誤／event schema 變動 | UNKNOWN／PROTOCOL；拒絕成功判定，保留診斷，不猜 quota |
| Codex 也不可用 | 保存後 BLOCKED，停止消耗資源 |
| Muse 恢復 | 更新有時間的 resource evidence；當前任務完成或安全 checkpoint 後才考慮切回 |

CLI 與 API 錯誤 shape 不同，不從一段含「quota」的模型文字作唯一判斷。HTTP status、正式 error type／code、typed quota、已核實 usage／billing metadata 各自保留來源。`muse usage` 失敗是 UNKNOWN，不是 0% 剩餘。百分比只代表相應 allowance window；rate headers、token 數與美元餘額不能相互換算。

## 安全接手順序

停止派送 → 停止原 executor 並確認 writer 已釋放 → 保存 redacted session log、內容與 Git snapshot、成功 criteria／remaining work → 更新同一 Run State → 建立 handoff → Codex 檢視 partial diff → 完成剩餘 scope → 執行原 acceptance → 有界 repair → 更新 task evidence／Wiki。任何一步不能證明安全時 BLOCKED，不讓兩個 executors 重疊。

切回採 task boundary／明確安全 checkpoint，保留 previous／actual executor、原因與 event history，避免每個 retry 反覆切換。重複 resume 不重做已 COMPLETED 的實作；checkpoint 不是自動完成，驗收仍需確認。

## 預算與授權

預設 monetary budget=0，retry／repair／steps／wall-time／output bytes 均有限。未知 usage 留 null；保守估算要標 ESTIMATE 與依據，不能偽造。Resource manager 是本地調度上限，不能保證 provider 即時計費停止；未有可靠 per-run cost ceiling 時，非零付費路徑也應 fail closed，不把 local timeout 當付款保證。

不自動提高付款上限、不購買 credits、不切換未授權帳號、不繞過限制。`set-resource` 記錄操作者 observation，不等於即時查詢，更不能令過期 billing 資訊變成可信餘額。切換開發 executor 不移除產品 Meta integration；live tests 缺 quota 時 BLOCKED／NOT RUN，可繼續明示 Mock／offline 測試。
