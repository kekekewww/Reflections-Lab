# 物理與 Motion 架構研究

查核日期：2026-10-29（Asia/Taipei）。研究基準：`c210ca882ca8503b322c28884bf1e9f6e9fe126d`。本文盤點正式 `src/` 與現有測試；研究建議不代表使用者已接受的新產品範圍，也不取代 [V1 凍結驗收](../11-v1/ACCEPTANCE.md)／[驗收補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)。未修改 production code、物理公式、參數、既有 fixture 或驗收門檻。

## 判讀與結論

既有 Rapier adapter、固定步、動態抓取、Drop／Throw 與錄放可保留。最小架構方向是補明確的 Motion 意圖／能力／控制權契約，再接既有 adapter；沒有證據需要換引擎、把動態物件改為 camera child，或把作者 transform 當正常運動。正式 Move To／Move & Release 尚未實作，不能用 `setKinematicTarget` 或錄放存在推論這兩項已完成。

| 標籤 | 本文定義 |
| --- | --- |
| VERIFIED-SOURCE | 本次直接閱讀官方來源，只證明該文件所述能力 |
| VERIFIED-CODE | 本次讀到基準程式與測試內容；不是執行證據 |
| VERIFIED-PROBE | 下述有界、無聲 Rapier 程序本輪實際執行；不代表完整 runtime suite |
| HISTORICAL-TEST | 已有固定結果／報告，保留其 Git、來源與方法範圍 |
| APPROXIMATION | 數值或 Derived／Tuned 工程模型，不是真實接觸振動量測 |
| PROPOSED | 此次最小建議，未實作／未採納 |
| UNVERIFIED／NOT RUN | 未取得所需實測／本輪未執行，不以推論補齊 |

程式版本、Node 測試、browser、實體 Pointer Lock／IME、聽測與性能各自判定。既有 [R17](../11-v1/BROWSER_PERFORMANCE.md) 長測仍是性能與持續負載 FAIL；本研究不改成 PASS，也不宣稱全 V1 完成。原生 200% 已移除，不重新建立必要 gate。

## 現行狀態與程式證據

