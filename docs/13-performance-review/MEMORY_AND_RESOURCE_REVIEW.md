# 記憶體與執行資源審查

日期：2026-11-01（Asia/Taipei）。狀態：**研究／PROPOSED；本頁無新 RAM、GPU或功耗實測；CPU／效能研究收集另見[量測計畫](MEASUREMENT_PLAN.md)及[最終報告](FINAL_REVIEW_REPORT.md)**。固定程式基準 `05d40fd2d52f4b737f6acac61fa00356403c0038`。`MEM-*` 是本地研究／後續工作標籤。所有新數字均明列為現行 code limit、解析大小或研究假設；不更動[正式預算](../06-validation/PERFORMANCE_BUDGET.md)、[凍結驗收](../11-v1/ACCEPTANCE.md)及[補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)。

## MEM-01：先分辨資料上限與真正 working set

本案沒有證據可將「64 MiB trace」等同「只用64 MiB RAM」。同一內容可同時存在 canonical string、UTF-8 bytes、一般 JS objects、Worker structured clone、AudioBuffer、IndexedDB transaction copy 與 GPU/native graph。計算 byteLength 是資料會計，不是對瀏覽器記憶體的完整觀測。[Chrome 記憶體文件](https://developer.chrome.com/docs/devtools/memory-problems)區分 OS memory footprint 與 reachable JS heap，也指出安全記憶體數字依裝置／browser 而異。

| 類別／owner | 現況與需保留的會計邊界 | CODE 來源 |
| --- | --- | --- |
| Recorder／sealed artifact／A/B／replay | 18,000 frames／64 MiB canonical trace 不含全部 object overhead。append stringify／parse／freeze，seal 與 replay 各有 owned copies；同時存活時才相加。 | [recorder](../../src/experiments/recorder.ts) L29–34、L468–495、L588–617；[replay](../../src/experiments/replay.ts) L16；[replay-audio](../../src/app/replay-audio.ts) L52–56。 |
| Worker input／reply／prepared storage | input structured clone；reply transfer 之後 main owned copy／parse／freeze；prepared save 再 copy／hash／parse。舊 buffer 何時釋放要量。 | [worker client](../../src/experiments/recording-worker-client.ts) L100–121；[blob store](../../src/persistence/blob-store.ts) L464–519。 |
| Decoded assets | AudioEngine 預設64 MiB decoded PCM、2 concurrent decodes；硬上限可至256 MiB／4，不能把hard cap當預設。原始壓縮檔、staging decode 及 AudioBuffer 潛在重複另外計。 | [control](../../src/audio/control.ts) L3–16、L28–41；[asset host](../../src/app/asset-host.ts)。 |
| Voice／route／pending arrivals | 預設24 native voices、8 paths/voice、96 total paths、256 pending events；Behavior 邏輯 admission 是另一層。retiring paths／到達尾音也占資源。 | control L3–16；[engine](../../src/audio/engine.ts) 的 totalPaths／retiring／restore 邏輯。 |
| IR／filter banks | late bus 為兩個 mono IR banks，預設上限4 MiB；route filter／Panner native state 不在同一項。 | [late-reverb](../../src/audio/late-reverb.ts) L33–77；[routes](../../src/audio/routes.ts)。 |
| Local persistence | asset16 MiB、recording70 MiB、總blob128 MiB，是儲存資料預算，不是可用磁碟或heap保證；memory fallback 使資料留在RAM。 | blob store L15–21、capabilities／mode。 |
| Rapier／geometry／view | WASM linear memory、JS wrappers、physics snapshot、Three geometry/material/texture/render targets、driver allocations 分開。 | [physics-world](../../src/physics/physics-world.ts)、[viewport](../../src/ui/viewport)。 |

建議每項記 `ownerId, backingStoreId, logicalBytes, reservedCapacityBytes, retainedReferences, createdAt, releasedAt, stage`；同一 shared backing store 只算一次，transfer 只改 owner，copy 才增加一份。API合計可能重疊，不將 process footprint、page-memory estimate、JS heap 和各 ArrayBuffer bytes直接相加。release JS reference／disconnect node／dispose GPU resource 是不同動作，GC 時間也不由應用保證。

## MEM-02：可重算的解析大小與峰值模型

所有公式是 analytical accounting，**不是實測分配方式**。`Fs` 是實際 sample rate，`C` 是 channels，`T` 是包含明示 tail 的秒數；MiB＝2^20 bytes、MB＝10^6 bytes。

| 項目 | 公式／例子 | 限制 |
| --- | --- | --- |
| Float32 PCM | `4 × Fs × C × T`；48 kHz stereo 30s＝11,520,000 B（10.99 MiB），600s＝230,400,000 B（219.73 MiB）。 | 一份 PCM；每個實際獨立 stem／output 各算，preroll／state另計。 |
| PCM16 WAV | `2 × Fs × C × T + headerBytes`；若同持一份float PCM，兩者至少 `6 × Fs × C × T + headerBytes`。600s stereo 約329.59 MiB（未含header）。 | 假設無壓縮PCM16；不是已存在的產品 exporter。 |
| Mono IR兩banks | `2 × 4 × Fs × T_IR`；48 kHz／4s＝1,536,000 B（1.46 MiB）。 | 只是IR samples；convolution partition／FFT/native overhead另計，不能當完整4 MiB budget已量。 |
| Route filter samples | `N_routes × N_liveBanks × C_filter × taps × 4`。 | 要含交叉淡化／retiring banks；實際taps與native copy由版本量測。 |
| Delay capacity假設 | 若每route各保留mono5s float ring：`N_routes × 5 × Fs × 4`；96 routes／48 kHz約87.89 MiB。 | 本案createDelay最大5s，但browser如何配置是opaque；此值是設計壓力情境，**不是已測或必然配置量**。 |
| Geometry／texture估計 | typed-array byteLength＋index buffers；texture依width×height×format、mips／layers／render targets估。 | CPU與GPU可能各有copy；driver對齊、壓縮、cache未知，不能用object count轉成精確bytes。 |
| Trace與queue | `Σ actual serialized frame bytes`；queue約`producer bytes/s × consumer stall s`，另含slots／metadata及至少一個在途最大frame。 | JSON heap expansion需實測，不能固定假設2倍或4倍；bytes/s用simulated與wall時基各報。 |

`peak(stage) = live owned data + in-flight copies + transient encoder/decoder + native/WASM/GPU state + measurement overhead`。各 stage 最大值不能不加判斷全部相加，也不能因不同階段就假定不重疊。應建立capture→seal→save→replay→B→dispose生命期表，檢查A/B與舊epoch尾音的重疊。OfflineAudioContext回傳AudioBuffer，不保證整段PCM不駐留；現有長輸出、chunk state carry等限制沿用[離線研究](../12-architecture-review/OFFLINE_RENDERING_RESEARCH.md)。

## MEM-03：初始研究 envelope（未採納、未強制執行）

先以**30秒、48 kHz、stereo、單一未來輸出**作容量估算案例；renderer尚未實作，這不是新正式測試或已可用功能。以下512 MiB是為研究分配與提前辨識未知項的**初始規劃假設**，相對 warmed baseline 的工作增量，不是任意裝置可保證的RAM上限或新的驗收門檻。

| 研究會計項目 | 初始配置 MiB | 解釋 |
| --- | ---: | --- |
| Decoded asset backing data | 64 | 沿現行預設資料預算，staging若另持copy須另扣。 |
| Trace／artifact所有存活表示 | 128 | 以實際owned representations核算；不是允許64 MiB trace必然能塞進128 MiB heap。 |
| Output PCM／encoder暫存 | 96 | 30s單PCM＋PCM16 WAV的解析值約16.48 MiB；保留轉換／多份copy空間，不授權增加stems。 |
| Queue／transfer pools | 16 | 候選上限包含在途及歸還前buffers；不是新增實作。 |
| IR／filter sample payload | 16 | 與現行late IR cap分開；不假稱包含所有native convolution。 |
| Geometry／path／render資料 | 32 | 只涵蓋可直接歸屬資料；GPU真配置另報unknown。 |
| 增量runtime／WASM／view規劃額 | 64 | 假設值，待profile可推翻；不把既有WASM capacity漏算。 |
| 未分配研究餘額 | 96 | 保留可見transient及量測負擔；**不能以此吸收無界opaque成本並宣告安全**。 |
| 合計 | 512 | 不是瀏覽器、OS、GPU或native engine的已知總峰值。 |

後續實作若任一項無法估／量或超初始額，研究結論應記「envelope不成立／證據不足」，縮小下一個隔離案例或另提設計；不改原fixture／正式門檻以取得PASS。無損trace不可為符合此表而丟tick或少存events。512 MiB不是trace quota、storage quota、OOM前安全界線或產品自動停錄條件。

候選queue研究起點為byte cap8 MiB、最多120 tick slots，高水位6 MiB／90slots、低水位2 MiB／30slots；其餘8 MiB留給在途／buffer pool。這只是兩秒模擬資料的slot假設，並非能承受兩秒wall stall。最大frame及snapshot若不適配，必須在接納前拒絕／pause並回報，不能越界後覆寫舊frame；沒有實作前所有值均未生效。

## MEM-04：CPU、GPU、render、GC與能耗分開量

| 觀測 | 建議證據／單位 | 不可推論 |
| --- | --- | --- |
| 主緒wall spans | 原CDP RunTask union／RAF bins，ms、p50/p95/max；加tick capture各分項。 | wall occupancy不是thread CPU或GPU時間。 |
| CPU | 同裝置OS process/thread CPU samples、採樣週期、core／頻率／節流及profile overhead。 | 100%定義依工具；不能只憑RAF延遲判定CPU飽和。 |
| GPU | feature-test async timer-query，只採available且non-disjoint結果；記render calls／triangles／pass／DPR。 | CPU submit時間或fps不是GPU duration；不用gl.finish強迫同步來假裝正常負載。 |
| JS／Worker／WASM／native | reachable heap、ArrayBuffer backing、linear-memory capacity、process footprint；來源／範圍／採樣缺口明列。 | heap穩定不能排除native/GPU成長。 |
| GC | pause spans、alloc rate、retained-object趨勢；每次capture／seal／replay對照。 | sawtooth不自動等於leak；人工forced GC只另列診斷，不在正常時間結果中混用。 |
| 能耗 | CPU/GPU busy、wakeups、disk/network bytes只標proxy；若真測功率另記感測方法、W、積分J及idle基線。 | CPU少20%不等於耗能少20%；量測本身也可能喚醒裝置。 |

[Three.js renderer.info](https://threejs.org/docs/pages/WebGLRenderer)的memory欄位是geometry／texture數量；多pass計數須明示reset邊界。[disposal manual](https://threejs.org/manual/pages/how-to-dispose-of-objects.html)說明geometry／material／texture須按所有權釋放，內部cache可能合理保留；因此清理後不要求所有counter歸零。[Khronos timer query](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)與[Mozilla power profiling](https://firefox-source-docs.mozilla.org/performance/power_profiling_overview.html)分別支持GPU非同步量測與能耗proxy／功率證據的區分。

可選 `measureUserAgentSpecificMemory()` 是有條件且含範圍限制的估計；不在frame callback頻繁呼叫，也不為本研究新增COOP/COEP。支援、失敗及量測擾動須保存。[Chrome團隊說明](https://web.dev/articles/monitor-total-page-memory-usage)

## MEM-05：穩態、成長及操作峰值的後續觀測（NOT RUN）

同一source／bundle／browser／裝置先記冷啟動，再記warm idle、固定互動、capture、seal、save/load、replay/seek、B、dispose。報每階段峰值、暖機後區間與對wall-time的成長斜率（MiB/min）；另以完成run／artifact個數報每cycle retained增量。至少重複數個相同生命期才討論leak，不以一次heap降回或一次穩定宣稱長時間穩態。關閉tab／GC／釋放聲尾後的恢復分別標明，保留worker終止、AudioContext／node、GPU及database連線所有權證據。

既有 [performance fixture](../../tests/browser/performance-fixture-v3.mjs) L455–508量fixedStep／onTick／publish／interpolation／advance，L597–604收longtasks；沒有由此證明完整browser RAM。 [trace analyzer](../../tests/browser/performance-native-v3.mjs) L25、L668–670的2 GiB Node heap cap只保護分析程序，不能當產品RAM。R17負面結果不因新資源模型改寫。

後續工作：MEM-A建立owner／stage inventory與低頻有界觀測 → MEM-B重播／A-B／seal生命期profile → MEM-C在相同負載比較allocation／copy候選 → MEM-D以獨立審查決定是否採納。量測工具、數學大小及方法可審查，不等於已執行產品／裝置／功耗驗證。