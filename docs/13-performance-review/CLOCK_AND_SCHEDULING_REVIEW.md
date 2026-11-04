# Clock 與排程研究

狀態：CODE FACT／HYPOTHESIS／PROPOSED 分列。基準 `05d40fd2d52f4b737f6acac61fa00356403c0038`；本頁未用 dirty R21 補充資料。七時鐘是資料責任對照，不是新增七個執行緒；offline sample timeline 目前只有型別，沒有實作 renderer。本輪沒有改clock，本頁未比較新clock候選；協調者另行執行的非正式600秒研究見[量測計畫](MEASUREMENT_PLAN.md)與[最終報告](FINAL_REVIEW_REPORT.md)。

正式權威：[Audio Runtime](../02-architecture/AUDIO_RUNTIME.md)、[Data Contracts](../02-architecture/DATA_CONTRACTS.md)、[Physics Architecture](../04-physics/PHYSICS_ARCHITECTURE.md)、[Record/Replay](../07-experiments/RECORD_REPLAY.md)、[ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md)。數值目標只在[Performance Budget](../06-validation/PERFORMANCE_BUDGET.md)維護。

## PERF-CLOCK-001：使用者指定的七時鐘

| Clock | 現行表示／owner | 映射／用途 | 不可混淆的界線 |
| --- | --- | --- | --- |
| 1. Wall clock | app RAF timestamp／`performance.now()`；UTC Date 只作 provenance | bootstrap 用相鄰 RAF 時差；runtime `clock += delta` 節流 live solve／publication；service timeout／timing 用 wall monotonic time | wall elapsed 不等於完成 simulation time；不同 global 的 performance time origin 不拿 raw timestamps 直接相減 |
| 2. Render frame | app RAF 與 R3F useFrame 是不同回呼路徑，皆 main | alpha 由 fixed accumulator 得到；getPose 讀 previous/current 的 copied interpolation | 一個畫面可無 physics step 或含多步；React/R3F frame callback 不決定 physics dt，也不提供硬 real-time 保證 |
| 3. Physics fixed tick | `PhysicsWorld.tickValue`、`FixedClock.currentTick`；預設 h=1/60 | completed step n→n+1；simTime=(n+1)h；behavior、事件時間與 capture 由步後 snapshot 派生 | 不把 RAF index、Date.now 或 CCD 未提供的 substep 接觸時刻當 event time |
| 4. Acoustic snapshot tick | request/frame `poseTick`＋scene/geometry revision；service batch ID | live 在可用時取最新 physics snapshot；結果帶原 tick；solver compute/completion 是非同步 wall interval | snapshot tick 不是 Worker「獨立模擬時間」；geometryRevision 現為 sceneRevision，動態 pose 還必須以 poseTick 分辨 |
| 5. AudioContext clock | native context.currentTime＋simulation/audio epoch pair | emission te→audioEpoch+(te−simEpoch)，各路 absolutePropagationDelay 一次；pause/resume 重錨 | currentTime 不等於實耳時間；base/output latency 與物理 d/c 分開；logical lifetime 不靠 onended |
| 6. Recording timeline | 已接納的連續 integer tick、fixedDtS、runEpoch、event sequence、source cursors | capture append 記 authoritative pose/events/behavior/acoustics；replay 讀保存 frame，seek 改 cursor/epoch | 錄製不是 wall-time gaps 或 RAF cadence；停錄 seal Worker 的完成時間不是 trace time |
| 7. Offline render sample timeline | **types only** `RenderClockMapping`／RenderWindow | sample(k)=round((k−tickOrigin)×p×Fs/q)；明示 rounding、pre-roll、tail、window origin | 尚無 runtime validator/backend/PCM；不能稱已有 sample-accurate full mix、stems 或 offline throughput |

程式引用：[bootstrap](../../src/app/bootstrap.ts) L150–159、315–327；[runtime](../../src/app/runtime.ts) L421–438、774–838、1001–1032、1086–1114、2024–2041；[fixed clock](../../src/physics/fixed-clock.ts) L91–143；[physics](../../src/physics/physics-world.ts) L1176–1288；[audio engine](../../src/audio/engine.ts) L206–220、778–863、1048–1064；[render contract](../../src/audio/render-contract.ts) L27–49。

Behavior 的 tick/cooldown/playhead 是 clock 3 的派生；authoritative replay cursor 是 clock 6 的派生，live Rapier 此時 paused。AI/provider/tool 的 timeout、run quotas、progress 是 auxiliary orchestration clocks，不替換七時鐘，也不進 audio callback。Paused audition 是獨立 preview domain，排除實驗 metrics。

