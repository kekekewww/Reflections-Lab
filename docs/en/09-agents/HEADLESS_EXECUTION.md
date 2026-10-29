<!-- english-source: {"path":"docs/09-agents/HEADLESS_EXECUTION.md","sha256":"42efba1d25871872ac182fdbe4448cdf0b613d9c6a68bbe66d64a5153cf239e6","translated_at":"2026-10-27T03:42:37.268554Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/HEADLESS_EXECUTION.md`](../../09-agents/HEADLESS_EXECUTION.md). Source SHA-256: `42efba1d25871872ac182fdbe4448cdf0b613d9c6a68bbe66d64a5153cf239e6`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="muse-headlesssession-與-sdk-查核"></a>
# Review of Muse Headless Execution, Sessions, and the SDK

Review date: 2026-10-26 (Asia/Taipei). Local installation: **Muse Code 1.4.13 (1.4.13-R6996.1), Windows x64**. Version and help commands, offline schema export, and an actual CLI echo process were run. Meta model implementation / quota exhaustion / paid inference: **NOT RUN**. Evidence: [local observations](../../../research/agents/muse-cli-observation.json), [raw echo JSONL](../../../research/agents/muse-cli-probe/echo.stdout.jsonl).

<!-- english-original-anchor --> <a id="實際命令介面"></a>
## Actual Command Interface

The `muse.cmd` launcher checks for updates; the initial help command failed because it lacked permission to write an installation-directory timestamp. No privileges were elevated or software updated. After reading the launcher, its supported `MUSE_NO_AUTO_UPDATE=1` setting was used, and version and help commands succeeded. This is a per-process environment setting; it does not change the account, billing, or permanent settings.

```powershell
$env:MUSE_NO_AUTO_UPDATE = '1'
muse --version
muse exec --help
muse usage --help
muse schema generate-json-schema --out .cache/phase3/muse-schema
```

Installed help supports the following arguments; the complete original text is in [exec help](../../../research/agents/muse-cli-probe/exec-help.txt). A version check cannot be skipped because documentation for another version looks the same.

| Category | Reviewed arguments and constraints |
| --- | --- |
| Input / output | `exec --prompt-file <PATH> --json`; stdout is JSONL; do not put the prompt in shell command text. |
| Workspace | `--workspace <PATH>`; `--trust-workspace` loads repo rules / skills for this invocation only. Untrusted repos do not load AGENTS. |
| Model | `--provider echo\|meta`, `--model <ID>`, `--contributor-mode off`; do not automatically switch to third-party models or Contributor. |
| Reasoning / steps | `--reasoning-effort none\|minimal\|low\|medium\|high\|xhigh\|max\|ultra`, `--max-model-steps <N>`; CLI acceptance of a value does not mean every model offers that tier. |
| Safety | `--disable-approval` retains the sandbox; `--sandbox-network restricted`, `--disable-web-tools`; yolo / disable-sandbox must not be defaults. |
| Automation | `--disable-reminders`, `--disable-request-user-input`, and `--no-foreign-personal-context` can limit additional work and personal context. |
| Session | `--session-id <UUID>`; rejects workspace mismatch. The Harness does not automatically bypass it using `--allow-workspace-switch`. |

The official headless contract defines exit 0 as turn completed, 1 as failed / canceled (including the step limit), 2 as usage error, and 130 / 143 as stopped by a signal; **0 does not mean acceptance tests passed**. The wrapper must also check the terminal event, scope diff, and independent tests. [Extending and automating](https://dev.meta.ai/docs/muse-code/extending)

<!-- english-original-anchor --> <a id="已執行的離線-cli-proof"></a>
## Offline CLI Proof Actually Run

A safe prompt was run with the echo provider in a separate directory within the repo's ignored cache, with shell / writes prohibited and no retained session. The result was exit 0, 15 JSONL envelopes, `run.terminal.completed`, and a stopwatch time of **2283.1611 ms**. This is process wall time, not model latency; echo uses synthetic timestamps, so event times are not used to infer performance. An independent Node parser checked versions, terminal events, and usage; the workspace contained only the existing prompt file.

The event envelope uses snake_case: `schema_version:1`, `payload_schema_version:1`, `payload_type`, and `payload`. Key observations:

- `run.lifecycle.started`, `run.output.delta`, and `run.terminal.completed`; the terminal payload's `terminal` is `completed`.
- The stream for `run.usage` is `exec.usage`, with its own sequence starting at 1; it cannot be treated as a globally increasing session sequence number.
- Echo's model is null, tokens are 0, and allowance is null. Preserve unknown values; do not falsely claim a Meta model, a known balance, or continued subscription availability.

This proof did not request or allow code changes, did not trust the workspace, and used `--no-session-log`. Therefore, **actual model code edits, automatic repo skill loading, OS sandbox write isolation, and retained resume / export were not validated by this proof**. The Harness mock process edit / repair tests are listed separately and must not be presented as live Muse implementation.

The read-only `muse skills list --source project --workspace <repo> --trust-workspace --json` was also actually run: exit0, discovering 23 project skills, including 5 added in this phase; their individual diagnostics were empty. The only catalog diagnostic was that the same persistent-project-memory ID in a thin `.claude` wrapper was shadowed by a higher-priority source; the original canonical skill remained visible. This is per-invocation trusted catalog discovery. It did not change permanent trust, launch a model, or prove that a model called a skill. [Discovery proof](../../../research/agents/muse-project-skill-discovery-proof.json)

<!-- english-original-anchor --> <a id="事件恢復與來源"></a>
## Events, Recovery, and Provenance

Help for `muse export --session <UUID> --out <PATH> --redacted` was reviewed; it reads local retained logs and does not call a model. Export defaults to raw and may include tool output and sensitive content; the Harness prefers its own redacted session log. Full exports stay in ignored private cache and are reviewed before indexing. Do not put reasoning blobs, credentials, or verbatim private chats into the Wiki.

Normal tasks retain their Session ID. To continue a run, construct a continuation prompt from the original Task, checkpoint, diff, and remaining acceptance criteria, then use `exec --session-id`. Resume must not be described as automatically restoring Git or work files, and completed side effects must not be resubmitted. If the session format / workspace does not match, retain the error and hand off to Codex. `--no-session-log` loses retained recovery; it was used here only for the offline transport probe. [Working with the agent](https://dev.meta.ai/docs/muse-code/interactive)

<!-- english-original-anchor --> <a id="cli-wrapper-與-session-sdk"></a>
## CLI Wrapper and Session SDK

| Option | Status and assessment in this review |
| --- | --- |
| CLI Wrapper | Local arguments were reviewed and echo was run; it is this phase's main process adapter. The outer Task Run State, locks, validation, and retry / repair decisions are managed by the Codex Harness. |
| `muse serve` + `@muse-code/sdk` | An official SDK exists and can manage handshakes, turns, cancellation, approval, and resume; local serve help / stable schema were reviewed. The SDK was not installed and no inference Session was started. |
| Muse Workflows | The official site explicitly makes availability dependent on build / rollout; Windows session messaging is unsupported. Unverified Workflows are not added to the controller, and internal multi-agent behavior does not replace Harness ownership. |

The SDK site is a Developer Preview. The page commit at the time was `bb094db81ac9b1299ddef7d56190816797d71d24`, displaying schema fingerprint `4f369140?95a835`; **it differs from the local stable export**. The local fingerprint is `7fddaf64?730e5b`, and the schema bytes SHA256 is `59c3c649418af35b54d4c64153210b2c77f8e0be2e47bf595a0ad33194530894`. They cannot be treated as the same contract. [SDK overview](https://meta-models.github.io/muse-code-sdk/next/), [Quickstart](https://meta-models.github.io/muse-code-sdk/next/guides/quickstart/)

The MSP schema and the `exec --json` envelope are different interfaces. The former's `TurnError.quota` can provide a typed quota stop, but text reasons from arbitrary exec runs cannot be assumed to have the same structure. An adapter must parse explicitly for supported versions and actual event fixtures; unknown schemas / missing terminal events / truncated output must be rejected as success, without silently losing events.

<!-- english-original-anchor --> <a id="sandbox-邊界與待驗"></a>
## Sandbox Boundaries and Pending Validation

The official site explains that the sandbox protects the filesystem / network, and Windows may show UAC on first use. A noninteractive run that retains the sandbox uses disable-approval; this does not authorize disabling the sandbox. Project rules / skills load only after trust is granted. Repo `.git` / `.muse` / `.agents` are protected locations; least-privilege failures must be retained and reported, without automatically broadening access. [Permissions and safety](https://dev.meta.ai/docs/muse-code/permissions), [Configuration](https://dev.meta.ai/docs/muse-code/configuration)

The next time a nonzero inference budget is authorized and a valid account is available, first run a single-file fixture in an isolated checkout, then have a fixed verifier check file content / diff / sandbox / cancellation / retained resume. `muse usage --json` returned only a transient refresh error in this review, not an allowance; see [Quota research](QUOTA_RESEARCH.md) for the related policy.
