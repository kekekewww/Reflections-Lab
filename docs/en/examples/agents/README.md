<!-- english-source: {"sha256":"855aef96cd13a488af75b45a14fef987c683c03019a4def26d5553e1c00228da","path":"examples/agents/README.md","links":"english-relative","executor":"Codex","model_id":null,"translated_at":"2026-10-27T03:38:13.6147980Z"} -->
<!-- english-notice:start -->
> English translation of [`examples/agents/README.md`](../../../../examples/agents/README.md). Source SHA-256: `855aef96cd13a488af75b45a14fef987c683c03019a4def26d5553e1c00228da`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="harness-可重現範例"></a>
# Reproducible Harness Examples

These are isolated smoke fixtures; they do not start the production product or consume model quota. Run them from the repository root; choose a new workspace / control for a new experiment, and use resume for an existing run.

```powershell
node scripts/agents/cli.mjs help
node scripts/agents/cli.mjs init --contract examples/agents/smoke-task.json --workspace .cache/example-agent-workspace --control .cache/example-agent-control --plan examples/agents/mock-plan.json
```

Substitute the actual `run_id` returned by init for `<RUN_ID>` below (do not execute the placeholder literally):

```powershell
node scripts/agents/cli.mjs run --run <RUN_ID> --control .cache/example-agent-control --runner mock
node scripts/agents/cli.mjs status --run <RUN_ID> --control .cache/example-agent-control
node scripts/agents/cli.mjs resume --run <RUN_ID> --control .cache/example-agent-control --runner mock
```

This fixture simulates Muse exhausting its quota after making partial changes, followed by Mock Codex adding the remaining implementation and an independent Node acceptance process checking 42. Resuming a Completed run does not repeat implementation. Model and quota data are all marked MOCK.

Mock resource observations are stored in a separate registry and do not change Live account status. `resume` retains the same run and its original resource limits; resource blockers such as authentication, permissions, billing configuration, or an unavailable executor require a confirmed available observation before resuming. Other BLOCKED reasons still require diagnosis first and are not cleared automatically.

Execution-command exit codes: COMPLETED / PASS is 0, BLOCKED / FAIL is 1, and HANDOFF_PENDING is 2. Diagnostic commands such as `status` can exit 0 while returning BLOCKED; read the JSON status as well.

Another CLI can safely request cancellation of a running run; point `<RUN_ID>` and control at the same run:

```powershell
node scripts/agents/cli.mjs cancel --run <RUN_ID> --control .cache/example-agent-control --reason "停止目前任務並保存進度"
```

The original execution process checks the control directory for immutable requests approximately every 50ms, stops subprocesses, saves a checkpoint, marks BLOCKED / CANCELLED, and exits 1 without switching executors. SIGINT / SIGTERM also request cancellation when JavaScript actually receives the signal; a forced termination on Windows may bypass the handler. Prefer `cancel`; do not claim that force-closing always preserves a checkpoint.

A finite milestone can be reproduced directly:

```powershell
node scripts/agents/cli.mjs milestone --manifest examples/agents/milestone.json --workspace-root .cache/example-milestone-workspaces --control .cache/example-milestone-control --runner mock --plan examples/agents/mock-plan.json
```

The milestone retains goal / milestone / run IDs; rerunning the same command reuses completed tasks. Changes to the frozen manifest cause resume to be rejected. This command does not create or manipulate the current Codex Session's `/goal`.

The complete Mock demonstration writes to a new directory and refuses to overwrite earlier records:

```powershell
node scripts/agents/cli.mjs demo --output .cache/example-failover-demo
node scripts/agents/cli.mjs probe
```

`probe` only checks the currently installed Muse version and help. Direct use of `--runner muse` requires confirmed authorization, a cost policy, a sandbox, and process containment first; this example has a spending limit of 0 and does not send model requests. Live model validation is NOT RUN.
