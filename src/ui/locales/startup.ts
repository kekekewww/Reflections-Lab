import type { MessageCatalog } from "../locale-types.js";

export const startupMessages = {
  "startup.documentTitle": {
    "zh-TW": "Reflection Lab · 聲音行為實驗室",
    en: "Reflection Lab · Sound Behavior Lab",
  },
  "startup.documentDescription": {
    "zh-TW": "Reflection Lab：三維物理、可追溯聲學與聲音行為實驗工作台。",
    en: "Reflection Lab: a workspace for 3D physics, traceable acoustics, and sound behavior experiments.",
  },
  "startup.loading": {
    "zh-TW": "Reflection Lab · 正在初始化物理與聲學工作台…",
    en: "Reflection Lab · Initializing the physics and acoustics workspace…",
  },
  "startup.stopped": {
    "zh-TW": "工作台已停止：{detail}。請重新載入；已儲存的專案不會覆寫。",
    en: "The workspace stopped: {detail}. Reload to recover; saved projects will not be overwritten.",
  },
  "startup.failed": {
    "zh-TW": "初始化失敗：{detail}。請重新載入；已儲存的專案不會覆寫。",
    en: "Initialization failed: {detail}. Reload to recover; saved projects will not be overwritten.",
  },
  "startup.originalDetail": {
    "zh-TW": "原始技術診斷",
    en: "Original technical detail",
  },
} as const satisfies MessageCatalog;
