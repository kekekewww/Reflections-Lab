# Reflection Lab — Comprehensive Research, Architecture Refinement & Git Worktree Integration

## 0. Mission & Execution Contract

你現在是 Reflection Lab 專案的 Principal Software Architect、Computational Acoustics Researcher、Audio DSP Engineer、Physics Systems Architect、Cloud Infrastructure Architect 與 Independent Quality Assurance Lead。

目前 Reflection Lab 第一版已經開始開發。

本次任務需要在**不干擾既有開發工作的前提下**，建立完整且獨立的 Git Worktree，在其中進行全面研究、技術架構審查、合理的架構微調、測試及文件更新。

完成後，必須與原本正在開發的分支比較，確認差異及相容性，通過驗證後才合併回原始分支。

最終將整合完成的專案推送至：

https://github.com/kekekewww/Reflections-Lab.git

這是明確授權的最終 Git Push 目標。

**本任務要求實際執行研究、檔案修改、Worktree 管理、測試、合併與 Push，而非單純輸出計畫。**

### 核心要求

1. 保留目前第一版所有已完成的程式碼與歷史。
2. 不得中斷、重置、覆蓋或破壞原始工作區。
3. 所有研究與架構調整優先在獨立 Worktree 進行。
4. 優先保留既有架構，避免不必要的全面重構。
5. 所有重大技術決策必須具有研究或測試證據。
6. 先完成研究及最小必要架構調整，再進行差異分析。
7. 合併前必須通過適當的測試及 Regression Gates。
8. 合併時必須考慮原始分支在研究期間的新進度。
9. 合併成功後推送至指定 GitHub Repository。
10. 全程維護 LLM Wiki、ADR、Task Records 與 Agent Handoff。

可以使用 Subagents 執行獨立研究，但主代理必須負責整合與驗證。

專案文件使用繁體中文（台灣）；程式碼、API 和必要的專有名詞維持英文。

---

# 1. Phase A — Repository Preflight & Baseline Protection

開始研究之前，必須先檢查真正的本地 Repository。

執行適用的 Git Read-only Commands：

```bash
git rev-parse --show-toplevel
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
git worktree list
git log -5 --oneline
```

確認：

- 目前 Git Repository Root。
- 正在開發的原始分支。
- HEAD Commit。
- 是否存在未提交修改。
- 是否存在 Untracked Files。
- 是否已有其他 Worktrees。
- 目前 Remote 的實際網址。
- Repository 是否已有 Commits。
- 第一版目前可執行的 Build / Test Commands。

## 1.1 GitHub Remote

目標 Repository：

`kekekewww/Reflections-Lab`

已知 GitHub Repository 目前為 Public、預設分支為 `main`，而且在本次任務提出時尚無 Commit。

請重新檢查遠端狀態。

不要假設遠端仍然是空的，也不要假設本地 `origin` 已經指向正確的 Repository。

如果本地 `origin` 指向其他 Repository，不得直接覆寫它。

應建立另一個明確命名的 Remote，或採取同樣安全且可追溯的方式，將成果推送到指定目標。

## 1.2 Baseline Snapshot

在 Worktree 建立前，保存：

- Original Branch Name。
- Original HEAD SHA。
- Current Working Tree Status。
- Current Architecture Summary。
- Existing Feature Status。
- Existing Test Results。
- Current LLM Wiki State。

不得擅自執行：

- `git reset --hard`
- `git clean -fd`
- Force Push
- 不受控的 Git Stash
- 覆寫未提交變更
- 刪除既有 Branch
- 重建整個 Repository

如果原始工作區有未提交修改，必須明確區分已提交 Baseline 與未提交中的工作。

Git Worktree 不會自動包含另一個工作區的未提交或未追蹤檔案。

不能把未提交的第一版進度當作不存在。

如果尚無任何 Git Commit，先檢查敏感資料與 Git Ignore，再安全建立第一個可追溯的 Baseline Commit；不得任意將所有檔案加入版本控制。

如果無法安全建立 Baseline，保留現況並標記阻礙，不得強行進入合併與推送程序。

---

# 2. Phase B — Create Isolated Research Worktree

使用 Git Worktree，而不是建立另一個獨立 GitHub Fork。

目標是共享既有 Git Repository 的歷史與物件資料庫，同時建立完全分離的工作目錄、分支及檔案修改環境。

建議命名：

- Branch：`research/architecture-review-20261029`
- Worktree：`../Reflections-Lab-research`

如果名稱已存在，使用唯一且不衝突的名稱，禁止使用 `-B` 重置現有分支。

範例：

```bash
git worktree add \
  -b research/architecture-review-20261029 \
  ../Reflections-Lab-research \
  <ORIGINAL_BASE_SHA>
```

`<ORIGINAL_BASE_SHA>` 必須由實際 Repository 取得。

