# 第一人稱互動規格

查核日期：2026-10-26。狀態：可供下一階段開發的設計契約；本文件不是已完成互動功能。操作鍵位以 [INPUT_CONTROLS.md](INPUT_CONTROLS.md) 為準。

## 1. 三種工作模式

| 模式 | 視角與游標 | 主要行為 | 進入條件 |
| --- | --- | --- | --- |
| Scene Editor | 自由視角，可見游標 | 物件階層、Transform gizmo、Inspector、Source / Listener 位置、撤銷 | 場景已載入 |
| FPS Simulation | Pointer Lock，準星 | 行走、觀察、抓取、旋轉、放下、投擲與推力 | 玩家 capsule 有合法出生空間；使用者手勢啟動 |
| FPS Build | 同一玩家與第一人稱視角 | library、ghost、表面對齊、snap、place/cancel、duplicate、lock | Idle；Held 先明確輕放／釋放或取消切換 |

模擬執行／暫停是獨立狀態，不與三模式或 Workspace 混為一談。一般切 Scene / Analysis Workspace 不等於 Reset／Pause；離開 FPS 輸入控制時先退出 Pointer Lock、清鍵盤狀態。若 Held／ghost 未完成，在安全 tick 暫停並保留最後有效快照，提示「持有中；恢復後繼續」；不能暗中 drop。編輯幾何與確認放置需安全暫停、驗證交易；關閉 UI 後需明確 Resume。

Pause 採 UX／音訊規格的 `Freeze-and-fade`：logical tick、Held／ghost、source offset 與 pending arrival queue 凍結，暫停期間不執行抓取 impulse。run bus 以待驗的 `20 ms` 目標淡出，舊 audio epoch 排程取消並截斷尾音；Resume 重新錨定時鐘，只重排尚未到達的 logical arrivals，不重發已聽過的 impact。此策略不保證跨 pause 的卷積波形連續，錄製需記 interrupted boundary。詳見 [WORKSPACE_ARCHITECTURE.md](../05-ux/WORKSPACE_ARCHITECTURE.md)。

恢復 Held 前重新驗證 entity generation、collider revision、grip 與合法目標空間，必要時以保存設定重建同一物件的控制器。恢復力上限由零有界 ramp 到設定值，不能在第一步釋放積累誤差能量。還原失敗維持 Paused，顯示明確 Release／回復場景選項；不默默選另一物件、不自動 drop。ghost 也需重驗後才顯示可放置。

Pointer Lock 的 Three addon 是控制輸入方向的工具，不是碰撞系統。鎖定成功以 `lock`／實際 `pointerLockElement` 為準；錯誤或不支援時回到可操作 UI，不能只因呼叫 `lock()` 就當作成功。瀏覽器的預設解鎖手勢保留，實際行為需在目標瀏覽器測試。[FP-01]

## 2. 玩家與攝影機

初版玩家為 position-based kinematic body 加直立 capsule；不能繞 pitch 旋轉 capsule。Rapier controller 只處理平移，應用輸入預期位移，取修正後位移再 `setNextKinematicTranslation`。[FP-02]

初始候選：capsule 半徑 `0.25 m`、總高 `1.75 m`、眼高 `1.60 m`（自腳底量）、步行 `2 m/s`、快走 `3.5 m/s`、controller offset `0.01 m`。這些是操作預設，與實體人體精確尺寸無關。跳躍、蹲下為可選 P2，與 FPS UX／核心 P0 排程一致；P0 不顯示未支援按鍵。Phase 2 將原 P1/P2 分歧列入衝突紀錄後統一，沒有將可選項升格必要功能。

```text
horizontal = normalizeIfNeeded(WASD) * speed  // 對角不加速
desired = yawRotate(horizontal)*h + up*verticalVelocity*h
controller.computeColliderMovement(capsuleCollider, desired, filters)
corrected = controller.computedMovement()
player.setNextKinematicTranslation(player.position + corrected)
if grounded and verticalVelocity < 0: verticalVelocity = 0
else: verticalVelocity += gravityY*h
```

