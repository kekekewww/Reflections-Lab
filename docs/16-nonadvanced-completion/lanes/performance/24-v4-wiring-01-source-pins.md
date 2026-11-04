# V4 wiring-01：735 產品合併後來源快照

已從方法 commit79efc1d9 fast-forward 正常合併 Root 指定產品735cb747891dca967913777cfa2a3e78c9ab691b，未 reset／clean。735 與 Root c321b02d133934606673a32014f83dfa4b77a9e4 的 src tree 同為 bc1ad463b3de9351255e2d4b22f80175b73daf93。

本次新增產品來源包含 recording host／worker／persistence 的 prepare gate、Runtime 錄製 admission、render-output-store 與 locale；逐檔 hash 見 JSON。音訊資源策略／公開端點及被動 TopMonitor getter 保留。Root 新增的 integration entry 正式收集本批8個spec／611案例，也另列來源 pin；本 lane 沒改原 V3 entry，合併後沒有重跑測試、build、瀏覽器或真CPU讀取。

23 號來源快照保留原歷史；方法23 inputs、語義44來源、批准record及7項證據全相同。Chrome executable hash也重新核對。wiring-01 輸出資料夾確認不存在，快照不建立它。

下一次 exact command 沿23號文件的20秒 UI／all phase／physics3000／兩組acoustic600／reference／probe-on／Levels／master-left，420秒 wrapper與260秒 native watchdog均不改。全部原輔助負載、10秒warmup與cleanup計入後預估100–150秒。此快照只代表準備就緒；必須等Root下一次明確ONE hardware GO才執行。短跑不冒為600秒或整體效能PASS。
