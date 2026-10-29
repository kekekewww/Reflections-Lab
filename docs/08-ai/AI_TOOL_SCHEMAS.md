# AI 工具契約

狀態：Draft 2020-12 JSON Schema 已提供；工具 executor 與 provider integration **尚未實作**。Phase J 原文列 **11** 個工具；本研究另外加入 `PreviewSceneChanges`，合計12個，明確屬於安全預覽擴充，並非原文第12項。Apply／Undo 為 trusted host 操作。

## 檔案與界線

| 檔案 | 驗證對象 |
| --- | --- |
| `schemas/ai-tool-request.schema.json` | 12種請求 envelope 及 `$defs/<ToolName>` 參數；mutations 的 transactionId 必非 null；執行／分析工具必 null。 |
| `schemas/ai-tool-result.schema.json` | host／solver 回傳狀態、artifact IDs、metrics、錯誤與使用量。 |
| `schemas/ai-scene-change-set.schema.json` | host 管理的交易紀錄與 preview／approval metadata。 |
| `schemas/ai-provider-config.schema.json` | 無 secret 的 provider gate、能力查核與費用／資源預算。 |

相對 `$ref` 只解析 repository 內上述檔案，驗證器不得任意網路下載 schema。所有物件禁止多餘欄位；數字的 NaN／Infinity 在 JSON parser 層拒絕。JSON Schema 的 `format` 需啟用 format checker；datetime 的時效另由 host 檢查。

## 操作清單

共通 envelope：`schemaVersion:"1.0.0"`、`requestId`、`sceneId`、`expectedSceneRevision`、`transactionId`、`tool`、`arguments`。requestId 由 host 發給受限 dispatcher，非通行證；同 scene／transaction 的 revision 與 ID 必須一致。除房間建立外，尺寸均為完整尺寸，詳細 domain 條件見 AI_SCENE_CONTROL。

| 工具 | 必填 arguments | 邊界與副作用 |
| --- | --- | --- |
| CreateScene | label, roomDimensionsM, surfaceMaterialId, seed | 新 scene；原點在房間地板中心，尺寸 `[X,Y,Z]`；6面固定表面，初始共用材質。只 stage，不能覆寫。 |
| AddObject | objectId, label, shape, dimensionsM, positionM, orientationQuaternion, materialId, mode, massKg | box／sphere／capsule；尺寸0.01–100m，質量0.001–10,000kg；stage。 |
| SetMaterial | objectId, materialId, materialRegistryRevision, scope | acoustic／physics／both；registry 欄位必存在，維持版本；stage。 |
| SetRigidBodyMode | objectId, mode, velocityPolicy | dynamicGravity／dynamicNoGravity／fixed／kinematic；zero／preserve／restoreSnapshot；stage。 |
| ConfigureSoundSource | sourceId, objectId, signalId, mode, gainDbfs, referenceFrequencyHz | continuous／impact；−80至−6dBFS、20–20,000Hz；不自動開聲；stage。 |
| MoveListener | listenerId, positionM, orientationQuaternion | 正式 listener；與 editor camera 分離；stage。 |
| SetTrajectory | objectId, interpolation, samples | linearSlerp／recordedTrace；2–64點、0–30秒；有序時間、非 fixed、來源trace驗證；stage。 |
| RunSimulation | backendId, durationS, timeStepS, seed, replayTraceId, maxReflectionOrder, sampleRateHz | 0.1–30秒、1/60或1/120步進、0–2階、44.1/48kHz；只執行受支援能力；回 run artifact。 |
| CaptureExperiment | runId, label | 僅完成的 run；保存 immutable snapshot／metadata 引用，不能自行寫數值。 |
| AnalyzeAcousticResults | runId, metrics, bandCentersHz | 最多8 metrics、6指定 bands；只分析實際 artifact，缺資料回 unavailable。 |
| CompareExperiments | baselineExperimentId, candidateExperimentId, metrics, requireMatchedMotionTrace | requireMatchedMotionTrace固定true；檢查 settings／method／motion可比性，輸出 computed deltas。 |
| PreviewSceneChanges | includeCollisionCheck, includeAcousticCostEstimate | 兩旗標固定true；host 寫 preview artifact 並提示能力缺口；不 commit。 |

default 沒有透過 JSON Schema 偷補；必要欄位皆需明示，nullable 欄位明確傳 null。shape、聲源頻率適用性、source 數目、signal 對應與合法材料係數仍由 domain validator 檢查。`referenceFrequencyHz` 對 broadband signals 是分析參考，不能宣稱訊號全部能量在此頻率。

## 與 SceneSpec 的轉換

工具參數是 command contract，不可直接 spread 寫入 `scene.schema.json`。`expectedSceneRevision` 是請求前置條件，對應 host 讀到的 `sceneRevision`；commit 才新增 revision。ID pattern、mode、geometry尺寸、quaternion與±200m座標已對齊根契約。

`materialId` 是工具端受控 preset ID；host 需解析為 SceneSpec 的 `physicsMaterialId`／`acousticMaterialId`，並由有版本 registry 取得 friction、restitution，依明確規則選 acousticRole。不存在可用 preset、缺一種scope或參數不支援即拒絕，不能只憑名稱猜測。`SetMaterial(scope:"both")` 同樣需可解析兩種資料；不得將 acoustic absorption 填入 friction。

