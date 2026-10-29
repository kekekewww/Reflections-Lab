<!-- english-source: {"path":"docs/12-architecture-review/VALIDATION_PLAN.md","sha256":"1c529406d280fa6958db9e0bde1784559c8776d8a17ae83238563ddaf30b8692","translated_at":"2026-10-29T05:28:32Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/VALIDATION_PLAN.md`](../../12-architecture-review/VALIDATION_PLAN.md). Source SHA-256: `1c529406d280fa6958db9e0bde1784559c8776d8a17ae83238563ddaf30b8692`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="架構研究與整合驗證計畫"></a>
# Architecture Research and Integration Validation Plan

Date: 2026-10-29. Authoritative requirements: [original request](../00-project/ARCHITECTURE_REVIEW_REQUEST.md). Single task: [RLAB-TASK-0021](../../../knowledge/tasks/RLAB-TASK-0021.json). This plan changes neither the [frozen V1 acceptance](../11-v1/ACCEPTANCE.md) nor the [user amendments](../11-v1/ACCEPTANCE_AMENDMENTS.md).

<!-- english-original-anchor --> <a id="執行與檔案所有權"></a>
## Execution and File Ownership

- [x] Read-only preflight of the original workspace, baseline, and remote confirmation; create a complete independent worktree, with its root recorded in baseline.json.
- [x] Pinned Node 22.17.0 / npm 11.4.2; separate offline npm ci runs for the root and physics-spike in the new worktree, with no shared node_modules.
- [ ] Five research domains each have a single writer: physics / sound, acoustics / ADM, recording / render, browser / cloud, and Meta / UI; root maintains canonical architecture / ADR / Wiki / task.
- [ ] Category A: correct stale “no product” statements, preserve current scientific / sound / performance / external limitations, and cite or briefly summarize sources only.
- [ ] Category B: share the 5-second propagation limit (solver rejects settings it cannot pass to audio early); types-only portable RenderJob / RenderBackend, without registering or starting a renderer.
- [ ] Run complete quality checks, analytical benchmarks, and relevant real-browser tests; retain commands / exits / stdout and hashes of changed sources. An isolated reviewer compares the original requirements with actual files.
- [ ] Obtain the latest original branch, merge-base, and both diffs; integrate any new progress into the research branch first, then safely merge with no-ff; validate again after integration.
- [ ] Push only after a public-release audit of all reachable history passes. The original history is known to contain three artifacts larger than 100 MiB. Deleting files in the latest commit cannot be treated as cleaning history; if no authorized safe solution exists, preserve the work and record BLOCKED.

<!-- english-original-anchor --> <a id="驗證順序與接受條件"></a>
## Validation Order and Acceptance Conditions

| Stage | Actual commands / evidence | Acceptance conditions |
| --- | --- | --- |
| Dependencies | npm ci --offline --ignore-scripts --no-audit --no-fund; same method for the physics-spike prefix | Pinned versions, exit 0, no lockfile differences |
| Narrow-fix RED/GREEN | node --import tsx --test tests/acoustics-runtime/propagation-limit.test.ts | First observe the cross-layer mismatch fail, then pass boundaries consistently with audio; no change to existing oracles/tolerances |
| Quality | npm run check | Includes research, runtime, schema, Wiki, typecheck, lint, format, build, licenses, and English; read each workflow's results |
| Analytical / offline | npm run benchmark | Fixed references, errors, and original thresholds retained |
| Browser | product-refined-v3, physics lifecycle, storage, UI-refined-v2 / linked-workflow-v2 | Run the applicable entry points in a real browser; functional success is not a listening-test or performance pass |
| Independent review | Original requirements / base..HEAD / current source / validation receipts | Check file ownership, contracts, sources / costs, publication safety, and known limitations |
| Integration | Latest original branch / research / merge-base, no-ff merge, check / relevant E2E | Original workspace clean; no unresolved major conflicts; no stash / reset / force |
| Publication | Complete-history secret / archive / binary / size audit, remote comparison | No unresolved major publication risk; remote history retained; verify HEAD / files / CI after push |

<!-- english-original-anchor --> <a id="審查焦點"></a>
## Review Focus

1. Solver settings of 5+epsilon / 10 seconds must not first produce a frame that audio cannot accept; 0.001 / 5 seconds and the 2-second default remain valid.
2. RenderJob contains only portable refs and does not serialize AudioNode / Rapier / runtime objects; source selection preserves physics, events, and admission.
3. Explicitly report the synchronous recording-acoustics hot path, RAF driving, and main-thread metadata costs. The existence of a Worker does not imply that all solving is isolated.
4. Cost is an engineering estimate with explicit duty / rate / storage / egress assumptions; the price verification date is pinned and cannot guarantee 10,000 concurrent users or model rates.
5. Build / test artifacts remain in history even if removed from the final tree; do not push while the publication audit has not passed.

This round makes no visual UI changes, adds no paid API calls, deploys nothing, does not choose a root LICENSE, and does not accept terms on the user's behalf. Physical FPS / IME at normal 100% scale, Hi-x65 / D3V listening tests, and R17 performance failures remain unchanged.
