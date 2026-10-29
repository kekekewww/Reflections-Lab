# Reflection Lab

## 任務與目前階段

三維物理＋可追溯聲學＋Meta AI 實驗平台。目前進行正式Web第一版的實作與整合驗收；產品程式位於`src/`／`server/`，完整範圍與凍結驗收見`docs/11-v1/ACCEPTANCE.md`。尚未完成全部產品、效能與外部門檻；不要把Wiki、Harness、spike或單一測試成功宣稱成整體第一版完成。

後續已確認的使用者範圍變更見[驗收補充](docs/11-v1/ACCEPTANCE_AMENDMENTS.md)，其內容優先於凍結文件相應條款。原生200%縮放已由使用者移除，以正常100%顯示比例可用為準；不再將其列為必要真人gate，歷史測試與結果保留。

## 開發代理責任

**Codex負責主要架構、實作、任務推進與品質驗證；Muse Code僅選用**，不必建立跨coding-agent流程。依 [ADR-013](docs/02-architecture/adr/013-codex-primary-development.md) 取代舊Muse優先政策；舊Harness／測試留為Optional。Muse最新可用性與來源看[資源狀態](docs/09-agents/RESOURCE_STATUS.json)，使用者回報credit不冒充billing查詢，也不自動改executor或支出上限。Meta Model API仍是作品內Muse Experiment Agent的目標，開發改用Codex不算產品Meta live證據。固定驗收、獨立程序／benchmark／reference／隔離review優先；不得僅自審宣告完成。沿用task／Git／provenance／budget規範；[驗收政策](docs/09-agents/VALIDATION_POLICY.md)仍適用，Optional Harness以其操作文件為準。

## Session Startup 與持久記憶

依序讀 `knowledge/schema.md`、`knowledge/wiki/index.md`、`knowledge/wiki/now.md`，再讀相關 task JSON 與索引所列最新 handoff；只展開本任務頁面。用 Git／實際檔案與測試核實，無 HEAD 不能捏造 Commit。`npm run wiki -- status` 與 `query <文字>` 協助定位，不會自動推理或證明內容正確。

研究前先查既有 Wiki／Evidence Ledger；實作前查最新 ADR、feature status、適用 Skill 與驗收。重要需求、決策、功能／SDK／研究／測試／Bug／設計改動後，更新來源、task、相關綜合頁，再 checkpoint；結束前 handoff 並更新 now。完整操作見 `knowledge/README.md` 與 `.agents/skills/persistent-project-memory/SKILL.md`。沒有安裝自動 Session Hook，不把對話歷史當持久來源。

多 Agent 使用不同檔案所有權；task claim 是同一 checkout 的合作鎖／lease，不是跨機獨占。使用 CLI optimistic hashes／事件與 reconcile，不直接同時改 now/tasks/log；鎖失效不擅自刪除。Git 同步保留原始事件／衝突，無許可不 push。Wiki 是綜合索引，不能取代各領域正式來源。

## 架構與來源

- 主方案：React / TypeScript / Three.js / R3F view / Rapier WASM / Custom Web Acoustic Core / Web Audio；固定步不經 React state；Steam Audio optional。技術方向見ADR-011，開發／聲音規則見ADR-013/014；React/R3F已依鎖版工具鏈安裝並有真browser分項證據；完整產品、效能與外部門檻仍以第一版驗收及結果為準。
- 依資訊類型判定權威：需求看最新已確認使用者要求；技術決策看有效 ADR；實際行為看程式＋可重現測試；科學看原始研究／量測；task 看帶證據的 task JSON；Wiki 提供未失效的綜合索引。分歧建立 Conflict Record，不用最後寫入者覆蓋。
- `docs/02-architecture/`：架構、有效 ADR 與歷史、runtime/data contracts；`docs/09-agents/` 為開發 Harness 政策，與產品 `docs/08-ai/` 分開。
- `research/`：論文／理論／datasets／`EVIDENCE_LEDGER.json`；不可把摘要當量測。
- `schemas/`：資料與 AI 契約；`experiments/`：隔離 spike；`tests/`、`benchmarks/`：驗證與結果。
- `docs/01-compliance/`：規則、license、provenance；不代替使用者接受條款或提交。
- `docs/07-experiments/`：錄放／A/B；`docs/08-ai/`：provider 能力與帳號未驗項目。
- `docs/10-sound-behaviors/`：聲音行為架構／事件／bridge／draft schema／驗收；ADR-014。Physics motion、content generation與propagation分開；creative sample不是真實振動，所有3D聲音仍過統一聲學鏈。比較前標acoustic或behavior A/B並核對其固定條件。