## PERF-CLOCK-002：現行 scheduling 與 overload

```text
RAF wall delta
  -> FixedClock accumulator
  -> up to 4 complete fixed callbacks
       physics step -> post-step snapshot -> behavior -> audio control
       -> if capturing: synchronous acoustic evaluation -> validated append
  -> interactive: discard whole-step wall debt, retain logical tick continuity
     recording: pause and retain debt; no skipped simulation tick
  -> maybe latest live acoustic request (>=50 ms and idle)
  -> runtime view -> coalesced panel publication
```

FixedClock 的 step callback 成功返回才提交其 tick。PhysicsWorld 的 observer error 會 pause，已完成 physics tick 不回滾；runtime fail 走安全暫停，不能描述為整個物理／錄製 tick 具有跨模組原子 rollback。[fixed-clock](../../src/physics/fixed-clock.ts) L110–133；[physics-world](../../src/physics/physics-world.ts) L332–344；[runtime](../../src/app/runtime.ts) L817–818、2052–2055。未來 async recording lane 若要原子 publish，須定義 captured watermark 與失敗 trace 範圍，不能只把 `await` 插入既有 callback。

Replay 每 RAF 最多四次 `nextReplay`，超額仍留 replayAccumulator，沒有 interactive 丟牆鐘時間分支，也沒有同一個 FixedClock recording overrun 暫停分支。[runtime](../../src/app/runtime.ts) L779–800。這是實際差異，不應把兩者統稱同一 overload policy；重播落後與 native audio drift 的大小待量測。未來可比較 retain-debt／暫停並 re-anchor／有界 look-ahead，不能跳 authoritative frames 補速度而不記錄。

PauseCore 凍結 world／behavior／recorder，音訊依 Freeze-and-fade；app RAF 仍可進行 publication／live request housekeeping。Paused state 不代表 AudioContext suspend，context 可供 preview 繼續運行。Authoring drain 取消 acoustic worker、清 pending voices／solutions；一般 pause 沒有等同 terminate 所有 worker。[runtime](../../src/app/runtime.ts) L458–487。Scene/behavior commit 後新 epoch；gravity-only edit 則保留 logical state/cursors、換 revision 並取消舊 batch（L611–672）。每種 transition 都需要個別測，不能以單一 pause fixture 代替。

## PERF-CLOCK-003：聲學年齡的三種量

| 量 | 現行程式事實 | 後續 benchmark 應記 |
| --- | --- | --- |
| Request snapshot age | submit 時用 latest snapshot；request ID 包含 scene/tick/source | sampledTick、submit wall、geometry/input bytes、主緒組裝耗時 |
| Delivery age | runtime 若 latest.tick−frame.poseTick>3，整批不套用；epoch/revision 先檢查 | receive wall、latest tick、accepted/rejected、reason；paused tick 不前進時另記 wall age |
| Display freshness | UI 任一 poseTick 不等 latest tick 就標 stale；busy 先顯示 pending | actual represented tick、published tick、display wall age；不把 20 Hz live frame 描述成每 physics tick fresh |

來源：[runtime](../../src/app/runtime.ts) L1042–1053、2192–2209、2300–2321。過了 3 ticks 的拒收窗不是端到端 latency target，也不保證 wall-clock 50 ms：simulation 可以暫停或 drop wall time。晚結果被忽略與 solver 證明無路徑是不同狀態。

## PERF-CLOCK-004：不可省略的時間映射

Audio emission 時間取 physics/behavior simulation time；每 path 的 absolute delay 已是 source emission→listener 的總傳播時間。relativeDelay 供分析，不可排程時再次加 directDelay。以已包含完整 delay 的 acoustic frame 加另一個「buffer latency 補償」可能雙計 physical delay。應分別記 emission logical time、期望 context arrival、真正建立 native node 的 context time、device latency 欄位；用 acoustic path distance／gain 不同於端到端聲學校準。[Data Contracts](../02-architecture/DATA_CONTRACTS.md)、[Audio Runtime](../02-architecture/AUDIO_RUNTIME.md)。

