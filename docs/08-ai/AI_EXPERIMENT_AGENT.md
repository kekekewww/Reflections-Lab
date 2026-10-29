# AI 實驗 Agent

狀態：`DESIGN_READY / IMPLEMENTATION_PENDING`。Agent 的工作是規劃、選擇工具及解釋 evidence；物理／聲學數值由版本化 solver／analysis 或量測流程產生。沒有 artifact 時回答「尚無結果」，不補出看似合理的數字。

## 角色與資料流

```text
user goal + constraints
  -> planner (AI, untrusted proposal)
  -> schema/domain/policy + preview (trusted host)
  -> approved immutable scene + replay trace
  -> deterministic simulation worker
  -> versioned artifacts + numerical analysis
  -> paired comparison
  -> explanation linked to metric records
```

planner 不直接碰 filesystem、shell、憑證、任意 URL 或正式 scene handles。研究與材質檢索使用 curated read-only registry，不暴露任意搜尋／寫入工具。資料中出現的 prompt injection 當內容引用；不得修改系統政策或工具白名單。

## 可重現實驗流程

1. 將「降低回音」轉成可計算目標，例如指定 band 的 T20 與 C50，連同目標值、容差、可改參數、限制、計算方法、資料來源。目標值屬 user target／設計參數，不是 measured 結果。未定義用途或資料不足先列 assumptions，讓使用者修改預覽。
2. 讀 scene、registry、backend capability、現有 experiments 與 budgets。只建合法變更包；通過 preview／host 授權才產生 revision。材料數據如為 demonstration preset，將此限制帶到後續報告。
3. 保存 baseline：Scene revision／hash、材質版本、solver版本、step size、seed、source signal hash、listener、atmosphere、motion trace hash、analysis version與音訊sample rate。固定 seed 不等於跨平台物理完全 deterministic；若要相同動作，使用保存的 transforms／velocities／collision trace 並記錄 replay method。
4. RunSimulation 建立 runId，worker 只讀 immutable input。以 host 狀態追蹤進度；不讓 AI 把「已排隊」寫成「模擬完成」。失敗、timeout或取消保留診斷並停止該條分支。
5. CaptureExperiment 保存結果引用與完整設定。AnalyzeAcousticResults 從 RIR／trace 計算支援的 metrics；沒有足夠 decay／noise floor 時回 value:null＋原因，不能把 fitting 或語言模型猜測當RT60實測。
6. 建立 candidate，只更動目標自變項；同 motion trace／source／listener／solver／analysis。CompareExperiments 先驗證條件一致，再計算 paired delta＝candidate−baseline，保留原值、unit與band。不符合可比性回 INCOMPATIBLE_EXPERIMENTS，不能默默換reference。
7. AI 引用實際 metricRecordIds 解釋影響、限制及下一個候選。數值進步只在有 evidence 時描述；最佳候選僅限已執行且有效的集合，不能宣稱 global optimum。

## 來源標籤

| 標籤 | 定義 | 必要來源 |
| --- | --- | --- |
| Measured | 由實際校準流程取得的量測 | dataset／裝置／方法／環境／校準紀錄及 artifact hash。 |
| Computed | 指定 solver／分析方法在給定輸入產生的數值 | scene／run／版本／參數／公式或analysis method／artifact hash。不是實際房間量測。 |
| Estimated | 近似公式、插值或有明示假設的推估 | 方法、輸入來源、適用條件、不確定性；如由AI建議亦不可轉成measured。 |
| AI-generated Explanation | 語言模型對已提供 evidence 的文字說明 | model／prompt version（若live）、metric references、來源摘錄與限制。不能充當數值producer。 |

論文摘要、媒體語意、照片材質辨識、AI 生成數字都不能建立 Measured record。示範 fixture 的 provenance 另在 artifact metadata 標記 synthetic fixture；可用於解析與流程測試，不混入研究結果。歷史 computed metrics 在使用舊 material 或 solver 後仍保留版本，不以新版本標籤覆寫。

## Run 狀態與停止條件

正常：queued → running → succeeded。例外：running → cancelRequested → canceled；queued／running → failed／timedOut／budgetExceeded。已完成狀態不可再變成 running；重跑建立新 runId 並記錄 parent。上限先扣可保留 quota，開始前再檢查，結束以 actual usage reconcile。

預設應用政策（schema 上限，不代表服務商配額）：每次 agent session 最多12 planning turns、48 tool calls、6 simulation runs、同時1個 simulation、120秒 wall time、32,000輸入tokens、4,000輸出tokens、最多2次transient retry。offline 雲端預算0 USD；live 預算預設0，使用者配置後最高1 USD／session。無費率／無法計算 token reserve／預算不足時停止，不能靠重試猜測費用。host 預算不交給模型修改。

取得 user stop 即停新派工、取消排隊任務並向 worker 發 cancel；UI 立即顯示 cancelRequested，直到 acknowledgement 才宣稱 canceled。worker 定期檢查 abort／wall time；過期回覆只存診斷，不再套 scene。budget／time stop 回傳目前已完成有效候選與未完成項目。

對 `rt60S` 等無資料／不支援值，最佳化演算法忽略該候選或明示目標不可評估；不以0填補缺值。不建立無上限 agent loop，不因模型要求擴大 run duration、reflection order或cloud預算。

## 驗證設計

| Level | 具體驗證 | 本次狀態 |
| --- | --- | --- |
| Contract | 全工具正例、範圍負例、額外欄位、錯誤shape、unverified provider gate、無artifact禁止數值解釋 | schema fixtures 可離線執行；見驗證器實際輸出。 |
| Executor | unknown ID、stale revision、preview conflict、idempotency、undo、取消、worker crash、資源限制 | `NOT RUN`，executor尚未實作。 |
| Science | 解析fixture、reflection arrival、材料能量、RIR fitting、analysis units與A/B paired delta | 依聲學驗證文件；不能以LLM對數字的評語代替。 |
| Provider | catalog、function calls、strict subset、拒絕／截斷、429、media privacy、usage計費 | `NOT RUN`。需帳戶與明確預算。 |
| Grounding | 說明引用每個數字；改寫／刪除artifact後拒絕假引用；將computed／estimated混稱measured的誘導測試 | `NOT RUN`，實作後必測。 |

下一個AI工程切片：先以 OfflineFixtureProvider 實作一個 `AddObject → Preview → Apply → Undo` 的 host交易與 run ledger，接入真實 domain validator；另接純函式分析fixture以驗證 numerical grounding。通過後才以相同工具規格加入受gate控制的 Meta provider。這是未來工作，不是本階段已完成產品功能。

## Sound Behavior擴充邊界

新[Sound Behavior AI規格](MUSE_SOUND_BEHAVIOR_INTEGRATION.md)仍使用Meta Model API及同一host權威，與Codex開發分離。原流程第6項的source equality適用acoustic比較；若變動音檔／gain／pitch／profile，必須採[behavior A/B](../07-experiments/AB_COMPARISON.md)新draft契約並宣告自變項，不把舊CompareExperiments暗中改成任意條件比較。原12工具enum保持，新增工具／analysis adapter尚未實作。
