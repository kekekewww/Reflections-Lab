# 非進階候選完整實作與驗證契約（2026-11-03）

本輪為使用者明確啟動的新 ACTIVE 工作。需求原文見 [REQUEST](archive://uncommitted-local/docs/16-nonadvanced-completion/history/REQUEST_20261103.json)，實際起點為 e25f9f48302fd357b0f97a6f9bf8565f5916627c；[基準快照](archive://uncommitted-local/docs/16-nonadvanced-completion/history/BASELINE_20261103.json)固定原 task 的完整依賴、criteria、既有旗標與來源 hash。此契約是補充執行契約，原驗收條件、正式負載與容差維持；不能把契約、計畫或 metadata 宣稱成產品通過。

## 範圍與唯一任務權威

正式 task 權威仍為 knowledge/tasks/*.json。RLAB-TASK-0032 是本輪授權、整合與證據對帳的 umbrella；[TASK_OWNERSHIP](archive://uncommitted-local/docs/16-nonadvanced-completion/history/TASK_OWNERSHIP.json)只投影本輪 stage/檔案/資源分工，不另建任務系統。原 PERF dependency 未 DONE 時，候選工程可按 umbrella 並行研究與實作，原 task 的 claim/closed 必須遵守原依賴與每個 criterion 的真證據；不修改依賴來繞過 gate。

| 本輪包含 | 工作與保留條件 |
| --- | --- |
| PERF-001、014 | source/bundle/browser/硬體/裝置/rate 綁定；歸因、probe overhead、兩階段 lifecycle、原正式完整600秒 workload 與 performance gate |
| PERF-002、003 | 有界逐tick evaluation；exact/threshold scalar、shape、delay、direction oracle 與同條件收益/輸出對照 |
| PERF-004、005 | preview/latest-valid 與不可丟 event/capture 分離；identity、revision geometry/cache/owned-buffer、timeout/caps 和所有負例 |
| PERF-006、007 | phase/cursor/admission 保留的 voice policy；既有 asset store 的 pin/eviction/decode staging 和真 bytes/權利來源 |
| PERF-008、011 | 實質 chunk encode/storage、四水位和 seal 所有權；長錄製與有連續 DSP state 的長 PCM mix/stems 輸出 |
| Task0020、0016 | 原 requirement-by-requirement、quality/E2E/lifecycle、文件/英文/來源與外部 gate 對帳；新 UI 和全管線要求完整納入 |

進階 Task0015、PERF-009/010/012 排除；cloud PERF-013 未授權。新付費 API 預算為0，不 push、不部署、不代接受條款。歷史使用者已確認的基本功能不要求重做同一輪人工測試；新功能最終人工主觀觀察/聽測依明確順序排在 Claude 之後。真 Meta paid/live 未授權，fixture 不冒 live。

原 PERF 各條件全文已固定於 BASELINE.original_task_snapshots，依賴和基準現況不改。7份舊 PROPOSED ADR不因本契約整批變為 ACCEPTED；技術採納需明示決策/獨立證據。Task16/20 的歷史 true 只保留原字面證據範圍，不冒本輪重跑。

## 驗證必須分層

所有本輪產品測試初始均為 NOT_RUN。1536 runtime、217有限參數 families、五個5秒WAV及歷史 Computer Use 限制皆是舊截點，不能抵充新產品或本輪方法完成。實作、unit/numerical、真 production UI、native 操作、數位音檔、性能、科學、聽感、Claude 審查各有來源和結果。

1. 基準與每個候選固定 code、bundle、browser/executable hashes、硬體、實際 rate、支援矩陣、量測方法和 overhead；成本收益只報真量測。同負載、相同 capacity 與原性能門檻不變；缺音訊 CPU/deadline 不能記為0。
2. 原 regression、適用數值/reference/physics/audio、schema 正負/邊界、完整 check/build、乾淨產品 E2E 與 reset/import/dispose、獨立程序/review 依 Task20/16 原文及受影響範圍執行。原 criteria 要求的次數不降。
3. Computer Use 必須真的在正常100%畫面操作產品。Playwright 也須真的使用 production DOM pointer/keyboard/適用手勢；兩方法分開結果，不互相冒充。涵蓋 Editor/FPS/Build/退出/焦點/鎖定等操作模式、繁中/英文 UI、所有可達參數與 help/disabled原因、合法/非法/精確邊界、undo/redo、生命期與保存載入匯入匯出。盤點/碼審不是 browser PASS；有限狀態矩陣必須逐項對帳未跑組合，不聲稱無限組合窮盡。
4. 全管線使用真 scene/physics → motion/contact/source behavior → acoustic geometry/solver → unified propagation/native audio → capture/persist/load/replay/A-B → offline mix、per-owner stems、manifest/download 的實際資料與音檔。使用相同條件與真資產 bytes，保留 run/epoch/revision/source/path IDs、一次發聲時間/傳播延遲、錯誤原子性。聲線只由求解結果產生。
5. formal performance 使用原受驗負載、門檻與資格檢查；600秒 wall、sim、capture 分開，不把18000frame/bytes上限當600秒continuous capture。窗外 drain 另存，不回填原視窗；正式拒絕與研究run分開，完整原FAIL保存。unsupported/null/NOT_RUN均保留，降低voices/paths/geometry/擷取負載不能換取正式PASS。

## 長錄製與長輸出實作門檻

這是本輪明確工作，不得退成 writer placeholder、unsupported清單或只驗舊短take。Root已凍結 [長輸出規格v1](archive://uncommitted-local/docs/16-nonadvanced-completion/history/LONG_OUTPUT_FREEZE_20261103_V1.json)：60秒signal、48kHz stereo、2個真stable owners，預設tail2秒，總62秒／2,976,000frames；5WAV（master/raw/simulated及2ownerstems）+manifest，每WAV23,808,056bytes、總119,040,280bytes。max context75秒、tail0..10秒、最多16outputs、working256MiB、output192MiB及32768frame chunks。每tap單一完整native OfflineAudioContext維持連續DSPstate，逐tap釋放完整PCM；不是無限streaming或常數memory。capture原18000frames/64MiB不改，必須實證3601frame含metadata可裝。owner實作及全部音檔/reference/峰值驗證仍NOT_RUN；此為規格凍結，不是產品通過，也不是宣稱原PERF-011已明定60秒。變更另記新version，不以刪掉長工作解決容量限制。

- Chunk storage 必須實際 encode/write/read/recover；accepted/processed/persisted/published 四水位、所有 accepted tick連續、transaction completion、in-flight ownership與bytes高水位有真證據。cap/backpressure、cancel、IDB transaction failure/crash/reload recovery標 interrupted/incomplete，失敗不得發布 Completed；舊有效成果不刪。
- 純copy優化維持 fullTraceSchema/canonical artifact/hash 等價。chunk hash 不是 canonical recording hash；若持久格式改變，先交明確version、compat/migration正負fixture及rollback，再採納。trace JSON 不冒 PCM。
- 取得真 asset bytes，核hash/rate/channels/來源與license refs；sample origin、pitch/phase/cursor、傳播 delay、filter/HRTF/IR/limiter state、warmup/history與tail對獨立整段reference。chunk邊界及整段都驗證，不硬接多個context、不掩飾preroll不足。
- 逐owner stems、mix、必要raw/simulated輸出與manifest有實際時長/frame/rate/channel/hash，finite、sum/reference/邊界誤差沿原容差；peak/輸出cap/cancel/OOM/失敗不得發布完成。數位PCM/native offline證據不冒硬體聽測或SPL。

## 分工與資源 lease

Root 是 integration/main 工作樹及其 Git index 的唯一 owner，負責共享整合 staging/commit 與 normal merge。各 candidate owner 可在自有工作樹，僅對 Root 明確授權的自有檔案 quiet stage/commit；不得跨寫或廣泛 staging，不使用 integration/main index，無 push/deploy 授權。memory agent 為唯一 shared knowledge/sources/tasks/Now/log/English metadata writer。各實作 owner 使用各自工作樹與檔案所有權，不跨樹直接改別人的檔。實際 owner/tree/branch 由 Root 指派後補進 TASK_OWNERSHIP，不猜測；所有 checkout 的 Wiki claim 是合作 lease，不是跨機獨占。

性能/native音訊/browser重負載採機器資源 lease，Root 調度；未取得lease不啟動並行profile/build/browser。Computer Use 單一操作者，先確認可信URL與工具資格，若外部政策拒絕保留原錯誤，不操作private IPC/繞過阻擋。原活躍舊樹不 kill/刪、不偷鎖、不清reset；保留未提交內容，原 failures 与 raw artifacts 不覆蓋。

## 階段與閉合規則

| Stage | 交付與關閉條件 |
| --- | --- |
| S0 基準/契約 | exact request、e25 task/criteria/source snapshot、實際分工/lease、有限候選及長輸出矩陣凍結；產品結果仍NOT_RUN |
| S1 歸因/正式基準 | PERF001/014之P0、受控fixture、probe-free對照與原正式方法資格/完整收據；正負結果不刪 |
| S2 候選實作 | PERF002–008/011原criteria逐條、獨立oracle、容量/lifecycle、真longstorage/PCM；無收益保留reference政策且明報結果 |
| S3 整合品質 | 最新來源完整check/build、原Task20/16要求次數、numerical/reference/physics/audio/長錄製長輸出、來源/格式/權利對帳 |
| S4 UI與全管線 | Computer Use與Playwright分別完成固定全產品矩陣，修bug後重驗受影響項；真匯出檔/獨立解析/全管線有scope/source一致收據 |
| S5 最終封存 | requirement-by-requirement與原task criterion對帳、記憶/英文current、階段報告/來源/限制/Git實際SHA、Claude完整交接 |
| S6 外部後續 | Claude獨立驗證/修改，之後人工；在尚未執行前保持NOT_RUN，不以本輪工程文件冒充完成 |

重要milestone批次CAS/ingest來源→task evidence→綜合頁→checkpoint；每個 stage 有實際命令/exit/raw hashes、source和不足。共享metadata只由單writer修改；CLI claim/token/heartbeat/lease/release、optimistic expected hashes與事件保留。最終source freeze後集中更新完整英文，不每命令重建。最終handoff更新Now；任何未跑項明記NOT_RUN，不能因時間或token不足改DONE。完整V1與本輪非進階工程範圍的結論分開，未滿原條件的task維持未閉合。

## S0凍結更新（v2）

[七樹責任與資源](archive://uncommitted-local/docs/16-nonadvanced-completion/history/TASK_OWNERSHIP.json)已按Root實際ownership v1及真Git branch/HEAD凍結；量測folder實際為baseline，branch為codex/nonadvanced-baseline-measure-20261103。全baseline獨占lease已釋放，目前僅兩個concurrency1小測試slots，其他test/build/browser/native待Root lease。[S0收據](archive://uncommitted-local/docs/16-nonadvanced-completion/history/stages/00-s0-freeze-20261103.json)保留初OOM、19項定向重跑、兩次完整1536suite皆1535PASS/1FAIL/exit1；重現的mockMetaJSON失敗根因待Meta owner，不冒OOM或baselinePASS。S0完成只指scope/ownership/longspec/基準事實保存，S1/S2與原task未閉合。
