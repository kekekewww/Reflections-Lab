# 已知限制與解除條件

## 2026-11-02 核心、區域／曲面與目前驗證界線

基本功能已由使用者確認正常，不重複要求R18/R21基本操作測試。下方各歷史截點的「等待基本真人重測」由此確認更新；不得擴大成新增六項、科學/裝置或性能逐項通過。見[核心契約](14-core-pipeline/IMPLEMENTATION_CONTRACT.md)與[階段證據](14-core-pipeline/STAGES.md)。本節的區域、三形狀聲學與動態反射現況取代下方 R20／R17 同能力的舊限制；各日期歷史原文保留，不能讀成目前仍停用。

- Evaluation佇列8frames/32MiB只約束保留輸入/回覆容量，非總JS heap/GC。reference的timer不能搶占同步JS；真module Worker與501固定bundle的短take管線已有分項收據，不外推其他版本、總heap或性能。
- 診斷屬control-thread觀測；128樣本ring與500ms native polling，unsupported/warmup/reset/未觀測保留null。沒有native DSP CPU、PCM gaps、resident memory或SPL量測。delay1e-6秒/position1e-4公尺deadband是近似策略，非exact去重。
- Bounce 僅對未移動／未旋轉 Fixed 支撐的 Tuned 子集，不涵蓋動態對動態支撐。Zone 已有真 producer：Derived 固定步物件中心 AABB／sphere occupancy，最多16區域×256 poses、單步總事件2048；使用 hysteresis，首次／teleport／registry變更只建立基準，快速 outside→outside 穿越可無事件，沒有 collider-overlap 或 swept CCD。停用不刪除 ID／中心聲源錨點，見[Zone 交付](15-ui-parameter-audit/zones/HANDOFF.md)。
- 箱／球／膠囊可遮擋或反射；dynamicReflector 使用 snapshot 真 pose，非 Fixed 的 staticSurface 仍只遮擋。共用256項幾何預算，曲面鏡射位置為有界數值近似；沒有聚焦／caustics／curvature divergence、retarded-time／移動邊界 Doppler、完整波動或厚牆穿透。新 scene-wide model／emitter policy pin 不符的舊 fixed capture 不能冒稱可重新求解，既有 Replay 仍可播放原資料，見[模型契約](15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md)。
- Motion Dynamic servo 為 Tuned 控制，最多8同時控制器／每物件1個；registry最多64動作不是64並行。Kinematic 無加速度作者曲線與 rotational swept-volume CCD，進階 trajectory 只能經合法 JSON 匯入，UI未提供該編輯器。
- Renderer上限為30秒發聲、45秒context、16outputs、工作估算256MiB/輸出192MiB，不保證browser內部峰值。listener replacement、asset HRTF、純late tap、state-preserving長chunk、ADM/cloud仍unsupported；control在native quantum邊界更新，不宣稱sampleScheduledControls。
- 最新五WAV為48kHzstereo／5秒且原2e-6stems sum容差通過。mix／dry／stems是IEEEfloat32pre-master，可超過±1且不hiddennormalize／clip；manifestpeak／outsidecount須精確，安全master另驗0outside。all5historyIncomplete=true／preRoll0是有限前置DSPhistory，不冒完整nativeDSPstate。實體WAV／部分大trace在Dexports與ignoredcache，非全部Gitcontained。
- Meta本輪fixture/offline、預算0；持久ledger不是帳單或多人雲端auth，沒有新live或餘額核實。
- Root品質、真DOM匯出與本機main已有最後收據：[完整check](15-ui-parameter-audit/evidence/FINAL_FULL_CHECK_FAD14CC_20261102.json)exit0、[本機正常整合](15-ui-parameter-audit/evidence/MAIN_FIRST_FAST_FORWARD_20261102.json)實際 `fe663ca9f384d247bcd89b331936f6be202c761f`。Task24..31含28有限DONE，Task23只因原nativeAC04URLpolicy外部gate列BLOCKED；Claude獨立重驗仍NOTRUN，為下一階段。217／217finitefamily已收據join、0pending，71Help中68公開可達PASS／3條件未觀測，不是無限值組合或單一501全重跑；最新真Combined／Stage12五WAV獨立RIFF已PASS，見[收據](14-core-pipeline/stages/12-final-integrated-ui-audio.md)。49bde 曾重現的 controlled short-take clock debt 真產品 FAIL 已由9fcf修補並以[真DOM重驗](15-ui-parameter-audit/evidence/CONTROLLED_CLOCK_UI_RETEST_9FCF3F0_20261102.json)通過：自然過載前綴5 ticks後，新的受控180 ticks連續且可重播。原過載保護與性能限制保持，這只證受控單步正確，不推即時性能健康。前三次原生app approval timeout／0input為歷史；[第四輪](15-ui-parameter-audit/NATIVE_FINAL_RECHECK_20261102.json)真Ctrl+N建立使用者允許的獨立視窗成功，之後工具因WindowsURLpolicy停止，未完成產品導覽／匯出。不能說第四次timeout或所有native輸入皆0；Task23AC04字面gate仍false／PARTIAL_EXTERNAL_NATIVE_URL_POLICY，與真DOM／數位WAV分開，見[方法分類](15-ui-parameter-audit/NATIVE_GATE_CLASSIFICATION_20261102.json)。Claude 尚未執行；原600秒 FAIL／trace缺口與科學、Hi-X65／D3V專項／外部條件不被基本結果解除。
- Wiki 初次 junction 拒絕與 sparse 缺檔 FAIL 保留；完整 checkout 與來源版本修復後已取得0 errors截點，後續每次修改仍須另檢，不放寬 safe。舊未提交UI報告僅有觀察hash和原測試收據，完整preimage未能重建，不能補造其Git版本。
- 舊樹只在可安全範圍完成封存／移除；C primary 仍為 Codex attachment，R21[最新唯讀查](15-ui-parameter-audit/evidence/R21_FINAL_READ_ONLY_RECHECK.json)只broker20952alive／descendants空但jobs未知，故保留；[歷史parentPID重用與舊subtree](15-ui-parameter-audit/evidence/R21_ORPHAN_HELPER_AUDIT.json)不冒現況。private archives 不入 Git；不繞過 auto-review、發 shutdown IPC 或殺不明 process。

