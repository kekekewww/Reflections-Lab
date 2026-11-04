# Formal V4 driver 最終獨立來源審查

結論：**未發現剩餘 P1／P2，僅限來源審查與既有 artifact 核對。** 這不是正式 600 秒、原生圖形／CPU、probe overhead、DSP、硬體音訊或聽音通過。本次 `formal600Run:false`、`nativeDspCpuMs:null`；整體第一版與完整 PERF014 仍未由本報告閉合。

實讀 checkout HEAD：`540be353d1dd99f36aa8928873e43ffa15be460f`，時間 `2026-11-03T02:26:55.5733348+00:00`。HEAD 是 review 截點；未追蹤的新 driver/helper 另以完整 source hash 識別，不冒稱屬於較早 benchmark commit。精確 pins 與行號見 [JSON](21-formal-v4-driver-source-review.json)。

## 原工作負載與兩 arm 條件

- V4 CLI 沿用原 V3 formal 規則：600 秒、phase all、physics3000、acoustics600；原 software-GPU／prepare flags 仍不能混入 formal。formal monitor 固定 Levels／master-left。
- UI 保留 default ball＋99 dynamic，共原100 dynamic；capture starts 仍為10／300／580秒。錄製器原硬限18000 frames，在60Hz下是300秒，與600秒 UI wall 分開；不冒作600秒 capture。
- Physics 保留255 dynamic＋floor、CCD/contact load及3000 measured iterations。Worker 兩 profile 仍 path8／32、8 sources、32 surfaces、16384 segment budget，各20 warmup＋600 measured、50ms cadence。
- Task0033 指產品 TopMonitor 任務，不是33ms timer。兩 arm 都走正常 UI／RAF、15Hz native analyser；typed resource policy 是明確的差異，content model 仍須為 `nativeReference`。
- 實際 resource witness 對照原 caps：active24，graph48＋internal96／256，總graph144／304；reference carrier144／304、candidate176／336。沒有以降 voices／paths／geometry／capture 負載換通過。Enable／closed-window endpoints 與被動 monitor 分欄，不能推為全程資源紀錄。

主要來源：`performance-cli-v3.mjs:32–57`、`performance-cli-v4.mjs:20–67`、V4 fixture L88–127／388–391／800–822／1324–1420／1484–1493／1691–1797；原 recorder L30–33與 `docs/11-v1/PARAMETER_REFERENCE.md:198`。

## 已關閉的來源缺口

**Cleanup 不再捏造 no-listen。** 初版 wrapper 把 preview child exit 轉成 `serverListeningAfterCleanup:false`，即使 driver 的 listening 仍為 null。最終 helper 對127.0.0.1:5194做一次有界 TCP observation：connect=true、僅ECONNREFUSED=false、timeout／其他錯誤／逆序時鐘=null。Driver L1375–1408保存實際 receipt，true／null 均加入 cleanup error；wrapper L109–114把實際 listening 值傳給原 adapter，不再從 child exit 補成 false。原 forced-stop path 仍需 owned process-tree 證據；未知 helper closure 也會阻擋正常 lease release。

TCP receipt 只證明記錄時間的該次連線結果，不證明永久無 listener，也不歸屬或停止外來 listener。Timer 是有界觸發與實際 monotonic receipt，不宣稱精確全域 wall deadline。

**資格不再接受 true 子集／重複 profile。** 最終 contract L7–94明列19 UI、7 physics、每 acoustic15項 own true gates，並驗 productDefault／stress256 的唯一 identity與原8／64、32／256容量。L185–190先驗 browser revision 為字串，再做 replace；原 malformed-type throw 已關閉。這些沒有放寬原 threshold、原 rejected raw 或原數值核心。

## CPU 接點的實際 scope

Driver L943在 `Tracing.start` 前取 before；L1012在 close-window RPC後、L1059 disk checkpoint及tail／disposal／flush前取 after。兩 probe arm 共享同樣的既有 browserCDP、PID observation與 resource endpoints，不建立新 browser connection。Node monotonic brackets、實際 completion-to-completion denominator與 browser collection marks 分欄，不能以 requested600秒冒分母或作跨 clock 絕對對齊。

CDP CPU 與 Win32 helper都只是匹配端點的 **whole-process** 累計差值，包含 tracing/control/shared endpoint擾動；不是 callback、continuous lossless coverage 或 native-exclusive DSP。Win32 helper只查 CDP PID/type白名單、固定檔案 argv、5秒／1MiB bound，保留 executable/helper pins及 open/query/close flags、creation identity與 exact FILETIME 字串；先做 BigInt差值再換秒。沒有 execution-policy bypass。PID churn／倒退／未知值維持 null；CDP零值無 validity flag 不被當成idle，Win32成功flags下的真零另有可驗語義。

