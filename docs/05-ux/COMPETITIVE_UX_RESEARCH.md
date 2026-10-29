# 專業工具與物理沙盒 UX 比較

查核日期：2026-10-26（Asia/Taipei）。狀態：**官方文件研究完成；未進行產品實機測試、使用者訪談或任務計時**。本階段未製作 Figma、未下載競品素材、未複製介面程式。所有操作成本、使用者分類與「適合／不適合」為研究者依工作流程的設計推論，非實證可用性結論。

## 證據規則

- `READ`：官方頁正文可讀。`SEARCH_ONLY`：只能從官方搜尋索引取得內容，尚未完整讀取頁面。`LEGACY_REFERENCE`：舊版官方文件，只能佐證該版。
- `UNKNOWN`：本次未取得足夠資料。不能據此宣稱該產品沒有功能。無法存取、版本不一致均另記。
- 本文將「產品文件事實」與「Reflection Lab 設計推論」分開。各列的來源代碼對應文末原始連結，日期皆為上述查核日。
- 特定模擬引擎能顯示線條，不代表其他 backend 可匯出相同資料；示意、幾何檢查、求解結果與量測結果不能混用。

## 矩陣 A：任務、資訊架構與直接操作

| 產品／核心使用者（分類為推論） | 工作流程 | 主要分區 | 物件選取 | 3D Camera | 屬性編輯 |
| --- | --- | --- | --- | --- | --- |
| **Unity Editor**／3D 開發者 | Scene 建立物件→Hierarchy 整理→Inspector 設定→Game/Play 測試 [U1,U4] | Scene、Hierarchy、Inspector、Project、Game、Console [U1] | Scene／Hierarchy 點選在舊版文件可證；Unity 6 Selection API 證 active object 與 Inspector 的關係；精確最新多選鍵位 UNKNOWN [U5,U6] | MMB 平移、Alt+LMB orbit、wheel zoom；RMB+WASD flythrough、Q/E 垂直、F frame [U2] | 依 GameObject／Asset／Component 顯示；可多選、固定 Inspector [U3] |
| **Blender**／建模與動畫作者 | 依任務換 Workspace→選 active object→Object transform／Edit geometry [B1,B4] | Layout 的 Viewport、Outliner、Properties、Timeline [B1] | latest Outliner 精確操作 UNKNOWN；舊 2.81 證選取、collections、隱藏／禁選 [B6] | MMB orbit、Shift+MMB pan、數字鍵標準視向；5.2 官方索引，非實測 [B2] | 依 scene/object/material context 分類，搜尋與 pin；gizmo 直接操作與數字輸入並存 [B3,B5] |
| **Sound Particles**／空間音效設計者 | SP2 新增 Particle Track→匯入音效→虛擬麥克風→Render [S1] | Views、Time Editor、Transport、右側 Inspector [S1] | 點 timeline track，Inspector 隨選取改變；3D 多選修飾鍵 UNKNOWN [S1,S3] | SP2 perspective/top/front/360/VR views；SP3 specs 另有麥克風／物件 POV；精確按鍵 UNVERIFIED [S1–S3] | track／物件 contextual Inspector；I/O 設定與 Project propagation 選項分離 [S1] |
| **Treble**／聲學設計者與顧問 | Model→layers/materials→sources/receivers→run→Results/Report→Auralizer [T1] | Model Editor、surface/layer 清單、sources/receivers 分頁、結果資訊面板 [T1,T2] | surface 清單，Ctrl/Shift 多選；結果圖表點單一反射同步到 3D [T1,T2] | Auralizer 在 receiver 第一人稱環視、有方向 minimap；Model Editor orbit/pan 精確鍵位 UNKNOWN [T1] | 材料庫搜尋/tag、表面指派；source/receiver 以軸拖曳或精確座標 [T1] |
| **Wwise Spatial Audio**／遊戲音效整合者 | 連接 runtime→capture→object/listener→3D/RTPC/事件追查 [W1] | Game Object Explorer、3D Viewer、Game Sync Monitor；Capture Log、Performance Monitor [W1] | Explorer 選 object/listener；Viewer 點選事件的精確規則 UNKNOWN [W1,W2] | perspective/orthographic、Locate/Follow/Frame All；MMB pan、wheel zoom、Alt-drag orbit、RMB+WASD [W2 SEARCH_ONLY] | Authoring 設 attenuation/positioning、Room aux bus；Viewer 是除錯視圖，不是完整場景編輯器 [W3,W4] |
| **FMOD Studio**／互動音效作者 | event→timeline/parameter sheet→audition→Sandbox/live runtime→Profiler [F1–F3] | Event Editor 左 browser、中 timeline、右 overview、底 deck；Sandbox timeline＋map [F1,F2] | event browser 選事件；instrument/track/parameter 選取影響 deck；Sandbox map/overview 支援多選 [F1,F2] | 3D Preview 是 listener 中心的 audition 俯視圖：拖 emitter、wheel rotate、double-click reset；自由 orbit UNKNOWN [F4] | deck 編輯所選；參數可在 runtime/profiler 觀察；event preview 不等於全部 runtime instances [F1,F3] |
| **ODEON**／室內聲學工程師 | 匯入 room→source/receiver/material→Room Setup→Job List→results [O1] | 任務工具列、多結果視窗；材料左 surfaces、右 library [O1] | 表列選取對應幾何高亮；reflectogram 選一路徑同步 3D [O1,O4] | v13 guide：LMB orbit、RMB pan、Alt+LMB zoom、鍵盤標準視圖；v19 相同與否 UNKNOWN [O1] | 材料表與 room/source/receiver 專門設定；不同 edition 不可互推 [O1–O3] |
| **Garry's Mod**／物理沙盒玩家 | 準心瞄準→Spawnmenu→產生道具→Physgun 抓取/旋轉/固定 [G1–G3] | 第一人稱 crosshair；Spawnmenu 左道具、右工具/utilities [G2] | 準心＋Physgun LMB 持續抓；beam 顯目標；wheel 距離 [G3] | 文件可證第一人稱指向；本次完整 WASD/camera mapping UNKNOWN [G1–G3] | contextual tool 設定、utilities；科學材質 Inspector UNKNOWN [G2] |

