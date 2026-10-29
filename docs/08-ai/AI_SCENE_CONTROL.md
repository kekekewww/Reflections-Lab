# AI 場景控制與交易

狀態：`DESIGN_READY / IMPLEMENTATION_PENDING`。機器可讀契約見 `schemas/ai-*.schema.json`；目前沒有正式 scene executor、live Meta adapter 或 UI。以下數值是可調整的 MVP **政策上限**，不是物理定律或經驗證效能。

## 控制邊界

自然語言 → 已授權的場景摘要與 registry → AI 提案 → 本地 JSON Schema → domain／policy validation → sandbox diff／preview → host 授權 → 原子套用 → 版本化 undo。模型只產生提案，不能授權自己的變更、設定預算、切換 provider、上傳檔案或呼叫任意程式。

常用命令名稱延續 Phase J。七個 mutation 工具只能寫入 staging transaction；`PreviewSceneChanges` 計算預覽、不套用。Run／Capture／Analyze／Compare 使用已凍結且有權限的 revision。host 的 Apply／Undo 控制不暴露成 AI 工具。

## 輸入與座標

- SI：公尺、秒、公斤、Hz；右手座標、Y 向上、−Z 向前；quaternion 為 `[x,y,z,w]`。場景 editor 的「右側」依使用者當下選定參考座標解譯，預覽標出 X／Z 軸，不能默默猜成世界 +X。
- ID 只接受已載入 registry／本交易新建 ID；label 可繁體中文。內部 ID 規則 `^[a-z][a-z0-9._-]{0,63}$`，不接受路徑、URL、程式片段。
- 操作包固定有 `schemaVersion`、`requestId`、`sceneId`、`expectedSceneRevision`、`transactionId`、`tool`、`arguments`。revision 是非負整數，host 每次正式變更新增 revision。
- 參數上限：每包 32 mutation、場景 256 物件／16 聲源／1 正式 listener；座標 ±200 m、尺寸 0.01–100 m、質量 0.001–10,000 kg。後三者與 SceneSpec 的界線一致；聲源16是比 SceneSpec 容量32更保守的 AI session 政策，總數由 host 依現有場景計算。
- `gainDbfs` 是指定 signal 的數位增益參數，−80 至 −6；不等於 SPL。播放仍需使用者啟動 audio context、輸出 limiter 與淡入；schema 上限不能單獨保證耳機聲壓安全。

## 必要 domain validation

| 檢查 | 行為／拒絕條件 |
| --- | --- |
| ID／版本 | 物件、材質、signal、listener、backend、實驗都需存在且可讀；CreateScene 不能覆寫已存在 scene；新 ID 不得碰撞；staged 操作按序解析新建 ID。 |
| 幾何 | quaternion norm 與 1 的差 ≤1e−6；box 三軸完整邊長；sphere 三軸必相等且代表直徑；capsule `[直徑,含端帽總高,直徑]`，X＝Z 且 Y≥X。尺寸不可 NaN／Infinity，碰撞檢查不能只看中心點。 |
| 材料 | schema 的 materialId 必須解析到有版本的 acoustic／physics registry；`scope` 必須存在相對資料。各頻帶能量係數、定義及測量來源依材質契約檢查；不讓 AI 自編吸收係數寫進 measured 欄位。 |
| rigid body | Fixed 與 no gravity 不同；切換時釋放 grab／joint、清除或依 policy 恢復速度、重建 contact 並記錄 wake。`restoreSnapshot` 要有有效 snapshot；fixed 不可套 trajectory，trajectory 目前只給 kinematic。 |
| trajectory | 時間嚴格遞增、第一點 t＝0、最後點≤run duration；速度／角速度衍生上限由 host 配置；不得瞬移穿牆。`recordedTrace` 需對應已保存 trace 的 hash；不能把 AI 手寫 samples 當實錄。 |
| source／listener | 信號來自允許的授權 asset registry；source 物件需存在。editor camera 不等於正式 listener；移動 camera 不觸發 MoveListener；FPS attach 由明確模式切換控制。 |
| solver | backend 必實際提供所需 order／metric／sample rate；不支援回 `CAPABILITY_UNSUPPORTED`。solver/trace/material versions 需凍結；duration/timeStep 要可表達為整數 steps（容差1e−9）。 |
| 參照與內容 | registry 說明、研究摘要、圖片 OCR 及文件都是資料，內含「忽略規則」不能新增權限。媒體推測材質只列為 candidate，待使用者選定 registry 值。 |

