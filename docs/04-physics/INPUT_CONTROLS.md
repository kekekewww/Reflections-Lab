# 輸入與控制映射

查核日期：2026-10-26。狀態：P0 操作契約；按鍵可重設，尚未進行瀏覽器可用性測試。與 UX 文件的模式、focus 及取消行為保持一致。

## 1. InputRouter 優先序

由高至低：瀏覽器預設解鎖／失焦 → modal / 文字欄位 → gizmo / library → FPS 動作 → 全域快捷鍵。同一 DOM 事件只能被一層消耗；`Tab` 保留可達性焦點，不用來切 Build。文字輸入時 WASD、Delete、Undo 不作用於場景。

輸入事件轉為 `actionId + pressed/released + sequence`；連續動作於固定步取樣，離散命令帶唯一 `commandId`。不得用 OS `keydown.repeat` 重複生成、投擲、鎖定或刪除。顯示使用者鍵盤上的 label，可用 `KeyboardEvent.code` 作預設位置映射，但保留重設與替代 UI。

## 2. 共通行為

| 輸入 | 行為 |
| --- | --- |
| 模式工具列／可設定快捷鍵 | 進 Editor / FPS Simulation；進 FPS 先顯示控制說明 |
| 在「開始／繼續」按鈕按下 | 申請 Pointer Lock；成功後才恢復動作輸入 |
| `Esc`／瀏覽器 unlock | 清所有鍵、停止步進／控制、保留最後有效 Held／ghost，暫停並顯示原因；不自動恢復 |
| blur / hidden | 同上；取消尚未提交的 throw 命令（若有）；resume 需明確動作 |
| `B` | Idle 時 FPS Simulation ↔ FPS Build；Held 時先由使用者輕放／釋放或取消切換；文字欄位內不攔截 |
| `Tab` / `Shift+Tab` | UI focus；若需 UI，先退出 Pointer Lock 並顯示互動面板 |
| `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` | Editor／暫停時 undo / redo；模擬中先提示暫停以免宣稱逆轉物理歷史 |

Pointer Lock 由使用者手勢請求；`lock()` 沒有宣告成功前不可送 FPS 動作，監聽 `pointerlockchange`／`pointerlockerror` 與 addon lock/unlock。取得鎖定用的 click 必須消耗，不得同時 throw／place。原始滑鼠 `unadjustedMovement` 不支援時允許回退一般模式並保留設定；不能連續自動請求鎖定。[IC-01]

解鎖後安全暫停並保留 hold controller 設定／solver velocity／ghost 最後有效快照，暫停期間不執行 impulse。Resume 先取得新 lock、等待啟動按鍵 release，再明確恢復原 Held／ghost；若使用者改選 Drop 才解除控制。音訊以 Freeze-and-fade 保存 logical source offset／pending arrivals，淡出與新 epoch 政策詳見 [PHYSICS_AUDIO_EVENTS.md](PHYSICS_AUDIO_EVENTS.md)。

恢復前重新驗證 object generation／collider revision／grip／目標空間，控制器恢復時以有界 ramp 從零提升力預算；若 ID 或幾何失效，維持 Paused 並提供明確 Release，不自動 drop。ghost 的最後有效 pose 也要重驗才能再次 Place。

## 3. FPS Simulation

| 輸入 | 沒有 Held | Held 物件 |
| --- | --- | --- |
| `W A S D` | 水平行走；對角正規化 | 同左，抓取仍受距離／碰撞限制 |
| 滑鼠移動 | 視線 yaw / pitch | 同左；`R` 旋轉狀態除外 |
| `Shift` | 快走（可關閉／重設） | 同左；超出追蹤能力會落後或 drop |
| `E` | 抓取準星第一個合格 Dynamic 物件 | Drop，解除控制、保留當刻速度 |
| 滑鼠左鍵 | 無 throw／push；推力工具為後續功能 | Throw：一次固定、可設定的有限 impulse |
| 滾輪 | 無物理動作 | 調 hold 距離，夾在合法區間且限速 |
| 按住 `R` ＋滑鼠 | 無動作 | 改物件目標方向，視角暫停轉動；放開回視角 |
| `R` 切換替代模式 | 無動作 | 可用 toggle 代替按住；HUD 明確顯示旋轉模式 |
| `G` | 無動作／顯示最近支撐候選 | Gentle place：只有找到合法支撐與空間才低速移至目標，最後 drop |
| `F` | hover Fixed 時明確 Unlock，顯示重力／零速政策 | Freeze：先解除抓取，設 Fixed 並清速度 |

