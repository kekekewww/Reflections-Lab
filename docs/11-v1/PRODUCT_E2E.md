# 產品鏈 Browser 驗收

目前直接證據：**固定 `22ca0c47…` 中文產品 bundle 的四個正式案例 4/4 PASS**，包含三次獨立乾淨 context 的完整產品鏈及 WAV 重連；A/B 數值母體缺陷已修正並在這輪驗證。[原始結果](../../artifacts/v1/product-e2e-chrome-20261027T033616Z/verification.json)與[逐案摘要](../../artifacts/v1/product-e2e-chrome-20261027T033616Z/suite-summary.json)保留實際版本與恢復次數。後續雙語、head／favicon及最終 UX 修補仍需重新固定 bundle 驗證；這份結果不自動涵蓋後續改動，也不代表性能或裝置聽測通過。

以下保留較早四輪診斷的原始失敗、單次功能結果與數值缺陷，不能用最後通過改寫歷史。Root 統一安排 source freeze 與互斥測試窗口。

原 cold Chrome／SwiftShader native 產品案例仍 **FAIL：錄製於 tick9 安全過載暫停，Grab 維持 disabled**。原始 [verification](../../artifacts/v1/product-e2e-chrome-20261027T021924Z/verification.json)、console／video／trace 與精確 tested bundle 均保留；該輪來源／bundle／Harness 前後一致。

同輪另發現 Playwright 的 cmd-hosted Vite preview teardown 卡住。只在核對 PID／parent／命令列後關閉自有 preview，CLI 才結束並封存結果；[清理證據](../../artifacts/v1/product-e2e-chrome-20261027T021924Z/cleanup.json)。Launcher 已改由 Node 直接擁有 preview、記錄 PID、限制總時間與清理期限，待新一輪驗證。

2026-10-27 第二輪：launcher 負例以「No tests found」得到預期 exit1，6.1秒結束且零 browser 啟動；[PID tree 清理](../../artifacts/v1/product-e2e-chrome-20261027T024030Z/owned-processes.json)為 PASS_ZERO_REMAINING。隨後新 v4 bundle 的 [實際 Chrome 案例](../../artifacts/v1/product-e2e-chrome-20261027T024059Z/verification.json)仍 **FAIL**：真正 readiness 已達 tick7、native clock0.541s、1 voice、5 fresh paths，但8次明示 recovery 用盡；Grab 成功後 Throw 在重複安全暫停時維持 disabled，尚未驗到 Impact／A-B／reload。錄製 run ID 與 revision 持續不變，停止於 tick78；這不等於完整 no-loss 驗收已通過。

第二輪 CLI／Chrome／ffmpeg／preview 正常關閉，Windows 原生 process-tree audit 核對零剩餘；source／bundle／Harness 前後一致。原 trace/video、recovery log 與精確 tested bundle 已保存。原始失敗 profile 固定使用 SwiftShader＋Playwright screenshots/video/DOM trace；其觀察成本與產品本身成本尚未分離，不把失敗推論為實體 GPU 的正式性能結果。

Root 已授權後續功能診斷先在 editor 以真正 native source／HRTF／delay／新鮮 solver 結果達到 readiness，再明確 Pause＋Reset，然後進 FPS 開始錄製。錄製過載可最多8次明確 UI Resume，逐次記錄 pause reason／tick／run ID；不得重設錄製、丟 tick、放寬 catch-up 或自動改產品政策。最終仍檢查全部 raw ticks 連續、epoch 不變與原有完整聲音／hash／A-B 斷言。這不解除 cold-start 或正式性能的量測責任。

第三輪 [observer-light／SwiftShader 診斷](../../artifacts/v1/product-e2e-chrome-20261027T025205Z/diagnostic-summary.json)停用持續 video／action screenshots，仍在8次 recovery 後 **FAIL**；保全原始68幀錄製與 hash，不能把部分 Grab 成功當成全鏈通過。實際 renderer 是 SwiftShader；active RAF gap p95=237.5ms，advance p95=43.5ms，bridge＋capture tick p95=10ms。精確時間核對後，其他 Node／storage 測試均未與該輪重疊。

