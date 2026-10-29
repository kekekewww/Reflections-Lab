# 產品 Meta 實驗 Agent 架構審查

查核日期：2026-10-29（Asia/Taipei）。程式基準：`c210ca882ca8503b322c28884bf1e9f6e9fe126d`；研究工作區：`research/architecture-review-20261029`。本文件為**研究與建議**，不是新功能採納、帳號授權或完整第一版驗收。新研究沒有呼叫付費模型、讀取金鑰、擴大預算或接受條款。既有證據只按原範圍引用。

## 1. 結論與界線

現行方向正確：不可信模型提出受限工具參數，Node 本機服務只規劃，瀏覽器 trusted host 再驗證當前 scene／behavior revision、提供差異預覽，使用者 Apply 才提交可復原交易。物理、聲音行為及聲學由版本化程式產生結果，模型不能製造量測值。開發使用 Codex 與產品使用 Meta Model API 是兩件事；依 [ADR-013](../02-architecture/adr/013-codex-primary-development.md)，Muse Code 成功不構成產品 Meta live 證據。

最需要處理的是**能力宣告與實際工具對齊**、**本機 demo 與可部署服務的安全界線**，以及**歷史最小 live 與現行完整產品證據分離**。原 12 工具不是本需求列出的 13 個名稱；不能靠改名或寫報告補成已實作。

[AI_EXPERIMENT_AGENT](../08-ai/AI_EXPERIMENT_AGENT.md)、[AI_TOOL_SCHEMAS](../08-ai/AI_TOOL_SCHEMAS.md)、[PHASE3_RUNTIME_AGENT](../08-ai/PHASE3_RUNTIME_AGENT.md) 有歷史「尚未實作」與舊 Muse 開發流程段落。現行程式已超越其中部分狀態；本文件不覆寫歷史或以舊標頭否定現行程式。需求／採納決策／實作／實測各自判定。

## 2. 官方 Meta API 現況

以下是 2026-10-29 官方公開文件的精簡轉述，並非本帳號已取得相同權限。