## 2026-11-01 R21 第一人稱操作、音訊與介面說明的限制

依使用者 2026-11-01 回報（[R21 回報](11-v1/USER_TEST_FEEDBACK_20261101-r21.json)）與[驗收補充](11-v1/ACCEPTANCE_AMENDMENTS.md)修改；全部證據仍是 headless Chrome、CDP 輸入與程式碼審查，真人重測待做。下方 R20、R19 與 R17 的限制保留，但 R20「按 B 進入建造」一項已由右鍵放置取代。

- 第一人稱：左鍵抓取／投擲、按住右鍵預覽放開放置，空中放置預設 `dynamicNoGravity`，放置後自動啟用並維持原本運算狀態。錄製（含暫停）與重播期間拒絕預覽與放置；音訊引擎重建期間也拒絕放置。實體滑鼠的右鍵放開、真人 Pointer Lock 與 Esc 在真實瀏覽器中的行為未經真人驗證。
- 音訊斷續：音訊由瀏覽器音訊執行緒以原生節點渲染。R21 加入「音訊緩衝」預設（預設「穩定」）、只用於聲音開始時間的排程餘裕、輸出中斷計數，並移除每個物理步重複設定的參數自動化。headless Chrome 20 秒量測（[R21 音訊量測](../artifacts/v1/r21-audio-smoothness-20261101/)，不含擷取器，最終兩輪）：編輯器場景輸出中斷由 R20 的 19 次（185 ms）降為 1 次（12 ms），第一人稱走動由 14 次（143 ms）降為 1 次（10 ms）。這是單一機器的 headless 數據，`playbackStats` 由 Chrome 提供；使用者的 Brave 與實際裝置聽感待真人回報。
- 主執行緒負載：headless 下主執行緒每 20 秒仍有約 3.4～6.4 秒長任務（主要是 SwiftShader 軟體渲染），物理約以 0.93～0.97 倍即時速度推進（R20 約 0.64 倍）。R21 已讓狀態發布每幀最多一次並限制追趕通知，但物理與互動仍在主執行緒。若真實 GPU 瀏覽器上仍卡頓，依[效能與緩衝研究](13-performance-review/OPTIMIZATION_ROADMAP.md)的排序先做音訊斷續與成本歸因（RLAB-TASK-PERF-20261101-001），再依數據決定下一步；物理模擬移到 Worker 是其中的 P2 候選（RLAB-TASK-PERF-20261101-009），需要先有歸因證據，這輪沒有實作。研究以 R20 程式為基準，與 R21 的逐檔對照見[合併對照紀錄](13-performance-review/R21_MERGE_RECONCILIATION.md)。
- 介面說明：35 段說明文字改為 ⓘ 懸浮提示（滑鼠懸停與鍵盤聚焦皆可開啟，Esc 關閉，螢幕閱讀器仍可讀到）；欄位名稱、數值、狀態、錯誤、安全警告與證據標籤保留可見。完整參數說明移到[參數設定參考](11-v1/PARAMETER_REFERENCE.md)。觸控裝置與螢幕閱讀器的實際操作未驗證。
- 尺寸欄位：球體改為單一「直徑」，膠囊為「直徑＋高度」；變形工具最小尺寸 0.05 m 與 Inspector 0.01 m 的差異保留。

