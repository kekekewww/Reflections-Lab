# Semantic attempt02：獨立原始追蹤審查

本輪真的失敗於原數值核心的起點 coverage，保留 `exit1 / UNVERIFIED_NOT_APPROVED`。Journal、strict native、原 raw V3 與 full native journal 均合格，但這不能取代數值 coverage。V4 分類為零，沒有套用窗外 B 例外；正式600秒仍未獲資格。

以 Python 標準函式庫獨立讀取實際 gzip／JSON，未 import 或執行產品 JavaScript。觀測 HEAD 為 `94cb2c49b5b00be5c777978b660eb1f9cf4c5f3e`；原 V3 核心 SHA `3d7810c63edc309df6b306debe6417ed13d73b6e899a7950043439b787421782`、原 V2 SHA `df86db94c6654399851ec1e3a4a240bc5821aee8dfa0745180d404c8cdf23c9c` 精確保留。原始檔／source pins、事件完整欄位及重建數值見同名 JSON。

## 精確拒收條件

`tests/browser/performance-native-v3.mjs:550` 保持 `selected.length > 0 && firstStart - begin <= 50000 && end - lastStop <= 50000`。本次三項結果依序為 true、false、true：

| 欄位 | 實際值（微秒） | 原始定位 |
| --- | ---: | --- |
| begin | 953965750 | `/traceEvents/168` |
| 第一個 selected task start | 954017620 | `/traceEvents/226` |
| 起點 gap | 51870 | 超過原50000上限1870 |
| end | 954578676 | `/traceEvents/2338` |
| 最後 task 原 start／dur | 954578569／5591 | `/traceEvents/2329` |
| 最後 task clip stop／終點 gap | 954578676／0 | 原 unchanged overlap |

Owner 是 `39104:32064`。52 個 owned named task 全為合法 X，窗口內 selected 41、merged 41；沒有 B／E。第一個 task 的 posting location 為 `extensions/renderer/script_injection_manager.cc:190 / DidDispatchDOMContentLoadedEvent`，這不是執行函式 CPU 歸因。最後 task 是 DOMTimer，原本超過 end 的尾段按原算法裁切。獨立重建 merged tasks 完全相同，performance bins 與 native bin boundaries 逐值 binary64 相同；`mainTaskOccupancyMs` 因 coverage 不足而維持空陣列，未產生假零或通過數值。

## 可證實的啟動缺口與未證實原因

Page v1 的 `prepareAndPause` 在 trace 前註冊 PC（隨即取消）與 P0／P1，再於第147行 debugger 暫停；Runner v2 第271–294行在暫停中開始 trace，恢復後，同一既有呼叫立刻建立 begin。程式沒有要求 begin 位於新的、完整被 trace 捕獲的 task。實際 `/traceEvents/156` 的前一個 inspector task 在 `953964944` 結束，早於 begin 806微秒；本 raw 沒有任何 selected 完整 RunTask 包住 begin。

這證明本次收據的 coverage 確實不足，也顯示啟動設計沒有保障 task 邊界；不證明51.870毫秒等待的排程原因，不證明 trace loss，也不證明重跑或延長就會合格。首個 RAF timestamp 為273.5ms，而真 callback observation 為597.2000000000698ms，兩種時鐘資料保留，不能用較晚 observation 取代原 timestamp 或移動起點。

## 有限修正候選

Root 已批准下列最小方案進入 source／VM unit 實作（不是新的 native 重試許可，也不是 qualification 通過）。已完成 source-only 審查：另版 page 在原 begin／OPEN 後只排一次 `setTimeout(0)` bootstrap，不移動 begin／end、不改26註冊／24callback／13groups／原50000微秒判準或數值核心。它是真實新增 task，成本完整進原 numeric；實際派送太晚則原 coverage 照樣失敗。在這些限制下未見必然作弊或硬阻，但此 bootstrap 不能回補原 resume 呼叫外層未捕獲的 task，也不能宣稱證明窗內所有 CPU 無遺漏。這是原 edge eligibility 的受控啟動，不是正式產品負載改善。

要另存有界 scheduled／entry／exit／actual delay aux receipt，並用真 `TimerInstall → TimerFire → aux marks` 同 renderer／精確frame／document navigation／timerId 配對，全部位於 window 與完整原生 RunTask 內。只排一次，不能用重複 heartbeat 等到可通過；requested timeout=0 不是實際delay=0；aux 名稱不可用 `rlab-v3.observe.` 前綴，否則舊 validator 會當未知 proof。Bootstrap 不另發RAF／cancel，cleanup需處理唯一pending timer。

本 raw 的原close timer已提供實際 schema：`/traceEvents/2316` TimerInstall 為 `ph:I / cat:devtools.timeline`，args.data 含 frame、singleShot:true、timeout:0、timerId:1；`/2330` TimerFire 為 X，frame與timerId相同。Timer args的frame是frame ID，不是navigation ID；navigation需另與mark／document pin對帳。這只是原close timer的schema，不是bootstrap已執行證據。

固定本次 raw 的負例、50000微秒／下一個binary64邊界、缺／重複／過晚bootstrap、錯owner/frame/navigation/id、非有限／逆序時戳與原26／24／13完整oracle，先驗證再另版freeze；最多一次經Root排程fresh native。原V2／V3核心、門檻、attempt01拒收與本次失敗均保留；不立即同來源重試。將begin移到fresh task的較大初案不採，避免改變原起點與P0／P1 pending關係。

## 清理與範圍

實際 receipt 顯示 cleanup584ms、errors空、browser disconnected、server not listening，RAF／cancel identity 相同、pending0、state CLOSED；source／executable 前後穩定。Wrapper 的 machineLeaseReleasable=true 與 pilotSucceeded=false 分開。這是短資格追蹤，沒有正式600秒、產品 monitor負載、PCM、設備輸出或聽感通過主張。