建立後確認：

```bash
git worktree list
git status
git branch --show-current
git rev-parse HEAD
```

確保：

1. 新 Worktree 包含 Baseline Commit 所追蹤的完整專案檔案。
2. 原始工作區仍保持原本的分支與修改。
3. 所有研究及程式調整只發生在 Research Worktree。
4. 兩個 Worktree 不共用需要修改的 Build Output 或本機狀態。
5. 依賴安裝及環境設定不能破壞原始開發環境。
6. 不將 Worktree 放進原 Repository 中造成遞迴檔案污染。

本次研究工作全部在新的 Worktree Root 中執行。

在合併階段之前，不直接修改原始工作區。

---

# 3. Phase C — Complete Project Audit

請完整盤點第一版實際已完成的功能。

不要依照先前討論推測現有程式狀態。

檢查：

- React / TypeScript。
- Three.js / React Three Fiber。
- Rapier 3D。
- Web Audio / AudioWorklet。
- Acoustic Core。
- Physics Runtime。
- Scene Editor。
- First-Person Simulation。
- Sound Behavior System。
- Motion Authoring。
- Recorder / Playback。
- Render / Export。
- Meta Model API。
- AGENTS.md / Skills。
- LLM Wiki。
- Testing / Benchmark。
- Deployment Configuration。

對每項能力標記：

`IMPLEMENTED / PARTIAL / PLANNED / EXPERIMENTAL / BLOCKED / UNVERIFIED`

並且記錄：

- 相關程式路徑。
- 實際運作流程。
- 依賴關係。
- 測試覆蓋率。
- 已知問題。
- 研究或重構需求。

特別檢查是否存在只有文件、沒有真正程式實作的功能。

建立 Architecture Gap Analysis。

本次工作應該優先補足架構契約及未來擴充能力，不得因為重新研究而推翻已經運作正常的第一版。

---

# 4. Phase D — Scientific & Engineering Research

進行完整的技術研究，並整合既有研究成果。

不要重複蒐集已經查核過且仍然有效的相同資料。

優先查閱：

- 官方文件。
- Peer-reviewed Research。
- IEEE / AES / JASA。
- ITU / EBU / ISO。
- 官方 SDK。
- 有測試與維護的開源專案。
- 可重現 Benchmark。
- 最新穩定版 API Reference。

每項重要結論必須區分：

- Verified Fact。
- Analytical Result。
- Engineering Estimate。
- Model Approximation。
- Proposed Design。
- Unverified Assumption。

## D1. 3D Physics & Interaction

研究 Rapier 3D：

https://rapier.rs/

範圍包括：

- Dynamic / Fixed / Kinematic RigidBodies。
- Gravity Scale。
- Physics Fixed Step。
- Collision / Contact Events。
- Raycast。
- Character Controller。
- Physics-based Grab。
- Move / Drop / Throw。
- Spring / Joint / Impulse。
- Continuous Collision Detection。
- Dynamic Object States。
- Deterministic Recording。

目標是支援第一人稱及第三人稱互動。

兩種視角必須使用相同的 Physics Runtime 和 Scene State。

## D2. Motion Authoring

研究並設計：

**Move To**

物件依指定位置、方向、速度及曲線移動，抵達目標後停止或進入 Hold State。

**Move & Release**

物件沿指定路徑受控移動，抵達目標後解除控制，轉為 Dynamic RigidBody，保留設定的釋放速度及角速度，繼續受到物理引擎影響。

**Apply Impulse**

物件直接受到衝量，根據物理模擬自然運動，不保證到達指定位置。

研究：

- Motion Curve Presets。
- Linear / Ease In / Ease Out / Ease In-Out。
- Velocity / Acceleration。
- Release Velocity。
- Dynamic / Kinematic Transitions。
- Motion Timeline。
- Motion State Recording。
- Motion Gizmo。
- First-person / Third-person Controls。

特別確認受控移動與真實物理運動之間的轉換不會造成穿牆、速度跳變或不合理的碰撞。

## D3. Sound Behavior System

研究物件如何在不同狀態產生可編輯的音效。

事件至少包含：

- Always On。
- On Grab。
- On Release。
- On Throw。
- On Drop。
- While Moving。
- While Airborne。
- On Impact。
- On Bounce。
- While Rolling。
- While Sliding。
- On Motion Start / End。

研究：

- Event Trigger。
- State Machine。
- Parameter Mapping。
- Material Pair。
- Collision Impulse。
- Sample Playback。
- Procedural Sound。
- Gain / Pitch / Filter Automation。
- Event Cooldown。
- Voice Management。
- Audio Source Position。
- Sound Behavior Presets。

參考：

https://www.fmod.com/docs/

https://www.audiokinetic.com/

https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine

聲音生成與物理運動需要分離。

