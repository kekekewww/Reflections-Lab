<!-- english-source: {"path":"docs/10-sound-behaviors/SOUND_BEHAVIOR_RESEARCH.md","sha256":"ac9238bd21da113f6d9c16a23c34634a4ad90cb72efc1bf575e57f0aa7a54054","translated_at":"2026-10-27T03:40:18Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/10-sound-behaviors/SOUND_BEHAVIOR_RESEARCH.md`](../../10-sound-behaviors/SOUND_BEHAVIOR_RESEARCH.md). Source SHA-256: `ac9238bd21da113f6d9c16a23c34634a4ad90cb72efc1bf575e57f0aa7a54054`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior-可行性與成熟工具研究"></a>
# Sound Behavior Feasibility and Mature-Tool Research

Review date: 2026-10-27 (Asia/Taipei). Status: **DOC_REVIEWED/architecture recommendation; neither the four tools nor this project's audio runtime has been verified hands-on**. This document provides a basis for selection. The event specification, schema, propagation, and acceptance are maintained in their respective documents in this directory and in the existing [Audio Runtime](../02-architecture/AUDIO_RUNTIME.md); no second DSP contract is created. See [metadata](../../../research/sound-behaviors/middleware-sources.json) for source versions, access limitations, and rights.

<!-- english-original-anchor --> <a id="結論與可宣稱範圍"></a>
## Conclusion and Permitted Claims

This feature is worth making a formal core feature, positioned around **explainable physics events + free choice of timbre rules + unified acoustic propagation + traceable experiments**, rather than rebuilding a complete audio workstation. This is an engineering judgment based on current requirements and API layering, without user research, performance numbers, or evidence of product completion. Mature tools already provide events, parameters, procedural audio, moving sources, and even natural-language assistants; Reflection Lab cannot claim to have invented any one of these features.

The MVP uses **Event Rules + orthogonal state machines + Inspector**. Held, Moving, Contact, and Sleeping are composable state dimensions and cannot be placed in a single mutually exclusive enumeration; a held ball may still hit a wall. Rules determine “when/what to play/how to map,” DSP determines “how to generate the waveform,” and the Acoustic Core determines “how it propagates to the receiver.” Node Graph remains P2; an audio graph cannot be treated as a physics-contact classifier.

<!-- english-original-anchor --> <a id="四套工具的可借鑑原理"></a>
## Principles to Learn from Four Tools

| Tool/version actually read | Concepts that can be directly learned from | Reflection Lab adoption | Not adopted in this work/limitations |
| --- | --- | --- | --- |
| **FMOD Studio 2.04.00, 2026-09-29** | Event definitions and multiple independent instances; local/global parameters; instruments, parameter conditions, automation, bus routing | Shared versioned Profiles, with independent instances/states held by objects; conditions and curves use allowlisted data without executing user JS | No full banks, mixing desk, or music-transition system; FMOD runtime is not added to the main path |
| **Unreal MetaSounds, official UE5.8 page** | Typed DSP dataflow, trigger/audio-rate pins, Source/Patch/Preset, parameter inputs, sample player/envelope/filters | Small generator interface, reusable presets + overrides, explicit control/audio boundary | UE integration is not this project's Web SDK; sample-accurate audio triggers do not turn Rapier fixed-step events into sample-accurate physics measurements |
| **Wwise, official public headers v2017.2.0 build6500** | Event/Playing ID, object/global RTPC, Switch/State, separate spatial/monitor layers | Traceable event→rule→instance→emitter→voice decision chain; material categories separated from continuous parameters | Current help returned 403 when opened directly; only explicitly older APIs support the design principles. No claim that the 2026 SDK, Web support, or distribution license has been verified |
| **Sound Particles 2 tutorial/3 ADM tutorial** | Sources and virtual microphones, movement/audio modifiers, automation timeline, ADM object budgeting | Source position separated from waveform; inspectable trajectory/event timeline; an explicit priority policy for overload | No large particle workstation, ADM delivery, or plug-in host; SP2 and SP3 features cannot be combined into one version; product specification pages returned only a JavaScript shell in this review |

<!-- english-original-anchor --> <a id="fmod事件實例參數與觀測分開"></a>
### FMOD: Separate Events, Instances, Parameters, and Observation

An Event can be shared, while its playing instances have different local parameters and 3D positions; instruments generate content, then route through tracks/master. Parameters can control properties through curves or constrain trigger conditions, making “velocity maps to gain, material pairs select timbre” useful principles to adopt. This project must still add fixed-step deduplication and replay identity itself. [Authoring Events](https://www.fmod.com/docs/2.04/studio/authoring-events.html), [Parameters](https://www.fmod.com/docs/2.04/studio/parameters.html)

Profiler separates recording playback from recomputation of API calls; a random playlist in simulate may change the result. Reflection Lab should therefore retain the selected variant/seed, actual playback parameters, and trace. Resending APIs cannot prove identical sound or identical physics motion. [Profiling](https://www.fmod.com/docs/2.04/studio/profiling.html)

The official 2.04 page bodies and version footnotes were readable in this review, improving on the SEARCH_ONLY/version-inconsistency limits of the earlier [UX survey](../05-ux/COMPETITIVE_UX_RESEARCH.md); that earlier review history is not rewritten. HTML5 documentation does provide WASM/Web Audio support, but lists limitations such as geometry and browser-runtime Live Update/Profiling, as well as callback/thread conditions; this does not establish that it can directly replace the Custom Acoustic Core. The licensing page separately distinguishes game and non-game projects; free downloads or particular Indie conditions cannot establish that this project has distribution rights. [HTML5](https://www.fmod.com/docs/2.04/api/platforms-html5.html), [Licensing](https://www.fmod.com/licensing)

<!-- english-original-anchor --> <a id="metasoundsdsp-圖不等於遊戲狀態機"></a>
### MetaSounds: A DSP Graph Is Not a Game State Machine

A MetaSound is audio dataflow, not a Blueprint execution graph. Source generates sound, Patch reuses fragments, and Preset inherits a graph while overriding inputs; this offers a useful model for Profile/instance separation. A Trigger can express sample positions within an audio block, but may produce block-rate results when connected to a non-audio-rate node. Reflection Lab should retain the distinction between physics-tick precision and audio-scheduling precision. [Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine), [Reference Guide](https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-reference-guide-in-unreal-engine)

Wave Player, seeded variants, envelopes, filters, and typed trigger nodes provide useful generation principles; this does not mean adopting their C++ or UI assets. A fixed seed constrains only the corresponding random sequence and cannot establish bit-for-bit identical full physics replay across platforms. UE licensing has separate product conditions; the engine was not adopted and no standalone Web SDK was verified in this work. [Function Nodes](https://dev.epicgames.com/documentation/en-us/unreal-engine/metasound-function-nodes-reference-guide-in-unreal-engine), [UE Licensing](https://www.unrealengine.com/license)

<!-- english-original-anchor --> <a id="wwisescope-與實例識別比全域布林值重要"></a>
### Wwise: Scope and Instance Identity Matter More Than Global Booleans

The older public header directly verifies `PostEvent`/Playing ID, RTPC global/object scope, and interpolation parameters; Switch specifies a game object whereas State does not. This supports a layered design for object-level material classification, continuous values, and shared environment state. [AkSoundEngine.h](https://raw.githubusercontent.com/audiokinetic/WwiseIncludes/master/SDK/include/AK/SoundEngine/Common/AkSoundEngine.h)

The Spatial header separates emitter positions, rooms/portals, and reflection processing; Monitor links errors through playing/object/node IDs. This is useful for event tracing, but queries may wait on an audio lock and cannot simply be copied into synchronous audio-callback queries. These are **historical API evidence from 2017.2**, not current SDK tests; a public header also does not mean that the full engine, authoring UI, or assets may be freely embedded. [AkSpatialAudio.h](https://raw.githubusercontent.com/audiokinetic/WwiseIncludes/master/SDK/include/AK/SpatialAudio/Common/AkSpatialAudio.h), [AkQueryParameters.h](https://raw.githubusercontent.com/audiokinetic/WwiseIncludes/master/SDK/include/AK/SoundEngine/Common/AkQueryParameters.h), [AkMonitorError.h](https://raw.githubusercontent.com/audiokinetic/WwiseIncludes/master/SDK/include/AK/Tools/Common/AkMonitorError.h), [official repository](https://github.com/audiokinetic/WwiseIncludes)

<!-- english-original-anchor --> <a id="sound-particles運動-metadata音色與輸出格式不同"></a>
### Sound Particles: Motion Metadata, Timbre, and Output Formats Differ

The official SP2 tutorial directly exposes particle tracks, virtual microphones, movement/audio modifiers, timeline, and Inspector. It separates motion sources from changes in sound, compatible with this project's three layers of actual physics transforms, user timbre, and acoustic processing. Its particle-motion design cannot, however, replace this project's Rapier contact solving. [SP2 Overview](https://blog.soundparticles.com/sound-particles-2-tutorial-overview)

The official SP3 ADM tutorial describes position/trajectory metadata, object/bed categories, object-count limits, and sharing. This informs voice/emitter separation and timeline design in this project, without implying that the project should implement ADM. The older SP2 FAQ did not support object export; it cannot be used to deny SP3's ADM capability. Direct reads of the product/spec/trial pages returned only JS shells in this review, so search snippets are not used to infer versions, capacity, or usage rights. [SP3 ADM Tutorial](https://blog.soundparticles.com/how-to-export-adm-files-with-sound-particles-3)

<!-- english-original-anchor --> <a id="重用-api-與必須自製的界線"></a>
## Boundaries Between Reusing APIs and Building Our Own

| Layer | Reuse | Still to build/verify in this project |
| --- | --- | --- |
| Audio primitives | Web Audio sample/loop, Oscillator, Gain, Biquad, AudioParam automation; add AudioWorklet only when needed | Asset preloading/licensing registry, persistent continuous instances, one-shot lifecycles, voice admission/steal and telemetry |
| Physics | Rapier collision/contact/velocity data | Canonical pair/episode, contact aggregation, explicit Grab/Throw, deduplication/hysteresis, and event versions |
| Behavior | Fixed curve interpolation and enumerated condition data | Profile/Rule revisions, bounded allowlists, override rules, cooldown scope, stable IDs, and atomic Undo/Redo |
| Propagation | Web Audio as rendering primitives; retain the original Acoustic Core contract | Source/contact positions, solver capabilities, sole responsibility for delay/gain/HRTF, stale frames, and computation budgets |
| Recording/replay/AI | Existing fixed-step trace and validated tool envelope | Audio event/variant/instance/asset-hash recording, A/B across revisions; Muse only proposes legal operations and does not generate numerical results or arbitrary code |

The Web Audio standard provides scheduling and automation, but `AudioBufferSourceNode.start()` cannot be called a second time. Reuse decoded buffers and the instance manager; retain the running node for a continuous loop and create a new source node for each new one-shot. “Pooling” cannot mean that a stopped source can be restarted. This is a specification capability, not evidence that this project's browser/click-pop acceptance has passed. To avoid calling a changing draft an established standard, basic APIs cite the fixed 2021 Recommendation. Currently `/TR/webaudio/` redirects to the 1.1 Working Draft; its existence is not used to infer full browser support. [Web Audio REC §§1.6, 1.9](https://www.w3.org/TR/2021/REC-webaudio-20210617/)

<!-- english-original-anchor --> <a id="聲音創作與科學主張"></a>
## Sound Creation and Scientific Claims

If a Physical Preset merely selects samples by material or adjusts EQ, it should be labeled physical-inspired/perceptual approximation; it does not simulate an object's vibration. A Creative Preset may use sounds such as piano or synthesizer. Hybrid can layer both, but must still retain the correct source point and the same propagation contract for each instance. Layers at different locations cannot first be mixed into one signal at the object center, which would lose the contact position.

Material pairs can select timbre, but cannot thereby overwrite the Measured/Derived/Tuned/Synthetic labels of acoustic materials; changing a sample does not change wall absorption. No Gravity does not mean vacuum; the absence of airborne sound transmission in a vacuum does not eliminate mechanical collisions. These boundaries follow [DSP Models](../research/theory/DSP_MODELS.md) and [Audio Runtime](../02-architecture/AUDIO_RUNTIME.md).

A competition demonstration could focus on changing a default impact into a creative scale using the same real motion/contact trace, inspecting the trigger/rule/asset/source position, then comparing acoustic results with sources; product Muse creates settings through validated tools while retaining preview/undo. This is a demonstration recommendation, not an implemented feature or a certification of novelty/compliance. P0 first covers Audio Event Runtime, bounded rules, and Inspector; Rolling/Sliding, material pairs, and timeline move to P1 as prerequisite acceptance permits; full Graph, modal synthesis, plug-in hosting, and large-scale particle creation remain P2.

<!-- english-original-anchor --> <a id="驗證與未解限制"></a>
## Validation and Unresolved Limits

| Claim ID | Important claim/conditions | Evidence status |
| --- | --- | --- |
| SB-MW-C01 | Event definitions, playing instances, and local parameters are separate; FMOD2.04 | DOC_REVIEWED, SB-MW-FMOD-EVENTS/PARAMETERS |
| SB-MW-C02 | FMOD HTML5 has platform limitations and does not equal a complete Web acoustics replacement for this project | DOC_REVIEWED + engineering inference, SB-MW-FMOD-HTML5 |
| SB-MW-C03 | MetaSounds audio sample timing does not increase the observation precision of physics events | DOC_REVIEWED + engineering inference across clocks, SB-MW-UE-REFERENCE; not this project's DSP test |
| SB-MW-C04 | Wwise object/global parameters and Playing ID can inform layering | PRIMARY_SOURCE_READ_LEGACY, SB-MW-WWISE-ENGINE; limited to the public 2017.2 header |
| SB-MW-C05 | SP2 and SP3 object-export capabilities cannot be conflated | DOC_REVIEWED, SB-MW-SP2-OVERVIEW/SP3-ADM; software unverified |
| SB-MW-C06 | AudioBufferSourceNode cannot start a second time; decoded buffers and stopped sources are different kinds of pooled resources | SPEC_REVIEWED, SB-MW-WEBAUDIO-REC2021; browser testing NOT RUN |
| SB-MW-C07 | P0 uses Event Rules + orthogonal state machines/Inspector; Graph remains P2 | ENGINEERING_INFERENCE, based on this project's prerequisite gaps and the comparison above; not research establishing universal superiority |

This document passes primary-source reading and version/access classification; **FMOD, Unreal, Wwise, and Sound Particles were not installed or run; their latency/voices/memory were not measured, and no commercial assets were downloaded**. Web API specifications do not mean that this project's AudioWorklet, HRTF, device output, listening tests, or spatial propagation have been verified. The root integration report should separately list actual schema/isolated-spike results and NOT RUN items, without treating this comparison table as a benchmark.

The largest prerequisite work remains a functioning Scene/Physics host and Audio Event Runtime, not a Graph Editor. Reproducible events, uninterrupted continuous playback, and the same acoustic routing must be in place before authoring experience and device performance can be evaluated. Performance numbers follow existing formal budgets and measurement procedures; vendor marketing capacity cannot be transplanted into a promise for this project.
