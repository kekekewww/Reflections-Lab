<!-- english-source: {"path":"artifacts/v1/support-anchor-20261027/README.md","sha256":"70da982e0c63d521ff4e8cd6d2c050d7d3bc13ed7e8646aed222566b763d3113","translated_at":"2026-10-27T07:11:29.9844710Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/support-anchor-20261027/README.md`](../../../../../artifacts/v1/support-anchor-20261027/README.md). Source SHA-256: `70da982e0c63d521ff4e8cd6d2c050d7d3bc13ed7e8646aed222566b763d3113`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="support-contact-anchor-regression-修復"></a>
# Support Contact Anchor Regression Fix

2026-10-27. This evidence covers only the adapter behavior in `src/app/physics-behavior.ts` and the logical behavior emitter. It does not mean that the complete first version or V1-EVT-01/V1-AUD-01/V1-UX-04 has passed.

Root cause: `PhysicsWorld.poses()` already selects `pose.contact` based on each object's support/sliding state. The original `representativeContacts()` then globally ranked all pose and event contacts by impulse; a stronger wall impact therefore overwrote the same object's floor support position, pair/episode, materials, and metrics. The only behavioral change is: `pose.contact ?? contacts.get(pose.objectId)`. When there is no producer contact, the existing fallback is retained, and discrete events continue to copy `event.contact` independently.

Frozen acceptance criteria and existing defaults assertions were not modified. See [final-receipt.json](../../../../../artifacts/v1/support-anchor-20261027/final-receipt.json) for original files and actual byte hashes; other modules being worked on concurrently are outside the scope of this change/review.

Traceable data chain:

| Claim | Source/boundary | Evidence from this work |
| --- | --- | --- |
| SA-001 | `poses()` in `src/physics/physics-world.ts` selects a support/sliding patch → `BodyPose.contact` → `toBehaviorFrame().objects[].contact` | Neither a strong impact on the same object nor other participant poses can overwrite its own producer contact; support J=0.8 and unavailable/null are both retained |
| SA-002 | `samplePair()`'s `vCOM + omega × r`/nullable methods → adapter metrics | Synthetic SI inputs `v=[2,0,0]`, `omega=[0,0,-2]`, and support `r=[0,-1,0]` have slip=0; the wall point has slip=1.6. The adapter neither recalculates nor labels J(Ns) as N; source speed=2, angular speed=2, support force=null |
| SA-003 | `PhysicsEvent.contact` → normalized discrete event → BehaviorRuntime discrete candidate | The strong wall impact retains `[0.8,1,0]`, J=12, and the wall material/collider/pair; the audio intent carries its own parentPhysicsEventId |
| SA-004 | `BehaviorFrame.objects[].contact` → continuous candidate → logical rolling emitter | Rolling intent is at `[0,0,0]`, with the floor episode/material, selecting the floor generator at 330 Hz; in the same tick, impact selects 880 Hz at the wall. In the next tick, rolling updates along the producer patch without recreating/stopping the instance |

These Synthetic contact values are adapter contract fixtures; they do not pretend to prove the rolling classifier in the same actual Rapier tick. Actual Rapier falling contact and existing motion/contact suites are verified separately.

Executed and results read:

- [red.tap](../../../../../artifacts/v1/support-anchor-20261027/red.tap), [red.json](../../../../../artifacts/v1/support-anchor-20261027/red.json): original source preimage, final case in the original defaults suite FAIL; four new cases FAIL, while the fallback case was already PASS. Total 12/17 PASS, 5 expected assertion FAIL results, with no runner/syntax errors.
- [preimage-reproduction/proof.json](../../../../../artifacts/v1/support-anchor-20261027/preimage-reproduction/proof.json), [result.tap](../../../../../artifacts/v1/support-anchor-20261027/preimage-reproduction/result.tap): the final formatted test content was rerun against an isolated preimage, with 1/5 PASS and the same 4 assertion FAIL results. Only TypeScript transpilation/changes to three import paths were used; product sources were not temporarily replaced.
- [green.tap](../../../../../artifacts/v1/support-anchor-20261027/green.tap), [green.json](../../../../../artifacts/v1/support-anchor-20261027/green.json): original defaults + new tests 17/17 PASS, with identical hashes for the scoped sources before and after execution.
- Independent [review/REVIEW.md](review/REVIEW.md), [review/verification.json](../../../../../artifacts/v1/support-anchor-20261027/review/verification.json): a separate process reran 17/17, with scoped ESLint/Prettier PASS; no P0/P1/P2 findings, and hashes of the listed sources/protected files were stable.
- Independent [review/adjacent-verification.json](../../../../../artifacts/v1/support-anchor-20261027/review/adjacent-verification.json): a separate process reran contact emission/motion hysteresis/audio behavior, 50/50 PASS, including the actual Rapier floor + wall high-slip sliding anchor; stderr was empty, and source hashes were stable.
- This agent also ran `node --import tsx --test tests/physics/contact-emission.test.ts tests/physics/motion-hysteresis.test.ts tests/audio-behavior/*.test.ts`: 50/50 PASS; this was direct tool stdout, not claimed as a separate process's result.

Rerun GREEN: `node artifacts/v1/support-anchor-20261027/verify.mjs green`.
Rerun isolated RED: `node artifacts/v1/support-anchor-20261027/preimage-reproduction.mjs`.
The initial RED command refuses to overwrite an existing preimage. Production source/tests are frozen; the root runs the full `npm run check` in the shared freeze window. This subtask made no browser/server/API/model/Git/Wiki/package operations and makes no claim that DSP, hearing tests, or performance passed.
