<!-- english-source: {"path":"server/META_LIVE_VALIDATION.md","sha256":"680c3ab9936707d555912958e733591601279de50b25d0e6debaab430718d860","translated_at":"2026-10-27T03:41:26.493711Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`server/META_LIVE_VALIDATION.md`](../../../server/META_LIVE_VALIDATION.md). Source SHA-256: `680c3ab9936707d555912958e733591601279de50b25d0e6debaab430718d860`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="meta-live-驗證操作與限制"></a>
# Meta Live Validation Operations and Limits

The shared authorization for this run is **US$1, with at most three paid requests**, reserving US$0.25 for each request; all three slots have been used. Restarting must not reset the ledger. Do not delete, rename, or change its path to establish a new budget, or raise the limit. The normal product server still defaults to network disabled and budget 0.

<!-- english-original-anchor --> <a id="已驗結果"></a>
## Validated Results

`research/v1/meta-live-validation-20261027-r3-minimal/summary.json` is `SOUND_PASSED_SCENE_NOT_RUN`: real `/api/agent/propose-sound` → Meta function call → local original schema/domain validation → trusted Host Apply → local 60 Hz, 3 seconds, 180 ticks/181 frames → Capture/Analyze artifacts. `meta-behavior-trace.json` preserves evidence that the model-configured pitch override 2 actually appeared in the collision start event.

The run used `muse-spark-1.3` Standard, `max_completion_tokens:1000`, `reasoning_effort:"minimal"`, and zero retries. The successful response ID is `chatcmpl-01a17b26-9b01-76e4-994a-504ee9d735cd`; usage is input 4968, completion 262 (including reasoning 83), and cached input 0. Based on verified official rates, **this successful request** is estimated at US$0.0073235; usage/billing for the two earlier HTTP 400 requests is unknown, so this value must not be described as the total bill for this run. Actual billing and remaining credit are both null.

Scene live, model RunSimulation, browser, hardware audio, listening tests, and physical measurements have not been accepted on the basis of this evidence. RunSimulation was explicitly performed by the local Host; it must not be described as model execution or hardware sound evidence.

<!-- english-original-anchor --> <a id="唯讀查狀態"></a>
## Read-Only Status Inspection

Run the following command in PowerShell from the project root. It only reads the fixed ledger; it does not load a key, start a server, send network requests, or modify files:

```powershell
@'
import {readFile} from "node:fs/promises";
const d=JSON.parse(await readFile("research/v1/meta-live-budget-20261027.json","utf8"));
console.log(JSON.stringify({
  status:d.attempts.length>=d.policy.maxPaidRequests?"BLOCKED":"INSPECT_LEDGER",
  reason:d.attempts.length>=d.policy.maxPaidRequests?"REQUEST_LIMIT_REACHED":null,
  budgetUsd:d.policy.budgetUsd,paidRequests:d.attempts.length,maxPaidRequests:d.policy.maxPaidRequests,
  reservedUsd:d.attempts.reduce((n,a)=>n+a.reservedUsd,0),
  remainingRequestSlots:d.policy.maxPaidRequests-d.attempts.length,
  actualBillingCostUsd:d.actualBillingCostUsd,remainingCreditUsd:d.remainingCreditUsd,inferenceRequests:0
},null,2));
'@ | node --input-type=module
```

It should currently show `BLOCKED`, `REQUEST_LIMIT_REACHED`, paidRequests 3, reservedUsd 0.75, and remainingRequestSlots 0. This validates ledger status; it is not an account balance API.

<!-- english-original-anchor --> <a id="已執行的驗證命令"></a>
## Validation Command Already Executed

The operational form is retained below for traceability; replace `<server-only-key-file>` with the user-specified, ignored local file. **The slots for this run are exhausted; do not run further inference.**

```powershell
node --import tsx server/meta-live-validation-cli.ts --key-file "<server-only-key-file>" --approved-total-usd 1 --output-dir "research/v1/meta-live-validation-20261027-r3-minimal"
```

The CLI uses the fixed original ledger `research/v1/meta-live-budget-20261027.json`, with no reset, budget override, or ledger-path argument. Reusing the same output-dir fails locally because overwriting is forbidden; with a new directory, 0 remaining slots causes all proposals to be skipped, so a fourth request cannot be sent. For operations, use the read-only status command above and retain the existing evidence directories.

The server-only key loader accepts an explicit `--key-file` or `META_API_KEY_FILE`; the file may contain only one quoted `MODEL_API_KEY`/`META_API_KEY`/`META_MODEL_API_KEY` assignment. The key stays only in server memory and serves as the Authorization header for the fixed official endpoint; it must not enter the browser, prompt, artifact, Git, log, or test fixture. The loader's fake fixtures do not read the user's key.

<!-- english-original-anchor --> <a id="失敗與來源紀錄"></a>
## Failures and Provenance Records

- `meta-live-validation-20261027/`: the first Sound request returned HTTP 400. The old wrapper did not save the error body, so the exact cause cannot be traced; the original receipt and US$0.25 reservation remain.
- `meta-live-validation-20261027-r2/`: the Scene HTTP 400 explicitly stated that the remote service does not support `uniqueItems`; `transport-1.json` saves only four sanitized, bounded diagnostic fields and safe IDs.
- The original two attempts are preserved in full; two `meta-live-http400-reconciliation-20261027*.json` files record explicitly authorized append-only reconciliation. Each new 400 blocks independently; this is not a quota determination and does not refund or remove a reservation.
- The provider wire removes only `uniqueItems`, which is confirmed unsupported. Local original AJV, domain ID/revision/pin, and uniqueness validation remain; the original 12 Scene enum values and 5 Sound operations are unchanged.
- The final complete body, bytes/SHA, official parameter checks, proof of minimal differences, and independent review are in `research/v1/meta-live-payload-preview-20261027-r3-minimal/`. The body contains only fixed synthetic defaults/oscillator/prompt; actual dispatch must match the reviewed body fingerprint exactly.
- The two older requests retain their exact payloads and receipt/ledger fingerprints, but **do not have a complete source-code snapshot for each request**; do not claim that all code bytes for each run can be reconstructed. The existing source is the repaired version; no nonexistent commit has been used to fabricate proof.

Official sources: [tool contracts](https://dev.meta.ai/docs/tool-calling), [strict schema rules](https://dev.meta.ai/docs/structured-output), [Chat parameters and reasoning_effort](https://dev.meta.ai/docs/protocols/chat-completions), [current rates](https://dev.meta.ai/docs/pricing-rate-limits). The public schema documentation does not individually list support for every bound/pattern; the actual 400 is direct evidence of the `uniqueItems` incompatibility.

Final offline regression: provider 23, Sound 16, ledger 17, diagnostic 2, product API/local runtime fake 5, totaling **63/63 PASS**; global TypeScript and scoped ESLint/Prettier PASS. These fake-model tests are stored separately from the real live artifacts.
