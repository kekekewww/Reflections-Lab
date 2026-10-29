# V1 跨模組獨立審查

日期：2026-10-27。Reviewer：Codex `v1_integration_review`；實作由其他 Codex 代理進行。基線 Git HEAD：`2662bc8ee3976280c5c14f619ff798570f035f14`。工作區仍在修改，本文件不宣告第一版完成。

本輪的程式來源僅修改 [整合 regression](../../tests/app/integration-regressions.test.ts) 與後續另獲授權的 [App control regression](../../tests/app/app-control-regressions.test.ts)；另更新本文件與受委派的 artifacts。沒有修改 Root 實作、凍結 acceptance、原測試、Wiki 或 Git。依據 [ACCEPTANCE.md](ACCEPTANCE.md)、[REQUIREMENTS.json](REQUIREMENTS.json)、`codex-verification`、`experiment-validation` 與後續的 `physics-interaction` Skills 核對。

**最終來源窗口：原整合 38／38，加上另由實作代理及其隔離 reviewer 撰寫的指標 8／8，全部 PASS、0 skipped；global TypeScript 與本 Reviewer 兩份測試的 ESLint／Prettier check 均 exit 0。149 個來源／schema／四份測試／契約檔前後 hashes 完全相同。** Replay ObjectView INT-15 保留 RED → GREEN，涵蓋 legacy／malformed 缺值與真 Held 分支；後續 A/B 指標修復也已獨立重跑。Node `v22.17.0`、npm `11.4.2`；來源快照時 Git HEAD 仍為前述基線，工作區有未提交修改，沒有捏造新 commit。最終程序於 2026-10-27 03:34:33–03:34:57 UTC 執行，之後已發出 INTEGRATIONEND，停止 Node／browser／source 修改。

最新完整證據為 [integration-review-v7/verification.json](../../artifacts/v1/integration-review-v7/verification.json)，包含五個獨立命令的 argv、exit、時間、stdout/stderr、artifact hashes 與歷史證據連結；另有 [來源 before](../../artifacts/v1/integration-review-v7/source-before.json)、[來源 after](../../artifacts/v1/integration-review-v7/source-after.json)、[38 案 raw stdout](../../artifacts/v1/integration-review-v7/owned-suites.stdout.txt) 及 [指標 8 案 raw stdout](../../artifacts/v1/integration-review-v7/metric-population-group.stdout.txt)。四份測試都在執行前封存真實 bytes：[整合](../../artifacts/v1/integration-review-v7/sources/tests/app/integration-regressions.test.ts)、[控制](../../artifacts/v1/integration-review-v7/sources/tests/app/app-control-regressions.test.ts)、[Root 指標](../../artifacts/v1/integration-review-v7/sources/tests/app/metrics-population.test.ts)、[隔離指標](../../artifacts/v1/integration-review-v7/sources/tests/app/metrics-population-review.test.ts)。

[v6](../../artifacts/v1/integration-review-v6/verification.json) 雖有成功結果，但凍結通知後 `metrics.ts` 加入 band-key guard，來源 147 檔中一檔前後不同，明確標為 historical，沒有當成最終 current gate。[v5](../../artifacts/v1/integration-review-v5/verification.json)、[v4／35 案](../../artifacts/v1/integration-review-v4/verification.json) 與 [v3／34 案](../../artifacts/v1/integration-review-v3/verification.json) 也保留。這是本 Reviewer 的有限範圍證據，不是整體第一版、Browser、真 DSP 或 Meta live 完成宣告。

## 執行與目前結果

命令：`node --import tsx --test tests/app/integration-regressions.test.ts`。

