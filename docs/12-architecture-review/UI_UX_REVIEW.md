# UI／UX 與共用狀態審查

查核日期：2026-10-29（Asia/Taipei）。程式基準：`c210ca882ca8503b322c28884bf1e9f6e9fe126d`；本文件為**STATIC REVIEW／研究建議**。沒有新做真人任務、畫面／鍵鼠／音訊操作或效能量測；不能把碼審、token檢查或競品文件讀取寫成browser visual PASS。本報告不重新設計介面、不改canonical tokens，也不把新建議當作已採納需求。

## 1. 判斷

保留目前三工作區與單一domain runtime，先改善**選取、目前有效Listener與操作目標的一致性**，再整理資訊層次與同一模式下的入口。沒有證據支持全面重做版面。物件、physics mode、listener pose、run／recording、聲學結果必須共用權威資料；面板可以有局部草稿及開合狀態，但不能另存互相偏離的物理真值。

目前 `App` 用同一個 `useSyncExternalStore` 模型供給Explorer／Viewport／Inspector／AnalysisDock，`LabAction`再交給domain runtime。作者物件DTO與runtime interpolated pose分離，Inspector已標作者設定；這些是應保留的基礎。見[App](../../src/ui/App.tsx)、[contracts](../../src/ui/contracts.ts)、[runtime](../../src/app/runtime.ts)、[view projection](../../src/app/view-projection.ts)。

前次真人回報有第一人稱不可用與UI混亂；之後已存在分項browser修補證據，但正常100%真人FPS／Pointer Lock／IME及指定裝置聽測仍待實際結果，不能將歷史回報直接稱現行必然重現。完整V1未完成，正式600秒性能負面結果也保留。200%必要真人gate已由[驗收補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)移除，不重新加入。

## 2. 本地正式規範與來源順序

本輪先讀[Design System](../05-ux/DESIGN_SYSTEM.md)、[Workspace](../05-ux/WORKSPACE_ARCHITECTURE.md)、[Components](../05-ux/COMPONENT_SPEC.md)、[七態矩陣](../05-ux/COMPONENT_STATES.json)、[FPS UX](../05-ux/FPS_INTERACTION_UX.md)、[輸入控制](../04-physics/INPUT_CONTROLS.md)、[Motion Guidelines](../05-ux/MOTION_GUIDELINES.md)及[固定Emil來源](../05-ux/EMIL_SKILLS.md)。

具體視覺值只取[DESIGN_TOKENS.json](../05-ux/DESIGN_TOKENS.json)，由[src/ui/tokens.ts](../../src/ui/tokens.ts)使用。Emil固定版為 `2d228630ba1446365f614a108cb8252f1feda202`；本次使用 `emil-design-eng` 的層次、立即回饋與Before／After審查原則，不安裝、升版、加入動畫依賴或改上游skill。舊規範的「尚未實作」標頭屬歷史設計時點，與現行程式／證據分開。

## 3. 共用狀態與所有權

| 資料 | 現行權威／呈現 | 建議與不可混淆邊界 |
| --- | --- | --- |
| 作者物件／physics設定 | SceneDocument＋revision，`patchObject`／scene command；ObjectView是投影。 | Explorer、Inspector、Motion若新增，均用同一object ID。不能在Motion再存獨立mode／mass副本。 |
| Runtime pose／velocity | PhysicsWorld fixed step，`getPose`供render插值；速度／held／sleeping投影為唯讀。 | Inspector作者位置不能因目前物體移動而偷偷改起始值；「存為起始狀態」須獨立明示交易。 |
| Object selection | `model.selectedObjectId`、stable ID；刪除選取物件清空，Undo不偷選其他物件。 | 保留現有regression；不要用list index、Rapier handle或排序名次識別。 |
| Listener selection | Listener pose在runtime，但要顯示Listener Inspector目前由App局部 `showListener` 控制；選Listener會清object selection。 | 可先補同一presentation adapter與selected語意；未來才評估typed `object/listener/environment/path/event` selection。不把布林值的存在直接判成runtime bug。 |
| 有效Listener／observer camera | Scene listener、FPS attachment及replay listener各由runtime取值；editor camera獨立。 | 顯示「作者Listener／FPS head／錄製軌跡」來源；Frame selected／觀察相機不可默默改量測接收點。 |
| Event／path selection | `selectedEventId`／`selectedPathId`與真event／path集合對照。 | path消失時保留失效／stale提示，不能將新排序第一條當作原選取；未來typed selection需帶run／frame。 |
| Workspace／layout | workspace由runtime管理，面板寬度／hidden／mobile pane在App局部state。 | 機能上不reset run；後續可分workspace保存layout preferences。不要藉換工作區重建engine。 |
| Recording／results | RecordingHost、immutable artifact、run／scene／method pins。 | 錄製播放游標、作者motion與音訊monitor是不同時鐘；結果頁引用固定run，不能只讀目前Inspector。 |

