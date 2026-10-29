# 資料與聲學後端契約

2026-10-29：下列資料語義保留；正式 Scene／Project／AcousticFrame／事件與錄放已有 runtime，不能再把本頁 V0 描述讀成全產品未實作。現行程式與研究差異見[架構](ARCHITECTURE.md)及[Gap Analysis](../12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md)。Portable RenderJob／RenderBackend 見 src/audio/render-contract.ts，僅預留型別；solver 與 audio 的傳播硬上限共用 5 秒、預設 2 秒，不改現有序列化格式。

## Scene / Material

`schemas/scene.schema.json` 是最小儲存格式；穩定 ID 不得使用陣列 index 或 runtime handles。`sceneRevision` 每次已套用交易單調遞增；revision 前置條件不符回 `STALE_REVISION`。command delta 與 undo inverse 由 host 產生，AI 只提交候選操作。跨 ID 參照、quaternion 單位長度、封閉 mesh、質量與碰撞幾何有效性由 domain validator 處理，不能假設 JSON Schema 已處理。

`schemas/material.schema.json` 只收能量模型 `A + R + T = 1`。此處 A 是真正耗散、T 穿透、R 全反射能量；某些量測 absorption 已包含穿透損失，不能再重複扣 T。scattering 是 R 中漫反射比例，不額外消滅能量。壓力振幅 |r|=sqrt(R) 僅在相同阻抗、無相位資料的簡化模型成立；必須記 `phaseModel`。`transmissionLossDb` 不能直接當 gain，T=10^(-TL/10)，相同阻抗振幅為 10^(-TL/20)。

每筆材質附 `dataClass`（Measured / Derived / Tuned / Synthetic）、來源 URL、頻帶中心 Hz、角度／安裝／厚度／試驗方法條件。初始示範材質必標 Synthetic，不能以木材、混凝土名稱暗示量測。canonical 頻帶可先用 125–8000 Hz octave，adapter 依來源定義轉換；禁止把外部三頻值複製到八頻並稱實測。Steam band definition 與係數語義見 SDK 文件。

## AcousticFrame

`schemas/acoustic-frame.schema.json` 每份 frame 明定一組 `sourceId/listenerId`，每條 path 必須屬於該組；多聲源使用多份 frame，不共用 direct delay。`bandCentersHz` 必須嚴格遞增，`gainQuantity=pressureRatio`，每條 path 的 bandGains 與頻帶長度一致。最小材質 schema 只接受 zeroPhaseMagnitudeOnly；複數阻抗／相位模型待有實際資料契約再版本升級。

capability 支援：`directParameters`、`individualReflectionPaths`、`impulseResponse`、`lateReverb`、`dynamicOccluders`、`dynamicReflectors`。未支援欄位為 null／空 collection 並帶原因；空 paths 也可能是沒有可見路徑，UI 必須區分。

Path ID 由 source ID、listener ID、有序 surface IDs、diffraction/branch 類型與 solver model version 組成；座標、排名與 delay 不納入 ID。幾何 topology 改變才重建 identity namespace。反射順序必保留，`wallA→wallB` 與反向不同。audio bank 依 ID 配對，低能量路徑排序變動不能重設 voice。

每條有效 path 有實際 vertex positions、長度、absolute delay、relative delay、arrival direction、頻帶 gains、surface chain、模型與限制。`arrivalDirection` 是 listener 指向倒數第二個 vertex 的單位向量（apparent source／HRTF方向），與聲波最後一段前進方向相反；直達 path 則為 listener 指向 source。相對 delay 只是對該配對直達聲的差值；聲音排程使用同一 t0 的 absolute delay，禁止對 reflection 再重複加入 direct delay。

IR output 必須附 sample rate、channels／ambisonic order、reference emission time、normalization、是否含 direct、是否含 air／distance／material、solver version。UI 不能由 IR 反向虛構幾何路徑；energy-time histogram 也不能直接當 phase-correct IR。

## PhysicsAudioEvent

記錄 `experimentId, tick, substep, sequence, bodyAId, bodyBId, contactId, worldPointM, normal, relativeVelocityMps, impulseNs?, forceN?, surfaceIds, materialPair, classification`。force 與 impulse 不同；引擎 API 未提供就存 null，不把 force 冒充 Ns。使用模擬時間，不以 `Date.now()` 作音訊排程依據。連續 emitter 與 contact voice 分別配置 IDs。

契約上限與拒絕：初版 scene 最多 256 objects、32 sources、1 active listener、200 m 場景範圍；這些是保守設計預算，不是性能測試結論。輸入 NaN／Infinity、外部任意 URL、重複 ID、負質量與超大 operation array 拒絕。相依 API 詳見 [AI 工具規格](../08-ai/AI_TOOL_SCHEMAS.md)。