`LMB` Throw 的 P0 不依按住時間蓄力；避免重新取得鎖定時發射。建議 `Jthrow=6 N·s`，Inspector 可調，質量較重的物件增速較小；詳見 [FPS_INTERACTION_SPEC.md](FPS_INTERACTION_SPEC.md)。實驗模式可鎖定參數與鍵位 snapshot。

Gentle place 不是 teleport：support ray、shape clearance 與最後 pose 都有效才接受，透過低速受限控制完成；目標受阻則停留 Held、顯示原因。若世界正在暫停，以預覽交易進 staged，不能靠靜態 teleport 生成碰撞聲。Unlock 回復 Lock 前的重力模式，速度預設零；無記錄時要求以 Inspector 選模式，不能悄悄猜測。

P0 不提供跳躍／蹲下；後續加入需測試接地、天花板 clearance、蹲下 collider 更換與 listener 眼高。不把未實作動作列成可用快捷鍵。

## 4. FPS Build

| 輸入 | 行為 |
| --- | --- |
| `L`／Library 按鈕 | 解鎖滑鼠、暫停、可達性焦點進 library；選擇物件後回 preview |
| 視線／滑鼠 | 仍從玩家視角瞄準表面；只有明確 resume + lock 後才旋轉視角 |
| 滾輪 | ghost 距離調整 |
| `R` toggle／角度步進按鈕 | ghost 目標旋轉；此模式不派送 Held 的旋轉或抓取 |
| Snap 按鈕／可設定快捷鍵 | grid / rotation snap 開關；HUD 顯示 step |
| 滑鼠左鍵／Place 按鈕 | valid ghost → PlacementPending 重驗 → Staged；invalid 時顯示占用／超距原因 |
| 右鍵／Cancel preview 按鈕 | 只取消未提交 ghost；UI 右鍵保留標準選單 |
| `Esc` | 瀏覽器 unlock 並暫停、保留 ghost；不連帶當取消預覽 |
| Duplicate 按鈕 | 以新 entity ID 建立複本 ghost，需重新放置 |
| Lock / Mode 控制 | 選擇最終 Fixed / DynamicGravity / NoGravity；Kinematic 需明確軌跡設定 |
| Enable / Apply 按鈕 | Staged 幾何與聲學 ack、最後 overlap 檢查完成，明確啟用 Active |

鍵位優先依模式解析；Build 的 `R` 不會誤觸 Held 旋轉。實作前以 UX source-of-truth 驗證一致性。放置狀態及安全 query 詳見 [FPS_INTERACTION_SPEC.md](FPS_INTERACTION_SPEC.md)。

## 5. Scene Editor

Editor 預設維持游標與標準 focus，提供選取、gizmo、Inspector 與 library；相機 orbit / pan / zoom 可以滑鼠操作，也須提供按鈕／替代導覽。`W/E/R` 可作 translate / rotate / scale gizmo，但僅在沒有文字 focus、未進 FPS 的時候；刪除必須只作用於明確 selection，提供 Undo。相機移動不改 pinned listener；Source／Listener 使用獨立 gizmo 與明確選取標籤。

## 6. 可用性與輸入驗收

- 同時按移動鍵後失焦，恢復不會繼續移動。
- 按住 E、F、LMB 或 OS key repeat，只產生一次對應命令。
- 首次 lock click、被瀏覽器拒絕的 lock、ESC unlock 均不產生 throw / place。
- R hold 與 toggle 都可完成旋轉；取消／切模式不殘留旋轉狀態。
- 文字輸入與 IME composition 期間不攔截 WASD、Undo、Delete。
- 所有關鍵操作有可點擊 UI，按鍵可重設；pointer lock 不可用時可留在 Editor 完成場景。
- 一個 tick 發生 mode switch + throw，只執行合法順序一次並回報拒絕原因。

目前以上瀏覽器互動驗收均為 NOT RUN。單元測試可驗 InputRouter 狀態機，但不能代替真瀏覽器的 Pointer Lock 與 focus 測試。

## 7. 官方來源

**IC-01**：[Three.js PointerLockControls 文件](https://threejs.org/docs/pages/PointerLockControls.html)、[r186 原始碼](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/controls/PointerLockControls.js)、[W3C Pointer Lock 2.0 Working Draft 2026-02-25](https://www.w3.org/TR/2026/WD-pointerlock-2-20260225/)（皆查於 2026-10-26）。輸入映射、focus 分層、drop 與暫停政策為 Reflection Lab 產品設計。
