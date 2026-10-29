# 第一版驗收矩陣

建立：2026-10-27；基線 commit `2662bc8ee3976280c5c14f619ff798570f035f14`。本文件由隔離驗收代理根據既有正式來源整理，**是待驗收規格，不是測試結果**；不建立另一套Task系統，不以研究或M0代替整體第一版。機器可讀欄位、來源hash與凍結清單見[REQUIREMENTS.json](REQUIREMENTS.json)。

使用者已授權直接實作；Codex主導且Muse額度不使用。原驗收不得刪除或放寬。Task0006與0011可平行，0012依賴兩者，0013依FPS互動接線，0014真Meta另外依賴0007帳號／預算。

## 完成判定

Do not mark full first-version goal achieved until required in-scope requirements and required external/evidence gates have direct current evidence. Missing, indirect, narrower or uncertain evidence is not completion. P2 is explicitly deferred, not faked.

- P0：第一版必要核心。P1：Roadmap D5–D8與Task0013產品能力，分切片不代表可無聲從結案範圍移除。
- EXTERNAL_GATE：帳號、預算、規則或使用者權利確認；保留BLOCKED／NOT RUN並繼續其他工作。
- EVIDENCE_GATE：真browser、DSP、裝置與效能證據；較窄測試不能替代。
- PASS／FAIL／BLOCKED／NOT RUN分開；V0–V5分開。離線Mock與真Meta、Computed與Measured分開。
- 凍結驗收本身若有缺陷，先隔離review、版本化與理由，不允許實作者修改expected/tolerance製造成功。

## 第一版需求

### system

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-SYS-01／P0 | **可重現的正式Web app**：乾淨npm ci後以明載dev命令開啟room/sphere；正式typecheck/build通過，保留原研究scripts。 新增依賴精確鎖版並記license/來源；不將spike或空頁宣稱正式app。 | 新環境安裝、build stdout/exit、browser畫面與版本。[ROADMAP.md D1/D9](../../docs/ROADMAP.md)；[NEXT_ENGINEERING_TASK.md 實作項目與驗收](../../docs/NEXT_ENGINEERING_TASK.md) |

### scene

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-SCN-01／P0 | **Scene v1與domain正負例**：SI、右手+Y/-Z、xyzw unit quaternion、ID唯一且跨參照合法；拒絕NaN/Infinity、重複ID、dangling refs、負mass、非法geometry。 僅box/sphere/capsule；sphere三維等直徑；256 objects/32 sources/一listener；dimensions0.01..100m、position±200m、mass0.001..10000kg。 | Schema與獨立literal domain負例；真host API。[DATA_CONTRACTS.md Scene/Material](../../docs/02-architecture/DATA_CONTRACTS.md)；[scene.schema.json 全部](../../schemas/scene.schema.json)；[NEXT_ENGINEERING_TASK.md 全域限制/Review focus](../../docs/NEXT_ENGINEERING_TASK.md) |
| V1-SCN-02／P0 | **原子交易、revision與Undo**：多操作任一失敗全部rollback；STALE_REVISION與UNKNOWN_ID明確拒絕。 輸入與既有scene不被mutation；commit/undo revision單調遞增，穩定ID不依array順序或engine handle。 | 原有Scene acceptance獨立程序＋新增交易負例。[DATA_CONTRACTS.md Scene/Material](../../docs/02-architecture/DATA_CONTRACTS.md)；[scene-host-acceptance.mjs 原有凍結驗收](../../examples/agents/scene-host-acceptance.mjs) |
| V1-SCN-03／P0 | **匯入/匯出、Reset與資源清理**：roundtrip保留所有IDs、units、source/listener metadata；非法import保留舊scene。 pause不step；reset回目前document revision起點；重複reset/import/dispose不遺留world、queue、geometry/material或多重RAF。 | host roundtrip＋browser連續reset10次/資源計數。[NEXT_ENGINEERING_TASK.md 驗收/Review focus](../../docs/NEXT_ENGINEERING_TASK.md) |

