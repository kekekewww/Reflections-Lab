# Physics-to-Audio 事件契約

查核日期：2026-10-26。狀態：資料流與防重複設計；隔離 Node/WASM smoke 已驗證部分 API，尚未播放實際音訊或完成 AudioWorklet。

2026-10-27 Sound Behavior擴充：本頁維持PhysicsStamp／contact／audio epoch權威；作者trigger見 [Event Model](../10-sound-behaviors/EVENT_MODEL.md)，固定Rapier0.21 mapping與新增隔離probe見 [Physics Bridge](../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md)。不代表正式聲音runtime完成，也不改pause／propagation clock。

## 1. 時間、身分與所有權

物理世界每固定步輸出 `TransformBatch`，碰撞回呼讀完後立即複製為 plain data，再交給聲學及音訊端。`TempContactForceEvent`／`TempContactManifold` 不可留到 callback 外非同步使用。[PA-01]

```typescript
type PhysicsStamp = {
  experimentId: string;
  sceneRevision: number;
  tick: number;
  simulationTimeSeconds: number; // tick * fixedDt；暫停不前進
  fixedDtSeconds: number;
  sequence: number;
};

type BodyPose = {
  objectId: string;
  generation: number;
  poseRevision: number;
  positionMetres: Vec3;
  rotation: Quaternion;
  linearVelocityMetresPerSecond: Vec3;
  angularVelocityRadiansPerSecond: Vec3;
  discontinuity: boolean;
};
```

`objectId / colliderId / surfaceId` 是 domain 穩定識別；Rapier handle 只在 runtime adapter 內查表。實測 handle 出現 `5e-324` 等 opaque 值，不當成一般遞增整數、不作跨 session ID。`generation` 避免刪除再建立時碰撞 dedup 誤認舊物件。

正式 tick `0` 是初始狀態；第 `n→n+1` 步完成後的 pose／contact stamp 為 `tick=n+1`、`simulationTime=(n+1)*h`。Contact onset 的 timestamp 是固定步精度，若沒有 substep 資料不能稱為精確 impact time。獨立 smoke 的 loop index 僅作該結果定位，不當作正式 emission clock。

`PhysicsStamp` 只代表 simulation 時間，不等於 `AudioContext.currentTime`。Audio scheduler 維護 `audioTime = epochAudioTime + (simulationTime - epochSimulationTime) + schedulingLead`。Pause 採 Freeze-and-fade：logical tick、source offset、Held／ghost 及 pending logical arrivals 凍結；run bus 淡出（`20 ms` 待驗初值）、舊 epoch 排程取消，尾音截斷並記 interrupted boundary。Resume 建新 epoch，只重排尚未到達的 logical queue 一次，不能重新觸發已聽過的 emission。AudioContext 不需停住設備時間；paused audition 使用獨立 epoch，不能污染原 trace。傳播延遲另由 acoustic path 計算；裝置延遲、DSP 延遲、傳播延遲分欄記錄，不能混為一個 timestamp。

## 2. 事件種類與最少欄位

| 事件 | 內容與用途 |
| --- | --- |
| `TransformBatch` | 物件／source pose、COM／source offset 速度、listener pose／velocity、revision；供 direct sound、遮蔽、反射、Doppler 候選模型 |
| `ContactBegin` / `ContactEnd` | stable pair key、episode、開始／結束 tick；屬接觸生命週期，不自動等於可聽 impact |
| `ContactSample` | 世界接觸位置、法線、接觸雙方 surface / material、法線 impulse、force 診斷與相對速度來源 |
| `ImpactCandidate` | 經門檻、合併、cooldown 後的單次觸發；標示資料是實測 solver／近似推導 |
| `FrictionLoopUpdate` | contact episode、切向速度、支撐 force、rolling/scraping 類型候選；平滑參數而非每步新 voice |
| `ContactInvalidated` | modeChange / delete / teleport / replayReset；清狀態並 fade，不能偽裝新碰撞 |
| `BodyModeChanged` | old/new mode、commandId、restorePolicy、discontinuity；供結果解讀 |

建議完整 `ContactSample`：

```typescript
type ContactSample = PhysicsStamp & {
  pairKey: string;                 // canonical domain collider IDs + generations
  episodeId: string;
  objectA: string; objectB: string;
  colliderA: string; colliderB: string;
  surfaceA: string; surfaceB: string;
  materialA: string; materialB: string;
  materialRevisionA: string; materialRevisionB: string;
  pointWorldMetres: Vec3;
  normalAtoB: Vec3;               // canonical orientation，正規化
  normalImpulseNewtonSeconds: number | null;
  impulseMethod: 'RapierContactImpulse' | 'ForceDtEstimate' | 'Unavailable';
  totalContactForceMagnitudeNewtons: number | null;
  maxContactForceNewtons: number | null;
  relativeVelocityMetresPerSecond: Vec3 | null;
  velocityMethod: 'PreStepRigidBodyEstimate' | 'PostSolveSample' | 'Unavailable';
  closingSpeedMetresPerSecond: number | null;
  tangentSpeedMetresPerSecond: number | null;
  representativePointMethod: 'GeometricContactMidpoint' | 'SolverRepresentative';
};
```

