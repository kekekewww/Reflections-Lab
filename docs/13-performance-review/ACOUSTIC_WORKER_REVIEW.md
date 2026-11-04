# Acoustic Worker 與 Live Delivery 研究

狀態：CODE FACT 靜態核對；所有新 buffer／scheduler 選項均 **PROPOSED**，改善幅度 **UNMEASURED**。基準 `05d40fd2d52f4b737f6acac61fa00356403c0038`；未混用 dirty R21、舊 HEAD 或公開 snapshot。本輪只作文件研究，無產品、schema、package、門檻變更，無新 benchmark PASS。

## PERF-ACO-001：現行服務已經有界

[AcousticService](../../src/app/acoustic-service.ts) L4–11、324–491 已實作 one-in-flight，沒有隱藏 waiting batch。service busy 時 `solve` 回 `SOLVER_BUSY` 並計 rejection；LabRuntime 通常先查 busy，所以忙碌期間不建立 FIFO backlog。[runtime](../../src/app/runtime.ts) L821–828、1034–1046。不能把現況描述為「每個 RAF 都塞 worker queue」或「尚無 backpressure」。

| 層 | 現行限制／語義 | 性能含義與限制 |
| --- | --- | --- |
| runtime behavior | 16 logical voices，object cap 8 | voice cap 不代替 engine/emitter/path caps |
| acoustic input builder | 16 explicit sources、256 poses；default maxPaths=8、maxSurfaces=256、maxSegmentTests=10000 | complete geometry 超界拒絕；sources/objects stable sort |
| service batch | ≤32 sources、每 source ≤256 surfaces/materials；所有 requested maxPaths 合計≤256；payload≤2 MiB | app builder16與service32不是矛盾，兩層範圍不同；不能宣稱32-source產品profile已量 |
| solver | caller budgets，maxPropagationSeconds 預設2／共享硬上限5；first-order finite planar geometry | budget count 是 work bound/quality limit，非wall CPU deadline；direct/incomplete/unsupported不同 |
| worker lifecycle | 單 Worker/單 batch；timeout≤5000ms；取消/錯誤 terminate，後續 ensureWorker 建立 | Worker重啟有成本；timer在main排隊，無法打斷主緒同步工作 |
| reply/history | 128 timing samples；合法 reply identity/shape/size完整檢查 | response cap 限制 handler shape，不能消除 browser 收到clone前的成本 |
| source frames/native graph | AudioEngine另驗revision/tick/paths/voice/frame budgets | service通過不等於native admission接受，native拒絕必須保留原因 |

來源：[input](../../src/app/acoustic-input.ts) L39–135；[service](../../src/app/acoustic-service.ts) L279–323、415–491；[solver](../../src/acoustics/solver.ts) L260–287；[audio control](../../src/audio/control.ts) L3–49。正式 profile/targets 只在[Performance Budget](../06-validation/PERFORMANCE_BUDGET.md)維護；32 surfaces/8 sources/order≤2起始profile與現行一階能力應明示差異，不能為達標假稱已有二階。

## PERF-ACO-002：現行 live 狀態機

```text
IDLE
  -> request construction on main
  -> service admission: busy? reject; bounds/bytes/identity valid?
  -> pin scalar identity; submit; start timeout; state IN_FLIGHT
  -> Worker: synchronous serial map(solveAcoustics)
  -> reply arrives on main
       wrong worker/batch/disposed -> ignore late reply
       malformed/solver error/budget/identity mismatch -> reject + terminate
       valid -> clear pending, record timing, resolve promise
  -> runtime epoch/revision gate
  -> runtime age gate (>3 physics ticks -> keep old solutions)
  -> replace published solutions; audio updateFrame; pending voice admission
  -> runtime view publication; coalesced panel delivery
  -> IDLE
```

此圖不表示 service 與 runtime publication 是同一原子交易。service 在 resolve 前已清 pending；下一個 microtask 進 runtime consumer。runtime 可以因 epoch/revision/age拒絕已被 service 計為 completed 的 batch，這不是 transport failure。[service](../../src/app/acoustic-service.ts) L493–556；[runtime](../../src/app/runtime.ts) L1042–1075。

**取消／錯誤。** cancel會reject pending並terminate同步執行中的 Worker；重建在下次submit，沒有 worker中途cancel message polling。timeout與worker error也terminate。晚reply以port/batch身份忽略。factory缺少（例如明示useWorker:false／沒有Worker）時直接 `requests.map(solveAcoustics)` 然後回已resolve Promise，沒有background計算、pending timer或可中斷的sync fallback。[service](../../src/app/acoustic-service.ts) L349–383、444–459、569–596。

