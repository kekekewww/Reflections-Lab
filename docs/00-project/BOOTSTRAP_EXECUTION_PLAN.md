# Reflection Lab 研究與準備執行紀錄

日期：2026-10-26；使用者已明確授權自主完成研究、資料契約、環境與隔離 spike。正式產品開發另起階段。

## 分工與檔案所有權

| 工作 | 負責 | 專屬目錄 |
| --- | --- | --- |
| 起始盤點、整合、ADR、Harness、Record/Replay | 主代理 | docs/00-project、02-architecture、07-experiments、根目錄、.agents、非 AI schemas |
| 聲學／DSP／物理科學證據 | scientific_research | research/papers、theory、datasets、EVIDENCE_LEDGER.json |
| SDK／授權／native smoke | steam_sdk | docs/03-sdk、third_party/steam-audio、experiments/sdk-smoke-tests |
| FPS／物理 API／隔離 spike | physics_design | docs/04-physics、experiments/physics-spike |
| UX 競品與操作規格 | ux_research | docs/05-ux |
| Meta 官方模型／AI 契約 | meta_ai | docs/08-ai、schemas/ai-* |
| 規則與來源政策 | compliance | docs/01-compliance |
| 工具鏈／解析驗證／效能 | validation_tooling | tests、benchmarks、scripts/validation、docs/06-validation、package 設定 |

## 執行順序

1. 保留空目錄與無 Git 的觀察基準，讀取原始需求。
2. 優先查核競賽正式規則；無法確認的條款不以一般經驗填補。
3. 並行查證官方 API、論文、SDK、UX；明確區分全文、摘要與 metadata 存取。
4. 由實際證據比較架構，建立可逆 ADR、capability-aware backend、單位與時間契約。
5. 建立精簡 Skills、AGENTS、鎖定依賴與驗證命令。
6. 執行 SDK／physics／數學／schema／文件驗證；保留結果與真正限制。
7. 交叉審閱各代理成果與矛盾，輸出 Gate、十日相對路線與下一任務。

所有一般工程決策由代理負責；只有法律接受、帳號資格、付費 API 或正式提交需使用者本人處理。本次不執行這些操作。
