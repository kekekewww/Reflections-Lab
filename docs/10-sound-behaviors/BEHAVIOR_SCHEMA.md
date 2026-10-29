# Sound Behavior 資料契約草案 v1

2026-10-27。狀態：**DRAFT／schema 與 domain fixtures 已驗證；產品 Runtime 未實作**。正式檔案為 [behavior-document.schema.json](../../schemas/sound-behavior/behavior-document.schema.json)、[sound-behavior-ai.schema.json](../../schemas/sound-behavior/sound-behavior-ai.schema.json) 與 [types.ts](../../schemas/sound-behavior/types.ts)。現有 SceneSpec、12項 AI 工具與 Experiment schema 保留；此草案沒有偷偷擴充它們的可執行能力。

## 1. 版本、權威與最小儲存單位

頂層文件為 `{schemaVersion:"1.0.0",documentId,revision,assets,profiles,bindings}`。`documentId`、`profileId`、`ruleId`、`bindingId`、`instanceId` 與物件 ID 都是穩定 domain ID，不使用 array index／Rapier handle。`revision` 是 behavior document 修訂；profile 自身另有 revision；原 Scene revision 不與這兩者混用。未知版本拒絕，不以移除欄位或自動補值掩飾 migration。

`assets` 僅存固定 `{assetId,revision,sha256}` 引用，不能由使用者／AI 夾帶 URL、local path、base64 或自行宣告授權。真正的檔案可用性、decoder metadata、來源／license、bytes hash 與權限由 trusted host catalog 管理。Scene 與 sidecar 的綁定、manifest hash、原子 Apply／inverse 應由後續 host transaction adapter 實作；目前沒有可執行的 sidecar save/load UI。

| 型別 | 用途與關鍵欄位 |
| --- | --- |
| `SoundBehaviorProfile` | 可重用 preset；profileId/revision/name/presetKind/rules/materialPairOverrides |
| `SoundBehaviorRule` | enabled、trigger、conditions、generator、emitter、gain/pitch/fades/cooldown/priority/voiceLimit/layerGroup/mappings；選填 P1 lifecycle |
| `SoundTrigger` | `kind:continuous|discrete` 與相應 allowlist type，兩種 kind 不可交叉混用 |
| `TriggerCondition` | 有型別的 metric 比較、state boolean 或 material-pair；無 expression／JavaScript |
| `ParameterMapping` | SI input、有限範圍、normalized curve、明確 target／clamp／smoothing |
| `SoundAssetReference` | host registry 中已存在的 assetId、revision 與 SHA256，不能用顯示名稱猜檔案 |
| `SoundGenerator` | sample 引用＋loop/offset，或有界 oscillator waveform/frequencyHz；不是聲學 solver |
| `SoundInstance` | logical voice、pinned profile/rule/binding、播放狀態、playhead、seed、位置；不存 AudioNode |
| `SpatialEmitter` | object offset、contact representative、zone 或 fixed position；沒有繞過聲學核心的路由欄位 |
| `AudioEvent` | 已決定的 logical start/update/stop、獨立 emission ID、physics stamp、profile/rule refs、聲源位置與 contact provenance |
| `BehaviorRuntimeState` | 可重播的 epoch/tick/sequence、active rules、cooldown、instances、processed event IDs、seed；不是實作中的 engine object |

`BehaviorBinding` 另明確記 `objectId/objectGeneration/profileId/profileRevision`，支援多個物件共用 profile，以及每個物件的 `enabled/gainLinear/pitchSemitones` 覆寫。一個物件也可擁有多個 binding／layer；綁定各自有 ID，不能因共用 preset 共用同一個 runtime cursor。修改 shared profile 前需顯示受影響物件；獨立副本使用新 profileId。

Effective enabled 為 binding master flag 且（個別 rule override.enabled 若有值，否則 profile rule.enabled）。disabled 狀態不得新建／更新 emission 或保持 scheduled/playing instance；明確 stop 與 fading/stopped cleanup 可保留，不能因禁用而丟掉既有尾音的清理紀錄。

## 2. Trigger 與條件

Continuous allowlist：AlwaysOn、WhileMoving、WhileAirborne、WhileRolling、WhileSliding、WhileSpinning、WhileHeld。Discrete allowlist：OnGrab、OnRelease、OnThrow、OnDrop、OnImpact、OnBounce、OnStartMoving、OnStopMoving、OnEnterZone、OnExitZone、OnSleep、OnWake。事件定義依 [EVENT_MODEL](EVENT_MODEL.md)／[Physics Bridge](PHYSICS_AUDIO_BRIDGE.md)，不是把速度門檻重新命名為玩家投擲。

`OnThrow` 來自 host 接受的投擲互動事件；`WhileAirborne` 依可靠支撐／接觸分類，不等於「速度大於零」或「無重力」。狀態分類未知時採 UNKNOWN，不把未知當 false 再讓 `equals:false` 誤觸發。這是後續 evaluator 的必要行為，schema shape 本身不能證明已正確執行。

