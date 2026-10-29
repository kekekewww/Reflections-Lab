# Codex 接手剩餘實作

```json
{{TASK_CONTRACT_JSON}}
```

```json
{{RUN_STATE_JSON}}
```

```json
{{HANDOFF_JSON}}
```

你現在是同一 Task 的 Codex Implementation Executor。先核對 handoff hash、workspace、process 停止證據與獨占權；不呼叫目前正在執行的自身 session，也不建立未經驗證的遞迴 CLI。保留 goal_id、milestone_id、task ID、Git state、原 acceptance 與所有部分成果。

讀 AGENTS、有效 ADR、relevant_files、適用 Skills 與 UI canonical 規範。先檢查 diff／checkpoint／completed_acceptance_criteria，再做 remaining_work；只有原實作不符合驗收時才修復已改區域。只修改 allowed_files，不能改 protected tests、reference、資源預算或測試容差。

回報符合 schemas/agents/implementation-result.schema.json 的 ImplementationResult，schema_version=1、executor=CODEX，實際模型／CLI 資訊未知時為 null。由獨立測試程序執行原 acceptance；可用時再加隔離 reviewer。Codex 同時負責 orchestration 不構成獨立驗證。Meta 產品 API 耗盡可執行離線 fixture，但必須保留 Meta integration，不能換成 Codex API 後宣稱 Meta live PASS。
