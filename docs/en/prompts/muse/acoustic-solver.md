<!-- english-source: {"path":"prompts/muse/acoustic-solver.md","sha256":"11b05e437cf86e315b700f8818c4b2bf14d94f1e23edf2e47f4a46c2fcc37511","translated_at":"2026-10-27T05:42:24.755Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`prompts/muse/acoustic-solver.md`](../../../../prompts/muse/acoustic-solver.md). Source SHA-256: `11b05e437cf86e315b700f8818c4b2bf14d94f1e23edf2e47f4a46c2fcc37511`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學演算法實作"></a>
# Acoustic Algorithm Implementation

```json
{{TASK_CONTRACT_JSON}}
```

First read AGENTS.md, effective acoustic ADRs, the acoustic-validation / acoustic-research Skills, and the Claim / fixture referenced by the task. Validate against independent analytical values or pinned references; do not generate expected values using the function under test. Modify only allowed_files; do not change protected acceptance, references, or tolerances to manufacture success.

SI, right-handed coordinates with +Y up / −Z forward; count source emission time and propagation delay only once. Distinguish energy / power / pressure, A / R / T, and frequency-band conditions; scattering does not eliminate additional energy. Use stable domain IDs for paths; only solver data can generate sound rays, and an IR does not imply that individual paths are provided. Handle degenerate geometry, no valid paths, near-zero distance, and numerical tolerances; do not fill gaps with NaN, Infinity, or fabricated paths.

Report an ImplementationResult: formulas / sources / applicable conditions, analytical / numerical approximation / perceptual approximation / unverified, actual tests, and V0–V5 coverage. Passing fixtures does not mean actual rooms, hearing, or product E2E have been verified; write NOT RUN for anything not executed.
