<!-- english-source: {"path":"experiments/sdk-smoke-tests/README.md","sha256":"38e75954d72c5189b7953ccb0ebeab3cd9cb7a50e555e7df5f546dbebdc14730","translated_at":"2026-10-27T03:38:48.961737Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`experiments/sdk-smoke-tests/README.md`](../../../../experiments/sdk-smoke-tests/README.md). Source SHA-256: `38e75954d72c5189b7953ccb0ebeab3cd9cb7a50e555e7df5f546dbebdc14730`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="steam-audio-隔離-smoke-test"></a>
# Isolated Steam Audio Smoke Test

This contains only C API technical validation, with no production product code.

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

Prerequisites: Windows x64, PowerShell 7, and GCC with GNU C17 support (locally tested with MSYS2 UCRT64 GCC 15.2.0). The script verifies the existing SDK, compiles `smoke.c`, and dynamically loads the verified `phonon.dll`. Three complete lifecycles test direct / parametric / convolution; an assert failure or nonzero compiler/runtime exit causes the command to fail.

`build/` is ignored and reproducible; `results/native-win64-2026-10-26.json` is small numerical evidence from an actual run. See `docs/03-sdk/SDK_VALIDATION.md` for the complete method, tolerances, timing, and items not run. Handle-null checks are not treated as a leak detector, and a single timing result is not treated as a performance-budget guarantee. This test did not play audio or call cloud services.
