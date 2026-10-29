# 第一版整合 checkpoint r10：當前功能通過，性能與人工門檻未完成

記錄日期：2026-10-28（台北）；本輪測試 artifacts 使用 UTC 2026-10-27。完整第一版 goal 仍 ACTIVE，未宣告完成。原 [51 項驗收](ACCEPTANCE.md)、[機器清單](REQUIREMENTS.json)、61 份保護檔案、Task criteria 與性能數值均保留。Codex 主導，沒有使用 Muse Code 額度或新增付費 Meta 請求。

## 當前來源與已驗證範圍

產品來源凍結為 physics 650233ed、runtime c3437ecd、band-filter f3e5cb2b；完整 SHA 與原始資料見各收據。E2E 建置 inputDigest 為 028b16a8f8f49bda1be4bc693867fc5061e9819dac872e49186d541a4deb7bc0，170 inputs／12 bundle files；這是驗證模式建置，不能當 production release。

| 項目 | 實際結果與範圍 |
| --- | --- |
| 產品分項回歸 | UI／physics 相關 391、audio 150、prepared utility 100、performance observer 155 分別通過；不是新一輪完整 check |
| 原生音訊 | [原 25 項](../../artifacts/v1/audio-prefix-native25-20261027173304441/qualification-receipt.json) 25/25 PASS；[IRv2](../../artifacts/v1/audio-prefix-irv2-20261027173404198/sequential-qualification-receipt.json) 3/3 PASS，六 renders／576000 PCM bytes，雙聲道 RMS／maxAbs 誤差均為 0 |
| UI | [當前 UI27](../../artifacts/v1/ui-current-functional-20261027T174359786Z/proof-receipt.json) 全數 PASS，包含 EN8／ZH13 與聲音 diagnostics／preview／admission；headless 畫面不等於原生桌面操作 |
| Physics／storage | [Physics2](../../artifacts/v1/physics-current-operation-20261027T175652Z/operation-end.json)、[Storage5](../../artifacts/v1/storage-current-operation-20261027T175744Z/causal-cleanup-confirmation-end.json) PASS；原 storage 15 秒稽核逾時保留，另以有界相同身分查詢確認清理 |
| 完整產品鏈 | [Product4](../../artifacts/v1/product-current-corrected-operation-20261027T181110Z/operation-end.json) 4/4 PASS；三次 fresh browser context 的抓投→impact→native audio→capture→acoustic B→reload/replay，加獨立 store 的原 WAV 重連；不冒稱三次 OS 重開或人工聽測 |
| 產品啟動器修補 | [原始失敗](../../artifacts/v1/product-current-operation-20261027T180343Z/operation-end.json) 未進入 browser。Vite URL 中的 ANSI 色碼阻擋原文字 gate；僅正規化比對用字串，原 raw log、100×100ms loop、process-live／HTTP／index SHA gate、測試斷言不變。[11 項回歸與獨立審查](../../artifacts/v1/product-preview-readiness-independent-20261027T180956888Z/verification.json) PASS |
| 跨 browser | [當前比較](../../artifacts/v1/audio-prefix-cross-webkit-20261027181436974/sequential-comparison-receipt.json)：Firefox157.0 為 8 PASS／1 原能量門檻 FAIL／9 capability BLOCKED／7 NOT RUN；Windows WebKit27.2 為 25 capability BLOCKED，缺所需 AudioContext／OfflineAudioContext。不是 Safari 或跨平台完整支援聲明 |
| 聽測工具 | [正式路徑封存](../../artifacts/v1/hearing-probe-preparation-20261027T173919314Z/promotion-seal.json) 的 47 項（18＋11＋18 binding）由獨立 Node22 程序通過；原始 bytes／收據保留，格式衍生版本經語意／assertions／Worklet UTF8 等價核對。這只證 static／pure preparation |

原 IRv1 FAIL、cold Vite prepare 逾時、早期原生縮放及所有性能失敗均保留；IRv2 只修正已獨立確診的 reference inactive-gain 初始化，未改產品數學或放寬容差。音訊原25使用 cached Chromium headless shell 156.0.8078.4，不能推成實際裝置聽感。

## 本輪正式性能結果

[完整 operational summary](../../artifacts/v1/browser-performance-20261027T183039817Z/operational-summary.json) 與 [verification](../../artifacts/v1/browser-performance-20261027T183039817Z/verification.json) 保留原 FAIL／UNVERIFIED／NOT RUN。命令為：

    node tests/browser/performance-profile.mjs --phase all --seconds 600

受控 wrapper 保留原生 process handle；實際 Node23876 的 native／.NET exit 均為 0，讀取一致、未逾時。這是程序結束結果，不是性能 PASS。全域 1789 份來源前後完全一致，[自有程序與 5191 清理](../../artifacts/v1/browser-performance-20261027T183039817Z/coordinator-cleanup-proof-v2.json) 已核實。先前51808已被另一個較晚建立的 cmd.exe 重用，未干預該程序。

