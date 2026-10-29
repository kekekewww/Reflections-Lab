import type { MessageCatalog } from "../locale-types.js";

export const editorMessages = {
  "editor.parameter.enabled": { "zh-TW": "啟用", en: "Enabled" },
  "editor.parameter.gain": { "zh-TW": "音量", en: "Volume" },
  "editor.parameter.pitch": { "zh-TW": "音高", en: "Pitch" },
  "editor.parameter.cooldown": { "zh-TW": "冷卻時間", en: "Cooldown" },
  "editor.state.disabled": { "zh-TW": "停用", en: "Disabled" },
  "editor.state.unavailable": { "zh-TW": "— 未提供", en: "— Unavailable" },
  "editor.state.unavailableTitle": { "zh-TW": "未提供", en: "Unavailable" },
  "editor.action.apply": { "zh-TW": "套用", en: "Apply" },
  "editor.action.discard": { "zh-TW": "放棄", en: "Discard" },
  "editor.rule.finiteRange": {
    "zh-TW": "請輸入 {min} 至 {max} 的有限數值；原草稿保留。",
    en: "Enter a finite number from {min} to {max}. Your draft is retained.",
  },
  "editor.rule.aria": { "zh-TW": "聲音行為 {id}", en: "Sound behavior {id}" },
  "editor.rule.bindingDisabled": {
    "zh-TW": "此 binding 目前停用；規則與物件覆寫不能越過綁定 gate",
    en: "This binding is disabled. Rules and object overrides cannot bypass its enabled state.",
  },
  "editor.rule.deleteDraftFirst": {
    "zh-TW": "請先套用或放棄這份草稿，再刪除規則",
    en: "Apply or discard this draft before deleting the rule",
  },
  "editor.rule.delete": { "zh-TW": "刪除行為規則", en: "Delete behavior rule" },
  "editor.rule.deleteAria": { "zh-TW": "刪除 {id} 行為", en: "Delete behavior {id}" },
  "editor.rule.unsupported": { "zh-TW": "未支援", en: "Unsupported" },
  "editor.rule.disabled": { "zh-TW": "目前停用", en: "Disabled" },
  "editor.rule.active": { "zh-TW": "活動中", en: "Active" },
  "editor.rule.waiting": { "zh-TW": "等待觸發", en: "Waiting for trigger" },
  "editor.rule.unsupportedHelp": {
    "zh-TW": "{reason} 請停用這條規則，或改選受支援的觸發條件。",
    en: "{reason} Disable this rule or choose a supported trigger.",
  },
  "editor.rule.trigger": { "zh-TW": "觸發條件", en: "Trigger" },
  "editor.rule.unsupportedSuffix": { "zh-TW": "（未支援）", en: " (unsupported)" },
  "editor.rule.asset": { "zh-TW": "聲音素材", en: "Sound asset" },
  "editor.rule.oscillator": { "zh-TW": "程序音 · Oscillator", en: "Procedural sound · Oscillator" },
  "editor.rule.curveHelp": {
    "zh-TW": "控制曲線可在下方逐點編輯；不改變物理與傳播模型。",
    en: "Edit the control curve point by point below. This does not change the physics or propagation model.",
  },
  "editor.rule.staleDraft": {
    "zh-TW": "原規則已變更；草稿保留。請檢視後明示放棄，再以目前規則重新編輯。",
    en: "The original rule has changed. Your draft is retained. Review and explicitly discard it before editing the current rule.",
  },
  "editor.rule.pending": { "zh-TW": "等待控制器確認…", en: "Waiting for controller confirmation…" },
  "editor.rule.draft": { "zh-TW": "未套用草稿", en: "Unapplied draft" },
  "editor.binding.aria": { "zh-TW": "此物件覆寫 {id}", en: "Object overrides for {id}" },
  "editor.binding.title": { "zh-TW": "此物件覆寫", en: "Object overrides" },
  "editor.binding.sourceUnavailable": { "zh-TW": "來源未提供", en: "Source unavailable" },
  "editor.binding.inherited": { "zh-TW": "繼承", en: "Inherited" },
  "editor.binding.overridden": { "zh-TW": "已覆寫", en: "Overridden" },
  "editor.binding.help": {
    "zh-TW": "未勾選欄位繼承 profile。套用只更動此物件的 binding，其他物件與 profile 保持原設定。",
    en: "Unchecked fields inherit from the profile. Applying changes only this object's binding; other objects and the profile keep their settings.",
  },
  "editor.binding.disabledHelp": {
    "zh-TW": "此 binding 目前停用；物件覆寫不會越過綁定的啟用狀態。",
    en: "This binding is disabled. Object overrides do not bypass its enabled state.",
  },
  "editor.binding.tableCaption": {
    "zh-TW": "此物件各參數的 profile 基底、目前有效值與待套用覆寫。",
    en: "Profile base values, current effective values, and pending overrides for this object.",
  },
  "editor.binding.parameter": { "zh-TW": "參數", en: "Parameter" },
  "editor.binding.base": { "zh-TW": "基底", en: "Base" },
  "editor.binding.effective": { "zh-TW": "有效", en: "Effective" },
  "editor.binding.overrideAria": { "zh-TW": "覆寫{parameter}", en: "Override {parameter}" },
  "editor.binding.override": { "zh-TW": "覆寫", en: "Override" },
  "editor.binding.enabledAria": { "zh-TW": "此物件啟用值", en: "Enabled value for this object" },
  "editor.binding.valueAria": {
    "zh-TW": "此物件{parameter} {unit}",
    en: "Object {parameter} {unit}",
  },
  "editor.binding.finiteRange": {
    "zh-TW": "請輸入範圍內的有限數值。",
    en: "Enter a finite number within the allowed range.",
  },
  "editor.binding.pending": { "zh-TW": "等待覆寫確認…", en: "Waiting for override confirmation…" },
  "editor.binding.inheritDraft": {
    "zh-TW": "草稿：回復全部繼承",
    en: "Draft: restore inheritance for all fields",
  },
  "editor.binding.draft": { "zh-TW": "未套用物件覆寫草稿", en: "Unapplied object override draft" },
  "editor.binding.discard": { "zh-TW": "放棄覆寫草稿", en: "Discard override draft" },
  "editor.binding.apply": { "zh-TW": "套用此物件覆寫", en: "Apply object overrides" },
  "editor.binding.clearDraftFirst": {
    "zh-TW": "請先套用或明示放棄草稿，再清除已儲存的覆寫",
    en: "Apply or explicitly discard the draft before clearing saved overrides",
  },
  "editor.binding.clearHelp": {
    "zh-TW": "清除此規則的物件覆寫，回復繼承 profile",
    en: "Clear this rule's object overrides and restore profile inheritance",
  },
  "editor.binding.clear": { "zh-TW": "清除已儲存覆寫", en: "Clear saved overrides" },
  "editor.binding.clearDraftNotice": {
    "zh-TW": "已保留草稿；清除已儲存覆寫前，請先套用或明示放棄這份草稿。",
    en: "Your draft is retained. Apply or explicitly discard it before clearing saved overrides.",
  },
  "editor.trigger.AlwaysOn": { "zh-TW": "持續發聲", en: "Always on" },
  "editor.trigger.WhileMoving": { "zh-TW": "移動期間", en: "While moving" },
  "editor.trigger.WhileAirborne": { "zh-TW": "飛行期間", en: "While airborne" },
  "editor.trigger.WhileRolling": { "zh-TW": "滾動期間", en: "While rolling" },
  "editor.trigger.WhileSliding": { "zh-TW": "滑動期間", en: "While sliding" },
  "editor.trigger.WhileSpinning": { "zh-TW": "旋轉期間", en: "While spinning" },
  "editor.trigger.WhileHeld": { "zh-TW": "持有期間", en: "While held" },
  "editor.trigger.OnGrab": { "zh-TW": "抓取時", en: "On grab" },
  "editor.trigger.OnRelease": { "zh-TW": "放手時", en: "On release" },
  "editor.trigger.OnThrow": { "zh-TW": "投擲時", en: "On throw" },
  "editor.trigger.OnDrop": { "zh-TW": "放下時", en: "On drop" },
  "editor.trigger.OnImpact": { "zh-TW": "撞擊時", en: "On impact" },
  "editor.trigger.OnBounce": { "zh-TW": "彈跳時", en: "On bounce" },
  "editor.trigger.OnStartMoving": { "zh-TW": "開始移動", en: "On start moving" },
  "editor.trigger.OnStopMoving": { "zh-TW": "停止移動", en: "On stop moving" },
  "editor.trigger.OnEnterZone": { "zh-TW": "進入區域", en: "On enter zone" },
  "editor.trigger.OnExitZone": { "zh-TW": "離開區域", en: "On exit zone" },
  "editor.trigger.OnSleep": { "zh-TW": "休眠時", en: "On sleep" },
  "editor.trigger.OnWake": { "zh-TW": "喚醒時", en: "On wake" },
  "editor.trigger.unsupported.OnBounce": {
    "zh-TW": "目前物理 bridge 未產生 OnBounce；請使用 OnImpact。",
    en: "The physics bridge does not currently produce OnBounce; use OnImpact.",
  },
  "editor.trigger.unsupported.OnEnterZone": {
    "zh-TW": "目前物理 bridge 尚未產生區域進入事件。",
    en: "The physics bridge does not currently produce zone-entry events.",
  },
  "editor.trigger.unsupported.OnExitZone": {
    "zh-TW": "目前物理 bridge 尚未產生區域離開事件。",
    en: "The physics bridge does not currently produce zone-exit events.",
  },
  "editor.error.bindingMetadataUnavailable": {
    "zh-TW":
      "BINDING_METADATA_UNAVAILABLE：尚未提供完整的基底、覆寫與版本資料；目前無法編輯此物件覆寫。",
    en: "BINDING_METADATA_UNAVAILABLE: Complete base, override, and revision data is unavailable. Object overrides cannot be edited.",
  },
  "editor.error.bindingMetadataInvalid": {
    "zh-TW": "BINDING_METADATA_INVALID：物件行為版本資料無效；目前無法編輯覆寫。",
    en: "BINDING_METADATA_INVALID: Object behavior revision data is invalid. Overrides cannot be edited.",
  },
  "editor.error.bindingBaseInvalid": {
    "zh-TW": "BINDING_METADATA_INVALID：基底參數未提供有限值；目前無法編輯覆寫。",
    en: "BINDING_METADATA_INVALID: Base parameters do not contain finite values. Overrides cannot be edited.",
  },
  "editor.error.bindingEnabledBoolean": {
    "zh-TW": "啟用覆寫必須是布林值。",
    en: "The enabled override must be a boolean.",
  },
  "editor.error.bindingGainRange": {
    "zh-TW": "音量 linear 必須介於 0 與 4，並提供有限數值。",
    en: "Volume linear must be a finite number between 0 and 4.",
  },
  "editor.error.bindingPitchRange": {
    "zh-TW": "音高 semitones 必須介於 -24 與 24，並提供有限數值。",
    en: "Pitch semitones must be a finite number between -24 and 24.",
  },
  "editor.error.bindingMissing": {
    "zh-TW": "BINDING_MISSING：原綁定或規則已移除，或無法唯一識別；覆寫草稿保留。",
    en: "BINDING_MISSING: The original binding or rule was removed or cannot be uniquely identified. Your override draft is retained.",
  },
  "editor.error.bindingStale": {
    "zh-TW": "STALE_BINDING：場景、行為文件或原綁定已變更；覆寫草稿保留，請明示放棄後重新編輯。",
    en: "STALE_BINDING: The scene, behavior document, or original binding has changed. Your override draft is retained; explicitly discard it before editing again.",
  },
  "editor.error.bindingAckMissing": {
    "zh-TW": "BINDING_ACK_MISSING：尚未收到符合覆寫草稿的綁定與文件版本；草稿保留。",
    en: "BINDING_ACK_MISSING: No matching binding and document revision has confirmed this override. Your draft is retained.",
  },
  "editor.error.ruleDraftId": {
    "zh-TW": "DRAFT_INVALID：草稿與規則 ID 不符。",
    en: "DRAFT_INVALID: The draft and rule IDs do not match.",
  },
  "editor.error.ruleGainInvalid": {
    "zh-TW": "DRAFT_INVALID：gainLinear 尚有無效或未完成的數值輸入。",
    en: "DRAFT_INVALID: gainLinear contains an invalid or incomplete numeric input.",
  },
  "editor.error.rulePitchInvalid": {
    "zh-TW": "DRAFT_INVALID：pitchSemitones 尚有無效或未完成的數值輸入。",
    en: "DRAFT_INVALID: pitchSemitones contains an invalid or incomplete numeric input.",
  },
  "editor.error.ruleCooldownInvalid": {
    "zh-TW": "DRAFT_INVALID：cooldownSeconds 尚有無效或未完成的數值輸入。",
    en: "DRAFT_INVALID: cooldownSeconds contains an invalid or incomplete numeric input.",
  },
  "editor.error.ruleMissing": {
    "zh-TW": "RULE_MISSING：原規則已移除或無法唯一識別；草稿保留。",
    en: "RULE_MISSING: The original rule was removed or cannot be uniquely identified. Your draft is retained.",
  },
  "editor.error.ruleStaleDocument": {
    "zh-TW": "STALE_REVISION：場景或行為文件已變更；原草稿版本保留。",
    en: "STALE_REVISION: The scene or behavior document has changed. The original draft revision is retained.",
  },
  "editor.error.ruleStaleBinding": {
    "zh-TW": "STALE_BINDING：原物件行為 binding 已替換；草稿保留。",
    en: "STALE_BINDING: The original object behavior binding has been replaced. Your draft is retained.",
  },
  "editor.error.ruleStaleProfile": {
    "zh-TW": "STALE_PROFILE：原聲音行為 profile 已替換；草稿保留。",
    en: "STALE_PROFILE: The original sound behavior profile has been replaced. Your draft is retained.",
  },
  "editor.error.ruleStaleRevision": {
    "zh-TW": "STALE_REVISION：聲音行為版本已變更；請檢查草稿後重試。",
    en: "STALE_REVISION: The sound behavior revision has changed. Review your draft before retrying.",
  },
  "editor.error.ruleAckMissing": {
    "zh-TW": "RULE_ACK_MISSING：尚未收到符合草稿的規則版本；草稿保留。",
    en: "RULE_ACK_MISSING: No matching rule revision has confirmed this draft. Your draft is retained.",
  },
} as const satisfies MessageCatalog;
