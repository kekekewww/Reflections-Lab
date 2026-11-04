<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/performance/03-qualification-pcm-plan.md","sha256":"36da65cb77641028219705232fc26177de77b18b1037939afc66ba41701c663d","translated_at":"2026-11-03T09:52:55.811Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/performance/03-qualification-pcm-plan.md`](../../../../16-nonadvanced-completion/lanes/performance/03-qualification-pcm-plan.md). Source SHA-256: `36da65cb77641028219705232fc26177de77b18b1037939afc66ba41701c663d`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="新版資格與數位pcm歸因待執行有限矩陣"></a>
# New qualification and digital PCM attribution: pending bounded matrix

This page is a method proposal/execution-freeze candidate, not qualification or measurement evidence. Original V3 workload, dual pins, strict parser, numerical kernel, trace caps and historical FAIL remain unchanged. All runs initially are NOT_RUN and execute serially under Root's exclusive machine lease.

<!-- english-original-anchor --> <a id="browser語義資格v1"></a>
## Browser semantic qualification (v1)

1. Run the original entry point with current Chrome and original `--formal-600` arguments; preserve the actual launcher dual-pin rejection without changing original V3 to make it PASS.
2. Create a separate owned static pilot page without product bootstrap/other RAF to avoid build cost; 45 seconds work, 10 seconds cleanup, at most 128 callbacks, 8 MiB gzip/32MiB expanded/200000 events. The collector still uses original V3_LIMITS; 128 is an external pilot cap.
3. Before trace, register/cancel PC, then register P0/P1; pause at an exact debugger breakpoint within the same JS task. Node starts trace and resumes, then creates begin in the same task, ensuring real pretrace-pending without relying on a race. This intervention is semantic qualification only, not performance data.
4. Fix 24 callbacks/13 RAF groups, group sizes `[2,3,2,1,3,2,1,2,2,1,2,1,2]`; G0/G1 each nest H0/H1, B1 registers/cancels MC, and E0 proof mark specifies startTime=0. Final L1 schedules only a timer, closing after its Fire span ends.
5. Three-way comparison: independent operation journal/collector receipt/raw native trace. Retain original strict `validateNativeV3()` and original Float64/clock membership rules; the new oracle does not import collector/bits/name helpers. Do not mutate/overwrite original raw; synthetic negative clones are separately saved and labeled.
6. Bind source/oracle/parser/raw/actual `Browser.getVersion` revision/launcher before-after hashes/document identity/GPU/hardware and method version; add a finite new qualification entry only after independent review. Pilot success proves only semantic qualification; original 20-second all-wiring and full 600-second formal profile are still required.

<!-- english-original-anchor --> <a id="受控pcm歸因test-only-tap-v1"></a>
## Controlled PCM attribution (test-only tap v1)

The original formal fixture's muted native graph remains unchanged. A separate controlled fixture uses the same AudioEngine/propagation graph; the test output adapter must explicitly identify the actual node/graph version chosen and fail closed when connection points are absent. Browser physical sound is handled by an explicit mute flag while retaining digital audio flow; this is not actual device listening.

| Case | Fixed input/single intervention | Distinct interpretable fields |
| --- | --- | --- |
| PCM01 | steady110 Hz, fixed source/listener/path, no stall | Native onset/output stats/real PCM baseline |
| PCM02 | Same as PCM01, controlled main-thread stall, steady native source uninterrupted | Main stall interval, control age/late onset, PCM/native output results separately |
| PCM03 | Backdated emission scheduled through real `playVoice` | Requested/actual audio-onset lateness; late onset is not underrun |
| PCM04 | Real stale update/path birth-death/voice or path budget rejection | Snapshot decisions, admission/path loss and PCM separate; counters alone do not establish an audio gap |
| PCM05 | Same fixed source; test-only gain in actual output chain schedules bounded 100 ms silence | Demonstrates distinction between digital gap, native underrun and late control; explicitly artificially injected rather than a product bug |

Freeze a legal matrix and expected active windows for every case first; probe-on/off share graph, source/control schedule/device/rate, with no tap when off. Preserve original PCM, schedule, diag/native stats, actual block lengths and settings. An independent parser checks bytes/frame/channel/finite/known active-window silence/continuity. Legitimate phase changes from filters/HRTF/path changes must not be labeled clicks based only on maximum sample difference; acoustic numerical tolerances stay unchanged.

The tap preallocates a fixed pool in the processor constructor for at most 10 seconds, 2ch, actual 8k..384 kHz and PCM≤32 MiB. Process uses actual input/output block lengths only, without a 128 fallback, and crops the exact frame window. Fixed 16 block-length buckets; overflow, missing input, channel mismatch, nonfinite and render-frame gap/overlap are all explicitly INVALID. Cancel yields no PCM and does not publish COMPLETE. Completion transfers the buffer once only; no callback network/log/unbounded allocation. Native DSP CPU and hardware-underrun fields remain null; hardware statistics are collected separately through available native APIs.

<!-- english-original-anchor --> <a id="同條件probe-overhead與正式profile"></a>
## Identical-condition probe overhead and formal profile

- Directly measure on/off costs for each controlled PCM case; one difference does not establish cross-run reliability. Separate available process CPU, wall/simulation time, load counts and known JS/native bytes; unknown opaque DSP/GPU memory and device route are null.
- Original formal on/off both retain all/UI600wall/physics3000/acoustic600, original 8 sources/32 surfaces/default and 256 stress paths, 10-second warmup and 1-second captures at 10/300/580 seconds. Off removes only optional observation and is not a reduced-load candidate.
- Pairing must verify source/bundle/browser/device/scene/caps and actual actions/captures/ticks; if actual workload is incomplete, two numbers cannot establish pure probe overhead. Off has no trace/sample timing, so corresponding gates are NOT_RUN/null rather than turning missing into 0 or PASS.
- List 600-second wall/simulation/capture durations separately; 18000-frame/byte caps stay unchanged. Out-of-window drain is separate and does not backfill the formal window. Preserve every rejection/failure from original V3 and new runs.