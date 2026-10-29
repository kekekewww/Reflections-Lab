# Codex 能力、額度與接手邊界

查核日期：2026-10-26（台北）。本頁區分本機 CLI help、官方文件與實際模型執行；沒有啟動獨立 Codex 模型程序、修改認證、購買額度或使用 reset。

## 本機證據

在 `D:\Developing\Meta Hack` 執行下列命令，全部 exit 0：

```powershell
codex --version
codex --help
codex exec --help
codex exec resume --help
codex resume --help
```

版本為 **codex-cli 0.163.0**。各次命令另有 Windows 私有 `arg0-windows` 暫存清理／PATH alias 建立的 access-denied warning；help 可讀，但不能推論新的推論程序、sandbox 啟動或 session 寫入成功。本次沒有升權或更改私人目錄。

| 功能 | 0.163.0 help 的確認範圍 | 實際模型驗證 |
| --- | --- | --- |
| 非互動執行 | `codex exec [OPTIONS] [PROMPT]`；無 prompt 或使用 `-` 時讀 stdin | NOT RUN |
| 指定工作區 | `-C, --cd <DIR>`；新任務可選 `--worktree` | NOT RUN；現有 repo 無 HEAD，不能假設已建立 worktree |
| 權限 | `--sandbox read-only\|workspace-write\|danger-full-access`、`--approve-for-me` | NOT RUN；不採 full access／bypass 作為預設 |
| 結構化事件 | `--json` 輸出 JSONL；`--output-schema <FILE>`；`-o, --output-last-message <FILE>` | help 確認，未取得 live JSONL |
| Session | `codex exec resume [SESSION_ID] [PROMPT]`、`--last`、`--all`；互動 `codex resume` | NOT RUN；不任意使用 `--last` 接入未知 session |
| 暫存 session | `--ephemeral` | help 確認；持久 handoff 不使用此選項掩蓋紀錄 |
| 設定 | `--ignore-user-config`、`--ignore-rules` 存在 | 非預設；不能藉此繞過本專案與使用者政策 |
| Goal | help 沒有獨立 `goal` 子命令；官方文件記載互動 `/goal` | 文件確認；本次未透過 TUI 新建／清除 Goal |

