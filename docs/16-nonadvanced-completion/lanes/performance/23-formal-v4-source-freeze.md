# 正式 V4 方法來源凍結與 wiring 準備

新版方法已完成 source／有限測試準備：8 個新 spec 共 611／611 PASS（單工、6255.2786ms），格式與最後 lint exit0。尚未啟動本版 browser、Win32 CPU helper、PCM 或正式 600 秒量測。Root 長音檔硬體 lease 期間僅整理此文件及來源，不把 source readiness 宣稱成效能通過。

原 V2 exact bytes、V3 拒收、舊失敗、原數值核心、50ms coverage、trace／記憶體 cap 與凍結語義 44 個來源保持原樣。批准紀錄只授予 `semantic-v3-c59df8c64fdfa846d6e22daf` 對固定 Chrome executable／revision 的語義前置條件；它不證明這批新程式已原生執行，也不授自動 browser lease。

本版仍執行 UI 600 wall 秒、10 秒 warmup、100 dynamic、1920×1080／DPR1、10／300／580 秒各 1 秒 capture；physics 3000 samples 與原 256-body profile；兩個 acoustic profile 各 600 更新／20Hz、8 voices／32 surfaces／order1。default 8 paths per voice／64 target paths、stress 32 paths per voice／256 target paths，原 budget 全保留。18000 recorder frames／最多 300 秒錄製不冒成 600 秒 capture；tail 不回填閉窗資料。

前後比較使用同一最新產品來源及同一 Task0033 TopMonitor（Levels／master-left、正常 UI RAF／15Hz native analyser）。reference 省略新 policy，沿原 undefined 行為；candidate 只把經驗證的 DEFAULT resource policy 傳入 virtualization，原 content model 與 capacity 不改。這個 reference 不是歷史 e25 重新量測。兩層引擎分列：產品 primary 引擎的被動 TopMonitor cache，不能冒成獨立 solver stress 的 meter。

probe-off 保留全部原工作、正常產品 UI 與兩個共用控制／CPU 端點；關閉 benchmark wrappers、trace、額外 timer／observer，並關閉既有 diagnostics observer（會影響 footer nativeStats）。它只作 overhead 比較，不能成為正式資格。非量測欄位保持 null，不以空集合推 0。公開音訊 getter 是 ACTIVE 共用端點，不能標成被動／零成本。

CPU 只量 existing Browser CDP 給出的 PID 白名單。CDP 累計 0 可能是查詢失敗，保持 UNVERIFIED；Win32 helper 以固定檔案及有限 runner 執行，逐 PID 單一 handle／單次 GetProcessTimes 取 creation／kernel／user，驗成功旗並 finally CloseHandle。成功旗為真時的 0 才是真讀值。兩端使用 Node 實際時鐘 bracket、creation FILETIME 及來源／執行檔 hash；任何缺值、重設、集合或順序改變不報完整 total。before 在 trace start 前，after 在 closed-window RPC 後、任何 raw disk／tail 前，兩 arm 相同。這是 whole-process 端點成本，包含共用邊界成本與時窗不確定性；不是 callback／DSP CPU，也不證連續程序覆蓋。native DSP／hardware underrun 仍為 null。

資格結果要求原完整 gate inventory 及兩個正確 profile，缺 gate、錯身分、非 primitive boolean 都拒收。關閉時另做一次有界本機 5194 TCP probe；只有實際 ECONNREFUSED 才記 false，未知不當 PASS，不終止其他 listener。Win32 helper 自有程序未確認停止也不能釋放 lease。每份報告保留命令、raw、來源前後 hash、實際 execution／cleanup／qualification 分欄。

下一次僅在 Root 給定最終產品 SHA、正常 merge 並另授硬體 lease 後，執行一次完整 wiring。20 秒只指 UI collection；加原 physics、兩個 31 秒 worker profile、warmup、build／解析／cleanup，預估約 100–150 秒，原 short wrapper hard timeout 420 秒／native watchdog 260 秒保持。短跑的 actual600Seconds 必須 false，不能補成正式 PASS。

```powershell
node tests/browser/run-performance-v4.mjs --seconds 20 --phase all --physics-iterations 3000 --acoustic-iterations 600 --probe-mode on --qualification semantic-v3-c59df8c64fdfa846d6e22daf --top-monitor-mode levels --top-monitor-input master-left --audio-policy-arm reference --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe' --output 'artifacts/v1/perf-nonadvanced-20261103-v4-wiring-01'
```

正式命令仍需另行 Root GO；只把 UI 秒數改為 600 並加 `--formal`，保留 `--phase all`／3000／600 與上述同 mode／input／arm。candidate 與 probe-off 是獨立同負載 run、獨立 output，不將短跑、離線分析或語義前置證據冒為正式結果。`completeMainThreadDelivery` 仍明列尚未觀測完整 browser dispatch／LabRuntime 區間；有限 profile 結果不能推導 PERF014／DSP／聽測或整體第一版完成。
