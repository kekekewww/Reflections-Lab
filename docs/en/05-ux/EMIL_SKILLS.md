<!-- english-source: {"path":"docs/05-ux/EMIL_SKILLS.md","sha256":"6d02585ee7fab13a0104dcbe1a07b93adc8f77480626884fa1ea0cc5e41b77b1","translated_at":"2026-10-27T03:39:30.1444026Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/05-ux/EMIL_SKILLS.md`](../../05-ux/EMIL_SKILLS.md). Source SHA-256: `6d02585ee7fab13a0104dcbe1a07b93adc8f77480626884fa1ea0cc5e41b77b1`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="emil-kowalski-skills選用安裝與來源"></a>
# Emil Kowalski Skills: Selection, Installation, and Sources

Verified / obtained: 2026-10-26 (Asia/Taipei). The pinned official README, LICENSE, eight SKILL files, and their required references were read in full; this is not a summary based on the repository name. Official sources: [repository](https://github.com/emilkowalski/skills), [pinned README](https://github.com/emilkowalski/skills/blob/2d228630ba1446365f614a108cb8252f1feda202/README.md), [MIT LICENSE](https://github.com/emilkowalski/skills/blob/2d228630ba1446365f614a108cb8252f1feda202/LICENSE).

The source is pinned to commit `2d228630ba1446365f614a108cb8252f1feda202`, with commit time `2026-10-11T13:58:32Z`; the signature API reports unsigned. Each file's Git blob SHA-1, SHA-256, byte length, and local location are recorded in the [manifest](../../../third_party/emil-skills.manifest.json). The original files remain byte-for-byte intact; the [MIT notice](../../../third_party/emil-skills.LICENSE) is retained. This license does not replace the decision on the project's root LICENSE.

<!-- english-original-anchor --> <a id="已安裝的必要範圍"></a>
## Required Scope Installed

The only copy of each upstream skill's main text is in `.agents/skills/<name>/`; there is no second vendor copy, Windows symlink, global configuration, or private Agent configuration. One copy each of README / LICENSE is kept only in `third_party/` as the source record and MIT notice; no other skills, fonts, or images were downloaded, and no upstream programs were executed.

| Skill | When this project uses it | References retained with it |
| --- | --- | --- |
| [emil-design-eng](../../../.agents/skills/emil-design-eng/SKILL.md) | Combined review of components, hierarchy, and design engineering | None |
| [animate](../../../.agents/skills/animate/SKILL.md) | UI animation after its purpose is confirmed | RECIPES.md |
| [review-animations](../../../.agents/skills/review-animations/SKILL.md) | Review of an existing animation diff | STANDARDS.md |
| [improve-animations](../../../.agents/skills/improve-animations/SKILL.md) | Overall motion audit / plan for an existing UI | AUDIT.md, PLAN-TEMPLATE.md |
| [animation-performance](../../../.agents/skills/animation-performance/SKILL.md) | Frame traces and layout / paint / composite issues | None |
| [pick-ui-library](../../../.agents/skills/pick-ui-library/SKILL.md) | Evaluate component / virtual list packages when formal requirements have an actual gap | None |
| [prototype](../../../.agents/skills/prototype/SKILL.md) | Compare different directions after receiving a separate prototype task | PICKER.md |
| [break-ui](../../../.agents/skills/break-ui/SKILL.md) | Extreme data / empty / high-volume / failure states in existing components | CATALOG.md |

All eight apply to the design / verification of a future professional desktop tool, so they are retained. The original `disable-model-invocation` settings in `prototype` and the review / library skills are preserved; this does not guarantee that every Agent will trigger them automatically. Codex's project discovery path is `.agents/skills/`; this session can read them directly before a new session rescans. Claude / Pi can read the same files as needed through the shared entry point; automatic discovery has not been claimed as tested in other Agents. Compatibility entry points are maintained under the shared memory rules; upstream skills must not be copied and rewritten independently.

<!-- english-original-anchor --> <a id="安裝工具查核與重現"></a>
## Installation Tool Verification and Reproduction

The official README recommends `npx skills@latest add emilkowalski/skills`. This time, [npm skills 1.7.4 metadata](https://registry.npmjs.org/skills/1.7.4) and the corresponding [CLI README](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/README.md), [commands](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/docs/commands.md), [installer.ts](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/src/installer.ts), [agents.ts](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/src/agents.ts), [add.ts](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/src/add.ts), and [telemetry documentation](https://github.com/vercel-labs/skills/blob/a80e4c9d12d607631249d4d7d059f835d4b2f13a/docs/troubleshooting.md) were inspected first.

`1.7.4` corresponds to gitHead `a80e4c9d12d607631249d4d7d059f835d4b2f13a`, is MIT licensed, and has registry integrity `sha512-lHZJksE8UImNAr+LL6unqq7jERjdFw5EJasm17srycwL7rXHGdCmgu1L1ttLxUO9i3rdH+QQig+px0icHqLmRw==`. It requires Node `>=22.20.0`, higher than this project's pinned `22.17.0`; **the CLI was not executed or added as a dependency**. This was metadata / source inspection; no claim is made that the tarball was downloaded and verified.

Its default project installation, agent detection, canonical copy plus symlink / Windows junction, copy fallback, ability to overwrite destination skills, lockfile, and telemetry/security-audit requests may all have side effects. `-g` writes to the user directory, and `--all` expands the skill and Agent scope. At execution time, `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` can disable both types of requests. These findings led to the choice of a bounded, project-owned tool this time, without running an unpinned latest version or upgrading the project's Node version solely to install text skills.

```powershell
# 預設離線：只檢查 16 個已保存檔案（8 SKILL、6 reference、README、LICENSE）
node scripts/setup/emil-skills.mjs --check
# 只列出缺少／不同的檔案，不連網、不修改
node scripts/setup/emil-skills.mjs --dry-run
# 僅缺檔時，從固定 commit 的 raw URL 取得、驗 Git blob 與 SHA256 後新增；不同檔案拒絕覆蓋
node scripts/setup/emil-skills.mjs --restore
# 檢查 token schema／靜態對比／狀態完整性；不是 runtime／視覺測試
node scripts/setup/emil-skills.mjs --standards
```

A normal Git checkout already contains all text files and does not require a network connection. Restore does not accept arbitrary URLs / refs / destinations, remove or overwrite existing content, create symlinks, or execute downloaded content; network and file permission failures retain their errors. If a file differs, first preserve the diff and determine whether it is a local modification or pin update, then update the manifest through explicit source review. The current local hash must not be treated as upstream evidence.

<!-- english-original-anchor --> <a id="套用限制與指令優先序"></a>
## Application Limits and Instruction Priority

Upstream material is a design reference and does not override the latest user requirements, accepted ADRs, physics / DSP contracts, or this project's tokens. The preference list in `pick-ui-library` is not a basis for adoption or installation; no product dependencies such as React / Motion / Base UI were installed this time. UI springs, swipe velocity, blur, or stagger do not apply to Rapier grabbing / audio scheduling / solver data.

The upstream bare-invocation greeting, waiting for a choice after an audit, waiting for fixes after a break-ui report, and waiting for a variant choice in prototype must be applied according to the actual task scope. This time, the user explicitly authorized directly establishing standards and the environment, so there was no need to stop at a greeting or repeat confirmation. However, there was no authorization to build the formal UI or choose a prototype direction on the user's behalf, so these UI tasks were **not performed**. `improve-animations` retains its audit/plan role; it does not restrict all downstream engineering to read-only work. See [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) for specific motion differences.

Verification proves only the source text, tokens, and standards structure. The formal product has no runnable UI, so real-device behavior, visual review, animation profiling, and accessibility testing for all eight skills are **NOT RUN**.
