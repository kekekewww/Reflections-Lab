# 下一個可指派Milestone：M0 Audio Event Runtime

對應 **RLAB-TASK-0011**。本次只建立可執行的研究／draft驗證，**此正式runtime尚未開始**。Codex主導；不需MuseCode、API key、Graph editor或新middleware。整體Scene／physics骨架Task0006可平行前進，M0純邏輯先依正規化fixture開發；接上產品需其後Task0012。

## 交付

以TypeScript建立無renderer／AudioNode依賴的domain層：Profile／binding validation、sorted event evaluator、正交continuous gates、idempotent one-shot intents、per-binding cooldown與有界VoiceIntent。消費[Event Model](EVENT_MODEL.md)與draft contract，不把隔離spike直接當正式engine；重要衍生規則先固定獨立fixtures與tolerances。

建議檔案：`src/audio-behavior/profile-registry.ts`、`evaluate.ts`、`runtime-state.ts`、`voice-admission.ts`、`trace.ts`及獨立tests。這些是下一Milestone的待建立路徑，現在不存在；不虛構對應build／dev指令。

## 不可放寬的驗收

1. 同tick不同sequence依定義處理；重送eventId不重播。同物件不同rules可有明示layers，shared profile不共用runtime state。
2. AlwaysOn在移動、OnImpact、Grab／Throw與NoGravity期間不被one-shot誤停；Held與contact等維度可共存。
3. OnThrow／OnDrop只接受成功互動事件；自然重力掉落不合成Throw。impact pair／owner／cooldown定義依正式Event Model，不以每tick contact force觸發。
4. mapping／fade／cooldown有範圍與單位；極值、NaN／Infinity、missing asset／rule、stale scene/profile/binding revision明確拒絕；沒有任意JS。
5. burst超限有deterministic priority／stable ID tie-break與drop/steal原因；continuous與one-shot分開管理，但共受有效預算。此處VoiceIntent不是已能播放的音訊。
6. pause不推進logical tick，reset／seek新epoch清掉舊去重／deadline；保存state後重評相同raw trace得到同logical decision trace。不同behavior A/B可有不同decision trace。
7. 不修改Scene v1／舊AI12enum／原benchmark reference來製造成功；實際command、stdout／exit、Git scope與limitations完整保存，獨立review後更新Wiki task。

P1 latch、rolling/sliding、assetvariant、materialpair advanced routing視驗收分切片，不在M0一次實作全部draft能力。未支援返回CAPABILITY_UNSUPPORTED；不能把WhileAirborne當首Impact停止的latch。

## 當前可執行的前置檢查

```powershell
npm run validate:sound-behaviors
npm run test:sound-behaviors
npm run smoke:sound-physics
```

以上是本次建立的draft／隔離spike命令，不是正式Runtime驗收已完成。M0新增正式tests與script時再記真實命令；沿用現有`npm run check`做回歸。

## 接下來的依賴

Task0012：M0＋Scene/Physics Task0006 → 最小SourceGraph／AlwaysOn＋OnImpact／統一聲學routing／Inspector，補OfflineAudioContext與browser／hearing。先在少量emitter驗通，不先做多voice大場景。

Task0013：再加入Grab/Throw/Airborne完整接線（需相應FPS互動已完成）、rolling／sliding、latch／materialpairs／timeline與兩類A/B。

Task0014：產品Meta agent最小合法proposal→preview→apply→實驗／實際results鏈，獨立於Coding Agent；live prerequisite含Task0007帳號／預算，缺少不得DONE或以fixture當Meta證據。

Task0015：Graph／modal／複雜procedural為P2，非此次Demo必要前置。
