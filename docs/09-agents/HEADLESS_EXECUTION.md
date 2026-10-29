# Muse Headless、Session 與 SDK 查核

查核日：2026-10-26（Asia/Taipei）。本機 **Muse Code 1.4.13（1.4.13-R6996.1），Windows x64**；版本與 help、離線 schema 匯出、真實 CLI echo process 已執行。Meta 模型實作／額度耗盡／付費推論 **NOT RUN**。證據：[本機觀察](../../research/agents/muse-cli-observation.json)、[原始 echo JSONL](../../research/agents/muse-cli-probe/echo.stdout.jsonl)。

## 實際命令介面

`muse.cmd` launcher 會檢查更新，初次 help 因安裝目錄 timestamp 寫入權限而失敗；沒有提升權限或更新軟體。讀取 launcher 後，使用其支援的 `MUSE_NO_AUTO_UPDATE=1`，版本與 help 成功。這是每個 process 的環境設定，不會改帳號、billing 或永久 settings。

```powershell
$env:MUSE_NO_AUTO_UPDATE = '1'
muse --version
muse exec --help
muse usage --help
muse schema generate-json-schema --out .cache/phase3/muse-schema
```

已安裝 help 支援下列參數；完整原文在 [exec help](../../research/agents/muse-cli-probe/exec-help.txt)。不能因其他版本文件相同就略過版本檢查。

| 類別 | 已查核的參數與約束 |
| --- | --- |
| 輸入／輸出 | `exec --prompt-file <PATH> --json`；stdout 為 JSONL，不將 prompt 放 shell command text。 |
| Workspace | `--workspace <PATH>`；`--trust-workspace` 僅本次載入 repo rules／skills。未信任的 repo 不載入 AGENTS。 |
| 模型 | `--provider echo\|meta`、`--model <ID>`、`--contributor-mode off`；不自動切第三方模型或 Contributor。 |
| 推理／步數 | `--reasoning-effort none\|minimal\|low\|medium\|high\|xhigh\|max\|ultra`、`--max-model-steps <N>`；CLI 接受值不等於每個模型都提供該 tier。 |
| 安全 | `--disable-approval` 保留 sandbox；`--sandbox-network restricted`、`--disable-web-tools`；禁止預設 yolo／disable-sandbox。 |
| 自動化 | `--disable-reminders`、`--disable-request-user-input`、`--no-foreign-personal-context` 可限制額外工作與個人 context。 |
| Session | `--session-id <UUID>`；拒絕 workspace mismatch，Harness 不使用 `--allow-workspace-switch` 自動越過。 |