| 領域 | 實際行為與界線 | 證據／狀態 |
| --- | --- | --- |
| DynamicGravity | Rapier Dynamic、gravityScale=1；力、impulse、接觸由 solver 決定 | [PhysicsWorld](../../src/physics/physics-world.ts) `addBody`／`setMode`；VERIFIED-CODE |
| DynamicNoGravity | 同為 Dynamic，gravityScale=0；保留質量、慣性、碰撞。Gravity↔NoGravity 切換保留 v／ω | 同上；[四模式測試](../../tests/physics/physics-world.test.ts)；VERIFIED-CODE。gravity0 不等於真空 |
| Fixed | Fixed 不受一般 impulse 移動；切入 Fixed 清力與 v／ω；Unlock 以零速起動 | `setMode`；[InteractionHost](../../src/interaction/interaction-host.ts) `toggleFixed` 保存原重力模式與 generation；[unlock clearance](../../tests/interaction-runtime/unlock-clearance.test.ts) |
| Kinematic | position-based；`setKinematicTarget` 用 next pose，單次平移限制 `3*fixedDt` m，先 shape sweep；旋轉檢查終點 overlap | VERIFIED-CODE；[target 原子拒絕測試](../../tests/physics/physics-world.test.ts)。終點旋轉檢查不是 rotational CCD 證明 |
| 固定步／插值 | 預設 1/60 s；先控制再 step、步後收資料；render 插值不寫回 solver | [FixedClock](../../src/physics/fixed-clock.ts)、[clock tests](../../tests/physics/fixed-clock.test.ts)、[插值差異測試](../../tests/physics/interpolated-transform.test.ts) |
| 抓取 | active Dynamic、0.1–20 kg；同一 body 保持接觸求解，不改 mass／mode／collision groups；有界 impulse／torque servo＋shape sweep／overlap＋ramp | `grab`／`controlGrip`；[真 WASM 矩陣](../../tests/physics/v1-matrix.test.ts)、[薄牆回歸](../../tests/physics/physics-world.test.ts)；VERIFIED-CODE／HISTORICAL-TEST |
| 放手 Drop | 清 grip，保留當下 solver v／ω 與重力模式；成功命令產生 OnRelease＋OnDrop，command ID 去重 | `drop`；[NoGravity drop 測試](../../tests/physics/physics-world.test.ts)、[E key edge](../../tests/interaction-runtime/host.test.ts) |
| 投擲 Throw | 保留舊動量，再加方向 impulse；請求 0–20 Ns，依質量／當下 v 限制新 impulse，使原速低於 12 m/s 時不由此增量超過上限；原速已超過上限則增量為 0 | `throwHeld`；VERIFIED-CODE。不是把既有速度硬截為 12，也不從高速猜 Throw |
| Release collision | Drop／Throw 不關 collider；後續同一 Dynamic 照常接觸。碰撞音候選仍經 episode／強度／cooldown，不保證每次 release 都立即有 Impact | `drop`／`throwHeld`／`samplePair`；VERIFIED-CODE |
| 暫停／失焦 | 凍結 step、清輸入、保留 Held；Resume 重驗 object generation、幾何與目標空間。Pause 不假造 Drop／Throw | [InteractionHost](../../src/interaction/interaction-host.ts)、[host tests](../../tests/interaction-runtime/host.test.ts)；實體 Pointer Lock 與 IME 仍依真人 gate |
| Gentle Place | 既有 FPS 持有物件漸進接近有效支撐，接近且低速後呼叫 Drop；支撐失效取消輕放、仍保留 Held | `gentlePlace`／`refreshGentleSupport`／`beforeStep`；它不是一般的 Move To 作者系統 |
| Move To／Move & Release | 無版本化 Motion Registry、無通用作者命令／生命週期／完成條件；AI `SetTrajectory` 明確拒絕 | [Scene operation](../../src/scene/types.ts) 無此操作；[AI adapter](../../src/ai/scene-adapter.ts) 回 `CAPABILITY_UNSUPPORTED`；VERIFIED-CODE |
| 任意 impulse 作者工具 | adapter 有 `applyImpulse`，限制 finite vector；非 Dynamic 直接不作用，沒有完整 UI／AI 命令、Undo／意圖 trace | VERIFIED-CODE；不得由測試直接呼叫推成已交付工具 |

`OnRelease` 是成功放手事件，不是 body mode。Mode／delete／invalid grip 以 ContactInvalidated 結束控制，不偽造使用者 Drop。現有放手事件共用 commandId，但沒有正式雙方 body generation／release 原因／前後速度交易收據；若新增 Motion 應在自己的 receipt 明示，避免改寫舊 physics event 語義。

## 接觸、速度與音效資料

[PhysicsWorld `samplePair`](../../src/physics/physics-world.ts) 在步前保存 COM／v／ω，步後以 `contactPair` 複製幾何資料，處理 flipped collider 順序及 local→world quaternion transform。normal impulse 使用 solver `contactImpulse`，不是把 contact force N 改名為 impulse Ns。接觸點速度採 `v(point)=vCOM+ω×(point−COM)`，`closing=max(0,−dot(vB−vA,nAtoB))`；`PreStepRigidBodyEstimate` 代表以步前剛體速度場估算步後接觸代表點，屬 APPROXIMATION，沒有 CCD substep 精確入射時刻。

目前每個 SceneObject 只有一個 primitive collider（sphere／box／capsule），每 collider pair 聚合幾何 contacts。固定支撐優先採真實表面 witness，避免聲源落進地板；dynamic pair 用雙 witness 中點。`normalImpulse` 聚合、位置權重與 contact tolerance 是工程政策，不能稱聲功率或自然振動能量。見 [contact emission test](../../tests/physics/contact-emission.test.ts) 與 [bridge 舊來源](../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md)。

