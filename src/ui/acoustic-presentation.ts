import type { LabViewModel } from "./contracts.js";

export type AcousticPresentation = LabViewModel["acoustic"]["state"] | "idle" | "empty";

/** Distinguish empty-table causes without changing the runtime result contract. */
export function acousticPathPresentation(
  model: Pick<LabViewModel, "acoustic" | "paths">,
): AcousticPresentation {
  if (model.acoustic.state === "unsupported" && model.acoustic.revision === null) return "idle";
  if (model.acoustic.state === "ready" && model.paths.length === 0) return "empty";
  return model.acoustic.state;
}
