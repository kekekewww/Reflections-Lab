# Windows atomic state publication repair

## Confirmed defect and narrow change

The retained failed fixture is `.cache/agent-cli-tests/case-n9bRaf` from full-quality attempt `clean-quality-20261027062839273`. At `2026-10-27T06:28:55.55Z`, state publication failed with Windows `EPERM` during the temp-to-state rename, before `runProcess` could launch the mock. The exact lock holder remains unknown.

`scripts/agents/store.mjs` now retries only `renameSync` of the same already-written unique temp to the same destination when platform is `win32` and error code is `EPERM`. There are at most six attempts with requested waits of 5, 10, 20, 40 and 80ms (155ms total). OS scheduling may make elapsed wall time longer. The original first EPERM object is thrown after exhaustion. A non-EPERM error, including one after a transient EPERM, propagates immediately; other platforms do not retry. The target is never removed or copied over; temp creation occurs only once. No permission or ACL changes are made.

## Verification scope

New regression source: `tests/agents-store/atomic-rename.test.mjs`, outside the original protected 61 files and the original agent-suite glob. Fault injection replaces only the rename fault boundary and synchronous waiting; old-target reads, temp writes, eventual successful rename, parsed JSON and integrity hashes are real filesystem operations. Tests also exercise state/event publication with real files. Monkeypatches are restored with `finally` in the independent Node test process.

Before production change, the new suite produced the expected RED result: 2 PASS / 5 FAIL because the original implementation had no retry. Raw output and all 61 protected hashes are retained in `red/`.

The green runner separately executes new seven regressions and all original test files covering the unchanged 75 cases, without serializing away test-file concurrency. It records raw command/stdout/stderr, exit/duration, runner/source hashes, and all 61 protected hashes before and after. It does not invoke a real model, Muse, Meta API or browser. No direct Git/Wiki operation was performed by the investigation; the unchanged original tests retain their existing snapshot internals.

## Permanent failure remains an explicit error, not an event-chain repair

`saveState` still writes an immutable event before replacing state, then mutates the caller's revision/last_event after successful replacement. After permanent rename failure, the durable old state remains valid, the caller's revision/last_event do not advance, and the unpublished state temp plus orphan event remain available. A caller may already have changed status/resources in memory before entering `saveState`; no stronger rollback guarantee is claimed.

The existing `engine.mjs` adapter-error catch attempts a checkpoint and a new blocked event using the unchanged revision. If the Windows denial clears only after the retry budget is exhausted, those recovery writes can reuse the orphan event's sequence. This patch does not repair or retrospectively reconcile that duplicate sequence. The regression checks preservation and error propagation, not a false recovered chain.

A separate narrow fail-closed follow-up should classify an exhausted state-publication error and stop the current run before adapter recovery writes another checkpoint or state event. Preserve its original error object and failed event/temp identifiers, report a nonzero process result, and require explicit recovery that audits the current durable head and orphan files before any new event. Before later mutating operations, reject unresolved orphan/fork events relative to the durable head while keeping read-only diagnostics available; a catch-only change would not prevent a later stale-state resume. A broad transaction rewrite or automatic event deletion is not proposed here. No such additional production change is included in this repair.

## Change ownership and limits

Only `scripts/agents/store.mjs` and the new regression file are product/test changes. The original 61 protected files, original 75 test cases and all timeouts/expectations are untouched. Source freeze and independent read-only review are required before the green run. This is offline legacy Harness robustness evidence and does not establish formal V1 product completion.


## Frozen green result

`green/verification.json`: new regressions PASS 7/7 (186ms command wall time), unchanged original suite PASS 75/75 (35,474ms command wall time), fail0 and skip0 for both, both stderr files empty. All 61 protected hashes matched before and after; all source hashes in the declared validation scope were stable. No test-file serialization flag was used. Independent read-only review found no blocking issue at the exact frozen source hashes retained in `independent-review.json`.

Production source SHA256: `fe0d65d3b4d0deb985698f0282e403d80a9fe2c858b66b7185daee813faa18da`.
New regression SHA256: `275afd0fc6bba2f3a905166bad8fc6381908c0f9ed3bdbc6be57a6eec10f705c`.

Root was notified HARNESSEND after reading both raw TAP summaries and empty stderr. Root owns adding the new regression glob to the package quality command and rerunning full quality; this repair's final source/test files are frozen.
