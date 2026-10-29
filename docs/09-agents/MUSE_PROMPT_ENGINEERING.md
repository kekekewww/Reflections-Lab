# Muse Prompt Engineering 與評測方式

查核：2026-10-26（Asia/Taipei）。以下將「官方文件所述」、「本專案的工程假設」與「已觀察評測」分開。沒有 Meta 模型推論資料，因此不能宣稱 Structured Task Contract 比短 prompt 普遍更好。模型欄位見 [Model research](MUSE_MODEL_RESEARCH.md)，本機 CLI 見 [Headless](HEADLESS_EXECUTION.md)。

## Coding Agent：由可驗收成果開始

本專案採用的設計是：Role／Objective → 精確 Scope → 必須遵守的 constraints → Acceptance Criteria → 最少相關檔案 → 可用工具與資源預算 → failure recovery → completion report。Task Contract 是唯一接受條件來源，prompt 不得重新定義較寬鬆條件。這是適合可恢復開發的工程選擇，不是模型 benchmark 結論。

| 任務 | Prompt 與 context 選擇 | 完成證據 |
| --- | --- | --- |
| 小型 TypeScript／bug fix | 短 objective＋指定檔案／失敗案例；省略無關研究全文。 | 固定 regression test、scope diff、未驗限制。 |
| 多檔案實作／refactor | Structured Task Contract；明示對外介面、file ownership、不可改的驗收與模組邊界。 | 原測試＋需要的 integration；既有行為保留證據。 |
| React／Three UI | 指向 canonical Design System／tokens／Component／Motion；React/R3F 依有效 ADR，不讓 agent自行改架構。 | 靜態與 browser／input／perf 各列；靜態通過不等於畫面通過。 |
| Rapier／FPS | 固定步、穩定 IDs、四種 body mode、contact-solving grab、有限 impulse；按任務載入 physics skill。 | deterministic fixture＋WASM／browser 需要時另驗。 |
| Acoustic math／DSP | SI、energy／pressure、bands、model label、path identity、clock／delay；引用指定 claim／fixture。 | reference implementation／tolerance／數學 benchmark，不以 agent prose 取代數值。 |
| Repair | 保留原 task ID／criteria／budget，提供確切 command、exit、預期／實際差異、最小失敗摘錄。 | 原 gate 重跑；失敗進下一個有界 repair 或 BLOCKED。 |

通用模板在 [prompts/muse](../../prompts/muse/implementation.md)。禁止用「完成後自行確認即可」替代獨立 runner；也不能讓完成報告自報 PASS 就寫 COMPLETED。Codex fallback 仍讀相同 constraints／skills，僅改 executor 與來源。

## Prompt 長度、examples 與 session

簡單、明確、有固定 verifier 的短工作可用 Direct Instruction。跨檔案、科學約束或中途接手時，優先 Task Contract；只加入直接支撐決策的文件與少數 examples。Few-shot 應展示難懂的輸出契約／錯誤處理，不能塞入整份聊天或要求公開私人推理。context 多不一定提升品質，需實際評測。

