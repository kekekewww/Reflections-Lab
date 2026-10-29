# 第一版逐項證據盤點（2026-10-27）

盤點者：Codex `v1_goal_audit`，與產品實作者分離。資料截止：2026-10-27 03:02:34 UTC（台北 11:02:34）；本輪讀取自02:55 UTC開始。Git 基線 `2662bc8ee3976280c5c14f619ff798570f035f14`，V1 尚有未提交修改。**第一版尚未完成。** 本頁對照 [51 項固定驗收](REQUIREMENTS.json)及[人讀矩陣](ACCEPTANCE.md)，不修改驗收、Task 狀態或範圍。

本輪只讀程式、測試、原始結果及 hash，沒有重跑測試、啟動瀏覽器或呼叫模型。下列 PASS 是原始 artifact 的結果，不是本盤點者重新執行的結果。`PARTIAL` 表示已有明確範圍通過，但整項仍欠目前版本的完整證據；`NOT RUN` 表示未找到正式執行結果；`BLOCKED` 保留外部解除條件。來源變更不會抹除原結果，也不會使舊結果自動涵蓋新程式。多個測試集合有重疊，不加總成產品測試總數。

## 已讀證據及版本界線

| 代號 | 可重查的實際證據 | 結果及可支持範圍 |
| --- | --- | --- |
| E01 | [M0 原始結果](../../artifacts/v1/m0-validation-20261027.json)、[隔離 domain review](../../artifacts/v1/m0-independent-domain-review.json) | 當時 40 domain＋20 authoring，共 60/60、exit 0；原始 stdout 保留。10 個 source refs 中 8 個仍相符，變更為 editor 與其測試；不能以這份結果證明後續 31 項 editor 擴充全數通過。核心 evaluator 的正規化 fixtures 不是正式 Physics bridge 或 DSP。 |
| E02 | [Physics matrix-v2](../../artifacts/v1/physics-acceptance-20261027/matrix-v2/matrix-verification.json)、[實測資料](../../artifacts/v1/physics-acceptance-20261027/matrix-v2/matrix-measurements.json)、[範圍說明](PHYSICS_ACCEPTANCE.md) | 27/27、exit 0、當時 sourceStable；含 24 個 mass／障礙／gravity 抓取案例，以及同機兩次 120 tick 和 30/60/144 Hz 真 WASM。核心 Physics／lock／WASM hash 仍相符；runtime 與 matrix test 已變，現有完整 29 案仍待固定複驗。 |
| E03 | [Interaction v3](../../tests/interaction-runtime/evidence-20261027-v3/verification.json) | 28/28＋獨立 Unlock clearance 1/1、exit 0，7 個 log hashes 相符；20 個 file refs 中 17 個仍相符。已修 actual-pose／trusted apply-boundary clearance；runtime、host test、matrix test 後續有變。不含 DOM／Pointer Lock／IME。 |
| E04 | [Physics Chrome](../../artifacts/v1/physics-acceptance-20261027/browser-20261027012455939/browser-verification.json)、[資源實測](../../artifacts/v1/physics-acceptance-20261027/browser-20261027012455939/browser-measurements.json) | 2/2 browser case、exit 0；有四 modes 及真正 mount/reset/import/dispose。World/Queue 48/48、Worker 18/18 釋放，10 個 WebGL contexts 失效，受監測 GPU 資源歸零且 RAF 停止。該輪 wrapper 原本 sourceStable:false，現有來源亦已變，故為歷史分項實測，待目前版本重跑。 |
| E05 | [Acoustic delivery manifest](../../tests/acoustics-runtime/delivery-validation-manifest-20261027.json)、[真 Worker profile](../../tests/acoustics-runtime/delivery-browser-20261027.json)、[說明](ACOUSTIC_DELIVERY.md) | strict、46/46 Node（17 service＋29 solver）、4/4 正式 bundle Chrome；16/16 source hashes 本輪仍相符。8 sources／32 finite planes／一階，dispatch-inclusive p95 8.1 ms、worker 3.9 ms、service handler 0.8 ms。先前 dev／contention 失敗留存；handler 不含 Audio/UI consumer，不能當整體 delivery 或 10 分鐘 profile。 |
| E06 | [Audio manifest](../../tests/audio-runtime/audio-validation-manifest-20261027.json)、[native 原始結果](../../tests/audio-runtime/native-audio-bank-verified-20261027.json)、[界線](../../tests/audio-runtime/README.md) | 99/99 Node、25/25 真 native checks；25/25 source hashes 本輪仍相符。支持有限 renderer arrival／energy／HRTF sanity／pause cursor／WAV／cleanup。主要為獨立 HTML 的 OfflineAudioContext；唯一 real AudioContext clock 案為 muted／zero voices，不是產品 realtime 容量或人工聽測。 |
| E07 | [整合 v4](../../artifacts/v1/integration-review-v4/verification.json)、[INT-15 GREEN](../../artifacts/v1/replay-objectview-review-v1/green-verification.json)、[review](INTEGRATION_REVIEW.md) | v4 35/35＋TypeScript exit 0，146 檔前後一致；目前 runtime 與 owned test 已變。INT-15 原 case 另已獨立 RED→GREEN，146 檔前後一致，同一 test hash；證明 Replay 顯示 saved velocity/ω/sleep，StopReplay 不改 live state。新 legacy／malformed／held 分支及完整新 owned suites 尚待結果。FakeAudioContext 是控制圖，不是 DSP。 |
| E08 | [固定 UI handoff](../../artifacts/architecture-review-20261029/historical-receipts/ui-final-handoff.json)、[13 案原始結果](../../artifacts/architecture-review-20261029/historical-receipts/ui-preview-results-fda810-full13.json)、[build inputs](../../artifacts/architecture-review-20261029/historical-receipts/ui-preview-build-fda810-full13.json) | 13/13 真 Chrome、0 skip／flaky；文案變更另 1/1。包含 draft 保存／拒絕 Apply、nonlinear curve／binding override、Pointer Lock、替代操作、320 CSS／reduced motion、JSON review、recording export。146 個 build inputs 本輪 142 個相符；package、recording-host、runtime、AnalysisDock 已變，因此不是目前整體 bundle 的完成證據。原生 200% zoom 不在此結果。 |
| E09 | [AssetHost native](../../artifacts/architecture-review-20261029/historical-receipts/asset-host-native/verification.json)、[最新 storage Chrome](../../artifacts/v1/storage-browser-20261027025255775/verification.json) | AssetHost native decode＋真 IndexedDB／bank/relink 局部 PASS，未開硬體 context；storage 最新 5/5、exit 0、sourceStable:true、完整清理。後者測 persistence API fixture，包含 reload、跨 tab 原子衝突、caps／tamper、builtin PCM；不是完整產品 UI 儲存／重開鏈。 |
| E10 | [Experiment tools v3](../../artifacts/v1/experiment-tools-validation-20261027-v3.json)、[Root 整合](../../artifacts/v1/integration-review-v4/verification.json) | 真 isolated RunSimulation／capture／analysis／compare／preview 與獨立 review 當時 23/23。47 個 source hashes 中 45 個仍相符，recording-host／runtime 已變；真 Root run 已驗非零 steps、可驗及持久化 artifact，不改 live Scene／tick、不開音訊。無模型呼叫；unsupported order2 不造 artifact。 |
| E11 | [Meta Sound live summary](../../research/v1/meta-live-validation-20261027-r3-minimal/summary.json)、[獨立 saved-artifact review](../../research/v1/meta-live-validation-20261027-r3-minimal/independent-live-review.json)、[原始 trace](../../research/v1/meta-live-validation-20261027-r3-minimal/meta-behavior-trace.json) | 真 `muse-spark-1.3` ProposeSoundBehavior：RemoveBinding／AssignBinding→Host preview／Apply→明確由 Host 執行 180 ticks／181 frames、2 次真碰撞 pitch+2、capture／analyze。8/8 reviewed file hashes 相符。只涵蓋該最小 Sound 切片與 logicalIntent；不是 Scene live、Meta 規劃 Run、產品 UI live、PCM／聽測。授權三次請求已用完，不再呼叫。 |
| E12 | [最新產品 light diagnostic](../../artifacts/v1/product-e2e-chrome-20261027T025205Z/verification.json)、[診斷摘要](../../artifacts/v1/product-e2e-chrome-20261027T025205Z/diagnostic-summary.json)、[前次失敗](../../artifacts/v1/product-e2e-chrome-20261027T024059Z/verification.json) | 最新 exit 1、0/1：8 次明示 recovery 用盡；68 個連續、已驗 hash 的錄製 frames，Grab 1／Throw 0。bundle／Harness／run 來源穩定，但 sourceMatchesBuildAtStart:false，只能支持所保存 bundle 的失敗。capture advance p95 43.5 ms、bridge/capture tick p95 10 ms；是短失敗診斷，不是正式性能。可能重疊 storage 負載仍須核對，不能逕歸因產品或觀察器。完整三次鏈未 PASS。 |
| E13 | [Toolchain](../03-sdk/V1_WEB_TOOLCHAIN.md)、[依賴 inventory-r2](../01-compliance/V1_DEPENDENCY_LICENSE_INVENTORY-r2.json)、[Notices](../01-compliance/V1_THIRD_PARTY_NOTICES.md)、[原生縮放／輸入狀態](../../tests/browser/native-accessibility-report.md)、[性能入口狀態](BROWSER_PERFORMANCE.md) | 精確 dependencies／lock／license hashes 與命令已建立；當前 package scripts 已納 runtime／build／license gate。乾淨安裝及完整 V1 check 尚缺固定結果。native zoom/input、10 分鐘正式 profile 目前只找到 runner／NOT RUN 文件，不能以入口存在算通過。 |

