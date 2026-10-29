# UI 與 runtime 效能規範

更新：2026-10-26。狀態：**量測規範及補充提案；正式 UI、瀏覽器 profile、裝置音訊與端到端效能測試全部 NOT RUN**。產品數值預算的唯一權威為 [PERFORMANCE_BUDGET.md](../06-validation/PERFORMANCE_BUDGET.md)；本文件維護六項分開的量測邊界、證據與 UI 補充提案，不另改既有門檻。[架構](../02-architecture/ARCHITECTURE.md)、[音訊時間契約](../02-architecture/AUDIO_RUNTIME.md)與[物理固定步](../04-physics/PHYSICS_ARCHITECTURE.md)維持各自責任。Node kernel benchmark、native SDK smoke 與 UI 文件審查不能代替以下結果。

## 量測配置先於門檻

先建立可重播、具 hash 的 synthetic 場景與固定操作序列，再以指定硬體量測。每份報告保存 OS、CPU、RAM、GPU／driver、螢幕更新率、CSS viewport、DPR、zoom、瀏覽器完整版本、電源模式、build／依賴版本、scene／material／motion hashes、source/listener 數、dynamic/fixed body 數、接觸數、可見／總路徑數、audio device、sample rate、實際 block size 與 voice 數。沒有 GPU／裝置資料就填 UNKNOWN，不能借用先前 CPU 記錄宣稱已測完整硬體。

初版 `desktop-60` 量測配置提案：1920×1080 CSS px、DPR 1、100% zoom、目標呈現 60 Hz；靜態房間＋100 個 dynamic primitives、一個 continuous source／listener、至多 64 條顯示路徑及 16 個 contact voices。這些數量是測試輸入與候選上限，**不是已實作的容量保證或最後產品上限**。另測 DPR 2／200% zoom、1000 物件、10000 路徑及 collision storm；壓力配置不套用一般配置的流暢保證，但須安全降級、可暫停與保留資料。實作若採不同 voice／path cap，須在報告中指明並重新評估預算。

目前 Scene／AcousticFrame schema 各有 256 objects／每 frame 256 paths 上限；1000／10000 是超限拒絕或隔離純呈現 adapter 的測試配置，不能作合法 runtime 輸入。詳 [壓力測試邊界](UI_STRESS_TESTS.md)。效能提案不修改既有 domain cap。

每個配置冷啟動獨立記錄；暖機後依正式預算要求量測（目前 UI profile 是 10 min），重複次數與暖機時間寫入報告，保留各次 raw samples 與 p50／p95／p99／max／超限數，不只報平均。短時間 exploratory sample 必須標 smoke，不能代替正式 profile。記錄 DevTools、screen capture、CPU throttle 是否開啟及其測量干擾；模擬降速配置另列，不冒充真實低階硬體。顯示更新率高於 60 Hz 時另列 `desktop-native-refresh` 結果，不把每秒 60 次更新硬稱達到 144 Hz 呈現。

## 六種預算各自判定

以下 ID 是量測分類；既有門檻與基準場景只引用正式預算表對應列。`desktop-60` 是 UI 複合負載的補充配置，不能以更小場景通過取代 physics 的 256 primitives／CCD／contact flood 或 acoustic worker 的多聲源正式 profile。新增 UI latency 門檻仍為 **PROPOSED**，首次 browser spike 後才可採納；若採納應併回正式預算表再於此索引。時間預算不是可任意相加的同一串 pipeline；main-thread 工作會競爭，worker 與 audio 又有各自 deadline。

