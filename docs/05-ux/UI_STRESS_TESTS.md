# UI 壓力、失敗與恢復驗收

更新：2026-10-26。狀態：**可執行測試規範；正式 UI、瀏覽器截圖、鍵盤、螢幕閱讀器、音訊與使用者測試全部 NOT RUN**。本文件補足 [元件契約](COMPONENT_SPEC.md)、[FPS 互動](FPS_INTERACTION_UX.md)與 [User Flows](USER_FLOWS.md) 的非正常情境。`break-ui` 提供 worst-case data 的檢查思路；Reflection Lab 的 physics／solver／audio 正確性仍依各自規格與證據驗證。

## 執行規則

使用可重現 synthetic fixtures，不放真實個資、憑證或商業音效。fixture 記 stable scene/object/path/event IDs、revision、seed、數量、hash、預期拒絕或降級條件；正式 domain schema 不允許的資料，在 import／command 邊界測拒絕，不能先把 runtime 損壞再把 crash 稱為可接受。故障注入透過 test adapter，復原後重新驗 revision，不把舊 job 當成功回覆。

目前 contract 邊界須先套用：[Scene schema](../../schemas/scene.schema.json) 每 scene 最多 256 objects，listener 必填且不可為 null；[AcousticFrame schema](../../schemas/acoustic-frame.schema.json) 每 frame 最多 256 paths；[AI command label](../../schemas/ai-tool-request.schema.json) 上限 160 字元。1000 objects／10000 paths 作超限拒絕測試，或以**隔離純呈現 adapter**測 UI 容量，不能灌入正式 runtime 或稱為已支援的 scene/frame。Scene object 目前沒有 label 欄，名稱持久化須在正式功能獲授權後補 domain 決策；本次不改 schema 來迎合壓測。

先跑單案例，再跑 long-name＋DPR2＋1000 objects、collision storm＋solver timeout＋Pause、Holding＋IME／modal＋lock loss 三組複合案例。每個案例涵蓋 pointer 與 keyboard 替代、normal／reduced motion、Scene／Simulation／Analysis 中適用的位置。每次開始記 run/tick、scene revision、selected ID、input owner、recording state、monitor state；完成比對 ID、Undo 歷史、trace 與錯誤狀態。

