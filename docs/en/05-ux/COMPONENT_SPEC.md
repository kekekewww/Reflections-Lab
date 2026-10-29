<!-- english-source: {"path":"docs/05-ux/COMPONENT_SPEC.md","sha256":"d7455c5c298b978b69dbe08e3e21cc953e8c571b10e0d0b6c2d8505a4127db05","translated_at":"2026-10-27T03:45:00Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/05-ux/COMPONENT_SPEC.md`](../../05-ux/COMPONENT_SPEC.md). Source SHA-256: `d7455c5c298b978b69dbe08e3e21cc953e8c571b10e0d0b6c2d8505a4127db05`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="介面元件與資料規格"></a>
# Interface Component and Data Specifications

Review date: 2026-10-26. Status: **Design complete / implementation and component tests NOT RUN**. The following is a draft UI read model and interaction contract; the Domain schema, backend contract, and DSP specifications are the authoritative sources for numerical and capability definitions. Components must not fabricate acoustic data.

<!-- english-original-anchor --> <a id="共通契約"></a>
## Shared Contracts

For the seven interaction states and complete coverage of every component, see [COMPONENT_STATES.md](COMPONENT_STATES.md) and its machine-readable authority, [COMPONENT_STATES.json](../../05-ux/COMPONENT_STATES.json). Read visual values only from [DESIGN_TOKENS.json](../../05-ux/DESIGN_TOKENS.json). Data states do not replace interaction dimensions such as focus/active/disabled.

All asynchronous components support `idle/loading/ready/empty/stale/error/unsupported`; a null value is not 0, and a missing capability is not an error. Every result includes source/listener, scene/material/backend version, run/tick/frame/time, units, model, and provenance. Numeric edits are validated locally first, then by the Domain Command; error text is linked to the field, and the original input is retained. Inspector changes provide pending/committed feedback; one continuous drag produces only one Undo entry.

For the shared `SelectionRef`, see [WORKSPACE_ARCHITECTURE.md](WORKSPACE_ARCHITECTURE.md). Hover, selection, and pinned comparison are independent. A selection update must not silently discard a field being edited; change context only after commit/cancel, or show an appropriate uncommitted state.

<!-- english-original-anchor --> <a id="元件清單"></a>
## Component Inventory

| Component / priority | Inputs and main states | Actions and outputs | Keyboard / accessibility and failure |
| --- | --- | --- | --- |
| **ProjectBar** P0 | project, document dirty, save status, Workspace | Switch Workspace, save, export; no Reset | Explicit labels / focus order; save failure supports Retry |
| **SimulationTransport** P0 | Ready/Running/Paused/Error, runId/tick, pause cause | Run/Pause/Resume/Reset; Capture/record are separate | Do not rely only on a triangle icon; Reset identifies the target revision; disabled actions due to errors have reasons |
| **SceneExplorer** P0 | object tree, selection, filter, lock/visibility | Select, rename, duplicate, delete, reparent (show only with Domain support) | Arrow-key tree pattern, F2 / explicit rename; deletion supports Undo; hidden does not mean disabled/muted |
| **ObjectLibrary** P0 | primitive/preset, source/license, search/filter | Selection creates a draft; Scene or FPS ghost | Keyboard list selection, Enter to select; asset loading/error must not create a partial object |
| **Viewport** P0 | view camera, listener binding, selection, mode, backend layers | raycast/gizmo/orbit/FPS; frame selected | Title and mode; visible enter/exit / alternative without lock; canvas is not the only interaction route |
| **TransformInspector** P0 | author/runtime target, m/deg, revision | position/rotation/scale, grid/alignment | Labels for each axis; direct input without dragging; do not forcibly change a dynamic transform while running |
| **PhysicsInspector** P0 | body mode, mass kg, gravity, friction, restitution, collision profile | Undoable settings; distinguish Fixed/NoGravity/Dynamic clearly | Validate body mode first; unavailable fields have reasons; numeric ranges come from the schema |
| **SoundEmitterInspector** P0 | asset/checksum, loop/gain/directivity, source state | play/stop, loop, source gain; collision profile in a separate section | Distinguish loading/decoded/playing/stopped/blocked; continuous and impact have separate mute controls |
| **AcousticSurfaceInspector** P1 | geometry ID, material/version, bands, provenance | absorption/transmission/scattering, thickness and other capability fields | Tables include frequency/units/definitions; block violations of energy constraints; conversions between backends must be inspectable |
| **ListenerInspector** P0 | position/orientation, follow state, HRTF, monitor | follow FPS / unbind, move to view, monitor | Distinguish observer and listener; do not display HRTF as enabled when it is not provided |
| **FPSHud** P0 | hover, holding/ghost, actual key bindings, physics state | Context hints, distance, fix/build, pause | Use more than color; toggle/button alternatives to chords; see FPS documentation |
| **EventTimeline** P0/P1 | physics/audio events, tick/time, recording gaps | filter, select event, seek replay | Tabular alternative to timeline; dense events aggregate with expansion, without deleting data |
| **AcousticLayerPanel** P1 | capability, result/frame, path filters | Direct/Reflection/Transmission/Occlusion / direction layers | Legend + line style + text; unsupported disabled controls have reasons; displayed count / total count |
| **PathTable/Inspector** P1 | actual path set, SelectionRef | Select, pin frame, copy/export metadata | Linked to 3D; arrow keys / sortable columns; sorting does not change identity |
| **IR/MetricsDock** P1 | IR/BRIR, sample rate, metric validity | time/frequency/band, EDC, metrics, table export | x/y units, definitions, reasons for null values; no decorative curves when unsupported |
| **ComparisonPanel** P1 | A/B snapshots, diff, comparable flags | Linked view, listening, report | Show condition differences; matching plots use the same scale by default; do not hide non-comparability |
| **MonitorStrip** P0/P1 | context, mute, gain, clip, routing Raw/Simulated | Enable listening, Master Mute, monitor gain, reference switch | Persistently reachable in every Workspace; independent of lock; show the reason when blocked |
| **AICommandPalette** P1 | prompt, job state, validated diff, budget | draft/preview/apply/cancel/undo | IME support; do not execute FPS actions across focus boundaries; retain prompt on error |
| **Status/EvidenceBadge** P1 | provenance/validation/capability/freshness | Expand sources, model assumptions, and limitations | Badges include text; no percentage without confidence data |

SceneExplorer visibility refers to rendering; physics enabled, acoustic participating, and emitter muted must be separate fields. Hiding a wall must not silently let sound pass through it. A multi-selection Inspector displays mixed values rather than presenting the first object's value as shared by all. A pinned Inspector has a pin icon and data version so users do not mistake it for the new selection.

<!-- english-original-anchor --> <a id="三類-inspector-範例"></a>
## Examples of Three Inspector Types

```text
Acoustic Wall                         Physical Sphere
名稱／ID／revision                    名稱／ID／revision
Geometry：尺寸 m、surface IDs         Transform：m / deg
Surface Material：ID、version         RigidBody：Dynamic / NoGravity / Fixed
Evidence：Measured/Derived/Tuned/Synthetic  Mass kg / Friction / Restitution
Bands：Hz、absorption 定義             Collision：profile / CCD support
Transmission：定義、厚度、loss         Sound Emitter：asset / loop / source gain
Scattering：模型／係數                 Collision Audio：profile / trigger
Backend mapping／limits               Runtime：velocity、held、blocked（唯讀）

Audio Listener
Transform／Orientation／up-forward convention
跟隨：FPS / 錄製軌跡 / 手動（有明確切換）
Renderer：HRTF / stereo / unavailable
Monitoring：device/context、gain、mute
Observer camera：獨立；[移至目前相機] 為顯式命令
```

Measured/Derived/Tuned/Synthetic are material provenance classes aligned with the project's `dataClass`; Synthetic may also have the text alias "demonstration," but must not be merged with Tuned. Computed/Estimated/Measured describe result provenance; AI-generated Explanation labels explanations only. These badges must not be conflated into "higher or lower confidence."

<!-- english-original-anchor --> <a id="可選取聲學路徑"></a>
## Selectable Acoustic Paths

| Field | Display rules / handling missing values |
| --- | --- |
| identity | `resultId/frameId/pathId` required; stable IDs are produced by the solver, not taken from view indices |
| topology | path type, reflection order, surface IDs in collision order; geometry revision required |
| geometry | polyline vertices, total distance m; observer camera does not affect computation |
| timing | absolute propagation delay ms; relative-to-direct delay ms, with an explicit reference path ID; show separately from DSP/device latency |
| frequency response | band centers Hz, attenuation quantity (amplitude/energy/level), reference; do not merely state "attenuation 0.5" |
| direction | arrival azimuth/elevation deg or vector, with coordinate system; do not infer angles without orientation |
| material contributions | Definition, bands, and source of each surface contribution; if the backend provides no breakdown, display not provided rather than arbitrarily dividing the total equally |
| model | solver/backend/version, scene/material version, direct/reflect/transmit assumptions |
| confidence/limits | Show confidence only with a formal definition; otherwise `not provided` + validation level / model limitation; distinguish sampling noise from model incompleteness |

<!-- english-original-anchor --> <a id="圖層編碼"></a>
### Layer Encoding

Direct uses a solid line; Reflection uses a polyline with nodes and an order label; Transmission uses a dashed line with marks at penetration points. Blocked candidates appear only in debug and are labeled `failed visibility; not sent to audio`. If Scattering provides only aggregate energy, show regions/histograms rather than pretending they are a single definite path. Source pointing arrows and Listener orientation are separate; energy color/width must have a quantity and legend, separate from selection highlight color.

Band switching affects only the currently displayed quantity; line width is not sound-pressure calibration. Collision events use contact markers + timestamps, grouped separately from acoustic rays. Intersecting lines can be selected in a table or by cycling through a candidate list. Large scenes have a display limit and "showing the first N paths"; this does not mean the solver has only N paths. Freeze the frame + pin the selection to keep dynamic path birth/death from switching the object in the Inspector.

<!-- english-original-anchor --> <a id="ir頻譜與指標"></a>
## IR, Spectrum, and Metrics

The IR x axis is time relative to source emission; actual arrival, DSP block, and device output latency are separate. The IR y axis must state amplitude/energy / digital reference; it cannot be labeled dB SPL without calibration. Display EDC, RT60/EDT/T20/T30, DRR, and C50/C80 according to actual solver support and valid fits; explain invalid/unsupported states for limited IR length, insufficient dynamic range, or missing direct separation. Do not fill them with 0 or infer measured values.

Each plot can switch to a table, includes a readable summary, and supports data export; hover tooltips are not the only way to read values. Time/arrival events can be selected with the keyboard. Matching A/B plots use the same axis domain and band by default; log scale/normalization/smoothing have persistent labels. Audio spectrum dBFS, RIR normalized dB, and acoustic solver relative energy must not be overlaid as the same quantity without explaining the conversion.

<!-- english-original-anchor --> <a id="rawsimulated-monitoring-contract"></a>
## Raw/Simulated Monitoring Contract

This is an explicit definition for this product; do not assume that other tools use the same Raw semantics.

| Mode | Routing | Fixed content | Display |
| --- | --- | --- | --- |
| `Raw` | Same dry source/event → monitor gain → output, centered reference; bypass distance, delay, occlusion, material, reflection/reverb, HRTF | event identity, asset/seed/playhead, source gain unchanged | `Dry reference: no environmental/spatial processing` |
| `Simulated` | Same source/event → propagation supported by the backend → spatial renderer → monitor gain → output | Same as above; identify differing output features explicitly | `Simulation: backend/version, enabled features` |

Do not automatically eliminate latency between the two routes merely by adding a "Raw comparison": environmental propagation differences remain by default. If audition alignment is added, display the compensation amount and change only monitoring. Switching crossfades on the audio timeline, with an initial target of 20 ms (a design parameter requiring DSP spike validation), not measured by CSS animation or requestAnimationFrame. Do not restart AudioBufferSource or resample random samples. If the same playhead cannot be maintained, disable real-time switching and provide explicit A/B rendering of the same event instead; do not pretend it is seamless.

Simulation Pause separately uses `Freeze-and-fade` from the Workspace document: freeze the logical source offset, cancel old epoch schedules, and retain pending arrivals; Resume reanchors and deduplicates. Cut-off tails have a marker, and Paused audition uses independent time. Do not misread "switching does not restart the source" as allowing the original experiment source to keep advancing during Pause.

Level match is an optional monitoring aid, off by default; show the gain offset and method, and do not modify raw metrics / scene source gain. Multi-source/impact comparisons bind to the same captured event stream so Raw/Simulated do not play different collisions. Raw does not mean unmuted, and it is not a free-field model. If "direct-only with HRTF retained" is offered later, give it a separate name and routing without changing the Raw definition.

Monitoring is muted by default. After the user clicks enable, the suggested starting gain is -18 dB relative to unity (a product default, not a calibrated safe sound pressure). Master Mute is keyboard-reachable in every Workspace and does not change source/physics/record trace. A clip meter indicates digital clipping only; it cannot estimate headphone dB SPL, and even a limiter cannot be claimed to guarantee hearing safety. Arbitrary assets may contain excessive transients, so clear volume controls, explicit enablement, and avoiding sudden gain increases when switching modes are interface requirements. Without exposure measurements, display "actual SPL/exposure unknown." No playback tests were performed in this review.

<!-- english-original-anchor --> <a id="可及性與高密度互動"></a>
## Accessibility and High-Density Interaction

Prefer native button/input/select/table elements. If custom widgets are used for trees, tabs, dialogs, etc., define focus according to [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) patterns; provide equivalent lists/numeric fields/preset trajectory playback outside Canvas. Dragging has click/numeric-input alternatives; charts and paths offer table selection. `aria-live` announces only important states (paused, creation failed, recording started), not tick/hover/energy every frame.

WCAG 2.2 is a design goal, not conformance verified in this review. AA text/non-text contrast, keyboard exit, visible/not fully obscured focus, dragging alternatives, target size, and audio controls must be checked after implementation; zoom and panel docking must not obscure Master Mute or exit-key hints.

<!-- english-original-anchor --> <a id="整合驗收not-run"></a>
## Integration Acceptance (NOT RUN)

- object/path/event/IR selection is consistent across 3D, tables, and Inspector; deleted/invalid references do not point to another object.
- Unavailable values show reasons instead of 0; error, stale, not calculated, and unsupported are distinguishable.
- Switching the same source between Raw/Simulated does not change tick/seed/source playhead; level matching does not change results.
- Listener follow and observer camera each have explicit states; unsupported HRTF is not shown as enabled.
- Material bands, attenuation definitions, and solver mapping are traceable; debug candidate paths do not enter audio.
- Keyboard-only and non-lock modes support selection, editing, recording preset trajectories, and viewing/exporting results; dialog focus can be exited.

References (reviewed 2026-10-26): [Web Audio API](https://www.w3.org/TR/webaudio-1.0/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WAI-ARIA Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Specific API implementations/compatibility still require validation in the target browsers.
