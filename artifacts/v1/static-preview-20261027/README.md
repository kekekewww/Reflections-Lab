# 靜態場景聲學預聽：實作與分項證據

日期：2026-10-27。執行者為 Codex；開發 Muse 與本項 live API 呼叫均為 0。這是原 UX04 的分項實作，**不是完整第一版完成宣告**。

## 行為與資料邊界

- Inspector 的「場景聲學預聽」使用已套用的物件／綁定／規則；有規則或物件覆寫草稿時，先套用或放棄。物件 emitter 使用快照位置及旋轉後的 offset；fixed emitter 使用已設定位置；zone 尚未支援。缺少真實 mapping 輸入時明示拒絕。
- 接觸規則只接受保留的真實 physics input 與已接受 start VoiceIntent。位置取 contact point，重用該次已接受的 generator、gain、pitch 與 filter。選取原 physics event 時，另以物件／binding／rule 找到對應 layer，不任取第一個聲音。
- 接觸快取最多 64 筆，同一 revision／epoch 共用一份作者文件快照；Scene／Behavior 作者變更或 epoch 重建會清除快取。預聽前比對文件 canonical 內容，包含 binding overrides；不把舊事件的參數標為目前文件的結果。
- 一個明示 source 經既有 `buildAcousticRequests`、Custom Acoustic Core 與 AudioEngine 路由。沒有新增傳播、距離增益或 HRTF 算法。預聽 renderer 的局部上限為 1 voice、8 individual paths 加 1 late send，共 9 paths；這不是正式產品效能預算的新數值。
- 預聽使用獨立 AudioContext／epoch 0。預設發聲 2 s、硬上限 3 s；rule one-shot／lifecycle 可更短。傳播與混響尾音另計，Inspector 顯示靜態快照與 source／listener／Scene／document／Profile／rule／binding／contact／solver revisions。明示預聽不評估 trigger／conditions，不是振動量測。
- 全域 Mute、monitor gain 與 Raw／Simulated 仍控制預聽。已啟用且 muted 的主引擎不會因預聽而自動解除靜音。Raw 顯示置中乾音旁通；Simulated 才使用場景傳播與 HRTF。
- Running 時乾音及場景預聽均要求先暫停；暫停錄製時可以獨立預聽，不寫原錄製。重播中要求先返回即時場景。Run／Recording／replay、作者修改、明示停止、blur 或 dispose 會取消或停止獨立預聽。runtime intent 與 renderer serial 同時防止等待裝置啟用後的遲到播放。
- Node 整合案例比對原 Scene、Behavior document／snapshot、runId／epoch、tick、事件、錄製及比較資訊，預聽不改這些原始資料。

## 可重現修復

1. [drain-regression-red.tap](drain-regression-red.tap)：快速替換混響預聽時，已 dispose 的引擎等待淡出後仍建立節點，數量從 59 增至 63。修補在既有 `AudioEngine.drainVoices` 等待後檢查 disposed；不更改 DSP 公式或容差。
2. [integration-races-red.tap](integration-races-red.tap)：兩個新案例先確實失敗。其一是 Stop 早於 helper 啟動，舊 action 仍遲到發聲；其二是同一 physics event 的多個 impact layers 選錯 capture。runtime intent 與完整選取 tuple 修復後通過。
3. 乾音 audition 增加獨立停止與 post-enable identity 檢查，避免開始 Run 或按停止後仍遲到播放。沒有更改原生聲學 oracle、歷史 FAIL 或既有驗收。

## 驗證與限制

固定 helper 基線 [helper-proof.json](helper-proof.json) 保存最初 14 項 GREEN、相鄰 53 項與來源 hashes；後續整合有版本化的新來源，不能把該基線當現行 bytes 證據。

現行來源與命令結果見 [final-proof.json](final-proof.json)，原始 Node 輸出見 [final-node-green.tap](final-node-green.tap)：相關回歸 **92／92 PASS**，包含新預聽與相鄰音訊／runtime／diagnostics／locale 案例。獨立代理另跑新 runtime／helper／control graph **22／22 PASS**，並靜態檢查 UI／browser 測試契約。真 Rapier 接觸使用正式 WASM；音訊 Node 案例使用 fake context，只驗控制圖與生命週期，不代表原生 PCM。

以下仍為本分項 **NOT RUN**：實際 browser 預聽互動／native routes、預聽 PCM、裝置／耳機聽測及整體第一版驗收。已備妥 `tests/browser/static-preview.spec.ts` 兩案與獨立 config，由 root 在整體來源凍結及新 build 後協調執行；本工作沒有自行啟動 browser、server 或 build。真正 browser 證據完成前，不以 Node、token 或碼審宣稱視覺／聲學輸出通過。
