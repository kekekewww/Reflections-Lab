<!-- english-source: {"path":"knowledge/wiki/architecture/runtime-and-contracts.md","sha256":"7a651244ed5480783a4231e0400fa88fe7c8aa037eae4d76da160ce5135e51ac","translated_at":"2026-10-29T05:40:57Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0007
title: Runtime architecture and data authority
type: architecture
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T05:38:39.561Z
sources:
  - RLAB-SRC-0055
  - RLAB-SRC-0057
  - RLAB-SRC-0056
  - SB-SRC-0009
  - SB-SRC-0016
  - SB-SRC-0001
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0007
  - V1-SRC-0060
  - V1-SRC-0015
  - AR-WIKI-bdabc250-7903063a
related_tasks:
  - RLAB-TASK-0016
  - RLAB-TASK-0021
related_decisions:
  - ADR-005
  - ADR-006
  - ADR-007
supersedes: []
tags:
  - P1
  - architecture
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/architecture/runtime-and-contracts.md`](../../../../../knowledge/wiki/architecture/runtime-and-contracts.md). Source SHA-256: `7a651244ed5480783a4231e0400fa88fe7c8aa037eae4d76da160ce5135e51ac`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="runtime時鐘與資料權威"></a>
# Runtime, clocks, and data authority

[Architecture](../../../02-architecture/ARCHITECTURE.md), [Data Contracts](../../../02-architecture/DATA_CONTRACTS.md), and ADR-011/013/014 remain the design authorities. The production React/TypeScript/R3F/Three/Rapier Web mainline is installed and implemented. Exact versions are in package-lock and the [toolchain](../../../03-sdk/V1_WEB_TOOLCHAIN.md); Steam Audio remains Optional.

Scene→validated atomic command→fixed physics→pose/contact snapshots→Sound rules/logical voices→acoustic worker→Web Audio/telemetry/recorder. SI, right-handed +Y/-Z, quaternion xyzw. The renderer only interpolates; it does not write back dynamic poses. Physics at 60Hz, rendering, acoustics, audio, and AI have separate clocks. Bootstrap automatically updates panels at 10Hz and publishes critical commands immediately, without changing the domain fixed tick.

Interactive overload may discard wall time and record telemetry. Recording overload pauses while retaining the backlog; Resume processes bounded batches, or Stop archives continuous ticks. AudioContext continues during pause. Fade/epoch/cursor handle logical arrivals; native onended does not rewrite deterministic behavior state. Toggling NoGravity preserves motion and continuous-sound phase.

Limited first-order box reflections/direct/occlusion are numerical approximations; materials are Synthetic. IR does not fabricate individual paths. Worker has cancellation, timeouts, size/capacity limits, and telemetry. [Production bundle tests](../../../11-v1/ACOUSTIC_DELIVERY.md) cover only the service, not a 10-minute profile of the full product.

See [progress](../../../11-v1/SESSION_PROGRESS_20261027.md) for current implementation and individual evidence. Complete product E2E/performance/device and listening tests are unfinished; installation or unit PASS results do not substitute for them.


The actual React/R3F installation and component browser status have been checked against package-lock and the fixed 22ca product bundle 4/4 results. The old AGENTS statement that they were “not yet installed” is an outdated factual description; the [Conflict Record](../../../../../knowledge/conflicts/fcd68474-0f02-408f-a4dc-6513c3e04561.json) and Git e6b898c preimage are retained. This does not change quality policy or declare the whole first version complete. The user's explicit requirement also calls for an English interface and complete traceable documentation translations; the Traditional Chinese canonical sources and work/test data remain shared.


The latest fixed 22ca product bundle completed 3 clean full flows plus an independent WAV relink (4/4), while retaining 0/2/7 explicit overrun recoveries. The new bilingual 9ae2 bundle passed EN8 plus the original zh13. These are functional/UI evidence tied to their respective fixed sources, not long-duration performance, listening tests, or overall first-version completion. The path population used by A/B diagnostics has been corrected and independently verified. The latest scope and unfinished items follow [checkpoint r2](../../../11-v1/SESSION_PROGRESS_20261027-r2.md); earlier pending-validation statements from the old checkpoint describe progress at that time.


2026-10-28 user scope amendment: the [acceptance amendments](../../../11-v1/ACCEPTANCE_AMENDMENTS.md) now apply, requiring usability at normal 100% scale; the native 200% human gate was removed. The original frozen acceptance and historical tests remain.

<!-- english-original-anchor --> <a id="2026-10-29-架構審查修訂"></a>
## 2026-10-29 Architecture Review Revisions

The production canonical documents now correct outdated unimplemented statements; see the [Review](../../../12-architecture-review/ARCHITECTURE_REVIEW.md) and [ADR-015](../../../02-architecture/adr/015-client-first-and-render-contract.md). The ordinary live lane uses an acoustic worker, but main-thread RAF drives the physics accumulator, and record onTick still solves synchronously. The seal worker is not the simulation clock. Native Web Audio is implemented; custom AudioWorklet has no product processor registration path.

The shared hard propagation limit is 5 seconds, with a 2-second default. Reject out-of-range settings early; six boundary cases have RED/GREEN results. RenderBackend is only a portable types-only seam, with no take mix/stems/ADM renderer yet and no Scene/Project/Recording migration. See the [research guide](../research/architecture-review-20261029.md) for the research branch and worktree, sources, and limitations of each research domain. This round does not claim V1 completion from research or typechecks.
