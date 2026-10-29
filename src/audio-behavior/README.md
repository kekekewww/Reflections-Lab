# Sound Behavior Runtime

正式的純 TypeScript domain evaluator；不建立 AudioNode、不自行推導 Physics 事件，也不代表音訊／瀏覽器驗收。

入口 `index.ts`：

- `createBehaviorRuntime(document, context, options)`：AJV 與 trusted registry/domain 驗證後建立 runtime。
- `runtime.step(frame)`：回傳 `{ events, voices, decisions }`。`events` 是 committed AudioEvent，`voices` 是交由獨立音訊 host 執行的 VoiceIntent。
- `runtime.getActiveRuleStates()`：取得目前每個 binding 的 `{ bindingId, activeRuleIds }` 分離資料投影，供 Inspector 讀取 logical active state；回傳容器可由呼叫者修改，不會改動 runtime。
- `runtime.snapshot()`／`restore(snapshot)`：保存有限 state、input cursor 與 voice metadata；拒絕版本、身份、資產、lifetime 或 epoch 不一致。
- `runtime.setPaused(boolean)`：只凍結 logical clock；不虛構 StopMoving／Release。音訊 bus 的淡出／暫停由 audio host 處理。
- `runtime.reset(newEpoch)`：清 logical voices、cooldown、去重與 cursor。**呼叫者須先停止／排空舊 AudioNode，建立新的 audio epoch**；此純 domain 方法不可能直接清理別層的 AudioNode。
- `runtime.replaceDocument(next, context, newEpoch?)`：必須先 drain 邏輯 voices；同 document revision 單調增加。未傳第三參數時，後續 step 被 `NEW_EPOCH_REQUIRED` 阻擋，直到 `reset(newEpoch)`。
- `runtime.notifyEnded(instanceId)`：audio host 確認自然播放結束後，釋放對應 logical instance。
- `runtime.getTrace()`：取得有限的 admission／update／stop／reject 診斷。
- `createProfileRegistry(document, context)`：嚴格 activation preflight；sample 必須有真實 ready／rights-approved registry 與 decoded duration。
- `validateBehaviorAuthoring(document, context)`：持久化載入 preflight。仍驗 schema、references、curve、lifecycle，但保留外部未重新連結的資產；回傳的 `AUTHORING_ONLY_NOT_ACTIVATED` **不能作為可播放證據**。
- `mapParameter(mapping, input)`：有限 input、明確 clamp、piecewise linear／step curve。

## Producer／Host 契約

`types.ts` 定義 `BehaviorFrame`、`BehaviorObjectInput`、`NormalizedBehaviorEvent`、`BehaviorContext` 與 `VoiceIntent`。

每次 frame 的事件 tick 必須與物件 snapshot tick 一致；先按 tick／sequence／ASCII stable ID 排序。未知 state 為 `null`，不可用 `false` 代替。Throw／Drop／Grab／Release 只接受 interaction producer 已接受且有 commandId 的事件；高速移動不合成 Throw。真正 contact 必須有 registry collider ownership、geometry、單位 normal 與 method/null provenance。

Continuous 與 one-shot／latched instances 互不覆蓋。物件 attachment 跟隨 quaternion／pose；contact one-shot 保留原接觸位置。所有 discrete start／update／stop 保留 normalized parent；contact emitter 的清理 stop 仍保留 contact。單一 profile 在不同 binding 間不共享 runtime cursor。

Voice admission 對每個 ordered input 的候選先依 priority、stable binding／rule ID 排序。全域／每物件／每 rule 上限均計入 fading tails；目前政策是明確 reject，不突然搶走正在播放的聲音。沒有宣稱 renderer 的額外 crossfade voices 已經通過裝置預算。

Event ID cache 有上限，另保存單調 input cursor，避免同 tick 已淘汰 ID 被重送；晚到的舊 sequence 明確 reject。Reset／seek 使用新的 epoch。完整 raw input trace 仍應由 recorder 保存，此有限診斷 trace 不取代實驗紀錄。

## Active-rule 唯讀投影

`getActiveRuleStates()` 每次讀取目前 state，保留 binding 與 rule 順序，建立新的外層陣列、binding 物件與 `activeRuleIds` 陣列。它不前進 tick、重建 voice 或更新 cooldown，也不快取先前的 state；restore、reset、replaceDocument 與失敗 rollback 後均以當前 state 為準。

App publication 只需這些 IDs 判定規則的 logical active 標記，因而使用此投影。錄製、重播、還原與完整 checkpoint 繼續使用原 `snapshot()`；其既有資料與方法內容保留。實際 audio admission／播放狀態仍由音訊 telemetry 提供。

差異測試比較完整 snapshot reference、輸出決策、trace、App views 與 capture／replay artifacts，並驗證 caller mutation 不會改動 runtime。減少 snapshot 複製呼叫是 operation count 證據；速度、frame tail、GC、Worker 與裝置音訊仍須各自量測。

## 能力界線

支援既有七個 continuous 與十二個 discrete trigger ID 的合法 normalized inputs、正交 conditions、gain／pitch／filter mappings、cooldown、bounded latch、material-pair generator selection。Rolling／Sliding／Bounce 的物理分類由 producer 驗證；本模組不假稱實作任意形狀接觸求解。沒有 variants、任意 JavaScript、DSP graph 或 modal synthesis。

Audio host 必須沿用統一 SourceGraph／Acoustic Core、進行真正 scheduling／gain smoothing／Nyquist clamp／device budget，不能把這裡的數位 gain 說成 dB SPL。

測試：`node --import tsx --test tests/audio-behavior/*.test.ts tests/app/active-rule-view.test.ts`。測試包含固定舊 domain validator 的獨立程序交叉檢查，以及 active-rule 投影的分離資料、rollback 與完整 App 差異回歸；Node domain PASS 不等於 browser／AudioNode／聽測 PASS。
