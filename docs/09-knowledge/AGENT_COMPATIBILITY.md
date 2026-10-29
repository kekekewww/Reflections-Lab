# 跨 Agent 相容性與驗證邊界

查核：2026-10-26（台北）。共同長期記憶以 Git、Markdown 與 JSON 保存；各產品的 session／auto memory 不是本專案的權威來源。共同入口是 [AGENTS.md](../../AGENTS.md)、[Wiki Schema](../../knowledge/schema.md) 與 [知識索引](../../knowledge/wiki/index.md)。

## 身分與本機觀察

| 工具             | 實際執行結果                                                        | 本次範圍                                                                       |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| OpenAI Codex CLI | `codex --version` → `codex-cli 0.163.0`；`codex --help` 可讀        | 版本／help／官方文件；本次 Codex 協作工具有實際分工，但不是另啟 CLI 的載入測試 |
| Claude Code      | `claude --version` → `2.1.308 (Claude Code)`；`claude --help` 可讀  | 版本／help／官方文件；登入、模型請求、skill 載入及跨 session 接手 **NOT RUN**  |
| Pi coding agent  | `pi --version` → `0.85.1`；本機包 `@earendil-works/pi-coding-agent` | 版本與本機文件；互動 session／模型請求／接手 **NOT RUN**                       |
| qmd              | `Get-Command qmd` 未找到                                            | 未安裝、未下載模型、未啟動 MCP；見 [搜尋評估](SEARCH_ENGINE_EVALUATION.md)     |

