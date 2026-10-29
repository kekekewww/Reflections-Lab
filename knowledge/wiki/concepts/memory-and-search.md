---
id: RLAB-KB-0022
title: 記憶維護與搜尋邊界
type: concept
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-25T19:46:51.310610+00:00
sources:
  - RLAB-SRC-0002
  - RLAB-SRC-0047
  - RLAB-SRC-0048
  - SRC-QMD-README-MD-V2-8-3
  - SRC-QMD-PACKAGE-JSON-V2-8-3
  - SRC-QMD-LICENSE-V2-8-3
  - SRC-QMD-MAIN-README-MD-20261026
  - SRC-QMD-MAIN-PACKAGE-JSON-20261026
  - SRC-QMD-MAIN-LICENSE-20261026
  - SRC-QMD-MAIN-CHANGELOG-MD-20261026
  - SRC-QMD-MAIN--GITHUB-WORKFLOWS-CI-YML-20261026
  - SRC-KARPATHY-LLM-WIKI
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - wiki
  - query
  - search
  - qmd
---

# 編譯知識與查詢

原始source層保留證據，Wiki綜合現有研究／決策／狀態並交叉連結，schema約束更新流程。Query先index再相關頁，追溯source；有價值的新發現經驗證再寫入，而不是每次重做全庫研究。

本地CLI採詞彙搜尋與有限excerpts/citations；不呼叫embedding或LLM，不把分數當confidence。Agent須閱讀正文與來源後回答；自然語言問題不保證像RAG模型理解，使用中英關鍵字／IDs可提升查找。

[qmd評估](../../../docs/09-knowledge/SEARCH_ENGINE_EVALUATION.md)保留未來BM25/hybrid/MCP選項；本階段不安裝大型模型／vector database。任何自動lint都不能判斷所有語義矛盾或網路最新version，明確assertions與人工review互補。
