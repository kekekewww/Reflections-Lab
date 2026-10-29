# Sound Behavior 事件與狀態模型

2026-10-29：以下保留事件設計語義；正式 evaluator、physics bridge 與 Audio Runtime 已有實作。各 producer／schema／UI 實際支援程度與缺口見[Sound Behavior 研究](../12-architecture-review/SOUND_BEHAVIOR_RESEARCH.md)，並非表中每個事件都已由 runtime 產生。PhysicsStamp、body modes、pause/audio epoch 權威仍為 [Physics-to-Audio](../04-physics/PHYSICS_AUDIO_EVENTS.md) 與 [Object States](../04-physics/OBJECT_STATES.md)。本頁不另建 clock。

## 三層事件

Raw physics/player observations → normalized behavior inputs → committed AudioEvent／SoundInstance。原始contact trace不因cooldown／voice rejection刪除；碰撞存在不保證要播放，沒聽見不代表沒有碰撞。Rapier沒有原生OnThrow或Rolling Sound事件，需host正規化。

共同gate為Active lifecycle及profile/rule enabled；Preview／Staged不發聲。Continuous是level，維持同一播放instance；Discrete是edge，不每render/tick重新觸發。Trigger採穩定PascalCase ID：

| Continuous Trigger | 定義                                                                                         | 位置／限制                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `AlwaysOn`         | Active且enabled；Moving、Held、NoGravity、sleep不停止它                                      | object綁定點；playhead/node不每步重建                                         |
| `WhileMoving`      | 指定reference frame的線速度通過start/stop hysteresis；world frame為明示預設                  | object；moving平台可另指定relative basis，門檻Tuned                           |
| `WhileAirborne`    | Active Dynamic、非Held、沒有**有效支撐**                                                     | object；無重力v=0也可能成立，飛行preset可再AND WhileMoving                    |
| `WhileRolling`     | 有支撐、形狀有適用rolling模型、相對支撐frame切向運動／相對角速度非零、contact-point slip近零 | contact patch；P0/P1不接受object anchor。只驗球體候選，未知mesh回UNCLASSIFIED |
| `WhileSliding`     | 有接觸且contact-point相對切向slip超過hysteresis                                              | contact patch；不能只看COM speed                                              |
| `WhileSpinning`    | 角速度幅值／指定軸分量通過hysteresis，與支撐分開                                             | object；spin不自動等於rolling                                                 |
| `WhileHeld`        | 成功interaction交易的Held state                                                              | object/grip；Held不是body type，仍參與接觸                                    |

有效支撐需要nonsensor有效幾何contact、距離在記錄的contact tolerance內，且canonical normal與宣告`sceneUp`相容；牆壁擦碰不等於落地。零gravity不能拿來推導up，零重力接觸也可能沒有正force，不能以force>0為唯一條件。contact snapshot缺失標UNKNOWN，不假定airborne；短暫保持／fade需記錄政策。

Moving、Held、sleep、lifecycle、contact mode是正交維度，不是一個互斥巨型enum。Held+Moving+Contact合法，AlwaysOn與OnImpact可以疊音；Rolling/Sliding substate才需明確優先與遲滯。

| Discrete Trigger | 成功事件來源                                                       | 不可替代它的訊號                                      |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| `OnGrab`         | Free Dynamic→Held的已接受command                                   | hover／按鍵down／失敗抓取                             |
| `OnRelease`      | 成功release/drop/throw，帶interactionId與reason                    | blur/pause/delete/type-change失效不假造使用者放手     |
| `OnThrow`        | 明確且成功的Throw，帶有限impulse／commandId                        | 高速度、自然落下、被其他物件撞飛                      |
| `OnDrop`         | Held的成功Drop，不施加throw impulse                                | freefall、關gravity、pause                            |
| `OnImpact`       | 新episode或明確rearm的onset，通過強度政策、合併與cooldown          | 任意collision-start、非零force/J、每個manifold point  |
| `OnBounce`       | parent impact後有界時間窗內，法向速度反向並超過Tuned門檻的分離候選 | restitution>0、初次collision-start；P0可延後此trigger |
| `OnStartMoving`  | 同一speed basis下moving false→true                                 | Awake、轉Dynamic、teleport                            |
| `OnStopMoving`   | moving true→false，符合門檻／穩定時間                              | 單個低速噪聲sample、simulation pause                  |
| `OnEnterZone`    | registry sensor occupancy false→true                               | impact；load時已在zone預設只建baseline                |
| `OnExitZone`     | 同一occupancy true→false                                           | delete/reset/失效handle，走invalidation reason        |
| `OnSleep`        | Active Dynamic的isSleeping狀態edge，固定步輪詢／正規化             | Fixed、Paused、Staged、force event                    |
| `OnWake`         | 同一Dynamic sleep true→false，原因可得時保存                       | 建構／load baseline／body type切換                    |