Web Audio 固定 Recommendation 區分 control/render 執行與 context audio time；以 context epoch 排程不等於主緒 event 可倒回已播放時間。[Web Audio REC 2021](https://www.w3.org/TR/2021/REC-webaudio-20210617/)（2026-11-01 查閱；1.1 Working Draft 新能力仍須 engine feature test）。

Offline 映射使用整數 tick、rational fixedDt 與一次絕對 round，避免反覆四捨五入每 tick delta 累積誤差。1/60 與 48 kHz、44.1 kHz 的一 tick 分別為 800、735 samples，這只是算術例子；任意 fractional emission/subtick、不同 fixedDt 及 fractional propagation delay 尚需 renderer 明確定義。輸出樣本數應由 window 兩端映射差＋tail 算，pre-roll 丟棄、padding 不入輸出。rounding policy 是 nearestTiesToPositiveInfinity；乘積／樣本索引須驗證 safe integer、非負、有限、bounds，不能只靠 TypeScript。這些是[現有型別](../../src/audio/render-contract.ts)的契約與 **PROPOSED runtime validation**，不是已驗實作。

## PERF-CLOCK-005：候選排程設計與決策門檻

| 選項（全部 PROPOSED） | 可解的問題 | 不能解／新增風險 | 決策前證據 |
| --- | --- | --- | --- |
| 維持主緒 fixed clock，先分段 instrumentation | 找到剩餘實際成本；保留較小 lifecycle 範圍 | 不移走 CPU | 正式 profile 分段時間、GC、catch-up debt、input latency |
| bounded recording evaluation Worker | 把 capture acoustic evaluation 與部分 serialization 移離 main | 跨 thread ACK、水位、記憶體、finalize drain、取消一致性；不能 latest-overwrite ticks | 原 artifact/events/cursors/hash 等價；滿載 pause；failure/timeout/stop/seek fixtures |
| physics Worker | 隔離 Rapier step CPU | input→step latency；同步 query 介面需重設；grab/build collision ownership、revision、wake/reset/dispose 次序擴大 | main physics 是量測瓶頸；worker prototype 在等負載改善 tail 且輸入/physics fixtures 不退步 |
| live solver coalescing / publication cadence 調整 | 降過時工作／delivery 或 view load | 快速 motion 更新滯後；path age 及 audible late 可能增加 | request age、rejection ratio、path continuity、同輸出模型比較 |
| recording replay look-ahead scheduling | 減主緒 jitter 對已知未來事件的影響 | 必須處理 pause/seek/stop cancellation、tail與當前 cursor，不能預知 live contact | replay sequential identity、arrival一遍、epoch cancellation、alignment |
| offline sample scheduler | 與 wall-time 完全分離的可重現輸出 | 目前無 backend；native opaque DSP不保證跨引擎 bit exact | sample-count/alignment/tail tests與實際 capabilities；詳[Recording/Rendering](RECORDING_AND_RENDERING_REVIEW.md) |

## PERF-CLOCK-006：必保留的順序與測量收據

Future task 必須凍結：accepted command/revision→control before step→physics/contact copies→post-step tick stamp→behavior input order/dedup→logical voice intent→acoustic identity/revision validation→native admission→record commit。不可把 render 插值姿態回寫 authoritative trace；不可讓 native onended 或 worker completion 排序改變 deterministic logical lifetimes；不可拿 Date.now 產生音訊 emission time。

最低量測記錄建議欄位是 run/bundle/Git/browser/hardware、mode/epoch/revision、RAF sequence/delta、tick range/steps/alpha、debt/dropped wall seconds、sampled acoustic tick/submit/receive/consume、recorded commit watermark、audio epoch/currentTime、pending arrivals／late/reject counters。跨 global 比較用 request correlation 和各自 duration，或明示換算 `timeOrigin+now` 的條件；不直接比較不同 realm 的 raw now。wall provenance 與 monotonic intervals 分開。

候選 Proposed ADR 應明列七時鐘、control/data ownership、mailbox/lossless queue 分類、capacity單位、滿載 pause/drop/reject、publish barrier、取消及 crash recovery、mapping rounding、observability／future acceptance。先量再選，不因數字是 schema cap 或型別存在就宣稱 clock synchronization 已驗證。[Measurement Plan](MEASUREMENT_PLAN.md)、[Buffer Review](BUFFER_ARCHITECTURE_REVIEW.md)。

時間原點概念另參考 [High Resolution Time](https://www.w3.org/TR/hr-time-3/)（2026-11-01 查閱；該頁為 2026-09-01 Working Draft）。它支持區分 monotonic time／time origin 的研究說明，不在此新增 API、採納草案或承諾跨瀏覽器解析度／deadline。
