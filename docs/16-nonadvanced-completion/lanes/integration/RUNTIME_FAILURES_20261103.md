# 完整 runtime 測試的 7 項失敗：原因與修正（2026-11-03）

執行者 Claude Code（claude-opus-5-5）。check-03（來源 `18dbc908`）的 `test:runtime` 為 2262／2269，7 項失敗（[原始摘錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/56c387b7968a7b24e0ecd33567ff49c0cf3d6d6c)）。修正在 `502d2472` 與其後一個測試修正 commit。驗收門檻、fixture 與容差都沒有放寬；原失敗紀錄保留。

## 先確認失敗從哪裡來

在獨立的 detached 工作樹用 `git bisect` 找出各項開始失敗的 commit：這些失敗在接手前（`cbbe774e`）就已存在，main `e25f9f48` 上都通過；整合時只跑了部分測試，沒有跑完整 `npm run check`。

| 測試 | 第一個失敗的 commit | 紀錄 |
| --- | --- | --- |
| 876、877、880（同一機制的 1162） | `41526a71`（長錄製復原與聲音游標分類） | [bisect](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/runtime-failures-20261103/bisect-cursor-tests.log) |
| 941 | `466aa828`（起錄前先準備 Worker 與儲存） | [bisect](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/runtime-failures-20261103/bisect-native-admission.log) |
| 1024 | `cdacdeb3`（本次接手新增的兩段管線測試） | — |
| 633 | 只在完整套件出現；`cbbe774e` 已失敗、main 通過；bisect 結果因不穩定不採用 | 見下方 |

## 1. 錄製中的聲音游標（876、877、880、1162）：測試沒跟上已定的規則

`41526a71` 起，錄製影格只把「原生播放歷史完整」的游標寫進 `voiceCursors`；歷史不完整的另存 `nonNativeVoiceCursors`，標成 `NATIVE_HISTORY_INCOMPLETE`（影格內寫明 `cursorEvidencePolicy: "nativeCompleteOnly; virtualAndIncompleteAuditsSeparate"`）。`466aa828` 起，按 Record 會先把物理、行為和聲音一起暫停，等儲存與 Worker 準備好才繼續；已經在播放的聲源會被停下、再從原位置重新開始，所以它們的歷史本來就不完整。這兩項都是有紀錄的刻意設計（準備階段的獨立審查要求聲音與物理同步），四個測試卻仍從 `voiceCursors` 讀所有游標。

處理方式（只改測試，不改產品）：

- 新增共用的 [`recordedCursor`](../../../../tests/app/fixtures/recorded-cursor.ts)，依情境斷言分類：在這次錄製內才開始的聲源必須是完整原生證據，且不能同時出現在稽核欄位；按 Record 前已在播放、或從暫停還原的聲源必須是 `provenance: native`、`historyIncomplete: true`、`NATIVE_HISTORY_INCOMPLETE`，而且絕不能出現在原生欄位。原本的游標數值檢查都保留。
- 876／1162：第一段錄製（聲源在錄製內開始）維持完整原生；停止重播後 Run 還原的聲源改斷言為不完整稽核，原本「重播時間不能推進暫停中的 live 聲源」的上下限照舊。
- 877：B（`restoredPreStepSnapshot`）只複製完整原生游標，所以此情境（Record 前已在播放）B 不得把稽核升為原生游標；音高造成的引擎秒數大於行為秒數，改在稽核游標上檢查。B 複製完整原生游標的行為由 `recording-processor.test.ts` 的單元測試覆蓋。試過改成「先 Record 再 Run」讓聲源有完整歷史，但 B 會合法地重新對應 instance ID，等於換掉測試要比的東西，因此沒有採用。
- 880：每次 Record 都會重啟聲源，原本「兩次錄製之間游標差剛好 1 tick」量到的是 Record 的重啟，不是重力切換：測試用的假時鐘每次只走 1 tick，重啟後的聲源還在 onset lookahead（約 0.12 秒）內就被下一次 Record 暫停，引擎依設計保留它的起始位置，差值因此是 0。改為在重力切換前後直接讀 live 引擎游標，兩者必須完全相同（不重啟、不跳）；每次錄製後重新找出唯一正在播放的 AlwaysOn 原生聲源，「重力切換不能停止或重啟它」的檢查不變；跨錄製的錄製游標改為不倒退、且不超過 1 tick。