CreateScene 的6個面與 listener ID 由 host 配置、在 staged context 回傳，模型下一回合只引用這些ID。球／牆等 label屬 editor metadata；`referenceFrequencyHz`屬signal／analysis metadata，當前SceneSpec無此欄位。host 必保存到對應版本化 metadata或回 CAPABILITY_UNSUPPORTED，不可悄悄丟棄。source初次設定的playing=false；listener attachment保持明示independent／fpsHead。這些轉換器目前尚未實作。

## Provider schema 與本地 schema

不能把整份 operation union 直接當成 Meta strict schema。[官方 Structured output](https://dev.meta.ai/docs/structured-output) 要求的 subset 不包含本地使用的 `oneOf`／`allOf`。adapter 要對每個 `$defs/<ToolName>` 解開非循環 refs，逐個輸出 plain-object tool parameters；所有屬性 required、每層 additionalProperties:false、null 用於確實可空欄位。本地完整 schema／domain／policy 照常再驗證。

provider 只收到工具參數與受限 context；scene／revision／transaction 等 host metadata 由可信 dispatcher 補入，模型不能改掉授權 scene。`strict:true` 的編譯成功、完整參數串流、拒絕／截斷處理必須實測；本次 `NOT RUN`。host 只在完整 function_call 且 JSON parse 完成後排程。[官方 Tool calling](https://dev.meta.ai/docs/tool-calling)

官方特別指出 function tool 的 `strict` 旗標目前只控制 server 對 parameters schema 的 strict-subset 檢查；它不能取代本地參數驗證，也不能當成工具參數必然有正確場景語意的保證。structured-output 的解碼約束與此旗標的用途應分開測試。

## 回傳、錯誤與使用量

`state` 為 queued／running／succeeded／failed／cancelRequested／canceled／timedOut／budgetExceeded。queued 與 running 只回進度 metadata，不能附最終 metrics；失敗的 partial solver artifact 可留存診斷，但不以完成數值顯示。cancelRequested 不代表程序已停止；收到 worker acknowledgement 才 canceled。只有 succeeded 能進 Capture／Analyze。

錯誤固定 `code, message, retryable, fieldPaths, retryAfterMs, detailsArtifactId`。不得原樣回傳 secrets、內部stack或不受信任HTML。常見碼：SCHEMA_INVALID、DOMAIN_INVALID、UNKNOWN_ID、REVISION_CONFLICT、POLICY_DENIED、PREVIEW_REQUIRED、APPROVAL_REQUIRED、PROVIDER_UNVERIFIED、MODEL_UNAVAILABLE、CAPABILITY_UNSUPPORTED、QUOTA_EXCEEDED、BUDGET_EXCEEDED、TIMEOUT、CANCELED、SOLVER_FAILED、INSUFFICIENT_DATA、INCOMPATIBLE_EXPERIMENTS、INTERNAL_ERROR。

只有 transient 429／連線錯誤可依政策重試最多2次；schema、policy、ID、revision錯誤不能盲重送。傳輸結果未知先用 requestId 查 host ledger；模擬與場景 mutation 不因 retry 重複執行。

usage 記錄 wallTimeMs、solverSteps、inputTokens、outputTokens、estimatedCostUsd、actualCostUsd；不知道 actual cost 或 provider token 使用量時為 null，不能寫0假裝測得。離線 fixtures 的雲端成本為0，且 metadata 必標示 fixture。

## 結果來源

metric record 必有 metricRecordId、metricId、band、value、unit、availability、provenance、evidenceArtifactId、runId、methodId、backendVersion、materialRevision、validationLevel、limitations。`availability != available` 時 value 必 null。time metrics 的單位為秒且不可負；DRR／C50／C80 用 `dB_ratio`，不混用 dBFS 或 dBSPL。

schema 限定數值 provenance 為 measured／computed／estimated；文字解釋另有固定 `ai_generated_explanation` 與引用 metricReferences。這防止誤標，但 JSON 內容本身不是身分驗證：只有 host 產生且 hash可核對的 artifacts 才能作證。metricRecordId、runId、evidenceArtifactId 的對應、單位可比性、V等級與 producer 來源仍由 host 檢查。

離線契約驗證由專案共用的 AJV 8.17.1 驗證流程負責：`npm run validate:schemas`，正負 fixture 由 `npm test` 的 `tests/integration/schemas.test.mjs` 執行。2026-10-26 實際結果：全部8份 repository schema 在 strict／strictTypes 模式編譯通過；AI的4份亦獨立編譯4/4 PASS。11組契約測試通過，涵蓋12工具正例、尺寸越界、額外欄位、錯誤 transactionId、unverified provider、離線網路／費用、insufficientDecay缺值、provenance及交易digest等負例。完整結果以 `docs/06-validation/` 與共用測試輸出為準。

這些都是離線契約層驗證；domain executor、真實聲學數值、provider contract與帳戶API仍 `NOT RUN`，不得由fixture通過推論已完成整合。
