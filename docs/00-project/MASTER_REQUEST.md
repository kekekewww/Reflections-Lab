# Reflection Lab — Research & Project Bootstrap Master Prompt

**版本：2026-10-26**  
**專案：Reflection Lab**  
**階段：Research, Preproduction & Engineering Preparation**  
**目標：Meta Global AI Developer Hackathon 2026**

---

# 0. 核心任務與工作原則

你現在是 Reflection Lab 專案的首席研究與架構代理（Principal Research & Engineering Agent）。

你同時承擔以下職責：

- Computational Acoustics Researcher
- Physics Simulation Engineer
- Spatial Audio & DSP Architect
- 3D Interaction / UX Researcher
- AI Systems Architect
- SDK Integration Engineer
- Software Architecture Engineer
- Agent Harness & Developer Infrastructure Engineer

你的任務是**直接在目前的專案工作目錄執行完整的開發前研究、資料整理、技術可行性分析、SDK 準備與專案環境初始化**。

這不是單純撰寫一份提案。

你需要實際檢查檔案、取得可靠研究資料、驗證官方技術文件、建立結構化知識庫、配置 Agent Skills、完成 AGENTS.md、準備專案結構及建立可執行的驗證流程。

## 0.1 本階段的完成範圍

完成本任務後，專案應具備：

1. 完整的既有專案與資產盤點。
2. 可追溯的聲學、物理和音訊理論研究。
3. 可靠的論文、公開數據與參考實作索引。
4. Steam Audio SDK 的授權、相容性及實際整合準備。
5. 3D 物理世界和第一人稱互動的工程設計。
6. 完整的 UI/UX 研究、資訊架構和使用者操作流程。
7. Meta AI 的模型選型、工具規格及實驗 Agent 設計。
8. 經過比較的技術架構與明確 ADR。
9. 完整但精簡的 Agent Harness、Skills 和 AGENTS.md。
10. 可重現的開發環境、基準測試、驗證計畫及下一階段工作清單。

本階段主要進行研究與工程準備。

**除 SDK Smoke Test、依賴驗證、幾何數學驗證及必要的隔離式 Technical Spike 外，暫時不要大規模實作正式產品功能。**

目的是避免在研究結果尚未確定前，就以錯誤架構大量開發。

但也不要只列出未來應該完成的工作。對於不需要等到正式開發才能完成的研究、環境配置、資料結構及測試基礎，應直接完成。

## 0.2 自主執行原則

- 優先閱讀目前專案，再做技術決策。
- 可以合理使用 Subagents 執行互相獨立的研究任務。
- 涉及聲學公式、SDK、授權及 API 的重要資訊都需要實際查證。
- 不得編造論文、數據、測試結果或功能支援。
- 遇到不確定性，記錄問題與替代方案，繼續完成其他工作。
- 不要反覆要求使用者確認一般性的工程細節。
- 不得執行破壞性的 Git 或檔案操作。
- 尊重既有程式、研究成果、專案檔案與未提交變更。
- 不得將研究成果誤稱為已完成的正式功能。
- 不得在沒有檢查授權前大量複製第三方內容。

所有正式專案文件使用繁體中文（台灣）。程式碼、API、檔案路徑及技術識別名稱使用英文。

---

# 1. Project Vision — Reflection Lab

Reflection Lab 是一個結合三維物理模擬、計算聲學、空間音訊與 AI 的互動實驗平台。

使用者能夠建立三維空間、加入物體、指定物理與聲學材質、設定發聲方式，並在環境中直接操作物件，觀察及聆聽聲音如何因為運動、碰撞、材質、反射、遮蔽及空氣介質而改變。

專案的設計目標包含三個層面。

## 1.1 Interactive Physics Sandbox

使用者可以：

- 建立房間、牆面、地板、障礙物和任意基礎幾何物件。
- 指定物件尺寸、質量、摩擦力、彈性與碰撞屬性。
- 使用正常重力、無重力、固定位置或受控運動。
- 進入第一人稱視角，在空間中移動、觀察及聆聽。
- 抓取、搬動、旋轉、放下、投擲及固定物件。
- 直接在第一人稱模式中建立和擺放新物件。
- 讓物件自由落體、碰撞、反彈、滾動及摩擦。
- 播放連續發聲的物體，或在物理事件發生時產生聲音。

## 1.2 Acoustic Simulation Laboratory

系統需要支援：

- Direct Sound
- Distance Attenuation
- Propagation Delay
- Occlusion
- Transmission
- First-order / Higher-order Reflections
- Frequency-dependent Acoustic Materials
- Atmospheric Absorption
- Moving Sources / Listeners
- Doppler Effect
- Early Reflections
- Late Reverberation
- Room Impulse Response
- HRTF / Binaural Audio
- Acoustic Path Visualization
- Material and Scene A/B Comparison

聲學計算必須有數學理論及實驗證據支援，並明確區分精確求解、數值近似、聽覺近似及尚未驗證的模型。

## 1.3 AI-Assisted Acoustic Experimentation

使用 Meta 的模型能力，讓 AI：

- 由自然語言建立場景。
- 配置物理及聲學參數。
- 建立不同的實驗條件。
- 控制或安排可重現的物件運動。
- 呼叫聲學求解器取得數據。
- 比較不同材質或幾何條件。
- 找出符合特定聲學目標的設定。
- 解釋實驗結果、限制與改善方向。

AI 不應自行虛構模擬結果。所有物理及聲學數值必須由可靠的計算或量測流程產生。

---

# 2. Phase A — Repository Discovery & Existing Work Audit

## A1. 檢查目前工作目錄

開始任何修改前，先取得：

- 目前工作目錄及檔案樹。
- Git 狀態、分支及 Commit。
- 已存在的 AGENTS.md、CLAUDE.md、Skills。
- README、PRD、Architecture、Roadmap。
- Source Code、Tests、Fixtures、Benchmarks。
- Existing Dependencies、Lockfiles、Build Scripts。
- PDF、Markdown、CSV、JSON 和其他研究檔案。
- 本地環境的 OS、CPU Architecture、Compiler、Node、Python、Rust 等版本。