## 矩陣 B：模式、聲音、圖表與遷移價值

| 產品 | 模式切換 | 音訊回饋與資訊可視化 | 操作成本／學習曲線（UNTESTED 推論） | 可重用設計原則（推論） | 不適合直接移植的設計（推論） |
| --- | --- | --- | --- | --- | --- |
| Unity | Play/Pause/Step；停止 Play 還原臨時修改；Game focus 可限制 Editor shortcuts [U4] | Game Mute、Stats、Gizmos；聲學 RIR 分析本次 UNKNOWN [U4] | 中等；component 與多面板需理解 | hierarchy、viewport、Inspector 連動；明確 input scope | Play 還原行為不能暗中丟棄實驗；flythrough 不是有碰撞角色；F Frame 與 Freeze 衝突 |
| Blender | Workspace 是 editor 配置；Object/Edit mode 改變工具和快捷鍵 [B1,B4] | gizmo/selection/context；即時傳播、RIR 監聽本次 UNKNOWN [B3–B5] | 較高；模式與 hover editor 的快捷鍵語意較多 | 任務 Workspace、可搜尋屬性、精確輸入＋直接操作 | 不需要完整網格 Edit Mode；Tab 不能全域奪取焦點導覽 |
| Sound Particles | track/automation、播放、manual/auto render；不同版本分開 [S1,S2] | Time Editor、solo/mute、虛擬 mic、binaural monitoring；air delay/attenuation/Doppler 設定 [S1] | 中高；音訊作者容易理解 timeline，初學者需理解 mic 與 monitor | 聲源運動 timeline、context Inspector、獨立 monitoring | 大型粒子群創作控制不應佔據簡單單球實驗的預設畫面 |
| Treble | model setup→run→result→auralize；estimate 與正式 run 有別 [T1] | 選取反射的時間、階數、距離、方向、band/weighting/filter；乾音與 IR 聲比較 [T2,T3] | 中高；設定與版本化結果清楚，但科學參數多 | source/receiver、run provenance、3D/圖表/Inspector 同步 | 雲端離線 run 不等於每個 FPS tick；RT estimate 不當作正式量測 |
| Wwise | runtime capture/profiling；精確 transport 切換 UNKNOWN [W1] | listener、attenuation cone/radius、room/portal、image source、反射路徑；需符合 Reflect/Spatial Audio 設定 [W2–W4] | 高；RTPC、bus、runtime integration 具背景門檻 | filters、Follow listener、事件/位置/參數同脈絡 | 不將完整 game routing 當新手入口；不能由 Wwise 路徑能力推論 Steam Audio 同樣提供 |
| FMOD | local audition/live update；Profiler Waveform 播錄音、Simulate 重播 API [F3] | event timeline/parameter、3D instances、record/profile；Simulate 隨機 playlist 可能改聲 [F1–F3] | 中高；event、instance、bus 分層較多 | 清楚分錄音回放與重算，聲音／參數／效能同時看 | 完整 bank/snapshot authoring 過重；重播 API 不宣稱跨次 bit-identical |
| ODEON | setup→job→分析/auralization；edition/version 各異 [O1–O3] | RIR/BRIR、decay、metrics、reflectogram、3D paths；**3D Billiard 僅幾何檢查，不表示吸收或能量衰減** [O1–O5] | 高；多結果視窗與聲學術語 | 具條件的圖表、linked path selection、有版本的 job | 不把幾何射線／billiard 動畫當能量證據；專家 MDI 不是 FPS 預設 |
| Garry's Mod | Spawnmenu Q 將準心控制交給 cursor；Physgun 抓/轉/freeze [G2,G3] | beam、crosshair、對象／模式回饋；聲學量測與音訊模型 UNKNOWN [G3] | 起步低、精熟中；chord/hold 仍有成本 | 直接操作、單一情境提示、選單明確拿走輸入 | hold/chord 必須有 toggle 替代；光束不能當聲學路徑；大量生成／全體解凍不利可重現性 |

