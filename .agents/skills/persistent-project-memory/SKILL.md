---
name: persistent-project-memory
description: 維護 Reflection Lab 跨 Agent Wiki、來源、任務、Checkpoint、衝突與交接；用於重要研究、實作或 Session 交接，不保存私人對話歷史。
---

# 持久專案記憶

## Trigger / Purpose

新 session 恢復工作，或需求／決策／實作／研究／測試／Bug／UI設計有重要變更時，將可追溯知識接回既有綜合頁。不要只新增孤立報告。

## Inputs

Task ID、agent/session、原始來源與權利、變動檔案、真正執行的驗證、未完成事項。

## Workflow

1. 讀 AGENTS → knowledge/schema → wiki/index → now → 相關task/最新handoff，只載入任務所需頁。
2. 以 Git／實際檔案核實；無HEAD如實記null。查既有來源版本與Wiki，先避免重複研究。
3. `npm run wiki -- status`；需要認領時使用CLI claim/token/lease與明確分檔，不以文字宣告當作跨機鎖。
4. 新證據先合法索引manifest，準備綜合page plan與expected hashes；`ingest`先dry-run再套用。Source版本變更另建ID、supersedes舊record。
5. 更新task criteria/evidence；DONE必須查檔案與結果，不能只因Agent說已完成。不得把計畫、實作、測試、物理驗證混在一起。
6. Authority或stale-write衝突用reconcile/conflict記錄，保留原始proposal，不採last-writer-wins。
7. 重要成果checkpoint；session結束handoff並更新now，記真正命令/結果/risks/next。未配置自動hook，手動流程不能省略。

## References

- `knowledge/README.md`、`knowledge/schema.md`
- `knowledge/wiki/index.md`、`knowledge/wiki/now.md`
- `docs/09-knowledge/WIKI_OPERATIONS.md`、`AGENT_COMPATIBILITY.md`
- `scripts/wiki/cli.mjs`（以help確認實際參數）

## Outputs

原始證據／source版本、互相連結的綜合page、task及可供無上下文Agent接手的handoff；index/log由events重建。

## Validation

`node scripts/wiki/cli.mjs lint --format json`、`npm run test:wiki`；必要時讀原始artifact／重新驗證。Windows npm wrapper可能吞`--format`，傳flags用直接node。lint不能自動證明任意自然語言沒有矛盾，query不能代替研究。

## Failure Handling

過期hash/lock/transaction先記診斷，不強制刪除或覆寫。重要衝突留UNRESOLVED並繼續無相依工作。禁止記keys/token、逐字完整聊天或私人中間推理；不推送／接受條款／部署。
