<!-- english-source: {"path":"CLAUDE.md","sha256":"c671d9875055d96f9d26d77bed367c7ff22f663265165bade09e06d74608465b","translated_at":"2026-10-27T03:38:38.947915Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`CLAUDE.md`](../../CLAUDE.md). Source SHA-256: `c671d9875055d96f9d26d77bed367c7ff22f663265165bade09e06d74608465b`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

@AGENTS.md

<!-- english-original-anchor --> <a id="claude-code-入口"></a>
# Claude Code Entry Point

Maintain shared rules and knowledge only in `AGENTS.md`, `knowledge/schema.md`, and their indexes. When a memory workflow is needed, read `.agents/skills/persistent-project-memory/SKILL.md`; `.claude/skills/persistent-project-memory/` provides only a compatibility entry point.

Read the project skills in `.agents/skills/` and their references according to the task; do not copy rules into Claude's private memory. After significant work, run the shared manual Wiki workflow; automatic session hooks have not yet been configured or verified.
