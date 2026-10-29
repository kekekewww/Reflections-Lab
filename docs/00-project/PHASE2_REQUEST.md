# Reflection Lab — Persistent LLM Wiki & UI/UX Design Standards

## Phase 2：跨 Agent 長期記憶、專案知識庫與設計工程規範

這是前一份 Reflection Lab Research & Project Bootstrap Master Prompt 的補充任務。

請保留上一階段已經完成的研究成果、文件、程式、Skills、AGENTS.md 與技術決策。

本次任務需要直接在目前的 Repository 中，建立一套可跨 AI Agents、跨 Sessions、跨開發階段持續使用的長期專案知識與記憶管理系統，同時導入完整的 UI/UX Design Engineering Standards。

請實際建立必要的檔案、工具、Skills、工作流程與測試。不要只撰寫概念性的架構提案。

---

# 1. Persistent LLM Wiki — 核心理念

請完整閱讀 Andrej Karpathy 提出的 LLM Wiki Pattern：

https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

不要只根據其他人的摘要實作。請先取得並閱讀原始 Gist，再根據 Reflection Lab 的實際需求設計具體系統。

我希望將 LLM Wiki 發展成這個專案的 **Persistent Project Intelligence Layer**。

它應能持續記錄、理解及管理：

- 專案長期目標與產品願景。
- 現階段的開發方向與里程碑。
- 所有已完成、進行中、待執行的任務。
- 功能開發狀態與實際實作結果。
- 歷史決策、決策原因及被取代的方案。
- 聲學與物理研究成果。
- SDK、框架、API 和第三方依賴資訊。
- 現有架構、重要模組與資料流。
- 實驗結果、Benchmark 及失敗案例。
- UI/UX 設計規範與歷史修訂。
- 技術限制、已知 Bug、風險與阻礙。
- Agent 工作歷史、交接資訊及未完成事項。
- 專案在不同時間點的整體狀態。

核心目標是：

**任何新加入的 Agent，即使完全沒有前一個 Session 的對話上下文，也應能透過 Wiki 快速理解專案、恢復工作並延續開發。**

這個系統必須以可版本化、開放格式、可透過檔案直接存取的方式建立。

優先使用 Git + Markdown + 結構化 Metadata。

不要將長期記憶依賴於某個模型的對話歷史、單一 Agent 的私人記憶功能、專有雲端資料庫或特定 IDE。

---

# 2. Wiki Architecture — 三層架構

依照 Karpathy 的設計，建立三個邏輯層。

## Layer A — Immutable Sources

保存或索引專案知識的原始依據。

包括：

- 原始論文及研究來源。
- 官方 SDK 文件。
- 已完成的實驗結果。
- Benchmark Reports。
- Git Commits。
- 經確認的使用者需求。
- Architecture Decision Records。
- 已驗證的程式碼與測試結果。
- 原始的 Agent 工作紀錄。
- 已確認的競賽規則。

原始資料是證據，不得被 Wiki 的摘要覆蓋。

建立 Source Manifest，記錄來源位置、取得日期、版本、Hash、授權、可信度及相關 Wiki 頁面。

對於法律上或授權上不適合複製的資料，只保存 Metadata 和原始連結。

如果來源本來就在 `research/`、`docs/` 或 Git History，優先建立索引，不要製造多份重複文件。

## Layer B — LLM-maintained Wiki

這是 Agent 可以持續維護的知識層。

Wiki 不是原始文件的簡單摘要集合，而是經過整理、交叉連結與持續修訂的專案知識。

每次研究、開發或實驗有重要進展時，Agent 應更新相關 Wiki 頁面。

例如：

完成 Steam Audio 的 Smoke Test 後，應更新 SDK 狀態、技術可行性、架構決策、相關任務、風險和歷史紀錄。

不應只新增一篇彼此孤立的實驗報告。

## Layer C — Wiki Schema & Agent Operating Rules

建立明確的 Schema，定義：

- Wiki 頁面分類。
- Metadata 格式。
- 檔案命名規範。
- 來源引用方式。
- 知識更新及失效方式。
- 任務狀態及完成標準。
- Agent 間的讀寫協定。
- 衝突處理。
- 工作交接。
- 搜尋、Ingest、Lint 和維護程序。

