# Process CPU 端點方法：來源與有限測試準備

本輪是 SOURCE_METHOD_AND_TESTS_AUTHORED_NOT_MEASURED。已建立新版純摘要器與有限負例，未查詢本機行程 CPU、未啟動瀏覽器／Node／測試／build。父代理已實跑初始缺功能 RED：75項中1個 missing-export FAIL、74個行為案例明確 SKIP；後續 GREEN、格式與真正量測由父代理執行，本報告不冒稱通過。

依實驗驗證與測試先行規範，正式600秒、原負載／門檻、原失敗與凍結來源不變。完整10項來源的固定 revision、URL、bytes、SHA、行號與研究時點見同名 JSON；僅保存本報告自己的改寫及來源身分，未將官方全文入庫。

## CPU 語義與零值陷阱

固定 Chromium revision 861389936bf33ea77529ee5dcc0605e68f6bb620 的 SystemInfo.getProcessInfo 回傳 processInfo 陣列，每筆有 id、type、cpuTime。cpuTime 是行程自啟動後、所有執行緒合計的累計秒數；多核心合計可高於經過的 wall time，不能將 ratio 限制為1。[官方 schema](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/third_party/blink/public/devtools_protocol/domains/SystemInfo.pdl#93)、[CPU API 契約](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/process/process_metrics.h#175)

重要限制是 handler 會用零 TimeDelta 代替失敗的 native CPU query，再輸出秒數，沒有附帶 validity flag。因此「累計端點0」可能是查詢失敗，不能標成觀測到 idle CPU。新版將這種端點記 UNVERIFIED，total／ratio 為 null；正累計值前後相同（例如3→3）才保留 API 解析度下的差值0，不宣稱硬體完全沒有工作。[固定 handler](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/content/browser/devtools/protocol/system_info_handler.cc#325)

Windows producer 可能使用 calibrated QueryProcessCycleTime／TSC，或退回 kernel＋user GetProcessTimes。本輪沒有探測這台機器所走分支或實際精度，不能用 source 預設推定量測成功。[Windows 實作](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/process/process_metrics_win.cc#183)

## 新版純摘要器契約

performance-process-cpu-v4.mjs 的 summarizeProcessCpuDeltaV4 只處理兩份原始 response 與 caller 實際量到的 monotonic wallMilliseconds／明確 scope。每端點最多1024個行程；整組 PID 必須唯一且前後 type 相同，CPU counter 需有效、非零、未重設。完整資料才合計 delta seconds，再除以實際 wall seconds。沒有固定600秒分母，也不濾掉壞值後用較小的 subtotal 冒完整 CPU。

新增／消失行程、type 改變、重複 PID、缺欄、非有限值、counter reset、零端點歧義、cap 超限與非有限衍生值都保留未知 total／ratio。正 counter 的實測零差值保0。nativeDspCpuMs、hardwareUnderruns 始終為 null；這不是 native DSP callback 或硬體 underrun 量測。

completeCoverage 只代表兩個端點集合已對帳。協定沒有 creation epoch、固定取樣週期或完整行程生命週期；同 PID/type 不能證明窗內沒有 PID reuse 或短命行程。序列讀取與傳輸也不是同一瞬間的全系統 snapshot。此方法不能稱 CPU lossless coverage。

真正 on/off 比較須用相同兩個 shared browser endpoints，位置在 trace setup 前及 collection 已關窗、tail／drain 之前，明列 Node monotonic 區間與 IPC／setup 邊界誤差；產品頂列正常15Hz取樣仍保留。off 不因此增加 page CDP trace、每回呼觀測或額外 diagnostics。這些接線仍須父代理 source freeze 與獨佔實跑，本輪沒有 probe overhead 數值。

既有 performance-audio-runner-v1.mjs 第48行的 cpuDifference 接受 finite 零 counter，且 partial coverage 時仍留下 matched subtotal。此處只揭露來源限制，不改舊 raw 或回填 PASS；舊 consumer 不得將 subtotal 當整體 CPU，未有 validity 證據的0也不能當真0。

## 後續 Windows owned-PID reader 的來源可行性

官方 .NET runtime v10.0.0 來源固定於 60629d14374c56f1cb51819049ad1fa529307f8d；這是參考實作，不代表本機安裝版本。對另一行程的 TotalProcessorTime，invalid handle／GetProcessTimes 失敗會拋例外，不會以假0回傳；native 呼叫本身有 BOOL、SetLastError 及 creation／kernel／user outputs。[Process.Windows](https://github.com/dotnet/runtime/blob/60629d14374c56f1cb51819049ad1fa529307f8d/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/Process.Windows.cs#L695)、[Interop](https://github.com/dotnet/runtime/blob/60629d14374c56f1cb51819049ad1fa529307f8d/src/libraries/Common/src/Interop/Windows/Kernel32/Interop.GetProcessTimes.cs#L11)

另有兩個限制：StartTime 在 Process 物件中快取，Refresh 不清該值，不能把同物件重讀當新 identity bracket；GetProcessById 的失敗路徑可能列舉全系統 PID，因此不能單靠 Get-Process -Id／GetProcessById 保證只讀 owned whitelist。[StartTime／Refresh](https://github.com/dotnet/runtime/blob/60629d14374c56f1cb51819049ad1fa529307f8d/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/Process.cs#L199)、[ProcessManager fallback](https://github.com/dotnet/runtime/blob/60629d14374c56f1cb51819049ad1fa529307f8d/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/ProcessManager.Windows.cs#L29)

後續另版候選宜只接受 CDP 已回傳的 owned PID/type 白名單，對每個 PID 直接 OpenProcess（QUERY_LIMITED_INFORMATION），在同 handle 單次 GetProcessTimes 同時取得 creation＋kernel＋user，最後 CloseHandle；前後 creation FILETIME 對帳，成功旗標／錯誤碼與 tick strings 分開。hidden helper、timeout、輸入輸出上限與原始值都要固定。此 reader 目前僅 SOURCE_PROPOSAL_NOT_IMPLEMENTED_NOT_RUN，不混入本輪 CDP 格式，也不代表硬體、聽感、DSP 或正式600秒通過。
