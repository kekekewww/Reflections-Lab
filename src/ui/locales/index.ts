import { coreMessages } from "./core.js";
import { helpMessages } from "./help.js";
import { editorMessages } from "./editor.js";
import { explorerMessages } from "./explorer.js";
import { inspectorMessages } from "./inspector.js";
import { mappingMessages } from "./mapping.js";
import { viewportMessages } from "./viewport.js";
import { statusMessages } from "./status.js";
import { startupMessages } from "./startup.js";
import { previewMessages } from "./preview.js";
import { pipelineMessages } from "./pipeline.js";
import { trajectoryMessages } from "./trajectory.js";

export const areaCatalogs = [
  helpMessages,
  coreMessages,
  editorMessages,
  explorerMessages,
  inspectorMessages,
  mappingMessages,
  viewportMessages,
  statusMessages,
  startupMessages,
  previewMessages,
  pipelineMessages,
  trajectoryMessages,
] as const;

export const messages = {
  ...helpMessages,
  ...coreMessages,
  ...editorMessages,
  ...explorerMessages,
  ...inspectorMessages,
  ...mappingMessages,
  ...viewportMessages,
  ...statusMessages,
  ...startupMessages,
  ...previewMessages,
  ...pipelineMessages,
  ...trajectoryMessages,
} as const;
export type MessageKey = keyof typeof messages;
