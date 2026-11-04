# Pipeline Dock／Paths／Comparison 實測交付

這份報告分開保存來源與方法，不把不同版本合成單一乾淨全通過批次。動作為 Playwright CLI scripted DOM／headless Chrome，只讀 DOM 取得證據；不是 native app／MCP／真人輸入。

## 實際結果

- `navigation-paths-receipt.json`：舊來源 19db／index-BDGeI4Sd 的七分頁逐一 pointer、方向鍵 wrap／Home／End、收合、逐條五個 solver path 選取、單位／來源、Help hover／focus／Escape 與英文切換 PASS。新八分頁由 Zone 的 source9fc 第一案另有完整實測；本報告不重標舊七分頁為新版。
- `paths-state-receipt.json`：同舊來源，以真介質 UI 切 vacuum，無假路徑、舊選取不存在提示與不可用原因，再恢復 air／真 solver rows，PASS。其他 transient／error／unsupported 狀態沒有安全誘發，未列 PASS。
- `final-49bde82-02/comparison-receipt.json`：source49／index-C4qRBPy8，Comparison 單案 PASS，31.9 秒；實際 HTTP SHA256 8d4f079ed98894648a0da35092471f730644128a2e3d569dc5fb191210b84123。真測空 A／B 的 Host 拒絕、產品受控三秒錄製、保存 A／B、acoustic 與 behavior 相同條件比較、材質 B 重評、behavior 不相容拒絕、更新 A 清 B，以及新增物件後 B 被 object-set guard 拒絕。
- 對應原 source49 第一輪不是產品失敗：最後一個拒絕已正確出現較早的「重評物件集合必須與原運動及 scene 相同」，舊斷言等待較晚 generic geometry 文案。只修該 expected 文案、另開新 attempt，不改產品／guard／判準；原 stdout、receipt 與 trace 全留。
- 最初三案失敗為 inventory CSS selector `[tabindex=0]` 未加引號；另一次 Comparison 把真正 App 全域 alert 錯限在 dock。均保留原證據，沒有把這些 harness 錯誤歸咎產品。

## 逐項機讀與限制

`parameter-inventory.json` 是此子面板的控制／方法／狀態映射，引用各 raw receipts。讀值不是可編輯控制；無任意 path gain／delay 編輯器。比較 enum 只有 acoustic／behavior，不透過 DOM 注入非法選項。

Paths與Events table的原19db證據只有focus與鍵盤派送，未證overflow變化；其後source501[最後Help／scroll單案](../help-sweep/REPORT.md)已取得真inner horizontal：Paths left0→6→0、Events0→191→151，實際wheel與ArrowLeft；outer垂直clip尺寸／scrollTop分開保存，不冒inner垂直PASS，未改CSS／DOM style。Path provenance與Comparison各caller的pointer／focus／Escape也有自己的非空內容觀測；原19db frozen raw不覆寫，也不借generic HelpTip補填。正式Host無空comparison.status，因此僅該fallback caller維持NOT_OBSERVED。

曲面／動態反射器的新物理模型、完整 WAV 與 Root 的最終新場景另有獨立完整管線收據。本報告只對實際看到的數值／狀態／UI 方法負責，不宣稱 RT60、校準 SPL、聽感、600 秒性能或整個 V1 驗收通過。
