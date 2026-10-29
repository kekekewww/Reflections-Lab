# 第一人稱物理架構

查核日期：2026-10-26（Asia/Taipei）。狀態：研究與架構建議；尚未實作正式互動產品。本文的參數是待驗證初值，不是實測穩定性保證。

## 1. 選型與證據範圍

建議以 Three.js 顯示、Rapier 3D WASM 執行剛體與查詢、TypeScript 管理命令及快照。第一人稱視角使用 `PointerLockControls` 處理滑鼠方向；玩家位移交給 Rapier `KinematicCharacterController`。兩者職責不同：PointerLockControls 的 `moveForward` / `moveRight` 會直接改攝影機位置，因此產品位移路徑不用這兩個方法。[PH-01][PH-02]

| 套件 | 建議固定版本 | 授權 | 本階段用途 |
| --- | --- | --- | --- |
| `three` | `0.186.1` | MIT | 正式實作候選；PointerLockControls 為同版 addon |
| `@dimforge/rapier3d-compat` | `0.21.0` | Apache-2.0 | 隔離 smoke 與 Web MVP 候選 |

`-compat` 將 WASM 編入 JavaScript，方便 bundler 初始化，但封裝較大。若後續改用獨立 WASM 主套件，需重新測試載入、部署 MIME 與快取，不能視為零成本替換。授權分發時保留上游 LICENSE／必要 NOTICE；完整授權登錄由 `docs/01-compliance/` 管理。[PH-03][PH-04]

## 2. 模組界線

```text
InputRouter / SceneCommandQueue
                │ fixed-step commands (revision + tick)
                ▼
PhysicsWorld ─ CharacterMotor ─ GrabController ─ PlacementValidator
    │               │                │
    └──────── authoritative poses + velocities + contact events
                         │
             PhysicsSnapshot / PhysicsAudioBridge
                  │                 │
          Render interpolation   Acoustic worker / audio scheduling
```

- `PhysicsWorld` 唯一能改實體剛體；UI、AI、編輯器不得直接寫 mesh transform 代替物理命令。
- `SceneCommandQueue` 在步進邊界驗證命令，帶 `commandId`、`sceneRevision`、`tick`；模式切換、生成與刪除是可撤銷交易。Build 的 `Preview → PlacementPending → Staged → Active` 需安全暫停、geometry ack 與明確 Enable，不自動啟用。
- `PhysicsSnapshot` 為不可變 plain data；WASM handle、暫存 manifold 不跨 Worker、不傳 AudioWorklet。
- `Render interpolation` 可平滑顯示；下一步查詢、碰撞音效與實驗數據仍取物理快照。
- 編輯器暫停時可交易式修改 pose，並標記 discontinuity；模擬中只能透過動力或受控運動命令移動。

## 3. 座標、單位與步進

採右手系，`+Y` 向上，攝影機前方為本地 `-Z`；公尺、公斤、秒、弧度、牛頓、牛頓秒。旋轉儲存正規化 quaternion（`x,y,z,w`）。一般場景重力初值 `(0,-9.81,0) m/s²`，可由實驗設定覆寫。物理 collider 與聲學表面共享 `entityId`／`surfaceId`，但幾何精度與生命週期分開。

初版固定 `h = 1/60 s`，畫面可 30–144 Hz；以 `world.timestep = h` 步進。互動壓力測試另比較 `1/120 s`。下例是排程契約，不是產品程式：

```text
onFrame(realDelta):
  if suspended: clearInput(); return
  accumulator += realDelta       // recorded run 不 clamp／丟棄 wall-time
  steps = 0
  while accumulator >= h and steps < 4:
    applyCommands(tick)
    sampleInputAndComputeCharacterMove(h)
    constrainGrabTargetBySweeps(h)
    applyBoundedGrabImpulses(h)
    snapshotPreSolvePointVelocities()
    world.step(eventQueue)
    copyAndAggregateContacts(tick + 1)  // 不保留 Temp* 參照
    publishSnapshot(tick + 1)
    accumulator -= h; tick += 1; steps += 1
  if accumulator >= h:
    pauseAndReportOverrun()  // 保存 backlog，不靜默跳 logical tick
    renderCurrentFrozenPose(); return  // 不用 alpha>=1 外插
  render(previous, current, accumulator / h)
```

