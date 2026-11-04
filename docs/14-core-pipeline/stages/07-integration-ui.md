# 核心管線 UI 整合與基本驗證

日期：2026-11-02（台灣）。執行者：Codex UI 整合代理；本輪是核心功能接線與基本回歸，交由 Claude Code 重新驗證與調整後再由使用者人工測試。程式來源與收據的實際 Git HEAD 見同目錄的 `07-ui-evidence/*-process.json`；UI 修改在記錄時尚未獨立提交，不捏造自己的最終 SHA。

## 已實作

- 沿用 AnalysisDock 的場景優先版面、現有元件與 canonical tokens，新增「動作」「音訊匯出」「效能」分頁；保留 roving tab、Home／End／方向鍵、繁中與英文切換。
- 新面板以 mount／hidden 保留草稿與進行中的工作；匯出面板僅在目前分頁展開時執行低頻 refresh，不新增音訊 tap 或輪詢原生音訊統計。
- MotionPanel 透過有 revision 的作者操作與 runtime dispatch 接線；UI 優先讀取與 Scene 同次發布的 Motion read model，沒有自行修改 Scene 或推進物理。
- RenderPanel 接入真 RenderHost、3 秒受控錄製入口與逐檔 WAV／manifest 下載。此階段瀏覽器 smoke 驗入口可達，實際音檔內容與完整管線匯出由 renderer／root 階段另驗。
- 效能面板分開顯示音訊影格、起音、求解送達、控制更新與原生輸出視窗；缺值保持「—」，未提供的原生計數不當作零。成本觀測有真開關；停用時顯示保留歷史，隱藏面板不冒充停用觀測。
- Agent 面板新增有限基準實驗與同運動材質候選比較操作，沒有因選取 provider 而自動呼叫模型或套用提案。結果只展示能與完整 metric／artifact／run citation 匹配的 Host 數值，缺值保持 unavailable；原始說明與來源收入 details。
- 新增獨立「復原上次 AI 套用」入口，讓純 Motion sidecar 交易走 AgentSession.undo，而非一般 Scene undo；`ai.canUndo` 是可選 read-model 欄，舊控制器維持相容。
- 作者 UI 的 trigger 禁用狀態改讀與 trusted Host 相同的 producer capability 清單。OnBounce 不再被舊硬碼停用；有限固定支撐面分類的限制可用 tooltip 查閱，zone producer 仍明確未支援。
- App 的錯誤包裝器保留 prototype 上的 optional composition ports 及其 `this`；bootstrap 更上層 facade 的相同漏接由 root 修補，真 browser 已確認接線生效。
- 新增短 take、錄製高水位、評估失敗與實驗流程的英文狀態，保留動態診斷原文與具體錯誤來源。

## 設計核對

依既有 Reflection Lab 設計系統與專案固定版本 Emil skills，未新增 UI library、字型或第二套 token。

| Before | After | Why |
| --- | --- | --- |
| 新功能只有 domain／host API，原分頁沒有入口 | 原 AnalysisDock 內提供動作、匯出與效能分頁 | 保留畫布比例，功能可發現且不重建編輯器 |
| Shell 只轉送舊控制器方法 | 保留新的 optional ports 並綁定 runtime receiver | 避免單元功能存在、真 UI 卻顯示 unavailable |
| 切換時若卸載新面板會丟草稿 | 面板維持 mount，匯出刷新依可見性停用 | 保留工作內容且限制背景工作 |
| 原 UI 硬碼 OnBounce 未支援 | 依共用 trusted capability 清單決定 | 與真 producer、AI 與 Host 一致 |
| 一般 Scene undo 無法代表純動作 AI 交易 | 獨立 AI Host undo | 保留各交易的 revision、digest 與 sidecar 權威 |
| 未觀測原生輸出容易被視為零 | 區分 unavailable、warmup、reset 與有效視窗 | 不把缺值寫成乾淨輸出或裝置驗證 |

## 實際基本驗證

