# Reflection Lab — Multi-Agent Development Harness & Muse Optimization

**Phase 3：Codex Orchestration × Muse Code Implementation × Independent Verification**

## 0. 核心任務

你現在是 Reflection Lab 專案的 Lead Engineering Architect、AI Agent Orchestrator、Quality Assurance Engineer 與 LLM Systems Researcher。

本次任務是接續既有的 Reflection Lab Research Bootstrap、LLM Wiki、UI/UX Design Standards 與 Agent Harness，將專案調整為一套可持續執行、可驗證、可恢復、可跨 Agent 協作的開發系統。

目標採用：

**Goal-Driven, Muse-Implemented, Codex-Verified Development**

你的責任是：

1. 檢查現有專案的研究、架構與開發狀態。
2. 根據最新決策調整 Reflection Lab 的技術架構。
3. 全面研究 Muse 家族模型、Muse Code 與 Meta Model API。
4. 研究如何撰寫適合 Muse 模型的高品質提示詞。
5. 驗證 Muse Code Headless、CLI、Session Protocol 與 SDK。
6. 建立由 Codex 主導、Muse Code 負責主要實作的開發流程。
7. 建立 Codex 獨立驗證、錯誤回報、修復及重試機制。
8. 建立 Muse 模型在 Reflection Lab 產品內的 Agent Runtime 規格。
9. 將研究、Prompt、測試、腳本、Skills 與決策實際寫入 Repository。
10. 將重要變更整合至現有 LLM Wiki，使不同 Agent 可以持續維護。

請直接執行可完成的研究、配置與技術驗證，不要只輸出計畫。

本階段以**開發基礎設施與 AI 運作模式**為主，除必要的 Technical Spike 與 Smoke Test 外，暫時不要開始大量實作正式產品功能。

---

# 1. Architecture Decisions — 必須先對齊的最新決策

開始前先閱讀目前的：

- AGENTS.md
- LLM Wiki
- Architecture Decision Records
- Research Status
- Roadmap
- Task Backlog
- Existing Code
- Validation Plans
- UI/UX Standards

不得直接覆寫之前完成的工作。

請檢查文件是否與以下決策衝突，並使用新的 ADR 記錄需要修改的部分。

## 1.1 Reflection Lab 是獨立的新專案

Reflection Lab 是為 Meta Global AI Developer Hackathon 2026 開發的獨立作品。

不打算直接沿用 Echo Canvas 或 Reflections 的核心程式碼。

過去的研究、數學理論、公開文獻及已完成的技術調查可以作為參考，但競賽期間的新開發成果必須具有清楚的 Git 與 Provenance 紀錄。

## 1.2 Acoustic Core 改為 Web-native 自行開發

目前主要技術方向：

- React / TypeScript
- Three.js / React Three Fiber
- Rapier Physics
- Custom Geometric Acoustic Core
- Web Audio API / AudioWorklet
- Meta Model API
- Muse Code
- Codex
- Git-based LLM Wiki

聲學核心優先自行實作：

- Direct Propagation
- Distance Attenuation
- Occlusion
- First-order Reflection
- Image Source Method
- Path Identity
- Material Acoustic Properties
- Atmospheric Absorption
- Spatial Audio Rendering Parameters

Steam Audio SDK 保留作為：

- 研究參考。
- 可選的 Acoustic Backend。
- Independent Benchmark。
- 未來 Native Runtime 擴充方案。

Steam Audio 不應成為 MVP 的強制依賴。

不要為了移除 Steam Audio，而刪除既有 SDK 研究與授權文件。

## 1.3 第一人稱物理沙盒是核心功能

必須保留：

- Scene Editor
- First-Person Simulation
- First-Person Build Mode
- Grab / Drop / Throw / Rotate
- Gravity / No Gravity / Fixed / Kinematic
- Dynamic Audio Sources
- Collision Audio
- Listener Synchronization
- Acoustic Visualization
- Record / Replay
- A/B Experiments

## 1.4 Meta AI 是作品中的正式功能

Muse Code 負責開發程式，不等於已完成作品內的 Meta 模型整合。

Reflection Lab 本身仍應具有 Meta AI Experiment Agent，能實際建立場景、控制參數、執行聲學實驗、讀取結果及提出改善方案。

這是產品的重要競賽功能，不可省略。

---

# 2. Muse Family Research — 官方模型研究