| 分類 | 現行實作 | 可信度／限制 |
| --- | --- | --- |
| Moving／Spinning | 固定步 enter／exit hysteresis，退出需兩個低速步；getter 不推進狀態 | Derived／Tuned；[motion hysteresis](../11-v1/MOTION_HYSTERESIS.md) 與 [真 Rapier tests](../../tests/physics/motion-hysteresis.test.ts) |
| Airborne | Dynamic 且無有效上向支撐；physics pose 可同時 Held＋Airborne，behavior `WhileAirborne` 另要求非 Held | 支撐法線以世界 +Y、門檻 0.4 判定；並非任意 scene-up 模型 |
| Sliding | 接觸點相對切向 slip，非 COM speed；固定支撐不被另一物件擦動誤標 Sliding | Derived／Tuned；選 high-slip patch 作連續聲音 anchor |
| Rolling | 只對有支撐球體；扣除支撐剛體在 COM 的速度場與相對角速度，排除法線軸 spin；與 Sliding 互斥 | Derived／Tuned 候選。任意 mesh／capsule／compound rolling 不支援，回 null |
| Impact | 新 episode onset、非 discontinuity、normal impulse＋closing speed 過門檻、pair cooldown | 保守可聽候選；持續支撐不逐 tick 重響；persistent-contact 新打擊 rearm 尚無正式能力 |
| Bounce | 產品 bridge 無 producer；不能用 restitution>0／ContactEnd／新 Impact 自動替代 | UNVERIFIED／未實作；schema evaluator 可接受合法外部 OnBounce 不等於本產品會產生 |

官方說明 collision／contact-force 是不同通知，contact graph 出現 pair 不保證已接觸；複合形狀可有多 manifold，1／2 欄位取決於實際 collider 順序。[Rapier advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/)（VERIFIED-SOURCE，查閱 2026-10-29）。本案的 episode／audibility gate 是應用政策。

## 第一／第三人稱共享狀態

現行第二視角是 editor OrbitControls，尚無跟隨角色的第三人稱控制器。[CameraRig](../../src/ui/viewport/CameraRig.tsx) 保存各 Workspace orbit view，FPS 由同一 `InteractionHost` 的 player eye pose 驅動；`LabRuntime.listener()` 在 FPS 使用 head pose，editor 使用獨立 Scene listener。切換相機不建立第二份物件／剛體世界。

共享權威依序為 Scene authoring ID／revision → PhysicsWorld body／generation → interaction 控制權 → copied view DTO；相機只消費 projection。若新增第三人稱，PROPOSED：共用相同 `InteractionHost` intent 與 PhysicsWorld，camera mode 不成為新的 body mode；單獨聲明 listener 是跟隨 head、camera 或 independent，並進錄製 trace。不要由畫面上的 orbit camera 偷改 listener，也不要複製一份 Held state。現有 [camera projection](../../tests/app/camera-projection.test.ts)、[listener projection](../../tests/app/listener-projection.test.ts)、[FPS entry race](../../tests/app/fps-entry-race.test.ts) 可作回歸；新增第三人稱本輪 NOT RUN。

## Motion 最小契約建議（PROPOSED）

維持 SceneSpec v1 與現有音效 schema。第一步只引入獨立、版本化的 Motion 定義／能力與純 domain validator，暫不承諾新播放 UI。每個 action 至少有 `actionId/revision`、`objectId/generation`、expected scene revision、`startTick`、控制種類、target pose、速度／加速度／impulse 上限、有限 duration／timeout、碰撞政策、release velocity 政策及來源。runtime state 另存 cursor／controller owner／last accepted target／receipt，不序列化 WASM object。

| 意圖 | 最小一致語義 | 必須拒絕／保存 |
| --- | --- | --- |
| Move To | 固定 tick 執行有限 move；Dynamic 用碰撞保留的有界 servo，Kinematic 才用 next pose。到達判定明示位置／角度／速度容差與穩定步數 | fixed body、同時 Held、stale generation、非法目標／超限、被擋 timeout；保存 reached／blocked／cancelled，而非一直寫 transform |
| Move & Release | 受控移動結束後原子解除本 controller。Dynamic 保留實際 solver v／ω；若由 Kinematic 切回 Dynamic，明示 Zero 或有限的 TransferTrajectoryVelocity | transfer 使用已接受的相鄰 tick pose／orientation，而非被拒的要求位置；被擋時不能偷偷穿牆或宣稱 reached |
| Apply Impulse | 一次 Ns 輸入、有限方向／幅度、Dynamic 條件、command ID 去重；不是持续 force | 對 Fixed／Kinematic 的拒絕需可見；不把 generic impulse 當 OnThrow |
| Cancel／Pause／Reset | Pause 凍結 cursor；Cancel 解除本 controller 並留下原因；Reset 換 epoch | 不發 OnStopMoving／OnRelease 假 edge；離開 Workspace 不自動 reset |

