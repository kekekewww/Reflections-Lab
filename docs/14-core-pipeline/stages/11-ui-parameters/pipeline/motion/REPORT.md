# Motion 參數稽核與版本化重驗

目前狀態：**COMPLETE_IN_LISTED_UI_SCOPE_WITH_VERSIONED_EVIDENCE**。原五案 PASS 保持49bde82來源，受影響錄放案在9fc窄修後單案 PASS；沒有宣稱六案都在同一新來源重跑，也不把23個展開控制定義／單一family／舊版原生增減外推成所有值組合通過。

正式新來源 `49bde82be6f9def5058bc8f3076e105fcdfd535d`，實際 Chrome 156.0.8078.75／production4173 HTTP 入口 `index-C4qRBPy8.js`，SHA-256 `8d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123`。每案另固定 loaded JS／CSS bytes。操作全部走公開 DOM 表單、按鈕、檔案輸入及下載；evaluate 僅讀 DOM／原生 validity，沒有 HostInternal、runtime bridge、付費 API 或人工鍵鼠／聽測聲明。

## 已完成的實際範圍

`final-49bde82-01` 六案中 **5 PASS／1 FAIL，1.6 分鐘**，CLI exit1 如實保存：

- 無物件／fixed／dynamic 狀態；ID pattern、64 字有效／65 字截斷；七個 moveTo 數值欄各自 min/max、越界與空值、Enter／Escape。
- impulse 三軸 −1000／1000／1001、實際向量 `[2,1,-1]` 儲存／下載／Run applied；`[10,10,0]` 超過 limit10 之 L2 norm 原子拒絕。
- dynamic moveAndRelease preserve／zero 儲存值；Undo／Redo 由真下載核對，zero 實際 Run reached；Remove／有效 Import，以及 malformed/schema/foreign-scene/foreign-object 拒絕後原 actions 保留。
- kinematic zero／transfer 及 gravity／noGravity 作者值、acceleration 禁用；合法 trajectory 經公開 JSON Import 後 Run reached；kinematic impulse Run 明確拒絕，列 EXPECTED_UNAVAILABLE_VERIFIED。
- Active Motion 時作者／Import 停用、Export 仍可用；鍵盤 Enter 取消後顯示 cancelled；逾時 timedOut；場景 body mode 變更造成 stale，Run 停用，公開 Rebase 恢復 Run。

具體值、方法、限制與實際 action instances 見 `COVERAGE.json`。kinematic release 的作者值已驗持久化，不藉此推斷未由 DOM 檢查的 release velocity／模式物理細節。匯入的進階參數亦不冒充所有 schema 組合均已 UI 測過。

## 真負載限制與新候選分開記錄

原第六案實際 live recording 在 **tick5** 觸發固定步安全負載保護，DOM 明示保留欠帳、可繼續逐批或明確停止封存。這是**真 observed safety/load guard／known performance limit**。測試原先被動等待 tick180 的假設不成立；原 FAIL、截圖、trace 與 UI 原文全部保留，沒有把保護當成假的測試事件。

經協調只改該案使用公開流程：驗 recording 作者禁用 → 明確 Stop 封存短 prefix → Render「錄製3秒」建立可穩定檢查的 replay 來源。窄重驗 `final-49bde82-02` 再次 **FAIL**：

- 本次 Stop 前 header 是 **tick7／0.12s／已暫停**。
- Stop 消失且 Replay enabled，證實原 prefix 已封存。
- 新的公開「錄製3秒」真實顯示 `SHORT_TAKE_INTERRUPTED: fixed step did not complete`。
- world 到 **tick10／0.17s**，新 artifact 只有 **0.03s**，顯示「中斷紀錄已封存；不可重播」。
- replay 作者禁用／結束恢復段因此 **NOT_RUN**；不使用 Scene reset 或內部 clock 操作繞過。

