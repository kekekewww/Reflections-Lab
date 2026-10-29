---
id: RLAB-KB-0004
title: 目標與授權範圍
type: goals
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T05:38:39.567Z
sources:
  - RLAB-SRC-0001
  - RLAB-SRC-0002
  - RLAB-P3-SRC-0018
  - SB-SRC-0001
  - SB-SRC-0007
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0005
  - V1-SRC-0010
  - V1-SRC-0011
  - V1-SRC-0012
  - AR-WIKI-bdabc250-7903063a
related_tasks:
  - RLAB-TASK-0016
  - RLAB-TASK-0021
related_decisions: []
supersedes: []
tags:
  - P0
  - scope
---

# 目標、授權與成功條件

最新[使用者授權](../../docs/00-project/V1_IMPLEMENTATION_REQUEST.md)要求Codex直接實作直到第一版完成，包含適當測試、獨立審查、Wiki、交接及Git紀錄，不使用Muse額度。先前research/preproduction限制屬歷史階段；原始研究與來源仍保留，不能冒充正式產品證據。

主範圍為互動3D物理、可追溯聲學與空間音訊、自由Sound Behaviors、Inspector、資產與錄放／A-B、受驗證Meta工具。[完整固定驗收](../../docs/11-v1/ACCEPTANCE.md)有51項，原61份protected contracts/tests不放寬；不可將成功縮成M0、offline或文件完成。Graph、modal、wave／diffraction與高階動態反射仍是P2。

Meta本次Live總授權US$1，預設app gate0、共享ledger有界；[授權與限制](../../docs/00-project/META_API_VALIDATION_AUTH_20261027.md)。Muse Code可用是另一資源資訊，不變更Codex主導。一般可逆工程自主推進；不推送、部署、接受條款或替使用者決定根LICENSE。

完成須以實際程式、可重現測試、獨立驗證與來源紀錄支撐；聽測／裝置／競賽身分及條款不得虛構。現況看[Now](now.md)；完整產品驗收尚未完成。


2026-10-27使用者新增[英文版本需求](../../docs/00-project/V1_ENGLISH_VERSION_REQUEST_20261027.md)。目前工程範圍為繁中預設＋可切換英文介面及英文使用說明，範圍澄清待使用者補充；原第一版與51項固定驗收持續。語言切換不得改domain state、數值、權限或模型來源。實作及英文browser證據尚未完成。


使用者已進一步明確選擇「介面＋所有專案文件」，取代僅使用說明的預設範圍；[完整範圍](../../docs/00-project/V1_ENGLISH_FULL_DOCS_REQUEST_20261027.md)。英文介面與docs/en全套可追溯翻譯正在準備，繁中canonical與task／schema／測試資料共用，沒有第二套任務系統；未完成翻譯或新bundle驗證前不宣告完成。


## 2026-10-29 新授權研究與公開範圍

使用者授權獨立worktree全面研究、最小架構微調、驗證、安全merge及push至kekekewww/Reflections-Lab；原V1與歷史保留。因完整原history含三個>100MiB及禁止產物，另[明確授權乾淨公開snapshot](../../docs/00-project/ARCHITECTURE_REVIEW_AMENDMENTS.md)，保留全部本地branches/commits，不自動LFS/rewrite原歷史。當前執行權威為[Task0021](../tasks/RLAB-TASK-0021.json)，原性能/真人/科學/外部門檻不因此解除。
