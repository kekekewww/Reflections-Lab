# 獨立架構驗收審查

日期：2026-10-29（台灣）。Reviewer：Codex 獨立代理，另由唯讀子 reviewer 複核成本與公開檢查工具。模型 ID 無可核實值，不補寫。基準／目前 research HEAD：`c210ca882ca8503b322c28884bf1e9f6e9fe126d`；受驗變更為 `research/architecture-review-20261029` 的 working diff 與新增檔案，尚無包含變更的 commit。Worktree：`C:/Users/kevin/.codex/worktrees/architecture-review-20261029/Meta Hack`。本 reviewer 未修改產品碼、舊測試、shared Wiki、原工作區或 Git 歷史。

## 結論與適用範圍

**窄幅 runtime 與 portable contract 審查：PASS；本次完整整合驗收：PARTIAL；基準完整歷史公開 push：BLOCKED。** 尚缺 root 最終完整品質／browser／整合收據與最終待公開 ref 的審查，不能把此報告當合併／push 已執行或全 V1 完成。

已讀原始需求、VALIDATION_PLAN、架構／Gap、ADR-015、領域研究、實際 diff／source 與相關收據。依 codex-verification 執行獨立程序；本輪受驗產品碼與工具維持凍結，文件由指定整合者修正。本報告只保存本 reviewer 已觀察的判斷，不替 root 宣告 task DONE。

| 審查面 | 判定 | 直接依據與限制 |
| --- | --- | --- |
| 原 workspace 隔離 | PASS（當下） | 唯讀 Git 確認 `D:/Developing/Meta Hack` 仍在 `codex/sound-behavior-research`、同 c210ca8、status porcelain 空；兩個 worktree 使用不同實體根。合併前仍須重新查核。 |
| 產品變更範圍 | PASS | solver／routes 共用 limit、audio index 的 type exports、新 types-only contract；package／lockfile、既有 tests、Scene／Project／Recording schemas 與 V1 protected docs 沒有 diff。新六案另加，沒有刪舊 oracle／降低 tolerance。 |
| 5 秒 solver／audio 邊界 | PASS | `solver.ts:271–276` 對超界設定先拒絕；`routes.ts:48/87/206` 共享同常數。預設仍 2 秒；有效 budget 之外 path 保留 drop／incomplete 診斷。六個新案例獨立 6/6 通過。 |
| Portable RenderJob | PASS（契約審查） | `src/audio/render-contract.ts:27–50` 定義有理數時基、排他 window／preroll／tail；`:76–128` 定義選源後獨立 graph、保留原 physics／behavior admission；`:141–186` 定義輸出診斷、完整發布與 cancel／retry 身份。沒有 renderer、validator 或雲端副作用。 |
| 錄製／main thread 描述 | PASS（碼審） | `runtime.ts:792–795/924–955` 固定步 callback 直接求解並 append；`recorder.ts:468–496` clone／byte count／領域驗證在呼叫緒。Worker sealing 不消除這段成本；研究正確保留 R17 負面性能。 |
| 研究／狀態誠實性 | PASS（已查範圍） | Motion／bounce與zone producers／完整 renderer／ADM／cloud／真人與性能限制分開；歷史 live 不冒充 fresh Meta／billing／現行完整等價。見下方已修 P2。 |
| 可重算成本 | PASS（算術）／PARTIAL（實際成本與容量） | 九列成本表與 calculator 一致；AI 為 symbolic、容量 UNVERIFIED；retention、egress、共享 allowance、render backlog 與排除成本明示。沒有實際帳單或萬人吞吐證據。 |
| 完整秘密內容掃描證據 | PARTIAL | publication reviewer 說明兩次完整 scan 當時 stdout 未保存原始 full JSON；後補 summary／定點候選複核不能冒充原 raw。未獨立接受完整內容安全結論。 |
| 完整 history 公開 | BLOCKED | 獨立 metadata inventory 再現 13 commits／8,774 objects／6,758 blobs／2,579,720,986 bytes 與三個 >100 MiB blobs；祖先另含使用者排除 build／cache／archive。只刪最新 tree 檔案不會移除祖先。 |
| 最終 regression／merge／remote | PARTIAL／NOT RUN | root 完整品質與後續 browser 結果尚待其實際收據；本 reviewer 沒有合併、push 或 remote CI。首輪產品 browser 失敗如下，必須保留。 |

## 重要發現與處理

**P2—Worklet 已實作的錯誤描述，已修正。** 初讀 `ARCHITECTURE.md:7`、`AUDIO_RUNTIME.md:3`、`ARCHITECTURE_GAP_ANALYSIS.md:12` 及總報告稱已有選用 Worklet lane，Gap 並列不存在的 `worklet/controller.ts`。獨立搜尋未見產品 `addModule`／AudioWorkletProcessor 註冊。已通知整合者；複查 canonical 入口現已改為 native Web Audio 已實作、custom AudioWorklet 為 planned／研究，刪除錯誤 path。英文 currentness 仍由 root 最終驗證。

**首輪 browser 失敗必須保留。** 已讀 `.cache/architecture-review/validation/product-process.json`、product.log 與 [真 browser verification](../../artifacts/v1/product-e2e-chrome-20261029T052845Z/verification.json)／[results](../../artifacts/v1/product-e2e-chrome-20261029T052845Z/results.json)：build exit 0；product exit 1，3 PASS／1 FAIL；第一個 clean-launch 在原 `product-e2e-refined-v3.spec.ts:367` 達 `Explicit capture recovery budget exhausted (8)`。source 與 bundle 在 run 內吻合／穩定，owned processes 零殘留。這是實際功能 run 失敗，不能因稍後成功就刪除；尚無證據將原因歸到本輪 5 秒變更，原預設 2 秒未改。重跑、baseline 歸因與 merge gate 由 root 據真結果判定，不以此報告預先填 PASS。