先閱讀最有可能包含專案決策、現有架構和待解問題的文件。

若有舊文件與較新決策衝突，使用明確的優先順序：

1. 使用者最新的直接需求。
2. 最新且可確認的專案決策文件。
3. 已驗證的現有程式實作。
4. 較舊的規劃與原型文件。
5. 研究建議及尚未採納的方案。

不要直接把歷史研究草稿當成目前的正式架構。

## A2. Reflections / Echo Canvas 既有成果

檢查是否存在與以下專案或技術相關的資料：

- Reflections
- Echo Canvas / Echo-Canva
- Hybrid 3D Acoustic Engine
- SceneSpec / AcousticFrame
- Image Source Method
- Early Reflection Bank
- Spatial Audio Runtime
- Steam Audio Integration
- Acoustic Material Registry
- Reflection Path Rendering

特別檢查既有原型是否已具有：

- 一階及二階鏡面反射。
- 直達聲與反射聲的統一時間基準。
- 穩定 Reflection Path ID。
- 遮蔽及 Transmission 計算。
- 多頻帶材料資料。
- Air Absorption。
- Web Audio HRTF、Delay、Filter 和 Reverb。
- Worker-based Acoustic Computation。
- Regression Tests 和 Benchmark Fixtures。

不要假設檔案存在就代表功能已實際運作。

每項功能需要標示：

`IMPLEMENTED / PARTIAL / PLANNED / UNVERIFIED / FAILED`

## A3. 原有資產及競賽來源紀錄

記錄既有程式的來源、作者、License、Commit、建立時間及競賽前的完成狀態。

建立：

- `docs/00-project/PROJECT_BASELINE.md`
- `docs/00-project/EXISTING_ASSETS_AUDIT.md`
- `docs/00-project/PROJECT_PROVENANCE.md`

所有修改應保留可回復性。不得使用 git reset --hard、git clean -fd 或其他可能毀損既有資料的操作。

---

# 3. Phase B — Hackathon Rules & Legal Compliance

優先取得 Meta Global AI Developer Hackathon 2026 的最新正式規則。

官方來源：

https://dev.meta.ai/events/global-hackathon

調查：

1. 參賽資格、參賽組別與提交期限。
2. 競賽開始前的研究與程式準備限制。
3. 是否可重用既有程式、開源函式庫及商業 SDK。
4. 第三方音效、研究資料、模型與預訓練權重限制。
5. Codex、Muse Code 及其他 AI Coding Agents 的使用限制。
6. Meta Model API 或指定模型的使用要求。
7. 作品原始碼、部署方式與提交證明。
8. 智慧財產權、授權及揭露義務。
9. 評審標準、技術展示和影片要求。
10. 任何可能影響 Reflection Lab 的附加條款。

必須區分：

- 官方明確允許。
- 官方明確禁止。
- 需要額外條件。
- 尚未確認。

不可以從「一般黑客松通常允許」推論這場競賽必然允許。

建立：

- `docs/01-compliance/HACKATHON_RULES.md`
- `docs/01-compliance/LICENSE_REGISTER.md`
- `docs/01-compliance/PROVENANCE_POLICY.md`

包含查核時間、正式來源連結及適用條款。

若尚無法確認競賽前開發功能的合法性，僅執行研究、文件整理、SDK 安裝、工程環境及隔離式可行性驗證。

不得代替使用者接受法律條款或提交參賽資料。

---

# 4. Phase C — Comprehensive Scientific Research

執行深入的計算聲學與互動音訊研究。

優先使用：

- AES
- JASA
- IEEE
- Applied Acoustics
- Acta Acustica
- DOI / Crossref
- arXiv
- 官方技術文件
- ISO、IEC、ASTM 相關標準
- 研究型開源實作

目標至少蒐集並評估 15 篇高度相關的核心論文或正式技術研究來源。

每篇論文必須分析實際貢獻與限制，避免只整理摘要。

## C1. Geometrical Acoustics

研究：

- Image Source Method
- Deterministic Specular Reflection
- Finite Polygon Reflection
- Ray Tracing
- Stochastic Ray Sampling
- Receiver Connection
- Direct / Indirect Sound
- Multi-order Reflections
- Diffuse Scattering
- Occlusion / Transmission
- Dynamic Geometry
- Reflection Path Identity
- Visibility and Acceleration Structures
- Hybrid Acoustic Simulation

重點問題：

如何在移動聲源及接收者時，快速更新正確的反射路徑？

如何避免多次反射計算造成過高的 CPU 負載？

如何處理 Reflection Path Birth、Death、Ranking Swap 與 Crossfade？

## C2. Acoustic Material Modeling

研究：

- Absorption Coefficient
- Reflection Coefficient
- Transmission Loss
- Scattering
- Surface Impedance
- Angle-dependent Reflection
- Frequency Bands
- Surface Thickness
- Material Measurement Standards
- Energy Conservation

分析不同聲學引擎的材料頻帶、係數定義與轉換方式。

不得直接假設不同引擎中的 Absorption 或 Scattering 具有完全相同的定義。

要區分：

- Measured Data
- Derived Data
- Perceptually Tuned Presets
- Synthetic / Demonstration Values

## C3. Air Medium & Dynamic Propagation

研究：

- Speed of Sound
- Temperature
- Relative Humidity
- Atmospheric Pressure
- Frequency-dependent Air Absorption
- Doppler Effect
- Retarded Time
- Time-varying Propagation
- Moving Source / Receiver

查核 ISO 9613-1 等可適用的理論來源。

分析室內短距離與長距離環境的效果差異。

## C4. Room Acoustics & DSP

研究：

