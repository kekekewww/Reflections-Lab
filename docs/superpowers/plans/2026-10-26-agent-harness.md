# Development Harness 與自動接手實作計畫

> **For agentic workers:** 依分檔所有權逐項實作與審查；採測試導向及獨立審查。使用者已明確要求直接執行，不另設計批准關卡。

**Goal:** 在既有權限與預算內，保存任務／Milestone／Goal／Git 修改，讓 Muse 故障時由 Codex 接手，並通過原驗收才繼續。

**Architecture:** Wiki task JSON 保持唯一工作權威；Task Contract 固定驗收，Run State 記錄細部 executor 狀態。控制目錄與隔離工作區分離，持有單一 workspace writer；獨立子程序執行驗收，輸出具 hash 的證據。產品 Meta API 與開發代理的資源分開。

**Tech Stack:** 現有 Node 22.17.0 ESM、AJV、Node test runner、Git、已安裝 Muse／Codex CLI；不增加套件。

**Spec:** [Phase3 原始需求](../../00-project/PHASE3_REQUEST.md) 與本次使用者 Automatic Agent Failover 要求（最新優先）。

## Global Constraints

- 不開始正式產品功能；保留 Phase1／2 原始證據與 Steam Audio 研究。
- 金額預算預設 0，不增加付款上限、不換帳號、不讀取／保存 secret。
- 不能將 429、401、403、402 與明確額度耗盡混為一談。
- 驗收固定，實作者不能改測試製造通過；缺獨立驗證要明示。
- 不 push／部署／接受條款；無 HEAD 必須記 null，不捏造 commit。
- 正式文件繁體中文；paths、API 與 code 英文。

## Review Focus

- 子程序未證明停止時不得解鎖／切換 executor，避免背景 writer 重疊。
- 未識別的 CLI 事件／錯誤不能靜默視為成功或額度耗盡。
- Git 無 HEAD、untracked、partial edits 必須保留內容及 hash，不只 git diff。
- 驗收腳本或 contract 被修改時拒絕驗證，不採用較弱的新測試。
- 重複 resume、過期 checkpoint、跨 workspace session 必須拒絕或冪等，不重做已通過工作。

## Task 1 — 官方能力、錯誤與架構對齊

**Files:** `docs/09-agents/*RESEARCH.md`、`HEADLESS_EXECUTION.md`、`CODEX_CAPABILITIES.md`、`research/agents/`；root 維護 `docs/02-architecture/`。

- [x] 讀官方原文與實際版本/help；核實 CLI／usage／subscription／API 分層。
- [x] 固定來源 metadata 與本機無付費 smoke 證據，未知值留 null／NOT RUN。
- [x] 新 ADR 保留舊決策與 supersession；明示新專案、Web custom core、R3F 方向與開發／產品分離。

## Task 2 — 可執行 Harness

**Files:** `scripts/agents/`、`schemas/agents/`、`examples/agents/`、`tests/agents/`。

**Interfaces:** `node scripts/agents/cli.mjs help`；Task Contract 以 `wiki_task_id`、`goal_id`、`milestone_id` 關聯，不建立第二套任務。

- [x] 先建立與執行失敗測試：12 種 failover 情境、原驗收固定、process timeout、互斥與 resume。
- [x] 實作 detector/router/resources、checkpoint／handoff、Muse adapter、current-Codex adapter、獨立 verify／repair／事件。
- [x] 執行原測試與隔離 CLI demo；測試記錄標 Mock Runner，實際 Muse echo 標 CLI offline。

## Task 3 — Prompts、Runtime 與離線評測

**Files:** `prompts/`、`benchmarks/muse/`、`docs/08-ai/PHASE3_RUNTIME_AGENT.md`、5 個新 project skills。

- [x] 7 類 coding／3 類 runtime templates，固定驗收、領域資料權威與 fallback provenance。
- [x] 4 類任務 × 2 策略的可執行 fixture benchmark；模型品質／token／成本未知留 null，LIVE EVAL NOT RUN。
- [x] 引用既有 tool schema，不實作正式 runtime；Meta 額度耗盡仍可跑標示的 mock。

## Task 4 — 既有入口與共享持久狀態

**Files:** `AGENTS.md`、`README.md`、`package.json`、`schemas/wiki-task.schema.json`、`scripts/wiki/core.mjs`、`tests/wiki/`、`knowledge/`。

- [x] 先用失敗測試確認 task update 可安全保存 `agent_execution` projection 且拒絕非法狀態。
- [x] Wiki tasks 的宏觀狀態不變；細部 PENDING…BLOCKED 在 run projection，驗收仍由有證據的 task criteria 決定。
- [x] 接入 check／CI、本次獨立結果檔，保留舊 Phase2 pinned gate。
- [x] 以 CLI ingest／task update／checkpoint／handoff 同步來源、現況、歷史與下一個未授權產品任務。

## Task 5 — 整合與獨立審查

- [x] 原 core／physics／wiki／design regression 與新 tests 實際通過，讀 stdout／exit，不用自述 PASS。
- [x] 獨立 agent 審查 state machine／安全／需求；修正有重現的缺陷並重驗受影響範圍。
- [x] 完成 Gate A–I（含 BLOCKED／PARTIAL／NOT RUN）、檔案清單、真實可執行命令及限制；新 session 讀 Wiki 可以接續。

## Progress

2026-10-26：四組分檔工作已派送；現有 Phase2 完成，無正式 Harness；Muse 已安裝，Git 尚無 HEAD。未啟動任何付費推論。

2026-10-27結案：19/19 gatePASS；Agent75/75，Prompt12/12，Wiki53+1skip。Task0008 DONE，fresh receipt PASS；使用者Muse0→真正啟動前交接→目前Codex修改→原獨立驗收PASS，attempts0。Live項目保留Task0009 BLOCKED，不列為已驗。初始Git快照038d83d，原證據bytes保留。
