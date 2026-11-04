<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/events/EXPORT_GATE_FINDING.md","sha256":"23837c7bd269592e722626c3173889bd7ee3697ef933b2557a0e705ab2e1798a","translated_at":"2026-11-02T10:55:34.025Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/events/EXPORT_GATE_FINDING.md`](../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/events/EXPORT_GATE_FINDING.md). Source SHA-256: `23837c7bd269592e722626c3173889bd7ee3697ef933b2557a0e705ab2e1798a`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="封存錄製匯出門控缺口"></a>
# Archived-recording export gate gap

Status: **Fixed; the final complete Events case on49bde82 passed1/1**. See final-49bde82-01/REPORT.md. The following sections preserve the discovery and Node-repair phases; original FAILs are not overwritten.

In the full Events case on a10b7419908ecd88fd26d96dc354ca5659796986/index-BmjZ1Zyf.js, the first three JSON downloads succeeded: the completed recording, paused replay, and the old archive during a second recording. After the final Stop, Export was still clickable, but clicking returned only TRANSACTION_BUSY without a download event.

Read-only reconstruction of the original trace's ARIA/state:

- Before Export at t14465 ms after Stop: the badge said “Recording”, Stop aria-pressed=true, and Export disabled=false.
- At the Export action at t14521 ms, this state remained; global TRANSACTION_BUSY appeared at t14633 ms.
- Detailed nodes and times are in attempt-final-boundary/export-seal-trace-analysis.json. The original timeout/trace is not overwritten.

There are two distinct conclusions. Waiting only for Export enabled does not establish that the new file is complete: the previous archive is intentionally exportable during a subsequent recording, so that wait needs correction. However, the enabled UI export was genuinely blocked by the mutation transaction. The entire finding cannot be classified as a script error.

A new public Runtime regression delays BlobStore.saveRecording: the artifact is already sealed and verifyRecording succeeds, while the public snapshot is finalized/hasArtifact=true, yet export returns TRANSACTION_BUSY and downloadCount=0. Even waiting for “Recording saved” can encounter a persistence-busy window. Only public storage/DOM adapters were substituted; no HostInternal was used. The original RED output is export-node-original-fail.txt.

The proposed repair is for Runtime to handle immutable archived export before its mutation-busy gate: read only the last complete artifact at that moment, retain NO_RECORDING/the original filename/hash, refuse partial results, and leave the recorder and other transactions untouched. The UI test should separately wait for the new seal to finish before checking the new run ID. This proposal belongs to the original finding phase; implementation and finite validation follow below. Node results are not a new browser pass.

<!-- english-original-anchor --> <a id="root-授權修復後的有限結果"></a>
## Finite results after the root-authorized repair

exportRecording is now an early read-only Runtime action. It reads one Host-sealed artifact. No artifact, zero frames, or a cancelled result still produces NO_RECORDING. A sealed interrupted raw prefix retains its existing export contract. This exception does not remove mutation-busy protection; new sealing, cursor, config and other editing transactions remain unchanged.

All four public Node positive/negative cases pass: deferred persistence reads the current complete file; deferred new sealing reads only the previous complete file while patchObject remains blocked as busy; no previous file before the first seal completes returns NO_RECORDING; and an interrupted prefix retains its original IDs/status/hash. With related regressions, **26/26 PASS**. TypeScript and scoped ESLint/Prettier for six files PASS. Original RED and real-browser timeout evidence are not overwritten.

The browser harness now waits after the second Stop for “Recording saved” and for the Stop button to disappear before verifying the new run ID. It no longer treats the old archive's enabled state as completion of the new seal. The product export repair has not yet been rebuilt/retested in a new browser. export-source-manifest.json records the exact source freeze and command receipts.
Final production receipt: final-49bde82-01/ retests only the single complete Events case, with four successful raw JSON downloads. The original a10 seek/natural-end probes and reset case retain their old pins; they are not presented as rerun in this batch.
