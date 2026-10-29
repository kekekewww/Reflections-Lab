<!-- english-source: {"sha256":"ebe2575340118610d28dbcc6b55f33ef84ed55160deb44a275b4572b8079b076","path":"benchmarks/muse/README.md","links":"english-relative","executor":"Codex","model_id":null,"translated_at":"2026-10-27T03:38:13.4867952Z"} -->
<!-- english-notice:start -->
> English translation of [`benchmarks/muse/README.md`](../../../../benchmarks/muse/README.md). Source SHA-256: `ebe2575340118610d28dbcc6b55f33ef84ed55160deb44a275b4572b8079b076`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="muse-prompt-評測基礎"></a>
# Muse Prompt Evaluation Foundation

This is an offline validator using trusted, handwritten fixtures. It does not call Muse or the Meta API, and it does not measure any model's quality, latency, tokens, or cost.

```powershell
node --test benchmarks/muse/evaluate.test.mjs
node benchmarks/muse/evaluate.mjs
```

The second command creates a separately timestamped `results/offline-*.json`, preserving earlier records through exclusive create. Results include the actual prompts, bytes/hashes, source-code hashes, individual tests, and negative controls. All unobserved values in `model_metrics` are `null`, and LIVE EVAL is NOT RUN. Successfully rerunning the fixtures does not prove that Strategy A or B is better.

| Fixture | Parsing / independent acceptance | Limits |
| --- | --- | --- |
| TypeScript component | Normal, loading, disabled, string escaping | A plain TypeScript HTML-string component; not React, DOM, accessibility, or browser E2E validation |
| Physics impulse | Mass times change in velocity, 3-4-5 finite impulse, invalid parameters | Contract mathematics; not Rapier solver / grab / collision runtime |
| Acoustic floor reflection | Image-source floor intersection, path length, delay, invalid geometry | A two-dimensional analytical fixture; not the production acoustic core, RIR, or hearing tests |
| Bug fix smoothing | Existing interpolation, upper/lower-bound regression, nonfinite input | An isolated function; not AudioWorklet continuity validation |

Each category has two prompts: A (direct instructions) and B (structured scope / constraints / acceptance). Both the correct examples and intentionally incorrect examples in `fixtures.mjs` are written directly from human-defined specifications; `acceptance.mjs` judges them using independent constants / analytical values, without using the functions under test to generate expected values.

Strategy B is a prompt specification for evaluation, not an execution contract that can be passed directly to `schemas/agents/task.schema.json` or the Harness CLI. These controls are also not production product algorithms; when numerical intermediate results exceed JavaScript's representable range, they explicitly throw `numeric range exceeded`. They do not claim to produce finite solutions for all finite inputs.

The validator uses the existing TypeScript `transpileModule`; transpilation diagnostics are not a complete typecheck. `node:vm` only makes these fixed, trusted controls convenient to execute; it is **not a secure sandbox**. The CLI does not accept external code or model output; untrusted model code should be validated through the Development Harness's isolated executor, file scope, and acceptance protection.

Before a formal model comparison, freeze the original task / acceptance hashes, model ID / CLI version, context, reasoning profile, budget, and randomness conditions, then have the Harness execute the same variants. Retain original logs and repair counts; when usage fields are absent, do not fabricate token or cost estimates. The model-call budget remains 0; this directory does not create accounts, switch accounts, or raise spending limits.