使用者可以將碰撞音效改為鋼琴、電子音或其他創意聲音，但其空間傳播仍應遵守指定的聲學模型。

## D4. Custom Acoustic Core

維持自行開發的 Web-native Acoustic Core。

研究：

- Image Source Method。
- Ray Intersection / Visibility。
- Direct Sound。
- First-order Reflection。
- Multi-order Reflection。
- Reflection Path Identity。
- Occlusion / Transmission。
- Frequency-dependent Materials。
- Atmospheric Absorption。
- Dynamic Source / Listener。
- Room Impulse Response。
- Early / Late Reflections。
- HRTF / Binaural Rendering。
- Propagation Delay。
- Numerical Stability。
- Time-varying Acoustic Parameters。

對重要數學模型建立獨立驗證。

特別檢查直達聲與反射聲的時間基準一致性、反射路徑的穩定身分，以及材質能量係數的定義。

Steam Audio 目前只作為可選 Backend、研究參考和獨立比較來源。

不得將 Steam Audio 視為必要依賴，也不需為了這次研究直接重寫現有聲學核心。

## D5. Sound Recording & Performance Timeline

研究完整的 Scene Performance Recording。

錄製內容應包含：

- Initial Scene Snapshot。
- Object Motion Tracks。
- Physics States。
- Collision Events。
- Sound Behavior Events。
- Audio Asset References。
- Source Positions。
- Listener Position / Orientation。
- Material Configuration。
- Simulation Settings。
- Acoustic Backend Version。
- Timestamps / Sample Timeline。

設計統一時間契約。

需要處理：

- Fixed Physics Step。
- Audio Sample Time。
- Timeline Interpolation。
- Recording Start / Stop。
- Replay。
- Event Deduplication。
- Deterministic or Snapshot-based Playback。
- Experiment A/B。

錄製的權威資料不應只有一份 Stereo WAV。

應能在重新渲染時修改 Listener 或 HRTF，並輸出不同的聲學結果。

## D6. Offline Audio Rendering

研究：

- OfflineAudioContext。
- AudioWorklet。
- Long-duration Rendering。
- Chunked Processing。
- DSP State Continuity。
- HRTF Rendering。
- Reverb Tail。
- WAV Encoding。
- Memory Budget。
- Batch Rendering。
- Render Job Lifecycle。

輸出至少規劃：

**Binaural Mixdown**

所有聲源混合的雙耳 Stereo WAV。

**Individual Object Stems**

依物件獨立渲染，同時保留同一次實驗的物理互動及時間對齊。

**Selected Parallel Stems**

選取多個聲源個別輸出，避免其他物件的發聲內容混入。

**Dry / Wet Multitrack**

保留直接聲與空間處理的不同層次，以供 DAW 後製。

必須區分「聲源音訊隔離」與「物理世界隔離」。

即使只輸出一個物件，仍應保留原始錄製時其他物件對它造成的碰撞、遮蔽等物理影響。

對非線性總線處理，不能假設各 Stems 相加必然等於 Full Mix。

## D7. ADM / Object-based Audio

研究：

- ITU-R BS.2076。
- ADM。
- BW64。
- Audio Objects。
- Object Position Metadata。
- Audio Track UID。
- Timeline / Coordinate Conversion。
- Bed / Objects。
- EBU libadm / libbw64。
- Dolby Atmos Compatibility。

參考：

https://www.itu.int/rec/R-REC-BS.2076/en

https://github.com/ebu/libadm

https://github.com/ebu/libbw64

區分一般 ADM BWF 與 Dolby Atmos 特定交付要求。

正式 ADM 匯出可列入後續 Milestone，但應預先保留相容的資料契約。

---

# 5. Phase E — Browser Performance & Cloud Architecture

這是本次新增的高優先級研究。

目前產品預計以 Web-first 形式開發，未來部署至雲端供多人使用。

核心問題：

**在大量使用者同時使用時，如何避免雲端伺服器承擔每個人的完整 3D 物理、聲學及即時音訊運算？**

## E1. Preferred Architecture

初步架構：

**Client-side**

- React / Three.js。
- Rapier Physics。
- Custom Acoustic Worker。
- Web Audio / AudioWorklet。
- Sound Behavior Runtime。
- Motion Authoring。
- Scene Performance Recorder。
- Local Offline Renderer。

**Cloud-side**

- Static Hosting / CDN。
- Authentication。
- Project Metadata Database。
- Asset Storage。
- Meta Model API Proxy。
- AI Quota / Rate Limiting。
- Optional Render Queue。
- Optional Autoscaling Render Workers。

這是候選架構，需要研究驗證，不是可以不經檢查就直接實作的最終決策。

## E2. Client Runtime

研究：

