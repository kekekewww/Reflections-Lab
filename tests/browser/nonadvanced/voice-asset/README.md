# PERF-006／007 同條件比較

這是測試 Harness，不改產品預設、UI、容量或驗收。Node 的 FakeAudioContext 只證排程、控制圖、來源 cursor 模型與引用所有權；不能宣稱原生 DSP、硬體 onset、聽感、GC 或程序 RAM 已通過。原 PERF task 的狀態與 criteria 由 Claude 依證據另行維護。

## Node 執行

從此工作樹根目錄執行，不需 `npm ci`、build、server 或 browser：

```text
node --import tsx tests/browser/nonadvanced/voice-asset/run-node.ts
node tests/browser/nonadvanced/voice-asset/run-checks.mjs
```

每次建立新的 `.cache/voice-asset/node-<UTC>-<uuid>/` 或 `checks-.../`，不覆蓋舊 FAIL。Node comparison 有 120 秒總期限。`summary.json`／`summary.txt`、原始 voice／asset JSON、兩次真 runtime corpus、fixture 檔案與 SHA-256、來源前後 pins 皆保留；差異或來源漂移回傳非零。checks 記錄實際子程序 exit／signal、時間及 stdout／stderr hash。

`LabRuntime` 使用真 Rapier、原 behavior evaluator、原 recorder 和 solver；固定 run／epoch，逐固定步保存 engine 實際收到的 start／update／frame／stop。reference 與 candidate 各錄一次，比對所有 physics events、behavior decisions、audio events、voice intents 及錄製決策；再把同一份凍結 corpus 分別送入兩個 engine。

正式 engine capacity 不減少：24 rendered、32 sources、32 paths/voice、256 total paths、256 pending、64 MiB decoded、2 concurrent decode；其餘沿用 DEFAULT_AUDIO_BUDGET。原 runtime behavior cap=16 與 engine render cap=24 是不同層。本 corpus 用 15 continuous emitters 加真 ball impact，沒有為湊 24 改產品 logical admission。

另以真 intent／solver route 的明示重綁副本做容量負例：24 rendered 加 32 virtual waiting、重複 start、priority hysteresis、residence、fairness、pitch 分段積分獨立 oracle、pause/resume、tail/drain/dispose、256 internal arrivals 與溢位。這些副本不是新增的 physics 或錄製決策。超過 reference render cap 的 native admission 允許明示不同；不能把 candidate 多接受 virtual 視為原 logical admission 改善，也不要求 reference 拒絕的 voice 有不存在的 reference native cursor。

## 素材與政策

倉庫刻意沒有外部音效檔。使用者已確認允許把 `tests/app/asset-residency.test.ts::wave` 原 PCM16 演算法物化為四個一秒 WAV：44.1k／48k × mono／stereo。新測試會執行原 generator 與物化器比對 bytes。`fixtures.json` 記錄原 generator path/hash、參數、rate、channels、frames、file hash 及權利來源，標示 **Synthetic (project-authored test fixture), not a licensed external sample**。不推定外部素材授權，也未替專案選擇根 LICENSE。

reference 只保留 resident；candidate 在相同 pressure 操作呼叫既有 host/store LRU eviction。兩邊載入相同持久 bytes、hash/revision/rights refs，使用相同 BlobStore memory backend 及 caps。使用真 engine 的 active／retiring／future pending／paused ownership 與 recording scoped lease，驗證保護後再釋放。之後相同 reload 請求在 reference 為 warm、candidate 為 cold；這是政策造成的可觀察差別。

兩邊都重建 cold host 測 cancel、decode failure 與 recovery，避免 warm hit 跳過負例。cancel 保留 native job 的 reservation 到 settle。quota probe 用相同明示有限測試 store，保留原有效 bytes。另以 AudioAssetStore 同時啟兩個實際 decoder，第三個要求必須被原 concurrency cap 拒絕。highWater 為已知引用、reservation 與 staging accounting；host／engine 可能共用 PCM，不相加成 RAM。native scratch、GC freed、process RAM 一律 unknown/null。

## Claude 的原生 browser 執行入口（本次 Codex 不執行）

```text
node tests/browser/nonadvanced/voice-asset/run-browser.mjs --input .cache/voice-asset/node-<passing-run>
```

若使用既有 Chrome，可另加 `--executable "C:/Program Files/Google/Chrome/Application/chrome.exe"`。runner 記錄實際版本與 executable hash，不下載 browser，不附接使用者 profile，也不使用既存 server。

runner 先核對 Node PASS、全部 source pins、corpus／fixture artifact hash，再開自己擁有的 Vite loopback ephemeral port 與單一 Playwright BrowserServer。只物化 fixture 所需 entry，data route 使用 invocation nonce 與檔名 allowlist。render/decode 60 秒、整體 120 秒；finally 有界關閉 context/browser/BrowserServer/Vite，失敗保留 raw 與 cleanup 診斷，watchdog 只終止自己擁有的 browser。

原生項目包括：

- 同一 Node runtime corpus，兩政策在 48k native OfflineAudioContext 逐 quantum checkpoint 執行；全長雙聲道 dry PCM、onset 與每 tick window 比較。checkpoint 量化前後時間分開保存。
- 24 rendered 原容量，四 oscillator 波形與既有 `AudioAssetStore` builtin-tone sample loop（原生 PCM hash／rate／channels／revision 另記）的真正 demotion／virtual pitch update／promotion。sample offset=0.125秒，只計一次；此相位 fixture 用既有非恆定 sine PCM，與 residency 的四個物化 PCM16 WAV 分開。相同 start/update/stop；reference 明示拒絕第 25 個 native voice、candidate 保持 carrier。reference 有獨立固定 20ms output mask，對應預期 gate 轉換；candidate 沒有額外聲源 tap 來維持 phase。整段 PCM 包含 gate 的第一個 sample，不忽略 prefix。
- 相同素材序列以真正 native decode 核對四種 rate/channel 原 PCM、cold/warm/cancel/failure 與 accounting。BlobStore 仍為明示 memory backend；不冒 IDB transaction／device latency 證據。
- browser 輸出 raw `.f32`，Node 以獨立 DataView loop 重新讀取每個 sample；固定 `2e-6`、onset 差 0 samples、非有限值 0、不得截斷或空檔。負例含首 sample、onset、NaN、空檔與長度不符。

這些是內容 phase/onset 與生命期分項；不證完整 HRTF／IR history、硬體聲音、600 秒正式效能或整體第一版完成。沒有同負載原生收益和必要 PCM 證據時，維持 reference/off 與目前 asset store 預設。