官方 headless 契約指定 exit 0＝turn 完成、1＝失敗／取消（含步數上限）、2＝usage error、130／143＝訊號停止；**0 不等於 acceptance tests 通過**。Wrapper 還需檢查終結事件、scope diff 與獨立測試。[Extending and automating](https://dev.meta.ai/docs/muse-code/extending)

## 已執行的離線 CLI proof

在 repo ignored cache 的獨立目錄，以 echo provider、禁止 shell／寫入、無 retained session 執行安全 prompt。結果 exit 0、15 個 JSONL envelopes、`run.terminal.completed`，stopwatch 為 **2283.1611 ms**。這是 process wall time，不是模型延遲；echo 使用 synthetic timestamps，不用事件時間推算效能。獨立 Node 解析檢查版本、終結事件與 usage，workspace 只有既有 prompt 檔。

事件 envelope 為 snake_case，`schema_version:1`、`payload_schema_version:1`、`payload_type`、`payload`。觀察到的重點：

- `run.lifecycle.started`、`run.output.delta`、`run.terminal.completed`；終結 payload 的 `terminal` 為 `completed`。
- `run.usage` 的 stream 是 `exec.usage`，自己的 sequence 從 1 開始；不能把它當 session 全域遞增序號。
- echo 的 model 為 null、tokens 為 0、allowance 為 null。保留 unknown，不能偽稱 Meta 模型、已知餘額或訂閱仍可用。

這項 proof 沒有要求或允許修改程式，未信任 workspace，且使用 `--no-session-log`。因此 **真實模型 code edit、repo skill 自動載入、OS sandbox 寫入隔離、retained resume／export 都未由這個 proof 驗證**。Harness 的 mock process edit／repair 測試另列，不能混寫成 Muse live implementation。

另已實際執行唯讀 `muse skills list --source project --workspace <repo> --trust-workspace --json`：exit0，發現23個 project skills，包含本階段新增5個；它們各自 diagnostics 為空。唯一 catalog 診斷是 `.claude` 薄 wrapper 的相同 persistent-project-memory ID 被較高優先來源遮蔽，原 canonical skill 仍可見。此為每次信任的 catalog discovery，沒有更動永久 trust、啟動模型或證明模型曾呼叫 skill。[Discovery proof](../../research/agents/muse-project-skill-discovery-proof.json)

## 事件、恢復與來源

`muse export --session <UUID> --out <PATH> --redacted` 的 help 已查核；它讀本地 retained log，不呼叫模型。預設 export 是 raw，可能含工具輸出與敏感內容；Harness 優先自己的遮罩 session log，完整 export 保留在 ignored 私有 cache 並審查後再索引。不將 reasoning blobs、認證或逐字私人聊天放入 Wiki。

正常任務保留 Session ID；需要續跑時，依原 Task、checkpoint、diff、剩餘 acceptance criteria 建立續行 prompt，再使用 `exec --session-id`。不能以 resume 表示 Git 或工作檔自動復原，更不能重送已完成的 side effect。當 session 格式／workspace 不符時保留錯誤並交給 Codex handoff。`--no-session-log` 會失去 retained recovery；本次只為離線 transport probe 使用。[Working with the agent](https://dev.meta.ai/docs/muse-code/interactive)

## CLI Wrapper 與 Session SDK

| 選項 | 本次狀態與判斷 |
| --- | --- |
| CLI Wrapper | 已查本機 args 並跑 echo；是本階段主要 process adapter。外層 Task Run State、鎖、驗證、retry／repair 決策由 Codex Harness 管理。 |
| `muse serve`＋`@muse-code/sdk` | 官方 SDK 存在、可管握手、turn、取消、approval、resume；本機 serve help／stable schema 已查，未安裝 SDK／啟動推論 Session。 |
| Muse Workflows | 官網明示依 build／rollout；Windows session messaging 不支援。未驗的 Workflow 不加入總控，也不以內部多代理取代 Harness ownership。 |

SDK 官網為 Developer Preview，當次頁面 commit `bb094db81ac9b1299ddef7d56190816797d71d24`，顯示 schema fingerprint `4f369140…95a835`；**與本機 stable export 不同**。本機 fingerprint 為 `7fddaf64…730e5b`，schema bytes SHA256 為 `59c3c649418af35b54d4c64153210b2c77f8e0be2e47bf595a0ad33194530894`。兩者不可當成同一契約。[SDK overview](https://meta-models.github.io/muse-code-sdk/next/)、[Quickstart](https://meta-models.github.io/muse-code-sdk/next/guides/quickstart/)

MSP schema 與 `exec --json` envelope 是不同介面。前者的 `TurnError.quota` 可提供 typed quota stop，但不能假設任意 exec 的文字 reason 都具有同樣結構。Adapter 必須針對已支持的版本與真實 event fixture 明確解析；未知 schema／缺 terminal／截斷輸出應拒絕成功，不靜默遺失事件。

## Sandbox 邊界與待驗

官網說明 sandbox 保護 filesystem／network，Windows 首次可出現 UAC。保留 sandbox 的 noninteractive run 使用 disable-approval；這不授權停用 sandbox。project rules／skills 只在信任後載入，repo `.git`／`.muse`／`.agents` 為受保護位置；最小權限失敗應保留並回報，不自動放寬。[Permissions and safety](https://dev.meta.ai/docs/muse-code/permissions)、[Configuration](https://dev.meta.ai/docs/muse-code/configuration)

下一次有授權非零推論預算與有效帳號時，先在 isolated checkout 執行單檔 fixture，再由固定 verifier 檢查檔案內容／diff／sandbox／取消／retained resume。`muse usage --json` 本次只得到 transient refresh error，並未得到 allowance；相關政策見 [Quota research](QUOTA_RESEARCH.md)。