| 量測 | 觀測結果 | 判定與限制 |
| --- | --- | --- |
| Physics native WASM step | 3000 次，p95 2.20 ms | 原小於2 ms目標 FAIL；255 dynamic 全程 awake、64 CCD、contacts1317–1441 等負載 gate 通過 |
| 完整 fixed tick 含 copies | p95 12.50 ms | MEASURED；不能把 native step 的2.20 ms稱為完整物理成本 |
| Default worker／delivery | worker p95 6.8 ms；delivery p95 3.9 ms | 600 batches／64 current routes，6 deadline misses；20Hz gate未完整通過，worker目標 UNVERIFIED，delivery小於1ms FAIL |
| Stress worker／delivery | worker p95 9.5 ms；delivery p95 14.4 ms | 600 batches／254–256 current routes，31 misses、measured droppedPaths95；設定的256路徑／20Hz負載未完整維持 |
| UI | 實際628.935秒、31295 frames；RAF p95 17.0 ms、all-RAF callback CPU p95 18.9 ms | 原門檻 FAIL；201 overruns、14.483秒 wall-time drop、258 paused advances；不是連續600秒有效動態負載 |
| 主執行緒 trace occupancy | trace finite／ordered、無 CDP data loss | 原 membership gate仍FALSE，主執行緒 occupancy維持 NOT RUN |

106 筆 native RAF timestamp 比 callback 入口的原始 performance.now() 微大，最大為 2.3865140974521637e-8 ms；所有 ID、finite、in-window 檢查其餘通過。此比較路徑沒有 Harness epoch 轉換；瀏覽器原因尚未證實，沒有加入 epsilon、重分 bin 或升格原結果。實際 fast interpolation 31040 次成功、0失敗，legacy 路徑0，成本有計入。

暫停原因均記為 fixed-step safe-overload。既有錄製保護規則要求保留 simulation ticks；這是實際退階證據，不能當作原負載持續執行通過。最後 stop／persist 區間47.885秒、retained debt47.788秒，沒有足夠儀器將整段歸因給 CPU、磁碟或特定工作。ACO04 的 worker identity／stale／queue／capability 功能契約仍須以其獨立測試判定；性能失敗不等於這些功能全部失敗。VAL04 的分項 profile／metadata／透明退階與整體結案政策分開處理，初始 TARGET 不自動轉成完成授權。

## 原生桌面與實際裝置

本輪 NativeV2 兩次在可見性前置檢查回報 hidden，尚未開始200%／320CSS／Pointer Lock驗收；舊13:09的0eef版本 PASS只作歷史證據。使用者已回報桌面解鎖、螢幕喚醒，不能據此推斷失敗原因。相同腳本、參數及版本無法解釋差異；[RCA](../../artifacts/v1/native-visibility-rca-20261028.json) 保留缺少的桌面／遮蔽／身分資料。

官方 NodeREPL 與 CUA 初始化均在 app 操作前出現 kernel assets／os error3；確認各代理沒有待保留 bindings 後，官方 reset成功，但各一次 reinitialize仍相同失敗。[恢復紀錄](../../artifacts/v1/native-surface-recovery-20261028.json) 為 Root 記錄的工具結果，不是產品或 Windows 鎖定證據；沒有第三次不變條件的 NativeV2重跑。

Hi-x65／D3V僅為使用者回報的 transducer 型號。專用 localhost 聽測 session 已成功完成 build／HTTP provenance preflight並 arm，正等待使用者在暫停狀態 Enable listening；目前尚無 captured App AudioContext、sampleRate、block、actual route 或聽感證據。不能將靜音探針／47項 pure tests／離線PCM當作裝置 PASS。

## 持久化與下一步

Task0006／0017／0019既有DONE保留；Task0020仍IN_PROGRESS，原 criteria／dependencies 不變。Git base HEAD仍為f006b0e60db18450bdfcbcf22d790b9913724b1e，本輪新增成果待最後品質檢查後本地 commit，未push／部署。舊900項 post-CI是修補前的範圍，不當作當前完整check。

接續完成實際聽測或記明阻擋、當前51列需求證據、production build／NOTICE實體綁定、全部英文 freshness、完整 pinned Node22.17.0／npm11.4.2 check、Wiki／handoff／Git。NOTICE舊pack的兩個WASM container identity核對對應同一WASM bytes，不能稱兩個不同binary；尚存權利／來源缺口須逐項保留。

已保存的最小真Meta Sound提案→Apply→本機180ticks證據保留；本次US$1授權的3請求slots已用完，沒有新增付費請求，實際帳單／剩餘credit未知。本人資格、登入後條款、根LICENSE及發布決策仍未代行。完整第一版尚未完成。
