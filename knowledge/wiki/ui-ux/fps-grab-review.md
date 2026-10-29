---
id: RLAB-KB-0017
title: FPS Grab開發與驗收導覽
type: design
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T17:52:37.412Z
sources:
  - RLAB-SRC-0017
  - RLAB-SRC-0018-V2
  - RLAB-SRC-0021
  - RLAB-SRC-0026
  - RLAB-SRC-0027
  - RLAB-SRC-0024-V2
  - RLAB-SRC-0043
  - RLAB-SRC-0044-V2
  - SB-SRC-0003
related_tasks:
  - RLAB-TASK-0006
related_decisions: []
supersedes: []
tags:
  - P0
  - FPS
  - grab
  - acceptance
  - UI
  - audio
---

# FPS Grab 情境：新Agent的最短閱讀路徑

1. [Physics Architecture](../../../docs/04-physics/PHYSICS_ARCHITECTURE.md)與[FPS Spec](../../../docs/04-physics/FPS_INTERACTION_SPEC.md)：bounded force/torque、排除held自身的shape queries、CCD限制。
2. [Input Controls](../../../docs/04-physics/INPUT_CONTROLS.md)與[FPS UX](../../../docs/05-ux/FPS_INTERACTION_UX.md)：E/G/throw/R/B、Tab焦點、IME、Esc/blur與Resume重驗。
3. [Design System](../../../docs/05-ux/DESIGN_SYSTEM.md)、[Components](../../../docs/05-ux/COMPONENT_SPEC.md)、[Emil配置](../../../docs/05-ux/EMIL_SKILLS.md)：HUD距離／阻塞／mode、錯誤恢復與有目的motion。
4. [Physics→Audio Events](../../../docs/04-physics/PHYSICS_AUDIO_EVENTS.md)與[Audio Runtime](../../../docs/02-architecture/AUDIO_RUNTIME.md)：continuous不因grab重啟、contact音在真實位置、voice caps、delay不雙算。
5. [UI Stress Matrix](../../../docs/05-ux/UI_STRESS_TESTS.md)與[驗證計畫](../../../docs/06-validation/BENCHMARK_PLAN.md)：各自測UI/physics/audio，不把Node數學當視覺測試。

驗收重點：超距不teleport、牆／薄牆／角落／高質量比不穿透、按住鍵失焦不續跑、Held切Build不暗中drop、Inspector打字不投擲、未取audio permission有可見恢復、pause截尾政策明示。view camera與measurement listener分開，FPS綁定為顯式動作。

本情境是閱讀／驗收模擬，沒有在Phase2實作Grab或宣稱browser通過。相關P0先後依賴見[正式roadmap](../../../docs/ROADMAP.md)。
