# Phase 3 Harness 獨立審查

審查日期：2026-10-26。Reviewer：`/root/harness_review`；程序／協定複核：`/root/harness_review/process_review`。依 [Phase 3 原始需求](../00-project/PHASE3_REQUEST.md)、最新自動接手要求與[實作計畫](../superpowers/plans/2026-10-26-agent-harness.md)審查；reviewer 未修改實作、schema 或測試，只建立本報告。Git `HEAD` 實查仍不存在，revision 為 `null`，沒有宣稱 commit。

**判定：離線 Harness、目前 Codex 接手與獨立驗收的本次範圍可通過；沒有待修 P1／P2 發現。Live 自動接手仍未驗證，不能據此將完整 Phase 3 live gates 標 PASS。** 本次未執行付費模型、切換帳號、提高額度、push 或部署。

## 已修正並複核的問題

| 問題 | 等級 | 修正與複核 |
| --- | --- | --- |
| 不同 `control` 可同時保留同一 workspace | P1 | 改用 workspace 的 canonical writer lock；跨 control 重複認領遭拒絕。`.reflection-agent.lock` 禁止列入 writable contract，僅根層內部 lock 排除於內容 snapshot。 |
| 主程序 exit 0 後，detached 子程序仍可繼續寫入 | P1 | 已用本地一次性子程序重現。Live 路徑缺程序樹停止證據時，在驗收、重試或接手前 BLOCKED，保留 workspace reservation。`runProcess` 的正常退出仍只宣稱 direct process 停止。 |
| 敏感檔案以固定文字代替 hash，無法發現既有檔案改動 | P2 | 改存實際內容 hash；不存敏感內容。疑似 secret 的 allowed-file 內容不進 snapshot，並拒絕驗收／接手。這仍不構成完整 DLP。 |
| JSONL 形狀合法卻混入其他 workspace／session／run／command；真實 UUIDv7 session 被拒絕 | P2 | 真實 captured echo 的四種身分竄改均回報 `MUSE_PROVENANCE_MISMATCH`，不採納 usage；原始 echo 與實際 UUIDv7 通過。 |
| 實際 verification／repair 與 schema 不一致；export 無法直接作 Wiki projection | P2 | 新增真正產物的 schema 驗證。Bridge 讀取實際 export／state、核實 hash 與 repo/control 邊界，固定 immutable state copy，再經 owner-authenticated Wiki CLI 更新；不自動完成宏觀 task。 |
| Handoff 只核對 handoff hash，未拒絕 checkpoint 或 partial edits 變動 | P2 | Acknowledge 同時驗 checkpoint bytes/hash 與目前 workspace；舊 handoff 不得用來略過未審查修改。 |
| 完成後修改 candidate，`verify` 仍回傳舊 COMPLETED；terminal checkpoint／handoff 可改寫驗證邊界 | P2 | reviewer 實際重現 `verify` 快取缺口；現由 run／verify／export 共用 acceptance、verification、checkpoint、workspace 完整性檢查。完成後 checkpoint 僅可驗證且 no-op；COMPLETED／BLOCKED 不可轉成 handoff。Terminal API 額外缺口由實作端自審提出，已獨立重跑 regression。 |

## 實際驗證

以下結果均讀取實際 stdout 與 exit code；測試數不可相加當作不重複測試總數。