實作須決定重力積分先後與接地接縫容差，並固定版本；本段只列資料流。起步不啟用 autostep，先驗證牆／斜坡／門洞，再用 fixtures 開啟。角色可推物時使用有限 `characterMass` 並測試 controller 的 dynamic impulse 選項；不能把它當成完全動態的人體。Camera 取 capsule 的安全位移加眼高；眼高不可穿出 capsule 包絡。若未來靠牆探頭或第三人稱，須新增 camera sphere sweep。

## 3. 選取、抓取與受阻

1. 準星每幀顯示 query hover，按動作鍵時在下一 physics tick 重新 raycast，避免使用過期 hover。
2. ray 由眼點往視線方向，方向正規化，預設有效距離 `3 m`；排除自己／ghost，保留牆等 blocking 物。
3. 第一個命中物先檢查是否 active、Dynamic、可抓、質量及尺寸上限、是否受其他控制器佔用。Fixed / Kinematic 顯示「已固定」／「受控運動」，不自動改成 Dynamic。
4. 儲存 `entityId`、revision、grip 的物件本地座標、當前 pose、configuredMode 與控制器參數。抓取是一個暫時 constraint 狀態，與物理模式正交。
5. 生成 virtual hold target，距離夾在 `max(0.75 m, playerRadius + objectBoundingRadius + 0.1 m)` 到 `3 m`。太大物件沒有合法距離就拒絕抓取。
6. 以物件形狀 sweep 限制前進，再驗證候選 pose 的 overlap；兩種查詢排除被抓 body 自身的全部 colliders，保留玩家與環境。牆前停住並讓物件追蹤誤差可見。阻塞時準星顯示「受阻」，不把物件 warp 到目標。
7. 每 tick 施加 [PHYSICS_ARCHITECTURE.md](PHYSICS_ARCHITECTURE.md) 的有界 impulse 與 torque；調距離、旋轉也遵守速度限制。

被抓物保持原重力設定、質量、collider 與碰撞屬性。Fixed 需明確 unlock；不支援物件只顯示原因。運行中超距／entity 刪除／NaN 時安全 drop 並記 fault reason；一般操作由明確 Drop、Freeze 或 Delete 命令結束持有。暫停／失焦保留 Held 快照而不繼續加力，不能當成自動 drop 的理由；不回溯物理歷史。

## 4. 放下、投擲與推力

- **Drop**：移除暫時控制器，保留實際線／角速度與 configuredMode，不加額外 impulse。原本 No Gravity 仍 No Gravity。
- **Throw**：先移除控制器，同一 tick 在 COM 加一次 `Jthrow`。初版用固定、可設定的絕對 impulse：`Jthrow = direction * Jconfigured`（建議 `6 N·s`），不做長按蓄力；因此較重物增速較小。不每個 render frame 重複呼叫，不用 `setLinvel` 抹掉原來動量。
- **Push（後續工具，P0 未配置鍵位）**：未抓時，短距離 ray 第一個 Dynamic 物，於接觸點給一次有限 impulse；偏心點會產生旋轉，事件記錄施力點。Fixed / Kinematic 回覆原因。
- 投擲前檢查手前 clearance、enable CCD、總速度上限。若超出 demo 的 `12 m/s`、`12 rad/s` 範圍，依速度剩餘預算縮小本次增量並顯示飽和；不要偷偷改掉既有實驗動量。原本已超速的物件禁止再加速，但可自然移動。

上述數值屬待調參設計。投擲一定帶 `commandId` 去重；接受 tick、施加值、物件當時質量與結果速度都入 trace。點擊 UI 或重新鎖定滑鼠的手勢不能同時投擲。

## 5. Build ghost 與交易式放置

Ghost 是視覺預覽資料，沒有 active rigid body、音源或碰撞音效。可用不加入世界的 Rapier shape 做 query；不能讓 ghost 推動現有物件。

```text
AimSurface -> SurfaceFrame -> SnapCandidate -> ValidatePose -> Preview
                                              │ valid + Place command
                                              ▼
        pause -> PlacementPending -> revalidate -> Staged -> geometry ack
                                              │                 │ explicit Enable
                                              └-> rollback       ▼
                                                              Active
```