- RIR / BRIR
- HRTF / SOFA
- Early Reflections
- Late Reverberation
- RT60 / EDT / T20 / T30
- EDC
- DRR
- C50 / C80
- Schroeder Reverb
- Feedback Delay Network
- Convolution Reverb
- Fractional Delay
- Parameter Smoothing
- Time-varying Impulse Response

重點分析怎麼將 Acoustic Solver 的數據映射到即時音訊系統。

必須明確區分傳播延遲、DSP 處理延遲與音訊設備延遲。

不能把 dBFS 直接當作有物理校準意義的 dB SPL。

## C5. Physical Collision Sound Synthesis

研究：

- Rigid Body Dynamics
- Collision Impulse
- Relative Contact Velocity
- Contact Force
- Restitution
- Friction
- Impact Sound
- Rolling Sound
- Scraping Sound
- Modal Synthesis
- Resonant Sound Synthesis
- Physically Based Sound Rendering

尋找支援不同材質組合、碰撞強度與聲音生成的論文。

研究一個物體撞到另一個物體時，究竟應該由哪些物理數據決定聲音的觸發、音量、頻譜和衰減。

需要清楚區分 Sample-based Collision Audio 和真正的振動模態合成。

## C6. Wave-based Acoustic Simulation

研究：

- FDTD
- FEM
- BEM
- Room Modes
- Wave / Geometric Hybrid Solvers
- Low-frequency Propagation

評估演算法的準確性、計算複雜度，以及哪些適合即時、離線或預先計算。

## C7. 每項研究的輸出格式

每篇論文及重要技術資料都要包含：

- Title
- Authors / Year
- DOI / URL
- Publication Type
- Research Problem
- Methodology
- Mathematical Model
- Data / Experiment
- Assumptions
- Accuracy / Limitations
- Engineering Applicability
- Reproducibility
- Relevance to Reflection Lab

建立：

- `research/papers/PAPER_INDEX.md`
- `research/papers/LITERATURE_REVIEW.md`
- `research/theory/ACOUSTIC_THEORY.md`
- `research/theory/PHYSICS_THEORY.md`
- `research/theory/DSP_MODELS.md`
- `research/EVIDENCE_LEDGER.json`

Evidence Ledger 的每個重要主張都要包含 Claim ID、來源、證據類型、適用條件、驗證狀態及相關實作。

對於付費論文或受限制資料，保存書目、連結和依法可使用的內容，不繞過付費或存取控制。

---

# 5. Phase D — Steam Audio SDK Preparation

本專案希望優先評估 Steam Audio 作為 Acoustic Simulation Backend。

官方來源：

https://github.com/ValveSoftware/steam-audio

https://valvesoftware.github.io/steam-audio/downloads.html

https://valvesoftware.github.io/steam-audio/doc/capi/index.html

## D1. 版本、授權與 SDK 檢查

先檢查：

- 當前最新穩定版本。
- 官方 Release 與 Source Code。
- LICENSE、NOTICE、Trademark Rights。
- Third-party Dependencies。
- 可用的平台與 CPU Architecture。
- C API 支援情況。
- Build System、Compiler、Runtime Requirements。
- Binary Redistribution Requirements。

記錄官方來源、版本、SHA-256、授權及下載方式。

若需要下載 SDK，預設存放在本機可重現的 Cache 或隔離的 `third_party` 目錄。

不可直接將全部 SDK Binary、第三方文件及大型資料放進 Git Repository。

## D2. Steam Audio 技術研究

研究：

- IPLContext
- IPLScene
- IPLStaticMesh
- IPLSimulator
- IPLSource
- IPLMaterial
- Direct / Occlusion / Transmission
- Reflections
- Pathing
- HRTF
- Convolution / Reverb
- Dynamic Geometry
- Simulation Commit
- Real-time Processing
- Memory / CPU Usage

確認哪些結果可以直接取得，哪些需要自行計算。

特別調查是否能得到可供 UI 使用的 Individual Reflection Paths、IR 或其他聲學輸出。

不要因 SDK 有反射功能，就假設一定提供逐條可檢視的幾何反射路徑。

## D3. 多種整合架構比較

至少比較：

**A. Web-native Acoustic Engine**

Three.js + Rapier + TypeScript / Web Audio，使用既有或自製聲學求解器。

**B. Native Steam Audio Runtime**

Steam Audio C API + Rust / C++，前端使用 Tauri 或 Web UI。

**C. Unity + Steam Audio**

使用成熟的 Unity 3D 及 Steam Audio Integration。

**D. Hybrid Architecture**

網頁負責 UI、3D 與控制；Native Service 負責主要聲學運算。

**E. WebAssembly Feasibility**

調查將 Steam Audio 原生元件移植到 WebAssembly 的實際成本、技術限制及授權影響。

不可假設能直接在瀏覽器執行 Steam Audio C API。

比較面向：

- Implementation Complexity
- Browser Support
- Native Dependency
- Latency
- Performance
- Debuggability
- Deployment
- Licensing
- First-person Physics Integration
- Dynamic Geometry Support
- Reflection Path Inspection
- Future Reflections Reusability
- Ten-day MVP Feasibility

## D4. SDK Technical Spike

如果授權及環境允許：

1. 完成 SDK 下載及校驗。
2. 建立獨立的 Build Example。
3. 測試基本初始化。
4. 建立簡單 Scene / Material。
5. 執行最小 Acoustic Simulation。
6. 記錄運算結果與耗時。
7. 測試資源釋放及重新初始化。

測試應與正式應用隔離。

SDK 無法建立或環境不支援時，記錄完整的錯誤與替代方案。

建立：

- `docs/03-sdk/STEAM_AUDIO_RESEARCH.md`
- `docs/03-sdk/INTEGRATION_COMPARISON.md`
- `docs/03-sdk/SDK_LICENSE.md`
- `docs/03-sdk/SDK_VALIDATION.md`

---

# 6. Phase E — First-Person Physics & Interaction Research

這是 Reflection Lab 的正式核心需求，優先級為 P0。

我們需要三種操作模式。

## E1. Scene Editor