第四輪只移除自訂強制 GL／SwiftShader flags，沿用完全相同的 `77ccfece…f5cdec` bundle、1440×1000／DPR1、observer-light、readiness 與全部腳本斷言。實際 GPU 為 RTX 4070 D3D11，功能腳本 **1/1 PASS（數值另待修復驗收）**：81幀 ticks4–84、epoch／ticks 連續、初始 tick 邊界精確、canonical SHA 與重載 hash 相同，恰1個 accepted Grab／Throw，無 recovery。active RAF gap p95=16.8ms／max33.4ms，advance p95=13.7ms，bridge＋capture tick p95=6.7ms。這是短功能診斷，不能當作正式效能 benchmark。

第四輪刻意沿用舊 bundle 以隔離 renderer 因素；目前來源已另修 Replay Inspector，因此 `sourceMatchesBuildAtStart=false`，launcher 的總 exit1 如實保留，原始 Playwright exit0 與1/1 PASS分列。該輪 bundle／Harness 前後一致，所有 browser／preview／CLI 零剩餘；[精確 tested bundle reference](../../artifacts/v1/product-e2e-chrome-20261027T030150Z/tested-bundle-reference.json)核對已封存的全部10檔 hash。舊 Replay Inspector 顯示限制不因此宣告修復。

後續[獨立數值審查](../../artifacts/v1/product-e2e-chrome-20261027T030150Z/independent-review.json)精確重算：A 平均包含118條 direct routes，排除兩條 fading／stopped source 的診斷路徑後只剩116條；兩種平均的差恰等於 UI 顯示的 B−A direct delay 差。B 重評只保留 playing source，造成母體不一致，不能歸因於材質。此缺陷由 metrics owner 修正 eligibility／方法／count 並加真實 Root 回歸後才進入最終三次驗收；不改原始診斷路徑或放寬容差。後續 Harness 額外保存 raw B／完整 comparison，供關閉 context 後獨立重算。

## 固定四案例的後續結果

2026-10-27 03:36 UTC 的 `22ca0c47490f3fc4e73e400cbd9d795b072c61e8e0dad6fa746955f0e9739d5a` build，在 Chrome／RTX 4070 D3D11、`light`／`default` profile 完成 4/4，零 skip／flaky；Playwright 與 wrapper exit 0，source／bundle／Harness 前後一致，10 個 bundle 檔已封存，自有程序清理為零剩餘。

三次主流程分別有 0／2／7 次明示安全恢復；82／106／116 個錄製 frame 都維持連續 tick、相同 epoch及可重算 hash。A／B direct metric 的母體分別為 115／115、144／144、152／152，材質改動的 direct-delay 差皆為 0。停止聲源的診斷路徑仍留在原始資料，但不再混入 playing-source 的統計母體。這支持固定版本的功能鏈與數值比較；多次恢復及所保存的高成本尾端仍是性能限制，不宣稱平滑播放或 10 分鐘預算通過。

## 實際入口

```powershell
node tests/browser/build-product-preview.mjs
node tests/browser/run-product-e2e.mjs
```

正常 CLI 預設使用 `light`／`default`，符合產品平常 GPU 路徑；亦可明示環境變數：

```powershell
$env:PRODUCT_BROWSER_CHANNEL = 'chrome'
$env:PRODUCT_OBSERVER_PROFILE = 'light'
$env:PRODUCT_GPU_PROFILE = 'default'
node tests/browser/build-product-preview.mjs
node tests/browser/run-product-e2e.mjs --grep 'clean launch'
```

`light` 保留 console、失敗截圖、source／API trace 與 timing，不做持續 video／DOM snapshots；`default` 只移除自訂強制 renderer flags，實際 renderer 仍以 WebGL 查詢為準。原生 API graph 與 clock 證據不等於裝置聽測。

需要重現原高觀察成本／軟體 renderer 時，明示 `$env:PRODUCT_OBSERVER_PROFILE = 'instrumented'` 與 `$env:PRODUCT_GPU_PROFILE = 'swiftshader'`。這些獨立 profile 的歷史失敗不會因正常 GPU 通過而改寫。Receipt 同時保存有效環境設定、實際 browser 命令列與 source／bundle hashes。

先探索一輪可傳 `--grep "clean launch 1"`；這不等於完整套件。四個正式案例包含三個獨立 Playwright browser context 的完整產品鏈，以及另一個空白 storage context 的原始 WAV 重連。

同一凍結 bundle 可另以已安裝的瀏覽器／engine 執行；每次只跑一項，避免干擾效能量測：

