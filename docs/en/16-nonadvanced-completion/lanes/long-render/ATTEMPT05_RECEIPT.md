<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/long-render/ATTEMPT05_RECEIPT.md","sha256":"d96f686c503468bcda0a12f2bf5936346848c585870c70d279827fcfb86292f0","translated_at":"2026-11-03T09:55:47.361Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/long-render/ATTEMPT05_RECEIPT.md`](../../../../16-nonadvanced-completion/lanes/long-render/ATTEMPT05_RECEIPT.md). Source SHA-256: `d96f686c503468bcda0a12f2bf5936346848c585870c70d279827fcfb86292f0`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="長輸出-attempt05原-whole63-master-gate-通過2026-11-03"></a>
# Long output attempt05: original whole63 master gate passed (2026-11-03)

Executor Claude Code (claude-opus-5-5). Source `89f65e4d` (offline-render branch, including `ca8fb1b7` deterministic 2-input mixing summation and parser fixes), local Chrome 156.0.8078.75 (exe SHA `7c2fe774…cf50fa`), Node 22.17.0. Command `node tests/browser/nonadvanced/long-render/run.mjs`, with all deadlines and 2e-6 tolerance unchanged. Raw results [native-2026-11-03T064120504Z.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/41f271177d0487c0691756b731752e5553b23b09) (SHA `bb1d4867…cc7ab0`), [stdout](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/53f6296f0406381c99fef70fc2f79648d06b6e24), [exit](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fa872bb7f38cc189c3099ab3997b612e89b65d12).

**Result PASS**: 58/58 component checks, 16 downloads and independent Node parser all passed; owned browser/Vite cleanup completed, tracked sources unchanged before/after.

| Phase | Measured | Original deadline |
| --- | ---: | ---: |
| renderer crash check | 8.4 s | 45 s |
| store | 0.16 s | 45 s |
| DSP (all native graphs) | 155.0 s | 300 s |
| 16 downloads | 62.8 s | 90 s |
| Independent parser | 2.3 s | 45 s |

| Comparison (original 2e-6) | Maximum error | Exceedances |
| --- | ---: | ---: |
| Product master vs independent whole63 reference | 0 | 0 |
| Product mix vs whole63 reference | 0 | 0 |
| Product dry vs whole63 reference | 0 | 0 |
| Product master vs 62-second reference | 0 | 0 |
| frozen input A62 vs B62 vs C63 | 0 | 0 |
| Sum of two owner stems vs mix | 8.94e-8 | 0 |

<!-- english-original-anchor --> <a id="產品輸出本機未入-git"></a>
## Product output (local, not in Git)

`offline-render/.cache/nonadvanced-long-render/2026-11-03T064120504Z/`: five float32 stereo48 kHz WAVs, each2, 976, 000 frames (60-second signal+2-second tail), 23,808, 056 B, totaling 119, 040, 280 B, plus manifest (SHA `a9b3ab49…182fd4`).

| File | First 16 SHA-256 characters | Peak |
| --- | --- | ---: |
| master.wav | 319376174b393bce | 0.9645 (0 samples beyond ±1) |
| mix.wav | b291f2871d433267 | 0.5182 |
| dry.wav | 993c4d4ab96392e5 | 1.4024 (original pre-master content may be >1, faithfully recorded in manifest) |
| stem-46219de459d8-ball.wav | ba045040f17838d6 | 0.4142 |
| stem-be569a2d963a-speaker.wav | bec7f31d0d6d882f | 0.2741 |

The five WAV SHAs exactly match attempt03; two fresh executions produce byte-identical output.

<!-- english-original-anchor --> <a id="解讀與限制"></a>
## Interpretation and limits

The failure mechanism was confirmed by the [fan-in measurements](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/de2395a3f4cf56a302fa2db71bae3476b10380de) and fixed: Chrome sums points with more than two inputs in a different order for each new graph; after the fix every summation point has at most two inputs. attempt03 (parser comparison key order) and attempt04 (parser Worker missing helper) FAILs are harness issues, with original records retained; [attempt03 independent full-file analysis](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/6ca21cc8894647d0d4278197e31dcb4e5dd00bc7) also obtains the same 0 error.

This is a Vite-fixture-driven native OfflineAudioContext method using fixed recording input (3601 ticks, 2 owners); it is not product UI 60-second recording→render→download (the S4 pipeline lane), hardware listening, SPL, Computer Use or 600-second performance.
