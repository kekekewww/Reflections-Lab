---
id: RLAB-KB-0005
title: 正式路線導覽
type: roadmap
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T05:38:39.565Z
sources:
  - SB-SRC-0007
  - SB-SRC-0010
  - SB-SRC-0027
  - SB-SRC-0001
  - V1-SRC-0010
  - AR-WIKI-bdabc250-7903063a
related_tasks:
  - RLAB-TASK-0006
  - RLAB-TASK-0021
related_decisions: []
supersedes: []
tags:
  - P0
  - roadmap
---

# 正式路線與目前驗收

唯一正式路線是[docs/ROADMAP.md](../../docs/ROADMAP.md)，task JSON維護依賴／claim／criteria，Wiki不另建工期或backlog。最新授權已由研究轉為第一版實作；Scene／Physics／互動／Sound／Audio／Acoustic／UI／錄放／AI程式已落地，完整驗收尚未通過。

Task0011 M0已DONE，0006／0012／0013／0014沿原criteria收證；0016整體結案依賴0017物理／互動、0018聲學／Worker、0019錄放／資產、0020完整工具鏈／browser／效能。原日期與研究順序只屬歷史，不表示競賽仍開放或自動具提交資格。

下一步先解完整產品E2E錄製過載／測試觀測成本，補最新matrix與lifecycle、native輸入／zoom、跨browser及10分鐘profile，再乾淨安裝／完整check、持久記憶與Git。耳機聽測／本人資格／條款及發布決策另列，不以mock替代。[Now](now.md)提供最新可執行工作。


## 2026-10-29 研究後優先級

[正式Roadmap](../../docs/ROADMAP.md)新增P0/P1/P2排序，原十日表保留歷史。P0維持現有demo並處理Task0020錄製熱路徑／性能、100%真人FPS/IME與裝置聽測；200%已移除。P1逐一做producer能力投影、Motion registry與短take local mix/stems；P2再做高階聲學/ADM/cloud長render。下一個Codex工程切片為有界record evaluation lane，原criteria不變。

Task0021是本次獨立研究/整合/公開工作。原history含禁止產物，使用者已授權保留全部本地history、另建乾淨公開snapshot；需exact manifest、真small evidence closure、原始tests與完整安全scan，不把缺證據當PASS。
