# 產品鏈診斷的獨立唯讀稽核

這份 archive 是固定 `77ccfece…` bundle 的單次 Chrome／RTX 4070 診斷。Playwright 1／1 通過，無重試、略過或明示 overrun recovery；目前 source 與 bundle 不符，因此 wrapper exit 1 正確保留。這不是最終三次乾淨啟動驗收。

已直接核對原始資料：81 frames 的 tick 為 4–84、連續且同一 epoch；初次 Record 前 tick 3 對應首 frame 4。獨立 canonical SHA-256 與錄製宣告完全相同：`816cd283828f3cc33610421fbb1cde8b59a2d539ec98fccd70b2c9d01d1a8253`。各一個 OnGrab（tick 11）、OnThrow（25）、OnImpact（78）均連到同 frame 的 accepted 原始物理事件。撞擊路由的來源為 contact emitter、終點為當時 Listener；48 kHz 原生 context 運行，440 Hz source 的既有連線可經正延遲及 HRTF panner 到 AudioDestination。還原後 artifact hash 相同。

發現確定的 metric population 缺陷：

| 原始 A 的取樣範圍 | 數量 | 直達延遲平均（s） |
| --- | ---: | ---: |
| 現行 metric 納入的全部 available direct routes | 118 | 0.01592289576547707 |
| 只保留同 frame `playbackState=playing` 的來源 | 116 | 0.016036576002133818 |

兩者差 `0.0001136802366567477 s` **恰等於**畫面記錄的 B−A，殘差為 0。A 多出的兩項是 tick 25、39 的 stop／fading 診斷路由。正式 capture 保留 stop 診斷；B processor 只解 playing sources；metric 卻平均全部路由。因此這個直達延遲變化完全由不同取樣母體造成，不能歸因於換吸音材質。應統一雙方真正發聲樣本的 eligibility，保留診斷資料但排除其 emission metric，再加回歸驗證。

A/B 指紋的 motion、raw events、listener、source、profile、geometry 等固定條件一致，只 propagation material 不同。但本 archive 沒有保存 raw B，無法在頁面關閉後獨立重算其 propagation／數值差；最後一輪需保存 B 與比較結果。原生圖證據不代表人工聽測、PCM 能量或 AudioWorklet deadline。

計算、來源位置與原始檔 hashes 見 [independent-review.json](independent-review.json)；該 JSON SHA-256 為 `916c2c5a92a082e11dcb1ae57236f8015de9467f56db2574b8b7d908317c0fe7`。本稽核沒有變更產品／測試來源，也未執行 browser、build 或模型呼叫。