### 本輪 hash 及來源核對

本輪重新計算原 61 份 protected acceptance hashes：**61/61 相符**；Task0006／0011–0014 的 criterion ID／文字亦未變。矩陣 SHA-256 為 `7506d24fa30acca446a517c4a9660ee53b62928ab0047048151583c8de5c6a3c`。E01／E03／E07／E08／E10 的 drift 是後續實作與測試擴充，已明列；不將舊 PASS 描述成當前整棵樹通過。

原先發現的重算插值、無遲滯、丟 draft／curve／override、未標 unsupported trigger、Worker 無 telemetry／cancel、stale age、Scene source sidecar、experiment tool stub 等，現在已有實作或後續驗證，**不再列為現行未修缺陷**。Replay ObjectView 也已取得 targeted GREEN；其餘複驗以後續結果為準。[Motion hysteresis 文件](MOTION_HYSTERESIS.md)記錄 9/9、合跑67/67、隔離29/29且 source hash 相符；本輪未找到相應獨立 raw log／manifest 連結，故只採作文件與 source 證據。

## 51 項對照

下列「剩餘」只保留該項未覆蓋的驗收或目前版本複驗；沒有要求另增 P2 功能。數值／domain 已驗部分與產品鏈缺口分開，避免因整合尚未結束而重做已完成工作。

