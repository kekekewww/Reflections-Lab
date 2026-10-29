# 實作交接

```json
{{TASK_CONTRACT_JSON}}
```

```json
{{RUN_STATE_JSON}}
```

停止派送新工作；現有 process 必須確認已停止才能交出工作區。保存部分修改、session log、Git diff／未追蹤檔案清單與 hash、checkpoint、已完成驗收及未完成工作。未知 Git HEAD 填 null，不能編造 commit；不要存 API key、認證 token 或私人推理。

交接需記 task／goal／milestone／run ID、preferred／actual／previous executor、model／CLI version、fallback reason 與可得的 resource usage。以實檔與證據確認完成範圍，不把自述當驗收。標出哪些 acceptance 尚未執行、哪些 live tests 因 provider／額度不可用而 BLOCKED。

交出 serializer 需要的資料給 Orchestrator，由持久 run state 和既有 Wiki task 保存進度。不得自行清除 lock、reset、重建 Task 或在舊 executor 可能還在寫入時啟動新 executor。
