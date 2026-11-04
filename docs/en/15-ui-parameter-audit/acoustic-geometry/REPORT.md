<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/REPORT.md","sha256":"23f0fd97e1da7a8f8185462db3f417dd902dd3bda4ab92c8d66dc8dad33f94df","translated_at":"2026-11-02T09:44:46.667Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/REPORT.md`](../../../15-ui-parameter-audit/acoustic-geometry/REPORT.md). Source SHA-256: `23f0fd97e1da7a8f8185462db3f417dd902dd3bda4ab92c8d66dc8dad33f94df`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="task0030-曲面與移動反射器交付階段"></a>
# Task0030 curved-surface and moving-reflector delivery stage

This worktree has implemented a working bounded core and basic verification. It does not claim full V1, manual testing or the user's all-interface acceptance complete. Root will first merge Zone caller connections, then this branch, and perform complete check/browser/recording and per-file WAV export together.

<!-- english-original-anchor --> <a id="實作內容"></a>
## Implementation

- Sphere/capsule Inspector material and acoustic-role controls are editable, retaining existing styles, run-state editing locks and fixed/static role conditions. UI tests are actual React SSR and semantic assertions, not browser clicks.
- Analytical closed-sphere/capsule occlusion and first-order specular positions use actual geometry and bounded iteration. Planar/curved dynamicReflector reflections use actual current poses. Enabling a role does not simply bypass the solver.
- All geometry shares the original maxSurfaces=256. The mixed105-object case uses analytical box occluders to retain124 items without relaxing caps/references/tolerances.
- New request/worker boundaries support primitives/boxOccluders/modelVersion with exact backend/model-version/path-prefix/identity/budget checks. Invalid replies fail the entire batch closed and terminate transport.
- Every source in a Scene pins the actual model. Older planar requests retain their original version and omit empty new fields. Saved AudioReplay retains original paths; reevaluation requires the same model.
- Sound ownership and physical self-exclusion are separate: omitted emitterObjectId uses the original owner, null means detached, and a string identifies a trusted existing body. An explicitly emitting dynamic body cannot bypass valid-pose requirements.
- Every new recording includes the same caller policy explicit-emitter-body-v1. Old fixed/zone baselines without that pin reject new reevaluation. Same-version object→fixed behavior comparison retains the original contract; policy differences yield an explicit mismatch through the existing solver hash.
- The formal Evidence Ledger adds only6 sources and CG-REF-001–005 without overwriting older claims. Complete conditions are in [MODEL_CONTRACT](MODEL_CONTRACT.md).

<!-- english-original-anchor --> <a id="實際驗證"></a>
## Actual verification

The listed suite scopes overlap and are not a new combined acceptance total.

| Execution | Read result | Original receipt |
| --- | --- | --- |
| Final affected suite: all acoustics-runtime, service, builder, model/replay, Host, processor, ownership and policy |171/171 PASS,0 skip, exit0 | [focused-delivery-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/23b5864e15eb719bc12e0cfbe4c12d6d109d8870) |
| Existing analytical acoustic references |17/17 PASS, exit0; old formulas/tolerances unchanged | [analytic-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e1ccdaa2db670a36837c1be35f7a866f94ee63cd) |
| Nine independent exact/value-only curved references +15 kernel/OBB cases |24/24 PASS; sources and author relationships are explained in review | [math-final-review](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c55040d7224e98e6f7750d4aa4f0e785d7152e6e) |
| Original mixed105-object performance regression, fixture unchanged |1/1 PASS,14.06 s; only this case, not overall performance acceptance | [mixed105-regression](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/0140a9727b79c8ab975889d125ae4f9073c385bb) |
| New data/worker fault contract |13/13 PASS | [geometry-contract](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c6aa748d62476a7e013be07d3c5c5811444368cb) |
| Pure-box fixed legacy replay/policy rejection/same-version behavior comparison |10/10 PASS; actual Rapier/Behavior/solver/Recorder. Replay uses FakeAudioContext, not native PCM | [policy-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/45c7d5c1cc335ab741fafeb04be5e36670974bb3) |
| Production build including tsc |exit0; existing Vite large-chunk notice retained | [build-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5aa37cca69f499922fe38a59c542dbc04b56ef46) |
| Whole-repo ESLint/affected Prettier |exit0 | [lint-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/e6a9874850b905a86429255b297609bf5ab81ecc), [prettier-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8bd88548b1f53ae8837325bfd8b859dbe57b4a24) |
| Research metadata |PASS:88 sources/79 claims/13 fixture references | [ledger-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/985eba48ac71a10f58e6b17477123b3427850f55) |
| Expanded npm test |650 PASS/12 FAIL, exit1; all are historical-artifact ENOENT in this sparse worktree (original English receipts/context pins). Not PASS | [research-regression-final](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9c12a67cabd06c5fe67debd174a61b1bbc916680) |
| Initial complete test:runtime |PARTIAL/stopped: actual105-budget regression, incorrectly pinned older metadata fixture and prolonged noncompletion. No overall PASS. Original TAP and owned-process termination records retained; Root reruns the final complete suite in integration | [runtime-initial](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1725af67bba946d2de7650cef62d7a6a947f2d3a), [stop-owner](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/4deb357cf216a8c2900a588d7b2596449a443520) |

Final focused command: node --import tsx --test tests/acoustics-runtime/\*.test.ts tests/app/acoustic-service.test.ts tests/app/acoustic-curved-delivery.test.ts tests/app/acoustic-model-recording.test.ts tests/app/acoustic-primitives-input.test.ts tests/app/acoustic-input-ownership.test.ts tests/app/experiment-tools.test.ts tests/app/recording-processor.test.ts tests/app/emitter-geometry-policy.test.ts.

<!-- english-original-anchor --> <a id="原失敗與修正保留"></a>
## Retained original failures and corrections

The105-object case initially produced an actual budget failure at289 items. Switching to exact OBB occluder representation makes that original case pass without deleting spheres/capsules. Old unsupported expectations were updated precisely for the user's expanded scope; original content and FAIL remain under builder/history, builder/legacy-contract-before-update.txt and builder/\*pre-expansion.raw.txt.

An independent probe originally showed that an incorrect Worker backendVersion was accepted: [original](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/67629c40ad7efb855991f297d8d5e0d86fbe105f). After correction, the same [final probe](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/46593d7e2766352ac293f65f7caa120d6b416c78) explicitly rejects it, completed=0, failed=1, transport terminated. Placeholder fixture metadata such as backendVersion=1.0.0/global older versions now uses the actual Scene model. Original contents are in evidence/metadata-preimages; the first eight FAILs remain in evidence/metadata-final.txt, and the corrected50/50 is in metadata-rerun.txt. No mathematical answer or tolerance changed.

The new policy fixture initially captured from tick0, violating the existing replay clock. The original receipt remains; the fixture now captures from tick1 after a real physics.step, without relaxing the replay guard. These files are before/after source snapshots from this implementation; f6base Git HEAD is not presented as a commit containing then-uncommitted changes.

<!-- english-original-anchor --> <a id="整合交界與下一步"></a>
## Integration boundaries and next steps

1. Merge capability_core's Zone caller/helper, already obtained by Root at12786c74. Trusted rule/profile attachments in Runtime, Host fresh/preview and RecordingProcessor determine null/object exclusions. This worktree only supplies the three-state builder and policy version; it cannot independently claim unmerged callers complete. The independent policy fixture explicitly passes null to the actual builder for detached emission. New same-version comparisons show no false metadata rejection, not end-to-end acceptance of unmerged callers.
2. Root runs all runtime/check suites in the complete integration checkout, with historical artifacts and caller proof after Zone/curves merge. Sparse-worktree ENOENT does not justify changing validators or oracles.
3. Old browser ui-refined-v2 sphere-unsupported expectations require retained preimages/FAIL before user-amendment updates. Actually click material/role/dynamic-pose/capture/replay/export through the complete flow. Root exclusively holds the browser lease; this branch ran no Chrome/native audio/actual WAV export.
4. Claude Code revalidates, followed by user manual testing.

<!-- english-original-anchor --> <a id="v0v5與限制"></a>
## V0–V5 and limits

V0 PASS is local evidence for specified contracts/negative cases/metadata/schema-compatible shapes. V1 PASS covers specified independent analytical/numerical and engineering-formula subcases. V2 has only FakeAudioContext and loopback-worker transport connections; actual browser PCM waveforms are NOT RUN. V3 external independent acoustic-solver/full-wave verification is NOT RUN. V4 formal device deadlines/full performance is NOT RUN; one Node case's timing is not elevated. V5 human hearing/calibrated RIR/SPL is NOT RUN.

Curved amplitude remains a bounded ray-path magnitude1/r×sqrt((1-s)R), without curvature divergence/focusing/caustics, diffraction, thick-solid transmission, surface waves, coherent interference, low-frequency full-wave behavior, retarded time or moving-boundary Doppler. Scattering redistribution is not rendered and is not treated as extra absorption.
