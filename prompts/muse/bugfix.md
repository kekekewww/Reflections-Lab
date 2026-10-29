# Bug Fix 與 Regression

依據已凍結 Task Contract 修復可重現缺陷。

```json
{{TASK_CONTRACT_JSON}}
```

先讀 AGENTS.md、相關 ADR 與缺陷原始證據。先以失敗輸入重現，區分 expected／actual／環境問題，再找出因果；沒有重現時明示限制，不用猜測修補。只修改 allowed_files，保留 protected_files、原本 acceptance 與 benchmark truth。可在允許範圍新增 regression test，但不能刪除、skip、放寬容差或重寫既定驗收。

檢查相同狀態轉移或邊界的鄰近回歸，不擴張成無關重構。剩餘工作若已部分完成，先核對 diff 與 checkpoint，不重做。回報 ImplementationResult，附重現與修復後的實際命令／exit code、修改檔案、尚未驗證部分與已知限制。驗收判定由獨立程序負責；失敗保留診斷並交回 bounded repair loop。
