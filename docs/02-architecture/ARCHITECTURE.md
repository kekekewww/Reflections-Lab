# Reflection Lab 架構

2026-11-02 更新：正式 Web 第一版持續整合驗收；六項核心、區域事件與曲面／動態反射已有有限實作。這是目前架構入口；逐能力狀態與研究差異見[審查](../12-architecture-review/ARCHITECTURE_REVIEW.md)、[Gap Analysis](../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md)。完整產品、性能與外部門檻仍以[凍結驗收](../11-v1/ACCEPTANCE.md)、[補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)、[R17 證據](../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json)為準，不能把本輪研究或局部測試當作 V1 完成。

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
  PH --> CAP[Recording onTick / bounded evaluation admission]
  CAP --> EVAL[Bounded acoustic evaluation queue]
  EVAL --> REC[Recorded trace / snapshots / events / phase]
  REC --> SEAL[Bounded seal worker / verified storage]
  REC --> REP[Replay / A-B reprocessing]
  API[Loopback Meta host / schema / budget] --> UI
  REC --> RENDER[Native OfflineAudioContext / shared AudioEngine]
  RENDER --> WAV[Bounded mix / stems WAV and manifest]
~~~

固定步不經 React state；一般互動仍由 requestAnimationFrame 呼叫 LabRuntime.advance，main-thread rendering／序列化／物理會互相競爭。錄製 onTick 現在只提交固定來源快照與有界 evaluation 工作，佇列最多8 frames／32 MiB，完成回覆須通過來源身分、取消與 stale 守衛才入錄製；A/B 重算共用同一 evaluation 服務。普通 live lane 有真 module Worker，reference transport 仍可能同步執行 JS，timer 不能搶占該執行。seal worker 另負責封存，不能將上述分工簡寫成「所有計算皆在 Worker」。見[錄製切片](../14-core-pipeline/stages/01-recording.md)。

## 時鐘、預算與聲學界線

| 層 | 權威與目前責任 | 目標／限制 |
| --- | --- | --- |
| Scene／Project | stable IDs、SI、revision、資產／錄製 refs | schema 與 domain 上限不是性能保證 |
| Physics | main thread 固定 60 Hz、pose/contact、有限抓投 | RAF 驅動 accumulator；互動可記 dropped wall-time；錄製過載 pause 保留連續 tick |
| View | R3F 插值、selection、gizmos、FPS input | 60 FPS 是 target；不反寫 dynamic pose |
| Acoustics | ordinary live worker／有界 recording evaluation、revision／request／tick、取消／逾時 | 10–20 Hz 是待驗工程目標；保留容量不等於總 heap 或 deadline 保證 |
| Audio | AudioContext sample clock、logical emission、一次 propagation delay | audio 不等 AI／geometry；actual device sample rate／block size 另驗 |
| Recorder | 初始 snapshots、整數 tick、事件／phase／hash、worker seal | 長時間與成本需實測；不可只保 stereo WAV |
| AI | server key、schema／preview／apply／undo、cost0 default | 目前 loopback gate，尚無雲端 session auth／durable 多使用者 quota |
| RenderBackend | 真 native OfflineAudioContext 與共用 AudioEngine，固定來源 job／result／manifest | 短 take 發聲≤30秒、context≤45秒、outputs≤16；無 cloud job 或保留狀態的長 chunk renderer |

direct／有限一階平面鏡射、解析球／膠囊遮擋與有界鏡射位置，以及 snapshot dynamic occlusion／dynamic reflection 為 numerical approximation。三種形狀共用256項幾何預算；dynamicReflector 使用當次真 pose，非 Fixed 的 staticSurface 仍只遮擋。曲面不含聚焦／caustics／curvature divergence，動態傳播沒有 retarded-time／移動邊界 Doppler。late reverb 為 Synthetic／perceptual approximation；多階 solver、厚牆 transmission、完整 calibrated RIR／room validation 仍未完成。材質 A/R/T 是能量；magnitude pressure 為簡化 sqrt 轉換，scattering 不額外消滅能量。條件見[模型契約](../15-ui-parameter-audit/acoustic-geometry/MODEL_CONTRACT.md)。

direct 與 early paths 共用 emission t0，使用 absolute delay，不重複加入 direct delay。穩定 path ID 不含排名／座標。solver 與 audio 共用 5 秒傳播硬上限，預設 solver budget 仍 2 秒；超出設定明確拒絕，不靜默 clamp。音訊 callback 不等 geometry、physics、網路或 AI。

## 雲端與匯出方向

[ADR-015](adr/015-client-first-and-render-contract.md)保留 client-first：使用者本機執行 3D、physics、聲學、音訊、錄放；雲端提供 static/CDN、auth／tenant metadata、asset storage、受控 Meta proxy。雲端 Render Queue／workers 是後續可選，不作 MVP 必要前置。

[RenderJob／RenderBackend](../../src/audio/render-contract.ts)保留 portable artifact refs 與明確能力，產品已以 native OfflineAudioContext／同一 AudioEngine 實作有限短 take 的 pre-master Wet、Dry、Master 及按作者物件分組的 stems；每檔與來源設定固定 hash，成功才原子發布。working／output 估算上限256／192 MiB，不涵蓋 browser 內部峰值。純 late tap、listener replacement、asset HRTF、保留 DSP 狀態的長 chunk、ADM／cloud 仍未提供。不能將 browser-only OfflineAudioContext 假定可直接在 Node 執行；實際 UI 下載、PCM 檢核與方法限制分別見[核心交接](../14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md)，不是以 WAV encoder tests 代替產品操作。

成本與性能見[Cloud Cost Model](../12-architecture-review/CLOUD_COST_MODEL.md)、[Browser Research](../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md)。R17 600 秒負面性能、完整 delivery／Worklet 未驗、正常 100% 實體 FPS／IME 與裝置聽測仍保留。
