<!-- english-source: {"path":"docs/09-agents/FAILURE_RECOVERY.md","sha256":"e82c44baf4cc2d62a0df5f7317c30f4a52ee88fbfab087380cea6b185a50d897","translated_at":"2026-10-27T03:40:19.256Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-agents/FAILURE_RECOVERY.md`](../../09-agents/FAILURE_RECOVERY.md). Source SHA-256: `e82c44baf4cc2d62a0df5f7317c30f4a52ee88fbfab087380cea6b185a50d897`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="中斷恢復"></a>
# Interruption Recovery

First run the [State CLI](CODEX_MUSE_ORCHESTRATION.md), and read the Run State/latest event, workspace lock, and saved handoff; do not reinitialize the same task. Compare contract/acceptance hashes, workspace path, Git revision, and saved content, and confirm that there is no unknown writer. Continue both completed criteria and remaining work from the original evidence.

Saved partial edits cannot directly count as a successful checkpoint; Codex must inspect the diff, finish the remaining scope, and rerun the original acceptance checks. A RepairTask provides specific feedback on defects and does not change the Task objective. The same resume/COMPLETED task should be idempotent; exceeding the retry limit must result in BLOCKED.

When a crashed execution process leaves a lock, do not automatically steal it based on TTL. First confirm that the original PID/host/session and descendant processes have stopped; if this cannot be demonstrated, retain the artifacts, stop new writers, and leave handling to the host operator. The Wiki writer lock/transaction recovery and Harness workspace lock are different resources; [Wiki recovery](../09-knowledge/WIKI_OPERATIONS.md) does not authorize releasing the executor lock.

When Git has no HEAD yet, revision=null, status/file hashes/content snapshots still permit takeover; this cannot reconstruct a nonexistent commit. Do not recover with destructive reset/clean. If files outside acceptance and implementation are modified, preserve before/after artifacts and create a conflict with a human-readable reason rather than silently overwriting them.

When Muse usage becomes available again, do not immediately interrupt the current Codex task; reroute at an accepted task boundary or a checkpoint proven to have no writer. When Codex is also unavailable, preserve, mark BLOCKED, and stop consuming resources; do not wait for recovery through unlimited retries.

