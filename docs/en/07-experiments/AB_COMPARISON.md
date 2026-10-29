<!-- english-source: {"path":"docs/07-experiments/AB_COMPARISON.md","sha256":"a087e3b1fb719870508cc0de76ab59d07fa01ff478537e83cfc0b75912423fdd","translated_at":"2026-10-27T03:39:48Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/07-experiments/AB_COMPARISON.md`](../../07-experiments/AB_COMPARISON.md). Source SHA-256: `a087e3b1fb719870508cc0de76ab59d07fa01ff478537e83cfc0b75912423fdd`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ab-聲學比較"></a>
# A/B Acoustic Comparison

As of 2026-10-27, **acoustic A/B** and **behavior A/B** are distinguished. The existing source-signal equality requirements below apply to acoustic mode; behavior mode rules appear in the final section and must not silently relax the existing mode.

<!-- english-original-anchor --> <a id="可比較條件"></a>
## Conditions for Comparison

The baseline and candidate must have the same motion trace hash, source signal/hash, listener trace, sample rate, evaluation window, backend/version, geometry, seed, and solver quality, changing only the explicitly declared acoustic material or propagation parameter. If the backend changes, label this separately as a cross-model comparison; the differences cannot all be attributed to the material.

When comparing reverberation with a continuous source, the emission phase/loop point of playback must be identical. When comparing collision sounds, if the change is to the physical material (mass/friction/restitution) or excitation/resonance, declare that the stimulus has also changed. The same physical stimulus conditions are retained only when changing the acoustic surface while reusing the same contact trace.

<!-- english-original-anchor --> <a id="報告"></a>
## Reporting

For each metric, record band Hz, unit, method, analysis window, validity, noise floor/dynamic range, and run artifact IDs. `delta=candidate-baseline`; RT uses s, and DRR/C50/C80 use dB. Percentage delta is unavailable when baseline=0. When RT60 is extrapolated from T20/T30, state the estimator explicitly; if a short RIR does not reach a valid decay range, report `INSUFFICIENT_DECAY` rather than fabricating a 60 dB decay.

Align IR comparisons to a common emission time while retaining the physical arrival delay. Also provide alignment with direct delay removed for shape diagnostics; do not describe this as identical propagation time. Keep raw/simulated monitors at the same gain. If listening is normalized, state that it is unsuitable for comparing absolute energy.

<!-- english-original-anchor --> <a id="結果分類與防混淆"></a>
## Result Classes and Avoiding Confusion

Measured means observations obtained legally with measurement conditions; Computed means output from a specified solver; Estimated means a model estimate; AI-generated Explanation means text citing those artifacts. No uncalibrated dBFS → dB SPL inference is permitted.

Visual path selection and the Inspector share the path ID, source/listener, and scene revision. When Steam IR has no individual paths, disable the corresponding UI; RIR/metrics comparisons remain available. Show unavailable plus a reason for every unsupported metric.

<!-- english-original-anchor --> <a id="下一階段驗收"></a>
## Next-Stage Acceptance

An analytical fixture using the same motion trace and two Synthetic materials can first validate band gains/delay; then validate with an independent solver (V3) and an actual room/perceptual evaluation (V5). Material bands/scattering are not equivalent across solvers; first record conversion rules, errors, and limits. The full A/B runtime has not yet been run.

<!-- english-original-anchor --> <a id="sound-behavior-abdraft未實作analysis-adapter"></a>
## Sound Behavior A/B (draft; analysis adapter not implemented)

`SoundBehaviorComparison` in the [separate behavior draft](../../../schemas/sound-behavior/behavior-document.schema.json) requires `comparisonKind` and explicit `independentVariables`; the existing Experiment v1 has not yet been migrated.

| Condition | acoustic | behavior |
| --- | --- | --- |
| motion/original physics-player events/listener/geometry/physics settings | Must be identical | Must be identical |
| solver/atmosphere | Must be identical; name cross-model comparisons separately | Must be identical |
| sourceSignal/asset/generator/profile | Must be identical | Differences may arise only from declared asset/generator/gain/pitch/profile independent variables; retain hashes for both sides |
| propagation material | Change acousticMaterial only as declared | Must be identical; changing both wall absorption and timbre cannot be called a single-factor comparison |
| Comparison question | Propagation/acoustic material differences under the same stimulus | Content, rules, loudness/timbre, or generation differences under the same motion/events |

`physicsEventTraceHash` refers to normalized physics/player events before rule evaluation, not derived AudioEvent/voice decisions; the latter may naturally differ after changing rules. Changing the piano sample with the same physical trace cannot be described as having the same source signal, and its differences cannot be used to infer improved wall RT60.

The initial version uses authoritative motion/event replay. If mass/friction/restitution/gravity changes in a new solve, create a separate physics rerun rather than labeling it a same-motion comparison. Until the new analysis adapter is implemented, the existing CompareExperiments does not automatically support behavior comparisons because of this draft; return CAPABILITY_UNSUPPORTED/INCOMPATIBLE_EXPERIMENTS and retain the reason.

Record the actual variant/seed, playback parameters, voice budget, and drop/steal decisions. If loudness normalization is used for listening comparisons, retain the original gain and normalization method; normalized results cannot be used to infer absolute energy/SPL. Musical output may be analyzed using applicable lawful signal metrics, but RT metrics still require a valid IR/measurement conditions and must not be fabricated by AI or tone rules.
