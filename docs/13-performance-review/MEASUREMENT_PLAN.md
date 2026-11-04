# 量測方法、研究長測與未來 Benchmark

查核日：2026-11-01。產品基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`。本頁是研究計畫及本次收集方法；正式門檻仍唯一依[PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md)與[Browser正式方法／R17失敗](../11-v1/BROWSER_PERFORMANCE.md)。本輪不修改兩者。結果收據與限制見[最終報告](FINAL_REVIEW_REPORT.md)。

## 1. 本輪執行與資格

使用Node22.17.0／npm11.4.2及原lockfile，隔離安裝依賴。先執行未修改的`tests/browser/run-performance-v3.mjs`，其`--formal-600`要求all、600秒、physics3000與acoustic600，禁止替代負載。原Chrome launcher hash為`480f275b63d1ea39113cbc8344ac395578acc25b432bd39af5fbc77005179aca`；目前安裝156.0.8078.75的hash為`7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa`。原入口拒絕及退出狀態必須保留。

依使用者明確選擇，另以忽略的`.cache/performance-review/measurement/`暫存研究副本執行目前Chrome。複本只調整import位置、實際launcher／native producer身分及明示research-only metadata；fixture、負載、時間窗、門檻、原生trace membership/caps/closure與錯誤處理不變。adapter原文、diff、hash與實際producer revision固定在收據。即使回傳正式候選欄位，外層分類永遠為`RESEARCH_ONLY / NOT_APPROVED`。

研究先短測all20秒驗證收集，再執行一次all600秒。這是單次instrumented observation，不估計跨run可靠性。所有命令、stdout/stderr、build/source/bundle/browser/hash、raw／tail／trace及錯誤保存新目錄，不覆蓋歷史。原始資料與研究程式留在隔離暫存；本目錄只保存精簡收據及可查驗hash。

固定localhost5193與owned browser；既有程序占用時保留衝突，不殺其他工作。收集期間不並行build／browser／CPU測試；文件撰寫的殘餘負載與CDP本身仍是限制。若新版本trace不符合原parser，對應分析維持UNVERIFIED，不能放寬原membership或從平均FPS補造結果。窗外finish-tail絕不回填原600秒視窗。

## 2. 情境矩陣

以下是未來可獨立實作的研究fixtures；本輪原Profile僅覆蓋其中部分，不能宣稱全部已跑。

| ID／情境 | 固定輸入與變因 | 主要觀測／輸出 |
|---|---|---|
| BM01 Baseline Audio | 單一持續source；無physics、無reflection；固定asset／gain／device | 原生output stats、長task、node與automation基線、PCM完整性 |
| BM02 Physics Only | 相同初態／impulse序列；關閉acoustic/audio lane | core/fullstep/onTick成本、catchup、wall-time drop、事件連續性 |
| BM03 Direct Sound | 固定listener／距離方向軌跡；只direct | emission→audio映射、admission／age、物理arrival及gain誤差 |
| BM04 Early Reflections | 同scene／一階／明確有效paths預算；default和stress分列 | compute／delivery／snapshot age／path churn與音質 |
| BM05 Dynamic Filter | 固定增益、頻率形狀分別變動；相同path identities | cachehit/miss、kernel rebuild、native buffer assign、automation與node成本 |
| BM06 Collision Burst | 相同bodyIDs／初態／碰撞與event序列；維持原logical及native budgets | eventorder／dedup、admission、late starts、active/retiring/steal/tail |
| BM07 FPS Interaction | 固定移動／抓投／快速視角軌跡；真鍵鼠另驗 | RAF、physics/render同步、listener更新、輸入與音訊延遲 |
| BM08 Recording | 同固定tick完整記錄，early/mid/late capture | capture solver／clone／append／seal／save分項、debt/backlog、完整性 |
| BM09 Replay | 同RecordingArtifact／assets／listener／seek序列 | replayclone/index、sourcephase、tail/pause/seek語意與PCM |
| BM10 Long Stress | 同負載長跑與create/dispose循環；背景切換另成情境 | 記憶體趨勢／回收、overrun、output stats、thermal proxy與恢復 |

背景／quota／worker crash／seek／pause-resume／revision切換／out-of-order回覆使用獨立負面情境；不能混入穩態分布後稱同一負載。正式錄製檢查每tick/body/event contiguous、hash、seal/commit及取消結果，不採latest-only。

## 3. Metrics 與誠實的可觀測邊界

| 指標群 | 要記錄的值 | 方法與缺口 |
|---|---|---|
| Render/UI | FPS、frame time、long tasks、main occupancy、drawcalls／DPR／React commits | native RAF＋CDP；occupancy是wall spans，不是thread CPU；GPU／React需獨立工具 |
| Physics | core/fullstep/onTick p50/p95/p99/max、catchup count、overruns、dropped wall seconds、paused advances／debt | 現有fixture已有部分；逐tick bridge成本不能冒稱包含在Rapier計時 |
| Acoustic | requestbuild／validation／clone、workercompute、roundtrip、handler、consumer、snapshotage、stale/reject/timeout、payloadbytes | service roundtrip起點不含requestbuild；delivery未自動涵蓋app consumers／OS prehandler |
| Audio control | late events、pendingage、voiceadmission reject、active/retiring voices、activepaths、steals／pathdrops | 保留logical／native／solver三層預算；這些不是output underrun |
| DSP graph | kernel rebuild／cachehit、convolver buffer replacements、IR builds、AudioNode create/dispose、automationevents | native graph未公開完整counter；未加研究instrumentation前保持NOT MEASURED |
| Audio render/output | 實際sample rate／block size、render capacity、underrun events/duration、output integrity | API支援才記；原fixture未自訂Worklet，不量得其DSP deadline；硬體聽感另驗 |
| Memory/GC | JS/worker heaps、WASM、native working set、decodedPCM／IR／trace ownedbytes、peak／steady、GCpauses | 每個API記覆蓋／取樣頻率；Node analyzer heap不是browser RAM；opaque native/GPU分開 |
| Recording/export | queueitems/bytes/age、highwater／producerpause、encode/hash/write/flush/commit、renderduration、frames/events/PCM integrity | 本輪尚無正式PCM renderer；未實作metrics列instrumentation task，不填0 |
| Energy | serviceCPU time、wakeups、longtasks、temperature／battery／throttling若可靠可得 | proxy分開，不把CPU%換算成瓦數；電源模式、充電與測試期間固定 |

現有API與量測prototype能力需逐次feature-test。`AudioPlaybackStats`為實驗性介面，定義output underrun／latency，沒有提供根因或Worklet callback execution p99；其live物件更新頻率也限制時間相關性。[MDN定義](https://developer.mozilla.org/en-US/docs/Web/API/AudioPlaybackStats)、[Web Audio規格](https://webaudio.github.io/web-audio-api/#AudioPlaybackStats)。沒有支援或本輪沒有蒐集時記NOT MEASURED，不用lateEvents或pathdrops替代。

輸出完整性至少檢查finite PCM、意外silence、discontinuity、clipping、arrival、tail與source phase。原生buffer underrun計數、數位PCM異常、裝置loopback與真人Click回報為四份證據；單靠crossfade或muted graph不能互相替代。

## 4. 未來比較規則

每個改善task先固定Baseline Commit／Candidate Commit、完整來源與bundlehash、scene／assets／physics初態與事件序列、實際sample rate、browser/device/OS/GPU/power mode、viewport/DPR、錄製期間及instrumentation。run manifest須有設定值與實際值，保留不相符原因。

短fixture預先登記warmup與至少5次獨立run；研究長測比較預先登記至少3次同負載run、交錯順序及冷／熱狀態。這些是未來研究採樣建議，不新增或取代正式gate。禁止看過結果後刪run、改窗、改percentile定義。原R17與本輪不同code/browser，最多作帶限制歷史對照，不能直接歸因改善或退化。

報告每run分布與樣本數，區分單次事件分位數、batch平均分位數及跨run變異；列p50/p95/p99/max，樣本不足不硬給p99。分開計入／排除暖機、暫停、safe overload、無效負載與finish-tail的依據；保留所有失敗。

性能、聲學品質、互動latency與資料完整性各自驗收。降低反射階、source數、paths或更新率屬品質／負載改變，不能冒充同負載性能通過。沒有量得收益的提案只寫預期方向，不填加速百分比。

## 5. 交付檢查

每份收據包含命令、exit、elapsed、UTC、baseline、實際browser/device、script／adapter/source/bundle hashes、原始檔位置與hash、metrics／workload判定、未量項及清理結果。研究prototype與完整trace不進Git；精簡研究收據不能被描述成已公開的完整raw bundle。

本輪文件驗證使用既有validate:docs／validate:research／validate:schemas、Wiki lint／test:wiki及validate:english；不建立照抄文件內容的測試，不改任何正式snapshot／tolerance／expected。獨立review另外核對來源、跨版本與scope，因靜態link checker不驗外部來源與因果推論。
