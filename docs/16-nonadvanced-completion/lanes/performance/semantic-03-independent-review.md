# Semantic attempt03：獨立原始追蹤審查

實際短情境的 journal、完整原生 RAF 事件、單次 bootstrap 與未修改數值核心已獨立對帳，未發現差異。結論限於 `SHORT_SEMANTIC_EVIDENCE_CORROBORATED_NOT_FORMAL_APPROVAL`；正式600秒仍未執行，registry／formal未批准，完整第一版未完成。原attempt01與02的FAIL保持不變。

使用 Python 標準函式庫直接讀取 gzip／JSON與Git bytes，未 import 或執行產品JavaScript，未跑Node、測試、build或瀏覽器。實際觀測HEAD與run source均為 `03d665a720de4d1b32f1e0a4818d25a28e48d25d`。完整44筆source、原始事件索引、二進位浮點輸出與raw SHA見同名JSON。

## 完整固定情境

52項操作逐項核對原固定順序與parent：26次不重複handle註冊、24次callback、PC／MC兩次取消，關閉後pending0。13組callback數為 `[2,3,2,1,3,2,1,2,2,1,2,1,2]`；每個rawRAF／observedNow的binary64與24筆callback proof、13筆代表frame、mark名稱和全部counter吻合。

從原始begin `/traceEvents/181` 與end `/1848` 導出的owner為 `51296:44384`，thread metadata為CrRendererMain；document／navigation前後相同。所有實際RAF事件均屬同owner與frame：23個RequestAnimationFrame、24個FireAnimationFrame、1個MC CancelAnimationFrame，共25個native handle。每個measured註冊／取消都位於指定parent的Fire內，request早於fire／cancel。PC取消與P0／P1註冊位於trace前，其native事件沒有被冒稱捕獲。

E0特殊mark在 `/traceEvents/31` 的ts為 `2667039546`，早於begin；實際callTime為 `2667694868`，落在E0 `/1283` Fire的 `[2667694771,2667694906]` 內。自定startTime=0與實際發生時間明確分開，沒有用mark ts冒充callback時刻。

## 單次bootstrap

| 原始事件 | 索引 | 證據 |
| --- | ---: | --- |
| TimerInstall | 195 | timerId1、singleShot true、requested timeout0 |
| 完整原生RunTask | 197 | ts2667590009、dur181微秒 |
| TimerFire | 198 | ts2667590016、dur174微秒，完整含於上述task |
| 進入／離開mark | 202／203 | 同owner、navigation，ts及physical callTime皆位於Fire內 |

Aux receipt為scheduled550ms、entered550.5ms、exited550.6000000000931ms；requested0與actual delivery0.5ms分列。entry距原begin為0.8999999999068677ms。原begin／end沒有移動；bootstrap task確實進入原數值輸入。整份raw只有bootstrap timerId1與原close timerId2兩組Install／Fire，aux bootstrap marks恰好2個，沒有重複heartbeat。此單次task不能回補原resume呼叫缺少的外層task，也不證明整個window所有CPU無遺漏。

## 未修改數值核心

原生named task共764個，owned44個全為合法X，沒有owned B／E；原raw V3收據為true，V4 classifications為0。本次並未再觸發窗外B分類分支，不能以此宣稱該分支有新的native實證。

原window為 `[2667589229,2667811785]` 微秒，selected38、merged38；起點gap780微秒、終點gap0，符合原兩端≤50000微秒判準。以相同binary64運算順序獨立重建14個occupancy bins、15個native boundaries及performance bins，逐值二進位相同，merged task陣列亦完全相同。這是短資格情境的原算法對帳，並非原600秒性能門檻結果。

## 來源、執行環境與清理

44個method inputs逐一核對：sourceBefore／After、保存archive、目前檔案及run commit `03d665…` 的Git bytes全部相同。原V3核心仍為 `3d7810c63edc309df6b306debe6417ed13d73b6e899a7950043439b787421782`；原V2精確SHA仍為 `df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c`；protected baseline仍e25f9f4。44inputs是方法來源範圍，並不宣稱載入完整產品UI workload。

保存的CDP／OS收據為Chrome156.0.8078.75、revision861389936bf33ea77529ee5dcc0605e68f6bb620、i9-13980HX／32logical／33959825408B RAM、Windows10.0.26200、1920×1080／DPR1；GPU／driver／commandLine保留於JSON。獨立重算目前Chrome executable SHA，與前後收據同為 `7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa`。硬體欄位來自當次保存收據，本審查未重新開browser或探測設備。未請求音訊，sample rate／hardware block／device route保持null。

原process exit0、未timeout／cancel／output limit、direct process stopped；processTreeStopped仍null，沒有誇稱forced-tree關閉。cleanup403ms、errors空、browser disconnected、server not listening，原RAF／cancel identity相同、pending0、bootstrap FIRED且not pending、state CLOSED。MachineLeaseReleasable=true與pilotSucceeded=true各自有證據。Console保留一項404，pageErrors與trace lifecycle faults為空；未推定404資源身分或將它刪除。

Raw trace SHA為 `bbe3d9de15928fcfde0e1cf311d6427199ff4a1f31e770ac8ff0eeca585bc110`，2716 events／65192B gzip；raw journal SHA `89ead0e679b89f7b9078a03489c3bb1fa7ca9e67889367b37841f48f67ab10f4`。所有實際大小及original caps均已核對。

原attempt01驗證SHA4984cb50…與attempt02驗證SHA9816901c…仍為UNVERIFIED_NOT_APPROVED；attempt02 numericCoverageComplete仍false。這次成功不覆蓋舊失敗，不代表正式600秒、probe overhead、產品monitor、PCM、native DSP CPU、硬體輸出或聽感通過。
