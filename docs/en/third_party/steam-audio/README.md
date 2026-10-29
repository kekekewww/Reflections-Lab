<!-- english-source: {"path":"third_party/steam-audio/README.md","sha256":"3d2697983a4adffd9c01ac631bf16344d140fd8bfe60b66404d75faa6fbbdddd","translated_at":"2026-10-27T03:37:39.8945606Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`third_party/steam-audio/README.md`](../../../../third_party/steam-audio/README.md). Source SHA-256: `3d2697983a4adffd9c01ac631bf16344d140fd8bfe60b66404d75faa6fbbdddd`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="steam-audio-本機快取"></a>
# Steam Audio Local Cache

See `manifest.json` for the pinned version and official source; see `docs/03-sdk/` for research and licensing.

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

`cache/` stores the official ZIP, SDK headers, native/WASM libraries, and accompanying documentation solely for local isolated validation; it is not committed to Git. Downloads must pass a pinned SHA-256 comparison before use. The official release's main code is licensed under Apache-2.0, but its binaries still carry individual third-party terms; see `steamaudio/THIRDPARTY.md` in the cache for the actual notices, and do not claim that the entire package is Apache-only.
