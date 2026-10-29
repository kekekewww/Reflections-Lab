# Reflection Lab 架構

2026-10-29：正式 Web 第一版已實作並進行整合驗收。這是目前架構入口；逐能力狀態與研究差異見[審查](../12-architecture-review/ARCHITECTURE_REVIEW.md)、[Gap Analysis](../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md)。完整產品、性能與外部門檻仍以[凍結驗收](../11-v1/ACCEPTANCE.md)、[補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)、[R17 證據](../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json)為準，不能把本輪研究或局部測試當作 V1 完成。

## 已實作主線

React／TypeScript、Three.js／React Three Fiber view、Rapier WASM、自製 Web Geometric Acoustic Core、Web Audio native nodes（AudioWorklet 為後續方案，沒有產品 processor 註冊路徑）、server Meta Model API adapter。精確依賴見 package-lock.json；實際入口為 src/main.tsx、src/app/bootstrap.ts、src/app/runtime.ts 與 server/app.ts。Steam Audio 仍是 optional native 比較來源，不是產品必要依賴。

Scene document／Project document 是可序列化作者資料；Rapier handles、AudioNode、Worker、React state 不寫入 scene。所有 scene mutation 通過 revision 檢查、domain validation、原子 command 與 undo。Sound Behavior document、asset pins、RecordingArtifact 維持各自版本與來源 hash，不能被 renderer 或 AI 私自改寫。

依 [ADR-013](adr/013-codex-primary-development.md)由 Codex 主導開發，Muse Code Harness 為 Optional；產品 Meta Agent 與開發工具的證據、帳號與預算分開。[ADR-014](adr/014-sound-behavior-system.md)的 runtime 已有實作，producer／evaluator／UI 能力差異見[研究](../12-architecture-review/SOUND_BEHAVIOR_RESEARCH.md)。

## 目前實際流程

~~~mermaid
flowchart LR
  UI[React workspace / Inspector / AI preview] --> CMD[Validated command / revision / undo]
  CMD --> DOC[Scene / Project / Behavior documents]
  RAF[Browser RAF] --> PH[Main-thread fixed-step Rapier]
  DOC --> PH
  PH --> EV[Normalized events / sound instances]
  PH --> POSE[Pose / listener snapshots]
  POSE --> WORKER[Bounded acoustic worker / normal live lane]
  WORKER --> FRAME[AcousticFrame / stale identity]
  EV --> AUD[Web Audio source graph]
  FRAME --> AUD
  PH --> CAP[Recording onTick / synchronous acoustic capture]
  CAP --> REC[Recorded trace / snapshots / events / phase]
  REC --> SEAL[Bounded seal worker / verified storage]
  REC --> REP[Replay / A-B reprocessing]
  API[Loopback Meta host / schema / budget] --> UI
  PLAN[Planned portable RenderBackend] -.-> REC
~~~

固定步不經 React state，但當前 bootstrap 仍由 requestAnimationFrame 呼叫 LabRuntime.advance；main-thread rendering／序列化／物理會互相競爭。普通聲學 service 有真 module Worker，錄製分支目前仍會在 onTick 同步 solveAcoustics。seal worker 是封存工作，不是物理或錄製聲學 worker。這些是已核對的程式行為，不應簡寫成「所有計算皆在 Worker」。

## 時鐘、預算與聲學界線

| 層 | 權威與目前責任 | 目標／限制 |
| --- | --- | --- |
| Scene／Project | stable IDs、SI、revision、資產／錄製 refs | schema 與 domain 上限不是性能保證 |
| Physics | main thread 固定 60 Hz、pose/contact、有限抓投 | RAF 驅動 accumulator；互動可記 dropped wall-time；錄製過載 pause 保留連續 tick |
| View | R3F 插值、selection、gizmos、FPS input | 60 FPS 是 target；不反寫 dynamic pose |
| Acoustics | ordinary live worker、revision／request／tick、取消／逾時 | 10–20 Hz 是待驗工程目標；錄製同步熱路徑另列 |
| Audio | AudioContext sample clock、logical emission、一次 propagation delay | audio 不等 AI／geometry；actual device sample rate／block size 另驗 |
| Recorder | 初始 snapshots、整數 tick、事件／phase／hash、worker seal | 長時間與成本需實測；不可只保 stereo WAV |
| AI | server key、schema／preview／apply／undo、cost0 default | 目前 loopback gate，尚無雲端 session auth／durable 多使用者 quota |
| RenderBackend | portable types-only job／result／capabilities | 尚無產品 renderer；不會啟動 cloud job 或產生 stems |

direct／有限一階 specular／snapshot dynamic occlusion 為 numerical approximation；late reverb 為 Synthetic／perceptual approximation。多階 solver、厚牆 transmission、動態反射面、完整 calibrated RIR／room validation 仍未實作。材質 A/R/T 是能量；magnitude pressure 為簡化 sqrt 轉換，scattering 不額外消滅能量。

direct 與 early paths 共用 emission t0，使用 absolute delay，不重複加入 direct delay。穩定 path ID 不含排名／座標。solver 與 audio 共用 5 秒傳播硬上限，預設 solver budget 仍 2 秒；超出設定明確拒絕，不靜默 clamp。音訊 callback 不等 geometry、physics、網路或 AI。

## 雲端與匯出方向

[ADR-015](adr/015-client-first-and-render-contract.md)保留 client-first：使用者本機執行 3D、physics、聲學、音訊、錄放；雲端提供 static/CDN、auth／tenant metadata、asset storage、受控 Meta proxy。雲端 Render Queue／workers 是後續可選，不作 MVP 必要前置。

[RenderJob／RenderBackend](../../src/audio/render-contract.ts)只預留 portable artifact refs、整數時窗／sample mapping、listener／HRTF policy、source selection、dry/direct/early/late/master taps、working/output budgets 與實際 provenance。不能將 browser-only OfflineAudioContext 假定可直接在 Node 執行，也不能將 WAV encoder 或 DSP tests 當作完整 take/stems renderer。

成本與性能見[Cloud Cost Model](../12-architecture-review/CLOUD_COST_MODEL.md)、[Browser Research](../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md)。R17 600 秒負面性能、完整 delivery／Worklet 未驗、正常 100% 實體 FPS／IME 與裝置聽測仍保留。
