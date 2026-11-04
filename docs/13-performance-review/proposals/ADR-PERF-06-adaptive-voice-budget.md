# ADR-PERF-06：可追溯的自適應聲部與路徑預算

- 狀態：**PROPOSED／未採納**；2026-11-01。本頁沒有降低現有驗收負載、改產品預設或採納動態 quality policy。
- 程式基準：`05d40fd2d52f4b737f6acac61fa00356403c0038`；新控制器／跨裝置容量／聽測均 **NOT RUN**。
- 依據：[音訊契約](../../02-architecture/AUDIO_RUNTIME.md)、[A/B 契約](../../07-experiments/AB_COMPARISON.md)、[DSP 審查](../AUDIO_GRAPH_DSP_REVIEW.md)、[產業比較](../INDUSTRY_AUDIO_ARCHITECTURES.md)。

## 問題與已有 admission

[src/audio/control.ts](../../../src/audio/control.ts) 預設24 audio voices、每 voice 8 paths、總96 paths、16 late sends、64 MiB decoded PCM；hard caps 另有64 voices／32 paths per voice／256 total paths。這些不是本次跨裝置實測容量，也不能把256當產品預設。[AudioEngine](../../../src/audio/engine.ts) 已依 priority 明確拒絕／淡出較低 priority voice，stable path ID reuse、path ranking、retiring route／late-send 計數及 drop telemetry 也已存在。

[Behavior admission](../../../src/audio-behavior/voice-admission.ts) 是另一層 deterministic logical instance 接納，與 native graph 成本不同。把 audio rendering 降級回寫成 Behavior 沒發聲，會破壞 trace／A/B 身分。不同裝置上相同聲部數也可能因 FIR／HRTF／IR／tail 組合有不同成本，故不能單靠 active voices 判斷壓力。

## 候選決策

先保留固定預算作正式 baseline，量 per-resource 成本與 burst；只有證據支持時提供明示的 interactive preview quality profile 或有界自適應控制器。實驗 recording／matched A/B 預設固定 profile，聲學或 Behavior 的品質變更須另標不同條件，不能靜默改成「同條件」通過。

候選 resource vector 同時追蹤 active／pending／frozen／retiring voices、direct／early routes、late sends、IR overlap、decoded bytes、graph update time 與 frame age。顯示 requested／admitted／dropped／retiring 及理由；缺少真 callback CPU／underrun 量測時標 unavailable，不用 main-thread wall time 偽裝 audio deadline。

在另行凍結的 profile 中，候選先減少非必要 preview 更新，再考慮較低順位 early paths／late sends，最後才依明示 priority 拒絕新 one-shots；這只是待比較順序，不是已證明最佳策略。Direct／arrival identity、content／gain 與路徑數值不能改寫成另一套物理；「少呈現路徑」須標 perceptual rendering degradation，不能宣稱完整 acoustic result。Continuous source 不為騰位而每次重建；新 contact 與連續聲池責任分明。

## 接納、抖動與生命週期

每個 profile 界定以上各資源數量與 bytes，包含 fade/tail 期間雙重成本；既有 hard caps 保持，適應值只能在獨立驗證範圍內。控制器須有 bounded observation window、明示高低壓邊界、cooldown／hysteresis 與 change reason，避免逐 frame 升降／path churn；各數值由[量測](../MEASUREMENT_PLAN.md)推導，本提案不設任意門檻。

rank ties 使用 stable IDs，path birth/death 淡入淡出；不重用別的 emitter COM 來先混音。資源不足明確拒絕或按固定 policy 降級，不無界擴大 retiring set；已接納聲部的 fade／tail 仍要算在容量內。asset pins、pause frozen arrivals 及 pending schedules 不能因降檔提前回收。

quality decision 概念紀錄為 `runEpoch, policyVersion, profileId, decisionTick, observationWindow, requestedBudget, appliedBudget, reason, affectedInstanceIds, affectedPathIds`。pause/reset/seek/dispose 使舊 controller generation 失效；resume 不把舊 wall pressure 當新 run 的當前證據。若未來允許錄製自適應，必須保存原 admission／quality decisions 及 replay 規則，另做 schema／相容性任務；不在此新增 artifact 欄位。

## 替代與風險

固定品質最容易做可重現比較，也可能在部分裝置暫停／拒絕較多；使用者明選 profile 比自動控制更可解釋。按機型名稱直接分級缺少實際 CPU／browser／散熱證據，不採作保證。自動控制可改善 overload 體驗，但可能造成 pumping、音色／空間感變動、罕見事件消失或跨機 A/B 不匹配；不能以「聽起來可用」替代 DSP 與 physics 驗證。

聲部虛擬化、遠處 source culling、自訂 Worklet DSP 是不同候選，需要 emission/playhead／pause／resume／tail 正確性及等價 oracle；不能從產業做法直接推得本案收益。只有實際 solver paths 能作聲線；被 budget 省略與 solver unavailable 的 UI 原因分開。

## 採納條件與回復

在原固定負載／原 profile 上先量 baseline，再另標候選 profiles，保持同一 scene／motion／events／assets／listener 與數位輸出方法。保存 requested／admitted 資源、tail／bank 峰值、controller changes、PCM arrival／gain／方向／discontinuity、主要 emitter continuity、late/drop reason，以及裝置／browser／供電／散熱；耳機聽感另有真人證據。

採納需證明固定 hard caps 下有界、無 oscillation／identity churn／錯誤回收，且目標瓶頸改善與感知代價都被量出。正式固定性能失敗仍保留；較低 profile 的成功是另一條結果。測 pause/resume、burst、source removal、priority ties、retiring flood、seek、replay、controller cancel 與跨裝置條件；錄製／A/B fingerprint 不得被未記錄的 quality change 污染。

回復時停用控制器、在安全邊界取消舊 generation 並回到原 fixed budget／admission；無法立即恢復的已 drop emission 不偽造補回，保存降級紀錄。若候選改變實驗內容，另開 take，不能把同一錄製中途回復描述成完全相同條件。
