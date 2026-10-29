# Muse 模型研究與採用邊界

查核日：2026-10-26（Asia/Taipei）。狀態：`DOC_REVIEWED`；模型推論、帳戶 catalog、延遲、使用量與費用實測皆 `NOT RUN`。本頁補充既有 [Meta 模型研究](../08-ai/META_MODEL_RESEARCH.md)，不取代其資料權利與上線閘門。來源與取得限制保存在 [metadata](../../research/agents/model-source-metadata.json)。

## 環境必須分開

| 環境 | 用途、識別與限制 |
| --- | --- |
| Meta Model API | 產品內 AI Experiment Agent 的候選服務；`https://api.meta.ai/v1`。只能由 server 持有 key；公開型號不等於帳戶已啟用。 |
| Muse Code CLI | 開發執行者，具有自己的 sandbox、session、訂閱或按量計費規則。使用 Muse 寫程式不構成產品 Meta API 整合證據。 |
| 開放權重自架 | 自備硬體、runtime、chat template、tool parser、服務安全與維運；不能直接套用 Meta API 的價格、參數或帳戶額度。 |
| 第三方代管 | provider 自定 model alias、服務能力、資料條款、價格與 quota；本次未驗，也沒有授權自動切換。 |

以上服務邊界依 [Overview](https://dev.meta.ai/docs/overview) 與 [Models](https://dev.meta.ai/docs/models)；官方模型列表可用 `GET /v1/models` 查團隊目錄，本次沒有呼叫。

## 型號與工作負載

表內「支援」僅代表官方文件，不代表本專案已完成 contract test。`null` 代表未公布或未驗，不能用零替代。

| 模型／識別 | Context、輸入 → 輸出 | Tools／結構化輸出／推理控制 | 可用環境、候選工作與不支援項目 |
| --- | --- | --- | --- |
| Muse Spark：`muse-spark-1.3`；保留 `1.2`、`1.1` | 1,048,576 tokens；文字、圖片、影片、音訊、PDF → 文字 | API function tools、structured output；1.3 有 minimal/low/medium/high/xhigh/max；Contributor 1.3 無 max | Meta API；CLI 不含 1.1。候選：小型修正、分類、參數規劃、短工具迴圈。不能產生量測證據或直接執行 host function。 |
| Muse Wonder：`muse-wonder-1.0` | 1,048,576；同 Spark → 文字 | 同 API tools／structured；minimal 至 max | API（preview）、Muse Code；候選：跨檔案改動、困難除錯與複雜規劃。`max` 不會選到 Wonder Full；南韓目前不可用。 |
| Muse Wonder Full：API ID `null` | API 規格 `null` | CLI 訂閱能力；API 參數不適用 | Power／Maximum Usage 的 Muse Code；不是 Meta API 型號，不能虛構可呼叫 ID。 |
| Muse Spark Open：`meta-models/Muse-Spark-Open-816B-A42B`（checkpoint 識別，非 Meta API ID） | 1,048,576；文字、圖、音、影 → 文字 | 自架需正確 reasoning/tool parser；OpenAI-style tools；structured-output 約束依 runtime 另驗。reasoning_effort 僅 low/medium/high/xhigh | 自架或 provider，非 Meta API。816B 總參數／42B active；適合未來大型自架評估，MVP 暫不採用。不能把托管 API 的 max/none 或費率套過來。 |
| Muse Glimmer：`meta-models/Muse-Glimmer-30B` | 預設128K，可延伸但上限 `null`；文字、圖片 → 文字 | template 支援 ATEM tools；strict structured decoding 依 runtime；reasoning_strength low/medium/high/xhigh | 30B dense 開放權重、自架；候選小型本地分類、草擬與路由。不是 Meta API 模型，沒有代管 API SLA 或免硬體成本承諾。 |
| Muse Image：`muse-image-1.0` | token context `null`；文字、圖片 → 圖片 | Responses／images endpoints；不是 Spark 的一般 function-tool 實作 loop；圖片專用控制另見來源 | 可評估未來材質視覺稿或參考資產；不是 3D 幾何重建、可碰撞 mesh 或實測材質吸收係數產生器。 |
| SAM 3.1：`sam-3.1` | token context `null`；文字提示、圖片、影片 → boxes/masks | segmentation geometry；不是通用聊天、coding 或推理模型 | 可評估場景物件區域標記；影像遮罩不直接提供世界尺寸、材質聲學量測、3D mesh 或個別聲線。 |

Spark／Wonder 的版本、媒體與可用性以 [Models](https://dev.meta.ai/docs/models) 為準；推理值、`none`／`logprobs` 不支援與 reasoning token 計費見 [Reasoning](https://dev.meta.ai/docs/reasoning)。Open 的控制與 checkpoint 識別見 [Open prompting](https://dev.meta.ai/docs/muse-spark-open/prompting)，Glimmer 的 template／ATEM 見 [Glimmer prompting](https://dev.meta.ai/docs/muse-glimmer/prompting)。圖片與分割能力見 [Image generation](https://dev.meta.ai/docs/image-generation)、[Media segmentation](https://dev.meta.ai/docs/media-segmentation)。

API tools 由 host 執行；Responses 使用 flat tool definitions 與 function_call_output，Chat Completions 使用 nested function definitions 與 tool messages。不能混用請求形狀，串流參數完成且本地驗證後才可執行。[Tool calling](https://dev.meta.ai/docs/tool-calling)

Strict schemas 須 object root、每個 object 的 additionalProperties:false、所有 properties 列入 required，不能用 oneOf/allOf；上限包括深度10、總properties5,000，recursive refs 不接受。這只約束形狀；domain ID、單位、scene revision、capability 和 budget 仍由 host 驗證。[Structured output](https://dev.meta.ai/docs/structured-output)

## 成本、速率與延遲

公開價格為查核日 USD；帳戶實際費率／credits／剩餘額度均 `null`。Rate limit 是 team/model 的速率窗口，不能拿來推算可用現金或 Muse 訂閱剩餘 prompts。

| Meta API 型號 | 每百萬 tokens：input／cached input／output | 公開 RPM／TPM | 本專案 latency／成本實測 |
| --- | --- | --- | --- |
| Spark Standard（1.3／1.2／1.1） | 1.25／0.15／4.25 | 3,000／4,000,000 | null／null |
| Spark Contributor（1.3／1.2） | 0.10／0.002／0.20 | 150／3,000,000 | null／null；未採用 |
| Wonder Standard | 4.00／0.20／20.00 | 3,000／4,000,000 | null／null |
| Image | $0.01／成功圖片 | 150／無TPM | null／null |
| SAM 3.1 | $2.50／千張；$0.20／千影片frames；影片最低計50frames | 3,000／無TPM | null／null |
| Open／Glimmer | 非 Meta API 價格；GPU／provider／運維成本另計 | runtime／provider 決定 | null／null |

價格與速率數值來自 [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits)。更高推理量可能增加輸出 token、初始延遲與費用；本次未作型號速度排序。[Reasoning](https://dev.meta.ai/docs/reasoning)

## 自架與資料條款

Open BF16 權重約1.65TB、NVFP4約537GB，執行還需 KV cache 等額外記憶體；官方列 BF16 約2TB VRAM 預算。它使用 Muse Model License 與 AUP，不是 Apache。這些是官方部署指引，本機未下載或 benchmark。[Spark Open overview](https://dev.meta.ai/docs/muse-spark-open)

Glimmer30B 權重採 Apache2.0；量化、延伸context、硬體足夠性與效能仍須單獨驗證。本次沒有下載 checkpoint 或啟動 local server。[Glimmer overview](https://dev.meta.ai/docs/muse-glimmer)

Standard Content 不用於訓練 Meta Models；Contributor／Discounted Content 可用於訓練及改善。這不等於沒有保存或安全審查。不得為降低費用自行開 Contributor，也不能用模型產生的文字證明第三方素材權利。[Data Commitments](https://dev.meta.ai/legal/commitments)

## 採用決策與下一次驗證

Reflection Lab 目前保留 Spark Standard 作為低成本 runtime 候選；Wonder 僅為高難度規劃／開發候選，必須有明確預算。這是依工作負載作出的工程推論，沒有宣稱實測勝出。Image、SAM、Open、Glimmer 不增加 MVP 強制依賴；未授權 provider 不進自動 fallback。

Development Executor quota 與 Product Runtime API quota 各自保存狀態。Muse 不可用可切 Codex 開發；Meta runtime 不可用只切離線 fixtures／recorded tools，live Meta 測試保留 BLOCKED／NOT RUN。解除順序為帳戶catalog → 付費／資料模式確認 → 最小tools與strict-output contract tests → 固定prompt多次評測 → 延遲與usage實測。所有 live gate 本次 `NOT RUN`；錯誤分類與 quota 偵測另見 [Quota research](QUOTA_RESEARCH.md)。
