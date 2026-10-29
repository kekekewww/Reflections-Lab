---
id: RLAB-KB-0008
title: 有效決策與取代規則
type: decision
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T18:08:03.674Z
sources:
  - RLAB-SRC-0052
  - RLAB-SRC-0053
  - RLAB-SRC-0054
  - RLAB-SRC-0055
  - RLAB-SRC-0056
  - RLAB-SRC-0057
  - RLAB-SRC-0058
  - RLAB-SRC-0059
  - RLAB-SRC-0060
  - RLAB-P3-SRC-0003
  - RLAB-P3-SRC-0004
  - SB-SRC-0011
  - SB-SRC-0014
  - SB-SRC-0015
  - SB-SRC-0001
  - SB-SRC-0037
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - decision
  - history
---

# 決策：保留理由與歷史

[正式ADR索引](../../../docs/02-architecture/ADR_INDEX.md) 與原ADR是唯一技術決策來源。原10份ADR的Accepted指preproduction工程建議，不是正式功能已實作，也不等於使用者接受新增產品範圍。

| ID | 採納內容 | 尚未驗證／可逆性 |
| --- | --- | --- |
| ADR-001/002 | 歷史Three方案，Rendering部分由ADR-011取代；Rapier固定步 | React整合待做；資料契約可換view/engine |
| ADR-003/004 | capsule FPS與bounded impulse grab | 真正牆角／高質量比／CCD仍NOT RUN |
| ADR-005/006 | Web有限ISM＋WebAudio，Steam native候選 | browser DSP未驗；Steam個別path不支援 |
| ADR-007/008 | versioned SI contracts、server Meta tools | schema不替代domain；帳號live未驗 |
| ADR-009/010 | motion trace A/B、HTTPS web部署建議 | 完整recorder／實際部署未做 |

新決策必記Context/Alternatives/Decision/Rationale/Evidence/Trade-offs/Status/Superseded By/Tasks/Commits；無commit填null。取代保留舊頁與原證據、雙向supersedes；測試舊新決策只存在隔離fixtures，不能誤當正式架構改變。


Phase3新增ADR-011（獨立作品、自製Web Acoustic Core、React/R3F view方向）與ADR-012（Codex統籌／Muse優先／獨立驗收／安全接手），是最新已確認需求的架構修訂。舊ADR-001保留原文與supersession。模型與功能仍依實際證據，不因ADR採納就宣稱完成。


目前角色政策為[ADR-013](../../../docs/02-architecture/adr/013-codex-primary-development.md)：Codex主導，取代ADR-012強制Muse優先／自動切回。舊Harness與75tests/19gate保留為Optional歷史，不是產品前置。新[ADR-014](../../../docs/02-architecture/adr/014-sound-behavior-system.md)採EventRules＋正交state＋Inspector／統一傳播，Graph P2；尚未產品實作。
