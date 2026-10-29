<!-- english-source: {"path":"artifacts/v1/support-anchor-20261027/review/REVIEW.md","sha256":"21032a1c5d69ab9457d4b8ace9cf9786290b08e934667c1dc984032af580e697","translated_at":"2026-10-27T07:11:29.9844710Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/support-anchor-20261027/review/REVIEW.md`](../../../../../../artifacts/v1/support-anchor-20261027/review/REVIEW.md). Source SHA-256: `21032a1c5d69ab9457d4b8ace9cf9786290b08e934667c1dc984032af580e697`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="support-anchor-獨立審查"></a>
# Support Anchor Independent Review

Conclusion: no P0/P1/P2 findings requiring fixes within the scope of this change.

- Reviewer: `/root/v1_support_anchor/support_anchor_review`; did not modify product code, tests, acceptance criteria, Git, Wiki, or packages.
- Frozen product source: `src/app/physics-behavior.ts` SHA256 `de6616fbf5d2c094dc57cf510671c9f0b414f733412fbd250bcf4ee881387f20`.
- Frozen new tests: `tests/app/support-anchor.test.ts` SHA256 `8841718a47d251529f1b6c9c1529ff2c901901a22bf1a556422ccad83631d217`.
- See [verification.json](../../../../../../artifacts/v1/support-anchor-20261027/review/verification.json) for independent commands, exit codes, all scoped dependency hashes, and stability before/after execution.

`PhysicsWorld.poses()` selects a representative contact based on each object's own support and sliding state. However, the original adapter ranked contacts again by global impulse, allowing another patch/discrete impact to replace the point selected by the producer. The fix takes `pose.contact` first and uses the existing ranked fallback only when no point has been selected, matching this allocation of data responsibility. Discrete events continue to be copied from `event.contact`, without being overwritten by continuous-state contacts.

Manually checked the producer's support/sliding point selection, contact velocity from `vCOM + omega cross r`, independent contacts for BehaviorRuntime discrete and continuous candidates, material override, and parent event association. The change does not modify point velocity, force/impulse units, SourceGraph routing, clocks, or propagation delay. The new fixture's values are explicitly Synthetic adapter inputs, not evidence of actual Rapier rolling classification while simultaneously hitting a wall.

Independent process results:

- `node --import tsx --test tests/app/defaults.test.ts tests/app/support-anchor.test.ts`: 17/17 PASS, including the unchanged support regression and actual Rapier falling-ball case.
- Scoped ESLint: PASS.
- Scoped Prettier check: PASS.
- Hashes of sources/tests/protected acceptance files and listed dependencies were all stable during execution.
- Adjacent regressions: `contact-emission.test.ts`, `motion-hysteresis.test.ts`, and all `tests/audio-behavior/*.test.ts`, totaling 50/50 PASS; includes the actual Rapier floor/wall high-slip point selection case. See [adjacent-verification.json](../../../../../../artifacts/v1/support-anchor-20261027/review/adjacent-verification.json) for the fully expanded command and hashes; raw stdout/stderr are saved separately.

The original RED record has 5 FAIL results among 17 cases, including the existing defaults regression and four new regressions; the fallback case was already PASS. The red/green scope and failures are all explicit, and acceptance thresholds were not changed.

Limits: this review confirms only the adapter and logical behavior emitter/provenance fix. It did not run the full runtime/project-wide check, actual browser Inspector, DSP routing/acoustic numerical checks, headphone hearing tests, or performance acceptance. It does not mean that all gates for V1-EVT-01, V1-AUD-01, V1-UX-04, or the first version have been completed. Other concurrent changes were not reviewed.