現有 `setMode` 的 Kinematic→Dynamic 會清零 v／ω，故不能未設 release policy 就聲稱 Move & Release 能承接軌跡動量。existing grip 的 Held／OnGrab 僅供玩家互動；程式控制 move 需要自己的控制權與 receipt，不應偽造玩家 Grab／Throw。`OnStartMoving/OnStopMoving` 繼續指物理 speed edge；若未來需要 action started/finished，應另記 action lifecycle，不混入原音效 trigger。

採單 controller owner lease（含 generation），在固定步邊界驗證、原子接受與撤銷，任何時刻最多一個控制器寫同 body。UI、AI 與第三人稱都只能提出相同封閉 intent，不能直接存取 Rapier／Three transforms。這是補接現有 adapter，沒有新增通用動畫圖或另一套 physics solver。

## 主要 gap 與調整優先序

| 優先 | 差異／風險 | 最小後續工作 |
| --- | --- | --- |
| 高 | 早期 [OBJECT_STATES](../04-physics/OBJECT_STATES.md)、[bridge](../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md) 仍有「正式未實作／全部 NOT RUN」總述，現況已存在 runtime 與分項結果 | 只補當前狀態／canonical evidence 入口，保留歷史段落；不重寫舊 artifact |
| 高 | 未有正式 Move To／Move & Release／Motion Registry | 先凍結上述最小 intent／capability／receipt，不將 API primitive 升格已完成工具 |
| 中 | `pairKey`、domain collider ID 只由 object IDs 產生；`lastImpactByPair`／`pairEpisodes` 在 remove／geometry rebuild 未清除，直到 reset 才清 | 下述隔離 probe 已證實同 ID 新 generation 繼承 60 s 設定的 pair cooldown；預設 0.08 s 情境未新測。長時間 churn 的 Map 增長仍為靜態風險。先建正式負例，再決定受影響 pair cleanup 或版本化 identity；不在研究中改 event schema |
| 中 | contact data 僅一組 body 級代表接觸；多 primitive collider／compound／多 patch 尚非正式 schema／runtime | 現有 primitive 範圍保留；拓展形狀前設 collider-generation／patch identity 與有界聚合，不平均不同牆法線 |
| 中 | translational sweep＋終點 overlap 不證明整段旋轉 clearance；CCD 不等完整 substep event trace | 高角速薄板／旋轉角落增加獨立 fixture；維持近似標籤與 fail-closed policy |
| 中 | Recorder 保存 authoritative motion／normalized events，未保存可重求解的完整 tick-indexed Motion command stream／原生 world snapshot | 未來 Motion receipt 另存版本化 sidecar；不要把已有 replay 說成 resimulation |
| 保留 | 實體 FPS／IME 與裝置聽測未完成，R17 sustained performance FAIL | 後續依原 gate 補證；此研究不用低階通過取代真人／性能 |

## 錄製與 deterministic 邊界

[Recorder](../../src/experiments/recorder.ts)／[RecordingFrame](../../src/experiments/types.ts) 記錄 tick、pose／v／ω、listener、normalized physics events、behavior decisions、audio events、acoustic refs 及 behavior checkpoint；[LabRuntime capture](../../src/app/runtime.ts) 使用固定步 snapshot。`reprocessRecording` 固定 raw motion／listener／physics events，重算 behavior／acoustics；不是重新跑自由物理。

| 類別 | 現行可宣稱 | 不能外推 |
| --- | --- | --- |
| Authoritative replay | 相同已錄 motion／raw event trace 用於 acoustic／behavior A/B；hash、epoch、cursor 可核對 | 不證明重新求解 Rapier、原生錄音 PCM 或裝置時間一致 |
| 同機 pinned resimulation | [v1-matrix](../../tests/physics/v1-matrix.test.ts) 以兩個獨立 World、相同建構／tick intents 跑 120 ticks，比完整公開 snapshot SHA | 不是原生 `takeSnapshot` binary 證據、任意 UI timing 或跨機測試 |
| 跨平台 engine determinism | 官方 JS／WASM 對同版、同初值／建構／增刪順序提供條件式保證 | 本案跨平台 bitwise run 未實測；`sin/cos` 等初始化運算及不一致輸入可破壞前提 |
| 改質量／摩擦／幾何 | Fresh physics rerun 有新 motion trace | 不再是只改聲學／behavior 的 matched A/B |

