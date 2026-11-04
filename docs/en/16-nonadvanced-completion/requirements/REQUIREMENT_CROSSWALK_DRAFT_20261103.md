<!-- english-source: {"path":"docs/16-nonadvanced-completion/requirements/REQUIREMENT_CROSSWALK_DRAFT_20261103.md","sha256":"7d882ec26eaf553cc22d00bd4f1c0c2d0af4295637541bdd1dfee228d9d94b43","translated_at":"2026-11-03T02:24:51.910Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/requirements/REQUIREMENT_CROSSWALK_DRAFT_20261103.md`](../../../16-nonadvanced-completion/requirements/REQUIREMENT_CROSSWALK_DRAFT_20261103.md). Source SHA-256: `7d882ec26eaf553cc22d00bd4f1c0c2d0af4295637541bdd1dfee228d9d94b43`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="非進階51列驗收對照草稿2026-11-03"></a>
# Nonadvanced 51-row acceptance crosswalk draft (2026-11-03)

This draft retains the original 51 IDs and 102 original conditions, projecting only affected scope in existing Task16/20/32 and PERF001–008/011/014. **All 51 rows remain unadjudicated this round**; original literal conditions, numerical references, workloads, tolerances and external gates are unchanged. See [JSON](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/195b1de848ab3b5496a5a362d45bde0f8006cded) for complete original text, per-condition overlays, source hashes, historical R17 scope and original new-task criteria.

Final product source/bundle for this round is not frozen. Old 501's 1536/217/five 5-second WAVs, e25's two full runs at 1535/1536 exit 1, current incremental SHA 3 GREEN and voice cursor 5 GREEN have different scopes. None can establish complete new-product/native-operation/long-PCM/formal-performance PASS. Original 315 mock JSON remains FAIL/PASS flaky, with root cause unproven; no new paid use.

Root-approved [long-output v2](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bde27d90c0715399501ae6d2de1e43100433e85) retains v1, adding per-job WAV192MiB/manifest2MiB/aggregate384MiB/max64jobs and public archive/recover/download/delete/discard UI. These are specifications awaiting implementation/validation, not measured IDB physical-page overhead.

| Original ID | Original title | R17 historical scope | Linked PERF (affected areas, not dependency changes) | Explicit amendment count | This round's adjudication |
| --- | --- | --- | --- | --- | --- |
| V1-SYS-01 | Reproducible formal Web app | Historical limited engineering acceptance | 001/014 | 1 | Unadjudicated |
| V1-SCN-01 | Scene v1 and domain positive/negative cases | Historical limited engineering acceptance | 005 | 1 | Unadjudicated |
| V1-SCN-02 | Atomic transactions, revision and Undo | Historical limited engineering acceptance | 004/005 | 1 | Unadjudicated |
| V1-SCN-03 | Import/export, Reset and resource cleanup | Historical limited engineering acceptance | 002/004/005/007/008/014 | 2 | Unadjudicated |
| V1-PHY-01 | Fixed step and overload policy | Historical limited engineering acceptance | 002/008/014 | 1 | Unadjudicated |
| V1-PHY-02 | Four body modes and switching | Historical limited engineering acceptance | 014 | 2 | Unadjudicated |
| V1-PHY-03 | FPS character collision and movement | Historical engineering acceptance/manual validation pending | 001/014 | 3 | Unadjudicated |
| V1-PHY-04 | Bounded, wall-safe grabbing | Historical limited engineering acceptance | 002/014 | 3 | Unadjudicated |
| V1-PHY-05 | Drop/Throw semantics and deduplication | Historical engineering acceptance/manual validation pending | 002/004/014 | 3 | Unadjudicated |
| V1-PHY-06 | Pause/focus and Listener restoration | Historical engineering acceptance/manual validation pending | 002/004/006/008/014 | 3 | Unadjudicated |
| V1-BLD-01 | Ghost/Staged/Active three stages | Historical limited engineering acceptance | 004/005/014 | 3 | Unadjudicated |
| V1-EVT-01 | Reliably normalized physics events | Historical limited engineering acceptance | 002/004/008 | 1 | Unadjudicated |
| V1-EVT-02 | Impact deduplication and invalidations | Historical limited engineering acceptance | 002/004/006/008 | 1 | Unadjudicated |
| V1-SND-01 | Ordering/deduplication and orthogonal states | Historical limited engineering acceptance | 002/004/006/008 | 2 | Unadjudicated |
| V1-SND-02 | Bounded mappings and valid references | Historical limited engineering acceptance | 006/007 | 3 | Unadjudicated |
| V1-SND-03 | Audio budgets and deterministic admission | Historical limited engineering acceptance | 001/003/004/006/007/014 | 1 | Unadjudicated |
| V1-SND-04 | Snapshot/epoch and decision replay | Historical limited engineering acceptance | 002/004/006/008/011/014 | 2 | Unadjudicated |
| V1-SND-05 | Contact/bounded latch/material-pair layers | Historical limited engineering acceptance | 002/006/008 | 2 | Unadjudicated |
| V1-SND-06 | Trusted asset import/selection and generation | Historical limited engineering acceptance | 006/007/011 | 2 | Unadjudicated |
| V1-SND-07 | Safe manual authoring and Apply/Undo | Historical limited engineering acceptance | 004/006/007/014 | 3 | Unadjudicated |
| V1-ACO-01 | Real direct path/occlusion | Historical limited engineering acceptance | 004/005/011 | 2 | Unadjudicated |
| V1-ACO-02 | Bounded first-order ISM reflections and path identity | Historical limited engineering acceptance | 004/005/011 | 2 | Unadjudicated |
| V1-ACO-03 | Material/atmosphere/model labels | Historical limited engineering acceptance | 004/005/011 | 3 | Unadjudicated |
| V1-ACO-04 | AcousticFrame and worker boundary | Historical limited engineering acceptance | 001/002/004/005/014 | 2 | Unadjudicated |
| V1-AUD-01 | Unified SourceGraph and single processing | Historical limited engineering acceptance | 003/004/006/011/014 | 1 | Unadjudicated |
| V1-AUD-02 | Continuous sources and smooth updates | Historical limited engineering acceptance | 001/003/004/006/007/011/014 | 1 | Unadjudicated |
| V1-AUD-03 | Pause/Resume audio time | Historical limited engineering acceptance | 004/006/008/011/014 | 1 | Unadjudicated |
| V1-AUD-04 | Raw/Simulated and basic reverb | Historical limited engineering acceptance | 003/007/011/014 | 1 | Unadjudicated |
| V1-UX-01 | Workspace/Transport and data authority | Historical limited engineering acceptance | 002/006/007/008/011/014 | 6 | Unadjudicated |
| V1-UX-02 | Shared selection and real-data visualization | Historical limited engineering acceptance | 004/005/006 | 3 | Unadjudicated |
| V1-UX-03 | FPS input arbitration and safe exit | Historical engineering acceptance/manual validation pending | 014 | 3 | Unadjudicated |
| V1-UX-04 | Sound Inspector authoring/diagnostics | Historical limited engineering acceptance | 006/007/011 | 4 | Unadjudicated |
| V1-UX-05 | Accessibility/reflow/motion | Historical engineering acceptance/manual validation pending | 014 | 5 | Unadjudicated |
| V1-UX-06 | Monitor and audio exposure state | Historical limited engineering acceptance | 001/003/006/014 | 3 | Unadjudicated |
| V1-RPL-01 | Traceable capture and finalization | Historical limited engineering acceptance | 002/004/008/011/014 | 3 | Unadjudicated |
| V1-RPL-02 | Authoritative replay and seek | Historical limited engineering acceptance | 002/006/007/008/011/014 | 3 | Unadjudicated |
| V1-RPL-03 | Pinned resimulation evidence | Historical limited engineering acceptance | 002/004/008/014 | 1 | Unadjudicated |
| V1-AB-01 | Fixed conditions for acoustic A/B | Historical limited engineering acceptance | 002/003/004/005/007/008/011/014 | 3 | Unadjudicated |
| V1-AB-02 | Independent variables in behavior A/B | Historical limited engineering acceptance | 002/006/007/008/011 | 3 | Unadjudicated |
| V1-MET-01 | Grounded metrics and no-data rejection | Historical limited engineering acceptance | 001/011/014 | 2 | Unadjudicated |
| V1-AI-01 | Safe host for original 12 tools | Historical limited engineering acceptance | — | 3 | Unadjudicated |
| V1-AI-02 | Safe host for behavior proposals | Historical limited engineering acceptance | 007 | 3 | Unadjudicated |
| V1-AI-03 | Provider boundary, budget and errors | Historical limited engineering acceptance | — | 1 | Unadjudicated |
| V1-AI-04 | Model explanations cite only real results | Historical limited engineering acceptance | — | 2 | Unadjudicated |
| V1-AI-05 | Real Meta product integration | Historical minimal Meta scope | — | 3 | Unadjudicated |
| V1-VAL-01 | Frozen acceptance and independent review | Historical limited engineering acceptance | 001/002/003/004/005/006/007/008/011/014 | 1 | Unadjudicated |
| V1-VAL-02 | Browser/DSP/E2E and clean reopening | Historical limited engineering acceptance | 001/002/003/004/005/006/007/008/011/014 | 3 | Unadjudicated |
| V1-VAL-03 | Actual-device listening and cross-browser | Historical engineering acceptance/manual validation pending | 001/003/006/007/011/014 | 3 | Unadjudicated |
| V1-VAL-04 | Formal performance profile and degradation | Historical negative measurements/not performance PASS | 001/002/003/004/005/006/007/008/011/014 | 2 | Unadjudicated |
| V1-OPS-01 | Wiki/Task/handoff/Git persistence | Historical session-persistence gate | 001/002/003/004/005/006/007/008/011/014 | 3 | Unadjudicated |
| V1-COM-01 | Rights/rules/publication authorization | Historical engineering acceptance/manual validation pending | 007/011 | 3 | Unadjudicated |

CON05 is an existing scope_conflict in REQUIREMENTS, not a 52nd requirement; the 11/1 build amendment is effective. 200% removes only the required native manual gate; 320CSSpx/keyboard/focus/reduced-motion regressions remain. BLD01 retains no active object before ack, with automatic activation after ack; legal airborne placement is an exception to surface support. PHY06 changes only temporary ghost cancellation, retaining Held and Listener safety rules. P2 dynamic reflectors are overridden only by explicitly authorized portions, without collectively starting advanced Task15/009/010/012.

Task16/20 must be reconciled against their own literal criteria after final product freeze; Task32 S0 scope acceptance does not mean any product row PASS. Original EN01–06 supplements remain; complete English and independent fidelity review follow final source freeze. Full Computer Use and Playwright matrices, native DSP digital files, science/formal performance and Claude/manual work remain separate. Batch source/task/Wiki/checkpoint at the next candidate milestone; this draft preparation performs no new checkpoint, product test, English generation or Git commit.