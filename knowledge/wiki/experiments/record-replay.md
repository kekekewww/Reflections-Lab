---
id: RLAB-KB-0015
title: 同運動實驗與重播
type: experiment
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-28T19:30:50.483Z
sources:
  - RLAB-SRC-0029
  - SB-SRC-0004
  - SB-SRC-0005
  - SB-SRC-0001
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0015
  - V1-SRC-0025
  - V1-SRC-0031
  - V1-SRC-0063
  - V1-SRC-0064
  - V1-SRC-0069
  - V1-SRC-0073
related_tasks:
  - RLAB-TASK-0016
related_decisions:
  - ADR-009
supersedes: []
tags:
  - P1
  - replay
  - A/B
  - same-motion
---

# 同運動錄放、比較與當前證據

正式契約見[RECORD_REPLAY](../../../docs/07-experiments/RECORD_REPLAY.md)及[A/B](../../../docs/07-experiments/AB_COMPARISON.md)。Recorder、MotionReplay、ReplayAudioHost、RecordingProcessor及IndexedDB已接線；artifact保存initial scene、integer ticks、motion／velocity／contact、normalized events、derived decisions、source cursors、版本及hash。content-and-cursors-v2區分nativeEpoch／logicalIntent／silent／missing，中央comparison重跑transition，拒絕偽靜音與矛盾相位；Legacy保留舊hash規則。

Acoustic A/B固定motion/raw events/listener/source signal/phase，只改聲學條件；Behavior A/B固定刺激與solver，明示內容差異。B由pre-step checkpoint重評，不重建late-capture AlwaysOn起點。數值附artifact／window／band／units／validity；基準0百分比不可用，幾何壓力比平方總和不是PCM能量、聽感或SPL，無足夠RIR decay不提供RT60。

錄製過載pause保留欠帳，不skip ticks；Interrupted可封存raw但不假裝完整replay。Pause／seek以epoch/cursor及截尾避免重複arrival；Motion playback不是physics resimulation。R15背景Worker封存保留逐frame接納、canonical指紋及完整核驗，prepared儲存限私有能力，仍有傳送／解析等同步長任務，不稱4ms通過。

[R17證據](../../../artifacts/v1/r17-integration-progress-20261029/verification.json)增加真Recorder的baseline0與獨立有限面幾何兩案；原值／差值／單位／同motion與source／artifact hash受驗。回放環境讀錄製配置，獨立公開record/seek確認不混入live溫度及聲速。Root32舊新回歸與20輸入控制通過；v3產品4通過，保留原v2真FAIL及後續額外第三程序OnImpact恢復8耗盡的FAIL，不冒充已確診根因。

v3只確認未接納Grab：共用原8恢復上限、最多3輸入、發布tick前進後再判斷，不重送已接納動作，不改Throw或四案最終斷言。原v2及早期13控制、獨立三反例、修訂20案與新真browser均保留。R6無聲驗證是工具防護證據，真人聽測尚未執行；當前600秒已保存負面結果，性能未通過。

R17最後判讀：[REQUIREMENT_EVIDENCE_20261029-r17.json](../../../docs/11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json)保存逐條原要求與Root／隔離review。當前600秒資料完整但性能與持續負載FAIL；未回填窗外收尾。完整功能檢查、當前browser及R6無聲資格通過；下一步正常100%實體輸入與裝置聽測，完整V1未完成。
