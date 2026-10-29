# Phase 3：產品 Meta Agent 與開發代理的界線

狀態：`DESIGN_READY / PRODUCT_IMPLEMENTATION_PENDING`。本階段完成開發 Harness、提示詞與離線契約／評測基礎，沒有建立正式 scene executor、產品 Meta provider 或 live Agent Loop。既有 [AI 實驗 Agent](AI_EXPERIMENT_AGENT.md)、[工具契約](AI_TOOL_SCHEMAS.md)、[場景交易](AI_SCENE_CONTROL.md) 與根目錄 `schemas/ai-*.schema.json` 保持產品 runtime 權威。

## 三個角色與兩個資源帳

| 角色／資源 | 使用方式 | 故障後的行為 |
| --- | --- | --- |
| Codex Orchestrator | 管理 goal／milestone／task、凍結驗收、派送與恢復 | 可在 Muse 不可用時接手剩餘實作；驗收仍由獨立程序執行。 |
| Muse Code 開發 executor | 依 Task Contract 在受限工作區修改程式 | Subscription／development quota耗盡時保存成果並移交 Codex；不改產品 provider。 |
| Meta Model API 產品 agent | 呼叫受控 scene／experiment tools，解釋真實 artifacts | Credit／quota不足停 live分支；保留 provider integration，離線 fixtures另標來源。 |
| Development budget | 模型步數、wall time、retry／repair次數、付費上限與usage | 不代替 provider billing資訊；未知剩餘額度為 null，不提高上限或換帳號。 |
| Product runtime budget | 工具／simulation／token／費用上限與provider gate | 不因coding executor改為Codex而改成Codex API；live證據另驗。 |

正常流程為 Codex 調度 → Muse 實作 → 獨立測試與 Codex 驗證。Fallback 為 Codex 調度 → 現有 Codex 接手實作 → 凍結 acceptance 的獨立程序；可用時再加隔離 review。兩者都不構成產品內 Meta API 已整合的證據。

## Runtime 契約與提示詞

產品仍使用既有12個 tool contracts：CreateScene、AddObject、SetMaterial、SetRigidBodyMode、ConfigureSoundSource、MoveListener、SetTrajectory、RunSimulation、CaptureExperiment、AnalyzeAcousticResults、CompareExperiments、PreviewSceneChanges。模型只收到各工具 parameters；host補入 scene／revision／transaction envelope，不直接將本地 union schema 當成 provider strict schema。

新的 [scene planner](../../prompts/runtime/scene-planner.md)、[experiment agent](../../prompts/runtime/experiment-agent.md) 與 [acoustic analysis](../../prompts/runtime/acoustic-analysis.md) 提示詞共用既有host邊界：不給shell、repository、任意URL、私人檔案或預算設定；所有變更先stage、schema/domain/policy驗證與preview，再由host授權Apply。Strict JSON形狀不能證明ID、單位、材料數值或科學主張正確。

開發 Prompt Renderer 是模板工具，不是安全sandbox或產品provider。它只允許固定模板名與4種JSON輸入，拒絕未提供參數與過大payload；task資料不做第二次token展開。Host policy／workspace scope／protected acceptance仍需由Harness執行。

Muse CLI、Meta API 與 Spark Open／第三方推論的model ID、reasoning、成本及使用權不同，不能互抄。當次查核以 [模型研究](../09-agents/MUSE_MODEL_RESEARCH.md)、[routing](../09-agents/MODEL_ROUTING.md) 與官方來源為準。提示詞沒有硬編碼最新model ID；選型由已確認的host配置決定。

## Runtime quota耗盡時

1. Provider adapter保留實際錯誤類型、request/run IDs與可得usage，刪除secrets；不把401／403誤記為credit耗盡，也不將每個429當確定quota。
2. 暫時429只按既定上限重試；結果未知的mutation先查host ledger，不能因重送產生重複場景變更。產品budget仍受既有provider config約束。
3. Quota／credit無法在授權預算內恢復時，live測試標BLOCKED／NOT RUN，保存已完成artifact。Codex可以繼續一般工程、Mock Model與Recorded Tool Responses離線測試。
4. Fixture與recorded responses保留`offlineFixture`／Synthetic Fixture來源，model ID或live request ID不杜撰。模型解釋不能變成Measured record；缺資料為null，不能填0。
5. Demo若需要即時Meta agent，提交前必須用真實Meta provider重新驗證授權、模型、工具回傳與連線。本階段沒有該live證據。

## 驗證面與完成限制

| 驗證面 | 可重現命令／依據 | 本階段可宣稱範圍 |
| --- | --- | --- |
| Runtime JSON契約 | `npm test`、`npm run validate:schemas` | 現有schema正負例與provider gate；不是正式host執行。 |
| Prompt Renderer | `node --test prompts/render.test.mjs` | 固定模板、JSON參數、path／payloadguard與單次展開。 |
| Coding prompt評測基礎 | `node --test benchmarks/muse/evaluate.test.mjs`、`node benchmarks/muse/evaluate.mjs` | 4類fixture ×2策略的離線reference／壞案例驗證；沒有呼叫模型，不比較模型優劣。 |
| Meta provider catalog／function calls／strict decode／quota | 需真實帳號與明確預算 | `NOT RUN`。官方文件查核不是live integration。 |
| Scene executor／Apply／Undo／cancel／grounding | 後續產品實作與E2E | `NOT RUN`。本階段只保留契約與測試需求。 |
| 聲學／physics／audio／browser | 各domain驗收與V等級 | 不由LLM或prompt fixture結果推論。 |

下一個產品AI切片仍是OfflineFixtureProvider搭配一個AddObject → Preview → Apply → Undo host交易及run ledger。完成domain驗證後才接入受gate控制的Meta provider；本階段不提前宣稱已完成該功能。
