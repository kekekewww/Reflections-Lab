---
name: experiment-validation
description: 處理 Reflection Lab 實驗錄製、snapshot、motion replay、A/B 條件、結果 provenance 與可重現性驗證。
---

# 實驗驗證

## Trigger / Purpose

錄製／重播、capture 或 A/B comparison 變更時，確認比較的是相同輸入條件。

## Inputs

experiment manifests、scene/material/trace hashes、solver/physics versions、metric method 與 desired comparison。

## Workflow

1. 讀 docs/07-experiments，區分 motion playback、pinned resimulation、fresh physics run。
2. 核對 scene／asset hashes、tick order、body IDs、pose與contact trace、sample rate、geometry與quality。
3. 只改 acoustic parameters 時重用相同運動；改 mass/friction/restitution 必須重跑，標明多因素。
4. results 附 Measured/Computed/Estimated、units、方法、有效性與 artifact ID；AI explanation 不作數值來源。
5. RT decay不足、noise floor、未支援 metrics 明示 unavailable，不以 0 代替。
6. capture 最後原子提交 manifest；失敗／取消不標 Captured。

## References

`docs/07-experiments/`、`schemas/experiment.schema.json`、`docs/06-validation/`、`docs/08-ai/AI_EXPERIMENT_AGENT.md`。

## Outputs

可重播 artifact、A/B match report、誤差、validation level 與缺失條件。

## Validation

`npm run validate:schemas`；完整 recorder 另驗 pause/seek/cancel/roundtrip，不把數學測試當端到端錄放。

## Failure Handling

hash／tick／版本不符就拒絕 matched comparison；保留診斷並可另開 unmatched fresh run，不悄悄修正資料。
