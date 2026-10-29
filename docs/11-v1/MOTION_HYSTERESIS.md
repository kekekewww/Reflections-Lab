# 固定步運動狀態與遲滯

2026-10-27。對應 V1-SND-05；實作在 [PhysicsWorld](../../src/physics/physics-world.ts)，驗證在 [實際 Rapier 測試](../../tests/physics/motion-hysteresis.test.ts)。這些狀態是 **Derived／Tuned 工程分類**，不是量測材質資料或自然振動模型，也不構成聽測證據。

狀態只在已完成的 fixed step 更新一次。`snapshot`、`getPose`、`interpolatedPoses` 只讀取保存的狀態，不能推進退出計數或提前吃掉 `OnStartMoving`／`OnStopMoving` 邊緣。速度仍是實際 Rapier 資料，狀態則對應最後完成的物理步。

| 狀態         | 進入                                                                                           | 退出／保持                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Moving       | world-frame 線速度 ≥0.05 m/s                                                                   | ≤0.025 m/s 連續2步才退出；中間區間保留原狀態                                                                                  |
| Spinning     | 角速度幅值 ≥0.1 rad/s                                                                          | ≤0.05 rad/s 連續2步才退出                                                                                                     |
| Sliding      | 有效 contact-point 相對 slip ≥0.12 m/s                                                         | ≤0.08 m/s 連續2步才退出；中間區間保留原狀態                                                                                   |
| Rolling 候選 | 球體有支撐、相對支撐 COM 切向速度 ≥0.05 m/s、相對角速度的切平面分量 ≥0.1 rad/s、slip <0.08 m/s | 相對切向速度 >0.025 m/s、切平面角速度 >0.05 rad/s、slip <0.12 m/s 時保持；低運動連續2步才退出，失去支撐／episode 變更立即失效 |

Moving／Spinning／Held 互相正交；Held 仍可移動及接觸。Pause 不推進 tick 或退出計數，不假造停止／放手。Sliding 使用實際接觸點 slip，牆面接觸也可形成 Sliding；不能以 COM 平移代替。固定支撐面不因另一物件滑動而成為 Sliding。Sliding 活躍時選擇實際最大 slip 的接觸點，穩定 pair key 作相同值的排序依據，避免「擦牆卻定位到地板」。Rolling 扣除支撐面的線／角速度，並移除法線軸角速度，因此平台共同剛體運動或原地 spin 不能單獨證明 rolling。Sliding 與 Rolling 不同時為真。

門檻為本版明示 Tuned 初值，沿用既有 production 進入值並補退出帶及固定步穩定條件；研究 spike 的數字沒有自動升格為產品校準值。[ADR-014](../02-architecture/adr/014-sound-behavior-system.md)、[事件模型](../10-sound-behaviors/EVENT_MODEL.md) 與 [Bridge](../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md) 仍是分層權威。

每個現存 body record 保存一份狀態及有界計數，不新增跨 epoch 的無界 Map。幾何重建／remove-readd／reset 由新 generation 建立新狀態；非保持速度的 body mode、enabled 變更與作者 transform 清空狀態。DynamicGravity ↔ DynamicNoGravity 保留實際速度及 Moving／Spinning，清空 contact 分類。Contact episode 換代不繼承舊 Rolling／Sliding。無適用球體支撐資料時 Rolling 為 `null`；缺失 slip 不補零。

已執行：

2026-10-27 03:11 UTC 另作一次當前版本的原始證據補存：[67項完整程序與 hash manifest](../../artifacts/v1/motion-hysteresis-validation-20261027/verification.json)、[原始 stdout](../../artifacts/v1/motion-hysteresis-validation-20261027/regression.stdout.txt)、[原始 stderr](../../artifacts/v1/motion-hysteresis-validation-20261027/regression.stderr.txt)，以及隔離 reviewer 的[29項獨立程序與 manifest](../../artifacts/v1/motion-hysteresis-validation-20261027/independent-review/verification.json)／[原始 TAP](../../artifacts/v1/motion-hysteresis-validation-20261027/independent-review/tests.stdout.tap)。兩次新執行皆 exit 0、source 前後一致、61份保護檔案 hash 吻合；保留實際 source／test copy，沒有回填成較早那次執行的紀錄。

- `node --import tsx --test tests/physics/motion-hysteresis.test.ts`：9/9 PASS；最初7項修正前6項失敗，涵蓋門檻 jitter、getter 純讀取、rad/s 分離、實際球地接觸與 slip 帶、法線軸 spin、Held／Pause、mode／enable／generation 清理，另加固定支撐面與牆角接觸定位 regression。
- `node --import tsx --test tests/physics/physics-world.test.ts tests/physics/contact-emission.test.ts tests/physics/character-motor.test.ts tests/physics/fixed-clock.test.ts tests/interaction-runtime/host.test.ts`：58/58 PASS。
- 將上列全部測試與新測試同一次執行：67/67 PASS，0 fail／skip。
- `node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --resolveJsonModule --skipLibCheck src/physics/physics-world.ts tests/physics/motion-hysteresis.test.ts`：PASS。整體 `tsc --noEmit` 須待其他並行 UI 修改完成後由 root 重跑，不以此 scoped check 代替。
- `node node_modules/eslint/bin/eslint.js src/physics/physics-world.ts tests/physics/motion-hysteresis.test.ts`：PASS。

隔離 review 已重驗9項新測試＋20項原 Physics／contact 測試，29/29 PASS；review 指出的固定支撐面誤分類及牆角聲源定位已修復並重驗。受查 source SHA256 為 `071adc79ac6a0b7f12b7dade2994e7d4ae0df07c40899eaae547fd45a764dcc4`。本版仍為單一 body 層級接觸分類，沒有宣稱完整多 patch classifier。此頁不宣稱本輪已完成 browser／長時間效能／人工聽測；第一版整體驗收由 root 彙整。
