# 錄製與重播架構研究

日期：2026-10-29（Asia/Taipei）。查核基準：`c210ca882ca8503b322c28884bf1e9f6e9fe126d`。本頁是獨立架構研究；保留既有 V1 錄放、驗收及歷史失敗。`PLAN` 表示預留契約，`CODE` 表示本輪讀到的程式行為，`HISTORICAL TEST` 表示既有證據，`NOT RUN` 表示本輪沒有執行該能力。本頁不宣告完整 V1、跨平台物理一致性或裝置聽測完成。

## 結論與既有權威

錄製已有可用的資料核心，不需建立第二套 recorder。`RecordingArtifact` 保存不可變配置與逐 tick 輸入、衍生決策、路由及來源相位證據；`verifyRecording` 重算內容與指紋；`MotionReplay` 沿用權威運動；`ReplayAudioHost` 重建聲音控制；`RecordingProcessor` 才負責真正重新評估 Behavior／求解器。PCM 匯出是另一個工作階段，不能把 trace 封存或即時重播稱成已完成離線渲染。

正式要求依 [ACCEPTANCE](../11-v1/ACCEPTANCE.md) 的 V1-RPL-01–03、V1-AB-01–02 與 [驗收補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)。三種重播模式沿用 [RECORD_REPLAY](../07-experiments/RECORD_REPLAY.md)，單因素條件沿用 [AB_COMPARISON](../07-experiments/AB_COMPARISON.md)，物理／內容／傳播分層沿用 [ADR-014](../02-architecture/adr/014-sound-behavior-system.md)。舊設計文件仍有「尚未實作」歷史段落；現況應對照程式及具名證據，不能由單一段落判定全部功能不存在或全部完成。

## 既有資料盤點（CODE）

| 項目 | 現在實際保存／驗證 | 重播與未來匯出邊界 |
| --- | --- | --- |
| Initial Scene | `configuration.sceneSnapshot`；Scene schema、ID、revision、units、座標與 canonical SHA-256；幾何快照與實際 scene 幾何共同入指紋 | 是作者／初始場景資料，不是任意時刻的完整 Rapier 引擎快照 |
| Motion | 每 tick 全物件 stable ID、位置、單位 quaternion；選用線／角速度與 sleeping；連續整數 tick | 以原 trace 驅動；顯示插值不能回寫運動來源；通用 recorder 的 velocity 欄位為 optional，匯出器須檢查用途所需欄位 |
| Physics | scene 的 mode／mass／friction／restitution／gravity／seed，另有 `physicsConfig`、`physicsVersion` 指紋 | 正式 RecordingArtifact 沒有 Rapier binary snapshot／建立順序／完整逐 tick input-intent log 的專用欄位，不能憑此聲稱可精確 resim |
| Collision／player events | `physicsEvents` 與 `audioEvents` 分開；eventId、tick、sequence、object refs、跨 frame 去重；ContactData 可保存 collider IDs、接觸點、法線、材料與 impulse 來源 | 保留原接觸刺激與分類；`null`／Unavailable 的 impulse 不補成實測數值；一般 recorder 對 `unknown[]` 的通用驗證不代替領域完整驗證 |
| Behavior | 原始 `inputFrame`、`preStepSnapshot`、step 後 `runtimeSnapshot`、`voiceIntents`、decisions、文件／profile／binding／rule revision | 已開始的 AlwaysOn／impact 必須從真 pre-state 接續；不能把 step 後狀態當起點重跑同 tick |
| Source content／phase | source／generator／profile／asset manifests 指紋；pre/post `voiceCursors`；`content-and-cursors-v2` 區分 `nativeEpoch`／`logicalIntent`／`silent`／`missing` | epoch-mapped source cursor 與 logical intent 都不是硬體 PCM 讀取位置；無聲必須由實際空 emission history 證明 |
| Assets | asset ID／revision／hash／來源／license 等 manifest；產品配置合併已解碼 metadata | manifest 不等於資產 bytes 已附在 recording。重新渲染需 host 取得相同 bytes 並核對 decoded rate／channels／duration；遺失或無權資產明確失敗 |
| Listener | 每 frame ID、位置與 quaternion，另有 listenerTraceHash；ReplayAudioHost 還原方向 | 既有重播嚴格沿用原 listener；不能改 listener 後沿用舊 source-listener paths |
| Material／geometry | 全 registry、物件 acoustic material bindings、geometrySnapshot 與實際 scene bindings 入指紋 | 來源的 Measured／Derived／Tuned／Synthetic 與 bands／安裝條件仍由材質正式資料決定，不因重新播放變成量測 |
| Settings／backend | solverConfig／atmosphere／backend ID、version、fixedDtS、sampleRateHz、physics version；paths 的速度來源一致性核對 | 字串版本不是 WASM／browser build bytes hash。完整音訊 graph、monitor gain、limiter、native HRTF profile 沒有全部成為既有錄製配置的一等欄位 |
| Time／provenance | runId／runEpoch／UTC、sceneRevision、start/end tick／counts／bytes／artifact hash；AcousticFrame 的 poseTick／listener refs | 已宣告 sampleRateHz 不等於實際裝置率證據：產品 recordingConfig 固定 48000，而 AudioEngine 可使用預設 AudioContext；未來 renderer 應另記 actual sample rate／engine |
| Results | acousticFrames／result refs；manifest 連結 paths／events，分類 Computed、V1 | trace／幾何 pressure-gain estimator 不是已渲染 PCM／SPL／RT60。真空或未解聲速時，舊 Experiment v1 manifest 可明示 unavailable；有效 RecordingArtifact 不必被偽造成空氣 manifest |

