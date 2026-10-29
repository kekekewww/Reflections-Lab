<!-- english-source: {"path":".agents/skills/acoustic-research/SKILL.md","sha256":"9719cf7a5a4c528db1bc495caab5bf6b3392feb1eea7cdb7d4837b18ce8e1cc9","translated_at":"2026-10-27T03:37:45Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: acoustic-research
description: Verify Reflection Lab acoustic theory, material data, papers, and scientific claims; use for research and source updates, not as a substitute for numerical validation.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/acoustic-research/SKILL.md`](../../../../../.agents/skills/acoustic-research/SKILL.md). Source SHA-256: `9719cf7a5a4c528db1bc495caab5bf6b3392feb1eea7cdb7d4837b18ce8e1cc9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學研究"></a>
# Acoustic Research

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

When adding an acoustic model, material data, an important formula, or a research conclusion, establish traceable evidence and avoid treating abstracts or model inferences as measurements.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

The specific question, model scope of applicability, existing Claim IDs, and intended engineering use.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read PAPER_INDEX, the relevant theory, and the ledger first to avoid repeating existing research.
2. Consult primary papers, official standards pages, and publicly available author materials; distinguish full text, abstracts, and metadata. Record access limitations when paid full text is unavailable.
3. Verify authors, year, and DOI; analyze methods, mathematics, experiments, assumptions, errors, reproducibility, and use in this project.
4. Label engineering derivations Derived, and distinguish algorithmic approximations from actual numerical results. Record measured/derived/tuned/synthetic, frequency, and installation conditions for each material entry.
5. Update the original index, literature analyses, and ledger using stable claim IDs; avoid copying third-party content unless necessary.

<!-- english-original-anchor --> <a id="references"></a>
## References

- `research/papers/PAPER_INDEX.md`, `LITERATURE_REVIEW.md`
- `research/theory/ACOUSTIC_THEORY.md`, `DSP_MODELS.md`
- `research/EVIDENCE_LEDGER.json`

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Research conclusions with sources and conditions, versioned claims, verifiable engineering recommendations, and unresolved questions.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

`npm run validate:research`; send important formulas to acoustic-validation. Passing index checks does not establish physical correctness.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

When sources conflict, full text is unavailable, or licensing is unclear, record PARTIAL/UNKNOWN and the readable evidence; do not fabricate values. Continue research without those dependencies.
