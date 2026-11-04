# 聲音行為、參數映射與物件覆寫：實際介面參數檢查

日期：2026-11-02。核心結果：**44 個核心不同案例已通過**，由第一輪 32 個通過案例、獨占負載續驗 8 個案例，以及容量／說明補充 4 個案例合成；不是把第一輪原始失敗改成成功。產品原始碼未變更。素材另有 13 個不同案例通過（assets/AUDIT_SUMMARY.json）。合計 57 個不同案例，對應中央 inventory 的 44 類語意參數；逐項 crosswalk 在 PARAMETER_INVENTORY.json。

## 方法與來源

以正式 production preview \`http://127.0.0.1:4173/\`、Chrome 156.0.8078.75、1600×1200、正常顯示比例，使用獨立 Playwright browser context 的實際 DOM 操作。輸入與點擊走正式 React／Runtime／Host。只從可見 DOM 和「匯出專案」按鈕下載的 JSON 核對結果，沒有直接呼叫引擎或測試 bridge，沒有模型／外部網路請求。

來源提交與逐檔 SHA 在兩輪 receipt.json。初始及續驗的 trace 都實際載入 \`index-BDGeI4Sd.js\`、\`App-hX50zr2p.js\`、\`locale-model-76NfFkWb.js\`；trace network 有 HTTP 200 與 URL，但沒有保留 JavaScript response body。browser-assets.json 只對確實存在的 HTML／CSS trace bytes 計算雜湊，不能把檔名當成 JS bytes 雜湊。完整 trace 的路徑與雜湊由 artifact-manifest.json 固定。

## 參數與操作涵蓋

| 參數／控制 | 已實際執行與確認 |
| --- | --- |
| 規則音量 0–4、音高 -24–24、冷卻 0–10 秒 | 最小、最大、任意小數、上下越界與空值；Enter／Escape；Apply／Discard；每個合法值以 UI 匯出 JSON 確認 |
| 規則啟用 | pointer checkbox 與鍵盤 Space，停用／啟用各自 Apply，匯出確認 |
| 四種 classification | Creative／Physical／Hybrid／Procedural 逐一選取並以匯出 profile 核對 |
| 觸發條件 | 17 個有 producer 的選項逐一選取、Apply、匯出確認；OnEnterZone／OnExitZone 維持 disabled，並有明確 bridge 原因 |
| 新增／刪除規則 | 選擇 OnBounce，Add 產生真規則，再用該規則的 Delete 移除，原規則數恢復 |
| 七種映射輸入 | 在符合 metric availability 的 OnImpact 或 WhileRolling 條件下，逐一 Apply 並匯出確認 |
| 三種映射輸出 | Gain／Pitch／Filter cutoff 逐一設定合法上下限並 Apply，包含各輸出允許的界限 |
| 映射數值欄 | 輸入上下限、輸出上下限、平滑時間的任意小數、非法範圍拒絕、Discard |
| 映射插值 | Linear／Step 均 Apply 並由匯出確認 |
| 曲線點 | Add 內點，修改內點 x/y；非法首點 x 與越界 y 被拒；首尾不可刪；Remove 內點後仍有合法兩端點 |
| 曲線容量／最小點數 | 正式 schema 上限 16 點；實際加到 16 點並 Apply，pointer 點擊 disabled Add 的第 17 次後匯出 curve 完全不變；最少兩點的兩個 Remove 均不能改變資料 |
| 說明／完整精度 | 17 個 About caller 與 18 個 binding 基準／有效值 readout，逐一 focus、讀非空 described-by、Escape 關閉 |
| 放棄所有草稿 | 同時建立 rule 與 binding 草稿，明示 DiscardAll 後兩者消失，匯出已提交文件完全不變 |
| 映射新增／移除 | 依三個唯一 target 加至三條，重複 target 選項 disabled，沒有其他 target 時 Add disabled；移除後匯出數量正確 |
| 物件覆寫 | 開啟 details；Enabled／Volume／Pitch 的 override 選擇與值；keyboard Space；Apply、非法值 gate、Discard、Clear；匯出確認只改 binding，沒有改 profile |
| 未套用草稿 | 切換 speaker 再回 ball，原 raw 草稿仍保留，可明示 Discard |
| 獨立預聽 | OnImpact 無真接觸事件時明確拒絕；OnGrab 預聽產生來源快照，展開 provenance，Stop 成功 |
| 運算中的編輯保護 | Run 時規則／classification／映射按鈕 disabled，Pause 後恢復可用 |

每列對應的 case IDs、方法及原始觀察見 PARAMETER_INVENTORY.json，不以本表取代原始結果。

## 原始失敗與修正

| Before | After | Why |
| --- | --- | --- |
| 測試以 exact label「Classification／Trigger」定位，但該 label 含原生 select 選項文字，因此四項 timeout | 測試改定位實際 label／select；保留初始 runner、stdout 與 FAIL，續驗四項全通過 | 這是測試定位假設錯誤，沒有改產品行為或放寬 Host 驗證 |
| 多個 lane 同時跑 Chrome；第一輪末尾 fresh navigation 在 8 秒 load timeout 中斷 | 關閉其他 owned browsers、獨占 lease、以 DOMContentLoaded 和有界 30 秒導覽，再僅續跑八個未完成／錯誤定位案例 | 不把共享負載 timeout 宣稱成產品參數故障，也不重跑已通過的 32 個案例 |

## 明確限制與後續

- 這是有限的參數／上下限／輸入方法矩陣，沒有窮舉任意數值與所有笛卡兒組合。
- 新增規則按鈕實測 OnBounce；17 個 trigger 全部實測的是既有規則切換並 Apply。不是聲稱對每個 trigger 都個別建立新規則。
- 先前草稿誤把 mapping curve 上限記為 64；依正式 schema 更正為 16（64 是 Motion trajectory 的不同限制）。原 40-case 文件 preimage 留在 history/REPORT-initial-40-case-snapshot.txt。沒有放寬 schema；已實測 16→第 17 次 disabled 的資料保留。
- 主介面沒有獨立 oscillator frequency、fade、voice budget 等 schema 欄位控制；本檢查不把未曝光的 API 欄位列為失效參數，也不假裝已透過介面操作它們。
- 資產匯入／sample 選擇另依 assets/AUDIT_SUMMARY.json 與原始收據；全產品其他控制由其他 lane 檢查。
- 沒有真人聽感、校準 SPL、硬體路徑或正式 600 秒效能結果；不以 headless browser 取代這些證據。
