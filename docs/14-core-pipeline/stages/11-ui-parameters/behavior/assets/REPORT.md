# 素材參數：實際介面檢查

日期：2026-11-02。結果：**13 個不同案例 PASS**。權威整合結果為 [AUDIT_SUMMARY.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/caf047a08adcc55a47957c0f6943a71470686f2c)，由原 receipt.json 的 9 個通過案例與 isolated-oracle-resume-fixed-setup/receipt.json 的 4 個通過案例合成；原始 FAIL／RUNNING／INTERRUPTED 收據保留，不能只讀舊 receipt.json 當作最終狀態。

使用正式 production preview 的 SceneExplorer 素材區及 RuleCard，Chrome 156.0.8078.75，透過真 DOM pointer／keyboard、瀏覽器 filechooser event 與產品下載的專案 JSON 操作；不是 Windows 原生檔案對話框操作。沒有 runtime/test bridge、模型 API 或第三方素材。

## 已執行的參數與行為

| 控制／參數 | 實際結果 |
| --- | --- |
| Import audio disclosure／權利 checkbox／Import button | keyboard Enter／Space 及 pointer 開關可用；未勾選時按鈕 disabled；運算中不可匯入 |
| 空檔、非 RIFF/WAVE、超過 8 MiB | 顯示明確錯誤，原 assets reference 與可見已解碼 bank 均不變 |
| 五種原創 WAV | PCM8／16／24／32、IEEE float32 匯入成功，含單／雙聲道與 8–192 kHz；SHA 與原始 bytes 一致 |
| Source details | 每份匯入素材皆能以 keyboard disclosure 展開，唯讀 provenance 與 user-confirmed local rights 可查 |
| 相同 bytes 改檔名後重匯入 | 沿用同一 asset ID／原名稱，只保留一份相同 SHA 的素材；不是測了缺檔 recovery 的所有情況 |
| 五個乾音預聽按鈕 | 全部以 keyboard Enter 啟動；Run 時 disabled，Pause 後恢復。沒有把啟動狀態當真人聽測 |
| Sound asset 選擇與 Apply | 以代表性匯入素材套用 rule.grab，產品匯出的 canonical generator.kind=sample、generator.asset.assetId 正確；場景 sample preview 與 Stop 可用 |
| Save／Reload／Load saved project | 五份素材的 asset ID／SHA 保持，還原後皆 decoded-ready，預聽按鈕可用 |

測試訊號為 runner 原創的 330 Hz、120 ms、peak 0.12 正弦波，不是商業素材、真實材質振動或量測。權利狀態為 USER_CONFIRMED_LOCAL_USE；沒有擅自設定專案根 LICENSE。

## 原始失敗與測試修正

| Before | After | Why |
| --- | --- | --- |
| 把 project 所有 asset references 的數目當成可見 decoded bank 數 | 分別核對兩個集合 | 專案還有 built-in generator descriptor，語意不同 |
| 依 raw error code 或全頁 Pause 定位 | 核對實際本地化錯誤文字；限定 Simulation controls | 可理解的錯誤已存在；Inspector 也有同名 Pause |
| 在 Export project 已清除暫時 error banner 後才讀其文字 | 先固定錯誤文字，再匯出核對原子保留 | 讀取順序是假失敗原因，並非匯入未拒絕 |
| 以 UI 投影的 assetId／generator 字串讀 canonical JSON | 使用 generator.kind 與 generator.asset.assetId | 正式 Scene／Behavior schema 與 UI view shape 不同 |
| 只續跑四項而跳過必要 rights 前置，導致 filechooser button disabled | 續驗建立最小權利確認與一個 sample fixture 的前置；使用 Promise.all 同時等待 click／filechooser | 減少重跑不代表可省略依賴狀態；保留該次 timeout，不改產品 gate |

原始失敗在 receipt-initial-harness-failures.json、receipt.json 及各原始 stdout；資源鎖中止在 receipt-partial-exclusive-lease.json。最初 runner preimage 沒有完整 hash，沒有宣稱能重建該早期版本。後續 runner-before-final-oracle-fix.txt 與原始 trace／source pins 另存。

## 限制

沒有獨立素材刪除、重新命名、license／provenance 編輯控制；這些欄位是唯讀或 NOT_EXPOSED。此處不擅自新增新能力。Sound asset 選取用代表性 fixture，五種格式各自匯入與預聽；沒有聲稱對所有未知檔案與所有任意 generator 組合窮舉。真人聽感、Windows file dialog、校準 SPL、硬體 loopback 與正式性能均 NOT RUN。
