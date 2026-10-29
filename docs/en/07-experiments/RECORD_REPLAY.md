<!-- english-source: {"path":"docs/07-experiments/RECORD_REPLAY.md","sha256":"6c7ad4776cc2f38b1430dd98238990ae23857d4a8b9330030ca011a72848b2dd","translated_at":"2026-10-27T03:39:48Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/07-experiments/RECORD_REPLAY.md`](../../07-experiments/RECORD_REPLAY.md). Source SHA-256: `6c7ad4776cc2f38b1430dd98238990ae23857d4a8b9330030ca011a72848b2dd`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="錄製與重播"></a>
# Recording and Replay

<!-- english-original-anchor --> <a id="2026-10-28正式-web-背景封存"></a>
## 2026-10-28: Background sealing in production Web

When a Worker is available, stopping recording sends the accepted immutable frame/configuration snapshot to a dedicated Worker. It fully recomputes using the original constructor, per-frame validation, sealing and `verifyRecording`, then returns canonical encoding; artifact, fingerprint and byte-count formats remain unchanged. Only one sealing job runs at a time, with a 120-second timer; that timer cannot interrupt synchronous main-thread transfer, JSON parsing or freezing.

The main thread recomputes the returned bytes' SHA-256 and creates an isolated, deeply frozen artifact. BlobStore's private prepared record binds that artifact and encoding digest; bytes and identity are rechecked before writing and committed only on success. Save failure remains retryable, and concurrent saves of the same prepared artifact share one commit. Public `saveRecording` retains full original verification for untrusted inputs, as does reading. Failure, timeout or cancellation publishes no partial result; the recorder retains `SEAL_FAILED` and the same rejected promise. Node / explicit `useWorker:false` retains the original sealing flow.

Root ran a [fixed synthetic recording comparison in Chrome](../../../artifacts/v1/recording-worker-browser-2026-10-28T124538871Z-bdccb715/browser-result.json): both flows produced the same approximately 8.26 MB encoding and artifact/bytes fingerprints; IndexedDB writing, retry after failure and tamper rejection passed. This is a single-machine, single-case, silent diagnostic comparison, not formal scene performance or human listening. Main-thread transfer/parsing and saving still have long tasks; the 4 ms goal is not claimed. Initial isolated testing found a leaked snapshot budget reference; it was fixed with an independently frozen copy and covered by negative tests and independent re-review.

Reproducible command: `node tests/browser/recording-worker/run.mjs`. Fixed data, baseline, source and repair history are in the [source archive](../../../artifacts/v1/r15-recording-worker-20261028/promotion.json). The command uses only local Chrome, localhost and IndexedDB, with no audio or paid model. Complete product, recording overload, cross-browser and device listening remain separate first-version acceptance items. The following is earlier planning; its historical NOT RUN does not mean the new scoped checks above were not executed.

<!-- english-original-anchor --> <a id="三種模式"></a>
## Three Modes

1. **Authoritative motion replay (main A/B path)**: Drive the acoustic source/listener from recorded ticks and poses/velocities; collision sounds use the original event trace. Replayed bodies may be controlled/kinematic, so physics collisions no longer determine their trajectories again. This mode is motion replay, not a new physics solve.
2. **Pinned runtime resimulation**: Restore the initial snapshot, the same WASM version, the same seed, the same creation/removal order, and the same fixedDt, then feed tick-indexed intents and compare per-tick state hashes/errors. This is testable consistency under the same configuration; it has not yet been tested across machines.
3. **Fresh physics rerun**: Solve again after changes to mass, friction, restitution, or geometry; the new run has a new motion trace and cannot be claimed to compare acoustic materials alone.

[Rapier's official determinism documentation](https://rapier.rs/docs/user_guides/javascript/determinism/) explains the WASM/JS guarantees under the same version and initialization, and warns that the transcendental operations and order used during initialization must match. This does not mean that this project's UI input timing, browser scheduling, and external programs have all been proven deterministic. Retain the conditions and scope actually tested; do not categorically claim that the engine lacks determinism.

<!-- english-original-anchor --> <a id="時間與儲存"></a>
## Timing and Storage

Physics uses integer ticks, with `simTime=tick*fixedDt`; rendering only interpolates and does not contaminate the actual trace. Acoustic jobs include the poseTick they use; audio separately records its audio epoch. Pausing must not insert wall-clock gaps into physics time; seek/replay resets the audio scheduling epoch. Use quaternion slerp for listener rotation; do not create abnormal rotations through Euler linear interpolation.

Pause uses Freeze-and-fade: freeze the logical tick/source offsets/event cursor. The 20ms monitor fade is an unverified design target; record a boundary when an old tail is interrupted. Cancel scheduling for the old audio epoch while retaining logical arrivals that have not yet arrived. After Resume reanchors time, reschedule only arrivals that have not yet arrived, once, to avoid retriggering impacts. Paused audition has a separate clock and is excluded from metrics. During recording/A/B, pause when the catch-up budget is exceeded rather than dropping ticks; interactive non-recording mode may drop wall-time but must record telemetry.

Flush the final state when recording stops; trace chunks include start/end tick, count, and hash. Missing ticks, duplicate sequences, unresolved references across bodies, illegal quaternions, and non-monotonic time must be rejected or marked corrupt; they must not be silently filled in as measurements. Trace compression should record position/angle/time error tolerances; an uncompressed initial version is easier to validate.

The trace size for 10 rigid bodies, 60 Hz, and 30 s must be measured by actual serialization; this document does not predict a falsely precise capacity. Use quotas to limit duration/bodies/artifact bytes; stop capture when a limit is exceeded and retain the reason.

<!-- english-original-anchor --> <a id="驗收"></a>
## Acceptance

- Rerun twice from the same initial snapshot for 120 ticks and compare on the same machine; list cross-platform testing separately as V4, without inferring it from a same-machine pass.
- Authoritative replay guarantees the same motion trace hash for acoustic input, with identical listener/source timestamp sequences.
- Pause/resume/seek produces no duplicate collisions; the replay segment range is explicit and the audio tail policy is visible.
- Cancellation/crash during capture must not produce an incomplete manifest with status Captured.

All full recording/replay acceptance checks above are NOT RUN; existing analytical path continuity and Rapier snapshot-related smoke checks do not replace an end-to-end recorder.

<!-- english-original-anchor --> <a id="sound-behavior-trace-extension2026-10-27草案"></a>
## Sound Behavior Trace Extension (2026-10-27 draft)

Recording has two layers: ① original normalized physics/player events and motion/listener traces; ② Behavior evaluation output and AudioEvent/instance/emitter decisions. Both link to tick/sequence, runEpoch, and scene revision. The latter also includes profile/binding/rule versions, material pair, contact position, asset hash, selected variant/seed, gain/pitch/fade, voice admission/drop/steal, and acoustic result refs.

Recorded-output replay replays recorded decisions. Behavior A/B instead reuses ① and reevaluates it with another profile version; it must generate a separate ② and cannot require both versions' decisions to be identical. The [A/B contract](AB_COMPARISON.md) states which hashes must match/may change; the two approaches must not be described as the same experiment.

Logical continuous instances must retain playhead, gate, cooldown deadline, and bounded latch; do not serialize AudioNode/Rapier objects. Seek/reset changes runEpoch and rebuilds necessary resources; it must not retain old-epoch scheduling or retrigger impacts already played. When an object is removed, end it according to the recorded tail policy; do not let JS garbage collection determine the semantics.

The Sound Behavior draft is an external artifact; the existing Experiment schema has not yet been migrated. Full capture/replay/cross-browser alignment/listening tests remain NOT RUN; schema fixtures and physics spikes do not replace these acceptance checks.