| Requirement／優先 | 現有實作與直接證據 | 整項狀態／精確剩餘 |
| --- | --- | --- |
| V1-SYS-01／P0 | 正式 React/R3F/Vite、Scene/Rapier/WebAudio 入口；E08 畫面、E12 固定 production build、E13 精確依賴與 notices。 | **PARTIAL**：乾淨 `npm ci`→完整 `check`／build／license 的當前固定 stdout/exit；保留原研究 scripts。CI wiring 存在不等於遠端 CI 已跑。 |
| V1-SCN-01／P0 | `src/scene/validate-scene.ts`、`tests/scene/`；原 schema/literal acceptance 未變；E07 真 Host 非法 authoring 與原子拒絕。 | **PARTIAL**：目前完整 Scene 正負例套件的最終可追溯執行結果併入總 gate；不以研究 V0 取代正式 validator。 |
| V1-SCN-02／P0 | Scene transaction／stable IDs／revision／Undo；E07 拒絕 mutation、Undo/Redo 與 deferred transaction lease 等獨立結果。 | **PARTIAL**：保留原 `scene-host-acceptance.mjs` 的固定結果並完成目前 Scene regression；v4 後 runtime 有變，須最後複驗。 |
| V1-SCN-03／P0 | E04 真 mount/reset/export/import/dispose counts；E07 metadata／source metadata roundtrip；generation 序列化已修。 | **PARTIAL**：目前 bootstrap／runtime 的全來源穩定 lifecycle 重跑；舊 E04 sourceStable:false 不升格 current PASS。 |
| V1-PHY-01／P0 | E02 真 cadence／120-tick states；互動四步上限與丟 wall-time；[overrun GREEN](../../artifacts/v1/recording-overrun-green-20261027/verification.json)保存30tick連續錄製及明示 Resume/Stop。 | **PARTIAL**：最新完整 matrix／overrun 複驗；E12 產品頻繁安全 pause 的功能／性能原因與完整鏈仍須解決，不放寬政策。 |
| V1-PHY-02／P0 | E02／E04 四 modes；E03 Unlock actual-pose clearance；E07 gravity-only 改動保 v/ω、epoch、native source identity/cursor。 | **PARTIAL**：現行29案＋目前 browser lifecycle；不得用較舊 matrix 代替新 KeyF／apply guard 全套。 |
| V1-PHY-03／P0 | 真 capsule、wall、diagonal、sprint、spawn/new obstacle cases；E03 lock gate；E08 native lock／替代操作。 | **PARTIAL**：未找到 slope／doorway 的直接案例；補當前真角色與 browser 證據，不能只因設定 climb angle 算通過。 |
| V1-PHY-04／P0 | E02 24案：0.1/1/5/20kg×薄牆/角落/堆疊×Gravity/NoGravity，15Hz render、240ticks；dynamic identity／有界 impulse/torque／blocked 記錄。 | **PARTIAL**：核心數值範圍已有通過；目前 matrix test 及 wrapper 已變，需最新固定執行。觀測 penetration 非零，不寫零穿透或未定義通用容差。 |
| V1-PHY-05／P0 | 真 NoGravity Drop 保動量、Throw explicit command 去重／speed cap；E03 lock acquisition barrier；E08 acquisition click 無 Throw。 | **PARTIAL**：缺正式產品 CCD／高速 Throw 對薄牆的固定結果；profile 啟用 CCD 不代替正確性案例；E12 未達 Throw。 |
| V1-PHY-06／P0 | E03 Held freeze／generation／held-key guard；E07 Pinned Listener 還原；E08 Enter/Tab pause/resume。 | **PARTIAL**：目前原生 blur／hidden／composition／focus 及既有 Held 清理複驗。scripted composition 必須標 fixture，不冒稱 Windows IME。 |
| V1-BLD-01／P0 | E03 真 Ghost/Staged/ack/Enable、overlap／連點／stale ack／cancel／失敗恢復；E08 替代操作真放置。 | **PARTIAL**：目前 Host／root 接線及 browser 放置複驗；原子 counts、明示 Enable／Resume 保留。 |
| V1-EVT-01／P0 | 真 contact impulse Ns／pre-step v+ω×r／world witness；contact-emission、motion corner 定位；E07 同tick Impact→AcousticFrame。 | **PARTIAL**：尚缺完整獨立 multi-contact／旋轉點速度／collider ordering／local→world normal 數值矩陣；未知 force 仍 null，不能以 Ns 補 N。 |
| V1-EVT-02／P0 | 真 falling impact／resting support／mode invalidation、bounded episode/cooldown；motion hysteresis／generation 清理已有 source 與分項結果。 | **PARTIAL**：raw fixed evidence 補齊 microjitter／multiobject／held-wall／CCD／replay invalidation，保留 audible drop 與 raw trace 分離。 |
| V1-SND-01／P0 | E01 40項核心 fixtures；排序／去重／binding state 正交；E07 logical onended clock、AlwaysOn／gravity-only continuity 已獨立修復驗證。 | **PARTIAL**：domain 範圍已驗；目前 Root 全套及真產品抓投→碰撞→continuous 鏈仍待完成。 |
| V1-SND-02／P0 | E01 mapping clamp、finite／引用／revision／asset 負例；editor 擴充具 canonical curve／override／stale stamp validation。 | **PARTIAL**：核心 hashes 仍相符；新增31項 authoring 回歸需納最終當前套件與固定結果，不能只沿用舊20項。 |
| V1-SND-03／P0 | E01 deterministic priority/stable-ID admission；E06 voices/sources/paths/decoded/pending budgets、burst與cleanup。 | **PARTIAL**：產品 telemetry／over-cap 生存期及 consumer 成本的當前 browser 證據；Node cap 不宣稱 realtime 容量。 |
| V1-SND-04／P0 | E01 snapshot／epoch／golden replay；E07 preStep 狀態、B cursor／StopReplay continuity；v2 source-phase 驗證拒絕重建相位。 | **PARTIAL**：當前 recorder／Root 最後回歸與 recorded-output／B 的完整產品 seek/pause/resume；AudioEngine cursor 不是硬體 read pointer。 |
| V1-SND-05／P1 | bounded latch／materialpair layers evaluator；[motion hysteresis](MOTION_HYSTERESIS.md)已由 fixed step 保存狀態並分離 Rolling/Sliding/Spinning。 | **PARTIAL**：將文件記錄的9/67/29項結果補上 raw artifact；rotating support／slip／Held／mode／CCD／latch／layer 真 trace 整合驗收仍需完整覆蓋。 |
| V1-SND-06／P0 | E06 真 WAV decode／bounded oscillator／PCM bank；E09 trusted encoded SHA／rights receipt／builtin regeneration／relink；E07 import保pin。 | **PARTIAL**：完整產品 fresh reload／原檔改名 relink／sample playback；E12 尚未走到這段，不把 native API fixture 當 UI E2E。 |
| V1-SND-07／P0 | E08 draft跨選取／失敗保留、custom curve、binding override Apply/Clear/Undo 真Chrome；E07 atomic drain／revision／Undo。 | **PARTIAL**：目前Root／AnalysisDock改動後的作者完整複驗；舊丟draft已修，不再列FAIL；shared profile／pins仍依固定驗收。 |
| V1-ACO-01／P1 | E05 29 solver literals＋真Worker，direct r/c、1/r、finite occlusion、dynamic blocker；E08 atmosphere改真path。 | **PARTIAL**：數值範圍的 current source 已通；目前產品 source/listener 移動→真 Inspector 的完整鏈待併入最終 browser gate。 |
| V1-ACO-02／P1 | E05 finite first-order ISM、polygon外／blocker、stable IDs／arrival direction／1mm continuity；core hashes相符。 | **PARTIAL**：不需增加二階或任意mesh；目前產品 path selection／stale 顯示複驗待完成。 |
| V1-ACO-03／P1 | E05 energy A+R+T／scattering／air conversion／medium負例；Synthetic材質與固定air近似明示。 | **PARTIAL**：限定模型數值已驗；當前產品 tags／vacuum與gravity正交的最後browser回歸。沒有ISO conformity或Measured主張。 |
| V1-ACO-04／P1 | E05 request/response IDs／revision/tick、取消/timeout重建、bounds/backpressure及telemetry；Root現有pose-age拒絕與stale標籤。 | **PARTIAL**：transport本身current PASS；Root consumers與目前世界age／空結果／unsupported的完整產品驗證及總delivery成本尚待。 |
| V1-AUD-01／P0 | E06 native arrival／gain／direction一次處理；E07 真contact world emitter→同tickframe；無audio旁路。 | **PARTIAL**：renderer數值已驗；目前scene→Throw→Impact→native sample聲鏈及保存後重播未完整通過，E12 Throw=0。 |
| V1-AUD-02／P0 | E06 native source/path identity與ramp／birth/death/cleanup；E07 NoGravity切換不重建source；callback不改logical state已GREEN。 | **PARTIAL**：目前產品運動／碰撞／抓投連續性與realtime soak；native數值不等於硬體無click/pop。 |
| V1-AUD-03／P0 | E06 Freeze-and-fade、logical offset／pending arrival／epoch；E07 Replay/StopReplay控制圖，v2cursor歷史。 | **PARTIAL**：目前產品 pause/seek/reset 的 native graph／recorded-output完整鏈與額外Replay分支複驗；不宣稱filter-state波形無縫。 |
| V1-AUD-04／P1 | E06 Raw/Simulated same source、audio-clock crossfade、Synthetic unit-energy late IR、normalize=false；E08實際控制與標籤。 | **PARTIAL**：renderer範圍已驗；目前產品route切換／IR bank與run不變的最後browser回歸和性能。 |
| V1-UX-01／P0 | E07 workspace不Reset／recording不中斷、metadata／transport、E08 export/interrupted capture；過載政策已修保存debt。 | **PARTIAL**：目前recording-host／runtime完整workflow；E12頻繁pause仍阻礙完整演示，不能以安全停止當流程完成。 |
| V1-UX-02／P0 | stable object/path/event selection；只畫solver paths；INT-15 saved ObjectView已targeted GREEN，StopReplay保live state。 | **PARTIAL**：新增legacy/malformed/held與最新owned suite待獨立複驗；排序／刪除／stale selection與能力標籤併入current browser。 |
| V1-UX-03／P0 | E08真lock／Tab／Enter／替代操作；input policy／repeat domain cases；原生專用runner已建立。 | **PARTIAL**：native accessibility cases尚NOT RUN：composition boundary、contenteditable/modal、repeat、原生分頁hidden、無gesture lock拒絕。真正OS IME仍另驗。 |
| V1-UX-04／P0 | E08 13案含曲線／override／draft／Apply；unsupported Bounce/Zone新增選項已停用且有原因。 | **PARTIAL**：目前source的browser回歸；contact emitter／抑制／voice原因、audition/3D/run分離的完整可操作診斷證據待彙整。 |
| V1-UX-05／P0 | E08 native controls、320CSS/reflow、ReducedMotion、實際截圖；tokens使用canonical來源。 | **PARTIAL**：原生200%zoom／dialog focus-return完整keyboard證據目前NOT RUN；720viewport與DPR模擬不替代。 |
| V1-UX-06／P0 | 預設muted／gesture Enable、常駐Mute/gain、E06監聽state、E08真控制；dBFS不標SPL。 | **PARTIAL**：目前產品autoplay／blocked/error/source-stop分離及Mute不停止simulation；真聲音／人工聽測保持獨立限制。 |
| V1-RPL-01／P1 | immutable frames/raw events/config hashes/chunks；E07保存refs、onended不吃logical state；過載GREEN30ticks，E12失敗錄製68ticks連續且驗hash。 | **PARTIAL**：目前版本完整capture／finalization／容量及cancel/crash負例固定結果；失敗診斷的完整68frames不代表完整演示captured。 |
| V1-RPL-02／P1 | authoritative MotionReplay、不重跑physics；E07 late capture、seek/epoch／native cursor、INT-15 historical view已GREEN。 | **PARTIAL**：最新replay分支與完整產品durable reload／seek／resume sample source證據；不能以motion播放代替recorded-output聲音。 |
| V1-RPL-03／P1 | E02兩個獨立真World，同初始公開snapshot／seed／建立順序／dt／intents，各120ticks逐tickstate SHA相符，觀測差0。 | **PARTIAL**：所要求的同機WASM證據已有；目前擴充matrix整套固定重跑及fresh-run provenance收錄。不得推native binary snapshot或跨平台bitwise。 |
| V1-AB-01／P1 | compareRecordings固定motion/source/phase/listener/geometry等，E07同trace B真重評；v2反相位重建守門；E10真experiment runs。 | **PARTIAL**：目前source-phase／recorder／Root完整回歸；產品完整同motion材質B與持久化E2E尚未走完。 |
| V1-AB-02／P1 | 真B可停用規則且保raw motion/event；behavior variables與propagation分開；source-phase logical/native證明分級。 | **PARTIAL**：目前fresh回歸／雙方原始artifact與UI解釋；不因profile/source變化宣稱房間RT改善。 |
| V1-MET-01／P1 | recording metrics從captured solver paths算Computeddelay/pressure²，缺IR的RT60/DRR/C50回null；E10／E07真artifact守門；原decay解析fixtures保留。 | **PARTIAL**：目前metric／tamper／insufficient-data套件固定結果與產品grounding；普通音樂不送進RT估算，沒有V5量測主張。 |
| V1-AI-01／P1 | 原12enum未擴；safeSceneHost preview/apply/undo；E07 source sidecar／stopped default與真正Run；E10 immutable run／cancel／budget。 | **PARTIAL**：當前完整host/run regression及手動同流程E2E；舊stub已被真executor替代，不再標全unsupported。 |
| V1-AI-02／P0 | 五Sound operations與12tools分離；trustedpins/revisions/generation／derivedpins／Undo；E11真提案通過Host，E07本機負例。 | **PARTIAL**：minimal live已實證；目前全部五operation正負host／registry套件的固定總結果及產品作者串接驗收仍需彙整。 |
| V1-AI-03／P0 | provider strict adapter＋本地AJV、12turn/48call/6run/120s／零付費預設／分類backoff；E07矛盾READY拒絕；E11保留400與額度ledger。 | **PARTIAL**：當前完整fixture故障注入／budget套件與session狀態證據彙整；本次授權三次live請求已用完，不以新呼叫修報告。 |
| V1-AI-04／P0 | E10真artifact/metric refs／null reasons；E07 completed/failed/pending來源守門；E11真capture/analyze、模型與Host責任分開。 | **PARTIAL**：目前grounding/tamper套件及手動fallback產品鏈；沒有聲稱Meta產出未回傳的數字、global optimum或PCM。 |
| V1-AI-05／外部 | E11已具真model/response ID、保存tooltrace、合法Sound提案→HostApply→真本機run/results；catalogue GET200、Sound200及US$1授權ledger支持實際存取與有限預算。 | **PASS（本項最小Sound切片）**：已符合固定文字要求的真Meta proposal→合法behavior→run artifact；Task0007 AC-02及Task0014 AC-02的這個範圍已有直接證據，不能因資格AC-01仍BLOCKED而否定它。Scene live、Meta規劃Run、UIlive、五operation全部live不是本criterion新增門檻，仍分別NOT RUN；不擴稱通過。實際billing/餘額未知，不自動擴張付費授權。 |
| V1-VAL-01／P0 | 61/61保護hash及原Taskcriteria本輪相符；E01/E03/E07獨立review與RED→GREEN有raw結果；舊失敗保留。 | **PARTIAL**：最後來源固定後跑原回歸＋全新產品套件，保存所有command/exit/stdout/stderr/source hashes並獨立接收；不能由本表代替。 |
| V1-VAL-02／證據 | E06真DSP、E08局部Chrome、E04 lifecycle、E09storage均有直接結果。 | **FAIL／完整鏈未通過**：E12最新lightdiagnostic仍exit1／Throw0。需解決觀測負載與產品成本、保留原政策及失敗，再完成三次乾淨scene→throw→impact→sound→capture→A/B及durable reload。 |
| V1-VAL-03／證據 | E06有限nativeDSP／mutedclock；Chrome156，SwiftShader UI/worker環境明載。 | **BLOCKED／NOT RUN**：實際耳機／觀察者／硬體聽測、end-to-end latency及SPL未驗；跨browser可自行排程但尚無通過結果。不能將離線PCM或native graph升級V5。 |
| V1-VAL-04／證據 | 性能runner／分項telemetry與E05短Workerprofile；E12失敗短診斷記成本。 | **NOT RUN（正式profile）**：未找到600s結果。需固定硬體/viewport/scene/voices/paths、UI main wall occupancy、256body physics、8source/32surface worker及實際consumer delivery；native nodes不冒稱Workletp99/underrun。 |
| V1-OPS-01／P0 | 既有Task0006／0011–0014、0016–0020；Wiki/Now／progress及sources已更新；M0 DONE與原history保留。 | **PARTIAL**：原criteria逐項附存在且hash吻合的結果、claim處理、最後checkpoint/handoff與fresh reader、本地Gitcommit尚待；不push/deploy。 |
| V1-COM-01／外部 | E13依賴inventory／Notices／license hashes；程序音內容與使用者WAV receipt；未採未授權外部音檔/HRTF。 | **PARTIAL／外部BLOCKED**：目前package/scripts變更後inventory freshness及實際發行檔通知再核；本人資格／登入條款／提交欄位、rootLICENSE／發布決策未解除。工程通過不等於競賽合規。 |

