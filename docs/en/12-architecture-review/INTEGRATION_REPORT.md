<!-- english-source: {"path":"docs/12-architecture-review/INTEGRATION_REPORT.md","sha256":"0851ec62f2e83c2125a63ff16aaef728569cd9aa60ee60daedc0c026a0d15186","translated_at":"2026-10-29T05:38:26Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/INTEGRATION_REPORT.md`](../../12-architecture-review/INTEGRATION_REPORT.md). Source SHA-256: `0851ec62f2e83c2125a63ff16aaef728569cd9aa60ee60daedc0c026a0d15186`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="架構研究整合報告"></a>
# Architecture Research Integration Report

2026-10-29. Single task: [RLAB-TASK-0021](../../../knowledge/tasks/RLAB-TASK-0021.json). Actual Git state, commands / exits, gates, and merge / publication status are centralized in [integration-state.json](../../12-architecture-review/integration-state.json). Unexecuted work is not recorded as PASS.

<!-- english-original-anchor --> <a id="repository-與保護"></a>
## Repository and Protection

Original branch codex/sound-behavior-research / baseline c210ca882ca8503b322c28884bf1e9f6e9fe126d; research branch research/architecture-review-20261029. The [baseline](../../12-architecture-review/baseline.json) preserves actual paths, HEAD, clean status, the original absence of a remote, and separate pinned npm ci receipts. Native worktree creation first failed because of Windows long paths, then succeeded after core.longpaths=true was set for this repository. Research changes are confined to the new worktree; no reset / clean / stash / force push / branch deletion.

<!-- english-original-anchor --> <a id="相容性與測試"></a>
## Compatibility and Tests

The [Architecture Review](ARCHITECTURE_REVIEW.md) and [Gap Analysis](ARCHITECTURE_GAP_ANALYSIS.md) list implementation, approximations, and future capabilities by domain. Category A covers research, tense corrections, ADR-015, and roadmap / Wiki updates. Category B covers the shared 5-second limit, six new regressions, types-only RenderBackend, and cost / public-scan tools. No dependency upgrades, Scene / Project / Recording migrations, visual UI changes, or Category C changes.

The [Independent Review](INDEPENDENT_REVIEW.md) gives the narrow fix / contract a PASS; overall limitations and restrictions on publishing original history remain. The new delay tests first yielded RED 4/6, then GREEN 6/6. Component receipts also include 185 acoustic / audio tests, 668 general tests, and 100 analytical geometry cases; none replaces root's unified validation.

The first product-browser run yielded 3 PASS / 1 FAIL (the original eight-attempt capture-recovery budget was exhausted). A separate rerun under the same conditions passed 4/4, with sources / bundles stable in both runs. The FAIL is retained, tests are not relaxed, and load reliability is not claimed fixed. Machine results govern complete check / remaining browser tests / commands and differences before and after merging.

Before merging, recheck the latest original HEAD, merge-base, and changes on both sides; do not compare only the starting baseline. R17 performance FAIL, physical FPS / IME at normal 100% scale and device listening tests NOT RUN, unimplemented Worklet / stems / ADM, and no new paid calls remain in effect.

<!-- english-original-anchor --> <a id="公開範圍與結果"></a>
## Publication Scope and Results

Target: [kekekewww/Reflections-Lab](https://github.com/kekekewww/Reflections-Lab). At recheck it was a public empty repository. Original complete history contains three blobs larger than 100 MiB and prohibited artifacts; direct push remains BLOCKED. See the [Publication Audit](PUBLICATION_AUDIT.md).

The user separately [authorized a clean snapshot](../00-project/ARCHITECTURE_REVIEW_AMENDMENTS.md), preserving all local history. The new snapshot needs an exact payload manifest, no original ancestors, genuine small evidence / fixtures, explicit local-archive references, clean installation / validation, and a complete scan of the materialized files. Fake placeholders, changes to frozen oracles, or relaxed validators must not conceal missing evidence.

Actual research / merge / public branches, snapshot / remote SHAs, files, and CI status are recorded in integration-state.json. The original branch / history is not automatically uploaded or rewritten, and the research worktree / branch is retained. A push that has not occurred is not recorded as a success.
