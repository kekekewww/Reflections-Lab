<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/pipeline/zones/REPORT.md","sha256":"8b869401dc429b1d0973d11b2efa84faee5dd5a2791f262bd48a2761069c2910","translated_at":"2026-11-02T11:45:24.579Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/pipeline/zones/REPORT.md`](../../../../../../14-core-pipeline/stages/11-ui-parameters/pipeline/zones/REPORT.md). Source SHA-256: `8b869401dc429b1d0973d11b2efa84faee5dd5a2791f262bd48a2761069c2910`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="zone-ui-參數驗證收據"></a>
# Zone UI parameter verification receipts

This lane used Chrome **156.0.8078.75** against production preview 4173, and all six distinct cases passed. The method was **scripted DOM, not native mouse/keyboard operation**: actual inputs, buttons, file import and downloads only; evaluate read DOM only. There was no HostInternal/runtime bridge, paid model, deployment or product change.

The tested source was `9fcf3f0657813f5aa07bf936a1cb6a50f2628f30`. All six successful receipts received the same `index-DO7iDxDy.js` over HTTP, SHA-256 **5c75259d334399afeab1c53a5d32e0e7a3b4067f862b245836fdd542b96e7819**. Later Tail corrections/new builds cannot borrow this source cutoff. Settings were normal 100% scale and 1440×1100; the removed mandatory 200% gate was not reinstated.

<!-- english-original-anchor --> <a id="實際通過範圍"></a>
## Scope actually passed

| Case | Successful receipt | Actual result |
| --- | --- | --- |
| 01: Eight tabs and author fields | final-9fcf3f0-02 | Eight stable tab IDs, each operated by pointer, one visible panel, Home/End and left/right wrapping; native length caps and custom-invalid ID/name cases; min/max/blank/out-of-range values for all center and half-extent axes, sphere radius and strict hysteresis relationships; center X native arrow keys and actual spinner clicks; Enter save, name trim, immutable ID, Escape/cancel, duplicate zone ID and atomic Host rejection of cross-entity ball ID. |
| 02: History and persistence | final-9fcf3f0-02 | Undo after creation restores legacy data without the zones property, then Redo; save/load/export/import after adding Zone rules; an import with the same projectId/sceneId/revision but different registry content cannot be overwritten by an old draft. A separate actual Scene revision change also prevents stale-draft submission. |
| 03: Capacity and negative imports | final-9fcf3f0-02 | Sixteen regions are legal and the add entry becomes disabled. The seventeenth region, cross-entity ID, wrong shape fields and unknown fields are atomically rejected through the actual import UI, preserving the previous scene and its sixteen regions. |
| 04: Rules and references | final-9fcf3f0-02 | Zone triggers are disabled with an empty registry. Selection occurs only after an enabled zone exists and actual DOM option.disabled=false. A new rule requires explicit zoneId selection; attachment defaults to object. ZONE_IN_USE lists actual rule references. Existing references survive a disabled zone, while new rules list enabled zones only. Switching to a non-zone trigger clears the ID; after retargeting, deletion and Undo work. |
| 05: Actual events, replay and A/B | final-9fcf3f0-03 | UI Capture3s yields 180 frames and one actual raw OnEnterZone/OnExitZone each; normalized source=zone/zoneId/eventId match item by item. The two logical audio starts match their parent raw body centers rather than being moved to the zone center. In live/replay, UI row details are located by downloaded raw IDs and checked against those IDs. The recording downloaded after replay has exactly the same SHA. Behavior B succeeds with an unchanged registry; changing the zone center rejects reuse of old physics. |
| 06: Disabled volume and explicit anchor | final-9fcf3f0-04 | Actual UI export/valid author edits in Project JSON/UI import set explicit zone attachment on a new AlwaysOn rule; the UI has no editable control for this field. With the region disabled, the body still crosses its nominal volume and raw zone events remain 0, while logical audio stays at the zone center. Deletion is rejected while references remain. Authoring entries are disabled during replay/running/recording and become available afterward. |

This means **six distinct cases passed individually, not one clean 6/6 run**. Unaffected passing cases were not rerun merely to improve the aggregate. `parameter-inventory.json` records each field/method/state and uncovered branches; `verification-summary.json` records the six successful sources and actual values.

<!-- english-original-anchor --> <a id="事件與來源資料"></a>
## Event and source data

Actual vertical falling-ball fixture:

- zone.browser: AABB center=(-0.8,1,0), halfExtents=(0.5,0.4,0.5), hysteresis=0.02.
- Select the actual ball and add OnEnterZone/OnExitZone through UI, explicitly selecting zone.browser for each and retaining the object emitter.
- Captured run: `recording.eb5dfa7f-85f7-4ddb.capture.1`; 180 frames; raw and normalized streams each contain two zone events, with IDs `zone-46b003b364564c12` and `zone-b062948aacbef57e`.
- SHA-256 of both the original recording download and the download after replay: `736803addad5d8bd65288897b04237a8a866a67918b788d13850edc3274c91b1`.
- UI-exported Project SHA with Zone rules: `fdb0f365b696bc61ecd68fd0f5e250b1a272bc7480f42b798c846fa9c3d539a5`. Scene objects are identical before and after adding the Zone/rules: six in both, without phantom objects.
- In the disabled fixture, actual body Y spans approximately 0.221939–1.998297 m, crossing the nominal volume. There are 0 zone events, while the explicit anchor remains at (-0.8,1,0).

Original Project/recording files are in the project-ignored `.cache/parameter-audit-pipeline-zones/<attempt>/`; receipt artifacts and the aggregate manifest record their paths, bytes and hashes. These are actual UI downloads, not synthetic success receipts. This vertical fixture is a fallback for the Renderer owner. Root separately schedules the final horizontal Zone+curve+dynamic+individual-WAV output in the Combined lane; this lane neither performed nor claimed WAV/hearing success.

<!-- english-original-anchor --> <a id="helptip-caller實證"></a>
## HelpTip caller evidence

Three source callsites and four caller instances yielded eight focus/actual-pointer-click activation records. Each records Escape closure, topic, sourceCallsiteRef, actual aria-describedby and tooltip ID:

- `ui.zonepanel.zonepanel.helptip.2a43c2d943`: region title.
- `ui.zonepanel.zonepanel.helptip.cb7efbc36a`: Add region, including the disabled-control helper while a draft exists.
- `ui.rulecard.rulecard.helptip.e2595a7002`: event region, tested separately for actual enter/exit rule instances.

A single generic HelpTip success is not presented as every caller/conditional-content branch passing. Predicate branches and untested methods are recorded separately.

<!-- english-original-anchor --> <a id="原始失敗與護欄觀察"></a>
## Original failures and guard observations

1. attempt01: after Add switched to a disabled helper, the harness moved the pointer away to close the tip, then called focus on the already focused helper; no actual focus event occurred. FAIL is retained. The correction uses real Tab to leave focus, verifies loss of focus, then focuses again, without changing the product or fabricating DOM events.
2. attempt02: clicking the first OnEnterZone text selected an audio LIFETIME_EXPIRED row for the same trigger rather than the raw Zone row. FAIL is retained. The locator now uses the actually downloaded raw.eventId and reads each UI row's detail ID; live and replay both check the same IDs.
3. attempt03: a mistakenly double-escaped harness regex always parsed tick as -1. The original screen also actually showed tick 201 and the recording-evaluation-queue-full pause at a complete tick boundary. This backpressure-guard observation is retained and **does not establish healthy performance or absence of backpressure**. Only the regex was corrected; it first parsed 201 from the original failureBody in a self-check, then only case 6 was rerun. There was no reset, guard bypass or fabricated data.

The final CLI exited 0 and fixture teardown completed. A read-only CIM observation at 2026-11-02 11:27:32 UTC showed headlessChrome[]/matchingNodeCli[]. The lease was RELEASED then, with no subsequent Chrome launch. Agent API requests, blocked external/planning requests and page errors were all 0 across the six successful cases.

<!-- english-original-anchor --> <a id="限制與claude重驗"></a>
## Limits and Claude revalidation

Zone events are **Derived fixed-step body-center sampling plus hysteresis**, not whole-collider overlap, swept/CCD or physical acoustic measurement. UI values/events/logical audio do not substitute for hardware PCM, hearing, Meta live or 600-second performance.

The overlay has only editor screenshots inspected offline, without a complete browser gate for canvas picking or pixel-level hiding in FPS/replay. No Three objects were read to bypass UI. This browser did not manufacture FPS non-editor authoring restrictions, fault-injected pending/no-ack, or physical boundaries such as fast outside→outside/teleport/generation; the corresponding Node core evidence remains capability_core's scope. The conservative A/B contract rejects any canonical registry change, including name/order, but this browser tested center-change rejection only.

For revalidation, first read all three FAIL attempts and the successful raw receipts, then use the actual new preview and an exclusive browser lease:

```powershell
$env:PIPELINE_ZONES_BROWSER_LEASE='granted'
$env:PIPELINE_ZONES_ATTEMPT='<new-attempt>'
$env:PIPELINE_ZONES_CANDIDATE='<actual-source>'
node node_modules/@playwright/test/cli.js test --config tests/browser/parameter-audit/pipeline-zones-audit.config.ts
```


A single-case/affected-scope retest may grep the original test title. Do not overwrite old attempts. Root owns Git/Main integration, persistent memory and English mirrors. This lane did not modify the product, Git index or Wiki.
