import type { MessageCatalog } from "../locale-types.js";

export const trajectoryMessages = {
  "trajectory.title": { "zh-TW": "軌跡", en: "Trajectory" },
  "trajectory.help": {
    "zh-TW":
      "在場景檢視選取有聲音的物件後按 T：點擊表面加入點；點擊軌跡點的控制點即可選取，再拖曳移動；Delete 刪除選取的點；T 或 Esc 結束。Shift+T 顯示所有軌跡。開始運算或錄製時，物件以強度速度沿軌跡移動，結束後交回一般物理。",
    en: "Select an object with sound in the editor view and press T: click surfaces to add points, click a point's handle to select it and then drag it, press Delete to remove the selected point, and press T or Esc to finish. Shift+T shows every path. On Start or Record the object travels its path at the Strength speed, then returns to its normal physics.",
  },
  "trajectory.editing": { "zh-TW": "編輯中", en: "Editing" },
  "trajectory.empty": { "zh-TW": "尚無軌跡", en: "No path" },
  "trajectory.pointCountValue": { "zh-TW": "{count} / {max}", en: "{count} / {max}" },
  "trajectory.points": { "zh-TW": "軌跡點（世界座標）", en: "Path points (world coordinates)" },
  "trajectory.point": { "zh-TW": "點 {index}", en: "Point {index}" },
  "trajectory.selectedPoint": { "zh-TW": "已選取", en: "Selected" },
  "trajectory.insertAfter": {
    "zh-TW": "在點 {index} 後插入一點",
    en: "Insert a point after point {index}",
  },
  "trajectory.deletePoint": { "zh-TW": "刪除點 {index}", en: "Delete point {index}" },
  "trajectory.strength": { "zh-TW": "強度", en: "Strength" },
  "trajectory.startDelay": { "zh-TW": "起始延遲", en: "Start delay" },
  "trajectory.faceAlongPath": { "zh-TW": "沿軌跡朝向", en: "Face along path" },
  "trajectory.clear": { "zh-TW": "清除軌跡", en: "Clear path" },
  "trajectory.length": { "zh-TW": "長度", en: "Length" },
  "trajectory.duration": { "zh-TW": "移動時間", en: "Travel time" },
  "trajectory.problem.TOO_LONG": {
    "zh-TW": "過長：以此強度移動超過 {seconds} 秒；請提高強度或縮短軌跡。",
    en: "Too long: the travel time exceeds {seconds} s at this Strength. Raise Strength or shorten the path.",
  },
  "trajectory.problem.BLOCKED": {
    "zh-TW": "受阻：物件沿軌跡會碰到固定幾何；請把點移離牆面與地面。",
    en: "Blocked: the object would hit fixed geometry along the path. Move the points clear of walls and the floor.",
  },
  "trajectory.problem.TOO_MANY": {
    "zh-TW": "不會執行：同一段最多執行 {count} 條軌跡。",
    en: "Not running: at most {count} paths run in one take.",
  },
  "trajectory.notAudiblePath": {
    "zh-TW": "這個物件沒有聲音，所以這條軌跡不會執行。",
    en: "This object has no sound, so this path does not run.",
  },
  "trajectory.notice.noSelection": {
    "zh-TW": "請先選取有聲音的物件，再按 T 編輯軌跡。",
    en: "Select an object with sound first, then press T to edit its path.",
  },
  "trajectory.notice.notAudible": {
    "zh-TW": "只有有聲音的物件可以編輯軌跡；此物件沒有聲音行為或聲源。",
    en: "Only objects with sound can have a path. This object has no sound behavior or sound source.",
  },
  "trajectory.hint.editing": {
    "zh-TW":
      "軌跡編輯：{name} · 點擊表面加入點 · 點擊點以選取，再拖曳移動 · Delete 刪除選取的點 · T 或 Esc 結束",
    en: "Path editor: {name} · Click a surface to add a point · Click a point to select it, then drag it · Delete removes the selected point · T or Esc finishes",
  },
  "trajectory.hint.readOnly": {
    "zh-TW": "軌跡編輯：{name} · 運算或重播中僅供檢視 · T 或 Esc 結束",
    en: "Path editor: {name} · View only while running or replaying · T or Esc finishes",
  },
  "trajectory.paint.status": { "zh-TW": "繪製軌跡中", en: "Painting path" },
  "trajectory.paint.hint": {
    "zh-TW": "放開滑鼠鍵完成 · 滾輪調整筆刷距離 · {distance} m",
    en: "Release the button to finish · Scroll to change the brush depth · {distance} m",
  },
} as const satisfies MessageCatalog;
