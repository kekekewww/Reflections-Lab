# 物件生命週期與物理狀態

查核日期：2026-10-26。狀態：狀態機設計；API 最小驗證以 `experiments/physics-spike/` 結果為準。

## 1. 使用三層狀態

生命週期 `Preview / PlacementPending / Staged / Active / Removed`、物理模式 `DynamicGravity / DynamicNoGravity / Fixed / Kinematic`、互動狀態 `Free / Held / ProgramControlled` 分開儲存。`Held` 不是一種 RigidBodyType；`Fixed` 與 `gravityScale=0` 的動體行為不同。`simulationState=Paused` 亦為獨立狀態，會保留 Held 快照並停止步進，不改 body type。

| 生命週期 | 世界中的 collider／body | 聲音與聲學 | 可做操作 |
| --- | --- | --- | --- |
| Preview | 無 active body；用 query shape 驗證 | 無 source、無碰撞事件 | 移動 ghost、取消 |
| PlacementPending | domain entity 正在驗證，尚未加入 active world | 未註冊 source / surface | 安全暫停、固定步邊界重驗、commit／rollback |
| Staged | domain 已建；runtime body / collider 尚未啟用 | source 不發聲；等待 backend geometry ack | 明確 Enable 或取消回復，不能碰撞／推物 |
| Active | 已建立指定模式的 body / colliders | 依功能啟用 source / surface | 操作、模擬、轉換、刪除 |
| Removed | handle 已無效且事件快取清除 | fade out / release | 只能透過 Undo 交易重新建立 |

本設計不靠 disabled 物理本體代表 ghost，避免 queries 與聲學註冊混淆。`PlacementPending` 是短暫交易狀態；`Staged` 可顯示為「已建立／待啟用」，geometry ack 後由使用者選擇 Enable 並另行 Resume，不能自動變成 Active。

## 2. 物理模式映射

| Domain mode | Rapier | 重力 | 外力／動量 | 位置政策 |
| --- | --- | --- | --- | --- |
| DynamicGravity | `RigidBodyType.Dynamic` | `gravityScale=1` 或明確實驗比例 | 有質量與慣性，受接觸、摩擦、impulse 影響 | solver 積分 |
| DynamicNoGravity | 同上 | `gravityScale=0` | 保留原速度、質量與碰撞；仍可被推擲 | solver 積分 |
| Fixed | `RigidBodyType.Fixed` | 不影響 | 外力不能移動 | 編輯交易才能改 pose |
| Kinematic | position-based（P0）或 velocity-based（明確設定） | 不影響 | 不受普通力改動，能影響 Dynamic | 指定軌跡；position-based 用 next pose |

Rapier 官方定義 Fixed 不因 force 移動，Kinematic 不受一般 force／impulse；kinematic 的路徑仍需應用避免穿牆。NoGravity 是 Dynamic 的重力比例設定，不是固定。[OS-01]

Domain `configuredMode` 記錄使用者意圖；`controllerOwner` 記錄暫時控制來源。禁止兩個控制器同時改同一物件。物件有非零、有限的質量與慣性才能做抓取；UI 的「質量」不可把零當無重力。

## 3. 切換交易與還原政策

所有剛體模式切換（非 Workspace／Pause 切換）先完成輸入驗證，於固定步取得 memento，解除 Held／ProgramControlled，清理控制器，再更新 Rapier type／gravity／velocity。最後 wake 並發出 `BodyModeChanged`、pose revision 與 `discontinuity`。切換失敗回復完整 memento，不能只改 UI 標籤。

| 切換 | Pose | Linear / Angular velocity | Sleep / Wake | 還原政策 |
| --- | --- | --- | --- | --- |
| Gravity on ↔ off | 保留 | **保留** | `setGravityScale(scale,true)` | 不回復過去速度；只是更改加速度 |
| Dynamic → Fixed（Lock） | 保留 | 寫零；清自訂 force / torque | 不使用 sleep 代替固定 | 記住原 configured Dynamic mode；舊速度只留 Undo |
| Fixed → Dynamic（Unlock） | 保留；先檢查空間 | 預設零 | `setBodyType(Dynamic,true)` 並 wake | 回復 Lock 前的重力模式；不恢復舊拋擲動量 |
| Dynamic / Fixed → Kinematic | 保留；next pose 初始化為當前 pose | 由軌跡從零啟動，禁止沿用垃圾 velocity | 受控 | 保存原 mode；軌跡以固定 tick 排程 |
| Kinematic → Dynamic | 保留 | 預設零；若選 transfer，使用最後軌跡有限差分且有上限 | wake | 明確選擇 `Zero` / `TransferTrajectoryVelocity` 並入 trace |
| Kinematic → Fixed | 保留 | 零 | 不再排程軌跡 | 清 trajectory owner |
| 任意模式刪除 | tombstone 保存 domain 設定 | 清快取 | remove 及釋放 | Undo 以新 Rapier handles 重建，domain ID 按交易政策還原 |