| 獨立執行 | exit | 結果 | 說明 |
| --- | --- | --- | --- |
| 初次，9 cases | 1 | 0 PASS / 9 FAIL | 全部被 `ASSET_MISSING: Unknown source signal signal.tone-220` 啟動錯誤攔截；不是九個已各自證實的下游缺陷。 |
| 啟動修復後，14 cases | 1 | 11 PASS / 3 FAIL | 真 Rapier、authoring、Replay、Host 與控制圖流程已可執行。 |
| 加入匯入資產 regression，15 cases | 1 | 11 PASS / 4 FAIL | 新增的 trusted registry 遺失問題也已實際重現。 |
| 第 16 案單獨執行 | 1 | 0 PASS / 1 FAIL | `--test-name-pattern 'captured impact acoustics'`；真 Impact 沒有同 tick 的聲學 route。 |
| AI 修復後公共 Runtime 單案 | 0 | 1 PASS / 0 FAIL | `--test-name-pattern 'unsupported AI experiment tools'`；真 Host 的 unsupported 與原因已傳至介面。 |
| AI Session 結果／來源修復後 | 0 | 10 PASS / 0 FAIL | `node --import tsx --test tests/ai-runtime/session-results.test.ts`，獨立重跑。 |
| 原 16 cases 修復後全跑 | 0 | 16 PASS / 0 FAIL | 其餘四項原有缺陷均已在相同期望下通過。 |
| Contact witness／過載政策 | 0 | 2 PASS / 0 FAIL | `node --import tsx --test tests/physics/contact-emission.test.ts tests/app/overrun-policy.test.ts`。 |
| 新增第 17 案單獨執行 | 1 | 0 PASS / 1 FAIL | `--test-name-pattern 'late-start acoustic B'`；相同配置在 capture 中途起點重設持續內容。 |
| 新增第 18 案單獨執行 | 1 | 0 PASS / 1 FAIL | `--test-name-pattern 'recorded-output replay schedules'`；舊 run 已 drain，卻未排程錄製內容。 |
| 晚起 capture／合法 WAV fixture 複驗 | 0 | 2 PASS / 0 FAIL | 第 17 案保留 instance/start tick/playhead/sourceSignalHash，並確認 `restoredPreStepSnapshot`；資產 case 只換成合法 PCM16 WAV input，原 registry/assert 保留。 |
| RecordingProcessor 狀態 guard | 0 | 12 PASS / 0 FAIL | `node --import tsx --test tests/app/recording-processor.test.ts`，獨立重跑；缺少 pre-state、誤用 post-state、狀態不符、contact one-shot 與 source ID mapping 均有案例。 |
| 新控制流程第一輪 | 0 | 6 PASS / 0 FAIL | 預設 offline、budget 0 BLOCKED/status-only、不隱性 fallback、取消舊 proposal、原子 import action、raw artifact export。 |
| 矛盾 READY 負例 | 1 | 0 PASS / 1 FAIL | 原先接受 `READY + null modelId + cost 0` 並送 propose；本機 fetch mock，真 server 仍有零預算 gate，沒有呼叫模型。 |
| AssetHost 接線後合跑 | 1 | 25 PASS / 1 FAIL | `node --import tsx --test tests/app/app-control-regressions.test.ts tests/app/integration-regressions.test.ts`；新控制 8 項通過，原重複 Enable 的 logical source lifecycle 回歸失敗。 |
| 控制／跨 Runtime 儲存新案 | 0 | 10 PASS / 0 FAIL | `node --import tsx --test tests/app/app-control-regressions.test.ts`；加入共享 memory BlobStore 下的 fresh Runtime asset/recording reload，以及 missing bytes 原檔 relink。 |
| Enable／StopReplay／有 pitch 的 B cursor | 0 | 3 PASS / 0 FAIL | 合併 targeted name pattern：原 Enable 期望保留；StopReplay→Run 保留 suspended live instance/source cursor；B 完整保留 AudioEngine pre/post cursor，且 fixture 中 source seconds 明確不同於 logical playhead。 |
| Scene source sidecar 新分支 | 1 | 1 PASS / 1 FAIL | 追加 sidecar 與 offline import view 兩個 targeted branches：asset view PASS；`tone` Scene proposal 已 commit source，卻沒有 AlwaysOn Behavior sidecar。 |
| Processor／ReplayAudio cursor 複驗 | 0 | 28 PASS / 0 FAIL | `node --import tsx --test tests/app/recording-processor.test.ts tests/app/replay-audio.test.ts`；實際 AudioEngine 方法配合控制圖 adapter，涵蓋 late cursor、seek、generator/pin/provenance 與不完整資料拒絕。 |
| 真 RunSimulation 接線後初次 targeted | 1 | 尚未進入案例斷言 | 並行中間態：recorder 已 import 尚未落盤的 `source-phase.js`，module load 拒絕；不當成 Host 語意失敗。 |
| 真 RunSimulation／unsupported order2 | 0 | 2 PASS / 0 FAIL | 真本機 Host 回傳非零 solver steps 與已持久化、可 verify 的 3s artifact；order2 fixture 經真 Host 拒絕，0 steps／無 artifact。 |
| Source sidecar 契約複驗 | 0 | 1 PASS / 0 FAIL | Apply 預設停止、不建裝置；明確 Enable＋Run，兩次 Undo 分別還原 Enable 與 source sidecar。 |
| 兩個 owned suites 合跑 | 0 | 32 PASS / 0 FAIL | `node --import tsx --test tests/app/integration-regressions.test.ts tests/app/app-control-regressions.test.ts`；同輪 TypeScript exit 0。前後來源 hashes 發現 runtime／experiment-tools 變更，尚不視為 frozen final。 |
| Native onended 時鐘負例 | 1 | 0 PASS / 1 FAIL | 在真 Rapier impact 的已 admitted source 上執行 AudioEngine 安裝的 callback；同 tick／pose 不變，但下一個 pre-step checkpoint 的 logical instance 消失。 |
| Native onended 修復複驗 | 0 | 1 PASS / 0 FAIL | 刪除 renderer callback 對 logical state 的修改後，同一 case 確認 expiry 前仍 playing、expiry 恰一 stop、raw event 無重複、同 trace B matched。 |
| Metadata 產品接線新負例 | 1 | 0 PASS / 1 FAIL | `patchObject({name:...})` strip name 後把空 patch 送 Scene validator，得到「Patch 不可為空」，尚未到 Undo/save/load 斷言。 |
| Metadata 修復獨立複驗 | 0 | 1 PASS / 0 FAIL | durable `metadata-green`：label-only 新 revision、Undo/Redo、source reference frequency、save/load/fresh load 完整通過。 |
| 最終凍結 owned suites | 0 | 34 PASS / 0 FAIL | durable `owned-suites`：包含 onended clock 與 metadata 新案；144 個 source/contract/test hashes 前後一致，無 skip。 |
| 同窗口 TypeScript | 0 | PASS | durable `typecheck`：`node node_modules/typescript/bin/tsc --noEmit --pretty false`，stdout/stderr 皆保存。 |
| Gravity-only 新案 | 1 | 0 PASS / 1 FAIL | FIRST PRODUCT END 後才執行；真碰撞先證非零 v/ω，再只改 mode。物理動量保留，但原 AlwaysOn native source stops 從 0 變成 2。146 檔前後一致。 |
| Gravity-only 修復複驗 | 0 | 1 PASS / 0 FAIL | 同一 test／expected；雙向切換保留 v/ω、epoch、instance/start tick、同一 source object 與 source cursor。146 檔前後一致。 |
| v4 最終 owned suites | 0 | 35 PASS / 0 FAIL | durable v4：包含 Gravity-only 新案，無 skip；並行 TypeScript exit 0；146 檔前後一致。Node END 已通知產品瀏覽器代理。 |
| Replay ObjectView 新案 | 1 | 0 PASS / 1 FAIL | bounded Node：case 約 423 ms；3-frame 錄製的非零速度與 awake 狀態，和真 Rapier 後續 sleeping live state 明確不同。Replay display 卻取 live 零速度。146 檔前後一致。 |
| Replay ObjectView 修復複驗 | 0 | 1 PASS / 0 FAIL | 同一 test／expected，saved velocity／sleep 與 StopReplay 保留 live world 全通過；146 檔前後一致。 |
| Replay state 延伸分支 | 0 | 3 PASS / 0 FAIL | 原案例加 legacy／malformed 缺值省略與真 Grab→capture→Drop 的 Held 分支；saved pose 亦核對，沒有套 live fallback。 |
| v5 owned suites／品質檢查 | 0 | 38 PASS / 0 FAIL | 0 skipped；global TypeScript 與 scoped ESLint／Prettier check 全部 exit 0；146 檔前後一致。此窗口早於後續 route metrics 修復。 |
| v6 中間窗口 | 0 | 38＋8 PASS / 0 FAIL | 命令通過，但 `metrics.ts` 在窗口內改動；147 檔中一檔不同，明示來源非凍結，不作最終 current claim。 |
| METRICSEND 後 v7 最終窗口 | 0 | 38＋8 PASS / 0 FAIL | 原整合與新指標各自獨立命令，均無 skip；global TypeScript／scoped ESLint／Prettier exit 0。包含四份測試的 149 檔前後完全一致，執行前原始碼已封存。 |

