<!-- english-source: {"path":"docs/09-knowledge/PHASE2_REPORT.md","sha256":"62855da1c4c0362e6fee0bdfaf62dcfd2c77fb44d6d3d5913551c9599b37416d","translated_at":"2026-10-27T03:40:05Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-knowledge/PHASE2_REPORT.md`](../../09-knowledge/PHASE2_REPORT.md). Source SHA-256: `62855da1c4c0362e6fee0bdfaf62dcfd2c77fb44d6d3d5913551c9599b37416d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="phase-2持久-wiki-與設計工程環境"></a>
# Phase 2: Persistent Wiki and Design Engineering Environment

Date: 2026-10-26 (Asia/Taipei). This phase implemented knowledge tools and design specifications; it did not develop the production simulation product. See [PHASE2_REQUEST](../00-project/PHASE2_REQUEST.md) for the original request and [PHASE2_FILE_MANIFEST](../00-project/PHASE2_FILE_MANIFEST.md) for the change list.

<!-- english-original-anchor --> <a id="從哪裡開始"></a>
## Where to Start

[AGENTS](../AGENTS.md) → [Wiki Schema](../knowledge/schema.md) → [Index](../knowledge/wiki/index.md) → [Now](../knowledge/wiki/now.md) → the relevant task JSON / latest handoff. These are all repo files and do not depend on previous conversations or a particular IDE. See [WIKI_OPERATIONS](WIKI_OPERATIONS.md) for command parameters.

<!-- english-original-anchor --> <a id="已建立的系統"></a>
## Systems Established

The Source Manifest indexes existing docs/research, immutable experiment results, user requirements, ADRs, and 24 external reference metadata records, retaining acquisition time, version, hash, license, trust level, and related pages. Full text of restricted material is not copied. The original Gist's fixed revision `ac46de1ad27f92b28ac95459c782c07f6b8c964a` and original bytes hash have been verified; its license is UNKNOWN, so only metadata and original synthesis are retained.

The Wiki includes current state / goals / production roadmap navigation / tasks, architecture / decisions, feature status, scientific synthesis, SDK / physics / replay experiments, design / FPS Grab reading paths, history / blockers / evidence concepts, and handoffs. It connects these domains without moving or rewriting the original research. Each page's frontmatter distinguishes VERIFIED/ACCEPTED/PROPOSED/EXPERIMENTAL/UNVERIFIED/DEPRECATED; implementation, testing, and physics validation remain separate.

7 tasks have stable IDs, owner/lease, dependencies, acceptance criteria, and hash evidence; task JSON is authoritative and tasks.md is derived. UUID events are immutable, and log.md can be rebuilt. Source changes use a new ID plus supersedes, preserving old hashes and history. Only generated regions of index/log/tasks are modified; curated text is retained.

The CLI provides ingest/query/lint/checkpoint/handoff/status and claim/heartbeat/update/release, supersede/reconcile/rebuild/recover/unlock. It uses fixed yaml2.9.1 / AJV8.20.0 versions. Page/YAML size, depth, and alias limits apply, with no embedding / LLM / cloud service. query is lexical retrieval of at most 10 bounded excerpts; it does not pretend to perform scientific synthesis itself.

<!-- english-original-anchor --> <a id="並行與歷史"></a>
## Concurrency and History

Within one checkout, cooperative writer locks, expected hashes, single-file atomic rename, and a transaction journal prevent silent overwrites. Different machines / worktrees do not share a lock and still rely on divided ownership and Git reconcile. Writes across multiple files are not globally atomic. Incomplete journals block stable reads and writes; recovery must confirm that current bytes match before/after, and external changes are retained. Unlocking a dead writer requires evidence of the same host/PID/token/reason; expired locks are not automatically taken over.

This actual Ingest converted several changing UX / compatibility sources to new versions; rerunning an exactly identical plan returns unchanged. Previous current hashes have become historical, and lint warnings are retained without deleting history. The original mutually exclusive Listener exit policies and differing jump/crouch priorities were preserved in a Conflict Record with source excerpts/hashes. Reconcile established an [integration decision](../knowledge/wiki/decisions/fps-listener-exit.md): exiting FollowPlayer restores the saved ScenePinned and marks discontinuity; optional actions are P2. This is engineering integration, not a claim of a new user preference or runtime evidence.

The original Phase1 `validation-local.json` and separately saved snapshot are retained. This phase's overall test results are written to `benchmarks/results/phase2-validation-local.json`. There is still no Git HEAD and no commit/remote/push. A hash alone cannot restore an old document that was not saved; long-term Git preservation and cross-machine synchronization still require version history to be established later.

<!-- english-original-anchor --> <a id="設計與-skills"></a>
## Design and Skills

The sole design maintenance location is [docs/05-ux/DESIGN_SYSTEM](../05-ux/DESIGN_SYSTEM.md), with parameters in [DESIGN_TOKENS.json](../../05-ux/DESIGN_TOKENS.json): 75 tokens cover colors/type/spacing/radius/border/elevation/motion/z-index/states. Specifications can be located for the seven states of 19 components, the motion decision framework, FPS exceptions, acoustic line styles / color refs, 18 stress cases, and six types of performance measurement. The only formal numerical budget remains docs/06-validation/PERFORMANCE_BUDGET; there is no second set of relaxed thresholds.

The eight specified Emil Skills and 6 required references use fixed commit `2d228630ba1446365f614a108cb8252f1feda202`. Including README/LICENSE, the bytes/Git blob/SHA256 of all 16 original files were checked. A single copy is stored in `.agents/skills` with third_party provenance, without symlinks or global installation. `skills@1.7.4` requires Node≥22.20, so it was not run with the project's 22.17; instead, a tool using verified fixed sources fills missing files and refuses to overwrite modified originals.

The official quick_validate for the project's own Skills reports **10/10 PASS**; the fixed bytes of the 8 upstream Skills were verified separately. The original `disable-model-invocation` field in `pick-ui-library` is not among the fields accepted by this quick validator. Upstream content was not modified to pretend it passed; Codex separately added `agents/openai.yaml` to prohibit implicit invocation. This is configured metadata; runtime selection testing is NOT RUN.

<!-- english-original-anchor --> <a id="跨-agent"></a>
## Cross-Agent Support

Local versions: Codex0.163.0, Claude Code2.1.308, Pi0.85.1. Documented capability and actual sessions are separate. Claude's thin CLAUDE/Skill entry points refer to the same specifications. This version of Pi reads root AGENTS and `.agents/skills` itself, so no redundant `.pi` copy is created. Pi uses a separate Node22.23.2; root22.17 cannot be described as satisfying its engine requirement. Pi help encountered a trust-lock EPERM; no privilege escalation or trust-setting change was made.

No automatic Session Hook is installed; shared startup and manual checkpoint/handoff are the current mechanisms. Native Claude/Pi live handoffs were not run. A local Codex child-agent reading test without conversation context will be recorded separately and cannot substitute for actual testing of the other tools. qmd2.8.3's main/tag / MIT / native and model requirements have been checked, but it has not been installed or started; index / lexical search / rg are used for now.

<!-- english-original-anchor --> <a id="驗證與重跑"></a>
## Validation and Reruns

```powershell
npm run test:wiki
npm run test:design
npm run validate:wiki
npm run validate:skills
npm run validate:design
npm run validate:all
```

The overall process consists of 16 commands, including the existing 30 analytical / product-contract regressions, 6 Rapier cases, acquisition tools with 17 PASS / 1 junction SKIP, and the new Wiki / design tests. See the [overall Phase2 results](../../../benchmarks/results/phase2-validation-local.json) for the latest actual counts / exits / stdout / hashes and [scenario validation](../../09-knowledge/SCENARIO_VALIDATION.json) for scenarios A–E. This document does not mark unexecuted items PASS.

The final full run in this phase had **16/16 commands pass**: Wiki **50 PASS / 1 SKIP / 0 FAIL** (51 cases), Design **14/14 PASS**, existing contracts **30/30 PASS**, Rapier **6/6 PASS**, and acquisition tools **17 PASS / 1 SKIP**. Both SKIPs were because the local sandbox prohibited creating a junction fixture; the related runtime guards are not claimed to have passed. 12 JSON schemas compile; static checks passed for 16 file hashes across 8 upstream Skills and for 75 tokens / 19 components / 24 contrast pairs. Independent reading without conversation context was able to recover the goal, P0, and Grab specifications; an actual Handoff also restored work without repeating scientific research.

Wiki tests cover idempotent ingest / index/topic updates, metadata / source / task evidence, handoff recovery, old/new decisions, concurrent child writers / claims, stale proposals, source / decision cycles and supersession history, partial-write recovery / external changes, path aliases, YAML / malformed links, and the manual workflow without hooks. The 14 design tests cover source integrity, missing-file dry-run/mock restore, preservation of modifications, rejection of wrong hashes / oversized files, tokens / contrast / units / curves / component states / acoustic-ray semantics.

<!-- english-original-anchor --> <a id="仍然存在的限制與下一步"></a>
## Remaining Limits and Next Steps

There is no production UI, so browser visual / keyboard / pointerlock / audio / WCAG conformance and device performance are all NOT RUN; static checks of 75 tokens / 24 contrast combinations do not constitute a visual pass. Lint cannot fully determine arbitrary natural-language contradictions, research truth, the latest online version, or actual agent compliance. Source / query content is untrusted data, not execution instructions.

The next Agent should first read now and the latest handoff, then check tasks, Git, and pending journals. The first production-product task remains the [existing P0-01](../NEXT_ENGINEERING_TASK.md). This phase did not start it, nor did it log in / accept terms / submit / push on the user's behalf.
