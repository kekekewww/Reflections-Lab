# UI參數審核補充：實作尚未支援的選項

日期：2026-11-02（台灣時間）。使用者已明確回答「也實作尚未支援的選項」，見[正式來源](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1863912da15dd68ade3ee77d87fb9cff0307e4f8)。本補充優先於[本輪契約](CONTRACT.md)原先SCOPE_PENDING及六core契約中相應unsupported的本輪範圍限制；原六core截點與測試結果保留，不回寫歷史。唯一正式任務仍是Task0028，不另建平行任務系統。

## 現行要求

1. 完整盤點產品中可見的未支援選項及其說明，逐項區分缺少產品實作、合法狀態／資料前置條件，以及外部帳號／裝置／權限gate。不能將可實作的缺口改名為外部gate，或只列後續計畫便結案。
2. 對尚缺產品能力的選項完成實際實作，涵蓋資料／作者設定、真runtime producer、共用capability及UI／AI／Preview／Host的相關入口。OnZoneEnter／OnZoneExit需要實際區域作者設定與真事件producer，不能只移除disabled或用合成事件冒成功；具體技術設計另依Domain／schema／ADR核實。
3. 五lane既有已開放參數測修繼續；新增功能後刷新靜態分母／source pins／crosswalk，保存初版及原FAIL，重測受影響的有效／非法／邊界、狀態、持久化與undo及適用真production DOM流程。未跑的組合標NOT RUN。
4. 若仍有真外部前置／不可執行gate，逐項保存已證實原因、可解除條件、實作與驗證狀態；不虛假enable，不將未取得帳號／裝置證據寫成PASS。外部gate不授權付費或提高Meta預算。
5. Task0028與本地main須等待新增實作及必要重驗；Claude獨立後驗證、原600秒性能FAIL、科學／裝置／Meta live及外部要求仍各自判定。

## 授權與實際狀態

這是新增實作要求已確認，尚未代表任何新能力已完成。root正在安排完整unsupported盤點及Zone等實作；原五lane審核照常。本輪仍為IN_PROGRESS，預算0、無push／部署／新付費請求；native Computer Use先前app approval timeout的界線不變。