| ID／範圍 | 權威時鐘與量測邊界 | 門檻來源／補充提案 | 超限處理與判讀 |
| --- | --- | --- | --- |
| `PERF-VIEW` Viewport Frame Rate | `requestAnimationFrame` timestamp 差、main render update CPU duration；GPU timing 若可用另外記錄，不以 rAF 差當純 GPU cost | 正式預算「3D 互動／UI」列；同報 frame interval 尾端分位、超過 frame deadline 比例與最高連續掉幀數，不能只報 FPS 平均 | 先停裝飾動態、降低顯示路徑／render resolution，保留顯示數／總數與降級標記；不更改 solver 結果或物理 dt 以美化 FPS |
| `PERF-MAIN` Main Thread Blocking | handler／transaction／DOM update 的 User Timing；支援時以 Long Tasks observer 補充 ≥50 ms task，另用 browser trace 查 layout／paint／GC | 正式預算「3D 互動／UI」自有 main-thread work 及「acoustic main-thread delivery」列；long task 次數與原因另外報告，初始化分開記錄 | 拆分有界工作、將幾何移出 main thread、批次讀寫 layout；Long Tasks API 不支援填 NOT AVAILABLE，再以 trace 量測，不能填零 |
| `PERF-PHYSICS` Physics Step Duration | 以 monotonic duration 包住一次 `world.step`；輸入／grab queries、contacts copy、recording 分項及總 fixed-tick cost 另計；logical tick 仍是 `tick * fixedDt` | 正式預算「physics」列及其指定 primitive／CCD／contact profile；另報總 fixed-tick、backlog 與 catch-up 次數，不能僅量 world.step 隱藏 bridge 成本 | 依既有四步 catch-up 契約；錄製／A/B 過載 pause 並保存 backlog，不漏 tick；非錄製探索模式才可明示丟 wall-time 並記事件；不調大 dt 偷換結果 |
| `PERF-SOLVER` Acoustic Solver Update Cost | worker 內 solve CPU duration；queue wait、snapshot age、序列化／傳輸及 publication latency 分開量；帶 scene revision／poseTick／job ID | 正式預算「acoustic worker」與「acoustic main-thread delivery」列；架構允許更新頻率範圍不代表通過該正式 profile，不另在 UI 規範放寬 solve duration | 取消被取代 job、有界 queue、保留最近有效 frame 並標 stale／age；只降低明示 capability 或更新頻率，不把舊 revision 當新資料；audio 不等待 worker |
| `PERF-AUDIO` Audio Processing Deadline | audio render quantum；`deadlineMs = actualFrames / actualSampleRate * 1000`。計算整條 render graph／所有 worklets 的總成本，連同 IR 雙 bank crossfade 最壞配置 | 正式預算「audio render」列適用其 benchmark 設定；其他 quantum／sample rate 另列配置且 max 必須小於實際 deadline，不放寬既有 benchmark 門檻。測試期間另外記 underrun／dropout，無量測不能稱無 glitch | 128 frames／48 kHz 僅是 2.667 ms 算例，不能硬編碼 128 或以 16.7 ms 代替。分離 continuous/contact voice pools；超額按穩定優先序有界降級並顯示 dropped voices。無可靠 aggregate timing／underrun 可見性則相應項 UNVERIFIED，不由畫面流暢或單一 callback 推論 PASS |
| `PERF-UI` UI Interaction Latency | 可重播 action ID 的 input-dispatch→已呈現視覺回饋；與 async 工作完成分開。瀏覽器 Event Timing／trace 支援程度與估計誤差需記錄 | selection、快捷鍵、Inspector commit、palette typing 的首個有效回饋 p95 ≤50 ms、p99 ≤100 ms；Run／async command 在同預算內顯示 pending，完成時間另報 | 不等待動畫結束才接受輸入；保留焦點與文字、允許取消；無 paint timestamp 時 rAF 前後標記只能標 proxy，不能稱實際 input-to-display latency |

50 ms 是 Long Tasks 的平台分類邊界，不是本專案允許所有操作阻塞 49 ms 的標準。rAF 呈現、DOM UI micro-interaction、固定物理 tick、acoustic update、audio sample clock、AI／網路 job 完成時間皆分離；AI job 只用非即時有界 timeout／取消與預算，不能驅動 audio deadline。UI latency 是量測指標，也不能當另一個物理時間軸。