- Surface ray 先取得世界位置與法線，挑與法線不平行的穩定切線建立 basis，避免 quaternion 在極點翻轉。
- 以 collider 的支撐半徑把物件移到表面外，保留 `skin=0.01 m`；grid snap 預設 `0.1 m`、旋轉 snap `15°`，順序是先旋轉／尺寸、再表面 offset、再平面 snap、最後驗證。
- 先做 broad-phase 範圍檢查，再用所有 collider shapes 的 overlap／必要 signed contact distance 確認。純 AABB、ray 命中、綠色 mesh 都不能代表無穿透。
- 查詢須包含 Fixed、Dynamic、Kinematic 與玩家，忽略 sensors／ghost。Fixed-v-Fixed 不一定由動態接觸事件回報，故放置不能依賴接觸事件判定。[FP-03]
- 合法支撐接觸容許外側 skin 間距，不能將「與支撐 surface 同 entity」當作整體忽略條件；那會放進牆或地板內。
- `Place` 於固定步重新驗證 revision、玩家位置與 overlap；動物體已走進候選區則拒絕並保留 ghost，提供「位置已被占用」。不能只信上一幀結果。
- 確認放置先在安全 tick 暫停；建立可回復 pending entity，驗證後進 Staged：domain 已建立，runtime body 未啟用、不發聲。backend geometry 更新完成 ack 後顯示 Enable，使用者明確啟用才成 Active；另按 Resume 才前進時間。失敗全部回復。spawn velocity 預設零；mode 從 library preset／Inspector 明確選擇。這個兩階段流程不承諾不停模擬中的動態反射立即可用。
- 複製會產生新 `entityId`，複製設定但不複製運行中的速度／voice／實驗結果。固定、自由運動、尚未啟用三者顯示不同標籤。

## 6. Camera 與 Audio Listener

資料模型持有獨立 `EditorCameraPose`、`PlayerHeadPose`、`ListenerPose`。Three 的 AudioListener 可是 camera child，但這只是常見用法，不作本專案 Editor listener 位置的資料來源。[FP-04]

| Listener mode | 位置與方向來源 | 切換政策 |
| --- | --- | --- |
| `ScenePinned` | 場景內明確設置的 Listener 實體 | 編輯器 camera 移動完全不影響它 |
| `FollowPlayer` | capsule 位移加眼高；視線 quaternion | 使用者選擇才啟用，保存原 pinned pose |

進 FPS 預設保留原 listener 選擇；若跟隨，HUD 顯示「聆聽位置：玩家」。離開 FPS 回復原 `ScenePinned` pose，並標記 listener discontinuity。只保留一個活動 render listener；比較多接收點由 solver 計算或分次渲染，不創造多個互相覆寫的 AudioContext listener。

`ListenerVelocity` 由固定步頭部位置差計算；移位／teleport／切換時速度設 `0` 並帶 discontinuity，避免假 Doppler。方向正規化，以 world forward/up 更新 HRTF；音訊排程使用獨立時鐘映射與短暫 ramp。render interpolation 與鏡頭裝飾抖動不得污染正式運動速度。旋轉 Listener 不需改變位置速度，但會改 HRTF 朝向。音訊 renderer 是否自行處理 Doppler 必須另行明示，不能僅送 velocity 就宣稱已實現。

## 7. 驗收與來源

尚待正式互動實作驗證：三模式 round-trip、ESC／失焦／library 開關、碰牆抓取、重物下垂、No Gravity drop、放置 race、Listener pinned 不跟相機、FollowPlayer 的方向／眼高正確。記錄 framebuffer／trace／最大穿透與控制 impulse，不能只依「看起來正常」宣告通過。

官方來源（皆查於 2026-10-26）：

- **FP-01**：[PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html)、[W3C Pointer Lock 2.0 Working Draft，2026-02-25](https://www.w3.org/TR/2026/WD-pointerlock-2-20260225/)；後者是草案，實際瀏覽器支援仍需執行確認。
- **FP-02**：[Rapier Character Controller](https://rapier.rs/docs/user_guides/javascript/character_controller/)、[KinematicCharacterController API](https://rapier.rs/javascript3d/classes/KinematicCharacterController.html)。
- **FP-03**：[Rapier Scene queries](https://rapier.rs/docs/user_guides/javascript/scene_queries/)、[World query API](https://rapier.rs/javascript3d/classes/World.html)、[Rigid body type](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)；放置策略是本專案設計。
- **FP-04**：[Three.js AudioListener](https://threejs.org/docs/pages/AudioListener.html)；獨立 listener 資料、速度與還原政策為本專案設計。
