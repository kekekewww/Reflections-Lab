# Reflection Lab 持久專案知識

這是跨 Codex、Claude Code、Pi 與其他檔案型 Agent 的共同入口。沒有私人模型記憶、雲端資料庫、隱藏 Hook 或付費 LLM 依賴。

1. 新 session 先讀 [Schema](schema.md) → [Index](wiki/index.md) → [Now](wiki/now.md)。
2. 由 [Tasks](wiki/tasks.md) 找 task JSON、依賴／驗收，再讀最新 [handoff 索引](wiki/handoffs/index.md)。
3. 只展開相關 Wiki，並回到其 Source Manifest／原始 docs、research、code／測試核實。

## 三層與唯一權威

| 層 | 位置 | 規則 |
| --- | --- | --- |
| 原始依據 | 既有 docs/research、固定實驗結果、需求副本、Git；sources/manifest.json 索引 | 不為了 Wiki 搬移或重複文件。每個來源版本固定 ID/hash，更新另列版本／supersedes；不能以摘要覆蓋證據 |
| 綜合 Wiki | wiki/ | 將研究、決策、功能狀態、風險與任務串接。數據保持引用與限制；不把猜測升格 VERIFIED |
| 規則與工具 | schema.md、scripts/wiki、schemas/wiki-*、project Skill | metadata、更新、claim／衝突／handoff與可重現驗證 |

既有 `docs/ROADMAP.md` 是正式路線；`wiki/roadmap.md` 只是導航。`docs/05-ux/` 是設計規範與 tokens 權威；Wiki 不重複維護參數。`knowledge/tasks/*.json` 是任務權威，`wiki/tasks.md` 為衍生索引；`events/*.json` 是不可變操作事件，`wiki/log.md` 可由事件重建。完整歷史不靠持續累積的 now 保存。

## 工具

```powershell
node scripts/wiki/cli.mjs status --format json
node scripts/wiki/cli.mjs query "FPS grab" --format markdown
node scripts/wiki/cli.mjs lint --format json
```

其餘 ingest/checkpoint/handoff/claim/reconcile 的準確語法以 `npm run wiki -- help`、[操作說明](../docs/09-knowledge/WIKI_OPERATIONS.md) 與 Schema 為準。所有 mutation 支援 dry-run；query 是本地詞彙檢索，不是語言模型合成答案。Agent 需閱讀原文、整理綜合頁並提供 plan，不能把工具輸出當成新的研究。

Windows PowerShell 的 npm wrapper 在本機會將 `--format` 當 npm 參數吃掉；需傳 flags 或機讀 JSON 時直接用上述 `node` 命令。無 flags 的 `npm run wiki -- status`／`help`仍可用。

## 同步與維護

只在重要進展 checkpoint，不逐次記工具呼叫、不存完整對話或中間推理。版本化 Markdown／JSON／YAML；保留 license／來源，受限論文只索引。不存 keys/token、私人帳號或機密。沒有 Git HEAD 時如實記 null；不自動 commit/push。跨 worktree／機器的鎖互不相通，依檔案分工與 Git reconcile，不能宣稱全域獨占。

Session Hooks 尚未配置；session 結束前手動 handoff 為必行流程。相容性依據與本機安裝／未驗證範圍見 [AGENT_COMPATIBILITY](../docs/09-knowledge/AGENT_COMPATIBILITY.md)。
