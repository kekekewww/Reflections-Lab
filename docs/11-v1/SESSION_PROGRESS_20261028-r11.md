# 第一版整合 checkpoint r11：完整自動檢查通過，保留未完成門檻

記錄日期：2026-10-28（台北）。完整第一版 goal 仍 ACTIVE；沿用[原51項驗收](ACCEPTANCE.md)、[固定機器清單](REQUIREMENTS.json)、原Task criteria／dependencies及61份保護檔案。Codex主導，沒有使用Muse Code額度或新增付費Meta請求。這是可重現的實作與驗證checkpoint，不是整體結案或發布批准。

## 當前直接證據

產品來源仍為physics650233ed／runtimec3437ecd／band-filter f3e5cb2b。驗證模式建置inputDigest028b16a8、170 inputs／12 bundle的browser／native分項及其完整SHA見[r10](SESSION_PROGRESS_20261028-r10.md)與原收據；本頁只補上其後完成的工作，不改寫舊截點。

| 項目 | 當前結果與範圍 |
| --- | --- |
| 完整品質 | [固定Node22.17.0／npm11.4.2 check](../../artifacts/v1/clean-quality-pinned-20261027195151500/verification.json)及離線prompt benchmark均actual close0／PASS；runtime917/917、0FAIL，1844份validation inputs前後相同、61份保護檔均相同。check不代替browser／native／裝置／性能／live API或遠端CI |
| 乾淨安裝來源 | [先前鎖版offline CI](../../artifacts/v1/qualification-locked-offline-ci-20261027144405972/verification.json)實際兩次npm ci close0；root／spike package與locks及.node-version五份輸入仍完全相同，因此本次重用證據，沒有宣稱重裝 |
| 產品與音訊 | 當前native25、IRv2三項／六PCM renders、UI27、physics2、storage5及product4分別PASS。Product4是三個fresh browser contexts與WAV重連；不是OS重開或聽測。原失敗、IRv1與修正原因均保留 |
| Worker | [當前原四案與Node46](../../artifacts/v1/worker-current-functional-20261027191925546/causal-summary.json)實際PASS；原預定三案的grep不符合full title，外層selection guard為FAIL／exit1，錯誤保留。舊輸出經preimage核實後還原；120-job專用profile不能升格正式600秒結論 |
| 英文 | [全庫報告](../en/_reports/final-current-corpus-20261027T194614022Z.json)277 originals、258/258 mirrors、18英文原文、1README companion、8明載raw exclusions；0 missing／stale／errors，31測試及獨立語義審查通過。15既有upstream link warnings保留；本頁及後續Task／Wiki變更須再同步 |
| Production／NOTICE | [實際build](../../artifacts/v1/production-capture-20261027191028396/verification.json)的12檔已與[NOTICE candidate](../../artifacts/v1/bundle-notice-pack-20261027-1914-r10/production-candidate-binding.json)綁定；[完整check後的重建確認](../../artifacts/v1/bundle-notice-pack-20261027-1914-r10/fullcheck-production-byte-confirmation.json)逐檔相同。173 legal payloads為158 whole＋15 ranges；同一WASM在兩個container核對，不能稱兩個binary |
| 權利補充 | [公開文字取得archive](../../artifacts/v1/tooling-license-recovery-20261028/summary.json)保存既有10次公開請求與29份逐byte原件，本次封存0請求。esbuild固定gitHead完整原文等於既有pack；humanfs仍404；Rolldown／natural的版本關係仍未證。舊pack六項缺口及根LICENSE UNSELECTED保留 |

第一次固定品質wrapper在nested npm probe前因Windows cmd路徑寫成正斜線失敗；失敗及因果probe保留。僅改ignored supervisor的cmd executable為原生反斜線，其餘命令、environment、version gates、protected及source guards不變，獨立byte review通過後，才執行上述完整PASS。沒有修改產品／測試容差來消除失敗。

## 仍未通過或未執行

- [正式性能](../../artifacts/v1/browser-performance-20261027T183039817Z/operational-summary.json)實跑628.935秒，source1789穩定、actual process0與清理已核實；physics core p95 2.2ms、delivery3.9／14.4ms、UI17／18.9ms保留原門檻FAIL。worker cadence／stress負載不完整，trace membership FALSE使main occupancy NOT RUN；沒有epsilon／重bin／門檻變更。需改進實作與量測資格，不能由透明揭露FAIL自行宣告整體完成。
- 兩次當前NativeV2在hidden前置檢查失敗，200%／320CSS／真Pointer Lock仍NOT RUN。使用者已確認喚醒桌面，原因未確診；官方CUA／NodeREPL初始化在app操作前os error3，官方reset後仍相同。沒有第三次不變條件盲跑，舊0eef native PASS僅歷史。
- [實際聽測session](../../artifacts/v1/device-hearing-session-2026-10-27T18-52-15.946Z/collection.json)完成preflight／arm後30分鐘等待結束，已正常關閉並清理自有preview；nativeProbe與hearing均NOT RUN、actual block UNKNOWN、沒有native observations或user reports。18:56最後status的capturedContexts0不能推斷之後未觀察的行為。Hi-x65／D3V僅user-reported型號，actual output／DAC／sampleRate／block與聽感仍未知；47項pure測試不代替聽測。
- Firefox157為8PASS／1strict energy FAIL／9capability BLOCKED／7NOT RUN；WindowsWebKit27.2為25capability BLOCKED，不能推成Safari或所有裝置。
- 最小真Meta Sound提案→Host Apply→本機180ticks保留PASS；Scene live／模型規劃Run／UI live未擴張聲明。US$1授權的3request slots已用完，沒有新paid請求；billing／remainingcredit未知。Codex開發不冒充Meta輸出。
- 競賽本人資格、登入後條款、部分來源／closure、根LICENSE與提交／發布仍是外部門檻，未代接受、push、部署或提交。

## Task、交接與下一步

Task0006／0017／0019原DONE不變。其餘原Task依獨立criterion review更新已證子條件，未通過者保留false；依賴未完成的Task不能直接DONE。完整第一版仍未完成，原Task與測試資料共用，英文鏡像不建立另一工作系統。

先完成本頁及原Task／Wiki的最後英文delta、完整pinned品質重驗與production bytes確認，再建立本機Git checkpoint。此頁建立時Git base為f006b0e60db18450bdfcbcf22d790b9913724b1e；commit hash以實際Git紀錄為準，不預填未來hash。接續針對實測性能瓶頸做有界診斷／實作，保留原負載及門檻；桌面／聽測須有可觀察環境或使用者實際報告才解除。
