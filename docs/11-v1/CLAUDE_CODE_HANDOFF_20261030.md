# Reflection Lab — Claude Code 完整交接提示

保存日期：2026-10-30（台灣時間）。本文件保存使用者已閱覽的完整交接提示，供沒有先前對話上下文的 Claude Code 接手。Git 資訊是保存時的快照，接手時必須重新核實。本輪只保存文件與記憶入口，沒有啟動產品修復、伺服器、付費 API 或恢復原 Codex goal。

以下為交接提示正文。

---

你將接手 Reflection Lab 的後續開發。你沒有參與先前工作，請先從專案中的 Wiki 長期記憶、正式文件、Git 歷史及實際程式恢復上下文，再開始修改。

這是一個已經有正式 Web 實作、測試、研究與持久記憶的專案。請延續現有成果，不要重新 bootstrap、重建任務系統，或重複實作已完成的功能。

## 一、工作位置、交接基準與本次目標

工作目錄：

`D:\Developing\Meta Hack`

交接整理時的本機狀態（2026-10-30，台灣時間）：

- 分支：`codex/sound-behavior-research`
- HEAD：`a5f2a9098971ed8facb3b024b7539d2a9b1135f6`
- 最新提交：`docs: close architecture task with final public verification and handoff`
- 保存本文件前，已追蹤檔案沒有未提交修改，但有四處未追蹤的測試產物，必須保留。保存本文件與 Wiki／英文同步後會新增文件變更，不能將此快照解讀為接手時必然乾淨。
- 上一輪已依使用者要求停止前後端伺服器。啟動前重新確認連接埠及程序，不要假設仍在執行。

請先自行執行以下唯讀命令，核實目前狀態；若已出現較新提交，以實際檔案及歷史重新判讀：

```powershell
Set-Location -LiteralPath 'D:\Developing\Meta Hack'
git status --short --branch
git rev-parse HEAD
git log -12 --oneline
git worktree list
git remote -v
```

本次由 Claude Code 接手實作與自動驗證，請如實記錄 actual executor、模型及工具版本。現有文件中關於 Codex 主導的文字是既有開發政策背景，不應因此要求啟動 Muse、遞迴呼叫 Codex，或重建跨代理 Harness。

目標是延續第一版，優先修復使用者實際遇到的操作問題，完成可由工程與自動化驗證的工作，整理證據供 Codex 複核及使用者重新測試。真正只剩真人操作、聽感或本人決策時，保存進度並停下等待。

使用者將這份提示交由你執行時，代表授權你推進上述修補；不代表原 Codex 對話已自動恢復其暫停目標。

## 二、必須先讀的專案長期記憶

先依序閱讀：

1. `D:\Developing\Meta Hack\CLAUDE.md`
2. `D:\Developing\Meta Hack\AGENTS.md`
3. `D:\Developing\Meta Hack\knowledge\schema.md`
4. `D:\Developing\Meta Hack\knowledge\wiki\index.md`
5. `D:\Developing\Meta Hack\knowledge\wiki\now.md`
6. `D:\Developing\Meta Hack\knowledge\wiki\tasks.md`
7. `D:\Developing\Meta Hack\knowledge\wiki\handoffs\index.md`

接著閱讀兩份關鍵交接：

- 最新架構整合與公開結案：
  `D:\Developing\Meta Hack\knowledge\wiki\handoffs\6afd82e5-407f-41ad-abc9-3a5f9ff04382.md`
- 專門留給 Claude Code 的真人失敗回報：
  `D:\Developing\Meta Hack\knowledge\wiki\handoffs\117efd63-cca1-486e-8061-b379685543bb.md`

另從 handoff 索引確認本文件保存之後是否已有較新的相關交接，不限於上述兩份歷史截點。

再讀相關任務及綜合頁：

