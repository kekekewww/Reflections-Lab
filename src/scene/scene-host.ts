import { applyCommand } from "./commands.js";
import { SceneError } from "./errors.js";
import { createScene, deserializeScene, serializeScene } from "./validate-scene.js";
import type { SceneCommand, SceneCommandResult, SceneSpec } from "./types.js";

export class SceneHost {
  private current: SceneSpec;
  private readonly undoHistory: SceneCommand[] = [];
  private readonly redoHistory: SceneCommand[] = [];
  private readonly historyLimit: number;

  constructor(scene: unknown, historyLimit = 128) {
    if (!Number.isSafeInteger(historyLimit) || historyLimit < 1 || historyLimit > 1024)
      throw new SceneError("INPUT_LIMIT", "History 上限必須為 1–1024。");
    this.current = createScene(scene);
    this.historyLimit = historyLimit;
  }

  get scene(): SceneSpec {
    return structuredClone(this.current);
  }
  get canUndo(): boolean {
    return this.undoHistory.length > 0;
  }
  get canRedo(): boolean {
    return this.redoHistory.length > 0;
  }

  apply(command: unknown): SceneCommandResult {
    const result = applyCommand(this.current, command);
    this.current = result.scene;
    this.undoHistory.push(structuredClone(result.inverse));
    if (this.undoHistory.length > this.historyLimit) this.undoHistory.shift();
    this.redoHistory.length = 0;
    return structuredClone(result);
  }

  undo(): SceneCommandResult {
    const command = this.undoHistory.at(-1);
    if (!command) throw new SceneError("NO_UNDO", "沒有可復原的交易。");
    const result = applyCommand(this.current, {
      ...command,
      expectedSceneRevision: this.current.sceneRevision,
    });
    this.undoHistory.pop();
    this.redoHistory.push(structuredClone(result.inverse));
    this.current = result.scene;
    return structuredClone(result);
  }

  redo(): SceneCommandResult {
    const command = this.redoHistory.at(-1);
    if (!command) throw new SceneError("NO_REDO", "沒有可重做的交易。");
    const result = applyCommand(this.current, {
      ...command,
      expectedSceneRevision: this.current.sceneRevision,
    });
    this.redoHistory.pop();
    this.undoHistory.push(structuredClone(result.inverse));
    this.current = result.scene;
    return structuredClone(result);
  }

  import(serialized: string): SceneSpec {
    const imported = deserializeScene(serialized);
    this.current = imported;
    this.undoHistory.length = 0;
    this.redoHistory.length = 0;
    return this.scene;
  }

  export(): string {
    return serializeScene(this.current);
  }
}
