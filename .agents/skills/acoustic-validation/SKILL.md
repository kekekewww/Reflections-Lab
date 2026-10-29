---
name: acoustic-validation
description: 驗證 Reflection Lab 幾何聲學、頻帶能量、傳播、RIR 與數值 benchmark；用於公式與求解器變更。
---

# 聲學驗證

## Trigger / Purpose

修改 solver／公式／分析指標時，建立有參考與容忍度的解析或獨立比較。

## Inputs

模型版本、units、fixture、Claim ID、預期結果、容忍度與欲宣稱層級 V0–V5。

## Workflow

1. 讀 docs/06-validation 與相關 theory；確認 amplitude／energy／dB、absolute／relative delay。
2. 用獨立解析答案驗證 direct、有限 polygon 反射、bounds／visibility、energy conservation。
3. 每 fixture 記 Input、Units、Expected、Reference、Tolerance、Reproduction。
4. 驗證 NaN／越界／退化幾何、stale geometry、path birth/death；不要只測 happy path。
5. RT 指標先檢查 RIR 衰減區間與 noise floor，無足夠資料回 insufficient，不補假的 RT60。
6. 跑相關測試與實測 benchmark，記硬體、版本、樣本數與結果。target 與 measured 分開。

## References

`docs/06-validation/ACOUSTIC_VALIDATION.md`、`BENCHMARK_PLAN.md`、`benchmarks/fixtures/`、`research/theory/`。

## Outputs

可重跑 fixtures、機器可讀結果、驗證層級、誤差與未測範圍。

## Validation

`npm test`、`npm run benchmark`、`npm run validate:research`。數學 kernel PASS 不等於 audio graph／真實房間 PASS。

## Failure Handling

保留失敗輸入與原誤差，不只放寬 tolerance。模型不適用時記限制並選較簡模型；未跑 V3/V5 明確 NOT RUN。
