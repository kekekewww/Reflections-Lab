# Persistent Wiki 原始參考與本專案採用範圍

查核：2026-10-26。已完整閱讀 Andrej Karpathy 原始 [LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f/ac46de1ad27f92b28ac95459c782c07f6b8c964a) 的 `llm-wiki.md`（75 行），包含核心理念、三層、操作、索引／日誌、可選工具及限制說明；不以留言或其他人的摘要代替。來源 ID：`SRC-KARPATHY-LLM-WIKI`。

## 來源與權利

| 欄位          | 實際查核                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 作者          | Andrej Karpathy（原作者帳號 `karpathy`）                                                                                                                                                                    |
| 原始 URL      | [Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)                                                                                                                                   |
| 固定 revision | `ac46de1ad27f92b28ac95459c782c07f6b8c964a`；由官方 Raw link／revision page 核對                                                                                                                             |
| SHA256        | `dc3efe98ae62f23dd08acad13aba2e95287beb20b6bec2f4af0423557fe37401`（原始 response bytes，11985 bytes）                                                                                                      |
| 取得時間      | `2026-10-25T19:41:51.3103005Z`（台北 2026-10-26）                                                                                                                                                           |
| 存取          | `FULL_TEXT_REVIEWED`；[固定 Raw URL](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md) 已在記憶體計算 hash，未保存全文 |
| 授權          | `UNKNOWN`：該 Gist 沒有明示 license；原文鼓勵給 Agent 使用不等於一份可再散布的開源授權                                                                                                                      |
| API 限制      | GitHub Gist API 兩次回 502；沒有把 API 失敗寫成未讀全文，也沒有虛構 API history 結果                                                                                                                        |

本庫只存來源 metadata、連結與自行撰寫的設計對照；未 vendor Gist 全文。SHA256 固定內容，不能證明原文觀點已經實驗驗證。

## 採用與加強

原文提倡將來源整理為持續修訂、彼此連結的知識，另以 schema 約束維護，再用內容索引與時間日誌找回工作。本專案採用此模式；原文關於效率／維護成本的經驗敘述不視為本庫的量測結果。[原始參考](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f/ac46de1ad27f92b28ac95459c782c07f6b8c964a)

| 設計面向                       | Reflection Lab 的具體處理                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Immutable sources              | 優先索引既有 `research/`、`docs/`、測試與 Git；來源 metadata 固定版本、hash、存取程度及授權，不複製建立平行權威 |
| 綜合 Wiki                      | `knowledge/wiki/` 保存跨來源的短頁；需求、ADR、程式、量測與任務狀態各依自己的權威來源核實                       |
| Schema                         | `knowledge/schema.md` 定義格式、狀態、更新、衝突及並行協定；根入口只載必要規則                                  |
| Index 與 log                   | index 提供導覽；每次有意義更新保留事件，log 是可重建的時間索引，不能靠重寫 log 抹除原始事件                     |
| Ingest／query／lint            | 以共同 CLI 協助去重、校驗、搜尋與記錄；Agent 負責審讀、來源判斷及知識整合，lint 不自動解決科學矛盾              |
| Checkpoint／handoff／reconcile | 是本專案為跨 session／多 Agent 增加的工程要求，不能冒稱原始 Gist 已提供實作或可靠鎖                             |
| 初版搜尋                       | Markdown index＋詞彙搜尋；qmd 是可選候選，不先引入 embedding pipeline 或 MCP service                            |

原始 Gist 不是交易、競態、權利或證據狀態的完整規格。本庫額外區分 `VERIFIED`、`ACCEPTED`、`PROPOSED`、`EXPERIMENTAL`、`UNVERIFIED`、`DEPRECATED`；同時保留實作／測試／物理驗證的差別。來源有衝突先留下紀錄，不由最後寫入者決定真實性。

## 可證明與尚未證明

共同知識庫的完成標準是可重現的 ingest、去重、連結、任務證據、歷史、交接與並行失敗測試；具體結果應追溯實際測試報告。建立檔案與通過 schema lint，不能證明摘要正確、聲學模型正確或所有 Agent 都會遵守規範。

跨工具能力與本機版本見 [相容性報告](AGENT_COMPATIBILITY.md)，搜尋選擇見 [搜尋引擎評估](SEARCH_ENGINE_EVALUATION.md)，來源欄位與唯一權威規則見 [Schema](../../knowledge/schema.md) 及 [Source Manifest](../../knowledge/sources/manifest.json)。本次沒有讀取或保存全部私人對話、推理、憑證、雲端記憶，也沒有把上游示例轉成正式產品開發授權。
