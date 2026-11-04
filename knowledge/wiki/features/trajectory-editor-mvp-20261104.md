---
id: RLAB-KB-TRAJECTORY-EDITOR-20261104
title: 軌跡編輯器 hackathon MVP
type: feature
status: UNVERIFIED
created_at: 2026-11-03T20:44:31.904Z
updated_at: 2026-11-04T10:28:19.421Z
sources:
  - V1-PARAMETER-REFERENCE-20261104-V5
  - PUB-V1-FULL-TEST-PROCEDURE-20261104-V1-1b29bc127d54
  - PUB-TRAJECTORY-LIMITS-20261104-V2-8fa6ea68e59c
related_tasks:
  - RLAB-TASK-0034
related_decisions: []
supersedes: []
tags:
  - trajectory
  - editor
  - first-person
  - recording
  - hackathon
---


# 軌跡編輯器 hackathon MVP

使用者核准的設計見 [設計](../../../docs/superpowers/specs/2026-11-03-trajectory-editor-design.md)，實作計畫見 [計畫](../../../docs/superpowers/plans/2026-11-04-trajectory-editor.md)。正式參數與行為以 [參數參考§21](../../../docs/11-v1/PARAMETER_REFERENCE.md) 與程式＋測試為準；本頁只作索引。

## 內容

- 每個有聲音的物件（啟用的聲音行為綁定或聲源）可有一條軌跡，存在場景文件的 `trajectory` 欄位（相對起始位置的位移，最多 63 點），只經 `setTrajectory` 寫入，可復原。
- 編輯器：選取物件按 T 開關、Shift+T 顯示全部、Esc 結束；點擊表面加點（離表面「包圍半徑＋1 cm」）、拖曳選取點、Delete 刪點；Inspector 軌跡區編輯點、強度（0.5～20 m/s，預設 3）、起始延遲（0～30 s）、沿軌跡朝向。
- 第一人稱：Ctrl＋左鍵對準有聲音的物件起筆，房間回起始配置並凍結，玩家留在原地；放開 Ctrl 後仍可看與滾輪調深度（0.75～3 m）；放開左鍵提交，Enter 或點擊開始。
- 開始運算在 tick 0 才開始一段；錄製在已運算且有可執行軌跡時先回起始配置；走完依原模式交回物理，dynamic 帶強度速度；途中受阻在該處交回。最多 8 條同時執行，移動時間上限 30 s，碰固定幾何標示受阻不執行。
- 曲線：弦長節點的 Hermite 曲線；垂直方向 Fritsch–Carlson 限制不越過相鄰點高度（避免地板點下陷成受阻）；水平在貼牆平直段切線歸零，避免繪製的筆畫存成穿牆曲線，其餘維持平滑。
- 一段的重複性：場景修改後世界標為過期，下一次開始或錄製（有可執行軌跡時）先回起始配置，所以同一配置的各段逐 tick 相同；第一人稱繪製出無法執行的軌跡時以提示說明原因；複製物件不帶軌跡。

## 驗證

- 真瀏覽器：`node tests/browser/build-ui-preview.mjs` 後 `npx playwright test --config tests/browser/trajectory-editor.config.ts`（見 [完整測試程序](../../../docs/11-v1/FULL_TEST_PROCEDURE.md)）。
- runtime：`tests/motion/`、`tests/physics/path-physics.test.ts`、`tests/app/trajectory-runtime.test.ts`、`tests/interaction-runtime/paint.test.ts`、`src/ui/trajectory-ui.test.ts`。

## 限制

Muse 不能寫入 T 鍵繪製的曲線，但能提出 Motion 面板的路徑（先前本頁「不能寫入軌跡」的說法有誤）；見 [場景建構紀錄](../../../docs/00-project/MUSE_SCENE_BUILDER_20261104.md) 與 [Meta Agent](meta-agent.md)。

完整列表見 [已知限制](../../../docs/KNOWN_LIMITATIONS.md) 2026-11-04 段：尚未真人測試；繪製中不能走動；剛好軸向對齊的點形成尖角；靠牆稀疏點可能外凸標示受阻；暫停中修改場景後開始會重來一段；重播時曲線跟著重播姿態。
