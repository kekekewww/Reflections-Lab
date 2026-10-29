<!-- english-source: {"path":"docs/03-sdk/V1_WEB_TOOLCHAIN.md","sha256":"cfe312a73c49d7f175fa89ba7083162ef692aa94d7beb0524019f96ccca45ae4","translated_at":"2026-10-27T23:18:41Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/03-sdk/V1_WEB_TOOLCHAIN.md`](../../03-sdk/V1_WEB_TOOLCHAIN.md). Source SHA-256: `cfe312a73c49d7f175fa89ba7083162ef692aa94d7beb0524019f96ccca45ae4`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->


<!-- english-original-anchor --> <a id="第一版-web-工具鏈與驗證命令"></a>
# V1 Web Toolchain and Validation Commands

Reviewed on 2026-10-27. Actual versions are pinned by the root `package.json`, `package-lock.json`, and [V1 Dependency Inventory r2](../../01-compliance/V1_DEPENDENCY_LICENSE_INVENTORY-r2.json); the old SDK / Phase 2 inventories are historical evidence and cannot serve as the installation results for this work.

Node **22.17.0**, npm **11.4.2**. React / React DOM **19.3.1**, R3F **9.8.2**, Three **0.186.1**, Rapier **0.21.0**, Vite **8.3.5**, React plugin **6.1.2**, TypeScript **5.9.3**, tsx **4.23.15**, Playwright Test **1.64.1**, typescript-eslint **8.72.1**. See the inventory for other direct and transitive versions, npm integrity, license files, and NOTICE hashes; a separate copy is not maintained in the Wiki.

The [official R3F documentation](https://r3f.docs.pmnd.rs/getting-started/introduction) states that R3F 9 pairs with React 19; the Node minimum in the [official Vite guide](https://vite.dev/guide/) covers 22.17.0. This is a compatibility check of documentation and local metadata; it does not replace the production build / browser acceptance checks.

<!-- english-original-anchor --> <a id="本機操作"></a>
## Local Operation

```powershell
npm ci
npm ci --prefix experiments/physics-spike --ignore-scripts
npm run check
npm run dev
```

`npm ci` replaces `node_modules`; while multiple agents are working, first stop processes that share the dependencies, then have a single operator run it. Do not reinstall in parallel while other test / dev processes are using the dependencies. The commands above are a reconstruction procedure and do not mean a clean installation was run in this work; actual execution results are recorded separately in validation artifacts with timestamps and hashes.

`dev` starts local Vite and the API server together; `dev:web` and `dev:api` can start them separately. The API is loaded directly with `node --import tsx server/cli.ts` to reduce extra child processes from CLI wrappers. Only localhost is used; starting the services does not enable paid Meta models.

<!-- english-original-anchor --> <a id="各命令的證據範圍"></a>
## Evidence Scope of Each Command

Dev dependency discovery explicitly uses `optimizeDeps.entries: ["index.html"]` to avoid treating browser profile / extension HTML in ignored directories as application entries. The Physics dev configuration shares only the main configuration's deny rules for private text files, retaining its independent port / HMR / original six includes without inheriting the API proxy; persistence inherits the main configuration through the existing merge. Physics's `physics-vite-cache-v2` isolates the previously failed cache; the old cache was not deleted, and the root cause of EPERM has not been established. See [Vite entries](https://vite.dev/config/dep-optimization-options#optimizedeps-entries) for the basis.

Use `node --test --test-concurrency=1 --test-timeout=50000 tests/integration/vite-dev-policy.test.mjs` to reproduce the real Vite optimizer / HTTP regression; all fixtures are fake files, and no actual key is read. Pre-fix RED, post-fix 26 PASS, and the current browser component results are in [r12](../11-v1/SESSION_PROGRESS_20261028-r12.md). The "current" results linked to r10 below retain their historical cutoff.

| Command | Actual scope | Excludes |
| --- | --- | --- |
| `npm run check` | Retains research / Optional Harness regressions, schema, Wiki, design, lint / format; production TypeScript runtime tests, production build, and current dependency inventory checks | Browser, native SDK, manual listening tests, Meta live, long-duration performance |
| `npm run test:runtime` | Scene, real Rapier WASM, interaction, Behavior, acoustics, audio control layer, recording / persistence, AI host, and app integration | Node fake-context cases do not represent native audio rendering or listening tests |
| `npm run build` | Full TypeScript checking and Vite production bundle | Page interactions, audio, device latency, physics / acoustic accuracy |
| `npm run test:browser:ui` | Runs UI Chrome / Chromium tests against a fixed `e2e` bundle; retains the build input digest, JSON results, and failure traces | Visual output cannot establish that numerical / listening checks passed |
| `npm run test:browser:storage` | A managed runner executes persistence.spec.ts on independent port 5178 with Vite HMR disabled, retaining raw results and records of controlled process cleanup | Does not equal the entire product save / reload E2E |
| `npm run test:browser:physics` | A managed evidence runner executes the four real-WASM browser modes and product lifecycle tests, retains raw results, and cleans up its process tree | Makes no claim about manual input / listening tests or profiles that were not run |
| `npm run test:browser` | The root Playwright config discovers only ui.spec.ts; other suites use their own explicit commands | Differs from the UI command with a fixed bundle; development HMR can affect input ownership |
| `npm run validate:all` | Saves stdout / stderr / exit / timing and before-and-after source hashes for each command, covering the items in `check` and the existing prompt benchmark | Additional tests must still run separately; no automatic live API calls |
| `npm run validate:licenses` | Checks that the lockfile, direct dependencies, and installed distribution metadata / LICENSE / NOTICE hashes match the pinned inventory | Legal approval for distribution or completeness of rights for every bundled component |

`npm run test:browser:storage:list` or `node tests/browser/run-storage.mjs --list` only lists the five persistence cases without starting Vite or a browser. Do not forward `--list` through Windows npm as an extra argument; the local wrapper previously swallowed that argument and started the actual tests.

The production storage runner refuses to reuse an occupied port and only stops the Node / Playwright process tree it created. On Windows, provider filters for known PID / ParentPID values verify identity and controlled descendants without reading global CommandLine data. Even if the stop command returns nonzero, cleanup is accepted only when there is evidence both of root exit and an empty tree; without audit evidence, retain UNVERIFIED / FAIL. The Physics command uses node tests/browser/run-physics-lifecycle.mjs --evidence. The current physics2 / storage5 on 2026-10-28 actually passed and were cleaned up; the original storage 15-second audit timeout is retained, with cleanup separately confirmed through one bounded query for the same identity; see [r10](../11-v1/SESSION_PROGRESS_20261028-r10.md). Earlier startup / cleanup failures are not overwritten.

`npm run test:browser:product` builds a separate fixed bundle and runs the full product chain in three clean contexts plus WAV relinking in separate storage, retaining source / bundle / harness hashes; whether it actually achieved PASS is determined by the results. This command does not call a model or include manual listening tests or a 10-minute profile.

`validate:all` retains the unique `benchmarks/results/phase3-*.json` output prefix required by the old tools to avoid breaking the existing overwrite-prevention regression; the report's `scope` explicitly records V1. If the before-and-after source hashes differ, the final result is still FAIL even if every child command succeeds. This is a before-and-after comparison without continuous file monitoring, so it cannot detect changes that are subsequently reverted during execution; source writers must still be stopped first. Historical reports must not be overwritten.

```powershell
node scripts/validation/run-all.mjs --output benchmarks/results/phase3-v1-20261027-unique.json
```

The local UI config defaults to the installed Chrome; CI uses the Chromium corresponding to Playwright. Official browser installation methods are in [Playwright Installation](https://playwright.dev/docs/intro) and the [CI Guide](https://playwright.dev/docs/ci-intro). The CI workflow has a separate browser job that first installs the Chromium corresponding to the pinned Playwright version, then runs the three independent browser commands. Editing the workflow does not mean remote CI has run; the current remote result is **NOT RUN**.

<!-- english-original-anchor --> <a id="授權及限制"></a>
## Licenses and Limitations

Read both the [V1 Third-Party Notices Index](../01-compliance/V1_THIRD_PARTY_NOTICES.md) and [License Register](../01-compliance/LICENSE_REGISTER.md). The `dev` flag on direct / transitive dependencies is an npm classification; Three, Rapier, AJV, and others are still imported by production product code, so it must not be used to omit applicable notices when distributing the product. The browser's own HRTF, Steam Audio binaries, user audio files, and Meta service terms each have separate sources; they are not included in this inventory.


<!-- english-original-anchor --> <a id="2026-10-28-本機版本與獨立命令"></a>
## 2026-10-28 Local Versions and Independent Commands

The actual local Node is C:/Program Files/nodejs/node.exe (22.17.0); the npm 11.4.2 CLI is C:/Users/kevin/AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js. The other npm version bundled with Node does not count as the verified 11.4.2. If needed, temporarily add the Roaming/npm and Node paths only in the current PowerShell process, preserving the original PATH and restoring it in finally; do not modify the global PATH.

    $reflectionOriginalPath = $env:PATH
    try {
      $env:PATH = 'C:\Users\kevin\AppData\Roaming\npm;C:\Program Files\nodejs;' + $reflectionOriginalPath
      & 'C:\Program Files\nodejs\node.exe' 'C:\Users\kevin\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js' --version
      & 'C:\Program Files\nodejs\node.exe' 'C:\Users\kevin\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js' run check
    } finally {
      $env:PATH = $reflectionOriginalPath
    }

The following native audio commands run with the Windows x64 browser already cached on this machine and the fixed source profile approved by Root. The default baseline legacy is historical; the current audio source uses prefix-f3e5. The first command creates a bounded static fixture itself and runs the original 25 cases; prepare mode only builds the fixture and does not run a browser.

    node tests/audio-runtime/run-prepared-native-v2.mjs --prepare --baseline prefix-f3e5
    node tests/audio-runtime/run-prepared-native-v2.mjs --run --baseline prefix-f3e5
    node tests/audio-runtime/run-prepared-ir-v1.mjs --prepare --baseline prefix-f3e5 --ir-profile v2

An actual IRv2 run also requires the actual path and SHA256 of the fresh25 wrapper-verification-v2.json from the same source: the options are --run --baseline prefix-f3e5 --ir-profile v2 --qualified-v2 and --qualified-v2-sha256. Neither placeholders nor successful preparation count as evidence of an IR run. [Raw results and command scope for this round](../11-v1/SESSION_PROGRESS_20261028-r10.md) are listed separately; every new run uses a different output directory.

The performance command node tests/browser/performance-profile.mjs --phase all --seconds 600 executes all loads; this round already has FAIL / UNVERIFIED / NOT RUN results. Stable source or a process exit0 does not mean performance passed. This parser has no help mode; do not use --help as a query without side effects.