- `D:\Developing\Meta Hack\knowledge\tasks\RLAB-TASK-0012.json`
- `D:\Developing\Meta Hack\knowledge\tasks\RLAB-TASK-0020.json`
- `D:\Developing\Meta Hack\knowledge\tasks\RLAB-TASK-0021.json`
- `D:\Developing\Meta Hack\knowledge\wiki\features\interactive-sandbox.md`
- `D:\Developing\Meta Hack\knowledge\wiki\ui-ux\design-engineering.md`
- `D:\Developing\Meta Hack\knowledge\wiki\research\architecture-review-20261029.md`

操作持久記憶前，閱讀：

- `D:\Developing\Meta Hack\knowledge\README.md`
- `D:\Developing\Meta Hack\.agents\skills\persistent-project-memory\SKILL.md`
- `D:\Developing\Meta Hack\docs\09-knowledge\WIKI_OPERATIONS.md`

不要一次載入全庫；依索引按任務展開，回到原始文件、程式與測試核實。Wiki 是綜合導航，不會自動證明摘要正確。舊 handoff 中的 Git 欄位是當時記錄截點，不能當成目前 HEAD。

## 三、專案已完成到哪裡

Reflection Lab 是三維物理、可追溯聲學、互動聲音行為及 Meta AI 實驗平台。

正式產品位於：

- `D:\Developing\Meta Hack\src`
- `D:\Developing\Meta Hack\server`

主線為 React／TypeScript／Three.js／R3F／Rapier WASM／Custom Web Acoustic Core／Web Audio。已有正式 UI、物理互動、聲學 Worker、聲音行為、錄放、持久化與 AI 工具實作及分項證據。

重要提交脈絡：

- `cde1e2b`：選取識別、聲學可用狀態等修補。
- `c210ca8`：R17 證據與等待真人測試的 checkpoint。
- `b10b78a`：聲學傳播上限窄修及渲染架構研究。
- `39f6c2b`：安全合併研究成果。
- `86ffbdc`：保存 R18 真人回報與合併後驗證收據。
- `14da3d7`：CI 對齊及整合狀態保存。
- `a5f2a90`：架構研究與安全公開工作的結案記錄。

`RLAB-TASK-0021` 已 DONE，範圍是研究、最小整合與安全公開，不代表完整第一版完成。`RLAB-TASK-0012` 與 `RLAB-TASK-0020` 仍為 BLOCKED。

尤其注意：部分 Task blocker 摘要仍寫「等待真人」，但較新的 R18 已經回報第一人稱失敗。現在存在待診斷的工程阻斷，不能只把它當作尚未進行首次真人測試。

研究整合新增的完整 offline renderer、mix／stems、ADM、custom product AudioWorklet 尚未實作；不要把 types-only 契約或研究方案當成可用產品，也不要順便擴大本次範圍。

相關有效決策請從 ADR 索引讀取，至少注意 ADR-011、013、014、015。ADR-015 位於：

`D:\Developing\Meta Hack\docs\02-architecture\adr\015-client-first-and-render-contract.md`

## 四、使用者最新實測回報：這是本次優先依據

完整原文與範圍規則已保存於：

`D:\Developing\Meta Hack\docs\11-v1\USER_TEST_FEEDBACK_20261029-r18.json`

請完整閱讀。主要內容：

1. 進入第一人稱後，無法移動或進行任何操作。
2. 後續第一人稱操作因此全部無法測試。
3. 材質與反射暫時無法測試，不標記成功。
4. 預設聲音太小。
5. 無法直覺地直接點選場景物件，進行選取、拖曳、縮放等操作。
6. 使用者說「1～8 如未提及則沒問題，其他不能標記正確完成」。

第 6 點的正確解讀：

- 指先前手冊第 1～8 節內，未提及、未明確排除且不依賴失敗 FPS 的項目，記為「使用者回報未發現問題」。
- 不是前八節整批 PASS。
- FPS 抓取、投擲、建造、安全退出／替代操作及 FPS 聽測，仍是 BLOCKED／未測。
- 材質與反射仍是 NOT TESTED。
- 第九節以後的錄放、A/B、儲存匯出匯入、離線助手等，不能據此標為已通過真人驗收。
- 原測試的確切 bundle、revision、裝置路徑、DAC 與實體音量未記錄，保持 UNKNOWN。

