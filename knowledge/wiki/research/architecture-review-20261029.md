---
id: RLAB-KB-ARCH-20261029
title: 獨立Worktree架構研究與公開限制
type: research
status: ACCEPTED
created_at: 2026-10-29T05:31:18.021Z
sources:
  - AR-WIKI-981198a4-f08948c0
  - AR-WIKI-125b3918-c3a1be71
  - AR-WIKI-dea44f78-bec1b55c
  - AR-WIKI-f9973a3a-53c8d8e3
  - AR-WIKI-88d5b03e-7f7ab891
  - AR-WIKI-0097af4e-8da89aae
  - AR-WIKI-e7af9a20-7c939ee8
  - AR-WIKI-b90513da-8aff3bb4
  - AR-WIKI-fb19a0d8-6b2bfded
  - AR-WIKI-0d96796e-bbccf9af
  - AR-WIKI-08319a06-9674a471
  - AR-WIKI-f25fc431-c23ef3ae
  - AR-WIKI-6c4d133b-04ac869d
  - AR-WIKI-d50811ca-91824af9
  - AR-WIKI-98905769-032532ff
  - AR-WIKI-bdabc250-7903063a
  - AR-WIKI-4f2425f3-a8651622
  - AR-WIKI-d8aecf34-64259750
  - AR-WIKI-ddb4c501-f0e33962
  - AR-WIKI-5d96334e-efc3d154
  - AR-WIKI-f39cfc33-51592610
  - AR-WIKI-01d079a3-47a3bd24
  - AR-WIKI-c31b3b4c-889a5952
  - AR-WIKI-a17fbf44-461e799f
  - AR-WIKI-ac23610d-3601bfa7
  - AR-WIKI-bf84b91b-c2bb01b0
  - AR-WIKI-07d8c475-5b7944dd
  - AR-WIKI-f6019c37-4ce9a17b
  - AR-WIKI-9d9104ff-1c529406
  - AR-WIKI-e9d1ce0d-91713aba
  - AR-WIKI-ca2bde0e-2ffea48d
  - AR-WIKI-9d8e358d-f8510ce3
  - AR-WIKI-813b1e09-5bf634aa
  - AR-WIKI-91bdbb7f-01edad26
  - AR-WIKI-bbf12465-0851ec62
  - AR-WIKI-9d8e358d-56e210d3
  - AR-WIKI-0d96796e-4a1f35bd
  - AR-WIKI-08319a06-bd3fc6a2
  - AR-WIKI-f25fc431-defa17e4
  - AR-WIKI-bdabc250-57b654be
  - AR-WIKI-c707f934-321be10d
  - AR-WIKI-84a8e80c-77c7b483
  - AR-POSTMERGE-9acff2894b15
  - V1-USER-TEST-20261029-R18
  - PUBLIC-LINKS-c1b420a1efe7da81
  - AR-PUBLIC-VALIDATION-7b2bc593a36d
related_tasks:
  - RLAB-TASK-0021
related_decisions:
  - ADR-015
supersedes: []
tags:
  - P1
  - architecture
  - worktree
updated_at: 2026-10-29T15:03:28.850Z
---

# 獨立 Worktree 架構研究與整合

[正式審查](../../../docs/12-architecture-review/ARCHITECTURE_REVIEW.md)、[Gap](../../../docs/12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md)及[ADR-015](../../../docs/02-architecture/adr/015-client-first-and-render-contract.md)保留各領域來源/近似/未實作範圍。Category A/B僅共享5秒propagation上限（預設2秒）、types-only RenderBackend、狀態與工具/CI對齊，沒有Scene/Project/Recording migration、產品UI像素改動或新付費呼叫。native Web Audio已實作，custom AudioWorklet/完整renderer/stems/ADM未實作。

研究b10b78a已安全no-ff合併39f6c2b；原工作區full check與當前功能UI28/linked8/product4/physics2/storage5 PASS。真實scope與哈希見[合併收據](../../../artifacts/architecture-review-20261029/merge-commit.json)、[品質](../../../artifacts/architecture-review-20261029/post-merge/quality-receipts.json)、[browser](../../../artifacts/architecture-review-20261029/post-merge/browser-receipts.json)。既有FAIL/中斷均保留；這不是長時間性能或真人/聽測通過。

原區新增[R18](../../../docs/11-v1/USER_TEST_FEEDBACK_20261029-r18.json)已保留：FPS無法操作是使用者回報失敗，下游FPS操作受阻；材質/反射未測、音量/直接操作有問題，實測bundle/device未知。後續先診斷輸入阻斷，再續record熱路徑/性能；本輪不擴成產品修復。

九情境cloud估計不是容量或支出承諾。原history包含超大/禁止產物，不能push；使用者已授權保留全部本地history、另建乾淨公開snapshot。公開exactmanifest、完整scan、fresh副本驗證及remote/CI仍是真gate；未做不算PASS。唯一任務[0021](../../tasks/RLAB-TASK-0021.json)，實際狀態見[integration-state](../../../docs/12-architecture-review/integration-state.json)。完整V1未完成。


## 乾淨公開副本已實跑驗證

由14da匯出，公開root commit a2e38d0無原始祖先；fresh npm ci/check及47功能browser與解析benchmark通過，見[收據](../../../artifacts/architecture-review-20261029/public-validation/receipts.json)。四份歷史小型收據連結按真正副本/hash修復；原完整產物仍僅本地。最後exact payload/完整reachable scan/push/remote CI仍未完成，不能以本段當成公開成功或完整V1完成。
