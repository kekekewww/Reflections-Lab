# Task0029 補充：連續 mode-change 的真正區域跨界

日期：2026-11-02。起點 20bf09a1df54c81c22aabc8eff8235fc22ffc4d7。依 Root 明確採納，這份修補取代 BASELINE.md「目前生命期界線」中的 mode-change 首步 baseline 限制；原報告與原收據保留。

## 問題、規則與最小修補

公開 BodyPose.discontinuity 原本同時表示作者 transform、新建／啟用與 body mode 改變。Bounce 與 render interpolation 仍需要原語意；Zone body-center occupancy 卻不能因位置連續的 mode 值變化漏掉真正進出。

- 只在 PhysicsWorld 的內部 Record 新增 zonePositionDiscontinuityUntilTick；new body、enable 與作者 transform 設為下一 tick。Reset／geometry generation 重建與刪除沿既有生命期。
- setMode 維持原 generic discontinuity 與 Bounce／接觸失效規則，不寫也不清掉 Zone position marker。因此真正位置連續的 mode-change／Motion release 不會抑制跨界；同 tick 的作者 teleport 再切多次 mode，也不會擦掉位置 baseline。
- 每步把最多 256 個位置 discontinuity ID 的暫時 Set 傳給 ZoneProducer。明示 Set.has=false 可以覆寫 generic=true；standalone producer 沒有這個可信輸入時維持原 generic-pose fallback。
- marker 只存在內部 Record 和暫時 ZoneStep input，不加入 BodyPose／PhysicsSnapshot／Scene／Recording／VoiceIntent schema、hash input 或持久 runtime engine object。

## 真 Rapier 紅燈與綠燈

position-marker-red.txt 先於修補執行：5 案中 1 PASS／4 FAIL。四個 FAIL 都是實際 MotionWorkspace 的 moveAndRelease＋transfer：kinematic 到達 x=1 後，分別轉 dynamicGravity／dynamicNoGravity，下一步跨過 x=1.01，但原本沒有 OnEnterZone／OnExitZone。

修補後：

- position-marker-green.txt：17/17 PASS，包含 5 新案與 12 原 producer 案。四個正例斷言釋放前無 edge、下一步真位置跨過門檻、generic discontinuity 仍 true、實際 zone edge／zoneId／position 與 normalized bridge 一致。沒有修改門檻或 assertion。
- 第五案同 tick 作者 teleport＋多次 mode-change，仍不偽造 enter，後續 baseline 穩定。
- position-marker-regression.txt：76/76 PASS，0 skipped，concurrency=2；包含 Bounce、Contact、MotionWorkspace、generation／history、Zone recording／worker／Project／detached ownership 與真 Three wireframe。
- position-marker-lint.txt／position-marker-format.txt：scoped ESLint／Prettier exit 0。
- position-marker-build.txt：npm run build（全樹 tsc --noEmit＋Vite）exit 0。這次 build 同時涵蓋 a22 wireframe、20bf stale pin 與本 marker；index-Bem6B9u0.js。原 chunk-size warning 完整保留，不因此聲稱正式效能通過。
- 獨立 bounce_review 只讀核對 writer、同 tick teleport／mode-change、reset／delete、bounded Set 與公開輸出；未確認 BLOCKER／MAJOR，沒有獨立重跑測試。

## 容量與尚未執行

Zone classifier 原上限 16 regions×256 bodies，occupancy Map 最多 4096 keys；此切片新增每步最多 256 ID 的 Set、O(poses) 掃描，沒有 unbounded queue 或每 tick React state。事件仍共用總量 2048 上限。這是工程容量，不是實機 frame-time/GPU/音訊效能量測。

Root 合併後仍須：完整 geometry builder 三態 metadata 整合、最新 production bundle 的真 Zone UI／線框點選／持久化／record-replay／音檔流程。此分支從未啟 Chrome、Computer Use、付費 API、server 或 push；Node、SSR 與 production build 不冒稱 browser、hearing、formal performance 或整體 V1 完成。
