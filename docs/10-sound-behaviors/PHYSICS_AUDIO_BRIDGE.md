# Rapier → Sound Behavior Bridge

2026-10-27；本機固定 `@dimforge/rapier3d-compat 0.21.0 / Apache-2.0`。正式adapter未實作；僅官方／固定型別研究與隔離Node/WASM probes。舊 [Physics-to-Audio](../04-physics/PHYSICS_AUDIO_EVENTS.md)保留clock/contact權威，新 [Event Model](EVENT_MODEL.md)定義作者trigger。

## API mapping

| Rapier資料                                          | Normalized input                                        | 限制                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| drainCollisionEvents(a,b,started)                   | ContactBegin/End、zone occupancy edge                   | 至少一方需COLLISION_EVENTS；JS只有3項callback參數，不套Rust SENSOR/REMOVED flags                    |
| drainContactForceEvents                             | force診斷與候選pair                                     | CONTACT_FORCE_EVENTS＋threshold，單位N；totalForceMagnitude是各力大小和，不必等於totalForce向量長度 |
| world.contactPair／TempContactManifold              | geometric contact、normal、解算後normal J、solver代表點 | callback內複製plain data；contactImpulse(i)與solverContactPoint(j)不保證一一對應                    |
| collider translation/rotation＋localContactPoint1/2 | 接觸兩側world點／patch代表位置                          | 先依flipped找collider，再做quaternion transform；不能全用COM                                        |
| linvel/angvel/worldCom/velocityAtPoint              | object/contact點速度、rolling/slip候選                  | 當下值通常步後；碰撞前估計另cache pre-step並帶method，非CCD精確速度                                 |
| isSleeping輪詢／accepted host commands              | Sleep/Wake、Grab/Release/Throw/Drop、mode invalidation  | 不是Rapier原生sound events；拒絕命令不發成功聲                                                      |
| sensor intersection graph/events                    | zone occupancy                                          | 非impact/force；non-dynamic pair可能需ActiveCollisionTypes明確啟用                                  |

