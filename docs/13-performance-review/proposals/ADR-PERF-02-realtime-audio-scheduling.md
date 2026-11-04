# ADR-PERF-02：即時音訊排程與有界發聲視窗

- 狀態：**PROPOSED／未採納**；2026-11-01。沒有改寫現行時鐘政策、runtime 或固定驗收。
- 程式基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`；新排程候選與聽測均 **NOT RUN**。
- 承接：[音訊執行契約](../../02-architecture/AUDIO_RUNTIME.md)、[ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md)；對照[時鐘審查](../CLOCK_AND_SCHEDULING_REVIEW.md)、[DSP 審查](../AUDIO_GRAPH_DSP_REVIEW.md)。

## 問題與現況

[src/audio/engine.ts](../../../src/audio/engine.ts) 的 `setEpoch` 建立 simulation／AudioContext 對應，`startVoice` 依 logical emission 算 requested time，遲到時計數並以 `max(currentTime, requested)` 啟動；path 的 absolute propagation delay 由 [PathRoute](../../../src/audio/routes.ts) 套一次。pause／resume 已保留 frozen voices／尚未到達 arrivals，並重錨 epoch；不是沒有排程或所有時鐘共用 wall time。

目前 RAF 供應 physics，main 控制層仍負責 AudioNode 建立及參數提交；固定步與原生音訊 rendering thread 無法保證事件一定提前送達。單純加大 lookahead 也會增加操作到發聲 latency，且不能預知尚未發生的碰撞。較新 dirty R21 的60／80／120 ms onset lookahead 與 target suppression 是分開的觀察，未納入此 commit，不能宣稱這些候選不存在或已證明改善。

## 候選決策

先量 event emission→host dispatch→native schedule→可觀測 output 的時間與晚到原因，再比較「保留現況」「有限排程 horizon」「降低 control thread 工作」；只有必要的自訂 DSP 才另評估 Worklet。本頁不選定 lookahead 數字。

| 時基 | 候選責任 |
| --- | --- |
| Wall clock | 只量耗時、逾時與使用者操作 latency，不能替代 simulation time。 |
| Render frame | 讀已完成 snapshot／提交輸入；不決定 sample offset。 |
| Physics fixed tick | 決定 motion／contact／logical emission 順序。 |
| Acoustic snapshot tick | 記參數採用的 poseTick，與發聲 tick 分開。 |
| AudioContext clock | native start／ramp／delay 的即時執行時基；epoch 明示。 |
| Recording timeline | 保存 integer tick／event cursor／content phase，不插入 wall pause 空白。 |
| Offline render sample timeline | 只在 types-only `RenderClockMapping` 預留；尚無正式 renderer，不能當現有排程能力。 |

候選 scheduler 只接納已存在、驗證且帶 epoch 的 emission。可排程 controls 的 horizon 以 AudioContext seconds 與 output sample frames 分開報；不能把物理 d/c、FIR group delay、control lookahead、DSP block latency 與裝置 latency 合併成一個「音訊延遲」。任意固定 lookahead 不是保證不晚到。

概念 event record 為 `runEpoch, scheduleGeneration, instanceId, eventSequence, emissionTick, emissionTimeS, sourceId, frameRevision, requestedAudioTimeS, admissionResult`。一個 emission signal 共送 direct／early／late；反射不再另加 direct delay。Continuous 與 contact one-shots 分池管理；asset／seed／playhead 保持原 identity。已停止的 AudioBufferSourceNode 不可重用作新一次 start；可以重用 decoded asset。

## 有界接納、晚到與生命週期

排程視窗以「已接納 events 數、未來 seconds、active／retiring voices、paths、bytes」分別限界。沿用現有 `maxPendingEvents`、voice/path 上限作 baseline，新的 horizon／容量需從同負載 burst 與暫停邊界量測推導。排程 queue 滿載時明示拒絕及 reason；不可刪除 recorder 內的原始 emission。沒有有效 frame 時保持現有明示 unavailable／pending 政策，不用假 direct frame 補播。

每個實驗固定 late policy：候選可保留「立即補播並記 late」，或經另外驗證後按 age 明確丟棄；不能依機器速度偷偷改實驗內容。pause 取消舊 generation 的 native schedules，freeze source cursor／未到達 logical arrivals；resume 只重新錨定 AudioContext scheduling epoch／scheduleGeneration，只重排剩餘 arrivals 一次；保留同一 take 的 runEpoch、logical tick 與 source identity。seek／reset／scene commit／dispose 使舊 schedules 與 callbacks 失效；audition 另時計且排除 metrics。背景 freeze 不靠 timer 保證續播。

若將來採 Worklet，render callback 只做有界 DSP、實際 block length 與預配置 state，不 fetch／await／geometry／physics／log／等待 queue。若將來採 PCM ring，須另外說明 frames/channel/layout、fill target、underflow 的 silence/fade 政策、overflow 拒絕、epoch flush 與實際增加的 latency；現行 native graph 並不需要憑空加 ring。

## 替代、風險與採納門檻

保留 native scheduling 與當前 late policy 成本最低；提前準備 assets／routes 可能比加 horizon 更有用。可預知的 recorded events 可以提前排程，但不能把同一方法直接套到未知 live contact。全面自訂 DSP 會擴大 HRTF／convolution／跨瀏覽器差異、callback deadline 及維護風險，必須有獨立等價 oracle。Web Audio 的 control/render 分工與 scheduled source 語義參考[固定2021 Recommendation](https://www.w3.org/TR/2021/REC-webaudio-20210617/#AudioScheduledSourceNode)；API 定義不證明本產品 deadline 通過。

依[量測計畫](../MEASUREMENT_PLAN.md)，對同一 trace 的冷／暖機、burst、main stall、pause/resume、seek、rate change 量 scheduled/actual 可觀測時間、late age、duplicates、drop reason、output PCM 到達及 discontinuity。實際裝置 latency／耳機聽感另驗，muted graph 不可代替。只有原負載／原品質下晚到與控制成本改善、沒有新增不可接受的操作 latency，且 epoch／phase／一次 propagation 回歸通過，才採納；允許的延遲與誤差先在實作任務凍結，不在研究中臆造。

回復時取消候選 schedule generation、依既有 interrupted boundary 淡出並重錨，回到現有 `startVoice`／native routes；不回寫錄製內容或將舊 epoch 事件再發一次。
