# 資料取得隔離驗證

此工具補足 Phase H 的可重現取得腳本。沒有下載任何第三方資料、接受條款、建立正式 importer，或執行聲學 V2／V3／V5 驗證。測試內容全部是本專案原創的記憶體文字；測試中的 `VERIFIED`／Zenodo URL 只存在於注入的合成 fixture，沒有表示該 URL 真有資料或取得第三方授權。

固定 Node **22.17.0**，只使用內建模組，無額外依賴。從 repository root 執行：

```powershell
node scripts/setup/datasets.mjs
node --test experiments/dataset-fetch-spike/dataset-fetch.test.mjs
```

第一個命令預設 dry-run，不呼叫 fetch、不建立 cache。真實範例為 catalog D05 dEchorate v1：資料授權 `UNKNOWN`，精確檔名、下載 URL、bytes、SHA-256 未取得，保留 `null`，因此應回報 `BLOCKED` 並結束碼 **2**。這是如實保留缺口，並非下載失敗。工具沒有把程式 MIT 當成資料授權。

只有完成個別固定檔案的查核後，才建立另一份 manifest 並使用：

```powershell
node scripts/setup/datasets.mjs --manifest research/datasets/your-reviewed-manifest.json --fetch
```

`--fetch` 是明確的執行選項，不是法律條款接受流程；沒有條款頁互動、帳號、cookie、認證 header 或登入支援。輸入 `dry_run` 永遠要求 `true`，以免 manifest 本身觸發連網；只有命令列選項開啟取得。

工具要求 catalog 的來源、版本、license ID／URL／scope／查核日、attribution、subset IDs、test IDs、精確 bytes 與 SHA-256，另加 `license_evidence_url` 指向該固定檔案條款的證據。`VERIFIED` 是維護者已完成個別檔案、用途與 notices 查核的聲明；工具只驗證 metadata 與檔案完整性，不能自行證明授權、競賽適用性或引用是否充分。`UNKNOWN`、`REFUSED`、`VERIFIED_PAGE_ONLY` 均阻止取得。禁止用新下載的內容自行補出預期 hash 再聲稱與獨立來源核對。

每次只接收一個固定檔案，不接受 archive 解壓縮或批次外部腳本。`max_download_bytes` 不得超過 **50,000,000 bytes**，且 `size_bytes` 不得超過此上限；Content-Length 若存在必須相符，串流也逐 chunk 檢查上限、最後再核對大小與 SHA-256。傳輸限 identity encoding，整次請求與串流有 30 秒 timeout。

下載僅接受 HTTPS、標準 443 port，拒絕 userinfo、query 與 fragment，host 必須精確屬於：`www.york.ac.uk`、`zenodo.org`、`depositonce.tu-berlin.de`、`www.openslr.org`、`github.com`、`codeload.github.com`、`raw.githubusercontent.com`。不含任意子網域或其他 mirror；遇到需 signed query、登入或新 mirror 的來源，先重新評估再修改工具。手動跟隨最多 3 次 redirect，每次都重新檢查相同限制；不隱式信任 Location。

輸出固定在 Git 忽略的 `.cache/datasets/<dataset_id>/<sha256>/<file_name>`，不提供自訂輸出路徑。檔名限英文數字起頭、其後可含英文數字、點、底線、連字號，最長 180 字元。拒絕 traversal、Windows drive／ADS／保留名稱、目標 symlink，以及 cache 組成路徑中的 symlink／junction。串流寫入相鄰暫存目錄中的 `wx` 檔案，驗證後透過目錄 rename 原子發布；已存在 cache 目錄不覆寫，競爭者建立的非空目錄也無法被 rename 覆蓋，失敗移除暫存 bytes。重用 cache 前重新檢查大小與 hash；既有損壞 cache 留存供人工查核，工具不刪除或修復它。

檔案系統檢查針對一般本地工作目錄；這個 Node spike 不提供抵禦惡意本機使用者在檢查與寫入間替換目錄的 OS sandbox。請勿與會移動 cache 目錄的程序同時執行。測試包含靜態 junction 與目標競爭不覆寫；若本機不允許建立 junction fixture，該案例明列 `NOT RUN`／skip，不宣稱通過。沒有宣稱能防止所有 TOCTOU 情境。

結束碼：**0** 為 `READY`／`ACQUIRED`／`CACHED`，**2** 為 metadata `BLOCKED`，**1** 為輸入、I/O 或網路錯誤。`READY` 只代表 dry-run metadata 通過，沒有取得或驗證遠端資料。

離線回歸涵蓋：CLI 與 manifest 解析、預設無連網、未知／拒絕授權、缺 metadata、路徑／URL 負例、串流超量、大小與 hash 錯誤、redirect host／loop、cache 重驗證、junction、競爭寫入，以及成功的合成 cache。測試的 fetch 完全由本地 mock 注入；不得把這些通過結果標成 dataset `ACQUIRED`、獨立 solver 比較或聲學量測通過。

下一步仍是：取得明確的個別資料檔授權、固定子集／URL／獨立 SHA-256 與 bytes，再在需要時實際取得；讀取原始 header／metadata、保存 raw 與 processed hash，最後執行 catalog 所定義的科學驗證。此 spike 不會改寫 catalog 的 `NOT RUN`。
