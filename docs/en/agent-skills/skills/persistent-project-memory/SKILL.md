<!-- english-source: {"path":".agents/skills/persistent-project-memory/SKILL.md","sha256":"79b3246abd9d21b14524c9b85e48de9d726355f505ea52915035b72e1136aa5a","translated_at":"2026-10-27T05:41:23.2575743Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: persistent-project-memory
description: Maintain the Reflection Lab cross-Agent Wiki, sources, tasks, Checkpoints, conflicts, and handoffs; use for important research, implementation, or Session handoff, without preserving private conversation history.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/persistent-project-memory/SKILL.md`](../../../../../.agents/skills/persistent-project-memory/SKILL.md). Source SHA-256: `79b3246abd9d21b14524c9b85e48de9d726355f505ea52915035b72e1136aa5a`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="持久專案記憶"></a>
# Persistent Project Memory

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

When a new session resumes work, or requirements/decisions/implementation/research/tests/Bugs/UI design change significantly, connect traceable knowledge back to existing synthesis pages. Do not merely add isolated reports.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

Task ID, agent/session, original sources and rights, changed files, validations actually executed, and unfinished items.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read AGENTS → knowledge/schema → wiki/index → now → relevant task/latest handoff, loading only the pages needed for the task.
2. Verify with Git/actual files; honestly record null when there is no HEAD. Check existing source versions and the Wiki first to avoid duplicate research.
3. `npm run wiki -- status`; when a claim is needed, use CLI claim/token/lease and explicit file ownership. A written declaration is not a cross-machine lock.
4. Legally index new evidence in the manifest first, and prepare a synthesis page plan and expected hashes; dry-run `ingest` before applying it. For a Source version change, create a separate ID that supersedes the old record.
5. Update task criteria/evidence; DONE requires checking files and results, not merely an Agent's statement of completion. Do not conflate planning, implementation, testing, and physical validation.
6. Record authority or stale-write conflicts with reconcile/conflict, retain the original proposal, and do not use last-writer-wins.
7. Checkpoint important results; hand off and update now at session end, recording actual commands/results/risks/next. No automatic hook is configured; the manual process cannot be omitted.

<!-- english-original-anchor --> <a id="references"></a>
## References

- `knowledge/README.md`, `knowledge/schema.md`
- `knowledge/wiki/index.md`, `knowledge/wiki/now.md`
- `docs/09-knowledge/WIKI_OPERATIONS.md`, `AGENT_COMPATIBILITY.md`
- `scripts/wiki/cli.mjs` (confirm actual parameters with help)

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Original evidence/Source versions, interlinked synthesis pages, tasks, and a handoff that an Agent without context can use to take over; rebuild index/log from events.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

`node scripts/wiki/cli.mjs lint --format json`, `npm run test:wiki`; read original artifacts/revalidate when necessary. The Windows npm wrapper may swallow `--format`; pass flags through direct node. lint cannot automatically prove the absence of arbitrary natural-language contradictions, and query cannot replace research.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Record diagnostics for expired hashes/locks/transactions first; do not forcibly delete or overwrite them. Leave important conflicts UNRESOLVED and continue independent work. Do not record keys/tokens, complete verbatim chats, or private intermediate reasoning; do not push/accept terms/deploy.
