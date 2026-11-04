# Task0029 補充：Detached 聲源幾何歸屬與 Zone Project 引用

日期：2026-11-02；起點 fa4c3142ba56fa420608b3b1e4a87cc6143b322d。這份補充取代 core REPORT.md 最後「後續跨模組修補」在 source 層級的待辦；core 501/501 是先前固定截點，不外推本補丁。Production browser／聽測仍 NOT RUN，由 Root 合併後統一驗證。

## 問題與修補

原 AcousticSourceInput.objectId 同時表示 logical owner 與 acoustic geometry self-exclusion。當規則明示 zone 或 fixed anchor，聲源可遠離綁定物件；若綁定物件剛好擋在 source→listener 路徑上，舊投影仍排除此物件，造成假的直達聲可見。

- 新 behavior-acoustic-source.ts 由已接受文件查 binding、profile、rule、revision、generation，拒絕身分不一致。不從聲源座標猜 attachment。
- logical objectId／instanceId 不變，原聲軌、聲音 budget 與 ownership 保留。VoiceIntent、AudioEvent、SoundInstance、Scene/config schema 沒有新增欄位或預設值。
- 只有 zone／fixed attachment 在 acoustic source input 帶 emitterObjectId:null。object／contact 不插此欄，因此沿用舊 source input bytes。StaticPreview、Live solve／capture／pause restore、RecordingProcessor 與 ExperimentToolHost 都走相同解析。
- Builder 三態：undefined 沿舊 owner self-exclusion；null 表示 detached，不排 owner；string 表示明示 emitter body，須存在。此分支只補既有 box builder 的最小同義 hunk供獨立實測；Root 合併 acoustic_geometry_core 完整 primitive builder 時須保留其 transform／bounds／容量／cache 與 explicit-target 檢查，不以本分支舊 builder 覆寫新版。

端到端測試另外揭露 Project 作者驗證 hardcode zoneIds:[]：Scene volume 本身可持久化，但帶 zone trigger／emitter 規則的 Project 會 UNKNOWN_ZONE。validate-project 現由同一 sceneSnapshot 投影 zone IDs，並使用可信產品 producer capabilities。作者驗證沒有宣稱資產可播放；未知 region、產品 zone trigger 缺明示 ID 仍拒絕。停用 region 保留引用並可 roundtrip。

## 可重現驗證

- detached-final.txt：5/5 PASS。真 solver 的對照場景 source=(-2,1,0)、listener=(2,1,0)、owner box center=(0,1,0)。detached 輸入保留 owner 六面、directOccluded=true；舊無欄輸入會排 owner、directOccluded=false。明示 zone 與 fixed 預覽採同一政策；object attachment 仍 self-exclude。
- 真 LabRuntime import Project → captureShortTake(3/60) → verify → 同 motion RecordingProcessor B、ExperimentToolHost RunSimulation(0.1s) 均保留 owner 遮擋與原 objectId。證據分類仍為 logicalIntent，不冒稱 hardware/native PCM。
- Project 正例包含同檔 zone trigger＋zone emitter、disabled 引用；負例包含刪 registry／缺 trigger ID。資料 roundtrip 相等。
- detached-regression.txt：**92/92 PASS，0 skipped**，concurrency=2；涵蓋新舊 acoustic input、Zone core、StaticPreview、RecordingProcessor、ExperimentToolHost 與 Project／persistence。
- detached-lint.txt／detached-format.txt／detached-typecheck.txt：scoped ESLint、Prettier、全樹 TypeScript exit 0。
- detached-build.txt：正式 npm run build exit 0；index-CR3KlAmZ.js。既有 chunk-size warning 保留；不作效能通過主張。此 bundle 沒有作為 4173 served browser 證據，也尚不含後續 wireframe slice。
- 獨立 bounce_review 僅讀核對 accepted identity、stop diagnostic、candidate document／pinned document、pause restore、Project reference；未確認新 BLOCKER／MAJOR，未獨立重跑測試。

## 保留失敗與整合提醒

- detached-initial.txt：3/4，真正抓到 Project registry 缺漏，已修。
- detached-second.txt：4/5，新 fixture 將既有 evidenceClass 錯寫成 verified，改為實際 logicalIntent；未放寬產品驗證。
- detached-third-fixture-fail.txt：4/5，新 Host fixture duration=0.05 不符原工具最低 0.1，改合法值；未改 schema/min/assertion。
- 原 core REPORT/evidence.json／501 收據與凍結 oracle 未改；新來源／收據 pins 見 detached-evidence.json。
- Root 整合須保留 geometry branch 的 emitterObjectId 三態，null 不得用 ?? 誤 fallback 到 owner。Wireframe 是另外 commit／來源截點；browser gate 仍由 Zone UI audit 在最新 production bundle 執行。