## 三個跨產品結論與選擇

1. **選取必須有單一脈絡。** Unity/Blender 的 Inspector、Treble/ODEON 的反射與 Wwise 的 runtime 對象皆提供可追蹤的資訊脈絡。Reflection Lab 採 object/path/event/IR 的有型別 SelectionRef；Hover 與 Selection 分離。這是設計採納，尚未以實作驗證。
2. **作者設定與實驗結果分版。** Treble/ODEON 的 run/job 與 FMOD 的 capture 提示「目前畫面」不是唯一真相。Reflection Lab 將 Document、Runtime、Result 分開，Workspace 不重設模擬；顯示 stale/pending 與 backend capability。
3. **專業資訊循序揭露。** 一開始顯示物件、物理、聲源與播放；頻帶、solver 限制、路徑貢獻在 Analysis/Inspector 展開。FPS 操作借用沙盒的直接性，同時保留按鈕／數值／預設軌跡路徑。

未採納的替代方案：以 Blender 全部快捷鍵作預設（與瀏覽器／可及性衝突）、以 Unity Play 視為唯一進入 FPS 的入口（混淆 layout 與 runtime）、以聲學工具完整多視窗作初版（增加學習成本）。本階段採三 Workspace＋正交 runtime state；待任務測試再調整。

## emilkowalski/skills：授權與適用邊界

