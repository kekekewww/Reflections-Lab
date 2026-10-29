# 英文版本範圍確認：介面與所有專案文件

2026-10-27使用者明確選擇「介面＋所有專案文件」。這取代[先前合理預設範圍](V1_ENGLISH_VERSION_REQUEST_20261027.md)中的「介面＋README／使用說明」，原第一版實作與驗收目標持續。

英文介面與繁體中文共用同一套實作。英文文件涵蓋專案撰寫的Markdown敘述：需求／架構／ADR、研究摘要、SDK／操作／驗收、Agent／Skill規範、Wiki與歷史交接、prompts與各模組README。已有英文的文件列為已涵蓋；第三方授權及原文保留原始來源與權利，不大量翻譯／重散布受限制SDK文件或論文。

繁中原文與正式資料權威保留。英文翻譯放在`docs/en/`並提供完整入口、canonical path／source hash、翻譯hash／狀態及連結查核；既有`README.en.md`與英文使用指南沿用。新英文Wiki是可閱讀的翻譯投影，不另建task JSON、run ledger或互相矛盾的工作系統。

原始schema、Task ID、事件、API、path、程式碼、命令、數學公式、測試／量測資料與來源紀錄共用，不為語言製造另一組結果。英文敘述須忠於原來源時間與PASS／FAIL／NOT RUN、近似／Synthetic／Computed等界線；歷史文件不得被翻譯成當前已通過。原文變動須標示翻譯過期並更新，不能只靠英文索引或未翻譯placeholder宣稱全套完成。

[英文補充驗收](../11-v1/ENGLISH_ACCEPTANCE.md)與原51項矩陣並行，不放寬原驗收或提高API預算。所有翻譯工作仍由Codex進行，不使用Muse Code或新增Meta付費請求。
