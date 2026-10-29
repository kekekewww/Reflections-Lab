import { coreMessages } from "./core.js";
import { editorMessages } from "./editor.js";
import { explorerMessages } from "./explorer.js";
import { inspectorMessages } from "./inspector.js";
import { mappingMessages } from "./mapping.js";
import { viewportMessages } from "./viewport.js";
import { statusMessages } from "./status.js";
import { startupMessages } from "./startup.js";
import { previewMessages } from "./preview.js";

export const areaCatalogs = [
  coreMessages,
  editorMessages,
  explorerMessages,
  inspectorMessages,
  mappingMessages,
  viewportMessages,
  statusMessages,
  startupMessages,
  previewMessages,
] as const;

export const messages = {
  ...coreMessages,
  ...editorMessages,
  ...explorerMessages,
  ...inspectorMessages,
  ...mappingMessages,
  ...viewportMessages,
  ...statusMessages,
  ...startupMessages,
  ...previewMessages,
} as const;
export type MessageKey = keyof typeof messages;
