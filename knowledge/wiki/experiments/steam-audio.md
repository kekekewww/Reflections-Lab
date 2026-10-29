---
id: "RLAB-KB-0013"
title: "Steam Audio可行性與能力"
type: "experiment"
status: "VERIFIED"
created_at: "2026-10-25T19:46:51.310610+00:00"
updated_at: "2026-10-25T19:46:51.310610+00:00"
sources: ["RLAB-SRC-0012", "RLAB-SRC-0013", "RLAB-SRC-0014", "RLAB-SRC-0015", "RLAB-SRC-0016"]
related_tasks: ["RLAB-TASK-0002"]
related_decisions: ["ADR-005"]
supersedes: []
tags: ["P1", "Steam", "SDK", "IR", "paths"]
---

# Steam Audio 4.8.1：原生smoke已驗

[SDK_VALIDATION](../../../docs/03-sdk/SDK_VALIDATION.md)記Windows x64/GCC15.2的三cycle context/scene/material/source/direct/occlusion/transmission/parametric/convolution/release；原始結果與[最終確認](../../../experiments/sdk-smoke-tests/results/native-win64-confirmation-2026-10-26.json)固定保存，sha256與設定可追溯。

2m attenuation=.5、clear/blocked occlusion=1/0、transmission符合synthetic輸入；convolution有限非零。這只證明目前平台最小流程，不是聲學精度、leak-free、multi-source/P95或device測試。隨機反射兩輪輸出不同，不能宣稱bit-exact。

公開simulator無個別specular point/path ID清單；pathing callback是probe segments。4.8.1確有WASM靜態archive，但沒有emcc/browser/worklet link結果。預設400/2500/15000Hz與canonical octave不等價；adapter要記轉換與定義。

主線仍Web有限ISM、native Steam為可逆候選，詳[架構](../architecture/runtime-and-contracts.md)。SDK更新必先下載校驗／授權／smoke，再更新Source版本、任務、ADR/風險與此綜合頁，不能只堆新報告。