| ID／情境 | 測試資料與操作 | 可檢查的預期行為／恢復 | 證據／目前狀態 |
| --- | --- | --- | --- |
| `UX-STRESS-01` 極長名稱 | label 以實際 160／161 字元邊界、繁中房間／材料名稱、無空白資產檔名及 emoji／組合字元測試；512／2048 字貼上只測超限拒絕；Explorer 選取、改名、Inspector、HUD、tooltip | 合法名稱換行或截斷且可取得全名；名稱不遮住 Mute／Pause／欄位單位／focus ring；超限明示拒絕、保留輸入。顯示截斷不改 object ID／原資料 | 各 viewport 截圖＋rename command／focus trace；NOT RUN |
| `UX-STRESS-02` 大量物件 | 正式 scene 測 1／100／256／257 objects，257 與 1000 必須拒絕；隔離 UI adapter 另測 1000 列（900 fixed＋100 dynamic 的呈現資料），不得送正式 world；過濾、排序、多選、刪除再 Undo | 列表捲動／virtualization 保留鍵盤位置與 stable selection；可取消搜尋；排序不改 ID；超限在 transaction 前原子拒絕，不留下部分匯入；純呈現容量結果不構成 domain 容量保證 | profile＋選取 ID／Undo 前後 scene diff；NOT RUN |
| `UX-STRESS-03` 空場景 | 零 object/source/listener，逐一開 Workspace、Inspector、Run、Analysis | 顯示可操作 empty state；沒有數值填 0 的假圖；Run 依 domain 條件允許空運算或顯原因；新增第一個物件後可恢復，不需重新載入專案 | 截圖＋command/state trace；NOT RUN |
| `UX-STRESS-04` 沒有 Listener | 未完成 Document draft／缺 listener 的非法 import／adapter 回 missing；目前 Scene schema 不允許有效場景沒有 listener；另測選取 stale listener 的 result | import 在 schema 邊界拒絕；draft 求解入口明示缺少 Listener；音訊不自動拿 observer camera 冒充 Listener；舊結果保留版本及 stale 標記；新增合法 Listener／明示綁定後重新計算 | source/listener IDs、capability／state trace；NOT RUN |
| `UX-STRESS-05` 無效材質 | import／edit 含不存在 material ID、band 缺值、NaN、超出係數、A/R/T 不守恆；以 fixture 個別注入 | domain 邊界原子拒絕；欄位 error 有頻帶／單位與原因，保留合法版本及原輸入；Synthetic／Measured 標籤不自動替換；修正再提交只一筆有效 Undo | schema／domain 負例＋欄位截圖＋revision diff；NOT RUN |
| `UX-STRESS-06` 碰撞事件暴增 | 合法 dynamic 堆疊崩落；test adapter 注入每秒 10000 contact records 的有界壓力序列，另區分 resting support／新 impact | timeline 可聚合而可展開原資料；continuous 與 contact voices 分池、有明示 voice cap／dropped 計數；resting contact 不逐步重播 impact；錄製過載 pause，不靜默漏 tick | event counts／dedup／voice telemetry、physics與audio各自測試；NOT RUN |
| `UX-STRESS-07` Solver 失敗／超時 | deterministic adapter 回 timeout、invalid frame、晚到舊 revision、取消後成功、worker crash；切 Workspace 並 Retry | 保留最近有效結果且標 stale／age／錯誤原因；未支援與無結果分開；舊 revision 不覆蓋新資料；Retry 具新 job ID、可取消，恢復後只顯有效 frame；audio 不等 job | request/revision trace＋job IDs＋錯誤與恢復截圖；NOT RUN |
| `UX-STRESS-08` 視窗與縮放 | 320×568、1024×768、1920×1080、3840×2160 CSS px；100%／200% zoom，依平台記實際 CSS viewport | 一般表單／說明 reflow；側欄收合有可見入口；Mute／Pause／退出、目前焦點仍可到達；必要二維 3D／表格有列表／摘要替代；splitter 具鍵盤 reset | viewport/DPR/zoom metadata＋截圖＋Tab 路徑；NOT RUN |
| `UX-STRESS-09` 高 DPI | DPR 1／2／可取得的 3；resize／跨不同縮放螢幕 | CSS hit target 不因 device pixels 縮小；線型、節點、文字可辨；raycast／ghost hit 與指標位置一致；render resolution 降級明示 | CSS／device尺寸＋定位誤差＋GPU/frame profile；NOT RUN |
| `UX-STRESS-10` 繁中與長文字 | 繁中介面、IME 改名、很長錯誤訊息／單位／來源；一字名稱及重名物件 | IME composing 不執行 WASD/E／Enter commit；同名仍靠 domain ID；錯誤換行且 action 可見；tooltip 不作唯一資訊；screen reader 不逐 frame 重播數據 | composition／action trace＋鍵盤／讀屏紀錄；NOT RUN |
| `UX-STRESS-11` 大量反射路徑 | 正式 frame 測 0／64／256／257 paths，257 與單 frame 10000 必須拒絕；隔離 UI adapter 或多份合法 frame 的歷史表測 10000 列，含相交、階數、path birth/death；選圖表／表格／3D | 超限 frame 不發布；顯示數與總數分開；降採樣只改視圖；Direct／Reflected／Blocked／Selected 兼具線型／節點／文字；stable result/frame/path ID 保留，失效選取有原因；隔離 adapter 有 Synthetic 標記，IR-only capability 不生假聲線 | serialized frame hash＋雙向選取 trace＋截圖／profile；NOT RUN |
| `UX-STRESS-12` 不支援功能 | test capability 只有 IR、沒有 individualPaths／HRTF／dynamic reflectors；裝置不具必要 WebGL／AudioWorklet 能力 | 入口有 unsupported 原因與可用替代；不將未支援顯成零、空白成功或測得值；不無限重試；可匯出診斷、使用支援的表格／分析 | capability matrix＋可見原因＋替代流程紀錄；NOT RUN |
| `UX-STRESS-13` Audio 未解鎖／設備失敗 | 首次 AudioContext suspended、使用者拒絕、無輸出裝置、裝置移除／切換、context error | monitor blocked／error 有原因；明示手勢重試、Master Mute 可達；模擬／記錄狀態獨立；重試不重發已處理 impact、不默默增加 gain／假稱可聽 | context/device事件＋emission IDs＋設備音訊檢查；NOT RUN |
| `UX-STRESS-14` Pointer Lock 拒絕／遺失 | 進入拒絕、按 Esc、blur、visibility hidden、開設定 dialog；先按住 W 或 holding／ghost | 清按鍵與未提交 throw；下一固定 tick pause、保留 interaction 快照；Esc 不二次 drop／delete；焦點回合理控制；明示 Resume、重新取得 lock 的 click 不 throw／place；非 lock 替代可完成工作 | lock／focus／input trace＋physics tick／物件快照；NOT RUN |
| `UX-STRESS-15` 抓取邊界 | 超距／牆遮蔽／薄牆／過重／固定物、持有物進狹門、切 Build、刪除 held body | HUD 顯實際距離／受阻／原因；不能穿遮蔽物選後物；不 teleport；受阻／失效依物理規格限力或安全釋放；切 Build 要完成明示放下／取消，不能隱藏投擲 | 物理位置／接觸／impulse上限證據＋HUD；NOT RUN |
| `UX-STRESS-16` 放置交易失敗 | ghost invalid、玩家重疊、ray miss、連點、revision conflict、geometry ack 失敗 | invalid 不提交；command ID 去重；staged 不誤顯 active，不產生聲源；rollback／可修正 staged 有理由；重試前重驗 revision／碰撞，Undo 為一筆原子命令 | command／revision／body／source counts＋差異；NOT RUN |
| `UX-STRESS-17` Workspace／Pause／恢復 | Running 中跨三 Workspace；Holding 時切換；recording 中 Pause／Resume，連續 source 有 pending arrival，切 Raw/Simulated | layout 不 Reset run；interaction guard 明示 pause；logical tick/source offset 保存，Freeze-and-fade 有 tail-cut marker；Resume 只排尚未到達事件一次，Listener 不被 Analysis camera 偷改 | run/tick／epochs／source offsets／event序列與audio連續性證據；NOT RUN |
| `UX-STRESS-18` 鍵盤、focus 與動態 | 全程不用 drag／lock，Tab／Shift+Tab、Enter／Space、Esc、dialog／popover／palette；啟用 reduced motion 並連續反轉開合 | 焦點可見、不被 overlay 遮住；可退出 modal、回原控制；IME／文字 undo優先；同一手勢不觸發 FPS；動畫可中斷／立即回應，reduced motion 不改 physics/audio 時間或延後 command | 按鍵／focus紀錄、可及性樹、normal/reduced視覺紀錄；NOT RUN |

