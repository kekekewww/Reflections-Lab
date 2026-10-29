# Reflection Lab — Sound Behavior System Research & Architecture Integration

## 0. 任務背景與執行目標

你是 Reflection Lab 的 Lead Software Architect、Computational Acoustics Researcher、Interactive Audio Engineer、Physics Systems Engineer 與 UX Researcher。

本次任務需要研究一項新的核心功能：

**Sound Behavior System — Physics-Driven Interactive Sound Design**

我們希望使用者可以對三維空間中的每個物件，自行定義它在不同物理狀態與互動事件下應該產生的聲音。

例如：

一顆金屬球被玩家抓起時，播放一段機械音效；被投擲時播放 Whoosh；飛行期間持續發出指定聲音；撞上木地板時產生金屬撞擊聲；滾動期間播放依速度變化的 Rolling Sound；停止時自然淡出。

使用者也可以完全改變這些音效，讓金屬球在碰撞時發出鋼琴聲、電子音或其他自行匯入的聲音。

然而，物件仍應遵守正常的三維物理規則，而且所有發出的聲音都應透過 Reflection Lab 的聲學核心，進行距離衰減、方向、遮蔽、材質反射和空間傳播處理。

**本次任務的核心是研究可行性、確定合理的技術設計、評估對既有架構的影響，並將結果整合進專案文件、Roadmap、AGENTS.md 和 LLM Wiki。**

請實際完成研究與文件更新。

本階段不要直接展開大型正式功能實作；只有在驗證重要技術風險時，才建立隔離的 Technical Spike。

---

## 1. 先更新開發架構決策

使用者已正式調整 Meta 黑客松開發策略。

### 1.1 Codex 負責主要開發

專案不再強制採用 Muse Code 作為主要實作代理。

新方向：

- Codex 負責架構、程式實作、任務推進與品質驗證。
- 可以使用 Codex 的 Skills、Subagents、Goal 和其他現有開發功能。
- Muse Code 是可選開發工具，只有在明確具有實際價值時才使用。
- 不應建立不必要的跨 Coding Agent Orchestration 複雜度。

先前關於 Codex × Muse Code 分工與額度自動切換的決策，應重新標記為 Superseded 或 Optional，保留歷史，不直接刪除。

驗證仍應盡可能由獨立測試、Benchmark、CI 或隔離的 Review Agent 提供，而非僅依賴同一個模型自我宣稱正確。

### 1.2 Meta Muse Agent 負責產品內 AI

Meta 的模型能力將透過 **Meta Model API** 整合到 Reflection Lab。

正式用途：

- 建立與修改 3D 場景。
- 新增物件與配置材質。
- 設定物理參數。
- 定義 Sound Behaviors。
- 生成合法的聲音事件配置。
- 控制及執行聲學實驗。
- 取得聲學求解器結果。
- 比較實驗及提出改善方案。

Muse Agent 是 Reflection Lab 產品功能的一部分。

開發時使用 Codex，不應影響這項能力。

請重新檢查官方競賽規則並確認：

- 是否允許 Codex 或其他第三方 Coding Agents 開發。
- 是否要求實際使用 Meta Model API 或開放權重模型。
- Meta AI 的整合需要達到什麼程度。
- 提交時如何證明 Muse Agent 具有真實功能。

來源：

https://dev.meta.ai/events/global-hackathon

https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details

如完整規則需要登入，且目前環境無法讀取，請明確標示無法獨立驗證的條款。

不要因使用 Muse Code 就假設作品符合 Meta AI 整合要求。

### 1.3 保留目前的技術架構

目前候選：

- React / TypeScript
- Three.js / React Three Fiber
- Rapier 3D
- Custom Acoustic Core
- Web Audio API / AudioWorklet
- Meta Model API
- Git-based LLM Wiki

Steam Audio SDK 僅作為可選的參考實作、獨立 Benchmark 或未來 Backend。

不打算直接重用 Echo Canvas / Reflections 的原始程式核心。

---

## 2. Sound Behavior System — 功能需求

研究如何讓每個 3D 物件擁有獨立、可編輯、可重用的聲音行為設定。

至少研究以下事件。

### Continuous Behaviors

- Always On：物件持續發聲。
- While Moving：物件移動時播放。
- While Airborne：物件飛行時播放。
- While Rolling：物件滾動時播放。
- While Sliding：物件滑動或摩擦時播放。
- While Spinning：依角速度產生聲音。
- While Held：被玩家抓取期間播放。

### Discrete Events

