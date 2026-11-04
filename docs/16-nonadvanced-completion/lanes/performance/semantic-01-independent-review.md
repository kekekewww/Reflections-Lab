# Semantic-01 獨立 raw／官方 producer 審查

狀態：**唯讀根因審查完成；原 V3 仍拒收，未取得新資格**。本次 runSourceCommit 為 `bd64e4fba73b3a8d2ead6b6cca9d984c67299e81`；Chrome156.0.8078.75／revision `@861389936bf33ea77529ee5dcc0605e68f6bb620`。逐事件觀察、原始檔／官方來源 hashes及限制見 [JSON](semantic-01-independent-review.json)。

metadata範圍：JSON舊欄 `observedHead` 保留為 runSourceCommit alias，不表示後續review時的最新HEAD。本次釐清時唯讀實查的 `reviewObservedHead` 為 `047d977f723db067cf703cf265c207855095420e`（2026-11-02T19:37:30.8047856Z）；原run、raw及source pins未更動。

## 原拒收的確切原因

[原 trace](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2896a6f0a61f53ff46ee8d737fc32243d787590c) 為81,393B gzip，解壓834,926B／3,306events；SHA256 `c4481687bfbcb7657a1f0a55d91f48b1e57d68c2736ea6de7a8dcfb40f887b72`。

唯一不受原predicate支持的renderer task位於 `/traceEvents/2377`（0-based）：

```json
{"args":{"src_file":"cc/trees/proxy_impl.cc","src_func":"ScheduledActionSendBeginMainFrame","src_line":849},"cat":"toplevel","name":"ThreadControllerImpl::RunTask","ph":"B","pid":72488,"tid":93008,"ts":99067311504}
```

原begin/end是99066898433／99067295193µs。此event在end**之後16,311µs**，沒有 `dur`；renderer共48個task候選，47個 `X`、1個 `B`，沒有renderer `E`。category沒有改變。

[封存原predicate](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/3f806bc57e2c401074dc46062ab68e3764dfbd0c) L291明定先驗證全部same-renderer candidates，再做overlap選擇；L314–318要求非instant是完整 `X` span。此 `B` 因phase／無duration被正確拒收，不能因窗外而重標原結果。原 `RENDERER_TASK_SCHEMA_OR_CATEGORY`、`UNVERIFIED_NOT_APPROVED`、空numeric結果及native oracle的 `observedCounts:null` 全部保留。

## 官方 pinned producer／exporter 鏈

以下來源均由獨立子審查以Windows `Invoke-WebRequest` 正常TLS取得HTTP200，未停用憑證驗證。web工具不可access、Python trust-store錯誤與一次503是取證歷史，不是檔案404。完整decoded-source SHA／bytes／license header記在JSON，未複製全文入庫。