**Pending不只一種。** service pending是一批transport；runtime pendingAudio保存原始start intent與voice input，等待有效frame後native admission；UI pending是busy視圖；panel pendingSnapshot是可覆寫latest view。四者有不同所有權與可丟資料政策，不能以一個「加buffer」概括。[runtime](../../src/app/runtime.ts) L101–105、902–918、1054–1073；[bootstrap](../../src/app/bootstrap.ts) L242–279。

## PERF-ACO-003：組裝、validation 與結果一致性

送出前main上已有scene validation、pose map／source/objects sort、box-face generation、materials/atmosphere clones；box cache只存活單一build call，後續sources仍clone。moving object即使作者標reflector仍作snapshot dynamicOccluder；source owner不納入自身表面。[acoustic-input](../../src/app/acoustic-input.ts) L39–135。Worker存在不會移走這些工作。

service先 bounded tree walk，再JSON.stringify/TextEncoder計request bytes；native postMessage沒有transfer list。保留scalar identity避免service再clone整個geometry，但不等於transport零copy。[service](../../src/app/acoustic-service.ts) L243–277、421–435、483。WHATWG將跨realm序列化與transfer區分；要使用transferable arrays，必須明確轉換資料表示及所有權，不能直接transfer仍由多處持有的Scene/record data。[HTML structured data](https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializewithtransfer)（2026-11-01查閱，Living Standard 2026-10-30）。

reply依known keys檢查plain shape、dense arrays、finite values、source/listener/sceneRevision/geometryRevision/poseTick、path count/band vectors/model/capabilities。單一source error使整批拒絕；不會靜默拿部分來源冒充完整batch。requestId/sourceIds不可重複；reply按request index對identity。這些安全／domain gates必須保留，packing優化不能以「worker可信」刪掉。[service](../../src/app/acoustic-service.ts) L90–240、279–323、500–545。

runtime另外檢查runEpoch/sceneRevision及age>3ticks；UI則在poseTick不等latest時就標stale，因此一個合法且接納的20Hz結果仍可顯示stale。空paths、vacuum unsupported、budget failed、stale不同，不可捏造IR或有效反射。[runtime](../../src/app/runtime.ts) L1042–1053、2300–2321；[solver](../../src/acoustics/solver.ts) L328–383、516–521。

## PERF-ACO-004：真正的求解成本邊界

solver每source重新prepare、複製、排序surfaces與material map；surface validation包含頂點間幾何檢查。direct trace逐surface；每static反射候選可能跑兩條segment，每條再掃surfaces。maxSegmentTests限制ray/surface測試數；不涵蓋全部validation／path sort成本。maxPaths在候選完成後按direct優先、能量、stable ID排序才slice；降maxPaths不保證等比例減少solver compute。[solver](../../src/acoustics/solver.ts) L60–140、279–297、417–511；[geometry](../../src/acoustics/geometry.ts) L39–77。

這是靜態複雜度與allocation事實，**不是**實測「O(N²)已造成瓶頸」或性能勝負。候選研究包括：pin topology/material epoch＋dynamic pose packet、Worker-side prepared-geometry cache、typed packet/transfer pool、broad-phase/BVH、分段 solver與可取消boundary。每項都需相同finite-polygon visibility、surface/source ownership、stale geometry、canonical path IDs及budget/quality結果的reference比較；不先改公式或budget masking性能。目前geometryRevision等於sceneRevision，不能單獨當作移動遮擋物world-space geometry的cache key；可快取immutable local geometry，再依poseTick／實際pose重建world surfaces，或以完整變換內容作key。見[Worker Communication提案](proposals/ADR-PERF-04-worker-communication.md)。詳[Measurement Plan](MEASUREMENT_PLAN.md)。

## PERF-ACO-005：單 in-flight 與 triple buffering 的選項

「三個槽位」須先說明是三個資料ownership slots，還是admission/inflight/pending/publication角色；現況的single pending＋published solutions不是已實作triple buffer。