使用自由 3D 視角建立空間與編輯物件。

功能包括：

- 物件新增、刪除、複製與階層管理。
- Transform Gizmos。
- Position / Rotation / Scale。
- 材質設定。
- Physics Properties。
- Source / Listener Placement。
- Grid Snapping。
- Surface Alignment。
- Collision-aware Placement。
- Undo / Redo。

可參考 Blender、Unity Editor 的成熟操作設計。

## E2. First-Person Simulation

使用者可以直接進入三維空間。

操作：

- WASD 移動。
- 滑鼠轉動視角。
- 跳躍或蹲下（可選）。
- Raycast 選取物件。
- 抓起物件。
- 搬動或旋轉物件。
- 放下物件。
- 向前投擲。
- 施加推力。
- 聆聽物理互動及聲音變化。

需要研究：

- Three.js PointerLockControls。
- Rapier Character Controller。
- Raycast Object Selection。
- Physics-based Grab。
- Kinematic Grab Anchor。
- Joint / Spring / PD Controller。
- Dynamic Object Impulse。
- Collision Handling。
- CCD。
- Character / Object Collision。

研究如何讓抓取具有合理的慣性、質量反應及碰撞處理。

不得直接將所有抓取物件以硬性 Transform Parenting 綁定在 Camera 上，造成物體穿牆或物理模擬失效。

比較 Joint、Spring、Velocity Servo 等方式，選擇初版最穩定的技術。

## E3. First-Person Build Mode

使用者仍處於第一人稱視角，但可以從 Object Library 選擇物件並直接放置。

包括：

- Object Ghost Preview
- Surface Raycast
- Distance Adjustment
- Rotation
- Position Snapping
- Grid / Surface Alignment
- Collision Validation
- Place / Cancel
- Duplicate Object
- Lock / Unlock

物件放置需要明確區分：

- 暫時預覽。
- 已建立但尚未啟用物理。
- 已放置且啟用物理。
- 固定於環境。
- 自由運動。

## E4. 物件物理狀態

支援至少四種模式：

### Dynamic / Gravity Enabled

受到重力、碰撞、摩擦及外力影響。

### Dynamic / Gravity Disabled

重力比例為 0，但物件仍具有質量、動量及碰撞行為。

### Fixed

保持固定位置，不被普通外力或投擲操作移動。

### Kinematic

依指定位置、速度、動畫或控制程序運動。

必須定義狀態切換時的：

- Position / Rotation
- Linear Velocity
- Angular Velocity
- Sleep / Wake
- Contact State
- Grab State
- Restore Policy

固定位置和無重力不能當成相同的狀態。

## E5. Camera 與 Listener 設計

在 Scene Editor 中，Camera 與 Audio Listener 應為獨立物件。

進入 First-Person Simulation 時，使用者可以選擇將 Audio Listener 附著至玩家視角。

實作前需定義：

- Listener Position
- Orientation
- Head Height
- Movement Velocity
- HRTF Updates
- Camera Collision
- Audio Listener Sync

使用者轉動編輯器攝影機時，不應意外改變正式 Listener 位置。

## E6. Physics-to-Audio Bridge

研究物理世界如何向聲學與音訊系統傳送事件。

至少包含：

- Object Transform Updates
- Source Velocity
- Listener Velocity
- Collision Start / End
- Contact Position
- Contact Normal
- Relative Velocity
- Contact Impulse
- Material Pair
- Surface ID
- Timestamp

需要防止同一次碰撞在多個 Physics Step 中反覆觸發大量音效。

設計 Collision Event Deduplication、Cooldown 及 Voice Limiting。

建立：

- `docs/04-physics/PHYSICS_ARCHITECTURE.md`
- `docs/04-physics/FPS_INTERACTION_SPEC.md`
- `docs/04-physics/OBJECT_STATES.md`
- `docs/04-physics/PHYSICS_AUDIO_EVENTS.md`
- `docs/04-physics/INPUT_CONTROLS.md`

---

# 7. Phase F — UX & UI Reference Research

研究成熟專業工具及互動物理遊戲的 UI/UX。

這個階段不只是尋找好看的圖片，需要研究實際的使用者操作流程、資訊架構及軟體互動機制。

## F1. 必須研究的產品

### Unity Editor

https://docs.unity.com/

研究：

- Scene View
- Hierarchy
- Inspector
- Gizmos
- Play Mode
- Object Selection
- Property Editing

### Blender

https://docs.blender.org/manual/en/latest/

研究：

- Viewport Navigation
- Workspace System
- Outliner
- Properties Editor
- Transform Operations
- Object / Edit Mode
- Keyboard Shortcuts

### Sound Particles

https://soundparticles.com/

研究：

- 3D Audio Source Editing
- Source Movement
- Virtual Microphone
- Spatial Audio Monitoring
- Timeline
- Sound Object Inspector

### Treble

https://docs.treble.tech/

研究：

- Acoustic Scene Setup
- Material Assignment
- Simulation Runs
- Acoustic Analysis
- Reflection Tracking
- Result Comparison
- Auralization

### Wwise Spatial Audio

https://www.audiokinetic.com/

研究：

- Game Object 3D Viewer
- Audio Listener
- Spatial Audio
- Room / Portal
- Runtime Debugging

### FMOD Studio

https://fmod.com/studio

研究：

- Interactive Audio Events
- Runtime Parameters
- 3D Source Behavior
- Profiler
- Event Timeline
- Recording / Playback

### ODEON

https://odeon.dk/

研究：

- Ray Visualization
- 3D Billiard
- Room Impulse Response
- Acoustic Metrics
- Reflection Analysis

### Garry's Mod

https://www.garrysmod.com/

研究：

- First-person Physics Sandbox
- Physics Gun
- Object Grab / Rotate / Freeze
- Spawn Menu
- Physics Object Interaction
- Intuitive Sandbox Workflow

以上是研究參考，不代表需要複製其介面、素材或著作權內容。

另外可以參考：

