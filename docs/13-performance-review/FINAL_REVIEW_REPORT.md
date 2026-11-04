# 最終效能與緩衝架構審查報告

日期：2026-11-01（Asia/Taipei）。狀態：**研究交付完成；文件限定Patch，目標dirty未合併**。執行者：Codex；模型ID未提供可核實值。已提交產品基準`05d40fd2d52f4b737f6acac61fa00356403c0038`；研究分支`review/performance-buffer-20261101`。所有結果只適用指定版本／環境，完整V1仍未完成。

## 1. 結論與交付

本輪完成的是獨立研究與可供後續採納的工程規劃，沒有產品優化實作。主緒逐tick錄製求解、live Worker與控制消費邊界、native graph生命期及多時鐘語意已有可追溯盤點；使用者音訊斷續的單一根因仍未確診。源發聲、排程offset與傳播delay分開；現有single-inflight、FIRcache、stable routes、dual banks及asset store保留為已存在的能力。

[摘要](EXECUTIVE_SUMMARY.md)串接全部14份指定領域／綜合文件；另有[研究契約](REVIEW_CONTRACT.md)、[量測計畫](MEASUREMENT_PLAN.md)、7份`proposals/ADR-PERF-01..07`及完整英文對照。18項風險與14項P0–P3未來任務見[Risk Register](RISK_REGISTER.md)與[Roadmap](OPTIMIZATION_ROADMAP.md)。未來任務全部BACKLOG、owner=null、42條criteria=false；七份ADR全部PROPOSED，不改Accepted ADR或正式MVP。

## 2. 本輪實際量測

本機：Windows10.0.26200、i9-13980HX／32logical CPUs、reported RAM約31.63GiB，Chrome156.0.8078.75、Node22.17.0／npm11.4.2。GPU清冊列RTX4070Laptop等裝置，不把清冊自動當裝置聽測證據；powercfg原文有編碼限制。原fixture配置1920×1080／DPR1、UI100Dynamic／105objects、physics256bodies／64CCD；native graph muted，actual rate48000Hz。這些是本機instrumented指定負載，不能代替使用者Brave／輕場景。[窗口／tail補充](evidence/window-tail-supplement.json)。

命令、環境、hash、原始資料位置與所有判定以[研究量測收據](evidence/measurement-summary.json)為準；本輪取得的raw資料、短測trace、bundle與研究prototype保留在隔離Worktree忽略的`.cache/performance-review/measurement/`，沒有提交。原入口與研究副本是兩條不同資格路徑。

正式登錄的收據採v2（SHA256 ee538ee2af989b9e2e8eb86af80b3c6068ff61e56a6a3aee51c5ed2e2e7e25dc）；[原v1](evidence/measurement-summary-v1.json)保留。v2僅移除誤套在smoke的冗餘「無trace」衍生標籤，沒有更改原smoke trace、長測失敗、metrics或raw。

| 步驟／Claim | 實際結果與界線 |
|---|---|
| 原鎖版入口 | 未改`run-performance-v3.mjs --formal-600`；目前Chrome hash不符原pin，以exit1及`V3_UNSUPPORTED_NATIVE_LAUNCHER_SHA256`拒絕；沒有正式負載量測或資格升格 |
| 研究adapter | 5個import位置、launcher hash、native producer revision及明示research metadata，共8項限定差異；fixture、load、threshold、membership、caps、timeout及cleanup不變；外層永遠RESEARCH_ONLY／NOT_APPROVED |
| all20秒短測 | exit0；收集／native wiring可判讀，多項性能及持續負載仍失敗；不是正式600秒通過，也不是R21最後bytes的重測 |
| PERF-MEASURE-600-001 | 唯一一次同負載研究長測；UI原始視窗600415.2ms；程序wall1026636.133ms、exit1，原180秒`CDP_TRACE_FLUSH_TIMEOUT`；沒有重跑或延長期限 |
| PERF-MEASURE-600-002 | 3000筆physics native step p95約8.2ms，對原2ms數值目標FAIL；這不是使用者輕負載場景或其裝置實測 |
| PERF-MEASURE-600-003 | productDefault600筆worker p95約40.9ms／receive-through-native-consumers約13.8ms，原20／1ms目標FAIL；20Hz持續窗口不成立 |
| PERF-MEASURE-600-004 | stress256600筆worker p95約15.1ms仍UNVERIFIED，因要求paths／無容量損失負載不成立；delivery約23.5ms FAIL。低於單一compute門檻不能升格整體PASS |
| PERF-MEASURE-600-005 | raw記錄8294frames、2161overruns、1120paused advances與19705個固定tick、約328.4167個simulation seconds與約242.6667秒interactive droppedwall time；3次capture各8／4／4frames，均受debt暫停。600秒wall視窗不是600秒連續模擬或錄製 |
| 原生trace／主緒occupancy | trace未完成，沒有native trace analysis；CLOSED_WINDOW_UNVERIFIED，主緒wall occupancy及完整原生600秒資格維持UNVERIFIED，不引用短測數字補缺 |

