# 中斷恢復

先執行 [狀態 CLI](CODEX_MUSE_ORCHESTRATION.md)，閱讀 Run State／事件最後一筆、workspace lock 與保存的 handoff；不要重新初始化同一任務。比對 contract／acceptance hashes、workspace 路徑、Git revision 與保存內容，確認沒有未知 writer。已完成 criterion 與 remaining work 都依原證據延續。

保存的 partial edits 不能直接當成功 checkpoint；Codex 需檢查 diff，完成剩餘 scope，再跑原驗收。RepairTask 是對缺陷的具體回饋，不改 Task objective。相同 resume／COMPLETED task 應冪等；超過重試上限必須 BLOCKED。

執行程序崩潰留下 lock 時，不以 TTL 自動偷鎖。先確認原 PID／host／session 和後代程序停止；無法證明就保留 artifacts、停止新 writer，交由 host 操作者處理。Wiki 的 writer lock／transaction recovery 與 Harness workspace lock 是不同資源；[Wiki recovery](../09-knowledge/WIKI_OPERATIONS.md) 不代表可以解除 executor lock。

Git 尚無 HEAD 時，revision=null、status／檔案 hash／內容 snapshots 仍可接手；這不能重建不存在的 commit。不得以 destructive reset／clean 回復。如果驗收與實作外的檔案被修改，保留前後 artifacts，建立衝突與人可讀原因，不靜默覆寫。

Muse usage 重新可用時不立即中斷當前 Codex task；在已驗收 task 邊界或證明沒有 writer 的 checkpoint 重新選路。Codex 也不可用時保存、BLOCKED、停止消耗；不靠無上限重試等待恢復。
