# 重複查詢測試資料修正

原整合執行在 conflicting duplicate 案例得到樣本數 7（預期 6）。預設場景的球體使實際錄製使用 extended 聲學模型；人工建立的重複查詢只有空平面集合，未標模型版本，求解器因此回傳 legacy。指標依契約先排除不同 backend/version 的查詢，故未形成兩筆同模型的歧義。

僅在該人工查詢新增原 frame 的 `modelVersion`，並於追加前檢查 backend ID／version 相同。移除這三行後與保存的原檔完全一致，樣本數 6、invalid 2、5／343 與所有原容差未改。產品程式、Git index 未動。

全檔 7／7 通過（10.206 秒），ESLint 與 Prettier exit 0。`metrics-population-verification.json` 提供命令與精確 SHA-256；原整合輸出、原檔及本次 focused raw 已保存。本收據不代表完整整合或瀏覽器／音訊驗證。
