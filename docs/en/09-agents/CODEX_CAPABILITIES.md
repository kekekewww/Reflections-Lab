<!-- english-source: {"path":"docs/09-agents/CODEX_CAPABILITIES.md","sha256":"a96865bfc4796d1ae5a00ffaa5d2cca2b2107530e59e27b6d029cbc912049d9a","translated_at":"2026-10-27T03:41:22.181116Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/CODEX_CAPABILITIES.md`](../../09-agents/CODEX_CAPABILITIES.md). Source SHA-256: `a96865bfc4796d1ae5a00ffaa5d2cca2b2107530e59e27b6d029cbc912049d9a`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="codex-能力額度與接手邊界"></a>
# Codex Capabilities, Quotas, and Takeover Boundaries

Review date: 2026-10-26 (Taipei). This page distinguishes local CLI help, official documentation, and actual model execution; no independent Codex model process was launched, authentication changed, quota purchased, or reset used.

<!-- english-original-anchor --> <a id="本機證據"></a>
## Local Evidence

The following commands were run in `D:\Developing\Meta Hack`; all exited 0:

```powershell
codex --version
codex --help
codex exec --help
codex exec resume --help
codex resume --help
```

The version is **codex-cli 0.163.0**. Each command also produced access-denied warnings for cleanup of the Windows private `arg0-windows` temporary directory / creation of a PATH alias; help was readable, but this does not establish successful startup of a new inference process or sandbox, or successful session writes. No privilege escalation or changes to private directories were performed in this review.

| Capability | What 0.163.0 help confirms | Actual model validation |
| --- | --- | --- |
| Non-interactive execution | `codex exec [OPTIONS] [PROMPT]`; reads stdin when no prompt is supplied or `-` is used | NOT RUN |
| Workspace selection | `-C, --cd <DIR>`; new tasks may select `--worktree` | NOT RUN; the existing repo has no HEAD, so worktree creation cannot be assumed |
| Permissions | `--sandbox read-only\|workspace-write\|danger-full-access`, `--approve-for-me` | NOT RUN; full access / bypass is not the default |
| Structured events | `--json` emits JSONL; `--output-schema <FILE>`; `-o, --output-last-message <FILE>` | Confirmed by help; no live JSONL obtained |
| Session | `codex exec resume [SESSION_ID] [PROMPT]`, `--last`, `--all`; interactive `codex resume` | NOT RUN; do not arbitrarily use `--last` to join an unknown session |
| Ephemeral session | `--ephemeral` | Confirmed by help; do not use this option to conceal records needed for persistent handoff |
| Configuration | `--ignore-user-config` and `--ignore-rules` exist | Not defaults; they must not be used to bypass project and user policies |
| Goal | Help has no separate `goal` subcommand; official documentation describes interactive `/goal` | Confirmed by documentation; no Goal was created or cleared through the TUI in this review |

The official [non-interactive documentation](https://developers.openai.com/codex/noninteractive) explains that `exec` defaults to read-only and can select workspace-write; `--full-auto` is no longer supported. `--json` events include `thread.started`, `turn.started/completed/failed`, `item.*`, and `error`. This is documentation evidence for official formats, not a record of model execution in this review. A valid final schema or exit 0 still does not prove that an implementation meets acceptance criteria.

<!-- english-original-anchor --> <a id="本專案的-codex-fallback"></a>
## Codex Fallback in This Project

The current approach is for the **existing Codex Orchestrator to enter Implementation Mode**. After the runner saves the same Task / Milestone / goal reference, checkpoint, partial changes, and original acceptance conditions, the current Codex continues the work; it does not attempt to call its own running session or launch recursive agents. Actual runner commands follow [Orchestration](CODEX_MUSE_ORCHESTRATION.md) and CLI help.

If an independent CLI adapter is enabled in the future, process startup, actual effective permissions, JSONL schema, explicit session ID, cancellation / subprocess stopping, session export, quota, and resource limits must first be validated in an isolated workspace before adding usable capabilities. The official [CLI reference](https://developers.openai.com/codex/cli/reference) can establish that a command exists, but cannot replace local execution proof. Compatible combinations of worktree for a new session and resume also require a new check against the installed version.

When Codex both orchestrates and implements, its own report cannot establish acceptance. It must run acceptance commands / reference fixtures fixed in advance, check that acceptance-file hashes have not changed, and retain actual stdout, stderr, and exit codes from independent subprocesses; add an isolated review agent and browser / physics / audio E2E when needed. Missing independent validation must be listed as NOT RUN or BLOCKED.

<!-- english-original-anchor --> <a id="goal-與恢復"></a>
## Goals and Recovery

The official [Using Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex) states that Goals have been available since 0.128.0 and are **persistent thread state**, not Git or project-wide memory. Safe continuation occurs only when the thread is idle, has no pending work / user input, and the budget allows it.

`/goal` views / sets the objective; `/goal pause`, `/goal resume`, and `/goal clear` are user controls. The Harness `goal_id` / objective reference only links an existing objective; it must not claim that a JSON field created or resumed a native Codex Goal, nor create another `/goal` when switching executors. The local version meets the documented minimum version, but this is not a live test of the TUI feature.

Each Goal should be limited to one Milestone and include the outcome, validation dimensions, permitted tools, restrictions, resource budget, bounded repair, and blocked conditions. If the objective is unmet when its budget is exhausted, save progress and stop; do not mark it complete. An executor change must not reset criteria already verified.

<!-- english-original-anchor --> <a id="codex-額度觀測"></a>
## Codex Quota Observation

At approximately 23:21 Taipei on 2026-10-26, one actual snapshot was obtained using the desktop app's read-only `get_usage_limits`:

| Field | Observation in this review | Interpretation |
| --- | --- | --- |
| `ordinaryUsageAllowed` | `true` | Ordinary use was allowed at that time; no guarantee of future execution |
| limit ID | `codex` | An account-shared observation using `rateLimitsByLimitId.codex` |
| window duration | 10080 minutes | 7-day window |
| used percent | 3% | Used, not remaining |
| remaining percent | 97% | `clamp(100 - usedPercent, 0, 100)` |
| reset | Unix `1793599696` | 2026-11-02 14:08:16 Taipei |
| secondary window | `null` | Not supplied; must not be written as 0% used or 100% available |

Account IDs, reset credit IDs, and billing details are not stored in this project. The tool also returned credit fields, but the monetary unit / usability of that balance was not verified in this review, so it is not converted to US dollars or used to infer token capacity. A snapshot is an observation limited to a point in time, not a fixed task resource budget; the CLI does not automatically call desktop tools, so the Orchestrator must provide a new observation.

Codex usage limits, OpenAI API billing, Muse subscriptions, and Meta Model API quota must not be conflated. If Codex actually reports unavailability, an insufficient resource budget, or permission denial, save a handoff and mark BLOCKED; do not purchase, reset, raise limits, switch to an unauthorized account, or disable protections. Permission / authentication errors are not labeled as Muse quota exhaustion. Any unknown remaining quota stays `null` / UNKNOWN.

<!-- english-original-anchor --> <a id="權限與來源"></a>
## Permissions and Sources

The [official auto-review explanation](https://learn.chatgpt.com/docs/sandboxing/auto-review) explicitly states that automatic review only changes who reviews boundary requests; it does not increase filesystem / network permissions. With `approval_policy=never`, there are no interactive approval requests for it to review. The Harness does not treat ?unattended? as authorization for full access. Existing sandbox / managed requirements always take precedence.

| Original source | Version / date | Evidence level in this review |
| --- | --- | --- |
| Five local `codex` version / help commands | 0.163.0, 2026-10-26 | LOCAL HELP VERIFIED; model execution NOT RUN |
| [Goals cookbook](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex) | Actual page text read on 2026-10-26; no immutable release supplied | DOC REVIEWED |
| [Non-interactive mode](https://developers.openai.com/codex/noninteractive) | Actually read on the same date | DOC REVIEWED |
| [CLI reference](https://developers.openai.com/codex/cli/reference) | Actually read on the same date; current page content | DOC REVIEWED |
| [Built-in commands](https://learn.chatgpt.com/docs/developer-commands#built-in-slash-commands) | Actually read on the same date | DOC REVIEWED |
| [Auto-review](https://learn.chatgpt.com/docs/sandboxing/auto-review) | Actually read on the same date | DOC REVIEWED |
| Desktop `get_usage_limits` | Single snapshot; field semantics follow the tool contract | LIVE READ-ONLY OBSERVATION; not an inference test |

Official full text was not redistributed as a dataset, and CLI syntax was not inferred directly from search summaries. Official documentation is mutable; it must be checked again after a CLI upgrade or before deployment. This page does not authorize spending limits or model permissions.
