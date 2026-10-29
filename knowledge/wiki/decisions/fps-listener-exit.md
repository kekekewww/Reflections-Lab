---
id: RLAB-KB-0024
title: FPS退出Listener與可選動作的整合決策
type: decision
status: ACCEPTED
created_at: 2026-10-25T20:06:44.646Z
updated_at: 2026-10-25T20:08:01.667Z
sources:
  - RLAB-SRC-0002
  - RLAB-SRC-0018-V2
  - RLAB-SRC-0023-V2
related_tasks:
  - RLAB-TASK-0004
related_decisions:
  - ADR-003
supersedes: []
tags:
  - UX
  - FPS
  - listener
  - conflict-resolution
---

# FPS Listener 退出政策整合

Phase 2 獨立審閱發現 Workspace 舊文要求保留最後位置，Physics FPS 規格則要求還原 saved ScenePinned。原文節錄／hash保存在 [Conflict Record](../../conflicts/e12dc748-94fd-4ab2-b9d8-72808a5b1749.json)，沒有把相反文字默默混合。

工程整合決定：使用者選 FollowPlayer 時保存原 ScenePinned pose；真正退出 FPS 預設還原、velocity=0並標 discontinuity。普通 Scene/Analysis 觀察相機不改實驗 listener；若要用最後視角作新量測點，需顯式且可撤銷的 move-listener command。理由是維持 measurement listener 與 observer 的既有邊界，避免退出模式成為隱藏變因。

同次將 jump/crouch 統一為可選P2，符合原需求「可選」與UX已排除MVP的規劃。這是本次代理在授權範圍內的工程整合，不宣稱使用者另行選過這個預設，也沒有實作或測得browser行為。

Context/Alternatives：保留最後位置較方便探索，但會默改量測條件；保存原位置較可預測，保留顯式command作替代。Trade-offs：退出會跳回原listener，UI須提示與ramp；Risks：renderer discontinuity與tail仍需實測。Status：ACCEPTED for specification；Superseded By：無；Related task：RLAB-TASK-0004；Commit：null（尚無HEAD）。

唯一具體規範：[Physics FPS](../../../docs/04-physics/FPS_INTERACTION_SPEC.md)、[Workspace](../../../docs/05-ux/WORKSPACE_ARCHITECTURE.md)。
