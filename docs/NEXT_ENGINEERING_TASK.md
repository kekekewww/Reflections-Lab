# 2026-10-29 下一個工程切片：錄製聲學有界評估 lane

## 2026-10-29 整合後更新與真人回報

本輪研究與最小修正已以保留歷史的方式合併；原工作區完整品質檢查與當前 UI28／串接8／產品4／物理2／儲存5 分項通過。實際提交、收據與尚未完成的公開流程見 [integration-state.json](12-architecture-review/integration-state.json)。

新增的 [R18 真人回報](11-v1/USER_TEST_FEEDBACK_20261029-r18.json)優先於先前「等待首次真人測試」的描述：第一人稱無法移動或操作為使用者回報失敗，下游 FPS 操作受阻；材質與反射未測，預設音量與直接操作有問題。實測 bundle／裝置未知，不能把自動化通過當作覆蓋，也不能推定數值或裝置驗證成功。下一個工程切片先固定來源並診斷第一人稱輸入阻斷，再處理音量／直接操作及原錄製熱路徑／性能；本輪沒有修復這些產品問題。舊章節保留原截點與後續設計。


本輪研究／合併／公開狀態見 [Integration Report](12-architecture-review/INTEGRATION_REPORT.md)。原Task0020／0012的性能、100%真人輸入／聽測與外部門檻不變；下方舊r10工作指令保留歷史。

目的：去除src/app/runtime.ts onTick錄製分支的無界觀測成本，保持原recording semantics。先做隔離spike與CPU／allocation profile，不直接重寫physics／audio。

- 檔案邊界：runtime.ts錄製分支、recording-host／processor、experiments/types與worker client；不改protected oracle／reference／聲學公式。
- Input：同tick immutable scene/geometry/material/pose/source/event snapshot、完整revision／hash與連續tick；output：與原recorded frame語義一致的有限結果。
- 必要測試：原fixture byte/semantic comparison、取消／timeout／stale／queue滿、pause/resume／stop drain有界、180tick與1–3分鐘run；保留source phase／seed、event dedup、跨物件碰撞／遮擋，不漏tick或窗外回填。
- 量測：正常筆電與高階機各自frame/physics/solver p95/p99、delivery、main long tasks、peak memory、錄製overload與audio dropout；R17原600秒FAIL完整保留。
- 停止條件：資料／hash／時基不一致就回原lane，保留失敗；沒有原門檻證據不得宣稱性能PASS。

第二切片為producer capability共用投影：AI context／preview對OnBounce與zone缺producer給明確unsupported，不用改schema或偽造事件。完整local mix/stems renderer另開P1切片，先補RenderJob runtime validation，再接同一AudioEngine；本輪types-only seam不當實作。

公開Git歷史另有真正blocker，需依 [PUBLICATION_AUDIT](12-architecture-review/PUBLICATION_AUDIT.md)選擇保留本地完整歷史與乾淨公開快照等策略；不擅自rewrite／LFS上傳。

# 目前下一步：完成第一版證據與未解門檻

2026-10-28：原Scene／Rapier切片Task0006及M0已DONE；本文件下方原契約以原bytes保留為歷史，不再表示尚未建立正式產品。[r10當前實測](11-v1/SESSION_PROGRESS_20261028-r10.md)及[原51項驗收](11-v1/ACCEPTANCE.md)為接手入口；沿用既有Task，Task0020仍IN_PROGRESS。

接續處理實際Hi-x65／D3V聽測、原生工具初始化／可見性阻擋、正式性能未達標／負載與membership限制，再完成51列證據、production NOTICE綁定、全英文freshness、pinned完整check與本地Git。不要重新實作已通過的Scene／FPS／audio／product4；不要由下方舊切片的禁止順帶範圍推論整個第一版不含已授權模組。未新增付費Meta或Muse使用；外部資格／條款／根LICENSE未代決。

## 以下保留原切片契約

# 下一個正式任務：P0-01 最小場景與固定步物理骨架

本文件可直接交付下一個 Codex session。**本次尚未執行**；使用者授權正式開發後，先核對競賽關卡，不重做已完成研究。