- On Grab
- On Release
- On Throw
- On Drop
- On Impact
- On Bounce
- On Start Moving
- On Stop Moving
- On Enter / Exit Zone
- On Sleep / Wake

需要判斷每種事件在物理系統中的可靠定義。

例如：

`On Throw` 是玩家主動施加投擲衝量的互動事件，不能僅靠物體速度大於某個數值來判定。

`While Rolling` 需要考慮物體與表面的接觸、線速度和角速度，不能將所有平面移動都認定為滾動。

`On Impact` 應考慮相對接觸速度、法向衝量、碰撞位置及材質配對。

---

## 3. Physics Integration Research

請研究 Rapier 提供的事件及資料。

官方來源：

https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/

研究：

- Collision Events
- Contact Force Events
- Contact Manifolds
- Relative Velocity
- Contact Normals
- Contact Position
- Collider / RigidBody IDs
- Linear / Angular Velocity
- Fixed Time Step
- Dynamic / Fixed / Kinematic Modes

分析如何將這些資料轉換為 Sound Behavior Events。

必須處理：

1. 同一個物理碰撞產生多個接觸點。
2. 持續接觸造成大量重複事件。
3. 物體在表面微幅振動。
4. 低速碰撞與高強度碰撞。
5. 高速物體及 CCD。
6. 多個物件同時碰撞。
7. 玩家持有物件時與牆壁發生接觸。
8. 物件從 Dynamic 切換至 Fixed 或 No Gravity。
9. Simulation Pause / Resume。
10. Physics Replay 的可重現性。

研究適當的：

- Contact Event Aggregation
- Debouncing / Cooldown
- Hysteresis
- Thresholds
- Rolling / Sliding State Machine
- Voice Limiting
- Event Timestamping

這些規則應有測試支持，不得只依靠主觀調參。

---

## 4. Sound Behavior Architecture

研究一個具備以下分層的架構：

**Physics / Player Events → Behavior Evaluation → Audio Event Instances → Acoustic Propagation → Spatial Audio Rendering**

### 4.1 Event Layer

接收經標準化的物理與互動事件。

每個事件應具有必要的識別資訊、時間戳、位置及參數。

### 4.2 Behavior Layer

根據事件、物件狀態、材質、使用者規則和參數決定應播放什麼聲音。

支援條件判斷、參數映射、冷卻時間及狀態轉換。

### 4.3 Audio Generation Layer

研究：

- Sample Playback
- Looping Audio
- Randomized Variants
- Oscillator / Synthesis
- Procedural Sound
- ADSR / Envelopes
- Filters
- Pitch / Gain Automation
- Crossfade
- Sound Instance Pooling

初版優先使用 Sample-based 與簡單的 Procedural Audio。

複雜 Modal Synthesis 可以先保留為研究功能。

### 4.4 Acoustic Propagation Layer

所有具有實際 3D 位置的聲源，應透過目前的 Custom Acoustic Core 進行聲學處理。

包含：

- Source Position
- Listener Position
- Propagation Delay
- Distance Attenuation
- Occlusion
- Reflections
- Material Responses
- Air Absorption
- Spatialization

多個事件可以同時發生，但必須有合理的 Audio Voice 與運算預算。

### 4.5 聲源定位規則

請特別研究：

- 連續發聲物件：通常綁定物件 Transform。
- 投擲音效：可能隨物件一起移動。
- 碰撞音效：應從 Collision Contact Position 發出。
- 摩擦音效：應依有效接觸區域或代表位置更新。
- 多個接觸位置：需要合理的合併或多聲源策略。

不要將所有聲音都固定在物件中心。

---

## 5. Physical Sound vs Creative Sound

這是最重要的設計原則。

**物理運動、聲音生成與聲音傳播應相互獨立。**

使用者可以創造不符合物件現實材料的發聲內容，但它仍然應在指定的三維聲學環境中傳播。

例如：

金屬球撞擊木地板。

Physical Preset：

依金屬與木材的撞擊聲音特徵播放適當音效。

Creative Preset：

使用者改為播放鋼琴 C4、電子音或其他聲音。

兩者仍使用同一套位置、遮蔽、反射與空氣傳播模型。

請研究是否需要：

- Physical Sound Preset
- Creative Sound Preset
- Hybrid Sound Layering
- Procedural Sound Mode

所有材質及聲學係數需要區分真實量測、公式計算與創意設定。

不能把使用者自行指定的音效說成是由真實物理振動自然產生。

另外必須區分：

