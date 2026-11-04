<!-- english-source: {"path":"docs/11-v1/HUMAN_TEST_GUIDE.md","sha256":"d90b877a39f1d4e08fbeba6d3e0328eb70305e925d704240b914504b6949f60a","translated_at":"2026-10-31T12:09:59.000Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/HUMAN_TEST_GUIDE.md`](../../11-v1/HUMAN_TEST_GUIDE.md). Source SHA-256: `d90b877a39f1d4e08fbeba6d3e0328eb70305e925d704240b914504b6949f60a`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->


<!-- english-original-anchor --> <a id="正常比例真人測試指引"></a>
# Human test guide at normal scale

This page applies to the R19 retest version (repairs for the R18 human report), with product source checkpoint `5e56260b1a9242e29c4afe6ce393bd8a37986320`; later documentation checkpoints may differ. After that, R20 repaired the F-freeze and placement status hints, the B-key build preview, English in the status line, the acoustic note for curved bodies and the WebGL fallback text, following the automated retest; test the latest version of this branch, and see the [complete test procedure](FULL_TEST_PROCEDURE.md) for the full scope. The R17 automated functional checks and the negative 600-second performance results are preserved; high-load performance did not meet targets. See [known limitations](../KNOWN_LIMITATIONS.md); complete V1 is unfinished. The user removed native 200% scaling; keep normal browser 100% scale. Time-limited instructions and test URLs in old handoffs have expired; do not reuse them.

Three R19 changes: the click that enters first person now starts the controls, with no second Enter; after selecting an object you can move, rotate and scale it directly in the scene; and the default monitor level is about 23 dB higher (digital level), so **lower the Windows / DAC / speaker physical volume before you start**.

<!-- english-original-anchor --> <a id="一般操作大約五分鐘"></a>
## General operation: about five minutes

1. Run `npm run dev` in the project directory and open the local URL printed in the terminal in Chrome (usually `http://127.0.0.1:5173/`). Keep 100% scale, choose Traditional Chinese or English, and confirm the scene has enough space and primary buttons are visible.
2. Click the sphere directly in the scene: the cursor should become a pointer over objects; after the click a selection outline and the transform tool appear, and its settings show on the right. While Ready or Paused, switch tools with “Move / Rotate / Scale” above the scene and drag a coloured handle; on release the object should update once, and Undo should restore it. Pressing Esc during a drag should cancel it and leave the object unchanged. Spheres scale uniformly. While computing, the tool is hidden and “Pause to drag or scale” is shown. Revisions, coordinates, the path legend and blocked candidates are now in “View details” below the scene; expand it when needed. Also collapse and expand the bottom analysis area and drag the panel boundaries; confirm text does not cover buttons.
3. Start computation and observe the sphere fall under gravity, collide and bounce. Pause; objects should stop, then resume. Do not treat this simple observation as numerical physics validation.
4. Select “Enter first person” above the scene. Once mouse lock succeeds, computation should start directly and the prompt should read “WASD move · Mouse look · Enter pause · Esc release pointer”. Use **W/S forward/back, A/D left/right, and mouse to turn**; hold a movement key for about one second, then release; the character should move and stop. Entering must not also throw or place an object. Enter pauses; while paused, clicking the view or pressing Enter again should resume.
5. Press Esc; the mouse should be released and the application safely paused, with the prompt “Pointer released”. After about one second, clicking the view (or “Enable pointer control”) should lock it again and continue; Chrome briefly refuses an immediate relock right after Esc, which is a browser restriction, so click once more. Switch to another window and return; it should stay paused until you click the view or press Enter. If the browser refuses mouse lock, record the visible message, choose “Enable controls without pointer lock” and “Start first-person controls”, click the view, then use WASD, the arrow keys and Enter, or the buttons below.
6. Try keyboard Tab navigation and typing in an input. Typing must not accidentally move the character, throw or create objects. Chinese and English interfaces should retain the same scene and recording data.

Report the step, action, expected result and actual result. If first person still fails, include Chrome version, on-screen error text and whether the lock prompt appeared. Mark unobserved items NOT TESTED; do not guess a pass.

After basic movement passes, optionally test grabbing/throwing: approach a movable sphere, aim the crosshair, press **E to grab**, then **left click to throw**, or **E again to release**. If you press Esc while holding and then lock again, it stays paused until you click the view or press Enter, so nothing is thrown by accident. If it is too far, blocked or fixed, first record the displayed reason. Aiming at an object and pressing **F** fixes it and safely pauses; Enter or a click on the view should continue. Ctrl+C in the launch terminal stops the local service.

<!-- english-original-anchor --> <a id="聲音先耳機再喇叭"></a>
## Sound: headphones first, then speakers

Known available devices are Austrian Audio Hi-x65 and ADAM Audio D3V. Mute and pause before changing devices; start at low physical volume. Record the actual Windows output device, DAC/audio interface and volume for each; use UNKNOWN when unknown.

R19 raises the default monitor from about −15 dB to 0 dB and changes master-mix headroom from about −14 dB to −6 dB; the automated measurement of the default scene's digital output peak rose from about −51 dBFS to −29 dBFS. This is a digital level only, not calibrated sound pressure. The Monitor slider is now shown in dB from −40 to +12 dB; the mute button remains separate. An output safety ceiling follows the limiter, so even extreme settings stay below digital full scale, but this is not a hearing-safety guarantee. Please report whether the default is still too quiet, too loud or suitable.

For a general experience, select “Enable listening” while paused, then start computation. First confirm continuous and impact sounds, then move the Listener to hear directional changes; rotating the editor camera alone does not move the Listener. A volume difference between Raw reference and Simulated is not by itself an error. Observe whether pops, sudden volume jumps or dropouts occur during pause/resume, movement, Monitor adjustment and mode switches; mute and stop immediately if uncomfortable.

When device callback evidence must be preserved, use the [frozen listening tool](../../../tests/browser/device-hearing-v3/README.md) instead and follow the [original listening protocol](../../../tests/browser/device-hearing/manual-probe-protocol.json) with collaborator assistance. This checks the pinned version and records actual callbacks; do not operate the ordinary development page or another preview page simultaneously, to avoid selecting the wrong audio source. It does not judge whether the sound is pleasant or automatically know the DAC, physical volume or calibrated sound pressure.

<!-- english-original-anchor --> <a id="回報範本"></a>
## Report template

The original template below asks for date, Chrome and Windows versions; display scale; language and window size; pass/fail/not tested with steps for layout and controls, direct scene click/move/rotate/scale/undo, and first-person movement right after entry, Enter pause/resume and Esc exit; relocking and explicit resume after Esc or focus loss; headphones or speakers, Windows output, DAC and volume; whether the default volume is too quiet, suitable or too loud; direction/distance; continuous and impact sound; pops, volume jumps or dropouts; pause/resume listening; and listening time, untested items and other issues.

```text
日期／Chrome版本／Windows版本：
顯示比例：100%
介面語言／視窗大小：
正常版面與控制：通過／失敗／未測；具體步驟：
場景直接點選／移動／旋轉／縮放／復原：通過／失敗／未測；具體步驟：
第一人稱進入即可移動／Enter暫停繼續／Esc退出：通過／失敗／未測；具體步驟：
Esc或失焦後重新鎖定與明確繼續：通過／失敗／未測
耳機或喇叭／Windows輸出／DAC／音量：
預設音量（太小／合適／太大）：
方向／距離：
持續聲／碰撞聲：
爆音／音量突變／斷音：
暫停／繼續的聽感：
聽測時間／未測項目／其他問題：
```

Record this feedback separately from automated tests, performance figures, source licenses and external competition gates; completing the template does not establish that the entire first version is complete.
