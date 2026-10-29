# 實驗資料模型

狀態：設計＋schema；完整 recorder／storage／replay 尚未實作。

`schemas/experiment.schema.json` 定義最小 manifest。實驗 ID 是穩定 lowercase domain ID，可用 `exp-<uuid>`；每個 run 都有獨立 ID，immutable capture 不覆寫。時間以 UTC 儲存，介面依 Asia/Taipei 顯示。

| Artifact | 必備 metadata | 目的 |
| --- | --- | --- |
| Initial Scene | schemaVersion、sceneId/revision、canonical JSON SHA256 | 原始幾何、sources/listener、physics／material refs |
| Physics Snapshot | Rapier build/version、fixedDt、所有 world state、建立順序 | 同版恢復；不能跨版盲用 binary snapshot |
| Motion Trace | integer tick、body stable ID、pose、linear/angular velocity、sleep/mode | authoritative replay／interpolation |
| Contact Trace | tick/substep/sequence、pair/contact IDs、位置法線、relative velocity、可得 force／impulse | 保留原始碰撞證據 |
| Input Intent | monotonic sequence、action、target、採樣 tick | 診斷與同機 resim；不單獨保證一致 |
| Solver Settings | backend/version、geometry revision、材質 hash、溫濕壓／c、seed、rays/order、sample rate、HRTF | 可追溯模型與參數 |
| Acoustic Results | RIR／paths／metrics artifact、units、evidence class、validation level | 禁 AI 產生偽數值 |
| Runtime Telemetry | hardware/browser、wall time、timing percentiles、late/dropped events | 效能與超限解釋 |

Manifest 的 hash 是內容 SHA256，不用 MD5 作資產完整性；canonicalization 規則需版本化（sorted object keys、UTF-8、finite numbers、固定換行；原始 binary 逐 byte hash）。時間戳、檔名不能替代內容 hash。Snapshot 跟 scene metadata 同存，執行時確認匹配，失配拒絕。

音訊資產也記 license、gain、loop start/end、sample rate、normalization；HRTF 須記 profile 與 license。使用外部音效前查來源，初版可用原創合成 signal，避免未核權利的樣本。

捕捉流程：Ready → Recording → Finalizing → Captured／Failed／Cancelled。Finalizing 等待有限 job／flush；manifest 最後原子寫入。結果 artifact 缺失／hash 不符即 Failed；不可用空檔當成功。失敗保留診斷，不覆蓋上一份有效 capture。

允許資料種別：Measured／Computed／Estimated；AI-generated Explanation 僅是說明文字，引用結果 ID，不能存成量測或 solver output。V0–V5 僅代表已執行層級，不能隨模型名稱升級。
