# 跨引擎 native 音訊驗證

本 runner 直接重用六份既有 native suite 的 **25 個原始案例**；不改數值 oracle／threshold，不更動 `src/audio`、runtime 或 App bootstrap。每個 suite 使用新的 browser context；測試頁只有一個真 user-activation button，沒有產品 App、Vite client 或 HMR。AudioContext／OfflineAudioContext 與音訊 nodes 均為各引擎的真實原生實作。

2026-10-27實際執行整體 **FAIL／exit1**，來源hash在當次執行前後相同：

| 實際引擎                         | PASS | FAIL | API阻擋 | aggregate未執行 |
| -------------------------------- | ---: | ---: | ------: | --------------: |
| Firefox157.0                     |    8 |    1 |       9 |               7 |
| Windows快取Playwright WebKit27.2 |    0 |    0 |      25 |               0 |

Firefox能量為0.31246948243551215，理想0.3125，仍未達原`abs(error)<1e-5`。缺少`OfflineAudioContext.suspend`阻擋的是timed offline oracle，不能用來斷言產品live Pause失敗。WebKit該build沒有AudioContext／OfflineAudioContext，不泛指其他Safari／WebKit平台。[原始verification](../../artifacts/v1/audio-cross-engine-run-20261027053729781/verification.json)、[執行摘要](../../artifacts/v1/audio-cross-engine-run-20261027053729781/execution-summary.md)。

後續僅執行一次、版本獨立的9圖native Delay參考，取得完整PCM及AudioParam readback；無Convolver的0.075s圖逐sample精確吻合預先固定的Float32分數延遲模型，雙路圖也重現原能量。這將差異限縮到該native Delay精度／插值相容性，而非證明產品整體跨引擎通過。新`1e-7`是獨立模型診斷值，原`1e-5`FAIL仍保留。[相容性證據及runner限制](../../artifacts/v1/audio-delay-reference-v1-run-20261027054851146/compatibility-summary.md)、[v1計畫](DELAY_REFERENCE_V1.md)。

準備時不會啟動 browser／server：

```powershell
node tests/audio-runtime/run-cross-engine.mjs --prepare --engines firefox,webkit
node --test tests/audio-runtime/cross-engine-runner.test.mjs
```

取得 Root 的 browser slot 後，才執行：

```powershell
node tests/audio-runtime/run-cross-engine.mjs --run --engines firefox,webkit
```

可用 `--engines chromium` 加跑原 fixture 的控制組；沒有自動 install、產品 API 或模型呼叫。`--output <workspace內的目錄>` 可指定新的 evidence directory；拒絕覆寫既有結果。預設輸出在 `artifacts/v1/audio-cross-engine-*`，包含 preparation、每組原始結果／操作 trace、前後 source hashes 與 verification。

目前套件manifest為Playwright1.64.1，cache labels為Firefox revision1555／version157.0、WebKit revision2370／version27.2。快取標記與實際執行證據分開；prepare僅核對檔案存在，實際版本／API／DSP結果見上表。準備報告不能稱跨引擎通過。在本機sandbox會改寫預設cache位置時，實際命令需先指定`$env:PLAYWRIGHT_BROWSERS_PATH='C:\Users\kevin\AppData\Local\ms-playwright'`；native process／loopback權限仍需依執行環境授權，不自動安裝引擎。

分類規則：

- 原 suite 完整回傳所有 pinned IDs、原始 `pass` 全 true，才列該 suite **PASS**。
- 每個引擎須涵蓋六個不同的原 suite 與25個原 case ID；重複 suite 不能補足缺漏。API probe 沒有取得資料屬於 harness **ERROR**，不能當成能力不支援。
- 有效 render 未達原閾值仍列 **FAIL**；不改 delay、補 latency、放寬 tolerance 或挑最佳重跑。
- 缺 Offline suspend/resume、PeriodicWave、WebCrypto 等必要 API 列 **BLOCKED_CAPABILITY**。原函式為 aggregate，若缺一個 API 令其他不相關 cases 也無法被原函式回傳，後者列 **NOT_RUN_AGGREGATE_DEPENDENCY**，不能假稱那個 case 本身不支援。
- 原生 `NotSupportedError` 或有 decode operation trace 的 `EncodingError` 列 capability block；原始 codec/stage/error 保留。HRTF 零能量本身不等於不支援。
- AudioContext.resume 在 deadline 後仍實際 suspended/pending，列 environment block。沒有此觀測的 timeout、method instrumentation／readonly assignment 錯誤及未知例外列 **ERROR**。
- 缺少 `cancelAndHoldAtTime` 不阻止測試：產品既有 fallback 必須接受同一 fade oracle。

每個 suite 數值執行 deadline45s、launch20s；context／page 建立、導航、API probe、模組準備各15s，cleanup／kill fallback各8s。觀測器只轉呼叫原生方法並記錄最多128筆狀態／codec metadata，保留原 promise 和數值；不替換 context 或合成輸出。例外／timeout 後關閉整個 context，若無法關閉則停止該引擎後續 suites。BrowserServer 與 source server 都由 runner 自己建立及釋放，不接管其他 agents 的程序或固定 port。

上述deadline不涵蓋本機Vite的dynamic import／createServer；此次兩組實際執行均已完成並保存正常清理，但runner不能宣稱所有初始化await都可取消。獨立Delay reference若後續圖拋錯，先前完成PCM目前也不會逐圖checkpoint回host；本次9圖完整成功取得PCM，未遇到此失敗路徑。這些工具限制不修飾原數值結果。

整體 exit code：完整所選引擎的25cases通過且 source stable／cleanup成功才是 **0**；數值／runner錯誤是 **1**；部分或全數被能力／環境阻擋是 **2**。部分結果不會因 Playwright launch 成功而變成 green。

此處只提供有限 native DSP／游標／pause fixtures。人工聽測、耳機個人化、裝置 end-to-end latency、SPL、AudioWorklet underrun、長時間 realtime capacity 均不在此 runner 的通過範圍。
