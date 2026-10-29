<!-- english-source: {"path":"docs/03-sdk/SDK_LICENSE.md","sha256":"98450e9d8d19db0ae579c479a6cb1dc4a84b0e3018967ad84c0ed6764951afb9","translated_at":"2026-10-27T03:38:42.4688377Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/03-sdk/SDK_LICENSE.md`](../../03-sdk/SDK_LICENSE.md). Source SHA-256: `98450e9d8d19db0ae579c479a6cb1dc4a84b0e3018967ad84c0ed6764951afb9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="steam-audio-授權與來源紀錄"></a>
# Steam Audio Licensing and Provenance Record

Review date: 2026-10-26. This is an engineering license inventory; this run only downloaded the SDK into a local isolated cache and ran a smoke test. It did not accept terms on the user's behalf, submit to a competition, deploy, or redistribute the SDK.

<!-- english-original-anchor --> <a id="來源版本與完整性"></a>
## Source, Version, and Integrity

| Item | Verified information |
| --- | --- |
| Publisher | ValveSoftware / Valve Corporation |
| SDK | Steam Audio C API 4.8.1, tag `v4.8.1` |
| Release | [Pinned release](https://github.com/ValveSoftware/steam-audio/releases/tag/v4.8.1) |
| Source | [Pinned source tree](https://github.com/ValveSoftware/steam-audio/tree/v4.8.1) |
| Binary download | [Official C API ZIP](https://github.com/ValveSoftware/steam-audio/releases/download/v4.8.1/steamaudio_4.8.1.zip) |
| ZIP SHA-256 | `4a0aa5ec1176f38f0b0993a37c2259d9e86f27e22d5e24f83ec4c3cb9a1d5449`, compared locally against the official digest |
| ZIP bytes | 181,171,027 |
| THIRDPARTY SHA-256 in ZIP | `a95e143e7d2466e82a28d6680c7287d9fc7d772136c323ab538a6d24472e70f0` |
| Header SHA-256 in ZIP | `cfab67684fe1ed75a16bb9bccb81c31276b6fb3bad904073407db900045229e7` |
| Local location | `third_party/steam-audio/cache/4.8.1/steamaudio/` (ignored, not committed to Git) |

License evidence is the pinned [LICENSE.md](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/LICENSE.md), [TRADEMARK_RIGHTS.md](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/TRADEMARK_RIGHTS.md), [core/THIRDPARTY.md](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/THIRDPARTY.md), and `THIRDPARTY.md` in the actual ZIP.

<!-- english-original-anchor --> <a id="apache-20-與商標"></a>
## Apache-2.0 and Trademarks

Steam Audio's main code uses Apache License 2.0. Redistribution should include a copy of the license, retain applicable copyright / patent / trademark / attribution notices, identify modified files, and preserve applicable upstream NOTICE material as required. Apache does not grant general trademark rights; Reflection Lab must not imply endorsement by or affiliation with Valve / Steam. [LICENSE](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/LICENSE.md), [Trademark document](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/TRADEMARK_RIGHTS.md)

A complete entry-name scan of the verified ZIP in this run found only `steamaudio/THIRDPARTY.md` matching license / notice / thirdparty-type names; no separate LICENSE or NOTICE file was found. This is an observation about this archive's file inventory, not permission to omit the Apache license in a future distribution. The header itself retains Valve copyright and Apache information; future packaging should include applicable licenses from the pinned sources.

<!-- english-original-anchor --> <a id="主要第三方元件"></a>
## Main Third-Party Components

The following entries summarize the official [THIRDPARTY](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/THIRDPARTY.md). The full precompiled binary package must not be described as Apache-only; this table is also not a complete SBOM.

| Component | Upstream terms type | Packaging considerations |
| --- | --- | --- |
| Intel IPP | Intel Simplified Software License (October 2022) | Binaries must be used / redistributed unmodified; retain copyright and terms; no unauthorized endorsement, reverse engineering / decompilation / modification |
| FFTS | BSD-style three-clause | Source / binary notices, disclaimer, no unauthorized endorsement |
| PFFFT | BSD-style terms | Retain attribution / disclaimer, including its UCAR / NCAR provenance notice |
| MySOFA | BSD-style three-clause | Retain copyright, terms, and disclaimer |
| Intel Embree | Apache-2.0 and included notices | Confirm complete notices for the actual platform / linkage |
| AMD RadeonRays | MIT | Retain copyright / permission notice |
| AMD TrueAudio Next | MIT | Retain copyright / permission notice; outside the scope of the default CPU smoke test |
| CIPIC HRTF Database | CIPIC special usage terms | Use / modification / redistribution permitted, with copyright retained; the terms also request acknowledgment; do not replace these with an MIT declaration |
| Google Spherical Harmonics Library | Apache-2.0 | Retain applicable license and attribution |

`dependencies.json` also lists FlatBuffers, zlib, ISPC, and tool / test dependencies. Whether they appear in the final distribution must be determined from compilation/linking, platform, and data assets; THIRDPARTY headings alone do not establish that every dependency has been reviewed. [Dependencies](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/build/dependencies.json)

The official source-build documentation identifies IPP as an optional closed-source dependency, with PFFFT / built-in math alternatives. If a completely open-source binary combination is required in the future, pin build flags and component versions and produce a new SBOM / performance results; do not assume the official DLL has the same contents as a self-built version. [Build instructions](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/doc/build-instructions.rst)

<!-- english-original-anchor --> <a id="再散布與競賽狀態"></a>
## Redistribution and Competition Status

| Work | Status / handling |
| --- | --- |
| Local download, integrity verification, isolated testing | Completed; no external release |
| Tracking SDK DLL / ZIP / static libraries / complete third-party documents in Git | Not performed; cache/build ignored |
| Releasing a Reflection Lab installer | Not performed yet; first prepare the actual binary inventory and include complete notices / licenses |
| Unity option | Unity's current terms require a separate review; Steam Audio licensing does not cover Unity |
| WASM option | Static linking still requires retaining terms for the code / data actually included; browser execution does not remove these obligations |
| Whether the hackathon permits these precompiled SDKs | Determined by the official competition rules and compliance documents; an open-source license alone does not mean the competition permits every preparation activity |

The project's formal license register should cross-reference this file and `docs/01-compliance/LICENSE_REGISTER.md`, retaining the distinction between “main code license” and “component terms in the official precompiled distribution.”
