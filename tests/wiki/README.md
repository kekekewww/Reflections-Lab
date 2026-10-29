# Wiki CLI 回歸驗證

執行：`node --test tests/wiki/*.test.mjs`。

所有案例在忽略的 `.cache/wiki-tests/` 建立獨立且唯一的 repository fixture；不改寫正式 `knowledge/`。本機 sandbox 對作業系統暫存目錄的原子 rename replace 回傳 EPERM，因此使用已授權 workspace 內的隔離目錄，不以先刪除舊檔取代原子 rename。來源、合成頁面、任務、驗證 artifact 與 ingest plan 由測試以開放格式建立；清理前確認目錄位於測試根目錄，測試結束只移除自己的 fixture。Handoff 案例建立沒有 commit 的 Git repository，確認分支取自 Git、revision 記為 `null`。

測試直接執行 CLI，不模擬檔案系統。並行案例同時啟動兩個 Node 子程序，檢查獨占 claim 與 manifest／頁面／events 不會無聲遺失。若某個 ingest 因鎖定明確失敗，案例再執行該提案，最後檢查兩份內容與歷史都存在。

目前涵蓋：

- 合成 ingest、來源 hash、頁面與索引更新；相同 ingest 冪等；dry run 無持久變更。
- 無效連結、孤立頁面、重複 ID、遺漏 citation、變更後失效的來源與 artifact hash。
- 過時 expected hash、多頁預檢拒絕與完整 proposal 保留；結構化 ACCEPTED assertion 衝突；明確 reconcile 後保留原衝突。
- 真正跨程序並行 ingest／claim；claim token、heartbeat、release；過期 lease 不自動轉移所有權。
- DONE 必須具有實際 artifact hash 和已驗證 acceptance criteria；替代決策保留舊正文與雙向 metadata。
- 限長詞彙查詢附來源引用；可手動產生含 Git、修改範圍 hash、命令、風險與下一步的 handoff；唯讀命令重跑不改寫內容。
- 輸出格式錯誤必須先拒絕；YAML alias、重複 key、過大或過深 metadata 必須拒絕；Windows ADS 路徑不得進入寫入流程。
- 模擬部分檔案已寫入的 journal，驗證明確 complete／rollback 與重跑；外部修改與 journal hash 損壞必須保留現場；symlink/junction 越界案例若本機不允許建立 fixture，明確列為 NOT RUN。
- 既有 `docs/02-architecture/adr/` 的 ADR heading ID 可作為正式決策引用，不要求修改權威文件的檔名。
- 遺留 writer lock 必須以原 token、明確理由與實際已退出的子程序證據解除；存活 owner 拒絕解除，query 拒絕讀取 writer 正在修改的知識，status 可顯示診斷資訊。
- 同一路徑來源換版使用新 Source ID 與顯式 supersedes；舊 hash 保留為 historical。缺少 predecessor、不同路徑、循環或未宣告取代的換版不得改寫 manifest／頁面。保留舊 hash 不代表工具另存了原始全文；舊版本內容仍需原始檔或 Git 可追溯。
- 同一頁面的已採納 assertion 也必須比較舊值，不能因提供正確 expected hash 就靜默改成相反主張。
- 歷史 Source ID 不可重新啟用；回復舊內容也要建立新版本。既有 ID 的來源 provenance 欄位凍結；來源／頁面的取代圖若有循環，lint 必須指出。
- 頁面 domain ID 保持穩定；VERIFIED 的頁面 evidence 必須符合結構並檢查 artifact hash，不能以任意字串假裝有證據；無效 URI 編碼仍須回傳完整 lint issues。
- Recovery journal 不得透過混用斜線修改鎖或其他 transaction；相同檔案的不同斜線與 Windows 大小寫別名視為重複 target，在寫入前拒絕。
- 外部編輯器在 expected hash 預檢後寫入的內容仍需保留：專用子程序只包裝第一次目標檔案讀取來安排精準時序，實際讀寫仍使用檔案系統，確認 commit 不會把外部修改誤當成新的合法 preimage。正式工具沒有加入測試 hook。

這些驗證證明本地工具的資料與協定行為，不判定自由文字的科學正確性，不代表所有 Agent 的自動 Session Hook 已完成整合。