AI Session 複驗另捕捉過並行修復中的中間態：新增 conflicting status/state regression 時，先有 9 PASS / 1 FAIL（`completed` 蓋過 `failed`）；最新 source 改成 failed/pending 優先後，同一測試全數通過。來源模式核對涵蓋 offline exact label/null IDs，以及 live fixture 缺 model/response ID 或來源矛盾時拒絕；fetch 為本機 mock，沒有真模型呼叫。結果與 provenance 以複本保留，queued/unknown/null metric 不會改寫成完成或數值 0。

Scene source 新案的預設發聲期望另經正式來源修正：本 Reviewer 重讀 [AI_TOOL_SCHEMAS.md 的 SceneSpec 轉換](../08-ai/AI_TOOL_SCHEMAS.md)，原文明定「source初次設定的playing=false」。因此 case 保留完整 sidecar/Undo 要求，但改為先驗新 source/規則停止、Apply 不 Run／不啟動音訊、Run 單獨不發聲，再由 Inspector `patchRule(enabled:true)` 明確啟用並 Run。這是修正原測試對 canonical 的錯誤理解，沒有改凍結文件；sidecar 不存在仍失敗。

RunSimulation 原先確實未接 executor，故舊案例驗 unsupported。正式接入 ExperimentToolHost 後，改成驗 `succeeded`、受限 IDs／64KiB envelope、非零 steps、0 API cost、真 BlobStore persistence、可驗 artifact hash、frame/tick 時間與球體位移，並確認不改 live Scene／tick 或啟用音訊。另以本機 fetch fixture 請求仍未支援的二階反射，保留「實際 error／0 steps／不捏造 artifacts」原意；fixture provenance 不是真 Meta live 證據。

