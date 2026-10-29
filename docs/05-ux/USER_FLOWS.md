# 核心操作流程與驗收情境

查核日期：2026-10-26。狀態：**流程規格已建立；以下驗收全部 NOT RUN**。預設架構為 Web 3D／物理／Web Audio；native backend 是可選能力，不影響基本流程能否查閱。流程屬 Reflection Lab 設計，官方競品依據見 [COMPETITIVE_UX_RESEARCH.md](COMPETITIVE_UX_RESEARCH.md)。

## U01：第一次建立可聆聽實驗（P0）

**目的**：在可理解的起始條件下聽見球的連續聲源與碰撞聲。**前置**：空白 Document，模擬 Ready，monitor muted，無 API key 也能手動完成。

1. 開啟專案顯示「建立房間／開啟範例／空白場景」；範例標明 synthetic/demo 材料，不稱量測材料。
2. 選「建立房間」，輸入公尺尺寸。單位直接顯示，非法數字保留原輸入並逐欄說明。
3. Library 選 Sphere，在 Scene preview 設大小、位置；碰撞與邊界驗證通過才「新增」。Scene Explorer 與 Inspector 同時選取新 object ID。
4. 設 Dynamic、mass、gravity；在 Sound Emitter 加入合法內建聲音或自有音檔，另選 Collision Profile。音檔載入／解碼失敗顯示各自狀態，仍可進行無聲物理測試。
5. 新增 Listener，或明示「Listener 跟隨第一人稱」。按「啟用聆聽」由使用者手勢恢復 AudioContext，低起始 monitor gain；音量只改監聽。
6. 按 Run 建立 run ID，球受重力運動，連續聲源不因碰撞中斷，事件列新增 contact 音效；明示 backend 模型與目前支援內容。
7. 任何時候能直接 Mute／Pause。分別顯示「模擬仍運算／聲音已靜音」，避免誤以為沒有結果。

**成功**：Document revision、run ID、source/listener、已知模型限制可查；聲音是否好聽不是成功證據。**失敗處理**：音訊被瀏覽器阻擋保留明示啟用按鈕；求解器錯誤停止新結果、保留最後快照並標過期；無麥克風權限需求，不能為單純播放要求麥克風。

**驗收**：不使用 AI 即可完成；Mute 不停止 tick；來源音檔未載入不能假標「播放中」。

## U02：第一人稱抓取、投擲與擷取（P0）

**前置**：有效房間、可抓 body、連續 emitter，已 Run；錄製可用但未宣稱跨平台決定性。

1. 切 Simulation Workspace，不重設 run；點「進入第一人稱」。先顯示 E/G/Throw/B/Esc 的實際鍵位，再取得 lock；取得 lock 的 click 被消耗。
2. 準心指向球，hover 顯示名稱、可抓狀態；按 E。HUD 顯示 mass、距離及 dynamic 狀態。物件朝受碰撞約束的錨點移動。
3. 調距離；按 R 旋轉，toggle 替代可用；相機不在同一輸入期間同時旋轉。
4. 按「開始記錄」前若仍 lock，先安全暫停退出到 UI；顯示已記錄範圍與 run ID。開始後明示恢復 FPS／Resume。
5. 左鍵新按下施加可見設定的 throw impulse；抓取結束，發生撞擊後在 contact 處產生 impact event；連續音源仍持續。
6. Esc 釋放滑鼠並安全暫停，事件記錄 pause cause；按完成錄製取得 Experiment Snapshot。

**分支**：E 釋放保留速度；G 支撐面驗證後輕放；F 固定會解除 grab 且保留音源。抓取失敗顯原因，例如 fixed、超距離、質量限制。**成功**：至少保存 initial scene revision、fixed step、版本、軌跡或 snapshot trace、碰撞與聲音事件。**恢復**：lock error 仍可用按鈕／預設軌跡重現；blur 不自動 Resume。

**驗收**：撞擊事件位置不是 camera；投擲前的最後 click 必須是 lock 後的新按下；錄製缺口與 pause 不隱藏。

## U03：第一人稱建造（P0 互動核心；聲學更新依 capability）

**前置**：FPS Idle，沒有 Holding；Document 可編輯。

