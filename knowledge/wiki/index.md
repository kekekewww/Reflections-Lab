---
id: RLAB-KB-0001
title: 知識目錄
type: index
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-29T15:03:32.230Z
sources:
  - RLAB-SRC-0002
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P0
  - startup
---

# Reflection Lab 知識目錄

先讀 [Now](now.md) 與 [Tasks](tasks.md)，再看最新 [Handoff](handoffs/index.md)。重要程度：P0＝接手必讀，P1＝相關任務才讀，P2＝深入研究。下方生成目錄包含分類、狀態與最後更新；不是每次全部載入的清單。

正式來源仍是 docs/research/code；Wiki 是串接狀態、限制、任務與證據的綜合層。Source Manifest 固定來源版本與hash，不能把 Wiki 摘要當作更高權威。

<!-- wiki:generated:start -->
- [Codex Muse Harness與安全接手](architecture/development-agents.md) — architecture / ACCEPTED / 2026-10-27T05:41:13.996Z
- [執行架構與資料權威](architecture/runtime-and-contracts.md) — architecture / ACCEPTED / 2026-10-29T05:38:39.561Z
- [待查條件與實作限制](blockers/open-questions.md) — blocker / ACCEPTED / 2026-10-27T02:52:31.707Z
- [證據、狀態與時間](concepts/evidence-levels.md) — concept / ACCEPTED / 2026-10-26T17:52:34.879Z
- [記憶維護與搜尋邊界](concepts/memory-and-search.md) — concept / ACCEPTED / 2026-10-25T19:46:51.310610+00:00
- [FPS退出Listener與可選動作的整合決策](decisions/fps-listener-exit.md) — decision / ACCEPTED / 2026-10-25T20:08:01.667Z
- [有效決策與取代規則](decisions/index.md) — decision / ACCEPTED / 2026-10-26T18:08:03.674Z
- [Muse提示詞離線評測與Skills](experiments/muse-prompts.md) — experiment / VERIFIED / 2026-10-26T16:08:58.309Z
- [物理與微基準證據](experiments/physics-and-benchmarks.md) — experiment / VERIFIED / 2026-10-26T17:52:34.881Z
- [同運動實驗與重播](experiments/record-replay.md) — experiment / ACCEPTED / 2026-10-28T19:30:50.483Z
- [Sound Behavior draft與風險spike驗證](experiments/sound-behavior-validation.md) — experiment / VERIFIED / 2026-10-26T18:08:15.675Z
- [Steam Audio可行性與能力](experiments/steam-audio.md) — experiment / VERIFIED / 2026-10-25T19:46:51.310610+00:00
- [互動沙盒功能狀態](features/interactive-sandbox.md) — feature / ACCEPTED / 2026-10-29T13:59:04.320Z
- [Meta 實驗Agent狀態](features/meta-agent.md) — feature / ACCEPTED / 2026-10-27T21:17:04.111Z
- [Sound Behavior核心與產品前置](features/sound-behaviors.md) — feature / ACCEPTED / 2026-10-27T23:15:42.060Z
- [目標與授權範圍](goals.md) — goals / ACCEPTED / 2026-10-29T05:38:39.567Z
- [Native25通過；IR reference初始化缺陷確診與原FAIL保留；短效能未達標並唯讀診斷](handoffs/016c6c42-8309-4278-876f-543cc922f7e7.md) — handoff / UNVERIFIED / 2026-10-27T16:21:11.362Z
- [使用者明確暫停：停止本輪驗證，保留研究與暫存變更；未commit/merge/push](handoffs/07abc6e1-6d06-481b-b8ec-23bc01a9efdc.md) — handoff / UNVERIFIED / 2026-10-29T06:06:18.273Z
- [Phase2完成：持久Wiki與設計工程環境的最終交接](handoffs/0c46d575-d5da-44c7-8615-424bb34a8982.md) — handoff / UNVERIFIED / 2026-10-25T20:21:54.349Z
- [供Claude Code接手：真人FPS失敗、預設音量過小及直接操作UX問題；僅記錄未修復](handoffs/117efd63-cca1-486e-8061-b379685543bb.md) — handoff / UNVERIFIED / 2026-10-29T14:01:10.471Z
- [當前完整917品質與英文通過；原Task18 component DONE，51列42scopedPASS／9PARTIAL，整體門檻仍未完成](handoffs/14c04833-4a26-4407-b0d4-3de2d81d6597.md) — handoff / UNVERIFIED / 2026-10-27T21:20:02.069Z
- [新版修補完成CI900與a699建置；保留音訊prepare逾時，準備靜態V2及新版原生與效能驗收](handoffs/24305d40-5b47-4d1f-b1af-06f88a8cdbc5.md) — handoff / UNVERIFIED / 2026-10-27T15:29:49.918Z
- [R13整合自動驗證保存，Computer Use停止桌面操作；完整goal仍ACTIVE，工程未完成](handoffs/27af8ba2-6c19-41e2-866b-582f73ae75b4.md) — handoff / UNVERIFIED / 2026-10-28T09:31:21.423Z
- [第一版品質與當前UI通過；原生縮放找到版面缺陷，Codex持續窄修，完整goal未完成](handoffs/2c69e001-673d-45e4-b940-0209eb3fc34c.md) — handoff / UNVERIFIED / 2026-10-27T10:04:30.363Z
- [R12 actualGit/全品質已保存；依使用者延期人工測試，續行V3自動資格工程](handoffs/3807fc47-bd19-45e4-a2f9-39448e711a5a.md) — handoff / UNVERIFIED / 2026-10-28T00:11:48.777Z
- [真NativeV2通過；正式600首輪未達標，保留FAIL並依原負載/門檻修補](handoffs/38ebc27c-cc0c-4ba3-be8c-f36d80c1fd45.md) — handoff / UNVERIFIED / 2026-10-27T13:56:43.582Z
- [實際aec0604與freshreceiver支持OPS01／Task16AC03，43scopedPASS／8PARTIAL；整體未完成](handoffs/419ef922-a43e-46bd-9226-b0baacbc6b58.md) — handoff / UNVERIFIED / 2026-10-27T21:41:46.111Z
- [Sound Behavior研究結案；Task0010 DONE、0011 READY，Codex主導，正式產品尚未實作](handoffs/53d30f97-81ea-4a1e-839b-e9998d2217d0.md) — handoff / UNVERIFIED / 2026-10-26T18:14:44.119Z
- [r12完整品質與離線benchmark實際通過；最後metadata英文/Git待收尾，整體仍未完成](handoffs/68cb57eb-8034-4b39-baf0-4970fe3abe2b.md) — handoff / UNVERIFIED / 2026-10-27T23:39:32.078Z
- [安全合併及原區全品質/47功能browser通過；保留R18真人FPS失敗，準備乾淨公開snapshot](handoffs/6c47cd5f-77b1-48d7-9d6b-a2788be3e5ce.md) — handoff / UNVERIFIED / 2026-10-29T14:20:36.199Z
- [新增使用者基礎實測：音訊方向／重力反彈可觀察；第一人稱不可用及UI混亂，維持暫停](handoffs/89c071f0-a668-4c1f-ba86-5d885237ca49.md) — handoff / UNVERIFIED / 2026-10-28T08:18:01.372Z
- [當前功能UI27/physics2/storage5/product4通過；0006/0017/0019 DONE，最後原生/性能/裝置驗收持續](handoffs/8d9232e2-aec5-45c5-9e84-ead239d4a1f2.md) — handoff / UNVERIFIED / 2026-10-27T13:03:05.769Z
- [第一版core已Git保存，產品4案與雙語8+13通過；其餘固定驗收持續](handoffs/8e25e0c8-5443-4e3e-807c-ce63463d529a.md) — handoff / UNVERIFIED / 2026-10-27T06:00:11.234Z
- [R2隔離候選14/14與全view等價完成；正式來源未套用，43/8及未完成門檻不變](handoffs/a2deec12-b5b7-42ee-98d1-c9968fbbf3e7.md) — handoff / UNVERIFIED / 2026-10-27T21:49:13.693Z
- [R17真人前工程收尾：完整功能回歸及負面600秒證據保存，釋放claims；待最後metadata／Git後依要求暫停](handoffs/b04e358b-d17b-420b-a9f6-a42f6658f285.md) — handoff / UNVERIFIED / 2026-10-28T19:32:22.626Z
- [Sound Behavior研究與驗證完成；準備結案Task0010，保留所有產品NOTRUN邊界](handoffs/b5dc4583-f2e2-4edb-a37c-4ae59a63d8d6.md) — handoff / UNVERIFIED / 2026-10-26T18:05:27.231Z
- [r12正式投影與dev修復：931runtime/26Vite/physics2/storage5/product4通過，整體goal仍ACTIVE](handoffs/b92b3225-3c77-478f-9111-f84d3ad7c34f.md) — handoff / UNVERIFIED / 2026-10-27T23:16:40.462Z
- [Sound Behavior研究結案；Task0010 DONE、0011 READY，Codex主導，正式產品尚未實作](handoffs/bef01763-78fa-47c9-9a35-b1182df2a54a.md) — handoff / UNVERIFIED / 2026-10-26T18:13:12.902Z
- [Phase2預交接：工具與規範已整合，等待完整gate](handoffs/c0a3eb71-5f9d-4bef-8381-1c694ba2a499.md) — handoff / UNVERIFIED / 2026-10-25T20:13:19.825Z
- [使用者明確重新開始；恢復隔離驗證與已授權整合發佈](handoffs/d3e4aa21-94e4-4c95-a906-70e42b62dcb7.md) — handoff / UNVERIFIED / 2026-10-29T13:26:30.930Z
- [Phase3預交接：19命令通過，使用者確認Muse0，Codex實際接手驗收，待新Agent閱讀後結案](handoffs/dddd64a7-7e89-40db-95cc-5537daed88f5.md) — handoff / UNVERIFIED / 2026-10-26T16:00:05.249Z
- [產品與工具來源凍結；分項391/150/100/155通過，新native資格準備中](handoffs/df40834c-d2f5-4dc3-b2e1-7cdbad2eec85.md) — handoff / UNVERIFIED / 2026-10-27T17:30:18.452Z
- [使用者要求暫停全部任務；雙語使用者測試及 partial 工程已保存，已知自有程序停止](handoffs/e58b3e01-a529-4d7c-8bab-c7418773bbf8.md) — handoff / UNVERIFIED / 2026-10-28T00:17:24.723Z
- [當前native25/IRv2/UI27/physics2/storage5/product4通過；正式性能未通過，實際聽測待使用者](handoffs/edc70cdf-0ab2-42e5-b632-a9d70725c1f6.md) — handoff / UNVERIFIED / 2026-10-27T18:59:40.117Z
- [使用者指定 Emil UI 設計方向已接入正式規範；維持開發暫停](handoffs/f7352adf-612b-40f3-9cf8-8acbba2c599d.md) — handoff / UNVERIFIED / 2026-10-28T08:22:20.652Z
- [Phase2實證接收點：完整16命令通過，等待交接閱讀核對](handoffs/fba987da-df7b-4d64-b431-e04e13ebc278.md) — handoff / UNVERIFIED / 2026-10-25T20:18:03.053Z
- [Phase3工程完成：Muse使用者確認0，Codex實際接手及獨立驗收，19gate與fresh receiver PASS；Live限制另列](handoffs/fd1a594d-8ead-4b52-aba6-89dcced0eb77.md) — handoff / UNVERIFIED / 2026-10-26T16:11:19.786Z
- [交接入口](handoffs/index.md) — index / ACCEPTED / 2026-10-25T20:08:10.942Z
- [Harness實際執行與接手歷史](history/agent-runs.md) — history / VERIFIED / 2026-10-26T18:07:51.540Z
- [專案演進基準](history/bootstrap-and-phase2.md) — history / VERIFIED / 2026-10-26T15:49:35.117Z
- [事件時間索引](log.md) — log / ACCEPTED / 2026-10-29T15:03:31.989Z
- [目前專案狀態](now.md) — state / ACCEPTED / 2026-10-29T15:03:28.849Z
- [聲學與DSP綜合知識](research/acoustics-and-dsp.md) — research / VERIFIED / 2026-10-26T17:54:59.738Z
- [獨立Worktree架構研究與公開限制](research/architecture-review-20261029.md) — research / ACCEPTED / 2026-10-29T15:03:28.850Z
- [資料集與權利界線](research/datasets-and-rights.md) — research / VERIFIED / 2026-10-27T02:52:29.193Z
- [互動聲音設計與來源限制](research/interactive-sound-design.md) — research / VERIFIED / 2026-10-26T17:53:30.407Z
- [Muse模型額度與Prompt研究](research/muse-models-and-quota.md) — research / VERIFIED / 2026-10-26T15:49:44.460Z
- [正式路線導覽](roadmap.md) — roadmap / ACCEPTED / 2026-10-29T05:38:39.565Z
- [任務索引](tasks.md) — tasks / ACCEPTED / 2026-10-29T13:26:25.375Z
- [設計工程與唯一規範](ui-ux/design-engineering.md) — design / ACCEPTED / 2026-10-29T13:59:04.321Z
- [FPS Grab開發與驗收導覽](ui-ux/fps-grab-review.md) — design / ACCEPTED / 2026-10-26T17:52:37.412Z
- [設計審閱歷史](ui-ux/review-history.md) — history / ACCEPTED / 2026-10-25T20:21:10.728Z
<!-- wiki:generated:end -->