官方 [非互動文件](https://developers.openai.com/codex/noninteractive) 說明 `exec` 預設 read-only、可指定 workspace-write；`--full-auto` 已不支援。`--json` 事件包含 `thread.started`、`turn.started/completed/failed`、`item.*`、`error`。這些是官方格式的文件證據，並非本次模型執行紀錄。最終 schema 合法或 exit 0 仍不證明實作符合驗收。

## 本專案的 Codex fallback

目前採用**現有 Codex Orchestrator 進入 Implementation Mode**。Runner 保存同一個 Task／Milestone／goal reference、checkpoint、部分修改與原始驗收條件後，讓目前的 Codex 繼續工作；不嘗試呼叫正在執行中的自身 session，也不啟動遞迴代理。實際 runner 命令以 [Orchestration](CODEX_MUSE_ORCHESTRATION.md) 與 CLI help 為準。

未來若啟用獨立 CLI adapter，必須先以隔離工作區驗證程序啟動、實際有效權限、JSONL schema、明確 session ID、取消／子程序停止、session export、額度與資源限制，再新增可用能力。官方 [CLI reference](https://developers.openai.com/codex/cli/reference) 能證明命令存在，不能替代本機 execution proof。新 session 的 worktree 與 resume 的相容組合亦須依安裝版本重新查核。

Codex 同時編排與實作時，不能以自身報告通過驗收。必須執行事前固定的 acceptance commands／reference fixtures，檢查驗收檔案 hash 未變，保留獨立 subprocess 的實際 stdout、stderr、exit code；必要時再加隔離 review agent、browser／physics／audio E2E。缺少的獨立驗證應列 NOT RUN 或 BLOCKED。

## Goal 與恢復

官方 [Using Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex) 記載 Goals 自 0.128.0 起提供，屬於 **thread 持久狀態**，不是 Git 或專案全域記憶。安全續行只在 thread idle、無待處理工作／使用者輸入且預算允許時發生。

`/goal` 可查看／設定目標；`/goal pause`、`/goal resume`、`/goal clear` 是使用者控制介面。Harness 的 `goal_id`／objective reference 只串接既有目標，不能宣稱以 JSON 欄位建立或恢復了 Codex 原生 Goal，也不能在 executor 切換時建立另一個 `/goal`。本機版本符合文件所述版本下限，但這不是 TUI 功能的 live test。

每個 Goal 應限一個 Milestone，包含結果、驗證面、允許工具、限制、資源預算、有限 repair 與 blocked 條件。目標未達但預算已用盡時保存進度並停止，不能標完成；executor 改變也不重設已驗證 criteria。

## Codex 額度觀測

2026-10-26 約 23:21 台北，透過桌面 app 的 read-only `get_usage_limits` 取得一次實際 snapshot：

| 欄位 | 本次觀測 | 解讀 |
| --- | --- | --- |
| `ordinaryUsageAllowed` | `true` | 當時允許一般使用；非未來執行保證 |
| limit ID | `codex` | 使用 `rateLimitsByLimitId.codex` 的帳號共享觀測 |
| window duration | 10080 分鐘 | 7 天視窗 |
| used percent | 3% | 已使用，不是剩餘 |
| remaining percent | 97% | `clamp(100 - usedPercent, 0, 100)` |
| reset | Unix `1793599696` | 2026-11-02 14:08:16 台北 |
| secondary window | `null` | 未提供，不能寫成 0% 使用或 100% 可用 |

帳號 ID、reset credit IDs 與帳務明細不存入本專案。工具也回傳 credit 欄位，但本次沒有核實該 balance 的金額單位／可用方式，因此不換算成美元或推論 token 容量。snapshot 是時間限定的觀測，不是固定 task resource budget；CLI 不自動呼叫桌面工具，需由 Orchestrator 提供新觀測。

不能把 Codex 使用限制、OpenAI API billing、Muse subscription 或 Meta Model API quota 混為一談。Codex 若實際回報不可用、資源預算不足或權限拒絕，保存 handoff 並 BLOCKED；不購買、reset、提高上限、切換未授權帳號或關閉保護。權限／認證錯誤不標記 Muse 額度耗盡。任何未知剩餘額度維持 `null`／UNKNOWN。

## 權限與來源

[Auto-review 官方說明](https://learn.chatgpt.com/docs/sandboxing/auto-review) 明示：自動審查僅更換邊界請求的審查者，不增加 filesystem／network 權限；`approval_policy=never` 沒有互動批准請求可供審查。Harness 不把「無人介入」當作已獲得 full access。既有 sandbox／managed requirements 永遠優先。

| 原始來源 | 版本／日期 | 本次證據層級 |
| --- | --- | --- |
| 本機 `codex` 五個版本／help 命令 | 0.163.0，2026-10-26 | LOCAL HELP VERIFIED；模型執行 NOT RUN |
| [Goals cookbook](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex) | 2026-10-26 讀取實際頁文；未提供 immutable release | DOC REVIEWED |
| [Non-interactive mode](https://developers.openai.com/codex/noninteractive) | 同日實際讀取 | DOC REVIEWED |
| [CLI reference](https://developers.openai.com/codex/cli/reference) | 同日實際讀取；頁面現行內容 | DOC REVIEWED |
| [Built-in commands](https://learn.chatgpt.com/docs/developer-commands#built-in-slash-commands) | 同日實際讀取 | DOC REVIEWED |
| [Auto-review](https://learn.chatgpt.com/docs/sandboxing/auto-review) | 同日實際讀取 | DOC REVIEWED |
| 桌面 `get_usage_limits` | 單次 snapshot，欄位語義依工具契約 | LIVE READ-ONLY OBSERVATION；非推論 test |

沒有將官方全文重散布為資料集，也沒有由搜尋摘要直接推定 CLI 語法。官方文件為可變頁面，後續 CLI 升版或部署前須重查；本頁不能作為付費上限或模型權限的授權。
