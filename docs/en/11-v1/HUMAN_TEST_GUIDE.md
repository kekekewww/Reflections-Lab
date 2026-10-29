<!-- english-source: {"path":"docs/11-v1/HUMAN_TEST_GUIDE.md","sha256":"697beb812ffb3c41d8481c5bdc98d2e3455865f77a768e5ee12a2bfc3c266301","translated_at":"2026-10-28T19:34:44.999Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/HUMAN_TEST_GUIDE.md`](../../11-v1/HUMAN_TEST_GUIDE.md). Source SHA-256: `697beb812ffb3c41d8481c5bdc98d2e3455865f77a768e5ee12a2bfc3c266301`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->


<!-- english-original-anchor --> <a id="正常比例真人測試指引"></a>
# Human test guide at normal scale

This page applies to the R17 human-test version, with product source checkpoint `cde1e2b0ed7c57228bfa64b01c262b6eeab3cba1`; later documentation checkpoints may differ. Automated functional checks and the 600-second measurement are preserved; high-load performance did not meet targets. See [known limitations](../KNOWN_LIMITATIONS.md); complete V1 is unfinished. The user removed native 200% scaling; keep normal browser 100% scale. Time-limited instructions and test URLs in old handoffs have expired; do not reuse them.

<!-- english-original-anchor --> <a id="一般操作大約五分鐘"></a>
## General operation: about five minutes

1. Run `npm run dev` in the project directory and open the local URL printed in the terminal in Chrome. Keep 100% scale, choose Traditional Chinese or English, and confirm the scene has enough space and primary buttons are visible.
2. Select the default sphere with the mouse and confirm its settings appear on the right. Collapse and expand the bottom analysis area and drag the panel boundaries. Confirm the scene remains usable and text does not cover buttons.
3. Start computation and observe the sphere fall under gravity, collide and bounce. Pause; objects should stop, then resume. Do not treat this simple observation as numerical physics validation.
4. Select “Enter first person” above the scene and follow the on-screen prompts. If mouse lock succeeds but the app remains paused, press **Enter to start**; Enter pauses during computation. Use **W/S forward/back, A/D left/right, and mouse to turn**. Hold a movement key for about one second, then release; the character should move and stop. Entering must not also throw or place an object.
5. Press Esc; the mouse should be released and the application safely paused. Enter again, switch to another window and return; it should first require explicit resume. If the browser refuses mouse lock, record the visible message and test the available unlocked control buttons.
6. Try keyboard Tab navigation and typing in an input. Typing must not accidentally move the character, throw or create objects. Chinese and English interfaces should retain the same scene and recording data.

Report the step, action, expected result and actual result. If first person still fails, include Chrome version, on-screen error text and whether the lock prompt appeared. Mark unobserved items NOT TESTED; do not guess a pass.

After basic movement passes, optionally test grabbing/throwing: approach a movable sphere, aim the crosshair, press **E to grab**, then **left click to throw**, or **E again to release**. If it is too far, blocked or fixed, first record the displayed reason. If mouse lock is refused, explicitly enable unlocked operation as prompted, then use resume, movement and grab/throw buttons; do not repeatedly press enter. Ctrl+C in the launch terminal stops the local service.

<!-- english-original-anchor --> <a id="聲音先耳機再喇叭"></a>
## Sound: headphones first, then speakers

Known available devices are Austrian Audio Hi-x65 and ADAM Audio D3V. Mute and pause before changing devices; start at low physical volume. Record the actual Windows output device, DAC/audio interface and volume for each; use UNKNOWN when unknown.

For a general experience, select “Enable listening” while paused, then start computation. First confirm continuous and impact sounds, then move the Listener to hear directional changes; rotating the editor camera alone does not move the Listener. A volume difference between Raw reference and Simulated is not by itself an error. Observe whether pops, sudden volume jumps or dropouts occur during pause/resume, movement and mode switches; mute and stop immediately if uncomfortable.

When device callback evidence must be preserved, use the [frozen listening tool](../../../tests/browser/device-hearing-v3/README.md) instead and follow the [original listening protocol](../../../tests/browser/device-hearing/manual-probe-protocol.json) with collaborator assistance. This checks the pinned version and records actual callbacks; do not operate the ordinary development page or another preview page simultaneously, to avoid selecting the wrong audio source. It does not judge whether the sound is pleasant or automatically know the DAC, physical volume or calibrated sound pressure.

<!-- english-original-anchor --> <a id="回報範本"></a>
## Report template

The original template below asks for date, Chrome and Windows versions; display scale; language and window size; pass/fail/not tested with steps for layout, controls and first-person entry/movement/Esc; safe pause and explicit resume; headphones or speakers, Windows output, DAC and volume; direction/distance; continuous and impact sound; pops, volume jumps or dropouts; pause/resume listening; and listening time, untested items and other issues.

```text
日期／Chrome版本／Windows版本：
顯示比例：100%
介面語言／視窗大小：
正常版面與控制：通過／失敗／未測；具體步驟：
第一人稱進入／移動／Esc退出：通過／失敗／未測；具體步驟：
失焦後安全暫停與明確繼續：通過／失敗／未測
耳機或喇叭／Windows輸出／DAC／音量：
方向／距離：
持續聲／碰撞聲：
爆音／音量突變／斷音：
暫停／繼續的聽感：
聽測時間／未測項目／其他問題：
```

Record this feedback separately from automated tests, performance figures, source licenses and external competition gates; completing the template does not establish that the entire first version is complete.
