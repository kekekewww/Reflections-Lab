# 視覺、互動與可及性設計規範

## 2026-10-28 使用者指定的 Emil UI 方向

使用者明確指定 [Emil Kowalski Skills](https://github.com/emilkowalski/skills) 作為後續 UI 排版與互動的主要參考。使用既有固定來源的 `emil-design-eng`，需要動態時才按需使用 animate／review-animations／animation-performance；來源與安裝狀態沿用 [EMIL_SKILLS](EMIL_SKILLS.md)。本次已核對本地 main skill 與固定 manifest hash 相同，沒有升級、安裝依賴或修改上游 skill。

依本次偏好及前次實測，後續實作採以下方向：

- 預設畫面突出三維場景、選取與主要動作；開始／暫停、靜音、進入／離開第一人稱要容易發現且可操作。
- 精簡常駐說明。revision、hash、模型／來源、完整限制與除錯資料放在可展開的詳細資訊；影響當前操作的錯誤、必要警示與狀態仍在操作處呈現。資訊必須可查，不要求全部同時占據主畫面。此原則適用本目錄其他規格中「顯示」技術資料的要求。
- 以清楚的字級層次、間距、分組、對齊與一致元件建立秩序；具體值仍由既有 canonical tokens 維護。預設版面本身需好用。
- 面板比例服務目前工作，保留實際可用的調整、收合與回復能力；避免多層框線與說明擠壓場景。
- 按鈕與拖曳有立即、清楚的回饋；動態克制、有用途並可中斷，高頻控制不等待動畫。保留鍵盤、焦點與 reduced-motion 規則。
- 優先修復使用者回報的第一人稱不可操作／入口不清楚，再整理資訊與元件，最後處理使用者可暫緩的版面細節。

以上是使用者方向與專案落地要求，不是已完成的新 UI。實際畫面、互動與可用性須另外驗證；開發仍依使用者要求暫停。本節補充 2026-10-26 的歷史規範狀態，不把歷史靜態檢查當成本次改版通過。


查核日期：2026-10-26。狀態：**原創設計規範；未實作 UI／未宣稱 WCAG 符合**。目標是深色但非純黑、可理解的專業工具，讓資料、物件與聲音狀態優先於裝飾。4px 間距來自本專案需求，不是複製競品 token。

## 正式來源與維護入口

本目錄是具體 UI/UX 規範的唯一正式維護位置；Wiki 只索引、彙整狀態與決策。Phase 2 補充不授權啟動正式產品 UI。設計值為 `PROPOSED`，規範已可靜態檢查；瀏覽器、動畫、效能及實機可用性仍為 **NOT RUN**。

| 規範 | 唯一維護位置 |
| --- | --- |
| 色彩／字體／間距／radius／border／elevation／motion／z-index／互動 token | [DESIGN_TOKENS.json](DESIGN_TOKENS.json)，格式見 [schema](DESIGN_TOKENS.schema.json)；Markdown 不再維護另一套數值 |
| 元件資料與狀態 | [COMPONENT_SPEC.md](COMPONENT_SPEC.md)、[COMPONENT_STATES.md](COMPONENT_STATES.md)、[機讀狀態矩陣](COMPONENT_STATES.json) |
| 動畫決策／中斷／Reduced Motion | [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) |
| 工作區／選取／Inspector | [WORKSPACE_ARCHITECTURE.md](WORKSPACE_ARCHITECTURE.md) |
| FPS／Build 正常與失敗流程 | [FPS_INTERACTION_UX.md](FPS_INTERACTION_UX.md)、[INPUT_CONTROLS.md](../04-physics/INPUT_CONTROLS.md) |
| 效能數值／六項量測方法／壓力測試 | [正式預算](../06-validation/PERFORMANCE_BUDGET.md)、[量測方法](PERFORMANCE_STANDARDS.md)、[UI_STRESS_TESTS.md](UI_STRESS_TESTS.md) |
| Emil 選用／固定版／授權／限制 | [EMIL_SKILLS.md](EMIL_SKILLS.md)、[provenance](../../third_party/emil-skills.manifest.json) |

實作前讀適用規格、專案 `reflection-lab-design-system` skill 與所需上游 skill；實作後依壓力矩陣做真實畫面／互動、動畫與效能檢查，再更新 Wiki 設計決策／review history。純靜態檢查不能關閉視覺驗收。

```powershell
node scripts/setup/emil-skills.mjs --check
node scripts/setup/emil-skills.mjs --standards
```

## 視覺層級與 tokens

| Token group / key | 用途 |
| --- | --- |
| `color.canvas / panel / raised` | 背景／側欄／浮層 |
| `color.textPrimary / textSecondary / textMuted` | 主文字／單位／可讀次資訊 |
| `color.accent / success / warning / danger` | 焦點／有效／限制與過期／錯誤 |
| `color.borderSubtle / borderControl` | 裝飾分區／重要控制邊界 |
| `typography / spacing / sizing` | 繁中字體 fallback、工程數字、密度與命中範圍 |
| `radius / border / elevation / zIndex` | 形狀、focus、浮層及疊層次序 |
| `motion / interactive / acoustic` | 有目的動態、狀態及聲學線型語意 |

所有顏色為待實作初始 token，須檢查實際 hover/disabled/選取背景及圖表疊色，不能只驗證色票。選取靠 accent＋外框／節點／文字；error 有圖示與訊息；stale 有 badge＋時間。禁用控制不靠低透明度讓理由難以辨識。

2026-10-26 已以 Python 依 sRGB 線性化及 `(Lmax+0.05)/(Lmin+0.05)` 計算靜態色票；三個背景 `canvas/panel/raised` 中最差組合如下。這是**靜態 token 計算 PASS**，沒有驗證透明度、疊色、實際 UI 或整體 WCAG 符合性。

| 前景 | 最低 contrast ratio | 判讀 |
| --- | --- | --- |
| primary / secondary / muted text | 12.97 / 8.05 / 6.06 : 1 | 初始實色一般文字超過 4.5:1 |
| accent / success / warning / danger | 7.77 / 8.50 / 8.63 / 6.54 : 1 | 實色在三背景可辨；仍須形狀／文字 |
| border-control | 4.16 : 1 | 超過 3:1 非文字目標 |
| border-subtle | 1.45 : 1 | **不符合重要控制邊界需求**；僅裝飾分區，不作唯一線索 |

採 4px 格點；數值只讀 `spacing`、`sizing`。Master Mute／Enter FPS／Enable object 使用 `criticalTarget`；compact 仍保留 keyboard focus 與 `minimumTarget`，不能靠縮小命中範圍提高密度。

文字使用 `typography` 指定的系統 fallback，**本次未下載或隨包散布字型**。數字表格採 `numericVariant`；ID／路徑可 monospace。介面使用繁體中文台灣詞彙；API、單位、物件 ID 保留英文。

## 版面與縮放

桌面初始版面只讀 `sizing` tokens；這是設計起值而非最小可用螢幕保證。Sidebar 可收合，splitter 可拖亦可鍵盤箭頭調整／reset；不得讓某個 panel 小到藏住焦點。使用者配置以 Workspace 分別保存，另有「回復版面」入口。

小視窗／200% 縮放時採單主工作區＋切換面板，縮短工具文字但 accessible name 不變；Monitor/Mute/Pause 仍可到達，不因橫向工具列溢出藏在 canvas 後。3D 與大型表格可保留必要的二維檢視，但另提供可閱讀的摘要／列表；一般表單與說明文字應 reflow。320 CSS px 與 zoom 測試尚未執行，不能用「這是專業工具」豁免所有 UI 的可及性。

## 視覺狀態語彙

| 狀態 | 視覺與文案 | 禁止的誤導 |
| --- | --- | --- |
| Running | 實心播放圖示＋「運算中」＋run/tick | 單靠閃爍亮點 |
| Paused | 暫停圖示＋原因＋Resume | 把 blur pause 寫成完成 |
| Recording | 圓形圖示＋「記錄中」＋長度／缺口 | 使用紅點但沒有文字／紀錄種類 |
| Muted | crossed speaker＋「監聽靜音；模擬仍運算」 | 讓使用者以為 source 停止 |
| Pending | clock＋「等待幾何更新」／具體工作 | 無限 spinner 沒有取消／原因 |
| Stale | amber badge＋result revision／目前 revision | 將舊結果當最新 |
| Unsupported | neutral badge＋原因＋替代檢視 | 灰色空圖讓人猜是沒有聲音 |
| Error | error icon＋可操作原因／重試 | 只顯堆疊訊息；或重試覆蓋舊資料 |
| Measured/Computed/Estimated | 文字 badge＋可展開 metadata | 用「AI」badge 代替數據來源 |

單位不藏在 placeholder：位置 m、角度 deg、時間 ms/s、mass kg、frequency Hz；數字小數精度依量級與有效精度顯示，原值可查。`0`、`— 未提供`、`尚未計算`、`無效擬合` 分開。百分比與線性係數依定義，dB 必附 reference／quantity。dBFS 不寫 dB SPL。

## 動態與時間

高頻動作（selection、Inspector 值、HUD、按鍵）直接更新，不加拖慢手感的入場動畫。Panel 開合使用 `motion.duration.panel`，reduced-motion 預設立即；需要透明度輔助理解時須在 review 記錄理由。完整決策順序見 [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md)。禁止 head bob、頻繁 shake、閃爍 energy light 作預設；不以畫面動態推論聲學到達時間。

UI transition、physics fixed step、acoustic solver update、audio rendering 各用自己的時間；AudioContext timeline 的 crossfade 不依 CSS。求解結果只有在新 frame 完成才換資料；過程可顯 pending，不能用補間畫出不存在的反射路徑。拖曳可平滑**視圖**但不能把 smoothing 值回寫為量測值。

參考 Emil 固定版的有目的動態原則；原始 skills 與必要 reference 已依 MIT 保留於 `.agents/skills/`，來源、逐檔 hash、選用及專案差異見 [EMIL_SKILLS.md](EMIL_SKILLS.md)。

## 輸入與直接操作

可點按的 icon 皆有 tooltip、accessible name 與明示 action，tooltip 可用焦點觸發、不作必要資訊唯一來源。場景作者的刪除／修改使用可 Undo 命令；Reset 不是 Undo，需清楚說明目標 revision、保留已完成結果並將未完成 recording 標為 interrupted。普通可撤銷調整不增加逐次確認。數字欄提供單位、微調與直接輸入；drag slider 有按鈕／數字替代。

3D Object outline、selected path、collision contact marker 用不同形狀，不把 physgun 操控線與 acoustic ray 畫成相同樣式。材質 preview 為外觀；聲學 preset／頻帶證據另列，不能由金屬色貼圖暗示有量測係數。Ghost valid/invalid 同時有勾／阻擋圖示與文字原因。

Tab 保留焦點，B 切 FPS Build；鍵位說明讀自 action mapping。中文 IME、contenteditable 及輸入欄擁有按鍵，遊戲 input 不接收。Esc／blur 安全退出詳見 [FPS_INTERACTION_UX.md](FPS_INTERACTION_UX.md)。

## 可及性要求與音訊暴露

目標為 WCAG 2.2 AA 的相關 UI 行為；本階段無成品，**符合性未評估**。需要在實作時檢查文字／控制對比、鍵盤操作、焦點、reflow、圖表替代、drag 替代與音訊控制。焦點使用 `border.focusWidth / focusOffset` 與高對比 ring；自訂 dialog 開啟後管理焦點、關閉回原控制，不能鎖住使用者。

音訊預設 muted，由使用者手勢啟用；Master Mute 及 monitor gain 常駐可達。聲音事件也以視覺／文字顯示，不能只靠聽力分辨是否發生撞擊；3D 方位另有方向／數字顯示。預設低 monitor gain、mode switching 不增加 source gain；actual SPL／暴露未知時如實表示，不能以 dBFS meter 或 limiter 充作耳機安全校準。沒有做醫療安全、聽力或設備暴露認證。

提供動作障礙替代：不用 hold/chord 的 toggle、按鈕／數字移動、預設 source/listener trajectory、不鎖定滑鼠的選取方式；低視力可放大與高對比；減少動態並停 camera shake；聽障可讀事件與分析數據。Canvas 補上 DOM 工具、物件表、路徑表；不能只加 `aria-label` 就宣稱整個 3D 編輯器可使用。

平台依據：[WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)、[WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/)、[Web Audio API](https://www.w3.org/TR/webaudio-1.0/)，查核 2026-10-26。以上為來源原理的簡要摘要及本地設計，未複製大篇標準文字。

## 實作前後的驗證清單

| 驗證 | 預期／證據 | 本次狀態 |
| --- | --- | --- |
| Token 靜態對比 | 所用文字背景 ≥4.5:1（一般字）、重要非文字邊界 ≥3:1；實際組合另驗 | 實色 token 計算 PASS；subtle 僅裝飾，非完整 UI PASS |
| Keyboard／lock | 可完成核心流程、Esc 退出、Tab 焦點、IME 不觸發物理 | NOT RUN |
| Screen reader | 主控制、Inspector、表格與狀態可理解；無每幀 aria-live spam | NOT RUN |
| Zoom/reflow | 200%／320 CSS px，保留 Mute/Pause／退出與表單 | NOT RUN |
| Pointer alternatives | 不拖曳、不 pointer lock 仍完成等值實驗 | NOT RUN |
| Audio | 手勢啟用、靜音可達、Raw 切換不突升、不重觸發事件 | NOT RUN |
| Reduced motion | 無 head bob；panel 不阻擋輸入；音訊時間不隨動畫 | NOT RUN |
| Scientific clarity | provenance、單位、能力、過期／限制可查，無裝飾假路徑 | NOT RUN |

此清單只驗 UX；聲學／物理／DSP 的數學與效能驗證需另行完成。