source 綁定點不在 COM 時，`v_source = v_COM + ω × (p_source - COM)`；listener 速度按其控制模式取固定步值。teleport、切 listener、場景 reset 的速度設零並標記 discontinuity。靜止 source 的 Transform 可只在 revision 改變時傳送；活動物件整批傳，接觸重要事件不得被普通 pose 更新覆蓋。

## 3. Rapier API 的實際語意

碰撞 events 需至少一方 collider 開 `ActiveEvents.COLLISION_EVENTS`；接觸力 events 需 `CONTACT_FORCE_EVENTS` 並設定合理 threshold。兩者不同佇列。Contact force event 提供 `totalForce()`、`totalForceMagnitude()`、`maxForceMagnitude()`、`maxForceDirection()`，**沒有直接的 contact impulse 欄位**。總 force magnitude 是各接觸力大小的和，不是 total force 向量的長度。[PA-01][PA-02]

`world.contactPair(colliderA,colliderB, callback)` 可讀 manifold；`contactImpulse(i)` 是幾何 contact 的解算後法線 impulse（N·s）。`localContactPoint1/2(i)` 是各自 collider local space，需用對應 collider pose 轉為世界座標；`normal()` 為世界方向，再依 callback `flipped` 及 canonical A/B 排序調整方向。`solverContactPoint(j)` 提供世界座標，但 `j` 與幾何 contact 的 `i` 是不同索引域，**不能把 contactImpulse(i) 直接配 solverContactPoint(i) 當作一對一**。[PA-03]

本專案對每個幾何 contact，以兩側世界接觸點的中點作代表位置；同 surface patch 的 impulse 可合併，位置用正 impulse 加權。若只能取 solver representative，將方法標示為近似，不能假裝精確 impulse 作用點。取不到 manifold 時 `normalImpulse=null`；只有 force 時可另計 `F*h` proxy 並標記 `ForceDtEstimate`，不可默默用零代替未知。複合形狀多 manifold、多法線及 CCD 的中間接觸資料未必都留在步後狀態，第一版不聲稱提供每次微接觸的完整力時序。

下列是真正執行的隔離證據：1 kg 球落地，`h=1/60 s`，tick 30 force 約 `304.109741 N`、讀回 normal impulse 約 `5.068496 N·s`；之後靜置仍每 tick 有 `9.81 N` 支撐力及 `0.1635 N·s` impulse。因此「非零 impulse」不能當作 impact 音效條件。來源為 [spike README](../../experiments/physics-spike/README.md) 與 [固定保存結果](../../experiments/physics-spike/results/rapier-win64-20261025T192231997Z.json)；`results.json` 是可覆寫 latest，不作固定時間的不可變證據。這不是音訊聽測結果。

## 4. 相對速度與強度估計

同一接觸點的相對速度定義為 `v_rel = v_B(point) - v_A(point)`，法線由 A 指向 B，接近速度 `v_close=max(0,-dot(v_rel,n))`，切向速度 `v_tan=|v_rel-dot(v_rel,n)*n|`。步後的 velocity 已被 solver 降低，不適合冒充碰撞前速度。

初版保存每步 solve 前 `pose,v,ω`，在步後接觸位置估計剛體點速度，標記 `PreStepRigidBodyEstimate`。它不是 Rapier 事件原生提供的 CCD 精確接觸前速度；高速、多接觸或同一步多次碰撞需容許誤差。只有 post-solve 值時保留不同標記並降低強度判斷信心。

Demo 的質量／速度強度 proxy 可取 `E_proxy=0.5*μ*v_close²`，`μ=1/(invMassA+invMassB)`（Fixed／Kinematic 的該項視為 0；分母 0 不產生候選）。這忽略偏心旋轉及接觸耦合，只用於 sample 驅動，不稱為精確損失能量。需要物理聲音能量時，另加入角慣性有效質量與振動模型。

Sample-based MVP 以材質 pair 選樣本、物件尺寸選頻譜 preset、impulse／速度 proxy 控制 gain 與 envelope。可用 `gain=saturate(k*log1p(J/Jref))` 作可調感知映射；`k,Jref` 是作者設定，不能當 dB SPL 校準。`SampleImpact` 與未來 `ModalSynthesis` 使用不同 backend 標籤，不能把播放金屬撞擊音檔稱為剛體振動求解。

## 5. 去重、遲滯與 cooldown

