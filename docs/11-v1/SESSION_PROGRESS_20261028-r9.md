# 第一版整合 checkpoint r9：產品小修補凍結，進入新來源資格驗證準備

日期：2026-10-28（Asia/Taipei；raw receipts 使用 UTC）。完整第一版 goal 仍 ACTIVE；51 項需求、EN01–06、原 Task criteria、負載及性能門檻不變。[r8](SESSION_PROGRESS_20261028-r8.md) 的原生 25 PASS、IR reference v1 FAIL／因果診斷及短 smoke FAIL 均保留。舊 `a699…` 是修補前的 E2E 驗證建置，不能代表本頁的新產品來源已通過 browser／native／正式性能。

## 已完成的產品修補

1. Physics 固定步前的歷史資料只複製插值及 moving／sleeping 邊緣比較所需的六個欄位；公開 snapshot／getPose／完整插值、步後 motion reducer、contact／solver／固定步與通知節奏不變。RED→GREEN、384 項相關回歸、獨立 4 項、strict／lint／format 通過；精確 Node 計數由 900 降至 700 次完整投影。[歷史 DTO 封存](../../artifacts/v1/history-dto-candidate-sourceend-20261027T165707544Z/EXPORT_RECEIPT.json)。
2. Renderer 的 `LabRuntime.getPose` 改用只回傳 objectId 對應位置／quaternion 的 detached 插值讀取；原完整公開 `interpolatedPoses` 本體逐 byte 相同。cache invalidation、replay、generation／discontinuity、同 tick native 修改、排序與原插值運算維持。391 項相關回歸及獨立 7 項通過，strict／lint／format 通過；精確 Node 計數再由 700 降至 550，另有 150 次必要欄位讀取。[插值讀取封存](../../artifacts/v1/interpolated-transform-candidate-sourceend-20261027T171111837Z/EXPORT_RECEIPT.json)。
3. Band filter 只新增八個 entries 的精確 layout key 前綴快取；先完成原輸入 snapshot／validation，再查正有限 layout，完整 IEEE key／signed-zero gain／kernel bytes／scale／fresh ownership／DSP 運算順序與原生 ramps 不變。34 份固定 full-key／kernel reference、既有 golden／DFT 與 reentry／型別／無效輸入／eviction 檢查保留；31＋119 個不重疊音訊測試共 150 PASS，strict／lint／format 與隔離審查通過。前綴 cache 的 logical numeric/string payload 上限 11776 bytes，加上有界 headers；既有完整 response memo 的 512 entries／1 MiB key/kernel payload 規則不變，不宣稱總 heap 只有這些數值。[音訊 prefix 封存](../../artifacts/v1/audio-prefix-sourceend-20261027170233273/sourceend-receipt.json)。

計數負載固定 105 objects／100 Dynamic／101 bindings／301 rules、共 320 ticks（含 warmup）。完整投影 900→550 不等於總 allocation 或 CPU 降低同一比例；snapshot350／publish205／behavior.snapshot205／request60／runtime pose reads19950 均不變。以上是 Node 原生物理及資料／行為 reference 證據，**不是 browser FPS、native DSP 或性能目標通過**。

最終產品檔案 SHA-256：

| 檔案 | SHA-256 |
| --- | --- |
| `src/physics/physics-world.ts` | `650233edc0ea91fb8bb164de5f3fbe44e1dbdf7c91fc4cf5873126c96995be6f` |
| `src/app/runtime.ts` | `c3437ecd823ab32dad4b10e2b958824c1bf5ad187add9ac0625468fea99d97ed` |
| `src/audio/band-filter.ts` | `f3e5cb2b6d1ad0301d44cd4f7092b0a4d4c621826484c5ed0588549c611f2693` |

`routes.ts` 仍為 `6933366f…77f591b0`、`engine.ts` 仍為 `30ee8a02…d85eccc`。所有 preimages、失敗、修正後輸出、actual child close 與 restore mapping 均已封存；沒有刪測試、放寬容差、改 solver 負載或跳過驗證。

## 觀測證據與驗證工具