這個 Schema 是 Wiki 的核心設定。

請將最基本的入口規則寫入根目錄 `AGENTS.md`，但完整規範放在獨立 Wiki Schema 與 Skills 中，避免每次 Session 都載入大量無關內容。

---

# 3. Wiki Directory Structure

優先沿用現有專案結構。

如果尚未建立 Wiki，可以參考：

```text
knowledge/
├── README.md
├── schema.md
├── sources/
│   └── manifest.yaml
├── inbox/
├── events/
└── wiki/
    ├── index.md
    ├── log.md
    ├── now.md
    ├── goals.md
    ├── roadmap.md
    ├── tasks.md
    ├── architecture/
    ├── decisions/
    ├── features/
    ├── research/
    ├── ui-ux/
    ├── experiments/
    ├── history/
    ├── blockers/
    ├── concepts/
    └── handoffs/
```

以上只是參考，不要強制搬移既有資料。

各目錄責任如下。

### index.md — Knowledge Directory

Wiki 的主要入口。

記錄主要頁面連結、簡短描述、分類、重要程度及最後更新時間。

新 Agent 應從這份索引找到相關知識，而不需要搜尋整個 Repository。

### now.md — Current Project State

這是最重要的短期工作記憶入口。

應保持精簡，記錄：

- 現在的專案階段。
- 最近完成的重大工作。
- 目前正在開發的功能。
- 優先級最高的任務。
- 尚未解決的 Blockers。
- 最近的重要決策。
- 下一個可以直接執行的工作。
- 最近一次驗證結果。
- 相關詳細文件連結。

請讓這份文件在合理的 Context Budget 內可以快速讀完。

避免變成持續追加的完整歷史日誌。

### goals.md — Project Objectives

管理長期與短期目標：

- Product Vision
- Hackathon Objectives
- MVP Scope
- Milestones
- Success Criteria
- Out of Scope
- Long-term Research Goals

必須區分使用者正式接受的目標、Agent 的提議，以及已被取代的目標。

### roadmap.md — Development Roadmap

記錄開發階段、優先順序、前置依賴、交付標準和預計工作。

不得與既有 `docs/ROADMAP.md` 形成兩份互相矛盾的權威版本。

請明確指定唯一的正式來源；另一份文件只能索引或提供衍生摘要。

### tasks.md — Task Management

維護可供多 Agent 理解和更新的工作清單。

每個任務至少具有：

- Stable Task ID
- Title
- Description
- Status
- Priority
- Owner / Claim
- Dependencies
- Acceptance Criteria
- Relevant Files
- Evidence / Validation
- Created / Updated Timestamp

建議狀態：

`BACKLOG / READY / IN_PROGRESS / BLOCKED / DONE / CANCELLED`

研究任務與工程任務應使用各自適當的完成證據。

不得因某個 Agent 宣稱完成，就直接將任務標記為 DONE。

### decisions/ — Architecture & Product Decisions

記錄重要決策及背景。

每項決策應包含：

- Decision ID
- Context
- Alternatives
- Decision
- Rationale
- Evidence
- Trade-offs
- Status
- Superseded By
- Related Tasks / Commits

舊決策不可直接刪除。

當決策被新方案取代時，保留歷史並建立關聯。

### history/ — Project History

保存重要里程碑與開發演進。

能回答：

- 專案最初為什麼選擇某項架構？
- 某個功能何時開始開發？
- 哪個版本首次通過驗證？
- 為什麼放棄某項技術？
- 哪次修改引入新的限制？

### handoffs/ — Agent Handoffs

記錄跨 Session 的工作交接。

至少包括：

- Agent / Session ID
- Task ID
- 工作目標
- 已完成內容
- 修改檔案
- 執行命令
- 測試結果
- 未完成事項
- Blockers
- 下一個建議操作
- Git Commit / Branch / Worktree

Handoff 必須足以讓另一個 Agent 不依賴原 Session 就接手。

---

# 4. Wiki Metadata & Provenance

定義統一的 Markdown Frontmatter Schema。

至少支援：

