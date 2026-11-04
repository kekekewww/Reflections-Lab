import type { MessageCatalog } from "../locale-types.js";

export const helpMessages = {
  "help.noArchivedRecording": {
    "zh-TW": "尚無已封存錄製；請先錄製並停止後再匯出。",
    en: "No archived recording yet. Record and stop a take before exporting.",
  },
  "help.pauseBeforeRule": {
    "zh-TW": "請先暫停運算，並結束重播後再新增規則。",
    en: "Pause the simulation and stop replay before adding a rule.",
  },
  "help.notFormalMeasurement": { "zh-TW": "非正式量測", en: "Not a formal measurement" },
  "help.restartGap": {
    "zh-TW": "音訊重啟期間的一次性聲音已過期，已略過。",
    en: "The one-shot expired during audio restart and was skipped.",
  },
  "help.about": { "zh-TW": "說明：{topic}", en: "About {topic}" },
  "help.stopRecording": { "zh-TW": "請先停止錄製。", en: "Stop recording first." },
  "help.noUndo": { "zh-TW": "尚無可復原的操作。", en: "No action to undo yet." },
  "help.noRedo": { "zh-TW": "尚無可重做的操作。", en: "No action to redo yet." },
  "help.noOverride": {
    "zh-TW": "此物件沒有可清除的覆寫。",
    en: "This object has no override to clear.",
  },
  "help.projectReplaces": {
    "zh-TW": "套用將替換目前工作區專案。",
    en: "Applying replaces the current workspace project.",
  },
  "help.assetNotReady": {
    "zh-TW": "素材尚未就緒，無法預聽。",
    en: "The asset is not ready for audition.",
  },
  "help.noObjects": { "zh-TW": "尚無物件", en: "No objects yet" },
  "help.noAssets": { "zh-TW": "尚無素材", en: "No assets yet" },
  "help.noBehaviors": { "zh-TW": "尚無聲音行為", en: "No sound behaviors yet" },
  "help.noSelection": { "zh-TW": "尚未選取物件", en: "No object selected" },
  "help.diameter": { "zh-TW": "直徑", en: "Diameter" },
  "help.height": { "zh-TW": "高度", en: "Height" },
  "help.sceneRevision": { "zh-TW": "場景版本 {revision}", en: "Scene rev {revision}" },
  "help.revision": { "zh-TW": "版本 {revision}", en: "rev {revision}" },
  "help.tick": { "zh-TW": "步數 {tick}", en: "tick {tick}" },
  "help.noGravity": { "zh-TW": "無重力", en: "No gravity" },
  "help.digitalLevel": {
    "zh-TW": "數位電平 dBFS ≠ 聲壓級 dB SPL",
    en: "Digital level dBFS ≠ sound pressure level dB SPL",
  },
  "help.mappingCount": { "zh-TW": "{count}/{maximum} 條映射", en: "{count}/{maximum} mappings" },
  "help.acousticModel": { "zh-TW": "數值近似", en: "Numerical approximation" },
  "help.profileRevision": { "zh-TW": "行為版本 {revision}", en: "profile rev {revision}" },
  "help.binding": { "zh-TW": "綁定", en: "binding" },
  "help.documentRevision": { "zh-TW": "文件版本 {revision}", en: "document rev {revision}" },
  "help.epoch": { "zh-TW": "時間原點 0 s", en: "epoch 0 s" },
  "help.generation": { "zh-TW": "世代 {generation}", en: "generation {generation}" },
  "help.paths": { "zh-TW": "{count} 條路徑", en: "{count} paths" },
  "help.geometryRevision": { "zh-TW": "幾何版本 {revision}", en: "geometry rev {revision}" },
  "help.heightInvalid": {
    "zh-TW": "膠囊高度必須大於或等於直徑；請增加高度或減少直徑。",
    en: "Capsule height must be at least its diameter. Increase height or reduce diameter.",
  },
} as const satisfies MessageCatalog;
