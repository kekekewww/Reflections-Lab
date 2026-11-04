# 單次 bootstrap 計時事件的固定產生端語意

狀態為 SOURCE_AND_EXISTING_RAW_REVIEW_ONLY。核對 Chromium 861389936bf33ea77529ee5dcc0605e68f6bb620／其 DEPS 固定的 Perfetto 403906f4adfbf287a02e5546f8430dcc9d56b649；沒有新跑 Node、測試、browser、build 或 600 秒量測，也未修改原固定來源或原 FAIL。

本次 attempt02 的既有關閉計時器可直接確認欄位：原始 ordinal2316 是 TimerInstall，devtools.timeline、I／s:t，data 為 timerId=1、frame、timeout=0、singleShot=true。ordinal2330 是 TimerFire，X／dur=5582us，data 只有 timerId 與 frame；外層 ordinal2329 的完整 ThreadControllerImpl::RunTask 起於954578569us、dur=5591us。這些是既有 close timer，不能冒稱新 bootstrap 已跑通。

[DOMTimer 產生端](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/core/scheduler/dom_timer.cc#361) 於排程後送出 Install，並以 scoped Fire 包住觸發生命週期。零 timeout 在未觸發 nesting clamp 時選 immediate timer task；它表示要求的逾時，不表示實際排程延遲為 0。實際延遲仍要以 callback entry 減 request time 分欄量測。

[Timer data 產生端](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/core/inspector/inspector_trace_events.cc#988) 寫入 timerId；只有 LocalFrame 存在時才寫 frame。Install 另外寫 timeout.InMillisecondsF() 與 singleShot。此 Window fixture 應要求正確 frame；timer payload 沒有 navigationId，不可要求不存在的欄位。Timer ID 屬於 execution context，不能借用其他 frame 剛好相同的 ID。

同檔130–147行的 SetCallStack 只有在 disabled-by-default-devtools.timeline.stack 啟用時才增加 sampleTraceId 與可能的 stackTrace。現有固定 includedCategories 完整五項為 devtools.timeline、blink.user_timing、toplevel、v8、disabled-by-default-devtools.timeline.frame；未啟用 disabled-by-default-devtools.timeline.stack。因此目前精確四個 Install data 欄位有明確條件；若未來換 category，應另版，而不是接受任意額外欄位。

[UserTiming 產生端](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/core/timing/performance_user_timing.cc#87) 將 physical callTime 與要求的 startTime 分開保存；[TimeTicks trace 轉換](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/trace_event/traced_value_support.h#128) 證實 callTime 為微秒，startTime 則為 performance clock 的毫秒。Window mark 的 [navigationId 來自 LoaderId](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/renderer/core/timing/performance_timing.cc#314)。mark tracing 也可能採 V8 sample，成本不能當成零。

新 bootstrap 的驗證應要求唯一 owned Install→完整 Fire→兩個輔助 mark，實際 timer handle、pid／tid、frame 與 loader identity 均一致。mark 的 physical callTime 須在 Fire 內，Fire 須在原 V3 已接受的完整 native RunTask 與原時間窗內。不能用輔助 mark 或 TimerFire 合成 RunTask；沒有完整 task、延遲超過原50ms、錯誤 owner／category／navigation、重複或未完成事件，一律拒收。

輔助 mark 必須避開 rlab-v3.observe 前綴。單次真 task 可以在保留原 begin／end 的情況下驗證原 edge coverage，但不代表回補 resume task 的遺失 CPU，也不能證明整個窗內沒有其他遺漏。完整程式 SHA256、行號、取得狀態與原始事件見同名 JSON；官方全文未複製入庫。