```yaml
---
id: RLAB-KB-0001
title: Example Knowledge Page
type: concept
status: verified
created_at: 2026-10-26T00:00:00+08:00
updated_at: 2026-10-26T00:00:00+08:00
sources: []
related_tasks: []
related_decisions: []
supersedes: []
tags: []
---
```

以上為格式示例，不代表實際建立日期或已驗證狀態。

所有重要知識必須能區分：

- VERIFIED：有直接證據支持。
- ACCEPTED：已正式採納的專案決策。
- PROPOSED：尚未批准的方案。
- EXPERIMENTAL：正在驗證。
- UNVERIFIED：證據不足。
- DEPRECATED：已過時或被取代。

需要區分「某個功能計畫要做」、「程式已實作」、「測試已通過」及「聲學模型已被物理驗證」。

這四件事情不能混為一談。

Source of Truth 的優先順序需要依資訊類型定義。

例如：

- 實際程式行為：程式碼及可重現測試。
- 研究數據：原始論文與量測資料。
- 產品需求：最新已確認的使用者需求。
- 正式技術決策：已接受的 ADR。
- 工作狀態：經檔案和測試佐證的 Task Record。
- 知識整理：Wiki 的最新且未失效的綜合頁面。

Wiki 不應覆寫其他領域的權威來源。

---

# 5. Wiki Operations

必須建立以下六種操作流程。

## A. Ingest

當 Agent 發現新論文、研究文件、架構決策或實驗結果時：

1. 確認來源和授權。
2. 記錄 Source Manifest。
3. 檢查是否已經 Ingest 過相同版本。
4. 擷取重要資訊與可驗證主張。
5. 更新現有 Wiki 頁面。
6. 必要時建立新頁面。
7. 更新交叉連結與索引。
8. 記錄變更日誌。
9. 執行 Wiki Lint。

同一個來源重複執行 Ingest，不能不斷產生重複頁面。

## B. Query

當 Agent 需要查詢專案資訊時：

1. 先閱讀 `index.md`。
2. 搜尋相關 Wiki 頁面。
3. 只讀取與任務相關的內容。
4. 必要時追溯原始資料。
5. 給出附帶來源的結論。
6. 對具有長期價值的新發現，更新 Wiki。

採用 Progressive Disclosure。

不要在每次啟動時，把整個 Wiki 載入 Context Window。

## C. Lint

定期檢查：

- 無效連結。
- 孤立頁面。
- 重複知識。
- 互相矛盾的主張。
- 已被取代的決策。
- 過時的依賴版本。
- 未完成的引用。
- 沒有證據的數據。
- Task 狀態與 Git / Tests 不一致。
- 已完成但沒有驗證資訊的任務。
- 長期未更新的 Blockers。
- 已完成但沒有關閉的工作。

可安全自動修正的問題可以自動處理。

重要事實衝突不得直接猜測哪一個正確，必須記錄並標記需要重新驗證。

## D. Checkpoint

重要工作完成時，保存當下的專案狀態。

Checkpoint 應記錄：

- Task ID
- Agent / Session
- Git Revision
- 修改範圍
- 已完成工作
- 驗證證據
- 仍然存在的風險
- 下一步

不需要在每次工具呼叫後都建立 Checkpoint。

建議於重要任務完成、關鍵決策變更、測試通過或工作交接時執行。

## E. Handoff

當 Agent 準備結束 Session 或轉交任務時：

1. 更新任務狀態。
2. 更新相關 Wiki 頁面。
3. 記錄實際測試與未完成工作。
4. 建立 Handoff。
5. 更新 `now.md`。
6. 確認沒有留下不明狀態的修改。

若工具支援可靠的 Session Hooks，可以研究自動化。

若不支援，建立明確的手動命令或 Skill，不要宣稱已具備自動記憶功能。

## F. Reconcile

當不同 Agent 修改相同知識時：

- 使用 Git 與明確的修改來源追蹤。
- 優先保留原始證據。
- 比較來源與時間，而非直接採用最後寫入者。
- 不能靜默覆蓋彼此的研究或決策。
- 發現衝突時建立 Conflict Record。
- 對無法自動解決的權威衝突標記待處理。

---

# 6. Multi-Agent Shared Memory Protocol

這個系統至少需要支援：

- OpenAI Codex
- Claude Code
- Pi Agent
- 未來其他能讀寫專案檔案的 Coding Agents

