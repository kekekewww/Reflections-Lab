<!-- english-source: {"path":"docs/02-architecture/ARCHITECTURE.md","sha256":"c3a1be714a6c230484f549bcde370996c0a0ee7d3cf160d6a5b9c7093388ed53","translated_at":"2026-10-29T05:32:21Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/ARCHITECTURE.md`](../../02-architecture/ARCHITECTURE.md). Source SHA-256: `c3a1be714a6c230484f549bcde370996c0a0ee7d3cf160d6a5b9c7093388ed53`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab-架構"></a>
# Reflection Lab Architecture

2026-10-29: The production Web V1 has been implemented and is undergoing integration acceptance. This is the current architecture entry point; see the [Review](../12-architecture-review/ARCHITECTURE_REVIEW.md) and [Gap Analysis](../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md) for capability status and research differences. The [frozen acceptance](../11-v1/ACCEPTANCE.md), [amendments](../11-v1/ACCEPTANCE_AMENDMENTS.md), and [R17 evidence](../../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json) remain authoritative for the complete product, performance, and external gates. This research round or a subset of passing tests must not be treated as V1 completion.

<!-- english-original-anchor --> <a id="已實作主線"></a>
## Implemented Main Approach

React / TypeScript, Three.js / React Three Fiber view, Rapier WASM, a custom Web Geometric Acoustic Core, native Web Audio nodes (AudioWorklet is a future option, with no product processor registration path), and a server Meta Model API adapter. See package-lock.json for exact dependencies; the actual entry points are src/main.tsx, src/app/bootstrap.ts, src/app/runtime.ts, and server/app.ts. Steam Audio remains an optional native comparison source, not a required product dependency.

Scene and Project documents are serializable authoring data; Rapier handles, AudioNode, Worker, and React state are not written into the scene. Every scene mutation goes through revision checks, domain validation, atomic commands, and undo. Sound Behavior documents, asset pins, and RecordingArtifact retain their own versions and source hashes; neither the renderer nor AI may rewrite them privately.

Codex leads development under [ADR-013](adr/013-codex-primary-development.md), with the Muse Code Harness Optional. Evidence, accounts, and budgets for the product Meta Agent are separate from development tools. The runtime under [ADR-014](adr/014-sound-behavior-system.md) has been implemented; see the [research](../12-architecture-review/SOUND_BEHAVIOR_RESEARCH.md) for differences among producer, evaluator, and UI capabilities.

<!-- english-original-anchor --> <a id="目前實際流程"></a>
## Current Actual Flow

~~~mermaid
flowchart LR
  UI[React workspace / Inspector / AI preview] --> CMD[Validated command / revision / undo]
  CMD --> DOC[Scene / Project / Behavior documents]
  RAF[Browser RAF] --> PH[Main-thread fixed-step Rapier]
  DOC --> PH
  PH --> EV[Normalized events / sound instances]
  PH --> POSE[Pose / listener snapshots]
  POSE --> WORKER[Bounded acoustic worker / normal live lane]
  WORKER --> FRAME[AcousticFrame / stale identity]
  EV --> AUD[Web Audio source graph]
  FRAME --> AUD
  PH --> CAP[Recording onTick / synchronous acoustic capture]
  CAP --> REC[Recorded trace / snapshots / events / phase]
  REC --> SEAL[Bounded seal worker / verified storage]
  REC --> REP[Replay / A-B reprocessing]
  API[Loopback Meta host / schema / budget] --> UI
  PLAN[Planned portable RenderBackend] -.-> REC
~~~

Fixed steps do not pass through React state, but the current bootstrap still calls LabRuntime.advance from requestAnimationFrame. Main-thread rendering, serialization, and physics compete with one another. The ordinary acoustic service has a real module Worker; the recording branch still calls solveAcoustics synchronously in onTick. The seal worker handles sealing, not physics or recording acoustics. These are verified code behaviors and must not be shortened to “all computation runs in Workers.”

<!-- english-original-anchor --> <a id="時鐘預算與聲學界線"></a>
## Clocks, Budgets, and Acoustic Boundaries

| Layer | Authority and current responsibilities | Targets / limitations |
| --- | --- | --- |
| Scene / Project | Stable IDs, SI, revision, asset / recording refs | Schema and domain limits are not performance guarantees |
| Physics | Main-thread fixed 60 Hz, pose/contact, bounded grab/throw | RAF-driven accumulator; interaction may record dropped wall-time; recording pauses on overrun to preserve continuous ticks |
| View | R3F interpolation, selection, gizmos, FPS input | 60 FPS is a target; does not write back dynamic poses |
| Acoustics | Ordinary live worker, revision / request / tick, cancellation / timeout | 10–20 Hz is an engineering target awaiting validation; the synchronous recording hot path is listed separately |
| Audio | AudioContext sample clock, logical emission, propagation delay applied once | Audio does not wait for AI / geometry; actual device sample rate / block size require separate validation |
| Recorder | Initial snapshots, integer ticks, events / phase / hash, worker sealing | Duration and cost need measurement; retaining only stereo WAV is insufficient |
| AI | Server key, schema / preview / apply / undo, cost0 default | Currently a loopback gate; no cloud session auth or durable multiuser quota yet |
| RenderBackend | Portable types-only job / result / capabilities | No product renderer yet; does not start cloud jobs or produce stems |

Direct, limited first-order specular reflections, and snapshot dynamic occlusion are numerical approximations; late reverb is Synthetic / a perceptual approximation. A higher-order solver, thick-wall transmission, dynamic reflecting surfaces, and complete calibrated RIR / room validation remain unimplemented. Material A/R/T are energy quantities; magnitude pressure uses a simplified square-root conversion, and scattering does not remove additional energy.

Direct and early paths share emission t0 and use absolute delays without adding the direct delay twice. Stable path IDs exclude rank and coordinates. The solver and audio share an explicit hard propagation limit of 5 seconds; the default solver budget remains 2 seconds. Settings beyond the limit are explicitly rejected, without silent clamping. The audio callback does not wait for geometry, physics, network, or AI.

<!-- english-original-anchor --> <a id="雲端與匯出方向"></a>
## Cloud and Export Direction

[ADR-015](adr/015-client-first-and-render-contract.md) retains client-first execution: the user's local machine runs 3D, physics, acoustics, audio, recording, and replay. The cloud provides static/CDN delivery, auth / tenant metadata, asset storage, and a controlled Meta proxy. A cloud Render Queue and workers are optional later work, not an MVP prerequisite.

[RenderJob / RenderBackend](../../../src/audio/render-contract.ts) reserve only portable artifact refs, integer time windows / sample mapping, listener / HRTF policy, source selection, dry/direct/early/late/master taps, working/output budgets, and actual provenance. Browser-only OfflineAudioContext must not be assumed to run directly in Node. A WAV encoder or DSP tests must not be treated as a complete take/stems renderer.

See the [Cloud Cost Model](../12-architecture-review/CLOUD_COST_MODEL.md) and [Browser Research](../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md) for cost and performance. R17's negative 600-second performance result, unverified complete delivery / Worklet behavior, and pending physical FPS / IME testing at normal 100% scale and device listening tests remain in effect.
