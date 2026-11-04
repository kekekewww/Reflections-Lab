<!-- english-source: {"path":"docs/15-ui-parameter-audit/AMENDMENT_UNSUPPORTED_OPTIONS_20261102.md","sha256":"6fa38f4180ce2fbce92b5b321565a167f40344ce26ec2ccd9531a43a0366c060","translated_at":"2026-11-02T07:14:53.3918484+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/AMENDMENT_UNSUPPORTED_OPTIONS_20261102.md`](../../15-ui-parameter-audit/AMENDMENT_UNSUPPORTED_OPTIONS_20261102.md). Source SHA-256: `6fa38f4180ce2fbce92b5b321565a167f40344ce26ec2ccd9531a43a0366c060`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ui參數審核補充實作尚未支援的選項"></a>
# UI parameter audit amendment: implement unsupported options

Date: 2026-11-02 (Taiwan time). The user explicitly answered, "Also implement the options that are not yet supported"; see the [formal source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1863912da15dd68ade3ee77d87fb9cff0307e4f8). This amendment takes precedence over the original SCOPE_PENDING in [this round's contract](CONTRACT.md) and corresponding unsupported-scope limits in the six-core contract for this round. Retain the original six-core point and test results without rewriting history. Task0028 remains the sole official task; do not create a parallel task system.

<!-- english-original-anchor --> <a id="現行要求"></a>
## Current requirements

1. Fully inventory visible unsupported options and their explanations. Distinguish missing product implementation, legitimate state/data prerequisites and external account/device/permission gates for each item. Do not rename an implementable gap an external gate or close the task by listing future plans alone.
2. Complete actual implementation of options missing product capabilities, covering data/authoring settings, real runtime producers, shared capabilities and relevant UI/AI/Preview/Host entry points. OnZoneEnter/OnZoneExit require actual zone authoring and real event producers. Removing disabled status or using synthetic events cannot count as success. Verify the technical design against Domain/schema/ADRs separately.
3. Existing five-lane testing and repair of exposed parameters continues. After adding features, refresh the static denominator/source pins/crosswalk, retain initial versions and original FAIL results, and retest affected valid/invalid/boundary cases, states, persistence/undo and applicable actual production-DOM workflows. Unexecuted combinations remain NOT RUN.
4. For remaining genuine external prerequisites or unexecutable gates, preserve each verified reason, conditions for resolution and implementation/validation status. Do not falsely enable features or record missing account/device evidence as PASS. External gates authorize neither paid usage nor increased Meta budgets.
5. Task0028 and local main must await new implementation and necessary revalidation. Judge Claude's later independent validation, original 600-second performance FAIL, science/device/Meta-live and external requirements separately.

<!-- english-original-anchor --> <a id="授權與實際狀態"></a>
## Authorization and actual state

The added implementation requirement is confirmed; this does not mean any new capability is complete. Root is arranging a full unsupported-option inventory and Zone/other implementations while the original five-lane audit continues. This round remains IN_PROGRESS, budget 0, with no push/deployment/new paid requests. The earlier native Computer Use app approval timeout boundary is unchanged.
