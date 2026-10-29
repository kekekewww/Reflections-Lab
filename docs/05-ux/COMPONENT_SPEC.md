# 介面元件與資料規格

查核日期：2026-10-26。狀態：**設計完成／實作與元件測試 NOT RUN**。以下為 UI 讀模型與互動契約草案；Domain schema、backend contract、DSP 規格才是正式數值／能力定義的來源。元件不得自行捏造聲學數據。

## 共通契約

互動七態與所有元件完整覆蓋見 [COMPONENT_STATES.md](COMPONENT_STATES.md) 及其機讀權威 [COMPONENT_STATES.json](COMPONENT_STATES.json)；視覺值只讀 [DESIGN_TOKENS.json](DESIGN_TOKENS.json)。資料狀態不取代 focus/active/disabled 等互動維度。

所有非同步元件支援 `idle/loading/ready/empty/stale/error/unsupported`，空值不是 0，缺能力不是 error。每筆結果具 source/listener、scene/material/backend version、run/tick/frame/time、單位、模型與 provenance。數字編輯先本地驗證，再由 Domain Command 驗證；error 文字連到欄位，保留原輸入。Inspector 變動有 pending／committed 回饋；一段連續拖曳只形成一筆 Undo。

共用 `SelectionRef` 見 [WORKSPACE_ARCHITECTURE.md](WORKSPACE_ARCHITECTURE.md)。hover/selection/pinned comparison 各自獨立。選取更新不可使正在編輯的欄位無聲丟失；提交／取消後才切脈絡，或顯示合理的未提交狀態。

## 元件清單

| 元件／優先級 | 輸入及主要狀態 | 操作與輸出 | 鍵盤／可及性與失敗 |
| --- | --- | --- | --- |
| **ProjectBar** P0 | project、document dirty、save status、Workspace | 切 Workspace、儲存、匯出；不 Reset | 明確標籤／焦點順序；save failure 可 Retry |
| **SimulationTransport** P0 | Ready/Running/Paused/Error、runId/tick、pause cause | Run/Pause/Resume/Reset；Capture/record 分開 | 不能僅靠三角圖示；Reset 指明目標 revision；錯誤停用動作有原因 |
| **SceneExplorer** P0 | object tree、selection、filter、lock／visibility | 選取、命名、複製、刪除、reparent（有 Domain 支援才顯） | 方向鍵 tree pattern、F2／明示命名、刪除可 Undo；hidden 不等 disabled／muted |
| **ObjectLibrary** P0 | primitive/preset、source/license、search/filter | 選後產生 draft；Scene 或 FPS ghost | list keyboard selection、Enter 選取；資產 loading/error 不造半成品 |
| **Viewport** P0 | view camera、listener binding、selection、mode、backend layers | raycast/gizmo/orbit/FPS；frame selected | 有標題與 mode；可見進入/退出／非 lock 替代；canvas 不承擔唯一路徑 |
| **TransformInspector** P0 | author/runtime target、m/deg、revision | position/rotation/scale、grid/alignment | 各軸 labels；可輸入不用拖曳；running 不可硬改 dynamic transform |
| **PhysicsInspector** P0 | body mode、mass kg、gravity、friction、restitution、collision profile | 可撤銷設定；Fixed/NoGravity/Dynamic 清楚分別 | 身體模式先驗證；不可用欄位有理由；數值範圍來自 schema |
| **SoundEmitterInspector** P0 | asset/checksum、loop/gain/directivity、source state | play/stop、loop、source gain；collision profile 另 section | loading/decoded/playing/stopped/blocked 不混；continuous 與 impact 各自 mute |
| **AcousticSurfaceInspector** P1 | geometry ID、material/version、bands、provenance | absorption/transmission/scattering、厚度等 capability 欄位 | 表格具頻率/單位/定義；超能量限制阻擋；不同 backend 轉換需可查 |
| **ListenerInspector** P0 | position/orientation、follow state、HRTF、monitor | follow FPS／unbind、move to view、monitor | 把 observer 和 listener 區分；未提供 HRTF 不能顯已啟用 |
| **FPSHud** P0 | hover、holding/ghost、實際鍵位、physics state | 情境提示、距離、固定/建造、pause | 不僅顏色；有 toggle／按鈕替代 chord；詳見 FPS 文件 |
| **EventTimeline** P0/P1 | physics/audio events、tick/time、recording gaps | filter、select event、seek replay | 表列替代時間軸；事件密集時聚合可展開，不刪資料 |
| **AcousticLayerPanel** P1 | capability、result/frame、path filters | Direct/Reflection/Transmission/Occlusion／direction layers | 圖例＋線型＋文字；unsupported disabled 有原因；顯示數/總數 |
| **PathTable/Inspector** P1 | 實際 path set、SelectionRef | 選取、pin frame、copy/export metadata | 與 3D linked；方向鍵／排序欄；排序不改 identity |
| **IR/MetricsDock** P1 | IR/BRIR、sample rate、metric validity | time/frequency/band、EDC、指標、表格匯出 | x/y 單位、定義、空值原因；unsupported 不放裝飾曲線 |
| **ComparisonPanel** P1 | A/B snapshots、diff、comparable flags | linked view、聆聽、報告 | 顯示條件差異；同圖尺度預設一致；不可比不隱藏 |
| **MonitorStrip** P0/P1 | context、mute、gain、clip、routing Raw/Simulated | 啟用聆聽、Master Mute、monitor gain、reference switch | 各 Workspace 常駐可達；不依賴 lock；blocked 顯原因 |
| **AICommandPalette** P1 | prompt、job state、validated diff、budget | draft/preview/apply/cancel/undo | IME 支援；不跨越焦點執行 FPS；錯誤保留 prompt |
| **Status/EvidenceBadge** P1 | provenance/validation/capability/freshness | 展開來源、模型假設與限制 | badge 有文字；沒有 confidence 不填百分比 |