程式定位：[types](../../src/experiments/types.ts)、[recorder／指紋／驗證](../../src/experiments/recorder.ts)、[來源相位](../../src/experiments/source-phase.ts)、[產品配置與錄製接線](../../src/app/runtime.ts)、[Behavior／Contact 契約](../../schemas/sound-behavior/types.ts)、[最小 Experiment manifest schema](../../schemas/experiment.schema.json)。`schemas/experiment.schema.json` 是摘要 manifest，不是 RecordingArtifact 全文 schema；此次保留其版本與欄位。

## 三種執行方式

| 模式 | 輸入與實際工作 | 可宣稱／不可直接推論 |
| --- | --- | --- |
| Recorded-output authoritative replay（CODE） | 取已錄 poses、listener、raw events、decisions、voice intents／cursors、聲學路由；不讓 physics 重算軌跡 | 同一份錄製輸入重播；不等於重新求解物理或硬體輸出 bitwise 相同 |
| Acoustic／Behavior reevaluation（CODE） | `reprocessRecording` 保留 motion／listener／raw physics；host callback 實際重評內容或求解器；candidate 有新 run／hash | Acoustic A/B 需固定內容與相位，Behavior A/B 才可宣告改 profile／asset／gain／pitch。不能只是換 metadata 後重用舊結果 |
| Pinned resimulation／fresh physics（既有獨立驗證範圍） | 前者依同引擎／初始 snapshot／seed／順序／fixedDt 重跑並比對；後者因質量／摩擦／幾何等改動產生新運動 | 物理 snapshot 基準需查原證據；RecordingArtifact 的 authoritative trace 本身不提供完整 resimulation 證明 |