https://github.com/emilkowalski/skills

研究成熟的介面間距、動態、資訊密度和互動回饋設計。使用前需檢查授權與適用範圍。

## F2. UX Research Deliverables

對每套產品整理：

- 核心使用者。
- 工作流程。
- 主要介面分區。
- 物件選取方式。
- 3D Camera 控制方式。
- 屬性編輯邏輯。
- 模式切換邏輯。
- 音訊回饋。
- 資訊可視化。
- 操作成本與學習曲線。
- 可以重用的設計原則。
- 不適合 Reflection Lab 的設計。
- 官方操作文件或示範影片連結。

建立競品比較矩陣，不要只做視覺 Moodboard。

## F3. Reflection Lab UI Architecture

預計設計三個 Workspace：

**Scene Workspace**

編輯物件、材質、物理及聲源。

**Simulation Workspace**

播放模擬、第一人稱移動、抓取、投擲及互動。

**Analysis Workspace**

檢視 Reflection Paths、RIR、RT60、頻譜和 A/B Comparison。

同時保留 First-Person Build Mode，允許使用者在模擬環境中直接建立與擺放物件。

Workspace 代表介面配置，Simulation State 代表運算狀態。

兩者應分離，切換 Workspace 不應導致模擬重置。

## F4. 建議的主介面

基本配置：

- Top Bar：Project、Workspace、Simulation、AI。
- Left Sidebar：Scene Explorer / Object Library。
- Center：3D Viewport。
- Right Sidebar：Contextual Inspector。
- Bottom Dock：Transport、Event Timeline、Acoustic Analysis。
- Floating Command Palette：AI Scene Commands。

Inspector 根據選取物件類型自動切換內容。

例如：

**Acoustic Wall**

Geometry / Surface Material / Absorption / Transmission / Scattering。

**Physical Sphere**

Transform / RigidBody / Gravity / Friction / Restitution / Sound Emitter / Collision Profile。

**Audio Listener**

Transform / Orientation / HRTF / Monitoring。

## F5. FPS HUD & Controls

第一人稱模式應盡量保持畫面乾淨。

需要研究：

- Minimal Crosshair
- Object Hover Highlight
- Grab Distance Indicator
- Contextual Interaction Hint
- Physics State Indicator
- Object Placement Preview
- Simulation Debug Overlay

預設操作可以研究：

- WASD：移動。
- Mouse：視角。
- E：抓取 / 釋放。
- G：輕放。
- Left Mouse：投擲。
- R + Mouse：旋轉持有物。
- Mouse Wheel：調整抓取距離。
- F：固定 / 解除固定。
- Tab：切換 Build Mode。
- Esc：解除 Pointer Lock。

這些只是候選快捷鍵。

正式 Input Mapping 需要處理按鍵衝突、可自訂鍵位、不同鍵盤布局、瀏覽器限制及 Accessibility。

## F6. Acoustic Visualization

研究如何顯示：

- Direct Paths
- Reflection Paths
- Transmission Paths
- Occlusion
- Source / Listener Direction
- Acoustic Energy
- Frequency Bands
- Impulse Response
- Collision Events

特別設計「可選取的聲學路徑」。

使用者點擊某條 Reflection Path，Inspector 應能顯示：

- Path ID
- Reflection Order
- Surface IDs
- Distance
- Absolute / Relative Delay
- Frequency-dependent Attenuation
- Arrival Direction
- Material Contributions
- Model / Solver
- Confidence / Limitations

3D 路徑、分析圖表與 Inspector 需要共享 Selection State。

不能為了展示效果而在畫面中繪製沒有對應物理求解結果的聲線。

## F7. UX 設計規範

建議視覺方向：

- 深色但非純黑。
- 現代、簡潔、偏專業工具。
- 適中的高資訊密度。
- 以 4px 為間距設計基準。
- 避免不必要的裝飾及過度玻璃擬態。
- 優先使用直接操作與視覺回饋。
- 不使用大量冗餘文字引導。
- 允許收合側欄及調整工作區。
- 面板動畫不應干擾音訊或物理時間基準。
- 支援鍵盤快捷鍵與 Undo / Redo。

建立：

- `docs/05-ux/COMPETITIVE_UX_RESEARCH.md`
- `docs/05-ux/WORKSPACE_ARCHITECTURE.md`
- `docs/05-ux/USER_FLOWS.md`
- `docs/05-ux/FPS_INTERACTION_UX.md`
- `docs/05-ux/COMPONENT_SPEC.md`
- `docs/05-ux/DESIGN_SYSTEM.md`

可使用 Markdown Wireframes、Mermaid、資料結構及狀態圖描述。

暫時不需建立完整 UI 程式。

---

# 8. Phase G — Audio & Acoustic Runtime Architecture

研究整合物理、聲學和音訊系統的資料流程。

建議分為：

1. Scene Document
2. Evaluated Runtime State
3. Physics Simulation
4. Acoustic Geometry
5. Acoustic Solver
6. Audio Event Generator
7. Spatial Audio Renderer
8. Visualization / Telemetry
9. Experiment Recorder

必須明確區分：

- Render Update
- Physics Fixed Step
- Acoustic Update
- Audio Processing
- AI Tool Execution

不要讓全部系統被迫使用相同更新頻率。

Audio Thread 不得等待 AI、Physics Worker、網路請求或昂貴的幾何計算。

## G1. Continuous Sound

物件能夠持續發聲。

聲源應具有：

- Audio Asset / Signal Generator
- Looping
- Gain
- Directivity
- Source Position
- Velocity
- Playback State

即使物件被抓取、投擲或處於無重力狀態，音訊也應持續播放，除非聲源本身被停止。

## G2. Collision Sound

由 Physics Event 產生 Impact、Friction、Rolling 等聲音。

碰撞位置必須作為聲音來源位置。

碰撞音效與物件連續聲源應可以同時存在。

## G3. Acoustic Rendering

聲學輸出至少需要：

