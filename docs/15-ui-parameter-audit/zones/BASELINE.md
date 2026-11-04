# Task0029 補充：區域草稿與同 revision 匯入的基準守衛

日期：2026-11-02；起點 a22c978b957ea3e5564b894f8a57a7353e0fa4da。原 core／DETACHED／volumes 報告與 pins 保留，各自只代表原固定截點。

## 已確認問題

zone_ui 子代理以真正 LabRuntime＋memory Project 匯入重現：沿用相同 projectId／sceneId／sceneRevision，把區域半尺寸由 [1,1,1] 改為 [2,2,2]；舊草稿只有 revision／project key 守衛，仍能成功寫回 [1,1,1]、名稱 Old draft，且無錯誤。這是修正前 a22 source 上的直接 Node 觀察，原始 stdout 沒有另外封存，不能冒稱已有獨立原始 TAP；固定 source commit 與後續負例可供重驗。

## 修補與契約

- 純 zoneRegistryPin(zones) 以同一 canonical plain JSON 產生有限 registry 基準。上限 16；缺省與空集合在編輯語意相同；JSON object key 順序不影響結果，作者 array 順序、ID、幾何、名稱、enabled 與 hysteresis 會影響。
- ZoneDraft 建立時保存 registryPin，編輯數字不更新 baseline。可見 stale 狀態與送出前 controller fresh snapshot 都比較此值。
- 新增的 saveZone／removeZone LabAction 現必須帶 expectedZoneRegistryPin，配合原 expectedSceneRevision。草稿儲存用建立時 pin；啟停與刪除使用該次顯示的 registry pin。
- Runtime 在前置驗證及 async prepare／drain 後的原子 guard 再比較 registry pin；同時釘住操作開始的 Scene reference。即使匯入相同 revision 且 regions 相同、只有其他物件內容不同，也不能把舊 prepare 的整個 Scene 覆蓋回去。
- 衝突拒絕 REVISION_CONFLICT 並保留新 Project／Scene／zones，草稿仍可取消重開。不新增 persistent Scene/config 欄位、run hash、全域 epoch 或安全權限。pin 只是 optimistic authoring baseline，不是 secret／credential。

## 驗證

- baseline-runtime.txt：8/8，含 2 個新增真 LabRuntime 負例：同 metadata 不同區域的 old save/delete 都拒絕；async drain 間匯入同 revision／同區域但 ball.massKg=2 的新 Project，舊交易拒絕且新物件值保留。另有 key 序等價正例可正常寫入。
- UI draft 子代理 focused：30/30，含新 baseline 變化、key 序等價、registry 刪除／狀態／作者順序變化案例。
- baseline-regression.txt：57/57 PASS、0 skipped，concurrency=2；包括 UI draft、真 Three wireframe、Zone runtime、真 Rapier／worker pipeline 與 detached acoustic ownership。
- baseline-lint.txt、baseline-format.txt、baseline-typecheck.txt：scoped ESLint／Prettier、全樹 TypeScript exit 0。
- 最後 production build 狀態由 baseline-evidence.json 記錄；尚未將 Node／SSR 冒稱 browser／GPU／實際音訊通過。

## 目前生命期界線

原 PhysicsWorld.setMode 會使通用 BodyPose.discontinuity 有效到下一個固定步，Zone producer 沿用該 flag，因此明示 body-mode 改變後首步也建立 baseline；正常 force／grab／setKinematicTarget 沒有逐步 baseline。這項目前 source 語意與「位置 discontinuity」的更細分政策已向 Root 明示；若改為跨連續 mode-change 也精確保留邊緣，需要另外的 position-discontinuity marker 與真 Rapier 邊界測試，不應粗暴忽略同 tick 可能發生的 teleport。此補丁沒有偷偷更改該物理政策。

## 整合

ZoneVolumes view source 仍為 a22 的 editor-only nominal wireframe；本補丁只把新 action pin 串入同一 ZonePanel。Root 合併完整 geometry builder 時維持先前 DETACHED.md 的三態契約。真 browser stale／存檔／overlay／音檔等 gate 仍由 Root 的最新 production bundle 獨佔 lease 操作，沒有在本分支啟動 Chrome。
