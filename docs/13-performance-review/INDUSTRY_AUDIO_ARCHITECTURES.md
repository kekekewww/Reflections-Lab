# 業界音訊架構：預讀、即時期限與資源政策

狀態：原廠文件查證＋工程推論；存取日 2026-11-01。Reflection Lab 程式基線為 05d40fd2d52f4b737f6acac61fa00356403c0038。本頁只比較架構與提出研究方向，沒有更動產品、設定、測試或驗收，也沒有實測這些商用引擎。相關本地設計見[緩衝審查](BUFFER_ARCHITECTURE_REVIEW.md)。

## 比較框架

「buffer」至少有資產讀取、解碼 PCM、DSP 區塊適配、跨執行緒供料、控制／事件佇列、裝置輸出等不同意義。以下以原廠文件明示行為為 VERIFIED-DOCS；Reflection Lab 的採用條件均為 PROPOSED，不能由文件推導已達效能門檻。

| 系統 | 解決的主要問題 | 可以借用的觀念 | 不能直接移植的假設 |
| --- | --- | --- | --- |
| REAPER | 已知 timeline 的媒體與 FX 工作分配 | 可預知工作預先準備；live 與 offline 分開 | 未來互動／碰撞能提前知道 |
| Ableton Live | 監聽延遲與每個音訊期限 | 量測 critical path、峰值及來源 | 平均總 CPU 低就不會 dropout |
| FMOD | 遊戲資產供料、解碼與實體 mixing 預算 | 分開 buffer 類型、載入政策、voice 優先權 | 任意增加 read-ahead 都增加監聽延遲 |
| Wwise | voice 狀態、串流與 starvation 歸因 | 明訂虛擬化時間軸／回復成本 | virtual 等於零 CPU、零記憶體 |
| JUCE | 即時 callback 與執行緒資料交換 | 有界 SPSC、明確資料所有權 | FIFO 類別替應用持有 PCM 或支援多寫者 |
| Chrome／Web Audio | browser native graph、AudioWorklet 與觀測 | 先區分 native／custom 路徑與實際期限 | ring buffer 會增加同一 callback 的執行時間 |

## IND-01 — REAPER：可預知工作與 live input 的界線