| 執行 | 結果 |
| --- | --- |
| `node --test tests/agents/harness.test.mjs tests/agents/artifacts.test.mjs tests/wiki/agent-projection.test.mjs` | 20／20 PASS，exit 0；在最後兩項窄修正前執行。涵蓋故障接手、partial edit、原驗收、repair、恢復邊界、product quota 隔離與真正的 Wiki bridge。 |
| `node --test --test-name-pattern='completed cache\|handoff ack\|two control roots\|secret-bearing\|reserved\|path aliases' tests/agents/harness.test.mjs tests/agents/contract.test.mjs` | 6／6 PASS，exit 0；複核共享 completed guard、stale handoff、互斥與 secret snapshot。 |
| `node --test --test-name-pattern='executor cannot claim' tests/agents/harness.test.mjs` | 1／1 PASS，exit 0；拒絕內部 lock 成為 writable file。 |
| `node --test --test-name-pattern='completed cache' tests/agents/harness.test.mjs` | 最後 terminal guard 修正後 1／1 PASS，exit 0；含 run／verify／export／checkpoint／handoff。 |
| 程序複核者執行 `node --test tests/agents/process-runner.test.mjs` | 15／15 PASS，exit 0；另以 captured echo 驗證四種 provenance mismatch 與 UUIDv7。後續實作端完整 gate 仍應覆蓋最終版本。 |
| Reviewer 額外無推論 probe | Mock-only Muse exhausted observation 不影響 `runner=muse`；回傳 `COST_BUDGET_EXHAUSTED`、`LIVE_NOT_RUN`、model calls 0。完成後 candidate 變動的舊缺口先重現，再由 regression 拒絕。 |

本報告未代替 root 的完整 `npm run check`／`npm run validate:all`。原 core／physics／Wiki／design 回歸與所有最終命令，以本階段 raw gate report 為準。

## 規格符合範圍與限制

- 正常 Muse→獨立 verifier，以及 Muse 不可用→同一 Task／Milestone／goal reference→目前 Codex 實作→固定驗收的控制流程，有 mock subprocess 與實際本地 Codex handoff API 證據。Mock executor 不代表真正 Muse／Codex 模型實作。
- Partial content、untracked／無 HEAD 狀態、驗收 hash、完成 criteria 與 remaining work 可追溯。工作區、operation 與 milestone 互斥為合作協定；同 OS 權限的任意惡意程序仍可破壞控制資料。
- 401／403／402／429／明確 quota／未知錯誤分開；重試、repair、輸出與 elapsed budget 有界，未知 usage 保持 `null`。Mock／live resource registry 分開；產品 Meta API 狀態不冒充開發額度。
- Live Muse code edit、實際 subscription quota-stop／恢復、retained session resume／export、任意後代程序 containment、非零付費 ceiling 與產品 Meta API integration：**NOT RUN／BLOCKED**。目前沒有可驗證 OS containment，因此不得聲稱 live 自動 failover 已可安全運作。
- CLI echo 證明本機 transport／envelope profile；不證明模型品質、prompt strategy 優劣、模型成本或正式產品功能。Browser、音訊、實際物理／聲學產品驗收不在本次 Harness 審查範圍。
- Workspace snapshot 有明確檔案數與容量上限，含 `node_modules` 的 workspace 會拒絕；大型正式 checkout 仍需後續 adapter／隔離方案，不能以本次小 fixture 推論完整產品開發工作區已驗證。

## 最後審查範圍 hash

以下為最後窄修正後讀取的 SHA-256；不代表 Git commit，也不取代最終 gate 的來源 manifest。

| 檔案 | SHA-256 |
| --- | --- |
| `scripts/agents/engine.mjs` | `8236d1891c81d7f37f612f18567f0a71180d16ca7f401d145f7e73d1e3b2a588` |
| `scripts/agents/store.mjs` | `e0e608c50023976cae3b508357923b1ac14dfe4fd04676eb9d223d96ed788f28` |
| `scripts/agents/process-runner.mjs` | `fd54362f1093632050f4125f7b542296aab8651b404cc8ee3256c2dc87419109` |
| `scripts/agents/contract.mjs` | `dc12b921d009b05a4bbeb1c2741a11437bcb8a7b30f2431ab56f9c3c09202911` |
| `scripts/wiki/agent-projection.mjs` | `4c929a504565968f6a95a17d1f87509cb52b20cb0160ba081c9789f9803a7e20` |

## 最後補充審查：Context、取消與使用者確認零 Muse 額度

本次僅審查前次報告後新增的 `context-pack.mjs`、取消協定／signal 傳遞及零 Muse 額度的預先接手。套用 project `codex-verification`／`agent-orchestration` Skills，未重跑完整套件；使用者已確認無 Muse 額度，因此沒有啟動 Muse 或任何模型呼叫。**新增範圍未發現待修 P1／P2。**

