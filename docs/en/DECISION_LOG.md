<!-- english-source: {"path":"docs/DECISION_LOG.md","sha256":"ce78e5b45bfa9fe892655f5ca860dade777afa3f799a5aa6f27a39024bb396ee","translated_at":"2026-10-27T03:41:33.3216904Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/DECISION_LOG.md`](../DECISION_LOG.md). Source SHA-256: `ce78e5b45bfa9fe892655f5ca860dade777afa3f799a5aa6f27a39024bb396ee`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="決策日誌"></a>
# Decision Log

| Date (Taipei) | Decision | Evidence / status |
| --- | --- | --- |
| 2026-10-26 | Started from an empty directory without Git and established new preproduction; do not assume an old prototype exists | PROJECT_BASELINE / original listing |
| 2026-10-26 | Stay with research / isolated spikes rather than writing formal features at scale | User scope; formal terms on pre-competition code remain unconfirmed |
| 2026-10-26 | Web main track; Steam native capability adapter candidate; a WASM static library exists, but the browser is unvalidated | ADR-005; official 4.8.1 archive / native smoke |
| 2026-10-26 | TypeScript + Three, with React a panel candidate; do not reject R3F based on performance speculation | ADR-001; no React/R3F runtime comparison |
| 2026-10-26 | Rapier fixed step; bounded impulse grabbing, without parenting to the camera | ADR-002/004; official API + isolated basic physics |
| 2026-10-26 | SI + right-handed Y-up/-Z; stable IDs / versioned schemas | ADR-007; 8 schema checks |
| 2026-10-26 | Workspace and Simulation State are orthogonal; Tab retains focus, B selects Build; preview/staged/enable are separate | UX / physics cross-agent integration |
| 2026-10-26 | Motion trace is the main A/B track; changes to physics properties require a new run | ADR-009; no claim of measured cross-platform consistency |
| 2026-10-26 | Separate Meta provider-document research from account availability; API budget 0, no live call | ADR-008; AI documents |
| 2026-10-26 | Cite the Web Audio stable2021 REC separately from the current1.1 Working Draft | Two official W3C versions |
| 2026-10-26 | Initialize local Git main, without automatic commit / remote / push | Git environment preparation |

This table contains the engineering recommendations adopted during bootstrap; changes require a new ADR or a supersede record, without overwriting historical evidence. Rules verification found that the CV waiver already identifies itself as Official Rules; do not continue to state that “there are no official rules at all,” although unpublished details remain unknown.
