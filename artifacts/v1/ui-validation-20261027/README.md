# UI 驗證證據封存

此目錄只複製既有證據並核對 SHA-256；本次未建置、未執行 browser／tests、未修改產品或測試來源。所有原始報告、manifest、handoff、下載檔與畫面均保持原始 bytes。原始路徑與封存路徑逐檔列於 [proof-receipt.json](proof-receipt.json)。

- [完整 13 項結果](feature-fda810/full13-results.json)：feature input digest fda810cf8631acca93efaadf932c7e876f0e8ff4d0941c3cb9d81c037dc1917f，13 PASS、0 skip／flaky，CLI exit 0。
- [完整 13 項 build manifest](feature-fda810/build-manifest.json)：保留原始來源與 bundle hashes。此版完整 bundle 原始 bytes 已被後續 copy build 取代；本次不重建、不拼接，不將新 bundle 冒充此版本。
- [文案修正後指定案例](copy-d3e1cd/reset-export-results.json)：copy input digest d3e1cda6500339336396dbc3afca09e11bcdb9580b25b9b2ca27b1d88730f58d，1 PASS、CLI exit 0。兩版 build input 只差 src/ui/AnalysisDock.tsx 的中斷紀錄狀態文案；完整 13 項不冒稱已在此版重跑。
- [copy build manifest](copy-d3e1cd/build-manifest.json) 與 [實際保留的固定 bundle](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/e6d6ea3264756702a45c2616481ecb6158a4d1a8)：所有 bundle 檔先依原 manifest hash 驗證，再複製並核對來源與副本。
- [原始 handoff](handoff/ui-final-handoff.json) 與 [真實 pointer-lock 事件順序](feature-fda810/pointerlock-event-order.json) 保持原始內容。handoff／報告中的舊 test-results 路徑未重寫，可用 receipt 對照此目錄的可攜路徑。
- [桌面畫面](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/3ed5e33f11a6e88a622347e7d8dd7145268cddf4)、[320px 畫面](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/0a98b130ade31397787feeff4ea8381d71966f52)、[曲線桌面](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/4c0ec39b4f0c482755d064496673a2287ce43e7e)、[曲線 320px](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/462ac462c86ff52c46392c7adf7cddb804c7c782)、[匯入確認](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/2744117ef5bffc99bbff1e4ce3ed9a391e0814ca) 已目視檢查；其他原始輸出亦一併封存。
- 範圍：實際 Chrome workspace、pointer lock／明示繼續、alternative input／staged enable、air／vacuum、reverb 標示、WAV accept、AI offline／blocked gate、JSON 檢視後匯入、錄製完成／中斷匯出、草稿交易、nonlinear curve／binding override、320px／reduced motion。AI tests 攔截 propose，不提供 live 模型證據。
- Native 200% zoom／native held-key 驗證不由此份 UI 證據宣稱通過；54 domain tests 與 8 input regression 的適用時間／範圍依原 handoff，不把靜態 token check 當畫面驗證。
