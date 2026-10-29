<!-- english-source: {"path":"docs/02-architecture/adr/009-recording.md","sha256":"118135c6157641b178db9ba14031536fc83ca94b001fa13b9f42261f9bcf82e2","translated_at":"2026-10-27T03:38:36Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/adr/009-recording.md`](../../../02-architecture/adr/009-recording.md). Source SHA-256: `118135c6157641b178db9ba14031536fc83ca94b001fa13b9f42261f9bcf82e2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="adr-009experiment-recording"></a>
# ADR-009: Experiment Recording

- Status: Accepted for preproduction; the complete recorder is not implemented.
- Context: Acoustic material changes need to be compared with identical motion; recording only keyboard/mouse inputs cannot provide cross-platform reproducibility validated for this project.
- Decision: An initial snapshot + per-tick pose/velocity trace + contact event trace + input intent + version manifest. The main A/B mode drives acoustics with an authoritative motion trace; reuse the original collision trace only when acoustic materials change and physics stays unchanged.
- Alternatives: Deterministic resimulation with the same Rapier version and snapshot (fallback and diagnostics); recording inputs only (insufficient evidence); video (cannot be analyzed/re-solved).
- Evidence: [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/), [RECORD_REPLAY.md](../../07-experiments/RECORD_REPLAY.md).
- Trade-offs: Pose traces are larger; control clocks, sampling, and interpolation must be recorded. Trace playback must not be called a new physics solve.
- Risks: Reusing old collision events after changing mass/friction contaminates A/B; rerun in that case and label mixed factors.
- Reversibility: Versioned storage and content asset hashes; compression and a validated deterministic runtime can be added later.
