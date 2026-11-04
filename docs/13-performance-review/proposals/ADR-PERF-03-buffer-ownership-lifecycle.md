# ADR-PERF-03：Buffer 所有權、預算與生命週期

- 狀態：**PROPOSED／未採納**；2026-11-01。此為後續所有權審查候選，沒有新增公共型別、pool、SAB 或儲存格式。
- 程式基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`；新峰值量測／pool 驗證均 **NOT RUN**。
- 依據：[資料契約](../../02-architecture/DATA_CONTRACTS.md)、[ADR-015](../../02-architecture/adr/015-client-first-and-render-contract.md)、[Buffer 審查](../BUFFER_ARCHITECTURE_REVIEW.md)、[記憶體審查](../MEMORY_AND_RESOURCE_REVIEW.md)。

## 問題與已有機制

[src/audio/assets.ts](../../../src/audio/assets.ts) 已追蹤 decoded bytes、in-flight decode reservations、concurrency 與 generation；資產使用中不能替換，candidate bank 全部合法才發布。[band-filter.ts](../../../src/audio/band-filter.ts) 已有 bounded response／layout cache、private kernel copy、固定 scratch workspace 及 reentrant fallback。[routes.ts](../../../src/audio/routes.ts) 已有雙 FIR bank 與 stable route reuse；這些不是本提案新增的功能。

但各層 budget 分開成立不代表總 heap 峰值受同一數字限制。asset PCM、FIR cache、AudioBuffer、雙 IR bank、retiring routes、snapshot clone、recording artifact、canonical bytes、parsed replay copy 可以重疊。transfer 與 JS GC 也不是資源歸還協定；把 buffer 放回 pool 前必須證明沒有 consumer 繼續讀。

## 候選決策

先建立可量的 ownership inventory，對每條熱路徑標 owner、readers、容量單位、release boundary 與 peak coexistence，再只對量測證明值得的 packet／scratch 設 pool。保留目前安全 copy 是可接受結果，不以「zero-copy」作成功條件。

| 資料種類 | 候選 owner 與讀寫規則 | 釋放／取消邊界 |
| --- | --- | --- |
| Scene／authoring arrays | Host 權威；不 transfer 仍供 UI／command 使用的 storage。 | 原 revision transaction；不因 transport 完成改權威。 |
| Transport ArrayBuffer | 單 writer；`free → filling → inFlight → consuming → returned`；每次帶 generation。 | receiver 最後一次引用後 ack；crash 使整個 pool generation 失效，不能猜測對方已歸還。 |
| Decoded PCM／AudioBuffer | AssetStore pin；native voices／frozen arrivals 只讀同一 revision/hash。 | 維持 active、retiring、pending、frozen pins；drain 後才可替換，clear 使舊 decode generation 無法 commit。 |
| FIR coefficients／scratch | Cache 持 private immutable coefficients；caller 拿 owned result；scratch 不外洩。 | cache eviction 僅釋 cache reference；AudioBuffer／targetKernel 的 lifetime 另外計。 |
| IR banks／route state | 各 graph owner；active／fading／retired 都算 live。 | audio fade／tail 確認完成且 disconnect 後退役；wall timer 晚到不代表可提前覆寫。 |
| Recording／replay | artifact、prepared bytes、replay reader 的獨立 owner。 | stop/drain/publication 或 seek/dispose；不能因一個 reader 完成就回收其他 reader 的資料。 |
| 未來離線 PCM | RenderJob 專屬 working/output 預算。 | cancel／output publication；現行只有 types-only seam，尚無此 buffer owner。 |

概念 lease 使用 `resourceId, ownerId, runEpoch, generation, byteLength, state`；不得用 array index／Rapier handle 當 persistent identity。轉移 packet 不表示 Scene／Recording 的權利也轉移。多 reader 以明確 pin／ack 或保留 owned copies 表達，不宣稱 readonly TypeScript 可阻止底層 mutation。

## 容量與過載

所有 budget 要同時報 logical items 與 bytes；PCM 依 frames×channels×bytes/sample、sample rate 另列，IR 雙 bank 與 overlap／tail 都計入。報 allocated／reserved／in-use／retiring／pooled-free／peak，區分 JS 可見 payload、native audio allocations 與無法可靠量的 engine overhead。`64 MiB decoded PCM` 等現有上限不是總 process memory。

pool 容量由最大合法 packet、同時 consumer 數與實測 residency 推導，先保留 hard upper bound；不自動成倍擴張。無空槽時互動可略過未接納預覽並記數，recording 暫停 producer，asset/decode 拒絕，audio 依既定 admission 降級；不在 callback allocation 擴容。timeout 只改 job 狀態，不把仍可被 consumer 存取的 buffer 回收。

## 替代、相容性與風險

現有 owned copy 最容易保留 validator／hash semantics；pool 可降低特定 allocation，但容易引入 stale view、ABA generation、double return、use-after-transfer 與大池保留。SAB 增加 shared publication／隔離部署風險，僅在獨立 profile 後候選。自訂 PCM ring 只適用未來需要串流的 producer/consumer；現行 AudioBufferSource 直接讀 asset，不因「音訊」而必須重建傳輸環。

[HTML transferable 規範](https://html.spec.whatwg.org/multipage/structured-data.html#transferable-objects)定義轉移與 detach 的行為；減少複製不消除排程、驗證、native allocation 或 receiver lifetime。變更 native graph、sample rate 或 artifact hash representation 不屬本提案的自動授權。

## 採納與回復

先用同一合法最大 fixture、頻繁 source churn、pause/resume、import/replace、cancel/dispose 與 seal/save/replay 重疊，量峰值與回到 idle 的 residual。注入 delayed ack、重複 ack、錯 generation、decode 中 clear、Worker crash、retained typed view 與多 reader；要求沒有 alias mutation、detached read、舊 revision commit、pin 提早釋放或超預算未報錯。數值、asset hashes 與錄製 hash oracle 必須保持。

只有[量測](../MEASUREMENT_PLAN.md)指出 allocation／copy 對原 budget 有實質成本，且 pool 降低該成本而不擴大不可控 residency，才凍結容量並採納；新容量與允許誤差另經實作任務審查。回復時停止新 leases、取消／drain 在途 generation、釋放無讀者的新 pool，回到原 owned-copy／AssetStore／cache 路徑；不能直接清空仍有 native voice 引用的資產。
