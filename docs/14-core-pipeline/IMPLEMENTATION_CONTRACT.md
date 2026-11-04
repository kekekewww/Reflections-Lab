# 六項核心實作契約

日期：2026-11-02（台灣時間）。狀態：本輪使用者授權的有限實作範圍；不是測試結果或完整 V1 結案。需求摘要見 [REQUEST_20261102.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1c8807e9ba7b981c937b04a7e84ea12859bfb497)，分工與證據流程見 [STAGES.md](STAGES.md)。

## 目標與權威

在既有正式 Web 產品上完成錄製、音訊成本觀測、共用能力、Meta 操作流程、Motion 作者與短 take renderer 的核心閉環。主整合分支為 `codex/core-pipeline-local-20261102`，起點 `429efb7597ec913bd879ecc05c29a6be7ad5175c`。各工作樹位於專案內的 `.worktrees/`；保留其他分支、未提交內容與歷史 artifacts。

使用者已確認基本功能測試完成且正常，並授權本輪六項核心、平行工作樹、本地整合到 main、持續記憶／checkpoint、Claude 後續複核與透過 computer-use 匯出音檔。不得再把 R18／R21 基本操作重測列為本輪前置。此授權不代表新付費 API、push、部署、接受條款或決定根 LICENSE。

[V1 驗收](../11-v1/ACCEPTANCE.md)、[已確認補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)、ADR-011／013／014／015 仍有效。此契約固定本輪核心完成條件，不修改原 reference／tolerance／性能門檻；不把 14 項優化全部開工。舊 PERF 任務的較廣驗收與依賴保留，本輪有限工作由 Task0023 投影並連回原任務，不為取得 claim 而刪除依賴。

## 01 錄製與 A/B 有界 evaluation

對應 PERF-001／002／014；本輪投影為 Task0023 AC-01。

- 錄製 evaluation 使用不可變、同 tick 的 scene／geometry／material／pose／source／event 輸入；排隊同時受 frame 數與 bytes 約束，明示 accepted／evaluated／published tick。
- 高水位暫停 producer，不丟 simulation tick、不以 latest-only 省略碰撞事件；正常容量下保留原有錄製語意、source phase、seed、event ordering 與 dedup。
- 取消、逾時、stale revision／epoch、queue 滿與 worker 失效有有限終止／恢復；stop drain 不無限等待，失敗不可發布完整 artifact。
- A/B 的重算走相同有界服務，保持 acoustic／behavior A/B 固定條件；取消不污染另一個 run 或覆蓋原 artifact。
- 以至少 180 tick 的固定 fixture 與既有同步 reference 比較資料及語意，並驗證 queue 水位、pause／resume／stop／cancel／stale 負例。此證據不等於 600 秒性能通過。

## 02 成本觀測與 native 音訊更新

對應 PERF-001／003／014；本輪投影為 Task0023 AC-02。

- 提供有界、可關閉的成本／容量觀測，區分 evaluation、copy／delivery、native 控制更新、late onset、snapshot／voice／path 拒絕與實際可取得的 output 統計；沒有裝置能力的欄位為 null／unsupported，不填零。
- 收據固定 source、bundle、browser、實際 sample rate 與方法；裝置路徑未知如實保留，不假定 128 frames 或固定硬體 buffer。
- 分開 scalar pressure gain、normalized shape、delay、direction 的更新責任；保留既有 FIR cache、stable routes、雙 banks、phase、tail 及一次 propagation delay，避免每個 physics tick 重做相同原生參數排程。
- 用既有數位 graph／fixture 驗證 identity、gain／shape／delay／direction、暫停重錨與 dispose；近似 deadband 的誤差與 exact 去重分開記錄。觀測成本下降不自行推論真人聲音、Worklet deadline 或跨裝置收益。

## 03 UI／AI／Preview／Host 共用能力與最小 Bounce producer

對應 Task0024；承接原 Sound／Acoustic／Meta 能力契約。

- 建立同一份機讀能力描述，UI 可用控制、AI context／tool 宣告、Preview 與 Host 驗證一致；回報能力 ID、支援範圍與具體拒絕原因。
- evaluator 可接收事件不等於產品有 producer。未接線的 zone、unsupported 幾何／模式等不得提供可成功套用的假入口；未支援請求原子拒絕且保留舊 scene／draft。
- 本輪最小 OnBounce 只承認 PhysicsWorld 的真接觸／運動資料與明示的靜態支撐判定。不得以 restitution > 0、單獨 ContactEnd 或新 Impact 冒充 Bounce；動態支撐、未覆蓋形狀或未知資料依實際能力拒絕或保留 unknown。
- 正負例涵蓋 capability projection 一致性、unsupported 工具／規則、無有效反彈與重送事件。Bounce 的 Derived／Tuned 門檻不標物理常數或真實振動量測。

