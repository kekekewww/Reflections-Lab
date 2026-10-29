# 第一版整合 checkpoint r8：原生音訊通過，reference 缺陷已定位，短效能仍未達標

日期：2026-10-28（Asia/Taipei；原始檔名與 receipt 時間使用 UTC）。完整第一版 goal 仍 ACTIVE，原 51 項、EN01–06、Task criteria、負載及數值門檻不變。[r7](SESSION_PROGRESS_20261027-r7.md) 的鎖版 offline CI、900 項 scoped runtime、typecheck／lint 及 `a699…` **E2E 驗證建置**保留；它不是未加測試 hook 的 production release，也不是整體完成。

## 新版原生音訊 25/25 PASS

prepared-static V2 使用凍結原 runner，只作四個 bootstrap 替換；原流程、gesture、capability、classifier、oracle、15 秒／2 秒及 suite 時限不變。七個 bundle 由精確來源 bytes 預建置，30 項 conformance／負例測試通過，兩位隔離 reviewer 無阻擋問題。

實際 Node 68988 的 retained child close 為 exit 0／signal null；cached Chromium headless-shell `156.0.8078.4` 實際執行全部 25 個原始唯一 IDs，**25 PASS、無略過**。原 23 份來源、補充 6 份來源、manifest／bundles 不變；全域 1749 項輸入前後一致。已知 Node／browser／build PIDs 及直接子程序為 0，static server 關閉。[最終收據](../../artifacts/v1/audio-prepared-native-v2-20261027154159861/qualification-receipt.json)。先前兩次 Vite 準備逾時仍保留，不被改寫為 PASS。Conformance 首輪的 stdout 留在工具紀錄，沒有獨立 raw TAP 檔；此限制已寫入收據。

## 新 IR reference 的失敗與原因

獨立 IR state v1 實際完成 3 項／6 renders／576000 bytes PCM：相同 IR 的 impulse tail 與 continuous tone scalar 20ms 兩項 **RMS／max error 均為 0**；A→B→A 項保留 **FAIL**（RMS `0.028180324598435457`、max `0.24689234048128128`），原 `.001`／`1e-5` 界線未改。[原始失敗收據](../../artifacts/v1/audio-prepared-ir-v1-20261027155431842/qualification-receipt.json)。

既有 PCM 比對確認差異只在 frame 4097–5055，即第一次 B 的 20ms 淡入；後續穩態及回到 A 均相同。獨立 literal FIR／直接卷積模型顯示：產品吻合 B 從 0 淡入，reference 則吻合 B 直接從 1 開始。另一次小型 native 診斷直接確認：未被 pull 的 GainNode，設定 `.value=0` 時 getter 為 0，僅 `setValueAtTime(0,0)` 時 getter 仍為 1；reference 隨後把該 1 當 ramp 起點。產品原有 constructor 的初始化未改，隔離 reviewer 已核實原因。[原生因果證據](../../artifacts/v1/audio-gain-getter-diagnostic-20261027160249209/causal-receipt.json)。[Web Audio 官方定義](https://webaudio.github.io/web-audio-api/#dom-audioparam-value) 區分 setter 對 current value 的賦值與 automation 排程；這不是房間量測或硬體聽測。

產品程式、舊 oracle／容差均未因這次失敗修改。修正版 reference 必須另作版本、保留 v1 FAIL、確認初始化及負例，再執行 native；目前 **reference v2 NOT RUN**，不能把上述診斷當作 v1 通過。

## 一次診斷 smoke：量測有效性改善，實際成本仍 FAIL

在所有來源 writer 與自有重負載停止後，只執行一次：

```powershell
node tests/browser/performance-profile.mjs --phase all --seconds 10 --physics-iterations 120 --acoustic-iterations 20
```

實際 retained native handle 與 .NET exit 均為 0，SafeHandle pin／兩種 exit reader 一致；這只證程序正常結束。source／bundle 前後不變，已知 Node 51808／直接子程序與 5191 清理完成。[診斷摘要](../../artifacts/v1/browser-performance-20261027T160813274Z/diagnostic-summary.json)、[清理](../../artifacts/v1/browser-performance-20261027T160813274Z/cleanup-proof.json)。摘要原始 PowerShell JSON 含 UTF-8 BOM；讀取時可移除 BOM 後 parse，原 bytes／hash 不改。

- Physics：120 measured steps，255 Dynamic 全醒、1 Fixed、64 CCD，wake／setup 與 native bracket 分開。native p50／p95／max = `1.4／3.2／10.7ms`，原 `<2ms` 目標 FAIL；120 筆不滿正式樣本數。
- Acoustic：每配置只有 20 warmup＋20 measured。預設 64 paths 的 observable delivery median／p95／max = `3.0／15.0／22.4ms`；壓力配置為 `5.8／8.8／9.6ms`，原 `<1ms` 目標 FAIL。分別 4／2 個 deadline misses；壓力配置 current paths 255–256、warmup 16＋measured 7 drops，不能宣稱持續 256 current paths 或完整 20Hz 負載。
- UI：10.344 秒、189 RAF／257 ticks，30 overruns、80 paused advances、2.267 秒 dropped wall time；capture 僅 4 frames 並有 overrun／錄製 debt。RAF interval p95 `184.3ms`、callback `114.7ms`、advance `91.9ms`；完整 native wall main occupancy p95 `183.873ms`。短樣本及工作負載缺口明列，沒有正式 600 秒 PASS。
- V2 RAF 有限／順序／collection membership／同 renderer markers／trace coverage 檢查皆成立，無 CDP data loss；保留 leading RAF offset `−28.9ms` 與兩個真 clock anchors，沒有丟棄邊緣工作或重算舊 trace。

本輪開始可用記憶體約 4.406GB，先前 600 秒約 13.625GB，硬體型號相同。此差異及短樣本離群值不足以證明 GC、OS preemption、程式退步或修補有效。正以現有 raw 分項、來源與實際 identity／呼叫路徑找原因；不盲目重跑、不降低負載、不改門檻、不終止其他應用程式。

## 未完成與下一步

先完成 UI／physics／audio 的有界唯讀原因診斷，再提出最小修補及固定 reference／RED-GREEN／獨立驗證。修正版 IR reference、當前來源 Firefox／WebKit 比較、新版 UI／native zoom／physics／storage／產品 E2E、正式 600 秒、實際裝置聽測與 block 仍待相應證據。Hi-x65／D3V 僅使用者回報；cache 聽測工具已有 18 synthetic＋11 pure host tests 與隔離 review，但 driver／硬體仍 NOT RUN，尚未提升為正式檔案。

最終狀態／需求表／Wiki／Task／英文 freshness／完整 check／本地 Git checkpoint 仍待完成；Task0020 維持 IN_PROGRESS，Task0006／0017／0019 的既有 DONE 保留。沒有 Muse Code、新增付費 Meta、push 或部署。資格／條款、根 LICENSE 與發布等外部決定仍未代作。
