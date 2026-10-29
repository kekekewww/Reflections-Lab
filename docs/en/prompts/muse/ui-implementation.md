<!-- english-source: {"path":"prompts/muse/ui-implementation.md","sha256":"eeb662e4fae46aa93f8e38413e53eae0fcbf3c2cff0ab8562bd63415743b0d48","translated_at":"2026-10-27T05:42:24.755Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`prompts/muse/ui-implementation.md`](../../../../prompts/muse/ui-implementation.md). Source SHA-256: `eeb662e4fae46aa93f8e38413e53eae0fcbf3c2cff0ab8562bd63415743b0d48`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ui-實作"></a>
# UI Implementation

```json
{{TASK_CONTRACT_JSON}}
```

First read AGENTS.md, docs/05-ux/DESIGN_SYSTEM.md, and its indexed canonical tokens, Component States, and FPS / Build / Motion specifications; then read reflection-lab-design-system and the applicable pinned version of the Emil Skill. Wiki UI pages provide navigation only; do not invent separate tokens or parallel specifications.

Implement only the scope within allowed_files; preserve existing acceptance, protected_files, and user work. Cover required loading / empty / error / disabled / focus states, keyboard operation, and reduced motion. Input arbitration must distinguish editing panels, FPS, and Build; shortcuts must not pass through focused text inputs. If the product shell does not yet exist, work within the task's fixture scope rather than starting full product development yourself.

Report an ImplementationResult, listing separate evidence for typecheck / component tests, real browser visuals, input, audio, and performance. Code review, token contrast calculations, or plausible-looking HTML must not be reported as browser / WCAG / pointer-lock PASS. All unexecuted visual, audio, and measurement checks are NOT RUN.