本次沒有啟動這些原生觀測；mock/source tests不能證明實際 CDP／Win32 counters、權限、完整PID覆蓋、擾動或GPU容量。`nativeDspCpuMs` 仍為 null。

## 資格範圍與未閉合項

最終 classifier 仍只可能產生 `ORIGINAL_UI_PHYSICS_ACOUSTIC_PROFILE_ONLY`；probe-off為 comparison-only。這個分類不是整體 PERF014／DSP／聽音或 V1 完成。

`completeMainThreadDelivery` 仍明列 **UNVERIFIED**（driver L839–886）。`combinedDelivery` 是 `KNOWN_STAGE_SUM_ONLY`；`receiveThroughNativeConsumers` 雖有實際 receive entry→native consumers 範圍，仍不含 pre-handler deserialization／OS dispatch與LabRuntime專屬 bookkeeping。局部 PASS 不能代替完整 canonical main-thread delivery p95<1ms gate。本輪遵照既有契約，不擴分類方法，也不把這個限制改成假 PASS。

Probe-off保留正常 monitor與主動共享 endpoints，所以是同條件比較 arm，不是零觀測成本。真正 paired overhead、原生圖形、600秒 wall及OS CPU實測仍 **NOT RUN**。

## Provenance 與既有驗證

Approval record SHA為 `a9b46674b9e5225ba138f4f8014364d3c408f496946c0fe2236c5a5718a7824a`，實檔相符。**原44／44 source pins、7／7 evidence pins全同**，無 mismatch。該 record 只採納 semantic precondition，executionAuthorization的browser lease、formal600、losslessCPU、nativeDSP、hardware、hearing均為false；本次沒有升格。

已唯讀 `formal-v4-final-focused-r1.tap`：611 tests／611 pass／0 fail／0 skipped，duration6255.2786ms。這是主代理既有八個 focused spec結果，不是本 reviewer 重跑，更不是原生600／OS CPU證據。原 lint-r1兩項錯誤保留；lint-r2空log與format-r1/r2也已pin。Parent回報最終 exit0；空log本身不另證process status。

| 最終來源 | SHA-256 |
|---|---|
| `tests/browser/performance-profile-v4.mjs` | `41e9daf7cc1bfbb64b61ab65681efe5210b7f36cc186aa9c2431a16733d0cd2f` |
| `tests/browser/performance-fixture-v4.mjs` | `543be0708bd11d3790fa27b5478bee559a960fd7dd68f63f1aac50197d5ae757` |
| `tests/browser/performance-profile-contract-v4.mjs` | `728eb07cb7c462071b00dec2586a850545511d6a8dc3e0c674b568dc30c5c602` |
| `tests/browser/run-performance-v4.mjs` | `263a0199743066f387ee0a6999ca4525754bef4ef4e7dbf7a0752e09dee51ec0` |
| `tests/browser/performance-cli-v4.mjs` | `2477100c7bef7d0fe5f5a6e4a853a9e99c1210292456ccba55dfd6f14332a146` |
| `tests/browser/performance-preview-listen-v4.mjs` | `6a000dea8df3c30af868073a26f55d40a8c1ea40f887469b3447534a1f542bb6` |
| `tests/browser/performance-process-cpu-v4.mjs` | `82abea440a8fa34206f7ab0ad474844f6f7e1856c95c9f33ec168ff7f13a587e` |
| `tests/browser/performance-process-times-v4.mjs` | `bf9404f8b80177249f2e9f5e57e7090a9e22950eef5ebf8ff7af42a91858ccd9` |
| `tests/browser/performance-process-times-v4.ps1` | `596679bd1aaccf9c6b839b9cead0ed4d83c3cde930b4e7c1e37d4ccf1e505784` |
| `tests/browser/performance-native-formal-v4.mjs` | `05f4c66ab31cde4446d1bb9ed5a2a06bd12464e2f5c266368366c5056823b10d` |
| `tests/browser/performance-approved-qualifications-v4.mjs` | `fe41541e07bb82e6c483899a534001d8ba8e7e1ce71907f3832037d87ea31aa5` |
| `tests/browser/performance-observation-summary-v4.mjs` | `53ede61ed3d6cb30027a18703af46ef507e69c81ac598cb23961418b46af6359` |

本次依 `codex-verification` 分層來源／既有收據／protected pins，另由隔離 reader核對TCP與CPU。僅新增本 MD／JSON；未改 production、spec、immutable44、approval、categories或shared memory，未啟動 Node、test、build、TCP probe、OS CPU helper、browser或benchmark。實際 pilot／正式量測仍須另排獨佔窗口並保留所有失敗。
