# Persistent Wiki 隔離驗證

這是專案記憶工具的本地檔案協定驗證，不是 Reflection Lab 正式產品功能，也不驗證聲學或物理模型。

執行 `node --test tests/wiki/*.test.mjs`。測試以真實 Node 子程序、Git 與檔案操作，在忽略的 `.cache/wiki-tests/` 內建立每案獨立 fixture；不修改正式 `knowledge/`。本機 sandbox 的虛擬系統暫存目錄拒絕替換既有檔案的 rename，工作目錄中的相同 probe 成功，因此採專案內隔離暫存，不降級成先刪除再覆寫。

入口為 `node scripts/wiki/cli.mjs help --format json`；正式資料與操作規則由 `knowledge/schema.md` 說明。`ingest` 必須收到 Agent 提供的實際綜合內容與來源 metadata；工具不呼叫模型、不下載原文，也不產生假摘要。

## 實際保證與邊界

- cooperating writers 以 `knowledge/.locks/writer/` 的 exclusive mkdir 序列化；4 秒無法取得就明確失敗。任務 owner 必須附 agent、session、token；lease 過期不會自動轉移。
- crash 遺留的 writer lock 可用 `unlock --token <owner token> --reason <理由> --agent <ID> --session <ID>` 明確處理。只允許同 host、token 相符且持有程序已結束；存活程序不會被中止。exclusive recovery guard 序列化 unlock 操作；沒有 owner 或 guard 本身中斷時需人工先核對程序與檔案，不猜測可安全刪除。
- 頁面 patch 使用 SHA-256 `expected_hash`，新頁用 `null`。多頁預檢全部完成才開始套用；遇過時版本或明確 assertion 衝突，保留完整提案與既有正文。
- 每個檔案採同目錄暫存檔、fsync、rename；events 以 UUID 和 exclusive create 保存。多檔案**不是全域原子交易**，交易 journal 保存 preimage/proposal/hash；中斷後由 `recover <UUID> --action complete|rollback` 明確復原。journal hash 不符、外部修改或未知路徑均拒絕覆寫。
- journal 與 events 為可追溯資料；不要將對話逐字稿、秘密或無授權原文送入頁面。憑證模式篩檢只是保守輔助，不能取代人工檢查。
- `lint`、`query` 遇 active writer 會拒絕讀取，並檢查讀取前後 journal stamp；`query` 拒絕待復原交易。`status` 是診斷入口，會顯示 writer、pending transactions、過期 lease。
- YAML 使用鎖定的 `yaml` 2.x，拒絕 duplicate keys、aliases、未知 tags；單頁上限 1 MiB，metadata 深度上限 64。路徑拒絕 traversal、符號連結／junction、Windows alternate data streams 與裝置名稱。
- Query 是詞彙檢索，最多 10 筆、每筆最多 800 字元，附來源 ID／版本／hash。它不宣稱已回答語意問題或驗證事實。
- source ID 的 provenance 不可重寫；同路徑／hash／版本只保留一個 canonical ID。新版本須用新 ID 與 `supersedes`，保留舊 hash 並標 historical；歷史 ID 不可重新啟用，回復舊內容也要建立新版本。循環的來源或決策取代關係會被拒絕。歷史 hash 不是原始內容備份：舊正文仍需合法保存的原檔或 Git revision；目前沒有 commit 的來源不能靠 hash 還原。
- Query citation 包含 `snapshot_mode` 與 `current_hash_match`。historical citation 指向的檔案可能已變更；必須比對 hash 與保留的原始版本再作判斷。accepted／verified assertion 即使持有正確頁面 hash，也不得被普通 ingest 靜默替換；需 conflict record 與附理由的 reconcile。
- Lint 可比較結構化 assertion 的相同 key／不同 accepted 或 verified value，不能自動判斷任意自然語言矛盾。DONE 需要實際 artifact hash、已驗證驗收條件；命令與結果由操作者聲明，工具不冒稱自己執行了提供的命令。
- 純 CLI 手動流程可完成 checkpoint／handoff；沒有安裝或宣稱自動 Session Hook。來源與 evidence 的 hash 是本地釘選，不會自動查詢遠端新版或證明科學真實性。

## 可重現案例與結果

案例清單見 `tests/wiki/README.md`。測試同時覆蓋重複 ingest、supersede、dry run、來源失效、無效連結、孤立頁、衝突與 reconcile、跨程序 claim／更新、DONE 證據、手動 handoff、無 commit 的 Git HEAD、journal 中斷 complete／rollback、外部修改與 corrupt journal。

本機 symlink／junction fixture 若因 EPERM 無法建立，Node test runner 顯示明確 SKIP／NOT RUN；不能據此宣稱此平台已實測符號連結拒絕行為。完整測試數、命令、exit code 與執行時點由本階段驗證報告保存。
