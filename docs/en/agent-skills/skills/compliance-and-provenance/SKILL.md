<!-- english-source: {"path":".agents/skills/compliance-and-provenance/SKILL.md","sha256":"f7c739648296275efd8d55cb6aa3cb53555477f087442dd5bd8af15048e9d6b5","translated_at":"2026-10-27T03:37:45Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: compliance-and-provenance
description: Check Reflection Lab competition rules, third-party licenses, dataset and sound-effect rights, and provenance of existing work; do not accept terms or submit on the user's behalf.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/compliance-and-provenance/SKILL.md`](../../../../../.agents/skills/compliance-and-provenance/SKILL.md). Source SHA-256: `f7c739648296275efd8d55cb6aa3cb53555477f087442dd5bd8af15048e9d6b5`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="規則與來源"></a>
# Rules and Provenance

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

When adding dependencies, assets, or data, changing a competition schedule, or preparing a submission, verify conditions and provenance responsibilities.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

Official event/rules URL, dependency version/hash, intended data use, source authors, and evidence of account status.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read docs/01-compliance and PROJECT_PROVENANCE first; check the latest official terms and preserve the verification time/version.
2. Classify explicitly permitted, prohibited, conditional, and unconfirmed items; silence does not mean permission. Keep marketing, formal waivers, and submission content behind login separate.
3. Compare application and project deadlines, ET/EST/DST; preserve ambiguity in Taipei conversions and plan safely around the earlier time.
4. Review each license, NOTICE, trademark, and data right; a metadata inventory cannot replace a full redistribution review.
5. Do not redistribute restricted full text, SDK caches, or unauthorized sound effects/HRTFs; record the current AI assistance and assets predating formal development.

<!-- english-original-anchor --> <a id="references"></a>
## References

`docs/01-compliance/`, `docs/00-project/PROJECT_PROVENANCE.md`, `research/datasets/DATASET_CATALOG.md`, `docs/03-sdk/SDK_LICENSE.md`.

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Updated registers, classification of terms, provenance, unconfirmed items, and concrete conditions for resolving them.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

Check readable official source content and the current lockfile/hash; do not infer selection or acceptance without checking the account. Rerun the inventory for a new version.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Mark inaccessible or incomplete terms UNKNOWN and continue research and isolated spikes; do not register, accept legal terms, or submit without authorization. These actions are handled by the user personally.
