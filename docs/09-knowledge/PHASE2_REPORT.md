# Phase 2：持久 Wiki 與設計工程環境

日期：2026-10-26（Asia/Taipei）。本階段實作知識工具與設計規範，沒有開發正式模擬產品。原需求見 [PHASE2_REQUEST](../00-project/PHASE2_REQUEST.md)，變更清單見 [PHASE2_FILE_MANIFEST](../00-project/PHASE2_FILE_MANIFEST.md)。

## 從哪裡開始

[AGENTS](../../AGENTS.md) → [Wiki Schema](../../knowledge/schema.md) → [Index](../../knowledge/wiki/index.md) → [Now](../../knowledge/wiki/now.md) → 相關task JSON／最新handoff。這些都是repo檔案，不依賴前次對話或特定IDE。操作參數見 [WIKI_OPERATIONS](WIKI_OPERATIONS.md)。

## 已建立的系統

Source Manifest索引既有docs/research／不可變實驗結果、使用者需求、ADR與24筆外部參考metadata，保留取得時間、版本、hash、授權、可信度與相關頁。受限資料不複製全文；原Gist固定revision `ac46de1ad27f92b28ac95459c782c07f6b8c964a`與原始bytes hash已核，license UNKNOWN，只保存metadata與原創整理。

Wiki含現況／目標／正式roadmap導航／tasks、架構／決策、feature狀態、科學綜合、SDK／physics／replay實驗、設計／FPS Grab閱讀路徑、歷史／blockers／證據概念與handoff。它串接各領域，沒有搬移或重寫原研究。每頁frontmatter區分VERIFIED/ACCEPTED/PROPOSED/EXPERIMENTAL/UNVERIFIED/DEPRECATED；實作、測試、物理驗證仍分開。

7張Task有stable ID、owner/lease、依賴、驗收與hash evidence；任務JSON是權威、tasks.md是衍生。UUID事件不可變，log.md可重建；來源變動使用新ID＋supersedes，保留舊hash與歷史。index/log/tasks只改生成區，保留curated文字。

CLI提供ingest/query/lint/checkpoint/handoff/status與claim/heartbeat/update/release、supersede/reconcile/rebuild/recover/unlock。使用固定yaml2.9.1／AJV8.20.0；Page/YAML有大小、深度與alias限制，沒有embedding／LLM／雲端服務。query是最多10個有限excerpts的詞彙檢索，不是假裝能自行做科學綜合。

## 並行與歷史

同checkout以合作writer鎖、預期hash、單檔atomic rename及transaction journal防止靜默覆蓋；跨機／worktree沒有共享鎖，仍依分工與Git reconcile。多檔寫入不是global atomic；未完成journal阻擋穩定讀寫，恢復須確認目前bytes符合before/after，外部修改保留。dead writer需同host/PID/token/reason證據才unlock，不自動搶過期鎖。

本次真實Ingest將多份更新中的UX／相容性來源轉新版本；精確相同plan重跑回unchanged。舊current hash已改為historical，lint warning保留，不刪除歷史。原有Listener退出政策互斥與jump/crouch優先級分歧，留下原文節錄/hash的Conflict Record，經reconcile建立[整合決策](../../knowledge/wiki/decisions/fps-listener-exit.md)：FollowPlayer退出還原saved ScenePinned並標discontinuity；可選動作P2。這是工程整合，不冒充使用者新偏好或runtime證據。

原Phase1 `validation-local.json`與另存快照保留；本階段總測試寫到`benchmarks/results/phase2-validation-local.json`。目前仍無Git HEAD、沒有commit/remote/push；hash不能獨自還原未保存的舊文件，Git長期保存與跨機同步仍需後續建立版本歷史。

## 設計與 Skills

唯一設計維護位置為 [docs/05-ux/DESIGN_SYSTEM](../05-ux/DESIGN_SYSTEM.md)，參數在 [DESIGN_TOKENS.json](../05-ux/DESIGN_TOKENS.json)：75 tokens涵蓋colors/type/spacing/radius/border/elevation/motion/z-index／states。19元件七態、motion決策框架、FPS例外、聲學線型／色彩refs、18壓測案例與六種效能量測規範皆可定位。正式數值預算仍只有docs/06-validation/PERFORMANCE_BUDGET，沒有第二套放寬門檻。