## 04 Meta 工具 UI 閉環

對應 Task0025；不替代 Task0007／0014 的帳號、真 live 與較廣驗收。

- 在產品 UI 可由 context／提案開始，查看受影響項目與 preview，顯式 apply／undo，執行有界 run／capture，閱讀實際 analysis／compare 結果及不足條件。
- 既有 server provider、安全 Host、revision／schema／domain／capability／budget gate 是權威；模型不直接操作引擎，不提供任意檔案路徑或捏造 hash。
- 離線／fixture provider 可產生確定提案，但後續 Host 工具必須真的操作產品狀態；fixture 文字不能冒充 run、artifact 或量測。錯誤、取消、stale 與不支援項目在流程中可理解。
- 至少一個可重現 UI 流程覆蓋提案至分析／比較與一個拒絕案例；本輪無新付費授權時 live 明示 NOT RUN，不能以 Codex／Claude 代替 Meta 宣稱通過。

## 05 Motion authoring 與 SetTrajectory

對應 Task0026；沿用同一 PhysicsWorld、Scene revision／command／undo 與固定步。

- 提供有限、版本化的物件軌跡作者資料、驗證與最小 UI，至少支援明示範圍的 kinematic keyframes／線性軌跡；`SetTrajectory` 依同一能力與 validator 真正套用支援子集。
- 交易帶 object ID、generation／revision、開始 tick、有限時長及界線；invalid／stale 原子拒絕，apply／undo 不留半套資料，不序列化 Rapier／Three runtime object。
- 既有 kinematic clearance／碰撞政策不得以直接 transform teleport 取代；fixed／Held 衝突、取消、pause／resume／reset、delete／mode change 有明確控制權與終止收據。
- 不同 render cadence 的固定 tick 結果一致。Dynamic Move To／Move & Release 只在實際實作其有限 controller、release velocity 政策與碰撞驗證後宣告支援；其餘明示 unsupported，不用 mode 偷換補齊。

## 06 短 take full mix／object stems renderer

對應 Task0027，承接 ADR-015 與既有 `RenderJob`；完整 PERF-011 chunk state carry／長輸出研究仍保留原 BACKLOG。

- 實作 runtime job／hash／clock／capability／預算驗證，沿同一 AudioEngine，在真 OfflineAudioContext 產生 PCM。核心上限為 30 秒 take、最多 16 個 outputs；其他 frame／working bytes／output bytes 上限由 validator 明示執行。
- 至少輸出一個 full mix 與真正依 recorded source ID 選取的 object stems，保持相同 tick/sample origin、原物理世界、原 behavior／admission、source phase、pre-roll／tail 語意；不可為選 stem 移除碰撞物件或重新決定聲源 admission。
- 只宣告實際 tap、channels、spatialization 能力；native HRTF 標 browserManagedUnspecified，不捏造 coefficients hash。非線性 master／limiter 的 stems 不承諾相加等於 full mix。
- NaN／Infinity、非法 hash／窗口／輸出數／長度、缺資產、未知 source、unsupported job 早拒絕；cancel／retry／同 job ID 內容變更及最後 atomic publication 有可驗證行為。
- 數位測試涵蓋 sample alignment、有限 peak／數位 clipping 報告、source isolation、尾音與取消。產品可下載 WAV；root 另用 computer-use 操作產品匯出供使用者聽的音檔，保存來源／設定與產物 hash。匯出成功不當成真人聽測通過。

## 本輪完成、驗證與交接界線

1. 六項實際程式與 UI 接線可用，各自 stage 報告區分 IMPLEMENTED、PASS／FAIL／NOT RUN、source／commit、命令、退出碼與限制；不能只交 interface／文件或 types。
2. 每項執行對應基本測試與必要整合／browser／數位音訊檢查；不修改保護 oracle、reference 或容差來製造成功。性能負載窗口不可與其他重測並行。
3. 本輪交付基本驗證與可供 Claude 後續獨立重新驗證的完整指令／來源／產物入口；Claude 尚未執行就寫 NOT RUN。新增功能的真人觀察另列，不重開已確認的基本功能測試。
4. 使用者已授權在本機保留分支的正常 merge 到 main。整合前核對所有權與未提交內容，禁止 destructive reset／clean、改寫原歷史或把完整本地歷史 push 到乾淨公開 main。
5. 單一 writer 更新來源、task、Wiki、checkpoint／handoff及英文鏡像。舊 R17／研究 600 秒 FAIL、trace 缺口、裝置／科學／Meta live／外部門檻保留；本輪有限核心完成不等於整體 V1 完成。
