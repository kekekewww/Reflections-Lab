# 恢復工作：獨立唯讀驗收盤點

依據凍結 `docs/11-v1/ACCEPTANCE.md`、`REQUIREMENTS.json`、`REQUIREMENT_EVIDENCE_20261028-r6.json` 和原 task criteria；原矩陣 43 scoped PASS / 8 PARTIAL 是歷史證據，不是目前版本全產品通過。本次沒有執行測試、啟動瀏覽器、呼叫網路或付費模型。實際使用者回報 `artifacts/v1/basic-user-feedback-20261028/feedback.json` 推翻以舊狹義 UI 證據推斷 FPS 可用的假設；原因未知。R12 6aafa976 的 931 runtime / 1977 sources / 61 protected 是其截點；後續 metadata 已變更。

| 門檻 | 繼續可做工程與應保存的證據 | 真正人工／資源門檻 |
|---|---|---|
| PHY03/05/06、UX03 | 優先重現及修復第一人稱入口、lock 和替代控制；可見產品驗證移動、取得 lock 的 click 不觸發 throw/place、Esc/blur/hidden、held/resume、focus/IME、listener 還原；保存 action trace、實際版本與回歸，不能以靜態入口作 PASS。來源 feedback.json、r6 rows。 | 若受原生桌面／OS IME 能力限制，記具體可重現環境及未執行項，再邀人協助；不能先將尚未診斷的程式缺陷標成人工門檻。 |
| UX05 | 依 `docs/05-ux/DESIGN_SYSTEM.md` 與使用者方向精簡常駐文字、主要操作清晰、面板彈性，驗證 focus、keyboard、dialog、200% 與 320 CSS px；診斷原 visible preflight os error，保留兩次原始 FAIL，勿盲目重跑。`artifacts/v1/native-visibility-rca-20261028.json`。 | 自動化無法取得真實桌面／使用者操作時，保留明確手動驗收及設備資訊；使用者接受版面細節稍後調整，不豁免核心可用性。 |
| VAL03 / Task12 AC03 | 調查 `artifacts/v1/audio-prefix-cross-webkit-20261027181436974/sequential-comparison-receipt.json` 中 Firefox FAIL、WebKit capability BLOCKED，修可修的產品與測試，記版本、差異和新的獨立證據；建構目前版本的聽測 session 和 route/rate/block 記錄方法。此前 native graph、browser/cleanup 有狹義證據，不須僅因缺聽測重跑。 | Hi-x65、D3V 各自實際聽 click/pop、音量跳變、移動定位、dropout、pause/resume；記 build、OS/browser、裝置與路徑、sample rate、實際 block、音量與觀察。基本可聽、辨向回報並非完整 V5 或定量物理驗證。 |
| VAL04 | 修正正式 profile 的 physics、delivery、UI 原 FAIL；完整 worker workload、連續有效 600 秒、main occupancy，按 `docs/06-validation/PERFORMANCE_BUDGET.md` 指定負載和硬體分開量測，保存 trace、版本、capability、原 FAIL 和獨立 review。`artifacts/v1/browser-performance-20261027T183039817Z/operational-summary.json`；`artifacts/v1/user-requested-pause-20261028/performance-r3-partial.json` 303 tests/41 FAIL 為未完成候選，不能推 PASS。 | 若指定實體硬體不可得，寫明所需硬體及未測項；先完成可做的程式、儀測、現有設備 profile。Native nodes 不冒稱 Worklet p99。 |
| COM01 / Task20 AC03 | 逐項核對六個 license/source/text closure 缺口，追溯原始精確版本、合法原文/hash、來源權威與 bundle/NOTICE 綁定；判定回收候選是否真的解缺口，不能只記缺口就停。`artifacts/v1/tooling-license-recovery-20261028/summary.json`、`artifacts/v1/bundle-notice-pack-20261027-1914-r10/production-candidate-binding.json`。新 build 後重新綁定與審查。 | 根 LICENSE 選擇、本人競賽資格、登入後條款接受、發布／提交由使用者決定；公開規則研究和文件來源仍由工程處理。 |
| 全域 / Task16 AC01/02 | 修復後按變更重新跑適當 runtime、數值、browser/E2E、獨立 review、完整 check/build、固定保護檔及來源綁定，逐條刷新 frozen matrix；更新過期英文鏡像、原文 hash、語義與 links，保留 current/stale。根據變更更新 task、Wiki、handoff 及真實 Git provenance。`knowledge/wiki/handoffs/f7352adf-612b-40f3-9cf8-8acbba2c599d.md`。 | 接受測試者主觀回饋等才需人；任何新失敗先診斷，不能以先前 43 PASS 取代當前版本證據。 |
| Meta / Task14 | AC01–03 在當時依 scoped records 均 verified，AC02 有既存 live trace；`docs/11-v1/ACCEPTANCE.md` 的凍結時「無 live 資源」文字為時間截點，需對照實際 task 證據而非抹除。保留 fixture/live 區分，變更影響時先作免費離線檢查。 | 既有三次付費 slots 耗盡；不得自動追加付費呼叫。僅若原範圍確實需新 live 證據，明確列差距並由使用者決定新增預算／帳號。 |

原 task 判讀：0012 AC01/02 verified、AC03 未完成；0013 三個 criterion 已 verified 但依賴 0012；0014 三個 criterion 已 verified（不得延伸成任意新 live 授權）；0016 AC01/02 未完成、AC03/04 是當時的 scoped evidence，英文變更後仍需更新；0020 AC01/02 為所述範圍與紀錄本身 verified，AC03 未完成。不得將 task 結果與產品全體完成混為一談。

停止條件：可完成的程式修復、跨 browser、正式效能、來源與英文一致性及對應獨立證據均處理完畢；僅剩上述具體人工、實體設備、帳號或使用者決策後，才整理雙語可執行清單並依使用者指示暫停。原始 evidence、FAIL、NOT RUN 和受限範圍一律保留。
