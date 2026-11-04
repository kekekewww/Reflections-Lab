<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/interaction/REPORT.md","sha256":"9f0782afe9554a980b2bb7481c7aa523479910b51355d8ffc4c0313cf7da9468","translated_at":"2026-11-02T10:19:06.440Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/interaction/REPORT.md`](../../../../../14-core-pipeline/stages/11-ui-parameters/interaction/REPORT.md). Source SHA-256: `9f0782afe9554a980b2bb7481c7aa523479910b51355d8ffc4c0313cf7da9468`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="互動控制與參數實測交接"></a>
# Interaction controls and parameter testing handoff

Ownership: Toolbar, workspaces/layout, project saving and import/export, SceneList/primitive building, the editing observer camera, every visible gizmo handle, FPS and unlocked operation, shortcuts, and shared NumberField/HelpTip. Acoustic material values, sound behaviors, Zone, recording/playback/analysis, and audio output are integrated by other lanes.

This lane has **59 interaction families, with PASS as the latest component result for 58 distinct case IDs**. Every family has an actual receipt; none is unmapped. This is evidence combined across versions: it is not a complete rerun of all 58 cases on a single 49 build, nor Cartesian verification of every value/state combination. See [FAMILY_COVERAGE.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1a7e11e76b40fc8bd2a359f9780f7624b113e37a) for the machine-readable mapping.

The final targeted regression used `49bde82be6f9def5058bc8f3076e105fcdfd535d`, production entry `index-C4qRBPy8.js`, and headed Chrome `156.0.8078.75`. Both designated cases have PASS results, with zero unexpected console errors. Chrome closed normally and released its lease.

<!-- english-original-anchor --> <a id="最終兩項回歸"></a>
## Final two targeted regressions

- [final-49bde82/receipt.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/197fac0c61bd8974bc200f8d133d42e2c31223be): `native-paused-click-resume` PASS. Pressing the left mouse button while Held leaves the session paused; releasing only resumes, without throwing. Under the newer policy, Pause cancels the ghost without placing it. Resume does not recreate the preview, and the object count stays unchanged.
- [final-49bde82-gizmo/receipt.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/dc0de0b19ec3bd7e66a6914fbb4936f504ab2d43): `gizmo-group-lifecycle` PASS/exit 0. Add→Undo→Redo→Delete was performed separately for Box, Sphere, and Capsule. The original ball's gizmo could still commit afterward, adding only one revision. `consoleErrors=[]`.
- In the first final run, the gizmo case read a nonexistent DOM `aria-label`, received null, and produced seven strict-locator error rows. That production run had no TC console error; its original FAIL, screenshots, and exact runner are retained. The retest obtained stable object IDs by exporting Scene through the real UI, then selected by accessible name. The product was not changed to accommodate the test.

<!-- english-original-anchor --> <a id="分階段原始結果"></a>
## Original results by phase

| Receipt | Actual result | Interpretation |
| --- | --- | --- |
| `serialized-old-bundle/receipt.json` /19db9f9 | 14/19 PASS | The real Alt/gizmo defect and four failed test prerequisites are retained. `priority-held-initial.json` separately preserves the initial Held Place failure. |
| `full-253852f-initial/receipt.json` | 32/38 PASS | Complete first round; all ten additional handles, cancellation, object/solver-path selection, native pointer actions, gentle placement, and WebGL fallback were tested. The six failures were not overwritten. |
| `six-d9dc624-initial/receipt.json` | 5/6 functional PASS; overall FAIL | Help/Look/Rotate X/F passed after correcting asynchronous prerequisites. The old incorrect oracle requiring ghost preservation during Pause remains recorded; a real TC console error was also captured. |
| `old19-d9dc624-initial/receipt.json` | 19/19 functional PASS; overall FAIL | All original 19 cases passed on retest, including real Ctrl+Z. The overall run failed because of the same TC console error. |
| `final-49bde82/receipt.json` | 1/2 PASS; overall FAIL | The correct Pause/Resume case passed; the gizmo test failed because of its DOM aria-label prerequisite. |
| `final-49bde82-gizmo/receipt.json` | 1/1 PASS; overall PASS | After correcting the locator, only the three-shape teardown regression was rerun; zero unexpected console errors. |

Every original FAIL, TAP, trace, and source preimage remains intact. The exact source bytes of the old 19db serialized runner cannot be reconstructed from the existing hash; [HISTORICAL_SOURCE_NOTE.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ef2173b26b40718a62c3d36d32cbd12d371d2b49) records that limitation. A later corrected script is not presented as the original.

<!-- english-original-anchor --> <a id="已修復的產品問題"></a>
## Product issues fixed

1. **Held gentle-placement entry**: Place previously depended only on ghost-valid and was disabled while Held. It now displays “Gentle place” and uses the existing bounded Host. Actual release succeeded on a normal support surface. Without support, Held is retained and a rejection reason appears; collision/support policy was not relaxed.
2. **Alt camera and gizmo competing for one gesture**: Alt-left-drag previously changed the ball's Scene transform. Capture-phase ownership now excludes TransformControls. Tests cover releasing Alt mid-gesture, native capture loss, cancellation on tab switching, and the next gizmo gesture. Cancellation does not commit Scene.
3. **Runtime error could not be dismissed**: App Dismiss supports local and Runtime errors through `clearError`. After an actual invalid project import, the error could be dismissed while Scene remained unchanged. The Events owner integrated the Runtime action.
4. **Save success obscured by an old pause reason**: The status presenter shows both the latest notice and any still-valid pause reason, deduplicating localized text. Actual Save displayed success confirmation without changing Scene or its pause reason. [Source and unit receipts](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1dffde830ebc37a6595429f8abea996a30392bd2).
5. **TC updating a detached Group after Undo removed the selected object**: Two independent production runners captured `TransformControls: The attached 3D object must be a part of the scene graph.`. PhysicalObject/TC previously cleaned up in passive effects, so a helper could render after the Group had been removed. A stable callback ref now synchronously retires the matching TC; a layout effect attaches it after ref commitment. Pending, owner, and disposed transaction guards remain. Real Three negative/regression tests and final production Undo/Redo/Delete across all three shapes passed. [Correction receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/08550289757d25dee57f173e504628cd691e283e).
6. **Record swallowed by the new Resume guard for pending placement**: The original race case in the full Runtime suite showed rev 1. Real gate diagnostics confirmed recording never started, allowing a late placement to commit. Under the existing Record-priority policy confirmed by Root, Record now synchronously cancels pending placement before the existing stopPreviews await, then starts recording with FPS input/focus/pause/replay guards retained. It reuses the localized `PLACEMENT_TRANSPORT`. The original rev 0 expectation was not relaxed. Added assertions verify recording started, pending cleared, and a late result cannot damage the take. [Correction receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1830df34d60cd3a36705c3db0859c372299073ab).

<!-- english-original-anchor --> <a id="實際操作範圍"></a>
## Actual interaction scope

- Three workspaces; Chinese/English locale switching with data retention; Start/Pause/Resume/Reset; hiding Scene/Inspector and tab exclusion; dragging both dividers, left/right arrow keys, Home, double click, and min/max clamping; pane switching at 900px with normal 100% scaling.
- Real file-chooser import; valid/malformed JSON; original-text disclosure/keyboard scrolling; Cancel/Escape and focus restoration; Save/Load/Export, Ctrl+S, and reload persistence; all three primitive shapes, each object-list row, search, Duplicate/Delete, Undo/Redo, Ctrl+Z/Ctrl+Shift+Z, and isolation of Delete in text fields.
- Move/Rotate/Scale/Frame; Alt-left-drag/releasing Alt midway/middle-right drag/wheel; Ctrl/Meta wheel browser ownership; deselection on blank space; 3D ball selection and selection of real solved paths.
- **19 visible gizmo handles**: translate X/Y/Z, XY/YZ/XZ, XYZ; the same seven for scale; rotate X/Y/Z, E, XYZE. Corresponding observations cover axis/plane components, unchanged fields, one revision, sphere uniform scale, Box plane scale, screen/free rotation, and Undo. Rotate X was additionally verified by the target turning yellow while other axes retained their colors, confirming the actual picker instead of equating a visible RGB line with an overlapping invisible torus picker.
- Real browser Pointer Lock, WASD/Shift, Enter, Tab/Shift+Tab/Escape, and explicit mouse reacquisition; unlocked opt-in, eight movement/look buttons and arrows, with actual Listener position/angles checked; native/button grab/drop/throw, E/R/wheel/F/B/L; preview start/valid place/cancel/right-release atomic place; successful Gentle place and G, plus safe rejection without support.
- Shared NumberField Enter/blur commit, Escape revert, empty/negative rejection, draft retention on locale switching, and the explicitly identified DOM isComposing guard. Mass/Friction represent shared behavior; parameter tests in the corresponding lanes cover each caller's range and Host semantics.
- Shared HelpTip hover/focus/Escape/real browser touch and disabled-adjacent-info contract; seven additional state scans yielded 394 raw observations. Eleven owned callers and four incidental Listener callers have exact source-site mappings: 80 raw→66 deduplicated caller/scope occurrences, not 394 distinct callers. [Mapping and untested branches](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3fa219aec43c3fb2139f387e039e7c683edbecfd).

<!-- english-original-anchor --> <a id="基本驗證與重跑"></a>
## Basic validation and reruns

Focused Node commands actually executed for this lane:

- `node --import tsx --test src/ui/viewport/observer-gesture.test.ts src/ui/viewport-controls-review.test.ts src/ui/viewport-gentle-placement.test.ts`: 5/5.
- `node --import tsx --test src/ui/status-feedback.test.ts`: 3/3.
- `node --import tsx --test src/ui/viewport/gizmo-group-lifecycle.test.ts src/ui/viewport/observer-gesture.test.ts src/ui/viewport/gizmo-commit.test.ts`: 11/11, including the expected negative diagnostic for the original Three ordering error; the correct path did not intercept console.
- `node --import tsx --test tests/app/fps-review.test.ts tests/app/replay-lifecycle.test.ts tests/app/recording-export-lifecycle.test.ts`: 34/34.

These commands contain overlapping tests and must not be added as independent counts. Narrow-file ESLint/Prettier passed; typecheck passed after the gizmo correction. Root's full Runtime/build/license and HTTP artifact master receipts are preserved separately in stage 15. This report retains the execution scope of this lane.

Browser commands ran against actual production preview 4173, with a single Chrome instance each time, closed afterward. Final exact commands:

```powershell
$env:INTERACTION_HEADED = '1'
$env:INTERACTION_RUN_LABEL = 'final-49bde82'
node tests/browser/parameter-audit/interaction-completion.mjs gizmo-group-lifecycle,native-paused-click-resume
# 原第一輪兩案收據保留；修正測試 locator 後只重跑缺的 gizmo 案：
$env:INTERACTION_RUN_LABEL = 'final-49bde82-gizmo'
node tests/browser/parameter-audit/interaction-completion.mjs gizmo-group-lifecycle
```

Use a new run label for reruns and preserve existing data. The complete `interaction-audit.mjs` and `interaction-completion.mjs` reproduce their respective scopes. Fixtures were exported through the real UI, edited, and imported through the real file chooser. The browser used no test bridge or direct internal Runtime calls.

<!-- english-original-anchor --> <a id="後續驗證界線與文件衝突"></a>
## Further validation boundaries and document conflict

- Native Web Pointer Lock and browser pointer/keyboard have actual evidence. Tab switching in the test environment did not emit native window blur/visibilitychange, so this cannot establish Windows OS focus/hidden behavior or human operation. Explicit DOM blur/composition branches were tested without automatic resume. OS IME, native Computer Use, hearing, and long-duration performance remain separate items in the main acceptance.
- WebGL Retry showed explicit fallback in an environment with WebGL genuinely disabled; this does not mean GPU recovery passed. Invalid placement, busy, and unsupported gates retain safe rejection and reasons.
- Integration mapping must cover each untested HelpTip state and conditional callers in other lanes. One shared hover/touch test does not establish every dynamic row.
- Generic ghost-preservation wording at old FPS UX lines 9/107/125 conflicted with newer lines 33/65 and the implementation. Root confirmed the newer cancellation policy. [Original bytes/hash and conflict handoff](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/623d31129b970ee65e30b614ceb5b8e0303fbeab) were delivered to the sole memory writer to create a ConflictRecord and precisely correct canonical/English text. The original incorrect-oracle FAIL remains; the product was not changed to fit the old generic wording.
- Priorities for Claude Code's review of this lane: check family-map version/caller scope, synchronous Undo cleanup and late pending finalizers, the race in Record-priority cancellation of placement, safe rejections, and native-input limitations; then combine with pipeline/audio/geometry evidence from other lanes. Root coordinates final source/test/memory and Git integration.
