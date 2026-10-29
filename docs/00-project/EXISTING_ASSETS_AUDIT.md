# 既有資產與功能稽核

查核日：2026-10-26。依起始空目錄逐項分類；`PLANNED` 代表使用者需求，並非既有程式已存在。

| 資產／功能 | 狀態 | 證據與限制 |
| --- | --- | --- |
| Reflections／Echo Canvas／Echo-Canva 原始碼 | UNVERIFIED | 本工作目錄沒有檔案，未搜尋其他私人目錄 |
| Hybrid 3D Acoustic Engine／SceneSpec／AcousticFrame | PLANNED | 本次只有資料契約設計與 schema |
| 一階／二階鏡面反射 | PLANNED | 隔離解析測試不等於產品求解器 |
| Direct／Reflections 統一時間基準 | PLANNED | 架構契約；尚無即時音訊系統 |
| 穩定 Path ID／birth-death crossfade | PLANNED | 設計規格與有限數學驗證，尚無 DSP 聽測 |
| Occlusion／Transmission | PLANNED | 模型／SDK spike 證據另列，不等於互動應用 |
| 多頻帶材質／Air Absorption | PLANNED | 定義與合成驗證值；沒有宣稱量測材質庫 |
| HRTF／Delay／Filter／Reverb | PLANNED | 官方 API 研究；瀏覽器聽覺／設備測試未執行 |
| Worker Acoustic Computation | PLANNED | 架構與效能預算，尚無執行緒整合 |
| FPS／Grab／Throw／Build Mode | PLANNED | 官方 API 與隔離 physics spike，尚無 UI |
| Regression／Benchmark 基礎 | 起始不存在 | 本次新增後的實際結果見 docs/06-validation |

狀態集合：`IMPLEMENTED / PARTIAL / PLANNED / UNVERIFIED / FAILED`。未發現舊原型，所以沒有可以合理宣稱已實作的正式功能；本次隔離 spike 以 `Technical Spike Verified` 獨立列帳。