發現與修復狀態：

| ID | 需求 | 重現與 expected / actual | 狀態 |
| --- | --- | --- | --- |
| INT-01 | V1-AB-01/02、V1-SND-04 | 錄製 A，停用 speaker 的 `rule.always`，重評 B。原先沿用 A events；修復後，相同 motion/raw physics hashes、變更的 profile hash，以及 B 不再輸出停用規則均通過。 | 修復 PASS；late capture 另見 INT-06。 |
| INT-02 | V1-AUD-01/02、V1-PHY-06 | 作者 Listener 設為 `[1,1.8,3]` 與 Y 軸 90° quaternion，Enable/Run。修復後，Web Audio Listener position/forward 符合作者 pose。 | 修復 PASS；控制圖證據，非 DSP 聽測。 |
| INT-03 | V1-AI-01/04 | 原先丟棄 unsupported 結果已修復。後續 RunSimulation 正式接線後，真本機 run 的 steps／artifact／持久化都有證據；unsupported order2 仍由真 Host 如實拒絕。 | 凍結複驗 PASS；其他 AI gates 另驗。 |
| INT-04 | V1-SND-06/07 | Enable Audio → 匯入本機測試資產 → 再 Enable Audio → 將 impact 規則選為該 sample。修復後 trusted registry 保留 imported pin，作者操作與 project descriptor 通過。 | 修復 PASS。 |
| INT-05 | V1-AUD-01、V1-RPL-01、V1-MET-01 | 錄製 55 ticks，真 Impact 現在有同 tick/revision/source 的 AcousticFrame；direct path 起點等於 event contact emitter。另以真 Rapier 測試確認 floor contact witness 在 y=0。 | 修復 PASS；數值接線證據。 |
| INT-06 | V1-SND-04、V1-AB-01、V1-RPL-02 | Run 20 ticks → record 5 ticks → 相同配置 A/B。修復後 B 使用 `restoredPreStepSnapshot`，首 frame 保留 update、原 instance ID、startedAtTick、logical playhead 與 sourceSignalHash。另有 guard 拒絕不一致 post-state，避免任意早 snapshot 冒充 pre-state。 | logical state 修復 PASS；AudioEngine 真 cursor／波形證據另驗。 |
| INT-07 | V1-RPL-02、V1-AUD-03 | 原先 Replay drain 後不排程 saved voice content。新增接線後，獨立控制圖測試確認 Replay 建立新 source 且 activeVoices > 0。 | 控制接線修復 PASS；真 cursor／波形另驗。 |
| INT-08 | V1-AI-03 | 原先矛盾 `READY + null modelId + cost 0` 也會發 propose；runtime 現要求正預算與非空 model ID，獨立負例確認只 GET status。 | 修復 PASS；真 server gate 未被繞過。 |
| INT-09 | V1-SCN-02、V1-AI-01 | Deferred provider status 擁有 busy lease 時，第二個被拒命令或快速 input return 原先會清 busy，讓第三個作者命令穿過。`ownsTransaction` 修復後，兩分支皆保留原 owner 的 lease。 | 獨立 deferred regression 修復 PASS。 |
| INT-10 | V1-AUD-02/03、V1-SND-01 | AssetHost 新接線曾使重複 Enable 產生第二筆 AlwaysOn start；改成已 enabled 時的 idempotent 路徑後，原期望獨立通過。 | 修復 PASS。 |
| INT-11 | V1-AI-01、V1-AUD-01、V1-SCN-02 | select ball → `submitPrompt("tone")` 走原 Scene `ConfigureSoundSource` → Apply。新 source 預設停止且有 Inspector sidecar；Run 不偷啟用，明確 Enable 後才產生事件，Enable／source 交易都可 Undo。 | 凍結複驗 PASS。 |
| INT-12 | V1-SND-04、V1-RPL-01、V1-AB-01 | 原 AudioEngine `onVoiceEnded` callback 在固定步之間呼叫 `behavior.notifyEnded`，提前刪除尚未到 logical expiry 的 one-shot。控制圖實際 callback regression 獨立 red → green；根改成 renderer 自行清理，logical state／active emitters 只由 fixed-step stop 改變。 | 修復 PASS；沒有改物理時鐘或補造 audio event。 |
| INT-13 | V1-SCN-03、V1-AI-01 | Name-only action 原先被空 patch 拒絕；修復後保存在 versioned editor metadata，不進 frozen Scene。Label/source reference frequency 的 Undo/Redo、save/load/fresh load 與無 dangling metadata 均通過。 | 凍結複驗 PASS。 |
| INT-14 | V1-SND-01、V1-AUD-02、V1-PHY-02 | Tilted 初始 box 以 stable ball ID 真碰撞產生非零 v/ω；原 generic drain 令 source stops 0→2。修復僅適用其他 Scene／Behavior／metadata 不變的 dynamicGravity↔dynamicNoGravity；同一 test 驗雙向 v/ω、tick、monotonic revision、instance/start tick/epoch/source object/cursor 與單一 AlwaysOn，全部通過。一般作者交易沿用既有政策。 | 凍結 RED → GREEN PASS；未改期望。 |
| INT-15 | V1-UX-01/02、V1-RPL-02 | 原先 Replay display 混用 live velocity／sleeping；同一 test 現按 saved frame 顯示非零 velocity 與 awake，StopReplay 後 live tick/pose/v/ω/sleep/Scene 全不變。另驗 legacy 缺 snapshot、非 array objects、不合法 state 與非 boolean flags 時省略未知欄位；真 Grab 錄製 Held、Drop 後 Replay 仍 Held，Stop 還原 live 非 Held。 | 獨立 RED → GREEN PASS；未改 runtime，沒有放寬原期望。 |
| INT-16 | V1-AB-01/02、V1-MET-01 | Root 轉交 A 保留 stop 診斷 route，B 只有 playing routes，導致偽 direct-delay delta 的缺陷。修復後，真 Root impact／expiry capture 的相同配置兩個指標 delta 恰為 0；只改材質時 direct timing 不變、反射 pressure-ratio-square sum 改變。另驗缺 query、legacy geometric support、重複 query、不同頻帶與 AI unavailable，不把不相容群體轉成數值 delta。 | 本 Reviewer 獨立重跑新增 8 案 PASS；原始缺陷／來源修復由另一代理負責。 |

