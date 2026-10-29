# Support contact anchor regression 修復

2026-10-27。此證據只涵蓋 `src/app/physics-behavior.ts` 的轉接行為與 logical behavior emitter，不表示完整第一版或 V1-EVT-01／V1-AUD-01／V1-UX-04 已通過。

根因：`PhysicsWorld.poses()` 已依每個物件的支撐／滑動狀態選出 `pose.contact`。原 `representativeContacts()` 再將所有 pose 與 event contact 依 impulse 全域排名；較強的牆面撞擊因此覆蓋同一物件的地板支撐位置、pair／episode、材質與 metrics。修改只有一個行為：`pose.contact ?? contacts.get(pose.objectId)`。沒有 producer contact 時沿用原有 fallback，離散事件繼續獨立複製 `event.contact`。

固定驗收及既有 defaults assertions 未修改。原檔案與實際 byte hashes 見 [final-receipt.json](final-receipt.json)；並行其他模組不在本次修改／審查範圍。

可追溯資料鏈：

| Claim | 來源／邊界 | 本次證據 |
| --- | --- | --- |
| SA-001 | `src/physics/physics-world.ts` 的 `poses()` 選取支撐／滑動 patch → `BodyPose.contact` → `toBehaviorFrame().objects[].contact` | 同物件強 impact 與其他 participant pose 均不能覆蓋自身 producer contact；支撐 J=0.8 及 unavailable/null 均保留 |
| SA-002 | `samplePair()` 的 `vCOM + omega × r`／nullable methods → adapter metrics | Synthetic SI 輸入 `v=[2,0,0]`、`omega=[0,0,-2]`、支撐 `r=[0,-1,0]` 的 slip=0；牆面 point 的 slip=1.6。轉接不重算或把 J(Ns)標成 N；source speed=2、angular speed=2、support force=null |
| SA-003 | `PhysicsEvent.contact` → normalized discrete event → BehaviorRuntime discrete candidate | 強牆面 impact 保留 `[0.8,1,0]`、J=12、牆面材質／collider／pair，audio intent 帶自己的 parentPhysicsEventId |
| SA-004 | `BehaviorFrame.objects[].contact` → continuous candidate → logical rolling emitter | rolling intent 在 `[0,0,0]`、floor episode／材質，選 floor generator 330 Hz；impact 同 tick 在牆面選 880 Hz。下一 tick rolling 沿 producer patch 更新且 instance 不重建／不停止 |

這些 Synthetic 接觸值是 adapter contract fixture；它們沒有假裝證明同一真 Rapier tick 的 rolling classifier。真 Rapier falling contact 與既有 motion/contact suites 分別驗證。

已執行並讀取結果：

- [red.tap](red.tap)、[red.json](red.json)：原 source preimage，原 defaults 最後一案 FAIL；新增四案 FAIL、fallback 案原已 PASS。共 12／17 PASS，5 項預期 assertion FAIL，沒有 runner／語法錯誤。
- [preimage-reproduction/proof.json](preimage-reproduction/proof.json)、[result.tap](preimage-reproduction/result.tap)：最終格式化測試內容對隔離 preimage 重跑，1／5 PASS、4 項相同 assertion FAIL。僅 transpile TypeScript／改三個 import 路徑，沒有暫換產品來源。
- [green.tap](green.tap)、[green.json](green.json)：原 defaults＋新增測試 17／17 PASS，範圍來源於執行前後 hash 相同。
- 獨立 [review/REVIEW.md](review/REVIEW.md)、[review/verification.json](review/verification.json)：另程序重跑 17／17、scoped ESLint／Prettier PASS；無 P0／P1／P2 finding，所列來源／protected files hashes 穩定。
- 獨立 [review/adjacent-verification.json](review/adjacent-verification.json)：另程序重跑 contact emission／motion hysteresis／audio behavior 50／50 PASS，包含真 Rapier 地板＋牆面 high-slip sliding anchor；stderr 為空，來源 hashes 穩定。
- 本代理另執行 `node --import tsx --test tests/physics/contact-emission.test.ts tests/physics/motion-hysteresis.test.ts tests/audio-behavior/*.test.ts`：50／50 PASS；直接工具 stdout，並未宣稱為獨立程序結果。

重跑 GREEN：`node artifacts/v1/support-anchor-20261027/verify.mjs green`。
重跑隔離 RED：`node artifacts/v1/support-anchor-20261027/preimage-reproduction.mjs`。
初始 RED 指令會拒絕覆寫現存 preimage。正式 source/test 已凍結，完整 `npm run check` 由 root 在共同凍結窗口執行；此子任務沒有 browser／server／API／模型／Git／Wiki／package 操作，沒有 DSP、聽測或效能通過聲明。