不能將它限定為某一個 Agent Framework 的專用格式。

## 6.1 Agent Startup Protocol

新的 Agent Session 啟動時，應依序：

1. 讀取根目錄 `AGENTS.md`。
2. 讀取 Wiki Schema 和 `index.md`。
3. 讀取 `now.md`。
4. 檢查目前任務及相關 Dependencies。
5. 閱讀最近的 Handoff。
6. 取得與當前任務有關的頁面。
7. 以 Git 和實際檔案狀態核實重要資訊。

不應無條件載入所有歷史紀錄或全部研究文件。

## 6.2 Task Claiming

多個 Agent 同時工作時，需要避免重複認領同一個任務。

研究 Task Claim、Owner、Heartbeat、Lease、Git Worktree 或其他適合本地專案的協調方式。

如果無法提供可靠的跨 Process Lock，應使用保守的分工規則，避免虛假的獨占宣告。

## 6.3 Concurrent Writes

多 Agent 可能同時更新 `now.md`、`tasks.md` 或 `log.md`。

請設計安全的寫入流程，例如：

- 單一 Writer 或明確的檔案責任。
- 原子檔案更新。
- Optimistic Concurrency。
- Git-based Conflict Detection。
- Per-session Event Files。
- 由事件生成的 Chronological Log。

`log.md` 必須保留完整歷史語意。

若採用 Event Files 來解決並行問題，可以讓 `log.md` 作為可重建的時間索引，但不能遺失原始事件。

## 6.4 Cross-Agent Compatibility

檢查 Codex、Claude Code 及 Pi Agent 實際支援的：

- Project Instructions
- Skills
- Session Hooks
- Tool Invocation
- Workspace Layout
- Subagents
- Handoff Mechanisms

在各工具中建立最薄的相容入口。

如果需要 `CLAUDE.md`，應以指向共同規範的方式建立，避免複製整份 AGENTS.md。

Pi Agent 亦同。

所有 Agent 最終都應閱讀同一套 Wiki Schema 與知識來源。

不同 Agent 的私有設定不應成為唯一知識保存位置。

## 6.5 Git Sync

Wiki 應可透過 Git 在不同機器與 Agent 工作環境中同步。

需要處理：

- Branch / Worktree。
- Merge Conflicts。
- Commit Provenance。
- Sensitive Information。
- Large File Management。
- Generated Index Files。

不得自行推送 Private Repository、改變 Remote 權限或公開研究資料。

---

# 7. Durable Project Memory Rules

請將以下規則寫入 AGENTS.md 或專用 Wiki Skill。

**在重要工作完成後，Agent 必須同步更新長期知識。**

需要更新 Wiki 的事件包括：

- 新功能完成。
- 重大功能變更。
- 新的正式需求。
- Architecture Decision。
- SDK 或主要依賴更換。
- 新研究結論。
- 實驗取得重要結果。
- Benchmark 通過或失敗。
- 發現重要 Bug。
- 任務被阻擋或解決。
- 重大 UI/UX 設計決策。
- 工作準備交給另一個 Agent。

但禁止：

- 每次小修改都重寫整份 Wiki。
- 將所有對話逐字複製進 Wiki。
- 無條件保存短暫的中間推理。
- 將模型猜測保存成正式決策。
- 自動將未驗證內容標記為 VERIFIED。
- 將私密憑證、Token、API Key 存進 Wiki。
- 讓 Wiki 和正式程式規格產生多份互相矛盾的資料。

長期記憶應重視資訊品質，而非文字數量。

---

# 8. Wiki Tooling & Automation

建立簡潔、可測試的 Wiki 管理工具。

至少提供以下功能或等效 CLI：

```text
wiki ingest <source>
wiki query <question>
wiki lint
wiki checkpoint
wiki handoff
wiki status
```

實際 CLI 名稱可依專案現有工具鏈調整。

優先使用 Python、Node.js 或現有工具建立輕量化管理流程。

需要支援：

- Idempotent Ingest。
- Metadata Validation。
- Link Validation。
- Duplicate Detection。
- Source Traceability。
- Task State Checks。
- Chronological Events。
- JSON / Markdown Output。
- Dry Run。

