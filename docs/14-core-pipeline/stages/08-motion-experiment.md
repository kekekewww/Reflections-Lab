# Stage 08：作者 Motion → 實驗錄製接線

日期：2026-11-02。範圍：正式 `ExperimentToolHost` 的本機隔離物理執行；未改 SceneSpec／AI Tool schema、Runtime UI 或持久記憶。

## 問題與實作

先前 `RunSimulation` 建立新的 Rapier 世界，但未執行 `physicsConfig.motionRegistry` 中的作者動作，因此 `SetTrajectory` 成功提交後，實驗錄製仍可能只有自由落體。本階段新增 `prepareExperimentMotion()`，由模擬內部消費 trusted configuration 的 immutable snapshot，將作者動作裝入真正的 `MotionWorkspace` 固定步 observer。

非空 registry 先通過完整、有限、封閉 JSON 驗證，再比對作者場景的 ID／revision／canonical SHA-256 pin。最多同時八個動作；每個物件只能有一個動作。多動作、過期 pin、非法 body mode／首點／欄位皆明確拒絕，不選取其中一個，也不發布部分錄製。動作依原陣列順序全部登記成功後，維持原有 tick0 append → resume → 固定步錄製；moveTo、moveAndRelease、trajectory、impulse 均沿用現有控制器，沒有新增瞬移或額外錄製 tick。

每個實驗建立獨立 world，作者 reset 後的 generation 可大於 1；來源 generation 不會假稱等於 clone world。可信 projection 只針對新實驗世界重新綁定。錄製 `physicsConfig` 包含：

- `motionRegistry`：實際安裝的 runtime registry，含 runtime pin／generation／import revision。
- `motionExecution.sourceRegistry`／`sourceRegistrySha256`：原始作者 JSON 與其 SHA-256；保留作者 revision、pin、generation、參數。
- `runtimeRegistrySha256`／`generationBindings`：實際執行內容雜湊及逐 action 的 author → runtime generation 對應。
- `policy`／`rebindReason`：明示同時啟動、每物件一動作與隔離世界重綁原因。

要求不同 seed 時，先驗原作者場景 pin，再明確記錄新 seed 的 runtime pin，並不靜默更改原作者內容。無 registry 或合法空 registry 保留既有無 Motion 行為；空 sidecar 沒有動作，不因一般場景編輯後的舊 pin 阻擋原本功能。

所有 setup await 後都檢查取消／期限。setup 失敗由 helper 釋放已建立的 workspace；模擬成功、取消、timeout 或例外均由 finally 先 dispose workspace，再 dispose world。Replay 在建立世界前即走既有 reprocess 路徑，使用原 pose trace／physics provenance，不重新執行目前作者 Motion。

## 驗證

新增 `tests/app/motion-experiment-pipeline.test.ts`，八個案例實際執行本機 Rapier／Behavior／聲學錄製，不使用假 pose：

1. AI trajectory preview／commit → RunSimulation，13 個 frames（tick0–12）、末 pose 位移大於 0.15 m，tick0 AlwaysOn 保持；原配置不變，來源與 runtime 雜湊可重算。同一測試再以過期 current pin 重播，證明沿用原 trace／physicsConfig 而不二次執行。
2. 作者 world reset 後 generation 2 的有限 impulse，在 clone world generation 1 真正移動，並記錄 2 → 1 對應。
3. 過期 scene pin 拒絕。
4. 同物件兩個動作拒絕。
5. 未知 JSON 欄位拒絕。
6. 非有限 JSON 數值拒絕為 DOMAIN_INVALID。
7. 取消驗證 motion → world 的 dispose 次序、active controller 清空，且沒有發布部分 run。
8. Timeout 驗證相同的清理與原子發布保證。

已跑：

- `node --import tsx --test tests/app/motion-experiment-pipeline.test.ts`：8/8 PASS。
- `node --import tsx --test tests/app/motion-experiment-pipeline.test.ts tests/app/experiment-tools.test.ts tests/app/agent-experiment-workflow.test.ts tests/physics/motion-generation-projection.test.ts`：38/38 PASS（加入非有限 JSON 案例前）；新增正負案例最終獨立跑 8/8 PASS。
- `npm run typecheck`：PASS。
- `node node_modules/eslint/bin/eslint.js src/app/motion-experiment.ts src/app/experiment-tools.ts tests/app/motion-experiment-pipeline.test.ts`：PASS。
- 指定三檔 Prettier：已格式化；獨立唯讀 agent 審查未發現阻斷問題。

限制：這是 V1 本機數值／管線證據，未新增 browser、聽測、音訊裝置或 Meta live 證據。沒有實作多動作 timeline 或自動排程；超過八個動作需先拆成明確任務。本階段不得據此宣稱整個第一版驗收完成。由整合主代理統一 stage／commit、更新長期記憶及 Claude 交接。