## 2026-10-31 R20 自動重測後的限制

依[完整測試流程](11-v1/FULL_TEST_PROCEDURE.md)以 Playwright（headless Chrome、CDP 輸入）自動重測，紀錄見[自動重測](../artifacts/v1/agent-retest-20261031/verification.json)與 [R20 修補](../artifacts/v1/r20-retest-fixes-20261031/verification.json)。這不是實體鍵鼠、真人 Pointer Lock 或聽測驗收；下方 R19 與 R17 的限制全部保留。

- 曲面物體不進入幾何聲學：球體與膠囊不遮擋、不反射，聲學材質與角色對聲線沒有作用；Inspector 現在對非方塊停用這兩項並明示原因。預設場景的 `ball` 仍保存「動態遮蔽物」角色資料，但不產生遮擋。曾試作以內接方塊近似曲面遮擋，因 105 物件場景會超出 256 面的幾何預算、且每幀求解成本增加而撤回；是否加入曲面遮擋並明示超出預算時的降級，需另行決定。
- 狀態列語言：runtime、互動與錄製主機的帶參數訊息（互動追趕上限、音訊 admission、專案載入、音檔保存與各種失敗）已有英文；其中嵌入的未知細節仍以「Original technical detail」標示保留原文。AI 提案、實驗工具等其他模組的說明文字尚未逐一盤點。
- 互動結果：固定／解除固定、建立待啟用、啟用、輕放與失敗原因在暫停時成為狀態列的暫停原因，繼續運算後清除。按 B 進入建造時與「切換建造」一樣開始方塊放置預覽，離開建造會捨棄未確認的預覽。
- 錄製負載：headless Chrome（未驗證 GPU）中，錄製會反覆因固定步負載超限暫停；同日結果差異很大，早先 6.1 秒牆鐘只錄到 0.82 秒，最終重跑 15.8 秒錄到 9.58 秒並暫停 6 次，原因未確定。這與 R17 的600秒性能 FAIL 一致；真實 GPU 瀏覽器上的錄製長度待真人回報。

## 2026-10-30 R19 當前限制

產品截點 `5e56260b1a9242e29c4afe6ce393bd8a37986320` 修補 R18 真人回報，並處理 Codex 四輪對抗審查找到的缺陷（第一輪六項缺陷與一項過載風險、第二輪兩項重大與一項次要、第三輪一項重大的重新掛載缺口、第四輪一項次要的提交中選取競態）；證據見 [R19 驗證紀錄](../artifacts/v1/r19-r18-repair-20261030/verification.json)。下方 R17 的性能 FAIL 與其他限制全部保留，本輪沒有放寬原驗收、刪除失敗測試或修改 reference。