更早的基礎回報僅支持：有聲音、方向可辨、預設場景能觀察到重力與反彈。不能擴大解釋成完整物理、聲學或裝置驗證。

上述 R18 問題目前只是記錄，沒有完成根因診斷或修復。舊自動測試通過不能覆蓋這次真人失敗。

## 五、執行優先順序

第一優先：重現並修復第一人稱阻斷。

- 先固定目前 source、bundle、瀏覽器版本及測試條件。
- 追查進入模式、Pointer Lock、輸入 armed 狀態、running／paused、焦點、事件監聽與物理角色推進的完整流程。
- 特別檢查「已進入第一人稱，但模擬仍暫停或輸入尚未啟用」等狀態是否缺乏可理解、可操作的引導。這只是待查方向，不是已確認根因。
- 對使用者而言，正常 100% 顯示比例下，入口、開始操作、目前狀態及離開方式必須清楚。
- 保留失焦、解除鎖定與安全暫停規則；恢復操作應有明確控制。
- 原生鎖定不可用時，替代操作應可理解並可測；不能冒稱已取得原生 Pointer Lock。
- 針對根因新增有效回歸，並驗證真實產品流程，不只驗內部狀態。

可由下列位置開始追蹤，但仍須以實際程式判斷：

- `D:\Developing\Meta Hack\src\ui\Viewport.tsx`
- `D:\Developing\Meta Hack\src\ui\viewport\useFPSInput.ts`
- `D:\Developing\Meta Hack\src\ui\viewport\input-policy.ts`
- `D:\Developing\Meta Hack\src\ui\viewport\AccessibleMovement.tsx`
- `D:\Developing\Meta Hack\src\interaction\interaction-host.ts`
- `D:\Developing\Meta Hack\src\physics\character-motor.ts`
- `D:\Developing\Meta Hack\src\app\runtime.ts`

第二優先：直接操作場景物件。

- 查清現有 picking、selection、Inspector、拖曳／變形與相機輸入仲裁。
- 讓場景點選有清楚選取回饋，常用移動／縮放操作可發現、可理解。
- 與相機 orbit、FPS、文字輸入及建造操作協調。
- 編輯必須沿用既有 scene command、revision、原子套用與 undo 契約，不能只改畫面而未保存場景。
- 如果必要的操控功能尚未存在，先界定本輪最小完整行為再實作，不全面換掉現有編輯器。

第三優先：預設聲音過小。

- 檢查 source、behavior、propagation、monitor gain、limiter 與預設場景的數位訊號。
- 找出合理調整位置，保留可理解的音量與靜音控制。
- 驗證靜音、暫停、切換、重設及音量平滑，避免爆音或削波。
- 不可用任意巨大 gain 掩蓋訊號鏈問題。
- 自動化只能支持數位輸出結論，不能代替實際裝置聽感或宣稱校準 SPL。

第四優先：UI 整理及其餘工程缺口。

使用者認為現有 UI 說明過多、混亂，版面比例生硬。先讓核心操作可用，再整理資訊層級與面板；版面細節的急迫性低於 FPS 阻斷。

依凍結驗收及最新研究盤點其餘缺口，包括錄製熱路徑及效能，處理可自主完成的工程問題。不要因已有「等待真人」標記，就跳過實際可修的缺陷。

## 六、UI 方向與雙語要求

使用者指定 Emil Kowalski Skills 的方向；專案已有固定來源版本，不必重新安裝或自行升級。

UI 修改前閱讀：