Drop／Throw可同時fan out OnRelease及其專屬trigger，共享interactionId。不同rules刻意訂閱兩種trigger疊音合法；同一rule對重送event只接受一次。Throw/Drop與Lock/Delete衝突先由host原子command排序決定，不讓音效evaluator猜。Bounce需parent impact後有界時間窗內的outgoing normal velocity reversal與分離證據，排除command invalidation；ContactEnd alone可能只是滑離平台，不能當Bounce。不能回寫已播放impact；雙訂閱疊音需Inspector明示。

## Contact episodes與可聽候選

- `pairKey`=canonical domain collider IDs＋entity generations；`episodeId`=接觸生命週期，不能用Rapier handle／array index作持久ID。
- 同tick/pair/episode/surface region的geometric contacts聚合正normal J，world positions用同一組contact的J加權。sum=0或部分unknown時用明示fallback／unavailable，不能除零或把unknown補0。
- 幾何index只能作當步callback局部定位，不作跨tick identity。solver contact index是另一個索引域。
- compound collider先保留collider pairs，再按object pair＋相容patch合併。不同牆面／normal不能全部平均成物件中心；分群與patch identity仍待正式實作驗收。
- P0保守策略每episode/patch只接受一次onset，pair/region cooldown跨episode保持。持續接觸中的新打擊若需發聲，另加closing-speed/J上升沿rearm與impactCycle；不是冷卻一過就再響。
- 保留raw trace、audible rejection、voice decision。微小真bounce可能被作者政策抑制，不能稱物理上沒反彈。

既有impact門檻維護於 [原事件契約](../04-physics/PHYSICS_AUDIO_EVENTS.md)；spike數字只是Tuned/Synthetic fixture，不是校準產品default。秒數冷卻依fixedDt向上取整為ticks，與render FPS無關。

## Identity、revision與replay

Normalized input延續PhysicsStamp，帶runEpoch、eventId/interactionId、generation、pair/episode/surface/material revisions與metrics來源。tick為固定步完成後stamp，simulationTimeSeconds=tick\*fixedDtSeconds；不是AudioContext clock或CCD精確substep時間。

Physics event ID獨立於profile。Committed AudioEvent.eventId是emission identity，連結parentPhysicsEventId、profileId/profileRevision、ruleId、layer與occurrence。A/B保留同一pose/contact/normalized-event trace，再換behavior產生新emissions，不回寫原物理trace。Scene存declarative profiles/bindings/overrides，短期cooldown/hysteresis/episode/cursor放BehaviorRuntimeState，不序列化Rapier/AudioNode。見 [schema草案](../../schemas/sound-behavior/behavior-document.schema.json)。

| 邊界                                     | 行為                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Mode／delete／teleport／collider rebuild | ContactInvalidated，清該generation的transient狀態，fade/release；不偽造OnImpact/OnDrop |
| Gravity on/off                           | 保留Dynamic及速度；不自動改medium／vacuum                                              |
| Pause                                    | 凍結tick、state、pending logical arrivals，按原bus政策fade；不發OnStopMoving/OnRelease |
| Resume                                   | 新audio epoch映射，只重排尚未到達arrivals一次，不重播已播放emissions                   |
| Profile edit／Undo                       | Preview→revision檢查→原子套用；不重寫舊record                                          |
| Asset missing／not ready                 | 明確錯誤／降級紀錄，不偷偷換另一asset                                                  |
| Reset/load/seek                          | 新epoch或明確cursor restore，不製造初始假edge                                          |

若創作要「OnThrow開始loop，首次OnImpact停止直到下次投擲」，用明確latched lifecycle／stopOn及最大持續時間；裸WhileAirborne是state-gated，反彈再次unsupported可能重啟，不能承諾同樣語意。Latched runtime目前未實作。重新跑一次物理不等於逐位元replay；需保存motion/contact/accepted command/profile/asset hash/seed及必要state。

## 驗證界線

[Policy tests](../../experiments/sound-behavior-spike/physics-policy.test.mjs) **13/13 PASS**，只驗Synthetic/Derived控制規則：球點速度、平台相對運動、遲滯、多點加權、一次episode-onset、跨episode cooldown、regions、Throw/Drop、epoch ID與非法overflow。正式rolling、authoring、audio/node生命周期、voice budget與聽測均NOT RUN。新增 [WASM probe](PHYSICS_AUDIO_BRIDGE.md)另驗3個API風險，不外推成正式聲音功能。