- 第一人稱：真實 Chrome（Playwright headless 與 CDP 輸入）已證實進入點擊即可移動與轉向、Enter／點擊繼續、Esc 後點擊重新鎖定，以及固定／放置安全暫停後可繼續。這不是實體鍵鼠或真人 Pointer Lock 驗收；R18 第一人稱項目、抓投、建造與 FPS 聽測在真人重測前仍是 BLOCKED／未測。
- 直接操作：只涵蓋編輯器中選取物件的移動／旋轉／縮放；Listener 與聲線沒有拖曳工具、沒有鍵盤快捷鍵，球體只能等比例縮放，運算或重播中不可拖曳。已驗一次拖曳只產生一個 revision、可復原；Esc、指標取消、失去捕捉或視窗失焦都會取消且不提交；前一次提交完成前（含切換工具或畫面重建）不會開始下一次拖曳，點選也不會改變選取；若提交的 Promise 永不結束，gizmo 會維持停用（審查只以人為注入重現，未發現實際路徑）；視覺品質與易用性未經真人確認。
- 音量：預設 monitor 0 dB、主混音 headroom −6 dB、控制範圍 −40 至 +12 dB，limiter 仍在 −3 dBFS，之後加輸出安全上限；極端壓力案例（規則增益 4、緊貼 Listener、+12 dB）由 +3 dBFS 降為約 −0.3 dBFS 且無全刻度樣本。量測只代表 AudioContext 數位電平（預設場景峰值約 −28.7 dBFS），不推估裝置、DAC、作業系統音量或 SPL；預設是否合適待真人回報。
- 介面：三維畫面的修訂版本、座標、聲線圖例與阻擋候選已收入「視圖資訊」；其他面板的說明量、版面比例與整體資訊層級尚未系統整理，需真人回報方向後再做。
- 舊測試入口：`npm run test:browser:ui`（舊 ui.spec）在基準 `a5f2a90` 與本截點同樣 8 項失敗、5 項通過；`npm run test:browser:product` 的原始流程在兩者都 4 項失敗。兩者早於 R17 按需展開介面；現行入口 ui-refined-v2、pointerlock-race、run-product-refined-v3 與 linked-workflow-v2 已通過。舊入口失敗保留為紀錄，沒有刪除或改寫。

## 2026-10-29 R17 當前限制

產品截點 `cde1e2b0ed7c57228bfa64b01c262b6eeab3cba1` 已有完整檢查與當前瀏覽器證據。下方 r11 舊截點保留為歷史，不能拿其計數或200%項目當作目前門檻。

- 完整 `npm run check` 實際通過，2267個輸入前後一致，包含668一般及981執行期測試；其他明列流程、型別、格式、建置、授權清冊與英文檢查亦通過。當前瀏覽器連動8、UI／FPS28、產品4通過。原三次乾淨app contexts已有完整鏈；額外三個獨立程序為2PASS／1FAIL，等待碰撞時用盡恢復預算的原失敗仍保留，不宣稱普遍可靠。
- [C4正式量測](../artifacts/v1/r17-formal-c4-20261029/native/verification.json)保存600.051秒UI視窗、19498影格、完整trace與來源／硬體資訊，無記錄到trace資料遺失。這是負面性能證據：physics p95約4.8ms，觀測到的default／stress delivery約12.4／28.7ms，renderer-main wall occupancy p95約83.23ms，原目標不變。完整delivery仍有未量區段；native nodes不冒稱Worklet deadline、裝置延遲或聽感。
- UI量測有1222次overrun、106.117秒interactive dropped wall time、錄製超載安全暫停；結束時仍有pending，最後capture未在窗內完成。窗外排空成功不能回填。default／stress有130／226個20Hz deadline misses，stress量測170次path drops；不宣稱指定持續負載或容量性能通過。這些profile是本機受量測工具影響的特定配置，不能等同預設六物件場景的體驗。
- 刪除選取、真空狀態、重播環境及有界Grab確認已修補並有回歸／當前browser證據。正常100%比例、實體第一人稱／Pointer Lock／IME與Hi-x65／D3V聽測仍需真人；200%已明確移除。R6聽測工具的30純測及14HTTP／零AudioContext無聲驗證通過，不代表聽測通過。依[真人指引](11-v1/HUMAN_TEST_GUIDE.md)測試。
- 原生Chromium25與IRv2只按當前未改核心pins沿用；Firefox原嚴格能量FAIL及WebKit能力限制不改成成功。真空不抹除機械碰撞；聲學維持有限面一階、Synthetic材質及明示的數值／聽感近似。
- 既有真Meta Sound提案→preview／Host Apply→180ticks／181frames支持原最小整合；當時執行程式的完整hash綁定未追回，不能宣稱現行fresh live或完整歷史／現行等價。Scene live、模型規劃Run及產品UI live未驗，不自行新增為原門檻。原US$1／3 slots已用完，帳單及剩餘額度UNKNOWN；本輪沒有新付費呼叫。
- [目前交付封存](../artifacts/v1/r17-final-delivery-20261029/manifest.json)的278份payload及14個正式web檔案已逐bytes核對。已知第三方通知及正向辨識的Rust文字保存，四個tooling缺口與正常web交付分開；最佳化WASM其他linked notices適用性仍UNKNOWN，不冒充完整法律審查。專案根LICENSE、本人資格／登入後條款與任何發布授權仍由使用者確認。

