---
id: RLAB-KB-0009
title: 互動沙盒功能狀態
type: feature
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-02T03:29:52.099Z
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
  - V1-SRC-0076
  - V1-SRC-0077
  - V1-SRC-0080
  - V1-SRC-0081
  - V1-SRC-0083
  - V1-SRC-0084
  - V1-SRC-0085
  - V1-SRC-0086
  - V1-SRC-0087
  - V1-SRC-0089
  - V1-SRC-0090
  - V1-SRC-0091
  - V1-SRC-0092
  - V1-SRC-0093
  - V1-SRC-0094
  - V1-SRC-0096
related_tasks:
  - RLAB-TASK-0006
  - RLAB-TASK-0016
  - RLAB-TASK-0022
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

## 2026-10-30 R19：R18 工程修補完成，待真人重測

[R19 驗證紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/50eff1a6f87323c9a90eff221c2a40e9e9193c0e)由 Claude Code 主線（claude-opus-5-5）審查與合併，前端由 Sonnet 子代理實作，見 [RLAB-TASK-0022](../../tasks/RLAB-TASK-0022.json)；產品截點 `5e56260`。真實 Chrome（Playwright headless、CDP 輸入、真原生 Pointer Lock）先重現 R18 阻斷：鎖定成功後模擬仍為 Ready、tick 0，W／滑鼠／點擊全被丟棄，只有另按 Enter 才開始；另發現固定（F）、放置與資料庫等交易安全暫停會清掉 host 的 lock 旗標，使瀏覽器仍鎖定時 Enter 也無法繼續。

修補後，進入點擊在 entry 交易與實際 lock 都完成後直接開始；持有物或 ghost 時仍等明示 Resume。暫停時點擊畫面（release 時生效）或 Enter 繼續，Esc 後點擊畫面重新鎖定；取得鎖定與恢復的點擊都不轉送為投擲。免鎖定操作在畫面有焦點時接受 WASD、方向鍵與 Enter，且不回報原生 lock。Tab、輸入法組字或文字欄位取得焦點時，等待中的進入或 Resume 都會取消並交回介面；已送出但仍在等預聽停止的 run 由 runtime 的 entry generation 丟棄。

Codex（gpt-6.1-sol、xhigh、唯讀）做了多輪對抗審查：第一輪六項缺陷與一項過載風險、第二輪兩項重大與一項次要、第三輪一項重大（gizmo 重新掛載）、第四輪一項次要（提交中點選改變選取）；每項先寫對原碼 RED 的回歸，再修為 GREEN。現行 ui-refined-v2、pointerlock-race、product v3（重建 bundle 並核對來源）、linked v2、physics、storage 與 runtime 均通過。舊 ui.spec 的 8 項與舊 product 流程 4 項在基準 a5f2a90 同樣失敗，保留紀錄、不改寫。

編輯器另加移動／旋轉／縮放 gizmo：一次拖曳只提交一個 patchObject（一個 revision、一筆 Undo）；Esc、pointercancel、失去捕捉與視窗失焦都取消且不提交；前一次提交完成前（含切換工具或畫面重建）不能開始下一次拖曳，點選也不改變選取；運算／重播中隱藏。以上均為 headless 自動證據，不是實體鍵鼠或真人驗收；R18 第一人稱、抓投、建造與 FPS 聽測在真人 R19 重測前維持 BLOCKED／未測，材質反射 NOT TESTED、第9節後 UNVERIFIED 不變。

## 2026-10-31 R20：自動重測與修補

依[完整測試流程](../../../docs/11-v1/FULL_TEST_PROCEDURE.md)以 Playwright（headless Chrome、CDP 輸入）自動重測：既有閘門與 R19 相同，探索測試的 117 個檢查點有 93 個通過，並找到五個產品問題，見[自動重測紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/63829e86689cc544fc4e811eb9fb673cbe2871f0)。[R20 修補紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/bc1d5761ca79212cbfd1a00eb2db4aa74be824c0)：F 固定、建立待啟用與啟用等互動結果在模擬等待時成為狀態列的暫停原因，繼續後清除；B 進入建造時與 HUD 按鈕一樣開始方塊放置預覽，離開時捨棄未確認的預覽；runtime、互動與錄製主機的帶參數訊息有英文；球體與膠囊不進入幾何聲學，Inspector 停用其聲學材質與角色並說明原因；畫布內的 WebGL 備用文字不再被輔助技術讀出。Codex（gpt-6.1-sol、xhigh、唯讀）三輪審查共 5 項 MINOR，均以 RED→GREEN 回歸修補，第三輪無新發現。

曲面遮擋的內接方塊試作因 105 物件場景超出 256 面幾何預算而撤回；headless 錄製約每 0.1 秒模擬時間就因負載暫停，與 R17 性能 FAIL 一致。以上全是自動證據，不是真人驗收；Task0022 仍等待真人重測。

## 2026-11-01 R21：第一人稱滑鼠操作、音訊斷續與說明文字

使用者以 Brave 回報 B1～B4 正常；B5 建造不直覺、無法離開建造模式；音訊斷斷續續；並要求參數文件與移除主頁面說明文字，見 [R21 回報](../../../docs/11-v1/USER_TEST_FEEDBACK_20261101-r21.json)，需求變更記於[驗收補充](../../../docs/11-v1/ACCEPTANCE_AMENDMENTS.md)。實作由 Codex（gpt-6.1-sol、xhigh）完成，Claude Code 協調、量測並重跑驗證；三輪獨立審查由 Claude 子代理執行。

- 第一人稱：左鍵抓取／投擲，按住右鍵預覽、放開放置，持有時右鍵放下；空中放置為 dynamicNoGravity。放置在內部自動完成重新驗證、geometry ack 與啟用，維持原本運算狀態，一次一筆復原；錄製、重播與音訊重建期間拒絕放置。「無法離開建造」的原因是放置後安全暫停、待啟用物件擋住繼續，而暫停時所有按鍵被忽略。
- 音訊：聲音本來就在瀏覽器音訊執行緒以原生節點渲染。量測找到的主因是每個物理步重複送出的參數自動化（靜止場景每 20 秒約 3.7 萬次）與偏小的輸出緩衝。R21 加入音訊緩衝預設（預設穩定）、只用於起始時間的排程餘裕、輸出中斷計數與有逾時保護的安全重建；headless 20 秒輸出中斷（最終兩輪）：編輯器 19 → 1 次，第一人稱走動 14 → 1 次，物理由約 0.64 倍提升到約 0.95 倍即時，見 [R21 音訊量測](archive://uncommitted-local/artifacts/v1/r21-audio-smoothness-20261101/)。曾嘗試把參數漸變排到未來時間，量測顯示退步到 74 次後撤回。
- 說明文字：35 段改為懸浮提示，參數集中在[參數設定參考](../../../docs/11-v1/PARAMETER_REFERENCE.md)。

全部是自動證據（headless Chrome、CDP 輸入），見 [R21 最終驗證](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ab0b1838a7e4d7eb0152047367f0299dd336049d)；真人重測與實際聽感待做。物理仍在主執行緒；若真實瀏覽器仍卡頓，依[效能與緩衝研究](../research/performance-buffer-review-20261101.md)先做歸因（RLAB-TASK-PERF-20261101-001），Worker 只是需要歸因證據的 P2 候選。