2026-10-27更新：[ADR-013](02-architecture/adr/013-codex-primary-development.md)改由Codex主導，舊Muse Harness不是前置。新Sound Behavior的[M0純Audio Event Runtime](10-sound-behaviors/NEXT_AUDIO_MILESTONE.md)可用fixture平行開發；本Scene/Physics仍是其正式3D／audio垂直接線的必要前置。Sound Behaviors是外接draft，不偷偷修改既有Scene v1。

> **給執行代理**：依本文件分項完成；採子代理時以互不覆寫的模組分工。先讀 AGENTS、ARCHITECTURE、ADR-002/007/011/013/014、Scene schema、PHYSICS_ARCHITECTURE、OBJECT_STATES 與 KNOWN_LIMITATIONS。Codex主導實作，優先獨立驗收；MuseCode只在明確選用且資源允許時使用，不是本任務前置。

**Goal**：在瀏覽器呈現可從 SceneSpec 匯入／匯出的單房間、地板與一顆 sphere，用固定步 Rapier 驗證四種剛體模式，建立後續 FPS／聲學共享的資料權威。

**Architecture**：Scene Document 是權威，host command 驗證後建立 runtime mapping；Rapier 權威 dynamic pose，Three/R3F view 只 render interpolation。React 面板可先最小化，React／R3F 版本在此任務開工時由官方文件與 registry 查核並精確鎖定；不要順帶實作FPS/AI/audio。

**Tech Stack**：沿用 pinned Three/Rapier/TypeScript；Vite/React若新增須鎖精確版本與license，保留現有研究工具 scripts。

## 全域限制

- SI／right-handed +Y up/-Z forward，quaternion xyzw；body/source IDs不能是handles。
- 只 room、box、sphere、capsule primitives；sphere dimensions為直徑三等值。
- 匯入大小受Scene schema與domain quota限制，失敗不破壞已開scene。
- 60Hz fixedDt；interactive最多4 catchup steps並記dropped wall-time；record/A-B將來採過載pause不丟tick。
- state的四模式與velocity restore policy按OBJECT_STATES；no gravity不是fixed。
- Source先只保留document，不能因尚無audio runtime就刪欄位。

## Review focus

1. 非法／重複ID、dangling refs、NaN、zero quaternion、negative mass與超限維度拒絕。
2. 固定步與render dt分離，30/60/144Hz render不改步進結果。
3. fixed→dynamic／gravity0→gravity1不保留意外控制力；sleep/wake政策明確。
4. reset/import/dispose不遺留world、event queue、geometry/material與多重RAF。
5. UI編輯與runtime pose權威分離；未確認交易不偷偷寫入scene。

## 實作項目

- [ ] 建立 `src/domain/scene.ts`、`src/domain/validate-scene.ts`、`src/domain/commands.ts`：對齊既有JSON schema，新增domain validator與transaction inverse。測試valid/invalid/rollback/stale revision。
- [ ] 建立 `src/runtime/physics-world.ts`、`src/runtime/fixed-clock.ts`：穩定ID mapping、4 modes、step/dispose；以真正WASM測gravity/fixed/impulse，利用既有fixture而不照抄實作答案。
- [ ] 建立 `src/view/scene-view.tsx` 與 imperative pose adapter：由SceneSpec創建房間／球，插值顯示，固定步不經React state；camera/measurement listener分開；resize/visibility/dispose清理。
- [ ] 建立最小面板：Run/Pause/Reset、選mode、import/export、scene revision與tick；不大量排版、無正式FPS／抓投／AI／audio。
- [ ] 新增browser smoke與人工步驟：單次user gesture後run、改mode、pause、import拒絕、連續reset10次無多重loop。
- [ ] 執行既有`npm run check`＋新app typecheck/build＋相關browser smoke；保留實際命令、版本、結果與未驗項目。
- [ ] 更新status/ADR（有變更才新決策）、限制與下一P0-02，不把既有研究文件整批重寫。

## 驗收

新session可 `npm ci`、執行明載dev命令看到room與sphere；球可自由落下、gravity0保持慣性、fixed不受力、kinematic按指定trajectory移動。Scene roundtrip維持IDs／units／source/listener metadata。pause不step，reset回初始快照。invalid import保持舊scene。正式FPS／Grab／audio／AI仍明示待下一任務。

預算6–8小時。風險是runtime與document雙寫／resource leak；fallback減少面板與幾何，不削掉fixed步與schema正確性。完成後由獨立代理做差異審閱，無使用者要求不擅自提交Git／推送／部署。
