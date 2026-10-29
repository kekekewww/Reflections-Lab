<!-- english-source: {"path":"artifacts/v1/sound-diagnostics-20261027/README.md","sha256":"0a3c8dffc23d7e57cdcdc38460e0e33b3be48f3aca82986edfe13ec1ca48730d","translated_at":"2026-10-27T07:15:06.1949702Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/sound-diagnostics-20261027/README.md`](../../../../../artifacts/v1/sound-diagnostics-20261027/README.md). Source SHA-256: `0a3c8dffc23d7e57cdcdc38460e0e33b3be48f3aca82986edfe13ec1ca48730d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior-診斷切片"></a>
# Sound Behavior Diagnostics Slice

Date: 2026-10-27. Executor: Codex; no Muse/Meta/other paid model calls, and no server, browser, or deployment was started. This is the sound decision diagnostics slice of V1-UX-04; it does not mean that the complete first version or all of UX04 has passed.

`review-freeze.json` freezes the 12 implementation/new test sources for the initial independent review; `review-freeze-r2.json` freezes the final delivery after the two independent findings were fixed. `preimage.json` and `preimage/` preserve the 6 existing files from before this change; other agents and existing uncommitted changes are present in the workspace, so the entire Git diff cannot be attributed to this slice. The baseline HEAD is `e6b898c30193e8cd9e5ef9ddc2f1e6bcb8aee313`; no new commit or push was made.

<!-- english-original-anchor --> <a id="範圍"></a>
## Scope

- When not recording, project the engine's actual `BehaviorStepResult.decisions` into the event table and latest rule diagnostics. Preserve tick, sequence, binding/rule/input/instance IDs, and the raw reason; obtain actual sound emission positions only from real AudioEvent data.
- IDs for rejection rows are generated from the epoch and semantic identity; duplicates with the same semantics in the same step are merged while preserving occurrences. Continuous updates refresh the latest rule state without filling the event table at every step; event history and the latest rule cache each have a 512-entry limit.
- Disabled is an existing author setting, displayed as RULE_DISABLED/BINDING_DISABLED, without fabricating engine rejection events. EMITTER_UNAVAILABLE for missing contact retains its original code, without substituting COM for the sound emission position.
- Input contact data and actual sound emission positions are presented separately. The original codes for cooldown and global, object, and rule voice limits all have Traditional Chinese/English explanations; unknown reasons remain in their original form.
- Replay projects recorded decision/config/input/audio data without reevaluating rules; original physics/audio events, recording hashes, and schemas are not rewritten. A new epoch clears the latest rule state.

<!-- english-original-anchor --> <a id="執行與證據"></a>
## Execution and Evidence

| Command/evidence | Result and limits |
| --- | --- |
| `node --import tsx --test tests/app/behavior-diagnostics.test.ts`, `red.log` | RED: 17 actual AlwaysOn bindings exceeded the 16-voice limit, but the old UI read model had no rejection rows. |
| Same command, `green-initial.log` | GREEN: minimal case 1/1. |
| `node --import tsx --test tests/app/behavior-diagnostics.test.ts src/ui/behavior-diagnostic-text.test.ts src/ui/locale-model.test.ts`, `green-expanded.log` | 11/11; actual Rapier repeated-collision cooldown, original collision/contact, captured replay, disabled, missing contact in the actual evaluator, semantic identity/cache limits, bilingual text/unknown original text. |
| The above plus `tests/app/runtime.test.ts tests/app/defaults.test.ts`, `green-adjacent.log` | 26/26; includes support contact adapter regression after another agent's fix. |
| `eslint` for the owned 12 files, `lint.log` | PASS. |
| `node node_modules/@playwright/test/cli.js test --config tests/browser/sound-diagnostics.config.ts --list`, `browser-list-only.log` | 2 new cases can be listed, without starting a browser/server; actual browser **NOT RUN**. |
| `node scripts/setup/emil-skills.mjs --check`/`--standards` | PASS; only static verification of pinned skills/design standards, not a visual or performance pass. |
| `protected-comparison.json` | SHA256 hashes of all 61 original frozen acceptance files match; this change did not relax the original tests. |
| `review.json`/`independent-review.log` | The isolated agent's fresh 26/26 and original 12 hashes matched, but two extra probes found that disabled reasons were not displayed and that unknown prototype keys caused pollution, so the initial review was NEEDS_REPAIR. |
| `review-repair-red.log` → `review-repair-green.log` | Added reproducible regressions: 1 PASS/2 FAIL before the fix, 3/3 after. Disabled reasons are actually visible; constructor/toString/__proto__ all remain unknown raw strings. |
| `review-r2.json`/`independent-review.log` | Final isolated review PASS_SCOPED: fresh 27/27, lint PASS for fixed files, and 12 r2 hashes matched before/after tests and extra probes. Extra verification covered 4 bilingual visible disabled reason cases, 6 unknown prototype key cases, null stop context, and leaving original inputs unchanged. |

Earlier failures are preserved: `initial-invalid-fixture.log` records an invalid test configuration that misused AlwaysOn/contact and was rejected by the production validator with CONTACT_EMITTER_REQUIRED, after which it was replaced with the valid 17-binding case; validation was not relaxed. The first expanded test run had one assertion expecting an existing empty-string error to be undefined; it was changed to "no error." The command output is in this task's tool conversation; `intermediate-failures.json` records that failure. `typecheck-initial.log` preserves this slice's optional-field type errors, which have been fixed; subsequent errors in `typecheck.log` only list static-preview.ts, which another agent was implementing at that time, and cannot be treated as a complete typecheck PASS. The root runs the full check/build after the integration freeze.

<!-- english-original-anchor --> <a id="瀏覽器補充案例"></a>
## Supplementary Browser Cases

`tests/browser/sound-diagnostics.spec.ts` uses the public runtime API to configure 17 actual bindings or 230 actual Rapier fixed steps, then operates filters, event selection, contact information, and language selection in the real UI to verify that IDs/ticks/documents do not change with locale. There are no mocked decisions, DOM, or sounds. The root must build the same fixed bundle before scheduling execution; currently there is only list/parse evidence, which cannot be recorded as an actual browser PASS.

<!-- english-original-anchor --> <a id="尚未宣稱"></a>
## Claims Not Made

There are no actual hearing/PCM/performance measurements and no static 3D preview. This agent does not change the acoustic/math/physics/audio core or frozen acceptance criteria. The complete product, performance, external rights, and paid live gates remain tracked individually under the original acceptance criteria.

After the final review, write ownership of runtime/UI/contracts was returned to the root and then transferred sequentially to the static preview integration agent. The r2 hashes are source evidence for this diagnostics slice's delivery boundary; subsequent integration may modify the transferred files. The root saves later global check, bundle, and actual browser evidence separately, without overwriting this evidence of limited scope.