## 每案結果與缺陷紀錄

每筆結果記 `caseId`、日期、agent／測試者、Git revision＋dirty diff hash、fixture hash、硬體／browser／裝置、操作步驟、預期／實際、PASS／FAIL／NOT RUN／BLOCKED、artifact paths、限制、issue／task ID、修正後重測。截圖標註 workspace、viewport、DPR、zoom、motion preference 與 state；動畫需要短片或逐幀紀錄，單張截圖不足以驗 interruption。用上游 `break-ui` 注入資料後還原 fixture，不把擾動資料寫成使用者場景。

PASS 必須限定證據範圍：靜態程式／文件審查、snapshot、真瀏覽器鍵盤／pointer、真設備音訊、physics數值、acoustic數值、效能各自列示。沒有 browser／畫面能力時保存步驟與 `NOT RUN`，不得稱已通過視覺測試。benchmark 指標使用 [PERFORMANCE_STANDARDS](PERFORMANCE_STANDARDS.md) 的六種分開預算；UI 看似合理不能替代有限 impulse、阻擋、傳播時鐘、A/R/T 或 DSP correctness。

發現錯誤先記穩定重現資料與最後有效狀態，再修正／重測對應案例及受影響相鄰流程。取消或 Retry 不刪原始結果；工具無法擷取的部分填 UNVERIFIED。新發現的產品決策更新正式 UX 規格，Wiki 只索引決策、review 與證據，不另維護一份元件規格。
