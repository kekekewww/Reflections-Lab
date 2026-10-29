# Architecture Gap Analysis

日期：2026-10-29。比較基準：c210ca882ca8503b322c28884bf1e9f6e9fe126d。狀態是領域能力，不是完整 V1 通過；[R17](../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json)與[實際性能](../11-v1/BROWSER_PERFORMANCE.md)維持權威。

| 能力 | 狀態 | 實際路徑／流程與測試 | 缺口／研究結論 |
| --- | --- | --- | --- |
| React / TypeScript / Three / R3F | IMPLEMENTED | src/main.tsx、src/ui/Viewport.tsx、src/ui/viewport；鎖版 package.json；UI browser | canonical 架構與 src README 尚寫未安裝／無 runtime，需修文 |
| Rapier / Scene / FPS / Build | IMPLEMENTED / PARTIAL | src/scene、src/physics、src/interaction、src/app/runtime.ts；tests/scene、physics、interaction-runtime、browser physics | 程式與 browser 分項已實作；真人 Pointer Lock／IME 未驗，無完整第三人稱角色系統 |
| Motion Authoring | PLANNED | kinematic motor／SetTrajectory schema；src/ai/scene-adapter.ts 回 UNSUPPORTED | 缺 Motion Registry、曲線作者 UI、Move To / Move & Release 狀態機；不能把 bounded target 當整套 timeline |
| Sound Behavior | IMPLEMENTED / PARTIAL | src/audio-behavior、src/app/physics-behavior.ts、behavior-editor.ts；tests/audio-behavior | evaluator、bridge producer、author UI 能力不同；OnBounce/zone 缺 producer，不冒充實作 |
| Custom Acoustic Core | IMPLEMENTED / PARTIAL | src/acoustics、src/app/acoustic-service.ts / acoustic-worker.ts；tests/acoustics-runtime | direct／有限一階／snapshot occluder；多階、動態 reflector、solid transmission 未實作；5/10 秒跨層上限需窄修 |
| Web Audio / Worklet | IMPLEMENTED / EXPERIMENTAL | src/audio/engine.ts、routes.ts；tests/audio-runtime | native node 圖已實作；custom AudioWorklet 仍 PLANNED，未找到產品 processor 註冊路徑；完整 delivery／dropout 未驗 |
| Recorder / Replay / A-B | IMPLEMENTED / PARTIAL | src/experiments、src/app/recording-host.ts / recording-processor.ts；tests/experiment-runtime | motion trace／snapshots／事件／來源 phase 已有；錄製每 tick 同步 solver 熱路徑、長時間記憶體與穩態性能仍需實測 |
| Render / WAV / Stems | PLANNED / EXPERIMENTAL | src/audio/wav.ts 與 OfflineAudioContext 數值測試；新 render-contract.ts 僅 types | WAV 工具／DSP 測試不等完整 take renderer；local mix／object stems／drywet／ADM UI 尚無實作 |
| Meta Model API | IMPLEMENTED / PARTIAL | server/meta-provider.ts、app.ts、src/ai；歷史最小 Sound live 180 tick | loopback host/origin 不是雲端 session auth；quota memory 不可當多使用者 durable billing；不新增付費驗證 |
| Project Persistence | IMPLEMENTED / PARTIAL | src/persistence、assets／IndexedDB；storage browser | 本機專案與資產 refs 已有；雲端 tenant/RLS、同步／衝突、retention 未實作 |
| Deployment / Multiuser | PLANNED | server/cli.ts、vite.config.ts、.github/workflows/validation.yml | 無正式雲端部署／auth／queue；不得從 client-first 設計宣稱多人容量 |
| Wiki / Skills / ADR | IMPLEMENTED | knowledge、scripts/wiki、.agents/skills；test:wiki / design | 沿用單一系統；需記 worktree／base／merge／publication blocker |
| Tests / Benchmark | IMPLEMENTED / PARTIAL | package scripts、tests、benchmarks | 現有 R17 scoped 功能 PASS，性能 FAIL／真人 NOT RUN；本輪結果另保存，不覆寫舊 raw |

## 最小修改與延期

Category A 更新 canonical 架構入口、實作狀態、ADR、roadmap／下一任務及來源索引。Category B 共用傳播上限、portable render 工作契約與可重算成本／公開檢查工具。沒有刪除產品模組、升級依賴或改 Scene／Project／Recording schema。

Category C 未執行：physics worker、錄製 pipeline 重構、完整 motion registry、offline renderer、雲端 auth/tenant/rate-limit、ADM serializer。這些各需 frozen fixtures、migration 或 capability test，不因本輪研究完成就列成競賽必做。

各領域完整證據及來源由 [Architecture Review](ARCHITECTURE_REVIEW.md) 串接；這是目前 code、歷史 test、提案與未驗證的比較，不是測試覆蓋率百分比。現有測試沒有收集 statement/branch coverage，本輪不捏造比率。