- `D:\Developing\Meta Hack\docs\05-ux\DESIGN_SYSTEM.md`
- 其索引的 tokens、元件、Workspace、FPS 及 Motion 正式規範。
- `D:\Developing\Meta Hack\.agents\skills\reflection-lab-design-system\SKILL.md`
- `D:\Developing\Meta Hack\.agents\skills\emil-design-eng\SKILL.md`
- `D:\Developing\Meta Hack\.agents\skills\ux-engineering\SKILL.md`
- FPS／物理修改另讀 `D:\Developing\Meta Hack\.agents\skills\physics-interaction\SKILL.md`

具體方向：

- 場景、物件及主要動作優先。
- 開始／暫停、音量／靜音、進入／離開第一人稱容易找到。
- revision、hash、完整來源、限制與除錯資料放入可展開詳情；影響當下操作的錯誤留在操作處。
- 清楚分組、留白、對齊及一致元件；面板可合理調整、收合及回復。
- 動態克制、可中斷；高頻輸入不等待動畫。
- 保留鍵盤、焦點、文字輸入及 reduced-motion 行為。

正式文件以繁體中文為 canonical，介面與所有專案文件需維持英文版本。更新英文鏡像的來源 path／hash 與 current／stale 狀態，共用任務與測試資料，不能另建英文任務系統。

## 七、驗收與證據限制

必讀：

- `D:\Developing\Meta Hack\docs\11-v1\ACCEPTANCE.md`
- `D:\Developing\Meta Hack\docs\11-v1\ACCEPTANCE_AMENDMENTS.md`
- `D:\Developing\Meta Hack\docs\11-v1\REQUIREMENTS.json`
- `D:\Developing\Meta Hack\docs\KNOWN_LIMITATIONS.md`
- `D:\Developing\Meta Hack\docs\11-v1\BROWSER_PERFORMANCE.md`
- `D:\Developing\Meta Hack\docs\06-validation\PERFORMANCE_BUDGET.md`

使用者已取消「原生 200% 縮放」必要驗證，以正常 100% 可用為準。不要重新要求該項真人測試。FPS／Pointer Lock 與真實裝置聽測仍有效。

R17 已有正式長時間負面效能證據。不能因量測完成、重跑成功或功能測試通過，就宣稱效能達標。原先的超標、deadline misses、錄製超載、未量測區段及失敗重跑都必須保留。

不要放寬 acceptance、刪除失敗測試、修改 reference 或增加容差來製造成功。修改根因後，對受影響項目重新驗證並保留前後結果。

每份新證據記錄：命令、退出碼、來源 revision／hash、bundle、工具版本、環境、實際結果及限制。測試 bridge、模擬事件、headless 與實體鍵鼠輸入要區分。

只有程式審查不能宣稱 UI 視覺、真實輸入、音訊、效能或真人聽測通過。使用獨立測試程序、既有 benchmark／reference 及隔離審查；缺少獨立驗證時明確標示。

## 八、建置及測試入口

鎖定 Node `22.17.0`、npm `11.4.2`。先核實實際版本，依：

`D:\Developing\Meta Hack\docs\03-sdk\V1_WEB_TOOLCHAIN.md`

不要因本機 PATH 不同而擅自升級依賴或改鎖檔。

現有命令：

```powershell
npm ci
npm run check
npm run dev
npm run build

npm run test:runtime
npm run test:browser:ui
npm run test:browser:physics
npm run test:browser:storage
npm run test:browser:product

npm run validate:docs
npm run validate:english
node scripts/wiki/cli.mjs lint --format json
```

以上是可用入口，不代表每次小改都要重跑所有昂貴流程。先跑對應回歸，整合後完成適當完整檢查。

`npm run check` 不包含全部 browser、native 或真人聽測；一般 `test:browser` 也不能代表所有分開的 browser 套件。其他 runner 參數先讀 package、現行設定與最近收據，不能猜測。

開發伺服器預期前端 5173、API 8787，實際以啟動輸出為準。記錄自己啟動的程序，只清理自己擁有的程序，不批次終止其他 Node／Chrome。

