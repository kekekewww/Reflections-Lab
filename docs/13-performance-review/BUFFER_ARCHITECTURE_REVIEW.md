# 緩衝架構審查：D1–D8 的資料語義、期限與所有權

狀態：基線靜態查核＋PROPOSED 架構；日期 2026-11-01。基線為 05d40fd2d52f4b737f6acac61fa00356403c0038；不包含其他 checkout 的未提交實作。本頁為靜態Buffer候選審查，沒有修改產品、設定、測試或驗收，也未執行D1–D8候選實作比較；協調者另行執行的非正式600秒研究見[量測計畫](MEASUREMENT_PLAN.md)與[最終報告](FINAL_REVIEW_REPORT.md)。業界依據及原廠版本見[業界架構](INDUSTRY_AUDIO_ARCHITECTURES.md)。

## 核心判定與基線

現行 native Web Audio graph 不是缺一個通用 PCM ring。預讀能吸收有限供料抖動、提前準備已知資料；無法修復持續平均吞吐不足、預知碰撞或延長當次 callback 的 deadline。先定位哪一段失約，再決定 queue、cache、batch、減少重工或更換演算法。

靜態查核已見以下防線，不能當作待新增功能重複提案：

- [AudioAssetStore](../../src/audio/assets.ts) 持有 decoded bank，核對 provenance／revision、預算及 in-flight decode bytes；有 decode concurrency gate、generation cancellation 與 built-in reuse。沒有據此宣稱已具自動 LRU 或串流播放器。
- [AcousticService](../../src/app/acoustic-service.ts) 是一個 in-flight batch、busy rejection、payload／source／path／timeout 上限、reply identity 與有限 timing samples；不是已有一個 pending-latest queue。
- [Runtime](../../src/app/runtime.ts) 在發布 solver 結果時檢查 run epoch、scene revision 及 pose tick 年齡；pendingAudio 等待有效解。錄製 tick 的同步求解另有完整性目的，不能直接套 interactive coalescing。
- [AudioEngine](../../src/audio/engine.ts) 已有 voice／source／frame／pending-event／path 預算、priority admission／stealing、lateEvents、source-frame retention 和 pause／resume arrival 政策；這些不是完整 voice virtualization。
- [FIR](../../src/audio/band-filter.ts) 已按 normalized response 快取，分離 pressure scale；有固定 workspace、layout plan、entry／byte cap、copy ownership。[PathRoute](../../src/audio/routes.ts) 依 stable path ID 重用 route，identicalKernel 避免相同 shape 重建 buffer，delay／direction 各自更新，雙 bank 淡入淡出。[LateReverbBus](../../src/audio/late-reverb.ts) 亦有雙 bank、IR 設定重用及 latest pending。
- [Recorder](../../src/experiments/recorder.ts) 已有完整 frame／event／byte 限制、tick／identity 驗證、immutable capture、封存 Worker 與 IndexedDB commit；尚不能稱為 incremental chunk journal。細節見[錄製與渲染審查](RECORDING_AND_RENDERING_REVIEW.md)。

以上是 code inspection，沒有新增 browser、hearing、deadline 或長跑證據。

## 不同資料的 queue 政策

