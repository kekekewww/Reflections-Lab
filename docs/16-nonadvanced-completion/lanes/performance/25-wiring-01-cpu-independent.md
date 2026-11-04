# Wiring-01 CPU 原始證據獨立複核

本次固定來源 `6ba01b44b57a4741a7e58fb42718e71875b776f3` 的 probe-on／reference／levels／master-left wiring 已實際執行 Win32 helper。**兩端擷取成功，但 CPU 整體 coverage 不完整，total 與 ratio 仍為 null；不是正式 qualified 或 overhead／DSP／硬體 PASS。**完整原始值、source pins 與複核範圍見 [JSON](25-wiring-01-cpu-independent.json)。

作者只讀本次既有 JSON、request 與檔案雜湊，用 PowerShell 整數算術重算；沒有執行 Node 測試、Win32 reader、browser、native workload 或 source implementation。作者曾實作原 helper，於此揭露；另以 fresh task 的 `wiring01_cpu_raw_audit` 隔離重讀 raw，核對逐列算術、集合、時間與 hash。這是 raw CPU 收據範圍的複核，不是整體驗收重跑。

## 實際結果

原 wrapper `process.json`：child exit 0、164011.1264 ms、`process_stopped=true`、`stop_scope=direct_process`、tree status null。`verification.json` 的結果仍為 `MEASURED_WITH_INCOMPLETE_ACOUSTIC_WORKLOAD`，`formalQualified=false`、`formalQualification=NOT_APPROVED`、`formal600Run=false`；20 秒 diagnostic 的完成不取代原 acoustic workload gate。

before 有 8 個 PID/type；after 保留同 8 筆，另外新增 `33516 | tracing.mojom.TracingService`，creation FILETIME 為 `134381491501101454`。各端 CDP、request 實檔、內嵌 request 與 Win32 reply 集合一致。17 筆 Win32 row 的 open／query／close 都是 strict boolean true，三個 error code 都是 null；兩次 helper exit 0、stderr 空、無 timeout／取消／output cap。

8 個共同 PID 的 creation 字串精確一致；以 BigInt 先分別相減 kernel/user 再相加，逐列 ticks／seconds 與原 OS summary 完全一致：

| PID | type | 同一 creation FILETIME | OS delta ticks | OS CPU seconds |
| --- | --- | --- | ---: | ---: |
| 54676 | audio.mojom.AudioService | 134381490641243149 | 625000 | 0.0625 |
| 69272 | renderer | 134381490232459173 | 0 | 0 |
| 74496 | renderer | 134381490232958037 | 0 | 0 |
| 78244 | GPU | 134381490230644297 | 46718750 | 4.671875 |
| 78952 | network.mojom.NetworkService | 134381490230747646 | 0 | 0 |
| 85208 | storage.mojom.StorageService | 134381490231157579 | 0 | 0 |
| 85828 | browser | 134381490226938490 | 3437500 | 0.34375 |
| 86724 | renderer | 134381490233047843 | 288906250 | 28.890625 |

這些是各個完整程序的所有執行緒 CPU。**AudioService 的 0.0625 秒不是 native graph DSP；renderer 內的 native graph 執行緒並未拆出。不能拿 renderer CPU 減 AudioService CPU 推論 main-thread CPU。**成功查詢、同 creation 的真正零增量保留為零；新增 TracingService 沒有 before，因此其 interval delta 保持 null。

兩個 summary 都正確保留 `PARTIAL_PROCESS_COVERAGE`、`completeCoverage=false`：OS reason 為 `PROCESS_SET_IDENTITY_OR_COUNTER_CHANGED`，CDP 為 `PROCESS_ENDPOINT_IDENTITY_SET_CHANGED`；兩個 canonical total／ratio 均為 null。未加總存活 subset 冒充整個 browser CPU。CDP 各列也與各自原始 counter 相減一致，但 counter 實作／解析度與 sequential brackets 不同，不能強迫等於 Win32，或借差異推論 DSP／probe 成本。

## 時間與原始資料

