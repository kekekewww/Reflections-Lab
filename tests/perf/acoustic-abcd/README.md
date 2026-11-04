# 同一語料 acoustic A/B/C/D 比較

本工具服務 PERF-004/005 的有限比較，不代表正式 600 秒、原生音訊、產品全部驗收或採納。產品預設維持 uncached + clone；工具不修改 UI、paths、objects、caps、容差、SAB 或隔離 headers。

```powershell
node --import tsx tests/perf/acoustic-abcd/run-node.ts --out .cache/acoustic-abcd/node-fresh
node --import tsx --test --test-concurrency=1 tests/perf/acoustic-abcd/harness.test.ts
npx tsc --noEmit -p tests/perf/acoustic-abcd/tsconfig.json
node tests/browser/nonadvanced/acoustic-abcd/run.mjs --corpus .cache/acoustic-abcd/node-fresh/corpus/corpus.json --out .cache/acoustic-abcd/chrome-fresh
```

每個輸出目錄必須不存在；所有寫入限本 checkout。Node CLI 不 build、不安裝、不啟 server；15 分鐘總 deadline，worker 啟動 5 秒，service 原 5 秒 timeout。Chrome runner 只建立自己的 loopback Vite dev server（port 0）及 Chrome，絕不 build、呼叫 npm 或依附其他 server/browser；整輪 10 分鐘、導航 20 秒、cleanup 各 10 秒。可用實體 Chrome 安裝由 Playwright `channel: chrome` 選擇，不自行下載。

`corpus/corpus.json` 是有序 manifest；每筆 exact-graph JSON 與 trace 各有 SHA-256，`metadata.json`／`summary.json` 另 pin manifest。codec 保留負零、undefined 與完整 identities。語料以目前 `LabRuntime`、Rapier、behavior 跑 720 個固定 tick；直接取 V4 fixture 的 scene construction region，保持 105 objects / 100 dynamic / 5 fixed，8 paths、256 geometry、10000 segment tests 與所有 service caps。保留 V4 首 12 秒 controls：24 bodies impulses、grab/throw、monitor/workspace 操作，10 秒開始錄 1 秒。這是 virtual prefix，不冒稱原 RAF 排程或 600 秒。沒有虛構 request 或抽樣；攔截這段期間每次真正 requests() 呼叫（包含失敗及 capture batches）。audio disabled 是明示限制；UUID 在不同生成之間可能不同，四 arm 只重用同一份磁碟語料。

四配置為 A uncached clone、B cache clone、C uncached packet、D cache packet。每個 arm 每輪新 worker/cache，先獨立 warmup 同 corpus 前 8 筆，再 clear cache，依序重播全部 requests；4 輪順序 ABCD、BCDA、CDAB、DABC。未合併 event/capture、未採 latest-only、每次只 await 一批，沒有 replay backlog。每筆完整比較 builder DTO／錯誤、solver output／錯誤、path IDs、service validation；任一差異列在 raw 與 summary 並使 CLI exit 1。每筆 outcome 比較包括原始拒絕，不把拒絕忽略為成功。

成本以一次 requests() batch 為單位，raw 同時保存 sourceCount，避免把 batch 除以 source 數偽裝逐源數字。分開計 builder、encode、native postMessage 同步 bracket、worker receive/queue、decode、solve、return、service validation/delivery、bounded checksum consumer 及總 component age，彙整 nearest-rank p50/p95/p99。browser/Node 共用 product service、handler、decoder、solver；handler 的 optional observer 只在 benchmark 啟用。timestamp envelopes 在嚴格 product reply 外，不改 request/result fields。

receiveAndQueue 包含 clone serialization/queue/deserialization；queueAge 是 worker handler 開始減 main post 完成（同步送出與接收可能重疊，負數 clip 0）。沒有將其冒稱單獨 native copy 時間。JSON bytes 為 body representation（不含 envelope），不是 structured-clone wire bytes。Node `process.memoryUsage` 是逐批有正負的淨 heap/external/arrayBuffers/RSS delta，不是實際配置量或 peak；worker delta 在接收後到 reply 前，未涵 receive clone／reply serialization，RSS 是共用 process。Chrome 無可比 API，記 null；不以 JS heap 或 JSON reduction 冒充 native allocation。

`consumerChecksum` 只遍歷結果做 bounded checksum，不是 AudioEngine/UI consumer。音訊 disabled，因此真正 emission-to-onset、PCM／硬體 onset、live pose age、native consumer 都是 NOT MEASURED，不能憑 Node 採納或宣稱 AC-03 全部通過。事件身分與 emission 時間保存在 trace/corpus；負例沿用既有測試核對實際 admission。

四 arm 都是 object graph structured clone。compact packet 是去重 DTO，不含 transferable buffers。產品 transfer pool／detach／return criterion 對這四 arm 不適用，不能宣稱 zero-copy。`OwnedTransferProbe` 是獨立且明示 test-only 的實體 worker_threads 診斷：只送自有副本、一批、2 MiB cap，測 detach、return、busy、crash、cancel、舊 generation／duplicate return、重用；其結果不作四 arm 的成本或產品 pool 證據。

負例證據對照（需當次執行，檔案存在不等 PASS）：

| 邊界                                                                                   | 測試                                                                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 完整 V4 四 arm、raw timing、oracle substitution、SHA mismatch                          | `harness.test.ts`                                                                                                       |
| clone/packet identity、timeout、cancel、crash、fallback、原 caps                       | `tests/app/acoustic-service.test.ts`, `acoustic-compact-service.test.ts`, `acoustic-transport.test.ts`                  |
| stale geometry、同 revision pose/material/role/source membership、cache generation/LRU | `tests/app/acoustic-geometry-cache.test.ts`, `acoustic-component-scenarios.test.ts`, `acoustic-input-ownership.test.ts` |
| run/epoch/revision/dispose/source removal、pending dedupe、原 emission 時間            | `tests/app/acoustic-latest-pending.test.ts`；run reset 邊界由新 harness 負例另核                                        |
| capture 不用 latest-only、逐 tick/event 保存                                           | 新 harness 負例、720 tick 實際 corpus 與 captureRows                                                                    |
| 實體 worker lifecycle 與 exit ownership                                                | `tests/app/acoustic-node-worker.test.ts`                                                                                |
| 自有 buffer transfer 診斷，非產品候選                                                  | 新 harness transfer tests                                                                                               |

`sourcePins` 記所有 src、sound schema、被使用的 benchmark utilities、harness、browser fixture、V4 與 lockfile；這是 imported source closure 的超集合。Chrome 在啟動前逐一核對 pins，拒絕 changed source／corpus；不得把更新後來源套在舊 corpus/oracle 上。raw、失敗、早期 attempt 保留，不覆寫。