- Main Thread。
- Web Workers。
- AudioWorklet。
- WebAssembly。
- SharedArrayBuffer。
- Cross-Origin Isolation。
- Message Passing。
- Memory Transfer。
- Physics / Acoustic Update Frequencies。
- Browser Audio Scheduling。
- Background Tab Throttling。
- Browser Memory Limits。
- OPFS / IndexedDB。

重點分析：

1. 3D Rendering 是否可能阻塞 Physics？
2. Acoustic Solver 是否應完全移至 Worker？
3. 是否有必要把 Physics 也移至 Worker？
4. Web Audio DSP 是否能維持即時運算？
5. 動態聲源數量增加時如何限制反射成本？
6. 大量音效事件如何管理？
7. Record / Replay 如何避免依賴 Render Frame Rate？
8. 大型離線渲染如何避免一次占用所有 RAM？

## E3. Cloud Infrastructure

至少比較：

- Vercel。
- Cloudflare Pages / Workers / R2。
- Supabase / PostgreSQL。
- Google Cloud Run Jobs。
- Container-based Render Workers。
- Object Storage。
- Render Queue。

請根據官方最新定價、資源限制與技術能力評估。

考慮：

- 100 Concurrent Users。
- 1,000 Concurrent Users。
- 10,000 Concurrent Users。
- AI Requests / Minute。
- Project Save Frequency。
- Audio Asset Upload。
- Render Job Concurrency。
- WAV / Stem Download。
- Storage Retention。
- Bandwidth / Egress。
- CPU / Memory Requirements。

需要分別估計：

- Low-load。
- Expected-load。
- High-load。

成本模型必須顯示假設、單位與計算方法。

不得在沒有實測或使用模型的情況下保證同時在線人數。

## E4. Local-first Rendering

優先評估：

**Browser Local Render**

用戶端進行短時間 Binaural / Stems 渲染。

**Optional Cloud Render**

用於未來高品質、長時間或大量 Stems 輸出。

雲端渲染不能被設計成 MVP 的必要依賴。

建立可替換的 Render Backend 契約。

考慮瀏覽器 Web Audio 與未來 Native / Server DSP 的相容性，不得假設 Browser-only API 能在 Node.js 直接執行。

## E5. Performance Budgets

研究並建立可調整的初始效能目標：

- Desktop 3D：60 FPS Target。
- Physics：Fixed 60 Hz Target。
- Active Dynamic Bodies：8–16。
- Active Audio Sources：4–8。
- Early Reflection Budget：由能量、感知重要性及效能決定。
- Acoustic Updates：初步評估 10–20 Hz。
- Audio：48 kHz Stereo。
- Event Voices：適當限制並支援 Voice Stealing。
- Local Recording：先驗證 1–3 分鐘。
- Offline Render：Full Mix + Independent Stems。

以上只是待驗證的工程目標。

必須透過 Benchmark 確認實際可行性。

記錄：

- FPS / Frame Time。
- Physics Step p95 / p99。
- Acoustic Solver p95 / p99。
- Audio Glitches / Dropouts。
- Memory Peak。
- Render Time。
- File Size。
- Long Task。
- Main Thread Blocking。
- Browser Compatibility。

至少設計正常筆電與高階開發機兩種測試環境。

---

# 6. Phase F — UI/UX & Interaction Architecture

完整研究目前已建立的 UI。

參考：

- Unity Editor。
- Blender。
- Sound Particles。
- FMOD Studio。
- Wwise Spatial Audio。
- Treble。
- ODEON。
- Garry's Mod。

設計工程規範：

https://github.com/emilkowalski/skills

先閱讀目前已安裝的 Skills 和 Design System，不要無條件重新安裝或覆蓋。

核心 Workspaces：

1. Scene Editor。
2. Simulation。
3. Acoustic Analysis。
4. Render & Export。

第一人稱與第三人稱應共用：

- Object Selection。
- Motion Actions。
- Physics State。
- Sound Behavior。
- Recording Commands。

研究並微調：

- Scene Explorer。
- 3D Viewport。
- Contextual Inspector。
- Motion Gizmo。
- Motion Curves。
- First-person HUD。
- Sound Behavior Inspector。
- Timeline。
- Acoustic Path Inspector。
- Render Dialog。
- AI Command Palette。

目標是減少冗餘操作與重複狀態。

不需要在本次研究中重製整個 UI。

只有目前架構存在會阻礙後續擴充的問題時，才進行小範圍修改。

---

# 7. Phase G — Meta Muse Agent Runtime

再次確認 Meta Global AI Developer Hackathon 的正式規則與 Meta Model API 文件。

本專案正式策略：

**Codex 負責程式開發；Meta Muse Agent 負責 Reflection Lab 產品內的 AI 功能。**

Muse Code 不是必要的開發代理。

先前的 Muse Code Headless Orchestration、Quota Failover 等研究可以保留，但應重新分類為 Optional / Superseded。

