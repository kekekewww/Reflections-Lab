# Acoustic component benchmark

這是 `PERF-V1-004/005` 的 Node component 比較工具，產品 cache／packet 仍須顯式 opt-in。工具存在、單元通過或 packet JSON 較小都不是產品採納證明。

`fixture.ts` 讀取原 formal UI fixture 的有限 scene construction region，保留 105 objects（100 dynamic／5 fixed）、材質、roles 與原 budget `maxPaths=8 / maxSurfaces=256 / maxSegmentTests=10000`。未移除曲面或 emitter self-exclusion；初始 speaker 是 24 faces＋67 analytic primitives＋33 OBBs，dynamic emitter 通常少自身一件。builder 的 16 sources 與 service 的 32 sources／256 paths 上限不調整；原拒絕逐列保留。

`capture.ts` 可在 Root 凍結來源後，載入 Root 實際 `LabRuntime` 產生一次真 physics／behavior 的有限固定步 prefix。10 秒 warmup＋12 秒 prefix 保留原控制公式、busy gate、action sequence 與 formal600 的第一個 10 秒錄製窗口；捕捉時暫停 instance 的 live preview 自動排程，在計時外手動取原 requests。dispatch 序列化、audio disabled、固定虛擬步進，與原 RAF 並行調度不同；它不是 formal600 trace，更不是模擬時間效能結果。成功錄製 sealed artifact、至少 1000ms 控制窗口、accepted Grab／Throw、非空 physics／audio events與完整 request oracle都是發布 corpus 的必要條件。失敗留下 exact partial，不發布可比較結果。

browser-safe `corpus.ts` 另可在原 browser fixture 使用 sidecar，逐列比對原 request 結果及未改寫的發聲事件。未在本工作樹執行 browser capture，也未改 Root runtime／正式 fixture。

比較固定四種配置：A uncached＋clone、B cached＋clone、C uncached＋packet、D cached＋packet。每次 fresh Node invocation 都讀相同 exact corpus；完整 uncached requests／solutions 在所有目標計時外預先產生並凍結。逐列驗證所有 identity、path 順序、vertices、band gains、delays、diagnostics、signed zero與原拒絕，無新增容差。每配置有 fresh worker／cache、四列未更動原負載 warmup、一趟 frozen replay；每個 worker 等 native exit，失敗拒絕比較。packet 選擇成本、guard、encoder成本均保留在 service 成本內。

CLI 追加 12 個 `invalidation.*` 邊界：cold clear、相同 pose reuse、同 revision pose／orientation、material binding／content、role、revision、topology、dimensions、namespace、epoch clear與 restore。它們保留全部 bodies／caps，但明標 synthetic，不能當原 motion trace 速度證明。

目前 capture CLI 尚未執行。五檔32個專屬單元測試已通過，型別窄修與格式化後的自有 lint／typecheck 也通過；分次來源及限制見 `docs/16-nonadvanced-completion/lanes/acoustic/COMPONENT_QUALITY_20261103.md`。歷史來源 checkpoint 與原始測試仍保留。

以下列出來源驗證命令，以及待 Root 最新來源凍結後才執行的 capture／run 範例；後兩項尚未執行：

```powershell
node --import tsx --test --test-concurrency=1 tests/app/acoustic-component-benchmark.test.ts tests/app/acoustic-component-driver.test.ts tests/app/acoustic-component-scenarios.test.ts tests/app/acoustic-corpus-codec.test.ts tests/app/acoustic-node-worker.test.ts
node node_modules/typescript/bin/tsc --project benchmarks/acoustic-transport/tsconfig.json --noEmit
node --import tsx benchmarks/acoustic-transport/run.ts capture --runtime-root 'D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/integration' --out .cache/nonadvanced-acoustic/component/capture-01
node --import tsx benchmarks/acoustic-transport/run.ts run --corpus ABSOLUTE_CORPUS_FILE --run-id r1 --order ABCD --out .cache/nonadvanced-acoustic/component/r1
```

PowerShell 實際執行 capture 時應將含空格的 runtime-root 完整以單引號包住。輸出需全新目錄；工具不覆寫歷史失敗。後續至少五個 fresh Node process，順序固定 `ABCD / BCDA / CDAB / DABC / ADCB`，單 process 逐一跑，同一 pinned corpus，保留全部 raw及實際順序。先核每個配置 warmup／accepted／rejected／source counts／actual transport／full oracles／physical exits，再比較相同 row及 callScope 的 builder／service／encode／Node post／worker compute／delivery／checksum／component age 分布。明列每次 run及中位數、p95，不將拒絕的較快返回當收益；`invalidation.*` 獨立呈現。原始 default-live 與 explicit-event-batch 分組；後者只量 DTO 經 AcousticService，不代表 Root RecordingEvaluationClient capture pipeline。普通共享機器須明標，不能冒稱 hardware isolation。

`requestBodyJSONBytes` 是 requests-array／packet 的 UTF-8 JSON body（不含 `{batchId, requests|packet}` envelope），不是 native wire bytes。獨立 untimed copy probe只數實際 main-thread `structuredClone` 呼叫及輸入圖的容器／numeric values／JSON representation bytes，不包含 V8／worker內部 copies，也不是 VM allocated bytes。Node post bracket不是 browser dispatch；checksum consumer不是 AudioEngine／UI consumer；live pose age、native onset、VM allocation及 formal600結果維持 null。量測後是否支援 Root opt-in仍須獨立判斷，default不自動切換。