| ID | Producer → consumer／資料 | 過期或滿載政策 | 優先量測 |
| --- | --- | --- | --- |
| BUF-D1 | decode／custom DSP Worker → AudioWorklet 的 PCM | 固定容量；明示 underflow／overflow；render 不等待 | occupancy、producer lateness、underrun frames |
| BUF-D2 | solver → control/audio 的聲學 snapshot | 同 run／source／revision 範圍的 continuous 更新可 latest-wins；跨 revision 拒絕 | compute／clone／delivery／age |
| BUF-D3 | physics → behavior／recording 的離散事件 | 有界有序且不重複；recording 不可覆蓋事件 | count、age、sequence gaps、rejections |
| BUF-D4 | logical emission → native audio 的排程 | 明示 late／missing-solution／admission deadline | event→admission→onset 各階段 |
| BUF-D5 | asset storage／decode → decoded bank | 既有 byte/concurrency gate；必要時安全 eviction | hit rate、decode tail、peak bytes |
| BUF-D6 | control／solver → FIR／IR／route | 重用相同 shape；有界 bank 更新及 tail ownership | cache misses、IR generation、node peaks |
| BUF-D7 | recorder → storage／export 的 lossless chunks | backpressure 暫停或 interrupted；不可 latest-wins | serialization、queue bytes、commit lag |
| BUF-D8 | thread 間大型 payload／ownership | 單一 owner 或明確 shared protocol；不可提前 recycle | clone／transfer duration、bytes、GC |

## BUF-D1 — PCM ring：只用於已證明的 block mismatch 或異步供料

適用條件：未來自訂 DSP kernel 的 block 與 browser 實際 quantum 不同、Worker 需提前產生 PCM，或長音訊串流需有限 read-ahead。現行 source／gain／delay／convolution／HRTF 主要是 native graph；在其外包一層 PCM ring 會新增 latency、copy 及 ownership，不應無證據採用。[IND-06](INDUSTRY_AUDIO_ARCHITECTURES.md)

