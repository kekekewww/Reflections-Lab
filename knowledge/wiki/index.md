---
id: RLAB-KB-0001
title: 知識目錄
type: index
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-04T12:01:56.307Z
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
- [執行架構與資料權威](architecture/runtime-and-contracts.md) — architecture / ACCEPTED / 2026-11-02T09:45:40.484Z
- [待查條件與實作限制](blockers/open-questions.md) — blocker / ACCEPTED / 2026-11-03T02:33:40.548Z
- [證據、狀態與時間](concepts/evidence-levels.md) — concept / ACCEPTED / 2026-10-26T17:52:34.879Z
- [記憶維護與搜尋邊界](concepts/memory-and-search.md) — concept / ACCEPTED / 2026-10-25T19:46:51.310610+00:00
- [FPS退出Listener與可選動作的整合決策](decisions/fps-listener-exit.md) — decision / ACCEPTED / 2026-10-25T20:08:01.667Z
- [有效決策與取代規則](decisions/index.md) — decision / ACCEPTED / 2026-10-26T18:08:03.674Z
- [Muse提示詞離線評測與Skills](experiments/muse-prompts.md) — experiment / VERIFIED / 2026-10-26T16:08:58.309Z
- [物理與微基準證據](experiments/physics-and-benchmarks.md) — experiment / VERIFIED / 2026-10-26T17:52:34.881Z
- [同運動實驗與重播](experiments/record-replay.md) — experiment / ACCEPTED / 2026-10-28T19:30:50.483Z
- [Sound Behavior draft與風險spike驗證](experiments/sound-behavior-validation.md) — experiment / VERIFIED / 2026-11-02T09:18:38.632Z
- [Steam Audio可行性與能力](experiments/steam-audio.md) — experiment / VERIFIED / 2026-10-25T19:46:51.310610+00:00
- [六項核心實作與整合驗收](features/core-pipeline-20261102.md) — feature / ACCEPTED / 2026-11-03T02:33:40.542Z
- [互動沙盒功能狀態](features/interactive-sandbox.md) — feature / ACCEPTED / 2026-11-02T03:29:52.099Z
- [Meta 實驗Agent狀態](features/meta-agent.md) — feature / ACCEPTED / 2026-11-04T11:55:03.526Z
- [非進階候選完整實作與雙方法驗證](features/nonadvanced-completion-20261103.md) — feature / ACCEPTED / 2026-11-03T05:37:36.847Z
- [Sound Behavior核心與產品前置](features/sound-behaviors.md) — feature / ACCEPTED / 2026-11-02T09:18:38.632Z
- [軌跡編輯器 hackathon MVP](features/trajectory-editor-mvp-20261104.md) — feature / UNVERIFIED / 2026-11-04T10:28:19.421Z
- [目標與授權範圍](goals.md) — goals / ACCEPTED / 2026-10-29T05:38:39.567Z
- [Native25通過；IR reference初始化缺陷確診與原FAIL保留；短效能未達標並唯讀診斷](handoffs/016c6c42-8309-4278-876f-543cc922f7e7.md) — handoff / UNVERIFIED / 2026-10-27T16:21:11.362Z
- [使用者明確暫停：停止本輪驗證，保留研究與暫存變更；未commit/merge/push](handoffs/07abc6e1-6d06-481b-b8ec-23bc01a9efdc.md) — handoff / UNVERIFIED / 2026-10-29T06:06:18.273Z
- [Phase2完成：持久Wiki與設計工程環境的最終交接](handoffs/0c46d575-d5da-44c7-8615-424bb34a8982.md) — handoff / UNVERIFIED / 2026-10-25T20:21:54.349Z
- [整合分支合併到本機 Main（57bb7ced）；啟動器接受 PowerShell 傳入的路徑；待使用者拍攝與人工測試](handoffs/10390f1f-7f6e-4bd7-a7ec-a019cb0b28cc.md) — handoff / UNVERIFIED / 2026-11-04T03:17:38.057Z
- [Claude Code完整交接提示已存檔並連回Wiki；產品goal維持暫停](handoffs/11429c4b-25e4-4204-a585-eb7ad8bbc228.md) — handoff / UNVERIFIED / 2026-10-29T17:29:31.670Z
- [供Claude Code接手：真人FPS失敗、預設音量過小及直接操作UX問題；僅記錄未修復](handoffs/117efd63-cca1-486e-8061-b379685543bb.md) — handoff / UNVERIFIED / 2026-10-29T14:01:10.471Z
- [當前完整917品質與英文通過；原Task18 component DONE，51列42scopedPASS／9PARTIAL，整體門檻仍未完成](handoffs/14c04833-4a26-4407-b0d4-3de2d81d6597.md) — handoff / UNVERIFIED / 2026-10-27T21:20:02.069Z
- [R19：R18 工程修補完成並保存交接；只剩真人重測](handoffs/1810193b-53ec-4ec6-93db-6033ad352c30.md) — handoff / UNVERIFIED / 2026-10-29T21:43:12.167Z
- [即時音訊改為只在直達路徑使用 HRTF；使用者聽測後接受為 MVP，轉頭小爆音仍在](handoffs/1ff3f034-4c66-4f4c-9d7f-4da6a7a182be.md) — handoff / UNVERIFIED / 2026-11-04T07:50:30.923Z
- [新版修補完成CI900與a699建置；保留音訊prepare逾時，準備靜態V2及新版原生與效能驗收](handoffs/24305d40-5b47-4d1f-b1af-06f88a8cdbc5.md) — handoff / UNVERIFIED / 2026-10-27T15:29:49.918Z
- [路徑變更爆音：修正舊路徑過早斷開與方向變化過急；已知轉頭小爆音與短暫音量下降仍在，待使用者聽測](handoffs/267ff0c2-8299-447e-a7e9-50f97e1b6f3b.md) — handoff / UNVERIFIED / 2026-11-04T06:20:38.699Z
- [R13整合自動驗證保存，Computer Use停止桌面操作；完整goal仍ACTIVE，工程未完成](handoffs/27af8ba2-6c19-41e2-866b-582f73ae75b4.md) — handoff / UNVERIFIED / 2026-10-28T09:31:21.423Z
- [第一版品質與當前UI通過；原生縮放找到版面缺陷，Codex持續窄修，完整goal未完成](handoffs/2c69e001-673d-45e4-b940-0209eb3fc34c.md) — handoff / UNVERIFIED / 2026-10-27T10:04:30.363Z
- [R12 actualGit/全品質已保存；依使用者延期人工測試，續行V3自動資格工程](handoffs/3807fc47-bd19-45e4-a2f9-39448e711a5a.md) — handoff / UNVERIFIED / 2026-10-28T00:11:48.777Z
- [真NativeV2通過；正式600首輪未達標，保留FAIL並依原負載/門檻修補](handoffs/38ebc27c-cc0c-4ba3-be8c-f36d80c1fd45.md) — handoff / UNVERIFIED / 2026-10-27T13:56:43.582Z
- [Codex有限交付完成：本機Main整合、217參數與五WAV驗證；原生產品操作仍受URLpolicy外部阻擋](handoffs/392bc8c2-6b33-456f-bb27-300d311adf02.md) — handoff / UNVERIFIED / 2026-11-02T15:12:45.511Z
- [使用者確認基本功能測試完成；人工阻斷解除，下一階段僅提出建議](handoffs/3b6a4626-300e-4879-991f-9723f3a02df9.md) — handoff / UNVERIFIED / 2026-11-02T04:40:46.259Z
- [實際aec0604與freshreceiver支持OPS01／Task16AC03，43scopedPASS／8PARTIAL；整體未完成](handoffs/419ef922-a43e-46bd-9226-b0baacbc6b58.md) — handoff / UNVERIFIED / 2026-10-27T21:41:46.111Z
- [Sound Behavior研究結案；Task0010 DONE、0011 READY，Codex主導，正式產品尚未實作](handoffs/53d30f97-81ea-4a1e-839b-e9998d2217d0.md) — handoff / UNVERIFIED / 2026-10-26T18:14:44.119Z
- [效能研究已合併到 R21 分支並完成逐檔對照；只剩真人重測與後續 BACKLOG 啟動決定](handoffs/5c7bfd0f-61df-447c-9d28-b6881dc4e6e0.md) — handoff / UNVERIFIED / 2026-11-02T03:39:21.215Z
- [真實 Muse Sound 提案經產品畫面通過，展示啟動器就緒；完整 check 通過，待使用者拍攝與人工測試](handoffs/6435ecef-fc88-437d-83bb-4e8b3100e8a4.md) — handoff / UNVERIFIED / 2026-11-04T02:51:41.735Z
- [效能緩衝獨立審查完成：保留600秒失敗、14項Backlog與7份提案，目標dirty僅交文件Patch](handoffs/6573aaa5-dc46-47af-956b-14dc4b2a4240.md) — handoff / UNVERIFIED / 2026-11-01T08:39:55.156Z
- [r12完整品質與離線benchmark實際通過；最後metadata英文/Git待收尾，整體仍未完成](handoffs/68cb57eb-8034-4b39-baf0-4970fe3abe2b.md) — handoff / UNVERIFIED / 2026-10-27T23:39:32.078Z
- [研究安全整合與乾淨公開完成：最終main879c2a75、2417files及雙CI核對；完整V1限制仍保留](handoffs/6afd82e5-407f-41ad-abc9-3a5f9ff04382.md) — handoff / UNVERIFIED / 2026-10-29T15:58:51.674Z
- [安全合併及原區全品質/47功能browser通過；保留R18真人FPS失敗，準備乾淨公開snapshot](handoffs/6c47cd5f-77b1-48d7-9d6b-a2788be3e5ce.md) — handoff / UNVERIFIED / 2026-10-29T14:20:36.199Z
- [Claude接手完成：完整check、產品E2E與lifecycle通過；頂列4/5、S4 11/11、ComputerUse BLOCKED、600秒依使用者決定未跑；待人工測試](handoffs/7adfd53a-7cab-4c50-9a6c-077c468d9ef1.md) — handoff / UNVERIFIED / 2026-11-03T11:24:10.129Z
- [新增使用者基礎實測：音訊方向／重力反彈可觀察；第一人稱不可用及UI混亂，維持暫停](handoffs/89c071f0-a668-4c1f-ba86-5d885237ca49.md) — handoff / UNVERIFIED / 2026-10-28T08:18:01.372Z
- [當前功能UI27/physics2/storage5/product4通過；0006/0017/0019 DONE，最後原生/性能/裝置驗收持續](handoffs/8d9232e2-aec5-45c5-9e84-ead239d4a1f2.md) — handoff / UNVERIFIED / 2026-10-27T13:03:05.769Z
- [第一版core已Git保存，產品4案與雙語8+13通過；其餘固定驗收持續](handoffs/8e25e0c8-5443-4e3e-807c-ce63463d529a.md) — handoff / UNVERIFIED / 2026-10-27T06:00:11.234Z
- [claude/muse-limits 合併到本機 Main（1282f296）；待使用者拍攝與提交](handoffs/8eb8aafb-bcbf-417f-87ff-8eb0d96c0ec4.md) — handoff / UNVERIFIED / 2026-11-04T12:01:54.619Z
- [R20：自動重測與修補完成並保存交接；只剩真人重測](handoffs/9a987f6d-5394-4563-b278-15ed0352e93a.md) — handoff / UNVERIFIED / 2026-10-31T12:44:17.917Z
- [R2隔離候選14/14與全view等價完成；正式來源未套用，43/8及未完成門檻不變](handoffs/a2deec12-b5b7-42ee-98d1-c9968fbbf3e7.md) — handoff / UNVERIFIED / 2026-10-27T21:49:13.693Z
- [R21：第一人稱滑鼠操作、音訊斷續修正與懸浮提示完成並保存交接；只剩真人重測](handoffs/aea1f160-bcbd-4053-8f5e-cd8fd13afa79.md) — handoff / UNVERIFIED / 2026-11-01T18:06:08.850Z
- [R17真人前工程收尾：完整功能回歸及負面600秒證據保存，釋放claims；待最後metadata／Git後依要求暫停](handoffs/b04e358b-d17b-420b-a9f6-a42f6658f285.md) — handoff / UNVERIFIED / 2026-10-28T19:32:22.626Z
- [Sound Behavior研究與驗證完成；準備結案Task0010，保留所有產品NOTRUN邊界](handoffs/b5dc4583-f2e2-4edb-a37c-4ae59a63d8d6.md) — handoff / UNVERIFIED / 2026-10-26T18:05:27.231Z
- [r12正式投影與dev修復：931runtime/26Vite/physics2/storage5/product4通過，整體goal仍ACTIVE](handoffs/b92b3225-3c77-478f-9111-f84d3ad7c34f.md) — handoff / UNVERIFIED / 2026-10-27T23:16:40.462Z
- [Muse 多步驟場景建構已接上產品：一句指令一份提案，可移動、調整尺寸與移除；另有 US$5 帳本與聲學面上限](handoffs/bb21c352-ee38-4f6f-9cd7-2977daf30d1a.md) — handoff / UNVERIFIED / 2026-11-04T11:04:46.359Z
- [Sound Behavior研究結案；Task0010 DONE、0011 READY，Codex主導，正式產品尚未實作](handoffs/bef01763-78fa-47c9-9a35-b1182df2a54a.md) — handoff / UNVERIFIED / 2026-10-26T18:13:12.902Z
- [Phase2預交接：工具與規範已整合，等待完整gate](handoffs/c0a3eb71-5f9d-4bef-8381-1c694ba2a499.md) — handoff / UNVERIFIED / 2026-10-25T20:13:19.825Z
- [使用者明確重新開始；恢復隔離驗證與已授權整合發佈](handoffs/d3e4aa21-94e4-4c95-a906-70e42b62dcb7.md) — handoff / UNVERIFIED / 2026-10-29T13:26:30.930Z
- [Phase3預交接：19命令通過，使用者確認Muse0，Codex實際接手驗收，待新Agent閱讀後結案](handoffs/dddd64a7-7e89-40db-95cc-5537daed88f5.md) — handoff / UNVERIFIED / 2026-10-26T16:00:05.249Z
- [產品與工具來源凍結；分項391/150/100/155通過，新native資格準備中](handoffs/df40834c-d2f5-4dc3-b2e1-7cdbad2eec85.md) — handoff / UNVERIFIED / 2026-10-27T17:30:18.452Z
- [使用者要求暫停全部任務；雙語使用者測試及 partial 工程已保存，已知自有程序停止](handoffs/e58b3e01-a529-4d7c-8bab-c7418773bbf8.md) — handoff / UNVERIFIED / 2026-10-28T00:17:24.723Z
- [當前native25/IRv2/UI27/physics2/storage5/product4通過；正式性能未通過，實際聽測待使用者](handoffs/edc70cdf-0ab2-42e5-b632-a9d70725c1f6.md) — handoff / UNVERIFIED / 2026-10-27T18:59:40.117Z
- [軌跡編輯器 hackathon MVP 實作、審查並整合到整合分支；完整 check 通過，待使用者人工測試](handoffs/f35275d2-8a00-40f1-a913-745a979877e6.md) — handoff / UNVERIFIED / 2026-11-03T22:05:23.586Z
- [使用者轉交Claude：Codex開發維持paused，固定完整交接；Task32/33正常release為READY且原驗收不變](handoffs/f679856a-5240-42e6-b2d6-e890d16f4646.md) — handoff / UNVERIFIED / 2026-11-03T05:39:04.476Z
- [使用者指定 Emil UI 設計方向已接入正式規範；維持開發暫停](handoffs/f7352adf-612b-40f3-9cf8-8acbba2c599d.md) — handoff / UNVERIFIED / 2026-10-28T08:22:20.652Z
- [Phase2實證接收點：完整16命令通過，等待交接閱讀核對](handoffs/fba987da-df7b-4d64-b431-e04e13ebc278.md) — handoff / UNVERIFIED / 2026-10-25T20:18:03.053Z
- [Phase3工程完成：Muse使用者確認0，Codex實際接手及獨立驗收，19gate與fresh receiver PASS；Live限制另列](handoffs/fd1a594d-8ead-4b52-aba6-89dcced0eb77.md) — handoff / UNVERIFIED / 2026-10-26T16:11:19.786Z
- [交接入口](handoffs/index.md) — index / ACCEPTED / 2026-10-25T20:08:10.942Z
- [Harness實際執行與接手歷史](history/agent-runs.md) — history / VERIFIED / 2026-10-26T18:07:51.540Z
- [專案演進基準](history/bootstrap-and-phase2.md) — history / VERIFIED / 2026-10-26T15:49:35.117Z
- [事件時間索引](log.md) — log / ACCEPTED / 2026-11-04T12:01:55.736Z
- [使用者轉交Claude；Codex開發暫停，非進階整體尚未完成](now.md) — state / ACCEPTED / 2026-11-04T12:01:54.612Z
- [聲學與DSP綜合知識](research/acoustics-and-dsp.md) — research / VERIFIED / 2026-11-02T09:45:40.484Z
- [獨立Worktree架構研究與公開限制](research/architecture-review-20261029.md) — research / ACCEPTED / 2026-10-29T21:29:13.841Z
- [資料集與權利界線](research/datasets-and-rights.md) — research / VERIFIED / 2026-10-27T02:52:29.193Z
- [互動聲音設計與來源限制](research/interactive-sound-design.md) — research / VERIFIED / 2026-10-26T17:53:30.407Z
- [Muse模型額度與Prompt研究](research/muse-models-and-quota.md) — research / VERIFIED / 2026-10-26T15:49:44.460Z
- [效能與緩衝獨立審查](research/performance-buffer-review-20261101.md) — research / VERIFIED / 2026-11-03T02:33:40.545Z
- [正式路線導覽](roadmap.md) — roadmap / ACCEPTED / 2026-11-01T08:05:14.686Z
- [任務索引](tasks.md) — tasks / ACCEPTED / 2026-11-04T02:22:09.811Z
- [設計工程與唯一規範](ui-ux/design-engineering.md) — design / ACCEPTED / 2026-11-03T02:33:49.790Z
- [FPS Grab開發與驗收導覽](ui-ux/fps-grab-review.md) — design / ACCEPTED / 2026-11-02T09:35:04.597Z
- [全產品UI參數審核與修補進度](ui-ux/product-parameter-audit-20261102.md) — design / ACCEPTED / 2026-11-02T15:03:54.112Z
- [設計審閱歷史](ui-ux/review-history.md) — history / ACCEPTED / 2026-10-25T20:21:10.728Z
<!-- wiki:generated:end -->
