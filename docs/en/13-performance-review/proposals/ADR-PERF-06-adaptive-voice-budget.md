<!-- english-source: {"path":"docs/13-performance-review/proposals/ADR-PERF-06-adaptive-voice-budget.md","sha256":"e36d339f83cef5036cd7744d955c01f428b6419634f8857cd0b67cb2685b0145","translated_at":"2026-11-01T08:32:24.289Z","executor":"Codex","model_id":null,"translation_lineage":"Existing translations retained where unchanged; research additions and metadata refreshed by Codex","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/13-performance-review/proposals/ADR-PERF-06-adaptive-voice-budget.md`](../../../13-performance-review/proposals/ADR-PERF-06-adaptive-voice-budget.md). Source SHA-256: `e36d339f83cef5036cd7744d955c01f428b6419634f8857cd0b67cb2685b0145`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-perf-06可追溯的自適應聲部與路徑預算"></a>
# ADR-PERF-06: Traceable Adaptive Voice and Path Budgets

- Status: **PROPOSED / not adopted**; 2026-11-01. This page reduces no existing acceptance load, changes no product default, and adopts no dynamic quality policy.
- Code baseline: `05d40fd2d52f4b737f6acac61fa00356403c0038`; new controllers/cross-device capacity/listening tests are **NOT RUN**.
- Basis: [audio contract](../../02-architecture/AUDIO_RUNTIME.md), [A/B contract](../../07-experiments/AB_COMPARISON.md), [DSP Review](../AUDIO_GRAPH_DSP_REVIEW.md), and [Industry Comparison](../INDUSTRY_AUDIO_ARCHITECTURES.md).

<!-- english-original-anchor --> <a id="問題與已有-admission"></a>
## Problem and Existing Admission

[src/audio/control.ts](../../../../src/audio/control.ts) defaults to 24 audio voices, 8 paths per voice, 96 total paths, 16 late sends, and 64 MiB decoded PCM. Separate hard caps include 64 voices/32 paths per voice/256 total paths. These are not capacities measured across devices in this review, and 256 is not the product default. [AudioEngine](../../../../src/audio/engine.ts) already explicitly rejects/fades lower-priority voices, reuses stable path IDs, ranks paths, accounts for retiring routes/late sends, and reports drops.

[Behavior admission](../../../../src/audio-behavior/voice-admission.ts) is a separate deterministic logical-instance admission layer with different costs from the native graph. Writing audio-rendering degradation back as no Behavior emission would damage trace/A-B identity. Equal voice counts may have different FIR/HRTF/IR/tail costs across devices, so active voices alone cannot establish pressure.

<!-- english-original-anchor --> <a id="候選決策"></a>
## Candidate Decision

First retain fixed budgets as the formal baseline and measure per-resource costs/bursts. Only if evidence supports it, offer an explicit interactive-preview quality profile or bounded adaptive controller. Experimental recording/matched A/B default to a fixed profile. Acoustic or Behavior quality changes require distinct conditions, never silently passing as matched comparisons.

A candidate resource vector tracks active/pending/frozen/retiring voices, direct/early routes, late sends, IR overlap, decoded bytes, graph-update time, and frame age together. Show requested/admitted/dropped/retiring counts and reasons. Without actual callback CPU/underrun measurements, mark them unavailable; main-thread wall time is not an audio deadline measurement.

Within a separately frozen profile, a candidate first reduces unnecessary preview updates, then considers lower-ranked early paths/late sends, and only then rejects new one-shots according to explicit priority. This is an order to compare, not a proven optimum. Direct/arrival identity and content/gain/path values cannot be rewritten into different physics. Fewer rendered paths must be labeled perceptual rendering degradation, not complete acoustic output. Continuous sources do not restart each time capacity is needed; new-contact and continuous pools retain distinct responsibilities.

<!-- english-original-anchor --> <a id="接納抖動與生命週期"></a>
## Admission, Oscillation, and Lifecycle

Each profile bounds the above counts and bytes, including duplicate costs during fades/tails. Existing hard caps remain; adaptive values stay within separately validated limits. A controller needs bounded observation windows, explicit high/low pressure boundaries, cooldown/hysteresis, and reasons for changes to avoid per-frame oscillation/path churn. Derive values from [measurements](../MEASUREMENT_PLAN.md); this proposal sets no arbitrary thresholds.

Break rank ties with stable IDs and fade path births/deaths. Do not save nodes by mixing different emitters at one COM. Explicitly reject or degrade under a fixed policy when resources are unavailable; do not grow retiring sets without bounds. Fades/tails of admitted voices still consume capacity. Asset pins, paused frozen arrivals, and pending schedules cannot be reclaimed early due to a downgrade.

A conceptual quality-decision record is `runEpoch, policyVersion, profileId, decisionTick, observationWindow, requestedBudget, appliedBudget, reason, affectedInstanceIds, affectedPathIds`. Pause/reset/seek/dispose invalidate the old controller generation. Resume cannot treat old wall-pressure observations as current evidence for a new run. Future adaptive recording requires preserving original admission/quality decisions and replay rules through a separate schema/compatibility task; no artifact fields are added here.

<!-- english-original-anchor --> <a id="替代與風險"></a>
## Alternatives and Risks

Fixed quality makes reproducible comparisons easier, although some devices may pause/reject more often. User-selected profiles are more explainable than automatic control. Classification by model name lacks actual CPU/browser/thermal evidence and cannot guarantee capacity. Automatic control may improve overload experience but risks pumping, timbral/spatial changes, missing rare events, or mismatched cross-device A/B. Perceived usability cannot replace DSP/physics validation.

Voice virtualization, distant-source culling, and custom Worklet DSP are separate candidates requiring correct emission/playhead/pause/resume/tail semantics and equivalence oracles. Industry practice alone does not establish a benefit here. Only actual solver paths can produce visual rays; UI distinguishes budget omission from solver unavailability.

<!-- english-original-anchor --> <a id="採納條件與回復"></a>
## Adoption Criteria and Rollback

Measure the baseline first under original fixed load/profile, then separately label candidate profiles while holding scene/motion/events/assets/listener/digital-output method constant. Preserve requested/admitted resources, tail/bank peaks, controller changes, PCM arrival/gain/direction/discontinuities, principal-emitter continuity, late/drop reasons, and device/browser/power/thermal conditions. Headphone perception requires separate human evidence.

Adoption requires boundedness under fixed hard caps, no oscillation/identity churn/incorrect reclamation, and measured bottleneck improvements and perceptual costs. Original fixed-performance failures remain; success at a lower profile is a different result. Test pause/resume, bursts, source removal, priority ties, retiring floods, seek, replay, controller cancellation, and cross-device conditions. Unrecorded quality changes must not contaminate recording/A-B fingerprints.

Rollback disables the controller, cancels its old generation at a safe boundary, and returns to original fixed budgets/admission. Already dropped emissions cannot be fabricated back; preserve the degradation record. If experimental content changed, start another take rather than describing a mid-recording rollback as identical conditions.
