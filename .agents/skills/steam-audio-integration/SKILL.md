---
name: steam-audio-integration
description: 處理 Reflection Lab 的 Steam Audio C API、SDK 下載校驗、native build、授權、capability adapter 與隔離 smoke。
---

# Steam Audio 整合

## Trigger / Purpose

更新 SDK、使用 IPL API、調整 native backend 或重跑 smoke 時，維持版本、所有權與來源正確。

## Inputs

目標 OS/arch、SDK release、hash、compiler、所需 capabilities。

## Workflow

1. 讀 docs/03-sdk 四份文件與官方 pinned headers；確認 license／NOTICE／依賴分發需求。
2. 只由官方 release 取得，執行 download script 的 SHA256；cache 不入 Git。
3. 依 SDK_VALIDATION 的實際命令建立隔離 smoke；先 context，再 scene/material/simulator/source，commit 後求解。
4. 核對 outputs 的 units、bands、direct／reflections 旗標及 IR channel layout；最後逆序 release，檢查重初始化。
5. UI 只顯示 backend 提供的資料。不能由 reflections／pathing 名稱推定存在 individual specular path list。
6. WASM archive 與可部署 browser runtime 分開；未完成 linker／worker／audio adapter 不宣稱 web verified。

## References

`docs/03-sdk/SDK_LICENSE.md`、`SDK_VALIDATION.md`、`STEAM_AUDIO_RESEARCH.md`、`INTEGRATION_COMPARISON.md`；`experiments/sdk-smoke-tests/`。

## Outputs

release/hash manifest、可重跑 build、numeric outputs、capability/ownership mapping、授權限制。

## Validation

實際重跑 pinned SDK smoke 並檢查 exit code／結果；`npm run check` 不包含 native SDK build。

## Failure Handling

記完整下載／編譯／載入錯誤與環境；保留正常 cache 不以未驗檔案替代。無 native 支援時保留 Web fallback；不偽造 smoke PASS。
