# 第一版整合 checkpoint r5：當前功能驗收通過

日期：2026-10-27。完整 goal 仍進行中，原 51 項與 EN01–06 不變；**第一版尚未完成**。本機 Git 恢復點仍為 `f006b0e60db18450bdfcbcf22d790b9913724b1e`，後續修補及證據待最後品質檢查後保存，沒有 push／部署。開發 Muse Code 與新增付費 Meta 呼叫均為零。

## 當前固定版本的直接結果

當前 Web 輸入 digest 為 `0eefc158d5d2ee1a2a9f75ec42340867c99373ec287dcb71d100a6f05bd86d1e`。所有以下結果都保留原失敗，不以新成功覆寫歷史。

- [UI 27 案與 91 份 payload](../../artifacts/v1/ui-reflow-functional-20261027T122600892Z/proof-receipt.json)：英文 8、原繁中 13、聲音診斷 2、靜態 3D 預聽 2、原生音訊拒絕來源 2 全部通過，0 skip／flaky／retry，五個 CLI exit 0。1677 個輸入前後完全相同；獨立重算所有 payload、12 個 bundle 與輸入 digest 相符。已知自有測試程序及 5174 清空。
- [物理 browser 2 案](../../artifacts/v1/physics-acceptance-20261027/browser-20261027124437715/browser-verification.json)及[實測](../../artifacts/v1/physics-acceptance-20261027/browser-20261027124437715/browser-measurements.json)：四 modes 的真 PhysicsWorld、固定步、impulse、gravity／fixed 轉換與 pause；十次 reset／import／dispose，48/48 World 與 Queue、16/16 Worker 釋放，受監測 GPU 資源與 pending RAF 歸零。171 個輸入前後相同。這是本機 Chrome／software ANGLE 正確性證據，不是硬體 GPU 效能或 JS heap 歸零。
- [Storage 5 案](../../artifacts/v1/storage-browser-20261027124706133/verification.json)：真 IndexedDB、重載、跨 tab 原子衝突、caps／tamper 與 builtin PCM，全數通過；1677 個輸入前後相同、清理完成。
- [完整產品 4 案](../../artifacts/v1/product-e2e-chrome-20261027T125130Z/verification.json)及[封存](../../artifacts/v1/product-final-operation-20261027T125130280Z/final-proof.json)：真 throw／impact／native graph／capture／acoustic B／持久化重載與 Replay，另有空儲存區 missing／wrong／正確 WAV relink。三次乾淨 page/context 使用同一個實際 Chrome 程序，不能稱三次 OS 程序重啟。錄製各 88／68／68 連續 frames，明示 recovery 1／1／2；direct A/B delta 精確為零且使用相容的 120／100／98 sample pairs。來源、bundle、harness 於執行前後相符；實際 Chrome 156.0.8078.48、NVIDIA RTX 4070 Laptop／D3D11，1440×1000／DPR1。沒有模型請求；logical／native cursor 仍保留原分項限制，不宣稱 PCM、聽測或性能通過。

## 縮放修補與仍未通過的原生視窗驗收

[CSS 修補及獨立 review](../../artifacts/v1/reflow-repair-20261027/independent-review.json)只新增一個呈現用內容 wrapper，保持常駐 Monitor 在捲動區外，工具列不壓縮；沒有修改 runtime／controller／原斷言或 44px critical target。

[候選幾何結果](../../artifacts/v1/reflow-diagnostic-candidate-2026-10-27T121936924Z/summary.json)及[獨立稽核](../../artifacts/v1/reflow-repair-20261027/candidate-independent-review.json)：兩個 CSS viewport、14 次焦點與 28 次常駐 Mute／gain 觀察全數完整可見、中心未遮擋，Mute 高度 44px 且 Y 不變。169 個來源及 12 個本機 bundle 前後相同；12 個 HTTP 資產只在案例前取樣一次。這不是原生 200% 或 OS 鍵盤證據。

[原生 0eef 重驗](../../artifacts/v1/native-zoom-reachability-2026-10-27T12-29-14.620Z-46c584ed/summary.json)仍 FAIL：兩案實際 `hidden:true`、`focused:true`，控制檢查零完成；200% API／DPR／712px 正確但 Tab 未抵達，320px 工作流程逾時。前者還原 1×，後者還原未完成；兩個自有 browser 已關閉。這些觀察尚不足認定產品原因。舊版本確曾原生取得 lock 並暴露真正版面缺陷，其失敗亦保留。

V2 驗證器正保留四份原腳本及全部原斷言，改為先以官方 Chrome API 啟用精確擁有的 tab/window，再要求實際 visible／非 hidden／focus，才允許鍵盤。Mock 只驗前置條件，不能宣稱實際 API 或原生縮放通過；下一步僅配置一輪有原因依據的實際重驗，不用 flags、焦點模擬或放寬門檻。

## Task 與下一步

[正式 Task 結案紀錄](../../artifacts/v1/functional-task-closures-20261027.json)依原 criteria／dependencies 將 Task0006、0017、0019 完成並釋放 claim；Task0020 已認領、仍 IN_PROGRESS。Task0012 的人工聽測與後續依賴沒有假完成；其餘依原證據繼續推進，不建立第二套 task。

接著完成 V2 的獨立審查／唯一實際原生重驗，再清空所有自有負載執行真正 `--phase all --seconds 600`。正式性能尚未執行；不得以 CLI exit 0、109 項 helper 測試或 UI 流暢推性能成功。原 Worklet deadline／underrun 與完整 canonical delivery 的未量部分繼續明示。

使用者已回報耳機 Austrian Audio Hi-x65、喇叭 ADAM Audio D3V；實際聽測仍 NOT RUN，裝置輸出路徑、context rate、實際 block 與主觀觀察尚未取得，不能預填 128 frames／硬體 latency／SPL。待性能結束再準備具體聽測頁。正式文件、全部英文 freshness、逐項證據、最新 handoff 與本機 Git 仍需最後收斂。真 Meta 最小 Sound 切片沿用原 PASS，US$1 授權的三次請求已用完，不再呼叫；本人資格／條款與根 LICENSE／發布決定各自保留。