`OnImpact/OnBounce/WhileRolling/WhileSliding` 使用 contact emitter，schema/domain gate 不接受默默改成物件中心。contact position 為選定代表位置；多 manifold aggregation 的方法與限制保留在 ContactData，不能稱為所有微接觸的精確解。其他 trigger 不可憑空選擇 contact attachment。

### 有界 P1 latch

精確的「投擲開始 loop，第一次撞擊停止，直到下次投擲」不能用 WhileAirborne 代替；後者反彈時可能重新成立。草案可描述：

```json
{
  "trigger": {"kind":"discrete","type":"OnThrow"},
  "lifecycle": {
    "mode":"latched",
    "stopOn":["OnImpact"],
    "retriggerPolicy":"ignore",
    "maxDurationSeconds":5
  }
}
```

起始事件由 rule trigger 指定；sample generator 必須 loop=true。禁止 continuous trigger 同時加 latch、start 也列在 stopOn、零或無限 duration。處理順序為 normalized `(tick,sequence)`；duplicate input ID 不重新觸發。`ignore` 保持原實例，`restart` 要在同一 voice 預算內淡出舊實例／建立新 ID，不能瞬間堆疊無界 voices。mode/delete/teleport/reset 等 invalidation 由 host 停止並記原因，epoch 改變不能把舊 latch 帶入新 run。

checkpoint 的 latched instance 需保存 `{startEventId,deadlineTick,retriggerCount}`，期限由 `startedAtTick + ceil(maxDurationSeconds/fixedDtSeconds)` 表示；Pause 不前進 logical tick。這是 **P1 資料草案**，並非已完成 latch evaluator。Host 未宣告該能力時，產品 AI 應回 CAPABILITY_UNSUPPORTED／僅建立待驗草稿，不宣稱可執行。

deadline 到達後不能仍是 scheduled／playing，只可進入 fading／stopped。一般 discrete oscillator 另須 `oneShotDurationSeconds`（0.005–30秒），且 fadeIn＋fadeOut 不超過該值；沒有這個有限 stop 就拒絕，不能把原生 oscillator 無限播放誤稱 one-shot。continuous／latched rule 不可再混入 oneShotDurationSeconds。Sample plain discrete 必須 loop=false，可用同欄位縮短播放；實際 decoder duration與結尾 envelope仍由 renderer驗證。

## 3. 曲線、參數與安全

Mapping 是 normalized piecewise linear／step curve：inputMin < inputMax；curve x 嚴格遞增、首尾為0／1、x/y均在[0,1]；`clamp:true` 必填。每 rule 每個 target 只能一個 mapping，不能靠規則順序隱式覆蓋。沒有任意函式、路徑、shell 或 graph payload。

| Input | 適用 context |
| --- | --- |
| sourceSpeedMetresPerSecond、angularSpeedRadiansPerSecond | 所有 trigger 的物件運動 snapshot |
| normalImpulseNewtonSeconds、closingSpeedMetresPerSecond、tangentSpeedMetresPerSecond | OnImpact／OnBounce |
| slipSpeedMetresPerSecond、tangentSpeedMetresPerSecond、contactSupportForceNewtons | WhileRolling／WhileSliding |

contact tangent relative velocity 與 rolling slip 不是同義詞，不能換欄位掩飾分類資料缺失。缺值是 unavailable／null，不補零。Target 的草案安全範圍為 gainLinear 0–4、pitchSemitones −24–24、filterCutoffHz 20–20000；smoothingSeconds 0–1。這些是可修改的工程輸入上限，**不是聽覺品質保證或實測效能**。裝置 sample rate 決定真正 Nyquist 上限；後續 renderer 還須額外 clamp／拒絕不能實現的 cutoff。

gainLinear 是數位源振幅比例，不是聲功率／dB SPL。creative pitch mapping 不可重複加入 propagation delay 已產生的 Doppler。physical preset 只代表 sample／procedural 的創作預設；沒有振動模型就不能稱物理自然生成。物理材質、聲學 absorption/scattering 與 presetKind 不共用同一可任意改寫的欄位。

草案儲存上限：64 profiles、256 bindings／asset pins、每 profile32 rules／material-pair overrides、每 rule8 conditions／mappings、每 curve16 points、runtime snapshot256 instances／4096 recent event IDs。這些是 bounded input 的初值，不是 runtime capacity。Voice allocation 還受 host 的全域／每物件／每 rule 預算與 [canonical performance budget](../06-validation/PERFORMANCE_BUDGET.md) 限制；array 上限不授權同時播放256聲源。

## 4. 資產、材質配對與來源

Domain validator 對每個 pinned asset 核對外部 catalog 的 ID/revision/hash、availability 與 rightsStatus；model-provided document 沒有 catalog 權威。Sample offset 有已解碼 duration 時須在範圍內。Material-pair overrides 是 unordered pair＋ruleId，重複配對拒絕；材質 ID 必須在 host registry，不能藉更換碰撞音檔更動 friction、restitution 或 absorption。

