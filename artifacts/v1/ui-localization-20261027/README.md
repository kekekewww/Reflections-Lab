# 雙語介面驗證封存

本目錄保留同一份固定 e2e bundle 的英文 8 項補充驗證與原繁中 13 項回歸。英文與繁中瀏覽器 CLI 均 exit 0，沒有 skip／flaky。封存只讀取既有檔案、核對來源與副本 SHA-256；不重建、不重跑驗證。

- [原始 build manifest](build-manifest.json)：input digest 為 9ae2ca2eb7508be78a0fcfa96ef99e1543189a644b6f3c1057d10d3c78664176，含來源與固定 bundle hashes。
- [英文 8 項原始報告](english/results.json)、[原繁中 13 項原始報告](chinese/results.json)、[實際固定 bundle](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/e232f22ae56fd372cae616dd981fe6f7e6c06312)。報告內原有路徑未重寫，可用 [receipt](proof-receipt.json) 的 originalPath／archivePath 對照。
- [執行摘要與真實 runtime 觀察](verification-summary.json)：包含自然 tick／audio time 進度、World／Canvas／AudioContext／continuous native source 身分，以及語言切換時的文件與 dispatch 觀察。62 項 Node gate 只整理已觀察結果，原始 stdout 未另存，不冒充原始逐行 log。
- [英文桌面](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/535b850ca0fc14ae1f102a8ebfc9ea82e058f549)、[英文 320px](archive://14da3d7fdcdb5dc73d69b6420238689e22f3846e/298876f7fdb44073d33d69afb39b664052063148) 已目視檢查。其他原始繁中畫面、下載檔與精確測試輸入一併封存。

實作範圍：繁中預設、可見語言選擇、偏好儲存與 document.lang、明確 React 翻譯鍵、主要操作／aria／表單／對話框／已知狀態英文、未知技術診斷原文保留。選語言不提交有效或無效草稿、不派送模型或 scene command、不重建引擎、Canvas、AudioContext 或連續聲源。使用者名稱、canonical IDs、原始數值、SI 單位與 JSON 保持原值。

此證據只涵蓋 UI 英文化與繁中回歸，不代替原 51 項整體驗收、跨瀏覽器音訊、native zoom、hearing／SPL 或完整 V1 完成。英文指南 EN-05 由文件 owner 另行核對；所有模型 propose 均由測試攔截且要求零模型呼叫。