請直接閱讀 Meta 最新官方文件：

https://dev.meta.ai/docs/overview

https://dev.meta.ai/docs/models

https://dev.meta.ai/docs/muse-code

https://dev.meta.ai/docs/muse-code/configuration

https://dev.meta.ai/docs/muse-code/extending

https://dev.meta.ai/docs/muse-code/permissions

https://dev.meta.ai/docs/muse-code/subscriptions

https://dev.meta.ai/docs/agent-frameworks

https://dev.meta.ai/docs/cookbook/tool-function-calling

https://dev.meta.ai/docs/cookbook/structured-output

https://dev.meta.ai/docs/prompt-caching

https://dev.meta.ai/docs/muse-spark-open/prompting

不可僅依賴搜尋結果摘要。請閱讀實際的 API、CLI 與使用範例。

對所有資訊記錄：

- 官方來源。
- 查核日期。
- API / CLI Version。
- 支援平台。
- 具體能力。
- 已知限制。
- 實際驗證狀態。

## 2.1 模型能力比較

至少研究：

**Muse Spark**

評估日常程式實作、短任務、工具呼叫、結構化輸出、Agent Loop 和延遲敏感任務。

**Muse Wonder**

評估複雜程式實作、跨檔案修改、長時間推理、架構調整、困難除錯和 Subagent 工作。

**Muse Spark Open**

評估開放權重、部署條件、推論成本及未來自架 Runtime 的可行性。

**Muse Glimmer**

評估小型、低延遲及本地推論任務是否有適用情境。

**Muse Image / SAM 3.1**

評估未來是否能協助 3D 場景產生、材質辨識、場景語意理解或視覺資產處理。

不要將所有模型強制加入專案。

請以實際工作負載決定是否需要某個模型。

每個模型需比較：

- Model ID
- Context Window
- Tool Calling
- Structured Outputs
- Multimodal Capabilities
- Reasoning Controls
- Latency
- Cost
- Rate Limits
- Model Availability
- Suitable Tasks
- Unsupported Operations

必須區分 Meta Model API、Muse Code CLI、開放權重部署與第三方推論平台。

不同環境的參數與 Prompt Template 不一定相同，不可以混用。

---

# 3. Muse Prompt Engineering Research

本階段的重要目標是研究：

**如何讓 Muse 家族模型在 Reflection Lab 的程式開發與產品 Runtime 中，維持高任務完成率、低錯誤率、合理延遲與可控成本。**

研究應分成兩個場景。

## 3.1 Coding Agent Prompting

研究 Muse Code 在以下任務中的最佳提示詞：

- 新功能實作。
- 多檔案修改。
- TypeScript / React。
- Three.js。
- Rapier Physics。
- Web Audio DSP。
- 數學演算法。
- Bug Fix。
- Refactoring。
- Unit / Integration Tests。
- UI Implementation。
- Performance Optimization。

調查不同 Prompt 組織方式的效果：

- Role / Objective。
- Project Context。
- Exact Scope。
- Architecture Constraints。
- Acceptance Criteria。
- Relevant Files。
- Tool Permissions。
- Definition of Done。
- Negative Constraints。
- Error Recovery。
- Completion Report。

研究何時應使用：

- 簡短 Task Prompt。
- 明確的 Task Specification。
- Few-shot Examples。
- Structured Outputs。
- Reasoning Effort。
- Multi-step Agent Loop。
- Subagents。
- Skills。
- Session Resume。

不要假設提示詞越長越好。

評估不同情況下的 Context Selection、Prompt Length、檔案引用數量與模型表現。

## 3.2 Muse Prompt Benchmark

請建立實際可重現的 Prompt 評測基礎。

選擇至少四種類型的小型代表任務：

A. TypeScript Component Implementation。

B. Physics / Rapier Interaction。

C. Geometry / Acoustic Mathematics。

D. Bug Fix / Regression Test。

若現有專案尚無足夠程式，可以使用隔離的最小 Fixture。

對每類任務比較至少兩種 Prompt Strategy：

**Strategy A — Direct Instruction**

以簡單、明確的需求讓 Muse 執行。

**Strategy B — Structured Task Contract**

提供完整 Scope、Constraints、Acceptance Criteria 和驗證命令。

視實際需要加入：

**Strategy C — Context-guided Implementation**

