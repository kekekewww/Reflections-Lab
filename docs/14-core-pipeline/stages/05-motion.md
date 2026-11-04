# 第五階段：Motion 動作作者與固定步控制核心

日期：2026-11-02（Asia/Taipei）。基準：429efb7597ec913bd879ecc05c29a6be7ad5175c。實作與測試：Codex（motion_core）；AI transaction 橋接由隔離檔案 ownership 子代理實作，另有獨立只讀規格及碼審。此階段不宣稱完整 V1、正式效能、真人或裝置驗收完成。

## 已實作

- SceneSpec v1 以外的 Motion Registry JSON sidecar：穩定 action ID、action/registry revision、body generation、完整 canonical SHA-256 scene pin、最多64個 action、1 MiB 匯入上限。作者 save/remove/undo/redo/rebase 都驗證預期 registry revision；匯入失敗保留原內容。
- Move To、Move & Release、有限 impulse；linearSlerp trajectory（2–64 samples、最長30秒）。同一 body 僅一個 motion owner，最多8個同時控制、2048個 command 去重、128份執行收據。
- PhysicsWorld 固定步前後 observer：只在真 solver tick 執行。Dynamic 使用有限 impulse/torque servo，保留接觸求解；Kinematic 使用既有 target shape sweep 與姿態終點 overlap。Pause 凍結 cursor；取消、逾時、阻擋、epoch/generation/scene 改變產生各自收據。
- Kinematic Move & Release 明示 zero 或 transfer；transfer 根據實際接受的相鄰 tick pose 差分，受線／角速度上限限制。Dynamic 可 preserve 實際 solver 速度或明示 zero。Motion 不偽造玩家 Grab/Throw/Release 事件。
- MotionPanel 沿用既有 NumberField、Badge、vector/axis/button classes，自帶繁中／英文；提供目標／衝量編輯、執行、取消、歷史、JSON匯出入及明示場景重新綁定。root 負責 App/Dock/Controller 接線。
- AI SetTrajectory 透過 MotionTransactionHooks 加入 preview/apply/undo：digest 包含完整 sidecar before/candidate；純 motion 不偽造 scene revision，混合交易由單一 trusted runtime callback 原子驗 scene＋motion revision。Host 對真實發布內容做完整比對。沒有可信原始 trace 時 recordedTrace 明確拒絕。

## Runtime 整合 API

MotionWorkspace.create(scene, world, {getScene,onChange}) 為 async；提供 getSnapshot、穩定 getView、subscribe（進度最多每6個固定 tick 發布）、save/remove/undo/redo/rebase、start(actionId,commandId)、cancel(runId)、bindWorld(world)、exportJson/importJson、dispose。start 只取得 motion owner，開始物理運算仍由 runtime 明示 resume。World 替換後呼叫 bindWorld；同 World reset 保留 observer，generation/epoch 改變可見拒絕或失效。

AI hooks 的 getSnapshot 回 {namespace:'motion',revision,document}；preview 呼叫 workspace.previewTrajectories(requests,candidateScene)；commit/restore 呼叫 withExternalTransaction(candidateDocument,expectedDocument,candidateScene,commitSceneCallback)。Root 必須以既有原子 scene preparation/commit 實作可信 callback，不先發布 Scene 再另行任意寫 registry。

獨立 Motion JSON 匯出已提供 scene pin，Project／recording 引用及 root UI 的下載入口由整合階段接入；不把動作 JSON 當可重求解的原生 Rapier world snapshot。

## 基本驗證與審查

- 新 Motion 真 Rapier 回歸：12/12 PASS，原始輸出見 05-motion-tests.txt。含薄牆阻擋、reached、pause/cancel、zero/transfer release、impulse dedup、import/revision、失敗 scene commit、trajectory start pose、reset observer、sparse JSON 負例。
- 新 AI transaction 8項及舊 host/scene integration 合計29/29 PASS，見 05-motion-ai-validation.txt。
- Motion 初版與既有 physics-world/motion-hysteresis/AI scoped 回歸67/67 PASS；之後 reset/sparse 修補由上述12項覆蓋，不將重疊計數相加。
- Scoped ESLint exit0；Prettier已套用。TypeScript 最終結果由機讀收據記錄。
- 獨立碼審發現 reset observer、sparse JSON、kinematic acceleration 標示3項：前兩項已修並加真回歸；第三項明確限定欄位為 Dynamic servo 加速度並於 Kinematic 停用。

## 限制與 Claude Code 接手

- Dynamic servo 參數為 Tuned 控制政策，並非量測材質模型。maxAccelerationMps2 僅限制 Dynamic servo 的有效控制加速度；Kinematic 使用 bounded next pose，尚無加速度曲線作者功能。
- Kinematic 旋轉只有終點 overlap 與有限角速度，沒有 rotational swept-volume CCD。
- 已接受動作收據與 authoritative recording pose 可追溯；Motion Registry 不等於完整重新求解的 command stream／world snapshot。
- AI scene＋motion callback 的真 runtime 原子整合、Dock/Controller、Project／錄製 sidecar引用、browser 視覺／輸入、computer-use 完整輸出由 root 整合階段驗證；本分支沒有跑 browser 或 Meta live。
- Claude Code 應在整合 main 重驗 MotionPanel、author undo/rebase、reset後重新執行、AI mixed transaction 失敗復原，以及 motion→錄製→輸出。正式600秒性能仍另驗。