| 固定來源 | 行號與可證語義 |
| --- | --- |
| [Chromium controller](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/task/sequence_manager/thread_controller_with_message_pump_impl.cc#476) | L476–484將 `ThreadControllerImpl::RunTask` 交給TaskAnnotator。 |
| [TaskAnnotator header](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/task/common/task_annotator.h#102) | L102–115以 `TRACE_EVENT("toplevel", event_name, …)` 包住RunTaskImpl。 |
| [TaskAnnotator implementation](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/task/common/task_annotator.cc#261)、[interned location](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/base/trace_event/interned_args_helper.cc#34) | L261–264／L34–47記錄posting location的file/function/line。 |
| [Chromium DEPS](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/DEPS#2843) | L2843–2844固定Perfetto `403906f4adfbf287a02e5546f8430dcc9d56b649`。 |
| [Pinned JSON exporter](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/trace_processor/export_json.cc#646) | L646–660映射 `src_file/src_func/src_line`；L799–809建立event的ts/category/name/args。 |
| [Pinned thread-slice export](https://chromium.googlesource.com/external/github.com/google/perfetto/+/403906f4adfbf287a02e5546f8430dcc9d56b649/src/trace_processor/export_json.cc#880) | L880–908：零duration→`I+s:t`；正duration→`X+dur`；未完成的負duration→`B`，不產生duration／end。 |
| [實際 posting site](https://chromium.googlesource.com/chromium/src/+/861389936bf33ea77529ee5dcc0605e68f6bb620/cc/trees/proxy_impl.cc#806) | L806函式內，L849是PostTask的 `FROM_HERE`；L850綁定ProxyMain::BeginMainFrame。 |

raw的 `B`／無 `dur`／無 `s` 符合此pinned exporter的unfinished thread-slice分支，**不是新category，也不是已證明的版本變更**。`src_func` 是posting location，不能當作task執行函式或耗時。JSON沒有原protobuf `duration_ns`；它不能單獨證明為何slice未結束。trace-stop右設限與此次窗外事件相容，仍是機制推論，不能補造duration。

## 完整 RAF 集合與時間觀察

獨立Python僅讀原gzip／JSON，不呼叫產品parser、不跑新browser：

- 26個唯一journal registration handles、24callbacks、13groups；group sizes精確為 `[2,3,2,1,3,2,1,2,2,1,2,1,2]`。
- owned document有23Requests、24Fires、1Cancel；25個native trace handles、0unknown。23Requests是22個會執行的posttrace callbacks加MC。
- 每個posttrace Request與唯一MC Cancel均在其parent Fire及原window內。MC handle9的Request／Cancel為99067112174／99067112220µs，parent B1 Fire為99067112120+149µs；MC沒有Fire。
- PC handle1的native register/cancel發生trace前，本trace不能獨立證明其取消。P0/P1 Request未捕獲、各有一個Fire，符合pretrace-pending範圍。
- 13個proof physical callTime均在自己的Fire／window內。E0 ordinal6／handle14的mark ts=99066512284µs早於begin，但physical callTime=99067178607µs在Fire=99067178423+256µs內。
- 最後owned Fire.end=99067294986µs，距end mark207µs。native markers相差396760µs；DOM performance window是396.70000000298023ms，各保留原值，不取整或互換。

這些分項是**觀察通過，不是資格通過**。正式native oracle因原strict拒收而停止，不以本報告回填其null欄位。

## 後續方法候選與界線

建議另建受版控方法ADR／等價契約、有限正負fixtures與producer registry，不改原V3或舊pin。窄候選是保留完整raw並分類所有task，僅把同owned renderer、`cat==="toplevel"`、已核實source args精確形狀、`dur`不存在、有限 `ts>end` 的已知begin-only event另列為post-window unfinished。起始允許值應固定本次已證source location；duration保留null、numericIncluded=false，不設0、不刪event。任何 `B<=end`、未知 `E`、錯category/args/identity、負值或非有限值仍拒絕。

原完整span數值core、binary64邊界、caps、workload、voices/paths/geometry/capture與門檻均不變，不加epsilon、重bin或duration scaling。這只是 **PROPOSED，未採納／未執行**。新版本仍需新semantic pilot、原20秒all wiring與正式600秒驗證，不能將本次raw改成PASS。

另一方向是在end後增加有界renderer quiescence/freeze handshake再關trace。它可能減少unfinished尾端，但增加post-window lifecycle介入，無法保證不再有begin-only event；須固定source、保存所有失敗、重新量測。直接收原生protobuf可取得更明確slice資訊，但parser、資源與provenance工作增加，也不能補回此次JSON的duration。

## 資源與本次操作

原程序exit1／4754.4203ms；browser disconnected、server不再listening、cleanup233ms／0errors。process outcome為machineLeaseReleasable=true、pilotSucceeded=false；這是正常結束的實際cleanup證據，沒有冒稱forced process-tree termination。

本審查只新增本MD／JSON，沒有更動source/tests、舊raw、pin、predicate或容差；未跑unit/build/format、新browser、音訊裝置／聽測或正式600秒。持久task／來源登錄交唯一memory writer對帳。
