<!-- english-source: {"path":"artifacts/v1/product-archive-independent-review-20261027T071354Z/REVIEW.md","sha256":"5a0a6c5334b52a797b49ead75994b58346c9ecdae3e660584b8ed3f98909e200","translated_at":"2026-10-27T07:35:37.3446182Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/product-archive-independent-review-20261027T071354Z/REVIEW.md`](../../../../../artifacts/v1/product-archive-independent-review-20261027T071354Z/REVIEW.md). Source SHA-256: `5a0a6c5334b52a797b49ead75994b58346c9ecdae3e660584b8ed3f98909e200`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="中文固定產品鏈封存的獨立稽核"></a>
# Independent Audit of the Archived Fixed Chinese Product Chain

This report checks only the historical fixed version `product-e2e-chrome-20261027T033616Z`, whose build input digest is `22ca0c47490f3fc4e73e400cbd9d795b072c61e8e0dad6fa746955f0e9739d5a`. This audit did not rerun tests, browsers, builds, servers, or models, and did not modify the old archive. These results cannot establish that the current bilingual additions, sound diagnostics, or other repairs have passed the product chain.

The audit found no actual failures within this scope. The original Playwright results show four cases passing, each executed once, with no retry, skip, or flaky result. Independent calculations include [63 raw-data determinations](../../../../../artifacts/v1/product-archive-independent-review-20261027T071354Z/arithmetic-review.json) and [23 trace／native control-graph determinations](../../../../../artifacts/v1/product-archive-independent-review-20261027T071354Z/trace-review.json); these are audit items for existing evidence, not 86 new product tests. Complete conclusions and file hashes are in [review.json](../../../../../artifacts/v1/product-archive-independent-review-20261027T071354Z/review.json) and [review-receipt.json](../../../../../artifacts/v1/product-archive-independent-review-20261027T071354Z/review-receipt.json).

<!-- english-original-anchor --> <a id="雜湊與來源"></a>
## Hashes and Sources

The canonical SHA-256 hashes for all three sets of original A and candidate B were independently recalculated and matched; the two complete artifacts retained in each comparison also equal their respective original JSON. The original ticks, single epoch, and boundary from the pre-capture tick to the first frame all match. The complete artifact after storage reload was decoded from the trace and is deeply equal to raw A.

The physical hashes of all 10 retained bundle files match the build manifest／copy receipt. The original contents of another 86 `src/` files can be recovered from the retained source map, and all match the build input hashes at that time; the test source texts in the five traces all match the archived Harness SHA `88113fc25097538e389e8b0b3d39dd329218b3fcc30f74200575d586561b603d`.

The stability of the sources, bundle, and Harness during execution was checked against the guard receipts from that time and the before／after Harness hashes; current file contents were not treated as historical sources. The original cleanup receipt records zero remaining processes in the owned Chrome, CLI, and preview process trees; this is not an inventory of all current system processes.

<!-- english-original-anchor --> <a id="ab-與事件鏈"></a>
## A/B and Event Chain

| Clean context | Frames／ticks | Explicit recovery | A／B valid direct samples | Direct delay Δ |
| --- | --- | --- | --- | --- |
| 1 | 82／7–88 | 0 | 115／115 | Exactly 0s |
| 2 | 106／4–109 | 2 | 144／144 | Exactly 0s |
| 3 | 116／4–119 | 7 | 152／152 | Exactly 0s |

The valid population was independently established from each frame's Behavior snapshot at the same tick and its voice metadata, retaining only logical playing sources; two stop／fade diagnostic entries were excluded from each A, and B does not contain those two entries. The semantic query keys and actual band sets match on both sides. The direct-delay mean and the mean sum of squared path pressure ratios, their differences, sample counts, and method provenance all exactly match the actual Host comparison result.

The B−A values of the three path-energy estimator sets are `-0.004280614542044564`, `-0.0042497673928876545`, and `-0.00435420587831177`. These values are geometric path pressure-ratio estimates, not rendered PCM energy, sound-power measurements, or SPL. The original motion, listener, and physics events are identical; authoring changed only the acoustic material of `wall.back`, alongside normal scene revision and candidate run ID changes. The other fixed-condition fingerprints match, while the propagation material fingerprint differs.

Each set has one accepted Grab and Throw, along with real Impact events. AudioEvent points to an accepted physics parent in the same frame; Impact uses a real contact point, corresponding to the source endpoint in the AcousticFrame at the same tick, and ends at that frame's listener. Recovery did not add accepted Grab／Throw events and did not reset or lose recording ticks.

<!-- english-original-anchor --> <a id="原生控制圖重播與重連"></a>
## Native Control Graphs, Replay, and Relinking

Each of the three sets has one native 440Hz source start; this frequency is configured only for Impact in this fixture. Using the connection log prefix at the time of the successful start, a connection chain through Delay and HRTF (rolloff=0) to AudioDestination can be found in every set. The native contexts are all 48kHz and running, and their clocks have advanced.

This is evidence of native control API calls and connection construction. The connection records do not contain disconnect chronology; positive Delay values were sampled when collecting the graph, without independently recording every edge and parameter at the exact start instant. Prefix BFS cannot be presented as a measurement of hardware PCM, listening tests, or the entire graph at the precise start instant.

All three traces confirm that no hardware AudioContext existed before reload, and that native sample starts and active voices appeared after replay; replay time remained unchanged after Pause. Seek ticks are 13／10／10, each equal to A start+6, with poses exactly matching raw frames; after Resume, time and new sample starts advanced. Multiple native source handles do not equal multiple accepted triggers; path arrivals and recovery can create multiple handles. The third set has 8 native110Hz starts, so one cannot claim that there was only one native Grab source start.

The target trace for the independent store confirms that a missing WAV reports `ASSET_REQUIRED_MISSING`, and incorrect bytes report `ASSET_RELINK_MISMATCH`; the scene remains unchanged after rejection, and assets remain empty before Apply. Renaming the original file restores the same asset ID, revision1, SHA `235d44fbedac9e915beb597ddcf5f208da7e5d9ccab2d1a330f0fe96ba781f3d`, and ready status, with context and native start counts of 0. WAV bytes regenerated using the archived fixture algorithm also have a matching SHA.

<!-- english-original-anchor --> <a id="限制與凍結"></a>
## Limits and Freeze

- Source-phase evidence in both A and B is `logicalIntent`／`NATIVE_CURSOR_PARTIAL`; this does not establish equivalence of native waveforms or actual rendered phase.
- The three clean browser contexts share one browser process; three independent process cold starts are not claimed.
- The 0／2／7 explicit recoveries and short recording timing do not establish smoothness or passage of the formal 600-second performance test; overload records were not deleted.
- Human hearing, hardware PCM／SPL, AudioWorklet deadlines, and cross-engine verification are outside this scope.
- This directory contains new audit output; the old archive was not modified. The narrative and receipt are frozen after `FINALDOCEND` is issued; to recalculate, copy this directory to a new path before executing the calculation program to avoid overwriting this report.
