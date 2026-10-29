<!-- english-source: {"path":"docs/03-sdk/STEAM_AUDIO_RESEARCH.md","sha256":"63b5c02782962ec9b06d112c1dc542553b6017a234d8ffa62006513cdcf09a0c","translated_at":"2026-10-27T03:38:41Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/03-sdk/STEAM_AUDIO_RESEARCH.md`](../../03-sdk/STEAM_AUDIO_RESEARCH.md). Source SHA-256: `63b5c02782962ec9b06d112c1dc542553b6017a234d8ffa62006513cdcf09a0c`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="steam-audio-sdk-研究"></a>
# Steam Audio SDK Research

Checked: 2026-10-26 (Taiwan); fixed evaluation version: 4.8.1. The scope is research and isolated validation; production integration has not begun.

<!-- english-original-anchor --> <a id="結論與證據等級"></a>
## Conclusions and Evidence Levels

Steam Audio can serve as a native acoustics and audio backend. Local Windows x64 tests have actually passed C API initialization, scenes/materials, occlusion/transmission, parametric reflections, convolution reflections, and rebuilding after release; see [SDK_VALIDATION.md](SDK_VALIDATION.md). These results validate only the technical route for a small scene; they do not constitute acceptance of acoustic accuracy or the complete Demo.

The most important architectural limitation is that the public `IPLSimulationOutputs` does not provide the reflection points, surface sequences, or stable Path IDs for individual specular reflections. `IPLPathingVisualizationCallback` does exist, but its output consists of segments between pathing probes and must not be presented as specular reflection paths. If the product must inspect first-order/second-order geometric reflections, it needs a separate, verifiable Image Source Method backend, or must explicitly mark that capability as unavailable. [Simulation](https://valvesoftware.github.io/steam-audio/doc/capi/simulation.html)

| Claim ID | Claim | Evidence and status |
| --- | --- | --- |
| SDK-01 | The latest stable release is v4.8.1 | Official download page + GitHub latest API, checked 2026-10-26; VERIFIED |
| SDK-02 | The Windows x64 C API can run this research scene | Local GCC compilation and 3 complete lifecycles, PASS |
| SDK-03 | The public simulator output does not include an individual specular reflection path list | Inspection of the fixed-version header/official simulation structures; API_INSPECTED |
| SDK-04 | Pathing has a segment visualization callback | Fixed-version header and official API; API_INSPECTED, pathing not executed |
| SDK-05 | The official SDK ZIP contains a WASM static library | `lib/wasm/libphonon.a` in the downloaded ZIP, 7,082,068 bytes; INSPECTED, browser execution NOT RUN |
| SDK-06 | Public APIs exist for raw energy/IR, but differ from the real-time opaque reflection handle | 4.7 release notes + 4.8.1 header; API_INSPECTED, baked extraction NOT RUN |

<!-- english-original-anchor --> <a id="版本與取得方式"></a>
## Version and Acquisition

The [official download page](https://valvesoftware.github.io/steam-audio/downloads.html) matches the [v4.8.1 Release](https://github.com/ValveSoftware/steam-audio/releases/tag/v4.8.1); the GitHub API records the publication time as `2026-02-11T18:43:55Z`. The C API ZIP is `steamaudio_4.8.1.zip`, 181,171,027 bytes, with SHA-256:

```text
4a0aa5ec1176f38f0b0993a37c2259d9e86f27e22d5e24f83ec4c3cb9a1d5449
```

This value also appears in the [official GitHub asset digest](https://github.com/ValveSoftware/steam-audio/releases/expanded_assets/v4.8.1) and has been compared against a recalculation from the locally downloaded file. The fixed information is stored in `third_party/steam-audio/manifest.json`; reproducible commands:

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

Only original test code, the manifest, documentation, and small numerical results enter version control. The SDK ZIP, extracted files, DLLs, static libraries, and executables are kept in ignored cache/build directories.

<!-- english-original-anchor --> <a id="c-api-與責任邊界"></a>
## C API and Responsibility Boundaries

| Object/operation | Purpose | Integration considerations |
| --- | --- | --- |
| `IPLContext` | Version settings, global configuration, and resource creation | `version = STEAMAUDIO_VERSION`; retain/release is reference counted |
| `IPLScene` | Acoustic scene container | Keep it distinct from rendering/collision geometry and retain the scene revision |
| `IPLStaticMesh` | Triangle mesh and per-face material indices | Static meshes do not support direct deformation; the 4.8.1 header has `iplStaticMeshSetMaterial`, but updates have not been tested |
| `IPLInstancedMesh` | Subscene and rigid-body transform | Supports translation/rotation/scaling; has `iplInstancedMeshUpdateTransform`, which does not imply a deformable mesh |
| `IPLSimulator` | direct/reflections/pathing computation | The scene type and reflection type selected at creation cannot be switched arbitrarily |
| `IPLSource` | Sound-emitting position, simulation inputs, and results | Keep it separate from the PCM audio playback object; moving a physics object should not rebuild the audio stream |
| `IPLMaterial` | absorption, scattering, transmission | The official precompiled version uses three frequency bands; values must include definitions and data sources |
| `iplSceneCommit` | Apply mesh/instance changes | Must not be arbitrarily interleaved with scene tracing/simulation |
| `iplSimulatorCommit` | Apply changes to the scene/probe/source collections | Must not be called while simulation is running; ordinary source/listener pose updates use SetInputs |

Sources: [Programmer’s Guide](https://valvesoftware.github.io/steam-audio/doc/capi/guide.html), [Scene API](https://valvesoftware.github.io/steam-audio/doc/capi/scene.html), [fixed-version header](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.h). Complete ownership and concurrency rules must be checked against the API in use; reference counting does not imply that all functions can run concurrently without locks.

<!-- english-original-anchor --> <a id="可取得與不可假設的輸出"></a>
## Available Outputs and What Must Not Be Assumed

| Capability | Public representation/limitation in 4.8.1 | Status in this evaluation |
| --- | --- | --- |
| Distance attenuation, air absorption, directivity | scalar/band coefficients in `IPLDirectEffectParams` | Finite distance and air values passed; directivity not tested |
| Occlusion and transmission | direct occlusion factor, three-band transmission | Same-side and through-wall scenes passed |
| Reflections and reverberation | convolution IR handle, three-band reverbTimes, hybrid parameters | Both parametric and convolution passed |
| Raw samples of real-time reflections | `IPLReflectionEffectIR` is an opaque handle | Nonzero finite output obtained using a Dirac input to `iplReflectionEffectApply`; sample export not implemented |
| Baked energy/IR | `iplProbeBatchGetEnergyField` → `IPLReconstructor` → `IPLImpulseResponseGetData/GetChannel` | API inspected; baking/reconstruction not executed |
| Individual reflection paths | Public simulator structures contain no reflection-point sequence/Path ID | This public contract is unsupported; must not be fabricated |
| Pathing visualization | `pathingVisCallback(from,to,occluded,userData)` | Segments of a probe route graph; not reflection surface points |
| HRTF/binaural | default HRTF, supported SOFA; binaural/Ambisonics decode | Supported by the official API; binaural rendering and listening not performed in this evaluation |
| Propagation delay/Doppler | The direct effect structure has no geometric delay or velocity fields | An independent propagation model/delay DSP should handle this; must not claim validation in this evaluation |

Raw energy, IR, and reconstruction APIs have been added since 4.7.0, so the older conclusion that “IR cannot be obtained at all” must not be reused. However, `IPLImpulseResponse` and `IPLReflectionEffectIR` are different opaque types; casting them to read internal memory is prohibited. These distinctions are based on the [v4.7.0 Release](https://github.com/ValveSoftware/steam-audio/releases/tag/v4.7.0), [Reflection Effect](https://valvesoftware.github.io/steam-audio/doc/capi/reflections-effect.html), and [fixed-version header](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.h).

<!-- english-original-anchor --> <a id="材料座標與媒介"></a>
## Materials, Coordinates, and Medium

The official header defines absorption as the fraction of energy absorbed; scattering as the fraction of reflected energy scattered randomly; and transmission as used only for direct occlusion. The three band centers are 400 Hz, 2.5 kHz, and 15 kHz. Arbitrary octave-band measurements, amplitude reflection coefficients, or transmission loss in dB must not be treated directly as the same fields. The values used in this evaluation, `absorption=[.1,.2,.3]`, `scattering=.1`, and `transmission=[.2,.1,.05]`, are artificial test values. SDK default presets also do not automatically qualify as material data with complete measurement conditions. [Scene/material API](https://valvesoftware.github.io/steam-audio/doc/capi/scene.html)

The SDK uses right-handed coordinates, +X right, +Y up, -Z forward; matrices are row-major. The adapter must explicitly convert world transforms, direction vectors, units, and material frequency bands. [Geometry](https://valvesoftware.github.io/steam-audio/doc/capi/geometry.html)

Air absorption can be configured through exponential coefficients or a callback; this provides an entry point for integrating a temperature/humidity model, but does not mean the SDK already provides the complete temperature/humidity/pressure UI or ISO 9613-1 validation required by Reflection Lab. Doppler, retarded time, and constant-speed-of-sound assumptions still require documentation for the project's own model.

<!-- english-original-anchor --> <a id="平台建置與執行條件"></a>
## Platforms, Builds, and Execution Requirements

The verified ZIP library directories are: `windows-x86`, `windows-x64`, `linux-x86`, `linux-x64`, `osx`, `android-armv7`, `android-armv8`, `android-x86`, `android-x64`, `ios`, and `wasm`. Only Windows x64 has been executed; the others are package listings, not proof of local compatibility.

[Getting Started](https://valvesoftware.github.io/steam-audio/doc/capi/getting-started.html) lists Windows/Linux x86/x64, four Android architectures, and iOS ARM64; its macOS page still lists Intel/10.7. The [v4.8.1 CMake](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/CMakeLists.txt) includes source-build conditions for macOS x86_64+arm64, 10.13, and other architectures. Documented minimum versions, source-build branches, and actual release artifacts should be tracked separately; certification against every minimum OS has not been performed.

The precompiled C API requires dynamic/static libraries of the matching architecture and a compatible runtime. The existing local GCC could read the header and call the Windows x64 DLL using `LoadLibraryExA/GetProcAddress`; Visual Studio was not required. This proves only that the DLL/C ABI works locally, not that production MSVC/Rust binding builds are complete. The [source build instructions](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/doc/build-instructions.rst) use CMake, Python, C++14, and individual dependencies; IPP is optional, and performance of alternative math/FFT paths must be measured again.

<!-- english-original-anchor --> <a id="cpu記憶體與音訊執行緒"></a>
## CPU, Memory, and the Audio Thread

direct, reflection updates, physics fixed steps, and PCM frame processing should be scheduled independently. The official documentation states that direct simulation with occlusion/transmission enabled should not run on the audio thread, and reflections/pathing should move to background threads. [Simulation](https://valvesoftware.github.io/steam-audio/doc/capi/simulation.html)

This test used: 1 source, 14 triangles, 4096 rays, 8 bounces, 2 threads, 0.25 s, order 1, 48 kHz/512 frame. The ideal float IR data size for one IR is `4 × 12000 × 4 = 192000 bytes`; this excludes additional memory for FFT, double buffering, ray tracing structures, and so on. The approximately 5.27–5.81 ms reflection-call duration is an observation from one small smoke test, and must not be treated as a P95, maximum source count, or audio latency guarantee. 512/48000 = 10.67 ms is only the frame duration in this test; device I/O, browser, and IPC latency are additional.

<!-- english-original-anchor --> <a id="後端合約建議"></a>
## Backend Contract Recommendations

Capability flags should at least distinguish `directCoefficients`, `reverbParameters`, `reflectionAudio`, `bakedRawIR`, `individualSpecularPaths`, and `probePathSegments`. Results should include backend/version, sceneRevision, inputTimestamp, computedAt, material mapping revision, band centers, and solver settings. The Steam Audio adapter sets `individualSpecularPaths=false`; paths from a visualization solver must display their own computational source. Do not describe an independent ISM path as the reflection actually sampled internally by Steam Audio.
