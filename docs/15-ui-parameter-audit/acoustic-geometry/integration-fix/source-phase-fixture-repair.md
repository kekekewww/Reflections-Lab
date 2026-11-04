# source-phase 測試資料標記修正

整合樹：D:\Developing\Meta Hack\.worktrees\integration；檢查時 HEAD：d6bc27667220aa0c0b7a91c85a2f6e423e42fd80。

原始檔已逐位元組保存於 source-phase.test.ts.preimage.raw.txt。原測試 12 項中 8 項通過、4 項因 CAPABILITY_UNSUPPORTED 失敗；純 box 場景實際模型為 web-geometric-1.0.0，測試標頭仍為占位 1.0.0。新模型精確檢查正確拒絕重評。

只修改 fixture 的兩個 import、由實際 Scene 決定 backendVersion，以及加入新錄製 emitterGeometryPolicyPin()。三組確切替換後與目前檔案逐位元組相同；未修改產品 guard、時鐘、source phase、cursor、epoch 或任何預期值。

驗證：完整指定測試檔 12/12 通過（無跳過）；指定檔 ESLint 與 Prettier check 均 exit 0。原始／最終原始輸出及來源 SHA-256 見 source-phase-fixture-repair.json。

本報告只證明這個測試檔；未執行全 runtime、browser、硬體音訊或真人聆聽。未操作 Git index／commit／Wiki。