Emil八個指定Skills與6份必要reference採固定commit `2d228630ba1446365f614a108cb8252f1feda202`，連README/LICENSE共16個原檔核對bytes/Git blob/SHA256；單份保存在`.agents/skills`與third_party provenance，無symlink或全域安裝。`skills@1.7.4`要求Node≥22.20，故未在專案22.17執行它；改用經查核的固定來源補缺工具，拒絕覆寫已改原檔。

自有Skills官方quick_validate **10/10 PASS**；上游8Skills另驗固定bytes。`pick-ui-library`原文的`disable-model-invocation`不在這份quick validator接受的欄位內，未修改上游來假裝通過；Codex另加`agents/openai.yaml`禁止隱式呼叫。這是已配置的metadata，runtime選擇測試NOT RUN。

## 跨 Agent

本機版本：Codex0.163.0、Claude Code2.1.308、Pi0.85.1；文件能力與實際session分開。Claude薄CLAUDE/Skill入口指同份規範，Pi該版本本身讀rootAGENTS與`.agents/skills`，不建立多餘`.pi`副本。Pi使用獨立Node22.23.2，不能把root22.17稱滿足它的engine；Pi help曾遭trust-lock EPERM，未升權或變更信任設定。

沒有安裝自動Session Hook；共同啟動／手動checkpoint/handoff是目前機制。原生Claude/Pi live handoff未跑；本地無上下文Codex子代理閱讀測試會另記，不能替代其他工具的實測。qmd2.8.3的main/tag／MIT／native及模型需求已查，但未安裝或啟動，先採index／詞彙搜尋／rg。

## 驗證與重跑

```powershell
npm run test:wiki
npm run test:design
npm run validate:wiki
npm run validate:skills
npm run validate:design
npm run validate:all
```

總流程為16個命令，包含原本30個解析／產品契約regression、Rapier6項、資料取得工具17PASS/1junction SKIP，以及新增Wiki／設計測試。最新實際數量／exit／stdout／hash查[Phase2總結果](../../benchmarks/results/phase2-validation-local.json)，情境A–E查[情境驗證](SCENARIO_VALIDATION.json)；本文不把尚未執行項填PASS。

本次最後完整流程 **16/16 命令通過**：Wiki **50 PASS／1 SKIP／0 FAIL**（51案例）、Design **14/14 PASS**、原有契約 **30/30 PASS**、Rapier **6/6 PASS**、資料取得工具 **17 PASS／1 SKIP**。兩個SKIP均因本機sandbox禁止建立junction fixture，相關runtime guard未宣稱通過。12個JSON schemas可編譯；8項上游Skills的16檔hash與75tokens／19元件／24contrast pairs靜態檢查通過。獨立無對話閱讀已能找回目標、P0與Grab規格，實際Handoff也能恢復工作而不重做科學研究。

Wiki測試涵蓋idempotent ingest／index/topic更新、metadata／來源／task證據、交接恢復、old/new decision、並行child writers／claims、stale proposals、source／decision cycle與取代歷史、partial write recovery／外部改動、路徑alias、YAML／malformed links、沒有hook的手動流程。設計14個測試涵蓋來源完整性、補缺dry-run/mockrestore、修改保留、錯hash/過大拒絕、tokens／contrast／units／curves／元件狀態／聲線語義。

## 仍然存在的限制與下一步

沒有正式UI，因此browser visual／keyboard／pointerlock／audio／WCAG符合性與裝置效能全部NOT RUN；靜態75tokens/24contrast組合不是畫面通過。任意自然語言矛盾、研究真實性、最新網路version與Agent實際遵守程度不能完全由lint判定。來源／query是非可信資料，不是執行指令。

下一Agent先讀now與最新handoff，核對task、Git與pending journals；正式產品第一任務仍是[既有P0-01](../NEXT_ENGINEERING_TASK.md)。本次沒有啟動它，也沒有代替使用者登入／接受條款／提交／推送。