| 項目 | 本次可核實內容與設計影響 | 官方來源 |
| --- | --- | --- |
| 模型 | `muse-spark-1.3` 仍列最新；1.2／1.1仍列可用。`muse-wonder-1.0` 已列 Available、Standard only；舊 preview 描述只能保留為歷史。Wonder Full 限 Muse Code。公開列表不能代替團隊 catalog 實測。 | [Models](https://dev.meta.ai/docs/models) |
| 價格與速率 | USD／百萬 tokens：Spark Standard input/cached/output＝1.25／0.15／4.25；Contributor＝0.10／0.002／0.20；Wonder＝4／0.20／20。Standard 表列 3000 RPM／4M TPM，Contributor 150 RPM／3M TPM，按 team 共用。不要把速率 header 當 billing 餘額。 | [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits) |
| 自訂工具 | host 執行 developer functions；目前 `tool_choice` 為 `auto`。須處理沒有工具的文字回覆。`max_tool_calls` 只限制 built-in tools，自訂 loop 仍由 host 計數；完整 arguments 才能驗證執行。 | [Tool calling](https://dev.meta.ai/docs/tool-calling) |
| Strict schema | root 為 plain object、object 封閉且 properties 全 required；不支援 oneOf／allOf，anyOf 僅 root 以下；深度上限10。strict 的 schema 檢查不能證明 ID、單位或科學語意正確。 | [Structured output](https://dev.meta.ai/docs/structured-output) |
| 協定 | 官方建議新 agent 使用 Responses；既有 Chat Completions 仍可沿用，其 reasoning 跨輪能力不同。沒有證據要求為新建議立即重寫目前 adapter。 | [Choosing an API](https://dev.meta.ai/docs/protocols) |
| 資料模式 | Standard 不用於訓練不等於完全不保存。Contributor 可用於訓練；ZDR 需 Meta 另行啟用，並有功能排除，本帳號未驗。 | [Data commitments](https://dev.meta.ai/legal/commitments)、[ZDR](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention) |

本地 `expandSchema` 只在 wire schema 省略 `uniqueItems`，仍保留原 AJV／domain 唯一性檢查；公開 structured-output 頁沒有給出此 keyword 的保證，不能宣稱原實測 400 已被官方全面修復。見 [provider](../../server/meta-provider.ts)、[對應負例](../../tests/ai-runtime/provider.test.ts)、[Sound 負例](../../tests/ai-runtime/sound-provider.test.ts)。

## 3. 現行資料流與信任邊界

```text
使用者目標＋當前受限 DTO
  → offline deterministic planner 或 Meta planner（server-only key）
  → 完整 JSON／封閉 schema／provenance 驗證
  → AgentHost 或 SoundProposalHost（當前 ID、revision、registry、budget）
  → 差異 preview＋digest＋expiry
  → 明示 Apply → scene／behavior 新 revision；Undo 另建 revision
  → 本機受限 Run／Capture／Analyze／Compare
  → immutable artifact＋hash＋method＋unit＋null availability
```

對照程式：[server/app.ts](../../server/app.ts)、[MetaProvider](../../server/meta-provider.ts)、[AgentSession](../../src/app/agent-session.ts)、[AgentHost](../../src/ai/host.ts)、[scene adapter](../../src/ai/scene-adapter.ts)、[Sound host](../../src/ai/sound-host.ts)、[ExperimentToolHost](../../src/app/experiment-tools.ts)。

模型沒有 shell、repository、任意 URL、修改 provider／預算或直接 Apply 工具。Node endpoint 也不能直接提交場景；server 對客戶端送入的 snapshot 只作規劃／preflight，本機 host 必須對當前真實狀態再驗證。這層不能被「server 已驗過」省略。

## 4. 共通政策：已實作與限制

| 代號／面向 | 實際行為 | 限制／後續建議（PROPOSED） |
| --- | --- | --- |
| H：HTTP／認證 | CLI 綁 `127.0.0.1:8787`；檢查 localhost／127.0.0.1 Host、Origin allowlist、JSON、256 KiB body、單一 active planner。不接受 request 的 model、key、billing 或 policy 欄位。 | 這是本機邊界，不是已驗證的多使用者登入、session isolation 或對外 rate limit。Origin 缺省仍允許本機 client；不可直接公開部署後稱 auth 完成。 |
| P：provider gate | 預設 network=false、model=null、budget=0；需 server 設定 key、verified metadata、費率來源、正預算≤US$1。status quota 永遠 null，liveValidation 為 NOT_RUN。 | verifiedAt 只驗日期可解析，未見自動時效或 catalog artifact hash 解析。維持未授權即阻擋；未來用明確有效期及模型／資料模式 capability record。 |
| B：費用／回合 | MetaProvider 最多12 planning turns（每turn含有界retry，不表示最多12次HTTP attempt）；每次 retry 前依 serialized bytes 保守 token 上界＋completion ceiling 累積 reserve，不退款；每 request 最多120秒、completion≤4000、input reserve≤32000。 | 常駐 provider reserve 在 memory；重啟不能視為保留歷次授權的 durable ceiling。歷史 live-validation CLI 的持久3-slot ledger 是另一條流程，不可混稱。實際 billing／餘額維持 UNKNOWN。 |
| T：timeout／重試 | 預設 transport20秒（可配置1–120秒），AbortController；不確認的傳輸結果不自動重送。429、500、503最多2次，Retry-After≤10秒且須在 request deadline內；401／403／明確quota不重試。 | 已有有界退避，官方另建議 jitter；本次不更動 transport。Apply／mutation 依 request ID 去重，不能把模型 retry 當成再提交許可。 |
| M：scene mutation | AJV封閉schema→scene/domain validator→1–32 requests共用transaction→ID／revision／registry→preview digest／最長5分鐘→Apply原子提交；48 tools、最多48 previews；Undo拒絕覆蓋後續編輯。 | CreateScene 會替換現有物件／sources，preview已警示且可Undo。名稱不能讓使用者以為另開獨立 project。 |
| S：Sound mutation | 五種 operation；scene＋behavior revisions、object generation、profile revision、資產 revision／hash／readiness／rights 再驗；32 operations、預設12 previews、5分鐘 TTL；Apply／Undo exact content。 | creative sample／oscillator不是真實振動或聲壓；Sound proposal獨立於原scene工具enum，不硬塞別名。 |
| E：實驗執行 | 最多6 runs／48 calls、同時1 simulation、每次120秒、trace32MiB／stored64MiB、每8步yield，取消待loop ack；request ID相同內容重送取同一Promise／結果。 | 目前本機隔離 Rapier＋Behavior＋幾何聲學，沒有建立音訊裝置；不是硬體聽測或Meta模型規劃完整loop的證據。 |
| G：數值 grounding | completed artifact可Capture；hash／run／metric record／method查核；unsupported值null，不能用0補缺值。 | 沒有完整IR時不提供RT60／EDT／T20／T30／DRR／C50／C80數字。AI解釋是解釋，不能成為metric producer。 |

本地證據：[HTTP負例](../../tests/ai-runtime/server.test.ts)、[Sound HTTP](../../tests/ai-runtime/sound-server.test.ts)、[provider gates／retry](../../tests/ai-runtime/provider.test.ts)、[scene交易](../../tests/ai-runtime/host.test.ts)、[Sound交易](../../tests/ai-runtime/sound-host.test.ts)、[實驗執行](../../tests/app/experiment-tools.test.ts)。

## 5. 逐工具能力對照

H/P/B/T 適用所有經 Meta endpoint 的提案；M/S/E 是 host 的額外限制。下表「無」代表本次查核在現行封閉工具／action union 未找到，不能推論所有未來能力都被禁止，也不自動構成凍結 V1 驗收失敗。工具名保持精確，沒有靜默 alias。

| 要求名稱 | 現行 schema／executor 狀態 | 認證／quota／timeout／retry／Undo | 手動 fallback／缺口 |
| --- | --- | --- | --- |
| CreateScene | 原scene schema及provider已列；adapter建立1–50m六面固定房間，必須獨立transaction，替換現有物件／sources，保留scene identity。 | H/P/B/T＋M；preview後Apply；Undo回復原snapshot並建立新revision。 | 使用現有場景／物件編輯。另開project與「重建房間」需文案區分。 |
| AddObject | 原schema＋scene command已接；box／sphere／capsule，registry材質，穩定object ID與真domain驗證。 | H/P/B/T＋M；AI scene最多16 sources；重送不重複commit；可Undo。 | Library新增與Inspector調整；測試見scene-integration。 |
| SetMaterial | 原schema＋adapter已接 acoustic／physics／both；檢查registry revision，物理係數與聲學ID分開套用。 | H/P/B/T＋M；新revision，舊結果應標stale；Undo受revision守衛。 | Inspector物理／聲學材質；不能以名稱猜Measured coefficients。 |
| SetRigidBodyMode | 原schema四mode；adapter目前只允許 `velocityPolicy:zero`，preserve／restoreSnapshot明確拒絕。 | H/P/B/T＋M；有限政策，不默默改寫；可Undo作者設定，不能倒轉已發生物理。 | Physics Inspector；NoGravity仍dynamic，Fixed不受力。 |
| CreateMotionAction | **無此工具名／schema**。近似原 `SetTrajectory` 有schema且被provider列出，但adapter明確CAPABILITY_UNSUPPORTED，尚未接版本化Motion Registry。 | 沒有可合法派送的CreateMotionAction；SetTrajectory經H/P/B/T仍在M拒絕，不產生半交易。 | 可用真實互動錄製／authoritative replay；不是通用motion authoring。建議先固定motion action契約、collision clearance與run trace，不能只新增UI表單。 |
| ConfigureSoundBehavior | **無此精確工具名**；現行 `ProposeSoundBehavior` 包五operation：CreateProfile／ReplaceProfile／DeleteProfile／AssignBinding／RemoveBinding，另有closed schema。 | H/P/B/T＋S；server preflight不Apply；本機再preview、Apply、Undo。 | Sound Inspector／Rule／Mapping／Binding override。單純 `ConfigureSoundSource` 是另一舊工具，不能假稱涵蓋全部Behavior。 |
| SetListener | scene domain command有此名稱；AI工具精確名稱是 `MoveListener`，要求相同listener ID、位置及quaternion，明示independent。 | H/P/B/T＋M；當前revision、可Undo；不改editor camera。 | Listener Inspector；FPS attachment／退出還原政策另經InteractionHost，不能靠別名暗改。 |
| StartRecording | **無AI工具schema**；UI `recordToggle` 接RecordingHost，與離線RunSimulation產出的recording不同入口。 | 不可由模型虛構派送。手動路徑遵循recording lifecycle／overload pause；停止／finalize不等於Undo。 | Event Timeline「開始／停止錄製」與匯出；若新增工具應用start/stop兩個明確命令，避免toggle重試反向操作。 |
| RunSimulation | 原schema＋ExperimentToolHost已接；custom-web明示alias／custom-web-geometric、1/60秒、反射階0或1，duration須整數tick；不支援值明確拒絕。 | H/P/B/T＋E；host回succeeded才算完成；可cancel至ack，不能Undo已完成run，保留immutable evidence。 | Transport互動run＋手動record；不是同一執行模式或裝置輸出證據。 |
| CaptureExperiment | 原schema＋executor已接；只能取可驗hash的完成recording，建立immutable experiment ID與引用。 | H/P/B/T＋E；request ID去重、容量守衛；無場景mutation，沒有作者Undo語意。 | UI A/B capture／錄製匯出；不要以「Capture」假稱有新量測。 |
| AnalyzeAcoustics | **無此精確名稱**；原 `AnalyzeAcousticResults` 已接。只從真recording算支援的directArrivalTimeS population mean；其餘IR依賴指標null＋原因。 | H/P/B/T＋E/G；missing／tampered artifact拒絕；不可由模型補數；分析不改scene，無Undo。 | Acoustic Dock／Paths／Comparison，保留來源與缺值。工具名稱映射需明示且測負例。 |
| CompareExperiments | 原schema＋executor已接；須兩個完成capture，現行工具限定acousticMaterial自變項，檢查同motion等條件，candidate−baseline保存在配對artifact。 | H/P/B/T＋E/G；不可比INCOMPATIBLE，method/population不合時delta null；無scene Undo。 | UI另有acoustic／behavior比較入口；不可由此推論AI工具已支援任意behavior A/B。 |
| CreateRenderJob | **無此工具／schema／job executor**。現有live audio、static preview、錄製JSON export都不是此能力。 | 沒有可合法派送入口、render budget或job ledger；不能把planner成功當render完成。 | 現行監聽／預覽及recording export；若要離線PCM／影片render，需先固定output format、scene/motion/listener pins、job state、容量及取消清理。 |

還有 `PreviewSceneChanges`：原12工具之一，現行read host支援可信staged candidate的碰撞查詢及Estimated成本artifact；沒有 `getPreviewScene` 時明確PREVIEW_REQUIRED。產品runtime初始化未提供此resolver；它也未列在provider的11個function tools。一般mutation的本地stage preview可用，不能據此宣稱這個獨立工具已完整可用。見[preview測試](../../tests/app/experiment-tools.test.ts)與[初始化](../../src/app/runtime.ts)。

## 6. 科學與數值保護

[ExperimentToolHost](../../src/app/experiment-tools.ts)明確把本機結果標為computed／V1。有限路徑與Synthetic late reverb不構成完整IR；現在僅可從實際order-0路徑得到明示population的平均幾何傳播延遲，不能標成「最早可聽onset」或房間量測RT60。真空／遮擋／缺band的缺值保留null。

[explainVerifiedMetrics](../../src/ai/grounding.ts)查trusted artifact resolver、run ID、hash及原metric record；刪除、篡改或偽造數字會拒絕。產品read結果的展示也保留unknown／pending／blocked與completed差異，失敗後不執行後續依賴工具。見[grounding regression](../../tests/ai-runtime/scene-integration.test.ts)、[session results](../../tests/ai-runtime/session-results.test.ts)。

建議下一切片只對**已有完成artifacts**生成引用式說明，逐句帶metricRecordId；沒有資料先提出下一個合法實驗，不輸出填補值。欲最佳化時只在已執行有效候選集合選擇，不能宣稱global optimum。

## 7. Live 證據與歷史的精確範圍

既有[最小live summary](../../research/v1/meta-live-validation-20261027-r3-minimal/summary.json)、[獨立review](../../research/v1/meta-live-validation-20261027-r3-minimal/independent-live-review.json)支持歷史真Meta Sound提案、RemoveBinding／AssignBinding、Host Apply及本機180ticks／181frames。它不支持現行完整scene planner loop、產品UI live、所有13項能力、當前帳單餘額或硬體聽感。

原授權見[META_API_VALIDATION_AUTH](../00-project/META_API_VALIDATION_AUTH_20261027.md)、[操作與限制](../../server/META_LIVE_VALIDATION.md)。持久ledger三個request slots已用盡；首次400原始body及全部中間code版本未完整封存。不能從後來離線fixture補寫歷史，或再用舊授權自動發新付費請求。本輪live測試為**NOT RUN**。

## 8. 競賽時限與合規風險

2026-10-29查核：[Meta活動頁](https://dev.meta.ai/events/global-hackathon)與[CV活動頁](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)作品截止仍是 **2026-11-04 21:00 ET＝2026-11-05 10:00台北（UTC 02:00）**；當日美東為UTC−05。申請截止10/25 23:59 ET是另一門檻，已過；頁首EST與正文ET的歷史措辭差異仍保留。

[Official Rules／waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver)文字web工具失敗，改以只讀瀏覽器渲染成功讀取，頁尾仍標October 25, 2026。規則要求使用Meta產品建置；OSS及第三方技術協助仍附權利條件。評分為Meta tooling25%、Impact30%、Technical20%、Demo25%；Indie最多4人。公開正文未見Codex明文允許／禁止、API獨占或最低呼叫量；「未載明」不是豁免。

[提交入口](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit)當前實際轉至登入。本人資格／入選、credit條款、登入後影片／repo欄位與最終提交確認仍**UNKNOWN**，不代替本人接受。Devpost精確名稱overview找不到、search回0，不能套別場Devpost規則。既有合規原始來源見[HACKATHON_RULES](../01-compliance/HACKATHON_RULES.md)與[PROJECT_PROVENANCE](../00-project/PROJECT_PROVENANCE.md)。

## 9. 建議優先序與驗收

| 優先／風險 | 建議（未採納／未實作） | 完成時必須新增的證據 |
| --- | --- | --- |
| P0／對外錯誤宣稱 | 凍結demo能力清單，標明exact tool names、已支援子集、offline／歷史live／NOT RUN；修目前狀態入口對歷史文件的導讀。 | schema↔provider advertised tools↔host capability逐項一致的正負例；不改原驗收。 |
| P0／時間與外部門檻 | 先由本人確認資格／入口／條款並安排現有能力demo；不得為截止自行擴大付費。 | 本人外部確認、可讀提交清單；fresh live如另獲授權才執行並保存實際wire/code/version evidence。 |
| P1／費用及部署 | 若未來對外服務：真正session auth、per-user quota、持久budget ledger、response model/pricing核對、provider verification expiry。 | process restart／多session／並發／auth bypass／model mismatch／unknown billing測試；本機預設仍0。 |
| P1／互動停止 | 將既有ExperimentToolHost cancel ack與ledger呈現在產品job UI；目前AI loading時cancel直接return，不能宣稱能中止所有已派工作業。 | 慢run、timeout、late reply、cancelRequested→ack、結果不套用的真流程。 |
| P2／新增工具 | MotionAction／StartRecording／RenderJob先寫獨立版本化契約及capability，再逐一接host；不因名稱相似偷偷alias。 | 原子apply、undo邊界、idempotency、resource bounds、artifact lineage與manual fallback。 |

本審查子任務實際使用Node22.17.0／npm11.4.2，執行 `node scripts/setup/emil-skills.mjs --check`（exit0、16來源檔全MATCH）與 `node scripts/setup/emil-skills.mjs --standards`（exit0、75 tokens／19 components、errors=[]）。這只是固定來源與設計規範靜態驗證，不驗AI執行或UI視覺。本子任務未重跑runtime／browser／Meta live／裝置／聽測；引用既有測試與歷史artifact不等於新PASS。官方研究與程式靜態審查已完成，沒有新增production code／schema或擴張完整V1結論。

