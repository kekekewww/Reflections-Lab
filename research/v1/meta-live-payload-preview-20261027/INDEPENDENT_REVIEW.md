# Meta live synthetic payload 獨立審查

日期：2026-10-27。審查者：`/root/v1_ai_session_finish/sound_live_contract_review`。

結論：**PASS，限本版三份 payload 的資料分類、內容綁定與固定出口；不代表已執行付費模型或完成 live 驗收。**

## 審查對象與結果

已讀取三份完整 request、對應 readable JSON、[manifest](manifest.json)、產生器與實際 CLI。另以獨立 Node 程序驗證 raw／readable 深度相等、完整內容符合合成來源、tool 定義符合現行產生器，以及下列 UTF-8 bytes／SHA-256；全部通過。

| 階段 | 原始 request | bytes | SHA-256 |
| --- | --- | ---: | --- |
| Sound | [sound.request.json](sound.request.json) | 15299 | `6c5db0f41035bf9f3162a4b0424c4bc4f89d5126b9f2348219b7437aae4e3d8f` |
| Scene | [scene.request.json](scene.request.json) | 11979 | `1dd811bf45e98eefb9da7d7630f7945fed8eb31124c2b86a855476af8ad6b825` |
| Run | [run.request.json](run.request.json) | 12236 | `883a8064a086ff1bfa529784be73126bd147583abd49994c3af3a27af4174792` |

## 資料分類

- 三份 developer／user messages 只包含固定提示詞、合成預設資料與工具參數契約；完整 user JSON 已與 [defaults](../../../src/app/defaults.ts)、[固定 fixture](../../../server/meta-live-fixture.ts) 及 [Scene adapter](../../../src/ai/scene-adapter.ts) 的獨立結果比對。
- Sound 是固定預設 Behavior document、6 個示範物件的 ID／generation、材質 ID 與空的 asset registry；聲音生成器均為程序 oscillator。未提供 sample 資產、音訊內容或私人場景。
- Scene 是固定 6 個物件、SI 參數、合成材質標籤與 220 Hz 程序訊號。Run 是其明示新增示範球後的第 1 revision，共 7 個物件；不是從使用者儲存的 project 載入。
- Sound 只宣告 `ProposeSoundBehavior`；Scene／Run 宣告現有 11 個受限函式。沒有檔案系統、shell、repository、憑證讀取或任意 URL 工具。
- 三份完整 body 未見 credential marker、Authorization／Bearer 資料或本機絕對路徑。此判斷亦由完整合成來源相等性支撐，並非只依賴字串掃描。

## 實際出口與預算綁定

- [離線產生器](../../../server/meta-live-payload-preview.ts) 使用注入的 capture-only transport；不讀取金鑰、使用者專案或私人檔案，也不發出網路請求。
- [實際 CLI](../../../server/meta-live-validation-cli.ts) 先核對三份檔案與 manifest 的 bytes／SHA-256；實際每份 body 又在 `ledger.reserve` 及 `remoteFetch` **之前**核對同一組 bytes／hash。內容不符即停止該次派送。
- CLI 的 prompt/context 由固定 fixture 產生；catalog proof、ledger 與 preview 檔案僅作控制及核對，沒有被加入 prompt。金鑰只經 server loader 送入 Authorization header，不進入 body、payload hash 或本審查紀錄。
- 固定出口為 `POST https://api.meta.ai/v1/chat/completions`，`redirect:error`；模型為 `muse-spark-1.3`、host data mode 為 `standard`、`max_completion_tokens:1000`。持久共用 ledger 保留總額 US$1、最多 3 次、每次先保留 US$0.25 的限制；不重設額度。
- 先前已獨立通過完整 fake E2E 1/1 與持久 ledger 13/13。新增 bytes 綁定的 parent fake 測試不作本次審查者的實際模型證據。

## 邊界

本次審查程序的網路／推論請求均為 **0**，未讀取實際金鑰檔案，也未建立或修改正式 paid ledger。這份紀錄供同一命令重新送自動審查時引用，不新增授權、不替代自動審查，也不改變其先前拒絕的紀錄。實際 live、費用帳單、餘額與完整 run artifact 仍須依後續真實結果分別驗證。