| 命令／範圍 | 結果 | 收據 |
| --- | --- | --- |
| 5 個 UI 基礎測試檔：ports、capabilities、grounded presentation、diagnostics、locale | 19／19 PASS | `07-ui-evidence/basic-unit-final.txt`、process JSON |
| `node --import tsx --test src/ui/pipeline-ui.test.ts` | 5／5 PASS | `07-ui-evidence/pipeline-ssr-final.txt`、process JSON |
| `node node_modules/@playwright/test/cli.js test --config tests/browser/pipeline-ui.config.ts` | 2／2 PASS，29.8 秒 | `07-ui-evidence/browser-smoke-final.txt`、process JSON |
| owned UI／browser 檔案 scoped ESLint | exit 0 | `07-ui-evidence/scoped-eslint.txt`、process JSON |
| owned UI／browser 檔案 Prettier | 已格式化 | 終端命令結果；整合 format:check 由 root 另跑 |

Browser 使用真 headless Chrome、CDP／Playwright 輸入與隔離 `5188` dev-e2e server，驗證 Motion 草稿切分頁保存、鍵盤 tab 導航及切語言後匯出／動作入口。這不是原生 Pointer Lock、真人視覺品質、裝置聽測或正式性能 PASS。

## 保留的失敗與修正

- 基礎合跑首輪 18／19：新增 Runtime／RecordingHost 的 9 個繁中狀態缺英文。原失敗 `basic-unit.txt` 保留，補齊後 19／19。
- pipeline SSR 首輪 4／5：測試把帶 tooltip 的 button HTML 斷言成無 aria-describedby。產品的無障礙屬性是正確的；改檢查實際 enabled／disabled 狀態後 5／5，首輪摘要保留於 process JSON。
- browser 首輪 0／2：真 bootstrap facade 未轉送新 ports，動作面板顯示 unavailable；root 已修。另一項測試誤用舊的單語 accessible name，已改用既有雙語標籤。原 stdout／process 保留；截圖、trace 與 context 保存在 `.cache/pipeline-ui-browser-initial/`，檔案雜湊見 `07-ui-evidence/browser-initial-artifact-manifest.json`。
- 最後 TypeScript 檢查中兩處 UI optional props 曾違反 exactOptionalPropertyTypes，改以條件 spread；其餘 root `lateReverb.seed` 由 root 修補，整合 tsc 最終收據以 root 為準。

## 交接與限制

- Root 仍需完成全整合回歸、正式建置、Computer Use 真操作與逐檔匯出、最終 main 合併及共享記憶／英文文件同步。
- Claude Code 複核時先讀本階段失敗與最終收據，從完整管線重跑；不要把此處 SSR 或瀏覽器 smoke 升格為完整 V1、600 秒性能、Meta live 或裝置聽測。
- UI 未更動聲學／物理公式、原 reference、原容差或聲線資料來源；沒有新增付費 API、部署或推送。

## 後續原子發布修補

Motion workspace 的內部 `changed()` 可在 sidecar 安裝時先通知直接訂閱者；若 UI 另讀 live workspace，可能短暫把新 Motion registry 與尚未發布的新 Scene 混用。本輪將 `LabViewModel.motion` 設為可選的同次發布快照；Motion 面板優先讀取 `model.motion`，不再直接訂閱 workspace。舊控制器缺此欄位時才使用明示的 `workspace.getView()` 相容路徑。

- 新增「published snapshot 不提前讀 live/install、也不獨立訂閱」與 legacy fallback 回歸。
- `node --import tsx --test src/ui/pipeline-ui.test.ts src/ui/controller-ports.test.ts`：9／9 PASS（7 項 pipeline SSR，2 項 ports），收據 `07-ui-evidence/motion-atomic-ui.txt` 與 process JSON。
- 本次只改三個 UI／型別測試檔；Runtime 的發布快照與 bootstrap critical revision 由 root 接線。沒有改 Scene／Motion domain 語義、公式或驗收容差。
- 先前 2／2 browser smoke 保留其原來源截點，本次只以相關單元／SSR 回歸驗證 read-model 原子性，沒有把先前 browser 結果冒充新來源重測。