**公開阻擋與掃描限制是不同問題。** 已有大小／使用者產物範圍足以阻擋 full-history push；沒有原始完整秘密掃描收據時仍列 PARTIAL，不從 metadata 或規則零命中推論不存在秘密。最終新增 commit／實際公開 ref 仍需重新查核。未授權改寫歷史或切換公開 ancestry；保留本地成果是可行安全狀態。

未發現其他阻擋本輪窄幅程式變更的重大缺陷。這不解除已有的 OnBounce／zone producer 缺口、generation cooldown 研究發現、R17 性能失敗、正常 100% 實體 FPS／IME、Hi-x65／D3V 聽測、root LICENSE／資格／條款等門檻。

## 獨立實際命令與結果

| 命令／檢查 | 真正結果 |
| --- | --- |
| `node --version`／`npm --version` | v22.17.0／11.4.2，與鎖版一致。 |
| `node --import tsx --test tests/acoustics-runtime/propagation-limit.test.ts` | exit 0；TAP tests 6、PASS 6、FAIL 0、cancelled/skipped/todo 均 0。兩個超界早拒絕、兩個合法設定、恰 5 秒路徑與超界 drop 都通過。 |
| `npm run typecheck` | 獨立程序 exit 0；stdout 為 `tsc --noEmit`，沒有診斷。 |
| `node scripts/validation/cloud-cost-model.mjs --self-test`／`--markdown`（獨立子 reviewer） | exit 0；九列與文件完全一致，未呼叫雲服務或 Meta。 |
| `node scripts/validation/publication-audit.mjs --self-test`（獨立子 reviewer） | exit 0；split-token／GZIP synthetic cases PASS；未輸出秘密值或 extract 檔案。 |
| `node scripts/validation/publication-audit.mjs --ref c210ca882ca8503b322c28884bf1e9f6e9fe126d --metadata-only`（獨立子 reviewer） | exit 0；重現上列 full-history inventory／三個 >100 MiB blockers。不是內容掃描。 |
| Git diff／status／worktree／input hashes | 本輪唯讀實查；原 workspace clean、同 baseline；未升依賴／改 schemas／改舊 tests。 |

沒有由本 reviewer 重跑完整 `npm run check`、benchmark、browser、native audio、600 秒量測、跨設備／聽測、paid API 或部署。root 統一跑的收據須另附，不能把上列窄範圍結果替代它們。

## 契約與來源限制

型別的 `readonly`／literal unions 不能驗證不可信 JSON、保證 hash、限制記憶體或實作原子發布。未來 backend 必須補 safe-integer／中間乘積、sample alignment、prehistory／tail、asset／clock pins、source isolation／nonlinear master、NaN／Infinity／clipping availability、capability refusal、cancel race／crash／重試 oracle。本輪無實際 PCM renderer，因此這些 runtime 條件均 NOT RUN；契約通過只表示已明確預留所需語義。

獨立抽查 [W3C Web Audio 1.1 2026-09-22 WD](https://www.w3.org/TR/2026/WD-webaudio-1.1-20260922/) 的草案地位與新增增量方向、[Rapier 0.21 determinism](https://rapier.rs/docs/user_guides/javascript/determinism/) 的同版／同初始化與順序前提、[Meta models](https://dev.meta.ai/docs/models)／[pricing](https://dev.meta.ai/docs/pricing-rate-limits) 的公開版本／費率，與研究限定語一致。查核日為 2026-10-29；官方頁面不是本帳號 live／瀏覽器支援或本產品容量證明。

成本子 reviewer 另核對 Workers／R2／Queues／Supabase／Cloud Run／GCS 官方費率，沒有發現重大算式錯誤。所有結果仍受文件明列的 duty、token、steady-state retention、price date、排除項與未量測 worker throughput 限制。

## 受驗產品與工具 SHA-256

| Path | SHA-256 |
| --- | --- |
| src/acoustics/limits.ts | `91713abae3b371eff19499040c51488b9c0a35418fbcfef742c2a9688a04fa17` |
| src/acoustics/solver.ts | `81bf485d565cbe15ddacf944130346b55c4048c1cc54dfd4e7ff7b5f7eda83d4` |
| src/audio/routes.ts | `72f8fda5726a29c45ddeabc60f65087f7e9cf5f619de887ef152b28ae90b8a1d` |
| src/audio/index.ts | `c1fde890e91e01b0a9ff33f9efd4ab1467b97376ebf383eb7aa61d7d6fd820e7` |
| src/audio/render-contract.ts | `2ffea48d29e1abf25ab64a267ef7d7c7da338ab1b1b7c4240e4b5a6f0b76e95a` |
| tests/acoustics-runtime/propagation-limit.test.ts | `58a27fa3e9db1ca126d4774b66670cf0ef12fae97b7ccc7307937570bcb9cd1e` |
| scripts/validation/cloud-cost-model.mjs | `f8510ce37800b24cc4e160ba3c5819dc45678a7ca1456ee810b0283d5b4c2408` |
| scripts/validation/publication-audit.mjs | `5bf634aa4d3e0b886837c4b22dcac52b2035371aeb74be9baba337f83b09e699` |

這些是實檔 post-change hashes；不是包含它們的未來 Git commit SHA。若受驗 runtime／tools 再改，對應判定需重新 review。root 最終應連回本報告並保存其完整驗證與整合結果，不能擅自把本報告的 PARTIAL／BLOCKED 改成 reviewer PASS。
