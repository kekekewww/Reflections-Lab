# Agent Prompt Templates

開發與產品runtime使用不同工具、狀態與資源預算。開發templates由凍結Task Contract與run state渲染，產品templates由trusted host另外提供受限scene／tool／evidence context。文字規則不能代替Harness的scope／lock／acceptance與產品host的domain／policy驗證。

| Template                  | 使用時機                                   |
| ------------------------- | ------------------------------------------ |
| muse/implementation       | 一般功能與多檔案實作。                     |
| muse/bugfix               | 可重現缺陷與regression。                   |
| muse/ui-implementation    | 遵循canonical design system的UI實作。      |
| muse/acoustic-solver      | 聲學幾何／能量／傳播與數值驗證。           |
| muse/physics-interaction  | Rapier／FPS／Grab／Build互動。             |
| muse/repair               | 外部驗證失敗後的有限修復。                 |
| muse/handoff              | 安全停止後保存剩餘工作與來源。             |
| muse/codex-fallback       | Codex接手同一Task剩餘實作。                |
| runtime/scene-planner     | 產品內scene staging／preview提案。         |
| runtime/experiment-agent  | 產品內run／capture／analyze／compare實驗。 |
| runtime/acoustic-analysis | 引用真實metric artifacts解讀結果。         |

`render.mjs`匯出同步`renderTemplate(name, values)`及固定`TEMPLATE_NAMES`。name只能使用上表列出的11個值，不能傳任意path。四種JSON參數為`TASK_CONTRACT_JSON`、`RUN_STATE_JSON`、`REPAIR_TASK_JSON`、`HANDOFF_JSON`；傳物件或已序列化JSON object，模板需要的參數缺失即失敗。每個輸入上限256KiB，不執行資料中的token／指令。

```javascript
import { renderTemplate } from "./prompts/render.mjs";
const prompt = renderTemplate("muse/implementation", {
  TASK_CONTRACT_JSON: contract,
});
```

這是呼叫介面，`contract`需來自已驗證的實際Task；不是可直接執行的完整任務。可重現測試：

```powershell
node --test prompts/render.test.mjs
node --test benchmarks/muse/evaluate.test.mjs
node benchmarks/muse/evaluate.mjs
```

最後一項只執行固定可信任fixtures，沒有modelcalls。模型prompt品質與live integration仍需獨立執行與明確預算，不能由模板或fixture通過推論。