利用相關研究、Architecture、已有模組和 Skill 輔助實作。

記錄：

- Task Success Rate。
- Test Pass Rate。
- Required Repair Rounds。
- Unexpected File Modifications。
- Hallucinated APIs。
- Latency。
- Tokens / Estimated Cost。
- Tool Calls。
- Human Intervention。
- Final Code Quality。

只採用可以實際觀察的指標。

不能因某次測試成功，就宣稱某個 Prompt Strategy 普遍較優。

請將評測結果整理成可更新的 Prompt Engineering Guide，提供不同任務的建議 Prompt 範本。

若沒有 API Key、模型額度或執行權限，仍需建立離線 Fixture、測試工具與執行說明，並標記 LIVE EVAL NOT RUN。

---

# 4. Muse Code Headless & Programmatic Execution

研究並實際驗證 Muse Code 如何在非互動模式中執行。

優先研究：

- `muse exec`
- `--prompt-file`
- `--json`
- `--model`
- `--reasoning-effort`
- `--max-model-steps`
- `--workspace`
- `--session-id`
- `muse export`
- `muse serve`
- `muse schema`
- `@muse-code/sdk`

先檢查實際安裝版本與 `muse --help`、`muse exec --help`。

不可僅根據文件假設所有選項在目前環境中都可使用。

## 4.1 最小 Headless Proof of Concept

先在獨立的測試目錄執行一項無風險、可驗證的任務。

使用 Prompt File，要求 Muse 修改或建立一個測試檔案。

例如，驗證下列命令的可用性；參數須先以安裝版本的 Help 確認：

`muse exec --model muse-spark-1.3 --reasoning-effort medium --contributor-mode off --disable-approval --prompt-file ./tasks/smoke-test.txt --json --max-model-steps 30`

需保留：

- CLI Version。
- Model ID。
- Prompt。
- Workspace。
- Process Exit Code。
- JSONL Events。
- Modified Files。
- Execution Duration。
- Test Results。
- Error / Blocker。

**Muse Exit Code 0 不能作為程式正確性的證據。**

必須再由獨立的測試程序檢查產出結果。

## 4.2 Headless Security

不得直接採用 `--yolo` 作為預設設定。

優先採用保留 Sandbox 的執行方式，例如經確認的 `--disable-approval`。

若 Sandbox 或必要權限造成任務無法執行，記錄問題並採取權限最小化的解法，不得自行全面解除保護。

需要考慮：

- Workspace Trust。
- Filesystem Access。
- Network Permission。
- Dependency Installation。
- Process Timeout。
- Cancellation。
- Child Processes。
- Secrets Protection。
- Sandboxed Execution。

正式驗證前不要將未知的遠端 Script 直接執行。

## 4.3 Session Management

研究：

- Session Creation。
- Session ID。
- Resume。
- Session Export。
- Failure Recovery。
- Interrupted Runs。
- Cross-workspace Safety。
- Structured Event Parsing。

每一次 Muse 任務都應具有可追溯的 Run ID。

當 Muse Code 的 CLI 事件格式改變時，必須能透過 Adapter 或 Schema Validation 偵測，而非靜默遺失資料。

## 4.4 CLI 與 SDK 選型

比較：

**Option A — CLI Wrapper**

Codex 透過 `muse exec` 執行工作。

優點預期為實作簡單、易於檢查、可使用標準 Process 管理。

**Option B — Muse Code Session SDK**

透過 `muse serve` 與 TypeScript SDK 管理 Session。

評估其事件回報、取消、Resume、狀態管理與長期維護成本。

**Option C — Muse Workflows**

若實際安裝版本支援，評估其是否適合管理 Muse 內部的子代理。

需要注意，不能讓 Muse 的內部 Workflow 與 Codex 的任務總控形成兩套互相競爭的控制系統。

**目前預設先實作 CLI Wrapper。**

若研究證明 SDK 更適合，再以 ADR 說明切換理由。

---

# 5. Codex × Muse Code — 正式分工

建立明確的 Orchestration Contract。

## 5.1 Codex — Architect & Independent Verifier

Codex 負責：

- Architecture Decisions。
- Milestone Planning。
- Task Decomposition。
- Prompt Selection。
- Muse Model Routing。
- Task Assignment。
- Acceptance Tests。
- Independent Code Review。
- Performance Validation。
- Regression Tests。
- Defect Classification。
- Retry Decisions。
- Integration Approval。
- Wiki Updates。