SceneExplorer 的 visibility 指渲染，physics enabled、acoustic participating、emitter muted 必須為各自欄位；隱藏牆不能默默讓聲音穿過。多選 Inspector 顯 mixed values，不用第一個物件的值冒充全體。釘選 Inspector 有 pin icon 和資料版本，避免使用者以為看到新選取。

## 三類 Inspector 範例

```text
Acoustic Wall                         Physical Sphere
名稱／ID／revision                    名稱／ID／revision
Geometry：尺寸 m、surface IDs         Transform：m / deg
Surface Material：ID、version         RigidBody：Dynamic / NoGravity / Fixed
Evidence：Measured/Derived/Tuned/Synthetic  Mass kg / Friction / Restitution
Bands：Hz、absorption 定義             Collision：profile / CCD support
Transmission：定義、厚度、loss         Sound Emitter：asset / loop / source gain
Scattering：模型／係數                 Collision Audio：profile / trigger
Backend mapping／limits               Runtime：velocity、held、blocked（唯讀）

Audio Listener
Transform／Orientation／up-forward convention
跟隨：FPS / 錄製軌跡 / 手動（有明確切換）
Renderer：HRTF / stereo / unavailable
Monitoring：device/context、gain、mute
Observer camera：獨立；[移至目前相機] 為顯式命令
```

Measured/Derived/Tuned/Synthetic 是與專案 `dataClass` 對齊的材料來源層級；Synthetic 可加「示範」文字別名但不得合併 Tuned。Computed/Estimated/Measured 是結果來源；AI-generated Explanation 只標解釋。這些 badge 不能混為「可信度高低」。

## 可選取聲學路徑

| 欄位 | 顯示規則／缺值處理 |
| --- | --- |
| identity | `resultId/frameId/pathId` 必填；stable ID 由 solver 產生，不用視圖索引 |
| topology | path type、reflection order、依碰撞順序列 surface IDs；geometry revision 必填 |
| geometry | polyline vertices、total distance m；observer camera 不影響計算 |
| timing | absolute propagation delay ms；relative-to-direct delay ms，明示基準 path ID；與 DSP/device latency 分別顯示 |
| frequency response | band centers Hz、attenuation quantity（amplitude/energy/level）、reference；不能只寫「衰減 0.5」 |
| direction | arrival azimuth/elevation deg 或向量，標座標系；沒有 orientation 不能推角度 |
| material contributions | 每次 surface contribution 的定義、頻帶、來源；backend 無分解則顯未提供，不把總值任意均分 |
| model | solver/backend/version、scene/material version、direct/reflect/transmit assumptions |
| confidence/limits | 有正式定義才顯 confidence；否則 `未提供`＋validation level／model limitation；抽樣噪聲與模型不完備分開 |

### 圖層編碼

Direct 實線；Reflection 帶節點折線並標階數；Transmission 虛線並在穿透處標記；被阻擋候選僅在 debug 顯示且標 `未通過 visibility，不送音訊`。Scattering 若僅聚合能量以區域／直方圖呈現，不偽裝成確定單一路徑。Source 指向箭頭、Listener 朝向分開；energy 顏色／粗細必有量綱與圖例，與 selection 高亮顏色分離。

頻帶切換只影響當前顯示量；line width 不是聲壓校準。碰撞事件用 contact marker＋timestamp，與聲線分組。相交的多條線可從表格選或候選清單 cycling。大場景有顯示上限與「顯示前 N 條」；不是 solver 真的只有 N 條。凍結 frame＋pin selection，避免動態路徑 birth/death 造成 Inspector 跳物件。

## IR、頻譜與指標

