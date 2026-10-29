---
id: RLAB-KB-0009
title: 互動沙盒功能狀態
type: feature
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T13:59:04.320Z
sources:
  - RLAB-SRC-0001
  - RLAB-SRC-0017
  - RLAB-SRC-0018-V2
  - RLAB-SRC-0019
  - RLAB-SRC-0021
  - SB-SRC-0003
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0025
  - V1-SRC-0031
  - V1-SRC-0038
  - V1-SRC-0039
  - V1-SRC-0053
  - V1-SRC-0062
  - V1-SRC-0064
  - V1-SRC-0069
  - V1-SRC-0073
  - V1-USER-TEST-20261029-R18
related_tasks:
  - RLAB-TASK-0006
  - RLAB-TASK-0016
related_decisions:
  - ADR-002
  - ADR-003
  - ADR-004
supersedes: []
tags:
  - P0
  - FPS
  - grab
  - throw
  - build
---

# 互動沙盒：實作與分項驗收

正式Scene editor、真Rapier固定步、FPS simulation／build、四body modes、有界grab/drop/throw與分階段placement已實作。權威仍為[Physics](../../../docs/04-physics/PHYSICS_ARCHITECTURE.md)、[FPS](../../../docs/04-physics/FPS_INTERACTION_SPEC.md)與[Inputs](../../../docs/04-physics/INPUT_CONTROLS.md)。gravity=0仍dynamic，不parent至camera；失焦／Esc先pause清輸入，Held／ghost保留，Resume重驗身份與clearance，staged需explicit Enable。

[R17直接證據](../../../artifacts/v1/r17-integration-progress-20261029/verification.json)保存刪除選取清空的RED→GREEN；原有效stable ID不因前列刪除而改選。真canvas物件／聲線、事件篩選與插入、規則Apply／Undo及原UI／FPS28已驗，聲學不可用顯示原因，舊參考不變。當前175／14build與完整產品4通過；額外第三browser程序OnImpact等待超過原8次恢復的FAIL仍保留，不能稱三程序全通過。

使用者當時的[基礎回報](../../../artifacts/v1/basic-user-feedback-20261028/feedback.json)確認有聲、方向、重力與反彈，但FPS入口失敗及UI說明過多。其後已修非同步進入／取消／blur／Esc、第一使用入口與面板預設；仍需正常100%實體重測，headless用例不能代替實體Pointer Lock／IME／裝置聽測。原生200%依明確要求移除。

[物理驗收](../../../docs/11-v1/PHYSICS_ACCEPTANCE.md)、[錄放](../../../docs/07-experiments/RECORD_REPLAY.md)及[固定第一版驗收](../../../docs/11-v1/ACCEPTANCE.md)各自保留範圍。數學／WASM／browser／聽測／性能分開，當前正式長測已保存負面結果，完整結案仍待真人；歷史收據以各自來源／Git截點為準，不累加舊計數推整體通過。

R17最後判讀：[REQUIREMENT_EVIDENCE_20261029-r17.json](../../../docs/11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json)保存逐條原要求與Root／隔離review。當前600秒資料完整但性能與持續負載FAIL；未回填窗外收尾。完整功能檢查、當前browser及R6無聲資格通過；下一步正常100%實體輸入與裝置聽測，完整V1未完成。

## 2026-10-29真人回報：第一人稱失敗，限定第1至8節的未提及項目

[原始回報與範圍紀錄](../../../docs/11-v1/USER_TEST_FEEDBACK_20261029-r18.json)：進入第一人稱後無法移動或操作，是使用者回報的阻斷問題，根因尚未診斷。後續第一人稱相關操作（含抓投、建造及FPS聽測）均BLOCKED／未能測試。材質與反射明示NOT TESTED，不標成功。預設聲音太小；場景無法直接點選選取、拖曳及縮放等，控制不直覺，均保留為待處理回報。

依使用者明確規則，僅第1至8節未提及且未受上述失敗／排除影響的項目記為「使用者回報未發現問題」；不是整批PASS、獨立重現、科學或裝置驗證。第9節錄放、第10節A/B、第11節儲存匯入匯出、第12節離線助手及其他範圍不標正確完成。實測bundle／裝置路徑／DAC／音量未提供，保持UNKNOWN。舊自動測試證據保留，不能覆蓋這次真人失敗。

本次只紀錄，未修程式、未啟動測試、未恢復本對話已暫停的開發goal；Task0021的既有研究／整合狀態不變。恢復產品工程時，先調查第一人稱阻斷，再處理直接操作與預設音量；不能再只把FPS列為等待首次真人測試。
