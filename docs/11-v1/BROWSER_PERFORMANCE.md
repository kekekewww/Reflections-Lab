# 瀏覽器效能量測

## R17 C4：完整600秒資料，性能與持續負載未通過

[實際收據](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/f84b1a3ece40bc2fda71efb459380829a42c37f1)對應產品Git `cde1e2b0ed7c57228bfa64b01c262b6eeab3cba1`，程序exit0且來源／bundle／執行檔一致。UI raw600051.100ms、19498frames；trace marker600051.182ms，5201280events，96816437bytes gzip，原生資格與collection membership通過、無記錄到trace loss。這只確認資料可判讀；原生證據的歷史`formalQualification: NOT_APPROVED`欄位保留，不改寫成性能批准。

Physics3000樣本負載有效，native step p95約4.8ms，原2ms目標FAIL。Default／stress worker p95約46.3／27.1ms；接收入口至實際native consumers的觀測delivery約12.4／28.7ms，原目標FAIL。此區間仍不包含browser pre-handler／OS派送及LabRuntime專有bookkeeping，完整delivery維持UNVERIFIED。Default／stress deadline misses130／226，stress measured path drops170；不以平均Hz或最大256paths宣稱持續負載通過。

UI renderer-main wall occupancy p95約83.23ms對原4ms目標FAIL，不能冒稱CPU時間。Raw含safe-overload暫停、106.117秒interactive dropped wall time、1222overruns、1653paused advances、暖機負載無效與最後capture未完成。結束時script／runtime／recorder均pending；`ui.finish-tail.raw.json`其後排空成功，原600視窗的pending與capture判定保持失敗。前兩份錄製分別7／8個連續frames，未丟錄製tick，也不冒充連續60Hz。

負面量測證據與預算PASS分開；原始目標、負載與方法均保留。音訊為muted native graph，實際Worklet deadline／underrun／真人聽感仍未驗。原始資料、trace及各分項時鐘見同一artifact目錄。

## R16 維護入口與閉窗資料保存

目前維護入口為以下 V3 命令。每次必須指定新的輸出目錄；指定 Chrome 的版本與執行檔 hash 仍須通過 runner 原有資格檢查。

```powershell
$out = 'artifacts/v1/performance-v3-' + (Get-Date -Format yyyyMMdd-HHmmss)
node tests/browser/run-performance-v3.mjs --formal-600 --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe' --output $out
```

短測可使用 `--phase ui --seconds 20` 取代 `--formal-600`，只驗證資料收集及收尾，不代替 600 秒完整負載。原 V2 命令與既有失敗結果保留於下文，原驗收、負載、數值 kernel 與門檻不變。

R16 先關閉原量測視窗，保存 `ui.raw.json`、結束時的 `pendingAtEnd` 與原時間標記，再以共用最多 135 秒的期限排空。窗外動作、錄製完成與錯誤另存 `ui.finish-tail.raw.json`，不得回填原視窗。即使收尾失敗，仍有界嘗試保存 native trace；多項失敗的原因樹以有界格式保存，截斷會明示。原生 longtask attribution 在收集時先轉成可保存的 JSON；其餘 raw 仍使用原精度的 detached clone。

實際 [R16 UI 短測](../../artifacts/v1/r16-short-ui-repaired-20261029/native/verification.json) 保存了約 20 秒的 raw、tail 與 trace，來源及 bundle 穩定、清理無錯。狀態為 `MEASURED_WITH_INCOMPLETE_UI_WORKLOAD`：停頓、錄製超載、抓投與 capture 條件未完整成立，性能目標亦未通過。程序 exit 0 只表示本次收集流程完成，不能稱正式性能通過。

先前 [C2 正式長測](../../artifacts/v1/r15-formal-c2-20261028/native/verification.json) 的五秒排空失敗及 [R16 首次短測](../../artifacts/v1/r16-short-quiescence-20261029/native/verification.json) 的 native attribution clone 失敗均保留。前者沒有 UI raw／trace，後者保存 tail／trace 但沒有 UI raw；不重建不存在的原始資料。

## 2026-10-28正式結果：FAIL／負載不完整

[本輪operational summary](../../artifacts/v1/browser-performance-20261027T183039817Z/operational-summary.json)及[r10解讀](SESSION_PROGRESS_20261028-r10.md)已保存。實際628.935秒／31295frames，native／.NET exit0、1789來源前後一致、自有程序及5191清理均有證據；這些不表示性能通過。

