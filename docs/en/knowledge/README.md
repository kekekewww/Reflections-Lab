<!-- english-source: {"path":"knowledge/README.md","sha256":"ecf53e25a0a6aee77e65fc457d75350167a2e00bf32a957ddce4ab6e25beb740","translated_at":"2026-10-27T05:43:54.262833Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`knowledge/README.md`](../../../knowledge/README.md). Source SHA-256: `ecf53e25a0a6aee77e65fc457d75350167a2e00bf32a957ddce4ab6e25beb740`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab-持久專案知識"></a>
# Reflection Lab Persistent Project Knowledge

This is the shared entry point for Codex, Claude Code, Pi and other file-based agents. It has no private model memory, cloud database, hidden hooks or paid LLM dependencies.

1. Start a new session by reading [Schema](schema.md) → [Index](wiki/index.md) → [Now](wiki/now.md).
2. Use [Tasks](wiki/tasks.md) to find the task JSON, dependencies and acceptance criteria, then read the latest [handoff index](wiki/handoffs/index.md).
3. Open only the relevant Wiki pages, and return to their Source Manifest, original docs, research, code and tests to verify them.

<!-- english-original-anchor --> <a id="三層與唯一權威"></a>
## Three Layers and Their Authoritative Sources

| Layer | Location | Rule |
| --- | --- | --- |
| Original evidence | Existing docs/research, fixed experiment results, copies of requirements, Git; indexed by sources/manifest.json | Do not move or duplicate documents for the Wiki. Each source version has a fixed ID/hash; record updates as separate versions with supersedes. A summary must not overwrite evidence |
| Synthesis Wiki | wiki/ | Connect research, decisions, feature status, risks and tasks. Retain citations and limits for data; do not promote guesses to VERIFIED |
| Rules and tools | schema.md, scripts/wiki, schemas/wiki-*, project Skill | Metadata, updates, claims, conflicts, handoffs and reproducible validation |

The existing `docs/ROADMAP.md` is the official roadmap; `wiki/roadmap.md` only provides navigation. `docs/05-ux/` is the authority for design specifications and tokens; the Wiki does not maintain a duplicate set of parameters. `knowledge/tasks/*.json` is authoritative for tasks, and `wiki/tasks.md` is a derived index; `events/*.json` contains immutable operation events, and `wiki/log.md` can be rebuilt from them. Complete history is not preserved by continually expanding now.

<!-- english-original-anchor --> <a id="工具"></a>
## Tools

```powershell
node scripts/wiki/cli.mjs status --format json
node scripts/wiki/cli.mjs query "FPS grab" --format markdown
node scripts/wiki/cli.mjs lint --format json
```

For the exact syntax of ingest/checkpoint/handoff/claim/reconcile, use `npm run wiki -- help`, the [operations guide](../09-knowledge/WIKI_OPERATIONS.md) and Schema. All mutations support dry-run; query performs local lexical retrieval, rather than synthesizing an answer with a language model. Agents must read the originals, organize synthesis pages and provide a plan; tool output must not be treated as new research.

On this machine, the Windows PowerShell npm wrapper consumes `--format` as an npm argument. When passing flags or requesting machine-readable JSON, use the `node` commands above directly. `npm run wiki -- status` / `help` without flags still work.

<!-- english-original-anchor --> <a id="同步與維護"></a>
## Synchronization and Maintenance

Create checkpoints only for significant progress. Do not record every tool call, complete conversations or intermediate reasoning. Version Markdown/JSON/YAML; retain licenses and sources, and index restricted papers without copying them. Do not store keys/tokens, private accounts or confidential information. Record null honestly when there is no Git HEAD; do not automatically commit/push. Locks do not communicate across worktrees/machines: divide ownership by file and use Git reconcile; do not claim global exclusivity.

Session Hooks have not been configured; a manual handoff before ending a session is mandatory. See [AGENT_COMPATIBILITY](../09-knowledge/AGENT_COMPATIBILITY.md) for compatibility evidence, local installations and unverified scope.
