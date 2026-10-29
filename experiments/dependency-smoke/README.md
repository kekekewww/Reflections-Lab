# 依賴與環境驗證的範圍

本目錄屬於 Reflection Lab 的研究前製準備。依賴載入、幾何數學與物理套件的隔離測試，只證明指定版本在記錄的執行環境能完成該項檢查；不代表正式產品、瀏覽器渲染、音訊輸出或即時效能已完成。

## 可重現環境

根目錄的 `package.json` 與 `package-lock.json` 是 Node 依賴版本的依據。使用 `npm ci` 安裝鎖定依賴，接著執行根目錄定義的驗證指令。基準環境為 Node.js 22.17.0、npm 11.4.2、Python 3.12.11。

```powershell
node scripts/setup/environment.mjs --strict
node scripts/setup/environment.mjs --strict --output benchmarks/results/environment.local.json
```

環境腳本只使用 Node 內建模組，輸出實際工具版本、作業系統、CPU 架構、CPU 型號、邏輯處理器數、總記憶體與 UTC 查核時間，不記錄環境變數內容或憑證。`--strict` 在必要的 Node.js 或 npm 版本不符、缺漏時回傳狀態碼 1；Python 會回報但屬選用工具，因此不影響此模式的通過與否。無效參數或輸出寫入失敗回傳狀態碼 2。未指定 `--strict` 時，版本差異只會出現在 JSON 報告。

報告中的記憶體與時間是該次執行環境快照；每次執行不會得到完全相同的檔案。把報告與測試結果一併保存，才可解讀不同機器間的測量差異。

## 物理執行驗證

Rapier 實際執行驗證由 `experiments/physics-spike/` 的隔離腳本負責，版本與具體執行方式以該目錄的說明為準。本目錄不重複宣稱物理測試結果；固定時間步長的單機數值結果也不能直接推論跨平台位元一致、第一人稱互動、抓取穩定性或碰撞音訊已通過。

數學 fixture 的預期值、參考公式與容許誤差應在測試資料與 `docs/06-validation/` 中記錄。解析測試通過屬於對指定模型的驗證，仍需獨立求解器比較、DSP 驗證及實際量測才能支持更高層級的聲學正確性主張。
