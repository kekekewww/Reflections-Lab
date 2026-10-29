# Phase3 Harness 與 Failover 交付報告

2026-10-26 查核／實作，2026-10-27 結案（Asia/Taipei）。**離線 Harness 與目前 Codex 接手已實作及驗證；完整 Live Muse failover 仍有 BLOCKED 項。** 正式 Reflection Lab 產品未啟動。

## 已有直接證據

- Muse 1.4.13／Codex 0.163.0 版本與 help 已核實；Muse 真正 echo subprocess 15 JSONL events，無模型推論。
- Muse usage 查詢實際 transient failure；subscription remaining=UNKNOWN。已核實 usage／MSP schema，raw exec quota-stop shape 未有 live 證據，不能硬套。
- 隨後使用者明確確認目前沒有任何Muse額度，狀態記 USER_CONFIRMED exhausted。真正非Mock資源路由 [user-zero run](../../artifacts/phase3-user-zero-muse/export.json) 在任何Muse啟動前交接，attempts=0；目前Codex實際完成fixture、原獨立驗收PASS，已回寫Wiki。這不是實際Muse quota terminal事件的證據。
- 固定驗收、細部 Run State、workspace lock、內容／Git snapshots、有界 backoff／repair、current Codex adapter、Milestone resume、Wiki projection 已實作。
- 修正後 [Mock demo](../../artifacts/phase3-demo-confirmation-20261026/report.json) 8 個代表情境 PASS；完整12種需求由 agent tests 涵蓋。第一輪 [失敗 demo](../../artifacts/phase3-demo-20261026/report.json) 保留，不能以新結果抹掉。
- [真正現有 Codex 接手](../../artifacts/phase3-current-codex/proof.json)：Mock Muse partial edit + quota → HANDOFF_PENDING → 審閱並 acknowledge → 本 chat 實際追加 `answer=preserved+2` → 原獨立 acceptance PASS。保留原 `preserved=40`、同 task／milestone／goal、驗收 hash；已用 CLI 固定 state 並更新 Wiki Task0008 projection。沒有另啟動 Codex 模型。
- [Milestone](../../artifacts/phase3-milestone-result.json) 與 [再次 resume](../../artifacts/phase3-milestone-resume-result.json) 沿用同一 run，未重做完成實作。
- 8 coding／handoff templates、3 runtime templates、5 skills、4類×2策略的離線評測；模型品質／token／成本留 null。
- [獨立 code review](INDEPENDENT_REVIEW.md) 已重現並複核主要安全缺陷；原驗收沒有刪除或放寬。

## Live 限制

實際 Muse 模型實作、帳戶 quota stop／恢復、付費 Meta API、SDK runtime 及產品 Meta live tests **NOT RUN**。金額預算0、未知額度不是可自動使用的 credits。

Windows 普通 child close 不能證明所有後代已停止，因此 live Muse 執行後沒有 process-tree containment 證據時 **BLOCKED**，不自動開始另一 writer。Mock 無後代程序、以及啟動前發現不允許／不可用而未建立 writer 的 fallback 已可驗證。這是尚未啟用完整 Live failover 的實質限制，不能稱「已完成 live 自動切換」。

產品 Meta API integration 保留在既有契約與新 runtime spec；它仍是正式產品待辦，Mock／Codex 輸出不能替代 Meta live 證據。Browser／UI／physics／audio E2E、遠端 CI、實際競賽資格仍未驗。

## 操作入口

[操作流程與兩個實際範例](CODEX_MUSE_ORCHESTRATION.md)、[額度研究](QUOTA_RESEARCH.md)、[Failover 政策](FAILOVER_POLICY.md)、[Headless 證據](HEADLESS_EXECUTION.md)、[下一產品契約](../../examples/agents/p0-01-scene-contract.json)。

```powershell
node scripts/agents/cli.mjs help
node scripts/agents/cli.mjs probe
npm run test:agents
npm run test:prompts
node scripts/agents/cli.mjs demo --output artifacts/new-failover-demo
npm run validate:all
```

新 artifact 路徑需未存在。完整 gate 不覆寫舊 Phase1／2 證據；實測、Gates 與限制如下。

## 完整驗證結果

[原始19命令結果](../../benchmarks/results/phase3-validation-20261026-final.json) **19/19 exit0**，保留每個 stdout／stderr／exit／duration；[機器摘要與46個來源hash](VALIDATION_SUMMARY.json)供接手核對。

| 範圍 | 實際結果 |
| --- | --- |
| Agent Harness | **75 PASS / 0 SKIP / 0 FAIL**，真實 Node mock subprocess、獨立 acceptance、CLI cancellation／Milestone／scope／schema／resource guards |
| Prompts／評測工具 | **12/12 PASS**；4類×2策略、19項獨立checks、4負向controls。沒有模型生成，成效／tokens／成本未知 |
| 原 core＋整合 | **32/32 PASS**，含新 recursive agent schema gate／不可覆寫舊證據檢查 |
| Wiki | **53 PASS / 1 SKIP / 0 FAIL**；Windows junction fixture 未執行；actual Harness export→immutable snapshot→真實WikiCLI更新已驗 |
| 設計規範 | **14/14 PASS**；canonical75tokens／19components未改，無browser視覺通過宣稱 |
| Rapier／datasets | **6/6 PASS**基本WASM smoke；datasets **17 PASS / 1 SKIP**，無真實資料下載 |
| Schemas／工具 | 17 schemas compile、typecheck／lint／format／links／research metadata／Emil pinned bytes均PASS |
| Skills | 新5個Muse validate與官方Codex格式各5/5；另實跑全15個自有Skills官方格式PASS，8個Emil以固定bytes分開驗證。Muse discovery看到23個projectskills，新5個無diagnostics |

