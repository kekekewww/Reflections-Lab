// Compatibility entry for the preserved independent Scene host acceptance.
import { tsImport } from "tsx/esm/api";
const scene = await tsImport("./scene/index.ts", import.meta.url);
export const { createScene, applyCommand, serializeScene, deserializeScene } = scene;
