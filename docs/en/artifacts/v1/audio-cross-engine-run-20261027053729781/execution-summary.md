<!-- english-source: {"path":"artifacts/v1/audio-cross-engine-run-20261027053729781/execution-summary.md","sha256":"4d6195ac7d0be5dd35bdbdac7aff61975d02236ed8e507b0eceda87bd05ac0f2","links":"english-relative","translated_at":"2026-10-27T07:04:49.5163630Z","model_id":null,"executor":"Codex"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/audio-cross-engine-run-20261027053729781/execution-summary.md`](../../../../../artifacts/v1/audio-cross-engine-run-20261027053729781/execution-summary.md). Source SHA-256: `4d6195ac7d0be5dd35bdbdac7aff61975d02236ed8e507b0eceda87bd05ac0f2`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="native-跨引擎執行紀錄"></a>
# Native Cross-Engine Execution Record

2026-10-27, executed by Codex; Windows, Playwright 1.64.1, existing cached engines. Overall **FAIL／exit 1**; cross-engine success cannot be claimed. The product code, six original suites, and their numerical thresholds were unchanged.

Actual command (after native process／loopback socket permission failures in the sandbox, the same runner was executed through authorized elevated execution):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\kevin\AppData\Local\ms-playwright'
node tests/audio-runtime/run-cross-engine.mjs --run --engines firefox,webkit
```

| Actual engine version                           | PASS | FAIL | BLOCKED_CAPABILITY | NOT_RUN_AGGREGATE_DEPENDENCY |
| ----------------------------------------------- | ---: | ---: | -----------------: | ---------------------------: |
| Firefox 157.0                                   |    8 |    1 |                  9 |                            7 |
| Playwright WebKit 27.2 (Windows cached build)     |    0 |    0 |                 25 |                            0 |

A valid Firefox native render failed `native-pressure-gain-once-and-no-convolver-normalization`. `actualEnergy=0.31246948243551215`, `expectedEnergy=0.3125`, absolute difference `0.00003051756448785`; it did not meet the original `abs(error) < 1e-5`. This result is retained as a numerical **FAIL**; the threshold was not relaxed, latency was not compensated for, and no selective reruns were performed. The other six baseline cases (including finite, nonzero HRTF output) and two WAV native decode cases passed. The root cause of the failure has not yet been determined; this result cannot establish that the root cause in product code or a particular engine has been identified.

Firefox does not provide `OfflineAudioContext.prototype.suspend`, blocking nine cases that depend on that API; another seven were not run because the original aggregate functions cannot return their results independently. This does not establish that those cases themselves are unsupported. The actual page in the Windows cached WebKit build has no `AudioContext`／`OfflineAudioContext` constructor, so all 25 cases were blocked by capability; this observation cannot be generalized to all Safari／WebKit platforms.

`verification.json` and twelve per-suite JSON files retain the original results, native operation traces, capabilities, and before／after SHA-256 hashes; `sourceStable=true`. Both owned BrowserServers closed normally, and the source server closed normally; the elevated read-only CIM check in `process-cleanup.json` showed 0 Firefox／Playwright／WebKit processes. Root and the UI owner were notified with `AUDIOCROSSEND`, releasing the browser slot.

The two earlier environment failures are retained in the sibling directories `audio-cross-engine-run-20261027053658230` (the sandbox's default cache path lacked executables; no browser was launched) and `audio-cross-engine-run-20261027053715567` (after an explicit cache path was supplied, Firefox process crash／WebKit loopback EACCES; no cases were executed); these were not treated as DSP results.

This run covers only the executable scope of a limited set of native DSP／cursor／pause fixtures. Manual listening tests, device latency, SPL, AudioWorklet, long-duration capacity, and the Meta API have not been verified.
