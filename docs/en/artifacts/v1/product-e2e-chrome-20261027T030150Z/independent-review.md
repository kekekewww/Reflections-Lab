<!-- english-source: {"path":"artifacts/v1/product-e2e-chrome-20261027T030150Z/independent-review.md","sha256":"757be7a66ef8266740d4ab6eace4d95d4a4b05a692cd4f8d84d755af4c2a8f34","links":"english-relative","translated_at":"2026-10-27T07:04:49.5163630Z","model_id":null,"executor":"Codex"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/product-e2e-chrome-20261027T030150Z/independent-review.md`](../../../../../artifacts/v1/product-e2e-chrome-20261027T030150Z/independent-review.md). Source SHA-256: `757be7a66ef8266740d4ab6eace4d95d4a4b05a692cd4f8d84d755af4c2a8f34`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="產品鏈診斷的獨立唯讀稽核"></a>
# Independent Read-Only Audit of Product-Chain Diagnostics

This archive is a single Chrome／RTX 4070 diagnostic run of the fixed `77ccfece…` bundle. Playwright passed 1／1, with no retries, skips, or explicit overrun recovery; the current source does not match the bundle, so wrapper exit 1 is correctly retained. This is not the final acceptance of three clean launches.

The raw data was checked directly: the ticks of the 81 frames are 4–84, continuous and within the same epoch; tick 3 before the initial Record corresponds to the first frame, 4. The independent canonical SHA-256 exactly matches the recording's declaration: `816cd283828f3cc33610421fbb1cde8b59a2d539ec98fccd70b2c9d01d1a8253`. One OnGrab (tick 11), one OnThrow (25), and one OnImpact (78) each link to an accepted raw physics event in the same frame. The impact route starts at the contact emitter and ends at the Listener at that time; a 48 kHz native context is running, and the existing connection of the 440 Hz source can reach AudioDestination through a positive delay and HRTF panner. The artifact hash is identical after restoration.

A definite metric population defect was found:

| Original A sampling scope | Count | Mean direct delay (s) |
| --- | ---: | ---: |
| All available direct routes included by the current metric | 118 | 0.01592289576547707 |
| Only sources with `playbackState=playing` in the same frame | 116 | 0.016036576002133818 |

The difference between them, `0.0001136802366567477 s`, **exactly equals** the B−A recorded on screen, with a residual of 0. The two additional entries in A are stop／fading diagnostic routes at ticks 25 and 39. The formal capture retains stop diagnostics; the B processor solves only playing sources; the metric nevertheless averages all routes. This direct-delay change therefore comes entirely from different sampling populations and cannot be attributed to changing the absorption material. Eligibility for samples that actually emit sound should be made consistent on both sides, keeping diagnostic data while excluding it from the emission metric, followed by regression verification.

The fixed conditions in the A/B fingerprints, including motion, raw events, listener, source, profile, and geometry, agree; only the propagation material differs. However, this archive did not retain raw B, so its propagation／numerical differences cannot be recalculated independently after the page has closed; the final round needs to retain B and the comparison results. Native graph evidence does not represent manual listening tests, PCM energy, or AudioWorklet deadlines.

Calculations, source locations, and raw-file hashes are in [independent-review.json](../../../../../artifacts/v1/product-e2e-chrome-20261027T030150Z/independent-review.json); that JSON's SHA-256 is `916c2c5a92a082e11dcb1ae57236f8015de9467f56db2574b8b7d908317c0fe7`. This audit made no changes to product／test sources and did not execute browser, build, or model calls.
