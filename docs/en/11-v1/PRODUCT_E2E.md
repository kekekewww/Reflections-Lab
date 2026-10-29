<!-- english-source: {"path":"docs/11-v1/PRODUCT_E2E.md","sha256":"7a72b3ff9e82dcd45a1f7f6c3d0756ec0f33f91c9953cd1a4f04ff22476141ab","translated_at":"2026-10-27T07:17:16Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/PRODUCT_E2E.md`](../../11-v1/PRODUCT_E2E.md). Source SHA-256: `7a72b3ff9e82dcd45a1f7f6c3d0756ec0f33f91c9953cd1a4f04ff22476141ab`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="產品鏈-browser-驗收"></a>
# Product Pipeline Browser Acceptance

Current direct evidence: **all four formal cases on the fixed `22ca0c47…` Chinese product bundle achieved 4/4 PASS**, including the complete product pipeline in three independent clean contexts and WAV reconnection; the A/B numerical population defect was fixed and validated in this round. The [raw results](../../../artifacts/v1/product-e2e-chrome-20261027T033616Z/verification.json) and [case-by-case summary](../../../artifacts/v1/product-e2e-chrome-20261027T033616Z/suite-summary.json) retain the actual version and recovery counts. Subsequent bilingual, head/favicon, and final UX fixes still require validation on a newly fixed bundle; this result does not automatically cover subsequent changes or establish a performance or device-listening-test pass.

The raw failures, single functional result, and numerical defect from the four earlier diagnostic rounds are retained below; the final pass cannot rewrite history. Root centrally coordinates the source freeze and mutually exclusive test windows.

The original cold Chrome / SwiftShader native product case remains **FAIL: recording safely paused for overload at tick9, and Grab remained disabled**. The original [verification](../../../artifacts/v1/product-e2e-chrome-20261027T021924Z/verification.json), console / video / trace, and exact tested bundle are retained; source / bundle / Harness were unchanged before and after that round.

That round also found that teardown of Playwright's cmd-hosted Vite preview hung. Only after checking the PID / parent / command line and closing the owned preview did the CLI finish and archive the results; see [cleanup evidence](../../../artifacts/v1/product-e2e-chrome-20261027T021924Z/cleanup.json). The launcher has been changed so that Node directly owns the preview, records its PID, and bounds total time and the cleanup deadline; validation in a new round is pending.

Second round on 2026-10-27: the launcher negative case produced the expected exit1 with “No tests found,” finished in 6.1 seconds, and launched zero browsers; [PID tree cleanup](../../../artifacts/v1/product-e2e-chrome-20261027T024030Z/owned-processes.json) was PASS_ZERO_REMAINING. The subsequent [actual Chrome case](../../../artifacts/v1/product-e2e-chrome-20261027T024059Z/verification.json) on the new v4 bundle still **FAIL**: real readiness reached tick7, native clock0.541s, 1 voice, and 5 fresh paths, but all 8 explicit recovery attempts were exhausted; after Grab succeeded, Throw remained disabled during repeated safety pauses, and Impact / A-B / reload had not yet been verified. The recording run ID and revision remained unchanged, stopping at tick78; this does not mean that complete no-loss acceptance passed.

In the second round, CLI / Chrome / ffmpeg / preview shut down normally, and a native Windows process-tree audit confirmed zero remaining processes; source / bundle / Harness were unchanged before and after. The original trace/video, recovery log, and exact tested bundle were saved. The original failing profile was fixed to SwiftShader + Playwright screenshots/video/DOM trace; its observation overhead has not yet been separated from product cost, so the failure is not inferred to be a formal physical-GPU performance result.

Root has authorized subsequent functional diagnosis to first reach readiness in the editor using a real native source / HRTF / delay / fresh solver results, then explicitly Pause + Reset, and then enter FPS to start recording. Recording overload permits at most 8 explicit UI Resume actions, recording the pause reason / tick / run ID for each; recording must not be reset, ticks dropped, catch-up relaxed, or product policy changed automatically. The final checks still cover continuity of all raw ticks, an unchanged epoch, and all original sound / hash / A-B assertions. This does not remove the obligation to measure cold-start or formal performance.

The third-round [observer-light / SwiftShader diagnosis](../../../artifacts/v1/product-e2e-chrome-20261027T025205Z/diagnostic-summary.json) disabled continuous video / action screenshots but still **FAIL** after 8 recovery attempts; the original 68-frame recording and hash are preserved, and partial Grab success cannot be treated as the whole pipeline passing. The actual renderer was SwiftShader; active RAF gap p95=237.5ms, advance p95=43.5ms, and bridge + capture tick p95=10ms. Exact timestamp checks confirmed that no other Node / storage tests overlapped that round.

The fourth round removed only the custom forced GL / SwiftShader flags, keeping the exact same `77ccfece…f5cdec` bundle, 1440×1000 / DPR1, observer-light, readiness, and all script assertions. The actual GPU was RTX 4070 D3D11, and the functional script achieved **1/1 PASS (numerical repair and acceptance remain pending separately)**: 81 frames at ticks4–84, continuous epoch / ticks, exact initial tick boundary, matching canonical SHA and reload hash, exactly 1 accepted Grab / Throw, and no recovery. Active RAF gap p95=16.8ms / max33.4ms, advance p95=13.7ms, and bridge + capture tick p95=6.7ms. This was a short functional diagnosis and cannot serve as a formal performance benchmark.

The fourth round deliberately reused the old bundle to isolate the renderer factor; the current source had separately repaired Replay Inspector, so `sourceMatchesBuildAtStart=false`. The launcher's overall exit1 is retained accurately, with the original Playwright exit0 and 1/1 PASS listed separately. The bundle / Harness were unchanged before and after that round, and zero browser / preview / CLI processes remained; the [exact tested bundle reference](../../../artifacts/v1/product-e2e-chrome-20261027T030150Z/tested-bundle-reference.json) checks all 10 archived file hashes. This does not establish that the old Replay Inspector display limitation was repaired.

The subsequent [independent numerical review](../../../artifacts/v1/product-e2e-chrome-20261027T030150Z/independent-review.json) recalculated precisely: the A mean included 118 direct routes, leaving only 116 after excluding two diagnostic routes from fading / stopped sources; the difference between the two means exactly equaled the B−A direct delay difference shown in the UI. B reevaluation retained only playing sources, making the populations inconsistent; the difference cannot be attributed to material. The metrics owner fixed eligibility / method / count and added a real Root regression for this defect before it entered the final three acceptance runs; original diagnostic paths were not changed and tolerances were not relaxed. The subsequent Harness additionally saves raw B / the full comparison for independent recalculation after closing the context.

<!-- english-original-anchor --> <a id="固定四案例的後續結果"></a>
## Subsequent Results for the Four Fixed Cases

The `22ca0c47490f3fc4e73e400cbd9d795b072c61e8e0dad6fa746955f0e9739d5a` build from 2026-10-27 03:36 UTC completed 4/4 on Chrome / RTX 4070 D3D11 with the `light` / `default` profile, with zero skip / flaky; Playwright and the wrapper exited 0, source / bundle / Harness matched before and after, all 10 bundle files were archived, and owned-process cleanup left zero remaining.

The three main flows had 0 / 2 / 7 explicit safety recoveries respectively; all 82 / 106 / 116 recorded frames retained continuous ticks, the same epoch, and recalculable hashes. The A / B direct-metric populations were 115 / 115, 144 / 144, and 152 / 152 respectively, and the direct-delay difference for each material change was 0. Diagnostic paths from stopped sources remain in the raw data, but no longer enter the playing-source statistical population. This supports the functional pipeline and numerical comparison for the fixed version; multiple recoveries and the retained high-cost tail remain performance limitations, and smooth playback or a 10-minute budget pass is not claimed.

<!-- english-original-anchor --> <a id="實際入口"></a>
## Actual Entry Points

```powershell
node tests/browser/build-product-preview.mjs
node tests/browser/run-product-e2e.mjs
```

The normal CLI defaults to `light` / `default`, matching the product's normal GPU path; environment variables may also be set explicitly:

```powershell
$env:PRODUCT_BROWSER_CHANNEL = 'chrome'
$env:PRODUCT_OBSERVER_PROFILE = 'light'
$env:PRODUCT_GPU_PROFILE = 'default'
node tests/browser/build-product-preview.mjs
node tests/browser/run-product-e2e.mjs --grep 'clean launch'
```

`light` retains console, failure screenshots, source / API trace, and timing, without continuous video / DOM snapshots; `default` only removes custom forced renderer flags, and the actual renderer is still determined by a WebGL query. Native API graph and clock evidence does not equal device listening tests.

To reproduce the original high-observation-overhead / software-renderer conditions, explicitly set `$env:PRODUCT_OBSERVER_PROFILE = 'instrumented'` and `$env:PRODUCT_GPU_PROFILE = 'swiftshader'`. Historical failures from these separate profiles are not rewritten because the normal GPU passes. The receipt preserves the effective environment settings, actual browser command line, and source / bundle hashes together.

For one exploratory run, pass `--grep "clean launch 1"`; this is not the complete suite. The four formal cases comprise the full product pipeline in three independent Playwright browser contexts, plus reconnection of the original WAV in another empty storage context.

The same frozen bundle can also run in another installed browser / engine; run only one at a time to avoid interfering with performance measurements:

```powershell
$env:PRODUCT_BROWSER_CHANNEL = 'msedge'
node tests/browser/run-product-e2e.mjs
```

`PRODUCT_BROWSER_CHANNEL` accepts only `chrome` (default), `msedge`, `firefox`, and `webkit`. Firefox/WebKit must still actually launch successfully and pass the cases; the existence of a cache does not establish a validation pass. Independent-engine results are kept separate from Chrome/Edge.

<!-- english-original-anchor --> <a id="測試界線"></a>
## Test Boundaries

- Real UI operations: confirming rights to / importing the original test WAV, the user gesture that enables a native AudioContext, controls without pointer lock, Grab/Throw, and Save/Load.
- Public Runtime API: scene / rule authoring operations, capture, acoustic A/B with identical motion, replay/seek, and raw recording export. These are not represented as Inspector click acceptance.
- Verify the original physics event ID → AudioEvent → same-tick contact emitter / AcousticFrame; successful native source start, advancement of the actual context clock, and Delay/HRTF nodes connected to AudioDestination. This is native API and connection-graph evidence; it does not establish hardware listening tests or PCM audio-quality acceptance.
- A/B compares fixed motion / source hashes, actually re-solved propagation content, and different material hashes; the original A artifact must not be overwritten.
- Material B's direct-delay mean must exactly match A; both metric populations require logical playing sources, the same nonzero sample count, and compatible semantic query keys. The full actual Host comparison result is retrieved through an explicit read-only test seam and saved with raw A / B; this introspection is not called a UI operation.
- Save/Reload must restore the original recording hash / decoded assets; the seek pose must exactly match the recorded frame, and resume must create a new native sample source.
- The empty storage context first explicitly rejects a missing WAV; the wrong file must not trigger reconnection. Renaming the exact original file must still preserve its original ID / revision / SHA, without contaminating the current project before applying it.
- Complete console/page errors, the downloaded original recording, images, and failure traces are retained; no model is called.

<!-- english-original-anchor --> <a id="來源與證據保存"></a>
## Source and Evidence Preservation

The fixed preview uses `test-results/product-preview-dist`, port `5190`, and is started and stopped directly by the run wrapper, without a cmd-hosted Playwright webServer. The build manifest records all src/schema/config/lock inputs and bundle hashes; the run wrapper re-enumerates files, checks additions / deletions and content changes, and separately saves Harness hashes before and after. Every engine archive retains the full build manifest.

Raw execution output is under `test-results/product-e2e*`; each round is additionally saved to a unique `artifacts/v1/product-e2e-<browser>-<UTC>`. `verification.json` must check test exit, report freshness, and source/bundle/Harness stability together. Earlier failure evidence is retained and is not overwritten by later results.

The 10-minute performance run separately uses `node tests/browser/performance-profile.mjs --phase all --seconds 600`; see the Browser performance document in the same directory. Native nodes are not represented as AudioWorklet p99; device listening tests / SPL / Meta live retain separate statuses.

<!-- english-original-anchor --> <a id="r17-維護入口補充"></a>
# R17 maintained entry point supplement

The current UI uses on-demand disclosure. The maintained entry points are:

```powershell
node tests/browser/run-product-refined-v3.mjs
node node_modules/@playwright/test/cli.js test --config tests/browser/linked-workflow-v2.config.ts
```

Original entry points and v2 sources remain. V3 waits for an actually published tick only for unaccepted Grab, then retries within bounds; the original shared eight-recovery limit, Throw and final assertions of four cases remain unchanged. Controls first reproduce the old flow and delayed acceptance, then are independently reverified; process exit 0 does not imply performance or listening passed.

[R17 integration](../../../artifacts/v1/r17-browser-verification-20261029/verification.json) passed all four cases, including the originally defined three independent browser contexts. Two additional independent browser processes were run: the second passed all four; the third exhausted recovery before an impact and passed three with one failure. The [original failure](../../../artifacts/v1/r17-three-clean-launches-20261029/verification.json) is retained; do not claim all three processes passed. The original definition of three clean starts below remains unchanged; no OS restart or three different PID requirement was added.

API evidence for actual impact sound/recording/A/B/reload is separate from human listening. Safe pauses remain possible under low performance or observation load; full 600-second performance, physical input, device listening and external rights retain separate statuses.
