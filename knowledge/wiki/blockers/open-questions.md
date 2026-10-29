---
id: RLAB-KB-0020
title: 待查條件與實作限制
type: blocker
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-27T02:52:31.707Z
sources:
  - RLAB-SRC-0032
  - RLAB-SRC-0011
  - RLAB-SRC-0014
  - SB-SRC-0006
  - SB-SRC-0008
  - SB-SRC-0001
  - V1-SRC-0009
related_tasks:
  - RLAB-TASK-0007
related_decisions: []
supersedes: []
tags:
  - P0
  - blocker
  - NOT-RUN
---

# 限制與解除方式

正式限制以[KNOWN_LIMITATIONS](../../../docs/KNOWN_LIMITATIONS.md)為準。第一版已有正式runtime與分項證據；以下分開內部待驗與外部門檻，不能再把所有工程工作寫成尚未實作。

| 類型 | 現況與解除條件 |
| --- | --- |
| 產品驗收 | 完整產品Chrome鏈兩次安全pause未完成，仍需測試觀測成本定位、三次乾淨啟動、跨browser、native輸入／zoom、10分鐘profile與乾淨安裝／完整check。這些仍可自行推進。 |
| Meta Live | 真Sound兩類proposal／Host Apply／本機Run已獨立驗收；Scene Live／Meta規劃Run／UI Live未通過。US$1總授權內3請求已用完，不再呼叫。實際billing與餘額未知。 |
| 音訊／科學 | 99 Node／25 Native有限DSP證據不代替實際耳機聽測、underrun、裝置latency、完整ISO大氣reference／真房間／獨立solver。native nodes不能冒稱AudioWorklet p99通過。 |
| 競賽／權利 | 本人資格、登入後條款／表單、根LICENSE與發布決策仍由使用者處理；開發驗收不等於合規或提交。 |
| 資產 | Synthetic builtin有實際PCM／hash，外部匯入需逐檔rights receipt與pin；不能把code license套到資料集。 |
| 記憶／歷史 | 無Session Hook，claim只是同checkout合作lease；必須CLI／Git reconcile。未封存完整copy／Git blob的中間版本不能由hash重建；首次Meta400原始body亦未保存。 |

Task只在實際等待外部條件時BLOCKED；尚有可完成工程則繼續。最新[進度與證據](../../../docs/11-v1/SESSION_PROGRESS_20261027.md)，不以模組PASS宣告第一版完成。
