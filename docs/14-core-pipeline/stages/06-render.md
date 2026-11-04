# 核心階段 06：短 take 離線音訊匯出

日期：2026-11-02（台灣時間）。實作者：Codex render_core；基準為 R21 `429efb7`，另合入 audio_core 的 `17e3318`／`a19e308` 介面提交。自己的最終提交請以 Git 記錄為準。這是核心功能及基本測試交付，Claude Code 後續獨立重驗與使用者真人驗收另行執行；不是完整 V1 或 600 秒效能結案。

## 已實作

- 原 `RecordingArtifact` → `verifyRecording` → 原 VoiceIntent／source cursor／listener／個別路徑 → 同一 `AudioEngine` 與真 `OfflineAudioContext`。沒有另寫一套傳播或音色引擎，也沒有用測試音代替使用者錄製的內容。
- 封閉 `RenderJob` runtime validator：錄製內容與 canonical 儲存 bytes 的兩種 SHA-256 分開、scene revision、solver／material／behavior／asset 設定、固定步有理數時鐘、排他視窗、preroll／tail、來源選擇與 frame／bytes 預算均檢查。
- 預設輸出 propagated mix（Wet）、master、dry content，以及依原物件分組的每個聲源 stem。選擇發聲實例發生在各音訊 bus 之前，原物理／Behavior／admission 不變。
- IEEE float32 RIFF/WAVE encoder，含 fact chunk、正確交錯樣本／長度、peak、超過單位範圍的樣本計數、檔案 hash；不做隱藏 normalization／clipping。
- 單一 backend 限一個持有 job；同 ID／同 hash 冪等、同 ID／不同內容拒絕。所有輸出完成且 hash 核對後才原子發布 manifest。準備階段、各輸出之間與 host 最後發布前的取消均可勝出；失敗不發布 partial 檔案。
- 新 job 失敗或取消時保留上一批已完成匯出。錄製／設定先固定資料所有權，解碼 PCM 在工作開始後複製成工作私有銀行，避免後續素材更動影響不同分軌。
- `RenderHost`／`RenderPanel` 提供進度、取消、各 WAV 逐檔下載及來源清單下載；沿用既有 dock／button／field／HelpTip、繁中與英文介面。App／runtime 接線與真 3 秒錄製入口由主整合代理負責，這份 report 不把未操作的 UI 宣稱為真人通過。

## 輸出語義

| 輸出 | 確切意義 |
| --- | --- |
| mix／Wet | 直接聲＋早期路徑＋已設定的 Synthetic late reverb，unity、主處理之前；不是純尾響分軌。 |
| source stem | 同一時間原點、長度、seed 與 pre-master gain 的物件發聲集合；應在原生浮點容差內加總為 mix。 |
| dry | 原 generator／gain／pitch／envelope，無傳播／HRTF／master。與既有 Raw 圖相同，mono 在 stereo 每聲道以 unity 複製，不做立體聲總能量正規化。 |
| master | 所有聲源合成後經固定 headroom／monitor／limiter／safety graph；非線性 master 不要求獨立 mastered stems 可相加。 |

預設取完整短 take，最後錄製 tick 保持一個固定步後停止發聲，再保留明示 tail。preroll 必須從實際 captured tick 邊界開始；不足的歷史與截斷尾響記在每個結果，不推成完整因果歷史。原聲音發生時間與個別路徑 absolute delay 只各計一次。

## 容量與明確限制

- 發聲片段最多 30 秒；preroll＋片段＋tail 的單次 context 最多 45 秒；最多 16 個輸出；工作估算 256 MiB、輸出 192 MiB 上限。估算不是對瀏覽器內部峰值的量測，native 配置失敗仍會明確回報。
- 使用已錄 listener／paths；listener replacement、asset HRTF、純 late tap、持續狀態長 chunk、ADM／雲端皆明確 unsupported。
- source onset 依原 epoch 排程；動態 AudioParam／graph 更新在真 suspend/resume 的 render quantum 邊界執行。每次 requested sample／actual control sample／offset 都進 manifest；不宣稱 `sampleScheduledControls`。控制 grid 不符會失敗。
- native HRTF／limiter 的係數與 latency 由瀏覽器管理，無法用自有 asset hash 固定。結果是從錄製資料重建的數位 PCM，不是硬體 loopback 錄音、校準 SPL 或聽感證據。
- 有真錄製但缺完整 Behavior／cursor／路徑證據時，沿用 ReplayAudioHost 的明確拒絕；缺 propagated capability 不以假路徑或零值冒充成功。

## 基本測試與證據

`06-render-verification.json` 固定命令、退出碼與來源 hashes；相鄰 `06-render-*.txt` 保存輸出。真 OAC runner 為 `node tests/browser/render/run.mjs`，每輪輸出獨立 timestamp JSON，原失敗保留。

- Node 13 項基本回歸：真 Behavior／solver 錄製 fixture、合法 sample pins、封閉 job schema、來源／clock／scene／configuration hash、精確 inclusive 預算、preroll、WAVE 標頭與樣本、準備階段取消與重疊工作。
- 真 headless Chrome OAC 7 項：錄製產出全部檔案、兩個物件 stems 加總（最大逐 sample 誤差門檻 2e-6）、檔案 hash／manifest／frame count、冪等與 job ID 衝突、原創 pinned impulse onset＋absolute delay（容差 1 sample）、取消後沒有 partial publication。
- 最初 browser fixture 把 non-loop sample 指派到連續 lifecycle，production validator 正確拒絕；原 ERROR 收據保留。修正為合法 OnGrab one-shot fixture後通過，沒有修改產品驗證或放寬容差。
- TypeScript、ESLint、Prettier 使用鎖版工具鏈；真正檢查結果依機讀收據，不以本文件文字取代退出碼。

## 主整合與 Claude Code 重驗入口

`new RenderHost({getRecording, getAssetBank, getMasterSettings?})`；`RenderPanel` 接 `host`、`locale`、`onCaptureShortTake?`。後續建議從正式 UI 依序做真 3 秒錄製、產生、逐個下載 mix／master／dry／stems／manifest；重新解碼 WAV 並核對檔名、hash、長度、非空內容及相同時間原點。主代理的 computer-use 實際操作另保存，不由這份 headless 基本測試代替。

## 本階段基本驗證完成點

核心程式提交為 `55d40fd`。在該提交的原始碼上，Node 13／13、真 OAC 7／7、TypeScript、ESLint、Prettier 均 exit 0。最新 browser 收據為 `06-render-browser-2026-11-02T053458552Z.json`，Chrome 156.0.8078.75。兩個 stem 加總最大逐 sample 誤差為 5.122274160385132e-9；原創 impulse 的 direct 預期／實際 sample 為 2654／2654，dry 為 2080／2080。測試在第一個輸出完成後清空呼叫端原 sample buffer，後續 dry 仍正確，支持工作私有 PCM copy 的所有權界線。

Manifest 內嵌已 pin 的 render configuration；stem ID 由物件 ID 的固定 hash 與名稱產生，不以列序作為持久 ID。實際控制點對照保存第一個輸出，其他輸出逐次驗證相同的 native grid 邊界。