[官方 LICENSE](https://github.com/emilkowalski/skills/blob/main/LICENSE) 已可讀：MIT；Copyright (c) 2026 Emil Kowalski。未固定 commit，SHA **UNKNOWN**。若未來複製軟體或實質部分，須保存相應版權與 permission notice；素材、商標及其他 repo 不可一併推定已授權。

[README](https://github.com/emilkowalski/skills) 與 [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md) 是介面／動畫研究參考。本次未安裝、未 vendoring、未把其中的 agent 指令當作專案工作指令。可借用原理為：高頻操作直接回饋、動畫有明確目的、避免短命的花俏轉場。其內容不能取代聲學驗證、WCAG 審核或 physics/audio clock。Reflection Lab 的 4px spacing 與深色系是需求及本地設計選擇，未宣稱為該 repo 規定。

## 存取與版本缺口

| 項目 | 實際取得與限制 | 後續解除條件 |
| --- | --- | --- |
| Blender latest | 多頁直接開啟回 402；官方搜尋索引可讀，故 B1–B5 記 SEARCH_ONLY。5.2 是索引版本標籤，未確認為當日最新產品版 | 能直接讀取對應版本文件或安裝後任務驗證；不繞過存取限制 |
| Blender Outliner | latest 正文未取得，精確最新行為 UNKNOWN；B6 為 2.81 舊官方頁 | 取得目標版本 Outliner 官方頁 |
| Sound Particles manual | 官方 PDF 24,631,526 bytes，超過 web 開啟限制；相機鍵位僅官方索引，UNVERIFIED | 依法本機閱讀所需少量頁；本次沒有下載整份 |
| FMOD | 2.04 URL 的 Authoring 內容標頭出現 2.03，Sandbox/Glossary 多為 SEARCH_ONLY | 固定正式採用版本後重核；不能宣稱 2.04 全部實機驗證 |
| Wwise | W2 直接 open 未成功，SEARCH_ONLY；edge 文件浮動，與 2024.1 參考分開 | 固定版本並在有授權 runtime capture 實測 |
| ODEON | O1 相機／材料操作為 v13；O3 v19 結果以官方搜尋索引取得。產品 edition 不同 | 固定 edition/version 再實測，不混版背書 |
| 所有產品 | 沒有任務時間、錯誤率、可及性符合報告 | 下方本地使用者測試；文件研究不能代替操作測試 |

## 官方來源索引

| ID | 來源／版本 | 存取 |
| --- | --- | --- |
| U1 | [Unity Editor windows reference, 6000.3](https://docs.unity.com/en-us/engine/6000.3/manual/unity-editor/editor-windows-views-reference) | READ |
| U2 | [Unity Scene view navigation, 6000.0](https://docs.unity3d.com/6000.0/Documentation/Manual/SceneViewNavigation.html) | READ |
| U3 | [Unity Inspector reference, 6000.0](https://docs.unity3d.com/6000.0/Documentation/Manual/UsingTheInspector.html) | READ |
| U4 | [Unity Game view, 6000.0](https://docs.unity3d.com/6000.0/Documentation/Manual/GameView.html) | READ |
| U5 | [Unity Positioning GameObjects, 2018.3](https://docs.unity3d.com/cn/2018.3/Manual/PositioningGameObjects.html) | LEGACY_REFERENCE |
| U6 | [Unity Selection API](https://docs.unity3d.com/ja/current/ScriptReference/Selection.html) | READ、current 浮動 |
| B1 | [Blender Workspaces, latest](https://docs.blender.org/manual/en/latest/interface/window_system/workspaces.html) | SEARCH_ONLY |
| B2 | [Blender Navigation, 5.2](https://docs.blender.org/manual/en/5.2/editors/3dview/navigate/navigation.html) | SEARCH_ONLY |
| B3 | [Blender Properties Editor, 5.2](https://docs.blender.org/manual/en/5.2/editors/properties_editor.html) | SEARCH_ONLY |
| B4 | [Blender Object Modes](https://docs.blender.org/manual/en/latest/editors/3dview/modes.html) | SEARCH_ONLY |
| B5 | [Blender Viewport Gizmos](https://docs.blender.org/manual/en/latest/editors/3dview/display/gizmo.html) | SEARCH_ONLY |
| B6 | [Blender Outliner, 2.81](https://docs.blender.org/manual/en/2.81/editors/outliner.html) | LEGACY_REFERENCE |
| S1 | [Sound Particles 2 Tutorial — Overview](https://blog.soundparticles.com/sound-particles-2-tutorial-overview) | READ |
| S2 | [Sound Particles Technical Specifications](https://www.soundparticles.com/products/soundparticles/specs/) | READ、含 SP3 |
| S3 | [Sound Particles Reference Manual](https://soundparticles.com/assets/files/support/soundparticles_manual.pdf) | 正文開啟失敗、索引有限 |
| T1 | [Treble Quick start guide](https://docs.treble.tech/user-guide/getting-started/quick_start_guide) | READ |
| T2 | [Treble Reflection tracking](https://docs.treble.tech/user-guide/results/reflection_tracking) | READ |
| T3 | [Treble Setting up an auralization](https://docs.treble.tech/user-guide/auralizer/auralizing_your_space) | SEARCH_ONLY |
| W1 | [Wwise Profiling and Troubleshooting, 2024.1.5](https://www.audiokinetic.com/library/2024.1.5_8803/?id=profiling_and_troubleshooting&source=WwiseFundamentalApproach) | READ |
| W2 | [Wwise Game Object 3D Viewer, 2024.1.8](https://www.audiokinetic.com/en/public-library/2024.1.8_8898/?id=game_object_profiler_game_object_3d_viewer&source=Help) | SEARCH_ONLY |
| W3 | [Wwise Rooms and Portals setup](https://www.audiokinetic.com/library/edge/?id=spatial_audio_roomsportals_wwisesetup.html&source=sdk) | READ、edge 浮動 |
| W4 | [Wwise Rooms and Portals overview](https://www.audiokinetic.com/en/library/edge/?id=spatial_audio_roomsportals_apioverview.html&source=SDK) | READ、edge 浮動 |
| F1 | [FMOD Authoring Events](https://www.fmod.com/docs/2.04/studio/authoring-events.html) | SEARCH_ONLY、版本標頭不一致 |
| F2 | [FMOD The Sandbox](https://www.fmod.com/docs/2.04/studio/the-sandbox.html) | SEARCH_ONLY |
| F3 | [FMOD Profiling](https://fmod.com/docs/2.04/studio/profiling.html) | READ |
| F4 | [FMOD Glossary — 3D Preview](https://www.fmod.com/docs/2.04/studio/glossary.html) | SEARCH_ONLY |
| O1 | [ODEON Industrial Quick Start Guide v13](https://www.odeon.dk/pdf/QuickStartGuideIndustrial.pdf) | READ，2015；相機 p8、材質 p10–11、Billiard p14 |
| O2 | [ODEON Features and Specifications](https://odeon.dk/product/features/) | READ |
| O3 | [ODEON Combined Quick Start Guide v19](https://odeon.dk/download/Version19/QuickStartGuideCombined.pdf) | SEARCH_ONLY |
| O4 | [ODEON Workshop Program and Instructions, 2024](https://odeon.dk/pdf/ODEON_Workshop_program_and_instructions_PostWorkshop.pdf) | SEARCH_ONLY，§5.5–5.6 |
| O5 | [ODEON early reflectogram vs full response](https://odeon.dk/faq/i-use-odeon-to-simulate-the-spatial-sound-field-distribution-at-a-receiver-odeons-reflectogram-in-the-single-point-response-displays-only-the-early-part-what-about-the-rest-of-the-response/) | 官方限制說明 |
| G1 | [Facepunch — Spawning Props](https://wiki.facepunch.com/gmod/Spawning_Props) | READ |
| G2 | [Facepunch — Opening The Spawnmenu](https://wiki.facepunch.com/gmod/Opening_The_Spawnmenu) | READ |
| G3 | [Facepunch — Using your Physgun](https://wiki.facepunch.com/gmod/Using_your_Physgun) | READ |

## 後續 UX 驗證（NOT RUN）

以三名初次使用者＋兩名音訊／3D 工具使用者作形成性測試，樣本僅找操作問題，不作統計推論。每人依 [USER_FLOWS.md](USER_FLOWS.md) 完成建立、投擲、FPS Build、選取反射、Raw/Simulated 與材質 A/B；記錄完成率、需要提示次數、誤丟物、誤 Reset、找不到退出的方法。目標為無關鍵資料遺失、無焦點陷阱、無假的聲學證據；時間目標先取 baseline 再訂，不能現在填 PASS。