## 下一批驗收與外部門檻

既有 [Task0017](../../knowledge/tasks/RLAB-TASK-0017.json)負責物理／互動／接觸邊界，[0018](../../knowledge/tasks/RLAB-TASK-0018.json)負責聲學與傳輸，[0019](../../knowledge/tasks/RLAB-TASK-0019.json)負責錄放／資產，[0020](../../knowledge/tasks/RLAB-TASK-0020.json)負責完整browser／性能／乾淨啟動；[0016](../../knowledge/tasks/RLAB-TASK-0016.json)仍按51項整體結案。不另建backlog、不重做已驗的domain或renderer。

1. 先完成當前整合修復的獨立複驗，核對新Replay分支、物理29案／lifecycle、原生輸入／zoom，以及完整產品鏈。E12需保留為FAIL；不能為走完流程改錄製catch-up或丟ticks。
2. 固定來源及重負載窗口，完成正式600秒profile與分項成本；不足600秒或不符合指定負載只記smoke／NOT RUN。人工聽測與無法觀測的audio deadline另列。
3. 完成乾淨安裝、目前全部quality gates與license freshness；同步requirement結果／Task evidence／Wiki／handoff，再建立本地Git恢復點。各舊artifact仍保留其testedbytes。
4. 真Meta最小Sound成功與未驗切片分開。已達本次live請求上限，不再消耗資源；本人資格／條款／根LICENSE／發布與實際聽測仍需要各自外部證據。這些限制不能阻止前述可做工作，也不能由Mock解除。

本頁是帶版本界線的接收盤點，不是第一版完成宣告；後續新結果應另記時間與artifact，不把本次FAIL／NOT RUN或原始證據改寫成從未發生。