非錄製的探索模式可明示降速／丟棄 wall-time 並記 telemetry；錄製／A/B 模式遇過載暫停，記錄原因、不漏 logical tick，不靠可變 `dt` 追趕。頁面失焦／隱藏預設安全暫停並保留 Held／ghost；logical tick 停止時控制器不繼續施力。音訊依 Freeze-and-fade 淡出與保存 pending arrivals，Resume 明確建立新 audio epoch。接觸與輸入排序固定，記錄套件、WASM、場景及控制器版本；只記鍵鼠不能保證同一軌跡。Rapier guide 與套件 README 對跨平台 determinism 的描述不一致，故本專案目前不承諾跨平台 bit-exact 重播；以實測 hash 與 transform／velocity 時序為驗證依據。[PH-05]

正式事件契約以 tick `0` 為初始狀態，step `n→n+1` 的步後 snapshot 標記 `tick=n+1`、`simulationTime=(n+1)*h`。離散 contact 的真實發生時間只保證落在這個 step 區間，不能把步後 timestamp 稱為 CCD 精確接觸時刻。隔離 smoke 的 loop index 是該測試內部標籤，與正式事件 tick 定義分開。

## 4. 抓取候選比較與初版決策

| 方法 | 碰撞與質量反應 | 優點 | 風險／API 限制 | 初版角色 |
| --- | --- | --- | --- | --- |
| Camera transform parenting | 繞過接觸求解 | 顯示容易 | 穿牆、速度失真、沒有慣性 | 禁用於實體抓取 |
| Kinematic anchor + fixed / spherical joint | 被抓物維持 Dynamic，由 solver 解約束 | 少量程式、接觸耦合 | anchor 幾乎無限作用力；硬約束撞牆易抖動；抓取點偏心有大力矩 | 備選 spike |
| Kinematic anchor + spring joint | Dynamic；彈簧允許誤差 | 自然延遲、可調剛度阻尼 | 太硬仍可能震盪；`JointData.spring` 有長度／剛度／阻尼，但 JS Spring joint 未提供通用力上限 setter | 受控 demo 候選 |
| 每步 `setLinvel` 速度伺服 | contact solver 隨後可修正速度 | 易實作 | 每步重新覆寫可抵銷接觸反應；無清楚施力上限時像無限馬力 | 不作預設 |
| 有界 PD／速度誤差 impulse servo | Dynamic，力經質量與慣性限制 | 明確上限、可觀察受阻與重量、易重播 | 需要誤差／旋轉／目標掃掠政策；全場景穩定性仍需測試 | **建議 P0** |

此選擇是工程判斷：初版重視可限制控制能量、可除錯及碰撞時允許落後，不宣稱已證明對所有形狀最穩。官方已有 `PidController`，但直接 `applyLinearCorrection` 並未在其 JS API 露出單次力上限；可先取得 correction 後審查原始碼與單位再封裝，不把未驗證 API 當成現成有界抓取器。[PH-06]

### 4.1 平移控制契約

被抓物保持 Dynamic，不改為 Kinematic，不關碰撞，不零化重力。以 virtual grip 計算目標，但初版平移脈衝施於 COM，旋轉用獨立力矩；避免 `applyImpulseAtPoint` 的偏心力矩繞過單獨的旋轉上限。

令 `p_t` 為掃掠後目標 COM，`x,v` 為 COM 當前位置與速度，`v_t` 為限速／平滑後目標速度，`e=p_t-x`。用 backward-Euler 的線性彈簧阻尼近似產生候選修正：

```text
kp = wn²                  // s⁻²
kd = 2*zeta*wn             // s⁻¹
dv = h * (kp*e + (kd + kp*h)*(vt-v)) / (1 + kd*h + kp*h²)
Jraw = m * dv             // kg*m/s
J = clampNorm(Jraw, min(FhandMax*h, m*amax*h))
body.applyImpulse(J, true)
```

