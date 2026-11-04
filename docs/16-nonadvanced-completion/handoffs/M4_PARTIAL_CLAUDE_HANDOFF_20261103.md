# M4 給 Claude 的階段性交接：完整工程仍 ACTIVE

這是部分交接，不是最後驗收或最終 Claude 交接完成。固定整合來源 `1f3779fa392d5a0f545066cacfcc92c4d0e47410`；本頁機讀來源為 [M4 stage](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/73953e8828395991c584e3a81d1022f465e134b1)，SHA-256 `be1f5182d198fa4bbd001e041998bedc0a44d3d171b6050ab42e8ccc69dc9620`。M3 記憶已由 Root 提交為 `9511b752cfe9f2fee9b73bf2f337ba3ea009a2a7`。

先讀 AGENTS、knowledge/schema、Wiki index/Now、Task0032/0033，再讀本頁及[固定證據索引](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/61ae61cbda0188f70db177ddc1f3495d547eb3c2)。實際程式與固定收據優先；本頁不把後續正在修改的 Store-ready、V3 或其他來源冒充已驗版本。Root 是 integration/main/index owner；記憶為單 writer。

## 已有證據及其界線

| 範圍 | 實際結果 | 不能推出的結論 |
| --- | --- | --- |
| 最新整合 | Root1f global tsc exit0；七檔118/118、17.8014146s。83含64+13labels+6passive，77/64/83/118重疊；Runtime25是另組元件結果。 | 不是201個獨立案例，不是完整 npm run check／全產品驗收。 |
| Worker prepare | 固定466之準備／語系22與受影響63各exit0；ACK在開始錄製前await，原queue/caps不改。 | handler ready不證求解／儲存吞吐，也不證唯一根因。 |
| Native03 phase | 固定cae／harnessa6ce，receipt4dd；10對20份mono PCM，每份2秒96000frames，合計7,680,000B。maxabs1.62112e-7、relRMS8.55679e-9均在原嚴格2e-6內，無略過frames。 | 20×2秒不是一段40秒／60秒長錄製；非容量性能、完整HRTF/IR狀態、SPL、聽測或ComputerUse。 |
| Production03 | 固定b7 bundle，五案4PASS/1FAIL、112.853s；一個有效未儲存Zone草稿／選取跨四模式保留，四個load數值有限。20是磁碟來源pins，HTTP直接驗index/entry。 | 不代表所有草稿型別；錄製仍固定步guard tick87/global1.45s而失敗，no Resume，非queue根因證明。 |
| 建置 | prod05/e2e02各exit0，20/17固定source pins及7assets已核。receipt事後建立；completedAt來自build logmtime。 | 不是建置前sourcecapture；新1f Runtimeopts未由舊b7瀏覽器結果全面驗過。 |
| V4前置 | semantic03五gate、44source pins/8copies符合；window約222.6ms。Root只採納指定Chrome/exe之semantic前置資格，c59是qualification ID。 | 非20秒wiring或600秒／DSPCPU；Root1f committed registry仍空，新record/module尚未整合；不從採納自動啟動正式長跑。 |
| 長輸出 | pairedV2於150002.2573ms timeout/exit1；11true、5false、第6比較缺結果，0files/0WAV。snapshot b8已正常merge，65是受控元件案例。 | 不修掉原whole63 master或下載FAIL；65不是real IDB／長WAV／parser／資源峰值通過；260,307,504B只估算。 |
| 英文 | de628兩UX譯本source hash與canonical相符；scoped2PASS為Root回報，未取得獨立scopedraw。 | 非全套English current／全文翻譯驗收。 |

## 錄製失敗必須分開保留

M3 production02 的暫停早於第一次 Spectrum，1.42s是globaltick85/60，不是錄製長度；當時共用文案不能辨queue。後續 diagnostic01 在另一來源上定位evaluation先到8accepted/0committed、firstreply尚null，才導入Worker prepare。

diagnostic02（headless）是 OTHER_PAUSE_OBSERVED：fixed-step guard tick77、pressure=null，公開Stop封存5個連續acceptedframes73..77。diagnostic03（controlled headed）則是 storage FIRST_GUARD：evaluation14accepted/7committed/7pending，storage8accepted/8processed/0persisted/8pending；公開Stop封存14個連續acceptedframes58..71。兩次收集exit0不是產品錄製PASS，不能由不同條件推CPU/GPU因果。

第三次已等待Worker ACK531.8ms；storage create253.6ms未在start之前await，Store-ready前置gate正在實作，**本頁不聲稱已修**。19是磁碟來源pins（其中17product），HTTP核的是index/entry。globaltick／模擬時間、錄製UI時間／eventCount及runner／observation wall-time各自獨立；封存accepted prefix不等於持續吞吐、60秒完整管線或全來源連續性通過。不得提高queue cap、丟acceptedtick、清除欠步或自動Resume來冒通過。

## Claude 接手仍需完成

1. 凍結 Store-ready／bounded diagnostics 來源，依原generation/ownership/timeout與取消規則驗證，再做真production錄製／四模式全流程；保原失敗與原cap。
2. pairedV3自身sourcefreeze、Root整合、完整六組native比較、長WAV snapshots、獨立下載parser與實際memory/wall-time；本頁只把新V3列pending。
3. 正式V4新CLI/profile/approval registry整合、exactChrome及20秒wiring後，依Root當次資源grant執行原600秒負載；缺DSP/CPU欄位保持null，不能填0。
4. 完整S4操作模式／UI／參數／持久化／錯誤／全管線；新harness合併不是執行證據。Windows ComputerUse仍URL-confidence policy NOTPASS、0新native產品input；Playwright與nativeDSP是不同方法。
5. 同一最終sourcefreeze的完整 npm run check、fullEnglish、獨立審查、Main merge與最後完整Claude交接。Task0033 AC02/06/07及Task0032 AC02–09仍false；原PERF/Task16/20/51與容差、負載不縮。

使用者順序維持Codex實作／驗證／記憶→Claude獨立驗證與修改→最後人工／聽測；既有基本功能回報不重開成基本功能重測。沒有新paid API／cloud013／push／deploy授權，預算仍0。不要利用其他工具繞過ComputerUse方法的URL policy。

## 原始資料與清理

[索引](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/61ae61cbda0188f70db177ddc1f3495d547eb3c2)保留小型固定doc/raw/readers；Native03的20PCM已在Root1f/4dd Git歷史，未重複拷貝。大型trace／PNG／bundle仍有physical path/hash，不能聲稱所有ignored資料已入Git；交付時須保留實體artifact或明確可重建來源。

Root只移除兩個clean且Main ancestor的舊worktrees：environment@1136及render-tail-validation@905。Root確認先驗dependency Junction再非遞迴unlink、正常git remove且無force；共用.package-lock前後SHA相同。其餘dirty trees、歷史raw、active C、Claude與本輪工作樹保留；舊盤點11rows及既有9925刪除狀態不改寫。本項清理不是新的native/產品驗證。

本頁是可繼續工作的M4階段紀錄；完整goal與上述未驗事項均仍ACTIVE。
