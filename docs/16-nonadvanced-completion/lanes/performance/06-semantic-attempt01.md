# 真瀏覽器語義 pilot：第一輪拒收保留

固定來源 bd64e4f 的實際執行未取得資格。原 V3 --formal-600 入口先以 V3_UNSUPPORTED_NATIVE_LAUNCHER_SHA256 退出 1，未執行 build 或 browser；沒有更換原 pin 取得 PASS。

新 55 秒 owned-child pilot 實際約五秒退出 1。頁面獨立 journal 驗證通過；原 strict native validator 拒收 RENDERER_TASK_SCHEMA_OR_CATEGORY，因此完整 native／journal oracle 也拒收，狀態為 UNVERIFIED_NOT_APPROVED。3,306 原事件、81,393 bytes gzip trace、834,926 decoded bytes 全數保留，trace dataLossOccurred=false。此失敗不是正式 600 秒效能失敗或通過，該正式 workload 尚未執行。

實際 Browser.getVersion 為 Chrome/156.0.8078.75，revision @861389936bf33ea77529ee5dcc0605e68f6bb620；可執行檔 SHA7c2fe7… 前後相符。i9-13980HX／32 logical CPUs、NVIDIA RTX4070 Laptop ANGLE D3D11、驅動與完整 browser commandLine 均在原始 native 收據。未請求音訊，sampleRate／hardware block／device route 為 null。

清理用時233ms；實際 browser disconnected、server listening=false、cleanupErrors=[]；原 RAF/cancel identity 均保留，pending0、CLOSED；wrapper process stopped=true，machineLeaseReleasable=true，已向 Root 釋放 exclusive。普通正常退出的 process_tree_stopped=null 沒有冒充 OS tree kill 證據，lease 依 child 的實際 owned browser/server 關閉證據釋放。

精確原始路徑、canonical copies 與 SHA 見 semantic-attempt01-receipt.json；semantic-attempt01/ 只保留本次原始檔副本。原 source-snapshot 仍位於 artifact 的 native 子目錄，17 個 source hashes 亦可由 bd64e4f 與凍結收據重建。下一步獨立 raw／官方 producer source 對照；不得直接放寬 V3 schema、容差或改測試換取 PASS。
