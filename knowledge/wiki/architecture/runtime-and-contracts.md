---
id: RLAB-KB-0007
title: 執行架構與資料權威
type: architecture
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-11-02T09:45:40.484Z
sources:
  - RLAB-SRC-0055
  - RLAB-SRC-0057
  - RLAB-SRC-0056
  - SB-SRC-0009
  - SB-SRC-0016
  - SB-SRC-0001
  - V1-SRC-0004
  - V1-SRC-0001
  - V1-SRC-0007
  - V1-SRC-0060
  - V1-SRC-0015
  - AR-WIKI-bdabc250-7903063a
  - SB-ZONE-TYPES-20261102-V1
  - CORE-STAGE-06-20261102-V1
  - CG-DATA-CONTRACTS-20261102-V1
  - CG-ACOUSTIC-VALIDATION-20261102-V1
  - CG-EVIDENCE-LEDGER-20261102-V1
related_tasks:
  - RLAB-TASK-0016
  - RLAB-TASK-0021
  - RLAB-TASK-0028
  - RLAB-TASK-0029
  - RLAB-TASK-0030
related_decisions:
  - ADR-005
  - ADR-006
  - ADR-007
supersedes: []
tags:
  - P1
  - architecture
---





# Runtime、時鐘與資料權威

[Architecture](../../../docs/02-architecture/ARCHITECTURE.md)、[Data Contracts](../../../docs/02-architecture/DATA_CONTRACTS.md)、ADR-011／013／014維持設計權威。正式React／TypeScript／R3F／Three／Rapier Web主線已安裝並實作，精確版本見package-lock與[工具鏈](../../../docs/03-sdk/V1_WEB_TOOLCHAIN.md)，Steam Audio仍Optional。

Scene→validated atomic command→fixed physics→pose/contact snapshots→Sound rules/logical voices→acoustic worker→Web Audio／telemetry／recorder。SI、右手+Y/-Z、quaternion xyzw；renderer只插值，不反寫dynamic pose。physics60Hz、render、聲學、音訊與AI各自clock；bootstrap自動panel更新10Hz，關鍵命令立即發布，沒有改動domain fixed tick。

互動過載可丟wall time並記telemetry；錄製過載pause保留欠帳，Resume有限批次或Stop封存連續ticks。AudioContext在pause繼續走，fade／epoch／cursor處理logical arrivals；native onended不改寫deterministic behavior state。NoGravity切換保留運動與持續音相位。

有限一階box反射／直接／遮擋是數值近似，材質Synthetic；IR不虛構individual paths。Worker有取消、逾時、大小／容量上限與telemetry，[正式bundle測試](../../../docs/11-v1/ACOUSTIC_DELIVERY.md)只涵蓋service，不代表全產品10分鐘profile。

目前實作及分項證據見[進度](../../../docs/11-v1/SESSION_PROGRESS_20261027.md)。完整產品E2E／效能／裝置與聽測未完成，不以安裝或單元PASS代替。


已依package-lock及固定22ca產品bundle4／4結果核對React/R3F實際安裝與分項browser狀態；AGENTS舊「尚未安裝」為過期事實描述，保留[Conflict Record](../../conflicts/fcd68474-0f02-408f-a4dc-6513c3e04561.json)及Git e6b898c preimage，不改品質政策、不宣告整體第一版完成。另依使用者明確需求提供英文介面與完整可追溯文件譯本，繁中canonical與工作／測試資料仍共用。


最新固定產品22ca bundle已完成3次乾淨完整鏈＋獨立WAVrelink（4／4），同時保留0／2／7次明確overrun恢復；新雙語9ae2 bundle EN8＋原zh13通過。這是各自固定來源的功能／UI證據，不是長時間效能、聽測或整體第一版完成。A/B診斷路徑母體已修並獨立驗證；最新範圍與未完成項目以[checkpoint r2](../../../docs/11-v1/SESSION_PROGRESS_20261027-r2.md)為準，前段舊checkpoint待驗文字屬當時進度。


2026-10-28 使用者範圍修訂：目前以[驗收補充](../../../docs/11-v1/ACCEPTANCE_AMENDMENTS.md)為準，正常100%可用；原生200%真人門檻已移除。原凍結驗收與歷史測試保留。


## 2026-10-29 架構審查修訂

正式canonical已修正過期未實作敘述，見[Review](../../../docs/12-architecture-review/ARCHITECTURE_REVIEW.md)與[ADR-015](../../../docs/02-architecture/adr/015-client-first-and-render-contract.md)。普通live是acoustic worker，但physics accumulator由main RAF推進，record onTick仍同步solver；seal worker不是模擬時鐘。native Web Audio已實作，custom AudioWorklet沒有產品processor註冊路徑。

共用5秒propagation硬上限、預設2秒；超界早拒絕，六案邊界RED/GREEN。RenderBackend僅portable types-only seam，尚無take mix/stems/ADM renderer；無Scene/Project/Recording migration。研究branch及worktree、source與各研究限制見[研究導覽](../research/architecture-review-20261029.md)。本輪不以研究或型別檢查宣稱V1完成。


## 2026-11-02：有限核心與Zone擴充

本輪六core與[使用者後續擴充](../../../docs/15-ui-parameter-audit/AMENDMENT_UNSUPPORTED_OPTIONS_20261102.md)沿同一runtime/domain權威。Task0029新增optional Scene zones、zoneId身分、原子作者registry pin及真fixed-step body-center producer；位置連續的mode-change保真edge，作者teleport/registry變更baseline，衍生限制見[固定Zone來源](../../../docs/15-ui-parameter-audit/ZONE_IMPLEMENTATION_20261102.md)。不把region當Rapier collider/acoustic surface，marker不入持久hash；舊schema/types exactpreimage保留。

前段2026-10-29 types-only RenderBackend為當時研究截點：六core [Stage06](../../../docs/14-core-pipeline/stages/06-render.md)現已有同AudioEngine/真OfflineAudioContext短take mix/master/dry/stems，預設30秒/16outputs與其他顯式預算；不是ADM/長take/雲端或customWorklet完成。Curves尚未合入此d9截點，物理主時鐘仍main RAF，聲學/錄製/音訊各自clock。Zone真UI/WAV、全參數審核、正式性能/科學/裝置/Meta live/Main各自待證據，不採納全部PERF提案。


## Curves/動態反射正式來源接續（b4 candidate）

Curves7bb已正常mergea06，後續gizmo sourceb4；Root全程式check/最終UI仍進行。正式DataContracts／AcousticValidation／Ledger已用新source接續，舊exactGit原版存docs15/history，原研究/Task0021證據不回寫。新增解析sphere/capsule與真snapshot dynamicReflector、共同256budget，105objects例289項真FAIL後以exactOBB遮蔽物表示為124，未改fixture/cap。模型/政策pins與舊Replay/新重評相容性見[模型契約](../../../docs/15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md)，curvature focusing/fullwave等未建模不冒科學/性能PASS。