完整精確步驟、HTTP pins、識別碼可得性、UI 原文、stdout／trace／PNG 路徑及來源對照見 `SHORT_TAKE_DEBT_CANDIDATE.json`。Residual fixed-clock debt 跨 Stop／mode transition 的關聯已交 Runtime owner 查證；本報告將原因標為假說，UI 失敗為直接觀察。不得放寬 exact-step guard，亦不得以 controlled take 的後續成功宣稱性能健康。

## 9fc 窄修後原序列重驗

來源 `9fcf3f0657813f5aa07bf936a1cb6a50f2628f30`，實際入口 `index-DO7iDxDy.js`／SHA-256 `5c75259d334399afeab1c53a5d32e0e7a3b4067f862b245836fdd542b96e7819`。只重跑受影響一案，**1／1 PASS，25.3 秒，CLI exit0**；原五案沒有重跑或移作新來源。

本次原分支自然發生，DOM 實際顯示固定步負載超限與保留欠帳。公開 Stop 後下載 prefix：`captured`、5 frames、ticks1–5，run `recording.1b4960c7-d0d4-4fda.capture.1`。再按公開「錄製3秒」並下載新的 artifact：`captured`、**180 frames、ticks6–185 全連續**，新 run `recording.86fa73bc-d835-4ab5.capture.2`。兩份檔案均由 UI 的「匯出已封存錄製」取得，frameCount 與實際 frames.length 相符；沒有 Scene reset、clock 注入、內部呼叫或放寬保護。

重播時 Motion Save／Import 真停用；明確 End replay 後 Save 恢復。180 frames 由下載 JSON 驗證，slider 最大值僅記錄，沒有把 UI 毫秒步距或顯示四捨五入當成 frame 正確性。完整收據與所有 tick／run ID／下載 SHA 在 `SHORT_TAKE_DEBT_RESOLUTION.json` 及 `final-9fcf3f0-02/`。

`final-9fcf3f0-01` 保留新增 harness 字面值錯誤：當時誤把 artifact.status 斷言成 workflow 的 `completed`；真 schema 與 prefix 皆為 `captured`。該次在 prefix 檢查即停止，尚未執行新的受控 capture，**不是修正失敗證據**；只改兩處 status 斷言後重驗。正式 artifact enum 是 `captured | interrupted | cancelled`，與 UI 的 finalized、Host workflow 的 completed 分開。

原 `49bde82` 失敗仍完整保留，不改寫成 PASS。安全負載限制仍為真觀察，後續受控取樣成功不代表正常互動錄製性能健康、600 秒性能或裝置聽感通過。


## 其他證據與限制

- 舊 `19db9f9 / index-BDGeI4Sd` 的原生增減短案 **1／1 PASS**：target X、speed、timeout 的 ArrowUp／Down 和真正 native spinner pointer 均有前後值、實際 bbox／padding／border 座標及截圖。它只證明舊來源的三個具體欄位，見 `native-stepper-summary.json`。
- MotionPanel 與 MotionDock wrapper **沒有 HelpTip caller**，列 ABSENT_NOT_A_CONTROL。NumberField 的 native title／欄位錯誤文字分開記錄，不借 generic HelpTip PASS。
- 所有已跑新案 page errors／API requests 為 0；未將無 exception 當成產品全數通過。
- 最新 own spec/config scoped ESLint／Prettier PASS，收據 `scoped-eslint.txt`／`scoped-format.txt`。
- 首次 attempt01 的兩個定位錯誤與資源 lease 中止保留，不能拿它們當產品缺陷。
- 各輪新案結束後均確認自有 CLI／worker／Chrome children 為 0；所有新 browser 已停止。未更動產品、guard 或 Git index。

原候選已由Runtime窄修與原公開UI序列重驗收斂。下一步由Claude Code依版本化收據獨立複核；五案PASS、原負載限制、新舊失敗與9fc成功皆保留其各自來源。未宣稱完整V1、全部import-only進階組合、所有釋放物理細節或正式性能通過。