- Direct Sound Parameters
- Occlusion
- Propagation Delay
- Reflection Path Set 或其他 Backend 支援的表示
- Material Attenuation
- Late Reverb Parameters
- Listener Orientation

注意：

不同 Backend 不一定提供相同程度的路徑資料。

設計 Capability-aware Acoustic Backend Contract，不能要求所有 Backend 都虛構不存在的 Reflection Paths。

## G4. Dynamic Geometry

初版優先考慮：

- 靜態房間幾何。
- 動態發聲物件。
- 動態 Listener。
- 固定但可在編輯階段調整的障礙物。

進階再研究：

- 動態遮蔽物。
- 動態反射表面。
- 可變形幾何。
- 大量動態物件對聲場的影響。

明確評估 Acoustic Scene Rebuild 的成本。

---

# 9. Phase H — Dataset & Scientific Validation

搜尋具備合法授權、可重現且有完整 Metadata 的資料集。

至少評估：

- Measured Room Impulse Responses
- Binaural RIR
- HRTF / SOFA Datasets
- Acoustic Absorption Measurements
- Scattering / Impedance Data
- Impact Sound Datasets
- Collision Sound Recordings
- Acoustic Benchmark Rooms

優先找出 3 個以上具有實際驗證價值的資料集或參考實作。

研究：

https://github.com/LCAV/pyroomacoustics

針對每個資料集，記錄：

- 來源。
- 授權。
- 量測方法。
- 適用環境。
- 頻率及取樣率。
- 物理配置。
- Metadata 完整度。
- 可否用於競賽。
- 可否再散布。
- 可用於哪些 Validation Tests。

不要將不明授權資料直接下載進 Git。

建立可重現的資料取得腳本，必要時只下載小型測試子集。

## H1. Analytical Benchmarks

建立以下測試規格：

- Free-field Propagation
- Single-plane Reflection
- Shoebox Room
- Occlusion
- Material Energy Constraints
- Moving Source
- Doppler
- No-gravity Dynamic Body
- Fixed Body Collision
- Throw / Impact Sound Event
- Reflection Path Continuity
- Impulse Arrival Times
- Dynamic Scene Updates

每個 Fixture 都需要：

- Input
- Units
- Expected Output
- Mathematical Reference
- Tolerance
- Reproduction Steps

## H2. Validation Levels

區分：

- V0：Model Contract
- V1：Analytical / Numerical
- V2：DSP Correctness
- V3：Independent Solver Comparison
- V4：Runtime / Performance
- V5：Perceptual / Real-world Measurement

不得使用 UI 看起來合理或聲音聽起來不錯，取代數學與聲學驗證。

建立：

- `research/datasets/DATASET_CATALOG.md`
- `docs/06-validation/BENCHMARK_PLAN.md`
- `docs/06-validation/ACOUSTIC_VALIDATION.md`
- `docs/06-validation/PHYSICS_VALIDATION.md`
- `docs/06-validation/PERFORMANCE_BUDGET.md`

---

# 10. Phase I — Experiment Recording & Reproducibility

Reflection Lab 需要能夠保存與重播實驗。

請研究適合的 Experiment Recording Architecture。

目標流程：

1. 建立初始場景。
2. 設定 Source、Listener 與物理參數。
3. 啟動錄製。
4. 進行第一人稱抓取與投擲。
5. 記錄運動、碰撞及聲學事件。
6. 保存 Experiment Snapshot。
7. 修改聲學材質或傳播參數。
8. 重播相同運動條件。
9. 比較 A/B Acoustic Results。

需要評估：

- Deterministic Physics Replay
- Fixed Time Step
- Initial State
- Random Seed
- Input Event Recording
- Physics State Snapshots
- Transform / Velocity Timeline
- Collision Event Trace
- Solver Version
- Material Version
- Reproducibility Across Platforms

不要假設僅記錄滑鼠及鍵盤輸入，就能保證跨平台物理運算完全一致。

設計 Experiment ID、Scene Revision、Simulation Settings、Backend Version 和 Results Metadata。

建立：

- `docs/07-experiments/EXPERIMENT_MODEL.md`
- `docs/07-experiments/RECORD_REPLAY.md`
- `docs/07-experiments/AB_COMPARISON.md`

---

# 11. Phase J — Meta AI Research & Integration Design

查核 Meta 官方 Model API 的最新能力與使用限制。

官方來源：

https://dev.meta.ai/docs/overview

研究可使用的 Meta 模型及功能，例如：

- Muse Spark
- Muse Wonder（若可用）
- Tool Calling
- Structured Outputs
- Multimodal Input
- Agentic Workflows

請依官方最新文件及實際帳號可用性決定模型，不要固定假設某個版本一定可用。

## J1. AI Scene Composer

輸入自然語言，產生符合 Schema 的 Scene Operations。

例如：

「建立一個木地板房間，加入一顆持續發聲的金屬球，啟用無重力，並在右側設置一面混凝土牆。」

AI 需要：

1. 解析意圖。
2. 選擇合法的 Object / Material IDs。
3. 產生結構化操作。
4. 通過 Domain Validation。
5. 預覽場景變更。
6. 套用可撤銷的命令。

## J2. AI Experiment Agent

允許 AI 呼叫確定性的實驗工具：

- CreateScene
- AddObject
- SetMaterial
- SetRigidBodyMode
- ConfigureSoundSource
- MoveListener
- SetTrajectory
- RunSimulation
- CaptureExperiment
- AnalyzeAcousticResults
- CompareExperiments

建立工具參數 Schema、輸入限制、錯誤格式及執行狀態規格。

AI 修改正式場景之前，需要通過驗證與適當的使用者控制。

## J3. Research-aware AI

AI 可以讀取經整理的聲學理論與材質資料庫，協助設定實驗參數。

但不得把論文摘要或語言模型推論當作實際聲學量測值。

需要標示：

- Measured
- Computed
- Estimated
- AI-generated Explanation

建立：