官方條件見 [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/)（VERIFIED-SOURCE，2026-10-29）。FixedClock interactive 模式可丟 wall time、不能跳 simulation ticks；recording overload 暫停保留 backlog。研究不把固定 dt 等同整個瀏覽器端到端 deterministic。

## 可重現驗證與本輪執行狀態

本輪已執行：有界檔案／程式／測試閱讀、官方來源查閱，以及下述無聲 Rapier generation／cooldown probe。原 workspace 僅只讀；兩份研究文件只在隔離 research worktree 寫入。下列是重現入口；本段未填新執行結果之前，一律 **本輪 NOT RUN**，既有結果僅 HISTORICAL-TEST。

```powershell
node --import tsx --test tests/physics/physics-world.test.ts tests/physics/motion-hysteresis.test.ts tests/physics/fixed-clock.test.ts tests/physics/contact-emission.test.ts tests/interaction-runtime/host.test.ts tests/interaction-runtime/unlock-clearance.test.ts
node --import tsx --test tests/physics/v1-matrix.test.ts tests/app/camera-projection.test.ts tests/app/listener-projection.test.ts tests/app/replay-audio.test.ts tests/experiment-runtime/reprocess.test.ts
```

第一組核對四 mode、held collision／drop momentum、有限 throw、contact onset／support 與 pause／resume；第二組核對同機重求解、控制／listener projection、authoritative replay。`v1-matrix` 可依其原設計寫驗證 artifact，故需新輸出與 source guard，不覆寫正式舊結果。沒有必要為純研究文件重跑 browser／長測。

建議新增的 meaningful fixture（尚未實作／NOT RUN）：同 ID remove/readd 在 cooldown 內不繼承舊 episode；Motion 被薄牆阻擋不瞬移；Kinematic release Zero／Transfer 各有預期 v／ω；兩種 camera mode 作用於同 body ID 且 replay listener policy 可重建。預期不變項為 body／generation／finite bounds／collision ownership／raw trace；不要只鏡像 helper 的運算寫同義測試。

### 本輪 generation／cooldown probe（VERIFIED-PROBE）

2026-10-29，Node／tsx／真 Rapier 0.21.0，exit 0。設定合法但刻意放大的 `impactCooldownSeconds=60`，以隔離 cooldown 語義；每段跑 40 個固定步、同初始位置與速度。第一代球 generation1 在 tick8 有 Impact；remove/readd 同 domain ID 後 generation2 仍有真接觸 episode `.e2`，卻無 Impact；再改為新 domain ID 的球，在 tick88 有 Impact。這證實 current pair cooldown 會跨同 ID generation 繼承；不推論預設 0.08 s、UI 操作、可聽程度或長時間 Map 容量已測。未寫檔、無音訊／網路，world 於 finally 釋放。

在 repository root，以 `node --import tsx --input-type=module` 執行：

