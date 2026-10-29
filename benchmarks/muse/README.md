# Muse Prompt 評測基礎

這是離線、可信任的手寫 fixture 驗證器。沒有呼叫 Muse 或 Meta API，也沒有量測任何模型的品質、延遲、token 或費用。

```powershell
node --test benchmarks/muse/evaluate.test.mjs
node benchmarks/muse/evaluate.mjs
```

第二個命令會建立獨立時間戳的 `results/offline-*.json`，以 exclusive create 保留舊紀錄。結果包含實際 prompt、bytes/hash、原始碼 hash、逐項測試與負向控制。`model_metrics` 未觀察值皆為 `null`，LIVE EVAL 為 NOT RUN。重跑 fixture 成功不能證明 Strategy A 或 B 較佳。

| Fixture | 解析／獨立驗收 | 限制 |
| --- | --- | --- |
| TypeScript component | 正常、loading、disabled、字串 escaping | 純 TypeScript HTML 字串元件，不是 React、DOM、無障礙或 browser E2E 驗證 |
| Physics impulse | 質量乘速度差、3-4-5 有限 impulse、無效參數 | 契約數學，不是 Rapier solver／grab／collision runtime |
| Acoustic floor reflection | image source 地板交點、路徑長度、延遲、無效幾何 | 二維解析 fixture，不是正式聲學核心、RIR 或聽覺測試 |
| Bug fix smoothing | 原有插值、上下界 regression、非有限輸入 | 隔離函式，不是 AudioWorklet 連續性驗證 |

每類具 A（直接指令）與 B（結構化 scope／constraints／acceptance）兩種 prompt。`fixtures.mjs` 內的正確範例與故意錯誤範例都由人為規格直接寫成；`acceptance.mjs` 以獨立常數／解析值判斷，不使用受測函式產生期望值。

Strategy B 是評測用的 prompt 規格，並不是可直接交給 `schemas/agents/task.schema.json` 或 Harness CLI 的執行合約。這些 controls 也不是正式產品演算法；數值中間結果超出 JavaScript 可表示範圍時明確拋出 `numeric range exceeded`，不宣稱能為所有有限輸入產生有限解。

驗證器使用既有 TypeScript 的 `transpileModule`；轉譯診斷不是完整 typecheck。`node:vm` 只方便執行這些固定可信任 controls，**不是安全 sandbox**。CLI 不接收外部程式碼或模型輸出；未受信任模型程式應經 Development Harness 的隔離 executor、檔案範圍與 acceptance protection 驗證。

正式模型比較前，應固定原始 task／驗收 hash、model ID／CLI version、context、reasoning profile、budget 與隨機性條件，再由 Harness 執行相同變體。保留原始 log 與修復次數，沒有 usage 欄位時不可估造 token 或費用。模型呼叫預算仍為 0；此目錄不建立帳號、不切換帳號、不調高付費上限。
