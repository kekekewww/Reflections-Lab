# A/B 聲學比較

自2026-10-27區分 **acoustic A/B** 與 **behavior A/B**。以下原有source-signal equality適用acoustic模式；behavior模式規則見末節，不能暗中放寬舊模式。

## 可比較條件

baseline 與 candidate 的 motion trace hash、source signal/hash、listener trace、sample rate、evaluation window、backend/version、geometry、seed 與求解品質相同，僅更動明示 acoustic material 或 propagation parameter。若更換 backend，另標跨模型比較，不能把差異全部歸因材質。

以持續聲源比較 reverberation 時，播放的 emission phase／loop point 必須相同。比較 collision sound 若改的是 physical material（mass/friction/restitution）或 excitation/resonance，必須聲明刺激也改變；僅換聲學表面而重用同 contact trace，才保有同一物理刺激條件。

## 報告

每筆 metric 記 band Hz、unit、方法、分析 window、有效性、noise floor／dynamic range、run artifact IDs。`delta=candidate-baseline`，RT 用 s，DRR／C50／C80 用 dB；delta 百分比 baseline=0 時 unavailable。RT60 可由 T20/T30 extrapolate 時明示 estimator，短 RIR 未達有效衰減區間則 `INSUFFICIENT_DECAY`，不擬造 60 dB 衰減。

IR 比較以共同 emission time 對齊，保留 physical arrival delay；另提供去 direct-delay alignment 作形狀診斷，不能混稱傳播時間相同。raw/simulated monitor 保持相同 gain；若 normalized listening，明示它不適合比較絕對能量。

## 結果分類與防混淆

Measured 為合法取得、具量測條件的觀測；Computed 為指定 solver 的輸出；Estimated 為模型估算；AI-generated Explanation 是引用上述 artifact 的文字。沒有任何 uncalibrated dBFS → dB SPL 推論。

可視化 path selection 與 Inspector 共享 path ID、source/listener、scene revision；Steam IR 沒有逐條 path 時停用相應 UI，仍可比較 RIR/metrics。任何未支援指標顯示 unavailable＋原因。

## 下一階段驗收

相同 motion trace、兩種 Synthetic 材料的解析 fixture可先驗證 band gains／delay；再以獨立 solver（V3）及實際房間／perceptual evaluation（V5）驗證。跨 solver material bands／scattering 不等價，先記轉換規則、誤差與 limits。完整 A/B runtime 尚未執行。

## Sound Behavior A/B（draft，未實作analysis adapter）

[獨立行為草案](../../schemas/sound-behavior/behavior-document.schema.json)的`SoundBehaviorComparison`要求`comparisonKind`及明示`independentVariables`，既有Experiment v1尚未遷移。

| 條件 | acoustic | behavior |
| --- | --- | --- |
| motion／原physics-player事件／listener／幾何／physics設定 | 必須相同 | 必須相同 |
| solver／atmosphere | 必須相同；跨模型另命名 | 必須相同 |
| sourceSignal／asset／generator／profile | 必須相同 | 只允許宣告的asset/generator/gain/pitch/profile自變項造成差異；保存雙方hash |
| propagation material | 只依宣告改acousticMaterial | 必須相同；不能同時改牆吸收與音色後稱單因素 |
| 比較問題 | 同刺激下傳播／聲學材質差異 | 同motion／事件下內容、規則、響度／音色或生成差異 |

`physicsEventTraceHash`是規則評估前的正規化physics/player事件，不是衍生AudioEvent／voice decisions；換規則後後者本來可能不同。相同物理trace改piano sample不能稱source signal相同，也不能用其差異推論牆面RT60改善。

初版採authoritative motion/event replay；重新求解若mass/friction/restitution/gravity變動，應另建physics rerun，不標同motion比較。新增analysis adapter未實作前，舊CompareExperiments不因此自動支援behavior比較，回CAPABILITY_UNSUPPORTED／INCOMPATIBLE_EXPERIMENTS並保留原因。

錄下實際variant／seed、playback參數、voice budget及drop/steal決策。聆聽比較如用loudness normalization，保存原始gain與正規化方法；不能拿正規化結果推絕對能量／SPL。音樂輸出可分析相應合法signal metrics，但RT指標仍須有效IR／量測條件，不由AI或tone規則捏造。
