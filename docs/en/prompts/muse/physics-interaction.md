<!-- english-source: {"path":"prompts/muse/physics-interaction.md","sha256":"cf202a0227de15bede115850a63894c7d463471d209ccb7e7358ddd74bfc8b17","translated_at":"2026-10-27T05:42:24.755Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`prompts/muse/physics-interaction.md`](../../../../prompts/muse/physics-interaction.md). Source SHA-256: `cf202a0227de15bede115850a63894c7d463471d209ccb7e7358ddd74bfc8b17`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="物理互動實作"></a>
# Physics Interaction Implementation

```json
{{TASK_CONTRACT_JSON}}
```

First read AGENTS.md, the physics-interaction Skill, effective FPS / Build / Listener specifications, and the task's relevant_files. Use a fixed physics step and render interpolation; keep stable domain IDs separate from Rapier handles. gravity=0 is still dynamic, fixed bodies are unaffected by forces, and kinematic bodies follow explicit commands; serialized Scenes do not include runtime engine objects.

Retain contact solving and finite impulse while grabbing; do not parent objects to the camera or simulate throwing by teleporting through walls. Mode changes must handle grab / joint, velocity policy, wake, and listener discontinuity. When exiting FollowPlayer, restore the saved ScenePinned according to the effective decision; do not overwrite resolved decisions with old summaries.

Modify only allowed_files, preserving protected acceptance and existing changes. Report an ImplementationResult with separate evidence for pure mathematical fixtures, Rapier WASM, browser input / pointer lock, collision audio, and performance. Write NOT RUN for any level not executed; continue completed checkpoints after checking them, without rebuilding the entire scene.
