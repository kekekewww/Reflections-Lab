# Model 與 Executor Routing

> **2026-10-27現行政策：Codex主導，Muse Code僅選用。** 見 [ADR-013](../02-architecture/adr/013-codex-primary-development.md)。以下Muse優先流程保留為Optional Harness／Phase3歷史profile，不是正常開發前置，恢復額度也不使專案自動切回。

採用的工程政策：**Codex Orchestrator → Muse Code preferred implementation → deterministic verification＋Codex review**；當 Muse 在已定資源預算內不可繼續，改為 **Codex implementation → independent validation**。Executor 名稱與實際模型是不同欄位，不能用「Muse」或「Codex」掩蓋實際 provider／model／CLI version。

## 開發工作路由

| 工作 | 優先路由 | 升級／fallback 邊界 |
| --- | --- | --- |
| 小型、可清楚驗收的實作／修正 | Muse Code＋經確認可用的 Spark Standard candidate | 先縮小 scope／提供失敗證據；額度／故障依 failover policy。 |
| 困難除錯、長程跨檔案工作 | 可評估 Muse Wonder candidate | 需已確認 account availability／預算；不得自動提高計費上限。 |
| 任務拆分、ADR、驗收與整合 | Codex Orchestrator | Codex 接手實作時不得同時以自審作最終成功依據。 |
| 固定驗收、數學／物理參考、schema／CI | 獨立 test runner／reference | 實作者不得任意改測試與 expected values；缺少 UI／音訊 E2E 要明列。 |
| Muse quota exhausted／有界 retry 後不可用 | Codex fallback | 先停止原 process、保存 checkpoint／diff、取得唯一 workspace ownership；不雙寫。 |

這是基於工作負載的選擇，沒有模型速度／品質 A/B 勝出證據。CLI 的預設 model 在當次官方文件仍為 Spark1.2，本專案候選1.3必須顯式配置及先確認可用性；不能把安裝 CLI 當成帳號已具該型號權限。[Models](https://dev.meta.ai/docs/models)、[Configuration](https://dev.meta.ai/docs/muse-code/configuration)

## 產品 Runtime 路由

Meta Model API 是產品 AI Experiment Agent 的正式目標，不隨開發 executor 換成 Codex API。低成本規劃可評估 Spark Standard；高難度規劃才評估 Wonder。Image／SAM／Open／Glimmer 保留研究候選，不增加 MVP 強制模型。[模型比較](MUSE_MODEL_RESEARCH.md)

Runtime quota exhausted 時，host 保留 Meta adapter／tools／integration gate，使用明示 offlineFixture／recorded response 進行離線測試。產品不得把 fixtures、Codex 開發成果或其他 provider 輸出標成真實 Meta output；需要 live Meta 的 demo 在提交前必須重驗 catalog／tool call／實際連線。

## 資源與身份

開發 Muse subscription、開發 Codex usage、產品 Meta API credits 分開記錄。unknown 不當作0或∞，觀察附來源／時間。subscription usage、rate headers、美元 balance 不相互推算。Contributor 模式預設 off；禁止自動升級訂閱、consume reset、換 key／帳號或採未授權 provider。成本預設0；付費 run 要有明確已配置 budget。[Quota research](QUOTA_RESEARCH.md)

模型恢復僅在安全 checkpoint／任務完成後切回 Muse；對同一任務保留原 task ID、goal、milestone、criteria／測試 hashes 與完成進度，不能因 executor 改變重建一項假全新任務。詳細狀態機與 CLI 以 [Orchestration](CODEX_MUSE_ORCHESTRATION.md) 和 [Failure recovery](FAILURE_RECOVERY.md) 為準，本文不另建狀態權威。