Codex 可以實作 Orchestrator、測試基礎設施、驗證工具與必要的技術支援。

但正式產品功能應優先交由 Muse Code 實作。

若 Muse Code 不可用、陷入阻礙或嚴重無法完成任務，Codex 可依明確的 Fallback Policy 接手必要修改，並記錄原因與貢獻來源。

## 5.2 Muse Code — Primary Implementation Agent

Muse Code 負責：

- 根據 Task Contract 閱讀相關程式。
- 實作前端、Physics、Acoustic Core 與 DSP。
- 建立或修改功能程式。
- 實作局部 Unit Tests。
- 執行允許的自我檢查。
- 產生 Implementation Report。
- 修正 Codex 發現的缺陷。

Muse 不應自行：

- 修改正式 Architecture Decision。
- 放寬 Acceptance Criteria。
- 刪除失敗測試。
- 更改 Benchmark Truth。
- 修改不屬於 Task Scope 的模組。
- 將測試失敗宣稱為完成。
- 在未經驗證下整合至主要分支。

## 5.3 Meta AI Runtime — Product Agent

這是執行在 Reflection Lab 產品內的 AI。

其主要任務是實際操作聲學實驗。

它與 Muse Code Coding Agent 必須具有不同的工具權限、Prompt、記憶和 Runtime。

產品內 Agent 不應具有直接修改 Repository、執行任意 Shell Commands 或操作本機私人檔案的能力。

---

# 6. Machine-readable Task Contract

請建立可供 Codex 與 Muse Code 交換的任務格式。

每個任務至少包含：

- task_id
- milestone_id
- title
- objective
- scope
- out_of_scope
- relevant_files
- architecture_refs
- skill_refs
- allowed_operations
- forbidden_operations
- model_profile
- reasoning_effort
- expected_deliverables
- acceptance_criteria
- verification_commands
- max_model_steps
- max_repair_rounds
- resource_budget
- task_status

Task Contract 應有 JSON Schema 或相同等級的 Runtime Validation。

另外建立：

**ImplementationResult**

包含修改檔案、執行結果、已知限制、測試結果及未完成事項。

**VerificationResult**

包含由 Codex 獨立驗證的項目、實際命令、測試輸出、缺陷及判定。

**RepairTask**

包含重現步驟、Expected / Actual Behavior、相關測試及允許的修復範圍。

請確保所有狀態都能連結到 Task ID、Git Revision 與對應的 Agent Run。

---

# 7. Continuous Verification & Repair Loop

建立正式的開發循環：

1. Codex 選取 READY Task。
2. Codex 驗證 Task Dependencies。
3. Codex 建立或確認驗收條件。
4. Codex 產生 Muse Implementation Prompt。
5. Muse Code 在隔離的工作範圍執行。
6. 收集程式修改、Session Log 及執行結果。
7. Codex 獨立執行測試。
8. Codex 進行 Code Review 與品質分析。
9. 若未通過，建立 RepairTask。
10. Muse Code 修復問題。
11. Codex 重新驗證。
12. 通過後才更新 Task Status、Checkpoint 和 Wiki。
13. 推進下一項已準備好的任務。

必須有明確停止條件。

單一缺陷預設最多修復三輪。

如果相同問題持續失敗、無法取得必要權限、測試規格互相矛盾或已超出資源預算，應停止該任務並回報原因。

不得無限循環。

## 7.1 Git Isolation

優先評估 Git Worktree 作為 Muse Implementation Workspace。

原則：

- Codex 維護主要工作區。
- Muse 在指定 Worktree 中實作。
- 不允許兩個 Agent 同時任意修改相同的工作區。
- Codex 檢查 Diff 後才能接受修改。
- 不可自動 Force Push、Reset 或覆寫未提交變更。
- 不可假設 Muse Code 的 Session Messaging 在所有平台都能使用。

Worktree 建立、清除和整合必須有明確安全規則。

## 7.2 Independent Verification

Codex 應根據任務類型執行：

**Frontend**

- Typecheck
- Lint
- Component Tests
- Playwright E2E
- Visual Inspection
- Interaction State Checks

**Physics**

- Deterministic Fixtures
- Gravity Modes
- Grab / Throw
- Collision Events
- CCD / Tunneling Tests
- State Transitions

