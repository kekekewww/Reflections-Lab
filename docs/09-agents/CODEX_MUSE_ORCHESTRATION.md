# Codex × Muse 開發操作

> **2026-10-27現行政策：Codex主導，Muse Code僅選用。** 見 [ADR-013](../02-architecture/adr/013-codex-primary-development.md)。以下Muse優先流程保留為Optional Harness／Phase3歷史profile，不是正常開發前置，恢復額度也不使專案自動切回。

共同 startup 為 AGENTS → knowledge/schema → index → now → 相關 task／最新 handoff。工作唯一權威仍是 Wiki task；runner 的細部狀態由 [Task schema](../../schemas/agents/task.schema.json) 與 [Failover policy](FAILOVER_POLICY.md) 管理。實際命令可查 `node scripts/agents/cli.mjs help`；PowerShell 傳 CLI flags 優先直接 `node`，避免本機 npm wrapper 吞旗標。

## 啟動與恢復

先確認隔離 workspace，不能把 repository 根當 implementation workspace。已有 HEAD 時可由 host 準備 Git worktree；本階段原始 checkout 無 HEAD，範例使用獨立 fixture 目錄，不自動建立或清除 worktree。

```powershell
node scripts/agents/cli.mjs init --contract examples/agents/smoke-task.json --workspace .cache/example-agent-workspace --control artifacts/example-agent-control --plan examples/agents/mock-plan.json
```

讀取回傳 `run_id`，保存為 `$runId`，再執行：

```powershell
node scripts/agents/cli.mjs run --run $runId --control artifacts/example-agent-control --runner mock
node scripts/agents/cli.mjs status --run $runId --control artifacts/example-agent-control
node scripts/agents/cli.mjs resume --run $runId --control artifacts/example-agent-control --runner mock
```

同一 run 的 resume 延續 contract／goal／milestone、checkpoints 與 attempts，不重新 init 已完成工作。BLOCKED 不代表可以自動重開：只能按明確資源恢復政策、原預算與內容完整性條件處理；scope／驗收／process safety 的 blocker 要先診斷。

獨立程序可要求取消目前 run：

```powershell
node scripts/agents/cli.mjs cancel --run $runId --control artifacts/example-agent-control --reason "operator cancellation"
```

CLI 以有界 polling 傳遞 AbortSignal，停止直接 child、保存 checkpoint，標記 CANCELLED／BLOCKED，不開始 fallback。SIGINT／SIGTERM 也走此流程；OS 強制 kill 仍可能留下 lock 與子程序，必須人工確認，不能自動偷鎖。執行命令 COMPLETED exit0、HANDOFF_PENDING exit2、FAIL／BLOCKED exit1；`status` 診斷本身成功則 exit0。

## Codex 接手

Muse quota／不可用／原預算不足時，runner 保存內容與 Git diff、handoff 和剩餘工作，回 HANDOFF_PENDING。由現有 Codex 讀取 handoff JSON、partial edits 與 acceptance hashes，確認無 writer，再用該筆 handoff 的真實 SHA256 指派：

```powershell
node scripts/agents/cli.mjs acknowledge --run $runId --control artifacts/example-agent-control --handoff-hash $handoffHash
```

此命令只進入 RUNNING_CODEX，不會啟動模型、不會遞迴呼叫目前 Session，也不宣告完成。Codex 在原 allowed files 完成剩餘修改後，另行驗收：

```powershell
node scripts/agents/cli.mjs verify --run $runId --control artifacts/example-agent-control
```

失敗建立 RepairTask 並保留原 tests；有限修復後仍失敗或資源不足會 BLOCKED。成功才 COMPLETED。已完成 run 若內容改變，不能沿用舊 PASS。原 Goal 不因 executor 改變而重建；跨 chat 不能只靠 `goal_id` 宣稱產品 `/goal` 已恢復。

## 接回 Wiki

先把實際 export 固定至新檔，再將 mutable run state 複製為 immutable evidence；`agent-projection` 檢查 hash、映射 repository-relative paths，產生 owner-authenticated Wiki CLI 可接受的 patch：

```powershell
node scripts/agents/cli.mjs export-wiki --run $runId --control artifacts/example-agent-control --output artifacts/example-export.json
node scripts/wiki/agent-projection.mjs --input artifacts/example-export.json --control artifacts/example-agent-control --output artifacts/example-wiki-patch.json
```

