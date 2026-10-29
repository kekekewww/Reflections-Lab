<!-- english-source: {"path":"docs/00-project/PROJECT_BASELINE.md","sha256":"fb5fadcc9de1df1d9c4d8c6cbc95922667002f8daf7a58491e79a195d35e71bd","translated_at":"2026-10-27T03:42:15.177938Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/PROJECT_BASELINE.md`](../../00-project/PROJECT_BASELINE.md). Source SHA-256: `fb5fadcc9de1df1d9c4d8c6cbc95922667002f8daf7a58491e79a195d35e71bd`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="專案起始基準"></a>
# Project Starting Baseline

Inventory date: 2026-10-26 (Asia/Taipei). Working directory: `D:\Developing\Meta Hack`.

<!-- english-original-anchor --> <a id="修改前觀察"></a>
## Observations Before Changes

Both `Get-ChildItem -Force` and recursive file enumeration returned no output; `rg --files` found no files. Both `git status --short --branch` and `git log -1 --format=fuller` reported `fatal: not a git repository`. This conclusion covers only the current directory; it does not imply that related assets are absent from other drives, accounts, or historical chats.

| Item | Starting state |
| --- | --- |
| Git branch / Commit / Remote | Absent; history cannot be determined |
| README / AGENTS / CLAUDE / Skills | None; `D:\AGENTS.md` and `D:\Developing\AGENTS.md` were not found either |
| Source / Tests / Fixtures / Benchmarks | None |
| PDF / Markdown / CSV / JSON / Lockfile | None |
| Uncommitted changes | No Git repository, so Git status classifications do not apply; the original directory was empty |

<!-- english-original-anchor --> <a id="環境觀察"></a>
## Environment Observations

Initial commands measured Windows build `10.0.26200`, x64, PowerShell 7.6.5, Node v22.17.0, npm 11.4.2, Python 3.12.11, CMake 4.3.1, and Git 2.49.0.windows.1. `rustc`, `cargo`, `clang`, and `cl` were initially absent from PATH; this does not prove that they were not installed anywhere on the machine. The SDK spike checks available compilers separately. The environment rejected the CIM CPU query; a later read-only query used Node `os` instead. See the environment result file for details.

<!-- english-original-anchor --> <a id="本次範圍"></a>
## Scope of This Task

The user requested research, SDK work, engineering preparation, and isolated feasibility validation, without large-scale product implementation for now. All files added during bootstrap belong to this work; they cannot retrospectively be claimed as existing work from before the competition. If the official competition rules and start time are unconfirmed, the scope remains research / spikes.

The original requirements are preserved in [MASTER_REQUEST.md](MASTER_REQUEST.md). Priority for subsequent decisions: latest user requirements → accepted ADRs → measured implementation evidence → historical drafts → research not yet adopted. Initializing Git does not establish proof of source authorship, upstream licensing, or competition eligibility.