## 已通過的本輪範圍

- 非法作者輸入保留 Scene、Behavior、Run 狀態與 Undo history；Undo/Redo 保留 stable IDs 且 revision 遞增。
- 幾何替換、Reset、Undo 後，Behavior generation pins 可用；真 Rapier step 可再次產生 AlwaysOn／Impact 決策。
- Scene/Simulation/Analysis 切換保留 Run 與正在錄製的 capture。
- Replay 使用已保存的位置與 tick/time；其位置與獨立 PhysicsWorld 固定步參考相符。晚開始的 recording 可以相對時間 0 seek；Replay Pause/Resume 凍結／繼續 cursor。
- FPS 移動後退出可還原原作者 Pinned Listener。
- 已完成 capture 的外部 artifact reference、frame count 與 SHA 會出現在 export manifest。
- 真 SoundProposalHost 的 Preview 不修改 document，Apply/Undo 操作 live runtime；離線來源標籤保留。
- 控制圖中重複 Enable 不啟動 simulation、不新增重複的 logical AlwaysOn event。
- StopReplay 返回暫停 live world，Run 後保留原 instance、start tick 與 source cursor，不把 Replay 經過的牆鐘時間加到 live content。B 的 AudioEngine cursor 欄位保留通過；該模型明示不是硬體 PCM read pointer。
- Replay ObjectView 顯示保存的 pose、velocity、sleep／held 狀態；legacy／malformed 缺值不混入 live 值，StopReplay 不修改 live world。
- 指標使用相同的 post-step playing-source 取樣群體，排除仍保留在 raw artifact 的 stop 診斷資料；兩組 estimator／時間窗／取樣鍵與頻帶不相容時不輸出 paired delta。模型路徑壓力比平方不是 rendered energy、SPL 或裝置量測。

