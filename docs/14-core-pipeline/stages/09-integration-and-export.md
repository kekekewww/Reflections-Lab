# Stage 09：正式產品瀏覽器匯出與獨立 WAV 驗證

日期：2026-11-02（台灣時間）。本報告固定「產品實際 Browser DOM 操作 → 下載檔 → 獨立 RIFF parser」的證據；不把 native Computer Use 逾時改成成功，不宣告完整 V1 或最終 source/main 已結案。

## 實際 UI 與來源

本次產品 source為 `42d25cb51d8e7d7621b3c1a7038ce00bf6e33459`，正式 bundle `dist/assets/index-27NgeX35.js`，SHA-256 `d285817d4852ce5b8bf6a56ff3d830430ccca76904ac3e4a2787330e22fc0316`。Chrome 156.0.8078.75 在 `http://127.0.0.1:4173/` 操作正式 UI。

Root先依 computer-use skill嘗試 native `sky.get_window`；兩次回覆 Computer Use app approval timed out，依skill停止該native路徑，沒有native輸入成功。後續改由Playwright MCP對真產品DOM操作，不以內部render API冒充UI下載。因此本輪native Computer Use為 **NOT COMPLETED／approval timeout**；Browser DOM操作與實際下載則已有下列證據。

操作順序：音訊匯出分頁 → 擷取3秒（180 ticks）→ 產生音訊檔案 → 逐檔下載mix／master／dry／ball stem／speaker stem → 下載來源manifest。截圖顯示短take完成、tick180及五個檔案入口，見[匯出畫面](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/ee63846ea5cb4c08690b1894fa379547df17ec70)、[DOM快照](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/f98b43d6180410bb86de3c956e4239061c2b3b31)與[來源紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/694dc6ffc2ba25189677f01d6984c223da9534a0)。這是當次畫面與操作證據，不是整體視覺品質／真人鍵鼠／聽測PASS。

## 實際檔案與獨立檢查

檔案保存在 `D:/Developing/Meta Hack/exports/core-pipeline-20261102/`；job為 `render-b5fbe4bd-78ec-4836-abb8-9dcd4ed792ca`。來源recording SHA為 `e9f3508faa83e98f47b037d8c465c535269bb08201e6228f3191eb2294dff990`，render configuration SHA為 `ca63bd605c7289b0885b549957806ab355dab0a55a648561d6fe6d8d2abbfac3`。完整檔名、hash與絕對路徑見[獨立機讀收據](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/073407528ed68aab5c9aaa1e8a9cffa41c8d52ac)，不把近10MB的WAV／原下載資料夾整批入Git。

獨立 `tests/browser/render/verify-downloaded-wav.mjs` 使用自己的RIFF parser，不呼叫產品WAVE encoder作為答案。收據固定verifier SHA、實際Node22.17.0、source／bundle與重跑命令。

- 5／5個檔案通過IEEE float32、雙聲道48kHz、240000 frames＝5秒（3秒take＋2秒tail）；每檔1920056 bytes。
- 所有PCM finite且nonzero，超出單位範圍樣本0；各檔與manifest hash、原下載與project exports copy hash全相符。
- 兩個pre-master物件stem相加對mix最大逐sample誤差 `1.4901161193847656e-8`，低於既有 `2e-6` 容差；master與dry各自與mix不同。
- manifest23871 bytes，SHA `ee724df50a7ef3857b8326439b5598688ce4b128b4351a824e114d3332001903`；所有詳細peak／RMS／首個非零sample留在JSON。

這些支持當次數位檔案與輸出語義，不能證明硬體播放、SPL、使用者聽感、任意場景／長take或600秒性能。native HRTF仍由browser管理；非線性master不要求獨立mastered stems可加。

## 主整合品質目前進度與保留失敗

以下是root當時回報的整合進度，最終stdout／退出碼與source仍待正式結案收據，不拿單句回報取代原始結果：

1. 第一輪完整check因隔離spike缺依賴停止；root以離線npm ci補足既有鎖版依賴，沒有藉此升級套件。
2. 第二輪23項失敗：19項涉及Host rebind過早發布，4項為舊oracle未納入新增欄位。root在 `42d25cb`修補並回報46＋8相關回歸通過；原FAIL與新結果需各自保留，不能把第二輪改標PASS。
3. 第三輪完整check當時進行到lint；還不是最終完整check通過收據。
4. 真Meta UI工作流程又揭露「Host已有metric但table空白」，root/UI代理正做最小修補及基本重驗。此UI功能不得僅由原Host183案或tabs smoke宣告完成；最後source將與本次42d25cb音檔匯出截點分開。
5. 原root memory已在 `4ba4378`保存snapshot，本地main尚未切換。最終SHA／位置與Claude完整後驗證待最後交接。

## Claude接手

先依[核心契約](../IMPLEMENTATION_CONTRACT.md)與[完整交接](../CLAUDE_CODE_HANDOFF_20261102.md)查最後品質／UI修補／main收據，再獨立驗證本頁source的檔案，或在最新source重新產生一批。不得把舊bundle下載證據平移成後來修改的fresh browser PASS。

本輪沒有付費Meta請求；fixture/offline、預算0與原live界線保留。原R17及研究600秒FAIL、裝置／科學／外部門檻仍在；Claude尚未執行本輪獨立重驗。