## 工程規範

正式文件保留繁體中文（台灣）canonical，依使用者需求提供英文介面與全套文件譯本；英文文件需有原文path/hash與current/stale狀態，任務及測試資料共用，不另建工作系統。code/API/path 英文。精簡模組、顯式錯誤、穩定 domain ID；不得用 array index／opaque Rapier handle 當持久 ID。每次 scene command 驗證 revision、原子套用、可 undo；不將 runtime engine object 序列化成 Scene。

SI（m、kg、s、rad、Hz、Pa）；右手 +Y 上、-Z 前；quaternion `[x,y,z,w]`。physics 固定步、render 插值；gravity=0 仍是 dynamic，fixed 不受力。抓取保持接觸求解、有限 impulse，不 parent 到 camera。physics/renderer/solver/audio/AI 各自 clock；源發聲時間與傳播延遲只計一次。

聲學需標 analytical／numerical approximation／perceptual approximation／unverified。材質標 Measured／Derived／Tuned／Synthetic，釐清 energy/power/pressure、A/R/T、bands、安裝與頻率條件。scattering 不額外消滅能量。dBFS 不等於 dB SPL。只有求解資料能產生聲線；IR 不代表有 individual paths。

audio callback 不等 AI、網路、geometry、physics；不在 callback 做無界 allocation/log／阻塞工作。依實際 block size；平滑 gain/delay、穩定 path IDs、voice budget。Continuous source 與 contact voices 分離。

## Skills

先依任務讀 `.agents/skills/<name>/SKILL.md`：`acoustic-research`、`acoustic-validation`、`steam-audio-integration`、`physics-interaction`、`spatial-audio-dsp`、`ux-engineering`、`experiment-validation`、`compliance-and-provenance`。研究全文／大文件留 docs/research，避免載入全部。

Harness 任務使用 `agent-orchestration`、`muse-implementation`、`codex-verification`；prompt 評測用 `muse-prompt-optimization`，產品 Meta 工具用 `meta-experiment-agent`。不放寬固定驗收；保留 actual executor／model provenance，`agent_execution` 只是既有 Wiki task 的 run 投影。

UI 修改前先讀 `docs/05-ux/DESIGN_SYSTEM.md`、其索引的 canonical tokens、Component/FPS/Motion 規範，以及 `reflection-lab-design-system`；依任務載入已固定來源的 Emil Skills。不得把碼審／token 計算寫成 browser 視覺通過；真正畫面、輸入、音訊與效能各列證據。Wiki UI 頁只作摘要，不另外維護 token 值或 Component 規格。

## 建置與驗證

Node/npm精確版本見`.node-version`、`package.json`；`npm ci`→`npm run check`。正式Web使用`npm run dev`、`npm run build`；實際版本、分開的browser命令與授權清冊見[Web工具鏈](docs/03-sdk/V1_WEB_TOOLCHAIN.md)。`check`涵蓋原研究回歸、runtime、build與license檢查，不代表包含native／browser／hearing tests；列清已跑命令。原`npm run test:physics`與`npm run benchmark`是研究基線，不能代替新正式runtime／browser驗收；native SDK命令仍見`docs/03-sdk/SDK_VALIDATION.md`。

重要數學模型、場景邊界、schema 正負案例與 regression 需有 meaningful tests；純文件／低影響修改不建立照抄實作的測試。改 formulas 同步 fixture reference／tolerance；重要主張加 Claim ID／source／條件／驗證狀態。V0–V5 分開，未執行寫 NOT RUN。

## 授權、安全與完成定義

不大量複製論文／SDK docs／商業素材；每個依賴、資料集、音效與 HRTF 記 license／來源／版本／hash。SDK binary cache 不入 Git；本專案根 LICENSE 未由使用者決定。禁止 secret 入庫；Meta key 只在 server，費用預設 0，未驗帳號不得稱 live integration。

保留未提交變更；禁止 destructive reset/clean、擅自部署／推送。失敗保留錯誤，提供復原方式；一般可逆工程工作自主執行，不重複要求許可。完成前執行適當命令並讀結果、同步 ADR／status／limits；不可用 UI 看似合理取代 physics/acoustic 驗證。新增功能須有可重現證據、來源與下一步限制，不能只改狀態宣稱完成。
