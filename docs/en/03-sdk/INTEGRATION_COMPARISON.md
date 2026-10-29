<!-- english-source: {"path":"docs/03-sdk/INTEGRATION_COMPARISON.md","sha256":"ac85ac5ed36e1d2130647e2e1b5e36406ae5c835e35d8d27c18425933be3bb3e","translated_at":"2026-10-27T03:38:42.4688377Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/03-sdk/INTEGRATION_COMPARISON.md`](../../03-sdk/INTEGRATION_COMPARISON.md). Source SHA-256: `ac85ac5ed36e1d2130647e2e1b5e36406ae5c835e35d8d27c18425933be3bb3e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學後端整合架構比較"></a>
# Acoustic Backend Integration Architecture Comparison

Reviewed: 2026-10-26. The costs and ten-day feasibility assessments below are engineering judgments based on this project's requirements, not performance guarantees for the packages. Only a Windows C API smoke test has been executed at this stage; no complete frontend, Tauri, Unity, or WASM application has been implemented.

<!-- english-original-anchor --> <a id="建議"></a>
## Recommendation

If judges must open a URL directly, operate a first-person physics sandbox, and inspect first-order geometric reflections, use A for the MVP: Three.js + Rapier + TypeScript / Web Audio, with a separate constrained ISM solver that has analytical solutions; retain Steam Audio as an independent native comparison / high-quality reverberation backend. This decision is conditional on deployment and inspectable paths; it does not mean a custom solver is more accurate than Steam Audio.

If a Windows-installable demo is the priority, and convolution reverb / the maturity of the existing C API takes precedence over a browser-only application, B (Rust/C++ + Tauri) is an acceptable alternative. In that case, put acoustics and PCM rendering in the native runtime, and pass control / telemetry through the WebView; do not move PCM through ordinary JSON IPC every frame. Invest in hybrid D only after B has a stable standalone runtime, to avoid taking on a local service, browser, IPC, and audio clock integration simultaneously on day one.

Steam Audio officially provides `lib/wasm/libphonon.a`, so E has a real starting point; `emcc` is unavailable locally, and linking or execution has not been performed. Treat WASM as a time-bounded P2 spike, and keep it off the ten-day MVP's critical path until a complete browser smoke test passes.

<!-- english-original-anchor --> <a id="五方案對照"></a>
## Five-Option Comparison

| Aspect | A Web-native | B Native + Tauri | C Unity + Steam Audio | D Web + Native service | E Steam Audio WASM |
| --- | --- | --- | --- | --- | --- |
| Implementation complexity | Medium–high; custom acoustics / DSP is the main cost | High; C ABI, safe lifecycle, native audio | Medium; mature engine, separate research UI required | Highest; two runtimes plus protocol / clocks | High and still uncertain; linking, dependencies, Worker / Worklet |
| Browser support | Best; WebGL / audio startup / Pointer Lock still require testing | UI is a WebView; this does not mean it can run directly from a URL | Unity editor/native is mature; do not assume the plugin works with WebGL | Browser UI works but requires installing / starting a local service | Intended to run in a browser; the full Steam pipeline remains unverified |
| Native dependency | No platform DLL; Rapier's WASM remains a dependency | SDK and app must be distributed for each OS / architecture | Unity runtime + plugin / platform artifacts | Local service, SDK, lifecycle management | No native DLL; compiled module and port dependencies remain |
| Latency | Web Audio and Worker frequencies are separate; measurement required | Native audio clock is the most direct; UI IPC does not carry PCM | Engine mixer callback; DSP buffer must be measured | IPC / network / buffering increase clock design costs | AudioWorklet quantum adaptation and memory copying require measurement |
| Performance | Constrained ISM is more controllable; higher-order path explosion requires pruning | Local 1-source smoke reflections took 5.27–5.81 ms; not benchmarked | Plugin can use the SDK; scene export / physics also take time | Native compute capability is available, but serialization can become a bottleneck | SIMD / threads / browser quotas and link options await testing |
| Debuggability | TypeScript, numerical fixtures, and Web tools are convenient | FFI / audio callback crashes are harder to debug | Editor profiler and scene inspection are convenient | Multiprocess traces / sequences / timeouts are necessary | C++→WASM stacks, heap, and audio underruns are harder to debug |
| Deployment | HTTPS static hosting is simplest | OS installer, signing / runtime verification | Platform player, larger; engine terms require a separate review | Local service / pairing required in addition to the web page | Static hosting is possible; pthreads require conditions such as COOP/COEP |
| Licensing | Review each web library / dataset / HRTF | Apache code + SDK third-party binary terms | The preceding terms plus Unity's current terms | Same as B, with service dependencies also listed | Still subject to original code / statically linked dependency terms |
| First-person physics | Rapier + custom controller / grab; high web reuse | Web controller can be reused, with native pose synchronization | Mature character / rigidbody tools; custom interaction specifications required | Synchronize web physics with native acoustic scene revisions | Physics can be the same as A, with the solver in a Worker |
| Dynamic geometry | Custom limited geometry updates; acceleration must be implemented | SDK instanced mesh + commit; dynamic operation was not tested in this run | Plugin provides dynamic geometry; export still has a cost | Same as B; revision pairing must also be ensured | C API capability exists in theory; threads / budgets await verification |
| Reflection path inspection | Custom ISM can provide reflection points / Path IDs | SDK does not provide individual specular paths; companion solver required | Plugin does not automatically provide these data | Same as B; UI must not fabricate paths | API representation is the same as B; WASM does not add path data |
| Future Reflections reusability | SceneSpec / solver / DSP contracts can be reused independently | C API adapter and native service can be reused | Unity-specific glue is harder to port; domain schema remains reusable | High contract reuse, with more operational concerns | Browser SDK wrapper can be reused if successful; cost unknown |
| Ten-day MVP feasibility | Best conditions: first-order only, simple room, capped source count | Conditionally feasible: Windows only, native audio first | Feasible for a team already familiar with Unity; this repo has no project yet | Relatively low; service maturity must be demonstrated | Unproven; completion within ten days cannot be promised |

Official references: [Steam Audio C API](https://valvesoftware.github.io/steam-audio/doc/capi/index.html), [Simulation](https://valvesoftware.github.io/steam-audio/doc/capi/simulation.html), [Unity integration](https://valvesoftware.github.io/steam-audio/doc/unity/index.html), [Tauri process model](https://tauri.app/concept/process-model/), [Emscripten pthreads](https://emscripten.org/docs/porting/pthreads.html), [Web Audio specification](https://www.w3.org/TR/webaudio/). A's solver cost and the completion prospects for B–E are project inferences.

<!-- english-original-anchor --> <a id="wasm-可行性已知與未知"></a>
## WASM Feasibility: Knowns and Unknowns

The downloaded 4.8.1 archive was inspected directly: `lib/wasm/libphonon.a` is an ar archive, 7,082,068 bytes, SHA-256 `a3811b5da2bc5000449148b994c95285f53ba3a3470d2bb6f5f1e8cafbb0634d`. The pinned [CMake](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/CMakeLists.txt) contains Emscripten / WASM / SIMD handling, and [dependencies.json](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/build/dependencies.json) contains wasm configurations for relevant dependencies. Thus, this is not a port of the entire engine from scratch, nor can the Windows DLL simply be handed to a browser to call.

Still required: (1) pin the Emscripten toolchain and obtain / build required wasm dependencies such as MySOFA, PFFFT, and zlib; (2) link a minimal C API context / scene / direct simulation; (3) run reflections in a Worker without blocking the UI; (4) if using pthreads, configure COOP / COEP and test SharedArrayBuffer; (5) put DSP in an AudioWorklet and adapt between the browser quantum and SDK frames; (6) test memory, SIMD, threads, audio startup, and failure fallbacks in Chrome / Firefox / Safari; (7) generate notices for the components actually linked.

The official repo's [issue #496](https://github.com/ValveSoftware/steam-audio/issues/496) records unresolved MySOFA/PFFFT symbols encountered by a 4.7.0 user; this is a failure report from a past environment, not evidence that 4.8.1 must fail. No linking execution result was obtained in this run; the status is NOT RUN. Successful WASM operation would still not provide individual specular path data absent from the SDK itself.

<!-- english-original-anchor --> <a id="下一階段決策閘門"></a>
## Next-Stage Decision Gates

1. The first formal implementation should deliver A's single room, fixed materials, movable source/listener, and first-order reflection fixture; pass analytical path and arrival-time checks before connecting audio.
2. B's exit / activation conditions: a native-platform demo is acceptable, and convolution reverb beyond the Web MVP is required. Separately measure P50/P95 and memory for 1 / 8 / 32 sources, scene triangles, and a dynamic door; nonblocking audio remains a hard requirement.
3. Limit E to an independent spike budget; only change the ADR after complete browser initialization + direct + reflections + audio without underruns pass. If it does not pass, retain A / B and keep the demonstration independent of an unfinished SDK port.

All options must use capability-aware contracts that separate “inspectable geometric paths” from “generation of a directional reflected sound field.” These are architecture recommendations; the project's ADRs determine final adoption status.
