<!-- english-source: {"path":"tests/browser/native-accessibility-report.md","sha256":"a0cdbfd6f773792000d4db53c0e8b487c6dc2da3fd85aeacbe2b2b41296dbac8","translated_at":"2026-10-27T06:13:07.3418207Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`tests/browser/native-accessibility-report.md`](../../../../tests/browser/native-accessibility-report.md). Source SHA-256: `a0cdbfd6f773792000d4db53c0e8b487c6dc2da3fd85aeacbe2b2b41296dbac8`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="原生縮放與輸入驗收"></a>
# Native Zoom and Input Acceptance

Status: **Partial pass, failures retained** (2026-10-27). The five native input tests achieved **5/5 PASS**; actual 200% tab zoom and four accessibility checks were observed, but the complete zoom case still **FAIL**; the complete CDP composition case **FAIL**; the native menu and OS IME are **NOT RUN**. This page does not constitute a pass of overall first-version acceptance.

Fixed bilingual build input digest: `9ae2ca2eb7508be78a0fcfa96ef99e1543189a644b6f3c1057d10d3c78664176`. Manifest SHA-256: `10d1fcb0f8b3514b03c1793ea32095bc6a192e84af8bf6e5fa215af9e0cd3839`. Source/bundle hashes had no mismatches before execution or before NATIVEEND. All results apply to this version; the later favicon fix is outside this evidence.

See [summary.json](../../../../tests/browser/native-accessibility-evidence/20261027/summary.json), [fixed manifest](../../../../tests/browser/native-accessibility-evidence/20261027/frozen-build-manifest.json), and [process cleanup](../../../../tests/browser/native-accessibility-evidence/20261027/process-cleanup.json) for persistent evidence and commands. The initial visibility failure, three zoom failures, and CDP failure are retained; none were deleted or changed to PASS.

Test sources: `native-accessibility-runner.mjs`, `native-accessibility.cases.ts`, and `native-accessibility.config.ts`. Only tests and evidence are added; the product UI and specifications are not modified.

<!-- english-original-anchor --> <a id="原生-200-縮放"></a>
## Native 200% Zoom

Two methods are provided and recorded separately. The first uses the installed Chrome, a separate test profile, and a native window. Computer Use performs Ctrl+0 in that window, then increases the zoom step by step until the browser menu shows 200%. Screenshots containing Chrome's native menu and the accessibility tree are saved. This is the [official Chrome page-zoom entry point](https://support.google.com/chrome/answer/96810).

The second uses the cached bundled Chromium, a separate profile, and this repository's small MV3 test fixture to call the real `chrome.tabs.setZoomSettings({mode:"automatic",scope:"per-tab"})`, `setZoom(2)`, and `getZoom()`. It does not use `Emulation.setDeviceMetricsOverride`, CSS zoom, or page scale. The final attempt used a separate headed process / `noDefaults:true`; failures from the initial headless and ordinary headed attempts are also retained. The software renderer is used only for UI tests and is not evidence of physical GPU/OS input/performance.

```text
node tests/browser/native-accessibility-automatic.mjs http://127.0.0.1:5174 test-results/ui-preview-build.json
```

Both paths check the actual HTTP-served bundle against the fixed manifest file by file and save a copy of the manifest; PASS can be output only after all five checks have completed, 100% has been restored, there are no errors, and the context has closed. Subsequent results use separate directories for each method; the two methods must not be conflated as a single execution.

Actual automatic results (Chromium `156.0.8078.4` / Windows `10.0.26200`): the native API reported 1→2; in the same 1440×1000 window, CSS viewport width changed 1424→712, DPR changed 1→2, visual viewport scale＝1, and CSS zoom/transform remained unchanged. Monitor Tab, Pause keyboard operation, dialog Escape/focus return, and form Tab achieved **4/5 PASS**. Actual Pointer Lock was then not obtained, so the overall result is **FAIL**; the successful restoration step was not reached, and the owned process for the separate profile was safely closed directly. There was also an actual `/favicon.ico` 404; console errors were not ignored. The cached Chromium also had a Windows sandbox access warning, but it cannot yet be concluded that this caused the lock failure. See the [final zoom result](../../../../tests/browser/native-accessibility-evidence/20261027/zoom-2026-10-27T06-01-44.449Z/verification.json).

Only one interactive time window was attempted for the native menu: Computer Use's `list_apps` / `list_windows` did not find this test Chrome window, so no zoom keystrokes were sent and no other windows were operated; the attempt was stopped and cleaned up. The helper's `windowsHide:true` is a possible fixture cause and remains unverified; native-menu 200% remains **NOT RUN**. The [aborted-attempt record](../../../../tests/browser/native-accessibility-evidence/20261027/native-menu-unavailable.json) does not stand in for a zoom pass.

Also verify that the bounds of the same native window remain unchanged, DPR doubles relative to the 100% baseline, the CSS viewport width halves, visual viewport scale remains 1, and the page has no new CSS zoom/transform. A smaller viewport or simulated DPR must not be treated as 200% browser zoom.

In this state, test Monitor/Pause/first-person exit/form accessibility, keyboard button operation, and Escape and focus return for native dialogs. The menu method restores the original zoom with native Ctrl+0 at the end; the API method restores it with automatic `setZoom(1)`. Both verify that renderer DPR returns to the baseline and close the separate test context.

The current [official Playwright documentation](https://playwright.dev/docs/chrome-extensions) states that branded Chrome/Edge do not provide its extension sideload flags; the test fixture is loaded only into bundled Chromium's separate test profile and is not installed into the user's normal profile. Automatic zoom and manual mode in the [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs) must not be confused.

<!-- english-original-anchor --> <a id="輸入案例"></a>
## Input Cases

Command after the dedicated fixed preview has started:

```text
node node_modules/@playwright/test/cli.js test --config tests/browser/native-accessibility.config.ts
```

The default is the local `http://127.0.0.1:5174`; the environment variable `NATIVE_ACCESSIBILITY_BASE_URL` can point to a preview that has been fixed and started by another explicit owner. The configuration no longer starts a nested server. `*.cases.ts` is executed only by this dedicated configuration to prevent it from being mixed into other browser gates.

For the actual command, this agent first owned `Vite preview --host 127.0.0.1 --port 5174 --strictPort --outDir test-results/ui-preview-dist`. A localhost fetch in the default sandbox returned EACCES; the preview/runner was then run elevated under the existing validation authorization. No permissions, paid calls, or external deployments were added.

The initial 4/5 visibility failure came from Playwright's default focus emulation: during the actual probe, different targets in the same window all returned hidden=false. Sending false through a new CDP session also could not release another handler's capture handle. [Official Playwright noDefaults documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp-option-no-defaults) and [Chromium source](https://chromium.googlesource.com/chromium/src.git/+/refs/heads/main/content/browser/devtools/protocol/emulation_handler.cc) support using **a fresh owned process, `connectOverCDP({noDefaults:true})` on the first connection, and the sole existing default context**. No synthetic visibility event was used; the original hidden, held-W, and release/fresh-press assertions were retained, with an additional same windowId / different targetId check. After the fixture correction, an actual run achieved **5/5 PASS, 42.6 s** (installed Chrome `156.0.8078.47`).

| Case | Evidence Scope | Current Result |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| Composition boundary, Unicode text, and key priority | Scripted CompositionEvent fixture in a real browser; composition events have `isTrusted:false` and are not Windows IME | PASS |
| Contenteditable/modal keyboard focus | Real browser keyboard; contenteditable is an explicitly rendered fixture; the dialog uses the production component | PASS |
| E key repeat | Real Chrome KeyboardEvent repeat; actual Rapier grab and release states, with raw/derived event counts checked for each repeat | PASS |
| Tab visibility loss | Actual tab hidden→paused, with no automatic resume; held-W does not move after resume, and movement requires an actual release + fresh press | PASS |
| Pointer Lock rejection without transient activation | Native Chrome rejection; CDP `Runtime.evaluate(userGesture:false)` grants no gesture, and alternative controls can move the actual Listener | PASS |

A separate **CDP browser composition capability** case was also executed, with complete result **FAIL**:

```text
node node_modules/@playwright/test/cli.js test --config tests/browser/native-accessibility-cdp-composition.config.ts
```

It uses experimental `Input.imeSetComposition` to update candidate text in Chromium's focused widget and saves actual DOM composition/input events, `isTrusted`, `isComposing`, selection positions, and values; it commits with `Input.insertText`, then cancels another candidate with an empty composition. The checks must confirm that text is committed only once, that actual commit/cancel occur, and that Scene/Behavior/tick remain unchanged. This is neither JavaScript `dispatchEvent(new CompositionEvent(...))` nor acceptance of Windows OS IME or a physical keyboard/candidate window.

Actual observations: `中`→`中文`, `中文` committed only once, a new candidate canceled→the original `中文`, and then eb remained in the text field; Scene/Behavior/tick/events/paused all remained unchanged, and pageerror was empty. start/update/input were trusted, and input's isComposing was true; however, the two compositionend events for CDP commit and cancel had `isTrusted:false`, so the strict case retains **FAIL**. That assertion is not weakened, and no complete native IME pass is claimed. e/b were sent after candidate cancellation; this result does not prove physical-keyboard arbitration during composition. See [raw CDP events](../../../../tests/browser/native-accessibility-evidence/20261027/cdp-composition/case-1-0-cdp-browser-composition-evidence.json).

The [official protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-imeSetComposition) and the installed Playwright protocol types both list `text`, `selectionStart`, and `selectionEnd`; replacement start/end are paired optional parameters. `imeCommitComposition`, mentioned in the documentation prose, is not a command in the protocol installed for this run; `InsertText` in [Chromium InputHandler](https://chromium.googlesource.com/chromium/src/+/master/content/browser/devtools/protocol/input_handler.cc) goes through `ImeCommitText`, so the test uses the existing `Input.insertText`. If the browser explicitly returns method unavailable, save NOT RUN and the actual error separately; do not substitute a synthetic fixture and present it as success.

The CDP `userGesture` parameter was checked against the [official Runtime protocol](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate); the transient activation requirement when there is no history of successful lock follows [W3C Pointer Lock 2.0](https://www.w3.org/TR/pointerlock-2/). Actual Windows IME, screen readers, and human listening tests still require their own evidence; this test cannot imply that they pass.

Cleanup for all five owned input-test browser processes actually returned `ownedProcessExited:true`; the zoom and menu processes have also exited. Vite preview has stopped; after NATIVEEND, an elevated CIM check found 0 processes matching this run's named profiles / 5174 preview. Profiles are retained for diagnosis, and user data is not deleted. Next, the Orchestrator will fix the favicon, produce the next fixed bundle, and schedule native-menu validation in an actually visible Chrome window; this batch does not continue consuming the browser slot.
