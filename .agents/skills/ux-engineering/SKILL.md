---
name: ux-engineering
description: 處理 Reflection Lab Workspace、Inspector、FPS HUD、輸入仲裁、建造預覽與聲學路徑選取；先讀既有 UX 規格。
---

# UX 工程

## Trigger / Purpose

新增或調整 3D／分析操作時，維持模式、輸入與資料來源一致。

## Inputs

user flow、workspace、simulation state、selected ID、input focus、backend capabilities。

## Workflow

1. 讀 docs/05-ux 對應 flow／component／design system，避免無故重設 layout。
   tokens 以 Design System 指定的機讀檔為唯一值來源；依工作載入 `reflection-lab-design-system` 與已固定版本的 Emil Skills，不另建平行視覺系統。
2. workspace layout 與運算 state 分開，換頁不 reset；結構變動先 pause/revision。
3. focus 優先：typing/menu/gizmo 消耗輸入；進 pointer lock 的 click 不兼做投擲／放置；Tab 留鍵盤 focus、B 切 build。
4. preview/staged/enabled、hover/selected/held 分開；invalid placement 顯示原因；Esc/blur 清輸入並明示 pause/resume。
5. path/chart/inspector 共享 stable selection；只顯 solver 真實資料，缺 capability 給原因。
6. 不只依顏色／音訊傳達狀態；可鍵盤操作、reduced motion、可收合面板與安全初始音量。
7. 重要設計／互動變動用 `persistent-project-memory` 更新task／設計Wiki／來源與handoff；具體規格仍維護於 docs/05-ux，Wiki不複製tokens。

## References

`docs/05-ux/`、`docs/04-physics/INPUT_CONTROLS.md`、`docs/02-architecture/DATA_CONTRACTS.md`。

## Outputs

可驗收 flow／state transition／component、對應實際 runtime 的 UI；不得將研究 wireframe 稱已完成 UI。

## Validation

依 USER_FLOWS 手動跑 focus／pointerlock／取消／undo／capability cases；純視覺變更不新增照抄 CSS 的測試。

## Failure Handling

瀏覽器無 pointer lock 用無鎖定替代控制；錯誤不吞操作／不悄悄 reset。衝突規格回報並依最新 ADR 整合。