**Acoustics**

- Analytical Geometry Tests
- Propagation Delay
- First-order Reflection
- Material Energy Constraints
- Path Identity
- Numerical Stability

**Audio**

- OfflineAudioContext
- Impulse Arrival Tests
- Parameter Continuity
- Collision Sound Triggering
- Audio Dropout / Glitch Analysis

**Runtime**

- Build
- Performance
- Regression
- Resource Cleanup
- Failure Recovery

對物理聲學驗證，需優先使用數學解析結果或獨立參考模型。

不能以同一個尚未驗證的函式同時產生 Expected Value 和 Actual Value。

---

# 8. Codex Goal-driven Development

請研究目前安裝的 Codex 版本與 `/goal` 支援。

官方參考：

https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex

本專案希望使用 Codex Goal 管理每個 Milestone。

但不應將整份 Hackathon Roadmap 變成一個沒有終點的巨大 Goal。

應將每個 Goal 定義為：

- One Milestone。
- Measurable Outcomes。
- Verification Surface。
- Allowed Tools。
- Constraints。
- Resource Budget。
- Retry Policy。
- Blocked Stop Condition。

例如：

**Milestone — First-Person Physics**

Goal 的完成標準是 FPS 移動、抓取、放下、投擲、物理模式切換及相關測試全部通過。

Codex 負責指派 Muse Code、驗證程式、建立 Repair Task 和判斷是否完成。

Muse Code 不必同時啟動另一個不受控制的 `/goal`。

## 8.1 Goal 與長期記憶的分工

Codex `/goal` 管理目前 Session 的持續目標。

LLM Wiki 負責跨 Session 的歷史、進度、決策與工作交接。

Task Contract 負責可機器讀取的當前任務。

Git 負責程式及文件版本。

Session Log 負責單次執行的追溯。

這些系統需要互相連結，但不能彼此取代。

---

# 9. Muse Prompt Templates

請在專案中建立並驗證可重用的 Muse 提示詞模板。

至少需要：

## A. Feature Implementation Prompt

輸入 Task Contract、相關檔案、Architecture Rules 和 Acceptance Criteria。

要求 Muse 完成特定功能，限制修改範圍，並回傳 ImplementationResult。

## B. Bug Fix Prompt

提供：

- Reproduction Steps
- Failing Test
- Expected Behavior
- Actual Behavior
- Suspected Modules
- Allowed Files

要求 Muse 找出原因並執行最小必要修復。

## C. UI Implementation Prompt

自動加入：

- Design System
- Emil Kowalski Skills
- Workspace UX Spec
- Component Conventions
- Accessibility
- Animation Performance
- Visual Acceptance Criteria

不得加入無必要的引導文字或與現有視覺系統衝突的元件。

## D. Acoustic Solver Prompt

加入：

- Mathematical Model
- Units
- Assumptions
- Reference Papers
- Numerical Tolerances
- Benchmark Fixtures

Muse 必須依照指定數學契約實作，不能自行虛構新公式或物理係數。

## E. Physics Interaction Prompt

加入：

- Rapier API References
- RigidBody States
- Coordinate System
- Physics Step Policy
- Grab / Joint Model
- Collision Event Contract
- Performance Requirements

## F. Repair Prompt

只處理 Codex 驗證報告中的具體問題。

要求保留已通過的測試與行為。

## G. Completion / Handoff Prompt

輸出 Task ID、修改檔案、已執行測試、未完成事項和下一步。

所有模板需要版本化，並附上實際適用的任務情境。

不要把一份巨大、完全相同的 System Prompt 套用到所有工作。

---

# 10. Model Routing & Inference Optimization

根據研究與實際 Eval，建立適合 Reflection Lab 的 Model Routing Policy。

初步候選：

- Muse Spark 1.3：一般程式實作、短工具循環及產品內常規 Agent。
- Muse Wonder：複雜架構、多檔案修改與困難推理。
- Muse Image：真正需要生成或編輯圖片時使用。
- Muse Spark Open / Glimmer：存在合適部署需求與硬體條件時再評估。

具體採用何種模型，以官方可用性、實際模型評測及使用成本為準。

不要因模型較大，就自動將全部工作分派給它。

## 10.1 Reasoning Effort

研究各模型正式支援的 Reasoning Effort。

比較不同設定對以下工作的影響：

