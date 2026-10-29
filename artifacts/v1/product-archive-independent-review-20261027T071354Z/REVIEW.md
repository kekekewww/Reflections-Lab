# 中文固定產品鏈封存的獨立稽核

本報告只核對 `product-e2e-chrome-20261027T033616Z` 的歷史固定版本，build input digest 為 `22ca0c47490f3fc4e73e400cbd9d795b072c61e8e0dad6fa746955f0e9739d5a`。本次沒有重跑測試、瀏覽器、建置、server 或模型，也沒有修改舊封存。不能用此結果宣稱目前新增雙語、聲音診斷或其他修補已通過產品鏈。

稽核未發現本範圍內的實際失敗。原始 Playwright 結果為四案例通過、各一次執行，沒有 retry、skip 或 flaky。獨立計算包含 [63 項原始資料判定](arithmetic-review.json)與 [23 項 trace／原生控制圖判定](trace-review.json)；這些是既有證據的稽核項目，不是新增的86項產品測試。完整結論與檔案雜湊見 [review.json](review.json)及 [review-receipt.json](review-receipt.json)。

## 雜湊與來源

三組原始 A 與候選 B 的 canonical SHA-256 均獨立重算吻合；comparison 內保存的兩個完整 artifact 也與各自原始 JSON 相等。原始 ticks、單一 epoch、capture 前 tick 到第一 frame 的邊界均吻合。儲存重載後的完整 artifact 經 trace 解碼，與 raw A 深度相等。

保留 bundle 的全部10檔實體 hash 與 build manifest／copy receipt 相符。另有86份 `src/` 原始內容可從已保留 source map 還原，皆符合當時 build input hash；五份 trace 內的測試原文都符合封存 Harness SHA `88113fc25097538e389e8b0b3d39dd329218b3fcc30f74200575d586561b603d`。

來源、bundle 與 Harness 的執行中穩定性依當時 guard receipt 與前後 Harness hash 核對；不把目前檔案內容當作歷史來源。原始 cleanup receipt 記錄 Chrome、CLI、preview 的自有 process tree 零剩餘，這不是目前所有系統程序的盤點。

## A/B 與事件鏈

| Clean context | Frames／ticks | 明示 recovery | A／B 有效 direct samples | Direct delay Δ |
| --- | --- | --- | --- | --- |
| 1 | 82／7–88 | 0 | 115／115 | 精確0s |
| 2 | 106／4–109 | 2 | 144／144 | 精確0s |
| 3 | 116／4–119 | 7 | 152／152 | 精確0s |

有效母體從各 frame 的同 tick Behavior snapshot 與 voice metadata 獨立建立，只保留 logical playing source；A 的停止／淡出診斷各排除兩筆，B 沒有這兩筆。兩側 semantic query keys 與實際頻帶集合相符。直達平均及路徑壓力比平方和的平均、差值、樣本數與方法 provenance，均與真正 Host comparison result 精確一致。

三組 path-energy estimator 的 B−A 分別為 `-0.004280614542044564`、`-0.0042497673928876545`、`-0.00435420587831177`。此值是幾何路徑壓力比估計，不是 rendered PCM energy、聲功率量測或 SPL。原始 motion、listener、physics events 相同；authoring 只改 `wall.back` 的 acoustic material，另有正常 scene revision 與候選 run ID 變動。其他固定條件 fingerprints 一致，propagation material fingerprint 不同。

每組各有一個 accepted Grab 與 Throw，並有真實 Impact。AudioEvent 指向同 frame 的 accepted physics parent；Impact 使用真接觸點，對應同 tick AcousticFrame 的 source endpoint，末端為該 frame listener。恢復沒有增加 accepted Grab／Throw 事件，也沒有重設或遺失錄製 ticks。

## 原生控制圖、重播與重連

三組各有一個原生440Hz source start；該頻率只配置於此 fixture 的 Impact。依成功 start 當時的 connection log prefix，都可找到通過 Delay、HRTF（rolloff=0）至 AudioDestination 的連接鏈。原生 context 均為48kHz、running，且 clock 已前進。

這是原生控制 API 與連接建立的證據。連接紀錄沒有 disconnect chronology；正 Delay 值是在收集 graph 時取樣，未獨立記下精確 start 瞬間每條邊及參數。不能將 prefix BFS 宣稱為硬體 PCM、聽測或精確啟動瞬間全圖的量測。

三份 trace 都證實重載前無 hardware AudioContext，重播後出現原生 sample starts 與 active voices；Pause 後 replay time 不變。Seek ticks 為13／10／10，分別等於 A start+6，pose 與 raw frame 精確相同；Resume 後 time 與新的 sample starts 前進。多個原生 source handle 不等同多個 accepted trigger；路徑到達及恢復可以建立多個 handle。第三組 native110Hz starts 為8個，不能宣稱只有一次原生 Grab source start。

獨立 store 的 target trace 證實缺失 WAV 回報 `ASSET_REQUIRED_MISSING`、錯誤 bytes 回報 `ASSET_RELINK_MISMATCH`；拒絕後 scene 不變，Apply 前 assets 仍空白。原檔改名後恢復同一 asset ID、revision1、SHA `235d44fbedac9e915beb597ddcf5f208da7e5d9ccab2d1a330f0fe96ba781f3d`，狀態 ready，context 與 native start 數為0。依封存 fixture 演算法重新產生的 WAV bytes，其 SHA 亦吻合。

## 限制與凍結

- Source-phase evidence 在 A 與 B 都是 `logicalIntent`／`NATIVE_CURSOR_PARTIAL`；這不證明 native waveform 或實際 rendered phase 等價。
- 三個乾淨 browser context 共用一個 browser process，沒有宣稱三次獨立程序冷啟動。
- 0／2／7次明示 recovery 與短錄製 timing 不構成流暢度或正式600秒性能通過；沒有刪除過載紀錄。
- Human hearing、硬體 PCM／SPL、AudioWorklet deadline 與跨 engine 驗證不在此範圍。
- 本目錄是新稽核輸出，舊 archive 未修改。文稿與 receipt 發出 `FINALDOCEND` 後凍結；如需重算，複製本目錄至新路徑再執行計算程式，避免重寫此報告。