### physics

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-PHY-01／P0 | **固定步與過載政策**：fixedDt=1/60s；30/60/144Hz render不改固定步結果；render僅插值。 互動catch-up≤4且丟wall-time有telemetry；record/A-B過載pause、不丟simulation ticks。 | 同初始state多render cadence比較＋過載trace。[PHYSICS_ARCHITECTURE.md 固定步與時鐘](../../docs/04-physics/PHYSICS_ARCHITECTURE.md)；[PERFORMANCE_BUDGET.md catch-up政策](../../docs/06-validation/PERFORMANCE_BUDGET.md) |
| V1-PHY-02／P0 | **四body modes與切換**：真Rapier證明Gravity on/off保留速度、NoGravity仍受impulse/contact、Fixed不受力、Kinematic用next pose且trajectory有clearance驗證。 Lock/Unlock預設零速並還原原重力mode；切換清controllers/舊contacts且記discontinuity；delete/undo不沿用invalid handles。 | 真WASM模式/切換矩陣＋browser操作。[OBJECT_STATES.md §2–4與驗收](../../docs/04-physics/OBJECT_STATES.md)；[NEXT_ENGINEERING_TASK.md 四modes](../../docs/NEXT_ENGINEERING_TASK.md) |
| V1-PHY-03／P0 | **FPS角色碰撞與移動**：正立capsule角色、WASD對角正規化、wall/slope/doorway碰撞有效，camera不直接穿透位移。 Pointer lock成功後才接收視角輸入；具不鎖定的可用替代操作。 | 真Rapier character cases＋browser鍵鼠/替代操作。[ROADMAP.md D2](../../docs/ROADMAP.md)；[FPS_INTERACTION_SPEC.md §1–3](../../docs/04-physics/FPS_INTERACTION_SPEC.md) |
| V1-PHY-04／P0 | **有限且壁安全的抓取**：Dynamic模式、mass、gravity與collision groups不因Held改變；有限impulse/torque servo，target sweep+overlap排除自身但保留牆/玩家/其他物件。 受阻可落後且顯原因；不得parent到camera、teleport穿牆或以kinematic假扮Dynamic。 | 0.1/1/5/20kg、薄牆/角落/堆疊/低FPS/NoGravity真WASM；記penetration/tracking/force saturation/blocked。[PHYSICS_ARCHITECTURE.md 抓取/target clamp](../../docs/04-physics/PHYSICS_ARCHITECTURE.md)；[FPS_INTERACTION_SPEC.md 抓取](../../docs/04-physics/FPS_INTERACTION_SPEC.md) |
| V1-PHY-05／P0 | **Drop/Throw語意與去重**：Drop不新增impulse且保留當刻solver velocity與NoGravity；Throw解除controller後同tick施加一次有限COM impulse。 commandId重送不重複throw；速度/clearance/CCD有界；取得lock的click不會throw。 | 明確intent事件＋WASM速度/impulse assertions＋browser lock click。[FPS_INTERACTION_SPEC.md §4](../../docs/04-physics/FPS_INTERACTION_SPEC.md)；[INPUT_CONTROLS.md 抓投操作](../../docs/04-physics/INPUT_CONTROLS.md)；[OBJECT_STATES.md Held](../../docs/04-physics/OBJECT_STATES.md) |
| V1-PHY-06／P0 | **Pause/focus與Listener還原**：Esc/blur/hidden清輸入並安全pause，取消未commit throw，保存Held/ghost且停止控制impulse；不得偷偷Drop或自動Resume。 Resume先重驗generation/collider/grip/clearance再ramp；editor camera不暗改Pinned Listener，退出FPS還原Pinned pose、velocity=0並記discontinuity。 | browser blur/visibility/lock/IME trace＋fixedstep controller/state assertions。[INPUT_CONTROLS.md §2/6](../../docs/04-physics/INPUT_CONTROLS.md)；[OBJECT_STATES.md Grab接觸與睡眠](../../docs/04-physics/OBJECT_STATES.md)；[FPS_INTERACTION_SPEC.md Listener](../../docs/04-physics/FPS_INTERACTION_SPEC.md) |

### build

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-BLD-01／P0 | **Ghost/Staged/Active三階段**：Ghost無active body/source；Place在安全固定步重驗且原子建立Staged；等待geometry ack後顯式Enable，另行Resume。 surface support與shape query拒絕overlap；invalid/stale/racing occupancy/連點不留半物件、雙ID或意外聲源。 | browser placement＋document/body/source/revision counts＋WASM shape queries。[FPS_INTERACTION_SPEC.md §5](../../docs/04-physics/FPS_INTERACTION_SPEC.md)；[OBJECT_STATES.md §1](../../docs/04-physics/OBJECT_STATES.md)；[FPS_INTERACTION_UX.md First-Person Build](../../docs/05-ux/FPS_INTERACTION_UX.md) |

### events

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-EVT-01／P0 | **可靠正規化物理事件**：步後複製暫時contact值，以domain IDs/generation/episode記tick/sequence/materialPair/worldContact。 point velocity=vCOM+omega×r；local→world與collider normal方向正確；force N/impulse Ns不可混用，缺值為null。 | 真Rapier多contact/旋轉/collider ordering fixtures與單位assertions。[EVENT_MODEL.md 全部](../../docs/10-sound-behaviors/EVENT_MODEL.md)；[PHYSICS_AUDIO_EVENTS.md contact extraction/aggregation](../../docs/04-physics/PHYSICS_AUDIO_EVENTS.md) |
| V1-EVT-02／P0 | **Impact去重與invalidations**：support/persistent contact不逐tick發impact；多點合理聚合、episode/cooldown/hysteresis有界。 mode/delete/teleport/replay invalidation不偽造bounce或新impact；audible voice drop不刪raw event trace。 | single impact/resting/microjitter/multiobject/held-wall/pause/mode/CCD fixtures。[EVENT_MODEL.md Impact/episodes](../../docs/10-sound-behaviors/EVENT_MODEL.md)；[PHYSICS_AUDIO_EVENTS.md 去重與分類](../../docs/04-physics/PHYSICS_AUDIO_EVENTS.md) |

