<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/ui/readability-pass-20261103/README.md","sha256":"30bf960547332a215ca30714d1ccd257032f33230dbdf20ef54070120a0ca60a","translated_at":"2026-11-03T13:15:33.000Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/ui/readability-pass-20261103/README.md`](../../../../../16-nonadvanced-completion/lanes/ui/readability-pass-20261103/README.md). Source SHA-256: `30bf960547332a215ca30714d1ccd257032f33230dbdf20ef54070120a0ca60a`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="2026-11-03-介面可讀性整理css-only"></a>
# 2026-11-03 interface readability pass (CSS-only)

User request (2026-11-03, before manual testing): keep necessary spacing between elements, do not box similar elements inside boxed buttons, and improve readability; use Emil Kowalski skills as reference (this repository's pinned copy `.agents/skills/emil-design-eng`).

<!-- english-original-anchor --> <a id="變更範圍"></a>
## Scope of change

- Commit `1be15d5c` changes only `src/ui/styles.css` and `src/ui/top-monitor.css`; DOM, roles, names, copy and design tokens are unchanged (`src` tree `0d955495` → `3924149d`).
- Mutually exclusive modes (viewport Move/Rotate/Scale, top-monitor views) became a single bordered segmented switch: the buttons themselves have no border, and the selected state is shown with a raised background, accent text color and 600 weight.
- Monitor strip: the buffer select is no longer boxed together with Simulated/Raw; the two route buttons are joined into one toggle.
- Top monitor: more padding, the meter gains a thin frame and a canvas background so its status message clearly belongs to it, and captions use the secondary color.
- Inspector: more spacing between sections and fields, labels in the secondary color and values at body size; dock and viewport toolbar gaps increased.
- The viewport toolbar wraps instead of overlapping at narrow widths (before this change, at 1024 px in the English interface, “Enter first person” covered “Frame selection”).

Before/after screenshots: `before/`, `after/` (1440×900 zh-TW), `before-1024-en/`, `after-1024-en/` (1024×768 English).

<!-- english-original-anchor --> <a id="驗證結果"></a>
## Verification results

| Item | Result | Evidence |
| --- | --- | --- |
| UI unit tests, format, lint | 232/232 passed; format and lint passed | [ui-unit.log](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/ui/readability-pass-20261103/verification/ui-unit.log) |
| Emil skills pinned sources and design standards | All sources MATCH; standards are static token/standards checks only, not screen validation | [emil-check.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2921a1caebcc740b770f850e07eb1ac62128b377), [emil-standards.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fb73399b8972bbfc4d29b38b82a3360d2ae6f2f7) |
| Ten reset/import cycles and dispose (real Chrome) | 2/2 passed | [physics-ui.log](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/ui/readability-pass-20261103/verification/physics-ui.log), `artifacts/v1/physics-acceptance-20261103/browser-20261103125246463/` |
| Production top monitor (attempt10, build `1be15d5c`) | 4/5; the 390/929/1440 px header layout test passed; the failure is still the original “switching views keeps the recording” case (recording pause), the same as pre-pass attempt09 | [top-monitor-attempt10.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f11a76ca268d69000537a38bf39e99499a48f9a7), [build receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1519312de758892832b2221cd5e67110d75425ef) |
| Refined v3 product E2E | **Not passed**: after the pass, only 2 of 15 clean launches across 5 runs passed; the missing-WAV relink passed every time. See the A/B below | Table below |
| Full S4 22 routes | **NOT RUN** (not rerun after the pass; pre-pass s4-final-01 was 11/22) | — |
| Human visual confirmation | Pending the user's manual test | — |

<!-- english-original-anchor --> <a id="refined-v3-ab同一台機器同一時段依序執行"></a>
### Refined v3 A/B (same machine, same time window, run sequentially)

The pre-pass source was checked out at `3a03adc3` (src tree `0d955495`) in a scratch worktree; the post-pass source is `1be15d5c` (src tree `3924149d`). Each run is three clean launches plus one missing-WAV relink; source and bundle stayed identical throughout.

| Time (UTC) | Source | Build input digest | Clean launches | Relink | Archive |
| --- | --- | --- | --- | --- | --- |
| 10:07 | Pre-pass | `3c402eded9cb` | 3/3 | Passed | `artifacts/v1/product-e2e-chrome-20261103T100747Z/` |
| 12:51 | Post-pass | `89571e4ecef3` | 0/3 | Passed | `artifacts/v1/product-e2e-chrome-20261103T125158Z/` |
| 12:59 | Pre-pass (control) | `3c402eded9cb` | 0/3 | Passed | `artifacts/v1/product-e2e-chrome-20261103T125918Z-preui-control-3a03adc3/` |
| 13:00 | Post-pass | `89571e4ecef3` | 0/3 | Passed | `artifacts/v1/product-e2e-chrome-20261103T130019Z/` |
| 13:03 | Post-pass (CPU sampled during run) | `89571e4ecef3` | 0/3 | Passed | `artifacts/v1/product-e2e-chrome-20261103T130307Z/` |
| 13:07 | Post-pass (after closing the idle Codex broker) | `89571e4ecef3` | 2/3 | Passed | `artifacts/v1/product-e2e-chrome-20261103T130712Z/` |
| 13:08 | Post-pass | `89571e4ecef3` | 0/3 | Passed | `artifacts/v1/product-e2e-chrome-20261103T130812Z/` |
| 13:09 | Pre-pass (control) | `3c402eded9cb` | 1/3 | Passed | `artifacts/v1/product-e2e-chrome-20261103T130903Z-preui-control-3a03adc3/` |

Interpretation:

- Every failure is the same kind: the simulation pauses during recording (“recording evaluation queue full” or “fixed-step workload limit exceeded”); the later “Grab unaccepted” and the timed-out Throw click are consequences of the pause (while paused, Throw is disabled and the Resume button appears and shifts the buttons in that row, so Playwright reports that Grab's help element intercepts the click). The pre-pass control shows exactly the same messages.
- The pre-pass control, whose build input is identical to the run that passed at 10:07, now passes only 1 of 6 clean launches, so the failures come from the execution environment, not this CSS; however, this round's data is not enough to prove that the CSS has **no** effect on timing, only that no difference was observed (1/6 pre-pass, 2/15 post-pass).
- Environment: C: had only about 4.1 GB free (the headless Chrome profiles and IndexedDB are on C:), and commit charge was 47.2/53.5 GB; after closing the idle Codex broker left by this session (about 12 GB of commit), one run reached 2/3, but the next returned to 0/3. While sampling, whole-machine CPU use was about 20% and no single process was competing for CPU ([cpu-during-c-ui.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/98da828d7353bcef95fe7bc46885a9712c7ec437)). The exact cause was not determined.
- Files larger than 1 MiB and trace zips remain on disk and are not committed to Git; their hashes are listed in each archive's `EXCLUDED_LARGE_FILES.json`.
