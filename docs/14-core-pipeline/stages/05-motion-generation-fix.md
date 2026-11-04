# Motion 混合交易世代修補

日期：2026-11-02。承接第五階段 dd4ef2232be111ffadaa0f0b4853150000a22e46。

獨立整合審查以真 Rapier 確認：world.reset 後 body generation 已為2，原 previewTrajectories 卻把任何新 Scene revision 的動作 generation 一律設1；mode-only 加 SetTrajectory 套用後無法執行。這是已修復的程式缺陷，原提交與本次修補分開保留。

## 修改

- PhysicsWorld.projectSceneGenerations 是無副作用的 applyScene identity 投影：同 geometry 的 mode／transform／material 修改保留現世代；geometry 重建、已刪ID重用依歷史計數+1；真正新ID從1開始。不從 Scene revision 猜世代。
- Motion preview 使用上述投影並將完整候選綁定納入核准 digest；外部交易在 scene callback 前驗 body identity，所以 preview 後 reset 會在任何 Scene 寫入前明確拒絕。
- projectRestoredRegistry 只重綁可信候選 World 的世代，不改作者目標／種類／samples。MotionTransactionHooks.prepareRestore 將此投影納入 AI Undo；Host 只允已存在的 action.generation 正安全整數改動，其他完整內容、順序、revision、scene pin 都驗證。投影期間的 Scene／Motion 競態也拒絕。
- 真 runtime 需接 prepareRestore(snapshot,scene) 回傳同 namespace／revision，document 為 await motion.projectRestoredRegistry(snapshot.document,scene)。若 runtime 採不同於 applyScene 的 World 身分政策，必須提供相符的可信 prepare 邊界，不能另外假設世代。

## 驗證

- 真 Rapier 新6項加既有 Motion12項：18/18 PASS，見05-motion-generation-tests.txt。包含 reset+mode-only、geometry、ID重用、新ID、preview後reset競態、mixed geometry Undo後重新執行。
- 新ID初次fixture與原球同位，正確被碰撞阻擋；原FAIL保留05-motion-generation-initial-overlap.txt。將原球移開後同一碰撞政策通過，沒有刪斷言或放寬容差。
- AI bridge指定3 suites最終37/37 PASS，包含8項本次restore projection回歸，見05-motion-ai-generation-validation.txt。
- TypeScript／ESLint／format最終結果以05-motion-generation-verification.json記錄。
- 本修補沒有執行browser／Meta live／裝置聽測；root與Claude仍需在整合版核對真UI和完整管線。
