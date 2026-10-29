import type { MessageCatalog } from "../locale-types.js";

export const previewMessages = {
  "preview.title": { "zh-TW": "獨立預聽", en: "Independent preview" },
  "preview.sceneAction": { "zh-TW": "場景聲學預聽", en: "Preview scene acoustics" },
  "preview.stop": { "zh-TW": "停止預聽", en: "Stop preview" },
  "preview.help": {
    "zh-TW": "預聽已套用的規則與靜態位置，不推進原 Run、錄製或指標。撞擊需先選取已接受的接觸事件。",
    en: "Preview the applied rule at a static position without advancing the original run, recording or metrics. Impact rules require a selected admitted contact event.",
  },
  "preview.pauseFirst": {
    "zh-TW": "請先暫停；重播中請先返回即時場景。",
    en: "Pause first. Stop replay before previewing.",
  },
  "preview.applyFirst": {
    "zh-TW": "請先套用或放棄規則與物件覆寫草稿。",
    en: "Apply or discard rule and object override drafts first.",
  },
  "preview.state.idle": { "zh-TW": "尚未開始場景預聽", en: "Scene preview has not started" },
  "preview.state.starting": { "zh-TW": "正在啟用獨立預聽", en: "Enabling independent preview" },
  "preview.state.playing": {
    "zh-TW": "獨立場景預聽中",
    en: "Independent scene preview is playing",
  },
  "preview.state.stopped": { "zh-TW": "場景預聽已停止", en: "Scene preview stopped" },
  "preview.state.error": { "zh-TW": "場景預聽未完成", en: "Scene preview could not start" },
  "preview.raw": {
    "zh-TW": "Raw 監聽：置中乾音；場景傳播與 HRTF 旁通。",
    en: "Raw monitoring: centered dry audio; scene propagation and HRTF are bypassed.",
  },
  "preview.simulated": {
    "zh-TW": "Simulated 監聽：Custom Acoustic Core → AudioEngine；傳播延遲與 HRTF 各一次。",
    en: "Simulated monitoring: Custom Acoustic Core → AudioEngine; propagation delay and HRTF are each applied once.",
  },
  "preview.muted": {
    "zh-TW": "監聽已靜音；使用常駐監聽控制調整。",
    en: "Monitor is muted. Use the persistent monitor controls to adjust it.",
  },
  "preview.details": { "zh-TW": "預聽快照與來源", en: "Preview snapshot and provenance" },
  "preview.identity": { "zh-TW": "預聽 ID／獨立 epoch", en: "Preview ID / independent epoch" },
  "preview.object": { "zh-TW": "物件／世代／位置（m）", en: "Object / generation / position (m)" },
  "preview.origin.objectOffset": { "zh-TW": "物件相對位置", en: "Object-relative position" },
  "preview.origin.fixed": { "zh-TW": "已設定固定位置", en: "Authored fixed position" },
  "preview.origin.capturedContact": {
    "zh-TW": "已接受事件的真實接觸點",
    en: "Real contact point from an admitted event",
  },
  "preview.scene": { "zh-TW": "Scene／快照 tick", en: "Scene / snapshot tick" },
  "preview.behavior": {
    "zh-TW": "文件／Profile／規則／綁定",
    en: "Document / profile / rule / binding",
  },
  "preview.listener": {
    "zh-TW": "Listener 位置／方向 quaternion",
    en: "Listener position / orientation quaternion",
  },
  "preview.contact": {
    "zh-TW": "原始 Run／接觸／聲音事件",
    en: "Original run / contact / audio event",
  },
  "preview.noContact": {
    "zh-TW": "此預聽未使用接觸事件",
    en: "This preview does not use a contact event",
  },
  "preview.solver": {
    "zh-TW": "Solver／結果 revision／能力",
    en: "Solver / result revision / capabilities",
  },
  "preview.duration": {
    "zh-TW": "發聲上限 {seconds} s；傳播與混響尾音另計。",
    en: "Emission window: {seconds} s; propagation and reverb tail are separate.",
  },
  "preview.limit": {
    "zh-TW": "明示規則預聽；不評估 trigger／conditions，不是正式 Run 或實際振動量測。",
    en: "Explicit rule preview; trigger and conditions are not evaluated. This is not a formal run or a vibration measurement.",
  },
  "preview.error.contact": {
    "zh-TW":
      "需要已選取、仍在快取中的真實接觸事件；請執行互動後暫停，選取已接受的撞擊聲音事件再試。",
    en: "Select a retained real contact event. Run an interaction, pause, then select an admitted impact audio event and retry.",
  },
  "preview.error.stale": {
    "zh-TW": "接觸事件與目前物件、文件或 Profile 版本不符；請重新取得並選取事件。",
    en: "The contact event does not match the current object, document or profile version. Capture and select a new event.",
  },
  "preview.error.mapping": {
    "zh-TW": "此規則缺少真實 mapping 輸入；不以假設數值預聽。",
    en: "This rule lacks real mapping inputs; preview cannot invent their values.",
  },
  "preview.error.selection": {
    "zh-TW": "選取的物件、綁定或規則已失效；請重新選取。",
    en: "The selected object, binding or rule is no longer valid. Select it again.",
  },
  "preview.error.emitter": {
    "zh-TW": "此發聲位置尚未支援靜態預聽。",
    en: "Static preview does not support this emitter attachment.",
  },
  "preview.error.audio": {
    "zh-TW": "音訊裝置、素材或聲學路由不可用；請核對監聽與素材後重試。",
    en: "The audio device, asset or acoustic route is unavailable. Check the monitor and asset, then retry.",
  },
} as const satisfies MessageCatalog;

export const previewErrorKeys = {
  PREVIEW_REQUIRES_PAUSE: "preview.pauseFirst",
  PREVIEW_STOP_REPLAY_REQUIRED: "preview.pauseFirst",
  CONTACT_EVENT_REQUIRED: "preview.error.contact",
  CONTACT_PROVENANCE_MISMATCH: "preview.error.stale",
  MAPPING_INPUT_UNAVAILABLE: "preview.error.mapping",
  PREVIEW_SELECTION_MISMATCH: "preview.error.selection",
  PREVIEW_POSE_REQUIRED: "preview.error.selection",
  EMITTER_UNSUPPORTED: "preview.error.emitter",
  PREVIEW_ACOUSTICS_UNAVAILABLE: "preview.error.audio",
  AUDIO_NOT_ENABLED: "preview.error.audio",
  ASSET_NOT_READY: "preview.error.audio",
  WEB_AUDIO_UNAVAILABLE: "preview.error.audio",
} as const satisfies Record<string, keyof typeof previewMessages>;
