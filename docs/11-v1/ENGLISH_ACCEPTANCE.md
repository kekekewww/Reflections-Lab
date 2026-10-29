# 英文版本補充驗收

依[使用者新增需求](../00-project/V1_ENGLISH_VERSION_REQUEST_20261027.md)，本頁補充語言層驗收；原[51項矩陣](ACCEPTANCE.md)及受保護的contracts／tests保持不變。結果須引用實際新bundle與browser，不以翻譯字典存在宣告通過。

| ID | 通過條件 | 直接證據 |
| --- | --- | --- |
| EN-01 | 繁中預設、可見的繁中／English選擇、document.lang及本機偏好一致；reload保留選擇，無效或不可用storage安全回預設。 | 真browser選擇／reload及有界偏好負例。 |
| EN-02 | 主要Workspace、Inspector、Sound曲線／覆寫、FPS／建造、資產／匯入、錄放／A-B及AI固定介面與accessible names有英文。已知狀態／錯誤提供英文；未知backend原始診斷清楚標示來源、保留stable code，不隱藏錯誤。使用者物件／專案／資產名稱保持原文。 | 真英文操作流程、固定文字／aria檢查、已知錯誤與原始診斷案例；翻譯審查。 |
| EN-03 | 切換語言不派送模型或scene command，不改Project／Scene／Behavior／asset pins／SI數值，不重建Canvas或AudioContext，不重設run／tick／native voice；編輯中的raw／無效草稿保留。 | 真runtime前後文件／identity／clock與草稿檢查，區分自然運算進度與語言改動。 |
| EN-04 | 英文desktop與320 CSS px可讀、操作可達，無新增溢出／遮蔽；原有鍵盤、focus、reduced motion與輸入仲裁維持。 | 真browser截圖及目視檢查、鍵盤／layout測試；native zoom仍依原矩陣另記。 |
| EN-05 | 英文README／使用指南對應實際CLI、語言選擇與流程，明示approximation／Synthetic／Computed、offline與真Meta來源、預設付費gate及NOT RUN／外部門檻。 | 與package scripts／實際介面／證據核對；不宣稱hearing、SPL、未驗模型或完整品質已通過。 |
| EN-06 | 所有專案敘述文件有完整英文版或明確already-English對照，涵蓋架構／研究／驗收／Agent／Skill／Wiki與歷史；保留canonical來源、hash、時間與權利，翻譯不能改科學條件／數值／驗證狀態。英文連結可定位翻譯或共享資料；原文變更可偵測stale，不以索引／placeholder代替翻譯。 | 全檔inventory／source與translation hashes／連結及完整性檢查、分區翻譯與獨立忠實度審查；生成資料、第三方原始全文及已是英文的文件明示分類。 |

英文化屬presentation；技術ID、API、檔案路徑與資料不翻譯。新增驗收結果接回既有Task0016／Wiki／handoff，不建立第二套任務系統。