不得將 Muse Code 開發工作視為作品內 Meta AI 的整合成果。

## G1. Muse Agent Capabilities

研究：

- Scene Generation。
- Object Creation。
- Material Assignment。
- Physics Configuration。
- Motion Authoring。
- Sound Behavior Authoring。
- Experiment Planning。
- Simulation Tool Calling。
- Acoustic Result Analysis。
- Render Job Configuration。

使用 Meta Model API 的 Tool Calling 與 Structured Outputs。

研究最新可用的 Muse 模型、Model IDs、延遲、成本與 Prompt Design。

## G2. Agent Tool Contract

至少評估：

- CreateScene
- AddObject
- SetMaterial
- SetRigidBodyMode
- CreateMotionAction
- ConfigureSoundBehavior
- SetListener
- StartRecording
- RunSimulation
- CaptureExperiment
- AnalyzeAcoustics
- CompareExperiments
- CreateRenderJob

所有工具必須有 Schema Validation、權限限制、資源預算及可撤銷的狀態管理。

AI 不得自行虛構聲學實驗數值。

聲學和物理結果必須由確定性 Runtime 計算。

## G3. Meta API Security

所有 API Keys 必須存放在安全的 Server-side Environment。

不能將 Meta Model API Secret 直接暴露於瀏覽器 Bundle。

建立：

- Authentication。
- Rate Limiting。
- Request Validation。
- Usage Quota。
- Retry / Timeout。
- Error Handling。
- Spending Limits。
- Mock / Offline Test Mode。

如果 Muse API 不可用，手動編輯和物理模擬仍應正常運作。

---

# 8. Phase H — LLM Wiki & Durable Project Knowledge

參考：

https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

繼續使用現有 LLM Wiki。

不得重建另一套長期記憶系統。

研究及架構變更需要更新：

- Current State。
- Project Goals。
- Feature Status。
- Technical Decisions。
- Research Evidence。
- Experiment Results。
- Performance Findings。
- Architecture Limitations。
- Roadmap。
- Task Backlog。
- Agent Handoffs。

## H1. Worktree-aware Memory

特別注意：

不同 Git Worktrees 共享 Git Repository，但具有不同的工作檔案和分支狀態。

因此 Wiki 需要記錄：

- Worktree Name / Path。
- Research Branch。
- Original Branch。
- Baseline Commit。
- Research Commits。
- Merged Commit。
- GitHub Remote。
- Integration Status。

不要讓研究 Worktree 中的暫時結論直接覆蓋原始分支正在使用的正式決策。

所有新 ADR 應先在研究分支建立。

正式合併後才成為整合分支的有效決策。

## H2. Documentation Rules

維持唯一 Source of Truth。

研究文件不應重複產生不同版本的正式 Architecture。

若已有文件，優先更新原檔，並保留必要的版本及歷史紀錄。

文件引用及 Wiki 連結需要通過 Lint。

---

# 9. Phase I — Architecture Refinement

研究完成後，檢查現有架構是否需要微調。

重點關注：

1. Scene Document / Runtime State Separation。
2. Physics Runtime Boundaries。
3. Motion Authoring Contract。
4. Sound Behavior Event Contract。
5. Custom Acoustic Backend Interface。
6. Audio DSP / Source Graph。
7. Experiment Recording Schema。
8. Render Job / Export Backend。
9. Browser Worker Architecture。
10. Cloud-ready API Boundaries。
11. Muse Agent Tool Schema。
12. Project Persistence / Versioning。

## I1. Change Classification

將所有修改分成：

**Category A — Documentation Only**

研究、架構圖、ADR、Benchmark、Roadmap、API Contract。

**Category B — Non-breaking Architectural Adjustments**

新增 Interface、Adapter、Schema、Feature Flag、測試工具或少量相容性修正。

**Category C — Breaking Changes**

需修改既有資料格式、核心模組、Audio Runtime 或 Scene Lifecycle 的改動。

優先執行 A 和 B。

Category C 只有在證實目前架構無法滿足核心需求、具備完整 Migration Strategy，而且不會破壞第一版時才考慮。

不要因為存在更理想的架構，就全面重寫已運作的程式。

## I2. Technical Spikes

若有高風險且尚未確認的技術問題，可建立隔離的最小測試。

優先考慮：

- AudioWorklet / Worker Messaging。
- Dynamic Reflection Update。
- Motion Release State Transition。
- Multi-source OfflineAudioContext。
- WAV / Stems Export Memory。
- RecordedTake Replay。
- Cloud Render Backend Contract。

每項 Spike 必須有明確問題、限制、測試及結論。

不應將實驗性程式直接接入正式 Runtime，除非通過相關回歸測試。

---

# 10. Phase J — Research Deliverables & Implementation Planning

