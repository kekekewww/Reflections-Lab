# Owned-PID Win32 CPU 方法來源與邊界（V4）

狀態：來源已實作、父代理已有純單元證據；**原生 Win32 reader 與正式 600 秒量測尚未執行**。本文不採納新的正式資格，也不回填既有失敗。完整版本、來源雜湊與執行收據見 [JSON](22-owned-process-cpu-method.json)。原 [18 號 CDP 來源報告](18-process-cpu-source-method.md) 保持歷史版本。

此方法補足 Chromium CDP 將原生查詢失敗轉成累計零而沒有 validity bit 的限制。CDP 只提供本次 owned browser 的 PID/type 白名單；新的固定 helper 對每個白名單項目直接 `OpenProcess(0x1000, false, pid)`，再用同一 handle 的單次 `GetProcessTimes` 取得 creation、kernel、user，最後在 `finally` 關閉。只採真正成功的 BOOL；成功 CPU counter 零可保留為零，失敗不推成零。不使用 `Get-Process`、`GetProcessById`、全系統列舉或提高權限。

## 官方來源與數值意義

獨立來源代理於 `2026-11-03T02:16:36Z` 以正常 TLS 取得六份官方 Learn 文件及固定版本 raw 來源，全部 HTTP 200；只記錄 metadata 與短摘要，未將全文或二進位檔納入專案。

