---
id: RLAB-KB-0016
title: 設計工程與唯一規範
type: design
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T13:59:04.321Z
sources:
  - RLAB-SRC-0042-V2
  - RLAB-SRC-0025
  - RLAB-SRC-0043
  - RLAB-SRC-0044-V2
  - RLAB-SRC-0045
  - RLAB-SRC-0023-V2
  - RLAB-SRC-0061
  - SB-SRC-0020
  - SB-SRC-0001
  - V1-SRC-0011
  - V1-SRC-0012
  - V1-SRC-0054
  - V1-SRC-0055
  - V1-SRC-0069
  - V1-SRC-0070
  - V1-SRC-0071
  - V1-SRC-0073
  - V1-USER-TEST-20261029-R18
related_tasks:
  - RLAB-TASK-0004
related_decisions: []
supersedes: []
tags:
  - P0
  - design
  - Emil
  - UI
  - UX
---

# 設計工程與當前驗證

唯一具體權威為[DESIGN_SYSTEM](../../../docs/05-ux/DESIGN_SYSTEM.md)、[Tokens](../../../docs/05-ux/DESIGN_TOKENS.json)、[Component](../../../docs/05-ux/COMPONENT_SPEC.md)、[Motion](../../../docs/05-ux/MOTION_GUIDELINES.md)及[Stress Tests](../../../docs/05-ux/UI_STRESS_TESTS.md)。此Wiki不複製token值或Component表。依[專案Skill](../../../.agents/skills/reflection-lab-design-system/SKILL.md)及[固定Emil來源](../../../docs/05-ux/EMIL_SKILLS.md)工作，沒有自行升級來源。

使用者明確偏好Emil方向：場景及主要操作優先、技術說明按需展開、清楚層級、可調面板、立即回饋與克制動態。三Workspace不重置世界／audio／recorder，Contextual Inspector及scene/path/event共享stable IDs。高頻操作即時，不強迫轉場；動態遵守目的、頻率、中斷、成本與reduced motion，physics／audio clocks獨立。

[R17整合](../../../artifacts/v1/r17-integration-progress-20261029/verification.json)已修物件刪除誤選、實際真空結果錯顯Computed、回放環境標籤及歷史path失效提示。原no-result／available-empty runtime形狀不改，唯讀共用presentation在三處顯示不同原因，不生成示意聲線或把null改0。新版連動8與原refined UI／FPS28真browser通過；Root也實看錯誤畫面並以同份強化oracle先RED後GREEN。程式碼檢查／像素截圖／實體輸入／音訊／性能各自限定，不以計數宣稱完整V1。

英文範圍已明確為[介面＋所有專案文件](../../../docs/00-project/V1_ENGLISH_FULL_DOCS_REQUEST_20261027.md)；繁中canonical、英文可追溯譯本，task／schema／測試資料共用，沒有第二套系統。最新文件需持續以manifest current／stale核對。正常100%真人FPS／IME及Hi-x65／D3V聽測仍未做，原生200%不再是門檻。

維護入口已更新於[產品browser驗證](../../../docs/11-v1/PRODUCT_E2E.md)：使用reviewed v3產品流程及v2連動案例，原始與v2來源保留。原正式四案定義為三個乾淨browser contexts＋空白store重連；額外多程序加驗的FAIL另存，不增加或豁免原固定門檻。


R17範圍補充：[獨立原文判讀與英文原始證據分類](../../../artifacts/v1/r17-english-scope-20261029/verification.json)確認原正式三次為乾淨app/browser contexts，當前四案中的三條產品鏈已通過；額外多程序FAIL及過載限制不改為成功。英文只為一份實際失敗context／report增加精確immutable pin，Root39契約通過，不翻譯raw、不擴大 authored 文件排除。全清冊finalize與完整check／正式600秒仍待執行。

R17最後判讀：[REQUIREMENT_EVIDENCE_20261029-r17.json](../../../docs/11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json)保存逐條原要求與Root／隔離review。當前600秒資料完整但性能與持續負載FAIL；未回填窗外收尾。完整功能檢查、當前browser及R6無聲資格通過；下一步正常100%實體輸入與裝置聽測，完整V1未完成。

## 2026-10-29真人回報：第一人稱失敗，限定第1至8節的未提及項目

[原始回報與範圍紀錄](../../../docs/11-v1/USER_TEST_FEEDBACK_20261029-r18.json)：進入第一人稱後無法移動或操作，是使用者回報的阻斷問題，根因尚未診斷。後續第一人稱相關操作（含抓投、建造及FPS聽測）均BLOCKED／未能測試。材質與反射明示NOT TESTED，不標成功。預設聲音太小；場景無法直接點選選取、拖曳及縮放等，控制不直覺，均保留為待處理回報。

依使用者明確規則，僅第1至8節未提及且未受上述失敗／排除影響的項目記為「使用者回報未發現問題」；不是整批PASS、獨立重現、科學或裝置驗證。第9節錄放、第10節A/B、第11節儲存匯入匯出、第12節離線助手及其他範圍不標正確完成。實測bundle／裝置路徑／DAC／音量未提供，保持UNKNOWN。舊自動測試證據保留，不能覆蓋這次真人失敗。

本次只紀錄，未修程式、未啟動測試、未恢復本對話已暫停的開發goal；Task0021的既有研究／整合狀態不變。恢復產品工程時，先調查第一人稱阻斷，再處理直接操作與預設音量；不能再只把FPS列為等待首次真人測試。