程式與測試：[穩定選取](../../tests/app/selection-stable-id.test.ts)、[Listener窄DTO](../../tests/app/listener-projection.test.ts)、[錄放](../../src/app/recording-host.ts)、[結果工具](../../src/app/experiment-tools.ts)。shared state不是要求把每個高頻engine object塞進React state；維持fixed-step、插值、solver與audio clocks分離。

## 4. 逐區域審查：Before／After／Why

「After」全部為待評估建議，不表示本研究已修改或取得可用性通過。

| 區域／Before（本次程式觀察） | After（PROPOSED） | Why／驗證方式 |
| --- | --- | --- |
| Workspace：已有Scene／Simulation／Analysis與Run／Pause等共同控制；局部panel偏好共用一組state。 | 保留資訊架構；只有實際需要時，讓每個workspace記住自己的面板配置及觀察相機。 | 工作區是任務視圖；切換不重置run／recording。用Running中跨工作區及held安全pause的流程驗證。 |
| Explorer：object列有selected class／aria-pressed；Listener列沒有對應選取呈現（基準 `SceneExplorer.tsx:79/81/112`）。 | 最小修補候選：傳入目前是否顯示Listener的presentation state，補一致選取樣式及可及名稱／pressed語意。長期統一entity selection後再移除暫時adapter。 | 使用者應知道Inspector目前屬於誰；只改呈現不重做domain。須看100%真畫面、鍵盤及object↔Listener切換，STATIC REVIEW不能代替。 |
| Viewport：R3F／input控制有穩定生命週期；含solver真paths、frame selected、FPS入口、錯誤／fallback。 | 保留場景優先；主畫面只放目前模式的主要操作，診斷與完整限制維持可展開。 | 減少密度仍須保留可查provenance；不能為「乾淨」刪除Mute／Pause／退出／失敗理由。 |
| Inspector：作者transform已標示作者設定，running／replay禁止編輯；rules／binding有本地draft與revision守衛。 | 保留此分離；針對真正任務測試檢查目前物件名稱、ID、作者／runtime標籤是否一眼可辨。進階frequency／hash／mapping逐層展開。 | 避免把畫面目前pose當起始值；先驗證找得到主操作，不再加平行完整表單。 |
| Motion：現行有物理操作、錄製、replay／seek；未找到正式MotionAction editor或CreateMotionAction工具。 | 新功能若另獲採納，加入所選物件的motion分區：明確區分authored action、runtime pose、recorded trace；共用選取與physics mode。 | 不把時間軸外觀當運動可重現性；kinematic clearance／trace pin由domain驗證。既有錄製不是通用keyframe作者工具。 |
| HUD：持有／ghost／模式與無鎖定按鈕可操作；有Grab／Release／Throw／Place等可點入口。 | 依Idle／Holding／Build／Staged只突出當前主動作；保留展開的輔助控制與實際input owner。 | 這些是pointer-lock／操作障礙替代，不宜全部視為冗餘刪除。測Esc／blur／IME、重入lock click不投擲、held切workspace。 |
| Timeline：Events tab有record start/stop、replay、匯出、slider與stable event selection。 | 以「錄製／重播／已儲存／中斷」清楚命名；顯示游標對應run及recorded時間，事件選取定位同一物件／contact evidence。 | 錄製有gap或未finalize不能當完整結果；不能以事件時間軸推論音訊裝置onset。 |
| Acoustic：有paths、metrics、capability／freshness、unsupported原因與comparison。 | 先顯可用結果及必要原因，再展開run／source／listener／band／method／units；同一path在table／3D／details保持ID。 | `0`與null、stale與empty、Computed與Measured分開；IR不能反推出individual paths，有限路徑不能假RT60。 |
| Render：未找到CreateRenderJob schema／executor／UI；現有live monitor、static preview、JSON export。 | 如新增離線render，先有固定scene／motion／listener／output spec與job states，再設Render panel；與即時monitor、預覽、錄製輸出各自命名。 | 不用「播放成功」代替render job完成；不可將提案欄當虛構下載結果。 |
| Palette／AI：現行AI在AnalysisDock的一個tab，支援offline／Meta gate、preview／Apply／Cancel；未找到獨立全域Command Palette。 | 保留現有可用入口；若做全域palette，主要是搜尋並導向現有動作，不重建一套Physics／Listener／Behavior狀態。 | 開Palette時UI／IME擁有輸入；close回trigger，不自動lock／resume；error保留prompt，loading不能假稱全部可取消。 |
| Monitor：全域Mute／gain／Raw–Simulated、context狀態存在；static preview另外有metadata。 | 持續明示「乾音參考／模擬監聽／靜態預覽／錄製重播」的來源及目前可達Mute。 | Preview、正在運算、音訊可聽與artifact成功是不同維度；切模式不能提高source gain或改實驗數字。 |

