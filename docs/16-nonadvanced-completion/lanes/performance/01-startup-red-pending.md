# PERF001／014：啟動與待執行 RED（2026-11-03）

本lane工作樹：`D:/Developing/Meta Hack/.worktrees/nonadvanced-20261103/baseline`；實際HEAD：`e25f9f48302fd357b0f97a6f9bf8565f5916627c`。本頁是既有PERF001／014的stage報告，不取代task JSON。shared knowledge／source／task由唯一memory writer更新。

已依序讀AGENTS、knowledge/schema、index、now、最新handoff、PERF001／014、有效ADR011／013／014、AUDIO_RUNTIME、正式PERFORMANCE_BUDGET、BROWSER_PERFORMANCE與本輪唯讀integration CONTRACT／plan；套用spatial-audio-dsp、experiment-validation及RED→GREEN／systematic-debugging技能。

## 固定範圍與既有證據

- 原V3正式負載：all、600秒UI wall window、physics3000、acoustic600；不降低sources／paths／geometry／captures，也不將18000frames或bytes cap當600秒continuous capture。
- 原V3 launcher SHA `480f275b63d1ea39113cbc8344ac395578acc25b432bd39af5fbc77005179aca`、producer revision `d0c02bfad08ec92a6ffcf989e53cd995e6381a4c` 的拒絕保持原樣。新browser若需資格，須另存版本與真semantic evidence，不能只換pin。
- R17原600秒FAIL和2026-11-01研究600.4152秒／trace flush timeout保留。late onset、snapshot拒收、voice/path drops、PCM gap、native output underrun和聽感不是同一指標。
- e25已含`src/audio/diagnostics.ts`及`AudioEngine.getDiagnostics/setDiagnosticsEnabled`。其128-slot ring、500ms native poll與unsupported/reset/null語義可重用；現有fixture只存getTelemetry，未保留完整diagnostics。
- `performance-fixture-v3.mjs`的`consumerMs + (lastDeliveryHandlerMs ?? 0)`會將未知handler當零，總成本必須保留null。
- 現有fixture的RAF proof、method wrappers、PerformanceObserver和CDP始終啟用；只關engine diagnostics不足以稱probe-free。

## 新增回歸（尚未執行）

| 檔案 | 要驗證的行為 | 結果 |
| --- | --- | --- |
| `tests/performance-v3/attribution-fixture.spec.mjs` | 執行實際acoustic collector；未知handler→總成本null；量得0有效；保存bounded diagnostics且unsupported native/PCM不冒0 | NOT_RUN，等待Root單工小測資源lease |
| `tests/performance-v3/probe-free-fixture.spec.mjs` | off保留native RAF/cancel identities、無proof callbacks/marks；預設on仍收proof | NOT_RUN，等待Root單工小測資源lease |
| `tests/performance-v3/fixture-adapter.mjs` | 僅在test host注入明示probeMode；不啟動browser或模擬產品結論 | 已寫，NOT_RUN |

目前未修改產品／正式collector／門檻；未執行任何test／typecheck／build／browser／benchmark。Root原baseline fullsuite持有機器lease。下一步先觀察正確RED，再最小實作；正式長測與probe-free配對必須另取得Root exclusive machine lease。
