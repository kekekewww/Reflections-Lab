# Wiki 搜尋引擎評估

查核：2026-10-26。初版採 **Markdown index＋本庫詞彙搜尋＋`rg`**。目前是約百份 Markdown 的研究庫，尚未有檢索品質資料證明需要向量模型；此選擇符合使用者要求，也保留未來替換搜尋層的空間。qmd 本次未安裝、未下載模型、未啟動 MCP。

## qmd 官方來源與版本

已讀 [tobi/qmd](https://github.com/tobi/qmd) 官方 README 的完整 main 內容，以及固定發行版的需求、安裝、搜尋與 API 說明；另核對 package、LICENSE、CHANGELOG 與 CI。程式授權為 MIT，作者 Tobi Lutke。模型與 dependencies 的權利仍需各自核對。[LICENSE](https://github.com/tobi/qmd/blob/facd35e01359e59d938bc9418e93fb9318addee3/LICENSE)

| 對象              | 固定資訊                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| 已發行版本        | npm `@tobilu/qmd@2.8.3`；tag `v2.8.3` → commit `facd35e01359e59d938bc9418e93fb9318addee3`          |
| 發行 README hash  | `24c049f59408d3d021fbee70d4cd5dd744cdb51f5caea956b417f4dfe7e26880`                                 |
| 發行 package hash | `14462e2764e9d140afbeb3c924e6dd81c0448177e97785822e763d901d70f20b`                                 |
| LICENSE hash      | `24c446836e7e2cdea13a914de10c88c553e6297366061ba24013b8ce73c8f7fa`                                 |
| main              | commit `86d2365d17fc682e491c2c53d1e4a884aee8682a`；CHANGELOG 含 Unreleased，不能等同已發行 `2.8.3` |
| 取得時間          | `2026-10-25T19:38:00.2616339Z`（台北 2026-10-26）；原始 bytes hash 與來源位置登錄 Manifest         |

README／package／LICENSE 使用 `SRC-QMD-README-MD-V2-8-3`、`SRC-QMD-PACKAGE-JSON-V2-8-3`、`SRC-QMD-LICENSE-V2-8-3`；main 的 README／CHANGELOG／CI 另有獨立 source IDs。不可只保存可變 `main` URL 來聲稱可重現安裝。

## 能力、成本與本機邊界

| 選項                     | 適用性與限制                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| 本庫 lexical query／`rg` | 無額外模型或服務；可直接定位英文 ID、API、path 與繁中片語。不是語意理解，也沒有保證詞形、同義詞或跨語召回 |
| qmd `search`             | SQLite FTS5／BM25；查詢不需 LLM，但安裝仍帶 native dependencies                                           |
| qmd `vsearch`            | 語意向量搜尋，需要 embedding 與重建索引；跨語及繁中效果尚未在本庫驗證                                     |
| qmd `query`              | hybrid、查詢擴展與 reranking；會增加本地模型、記憶體與延遲需求，分數不是證據可信度                        |
| qmd CLI／MCP             | 可從 shell 用 CLI，也提供 stdio／HTTP MCP；本庫沒有設定或啟動服務                                         |

以上產品能力據 [固定版 README](https://github.com/tobi/qmd/blob/facd35e01359e59d938bc9418e93fb9318addee3/README.md)。其需求為 Node ≥22 或 Bun ≥1.0.0，依賴包含 `better-sqlite3`、`sqlite-vec`、`node-llama-cpp`。本專案 Node 22.17.0 滿足 qmd 的宣告下限，仍不能據此保證 native 安裝成功。[固定版 package](https://github.com/tobi/qmd/blob/facd35e01359e59d938bc9418e93fb9318addee3/package.json)

package 提供 Windows x64 的 sqlite-vec 選配套件，README 亦有 Windows CUDA 注意事項；查核的 [main CI](https://github.com/tobi/qmd/blob/86d2365d17fc682e491c2c53d1e4a884aee8682a/.github/workflows/ci.yml) 只列 Ubuntu／macOS。這支持「有 Windows 相關實作」，不支持「本機 Windows 已可用」。安裝、native backend、索引、檢索速度與記憶體測試均 **NOT RUN**。

若未來要安裝，先在隔離 spike 固定 `@tobilu/qmd@2.8.3` 及 lockfile／integrity，審查 native install scripts；本次沒有執行 README 的全域安裝、`bunx`、模型下載或 MCP 設定。更新版本須重新查核，不使用未受控的 `latest`。

## 初版與升級條件

查詢先讀 [Wiki 索引](../../knowledge/wiki/index.md)，再用共同 CLI 定位頁面；需 exact text 時可直接：

```powershell
npm run wiki -- query "Steam Audio individual paths" --format json
rg -n --glob '*.md' 'individual paths|聲線' knowledge docs research
```

搜尋結果必須帶檔案／來源定位；Agent 應追溯原始證據及狀態，不能把命中排序當正確性排序。索引只涵蓋明定的文字範圍，不讀 `.env`、私人 session、`node_modules`、binary cache 或大型第三方全文；檔案範圍以共同 CLI／Schema 為準。

未來有重複的找不到、跨語召回不足或搜尋成本明顯上升時，再開 retrieval spike。先建立含預期來源的繁中／英文問題集，覆蓋 ADR、SDK capability、任務、失效決策與相反主張；比較現有搜尋、BM25、hybrid 的 recall@k／MRR、無關命中、來源定位、冷熱延遲、索引時間及磁碟／記憶體。資料量門檻不是性能量測；沒有以上結果前不宣稱 qmd 優於現有工具。

搜尋索引必須可從原始 Markdown 重建。即使後續採 qmd，`knowledge/schema.md`、Source Manifest、穩定頁面 ID 與檔案 handoff 仍維持共同契約，不將 SQLite、MCP 或任一 Agent 設定變成唯一知識副本。