- Gravity
- Atmospheric Medium
- Acoustic Propagation
- Physical Collision

無重力不代表真空。

真空也不代表物件不會發生機械碰撞。

---

## 6. 成熟音訊工具研究

完整研究：

### FMOD Studio

https://www.fmod.com/docs/2.04/studio/authoring-events.html

研究：

- Events
- Event Instances
- Parameters
- Instruments
- Automation
- Event Conditions
- Audio Routing

### Unreal MetaSounds

https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine

研究：

- Node-based Audio Generation
- Trigger Nodes
- Audio Parameters
- Signal Processing
- Procedural Sound
- Graph Evaluation

### Wwise

https://www.audiokinetic.com/

研究：

- Events
- Game Parameters / RTPC
- Switches / States
- Interactive Music and Sound
- Spatial Audio
- Event Profiler

### Sound Particles

https://soundparticles.com/

研究：

- Moving Sources
- Object-based Audio
- Audio Automation
- Spatial Source Behaviors

請製作比較：

- 哪些設計適合 Reflection Lab。
- 哪些功能不需要自行重新開發。
- 哪些概念能直接使用 Web Audio 實現。
- 哪些會增加不必要的技術複雜度。
- 哪些具有適合黑客松展示的創新價值。

只借鑑公開設計原理，不直接複製受保護的程式碼、素材或 UI 資產。

---

## 7. Sound Behavior Data Model

請設計版本化、可驗證的 JSON / TypeScript 資料契約。

至少包含：

- SoundBehaviorProfile
- SoundBehaviorRule
- SoundTrigger
- TriggerCondition
- ParameterMapping
- SoundAssetReference
- SoundGenerator
- SoundInstance
- SpatialEmitter
- AudioEvent
- BehaviorRuntimeState

必須支援：

- 一個物件多組 Behavior。
- 多個物件共用 Behavior Preset。
- 個別物件覆寫參數。
- 同時播放 Continuous 與 One-shot Events。
- Material Pair Overrides。
- Parameter Curves。
- Fade In / Out。
- Cooldown。
- Priority / Voice Limit。
- Versioned Save / Load。
- Undo / Redo。
- Experiment Recording。

請研究如何使用 Zod、JSON Schema 或現有 Validation Layer。

不得允許 AI 或使用者輸入未經限制的 JavaScript 程式碼作為音訊規則執行。

如果需要 Behavior Graph，應使用明確允許的節點類型及可驗證的 Graph Schema。

請提供具體的 Schema 草案與資料流，而非只有概念圖。

---

## 8. UI/UX Research & Design

將 Sound Behavior System 整合至既有 Reflection Lab Workspace。

研究兩種層級：

### Level 1 — Sound Behavior Inspector

作為第一版主要操作介面。

使用者選取物件後，可以：

- 開啟 Sound Behaviors。
- 新增 Event。
- 選擇 Trigger。
- 指定 Audio Asset。
- 調整音量與音高。
- 設定 Loop / One-shot。
- 選擇速度、撞擊或其他參數。
- 設定 Mapping Curve。
- 啟用 / 停用 Behavior。
- 預聽音效。
- 保存 Behavior Preset。

應與 Scene Inspector、Audio Asset Library 和 3D Viewport 維持一致的操作方式。

### Level 2 — Sound Behavior Graph

研究未來是否需要節點式編輯。

候選節點：

- Event Trigger
- Condition
- Comparator
- Parameter
- Mapping Curve
- Math Operation
- Sample Player
- Oscillator
- Envelope
- Mixer
- Audio Output

需要分析：

- 是否真的比 Inspector 更容易操作。
- 開發及維護成本。
- 是否有現成且授權合適的 Graph UI Library。
- 圖形編輯的 Undo / Redo。
- Node Validation。
- Graph Cycle Detection。
- Runtime Compilation。
- Debugging。

不要預設黑客松 MVP 必須完成 Graph Editor。

若 Inspector 已能涵蓋大部分核心需求，優先選擇更簡單可靠的設計。

請參考已配置的 Emil Kowalski Skills：

https://github.com/emilkowalski/skills

UI 設計應遵守目前專案的 Design System。

---

## 9. Event Timeline & Experiment Recording

Sound Behavior 應整合進現有實驗錄製系統。

研究如何記錄：

- Physics Tick
- Event Type
- Object ID
- Material Pair
- Contact Position
- Velocity / Impulse
- Triggered Behavior
- Audio Asset ID
- Playback Parameters
- Acoustic Result Reference

使用者應能：

