<!-- english-source: {"path":"artifacts/v1/user-requested-pause-20261028/USER_TEST_CHECKLIST.md","sha256":"6fe8aa22971b5734db626adfb01fb674aa466b0ce5efc633bcb22eea358fa6c4","translated_at":"2026-10-28T09:05:22.573813+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/user-requested-pause-20261028/USER_TEST_CHECKLIST.md`](../../../../../artifacts/v1/user-requested-pause-20261028/USER_TEST_CHECKLIST.md). Source SHA-256: `6fe8aa22971b5734db626adfb01fb674aa466b0ce5efc633bcb22eea358fa6c4`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="待使用者測試user-tests-for-a-later-session"></a>
# User tests for a later session

Status: paused at the user’s request; all items below are NOT RUN / DEFERRED, with no new PASS or FAIL. No action is needed now. Old localhost URLs, preview windows and PowerShell commands have expired and must not be reused.

Status: paused at the user's request. These tests remain NOT RUN / DEFERRED; no new pass or failure is inferred. No action is needed now. Previous localhost URLs, preview windows and PowerShell instructions have expired and must not be reused.

<!-- english-original-anchor --> <a id="1-原生桌面互動native-desktop-interaction"></a>
## 1. Native desktop interaction

- [ ] When this test is explicitly resumed, prepare and verify the current build, an isolated Chrome test window, a valid URL and test commands; the desktop must be unlocked and the screen awake. No test window is available now.
- [ ] Verify actual native browser 200% zoom, focus and operability; check layout and control accessibility at a 320 CSS px viewport. Label viewport emulation separately; it is not native zoom.
- [ ] Enter and exit Pointer Lock and record results, errors and screenshots; code review and a hidden window cannot substitute for this evidence.

When this test is explicitly resumed, prepare and verify a fresh build, isolated visible Chrome window, URL and command. With the desktop unlocked and awake, verify actual native 200% browser zoom, focus, reachability and the 320 CSS px viewport case (label viewport emulation separately). Enter and exit Pointer Lock and record the observed results. No test window is currently available.

<!-- english-original-anchor --> <a id="2-裝置聽測device-listening"></a>
## 2. Device listening

- [ ] Devices previously supplied by the user: Austrian Audio Hi-x65 headphones and ADAM Audio D3V speakers; record the actual device used for each when convenient.
- [ ] Prepare and verify a listening page for the current version; keep playback paused initially, start with low device volume, then enable listening. Follow the existing listening protocol and do not use old URLs.
- [ ] Record the Windows output route, DAC/audio interface and volume; record AudioContext sample rate/block size when observable, or UNKNOWN when unavailable.
- [ ] Record actual observations and anomalies for direction/distance, reflection/occlusion, contact/continuous sources, A/B and playback/pause. Preserve scene and conditions when comparing, and distinguish acoustic A/B from behavior A/B.

Reported devices: Austrian Audio Hi-x65 headphones and ADAM Audio D3V speakers. Later, prepare a freshly verified listening page, begin paused at low device volume, and follow the existing listening protocol. Record the actual Windows output route, DAC/interface, volume, and observable sample rate/block size; use UNKNOWN when unavailable. Record spatial, reflection/occlusion, contact/continuous-source, A/B and playback observations, preserving comparison conditions and distinguishing acoustic from behavior A/B.

Actual output route, sample rate, block size and hearing observations remain UNKNOWN. Automated graph/DSP checks do not establish human listening quality or calibrated SPL.

<!-- english-original-anchor --> <a id="暫停邊界pause-boundary"></a>
## Pause boundary

The saved formal Git checkpoint is `6aafa976c96c810027153eae214a47c0a2a4dd87`; the pause handoff and later metadata remain uncommitted. V1 remains incomplete: formal performance, some acceptance and external rights/competition gates still require work, so remaining user tests do not mean only manual tests remain. All automated engineering, agents and tests have stopped; no automatic resume is scheduled.

The saved implementation checkpoint is `6aafa976c96c810027153eae214a47c0a2a4dd87`. Later metadata and this pause handoff remain uncommitted. V1 acceptance is still incomplete: performance and external rights/competition gates also remain. All automatic engineering, agents and tests are stopped; no automatic resume is scheduled.