Contract 建議：以 frames 而非 ambiguous samples 記容量；通道格式、sample rate、epoch、start frame 及 producer／consumer 各唯一 owner。初始化預配置 storage，先填資料再發布 write position，讀完才發布 read position；支援 wrap spans 與每次實際 channel length。AudioParam array 長度 1 與逐 frame 值分開處理。Callback 不 await／spin／等待 Worker；block adapter 仍須在當次 render budget 內完成。SPSC 可參考 [JUCE AbstractFifo](https://docs.juce.com/master/classjuce_1_1AbstractFifo.html)，不能直接套成 JS 或多 producer 的安全證明。

水位與界線：設定 low/high water、maximum capacity、最大 producer burst、producer 最晚完成期限和啟動 prefill；容量必須容納合法 burst，不能無界增長。Target occupancy／sample rate 是 queue residence 的近似；capacity／sample rate 只是最大儲存深度，並非固定新增 latency。分析例：4096 frames、stereo Float32 是 32768 bytes；在 48 kHz 只排 1024 frames 約有 21.33 ms residence。這不是產品預設或實測。

Failure policy：underflow 填零或受控 fade 並計數缺失 frames；是否補回、跳過或重新錨定需按用途固定。不要偷偷重播舊 PCM、改速或覆蓋未讀資料。Interactive freshness 可以選擇明示 discontinuity 後丟舊資料；錄音／輸出若要 lossless，必須 backpressure，不能共用丟棄政策。

採用前證據：比較 native baseline、只有 block adapter、Worker producer 三者；固定 source/seed/paths/output，記 steady-state 及 burst occupancy、首聲延遲、render peak/tail、underrun、memory。只有 ring 變大而持續耗盡不算修復。新驗證 NOT RUN。

## BUF-D2 — 聲學 snapshot：latest valid，不堆積未來會過期的解

現況：AcousticService 一次接受一批；busy 呼叫回 SOLVER_BUSY。Host 以 epoch／revision gate 擋舊工作，拒絕超過既定 pose tick 窗口的解；AudioEngine 亦檢查 frame revision／tick regression。原有 source-frame retention 已存在；本提案不另建第二份無界 frame cache。

候選：若量測顯示求解頻率與 pose 生產失配，採「一個 in-flight＋一個 pending-latest」或 immutable double／triple snapshot。Producer 完成全部驗證後才原子發布完整 snapshot；consumer 只持有已發布版，writer 不重寫被讀 buffer。三 buffer 只能減少 ownership 衝突，不保證 freshness 或更快求解。

每個 snapshot identity 必含 request／source／listener、scene／geometry revision、pose tick，host 另維持 run epoch／generation。Coalescing compatibility key 是 epoch／generation＋source／listener＋revisions＋相容 configuration／medium，允許 pose tick 單調增加；不要求不同 snapshot 的 request ID 相同。Latest-wins 僅在此有效範圍與允許的 continuous 更新內成立；新 topology／medium／run／source 消失時先 invalidation，不把另一 revision 的舊解當新解。無有效解時沿用政策只適用於仍合法的舊解，並明示 stale；不是無限有效。

錄製／acoustic A/B 若要求每個 tick 的 solver reference，須保留每 tick 結果或 pause/backpressure，不能以 interactive latest-wins 刪掉中間樣本。量 compute、serialization、postMessage、delivery、apply graph 與 frame age；當前 service 的 delivery timing 明確不包含 app audio／UI consumer，不能拿它代表全 delivery。新 double/triple buffer 的並發、late reply、cancel、dispose、new revision 測試 NOT RUN。

## BUF-D3 — 物理事件：有界、有序、dedup；continuous 才 coalesce

基線：[physics-world](../../src/physics/physics-world.ts) pending event cap 2048、command ID dedup cap 4096；[behavior runtime](../../src/audio-behavior/index.ts) 檢查 tick／scene revision／run epoch，另有 frame-event 上限。UI eventLog 是有限展示，不是完整錄製權威。不能因畫面 log 可截斷，就認為 physics／behavior／recording 可截斷。

Contract 建議：每個離散事件保留 stable event ID、run epoch、tick、tick 內 sequence、revision、accepted state 及 causal parent。Physics 到 behavior 的消費順序和一對多 voice intent 都需可重播；重試／late delivery 不重複發聲。Continuous pose／gain／motion-state 可依 ID 保留最新值並平滑；impact start／stop／throw／drop 等不可用同一 latest slot 覆蓋。Stop／cancel 也不可因高負載遺失。

Overflow：interactive 拒絕新事件或採已核可的 priority 政策並記原因、數量與可見降級；recording 在丟失前 pause/backpressure，若已不完整標 interrupted，保留原事件。Batch 搬運只改 transport，不改 tick 或 sequence；不可把多個碰撞壓成單一事件來達標。

驗證候選：contact storm、同 tick 多物件、duplicate delivery、epoch 切換、consumer stall、queue full、stop 在尾端及重播一致性。觀測 event age、max occupancy、reject／duplicate／gap count，與展示 log 長度分開。新驗證 NOT RUN。

## BUF-D4 — 排程：clock mapping、lookahead、late policy 與新 voice admission

基線 AudioEngine 用 audioEpoch＋(emissionTime−simulationEpoch) 算 source start，再以 native path delay 實作 absolutePropagationDelay。遲到超過既定條件會計 lateEvents 並 clamp 到 currentTime；這不是 deadline 保證。Pending voice 需有效聲學 frame；原始聲學／發聲時鐘規範見[AUDIO_RUNTIME](../02-architecture/AUDIO_RUNTIME.md)。

候選：只有量測 main-thread 排程 jitter 造成 miss，才評估 bounded lookahead／epoch lead。新的互動事件不能預知；加入固定 lead 會增加輸入到聲音 latency，需與 audible glitches、同步感一起比較。裝置 base/output latency、queue residence、solver age、演算法 group delay、聲學 d/c 分別報告；不得把 lead 同時加在 epoch、source start 與 DelayNode。

新 voice 必須有 deadline：有效 current solution 就 admission；解未到時選有限 defer、明示 drop 或已授權的 genuine direct-only solver fallback。Fallback 仍須符合相同 revision、medium、occlusion、gain、delay，且記 capability/degradation；不畫假聲線，不把無解當零距離直達，不偷偷繞過統一 SourceGraph。錄製保留 logical emission 及 admission outcome，不把晚播改寫成原發聲時間。

Late policy 應依 one-shot／continuous／replay 明訂「立即補播、skip expired、追上 sample offset 或拒絕」；這些改變內容與相位，不能當等價。Lookahead queue 有固定事件／byte／時間上限；pause／resume／seek／epoch change 取消舊排程，未到達的 logical arrivals 只重排一次。測新／舊 source 首聲、stop、pause tail、time jump 與 d/c 一次性的候選測試 NOT RUN。

## BUF-D5 — 資產：延續 decoded bank，按需求補 eviction 或 streaming

已實作：AudioAssetStore 的 decoded bank、byte reservation、native decode concurrency、WAVE preflight／native output 核對、in-use replacement gate 和 generation cancellation。新 one-shot 重用 decoded AudioBuffer；已停止 AudioBufferSourceNode 不能重新 start。不要另建平行「PCM cache」繞過 budget／provenance。

優先候選：在合法 authoring／prepare 階段 preload 預期資產，以 asset ID＋revision＋hash＋decode sample rate 定義快取身分；量 decode hit/miss、首聲等待、reservation 尖峰。若重複 import 同資產確為熱點，再評估 single-flight decode，保留 caller 的失敗／取消語義。不要只看 decoded bytes：encoded input、slice、native decoder、temporary result 及同時播放 buffer 都可能重疊。

LRU 僅在工作集超過既有 bank、且量測有命中／記憶體收益時新增；不可 eviction active、retiring、paused/frozen、pending-resume、export reference 或 in-flight decode。需明訂 pin/refcount、bounded metadata、release 和重載失敗；目前 code 不能描述成已有 LRU。

Streaming 僅在長資產不適合常駐時提出獨立格式／seek／prefetch／decode buffer contract；資產 read-ahead 與輸出 latency 分開。先用[FMOD 的分層](INDUSTRY_AUDIO_ARCHITECTURES.md)當比較，不能把 native decodeAudioData 當 incremental streaming API。LRU／single-flight／streaming 的改善與首聲／記憶體回歸均 NOT RUN。

## BUF-D6 — FIR、IR 與 path：保留既有 shape／scale 分離與 bank reuse

現有 FIR cache 已將 bands 的 normalized shape 與 scale 分開，uniform gains 走 native gain；response／layout／scratch 有界且不外洩 private storage。PathRoute 先更新 delay／direction，只有 kernel shape 不同才換 AudioBuffer，gain-only 可更新 scale；stable path ID 重用現有 route。不能把「分離 gain 與 shape」列為完全未實作。

應先量 cache hit/miss、key／copy 成本、kernel generation、Convolver buffer replacement、route birth/death、同時 active/fading/retiring node 與 byte peaks。若 miss／key/copy 才是主因，再考慮 versioned immutable kernel handle 或 bounded per-context AudioBuffer reuse；不得直接把可變 cache array交給 caller，或跨 context／sample rate 錯用 native objects。

IR bank 交換需包含 incoming prefill、crossfade、舊 tail 及 pending-latest 所有權；雙 bank 的運算／記憶體尖峰列預算。LateReverbBus 已重用相同 seed／decay IR，wet gain 不要求重建；先驗證是否有新的長尾重工才加 IR cache。短 FIR 的 group delay、late IR onset 與 physical propagation 分開記，normalization=false 的物理 gain 語義保留。

Future worker 產 kernel 可用 D2 snapshot／D8 ownership，但 render 不等它；完成時再次核對版本。量測時固定原 shape 精度／tap count／path cap／聲學 tolerance；變更近似品質是另外決策，不能暗降。新 cache／DSP／聽測比較 NOT RUN。

## BUF-D7 — Recording／export：lossless chunk queue 與 commit protocol

基線 recorder 在 append 做 immutable clone／canonical byte count 與 validation，再進有限 frames；finish 才把 snapshot 交 sealing Worker。Storage 有 hash／identity／commit 驗證，並非逐 tick 已 durable。現有完整性檢查須保留；以[錄製與渲染審查](RECORDING_AND_RENDERING_REVIEW.md)為詳細設計權威。

候選 chunk journal：frame batch 有 run／epoch、first/last tick、sequence、schema／configuration digest、byte count、chunk hash 及前後連結；queue 有 byte 與 chunk 上限。Writer 依序驗證、寫暫存、成功 commit 後才 ACK 並釋放 owner。最終 manifest 僅引用已提交完整連續 chunks；flush 只表示目前 queue drained，不等於整個 run 已 final／Captured。

Backpressure 必須在 fixed-step 產生新權威資料前安全 pause；quota、IDB denial、worker error、tab close／freeze／crash 留 incomplete/interrupted 記錄，不能自動轉 volatile memory 後仍稱 durable。UI 提供 commit lag／pending bytes；recovery 掃描只採 hash、identity、sequence 都合法的 committed prefix，不能把中斷重新標 Captured。

Offline export 的大 PCM／stems 是不同 artifact，可使用 bounded chunk sink、取消／重試／清理及最終 hash；不可把 recording JSON 換名成 audio renderer。採用 incremental chunk 可能涉及 schema／migration／回復測試，須另立 implementation task。本輪相關性能／quota／crash／offline rendering 測試 NOT RUN。

## BUF-D8 — Transferables／SAB／pool：先量 clone，再定 protocol

基線 acoustic postMessage 走 structured clone；service 已避免為保留 identity 重複 clone 全 geometry。Recording seal client 亦有 output copy、hash、decode/parse／freeze，這些是驗證／ownership 工作，不能只因看到 copy 就移除。先分開 payload build、clone、serialization、validation、apply 與 GC；僅當 clone 被證明是主導成本，再比較 transferable／pool／SAB。

Transferable：send 後 sender buffer detached；必須確定 recorder、replay、hash、cache 或 UI 無引用，receiver validation 完成前不發布。Pool lease 有 owner／generation／state；dispose、timeout、cancel、stale reply 時不得提前重用仍被另一 thread 讀取的記憶體。Object graph 的 clone 也不會僅因附 transfer list 就自動零 copy。

SAB：評估 COOP／COEP、第三方資產／embed、fallback 及安全部署相容性，再選 bounded SPSC／snapshot protocol。資料寫完才用 Atomics 發布 index／sequence；consumer 先讀已發布狀態，完整消費才回收。多 producer 或 variable payload 需要更完整 admission／ownership，不靠幾個 atomics 自動安全。Audio render 不 Atomics.wait、不 busy wait；通知遺失／producer stall 必須可恢復。

比較相同 payload 與 identity 驗證的 clone、transfer、shared 三模式，含 pool exhaustion、ABA/generation、detach misuse、mixed revisions、error teardown。計額外常駐／峰值 bytes、重用率、延遲尾部及 browser compatibility。沒有 clone-dominant 證據就保留簡單 owned messages；SAB 不保證 solver 或 native DSP 更快。新量測及部署相容性 NOT RUN。

## 決策順序與不可越過的界線

1. 先按 D2／D3／D4 分離 freshness、順序與 audio deadline，再補 D5／D6 的既有 cache／node telemetry。
2. Recording 的 D7 以完整性與可回復 commit 為前提；與 interactive pipeline 分開驗證。
3. D1／D8 只有符合前述採用條件才進 prototype；每個 buffer 都有 owner、units、capacity、age、overflow／underflow、cancel/dispose 政策。
4. 新方案必須在相同 scene／seed／source／path／physics tick／品質及凍結驗收條件下比較。不可放寬 cap、取消事件、降低精度或用 offline throughput 取代 live 穩定性。
5. 本頁研究狀態不表示採納或交付。所有新增驗證 NOT RUN；現有未完成產品／效能／聽測門檻維持原狀。