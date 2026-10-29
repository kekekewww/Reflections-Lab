<!-- english-source: {"path":"docs/09-agents/CODEX_MUSE_ORCHESTRATION.md","sha256":"6c927b097e11579583f8a7c7cce88d37f7a0aa974556ebb4f5a833f9c43a6086","translated_at":"2026-10-27T03:40:09.5703246Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/CODEX_MUSE_ORCHESTRATION.md`](../../09-agents/CODEX_MUSE_ORCHESTRATION.md). Source SHA-256: `6c927b097e11579583f8a7c7cce88d37f7a0aa974556ebb4f5a833f9c43a6086`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="codex--muse-開發操作"></a>
# Codex × Muse Development Operations

> **Current policy as of 2026-10-27: Codex leads; Muse Code is optional.** See [ADR-013](../02-architecture/adr/013-codex-primary-development.md). The Muse-first workflow below is retained as an Optional Harness / historical Phase3 profile. It is not a prerequisite for normal development, and restored credit does not automatically switch the project back.

The shared startup sequence is AGENTS → knowledge/schema → index → now → relevant task / latest handoff. The Wiki task remains the sole authority for work; the runner's detailed state is governed by the [Task schema](../../../schemas/agents/task.schema.json) and [Failover policy](FAILOVER_POLICY.md). For actual commands, see `node scripts/agents/cli.mjs help`; when passing CLI flags in PowerShell, prefer calling `node` directly to prevent the local npm wrapper from swallowing flags.

<!-- english-original-anchor --> <a id="啟動與恢復"></a>
## Startup and Recovery

First confirm that the workspace is isolated; the repository root must not serve as the implementation workspace. When HEAD exists, the host can prepare a Git worktree. At this stage, the original checkout has no HEAD, so the example uses a separate fixture directory and does not automatically create or clean up a worktree.

```powershell
node scripts/agents/cli.mjs init --contract examples/agents/smoke-task.json --workspace .cache/example-agent-workspace --control artifacts/example-agent-control --plan examples/agents/mock-plan.json
```

Read the returned `run_id`, save it as `$runId`, then run:

```powershell
node scripts/agents/cli.mjs run --run $runId --control artifacts/example-agent-control --runner mock
node scripts/agents/cli.mjs status --run $runId --control artifacts/example-agent-control
node scripts/agents/cli.mjs resume --run $runId --control artifacts/example-agent-control --runner mock
```

Resuming the same run continues its contract / goal / milestone, checkpoints, and attempts; it does not reinitialize completed work. BLOCKED does not mean that a run may reopen automatically: it can only be handled under an explicit resource recovery policy, the original budget, and content integrity conditions. Blockers involving scope / acceptance / process safety must be diagnosed first.

A separate process can request cancellation of the current run:

```powershell
node scripts/agents/cli.mjs cancel --run $runId --control artifacts/example-agent-control --reason "operator cancellation"
```

The CLI delivers an AbortSignal through bounded polling, stops direct children, saves a checkpoint, and marks the run CANCELLED / BLOCKED without starting a fallback. SIGINT / SIGTERM follow this same flow. An OS force kill may still leave a lock and child processes, so manual confirmation is required; locks must not be stolen automatically. Execution commands return exit0 for COMPLETED, exit2 for HANDOFF_PENDING, and exit1 for FAIL / BLOCKED; `status` returns exit0 when the diagnostic operation itself succeeds.

<!-- english-original-anchor --> <a id="codex-接手"></a>
## Codex Takeover

When Muse quota is exhausted, Muse is unavailable, or the original budget is insufficient, the runner saves content and the Git diff, a handoff, and remaining work, then returns HANDOFF_PENDING. The existing Codex session reads the handoff JSON, partial edits, and acceptance hashes, confirms that no writer is active, and then acknowledges the handoff using that record's actual SHA256:

```powershell
node scripts/agents/cli.mjs acknowledge --run $runId --control artifacts/example-agent-control --handoff-hash $handoffHash
```

This command only enters RUNNING_CODEX. It does not start a model, recursively call the current Session, or declare completion. After Codex finishes the remaining changes within the original allowed files, run acceptance separately:

```powershell
node scripts/agents/cli.mjs verify --run $runId --control artifacts/example-agent-control
```

Failure creates a RepairTask and retains the original tests. Continued failure after bounded repairs, or insufficient resources, results in BLOCKED. Only success results in COMPLETED. If the content of a completed run changes, its previous PASS cannot be reused. Changing the executor does not recreate the original Goal; across chats, `goal_id` alone cannot substantiate a claim that the product `/goal` has resumed.

<!-- english-original-anchor --> <a id="接回-wiki"></a>
## Connecting Back to the Wiki

First freeze the actual export into a new file, then copy mutable run state into immutable evidence. `agent-projection` checks hashes, maps repository-relative paths, and produces a patch accepted by the owner-authenticated Wiki CLI:

```powershell
node scripts/agents/cli.mjs export-wiki --run $runId --control artifacts/example-agent-control --output artifacts/example-export.json
node scripts/wiki/agent-projection.mjs --input artifacts/example-export.json --control artifacts/example-agent-control --output artifacts/example-wiki-patch.json
```

Finally, follow [Wiki Operations](../09-knowledge/WIKI_OPERATIONS.md) and use the existing task owner token to run `task update --file artifacts/example-wiki-patch.json`. The tool does not decide whether task criteria are true and does not automatically mark a Wiki task DONE merely because the run is COMPLETED. Read the full verification output and scope before ingesting synthesis pages and creating a checkpoint / handoff. Choose a new file for every snapshot; overwriting is rejected.

<!-- english-original-anchor --> <a id="task-contract-正規化"></a>
## Task Contract Normalization

| Requirement name | Actual machine field / authority |
| --- | --- |
| Task ID | `id`; `wiki_task_id` links to the existing task |
| title / scope / out_of_scope / refs / permissions / deliverables | Description fields with the same names, with type and range validation; writable scope is actually enforced by `allowed_files` |
| acceptance_criteria / verification_commands | The single `acceptance[{id,script,args}]`, executed in a separate Node process to prevent two sets of conditions from diverging |
| model / reasoning | `muse.model` / `muse.reasoning_effort`, based on the verified installed version / official model capability |
| max_model_steps | `policy.development.max_model_steps` |
| max_repair_rounds | `policy.max_repairs`, maximum 3; total attempts / time are also bounded |
| resource_budget | `policy.development`, `policy.product_runtime`, and policies such as timeout / output |
| task_status | Run State `status`; an input contract cannot declare itself COMPLETED |

Unknown quota and model fields remain null. Schema validation checks shape and some domain constraints; it does not guarantee completeness of natural-language scope / permissions. The Orchestrator must still review refs, protected helpers, the acceptance script itself, and authorization.

The actual Muse prompt includes a bounded context pack: AGENTS, Wiki startup, the corresponding task, and selected refs. Limits are 64KiB per file and 256KiB in total; missing / binary / secret / symlink inputs are rejected. It is created only after model work has been permitted to start, and content is not sent when work has stopped for budget / quota reasons. Workspace snapshots have separate limits and do not support workspaces containing node_modules. This is the current Harness's supported scope; worktrees and build pipelines for large production projects require separate expansion / verification.

<!-- english-original-anchor --> <a id="example-a--有限-codex-goalmilestone"></a>
## Example A — Bounded Codex Goal / Milestone

In a Codex chat that supports Goals, a Goal should contain only one milestone, a bounded budget, and the original acceptance conditions. At this stage, do not create a giant Goal for the product Roadmap. The existing chat can run the following actual bounded runner; the primary executor is labeled MUSE in the Mock:

```powershell
node scripts/agents/cli.mjs milestone --manifest examples/agents/milestone.json --workspace-root .cache/example-milestone-workspaces --control artifacts/example-milestone-control --runner mock --plan examples/agents/mock-plan.json
```

Rerunning the same command resumes the milestone without redoing completed implementation. This is implemented local milestone management, not an invented terminal `/goal` command. For actual Goal support / limits, see [Codex Capability Verification](CODEX_CAPABILITIES.md).

<!-- english-original-anchor --> <a id="example-b--direct-headless-muse-task"></a>
## Example B — Direct Headless Muse Task

`probe` verifies the installed version / flags without calling a model:

```powershell
node scripts/agents/cli.mjs probe
```

Remove the Mock plan and create another isolated run; `run --runner muse` is the actual entry point for the Muse adapter. The default monetary budget is 0. Without a confirmed account / cost cap and process containment, it saves state and requests a handoff or enters BLOCKED. **This is not a successful live Muse implementation example.** The actual Muse headless execution in this phase was only an echo without a model. For the complete command / JSONL / independent parsing evidence, see [HEADLESS_EXECUTION](HEADLESS_EXECUTION.md). A “success” command that bypasses these gates cannot be provided.

For the next product slice contract, see the [P0-01 example](../../../examples/agents/p0-01-scene-contract.json); its acceptance is expected to fail against the host that has not yet been implemented. Passing that small slice also cannot replace the browser / Rapier acceptance for Wiki Task0006. This phase does not execute formal product implementation.

<!-- english-original-anchor --> <a id="檢查與結果"></a>
## Checks and Results

```powershell
npm run test:agents
npm run test:prompts
node scripts/agents/cli.mjs demo --output artifacts/example-new-demo
npm run validate:all
```

Each `validate:all` run writes a new `benchmarks/results/phase3-validation-<timestamp>.json`; old Phase1 / 2 artifacts are not overwritten. New demos / exports require new paths; state, events, and failed attempts are all retained. For the scope actually executed and gate decisions, see the [report for this phase](PHASE3_REPORT.md).
