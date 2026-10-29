---
name: spatial-audio-dsp
description: 處理 Reflection Lab HRTF、SourceGraph、傳播延遲、early paths、reverb 與音訊連續性；不用於論文書目整理。
---

# 空間音訊 DSP

## Trigger / Purpose

更動 audio graph／AcousticFrame mapping／delay 或 IR 更新時，保留時間與能量定義。

## Inputs

source signal、emission epoch、sample rate、backend capabilities、path/IR metadata 與 voice budget。

## Workflow

1. 讀 AUDIO_RUNTIME 與 DSP_MODELS，確認 direct 是否含在 IR、normalization、band gains 語義。
2. continuous emitter 與 collision voices 分開；同一 emission 送 direct/early/late，absolute delay 只計一次。
3. HRTF arrival direction 使用最後一段聲線；自算距離 gain 就停用重複 attenuation。
4. 以 stable path ID 配 voice，birth/death 與 IR bank 交叉淡入。delay 變化產生 Doppler 時不再重複 pitch shift。
5. callback 使用實際 block length、預配置 bounded buffers；不等 worker、AI、network、不做 geometry。
6. raw/simulated gain 一致；輸出電平為 dBFS，未校準不可換成 dB SPL。
7. Sound Behavior發聲內容與physics／propagation分開；所有3D聲音經統一SourceGraph，contact定位不一律COM，audition不進實驗。新增功能先讀docs/10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md與EVENT_MODEL.md。

## References

`docs/02-architecture/AUDIO_RUNTIME.md`、`DATA_CONTRACTS.md`、`research/theory/DSP_MODELS.md`、`docs/06-validation/ACOUSTIC_VALIDATION.md`。

## Outputs

音訊圖、參數語義、時鐘政策、headroom／voice telemetry、DSP 驗證證據。

## Validation

解析 impulse arrival 只是 V1/V2 基礎；新增 audio graph 必須 OfflineAudioContext／browser output 測試，聽測與裝置 latency 另列。

## Failure Handling

過期 frames 沿用最近有效值並標 stale；超出 voices 顯示降級。無 IR／paths capability 就回 unavailable，不生成替代假數據。
