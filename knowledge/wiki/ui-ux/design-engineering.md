---
id: RLAB-KB-0016
title: 設計工程與唯一規範
type: design
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-03T02:33:49.790Z
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
  - V1-SRC-0076
  - V1-SRC-0078
  - V1-SRC-0079
  - V1-SRC-0083
  - V1-SRC-0084
  - V1-SRC-0091
  - V1-SRC-0092
  - PUB-NONADVANCED-UX-WORKSPACE-TOP-MONITOR-20261103-V3-c50a26196014
  - PUB-NONADVANCED-UX-COMPONENT-TOP-MONITOR-20261103-V2-4ea3fe0e4aaa
  - PUB-NONADVANCED-M4-PARTIAL-CLAUDE-HANDOFF-20261103-V1-ba2803b99e2f
related_tasks:
  - RLAB-TASK-0004
  - RLAB-TASK-0022
  - RLAB-TASK-0033
  - RLAB-TASK-0032
related_decisions: []
supersedes: []
tags:
  - P0
  - design
  - Emil
  - UI
  - UX
---

## M4頂列功能部分證據與兩份英文界線

[部分交接](../../../docs/16-nonadvanced-completion/handoffs/M4_PARTIAL_CLAUDE_HANDOFF_20261103.md)保production03四PASS/一FAIL；一個Zone草稿跨四mode保留非所有表單。de628兩UX譯本sourcehash相符，scoped2PASS是Root回報、無獨立scopedraw，非全英文。原canonical需求/內部workspace相容/token不變；完整S4/CU/recording仍未過。

## 2026-11-03頂列需求取代範圍

最新使用者需求以四種可切換TopMonitor取代頂列三步Workspace導航；[工作區架構](../../../docs/05-ux/WORKSPACE_ARCHITECTURE.md)與[元件契約](../../../docs/05-ux/COMPONENT_SPEC.md)保留舊內部workspace相容／狀態／相機，負載明分Worker與主緒。只更新需求規格，驗收現況查[Task0033](../../tasks/RLAB-TASK-0033.json)來源綁定證據，本頁不另複製flags；原tokens/數值/其他gate不改。

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

## 2026-10-30 R19：直接操作、dB 監聽與視圖資訊收納

依 R18 回報：Viewport 工具列加入移動／旋轉／縮放（TransformControls，前端由 Sonnet 子代理實作、主線審查合併）；Monitor 改為 −40 至 +12 dB 的整數 dB 控制，預設 0 dB、主混音 headroom −6 dB，limiter 之後加輸出安全上限（約 −0.3 dBFS），[Component Spec](../../../docs/05-ux/COMPONENT_SPEC.md)、[DESIGN_SYSTEM](../../../docs/05-ux/DESIGN_SYSTEM.md) 與 [Audio Runtime](../../../docs/02-architecture/AUDIO_RUNTIME.md) 已同步並保留「非校準 SPL」限制。預設場景數位峰值約 −51 → −29 dBFS；極端壓力案例由 +3 dBFS 降為約 −0.3 dBFS 且無全刻度樣本，都只是 AudioContext 數位電平。三維畫面的修訂版本、座標、聲線圖例與阻擋候選收進「視圖資訊」；第一人稱提示依狀態說明下一步。

這些只有程式審查、headless 量測與自動 browser 證據；視覺品質、易用性、版面比例與聽感待真人 R19 重測，不宣稱 UI 視覺或聽測通過。

## 2026-10-31 R20：狀態訊息、無障礙與誠實標示

自動重測後修補：狀態列的帶參數訊息改用目錄化模板翻譯，未知細節仍以原始細節標示保留；互動結果在暫停時顯示為暫停原因；Inspector 對球體與膠囊停用聲學材質與角色，並以可見說明連結 aria-describedby；畫布內的 WebGL 備用文字改為 aria-hidden，真正失敗仍由 CanvasBoundary 以 alert 宣告。證據是 headless Chrome、單元測試與 CDP 無障礙樹，未經螢幕閱讀器、視覺或真人確認，見 [R20 修補紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/bc1d5761ca79212cbfd1a00eb2db4aa74be824c0)。

## 2026-11-01 R21：懸浮提示與底部提示列

主頁面靜態說明改為 HelpTip：滑鼠懸停與鍵盤聚焦開啟、Esc 關閉、role=tooltip 加 aria-describedby、不困住焦點，使用 tooltip 125 ms 與 z-index 60 token；停用控制的原因可聚焦取得；欄位名稱、數值、狀態、錯誤、安全警告與證據標籤保持可見。第一人稱情境提示改為 viewport 底部一行提示列，不遮準星。球體尺寸改為單一直徑，膠囊為直徑加高度，不符時顯示翻譯後的原因。證據是單元與 headless 瀏覽器測試，觸控與螢幕閱讀器未驗證，見 [R21 最終驗證](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ab0b1838a7e4d7eb0152047367f0299dd336049d)。
