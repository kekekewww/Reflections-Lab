<!-- english-source: {"path":"docs/02-architecture/DATA_CONTRACTS.md","sha256":"7f7ab891a027d353a882f965fe33224ed99760a8a3e7fb0a7fc7d3de54ab5ec0","translated_at":"2026-10-29T05:28:32Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/02-architecture/DATA_CONTRACTS.md`](../../02-architecture/DATA_CONTRACTS.md). Source SHA-256: `7f7ab891a027d353a882f965fe33224ed99760a8a3e7fb0a7fc7d3de54ab5ec0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="資料與聲學後端契約"></a>
# Data and Acoustic Backend Contracts

2026-10-29: The data semantics below are retained. Production Scene / Project / AcousticFrame / events and recording/replay now have runtimes; this page's V0 description must no longer be read as meaning that the entire product is unimplemented. See the [Architecture](ARCHITECTURE.md) and [Gap Analysis](../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md) for differences between current code and research. Portable RenderJob / RenderBackend in src/audio/render-contract.ts reserve types only. Solver and audio share a hard propagation limit of 5 seconds, with a 2-second default, without changing existing serialized formats.

<!-- english-original-anchor --> <a id="scene--material"></a>
## Scene / Material

`schemas/scene.schema.json` is the minimal storage format; stable IDs must not use array indexes or runtime handles. `sceneRevision` increases monotonically with each applied transaction; a failed revision precondition returns `STALE_REVISION`. The host generates command deltas and undo inverses; AI submits candidate operations only. Cross-ID references, quaternion unit length, closed meshes, mass validity, and collision geometry validity are handled by the domain validator; do not assume JSON Schema has handled them.

`schemas/material.schema.json` accepts only the energy model `A + R + T = 1`. Here A is true dissipation, T is transmission, and R is the total reflected energy. Some measured absorption already includes transmission loss, so T must not be subtracted again. Scattering is the diffuse fraction of R and does not remove additional energy. The pressure amplitude |r|=sqrt(R) holds only in a simplified model with equal impedance and no phase data; `phaseModel` must be recorded. `transmissionLossDb` cannot be used directly as gain: T=10^(-TL/10), and the amplitude for equal impedance is 10^(-TL/20).

Each material includes `dataClass` (Measured / Derived / Tuned / Synthetic), a source URL, band centers in Hz, and conditions for angle / installation / thickness / test method. Initial demonstration materials must be labeled Synthetic; names such as wood or concrete must not imply measurement. Canonical bands may initially use 125–8000 Hz octaves, with adapters converting according to source definitions; copying external three-band values into eight bands and calling them measured is prohibited. See the SDK documentation for Steam band definitions and coefficient semantics.

<!-- english-original-anchor --> <a id="acousticframe"></a>
## AcousticFrame

In `schemas/acoustic-frame.schema.json`, each frame explicitly specifies one `sourceId/listenerId` pair, and every path must belong to that pair. Multiple sources use multiple frames and do not share a direct delay. `bandCentersHz` must be strictly increasing, `gainQuantity=pressureRatio`, and each path's bandGains must match the band count. The minimal material schema accepts only zeroPhaseMagnitudeOnly; complex impedance / phase models require a version upgrade once an actual data contract exists.

Supported capabilities: `directParameters`, `individualReflectionPaths`, `impulseResponse`, `lateReverb`, `dynamicOccluders`, `dynamicReflectors`. Unsupported fields are null / empty collections with a reason; empty paths can also mean no visible path, and the UI must distinguish these cases.

A Path ID consists of the source ID, listener ID, ordered surface IDs, diffraction/branch type, and solver model version; coordinates, rank, and delay are excluded from the ID. Rebuild the identity namespace only when geometry topology changes. Reflection order must be preserved: `wallA→wallB` differs from its reverse. The audio bank matches by ID; changes in low-energy path ranking must not reset voices.

Each valid path includes actual vertex positions, length, absolute delay, relative delay, arrival direction, band gains, surface chain, model, and limitations. `arrivalDirection` is the unit vector from the listener toward the penultimate vertex (the apparent source / HRTF direction), opposite to the sound wave's travel direction along the final segment; for a direct path, it points from the listener toward the source. Relative delay is only the difference from the direct sound for that pair. Audio scheduling uses the absolute delay from the same t0; do not add the direct delay again for a reflection.

IR output must include sample rate, channels / ambisonic order, reference emission time, normalization, whether it includes direct sound, whether it includes air / distance / material, and solver version. The UI must not invent geometric paths by working backward from an IR; an energy-time histogram also cannot be used directly as a phase-correct IR.

<!-- english-original-anchor --> <a id="physicsaudioevent"></a>
## PhysicsAudioEvent

Record `experimentId, tick, substep, sequence, bodyAId, bodyBId, contactId, worldPointM, normal, relativeVelocityMps, impulseNs?, forceN?, surfaceIds, materialPair, classification`. Force and impulse differ; store null when the engine API does not provide a value, and do not present force as Ns. Use simulation time, not `Date.now()`, as the basis for audio scheduling. Assign separate IDs to continuous emitters and contact voices.

Contract limits and rejection: the initial scene supports at most 256 objects, 32 sources, 1 active listener, and a 200 m scene extent. These are conservative design budgets, not performance test conclusions. Reject NaN / Infinity, arbitrary external URLs, duplicate IDs, negative mass, and oversized operation arrays. See the [AI Tool Specifications](../08-ai/AI_TOOL_SCHEMAS.md) for dependent APIs.
