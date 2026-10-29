<!-- english-source: {"path":"docs/05-ux/COMPETITIVE_UX_RESEARCH.md","sha256":"5298dd37f476ba935baa90273ba8e74bc9f88442c67e1476a1a4afc01043dbd3","translated_at":"2026-10-27T03:42:00.077451Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/05-ux/COMPETITIVE_UX_RESEARCH.md`](../../05-ux/COMPETITIVE_UX_RESEARCH.md). Source SHA-256: `5298dd37f476ba935baa90273ba8e74bc9f88442c67e1476a1a4afc01043dbd3`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="專業工具與物理沙盒-ux-比較"></a>
# UX Comparison of Professional Tools and Physics Sandboxes

Review date: 2026-10-26 (Asia/Taipei). Status: **Official documentation research completed; no hands-on product testing, user interviews, or task timing performed**. No Figma work was created, competitor assets downloaded, or interface code copied at this stage. All interaction costs, user classifications, and assessments of “suitable/unsuitable” are the researcher's design inferences from workflows, not empirical usability conclusions.

<!-- english-original-anchor --> <a id="證據規則"></a>
## Evidence Rules

- `READ`: The body of the official page was readable. `SEARCH_ONLY`: Content was available only through the official search index; the complete page has not been read. `LEGACY_REFERENCE`: Official documentation for an older version; it can support only that version.
- `UNKNOWN`: Insufficient information was obtained in this review. This does not establish that the product lacks a feature. Inaccessibility and version inconsistencies are recorded separately.
- This document separates “facts from product documentation” from “Reflection Lab design inferences.” Source codes in each row refer to the original links at the end; all dates are the review date above.
- A particular simulation engine's ability to display lines does not mean that other backends can export the same data; illustrations, geometry checks, solver results, and measurements must not be conflated.

<!-- english-original-anchor --> <a id="矩陣-a任務資訊架構與直接操作"></a>
## Matrix A: Tasks, Information Architecture, and Direct Manipulation

| Product / core users (classification is inferred) | Workflow | Main areas | Object selection | 3D Camera | Property editing |
| --- | --- | --- | --- | --- | --- |
| **Unity Editor** / 3D developers | Create objects in Scene→organize in Hierarchy→configure in Inspector→test in Game/Play [U1,U4] | Scene, Hierarchy, Inspector, Project, Game, Console [U1] | Older documentation supports clicking in Scene/Hierarchy; the Unity 6 Selection API supports the relationship between the active object and Inspector; exact current multiselection keys UNKNOWN [U5,U6] | MMB pan, Alt+LMB orbit, wheel zoom; RMB+WASD flythrough, Q/E vertical movement, F frame [U2] | Displayed according to GameObject/Asset/Component; multiselection and locking the Inspector are available [U3] |
| **Blender** / modeling and animation authors | Switch Workspace by task→select active object→Object transform/Edit geometry [B1,B4] | Viewport, Outliner, Properties, Timeline in Layout [B1] | Exact latest Outliner operations UNKNOWN; older 2.81 supports selection, collections, hiding/disabling selection [B6] | MMB orbit, Shift+MMB pan, number keys for standard views; official 5.2 index, no hands-on testing [B2] | Organized by scene/object/material context, with search and pin; direct gizmo manipulation coexists with numeric input [B3,B5] |
| **Sound Particles** / spatial sound designers | Add Particle Track in SP2→import sound→virtual microphone→Render [S1] | Views, Time Editor, Transport, Inspector on the right [S1] | Click a timeline track and the Inspector changes with the selection; 3D multiselection modifier keys UNKNOWN [S1,S3] | SP2 perspective/top/front/360/VR views; SP3 specs additionally list microphone/object POV; exact keys UNVERIFIED [S1–S3] | Contextual Inspector for tracks/objects; I/O settings are separate from Project propagation options [S1] |
| **Treble** / acoustic designers and consultants | Model→layers/materials→sources/receivers→run→Results/Report→Auralizer [T1] | Model Editor, surface/layer lists, sources/receivers tabs, result information panels [T1,T2] | Surface list, Ctrl/Shift multiselection; clicking an individual reflection in result charts synchronizes with 3D [T1,T2] | Auralizer provides first-person looking around at the receiver and a directional minimap; exact Model Editor orbit/pan keys UNKNOWN [T1] | Material library search/tags and surface assignment; source/receiver axis dragging or precise coordinates [T1] |
| **Wwise Spatial Audio** / game audio integrators | Connect runtime→capture→object/listener→trace 3D/RTPC/events [W1] | Game Object Explorer, 3D Viewer, Game Sync Monitor; Capture Log, Performance Monitor [W1] | Select object/listener in Explorer; exact rules for selecting events in Viewer UNKNOWN [W1,W2] | perspective/orthographic, Locate/Follow/Frame All; MMB pan, wheel zoom, Alt-drag orbit, RMB+WASD [W2 SEARCH_ONLY] | Configure attenuation/positioning and Room aux bus in Authoring; Viewer is a debugging view, not a complete scene editor [W3,W4] |
| **FMOD Studio** / interactive audio authors | event→timeline/parameter sheet→audition→Sandbox/live runtime→Profiler [F1–F3] | Event Editor: browser on the left, timeline in the center, overview on the right, deck at the bottom; Sandbox timeline＋map [F1,F2] | Select events in the event browser; instrument/track/parameter selection affects the deck; Sandbox map/overview support multiselection [F1,F2] | 3D Preview is a listener-centered top-down audition view: drag emitter, wheel rotate, double-click reset; free orbit UNKNOWN [F4] | Deck edits the selection; parameters can be observed in runtime/profiler; event preview does not equal all runtime instances [F1,F3] |
| **ODEON** / room acoustics engineers | Import room→source/receiver/material→Room Setup→Job List→results [O1] | Task toolbars, multiple result windows; materials: surfaces on the left, library on the right [O1] | Table selection highlights corresponding geometry; selecting a path in the reflectogram synchronizes with 3D [O1,O4] | v13 guide: LMB orbit, RMB pan, Alt+LMB zoom, keyboard standard views; whether v19 is identical UNKNOWN [O1] | Material table and dedicated room/source/receiver settings; capabilities must not be inferred across editions [O1–O3] |
| **Garry's Mod** / physics sandbox players | Aim crosshair→Spawnmenu→spawn prop→Physgun grab/rotate/freeze [G1–G3] | First-person crosshair; Spawnmenu: props on the left, tools/utilities on the right [G2] | Crosshair＋hold Physgun LMB to grab; beam shows target; wheel adjusts distance [G3] | Documentation supports first-person aiming; complete WASD/camera mapping UNKNOWN in this review [G1–G3] | Contextual tool settings, utilities; scientific material Inspector UNKNOWN [G2] |

<!-- english-original-anchor --> <a id="矩陣-b模式聲音圖表與遷移價值"></a>
## Matrix B: Modes, Sound, Charts, and Transfer Value

| Product | Mode switching | Audio feedback and information visualization | Interaction cost / learning curve (UNTESTED inference) | Reusable design principles (inference) | Designs unsuitable for direct adoption (inference) |
| --- | --- | --- | --- | --- | --- |
| Unity | Play/Pause/Step; stopping Play restores temporary changes; Game focus can restrict Editor shortcuts [U4] | Game Mute, Stats, Gizmos; acoustic RIR analysis UNKNOWN in this review [U4] | Moderate; components and multiple panels require understanding | Linked hierarchy, viewport, and Inspector; explicit input scope | Play restoration must not silently discard experiments; flythrough is not a character with collisions; F Frame conflicts with Freeze |
| Blender | Workspace is an editor configuration; Object/Edit mode changes tools and shortcuts [B1,B4] | gizmo/selection/context; real-time propagation and RIR monitoring UNKNOWN in this review [B3–B5] | Higher; modes and the hovered editor add shortcut semantics | Task Workspaces, searchable properties, precise input＋direct manipulation | A complete mesh Edit Mode is unnecessary; Tab must not globally take over focus navigation |
| Sound Particles | track/automation, playback, manual/auto render; different versions kept separate [S1,S2] | Time Editor, solo/mute, virtual mic, binaural monitoring; air delay/attenuation/Doppler settings [S1] | Moderate to high; audio authors can readily understand the timeline, while beginners need to understand mic and monitor | Source motion timeline, contextual Inspector, independent monitoring | Controls for creating large particle groups should not dominate the default view of a simple single-ball experiment |
| Treble | model setup→run→result→auralize; estimates differ from formal runs [T1] | Selected reflection's time, order, distance, direction, band/weighting/filter; comparison of dry sound and IR sound [T2,T3] | Moderate to high; setup and versioned results are clear, but there are many scientific parameters | source/receiver, run provenance, synchronized 3D/charts/Inspector | An offline cloud run does not equal every FPS tick; an RT estimate is not a formal measurement |
| Wwise | runtime capture/profiling; exact transport switching UNKNOWN [W1] | listener, attenuation cone/radius, room/portal, image source, reflection paths; requires appropriate Reflect/Spatial Audio configuration [W2–W4] | High; RTPC, buses, and runtime integration require background knowledge | filters, Follow listener, shared context for events/positions/parameters | Do not make complete game routing the beginner entry point; Wwise path capabilities do not establish that Steam Audio offers the same |
| FMOD | local audition/live update; Profiler Waveform plays recordings, Simulate replays API calls [F3] | event timeline/parameter, 3D instances, record/profile; a random playlist in Simulate can change the sound [F1–F3] | Moderate to high; multiple event, instance, and bus layers | Clearly distinguish recording playback from recalculation; view sound/parameters/performance together | Complete bank/snapshot authoring is too heavy; API replay does not establish bit-identical output across runs |
| ODEON | setup→job→analysis/auralization; editions/versions differ [O1–O3] | RIR/BRIR, decay, metrics, reflectogram, 3D paths; **3D Billiard is only a geometry check and does not represent absorption or energy decay** [O1–O5] | High; multiple result windows and acoustic terminology | Charts with explicit conditions, linked path selection, versioned jobs | Do not treat geometric rays/billiard animation as energy evidence; expert MDI is not the FPS default |
| Garry's Mod | Spawnmenu Q transfers crosshair control to the cursor; Physgun grab/rotate/freeze [G2,G3] | beam, crosshair, target/mode feedback; acoustic measurements and audio model UNKNOWN [G3] | Low to start, moderate to master; chord/hold still has a cost | Direct manipulation, a single contextual hint, menus explicitly taking input | Hold/chord must have toggle alternatives; beams cannot be acoustic paths; mass spawning/unfreezing all objects harms reproducibility |

<!-- english-original-anchor --> <a id="三個跨產品結論與選擇"></a>
## Three Cross-Product Conclusions and Choices

1. **Selection needs a single context.** Unity/Blender Inspectors, Treble/ODEON reflections, and Wwise runtime objects all provide traceable information contexts. Reflection Lab adopts a typed SelectionRef for object/path/event/IR; Hover and Selection are separate. This is an adopted design, not yet verified through implementation.
2. **Version author settings separately from experiment results.** Treble/ODEON runs/jobs and FMOD captures suggest that the “current screen” is not the only source of truth. Reflection Lab separates Document, Runtime, and Result; changing Workspace does not reset simulation; stale/pending and backend capabilities are shown.
3. **Disclose professional information progressively.** Initially show objects, physics, sources, and playback; expand bands, solver limitations, and path contributions in Analysis/Inspector. FPS interaction borrows the directness of a sandbox while retaining button/numeric/preset-trajectory alternatives.

Alternatives not adopted: making all Blender shortcuts the default (conflicts with browsers/accessibility), treating Unity Play as the only entry to FPS (conflates layout and runtime), and adopting the complete multiwindow interface of an acoustic tool for the first version (increases learning cost). This stage adopts three Workspaces＋orthogonal runtime state; adjust after task testing.

<!-- english-original-anchor --> <a id="emilkowalskiskills授權與適用邊界"></a>
## emilkowalski/skills: License and Applicability Boundaries

The [official LICENSE](https://github.com/emilkowalski/skills/blob/main/LICENSE) was readable: MIT; Copyright (c) 2026 Emil Kowalski. No commit was pinned; SHA **UNKNOWN**. If the software or substantial portions are copied in the future, the corresponding copyright and permission notice must be retained; assets, trademarks, and other repositories must not be presumed licensed together.

[README](https://github.com/emilkowalski/skills) and [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md) are references for interface/animation research. They were not installed or vendored in this review, and their agent instructions were not treated as project work instructions. Applicable principles are direct feedback for frequent actions, animation with a clear purpose, and avoiding short-lived flashy transitions. Their content cannot replace acoustic validation, WCAG review, or physics/audio clocks. Reflection Lab's 4px spacing and dark palette are requirements and local design choices, not claimed requirements of that repository.

<!-- english-original-anchor --> <a id="存取與版本缺口"></a>
## Access and Version Gaps

| Item | Actual access and limitations | Conditions for resolving the gap |
| --- | --- | --- |
| Blender latest | Directly opening multiple pages returned 402; the official search index was readable, so B1–B5 are marked SEARCH_ONLY. 5.2 is the index's version label, not confirmed as the latest product version on the review date | Direct access to the corresponding version's documentation or task verification after installation; do not bypass access restrictions |
| Blender Outliner | Latest page body not obtained; exact latest behavior UNKNOWN; B6 is an older official 2.81 page | Obtain the official Outliner page for the target version |
| Sound Particles manual | Official PDF is 24,631,526 bytes, exceeding the web opening limit; camera keys are available only in the official index, UNVERIFIED | Lawfully read the small number of necessary pages locally; the full document was not downloaded in this review |
| FMOD | The Authoring content at the 2.04 URL has a 2.03 header; Sandbox/Glossary are mostly SEARCH_ONLY | Recheck after pinning the version formally adopted; do not claim that all of 2.04 was verified hands-on |
| Wwise | Direct open of W2 failed, SEARCH_ONLY; edge documentation is mutable and kept separate from 2024.1 references | Pin a version and test with an authorized runtime capture |
| ODEON | O1 camera/material operations are v13; O3 v19 results came from the official search index. Product editions differ | Pin edition/version before hands-on testing; do not combine versions as supporting evidence |
| All products | No task-time, error-rate, or accessibility conformance reports | Local user testing below; documentation research cannot replace interaction testing |

<!-- english-original-anchor --> <a id="官方來源索引"></a>
## Official Source Index

| ID | Source / version | Access |
| --- | --- | --- |
| U1 | [Unity Editor windows reference, 6000.3](https://docs.unity.com/en-us/engine/6000.3/manual/unity-editor/editor-windows-views-reference) | READ |
| U2 | [Unity Scene view navigation, 6000.0](https://docs.unity3d.com/6000.0/Documentation/Manual/SceneViewNavigation.html) | READ |
| U3 | [Unity Inspector reference, 6000.0](https://docs.unity3d.com/6000.0/Documentation/Manual/UsingTheInspector.html) | READ |
| U4 | [Unity Game view, 6000.0](https://docs.unity3d.com/6000.0/Documentation/Manual/GameView.html) | READ |
| U5 | [Unity Positioning GameObjects, 2018.3](https://docs.unity3d.com/cn/2018.3/Manual/PositioningGameObjects.html) | LEGACY_REFERENCE |
| U6 | [Unity Selection API](https://docs.unity3d.com/ja/current/ScriptReference/Selection.html) | READ, current is mutable |
| B1 | [Blender Workspaces, latest](https://docs.blender.org/manual/en/latest/interface/window_system/workspaces.html) | SEARCH_ONLY |
| B2 | [Blender Navigation, 5.2](https://docs.blender.org/manual/en/5.2/editors/3dview/navigate/navigation.html) | SEARCH_ONLY |
| B3 | [Blender Properties Editor, 5.2](https://docs.blender.org/manual/en/5.2/editors/properties_editor.html) | SEARCH_ONLY |
| B4 | [Blender Object Modes](https://docs.blender.org/manual/en/latest/editors/3dview/modes.html) | SEARCH_ONLY |
| B5 | [Blender Viewport Gizmos](https://docs.blender.org/manual/en/latest/editors/3dview/display/gizmo.html) | SEARCH_ONLY |
| B6 | [Blender Outliner, 2.81](https://docs.blender.org/manual/en/2.81/editors/outliner.html) | LEGACY_REFERENCE |
| S1 | [Sound Particles 2 Tutorial — Overview](https://blog.soundparticles.com/sound-particles-2-tutorial-overview) | READ |
| S2 | [Sound Particles Technical Specifications](https://www.soundparticles.com/products/soundparticles/specs/) | READ, includes SP3 |
| S3 | [Sound Particles Reference Manual](https://soundparticles.com/assets/files/support/soundparticles_manual.pdf) | Page body failed to open, limited index |
| T1 | [Treble Quick start guide](https://docs.treble.tech/user-guide/getting-started/quick_start_guide) | READ |
| T2 | [Treble Reflection tracking](https://docs.treble.tech/user-guide/results/reflection_tracking) | READ |
| T3 | [Treble Setting up an auralization](https://docs.treble.tech/user-guide/auralizer/auralizing_your_space) | SEARCH_ONLY |
| W1 | [Wwise Profiling and Troubleshooting, 2024.1.5](https://www.audiokinetic.com/library/2024.1.5_8803/?id=profiling_and_troubleshooting&source=WwiseFundamentalApproach) | READ |
| W2 | [Wwise Game Object 3D Viewer, 2024.1.8](https://www.audiokinetic.com/en/public-library/2024.1.8_8898/?id=game_object_profiler_game_object_3d_viewer&source=Help) | SEARCH_ONLY |
| W3 | [Wwise Rooms and Portals setup](https://www.audiokinetic.com/library/edge/?id=spatial_audio_roomsportals_wwisesetup.html&source=sdk) | READ, edge is mutable |
| W4 | [Wwise Rooms and Portals overview](https://www.audiokinetic.com/en/library/edge/?id=spatial_audio_roomsportals_apioverview.html&source=SDK) | READ, edge is mutable |
| F1 | [FMOD Authoring Events](https://www.fmod.com/docs/2.04/studio/authoring-events.html) | SEARCH_ONLY, inconsistent version header |
| F2 | [FMOD The Sandbox](https://www.fmod.com/docs/2.04/studio/the-sandbox.html) | SEARCH_ONLY |
| F3 | [FMOD Profiling](https://fmod.com/docs/2.04/studio/profiling.html) | READ |
| F4 | [FMOD Glossary — 3D Preview](https://www.fmod.com/docs/2.04/studio/glossary.html) | SEARCH_ONLY |
| O1 | [ODEON Industrial Quick Start Guide v13](https://www.odeon.dk/pdf/QuickStartGuideIndustrial.pdf) | READ, 2015; camera p8, materials p10–11, Billiard p14 |
| O2 | [ODEON Features and Specifications](https://odeon.dk/product/features/) | READ |
| O3 | [ODEON Combined Quick Start Guide v19](https://odeon.dk/download/Version19/QuickStartGuideCombined.pdf) | SEARCH_ONLY |
| O4 | [ODEON Workshop Program and Instructions, 2024](https://odeon.dk/pdf/ODEON_Workshop_program_and_instructions_PostWorkshop.pdf) | SEARCH_ONLY, §5.5–5.6 |
| O5 | [ODEON early reflectogram vs full response](https://odeon.dk/faq/i-use-odeon-to-simulate-the-spatial-sound-field-distribution-at-a-receiver-odeons-reflectogram-in-the-single-point-response-displays-only-the-early-part-what-about-the-rest-of-the-response/) | Official explanation of limitations |
| G1 | [Facepunch — Spawning Props](https://wiki.facepunch.com/gmod/Spawning_Props) | READ |
| G2 | [Facepunch — Opening The Spawnmenu](https://wiki.facepunch.com/gmod/Opening_The_Spawnmenu) | READ |
| G3 | [Facepunch — Using your Physgun](https://wiki.facepunch.com/gmod/Using_your_Physgun) | READ |

<!-- english-original-anchor --> <a id="後續-ux-驗證not-run"></a>
## Follow-Up UX Validation (NOT RUN)

Conduct formative testing with three first-time users＋two audio/3D tool users; this sample is only for identifying interaction problems, not statistical inference. Each person follows [USER_FLOWS.md](USER_FLOWS.md) to complete creation, throwing, FPS Build, reflection selection, Raw/Simulated, and material A/B; record completion rates, number of prompts needed, accidental drops, accidental Resets, and inability to find an exit. Targets are no critical data loss, no focus traps, and no false acoustic evidence; establish a baseline before setting time targets, and do not enter PASS now.