第一輪 demo 的 FAIL 與錯誤 exit0 診斷保留在 Git，後續修正跨情境資源污染及CLI failure exit。獨立審查另重現並修正跨control workspace lock、子程序存活誤判、JSONL身分混用、產物schema不一致、stale handoff／completed cache、terminal操作邊界等。沒有用刪除或放寬原驗收來解決。

## Failover 已實際可用的觸發與接手

1. 確認 Muse exhausted／unavailable 或原資源預算不足，**啟動前**先保存同 task／goal／milestone 並建立 handoff；本次使用者確認0額度的真實路由 attempts=0。
2. 已啟動的 mock process 以正式fixture error分類，暫時429有限backoff，明確quota轉交接；保存partial內容、Git diff／untracked preimages、驗收hash、logs與events。
3. 現有Codex讀handoff並 `acknowledge`，進入 RUNNING_CODEX，完成剩餘 scope，再 `verify`。Implementation report／exit0不能決定COMPLETED。
4. 失敗建立RepairTask，最多3輪且受attempt／time／output上限；雙executor不可用或不安全時BLOCKED。Muse恢復只在已完成task／安全邊界切回，既有Codex工作不被中斷。
5. `cancel --run`、SIGINT／SIGTERM、AbortSignal已接線；實測第二CLI要求取消，直接child停止、partial保存、checkpoint完成、不啟動fallback。強制kill／live後代程序仍不能保證安全。

額度來源的已驗能力為：安裝版本usage／MSP schema、實際唯讀查詢失敗、使用者確認資源狀態、Mock錯誤分類與run.usage解析。**真正raw CLI quota-stop尚未重現**，不套用MSP `TurnError.quota`猜測。402 billing可能是付款設定，不一律等於credits耗盡；401／403不重試猜key，429與5xx依有界政策處理。沒有調高費用或換帳號。

Context pack包含AGENTS、Wiki startup、task及明確選取refs，64KiB/file、256KiB總量；下一個Task必須把**最新scoped handoff明列 relevant_files**，工具不自動爬完整Wiki。Workspace snapshot不支援含node_modules的大型checkout；正式build/worktree擴充仍需驗證。

## Gates A–I

| Gate | 狀態 | 證據／界線 |
| --- | --- | --- |
| A Research | PASS | 官方原文、版本/help、來源metadata；未知帳戶能力明示 |
| B Headless | PARTIAL | 真Muse echo與Mock PASS；Muse真模型修改因0額度BLOCKED |
| C Task Contract | PARTIAL | Schema、Mock交換、實際Codex接手PASS；真Muse ImplementationResult NOT RUN |
| D Independent Verification | PASS | 固定獨立Node驗收＋實際Codexfixture＋隔離review；非產品E2E |
| E Repair Loop | PASS | 原驗收失敗→RepairTask→有限重試，保留FAIL/PASS artifacts |
| F Repository Safety | PARTIAL | 合作鎖／paths／secrets／Git保存PASS；live程序樹／非零費用ceiling未驗 |
| G Runtime AI | PASS（契約基礎） | 原12工具、prompts、離線正負例；產品provider／host仍未實作 |
| H Long-term Memory | PASS | 來源／Task投影、checkpoint／handoff與Now已同步，歷史原始證據保留 |
| I Cross-Agent Handoff | PASS（本地恢復） | 無前情Agent實際讀取Wiki、核實state／驗收與completed resume no-op；未派送Muse模型 |

[新Agent接收證據](../../artifacts/phase3-fresh-handoff-receipt.json)獨立核對同一run／goal／milestone、state／contract／acceptance／verifier／checkpoint hashes；完成後resume仍revision11、attempts0、無新event。接收時報告scope仍在結案更新的差異也保留，沒有抹去歷史handoff。Git初始快照之後的結案修改另由後續commit保存。

## Git 與下一步

本repo原先無HEAD；已建立本機分支 `codex/phase3-agent-failover` 與初始快照 **038d83d**，同時保存原有Phase1／2與本次Harness，沒有push。先前run的null revision是當時真實狀態，沒有回填假commit。[Git bytes檢查](../../artifacts/phase3-git-byte-check.json)確認996檔與index一致；`.gitattributes`關閉隱式換行轉換，避免checkout破壞固定SHA256。最終交接後另有本機紀錄commit，以實際`git log`為準。

本chat `get_goal` 觀察為null，沒有既有Goal可恢復，也沒有代使用者建立新Goal。Runner保留相同goal_id／milestone_id；它不直接控制目前產品Session的`/goal`。

Task0008只結案本次可完成的工程與驗證；[Task0009](../../knowledge/tasks/RLAB-TASK-0009.json)保留Live模型／安全程序隔離BLOCKED。使用者目前Muse無額度，Active=Codex，停止Muse模型派送；產品Meta API保持獨立UNKNOWN／NOT RUN。Task0006仍BACKLOG，下個正式P0-01契約已準備，當次授權後再開始，不重做研究。

完整檔案清單：[PHASE3_FILE_MANIFEST](../00-project/PHASE3_FILE_MANIFEST.md)。