## 2026-10-28 r11 歷史限制

正式Web、物理互動、Sound Behavior、聲學Worker、Web Audio與持久化已有當前來源的實作及分項證據；[r11 checkpoint](11-v1/SESSION_PROGRESS_20261028-r11.md)記錄實際PASS／FAIL／NOT RUN。[原51項驗收](11-v1/ACCEPTANCE.md)未放寬，完整第一版尚未完成。

- 當前028b E2E建置的UI27、physics2、storage5、product4通過；另外Node46與原Worker4案例實際均通過，但執行安排原預期3案，外層選擇數量檢查失敗，相關錯誤與已驗證的舊輸出還原完整保留，不宣稱原選取計畫成功。產品4案涵蓋三個fresh contexts及WAV重連，不代表OS重開或人工聽測。Inspector抑制原因、獨立靜態3D preview及持續聲源support anchor修補已有回歸／當前UI證據，舊「尚在修補」摘要已失效。
- 當前cached Chromium headless shell的原生音訊25項及IRv2三項／六renders通過，雙聲道PCM差異0；舊IRv1 reference初始化FAIL與cold Vite逾時保留。Firefox為8PASS／1原能量FAIL／9capability BLOCKED／7NOT RUN；WindowsWebKit為25capability BLOCKED，不推成Safari或全面跨平台支援。
- 本輪正式profile實際628.935秒、1789來源前後相同、原生結束碼0及清理核實，但性能FAIL／負載不完整：physics core p95 2.2ms、完整tick含copies12.5ms、default／stress delivery3.9／14.4ms；原目標不變。UI含safe-overload暫停與欠帳，原membership檢查失敗使main occupancy NOT RUN，沒有加入epsilon或修改舊結果。worker功能契約ACO04與性能VAL04分開判定。
- 本輪NativeV2兩次都在hidden前置檢查失敗，200%／320CSS／Pointer Lock尚未驗。使用者已回報桌面喚醒；官方工具reset後仍在app操作前發生kernel assets os error3，原因未確定，不能推定桌面鎖定或產品退化。舊0eef native PASS只是歷史。
- Hi-x65與D3V目前是使用者回報的型號；專用localhost session完成preflight及arm，但30分鐘等待結束仍無選取／attach量測的App context或使用者聽感報告，現已封存並關閉。18:56的最後status記capturedContexts0；不推斷其後未觀察的使用者行為。actual route／sampleRate／block與聽感仍未知。47項pure工具測試、離線PCM與headless UI不代替聽測；native nodes不冒稱Worklet p99、裝置latency或校準SPL。
- 聲學仍為有限box面的一階幾何近似、動態遮蔽與Synthetic材質；沒有完整波動、繞射、動態反射面或量測材質庫。HRTF／合成late IR、傳播延遲與近似分開明示。
- Meta最小Sound真提案→Host Apply→本機180ticks已通過；Scene live、模型規劃Run與產品UI live各自未驗。US$1授權3請求slots已用完，成功usage按當時價估算US$0.0073235，實際帳單／兩次400費用／餘額未知；未新增請求。Muse Code可用credit為使用者回報，沒有billing核實或自動改executor／提高cap。
- 當前完整pinned check（含917項runtime）與離線prompt benchmark已通過，12份production重建bytes與NOTICE候選綁定相同，該截點258份英文鏡像全current／0 errors；最終文件／Task變更後須再驗證並本地Git保存。NOTICE舊pack有同一WASM的兩個container核對，不能稱兩個不同binary；R3F來源lineage、Rapier Rust closure與四個tooling來源缺口仍保留於候選pack。另有[公開文字取得補充](../artifacts/v1/tooling-license-recovery-20261028/summary.json)：esbuild固定gitHead原文與既有pack文字相同；Rolldown tag／natural作者原文已取回但版本關係未證，humanfs仍404。此補充不改寫舊六項缺口或宣稱binary closure／發行批准。
- 本人資格、登入後條款、公開coding-agent規則、提交欄位、根LICENSE及發布決策仍有外部門檻，未代接受、部署、push或提交。