[Rapier 官方 determinism](https://rapier.rs/docs/user_guides/javascript/determinism/) 說明相同版本、初始化及順序的條件；本研究沒有新跑同機或跨機 resimulation，均不得新增 PASS。查核／存取日期：2026-10-29；本頁未散布 SDK 或文件全文。

## 時間、順序與去重

現在的權威時鐘是整數 physics tick，`simulationTime = tick × fixedDtS`；tick 在 pause 不前進，錄製超載使用 pause，不插入 wall-clock 空白。Recorder 拒絕 tick gap、重複 eventId、不遞增 sequence、revision／epoch 不符及非法 quaternion；失敗不可部分接納 frame。`MotionReplay.seek(tick)` 產生新 replay epoch 並回傳 `emitEvents:false` 的 preview；`ReplayAudioHost` 另外檢查已播 tick、先 drain 舊 voices，再由 cursor 還原尚存內容。pause 的 pending arrivals 與 seek 的截尾是不同邊界，不可混用。

未來 PCM 工作沿用同一 trace，但新增明確的整數 sample frame 座標（PLAN）：

`n(tick) = round((tick − tickOrigin) × fixedDtNumerator × sampleRateHz / fixedDtDenominator)`

`round` 固定為 nearest、恰半向正無限；numerator／denominator 是有理數且 denominator > 0。使用安全整數／精確整數計算避免乘法溢位，所有 tick 先映射，不能逐 tick 累加經四捨五入的步長。60 Hz 在 48000／44100 Hz 分別是 800／735 frames，但契約不假定其他步長可整除。最後才用 `n / sampleRate` 轉為 Web Audio 秒。這是專案預定的可追溯量化政策，**不是 Web Audio 對所有事件的規格保證**。

Emission window 使用 `[startTick, endTickExclusive)`；既有 artifact 的 `endTick` 是最後一筆 frame，不能直接當排他上界。輸出內容 frame 數為 `n(endTickExclusive) − n(startTick)`，再加明示 tailFrames；preroll 不計入交付 frame 數。原事件身份仍由 runEpoch／tick／sequence／eventId／instanceId 決定，不由浮點 currentTime 或輸出 sample index 重新命名。

## 改 listener／HRTF 的正確界線（PLAN）

- 改 listener 位置會改距離、傳播時間、遮蔽、反射路徑與到達方向，必須從原 scene／motion／emission history 重新求解聲學；改 listener 朝向也需重新處理 binaural 方向。原 collision／Behavior 刺激可保持，原 AcousticFrame 不能冒充新 listener 的結果。
- 只換 HRTF 且 listener／scene 完全相同，可重用經核對的幾何 paths／emission signal，重新渲染空間化；HRTF 檔需 profile ID／revision／hash／sample rate／license。native Panner 的內建 HRTF 不暴露可固定的係數 hash，需記 browser／engine 與 `browserManagedUnspecified` 限制。
- listener／HRTF 變更屬另一個宣告的研究自變項，不得繞過原 Acoustic／Behavior A/B 的 listener equality gate。此次沒有修改 comparison 規則，也沒有實作 listener override renderer。
- 已完成的雙聲道 binaural PCM 無法一般性反推出獨立聲源／路徑並在另一 listener 位置重算；保留 emission、paths 或可重求解輸入，才有未來重渲染空間。

## 聲源隔離與物理隔離

聲源隔離是選擇「哪些已錄 emission 進渲染」，保留全部物件的運動、碰撞、遮蔽／反射能力及原 Behavior voice admission。刪掉發聲物件或碰撞對手會改接觸、路徑與刺激，是 fresh physics／scene 變更。單獨靜音 source 也不應讓其他聲音獲得原先被 voice budget 丟棄的發聲機會；否則是新的 Behavior 執行，須另命名與記錄。

使用既有 stable `sourceId`／instance mapping 選擇，不以物件索引或 Rapier handle 當持久 key；同一物件可有持續聲與多個 contact／one-shot emitters。contact 聲源保留原接觸位置，不能為了 stem 將所有 emitter 合到物件 COM。

## 本輪保留的最小擴充（Category B／PLAN）

新增 [render-contract.ts](../../src/audio/render-contract.ts)，只由 [audio index](../../src/audio/index.ts) `export type`：portable `RenderJob`／`RenderBackend`／`RenderResult`。Job 引用既有 RecordingArtifact 與配置的 stable ID／SHA-256，不複製 scene／trace 格式，不輸入 AudioContext／AudioNode／Rapier／Node 物件；有 backend identity、required capabilities、rational clock、window／tail、listener／HRTF、emission selection、dry／direct／early／late／mix／master taps 及三種容量預算。Result 區分 completed／failed／cancelled，完成後回報實際 backend／engine／capabilities／輸出 hash／peak／截尾與歷史不足。

這些是型別與語義的預留，**沒有 runtime validator、backend implementation、provider registration、UI、cloud、資產上傳或 PCM encoder**。未來實作仍需驗證所有數字、資料引用、能力、revision 與 hash；TypeScript 型別不能驗證不受信任 JSON，也不能把 required capabilities 複製成 actual capabilities。

`RenderArtifactRef.sha256` 明訂為存放 bytes 的 digest；`RenderJob.recordingContentSha256` 另對應原 `RecordingArtifact.artifactSha256`（排除自身 hash 欄位後的 canonical body）。二者通常不同，不可混用。先核對 bytes，再呼叫原 `verifyRecording` 驗完整內容／各指紋／來源相位分類；hash 相同只證明指定內容完整，不自動把 `missing` phase 升成可重現聲音。

## 證據與下一步

| 證據 | 本輪判定 |
| --- | --- |
| `tests/experiment-runtime/recording.test.ts` | 已讀原案例：完整封存、atomic rejection、pause／seek、取消、hash、比較守門；本輪重跑結果由整合驗證收據列示 |
| `tests/experiment-runtime/source-phase.test.ts` | 已讀原案例：4 ms phase 反例、真 silence／missing 區分、same-source remap、pitch／generator 偽造拒絕；不等於 PCM 硬體相位證明 |
| `tests/app/replay-audio.test.ts` | 已讀原案例：captured routes／listener、late cursor、seek 不重觸、asset pins、停止與有限壽命；大部分為控制圖層測試 |
| `tests/app/recording-processor.test.ts` | 已讀原案例：pre-state 恢復、相位接續、重評 rollback、motion／contact provenance、材質與獨立幾何 oracle |
| `tests/browser/recording-worker/run.mjs`／既有 R15 artifact | HISTORICAL TEST：約 8.26 MB 的單組無聲封存比較；不是整場景容量或 PCM 匯出通過 |
| 新 renderer／listener override／自訂 HRTF／stems／chunk 接縫 | NOT RUN／尚未實作，維持獨立未來驗收 |

本輪實際執行：Node `22.17.0`／npm `11.4.2` 核對一致；`npm run typecheck` PASS；`node node_modules/prettier/bin/prettier.cjs --check src/audio/render-contract.ts src/audio/index.ts` PASS。這些只驗純型別／格式，沒有執行新音訊 renderer；完整原回歸由本次 Root 整合驗證另列。

下一個真正 renderer 工作應先完成有界單次 PCM render：資產及錄製核對→固定 clock／事件排程→輸出 window／tail→hash＋peak／clipping＋sample 數檢查→最後提交。再獨立增加 listener override、stems、增量渲染；各項需真瀏覽器數值 oracle，不能用此研究或純型別通過替代。[離線渲染研究](OFFLINE_RENDERING_RESEARCH.md) 列出官方 API、記憶體、尾音與非線性混音限制。
