<!-- english-source: {"path":"prompts/muse/handoff.md","sha256":"adfa8873ca8878e17d5c066d45bc379a78b59c3e5abcdcaf411660dc1c24006f","translated_at":"2026-10-27T05:42:24.755Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`prompts/muse/handoff.md`](../../../../prompts/muse/handoff.md). Source SHA-256: `adfa8873ca8878e17d5c066d45bc379a78b59c3e5abcdcaf411660dc1c24006f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="實作交接"></a>
# Implementation Handoff

```json
{{TASK_CONTRACT_JSON}}
```

```json
{{RUN_STATE_JSON}}
```

Stop dispatching new work; the existing process must be confirmed stopped before handing over the workspace. Preserve partial changes, session logs, Git diff / untracked file inventory and hashes, checkpoint, completed acceptance, and unfinished work. Use null for an unknown Git HEAD; do not fabricate a commit. Do not save API keys, authentication tokens, or private reasoning.

The handoff must record task / goal / milestone / run ID, preferred / actual / previous executor, model / CLI version, fallback reason, and available resource usage. Confirm the completed scope using actual files and evidence; do not treat self-reports as acceptance. Identify which acceptance items have not run and which live tests are BLOCKED because the provider / quota is unavailable.

Give the Orchestrator the data required by the serializer, with progress saved through persistent run state and the existing Wiki task. Do not clear locks, reset, recreate the Task, or start a new executor while the old executor may still be writing.