推導假設一個無接觸、目標等速、線性自由度；此分母降低顯式硬彈簧的數值風險，但接觸、力上限與飽和後不是線性系統，必須另外驗證。`FhandMax` 為絕對手力上限：較重物可有較大誤差，不能只乘質量後讓各質量永遠同樣追蹤。重力由物理引擎處理；若加入助力，助力也算進同一總力預算，並記錄 `assistMode`。

建議起始值：`wn=10 rad/s`、`zeta=1`、`FhandMax=150 N`、`amax=20 m/s²`、目標速度上限 `3 m/s`、抓取質量 `0.1–20 kg`。它們是可調 demo 邊界，不是人類生理數據。先在 `0.1/1/5/20 kg`、薄牆、角落與堆疊中比較誤差及穿透，再鎖定參數。

### 4.2 旋轉控制與故障收斂

`q_e=q_t*inverse(q)` 選最短弧（若 `w<0` 取負），換成世界空間 axis-angle 誤差 `e_r`。以同類公式求候選 `Δωraw`，先限制 `Δω=clampNorm(Δωraw,αmax*h)`，用世界慣性矩陣 `I_world` 計算 `Lraw=I_world*Δω`，再限制 `|L| ≤ τmax*h`，呼叫 `applyTorqueImpulse(L,true)`。鎖定旋轉軸不加入控制；初版只允許未鎖定且正定有限慣性的 primitive。`τmax=15 N·m`、`αmax=30 rad/s²`、目標角速 `2 rad/s` 為待驗初值。大角度／形狀旋轉掃掠不足時減小目標角速，必要時保持上一個有效方向。

若受阻造成 grip 誤差大於 `0.75 m` 持續 `0.25 s`，停止往牆後延伸目標；運行中誤差大於 `1.5 m`、物件被刪除或非有限數值時，於下一固定步安全 drop。失焦／Workspace 切換只暫停並保留抓取快照；進 Build 需 Idle 或明確釋放。此政策允許物體落後或掉落，不能為了貼準鏡頭而 teleport。每個步進輸出 `trackingError, impulse, torqueImpulse, saturated, blocked` 供診斷。

## 5. 碰撞與查詢規則

- 一般物件用 box / ball / capsule / convex；動態凹形物用 compound／凸分解，不直接以任意 trimesh 當可抓動體。模型 render mesh 與 collider 分離。
- 選取 ray 以正規化方向限定公尺距離；第一個 blocking collider 優先，不能因前方不可抓就穿過它選後方物體。排除玩家自身與純 preview。
- Hold target 從當前物件 pose 向預期位置做 `castShape`，保留 skin；再驗證候選方向與位置的 `intersectionsWithShape`。這兩種 query 都以 `filterExcludeRigidBody=heldBody`（或同等 predicate）排除被抓本體的全部 colliders，否則會一直命中自己；仍保留玩家、牆及其他動體。`castShape` 是線性掃掠，不能自行假設涵蓋所有旋轉軌跡。[PH-07]
- 被抓物與牆、地板、其他 Dynamic 碰撞保持啟用。玩家／被抓物預設也碰撞；hold 最小距離須大於 capsule 半徑加物件 bounding radius。受擠時 drop，避免用整體關碰撞掩蓋問題。
- 投擲／快速小物啟用 `enableCcd(true)`；`maxCcdSubsteps` 初值 `2`，不得為 `0`。0.21 官方說明對固定障礙有自動 swept collision，顯式 CCD 擴及移動對象；仍明載兩個 CCD 動體可能漏撞，因此薄牆、高速、旋轉案例必測，CCD 不等於絕不穿透。[PH-08]
- 所有 state switch 都在步界執行；詳見 [OBJECT_STATES.md](OBJECT_STATES.md)。事件在 `world.step` 後讀取；詳見 [PHYSICS_AUDIO_EVENTS.md](PHYSICS_AUDIO_EVENTS.md)。

## 6. 驗證契約

