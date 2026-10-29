# 2026-10-29 研究後可執行優先級

## 2026-10-29 整合後更新與真人回報

本輪研究與最小修正已以保留歷史的方式合併；原工作區完整品質檢查與當前 UI28／串接8／產品4／物理2／儲存5 分項通過。實際提交、收據與尚未完成的公開流程見 [integration-state.json](12-architecture-review/integration-state.json)。

新增的 [R18 真人回報](11-v1/USER_TEST_FEEDBACK_20261029-r18.json)優先於先前「等待首次真人測試」的描述：第一人稱無法移動或操作為使用者回報失敗，下游 FPS 操作受阻；材質與反射未測，預設音量與直接操作有問題。實測 bundle／裝置未知，不能把自動化通過當作覆蓋，也不能推定數值或裝置驗證成功。下一個工程切片先固定來源並診斷第一人稱輸入阻斷，再處理音量／直接操作及原錄製熱路徑／性能；本輪沒有修復這些產品問題。舊章節保留原截點與後續設計。


本節優先於下方歷史十日排程；沿用既有 Task JSON 與凍結驗收。完整架構研究見 [Review](12-architecture-review/ARCHITECTURE_REVIEW.md)，本輪不是完整 V1 結案。

| Milestone | 可交付範圍與下一步 | 接受門檻／延期條件 |
| --- | --- | --- |
| P0 — Hackathon MVP | 維持現有Scene／Rapier／有限抓投／direct+一階／Sound／錄放A-B／最小Meta demo。先處理Task0020性能與record onTick熱路徑、正常100%實體FPS／IME與裝置聽測；準備可重現demo／來源／本人資格 | 保留R17負面數字與原51／102條件；未通過不得把所有V1標完成。公開歷史發佈先過Task0021 G9 |
| P1 — Production Workflow | 按風險分開：共用producer capability、Motion registry與Move To/Release、bounded recorded evaluation lane、短take local mix/stems／drywet、Muse工具能力與durable budgets | 每次一個垂直切片與負面fixture；RenderBackend目前僅types。沒有本輪全部交付或工期承諾 |
| P2 — Advanced Acoustic / Export | 多階／動態reflector／更完整materials、ADM/BW64 profile、cloud render／長時間chunks、更多HRTF | 需科學reference／browser capability／memory與profile validator；不是MVP必要依賴 |

官方作品截止仍為 **2026-11-05 10:00 台北**；申請已截止，是否入選、登入後提交欄位與條款由本人核對，見 [Meta review](12-architecture-review/MUSE_AGENT_ARCHITECTURE.md)。不以日期推論資格。若P0穩定性或buffer不足，停止新增P1/P2；11/4內部凍結原則保留。

下一個可直接交付Codex的任務見 [NEXT_ENGINEERING_TASK](NEXT_ENGINEERING_TASK.md)。以下原排程與數字為歷史，不覆蓋本節。

# 十日正式實作路線

## 2026-10-27目前決策與Sound Behavior範圍

正式Web第一版已進入實作與整合驗收，見[實作狀態](IMPLEMENTATION_STATUS.md)與[完整驗收](11-v1/ACCEPTANCE.md)。下方原十日表保留早期排程，不能因日期經過就勾完成。依[ADR-013](02-architecture/adr/013-codex-primary-development.md)由Codex主導、MuseCode選用；產品Meta與開發額度分帳。公開提交日期及本人資格／完整條款仍以[重查紀錄](01-compliance/HACKATHON_RULES.md)為準。

聲音行為值得列為核心，但以可解釋事件／自由內容／統一傳播的最小垂直鏈為界。先做AlwaysOn＋OnImpact與簡單gain/pitch／asset選擇／Inspector；OnGrab/Throw/Airborne依FPS互動前置接入，不把所有P0候選同時承諾。Graph／modal與大量layers延期。完整source、schema與風險見[Sound Behavior架構](10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md)。

| Stable Task | 依賴與可開始範圍 | 驗收／本次狀態 |
| --- | --- | --- |
| 0010 Research Integration | 已有Wiki／contracts／spikes | DONE；研究／draft驗證，非產品 |
| 0011 M0 Audio Event Runtime | 0010；normalized fixtures與0006可平行 | DONE；原M0 domain／checkpoint證據與之後作者UI擴充各自留版本 |
| 0006 Scene/Physics | 既有設計與驗證基礎 | 原P0-01保持，Codex直接實作，不必跑Muse Harness |
| 0012 Sound P0 vertical | 0006＋0011 | 程式已落地；保留原audio／browser／人工聽測criteria，未據窄測試結案 |
| 0013 Sound P1 | 0012＋FPS interaction相關前置 | Grab/Throw/Airborne、rolling/sliding、latch、materialpairs、timeline／A-B已實作；依原criteria統整驗收 |
| 0014 Product Muse behavior | 0012；live另需0007帳號／預算 | 最小真實Meta tool→preview/apply→實驗證據；競賽展示重點，不能以Coding Agent替代 |
| 0015 P2 advanced | 0013 | Graph／modal／複雜合成，時間不足直接保留BACKLOG |
| 0016–0020 整體及驗收切片 | 沿用既有Task依賴 | 逐項51需求、物理邊界／Worker／錄放資產／browser性能證據；不另建任務系統 |