1. B 進入 BuildIdle，HUD 明示「建造」。L 開 Library，退出 lock 並安全暫停，搜尋 Cube／Wall／Sphere；不把 UI 點擊送到世界。
2. 選物件後輸入初始尺寸與材質，按「返回預覽」；重新由手勢取得 lock。Ghost 顯 surface normal、尺寸、距離、grid step、旋轉及有效性。
3. 移動準心表面 raycast，wheel 調距離，旋轉及 alignment 選項調方向。若無表面、穿牆、與玩家重疊或超出 Domain 範圍，顯文字原因，禁止提交。
4. 確認放置：在 tick 邊界暫停→再次驗證→一筆可撤銷 command 建立 staged object→backend geometry 更新。顯「已建立／待啟用」，不能提前播放或碰撞。
5. ack 後選 Dynamic／No Gravity／Fixed 並「啟用」，明示 Resume。若動態反射幾何不支援，保留固定障礙物方案及能力提示；不能顯示不存在的動態路徑。
6. 取消 ghost 不改 Document；Undo 已提交建造為一筆 transaction。Duplicate 重新進 ghost 並產生新 ID。

**錯誤**：確認期間位置被其他命令改動，版本衝突後重算 preview；geometry 失敗回復 transaction 或保留 staged 供修正，明確標記；連點用 command ID 去重。**驗收**：ghost／staged／active 三階段可區分；invalid 不留物件；Tab 仍可退出 canvas 到 UI。

## U04：選取反射並檢驗聲學結果（P1）

**前置**：存在 computed ResultSnapshot；若 backend 無 `individualPaths`，改用 IR／聚合結果流程且清楚說明。

1. 切 Analysis，沿用 run；選 source、listener、result/frame，顯示模型、版本、時間、stale 與 validation level。
2. 有 individual paths 時開啟 Direct／Reflection／Transmission 圖層，以階數、頻帶與能量門檻篩選。篩選只改顯示，記錄「顯示 18/240 條」而非暗中刪求解資料。
3. 暫停或釘選 frame，點 3D path 或 path table；如果線重疊，出候選清單。不要求 3D 精細點擊作唯一路徑。
4. 同一 SelectionRef 同時高亮幾何／對應表列／RIR arrival marker，Inspector 顯 path ID、surface IDs、order、距離、絕對與相對時間、頻帶衰減、arrival direction、材質貢獻、solver 與限制。
5. 若資料來源沒有可靠 confidence，顯「未提供」，以 validation status 代替虛構百分比。相對時間使用同一 source/listener/frame 的 direct path 為基準；不存在基準則留空並說明。
6. 匯出 metadata 與數據；圖上聚焦 highlight 不是新增求解結果。選取已消失 path 保留 snapshot、標示不在目前 frame。

**成功**：使用者可回答「這條線來自哪個模型、哪一幀、碰到哪些面、延遲如何定義」。**錯誤**：IR 到達峰未能對應離散 path，不強制推斷；頻帶不足、IR 截短、RT fit 不成立時呈現 unavailable／invalid fit，不能顯示漂亮但失真的指標。

## U05：Raw／Simulated 聆聽（P1）

Raw 是**乾音參考模式**，與「實驗 A/B」不同。Raw/Simulated 的明確路由見 [COMPONENT_SPEC.md](COMPONENT_SPEC.md)。

1. 選同一錄製的 source event／固定 waveform（固定 seed），顯示目前 listener、時間、volume、是否 level match。
2. Raw 播未經環境傳播／HRTF 的乾音置中參考；Simulated 播經目前標示 backend 的路由。切換前有可讀路由摘要，不能把 Raw 稱量測真值。
3. 切換只改 monitor，使用 audio timeline 交叉淡化，保留 event time；不重設物理、不停止連續 source、不重觸發隨機樣本。顯示傳播延遲是否保留，不偷偷對齊時間。
4. 可選 level match 僅作聆聽輔助，顯校正 gain，原始 metrics 不被改寫；不可聲稱開啟後仍是原始絕對能量比較。
5. 任一模式均可 Mute；audio context blocked／device error 分開呈現。退出頁面不自動以更高 gain 恢復。

**驗收**：切換時 run ID、source playhead、碰撞事件與結果不變；聽覺差別不能代替數值驗證；沒有 HRTF 的 backend 必須如實標示。

## U06：材質 A/B 與相同運動比較（P1；完整 Replay 為 P2）

**前置**：已保存 Experiment A、運動 trace、碰撞／source event trace、seed、backend/material 版本；不只鍵盤輸入。

