<!-- english-source: {"path":"prompts/README.md","sha256":"265c988c3e54ec14fcc7ad48e1ad3d231e65601789951980d5d08bee9fa0e624","translated_at":"2026-10-27T05:43:19.473Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`prompts/README.md`](../../../prompts/README.md). Source SHA-256: `265c988c3e54ec14fcc7ad48e1ad3d231e65601789951980d5d08bee9fa0e624`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="agent-prompt-templates"></a>
# Agent Prompt Templates

Development and product runtime use different tools, state, and resource budgets. Development templates are rendered from the frozen Task Contract and run state; a trusted host separately provides restricted scene / tool / evidence context for product templates. Text rules cannot replace the Harness's scope / lock / acceptance checks or the product host's domain / policy validation.

| Template                  | When to use                                |
| ------------------------- | ------------------------------------------ |
| muse/implementation       | General feature and multi-file implementation. |
| muse/bugfix               | Reproducible defects and regression.        |
| muse/ui-implementation    | UI implementation following the canonical design system. |
| muse/acoustic-solver      | Acoustic geometry / energy / propagation and numerical validation. |
| muse/physics-interaction  | Rapier / FPS / Grab / Build interaction.    |
| muse/repair               | Bounded repair after external verification fails. |
| muse/handoff              | Preserve remaining work and provenance after a safe stop. |
| muse/codex-fallback       | Codex takes over the remaining implementation of the same Task. |
| runtime/scene-planner     | In-product scene staging / preview proposals. |
| runtime/experiment-agent  | In-product run / capture / analyze / compare experiments. |
| runtime/acoustic-analysis | Interpret results by citing actual metric artifacts. |

`render.mjs` exports synchronous `renderTemplate(name, values)` and fixed `TEMPLATE_NAMES`. name can only be one of the 11 values listed above; arbitrary paths are not allowed. The four JSON parameters are `TASK_CONTRACT_JSON`, `RUN_STATE_JSON`, `REPAIR_TASK_JSON`, and `HANDOFF_JSON`; pass an object or a serialized JSON object. Rendering fails if a parameter required by the template is missing. Each input is limited to 256KiB; tokens / instructions inside data are not executed.

```javascript
import { renderTemplate } from "./prompts/render.mjs";
const prompt = renderTemplate("muse/implementation", {
  TASK_CONTRACT_JSON: contract,
});
```

This is the calling interface; `contract` must come from a validated actual Task. It is not a complete task that can be executed directly. Reproducible tests:

```powershell
node --test prompts/render.test.mjs
node --test benchmarks/muse/evaluate.test.mjs
node benchmarks/muse/evaluate.mjs
```

The last item only executes fixed trusted fixtures, with no modelcalls. Model prompt quality and live integration still require separate execution and an explicit budget; they cannot be inferred from passing templates or fixtures.
