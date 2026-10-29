import type { MessageCatalog } from "../locale-types.js";

export const mappingMessages = {
  "editor.mapping.input.sourceSpeedMetresPerSecond": { "zh-TW": "聲源速度", en: "Source speed" },
  "editor.mapping.input.angularSpeedRadiansPerSecond": { "zh-TW": "角速度", en: "Angular speed" },
  "editor.mapping.input.normalImpulseNewtonSeconds": { "zh-TW": "法向衝量", en: "Normal impulse" },
  "editor.mapping.input.closingSpeedMetresPerSecond": { "zh-TW": "接近速度", en: "Closing speed" },
  "editor.mapping.input.tangentSpeedMetresPerSecond": { "zh-TW": "切向速度", en: "Tangent speed" },
  "editor.mapping.input.slipSpeedMetresPerSecond": { "zh-TW": "滑移速度", en: "Slip speed" },
  "editor.mapping.input.contactSupportForceNewtons": {
    "zh-TW": "接觸支撐力",
    en: "Contact support force",
  },
  "editor.mapping.target.gainLinear": { "zh-TW": "音量", en: "Gain" },
  "editor.mapping.target.pitchSemitones": { "zh-TW": "音高", en: "Pitch" },
  "editor.mapping.target.filterCutoffHz": {
    "zh-TW": "濾波截止頻率",
    en: "Filter cutoff frequency",
  },
  "editor.mapping.unit.linear": { "zh-TW": "linear", en: "linear" },
  "editor.mapping.unit.semitones": { "zh-TW": "semitones", en: "semitones" },
  "editor.mapping.unit.hertz": { "zh-TW": "Hz", en: "Hz" },
  "editor.mapping.editorLabel": {
    "zh-TW": "參數映射曲線編輯器",
    en: "Parameter mapping curve editor",
  },
  "editor.mapping.instructions": {
    "zh-TW":
      "作者控制曲線，非聲學量測。點表 x/y 為 {zero}–{one} 正規化座標；首點 x={zero}、末點 x={one}，x 嚴格遞增。每個輸出最多一條映射。",
    en: "Authored control curves, not acoustic measurements. Point-table x/y values are normalized to {zero}–{one}; the first point has x={zero}, the last has x={one}, and x must increase strictly. Each output can have one mapping.",
  },
  "editor.mapping.cardLabel": { "zh-TW": "參數映射 {id}", en: "Parameter mapping {id}" },
  "editor.mapping.removeMapping": { "zh-TW": "移除映射", en: "Remove mapping" },
  "editor.mapping.inputLabel": { "zh-TW": "輸入 metric · {unit}", en: "Input metric · {unit}" },
  "editor.mapping.inputAria": { "zh-TW": "映射輸入 metric", en: "Mapping input metric" },
  "editor.mapping.targetLabel": { "zh-TW": "輸出參數 · {unit}", en: "Output parameter · {unit}" },
  "editor.mapping.targetAria": { "zh-TW": "映射輸出參數", en: "Mapping output parameter" },
  "editor.mapping.inputMinLabel": { "zh-TW": "輸入下限 · {unit}", en: "Input minimum · {unit}" },
  "editor.mapping.inputMinAria": { "zh-TW": "映射輸入下限", en: "Mapping input minimum" },
  "editor.mapping.inputMaxLabel": { "zh-TW": "輸入上限 · {unit}", en: "Input maximum · {unit}" },
  "editor.mapping.inputMaxAria": { "zh-TW": "映射輸入上限", en: "Mapping input maximum" },
  "editor.mapping.outputMinLabel": { "zh-TW": "輸出下限 · {unit}", en: "Output minimum · {unit}" },
  "editor.mapping.outputMinAria": { "zh-TW": "映射輸出下限", en: "Mapping output minimum" },
  "editor.mapping.outputMaxLabel": { "zh-TW": "輸出上限 · {unit}", en: "Output maximum · {unit}" },
  "editor.mapping.outputMaxAria": { "zh-TW": "映射輸出上限", en: "Mapping output maximum" },
  "editor.mapping.interpolationLabel": { "zh-TW": "插值", en: "Interpolation" },
  "editor.mapping.interpolationAria": { "zh-TW": "映射插值", en: "Mapping interpolation" },
  "editor.mapping.interpolation.linear": { "zh-TW": "Linear · 線性", en: "Linear" },
  "editor.mapping.interpolation.step": { "zh-TW": "Step · 階梯", en: "Step" },
  "editor.mapping.interpolationDescription.linear": {
    "zh-TW": "線性插值",
    en: "Linear interpolation",
  },
  "editor.mapping.interpolationDescription.step": { "zh-TW": "階梯插值", en: "Step interpolation" },
  "editor.mapping.smoothingLabel": { "zh-TW": "參數平滑 · s", en: "Parameter smoothing · s" },
  "editor.mapping.smoothingAria": {
    "zh-TW": "映射平滑時間 s",
    en: "Mapping smoothing time in seconds",
  },
  "editor.mapping.clampHelp": {
    "zh-TW":
      "Clamp 固定啟用。平滑是發聲參數，不改變物理結果或聲音傳播時間。觸發條件可用的 metric 仍由套用時驗證；缺值不冒充 {zero}。",
    en: "Clamping is always enabled. Smoothing affects sound parameters; it does not change physics results or sound propagation time. Available metrics are validated for the trigger when applied; missing values are not treated as {zero}.",
  },
  "editor.mapping.previewUnavailable": {
    "zh-TW": "曲線尚無法預覽；修正下方輸入後再套用。",
    en: "The curve cannot be previewed yet. Correct the inputs below before applying.",
  },
  "editor.mapping.midpointAria": { "zh-TW": "曲線中點預覽", en: "Curve midpoint preview" },
  "editor.mapping.midpointValue": {
    "zh-TW": "{input} {inputUnit} → {output} {outputUnit}",
    en: "{input} {inputUnit} → {output} {outputUnit}",
  },
  "editor.mapping.midpointHelp": {
    "zh-TW": "（曲線中點預覽，未經平滑／非模擬結果）",
    en: "(Curve midpoint preview, before smoothing; not a simulation result)",
  },
  "editor.mapping.rangeSummary": {
    "zh-TW":
      "輸入：{inputLabel} {inputMin}–{inputMax} {inputUnit}；輸出：{outputLabel} {outputMin}–{outputMax} {outputUnit}。",
    en: "Input: {inputLabel} {inputMin}–{inputMax} {inputUnit}; output: {outputLabel} {outputMin}–{outputMax} {outputUnit}.",
  },
  "editor.mapping.pointsCaption": {
    "zh-TW": "曲線控制點 · x/y 正規化 [{zero}, {one}]",
    en: "Curve control points · normalized x/y [{zero}, {one}]",
  },
  "editor.mapping.pointColumn": { "zh-TW": "點", en: "Point" },
  "editor.mapping.axisX": { "zh-TW": "x", en: "x" },
  "editor.mapping.axisY": { "zh-TW": "y", en: "y" },
  "editor.mapping.actionsColumn": { "zh-TW": "操作", en: "Actions" },
  "editor.mapping.pointXAria": { "zh-TW": "曲線點 {index} x", en: "Curve point {index} x" },
  "editor.mapping.pointYAria": { "zh-TW": "曲線點 {index} y", en: "Curve point {index} y" },
  "editor.mapping.removePointAria": {
    "zh-TW": "移除曲線點 {index}",
    en: "Remove curve point {index}",
  },
  "editor.mapping.removePoint": { "zh-TW": "移除", en: "Remove" },
  "editor.mapping.pointLimit": { "zh-TW": "最多 {count} 個點", en: "Up to {count} points" },
  "editor.mapping.fixCurveFirst": {
    "zh-TW": "請先修正曲線與範圍",
    en: "Correct the curve and ranges first",
  },
  "editor.mapping.addPoint": { "zh-TW": "新增曲線點", en: "Add curve point" },
  "editor.mapping.addMapping": { "zh-TW": "新增參數映射", en: "Add parameter mapping" },
  "editor.mapping.countHelp": {
    "zh-TW": "{count}/{maximum} 條映射；輸出參數不得重複。所有變更先保留為草稿。",
    en: "{count}/{maximum} mappings; output parameters must be unique. All changes remain drafts until applied.",
  },
  "editor.mapping.chartTitle": {
    "zh-TW": "作者參數映射曲線；非聲學量測或聲線。{interpolation}。",
    en: "Authored parameter mapping curve; not an acoustic measurement or sound path. {interpolation}.",
  },
  "editor.mapping.chartFixedDescription": {
    "zh-TW": "輸出固定為 {output} {unit}；圖面以置中水平線表示，不是控制點表的正規化 y 值。",
    en: "The output is fixed at {output} {unit}; the chart shows a centered horizontal line, not the normalized y values in the control-point table.",
  },
  "editor.mapping.chartRangeDescription": {
    "zh-TW":
      "輸入範圍 {inputMin}–{inputMax} {inputUnit}，輸出範圍 {outputMin}–{outputMax} {outputUnit}。",
    en: "Input range {inputMin}–{inputMax} {inputUnit}; output range {outputMin}–{outputMax} {outputUnit}.",
  },
  "editor.mapping.chartPointTitle": {
    "zh-TW": "{index}：輸入 {input} {inputUnit} → 輸出 {output} {outputUnit}",
    en: "{index}: input {input} {inputUnit} → output {output} {outputUnit}",
  },
} as const satisfies MessageCatalog;
