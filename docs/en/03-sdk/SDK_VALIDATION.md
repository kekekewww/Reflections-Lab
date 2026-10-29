<!-- english-source: {"path":"docs/03-sdk/SDK_VALIDATION.md","sha256":"31812817bcd17d919f2e0b4aedaec80943b8061c1460d80c35f4be609855dc39","translated_at":"2026-10-27T03:38:42.4688377Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/03-sdk/SDK_VALIDATION.md`](../../03-sdk/SDK_VALIDATION.md). Source SHA-256: `31812817bcd17d919f2e0b4aedaec80943b8061c1460d80c35f4be609855dc39`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="steam-audio-sdk-隔離驗證"></a>
# Isolated Steam Audio SDK Validation

Status: **Technical Spike Verified (Windows x64)**. This is not acceptance of a production application, deployment, listening quality, or acoustic accuracy.

<!-- english-original-anchor --> <a id="已執行的環境與命令"></a>
## Environment and Commands Executed

- Execution time: `2026-10-25T19:05:46.1187836Z`, Taiwan time 2026-10-26 03:05:46.
- OS: `Microsoft Windows NT 10.0.26200.0`, X64 process; PowerShell 7.6.5.
- Compiler: `C:\msys64\ucrt64\bin\gcc.exe`, `gcc.exe (Rev8, Built by MSYS2 project) 15.2.0`.
- CPU environment description: `Intel64 Family 6 Model 183 Stepping 1, GenuineIntel`; the environment exposes 32 logical processors. CIM access was restricted, so a reliable commercial CPU model name was not obtained.
- SDK: 4.8.1; the official ZIP hash matches the publisher digest, 181,171,027 bytes.
- Executed DLL SHA-256: `ca3dbc01dbc24492717011e80f6a51404ca143ae344ca660971d2c983f1e058d`.
- Test source SHA-256: `a45f8300ac40e079ec9fa20228a4295c96881d36eed7db2b6653e1c5c58476b7`.
- Historical JSON result SHA-256: `c8bfeffa9f303fde2d6974a5ba3d8a6ca9fb86dd1f114cdedeac53b5156fddc2`; raw JSONL stdout SHA-256: `7195c1e4aaaec23d12bd5f21daf635205c752bff5c8a83b8017be7105acb54cf`.

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

The download script pins the tag, URL, file size, and SHA-256, and extracts only after successful verification. The run script rechecks the ZIP, compiles the original C test with `-std=gnu17 -Wall -Wextra -Werror -O2`, and calls the DLL through `LoadLibraryExA/GetProcAddress` using the official header types. This uses the existing GCC and does not require installing Visual Studio first; it is only a reproducible Windows x64 spike. Other compilers / platforms have not been tested.

The complete small result is saved at `experiments/sdk-smoke-tests/results/native-win64-2026-10-26.json`, with raw stdout saved as the same-named `.jsonl`; subsequent executions write to ignored `build/last-run.json` and `build/smoke-output.jsonl` without overwriting historical evidence. The source / SDK / DLL hashes in the JSON and the result hashes in this section link source code, parameters, and output; the subsequent run script also records the output hash automatically.

<!-- english-original-anchor --> <a id="場景輸入與判定"></a>
## Scene, Inputs, and Criteria

Right-handed coordinates and meters are used. The room is 6 × 3 × 8 m, with 12 outer-wall triangles and 2 inner-wall triangles at x=0, totaling 14 triangles / 12 vertices. All surfaces use synthetic test material: absorption `[.1,.2,.3]`, scattering `.1`, transmission `[.2,.1,.05]`. These are not measured material data.

The source is fixed at `(-1,1,0)`. The first listener is at `(-1,1,2)`, on the same side as the source and 2 m away; the second listener is at `(1,1,0)`, also 2 m away but across the inner wall. Distance attenuation, air absorption, raycast occlusion, and transmission are all enabled. Test assertions: clear attenuation=.5, clear occlusion=1, blocked occlusion=0, and blocked transmission equals the three-band material values, with tolerance `1e-5`; air absorption must be finite.

Reflection settings: 4096 rays, 32 diffuse samples, 8 bounces, 1 source, 2 threads, 0.25 s duration, Ambisonics order 1, 48 kHz, 512 sample frames, default CPU ray tracer. The first two runs use parametric reflections and require finite RT60 estimates >0 in every band. The third, convolution run requires a non-null IR handle, feeds a Dirac impulse into the reflection effect for 28 consecutive frames, and requires all samples in four channels to be finite with total energy >0. Every cycle recreates and releases all handles and checks that handles are null after release; the DLL is unloaded only after the third cycle.

<!-- english-original-anchor --> <a id="實際結果"></a>
## Actual Results

| Check | Result | Evidence |
| --- | --- | --- |
| Official SDK download, SHA-256 | PASS | Local calculation equals manifest / GitHub digest |
| C test compilation | PASS | GCC, warnings-as-errors, exit 0 |
| Context / scene / mesh / simulator / source initialization | PASS | Three cycles completed |
| 2 m clear distance attenuation | PASS | All 0.5 |
| Same-side / through-wall occlusion | PASS | All 1 / 0 |
| Transmission coefficients | PASS | `[0.200000003,0.100000001,0.0500000007]` |
| Air absorption | PASS (finiteness) | ISO model accuracy not validated |
| Parametric reflections | PASS (finite, positive) | Two result sets below; not treated as analytical RT60 ground truth |
| Convolution reflections / Dirac rendering | PASS | 4-channel finite output, energy `0.0626459021818` |
| Release, reinitialization | PASS | All handles null each time; next cycle can recreate them |
| Leak detection / sanitizer | NOT RUN | Null handles do not prove the absence of memory leaks |
| HRTF, audio-device playback, Doppler | NOT RUN | No device audio produced in this run |
| Dynamic instance / material updates, pathing, baking / raw IR extraction | NOT RUN | API inspection only, not executed |
| WASM link / browser runtime | NOT RUN | Local `emcc` not found; only actual archive / source inspection |
| Large-scene performance / P95 / multiple sources / listening quality | NOT RUN | These data are insufficient to claim product budgets are attainable |

| Cycle | Mode | Initialization ms | Total ms for two direct calls and retrieval | One reflections call ms | Three-band RT60 estimate (s) |
| --- | --- | --- | --- | --- | --- |
| 1 | Parametric | 0.5178 | 0.0148 | 5.8060 | `[.225812316,.220546782,.214963555]` |
| 2 | Parametric (complete reinitialization) | 0.3719 | 0.0015 | 5.2708 | `[.201755434,.202699035,.197928399]` |
| 3 | Convolution | 2.0714 | 0.0021 | 5.4765 | Not applicable; result field `[0,0,0]` does not prove zero reverberation |

These are smoke observations from three cold lifecycles, not a statistical benchmark. The two parametric results differ, showing that identical settings must not be treated as bit-exact deterministic results; no experimental evidence of a publicly configurable random seed was obtained in this run. The approximately 5 ms figure must not be interpreted directly as total audio latency, supported source count, or cross-platform performance.

<!-- english-original-anchor --> <a id="真實遇到的障礙與處理"></a>
## Obstacles Actually Encountered and Their Handling

1. The first sandbox call to `Invoke-RestMethod https://api.github.com/...` failed: `無法識別這台主機` (“This host could not be recognized”). Official information remained readable through the browsing tool; approved network execution successfully obtained metadata and downloaded the specified ZIP. No payment or account controls were bypassed.
2. `Get-CimInstance Win32_Processor` reported `用戶端無法存取 CIM 資源` (“The client cannot access CIM resources”). OS / architecture / compiler and the environment's CPU description were recorded instead; no model name was fabricated.
3. Emscripten is unavailable locally. WASM linking was not executed, so historical issues or the existing static-library inventory cannot be recorded as a current success / failure result.

<!-- english-original-anchor --> <a id="能證明的範圍與下一步"></a>
## What This Establishes and Next Steps

The official SDK, current Windows runtime, and existing GCC have been shown to complete a minimal acoustic pipeline and reinitialization. Still required: single-plane reflection arrival-time and energy validation, independent solver comparison, dynamic-obstacle commit, material update, Baked IR extraction, native audio thread stress / underrun checks, and P50/P95 / memory for 1 / 8 / 32 sources. These should be selected according to the final ADR; this smoke test must not be expanded into a claim that formal features are complete.

Official API and download references for this test are in [STEAM_AUDIO_RESEARCH.md](STEAM_AUDIO_RESEARCH.md); license restrictions are in [SDK_LICENSE.md](SDK_LICENSE.md).