1. 錄製一次投擲實驗。
2. 查看事件時間軸。
3. 找到撞擊發生的時間。
4. 檢查該次撞擊使用了什麼音效。
5. 修改 Sound Behavior。
6. 在相同物理條件下重播。
7. 進行 A/B 聲音比較。

需要研究如何維持 Audio、Physics 和 Acoustic 的時間同步。

不可假設重新執行一次物理模擬就必然產生逐位元相同結果。

如有需要，可以保存物理軌跡快照與正規化事件紀錄，以提升重播可靠性。

---

## 10. Muse Agent Integration

這項功能也要整合至 Reflection Lab 產品內的 Meta Muse Agent。

請研究如何讓 Muse 使用自然語言設定 Sound Behaviors。

例如：

「建立五顆沒有重力的球，讓每顆球被投擲時發出不同音階，碰撞時依照速度調整音量。」

或：

「讓這顆球被抓起時發出低頻機械聲，投擲後開始播放合成器音效，撞擊地板後停止。」

AI 應將使用者意圖編譯成經過驗證的結構化操作。

候選工具：

- CreateSoundBehavior
- AddBehaviorRule
- UpdateTrigger
- SetSoundAsset
- SetParameterMapping
- ConfigureSoundLayer
- EnableBehavior
- PreviewSoundBehavior
- RunExperiment
- CompareAudioResults

請設計：

- Tool Schemas
- Parameter Validation
- Material / Audio Asset Registry
- Valid Trigger IDs
- Maximum Rule Count
- Safe Execution
- Error Recovery
- User Confirmation
- Audit Logging

產品內 Muse Agent 不應直接執行任意 JavaScript、操作 OS 或修改 Repository。

模型只負責提出或選擇合法操作。

所有實際物理、DSP 和聲學計算應由程式執行。

使用者也應能在沒有 Muse API 的情況下手動編輯 Sound Behaviors。

---

## 11. Performance & Audio Quality

Sound Behavior System 可能產生大量同時播放的音訊，因此需要研究效能。

至少評估：

- Concurrent Audio Voices。
- Voice Stealing。
- Audio Asset Preloading。
- Memory / Buffer Pooling。
- Continuous Sound Instance Management。
- Event Burst Handling。
- Audio Graph Stability。
- Web Audio Scheduling。
- AudioWorklet Requirements。
- Physics-to-Audio Communication。
- Parameter Smoothing。
- Sound Propagation Update Frequency。

明確區分物理更新、聲學求解及音訊處理的時間尺度。

不能在 Audio Callback 中等待物理模擬、AI 或網路。

Continuous Sound 應維持持久的播放實例，避免每次更新都重新建立 Audio Node。

對聲學與 DSP 結果建立獨立驗證，包含：

- 無明顯 Click / Pop。
- 無不合理的音量跳變。
- 正確的聲源位置。
- 正確的碰撞事件數量。
- 可控制的音效重疊。
- 空間聲學效果沒有被 Behavior Routing 繞過。

效能目標必須依實際 Benchmark 與測試裝置訂定。

---

## 12. Scientific & Engineering Validation

請規劃可重現的測試：

**Physics Events**

- 單次撞擊正確觸發。
- 持續接觸不重複觸發撞擊音效。
- 投擲事件與自然掉落事件可以區分。
- 滾動和滑動狀態轉換正確。

**Sound Behaviors**

- Always On 在物件運動期間不會意外中斷。
- On Grab / On Throw 正確觸發。
- Event Cooldown 正確運作。
- 多層音效能同時播放。
- 參數映射符合設定曲線。

**Spatial Acoustics**

- 碰撞聲從正確接觸位置發出。
- 音訊遵守直達聲、遮蔽與反射設定。
- 移動聲源更新連續。
- Audio Routing 不造成重複處理 HRTF。

**Recording**

- Event Log 可重現。
- Scene Revision 和 Behavior Profile 可追蹤。
- A/B Comparison 不會改變不相關的物理條件。

**Muse Agent**

- 合法要求可以成功建立 Behavior。
- 無效 Trigger 被拒絕。
- 不存在的 Audio Asset 不會被捏造。
- API 失敗時仍可手動操作。
- AI 不會產生沒有數據支持的聲學測量結果。

測試需要明確區分 PASS、FAIL、BLOCKED、NOT RUN。

---

## 13. Feasibility & MVP Prioritization

請依照 Meta Global AI Developer Hackathon 的剩餘開發時間，評估此功能是否能整合進 MVP。

優先研究：

**P0 — Core**