## 5. 官方競品參考與可轉移原則

查核：2026-10-29。只提操作原則，沒有下載或複製競品介面／素材。推論不是可用性實測；版本／存取限制各列保留，既有詳細研究另見[COMPETITIVE_UX_RESEARCH](../05-ux/COMPETITIVE_UX_RESEARCH.md)。

| 官方來源／取得狀態 | 官方可支持的事實（簡述） | Reflection Lab 設計推論 |
| --- | --- | --- |
| [Unity Studio GameObjects](https://docs.unity.com/en-us/unity-studio/develop/gameobjects/work-with-gameobjects)；READ | Hierarchy、Scene tools與Inspector操作同一GameObject。 | 借用linked selection，不另存物件或physics mode副本；不要求照搬Unity版面或完整component系統。 |
| [Unity 6 Audio Listener](https://docs.unity.com/en-us/engine/6000.0/manual/audio/reference/class-audio-listener)；READ | Listener有世界位置、速度與方向；相機／玩家attachment是常見配置，唯一active Listener是Unity產品規則。 | 顯示目前有效Listener及attachment；Unity的數量限制不能直接當本產品契約。 |
| [Blender Outliner](https://developer.blender.org/docs/features/interface/outliner/)、[Timeline](https://docs.blender.org/manual/en/latest/editors/timeline.html)；官方索引摘錄，正文402 | 索引描述Outliner／Viewport selection同步、Timeline以當前frame／playhead及選取keyframes組織資料。 | Motion與Timeline使用同一物件ID，作者keyframes／recorded replay分開。最新精確鍵位UNKNOWN，不照搬全套快捷鍵。 |
| [FMOD Authoring Events](https://www.fmod.com/docs/2.04/studio/authoring-events.html)；READ | Editor audition instance與game／sandbox instance區分。 | 靜態Sound Preview不能冒充目前physics run；每種播放都標來源。 |
| [FMOD Sandbox](https://www.fmod.com/docs/2.04/studio/the-sandbox.html)；READ | scene map／list與timeline管理同一instance及listener movement，temporary transform override另表達。 | 物件／Listener／時間軸共用identity；runtime override不能暗中寫回作者scene。 |
| [Wwise Fundamentals renewal](https://info.audiokinetic.com/recertification)；READ；library edge Help不可達、overview403 | 官方說明2024.1 Property Editor垂直布局及可調property visibility。 | Inspector維持單一主要入口，按需揭露；此來源不支持宣稱最新Wwise完整Viewer已驗。 |
| [Sound Particles 3 specs](https://soundparticles.com/products/soundparticles/specs/)、[SP2官方概覽](https://blog.soundparticles.com/sound-particles-2-tutorial-overview)；READ，SP2歷史參考 | Time Editor所選track連到Inspector，virtual microphone與獨立render流程。 | render pins必含motion／listener／output format；不將大量粒子創作控制塞入預設單球任務。 |
| [Treble sources／receivers](https://docs.treble.tech/user-guide/simulations/adding_sources_and_receivers/)、[receivers編輯](https://docs.treble.tech/user-guide/simulations/adding_sources_and_receivers/adding_and_editing_receivers)；READ | 同一source／receiver由側欄與3D選取／編輯；無效位置有呈現。 | Listener列／glyph／Inspector同一選取與invalid原因；不直接移植其距離限制當本產品聲學證明。 |
| [Treble Results export](https://docs.treble.tech/user-guide/results/Downloading_and_saving_results)、[Quick start](https://docs.treble.tech/user-guide/getting-started/quick_start_guide)；READ | 結果連到simulation設定及source–receiver pairing，可比較完成simulation並保留設定。 | Acoustic／Compare固定run與方法；不要跟隨可變Inspector悄悄換測量位置。 |
| [ODEON room acoustics](https://odeon.dk/learn/articles/room-acoustics/)、[載入IR分析](https://odeon.dk/learn/video-tutorials/load-ir/)；READ | IR對應特定source／receiver，載入後可分析與查看統計。 | IR／paths／derived metrics分開標；保留原artifact及分析條件，不能用IR圖造幾何聲線。 |
| [Garry’s Mod Spawnmenu](https://wiki.facepunch.com/gmod/Opening_The_Spawnmenu)、[Using Tools](https://wiki.facepunch.com/gmod/Using_Tools)；READ | 選單由cursor接管；選工具／設定／指向套用及Undo流程明確。 | HUD用情境操作、Palette顯目前工具，表單擁有輸入；不照搬鍵位／hold chord或大量生成行為。 |

## 6. 冗餘分類與最小改動策略

| 類型 | 處理建議 | 不應做的事 |
| --- | --- | --- |
| 同動作多入口，服務鍵盤／無pointer-lock替代 | 保留同一LabAction，依模式分組或摺疊，統一label／disabled理由。 | 刪除Grab／Throw等按鈕只因快捷鍵已有。 |
| 同資料多視圖，例如Explorer／Viewport／Inspector | 保留linked views，只共享stable identity與domain DTO。 | 要求只剩一個畫面或複製新physics truth。 |
| 同一設定多套完整編輯器 | 新Motion／Palette以跳轉或同一元件呈現，只有必要參數局部編輯。 | 在每個panel另建Listener／mode／source表單與不同commit規則。 |
| 技術證據常駐擁擠 | 將hash／完整限制／method展開；必要當前錯誤／stale／unsupported保留在操作處。 | 隱藏會改變使用者決策的失敗原因或把未知改成綠燈。 |
| 作者pose與runtime pose看似重複 | 保留兩者，明示用途；runtime唯讀，作者欄走Undo command。 | 為去重而把物理當前pose寫回SceneDocument。 |

最小候選是Listener列選取語意及「目前Inspector目標」一致性，不改求解器、physics、schema或音訊時鐘。完整typed selection、每workspace偏好、Motion／RenderJob／Palette屬後續架構工作，不是本輪微調範圍。

## 7. 建議驗證與目前限制

| 驗證面 | 已有可查證據／本輪狀態 | 若採納改動的最小驗證 |
| --- | --- | --- |
| source／design | canonical tokens、七態矩陣、固定Emil manifest；本輪STATIC REVIEW。 | `node scripts/setup/emil-skills.mjs --check`／`--standards`只作靜態檢查，不報visual PASS。 |
| 選取／Listener | [selection測試](../../tests/app/selection-stable-id.test.ts)、[listener投影測試](../../tests/app/listener-projection.test.ts)已存在。 | object↔Listener↔delete／undo／import／replay不跳ID，Listener呈現與Inspector一致。 |
| 輸入／FPS | [input policy](../../src/ui/viewport/input-policy.test.ts)、[entry coordination](../../src/ui/viewport/fps-entry-coordination.test.ts)、[UI refined browser](../../tests/browser/ui-refined-v2.spec.ts)已有分項。 | 正常100%真browser：focus、IME、Esc、blur、lock失敗、首次click消耗、fallback可達；真人尚未驗的仍NOT RUN。 |
| 錄放／分析 | [linked workflow](../../tests/browser/linked-workflow-v2.spec.ts)、[product refined](../../tests/browser/product-e2e-refined-v3.spec.ts)、[experiment tools](../../tests/app/experiment-tools.test.ts)。 | Recording／replay／capture／compare的run與units／null／stale不變；不新增裝飾假曲線。 |
| 效能 | [C4性能頁](../11-v1/BROWSER_PERFORMANCE.md)保留600秒負面結果。 | 若只補一列選取呈現，不需重跑完整600秒；若動到高頻publish／render／layout才量對應預算。不得宣稱小UI整理已修性能FAIL。 |
| 聽覺／硬體 | 本輪NOT RUN；[真人指引](../11-v1/HUMAN_TEST_GUIDE.md)保留指定設備／路由門檻。 | UI狀態不能替代耳機／喇叭聽測、裝置onset或dB SPL量測。 |

本審查子任務實際使用Node22.17.0／npm11.4.2，執行 `node scripts/setup/emil-skills.mjs --check`（exit0、16來源檔全MATCH）及 `node scripts/setup/emil-skills.mjs --standards`（exit0、75 tokens／19 components、errors=[]；scope明示STATIC TOKENS/STANDARDS ONLY）。沒有新增設計tokens、套件或產品碼。本子任務未重跑runtime／browser／live／裝置／聽測；既有測試連結不是本輪新PASS。官方事實與程式觀察可供採納，所有Before／After建議仍需維持既定驗收與實測分層，不擴張為整體V1完成。