隔離驗證位於 `experiments/physics-spike/`，已執行 `node experiments/physics-spike/smoke.mjs`，**6/6 PASS**：自由落體、無重力慣性、Fixed→Dynamic、force／impulse、contact force／manifold impulse、空場 kinematic anchor spring。固定保存證據為 [rapier-win64-20261025T192231997Z.json](../../experiments/physics-spike/results/rapier-win64-20261025T192231997Z.json)，包含 source／lock／WASM hashes；`results.json` 僅代表每次重跑會覆寫的 latest。API smoke 不能替代 FPS 視覺測試、抓取穩定性或音訊聽測。

| Gate | 完成條件 | 本文件目前狀態 |
| --- | --- | --- |
| 最小 API / 數值 | 初始化、Dynamic／Fixed／position-Kinematic、事件、impulse 與 spring 在固定版本可呼叫 | 6/6 PASS；其餘 query / velocity-Kinematic NOT RUN |
| 質量與抓取 | 4 種質量，力／力矩不超上限，阻塞能停止目標，無無限能量 | NOT RUN |
| 碰撞 | 牆角、薄牆、狹門、堆疊、動體互撞、高速旋轉量化最大穿透 | NOT RUN |
| FPS | capsule 不穿牆、斜坡／台階、失焦安全、hold-drop-throw 循環 | NOT RUN |
| 效能 | 目標硬體 p50/p95/max step 耗時，100 動體及最壞 contact 峰值 | NOT RUN |

## 7. 官方來源與主張索引

以下均於 2026-10-26 查閱；線上文件可更新，實作還需對照 lockfile 的 `.d.ts`。本文公式與預設值標示為本專案設計，並非上游穩定性承諾。

- **PH-01**：[Three.js PointerLockControls 文件](https://threejs.org/docs/pages/PointerLockControls.html)、[r186 原始碼](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/controls/PointerLockControls.js)：addon 匯入、lock/unlock、方向與直接 camera 位移。
- **PH-02**：[Rapier Character Controller guide](https://rapier.rs/docs/user_guides/javascript/character_controller/)：kinematic 玩家、碰撞修正位移、無旋轉支援，重力由應用提供。
- **PH-03**：[three npm](https://www.npmjs.com/package/three)、[Rapier compat npm](https://www.npmjs.com/package/@dimforge/rapier3d-compat)：固定版本建議及 compat 封裝。
- **PH-04**：[Three.js MIT LICENSE](https://github.com/mrdoob/three.js/blob/r186/LICENSE)、[Rapier JS Apache-2.0 LICENSE](https://github.com/dimforge/rapier.js/blob/master/LICENSE)：上游授權；分發仍須核對實際套件內容。
- **PH-05**：[Rapier determinism guide](https://rapier.rs/docs/user_guides/javascript/determinism/)、[Rapier npm README](https://www.npmjs.com/package/@dimforge/rapier3d)：來源敘述差異、初始條件與建立順序限制。
- **PH-06**：[JointData](https://rapier.rs/javascript3d/classes/JointData.html)、[SpringImpulseJoint](https://rapier.rs/javascript3d/classes/SpringImpulseJoint.html)、[GenericImpulseJoint](https://rapier.rs/javascript3d/classes/GenericImpulseJoint.html)、[PidController](https://rapier.rs/javascript3d/classes/PidController.html)：有公開 joint／PID 介面，不等於都有可設力上限。
- **PH-07**：[World](https://rapier.rs/javascript3d/classes/World.html)、[Scene queries guide](https://rapier.rs/docs/user_guides/javascript/scene_queries/)：ray、shape sweep、overlap 與過濾能力。
- **PH-08**：[Rapier CCD](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/)：CCD 行為、成本與已知穿隧限制。
- **PH-09**：[RigidBody](https://rapier.rs/javascript3d/classes/RigidBody.html)、[Rigid-bodies guide](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)：mass、慣性、模式、持續 force 與即時 impulse。`addForce` 會跨步持續，不能每步累加而不清除；本設計用一步 impulse 避開這類累積錯誤。
