# 架構研究與整合驗證計畫

日期：2026-10-29。權威需求：[原始請求](../00-project/ARCHITECTURE_REVIEW_REQUEST.md)。唯一任務：[RLAB-TASK-0021](../../knowledge/tasks/RLAB-TASK-0021.json)。本計畫不修改[凍結 V1 驗收](../11-v1/ACCEPTANCE.md)或[使用者補充](../11-v1/ACCEPTANCE_AMENDMENTS.md)。

## 執行與檔案所有權

- [x] 原工作區唯讀 preflight、baseline、remote 確認；建立完整獨立 worktree，根目錄見 baseline.json。
- [x] 鎖版 Node 22.17.0／npm 11.4.2；新 worktree 的 root 與 physics-spike 各自離線 npm ci，沒有共用 node_modules。
- [ ] 五個研究領域各自單 writer：物理／聲音、聲學／ADM、錄放／render、browser／cloud、Meta／UI；root 維護 canonical architecture／ADR／Wiki／task。
- [ ] Category A：修正過期「無產品」敘述，保存現有科學／聲音／性能／外部限制，來源只引用或短摘要。
- [ ] Category B：共用 5 秒傳播上限（solver 早拒絕無法交給 audio 的設定）；types-only portable RenderJob／RenderBackend，不註冊或啟動 renderer。
- [ ] 執行完整品質、解析 benchmark、相關真 browser，保存命令／exit／stdout、變更來源 hash；隔離 reviewer 對照原需求與實檔。
- [ ] 取得最新原分支、merge-base 與兩邊 diff，若有新進度先在研究分支整合，再安全 no-ff merge；整合後重新驗證。
- [ ] 全 reachable history 公開審查通過後才 push。已知原歷史含三個 >100 MiB 產物，不能用最新 commit 刪檔當成歷史已清理；如無授權的安全解法，保留成果並記 BLOCKED。

## 驗證順序與接受條件

| 階段 | 實際命令／證據 | 接受條件 |
| --- | --- | --- |
| 依賴 | npm ci --offline --ignore-scripts --no-audit --no-fund；physics-spike prefix 同法 | 鎖版、exit 0；無 lockfile 差異 |
| 窄修 RED/GREEN | node --import tsx --test tests/acoustics-runtime/propagation-limit.test.ts | 先看到跨層錯配失敗，再邊界與 audio 一致通過；不改既有 oracle/tolerance |
| 品質 | npm run check | 包含研究、runtime、schema、Wiki、typecheck、lint、format、build、licenses、英文；逐流程讀結果 |
| 解析／離線 | npm run benchmark | 固定 reference、誤差、原門檻保留 |
| Browser | product-refined-v3、physics lifecycle、storage、UI-refined-v2 / linked-workflow-v2 | 真瀏覽器按適用入口執行；功能成功不冒充聽測／性能通過 |
| 獨立 review | 原需求／base..HEAD／現行 source／驗證收據 | 檔案所有權、契約、來源／成本、公開安全與已知限制查核 |
| 整合 | 最新原 branch / research / merge-base、no-ff merge、check / relevant E2E | 原工作區 clean；無未解重大衝突；不 stash / reset / force |
| 公開 | 完整 history secret / archive / binary / size audit、remote 比較 | 無未解重大公開風險，遠端歷史保留；push 後 HEAD／檔案／CI 核對 |

## 審查焦點

1. 5+epsilon／10 秒求解設定不得先產生 audio 無法接受的 frame；0.001／5 秒與預設 2 秒仍有效。
2. RenderJob 只含 portable refs，不序列化 AudioNode／Rapier／runtime；source selection 保留物理、事件與 admission。
3. 錄製聲學同步熱路徑、RAF 驅動與 main-thread metadata 成本必須如實列出，不以 Worker 存在推論所有求解都隔離。
4. 成本是明列 duty / rate / storage / egress 的工程估算；價格查核日固定，不能保證 10,000 concurrent 或模型費率。
5. build／測試產物即使在最終 tree 刪除仍留 history；公開審查未過時不 push。

本輪不做 UI 視覺修改、不新增 paid API calls、不部署、不選 root LICENSE、不代替本人接受條款。正常 100% 實體 FPS／IME、Hi-x65／D3V 聽測、R17 性能失敗保持原狀。