## 九、Git、公開分支及資源邊界

本機完整歷史與公開 main 是不同的歷史線：

- 本次主要接手位置：`D:\Developing\Meta Hack`
- 公開快照工作區：`D:\Developing\Reflections-Lab-public`
- 公開快照分支：`codex/public-snapshot-20261029`
- 既有收據記錄的公開 main：`879c2a75ae24c7286cd9051689a32887a2dd8bb4`
- remote 名稱：`publication`

公開 main 是獨立乾淨快照，沒有原完整祖先。原歷史包含大型與不適合公開的產物，因此不得直接把本機完整分支 push／merge 到公開 main。公開 SHA 是既有查驗紀錄，遠端現況需另查，不能假裝本輪已核實。

本次先做本地開發與交付。不要自行部署、push、force push、接受條款、決定根 LICENSE，或改寫原歷史。若後續需要公開更新，先沿用既有乾淨發布流程提出具體方案。

保留下列既有未追蹤產物，不納入無關修改或刪除：

- `D:\Developing\Meta Hack\artifacts\v1\physics-acceptance-20261029`
- `D:\Developing\Meta Hack\artifacts\v1\product-e2e-chrome-20261029T140617Z`
- `D:\Developing\Meta Hack\artifacts\v1\storage-browser-20261029140834221`
- `D:\Developing\Meta Hack\experiments\sound-behavior-spike\physics-results-2026-10-29T13-52-02-231Z.json`

新建分支或 worktree 前先確認現有工作區、owner 與變更；有隔離需要再建立，不要覆蓋或中斷別人的工作。

開發代理額度與產品 Meta Model API 額度必須分開。先前小型 Live 授權不能視為本輪新支出額度；目前使用 mock／fixtures／offline 測試，沒有新增付費 API 呼叫授權。保留作品內 Meta 整合，不能用 Claude／Codex 模型替代後宣稱 Meta live 通過。

不得輸出、提交或寫入 log 的內容包含 API key、owner token 等憑證。

## 十、任務記錄、交付與停止條件

沿用現有 Wiki task、sources、events、checkpoint 與 handoff。不要另建 Claude 私有權威記憶或平行任務系統。

重要修改後：

1. 保存真正來源及可重現驗證。
2. 更新相關 task、綜合 Wiki 與功能狀態。
3. 來源內容變更建立新版本及 supersedes 關聯，不覆寫歷史 hash。
4. 依 CLI 規則處理 claim、lease、expected hash 及衝突。
5. 更新英文鏡像並檢查。
6. 建立 checkpoint；停止前建立 handoff 並更新 now。

BLOCKED task 不能直接 claim 時，依現有操作規則安排關聯修復任務或正式狀態轉移，不要繞過鎖、不刪 token／journal，也不要為了 claim 假造任務已解除阻斷。新修復任務仍須連回原驗收及 R18 finding。

開始時先簡潔回報：實際 Git 狀態、已讀入口、目前理解與第一個可重現問題，接著執行。不要只交計畫或要求使用者重述已保存在專案中的上下文。

持續完成可自主處理的工程工作。需要真人輸入的項目先明列，其他不依賴它的工作繼續。

最後交付：

- 根因、修改內容與涉及的 R18 finding。
- 原有與新增測試的命令及實際結果。
- source／bundle／commit 對應。
- 尚未修復、未重現、FAIL、BLOCKED、NOT RUN 與 UNKNOWN。
- 更新過的 Wiki、task、handoff 位置。
- 適合使用者重新測試的網址與簡短操作步驟。
- 交由 Codex 複核的證據入口。

裝置聽測預計使用 Austrian Audio Hi-X65 與 ADAM Audio D3V；實際輸出路徑、DAC 及音量仍須真人確認。不要替使用者填入聽感結果。

只剩真正需要真人測試或本人決策時，保存完整交接並暫停。仍有可重現、可修復的工程問題時，不能只將它改名為「真人 gate」而結束。