研究 Karpathy 提及的 qmd：

https://github.com/tobi/qmd

判斷是否適合做為本地 Wiki Search Engine。

初版若檔案數量不多，優先使用 Markdown Index、全文搜尋及檔案連結。

不需要一開始就部署 Vector Database、Embedding Pipeline 或獨立搜尋服務。

未來規模擴大，再增加 BM25、Hybrid Search 或 MCP。

## 8.1 Wiki Validation Tests

請實際建立測試，至少覆蓋：

1. 新文件 Ingest 後，Index 和相關頁面正確更新。
2. 重複 Ingest 不產生重複頁面。
3. 新決策取代舊決策時，保留歷史。
4. 任務狀態可以追溯驗證證據。
5. 新 Agent 可以依照 Handoff 恢復工作。
6. 無效連結可被 Lint 找出。
7. 互相矛盾的知識不會被默默合併。
8. 多 Agent 同時更新時不會無聲遺失內容。
9. 主要 Wiki 工具重複執行不破壞資料。
10. 缺少自動 Hook 時仍可透過手動流程維護。

請建立具體的測試檔案、Fixture 及執行命令。

---

# 9. UI/UX Design Engineering Standards

第二項工作是為 Reflection Lab 建立長期有效的 UI/UX 設計與程式品質標準。

請完整研究：

https://github.com/emilkowalski/skills

這是主要的 Design Engineering 參考。

請閱讀官方 README、授權，以及實際需要的 Skills，而不只是引用 Repository 名稱。

## 9.1 Skills Selection & Installation

優先評估：

- `emil-design-eng`
- `animate`
- `review-animations`
- `improve-animations`
- `animation-performance`
- `pick-ui-library`
- `prototype`
- `break-ui`

依照專案技術與開發需求，選擇需要的 Skills。

官方提供的安裝方式為：

```bash
npx skills@latest add emilkowalski/skills
```

執行前先檢查來源、安裝工具、實際安裝行為和版本。

若使用自動安裝，應保留可重現的版本資訊；正式專案應避免無控制地依賴 `latest`。

請確認安裝位置適用於 Codex，並評估其他 Agent 是否能共享同一套 Skills。

如需在 Repository 中保存第三方 Skill，請保留授權及來源紀錄。

不要重複建立與原始 Skills 完全相同的文件。

專案特有的設計規範，可以額外建立：

`reflection-lab-design-system`

或等效的 Project Skill。

---

# 10. Reflection Lab UI/UX Standards

請將 Emil Kowalski 的設計工程原則，與前一階段完成的 Reflection Lab UI/UX Research 整合。

產生可實際檢查的規範。

## 10.1 Visual Design

建議風格：

- Modern Professional Tool
- Dark UI，但避免純黑。
- 清晰且一致的資訊層級。
- 適合專業工具的資訊密度。
- 4px Spacing System。
- 一致的 Radius、Typography、Border 和 Shadow。
- 低干擾的 Accent Colors。
- 高可讀性的數字及工程參數。
- 使用適當的等寬字體呈現精確數據。

定義 Design Tokens：

- Color
- Typography
- Spacing
- Radius
- Border
- Elevation
- Motion
- Z-index
- Interactive States

聲學資料視覺化應使用一致的顏色與線型語意。

例如 Direct、Reflected、Blocked、Selected Path 等狀態需要明確且可辨識。

不要只靠顏色傳達資訊。

## 10.2 Motion & Micro-interactions

參考 Emil Kowalski 的 Animation Decision Framework。

每一個動畫開始設計前，先回答：

- 這個元件真的需要動畫嗎？
- 動畫要傳達什麼資訊？
- 是否會頻繁出現？
- 哪種動畫屬性成本最低？
- 是否支援中斷與重新操作？
- 是否影響可讀性或操作延遲？
- 是否支援 Reduced Motion？

對高頻率操作，例如鍵盤快捷鍵、物件拖曳或 AI Command Palette，優先確保即時回饋。

不要為了展示效果強迫所有介面轉場動畫化。

優先使用適合合成層處理的屬性，例如 `transform` 與 `opacity`。

避免不必要的 Layout Thrashing、過度 Blur、全域 `transition: all` 或每幀大量 React Re-render。