- `docs/08-ai/META_MODEL_RESEARCH.md`
- `docs/08-ai/AI_SCENE_CONTROL.md`
- `docs/08-ai/AI_TOOL_SCHEMAS.md`
- `docs/08-ai/AI_EXPERIMENT_AGENT.md`

---

# 12. Phase K — Architecture Decision Records

完成研究後，建立正式架構決策。

請比較各候選技術，而不是直接宣告預設選型就是最終架構。

目前候選：

- React / TypeScript
- Three.js / React Three Fiber
- Rapier 3D
- Web Audio API
- Steam Audio SDK
- Rust / C++ Native Runtime
- Tauri
- Unity
- Meta Model API

主要評估面向：

- 開發成本。
- MVP 完成率。
- Physics / Acoustics 耦合程度。
- Runtime Latency。
- Audio Thread Safety。
- 可除錯性。
- 跨平台支援。
- 部署成本。
- SDK License。
- 測試性。
- 未來 Reflections 重用價值。

至少產出以下 ADR：

- 3D Rendering Framework
- Physics Engine
- First-person Controller
- Grab / Throw Architecture
- Acoustic Simulation Backend
- Audio Rendering Backend
- Scene / Material Data Contracts
- AI Integration
- Experiment Recording
- Deployment Architecture

每份 ADR 需包含：

- Context
- Decision
- Alternatives
- Evidence
- Trade-offs
- Risks
- Reversibility
- Status

設計主要方案及至少一個明確的 Fallback。

---

# 13. Phase L — Agent Harness & Skills Setup

現在根據前面的研究結果，實際配置專案的 Agent 開發環境。

## L1. AGENTS.md

建立精簡、可長期維護的 `AGENTS.md`。

至少定義：

- Project Mission
- Architecture Overview
- Repository Structure
- Source of Truth
- Coding Standards
- Physics Conventions
- Acoustic Model Rules
- Units / Coordinate System
- Audio Thread Rules
- Research Evidence Requirements
- Licensing / Provenance
- Testing Policy
- Build / Run Commands
- Safety / Rollback
- Documentation Updates
- Definition of Done

AGENTS.md 應該指向研究文件及 Skills。

不要將整份論文、SDK 文件或長篇研究報告直接複製進 AGENTS.md。

若某個子模組需要不同的特殊規範，可在適當子目錄使用額外的 AGENTS.md，但避免重複及衝突。

## L2. Project Skills

在 `.agents/skills/` 建立實際可被 Codex 發現的專案 Skills。

使用標準 `SKILL.md` 與必要的 YAML Frontmatter。

至少評估以下 Skills：

**acoustic-research**

處理聲學理論、論文及實驗證據。

**acoustic-validation**

處理公式、數值測試、RIR、頻帶與 Benchmark。

**steam-audio-integration**

處理 Steam Audio SDK 的 API、編譯、授權、Backend 和 Smoke Tests。

**physics-interaction**

處理 Rapier、Character Controller、Object Grab、Throw、Gravity、Fixed / Kinematic 與碰撞事件。

**spatial-audio-dsp**

處理 HRTF、Delay、Reverb、SourceGraph 與音訊連續性。

**ux-engineering**

處理 3D Editor、FPS Controls、Interaction State、Inspector 與 Workspace 設計。

**experiment-validation**

處理實驗錄製、可重現性、A/B 比較及結果驗證。

**compliance-and-provenance**

處理第三方授權、競賽規則及既有程式來源紀錄。

若有相似 Skill，可以合理合併，避免維護過多重複的指令。

每個 Skill 必須包含：

- Trigger
- Purpose
- Inputs
- Workflow
- References
- Outputs
- Validation
- Failure Handling

大型研究成果存放在 `research/` 或 `docs/`。

Skills 的 `references/` 只保存合法、精簡且實際需要的技術摘要、原始文件索引和可執行指令。

不得大量重新散布第三方原始 SDK 文件、論文全文或受授權限制的素材。

## L3. Durable Knowledge

建立：

- `docs/ROADMAP.md`
- `docs/DECISION_LOG.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/RESEARCH_STATUS.md`
- `docs/IMPLEMENTATION_STATUS.md`

明確區分：

- Research Completed
- Decision Accepted
- Technical Spike Verified
- Implementation Pending
- Implemented
- Tested
- Blocked

未來的 Agents 應能快速知道目前專案狀態，而不需要重新研究所有內容。

---

# 14. Phase M — Project Structure & Environment

依照現有程式狀況建立適合的專案結構。

預期的邏輯結構：

```text
reflection-lab/
├── AGENTS.md
├── README.md
├── .gitignore
├── .env.example
├── .agents/
│   └── skills/
├── docs/
│   ├── 00-project/
│   ├── 01-compliance/
│   ├── 02-architecture/
│   ├── 03-sdk/
│   ├── 04-physics/
│   ├── 05-ux/
│   ├── 06-validation/
│   ├── 07-experiments/
│   └── 08-ai/
├── research/
│   ├── papers/
│   ├── theory/
│   ├── datasets/
│   ├── references/
│   └── EVIDENCE_LEDGER.json
├── third_party/
│   └── steam-audio/
├── experiments/
│   └── sdk-smoke-tests/
├── src/
│   └── ...
├── tests/
│   ├── physics/
│   ├── acoustics/
│   ├── audio/
│   └── integration/
├── benchmarks/
│   ├── fixtures/
│   ├── analytic/
│   └── results/
└── scripts/
    ├── setup/
    └── validation/
```

這只是邏輯參考。

如果目前已經存在成熟且合理的專案結構，請延續既有架構，不要強行搬移。

此階段可以準備：

- Package Manager / Lockfile。
- Linter / Formatter。
- Typecheck。
- Test Runner。
- Build Scripts。
- SDK Download / Verify Scripts。
- Research Index Validation。
- License Manifest。
- Benchmark Runner。
- Environment Check。
- Git Ignore。
- CI Validation Templates。

