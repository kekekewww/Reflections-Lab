<!-- english-source: {"path":"artifacts/v1/pointerlock-race-20261027/README.md","sha256":"f8e67abad552ef35e9f45c8fa7682d20f9dd0c06d67dbeda05f4adc5852cf8d3","translated_at":"2026-10-27T09:11:16.0068969Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/pointerlock-race-20261027/README.md`](../../../../../artifacts/v1/pointerlock-race-20261027/README.md). Source SHA-256: `f8e67abad552ef35e9f45c8fa7682d20f9dd0c06d67dbeda05f4adc5852cf8d3`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="pointer-lock-首次-enter-通知競態修補"></a>
# Pointer Lock First-Enter Notification Race Fix

The scope is limited to the bug where the first explicit Enter cannot resume when the native canvas already owns Pointer Lock but the application has not yet received `pointerlockchange`. The original naturally occurring failure is preserved in `../ui-current-functional-20261027T084051223Z/`; this directory does not mean that the complete first version is finished.

| Before | After | Why |
| --- | --- | --- |
| Enter directly requests host Run, but the host has not yet confirmed the lock | A valid Enter synchronizes actual canvas ownership after the existing IME/input field/modifier/repeat/native ownership checks | Accept the first separate explicit Resume; calling request is not treated as success |
| A late identical notification clears host keys/buttons again and resets the release barrier | Return before all side effects when ownership is unchanged | Preserve held movement and the actual release requirement |

`red/results.json` is the controlled notification-delay regression for the pre-fix `920aafb9…` bundle: 1 case FAIL as expected, 1 case PASS. Fault injection delays only delivery of the application callback; actual Chrome ownership and the original trusted native events are retained, without replacing getters/APIs or dispatching fake events. The original RED report was written to `tests/browser/test-results/` because the reporter used a relative path; both the original file and the portable copy here are preserved. Only the reporter destination was changed to an absolute path before GREEN; assertions were unchanged.

`green/results.json`: the same tests 2/2 PASS, confirming the first Enter, continued holding of W across a late notification, no object throw when acquiring lock, the release barrier while holding the left button during pause, exactly one throw from a new click after release, no resume without native ownership or with Ctrl+Enter, and Tab exit. `original/results.json`: the unmodified original UI case 1/1 PASS; its actual events still have Enter preceding the native notification by approximately 150 ms, so success is not based only on injected cases. GREEN and the original case are tied to the same `5e7c61be…` source/bundle, with stable sources before/after; `tested-bytes-archive.json` indexes the portable bundle and fixed harness bytes.

Type checking, ESLint/Prettier for 3 files, and 8 adjacent input policy/release ledger tests all exited 0. See `independent-review.json` for the isolated read-only review. Later, with explicit root authorization, only the comment about the confirmation source in `interaction-host.ts` was updated; `host-comment-equivalence.json` proves the exact single-comment replacement and completely identical TypeScript compilation output with comments removed. The actual browser evidence above still refers to the fixed historical bytes from before the comment change; the root runs the full check and all functional regressions for the current version afterward.

`infrastructure-sandbox-attempt1/` preserves the record of a sandbox startup timeout with no assertions executed; `original-no-tests-found/` preserves the failure where the first title selector selected 0 cases because of Playwright's filename prefix. Neither counts as a pass. `cleanup-final.json` confirms that this task's owned processes and the 5174 listener were all closed. During diagnostics, one read-only process tool output was too broadly scoped; that output was not saved as a project file, subsequent queries were limited to this task's exact PIDs, and it is not included as source evidence.

This slice makes no claims about the complete 27-case UI suite, full npm check, performance, OS IME, manual hearing tests, or complete V1 completion status. See `verification.json` and `proof-receipt.json` for final detailed bindings.
