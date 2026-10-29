<!-- english-source: {"path":"docs/11-v1/AB_METRIC_POPULATION_AUDIT.md","sha256":"60fd01745e9254858ba4773cd970a5a98f154a155023201fd667ee581ee44dd2","translated_at":"2026-10-27T05:45:18Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/AB_METRIC_POPULATION_AUDIT.md`](../../11-v1/AB_METRIC_POPULATION_AUDIT.md). Source SHA-256: `60fd01745e9254858ba4773cd970a5a98f154a155023201fd667ee581ee44dd2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ab-指標取樣母體修復與稽核"></a>
# A/B Metric Sampling Population Fix and Audit

2026-10-27; applies to `V1-AB-01` and `V1-MET-01`. This is a statistical fix for Computed geometry queries, not evidence of a new acoustic model, listening tests, or Meta live integration. The original acceptance criteria, analytical expected values, and tolerance have not been relaxed.

<!-- english-original-anchor --> <a id="已確認的原因"></a>
## Confirmed Cause

In the old browser diagnostic, A retained acoustic diagnostic queries for stop/fading events, while the B reevaluation solved only for sources with post-step `playbackState=playing`. The original metrics averaged all available queries, so the two sides actually used different populations. The original trace has not been deleted; diagnostics from the stopping phase remain traceable.

Independent reading of 81 frames in the old archive, window=tick 4..84, fixedDt=1/60 s:

| Sample Set | Count | Arithmetic Mean of Direct Delay (s) |
| --- | ---: | ---: |
| All available direct queries | 118 | 0.01592289576547707 |
| Post-step logically playing sources | 116 | 0.016036576002133818 |

The two extra entries are at ticks 25 and 39, both fading/stop diagnostics. The difference between the two means, `0.0001136802366567477 s`, exactly equals the old UI's B−A, with a residual of 0. It cannot be interpreted as a change in direct propagation time caused by changing only materials. The [original archive and this independent recalculation](../../../artifacts/v1/metrics-population-audit-20261027.json) fix the input hashes, original artifact canonical hash, sampling, and limits. The old archive did not preserve raw B; this audit does not present an inference as having read raw B.

<!-- english-original-anchor --> <a id="現行統計契約"></a>
## Current Statistical Contract

`src/experiments/metrics.ts` is the collector shared by the domain and AI analysis:

- When complete source states from the same tick/revision/epoch are available, use post-step logically playing queries; exclude stop/fading and non-playing diagnostics. This does not determine actual native PCM admission or human audibility.
- A sample is determined by tick, stable semantic source, and listener, without using array rank or an engine handle. All duplicate ambiguous queries are excluded; one is not selected based on array order.
- Direct delay uses only genuinely available order-0 paths. The path squared-pressure-ratio metric sums `mean_actual_frame_bands(gain²)` over returned paths, then averages over queries; it makes no claim about authored gain, pitch, waveform, PCM, SPL, or complete sound-field energy. For an available query with no paths, the sum over the empty returned-path set is 0; this does not mean that physically there is absolutely no sound.
- Each metric retains method, population kind/policy, sample count, eligible/excluded/invalid query counts, backend declaration mismatch count, bands, and tick window. The sampling key for aggregate path-energy includes the actual band set to avoid comparisons with different frequency weighting.
- Legacy data without trustworthy emission eligibility uses only the explicitly identified geometric-query diagnostic method; counts of unverified/mismatched backend declarations are retained and cannot be presented as a validated emitted-source aggregate. The AI tools' existing backend ID/version gates remain in place.
- The A/B gates for fixed conditions such as source/motion retain their original rules. Only when a metric's method/sampling support is incompatible does that metric retain the original A and B values but return null for delta/percent, together with a specific reason; permitted changes to path visibility are not misclassified as invalidating the entire experiment.

<!-- english-original-anchor --> <a id="驗證與邊界"></a>
## Validation and Boundaries

A real 3-second Root Rapier capture includes impact and one-shot expiry, retaining the original stop diagnostics; with identical materials, B has delay/energy deltas of 0; with only materials changed, B has a direct-delay delta of 0 and a lower geometry-path squared pressure ratio. AI Analyze agrees with the same collector's values. Independent regressions also cover missing/duplicate query support, legacy data, AI paired deltas, and disabling only affected metrics when the band bases differ.

The [independent 7/7 raw validation](../../../artifacts/v1/metrics-population-review-20261027/1793071935418/verification.json) and adjacent stdout/stderr retain their original bytes; `.cache` paths in the JSON are the original execution locations, and persistent copies are in the artifact directories with the same names. In the preceding run, the 7th test was correctly rejected by the existing `BAND_MISMATCH` because the fixture had not also restricted material bands; [failure output is also retained](../../../artifacts/v1/metrics-population-review-20261027/1793071880399/verification.json). Only the new fixture was corrected; the core validator and tolerances were not relaxed.

This report does not replace the post-fix current-source browser/E2E gate. The final browser harness should retain raw A, raw B, and complete comparison results, verify shared logical-playing sampling and material-only direct delay, and separately list unverified device, listening-test, performance, and live-integration items.