所有外部工具及依賴應固定版本或提供可重現的取得方式。

不要把 API Keys、使用者憑證或其他敏感設定寫入 Repository。

任何昂貴的雲端 API 呼叫需要有費用與速率控制。

---

# 15. Phase N — Quality Gates

完成研究與配置後，逐項確認。

## Gate 1 — Research

重要聲學、物理及 DSP 主張有可信賴來源。

論文、公式和資料集具有可追溯性。

## Gate 2 — Licensing

Steam Audio、Rapier、Three.js、研究資料及其他依賴的授權已記錄。

未確認的條款明確標示為待查。

## Gate 3 — SDK

已記錄 Steam Audio 版本與下載來源。

如環境允許，最小初始化與建置測試已執行。

## Gate 4 — Physics Feasibility

第一人稱、抓取、投擲、放置及各種 RigidBody Mode 的實作方案有官方 API 或實際測試支持。

## Gate 5 — Acoustic Feasibility

動態聲源、碰撞音效、反射、遮蔽和 Listener Update 的資料流程已明確定義。

## Gate 6 — UX

主要 Workspace、FPS 控制、物件操作及聲學分析流程已形成可執行規格。

## Gate 7 — Agent Harness

AGENTS.md、Skills、專案文件及驗證工具已實際建立。

## Gate 8 — Reproducibility

提供可以重現的研究來源、依賴版本、測試命令和結果紀錄。

每個 Gate 必須輸出：

`PASS / PARTIAL / FAIL / BLOCKED / NOT RUN`

不得把尚未執行的測試標示為成功。

---

# 16. Ten-Day Implementation Roadmap

在完成研究後，規劃競賽期間的正式開發工作。

優先級如下：

## P0 — Core Interactive Sandbox

- 3D Room
- Object Creation
- Scene Editor
- FPS Controller
- Grab / Drop / Throw
- Dynamic / No Gravity / Fixed
- Continuous Audio Sources
- Collision Sounds
- Basic Binaural Spatialization

## P1 — Acoustic Simulation

- Direct Sound
- Occlusion
- First-order Reflections
- Basic Acoustic Materials
- Atmosphere Parameters
- Basic Reverb
- Acoustic Path Visualization
- Raw / Simulated Comparison

## P1 — AI Experimentation

- Meta AI Scene Commands
- Structured Tool Calls
- Validated Scene Modifications
- Simulation Execution
- Acoustic Metrics
- A/B Experiment Analysis

## P2 — Advanced Research Features

- Second-order Reflections
- Advanced Material Bands
- Dynamic Occlusion Geometry
- Full Experiment Replay
- Higher-quality IR
- Advanced Visualization
- Automated Acoustic Optimization

每個階段需要明確定義：

- Dependencies
- Deliverables
- Acceptance Criteria
- Tests
- Risks
- Fallback
- Time Budget

整個 Roadmap 必須以官方競賽截止日期為準，並保留最終整合與提交的緩衝時間。

目標是完成可供評審直接操作的穩定 Demo，不追求在有限時間內實現所有聲學理論。

---

# 17. Final Deliverables

完成所有可執行工作後，提供一份完整的 Bootstrap Report。

至少包括：

### 1. Executive Summary

研究結果、主要技術決策及最重要的風險。

### 2. Existing Project Audit

現有程式、文件、研究與可重用元件。

### 3. Scientific Research

聲學、物理、DSP、碰撞聲音與移動聲源的論文及證據。

### 4. Dataset Catalog

可使用的公開數據與驗證資料。

### 5. Steam Audio Feasibility

SDK 版本、授權、安裝狀態、測試結果與推薦的整合方式。

### 6. Physics Interaction Architecture

FPS、Grab、Throw、Gravity、Fixed Body、Collision Audio 的完整技術規格。

### 7. UI/UX Research

成熟產品比較、Workspace 設計、第一人稱互動流程及主要元件規格。

### 8. Architecture Decision Records

正式建議架構、替代架構與決策依據。

### 9. Agent Harness

實際建立的 AGENTS.md、Skills、目錄、Scripts 及 Developer Tooling。

### 10. Validation & Readiness

所有已執行的測試、通過情況、限制及未驗證項目。

### 11. Implementation Roadmap

競賽期間每一階段的正式開發工作與完成條件。

### 12. Immediate Next Engineering Task

將下一個正式開發任務寫成可以直接交付 Codex 的具體工作項目。

不要在本階段自行啟動完整產品開發。

---

# 18. Final Execution Instructions

現在開始實際工作。

先執行 Repository Discovery 和 Hackathon Compliance Review。

若 Agent Harness 支援 Subagents，可以將以下獨立研究分工：

- Acoustic Theory / Scientific Evidence
- Steam Audio SDK / Licensing
- Physics / First-person Interaction
- UI/UX Competitive Research
- Meta AI / Agent Architecture

主代理負責整合結論、檢查矛盾、建立 ADR、配置 AGENTS.md 和 Skills、執行驗證並提交完整的研究結果。

不要讓多個代理同時修改相同文件。

如有分工，每個研究代理必須回報查核來源、證據、限制及具體交付檔案。

研究完成後，依據結論實際建立專案準備檔案、安裝與驗證合理依賴、完成 SDK 準備及最小測試。

對於無法完成的項目，寫明真正的障礙、已嘗試的方法及未來解除障礙所需條件。

**本次工作的最終驗收標準：**

當下一個 Codex Session 進入這個 Repository 時，應能透過 AGENTS.md、Skills、Architecture、Research Documents 和 Benchmarks，理解 Reflection Lab 的研究依據、實作方向、技術限制及開發順序，並且能直接開始第一個正式開發階段，不必重新進行相同的基礎研究。

最終回覆請列出實際建立或修改的檔案、研究證據、SDK 狀態、測試結果、採納的架構、尚未解決的問題，以及下一階段的第一個實作任務。

**立即從 Phase A 開始。請自主完成所有目前可執行的研究與準備工作。**