上述 PASS 只代表已明示案例內的證據。新增指標的獨立命令是 `node --import tsx --test tests/app/metrics-population.test.ts tests/app/metrics-population-review.test.ts`；取樣定義與來源修復審查另見 [AB_METRIC_POPULATION_AUDIT.md](AB_METRIC_POPULATION_AUDIT.md)。完整 Scene 交易負例、物理 contact 邊界、數值聲學、真 DSP、Browser 輸入與效能仍由原驗收及其他獨立測試判定。額外獨立執行 `node node_modules/typescript/bin/tsc --noEmit --pretty false`：exit 0。

## 其餘來源審查與限制

- 原先 fresh Runtime 缺少 sample decoded registry 的問題已有 AssetHost 接線。共享 memory BlobStore 的獨立測試確認 reload、原子缺檔拒絕、原檔重新連結且保留 stable ID/revision/SHA；這不是瀏覽器 IndexedDB 跨分頁／重開／quota 證據。
- `setAgentMode`／`refreshAgentStatus` 已接至 Runtime actions；獨立本機 fetch mock 確認預設 offline、零預算 blocked/status-only、錯誤不得隱性 fallback。這些控制測試不解除真 Meta external gate。
- ObjectView 三案另由只讀 reviewer 檢查實際錄製資料與公開載入路徑，未發現阻斷性假陽性。它們主要驗 Replay seek；角速度相等檢查沒有先建立非零且不同的 live／saved 值，不能單靠該斷言證明角速度投影獨立正確，也未涵蓋連續播放每 frame 的 ObjectView 更新。
- v7 命令未另外包含既有 `tests/experiment-runtime/reprocess.test.ts`；其 legacy fixture 兼容性留待主代理最終 `test:runtime` 執行，不從新增案例推定該檔已通過。
- 本檔音訊案例使用 `FakeAudioContext` 控制圖 recorder；資產 input 是合法的 4800 frames／48 kHz／單聲道 PCM16 WAV，假 decoder 只測 registry/Host 接線，不驗證 native WAV 解碼、樣本波形、DSP、延遲、HRTF 或耳機品質。
- 同事提出的 App NoGravity 連續相位疑慮，已經實際 Root control-graph regression 證實並修復為 INT-14 PASS。該案例驗控制圖 source identity／來源秒數，不宣稱實體裝置波形或聽感無縫。
- Browser、真 OfflineAudioContext、裝置聽測、10 分鐘效能、真 Meta 呼叫：本 Reviewer **NOT RUN**。沒有使用 Muse、付費 API、外部傳訊、push 或部署。