最後依 [Wiki 操作](../09-knowledge/WIKI_OPERATIONS.md) 使用既有 task owner token 執行 `task update --file artifacts/example-wiki-patch.json`。工具不會替 task criteria 判真，也不會只因 run COMPLETED 就自動把 Wiki task DONE；要讀完整驗證輸出與 scope，再 ingest 綜合頁、checkpoint／handoff。每次 snapshot 選新檔，拒絕覆寫。

## Task Contract 正規化

| 需求名稱 | 實際機器欄位／權威 |
| --- | --- |
| Task ID | `id`；`wiki_task_id` 關聯既有 task |
| title／scope／out_of_scope／refs／permissions／deliverables | 同名描述欄位，型別與範圍驗證；writable scope 實際由 `allowed_files` 強制 |
| acceptance_criteria／verification_commands | 唯一 `acceptance[{id,script,args}]`，Node 獨立程序執行，避免兩份條件分歧 |
| model／reasoning | `muse.model`／`muse.reasoning_effort`，必須依已核實安裝版本／官方 model capability |
| max_model_steps | `policy.development.max_model_steps` |
| max_repair_rounds | `policy.max_repairs`，最高3；總 attempts／時間也有限 |
| resource_budget | `policy.development`、`policy.product_runtime` 與 timeout／output 等政策 |
| task_status | Run State 的 `status`，不能由輸入 contract 自稱 COMPLETED |

額度與模型未知欄位留 null。Schema 驗證形狀與一部分 domain 限制，不保證自然語言 scope／權限完整；Orchestrator 仍需審查 refs、protected helpers、acceptance script 本身與授權。

實際 Muse prompt 會加入有界 context pack：AGENTS、Wiki startup、對應 task 與選取 refs；單檔64KiB、總量256KiB，拒絕缺失／binary／secret／symlink。只在已允許開始模型工作後建立，不因預算／quota停止而送出內容。Workspace snapshot另有限額，不支援內含node_modules的工作區；這是當前Harness的可用範圍，正式大專案worktree與build pipeline需另擴充／驗證。

## Example A — 有限 Codex Goal／Milestone

在支援 Goals 的 Codex chat，Goal 應只包含一個 milestone、有限預算與原驗收；本階段不為產品 Roadmap 建巨型 Goal。現有 chat 可執行下列真實有限 runner，主要 executor 在 Mock 中標 MUSE：

```powershell
node scripts/agents/cli.mjs milestone --manifest examples/agents/milestone.json --workspace-root .cache/example-milestone-workspaces --control artifacts/example-milestone-control --runner mock --plan examples/agents/mock-plan.json
```

重跑同一命令恢復 milestone，不重作已完成實作。這是已實作的 local milestone 管理，不是虛構的 terminal `/goal` 指令；真正 Goal 支援／限制見 [Codex 查證](CODEX_CAPABILITIES.md)。

## Example B — Direct Headless Muse Task

`probe` 會核實已安裝版本／flags，不呼叫模型：

```powershell
node scripts/agents/cli.mjs probe
```

移除 Mock plan 建立另一個隔離 run，使用 `run --runner muse` 是實際 Muse adapter 入口。金額預設0，沒有已確認 account／成本上限與 process containment 時會保存並要求 handoff 或 BLOCKED，**不是 live Muse 實作成功範例**。本次真正 Muse headless 僅執行無模型的 echo，完整命令／JSONL／獨立解析證據見 [HEADLESS_EXECUTION](HEADLESS_EXECUTION.md)。不能提供一條繞過這些 gate 的「成功」指令。

下一個產品切片契約見 [P0-01 範例](../../examples/agents/p0-01-scene-contract.json)；其 acceptance 對尚未實作的 host 預期失敗。通過該小切片也不能代替 Wiki Task0006 的 browser／Rapier 驗收。本階段不執行正式產品實作。

## 檢查與結果

```powershell
npm run test:agents
npm run test:prompts
node scripts/agents/cli.mjs demo --output artifacts/example-new-demo
npm run validate:all
```

`validate:all` 每次寫新的 `benchmarks/results/phase3-validation-<timestamp>.json`，舊 Phase1／2 artifacts 不覆寫。新 demo／export 要新路徑；state、事件與 failed attempts 都保留。真正執行的範圍與 gate 判定見 [本次報告](PHASE3_REPORT.md)。