- Context pack 只讀明確選取的 repo 文字，canonical AGENTS 僅一次；參考資料不提升成操作規範。每檔預設 64 KiB、總量 256 KiB，超限拒絕而不截斷；hash、UTF-8、binary、secret、symlink 與來源路徑檢查已讀查。`node --test tests/agents/context-pack.test.mjs` **8／8 PASS，exit 0**，本機 symlink 測試亦實際通過。
- `run`／`resume`／`verify`／`milestone` 傳遞 AbortSignal；CLI 在 JS 收到 SIGINT／SIGTERM 時請求取消，另一 CLI 可透過 request file 及 50 ms 輪詢取消。程序複核者僅執行 `node --test --test-name-pattern="second CLI cooperatively cancels" tests/agents/cli.test.mjs`，**1／1 PASS，exit 0**：mock child 實際執行後停止、partial edit 保留、狀態 `BLOCKED/CANCELLED`、attempts 1、無 fallback，writer reservation 保留。Active verifier／milestone 的取消與 OS signal delivery 本輪未另實測；hard kill 不能保證 checkpoint，live tree proof 限制維持。
- `node --test --test-name-pattern='confirmed live subscription exhaustion' tests/agents/harness.test.mjs` **1／1 PASS，exit 0**，確認已知 Muse exhausted 在 CLI 啟動前路由至目前 Codex。
- 實際[使用者零額度 export](../../artifacts/phase3-user-zero-muse/export.json)已逐項讀查：`QUOTA_EXHAUSTED`→目前 Codex，原 run／goal／milestone 保留，attempts **0**，`LIVE_NOT_RUN`，模型／CLI 版本維持 `null`；固定 independent acceptance 為 PASS。重新以 `readStatus` 檢查目前 acceptance／checkpoint／candidate／evidence，回傳 `UNCHANGED_CHECKPOINT_AND_EVIDENCE`。Task0008 的真實 Wiki projection run ID、immutable state hash 與 verifier hashes 相符；宏觀 task 當時仍為 `IN_PROGRESS`。

Context 的後續限制：自動 startup context 包含 schema／index／now／相關 task，**不會自動展開最新 handoff 或整份 Wiki**。下一個正式任務在安全邊界建立 contract 時，Orchestrator 必須將適用的最新 handoff 明確列入 `relevant_files`；不能宣稱目前 pack 已自動完成 AGENTS 所要求的全部來源選擇。Regex secret 檢查仍非完整 DLP，64／256 KiB 是目前呼叫使用的預算。

Reviewer 另讀取 root 的[最終 raw gate](../../benchmarks/results/phase3-validation-20261026-final.json)：狀態 PASS、19 項均 exit 0；agents 75／75、prompts 12／12、Wiki 53 PASS／1 SKIP。這是讀查 root 執行的完整證據，並非 reviewer 再次執行完整套件，也不改變任何 live gate 的未驗證狀態。

下列 hash 對應本次補充審查版本，取代上表中同名檔案的先前範圍 hash：

| 檔案 | SHA-256 |
| --- | --- |
| `scripts/agents/context-pack.mjs` | `316686fed91dd35875662c9ec362dc8ea4ed8f94802522b7b68cde1a1086f133` |
| `scripts/agents/cancellation.mjs` | `ef770d750f1541c93b890c44411d7aa61cf80bd5a5c788f11246f52e0b02db3c` |
| `scripts/agents/engine.mjs` | `9d809b08e02247216cc1a62c3bd725e3f05bdf2b7e8446b917070933b0370ae8` |
| `scripts/agents/cli.mjs` | `d8152433bf5d49b1ce1f6af4ca4ec86f6a8569ad5ee461acfbc8617d6bd5343c` |
| `scripts/agents/milestone.mjs` | `3b9fe3ae9804af918470f0e8bf609dfdfac2356c2398a37e89b02c5582aa904d` |
