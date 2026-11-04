# 負載暫停後的受控錄製修補

基準為 49bde82be6f9def5058bc8f3076e105fcdfd535d；針對真介面 Motion 最後一案發現的產品問題修補，未把錯誤改列測試腳本問題。產品與測試檔案的固定雜湊、實際命令及原始輸出見 [verification.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/0bdd1a1b852763a2effe83f73f1a137a1905bfc8)。本代理沒有操作 Git index、瀏覽器或 Wiki。

## 原始失敗與根因

錄製在負載超限時，FixedClock 正確保留尚未處理的牆鐘欠帳。停止並封存目前前綴後，原本的三秒受控錄製卻繼續使用牆鐘 advance(dt)；這會在同一輪追趕多個物理步，違反受控錄製的每輪一個 tick 守門，產生 SHORT_TAKE_INTERRUPTED。真 Runtime 回歸透過公開 RecordToggle → advance(0.2) → Stop → captureShortTake(3) 重現相同失敗，[原始 RED](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/df4b4c14507c7d000b0e2a11fde8f82a36aa599c) 保留。

## 修補語義

新增明確的受控單步入口，每次作者請求只完成一個真物理固定步；它不新增牆鐘輸入，也不消耗、清除或重設既有牆鐘欠帳及丟棄計數。普通 advance 的 recording 保留欠帳／保護暫停與 interactive 追趕／丟棄演算法完全不變；verification 另用原始方法內容雜湊核對，不只用測試推斷。

PhysicsWorld 保留相同固定步、Motion 觀察與外部 snapshot 回呼路徑。求解前失敗不虛增 tick；求解完成後的觀察者失敗則讓 clock 與 world 都提交該真 tick 一次、暫停並傳出錯誤。這只證明安全暫停與中斷，不承諾注入的內部觀察者錯誤可不重設便恢復。

Runtime 只在受控錄製實際進行中採用單步入口，保留原有 scene revision、pause generation、取消、drain 與 exact-frame 完整性守門；不將舊牆鐘欠帳誤作音訊 epoch 的丟棄時間。

## 基本驗證

- 原始真 Runtime 回歸：1 案 FAIL，錯誤與真介面一致。
- 修後完整 focused 集合：38/38 PASS、0 skip；包含原有重播／匯出生命期。
- 新 Runtime 案驗證負載暫停並封存 4 tick 前綴後，成功錄到新的 180 個連續 tick，來源可重播、Scene 未重設，舊欠帳與零丟棄計數保持原值；另驗錄到真 tick 後 Pause 可封存連續前綴且沒有晚到 tick。
- FixedClock 驗完整與含小數的欠帳均嚴格保持原值，普通 advance(0) 後仍能按原負載政策逐批處理；暫停、錯誤模式、回呼失敗及安全整數上界均有負例。
- 真 Rapier 驗單步物理位移、clock/world tick 一致、求解前／求解後／外部回呼失敗的提交與暫停語義。
- TypeScript、指定六檔 ESLint、Prettier 與 diff check 通過。

最後整合全量、重建後實際介面及 WAV 匯出由 Root 接續；本階段沒有解除既有性能、聽測、原生桌面權限或完整 V1 門檻。