Contact 的 object／collider 必須在 trusted host context，collider確實屬於所列物件；body generation由binding與原physics/player trace連結。這仍不是重新求解或證明每個contact DTO為真實Rapier輸出，資料producer與rawtrace保存另驗。

[examples](../../schemas/sound-behavior/examples/document.json) 中的資產只指向 [SyntheticDescriptorNotAudio](../../schemas/sound-behavior/examples/asset-descriptor.json)，不是音檔；[context](../../schemas/sound-behavior/examples/context.json) 明確標 FIXTURE_ONLY，只能在 offlineFixture 模式驗證引用。切換成 product 模式會被拒絕。沒有下載或散布第三方音效，也沒有以這些 fixtures 宣稱可聽音訊。

Randomized variants、任意 procedural DSP／ADSR／filter graph、自動 material sample library、node graph、modal synthesis 與 arbitrary latch graph 仍需後續獨立 schema／capability／tests；目前 generator 只有單 sample 與簡單 oscillator。已記 seed 不等於已實作亂數選樣。

## 5. AI 提案與 transaction

提案 envelope：`schemaVersion/proposalId/sceneId/expectedSceneRevision/expectedBehaviorRevision/operations`。只有 CreateProfile、ReplaceProfile、DeleteProfile、AssignBinding、RemoveBinding；ReplaceProfile 交完整新 profile，保持 ID、expected profile revision 正確且增加一版，不接受任意 JSON Patch path。

Schema capacity 為64 operations，但本地 domain gate 最多接受 host 限額與32的較小值，不能繞過舊 application mutation budget。驗證器只在 clone 上模擬完整提案來檢查引用，不修改輸入／不套用正式場景。刪除 profile 不能留下 dangling binding；replace shared profile 後，所有保留的 bindings 都須明確 pin 新版（可在同一候選提案 remove/reassign）。

從catalog選擇尚未存在於document.assets的已知資產，不需要讓模型新增catalog權限。候選validator從**trusted catalog匹配的ID/revision/hash**衍生缺少的pins，成功時回 `derivedAssetPins`；未知ID、stalehash、缺檔或未核權利仍拒絕。正式host要在Preview顯示這些pins，並把pin／profile／binding與其inverse納入同一原子commit；不能只Apply profile卻漏存pins。這是明確的preflight／候選資料規格，host commit並未實作。

正式 trusted host 仍必須檢查授權、單一 writer、scene/profile/document revision、assets、capability、聲源預算，再 stage→Preview→Apply；Undo 使用 inverse 內容建立新 revision，不能倒轉 revision counter。跨 Scene 與 Behavior 的 composite atomic transaction、provider strict-schema adapter 與持久化 engine executor **NOT IMPLEMENTED**。詳 [產品 Muse 整合](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md)。

## 6. Runtime／錄製與 A/B

AudioEvent 的 emission ID 與 `parentPhysicsEventId` 分開。後者指 normalized physics/player input trace；改 creative profile 可能改 emission IDs／voices，不能回寫原碰撞數量。epoch、tick、fixedDt、scene/profile revision、object generation、logical playhead、seed、voice allocation／drop decisions 應在錄製 ledger 互相連結；不可序列化 AudioNode、Rapier world 或 AudioContext.currentTime。

`SoundBehaviorComparison` 草案分 `acoustic` 與 `behavior`。兩者固定 geometry、physicsConfig（含mass/friction/restitution/gravity/modes）、motion、raw physics/player event、listener、solver 與 atmosphere hashes。

- acoustic：獨立變數只允許 acousticMaterial，source signal／profile／asset manifest／generator config保持相同。
- behavior：propagation material保持相同；sourceAsset、generator、gainMapping、pitchMapping、behaviorProfile 依宣告變動。Profile hash 可因內嵌資產／generator引用的衍生變化而改變，不能誤將它當第二個獨立變數。Source signal若改變卻沒有任一生成輸入hash改變，拒絕比較。

`physicsEventTraceHash` 指 raw normalized input，並非 AudioEvent／VoiceDecision trace；behavior A/B 可產生不同 emission 決策但須完整保留。Hash 相等檢查不能證明 host 寫入真實資料，仍需 immutable run artifacts 與正確 producer。現有 Experiment schema 不因草案自動接受新 comparison kind，正式分析 adapter 仍待實作。

## 來源與驗證

延用鎖定的 AJV 8.20.0／TypeScript，未增加 Zod 或新依賴。JSON Schema 形狀、TS 編譯與 host domain validation 各有範圍；[Draft2020-12 validation vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation)、[AJV strict mode](https://ajv.js.org/strict-mode.html) 與 [options](https://ajv.js.org/options.html) 於2026-10-27閱讀原文，本文僅原創整理，未複製第三方全文。正式本地命令與未跑項目見 [驗證計畫](SOUND_BEHAVIOR_VALIDATION.md)。
