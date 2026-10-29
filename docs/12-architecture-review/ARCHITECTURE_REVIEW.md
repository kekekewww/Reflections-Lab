# Reflection Lab 全面架構研究與整合審查

## 整合狀態更新

研究與最小修正已安全合併，原工作區完整品質與當前功能瀏覽器分項通過；提交與公開 Gate 以 [integration-state.json](integration-state.json)為準。本輪亦保留原工作區新增的 [R18 真人回報](../11-v1/USER_TEST_FEEDBACK_20261029-r18.json)：第一人稱操作失敗、下游 FPS 操作受阻，材質／反射未測、音量過小與直接操作不直覺。實測 bundle／裝置未捕捉，這是使用者回報，沒有獨立重現或修復；不以本輪自動測試改寫。P0 下一步先診斷此輸入阻斷，再續錄製熱路徑與性能；其餘研究維持各自來源／近似／未實作標記。

既有 CI 的舊 UI 入口已在獨立位址實跑並保留 1 PASS／1 FAIL／11 未執行；FAIL 為收合說明的過期可見斷言。CI 改用既有 maintained UI／linked suites，保留原測試及其斷言，linked 的 CI browser 選擇與安裝的 Chromium 一致。原始碼／驗收／聲學模型均沒有因這項 CI 修正更動。


日期：2026-10-29。基準 c210ca882ca8503b322c28884bf1e9f6e9fe126d；原 branch codex/sound-behavior-research；研究 branch research/architecture-review-20261029。實際工作區／baseline 見[收據](baseline.json)，最終 Git／驗證／發佈 gates 見[整合報告](INTEGRATION_REPORT.md)。本文件是單一研究入口，不建立第二套產品規格或任務系統。

## 結論與原架構比較

維持 React／TypeScript／R3F、Rapier、Custom Web Acoustic Core、Web Audio 與 server Meta adapter。既有 Scene／revision／undo、Sound Behavior、錄放／來源 phase、A-B、資產權利 refs 已有可沿用基礎，沒有研究證據要求全面重寫。

本輪修正兩類缺口：canonical 文件時態落後於程式；solver 最長傳播 budget 曾接受 10 秒而 audio 最大 5 秒。新增共用 5 秒硬上限，預設仍 2 秒；超界 early reject，不改 Scene schema。另增 types-only portable RenderJob／RenderBackend，沒有啟動或偽造未實作的 offline/stems/cloud backend。依據與取捨見[ADR-015](../02-architecture/adr/015-client-first-and-render-contract.md)。

| 邊界 | 原 baseline 實際狀況 | 本輪結果／仍需驗證 |
| --- | --- | --- |
| Scene／runtime | 作者 document 與 Rapier／AudioNode 已分開，原子 command／undo | 沿用原格式，無 migration |
| Physics／render | 固定步由 RAF accumulator 推進，Rapier main thread | 未搬 worker；60 Hz 不代表主執行緒獨立或 real-time 保證 |
| Acoustics | 普通 live 是 Worker，record onTick 另有同步求解 | 修正文件，保留 recording lane 的性能優先項 |
| Audio | native node 圖、一次delay與paths已有；custom Worklet 未實作 | 共享 5 秒上限；完整 delivery／dropout／聽測未驗 |
| Recorder | snapshot＋整數 ticks＋raw/behavior/audio events＋phase＋hash | 沿用 RecordingArtifact；native playhead估計不是硬體PCM |
| Render／export | JSON／WAV helper／offline DSP tests；沒有完整take renderer | 新 portable types-only seam；mix/stems/drywet/ADM 仍 PLANNED |
| Cloud | loopback Meta service、client runtime，未部署 | client-first 決策；auth／tenant／durable quota／optional queue待實作 |
| AI／UI | 工具有schema／preview／apply，UI共用domain，仍有能力落差 | 保留手動工作；不以工具別名或靜態碼審填成完成 |
| Publication | 原歷史含 build/cache/archive／三個 >100MiB blobs | 安全 gate 獨立；只刪 HEAD 不清歷史，不擅自重寫 |

完整能力、code paths、依賴與 test coverage 範圍見[Gap Analysis](ARCHITECTURE_GAP_ANALYSIS.md)。未收集 statement/branch coverage，不捏造百分比。

## 研究交付與來源

