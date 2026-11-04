# 幾何資料與模型版本契約驗證

Task0030；本輪只新增 `tests/acoustics-runtime/geometry-contract.test.ts`，未修改產品程式、舊數值基準、容差或 Git index。

13／13 測試通過。覆蓋舊平面請求不新增欄位、未知版本拒收、舊版 pin 拒絕新幾何／動態反射器、空幾何 extended pin、OBB 格式／稀疏陣列／跨集合重複 ID，以及三種幾何合計數量上限的正反案例。

實際 `AcousticService` 搭配實際 `solveAcoustics` 經 structured-clone 測試傳輸，確認 OBB 姿態保留與移動後遮蔽更新。派送後修改呼叫端資料不能改寫已派送 snapshot 的模型期待；錯誤 backend、模型版本或 path ID 前綴皆被攔截。此傳輸不是原生瀏覽器 Worker。

新測試檔 ESLint 與 Prettier 檢查皆為 exit 0。命令、原始輸出及當時程式 SHA-256 見 `geometry-contract-verification.json`；測試原始輸出為 `geometry-contract.txt`。此收據只證明資料契約及服務邊界；曲面數學獨立 reference 由其他子任務驗證，瀏覽器、實際 WAV 匯出、聽測、實體量測及完整整合檢查不在本收據範圍。