剩餘時間內先驗Scene／physics／單一audio route，再做創作與Meta實際工具切片，最後保留整合／影片／條款與提交buffer。若最小聲學／browser／Meta真連線尚未驗通，優先縮減內容與UI，而非新增Graph。這是工程優先級，不是量得的工期或成功保證。

此表是**下一階段計畫，尚未開始執行**。官方作品提交為 2026-11-04 21:00 ET＝**2026-11-05 10:00 台北**。採 10/26–11/4 十個台北日期規劃；實際正式開發起算依官方 kickoff／入選規則，不因本表自動取得資格。先重查 [規則](01-compliance/HACKATHON_RULES.md) 的賽前程式、coding agent、商業SDK與提交欄位；未知不推成允許。

主線 Web-native；不在同時維護 Unity、Tauri 與 Web 三個產品。每天預算約 6–8 小時、可並行研究／驗證但共享runtime修改需分界。11/4 18:00 台北內部凍結，距公開deadline保留16小時；最遲11/4上午處理正式表單／影片，不等最後一晚才查欄位。

| 日／台北日期 | 優先／依賴 | 交付與驗收／測試 | 主要風險與 fallback | 工時 |
| --- | --- | --- | --- | --- |
| D1 10/26 | P0-01，完成正式開發前關卡 | Scene document host、room/sphere、Three view、Rapier fixed tick；4 body modes，import/export/revision，geometry IDs；無 NaN／scene roundtrip 與模式測試 | 工具整合拖延：只 primitive、單一room，禁擴展 arbitrary mesh | 6–8h |
| D2 10/27 | P0-02，D1 | FPS capsule、gesture lock／focus、獨立listener、ray pick；牆／斜坡／Esc／blur manual cases；固定tick不隨FPS變 | pointer lock受限：無鎖定替代；不犧牲碰撞 | 6–8h |
| D3 10/28 | P0-03，D2 | bounded grab/drop/throw/fix，ghost/staged/explicit enable；薄牆、角落、重物、低FPS、NoGravity驗收 | servo不穩：限制mass/distance/throw cap；減少場景物件，禁止teleport穿牆 | 6–8h |
| D4 10/29 | P0 audio，D1/3 | continuous emitter＋dedup collision sample-based events＋HRTF；抓投期間不中斷；静置不重複播放、voice cap與clipping telemetry | assets權利／worklet成本：原創synth signals＋原生WebAudio nodes | 6–8h |
| D5 10/30 | P1 acoustic，D4 | direct delay/1/r、靜態occlusion、有限一階ISM；同t0 arrival／bounds／blocker regression；真實path inspector | CPU超限：1 source/限paths/降低更新；不聲稱wave精度 | 6–8h |
| D6 10/31 | P1 material/runtime，D5 | Synthetic band materials、air參數標limits、基本reverb、Raw/Simulated；offline graph impulse/energy/normalization測試 | ISO係數仍未驗：固定明示示範空氣模型；reverb標perceptual | 6–8h |
| D7 11/1 | P1 AI，D1/5 | 先驗帳號/模型/小額budget，再Meta Scene commands；preview/domain/undo，run artifacts與tool error；至少一段可證明live trace | 模型存取無法解：縮減單一tool loop；明示offline備案且確認競賽影響，不能冒充Meta整合 | 6–8h |
| D8 11/2 | P1 experiment，D3/6/7 | motion+source/contact trace capture，same-motion材質A/B、computed metrics；hash匹配，RT不足回unavailable；one reproducible demo flow | recorder成本：先受控trajectory＋immutable snapshots；不宣稱完整自由操作replay | 6–8h |
| D9 11/3 | integration，D1–8 | 凍結功能；跨browser／headphones／低FPS測試；端到端Meta→scene→throw→A/B；三次乾淨重開演示 | 未穩P2全砍；Steam只保native研究證據，非產品依賴 | 6–8h |
| D10 11/4 | release buffer，D9 | 確認官方表單、資格與素材權利；source/NOTICE/provenance、部署／影片按官方欄位、人工提交前檢查；18:00凍結 | 部署故障：本地錄影／可重現package，是否合規需官方確認；使用者本人提交 | 6h＋buffer |

## P2 明確延後

二階以上 reflections、advanced bands／角度 impedance、動態反射面、完整自由物理錄放、優化IR、wave solver、modal collision synthesis、Steam browser WASM、AI自動optimization。只有P0/P1穩定且有足夠整合buffer才解鎖；不能拿P2研究完成當產品功能。

## 每日停止條件

每個 task 都有可重現 acceptance、來源、limits與rollback；未過核心碰撞／audio／資料一致性時，不繼續堆新功能。最後兩天專供整合與提交準備，使用者明確接受新風險才調整；代理本階段不自行部署、提交或接受法律條款。