收集後browser／preview已清理、cleanup errors=0，沒有outer timeout或output cap。窗末pending=false與窗外tail分開保存，沒有以tail回填capture。Audio lateEvents／drop counters為引擎累積snapshot，不能直接當600秒增量；未由本輪收集actual output underrun／Worklet callback deadline、硬體latency、PCM Click完整性或真人聽感。

Trace排空失敗跳過runner正常最後source／bundle／executable stability欄位；這些欄位缺失，不改寫為true。獨立review另於收集後核對237個build inputs、13個工作bundle與13個封存bundle檔案，均與manifest相符；UI raw與tail hashes亦吻合。這是獨立POST-RUN端點觀察，不補造原runner檢查或整段持續完整性保證。

新profile與R17的code/browser不同，且只有一次研究長測及不完整trace，不能直接宣稱改善或退化。R17原失敗照原文保留；R21早期／regression repair／最後dirty來源分期，最後修補效果仍需受控重測。

## 3. 來源、提案與持久知識

[附屬Claim Ledger](evidence/claims.json)固定39筆來源、15項基礎Claim及版本／環境／限制；[來源索引](evidence/research-index.json)固定研究階段文件hash與引用。官方文件支持API／模式，不是本產品或裝置性能證明；新數值收據使用PERF-MEASURE-600系列，保留原metric ID與判定。

本輪採用一項有紀錄的provenance調整：既有DONE Task0021固定全域`research/EVIDENCE_LEDGER.json` hash，因此保留該檔原樣，以現有Wiki source ingest登錄附屬Ledger，而不使舊證據失效。附屬資料不取代無關Accepted／科學主張，也不建立第二套任務系統。14個正式Backlog JSON沿用既有schema；新檔exclusive建立、CLI序列處理source／events／索引／handoff。

獨立審查核對主要程式邊界、來源、資料所有權、pose-aware cache、resume epoch、英文重要條件、adapter差異及量測限制。修正包括：移動幾何不能只按sceneRevision快取；AudioContext重錨與take runEpoch分離；不假設solver未飽和；014啟動時凍結有限候選清單；分項靜態審查與本輪研究量測分開。這些是研究文字修正。

## 4. 驗證與整合

[驗證收據](evidence/validation.json)列實際命令／exit／scope；[範圍檢查](evidence/scope-audit.json)列完整tracked／untracked變更、受保護diff、任務及提案狀態。英文有完整來源hash及currentness；檔案／索引檢查與獨立語義審查分開，不宣稱所有外部URL／任意秘密格式或全部科學推論均由工具證明。

[文件整合報告](INTEGRATION_REPORT.md)記錄baseline、latest target、reviewed payload SHA、merge-base、全部新增／變更檔案與Patch。整合前重新取得目標分支與dirty狀態；原區及R21內容不覆寫，不stash或reset。目標不乾淨時保留研究分支並產生本機文件Patch，不執行merge、push或部署。

Public API／types／Scene與Recording契約、runtime/build/dependency、正式tests／benchmarks、驗收／性能門檻、AGENTS及既有產品task的criteria／結果均保持不變。本輪不新增正式測試、Worklet、worker lane、renderer、cache、cloud服務或Meta付費請求。


基準文件連結需要4份既有忽略歷史JSON收據；本輪由原區read-only複製原始bytes至隔離test-results，記錄hash並核對其中2個歷史manifest pins。它們不是新測試／新PASS，沒有提交；fresh clone可能仍需歷史封存。見[複製收據](evidence/historical-link-copy.json)。

## 5. 限制與下一步

1. 先做001／014的來源與裝置／output歸因，再按證據安排002錄製熱路徑及003automation候選；不因研究結案自動啟動。
2. CDP flush失敗的原因沒有確診；未取得trace的主緒結論、GC／nativeDSP成本及output連續性保持缺口，應以有界診斷研究後再安排新的量測任務。
3. 記憶體512MiB研究envelope、SAB／Worklet／Physics Worker／雲端／增量offline等是提案，收益、跨browser及裝置條件另驗；聲學品質與互動latency不能以降負載掩蓋。
4. 未量的聲學／真人／裝置、根LICENSE、帳號／條款與完整V1條件維持原限制。沒有以研究、metadata或程序exit0宣告產品完成。

初次提交未因4處CR-at-EOL檢查而停止；[更正紀錄](evidence/newline-correction.json)保留失敗／前版、純LF修正、來源新版本及Backlog未啟動狀態。預設Git空白檢查其後通過，未改寫歷史、門檻或量測結果。
