# 第一版整合 checkpoint r6：正式性能首輪未達標，開始原因修補

日期：2026-10-27。**完整第一版尚未完成，goal 維持 active**。原 51 項、EN01–06、數值容差、性能負載／門檻及 Task criteria 不變。開發沒有使用 Muse Code，也沒有新增付費 Meta 請求。本機 Git 恢復點 `f006b0e60db18450bdfcbcf22d790b9913724b1e`，後續功能與驗證修補尚未提交；沒有 push／部署。[r5](SESSION_PROGRESS_20261027-r5.md) 保留當前功能驗收與 Task0006／0017／0019 結案證據，Task0020 仍 IN_PROGRESS。

## 原生視窗 V2 的實際結果

[唯一一輪 V2 原生結果](../../artifacts/v1/native-zoom-reachability-v2-2026-10-27T13-09-13.922Z-6ad461b3/summary.json)為 **2/2 PASS**；[獨立稽核](../../artifacts/v1/native-zoom-reachability-v2-2026-10-27T13-09-13.922Z-6ad461b3/independent-proof-audit.json)保留視覺限制。V2 使用官方 Chrome API 啟用精確擁有的 window/tab，再要求實際 visible／非 hidden／focus；沒有焦點模擬、Cua、OS 鍵盤或安全 flags 變更。四份原腳本與所有原斷言／門檻保持原始 bytes。

200% 真 API 1→2、DPR 1→2、1424→712 CSS px、同一視窗與 CSS zoom=1；320 是獨立 native100%／DPR1 的 CSS viewport 案例。兩案各三個實際前置 gate、14 個控制到達、五項 Mute／Pause／dialog／form／Exit 檢查通過，實際 CANVAS lock、trusted／focused／active gesture 與 Listener 退出還原成立。七份程式與 181 個本機輸入、12 個 HTTP 資產前後相符；自有 browser、preview 及 5174 已清理。

200% PNG 有裁切，不能當作完整退出控制的視覺佐證；320 PNG 可見焦點退出控制。320 的 screen emulation 還原也有明列限制。功能／DOM 幾何結果與圖片限制分開，不宣稱 OS IME、人工聽測或完整 WCAG 符合。

## 已真正完成一次 600 秒量測，結果未通過

[正式結果](../../artifacts/v1/browser-performance-20261027T131711449Z/verification.json)、[操作摘要](../../artifacts/v1/browser-performance-20261027T131711449Z/operational-summary.json)及[清理證據](../../artifacts/v1/browser-performance-20261027T131711449Z/cleanup-proof.json)保留原始資料。唯一命令為 `node tests/browser/performance-profile.mjs --phase all --seconds 600`；整批約 13 分 48 秒，UI 測量 600.072 秒。原始狀態為 `MEASURED_WITH_INCOMPLETE_ACOUSTIC_WORKLOAD`，**不能因外層 wrapper exit 0 稱性能通過**；原生 Node exit code 未可靠取得，記 UNKNOWN。

硬體／環境：i9-13980HX、NVIDIA RTX 4070 Laptop／D3D11、實際 Chrome 156.0.8078.48、1920×1080 CSS px／DPR1、native context 48kHz。以下 p95 是本次實測，不是新容差或新預算。

| 範圍 | 首輪實測／判定 |
| --- | --- |
| 256 primitives／64 CCD 的 native WASM step | 2.10ms，原 `<2ms` 未達標；實際 maintain-awake 有效性另為 false，不能聲稱完整指定負載通過。含拷貝的完整 public tick 為 23.30ms。 |
| 預設 8 voices／64 current paths | Worker compute 5.20ms，但 20Hz cadence 無效，故 UNVERIFIED；service reply validation 0.60ms、真正同步 native consumers 14.30ms、observable receive→consumer 15.10ms，原 `<1ms` 未達標。 |
| 明示 256-path 壓力配置 | Worker 6.40ms 因負載／cadence 無效為 UNVERIFIED；service validation 2.00ms、native consumers 50.00ms、observable delivery 51.10ms。current paths 254–256，不能用 aggregate／retired paths 冒充一直 256；有實際 drops／deadline misses。 |
| UI 100 dynamic | 21872 筆 RAF；p95 interval 66.60ms、全部 RAF callback CPU 44.40ms、advance 40.60ms、pose lookup 2.10ms。604 overruns、35.65s dropped wall time、296 paused advances，暖機與三個 capture window 有效性 false。 |
| UI 內部分項 | native physics 0.30ms 只屬該 slice；physics wrapper 5.50ms、behavior／recording tick 4.80ms、capture tick 16.60ms。不能以 native slice 通過代替整體 CPU 預算。 |
| renderer-main trace | 600.073 秒 markers、未回報 CDP loss，但第一筆 RAF 比 begin marker 早 22.5ms，被嚴格邊界驗證拒絕，main occupancy 為 NOT RUN。不能用 callback CPU 推成完整 main-thread PASS。 |
| 音訊裝置／Worklet | 保持 muted；不是耳機聽測、實際 block、underrun、Worklet p99 或 SPL 證據。 |

完整 raw UI 約 24MB，壓縮 trace 約 89MB，原檔保持不變。清理時 browser 已斷線、preview SIGTERM，已知 root/direct children 查核及 5191 listener 歸零；該查核不擴張成全機進程不存在的聲明。

## 下一步是原因修補，不是重跑碰運氣

分開查明：AudioEngine 真 consumer 成本、UI advance／physics snapshot／bridge／capture 成本，以及 RAF 第一個 straddling frame 的量測邊界和 maintain-awake 方法。先讀實際程式與分項資料，提出最小修補、固定參考與回歸；不以降低 bodies／voices／paths／cadence、改 solver 品質、忽略 drops 或放寬門檻製造成功。第一輪失敗永久保留；有實作或方法修正及獨立審查後，才安排新版本測試。

耳機 Austrian Audio Hi-x65、喇叭 ADAM Audio D3V 已由使用者回報，實際聽測仍 NOT RUN。同一 main AudioContext 的靜音 block 驗證探針目前只有 ignored cache 草稿與 18 項 Synthetic tests；沒有播放、原生 callback 量測或產品變更，實際 block 仍 UNKNOWN。待修補版本通過相應驗證再提供具體聽測頁，不預填 128 frames 或硬體 latency。

最後仍須更新逐項證據、原 Tasks、status／limits、所有英文 freshness、最新 handoff、完整 check 與本地 Git；本人資格／條款、根 LICENSE／發布決定分別保留。真 Meta 最小 Sound 切片的原 PASS 沿用，三次授權請求已用完，billing／餘額未知，不再呼叫。
