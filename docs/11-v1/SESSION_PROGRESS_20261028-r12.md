# 第一版整合續報 r12：行為投影與 dev server 修復

本截點延續原 Task、51 項驗收與 `/goal`；第一版尚未完成。Codex 負責實作，沒有新增 Muse 或付費模型呼叫。最後正式矩陣仍為 [r6](REQUIREMENT_EVIDENCE_20261028-r6.md) 的 43 項範圍內 PASS／8 項 PARTIAL，本頁不將功能測試當作全部門檻通過。

## 產品與固定回歸

`BehaviorRuntime.getActiveRuleStates()` 已供 publication 讀取分離的 binding／active rule ID 陣列，完整 `snapshot()` 的 297 bytes 原樣保留。先凍結新增測試、確認缺 API 的 12 項 RED，再套用三個產品來源檔；原行為回歸與新增案例共 54 項 GREEN。目前格式化版本的完整 runtime 為 **931／931 PASS、0 FAIL、0 SKIP**，TypeScript、scoped lint 與格式檢查通過。[實作與獨立審查](../../artifacts/v1/active-rule-production-20261028/implementation-summary.json)保存來源與失敗紀錄。

完整 App views、checkpoints 與錄放結果等價。預設負載的 instrumented app full-snapshot 呼叫從 270 降至 51，大場景從 186 降至 0；對稱排除測試自己的 saved-method oracle 呼叫，且使用 audio=NULL／worker=false。這不是總 snapshot 數、速度、FPS 或 GC 改善證據。

## Dev server 修復

第一次當前 physics2 在模組載入時失敗，尚未進入數值斷言。Vite 掃到忽略目錄中的 extension HTML，遇到無法解析的 `chrome`；另有舊 cache rename 的 EPERM，原因仍未確認。[原始失敗](../../artifacts/v1/current-physics-guarded-20261027223458311/failure-seal.json)與 cache 均保留。

主 dev 設定改以 `index.html` 為明確掃描入口；physics 使用同一入口，僅複製主設定的 file-deny、不繼承 API proxy，並使用新的固定 cache namespace。原六項依賴、port、HMR、斷言與時限未改。persistence 經原有 merge 繼承入口及拒絕規則。依據見 [Vite entries](https://vite.dev/config/dep-optimization-options#optimizedeps-entries)；新 namespace 只隔離舊 cache，不證明 EPERM 根因或保證未來不再發生。

新增測試直接載入安裝的 Vite，使用隔離的假 extension、假金鑰與普通檔案，實跑 optimizer 與 loopback HTTP。修復前重現七個葉節點失敗；同一測試修復後 **26／26 PASS**，保留取消入口限制便掃到假 extension 的正向對照。沒有讀取或請求使用者實際金鑰。[RED／GREEN 與獨立審查](../../artifacts/v1/vite-dev-policy-repair-20261028/sealed-red-green/manifest.json)完整保存。

## Browser 整合

| 範圍 | 實際結果與證據 | 界線 |
| --- | --- | --- |
| UI | 原 [27 項 PASS](../../artifacts/v1/ui-active-rule-current-20261027T222013338Z/proof-receipt.json) | 最新 12 個 local 資源逐位元相同；未聲稱重跑 UI27 或新增全部 HTTP 覆蓋。 |
| Physics／lifecycle | [2 PASS](../../artifacts/v1/physics2-independent-file-review-20261027T225427312Z-r2/verification.json)，無重試或跳過 | 真 WASM 與十次 reset／import／dispose；software ANGLE，非效能。 |
| Storage | [5 PASS](../../artifacts/v1/storage5-independent-file-review-20261027T225814856Z/verification.json)，無重試或跳過 | IndexedDB fixtures，非全部產品流程。 |
| Product | [4 PASS](../../artifacts/v1/product4-build-independent-file-review-20261027T230526601Z/verification.json)，無重試或跳過 | Chrome 156.0.8078.48／default GPU／light observer；三個乾淨 contexts 共用一個 OS browser，另驗 WAV 原檔重新連結。 |

最新固定 build 為 170 inputs／12 資源，input digest `59439858b4e0039c8cda6a3104eb29d8b530b7d4f933ede2aa662c30fd5b9ae1`。[Local bundle 衍生關係](../../artifacts/v1/current-build-guarded-20261027225733263/optional-ui-bundle-byte-binding.json)與 [portable receipt](../../artifacts/v1/current-build-guarded-20261027225733263/portable-build-receipt.json)保留 manifest。各 physics、storage、build、product 的 1927 項全域來源與 61 個保護檔案於實跑前後一致，自有程序與連接埠已清理；後續文件變更不在其全域 hash 截點。

Product 的 native graph／logical intent 仍標 `NATIVE_CURSOR_PARTIAL`，沒有 PCM、聽測或 deadline 結論。既有 native25／IRv2 僅沿用於相同 DSP closure；[23／16／6 項核對](../../artifacts/v1/audio-active-rule-lineage-20261028/assessment.json)及獨立審查已保存。舊 global1781／1782 不當作當前全域證據。

## 量測、權利與下一步

R3 小型因果 trace 已錄到 native RAF／mark／RunTask，獨立核對原分箱與 occupancy 的 Float64 bits。這只支持後續獨立版本的量測工程，尚非正式 V3 資格，也沒有新跑 600 秒。原 profile 的 FAIL／UNVERIFIED／NOT RUN、V2 檔案與 raw 全部保留；不加 epsilon、不移窗口、不升格舊結果。

[Production build](../../artifacts/v1/production-active-rule-build-20261028/verification.json)已通過。[新聲明包](../../artifacts/v1/bundle-notice-pack-20261028-active-rule-r12/manifest.json)保存 173 項文字與六個原 gap records；[當前綁定獨立審查](../../artifacts/v1/bundle-notice-current-qualification-r12-20261028/qualification-seal.json)核對 12 個 production 資源，另補 `esbuild` 官方完整 MIT 文字來源子狀態，不代表 binary/source、native closure、再分發或根 LICENSE 已核准。

本頁發布截點的完整 `npm run check`／offline benchmark、英文最新差異及本輪 local Git checkpoint 尚待收尾；舊完整 917 項 check 不能代稱本輪 931 項版本。實跑後以新 receipt 與 Wiki 交接補記。

仍須取得原生 200%／Pointer Lock 直接證據、Hi-x65／D3V 實際聽測與裝置路徑、正式效能結果，以及權利／競賽確認。桌面解鎖是使用者回報；兩次 NativeV2 的 hidden 與 UI 工具初始化失敗不因此消失，不推斷 SessionID 或自動重試。產品 Meta live 的既有真實證據獨立保留，本輪不增加 request slots 或支出上限。
