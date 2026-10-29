<!-- english-source: {"path":"docs/09-agents/AGENT_SECURITY.md","sha256":"62df4375405711d241015b353512de72a552917db35f027775df8f7fd868ad1f","translated_at":"2026-10-27T03:40:19.256Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/AGENT_SECURITY.md`](../../09-agents/AGENT_SECURITY.md). Source SHA-256: `62df4375405711d241015b353512de72a552917db35f027775df8f7fd868ad1f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="開發代理安全界線"></a>
# Development Agent Security Boundaries

Keep the control directory separate from the implementation workspace, with paths confirmed by the host; prohibit traversal, symlink/junction escape, session reuse across workspaces, and simultaneous writes by two executors. Launch a verified CLI with fixed `argv`; do not assemble source text into a shell command. Instructions in contracts and sources are data and cannot expand permissions. Tasks may modify only explicitly allowed files; the Orchestrator must manage protected acceptance criteria, Architecture, and tokens.

By default, Muse retains its sandbox, restricted network, Contributor Off, and exclusion of foreign personal context. Use `--disable-approval` only after confirming that the installed version still retains the sandbox; do not default to `--yolo`/`--disable-sandbox`. Do not mix flag names from different versions. Trust applies only to an explicitly isolated workspace; see [Headless Verification](HEADLESS_EXECUTION.md).

Tasks must not install dependencies, read private settings/credentials, publish files, or push/deploy/reset/clean on their own. Do not discard uncommitted work in the root checkout under the pretext of recreating a worktree. When there is no HEAD, preserve a content manifest and untracked files, and retain the actual null revision.

Logs retain only necessary events and bounded stdout/stderr, redact common secret/Authorization/key types, and do not record the full environment or private conversations. Regex redaction cannot guarantee removal of all sensitive data; prompt scope must exclude secrets in advance, and CLI private settings/API keys must not be sent to the model or written to the repo. Do not expand an unknown provider payload in full in tool output.

A direct child closing after a timeout does not mean that all descendants have stopped. Windows process tree termination also has limitations involving detached children/PID reuse; do not perform automatic live takeover without verifiable containment. The absence of descendants in a mock subprocess is a test assumption; its results cannot be generalized to mean that any live CLI is safe.

This is a cooperative harness; it cannot prevent an arbitrary process with the same OS permissions from rewriting the control store. A production multi-agent deployment should reinforce it with an OS sandbox/separate permissions/protected CI acceptance files. The product Agent has narrower tool permissions, with no shell/repo access; see the [Runtime Contract](../08-ai/PHASE3_RUNTIME_AGENT.md).

