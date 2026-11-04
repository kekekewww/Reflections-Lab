# Formal V4 stream 獨立來源審查

結論：**未發現 P1／P2，僅限來源與既有 artifact 審查。** 新分析器沒有把短 fixture 升格成正式 600 秒或 registry 通過；`ALGORITHM_ONLY`、`formal600Run:false`、`NOT_APPROVED` 在成功與失敗路徑都明確保留。

本次實讀 checkout HEAD：`dc4aaa49f3ac0773c45263f35007018654034f8f`，時間 `2026-11-03T00:58:15.0645134+00:00`。新 analyzer／spec 當時為未追蹤檔；此 HEAD 是 review 截點，不能冒作新的 benchmark sourceCommit。精確 source／artifact pins 見 [JSON](16-formal-v4-stream-source-review.json)。

## 來源審查結果

| 檢查 | 新 analyzer 行號 | 結果 |
|---|---|---|
| 原 parser、固定 caps、單 pass | L33–75 | 只呼叫一次原 `parseTraceStream`，傳原 256MiB gzip／2GiB decoded／8M events，parse timeout 固定 300000ms；未用 whole-file JSON.parse 代替。 |
| 全 raw 先驗再 filter | L35–47 | 每 raw 先驗 object、name≤512，再檢查原 2GiB heap；foreign／pruned rows 不能繞過。 |
| evidence retention 與共同預算 | L45–64 | 原 V3 set，加上所有 owner/name 的 B/E、所有 known posting-site events；同受原 512MiB serialized retained cap，沒有為 B/E 加額度。 |
| 原 named-task cap | L48、L76 | 所有原 task names 都保留。Frozen V4 先跑原 V3，原 2M `TASK_CANDIDATE_CAP` 不會被 typed B 分類抹掉。 |
| 原 boundary＋數值核心 | L76–79 | 原 `validateNativeBoundaryV4` 後接原 `formalNumericV3`，不重寫 spans、不加 epsilon／clock shift／rounding。 |
| 原 raw ordinal | L80–89 | 先驗 retained index 與 `source` 物件身分，再經保存的 raw index map；保留 `duration:null`／`numericIncluded:false`。 |
| full stream／view 分欄 | L96–114 | full raw count 取 parser stats；retained/input view 取 retained.length。938 raw named／937 typed 不混用。 |
| 數值完整性 | L117–129 | coverage 同時要求 native qualified 與原 numeric complete；原 V3 reject 另列，沒有冒成舊結果 PASS。 |
| 失敗證據 | L133–161 | 保留原錯誤字串；未知 full count 為 null，prefix count 另列；空 numeric、false coverage、marked duration null，不冒成零成本。 |

已另外核對原 V3／V4／stream／numeric 的實際程式：原 V3 L272–281 的 named-task ceiling 仍在 typed 排除之前；原 numeric L24–56 的完整 task 驗證、two-anchor binary64 mapping、union/intersection 與 50ms edge 不變。這不是僅依 wrapper 的自報欄位判斷。

Known-site wrong-owner 的 unknown-name `X` 保留但不新增拒收，是 frozen V4 的既有語義；只有其 B/E 會走該 boundary owner 拒收。新 wrapper／spec 沒有擴寫 frozen helper 的資格。

## 既有測試與來源身份

唯讀既有 TAP 可確認：

- RED：26 tests／25 pass／1 fail，缺少 export 的首項 assertion 失敗；guard 後的案例當時沒有執行語義 assertion，不能把其 ok 當成反例已驗證。
- GREEN：26 tests／26 pass／0 fail／0 skipped；TAP duration `1519.7442ms`。本 reviewer 沒有重跑，TAP 本身也不另證 process exit code 或 600 秒 workload。
- 既有 lint log 是空檔；Parent 回報 lint exit0，但空 log 本身不足以證明 exit。format log 只列兩個新檔案；本次未執行 formatter。

Spec 覆蓋 canonical raw/hash 與原 full-raw V3 reject、47 個原有效 X spans 的 Float64 bits reference、object/name 邊界、owned/unknown B/E、wrong-owner known site、window 外錯 task、原 gzip/CRC/duplicate-key errors、producer/executable/loss/close 拒收。另有 foreign B/E retained+2、pruned 前插後原 ordinal2378、known-site foreign X retained+1，沒有藉修改測試改成 PASS。

依 committed `semantic-v3-source-freeze-receipt.json` 逐項重新 hash：**原 27／27 與凍結 44／44 全相符**，mismatch 為空。本次未修改原 sources、raw、threshold、caps、registry 或 spec。

| 來源 | SHA-256 |
|---|---|
| `tests/browser/performance-native-formal-v4.mjs` | `05f4c66ab31cde4446d1bb9ed5a2a06bd12464e2f5c266368366c5056823b10d` |
| `tests/performance-v3/formal-v4-stream.spec.mjs` | `58cb77715c4f53262626554bcc8a9e05dccd416a312f7a36eaab643484f26e68` |
| `tests/browser/performance-native-v3.mjs` | `3d7810c63edc309df6b306debe6417ed13d73b6e899a7950043439b787421782` |
| `tests/browser/performance-native-boundary-v4.mjs` | `55ccd030a3650b78c197f29c68f671ab8d4f344dd43864fbf97bb0b4e439ad8d` |
| `tests/browser/performance-qualification-registry-v4.mjs` | `5517664d3e9437257488414584c3dc7140572797103b7611269a98f125adc48d` |
| `tests/browser/performance-stream-v3.mjs` | `064b3071d350f9bc3dc4f39682a21c1f1e19f68fd3929a9c147551a149abeaab` |
| `tests/browser/performance-numeric-formal-v3.mjs` | `93e4005ab4fc93c110a7f39d8e5272434f5f6b92500ab98e9f0e4a96588913e4` |

## 未執行與後續有限測試缺口

目前程式已正確處理，下列為後續可安排真正 RED 的非阻擋測試缺口；本次不改 spec：

1. retained prefix 後才遇 malformed raw：直接驗 full count 仍 null、prefix count 另列、numeric 空與 coverage false，避免日後把 partial prefix 當 full stream。
2. 先由獨立原 oracle 建立 native candidate／numeric incomplete 的 fixture，驗 wrapper 不把 native qualified 當 numeric complete；原 50ms edge 不改。
3. 短 fixture 未壓到 256MiB gzip、2GiB decoded/heap、8M events、2M named tasks、512MiB retained 或 300000ms parse 壓力。這些 guard 已碼審，不能冒成壓力實測。

300000ms 是 parser budget，不是整個 synchronous native/numeric 分析的 end-to-end watchdog。Heap guard 也是階段／逐事件取樣，不能證明連續 allocation peak。後續 launcher 應保留自己的 watchdog 與 machine lease lifecycle；這不是本 helper 新增的完成主張。

本次依 `codex-verification` 做 source／artifact／protected-pin 分層，另由隔離 reviewer 交叉檢查。依明確任務限制，沒有啟動 Node、test、typecheck、build、browser 或 benchmark；僅新增本 MD／JSON。正式資格仍 **NOT_APPROVED**。