原廠文件：REAPER 7.84／November 2026 將 media buffering、anticipative FX、live FX multiprocessing 分開；每軌可關閉 buffering／anticipation。Anticipative FX 可改善工作分配，但過度設定可能爆音。PDC 會利用既有媒體預讀對齊，live monitoring 仍受延遲影響。Render 提供 full-speed／1× offline／online／idle 選項；monitoring FX 不進入 renders。章節為 §6.14–6.15、§21.3、§22.6.2、§22.6.8，印刷頁 118–119、411–413、433、435。[IND-S01：官方 HTML User Guide](https://dlx.reaper.fm/userguide/html/)

工程推論：預讀資產或已固定 replay 有價值；不能提前求出未知碰撞或玩家輸入。Offline 可以使用較大工作批次，但 interactive 必須保留新的輸入可影響下一次合法更新的能力。PDC 的路徑對齊不能取消聲學 d/c，亦不能重複加入發聲延遲。

## IND-02 — Ableton：先識別延遲階段與 critical path

原廠文件：單一 buffer 階段時間為 frames/sample rate；端到端還包含 driver、裝置與 DSP。小 buffer 增加 callback 頻率及負擔；lookahead／convolution 等可另加演算法延遲。[IND-S02：How Latency Works](https://help.ableton.com/hc/en-us/articles/360010545559-How-Latency-Works)

Reduced Latency When Monitoring 略過其他路徑對齊的補償，不能移除 monitored path 本身的裝置延遲。[IND-S03：Monitoring FAQ](https://help.ableton.com/hc/en-us/articles/209072249-Reduced-Latency-When-Monitoring-FAQ) Direct monitoring 繞過 DAW 監聽路徑。[IND-S04：Reduce monitoring latency](https://help.ableton.com/hc/en-us/articles/360011924559-How-to-reduce-latency-while-monitoring)

Live 的 CPU meter 比較音訊計算時間與該 buffer 的播放時間；平均值可能掩蓋瞬間 overload。[IND-S05：Live’s CPU Meter](https://help.ableton.com/hc/en-us/articles/360019151379-Live-s-CPU-Meter) 可平行的獨立 signal-path segments 仍須在相依／匯合處等待；critical path 可在總 CPU 未滿時超期。[IND-S06：Multi-core FAQ](https://help.ableton.com/hc/en-us/articles/209067649-Multi-core-performance-in-Ableton-Live-FAQ) Crackle 也可能來自磁碟供料或其他軟體，官方建議同 project 漸進調整 buffer 比較。[IND-S07：Crackles and dropouts](https://help.ableton.com/hc/en-us/articles/209070329-How-to-avoid-crackles-and-audio-dropouts)

工程推論：把 solver 年齡、main-thread delivery、native render、裝置 latency 分開觀測；不以「多加 Worker」或 Task Manager 平均 CPU 取代期限證據。Direct-only reference 仍需真實 solver 結果及正確 medium／occlusion，不能用假直達線掩蓋等待。

## IND-03 — FMOD：mixer、read-ahead、decode 三種 buffer

原廠文件：DSP buffer 的 block size 與數量控制 mixer，較小值交換較低延遲與較高 overhead／underrun 風險；需在 initialization 前設定。[IND-S08：System DSP buffer](https://www.fmod.com/docs/2.04/api/core-api-system.html#system_setdspbuffersize)

Stream buffer 是檔案 read-ahead，與 decodebuffersize 的 PCM 解碼 buffer 分開；已預緩衝串流的 read-ahead 不直接增加播放 latency。[IND-S09：System stream buffer／decode buffer](https://www.fmod.com/docs/2.04/api/core-api-system.html#system_setstreambuffersize)

CREATESAMPLE 載入時完整解碼；CREATECOMPRESSEDSAMPLE 保留壓縮內容、播放時解碼；CREATESTREAM 漸進讀取及解碼，適合大資產且並發實例少的情境。[IND-S10：Loading and playing sounds](https://www.fmod.com/docs/2.04/api/loading-and-playing-sounds-in-the-core-api.html)

Logical channels 與實際混音 software channels 是不同預算；虛擬 voice 可持續 playhead，以 priority／audibility 決定實體 mixing。某些 hardware decoded stream 虛擬時仍保留 decoder。[IND-S11：Virtual voice system](https://www.fmod.com/docs/2.04/api/managing-resources-in-the-core-api.html#virtual-voice-system)

工程推論：Reflection Lab 已有 decoded asset bank；新增 streaming 必須由資產大小、命中率及尖峰解碼成本證明。Voice logical state、physical render、decoder、path 與尾音各自計費，不能以無聲等同資源釋放。

## IND-04 — Wwise：虛擬化是明確的時間政策

原廠文件：Wwise SDK 2025.1.12 的相對成本表如下；不是本產品的量測結果。[IND-S12：Understanding virtual voices](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=SDK&id=concept_virtualvoices.html)

| 回到實體 voice 的行為 | 相對 CPU | 相對記憶體 | 虛擬期間／回復特性 |
| --- | --- | --- | --- |
| Beginning | 中 | 低 | 不持續 service；flush buffer；重新開始 |
| Elapsed time | 高 | 低 | 每 buffer service；flush buffer；延續 logical time |
| Resume | 低 | 高 | 保留 buffer；暫停 playhead |

Virtual stream 不消耗 I/O；flush 後重新供料會延後可聽時間。Elapsed time 回復並非 sample accurate，可能失去同步。[IND-S13：Advanced settings](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=Help&id=advanced_settings_tab_actor_mixer_objects)

Voice starvation 指錯過下一輸出 buffer 期限，需追查 CPU／preemption／voice processing。[IND-S14：Voice starvation](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=Help&id=ErrorCode_VoiceStarving) Source starvation 指 disk stream 供料不足；Streams／Streaming Devices 能區分 throughput、prefetch、buffer memory 等原因。[IND-S15：Source starvation](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=Help&id=ErrorCode_StreamingSourceStarving) Performance Monitor／Advanced Profiler 用於時間序列與歸因。[IND-S16：Optimizing CPU](https://www.audiokinetic.com/en/public-library/2025.1.12_9287/?source=Help&id=optimizing_cpu)

工程推論：先定義 loop／one-shot 的「被省略後繼續／重啟／放棄」及 replay 一致性，才評估虛擬 voice。既有 voice priority rejection／stealing 不是完整 virtual timeline。不可為通過資源門檻靜默減少驗收負載或刪掉錄製事件。

## IND-05 — JUCE：SPSC 邏輯與資料所有權分開

原廠文件：AbstractFifo 管理 single-reader／single-writer 的索引及空間，不儲存資料；prepare／finished 或 scoped handle 發布實際寫入／讀取量。可用容量是設定大小減一，跨尾端可分成兩段；setTotalSize 不可與其他操作並行。[IND-S17：AbstractFifo](https://docs.juce.com/master/classjuce_1_1AbstractFifo.html)

AudioIODeviceCallback 在高優先音訊執行緒執行，輸入僅在 callback 內有效；輸出必須填滿，靜音需寫零，block size 不保證固定。[IND-S18：AudioIODeviceCallback](https://docs.juce.com/master/classjuce_1_1AudioIODeviceCallback.html)

工程推論：應用要另行持有預配置 PCM／metadata，確保寫完後才發布、讀完後才回收；多 producer 要先彙整或分開 queue。FIFO 文件容許一般執行緒重試，不代表 audio callback 可以等資料。Callback 不等待 Worker／鎖、網路、geometry 或無界配置，與本專案既有 AUDIO_RUNTIME 規範一致。

## IND-06 — Chrome／Web Audio：保留 native graph，按實際 quantum 設計

原廠文件：Chrome 2018 設計文章使用 128-frame 範例；ring 解決 kernel block mismatch，沒有延長同一 render callback 期限。Worker＋shared memory 可提前生產 PCM，但 AudioWorklet 不等待 Worker，缺資料仍可能 glitch。[IND-S19：Audio worklet design pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern)

2026-10-31 Web Audio 1.1 Editor’s Draft（revision 3e4bdbd0976d87b34877dd728a9ec0596d567830）提供 renderSizeHint；hint 可能不被採納。AudioParam 有 a-rate／k-rate，Worklet parameter array 可能只含一個常數值；依實際 channel length 處理。[IND-S20：Web Audio 1.1 ED](https://webaudio.github.io/web-audio-api/)

ChromeStatus 記載 configurable quantum 在 Chrome 153 shipping，頁面同時提醒近期未重查準確性。[IND-S21：Configurable render quantum](https://chromestatus.com/feature/5078190552907776) AudioPlaybackStats 在 146 shipping，提供 underrun count／duration 及 latency 統計；舊 playoutStats 為 deprecated alias。[IND-S22：Playback statistics](https://chromestatus.com/feature/5172818344148992) 這些是規格／vendor 記錄，不是本機 browser 支援測試；使用前需 feature-test 並報告缺值。

Tracing 可協助區分 callback miss、worklet 運算及 GC；2020 指南的介面與 thread 描述需按實際版本重查，不能當當前排程保證。[IND-S23：Profiling Web Audio](https://web.dev/articles/profiling-web-audio-apps-in-chrome)

工程推論：本基線由 native AudioNodes 做 source／gain／delay／convolution／HRTF；custom processor 註冊路徑在 src／server 搜尋未見。應先量 main-thread 控制與 native graph，只有證據顯示自訂 DSP／streaming 必要時才引入 PCM ring。AudioPlaybackStats 不足以定位是哪個 queue 造成問題。

## IND-07 — 對 Reflection Lab 的有條件結論

1. 優先執行[緩衝 D1–D8](BUFFER_ARCHITECTURE_REVIEW.md)的歸因與 contract 檢查；沒有「一個通用 buffer size」。
2. 延續現有 asset／FIR cache、voice／path cap、revision gate 與 bank reuse；補足 telemetry 後才新增 LRU、SAB 或 PCM transport。
3. Interactive freshness、離散事件的完整順序、recording losslessness 與 offline throughput 需要不同 backpressure。不可將最新值覆蓋套用到所有資料。
4. 新測量、配置比較、audible glitch／device latency 與長跑穩定性均 NOT RUN；本頁不宣告任何效能改善。

## 來源存取與版本界線

全部為官方網頁，僅索引、短摘要與連結；未重散布手冊全文或 SDK。未保存遠端完整 copy／內容 hash；日後內容可能變動。版本固定於已讀頁面，不宣稱為所有平台的最新安裝版本。

| 來源 ID | 已查版本／日期 | 存取結果與限制 |
| --- | --- | --- |
| IND-S01 | REAPER 7.84／November 2026 | 官方 HTML 可讀；最新 PDF 約 28.55 MB 超過 web fetch 大小限制，設定截圖未讀；不引用未核實 numeric defaults |
| IND-S02–07 | Ableton current KB；S02 All Live Versions；S05 說明 Live 11 起 | 正文可讀；多數未給固定 release，沒有執行 Live |
| IND-S08–11 | FMOD Engine User Manual 2.04 | 原廠 API／guide 可讀；沒有安裝或 benchmark |
| IND-S12–16 | Wwise public-library 2025.1.12_9287；SDK 2025.1.12 | 固定 URL 可讀；舊 edge／猜測 virtual_voice ID 為 404，未以錯誤頁支持聲明 |
| IND-S17–18 | JUCE master，2026-11-01 讀取 | 可讀；master 非固定 release／commit，重用需鎖版本 |
| IND-S19 | Chrome article updated 2018-06-18 | 歷史設計模式；舊固定 quantum／部署敘述不可當普遍現況 |
| IND-S20 | Web Audio 1.1 ED，2026-10-31，revision 如上 | 可讀；Editor’s Draft 與實作支援分開 |
| IND-S21–22 | ChromeStatus，2026-11-01 讀取；S22 updated 2026-07-23 | 記載 shipping milestone 153／146；不代表本機或非 Chromium 支援 |
| IND-S23 | web.dev updated 2020-05-04 | 可讀；歷史 profiling 介面需依已裝版本核實 |