| 必要領域 | 交付與主要來源類型 |
| --- | --- |
| Physics／Move To／Move & Release／Impulse | [PHYSICS_AND_MOTION_RESEARCH](PHYSICS_AND_MOTION_RESEARCH.md)：Rapier 官方 body/controller/CCD/joint 與現有 runtime |
| Sound generation／behavior／voices | [SOUND_BEHAVIOR_RESEARCH](SOUND_BEHAVIOR_RESEARCH.md)：FMOD／Wwise／MetaSounds，producer與evaluator明確分開 |
| Custom core／時基／path／bands | [CUSTOM_ACOUSTIC_CORE_RESEARCH](CUSTOM_ACOUSTIC_CORE_RESEARCH.md)：既有 primary papers、Web Audio、幾何解析probe與限定模型 |
| Scene performance recording／replay | [RECORDING_AND_REPLAY_RESEARCH](RECORDING_AND_REPLAY_RESEARCH.md)：既有實作、W3C timing、snapshot與determinism邊界 |
| Offline mix／stems／memory／tail | [OFFLINE_RENDERING_RESEARCH](OFFLINE_RENDERING_RESEARCH.md)：2021 REC與1.1 WD、實際引擎可用性分開 |
| ADM／BW64／Dolby profile | [ADM_EXPORT_RESEARCH](ADM_EXPORT_RESEARCH.md)：ITU BS.2076／BS.2088、EBU libadm/libbw64，profile合法交付另驗 |
| Browser performance | [BROWSER_PERFORMANCE_RESEARCH](BROWSER_PERFORMANCE_RESEARCH.md)：main/worker/worklet、RAF／錄製熱路徑、SAB/COOP/COEP、IDB/OPFS與兩種硬體矩陣 |
| Hybrid cloud | [HYBRID_CLOUD_ARCHITECTURE](HYBRID_CLOUD_ARCHITECTURE.md)：Cloudflare／Vercel／Supabase／Cloud Run/container 官方限制與部署邊界 |
| 100／1,000／10,000情境 | [CLOUD_COST_MODEL](CLOUD_COST_MODEL.md)：九組可重算工作量／共享free tier／AI symbolic與容量上限 |
| Product Muse／rules／models | [MUSE_AGENT_ARCHITECTURE](MUSE_AGENT_ARCHITECTURE.md)：Meta Model API／官方competition／13工具對照，無新付費API |
| UI／interaction | [UI_UX_REVIEW](UI_UX_REVIEW.md)：既有Design System／Emil pins及八產品官方參考；靜態審查，非visual PASS |
| 驗證／整合 | [VALIDATION_PLAN](VALIDATION_PLAN.md)、[INTEGRATION_REPORT](INTEGRATION_REPORT.md)、[PUBLICATION_AUDIT](PUBLICATION_AUDIT.md) |

每份研究保留來源 URL、查核日、適用條件與 access 限制；詳細既有理論仍在 research/，不複製論文或建立相互矛盾的架構。中央 Claim IDs／來源索引見[Evidence Ledger](../../research/EVIDENCE_LEDGER.json)，與每領域文件中的局部 claims 交叉索引。

## 高風險發現與可行性

1. **錄製熱路徑**：普通 worker 成功不代表錄製主緒無阻塞。先以 immutable tick inputs／有界record-evaluation lane做獨立spike，保留tick連續、source phase／event順序與overload pause語義。
2. **能力差異**：OnBounce／zone 等 schema可表達但producer缺；AI preview可能提出目前不會發生的trigger。共用 capability 投影與negative fixture值得優先，不能從「preview成功」推成已發聲。
3. **離線渲染**：WebAudio 1.1 新增增量方向仍須feature test；Chunk分段重建graph會丟掉filter／delay／reverb state。先做一份短take local mix＋真正隔離stem與sample alignment oracle，再談長時間／cloud。
4. **部署**：現有Host/Origin／memory cost reserve不是session auth／多實例durable quota。不能直接將loopback server部署成公開服務。
5. **科學**：geometric approximation、Synthetic材質／late、quasi-static更新與native HRTF profile不可固定皆需保留限制；ISM解析probe不等於真房間驗證。
6. **公開歷史**：完整reachable blobs與壓縮archive均需查核；大產物與內嵌bundle即使無單獨.wasm副檔名仍算公開內容。

## 變更分級與開發順序

Category A：研究、來源、canonical時態修正、ADR、roadmap／Wiki／handoff、成本與安全工具。Category B：5秒契約窄修與新 boundary regression、types-only RenderBackend。沒有依賴升版、刪除產品模組或Category C。

[P0/P1/P2 Roadmap](../ROADMAP.md)以現有能力、官方台北截止時間2026-11-05 10:00與整合風險排序：P0保住可重現Demo與既有未過性能／真人／外部門檻；P1逐項實作Motion、錄製lane／local mix/stems及產品工具能力；P2才做高階聲學／ADM／cloud長render。研究完成不是把所有功能變成本次競賽必做。

[下一個工程任務](../NEXT_ENGINEERING_TASK.md)保留原驗收，提供具體檔案邊界與停止條件。獨立 worktree、檔案所有權、baseline／research／merge／remote狀態進既有Wiki；[Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)僅作原模式參考，不代替本專案schema／provenance／Git證據。
