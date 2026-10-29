<!-- english-source: {"path":"docs/09-knowledge/AGENT_COMPATIBILITY.md","sha256":"57dc2aed3a0349192eb40f3d9e7c5d7b269aac1c118ac320a11abb0a67c7d4a7","translated_at":"2026-10-27T03:39:52Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-knowledge/AGENT_COMPATIBILITY.md`](../../09-knowledge/AGENT_COMPATIBILITY.md). Source SHA-256: `57dc2aed3a0349192eb40f3d9e7c5d7b269aac1c118ac320a11abb0a67c7d4a7`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="跨-agent-相容性與驗證邊界"></a>
# Cross-Agent Compatibility and Verification Boundaries

Checked: 2026-10-26 (Taipei). Shared long-term memory is stored in Git, Markdown and JSON; each product's session / auto memory is not an authoritative source for this project. The shared entry points are [AGENTS.md](../AGENTS.md), [Wiki Schema](../knowledge/schema.md) and the [Knowledge Index](../knowledge/wiki/index.md).

<!-- english-original-anchor --> <a id="身分與本機觀察"></a>
## Identity and Local Observations

| Tool             | Actual execution result                                                        | Scope of this check                                                                       |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| OpenAI Codex CLI | `codex --version` → `codex-cli 0.163.0`; `codex --help` was readable        | Version / help / official documentation; this Codex collaboration tool performed actual task delegation, but this was not a loading test in a separately launched CLI |
| Claude Code      | `claude --version` → `2.1.308 (Claude Code)`; `claude --help` was readable  | Version / help / official documentation; login, model requests, skill loading and cross-session handoff **NOT RUN**  |
| Pi coding agent  | `pi --version` → `0.85.1`; local package `@earendil-works/pi-coding-agent` | Version and local documentation; interactive session / model requests / handoff **NOT RUN**                       |
| qmd              | `Get-Command qmd` found nothing                                            | Not installed; no model downloaded; MCP not started; see the [Search Evaluation](SEARCH_ENGINE_EVALUATION.md)     |

Pi refers to Mario Zechner's coding-agent. The historical URL [badlogic/pi-mono](https://github.com/badlogic/pi-mono) now redirects to [earendil-works/pi](https://github.com/earendil-works/pi). Local `v0.85.1` is pinned to commit `d981de1229ef899957bbe968bc8dcda02a21f477`; the SHA256 hashes of the official README, package.json and extensions.md for that version match the local files. At the time of checking the [Pinned Version](https://github.com/earendil-works/pi/tree/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent), the [main package snapshot](https://github.com/earendil-works/pi/blob/d5b3de22d0e24a3e9c38a9410d3329b099717283/packages/coding-agent/package.json) was `1.4.0` (`SRC-PI-MAIN-PACKAGE-20261026`); capabilities on main must not be attributed directly to the local version.

The Pi 0.85.1 [package](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/package.json) requires Node ≥22.19.0; the local Pi launcher uses a separate `pi-node/current/node.exe`, measured as `v22.23.2`. The project root pins Node to `22.17.0`, which was not changed in this check; do not launch a Pi package whose minimum version is unmet directly with the project's Node.

<!-- english-original-anchor --> <a id="官方支援與共用接法"></a>
## Official Support and Shared Integration

The following table lists documented capabilities, not end-to-end tests of the three products. OpenAI / Anthropic documentation does not provide a fixed version number, so sources are pinned by acquisition date and SHA256; Pi uses the version above.

| Aspect                 | Codex                                                                         | Claude Code                                                                              | Pi 0.85.1                                                                   |
| -------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Project instructions | Reads `AGENTS.md` from repo root to cwd, with same-level overrides taking precedence; a total size limit applies [C1]     | Newer versions can read `AGENTS.md` directly, but default to `CLAUDE.md` when present; this repository imports it with `@AGENTS.md` [A1] | Reads `AGENTS.md` or `CLAUDE.md` from cwd / ancestors; same-level overrides take precedence [P1]          |
| Skills               | Natively discovers `.agents/skills`; reads the full text when needed [C2]                                  | The official project location is `.claude/skills`; this repository has only a thin entry point that directs the reader to the shared Skill [A2]            | Natively supports `.agents/skills`; `/skill:name` can explicitly load one [P2]                 |
| Session hooks        | Documents `SessionStart`, `Stop`, `SessionEnd` and others; project hooks involve trust [C3] | Documents `SessionStart`, `SessionEnd`, tool events and others; configuration and event semantics have their own rules [A3]            | TypeScript extensions can listen for `session_start`, `session_shutdown` and others [P3]    |
| Tool invocation      | Shell / file tools and MCP; subject to actual authorization [C4]                                    | Built-in tools, MCP and CLI print mode; subject to session authorization [A2/A4]                             | Default file / shell tools; extensions can `registerTool()`; MCP requires additional integration [P1/P3] |
| Workspace            | cwd / Git repo; documentation includes managed worktrees [C4]                                  | cwd / Git repo; CLI `--worktree`, subagent `isolation: worktree` [A4]                     | cwd, `.pi` resources and ordinary Git worktrees; no claim of built-in managed worktrees [P1] |
| Subagents            | Officially supports delegation and waiting; platform / configuration affect actual availability [C5]                             | Officially supports built-in / custom subagents [A4]                                                 | No built-in subagents in the core; extensions / separate Pi processes can supplement this [P1]             |
| Handoff              | Product features such as resume / fork / app only continue that product's session; use this repository's handoff across products [C4]       | resume / continue extend that product's session; use this repository's handoff across products [A4]                               | JSONL session, continue / resume / fork / export; use this repository's handoff across products [P1]    |

This check did not add `.codex/hooks.json`, `.claude/settings.json` or `.pi/extensions`, and did not change user settings. Hooks are a product mechanism that can be investigated; they cannot guarantee successful saving after a crash / forced termination, and do not mean that this project already has automatic memory.

<!-- english-original-anchor --> <a id="最薄入口與啟動順序"></a>
## Minimal Entry Points and Startup Order

- Codex: use the root `AGENTS.md` and `.agents/skills/persistent-project-memory/SKILL.md`.
- Claude Code: [CLAUDE.md](../CLAUDE.md) imports the shared instructions using the official `@AGENTS.md` syntax; the [Skill Entry Point](../compatibility/skills/persistent-project-memory/SKILL.md) only directs the reader to the same shared Skill. Do not use symlinks or copy eight domain skill trees. When domain rules are needed, explicitly read `.agents/skills/<name>/SKILL.md` as directed by the root entry point.
- Pi: directly use the existing root `AGENTS.md` and `.agents/skills`, so no redundant `.pi/AGENTS.md` is created.
- Other Agents: start from the same files and invoke the shared CLI through their shell / file tools. If a tool cannot discover the entry point automatically, read it manually; do not claim automatic loading.

Every new session reads, in order: root `AGENTS.md` → `knowledge/schema.md` and `wiki/index.md` → `wiki/now.md` → the task and dependencies → the most recent relevant handoff → task pages and original evidence; then verify against Git and actual files. Read only the details required by the task. Task claims / concurrent updates / conflict handling follow the shared Schema; an Agent's private task list does not provide exclusive ownership across processes.

<!-- english-original-anchor --> <a id="技能結構驗證與呼叫政策"></a>
## Skill Structure Validation and Invocation Policy

The actual checks are recorded separately: **10 project-owned skills passed the local official `quick_validate.py`**; **8 upstream skills were verified against a pinned manifest, and all 16 original-file SHA256 hashes matched**. These two results must not be combined into “all 18 skills passed official frontmatter validation.” The official quick validator's hash is `6068513d924ed3559e186dfcdead7439129828dcf402167fd925c06dffbf2806`; it only performs static checks such as file / format checks, not model execution behavior.

The upstream `pick-ui-library/SKILL.md` contains `disable-model-invocation: true`, which this validator rejects as an unknown field; the original file still retains the same bytes as upstream. Default validation uses original-file hash checks only for upstream skills explicitly listed in the manifest; other project skills still undergo official structure validation. See the [Emil manifest](../../../third_party/emil-skills.manifest.json) for the upstream list and pinned hashes.

The explicit invocation policy confirmed in Codex's official documentation is `policy.allow_implicit_invocation: false` in `agents/openai.yaml`; the documentation does not list `disable-model-invocation` frontmatter as a Codex policy contract. This repository adds a [Thin Policy File](../../../.agents/skills/pick-ui-library/agents/openai.yaml) to reflect upstream's existing explicit-only intent, without changing or deleting the upstream field. According to the documentation, this disables implicit selection by Codex while retaining explicit invocation with `$pick-ui-library`. [Official invocation policy](https://learn.chatgpt.com/docs/build-skills#optional-metadata)

This check verified only YAML content and original-file hashes; model runtime selection **NOT RUN**. The validator's rejection of an unknown field is not enough to prove that the Codex loader rejects the entire skill. This policy file is this project's Codex adapter, not an upstream file or a Claude Code / Pi setting.

<!-- english-original-anchor --> <a id="無-hook-的共同工作流程"></a>
## Shared Workflow Without Hooks

Run from the repo root:

```powershell
npm run wiki -- status --format json
npm run wiki -- query "目前阻擋正式音訊驗證的限制" --format markdown
npm run wiki -- lint
```

After important work is complete, use the shared Skill to prepare the data required by `checkpoint` / `handoff`. Check actual arguments with `--help` first, use `--dry-run` when needed, then execute; update the task, related knowledge and `now.md`. An integration plan for `ingest` requires the Agent to review the sources and propose an explicit plan; the CLI does not automatically determine truth through text generation. The [Knowledge Entry Point](../knowledge/README.md) and CLI help define the complete commands.

The recipient should rerun task-relevant commands and check their results, Git revision / branch / worktree and uncommitted changes. The test fixture simulates an Agent resuming from a handoff and only proves that the file protocol can be verified; it must not be described as a successful live Claude Code / Pi session.

<!-- english-original-anchor --> <a id="錯誤與下一次驗證"></a>
## Errors and the Next Verification

`codex --version` previously warned that it could not clean up / create temporary PATH aliases for the user, but still returned the version. Before displaying help, `pi --help` tried to create `C:\Users\kevin\.pi\agent\trust.json.lock` and the sandbox rejected it with `EPERM`; privileges were not elevated, trust was not reset, and Pi startup did not continue. Version and documentation checks do not depend on this lock. If live Pi verification is pursued later, first confirm the trust state in a user-authorized session, then test the entry point and manual handoff; the shared data format in this repository need not change.

The next compatibility spike should use an isolated fixture repo to launch each of the three tools and record the entry point / skill actually loaded, source location for the same question, one checkpoint → new-session handoff, and interruption recovery; execute only after an explicit model budget exists. All of these were **NOT RUN** in this check.

<!-- english-original-anchor --> <a id="來源定位"></a>
## Source Locations

- C1 `SRC-CODEX-AGENTS-20261026`: [Official AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
- C2 `SRC-CODEX-SKILLS-20261026`: [Official Skills documentation](https://learn.chatgpt.com/docs/build-skills).
- C3 `SRC-CODEX-HOOKS-20261026`: [Official Hooks documentation](https://learn.chatgpt.com/docs/hooks).
- C4 `SRC-CODEX-COMMANDS-20261026`: [Developer commands](https://learn.chatgpt.com/docs/developer-commands).
- C5 `SRC-CODEX-SUBAGENTS-20261026`: [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
- A1 `SRC-CLAUDE-MEMORY-20261026`: [Project memory / AGENTS.md](https://code.claude.com/docs/en/memory).
- A2 `SRC-CLAUDE-SKILLS-20261026`: [Skills](https://code.claude.com/docs/en/skills).
- A3 `SRC-CLAUDE-HOOKS-20261026`: [Hooks](https://code.claude.com/docs/en/hooks).
- A4 `SRC-CLAUDE-SUBAGENTS-20261026`: [Subagents / worktree](https://code.claude.com/docs/en/sub-agents); local `claude --help` additionally checked continue / resume / worktree flags.
- P1 `SRC-PI-INSTALLED-README-V0-85-1`: [Pinned Pi README version](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/README.md).
- P2 `SRC-PI-INSTALLED-SKILLS-V0-85-1`: [Pinned Pi Skills version](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/skills.md).
- P3 `SRC-PI-INSTALLED-EXTENSIONS-V0-85-1`: [Pinned Pi Extensions version](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/extensions.md).

Acquisition times, SHA256, licenses and storage policies are recorded in the [Source Manifest](../../../knowledge/sources/manifest.json). Checking documented official capabilities does not mean that accounts, models, costs, permissions or automation have been verified.
