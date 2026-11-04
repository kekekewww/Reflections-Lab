<!-- english-source: {"path":"docs/15-ui-parameter-audit/render-tail-validation/REPORT.md","sha256":"e347ac3d613a7e7218231331ced1503e683934f6d9217848e5a3c930a92b4aa7","translated_at":"2026-11-02T11:57:47.1112717+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/render-tail-validation/REPORT.md`](../../../15-ui-parameter-audit/render-tail-validation/REPORT.md). Source SHA-256: `e347ac3d613a7e7218231331ced1503e683934f6d9217848e5a3c930a92b4aa7`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="尾響草稿無效時阻止產生音檔"></a>
# Block audio generation while the tail draft is invalid

Scope: Task0028's Render tail-draft workflow. The new worktree is inside the project at `D:/Developing/Meta Hack/.worktrees/render-tail-validation`, based on `b6fec5b012f6491feeded81d63d43ca04d185a52` (same product as `9fcf3f0`). The integration worktree, running browsers and shared Git index were not modified.

<!-- english-original-anchor --> <a id="問題與結果"></a>
## Problem and result

NumberField already correctly rejected invalid 10.5: the last committed 0 was not overwritten, and the manifest correctly used 0. Data integrity was intact. However, the UI still displayed red 10.5 while allowing audio generation with old 0, creating P2 ambiguity in user intent. Original Render tests and their PASS results remain unchanged; this repair additionally handles interaction feedback.

| Before | After | Why |
| --- | --- | --- |
| An invalid tail draft still allowed Generate audio; the job used the old committed value. | Invalid drafts immediately disable generation; the handler also checks a synchronous ref and shows correction/Esc-restore guidance. | Prevent a mismatch between displayed parameters and intended output for this job. |
| The shared field reported only valid numeric submissions outward. | Add an optional raw-draft-validity notification, consumed only by Render. | Retain Enter, blur, locale, IME and Esc policies for other fields. |

<!-- english-original-anchor --> <a id="實作邊界"></a>
## Implementation boundaries

- Validity retains finite-value, min/max and truthy `invalidReason` checks; it does not use the `invalid` flag that input clears.
- Do not use HTML `stepMismatch`: 0.25 seconds remains legal; 0.5 is only the increment/decrement step.
- Input, commit and Esc notify synchronously. Prop updates evaluate `dirty ? draft : String(value)` rather than a stale string.
- Render uses a stable callback, state and ref. It does not change committed values, clamp or reset fields. Three-second recording remains independently operable.
- No design tokens, packages, serialized fields or site-wide submission policies were added.

<!-- english-original-anchor --> <a id="已執行的有限驗證"></a>
## Executed bounded validation

| Command/scope | Result | Original receipt |
| --- | --- | --- |
| NumberField policy + pipeline SSR | 14/14 PASS, 0 skipped; includes 2 new raw-validity cases and original submission/locale/IME cases | [focused](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/60083e85c21fa88349f5a63387fe39c2783734ea) |
| TypeScript `tsc --noEmit` | exit 0 | [typecheck](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e69de29bb2d1d6434b8b29ae775ad8c2e48c5391) |
| Four-file ESLint/Prettier | exit 0 | [lint](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e69de29bb2d1d6434b8b29ae775ad8c2e48c5391), [format](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bd88548b1f53ae8837325bfd8b859dbe57b4a24) |

Pinned source/preimage hashes and commands are in [verification](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3525028d6abccbb14170d66539b5986d7ad33281). Independent review is static source review, not browser testing.

<!-- english-original-anchor --> <a id="整合後必驗"></a>
## Required post-integration validation

On the new bundle, the main agent must actually test 10.5/empty/nonfinite values, continued editing that leaves a draft invalid, Esc restoration, legal 0/0.25/10, locale changes and busy states. Confirm invalid drafts publish no new job and that manifests use actual committed values after recovery. This branch did not start Chrome, so these actual-DOM checks are NOT RUN here; this also does not establish acoustic, hearing or performance acceptance.