### behavior

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-SND-01／P0 | **排序/去重與正交狀態**：event以tick/sequence定義排序；eventId重送不重播；shared profile每binding有獨立runtime state。 AlwaysOn在移動、Impact、Grab/Throw、NoGravity不中斷；Held/contact等維度可共存；Throw/Drop只來自成功interaction。 | 固定golden event trace、同tick不同sequence、重送與多binding fixtures。[NEXT_AUDIO_MILESTONE.md 不可放寬驗收1–3](../../docs/10-sound-behaviors/NEXT_AUDIO_MILESTONE.md) |
| V1-SND-02／P0 | **有界映射與合法引用**：mapping/fade/cooldown具範圍/單位、curve嚴格x與clamp；effective enabled/overrides正確。 拒絕NaN/Infinity、missing asset/rule、stale scene/profile/binding revision；不eval任意JS。 | 正負fixtures＋runtime極值/disabled override tests。[NEXT_AUDIO_MILESTONE.md 不可放寬驗收4](../../docs/10-sound-behaviors/NEXT_AUDIO_MILESTONE.md)；[behavior-document.schema.json draft v1](../../schemas/sound-behavior/behavior-document.schema.json) |
| V1-SND-03／P0 | **聲音預算與deterministic admission**：continuous與one-shot生命週期分離但共受有效預算；priority/stableID tie-break決定drop/steal並記原因。 instance/voice、active emitter、path/decoded-memory上限分別執行，超量不造成無界queue/allocation。 | event burst/over-cap/cleanup/同優先排序 fixtures及browser telemetry。[NEXT_AUDIO_MILESTONE.md 不可放寬驗收5](../../docs/10-sound-behaviors/NEXT_AUDIO_MILESTONE.md)；[SOUND_BEHAVIOR_ARCHITECTURE.md 資源預算](../../docs/10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md) |
| V1-SND-04／P0 | **快照/epoch與決策重播**：pause不前進logical tick；reset/seek換epoch清舊dedup/deadline/schedule。 保存state重評同raw trace得相同logical decisions；不把AudioNode/Rapier object序列化。 | golden snapshot/resume/replay＋stale epoch負例。[NEXT_AUDIO_MILESTONE.md 不可放寬驗收6–7](../../docs/10-sound-behaviors/NEXT_AUDIO_MILESTONE.md)；[RECORD_REPLAY.md Sound Behavior extension](../../docs/07-experiments/RECORD_REPLAY.md) |
| V1-SND-05／P1 | **接觸/有界latch/material pair layers**：rolling/sliding使用接觸與相對point速度/角速度、hysteresis且缺支撐資料回unknown，不能將平移都當rolling。 OnThrow-start/OnImpact-stop有界latch具stopOn/retrigger/deadline，不以WhileAirborne偷換；materialpair覆寫仍受finite generator與voice上限。 | rotating support/slip/held/mode/CCD/latch deadline/retrigger/layer trace tests。[RLAB-TASK-0013.json AC-01/02](../../knowledge/tasks/RLAB-TASK-0013.json)；[EVENT_MODEL.md Rolling/Sliding/Bounce](../../docs/10-sound-behaviors/EVENT_MODEL.md)；[MUSE_SOUND_BEHAVIOR_INTEGRATION.md latched semantics](../../docs/08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |
| V1-SND-07／P0 | **安全手動作者與Apply/Undo**：draft→validate→diff→pause/fade/drain→原子新revision/new epoch；derivedAssetPins與操作一起提交，inverse可Undo。 invalid/stale保留draft及舊配置；shared profile受影響bindings列明；不宣稱無縫retired-profile voices。 | domain transaction正負例＋browser Apply/Cancel/Undo。[SOUND_BEHAVIOR_UX.md §3](../../docs/05-ux/SOUND_BEHAVIOR_UX.md)；[MUSE_SOUND_BEHAVIOR_INTEGRATION.md Trusted pins與v1 Apply](../../docs/08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |

### assets

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-SND-06／P0 | **可信資產匯入/選擇與生成**：asset ID/revision/SHA與權利/availability來自trusted registry，fixture-only不能當正式音檔；模型不提供任意path/URL。 可用sample/loop與簡單oscillator/envelope；持續實例保持playhead，新one-shot建立新source，decoded buffer可重用；creative內容不標Measured vibration。 | 真音檔decode/playback與registry負例＋deterministic synth references。[SOUND_BEHAVIOR_ARCHITECTURE.md Audio generation/assets](../../docs/10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md)；[MUSE_SOUND_BEHAVIOR_INTEGRATION.md Trusted pins與v1 Apply](../../docs/08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |

### acoustics

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-ACO-01／P1 | **真direct path/occlusion**：產品solver以實際source/listener/geometry算t=r/c、1m reference pressure1/r與finite segment occlusion，r=0有明示拒絕/有來源的regularization。 source movement或blocker變更會更新真路徑，UI不能用裝飾線替代求解。 | 3-4-5 literal fixture＋blocker cases＋browser真path inspector。[ROADMAP.md D5](../../docs/ROADMAP.md)；[ACOUSTIC_VALIDATION.md ACO-001/002](../../docs/06-validation/ACOUSTIC_VALIDATION.md) |
| V1-ACO-02／P1 | **有限一階ISM反射與path identity**：反射點在finite polygon內，每段檢查blockers；first-order path帶真vertices/length/absolute delay/relative delay/arrival direction。 ID由source/listener/ordered surfaces/model決定，不含座標或rank；arrival指listener到倒數第二vertex。 | 固定一階sqrt20、polygon外與反射blocker負例、1mm continuity；可與獨立reference比對。[ROADMAP.md D5](../../docs/ROADMAP.md)；[DATA_CONTRACTS.md AcousticFrame](../../docs/02-architecture/DATA_CONTRACTS.md)；[ACOUSTIC_VALIDATION.md ACO-002/003](../../docs/06-validation/ACOUSTIC_VALIDATION.md) |
| V1-ACO-03／P1 | **材質/大氣/模型標籤**：每band A+R+T=1且finite/[0,1]；scattering只分配R，pressure magnitude依已宣告phase/impedance近似。 示範材質標Synthetic；air模型有來源/適用條件；gravity0不等vacuum，vacuum不消除mechanical collision；未驗ISO不得宣稱符合。 | band energy literal fixtures、air conversion、invalid material與medium tests。[ROADMAP.md D6](../../docs/ROADMAP.md)；[DATA_CONTRACTS.md Scene/Material](../../docs/02-architecture/DATA_CONTRACTS.md)；[ACOUSTIC_VALIDATION.md MAT-001/AIR-001](../../docs/06-validation/ACOUSTIC_VALIDATION.md) |
| V1-ACO-04／P1 | **AcousticFrame與worker邊界**：frame含source/listener/revision/poseTick/solver版本與capabilities；stale或錯配frame不套用。 bounds/backpressure與取消有限；unsupported/空路徑/0/未完成分開，沒有IR/individual-path capability不捏造替代。 | 真worker/message/queue/cancel/stale-frame tests與UI狀態。[DATA_CONTRACTS.md AcousticFrame](../../docs/02-architecture/DATA_CONTRACTS.md)；[PERFORMANCE_BUDGET.md worker/delivery](../../docs/06-validation/PERFORMANCE_BUDGET.md) |

### audio

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-AUD-01／P0 | **統一SourceGraph與一次處理**：所有3D continuous/contact emission走同一Acoustic Core route，contact聲源用world contact而非固定COM。 同emission epoch加一次absolute propagation delay；1/r、air/material、HRTF與Doppler不重複；反射HRTF用最後segment apparent direction。 | 真OfflineAudioContext impulse arrival/gain/direction/routing assertions＋browsergraph。[AUDIO_RUNTIME.md SourceGraph/排程](../../docs/02-architecture/AUDIO_RUNTIME.md)；[DATA_CONTRACTS.md AcousticFrame](../../docs/02-architecture/DATA_CONTRACTS.md) |
| V1-AUD-02／P0 | **持續聲源與平滑更新**：抓取/碰撞/NoGravity不重建continuous source或重置phase；source/listener/path更新用穩定IDs且gain/delay平滑。 path birth/death/voice steal有audio-clock fade；callback不等AI/network/physics/geometry，不做無界allocation/log。 | 真graph持續source identity/playhead、parameter ramps、burst/dispose tests。[AUDIO_RUNTIME.md 持續源/path bank/參數平滑](../../docs/02-architecture/AUDIO_RUNTIME.md) |
| V1-AUD-03／P0 | **Pause/Resume音訊時間**：Freeze-and-fade保留logical offsets/event cursor/pending arrivals，取消舊epoch；Resume重錨只排未到達事件一次。 seek/reset清舊排程；pause時audition另時鐘且排除run/metrics。 | OfflineAudioContext arrival/duplication tests＋browser pause/seek trace。[AUDIO_RUNTIME.md Pause/Resume](../../docs/02-architecture/AUDIO_RUNTIME.md)；[RECORD_REPLAY.md 時間與儲存](../../docs/07-experiments/RECORD_REPLAY.md) |
| V1-AUD-04／P1 | **Raw/Simulated與基本reverb**：Raw/Simulated使用同asset/event/seed/playhead/gain，不改run；route crossfade用audio clock。 基本reverb明示perceptual approximation，IR是否含direct/distance/air/material/normalization可查；能量驗證不能被Convolver自動normalization掩蓋。 | 真offline graph energy/arrival/normalization測試＋browser route切換。[ROADMAP.md D6](../../docs/ROADMAP.md)；[AUDIO_RUNTIME.md Monitor/IR/normalization](../../docs/02-architecture/AUDIO_RUNTIME.md)；[AB_COMPARISON.md 報告](../../docs/07-experiments/AB_COMPARISON.md) |

### ux

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-UX-01／P0 | **Workspace/Transport與資料權威**：Scene/Simulation/Analysis切換不Reset run/source/recording；Run/Pause/Resume/Reset語義不同，Reset保留已完成結果並標interrupted capture。 Scene Explorer/Library/Inspector/Transport/Monitor與精確數字入口可用，顯units/revision/tick與可操作error。 | 真browser workflow U01–U08/command trace。[WORKSPACE_ARCHITECTURE.md 正交狀態/驗收](../../docs/05-ux/WORKSPACE_ARCHITECTURE.md)；[COMPONENT_SPEC.md P0元件](../../docs/05-ux/COMPONENT_SPEC.md) |
| V1-UX-02／P0 | **共享選取與真資料可視化**：3D/table/Inspector共用stable object/path/event ID，排序/刪除/stale結果不誤選另一物件。 只畫solver產生的路徑，顯model/source/units/stale/revision；unsupported/empty/unavailable/0有區分。 | browser linked-selection＋stale frame/empty capability cases。[WORKSPACE_ARCHITECTURE.md Selection/Capability](../../docs/05-ux/WORKSPACE_ARCHITECTURE.md)；[COMPONENT_SPEC.md 整合驗收](../../docs/05-ux/COMPONENT_SPEC.md) |
| V1-UX-03／P0 | **FPS輸入仲裁與安全退出**：pointer-lock acquisition click不Throw/Place；Esc/blur/hidden安全pause；Tab正常導覽且保留browser shortcuts。 input/contenteditable/中文IME擁有按鍵，keydown repeat不重複throw/fix/create；有非lock與非drag替代。 | browser composition/focus/keyboard/lock-denied/action-log測試。[FPS_INTERACTION_UX.md 進入/焦點/退出與MVP mappings](../../docs/05-ux/FPS_INTERACTION_UX.md)；[UI_STRESS_TESTS.md UX-STRESS-10/14/18](../../docs/05-ux/UI_STRESS_TESTS.md) |
| V1-UX-04／P0 | **Sound Inspector作者/診斷**：可新增/啟停規則、合法trigger/asset、gain/pitch/curve與preset/binding override；顯contact emitter與抑制/voice原因。 audition/3D preview/run分離；切選不無聲丟draft；error/stale/disabled有可操作說明；Apply/Undo與runtime版本一致。 | 真browser規則編輯與audio/event/instance trace。[SOUND_BEHAVIOR_UX.md §§2–5 / SB-UX-01..06](../../docs/05-ux/SOUND_BEHAVIOR_UX.md) |
| V1-UX-05／P0 | **可及性/reflow/motion**：native controls/visible focus/accessible names/dialog focus-return/keyboard操作可用；不逐tick aria-live刷屏。 200%及320CSSpx仍到達Mute/Pause/退出/表單；Reduced Motion不延後命令；tokens使用canonical值，不能以色彩/動畫作唯一狀態線索。 | 真browser keyboard/dialog/zoom/reflow/reduced-motion/contrast檢查。[DESIGN_SYSTEM.md 可及性/版面與縮放/動態](../../docs/05-ux/DESIGN_SYSTEM.md)；[COMPONENT_STATES.json profiles/commonStates](../../docs/05-ux/COMPONENT_STATES.json)；[UI_STRESS_TESTS.md UX-STRESS-08/09/18](../../docs/05-ux/UI_STRESS_TESTS.md) |
| V1-UX-06／P0 | **Monitor與音訊暴露狀態**：預設muted，經user gesture啟用；Mute/gain常駐，Mute不停止simulation。 blocked/error/source stop狀態分離；dBFS不宣稱SPL或耳機安全校準；事件有文字/視覺替代。 | browser autoplay/gesture/mute test與實際聲音狀態確認。[DESIGN_SYSTEM.md 可及性與音訊暴露](../../docs/05-ux/DESIGN_SYSTEM.md)；[WORKSPACE_ARCHITECTURE.md Monitor](../../docs/05-ux/WORKSPACE_ARCHITECTURE.md) |

### recording

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-RPL-01／P1 | **可追溯capture與finalization**：保存tick-indexed motion/velocity/listener/raw physics-player trace及分離behavior/audio decisions，連結scene/profile/assets/solver版本與hash。 final state flush/chunk count/hash正確；缺tick/重sequence/非法quaternion/unresolved refs拒絕；cancel/crash不得產生Captured incomplete manifest。 | 真runtimecapture、格式破壞/取消/crash fixtures、序列化大小與quota量測。[RECORD_REPLAY.md 時間與儲存/Sound Behavior extension](../../docs/07-experiments/RECORD_REPLAY.md) |
| V1-RPL-02／P1 | **Authoritative replay與seek**：authoritative motion replay重用已保存motion/raw events，physics不重新決定路徑；listener/source時間序列一致。 pause/resume/seek/reset採新epoch與清楚tail政策，不重播impact；保留recorded-output與behavior重新評估模式差別。 | end-to-end record/replay/hash compare/audio event counts。[RECORD_REPLAY.md 三模式與驗收](../../docs/07-experiments/RECORD_REPLAY.md) |
| V1-RPL-03／P1 | **Pinned resimulation證據**：同初始snapshot、同Rapier/WASM、seed/建立順序/fixedDt，120ticks重跑兩次同機比較state hashes/明示誤差。 同機通過不推論跨平台bitwise；fresh physics rerun使用新run/motion trace。 | 真WASM兩次120tick snapshot regression。[RECORD_REPLAY.md 驗收](../../docs/07-experiments/RECORD_REPLAY.md) |

### analysis

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-AB-01／P1 | **Acoustic A/B固定條件**：同motion/source signal/listener/geometry/seed/sampleRate/window/backend/solver/analysis，只更動宣告acoustic材料或propagation；不符合回INCOMPATIBLE。 保留原值、candidate−baseline、units/band/window/artifact；baseline0百分比unavailable；normalized listening不推絕對能量。 | 真run manifests/hash守門與numeric delta負例。[AB_COMPARISON.md 可比較條件與報告](../../docs/07-experiments/AB_COMPARISON.md) |
| V1-AB-02／P1 | **Behavior A/B自變項**：固定motion/raw physicsEvent/listener/geometry/physics/solver/atmosphere/propagation，只允許宣告asset/generator/gain/pitch/profile變化，保留雙方hash。 behavior decision可不同，不把creative sample差異說成牆面RT改善；不支援時明示CAPABILITY_UNSUPPORTED，不能假完成比較。 | 真authoritative replay兩組profiles＋比較metadata負例。[AB_COMPARISON.md Sound Behavior A/B](../../docs/07-experiments/AB_COMPARISON.md)；[behavior-document.schema.json SoundBehaviorComparison](../../schemas/sound-behavior/behavior-document.schema.json) |
| V1-MET-01／P1 | **Grounded metrics與無資料拒絕**：只從solver/PCM/RIR artifacts產生支援metric，包含method/window/unit/band/provenance；Computed/Estimated/Measured/AI explanation分離。 不足decay或fit<3sample回null/reason；不從普通音樂或AI生成RT60/SPL；沒有V5不得標量測。 | 獨立synthetic impulse/EDC/0.6s decay fixtures與artifact missing/tamper/insufficient-data負例。[AI_EXPERIMENT_AGENT.md 可重現實驗與來源標籤](../../docs/08-ai/AI_EXPERIMENT_AGENT.md)；[ACOUSTIC_VALIDATION.md RIR/DSP邊界](../../docs/06-validation/ACOUSTIC_VALIDATION.md)；[AB_COMPARISON.md 報告](../../docs/07-experiments/AB_COMPARISON.md) |

### ai

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-AI-01／P1 | **原12工具的安全host**：原tool enum不被暗改；scene提案只stage，host驗證schema/domain/revision/授權後preview，Apply/Cancel/Undo明確且idempotent。 RunSimulation queued≠完成；immutable input/run ledger/cancel/timeout有效；手動編輯不依賴API。 | OfflineFixtureProvider/recorded response標籤＋真hosttransaction/run tests。[AI_TOOL_SCHEMAS.md 12 tools](../../docs/08-ai/AI_TOOL_SCHEMAS.md)；[AI_SCENE_CONTROL.md preview/apply/undo](../../docs/08-ai/AI_SCENE_CONTROL.md)；[AI_EXPERIMENT_AGENT.md 角色與資料流](../../docs/08-ai/AI_EXPERIMENT_AGENT.md) |
| V1-AI-02／P0 | **Behavior提案的安全host**：五種新operation與舊12enum分離；unknown/JS/URL/asset/trigger/stale generation拒絕；derived pins與操作原子提交且Undo。 proposal→preview/diff→user Apply→實際runtime artifact可追溯；模型沒有OS/shell/repo權限，不能自我批准。 | 真host工具正負fixtures/duplicate proposal/shared-profile迁移/Undo。[MUSE_SOUND_BEHAVIOR_INTEGRATION.md 機器契約/Host必要驗證/Trusted pins](../../docs/08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |
| V1-AI-03／P0 | **Provider邊界、預算及錯誤**：strict provider schema adapter與本地AJV/domain分開；完整arguments後才stage，model text/no-tool/refusal/truncation有受控結果。 12turns/48calls/6runs/concurrency1/120s/session及token/runtime caps由host管理；預設付費0、不使用Muse額度；401/403/billing/429/outage分清且transient最多2retry。 | provider契約/fixture fault injection＋budget/cancel/unknown mutation result ledger tests。[AI_EXPERIMENT_AGENT.md Run狀態與停止條件](../../docs/08-ai/AI_EXPERIMENT_AGENT.md)；[MUSE_SOUND_BEHAVIOR_INTEGRATION.md Meta adapter/失敗與驗收](../../docs/08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |
| V1-AI-04／P0 | **模型說明只引用真結果**：每個數字連到實際metricRecord/artifact，缺/竄改引用拒絕；AI不捏造asset、聲學量測、run成功或global optimum。 offline fixture/recorded/live來源清楚；模型故障仍可手動完成同一作者與實驗流程。 | artifact移除/改寫/錯誤誘導及人工fallback E2E。[AI_EXPERIMENT_AGENT.md Grounding](../../docs/08-ai/AI_EXPERIMENT_AGENT.md)；[MUSE_SOUND_BEHAVIOR_INTEGRATION.md 可展示受控實驗](../../docs/08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |
| V1-AI-05／EXTERNAL_GATE | **真Meta產品整合**：在帳號/模型/來源/明確有限預算核實後，保存實際Meta response/model ID、redacted tool trace、preview/Apply、真runtime run/results。 Codex開發、Mock、MuseCode CLI或其他模型輸出都不能解除此門檻；禁止自動充值/提高cap/換未授權帳號。 | 授權真Meta端到端trace；無帳號/預算記BLOCKED或NOT RUN。[RLAB-TASK-0014.json AC-02](../../knowledge/tasks/RLAB-TASK-0014.json)；[RLAB-TASK-0007.json account/eligibility](../../knowledge/tasks/RLAB-TASK-0007.json)；[MUSE_SOUND_BEHAVIOR_INTEGRATION.md 真Meta整合及競賽展示](../../docs/08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) |

### verification

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-VAL-01／P0 | **凍結驗收與獨立審查**：原tests/fixtures/reference/schema hash不因實作而變；如原驗收本身有缺陷，須獨立review與新version/理由，不能改expected/tolerance趕工。 獨立程序保留command/exit/stdout/stderr/version/hash；隔離review有重現缺陷、修復與複驗，不僅同模型自我宣告。 | protected hash比對＋原regression＋新產品tests＋隔離review。[VALIDATION_POLICY.md 全部](../../docs/09-agents/VALIDATION_POLICY.md) |
| V1-VAL-02／EVIDENCE_GATE | **Browser/DSP/E2E與乾淨重開**：真browser驗證輸入/畫面/cleanup與產品鏈；真OfflineAudioContext驗arrival/energy/continuity/voice cleanup，不能以Node公式代替。 端到端scene→throw→impact→sound→capture→A/B可重現；三次乾淨重開演示保留失敗/console紀錄。 | browser artifacts、offline PCM分析、3次乾淨launch E2E。[ROADMAP.md D9](../../docs/ROADMAP.md)；[VALIDATION_POLICY.md frontend/audio驗收](../../docs/09-agents/VALIDATION_POLICY.md)；[RLAB-TASK-0012.json AC-03](../../knowledge/tasks/RLAB-TASK-0012.json) |
| V1-VAL-03／EVIDENCE_GATE | **實際裝置聽測與跨browser**：指定browser/OS/硬體/耳機/sampleRate/實際block，實際檢查click/pop、volume jump、moving position、dropout與Pause/Resume。 測不到的裝置/hearing/crossbrowser明示NOT RUN；不能由PCM有聲、碼審或UI流暢推PASS/V5/calibrated SPL。 | 實際裝置紀錄與跨browser比較；無觀察者/裝置可驗時保留限制。[ROADMAP.md D9](../../docs/ROADMAP.md)；[VALIDATION_POLICY.md 音訊裝置聽測](../../docs/09-agents/VALIDATION_POLICY.md)；[BENCHMARK_PLAN.md V2/V4/V5](../../docs/06-validation/BENCHMARK_PLAN.md) |

### performance

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-VAL-04／EVIDENCE_GATE | **正式性能profile與退階**：正式profile分別量測UI/physics/worker/delivery/audio，不用Node batch平均冒充frame tail或schema容量。 保存10min UI trace與硬體/viewport/scene/voice/paths版本；未量項仍TARGET/UNVERIFIED，降階顯示capability/stale與actual caps。 | canonical profile benchmark與telemetry；採native nodes時不冒稱AudioWorklet p99通過。[PERFORMANCE_BUDGET.md 初始工程目標/效能退階](../../docs/06-validation/PERFORMANCE_BUDGET.md)；[PERFORMANCE_STANDARDS.md 量測metadata](../../docs/05-ux/PERFORMANCE_STANDARDS.md) |

### provenance

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-OPS-01／P0 | **Wiki/Task/交接/Git持久化**：沿用同一Task/Wiki：criteria實際有hash證據才DONE；claims釋放、來源版本/現況/限制/下一步更新。 保留未提交變更及舊證據，checkpoint/handoff帶真正commands/Git provenance；本地commit可恢復，不擅自push/deploy。 | wiki lint/status、task/evidence hashes、fresh handoff reader、git diff/log。[AGENTS.md Session Startup/授權完成定義](../../AGENTS.md)；[schema.md Task與操作](../../knowledge/schema.md) |

### compliance

| ID／優先 | 通過條件 | 證據／正式來源 |
| --- | --- | --- |
| V1-COM-01／EXTERNAL_GATE | **權利/規則/發布授權**：實際依賴/素材/音效/HRTF有license/version/hash/NOTICE；不複製EchoCanvas/Reflections核心或未授權商業資產。 codingagent公開條款UNSTATED、本人資格/登入後條款/提交欄位仍須核實；不代接受條款、部署、提交或決定根LICENSE。 | 實際dependency/asset manifest與使用者外部確認；不以開發完成聲稱競賽合規。[AGENTS.md 授權安全](../../AGENTS.md)；[HACKATHON_RULES.md 2026-10-27重查](../../docs/01-compliance/HACKATHON_RULES.md)；[LICENSE_REGISTER.md register](../../docs/01-compliance/LICENSE_REGISTER.md) |

## P2明確延期

Node-based Behavior Graph、modal/complex procedural synthesis、advanced sound layering/AI optimization、second-order以上正式反射、diffraction/wave solver/advanced impedance、dynamic reflectors、完整自由物理/跨平台bitwise replay、Steam Audio browser backend、jump/crouch/push工具。仍保留既有解析regression與capability拒絕，不以研究通過宣稱產品支援。

## 規格差異與解讀

- **V1-CON-01** 舊Phase3 Harness preferred=MUSE/only-src/禁止依賴與當前Codex全面實作衝突：ADR013及最新使用者授權優先；舊profile保留歷史，仍使用原Scene literal驗收；package-lock可因授權新依賴更新。
- **V1-CON-02** P0-01文件禁止順帶FPS/audio/AI，與整體第一版Roadmap不同scope：該禁令只限P0-01切片；整體第一版仍包含D2–D8與Task0012–0014，不能據此排除。
- **V1-CON-03** Sound UX候選P0 triggers比最新Roadmap最小vertical更廣：先AlwaysOn/Impact；Grab/Throw/Airborne需FPS前置並在後續Task0013驗收；不因enum存在就稱可執行。
- **V1-CON-04** Schema沒有room/cylinder/label且要求listener；UI stress有空場景/名稱案例：room由合法box walls組合；label只限UI暫存或另作版本決策；listenerless作draft/非法import負例，不能偷偷放寬Scene v1。
- **V1-CON-05** Workspace早期兩階段用語與詳細Build三階段：依Ghost→PlacementPending→Staged→explicit Active，geometry ack及Resume不得省略。
- **V1-CON-06** 性能提出多組配置/latency targets，尚未量測：數值權威只PERFORMANCE_BUDGET；UI p95≤50/p99≤100ms仍PROPOSED，desktop-60配置不是容量保證。
- **V1-CON-07** 舊12AI工具/Scene/Experiment v1與新Sound proposal/比較draft分離：不可暗中擴舊enum或宣稱跨文檔原子交易；使用明示版本adapter，兩種A/B各自守門。
- **V1-CON-08** Task0012 AC03含聽測，Task0014 AC02需真Meta；目前無live資源證據：不能將offline/built/fixture當DONE。完成獨立可做工作，保留該AC BLOCKED/NOT RUN與精確解除條件。
- **V1-CON-09** 既有source資料中的研究/未授權狀態已被新實作授權取代：保留歷史與研究文件；新status/Now由root依真正實作/測試更新，該矩陣不是授權再次確認門檻。

## 凍結與原命令

凍結 61 份既有tests／fixtures／contracts／reference的原始bytes SHA256，並保存Task0006／0011–0014的原criterion ID/text。完整路徑與hash見機器清單；task status、owner與新evidence可以正常更新。來源文件hash是capture provenance，不禁止後續有證據的status更新。

原Scene切片驗收需候選工作區有`src/scene-host.mjs`的四個同步exports；可用相容adapter，不改原驗收：

```powershell
node examples/agents/scene-host-acceptance.mjs <candidate-workspace>
```

此命令只證Scene pure host，不證Rapier/browser/audio/Meta。整體回歸仍需`npm run check`，新增正式build/dev/test命令由實作後確認並記錄，不在本文件猜測。原Optional Harness的MUSE預設、only-file與禁止新增依賴只屬舊profile；不應阻止目前已授權的React/R3F/build dependencies。

## 數值、效能與限制

[PERFORMANCE_BUDGET](../../docs/06-validation/PERFORMANCE_BUDGET.md)是性能數值唯一正式來源；UI60Hz/main p95<4ms/10min、physics1/60/p95<2ms/256bodies/catchup4、worker20Hz/p95<20ms/8sources32surfaces、deliveryp95<1ms/256paths、實際Worklet48k128frame/p99<1ms均仍需對應profile量測。native nodes可供MVP但不冒稱Worklet實測。UI50/100ms候選latency仍PROPOSED。

[解析固定fixtures](../../benchmarks/fixtures/analytical.json)保留原expected/tolerance：3-4-5／material／air 1e-12，反射1e-10m，polygon epsilon1e-9m，EDC1e-10dB，synthetic0.6s decay5e-5s。這些不代表一般mesh、ISO9613/3382、V3獨立solver或V5房間量測。

click/pop與wall penetration沒有已採納通用數字門檻；應記實際值、方法、裝置、來源及case-specific判定，不臨時捏造寬鬆容差。20ms pause fade是設計初值，0.01m skin不是通過穿透誤差。

本審查僅讀規格與凍結hash，沒有執行產品測試、真Meta模型、browser或耳機聽測。所有需求初始證據狀態為NOT RUN；由root逐項補真實artifact，缺失項不得當作整體完成。