- Physics負載有效，core p95 2.2ms對原小於2ms目標FAIL；完整tick含copies p95 12.5ms另列。
- Default／stress delivery p95 3.9／14.4ms對原小於1ms目標FAIL；default6／stress31 deadline misses，stress路徑254–256且measured drops95，20Hz與設定容量未完整維持。
- UI RAF p95 17ms、allRAF CPU p95 18.9ms未達原門檻；含safe-overload暫停、201overruns、14.483秒wall-time drop，不能稱連續600秒有效動態負載。
- Trace無CDP資料遺失，所有樣本ID／finite／in-window通過；106筆raw native RAF timestamp略大於raw callback performance.now()，原membership FALSE使main occupancy NOT RUN。沒有加epsilon、重bin或升格原結果。最後stop／persist47.885秒不歸因到未量出的CPU／I/O子項。
- 原正式首輪、smoke、所有失敗與新run原始資料保留；initial TARGET與整體結案政策分開，完整V1未完成。數值權威仍是[PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md)。

## 可重現入口與固定方法

以下命令與方法不保證通過；每次實際結果另存新artifact。


```powershell
node tests/browser/performance-profile.mjs --phase all --seconds 600
```

執行前需停止其他 browser／build／benchmark 重負載並固定來源。runner 建置自己的 `test-results/performance-dist`，使用 localhost 5191；不使用開發 HMR、不呼叫模型。每次輸出到獨立 `artifacts/v1/browser-performance-<UTC>`，保留建置 stdout/stderr、來源及 bundle hashes、硬體／實際 GPU／瀏覽器／viewport、raw samples、console/error 與壓縮 CDP trace。`--seconds 10` 只屬 smoke，不能通過 10 分鐘 gate；`--prepare` 只建置，不跑量測。

- Physics：256 primitives（1 Fixed、255 Dynamic），其中 64 個 CCD；固定 60 Hz，真 WASM 暖機 240 步後量測，每 30 步對全部 Dynamic 施加有界且可重播的微小 impulse 以維持喚醒。原生 Rapier `world.step` 與包含接觸複製／快照的完整 public step 分開記錄；每步 awake／contact pair／event 數保留，依實測分布判定負載。另驗四步 catch-up 與 dropped wall time。
- Worker：真 module Worker、8 個 source、32 個有限凸面（30 邊房間加地板與天花板），以絕對時鐘每 50ms serial 更新，七個 Synthetic 頻帶。只宣稱實際一階 capability。先量產品預設（每 voice 最多 8 paths／engine 預設總 cap），再量明示的 256 total paths／32 paths per voice 壓力配置。兩份結果分開；壓力配置不冒充產品預設容量。逐批記錄 worker CPU、往返、service handler、實際 native AudioEngine consumer、合計 delivery、成功後才記的 native start、admission、active paths／voices／context clock、drop 與 20Hz deadline miss。缺少完整指定負載時，相應 timing 不可宣稱 PASS。
- UI：正式 bootstrap／React／R3F／LabRuntime，100 Dynamic 加原房間及 speaker，1920×1080 CSS px／DPR1，暖機 10 秒。腳本透過 public runtime action 開關工作區、選取與 Raw/Simulated，透過 public PhysicsWorld API 施加有限 impulse、抓取及投擲；這是可重播量測輸入，不冒充使用者鍵鼠 E2E。在第 10、300、580 秒各錄製 1 秒 capture，涵蓋 early／mid／late state；限制整體儲存量於既定本機預算內，分開記同步 capture cost。短 smoke 只在第 1 秒錄製一次，不作正式 gate。
- 完整 600 秒 CDP trace 的 marker 所在 renderer-main RunTask wall spans 聯集，按 native RAF 間隔分割，涵蓋 React／layout／paint／GC。這是 main-thread wall occupancy 的保守上界，不是 thread CPU `tdur`。另保留 RAF callback、advance、getPose、插值與 bridge／capture 的分項；`fixedStep` 內部計時不冒稱包含後續 runtime bridge 的完整 tick。trace 有遺失、缺 marker、來源變更、不足 600 秒、樣本截斷、操作錯誤、運算中斷或抓投／capture 不完整時，完整 main-thread gate 不可 PASS。CDP 與方法 wrapper 有額外量測負擔，結果只適用此本機 instrumented setup。

實際 native Web Audio graph 維持 muted；sample rate／latency／voice/path/drop counts 使用原生 telemetry。沒有 actual Worklet render deadline／underrun、耳機聽測或 SPL 校準證據，對應項維持 **NOT RUN**。短時間微基準或 Native Node 圖存在不代表音訊 callback／硬體品質通過。
