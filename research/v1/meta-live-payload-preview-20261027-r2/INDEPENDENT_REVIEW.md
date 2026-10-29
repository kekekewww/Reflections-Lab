# Meta live r2 獨立審查

日期：2026-10-27。審查者：`/root/v1_ai_session_finish/sound_live_contract_review`。

結論：**PASS，限 r2 合成 payload、診斷遮罩與停派控制的離線審查。** 未確認首筆 HTTP 400 根因，不保證下一次模型請求成功；本紀錄不是新的費用授權。

## 完整 payload 核對

已讀取三份完整 raw request、readable JSON、[manifest](manifest.json) 與 [離線修復紀錄](OFFLINE_REPAIR_AUDIT.md)。獨立程式逐份驗證 raw／readable 深度相等、UTF-8 bytes、SHA-256、全部 user JSON 與完整 tool 定義，結果全部相符。

| 階段 | request | bytes | SHA-256 |
| --- | --- | ---: | --- |
| Scene | [scene.request.json](scene.request.json) | 11979 | `1dd811bf45e98eefb9da7d7630f7945fed8eb31124c2b86a855476af8ad6b825` |
| Sound | [sound.request.json](sound.request.json) | 15430 | `71e9291cc763a9d3b7c0a4b912f38b4ca5368845ec0dd89cc0188205025db704` |
| Run | [run.request.json](run.request.json) | 12236 | `883a8064a086ff1bfa529784be73126bd147583abd49994c3af3a27af4174792` |

完整內容與 [合成 defaults](../../../src/app/defaults.ts)、[固定提示詞／oscillator registry](../../../server/meta-live-fixture.ts)、[確定性 Scene adapter](../../../src/ai/scene-adapter.ts) 及現行 tool schema 產生器的獨立結果一致。Scene 使用固定 6 個示範物件；Sound 使用明示新增示範球後的 scene revision 1／7 個物件與未修改的預設 Behavior document；Run 使用同一固定 Scene。聲音為程序 oscillator，asset registry 為空。

沒有使用者儲存的 project、私人檔案、sample 音訊或金鑰內容。三份完整 body 未見 credential marker、Bearer 資料或本機絕對路徑；這項分類同時由完整來源相等性支撐。工具僅有 Sound proposal 或原 Scene／實驗白名單，沒有 filesystem、shell、repository 或任意 URL 工具。

## 診斷、流程與預算控制

- [sanitizer](../../../server/meta-http-diagnostic.ts) 先遮罩傳入的完整 key 與任何大小寫的 `LLM_` token，再清理控制字元及截斷；只保留 `code/type/param/message` 四個有上限的字串，另加固定 kind，不複製 body、headers 或其他巢狀欄位。
- [CLI](../../../server/meta-live-validation-cli.ts) 會在 `ledger.settle` 前保存清理後 HTTP receipt。已知 4xx 的拒絕與 ledger 停止分別保留；reserve 拒絕使用 `BUDGET_EXCEEDED`，不再誤標成 transport timeout。
- phase 內沒有自動 proposal retry，provider `maxRetries` 為 0。執行順序是 Scene → Sound；是否增加模型 Run 請求取決於同一持久 ledger 的 `remainingRequestSlots`。有既有一筆保留的 fixture 測試只新增 2 次模型請求，Run 明示為本機 `HOST_EXPLICIT_FIXED60`，不是 Meta Run。
- [ledger](../../../server/meta-live-budget.ts) 的 HTTP 400 acknowledgement 僅追加明確紀錄，不改寫原 attempt、usage、帳單未知狀態或 US$0.25 保留。未知 transport／其他 HTTP／usage 問題仍停止，總額 US$1、每次 US$0.25、最多 3 次的政策維持。
- manifest／body 檔案在 key loader 前核對；每次實際 body 的 bytes／SHA-256 又在 reserve 與 remote transport 前比對。內容差異不保留額度、不派送。固定官方 endpoint、`muse-spark-1.3` Standard、1000 completion tokens 與禁止 redirect 的限制不變。

## 獨立執行證據與限制

- `node --import tsx --test tests/ai-runtime/meta-http-diagnostic.test.ts tests/ai-runtime/meta-live-validation.test.ts`：**6/6 PASS**，包含 prior HTTP 400 共用額度、零派送 mismatch 與先保存遮罩診斷的 400 反例。
- `node --import tsx --test tests/ai-runtime/meta-live-budget.test.ts`：**17/17 PASS**，包含 acknowledgement 不清除未知結果、不退款、不增加三次上限，以及資料與鎖的保留。
- 本次完整 preview 比對：**PASS**；測試的 transport 全為注入 fake，檔案僅使用測試暫存目錄。

本次審查沒有讀取實際 key、catalog 或正式 paid ledger，沒有發出網路／模型請求，也沒有修改 r1 或舊失敗證據。唯一新增檔案為本紀錄。首筆 400 的原因仍未知；不得據此推定零費用、成功推論或已完成 live 驗收。