IR x 軸以相對 source emission 的時間；實際到達、DSP block 與設備輸出延遲分開。IR y 軸必註明 amplitude/energy／digital reference；沒有校準不能標 dB SPL。EDC、RT60/EDT/T20/T30、DRR、C50/C80 依 solver 實際支援與有效 fit 顯示；有限 IR 長度、不足動態範圍、沒有 direct separation 時說明 invalid/unsupported，不能填 0 或推導成量測值。

每圖可切表格、有可讀摘要與資料匯出；hover tooltip 不作唯一讀值方式；可鍵盤選時間／到達事件。相同 A/B 圖預設同軸域與 band；log scale／normalization／smoothing 有常駐標記。音訊 spectrum dBFS、RIR normalized dB、聲學 solver 的相對能量不能在無轉換說明時疊成同一量綱。

## Raw／Simulated monitoring contract

這是本產品的顯式定義，不假定其他工具也用同一 Raw 語意。

| 模式 | 路由 | 固定內容 | 顯示 |
| --- | --- | --- | --- |
| `Raw` | 同一乾音 source/event → monitor gain → output，置中參考；bypass distance、delay、occlusion、material、reflection/reverb、HRTF | event identity、asset/seed/playhead、source gain 不變 | `乾音參考：無環境／空間化處理` |
| `Simulated` | 同一 source/event → backend 可支援的 propagation → spatial renderer → monitor gain → output | 同上；不同輸出功能明示 | `模擬：backend/version，啟用項目` |

不加「Raw 比較」就自動消除兩路延遲：預設保留環境傳播差異；如加 audition alignment，必須顯示補償量且只改 monitor。切換由 audio timeline 交叉淡化，目標初值 20 ms（設計參數，須 DSP spike 驗證），不以 CSS animation 或 requestAnimationFrame 量測。不能重啟 AudioBufferSource 或重擲隨機樣本。若無能力維持同一 playhead，停用即時切換並改成明示同事件 A/B rendering，不能假裝無縫。

模擬 Pause 另採 Workspace 文件的 `Freeze-and-fade`：凍結 logical source offset、取消舊 epoch 排程並保存 pending arrivals，Resume 重新錨定與去重；截斷尾音有 marker，Paused audition 使用獨立時間。不能將「切換不重啟 source」誤讀為 Pause 時仍放任原實驗 source 持續前進。

Level match 為可選監聽輔助，預設關閉；顯 gain offset 與方法，不能改 raw metrics／scene source gain。多源／impact 比較綁定同一 captured event stream，避免 Raw／Simulated 聽到不同的碰撞。Raw 不是 unmuted，也不是 free-field 模型；如日後提供「保留 HRTF 的 direct-only」應另命名與路由，不改 Raw 定義。

Monitor 預設 muted；使用者點啟用後起始 gain 建議 -18 dB 相對 unity（產品預設，並非已校準的安全聲壓）。Master Mute 可在所有 Workspace 透過鍵盤抵達，不改 source/physics/record trace。clip meter 僅表示 digital clipping；不能推估耳機 dB SPL，若有 limiter 也不能宣稱保證聽力安全。任意素材可能有過大 transient，因此保持清楚音量控制、明示 enable、避免模式切換增益突升，是介面要求；沒有做暴露量測就顯「實際 SPL／暴露未知」。本次無播放測試。

## 可及性與高密度互動

使用原生 button/input/select/table 優先。樹、tabs、dialog 等若採自製 widget，依 [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) 模式定義焦點；Canvas 外提供等值列表／數字欄／播放預設軌跡。拖曳具 click／數字輸入替代；圖表及路徑提供 table selection。`aria-live` 只報重要狀態（已暫停、建立失敗、錄製開始），不逐幀唸 tick／hover／energy。

WCAG 2.2 為設計目標，非本次已驗證的符合性。AA 文字／非文字對比、鍵盤可退出、焦點可見／不完全遮蔽、拖曳替代、目標大小與音訊控制需在實作後檢查；縮放與 panel docking 不得遮住 Master Mute 或退出鍵提示。

## 整合驗收（NOT RUN）

- object/path/event/IR 選取在 3D、表格、Inspector 一致；刪除／失效引用不指到另一物件。
- unavailable 值以原因代替 0；錯誤、過期、未計算、未支援可區分。
- 相同音源切 Raw/Simulated 不改 tick/seed/source playhead；音量 match 不改結果。
- listener 跟隨與 observer 相機各有明示狀態；HRTF 不支援不顯啟用。
- 材質頻帶、衰減定義與 solver mapping 可追溯；debug 假候選不混進音訊。
- 僅靠鍵盤與非 lock 模式可選取、編輯、錄製預設軌跡、查看／匯出結果；dialog 焦點能退出。

依據（查核 2026-10-26）：[Web Audio API](https://www.w3.org/TR/webaudio-1.0/)、[WCAG 2.2](https://www.w3.org/TR/WCAG22/)、[WAI-ARIA Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。特定 API 實作／相容性仍須對目標瀏覽器驗證。
