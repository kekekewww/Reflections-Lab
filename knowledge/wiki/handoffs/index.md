---
id: RLAB-KB-0023
title: 交接入口
type: index
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-25T20:08:10.942Z
sources:
  - RLAB-SRC-0002
  - RLAB-SRC-0046-V2
  - SRC-CLAUDE-MEMORY-20261026
  - SRC-CLAUDE-SKILLS-20261026
  - SRC-CLAUDE-HOOKS-20261026
  - SRC-CLAUDE-SUBAGENTS-20261026
  - SRC-CODEX-AGENTS-20261026
  - SRC-CODEX-SKILLS-20261026
  - SRC-CODEX-HOOKS-20261026
  - SRC-CODEX-SUBAGENTS-20261026
  - SRC-CODEX-COMMANDS-20261026
  - SRC-PI-INSTALLED-README-V0-85-1
  - SRC-PI-INSTALLED-PACKAGE-V0-85-1
  - SRC-PI-INSTALLED-SKILLS-V0-85-1
  - SRC-PI-INSTALLED-EXTENSIONS-V0-85-1
  - SRC-PI-INSTALLED-LICENSE-V0-85-1
  - SRC-PI-MAIN-PACKAGE-20261026
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P0
  - handoff
  - startup
---

# 最新交接與恢復工作

新Agent先[Now](../now.md)→[Tasks](../tasks.md)，再看以下生成主index中最新type=handoff頁；每份CLI產生的handoff含task/agent/session/Git/實際scopehash/commands/evidence/risks/next。原始event不覆寫。

[完整handoff目錄](../index.md)與[時間log](../log.md)可定位最新記錄。沒有自動hook，不假設意外中斷前已保存；先讀status/pending transaction/檔案再接手。前一Agent命令文字本身不是測試成功證明。

跨Agent共同入口為rootAGENTS；Claude薄入口只引同份規範，Pi依已核版本支援方式讀相同文件。實際相容性與未跑native session部分見[compatibility](../../../docs/09-knowledge/AGENT_COMPATIBILITY.md)。
