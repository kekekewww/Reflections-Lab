<!-- english-source: {"path":"experiments/dependency-smoke/README.md","sha256":"d0b0d878454effbfcfe5e34b31ad888e1ac97e0bb793b75d9a5f2e1f73ea7adf","translated_at":"2026-10-27T03:38:48.950111Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`experiments/dependency-smoke/README.md`](../../../../experiments/dependency-smoke/README.md). Source SHA-256: `d0b0d878454effbfcfe5e34b31ad888e1ac97e0bb793b75d9a5f2e1f73ea7adf`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="依賴與環境驗證的範圍"></a>
# Scope of Dependency and Environment Validation

This directory belongs to Reflection Lab's research preparation. Isolated tests of dependency loading, geometry mathematics, and physics packages establish only that the specified version can complete that check in the recorded execution environment; they do not mean that the production product, browser rendering, audio output, or real-time performance is complete.

<!-- english-original-anchor --> <a id="可重現環境"></a>
## Reproducible Environment

The root `package.json` and `package-lock.json` are the authority for Node dependency versions. Use `npm ci` to install the locked dependencies, then run the validation commands defined at the root. The baseline environment is Node.js 22.17.0, npm 11.4.2, and Python 3.12.11.

```powershell
node scripts/setup/environment.mjs --strict
node scripts/setup/environment.mjs --strict --output benchmarks/results/environment.local.json
```

The environment script uses only Node built-in modules and outputs actual tool versions, operating system, CPU architecture, CPU model, logical processor count, total memory, and UTC review time; it does not record environment-variable contents or credentials. `--strict` returns status code 1 when a required Node.js or npm version does not match or is missing; Python is reported but is optional, so it does not affect whether this mode passes. Invalid arguments or an output write failure return status code 2. Without `--strict`, version differences appear only in the JSON report.

The memory and time in a report are a snapshot of that execution environment; runs will not produce identical files. Save the report alongside test results so that measurement differences between machines can be interpreted.

<!-- english-original-anchor --> <a id="物理執行驗證"></a>
## Physics Execution Validation

Isolated scripts in `experiments/physics-spike/` are responsible for actual Rapier execution validation; refer to that directory's documentation for the version and exact execution method. This directory does not repeat claims about physics test results; fixed-timestep numerical results on one machine also cannot directly establish that cross-platform bitwise identity, first-person interaction, grabbing stability, or collision audio has passed.

Expected values, reference formulas, and tolerances for mathematical fixtures should be recorded in the test data and `docs/06-validation/`. Passing analytical tests validates the specified model; independent solver comparisons, DSP validation, and actual measurements are still needed to support higher-level claims of acoustic correctness.