- Always On
- On Grab
- On Throw
- While Airborne
- On Impact
- Basic Sound Asset Selection
- Gain / Pitch Mapping
- Acoustic Core Integration
- Simple Sound Behavior Inspector

**P1 — Enhancement**

- Rolling / Sliding
- Material Pair Rules
- Event Timeline
- Behavior Presets
- Muse Agent Sound Configuration
- A/B Comparison

**P2 — Advanced**

- Node-based Behavior Graph
- Complex Procedural Synthesis
- Modal Synthesis
- Advanced Sound Layering
- AI-assisted Audio Design

請根據實際 Repository 現況決定能否提高或降低優先級。

如果發現架構上需要先完成 Audio Event Runtime，應將其列為前置任務。

此階段應先完成研究及優先級決策，不直接假設所有功能都必須加入本次 Demo。

---

## 14. Documentation & LLM Wiki Integration

將完成的研究整合到既有專案文件。

依目前 Repository 結構，建立或更新：

- `docs/audio/SOUND_BEHAVIOR_RESEARCH.md`
- `docs/audio/SOUND_BEHAVIOR_ARCHITECTURE.md`
- `docs/audio/EVENT_MODEL.md`
- `docs/audio/PHYSICS_AUDIO_BRIDGE.md`
- `docs/audio/BEHAVIOR_SCHEMA.md`
- `docs/audio/SOUND_BEHAVIOR_VALIDATION.md`
- `docs/ux/SOUND_BEHAVIOR_UX.md`
- `docs/ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md`

以上路徑為建議，應優先遵循現有文件架構。

同步更新：

- Architecture Decision Records
- AGENTS.md
- Product Roadmap
- Feature Backlog
- Technical Risk Register
- LLM Wiki
- Current Project State
- Agent Handoff

不要重新建立另一套 Wiki。

避免複製既有完整文件形成互相矛盾的正式來源。

新增的 Sound Behavior 功能需以 Stable Task IDs 和明確的 Dependencies 納入 Roadmap。

若建立專用 Skill，應以聲音行為架構、事件處理及驗證流程為核心，不要重複整份研究文件。

---

## 15. Final Deliverables

完成研究後，請交付：

1. Sound Behavior System 的整體可行性結論。
2. 成熟音訊工具的技術比較。
3. Rapier Physics Event Mapping。
4. 完整的事件與狀態模型。
5. 版本化 Sound Behavior Schema 草案。
6. Audio Generation / Acoustic Propagation 架構。
7. UI/UX Inspector 與進階 Graph 的設計比較。
8. Muse Agent Tool Calling 整合規格。
9. Runtime Performance 與安全限制。
10. 驗收測試與 Benchmark 規劃。
11. 對現有 Reflection Lab 架構的影響分析。
12. 更新後的 MVP Scope 和 Task Dependencies。
13. 實際新增或修改的專案文件。
14. Wiki、AGENTS.md 和 ADR 的更新結果。
15. 下一個可執行的正式開發 Task。

最終請明確回答：

- 這個功能是否值得成為 Reflection Lab 的正式核心？
- 是否需要修改現有 Physics 或 Acoustic Core 架構？
- 應使用 Event Rules、State Machine 還是 Node-based Graph？
- 需要自行開發哪些功能？
- 哪些可以直接使用現有 API 或函式庫？
- 哪些功能最能展現競賽創新性？
- 如何讓 Muse Agent 實質參與 Sound Behavior 建立與實驗？
- 在競賽剩餘時間內，合理的 MVP 邊界是什麼？

---

## 16. 執行要求

請直接開始 Repository Audit 與相關研究。

可使用 Subagents 分別研究：

- Physics Event Modeling
- Interactive Audio Middleware
- Acoustic Propagation Integration
- UI/UX Behavior Authoring
- Muse Agent Tool Calling

所有重要結論都應有官方文件、論文、原始碼或實際測試支持。

研究完成後，整合各項結果、確認架構不衝突，並將成果實際寫入文件、ADR、Roadmap 與 LLM Wiki。

保留既有 Git 變更和專案歷史。

**本次以 Research & Architecture Integration 為主；除隔離的技術驗證外，不開始大型正式功能開發。**

完成後請提供具體的 Architecture Recommendation、更新檔案、驗證結果及可以立即執行的下一個 Milestone。

最終目標是讓 Reflection Lab 成為一個兼具現實物理模擬、可解釋聲學傳播，以及高度自由聲音行為創作能力的 3D Interactive Acoustic Sandbox。

現在開始工作。