```powershell
$env:PRODUCT_BROWSER_CHANNEL = 'msedge'
node tests/browser/run-product-e2e.mjs
```

`PRODUCT_BROWSER_CHANNEL` 僅接受 `chrome`（預設）、`msedge`、`firefox`、`webkit`。Firefox/WebKit 仍須成功實際啟動及通過案例，不能因 cache 存在就列為驗證通過。獨立 engine 的結果與 Chrome/Edge 分開。

## 測試界線

- UI 真實操作：原創測試 WAV 的權利確認／匯入、啟用 native AudioContext 的 user gesture、免鎖定控制、Grab/Throw、Save/Load。
- 公開 Runtime API：場景／規則作者操作、capture、同運動 acoustic A/B、replay/seek、raw recording export。這些不冒稱為 Inspector 點擊驗收。
- 驗證原始 physics event ID → AudioEvent → 同 tick 接觸 emitter／AcousticFrame；native source 成功 start、實際 context clock 前進、Delay/HRTF 節點連至 AudioDestination。這是原生 API 與連接圖證據，不代表硬體聽測或 PCM 音質驗收。
- A/B 比對固定 motion／source hash、實際重新求解的 propagation 內容與不同 material hash；原 A artifact 不得被覆寫。
- 材質 B 的 direct-delay mean 必須精確與 A 相同；兩組 metric population 都需 logical playing source、相同非零 sample count 且 semantic query keys 相容。完整實際 Host comparison result 透過明示的唯讀測試 seam 取出，和 raw A／B 一起保存；不把這項 introspection 稱為 UI 操作。
- Save/Reload 必須恢復原始錄製 hash／已解碼資產；seek pose 需精確對應錄製 frame，resume 要建立新的 native sample source。
- 空白 storage context 先明確拒絕 missing WAV；錯檔不能觸發重連。精確原檔改名後仍保留原 ID／revision／SHA，套用前不污染目前專案。
- 完整 console/page errors、下載的原始 recording、畫面與失敗 trace 留存；不呼叫模型。

## 來源與證據保存

固定 preview 使用 `test-results/product-preview-dist`、port `5190`，由 run wrapper 直接啟動與關閉，不使用 cmd-hosted Playwright webServer。Build manifest 記所有 src/schema/config/lock inputs 與 bundle hashes；run wrapper 重新列舉檔案，檢查新增／刪除及內容變更，另保存 Harness 前後 hashes。每個 engine archive 都保存完整 build manifest。

原始執行輸出位於 `test-results/product-e2e*`；每輪另外保存到唯一 `artifacts/v1/product-e2e-<browser>-<UTC>`。`verification.json` 需同時核對 test exit、report freshness、source/bundle/Harness 穩定性。較早失敗證據保留，不用較晚結果覆寫。

10 分鐘效能另用 `node tests/browser/performance-profile.mjs --phase all --seconds 600`，詳見同目錄的 Browser performance 文件。Native nodes 不冒稱 AudioWorklet p99；裝置聽測／SPL／Meta live 保持獨立狀態。
# R17 維護入口補充

目前介面使用按需展開的配置，維護入口為：

```powershell
node tests/browser/run-product-refined-v3.mjs
node node_modules/@playwright/test/cli.js test --config tests/browser/linked-workflow-v2.config.ts
```

原始入口與 v2 來源保留。v3 只對未接納的 Grab 等候實際發布 tick，再有界重試；原共用八次恢復上限、Throw 及四案最終斷言不變。控制案例先重現舊流程及延遲接納問題，再獨立複驗；不從程序 exit 0 推性能或聽測通過。

[R17 整合](../../artifacts/v1/r17-browser-verification-20261029/verification.json)的四案已通過，包括原定義的三個獨立 browser context。另加兩個獨立瀏覽器程序：第二次四案通過，第三次在等待碰撞前耗盡恢復預算而三案通過、一案失敗；[原失敗](../../artifacts/v1/r17-three-clean-launches-20261029/verification.json)保留，不宣稱三個程序全通過。下文「三次乾淨啟動」原定義不變，沒有新增 OS 重開或三個不同 PID 的要求。

真實碰撞聲／錄製／A/B／reload 的 API 證據與真人聽測分開。低效能或觀察負載下仍可能安全暫停；完整 600 秒性能、實體輸入、裝置聽感與外部權利各列狀態。

