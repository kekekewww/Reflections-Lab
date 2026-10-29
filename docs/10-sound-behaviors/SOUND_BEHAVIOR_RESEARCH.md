# Sound Behavior 可行性與成熟工具研究

查核日：2026-10-27（Asia/Taipei）。狀態：**DOC_REVIEWED／架構建議；四套工具與本案音訊 runtime 均未實機驗證**。本文件提供選型依據；事件規格、schema、傳播與驗收分別維護於同目錄專文及既有 [Audio Runtime](../02-architecture/AUDIO_RUNTIME.md)，不另造第二份 DSP 契約。來源版本、讀取限制與權利見 [metadata](../../research/sound-behaviors/middleware-sources.json)。

## 結論與可宣稱範圍

這個功能值得成為正式核心，但應以「**可解釋的物理事件＋自由音色規則＋統一聲學傳播＋可追溯實驗**」定位，而不是重建完整音訊工作站。這是依現有需求與 API 分層作出的工程判斷，沒有使用者研究、效能數字或產品完成證據。成熟工具已具 events、參數、程序音訊、移動聲源，甚至自然語言助手；不能宣稱 Reflection Lab 首創其中任一單項。

MVP 採 **Event Rules＋正交狀態機＋Inspector**。Held、Moving、Contact、Sleeping 是可組合的狀態維度，不能放進單一互斥列舉；被抓住的球仍可能碰牆。規則決定「何時／播放什麼／如何映射」，DSP 決定「怎麼生成波形」，Acoustic Core 決定「如何傳到接收者」。Node Graph 留 P2，不能將音訊圖當作物理接觸分類器。

## 四套工具的可借鑑原理

| 工具／實讀版本 | 可直接借鑑的概念 | Reflection Lab 採用方式 | 本次不採用／限制 |
| --- | --- | --- | --- |
| **FMOD Studio 2.04.00，2026-09-29** | Event 定義與多個獨立 instances；local/global parameters；instruments、parameter conditions、automation、bus routing | 共用版本化 Profile，物件持有獨立 instance/state；條件與曲線使用白名單資料，不執行使用者 JS | 不做完整 banks、mixing desk、音樂轉場系統；不把 FMOD runtime 加入主線 |
| **Unreal MetaSounds，官方頁 UE5.8** | typed DSP dataflow、trigger/audio-rate pins、Source/Patch/Preset、參數輸入、sample player／envelope／filters | 小型生成器介面、可重用 preset＋覆寫、明確 control/audio boundary | UE 整合不是本案 Web SDK；sample-accurate audio trigger 不會把 Rapier 固定步事件變成 sample-accurate 物理量測 |
| **Wwise，官方公開 headers v2017.2.0 build6500** | Event／Playing ID、object/global RTPC、Switch／State、獨立 spatial／monitor 層 | event→rule→instance→emitter→voice decision 的可追蹤鏈；材質類別與連續參數分開 | 現行 help 直接開啟403，僅以明示舊版 API 證明設計原理；不宣稱2026 SDK、Web支援或發行授權已驗 |
| **Sound Particles 2 tutorial／3 ADM tutorial** | 聲源與虛擬麥克風、移動／音訊 modifiers、automation timeline、ADM object budgeting | 發聲位置與 waveform 分開；可檢查的軌跡／事件 timeline；超額有明示優先政策 | 不做大量粒子工作站、ADM交付／外掛宿主；SP2與SP3功能不可混為一版；產品規格頁本次只回JavaScript shell |

### FMOD：事件、實例、參數與觀測分開