- UI Implementation。
- Math / DSP。
- Multi-file Refactoring。
- Tool Calling。
- Error Recovery。
- Scene Planning。

不同模型的 Reasoning 參數可能不同。

不得將 Muse Spark Open 的推論設定原封不動套用到 Muse Code CLI 或託管的 Muse Wonder。

## 10.2 Prompt Efficiency

研究及採用：

- Stable Prompt Prefix。
- Minimal Relevant Context。
- Reusable Task Templates。
- Prompt Caching。
- Selective Wiki Retrieval。
- Appropriate Reasoning Effort。
- Tool Call Budget。
- Bounded Retry。
- Structured Output。

在支援的 API 中記錄 Cached Tokens、Input / Output Tokens、Latency、Errors 和 Estimated Cost。

不可以為了使用完整 Context Window，就在每次請求中塞入整個 Wiki。

## 10.3 Security & Billing

區分 Muse Code 訂閱制、Meta Model API 隨用隨付及黑客松提供的 API Credits。

不要預設這些額度可以互相抵扣。

對 Headless Muse Code 預設使用 Standard / Contributor Off，除非使用者明確決定其他資料使用方式。

確認 Muse Code CLI 的設定和 API 所選模型是否真正對應到預期資料使用模式。

不可將 API Key、私人檔案或敏感資料寫入 Prompt Log、Repository 或測試輸出。

建立：

- Token / Cost Budget。
- Timeout。
- Model Step Budget。
- Retry Limit。
- Rate-limit Handling。
- Backoff Policy。
- Secret Redaction。
- Audit Logging。

---

# 11. Reflection Lab Runtime — AI Experiment Agent

除了 Coding Harness，還需要研究產品內的 Muse Runtime Prompt。

核心目標：

**讓 Meta AI 在可重現的 3D 聲學實驗環境中，安全且有效地操作實驗。**

建立以下流程：

`Understand → Plan → Validate → Preview → Execute → Observe → Evaluate → Report`

## 11.1 Scene Planning

使用者輸入自然語言，Muse 產生符合 Schema 的場景修改計畫。

例如：

「建立一間木地板、混凝土牆的房間，放入一顆無重力的金屬球，讓它持續發出 1 kHz 測試音。」

AI 應產生結構化 Scene Operations。

不得直接修改未驗證的 Scene State。

## 11.2 Tool Calling

研究並設計：

- CreateObject
- SetTransform
- SetMaterial
- ConfigureRigidBody
- ConfigureAudioSource
- MoveListener
- SetTrajectory
- RunSimulation
- CaptureExperiment
- GetAcousticMetrics
- CompareExperiments
- GenerateExperimentReport

每個工具需要：

- JSON Schema。
- Argument Validation。
- Error Result。
- Domain Constraints。
- Resource Limits。
- Audit Trail。

可以使用 Structured Outputs 或 Tool Calling，但必須依實際目的選擇。

Structured Output 適合產生明確的資料物件。

Tool Calling 適合執行需要呼叫程式的操作。

不可僅使用 Prompt 文字要求輸出 JSON，就把結果當成已完成結構驗證。

## 11.3 Deterministic Solver Boundary

Muse 不可以自行生成 RT60、Reflection Delay、Sound Pressure 或其他實驗數據，然後將其視為真實求解結果。

所有數值由 Acoustic Core、Physics Runtime 或 Measurement Pipeline 提供。

Muse 可以：

- 提出假設。
- 設計測試。
- 修改參數。
- 執行工具。
- 比較實驗。
- 解釋結果。

但必須將 AI 推論與確定性計算分開。

## 11.4 Runtime Agent Safety

需要限制：

- Maximum Tool Calls。
- Maximum Simulation Runs。
- Maximum Objects。
- Scene Dimensions。
- Valid Material IDs。
- Computational Budget。
- Scene Revision。
- Cancellation。
- Undo / Rollback。

對會改變既有場景或大量消耗運算資源的操作，建立預覽及適當的使用者確認流程。

禁止產品內 Agent 執行任意作業系統命令。

## 11.5 Runtime Prompt Evaluation

建立測試情境：

1. 正常建立聲學場景。
2. 正確指定物件物理狀態。
3. 修改牆面吸音材料。
4. 比較兩組 Experiment。
5. 遇到未知材料時正確回報。
6. 遇到超出場景限制的要求。
7. 求解器回傳錯誤。
8. 使用者中途取消。
9. 模型回傳不合法參數。
10. 根據既有結果提出最佳化方案。

