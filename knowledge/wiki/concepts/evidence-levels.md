---
id: RLAB-KB-0021
title: 證據、狀態與時間
type: concept
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T17:52:34.879Z
sources:
  - RLAB-SRC-0039
  - RLAB-SRC-0002
  - RLAB-SRC-0028-V2
  - SB-SRC-0002
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - evidence
  - V0
  - V5
  - provenance
---

# 計畫／實作／驗證不是同一件事

PROPOSED/ACCEPTED是決策狀態；IMPLEMENTED是程式存在；PASS是某個實際命令結果；V0–V5是驗證層級。VERIFIED Wiki page必須說明它究竟證實哪一種資訊，不用一個status概括所有功能。

V0 schema、V1解析/數值、V2DSP correctness、V3獨立solver、V4runtime/performance、V5perceptual/real-world。文件已讀不能升格runtime，Node微基準不能升格browser，合成RIR不能升格量測。

Measured/Computed/Estimated是結果來源；AI explanation只是文字。Measured/Derived/Tuned/Synthetic是材質來源，語義不同。時間分user事件／physics tick／acoustic job／audio sample/device輸出；60FPS不是audio callback預算。

task DONE要求每criterion有artifact及hash；CLI只檢存在/匹配，操作者還需讀stdout/exit/有效性。新版本要新驗證，不用舊報告給新code背書。source來源變動建立新version，重要矛盾保留conflict而不混合。