音訊 timing telemetry 必須預先配置、有界、低干擾，批次在 callback 外讀取；callback 不 `await`、不 fetch、不作 geometry／physics、不寫每 block log、不配置無界陣列。若量測方法改變 thread 行為，先報 overhead／限制。用同 input 作離線 DSP correctness，再以實際 graph、設備與錄音檢查 deadline／連續性；兩種證據分開。source emission＋propagation delay 只排一次；不要把音效到達時間減去畫面動畫 duration 來「修正」同步。

## 複合工作與退化規則

必測同時抓取＋碰撞事件＋Inspector 開合＋路徑更新＋Raw/Simulated 交叉淡化；另測 IR 雙 bank、solver 超時、連續手勢中斷與開啟 AI palette。React 面板不可每個 physics tick 重建整棵 tree；UI 數字可降頻顯示，但保留其 poseTick 與量測原值。表格 virtualization 或 path culling 不可改 stable IDs、選取 identity、記錄事件或輸出資料。

先減裝飾與顯示工作，再依可見 budget 限制 voice／path；降級需有原因、計數、恢復條件與可匯出紀錄。錄製過載依 [RECORD_REPLAY](../07-experiments/RECORD_REPLAY.md) 暫停；恢復需明示，保持 logical tick、source offsets、pending arrivals 與 event cursor。Workspace 切換不 Reset，Mute 不停止求解，Paused 的 tail policy 依 [Workspace](WORKSPACE_ARCHITECTURE.md) 的 Freeze-and-fade。

## 結果與完成證據

報告至少填以下欄位；未實測值用 `null`／`NOT RUN`，不能用零偽裝測得零耗時。建議保存於 `benchmarks/results/` 的具日期檔案並由實驗 manifest 索引，latest 可另生成，不能覆寫首次證據。

```json
{
  "scenarioId": "desktop-60-grab-collision-panels",
  "status": "NOT RUN",
  "gitRevision": null,
  "dirtyPathsSha256": null,
  "environmentArtifact": null,
  "sceneSha256": null,
  "motionSha256": null,
  "sampleRateHz": null,
  "actualBlockFrames": null,
  "warmupSeconds": 10,
  "sampleSeconds": 600,
  "runs": 3,
  "metrics": [],
  "rawSamplesArtifact": null,
  "traceArtifact": null,
  "dropoutEvidence": null,
  "limitations": ["尚無正式產品 UI／audio graph"]
}
```

每個 metric 記 ID、量測方法、scope、count、unit、p50／p95／p99／max、threshold、exceedanceCount 及 PASS／FAIL／UNVERIFIED。一次測試可有部分 PASS；聲學 V1 或可見控制 PASS 不提升 V2／V4／V5。首次採納硬體門檻、改聲學品質或延遲政策時更新正式 PERFORMANCE_BUDGET、相關 ADR／設計決策與 Wiki 索引；本文件的提案不能單憑靜態 lint 升級為測得效能。

## 官方量測依據

以下查核於 2026-10-26，僅支持平台機制，數值預算由本專案提出：

- [AudioWorkletProcessor.process](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process)：從實際 sample arrays 取得 block 長度，不能假設固定大小。
- [PerformanceLongTaskTiming](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)：≥50 ms 分類與相容性限制。
- [Performance.measure](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure)：具名時間區間，可用於 worker；跨 thread duration 與 end-to-end age 仍需明確 epoch／message 關聯。
- [高效能 CSS 動畫](https://web.dev/articles/animations-guide)：優先考慮 `transform`／`opacity`，用 trace 查 layout／paint；`will-change` 需量測，不全域常駐。

完整互動壓力案例見 [UI_STRESS_TESTS](UI_STRESS_TESTS.md)；視覺 token 與 motion 的正式入口為 [DESIGN_SYSTEM](DESIGN_SYSTEM.md)。