驗證 Tool Call 正確性、完成率、延遲、錯誤處理及可重現性。

---

# 12. LLM Wiki & AGENTS.md Integration

請將新的 Multi-Agent 開發模式整合至既有長期 Wiki。

不要重新建立第二套 Wiki。

至少更新或新增以下知識：

- Muse Model Capabilities。
- Prompt Engineering Research。
- Model Routing Decisions。
- Coding Agent Responsibilities。
- Headless Integration。
- Task Contracts。
- Development Verification。
- Agent Failure Recovery。
- Prompt Evaluation Results。
- Model Cost / Latency Benchmarks。
- AI Experiment Agent Architecture。
- Agent Run History。

所有重要結論需要對應來源、版本及測試證據。

## 12.1 AGENTS.md

在原有 AGENTS.md 中增加精簡的開發責任規範：

**Codex is the Engineering Orchestrator and Independent Verifier.**

**Muse Code is the Preferred Implementation Agent.**

**Meta Model API powers the product's AI Experiment Agent.**

另外指向正式的：

- Task Contract。
- Orchestration Workflow。
- Prompt Templates。
- Validation Commands。
- Wiki Startup / Handoff Protocol。
- Model Routing Guide。

不要把整套開發操作手冊直接貼進 AGENTS.md。

## 12.2 Skills

評估建立：

- `muse-implementation`
- `codex-verification`
- `muse-prompt-optimization`
- `agent-orchestration`
- `meta-experiment-agent`

Skills 需包含清楚的觸發條件、輸入、操作步驟、完成條件及失敗處理。

檢查 Muse Code 是否能載入 Repository 內 `.agents/skills/` 的 Skills，並實際執行可行的 Skill Validation。

保留原本的 Acoustic Research、Physics Interaction、UI/UX 和 Emil Kowalski Design Skills。

避免重複建立已有的能力。

---

# 13. Repository Deliverables

依照目前專案結構調整，不要強行重建或搬移既有目錄。

建議新增或更新：

`docs/09-agents/`

- `MULTI_AGENT_ARCHITECTURE.md`
- `CODEX_MUSE_ORCHESTRATION.md`
- `MUSE_MODEL_RESEARCH.md`
- `MUSE_PROMPT_ENGINEERING.md`
- `MODEL_ROUTING.md`
- `HEADLESS_EXECUTION.md`
- `VALIDATION_POLICY.md`
- `AGENT_SECURITY.md`
- `FAILURE_RECOVERY.md`

`prompts/muse/`

- `implementation.md`
- `bugfix.md`
- `ui-implementation.md`
- `acoustic-solver.md`
- `physics-interaction.md`
- `repair.md`
- `handoff.md`

`prompts/runtime/`

- `scene-planner.md`
- `experiment-agent.md`
- `acoustic-analysis.md`

`schemas/agents/`

- `task.schema.json`
- `implementation-result.schema.json`
- `verification-result.schema.json`
- `repair-task.schema.json`

`scripts/agents/`

- `run-muse`
- `verify-task`
- `run-milestone`
- `agent-status`

上述 Script 名稱為概念性的功能要求；實際副檔名、語言和命令請依現有技術環境決定。

`tests/agents/`

- Headless Smoke Test。
- Task Contract Validation。
- JSONL Event Parsing。
- Timeout / Cancellation。
- Verification Gate。
- Retry Limit。
- Workspace Isolation。
- Handoff Recovery。

`benchmarks/muse/`

- Prompt Fixtures。
- Evaluation Configuration。
- Model Comparison。
- Results。

所有執行指令必須記錄在 README 或相應文件。

如果使用者沒有安裝 Muse Code 或缺少認證，仍應完成可離線驗證的架構、Mock Runner 與測試，並準確記錄尚未完成的 Live Validation。

---

# 14. Engineering Acceptance Gates

在宣告本階段完成前，必須檢查：

## Gate A — Research

Muse 模型、CLI、Prompt、API、資料使用與定價限制已查核。

重要結論有官方來源。

## Gate B — Headless

能夠啟動一項 Muse Headless Task。

能取得執行紀錄並辨識成功、失敗和取消。

## Gate C — Task Contract

Codex 能產生合法任務。

