<!-- english-source: {"path":"docs/05-ux/COMPONENT_STATES.md","sha256":"f090aae72a749911c658b388552dc9bb3fdcf19d9e981252d4cf2063bd5831e7","translated_at":"2026-10-27T03:39:05Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/05-ux/COMPONENT_STATES.md`](../../05-ux/COMPONENT_STATES.md). Source SHA-256: `f090aae72a749911c658b388552dc9bb3fdcf19d9e981252d4cf2063bd5831e7`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="元件狀態與鍵盤契約"></a>
# Component States and Keyboard Contract

Updated: 2026-10-26. Status: standards established; production UI/interaction tests **NOT RUN**. [COMPONENT_STATES.json](../../05-ux/COMPONENT_STATES.json) is the machine-readable authority; this page explains how to apply it and does not maintain a separate set of values. Data fields and capabilities remain governed by [COMPONENT_SPEC.md](COMPONENT_SPEC.md).

Every component below inherits the seven `Default / Hover / Focus / Active / Disabled / Loading / Error` states and the JSON `commonStates` behavior. These are interaction dimensions that can overlap, rather than a single enum: for example, `Selected + Focus + stale` can coexist, and `Loading` does not automatically clear selection. Do not force non-interactive badges into the Tab order; their metadata disclosures follow the seven states.

| Component | Default | Hover | Focus | Active | Disabled | Loading | Error | Additional states/profile |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ProjectBar | Common | Common | Common | Common | Common | Common | Common | Selected/action |
| SimulationTransport | Common | Common | Common | Common | Common | Common | Common | Paused, Simulating/action |
| SceneExplorer | Common | Common | Common | Common | Common | Common | Common | Selected/selection |
| ObjectLibrary | Common | Common | Common | Common | Common | Common | Common | Selected/selection |
| Viewport | Common | Common | Common | Common | Common | Common | Common | Selected, Paused, Simulating/viewport |
| TransformInspector | Common | Common | Common | Common | Common | Common | Common | Selected/input |
| PhysicsInspector | Common | Common | Common | Common | Common | Common | Common | Selected/input |
| SoundEmitterInspector | Common | Common | Common | Common | Common | Common | Common | Selected/input |
| AcousticSurfaceInspector | Common | Common | Common | Common | Common | Common | Common | Selected/input |
| ListenerInspector | Common | Common | Common | Common | Common | Common | Common | Selected/input |
| FPSHud | Common | Common | Common | Common | Common | Common | Common | Selected, Paused, Simulating/viewport |
| EventTimeline | Common | Common | Common | Common | Common | Common | Common | Selected, Recording, Paused/selection |
| AcousticLayerPanel | Common | Common | Common | Common | Common | Common | Common | Selected/selection |
| PathTable/Inspector | Common | Common | Common | Common | Common | Common | Common | Selected/selection |
| IR/MetricsDock | Common | Common | Common | Common | Common | Common | Common | Selected/selection |
| ComparisonPanel | Common | Common | Common | Common | Common | Common | Common | Selected/selection |
| MonitorStrip | Common | Common | Common | Common | Common | Common | Common | Selected/action |
| AICommandPalette | Common | Common | Common | Common | Common | Common | Common | Selected/input |
| Status/EvidenceBadge | Common | Common | Common | Common | Common | Common | Common | Selected/disclosure |

The JSON expands the exact, inspectable behavior of the common states and the keyboard and active rules of each profile; `node scripts/setup/emil-skills.mjs --standards` checks the seven states, unique IDs, profile/extension references, and component coverage. This check does not prove that the runtime implements them.

Asynchronous read models also have `idle/loading/ready/empty/stale/error/unsupported`. A missing Listener is a recoverable prerequisite; unsupported `individualPaths` is unsupported; only the absence of paths matching the filters is empty; a solver exception is error. Provide a reason for each, without fake zero values or decorative sound rays.

When a Modal opens, first release FPS input, pause safely, and retain held/ghost state; move focus inside, make the background inoperable, and return focus to the trigger on close without automatically relocking. A Popover does not fully trap Tab; Esc closes only the top layer and must not also throw/discard. Dragging provides pointer capture, cancellation, and numeric/button alternatives; retain input and revalidate after disconnection or a command revision mismatch. Undo/Redo distinguishes text editing, Scene transactions, and runtime Replay; details follow the Workspace/Physics specifications.

Every UI review must record: the component, actual screens/keyboard results for the seven states, additional and async states, token differences, error recovery, visual evidence files, browser/OS/zoom, motion/performance results, and items not run. When no screen evidence is available, record only `STATIC REVIEW`; do not enter `VISUAL PASS`.