## 以下為Phase1–Sound研究階段歷史限制

保留當時未實作的限制與解除條件，不能把其中「無正式UI／runtime」當作目前狀態；現況以上方及最新帶hash證據為準。

| 項目 | 真正限制 | 已完成／解除條件 |
| --- | --- | --- |
| 舊專案資產 | 目前工作目錄起始為空，無歷史可審計 | 不搜尋無關私人目錄；若提供舊 repo 再補 provenance |
| 競賽 | 公開規則存在，但賽前自有程式／Codex／商業SDK細則與完整提交表單未確定；帳號資格未查 | 研究與隔離驗證可繼續；使用者核對入選／條款，取得提交欄位 |
| 完整產品 | 沒有正式 UI／renderer／physics-audio bridge／worker／AI executor | 下一任務逐層實作；禁止將 spike 當成成品 |
| 論文／標準 | 部分只有摘要／metadata／索引正文；ISO 全文受限制 | Ledger 逐來源 access level；合法全文或獨立可追溯 reference 才增加精度聲稱 |
| 空氣 | 已測 dB/m 轉振幅；沒有 ISO9613 全係數參考點驗證 | 取得可信 reference，補溫濕壓 sweep；目前不能宣稱 ISO conformity |
| 幾何模型 | 解析 kernel 只有限凸共平面 polygon；無完整 diffraction/diffuse/impedance/wave solver | finite bounds／遮蔽測試已跑；一般 mesh與退化幾何待完整測試 |
| 材質 | Synthetic demo，非量測木材／金屬／混凝土庫；跨 SDK band 不等價 | 合法資料與試驗條件、轉換驗證後才標 Measured |
| Steam Audio | native 小場景通過；未測 leak/sanitizer、動態 geometry、大場景／P95／裝置；無 individual specular paths API | 詳 SDK_VALIDATION；不能從 5ms smoke 推總延遲 |
| Steam WASM | archive 確有；本機沒有 emcc，link/browser/worklet 未跑 | 安裝 pinned Emscripten、依賴裁剪及瀏覽器實測，獨立P2 spike |
| Physics interaction | 基本力學6項 smoke，空場 spring不代表抓取能避牆；CCD有界限 | 牆角／薄牆／高速／重物／低FPS／mode switch需整合驗收 |
| Collision sound | 實測 resting contact持續有 force/impulse；impact事件與sample映射未做 | event classifier／dedup／modal或sample來源標示，不能有力就播 |
| Sound Behavior | 只有架構、draft schema/domain及隔離physics policy／API風險probe；非正式evaluator／SourceGraph／Inspector | 先Task0011再0012，actualaudio／browser／hearing與Meta provider分別驗收；不以JSON合法或數學fixture稱無click/pop |
| Behavior A/B | 換asset/gain/pitch後source signal可變，舊acoustic equality不適用；新analysis adapter未實作 | 明示comparisonKind／自變項，固定motion／raw physics事件／listener／solver，保存雙方hash，不從音樂推RT60 |
| Development strategy | Codex主導；MuseCode optional且0額度，舊Live Harness不是產品前置 | 保留ADR012／Phase3歷史，依ADR013／獨立tests推進；產品Meta API仍需另外live證據 |
| DSP／音訊 | 無實際 Web Audio graph／HRTF／FDN／fractional delay／耳機聽測／設備 latency | V2/V5分階段補；EDC synthetic PASS 不等於聲音正確 |
| 動態傳播 | 只驗均勻介質 subsonic Doppler；無retarded-time root solve | 指明 quasi-static approximation；避免 delay＋pitch雙算 |
| AI | 官方能力與strict限制已讀，帳號／模型存取／live inference／費用／latency未測 | 開通並明確授權有限 API驗證；憑證只server，budget cap |
| Record/replay | 有schema與設計，未實作完整capture/seek/pause/crash/跨平台驗證 | pinned run比對、motion hash相同A/B；不要只錄鍵鼠宣稱一致 |
| UX | 官方文件研究；部分SEARCH_ONLY/LEGACY；無訪談與實機可用性測試 | 依USER_FLOWS形成性測試，不憑外觀標PASS |
| Dataset/HRTF/audio | 尚未下載資料集；部分license/外部檔案權利UNKNOWN；Steam CIPIC條件獨立 | 逐筆授權與disclosure確認；native smoke未播放default HRTF |
| Toolchain | root Node/npm精確版本；Rust不在PATH；GCC在MSYS2，非標準PATH | environment check與SDK命令記絕對路徑，可傳compiler override |
| Skills validator | 系統Python缺yaml/pip，使用隔離cache | PyYAML6.0.3在忽略cache；Phase3曾驗15自有Skills，之後修改需重跑，8Emil原檔另以hash驗；不修改全域環境 |
| 發行授權 | 第三方metadata清冊不是完整發行審查；專案LICENSE未決 | 使用者決定專案IP；打包前生成實際NOTICE集合 |

