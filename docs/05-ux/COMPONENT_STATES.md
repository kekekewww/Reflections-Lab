# 元件狀態與鍵盤契約

更新：2026-10-26。狀態：規範已建立；正式 UI／互動測試 **NOT RUN**。機讀權威為 [COMPONENT_STATES.json](COMPONENT_STATES.json)；本頁解釋其套用方式，不維護另一套數值。資料欄位及 capability 仍以 [COMPONENT_SPEC.md](COMPONENT_SPEC.md) 為準。

每個下列元件都繼承 `Default / Hover / Focus / Active / Disabled / Loading / Error` 七態及 JSON `commonStates` 行為。這些是可疊加的互動維度，並非單一 enum：例如 `Selected + Focus + stale` 可以並存，`Loading` 不自動清掉選取。非互動 badge 不硬加 Tab；它的 metadata disclosure 遵守七態。

| 元件 | Default | Hover | Focus | Active | Disabled | Loading | Error | 額外狀態／profile |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ProjectBar | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／action |
| SimulationTransport | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Paused、Simulating／action |
| SceneExplorer | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／selection |
| ObjectLibrary | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／selection |
| Viewport | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected、Paused、Simulating／viewport |
| TransformInspector | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／input |
| PhysicsInspector | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／input |
| SoundEmitterInspector | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／input |
| AcousticSurfaceInspector | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／input |
| ListenerInspector | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／input |
| FPSHud | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected、Paused、Simulating／viewport |
| EventTimeline | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected、Recording、Paused／selection |
| AcousticLayerPanel | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／selection |
| PathTable/Inspector | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／selection |
| IR/MetricsDock | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／selection |
| ComparisonPanel | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／selection |
| MonitorStrip | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／action |
| AICommandPalette | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／input |
| Status/EvidenceBadge | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | 共通 | Selected／disclosure |

共通態的精確可檢查行為、各 profile 的鍵盤與 active 規則由 JSON 展開；`node scripts/setup/emil-skills.mjs --standards` 檢查七態、唯一 ID、profile／extension 引用與元件覆蓋。這項檢查不證明 runtime 已實作。

非同步讀模型另有 `idle/loading/ready/empty/stale/error/unsupported`。缺 Listener 是可修復前置條件；未支援 `individualPaths` 是 unsupported；沒有符合篩選的路徑才是 empty；求解異常是 error。各自提供原因，不顯示假的零值或裝飾聲線。

Modal 開啟時先釋放 FPS 輸入、安全暫停並保留 held/ghost；focus 移入、背景不可操作、關閉回 trigger，不自動重鎖。Popover 不全面困住 Tab；Esc 只關閉最上層且不再投擲／丟棄。拖曳有 pointer capture、取消及數字／按鈕替代；掉線或 command revision 失配時保留輸入並重新驗證。Undo/Redo 區分文字編輯、Scene transaction 和 runtime Replay，細節以 Workspace／Physics 規格為準。

每次 UI review 必須記錄：元件、七態實際畫面／鍵盤結果、額外態與 async 態、token 差異、錯誤復原、視覺證據檔、browser/OS/zoom、motion/performance 結果及未跑項目。沒有畫面時只記 `STATIC REVIEW`，不得填 `VISUAL PASS`。