Pi 指 Mario Zechner 的 coding-agent，歷史 URL [badlogic/pi-mono](https://github.com/badlogic/pi-mono) 現轉址至 [earendil-works/pi](https://github.com/earendil-works/pi)。本機 `v0.85.1` 固定 commit `d981de1229ef899957bbe968bc8dcda02a21f477`；官方該版本 README、package.json、extensions.md 的 SHA256 與本機檔案相同。[固定版本](https://github.com/earendil-works/pi/tree/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent) 查核時 [main package snapshot](https://github.com/earendil-works/pi/blob/d5b3de22d0e24a3e9c38a9410d3329b099717283/packages/coding-agent/package.json) 為 `1.4.0`（`SRC-PI-MAIN-PACKAGE-20261026`），不可把 main 能力直接算到本機版本。

Pi 0.85.1 的 [package](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/package.json) 要求 Node ≥22.19.0；本機 Pi launcher 使用獨立的 `pi-node/current/node.exe`，實測 `v22.23.2`。專案根 Node 固定 `22.17.0`，本次未變更；不要直接以專案 Node 啟動不符合版本下限的 Pi package。

## 官方支援與共用接法

下表是文件能力，並非三個產品的端到端實測。OpenAI／Anthropic 文件未提供固定版本號，來源以取得日及 SHA256 固定；Pi 使用上述版本。

| 面向                 | Codex                                                                         | Claude Code                                                                              | Pi 0.85.1                                                                   |
| -------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Project instructions | 由 repo root 到 cwd 讀 `AGENTS.md`，同層 override 優先；有總大小限制 [C1]     | 新版可直接讀 `AGENTS.md`，但有 `CLAUDE.md` 時預設改讀後者；本庫以 `@AGENTS.md` 匯入 [A1] | 從 cwd／祖先讀 `AGENTS.md` 或 `CLAUDE.md`；同層 override 優先 [P1]          |
| Skills               | 原生發現 `.agents/skills`；需要時讀全文 [C2]                                  | 官方 project 位置為 `.claude/skills`；本庫只有一個薄入口，轉讀共同 Skill [A2]            | 原生支援 `.agents/skills`；可用 `/skill:name` 明示載入 [P2]                 |
| Session hooks        | 文件有 `SessionStart`、`Stop`、`SessionEnd` 等；project hooks 涉及 trust [C3] | 文件有 `SessionStart`、`SessionEnd`、tool 等事件，設定和事件語意另有規則 [A3]            | TypeScript extensions 可監聽 `session_start`、`session_shutdown` 等 [P3]    |
| Tool invocation      | shell／檔案工具與 MCP；以實際授權為準 [C4]                                    | 內建工具、MCP 與 CLI print 模式；以 session 授權為準 [A2/A4]                             | 預設檔案／shell 工具；extension 可 `registerTool()`；MCP 需額外整合 [P1/P3] |
| Workspace            | cwd／Git repo；文件有 managed worktrees [C4]                                  | cwd／Git repo；CLI `--worktree`、subagent `isolation: worktree` [A4]                     | cwd、`.pi` resources、一般 Git worktree；沒有宣稱內建 managed worktree [P1] |
| Subagents            | 官方支援委派與等待；平台／設定影響實際可用性 [C5]                             | 官方支援 built-in／custom subagents [A4]                                                 | 核心不內建 subagents；可由 extension／獨立 Pi process 補充 [P1]             |
| Handoff              | resume／fork／app 等產品功能只延續其 session；跨產品用本庫 handoff [C4]       | resume／continue 延續其 session；跨產品用本庫 handoff [A4]                               | JSONL session、continue／resume／fork／export；跨產品用本庫 handoff [P1]    |

本次沒有新增 `.codex/hooks.json`、`.claude/settings.json` 或 `.pi/extensions`，沒有更動使用者設定。Hook 是可研究的產品機制，不能保證 crash／強制結束時保存成功，也不代表已具備本專案的自動記憶。

## 最薄入口與啟動順序

- Codex：使用根 `AGENTS.md` 與 `.agents/skills/persistent-project-memory/SKILL.md`。
- Claude Code：[CLAUDE.md](../../CLAUDE.md) 以官方 `@AGENTS.md` 語法匯入；[Skill 入口](../../.claude/skills/persistent-project-memory/SKILL.md) 只轉讀同一共同 Skill。不使用 symlink，不複製八套領域技能樹。需要領域規範時依根入口明示讀 `.agents/skills/<name>/SKILL.md`。
- Pi：直接使用既有根 `AGENTS.md` 與 `.agents/skills`，因此不建立多餘的 `.pi/AGENTS.md`。
- 其他 Agent：從相同檔案啟動，以其 shell／file tool 呼叫共同 CLI。工具若不會自動發現入口，手動讀取即可；不宣稱自動載入。

每個新 session 依序讀根 `AGENTS.md` → `knowledge/schema.md` 與 `wiki/index.md` → `wiki/now.md` → 任務與 dependencies → 最近相關 handoff → 任務頁與原始證據；再用 Git 與實際檔案核實。只讀任務需要的細節。任務 claim／並行更新／衝突處理遵循共同 Schema，Agent 的私人任務清單不提供跨 process 獨占權。

## 技能結構驗證與呼叫政策

本次實測分開記錄：**10 個專案自有技能通過本機官方 `quick_validate.py`**；**8 個上游技能以固定 manifest 驗證，16 個原始檔 SHA256 全部一致**。不能將這兩種結果合稱「18 個技能皆通過官方 frontmatter 驗證」。官方快速檢查器 hash 為 `6068513d924ed3559e186dfcdead7439129828dcf402167fd925c06dffbf2806`；它只做檔案／格式等靜態檢查，不驗模型執行行為。

上游 `pick-ui-library/SKILL.md` 的 `disable-model-invocation: true` 會被該檢查器以未知欄位拒絕；原始檔仍保持與上游相同的 bytes。預設驗證只對 manifest 明列的上游技能採原檔 hash 檢查，其他專案技能仍走官方結構驗證。上游清單與固定 hash 見 [Emil manifest](../../third_party/emil-skills.manifest.json)。

Codex 官方文件可確認的明示呼叫政策是 `agents/openai.yaml` 的 `policy.allow_implicit_invocation: false`，沒有將 `disable-model-invocation` frontmatter 列為 Codex 的政策契約。本庫另加 [薄政策檔](../../.agents/skills/pick-ui-library/agents/openai.yaml) 對應上游既有的 explicit-only 意圖，不修改或刪除上游欄位。依文件，這會停用 Codex 隱式選擇，仍保留 `$pick-ui-library` 明示呼叫。[官方 invocation policy](https://learn.chatgpt.com/docs/build-skills#optional-metadata)

本次只驗 YAML 內容與原檔 hash，模型 runtime 選擇 **NOT RUN**；檢查器拒絕未知欄位，不足以證明 Codex loader 會拒絕整個技能。此政策檔是本專案的 Codex adapter，不是上游檔案，也不是 Claude Code／Pi 的設定。

## 無 Hook 的共同工作流程

從 repo root 執行：

```powershell
npm run wiki -- status --format json
npm run wiki -- query "目前阻擋正式音訊驗證的限制" --format markdown
npm run wiki -- lint
```

重要工作完成後，使用共同 Skill 準備 `checkpoint`／`handoff` 所需資料，先 `--help` 查實際參數，必要時 `--dry-run`，再執行；更新任務、相關知識及 `now.md`。`ingest` 的整合方案需要 Agent 審讀來源與提出明確計畫；CLI 不以文字生成自動判真。完整命令以 [知識入口](../../knowledge/README.md) 與 CLI help 為準。

接手者應重跑與任務有關的命令，核對結果、Git revision／branch／worktree 與未提交修改。測試 fixture 模擬一個 Agent 依 handoff 恢復，只證明檔案協定可驗證；不能寫成 Claude Code／Pi live session 已成功。

## 錯誤與下一次驗證

`codex --version` 曾警告無法清理／建立使用者暫存 PATH aliases，但仍回傳版本。`pi --help` 在讀 help 前嘗試建立 `C:\Users\kevin\.pi\agent\trust.json.lock`，被 sandbox 以 `EPERM` 拒絕；未升權、未重設 trust，未繼續啟動 Pi。版本與文件查核不依賴此鎖。若日後要做 Pi live 驗證，先在使用者允許的 session 確認 trust 狀態，再測入口與手動 handoff；不需改本庫共同資料格式。

下一個相容性 spike 應在隔離 fixture repo，分別啟動三種工具，記錄實際載入的入口／skill、相同問題的來源定位、一次 checkpoint→新 session handoff 與中斷復原；有明確模型預算後才執行。這些本次均 **NOT RUN**。

## 來源定位

- C1 `SRC-CODEX-AGENTS-20261026`：[AGENTS.md 官方文件](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。
- C2 `SRC-CODEX-SKILLS-20261026`：[Skills 官方文件](https://learn.chatgpt.com/docs/build-skills)。
- C3 `SRC-CODEX-HOOKS-20261026`：[Hooks 官方文件](https://learn.chatgpt.com/docs/hooks)。
- C4 `SRC-CODEX-COMMANDS-20261026`：[Developer commands](https://learn.chatgpt.com/docs/developer-commands)。
- C5 `SRC-CODEX-SUBAGENTS-20261026`：[Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)。
- A1 `SRC-CLAUDE-MEMORY-20261026`：[Project memory／AGENTS.md](https://code.claude.com/docs/en/memory)。
- A2 `SRC-CLAUDE-SKILLS-20261026`：[Skills](https://code.claude.com/docs/en/skills)。
- A3 `SRC-CLAUDE-HOOKS-20261026`：[Hooks](https://code.claude.com/docs/en/hooks)。
- A4 `SRC-CLAUDE-SUBAGENTS-20261026`：[Subagents／worktree](https://code.claude.com/docs/en/sub-agents)；本機 `claude --help` 補核 continue／resume／worktree flags。
- P1 `SRC-PI-INSTALLED-README-V0-85-1`：[Pi README 固定版本](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/README.md)。
- P2 `SRC-PI-INSTALLED-SKILLS-V0-85-1`：[Pi Skills 固定版本](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/skills.md)。
- P3 `SRC-PI-INSTALLED-EXTENSIONS-V0-85-1`：[Pi Extensions 固定版本](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/extensions.md)。

取得時間、SHA256、授權與儲存策略登錄 [Source Manifest](../../knowledge/sources/manifest.json)。官方文件能力的查核不等於帳號、模型、費用、權限或自動化已驗證。