| 選項（PROPOSED） | Admission／pending／publication | 好處待驗 | 代價／不能省略的語義 |
| --- | --- | --- | --- |
| A 保留single-flight現狀，分段量測 | idle才sample；無waiting；valid且fresh才publish | 最少改動，基準清晰 | 不解capture同步CPU；可能落後/拒收，需age histogram |
| B single-flight＋一個latest unsent descriptor | busy時只覆寫未送descriptor；完成後取最新有效snapshot；published另持有 | 可能降低idle gap／過時輸入 | 需決定descriptor存完整immutable snapshot或僅latest pointer；後者不保留舊tick，不能給recording用；sample時點/bytes都要記 |
| C 三槽transferable input/output pool | FREE→WRITING→READY→READING→FREE，明示ACK；最新READY可替換但READING不得覆寫 | 可能降低allocation與copy、穩定memory | 三槽不是吞吐保證；需容量、detach、version、epoch、error reclamation；published consumers仍持有時不可回收 |
| D SAB／Atomics mailbox | publishedsequence、length/capacity、owner states；reader不等producer | 可能避部分clone | COOP/COEP/asset相容性、安全與memory model；audio render不等待lock；未測不得預設可用 |
| E 多Worker pool | boundedworkers/batches、source partition及publication barrier | 可能提升大batch throughput | contention/startup/memory、結果合併與stale率；現在16voices與20Hz負載不自動支持此成本 |
| F bounded recording FIFO | 每tick immutable輸入，有界count/bytes，ACK後推commit watermark，滿載 pause producer | 保留實驗資料並移走capture evaluation | **不是live latest mailbox**；不可覆寫未處理tick；finalize drain／crash／retry要保存可比性 |

三槽適合「writer不能碰reader持有區」的ownership問題；若主要成本是每ticksolver、request geometry重建或native graph，單加slot不保證改善。產品採用前需用相同payload/scene比較A/B/C，計總end-to-end成本而非只postMessage時間。structured clone、transfer detach及借出publishedframe的生命週期要畫完整，含oldepoch late replies。[Buffer Architecture](BUFFER_ARCHITECTURE_REVIEW.md)、[Memory Review](MEMORY_AND_RESOURCE_REVIEW.md)。

## PERF-ACO-006：不可混為一談的 recording 路徑

Recording `onTick`直接同步solve，按16sources切分後立即map；它沒有使用AcousticService限一批，也沒有yield。active voices＋當tick停止等diagnostic events可能需要多組，分組是API source上限處理，不是非同步分批。之後 appendFrame還有完整snapshot／canonical validation/freezing。[runtime](../../src/app/runtime.ts) L935–978。停止封存用專用Worker是另一階段；不能用seal Worker 測試證明capture不阻塞。[Recording/Rendering](RECORDING_AND_RENDERING_REVIEW.md)。

Live過時frame可丟；recorded tick、原event order、behavior決策與emission/cursor不可因忙碌略過。未來record-evaluation lane應是單獨proposal，定義最大bytes/items、producer pause、ready/committed watermark、seal barrier、錯誤回復與hash equivalence。不要把live single-flight 替換成 lossless FIFO，讓主緒與audio間累積舊幾何；也不要把recording換成latest-only。

## PERF-ACO-007：telemetry範圍與後續驗收

service 已有 request/response bytes、pending age、submitted/completed/failed/cancelled/timeout/busy/budget/late/restart 計數；128 條 timing ring 計 roundTrip/workerCompute/delivery p95。[service](../../src/app/acoustic-service.ts) L386–413、565–567。但 roundTrip 起點在 request check/encoding 之後；worker compute 從 handler entry 量到 response postMessage 呼叫前，排除 reply serialization/send；delivery 從 receive 起至 resolve 前，不含 application audio/UI consumers。runtime 因 age 拒收的 batch 仍已計 service completed，需另加 consumer accept/reject 統計；本輪僅提出，不聲稱已做。

未來 minimum fixture：submit while busy／oversized payload 早拒、malformed/sparse/reordered/wrong-revision reply、partial source error、cancel/timeout/crash/restart、old-port late reply、pause 後回覆、authoring/epoch 切換、3 tick 邊界、native admission fail、rapid birth/death、dispose with in-flight；reuse 現有[servicefixtures](../../tests/app/acoustic-service.test.ts)並保留reference/tolerance。效能 fixture 另量 source×surfaces×bands×paths、capture on/off、overload、geometry dynamic/static、payload bytes／GC／consumer times。功能 PASS 與性能 profile 分開，不降低現有門檻。[Measurement Plan](MEASUREMENT_PLAN.md)。
