---
id: RLAB-KB-0033
title: Muse提示詞離線評測與Skills
type: experiment
status: VERIFIED
created_at: 2026-10-26T15:49:30.101Z
updated_at: 2026-10-26T16:08:58.309Z
sources:
  - RLAB-P3-SRC-0013
  - RLAB-P3-SRC-0014
  - RLAB-P3-SRC-0015
  - RLAB-P3-SRC-0025
related_tasks:
  - RLAB-TASK-0008
related_decisions:
  - ADR-011
  - ADR-012
supersedes: []
tags:
  - P1
  - prompts
  - offline
---

# Prompt評測基礎

[可重現benchmark](../../../benchmarks/muse/README.md)有TScomponent、physicsimpulse、acousticreflection、bugregression四類×direct/structured兩策略，固定獨立解析值與4個壞controls。這是手寫可信fixture，不是模型輸出；模型success/tokens/cost/latency均null，LIVE EVAL NOT RUN。

[templates](../../../prompts/muse/implementation.md)依TaskContract／domain／design safety縮小context；3個[產品runtime prompts](../../../prompts/runtime/experiment-agent.md)不給shell/repo權限，不生成求解數字。原Meta工具schemas維持。開發quota耗盡可做offlinefixture，不能宣稱Meta live完成。

5新Skills經真正Muse本機validate與Codex官方格式檢查各5/5；Muse project discovery看見23個projectskills，新增5個無diagnostics。既有8project+memory/design與8Emil原檔保留，未把vendor特殊欄位稱官方格式全通過。

評測器的emptyexports falsePASS與finiteoverflow負例已修正；原失敗與舊結果保留。最新fixture結果由本階段報告連結，不以它推論某prompt普遍較佳。