Event 可以共用，播放出的 instances 可有不同 local parameters 與3D位置；instruments產生內容，再經 tracks／master route。參數可用曲線控制屬性或限制觸發條件，適合借鑑「速度映射 gain、材質配對選音色」；本案仍須自行加入固定步去重與 replay 身分。[Authoring Events](https://www.fmod.com/docs/2.04/studio/authoring-events.html)、[Parameters](https://www.fmod.com/docs/2.04/studio/parameters.html)

Profiler 將錄音回放與 API calls 重算分開；simulate 的隨機 playlist 可能改變結果。Reflection Lab 因此應保存 selected variant／seed、實際 playback parameters 與 trace，不能將重送 API 當作相同聲音或相同物理運動的證明。[Profiling](https://www.fmod.com/docs/2.04/studio/profiling.html)

本次2.04官方頁正文與版本尾註已可讀，改善舊 [UX 調查](../05-ux/COMPETITIVE_UX_RESEARCH.md) 的 SEARCH_ONLY／版本不一致限制；不回寫舊查核歷史。HTML5文件確有 WASM／Web Audio 支援，但列出 geometry、browser-runtime Live Update／Profiling 等限制及 callbacks／threads 條件；它不是直接替代 Custom Acoustic Core 的證據。授權頁另區分 game 與 non-game 專案，不能由免費下載或特定 Indie 條件推定本案已獲散布權。[HTML5](https://www.fmod.com/docs/2.04/api/platforms-html5.html)、[Licensing](https://www.fmod.com/licensing)

### MetaSounds：DSP 圖不等於遊戲狀態機

MetaSound 是音訊 dataflow，不是 Blueprint execution graph。Source產生聲音，Patch重用片段，Preset繼承圖並覆寫輸入；可借鑑 Profile／instance分離。Trigger能在音訊block內表達sample位置，但連到非audio-rate節點時可能成為block-rate結果。Reflection Lab應保留 physics tick 精度與 audio scheduling 精度的區別。[Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine)、[Reference Guide](https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-reference-guide-in-unreal-engine)

Wave Player、seeded variants、envelope、filters 與 typed trigger nodes 是可借鑑的生成原理，並非採用其C++或UI資產。固定seed只約束對應隨機序列，不能推成完整跨平台物理重播逐位元一致。UE授權另有產品條件，本次沒有採用引擎或驗證獨立Web SDK。[Function Nodes](https://dev.epicgames.com/documentation/en-us/unreal-engine/metasound-function-nodes-reference-guide-in-unreal-engine)、[UE Licensing](https://www.unrealengine.com/license)

### Wwise：scope 與實例識別比全域布林值重要

公開舊header可直接核實 `PostEvent`／Playing ID、RTPC的global／object scope與插值參數，Switch指定game object而State不指定；它支持將物件級材質分類、連續值與共享環境狀態分層的設計。[AkSoundEngine.h](https://raw.githubusercontent.com/audiokinetic/WwiseIncludes/master/SDK/include/AK/SoundEngine/Common/AkSoundEngine.h)

Spatial header將emitter位置、rooms／portals與反射處理分開；Monitor以playing/object/node IDs連結錯誤。可借鑑事件追查，但查詢可能等待音訊鎖，不能照抄成audio callback同步查詢。這些是**2017.2歷史API證據**，不是當前SDK測試；header公開也不代表完整engine、authoring UI或素材可自由嵌入。[AkSpatialAudio.h](https://raw.githubusercontent.com/audiokinetic/WwiseIncludes/master/SDK/include/AK/SpatialAudio/Common/AkSpatialAudio.h)、[AkQueryParameters.h](https://raw.githubusercontent.com/audiokinetic/WwiseIncludes/master/SDK/include/AK/SoundEngine/Common/AkQueryParameters.h)、[AkMonitorError.h](https://raw.githubusercontent.com/audiokinetic/WwiseIncludes/master/SDK/include/AK/Tools/Common/AkMonitorError.h)、[官方repository](https://github.com/audiokinetic/WwiseIncludes)

### Sound Particles：運動 metadata、音色與輸出格式不同

SP2官方教學可實讀 particle tracks、虛擬麥克風、movement／audio modifiers、timeline與Inspector；移動來源和聲音變化分開，與本案保持實際physics transform、使用者音色及聲學處理三層相容。但其粒子運動設計不能取代本案Rapier接觸求解。[SP2 Overview](https://blog.soundparticles.com/sound-particles-2-tutorial-overview)

SP3的官方ADM教學說明位置／軌跡metadata、object／bed分類、object數量限制及共享。這對本案voice／emitter分離與timeline有啟發，並不等於本案要實作ADM。舊SP2 FAQ曾不支援object export，不可用它否定SP3的ADM能力；本次產品／spec／trial頁直接讀取只有JS shell，因此不以搜尋摘要推定版本、容量或使用權。[SP3 ADM Tutorial](https://blog.soundparticles.com/how-to-export-adm-files-with-sound-particles-3)

## 重用 API 與必須自製的界線

| 層 | 重用 | 本案仍須自製／驗證 |
| --- | --- | --- |
| 音訊 primitives | Web Audio sample／loop、Oscillator、Gain、Biquad、AudioParam automation；需要時才加入AudioWorklet | asset預載／授權registry、持久continuous instance、one-shot lifecycle、voice admission／steal與telemetry |
| 物理 | Rapier collision／contact／velocity資料 | canonical pair／episode、contact aggregation、顯式Grab/Throw、去重／hysteresis及事件版本 |
| 行為 | 固定曲線插值與列舉條件資料 | Profile／Rule revision、有限白名單、override規則、cooldown scope、stable IDs及原子Undo/Redo |
| 傳播 | Web Audio作渲染 primitives，原Acoustic Core契約維持 | source/contact位置、solver能力、唯一delay/gain/HRTF責任、過期frame及計算預算 |
| 錄放／AI | 既有固定步trace與validated tool envelope | 音訊事件／variant／instance／asset hash記錄，跨revision A/B；Muse只提出合法操作，不生成數值或任意程式 |

Web Audio標準提供排程與automation，但 `AudioBufferSourceNode.start()`不能呼叫第二次。應重用decoded buffer與instance管理器；持續loop保留其運行node，新的one-shot建立新的source node，不能把「pooling」寫成已停止source可重新start。這是規範能力，不是本案browser／click-pop合格證據。為避免把浮動draft誤稱已定標準，基礎API引用固定2021 Recommendation；目前 `/TR/webaudio/` 轉向1.1 Working Draft，不以其存在推論browser全部支援。[Web Audio REC §§1.6、1.9](https://www.w3.org/TR/2021/REC-webaudio-20210617/)

## 聲音創作與科學主張

Physical Preset若只是依材質選sample或調EQ，應標 physical-inspired／perceptual approximation；它不是已模擬物體振動。Creative Preset可用鋼琴、合成器等聲音；Hybrid可將兩者疊加，但仍需逐instance保留正確發聲點與同一傳播契約。不同位置的layers不能先混成物件中心的單一訊號，否則會失去contact位置。

材質配對可選音色，但不能因此覆寫聲學材質的Measured／Derived／Tuned／Synthetic標籤；更換sample不等於改變牆面吸收。No Gravity不等於真空；真空無空氣傳聲也不取消機械碰撞。這些界線沿用 [DSP Models](../../research/theory/DSP_MODELS.md) 與 [Audio Runtime](../02-architecture/AUDIO_RUNTIME.md)。

競賽可展示的重點是：同一個真實motion/contact trace，從預設撞擊改成創意音階，檢查trigger／rule／asset／聲源位置，再比較有來源的聲學結果；產品Muse透過受驗證tools建立設定並保留preview／undo。這是展示建議，不是已實現功能或新穎性／合規認證。P0先做Audio Event Runtime、有限rules與Inspector；Rolling／Sliding、material pairs與timeline視前置驗收升為P1；完整Graph、modal synthesis、外掛宿主及大量粒子創作留P2。

## 驗證與未解限制

| Claim ID | 重要主張／條件 | 證據狀態 |
| --- | --- | --- |
| SB-MW-C01 | Event定義、播放instance與local參數分開；FMOD2.04 | DOC_REVIEWED，SB-MW-FMOD-EVENTS／PARAMETERS |
| SB-MW-C02 | FMOD HTML5有平台限制，不等於本案完整Web聲學替代方案 | DOC_REVIEWED＋工程推論，SB-MW-FMOD-HTML5 |
| SB-MW-C03 | MetaSounds的音訊sample timing不提高物理事件的觀測精度 | DOC_REVIEWED＋跨clock工程推論，SB-MW-UE-REFERENCE；非本案DSP測試 |
| SB-MW-C04 | Wwise object/global參數與Playing ID可作分層參考 | PRIMARY_SOURCE_READ_LEGACY，SB-MW-WWISE-ENGINE；只限公開2017.2 header |
| SB-MW-C05 | SP2與SP3的object export能力不可混用 | DOC_REVIEWED，SB-MW-SP2-OVERVIEW／SP3-ADM；未驗軟體 |
| SB-MW-C06 | AudioBufferSourceNode不能二次start；decoded buffer與已停source不是同一種pool資源 | SPEC_REVIEWED，SB-MW-WEBAUDIO-REC2021；browser實測NOT RUN |
| SB-MW-C07 | P0以Event Rules＋正交狀態機／Inspector，Graph留P2 | ENGINEERING_INFERENCE，依本案前置缺口與上述比較；非普遍優越性研究 |

本文件通過的是原始來源閱讀與版本／存取分類；**沒有安裝或執行FMOD、Unreal、Wwise、Sound Particles，沒有量測其latency／voices／memory，也沒有下載商業素材**。Web API規範不代表本案AudioWorklet、HRTF、device output、聽測或spatial propagation已驗證。Root整合報告應另列實際schema／隔離spike結果及NOT RUN，不把本比較表當benchmark。

目前最大的前置工作仍是正常Scene／Physics host與Audio Event Runtime，而不是Graph Editor。取得可重現事件、不中斷的continuous playback與同一聲學routing後，才有條件評估作者體驗及裝置效能。效能數值沿用既有正式預算與實測流程，不能從廠商行銷容量移植成本案承諾。