3D 物理動畫、UI 微互動和聲學時間基準應明確分離。

## 10.3 Interaction Design

所有互動元件必須具備：

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error

視實際需求增加 Selected、Recording、Paused 和 Simulating 等狀態。

需要定義：

- 鍵盤操作。
- Focus Management。
- Pointer Lock 行為。
- 快捷鍵優先順序。
- Modal / Popover 行為。
- Undo / Redo。
- Drag / Drop。
- Keyboard Accessibility。
- Reduced Motion。
- Error Recovery。

不要用大量文字代替清楚的操作設計。

## 10.4 First-Person UX

針對 FPS Simulation 和 Build Mode 制定獨立規格。

包含：

- 玩家視角。
- 準星與物件 Hover。
- Grab / Drop / Throw。
- 持有距離。
- 物件旋轉。
- Ghost Preview。
- Surface Snapping。
- Gravity Modes。
- Fixed / Dynamic Feedback。
- Player / Object Collision。
- Camera / Listener Synchronization。

必須處理：

- 物件超出抓取距離。
- 物件被其他幾何遮擋。
- 抓取物件時切換模式。
- 開啟設定面板時的 Pointer Lock。
- FPS 控制與 Inspector 輸入衝突。
- 退出 Simulation 後的狀態恢復。
- 音訊尚未取得瀏覽器播放權限。
- 模擬暫停時的聲學輸出行為。

這些操作不能只有正常情況能成功。

## 10.5 Professional Workspaces

規劃並維持：

- Scene Workspace
- Simulation Workspace
- Analysis Workspace

每個 Workspace 都要有清楚的主要任務與資訊優先順序。

Workspace 切換不能意外重設物理世界、音訊播放或實驗狀態。

Inspector 採用 Contextual Editing。

Scene Explorer、Viewport、Inspector 和 Analysis Dock 的 Selection State 應保持一致。

聲學反射路徑與分析圖表應支援雙向選取及定位。

## 10.6 Performance Standards

建立 UI Performance Budget。

至少區分：

- Viewport Frame Rate。
- Main Thread Blocking。
- Physics Step Duration。
- Acoustic Solver Update Cost。
- Audio Processing Deadline。
- UI Interaction Latency。

可將 60 FPS 作為桌面 3D UI 的初始目標，但實際門檻必須依測試硬體與專案需求決定。

不要把 60 FPS 或 16.7 ms 當成 Audio Callback 的實際時間預算。

需要透過實際量測確認效能，不得只因開發者電腦流暢就宣稱達標。

## 10.7 UI Stress Testing

使用 `break-ui` 等 Skill 建立測試規範。

包含：

- 很長的物件名稱。
- 大量 Scene Objects。
- 空白場景。
- 沒有 Listener。
- 無效 Material。
- 大量 Collision Events。
- Acoustic Solver Failure。
- 不同螢幕解析度。
- 長文字及中文介面。
- 高 DPI。
- 大量 Reflection Paths。
- 不支援特定功能的裝置。
- 無法取得音訊裝置或 Pointer Lock。

設計規範不只包含視覺品質，也需要檢查操作正確性與失敗恢復。

---

# 11. Design Knowledge Integration

UI/UX 設計規範必須整合至長期 Wiki。

建立或索引以下知識：

- Design Philosophy
- Design Tokens
- Workspace Architecture
- Component Guidelines
- Motion Guidelines
- First-person Interaction
- Acoustic Visualization
- Accessibility
- Performance Standards
- UX Decisions
- UI Review History

請指定正式 Design System 文件的位置，避免 Wiki 與 `docs/05-ux/` 出現重複且不一致的規範。

Wiki 可以維護摘要、索引和設計決策；具體的 Component Spec 與 Design Tokens 則保留唯一的權威來源。

當 Agent 新增或修改 UI 時：

1. 讀取適用的 Design System。
2. 使用相關 Emil Kowalski Skills。
3. 檢查既有 Component Patterns。
4. 實作或調整介面。
5. 進行實際視覺及互動驗證。
6. 檢查動畫與效能。
7. 更新對應的設計決策或知識頁面。

如果缺少真正的瀏覽器或畫面驗證能力，不可以將純程式碼審查宣稱為已通過視覺測試。

