# 決策日誌

| 日期（台北） | 決策 | 證據／狀態 |
| --- | --- | --- |
| 2026-10-26 | 起始空目錄、無 Git，建立全新 preproduction；不假設有舊原型 | PROJECT_BASELINE／原始列舉 |
| 2026-10-26 | 維持研究／隔離 spike，不大規模寫正式功能 | 使用者範圍；正式賽前程式條款尚未確認 |
| 2026-10-26 | Web 主線；Steam native capability adapter 候選；WASM 靜態庫存在但 browser 未驗 | ADR-005；官方4.8.1 archive／native smoke |
| 2026-10-26 | TypeScript＋Three，React 面板候選；不以效能臆測否定 R3F | ADR-001，無 React/R3F runtime 比較 |
| 2026-10-26 | Rapier fixed step；bounded impulse grab，不相機 parent | ADR-002/004；官方 API＋隔離基本物理 |
| 2026-10-26 | SI＋right-handed Y-up/-Z；stable IDs／versioned schemas | ADR-007；8 schema 檢查 |
| 2026-10-26 | Workspace 與 Simulation State 正交；Tab 留 focus、B Build；preview/staged/enable 分開 | UX／physics 跨代理整合 |
| 2026-10-26 | A/B 主線 motion trace；physics properties 改變需新 run | ADR-009；未宣稱跨平台一致性實測 |
| 2026-10-26 | Meta provider 文件研究與帳號可用性分開；API 預算0、未 live call | ADR-008；AI documents |
| 2026-10-26 | Web Audio stable2021 REC 與 current1.1 Working Draft 分開引用 | W3C 官方兩個版本 |
| 2026-10-26 | 本地 Git main 初始化，無自動 commit／remote／push | Git environment preparation |

此表為 bootstrap 已採納的工程建議；更動需新 ADR 或 supersede 記錄，不覆寫歷史證據。規則查核找到 CV waiver 已自稱 Official Rules；不能繼續寫「完全沒有官方規則」，但未公開細則仍未知。
