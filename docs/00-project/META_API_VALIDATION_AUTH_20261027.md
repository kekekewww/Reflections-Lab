# Meta Model API 小型 Live 驗證授權

2026-10-27使用者指定本機server金鑰檔，並明確選擇本次Live驗證總支出上限 **US$1**。此頁只保存工程所需授權，不保存金鑰、雜湊、Authorization或完整私人對話。

金鑰由server讀取，不放browser、Git或Wiki。開發Muse Code額度與作品Meta Runtime分別管理；使用者回報Muse Code可用，不等於已查證產品餘額。

本次驗證採每次US$0.25保守預留、最多3次請求。三次已用完，累計預留US$0.75，剩餘請求0；不自動增加次數或上限。成功回應usage估價US$0.0073235，前兩次400及實際帳單未知，餘額保持null。[共享ledger](../../research/v1/meta-live-budget-20261027.json)。

真實Sound proposal的[結果與範圍](../../research/v1/meta-live-validation-20261027-r3-minimal/summary.json)及[獨立驗收](../../research/v1/meta-live-validation-20261027-r3-minimal/independent-live-review.json)保存provider/model/response IDs、usage、Host Apply與本機Run provenance。只驗證RemoveBinding／AssignBinding；Scene live、Meta規劃Run、產品UI Live、硬體音訊與聽測仍未通過。

一般app預設付費gate仍為0。操作與重新執行保護見[說明](../../server/META_LIVE_VALIDATION.md)。這次US$1授權不代表可提高付費帳號限制、切換帳號、公開或部署。