研究成果至少包含：

- `ARCHITECTURE_REVIEW.md`
- `ARCHITECTURE_GAP_ANALYSIS.md`
- `PHYSICS_AND_MOTION_RESEARCH.md`
- `SOUND_BEHAVIOR_RESEARCH.md`
- `CUSTOM_ACOUSTIC_CORE_RESEARCH.md`
- `RECORDING_AND_REPLAY_RESEARCH.md`
- `OFFLINE_RENDERING_RESEARCH.md`
- `ADM_EXPORT_RESEARCH.md`
- `BROWSER_PERFORMANCE_RESEARCH.md`
- `HYBRID_CLOUD_ARCHITECTURE.md`
- `CLOUD_COST_MODEL.md`
- `MUSE_AGENT_ARCHITECTURE.md`
- `UI_UX_REVIEW.md`
- `VALIDATION_PLAN.md`
- `INTEGRATION_REPORT.md`

以上為必要的內容領域，不要求每個主題都建立全新檔案。

請根據既有 Repository 文件位置，合理地更新、整合及引用，避免冗餘。

另外建立可執行的 Roadmap：

**P0 — Hackathon MVP**

維持目前可用的 3D Scene、Physics Interaction、聲源與核心聲學流程，優先完成 Demo 所需功能。

**P1 — Production Workflow**

Motion Authoring、Sound Behavior、Scene Recording、Binaural / Stems Export、Muse Agent。

**P2 — Advanced Acoustic & Export**

Advanced Reflections、ADM、Cloud Render、長時間渲染及更多研究功能。

優先級必須根據第一版實際進度、競賽截止時間和剩餘工程風險調整。

不能只因功能研究完成，就將全部功能列為本次競賽必做。

---

# 11. Phase K — Independent Verification

完成研究與架構微調後，在 Research Worktree 執行適當的驗證。

至少包含：

- Dependency Installation Check。
- Typecheck。
- Lint。
- Unit Tests。
- Integration Tests。
- Build。
- Regression Tests。
- Schema Validation。
- Wiki Lint。
- Git Diff Check。

若專案已有 Playwright 或 Browser E2E，必須執行。

對 UI 修改，需要實際檢查畫面與互動。

對聲學與物理修改，需要通過相關數學及數值測試。

對音訊輸出，需要檢查：

- Sample Rate。
- Duration。
- Channel Count。
- NaN / Infinite Samples。
- Clipping。
- Timeline Alignment。
- Stem Isolation。
- Render Tail。

對 Runtime Architecture 修改，需要確認：

- 原有第一版仍可以正常啟動。
- FPS / Physics 沒有回歸。
- Sound Behavior 沒有重複事件。
- 音訊播放沒有意外中斷。
- Recorder / Renderer 的資料契約相容。
- Meta Agent API 不會破壞手動操作。

不能因為 Build 成功就宣稱所有功能正確。

對於尚未實作的功能，標示 PLANNED，而非 PASS。

---

# 12. Phase L — Original Branch Comparison

這是整個任務最重要的整合階段之一。

**研究及修改完成後，不得立即合併。**

先取得：

- Original Baseline Commit。
- Current Original Branch HEAD。
- Research Branch HEAD。
- Merge Base。
- Original Branch 自研究開始後新增的 Commits。

特別注意：原始分支可能在研究期間持續開發。

必須比較當前原始分支，而不是只比較研究開始時的 Baseline。

使用適當的 Git Diff / Log Commands：

```bash
git log --graph --oneline --decorate --all
git diff --stat <BASE>..<RESEARCH_HEAD>
git diff --name-status <BASE>..<RESEARCH_HEAD>
git merge-base <ORIGINAL_BRANCH> <RESEARCH_BRANCH>
git diff <ORIGINAL_BRANCH>...<RESEARCH_BRANCH>
```

以上變數要由實際 Git 狀態取得。

另外需檢查兩個分支自 Merge Base 以來各自新增的變更，不可只依賴單一 Three-dot Diff 判斷全部差異。

## L1. Compatibility Review

對照：

- 第一版原有功能。
- Research Worktree 新增的文件。
- 新增的架構與 Schema。
- 修改的 Interface。
- Git Conflicts。
- Dependency Changes。
- Breaking Changes。
- Tests。
- AGENTS.md / Wiki。
- Current Roadmap。

產出：

**Original vs Research Architecture Comparison**

至少包含：

- Changed Files。
- New Files。
- Deleted Files。
- Behavior Changes。
- Architectural Decisions。
- Risk Assessment。
- Required Migration。
- Regression Impact。
- Merge Recommendation。

## L2. Merge Preparation

若原始分支持續向前開發，優先在研究 Worktree 將最新原始分支的變更整合進來，並處理實際衝突。

不得直接用舊研究結果覆蓋較新的第一版實作。