1. 在 A 卡片選「建立 B」，複製起始場景／錄製引用，修改唯一 acoustic material。顯示 diff：surface ID、material version、係數來源及變更頻帶。
2. 選比較方法：`trajectory replay` 固定 transforms、source/listener 與事件 trace，只重算 acoustics；若改摩擦／質量／幾何，則需另一輪 physics，標「運動條件已變，不是純材質控制實驗」。
3. 預檢 backend、sample rate、時間區間、source asset checksum、listener 軌跡及有效性。版本不同可比較但有可見 caveat，不自動說可直接歸因。
4. 執行 B；進度標示 queued/running/failed/completed。失敗保留 A、不覆蓋舊 B；取消不假裝有完成結果。
5. 左右／疊圖顯 A/B 指標、單位、定義、頻帶與有效區間；可 linked selection 相同 source/listener/event。path 拓樸不同不硬配同 ID，顯「無對應路徑」。
6. 聆聽 A/B 使用同一事件與明示對齊策略；optional level match 與實際 gain 另列。報告註明 Computed/Estimated/Measured 與沒有驗證的項目。

**成功**：差異能追溯到條件與資料，不依「聽起來較好」判為準確。**缺少完整 replay 時**：提供固定 source/listener＋預設 trajectory 的隔離比較；標「錄製重播尚未支援」，不把重新手動投擲稱同條件。

## U07：AI 場景命令（P1）

1. Command Palette 以可見按鈕開啟，先交出 FPS 輸入；描述「木地板房間、持續發聲金屬球、無重力」並送到已設定 provider。
2. 若模型未設定／額度不足，保留輸入及手動工具，不阻斷 Sandbox。執行狀態顯示 draft→validating→preview→applying→complete/error，不能把生成文字視作成功。
3. Domain Validator 核對 ID、單位、係數與資源預算，顯新增／修改／刪除 diff、需要暫停與使用資料。AI 不知道的材質數據標 estimated/demo，不自行補成量測值。
4. 使用者按「套用」後進同一可撤銷 transaction；revision 衝突重新預覽，不直接強制覆寫。危險 reset／大量物件操作以具體影響摘要控制，日常可撤銷編輯不增加多餘確認。
5. AI 解釋只能引用工具回傳結果，顯 result ID／solver／validation；沒有結果時明示尚未執行。

**驗收**：拒絕或錯誤不留下半個場景；Undo 一次撤銷該批次；在文字輸入時 E/WASD 不影響物件。

## U08：中斷與恢復（P0）

| 觸發 | 即時行為 | 恢復／資料處理 |
| --- | --- | --- |
| Esc、lock loss、blur | 清 inputs，安全暫停，顯原因；不額外 throw/drop | 明示重新進入＋Resume；持有快照／ghost 保留 |
| audio device/context error | monitor 停止，物理可繼續；顯「無聲，仍記錄」 | 使用者選恢復；record trace 有缺口，不宣稱完整錄音 |
| acoustic worker timeout | 最後結果標 stale、停發新 frame | 重試／降 fidelity／切 fallback；切 backend 產生新的結果 metadata |
| Document 未存／磁碟失敗 | 顯「場景未儲存」，保留記憶體 | Retry／另存／匯出；不得覆蓋為空檔 |
| Reset | 顯目標 revision，停止 run 並保留已完成結果 | Ready 起始狀態；未完成 recording 先 finalize 為 interrupted |
| browser refresh/close | 有未存工作時使用平台可支援提醒，不保證能阻止關閉 | 下次提示恢復最近有效 document；沒有持久化成功不得稱可恢復 runtime |

## 人工驗收記錄模板

每次執行記 `flowId`、build/version、OS/browser/input、backend、scene/result IDs、preconditions、expected/actual、observed error、recovery、PASS/PARTIAL/FAIL/NOT RUN、證據路徑。可用性錯誤分為：誤模式、誤焦點、誤刪／Reset、誤解單位、錯把估算當量測。與數學／DSP validation 分開報告。

平台依據：[W3C Pointer Lock 2.0](https://www.w3.org/TR/pointerlock-2/)、[Web Audio API](https://www.w3.org/TR/webaudio-1.0/)、[WCAG 2.2](https://www.w3.org/TR/WCAG22/)。目前只是規格，不是瀏覽器相容性或無障礙測試結果。
