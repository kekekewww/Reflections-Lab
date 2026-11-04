<!-- english-source: {"path":"docs/14-core-pipeline/stages/07-integration-ui.md","sha256":"05b7d1309a1916d0c965c5e102e7d7912e1d94b86e745137867464f4b29374cb","translated_at":"2026-11-02T05:46:57.866Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/07-integration-ui.md`](../../../14-core-pipeline/stages/07-integration-ui.md). Source SHA-256: `05b7d1309a1916d0c965c5e102e7d7912e1d94b86e745137867464f4b29374cb`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="核心管線-ui-整合與基本驗證"></a>
# Core pipeline UI integration and basic verification

Date: 2026-11-02 (Taiwan). Executor: Codex UI integration agent. This round connects the core features and runs basic regressions; Claude Code will reverify and adjust them before the user's manual testing. The actual Git HEAD for code sources and receipts is in `07-ui-evidence/*-process.json` in the same directory. The UI changes had not been committed separately when recorded; no final SHA is invented for this report.

<!-- english-original-anchor --> <a id="已實作"></a>
## Implemented

- Reuses AnalysisDock's scene-first layout, existing components and canonical tokens, adding Motion, Audio Export and Performance tabs while retaining roving tabs, Home/End/arrow keys and Traditional Chinese/English switching.
- New panels remain mounted/hidden to retain drafts and work in progress. The export panel performs low-frequency refresh only while its current tab is expanded; it adds no audio tap or native audio-statistics polling.
- MotionPanel connects through revisioned authoring operations and runtime dispatch. The UI subscribes only to a stable read model; it neither changes Scene itself nor advances physics.
- RenderPanel connects to the actual RenderHost, a3-second controlled-recording entry and per-file WAV/manifest downloads. This stage's browser smoke checks entry reachability; actual audio contents and full-pipeline export are verified separately in renderer/root stages.
- The performance panel separately presents audio frames, onsets, solver delivery, control updates and native output windows. Missing values remain “—”; unavailable native counters are not treated as zero. Cost observation has a real switch; disabling it displays retained history, while hiding the panel is not presented as disabling observation.
- The Agent panel adds bounded baseline experiments and same-motion material-candidate comparison. Selecting a provider does not automatically call a model or apply a proposal. Results display only Host values matching complete metric/artifact/run citations; missing values remain unavailable. Original explanations and sources are placed in details.
- Adds a separate Undo Last AI Apply entry so pure Motion sidecar transactions use AgentSession.undo rather than ordinary Scene undo. `ai.canUndo` is an optional read-model field, preserving compatibility with older controllers.
- Authoring UI trigger availability reads the same producer-capability list as the trusted Host. OnBounce is no longer disabled by old hardcoding; tooltips expose the limits of bounded fixed-support classification, while the zone producer remains explicitly unsupported.
- App's error wrapper preserves optional composition ports on the prototype and their `this`. Root fixed the same missing forwarding in the higher bootstrap facade, and an actual browser confirmed that the connection works.
- Adds English states for short takes, recording high water, evaluation failures and experiment workflows, retaining original dynamic diagnostics and specific error sources.

<!-- english-original-anchor --> <a id="設計核對"></a>
## Design check

Follows the existing Reflection Lab design system and the project's pinned Emil skills. No UI library, font or second token system was added.

| Before | After | Why |
| --- | --- | --- |
| New features had only domain/host APIs, with no entry in existing tabs | Motion, export and performance tabs inside the existing AnalysisDock | Preserve canvas proportions and make features discoverable without rebuilding the editor |
| Shell forwarded only old controller methods | Preserve new optional ports and bind the runtime receiver | Prevent unit-level functionality from appearing unavailable in the actual UI |
| Unmounting new panels during switching would discard drafts | Keep panels mounted; disable export refresh according to visibility | Preserve work while bounding background activity |
| The old UI hardcoded OnBounce as unsupported | Follow the shared trusted-capability list | Stay consistent with the actual producer, AI and Host |
| Ordinary Scene undo cannot represent a pure Motion AI transaction | Separate AI Host undo | Preserve each transaction's revision, digest and sidecar authority |
| Unobserved native output could be read as zero | Distinguish unavailable, warmup, reset and valid windows | Do not report missing data as clean output or device validation |

<!-- english-original-anchor --> <a id="實際基本驗證"></a>
## Actual basic verification

| Command / scope | Result | Receipt |
| --- | --- | --- |
| Five basic UI test files: ports, capabilities, grounded presentation, diagnostics, locale | 19/19 PASS | `07-ui-evidence/basic-unit-final.txt`, process JSON |
| `node --import tsx --test src/ui/pipeline-ui.test.ts` | 5/5 PASS | `07-ui-evidence/pipeline-ssr-final.txt`, process JSON |
| `node node_modules/@playwright/test/cli.js test --config tests/browser/pipeline-ui.config.ts` | 2/2 PASS,29.8 seconds | `07-ui-evidence/browser-smoke-final.txt`, process JSON |
| Scoped ESLint for owned UI/browser files | exit0 | `07-ui-evidence/scoped-eslint.txt`, process JSON |
| Prettier for owned UI/browser files | Formatted | Terminal command results; root runs integrated format:check separately |

The browser uses real headless Chrome, CDP/Playwright input and an isolated `5188` dev-e2e server. It checks that Motion drafts survive tab switches, keyboard tab navigation works and export/Motion entries remain available after changing language. This is not native Pointer Lock, human visual-quality acceptance, device hearing or formal performance PASS.

<!-- english-original-anchor --> <a id="保留的失敗與修正"></a>
## Retained failures and fixes

- The first combined basic run was18/19: nine new Traditional Chinese Runtime/RecordingHost states lacked English. The original failure `basic-unit.txt` is retained; after completing translations the result is19/19.
- The initial pipeline SSR run was4/5: the test asserted button HTML with a tooltip as if it lacked aria-describedby. The product's accessibility attribute was correct. Checking actual enabled/disabled state instead gives5/5; the initial summary remains in process JSON.
- The initial browser run was0/2: the actual bootstrap facade did not forward new ports, so the Motion panel showed unavailable; root fixed it. Another test used an old monolingual accessible name and now uses the existing bilingual label. Original stdout/process are retained. Screenshots, traces and contexts are in `.cache/pipeline-ui-browser-initial/`; file hashes are in `07-ui-evidence/browser-initial-artifact-manifest.json`.
- During the last TypeScript check, two optional UI props violated exactOptionalPropertyTypes and were changed to conditional spreads. Root fixed its separate `lateReverb.seed`; root's final integrated tsc receipt is authoritative.

<!-- english-original-anchor --> <a id="交接與限制"></a>
## Handoff and limits

- Root still needs to complete full integrated regressions, the production build, actual Computer Use operation and per-file export, the final main merge, and shared-memory/English-documentation synchronization.
- Claude Code should first read this stage's failures and final receipts, then rerun from the complete pipeline. Do not elevate this SSR or browser smoke evidence to full V1,600-second performance, Meta live or device-hearing acceptance.
- The UI changed no acoustic/physics formula, original reference, tolerance or acoustic-ray data source. No paid API call, deployment or push was added.

<!-- english-original-anchor --> <a id="後續原子發布修補"></a>
## Subsequent atomic-publication fix

Motion workspace's internal `changed()` can notify direct subscribers during sidecar installation. If the UI also reads the live workspace, it could briefly combine a new Motion registry with the new Scene that has not yet been published. This round makes `LabViewModel.motion` an optional snapshot published in the same update. The Motion panel prefers `model.motion` and no longer subscribes directly to the workspace. Only an older controller lacking that field uses the explicit `workspace.getView()` compatibility path.

- Adds regressions for “the published snapshot does not read live/install state early or subscribe independently” and for the legacy fallback.
- `node --import tsx --test src/ui/pipeline-ui.test.ts src/ui/controller-ports.test.ts`:9/9 PASS (7 pipeline SSR cases,2 ports cases), with receipts in `07-ui-evidence/motion-atomic-ui.txt` and process JSON.
- This fix changes only three UI/type/test files. Root connects Runtime's published snapshot and bootstrap critical revision. It changes no Scene/Motion domain semantics, formula or acceptance tolerance.
- The earlier2/2 browser smoke result retains its original source snapshot. This fix verifies read-model atomicity only through the relevant unit/SSR regressions; it does not present that earlier browser result as a rerun against the new source.
