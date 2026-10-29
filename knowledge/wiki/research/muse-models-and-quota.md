---
id: RLAB-KB-0031
title: Muse模型額度與Prompt研究
type: research
status: VERIFIED
created_at: 2026-10-26T15:49:19.315Z
updated_at: 2026-10-26T15:49:44.460Z
sources:
  - RLAB-P3-SRC-0008
  - RLAB-P3-SRC-0009
  - RLAB-P3-SRC-0010
  - RLAB-P3-SRC-0011
  - RLAB-P3-SRC-0019
  - RLAB-P3-SRC-0020
related_tasks:
  - RLAB-TASK-0008
related_decisions:
  - ADR-011
  - ADR-012
supersedes: []
tags:
  - P1
  - Muse
  - quota
  - DOC_REVIEWED
---

# 官方研究與實際額度分開

[模型比較](../../../docs/09-agents/MUSE_MODEL_RESEARCH.md)、[Prompt指南](../../../docs/09-agents/MUSE_PROMPT_ENGINEERING.md)、[routing](../../../docs/09-agents/MODEL_ROUTING.md)、[額度研究](../../../docs/09-agents/QUOTA_RESEARCH.md)固定官方URL／版本／條件；已閱讀原文，不是模型實測排名。來源metadata在research/agents。

本機Muse1.4.13、Codex0.163.0；真正Muse echo 15 JSONL events可解析，不是模型實作。usage查詢transient failure，原API觀察UNKNOWN；隨後使用者明確確認Muse無可用額度，採USER_CONFIRMED exhausted、停止模型派送。沒有把此資訊推成產品API餘額。Codex app唯讀快照weekly已用7%／剩93%，只在觀測時間有效；沒保存account/credits IDs或重設額度。

429 bounded retry；402billing、401authentication、403permission、5xx/outage、明確quota分開。MSP typed quota與rawexec失敗shape不能混用；未取得rawexec quota-stop實例時UNKNOWN，不猜所有錯誤是quota。Provider credit／subscription／rate headers不可互抵。

[Headless／SDK](../../../docs/09-agents/HEADLESS_EXECUTION.md)CLIhelp與schema有證據；SDKruntime、模型prompt成效、實際quota-stop恢復與產品Meta live NOT RUN。
