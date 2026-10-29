<!-- english-source: {"path":"docs/07-experiments/EXPERIMENT_MODEL.md","sha256":"e26c7036ef7fa51ea863039f87846edaafab614ac712265cd92af58aa869c4e7","translated_at":"2026-10-27T03:39:48Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/07-experiments/EXPERIMENT_MODEL.md`](../../07-experiments/EXPERIMENT_MODEL.md). Source SHA-256: `e26c7036ef7fa51ea863039f87846edaafab614ac712265cd92af58aa869c4e7`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="實驗資料模型"></a>
# Experiment Data Model

Status: design + schema; the full recorder/storage/replay has not yet been implemented.

`schemas/experiment.schema.json` defines the minimum manifest. Experiment IDs are stable lowercase domain IDs and may use `exp-<uuid>`; each run has its own ID, and immutable captures are not overwritten. Times are stored in UTC and displayed in Asia/Taipei in the interface.

| Artifact | Required metadata | Purpose |
| --- | --- | --- |
| Initial Scene | schemaVersion, sceneId/revision, canonical JSON SHA256 | Original geometry, sources/listener, physics/material refs |
| Physics Snapshot | Rapier build/version, fixedDt, all world state, creation order | Same-version restoration; do not blindly use binary snapshots across versions |
| Motion Trace | integer tick, body stable ID, pose, linear/angular velocity, sleep/mode | authoritative replay/interpolation |
| Contact Trace | tick/substep/sequence, pair/contact IDs, position and normal, relative velocity, available force/impulse | Retain original collision evidence |
| Input Intent | monotonic sequence, action, target, sampling tick | Diagnostics and same-machine resimulation; does not guarantee consistency on its own |
| Solver Settings | backend/version, geometry revision, material hash, temperature/humidity/pressure/c, seed, rays/order, sample rate, HRTF | Traceable model and parameters |
| Acoustic Results | RIR/paths/metrics artifact, units, evidence class, validation level | Prohibit AI-generated fake numerical values |
| Runtime Telemetry | hardware/browser, wall time, timing percentiles, late/dropped events | Performance and explanations of exceeded limits |

Manifest hashes are content SHA256; do not use MD5 for asset integrity. Canonicalization rules must be versioned (sorted object keys, UTF-8, finite numbers, fixed line endings; original binary data hashed byte by byte). Timestamps and filenames cannot replace content hashes. Store snapshots together with scene metadata, verify that they match at runtime, and reject mismatches.

Also record license, gain, loop start/end, sample rate, and normalization for audio assets; record the profile and license for HRTFs. Check sources before using external sound effects. The initial version may use original synthesized signals to avoid samples with unverified rights.

Capture flow: Ready → Recording → Finalizing → Captured/Failed/Cancelled. Finalizing waits for bounded jobs/flushes; write the manifest atomically last. Missing result artifacts/hash mismatches mean Failed; an empty file must not count as success. Retain diagnostics on failure and do not overwrite the previous valid capture.

Allowed data classes: Measured/Computed/Estimated. AI-generated Explanation is explanatory text only, cites result IDs, and cannot be stored as a measurement or solver output. V0–V5 indicate only levels actually executed; a model name cannot upgrade them.
