<!-- english-source: {"path":"knowledge/wiki/roadmap.md","sha256":"53de681a029bb58aa1a7f7f296afb16ece6ee62af9f7eb12b99603ee07036284","translated_at":"2026-11-01T08:32:24.037Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
---
id: RLAB-KB-0005
title: Production roadmap guide
type: roadmap
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-01T08:05:14.686Z
sources:
  - SB-SRC-0007
  - SB-SRC-0010
  - SB-SRC-0027
  - SB-SRC-0001
  - V1-SRC-0010
  - AR-WIKI-bdabc250-7903063a
  - PERF-SRC-ROADMAP-20261101
related_tasks:
  - RLAB-TASK-0006
  - RLAB-TASK-0021
  - RLAB-TASK-PERF-20261101-REVIEW
related_decisions: []
supersedes: []
tags:
  - P0
  - roadmap
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/roadmap.md`](../../../../knowledge/wiki/roadmap.md). Source SHA-256: `53de681a029bb58aa1a7f7f296afb16ece6ee62af9f7eb12b99603ee07036284`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="正式路線與目前驗收"></a>
# Production roadmap and current acceptance

The sole production roadmap is [docs/ROADMAP.md](../../ROADMAP.md). Task JSON maintains dependencies/claims/criteria; Wiki does not create a separate schedule or backlog. The latest authorization has moved from research to first-version implementation. Scene/Physics/interaction/Sound/Audio/Acoustic/UI/record-replay/AI code is implemented; complete acceptance has not yet passed.

Task0011 M0 is DONE. Evidence for 0006/0012/0013/0014 is collected against the original criteria. Overall closure of 0016 depends on 0017 physics/interaction, 0018 acoustics/Worker, 0019 record-replay/assets, and 0020 the complete toolchain/browser/performance. Original dates and research order are historical only; they do not establish that the competition remains open or automatically confer submission eligibility.

Next, resolve overload in complete product E2E recording/test observation costs, add the latest matrix and lifecycle, native input/zoom, cross-browser checks and a 10-minute profile, then complete a clean install/full check, persistent memory, and Git. Headphone listening tests/personal eligibility/terms and publication decisions are tracked separately and cannot be replaced by mocks. [Now](now.md) provides the latest actionable work.

<!-- english-original-anchor --> <a id="2026-10-29-研究後優先級"></a>
## 2026-10-29 Priorities After Research

The [formal Roadmap](../../ROADMAP.md) adds P0/P1/P2 priorities, retaining the original ten-day table as history. P0 preserves the existing demo and addresses Task0020's recording hot path / performance, physical FPS/IME at 100% scale, and device listening tests; 200% was removed. P1 addresses producer-capability projection, Motion registry, and short-take local mix/stems one by one; P2 follows with advanced acoustics/ADM/long cloud renders. The next Codex engineering slice is a bounded record-evaluation lane, with original criteria unchanged.

Task0021 covers this independent research / integration / publication work. Original history contains prohibited artifacts; the user authorized preserving all local history and creating a separate clean public snapshot. It requires an exact manifest, genuine small-evidence closure, original tests, and a complete safety scan; missing evidence is not treated as PASS.

<!-- english-original-anchor --> <a id="2026-11-01-效能與緩衝研究"></a>
## 2026-11-01 Performance and Buffering Study

The [independent study](research/performance-buffer-review-20261101.md) and [non-binding optimization roadmap](../../13-performance-review/OPTIMIZATION_ROADMAP.md) are saved. All14future optimizations remain BACKLOG and seven proposals remain PROPOSED. No product optimization starts; MVP/formal gates and prior failures remain unchanged. This research does not automatically resume other paused product goals.