| 來源 | 固定來源版本 | raw SHA256 |
| --- | --- | --- |
| [OpenProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess) | `656e9656bfae`；L69-103 | `7201ba3494356422dfd75d102c601ef9d74ab57784de84c9acfbd07f71fdc427` |
| [GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | `656e9656bfae`；L71-108 | `4c62c27d32b5e0e442d7b41e62247a88fe7c2b2632fbbcdd241c86ff24e1f460` |
| [GetLastError](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror) | `656e9656bfae`；L60-76 | `3b1a3e82d3c279de81eafe42143941930fbc6d7650e6b26bd9ae898ff585b91f` |
| [CloseHandle](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle) | `656e9656bfae`；L67-108 | `c0cd1b25e7d35a8f4fb020cfba13b9ee5b3643a332e7c1f592b507746e1e794b` |
| [FILETIME](https://learn.microsoft.com/en-us/windows/win32/api/minwinbase/ns-minwinbase-filetime) | `656e9656bfae`；L57-78 | `e89d88d9727e59bd8cd3131dd9feb83956ca9e7e6e83f7e676dd40b04ccf6ecf` |
| [Process security and access rights](https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights) | `ca8274decead`；L39-44 | `4074adbc739dc190736def83b30bb7f54fb454c7f52bf878cb6915778a4dd86f` |

[GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) 的 kernel/user 是所有 threads 的累計 CPU，100 ns 是單位，並非解析度承諾。creation 的 FILETIME 與 CPU ticks 都以無號 64 位十進位字串保存，避免 JavaScript Number 先行捨入。每個 kernel/user 分別以 BigInt 相減，確定沒有倒退後才合計換秒：

`CPU seconds = Σ[(userAfter − userBefore) + (kernelAfter − kernelBefore)] / 10,000,000`

`CPU/wall = CPU seconds / (actual monotonic wall milliseconds / 1,000)`

CPU/wall 可因多執行緒超過一。分母須來自兩 arm 相同的實際邊界流程，不能直接填正式 600 秒常數。creation 字串必須精確相同；不能把兩個轉成相同 Number 的不同 FILETIME 當作同一程序。配對 before 必須結束於 after 開始之前或同一時點；原始 request 前後 hash 也必須一致，不能將 producer 已拒絕的 capture 在 summary 階段重新變成 OBSERVED。

## 程序與證據邊界

PID 白名單最多 1024 項，保留原有觀測上限而不截斷加總。固定 `.ps1` 只接收新建 `wx` JSON request 檔案路徑；不把 JSON 放進命令列，也不使用 `-Command`、`-EncodedCommand` 或 `ExecutionPolicy Bypass`。既有 runner 採 `shell:false`、`windowsHide:true`，request 上限 256 KiB、合計輸出上限 1 MiB、停止 watchdog 5000 ms。watchdog 是開始停止的時間，既有 taskkill 與 close-proof 等候可能另加 2500 ms 與 3000 ms，不能宣稱整份收據五秒內必回。

每端保存 request/raw stdout hash、固定 helper 與所選 PowerShell executable 的前後 hash、真實單調時鐘 brackets 及完整 runner 終止欄位。未選定實測 executable 時，版本與路徑保持未知。逾時、取消或超出輸出上限，只有實際 process-tree stop 證據才准 `helperLeaseReleasable=true`。正常 helper 關閉只表示該 owned helper 已關閉，不能代替整台機器、瀏覽器或所有 handle 清理的證據。Win32 API 與檔案完整性失敗仍保留原始錯誤及 null totals。

只要 PID/type 集合、creation identity、任一 API 成功旗標、source/executable/request integrity、CPU counter 或可表示數值不成立，canonical total 與 ratio 均為 null。不能將存活 subset 加總當成整個 browser 的 CPU。兩端集合相同仍不能證明途中沒有短命程序；CDP 與後續 OS open 也非同一次原子觀察。

此數值只涵蓋被 CDP 列出的程序，沒有量出外部 PowerShell／Node 的 CPU。冷啟動、Add-Type、IPC、採樣先後均有成本；helper wall duration 與 brackets 會保存，不能借此宣稱 probe overhead 為零。`nativeDspCpuMs`、`hardwareUnderruns` 仍為 null。

## 已讀證據與未執行項目

作者只寫入／閱讀來源與收據；沒有執行 Node 測試、PowerShell script、OS 查詢或瀏覽器。下列單元命令由父代理執行，本文已讀 actual TAP：`node --test --test-concurrency=1 tests/performance-v3/process-times-v4.spec.mjs`。

| 收據 | 實際結果 | 能證明的範圍 |
| --- | --- | --- |
| [初次 RED](process-times-v4-red-r1.tap) | 135：1 FAIL、134 SKIP，exit 1 | 缺 export；跳過案例不算行為證據 |
| [初次 GREEN](process-times-v4-green-r1.tap) | 138 PASS，exit 0 | literal DTO、注入 runner 與受控暫存檔的單元行為 |
| [完整性 RED](process-times-v4-integrity-red-r1.tap) | 141：138 PASS、3 FAIL，exit 1 | 真正暴露兩端反序／重疊，以及 mutated request capture 被 summary 復活 |
| [最終 focused GREEN](formal-v4-final-focused-r1.tap) | 611 PASS、0 FAIL、0 SKIP，父代理回報 exit 0；6255.2786 ms | 包含全部 141 個 OS reader 與 76 個 CDP CPU 單元案例；仍未執行原生 helper |

138 案例的 fixture preimage 及新增 `requestAfterSha256` 正向環境欄位，另保留 [版本收據](process-times-fixture-v1-before-afterhash.json) 與 [原始 bytes](process-times-fixture-v1-before-afterhash.test.txt)。原 assertion 沒有刪除或放寬。最終 focused TAP 已實讀為 611 PASS、0 FAIL、0 SKIP；三個新完整性負例均已通過。父代理的 [format r1](formal-v4-format-r1.txt) 與 [format r2](formal-v4-format-r2.txt) 已結束；[lint r1](formal-v4-lint-r1.txt) 保留兩個失敗（driver 缺 URL import、測試 helper 未使用），移除未使用 helper／補 import 後 [lint r2](formal-v4-lint-r2.txt) 回報 actual exit 0。沒有放寬 assertion。原始 stdout 未列完整 argv，本文不捏造 focused／格式／lint 的完整命令；最後空白 lint stdout 也不是單獨的成功證明。

已依父代理提供值重新讀取並核對最終來源：

| 來源 | Bytes | SHA256 |
| --- | --- | --- |
| `tests/browser/performance-process-times-v4.mjs` | 16214 | `bf9404f8b80177249f2e9f5e57e7090a9e22950eef5ebf8ff7af42a91858ccd9` |
| `tests/browser/performance-process-times-v4.ps1` | 7363 | `596679bd1aaccf9c6b839b9cead0ed4d83c3cde930b4e7c1e37d4ccf1e505784` |
| `tests/performance-v3/process-times-v4.spec.mjs` | 30047 | `2c3164ff2d714c72277a262d6e36d669ced954d397f227e3f43d5dde4487c280` |

獨立 reviewer 已在格式前來源確認兩個 finding 的原始證據 gate 閉合，並已對最終 `bf9404f8…` 重新只讀核對 hash gate（L176–180）與時序 gate（L375–377）仍存在；固定 PS hash 也未變。18 號 MD／JSON 也重新讀 hash，分別仍為 `28d4c738…` 與 `a13dd910…`，未改寫歷史來源。這些都是 source／unit 證據，不能當作原生量測。

**NOT RUN：**實際 Windows reader component、實際選定 PowerShell/.NET executable 與版本、原生 CPU on/off paired、正式 600 秒、DSP CPU、硬體 underrun、產品 GUI 與聽測。原 V3／44 pins、binary64 numeric core、50 ms／其他原門檻、voices／paths／geometry／capture 負載及既有 FAIL 全數保留。