已讀原始來源：[Advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/)、[EventQueue](https://rapier.rs/javascript3d/classes/EventQueue.html)、[TempContactManifold](https://rapier.rs/javascript3d/classes/TempContactManifold.html)、[RigidBody](https://rapier.rs/javascript3d/classes/RigidBody.html)。本機0.21 d.ts/package/LICENSE SHA256與9份官方來源記於 [physics-sources](../../research/sound-behaviors/physics-sources.json)。線上頁可隨版本變動，不能取代固定版型別。

## Position、normal與velocity

定義canonical A/B後，以geometric contact兩側world點的中點代表位置；先依flipped處理實際collider，再將local point套各自world quaternion/translation。normal亦先處理callback順序，再按domain排序必要時反向。solver point只作不同method的fallback，不把solverIndex和geometricIndex硬配。

工程推導：`v(point)=v_COM + ω × (point-COM)`；`v_relative=v_B(point)-v_A(point)`、normal A→B、`closing=max(0,-dot(v_relative,n))`，slip為移除normal分量後的切向幅值。移動／旋轉平台也取同world point速度。`r×ω`會反號。

理想球體rolling時，相對表面切向COM運動與角速度contact分量抵銷。只看COM speed會把滑動當滾動，單看|ω|會把normal-axis spin誤判rolling。任意mesh、deforming、多patch需要另模型，不支援時UNCLASSIFIED。

保存pre-step COM/pose/v/ω，在步後代表點推估入射速度屬 **Derived / PreStepRigidBodyEstimate**，受同一步多次撞擊、force integration、rotation、CCD時點影響。J為solver資料或明示ForceDtEstimate；不能稱真實振動能量或SPL。

```text
accepted commands → pre-step cache → world.step(eventQueue)
copy collision/sensor/force callbacks → update domain episodes/occupancy
query persistent contact pairs → copy/normalize IDs/units/points/normals
derive support/motion edges → aggregate compatible patches → keep raw trace
behavior evaluation → bounded AudioEvents / persistent-instance updates
→ Custom Acoustic Core + recorder → audio renderer
```

Sleeping支撐不能只靠本tick force event重建；保留有效episode/contact snapshot，generation/geometry變更即失效。AudioWorklet不執行contactPair、不等待physics/AI/網路。

## 十個風險

| 情境                   | 處理與驗收                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 多contact              | 同patch聚合J及world point；保留不同region。Probe box-floor有4contacts，不預設發4voices                             |
| 持續接觸               | 支撐J/force非impact；episode onset＋cooldown；隔離測60support及held-contact高closing仍不重響                       |
| 微振動                 | movement/slip各自hysteresis，穩定分離才rearm；fixture門檻Tuned，實際聽測NOT RUN                                    |
| 低速／強impact         | raw與audible gate分離，J/closing附method；clamped感知mapping不改physics，未校準SPL                                 |
| 高速／CCD              | 0.21 fast dynamic→fixed有特定自動sweep；moving-body CCD/maxCcdSubsteps仍有限，完整impact時序／stress NOT RUN       |
| 多物件／compound／多牆 | collider→object registry＋generation＋pair/episode/patch；不同normal不可全平均。正式case NOT RUN                   |
| Held碰牆               | Held仍Dynamic solver，資料照存；作者可condition mute/layer，不停用collider、不推測throw                            |
| Fixed／NoGravity       | mode change invalidation/fade；gravity0仍Dynamic及慣性，不等於vacuum；原4-mode政策不變                             |
| Pause/Resume           | 不製造StopMoving/Release；凍結logical trace，依原epoch重排未到達arrival一次                                        |
| Replay                 | 同版、初始值、creation/removal順序只是引擎前提；保留motion/contact/commands/profile/asset/seed，無端到端逐位元保證 |

來源：[CCD](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/)、[Colliders](https://rapier.rs/docs/user_guides/javascript/colliders/)、[Determinism](https://rapier.rs/docs/user_guides/javascript/determinism/)。不可將CCD能力轉述為每個substep皆有完整可觀測音效事件。

## 隔離證據

```powershell
node --test experiments/sound-behavior-spike/physics-policy.test.mjs
node experiments/sound-behavior-spike/physics-probe.mjs
```

Policy **13/13 PASS**，[最終原始stdout與source hashes](../../experiments/sound-behavior-spike/physics-validation-final-2026-10-27.json)保存；Synthetic/Derived風險控制，非正式evaluator。state最多256項超限拒絕，production仍需lifecycle cleanup；persistent contact重新打擊的rearm extension尚未做。

固定0.21 WASM **3/3 PASS**：[最新結果](../../experiments/sound-behavior-spike/physics-results-2026-10-26T17-24-46-117Z.json)。2m/s球搭配ω抵銷contact速度；box-floor 4contacts／60個rest-force steps，contact位置不同COM；dynamic球穿sensor Enter/Exit各1、force0。[較早結果](../../experiments/sound-behavior-spike/physics-results-2026-10-26T17-23-43-200Z.json)保留歷史：world point原以identity orientation近似，後改成實際quaternion transform，接觸位置主張以最新artifact為準。原有6項physics smoke與舊固定結果未覆寫。

**NOT RUN**：正式bridge／behavior runtime／browser audio／click-pop／voice stealing聽測、完整CCD/compound/多牆/多物件壓力、真實rolling/sliding摩擦模型與材質驗收、跨平台physics+audio replay。不以本probe推定整個物理聲音功能已完成。

旋轉支撐面需另外知道surface angular velocity：令r=contact-COM，v_support_at_COM=v_support_at_contact−ω_support×r，再以ω_relative=ω_object−ω_support與相對COM切向運動判rolling。只有contact slip=0不能排除物件與平台共同剛體旋轉；該情況相對pose不變，應為RESTING。缺少surface angular資料回UNCLASSIFIED，不默認靜態支撐。此為Derived工程分類，尚非正式solver模型。
