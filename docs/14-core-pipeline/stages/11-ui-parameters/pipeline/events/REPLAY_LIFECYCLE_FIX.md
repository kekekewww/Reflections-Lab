# Events／錄放參數稽核：原始缺陷與生命週期修復

Replay 修復已在 a10b741／index-BmjZ1Zyf.js 的新 production 瀏覽器重驗原兩探針，**2／2 PASS**；完整 Events 又發現獨立的匯出 busy gate，該修復的最後完整 Events 案已在 49bde82 完成 1／1 PASS（final-49bde82-01/），原兩 probe 與 reset 保留 a10 pins。這份文件不是整體 V1、聽測、真人輸入或效能通過聲明。

## 原始真瀏覽器結果

獨佔 lease 只執行兩個短探針，透過公開「音訊匯出 → 錄製3秒」按鈕準備錄製，再回 Events 操作。沒有 HostInternal、runtime bridge 或直接 dispatch。實際 HTTP 入口為 `index-BDGeI4Sd.js`，SHA-256 `e9bbc4e496c9dfbe51a03f87f24f781caed1df166f9e2a249ebe172d4ab4e08d`；root 指定其來源為 19db9f9，沒有將當時含未建置修改的工作樹 HEAD 冒充已測程式。

| 控制／入口 | 原始實際結果 | 根因 |
| --- | --- | --- |
| events.seek：完成錄製、尚未開始重播，操作已啟用的時間軸 | 按 End 後顯示「請先開啟錄製重播。」，游標仍為 0。 | UI 的 canReplay 已允許使用時間軸，但 Runtime 尚未建立 replay cursor／audio catalog。 |
| events.record：自然播放完後重新錄製 | 「開始錄製」已啟用、「結束重播」不存在；按 Enter 顯示 STOP_REPLAY_REQUIRED。 | Host 依 ended 隱藏 replay session，Runtime 卻仍保留 replayFrame；自然完成清理分支無法執行。 |

原始兩案均 FAIL；沒有 agent POST、外部要求或 page error。stdout／process、兩份原始 JSON、截圖與 trace 均保留。先前非獨佔的完整 Events 首輪則因產品明示固定步負載保護而停在少量 tick；該輪的逾時沒有被誤列為物理時鐘缺陷。

## 修復範圍

只修改 `src/app/runtime.ts`、`src/app/recording-host.ts`，新增 `tests/app/replay-lifecycle.test.ts`。沒有修改 UI、DSP、ReplayAudioHost、物理公式、原參考值或容差，也沒有 Git stage／commit。

- Finalized seek 現在驗證並建立獨立、無 native engine 的 catalog，進入 paused replay 後定位。來源只在明確 Run 時恢復，不短暫發聲、不重發舊事件。
- Host 保留 cursor session，直到自然完成／手動結束的共用 closing 完成。closing 先取消 native Resume，再等前置／當前操作、單次排空捕獲的 engine，最後還原暫停的 live 邏輯、游標與互動 lease，才重新允許錄製。
- 新 Record 與 Run 共用保存來源游標的恢復流程；replay pose／listener 不寫回 live 物理世界。
- transport generation 與明確 cancellation 分開；延遲的前置停止、native Resume、聲學回覆與 dispose 都有邊界守衛。真正的初始化／seek 錯誤仍顯示，不誤當取消吞掉。
- 另依 root 協調加入非破壞 clearError；只清錯誤，不清 notice／pauseReason、不解除暫停或 guard。

獨立只讀審查先找出中間 patch 的三項競態：取消分類混入正常 open、reset 未等待 preview-stop 前置、native Resume 前時間軸先解除暫停。修正後新增直接對應的負例，審查者再次核讀，未發現新的確定正確性缺陷。該審查沒有操作瀏覽器或代替執行測試。

## 目前驗證

- 12 個新 public Runtime／Host／音訊控制圖回歸全部 PASS；涵蓋 seek-before-play、自然結束後錄製、last-frame paused seek、pause／stop／reset／dispose 取消、真正 seek 與 native Resume 失敗、延遲前置 reset、延遲 Resume 期間不推動 timeline、continuous instance／cursor 延續與 clearError。
- 新 12 案加既有 replay audio／atmosphere、Runtime integration、controlled take、錄製評估與 Host review，共 **61／61 PASS**（串行執行，見 lifecycle-regression.txt）。
- 整合 TypeScript、5 檔 scoped ESLint／Prettier check 全部 PASS。
- 音訊測試使用 FakeAudioContext 作為控制圖 adapter；沒有宣稱 native DSP、聲壓／音色或裝置聽測通過。
- 原初輪測試 adapter、非同步 closing 等待及 pause 前後游標取樣基準的修正亦保留原 stdout；沒有為通過而調整產品容差。
- 完整命令／來源 hash 見 lifecycle-source-manifest.json 與相應 stdout。新 production 建置、原兩探針及完整 Events 稽核由 root 後續給 lease；未執行的項目維持 NOT RUN。

## 尚待完整參數重驗

中央 semantic family 為 events.record、events.replay、events.export、events.filter、events.seek、events.select.{eventId}、events.table-scroll。事件選取保留真 event.id；唯讀證據與 HelpTip 依來源位置另列，不把 row index 當持久 ID。

完整測試已準備：空白／錄製／完成／重播／中斷狀態、真正 JSON 下載、搜尋大小寫／空白／Unicode／物件／規則／決策原因、時間軸鍵盤邊界與 pointer、事件證據、HelpTip hover／focus／Escape、第二次錄製期間保留舊封存檔及新 run ID。

Events 沒有 recording import、A/B capture 或 discard-cancel 公開控制；A/B 位於 Comparison 面板，另由其 owner 稽核。引擎錯誤、零長度可播 artifact、nativeRejection 額外證據及真正溢出／超過 200 筆顯示的條件，只有實際誘發並操作後才列 PASS，不以程式碼推論代替。

## a10 production 後續收據

原兩探針以獨佔 Chrome、公開 UI 重跑 2／2 PASS（34.2 秒），結果另存 attempt-final-probes/；完成錄製直接 seek 能定位 paused replay，自然結束後可直接開始新錄製。Reset 中斷保存案亦 PASS（attempt-final/）。這些收據沒有覆寫 19db 的原始兩 FAIL。

完整 finalized 案先遇原生 range max 未對齊 step 的測試假設：HTML max=0.066666…、step=0.001，End 的合法值為0.066，不能要求它等於未對齊的 max；已改驗 step 內且畫面 physics tick 等於匯出 endTick，原失敗保留。繼續完整案後確認 immutable export 的 busy gate，詳見 EXPORT_GATE_FINDING.md；沒有將完整 Events 宣稱全通過。
最後合併來源的指定完整 Events 案 1／1 PASS、28.9 秒，詳 final-49bde82-01/REPORT.md；尚未誘發的條件與非本輪重跑項目仍由該收據明列，沒有外推完整 V1。