對於衝突：

- 逐一閱讀差異。
- 保留原有正確功能。
- 依據較新的有效需求與測試決定。
- 不要不加分析地全部採用 ours 或 theirs。
- 對無法判斷的衝突保留記錄，不得強行合併。

完成整合準備後重新執行測試。

---

# 13. Phase M — Merge Back to Original Branch

只有在以下條件通過後才允許合併：

1. Research Worktree 變更已完成。
2. Architecture Review 已完成。
3. Difference Report 已產生。
4. 必要 Regression Tests 已通過。
5. 沒有未解決的重大衝突。
6. 沒有未處理的敏感資料。
7. 原始分支目前的修改狀態允許安全合併。

請返回原始工作區，確認實際分支及工作狀態。

不得假設原始分支一定叫 `main`。

如果原始工作區有尚未提交的修改，不得自動覆寫或 Stash。

若已具備安全合併條件，使用可保留研究歷史的方式合併，例如：

```bash
git merge --no-ff <RESEARCH_BRANCH>
```

實際執行前確認目前所在分支就是正確的整合目標。

合併完成後必須再次執行：

- Typecheck。
- Lint。
- Unit / Integration Tests。
- Build。
- Relevant E2E。
- Wiki Validation。
- Smoke Tests。

如果合併後產生新的錯誤，先修復並重新驗證。

不得在測試失敗時直接推送。

完成後建立整合報告，記錄：

- 原始 Baseline SHA。
- Research Branch SHA。
- Merge Commit SHA。
- 合併檔案。
- 驗證結果。
- 仍然存在的限制。

不要自動刪除 Research Branch 或 Worktree。

保留至少到 GitHub Push 與遠端驗證成功。

---

# 14. Phase N — Security & GitHub Publication Review

最終 Push 之前必須執行完整的 Repository Publication Audit。

目標：

https://github.com/kekekewww/Reflections-Lab.git

此 Repository 是公開的。

因此必須檢查：

- `.env`
- API Keys
- Meta Model API Tokens
- GitHub Tokens
- Cloud Credentials
- Database Passwords
- Private Certificates
- 私人檔案
- 使用者敏感資料
- 付費或未授權音效
- 未經授權的研究 PDF
- SDK Binary
- 大型音訊渲染結果
- 本機 Cache
- `node_modules`
- Build Artifacts
- 未經授權的第三方素材

不只檢查目前檔案，也需要檢查即將推送的 Git History 是否包含敏感資訊。

禁止將 Secrets 推送至 Public Repository。

不要自行將私人憑證或大型研究素材加入 Git。

必要的第三方研究資料可以保存為：

- Source URL。
- Metadata。
- License。
- Version。
- Hash。
- Reproducible Download Script。

如發現敏感資料已提交到歷史中，不得忽略後繼續 Push；應先安全處理並記錄阻礙。

---

# 15. Phase O — Push to GitHub

在所有合併、測試及公開安全檢查通過後，執行 GitHub Push。

確認遠端實際對應：

`https://github.com/kekekewww/Reflections-Lab.git`

如果遠端仍是空 Repository，且本地 `main` 是確認過的正式整合分支，使用安全的首次 Push：

```bash
git push -u <TARGET_REMOTE> main
```

`<TARGET_REMOTE>` 必須由實際設定確認。

如果本地正式開發分支不是 `main`，先查明它與最終發布 `main` 的關係，不得在沒有檢查的情況下把錯誤分支發布成正式主分支。

若遠端已存在 Commits：

1. 先 Fetch。
2. 比較 Remote 和 Local。
3. 檢查是否為 Fast-forward。
4. 保留遠端已有歷史。
5. 必要時使用安全 Merge 或 Pull Request 流程。
6. 不得 Force Push。

若存在 Branch Protection 或 Required Checks，遵守 Repository 設定，透過 PR 與必要驗證完成整合。

**本次目標是實際完成推送，不是只產生一段 Push 指令。**

但如果遇到認證、Branch Protection、無法安全解決的歷史衝突或敏感資料問題，不得繞過保護。

需保留完成的本地成果，並清楚回報具體阻礙。

## O1. Remote Verification

Push 成功後必須確認：

- GitHub Repository 可以存取。
- 正式整合分支已上傳。
- Remote HEAD 與預期 Local Commit 一致。
- README 正常顯示。
- AGENTS.md 已存在。
- LLM Wiki / Project Docs 已存在。
- 新增的研究文件已上傳。
- Architecture / Schema / Tests 已上傳。
- `.gitignore` 正常。
- 未推送敏感資料。
- GitHub Actions / CI（若有）狀態正常。

回報正式 Commit SHA、Branch 和 GitHub URL。

必要時保留研究分支以供後續審查，但不得推送未審查的私人資料或大型暫存檔。