去重分成原始接觸、可聽 impact 及 voice 三層；保留 raw trace 供研究，丟棄 audible candidate 不可回寫成「沒有碰撞」。

```text
after world.step:
  drain collision events -> update canonical pair episodes
  drain contact force events -> copy values, collect candidate pair IDs
  contactPair each relevant pair -> copy contacts, aggregate surfaces
  for each surface patch:
    merge same tick / pair / surface cluster
    onset = new episode or rearmedAfterSeparation
    eligible = onset && !discontinuity && J >= Jmin && closingSpeed >= vmin
    if eligible and tick-lastAudibleTick >= cooldownTicks:
      enqueue ImpactCandidate; update lastAudibleTick
    else update existing friction/rolling envelope, never start a new impact per tick
```

建議初值（待聽測／測量，不是常數定律）：`Jmin=0.02 N·s`、`vmin=0.15 m/s`、同 surface patch 距離 `0.1 m`、pair cooldown `80 ms`、分離至少 `2 ticks` 才 rearm。低速接觸可有 `ContactBegin` 但不發聲。持續接觸下另一次快速打擊可用有遲滯的 closing-speed 上升沿重新觸發；需要 impulse 增量及 cooldown，不能只憑 force 峰值。真實小幅快速反彈可能被 cooldown 抑制，必須在結果標示 audible policy 與 raw trace 的差別。

同一 body 的 compound colliders 可能同時回報多 pair；先用 stable collider ID 去重，再於 object pair + surface region + tick 合併，不能無條件把兩面不同牆的撞擊併成一個。移除／切 mode／replay reset 清 episode，但首個 discontinuity tick 不發 impact。移動平台與玩家推力產生的音訊也走相同管線。

## 6. Voice limiting 與音訊執行緒

- 一個 `episodeId + soundFamily` 僅允許一個摩擦 loop。建議全域 impact voices `24`、每物件 `4`、rolling/scraping loops `8`，數值待測。
- 重複 `eventId` 直接忽略。優先序由估計可聽 gain、距離、事件新鮮度與實驗指定的 source 決定；額滿時偷用最低優先 voice，用 `5–20 ms` fade 釋放，不硬切波形。
- voice decision（接受、拒絕、被替換）入診斷 trace；多聲源 limiter 不可讓 acoustic solver 數據消失。
- 音訊 thread 只做有界 DSP，不執行 Rapier／geometry query／大量 allocation。主執行緒或 Worker 先整理 fixed-size batch；音訊端不保留任意成長的事件佇列。
- 持續音源讀平滑 pose／path 更新，與 impact one-shot 分流。遮蔽或 reflection 路徑的 birth/death 由 acoustic renderer crossfade，不透過重建所有 voices 完成。
- 過期事件超過排程容許值先計數，探索模式可降級，錄製／比較模式停止或標示失真。不能把一秒前 impacts 全在當前 audio frame 補播。

## 7. 驗證矩陣

| 案例 | 可機械檢查結果 | 狀態 |
| --- | --- | --- |
| 1 kg 球落地＋靜置 | 有 onset、力與 impulse 可取且維度不同 | Node smoke PASS |
| 同一事件重送／60 個支撐 steps | 最多一次 onset impact，不出60個 voices | NOT RUN |
| 合法反彈、兩面牆同時命中、compound | episode／surface 群組不錯誤合併 | NOT RUN |
| 刪除、mode switch、teleport、replay | 無幽靈 voice、無新撞擊假事件 | NOT RUN |
| 大量碰撞 | voice 上限有界；event drop可稽核；audio 無爆音 | NOT RUN |
| 空間與時間 | source position / listener 朝向正確；已知距離延遲與epoch一致 | NOT RUN |

## 8. 官方來源

均查於 2026-10-26；資料結構、門檻、增益及 voice 策略是 Reflection Lab 設計。

- **PA-01**：[Rapier Advanced collision-detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/)：contact / force events 啟用、graph 與 manifold，geometric / solver contacts 不同。
- **PA-02**：[TempContactForceEvent API](https://rapier.rs/javascript3d/classes/TempContactForceEvent.html)：force 聚合語意與暫時物件生命週期。
- **PA-03**：[TempContactManifold API](https://rapier.rs/javascript3d/classes/TempContactManifold.html)、[World API](https://rapier.rs/javascript3d/classes/World.html)：`contactImpulse`、local points、world solver point 與 callback。
- **PA-04**：[RigidBody API](https://rapier.rs/javascript3d/classes/RigidBody.html)：COM、velocity、angular velocity、`velocityAtPoint`；本專案碰撞前速度估計仍須標示來源。
- **PA-05**：[實際固定版 smoke](../../experiments/physics-spike/README.md)：API 與數值證據；不支持「已完成碰撞音效」的主張。