SDK／CLI 只提供模型與推理控制，不替代外層工作分解、權限、步數、timeout 和 verify。CLI 的 reasoning-effort enum 大於單一模型可用值；依 model profile／API 文件查核後才選。Subagents 適合有獨立 scope 的工作；官方說明未要求隔離時可共享 checkout，所以 Harness 不把 compatibility flag 當成所有子代理自動隔離。[Configuration](https://dev.meta.ai/docs/muse-code/configuration)、[Extending](https://dev.meta.ai/docs/muse-code/extending)

每次 session resume 先讀 checkpoint／diff／remaining work；不重做 completed criterion。不讓 compact summary 覆蓋可追溯的 task／Git／原始測試。Muse `/goal` 是 Muse session 狀態；跨 executor 保存原 objective 與 reference，不假稱 Codex 可以直接操作目前活躍的自身 session。[Working with the agent](https://dev.meta.ai/docs/muse-code/interactive)

## Product Runtime：typed tools 與停止條件

產品 prompt 只提出場景／實驗候選，host 執行工具。計畫與實測結果分開；數值附 run ID／artifact，沒有工具結果就保留 unknown。模型只可呼叫 registry 內工具；schema 後還要驗 revision／domain IDs／SI／capabilities／budget，使用 preview → apply → undo，不允許 eval 任意程式。

Chat Completions 的 tool 定義與 tool message、Responses 的 function_call／function_call_output 不能混用。必須保留原 assistant tool-call message 和對應 call ID；串流 arguments 完成前不執行。官方 cookbook 展示「先接收 native tool call，再由應用程式執行並回傳」；模型宣稱工具跑過不是證據。[Tool/function cookbook](https://dev.meta.ai/docs/cookbook/tool-function-calling)

Structured output 的 schema 約束形狀，不能證明量測真實或數學正確。Runtime schema 要轉為 provider 支持的 subset，缺欄位、拒絕、截斷、timeout 都走顯式錯誤，不修飾成合法成功 JSON。[Structured-output cookbook](https://dev.meta.ai/docs/cookbook/structured-output)

原則上將穩定 instructions／tool schema／少量 examples 放前面，變動 scene context 放後面，以利 prefix cache。Responses／Chat 的 cached_tokens 欄位位置不同；只有實際 usage 才可計 cache hit，不以 prompt 相同保證命中。官方提供 optional prompt_cache_key；本次未呼叫、未驗 latency／節費。[Prompt caching](https://dev.meta.ai/docs/prompt-caching)

## 開放權重不是代管 API 的參數別名

Muse Spark Open 的官方 prompting guide 建議先放高優先 invariant、明確 scope／decision procedure／tools／output／停止條件。它使用 self-host／provider chat template，tools 由 template 加入；不必在 system prose 重複完整工具定義。Open 的 reasoning_effort 只有 low／medium／high／xhigh，不能關閉；system 裡數字 Reasoning strength 可覆蓋它。這些專屬設定不能直接套進 Muse Code 或 Meta API。[Spark Open prompting](https://dev.meta.ai/docs/muse-spark-open/prompting)

Agent frameworks 文件展示可經不同協定接 Meta API，但其中 SDK 範例的 permissive settings 不是 Reflection Lab 安全預設。使用 Codex agent 搭 Meta 模型也不等於獨立 OpenAI verifier；記錄實際 provider／model／工具與驗證權威。[Agent frameworks](https://dev.meta.ai/docs/agent-frameworks)

## 四類、兩策略的可重現評測

隔離 fixture 包含 TypeScript component、Rapier interaction、geometry/acoustic math、bugfix/regression；每類比較 Direct Instruction（A）與 Structured Task Contract（B）。fixtures／runner／結果位於 [benchmarks/muse](../../benchmarks/muse/README.md)。實際命令為 `node --test benchmarks/muse/evaluate.test.mjs` 與 `node benchmarks/muse/evaluate.mjs`。離線 fixture 能證明 harness、reference tests、metric collection 的行為，不能比較 Muse 生成程式的成功率。

Live eval 待有授權帳號與預算：固定 model／CLI／prompt hash／task fixture／acceptance hash；每策略重複多次，交錯執行以降低時段因素；相同 retry／repair 上限；事先定義成功與異常檔案。失敗樣本也保留，不能只挑通過的 run。

| 指標 | 觀察方式與 unknown 規則 |
| --- | --- |
| Task success／test pass | 固定 verifier 的結果；完成 turn 不算 task success。 |
| Repair rounds | 真實 repair attempt count，不能把 retry 當 code repair。 |
| Unexpected modifications | baseline／after manifest 比對 task scope，保留 diff。 |
| Hallucinated APIs | 型別／runtime errors＋人工來源檢查；無人工審查記 null。 |
| Latency／tool calls | process wall time、已解析 events；echo 只算 transport。 |
| Tokens／cost | provider usage＋固定費率或帳戶實際費用；缺資料 null，估值標 ESTIMATED。 |
| Human intervention／quality | 有定義的事件與 rubric；不能自動從 exit0推定高品質。 |

目前 **LIVE EVAL NOT RUN**。未做模型成功率／平均延遲／實際成本比較；沒有已證實的最優 prompt。後續將結果依型號、版本、任務與條件回寫本指南，避免把單一小樣本提升為一般規律。
