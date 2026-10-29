# 錄製與重播

## 2026-10-28：正式 Web 背景封存

目前 Web 在可使用 Worker 時，停止錄製會將已接納的不可變 frame／配置快照交給專用 Worker。Worker 以原本的 constructor、逐 frame 驗證、封存與 `verifyRecording` 完整重算，再回傳 canonical 編碼；artifact、指紋及 byte 計數格式保持不變。每次只執行一個封存工作，計時上限為 120 秒；此計時器不能中斷主執行緒的同步傳送、JSON 解析或凍結。

主執行緒重新計算回傳 bytes 的 SHA-256，建立隔離且深凍結的 artifact。BlobStore 的私有 prepared 記錄綁定該 artifact 與編碼 digest；寫入前重查 bytes／identity，成功才提交。儲存失敗保留重試能力，並行保存同一 prepared artifact 共用一次提交。公開 `saveRecording` 對未受信任輸入仍執行原完整核驗；讀取時也保留原核驗。失敗、逾時或取消不發布部分結果，錄製器保留 `SEAL_FAILED` 與相同失敗 promise。Node／明確 `useWorker:false` 保留原封存流程。

Root 已執行[固定合成錄製的 Chrome 比較](../../artifacts/v1/recording-worker-browser-2026-10-28T124538871Z-bdccb715/browser-result.json)：兩種流程均產生相同約 8.26 MB 編碼與 artifact／bytes 指紋，IndexedDB 寫入、失敗重試及竄改拒絕通過。這是單機、單組、無聲的診斷比較，不是正式場景效能或真人聽測；主執行緒仍有傳送／解析及保存長任務，未宣稱達到 4 ms 目標。首次隔離測試曾發現 snapshot 預算參照外洩，已修為獨立凍結副本並經負向測試及獨立複審。

可重現命令：`node tests/browser/recording-worker/run.mjs`。固定資料、原版對照、來源與修復歷史見[來源封存](../../artifacts/v1/r15-recording-worker-20261028/promotion.json)；該命令只使用本機 Chrome、localhost 與 IndexedDB，不啟用音訊或付費模型。完整產品、錄製過載、跨瀏覽器及裝置聽測仍依第一版驗收各自判定。以下為早期規劃，當時的 NOT RUN 不代表上述新增分項未執行。

## 三種模式

1. **Authoritative motion replay（A/B 主線）**：依已錄 tick 與 pose／velocity 驅動 acoustic source/listener；碰撞聲使用原 event trace。重播物體可改為受控／kinematic，不再讓 physics 碰撞重新決定它們的路徑。此模式是運動回放，不稱重新求解物理。
2. **Pinned runtime resimulation**：恢復初始 snapshot、同版 WASM、同 seed、同建立／移除順序、同 fixedDt，再輸入 tick-indexed intents，比對每 tick state hash／誤差。這是可測的同配置一致性，跨機尚未實測。
3. **Fresh physics rerun**：質量、摩擦、彈性或幾何變動後重新求解；新 run 有新 motion trace，不能宣稱僅比較聲學材質。

[Rapier 官方 determinism](https://rapier.rs/docs/user_guides/javascript/determinism/) 說明 WASM/JS 在相同版本與初始化下的保證，並警告初始化所用 transcendental operations、順序必須一致。這不等於本案 UI input timing、瀏覽器排程、外部程式都已證明 deterministic。保留條件與實測範圍，不一概聲稱引擎不具 determinism。

## 時間與儲存

physics 使用 integer tick，`simTime=tick*fixedDt`；render 只插值，不污染真實 trace。acoustic jobs 附取用 poseTick，audio 另記 audio epoch。暫停不以 wall-clock 空白插入 physics time；seek/replay 重設音訊 scheduling epoch。listener rotation 以 quaternion slerp；不得以 Euler linear interpolation 產生異常旋轉。

Pause 採 Freeze-and-fade：凍結 logical tick/source offsets/event cursor；20ms monitor fade 為尚未驗證的設計目標，舊 tail 中斷要記 boundary。取消舊 audio epoch 排程，保留尚未到達的 logical arrivals；Resume 重錨後僅重排未到達事件一次，避免 impact 重觸。paused audition 另計時且排除 metrics。錄製／A/B 超過 catch-up 預算時 pause，不丟 tick；互動非錄製模式可丟 wall-time，但必須記 telemetry。

錄製停止時 final state flush；trace chunks 帶開始／結束 tick、count、hash。缺 tick、重複 sequence、跨 body unresolved refs、非法 quaternion、非單調時間必須拒絕或標損毀，不能靜默補成量測。trace compression 應記位置／角度／時間誤差容忍；初版 uncompressed 易驗證。

10 個剛體、60 Hz、30 s 的 trace 大小需實際序列化量測；文件不預報假精確容量。用 quotas 限 duration／bodies／artifact bytes；超限停止 capture 並保留原因。

## 驗收

- 同初始 snapshot、120 ticks 重跑兩次，同機比較；跨平台另列 V4 測試，不能由同機通過推論。
- authoritative replay 保證聲學輸入的 motion trace hash 相同；listener/source timestamp sequence 相同。
- pause／resume／seek 無重複 collision；重播段落範圍明確且音訊尾音政策可見。
- capture 途中取消／crash 後，不產生狀態 Captured 的不完整 manifest。

上述完整錄放驗收均 NOT RUN；現有 analytical path continuity 與 Rapier snapshot相關 smoke 不替代 end-to-end recorder。

## Sound Behavior trace extension（2026-10-27草案）

錄製分兩層：①原正規化physics/player事件與motion/listener trace，②Behavior評估輸出及AudioEvent／instance／emitter decisions。二者都連結tick/sequence、runEpoch、scene revision；後者另含profile/binding/rule版本、material pair、contact位置、asset hash、selected variant／seed、gain/pitch/fade、voice admission／drop／steal與acoustic result refs。

Recorded-output replay重放已記錄的決策；behavior A/B則重用①並依另一版本profile重新評估，必須另產生②，不能要求兩版決策完全相同。[A/B契約](AB_COMPARISON.md)明示哪些hash必須相同／可以改變；兩種方式不可混稱同一實驗。

Logical continuous instance需保存playhead、gate、cooldown deadline與有界latch；不序列化AudioNode／Rapier object。seek／reset換runEpoch並重建必要資源，不能保留舊epoch排程或重觸已播impact。物件移除時依已記錄tail政策結束，不靠JS garbage collection決定語義。

Sound Behavior draft是外接artifact；現有Experiment schema尚未遷移，完整capture／replay／跨browser對齊／聽測仍NOT RUN，schema fixtures與physics spike不代替這些驗收。
