# 原生音訊准入拒絕：關聯與診斷修補

日期：2026-10-27。範圍僅為 V1-UX-04 的即時原生拒絕關聯；不代表整體第一版完成。

`LabRuntime.solveCurrent` 原先只以可被覆寫的 notice 顯示 `AudioEngine.playVoice` 拒絕。修補保存 enqueue 當下的 VoiceIntent 與 Behavior document revision，將真實拒絕結果連到原始 event、instance、binding、rule、object／generation、epoch、profile、source 與 AcousticFrame request。後續邏輯 update 不會改寫原始關聯；拒絕時點與邏輯事件時點分開顯示。

最多保留 64 筆即時原生拒絕。Event／Rule 診斷與核心邏輯決策分開，清楚標示原生拒絕原因及「邏輯實例不代表實際裝置輸出」。authoring／epoch、replay／seek 邊界清除此暫存；預聽不改寫原 run 診斷。未修改 schema、錄製格式、核心 cooldown／global limit、音訊預算或 acoustic DSP。

## 已執行證據

- [原始 RED](red.txt)：真 LabRuntime、真 AudioEngine、FakeAudioContext 與真求解結果；明確設定測試用 `maxSources=8`，9 個邏輯來源中原生接受 8 個並拒絕 1 個，但原程式沒有可檢查關聯。失敗原文保留，未放寬驗收。
- [GREEN 35／35](green-final.txt) 與 [命令／來源雜湊](node-verification.json)：新增 5 案涵蓋非同步原始 intent、saved pending 複製、pause／notice、capture 排除、replay／seek 清理、有界容量及未知／prototype 名稱原因；相鄰核心診斷、預聽、重播與 runtime 一併通過。
- [獨立審查](independent-review.json)：分開程序 20／20 PASS，16 份檢查檔案前後 hash 一致，修正建議已核對。typecheck、指定檔案 lint／format、Emil pin／standards 通過；後兩者僅為靜態檢查。

產品原生預算仍為 24 voices／32 sources；測試的 8-source 容量是明示 fixture，不是產品預設。FakeAudioContext 僅記錄控制圖，不模擬 DSP／PCM。

## 尚未執行

[原生瀏覽器 2 案](../../../tests/browser/native-admission.spec.ts) 與[獨立設定](../../../tests/browser/native-admission.config.ts)已準備，狀態為 **NOT RUN**，由 root 安排凍結來源與瀏覽器窗口。實際裝置輸出、聽測、PCM 及性能不由本修補的 Node 證據推論通過。完整 `npm run check`、Wiki／Task、英文文件與 Git 整理由 root 整合。