原 browser window 為 `20179.099999999627 ms`。CDP 實際 completion-to-completion 分母為 `22809.280500000023 ms`，min／max sampling interval 為 `22803.080000000016 / 22811.597800000018 ms`。Win32 OS 分母為 `23034.858200000017 ms`，min／max 為 `21973.23940000002 / 23863.149200000014 ms`。這些都由實際 Node monotonic brackets 重算一致，沒有以固定 20 或 600 秒代替。

before OS 已完成後才開始 begin RPC；after CDP／OS 都在 close RPC 完成後才開始，包含 tracing start、begin／close control 與共享 endpoint 成本，排除 disk checkpoint、tail 與 trace flush。CDP／OS 比 browser window 多出的 `2630.180500000395 / 2855.7582000003895 ms` 只支持 duration difference，不能當成 probe overhead 或效益；本次也沒有同條件 probe-off 對照。

before／after helper process duration 為 `804.4566999999806 / 1032.1988000000129 ms`，不是它們的 CPU time。兩份 request 實檔 bytes 與記錄的 requestJson 完全相同，SHA 及前後 pin 都符合；UTF-8 原始 stdout 保留 CRLF 後重算 SHA 也一致：

| 原始資料 | SHA256 |
| --- | --- |
| native/verification.json | `54bd0ad185a6be4f25acbccd4c8a2b6f7c4fc9268af4265205505ec8570bec7e` |
| before request | `f2056cd7c389113dc0462229c98822d09e55d13f125bf127996b6506bab644bc` |
| after request | `f5eca729f2fd78e711ee640f818f67ed40f0a03684e368c17662224769fc71d3` |
| before raw stdout | `47b7a17641acc5df106999310f62b4c688e2b7c18b4fbecd272f2ce9ea7322fd` |
| after raw stdout | `d8ba3b7214cdd560cfa70e846a67fc3deb399235c544efe240777701f0cf73b7` |

固定 helper 為 `596679bd1aaccf9c6b839b9cead0ed4d83c3cde930b4e7c1e37d4ccf1e505784`／7363 bytes；PowerShell executable 為 `60c9b29843624dd8af6b6a7b26147753be6aeef65098b9a503cc50850afe410f`／495616 bytes，兩端前後 pin 與目前檔案都一致。`v1.0` 是 executable 路徑的一部分，不當成實測版本。Chrome 156.0.8078.75、revision `861389936bf33ea77529ee5dcc0605e68f6bb620`，executable `7c2fe7741b1bc13ca1565658557a15773f8ebbf0a66fb5448f0fdf67bccf50fa` 也符合原前後 pin 與目前檔案。

## 來源集合與限制

[24 號 dispatch receipt](24-v4-wiring-01-source-pins.json) 的 375 unique pins，對 `verification.sourceInputs` 374 unique pins 的精確差集，只有額外 registration 檔 `tests/integration/performance-v4-method.test.mjs`（534 bytes，SHA `64ad8e3ab51b7b7957e7f79b7be4930be87a787b0df783e1fe35922073a472e7`）。native-only 為空，374 個共同 hash 沒有不一致。build-manifest.inputs 374 與 native 374 完整集合及 hashes 相同。command.source 59、wrapper before／after 各 59，也都是同 hash subset；各層範圍分開記錄，沒有硬合數量。

來源穩定與 bundle 穩定為原 run receipt 的觀察；本次另重算的是 CPU 相關五份 producer 與兩個 executable 的目前 hash，沒有宣稱重新 hash 全部 375 檔。原始 cleanup 記錄 browser disconnected、CPU helper releasable、preview child stopped、獨立 bounded TCP probe 為 ECONNREFUSED；wrapper outcome 的 machineLeaseReleasable 為 true。本次沒有再次查詢程序或 port，lease 釋放由父代理原記錄處理。

`nativeDspCpuMs`、`hardwareUnderruns` 仍為 null；原生 hardware block、deadline、PCM continuity、聽測與正式 600 秒均不由這些 CPU receipts 建立。保留原 acoustic failure、所有原資格與門檻，未將 endpoint 成功升格成 CPU coverage／overhead／DSP／hardware 或第一版 PASS。18、22、24 號報告與 raw artifacts 未改寫。
