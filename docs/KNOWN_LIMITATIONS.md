# 已知限制與解除條件

## 2026-10-29 R17 當前限制

產品截點 `cde1e2b0ed7c57228bfa64b01c262b6eeab3cba1` 已有完整檢查與當前瀏覽器證據。下方 r11 舊截點保留為歷史，不能拿其計數或200%項目當作目前門檻。

- 完整 `npm run check` 實際通過，2267個輸入前後一致，包含668一般及981執行期測試；其他明列流程、型別、格式、建置、授權清冊與英文檢查亦通過。當前瀏覽器連動8、UI／FPS28、產品4通過。原三次乾淨app contexts已有完整鏈；額外三個獨立程序為2PASS／1FAIL，等待碰撞時用盡恢復預算的原失敗仍保留，不宣稱普遍可靠。
- [C4正式量測](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/f84b1a3ece40bc2fda71efb459380829a42c37f1)保存600.051秒UI視窗、19498影格、完整trace與來源／硬體資訊，無記錄到trace資料遺失。這是負面性能證據：physics p95約4.8ms，觀測到的default／stress delivery約12.4／28.7ms，renderer-main wall occupancy p95約83.23ms，原目標不變。完整delivery仍有未量區段；native nodes不冒稱Worklet deadline、裝置延遲或聽感。
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
