<!-- english-source: {"path":"docs/14-core-pipeline/stages/11-ui-parameters/INVENTORY.md","sha256":"5e587f785f027744ce8a838f408a46f6d97569e7d27a0954435360fcb3fca579","translated_at":"2026-11-02T14:26:45.830Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/11-ui-parameters/INVENTORY.md`](../../../../14-core-pipeline/stages/11-ui-parameters/INVENTORY.md). Source SHA-256: `5e587f785f027744ce8a838f408a46f6d97569e7d27a0954435360fcb3fca579`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="全產品-ui-參數與操作盤點"></a>
# Full-product UI parameter and operation inventory

Status: **STATIC INVENTORY plus217/217 bounded-family receipt joins; unobserved conditions remain explicit, and this is not a claim of one complete rerun on a single final bundle**. The AST observation HEAD is5010685ebfd6bb482aa37e1d82e5f64418b55d9b, at2026-11-02T11:39:09.733Z. [INVENTORY.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9d3cdc4385bfabd610d439a0cfb58768ae1e3a86) records each source SHA, control-site label/line/range/enum/branch/disabled condition and shared templates. Initial, previous and pre-501-refresh snapshots remain in INVENTORY.initial-19db9f9.json, INVENTORY.before-final-source-refresh.json and INVENTORY.before-5010685-refresh.json; see AST_REFRESH_5010685.json for differences.

<!-- english-original-anchor --> <a id="範圍與計數"></a>
## Scope and counts

There are currently275 AST control/focusable sites,3 shared implementation templates and217 stable semantic families. These counts describe different levels; do not add them or treat them as passing counts. Dynamic row/object/rule/zone/path/output instances use stable domain IDs. Vector XYZ axes,19 gizmo handles and finite enums are listed individually.

The user requires actual interaction with every parameter and implementation of visible options that were unsupported. Finite choices, conditional branches and applicable upper/lower bounds, invalid values, save and restore behavior require itemized reconciliation. No exhaustive coverage of arbitrary real numbers or every Cartesian combination is claimed. The former Zone and curved/dynamic-reflection gaps now have product implementations: the49 candidate has eight bounded interaction/solver groups for curved geometry and dynamic reflection; Zone has six distinct real9fc cases; the501 combined scenario separately has180 continuous fixed steps and five WAV files. Each retains its own version. See [CROSSWALK.md](CROSSWALK.md) for version/method mapping and [UNSUPPORTED_OPTIONS.md](UNSUPPORTED_OPTIONS.md) for the original gaps.

| Source | AST-site count |
| --- | ---: |
| src/ui/AnalysisDock.tsx | 37 |
| src/ui/App.tsx | 36 |
| src/ui/BindingOverrideEditor.tsx | 13 |
| src/ui/Inspector.tsx | 40 |
| src/ui/MappingEditor.tsx | 20 |
| src/ui/MotionPanel.tsx | 18 |
| src/ui/PerformancePanel.tsx | 7 |
| src/ui/PipelinePanels.tsx | 7 |
| src/ui/ProjectImport.tsx | 9 |
| src/ui/RenderPanel.tsx | 8 |
| src/ui/RuleCard.tsx | 19 |
| src/ui/SceneExplorer.tsx | 17 |
| src/ui/viewport/AccessibleMovement.tsx | 9 |
| src/ui/viewport/SceneEntities.tsx | 2 |
| src/ui/Viewport.tsx | 19 |
| src/ui/ZonePanel.tsx | 14 |

<!-- english-original-anchor --> <a id="分工與判定"></a>
## Ownership and assessment

scene owns objects/Listener/environment; behavior owns assets/rules/bindings/mappings/sound preview; interaction owns shell/Project/viewport/FPS/shared focus and help; pipeline owns the8-tab Dock/record-replay/A-B/Agent/Motion/Render/Performance/Zones; audio_core owns Monitor/footer.

Each PASS applies only to the cited actual method, source/bundle/browser and Host/downloaded result. Seeing enabled state, opening a tab, filling a value, static presence or a unit test cannot replace actual interaction. Initial PASS and post-fix targeted PASS retain separate revisions; they are not combined into a complete rerun of the final source. Unread/unmapped items never become PASS automatically.

<!-- english-original-anchor --> <a id="語意family"></a>
## Semantic families

| Stable family ID | Lane | Control | Type | Range/options | Visibility condition | Disabled/prerequisite | Instance rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| shell.skip | interaction | Skip to main workspace | link | #main-workspace | Always present | No static disabled condition; Host may still reject | Single logical control |
| shell.workspace.{workspace} | interaction | Workspace | button-family | ["scene","simulation","analysis"] | Always present | No static disabled condition; Host may still reject | Finite set of three workspaces; actually switch each without resetting the run |
| shell.locale | interaction | Interface language | select | ["zh-TW","en"] | Always present | No static disabled condition; Host may still reject | Single logical control |
| project.save | interaction | Save project | button | Local ProjectStore; Ctrl/Cmd+S | Always present | No static disabled condition; Host may still reject | Single logical control |
| project.export | interaction | Export project | download | JSON | Always present | No static disabled condition; Host may still reject | Single logical control |
| project.load | interaction | Load locally saved project | button | Local ProjectStore | Always present | No static disabled condition; Host may still reject | Single logical control |
| transport.run-pause | interaction | Start/resume simulation; pause | stateful-button | ready/paused→run；running→pause | Always present | Runtime handles error/other Host states | Single logical control |
| transport.reset | interaction | Reset | button | runtime reset | Always present | No static disabled condition; Host may still reject | Single logical control |
| scene.undo | interaction | Undo Scene command | button | Ctrl/Cmd+Z | Always present | !model.canUndo | Single logical control |
| scene.redo | interaction | Redo Scene command | button | Ctrl/Cmd+Shift+Z | Always present | !model.canRedo | Single logical control |
| shell.toggle-scene | interaction | Show/hide Scene panel | toggle-button | null | Desktop transport | No static disabled condition; Host may still reject | Single logical control |
| shell.toggle-inspector | interaction | Show/hide Inspector | toggle-button | null | Desktop transport | No static disabled condition; Host may still reject | Single logical control |
| shell.dismiss-error | interaction | Dismiss error message | button | null | localError exists | No static disabled condition; Host may still reject | Single logical control |
| shell.mobile-pane.{pane} | interaction | Main panel | button-family | ["scene","viewport","inspector"] | Narrow layout | No static disabled condition; Host may still reject | Finite set of three panes; test the viewport visibility conditions at normal100% scale |
| shell.panel-divider.{side} | interaction | Resize Scene/Inspector panels | separator | {"pointer":"drag","keyboard":["ArrowLeft","ArrowRight","Home"],"doubleClick":"initial bounded width"} | Desktop divider | hidden→inert/aria-hidden/tabIndex=-1 | Finite left/right sides; width derives from viewport and tokens |
| project.import.open | interaction | Import Project JSON | button | null | Always present | Simulation running or replaying | Single logical control |
| project.import.file | interaction | Choose Project JSON file | file | {"accept":".json,application/json","maxBytes":8388608} | dialog open | pending | Single logical control |
| project.import.inspect-json | interaction | Inspect raw JSON | disclosure | {"previewCharacters":6000} | Draft has been read | No static disabled condition; Host may still reject | Single logical control |
| project.import.cancel | interaction | Cancel import | button | dialog close/reset/focus return | dialog open | applying | Single logical control |
| project.import.apply | interaction | Confirm Project import | button | validated atomic import | dialog open | !draft \|\| pending | Single logical control |
| project.import.dialog-escape | interaction | Project import Esc/close | keyboard | Escape | dialog open | preventDefault while applying | Single logical control |
| viewport.gizmo-mode.{mode} | interaction | Move/rotate/scale | button-family | ["translate","rotate","scale"] | !fps | !selected | Finite set of three modes; each axis belongs to a gizmo-drag control |
| viewport.frame-selected | interaction | Frame selection | button | Observer camera only; does not change Listener | Always present | !selected \|\| fps | Single logical control |
| viewport.enter-fps | interaction | Enter first person | button | Browser Pointer Lock and entry transaction | !fps | input.entering \|\| !canvasReady | Single logical control |
| viewport.exit-fps | interaction | Leave first person | button | null | fps | No static disabled condition; Host may still reject | Single logical control |
| viewport.reacquire-pointer | interaction | Enable mouse control | button | Explicit gesture requests requestPointerLock | fps && !locked && !alternativeInput | No static disabled condition; Host may still reject | Single logical control |
| viewport.details | interaction | View information | disclosure | null | Always present | No static disabled condition; Host may still reject | Single logical control |
| viewport.show-blocked-paths | interaction | Show blocked paths | checkbox | null | viewport details | No static disabled condition; Host may still reject | Single logical control |
| viewport.alternative-input | interaction | Input without pointer lock | toggle-button | null | fps | No static disabled condition; Host may still reject | Single logical control |
| viewport.alternative-resume | interaction | Start/resume operation without pointer lock | button | null | fps && !running && alternativeInput | No static disabled condition; Host may still reject | Single logical control |
| viewport.grab | interaction | Grab/cancel preview and grab | button | null | fps | !running \|\| held \|\| ghost.stage===pending | Single logical control |
| viewport.drop | interaction | Drop/gentle place | button | null | fps | !held | Single logical control |
| viewport.throw | interaction | Throw | button | null | fps | !running \|\| !held | Single logical control |
| viewport.place | interaction | Place | button | null | fps | !running \|\| !ghost.valid \|\| ghost.stage!==preview | Single logical control |
| viewport.cancel-placement | interaction | Cancel preview | button | null | fps && ghost | No static disabled condition; Host may still reject | Single logical control |
| viewport.start-placement | interaction | Start placement preview | button | null | fps && !ghost | !running \|\| held | Single logical control |
| viewport.retry-webgl | interaction | Retry3D display | button | null | CanvasBoundary failed | No static disabled condition; Host may still reject | Single logical control |
| viewport.step.{direction} | interaction | Forward/backward/left/right movement | button-family | ["KeyW","KeyS","KeyA","KeyD"] | fps、movement details | !running | Finite four directions; release after the source-defined200ms pulse, with safe release on blur/unmount |
| viewport.look.{direction} | interaction | Look left/right/up/down | button-family | {"left":[-60,0],"right":[60,0],"up":[0,-30],"down":[0,30]} | fps、movement details | !running | Finite four directions; one inputLook action |
| viewport.accessible-movement | interaction | Movement and look without pointer lock | disclosure | null | fps | No static disabled condition; Host may still reject | Single logical control |
| viewport.orbit | interaction | Rotate editor observer camera | canvas-gesture | ["Alt+left drag","right drag"] | Editor; not the gizmo owner | No static disabled condition; Host may still reject | Single logical control |
| viewport.pan | interaction | Pan editor observer camera | canvas-gesture | middle drag | Editor; not the gizmo owner | No static disabled condition; Host may still reject | Single logical control |
| viewport.zoom | interaction | Zoom editor observer camera | canvas-gesture | {"gesture":"unmodified wheel","distanceM":[0.5,120]} | Editor; Ctrl/Cmd+wheel remains owned by browser | No static disabled condition; Host may still reject | Single logical control |
| viewport.select-object.{objectId} | interaction | Select3D object | canvas-gesture | left click | editor && !Alt && !gizmoSuppressesSelection | No static disabled condition; Host may still reject | Stable Scene objectId; never identify by mesh/array index |
| viewport.select-path.{pathId} | interaction | Select solved acoustic path | canvas-gesture | left click | Solver path exists | No static disabled condition; Host may still reject | Solved pathId |
| viewport.gizmo-drag.{mode}.{axis} | interaction | Drag transform axis | canvas-gesture | {"handlesByMode":{"translate":["X","Y","Z","XY","YZ","XZ","XYZ"],"scale":["X","Y","Z","XY","YZ","XZ","XYZ"],"rotate":["X","Y","Z","E","XYZE"]},"totalVisibleHandles":19,"cancel":["Escape","blur","pointercancel","lostpointercapture"]} | editor && selected | gizmoEditable false | Finite mode×axis set; success creates exactly one patchObject transaction, cancellation does not commit |
| explorer.search | scene | Search Scene objects | search | name/id, case-insensitive | Always present | No static disabled condition; Host may still reject | Single logical control |
| explorer.add.{shape} | scene | Box/sphere/capsule | button-family | ["box","sphere","capsule"] | primitive library | !canEdit | Add in editor; choose placement shape in FPS; finite set of three shapes |
| explorer.selectObject.{objectId} | scene | Scene object row | button-family | Search-matching name/id | Object exists | No static disabled condition; Host may still reject | Defaults:floor,wall.back,wall.left,wall.right,ball,speaker; generated objects use stable IDs |
| explorer.listenerEnvironment | scene | Listener/environment | button | null | Always present | No static disabled condition; Host may still reject | Single logical control |
| inspector.pause | scene | Pause before editing | button | null | simulation running | No static disabled condition; Host may still reject | Single logical control |
| object.duplicate | scene | Duplicate object | button | null | Selected object exists | !canEdit | Single logical control |
| object.remove | scene | Remove object | button | null | Selected object exists | !canEdit | Single logical control |
| object.position.{axis} | scene | Position X/Y/Z | number | {"min":-200,"max":200,"step":0.1,"unit":"m"} | Selected object exists | !canEdit | Axes X/Y/Z×stable objectId |
| object.boxDimensions.{axis} | scene | Dimensions X/Y/Z | number | {"min":0.01,"max":100,"step":0.1,"unit":"m"} | selected box | !canEdit | Axes X/Y/Z×stable objectId |
| object.diameter | scene | Diameter | number | {"min":0.01,"max":100,"unit":"m","capsuleConstraint":"diameter<=height"} | sphere/capsule | !canEdit | Sphere synchronizes all three axes; capsule synchronizes X/Z |
| object.capsuleHeight | scene | Height | number | {"min":0.01,"max":100,"unit":"m","constraint":"height>=diameter"} | capsule | !canEdit | Single logical control |
| object.rotation.{axis} | scene | Rotation X/Y/Z | number | {"min":-360,"max":360,"step":1,"unit":"deg","rotationOrder":"XYZ→quaternion"} | Selected object exists | !canEdit | Axes X/Y/Z×stable objectId |
| object.bodyMode | scene | Rigid-body mode | select | ["dynamicGravity","dynamicNoGravity","fixed","kinematic"] | Selected object exists | !canEdit | Single logical control |
| object.massKg | scene | Mass | number | {"min":0.001,"max":10000,"step":0.1,"unit":"kg"} | Selected object exists | !canEdit \|\| fixed | Single logical control |
| object.friction | scene | Friction | number | {"min":0,"max":2,"step":0.05} | Selected object exists | !canEdit | Single logical control |
| object.restitution | scene | Restitution | number | {"min":0,"max":1,"step":0.05} | Selected object exists | !canEdit | Single logical control |
| object.acousticMaterial | scene | Acoustic material | select | ["material.hard","material.soft","material.wood","material.metal"] | Selected object exists | !canEdit | Box/sphere/capsule all connect to geometry; new browser verification of four Synthetic materials per shape remains pending |
| object.acousticRole | scene | Acoustic role | select | ["none","staticSurface","dynamicOccluder","dynamicReflector"] | Selected object exists | !canEdit | Box/sphere/capsule all expose none/staticSurface/dynamicOccluder/dynamicReflector; moving staticSurface has explicit downgrade semantics; dynamicReflector uses a true-snapshot approximation |
| listener.position.{axis} | scene | Listener position X/Y/Z | number | {"min":-200,"max":200,"step":0.1,"unit":"m"} | Listener Inspector | !canEdit \|\| attachment===fpsHead | axes X/Y/Z；listener.main |
| listener.rotation.{axis} | scene | Listener rotation X/Y/Z | number | {"min":-360,"max":360,"step":1,"unit":"deg"} | Listener Inspector | !canEdit \|\| attachment===fpsHead | axes X/Y/Z；listener.main |
| environment.medium | scene | Propagation medium | select | ["air","vacuum"] | Listener Inspector | !canEdit；missing placeholder disabled | Single logical control |
| environment.temperatureC | scene | Air temperature | number | {"min":-80,"max":100,"step":1,"unit":"°C"} | Listener Inspector and temperature value exists | !canEdit \|\| medium===vacuum | Single logical control |
| asset.details.{assetId} | behavior | Source information | disclosure | null | Asset exists | No static disabled condition; Host may still reject | assetId and SHA pin |
| asset.audition.{assetId} | behavior | Audition audio file | button | null | Asset exists | asset.status!==ready \|\| simulation running | assetId |
| asset.importDetails | behavior | Import audio | disclosure | null | Always present | No static disabled condition; Host may still reject | Single logical control |
| asset.rightsConfirmed | behavior | Confirm audio usage rights | checkbox | Explicit rights confirmation | Import section expanded | No static disabled condition; Host may still reject | Single logical control |
| asset.importFile | behavior | Choose WAV file | file | {"accept":".wav,audio/wav,audio/x-wav"} | Hidden input triggered by the import button | No static disabled condition; Host may still reject | Clear value after change; an original fixture can test selecting the same file again |
| asset.importButton | behavior | Import audio | button | null | Import section expanded | !rights \|\| !canEdit | Single logical control |
| inspector.discardAllDrafts | behavior | Discard all sound drafts | button | null | Current Project has rule/binding drafts | Any pending operation | Single logical control |
| behavior.classification | behavior | Design classification | select | ["creative","physical","hybrid","procedural"] | SoundEditor | !canEdit | Classification metadata does not automatically replace generator or solver |
| behavior.newTrigger | behavior | Add trigger | select | catalog.soundTriggers | SoundEditor | editDisabled/canEdit and registry zone prerequisite (not a missing producer) | Single logical control |
| behavior.addRule | behavior | Add rule | button | null | SoundEditor | !canEdit \|\| trigger capability/data prerequisite unavailable \|\| missing valid zone | Single logical control |
| preview.stop | behavior | Stop preview | button | null | preview/metadata/error exists | monitor blocked && preview idle | Single logical control |
| preview.details | behavior | Preview source details | disclosure | null | Preview metadata exists | No static disabled condition; Host may still reject | Single logical control |
| rule.enabled.{ruleId} | behavior | Enable rule | checkbox | null | Rule exists | disabled \|\| pending \|\| bindingEnabled===false | Stable binding/profile/rule IDs |
| rule.delete.{ruleId} | behavior | Delete rule | button | null | Rule exists | editDisabled \|\| draft exists | Single logical control |
| rule.preview.{ruleId} | behavior | Scene preview | button | null | Rule exists | disabled \|\| pending \|\| dirty \|\| bindingDraft \|\| replaying | Single logical control |
| rule.trigger.{ruleId} | behavior | Trigger | select | catalog.soundTriggers | Rule exists | editDisabled/canEdit and registry zone prerequisite (not a missing producer) | Single logical control |
| rule.asset.{ruleId} | behavior | Sound asset | select | ["__oscillator","ready assetId"] | Rule exists | editDisabled | Assets use stable assetId; selection changes generator |
| rule.gainLinear.{ruleId} | behavior | Gain | number | {"min":0,"max":4,"step":0.05} | Rule exists | editDisabled | Single logical control |
| rule.pitchSemitones.{ruleId} | behavior | Pitch | number | {"min":-24,"max":24,"step":1,"unit":"semitones"} | Rule exists | editDisabled | Single logical control |
| rule.cooldownSeconds.{ruleId} | behavior | Cooldown | number | {"min":0,"max":10,"step":0.05,"unit":"s"} | Rule exists | editDisabled | Single logical control |
| rule.discard.{ruleId} | behavior | Discard rule draft | button | null | Draft exists | pending | Single logical control |
| rule.apply.{ruleId} | behavior | Apply rule draft | button | null | Draft exists | editDisabled \|\| stale \|\| numericInvalid \|\| mappingErrors \|\| no changedFields \|\| enabledUnsupported | Single logical control |
| binding.details.{ruleId} | behavior | Per-object overrides | disclosure | null | Each rule | No static disabled; Host may still reject | By bindingId/ruleId |
| binding.override.{field} | behavior | Override fields | checkbox-family | ["enabled","gainLinear","pitchSemitones"] | binding details | disabled \|\| pending \|\| metadataProblem | Finite 3 fields × bindingId/ruleId |
| binding.enabledValue | behavior | Override enabled value | checkbox | null | binding details | editingDisabled \|\| enabled override not selected | Single logical control |
| binding.gainValue | behavior | Override gain value | number | {"min":0,"max":4,"step":0.05} | binding details | editingDisabled \|\| gain override not selected | Single logical control |
| binding.pitchValue | behavior | Override pitch value | number | {"min":-24,"max":24,"step":1} | binding details | editingDisabled \|\| pitch override not selected | Single logical control |
| binding.discard | behavior | Discard override draft | button | null | entry exists | pending | Single logical control |
| binding.apply | behavior | Apply override | button | null | entry exists | editingDisabled \|\| conflict \|\| validationErrors | Single logical control |
| binding.clearSaved | behavior | Clear saved override | button | null | binding details | editingDisabled \|\| draft \|\| no source \|\| already inherited | Single logical control |
| binding.readout.{baseOrEffective}.{field} | behavior | Full-precision baseline/effective values | focusable-readout | {"sides":["base","effective"],"fields":["enabled","gainLinear","pitchSemitones"]} | binding details | No static disabled; Host may still reject | Finite 2 × 3 × bindingId/ruleId; read-only and HelpTip |
| mapping.remove.{mappingId} | behavior | Delete mapping | button | null | mapping exists | parent disabled | Stable mappingId; draft key links to its source |
| mapping.input.{mappingId} | behavior | Input quantity | select | catalog.mappingInputs | mapping exists | parent disabled | Single logical control |
| mapping.target.{mappingId} | behavior | Output parameter | select | ["gainLinear","pitchSemitones","filterCutoffHz"] | mapping exists | parent disabled; target options used by other mappings disabled | Single logical control |
| mapping.inputMin.{mappingId} | behavior | Input minimum | number | {"min":0,"max":1000000000,"step":"any","constraint":"min<max"} | mapping exists | parent disabled | Single logical control |
| mapping.inputMax.{mappingId} | behavior | Input maximum | number | {"min":0,"max":1000000000,"step":"any","constraint":"min<max"} | mapping exists | parent disabled | Single logical control |
| mapping.outputMin.{mappingId} | behavior | Output minimum | number | {"htmlMinMax":null,"domain":"gain[0,4],pitch[-24,24],cutoff[20,20000]","constraint":"min<=max"} | mapping exists | parent disabled; domain validation blocks Apply | Single logical control |
| mapping.outputMax.{mappingId} | behavior | Output maximum | number | {"htmlMinMax":null,"domain":"gain[0,4],pitch[-24,24],cutoff[20,20000]","constraint":"min<=max"} | mapping exists | parent disabled; domain validation blocks Apply | Single logical control |
| mapping.interpolation.{mappingId} | behavior | Interpolation | select | ["linear","step"] | mapping exists | parent disabled | Single logical control |
| mapping.smoothingSeconds.{mappingId} | behavior | Smoothing time | number | {"min":0,"max":1,"step":0.01,"unit":"s"} | mapping exists | parent disabled | Single logical control |
| mapping.point.{pointKey}.{axis} | behavior | Curve point X/Y | number | `{"min":0,"max":1,"step":0.01,"constraint":"x嚴格遞增、首尾x=0/1"}` | mapping exists | parent disabled | Axis x/y × stable draft pointKey; row order is not a persistent ID |
| mapping.removePoint.{pointKey} | behavior | Delete curve point | button | null | curve point exists | disabled \|\| <=2points \|\| first/last | Single logical control |
| mapping.addPoint | behavior | Add curve point | button | {"maxPoints":16} | mapping editor | disabled \|\| canonicalInvalid \|\| >=16 | Single logical control |
| mapping.addMapping | behavior | Add mapping | button | {"schemaMax":8,"uniqueTargets":3} | mapping editor | disabled \|\| no unused target \|\| >=8 | Single logical control |
| dock.tab.events | pipeline | Events and record/replay | tab | ["pointer","ArrowLeft","ArrowRight","Home","End"] | dock always present | No static disabled; Host may still reject | Finite 7 tabs; selection expands panel and moves focus |
| dock.tab.paths | pipeline | Acoustic paths | tab | ["pointer","ArrowLeft","ArrowRight","Home","End"] | dock always present | No static disabled; Host may still reject | Finite 7 tabs; selection expands panel and moves focus |
| dock.tab.comparison | pipeline | Experiment comparison | tab | ["pointer","ArrowLeft","ArrowRight","Home","End"] | dock always present | No static disabled; Host may still reject | Finite 7 tabs; selection expands panel and moves focus |
| dock.tab.agent | pipeline | Meta Experiment Agent | tab | ["pointer","ArrowLeft","ArrowRight","Home","End"] | dock always present | No static disabled; Host may still reject | Finite 7 tabs; selection expands panel and moves focus |
| dock.tab.motion | pipeline | Motion | tab | ["pointer","ArrowLeft","ArrowRight","Home","End"] | dock always present | No static disabled; Host may still reject | Finite 7 tabs; selection expands panel and moves focus |
| dock.tab.render | pipeline | Audio export | tab | ["pointer","ArrowLeft","ArrowRight","Home","End"] | dock always present | No static disabled; Host may still reject | Finite 7 tabs; selection expands panel and moves focus |
| dock.tab.performance | pipeline | Performance | tab | ["pointer","ArrowLeft","ArrowRight","Home","End"] | dock always present | No static disabled; Host may still reject | Finite 7 tabs; selection expands panel and moves focus |
| dock.collapse | pipeline | Expand/collapse experiment panel | toggle-button | aria-expanded | dock always present | No static disabled; Host may still reject | Single logical control |
| events.record | pipeline | Start/stop recording | stateful-button | null | events panel | replaying \|\| simulation error | Single logical control |
| events.replay | pipeline | Replay recording/end replay | button | null | events panel | no complete recording or recording active | Single logical control |
| events.export | pipeline | Export sealed recording | download | JSON | events panel | no artifact (fallback canReplay) | Single logical control |
| events.filter | pipeline | Filter events | search | trim + case-insensitive; event/type/object/rule/asset/reason/instance/native IDs | events panel | No static disabled; Host may still reject | Single logical control |
| events.seek | pipeline | Replay time | range | {"min":0,"max":"recording duration","step":0.001,"unit":"s"} | canReplay | duration<=0 \|\| recording | Single logical control |
| events.select.{eventId} | pipeline | Event-table link | button-or-link | Up to 200 recent matches | event exists | No static disabled; Host may still reject | Stable eventId; composite stable event key where necessary |
| events.table-scroll | pipeline | Event table | focusable-scroll | null | recent.length>0 | No static disabled; Host may still reject | Single logical control |
| paths.select.{pathId} | pipeline | Acoustic-path row | button-or-link | Includes stale/blocked labels | paths exist | No static disabled; Host may still reject | Stable solver pathId |
| paths.table-scroll | pipeline | Acoustic-path table | focusable-scroll | null | paths exist | No static disabled; Host may still reject | Single logical control |
| comparison.capture.A | pipeline | Save/update snapshot A | button | null | comparison panel | Host determines validity | Single logical control |
| comparison.capture.B | pipeline | Save/update snapshot B | button | null | comparison panel | Host determines validity | Single logical control |
| comparison.kind | pipeline | Comparison type | select | ["acoustic","behavior"] | comparison panel | No static disabled; Host may still reject | Single logical control |
| comparison.execute | pipeline | Check and compare | button | null | comparison panel | !hasA \|\| !hasB | Single logical control |
| agent.provider | pipeline | AI execution mode | select | ["offline","meta"] | agent panel | loading | Single logical control |
| agent.status-refresh | pipeline | Recheck server status | button | null | agent panel | agent loading \|\| status loading | Single logical control |
| agent.undo | pipeline | Undo last AI application | button | null | agent panel | loading \|\| canUndo!==true | Single logical control |
| agent.prompt | pipeline | Experiment instruction | textarea | `{"maxLength":4000,"rows":2,"submit":"Ctrl/Cmd+Enter","newline":"Enter","ime":"composition不提交"}` | agent panel | No static disabled; Host may still reject | Single logical control |
| agent.preview-submit | pipeline | Generate operation preview | submit-button | null | agent panel | blank \|\| loading \|\| meta not ready | Single logical control |
| agent.validated-diff | pipeline | Validated diff | focusable-scroll | pre | preview exists | No static disabled; Host may still reject | Single logical control |
| agent.apply | pipeline | Apply/pause and apply operation | button | null | preview exists | !canApply \|\| loading | Single logical control |
| agent.cancel-preview | pipeline | Cancel preview | button | null | preview exists | loading | Single logical control |
| workflow.duration | pipeline | Baseline experiment duration | number | {"min":1,"max":10,"step":1,"unit":"s","default":3} | Agent workflow | running \|\| cancelRequested | Single logical control |
| workflow.baseline | pipeline | Create baseline experiment | button | null | Agent workflow | busy | Single logical control |
| workflow.compare | pipeline | Compare current material using the same motion | button | null | Agent workflow | busy \|\| !canCompare | Single logical control |
| workflow.cancel | pipeline | Cancel experiment workflow | button | null | busy | cancelRequested | Single logical control |
| workflow.details | pipeline | Steps and result sources | disclosure | null | steps nonempty \|\| baseline exists | No static disabled; Host may still reject | Single logical control |
| workflow.raw-explanation | pipeline | Raw Host explanation | disclosure | null | explanation exists | No static disabled; Host may still reject | Single logical control |
| motion.action-id | pipeline | Action ID | text | {"required":true,"maxLength":64,"pattern":"[a-z][a-z0-9._\\-]{0,63}"} | Motion panel | editDisabled \|\| !selected | Single logical control |
| motion.kind | pipeline | Action type | select | ["moveTo","moveAndRelease","impulse"] | Motion panel | editDisabled | Single logical control |
| motion.target.{axis} | pipeline | Target position X/Y/Z | number | {"min":-200,"max":200,"step":"any","unit":"m"} | kind!==impulse | editDisabled | Finite X/Y/Z × selected objectId |
| motion.impulse.{axis} | pipeline | Impulse X/Y/Z | number | {"min":-1000,"max":1000,"step":"any","unit":"N·s"} | kind===impulse | editDisabled | Finite X/Y/Z × selected objectId |
| motion.max-speed | pipeline | Maximum speed | number | {"min":0.01,"max":3,"step":"any","unit":"m/s","default":1} | kind!==impulse | editDisabled | Single logical control |
| motion.max-acceleration | pipeline | Maximum dynamic-control acceleration | number | {"min":0.1,"max":100,"step":"any","unit":"m/s²","default":12} | kind!==impulse | editDisabled \|\| selected mode kinematic | Single logical control |
| motion.max-impulse | pipeline | Maximum impulse | number | {"min":0.001,"max":1000,"step":"any","unit":"N·s","default":10} | Motion panel | editDisabled | Single logical control |
| motion.timeout | pipeline | Timeout | number | {"min":0.1,"max":60,"step":"any","unit":"s","default":10} | Motion panel | editDisabled | Single logical control |
| motion.release-policy | pipeline | Release velocity | select | {"dynamic":["preserve","zero"],"kinematic":["zero","transfer"]} | kind===moveAndRelease | editDisabled | Single logical control |
| motion.release-mode | pipeline | Mode after release | select | ["dynamicGravity","dynamicNoGravity"] | kind===moveAndRelease && kinematic | editDisabled | Single logical control |
| motion.save | pipeline | Save action | submit-button | null | Motion panel | editDisabled \|\| !selected \|\| fixed | Single logical control |
| motion.undo | pipeline | Undo action edit | button | null | Motion panel | editDisabled \|\| !canUndo | Single logical control |
| motion.redo | pipeline | Redo action edit | button | null | Motion panel | editDisabled \|\| !canRedo | Single logical control |
| motion.rebase | pipeline | Rebind to current scene | button | null | Motion panel | editDisabled \|\| !stale | Single logical control |
| motion.export | pipeline | Export actions | download | JSON | Motion panel | No static disabled; Host may still reject | Single logical control |
| motion.import | pipeline | Import actions | file | {"accept":"application/json,.json"} | Motion panel | editDisabled | Clear file input after reading |
| motion.run.{actionId} | pipeline | Run action | button | null | action exists | stale \|\| activeRunIds nonempty; outer disabled not applied directly | Stable actionId |
| motion.remove.{actionId} | pipeline | Remove action | button | null | action exists | editDisabled | Stable actionId |
| motion.cancel.{runId} | pipeline | Cancel action | button | null | active run among the latest 4 runs | No static disabled; Host may still reject | Stable runId |
| render.capture-short | pipeline | Record 3 seconds | button | {"durationS":3} | callback exists | busy | Single logical control |
| render.execute | pipeline | Generate audio files | button | null | Render panel | busy \|\| !recordingAvailable | Single logical control |
| render.cancel | pipeline | Cancel audio generation | button | null | state===rendering | No static disabled; Host may still reject | Single logical control |
| render.tail | pipeline | Retain reverb tail | number | {"min":0,"max":10,"step":0.5,"unit":"s","default":2} | Render panel | busy | Single logical control |
| render.stems | pipeline | Per-source stems | checkbox | {"default":true} | Render panel | busy | Single logical control |
| render.download.{outputId} | pipeline | Download mix/master/dry/stems | download | float32 WAV | outputs nonempty | No static disabled; Host may still reject | Stable outputId; source stems by object/source ID |
| render.manifest | pipeline | Download source and hash manifest | download | JSON | outputs nonempty | No static disabled; Host may still reject | Single logical control |
| performance.enabled | pipeline | Enable cost observation | checkbox | null | onEnabledChange exists | !observed | Single logical control |
| performance.details | pipeline | Update cost and component counters | disclosure | null | Performance panel | No static disabled; Host may still reject | Single logical control |
| monitor.enable-mute | audio_core | Enable listening / mute monitoring | stateful-button | blocked→enableAudio; otherwise toggleMute | Always present | No static disabled condition; Host may still reject | Single logical control |
| monitor.gain | audio_core | Monitor volume | range | {"min":-40,"max":12,"step":1,"unit":"dB digital","default":0} | Always present | No static disabled condition; Host may still reject | Single logical control |
| monitor.buffer-preset | audio_core | Audio buffer | select | ["interactive","balanced","playback"] | Always present | monitor.rebuilding | Single logical control |
| monitor.simulated | audio_core | Simulated | toggle-button | mode=simulated | Always present | No static disabled condition; Host may still reject | Single logical control |
| monitor.raw | audio_core | Raw reference | toggle-button | mode=raw | Always present | No static disabled condition; Host may still reject | Single logical control |
| monitor.details | audio_core | Monitor information | disclosure | null | Always present | No static disabled condition; Host may still reject | Single logical control |
| monitor.reverb-details | audio_core | Synthetic late reverb | disclosure | null | Always present | No static disabled condition; Host may still reject | Single logical control |
| monitor.reverb-enabled | audio_core | Enable late reverb | checkbox | null | reverb details | !monitor.lateReverb | Single logical control |
| monitor.reverb-decay | audio_core | Synthetic late-reverb decay | number | {"min":0.1,"max":4,"step":0.1,"unit":"s"} | monitor.lateReverb exists | No static disabled condition; Host may still reject | Single logical control |
| monitor.reverb-wet | audio_core | Late-reverb Wet gain | number | {"min":0,"max":1,"step":0.01,"unit":"linear"} | monitor.lateReverb exists | No static disabled condition; Host may still reject | Single logical control |
| help.{callerTopic} | interaction | Supplemental help / disabled reason at each site | help-affordance-family | ["hover","focus","Escape","touch click","disabled adjacent info button"] | Every HelpTip caller; Section help also creates callers | Wrapped disabled controls remain disabled; an adjacent info button provides access | Map every caller's content and reachability; tests may share the generic interaction contract, but one tooltip does not establish every caller |
| shared.number-field | interaction | All NumberField drafts and input arbitration | shared-input-policy | ["Enter commit","blur commit","Escape revert","IME composition","locale focus retains draft","invalid raw retains and shows error"] | NumberField caller | caller disabled | Check generic behavior separately from each caller's range and actual Host effect |
| keyboard.scene.undo-redo-save | interaction | keyboard.scene.undo-redo-save | keyboard-or-pointer-family | ["Ctrl/Cmd+Z","Ctrl/Cmd+Shift+Z","Ctrl/Cmd+S"] | Not typing/contenteditable/dialog/IME; Undo/Redo do not reverse physics time | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| keyboard.scene.delete | interaction | keyboard.scene.delete | keyboard-or-pointer-family | ["Delete"] | editor, selected object, not typing; Host handles canEdit | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| keyboard.fps.move | interaction | keyboard.fps.move | keyboard-or-pointer-family | ["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight"] | Actual lock or alternative+canvasfocus; running; not IME/repeat/modifier/typing | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| keyboard.fps.actions | interaction | keyboard.fps.actions | keyboard-or-pointer-family | ["KeyE","KeyG","KeyR","KeyF","KeyB","KeyL"] | Same FPS arbitration; InteractionHost decides each action state | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| keyboard.fps.look | interaction | keyboard.fps.look | keyboard-or-pointer-family | ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"] | No lock, canvasfocus, running, no modifier | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| keyboard.fps.resume-pause | interaction | keyboard.fps.resume-pause | keyboard-or-pointer-family | ["Enter"] | fps, actual ownership, no repeat/modifier; run or pause; entry/gesture does not resend an action | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| keyboard.fps.escape | interaction | keyboard.fps.escape | keyboard-or-pointer-family | ["Escape"] | Cancel preview or clear input and pause/unlock; no automatic restore | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| keyboard.fps.tab | interaction | keyboard.fps.tab | keyboard-or-pointer-family | ["Tab","Shift+Tab"] | releaseToUI when lock/pending/alternative ownership exists; retain browser focus navigation | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| pointer.fps.actions | interaction | pointer.fps.actions | keyboard-or-pointer-family | ["left press/release","right press/release","mousemove","wheel"] | lock+armed+running; the activation click does not also throw/place; paused primary release only Resumes | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| input.interruption | interaction | input.interruption | keyboard-or-pointer-family | ["blur","document hidden","compositionstart","focusUI","lostpointercapture"] | Clear release ledgers and perform bounded pause/cancel; re-entry requires an explicit gesture | Must not act when input is not owned by the viewport/scene | Only the listed finite keys/gestures; record press, repeat, release and interruption paths separately |
| viewport.gentle-place | interaction | Gentle place | button | Same bounded place Host; Held object, not ghost placement | fps Held branch (actual conditions await a final-source rescan) | Subject to running/Held/Host acceptance conditions | New UI entry; old ghost Place or G-key tests cannot establish PASS for the new label |
| dock.tab.zones | pipeline | Zones | tab | ["pointer","ArrowLeft","ArrowRight","Home","End"] | dock always present | None | Eighth tab; old seven-tab tests cannot establish eight-tab coverage |
| zone.add | pipeline | Add zone | button | {"maxZones":16} | Zone panel | !canEdit \|\| pending \|\| draft \|\| zones.length>=16 | Single logical control |
| zone.enabled.{zoneId} | pipeline | Enable / disable existing zone | checkbox | null | zone exists | !canEdit \|\| pending \|\| draft | stable zoneId |
| zone.edit.{zoneId} | pipeline | Edit zone | button | null | zone exists | !canEdit \|\| pending \|\| draft | stable zoneId |
| zone.remove.{zoneId} | pipeline | Remove zone | button | Host rejects while rules reference the zone; retarget/remove those references first | zone exists | !canEdit \|\| pending \|\| draft | stable zoneId |
| zone.id | pipeline | Zone ID | text | {"maxLength":64,"pattern":"^[a-z][a-z0-9._-]{0,63}$"} | zone draft | pending \|\| !canEdit \|\| existingId!==null | Editable for a new zone; existing ID immutable |
| zone.name | pipeline | Zone name | text | {"minLength":1,"maxLength":80} | zone draft | pending \|\| !canEdit | Single logical control |
| zone.shape | pipeline | Zone shape | select | ["aabb","sphere"] | zone draft | pending \|\| !canEdit | Single logical control |
| zone.draft-enabled | pipeline | Enable draft zone | checkbox | null | zone draft | pending \|\| !canEdit | Single logical control |
| zone.center.{axis} | pipeline | Center position X/Y/Z | number | {"min":-200,"max":200,"step":"any","unit":"m"} | zone draft | pending \|\| !canEdit | Finite X/Y/Z × draft zoneId |
| zone.half-extents.{axis} | pipeline | Half extents X/Y/Z | number | {"min":0.05,"max":50,"step":"any","unit":"m"} | aabb zone draft | pending \|\| !canEdit | Finite X/Y/Z × draft zoneId |
| zone.radius | pipeline | Zone radius | number | {"min":0.05,"max":50,"step":"any","unit":"m"} | sphere zone draft | pending \|\| !canEdit | Single logical control |
| zone.hysteresis | pipeline | Boundary hysteresis | number | `{"min":0,"max":0.25,"step":"any","unit":"m","constraint":"小於最小halfExtent/radius"}` | zone draft | pending \|\| !canEdit | Single logical control |
| zone.save | pipeline | Save zone | submit-button | Scene revision + registryPin guarded atomic save | zone draft | !canEdit \|\| pending \|\| stale \|\| invalid | Single logical control |
| zone.cancel | pipeline | Cancel zone draft | button | null | zone draft | pending | Single logical control |
| zone.escape | pipeline | Esc cancels zone draft | keyboard | Escape; composition is not handled | zone draft | pending | Single logical control |
| zone.overlay.{zoneId} | pipeline | Zone nominal-volume wireframe | read-only authoring-overlay | {"shapes":["aabb","sphere"],"nominalVolume":true} | editor && !replaying && zones exist | Does not participate in picking/collision; raycast noop | stable zoneId; distinct enabled/disabled appearance |
| behavior.newZoneId | behavior | Zone selector for a new zone trigger | select | enabled registry zoneIds | new trigger is OnEnterZone/OnExitZone | !canEdit; no available zone prevents Add | stable zoneId; submit together with trigger |
| rule.zone.{ruleId} | behavior | Rule zone selector | select | registry zoneIds; disabled zones are unavailable except the existing reference | rule trigger is OnEnterZone/OnExitZone | editDisabled; missing zone shows an error and prevents Apply | stable ruleId + zoneId |

<!-- english-original-anchor --> <a id="共用輸入與限制"></a>
## Shared input and limits

- **number**: pointer focus, keyboard direct entry, Enter commit, blur commit, Escape revert, valid fractional finite values, min/max, outside range, empty/nonfinite, IME/locale retention. Not every method applies to every field; NOT_APPLICABLE needs a source-based reason.
- **select**: pointer choice, keyboard Arrow/Enter, each existing enabled option, disabled-option reason, cancel/undo or restore where applicable. Options come from a finite catalog; dynamic assets follow the fixture catalog and stable ID.
- **button**: pointer click, Tab+Enter/Space activation, enabled prerequisite, disabled reason/no mutation, async overlap/cancel where applicable. A click alone does not establish Host success; assert the visible/data/file result.
- **details-and-scroll**: pointer toggle, keyboard activation, focus and reachable content, scroll where overflowing. Read-only data must not be counted as editable parameters.
- **canvas**: source pointer gesture, keyboard/explicit alternative, cancel/blur/release, selection synchronization. Explicitly disclose a lack of native pointer-lock evidence in headless tests; alternative input does not establish native lock.
- **help**: caller reachability and correct content, shared hover/focus/Escape/touch, disabled fallback. Generic interactions may share tests; reachability/content mapping for each caller cannot be omitted.
- **file**: valid original fixture, malformed/unsupported inputs, boundary size where feasible, same-file retry, cancel, atomic preservation of old state. Audio rights require an explicit checkbox; do not introduce commercial assets.

The generic HelpTip hover/focus/Escape/touch/disabled fallback contract may be shared, but each caller's reachability and content still require mapping. Section help is included. PanelDivider covers drag, arrows, Home, double-click and exclusion from focus when hidden. Actual FPS lock and the alternative without lock are separate; blur/hidden/OS input is not declared verified without direct event evidence.

There are currently no Meta model/key/budget/context editors, Performance refresh, Mapping clamp toggle or curve-SVG drag. Read-only metrics/provenance/progress are not editable parameters. Legitimate prerequisites such as Fixed/kinematic control ownership, vacuum, busy/invalid/stale states and external account/hardware gates are not removed because new features were requested.

<!-- english-original-anchor --> <a id="獨立crosswalk進度"></a>
## Independent crosswalk progress

See [CROSSWALK.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/5f66c543518e9a9ab8e8bffc45cbc25a8f602233) and [CROSSWALK.md](CROSSWALK.md). All217/217 semantic families have bounded interaction/reachability evidence, with no unjoined family. This combines evidence across versions and conditions; it does not establish every value combination, every native condition or one full rerun of the final501 bundle.

| Lane | Families with bounded evidence | Families awaiting join |
| --- | ---: | ---: |
| interaction | 59 | 0 |
| scene | 22 | 0 |
| behavior | 46 | 0 |
| pipeline | 80 | 0 |
| audio_core | 10 | 0 |

The final targeted checks verified actual horizontal wheel/ArrowLeft movement inside the Paths and Events regions; visible Zone editor wireframes, object picking through the wireframes, hidden overlays and disabled authoring in Replay/FPS; and exact raw content/method observations for20 unique Help callers. The original failures/interruptions and individual PASS observations from attempts02/03/04 remain separate. Final04 is one passing case/exit0, not every Help caller rerun in one execution.

The Help denominator is71 static callers: all68 callers reachable through ordinary public UI have actual nonempty content, and the final20 targeted callers add content/method evidence. Two genuine Audio nativeRejection conditions did not occur naturally, and one empty comparison.status fallback is unreachable through the current public Host. All three remain NOT_OBSERVED, without invented browser PASS. See the [Help crosswalk](HELP_CALLER_CROSSWALK.md) and [source classification](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/317e9495b553e6e501176ca71efccf01157750c7).

The501 Tail guard and complete combined scenario have actual interaction evidence. The five WAV files in [Stage12](../12-final-integrated-ui-audio.md) passed byte/manifest/original-download verification, retaining the original stems-sum tolerance. Native Computer Use product operation/export, device hearing, Meta live, formal600-second performance and complete V1 gates remain separate.

The exact Markdown preimage from before this section was updated remains in docs/15-ui-parameter-audit/history/INVENTORY.before-final-current-summary.md.raw.txt; INVENTORY.json's pinned AST source and bytes were not rewritten to fit the results.
