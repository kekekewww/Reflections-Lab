# Semantic attempt02 V4：原數值覆蓋拒收

Root 明確授予獨佔窗口後，於 2026-11-03 實際執行已固定的 V2 短追蹤命令。結果為 exit1、UNVERIFIED_NOT_APPROVED；owned child 實際 4942.5342ms，沒有 timeout／output limit。這不是 600 秒正式工作負載，也不代表產品或新頂列的效能。

原始 V3 event eligibility、V4 strict native、journal 與 full native set 都通過，V4 沒有分類任何事件。本次不需要使用窗外 B 例外；attempt01 的原始拒收及全部原門檻保持。原 26 個註冊、24 個 callback、13 個群組、23 Request／24 Fire／1 Cancel 與 25 個 trace handles 均保留。

失敗條件已具體定位：原 numeric core 要求第一個 selected task 距 begin 不超過 50000us。本次 begin=953965750us，原始 ordinal226 的第一個完整 renderer task 起於 954017620us，差 51870us，超過 1870us；尾端差為 0，selected tasks=41。因此 complete=false，主執行緒數值陣列保持空值，不能冒稱 0ms 或 PASS。原因並非 V4 分類，也未修改原 core、bin 邊界、完整性門檻或量測起訖。

初步來源檢查顯示 prepareAndPause 的 task 在 trace 前已進入並被 debugger 暫停；begin 在 resume 同一個既存 task 內。此為待獨立 raw 核對的 fixture 起始時序問題，尚不能僅據此斷言未完成 slice 的原因。沒有立即重跑；任何接續 fixture 修正需另版、獨立 RED/GREEN 與新來源固定，原失敗持續保留。

清理已成功：browserConnectedAfterCleanup=false、serverListeningAfterCleanup=false、cleanupErrors=[]，耗時584ms；RAF／cancel identity 均保持、pending=0、state=CLOSED。source／executable 前後穩定，wrapper 的 machineLeaseReleasable=true 已與 pilotSucceeded=false 分別回報 Root。正常 direct_process 結束，processTreeStopped=null，不宣稱強制樹狀關閉證據。

八個 canonical raw 複本與雜湊見 semantic-attempt02-v4-receipt.json；trace gzip SHA256=02e874df3350dbab25db5a9b10c7503bc2bc9bd65f26b87c613aa952fd767d0b。3565 個事件，gzip 85161B／解壓 892375B。固定 27 個來源逐項相符，原 V2 精確 SHA256 仍為 df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c。

本短追蹤沒有 AudioContext／產品 UI；sample rate、hardware block、native DSP CPU 均為 null。新頂列預設 levels／master-left 的 RAF、15Hz 取樣與 analyser 是正式產品負載，未來 probe-on／off 與 before／after 必須分別固定並保留，不得用本短追蹤推估其成本。正式資格 registry 仍空白，20秒 wiring、PCM 與 600秒正式量測尚未執行。
