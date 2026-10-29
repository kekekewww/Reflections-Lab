---
name: muse-prompt-optimization
description: 評估 Reflection Lab Muse coding 或產品 runtime 提示詞，以固定 fixtures 比較策略、記錄可觀察指標與實測限制；不將離線流程測試當模型表現。
---

# Muse 提示詞評估

## Trigger / Inputs

需要選擇 task prompt、縮減 context、比較修復策略或更新模型模板。輸入工作負載、模型／CLI版本、資料環境、固定 acceptance、策略及費用／時間上限。

## Workflow

1. 先讀 docs/09-agents/MUSE_PROMPT_ENGINEERING.md、MODEL_ROUTING.md 與對應官方來源；區分 Muse CLI、Meta Model API、開放權重／第三方平台。不跨環境複製 reasoning、context 或 model ID。
2. 以 benchmarks/muse/evaluation-config.json 的四類 fixture 比較 Direct 與 Structured；固定 acceptance、輸入及允許修改。需要時只加與缺陷相關的 context，不預設長 prompt 較好。
3. 先執行 `node --test benchmarks/muse/evaluate.test.mjs` 與 `node benchmarks/muse/evaluate.mjs` 驗證離線評測器。此步只驗固定 reference 與壞案例，沒有呼叫模型。
4. Live evaluation 另需已確認模型存取、資料模式與明確預算；保留每次 run、prompt／fixture hashes、model／CLI、實際測試、repair、額外檔案修改與 usage。未知 cost／tokens／latency 不填0。

## Completion / Validation

只描述可觀察的成功率、測試、修復、延遲、usage 與限制；保留失敗樣本。多策略的 fixture 檢查通過不能證明某策略較優；LIVE EVAL NOT RUN 不能轉成 model comparison。

## Failure Handling

無 key／quota／權限時完成離線 fixtures 與說明，live metrics 保留 null。不得增加付費上限、換帳號、修改驗收或挑掉失敗 run 製造結果。