Muse 能讀取任務並產出實作結果。

## Gate D — Independent Verification

Codex 能獨立執行測試。

即使 Muse 回報成功，只要驗證未通過，任務仍不得標記為 DONE。

## Gate E — Repair Loop

可以將失敗轉換為具體 RepairTask。

重試具有有限次數，不會無限循環。

## Gate F — Repository Safety

工作區隔離、Git Diff、Secret Protection 和 Sandbox Policy 可正常執行。

## Gate G — Runtime AI

產品內 Meta AI Agent 的工具契約、Prompt 與測試情境已建立。

## Gate H — Long-term Memory

LLM Wiki 記錄模型研究、架構決策、已完成工作及下一階段任務。

## Gate I — Cross-Agent Handoff

一個新的 Codex Session 可以讀取 Wiki、執行 Runner、指派 Muse Code 並繼續尚未完成的工作。

每個 Gate 標記：

`PASS / PARTIAL / FAIL / BLOCKED / NOT RUN`

並附上實際的測試命令和結果。

不得將未執行的 Live Test 標記為 PASS。

---

# 15. Implementation Order

本次任務請採以下順序執行。

**Stage 1 — Audit**

盤點 Repository、現有 Agent Harness、Wiki、Muse CLI、Codex 與正式規格。

**Stage 2 — Research**

完成 Muse Model、Prompt Engineering、Headless、SDK 和安全性研究。

**Stage 3 — Architecture Revision**

更新 ADR、模型選型與 Codex/Muse 分工。

**Stage 4 — Orchestration Foundation**

建立 Task Contract、Prompt Templates、Headless Runner 和基本驗證機制。

**Stage 5 — Smoke Tests**

執行隔離的 Muse Headless 任務，驗證 JSONL、程式修改和獨立測試。

**Stage 6 — Integration**

接入 Wiki、Skills、AGENTS.md、Task Status 和 Handoff。

**Stage 7 — Product Agent Design**

完成 Reflection Lab Meta AI Experiment Agent 的 Runtime Contracts、Prompt、模型策略與測試基礎。

**Stage 8 — Validation**

完整檢查本階段的所有 Quality Gates。

如果某階段遇到無法解除的阻礙，記錄其原因並繼續完成其他獨立任務。

---

# 16. Final Deliverables & Completion

完成後，請提供：

1. 實際採用的 Codex × Muse Code 開發架構。
2. Muse 家族模型研究與適用工作分類。
3. Muse Prompt Engineering Guide。
4. Headless CLI / SDK 的實際可行性。
5. 已建立的 Task Contract 和 Orchestrator。
6. 完成驗證的 Prompt Templates。
7. Codex 獨立驗證及 Repair Loop。
8. Model Routing、Cost、Security Policy。
9. Reflection Lab Runtime Meta Agent 規格。
10. 更新後的 AGENTS.md、Skills 和 LLM Wiki。
11. 實際建立或修改的檔案清單。
12. 真正執行的測試、結果和未完成限制。
13. 下一個正式開發 Milestone 的可執行 Task Contract。

請在最後提供兩個實際使用範例：

**Example A — Codex Goal**

如何讓 Codex 啟動一個可持續驗證的 Milestone，並主要委派 Muse Code 執行。

**Example B — Direct Headless Muse Task**

如何使用已建立的 Script 和 Task Contract，直接讓 Muse Code 在隔離工作區中實作指定功能，最後由 Codex 驗證。

這兩個範例必須使用實際建立且在目前環境可用的命令，不得僅使用想像中的 CLI 語法。

---

## 最終執行要求

立即從 Repository Audit 開始。

請在符合既有架構與安全限制的情況下，自主完成所有研究、文件調整、Runner、Prompt Templates、Skills、Schema 和驗證基礎的實作。

本階段不要啟動整個 Reflection Lab 產品的完整開發。

真正的產品 Milestone 應在這套 Harness 通過基本驗證後，再逐項交付 Muse Code 實作。

所有重要決策與執行結果，必須同步寫入 LLM Wiki。

**最終目標：讓 Reflection Lab 擁有一套以 Codex 管理目標與品質、Muse Code 主導程式實作、Meta AI 執行產品內聲學實驗，並由長期 Wiki 保存完整知識與開發歷史的可持續 AI Development System。**

現在直接開始工作，不要只停留在研究提案。