一次隔離音訊診斷沿用相同 Chrome `156.0.8078.48`、八個 voices／64 paths、20 warmup＋20 measured；四個 scoped wrappers 保留 this／args／return／errors，六項委派檢查通過，最後全數還原。160 次 update／clone／applyRoutes、1280 次 route update 的 62.5ms 累計中，route 約 54%、clone 約 34%、reconciliation 約 7%，最大批次沒有 birth。來源／build／bundles 穩定，retained Node close0、已知程序清空。[因果診斷收據](../../artifacts/v1/audio-control-diagnostic-20261027164252008/control-stage-receipt.json)。這含觀測成本，不能推論新 p95 或快取命中率，更不是正式性能 PASS。

已建立 [Root source approval record](../../artifacts/v1/audio-prefix-approved-baseline-20261028.json)，SHA `281c75ecf575ffdef27aa99e6bf7c053d9c2c595a0dd176235ea997a1a160bd2`：對原 23 份音訊來源只准 `band-filter.ts` 的 `ce7012…→f3e5…` 產品變更，原 suites／oracle／driver／config／harness／doc／SDK pins 保持原值。**這是來源核准，不是 native 驗證結果。**

驗證工具的有界版本更新已完成：prepared-native 加已註冊的 `--baseline prefix-f3e5`；IR 工具加已知 `--ir-profile v1|v2`。原 IRv1 fixture／data／test／aa4 driver 與 FAIL artifacts 不改；新 v2 fixture 只允許版本 metadata 及經 native 因果證明的 inactive gain 初始化差異，保留三 checks／六 renders／576000 bytes PCM／15s／45s／嚴格 predicate。47＋53 共 100 項工具 conformance／負例通過，原 60 項保留；六檔 scoped strict／lint／format 與隔離審查通過。[工具 sourceend](../../artifacts/v1/audio-requal-utility-sourceend-20261027172620604/sourceend-receipt.json)。新 prefix IR run 還要求 fresh native25 的 `wrapper-verification-v2.json` 路徑與 SHA，驗證實際 source／IDs／native close／cleanup／bundles；不能用歷史 ce701 receipt 解除新來源門檻。**目前未啟動新的 native 或 preparation build。**

Renderer 改用新窄讀取後，performance fixture 已改為觀察真正執行的 `interpolatedTransforms`，保留完整舊方法的額外 provenance 與去重計時；不能因只包舊方法而把成本記為零。原 146＋新增 9 項共 155 項獨立 Node 測試通過，syntax／lint／format 及隔離來源審查通過；缺少 fast method／實際成功呼叫會 fail closed，零毫秒的成功呼叫可正確計數。[測試收據](../../artifacts/v1/performance-interpolation-observer-final-20261028.json)、[sourceend](../../artifacts/v1/performance-interpolation-observer-sourceend-20261028.json)。Runner／fixture 現為 `df86db94…cdf23c9c`／`32641b92…6846546b`；負載、門檻、trace／wake 規則不改，**沒有因此重跑 smoke 或 600 秒**。

## 下一步與限制

先固定工具來源並完成新 native25、IRv2，再以新建置重驗 UI／真 native zoom／physics／storage／產品 E2E、當前來源 Firefox／WebKit 比較及正式 profile。新來源完整 `npm run check`、production build、license pack rebind、英文 freshness／完整文件與最終 Wiki／Task／Git 尚待執行；不能沿用舊 900 項或舊 bundle 冒稱新來源整體通過。

正式性能數值仍依 [PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md)。原文稱初始 TARGET／非保證 starting profile，也要求保存失敗及實際退階；未定義「完整有效 profile 仍超標」的整體結案聚合政策。不能自行增加全部 targets 必過的規則，也不能自行批准揭露 FAIL 即可完成；目前仍未取得新來源完整正式 profile，先完成所有可做驗證並呈現具體結果，不用短測解除門檻。

使用者回報 Hi-x65 耳機／D3V 喇叭；實際路由、sample rate、block 與聽測仍 NOT RUN。聽測工具尚在 cache，正式提升／綁定新資格建置後才提供實際操作頁。已有 Meta 最小 sound live slice 保留；request slots 用盡、billing 未查，沒有新付費 Meta 或 Muse Code 呼叫。Task0020 仍 IN_PROGRESS，整體 V1 尚未完成；資格／條款、根 LICENSE／發布仍為外部決定。沒有 push／部署。