```javascript
import { PhysicsWorld } from "./src/physics/index.ts";
const obj = (id, shape, positionM, mode, dimensionsM) => ({
  id, shape, positionM, mode, dimensionsM, orientationQuaternion: [0, 0, 0, 1],
  massKg: 1, friction: 0.5, restitution: 0,
  physicsMaterialId: "test", acousticMaterialId: "test", acousticRole: "none"
});
const floor = obj("floor", "box", [0, -0.1, 0], "fixed", [8, 0.2, 8]);
const ball = id => obj(id, "sphere", [0, 0.3, 0], "dynamicGravity", [0.2, 0.2, 0.2]);
const scene = {
  schemaVersion: "1.0.0", sceneId: "probe", sceneRevision: 1, units: "SI",
  coordinateSystem: "right-handed-y-up-minus-z-forward", seed: 1,
  gravityMps2: [0, -9.81, 0], objects: [floor, ball("ball")], sources: [],
  listener: { id: "listener", positionM: [0, 1.6, 3],
    orientationQuaternion: [0, 0, 0, 1], attachment: "independent" }
};
const world = await PhysicsWorld.create(scene, { impactCooldownSeconds: 60 });
const sample = id => {
  world.setVelocity(id, [0, -1, 0]); world.resume();
  let impact = null, contact = null;
  for (let i = 0; i < 40; i++) {
    const s = world.step();
    impact ??= s.events.find(e => e.type === "OnImpact" && e.objectId === id) ?? null;
    contact ??= s.poses.find(p => p.objectId === id)?.contact ?? null;
  }
  world.pause();
  return { generation: world.getPose(id).generation,
    impactTick: impact?.tick ?? null, contactEpisode: contact?.episodeId ?? null };
};
try {
  const first = sample("ball");
  world.applyScene({ ...scene, sceneRevision: 2, objects: [floor] });
  world.applyScene({ ...scene, sceneRevision: 3, objects: [floor, ball("ball")] });
  const sameId = sample("ball");
  world.applyScene({ ...scene, sceneRevision: 4, objects: [floor] });
  world.applyScene({ ...scene, sceneRevision: 5, objects: [floor, ball("ball.new")] });
  console.log({ first, sameId, newId: sample("ball.new") });
} finally { world.dispose(); }
```

實際結果：`first={generation:1, impactTick:8, contactEpisode:pair-7229565ba11ed03e.e1}`；`sameId={generation:2, impactTick:null, contactEpisode:pair-7229565ba11ed03e.e2}`；`newId={generation:1, impactTick:88, contactEpisode:pair-8578165d088583da.e1}`。此為隔離研究 probe，不替代未新增的正式 regression／完整 browser 驗收。
既有固定證據： [物理驗收](../11-v1/PHYSICS_ACCEPTANCE.md)、[motion source／stdout manifest](../../artifacts/v1/motion-hysteresis-validation-20261027/verification.json)、[R17 功能收據](../../artifacts/v1/r17-browser-verification-20261029/verification.json)。這些收據各自限制仍適用，不能把不同日期計數累加成整體完成。

## 官方來源與存取記錄

既有 [physics source metadata](../../research/sound-behaviors/physics-sources.json) 已固定 0.21.0 package／types／license hash；本次先查該資料與 [Evidence Ledger](../../research/EVIDENCE_LEDGER.json)，未複製 SDK 全文或下載新 binary。`package.json`／lock 固定 `@dimforge/rapier3d-compat 0.21.0`；線上網站可變，不替代 pinned package。

| Claim | 直接支持與界線 | URL／查閱日期 |
| --- | --- | --- |
| PHY26-S01 VERIFIED-SOURCE | 官方 JavaScript guide 顯示 0.21；Dynamic／Fixed／兩種 Kinematic 分工，Kinematic 不受接觸力阻擋。這支持應用層做路徑 clearance | [Rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)；2026-10-29 |
| PHY26-S02 VERIFIED-SOURCE | `setNextKinematicTranslation/Rotation`、COM impulse、velocityAtPoint 是 engine primitives；不提供應用 Undo／Motion 作者層 | [RigidBody API](https://rapier.rs/javascript3d/classes/RigidBody.html)；2026-10-29 |
| PHY26-S03 VERIFIED-SOURCE | collision 與 contact force 通知不同；pair graph／geometric contact／solver contact 的語義與索引不同 | [Advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/)；2026-10-29 |
| PHY26-S04 VERIFIED-SOURCE | CCD motion clamp／substeps 有成本與限制，不是完整可觀測 substep 聲音事件保證 | [Rigid-body CCD](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/)；2026-10-29 |
| PHY26-S05 VERIFIED-SOURCE | JS／WASM deterministic 保證具同版、初值／順序條件；初始化 transcendental operation 需注意 | [Determinism](https://rapier.rs/docs/user_guides/javascript/determinism/)；2026-10-29 |

研究狀態：本文件為 review input；最小架構提議、實作、獨立驗證與 safe merge／push 由主代理分別決定及記錄。未引入新物理依賴，未新增付費 API 呼叫。

