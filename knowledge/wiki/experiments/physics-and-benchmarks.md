---
id: RLAB-KB-0014
title: 物理與微基準證據
type: experiment
status: VERIFIED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T17:52:34.881Z
sources:
  - RLAB-SRC-0040
  - RLAB-SRC-0039
  - RLAB-SRC-0028-V2
  - SB-SRC-0002
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - benchmark
  - validation
  - Rapier
---

# 驗證結果的可宣稱範圍

Rapier[不可變結果](../../../experiments/physics-spike/results/rapier-win64-20261025T192231997Z.json)保留source/lock/ESM/WASM hashes。6項smoke涵蓋freefall、gravity0、fixed→dynamic、force/impulse、contact與空場spring。不是collision-safe production grab／CCD壓測。

Phase1[總驗證快照](../../../benchmarks/results/phase1-validation-preserved.json)保留30個解析/契約test與其版本hash；後續依賴改版不得改寫此歷史。新的Phase2結果另存。Node direct/order2/EDC微基準的P95是batch平均分位，不是browser frame/audio deadline。

V0契約、V1限定解析；V2只有synthetic EDC/decay處理部分，V3獨立solver未跑，V4有本機微基準但browser尚缺，V5真實量測／聽測未跑。單位、tolerance、重跑步驟在[Benchmark Plan](../../../docs/06-validation/BENCHMARK_PLAN.md)。
