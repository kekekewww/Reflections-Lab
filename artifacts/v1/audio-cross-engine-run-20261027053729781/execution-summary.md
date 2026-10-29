# Native 跨引擎執行紀錄

2026-10-27，Codex 執行；Windows，Playwright 1.64.1，既有快取引擎。整體 **FAIL／exit 1**，不能宣稱跨引擎通過。未改動產品程式、六份原 suite 或其數值門檻。

實際命令（sandbox 的 native process／loopback socket 權限失敗後，以已授權的 elevated execution 執行同一 runner）：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\kevin\AppData\Local\ms-playwright'
node tests/audio-runtime/run-cross-engine.mjs --run --engines firefox,webkit
```

| 實際引擎版本                                 | PASS | FAIL | BLOCKED_CAPABILITY | NOT_RUN_AGGREGATE_DEPENDENCY |
| -------------------------------------------- | ---: | ---: | -----------------: | ---------------------------: |
| Firefox 157.0                                |    8 |    1 |                  9 |                            7 |
| Playwright WebKit 27.2（Windows 快取 build） |    0 |    0 |                 25 |                            0 |

Firefox 有效 native render 未通過 `native-pressure-gain-once-and-no-convolver-normalization`。`actualEnergy=0.31246948243551215`，`expectedEnergy=0.3125`，絕對差 `0.00003051756448785`，未達原始 `abs(error) < 1e-5`。此結果保留為數值 **FAIL**；未放寬門檻、補償 latency 或挑選重跑。其他六項 baseline（包含 HRTF 有限且非零輸出）與兩項 WAV native decode 通過。失敗根因尚未確定，不能憑此結果宣稱產品程式或特定引擎的根因已查明。

Firefox 未提供 `OfflineAudioContext.prototype.suspend`，九項依賴該 API 的案例受阻；另七項因原 aggregate 函式無法獨立回傳而未執行，不能宣稱那些案例本身不支援。Windows 快取 WebKit build 的實際頁面沒有 `AudioContext`／`OfflineAudioContext` constructor，25項均受能力阻擋；此觀測不能延伸為所有 Safari／WebKit 平台的能力結論。

`verification.json` 與十二份每-suite JSON 保留原始結果、原生 operation trace、能力與前後 SHA-256；`sourceStable=true`。兩個自有 BrowserServer 均正常 close，source server 正常 close；`process-cleanup.json` 的 elevated 唯讀 CIM 查核顯示 Firefox／Playwright／WebKit 程序數為0。已通知 Root 與 UI owner `AUDIOCROSSEND`，釋放 browser slot。

前兩次環境失敗保存在同層 `audio-cross-engine-run-20261027053658230`（sandbox 預設 cache 路徑缺執行檔，未啟動 browser）與 `audio-cross-engine-run-20261027053715567`（顯式 cache 路徑後，Firefox process crash／WebKit loopback EACCES，未執行案例）；未將這些當成 DSP 結果。

本次只涵蓋有限原生 DSP／游標／pause fixtures 的可執行範圍。人工聽測、裝置 latency、SPL、AudioWorklet、長時間 capacity 與 Meta API 均未驗證。
