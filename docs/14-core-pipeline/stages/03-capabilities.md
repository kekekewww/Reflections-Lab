# 階段 03：聲音行為能力清單與反彈事件核心

日期：2026-11-02（台灣）。執行者：Codex 子代理 capability_core；獨立設計審閱：bounce_review；實作碼審待整合複核。基準 `429efb7597ec913bd879ecc05c29a6be7ad5175c`，分支 `codex/pipeline-capabilities`。本階段不代表完整 V1、硬體音訊或性能驗收。

## 已完成核心

- `src/capabilities/sound-behavior.ts` 提供同一份 typed／JSON-safe trigger 能力投影。每項含 trigger、kind、supported、reasonCode、繁中／英文原因及限制。產品宣告為 OnBounce producer 已接線、zone producer 未接線。
- `makeBehaviorContext` 攜帶可信 `producerCapabilities`；Profile Registry、作者驗證及 Sound Proposal Host 共同拒絕 enabled unsupported trigger／latch stop／zone emitter。停用規則可保留，但 Binding override 不得啟用未支援規則。
- Offline Sound Planner 依同一能力宣告處理 bounce／zone intent；未支援的區域要求明確拒絕，不再靜默退成 AlwaysOn。Sound planner 的封閉輸入契約加入可選且嚴格的 boolean producer 宣告，舊 standalone evaluator／fixture context 不需 migration。
- 新 `PhysicsBounceProducer` 在 PhysicsWorld 固定步事件完成後產生真正 `PhysicsEvent.OnBounce`。純 adapter 僅轉送事件；runtime 與 AI Run 共用 PhysicsWorld，因此不需要另外推測反彈。錄製的 raw physics 與 normalized discrete event 身分保持一致。
- 反彈必須有已接受的 parent OnImpact、同接觸 pair 的 ContactEnd、有限 tick 時窗，以及包含角速度的離面接觸點速度。接觸點以兩 body 的 local anchor 儲存並按當前姿態還原。新接觸 episode、mode／generation／epoch／revision、held、discontinuity、互動或外部 impulse／velocity 會使舊候選失效。候選、事件與證據 ring 皆有上限。

## 明確範圍

`CAP-001`：共用能力的正負契約有 Node／schema／Host 測試支持，非 UI 視覺驗收。Root UI 分支需消費本 API，更新舊 OnBounce「未支援」文字。

`CAP-002`：反彈是 **Tuned 工程分類**，限定動態物件對未移動、未旋轉的 fixed 支撐面。動態對動態、旋轉／移動支撐面保守不分類；不是量測材質、完整接觸力或任意形狀反彈保證。分離候選門檻 0.15 m/s、窗口 0.25 s；不是聲壓／生理門檻。

`CAP-003`：本專案沒有真 zone region registry／occupancy authoring，本階段仍明示 unsupported。未新增假 zone 事件、未改 Scene schema，也不以 schema 可表達能力宣稱產品已具備 producer。

通用 evaluator 可由其他可信 producer 提供 normalized 事件；只有產品 context 明確宣告 producer 時才套用產品支持限制。模型回覆不授予 Host 權限。

## 基本測試

- 新 capability 8 案與 bounce 9 案：17/17 PASS，含真 Rapier 固定步撞擊／分離→raw OnBounce→純 adapter→Behavior evaluator emission；非 headless 瀏覽器或硬體播放。
- 較廣既有與新增 regression：255/255 PASS，涵蓋 physics、audio-behavior、defaults、作者編輯、支撐錨點及 Sound Host／provider／server／session。原結果存於 `03-capabilities-regression.txt`。
- `npm run typecheck`：exit 0，見 `03-capabilities-typecheck.txt`。
- Scoped ESLint／diff／來源 hash 見同目錄 verification 與檢查收據。

沒有執行 browser UI／native Pointer Lock／聽測／600 秒效能／Meta live；這些不能由本階段測試推定通過。未更動原數值 reference／容差、package／lockfile、Wiki 共享生成檔或舊 artifact。

## 合併接線與 Claude Code 複核

1. UI 使用 `getSoundBehaviorCapabilities(PRODUCT_SOUND_BEHAVIOR_PRODUCERS)`。提供 `soundTriggerCapability`、`assertSupportedSoundTrigger` 與 `assertSupportedBehaviorDocument` 供其他產品邊界共用。
2. `PhysicsWorld.fixedStep` 的 bounce append 必須在 motion after-step hooks／錄製 observer 之前。合併 motion 的 `applyMotionImpulses` 時，在 mode／held／finite 驗證成功後、改速度之前呼叫 `this.bounceProducer.invalidateObject(id)`，避免控制 impulse 被錯當反彈。
3. Source-phase 保護條件不變：raw physics 的 OnBounce 與 inputFrame 事件必須一一對應，不可在錄製之後合成或補回事件。
4. Claude 重驗穩定接觸不重觸發、滑離不算反彈、相反 canonical 順序、角速度／local anchor、控制干預、重複 tick／reset、新 episode、容量及取消／匯入生命週期，並做實際產品 UI／聲音操作。