位置／旋轉的命令要明確區分 `Teleport` 與 `ControlledMotion`。模擬中的正常移動不能每幀 `setTranslation`；kinematic 正常移動使用 `setNextKinematicTranslation/Rotation` 以讓引擎推導速度。[OS-02]

`memento` 至少包含：`entityId`、geometry / collider version、pose、`v,ω`、body type、configured gravity、mass / inertia settings、damping、CCD、locked axes、collision / solver groups、sleep flag、controller configuration、source / surface binding、scene revision。Undo 在暫停狀態還原，遇 scene revision 衝突要求重新驗證；不宣稱單物件 Undo 等於逆轉完整世界的物理歷史。

## 4. Grab、接觸與睡眠

- 只有 Free Dynamic 能進 Held。抓取不改 type、重力、質量、碰撞 groups。Drop / Throw 只移除控制器，實際速度保留；原重力不需「猜測式還原」。
- Lock、Delete 等明確改物件命令先結束 Held，再執行交易；物件在同一 tick 不得同時收到 throw 與 freeze。以 command 序號與優先序決定，拒絕事件有原因。單純失焦／unlock／Workspace 切換則安全暫停，保留 Held／ghost 快照，不做 drop；恢復需明示 Resume。
- Resume 先重驗 object generation、collider revision、grip 與目標空間，再恢復／重建同物件的控制器；以有界 ramp 提升力預算。ID／幾何無法還原時保持 Paused，提供明確 Release，不能沿用失效 handle 或偷偷換物件。
- `isSleeping` 是動態最佳化，與 Fixed 不同。使用者抓取／推擲／解鎖／重力切換需 wake；全世界重力改變也要明確喚醒受影響物件。[OS-03]
- 切換後接觸資料由下一次 `world.step` 重建，不手動保留舊 manifold。為舊 pair 發出 domain `ContactInvalidated(reason=modeChange/delete/teleport)`，不要偽造物理 `ContactEnd` 或當新碰撞發聲。
- 接觸／音效 dedup key 加入 entity generation 與 contact episode；刪除再生成不能意外沿用 cooldown。
- Lock 時若強制移動 scene geometry 導致其他物件重疊，回復前先檢查／喚醒受影響鄰居。解除固定不保證碰撞世界自動無穿透。

## 5. 調整尺寸與材質

物理摩擦／彈性與聲學吸收／散射／傳輸是不同欄位。材質更改可增加 revision；不憑聲學材質自動猜質量或 friction。縮放需重建 collider 及重算質量／慣性，不能只縮放 Three mesh；旋轉不套用負 scale 或 shear。Scene hierarchy 不作 Dynamic 物體的 transform parent；視覺組織與物理 world pose 分離。

## 6. 驗收案例

| 案例 | 預期 |
| --- | --- |
| 移動中關重力 | 當刻速度不歸零，後續沒有重力加速度 |
| 無重力物件受 impulse | 有質量的動體增速，碰撞仍作用 |
| 固定物件受 impulse | pose 不改變 |
| 有速度物件 Lock 再 Unlock | 同位置由零速開始，回復原重力模式 |
| Held NoGravity Drop | 保持 NoGravity，保留當刻 solver 速度 |
| Kinematic 碰牆 | 軌跡 validator 限制／拒絕；不能只相信 kinematic 接觸 |
| Delete / Undo | 無失效 handle 存取、無殘留 voice，重建後 revision 正確 |
| 切換時接觸持續 | 不因狀態重建製造一串 impact 聲 |

上述是正式驗收要求；已實際執行的最小 API 案例另見隔離 spike，其他均為 NOT RUN。

## 7. 官方來源

- **OS-01**：[Rapier Rigid-bodies guide](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)（查於 2026-10-26）：四種 type、gravity scale、mass、sleep 與 force / impulse 差別。
- **OS-02**：[RigidBody API](https://rapier.rs/javascript3d/classes/RigidBody.html)（同日）：`setBodyType`、`setGravityScale`、`setNextKinematicTranslation`、`setNextKinematicRotation`、velocity／force 重置等方法。
- **OS-03**：[World API](https://rapier.rs/javascript3d/classes/World.html)（同日）：body 移除、步進、snapshot；交易與還原政策是 Reflection Lab 設計，並非引擎提供的 Undo。