---

# 12. AGENTS.md Integration

請將新的長期記憶協定與 UI/UX 規範加入既有 AGENTS.md。

必須維持簡潔。

建議包括：

### Session Startup

讀取專案 Wiki 入口、Current State、當前任務及最近 Handoff。

### Before Research

查詢已有研究，避免重複工作。

### Before Implementation

檢查最新 Architecture Decision、Feature Status、Relevant Skills 和 Testing Requirements。

### Before UI Changes

讀取 Design System，並使用適用的設計工程 Skill。

### After Important Work

更新 Task、相關 Wiki、Evidence 及必要的 Checkpoint。

### Before Session End

建立 Handoff，保存可重現的工作狀態。

不要每次都載入整份研究資料庫。

不要把所有 Wiki 規則複製到每一份 Agent 設定文件。

應以共同的 Schema 與清楚的檔案連結維護跨 Agent 一致性。

---

# 13. End-to-End Validation

完成後請實際模擬以下情境。

## Scenario A — New Codex Session

假設 Agent 完全不知道之前的工作。

只透過 AGENTS.md 與 Wiki，確認它能找到：

- 當前專案目標。
- 已完成的技術研究。
- 下一個 P0 任務。
- 適用的技術規格。
- 可以執行的驗證命令。

## Scenario B — Agent Handoff

模擬 Agent A 完成一項研究並交接給 Agent B。

Agent B 必須能透過 Handoff 與 Wiki 正確接續，且不重新執行不必要的研究。

## Scenario C — Outdated Decision

建立測試用舊決策及新決策。

確認 Wiki 可以辨識新舊關係，保存歷史並更新有效決策。

## Scenario D — UI/UX Implementation

模擬開發 FPS Grab Interaction。

確認 Agent 能找到：

- Physics Interaction Spec。
- Input Controls。
- Design System。
- Relevant Emil Kowalski Skills。
- Acceptance Criteria。
- UI / Physics / Audio Testing Requirements。

## Scenario E — Conflicting Agent Updates

模擬不同 Agent 同時修改任務與專案狀態。

確認系統能檢測衝突、不會默默覆蓋資料，而且保留必要的原始紀錄。

---

# 14. Final Deliverables

請實際交付：

1. 可使用的 Persistent LLM Wiki。
2. Wiki Schema 與 Source Manifest。
3. Project Goals、Current State、Roadmap 和 Task System。
4. Project History、Decision Records、Experiment Knowledge。
5. Cross-Agent Startup / Handoff Protocol。
6. Codex、Claude Code、Pi Agent 的相容入口。
7. Wiki Ingest、Query、Lint、Checkpoint、Handoff 工具。
8. 完整的測試與執行結果。
9. 已整理或安裝的 Emil Kowalski Skills。
10. Reflection Lab 專用 UI/UX Design Standards。
11. 已更新的 AGENTS.md。
12. 可供下一個 Agent 立即使用的完整工作交接文件。

如果既有專案文件與新 Wiki 有重複，請先確認並指定每項資訊唯一的正式維護位置，再使用索引或連結建立關係。

不要自行刪除既有內容，也不要因為建立新 Wiki 就全面重寫之前已完成的研究。

最後提供：

- 新增與修改的檔案清單。
- Wiki 的完整入口。
- 跨 Agent 記憶運作方式。
- 實際測試結果。
- Skills 的安裝或配置狀態。
- UI/UX 規範的位置。
- 尚未完成的限制。
- 另一個全新 Agent 應該如何開始工作。

**最終驗收標準：**

Reflection Lab 的專案知識必須能隨研究、開發、實驗和設計持續累積，並且在不同 Coding Agents 和不同 Session 之間可靠傳遞。

新的 Agent 應能快速知道專案現在在哪裡、過去做過什麼、哪些決策已經成立、還有哪些問題，以及下一步應該如何執行。

同時，所有 UI/UX 修改都應遵守共同的設計工程規範，避免不同 Agent 產生互相矛盾的視覺系統與操作邏輯。

**現在請閱讀兩個指定的官方參考來源，檢查目前 Repository，然後直接建立並驗證整套長期 Wiki 與設計工程環境。不要只輸出計畫。**