---

# 16. Final Acceptance Gates

本次任務需通過以下階段：

| Gate | Requirement |
|---|---|
| G0 | 原始 Repository 完整盤點 |
| G1 | 獨立 Research Worktree 建立成功 |
| G2 | 原始工作區未受破壞 |
| G3 | 技術研究與證據整理完成 |
| G4 | Browser / Cloud Architecture 評估完成 |
| G5 | 必要架構微調完成 |
| G6 | Research Worktree 驗證通過 |
| G7 | 與最新原始分支完成差異審查 |
| G8 | 安全合併及整合測試通過 |
| G9 | Public Repository 安全檢查通過 |
| G10 | GitHub Push 成功 |
| G11 | 遠端 Commit 與檔案驗證完成 |
| G12 | LLM Wiki / Handoff 更新完成 |

每個 Gate 記錄：

- PASS
- PARTIAL
- FAIL
- BLOCKED
- NOT RUN

不得將尚未執行的測試標記為成功。

---

# 17. Final Report

完成後請輸出完整的研究與整合報告。

至少包含：

### Repository

- 原始 Branch / SHA。
- Research Branch / SHA。
- Worktree Path。
- Merge Commit。
- GitHub Remote / Branch。
- Push Verification。

### Research

- 完成哪些研究。
- 使用哪些官方與學術來源。
- 發現哪些高風險問題。
- 有哪些原本的架構假設需要修正。
- 哪些功能已經可行，哪些仍需要驗證。

### Architecture

- 原始架構。
- 修改後架構。
- 重要 ADR。
- 新增或修改的 Interfaces。
- Browser Runtime 分工。
- Cloud-ready Architecture。
- Render / Export Architecture。
- Muse Agent Integration。

### Changes

- 新增檔案。
- 修改檔案。
- 刪除檔案。
- Breaking Changes。
- Migration Requirements。

### Testing

- 實際執行命令。
- 測試通過數量。
- 失敗測試。
- Performance Results。
- 尚未驗證的限制。

### Development Roadmap

- 已完成的 MVP 能力。
- 應立即修復的問題。
- 本次黑客松剩餘 P0。
- P1 / P2。
- 下一個可直接交付 Codex 的正式開發任務。

### GitHub

必須提供：

- Repository URL。
- 最終 Branch。
- Merge Commit SHA。
- Remote Commit SHA。
- Push 成功或失敗狀態。
- GitHub Actions / CI 結果（若適用）。

---

# 18. Execution Rules

本次任務已授權：

- 在本地建立 Git Worktree。
- 建立獨立研究 Branch。
- 研究官方文件與論文。
- 修改 Research Worktree 的程式與文件。
- 建立必要的 Technical Spikes。
- 執行測試。
- 建立 Commits。
- 比較原始分支。
- 在驗證通過後安全合併。
- 推送整合成果至指定 GitHub Repository。

但不得：

- 破壞原始工作區。
- 重置開發中的分支。
- 未經審查覆寫使用者修改。
- Force Push。
- 刪除重要歷史。
- 繞過 Branch Protection。
- 將 Secrets 上傳至公開 Repository。
- 將尚未驗證的聲學能力標記為完成。
- 在目前任務中無限制地擴充或重寫整個產品。

優先使用已有的 LLM Wiki、Skills、AGENTS.md、ADR 與 Test Infrastructure。

不建立平行且互相矛盾的管理系統。

如果獨立研究可以分派給 Subagents，應採取適當分工；但所有 Agent 都必須遵守 Worktree 隔離與檔案責任限制。

**完成研究並不等於完成任務。**

本次任務最終必須完成：

**Research → Architecture Refinement → Verification → Original Branch Comparison → Safe Merge → GitHub Push → Remote Verification。**

如果所有安全與驗證條件已經滿足，應直接執行後續階段，不需要在每個正常步驟停下來等待使用者確認。

遇到無法安全排除的阻礙，停止受影響的操作、保留已完成成果，並明確回報。

---

## Start Execution

立即開始：

1. 檢查當前本地 Repository。
2. 記錄原始分支及 Baseline。
3. 建立完整的獨立 Research Worktree。
4. 在該 Worktree 完成全部研究與必要架構微調。
5. 驗證研究成果及程式相容性。
6. 比對最新原始分支。
7. 完成安全合併。
8. 推送到 `https://github.com/kekekewww/Reflections-Lab.git`。
9. 驗證遠端成果。
10. 更新 LLM Wiki 並提供最終報告。

**最終目標：在完全保留第一版既有開發成果的基礎上，讓 Reflection Lab 取得經研究與驗證支持的完整架構，具備未來擴展成雲端空間音訊製作平台的技術基礎，並將整合成果可靠地保存至 GitHub。**

現在開始執行。不要只輸出研究計畫。