觀察到的產品行為（沒有修改，列為限制）：錄製開始時已在播放的連續聲源會淡出再從原位置重啟，這段錄製裡它們只有不完整歷史的稽核游標，B 比較不會為它們帶原生游標；若在重啟後的 onset lookahead 內再次暫停，原生內容會比行為播放頭落後最多一個 lookahead。

## 2. 941：未啟用聲音裝置時暫停後永遠停在暫停（產品 bug，已修）

`AudioEngine.pause()` 在沒有啟用裝置時只設定邏輯上的 `paused = true`，但 `resume()` 在同樣情況直接 `return false`，沒有把它清掉。`466aa828` 讓 Record 開始時也會暫停聲音後，這個不對稱就變成永久暫停：之後每個聲音都卡在 `SIMULATION_PAUSED` 不會嘗試，使用者看不到「聲音尚未啟用」（`AUDIO_NOT_ENABLED`）的即時提示，測試跑 75 秒後失敗。`resume()` 現在在沒有裝置時也清除邏輯暫停並回傳 `false`。新增引擎測試在舊程式上失敗（[RED](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9e0b9b88516ea2a3f197af86e01dfe837e0c0156)）、修正後通過；941 單獨執行 1.4 秒通過。

## 3. 1024：測試自己的計時太緊

這是本次接手新增的兩段管線測試。worker error 的情境把 job 逾時設成 100 ms，滿載時逾時比注入的錯誤先到，得到 `EVALUATION_TIMEOUT` 而不是預期的 `TEST_SOLVER_FAILED`。改為 worker error 情境用 60 秒、逾時情境用 1 秒；斷言不變。

## 4. 633：完整測試套件中的雜湊時序競爭（測試修正）

單獨、整檔、加滿 CPU 負載、8 份同時跑都通過，但完整 `test:runtime` 中每次都失敗：目前分支 2／2、接手時 `cbbe774e` 2／2，main `e25f9f48` 2／2 通過。全套件 bisect 指向 `d18e030f`，但再驗證時它的父 commit `41526a71` 也 2／2 失敗，表示 bisect 途中的「通過」是運氣，[該結果不採用](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/runtime-failures-20261103/active-rule-bisect-verification.log)。

在完整套件中加入記錄每次發布 tick 與呼叫來源的探針副本後找到原因（[追蹤](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/62fdac6ebd6e2e01d0494419f96c64b3b347c290)）：記憶體模式的錄製儲存每筆 append 都會等待 WebCrypto SHA-256（在 Node 執行緒池計算），完成後才觸發一次發布。完整套件同時有約 31 個測試程序搶執行緒池，雜湊完成時間不固定，所以這次發布有時落在測試的 `setImmediate` 之前、有時之後；兩條路徑的發布順序因此錯開一格。這是測試等待條件不足，不是投影錯誤，接手前就存在。

處理：測試的 `advance` 在既有的 `flushRecordingEvaluation()` 之後，也等待錄製儲存 `flush()`，讓兩條路徑都在下一個固定 tick 前完成每筆 append 的發布。比較的內容（完整發布順序、checkpoint、計數）不變。加上修正與探針副本後完整套件跑 2 次，兩份都通過（[紀錄](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/9e38a83ae8bd416005373fd44bec0db2fe6a585d)）。

第二次那輪另有一項 `recording-commit-storage.test.ts`「IDB phases belong to one append」失敗：它只等 30 個 `setImmediate` 讓兩筆 WebCrypto 雜湊與交易建立完成，滿載時不夠。改為最多等 10 秒，斷言不變。

## 驗證

修改的五個測試檔加引擎測試 85／85 通過（[TAP](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fdc23356c40ba1c8d76bb872720e2bbfffee2a28)）；`tsc --noEmit -p .`、eslint、prettier 對修改檔皆通過。check-04（`502d2472`）完整 `npm run check` 只剩 633 失敗（2269／2270），因此 build、授權與英文檢查沒有跑到；633 修正後的完整結果見 check-05。
