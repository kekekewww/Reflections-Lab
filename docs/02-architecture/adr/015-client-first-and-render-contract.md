# ADR-015：Client-first 執行邊界與可替換 Render 工作契約

- 狀態：Accepted for architecture refinement，2026-10-29。先存在研究分支，安全合併後才成為原分支的有效決策；不是雲端部署或完整 renderer 完成。
- 需求：[本次使用者要求](../../00-project/ARCHITECTURE_REVIEW_REQUEST.md)；承接 ADR-009／010／011／014，沒有取代其 Scene／clock／科學／開發政策。
- 證據：[現行盤點](../../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md)、[browser](../../12-architecture-review/BROWSER_PERFORMANCE_RESEARCH.md)、[cloud](../../12-architecture-review/HYBRID_CLOUD_ARCHITECTURE.md)、[offline render](../../12-architecture-review/OFFLINE_RENDERING_RESEARCH.md)。

## 決策

1. 3D、Rapier、custom acoustics、聲源生成、錄放與短程 offline render 優先在 client 執行；現有主線繼續運作。雲端負責靜態分發、身分／專案 metadata、資產與受控模型 proxy；cloud render 只作後續可替換選項。
2. 不因 Worker 存在就宣稱整體不阻塞。現有 physics 與 recording acoustic evaluation 仍在 main thread，RAF 推進 accumulator。先保持明確 clock／snapshot／backpressure 契約，再以 profile 決定 physics／record lane 遷移；本輪不全面搬遷。
3. 新增 src/audio/render-contract.ts 的 types-only RenderJob／RenderBackend／RenderResult。Job 指向既有 RecordingArtifact、settings 與資產 hash，明列整數 tick/sample mapping、pre-roll/tail、listener/HRTF、發聲選擇與tap、記憶體／輸出預算。現有 AudioEngine 不另建重複版本。
4. Stem selection 只選原錄製已存在的發聲，不移除其他物理物件，不重算 voice admission 或碰撞世界。逐物件輸出共用時基；總線 limiter 等非線性處理不得假設 stems 相加等於 full mix。Listener/HRTF 變更需重新評估受影響的空間／聲學結果。
5. Backend 必須報 actual capabilities／版本／limits／有限樣本診斷，不能把要求複製成成功。未支援能力要拒絕。Browser native HRTF 無可固定 coefficients hash，需如實標 unspecified。
6. solver／audio 傳播 budget 共用 5 秒明示硬上限，超過在 solver validation 回 INVALID_BUDGET。這修正原本 solver 可收 10 秒但 audio 拒絕 >5 秒的跨層錯配；不改預設 2 秒或 Scene schema。
7. 現行 loopback Host／Origin gate 不是雲端 user auth。部署前另完成 tenant isolation、request idempotency、durable per-user/global quota與in-flight lease、asset ACL／size／rights、timeouts；本輪不部署或啟用新付費請求。

## 選項、代價與驗證

全 server 端即時 physics/audio 會把成本綁定每位互動使用者，還需低延遲串流；目前沒有這項需求或量測支持。立即搬所有系統至 Worker 會擴大 lifecycle／input／時間同步風險。維持現有 client 主線、先補明示 interface 是可逆且較小的變更，但不解決目前 main-thread 超標。

types 不能代替 runtime validator／serializer／真 backend。後續 renderer 任務必須補負面 job validation、NaN／clipping／tail／alignment／stem isolation、cancel／retry／hash驗證。5 秒窄修用獨立 RED/GREEN 邊界測試與既有回歸；完整性能目標不放寬。

Category A/B；無依賴更新、無 Scene／Project／Recording migration、無 Category C 重構。公開 history 的大型／禁止產物風險另見[發佈審查](../../12-architecture-review/PUBLICATION_AUDIT.md)，不能透過本 ADR 自動授權刪除或改寫歷史。