## 凍結來源摘要與交接

最終全部 149 檔 hashes 見 v7 manifests；以下只列快速核對項目。

| 路徑 | SHA-256 |
| --- | --- |
| `src/app/runtime.ts` | `691c62a6307911dd0a92b87be58710131ec6b06f7bd404a6b8a4d6c9fc7bfc40` |
| `src/experiments/metrics.ts` | `8010efee1946cfe0dba145f18e9a8b0815c756c54d47a4199419e77023d9a8fb` |
| `tests/app/integration-regressions.test.ts` | `b13fcabb46bd30cd2533ea1b7b2f5126c0694e7014d6d0efffc39a1f9c03b2a7` |
| `tests/app/app-control-regressions.test.ts` | `c42d81b97452d910449fbd2741d5f9fc7308c5578b624a602d2abaaf0cc11d38` |
| `tests/app/metrics-population.test.ts` | `673b4ff4a4fdfe486d1bfe9fe298da6c276ac30183ec9e7353ff511052070fc4` |
| `tests/app/metrics-population-review.test.ts` | `0bfb70f645dbf74a9b15cb97a9f60a3c95eae33f31ec80252eb6ba371a2cca9b` |
| `artifacts/v1/integration-review-v7/verification.json` | `b71d5e1f05206f82296559fd2575f868859fcd4a921ea961909bd843887099be` |

INT-14 獨立原始證據另存 [gravity RED](../../artifacts/v1/gravity-toggle-review-v1/red-verification.json) 與 [同案例 GREEN](../../artifacts/v1/gravity-toggle-review-v1/green-verification.json)，各有 raw stdout、分開的 stderr/command，以及 146 檔前後來源 hashes。RED 與 GREEN 的 test SHA 都是 `f908b03a00c8f239df7807c25bd17b026811107ecf3a40de8fcdb6fd4fdf8493`；舊 v3 的 34 案證據未覆寫。

INT-15 原始證據另存 [Replay ObjectView RED](../../artifacts/v1/replay-objectview-review-v1/red-verification.json) 與 [同案例 GREEN](../../artifacts/v1/replay-objectview-review-v1/green-verification.json)，附分開的 stdout/stderr/command 與 146 檔前後 hashes。兩次 test SHA 都為 `a3f4eff6cbed37508010827f7e115e06f461a9c4fe02969d7916d0f632ee3c29`；不覆寫歷史證據。

依主代理要求補存歷史 regression 原始碼，詳見 [source-copy 補件](../../artifacts/v1/integration-review-source-copies-20261027.json)。僅在重建 prefix 的 SHA 與原紀錄完全一致後才封存：v3 `98da94f3…`、v4／gravity `f908b03a…`、Replay `a3f4eff6…`，加上未變的控制測試共 8 份；另一只讀 reviewer 獨立核對 SHA 與 byte length 8／8 相符。這些是測試原始碼副本；當時完整 implementation bytes 未由本 Reviewer 封存，歷史 hashes 不能單獨重建 checkout，後續 Git checkpoint 由主代理處理。

INT-01–16 已在明示案例範圍修復並複驗，最終來源窗口沒有待修的本範圍缺陷。測試與本審查文件在交接後凍結；主代理接續整體矩陣、其他 UNVERIFIED／NOT RUN、Wiki/Task/交接及最終 Git 工作。控制圖與 source cursor 不替代真 DSP／波形證據。
