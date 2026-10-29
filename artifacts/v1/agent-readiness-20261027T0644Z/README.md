# Protected CLI readiness failure investigation

The full-quality attempt at `artifacts/v1/clean-quality-20261027062839273` failed 1 of the original 75 agent tests. The protected test and all timeout/polling constants were unchanged throughout this investigation.

## Actual failed fixture

- Fixture: `.cache/agent-cli-tests/case-n9bRaf`; run `e542a752-fa92-40f2-827a-dd3937071260`.
- Created: `2026-10-27T06:28:55.152Z`.
- Implementation-started event: `06:28:55.549Z`, revision 4, before process spawn.
- Its state temp file was created `.554Z` and written `.556Z`; rename to `state.json` failed `EPERM`.
- Error checkpoint recorded `.776Z`; final durable state `BLOCKED / EXECUTOR_ADAPTER_ERROR` at `.778Z`, revision 5.
- No `workspace/answer.mjs` or executor log exists; mock subprocess never launched.
- The protected readiness assertion later failed after its unchanged `200 x 25ms` polling. Increasing that poll duration cannot repair this failure.
- `original-failure.json` preserves a safe state projection, raw event objects, file timestamps and hashes. Owner tokens and other lock contents were excluded.

## Trace and independent review

`scripts/agents/store.mjs` atomic writes a unique temp then calls `renameSync` once. `saveState` writes its event before atomic state replacement and updates the in-memory state after it. `scripts/agents/engine.mjs` saves `implementation-started` before `runProcess`. Therefore the event can exist while process startup failed. A separate read-only reviewer confirmed this trace and that the residual temp is RUNNING_MUSE revision 4. Event sequence 4 appears for both the orphaned implementation-started event and the recovery checkpoint; this is consistent with failure before `Object.assign`.

The actual holder denying rename is unknown. Polling reads, antivirus/indexer and scheduling have not been individually attributed. `--test-concurrency=1` would preserve original coverage and test-internal concurrent cases but cannot alone repair state replacement failure.

## Bounded unchanged exact test

Exactly one isolated run of the protected matching test was performed. It passed 1/1 in 1918ms (2088ms receipt wall time), with unchanged source hashes, actual preserved partial file, final CANCELLED, and process_stopped=true. This confirms the defect is intermittent, not fixed. `verification.json`, stdout/stderr, source hashes and `run-exact.mjs` retain reproducible details. This is MOCK control logic evidence only.

## Minimal proposed repair (not applied)

Bound retry only of the already-written unique temp's atomic rename on Windows transient EPERM, for a small finite delay budget. Keep the same temp and destination, never unlink the target or directly overwrite state, and retain the final error on exhaustion. Nontransient errors and non-Windows paths must retain immediate failure. An independent fault-injection regression should verify recovery, intact old state during failure, finite exhaustion and propagation; protected tests and polling/timeouts remain unchanged.

No production source, test, package, Wiki or Git changes were made by this investigation. No real Muse/Meta/API/browser operation was used.
