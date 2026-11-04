<!-- english-source: {"path":"docs/14-core-pipeline/stages/05-motion-generation-fix.md","sha256":"0e4ba471de8088450083e962d60f7e525542945320d2fc23f71a4b945d5d0561","translated_at":"2026-11-02T05:31:47.070Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/05-motion-generation-fix.md`](../../../14-core-pipeline/stages/05-motion-generation-fix.md). Source SHA-256: `0e4ba471de8088450083e962d60f7e525542945320d2fc23f71a4b945d5d0561`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="motion-混合交易世代修補"></a>
# Motion mixed-transaction generation fix

Date: 2026-11-02. Follows Stage 05 dd4ef2232be111ffadaa0f0b4853150000a22e46.

An independent integration review confirmed with real Rapier that after world.reset, body generation was already2, but the original previewTrajectories pinned actions for every new Scene revision to generation1. Applying a mode-only change plus SetTrajectory then produced an action that could not execute. This is a repaired code defect; the original commit and this fix are retained separately.

<!-- english-original-anchor --> <a id="修改"></a>
## Changes

- PhysicsWorld.projectSceneGenerations is a side-effect-free projection of applyScene identity: mode/transform/material edits with unchanged geometry preserve the current generation; geometry reconstruction and reuse of deleted IDs use the historical count+1; genuinely new IDs start at1. Generation is not guessed from Scene revision.
- Motion preview uses this projection and includes the complete candidate binding in the approval digest. External transactions validate body identity before the scene callback, so a reset after preview is explicitly rejected before any Scene write.
- projectRestoredRegistry only rebinds generations from the trusted candidate World; it does not change authored targets/kinds/samples. MotionTransactionHooks.prepareRestore includes this projection in AI Undo. The Host permits only positive safe-integer changes to existing action.generation values and validates all other complete contents, order, revision and scene pin. Scene/Motion races during projection are also rejected.
- The actual runtime must connect prepareRestore(snapshot,scene), returning the same namespace/revision with document set to await motion.projectRestoredRegistry(snapshot.document,scene). If runtime uses a World identity policy different from applyScene, it must supply a matching trusted preparation boundary rather than assuming generations independently.

<!-- english-original-anchor --> <a id="驗證"></a>
## Verification

- Six new real-Rapier cases plus the existing12 Motion cases:18/18 PASS; see05-motion-generation-tests.txt. They cover reset+mode-only, geometry, ID reuse, new IDs, reset-after-preview races and re-execution after mixed-geometry Undo.
- The initial new-ID fixture overlapped the original ball and was correctly blocked by collision. The original FAIL is retained in05-motion-generation-initial-overlap.txt. Moving the original ball away makes the same collision policy pass; no assertions were removed and no tolerance was widened.
- The final three designated AI bridge suites:37/37 PASS, including8 restore-projection regressions from this fix; see05-motion-ai-generation-validation.txt.
- Final TypeScript/ESLint/format results are recorded in05-motion-generation-verification.json.
- This fix did not run browser/Meta live/device hearing. Root and Claude still need to check the actual UI and complete pipeline in the integrated version.
