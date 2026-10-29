---
id: RLAB-KB-0012
title: 資料集與權利界線
type: research
status: VERIFIED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-27T02:52:29.193Z
sources:
  - RLAB-SRC-0011
  - RLAB-SRC-0037-V2
  - RLAB-SRC-0013
  - V1-SRC-0008
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - dataset
  - license
---

# 資料來源不等於可再散布

[DATASET_CATALOG](../../../research/datasets/DATASET_CATALOG.md)評估9項RIR/HRTF/impact資料，未下載真實音訊。repository code license不能套到dataset，SOFA只是格式；dEchorate/RealImpact部分外部檔權利仍UNKNOWN。

取得工具預設dry-run，需逐檔VERIFIED license、固定URL/size/hash、host與50MB上限；mock測試17PASS/1junction SKIP不是ACQUIRED或V5。[腳本限制](../../../experiments/dataset-fetch-spike/README.md)包含signed URL/CDN不支援與本地TOCTOU非sandbox保證。

Steam主要Apache不代表官方binary只有Apache；IPP/CIPIC等條款另記。Emil MIT副本與來源hash保留，不把Gist/qmd未查清的授權當作可任意複製。每次再散布前重新檢實際資產組合。


第一版新增Web依賴已建立[精確license inventory r2](../../../docs/01-compliance/V1_DEPENDENCY_LICENSE_INVENTORY-r2.json)與[第三方聲明](../../../docs/01-compliance/V1_THIRD_PARTY_NOTICES.md)，199 lock entries／149 installed／50 optional omitted；授權檢查不代替使用者決定根LICENSE。Synthetic builtin實際PCM與使用者本機WAV有pins／rights流程，未因此宣稱外部研究dataset已ACQUIRED。