「未知」不是失敗，也不是通過；上表列的是證據目前能支持的範圍，不以文件數量替代功能驗收。

## Sound Behavior Technical Risk Register（2026-10-27）

Owner為未來模組責任，不表示已有產品團隊／實作。priority指影響／處理順序，並非已量得發生機率。

| ID／priority | Owner | 風險與減緩 | 解除證據／目前界線 |
| --- | --- | --- | --- |
| SB-R01／P0 | Physics bridge | contact storm、錯把support force當impact、rotating support誤判rolling；canonical episodes、相對接觸點速度、hysteresis與unknown分類 | 隔離policy／WASM子例有證據；完整held/CCD/mode/browser replay仍NOT RUN |
| SB-R02／P0 | Audio／Acoustic | logical voices、active emitters與path成本不是同一上限；各自bounded admission／steal與telemetry | 正式budget profile與device trace、underrun／audio continuity／soak；目前未實作 |
| SB-R03／P0 | Audio renderer | 重複delay/distance/HRTF或Behavior乾聲旁路；統一SourceGraph、route身份與null-capability拒絕 | impulse arrival／gain/direction與audible route測試；本次只有規格 |
| SB-R04／P0 | Asset／Domain host | 缺asset／權利、模型捏造hash、共享preset半套更新；trusted registry pins、有限匯入、原子revision/inverse | draft負例可驗；真asset import／decode／playback／rights流程NOT RUN |
| SB-R05／P0 | Recorder／Analysis | 換音色被當成聲學改善；raw physics trace與behavior decisions分層、明示A/B kind／自變項 | draft比較hash負例；正式replay／PCM/metrics／跨裝置比較NOT RUN |
| SB-R06／P0 | Meta host | API／額度／strict subset／完整競賽規則未知；保留手動／offline、host驗證與真live gate | Task0007／0014；Mock不能解除Meta真功能要求，公開Codex條款UNSTATED |
| SB-R07／P1 | UX／Inputs | 多profile/規則難追查、FPS誤觸或audition污染run；Inspector優先、preview隔離、事件身份／錯誤可追查 | 手動keyboard/IME/FPS與形成性測試；本次無UI畫面／可用性PASS |
| SB-R08／P0 | Engineering | 正式產品尚未實作、時間不足；先M0及最小vertical，Graph/modal延期，不以減測試趕工 | 依Task0011–0015逐層驗收，未到層級保留BACKLOG／NOT RUN |