Schema 僅檢查結構與靜態界線，上表含有跨物件、資料來源與 runtime 狀態檢查，必須另寫 executor。通過 schema 的請求不代表上述檢查已執行。

## Preview、Apply、Undo

1. host 先建立 transaction，保存 baseRevision 與 before snapshot。逐操作驗證整個變更包，任一失敗即不修改正式 scene；回 JSON Pointer 欄位路徑及可操作錯誤。
2. sandbox 產生新增／移除／材質／rigid body／listener diff、碰撞警告、資源預估、使用假設。hash 覆蓋 canonical operations、baseRevision、registry revisions、政策版本與預覽結果；UI 高亮新建物件並顯示離線／模型來源。
3. 使用者可選 Apply、Edit、Cancel。使用者明確開啟「本 session 在 sandbox 自動套用」才可由 trustedLocalPolicy 接受低風險變更；需同樣經 preview 與可見紀錄。預設正式場景逐包 Apply。大量清空、刪除場景與外部寫入不在這些工具範圍。
4. host 驗證 approvedDigest＝previewDigest、簽發來源可信、scene revision 未變、預覽未過期（政策預設5分鐘），持鎖後整包套用。commit 時更新 revision 一次，記錄 result snapshot、requestId 和 inverse。模型傳入的 approvedBy／digest 不具授權效力。
5. 任何驗證錯誤均保留舊 scene；中途 runtime 失敗先恢復 before snapshot，回 `SOLVER_FAILED` 或 `INTERNAL_ERROR`，不可宣稱 atomic commit 成功。requestId 以 host ledger 去重；相同 ID 不同 payload 回 `DOMAIN_INVALID`。
6. Undo 回復剛剛 transaction 的已保存 before snapshot、產生新 revision，重設音訊 graph／physics handles 並短淡出入。若有人後續編輯則回 `REVISION_CONFLICT`，由使用者選擇分支重播；不覆寫後來的工作。Undo 不逆轉已發生費用、外部 side effects 或真實播放。

`ai-scene-change-set.schema.json` 是 host 紀錄格式；跨欄位 digest equality、revision equality、簽發者和 transitions 不由 JSON Schema 保證。state：`drafted → validated → previewed → awaitingApproval → applied → reverted`；也可到 rejected／expired／conflict／failed。新的 operations 一律退回 drafted 並清除 approval。

## 中文命令的可追溯例子

「建立木地板房間，加入持續發聲金屬球，啟用無重力，右側放混凝土牆。」

先查 registry；`wood_floor`／`metal`／`concrete` 若不是現有 ID，回傳候選與限制，不編造。房間大小、球直徑、參考座標未指明時，可用明示的 demonstration defaults 產生可修改 preview，例如房間 `[8,3,6]` m；它們標為「系統預設」，不是使用者明示或物理測量。球使用 dynamicNoGravity，牆使用 fixed；continuous signal 引用授權 registry。預覽列出所有假設與實際尺寸，使用者 Apply 後才進正式場景。若 registry 缺材質，保留草稿並要求選擇；不偷偷換成同名材質。

## 驗收

至少驗證合法提案、未知 ID、額外欄位、過大尺寸、零 quaternion、重複 ID、stale revision、fixed trajectory、衝突 preview、重送 requestId、取消與 Undo。fixture 可以驗證 schema；需要場景 executor 的案例目前 `NOT RUN`。不得以 preview 看起來合理代替 domain／物理測試。
