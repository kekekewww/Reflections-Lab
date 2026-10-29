# Harness 可重現範例

這些是隔離 smoke fixtures，不啟動正式產品，也不消耗模型額度。從 repository 根目錄執行；重跑新的實驗請選新的 workspace／control，既有 run 則使用 resume。

```powershell
node scripts/agents/cli.mjs help
node scripts/agents/cli.mjs init --contract examples/agents/smoke-task.json --workspace .cache/example-agent-workspace --control .cache/example-agent-control --plan examples/agents/mock-plan.json
```

將 init 回傳的真實 `run_id` 代入下列 `<RUN_ID>`（不是字面執行占位符）：

```powershell
node scripts/agents/cli.mjs run --run <RUN_ID> --control .cache/example-agent-control --runner mock
node scripts/agents/cli.mjs status --run <RUN_ID> --control .cache/example-agent-control
node scripts/agents/cli.mjs resume --run <RUN_ID> --control .cache/example-agent-control --runner mock
```

此 fixture 模擬 Muse 部分修改後額度耗盡，由 Mock Codex 追加剩餘實作，並由獨立 Node 驗收程序檢查42。Completed run 的 resume 不會重做實作。模型與額度資料均標記 MOCK。

Mock 資源觀察存入獨立 registry，不會改變 Live 帳號狀態。`resume` 保留同一 run 與原資源上限；認證、權限、帳務設定或 executor 不可用等資源阻礙，須先有確認的 available 觀察才能恢復。其他 BLOCKED 原因仍須先診斷，不會自動解除。

執行命令的 exit code：COMPLETED／PASS 為0、BLOCKED／FAIL 為1、HANDOFF_PENDING 為2。`status` 等診斷命令可以 exit0 並回傳 BLOCKED；請同時讀取 JSON 狀態。

執行中的 run 可由另一個 CLI 安全要求取消，將 `<RUN_ID>` 與 control 指向同一 run：

```powershell
node scripts/agents/cli.mjs cancel --run <RUN_ID> --control .cache/example-agent-control --reason "停止目前任務並保存進度"
```

原執行程序約每50ms檢查控制目錄中的 immutable request，停止子程序、保存 checkpoint，標記 BLOCKED／CANCELLED 並 exit1，不切換 executor。SIGINT／SIGTERM 也會在 JavaScript 實際收到訊號時要求取消；Windows 強制終止可能繞過 handler，請優先使用 `cancel`，不能宣稱強制關閉也一定保存 checkpoint。

可直接重現一個有限 milestone：

```powershell
node scripts/agents/cli.mjs milestone --manifest examples/agents/milestone.json --workspace-root .cache/example-milestone-workspaces --control .cache/example-milestone-control --runner mock --plan examples/agents/mock-plan.json
```

milestone 會保留 goal／milestone／run IDs；重新執行同一命令沿用已完成的任務。改動已固定的 manifest 會拒絕恢復。此命令不建立或操縱目前 Codex Session 的 `/goal`。

完整 Mock demonstration 會寫入新目錄，拒絕覆寫舊紀錄：

```powershell
node scripts/agents/cli.mjs demo --output .cache/example-failover-demo
node scripts/agents/cli.mjs probe
```

`probe` 只查目前安裝的 Muse 版本與 help。直接使用 `--runner muse` 必須先有確認的授權、成本政策、sandbox 與 process containment；此範例付費上限0，不會發出模型請求。Live 模型驗證為 NOT RUN。
