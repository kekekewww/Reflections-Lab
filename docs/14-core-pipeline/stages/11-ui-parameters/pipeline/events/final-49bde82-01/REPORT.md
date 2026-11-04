# 最後 Events 參數流程：49bde82

指定的最後完整案例 **1／1 PASS，28.9 秒，CLI exit 0**。本輪只執行 `events controls cover finalized recording replay seek and normalized event evidence`；Playwright worker／owned Chrome fixtures 隨 CLI 正常結束，已先釋放 lease，再整理收據。沒有產品／Git／付費 API 變更。

實際 HTTP 為 `index-C4qRBPy8.js`，5,116,129 bytes，SHA-256 `8d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123`，與 root 指定 built candidate `49bde82be6f9def5058bc8f3076e105fcdfd535d` 一致。收據另存本目錄，沒有覆寫舊 FAIL。

## 本輪實際操作

- 空白狀態：錄製可用，重播／匯出停用，時間軸不存在；三個說明 icon 的 hover、focus、Escape 正常。
- 鍵盤開始、pointer 停止錄製，封存後成功下載原始 RecordingArtifact JSON。
- 事件搜尋涵蓋空字串、Unicode 無結果、大小寫／trim、物件、規則及決策原因；pointer 與鍵盤選取保存真 event.id 及唯讀證據。
- 重播時錄製停用；時間軸 Home／ArrowLeft、End／ArrowRight 及 pointer 中點均正常。上限依 native step 檢查，並確認畫面 physics tick 等於已匯出 endTick；沒有改物理容差。
- 重播中可下載同一完整 archive，鍵盤結束後可重新錄製；新錄製期間仍可下載上一份已封存檔。
- 第二次 Stop 後明確等「紀錄已保存」且 Stop 消失，再下載新檔；新 run ID 與 hash 不同，沒有 TRANSACTION_BUSY。

四份下載是 **raw Recording JSON，不是 WAV 或聽測**。前面三份的 bytes／SHA 相同，證明封存檔沒有被重播或下一輪錄製污染；最後一份是新成果：

| 成果 | frame ticks | bytes | 檔案 SHA-256 |
| --- | --- | ---: | --- |
| 初次／重播／下一輪錄製中的舊 archive | 1–7 | 105186 | 496a6ec7ffc91952d0e00352e83fca63d38459c2a9c6c857eb34f992825fe4c4 |
| 新封存 archive | 8–11 | 66947 | bccef614bac0f054fdec2cf304b5848168c297988f6e0439fd4f52cf5e51147d |

本輪 agent requests、外部／被阻擋要求及 page errors 均為 0。每個實際 label、值、狀態與 action checkpoint 在 finalized-receipt.json；控制項機讀索引為 FINAL_CONTROL_INVENTORY.json，實際產物／下載／trace 雜湊為 artifact-manifest.json。

## 範圍與保留的舊截點

中央七個 family 均有對應證據：events.record、events.replay、events.export、events.filter、events.seek、events.select.{eventId}、events.table-scroll。table-scroll 此案只驗到 focus／End，沒有量測真溢出 offset；超過 200 事件、零時長可播 artifact、引擎錯誤門控與 nativeRejection 的條件證據／HelpTip 仍明列未誘發。Events 沒有 recording import、A/B capture 或 discard-cancel 控制；A/B 由 Comparison owner 另驗。

原先 finalized-before-replay seek／natural end 兩案及 reset-interrupted 案保留 a10 的 2／2 與 1／1 收據，不冒充本輪 49bde82 重測。本輪最後完整案單獨補上 immutable-export 修復後的成功閉環。原 19db 兩個產品 FAIL、range-step 測試假設、a10 的 export gate FAIL、public Node RED、修復與獨立 review 來源仍在上層目錄。

這些是 headless Chrome 的實際 UI 操作與原始檔下載證據；沒有外推為真人鍵鼠、Meta live、裝置聽測、600 秒效能或完整 V1 全門檻通過。
