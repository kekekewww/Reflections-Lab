<!-- english-source: {"path":"knowledge/wiki/experiments/record-replay.md","sha256":"7345ac586305b46e846388d52fcdf6070d19b1e1ee10c84e84e8d6a1b8fcfc63","translated_at":"2026-10-28T19:34:44.999Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0015
title: Same-motion recording/replay, comparison and current evidence
type: experiment
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-28T19:30:50.483Z
sources:
  - RLAB-SRC-0029
  - SB-SRC-0004
  - SB-SRC-0005
  - SB-SRC-0001
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0015
  - V1-SRC-0025
  - V1-SRC-0031
  - V1-SRC-0063
  - V1-SRC-0064
  - V1-SRC-0069
  - V1-SRC-0073
related_tasks:
  - RLAB-TASK-0016
related_decisions:
  - ADR-009
supersedes: []
tags:
  - P1
  - replay
  - A/B
  - same-motion
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/experiments/record-replay.md`](../../../../../knowledge/wiki/experiments/record-replay.md). Source SHA-256: `7345ac586305b46e846388d52fcdf6070d19b1e1ee10c84e84e8d6a1b8fcfc63`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="同運動錄放比較與當前證據"></a>
# Same-motion recording, replay, comparison and current evidence

The authoritative contracts are [RECORD_REPLAY](../../../07-experiments/RECORD_REPLAY.md) and [A/B](../../../07-experiments/AB_COMPARISON.md). Recorder, MotionReplay, ReplayAudioHost, RecordingProcessor and IndexedDB are wired. Artifacts retain initial scene, integer ticks, motion/velocity/contact, normalized events, derived decisions, source cursors, versions and hashes. content-and-cursors-v2 distinguishes nativeEpoch/logicalIntent/silent/missing; central comparison reruns transitions and rejects false silence and contradictory phases. Legacy retains old hash rules.

Acoustic A/B fixes motion/raw events/listener/source signal/phase and changes only acoustic conditions; Behavior A/B fixes stimuli and solver, explicitly identifying content changes. B is reevaluated from the pre-step checkpoint and does not reconstruct the late-capture AlwaysOn start. Numerical results include artifact/window/band/units/validity; percentages at zero baseline are unavailable, geometric pressure-ratio squared sum is not PCM energy, listening perception or SPL, and RT60 is unavailable without sufficient RIR decay.

Recording overload pauses while retaining debt and never skips ticks; Interrupted can archive raw but cannot pretend complete replay. Pause/seek uses epoch/cursor and tail truncation to avoid duplicate arrivals; motion playback is not physics resimulation. R15 Worker background sealing retains per-frame admission, canonical fingerprints and complete verification; prepared storage is private capability only. Synchronous tasks including transfer/parsing remain, so 4ms is not claimed.

[R17 evidence](../../../../../artifacts/v1/r17-integration-progress-20261029/verification.json) adds real Recorder baseline0 and independent finite-surface geometry cases. Original values/differences/units, same motion and source, and artifact hashes were checked. Replay environment reads recorded configuration; independent public record/seek confirms live temperature and sound speed do not leak in. Root passed 32 old/new regressions and 20 input controls; v3 product4 passed. The original v2 actual FAIL and subsequent additional third-process OnImpact exhaustion of 8 recoveries remain; root cause is not claimed diagnosed.

V3 only confirms an unaccepted Grab: original shared 8-recovery cap, at most 3 inputs, and wait for published tick advancement before deciding; accepted actions are not resent, and Throw and final assertions of four cases are unchanged. Original v2 and early 13 controls, independent three counterexamples, revised 20 cases and new real browser evidence remain. R6 silent validation is tool-protection evidence; human listening remains unperformed; current 600-second negative results are preserved and performance did not pass.


R17 final assessment: [REQUIREMENT_EVIDENCE_20261029-r17.json](../../../../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json) preserves each original requirement and Root/isolated review. Current 600-second data is complete, but performance and sustained workload FAIL; out-of-window finishing was not backfilled. Full functional checks, current browser and R6 silent qualification passed. Next are physical input at normal100% and device listening; complete V1 is unfinished.
